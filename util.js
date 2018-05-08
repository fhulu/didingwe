"use strict";

var util = {};

util.is_primitive = x => typeof x == "string" || !isNaN(x);
util.is_numeric = x => !isNaN(x);
util.is_string = x => typeof x == "string";
util.is_array = x => Array.isArray(x);
util.is_object = x => !util.is_primitive(x) && x == Object(x);
util.is_iteratable = x => Symbol.iterator in Object(obj);
util.last = x => x[x.length]

util.clone = (x, option) => {
  if (util.is_primitive(x)) return x;
  if (option && option.clone === false) return x;
  return JSON.parse(JSON.stringify({x:x})).x;
}

util.merge_array = (x,y) => {
  y = util.clone(y);
  return x===undefined? y : x.concat(y);
}

util.merge = (target, ...sources) => {
  var options = {
    clone: true,
    is_mergeable: a=>true,
    array_merger: util.merge_array
  };

  var last = util.last(sources)
  if (typeof last == 'function') {
    Object.assign(options, last());
    sources.pop();
  }

  function doit(x, y) {
    // if (!options.is_mergeable(y)) return clone(y);
    if (!y) return x;
    if (util.is_primitive(y) || util.is_primitive(x)) return y;
    var is_array = util.is_array(x);
    var same_type = is_array === util.is_array(y);
    if (!same_type) return util.clone(y);
    if (is_array) return options.array_merger(x,y);

    for (var key in y) {
      if (!y.hasOwnProperty(key)) continue;
      var vx = x[key];
      var vy = y[key];
      if (!vx || util.is_primitive(vy)) {
        x[key] = util.clone(vy);
        continue;
      }

      x[key] = doit(x[key], vy);
    }

    return x;
  }

  for (var source of sources) {
    doit(target, source);
  }

  return target;
}

util.walk = (obj, callback) => {
  if (!obj || util.is_primitive(obj)) return obj;
  if (util.is_array(obj)) {
    var len = obj.length;
    for (var i = 0; i< len; ++i) {
      if (callback(obj[i], i, obj) === false) return obj;
      var diff = len - obj.length;
      if (diff) {
        i -= diff;
        len -= diff;
        continue;
      }
      util.walk(obj[i], callback)
    }
    return obj;
  }
  for (var key in obj) {
    if (!obj.hasOwnProperty(key)) continue;
    if (callback(obj[key], key, obj) === false) return obj;
    util.walk(obj[key], callback)
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

util.intersection = (a,b) => a.filter ( v => b.includes(v) )
util.intersects = (a,b) => a.some( v => b.includes(v) )

util.remove = (x, k) => util.is_array(x)?  x.splice(k,1): delete x[k];

util.first_object = x => {
  for (var k in x) {
    if (!x.hasOwnProperty(k)) continue;
    return [k, x[k]];
  }
  return [];
}

util.first_key = x => util.first_object(x)[0];
util.first_value = x => util.first_object(x)[1];

util.is_empty = x => {
  if (x == null) return true;
  if (util.is_array(x)) return x.length == 0;

  for (var k in x) {
    if (!x.hasOwnProperty(k)) continue;
    return false;
  }
  return true;
}

util.empty = x => {
  for (var k in x) {
    if (!x.hasOwnProperty(k)) continue;
    delete x[k];
  }
}

util.default = (x, d) => x === undefined? d: x;

module.exports = util;
