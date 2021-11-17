(function(window) {

"use strict";
var didi = {
  send: function(url, options, callback) {
    if (options instanceof Function) {
      callback = options;
      options = undefined;
    }
    options = $.extend({
      progress: 'Processing...',
      method: 'post',
      async: true,
      showResult: false,
      invoker: undefined,
      data: {},
      eval: true,
      dataType: undefined,
      error: undefined,
      event: undefined
    }, options);

    //if (options.event !== undefined) options.async = false;
    var ret = this;
    if (options.invoker !== undefined)
      options.invoker.prop('disabled', true);
    var progress =  {};
    if (options.progress !== false) {
      progress.box = $('.processing');
      progress.box.click(function() {
        $(this).fadeOut('slow');
      });

      progress.timeout = setTimeout(function() {
        progress.box.find(".message").text(options.progress);
        progress.box.show();
      }, 1000);

      if (options.error ===undefined) {
        options.error = function(jqHXR, status, text)
        {
          console.log("AJAX ERROR", status, "TEXT", text)
          progress.box.html('<p class=error>Status:'+status+'<br>Text:'+text+'</p').show();
          if (options.event !== undefined) {
            options.event.stopImmediatePropagation();
            ret = false;
          }
        };
      }
    }

    $.ajax({
      type: options.method,
      url: url,
      data: options.data,
      async: options.async,
      error: options.error,
      cache: false,
      dataType: options.dataType,
      success: function(data) {
        console.log("AJAX SUCCESS", data);
        if (progress.timeout !== undefined) clearTimeout(progress.timeout);
        if (progress.box !== undefined) progress.box.hide();
        if (callback !== undefined) callback(data, options.event);
        if (options.invoker !== undefined) options.invoker.prop('disabled', false);
      }
    });
    return ret;
  },

  json: function(url, options, callback) {
    if (options instanceof Function) {
      callback = options;
      options = {dataType: 'json'};
    }
    else options = $.extend(options, {dataType: 'json'});
    return this.send(url, options, callback);
  },

  urlParam: function(name) {
    var results = new RegExp('[\\?&]' + name + '=([^&#]*)').exec(window.location.href);
    return results[1] || 0;
  },

  scrollbarWidth: function() {
    var parent, child, width;

    parent = $('<div style="width:50px;height:50px;overflow:auto"><div/></div>').appendTo('body');
    child=parent.children();
    width=child.innerWidth()-child.height(99).innerWidth();
    parent.remove();

    return width;
  },
  /**
  * @param scope Object :  The scope in which to execute the delegated function.
  * @param func Function : The function to execute
  * @param data Object or Array : The data to pass to the function. If the function is also passed arguments, the data is appended to the arguments list. If the data is an Array, each item is appended as a new argument.
  * @param isTimeout Boolean : Indicates if the delegate is being executed as part of timeout/interval method or not. This is required for Mozilla/Gecko based browsers when you are passing in extra arguments. This is not needed if you are not passing extra data in.
  */
  delegate: function(scope, func, data, isTimeout) {
    return function() {
      var args = Array.prototype.slice.apply(arguments).concat(data);
      //Mozilla/Gecko passes a extra arg to indicate the "lateness" of the interval
      //this needs to be removed otherwise your handler receives more arguments than you expected.
              //NOTE : This uses jQuery for browser detection, you can add whatever browser detection you like and replace the below.
      if (isTimeout && $.browser.mozilla)
          args.shift();

      func.apply(scope, args);
    }
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
    var i=0;
    $.each(object, function() {++i});
    return i;
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

  appendArray: function(arr,item) {
    if ($.isArray(arr))
      arr.push(item);
    else if (arr)
      arr = [arr, item];
    else
      arr = [item];

    return arr;
  },

  deleteKeys: function(obj, keys) {
    for (var i in keys) {
      delete obj[keys[i]];
    }
    return obj;
  },

  indexOfKey: function(arr, keyName, keyValue) {
    for (var i in arr) {
      var obj = arr[i];
      if (obj[keyName] === keyValue) return i;
    }
    return -1;
  },

  firstIndexOfKey: function(arr, keyName, keyValue) {
    return $.indexOfKey(arr, keyName, keyValue);
  },

  lastIndexOfKey: function(arr, keyName, keyValue) {
    var last = -1;
    for (var i in arr) {
      var obj = arr[i];
      if (obj[keyName] === keyValue) last = i;
    }
    return last;
  },

  merge: function(a1, a2) {
    if (a1 === undefined || a1 === null) return a2;
    if (a2 === undefined || a2 === null) return a1;
    var r = this.copy(a1);
    for (var i in a2) {
      if (!a2.hasOwnProperty(i)) continue;
      var v2 = a2[i];
      if (!a1.hasOwnProperty(i)) {
        r[i] = v2;
        continue;
      }
      var v1 = r[i];
      if (typeof v1 !== typeof v2
              || $.isArray(v1) && !$.isArray(v2)
              || $.isPlainObject(v1) && !$.isPlainObject(v2)) {
        r[i] = v2;
        continue;
      }

      if ($.isArray(v1)) {
        if (v2[0] == '_reset')
          r[i] = v2.slice(1);
        else
          r[i] = $.merge( $.merge([], v1), v2);
        //note: no deep copying arrays, only objects
        continue;
      }
      if ($.isPlainObject(v1))
        r[i] = this.merge(v1, v2);
      else
        r[i] = v2;
    }
    return r;
  },

  toObject: function(val) {
    var result = {};
    result[val] = {};
    return result;
  },

  loadPage: function(options, parent) {
    if (parent == undefined) parent = $('body');
    var defer = $.Deferred();
    var path = options.path;
    if  (path[0] === '/') path=options.path.substr(1);
    var data = $.extend({key: options.key}, options.request, {path: path, action: 'read'});
    this.json('/', { data: data }, function(result) {
      parent.trigger('server_response', result);
      if (!result.path) return;
      result.values = $.extend({}, options.values, result.values );
      defer.resolve(result,options);
    });
    return defer.promise();
  },

  createPage: function(options, data, parent) {
    var id = data.fields.id = options.page_id = data.path.replace('/','_');
    data.fields.local_id = data.path.split('/').pop();
    var values = data.fields.values || data.values;
    if (data.fields.name === undefined)
      data.fields.name = dd.toTitleCase(data.path.split('/').pop().replace('_',' '));
    data.fields.path = data.path;
    data.fields.sub_page = false;
    data.fields.values = values;
    var r = new dd.render({invoker: parent, types: data.types, id: id, key: options.key, request: options.request} );
    var object = r.render(data, 'fields');
    if (data._responses)  r.respond(data);
    object.addClass('page');
    if (parent && !object.is('body'))
      object.appendTo(parent);
    return object;
  },

  showPage: function(options, parent, data) {
    if (parent == undefined) {
      parent = options.parent? $(parent): $('body');
    }
    var defer = $.Deferred();
    var createPage = function(result, options) {
      var object = dd.createPage(options, result, parent);
      if ($.isPlainObject(result.fields.parent))
        parent.setClass(result.fields.parent.class);      
      defer.resolve(object,result,options);
    };

    if (data)
      createPage(data, options);
    else
      dd.loadPage(options, parent).done(createPage);    
    return defer.promise();
  },

  showDialog: function(path, field) {
    if (path[0] === '/') path = path.substr(1);
    var params = $.extend({ path: path }, field);
    var defer = $.Deferred();

    this.loadPage({path: '/modal', show: false}).done(function(modal, options) {
      var tmp = $("<div>");
      dd.showPage(params, tmp).done(function(obj, page) {
        if (page.fields.modal) modal.fields = dd.merge(modal.fields, page.fields.modal);
        if (modal.fields.title_bar) dd.replaceVars(page.fields, modal.fields.title_bar, {recurse: true});
        if (modal.fields.close_button) dd.replaceVars(page.fields, modal.fields.close_button, {recurse: true});
        modal = dd.createPage(options,modal);
        modal.removeAttr('id');
        var dialog = modal.find('.modal-dialog');
        dialog.append(obj);
        dialog.draggable({handle: ".modal-title-bar"});
        modal.appendTo($('body')).show();
        defer.resolve(dialog, page, field);
      });
    });
    return defer.promise();
  },


  closeDialog: function(dialog, message) {
    if (message) alert(message);
    var parent = dialog.closest('.modal');
    parent.trigger("closing");
    if (parent.exists()) parent.remove();
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
    if ($.isArray(src)) return [].concat(src);
    return $.extend(true, {}, src);
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
      if ($.isPlainObject(val) || $.isArray(val)) continue;
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
        if (!$.isPlainObject(v)) return;
        me.replaceVars($.extend({}, source, dest), v, flags);
        val[key] = v;
      });
      return val;
    }

    if ($.isArray(dest))
      return;

    do {
        replaced = false;
        for (var key in dest) {
          if ($.isArray(dest.constants) && dest.constants.indexOf(key) >= 0) continue;
          var val = dest[key];
          if ($.isArray(val))
            dest[key] = replaceArray(key, val);
          else if ($.isPlainObject(val) && flags.recurse)
            dd.replaceVars($.extend({}, source, dest), val, flags);
          else
            dest[key] = replaceOne(val)
        }
    } while (replaced && flags.recurse)
  },

  replaceFields: function(str, fields, data) {
    if (typeof str != 'string') return str;
    $.each(fields, function(i, field) {
      var val = i < data.length? data[i]: "";
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
    $.each(field, function(k, value) {
      callback(k, value, field, level);
      if ($.isArray(value) || $.isPlainObject(value))
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

  loadLink: function(link, type) {
    return $.Deferred(function(defer) {
      var params = {
        css: { tag: 'link', type: 'text/css', selector: 'href', rel: 'stylesheet' },
        script: { tag: 'script', type: 'text/javascript', selector: 'src'}
      }
      var param = params[type];
      if (link.indexOf('?') < 0) {
        var prev = $(param.tag+'['+param.selector+'="'+link+'"]');
        if (prev.exists()) return defer.resolve(link);
      }
      var element = document.createElement(param.tag);
      delete param.tag;
      element[param.selector] = link;
      delete param.selector;
      $.extend(element, param);
      element[param.src] = link;
      element.type = param.type;
      if (type == 'css') element.rel = 'stylesheet';

      element.onreadystatechange = element.onload = function() { defer.resolve(link); }
      element.onerror = function() { defer.resolve(link); }
      document.head.appendChild(element);
    }).promise();
  },

  // from stackoverflow http://stackoverflow.com/questions/1787322/htmlspecialchars-equivalent-in-javascript/4835406#4835406
  escapeHtml: function(text, exclude, include) {
    var result = text;
    if (exclude) {
      if (typeof exclude == "string") exclude = exclude.split(" ");
      if ($.isNumeric(exclude[0]) && parseInt(exclude[0]) == 0) return result;
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

  isAtomicValue: function(x) { return typeof x == 'string' || typeof x == 'number'; },

  removeXSS: function(object) {
    var r = /<script(?:\s+[^>]*)?>.*<\/script>/;
    var replace = function(x) {
      var replaced = false;
      for (var i in x) {
          var v = x[i];
          var p;
          if ($.isArray(v) || $.isPlainObject(v))
            replace(x[i]);
          else if (typeof v == 'string' && (p=v.search(r))>=0) {
            var m = v.match(r);
            x[i] = v.substr(0,p)+$.escapeHtml(m[0])+v.substr(p+m[0].length);
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