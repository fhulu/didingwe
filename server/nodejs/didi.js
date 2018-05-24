"use strict";

var http = require("http");
const yaml = require("yamljs");
const util = require("./util.js");
const {promise} = util;
const fs = require("fs");
const Client = require("./client.js");
const Router = require("./router.js");
var async = require("async");
var sessions = require("client-sessions");
var file_watcher = require("filewatcher")();
const log4js = require("log4js");
const path_util = require("path");
var {log} = util;

class Didi {
  constructor() {
    this.clients = {};
    this.caches = {};
    this.client_seq = 0;
    this.request_seq = 0;
    this.search_paths = [path_util.resolve(process.env.DIDI_PATH) + '/server/dictionary', './server/dictionary'];
    this.config = {};
    this.log = util.log;
    this.seq = 0;
    this.init_file_watcher();
    this.load_config()
      .then(()=>this.init_logging())
      .then(()=>this.init_resources())
      .then(()=>this.init_server())
      .catch(e=>this.report_exception(e))
  }

  init_logging() {
    var layout = { type: 'pattern',  pattern: "%[%d %p %c %X{user} %m%]"};
    log4js.configure({
      appenders: {
        console: { type: "stdout", layout: layout },
        didi: { type: "file", filename: this.config.logging.path, layout: layout}
      },
      categories: {
        default: { appenders: ['didi', 'console'], level: this.config.logging.level }
      }
    });
    log = this.syslog = this.get_logger(()=> { return {seq: this.request_seq, user_name: "*system*", host: this.config.server_ip, client_id: 0};});
  }

  get_logger(functor) {
    var logger = log4js.getLogger('didi');
    logger.addContext('user', ()=>{
      var context = functor();
      return `#${context.seq} ${context.user_name}@${context.host} #${context.client_id}`;
    });
    return logger;
  }

  init_session() {
    this.session = sessions({
      cookieName: 'didi',
      secret: 'Mukoni Software @ 2018',
      duration: 24 * 60 * 60 * 1000,
      activeDuration: 1000 * 60 * 5
    });
  }

  load_terms(name, dirs = null, options = { reload: false} ) {
    var log = this.log;
    var cache = this.cached("terms", name, options);
    if (cache.data) return cache.promise();

    if (!dirs)
      dirs =  this.search_paths;
    var file = name;
    if (!/\.\w+$/.test(name)) file += ".yml";
    var paths = dirs.map(dir => `${dir}/${file}` );

    return Promise.all(paths.map(path=>this.load_yaml(path)))
      .then(results => {
        var terms = this.merge(...results);
        if (util.is_empty(terms))
          throw new Error(`At least one YML file for '${name}' must exist`);
        terms.__paths = paths;
        return cache.resolve(terms, () => this.load_terms(name, dirs, {reload: true}));
      })
      .catch(error => cache.reject(error));
  }

  load_yaml(path) {
    var {log} = this;
    log.trace(`LOADING file ${path} ...`);
    return promise(fs.readFile, path, "utf8")
      .then(data=>(log.trace(`LOADED file ${path}`), yaml.parse(data)))
      .catch(err=> {
        if (err.code === 'ENOENT') return {};
        throw err;
      })
  }

  cached(type, key, options = {reload: false}) {
    var {log} = this;;

    var cache = this.caches[type];
    if (!cache)
      cache = this.caches[type] = {};

    var store = cache[key];
    if (!store || options.reload) {
      log.debug("LOADING", type, key)
      store = cache[key] = { watchers: [] }
      store.loader = new Promise((resolve, reject)=> {
          store.resolver = resolve;
          store.rejector = reject;
        })
        .then(result => {
          log.debug("LOADED", type, key);
          store.data = result;
          store.watchers.forEach(watcher=>watcher.resolve(result));
          delete store.watchers;
          delete store.loader;
          return result;
        })
        .catch(error=> {
          log.error("REJECTING PENDING", type, key, error)
          store.watchers.forEach(watcher=>watcher.reject(error));
          delete store.watchers;
          delete store.loader;
          throw error;
        });
      store.promise = () => Promise.resolve(store.data);
      store.resolve = (result, watcher) => {
        if (util.is_array(result)) result = this.merge({}, ...result);
        if (watcher) this.watch_terms(result, watcher);
        store.resolver(result);
        return result;
      }
      store.reject = error => (store.rejector(error), error);
      return store;
    }

    if (store.data) {
      log.debug("CACHE-HIT", type, key);
      return store;
    }

    log.debug("WAITING FOR", type, key)
    return {
      data: "waiting",
      promise: () => new Promise((resolve, reject) => {
        store.watchers.push({resolve: resolve, reject: reject})
      })
    };
  }

  load_config(options = {reload: false}) {
    var cache = this.cached("SERVER", "CONFIGURATION", options);
    if (cache.loaded) return cache.promise();

    var config;
    var {log} = this;
    return this.load_terms("app-config")
      .then(app_config => (config = util.clone(app_config), this.load_terms(config.site_config, ['.'])))
      .then(site_config  => {
          this.merge(config, site_config);
          util.replace_fields(config, config);
          util.replace_fields(config, process.env);
          this.search_paths.push(config.brand_path + '/dictionary');
          log.info("BRAND PATH", config.brand_path);
          this.config = config;
          cache.resolve(config, () => this.load_config({reload: true}));
        });
  }

  merge(target, ...sources) {
    const enforce_reset = (a, b) =>  b[0]=='_reset'? (b.shift(), b): util.merge_array(a,b);
    var last = util.last(sources);
    var options = { array_merger: enforce_reset };
    if (typeof last == 'function') {
      var options = Object.assign(last(), options);
      sources.splice(options.length-1, 1, ()=>options)
    }
    else {
      sources.push(() => options)
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
        var router = new Router(this, ++this.request_seq);
        router.process(client, req, res);
      });
    }).listen(this.config.server_port, this.config.server_ip);
    log.info("listening on port", this.config.server_port);
  }

  init_file_watcher() {
    this.watched = {};
    file_watcher.on('change', path => {
      ++this.request_seq;
      this.log = this.syslog;
      this.log.info("DETECTED CHANGE", path);
      var watchers = this.watched[path];
      var len = watchers.length;
      Promise.all(watchers.map(watcher => watcher(path)))
        .then(() => this.watched[path].splice(0, len))
    });
  }

  watch_terms(terms, callback) {
    var paths;
    if (util.is_string(terms))
      paths = [terms]
    else if (!util.is_array(terms))
      paths = terms.__paths;
    else
      paths = terms.reduce((acc, cur) => acc.concat(util.is_string(cur)? cur: cur.__paths), []);

    if (!paths)
      return this.log.warn("No watch paths supplied");

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

  report_exception(e) {
    this.log.error(e.message);
    if (this.is_debug_mode()) throw e;
  }

  wait_for_terms(...names) {
    return Promise.all(names.map(name=>this.load_terms(name)))
  }

  init_resources() {
    let symlink = this.config.resource_dir+'/didi';
    let target = path_util.resolve(process.env.DIDI_PATH)+'/web';
    log.debug("CREATE SYMLINK", symlink, "pointing to", target);
    return promise(fs.unlink, symlink)
      .then(()=>promise(fs.symlink, target, symlink, 'dir'))
      .catch(()=>promise(fs.symlink, target, symlink, 'dir'))
      .catch(()=>{});

  }
};

var didi = new Didi();
