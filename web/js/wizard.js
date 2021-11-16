$.widget( "didi.wizard", {
  _create: function() {
    this.stack = new Array();
    this.first_step = 0;
    this.createPages();
    this.bindActions();
    this.stack = new Array();
    this.jumpTo(0);
  },


  child: function(selector, index) {
    if (!index) index = 0;
    return this.element.find(selector).eq(index);
  },

  createPages: function() {
    var me = this;
    var opts = me.options;
    var step = opts.render.create(opts, 'step_container', true);
    opts.step = opts.render.initField(opts.step,opts);
    var pending_style = opts.bookmarks.state_styles['pending'];
    if ($.isArray(pending_style)) pending_style = pending_style.join(' ')
    $.each(opts.steps, function(i, info) {
      step.clone().attr('step', info.id).hide().appendTo(me.element);
      me.child('.wizard-bookmark', i).addClass(pending_style);
    })
  },


  jumpTo: function(index) {
    if ($.isPlainObject(index)) index = index.index;
    if (typeof index === 'string') {
      var page = this.child('.wizard-page[step="'+index+'"]');
      if (!page.exists()) return;
      index = this.element.children('.wizard-page').index(page);
    }
    if (this.stack.length) {
      var top_index = this.stack[this.stack.length-1];
      if (index === top_index) return;
      if (top_index < index) {  // going forward
        this.hidePage(top_index, 'done');
      }
      else do { // goin backwards
          top_index = this.stack.pop();
          this.hidePage(top_index, 'visited');
      } while (top_index >  index);
    }

    this.showPage(index);
    delete this.next_step;
  },

  showPage: function(index) {
    var page = this.child('.wizard-page', index);
    var props = this.options.steps[index];
    if (!page.find('.wizard-step').exists() || props.clear) {
      this.child('.wizard-navigate').empty();
      this.loadPage(page, index);
    }
    else {
      page.show().triggerHandler('reload');
    }

    this.updateBookmark(index, 'active');
    this.stack.push(index);
  },

  updateBookmark: function(index, state)
  {
    var styles = this.options.bookmarks.state_styles;
    var bm = this.child('.wizard-bookmark',index)
    $.each(styles, function(key, style) {
      if ($.isArray(style)) style = style.join(' ')
      bm.removeClass(style);
    });
    var style = styles[state];
    if ($.isArray(style)) style = style.join(' ')
    bm.addClass(style);
  },

  updateNavigation: function(index, info, page) {
    var me = this;
    var opts = me.options;
    var last_step = me.options.steps.length-1;
    if (info.prev === false) {
      me.element.find('.wizard-bookmark').each(function(i) {
        if (i < index) me.updateBookmark(i, 'committed');
      })
    }
    else if (index != me.first_step)
      info.navigate.unshift({prev: opts.prev});

    if (info.next != false && index != last_step) {
      opts.next.path = info.path;
      var next = $.copy(opts.next);
      next.post_prefix = info.post_prefix;
      info.navigate.push({next: next});
    }

    info.navigation.path = info.path;
    var nav = opts.render.create(info, 'navigation', true);
    nav.find('.wizard-next').bindFirst('click', function() {
      if (me.next_step !== undefined) return;
      me.next_step = typeof info.next === 'string'? info.next: index+1;
    });
    page.append(nav);
  },


  hidePage: function(index, state)
  {
    this.child('.wizard-page', index).hide();
    this.updateBookmark(index, state)
  },

  loadPage: function(page, index)
  {
    var me = this;
    var options = me.options;
    var props = options.steps[index];
    if (typeof props == 'string')
      props = { id: props };
    else if (!props.id)
      props.id = $.firstKey(props);
    var path = options.path;
    if (props.id.indexOf('/') >= 0)
      path = props.id;
    else if (props.url !== undefined)
      path = props.url;
    else if (path.indexOf('/') === -1)
      path += '/' + props.id;
    else
      path = path.substr(0, path.lastIndexOf('/')+1) + props.id;
    page.empty();
    $.loadPage({path: path, key: options.key}, page).then(function(info, options) {
      info.fields = $.merge(me.options.step, info.fields);
      info.fields = $.merge(info.fields, props);
      info.fields.path = info.path;
      var object = $.createPage(options, info, page);
      me.updateNavigation(index, info.fields, page);
      page.show();
    });
  },


  bindActions: function()
  {
    var me = this;
    me.element.on('wizard-jump', function(event, params) {
      me.jumpTo(params);
    })

    .on('wizard-next', function() {
      me.jumpTo(me.stack[me.stack.length-1]+1);
    })

    .on('wizard-prev', function() {
      me.jumpTo(me.stack[me.stack.length-2]);
    })

    .on('post_success', function(event, result) {
      if (result && result.next_step) me.next_step = result.next_step;
      if (!me.stack.length || !me.next_step) return;
      if (me.next_step === true) me.element.trigger('wizard-next');
      if (me.next_step) me.jumpTo(me.next_step);
    })

    .find('.wizard-bookmark').click(function() {
      if ($(this).hasClass('wizard-state-done')) me.jumpTo($(this).attr('step'));
    })

  },

  nextStep: function(step)
  {
    this.next_step = step;
  }
})
