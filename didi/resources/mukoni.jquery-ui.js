$(function(){

  // date picker extensions
	var old = $.fn.datepicker;
  $.fn.datepicker = function(options) 
  {
    options = $.extend({ dateFormat: 'yy-mm-dd'}, options );
    if (options.range !== undefined) {
      var now = new Date();
      switch(options.range) {
        case 'past': options.maxDate = now; break;
        case 'pastStrict': options.maxDate = now.setDate(now.getDate()-1); break;
        case 'future': options.minDate = now; break;
        case 'futureStrict': options.minDate = now.setDate(now.getDate()+1); break;
      }
    }
    var prev = options.onSelect;
    options.onSelect = function(text, inst)
    {
      if (prev !== undefined) prev(text, inst);
      $(this).change();
    }
    old.apply(this, [options]);
  }
});