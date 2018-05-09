"use strict";

var http = require("http");
const yaml = require("yamljs");
const util = require("./util.js");
const fs = require("fs");
const after = require("./after.js");
const Client = require("./client.js");
var async = require("async");
var sessions = require("client-sessions");
const debug = require("debug")("DIDI");
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

const non_expandables = ['post', 'audit','action', 'access', 'attr', 'css', 'html', 'script', 'sql', 'style', 'template', 'valid'];

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
    this.config = {};
    this.read_config()
      .then(()=>this.load_fields())
      .then(()=>this.load_validators())
      .then(()=>this.init_server())
      .catch(e=>this.report_error(e))
  }

  load_terms(terms, name, paths) {
    var loaded = this.files[name];
    if (loaded) {
      debug("CACHE-HIT", name);
      return Promise.resolve(loaded);
    }

    paths = paths || this.search_paths;
    var file = name;
    if (!/\.\w+$/.test(name)) file += ".yml";
    return this.files[name] = after(async.reduce, paths, terms, (terms, path, callback)=>{
      path = `${path}/${file}`;
      if (!fs.existsSync(path))
        return callback(null, terms);
      debug(`LOADING ${path} ...`);
      fs.readFile(path, "utf8", (err,data)=>{
        try {
          var term = yaml.parse(data);
          this.merge(terms, term);
          debug(`LOADED ${path}`)
          callback(null, terms);
        }
        catch(err) {
          this.report_error(err)
        }
      });
    })
    .then(terms => {
      if (!terms)
        throw new Error(`File(s) for '${name}' must exist`);
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
    if (!req.headers.cookie)
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
    http.createServer((req, res) => {
      session(req, res, () => {
        if (req.didi.seenyou) {
          res.setHeader('X-Seen-You', 'true');
        } else {
          req.didi.seenyou = true;
          res.setHeader('X-Seen-You', 'false');
        }
        var client = this.get_client(req);
        this.serve_mime(client, req, res)
          || this.serve_spa(client, req, res)
          || client.process(req, res);
      })
    }).listen(this.config.server_port);

    debug("listening on port",this.config.server_port);
  }


  load_page(page) {
    var existing = this.pages[page];
    if (existing)
      return Promise.resolve(existing);

    var already_included = [];
    return this.pages[page] = this.load_terms({}, page)
      .then(terms => this.include_all(terms, already_included))
      .then(included => this.update_page_terms(page, included))
  }

  include_all(terms, already) {
    var includes = terms.include;
    if (!includes) return Promise.resolve(terms);
    var promises = includes.map( page => this.include_one(page, already));
    return Promise.all(promises)
      .then(results => this.merge(terms, ...results))
  }

  include_one(page, already) {
    if (already.includes(page))
      return Promise.resolve({});
    already.push(page);
    return this.load_terms({}, page)
      .then(terms => this.include_all(terms, already))
  }


  update_page_terms(page, terms) {
    var types = {};
    for (var key in terms) {
      if (!terms.hasOwnProperty(key)) continue;
      types[key] = this.merge({}, this.types[key], terms[key]);
    }
    return this.pages[page] = this.merge({}, this.types, types);
  }

  read(client, path, types) {
    var roles = client.get_roles().join('.')
    var cache_key = `${path}:${roles}`;
    var loaded = this.reads[cache_key];

    if (loaded)
      return loaded;

    var item = this.follow_path(path, types);

    util.replace_fields(item, this.config);
    this.remove_server_items(item, ['access']);
    client.remove_unauthorized(item);
    this.remove_keys(item, ['access']);

    var expanded = {};
    var removed = this.expand_types(client, item, types, expanded);
    removed.push('acccess');
    this.remove_keys(item, removed);
    if (!expanded.control) expanded.control = types.control
    if (!expanded.template) expanded.template = types.template;

    util.replace_fields(expanded, this.config);
    this.remove_keys(expanded, removed);

    return this.reads[cache_key] = { path: path, fields: item, types: expanded }
  }

  remove_keys(root, keys) {
    util.walk(root, (val, key, node) => {
      if (util.is_numeric(val)) return;
      if (util.is_array(node)) {
        if (util.is_object(val)) val = util.first_key(val);
        if (keys.includes(val)) node.splice(key, 1);
      }
      else if (keys.includes(key)) {
        delete node[key];
      }
    })
  }

  remove_server_items(root, exclusions=[]) {
    util.walk(root, (val, key, node) =>{
      if (!exclusions.includes(key) && this.is_server_item(key))
        delete node[key];
    })
  }

  is_server_item(key) {
    return post_items.includes(key)
      || query_items.includes(key)
  }

  follow_path(path, types) {
    path = path.split('/').slice(1);
    var item = types;
    var parent = item;
    for (var branch of path) {
      item = item[branch];
      if (!item)
        throw Error("Invalid path " + path.join('/'));
    }
    return item;
  }

  expand_types(client, item, types, expanded) {

    var removed = [];

    util.walk(item, (val, key, node)=>{
      if (util.is_numeric(val)) return;
      var is_array = util.is_array(node);
      if (is_array && util.is_string(val) || key == 'type') {
        key = val;
      }
      node = types[key];
      if (!node || non_expandables.includes(key) || key in expanded || key.includes("."))
        return;

      removed.push(...client.remove_unauthorized(node));
      this.remove_server_items(node);
      if (removed.includes[key]) return is_array;
      if (util.is_empty(node)) {
        removed.push(key);
        return is_array;
      }
      expanded[key] = node;
      removed.push(...this.expand_types(client, node, types, expanded));
    });
    return removed;
  }


  serve_spa(client, req, res) {
    if (req.method != 'GET') return false;

    var parsed = url.parse(req.url, true);
    var query = Object.assign({}, parsed.query);
    if (query.action) return false;

    client.log("SERVE SPA", parsed.pathname, JSON.stringify(query));
    this.load_spa(client, query, res)
      .then(data=> res.end(data))
    return true;
  }

  load_spa(client, query, res) {
    var config = util.clone(client.get_config());
    var spa = config['template'];
    delete config.template;
    return after(fs.readFile, spa, "utf8")
      .then(data=>{
        data = this.replace_links(data, 'script', "<script src='$script'></script>\n");
        data = this.replace_links(data, 'css', "<link href='$script' media='screen' rel='stylesheet' type='text/css' />\n");
        data = data.replace("$request_method", this.config['request_method']);

        util.replace_fields(config, query);
        util.replace_fields(config, config);
        var options = { path:  config.page, request: config };
        return data = data.replace("$options", JSON.stringify(options));
    })
    .catch(err => {
      client.report_error(res, err);
      this.send404(res);
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

  serve_mime(client, req, res) {
    if (req.method != 'GET') return false;
    let path = path_util.resolve(this.config['resource_dir'] + '/' + req.url);
    let ext = path_util.extname(path);
    if (!ext) return false;

    let content_type = mime.contentType(path_util.extname(path));

    if(!content_type)
      return this.send404(res);

    fs.exists(path, (exists) => {
      client.log("SERVING", path);
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

  is_debug_mode() {
    return util.default(this.config['debug'], true);
  }

  report_error(e) {
    debug("ERROR", e.message);
    if (this.is_debug_mode()) throw e;
  }

};

var didi = new Didi();
