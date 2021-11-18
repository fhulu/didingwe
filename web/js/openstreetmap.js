(function($) {
  $.widget("ui.mapper", {
    options: {
      zoom: 8,
      pin: null,
      value: null,
      marker: null,
      hint: null
    },
    _create: function()
    {
      var self = this;
      this.markers = {};
      this.hints = {};
      this.bouncing = null;
      this.element.on('customValue', function(event, value) {
        self.val(value);
      });

      this.show();


      if (this.options.load) {
        var data = { action: 'data', path: this.options.path + '/load', key: this.options.key };
        $.json('/', {data: data}, function(data) {
          self.addPoints(data);
        });
      }
      var pos = this.options.position;
      if (pos)
        this.addPoint(pos);


      this.markOnClick();
    },

    markOnClick: function()
    {
      if (!this.options.marker.addOnClick) return this;
      var self = this;
      this.map.on('click', function(event) {
        var marker = self.markers['click'];
        if (marker != undefined && self.options.marker.toggleOnClick) marker.remove(self.map);
        var pos = [event.latlng.lat, event.latlng.lng];
        marker = self.addPoint({
          id: 'click',
          latitude: pos[0],
          longitude: pos[1],
          color: self.options.marker.default_color,
          hint: self.options.marker.hint
        })
        self.element.trigger('map_click', [pos, marker]);
      });
    },

    _setOption: function( key, value ) {
      if (key === 'value')
        this.val(value);
    },

    addPoint: function(value)
    {
      var options = this.options.marker;
      if ($.isArray(value)) {
        var values = {};
         $.each(options.metadata, (key, index) => values[key] = value[index]);
        value = values;
      }

      var colors = options.colors;

      var icon_path = options.path+colors[value.color]+'-dot.png';

      icon = L.icon($.extend({iconUrl: icon_path}, options));
      var marker = L.marker(
        [parseFloat(value.latitude), parseFloat(value.longitude)],
        {icon: icon }
      );
      var el = this.element;
      if (value.hint) marker.bindPopup(value.hint);
      if (options.bouncingOptions) marker.setBouncingOptions(options.bouncingOptions);
        marker.on('mousemove', () => {
        if (options.popupOnMouseMove) marker.openPopup();
        el.trigger('marker_mousemove', [value.id, value]);
      })
      .on('click', () => {
        if (options.bounceOnClick) marker.toggleBouncing();
        el.trigger('marker_click', [value.id, value]);
      })
      .addTo(this.map);

      this.markers[value.id] = marker;

      return marker;
    },

    addPoints: function(data)
    {
      var self = this;
      data.forEach(function(value) {
        self.addPoint(value);
      });
    },

    show: function()
    {
      this.options.zoom = parseInt(this.options.zoom);
      if (!this.map) {
        this.map = L.map(this.element[0].id);
        L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
          attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
          maxZoom: 18,
          id: 'mapbox/streets-v11',
          tileSize: 512,
          zoomOffset: -1,
          accessToken: this.options.access_token
        }).addTo(this.map);
      }
      this.map.setView(this.options.center, this.options.zoom);
      return this;
    },

    location: function(latitude, longitude)
    {
      this.options.center = [latitude, longitude];
      this.map.panTo(this.options.center);
      return this;
    },

    val: function(value)
    {
      if (value === undefined) {
        return join([this.position.lat(), this.position.lng()]);
      }
      var position = $.isArray(value)? value: value.split(',');
      this.location(position[0], position[1]);
      return this;
    },

    toggleBounce: function(id, on) {
      var marker = this.getMarker(id);
      if (!marker) return this;
      if (on===undefined) marker.toggleBouncing();
      on? marker.bounce(): marker.stopBouncing();
      return this;
    },

    bounce: function(id) { return this.toggleBounce(id, true) },
    bounceOff: function(id) { return this.toggleBounce(id, true) },
    
    getMarker: function(id, warn) {
      var marker = this.markers[id];
      if (!marker && (warn || warn === undefined)) 
        console.warn("No marker with id", id);
      return marker;
    },

    center: function(id) {
      var marker = this.getMarker(id, true);
      if (!marker) return this;
      var pos = marker.getLatLng();
      return this.location(pos.lat, pos.lng);
    },

    zoom: function(level) {
      if (!level) level = this.options.marker.zoom;
      this.options.zoom = level;
      this.map.setZoom(level);
      return this;
    }
  })
})(jQuery);
