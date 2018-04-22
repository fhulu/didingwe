"use strict";

function clone(x, option) {
  if (option && option.clone === false) return x;
  return JSON.parse(JSON.stringify({x:x})).x;
}

function merge_array(x,y) {
  return x===undefined? clone(y): x;
  return x.concat(clone(y));
}

function init_options(options) {
  return Object.assign({
    clone: true,
    is_mergeable: a=>true,
    array_merger: merge_array
  }, options);
}

function is_primitive(x) {
  return ["number","string","boolean"].indexOf(typeof x)>=0;
}

function do_merge(x, y, options) {
  // if (!options.is_mergeable(y)) return clone(y);

  var is_array = Array.isArray(x);
  var same_type = is_array === Array.isArray(y);
  if (!same_type) return clone(y);
  if (is_array) return options.array_merger(x,y);

  y = clone(y);
  for (var key in x) {
    var vy = y[key];
    if (is_primitive(vy) || !x.hasOwnProperty(x))
      continue;

    var vx = x[key];
    if (vy === undefined) {
      y[key] = vx;
      continue;
    }

    y[key] = do_merge(vx, vy, options);
  }
  return y;
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
