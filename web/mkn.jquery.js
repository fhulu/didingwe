$.fn.exists = function()
{
  return this.get(0) != undefined;
}

$.fn.hasAttr = function(name) 
{  
  return this.attr(name) !== undefined;
}

$.fn.enableWhen = function(condition)
{
  if (condition())
    this.attr('disabled', 'disabled');
  else
    this.removeAttr('disabled');
}

$.fn.enableOnSet = function(controls, events)
{
  this.attr('disabled','disabled');
  controls = $(controls).filter(':visible').filter('input,select,textarea');
  var self = this;
  controls.bind('keyup input cut paste click change onClose', function() {
    var set = 0;
    controls.each(function() {
      if ($(this).val() != '') ++set;
    });
    if (set < controls.length)
      self.attr('disabled', 'disabled');
    else
      self.removeAttr('disabled');
  });
}

$.fn.values = function()
{
  var data = {};
  $(this).filter('input,textarea,select').each(function() {
    var ctrl = $(this);
    var name = ctrl.hasAttr('id')? ctrl.attr('id'): ctrl.attr('name');
    if (name === undefined) return true;
    var type = ctrl.attr('type');
    if (type=='radio') ctrl = ctrl.filter(':checked');
    data[name] = ctrl.val();
  });
  return data;
}

$.fn.submit = function(url, callback, method)
{
  var data = $(this).values();
  var method = method === undefined? 'post': method;
  var async = callback === false? false: true;
  var result;
  $.ajax({
    type: method,
    url: url,
    data: data,
    async: async,
    success: function(data) {
      var script = data.match(/<script[^>]+>(.+)<\/script>/);
      if (script != null && script.length > 1) {
        eval(script[1]);
        return;
      }
      result = data;
      if (callback !== false && callback !== undefined)
        callback(result);
    }
  });
  return result;
}

$.fn.confirm = function(url, event)
{
  $(this).submit(url, function(result) {
    if (result !== undefined && result.charAt(0) == '!') {
      alert(result.substr(1));
      if (event !== undefined) event.stopImmediatePropagation();
      return false;
    }
    result = $.trim(result);
    if (result !== undefined && result != '') {
      if (!confirm(result)) {
        if (event !== undefined) event.stopImmediatePropagation();
        return false;
      }
      return true;
    }  
  });
}
