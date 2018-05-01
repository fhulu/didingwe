const url = require("url");
const qs = require("querystring")
const util = require("./util.js");
const traverse = require("traverse");

const post_items = ['access', 'audit', 'call', 'clear_session', 'clear_values', 'db_name', 'error', 'let', 'keep_values','post',
  'q', 'valid', 'validate', 'write_session'];

const query_items = ['call', 'let', 'keep_values','read_session', 'read_config', 'read_values', 'ref_list', 'sql', 'sql_values', 'refresh'];

const non_expandables = ['post', 'audit','action', 'attr', 'css', 'html', 'script', 'sql', 'style', 'template', 'valid'];

const non_mergeable = ['action', 'attr', 'audit', 'call', 'clear_session',
  'clear_values', 'error', 'for_each', 'load_lineage', 'keep_values', 'read_session', 'refresh', 'show_dialog',
  'sql_insert', 'sql_update', 'style', 'trigger', 'valid', 'validate', 'write_session'];


class Client {
  constructor(server, id) {
    this.server = server;
    this.id = id;
    this.seq = server.next_seq;
    this.posted = {};
    this.variables = {};
    this.types = {};
  }

  process(request, response) {
    this.response = response;
    console.log(`Processing client ${this.seq}`);
    this.parse_request(request)
      .then(() => this.server.load_page(this.page))
      .then(types => this.respond(types))
      .catch(err=> this.report_error(err) )
  }

  output() {
    console.log("Processed");
    this.response.end();
  }

  report_error(err) {
    console.log("ERROR", err);
    this.response.end();
  }

  parse_request(req) {
    var parsed = url.parse(req.url, true);
    var path = parsed.pathname.split('/');
    path.shift();

    // if no path given, assume index
    if (path[0] == '') path[0] = 'index';
    this.page = path[0];

    // if no branch given, assume page = branch
    if (path.length > 1) path.shift();

    this.path = path;
    var get = parsed.query;
    console.log("REQUEST PATH", this.path, "GET", get);

    if (req.method !== 'POST') return Promise.resolve(this.request = get);
    return this.read_post(req)
      .then(post => this.request = Object.assign(post, get));
  }

  read_post(req) {
    return new Promise((resolve, reject) => {
      var body = '';
      var post;
      req.on('data', data=>{
        body += data;
        if (body.length >= 1e6) {
          req.connection.destroy();
          return reject("body too long");
        }
      })
      .on('end', qs.parse(data))
    });
  }

  respond(types) {
    this.types = types;
    var item = this.follow_path(this.path, types);
    var action = this.request.action;
    if (!action) action = 'read';
    this[action](item);
  }

  read(item) {
    this.remove_server_items(item);
    var types = {};
    this.expand_types(item, types);
    this.remove_server_items(types);
    var response = { fields: item, types: types }
    this.response.end(JSON.stringify(response));
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
    var item = types;
    var parent = item;
    for (var branch of this.path) {
      item = item[branch];
      if (!item)
        throw Error("Invalid path " + path.join('/'));
    }
    return item;
  }

  expand_types(item, types) {
    util.walk(item, (val, key, node)=>{
      if (val in types) return;
      if (non_expandables.includes(key)) return;

      if (key == 'type') {
        var expanded = types[val] = this.types[val];
        this.expand_types(expanded, types);
      }
      else if (Array.isArray(node) && typeof val == 'string') {
        var expanded = types[val] = this.types[val];
        if (expanded)
          this.expand_types(expanded, types);
      }
    })
  }

  merge_type(obj, type, must_exist) {
    var expanded = this.types[type];
    if (!expanded) {
      if (must_exist) throw new Error(`Unknown type ${type}`, type);
      return obj;
    }
    type = expanded.type;
    expanded = this.merge(expanded, obj);
    if (!type) return expanded;
    return this.merge_type(expanded, type, types);
  }


}


module.exports = Client;
