"use strict";

var util = {};

util.is_primitive = (x) => ["number","string","boolean"].indexOf(typeof x)>=0;

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
    callback(key, obj[key], obj)
    var v = obj[key];
    if (!util.is_primitive(v))
      util.walk(v, callback)
  }
}

module.exports = util;
