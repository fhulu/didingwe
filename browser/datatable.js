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
  $.widget( "ui.datatable", {
    options: {
      name: 'Untitled',
      flags: [],
    },

    _create: function()
    {
      var me = this;
      me.widths = [];
      var opts = me.options;
      if (opts.sort) opts.flags.push('sortable');
      var r = opts.render;
      r.expandFields(opts, "fields", opts.fields);
      var row = r.initField(opts.row, opts);
      me.row_classes = opts.row.class.join(' ');
      me.cell = r.initField(opts.cell, opts);
      me.cell.class = me.cell.class.join(' ')
      $.extend(opts.row_styles,opts.row.styles);
      opts.row_actions = opts.row_actions.concat(opts.row.actions);
      opts.render.expandFields(opts, "row_actions", opts.row_actions);
      me.auto_widths = [];
      me._init_params();
      me.head().addClass(opts.head.class.join(' ')).prependTo(me.element);
      me.showHeader();
      me.showTitles();
      me.createRowBlueprint();
      if (this.options.no_records)
        this.no_records = this.element.find('#no_records');
      me.head().toggle(me.hasFlag('show_titles') || me.hasFlag('show_header') || me.hasFlag('filter'));
      me.showFooterActions();
      me.showData();
      me.element.on('refresh', function(e, args) {
        me.showData(args);
        e.stopImmediatePropagation();
      })
      me.body().scroll($.proxy(me._scroll,me));
      me.bindRowActions()
    },

    _init_params: function()
    {
      this.params = { page_num: 1, offset: 0};
      var exclude = [ 'create', 'action', 'css', 'id', 'content', 'disabled',
          'html','name', 'page_id', 'position', 'sort', 'script','slideSpeed', 'text', 'tag', 'target', 'type'];
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
      return this.element.children('thead').eq(0);
    },

    body: function()
    {
      return this.element.children('tbody').eq(0);
    },

    load: function(args)
    {
      var start = new Date().getTime();
      var me = this;
      var opts = me.options;
      me.head().find('.paging [action]').attr('disabled','');
      var data = $.extend(opts.request, args, {action: 'values'}, me.params);
      var selector = opts.selector;
      if (selector !== undefined) {
        $.extend(data, $(selector).values());
      }

      var el = me.element;
      me.loading = true;
      $.json('/', {data: mkn.plainValues(data)}, function(data) {
        if (!data) return;
        if (data._responses)
          el.triggerHandler('server_response', [data]);
        el.trigger('refreshing', [data]);
        var end = new Date().getTime();
        console.log("Load: ", end - start);
        me.populate(data);
        me.loading = false;
        el.triggerHandler('refreshed', [data]);
        delete data.data;
        $.extend(me.params, data);
        console.log("Populate: ", new Date().getTime() - end);
      });
    },

    populate: function(data)
    {
      if (data === undefined || data === null) {
        console.log('No table data for table:', this.params.field);
        return;
      }
      if (this.options.page_size !== undefined) this.showPaging(parseInt(data.total));
      this.no_records.hide();
      if (data.data.length == 0 && this.body().children().length == 0 && this.no_records)
        this.element.append(this.no_records.show());

      for(var i in data.data) {
        this.addRow(data.data[i]);
      }
      this.adjustWidths();
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
      head.html('');
      var tr = $('<tr class=header></tr>').appendTo(head);
      var th = $('<th></th>').appendTo(tr);
      if (this.options.name !== undefined)
        $('<div class=heading></div>').html(this.options.name).appendTo(th);

      var self = this;
      if (this.hasFlag('filter')) {
        this.createAction('filter').appendTo(th);
        this.element.on('filter', function(e) {
          self.showFilter();
          e.stopImmediatePropagation();
        });
      }
      if (this.options.page_size !== undefined && !this.hasFlag('hide_paging')) this.createPaging(th);
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
      var head = this.head();
      var opts = this.options;
      var tr = head.find('.titles').empty();
      if (!tr.exists()) tr = $('<tr class=titles>').appendTo(head);
      if (!this.hasFlag('show_titles')) tr.hide();
      var self = this;
      var fields = opts.fields;
      var classes = opts.title.class.join(' ');
      for (var i in fields) {
        var field = fields[i];
        var id = field.id;
        if (field.id=='style') continue;
        var th = $('<th></th>').addClass(classes).appendTo(tr);
        th.toggle(mkn.visible(field));
        th.data('field', field);
        if (field.class) th.addClass(field.class.join(' '));
        if (id === 'actions') {
          field.filter = false;
          continue;
        }
        if ($.isArray(field.name)) field.name = field.name[field.name.length-1];
        th.html(field.name || toTitleCase(id));
        if (self.hasFlag('sortable')) {
          if (id === self.params.sort)
            th.attr('sort', self.params.sort_order);
          else
            th.attr('sort','');
        }
        if (field.width !== undefined) {
          th.css('width', field.width);
        }
        if (self.hasFlag('sortable'))
          self.bindSort(th, field);
      };
      this.spanColumns(head.find('.header th'));
      this.updateWidths(head.find('.titles').children());
    },

    createRowBlueprint: function()
    {
      var me = this;
      var tr = $('<tr>').addClass(me.row_classes);
      var cls = me.cell.class;
      me.defaults = {}
      var fields = me.options.fields;
      for (var i in fields) {
        var field = fields[i];
        me.defaults[field.id] = field.new;
        delete field.new;
        if (field.id == 'style') continue;
        var td = $('<td>').appendTo(tr);
        td.attr('field', field.id);
        td.toggle(mkn.visible(field));
        td.addClass(cls);
        if (field.class) td.addClass(field.class.join(' '));
        if (field.html === undefined) continue;
        field = mkn.copy(field);
        delete field.width;
        td.append(me.options.render.create(field));
      }
      me.row_blueprint = tr;
    },

    spanColumns: function(td)
    {
      var tr = this.head().find('.titles');
      if (!tr.exists()) tr = this.body().children('tr').eq(0);
      td.attr('colspan', tr.children().length);
    },

    spanData: function(field, row, col)
    {
      if (field.span <= 1) return row[col];
      var span = row.slice(col, col+field.span);
      return span.join(' ');
    },

    showData: function(args)
    {
      var me = this;
      var body = me.body();
      var opts = me.options;
      var max_height  = parseInt(body.css('max-height'));
      if (opts.page_size == 0 || max_height > 0) {
        var row_height = parseInt($('<tr><td>Loading...</td></tr>').appendTo(body).height());
        if (row_height < 1) row_height = opts.min_row_height;
        me.params.size = Math.ceil(max_height/row_height)+1;
      }
      body.addClass(opts.body.class.join(' '));
      body.empty();
      me.load(args);
      me.spanColumns(me.head().find('.header>th'));
    },

    setRowStyles: function(row, styles) {
      var row_styles = this.options.row_styles;
      if (!row_styles) return;
      row.attr('class','');
      row.addClass(this.row_classes);
      styles.split(',').forEach(function(style) {
        var classes = row_styles[style];
        if (!classes) return;
        row.addClass(classes.join(' '));
      });
    },

    addRow: function(row) {
      var tr = this.row_blueprint.clone();
      row = $.extend({}, this.options.defaults, row);
      this.updateRow(tr, row);
      tr.appendTo(this.body());
    },

    updateRow: function(tr, data)
    {
      var me = this;
      var key;
      var expandable = false;
      var col = 0;
      var fields = this.options.fields;
      var tds = tr.children();
      for (var i in fields) {
        var field = fields[i];
        var cell = data[i];
        if (cell === null || cell === undefined)
          cell = this.options.defaults[field.id];
        else if (field.escapeHtml)
          cell = mkn.escapeHtml(cell);

        if (field.id == 'style') {
          me.setRowStyles(tr, cell);
          continue;
        }
        if (key === undefined && (field.id === 'key' || field.key))
          tr.attr('key', cell);

        me.setCellValue(tds.eq(col), cell);
        ++col;
      }
      me.adjustColWidths(tr);
    },

    adjustColWidths: function(tr)
    {
      var widths = this.widths;
      tr.children().each(function(i) {
        var width = $(this).width();
        if (i==widths.length)
          widths.push(width);
        else if (widths[i] < width)
          widths[i] = width;
      });
    },

    setCellValue: function(td, value)
    {
      if (td.attr('field') == 'actions')
        return this.createRowActions(td, value);

      if (td.hasClass('expandable'))
        return td.find('.text').eq(0).text(value);

      var obj = td.children().eq(0);
      if (!obj.exists())
        return td.text(value).attr('title', value);

      obj.value(value);
      return td;
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
      var expanded = $('<tr class=expanded></tr>');
      var td = $('<td></td>')
              .attr('colspan', tr.children('td').length)
              .prependTo(expanded);
      expanded.insertAfter(tr);

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
      el.on('slide', 'tr', function(e) {
        $(e.target).toggle();
        me.slide($(this));
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
      .on('action', 'tr', function(e, btn) {
        if (!btn.parent('.slide').exists()) return;
        me.slide($(this));
        $(this).find('[action=slide]').toggle();
        var slider = $(this).find('.slide');
        slider.animate({width: 0}, options.slideSpeed*2, function() { slider.hide()});
        e.stopPropagation();
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
        me.setCellValue(me.getCellById(tr, id), value);
      })
      .on('setRowData', function(e, key, data) {
        if (!$(e.target).is(el)) return;
        me.setRowData(me.getRowByKey(key), data);
      })
      .on('addRow', function(e, data) {
        if (!$(e.target).is(el)) return;
        me.addRow(data);
        me.adjustWidths();
      })
      .on('addNewRow', function(e, data) {
        if (!$(e.target).is(el)) return;
        var tr = me.row_blueprint.clone();
        me.body().prepend(tr);
        me.setRowData(tr, data);
        me.adjustWidths();
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

    initWidths: function(ths,tds)
    {
      var fields = this.options.fields;
      var widths = this.widths;
      var col = -1;
      for (var i in fields) {
        var field = fields[i];
        if (field.id == 'style') continue;
        ++col;
        var th = ths.eq(col);
        var td = tds.eq(col);
        if (field.width !== undefined) {
          th.css('width', field.width);
          td.css('width', th.get(0).style.width);
        }
        else if (field.width !== 'auto') {
          th.css('width', 'auto');
          td.css('width', 'auto')
        }
      };
    },

    updateWidths: function(cells)
    {
      var widths = this.widths;
      cells.each(function(i) {
        var width = $(this).width();
        if (i === widths.length)
          widths.push(width);
        else if (width > widths[i])
          widths[i] = width;
      })
    },

    adjustWidths: function()
    {
      var ths = this.head().find('.titles').children();
      var tr1 = this.body().find('tr:first-child');
      var tds = tr1.children();
      this.initWidths(ths,tds);
      this.updateWidths(tds);
      var widths = this.widths;
      var sum = widths.reduce(function(a,b) { return a + b});
      var fields = this.options.fields;
      var col = 0;
      for (var i in fields) {
        var field = fields[i];
        if (field.id == 'style') continue;
        if (field.width !== undefined) continue;;
        var th = ths.eq(col);
        var width = ((widths[col]/sum)*100) + '%';
        if (th.exists()) {
          th.css('width', width);
          width = th.get(0).style.width
        }
        tds.eq(col).css('width', width);
        ++col;
      }

      tr1.siblings().each(function(i) {
        $(this).children().each(function(i) {
          $(this).css('width', tds.eq(i).get(0).style.width);
        });
      })
    },


    createEditor: function(template, cls)
    {
      var editor = template.clone(true);
      var td;
      editor.addClass('datatable-editor').addClass(cls);
      editor.children().each(function(i) {
        var th = $(this).off();
        th.text('');
        var field = $(this).data('field');
        if (!field[cls]) return;
        th.append($('<input type=text></input>').css('width','100%'));
      });
      editor.insertAfter(template);
      return editor;
    },

    incrementalSearch: function(tds,input) {
      var me = this;
      if (!me.searchInputs) {
        if (me.searchInterval) {
          clearInterval(me.searchInterval);
          me.searchInterval = null;
        }
        return;
      }
      me.searchInputs = 0;
      me.params.offset = 0;
      var td = input.parent();
      var index = tds.index(td);
      me.params['f'+index] = input.value();
      me.refresh();
    },

    createFilter: function()
    {
      var filter = this.head().find('.filter');
      if (filter.exists()) return filter;

      var me = this;
      var titles = me.head().find('.titles');
      filter = me.createEditor(titles,'filter').hide();
      var tds = filter.children();
      this.searchInputs = 0;
      filter.find('input').bind('keyup cut paste', function(e) {
        ++me.searchInputs;
        var input = $(this);
        if (!me.searchInterval) {
          me.searchInterval = setInterval(function() {
            me.incrementalSearch(tds,input);
          }, me.options.searchDelay);
        }
      });
      return filter;
    },

    showFilter: function()
    {
      var filter = this.createFilter();
      filter.toggle();
      if (filter.is(':visible'))
        this.adjustWidths(filter);
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
