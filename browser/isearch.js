$.widget( "custom.isearch", {
  options: {
    categoryPrefix: "-",
    fields:  ['value','name'],
    choose: "$name",
    chosen: "$name",
    flags: []
  },

  _create: function ()
  {
    var me = this;
    var el = me.element;
    var opts = me.options;
    me.params = { action: 'values', path: opts.path, key: opts.key, offset: 0, size: opts.drop.autoload  };
    me.searcher = el.find('.isearch-searcher').on('keyup input cut paste', function() {
      el.val("")
      me.params.offset = 0;
      me.drop.width(el.width()).show();
      me._load();
    });

    if (opts.adder && opts.adder.url)
      el.find('.isearch-adder').show().click(function(){ me.drop.hide() })

    var dropper = el.find('.isearch-dropper').click(function() {
      if ($(this).hasClass('disabled')) return;
      if (me.drop.is(":visible")) {
        me.drop.hide();
        return;
      }
      me.params.offset = 0;
      el.val("");
      me.searcher.val("");
      me._load();
      var offset = el.offset();
      me.drop.css({left: offset.left, top: (offset.top + parseInt(el.css('height').match(/\d+/)))} );
    });

    me.drop = el.find('.isearch-drop').on('click', '.isearch-option', function() {
      el.data('source', $(this).data('source'));
      $(this).trigger('selected', [$(this).attr('value'), $(this).attr('chosen')]);
    })
    .scroll($.proxy(me._scroll,me))
    .click(function() {  me.drop.hide() })

    $(document).click(function() { me.drop.hide(); });

    el.on('selected', function(e, value, chosen) {
      el.attr('value', value);
      me.searcher.val(chosen).select();
      me.drop.hide();
    })
    .on('added', function( event, data) {
      el.trigger('selected', [data[0], data[1]]);
    })
    .click(function(e) { e.stopPropagation(); });
  },

  _scroll: function(e) {
    var me = this;
    var drop = me.drop;
    if(drop.scrollHeight() - drop.scrollTop() != drop.height() || me._loading()) return;
    if (me.params.total && me.params.offset + me.params.size > me.params.total) return;
    me.params.offset += me.params.size;
    me._load();
  },

  _loading: function(val) {
    if (val == undefined) return this.drop.data('loading');
    this.drop.data('loading', val);
  },

  _load: function() {
    var me = this;
    if (me._loading()) return;
    me._loading(true);
    var el = me.element;
    var opts = me.options;
    me.params.term = me.searcher.val();
    el.val("");
    me.drop.width(el.width()).show();
    var start = new Date().getTime();
    $.json('/', {data: me.params}, function(result) {
      var end = new Date().getTime();
      console.log("Load: ", end - start);
      if (result._responses)
        el.triggerHandler('server_response', [result]);
      if (!result.data) return;
      el.trigger('loaded', [result]);
      me._populate(result.data);
      me._loading(false);
      delete result.data;
      $.extend(me.params, result);
      console.log("Populate: ", new Date().getTime() - end);
    });
  },

  _populate: function(data) {
    var me = this;
    var opts = me.options;
    var drop = me.drop;
    if (!me.params.offset) drop.scrollTop(0).children().remove();
    var maxHeight = parseInt(drop.css('max-height'));
    me.autoScrolls = 0;
    $.each(data, function(i, row) {
      var option = mkn.copy(opts.option);
      option.array = row;
      option = opts.render.initField(option, opts);
      me._boldTerm(option, me.params.term);
      opts.render.create(option).data('source', row).appendTo(drop);
    })
  },

  _boldTerm: function(option, term)
  {
    var terms = term.split(' ');
    for (var i in option.embolden) {
      var key = option.embolden[i];
      var value = mkn.escapeHtml(option[key]);
      for (var j in terms) {
        var term = terms[j].trim();
        if (term == '') continue;
        value = value.replace(
                  new RegExp(
                    "(?![^&;]+;)(?!<[^<>]*)(" +
                    $.ui.autocomplete.escapeRegex(term) +
                    ")(?![^<>]*>)(?![^&;]+;)", "gi"),
                  "<strong>$1</strong>")
      }
      option[key] = value;
    }
  },

});
