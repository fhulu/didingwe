"use strict"

const util = require("./util");

const post_items = ['access', 'audit', 'call', 'clear_session', 'clear_values', 'db_name', 'error', 'let', 'keep_values','post',
  'q', 'read', 'valid', 'validate', 'write_session'];

const query_items = ['call', 'let', 'keep_values','read_session', 'read_config', 'read_values', 'ref_list', 'sql', 'sql_values', 'refresh'];

const non_expandables = ['action', 'access', 'attr', 'audit', 'class', 'css', 'html', 'post', 'script', 'sql', 'style', 'template', 'valid', 'values'];

class UIReader {
  constructor(server, client, request) {
    this.server = server;
    this.client = client;
    this.request = request;
  }

  process(item, types) {
    var req = this.request;
    var roles = this.client.get_roles().join('.')
    var cache_key = `${roles}@${req.url}`;
    var loaded = this.server.reads[cache_key];

    if (loaded)
      return Promise.resolve(loaded);

    util.replace_fields(item, this.server.config);
    this.remove_server_items(item, ['access']);
    this.client.remove_unauthorized(item);
    util.remove_keys(item, ['access']);

    var expanded = {};
    var page = util.last(req.query.path.split('/'));
    expanded[page] = item;
    var removed = this.expand_types(item, types, expanded);
    removed.push('acccess');
    util.remove_keys(item, removed);
    if (!expanded.control) expanded.control = types.control
    if (!expanded.template) expanded.template = types.template;

    util.replace_fields(expanded, this.server.config);
    removed.push(page);
    util.remove_keys(expanded, removed);

    return Promise.resolve(this.server.reads[cache_key] = { path: req.query.path, fields: item, types: expanded })
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
      removed.push(...this.client.remove_unauthorized(type));
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

module.exports = UIReader;
