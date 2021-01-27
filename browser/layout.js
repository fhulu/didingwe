(function( $ ) {
  $.widget( "ui.layout", {
    options: {
      title: "",
      width: "100%",
      row_height: "40px", 
      row_spacing: "10px",
      col_spacing: "20px",
      labels: "left",
      label_suffix: ":",
      input_mandatory: "yes",
      mandatory_indicator: "*"
    },

    _create: function() 
    {
      var el = this.element;
      el.css('width', this.options.width);
      if (this.options.title !== undefined) {
        window.document.title = this.options.title;
      }
      this._create_layout(el, this.options.layout);
    },
     
              
    _create_layout: function(parent, info)
    {
      var options = this.options;
      for (var i=0; i<info.length; i++) {
        var pane = info[i];
        if ($.isArray(pane)) {
          var div = this._create_entity(parent);
          this._create_layout(div, pane);
          continue;
        }
        var div = this._create_entity(parent, options[pane], pane);
        this._fill_containers(div, options[pane]);
      };
    },
    
    _fill_containers: function(div, info)
    {
      if (typeof info === 'string') {
        div.html(info);
        return;
      }
      for (var id in info) {
        if (typeof info[id] === 'string') continue;
        this._create_entity(div, info[id], id);
      }
    },
    
    _create_entity: function(parent, info, id)
    {
      var type = info !== undefined && info.hasOwnProperty('type')? info.type: 'div';
      var attr;
      if (type === 'input') {
        attr = 'text';
      }
      else  if (type === 'password' || type === 'radio' || type === 'checkbox') {
        attr = type;
        type = 'input';
      }
      else if (type==='image') {
        type = 'img';
      }
      var ent = $('<'+type+'></'+type+'>');
     // ent.css('width', '100%');
      
      if (id !== undefined) ent.attr('id', id);
      
      if (attr !== undefined) ent.attr('type', attr);
      
      if (parent !== undefined) ent.appendTo(parent);
      
      if (info === undefined || typeof info === 'string' ) return ent;

      for (var key in info) {
        if (typeof info[key] !== 'string' || key  === 'width' || key === 'type' || key==='label' || key  === 'tip') continue;
        ent.attr(key, info[key]); 
      }
      if (info.align !== undefined) {
        ent.css('display', 'inline-block');
      }
      else if (info.width === undefined) {
        ent.css('display', 'block');        
      }
      else {
        ent.css('width', info.width);
        ent.css('display', 'inline-block');
      }
      return ent.appendTo(parent);
    }
  })
}) (jQuery);

