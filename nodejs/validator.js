"use strict";
const util = require("./util");

class Validator {
  constructor(router, root) {
    this.router = router;
    this.root = root;
    var request = this.remove_prefix(router.request.query);
    this.values = util.merge({}, router.client.variables, request, router.answer);
    this.remove_prefix();
  }

  validate() {

  }

  remove_prefix(query) {
    var prefix = this.root.post_prefix;
    if (!prefix) return query;

    var offset = prefix.length;
    var result = util.clone(query);
    for (var key in query) {
      if (key.indexOf(prefix) != 0) continue;
      result[key.substr(offset)] = query[key];
      delete result[key];
    }
    return result;
  }
}
