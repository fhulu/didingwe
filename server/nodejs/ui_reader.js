"use strict"

const util = require("./util");

const post_items = ['access', 'audit', 'call', 'clear_session', 'clear_values', 'db_name', 'error', 'let', 'keep_values','post',
  'q', 'read', 'valid', 'validate', 'write_session'];

const query_items = ['call', 'let', 'keep_values', 'read_header', 'read_session', 'read_config', 'read_values', 'ref_list', 'sql', 'sql_values', 'refresh'];

const non_expandables = ['action', 'access', 'attr', 'audit', 'class', 'css', 'html', 'post', 'script', 'sql', 'style', 'template', 'valid', 'values'];

class UIReader {
  constructor(router) {
    this.router = router;
  }

  process(options = {reload: false} ) {
    var router = this.router;
    var {request, server, terms, log} = router;
    var cache = server.cached("ui", router.get_url_key(), options);
    if (cache.data) return cache.promise();

    return router.load_page(router.page_id, options)
      .then(()=> {
        var item = router.follow_path();
        var result = this.minimize(item);
        server.watch_terms([this.router.terms, server.config],() => this.process({reload: true}));
        return cache.resolve(result);
      });
  }

  minimize(item) {
    item = util.clone(item);

    var {request, client, server, terms} = this.router;
    util.replace_fields(item, server.config);
    this.remove_server_items(item, ['access']);
    client.remove_unauthorized(item);
    util.remove_keys(item, ['access']);

    var expanded = {};
    var page = util.last(request.query.path.split('/'));
    expanded[page] = item;
    var removed = this.expand_types(item, terms, expanded);
    removed.push('acccess');
    util.remove_keys(item, removed);
    if (!expanded.control) expanded.control = terms.control
    if (!expanded.template) expanded.template = terms.template;

    util.replace_fields(expanded, server.config);
    removed.push(page);
    util.remove_keys(expanded, removed);
    return { path: request.query.path, fields: item, types: expanded};
}

  remove_server_items(root, exclusions=[]) {
    util.walk(root, (val, key, node) =>{
      if (!exclusions.includes(key) && this.is_server_item(key))
        delete node[key];
      if (query_items.includes(key))
        node.query = " ";
    })
  }

  is_server_item(key) {
    return post_items.includes(key)
      || query_items.includes(key)
  }

  expand_types(item, types, expanded) {
    var removed = [];
    var {client} = this.router;
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
      removed.push(...client.remove_unauthorized(type));
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
