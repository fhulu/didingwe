(function($) {
  $.widget("didi.file_uploader", {
    options: {
      uploader: ''
    },

    _create: function()
    {
      var options = this.options;
      var el = this.element;
      var upload = el.find('#upload,[action=upload]').bindFirst('click',function() {
        el.attr('value', el.find('#file').val());
      })
      .on('upload', function() {
        form.attr('action', '/?action=action&path='+encodeURIComponent(options.path)+'&key='+options.key+'&'+el.attr('id')+'='+el.attr('value'));
        form.submit();
      })
      var progress = el.find('#progress');
      var file = el.find("#file").change(function() {
        uploaded.hide();
        failed.hide();
        upload.show();
        progress.hide();
      });
      var bar = el.find('#bar');
      var percent = el.find("#percent");
      var cancel = el.find('#cancel');
      var uploaded = el.find('#uploaded');
      var failed = el.find('#failed');
      var form = el.find('form').ajaxForm({
        beforeSend: function(xhr)
        {
          bar.width('0%');
          percent.html('0%').css('z-index', parseInt(bar.css('z-index'))+1);
          progress.width('100%').fadeIn();
          $('.error').remove();
          upload.hide();
          uploaded.hide();
          failed.hide();
          cancel.click(xhr.abort).show();
        },

        uploadProgress: function(event, position, total, done)
        {
          bar.width(done + '%');
          percent.html('Uploaded ' + position + ' of ' + total +'(' + done +'%)');
        },

        success: function(result, textStatus, xhr)
        {
          result = $.parseJSON(result);
          el.triggerHandler('server_response', [result]);
          if (result && result._responses && result._responses.errors)
            return this.error();
          return this.showResult(uploaded);
        },

        error: function()
        {
          return this.showResult(failed);
        },

        showResult: function(result)
        {
          cancel.hide();
          progress.animate({width:0}, 200, function() {
            percent.hide();
            result.show();
          });
          return this;
        }
      });
    }
  })
})(jQuery);
