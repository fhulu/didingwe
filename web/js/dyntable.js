///~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Author     : Fhulu Lidzhade
// Date       : 17/06/2012   20:39
// Description:
//   table.js defines a jquery ui extension enhancing html tables. It adds featues
//   such as:
//    1) sorting by field on column header click
//    2) paging with adjustable page size
//    3) customable row expansion/collapse when required
//    4) editable rows including select boxes
//    5) dynamic addition of rows
//    6) dynamic deletion of rows
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

(function( $ ) {
  $.widget( "ui.dyntable", {
    _create: function()
    {
      var me = this;
      me.widths = [];
      var opts = me.options;
      if (opts.sort) opts.flags.push('sortable');
      var r = opts.render;
      r.expandFields(opts, "fields", opts.fields);
      me.title = r.initField(opts.title, opts);
      me.row = r.initField(opts.row, opts);
      opts.row_styles = r.initField(opts.row_styles, opts);
      $.extend(me.row.styles,opts.row.styles);
      opts.row_actions = r.initField(opts.row_actions, opts);
      $.extend(me.row.actions, opts.row_actions);
      me.cell = r.initField(opts.cell, opts);
      // opts.render.expandFields(opts, "row_actions", opts.row_actions);
      me.auto_widths = [];
      me._init_params();
      var el = me.element;
      me.initWidths();
      me.showHeader();
      me.showTitles();
      me.createRowBlueprint();
      if (opts.no_records)
        this.no_records = this.element.find('#no_records');
      me.showFooterActions();
      if (opts.auto_load) {
        var args = $.isPlainObject(r.request)? r.request: {};
        me.showData(args);
      }
      el.on('refresh', function(e, args) {
        me.showData(args);
        return opts.propagated_events.indexOf(e.type) >= 0;
      })
      .on('refreshed', function() {
        me.adjustWidths();
        me.adjustHeights();
      })
      .on('resize', mkn.debounce(function() {
        me.adjustWidths();
        me.adjustHeights();
      }))
      .on('addData', function(e, args) {
        el.trigger('addingData', args);
        me.load(args);
        return opts.propagated_events.indexOf(e.type) >= 0;
      })
      .on('updateData', function(e, args) {
        console.log("updateData", args);
        el.trigger('updatingData', args);
        me.updateData(args);
        return opts.propagated_events.indexOf(e.type) >= 0;
      })
      .on('shown', function() {
        alert('shown')
      })
      me.body().scroll($.proxy(me._scroll,me));
      me.head().children('.titles').toggle(me.hasFlag('show_titles'));
      me.bindRowActions();

    },

    _init_params: function()
    {
      this.params = { page_num: 1, offset: 0};
      var exclude = [ 'create', 'action', 'css', 'id', 'content', 'disabled','parent_name','parent_id','parent_page',
          'auto_load', 'searchDelay', 'number', 'data_from', 'min_row_height', 'desc', 'index',
          'html','name', 'page_id', 'position', 'sort', 'script','slideSpeed', 'text', 'tag', 'target', 'type', 'show', 'selector', 'js'];
      for (var key in this.options) {
        if (exclude.indexOf(key) >= 0 || key.indexOf('on_') ==0) continue;
        var val = this.options[key];
        if (typeof val === 'string' || typeof val === "number")
          this.params[key] = val;
      }
      var sort = this.options.sort;
      if (typeof sort != 'string') return;
      var fields = this.options.fields;
      for (var i in fields) {
        var field = fields[i];
        if (field.id != sort) continue;
        this.params['sort'] = field.number;
        return;
      }
    },

    _promote_fields: function(fields)
    {
      $.each(fields, function(i, val) {
        if (!$.isPlainObject(val))
          fields[i] = $.toObject(val);
      });
    },

    refresh: function(args)
    {
      this.element.trigger('refresh', [args]);
    },

    head: function()
    {
      return this.element.children('.head').eq(0);
    },

    body: function()
    {
      return this.element.children('.body').eq(0);
    },

    load: function(args)
    {
      args = args || {};
      var start = new Date().getTime();
      var me = this;
      var opts = me.options;
      me.head().find('.paging [action]').attr('disabled','');
      var action = opts.data_from == 'post'? 'action': 'values';
      var data = $.extend(opts.request, me.params, args, {action: action});
      var selector = opts.selector;
      if (selector !== undefined) {
        $.extend(data, $(selector).values());
      }

      var el = me.element;
      me.loading = true;
      $.json('/', {data: mkn.plainValues(data)}, function(data) {
        if (!data) {
          el.triggerHandler('refreshed', [data]);
          return;
        };
        if (data._responses)
          el.triggerHandler('server_response', [data]);
        el.triggerHandler('refreshing', [data]);
        var end = new Date().getTime();
        console.log("Load: ", end - start);
        me.populate(data, args.insert_at);
        me.loading = false;
        console.log("Populate: ", new Date().getTime() - end);
        delete data.data;
        $.extend(me.params, data);
        el.triggerHandler('refreshed', [data]);
      });
    },

    populate: function(data, insert_at)
    {
      if (data === undefined || data === null || !data.data) {
        console.log('No table data for table:', this.params.field);
        return;
      }
      if (this.cell_render) delete this.cell_render;
      var opts = this.options;
      var render = this.cell_render = new mkn.render({invoker: opts.render.root, model_src: opts.render.model_src,  model_funcs: opts.render.model_funcs, types: opts.render.types, id: opts.id, key: opts.key, request: opts.request});
      if (this.options.page_size !== undefined) this.showPaging(parseInt(data.total));
      this.no_records.hide();
      if (data.data.length == 0 && this.body().children().length == 0 && this.no_records)
        this.element.append(this.no_records.show());

      this.prev_row = null;
      for(var i in data.data) {
        var row = data.data[i];
        if ($.isArray(row)) {
          this.addRow(row, insert_at);
          this.prev_row = row;
        }
      }
      render.root = this.element;
      if (!opts.js_functions) opts.js_functions = opts.render.root_field.js_functions
      render.initModel(render.root, opts);
    },


    hasFlag: function(flag)
    {
      return this.options.flags.indexOf(flag) >= 0;
    },

    hasHeader: function()
    {
      var opts = this.options;
      return opts.name !== undefined && opts.page_size !== undefined;
    },

    showHeader: function()
    {
      var head = this.head();
      var me = this;
      if (this.hasFlag('filter')) {
        head.children('.filter').on('filter', function(e) {
          me.showFilter();
        });
      }
      var opts = this.options;
      if (this.options.page_size !== undefined && !this.hasFlag('hide_paging')) this.createPaging(th);
      head.children(".titles").toggle(this.hasFlag("show_titles") || opts.titles.show);
      head.children(".header").toggle(this.hasFlag('show_header') || this.hasFlag('filter') || opts.header.show);
    },

    createPaging: function(th)
    {
      var paging = $('<div class=paging></div>').appendTo(th);
      $('<div>Showing from </div>').appendTo(paging);
      $('<div id=page_from></div>').appendTo(paging);
      $('<div>to</div>').appendTo(paging);
      $('<div id=page_to></div>').appendTo(paging);
      $('<div>of</div>').appendTo(paging);
      $('<div id=page_total></div>').appendTo(paging);
      $('<div>at</div>').appendTo(paging);
      $('<input id=page_size type=text></input>').val(this.options.page_size).appendTo(paging)
      $('<div>entries per page</div>').appendTo(paging);

      this.createAction('goto_first').attr('disabled','').appendTo(paging);
      this.createAction('goto_prev').attr('disabled','').appendTo(paging);
      $('<input id=page_num type=text></input>').val(1).appendTo(paging);
      this.createAction('goto_next').attr('disabled','').appendTo(paging);
      this.createAction('goto_last').attr('disabled','').appendTo(paging);
      this.bindPaging();
    },

    pageTo: function(invoker, number)
    {
      if (invoker.hasAttr('disabled')) return;
      this.params.page_num = number;
      this.params.size = invoker.siblings('#page_size').val();
      invoker.siblings('#page_num').val(number);
      this.refresh();
    },

    page: function(invoker, offset)
    {
      this.pageTo(invoker, parseInt(invoker.siblings('#page_num').val())+offset);
    },

    bindPaging: function()
    {
      var me = this;
      var head = me.head();
      head.find(".paging [type='text']").bind('keyup input cut paste', function(e) {
        if (e.keyCode === 13) {
          me.params.size = $(this).val();
          me.refresh();
        }
      });

      var page = head.find('#page_num');
      this.element.on('goto_first', function(e, btn) {
        me.pageTo(btn, 1);
      })
      .on('goto_prev', function(e, btn) {
        me.page(btn, -1);
      })
      .on('goto_next', function(e, btn) {
        me.page(btn, 1);
      })
      .on('goto_last', function(e, btn) {
        var size = parseInt(head.find('#page_size').val());
        var total = parseInt(head.find('#page_total').html());
        me.pageTo(btn, Math.floor(total/size)+1);
      })
    },

    showPaging: function(total)
    {
      var head = this.head();
      head.find('#page_total').text(total);
      var page = this.params.page_num;
      var size = this.params.size;
      var prev = head.find('[action=goto_first],[action=goto_prev]');
      var next = head.find('[action=goto_last],[action=goto_next]');
      if (page <= 1) {
        page = 1;
        prev.attr('disabled','');
        head.find('#page_num').val(1);
      }

      if (size >= total) head.find('#page_num').val(1);

      head.find('#page_from').text((page-1)*size+1);
      head.find('#page_to').text(Math.min(page*size,total));
      if (page >= total/size)
        next.attr('disabled','');
      else
        next.removeAttr('disabled');

      if (page > 1) prev.removeAttr('disabled');
    },

    bindSort: function(th, field)
    {
      var me = this;
      th.click(function() {
        th.siblings().attr('sort','');
        var order = 'asc';
        if (me.params.sort == field.number)
          order = th.attr('sort')==='asc'?'desc':'asc';
        th.attr('sort', order);
        me.params.sort = field.number;
        me.params.sort_order = order;
        me.refresh();
      });
    },

    showTitles: function()
    {
      var me = this;
      var head = me.head();
      var opts = me.options;
      var tr = head.children('.titles').eq(0);
      // var title = opts.render.create(opts, 'title');
      var fields = opts.fields;
      var col = 0;
      for (var i in fields) {
        var field = fields[i];
        var id = field.id;
        if (id=='style' || field.data) continue;
        var title = mkn.merge(me.title, field);
        var th = opts.render.create(title).appendTo(tr);
        th.toggle(mkn.visible(field));
        th.data('field', field);
        if (id === 'actions') {
          field.filter = false;
          continue;
        }
        if ($.isArray(field.name)) field.name = field.name[field.name.length-1];
        th.html(field.name || toTitleCase(id));
        if (me.hasFlag('sortable')) {
          if (id === me.params.sort)
            th.attr('sort', me.params.sort_order);
          else
            th.attr('sort','');
        }
        th.css('width', this.widths[col]);
        if (me.hasFlag('sortable'))
          me.bindSort(th, field);
        ++col;
      };
    },

    createRowBlueprint: function()
    {
      var me = this;
      var widths = me.widths;
      var opts = me.options;
      var render = opts.render;
      var tr = render.create(opts, 'row');
      me.defaults = {}
      var fields = opts.fields;
      var col = 0;
      for (var i in fields) {
        var field = fields[i];
        me.defaults[field.id] = field.new;
        delete field.new;
        if (field.id == 'style' || field.data) continue;
        var cell = mkn.merge(me.cell, field);
        var td = render.create(cell).appendTo(tr);
        td.css('width', widths[col]);
        td.attr('field', field.id);
        if (field.style)
          td.addStyle(opts.cell.styles, field.style);
        ++col;
      }
      me.row_blueprint = tr;
    },

    showData: function(args)
    {
      var me = this;
      var body = me.body();
      var opts = me.options;
      var max_height  = parseInt(body.css('max-height'));
      if (opts.page_size == 0 || max_height > 0) {
        var clone = me.row_blueprint.clone();
        var row_height = clone.appendTo(body).height();
        clone.remove();
        if (row_height < 1) row_height = opts.min_row_height;
        me.params.size = Math.ceil((max_height - me.head().height())/row_height)+3;
      }
      body.addClass(opts.body.class.join(' '));
      me.head().children('.heading').remove();
      body.empty();
      me.load(args);
    },

    updateData: function(args) {
      args = args || {start_row: 0, start_col: 0};
      var start = new Date().getTime();
      var me = this;
      var opts = me.options;
      var action = opts.data_from == 'post'? 'action': 'values';
      var data = $.extend(opts.request, me.params, args, {action: action});
      var selector = opts.selector;
      if (selector !== undefined) {
        $.extend(data, $(selector).values());
      }

      var el = me.element;
      me.loading = true;
      $.json('/', {data: mkn.plainValues(data)}, function(result) {
        if (!result) {
          el.triggerHandler('updated', [result]);
          return;
        };
        if (data._responses)
          el.triggerHandler('server_response', [resut]);
        el.trigger('refreshing', [data]);
        var end = new Date().getTime();
        console.log("Load: ", end - start);
        var row = args.start_row;
        var col = args.start_col
        var rows = me.body().children();
        for (var i in result.data) {
          me.updateRow(rows.eq(row++), result.data[i], col)
        }
        me.loading = false;
        el.triggerHandler('updated', [data]);
        console.log("Update: ", new Date().getTime() - end);
      });
    },

    setRowStyles: function(row, styles) {
      var row_styles =  this.options.row.styles;

      if ($.isPlainObject(styles)) styles = mkn.firstKey(styles);
      row.addStyle(row_styles, styles)
    },

    addRow: function(row, insert_at) {
      var tr = this.row_blueprint.clone(true);
      this.updateRow(tr, row);
      var body = this.body();
      if (insert_at === undefined)
        tr.appendTo(tr.hasClass('heading')? this.head(): body);
      else if ($.isNumeric(insert_at))
        tr.insertBefore(body.children().eq(insert_at));
      else
        tr.insertBefore(body.find(insert_at));
    },

    updateRow: function(tr, data, offset)
    {
      var me = this;
      var key;
      var expandable = false;
      offset = offset || 0;
      var col = offset;
      var fields = this.options.fields;
      var tds = tr.children();
      var count = fields.length-offset;
      var col_span = 0;
      var titles = me.head().children('.titles').eq(0);
      var height = this.options.min_row_height;
      for (var i=0; i<count; ++i) {
        var field = fields[offset++];
        var cell = data[i];
        if (field.id == 'style' && cell !== undefined) {
          me.setRowStyles(tr, cell);
          continue;
        }
        if (field.data) {
          tr.data(field.id, cell);
          if (field.attr) tr.attr(field.id, cell);
          continue;
        }
        var td = tds.eq(col);
        td.css('width', me.widths[col]);
        if (cell === undefined || cell === null)
          cell = { name: ""}
        else if (!$.isPlainObject(cell)) {
          if (cell[0] === '{') {
            try {
              cell = JSON.parse(cell);
            }
            catch {
              cell = { name: cell };
            }
          }
          else {
            cell = { name: cell}
          }
        }

        if (cell.id === undefined) {
          cell.id = field.id;
          if (key) cell.id +=  "_" + key;
        }

        data[i] = cell;
        if (this.prev_row && this.prev_row[i] && this.prev_row[i].row_span > 1) {
          cell.row_span = parseInt(this.prev_row[i].row_span) - 1;
          data[i] = cell;
          td.addClass('transparent rowspanned').hide();
          if (cell.row_span <= 1)
            me.setRowStyles(tr, ['end-span']);
        }
        else if (cell.row_span) {
          tr.addClass('start-span');
          td.data('rowspan', parseInt(cell.row_span));
          td.attr("rowspan", cell.row_span);
          td.addClass('float-left rowspan');
        }

        var colspan = cell.colspan || cell.col_span;
        if (colspan) {
          colspan = parseInt(colspan);
          td.attr("colspan", colspan).data('colspan', colspan);
        }

        if (cell === null || cell === undefined)
          cell = this.options.defaults[field.id];
        else if (field.escapeHtml)
          cell = mkn.escapeHtml(cell);

        if (key === undefined && (field.id === 'key' || field.key)) {
          tr.attr('key', cell.name);
          key = cell.name;
        }

        me.setCellValue(td, cell);
        ++col;
      }
      this.prev_row = data;
    },

    setCellValue: function(td, cell)
    {
      if (!cell.name) cell.name = "";
      if (!cell.value) cell.value = cell.name;
      if (td.attr('field') == 'actions')
        return this.createRowActions(td, cell.value);

      if (td.hasClass('expandable'))
        return td.find('.text').eq(0).text(cell.name);

      if (cell.class || this.options.cell.class)
        td.setClass(this.options.cell.class.concat(cell.class));

      if (cell.style)
        td.addStyle(this.options.cell.styles, cell.style)

      if (cell.key)
        td.attr("key", cell.key)
      if (cell.type) {
        cell.path = this.options.path + "/cell/controls/" + cell.type
        var src = this.cell_render.create(this.options.cell, cell, true, td);
        src && td.append(src);
      }
      if (cell.data) {
        td.data(JSON.parse(cell.data));
      }
      var obj = td.children().eq(0);

      if (!obj.exists())
        return td.text(cell.value).attr('title', cell.title? cell.title: cell.name);

      obj.value(cell.value);
      return td;
    },

    applyStyle: function(obj, reference, styles) {
      var me = this;
      if (!$.isArray(styles)) styles = styles.split(' ');
      styles.forEach(function(style) {
        obj.addClass(style)
        var classes = reference[style];
        if (!classes) return;
        classes.forEach(function(cls) {
          if (cls[0] == '~')
            me.removeStyle(obj, reference, cls.substr(1));
          else if (cls[0] == '^')
            obj.removeClass(cls.substr(1));
          else
            obj.addClass(cls);
        });
      })
    },

    removeStyle: function(obj, reference, style) {
      var classes = reference[style];
      if (classes)
        obj.removeClass(classes.join(' '));
    },

    bindAction: function(obj, props, sink, path)
    {
      if (sink === undefined) sink = this.element;
      var me = this.element;
      obj.click(function() {
        var action = props.id;
        sink.trigger('action',[obj,action,props]);
        sink.trigger(action, [obj,props]);
        if (props.action === undefined) return;
        var key = sink.attr('key');
        if (key === undefined) key = me.options.key;
        var options = $.extend({},me.params, props, {id: action, action: props.action, key: key });
        var listener = me.closest('.page').eq(0);
        options.path += '/';
        if (path !== undefined) options.path += path + '/';
        options.path += action;
        listener.trigger('child_action', [obj,options]);
      });
    },

    findField: function(name, fields)
    {
      for (var i in fields) {
        if (name === fields[i].id) return fields[i];
      }
    },

    createAction: function(action, actions, sink, path)
    {
      var props;
      if (actions) {
        props = this.findField(action, actions);
        if (!props) props = this.options[action];
      }
      else if ($.isPlainObject(action)) {
        props = action;
        action = props.id;
      }
      else
        props = this.options[action];
      if (!props || $.isEmptyObject(props))
        return $('');
      var div = $('<span>');
      if (props.name === undefined) props.name = toTitleCase(action);
      div.html(props.name);
      div.attr('title', props.desc);
      div.attr('action', action);
      props.id = action;
      this.bindAction(div, props, sink, path);
      return div;
    },

    createExpandActions: function(td)
    {
      var tr = td.parent();
      tr.children().each(function() {
        if ($(this).css('display') != 'none') {
          td = $(this);
          return false;
        }
      })
      td.addClass('expandable');
      var span = $('<span>').addClass('text').text(td.text());
      td.text('').append(span);
      this.createAction('expand', undefined, tr).prependTo(td);
      this.createAction('collapse', undefined, tr).prependTo(td).hide();
    },

    createRowActions: function(td, row_actions)
    {
      if (!row_actions) return;
      if (!$.isArray(row_actions)) row_actions = row_actions.split(',');
      if (row_actions.indexOf('expand') >=0)
        this.createExpandActions(td);
      if (row_actions.indexOf('slide') >= 0)
        row_actions.push('slideoff');

      if (!td.hasClass('actions')) td.addClass('actions');
      td.empty();

      var opts = this.options;
      var all_actions = opts.row_actions;
      var key = td.parent().attr('key');
      var normal_actions = [];
      var slide_actions = [];
      var actions = normal_actions;
      var slide_pos = -1;
      for (var i in all_actions) {
        var action = mkn.copy(all_actions[i]);
        var id = action.id;
        if (row_actions.indexOf(id) < 0) continue;
        action.key = key;
        action = mkn.merge(action, opts[id]);
        actions.push(action);
        if (id == 'slide') {
          actions = slide_actions;
          slide_pos = i;
        }
      }
      if (slide_actions.length == 1)
        normal_actions.splice(slide_pos,1);
      if (normal_actions.length)
        opts.render.createItems(td, {}, undefined, normal_actions);
      if (slide_actions.length < 2) return;
      var slider = $('<div class="slide">').toggle(false).appendTo(td);
      slider.data('actions', slide_actions);
    },

    slide: function(tr)
    {
      var height = this.getActionsHeight(tr);
      var slider = tr.find('.slide');
      if (slider.children().length == 0) {
        this.options.render.createItems(slider, {}, undefined, slider.data('actions'));
        slider.find('[action]').click(function() {
          slider.parent().trigger('action',[$(this),'', $(this).attr('action')]);
        });
        slider.data('width', slider.width());
        slider.width(0);
      }
      slider.find('[action]').height(height);
      slider.show().animate({width: slider.data('width')}, this.options.slideSpeed);
    },


    loadSubPages: function(tr, pages)
    {

      var expanded = $('<div>')
          .addClass(this.options.expand.class.join(' '))
          .insertAfter(tr);

      var key = tr.attr('key');
      var tmp = $('<div></div>');
      var index = 0;
      var load = function() {
        var path = pages[index];
        mkn.showPage({path: path, key: key }, td).done(function() {
          if (++index < pages.length)
            load();
        })
      };
      load();
    },


    bindRowActions: function()
    {
      var me = this;
      var options = me.options;
      var el = this.element;
      el.on('slide', '.row', function(e) {
        $(e.target).toggle();
        me.slide($(this));
        e.stopPropagation();
      })
      .on('expand', '.row', function(e) {
        var tr = $(this);
        tr.find('[action=expand]').hide();
        tr.find('[action=collapse]').show();
        if (tr.next().hasClass('expanded')) return;
        var expand = options['expand'];
        if (!expand.pages) return;
        me.loadSubPages(tr, expand.pages)
        e.stopPropagation();
      })
      .on('collapse', '.row', function(e) {
        var tr = $(this);
        tr.find('[action=collapse]').hide();
        tr.find('[action=expand]').show();
        var next = tr.next();
        if (next.hasClass('expanded')) next.remove();
        e.stopPropagation();
      })
      .on('action', '.row', function(e, btn) {
        if (!btn.parent('.slide').exists()) return;
        me.slide($(this));
        $(this).find('[action=slide]').toggle();
        var slider = $(this).find('.slide');
        slider.animate({width: 0}, options.slideSpeed*2, function() { slider.hide()});
        e.stopPropagation();
      })
      .on('delete', '.row', function(e) {
        $(this).remove();
        return $(this);
      })
      .on('delete', function(e) {
        e.stopPropagation();
      })
      .on('setRowStyles', function(e, key, styles) {
        if (!$(e.target).is(el)) return;
        me.setRowStyles(me.getRowByKey(key), styles);
    })
      .on('setRowActions', function(e, key, actions) {
        if (!$(e.target).is(el)) return;
        var tr = me.getRowByKey(key);
        me.createRowActions(me.getCellById(tr, 'actions'), actions);
      })
      .on('setCellValue', function(e, key, id, value) {
        if (!$(e.target).is(el)) return;
        var tr = me.getRowByKey(key);
        me.setCellValue(me.getCellById(tr, id), {name: value} );
      })
      .on('setRowData', function(e, key, data) {
        if (!$(e.target).is(el)) return;
        me.setRowData(me.getRowByKey(key), data);
      })
      .on('addRow', function(e, data) {
        if (!$(e.target).is(el)) return;
        me.addRow(data);
        me.adjustWidths();
        me.adjustHeights();
      })
      .on('addNewRow', function(e, data) {
        if (!$(e.target).is(el)) return;
        var tr = me.row_blueprint.clone(true);
        me.body().prepend(tr);
        me.setRowData(tr, data);
        me.adjustWidths();
        me.adjustHeights();
      })
      .on('removeRow', function(e, key) {
        me.getRowByKey(key).remove();
      })
    },

    setRowData: function(tr, data)
    {
      data = $.extend({}, this.options.defaults, data);
      if ('key' in data)
        tr.attr('key', data['key']);
      for (var id in data) {
        var val = data[id];
        if (id == 'style')
          this.setRowStyles(tr, val);
        else
          this.setCellValue(this.getCellById(tr, id), val);
      }
    },

    getCellById: function(tr, id)
    {
      return tr.children('[field="'+id+'"]').eq(0);
    },

    getRowByKey: function(key)
    {
      return this.body().children('[key="'+key+'"]').eq(0);
    },

    getActionsHeight: function(tr)
    {
      return (tr.innerHeight()*0.99).toString()+'px';
    },

    initWidths: function()
    {
      var fields = this.options.fields;
      var widths = this.widths;
      var col = -1;
      for (var i in fields) {
        var field = fields[i];
        if (field.data || field.id == 'style' || field.type == 'type') continue;
        ++col;
        widths[col] = field.width === undefined? 'auto': field.width;
      };
    },

    adjustWidths: function()
    {
      var me = this;
      var widths = me.widths;
      var num_cols = widths.length;
      var adjusted = widths.slice();
      var changed = false;
      var first_row = me.head().children('.titles').eq(0);
      if (!first_row.is(":visible")) first_row = me.body().children('.row').eq(0);
      var max_width = first_row.width();
      first_row.children().each(function(i, cell) {
        cell = $(cell);
        if (!cell.is(':visible') || widths[i] == 'auto') return;
        max_width -= $(cell).width();
      })

      var calc = function(section, max_width) {
        section.children('.row').each(function(i, row) {
          $(row).children().each(function(j, cell) {
            cell = $(cell);
            if (!cell.is(':visible')) return;
            var width = cell.width();
            if (widths[j] != 'auto' || cell.data('colspan') > 1 ) return;
            if (width > adjusted[j] || adjusted[j] == 'auto') {
              adjusted[j] = width = width<max_width? width: max_width;
              max_width -= width;
            }
          });
        });
      }

      calc(me.head(), max_width);
      calc(me.body(), max_width);

      var adjust = function(section) {
        section.children('.row').each(function(i, row) {
          row = $(row);
          row.children().each(function(j, cell) {
            $(cell).css('width', adjusted[j]);
          });
          row.children('[colspan]').each(function(j, cell) {
            cell = $(cell);
            if (cell.hasClass('spanned')) return;
            var colspan = cell.data('colspan') - 1;
            var width = cell.width();
            for (var spanned = cell.next(); colspan; --colspan) {
              width += spanned.width();
              spanned.addClass('spanned');
              spanned = spanned.next();
            }
            cell.css('width', width);
          });
          row.children('.spanned').hide();
        })
      }

      adjust(me.head());
      adjust(me.body());
    },


    adjustHeights: function() {
      var adjust = function(section) {
        section.children('.row').each(function(i, row) {
          row = $(row);
          if (!row.is(':visible')) return;
          row.children('.cell').css('min-height', 0);
          row.children().each(function(j, cell) {
            cell = $(cell);
            var height = row.height();
            cell.css('min-height', height);
            var span = cell.data('rowspan');
            if (!span) return;
            cell.addClass('overlay')
            for (var spanned = row.next(); span > 1; --span) {
               height += spanned.height();
               spanned = spanned.next();
            }
            cell.css('min-height', height);
          })
        })
      }
      adjust(this.head());
      adjust(this.body());
    },


    createEditor: function(template, cls)
    {
      var editor = template.clone(true);
      var td;
      editor.addClass('dyntable-editor').addClass(cls).removeClass("title");
      editor.children().each(function(i) {
        var th = $(this);
        var field = th.data('field');
        if (field && field.id == 'actions') return;
        th.text('');
        th.append($('<input type=text></input>').addClass("tallest widest"));
      });
      editor.insertAfter(template);
      return editor;
    },


    createFilter: function()
    {
      var filter = this.head().find('.filter');
      if (filter.exists()) return filter;

      var me = this;
      var titles = me.head().find('.titles');
      filter = me.createEditor(titles,'filter').hide();
      var tds = filter.children();
      filter.find('input').bind('keyup cut paste', mkn.debounce(function(e) {
        var input = $(this);
        me.params.offset = 0;
        var td = input.parent();
        var index = tds.index(td);
        me.params['f'+index] = input.value();
        me.refresh();
      }, me.options.search_delay));
      return filter;
    },

    showFilter: function()
    {
      var filter = this.createFilter();
      filter.toggle();
    },

    showFooterActions: function()
    {
      this.options.render.expandFields(this.options, "footer_actions", this.options.footer_actions);
      var actions = this.options.footer_actions;
      if (!actions.length) return;
      var footer = $('<div>').addClass('footer').appendTo(this.element);
      var tr = $('<div>').addClass('actions').appendTo(footer);
      var td = $('<div>').appendTo(tr);
      var key = this.options.key;
      actions.map(function(action) {
        action.key = key;
        return action;
      })
      this.options.render.createItems(td, this.options, undefined, actions);
    },

    _scroll: function(e) {
      var me = this;
      var opts = me.opts;
      var body = me.body();
      if(body.scrollHeight() - body.scrollTop() != body.height() || me.loading) return;
      if (me.params.total && me.params.offset + me.params.size > me.params.total) return;
      me.params.offset += me.params.size;
      me.load();
    },

  })
}) (jQuery);
