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
  $.widget( "didi.datagrid", {
    options: {
      name: 'Untitled',
      flags: [],
    },

    _create: function()
    {
      var me = this;
      me.widths = [];
      me.args = {};
      var opts = me.options;
      if (opts.sort) opts.flags.push('sortable');
      var r = opts.render;
      r.expandFields(opts, "fields", opts.fields);
      var row = r.initField(opts.row, opts);
      me.row_classes = opts.row.class.join(' ');
      $.extend(opts.row_styles,opts.row.styles);
      me.title = r.initField(opts.title, opts);

      $.extend(opts.row.actions, opts.row_actions);
      me.row_actions = r.initField(opts.row.actions, opts);
      opts.render.expandFields(opts, "row_actions", opts.row_actions);
      me.cell = r.initField(opts.cell, opts);
      me.slider = r.initField(opts.slider, opts);
      me.auto_widths = [];
      me._init_params();
      me.initColumns();
      var el = me.element;
      me.showHeader();
      me.showTitles();
      if (opts.no_records)
        this.no_records = this.element.find('#no_records');
      me.head().toggle(me.hasFlag('show_titles') || me.hasFlag('show_header') || me.hasFlag('filter'));
      me.showFooterActions();
      if (opts.auto_load) {
        var args = $.isPlainObject(r.request)? r.request: {};
        me.showData(args);
      }
      el.on('refresh', function(e, args) {
        el.trigger('refreshing', [args]);
        me.showData(args);
        return opts.propagated_events.indexOf(e.type) >= 0;
      })
      el.on('refreshed', function() {
      })
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
      .on('mousemove', '.titles>.cell', function(e)  {
        me.updateSizing(e);
      })
      .on('mousedown', '.titles>.cell', function(e)  {
        me.startSizing(e);
      })
      .on('mouseup', function(e)  {
        me.stopSizing(e);
      })
      me.body().scroll($.proxy(me._scroll,me));
      me.bindRowActions()
    },

    updateWidths: function() {
      var widths = this.widths.join('px ') + 'px';
      this.body().css('grid-template-columns', widths);
      this.titles().css('grid-template-columns', widths);
    },

    updateSizing: function(e) {
      if (this.sizing === undefined) {
        var el = $(e.target);
        var offset = el.offset();
        var left = offset.left + this.options.sizing_width/2;
        var col = parseInt(el.attr('col'));
        var right = offset.left + this.widths[col] - this.options.sizing_width/2;
        el.toggleClass('col-resize-cursor',  e.pageX < left || e.pageX > right);
        return;
      }
      var sizing = this.sizing;
      var diff = e.pageX - sizing.start_x;
      col = sizing.col;
      if (sizing.dragging_left) {
        this.widths[col] -= diff;
        this.widths[col-1] += diff;
      }
      else {
        this.widths[col] += diff;
        this.widths[col+1] -= diff;
      }
      sizing.start_x = e.pageX;
      this.updateWidths();
    },

    startSizing: function(e) {
      var el = $(e.target);
      if (!el.hasClass('col-resize-cursor')) return;
      var left_margin = el.offset().left + this.options.sizing_width/2;
      this.sizing = {
        start_x: e.pageX,
        col: parseInt(el.attr('col')),
        dragging_left: e.pageX <= left_margin
      };
    },

    stopSizing: function() {
      this.sizing = undefined;
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
      var fields = this.options.fields;
      for (var i in fields) {
        var field = fields[i];
        if (field.id == 'style') this.style_index = i;
        if (field.id != sort) continue;
        this.params['sort'] = field.number;
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

    titles: function()
    {
      return this.element.children('.titles').eq(0);
    },

    body: function()
    {
      return this.element.children('.body').eq(0);
    },

    load: function(args)
    {
      args = this.args = $.extend(this.args, args);
      var start = new Date().getTime();
      var me = this;
      var opts = me.options;
      me.head().children('.paging').eq(0).children('[action]').attr('disabled','');
      var action = opts.data_from == 'post'? 'action': 'values';
      var data = $.extend(opts.request, me.params, args, {action: action});
      var selector = opts.selector;
      if (selector !== undefined) {
        $.extend(data, $(selector).values());
      }
      me.stopSizing();
      var el = me.element;
      me.loading = true;
      $.json('/', {data: $.plainValues(data)}, function(data) {
        if (!data) {
          el.triggerHandler('refreshed', [data]);
          return;
        };
        if (data._responses)
          el.triggerHandler('server_response', [data]);
        // el.trigger('refreshing', [data]);
        var end = new Date().getTime();
        console.log("Load: ", end - start);
        var start_row = args.insert_at;
        if (!start_row) start_row = me.params.offset || 0;
        me.populate(data, start_row);
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
      var render = this.cell_render = new $.render({invoker: opts.render.root, model_src: opts.render.model_src,  model_funcs: opts.render.model_funcs, types: opts.render.types, id: opts.id, key: opts.key, request: opts.request});
      if (this.options.page_size !== undefined) this.showPaging(parseInt(data.total));
      this.no_records.hide();
      if (data.data.length == 0 && this.body().children().length == 0 && this.no_records)
        this.element.append(this.no_records.show());

      insert_at = insert_at || 0;
      var body = this.body();
      var had_children = body.children().length > 0;
      for(var i in data.data) {
        var row = data.data[i];
        if ($.isArray(row)) {
          this.addRow(row, insert_at++);
          this.prev_row = row;
        }
      }
      render.root = this.element;
      if (!opts.js_functions) opts.js_functions = opts.render.root_field.js_functions
      render.initModel(render.root, opts);
      if (!had_children && this.body().hasScrollBar()) {
        this.titles().css("width", "calc(100% - "+$.scrollbarWidth() + 'px)');
      }
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
      head.children(".header").toggle(this.hasFlag('show_header') || opts.header.show);
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
      var self = this;
      var head = self.head();
      head.find(".paging [type='text']").bind('keyup input cut paste', function(e) {
        if (e.keyCode === 13) {
          self.params.size = $(this).val();
          self.refresh();
        }
      });

      var page = head.find('#page_num');
      this.element.on('goto_first', function(e, btn) {
        self.pageTo(btn, 1);
      })
      .on('goto_prev', function(e, btn) {
        self.page(btn, -1);
      })
      .on('goto_next', function(e, btn) {
        self.page(btn, 1);
      })
      .on('goto_last', function(e, btn) {
        var size = parseInt(head.find('#page_size').val());
        var total = parseInt(head.find('#page_total').html());
        self.pageTo(btn, Math.floor(total/size)+1);
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
      var self = this;
      th.click(function() {
        th.siblings().attr('sort','');
        var order = 'asc';
        if (self.params.sort == field.number)
          order = th.attr('sort')==='asc'?'desc':'asc';
        th.attr('sort', order);
        self.params.sort = field.number;
        self.params.sort_order = order;
        self.refresh();
      });
    },

    showTitles: function()
    {
      var me = this;
      var tr = me.titles().empty();
      if (!me.hasFlag('show_titles')) return;
      var opts = me.options;
      var fields = opts.fields;
      var col = 0;
      for (var i in fields) {
        var field = $.copy(fields[i]);
        delete field.width;
        var id = field.id;
        if (id=='style' || field.data) continue;
        var title = $.fuse(me.title, field);
        title = $.fuse(title, field.title);
        var th = opts.render.create(title).appendTo(tr);
        th.toggle($.visible(field));
        th.data('field', field);
        if (id === 'actions') {
          field.filter = false;
          continue;
        }
        if ($.isArray(field.name)) field.name = field.name[field.name.length-1];
        th.html(field.name || $.toTitleCase(id));
        if (me.hasFlag('sortable')) {
          if (id === me.params.sort)
            th.attr('sort', me.params.sort_order);
          else
            th.attr('sort','');
        }
        if (me.hasFlag('sortable'))
          me.bindSort(th, field);
        ++col;
      };
    },

    showData: function(args)
    {
      var me = this;
      var body = me.body();
      var opts = me.options;
      var max_height  = parseInt(body.css('max-height'));
      if (opts.page_size == 0 || max_height > 0) {
        var row_height = parseInt($('<div>Loading...</div>').appendTo(body).height());
        if (row_height < 1) row_height = opts.min_row_height;
        me.params.size = Math.ceil((max_height - me.head().height())/row_height)+3;
      }
      body.addClass(opts.body.class.join(' '));

      me.showTitles();
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
      $.json('/', {data: $.plainValues(data)}, function(result) {
        if (!result) {
          el.triggerHandler('updated', [result]);
          return;
        };
        if (data._responses)
          el.triggerHandler('server_response', [resut]);
        // el.trigger('refreshing', [data]);
        var end = new Date().getTime();
        console.log("Load: ", end - start);
        var row = args.start_row;
        var col = args.start_col
        var rows = me.body().children();
        for (var i in result.data) {
          me.updateRow(rows.eq(row++), result.data[i], i,  col)
        }
        me.loading = false;
        el.triggerHandler('updated', [data]);
        console.log("Update: ", new Date().getTime() - end);
      });
    },

    getRowStyles: function(data) {
      return $.isPlainObject(data)? $.firstKey(data): data;
    },

    setRowStyles: function(row, styles) {
      var cols = row.attr('row') == this.last_row? row.nextAll(): row.nextUntil(row.attr('next'));
      cols.addStyle(this.getRowStyles(styles), this.options.row_styles);
      // if (!$.isNumeric(row))
      //   row = row.attr('row');
      // this.body().children('.cell.row-'+row).addStyle(row_styles, styles)
    },

    addRow: function(row, insert_at) {
      if (insert_at > this.last_row) this.last_row = insert_at;
      var tr = $('<div>').hide()
        .addClass('row')
        .attr('field', 'row')
        .attr('row', insert_at)
        .attr('next', '.row-'+(insert_at+1))
      // row = $.extend({}, this.options.defaults, row);
      this.updateRow(tr, row, insert_at);

      // if (insert_at === undefined)
      //   tr.appendTo(td.hasClass('title')? this.head(): body);
      // else if ($.isNumeric(insert_at))
      //   tr.insertBefore(body.children().eq(insert_at));
      // else
      //   tr.insertBefore(body.find(insert_at));
    },

    updateRow: function(tr, data, row_index, offset)
    {
      var me = this;
      var key;
      var expandable = false;
      offset = offset || 0;
      var fields = this.options.fields;
      var prev = tr;
      var count = fields.length-offset;
      var row_spanned = false;
      var row_styles = me.options.row_styles;
      var style;
      if (me.style_index !== undefined) {
        style = me.getRowStyles(data[me.style_index]);
      }
      var col_span = 1;
      var col = -1;
      var added_row = false;
      for (var i=0; i<count; ++i) {
        var field = fields[offset++];
        var cell = data[i];
        if (field.id == 'style' && cell !== undefined) continue;
        if (field.data) {
          tr.data(field.id, cell);
          if (field.attr) tr.attr(field.id, cell);
          continue;
        }
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
        if (field.id === 'key') {
          tr.attr('key', cell.name);
          key = cell.name;
        }
        if (!$.visible(field)) continue;

        if (cell.id === undefined) {
          cell.id = field.id;
          if (key) cell.id +=  "_" + key;
        }
        if (field.cell) cell = $.fuse(field.cell, cell);
        if (field.class) cell.class = field.class.concat(cell.class);

        data[i] = cell;
        td = $('<div>');
        if ((row_spanned = this.prev_row && this.prev_row[i] && this.prev_row[i].row_span > 1)) {
          cell.row_span = parseInt(this.prev_row[i].row_span) - 1;
          data[i] = cell;
        }
        else if (cell.row_span) {
          td.css("grid-row", "auto / span " + cell.row_span);
        }

        col += col_span;
        if (cell.col_span) {
          col_span = parseInt(cell.col_span);
          td.css("grid-column", "auto / span " + cell.col_span);
          i += col_span;
          offset += col_span;
        }
        else {
          col_span = 1;
        }

        if (cell === null || cell === undefined)
          cell = this.options.defaults[field.id];
        else if (field.escapeHtml)
          cell = $.escapeHtml(cell);

        if (row_spanned) continue;
        td.attr('field', field.id).attr('row', row_index).attr('col', col);
        me.setCellValue(td, cell);
        if (style) td.addStyle(style, row_styles);
        if (!added_row) {
          tr.appendTo(td.hasClass('titles')? this.titles(): this.body());
          added_row = true;
        }
        td.insertAfter(prev);
        prev = td;
      }
      this.prev_row = data;
    },

    setCellValue: function(td, cell)
    {
      if (!cell.name) cell.name = "";
      if (!cell.value) cell.value = cell.name;
      if (cell.class || this.options.cell.class)
        td.setClass(this.options.cell.class.concat(cell.class));

      if (cell.style)
        td.addStyle(cell.style, this.options.cell.styles)

      if (td.attr('field') == 'actions')
        return this.createRowActions(td, cell.value);

      if (td.hasClass('expandable'))
        return td.find('.text').eq(0).text(cell.name);


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
      var self = this.element;
      obj.click(function() {
        var action = props.id;
        sink.trigger('action',[obj,action,props]);
        sink.trigger(action, [obj,props]);
        if (props.action === undefined) return;
        var key = sink.attr('key');
        if (key === undefined) key = self.options.key;
        var options = $.extend({},self.params, props, {id: action, action: props.action, key: key });
        var listener = self.closest('.page').eq(0);
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
      if (props.name === undefined) props.name = $.toTitleCase(action);
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
      tr.each(function() {
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
        var action = $.copy(all_actions[i]);
        var id = action.id;
        if (row_actions.indexOf(id) < 0) continue;
        action.key = key;
        action = $.fuse(action, opts[id]);
        actions.push(action);
        if (id == 'slide') {
          actions = slide_actions;
          slide_pos = i;
        }
      }
      if (slide_actions.length == 1)
        normal_actions.splice(slide_pos-1,1);
      if (normal_actions.length)
        opts.render.createItems(td, {}, undefined, normal_actions);
      if (slide_actions.length < 2) return;
      td.removeClass('truncate-word').addClass('nowrap');
      var slider = $('<div class="slide">').toggle(false).appendTo(td).addClass(this.slider.class.join(' '));
      var parent_class = this.slider.parent && this.slider.parent.class;
      if (parent_class)
        td.addClass(parent_class.join(' '));
      slider.data('actions', slide_actions);
    },

    slide: function(slider)
    {
      if (slider.children().length == 0) {
        this.options.render.createItems(slider, {}, undefined, slider.data('actions'));
        slider.find('[action]').click(function() {
          slider.parent().trigger('action',[$(this),'', $(this).attr('action')]);
        });
        slider.data('width', slider.width());
        slider.width(0);
      }
      slider.show().animate({width: slider.data('width')}, this.options.slideSpeed);
    },


    loadSubPages: function(tr, pages)
    {

      var expanded = $('<tr class=expanded></tr>');
      var td = $('<td></td>')
              .attr('colspan', tr.children('td').length)
              .addClass(this.options.expand.class.join(' '))
              .prependTo(expanded);
      expanded.insertAfter(tr);

      var key = tr.attr('key');
      var tmp = $('<div></div>');
      var index = 0;
      var load = function() {
        var path = pages[index];
        $.showPage({path: path, key: key }, td).done(function() {
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
      el.on('slide', function(e) {
        var btn = $(e.target).toggle();
        var slider = btn.siblings('.slide').eq(0);
        me.slide(slider);
        e.stopPropagation();
      })
      .on('expand', 'tr', function(e) {
        var tr = $(this);
        tr.find('[action=expand]').hide();
        tr.find('[action=collapse]').show();
        if (tr.next().hasClass('expanded')) return;
        var expand = options['expand'];
        if (!expand.pages) return;
        me.loadSubPages(tr, expand.pages)
        e.stopPropagation();
      })
      .on('collapse', 'tr', function(e) {
        var tr = $(this);
        tr.find('[action=collapse]').hide();
        tr.find('[action=expand]').show();
        var next = tr.next();
        if (next.hasClass('expanded')) next.remove();
        e.stopPropagation();
      })
      .on('action', '.slide', function(e, btn) {
        var slider = $(this);
        console.log("sliding on ",  e);
        slider.siblings('[action=slide]').toggle();
        slider.animate({width: 0}, options.slideSpeed*2, function() { slider.hide()});
      })
      .on('delete', 'tr', function(e) {
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
      })
      .on('addNewRow', function(e, data) {
        if (!$(e.target).is(el)) return;
        var tr = me.row_blueprint.clone(true);
        me.body().prepend(tr);
        me.setRowData(tr, data);
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
      return tr.filter('[field="'+id+'"]').eq(0);
    },

    getRowByKey: function(key)
    {
      return this.body().filter('[key="'+key+'"]');
    },

    getActionsHeight: function(tr)
    {
      return (tr.innerHeight()*0.99).toString()+'px';
    },

    initColumns: function()
    {
      var fields = this.options.fields;
      var widths = [];
      var total = this.element.width();
      for (var i in fields) {
        var field = fields[i];
        if (field.id == 'style' || field.data || !$.visible(field)) continue;
        field = $.extend(this.options[field.id], field);
        var width = field.width;
        if (width.indexOf('%') > 0)
          width = total * parseFloat(width) / 100;
        widths.push(width);
      }
      this.widths = widths;
      this.updateWidths();
    },

    createEditor: function(cls)
    {
      var td;
      var editor = $('<div>').addClass('datagrid-editor').addClass(cls).hide();
      var last = editor;
      this.widths.forEach(function(width, i) {
        var cell = $('<div>').addClass('cell cell-editor').insertAfter(last);
        var input = $('<input type=text>').attr('index', i).addClass('largest').appendTo(cell);
      });
      return editor;
    },


    createFilter: function()
    {
      var filter = this.head().find('.filter');
      if (filter.exists()) return filter;

      var me = this;
      var head = me.head();
      filter = me.createEditor('filter').appendTo(head);
      head.children('.cell-editor>input').bind('keyup cut paste', $.debounce(function(e) {
        var input = $(this);
        me.params.offset = 0;
        var index = input.attr('index')
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
      var footer = $('<tfoot>').appendTo(this.element);
      var tr = $('<tr>').addClass('actions').appendTo(footer);
      var td = $('<td>').appendTo(tr);
      var key = this.options.key;
      actions.map(function(action) {
        action.key = key;
        return action;
      })
      this.options.render.createItems(td, this.options, undefined, actions);
      this.spanColumns(td);
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
