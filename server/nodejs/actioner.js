"use strict";
const util = require("./util");

const non_mergeable = ['action', 'attr', 'audit', 'call', 'clear_session',
  'clear_values', 'error', 'for_each', 'load_lineage', 'keep_values', 'read_session', 'refresh', 'show_dialog',
  'sql_insert', 'sql_update', 'style', 'trigger', 'valid', 'validate', 'write_session'];

const non_expandables = ['action', 'access', 'attr', 'audit', 'class', 'css', 'derive', 'html', 'post', 'script', 'sql', 'style', 'template', 'valid', 'values'];


class Actioner {
  constructor(router) {
    this.router = router;
    this.terms = router.terms;
    this.log = router.log;
    this.answer = {};
  }


  process(action) {
    if (!this.has_method(action))
      return Promise.reject("No such action: " + action);
    var {router,log} = this;
    this.expanded = [].concat(non_mergeable, non_expandables);
    router.page = this.expand_node(router.page);
    this.item = router.follow_path(router.path.slice(1), router.page);
    return this[action]()
  }

  has_method(method) {
    return typeof this[method] == "function";
  }

  values() {
    var actions = this.item.values;
    return this.reply(actions, "VALUES");
  }

  data() {
    return this.reply(this.item, "DATA");
  }

  action() {
    var {item} = this;
    var pre_validation = item.pre_validation;
    var promise = pre_validation? this.reply(pre_validation): Promise.resolve();
    return promise.then(()=>this.validate())
      .then(()=>{
        if (item.audit_first)
          this.audit()
        return this.reply(item.post, "ACTION");
      })
  }

  audit() {

  }

  validate() {

  }

  reply(actions, action) {
    var {log} = this;
    log.debug(action, "ACTIONS", JSON.stringify(actions));
    var results = {};
    for (var action of actions) {
      var method, args;
      if (util.is_object(action))
        [method,args] = util.first_object(action)
      else
        method = action;
      log.debug("ACTION", method, args);
      if (util.is_reserved_word(method)) method = method+'_';
      if (!this.has_method(method)) {
        log.error("No such method", method);
        continue;
      }
      util.merge(results,this[method](...args));
    }
    return Promise.resolve(results);
  }

  read_header(...args) {
    return this.read_values(this.router.request.headers, ...args);
  }

  read_values(source, ...args) {
    if (!args.length) return util.clone(source);
    var result = {};
    args.forEach(arg => result[arg] = source[arg]);
    return result;
  }


  read_session(...args) {
    return this.read_values(this.router.client.variables, ...args);
  }

  expand_node(node, parent = null) {
    if (util.is_object(node))
      return this.expand_object(node, parent);
    if (util.is_array(node))
      return this.expand_array(node, parent);
    this.log.warn("???", JSON.stringify(node));
    return node;
  }

  expand_object(node, parent = null) {
    this.derive_parent(node, parent);
    var type = node.type;
    if (type) {
      delete node.type;
      var type = this.terms[type];
      if (node !== type)
      node = util.merge({}, type, node);
    }

    for (var key in node) {
      var val = node[key];
      if (!node.hasOwnProperty(key)
        || this.expanded.includes(key)
        || util.is_primitive(val)) continue;
      this.expanded.push(key);
      node[key] = this.expand_node(node[key], node);
    }
    return node;
  }

  derive_parent(node, parent) {
    if (!node.derive || !parent) return;
    for (var key of node.derive) {
      node[key] = util.merge({}, parent[key], node[key])
    }
  }

  expand_array(node, parent) {
    var default_type = {};
    var default_node, key;
    var {terms,log} = this;
    for (var index in node) {
      if (!util.is_numeric(index)) continue;
      var val = node[index];
      if (util.is_object(val))
        [key, val] = util.first_object(val);
      else if (util.is_string(val)) {
        key = val, val = {};
      }
      if (non_mergeable.includes(key)) continue;
      if (key[0] == '$') {
        key = key.substr(1);
        val = util.merge({}, val, parent[key]);
      }
      if (key == "type")
        default_type = terms[key];
      if (key == "default")
        default_node = val;

      this.derive_parent(val, parent);
      if (!val.type) val = util.merge({}, default_type, val);
      if (default_node) val = util.merge({}, default_node, val);
      val = util.merge({}, terms[key], val);
      var expanded = {};
      expanded[key] = this.expand_object(val);
      node[index] = expanded;
    }
    return node;
  }

}

module.exports = Actioner;
