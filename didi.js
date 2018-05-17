"use strict";

var http = require("http");
const yaml = require("yamljs");
const util = require("./util.js");
const {promise} = util;
const fs = require("fs");
const Client = require("./client.js");
const Handler = require("./handler.js");
var async = require("async");
var sessions = require("client-sessions");
var file_watcher = require("filewatcher")();
const log4js = require("log4js");
var {log} = util;

class Didi {
  constructor() {
    this.files = {};
    this.clients = {};
    this.client_seq = 0;
    this.request_seq = 0;
    this.pages = {};
    this.reads = {};
    this.search_paths = ['./didi', '.'];
    this.config = {};
    this.log = log;
    this.seq = 0;
    this.init_file_watcher();
    this.read_config()
      .then(config=>this.init_logging(config.logging))
      .then(()=>this.load_validators())
      .then(()=>this.init_server())
      .catch(e=>this.report_exception(e))
  }

  init_logging(config) {
    var layout = { type: 'pattern',  pattern: "%[%d %p %c %X{user} %m%]"};
    log4js.configure({
      appenders: {
        console: { type: "stdout", layout: layout },
        didi: { type: "file", filename: config.path, layout: layout}
      },
      categories: {
        default: { appenders: ['didi', 'console'], level: "debug" }
      }
    });
    log = this.syslog = log4js.getLogger('didi');
    log.addContext('user', ()=>`[${this.request_seq}] - *system* [0]`);
  }

  get_logger() {
    return log4js.getLogger('didi')
  }

  set_logger(logger) {
    this.log = logger;
  }

  init_session() {
    this.session = sessions({
      cookieName: 'didi',
      secret: 'Mukoni Software @ 2018',
      duration: 24 * 60 * 60 * 1000,
      activeDuration: 1000 * 60 * 5
    });
  }

  load_terms(name, ...dirs) {
    var log = this.log;
    var loader = this.check_loader(this.files, name);
    if (!('__waiting' in loader)) return loader;

    if (!dirs.length)
      dirs =  this.search_paths;
    var file = name;
    if (!/\.\w+$/.test(name)) file += ".yml";
    var paths = [];
    var terms = {};
    return promise(async.reduce, dirs, terms, (terms, path, callback)=>{
      path = `${path}/${file}`;
      paths.push(path);
      if (!fs.existsSync(path))
        return callback(null, terms);
      log.debug(`LOADING ${path} ...`);
      fs.readFile(path, "utf8", (err,data)=>{
        try {
          var term = yaml.parse(data);
          this.merge(terms, term);
          callback(null, terms);
        }
        catch(err) {
          this.report_exception(log,err)
        }
      });
    })
    .then(result => {
      if (!result)
        throw new Error(`File(s) for '${name}' must exist`);
      log.debug("LOADED", name)
      result.__paths = paths;
      loader.__resolve(result);
      this.watch_terms(result, (path) => {
        delete this.files[name];
        return this.load_terms(name, ...dirs);
      });
      return this.files[name] = result;
    })
    .catch(error => {
      loader.__reject(error);
      throw error;
    });
  }

  check_loader(container, key) {
    var log = this.log;
    var loader = container[key];
    if (!loader) {
      loader = container[key] = {};
      loader.__waiting = [];
      loader.__promise = new Promise((resolve, reject)=> {
          loader.__resolve = resolve;
          loader.__reject = reject;
        })
        .then(result => {
          if (loader.__waiting.length) {
            log.debug("RESOLVING PENDING", key)
            loader.__waiting.forEach(watcher=>watcher.resolve(result));
          }
          delete loader.__waiting;
          delete loader.__promise;
          return result;
        })
        .catch(error=> {
          log.error("REJECTING PENDING", key)
          loader.__waiting.forEach(watcher=>watcher.reject(error));
          delete loader.__waiting;
          delete loader.__promise;
          throw error;
        });
      return loader;
    }

    if (!loader.__waiting) {
      log.debug("CACHE-HIT", key);
      return Promise.resolve(loader);
    }

    log.debug("WAITING FOR", key)
    return new Promise((resolve, reject) => {
      loader.__waiting.push({resolve: resolve, reject: reject})
    })
  };


  read_config() {
    var config = {};
    console.log("LOADING CONFIGURATION");
    return this.load_terms("app-config")
      .then(app_config => (config = util.clone(app_config), this.load_terms(config.site_config, '.')))
      .then(site_config  => {
          this.merge(config, site_config);
          util.replace_fields(config, config);
          this.search_paths.push(config.brand_path);
          console.log("BRAND PATH", config.brand_path);
          this.watch_terms(config, () => this.read_config());
          return this.config = config;
        });
  }

  load_fields(terms) {
    return this.load_terms("controls")
      .then(controls => (util.merge(terms, controls), this.load_terms("fields")))
      .then(fields => {
        util.merge(terms, fields);
        util.replace_fields(terms, this.config);
        return terms;
      })
  }

  load_validators() {
    return this.load_terms("validators")
      .then(validators => {
        this.watch_terms(validators, () => this.load_validators());
        this.validators = validators;
      });

  }

  merge(target, ...sources) {
    const enforce_reset = (a, b) =>  b[0]=='_reset'? (b.shift(), b): util.merge_array(a,b);
    var last = util.last(sources);
    if (typeof last == 'function') {
      var options = Object.assign(last(), { array_merger: enforce_reset});
      sources.splice(options.length-1, 1, ()=>options)
    }
    return util.merge(target, ...sources)
  }

  get_cookie(req, cookie) {
    if (!req || !req.headers || !req.headers.cookie)
      return null;

    var cookies = req.headers.cookie.split(";");
    for (var c of cookies) {
      var [name,value] = c.split("=");
      if (name == cookie) return value;
    }
    return null;
  }

  get_client(req) {
    var id = this.get_cookie(req, "didi");
    if (!id) id = 0;

    var client = this.clients[id];
    if (!client) {
      this.client_seq++;
      this.clients[id] = client = new Client(this, this.client_seq);
    }
    return client;
  }

  init_server() {
    this.init_session();
    http.createServer((req, res) => {
      this.session(req, res, () => {
        if (req.didi.seenyou) {
          res.setHeader('X-Seen-You', 'true');
        } else {
          req.didi.seenyou = true;
          res.setHeader('X-Seen-You', 'false');
        }
        var client = this.get_client(req);
        var handler = new Handler(this, ++this.request_seq);
        handler.process(client, req, res);
      });
    }).listen(this.config.server_port);

    log.info("listening on port",this.config.server_port);
  }

  load_page(page, reload) {
    var log = this.log;
    log.debug("LOADING PAGE", page)
    var loader = this.check_loader(this.pages, page);
    if (!('__waiting' in loader) && !reload)
      return loader;

    var already_included = [];
    return this.load_terms(page)
      .then(terms => this.include_all(terms, already_included))
      .then(terms => this.load_fields(terms))
      .then(terms => {
        log.debug("LOADED PAGE", page)
        terms = util.clone(terms);
        if (loader.__resolve) loader.__resolve(terms)
        this.watch_terms(terms, ()=> this.load_page(page, true))
        return this.pages[page] = terms;
      })
  }

  include_all(terms, already) {
    var includes = terms.include;
    if (!includes) return Promise.resolve(terms);
    var promises = includes.map( page => this.include_one(page, already));
    return Promise.all(promises)
      .then(results => this.merge({}, terms, ...results))
  }

  include_one(page, already) {
    if (already.includes(page))
      return Promise.resolve({});
    already.push(page);
    return this.load_terms(page)
      .then(terms => this.include_all(terms, already))
  }

  init_file_watcher() {
    this.watched = {};
    file_watcher.on('change', path => {
      ++this.seq;
      this.log = this.syslog;
      this.log.info("DETECTED CHANGE", path);
      var watchers = this.watched[path];
      var len = watchers.length;
      Promise.all(watchers.map(watcher => watcher(path)))
        .then(() => this.watched[path].splice(0, len))
    });
  }

  watch_terms(terms, callback) {
    var paths = terms.__paths;
    if (!paths) return;
    for (var path of paths) {
      if (!this.watched[path]) {
        this.watched[path] = [];
        file_watcher.add(path);
      }
      this.watched[path].push(callback);
    }
  }

  is_debug_mode() {
    return util.default(this.config['debug'], true);
  }

  report_exception(log,e) {
    log.error(e.message);
    if (this.is_debug_mode()) throw e;
  }

};

var didi = new Didi();
