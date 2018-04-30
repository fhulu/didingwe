"use strict";

function is_primitive(x) {
  return ["number","string","boolean"].indexOf(typeof x)>=0;
}


function clone(x, option) {
  if (is_primitive(x)) return x;
  if (option && option.clone === false) return x;
  return JSON.parse(JSON.stringify({x:x})).x;
}

function merge_array(x,y) {
  y = clone(y);
  return x===undefined? y : x.concat(y);
}

function init_options(options) {
  return Object.assign({
    clone: true,
    is_mergeable: a=>true,
    array_merger: merge_array
  }, options);
}

function do_merge(x, y, options) {
  // if (!options.is_mergeable(y)) return clone(y);

  var is_array = Array.isArray(x);
  var same_type = is_array === Array.isArray(y);
  if (!same_type) return clone(y);
  if (is_array) return options.array_merger(x,y);

  var r = {};
  for (var key in x) {
    if (!x.hasOwnProperty(key)) continue;
    var vy = y[key];
    if (is_primitive(vy)) {
      r[key] = clone(vy);
      continue;
    }

    var vx = x[key];
    if (vy === undefined) {
      r[key] = clone(vx);
      continue;
    }

    r[key] = do_merge(vx, vy, options);
  }

  for (var key in y) {
    if (!(key in r)) r[key] = clone(y[key]);
  }
  return r;
}


function merge(x, y, options) {
  options = init_options(options);
    return do_merge(x, y, options);
}

merge.all = function(array, options) {
  options = init_options(options);
  return array.reduce((prev, next)=> {
    return do_merge(prev, next, options);
  })
}
merge.array_merger = merge_array;

module.exports = merge;
