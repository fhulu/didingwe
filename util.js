"use strict";

var util = {};

util.is_primitive = (x) => ["number","string","boolean"].includes(typeof x);

util.is_object = (x) => x == Object(x)

util.clone = (x, option) => {
  if (util.is_primitive(x)) return x;
  if (option && option.clone === false) return x;
  return JSON.parse(JSON.stringify({x:x})).x;
}

util.merge_array = (x,y) => {
  y = util.clone(y);
  return x===undefined? y : x.concat(y);
}

function init_merge_options(options) {
  return Object.assign({
    clone: true,
    is_mergeable: a=>true,
    array_merger: util.merge_array
  }, options)
}

util.merge = (x, y, options) => {

  function doit(x, y) {
    // if (!options.is_mergeable(y)) return clone(y);

    var is_array = Array.isArray(x);
    var same_type = is_array === Array.isArray(y);
    if (!same_type) return util.clone(y);
    if (is_array) return options.array_merger(x,y);

    var r = {};
    for (var key in x) {
      if (!x.hasOwnProperty(key)) continue;
      var vy = y[key];
      if (util.is_primitive(vy)) {
        r[key] = util.clone(vy);
        continue;
      }

      var vx = x[key];
      if (vy === undefined) {
        r[key] = util.clone(vx);
        continue;
      }

      r[key] = doit(vx, vy, options);
    }

    for (var key in y) {
      if (!(key in r)) r[key] = util.clone(y[key]);
    }
    return r;
  }
  options = init_merge_options(options);
  return doit(x,y);
}

util.merge.all = (array, options) => {
  options = init_merge_options(options);
  return array.reduce((prev, next, init)=>merge(prev, next, options))
}

util.walk = (obj, callback) => {
  for (var key in obj) {
    if (!obj.hasOwnProperty(key)) continue;
    var val = obj[key];
    if (callback(val, key, obj) === false) return;
    if (val !== undefined && !util.is_primitive(val))
      util.walk(val, callback)
  }
  return obj;
}

util.replace_vars = (str, values) => {
  if (!str.includes('$')) return str;
  for (var key in values) {
    if (!values.hasOwnProperty(key)) continue;
    str = str.replace('$'+key, values[key]);
  }
  return str;
}

util.replace_fields = (obj, values) => {
  util.walk(obj, (val, key, node) => {
    if (typeof val != 'string') return;
    var new_val = util.replace_vars(val, values);
    if (new_val != val) node[key] = new_val;
  })

}

module.exports = util;
