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
    this.next_seq = 0;
    this.types = {};
    this.pages = {};
    this.reads = {};
    this.read_config()
      .then(()=>this.load_fields())
      .then(()=>this.load_validators())
      .then(()=>this.init_server())
      .catch(error=>console.log(error))
  }

  load_terms(terms, name, paths) {
    var loaded = this.files[name];
    if (loaded)
      return Promise.resolve(loaded);
    paths = paths || ['./didi', '.'];
    var file = name;
    if (!/\.\w+$/.test(name)) file += ".yml";
    var me = this;
    return after(async.reduce, paths, terms, (terms, path, callback)=>{
      path = `${path}/${file}`;
      if (!fs.existsSync(path))
        return callback(null, terms);
      console.log(`loading ${path} ...`);
      fs.readFile(path, "utf8", (err,data)=>{
        try {
          var term = yaml.parse(data);
          terms = me.merge(terms, term);
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
      console.log(`loaded ${name}`)
      return this.files[name] = terms;
    })
  }

  read_config() {
    return this.load_terms({}, "app-config")
      .then(config => this.load_terms(config, config.site_config, '[.]'))
      .then(config => this.config = config)
  }

  load_fields() {
    return this.load_terms({}, "controls")
      .then(controls => this.load_terms(controls, "fields"))
      .then(fields => this.types = this.fields = fields)
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
    client.process(req, res);
    if (!id) return;
    this.next_seq++;
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
        if (!this.serve_mime(req, res))
          this.process_request(req, res);
      })
    }).listen(this.config.server_port);
    console.log("listening on port",this.config.server_port);
  }

  load_page(page, included=false) {
    var existing = this.pages[page];
    if (existing && !included) return Promise.resolve(existing);

    return this.load_terms(null, page)
      .then(terms => this.include(terms))
      .then(terms => included? terms: this.update_page_terms(page, terms))
  }

  include(terms) {
    var includes = terms.include;
    if (!includes) return Promise.resolve(terms);
    var promises = includes.map( page => this.load_page(page, true));
    return Promise.all(promises)
      .then(results => results.reduce((sum,result) => sum = this.merge(result, sum), terms))
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
    var item = this.follow_path(path, types);
    var loaded = this.reads[path];
    if (loaded)
      return loaded;

    this.remove_server_items(item);
    var expanded_types = {};
    this.expand_types(item, types, expanded_types);
    this.remove_server_items(types);
    return this.reads[path] = { fields: item, types: expanded_types }
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

  load_spa() {
    var spa = this.config['spa_template'];
    var loaded = this.reads[spa];
    if (loaded)
      return Promise.resolve(loaded);

    return after(fs.readFile(spa))
      .then(data=>{
        data = this.replace_links(data, 'script', "<script src='$script'></script>\n");
        data = this.replace_links(data, 'css', "<link href='$script' media='screen' rel='stylesheet' type='text/css' />\n");
        return this.reads[spa] = data;
      })
  }

  replace_links(html, type, template) {
    var urls = this.config[type];
    var links = "";
    if (!urls)
      return;

    for (url of urls) {
      links += template.replace('$script', url);
    }
    html.replace(`$${type}_links`, links);
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
