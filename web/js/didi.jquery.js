(function( $ ) {
  
"use strict";

$.fn.exists = function() {
  return this.get(0) != undefined;
}

$.fn.hasAttr = function(name) {
  return this.attr(name) !== undefined;
}

$.fn.filterText = function(text) {
  return this.filter(function() {
    return $(this).text() == text;
  });
}

$.fn.setValue = function(val) {
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

  if (typeof val == 'string')  val = dd.escapeHtml(val, this.attr('parseHtml'), this.attr('escapeHtml'));
  if (this.hasAttr('value'))
    return this.attr('value', val).val(val);
  return this.html(val);
}

$.fn.getValue = function() {
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

$.fn.value = function(val) {
  if (val === undefined) return this.getValue();
  return this.setValue(val);
}


$.fn.updateCheckGroupValue = function() {
  var data = [];
  this.find('input[type=checkbox]').each(function() {
    if ($(this).is(':checked'))
       data.push($(this).attr('check'));
  });
  return this.attr('chosen', data.join());
}

$.fn.values = function() {
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


$.fn.send = function(url, options, callback) {
  if (options instanceof Function) {
    callback = options;
    options = undefined;
  }
  var data = $(this).values();
  if (options !== undefined)
    data = $.extend({}, options.data, data);

  options = $.extend({}, options, {data: data});
  return dd.send(url, options, callback);
}

$.fn.json = function(url, options, callback) {
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


$.fn.setChildren = function(result, server) {
  var self = this;
  if (result === null) return;
  $.each(result, function(key, val) {
    var obj = self.find("#"+key+",[name='"+key+"']");
    if (server) obj.attr('server', val);
    obj.setValue(val);
  });
  return this;
}

$.fn.loadChildren = function(url, data, callback) {
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

$.fn.insertAtCursor = function(myValue) {
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

$.fn.customCreate = function(options) {
  var create = options.create;
  if (create === undefined) return;
  this.attr('customCreate',create);
  this.run(create, options);
}

$.fn.run = function() {
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

// Gary Haran => gary@talkerapp.com
// This code is released under MIT licence
$.fn.replace = function(finder, replacement, blackList) {
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

  return this.each(function() {
    replacer(finder, replacement, $(this).get(0), blackList);
  });
}


$.fn.valueFromCurrency = function() {
  return this.value().replace(/[^\d.]/g,'');
}
// from stackoverflow: Anurag
$.fn.bindFirst = function(name, fn) {
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
  $.showPage(options, this).done(function(obj, result, field) {
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

$.fn.enableWhen = function(condition) {
  if (condition())
    this.attr('disabled', 'disabled');
  else
    this.removeAttr('disabled');
}

$.fn.enableOnSet = function(controls, events) {
  this.attr('disabled','disabled');
  controls = $(controls).filter(':visible').filter('input,select,textarea');
  var self = this;
  controls.bind('keyup input cut paste click change onClose', function() {
    var set = 0;
    controls.each(function() {
      if ($(this).val() != '') ++set;
    });
    if (set < controls.length)
      self.attr('disabled', 'disabled');
    else
      self.removeAttr('disabled');
  });
}

$.send = function(url, options, callback) {
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

$.loadPage = (options, parent) => {
  if (parent == undefined) parent = $('body');
  var defer = $.Deferred();
  var path = options.path;
  if  (path[0] === '/') path=options.path.substr(1);
  var data = $.extend({key: options.key}, options.request, {path: path, action: 'read'});
  $.json('/', { data: data }, function(result) {
    parent.trigger('server_response', result);
    if (!result.path) return;
    result.values = $.extend({}, options.values, result.values );
    defer.resolve(result,options);
  });
  return defer.promise();
}

$.createPage = (options, data, parent) => {
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

$.showPage = (options, parent, data) => {
  if (parent == undefined) {
    parent = options.parent? $(parent): $('body');
  }
  var defer = $.Deferred();
  var createPage = function(result, options) {
    var object = $.createPage(options, result, parent);
    if ($.isPlainObject(result.fields.parent))
      parent.setClass(result.fields.parent.class);      
    defer.resolve(object,result,options);
  };

  if (data)
    createPage(data, options);
  else
    $.loadPage(options, parent).done(createPage);    
  return defer.promise();
}

$.showDialog = (path, field) => {
  if (path[0] === '/') path = path.substr(1);
  var params = $.extend({ path: path }, field);
  var defer = $.Deferred();

  $.loadPage({path: '/modal', show: false}).done(function(modal, options) {
    var tmp = $("<div>");
    $.showPage(params, tmp).done(function(obj, page) {
      if (page.fields.modal) modal.fields = dd.merge(modal.fields, page.fields.modal);
      if (modal.fields.title_bar) dd.replaceVars(page.fields, modal.fields.title_bar, {recurse: true});
      if (modal.fields.close_button) dd.replaceVars(page.fields, modal.fields.close_button, {recurse: true});
      modal = $.createPage(options,modal);
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


$.closeDialog = (dialog, message) => {
  if (message) alert(message);
  var parent = dialog.closest('.modal');
  parent.trigger("closing");
  if (parent.exists()) parent.remove();
},


$.json = (url, options, callback) => {
  if (options instanceof Function) {
    callback = options;
    options = {dataType: 'json'};
  }
  else options = $.extend(options, {dataType: 'json'});
  return $.send(url, options, callback);
}

$.scrollbarWidth = () => {
  var parent, child, width;

  parent = $('<div style="width:50px;height:50px;overflow:auto"><div/></div>').appendTo('body');
  child=parent.children();
  width=child.innerWidth()-child.height(99).innerWidth();
  parent.remove();

  return width;
}

$.loadLink = (link, type) => {
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
}


} (jQuery) );
