
/*
  * jQueryFileTree Plugin
  *
  * @author - Cory S.N. LaViska - A Beautiful Site (http://abeautifulsite.net/) - 24 March 2008
  * @author - Dave Rogers - (https://github.com/daverogers/)
  *
  * Usage: $('.fileTreeDemo').fileTree({ options }, callback )
  *
  * TERMS OF USE
  *
  * This plugin is dual-licensed under the GNU General Public License and the MIT License and
  * is copyright 2008 A Beautiful Site, LLC.
 */
var bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

(function($, window) {
  var FileTree;
  FileTree = (function() {
    function FileTree(el, args, callback) {
      this.onEvent = bind(this.onEvent, this);
      var $el, _this, defaults;
      $el = $(el);
      _this = this;
      defaults = {
        root: '/',
        script: '/files/filetree',
        folderEvent: 'click',
        expandSpeed: 500,
        collapseSpeed: 500,
        expandEasing: 'swing',
        collapseEasing: 'swing',
        multiFolder: true,
        loadMessage: 'Loading...',
        errorMessage: 'Unable to get file tree information',
        multiSelect: false,
        onlyFolders: false,
        onlyFiles: false
      };
      this.jqft = {
        container: $el
      };
      this.options = $.extend(defaults, args);
      this.callback = callback;
      this.data = {};
      $el.html('<ul class="jqueryFileTree start"><li class="wait">' + this.options.loadMessage + '<li></ul>');
      _this.showTree($el, escape(this.options.root), function() {
        return _this._trigger('filetreeinitiated', {
          options: _this.options
        });
      });
      $el.delegate("li a", this.options.folderEvent, _this.onEvent);
    }

    FileTree.prototype.onEvent = function(event) {
      var $ev, _this, callback, jqft, options, ref, prevent;
      $ev = $(event.target);
      options = this.options;
      jqft = this.jqft;
      _this = this;
      callback = this.callback;
      _this.data = {};
      _this.data.li = $ev.closest('li');
      _this.data.type = (ref = _this.data.li.hasClass('directory')) != null ? ref : {
        'directory': 'file'
      };
      _this.data.value = $ev.text();
      _this.data.rel = $ev.prop('rel');
      _this.data.container = jqft.container;
      _this.data.options = _this.options;
      prevent = _this._trigger('filetreeclick', _this.data);
      if(prevent === true) {
        return false;
      }
      if ($ev.parent().hasClass('directory')) {
        if ($ev.parent().hasClass('collapsed')) {
          if (!options.multiFolder) {
            $ev.parent().parent().find('UL').slideUp({
              duration: options.collapseSpeed,
              easing: options.collapseEasing
            });
            $ev.parent().parent().find('LI.directory').removeClass('expanded').addClass('collapsed');
          }
          $ev.parent().removeClass('collapsed').addClass('expanded');
          $ev.parent().find('UL').remove();
          return _this.showTree($ev.parent(), $ev.attr('rel'), function() {
            _this._trigger('filetreeexpanded', _this.data);
            return callback != null;
          });
        } else {
          return $ev.parent().find('UL').slideUp({
            duration: options.collapseSpeed,
            easing: options.collapseEasing,
            start: function() {
              return _this._trigger('filetreecollapse', _this.data);
            },
            complete: function() {
              $ev.parent().removeClass('expanded').addClass('collapsed');
              _this._trigger('filetreecollapsed', _this.data);
              return callback != null;
            }
          });
        }
      } else {
        if (!options.multiSelect) {
          jqft.container.find('li').removeClass('selected');
          $ev.parent().addClass('selected');
        } else {
          if ($ev.parent().find('input').is(':checked')) {
            $ev.parent().find('input').prop('checked', false);
            $ev.parent().removeClass('selected');
          } else {
            $ev.parent().find('input').prop('checked', true);
            $ev.parent().addClass('selected');
          }
        }
        _this._trigger('filetreeclicked', _this.data);
        return typeof callback === "function" ? callback($ev.attr('rel')) : void 0;
      }
    };

    FileTree.prototype.showTree = function(el, dir, finishCallback) {
      var $el, _this, data, handleFail, handleResult, options, result;
      $el = $(el);
      options = this.options;
      _this = this;
      $el.addClass('wait');
      $(".jqueryFileTree.start").remove();
      data = {
        dir: dir,
        onlyFolders: options.onlyFolders,
        onlyFiles: options.onlyFiles,
        multiSelect: options.multiSelect
      };
      handleResult = function(result) {
        var li;
        $el.find('.start').html('');
        $el.removeClass('wait').append(result);
        if (options.root === dir) {
          $el.find('UL:hidden').show();
          finishCallback();
        } else {
          if (jQuery.easing[options.expandEasing] === void 0) {
            console.log('Easing library not loaded. Include jQueryUI or 3rd party lib.');
            options.expandEasing = 'swing';
          }
          $el.find('UL:hidden').slideDown({
            duration: options.expandSpeed,
            easing: options.expandEasing,
            start: function() {
              return _this._trigger('filetreeexpand', _this.data);
            },
            complete: finishCallback
          });
        }
        li = $('[rel="' + decodeURIComponent(dir) + '"]').parent();
        if (options.multiSelect && li.children('input').is(':checked')) {
          li.find('ul li input').each(function() {
            $(this).prop('checked', true);
            return $(this).parent().addClass('selected');
          });
        }
        return false;
      };
      handleFail = function() {
        $el.find('.start').html('');
        $el.removeClass('wait');
        if(options.errorMessage) {
          $el.append("<p>" + options.errorMessage + "</p>");
        } else {
          $el.removeClass('expanded').addClass('collapsed');
        }
        return false;
      };
      if (typeof options.script === 'function') {
        result = options.script(data);
        if (typeof result === 'string' || result instanceof jQuery) {
          return handleResult(result);
        } else {
          return handleFail();
        }
      } else {
        return $.ajax({
          url: options.script,
          type: 'POST',
          dataType: 'HTML',
          data: data
        }).done(function(result) {
          return handleResult(result);
        }).fail(function() {
          return handleFail();
        });
      }
    };

    FileTree.prototype._trigger = function(eventType, data) {
      var $el;
      $el = this.jqft.container;
      return $el.triggerHandler(eventType, data);
    };

    return FileTree;

  })();
  return $.fn.extend({
    fileTree: function(args, callback) {
      return this.each(function() {
        var $this, data;
        $this = $(this);
        data = $this.data('fileTree');
        if (!data) {
          $this.data('fileTree', (data = new FileTree(this, args, callback)));
        }
        if (typeof args === 'string') {
          return data[option].apply(data);
        }
      });
    }
  });
})(window.jQuery, window);
