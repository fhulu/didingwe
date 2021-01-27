
$.widget("ui.plotter", {
  options: {
    fixed_xaxis: true
  },



  _create: function()
  {
    var self= this;

    var options = this.options;
    if (options.axesDefaults)
      options.axesDefaults.tickRenderer = $.jqplot[options.axesDefaults.tickRenderer];
    if (options.axes.xaxis)
      options.axes.xaxis.renderer = $.jqplot[options.axes.xaxis.renderer];
    if (options.axes.yaxis)
      options.axes.yaxis.renderer = $.jqplot[options.axes.yaxis.renderer];
    options.seriesDefaults.renderer = $.jqplot[options.seriesDefaults.renderer];
    if (this.options.values) {
      var data = { action: 'values', path: this.options.path , key: this.options.key };
      console.log("about to json", data);
      $.json('/', {data: data}, function(result) {
          self.plot(result.data);
      });
    }
    else if (this.options.data)
      self.plot(this.options.data);
  },

  to_jqplot: function(field, value, sub_value)
  {
    if (!field) return;
    if (sub_value !== undefined) {
      field = field[value];
      value = sub_value;
    }
    if (field && field[value]) field[value] = $.jqplot[field[value]];
  },

  transpose: function(data)
  {
    var result = data[0].map(function(col, i) {
      return data.map(function(row) {
        return row[i]
      })
    });
    return result;
  },

  fix_xaxis: function(data)
  {
    data = this.transpose(data);
    var xaxis = data.shift();
    for (var row in data) {
      for (var col in data[row]) {
        data[row][col] = [xaxis[col], parseFloat(data[row][col])];
      }
    }
    console.log("data", data);
    return data;
  },

  parseData: function(data) {
    for (var row in data) {
      for (var col in data[row]) {
        data[row][col] = parseFloat(data[row][col]);
      }
    }
  },

  plot: function(data)
  {
    this.parseData(data);
    var options = $.extend({}, this.options);
    options.title = { text: options.name, color: options.titleColor }
    //this.to_jqplot(options.axesDefaults, "tickRenderer");
    // if (options.axes) {
      // this.to_jqplot(options.axes.yaxis, "renderer");
      // this.to_jqplot(options.axes.xaxis, "renderer");
    // }

    this.plot = $.jqplot(this.options.id, data, options );
  }

});
