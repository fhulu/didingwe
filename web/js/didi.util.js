(function(window) {

"use strict";
var didi = {
  urlParam: function(name) {
    var results = new RegExp('[\\?&]' + name + '=([^&#]*)').exec(window.location.href);
    return results[1] || 0;
  },

  sleep: function(milliseconds) {
    var start = new Date().getTime();
    for (var i = 0; i < 1e7; i++) {
      if ((new Date().getTime() - start) > milliseconds){
        break;
      }
    }
  },


  getQueryParams: function(qs) {
    qs = qs.split("+").join(" ");

    var params = {}, tokens,
      re = /[?&]?([^=]+)=([^&]*)/g;

    while (tokens = re.exec(qs)) {
      params[decodeURIComponent(tokens[1])]
        = decodeURIComponent(tokens[2]);
    }
    return params;
  },

  jsonSize: function(object) {
    var n=0;
    for (const k in object) {
      if (object.hasOwnProperty(k)) ++n;
    }
    return n;
  },

  valid: function(object) {
    return object !== null && object !== undefined;
  },

  isNumber: function(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
  },

  toTitleCase: function(str) {
    str = str.replace(/[_\/]/g, ' ');
    return str.replace(/\w\S*/g,  function (txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  },

  // from stackoverflow: Mathias Bynens
  getMatches: function(string, expr, index) {
    index || (index = 1); // default to the first capturing group
    var matches = [];
    var match;
    while (match = expr.exec(string)) {
        matches.push(match[index]);
    }
    return matches;
  },

  assert: function(condition, message) {
    if (!condition) {
      message = message || "Assertion failed";
      console.log(message);
      if (typeof Error !== "undefined") {
        throw new Error(message);
      }
      throw message; // Fallback
    }
  },

  rgbToHex: function(color) {
    if (color.substr(0, 1) === "#") {
        return color;
    }
    var nums = /(.*?)rgb\((\d+),\s*(\d+),\s*(\d+)\)/i.exec(color);
    if (!nums) return color;
    var r = parseInt(nums[2], 10).toString(16);
    var g = parseInt(nums[3], 10).toString(16);
    var b = parseInt(nums[4], 10).toString(16);
    return "#"+ (
        (r.length == 1 ? "0"+ r : r) +
        (g.length == 1 ? "0"+ g : g) +
        (b.length == 1 ? "0"+ b : b)
    );
  },

  darken: function( hexColor, factor ) {
    if ( factor < 0 ) factor = 0;

    var c = hexColor;
    if( c.substr(0,1) == "#" ){
      c = c.substring(1);
    }

    if( c.length == 3 || c.length == 6 ){
      var i = c.length / 3;
      var f;  // the relative distance from white

      var r = parseInt( c.substr(0, i ), 16 );
      f = ( factor * r / (256-r) );
      r = Math.floor((256 * f) / (f+1));

      r = r.toString(16);
      if ( r.length == 1 ) r = "0" + r;

      var g = parseInt(c.substr(i, i), 16);
      f = (factor * g / (256 - g));
      g = Math.floor((256 * f) / (f + 1));
      g = g.toString(16);
      if (g.length == 1)
      g = "0" + g;

      var b = parseInt(c.substr(2 * i, i), 16);
      f = (factor * b / (256 - b));
      b = Math.floor((256 * f) / (f + 1));
      b = b.toString(16);
      if (b.length == 1)
      b = "0" + b;
      c = r + g + b;
    }
    return "#" + c;
  },

  isArray: (v) => v && v.constructor === Array,
  
  isPlainObject: (v) => v && v instanceof Object && v.constructor === Object,
    
  appendArray: function(arr,item) {
    if (dd.isArray(arr))
      arr.push(item);
    else if (arr)
      arr = [arr, item];
    else
      arr = [item];

    return arr;
  },

  mergeArray: function (/*args*/) {
    var merge = (a1, a2) => a2.forEach((v) => a1.push(v));

    while (arguments.length > 1) {
      merge(arguments[0], arguments[1]);
      arguments.splice(1,1);
    }
  },

  deleteKeys: (obj, keys) => {
    keys.forEach(k => delete obj[k]);
    return obj;
  },

  indexOfKey: (arr, keyName, keyValue) => {
    for (var i in arr) {
      var obj = arr[i];
      if (obj[keyName] === keyValue) return i;
    }
    return -1;
  },

  firstIndexOfKey: (arr, keyName, keyValue) => dd.indexOfKey(arr, keyName, keyValue),

  lastIndexOfKey: function(arr, keyName, keyValue) {
    var last = -1;
    for (var i in arr) {
      var obj = arr[i];
      if (obj[keyName] === keyValue) last = i;
    }
    return last;
  },

  merge: function() {
    let doit = function(a1, a2) {
      if (a1 === undefined || a1 === null) return a2;
      if (a2 === undefined || a2 === null) return a1;
      var r = dd.copy(a1);
      for (var i in a2) {
        if (!a2.hasOwnProperty(i)) continue;
        var v2 = a2[i];
        if (!a1.hasOwnProperty(i)) {
          r[i] = dd.copy(v2);
          continue;
        }
        var v1 = r[i];
        if (typeof v1 !== typeof v2
                || dd.isArray(v1) && !dd.isArray(v2)
                || dd.isPlainObject(v1) && !dd.isPlainObject(v2)) {
          r[i] = dd.copy(v2);
          continue;
        }

        if (dd.isArray(v1)) {
          if (v2[0] == '_reset')
            r[i] = dd.copy(v2.slice(1));
          else
            r[i] = ([].concat(v1)).concat(v2);
          //note: no deep copying arrays, only objects
          continue;
        }
        if (dd.isPlainObject(v1))
          r[i] = dd.merge(v1, v2);
        else
          r[i] = dd.copy(v2);
      }
      return r;
    }
    let result = arguments[0];
    for (var i=1; i < arguments.length; i++) {
      result = doit(result, arguments[i]);
    }
    return result;
  },

  toObject: function(val) {
    var result = {};
    result[val] = {};
    return result;
  },


  firstElement: function(obj) {
    for (var key in obj) {
      if (!obj.hasOwnProperty(key)) continue;
      return [key, obj[key] ];
    };
    return undefined;
  },

  firstValue: function(obj) {
    for (var key in obj) {
      if (!obj.hasOwnProperty(key)) continue;
      return obj[key];
    };
  },

  firstKey: function(obj) {
    return this.firstElement(obj)[0];
  },

  copy: function(src) {
    if (src === undefined || dd.isAtomicValue(src)) return src;
    var me = this;
    var copy_array = () => {
      var r = [];
      src.forEach(v => r.push(me.copy(v)));
      return r;
    }

    var copy_object = () => {
      var r = {};
      for (const k in src) {
        if (!src.hasOwnProperty(k)) continue;
        r[k] = this.copy(src[k]);
      }
      return r;
    }

    return me.isArray(src)? copy_array(): copy_object();
  },

  size: function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
  },

  plainValues: function(options) {
    var result = {}
    for (var key in options) {
      var val = options[key];
      if (dd.isPlainObject(val) || dd.isArray(val)) continue;
      result[key] = val;
    };
    return result;
  },

  replaceVars: function(source, dest, flags) {
    if (!flags) flags = {};
    var args = arguments;
    var replaced = false;
    var me = this;
    var replaceOne = function(val) {
      if (!me.isAtomicValue(val)) return val;
      var matches = dd.getMatches(val, /\$(\w+)/g);
      if (!matches) return val;
      matches.forEach(function(match) {
        var index = flags.sourceFirst? 0: 1;
        var arg = args[index++];
        var replacement;
        if (arg !== undefined) replacement = arg[match];
        arg = args[index % 2];
        if (replacement === undefined || replacement === val && arg !== undefined) replacement = arg[match];
        if (replacement === undefined) return;
        var old = val;
        val = val.replace(new RegExp('\\$'+match+"([^\w]|\b|$)", 'g'), replacement+'$1');
        if (!replaced)
          replaced = val != old;
      });
      return val;
    }

    var replaceArray = function(key, val) {
      val.forEach(function(v) {
        if (!dd.isPlainObject(v)) return;
        me.replaceVars(dd.merge({}, source, dest), v, flags);
        val[key] = v;
      });
      return val;
    }

    do {
        replaced = false;
        for (var key in dest) {
          if (dd.isArray(dest.constants) && dest.constants.indexOf(key) >= 0) continue;
          var val = dest[key];
          if (dd.isArray(val))
            dest[key] = replaceArray(key, val);
          else if (dd.isPlainObject(val) && flags.recurse)
            dd.replaceVars(dd.merge({}, source, dest), val, flags);
          else
            dest[key] = replaceOne(val)
        }
    } while (replaced && flags.recurse)
  },

  each: (obj, callback) => {
    if (dd.isArray(obj)) 
      return obj.forEach(callback);
    for (const [key, value] of Object.entries(ojj)) 
      callback(key, value);
    return obj;
  },

  replaceFields: function(str, fields, data) {
    if (typeof str != 'string') return str;
    dd.each(fields, function(field, key) {
      var val = data[key];
      if (val !== undefined) 
        str = str.replace('$'+field, val);
    });
    return str;
  },

  replaceValues: function(str, data){
    for (var key in data) {
      if (!data.hasOwnProperty(key)) continue;
      str = str.replace('$'+key, data[key]);
    }
    return str;
  },

  visible: function(f) {
    return !(f.hide || f.show === false);
  },

  walkTree: function(field, callback, level) {
    if (level === undefined) level = 0;
    dd.each(field, function(value, key) {
      callback(value, key, field, level);
      if (dd.isArray(value) || dd.isPlainObject(value))
        this.walkTree(value, callback, level+1);
    });
  },

  hasFlag: function(flags, flag) {
    return flags.indexOf(flag) >= 0;
  },

  toIntValue: function(field, key) {
    if (!(key in field)) return false;
    var val = field[key];
    val = val == ''? 0: parseInt(val);
    if (isNaN(val)) return false;
    field[key] = val;
    return true;
  },

  getCSS: function (href) {
    return this.loadLink(href, 'css');
  },

  isNumeric: (n)=> {
    typeof n === "number" && (+n) == n;
  },

  // from stackoverflow http://stackoverflow.com/questions/1787322/htmlspecialchars-equivalent-in-javascript/4835406#4835406
  escapeHtml: function(text, exclude, include) {
    var result = text;
    if (exclude) {
      if (typeof exclude == "string") exclude = exclude.split(" ");
      if (d.isNumeric(exclude[0]) && parseInt(exclude[0]) == 0) return result;
      exclude.map(function(v) {
        result = result.replace(new RegExp("<(\/?)"+v+"(\/?)>",'g'), '~~~$1'+v+'$2~~~');
      })
    }

    if (include) {
      if (typeof include == "string") include = include.split(" ");
      include.map(function(v) {
        result = result.replace(new RegExp("<(\/?)"+v+"(\/?)>",'g'), '&lt;$1'+v+'$2&gt;');
      });
    }
    else {
      var map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      result = result.replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    if (exclude) {
      exclude.map(function(v) {
        result = result.replace(new RegExp("~~~(\/?)"+v+"(\/?)~~~",'g'), '<$1'+v+'$2>');
      })
    }
    return result;
  },

  isAtomicValue: function(x) { return typeof x == 'string' || !isNaN(x); },

  removeXSS: function(object) {
    var r = /<script(?:\s+[^>]*)?>.*<\/script>/;
    var replace = function(x) {
      var replaced = false;
      for (var i in x) {
          var v = x[i];
          var p;
          if (dd.isArray(v) || dd.isPlainObject(v))
            replace(x[i]);
          else if (typeof v == 'string' && (p=v.search(r))>=0) {
            var m = v.match(r);
            x[i] = v.substr(0,p)+dd.escapeHtml(m[0])+v.substr(p+m[0].length);
            replaced = true;
          }
      }
      if (replaced) replace(x);
    }
    replace(object);
  },


  debounce: function (func, wait, immediate) {
    var timeout;
    return function() {
      var context = this, args = arguments;
      var later = function() {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      var callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    };
  },

  selector: {
    id: function(v) {
      return '#'+v;
    },
  
    idName: function(v)  {
      return "#?,[name='?']".replace('?',v);
    },
  
    name: function(v) {
      return "[name='?']".replace('?',v);
    },
  
    attr: function(name, value) {
      return "$name='$value']".replace('$name',name).replace('$value',value);
    }
  },
}

if(window.didi === undefined || window.dd === undefined) {
  window.didi = window.dd = didi;
}

})(window);