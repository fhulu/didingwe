mkn.links = {};
mkn.model = {};

mkn.render = function(options)
{
  var me = this
  me.invoker = options.invoker;
  var types = me.types = options.types;
  me.id = options.id;
  me.page_id = options.id;
  me.options = options;
  me.sink = undefined;
  me.parent = options.parent;
  me.known = {};
  me.root = {};
  me.request = options.request;
  me.model_src = options.model_src;
  me.model_funcs = options.model_funcs;

  var array_defaults = [ 'type', 'types', 'template', 'action', 'attr', 'wrap', 'default'];
  var geometry = ['left','right','width','top','bottom','height', 'line-height','max-height', 'max-width'];

  var mutable = function(field) {
    return field.mutable || field.mutable === undefined || field.mutable !== false;
  }

  var mergeTypeArray = function(array)
  {
    var result = {};
    for (var i in array) {
      var type = array[i];
      var merged = me.mergeType(types[type], undefined, type);
      result = mkn.merge(result, merged);
    }
    return result;
  }

  this.mergeType = function(field, type, id)
  {
    if (field === null || field === undefined || types === undefined) return field;
    if (type === undefined) type = field.type;
    if (type === undefined && field.html === undefined) {
      if (!id) id = field.id;
      var cls;
      if (id) cls = id.replace(/_/g, '-');
      if (field.classes) {
        type = 'control';
        if (types[field.classes])
          type = field.classes;
        else field.tag = field.classes;
        if (cls) field.class = mkn.appendArray(field.class, cls);
      }
      else if (field.templates) {
        type = 'template';
        field.tag = field.templates;
        if (cls) field.class = mkn.appendArray(field.class, cls);
      }
      else if (field.tag)
        type = 'control';
    }
    if (type === undefined) return field;
    if (typeof type === 'string')
      type = me.mergeType(types[type], undefined, type);
    else if ($.isArray(type))
      type = mergeTypeArray(type);
    else
      type = me.mergeType(type);

    var result = mkn.merge(type, field);
    delete result.type;
    return result;
  };

  this.expandType = function(type)
  {
    if ($.isPlainObject(type)) return me.mergeType(type);
    if (type.search(/\W/) >= 0) return {html: type};
    return me.mergeType({type: type} );
  };


  var isDefault = function(item)
  {
    for (var i in array_defaults) {
      var name = array_defaults[i];
      if (item[name] !== undefined) return true;
    }
    return false;
  }

  var mergeImmutables = function(item, base, type) {
    var immutables = type.immutable;
    for (var i in immutables) {
      var key = immutables[i];
      if (base[key] !== undefined && item[key] === undefined) item[key] = base[key];
    }
  }

  var mergeDefaultType = function(base, item, type) {
    type = mkn.copy(type);
    mergeImmutables(item, base, type);
    base = mkn.copy(base);
    mkn.deleteKeys(base, ['type', 'styles', 'style'])
    mkn.deleteKeys(base, geometry)
    return mkn.merge(mkn.merge(type,base), item);
  }

  var mergeDefaults = function(item, defaults, base) {
    if (!item.action && defaults.action) item.action = defaults.action;
    if (defaults.attr) item.attr = mkn.merge(item.attr,defaults.attr);
    if (!item.template) item.template = defaults.template;
    if (defaults.default) item = mkn.merge(defaults.default, item);
    if (defaults.types)
      return mergeDefaultType(base, item, defaults.types.shift());
    else if (!item.type && defaults.type)
      return mergeDefaultType(base, item, defaults.type);
    return mkn.merge(base, item);
  }


  var removePopped = function(items, popped) {
    var i = items.length;
    while (i--) {
      var item = items[i];
      if (popped.indexOf(item.id) >= 0 || item.id == 'pop')
        items.splice(i,1);
    }
}

  var insertPushed = function(items, pushed) {
    for (var i in pushed) {
      var item = pushed[i];
      var push = item.push;
      delete item.push;
      var pos = items.indexOf(item);
      item = mkn.copy(item);
      items.splice(pos, 1);
      if (push === 'first')
        items.unshift(item);
      else if (push === 'last')
        items.push(item);
      else if (push == 'merge') {
       pos = mkn.firstIndexOfKey(items, 'id', item.id);
       items[pos] = mkn.merge(items[pos], item);
      }
      else
        items.splice(mkn.firstIndexOfKey(items, 'id', push), 0, item);
    }
  }

  var pushPop = function(items) {
    var pushed = [];
    var popped = [];
    for(var i in items) {
      var item = items[i];
      if ($.isArray(item)) continue;
      if (item.id == 'pop')
        popped.push(item.name);
      else if (item.push)
        pushed.push(item);
      items[i] = item;
    }
    removePopped(items, popped);
    insertPushed(items, pushed);
  }

  var objectify = function(items) {
    for (var i in items) {
      var item = items[i];
      if ($.isArray(item) && item.length == 1) item = item[0];
      if (typeof item=='string') {
        try {
          var parsed = JSON.parse(item);
          item = parsed;
        }
        catch (e) {
          item = mkn.toObject(item);
        }
      }
      if (!$.isPlainObject(item)) continue;
      var id = item.id;
      if (id === undefined) {
        var a = mkn.firstElement(item);
        id = a[0];
        if (array_defaults.indexOf(id) >=0 ) continue;
        item = a[1];
        if (typeof item == 'string') item = { name: item}
        item = $.extend({}, item);
      }
      if (typeof item === 'string') item = { name: item }
      item.id = id;
      items[i] = item;
    }
  }

  var mergeSubItems = function(parent,items) {
    for(var i=0; i < items.length; ++i) {
      var item = items[i];
      if (!$.isPlainObject(item) || item.id !== 'merge') continue;
      var array = parent[item.name];
      if (!array) continue;
      items.splice(i,1);
      objectify(array);
      array.forEach(function(value, j) {
        items.splice(i+j,0,value);
      });
    }
  }

  this.expandFields = function(parent_field, name, items, defaults)
  {
    if (!defaults) defaults = { template: "$field" };
    var path = parent_field.path? parent_field.path + '/' + name: name;
    objectify(items);
    pushPop(items);
    mergeSubItems(parent_field,items);
    var wrap;
    var sow = parent_field.sow;
    var removed = [];
    var index = 0;
    for(var i in items) {
      var item = items[i];
      var id;
      var array;
      var template;
      removed.push(i);
      if ($.isPlainObject(item)) {
        if (setDefaults(defaults, item, parent_field)) continue;
        id = item.id;
        if (id == 'query') {
          item.defaults = mkn.copy(defaults);
        }

        if (id[0] == '$') {
          id = id.substr(1);
          item = mkn.merge(parent_field[id], item);
        }
        id = me.expandValue(parent_field, id);
        if (sow && sow.indexOf(id) >=0)
          item = mkn.merge(parent_field[id], item);
        promoteAttr(item);
        var base = mkn.copy(me.types[id]);
        var merged = mkn.merge(base, item);
        item.id = id;
        if (mutable(merged))
          item = mergeDefaults(item, defaults, base);
        else
          item = merged;
      }
      else if ($.isArray(item)) {
        array = item;
        id = item[0];
        item = mkn.copy(defaults);
        item.array = array;
      }
      else {
        console.log("Unhandled item", item, parent_field);
      }
      item.id = id;

      if (path && !item.path)
        item.path = path + '/' + id;
      var template = item.template;
      if (template == 'none' || template  == '$field')
        delete item.template;
      else if (typeof template == 'string') {
        var def = {};
        setDefaults(def, {template: template}, parent_field);
        item.template = def.template;
      }
      if (defaults.wrap) {
        item.wrap = defaults.wrap;
        item.wrap.id = name;
        item.wrap = this.initField(item.wrap, parent_field);
        delete defaults.wrap;
      }

      item = $.extend({ index: index, number: index+1},item);
      ++index;
      item = this.initField(item, parent_field);

      if (item.template) initTemplate(item)
      items[i] = item;
      removed.pop();
    }

    for (var i in removed) {
      items.splice(removed[i]-i,1);
    }
  }

  var isTemplate = function(t)
  {
    return t !== undefined && t !== "none" && t !== '$field';
  }

  var initTemplate = function(item)
  {
    template = item.template;
    var field = mkn.copy(me.mergeType(item));
    if (typeof template === 'string') {
      template = {html: template};
    }
    else {
      template = me.mergeType(mkn.copy(template));
      mkn.deleteKeys(field, ['type', 'attr', 'action', 'class', 'tag', 'html',
       'style', 'styles', 'create','classes','template', 'templates', 'text', 'templated', 'didi-functions']);
       mkn.deleteKeys(field, geometry);
       if (!('attr' in template)) template.attr = {};
       template.attr['for'] = item.id;
    }
    for (var key in field) {
      if (key.indexOf('on_') == 0) delete field[key];
    }
    item.template = me.initField(mkn.merge(template, field));
    item.template.id = "";
  };

  this.expandFunction = function(value, parent_id)
  {
    var matches = /(copy|css)\s*\((.+)\)/.exec(value);
    if (!matches || matches.length < 1) return value;
    var source = matches[2];
    if (matches[1] === 'copy')
      source = '#'+source+' #'+parent_id+',[name='+source+'] #'+parent_id;
    return $(source).value();
  }


  var getArray = function(val) {
    if (!val || $.isPlainObject(val)) return [];
    if (!$.isArray(val)) val  = [val];
    return val;
  }

  var substArray = function(field, val) {
    return getArray(val).map(function(val) {
      var matches = getMatches(val, /\$(\w+)/g)
      for (var j in matches) {
        var match = matches[j];
        var value = field[match];
        if (value === undefined || typeof value !== 'string') continue;
        val = val.replace('$'+match, value);
      }
      return val;
    })
  }

  this.expandValue = function(values,value)
  {
    $.each(values, function(code, subst) {
      if ($.isNumeric(code) || typeof subst !== 'string' || typeof value !== 'string') return;
      value = value.replace(new RegExp('\\$'+code+"([^\w]|\b|$)", 'g'), subst+'$1');
      values[code] = subst;
      if (value.indexOf('$') < 0) return;
    });
    return value;
  }

  this.expandValues = function(data, parent_id, exclusions)
  {
    if (!data) return data;
    if (parent_id === undefined) parent_id = data.id;
    var expanded;
    var count = 0;
    if (!exclusions) exclusions = [];
    var constants = $.isArray(data.constants)? data.constants: [];
    exclusions = exclusions.concat(constants);
    do {
      expanded = false;
      for (var field in data) {
        var value = data[field];
        if ($.isNumeric(value)) continue;
        if ($.isArray(value)) data[field] = substArray(data, value);
        if (typeof value !== 'string' || value.indexOf('$') < 0 || exclusions.indexOf(field) >=0) continue;
        var old_value = value = value.replace('$id', parent_id);
        data[field] = value = me.expandValue(data, value, parent_id);
        expanded = old_value !== value;
      }
    } while (expanded);
    return data;
  }

  this.expandArray = function(item)
  {
    if (item.expand_data) {
      item[item.expand_data] = item[item.expand_data].concat(item.array);
      delete item.array;
      return;
    }
    $.each(item, function(key, value) {
      var matches = getMatches(value, /\$(\d+)/g);
      for (var i in matches) {
        var index = parseInt(matches[i]);
        value = value.replace(new RegExp("\\$"+index+"([^\d]|\b|$)", 'g'), item.array[index-1]+'$1');
      }
      item[key] = value;
    });
  }


  this.parentSow =  function(parent, field)
  {
    if (!parent || !parent.sow) return field;
    for (var i in parent.sow) {
      var key = parent.sow[i];
      var sowed = {};
      sowed[key] = parent[key];
      field = mkn.merge(sowed, field);
    }
    return field;
  }

  var deriveParent = function(parent, field)
  {
    if (!parent) return;
    if (!field.parent_id) field.parent_id = parent.id;
    if (!field.parent_name) field.parent_name = parent.name;
    for (var i in field.derive) {
      var key = field.derive[i];
      var value = field[key];
      if (value === undefined)
        field[key] = parent[key];
      else if ($.isPlainObject(value) || $.isArray(value))
        field[key] = mkn.merge(parent[key], value);
      else if (value[0] == '$')
        field[key] = parent[value.substr(1)];
    }
  }


  this.initField = function(field, parent)
  {
    field.page_id = this.page_id;
    if (field.template && field.template.subject) {
      field = mkn.merge(field.template.subject, field);
      if (!field.template.tag) delete field.template;
    }
    deriveParent(parent, field);
    field = this.parentSow(parent, field);
    field = this.mergeType(field);

    var id = field.id;
    if (field.array && field.array.length>1 && field.name === undefined) field.name = field.array[1];
    if (id && field.name === undefined)
      field.name = toTitleCase(id.replace(/[_\/]/g, ' '));
    if (field.array)
      this.expandArray(field);
    else
      field = removeSubscripts(field);

    var exclusions = ['template','attr', 'text', 'html'];
    this.expandValues(field, field.id, exclusions );
    if (field.template && field.template.subject) {
      deriveParent(field.template, field);
      this.expandValues(field, field.id, exclusions);
    }
    return field;
  }


  var isTableTag = function(tag)
  {
    return ['table','thead','th','tbody','tr','td'].indexOf(tag) >= 0;
  }

  var runJquery = function (obj, item) {
    if (!item.jquery) return;
    mkn.replaceVars(item,item.params);
    obj.call(item.jquery, item.params);
  }

  var setVisible = function(obj, field) {
    if (field.template) return;
    mkn.toIntValue(field, 'show');
    mkn.toIntValue(field, 'hide');
    if (field.hide || field.show === false || field.show === 0)
      obj.hide();
    else if (field.show)
      obj.show();
  }

  var setDisabled = function(obj, field) {
    if (mkn.toIntValue(field, 'disabled') && field);
      obj.prop('disabled', field.disabled);
  }

  this.render = function(parent, key) {
    var field = parent[key] = me.initField(parent[key], parent);
    me.root_field = field;
    var obj = me.root = me.create(parent, key);
    me.initModel(obj, field);
    return obj;
  }

  var setResponsive = function(obj, field) {
    var responsive = field.responsive;
    if (!responsive) return;
    var queries = {
      small: 'screen and (max-width:600px)',
      medium: 'screen and (min-width:601px) and (max-width:992px)',
      large: 'screen and (min-width:993px)'
    };
    for (var size in queries) {
      var classes = responsive[size];
      if (!classes) continue;
      enquire.register(queries[size], {
        match: function() { obj.addClass(classes.join(' ')); },
        unmatch: function() { obj.removeClass(classes.join(' ')); }
      });
    }

  }

  var setStyling = function(obj, field) {
    if (!$.isPlainObject(field))
      return obj.setClass(field);

    setVisible(obj, field);
    setDisabled(obj, field);
    setResponsive(obj, field);
    setAttr(obj, field);
    setClass(obj, field);
    setStyle(obj, field);
  };

  this.create =  function(parent, key, init, parent_obj)
  {
    var field = parent;
    if (typeof key == 'string' || $.isNumeric(key)) {
      field = parent[key];
      if (!field) field = types[key];
    }
    else if ($.isPlainObject(key))
      field = key;
    if (init === undefined || init) field = this.initField(field, parent);
    if (field.parent_page === undefined) field.parent_page = me.id;
    if (field.sub_page) {
      var tmp = $('<div>loading...</div>');
      this.createSubPage(parent[key], tmp);
      return tmp;
    }
    var id = field.id;
    if (field.html === undefined) return null;
    field.text = this.expandValue(field, field.text);
    field.html = this.expandValue(field, field.html);
    field.html = field.html.trim().replace(/\$tag(\W)/, field.tag+'$1');
    var table_tag = isTableTag(field.tag);
    var obj = table_tag? $('<'+field.tag+'>'): $(field.html);

    if (field.is_body)
      obj = $('body').append(obj.html());
    if (this.sink === undefined) this.sink = obj;
    var reserved = ['id', 'create', 'css', 'script', 'name', 'desc', 'data'];
    setModelFunctions(obj,field);
    if (field.key === undefined) field.key = options.key;
    var values = $.extend({}, this.types, field);
    var matches = getMatches(field.html, /\$(\w+)/g);
    var subitem_count = 0;
    for (var i = 0; i< matches.length; ++i) {
      var code = matches[i];
      var value = values[code];
      if (value === undefined) continue;
      if (typeof value === 'string' && value.search(/\W/) < 0 && reserved.indexOf(code) < 0) {
        value = values[value] || value;
      }

      if ($.isArray(value)) {
        if (this.types[code] !== undefined)
          value = $.merge($.merge([], this.types[code]), value);
        this.expandFields(field, code, value);
        subitem_count += this.createItems(obj, field, code, value);
        continue;
      }

      if (!$.isPlainObject(value)) {
        obj.replace(new RegExp('\\$'+code+"([^\w]|\b|$)?", 'g'), value+'$1');
        this.known[code] = value;
        continue;
      }

      if (!value.path) value.path = field.path+'/'+code;
      if (value.id === undefined) value.id = code;
      value.parent_page = field.parent_page;
      var child = this.create(field, code, true);
      if (table_tag)
        obj.append(child)
      if (field.html == '$'+code)
        obj.html('').append(child);
      else
        this.replace(obj, child, code);
    }
    if (obj.attr('id') === '') obj.removeAttr('id');

    obj.data('didi-field', field);
    setStyling(obj, field);
    if (field.parent && parent_obj) {
      setStyling(parent_obj, field.parent);
    }

    runJquery(obj, field);
    if ('didi-functions' in field) obj.addClass('didi-watcher');
    field['mkn-object'] = obj;

    if ($.isPlainObject(field.position))
      obj.position(field.position);

     initLinks(obj, field).then(function() {
      if (subitem_count) me.setValues(obj, field);
      initEvents(obj, field);
      obj.triggerHandler('created', [field]);
    });

    if (typeof key === 'string' || $.isNumeric(key)) parent[key] = field;
    return obj;
  }

  this.createSubPage = function(field, target, selector)
  {
    if (target == undefined)
     target = $('<span>').text('loading...');
    delete field.sub_page;
    delete field.appendChild;
    field.path = field.url? field.url: field.id;
    return mkn.showPage($.extend({request: options.request}, field), target).done(function(obj, result, field) {
      setStyle(obj, field);
      setClass(obj, field);
      setResponsive(obj, field);
      target.trigger('dying');
      target.replaceWith(obj);
      if (!selector) return;
      var classes = selector.regexCapture(/(\.[\w-][\w-\.]*)$/g);
      if (classes.length) obj.addClass(classes[0].replace('.', ' '));
    });
  }

  this.createItems = function(parent, parent_field, name, items, defaults)
  {
    var loading_data = false;
    var regex;
    if (name !== undefined && parent_field.html.trim() !=='$'+name && !isTableTag(parent_field.tag))
      regex = new RegExp('(\\$'+name+')');
    var new_item_name = '_new_'+name;
    var new_item_html = '<div id="'+new_item_name+'"></div>';
    var wrap;
    var count = 0;
    for(var i in items) {
      var item = items[i];
      var id = item.id;
      if (id == 'query') {
        if (loading_data) continue;
        loading_data = true;
        this.loadData(parent, parent_field, name, item.defaults);
        continue;
      }
      ++count;
      if (regex)
        parent.replace(regex,new_item_html+'$1');
      var templated;
      var obj = this.create(items, i);
      if (item.template && (templated = this.create(item, 'template'))) {
        if (isTableTag(item.template.tag))
          templated.append(obj);
        else
          this.replace(templated, obj, id, 'field');
        if (item.parent)
          setStyling(templated, item.parent);
      }
      else {
        templated = obj;
        delete item.template;
      }
      if (wrap)
        wrap.append(templated);
      else if (item.wrap) {
        wrap = this.create(item, 'wrap');
        wrap.html('');
        parent.find('#'+new_item_name).replaceWith(wrap);
        wrap.append(templated);
        delete item.wrap;
      }
      else if (regex)
        parent.find('#'+new_item_name).replaceWith(templated);
      else
        parent.append(templated);
    }
    if (!loading_data && regex)
      parent.replace(regex, '');
    return count;
  }

  this.replace = function(parent, child, id, field)
  {
    id = id || child.attr('id');
    field = field || id;
    var new_id = "__new__"+id.replace(/[^\w]/g, '_');
    var new_html = "<div id="+new_id+"></div>";
    parent.replace("\\$"+field, new_html);
    parent.find('#'+new_id).replaceWith(child);
    return child;
  }

  this.loadData = function(object, field, name, defaults)
  {
    this.loading++;
    object.on('loaded', function(event, field, result) {
      if (--me.loading === 0)
        me.parent.trigger('loaded', result);
      if (result === undefined || result === null) {
        console.log('No page data result for object: ', me.object, ' field ', field.id);
        return;
      }
      if (defaults.attr === undefined) defaults.attr = {};
      defaults.attr.loaded = '';

      if (object.find('[loaded]').exists()) {
        object.find('[loaded]').replaceWith('$'+name);
      }
      me.expandFields(field, name, result, defaults)
      me.createItems(object, field, name, result, defaults);
      if (me.loading === 0)
        me.parent.trigger('loaded', [field,result]);
    });
    if (field.autoload || field.autoload === undefined) {
      $.json('/', serverParams('data', field.path+'/'+name, field.params), function(result) {
        me.respond(result, object);
        object.trigger('loaded', [field, result.data]);
      });
    }

    object.on('reload', function(event, data) {
       field.autoload = true;
       field.params = data;
       me.loadData(object, field, name, defaults);
       if (field.values)
         me.loadValues(object, field);
     })
  };

  var serverParams = function(action, path, params)
  {
    if (!path) path = me.path;
    return { data: $.extend({}, options.request, {key: options.key}, params,
      {action: action, path: path })};
  }

  var initTooltip = function(obj) {

  }

  function initTimeEvents(obj, field) {
    var functions = {every: 'Interval', after: 'Timeout' };
    for (var key in functions ) {
      if (!(key in field)) continue;
      mkn.replaceVars(field, field[key], {recurse: true, sourceFirst: true});
      var args = [field[key].slice(1)];
      var timer = window['set'+functions[key]](function() {
        accept(undefined, obj, field, args);
      }, field[key][0]);
      obj.data(key, timer);
    }
    obj.on('remove', function() {
      for (var key in functions ) {
        if (!(key in field)) continue;
        window['clear'+functions[key]](obj.data(key));
      }
    });
  }

  var initListeners = function(obj, field) {
    if (!field.listen) return;
    var events = $.isArray(field.listen)? field.listen: [field.listen];
    $.each(events, function(i, event) {
      obj.on(event, function() {
        obj.trigger(event + '_' + field.id);
      });
    })
  }

  var initOnEvents = function(obj, field) {
    var events = {};
    if (field.action)
      events['click'] = [field];
    var id = field.id;
    initListeners(obj, field);
    $.each(field, function(key, value) {
      if (key.indexOf('on_') != 0) return;
      var event = key.substr(3);
      if (!(event in events)) events[event] = [];
      if ($.isArray(value))
        events[event] = events[event].concat(value);
      else
        events[event].push(value);

      if (!obj.hasClass('didi-listener')) obj.addClass('didi-listener')
    });
    if ($.isEmptyObject(events)) return;
    $.each(events, function(key, values) {
      $.each(values, function(i, value) {
        if ($.isPlainObject(value) && !value.path) value.path = field.path + '/on_' + key;
        var sink = obj;
        if (obj.is('body') && ['scroll','resize'].indexOf(key) >= 0) sink = $(window);
        var handler_name = 'on_'+key.replace(/\W/g, '_');
        var event_pair = key.split('@');
        var event_name = event_pair[0];
        var selector = event_pair.length>1? event_pair[1]: null;
        sink.on(event_name, selector, function(e) {
          if (obj.hasClass('disabled')) return;
          // ignore default action of an anchor
          if (event_name == 'click' && obj.prop("tagName").toLowerCase() == 'a') {
            e.preventDefault();
            if (field.url === undefined) field.url = obj.attr('href');
          }
          if ($.isPlainObject(value)) {
            var params = Array.prototype.slice.call(arguments, 1);
            value.params = mkn.merge(value.params, params);
            mkn.replaceVars(value, value.params);
            accept(e, obj, value);
          }
          else if ('didi-model' in field && handler_name in field['didi-model']) {
            var handler = me.model[handler_name+"_"+ id];
            if (handler)
              handler.apply(obj, arguments);
            me.updateWatchers();
          };
        });
      });
    });
  }


  var initEventTraps = function(obj, field) {
    var traps = getArray(field.trap);
    $.each(traps, function(i, trap) {
      obj.on(trap, function(e) {
        e.stopPropagation();
      })
    })
  }

  var initEventTriggers = function(obj, field) {
    var triggers = getArray(field.triggers);
    if (!triggers.length) return;
    obj.on('click', function(e) {
      if (obj.is($(e.target))) $.each(triggers, function(i, action) {
        obj.trigger(action);
      });
    })
  }

  var initClassToggle = function(obj, field) {
    var args = getArray(field.toggles);
    var class1, class2, event = 'click';
    switch(args.length) {
      case 0: return;
      case 1: class1 = args[0]; break;
      case 2: class1 = args[0]; class2 = args[1]; break;
      default: class1 = args[0]; class2 = args[1]; event = args[3];
    }
    obj.on(event, function() {
      if (class1==class2)
        obj.toggleClass(class1);
      else if (obj.hasClass(class1))
        obj.removeClass(class1).addClass(class2);
      else
        obj.removeClass(class2).addClass(class1);
    })
  }

  var initEventClasses = function(obj, field) {
    var events = field.events;
    if (!events) return;
    obj.on(Object.keys(events).join(' '), function(e) {
      obj.setClass(events[e.type]);
    });
  }

  var initEvents = function(obj, field) {
    initClassToggle(obj, field);
    initEventClasses(obj, field);
    if ('attr' in field && field.attr.for == field.id) return;
    initEventTriggers(obj, field)
    initEventTraps(obj, field);
    initTimeEvents(obj, field);
    initOnEvents(obj, field);
    if (typeof field.enter == 'string') {
      obj.keypress(function(event) {
        if (event.keyCode === 13)
          obj.find(field.enter).click();
      })
    }
    field.page_id = me.page_id;
    obj.on('reload', function(e, data) {
      field.params = data;
      loadValues(obj, field);
    })
    .on('server_response', function(event, result) {
      event.stopImmediatePropagation();
      me.respond(result);
    })
    initTooltip(obj);

    obj.on('post', function(event, args) {
      field = $.extend({}, field, { action: 'post', params: [args] });
      accept(event, $(this), field);
    });

    // handle input change model
    var tag = obj.prop("tagName");
    if (!tag || ['input','select','textarea'].indexOf(tag.toLowerCase()) < 0) return;

    var id = getModelId(field)
    obj.on('keyup input cut paste change', function() {
      var func = me.model["set_"+id];
      if (!func || func($(this).value()))
      	me.updateWatchers();
    });
  };

  var initLinks = function(object, field)
  {
    return $.when(loadLinks('css', field),loadLinks('script', field)).then(function(x,y){
      if (field.create)
        object.customCreate($.extend({render: me}, field));
    });
  };

  var setAttr = function(obj, field)
  {
    mkn.replaceVars(field, field.attr, { sourceFirst: true, recurse: true})
    var attr = field.attr;
    if (obj.attr('id') === '') obj.removeAttr('id');
    if (!attr) return;
    if (typeof attr === 'string') {
      obj.attr(attr,"");
    }
    else $.each(attr, function(key, val) {
      if (field.array) {
        var numeric = getMatches(val, /\$(\d+)/g);
        if (numeric.length) val = field.array[numeric[0]-1];
      }
      var matches = getMatches(val, /\$(\w+)/g)
      for (var j in matches) {
        var match = matches[j];
        var value = field[match];
        if (value === undefined || typeof value !== 'string') continue;
        val = val.replace('$'+match, value);
      }
      obj.attr(key,val);
    });
    if (obj.attr('id') === '') obj.removeAttr('id');
  }

  var setClass = function(obj, field) {
    obj.setClass(substArray(field, field.class));
  }


  var setStyle = function(obj, field)
  {
    var immutable = field.immutable;
    var mergeStyles = function() {
      if (typeof styles == 'string')
        styles = me.mergeType({}, styles.split(/[\s,]+/));
      for (var i in styles) {
        var type = me.mergeType({}, styles[i]);
        mkn.deleteKeys(type, immutable);
        $.extend(style, type);
      }
    }

    var setGeometry = function() {
      for (var i in geometry) {
        var key = geometry[i];
        if (immutable && immutable.indexOf(key) >= 0) continue;
        var val = field[key];
        if (val !== undefined && val[0] !== '$')
          style[key] = val;
      }
    }

    var style = field.style;
    if (!style) style = {};
    styles = field.styles;
    if (styles) mergeStyles();
    mkn.replaceVars(field, style, { sourceFirst: true, recurse: true})
    mkn.replaceVars(style, style, { sourceFirst: true, recurse: true})
    setGeometry();
    obj.css(style);
  }

  var removeSubscripts = function(item)
  {
    var removed = [];
    $.each(item, function(key, value) {
      if (typeof value !== 'string') return;
      if (value.match(/^\$\d+$/)) removed.push(key);
    })
    mkn.deleteKeys(item, removed);
    return item;
  }

  var expandSubject = function(template)
  {
    var subject = template.subject
    for (var key in subject) {

    }
  }

  var mergePrevious = function(defaults, name, value)
  {
    var prev = defaults[name];
    if ($.isPlainObject(prev))
      value = mkn.merge(prev, value);
    else if (typeof value == 'string')
      value.type = prev;
    return value;
  }

  var setDefaults = function(defaults, item, parent)
  {
    if (mkn.size(item) != 1) return false;
    var sow = parent.sow;
    var set = false;
    for (var i in array_defaults) {
      var name = array_defaults[i];
      var value = item[name];
      if (value === undefined) continue;
      if (value[0] == '$')
        value = parent[value.substring(1)];
      if (value === undefined) continue;
      if (sow && sow.indexOf(value) >=0 )
        value = mkn.merge(parent[value], defaults[name]);
      if (name === 'template' && value === 'none')
        value = '$field';
      else if (name === 'wrap' && $.isPlainObject(value))
        value = $.extend({}, {tag: 'div'}, value);
      else if (name === 'type' || name === 'template' || name === 'wrap') {
        if (value === undefined) { console.log("undefined value", name, item)}
        value = me.expandType(value);
      }
      else if (name === 'types') {
        var types = [];
        for (var i in value) {
          types.push(me.expandType(value[i]));
        }
        value = types;
      }
      if (name == 'template' && $.isPlainObject(item[name]) && item[name].type === undefined) {
        value = mergePrevious(defaults, name, me.initField(value));
        mkn.replaceVars(value, value.subject, { recurse: true});
      }

      defaults[name] = value;
      set = true;
    }

    promoteAttr(defaults);
    return set;
  }

  var loadLinks = function(type, field)
  {
    var links = field[type];
    if (typeof links === 'string')
      links = links.split(',');
    if (links === undefined || links === null || links.length==0) return $.when();
    return $.when.apply($, $.map(links, function(link) {
      return mkn.loadLink(link, type);
    }));
  }

  var promoteAttr = function(field)
  {
    var attr = field.attr;
    if (attr === undefined || $.isPlainObject(attr)) return;
    var val = {};
    val[attr] = attr;
    field.attr = val;
    return field;
  }

  var redirect = function(field)
  {
    if (!$.isPlainObject(field)) field = { url: field };
    mkn.replaceVars(field,field);
    var url = field.url;
    if ((!url || field.query) && field.target === '_blank') {
      url = '/?action=action';
      field = $.extend({key: options.key}, field);
      var exclude = ['action', 'desc', 'html', 'id', 'name', 'page_id', 'query', 'selector','tag', 'target','text', 'type', 'template']
      for (var key in field) {
        var val = field[key];
        if ($.isPlainObject(val) || $.isArray(val) || exclude.indexOf(key) >= 0) continue;
        url += '&'+key+'='+encodeURIComponent(field[key]);
      }
    }
    if (!url) return;
    if (field.target === '_blank')
      window.open(url, field.target);
    else if (field.target) {
      mkn.closeDialog(me.sink);
      me.createSubPage({url: url, key: field.key}, $(field.target), field.target);
    }
    else
      document.location = url;
  }


  var accept = function(event, obj, field, action)
  {
    field.page_id = field.page_id || obj.closest(".page").attr('id');

    var trigger_post_result = function(result) {
      var type = result && $.isPlainObject(result._responses) && 'errors' in result._responses ? 'error': 'success';
      obj.trigger('post_'+type, [result]);
    }

    var dispatch_one = function(action) {
      var params = [];
      if ($.isArray(action)) {
        params = action.slice(1);
        action = action[0];
      }
      switch(action) {
        case 'page': mkn.showPage(field); return;
        case 'dialog': mkn.showDialog(field.url, $.extend({key: field.key}, params[0])); return;
        case 'close_dialog': mkn.closeDialog(obj); break;
        case 'redirect': redirect(field); break;
        case 'post':
          var url = field.url? field.url: field.path;
          if (!field.params) field.params = [];
          params = serverParams('action', url, $.extend({key: field.key}, params[0], field.params[0]));
          if ($.isArray(field.params)) params = $.extend({}, params, field.params[0]);
          var selector = field.selector;
          if (selector !== undefined) {
            selector = selector.replace(/(^|[^\w]+)page([^\w]+)/,"$1"+field.page_id+"$2");
            params = $.extend(params, {invoker: obj, event: event, async: true, post_prefix: field.post_prefix });
            me.sink.find(".error").remove();
            me.sink.find(".in-error").unsetClass('in-error').trigger('clear-error');
            obj.trigger('posting', [params]);
            $(selector).json('/', params, function(result) {
              trigger_post_result(result);
              me.respond(result, obj, event);
            });
            break;
          }
          me.sink.find(".error").remove();
          me.sink.find(".in-error").removeClass('in-error').trigger('clear-error');
          obj.trigger('posting', [params]);
          obj.trigger('posting');
          $.json('/', params, function(result) {
            trigger_post_result(result);
            me.respond(result, obj);
          });
          break;
        case 'trigger':
          trigger(field, obj);
          break;
        default:
          if (action && action[0] == '.')
            obj[action.substring(1)].apply(obj,params);
      }
    }

    var dispatch = function() {
      if (action === undefined) action = field.action;
      if ($.isArray(action))
        action.forEach(dispatch_one);
      else
        dispatch_one(action);
    }
    if (!field.confirmation || action)
      dispatch();
    else mkn.showDialog('/confirm_dialog').done(function(dialog) {
      if (typeof field.confirmation == 'string')
        dialog.find('#message').text(field.confirmation);
      dialog.find('.action').click(function() {
        mkn.closeDialog(dialog);
        if ($(this).attr('action') === 'yes') dispatch();
      })
    });
  }

  var reportError = function(field, error)
  {
    if (field == "alert") {
      alert(error);
      return;
    }
    var subject = me.sink.find('#'+field+",[name='"+field+"']");
    var parent;
    if (subject.hasClass('error-sink')) {
      parent = subject;
    }
    else {
      var parents = subject.parents(".error-sink");
      if (!parents.exists()) parents = subject.parents("[for='"+field+"']");
      parent = parents.exists()? parents.eq(0): subject;
    }
    subject.trigger('errors', [error]);
    parent.addClass('in-error').attr('error-message', error);
    if (parent.hasClass('no-error-box') || subject.hasClass('no-error-box')) return;

    var box = $("<div class=error>"+error+"</div>");
    parent.after(box);
    var zIndex = parseInt(parent.css('z-index'));
    box.css('z-index', zIndex+1);
    box.fadeIn('slow').click(function() { $(this).fadeOut('slow') });
  }

  var reportErrors = function(errors, event)
  {
    for (var key in errors) {
      reportError(key, errors[key]);
    }
    if (event) event.stopImmediatePropagation();
  }

  this.respond = function(result, invoker, event)
  {
    if (!result) return;
    mkn.removeXSS(result);
    var responses = result._responses;
    delete result._responses;
    if (!$.isPlainObject(responses)) return this;
    var parent = me.sink;
    if (invoker) {
       parent = invoker.parents('#'+me.page_id).eq(0);
      if (!parent.exists()) parent = me.sink;
    }
    else invoker = parent;


    var handle = function(action, val)
    {
      switch(action) {
        case 'alert': alert(val); break;
        case 'show_dialog': mkn.showDialog(val, responses.options); break;
        case 'close_dialog': mkn.closeDialog(parent, val); break;
        case 'redirect': redirect(val); break;
        case 'update': parent.setChildren(val, true); break;
        case 'trigger': trigger(val, parent); break;
        case 'error': reportError(val); break;
        case 'errors': reportErrors(val); break;
      }
    }

    for (var key in responses) {
      var val = responses[key];
      if (!$.isArray(val))
        handle(key, val);
      else for (var i in val)
        handle(key, val[i]);
    }
  }

  this.setValues = function(parent, data)
  {
    var query_values;
    for (var i in data.values) {
      var item = data.values[i];
      var array = $.isNumeric(i);
      if (array && !$.isPlainObject(item)) continue;
       var id = i, value= item;
      if (array) {
        var el = mkn.firstElement(item);
        id = el[0];
        item = el[1];
      }
      var obj = parent.find(mkn.selector.idName(id));
      if (obj.exists()) {
        obj.value(value);
        continue;
      }
      if (id === "query") query_values = true;
    }
    if (query_values) {
      parent.on('load_values', function(event, data) {
        loadValues(parent, data);
      });
      if (parent.auto_load === undefined || parent.auto_load)
        parent.trigger('load_values', [data]);
    }
  }

  var loadValues =  function(parent, data)
  {
    var params = $.extend({key: data.key}, data.params);
    $.json('/', serverParams('values', data.path, params), function(result) {
      if (!result) return;
      parent.trigger('loaded_values', [result]);
      if ($.isPlainObject(result))
        parent.setChildren(result, true);
      else for (var i in result) {
        parent.setChildren(result[i], true);
      }
      me.updateWatchers();
      me.respond(result);
    });
  }

  var trigger = function(field, invoker)
  {
    if (!field.event) field.event = field.id
    var sink;
    var event = field.event;
    var params;
    if ($.isPlainObject(event)) {
      sink = event.sink;
      me.expandValues(event.parameters, field.id);
      params = event.parameters;
      event = event.name;
    }
    else {
      sink = field.sink;
      params = field.params;
      if (params !== undefined && !$.isArray(params))
        params = [params];
      if (event === 'show' || event  == 'show_hide')
        event = '.toggle';
      if (event == 'toggle' || event == '.toggle' && params !== undefined)
        params = [parseInt(params[0]) === 1 || params[0] === true];
    }

    if (sink) {
      var selector = sink;
      sink = $(sink.replace(/(^|[^\w]+)page([^\w]*)/,"$1"+me.id+"$2"));
      if (!sink.exists())
        sink = window.parent.$(selector);
    }
    else if (invoker)
      sink = invoker;
    else
      sink = $('.didi-listener');
    if (event[0] === '.') {
      sink[event.substring(1)].apply(sink,params);
      return;
    }
    sink.trigger(event, params);
  }

  var getModelId = function(field) {
    return field.attr && field.attr.type =='radio'? field.attr.name: field.id;
  }

  var setModelFunctions = function(obj, field) {

    var funcs = [];
    var index = 0;
    var id = field.id;

    function setInlineExpr(parent, key, value) {
      value = value.trim();
      var exprs;
      if (/^~|\s*function\s*\([^)]*\)/gm.test(value))
        exprs = [value];
      else
        exprs = value.regexCapture(/(`[^`]+`)/g);
      var replaced = false;
      key = key.replace(/\W/g, '_');
      exprs.forEach(function(expr, i) {
        if (!expr) return;
        var src;
        var suffix = "\n\t}";
        var ret = /\breturn\s/gm.test(expr)?"": "\t\treturn ";
        if (key.indexOf('on_') != 0)
          src = "\tget_"+id+"_"+  index+": function(obj) {\n"+ret;
        else if (!/^[~`]?\s*function\s*\(/gm.test(expr))
          src = "\t"+key+"_"+id+": function(event) {\n";
        else {
          src = "\t"+key+"_"+id+": ";
          suffix = "";
        }
        src += expr.replace(/^~|`/g,'') + suffix;
        funcs.push(src);
        value = value.replace(expr, "${"+index+"}");
        replaced = true;
        ++index;
      })
      if (replaced)
        parent['didi-model'][key] = value;

    }

    function setOnHandler(event, scripts) {
      for (var i in scripts) {
        var src = scripts[i]['script'];
        if (!src) return;
        if (/^[~`]?\s*function\s*\(/gm.test(src))  src =  "function(event) { " + src + " }";
        var sink = obj;
        if (obj.is('body') && event == 'scroll') sink = $(window);
        sink.on(event, $.proxy(Function(src), obj));
      }
    }

    function setFunction(parent,key) {

      if (key == 'html') return;
      var value = parent[key];
      if (typeof value == 'string')
        setInlineExpr(parent, key, value);
      else if (key.indexOf('on_') == 0 && $.isArray(value))
        setOnHandler(key.substr(3), value)
    }

    function setFunctions(parent) {
      if (!parent) return;
      parent['didi-model'] = {}
      for (var key in parent) {
        setFunction(parent, key);
      }
    }

    setFunctions(field);
    setFunctions(field.style);
    setFunctions(field.class);
    if (funcs.length)
      field['didi-functions'] = funcs;
  }

  this.initModel = function(parent, field) {
    var vars = [];
    var parent_id = field.id;

    // add initial vars
    if (field.dd_init) $.each(field.dd_init, function(key, value) {
      vars.push(key);
    });


    // add input vars
    parent.find('input,select,textarea').addBack('input,select,textarea').each(function() {
      var field = $(this).data('didi-field');
      if (!field || field.parent_page != parent_id) return;
      var id = getModelId(field);
      if (vars.indexOf(id) < 0) vars.push(id);
    });

    // create set functions
    var funcs = vars.map(function(v) {
        return "\tset_"+v+": function(x) {\n\t\tvar changed = ("+v+" !== x);\n\t\t_old_"+v+"="+v+";\n\t\t"+v+"=x\n\t\treturn changed;\n\t},"
        + "\n\tchanged_"+v+": function(x) {\n\t\treturn x!=="+v+";\n\t}"
    });

    // append watchers functions
    parent.find('.didi-watcher').addBack('.didi-watcher').each(function() {
      var field = $(this).data('didi-field');
      if (!field || field.parent_page != parent_id) return;
      funcs = funcs.concat(field['didi-functions']);
    });

    if (me.model_funcs)
      funcs = me.model_funcs.concat(funcs);
    me.model_funcs = funcs;

    if (!funcs.length) return;

    // convert funcs to js source
    funcs = "\nreturn {\n" + funcs.join(",\n") + "}";

    var src = "";
    // convert vars and funcs to js source
    if (vars.length) vars = "var " + vars.map(function(v) {
      return v+",_old_"+v;
    }).join(",");

    if (field.js) {
      $.each(field.js, function(name, value) {
        if (/^\s*function\(/.test(value))
          src += "\n" + value.replace(/^s*function\s*(\([^)]*\))/m, 'function '+name+'$1')+ "\n";
        else
          src += "var " + name + " = " + value + ";\n";
      })
    }

    src += "\n" + vars;
    if (field.js_functions) src += "\n\n" + field.js_functions + "\n\n";
    if (me.model_src)
      src = me.model_src + src;
    me.model_src  = src;

    src += funcs;

    // create model
    me.model = new Function(src)();
    // set inital vars
    if (field.dd_init) $.each(field.dd_init, function(key, value) {
      me.model["set_"+key](value);
    });

    me.updateWatchers(parent);
  }


  me.updateWatchers = function(root) {
    if (!root) root = me.root;

    function update(obj, field, id) {
      if (!field || !field['didi-model']) return false;
      var changed = false;
      $.each(field['didi-model'], function(key, value) {
        if (key.indexOf('on_') == 0) return;
        var vars = value.regexCapture(/\$\{(\d+)\}/g);
        var prefix = "get_"+id+"_";
        vars.forEach(function(index) {
          var func = me.model[prefix+index];
          if (func === undefined) return;
          var result = func(obj);
          var regex = "\\$\\{"+index+"\\}";
          var old_value = value;
          if (new RegExp('^'+regex+'$','g').test(value))
            value = result;
          else
            value =  value.replace(new RegExp(regex,'g'), result);
          if (value !== old_value) changed = true;
          field[key] = value;
          if (key == 'text') obj.text(value);
          if (key == 'value') obj.val(value)
        });
      })
      return changed;
    }
    var root_field = root.data('didi-field');
    if (!root_field) return;
    var root_id = root_field.id;

    root.find('.didi-watcher').addBack('.didi-watcher').each(function() {
      var obj = $(this);
      var field = obj.data('didi-field');
      if (!field || field.parent_page != root_id) return;
      if (!field) return;
      var id = field.id || obj.attr("for");
      var changed = update(obj, field, id);
      var style_changed = update(obj, field.style, id);
      var class_changed = update(obj, field.class, id);
      if (changed) setAttr(obj, field);
      if (changed || class_changed) setClass(obj, field);
      if (changed || style_changed) setStyle(obj, field);
      if (changed) setVisible(obj, field);
      if (changed) setDisabled(obj, field);
    })
  }
}
