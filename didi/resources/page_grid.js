(function( $ ) {
  $.widget( "ui.pageGrid", {
    options: {
      title: "",
      width: "100%",
      row_height: "40px", 
      row_spacing: "10px",
      col_widths: [30, 50, 20 ], 
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
      if (this.options.title != '') {
        var title = $("<p></p>");
        title.addClass('title').text(this.options.title);
        el.append(title);
        window.document.title = this.options.title;
      }
      var rows = this.options.rows;
      for (var i = 0; i< rows.length; ++i) {
        this._create_row(i);
      }
    },
    
    _create_row: function(row_idx)
    {
      var row = $('<div></div>');
      var self = this;
      var el = this.element;
      var row_info  = this.options.rows[row_idx];
      var row_width = 100;
      var widths = this.options.col_widths;
      var height = this.options.row_height;
      var col_idx = 0;
      for (var id in row_info) {
        if (!row_info.hasOwnProperty(id)) continue;
        var ctl_info = row_info[id];
        if (ctl_info.hasOwnProperty('label')) {
          var label = ctl_info.label;
          var label = $('<p></p>');
          label.text(ctl_info.label+self.options.label_suffix);
          label.css('display', 'inline-block');
          label.css('width', widths[col_idx++]);
          label.css('text-align', 'right');
          row.append(label);
        }
        var ctl;
        var type = ctl_info.type;
        if (type === "input" || type === "password") {
          ctl = $('<input></input>');
          ctl.attr('type', type === "input"? 'text': type);
        }
        else {
          if (type==='image') {
            type = '<div>'
            type = 'img';
          }
          ctl = $('<'+type+'></'+type+'>');
        }
        ctl.attr('id', id).attr('name', id);
        for (var attr in ctl_info) {
          if (attr === 'type' || attr==='label' || attr === 'tip') continue;
          ctl.attr(attr, ctl_info[attr]);
        }
        var width = widths[col_idx++];
        ctl.css('margin-right', this.options.col_spacing);
        if (ctl_info.rowspan === undefined) {
          ctl.css('width', width.toString()+'%');
          ctl.css('height', height);
        }
        else {
          row.css('margin-bottom',this.options.row_spacing);
          row_width -= width;
          row.css('width',row_width.toString()+'%');
          row_width = width;
          row.attr('display', 'inline-block');
          el.append(row);
          row = $('<div></div>');
        }
        row.append(ctl);
      }
      row.css('margin-bottom',this.options.row_spacing);
      row.css('width',row_width.toString()+'%');
      this.element.append(row);
    }
    
  })
}) (jQuery);

