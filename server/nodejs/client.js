const util = require("./util.js");
const log4js = require('@log4js-node/log4js-api');
const log = log4js.getLogger('didi');


class Client {
  constructor(server, id) {
    this.server = server;
    this.id = id;
    this.seq = 0;
    this.variables = {};
    this.auth_token = null;
    this.config = server.config;
    this.roles = ['public'];
    this.user_name = "*anon*";
  }

  is_logged_in() {
    return this.auth_token != null;
  }

  get_user_name() {
    return this.user_name;
  }

  get_session_info() {
    return this.get_user_name() + "#" + this.id;
  }

  get_spa_config() {
    var spa = this.config.spa;
    var conf = util.clone(spa.default);
    for (const role of this.roles) {
      util.merge(conf, spa[role]);
    }
    return conf;
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
}

module.exports = Client;
