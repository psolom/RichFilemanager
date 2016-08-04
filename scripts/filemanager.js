/**
 *	Rich Filemanager JS core
 *
 *	filemanager.js
 *
 *	@license	MIT License
 *	@author		Jason Huck - Core Five Labs
 *	@author		Simon Georget <simon (at) linea21 (dot) com>
 *	@author		Pavel Solomienko <https://github.com/servocoder/>
 *	@copyright	Authors
 */
 
window.FileManager = window.FileManager || {};
FileManager.lg = [];
// Default relative files root, may be changed with query params during initialization
FileManager.fileRoot = '/';
FileManager.config = {};
var initConfigLastPromise = jQuery.Deferred();

var promisePluginPath = jQuery.Deferred();
// loading default configuration file
var promiseDefault = jQuery.Deferred();
// loading user configuration file
var promiseUser = jQuery.Deferred();
// <head> included files collector
var  HEAD_included_files = new Array();

(function($) {

// function to retrieve GET params
$.urlParam = function(name) {
	var results = new RegExp('[\\?&]' + name + '=([^&#]*)').exec(window.location.href);
	if (results) {
		return results[1];
	} else {
		return 0;
	}
};

/*---------------------------------------------------------
  Setup, Layout, and Status Functions
---------------------------------------------------------*/

// Retrieves config settings from filemanager.config.json
var loadConfigFile = function (type) {
    var json = null, pluginPath = ".";
    if (window._FMConfig && window._FMConfig.pluginPath) {
      pluginPath = window._FMConfig.pluginPath;
    }
    promisePluginPath.resolve( { globals : {pluginPath: pluginPath} }  );
    var url;
    type = (typeof type === "undefined") ? "user" : type;
    
    if(type == 'user') {
      if($.urlParam('config') != 0) {
        url = pluginPath + '/scripts/' + $.urlParam('config');
        FileManager.userconfig = $.urlParam('config');
      } else {
        url = pluginPath + '/scripts/filemanager.config.json';
        FileManager.userconfig = 'filemanager.config.json';
      }
    } else {
      url = pluginPath + '/scripts/filemanager.config.default.json';
    }
      
    return $.ajax({
                'url': url,
                'dataType': "json",
                cache: false
        }) ; 
  };


   var err = function( req, status, err ) {
    alert( '<p>something went wrong</p>'+ err );
  };
  
  // loading default configuration file
  var promiseA = loadConfigFile('default');
  promiseA.then( function (data) {
       json = data;
       promiseDefault.resolve(json);
  },err);
  // loading user configuration file
  var promiseB = loadConfigFile('user');
  promiseB.then( function (data) {
       json = data;
       promiseUser.resolve(json);
  }, err);
  
  $.when(promiseDefault, promiseUser, promisePluginPath).done(function(configd,config, configpp) {
         // remove version from user config file
         if (FileManager.config != undefined && FileManager.config !== null) delete FileManager.config.version;
         // merge default config and user config file
         FileManager.config = $.extend({}, configd, config, configpp); 	
         
         if(FileManager.config.options.logger) FileManager.start = new Date().getTime();
         
         // Sets paths to connectors based on language selection.
         FileManager.fileConnector = FileManager.config.options.fileConnector ||  FileManager.config.globals.pluginPath + '/connectors/' + FileManager.config.options.lang + '/filemanager.' + FileManager.config.options.lang;
         
         // Read capabilities from config files if exists else apply default settings
         FileManager.capabilities = FileManager.config.options.capabilities || ['upload', 'select', 'download', 'rename', 'move', 'delete', 'replace'];
         
         // Defines sort params
        var chunks = [];
        if(FileManager.config.options.fileSorting) {
          chunks = FileManager.config.options.fileSorting.toLowerCase().split('_');
        }
        
        FileManager.config.configSortField = chunks[0] || 'name';
        FileManager.config.configSortOrder = chunks[1] || 'asc';
   
         // Get localized messages from file through culture var or from URL
        if($.urlParam('langCode') != 0) {
             file_exists( FileManager.config.globals.pluginPath + '/scripts/languages/'  + $.urlParam('langCode') + '.json').done( 
              function(result) {
                if (result) {
                  FileManager.config.options.culture = $.urlParam('langCode');
                } else {
                  var urlLang = $.urlParam('langCode').substring(0, 2);
                  file_exists( FileManager.config.globals.pluginPath + '/scripts/languages/'  + FileManager.urlLang + '.json').done( 
                    function(result) {
                      if(result) { 
                        FileManager.config.options.culture = urlLang;
                      }
                    }
                  );
                }
             });
        }
        
        wrapperInitConfigLastPromise = $.Deferred(function() {
           var self = this;
           $.ajax({
              url: FileManager.config.globals.pluginPath + '/scripts/languages/'  + FileManager.config.options.culture + '.json',
              dataType: 'json'
           }).done( function (json) {
                FileManager.lg = json;
                initConfigLastPromise.resolve(json);
                self.resolve(json);
            });
        }).promise(); 
  });


// Stores path to be automatically expanded by filetree plugin
var fullexpandedFolder = null;

// Stores file/folder listing data for jqueryFileTree and list/grid view
var loadedFolderData = {};

// Loads a given css file into header if not already included
var loadCSS = function(href) {
	href = FileManager.config.globals.pluginPath + href;
	// check if already included
	if($.inArray(href, HEAD_included_files) == -1) {
		var cssLink = $("<link rel='stylesheet' type='text/css' href='" + href + "'>");
		$("head").append(cssLink);
		HEAD_included_files.push(href);
	}
};

// Loads a given js file into header if not already included
var loadJS = function(src) {
	src = FileManager.config.globals.pluginPath + src;
	// check if already included
	if($.inArray(src, HEAD_included_files) == -1) {
		var jsLink = $("<script type='text/javascript' src='" + src + "'>");
		$("head").append(jsLink);
		HEAD_included_files.push(src);
	}
};

// Loads a given js template file into header if not already included
var loadTemplate = function(id, data) {
	//loadJS('/scripts/JavaScript-Templates/js/tmpl.min.js');
	var template;
	$.ajax({
		url: FileManager.config.globals.pluginPath + '/scripts/templates/' + id + '.html',
		async: false,
		success: function(response) {
			template = tmpl(response, data);
		}
	});
	return template;
};

// Test if a given url exists
var file_exists = function(url) {
    // http://kevin.vanzonneveld.net
    // +   original by: Enrique Gonzalez
    // +      input by: Jani Hartikainen
    // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // %        note 1: This function uses XmlHttpRequest and cannot retrieve resource from different domain.
    // %        note 1: Synchronous so may lock up browser, mainly here for study purposes.
    // *     example 1: file_exists('http://kevin.vanzonneveld.net/pj_test_supportfile_1.htm');
    // *     returns 1: '123'
    var req = this.window.ActiveXObject ? new ActiveXObject("Microsoft.XMLHTTP") : new XMLHttpRequest();
    if (!req) {
        throw new Error('XMLHttpRequest not supported');
    }
    var deferred = $.Deferred(function() {
            var self = this;
            // HEAD Results are usually shorter (faster) than GET
            req.open('HEAD', url, true);
            req.send(null);

            req.onreadystatechange = function() {
              if(this.readyState == this.HEADERS_RECEIVED) {
                if (req.status == 200) {
                     self.resolve(true);
                } else {
                  self.resolve(false);
                }
              }
            };
             
    }).promise();
  return deferred;;
};


// Common variables
var $fileinfo = $('#fileinfo'),
	$filetree = $('#filetree'),
	$uploader = $('#uploader'),
	$uploadButton = $('#upload');


//lang

// Options for alert, prompt, and confirm dialogues.
$.prompt.setDefaults({
    overlayspeed: 'fast',
    show: 'fadeIn',
    opacity: 0.4,
    persistent: false,
	classes: {
		box: 'fm-modal-container',
		fade: '',
		prompt: '',
		close: '',
		title: '',
		message: '',
		buttons: '',
		button: '',
		defaultButton: ''
	}
});

// Forces columns to fill the layout vertically.
// Called on initial page load and on resize.
var setDimensions = function() {
	var bheight = 0,
		$container = $('.fm-container'),
		sections = $('#splitter, #filetree, #fileinfo, .vsplitbar'),
		padding = $container.outerHeight(true) - $container.height();

	if($.urlParam('CKEditorCleanUpFuncNum')) bheight +=60;

	var newH = $(window).height() - $uploader.height() - $('#footer').height() - padding - bheight;
	sections.height(newH);

	// adjust height of filemanager if there are other DOM elemements on page
	var delta = $(document).height() - $(window).height();
	if(!$container.parent().is('body') && delta > 0) {
		var diff = newH - delta;
		newH = (diff > 0) ? diff : 1;
		sections.height(newH);
	}

	var newW = $('#splitter').width() - $('div.vsplitbar').width() - $filetree.width();
	$fileinfo.width(newW);
};

// Manually update existing scrollbars to accommodate new content or resized element(s)
var adjustScrollbar = function($selector) {
	setTimeout(function(){
		$selector.mCustomScrollbar("update");
	}, 0);
};

// Display Min Path
var displayPath = function (path, reduce) {
	reduce = (typeof reduce === "undefined");

	if (FileManager.config.options.showFullPath === false) {
		path = path.replace(FileManager.fileRoot, "/");
		// if a "displayPathDecorator" function is defined, use it to decorate path
		if ('function' === typeof displayPathDecorator) {
			return displayPathDecorator(path);
		} else {
			if (path.length > 50 && reduce === true) {
				var n = path.split("/");
				path = '/' + n[1] + '/' + n[2] + '/(...)/' + n[n.length - 2] + '/';
			}
			return path;
		}
	} else {
		return path;
	}
};

/**
 * Determine path when using baseUrl and setFileRoot connector
 * function to give back a valid path on selectItem calls
 */
var smartPath = function(url, path) {
	var a = url.split('/'),
		separator = '/' + a[a.length-2] + '/',
		position = path.indexOf(separator),
		smart_path;

	// separator is not found
	// this can happen when not set dynamically with setFileRoot function - see  : https://github.com/simogeo/Filemanager/issues/354
	if(position == -1) {
		smart_path = url + path;
	} else {
		smart_path = url + path.substring(position + separator.length);
	}
	if(FileManager.config.options.logger) {
		console.log("url : " + url + " - path : " + path +  " - separator: " + separator + " - position: " + position + " - returned value : " + smart_path);
	}
	return smart_path;
};

// Set the view buttons state
var setViewButtonsFor = function(viewMode) {
    if (viewMode == 'grid') {
        $('#grid').addClass('ON');
        $('#list').removeClass('ON');
    }
    else {
        $('#list').addClass('ON');
        $('#grid').removeClass('ON');
    }
};

// Sanitize and transliterate file/folder name as server side (connector) way
var cleanString = function(string, allowed) {
	if(FileManager.config.security.normalizeFilename) {
		// replace chars which are not related to any language
		var replacements = {' ': '_', '\'': '_', '/': '', '\\': ''};
		string = string.replace(/[\s\S]/g, function(c) {return replacements[c] || c});
	}

	// allow only latin alphabet
	if(FileManager.config.options.charsLatinOnly) {
		loadJS('/scripts/speakingurl/speakingurl.min.js');
		if (typeof allowed == "undefined") {
			allowed = [];
		}
		// transliterate string
		string = getSlug(string, {
			separator: '_',
			maintainCase: true,
			custom: allowed
		});

		// clean up all non-latin chars
		string = string.replace(/[^_a-zA-Z0-9]/g, "");
	}

	// remove double underscore
	string = string.replace(/[_]+/g, "_");
	return string;
};

// Separate filename from extension before calling cleanString()
var nameFormat = function(input) {
	var filename = '';
	if(input.lastIndexOf('.') != -1) {
		filename  = cleanString(input.substr(0, input.lastIndexOf('.')));
		filename += '.' + input.split('.').pop();
	} else {
		filename = cleanString(input);
	}
	return filename;
};

// Converts bytes to KB, MB, or GB as needed for display
var formatBytes = function(bytes, round) {
	round = round || false;
	var n = parseFloat(bytes);
	var d = parseFloat(round ? 1000 : 1024);
	var c = 0;
	var u = [FileManager.lg.bytes, FileManager.lg.kb, FileManager.lg.mb, FileManager.lg.gb];

	while(true) {
		if(n < d) {
			n = Math.round(n * 100) / 100;
			return n + ' ' + u[c];
		} else {
			n /= d;
			c += 1;
		}
	}
};

// Handle Error. Freeze interactive buttons and display error message.
// Also called when auth() function return false (Code == "-1")
var handleError = function(errMsg) {
	$fileinfo.html('<h1>' + errMsg + '</h1>');
	$('#newfile').prop("disabled", true);
	$('#newfolder').prop("disabled", true);
	$uploadButton.prop("disabled", true);
};

// Handle ajax request error.
var handleAjaxError = function(response) {
	$.prompt(FileManager.lg.ERROR_SERVER);
};

// Test if item has the 'cap' capability
// 'cap' is one of 'select', 'rename', 'delete', 'download', 'replace', 'move'
function has_capability(data, cap) {
	if(FileManager.capabilities.indexOf(cap) === -1) return false;
	if (data['File Type'] == 'dir' && cap == 'replace') return false;
	if (data['File Type'] == 'dir' && cap == 'download') {
		return (FileManager.config.security.allowFolderDownload === true);
	}
	if (typeof(data['Capabilities']) !== "undefined") {
		return $.inArray(cap, data['Capabilities']) > -1
	}
	return true;
}

// Test if file is authorized
var isAuthorizedFile = function(filename) {

	var ext = getExtension(filename);

	// no extension is allowed
	if(ext == '' && FileManager.config.security.allowNoExtension == true) return true;

	if(FileManager.config.security.uploadPolicy == 'DISALLOW_ALL') {
		if($.inArray(ext, FileManager.config.security.uploadRestrictions) != -1) return true;
	}
	if(FileManager.config.security.uploadPolicy == 'ALLOW_ALL') {
		if($.inArray(ext, FileManager.config.security.uploadRestrictions) == -1) return true;
	}

    return false;
};

// Test if path is dir
var isFile = function(path) {
	return path.charAt(path.length - 1) != '/';
};

// from http://phpjs.org/functions/basename:360
var basename = function(path, suffix) {
    var b = path.replace(/^.*[\/\\]/g, '');

    if (typeof(suffix) == 'string' && b.substr(b.length-suffix.length) == suffix) {
        b = b.substr(0, b.length-suffix.length);
    }

    return b;
};

// return filename extension
var getExtension = function(filename) {
	if(filename.split('.').length == 1) {
		return "";
	}
	return filename.split('.').pop().toLowerCase();
};

// return filename without extension
var getFilename = function(filename) {
	if(filename.lastIndexOf('.') != -1) {
		return filename.substring(0, filename.lastIndexOf('.'));
	} else {
		return filename;
	}
};

// return path without filename
// "/dir/to/" 		  --> "/dir/to/"
// "/dir/to/file.txt" --> "/dir/to/"
var getDirname = function(path) {
	if(path.lastIndexOf('/') != path.length - 1) {
		return path.substr(0, path.lastIndexOf('/') + 1);
	} else {
		return path;
	}
};

// return parent folder for path, if folder is passed it should ends with '/'
// "/dir/to/"          -->  "/dir/"
// "/dir/to/file.txt"  -->  "/dir/"
var getParentDirname = function(path) {
	return path.split('/').reverse().slice(2).reverse().join('/') + '/';
};

// return closest node for path
// "/dir/to/"          -->  "/dir/"
// "/dir/to/file.txt"  -->  "/dir/to/"
var getClosestNode = function(path) {
	return path.substring(0, path.slice(0, -1).lastIndexOf('/')) + '/';
};

// Test if is editable file
var isEditableFile = function(filename) {
	if($.inArray(getExtension(filename), FileManager.config.edit.editExt) != -1) {
		return true;
	} else {
		return false;
	}
};

// Test if is image file
var isImageFile = function(filename) {
	if($.inArray(getExtension(filename), FileManager.config.images.imagesExt) != -1) {
		return true;
	} else {
		return false;
	}
};

// Test if file is supported web video file
var isVideoFile = function(filename) {
	if($.inArray(getExtension(filename), FileManager.config.videos.videosExt) != -1) {
		return true;
	} else {
		return false;
	}
};

// Test if file is supported web audio file
var isAudioFile = function(filename) {
	if($.inArray(getExtension(filename), FileManager.config.audios.audiosExt) != -1) {
		return true;
	} else {
		return false;
	}
};

// Test if file is pdf file
var isPdfFile = function(filename) {
	if($.inArray(getExtension(filename), FileManager.config.pdfs.pdfsExt) != -1) {
		return true;
	} else {
		return false;
	}
};

// Test if file is document file
var isDocumentFile = function(filename) {
	if($.inArray(getExtension(filename), FileManager.config.docs.docsExt) != -1) {
		return true;
	} else {
		return false;
	}
};

// Build url to preview office and media files
var createPreviewUrl = function(path) {
	return location.origin + location.pathname + path;
};

// Return HTML video player
var getVideoPlayer = function(data) {
	var code  = '<video src="' + createPreviewUrl(data['Preview']) + '" width=' + FileManager.config.videos.videosPlayerWidth + ' height=' + FileManager.config.videos.videosPlayerHeight + ' controls="controls"></video>';

	$fileinfo.find('img').remove();
	$fileinfo.find('#preview #main-title').before(code);
};

// Return HTML audio player
var getAudioPlayer = function(data) {
	var code  = '<audio src="' + createPreviewUrl(data['Preview']) + '" controls="controls"></audio>';

	$fileinfo.find('img').remove();
	$fileinfo.find('#preview #main-title').before(code);
};

// Return PDF Reader
var getPdfReader = function(data) {
	var code = '<iframe id="fm-pdf-viewer" src="' + FileManager.config.globals.pluginPath + '/scripts/ViewerJS/index.html#' + createPreviewUrl(data['Preview']) + '" width="' + FileManager.config.pdfs.pdfsReaderWidth + '" height="' + FileManager.config.pdfs.pdfsReaderHeight + '" allowfullscreen webkitallowfullscreen></iframe>';

	$fileinfo.find('img').remove();
	$fileinfo.find('#preview #main-title').before(code);
};

// Return Google Viewer
var getGoogleViewer = function(data) {
	var url = encodeURIComponent(createPreviewUrl(data['Preview']));
	var code = '<iframe id="fm-google-viewer" src="http://docs.google.com/viewer?url=' + url + '&embedded=true" width="' + FileManager.config.docs.docsReaderWidth + '" height="' + FileManager.config.docs.docsReaderHeight + '" allowfullscreen webkitallowfullscreen></iframe>';

	$fileinfo.find('img').remove();
	$fileinfo.find('#preview #main-title').before(code);
};

// Display icons on list view retrieving them from filetree
// Called using SetInterval
var display_icons = function(timer) {
	$fileinfo.find('tr.file, tr.directory').each(function() {
		var path = $(this).attr('data-path');
		var treenode = $filetree.find('a[data-path="' + path + '"]').parent();

		if (typeof treenode.css('background-image') !== "undefined") {
			$(this).find('td:first').css('background-image', treenode.css('background-image'));
			window.clearInterval(timer);
		}
	});
};

// Sets the folder status, upload, and new folder functions
// to the path specified. Called on initial page load and
// whenever a new directory is selected.
var setUploader = function(path) {
	setCurrentPath(path);

	$('#newfolder').unbind().click(function() {
		var foldername =  FileManager.lg.default_foldername;
		var msg = FileManager.lg.prompt_foldername + ' : <input id="fname" name="fname" type="text" value="' + foldername + '" />';

		var getFolderName = function(e, value, message, formVals) {
			if(!value) return;
			var fname = message.children('#fname').val();

			if(fname != '') {
				foldername = cleanString(fname);
				$.getJSON(FileManager.fileConnector + '?mode=addfolder&path=' + getCurrentPath() + '&config=' + FileManager.userconfig + '&name=' + encodeURIComponent(foldername) + '&time=' + new Date().getTime(), function(result) {
					if(result['Code'] == 0) {
						addFolder(result['Parent']);
						getFolderInfo(result['Parent']);
					} else {
						$.prompt(result['Error']);
					}
				});
			} else {
				$.prompt(FileManager.lg.no_foldername);
			}
		};
		var btns = {};

		btns[FileManager.lg.create_folder] = true;
		btns[FileManager.lg.cancel] = false;
		$.prompt(msg, {
			submit: getFolderName,
			buttons: btns
		});
	});
};

// Binds specific actions to the toolbar in detail views.
// Called when detail views are loaded.
var bindToolbar = function(data) {
	// this little bit is purely cosmetic
	$fileinfo.find('button').each(function( index ) {
		// check if span doesn't exist yet, when bindToolbar called from renameItem for example
		if($(this).find('span').length == 0)
			$(this).wrapInner('<span></span>');
	});

	if (!has_capability(data, 'select')) {
		$fileinfo.find('button#select').hide();
	} else {
        $fileinfo.find('button#select').click(function () { selectItem(data); }).show();
        if(window.opener || window.tinyMCEPopup) {
	        $('#preview').find('img')
				.attr('title', FileManager.lg.select)
				.css("cursor", "pointer")
				.click(function() {selectItem(data);});
        }
	}

	if (!has_capability(data, 'rename')) {
		$fileinfo.find('button#rename').hide();
	} else {
		$fileinfo.find('button#rename').click(function() {
			renameItem(data);
		}).show();
	}

	if (!has_capability(data, 'move')) {
		$fileinfo.find('button#move').hide();
	} else {
		$fileinfo.find('button#move').click(function() {
			moveItemPrompt(data);
		}).show();
	}

	if (!has_capability(data, 'replace')) {
		$fileinfo.find('button#replace').hide();
	} else {
		$fileinfo.find('button#replace').click(function() {
			replaceItem(data);
		}).show();
	}

	if (!has_capability(data, 'delete')) {
		$fileinfo.find('button#delete').hide();
	} else {
		$fileinfo.find('button#delete').click(function() {
			deleteItem(data);
		}).show();
	}

	if (!has_capability(data, 'download')) {
		$fileinfo.find('button#download').hide();
	} else {
		$fileinfo.find('button#download').click(function() {
			downloadItem(data).then(
				function(result,textStatus, jqXHR) {
						if(result['Code'] == 0) {
							// this is a a reference to the Ajax settings themselves ,cft. jQuery ajax
							window.location = this.url.replace(/&time=\d+/,'') + '&force=true&time=' + new Date().getTime();
						} else {
							$.prompt(result['Error']);
						}
			}, function( jqXHR, textStatus, errorThrown ) {
				  handleAjaxError(textStatus);
			}
			);
		}).show();
	}

	$fileinfo.find('#parentfolder').click(function(e) {
		getFolderInfo(getCurrentPath());
	});
};

// Returns current active path
var getCurrentPath = function() {
	return $('#currentpath').val();
};

// Set current active path
var setCurrentPath = function(path) {
	$('#currentpath').val(path);
	$uploader.find('h1').text(FileManager.lg.current_folder + displayPath(path)).attr('title', displayPath(path, false));
};

// Returns container for filetree or fileinfo section based on scrollbar plugin state
var getSectionContainer = function($section) {
	// if scrollbar plugin is enabled
	if ($section.find('.mCSB_container').length > 0) {
		return $section.find('.mCSB_container');
	} else {
		return $section;
	}
};

// Returns grid/list item by path
var getViewItem = function(path) {
	if($fileinfo.data('view') == 'grid') {
		return $fileinfo.find('li[data-path="' + path + '"]');
	} else {
		return $fileinfo.find('tr[data-path="' + path + '"]');
	}
};

// Updates folder summary info
var updateFolderSummary = function() {
	var isGridView = $fileinfo.data('view') == 'grid',
		selector = isGridView ? 'li' : 'tbody > tr',
		itemsTotal, sizeTotal = 0;

	itemsTotal = $fileinfo.find(selector + '.file, ' + selector + '.directory').not('.ui-draggable-dragging').length;

	$fileinfo.find(selector + '.file').not('.ui-draggable-dragging').each(function() {
		var data = $(this).data('itemdata');
		sizeTotal += Number(data['Properties']['Size']);
	});

	$('#items-counter').text(itemsTotal + ' ' + FileManager.lg.items);
	$('#items-size').text(FileManager.lg.size + ': ' + formatBytes(sizeTotal));
};

// Apply actions after manipulating with filetree or its single node
var adjustFileTree = function($node) {
	// search function
	if (FileManager.config.options.searchBox == true) {
		$('#q').liveUpdate('#filetree ul').blur();
		$('#search span.q-inactive').html(FileManager.lg.search);
		$('#search a.q-reset').attr('title', FileManager.lg.search_reset);
	}

	// drag-and-drop
	$node.find('li.file, li.directory').draggable({
		distance: 10,
		cursor: "move",
		helper: function() {
			var $node = $(this).clone();
			$node.find('ul').remove();
			return $node;
		}
	});
	$node.find('li.directory > a').droppable({
		accept: function($draggable) {
			// prevent to drop inside parent element
			return $draggable.is("li.file, li.directory") && !$draggable.parent().prev("a").is($(this));
		},
		hoverClass: "drop-hover",
		drop: function(event, ui) {
			var oldPath = ui.draggable.find('a').attr('data-path'),
				newPath = $(event.target).attr('data-path');

			moveItem(oldPath, newPath);
		}
	});
};

// Create FileTree and bind events
var createFileTree = function() {
	var $treeNode = getSectionContainer($filetree),
		slideAnimation = false;

	// rebuild root folder if filetree plugin already initiated
	if($treeNode.data('fileTree')) {
		slideAnimation = true;
		$treeNode
			.unbind()
			.data('fileTree', null)
			.children('ul.jqueryFileTree').remove();
	}

	var handleAnimation = function(options, state) {
		if(slideAnimation) return;
		options.expandSpeed = state ? 300 : 0;
		options.collapseSpeed = state ? 300 : 0;
	};

	var expandFolderDefault = function($el, data) {
		if (fullexpandedFolder !== null) {
			var flag = false;
			$el.find("li.directory.collapsed").each(function (i, folder) {
				var $link = $(folder).children();
				if (fullexpandedFolder.indexOf($link.attr('data-path')) === 0) {
					flag = true;
					handleAnimation(data.options, false);
					setTimeout(function () {
						$link.click();
					}, 50);
				}
			});
			// match not found
			if (flag === false) {
				fullexpandedFolder = null;
				handleAnimation(data.options, true);
			}
		}
	};

	// event 'filetreeinitiated' should be declared before 'fileTree' plugin is initialized
	$treeNode
		.on('filetreeinitiated', function (e, data) {
			var $el = $(e.target).find('ul');
			expandFolderDefault($el, data);
		})
		.on('filetreeexpand', function (e, data) {
			//var $el = data.li.children('ul');
			getFolderInfo(data.rel);
		})
		.on('filetreeexpanded', function (e, data) {
			var $el = data.li.children('ul');
			expandFolderDefault($el, data);

			// clean autoexpand folder and restore animation
			if (fullexpandedFolder == data.rel) {
				fullexpandedFolder = null;
				handleAnimation(data.options, true);
			}
		})
		// Creates file tree.
		.fileTree({
			root: FileManager.fileRoot,
			script: buildFileTreeBranch,
			multiFolder: true,
			expandSpeed: 300,
			collapseSpeed: 300,
			errorMessage: null
		}, function(file) {
			getFileInfo(file);
		});

	// apply context menu
	$treeNode.contextMenu({
		selector: 'li a',
		// wrap options with "build" allows to get item element
		build: function($triggerElement, e) {
			return {
				appendTo: '.fm-container',
				items: getContextMenuItems($triggerElement),
				callback: function(itemKey, opt) {
					var path = opt.$trigger.attr('data-path');
					setMenus(itemKey, path);
				}
			}
		}
	});
};


/*---------------------------------------------------------
  Item Actions
---------------------------------------------------------*/

// Calls the SetUrl function for FCKEditor compatibility,
// passes file path, dimensions, and alt text back to the
// opening window. Triggered by clicking the "Select"
// button in detail views or choosing the "Select"
// contextual menu option in list views.
// NOTE: closes the window when finished.
var selectItem = function(data) {
	if(FileManager.config.options.baseUrl !== false ) {
		var url = smartPath(baseUrl, data['Path'].replace(FileManager.fileRoot, ""));
	} else {
		var url = data['Path'];
	}

	if(window.opener || window.tinyMCEPopup || $.urlParam('field_name') || $.urlParam('CKEditorCleanUpFuncNum') || $.urlParam('CKEditor') || $.urlParam('ImperaviElementId')) {
	 	if(window.tinyMCEPopup) {
        	// use TinyMCE > 3.0 integration method
            var win = tinyMCEPopup.getWindowArg("window");
			win.document.getElementById(tinyMCEPopup.getWindowArg("input")).value = url;
            if (typeof(win.ImageDialog) != "undefined") {
				// Update image dimensions
            	if (win.ImageDialog.getImageData)
                 	win.ImageDialog.getImageData();

                // Preview if necessary
                if (win.ImageDialog.showPreviewImage)
					win.ImageDialog.showPreviewImage(url);
			}
			tinyMCEPopup.close();
			return;
		}
		// tinymce 4 and colorbox
	 	if($.urlParam('field_name')) {
	 		parent.document.getElementById($.urlParam('field_name')).value = url;

	 		if(typeof parent.tinyMCE !== "undefined") {
		 		parent.tinyMCE.activeEditor.windowManager.close();
		 	}
		 	if(typeof parent.$.fn.colorbox !== "undefined") {
		 		parent.$.fn.colorbox.close();
		 	}
	 	}

		else if($.urlParam('ImperaviElementId')) {
			// use Imperavi Redactor I, tested on v.10.x.x
			if (window.opener) {
				// Popup
			} else {
				// Modal (in iframe)
				var elementId = $.urlParam('ImperaviElementId'),
					instance = parent.$('#'+elementId).redactor('core.getObject');

				if(instance) {
					instance.modal.close();
					instance.buffer.set(); // for undo action

					if(isImageFile(data['Filename'])) {
						instance.insert.html('<img src="' + url + '">');
					} else {
						instance.insert.html('<a href="' + url + '">' + data['Filename'] + '</a>');
					}
				}
			}
		}
		else if($.urlParam('CKEditor')) {
			// use CKEditor 3.0 + integration method
			if (window.opener) {
				// Popup
				window.opener.CKEDITOR.tools.callFunction($.urlParam('CKEditorFuncNum'), url);
			} else {
				// Modal (in iframe)
				parent.CKEDITOR.tools.callFunction($.urlParam('CKEditorFuncNum'), url);
				parent.CKEDITOR.tools.callFunction($.urlParam('CKEditorCleanUpFuncNum'));
			}
		} else {
			// use FCKEditor 2.0 integration method
			if(data['Properties']['Width'] != '') {
				var p = url;
				var w = data['Properties']['Width'];
				var h = data['Properties']['Height'];
				window.opener.SetUrl(p,w,h);
			} else {
				window.opener.SetUrl(url);
			}
		}

		if (window.opener) {
			window.close();
		}
	} else {
		$.prompt(FileManager.lg.fck_select_integration);
	}
};

// Renames the current item and returns the new name.
// Called by clicking the "Rename" button in detail views
// or choosing the "Rename" contextual menu option in list views.
var renameItem = function(data) {
	var fileName = FileManager.config.security.allowChangeExtensions ? data['Filename'] : getFilename(data['Filename']);
	var msg = FileManager.lg.new_filename + ' : <input id="rname" name="rname" type="text" value="' + fileName + '" />';

	var getNewName = function(e, value, message, formVals) {
		if(!value) return;
		var rname = message.children('#rname').val();

		if(rname != '') {
			var givenName = rname;

 			if (! FileManager.config.security.allowChangeExtensions) {
				givenName = nameFormat(rname);
				var suffix = getExtension(data['Filename']);
				if(suffix.length > 0) {
					givenName = givenName + '.' + suffix;
				}
 			}

 			// File only - Check if file extension is allowed
			if (isFile(data['Path']) && !isAuthorizedFile(givenName)) {
				var str = '<p>' + FileManager.lg.INVALID_FILE_TYPE + '</p>';
				if(FileManager.config.security.uploadPolicy == 'DISALLOW_ALL') {
					str += '<p>' + FileManager.lg.ALLOWED_FILE_TYPE +  FileManager.config.security.uploadRestrictions.join(', ') + '.</p>';
				}
				if(FileManager.config.security.uploadPolicy == 'ALLOW_ALL') {
					str += '<p>' + FileManager.lg.DISALLOWED_FILE_TYPE +  FileManager.config.security.uploadRestrictions.join(', ') + '.</p>';
				}
				$("#filepath").val('');
				$.prompt(str);
				return false;
			}

			var connectString = FileManager.fileConnector + '?mode=rename&old=' + encodeURIComponent(data['Path']) + '&new=' + encodeURIComponent(givenName) + '&config=' + FileManager.userconfig;

			$.ajax({
				type: 'GET',
				url: connectString,
				dataType: 'json',
				async: false,
				success: function(result) {
					if(result['Code'] == 0) {
						var newPath = result['New Path'];
						var newName = result['New Name'];
						var oldPath = result['Old Path'];
						var newDir = getDirname(newPath);
						var oldDir = getDirname(oldPath);
						var currentPath = getCurrentPath();
						var $title = $fileinfo.find('#main-title > h1');
						var isPreview = $title.length > 0;

						renameNode(oldPath, newPath, newName);

						// current view displays the item to rename
						if(newDir.indexOf(currentPath) === 0) {
							// reload view if file extension was changed (to replace file icon, etc.)
							if(isFile(newPath) && getExtension(newPath) !== getExtension(oldPath)) {
								var viewPath = (isPreview) ? newPath : newDir;
								getDetailView(viewPath);
							// update file data in preview window if it is currently displayed
							} else if(isPreview && oldPath === $title.attr("title")) {
								actualizePreviewItem(newPath);
							// update item data in grid/list view otherwise
							} else if(!isPreview) {
								actualizeViewItem(getViewItem(oldPath), newPath, newName);
							}
						}
						// currently open folder is a child of renamed folder
						else if(currentPath.indexOf(oldDir) === 0) {
							// update current path to the relevant
							var search = new RegExp('^' + oldDir);
							var newCurrentPath = getCurrentPath().replace(search, newDir);
							setCurrentPath(newCurrentPath);

							if(isPreview) {
								actualizePreviewItem(newCurrentPath);
							} else {
								// actualize path of each item in main window
								var selector = ($fileinfo.data('view') == 'grid') ? 'li' : 'tbody > tr';
								actualizeChildrenItems(oldPath, newPath, $fileinfo.find(selector));
							}
						}
						sortViewItems();
						updateFolderSummary();

						if(FileManager.config.options.showConfirmation) $.prompt(FileManager.lg.successful_rename);
					} else {
						$.prompt(result['Error']);
					}
				},
				error: handleAjaxError
			});
		}
	};
	var btns = {};
	btns[FileManager.lg.rename] = true;
	btns[FileManager.lg.cancel] = false;
	$.prompt(msg, {
		submit: getNewName,
		buttons: btns
	});
};

// Replace the current file and keep the same name.
// Called by clicking the "Replace" button in detail views
// or choosing the "Replace" contextual menu option in list views.
var replaceItem = function(itemData) {
	var $toolbar = $('#toolbar');
	var $button = $toolbar.find('#replacement');

	if(typeof $toolbar.data('blueimpFileupload') === 'undefined') {
		$toolbar
			.fileupload({
				autoUpload: true,
				dataType: 'json',
				url: FileManager.fileConnector + '?config=' + FileManager.userconfig,
				paramName: FileManager.config.upload.paramName
			})

			.on('fileuploadadd', function(e, data) {
				var file = data.files[0];
				// Check if file extension is matching with the original
				if(getExtension(file.name) != itemData['File Type']) {
					$.prompt(FileManager.lg.ERROR_REPLACING_FILE + " ." + itemData['File Type']);
					return false;
				}
				data.submit();
			})

			.on('fileuploadsubmit', function(e, data) {
				data.formData = {
					mode: 'replace',
					newfilepath: itemData["Path"]
				};
				$uploadButton.addClass('loading').prop('disabled', true);
				$uploadButton.children('span').text(FileManager.lg.loading_data);
			})

			.on('fileuploadalways', function(e, data) {
				$uploadButton.removeData().removeClass('loading').prop('disabled', false);
				$uploadButton.children('span').text(FileManager.lg.upload);

				var errorMessage,
					result = data.result;

				// error from upload handler
				if(result.files && result.files[0].error) {
					errorMessage = result.files[0].error;
				}
				// error from filemanager
				if(result.Code == '-1' && result.Error) {
					errorMessage = result.Error;
				}

				if(errorMessage) {
					$.prompt(FileManager.lg.upload_failed + "<br>" + errorMessage);
				} else {
					// success upload
					var filePath = $fileinfo.find('#main-title > h1').attr('title');
					var currentPath = getCurrentPath();

					getFileInfo(filePath);
					reloadFileTreeNode(currentPath);

					// Visual effects for user to see action is successful
					$('#preview').find('img').hide().fadeIn('slow'); // on preview panel
					$filetree.find('a[data-path="' + filePath + '"]').parent().hide().fadeIn('slow'); // on fileTree

					if(FileManager.config.options.showConfirmation) {
						$.prompt(FileManager.lg.successful_replace);
					}
				}
			})

			.on('fileuploadfail', function(e, data) {
				// server error 500, etc.
				$.prompt(FileManager.lg.upload_failed);
			});
	}

    // open the input file dialog window
	$button.click();
};

// Move the current item to specified dir and returns the new name.
// Called by clicking the "Move" button in detail views
// or choosing the "Move" contextual menu option in list views.
var moveItemPrompt = function(data) {
	var msg  = FileManager.lg.move + ' : <input id="rname" name="rname" type="text" value="" />';
		msg += '<div class="prompt-info">' + FileManager.lg.help_move + '</div>';

	var doMove = function(e, value, message, formVals) {
		if(!value) return;
		var newPath = message.children('#rname').val();

		if(newPath != '') {
			moveItem(data['Path'], newPath);
		}
	};
	var btns = {};
	btns[FileManager.lg.move] = true;
	btns[FileManager.lg.cancel] = false;
	$.prompt(msg, {
		submit: doMove,
		buttons: btns
	});
};

// Move the current item to specified dir and returns the new name.
// Called by clicking the "Move" button in detail views
// or choosing the "Move" contextual menu option in list views.
var moveItem = function(oldPath, newPath) {
	var connectString = FileManager.fileConnector + '?mode=move&old=' + encodeURIComponent(oldPath) + '&new=' + encodeURIComponent(newPath) + '&config=' + FileManager.userconfig;

	$.ajax({
		type: 'GET',
		url: connectString,
		dataType: 'json',
		async: false,
		success: function(result) {
			if(result['Code'] == 0) {
				var newPath = result['New Path'];
				var newName = result['New Name'];
				var currentPath = getCurrentPath();

				moveNode(newPath, newName, oldPath);

				// ON move node to the currently open folder
				if(currentPath === newPath) {
					getFolderInfo(newPath);
				}

				// ON move currently open file/folder to another node
				if(currentPath === getDirname(oldPath)) {
					var newFullDir = isFile(oldPath) ? newPath : newPath + newName + '/';

					// move currently open folder
					if(currentPath === oldPath) {
						setCurrentPath(newFullDir);
					}

					if($('#preview').length > 0) {
						actualizePreviewItem(newFullDir);
					} else {
						// actualize path of each item in main window
						var selector = ($fileinfo.data('view') == 'grid') ? 'li' : 'tbody > tr';
						actualizeChildrenItems(oldPath, newFullDir, $fileinfo.find(selector));
					}

					sortViewItems();
					updateFolderSummary();
				}

				if(FileManager.config.options.showConfirmation) $.prompt(FileManager.lg.successful_moved);
			} else {
				$.prompt(result['Error']);
			}
		},
		error: handleAjaxError
	});
};

// Prompts for confirmation, then deletes the current item.
// Called by clicking the "Delete" button in detail views
// or choosing the "Delete" contextual menu item in list views.
var deleteItem = function(data) {
	var isDeleted = false;
	var msg = FileManager.lg.confirmation_delete;

	var doDelete = function(e, value, message, formVals) {
		if(!value) return;
		var connectString = FileManager.fileConnector + '?mode=delete&path=' + encodeURIComponent(data['Path']) + '&config=' + FileManager.userconfig + '&time=' + new Date().getTime();

		$.ajax({
			type: 'GET',
			url: connectString,
			dataType: 'json',
			async: false,
			success: function(result) {
				if(result['Code'] == 0) {
                    var path = result['Path'];
					var $title = $fileinfo.find('#main-title > h1');
					var isPreview = $title.length > 0;

                    removeNode(path);
					isDeleted = true;

					// displays parent folder if the deleted item is the actual view
					if(path === getCurrentPath()) {
						var newCurrentPath = getClosestNode(path);
						setCurrentPath(newCurrentPath);
						getDetailView(newCurrentPath);

					// close preview item if the deleted item is the actual preview
					} else if(isFile(path) && isPreview && path === $title.attr("title")) {
						getDetailView(getDirname(path));
					}

					if(FileManager.config.options.showConfirmation) $.prompt(FileManager.lg.successful_delete);
				} else {
					isDeleted = false;
					$.prompt(result['Error']);
				}
			},
			error: handleAjaxError
		});
	};

	var btns = {};
	btns[FileManager.lg.yes] = true;
	btns[FileManager.lg.no] = false;
	$.prompt(msg, {
		submit: doDelete,
		buttons: btns
	});

	return isDeleted;
};

// Starts file download process.
// Called by clicking the "Download" button in detail views
// or choosing the "Download" contextual menu item in list views.
var downloadItem = function(data) {
	var connectString = FileManager.fileConnector + '?mode=download&path=' + encodeURIComponent(data['Path']) + '&config=' + FileManager.userconfig;

	return $.ajax({
		type: 'GET',
		url: connectString + '&time=' + new Date().getTime(),
		dataType: 'json'
	});
};

// Display an 'edit' link for editable files
// Then let user change the content of the file
// Save action is handled by the method using ajax
var editItem = function(data) {
	var isEdited = false;
	$fileinfo.find('div#tools').append(' <a id="edit-file" href="#" title="' + FileManager.lg.edit + '"><span>' + FileManager.lg.edit + '</span></a>');

	$('#edit-file').click(function() {
		$(this).hide(); // hiding Edit link
		var connectString = FileManager.fileConnector + '?mode=editfile&path=' + encodeURIComponent(data['Path']) + '&config=' + FileManager.userconfig + '&time=' + new Date().getTime();

		$.ajax({
			type: 'GET',
			url: connectString,
			dataType: 'json',
			async: false,
			success: function (result) {
				if (result['Code'] == 0) {
					var $preview = $('#preview'),
						codeMirrorEditor;

					var content = '<form id="edit-form">';
					content += '<textarea id="edit-content" name="content">' + result['Content'] + '</textarea>';
					content += '<input type="hidden" name="mode" value="savefile" />';
					content += '<input type="hidden" name="path" value="' + data['Path'] + '" />';
					content += '<button id="edit-cancel" class="edition" type="button">' + FileManager.lg.quit_editor + '</button>';
					content += '<button id="edit-save" class="edition" type="button">' + FileManager.lg.save + '</button>';
					content += '</form>';

					$preview.find('img').hide();
					$preview.prepend(content).hide().fadeIn();
					adjustScrollbar($fileinfo);

					// Cancel Button Behavior
					$('#edit-cancel').click(function () {
						$preview.find('form#edit-form').hide();
						$preview.find('img').fadeIn();
						$('#edit-file').show();
					});

					// Save Button Behavior
					$('#edit-save').click(function () {

						// get new textarea content
						var newContent = codeMirrorEditor.getValue();
						$("textarea#edit-content").val(newContent);

						var postData = $('#edit-form').serializeArray();

						$.ajax({
							type: 'POST',
							url: FileManager.fileConnector + '?config=' + FileManager.userconfig,
							dataType: 'json',
							data: postData,
							async: false,
							success: function (result) {
								if (result['Code'] == 0) {
									isEdited = true;
									// if (FileManager.config.options.showConfirmation) $.prompt(FileManager.lg.successful_edit);
									$.prompt(FileManager.lg.successful_edit);
								} else {
									isEdited = false;
									$.prompt(result['Error']);
								}
							},
							error: handleAjaxError
						});
					});

					// instantiate codeMirror according to config options
					codeMirrorEditor = instantiateCodeMirror(getExtension(data['Path']), config, loadJS);

				} else {
					isEdited = false;
					$.prompt(result['Error']);
					$(this).show(); // hiding Edit link
				}
			}
		});
	});

	return isEdited;
};

// Removes grid/list item
var removeViewItem = function(path, speed) {
	speed = speed || 0;
	getViewItem(path)
		.not('.directory-parent') // prevent removal "parent folder" item
		.fadeOut(speed, function() {
			$(this).remove();
			updateFolderSummary();
		});
};

// Removes filetree item
var removeFileTreeItem = function(path, speed) {
	speed = speed || 0;
	$filetree
        .find('a[data-path="' + path + '"]')
        .parent()
        .fadeOut(speed, function() {
            $(this).remove();
        });
};


/*---------------------------------------------------------
  Functions to Update the File Tree
---------------------------------------------------------*/

// Adds a new folder.
// Called after a new folder is successfully created.
var addFolder = function(parent) {
	reloadFileTreeNode(parent);
	if(FileManager.config.options.showConfirmation) {
		$.prompt(FileManager.lg.successful_added_folder);
	}
};

// Adds a new node.
// Called after a successful file upload.
var addNode = function(path) {
	reloadFileTreeNode(path);
	if(FileManager.config.options.showConfirmation) {
		$.prompt(FileManager.lg.successful_added_file);
	}
};

// Rename the specified node with a new name.
// Called after a successful rename operation.
var renameNode = function(oldPath, newPath, newName) {
	var $oldNodeLink = $filetree.find('a[data-path="' + oldPath + '"]');

	if(isFile(newPath)) {
		// reload node if file extension was changed (to replace file icon, etc.)
		if(getExtension(newPath) !== getExtension(oldPath)) {
			updateNodeItem(getDirname(newPath), oldPath, newPath);
		} else {
			actualizeFileTreeItem($oldNodeLink, newPath, newName);
		}
	} else {
		// actualize renamed folder and all its descendants
		actualizeFileTreeItem($oldNodeLink, newPath, newName);
		actualizeChildrenItems(oldPath, newPath, $oldNodeLink.next('ul').find('a'));
	}

	sortFileTreeItems($filetree.find('a[data-path="' + newPath + '"]').parent().parent());
};

// Moves the specified node.
// Called after a successful move operation.
var moveNode = function(newPath, newName, oldFullPath, forceExpand) {
	// could be used on manual move via prompt window
	forceExpand = forceExpand || false;

	var currentPath = getCurrentPath();
	var $targetLink = $filetree.find('a[data-path="' + newPath + '"]');
	var $targetNode = $targetLink.next('ul');
	var $adjustNode = $targetNode.parent();

	removeViewItem(oldFullPath);

	// Actually it is possible to use only this condition without code below, but this way leads to
	// rebuilding the whole filetree, node by node. Filetree performs request to server for each node,
	// so the longer the path, the more requests to send. This is inefficient and costly, especially
	// for AWS S3 that charge you for each request.
	if(forceExpand) {
		// set fullexpandedFolder value to automatically open file in
		// filetree when calling createFileTree() function
		fullexpandedFolder = newPath;
		createFileTree();
	}

	// ON move to file root
	if(newPath === FileManager.fileRoot) {
		$targetNode = getSectionContainer($filetree).children('ul');
		$adjustNode = $filetree;
	}

	// if target node isn't loaded
	if($targetNode.length === 0) {
		// change currently open folder to target node path
		if(currentPath === oldFullPath) {
			getSectionContainer($filetree).data('fileTree').options.expandSpeed = 0;
			$targetLink.click();
		}
		removeFileTreeItem(oldFullPath);
		return;
	}

	// ON move node to the currently open folder
	if(currentPath === newPath) {
		if($targetNode.is(':hidden')) {
			$targetNode.show().parent()
				.addClass('expanded')
				.removeClass('collapsed');
		}
		getFolderInfo(newPath);
	}

	var $node = $filetree.find('a[data-path="' + oldFullPath + '"]').parent().not('.ui-draggable-dragging');
	actualizeChildrenItems(getClosestNode(oldFullPath), newPath, $node.find('a'));

	$node.appendTo($targetNode);
	sortFileTreeItems($targetNode);
	adjustFileTree($adjustNode);
};

// Removes the specified node.
// Called after a successful delete operation.
var removeNode = function(path) {
	removeViewItem(path);
	removeFileTreeItem(path);
};




/*---------------------------------------------------------
  Functions to handle Filetree and Fileinfo items during the actions
  Helpers to actualize items paths, sort elements, and manage filetree nodes
---------------------------------------------------------*/

// Actualize data of file which is currently open in the preview window
var actualizePreviewItem = function(newPath) {
	var $toolbar = $('#toolbar');
	var $title = $fileinfo.find('#main-title > h1');
	var filename = basename(newPath) || $title.text();
	var fullPath = getDirname(newPath) + filename;

	$title.text(filename).attr("title", fullPath);
	var data = $toolbar.data('fmitem');

	// actualized data for binding
	data['Path'] = fullPath;
	data['Filename'] = filename;

	// Bind toolbar functions.
	$toolbar.find('button').unbind();
	bindToolbar(data);
};

// Actualize data of file/folder item which is currently displayed in gris/list view
var actualizeViewItem = function($item, newPath, newName) {
	var itemdata = $item.data('itemdata');

	itemdata['Path'] = newPath;
	if(typeof newName !== "undefined") {
		itemdata['Filename'] = newName;
		if(isFile(newName)) {
			itemdata['File Type'] = getExtension(newName);
		}
	}

	$item.attr('data-path', newPath);
	// update item info based on view mode
	if($fileinfo.data('view') == 'grid') {
		$item.find('img').attr('alt', newPath);
		$item.children('p').text(itemdata['Filename']);
	} else {
		$item.find('td:first').text(itemdata['Filename']);
	}
};

// Actualize data of filetree item which was changed
var actualizeFileTreeItem = function($nodeLink, newPath, newName) {
	var itemdata = $nodeLink.data('itemdata');

	itemdata['Path'] = newPath;
	if(typeof newName !== "undefined") {
		itemdata['Filename'] = newName;
		if(isFile(newName)) {
			itemdata['File Type'] = getExtension(newName);
		}
	}

	$nodeLink.attr('data-path', newPath).attr('rel', newPath);
	$nodeLink.text(itemdata['Filename']);
};

// Actualize data of filetree branch descendants or grid/list view items.
// Created for "move" and "rename" actions to keep items up to date without reloading.
var actualizeChildrenItems = function(oldPath, newPath, $items) {
	var search = new RegExp('^' + oldPath);

	// replace paths in links along all nodes in cloned branch
	$items.each(function() {
		var subject = $(this).attr('data-path');
		var replaced = subject.replace(search, newPath);

		// filetree item
		if($(this).is('a')) {
			actualizeFileTreeItem($(this), replaced);
		} else {
			// setup data for parent folder link item
			if($(this).hasClass('directory-parent')) {
				$(this).attr('data-path', getParentDirname(getCurrentPath()));
			} else {
				actualizeViewItem($(this), replaced);
			}
		}
	});
};

var getSortValueCallback = function(el) {
	var sortField = FileManager.config.configSortField,
		itemData = $(el).data('itemdata');

	// list view sorting may differ from config
	if($fileinfo.data('view') == 'list') {
		var sortData = $fileinfo.data('list-sort');
		if(sortData) sortField = sortData.column;
	}

	switch(sortField) {
		case 'type':
			return itemData['File Type'];
		case 'size':
			return itemData['Properties']['Size'];
		case 'modified':
			return itemData['Properties']['filemtime'];
		case 'dimensions':
			return itemData['Properties']['Width'] + 'x' + itemData['Properties']['Height'];
		default:
			return itemData['Filename'];
	}
};

var arrangeFolders = function($parent, selector) {
	if(FileManager.config.options.folderPosition === 'bottom') {
		$parent.find(selector + '.directory').appendTo($parent);
	}
	if(FileManager.config.options.folderPosition === 'top') {
		$parent.find(selector + '.directory').prependTo($parent);
		$parent.find(selector + '.directory-parent').prependTo($parent);
	}
};

// Sorts children of specified filetree node
var sortFileTreeItems = function($node) {
	var $items = $node.find('> li');
	if($items.length === 0) return;

	$items.tsort({selector: 'a', callback: getSortValueCallback, order: FileManager.config.configSortOrder, natural: true});
	arrangeFolders($node, '> li');
};

// Sorts children of specified filetree node
var sortViewItems = function() {
	var $items,
		$contents = $fileinfo.find('#contents');

	// sorting based on view mode
	if($fileinfo.data('view') == 'grid') {
		$items = $contents.find('li.file, li.directory');
		if($items.length === 0) return;

		$items.tsort({callback: getSortValueCallback, order: FileManager.config.configSortOrder, natural: true});
		arrangeFolders($contents, 'li');
	} else {
		var data = $fileinfo.data('list-sort'),
			$headers = $contents.find('th'),
			sortField, order, $targetHeader;

		// retrieve stored sort settings or use defaults
		order = data ? data.order : FileManager.config.configSortOrder;
		sortField = data ? data.column : FileManager.config.configSortField;

		// apply sort classes to table headers
		$targetHeader = $headers.filter('.column-' + sortField);
		$headers.removeClass('sorted sorted-asc sorted-desc');
		$targetHeader.addClass('sorted sorted-' + order);

		$items = $contents.find('tr.file, tr.directory');
		if($items.length === 0) return;

		$items.tsort({callback: getSortValueCallback, order: order, natural: true});
		arrangeFolders($contents, 'tr');
	}
};

// Replaces filetree item with the actual one from server in specifiс branch
// Use when a filetree item was changed and should be reloaded from server ("renameNode" action)
var updateNodeItem = function(branchPath, nodePathOld, nodePathNew) {
	var $oldNode = $filetree.find('a[data-path="' + nodePathOld + '"]').parent();
	var $newNode = buildFileTreeBranch({dir: getDirname(branchPath)}, nodePathNew);
	$oldNode.replaceWith($newNode);
};

// Loads filetree node with new items that are on server
// Use after adding new item to filetree ("addNode", "addFolder" and "upload" actions)
var reloadFileTreeNode = function(targetPath) {
	var $targetNode,
		isRoot = targetPath === FileManager.fileRoot;

	if(isRoot) {
		$targetNode = getSectionContainer($filetree).children('ul');
	} else {
		$targetNode = $filetree.find('a[data-path="' + targetPath + '"]').next('ul');
	}

	// if target path is root or target node is expanded
	if(isRoot || $targetNode.parent().hasClass('expanded')) {
		var $newNode = buildFileTreeBranch({dir: targetPath});

		// easier way but it replaces the whole node and closes all expanded descendant nodes
		//$targetNode.replaceWith($newNode.show());
		//adjustFileTree($newNode);

		// create array of paths existing inside the target node
		var paths = $targetNode.find('>li>a').map(function() {
			return this.getAttribute("data-path");
		}).get();

		// append new item to the target node unlike replacing the whole node
		$newNode.find('>li>a').each(function() {
			if(paths.indexOf($(this).attr("data-path")) === -1) {
				$targetNode.append($(this).parent());
			}
		});

		sortFileTreeItems($targetNode);
		adjustFileTree($targetNode);
	} else {
		// triggers click() event if target node is expanded
		getSectionContainer($filetree).data('fileTree').options.expandSpeed = 0;
		$targetNode.prev('a').click();
	}
};




/*---------------------------------------------------------
  Functions to Retrieve File and Folder Details
---------------------------------------------------------*/

// Retrieves file or folder info based on the path provided.
var getDetailView = function(path) {
	if(isFile(path)) {
		getFileInfo(path);
	} else {
		getFolderInfo(path);
		// expand filetree node if it is collapsed
		var $treeLink = $filetree.find('a[data-path="' + path + '"]');
		if($treeLink.parent().hasClass('collapsed')) {
			$treeLink.click();
		}
	}
};

// Options for context menu plugin
function getContextMenuItems($item) {
	var contextMenuItems = {
		select: {name: FileManager.lg.select, className: 'select'},
		download: {name: FileManager.lg.download, className: 'download'},
		rename: {name: FileManager.lg.rename, className: 'rename'},
		move: {name: FileManager.lg.move, className: 'move'},
		replace: {name: FileManager.lg.replace, className: 'replace'},
		separator1: "-----",
		delete: {name: FileManager.lg.del, className: 'delete'}
	};

	var data = $item.data('itemdata');

	if(!has_capability(data, 'download')) delete contextMenuItems.download;
	if(!has_capability(data, 'rename') || FileManager.config.options.browseOnly === true) delete contextMenuItems.rename;
	if(!has_capability(data, 'delete') || FileManager.config.options.browseOnly === true) delete contextMenuItems.delete;
	if(!has_capability(data, 'move') || FileManager.config.options.browseOnly === true) delete contextMenuItems.move;
	// remove 'select' if there is no window.opener
	if(!has_capability(data, 'select') || !(window.opener || window.tinyMCEPopup || $.urlParam('field_name'))) delete contextMenuItems.select;
	// remove 'replace' since it is implemented on #preview panel only (for FF and Chrome, need to check in Opera)
	delete contextMenuItems.replace;

	return contextMenuItems
}

// Binds contextual menus to items in list and grid views.
var setMenus = function(action, path) {
	$.getJSON(FileManager.fileConnector + '?mode=getinfo&path=' + encodeURIComponent(path) + '&config=' + FileManager.userconfig + '&time=' + new Date().getTime(), function(data) {
		switch(action) {
			case 'select':
				selectItem(data);
				break;

			case 'download':
				downloadItem(data).then(
					function(result, textStatus, jqXHR) {
						if(result['Code'] == 0) {
							window.location = this.url.replace(/&time=\d+/,'') + '&force=true&time=' + new Date().getTime();
						} else {
							$.prompt(result['Error']);
						}
					}, function( jqXHR, textStatus, errorThrown ) {
						handleAjaxError(textStatus);
					}
				);
				break;

			case 'rename':
				renameItem(data);
				break;

			case 'replace':
				replaceItem(data);
				break;

			case 'move':
				moveItemPrompt(data);
				break;

			case 'delete':
				deleteItem(data);
				break;
		}
	});
};

// Retrieves information about the specified file as a JSON
// object and uses that data to populate a template for
// detail views. Binds the toolbar for that detail view to
// enable specific actions. Called whenever an item is
// clicked in the file tree or list views.
var getFileInfo = function(file) {

	// hide context menu
	$('.context-menu-root').hide();

	var currentpath = file.substr(0, file.lastIndexOf('/') + 1);

	// update location for status, upload, & new folder functions
	setUploader(currentpath);

	// Retrieve the data & populate the template.
	$.getJSON(FileManager.fileConnector + '?mode=getinfo&path=' + encodeURIComponent(file) + '&config=' + FileManager.userconfig + '&time=' + new Date().getTime(), function(data) {
		// is there any error or user is unauthorized
		if(data.Code == '-1') {
			handleError(data.Error);
			return;
		}

		// include the template
		var template = '<div id="preview"><img /><div id="main-title"><h1></h1><div id="tools"></div></div><dl></dl></div>';
		template += '<form id="toolbar">';
		template += '<button id="parentfolder" type="button">' + FileManager.lg.parentfolder + '</button>';
		if($.inArray('select', FileManager.capabilities) != -1 && ($.urlParam('CKEditor') || window.opener || window.tinyMCEPopup || $.urlParam('field_name') || $.urlParam('ImperaviElementId'))) template += '<button id="select" name="select" type="button">' + FileManager.lg.select + '</button>';
		if($.inArray('download', FileManager.capabilities) != -1) template += '<button id="download" name="download" type="button">' + FileManager.lg.download + '</button>';
		if($.inArray('rename', FileManager.capabilities) != -1 && FileManager.config.options.browseOnly != true) template += '<button id="rename" name="rename" type="button">' + FileManager.lg.rename + '</button>';
		if($.inArray('move', FileManager.capabilities) != -1 && FileManager.config.options.browseOnly != true) template += '<button id="move" name="move" type="button">' + FileManager.lg.move + '</button>';
		if($.inArray('delete', FileManager.capabilities) != -1 && FileManager.config.options.browseOnly != true) template += '<button id="delete" name="delete" type="button">' + FileManager.lg.del + '</button>';
		if($.inArray('replace', FileManager.capabilities) != -1 && FileManager.config.options.browseOnly != true) {
			template += '<button id="replace" name="replace" type="button">' + FileManager.lg.replace + '</button>';
			template += '<div class="hidden-file-input"><input id="replacement" name="replacement" type="file" /></div>';
		}
		template += '</form>';

		// add the new markup to the DOM
		getSectionContainer($fileinfo).html(template);

		$fileinfo.find('#main-title > h1').text(data['Filename']).attr('title', file);

		$fileinfo.find('img').attr('src', data['Thumbnail']);
		if(isVideoFile(data['Filename']) && FileManager.config.videos.showVideoPlayer == true) {
			getVideoPlayer(data);
		}
		if(isAudioFile(data['Filename']) && FileManager.config.audios.showAudioPlayer == true) {
			getAudioPlayer(data);
		}
		if(isPdfFile(data['Filename']) && FileManager.config.pdfs.showPdfReader == true) {
			getPdfReader(data);
		}
		if(isDocumentFile(data['Filename']) && FileManager.config.docs.showGoogleViewer == true) {
			getGoogleViewer(data);
		}
		if(isEditableFile(data['Filename']) && FileManager.config.edit.enabled == true && data['Protected']==0) {
			editItem(data);
		}

		if(FileManager.config.options.baseUrl !== false ) {
			var url = smartPath(baseUrl, data['Path'].replace(FileManager.fileRoot, ""));
		} else {
			var url = data['Path'];
		}
		if(data['Protected']==0) {
			$fileinfo.find('div#tools').append(' <a id="copy-button" data-clipboard-text="'+ url + '" title="' + FileManager.lg.copy_to_clipboard + '" href="#"><span>' + FileManager.lg.copy_to_clipboard + '</span></a>');

			// zeroClipboard code
			ZeroClipboard.config({swfPath: FileManager.config.globals.pluginPath + '/scripts/zeroclipboard/dist/ZeroClipboard.swf'});
			var client = new ZeroClipboard(document.getElementById("copy-button"));
			client.on("ready", function(readyEvent) {
				client.on("aftercopy", function(event) {
					// console.log("Copied text to clipboard: " + event.data["text/plain"]);
				});
			});

			$('#copy-button').click(function () {
				$fileinfo.find('div#tools').append('<span id="copied">' + FileManager.lg.copied + '</span>');
				$('#copied').delay(500).fadeOut(1000, function() { $(this).remove(); });
			});
		}

		var properties = '';
		if(data['Protected'] == 0) {
			if(data['Properties']['Width'] && data['Properties']['Width'] != '') properties += '<dt>' + FileManager.lg.dimensions + '</dt><dd>' + data['Properties']['Width'] + 'x' + data['Properties']['Height'] + '</dd>';
			if(data['Properties']['Date Created'] && data['Properties']['Date Created'] != '') properties += '<dt>' + FileManager.lg.created + '</dt><dd>' + data['Properties']['Date Created'] + '</dd>';
			if(data['Properties']['Date Modified'] && data['Properties']['Date Modified'] != '') properties += '<dt>' + FileManager.lg.modified + '</dt><dd>' + data['Properties']['Date Modified'] + '</dd>';
			if(data['Properties']['Size'] || parseInt(data['Properties']['Size'])==0) properties += '<dt>' + FileManager.lg.size + '</dt><dd>' + formatBytes(data['Properties']['Size']) + '</dd>';
		}
		$fileinfo.find('dl').html(properties);

		// Bind toolbar functions.
		$('#toolbar').data('fmitem', data);
		bindToolbar(data);
	});
};

// Clean up unnecessary item data
var prepareItemInfo = function(item) {
	var data = $.extend({}, item);
	delete data['Thumbnail'];
	delete data['Error'];
	delete data['Code'];
	return data;
};

// Retrieves data for all items within the given folder and
// creates a list view. Binds contextual menu options.
// TODO: consider stylesheet switching to switch between grid
// and list views with sorting options.
var getFolderInfo = function(path) {
	// update location for status, upload, & new folder functions
	setUploader(path);

	var container = getSectionContainer($fileinfo),
		loading = '<img id="activity" src="' + FileManager.config.globals.pluginPath + '/themes/' + FileManager.config.options.theme + '/images/wait30trans.gif" width="30" height="30" />',
		item, node, parentNode, props;

	// display an activity indicator
	container.html(loading);

	$('#loading-wrap').fadeOut(800); // remove loading screen div

	var result = '',
		data = getFolderData(path);

	// is there any error or user is unauthorized
	if(data.Code == '-1') {
		handleError(data.Error);
		return;
	}

	// fix dimensions before all images load
	setDimensions();

	if(data) {
		if($fileinfo.data('view') == 'grid') {
			var $ul = $('<ul>', {id: "contents", class: "grid"});

			if(!isFile(path) && path !== FileManager.fileRoot) {
				parentNode = '<li class="directory-parent" data-path="' + getParentDirname(path) + '" oncontextmenu="return false;">';
				parentNode += '<div class="clip"><img src="' + FileManager.config.globals.pluginPath + '/' + FileManager.config.icons.path + '/_Parent.png" alt="Parent" /></div>';
				parentNode += '</li>';
				$ul.append(parentNode);
			}

			for(var key in data) {
				item = data[key];
				props = item['Properties'];

				var scaledWidth = 64;
				var actualWidth = props['Width'];
				if(actualWidth > 1 && actualWidth < scaledWidth) scaledWidth = actualWidth;

				var $li = $('<li>', {
					class: (item['File Type'] == 'dir') ? 'directory' : 'file',
					title: FileManager.config.options.showTitleAttr ? item['Path'] : null,
					'data-path': item['Path']
				}).data('itemdata', prepareItemInfo(item));

				node = '<div class="clip"><img src="' + item['Thumbnail'] + '" width="' + scaledWidth + '" alt="' + item['Path'] + '" /></div>';
				node += '<p>' + item['Filename'] + '</p>';
				if(props['Width'] && props['Width'] != '') node += '<span class="meta dimensions">' + props['Width'] + 'x' + props['Height'] + '</span>';
				if(props['Size'] && props['Size'] != '') node += '<span class="meta size">' + props['Size'] + '</span>';
				if(props['Date Created'] && props['Date Created'] != '') node += '<span class="meta created">' + props['Date Created'] + '</span>';
				if(props['Date Modified'] && props['Date Modified'] != '') node += '<span class="meta modified">' + props['Date Modified'] + '</span>';

				$ul.append($li.append(node));
			}

			result = $ul;
		} else {
			var $table = $('<table>', {id: "contents", class: "list"});

			var thead = '<thead><tr class="rowHeader">';
			thead += '<th class="column-name" data-colname="name"><span>' + FileManager.lg.name + '</span></th>';
			thead += '<th class="column-type" data-colname="type"><span>' + FileManager.lg.type + '</span></th>';
			thead += '<th class="column-dimensions" data-colname="dimensions"><span>' + FileManager.lg.dimensions + '</span></th>';
			thead += '<th class="column-size" data-colname="size"><span>' + FileManager.lg.size + '</span></th>';
			thead += '<th class="column-modified" data-colname="modified"><span>' + FileManager.lg.modified + '</span></th>';
			thead += '</tr></thead>';

			$table.append(thead);
			$table.append('<tbody>');

			if(!isFile(path) && path !== FileManager.fileRoot) {
				parentNode = '<tr class="directory-parent" data-path="' + getParentDirname(path) + '" oncontextmenu="return false;">';
				parentNode += '<td>..</td>';
				parentNode += '<td></td>';
				parentNode += '<td></td>';
				parentNode += '<td></td>';
				parentNode += '<td></td>';
				parentNode += '</tr>';
				$table.append(parentNode);
			}

			for(var key in data) {
				item = data[key];
				props = item['Properties'];

				var $tr = $('<tr>', {
					class: (item['File Type'] == 'dir') ? 'directory' : 'file',
					title: FileManager.config.options.showTitleAttr ? item['Path'] : null,
					'data-path': item['Path']
				}).data('itemdata', prepareItemInfo(item));

				node = '<td>' + item['Filename'] + '</td>';

				if(item['File Type'] && item['File Type'] != '' && item['File Type'] != 'dir') {
					node += '<td>' + item['File Type'] + '</td>';
				} else {
					node += '<td></td>';
				}

				if(props['Width'] && props['Width'] != '') {
					var dimensions = props['Width'] + 'x' + props['Height'];
					node += ('<td>' + dimensions + '</td>');
				} else {
					node += '<td></td>';
				}

				if(props['Size'] && props['Size'] != '') {
					node += '<td>' + formatBytes(props['Size']) + '</td>';
				} else {
					node += '<td></td>';
				}

				if(props['Date Modified'] && props['Date Modified'] != '') {
					node += '<td>' + props['Date Modified'] + '</td>';
				} else {
					node += '<td></td>';
				}

				$table.append($tr.append(node));
			}

			$table.append('</tbody>');
			result = $table;
		}
	} else {
		result += '<h1>' + FileManager.lg.could_not_retrieve_folder + '</h1>';
	}

	// add the new markup to the DOM
	container.html(result);
	// apply client-side sorting, required for persistent list view sorting
	sortViewItems();
	updateFolderSummary();

	var $contents = $fileinfo.find('#contents');

	// add context menu, init drag-and-drop and bind events
	if($fileinfo.data('view') == 'grid') {
		// context menu
		$contents.contextMenu({
			selector: 'li.file, li.directory',
			// wrap options with "build" allows to get item element
			build: function($triggerElement, e) {
				return {
					appendTo: '.fm-container',
					items: getContextMenuItems($triggerElement),
					callback: function(itemKey, opt) {
						var path = opt.$trigger.attr('data-path');
						setMenus(itemKey, path);
					}
				}
			}
		});
		// drag-and-drop
		$contents.find('li.file, li.directory').draggable({
			distance: 10,
			cursor: "move",
			helper: "clone"
		});
		$contents.find('li.directory-parent, li.directory').droppable({
			accept: "li.file, li.directory",
			hoverClass: "drop-hover",
			drop: function(event, ui) {
				var oldPath = ui.draggable.attr('data-path'),
					newPath = $(event.target).attr('data-path');
				moveItem(oldPath, newPath);
			}
		});
		// bind click event to load and display detail view
		$contents.find('li').click(function() {
			var path = $(this).attr('data-path');
			if(FileManager.config.options.quickSelect && data[path]['File Type'] != 'dir' && has_capability(data[path], 'select')) {
				selectItem(data[path]);
			} else {
				getDetailView(path);
			}
		});
	} else {
		// context menu
		$contents.contextMenu({
			selector: 'tr.file, tr.directory',
			// wrap options with "build" allows to get item element
			build: function($triggerElement, e) {
				return {
					appendTo: '.fm-container',
					items: getContextMenuItems($triggerElement),
					callback: function(itemKey, opt) {
						var path = opt.$trigger.attr('data-path');
						setMenus(itemKey, path);
					}
				}
			}
		});
		// drag-and-drop
		$contents.find('tr.file, tr.directory').draggable({
			distance: 10,
			cursor: "move",
			helper: "clone"
		});
		$contents.find('tr.directory-parent, tr.directory').droppable({
			accept: "tr.file, tr.directory",
			hoverClass: "drop-hover",
			drop: function(event, ui) {
				var oldPath = ui.draggable.attr('data-path'),
					newPath = $(event.target).attr('data-path');
				moveItem(oldPath, newPath);
			}
		});
		// bind click event to load and display detail view
		$contents.find('tbody > tr').click(function() {
			var path = $(this).attr('data-path');
			if(FileManager.config.options.quickSelect && data[path]['File Type'] != 'dir' && has_capability(data[path], 'select')) {
				selectItem(data[path]);
			} else {
				getDetailView(path);
			}
		});
		// bind click event to table header to implement sorting
		$contents.find('.rowHeader > th').click(function(e) {
			var $th = $(this);
			var columnName = $th.data('colname');
			var isAscending = !$th.hasClass('sorted-desc');
			var order = isAscending ? 'desc' : 'asc';

			// stores sorting settings as container data to retrieve them on sorting
			$fileinfo.data('list-sort', {column: columnName, order: order});
			sortViewItems();
		});

		// Calling display_icons() function to get icons from filteree
		// Necessary to fix bug https://github.com/simogeo/Filemanager/issues/170
		var timer = setInterval(function() {display_icons(timer)}, 300);
	}
};

// Retrieve data (file/folder listing) for jqueryFileTree and list/grid view from server
var getFolderData = function(path) {
	// TODO: it is also possible to cache based on "source" (filetree / main window list)
	// caches result for specified path to get rid of redundant requests
	if(!loadedFolderData[path] || (Date.now() - loadedFolderData[path].cached) > 2000) {
		var url = FileManager.fileConnector + '?mode=getfolder&path=' + encodeURIComponent(path) + '&config=' + FileManager.userconfig + '&showThumbs=' + FileManager.config.options.showThumbs + '&time=' + new Date().getTime();
		if ($.urlParam('type')) url += '&type=' + $.urlParam('type');

		$.ajax({
			'async': false,
			'url': url,
			'dataType': "json",
			'cache': false,
			'success': function(data) {
				loadedFolderData[path] = {
					cached: Date.now(),
					data: data
				};
			},
			error: handleAjaxError
		});
	}
	return loadedFolderData[path].data;
};

// Retrieves data (file/folder listing) and build html for jqueryFileTree
var buildFileTreeBranch = function(options, itemPath) {
	var result,
		items = [],
		data = getFolderData(options.dir);

	// Is there any error or user is unauthorized?
	if(data.Code == '-1') {
		handleError(data.Error);
		return;
	}

	if(data) {
		for(var key in data) {
			var item = buildFileTreeItem(data[key]);
			// returns single node if its path is specified
			if(itemPath && data[key]['Path'] === itemPath) {
				return item;
			} else {
				items.push(item);
			}
		}
		var $ul = $('<ul>', {class: "jqueryFileTree", style: "display: none;"}).append(items);

		sortFileTreeItems($ul);
		adjustFileTree($ul);
		result = $ul;
	} else {
		result = $('<h1>').text(FileManager.lg.could_not_retrieve_folder);
	}
	return result;
};

// Builds html node for filetree branch
var buildFileTreeItem = function(item) {
	var result,
		extraClass;

	var $link = $('<a>', {rel: item['Path'], "data-path": item['Path'], text: item['Filename']})
		.data('itemdata', prepareItemInfo(item));

	if(item['File Type'] == 'dir') {
		extraClass = item['Protected'] == 0 ? '' : ' directory-locked';
		result = $('<li>', {class: "directory collapsed" + extraClass}).append($link);
	} else {
		if(FileManager.config.options.listFiles) {
			extraClass = item['Protected'] == 0 ? '' : ' file-locked';
			result = $('<li>', {class: "file ext_" + item['File Type'].toLowerCase() + extraClass}).append($link);
		}
	}
	return result;
};




/*---------------------------------------------------------
  Initialization
---------------------------------------------------------*/

$(function() {
  
  initConfigLastPromise.done(function(res) {

	if(FileManager.config.extras.extra_js) {
		for(var i=0; i< FileManager.config.extras.extra_js.length; i++) {
			$.ajax({
				url: FileManager.config.extras.extra_js[i],
				dataType: "script",
				async: FileManager.config.extras.extra_js_async
			});
		}
	}

	$('#link-to-project').attr('href', FileManager.config.url).attr('target', '_blank').attr('title', FileManager.lg.support_fm + ' [' + FileManager.lg.version + ' : ' + FileManager.config.version + ']');
	$('div.version').html(FileManager.config.version);

	// Loading theme
	loadCSS('/themes/' + FileManager.config.options.theme + '/styles/filemanager.css');
	$.ajax({
	    url: FileManager.config.globals.pluginPath + '/themes/' + FileManager.config.options.theme + '/styles/ie.css',
	    async: false,
	    success: function(data)
	    {
	        $('head').append(data);
	    }
	});

	// loading zeroClipboard
	loadJS('/scripts/zeroclipboard/dist/ZeroClipboard.js');

	// Loading CodeMirror if enabled for online edition
	if(FileManager.config.edit.enabled) {
		loadCSS('/scripts/CodeMirror/lib/codemirror.css');
		loadCSS('/scripts/CodeMirror/theme/' + FileManager.config.edit.theme + '.css');
		loadJS('/scripts/CodeMirror/lib/codemirror.js');
		loadJS('/scripts/CodeMirror/addon/selection/active-line.js');
		loadCSS('/scripts/CodeMirror/addon/display/fullscreen.css');
		loadJS('/scripts/CodeMirror/addon/display/fullscreen.js');
		loadJS('/scripts/CodeMirror/dynamic-mode.js');
	}
  
  // added gk from simogeo, why was it removed?
  if(!FileManager.config.options.fileRoot) {
        FileManager.fileRoot = '/' + document.location.pathname.substring(1, document.location.pathname.lastIndexOf('/') + 1) + 'userfiles/';
  } else {
     if(!FileManager.config.options.serverRoot) {
        FileManager.fileRoot = FileManager.config.options.fileRoot;
      } else {
        FileManager.fileRoot = '/' + FileManager.config.options.fileRoot;
      }
      // we remove double slashes - can happen when using PHP SetFileRoot() function with fileRoot = '/' value
      FileManager.fileRoot = FileManager.fileRoot.replace(/\/\//g, '\/');
  }
  // end gk

	if(FileManager.config.options.baseUrl === false) {
		baseUrl = window.location.protocol + "//" + window.location.host;
	} else {
		baseUrl = FileManager.config.options.baseUrl;
	}

	// changes files root to restrict the view to a given folder
	if($.urlParam('exclusiveFolder') != 0) {
		FileManager.fileRoot += $.urlParam('exclusiveFolder');
		if(isFile(FileManager.fileRoot)) FileManager.fileRoot += '/'; // add last '/' if needed
		FileManager.fileRoot = FileManager.fileRoot.replace(/\/\//g, '\/');
	}

	// get folder that should be expanded after filemanager is loaded
	var expandedFolder = '';
	if($.urlParam('expandedFolder') != 0) {
		expandedFolder = $.urlParam('expandedFolder');
		fullexpandedFolder = FileManager.fileRoot + expandedFolder;
	}

	// finalize the FileManager UI initialization with localized text
	if(FileManager.config.options.localizeGUI === true) {
        $uploadButton.append(FileManager.lg.upload);
        $('#newfolder').append(FileManager.lg.new_folder);
        $('#grid').attr('title', FileManager.lg.grid_view);
        $('#list').attr('title', FileManager.lg.list_view);
	}

	// adding a close button triggering callback function if CKEditorCleanUpFuncNum passed
	if($.urlParam('CKEditorCleanUpFuncNum')) {
		$("body").append('<button id="close-btn" type="button">' + FileManager.lg.close + '</button>');

		$('#close-btn').click(function () {
			parent.CKEDITOR.tools.callFunction($.urlParam('CKEditorCleanUpFuncNum'));
		});
	}

	// input file replacement
	$('#browse').append('+').attr('title', FileManager.lg.browse);
	$("#newfile").change(function() {
		$("#filepath").val($(this).val().replace(/.+[\\\/]/, ""));
	});

	// load searchbox
	if(FileManager.config.options.searchBox === true)  {
		loadJS('/scripts/filemanager.liveSearch.min.js');
	} else {
		$('#search').remove();
	}

	// cosmetic tweak for buttons
	$('button').wrapInner('<span></span>');

	// Set initial view state.
	$fileinfo.data('view', FileManager.config.options.defaultViewMode);
	setViewButtonsFor(FileManager.config.options.defaultViewMode);

	$('#home').click(function() {
		createFileTree();
		getFolderInfo(FileManager.fileRoot);
	});

	$('#level-up').click(function() {
		var currentPath = getCurrentPath(),
			isPreview = $('#preview').length > 0;

		// already in root folder
		if(currentPath == FileManager.fileRoot && !isPreview) {
			return false;
		}
		// loads current path in preview mode or parent folder otherwise
		var path = isPreview ? currentPath : getParentDirname(currentPath);
		getFolderInfo(path);
	});

	// Set buttons to switch between grid and list views.
	$('#grid').click(function() {
		setViewButtonsFor('grid');
		$fileinfo.data('view', 'grid');
		getFolderInfo(getCurrentPath());
	});

	$('#list').click(function() {
		setViewButtonsFor('list');
		$fileinfo.data('view', 'list');
		getFolderInfo(getCurrentPath());
	});

	// display storage summary info
	$('#summary').click(function() {
		var message = '<div class="title">' + FileManager.lg.summary_title + '</div>';
		var $prompt = $.prompt(message).addClass('summary-popup');

		$.getJSON(FileManager.fileConnector + '?mode=summarize&config=' + FileManager.userconfig, function(result) {
			if(result['Code'] == 0) {
				var $content = $prompt.find('.jqimessage'),
					size = formatBytes(result['Size'], true);

				if(FileManager.config.options.fileRootSizeLimit > 0) {
					var sizeTotal = formatBytes(FileManager.config.options.fileRootSizeLimit, true);
					var ratio = result['Size'] * 100 / FileManager.config.options.fileRootSizeLimit;
					var percentage = Math.round(ratio * 100) / 100;
					size += ' (' + percentage + '%) ' + FileManager.lg.of + ' ' + sizeTotal;
				}

				$content.append($('<div>', {class: 'line', text: FileManager.lg.summary_files + ': ' + result['Files']}));
				if(result['Folders']) {
					$content.append($('<div>', {class: 'line', text: FileManager.lg.summary_folders + ': ' + result['Folders']}));
				}
				$content.append($('<div>', {class: 'line', text: FileManager.lg.summary_size + ': ' + size}));
			} else {
				$.prompt(result['Error']);
			}
		});
	});

	// Provide initial values for upload form, status, etc.
	setUploader(FileManager.fileRoot);


	/** Handling File upload **/

	// Multiple Uploads
	if(FileManager.config.upload.multiple) {
		// Load jquery file upload library
		loadCSS('/scripts/jQuery-File-Upload/css/dropzone.css');

		// remove simple file upload element
		$('#file-input-container').remove();

		$uploadButton.unbind().click(function() {
			if(FileManager.capabilities.indexOf('upload') === -1) {
				$.prompt(FileManager.lg.NOT_ALLOWED);
				return false;
			}

			var allowedFileTypes,
				currentPath = getCurrentPath(),
				templateContainer = loadTemplate('upload-container', {
					folder: FileManager.lg.current_folder + currentPath,
					info: FileManager.lg.upload_files_number_limit.replace('%s', FileManager.config.upload.numberOfFiles) + ' ' + FileManager.lg.upload_file_size_limit + formatBytes(FileManager.config.upload.fileSizeLimit, true),
					lang: FileManager.lg
				});

			if(FileManager.config.security.uploadPolicy == 'DISALLOW_ALL') {
				allowedFileTypes = new RegExp('(\\.|\\/)(' + FileManager.config.security.uploadRestrictions.join('|') + ')$', 'i');
			} else {
				// allow any extension since we have no easy way to handle the the built-in `acceptedFiles` params
				allowedFileTypes = null;
			}

			if ($.urlParam('type').toString().toLowerCase() == 'images' || FileManager.config.upload.imagesOnly) {
				allowedFileTypes = new RegExp('(\\.|\\/)(' + FileManager.config.images.imagesExt.join('|') + ')$', 'i');
			}

			var btns = {};
			btns[FileManager.lg.close] = false;
			$.prompt(templateContainer, {
				buttons: btns,
				persistent: true
			});

			var $uploadContainer = $('#fileupload-container'),
				$dropzone = $('.dropzone', $uploadContainer),
				$totalProgressBar = $('#total-progress', $uploadContainer).children();

			$dropzone.on("click", function(e) {
				if(e.target === this || $(e.target).parent().hasClass('default-message')) {
					$('#fileupload', $uploadContainer).trigger('click');
				}
			});

			/**
			 * Start uploading process.
			 */
			$dropzone.on('click', '.button-start', function(e) {
				var $target = $(this);
				var $buttons = $target.parent().parent();
				var data = $buttons.data();

				data.submit();
				$target.remove();
			});

			/**
			 * Abort uploading process.
			 */
			$dropzone.on('click', '.button-abort', function(e) {
				var $target = $(this),
					$buttons = $target.parent().parent(),
					data = $buttons.data(),
					$node = data.files[0].context;

				data.abort();
				$node.find('.error-message').text(FileManager.lg.upload_aborted);
				$node.addClass('aborted');
			});

			/**
			 * Resume uploading if at least one chunk was uploaded.
			 * Otherwise start upload from the very beginning of file.
			 */
			$dropzone.on('click', '.button-resume', function(e) {
				var $target = $(this),
					$buttons = $target.parent().parent(),
					data = $buttons.data(),
					file = data.files[0];

				if(file.chunkUploaded) {
					var path = currentPath + file.serverName,
						url = FileManager.fileConnector + '?mode=getinfo&path=' + encodeURIComponent(path) + '&config=' + FileManager.userconfig + '&time=' + new Date().getTime();

					$.ajax({
						'url': url,
						'dataType': "json",
						'async': false,
						'success': function(result) {
							if(result['Code'] == 0) {
								data.uploadedBytes = Number(result['Properties']['Size']);
								if(!data.uploadedBytes) {
									file.chunkUploaded = undefined;
								}
							}
						}
					});
				}
				$.blueimp.fileupload.prototype.options.add.call($('#fileupload')[0], e, data);

				data.submit();
			});

			/**
			 * Remove file from upload query.
			 * Also remove uploaded file chunks if were uploaded.
			 */
			$dropzone.on('click', '.button-remove', function(e) {
				var $target = $(this),
					$buttons = $target.parent().parent(),
					data = $buttons.data(),
					file = data.files[0];

				if(file.chunkUploaded) {
					var path = currentPath + file.serverName,
						url = FileManager.fileConnector + '?mode=delete&path=' + encodeURIComponent(path) + '&config=' + FileManager.userconfig + '&time=' + new Date().getTime();

					$.getJSON(url, function(result) {
						if(result['Code'] == 0) {
							var path = result['Path'];
							removeNode(path);
						}
					});
				}

				$target.closest('.upload-item').remove();
				updateDropzoneView();
			});

			$dropzone.on('click', '.button-info', function(e) {
				var $target = $(this);
				var $node = $target.closest('.upload-item');

				if($node.hasClass('error')) {
					var $message = $node.find('.error-message');
					$message.css({'opacity': ($message.css('opacity') === '1' ? '0' : '1')});
				}
			});

			$("#process-upload", $uploadContainer).on("click", function() {
				$dropzone.find('.button-start').trigger('click');
			});

			var updateDropzoneView = function() {
				if($dropzone.children('.upload-item').length > 0) {
					$dropzone.addClass('started');
				} else {
					$dropzone.removeClass('started');
				}
			};

			$('#fileupload', $uploadContainer)
				.fileupload({
					autoUpload: false,
					sequentialUploads: true,
					dataType: 'json',
					dropZone: $dropzone,
					maxChunkSize: FileManager.config.upload.chunkSize,
					url: FileManager.fileConnector + '?config=' + FileManager.userconfig,
					paramName: FileManager.config.upload.paramName,
					formData: {
						mode: 'add',
						currentpath: currentPath
					},
					// validation
					// maxNumberOfFiles works only for single "add" call when "singleFileUploads" is set to "false"
					maxNumberOfFiles: FileManager.config.upload.numberOfFiles,
					acceptFileTypes: allowedFileTypes,
					maxFileSize: FileManager.config.upload.fileSizeLimit,
					messages: {
						maxNumberOfFiles: FileManager.lg.upload_files_number_limit.replace("%s", FileManager.config.upload.numberOfFiles),
						acceptFileTypes: FileManager.lg.upload_file_type_invalid,
						maxFileSize: FileManager.lg.upload_file_too_big + ' ' + FileManager.lg.upload_file_size_limit + formatBytes(FileManager.config.upload.fileSizeLimit, true)
					},
					// image preview options
					previewMaxHeight: 120,
					previewMaxWidth: 120,
					previewCrop: true
				})

				.on('fileuploadadd', function(e, data) {
					var $items = $dropzone.children('.upload-item');
					$.each(data.files, function (index, file) {
						// skip selected files if total files number exceed "maxNumberOfFiles"
						if($items.length >= FileManager.config.upload.numberOfFiles) {
							return false;
						}
						// to display in item template
						file.formattedSize = formatBytes(file.size);
						var $template = $(loadTemplate('upload-item', {
							file: file,
							lang: FileManager.lg,
							imagesPath: FileManager.config.globals.pluginPath + '/scripts/jQuery-File-Upload/img'
						}));
						file.context = $template;
						$template.find('.buttons').data(data);
						$template.appendTo($dropzone);
					});
					updateDropzoneView();
				})

				.on('fileuploadsend', function(e, data) {
					$.each(data.files, function (index, file) {
						var $node = file.context;
						$node.removeClass('added aborted error').addClass('process');

						// workaround to handle a case while chunk uploading when you may press abort button after
						// uploading is done, but right before "fileuploaddone" event is fired, and try to resume upload
						if(file.chunkUploaded && (data.total === data.uploadedBytes)) {
							$node.remove();
						}
					});
				})

				.on('fileuploadfail', function(e, data) {
					$.each(data.files, function (index, file) {
						file.error = FileManager.lg.upload_failed;
						var $node = file.context;
						$node.removeClass('added process').addClass('error');
					});
				})

				.on('fileuploaddone', function(e, data) {
					$.each(data.files, function (index, file) {
						var errorMessage,
							result = data.result,
							$node = file.context;

						// error from upload handler
						if(result.files && result.files[index].error) {
							errorMessage = result.files[index].error;
						}
						// error from filemanager (common for all files)
						if(result.Code == '-1' && result.Error) {
							errorMessage = result.Error;
						}

						if(errorMessage) {
							// handle server-side error
							$node.removeClass('added process').addClass('error');
							$node.find('.error-message').text(errorMessage);
							$node.find('.button-start').remove();
						} else {
							// remove file preview item on success upload
							$node.remove();
						}
					});
				})

				.on('fileuploadalways', function(e, data) {
					var $items = $dropzone.children('.upload-item');
					// all files in queue are processed
					if($items.filter('.added').length === 0 && $items.filter('.process').length === 0) {
						// all files were successfully uploaded
						if($items.length === 0) {
							$.prompt.close();
							if (FileManager.config.options.showConfirmation) {
								$.prompt(FileManager.lg.upload_successful_files);
							}
						}
						// errors occurred
						if($items.filter('.error').length) {
							$.prompt(FileManager.lg.upload_partially + "<br>" + FileManager.lg.upload_failed_details);
						}
						getFolderInfo(currentPath);
						reloadFileTreeNode(currentPath);
					}
					updateDropzoneView();
				})

				.on('fileuploadprocessalways', function(e, data) {
					$.each(data.files, function (index, file) {
						var $node = file.context;
						// show preview for image file
						if (file.preview) {
							$node.find('.image').append(file.preview);
							$node.find('.preview').removeClass('file-preview').addClass('image-preview');
						}
						// handle client-side error
						if (file.error) {
							$node.removeClass('added process').addClass('error');
							$node.find('.error-message').text(file.error);
							$node.find('.button-start').remove();
						}
					});
				})

				.on('fileuploadprogress', function (e, data) {
					$.each(data.files, function (index, file) {
						// fill progress bar for single item
						var $node = file.context,
							progress = parseInt(data.loaded / data.total * 100, 10);
						$node.find('.progress-bar').css('width', progress + '%');
					});
				})

				.on('fileuploadprogressall', function (e, data) {
					// fill total progress bar
					var progress = parseInt(data.loaded / data.total * 100, 10);
					$totalProgressBar.css('width', progress + '%');
				})

				.on('fileuploadchunkdone', function (e, data) {
					$.each(data.files, function (index, file) {
						// get filename from server, it may differ from original
						file.serverName = data.result.files[index].name;
						// mark that file has uploaded chunk(s)
						file.chunkUploaded = 1;
					});
				});
		});

	// Simple Upload
	} else {

		$uploadButton.click(function() {
			if(FileManager.capabilities.indexOf('upload') === -1) {
				$.prompt(FileManager.lg.NOT_ALLOWED);
				return false;
			}

			var data = $(this).data();
			if($.isEmptyObject(data)) {
				$.prompt(FileManager.lg.upload_choose_file);
			} else {
				data.submit();
			}
		});

		$uploader
			.fileupload({
				autoUpload: false,
				dataType: 'json',
				url: FileManager.fileConnector + '?config=' + FileManager.userconfig,
				paramName: FileManager.config.upload.paramName
			})

			.on('fileuploadadd', function(e, data) {
				$uploadButton.data(data);
			})

			.on('fileuploadsubmit', function(e, data) {
				data.formData = {
					mode: 'add',
					currentpath: getCurrentPath()
				};
				$uploadButton.addClass('loading').prop('disabled', true);
				$uploadButton.children('span').text(FileManager.lg.loading_data);
			})

			.on('fileuploadalways', function(e, data) {
				$("#filepath").val('');
				$uploadButton.removeData().removeClass('loading').prop('disabled', false);
				$uploadButton.children('span').text(FileManager.lg.upload);

				var errorMessage,
					result = data.result;

				// error from upload handler
				if(result.files && result.files[0].error) {
					errorMessage = result.files[0].error;
				}
				// error from filemanager
				if(result.Code == '-1' && result.Error) {
					errorMessage = result.Error;
				}

				if(errorMessage) {
					$.prompt(FileManager.lg.upload_failed + "<br>" + errorMessage);
				} else {
					// success upload
					var currentPath = getCurrentPath();
					getFolderInfo(currentPath);
					reloadFileTreeNode(currentPath);
					if(FileManager.config.options.showConfirmation) {
						$.prompt(FileManager.lg.upload_successful_file);
					}
				}
			})

			.on('fileuploadfail', function(e, data) {
				// server error 500, etc.
				$.prompt(FileManager.lg.upload_failed);
			});
	}

	// Loading CustomScrollbar if enabled
	// Important, the script should be called after calling createFileTree() to prevent bug
	if(FileManager.config.customScrollbar.enabled) {
		loadCSS('/scripts/custom-scrollbar-plugin/jquery.mCustomScrollbar.min.css');
		loadJS('/scripts/custom-scrollbar-plugin/jquery.mCustomScrollbar.concat.min.js');

		var csTheme = FileManager.config.customScrollbar.theme != undefined ? FileManager.config.customScrollbar.theme : 'inset-2-dark';
		var csButton = FileManager.config.customScrollbar.button != undefined ? FileManager.config.customScrollbar.button : true;
    
    var fileTreeloaded = jQuery.Deferred();
    $("#filetree").append('<div style="height:3000px"></div>'); // because if #filetree has height equal to 0, mCustomScrollbar is not applied
    $("#filetree").mCustomScrollbar({
      theme:csTheme,
      scrollButtons:{enable:csButton},
      advanced:{ 
        autoExpandHorizontalScroll:true,
        updateOnContentResize: true 
      },
      callbacks:{
        onInit:function(){ 
          createFileTree(); 
          fileTreeloaded.resolve(true);
        }			
      },
      axis: "yx"
      });

    fileTreeloaded.done(function(result) {
        $("#fileinfo").mCustomScrollbar({
          theme:csTheme,
          scrollButtons:{ 
            enable:csButton
          },
          advanced:{ 
            autoExpandHorizontalScroll:true, 
            updateOnContentResize: true 
          },
          axis: "y",
          alwaysShowScrollbar: 1
        });
     });
	} else {
		createFileTree();
	}

	// keep only browseOnly features if needed
	if(FileManager.config.options.browseOnly == true) {
		$('#file-input-container').remove();
		$uploadButton.remove();
		$('#newfolder').remove();
		$('#toolbar').remove('#rename');
	}

    // Adjust layout.
    setDimensions();
    $(window).resize(setDimensions);

      // Provides support for adjustible columns.
    $('#splitter').splitter({
      sizeLeft: FileManager.config.options.splitterMinWidth,
      minLeft: FileManager.config.options.splitterMinWidth,
      minRight: 200
    });

    getDetailView(FileManager.fileRoot + expandedFolder);

    // add useragent string to html element for IE 10/11 detection
    var doc = document.documentElement;
    doc.setAttribute('data-useragent', navigator.userAgent);

    if(FileManager.config.options.logger) {
      var end = new Date().getTime();
      var time = end - start;
      console.log('Total execution time : ' + time + ' ms');
    }

    $(window).load(function() {
      setDimensions();
    });
    
    // add location.origin for IE
    if (!window.location.origin) {
      window.location.origin = window.location.protocol + "//"
        + window.location.hostname
        + (window.location.port ? ':' + window.location.port : '');
    }

    $(window).load(function() {
        $('#fileinfo').css({'left':$('#splitter .vsplitbar').width() + $('#filetree').width()});
    });
    
   }); // promise done

 });


})(jQuery);


