window._seq = 0;
$.fn.exists = function()
{
  return this.get(0) != undefined;
}

$.fn.hasAttr = function(name)
{
  return this.attr(name) !== undefined;
}

$.fn.filterText = function(text) {
  return this.filter(function() {
    return $(this).text() == text;
  });
}

$.fn.setValue = function(val)
{
  if ($.isArray(val)) return this;
  if ($.isPlainObject(val)) {
    var me = this;
    $.each(val, function(k, v) {
      switch(k) {
        case 'value': me.setValue(v); break;
        case 'class': me.setClass(v); break;
        case 'children': $.each(v, function(selector, value) { me.find(selector).setValue(value); } ); break;
        default: me.attr(k, v);
      }
    })
  }

  if (this.hasAttr('template'))
    val = this.attr('template').replace(/\$value/,val);

  if (this.is("a")) {
    if (val == null) val = '';
    return this.attr('href', val);
  }
  var type = this.attr('type');
  if (type === 'checkbox') {
    var values = this.attr('values');
    if (values != '') val = values.indexOf(val);
    return this.prop('checked', val);
  }

  if (type == 'radio') {
    var parent = this.closest('.radiogroup');
    var checked = parent.find("[type=radio][name='"+this.attr('name')+"'][value='"+val+"']");
    checked.prop('checked', true);
    return this;
  }

  if (this.is('select')) {
    this.val(val);
    if (this.val() == val) return this;
    var option = this.children('option').filterText(val);
    if (!option.exists()) return this;
    if (this.attr('server') == val) this.attr('server', option.val());
    this.val(option.val());
    return this;
  }

  if (typeof val == 'string')  val = mkn.escapeHtml(val, this.attr('parseHtml'), this.attr('escapeHtml'));
  if (this.hasAttr('value'))
    return this.attr('value', val).val(val);
  return this.html(val);
}

$.fn.getValue = function()
{
  var type = this.attr('type');
  if (type === 'checkbox') {
    var val = this.is(':checked')?1:0;
    var values = this.attr('values');
    if (values == '') return val;
    return values.split(',')[val];
  }
  if (type === 'radio') return this.filter(':checked').val();
  if (this.is('input,select,textarea')) return this.val();
  return this.is('[value]')? this.attr('value'): this.text();
}

$.fn.value = function(val)
{
  if (val === undefined) return this.getValue();
  return this.setValue(val);
}


$.fn.updateCheckGroupValue = function()
{
  var data = [];
  this.find('input[type=checkbox]').each(function() {
    if ($(this).is(':checked'))
       data.push($(this).attr('check'));
  });
  return this.attr('chosen', data.join());
}

$.fn.values = function()
{
  this.find('.checkgroup').updateCheckGroupValue();
  var data = {};
  var delta = [];
  this.filter('input,textarea,select,.checkgroup,:not(option)[value]').each(function() {
    var ctrl = $(this);
    var name = ctrl.hasAttr('name')? ctrl.attr('name'): ctrl.attr('id');
    if (name === undefined || name.trim() == '') return true;
    var val;
    if (ctrl.hasClass('checkgroup'))
      val = ctrl.attr('chosen');
    else if (ctrl.attr('type') === 'radio') {
      if (!ctrl.is(':checked')) return;
      val = ctrl.attr('value');
    }
    else
      val = ctrl.value();

    var server = ctrl.attr('server');
    if (server !== undefined && server != val)
      delta.push(name);
    data[name] = val;
  });
  data.delta = delta.join();
  return data;
}

$.send = function(url, options, callback)
{
  if (options instanceof Function) {
    callback = options;
    options = undefined;
  }
  if (typeof request_method === 'undefined') request_method = 'post';
  options = $.extend({
    progress: 'Processing...',
    method: request_method,
    async: true,
    showResult: false,
    invoker: undefined,
    data: {},
    eval: true,
    dataType: undefined,
    error: undefined,
    event: undefined
  }, options);
  options.data._seq = window._seq++;
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
}


$.fn.send = function(url, options, callback)
{
  if (options instanceof Function) {
    callback = options;
    options = undefined;
  }
  var data = $(this).values();
  if (options !== undefined)
    data = $.extend({}, options.data, data);

  options = $.extend({}, options, {data: data});
  return $.send(url, options, callback);
}

$.fn.json = function(url, options, callback)
{
  if (options instanceof Function) {
    callback = options;
    options = undefined;
  }
  var data = $(this).values();
  var prefix = options.post_prefix;
  if (prefix) {
    delete options.post_prefix;
    var result = {};
    $.each(data, function(key, value) {
      if (key == 'delta') return;
      result[prefix+key] = value;
    });
    data = result;
  }


  if (options !== undefined)
    data = $.extend({}, options.data, data);

  options = $.extend({}, options, {data: data});
  $.json(url, options, function(result){
    callback(result);
  });
  return this;
}


$.json = function(url, options, callback)
{
  if (options instanceof Function) {
    callback = options;
    options = {dataType: 'json'};
  }
  else options = $.extend(options, {dataType: 'json'});
  return $.send(url, options, callback);
}

$.fn.setChildren = function(result, server)
{
  var self = this;
  if (result === null) return;
  $.each(result, function(key, val) {
    var obj = self.find("#"+key+",[name='"+key+"']");
    if (server) obj.attr('server', val);
    obj.setValue(val);
  });
  return this;
}

$.fn.loadChildren = function(url, data, callback)
{
  var self = this;
  var result;
  $.json(url, data, function(data) {
    self.setChildren(data);
    result = data;
    if (callback != undefined) callback(result);
  });
  return this;
}

$(function(){
    $.each(["show","hide", "toggleClass", "addClass", "removeClass"], function(){
        var _oldFn = $.fn[this];
        $.fn[this] = function(){
            var hidden = this.find(":hidden").add(this.filter(":hidden"));
            var visible = this.find(":visible").add(this.filter(":visible"));
            var result = _oldFn.apply(this, arguments);
            hidden.filter(":visible").each(function(){
                $(this).triggerHandler("show");
            });
            visible.filter(":hidden").each(function(){
                $(this).triggerHandler("hide");
            });
            return result;
        }
    });
});

$.urlParam = function(name){
    var results = new RegExp('[\\?&]' + name + '=([^&#]*)').exec(window.location.href);
    return results[1] || 0;
}

$.fn.insertAtCursor = function(myValue)
{
  var pos = this.getCursorPosition();
  var val = this.val();
  this.val(val.substr(0, pos) + myValue + val.substr(pos));
}

$.fn.getCursorPosition = function() {
    var el = $(this).get(0);
    var pos = 0;
    if('selectionStart' in el) {
        pos = el.selectionStart;
    } else if('selection' in document) {
        el.focus();
        var Sel = document.selection.createRange();
        var SelLength = document.selection.createRange().text.length;
        Sel.moveStart('character', -el.value.length);
        pos = Sel.text.length - SelLength;
    }
    return pos;
}

$.fn.bookmarkOnClick = function() {
  // Mozilla Firefox Bookmark
  this.click(function() {
    if ('sidebar' in window && 'addPanel' in window.sidebar) {
        window.sidebar.addPanel(location.href,document.title,"");
    } else if( /*@cc_on!@*/false) { // IE Favorite
        window.external.AddFavorite(location.href,document.title);
    } else { // webkit - safari/chrome
        alert('Press ' + (navigator.userAgent.toLowerCase().indexOf('mac') != - 1 ? 'Command/Cmd' : 'CTRL') + ' + D to bookmark this page.');
    }
  });
}

$.fn.customCreate = function(options)
{
  var create = options.create;
  if (create === undefined) return;
  this.attr('customCreate',create);
  this.run(create, options);
}

$.fn.run = function()
{
  var args = Array.prototype.slice.call(arguments);;
  var f = args.shift();
  this[f].apply(this, args);
}

$.fn.call = function(method, args) {
  this[method].apply(this, args);
}

$.fn.scrollHeight = function() {
  return this[0].scrollHeight;
}

$.fn.hasScrollBar = function() {
  return this[0].scrollHeight > this.height();
}

$.scrollbarWidth = function() {
  var parent, child, width;

  parent = $('<div style="width:50px;height:50px;overflow:auto"><div/></div>').appendTo('body');
  child=parent.children();
  width=child.innerWidth()-child.height(99).innerWidth();
  parent.remove();

 return width;
};
/**
* @param scope Object :  The scope in which to execute the delegated function.
* @param func Function : The function to execute
* @param data Object or Array : The data to pass to the function. If the function is also passed arguments, the data is appended to the arguments list. If the data is an Array, each item is appended as a new argument.
* @param isTimeout Boolean : Indicates if the delegate is being executed as part of timeout/interval method or not. This is required for Mozilla/Gecko based browsers when you are passing in extra arguments. This is not needed if you are not passing extra data in.
*/
function delegate(scope, func, data, isTimeout)
{
    return function()
    {
        var args = Array.prototype.slice.apply(arguments).concat(data);
        //Mozilla/Gecko passes a extra arg to indicate the "lateness" of the interval
        //this needs to be removed otherwise your handler receives more arguments than you expected.
                //NOTE : This uses jQuery for browser detection, you can add whatever browser detection you like and replace the below.
        if (isTimeout && $.browser.mozilla)
            args.shift();

        func.apply(scope, args);
    }
}



function sleep(milliseconds) {
  var start = new Date().getTime();
  for (var i = 0; i < 1e7; i++) {
    if ((new Date().getTime() - start) > milliseconds){
      break;
    }
  }
}


function getQueryParams(qs) {
    qs = qs.split("+").join(" ");

    var params = {}, tokens,
        re = /[?&]?([^=]+)=([^&]*)/g;

    while (tokens = re.exec(qs)) {
        params[decodeURIComponent(tokens[1])]
            = decodeURIComponent(tokens[2]);
    }

    return params;
}

$.jsonSize = function(object)
{
  var i=0;
  $.each(object, function() {++i});
  return i;
}

$.valid = function(object)
{
  return object !== null && object !== undefined;
}




function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}


function toTitleCase(str)
{
  str = str.replace(/[_\/]/g, ' ');
  return str.replace(/\w\S*/g,  function (txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}


// from stackoverflow: Mathias Bynens
function getMatches(string, regex, index) {
    index || (index = 1); // default to the first capturing group
    var matches = [];
    var match;
    while (match = regex.exec(string)) {
        matches.push(match[index]);
    }
    return matches;
}

// Gary Haran => gary@talkerapp.com
// This code is released under MIT licence
(function($) {
  var replacer = function(finder, replacement, element, blackList) {
    if (!finder || typeof replacement === 'undefined') {
      return
    }
    var regex = (typeof finder == 'string') ? new RegExp(finder, 'g') : finder;
    var childNodes = element.childNodes;
    var len = childNodes.length;
    var list = typeof blackList == 'undefined' ? 'html,head,style,title,link,meta,script,object,iframe,pre,a,' : blackList;
    while (len--) {
      var node = childNodes[len];
      if (node.nodeType === 1 && true || (list.indexOf(node.nodeName.toLowerCase()) === -1)) {
        replacer(finder, replacement, node, list);
      }
      if (node.nodeType !== 3 || !regex.test(node.data)) {
        continue;
      }
      var frag = (function() {
        var html = node.data.replace(regex, replacement);
        var wrap = document.createElement('span');
        var frag = document.createDocumentFragment();
        wrap.innerHTML = html;
        while (wrap.firstChild) {
          frag.appendChild(wrap.firstChild);
        }
        return frag;
      })();
      var parent = node.parentNode;
      parent.insertBefore(frag, node);
      parent.removeChild(node);
    }
  }
  $.fn.replace = function(finder, replacement, blackList) {
    return this.each(function() {
      replacer(finder, replacement, $(this).get(0), blackList);
    });
  }
})(jQuery);

function assert(condition, message) {
  if (!condition) {
    message = message || "Assertion failed";
    console.log(message);
    if (typeof Error !== "undefined") {
      throw new Error(message);
    }
    throw message; // Fallback
  }
}

function rgbToHex(color) {
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
}

function darken( hexColor, factor ) {
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
 }


$.fn.valueFromCurrency = function()
{
  return this.value().replace(/[^\d.]/g,'');
}
// from stackoverflow: Anurag
$.fn.bindFirst = function(name, fn)
{
  // bind as you normally would
  // don't want to miss out on any jQuery magic
  this.on(name, fn);

  // Thanks to a comment by @Martin, adding support for
  // namespaced events too.
  return this.each(function() {
      var handlers = $._data(this, 'events')[name.split('.')[0]];
      // take out the handler we just inserted from the end
      var handler = handlers.pop();
      // move it at the beginning
      handlers.splice(0, 0, handler);
  });
};

$.fn.findByAttribute = function(attr, value) {
  return this.find("["+attr+"='"+escape(value)+"']");
}

$.fn.addStyle = function(styles, reference) {
  if (!$.isArray(styles)) styles = styles.split(/[, ]/);
  var added = [];
  var removed = [];
  var css = [];
  if (!reference) reference = this.data('didi-field').style;
  styles.forEach(function(style) {
    added.push(style)
    var classes = reference[style];
    if (!classes) return;
    if ($.isPlainObject(classes)) {
      css.push(classes.style);
      classes = classes.class;
    }
    if (!classes) return;
    classes.forEach(function(cls) {
      if (cls[0] == '~')
        me.removeStyle(reference, cls.substr(1));

      else if (cls[0] == '^')

        removed.push(cls.substr(1));
      else
        added.push(cls);
    });
  })
  if (added.length) this.addClass(added.join(' '));
  if (removed.length) this.removeClass(removed.join(' '));
  if (!css.length) return this;
  var me = this;
  css.forEach(function(style) {
    this.css(style);
  })
  return this;
}

$.fn.removeStyle = function(styles, reference) {
  if (!$.isArray(styles)) styles = styles.split(' ');
  if (!reference) reference = this.data('didi-field').style;

  var me = this;
  styles.forEach(function(style) {
    me.removeClass(style)
    var classes = reference[style];
    if (!classes) return;
    classes.forEach(function(cls) {
      me.removeClass(cls);
    });
  })
  return this;
}

$.fn.setClass = function(classes, remove) {
  if (classes === undefined) return;
  if (typeof classes === 'string') classes = classes.split(' ');
  var del = [], add =[];
  for (var i in classes) {
    var cls = classes[i];
    if (!cls) continue;
    cls[0]=='^' || cls[0] == '-'? del.push(cls.substr(1)): add.push(cls);
  }
  if (remove) {
    var tmp = add;
    add = del;
    del = tmp;
  }
  this.addClass(add.join(' '));
  this.removeClass(del.join(' '));
  return this;
}

$.fn.unsetClass = function(classes) {
  return this.setClass(classes,true)
}

$.fn.getQuantity = function(key, init) {
  var v = this.data(key);
  if (v === undefined) return init || 0;
  return parseInt(v);
}

$.fn.load = function(options) {
  mkn.showPage(options, this).done(function(obj, result, field) {
    setStyle(obj, field);
    setClass(obj, field);
    this.trigger('dying');
    this.replaceWith(obj);
  });
}

$.fn.getAttributes = function(list) {
  var result = {}
  if (list) {
    for (var i = 0; i< list.length; ++i) {
      var name = list[i];
      result[name] = name=='text'? this.text(): this.attr(name);
    }
  }
  else {
    var attrs = this[0].attributes;
    for (var i = 0; i< attrs.length; ++i) {
      result[attrs[i].name] = attrs[i].value;
    }
  }
  return result;
}
