"use strict";

var http = require("http");
const yaml = require("yamljs");
const util = require("./util.js");
const fs = require("fs");
const after = require("./after.js");
const Client = require("./client.js");
var async = require("async");
var sessions = require("client-sessions");
const debug = require("debug")("didi");
const path_util = require("path");
const mime = require("mime-types");
const url = require("url");

var session = sessions({
  cookieName: 'didi',
  secret: 'blargadeeblargblarg',
  duration: 24 * 60 * 60 * 1000,
  activeDuration: 1000 * 60 * 5
});


const post_items = ['access', 'audit', 'call', 'clear_session', 'clear_values', 'db_name', 'error', 'let', 'keep_values','post',
  'q', 'valid', 'validate', 'write_session'];

const query_items = ['call', 'let', 'keep_values','read_session', 'read_config', 'read_values', 'ref_list', 'sql', 'sql_values', 'refresh'];

const non_expandables = ['post', 'audit','action', 'attr', 'css', 'html', 'script', 'sql', 'style', 'template', 'valid'];

const non_mergeable = ['action', 'attr', 'audit', 'call', 'clear_session',
  'clear_values', 'error', 'for_each', 'load_lineage', 'keep_values', 'read_session', 'refresh', 'show_dialog',
  'sql_insert', 'sql_update', 'style', 'trigger', 'valid', 'validate', 'write_session'];


class Didi {
  constructor() {
    this.files = {};
    this.clients = {};
    this.client_seq = 0;
    this.request_seq = 0;
    this.types = {};
    this.pages = {};
    this.reads = {};
    this.search_paths = ['./didi', '.'];
    this.read_config()
      .then(()=>this.load_fields())
      .then(()=>this.load_validators())
      .then(()=>this.init_server())
      .catch(error=>debug(error))
  }

  load_terms(terms, name, paths) {
    var loaded = this.files[name];
    if (typeof loaded == 'function') {
      debug("stll loading terms for", name);
      return loaded;
    }

    if (loaded) {
      debug("read terms from cache", name);
      return Promise.resolve(loaded);
    }

    paths = paths || this.search_paths;
    var file = name;
    if (!/\.\w+$/.test(name)) file += ".yml";
    return this.files[name] = after(async.reduce, paths, terms, (terms, path, callback)=>{
      path = `${path}/${file}`;
      if (!fs.existsSync(path))
        return callback(null, terms);
      debug(`loading ${path} ...`);
      fs.readFile(path, "utf8", (err,data)=>{
        try {
          var term = yaml.parse(data);
          terms = this.merge(terms, term);
          callback(null, terms);
        }
        catch(e) {
          callback(`Parsing error reading ${path} at line ${e.parsedLine}: ${e.message}`, terms);
        }
      });
    })
    .then(terms => {
      if (!terms)
        throw new Error(`File(s) for '${name}' must exist`);
      debug(`loaded ${name}`)
      return this.files[name] = terms;
    })
  }

  read_config() {
    return this.load_terms({}, "app-config")
      .then(config => this.load_terms(config, config.site_config, '[.]'))
      .then(config => {
        util.replace_fields(config, config);
        this.search_paths.push(config.brand_path);
        debug("BRAND PATH", config.brand_path);
       return this.config = config;
     });
  }

  load_fields() {
    debug("SEARCH PATHS", this.search_paths);
    return this.load_terms({}, "controls")
      .then(controls => this.load_terms(controls, "fields"))
      .then(fields => {
        util.replace_fields(fields, this.config);
        this.types = this.fields = fields;
      })
  }

  load_validators() {
    return this.load_terms({}, "validators")
      .then(validators => this.validators = validators)

  }

  merge(x,y) {
    const enforce_reset = (a, b) =>  b[0]=='_reset'? (b.shift(), b): util.merge_array(a,b);
    return util.merge(x, y, { array_merger: enforce_reset });
  }


  get_cookie(req, cookie) {
    if (!req.headers.cookie)
      return null;

    var cookies = req.headers.cookie.split(";");
    for (var c of cookies) {
      var [name,value] = c.split("=");
      if (name == cookie) return value;
    }
    return null;
  }

  process_request(req, res) {
    var id = this.get_cookie(req, "didi");
    var client = this.clients[id];
    if (!client)
      client = new Client(this, id);
    this.client = client;
    this.request_seq++;
    client.process(req, res, this.request_seq);
    if (!id) return;
    this.client_seq++;
    this.clients[id] = client;
  }

  init_server() {
    http.createServer((req, res) => {
      session(req, res, () => {
        if (req.didi.seenyou) {
          res.setHeader('X-Seen-You', 'true');
        } else {
          req.didi.seenyou = true;
          res.setHeader('X-Seen-You', 'false');
        }
        this.serve_mime(req, res)
          || this.serve_spa(req, res)
          || this.process_request(req, res);
      })
    }).listen(this.config.server_port);
    debug("listening on port",this.config.server_port);
  }


  load_page(page) {
    var existing = this.pages[page];
    if (typeof existing == 'function') {
      debug("still loading", page);
      return existing;
    }

    if (existing) {
      debug("read from cache", page);
      return Promise.resolve(existing);
    }

    return this.pages[page] = this.load_terms(null, page)
      .then(terms => this.include_all(terms))
      .then(included => this.update_page_terms(page, included))
  }

  include_all(terms) {
    var includes = terms.include;
    if (!includes) return Promise.resolve(terms);
    var promises = includes.map( page => this.include_one(page));
    return Promise.all(promises)
      .then(results => results.reduce((sum,result) => {return this.merge(result, sum)}, terms))
  }

  include_one(page) {
    return this.load_terms(null, page)
      .then(terms => this.include_all(terms))
  }


  update_page_terms(page, terms) {
    var types = {};
    for (var key in terms) {
      if (!terms.hasOwnProperty(key)) continue;
      types[key] = this.merge(this.types[key], terms[key]);
    }
    return this.pages[page] = this.merge(this.types, types);
  }

  read(path, types) {
    var loaded = this.reads[path];
    if (loaded)
      return loaded;

    var item = this.follow_path(path, types);
    this.remove_server_items(item);
    var expanded_types = {};
    this.expand_types(item, types, expanded_types);
    this.remove_server_items(types);
    expanded_types['control'] = types['control'];
    expanded_types['template'] = types['template'];
    util.replace_fields(types, this.config);
    util.replace_fields(item, this.config);
    return this.reads[path] = { path: path, fields: item, types: expanded_types }
  }

  remove_server_items(root) {
    var result = {}
    util.walk(root, (val, key, node) =>{
      if ( this.is_server_item(key))
        delete node[key];
    })
  }

  is_server_item(key) {
    return post_items.includes(key)
      || query_items.includes(key)
  }

  follow_path(path, types) {
    debug("FOLLOWING path", path)
    path = path.split('/').slice(1);
    var item = types;
    var parent = item;
    for (var branch of path) {
      item = item[branch];
      if (!item)
        throw Error("Invalid path " + path.join('/'));
    }
    debug("followed", path);
    return item;
  }

  expand_types(item, source_types, expanded_types) {
    util.walk(item, (val, key, node)=>{
      if (val in expanded_types) return;
      if (non_expandables.includes(key)) return;

      if (key == 'type') {
        var expanded = expanded_types[val] = source_types[val];
        this.expand_types(expanded, source_types, expanded_types);
      }
      else if (Array.isArray(node) && typeof val == 'string') {
        var expanded = expanded_types[val] = source_types[val];
        if (expanded)
          this.expand_types(expanded, source_types, expanded_types);
      }
    })
  }


  serve_spa(req, res) {
    if (req.method != 'GET') return false;

    var parsed = url.parse(req.url, true);
    var query = parsed.query;
    if (query.action) return false;

    this.load_spa(query)
      .then(data=> {
        // res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(data);
      })
    return true;
  }

  load_spa(query) {
    var spa = this.config['spa_template'];
    return after(fs.readFile, spa, "utf8")
      .then(data=>{
        data = this.replace_links(data, 'script', "<script src='$script'></script>\n");
        data = this.replace_links(data, 'css', "<link href='$script' media='screen' rel='stylesheet' type='text/css' />\n");
        data = data.replace("$request_method", this.config['request_method']);
        var config = this.config['landing'];
        util.replace_fields(config, query);
        util.replace_fields(config, config);
        var options = { path:  config.page, request: config};
        return data = data.replace("$options", JSON.stringify(options));
    })
    .catch(err =>{
      debug("ERROR", err);
      this.send404();
    });
  }

  replace_links(html, type, template) {
    var urls = this.config[type];
    var links = "";
    if (!urls)
      return html;

    for (var url of urls) {
      links += template.replace('$script', url);
    }
    return html.replace(`$${type}_links`, links);
  }

  serve_mime(req, res) {
    if (req.method != 'GET') return false;
    let path = path_util.resolve(this.config['resource_dir'] + '/' + req.url);
    let ext = path_util.extname(path);
    if (!ext) return false;

    let content_type = mime.contentType(path_util.extname(path));

    if(!content_type)
      return this.send404(res);

    fs.exists(path, (exists) => {
      debug("SERVING", path);
      if(!exists) {
        this.send404(res);
        return;
      }

      res.writeHead(200, {'Content-Type': content_type});
      fs.createReadStream(path).pipe(res);
    });
    return true;
  }

  send404(res) {
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.end('Error 404: Resource not found.');
  }


};

var didi = new Didi();
