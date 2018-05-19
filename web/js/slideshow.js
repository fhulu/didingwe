$.fn.slideshow = function(options) {
  var slides = this.children('.slideshow-slide').hide();
  slides.eq(options.start_slide).show();
  this.data('effects', options.effects);
  this.data('effect', -1);
}

$.fn.showNextSlide = function(duration) {
  var slides = this.children('.slideshow-slide');
  var index = parseInt(this.attr('current_slide'));
  var nextIndex = (index + 1) % slides.length;
  this.attr('current_slide', nextIndex);
  var zIndex = parseInt(this.attr('zIndex'));
  var current = slides.eq(index).css('z-index', zIndex+1);
  slides.eq(nextIndex).show();
  var effect = current.attr('effect');
  if (!effect) {
    var effects = this.data('effects');
    index = (this.data('effect')+1) % effects.length;
    this.data('effect', index);
    effect = effects[index];
  }

  current.toggle(effect, duration, "linear", function() {
    current.css('z-index', zIndex).hide();
  });
}
