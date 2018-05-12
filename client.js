const url = require("url");
const qs = require("querystring")
const util = require("./util.js");
var debug = require("debug")("DIDI");

const post_items = ['access', 'audit', 'call', 'clear_session', 'clear_values', 'db_name', 'error', 'let', 'keep_values','post',
  'q', 'valid', 'validate', 'write_session'];

const query_items = ['call', 'let', 'keep_values','read_session', 'read_config', 'read_values', 'ref_list', 'sql', 'sql_values', 'refresh'];

const non_expandables = ['action', 'access', 'attr', 'audit', 'class', 'css', 'html', 'post', 'script', 'sql', 'style', 'template', 'valid', 'values'];

const non_mergeable = ['action', 'attr', 'audit', 'call', 'clear_session',
  'clear_values', 'error', 'for_each', 'load_lineage', 'keep_values', 'read_session', 'refresh', 'show_dialog',
  'sql_insert', 'sql_update', 'style', 'trigger', 'valid', 'validate', 'write_session'];


class Client {
  constructor(server, id) {
    this.server = server;
    this.id = id;
    this.seq = 0;
    this.variables = {};
    this.auth_token = null;
    this.config = server.config;
    this.roles = ['public'];
  }

  process(request, response) {
    ++this.seq;
    this.parse_query(request)
      .then(query => this.load_page(request))
      .then(types => this.respond(request, response, types))
      .catch(err=> this.report_error(response, err) )
  }

  log(type, message) {
    debug(`CLIENT ${this.id} ${this.seq} ${type} ${message}`);
  }


  report_error(response, err) {
    if (this.server.is_debug_mode()) throw err;
    this.log("ERROR", err);
    response.end();
  }

  parse_query(req) {
    var parsed = url.parse(req.url, true);
    var get = Object.assign({}, parsed.query);

    if (req.method !== 'POST') return Promise.resolve(req.query = get);
    return this.read_post(req)
      .then(post => req.query = Object.assign(post, get));
  }

  load_page(request) {

    util.replace_fields(request.query, request.query);
    this.log("REQUEST", JSON.stringify(request.query));

    var path = request.query.path.split('/');
    if (path[0] == '') path.shift();
    var page = path[0];

    // if no branch given, assume page = branch
    if (path.length ==1) path.unshift(path[0]);
    request.query.path = path.join('/');

    return this.server.load_page(page);
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

  respond(request, response, types) {
    var item = this.follow_path(request.query.path, types);
    var result = this[request.query.action](request, item, types);
    this.output(response, result);
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


  output(response, result) {
    result = JSON.stringify(result);
    this.log("RESPONSE", result.substring(0,127));
    response.setHeader('Content-Type', 'application/json')
    response.end(result);
  }

  is_logged_in() {
    return this.auth_token != null;
  }

  get_spa_config() {
    var spa = this.config.spa;
    var conf = util.clone(spa.default);
    for (const role of this.roles) {
      util.merge(conf, spa[role]);
    }
    return conf;
  }

  get_roles() {
    return this.roles;
  }

  is_authorized(rights) {
    if (rights === undefined) return true;
    if (!util.is_array(rights)) rights = [rights]
    return util.intersects(rights, this.roles);
  }

  remove_unauthorized(root) {
    if (!this.is_authorized(root.access)) {
      util.empty(root);
      return [];
    }
    var removed = [];
    util.walk(root, (val, key, node) => {
      if (util.is_array(node)) {
        if (!util.is_object(val) || util.is_empty(val)) return;
        var index = key;
        key = util.first_key(val);
        val = util.first_value(val);
        // [key, val] = util.first_object(val);
        if (this.is_authorized(val.access)) return;
        node.splice(index, 1);
        removed.push(key);
      }
      else if (util.is_object(val) && !this.is_authorized(val.access)) {
        delete node[key];
        removed.push(key);
      }
    });
    return removed;
  }

  read(request, item, types) {
    var roles = this.get_roles().join('.')
    request.query
    var cache_key = `${roles}@${request.url}`;
    var loaded = this.server.reads[cache_key];

    if (loaded)
      return loaded;

    util.replace_fields(item, this.config);
    this.remove_server_items(item, ['access']);
    this.remove_unauthorized(item);
    util.remove_keys(item, ['access']);

    var expanded = {};
    var page = util.last(request.query.path.split('/'));
    expanded[page] = item;
    var removed = this.expand_types(item, types, expanded);
    removed.push('acccess');
    util.remove_keys(item, removed);
    if (!expanded.control) expanded.control = types.control
    if (!expanded.template) expanded.template = types.template;

    util.replace_fields(expanded, this.server.config);
    removed.push(page);
    util.remove_keys(expanded, removed);

    return this.server.reads[cache_key] = { path: request.query.path, fields: item, types: expanded }
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

  expand_types(item, types, expanded) {
    var removed = [];
    util.walk(item, (val, key, node)=>{
      if (key == 'type')
        key = val;
      else if (util.is_array(node)) {
        if (!util.is_string(val)) return;
        key = val;
      }
      else if (util.is_atomic(val))
        return;

      if (non_expandables.includes(key) || post_items.includes(key) || key in expanded)
        return false;

      var type = types[key];
      if (!type) return;
      removed.push(...this.remove_unauthorized(type));
      this.remove_server_items(type);
      if (removed.includes[key]) return false;
      if (util.is_empty(type)) {
        removed.push(key);
        return false;
      }
      expanded[key] = type;
      removed.push(...this.expand_types(type, types, expanded));
    });
    return removed;
  }

}


module.exports = Client;
