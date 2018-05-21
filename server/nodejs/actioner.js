"use strict";
const util = require("./util");

class Actioner {
  constructor(router) {
    this.router = router;
    this.log = router.log;
    this.results = {};
  }


  process(item, types, action) {
    if (!this.has_method(action))
      return Promise.reject("No such action: " + action);
    this.item = item;
    this.types = types;
    return this[action](item)
  }

  has_method(method) {
    return typeof this[method] == "function";
  }

  values() {
    var actions = this.item['values'];
    this.log.debug("VALUES", JSON.stringify(actions));
    return this.reply(actions);
  }

  reply(actions) {
    var results = {};
    var {log} = this;
    for (var action of actions) {
      var method, args;
      if (util.is_object(action))
        [method,args] = util.first_object(action)
      else
        method = action;
      log.debug("ACTION", method, args);
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
    var result = {};
    args.forEach(arg => result[arg] = source[arg]);
    return result
  }
}

module.exports = Actioner;
