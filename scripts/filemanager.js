/**
 *	Filemanager JS core
 *
 *	filemanager.js
 *
 *	@license	MIT License
 *	@author		Jason Huck - Core Five Labs
 *	@author		Simon Georget <simon (at) linea21 (dot) com>
 *	@author		Pavel Solomienko <https://github.com/servocoder/>
 *	@copyright	Authors
 */

(function($) {

// function to retrieve GET params
$.urlParam = function(name){
	var results = new RegExp('[\\?&]' + name + '=([^&#]*)').exec(window.location.href);
	if (results)
		return results[1];
	else
		return 0;
};

/*---------------------------------------------------------
  Setup, Layout, and Status Functions
---------------------------------------------------------*/

// Retrieves config settings from filemanager.config.js
var loadConfigFile = function (type) {
	var json = null,
		pluginPath = ".";
	type = (typeof type === "undefined") ? "user" : type;

	if (window._FMConfig && window._FMConfig.pluginPath) {
		pluginPath = window._FMConfig.pluginPath;
	}

	if(type == 'user') {
		if($.urlParam('config') != 0) {
			var url = pluginPath + '/scripts/' + $.urlParam('config');
			userconfig = $.urlParam('config');
		} else {
			var url = pluginPath + '/scripts/filemanager.config.js';
			userconfig = 'filemanager.config.js';
		}
	} else {
		var url = pluginPath + '/scripts/filemanager.config.js.default';
	}

    $.ajax({
        'async': false,
        'url': url,
        'dataType': "json",
        cache: false,
        'success': function (data) {
            json = data;
        }
    });

	if(type == 'default') {
		json.globals = {pluginPath: pluginPath};
	}

    return json;
};

// loading default configuration file
var configd = loadConfigFile('default');
// loading user configuration file
var config = loadConfigFile();
// remove version from user config file
if (config !== null) delete config.version;

// merge default config and user config file
var config = $.extend({}, configd, config);

if(config.options.logger) var start = new Date().getTime();

// <head> included files collector
HEAD_included_files = new Array();


/**
 * function to load a given css file into header
 * if not already included
 */
loadCSS = function(href) {
	// check if already included
	if($.inArray(href, HEAD_included_files) == -1) {
		var cssLink = $("<link rel='stylesheet' type='text/css' href='" + href + "'>");
		$("head").append(cssLink);
	    HEAD_included_files.push(href);
	}
};

/**
* function to load a given js file into header
* if not already included
*/
loadJS = function(src) {
	// check if already included
	if($.inArray(src, HEAD_included_files) == -1) {
		var jsLink = $("<script type='text/javascript' src='" + src + "'>");
	    $("head").append(jsLink);
	    HEAD_included_files.push(src);
	}
};

/**
 * determine path when using baseUrl and
 * setFileRoot connector function to give back
 * a valid path on selectItem calls
 *
 */
smartPath = function(url, path) {
	var a = url.split('/');
	var separator = '/' + a[a.length-2] + '/';
	var pos = path.indexOf(separator);
	// separator is not found
	// this can happen when not set dynamically with setFileRoot function - see  : https://github.com/simogeo/Filemanager/issues/354
	if(pos == -1) {
		rvalue = url + path;
	} else {
		rvalue = url + path.substring(pos + separator.length);
	}
	if(config.options.logger) console.log("url : " + url + " - path : " + path +  " - separator : " + separator + " -  pos : " + pos + " - returned value : " +rvalue);

	return rvalue;
};

// Sets paths to connectors based on language selection.
var fileConnector = config.options.fileConnector || config.globals.pluginPath + '/connectors/' + config.options.lang + '/filemanager.' + config.options.lang;

// Read capabilities from config files if exists
// else apply default settings
var capabilities = config.options.capabilities || new Array('select', 'download', 'rename', 'move', 'delete', 'replace');

// Stores path to be automatically expanded by filetree plugin
var fullexpandedFolder;

// Stores file/folder listing data for jqueryFileTree and list/grid view
var loadedFolderData = {};

// Get localized messages from file
// through culture var or from URL
if($.urlParam('langCode') != 0) {
    if(file_exists (config.globals.pluginPath + '/scripts/languages/'  + $.urlParam('langCode') + '.js')) {
        config.options.culture = $.urlParam('langCode');
    } else {
        var urlLang = $.urlParam('langCode').substring(0, 2);
        if(file_exists (config.globals.pluginPath + '/scripts/languages/'  + urlLang + '.js')) config.options.culture = urlLang;
    }
}

var lg = [];
$.ajax({
  url: config.globals.pluginPath + '/scripts/languages/'  + config.options.culture + '.js',
  async: false,
  dataType: 'json',
  success: function (json) {
    lg = json;
  }
});

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
var setDimensions = function(){
	var bheight = 0,
		$uploader = $('#uploader'),
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

	var newW = $('#splitter').width() - $('div.vsplitbar').width() - $('#filetree').width();
	$('#fileinfo').width(newW);
};

// Display Min Path
var displayPath = function (path, reduce) {
	reduce = (typeof reduce === "undefined") ? true : false;

	if (config.options.showFullPath == false) {
		path = path.replace(fileRoot, "/");
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

// Test if a given url exists
function file_exists (url) {
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

    // HEAD Results are usually shorter (faster) than GET
    req.open('HEAD', url, false);
    req.send(null);
    if (req.status == 200) {
        return true;
    }

    return false;
}

// preg_replace
// Code from : http://xuxu.fr/2006/05/20/preg-replace-javascript/
var preg_replace = function(array_pattern, array_pattern_replace, str) {
	var new_str = String (str);
		for (i=0; i<array_pattern.length; i++) {
			var reg_exp= RegExp(array_pattern[i], "g");
			var val_to_replace = array_pattern_replace[i];
			new_str = new_str.replace (reg_exp, val_to_replace);
		}
		return new_str;
	};

// Sanitize and transliterate file/folder name as server side (connector) way
var cleanString = function(str, allowed) {
	if(!config.security.normalizeFilename) {
		return str;
	}

	loadJS(config.globals.pluginPath + '/scripts/speakingurl/speakingurl.min.js');
	if (typeof allowed == "undefined") {
		allowed = [];
	}

	var cleaned = getSlug(str, {
		separator: '_',
		maintainCase: true,
		custom: allowed
	});

	// allow only latin alphabet
	if(config.options.chars_only_latin) {
		cleaned = cleaned.replace(/[^_a-zA-Z0-9]/g, "");
	}

	return cleaned.replace(/[_]+/g, "_");
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
var formatBytes = function(bytes) {
	var n = parseFloat(bytes);
	var d = parseFloat(1024);
	var c = 0;
	var u = [lg.bytes,lg.kb,lg.mb,lg.gb];

	while(true){
		if(n < d){
			n = Math.round(n * 100) / 100;
			return n + u[c];
		} else {
			n /= d;
			c += 1;
		}
	}
};

// Handle Error. Freeze interactive buttons and display error message.
// Also called when auth() function return false (Code == "-1")
var handleError = function(errMsg) {
	$('#fileinfo').html('<h1>' + errMsg+ '</h1>');
	$('#newfile').attr("disabled", "disabled");
	$('#upload').attr("disabled", "disabled");
	$('#newfolder').attr("disabled", "disabled");
};

// Test if Data structure has the 'cap' capability
// 'cap' is one of 'select', 'rename', 'delete', 'download', move
function has_capability(data, cap) {
	if (data['File Type'] == 'dir' && cap == 'replace') return false;
	if (data['File Type'] == 'dir' && cap == 'download') {
		if(config.security.allowFolderDownload == true) return true;
		else return false;
	}
	if (typeof(data['Capabilities']) == "undefined") return true;
	else return $.inArray(cap, data['Capabilities']) > -1;
}

// Test if file is authorized
var isAuthorizedFile = function(filename) {

	var ext = getExtension(filename);

	// no extension is allowed
	if(ext == '' && config.security.allowNoExtension == true) return true;

	if(config.security.uploadPolicy == 'DISALLOW_ALL') {
		if($.inArray(ext, config.security.uploadRestrictions) != -1) return true;
	}
	if(config.security.uploadPolicy == 'ALLOW_ALL') {
		if($.inArray(ext, config.security.uploadRestrictions) == -1) return true;
	}

    return false;
};

// Test if path is dir
var isFile = function(path) {
	return path.charAt(path.length-1) != '/';
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
	if(path.lastIndexOf('/') != path.length -1) {
		return path.substr(0, path.lastIndexOf('/') + 1);
	} else {
		return path;
	}
};

// return parent folder for path
// "/dir/to/"          -->  "/dir/"
// "/dir/to/file.txt"  -->  "/dir/"
var getParentDirname = function(path) {
	return path.split('/').slice(0, length - 2).join('/') + '/';
	// return path.split('/').reverse().slice(1).reverse().join('/') + '/';
};

// return closest node for path
// "/dir/to/"          -->  "/dir/"
// "/dir/to/file.txt"  -->  "/dir/to/"
var getClosestNode = function(path) {
	return path.substring(0, path.slice(0, -1).lastIndexOf('/')) + '/';
};

// Test if is editable file
var isEditableFile = function(filename) {
	if($.inArray(getExtension(filename), config.edit.editExt) != -1) {
		return true;
	} else {
		return false;
	}
};

// Test if is image file
var isImageFile = function(filename) {
	if($.inArray(getExtension(filename), config.images.imagesExt) != -1) {
		return true;
	} else {
		return false;
	}
};

// Test if file is supported web video file
var isVideoFile = function(filename) {
	if($.inArray(getExtension(filename), config.videos.videosExt) != -1) {
		return true;
	} else {
		return false;
	}
};

// Test if file is supported web audio file
var isAudioFile = function(filename) {
	if($.inArray(getExtension(filename), config.audios.audiosExt) != -1) {
		return true;
	} else {
		return false;
	}
};

// Test if file is pdf file
var isPdfFile = function(filename) {
	if($.inArray(getExtension(filename), config.pdfs.pdfsExt) != -1) {
		return true;
	} else {
		return false;
	}
};

// Return HTML video player
var getVideoPlayer = function(data) {
	var code  = '<video width=' + config.videos.videosPlayerWidth + ' height=' + config.videos.videosPlayerHeight + ' src="' + data['Path'] + '" controls="controls">';
		code += '<img src="' + data['Preview'] + '" />';
		code += '</video>';

	$("#fileinfo img").remove();
	$('#fileinfo #preview #main-title').before(code);

};

//Return HTML audio player
var getAudioPlayer = function(data) {
	var code  = '<audio src="' + data['Path'] + '" controls="controls">';
		code += '<img src="' + data['Preview'] + '" />';
		code += '</audio>';

	$("#fileinfo img").remove();
	$('#fileinfo #preview #main-title').before(code);

};

//Return PDF Reader
var getPdfReader = function(data) {
	var code  = '<iframe id="fm-pdf-viewer" src = "scripts/ViewerJS/index.html#' + data['Path'] + '" width="' + config.pdfs.pdfsReaderWidth + '" height="' + config.pdfs.pdfsReaderHeight + '" allowfullscreen webkitallowfullscreen></iframe>';

	$("#fileinfo img").remove();
	$('#fileinfo #preview #main-title').before(code);
};

// Display icons on list view
// retrieving them from filetree
// Called using SetInterval
var display_icons = function(timer) {
	$('#fileinfo').find('td:first-child').each(function(){
		var path = $(this).attr('data-path');
		var treenode = $('#filetree').find('a[data-path="' + path + '"]').parent();

		if (typeof treenode.css('background-image') !== "undefined") {
			$(this).css('background-image', treenode.css('background-image'));
			window.clearInterval(timer);
		}
	});
};

// Sets the folder status, upload, and new folder functions
// to the path specified. Called on initial page load and
// whenever a new directory is selected.
var setUploader = function(path) {
	setCurrentPath(path);
	$('#uploader h1').text(lg.current_folder + displayPath(path)).attr('title', displayPath(path, false));

	$('#newfolder').unbind().click(function(){
		var foldername =  lg.default_foldername;
		var msg = lg.prompt_foldername + ' : <input id="fname" name="fname" type="text" value="' + foldername + '" />';

		var getFolderName = function(e, value, message, formVals){
			if(!value) return;
			var fname = message.children('#fname').val();

			if(fname != ''){
				foldername = cleanString(fname);
				var d = new Date(); // to prevent IE cache issues
				$.getJSON(fileConnector + '?mode=addfolder&path=' + getCurrentPath() + '&config=' + userconfig + '&name=' + encodeURIComponent(foldername) + '&time=' + d.getMilliseconds(), function(result){
					if(result['Code'] == 0){
						addFolder(result['Parent'], result['Name']);
						getFolderInfo(result['Parent']);
					} else {
						$.prompt(result['Error']);
					}
				});
			} else {
				$.prompt(lg.no_foldername);
			}
		};
		var btns = {};

		btns[lg.create_folder] = true;
		btns[lg.cancel] = false;
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
	$( "#fileinfo button" ).each(function( index ) {
		// check if span doesn't exist yet, when bindToolbar called from renameItem for example
		if($(this).find('span').length == 0)
			$(this).wrapInner('<span></span>');
	});

	if (!has_capability(data, 'select')) {
		$('#fileinfo').find('button#select').hide();
	} else {
        $('#fileinfo').find('button#select').click(function () { selectItem(data); }).show();
        if(window.opener || window.tinyMCEPopup) {
	        $('#preview img').attr('title', lg.select);
	        $('#preview img').click(function () { selectItem(data); }).css("cursor", "pointer");
        }
	}

	if (!has_capability(data, 'rename')) {
		$('#fileinfo').find('button#rename').hide();
	} else {
		$('#fileinfo').find('button#rename').click(function(){
			var newName = renameItem(data);
			if(newName.length) $('#fileinfo > h1').text(newName);
		}).show();
	}

	if (!has_capability(data, 'move')) {
		$('#fileinfo').find('button#move').hide();
	} else {
		$('#fileinfo').find('button#move').click(function(){
			var newName = moveItem(data);
			if(newName.length) $('#fileinfo > h1').text(newName);
		}).show();
	}

	if (!has_capability(data, 'replace')) {
		$('#fileinfo').find('button#replace').hide();
	} else {
		$('#fileinfo').find('button#replace').click(function(){
			replaceItem(data);
		}).show();
	}

	if (!has_capability(data, 'delete')) {
		$('#fileinfo').find('button#delete').hide();
	} else {
		$('#fileinfo').find('button#delete').click(function(){
			if(deleteItem(data)) $('#fileinfo').html('<h1>' + lg.select_from_left + '</h1>');
		}).show();
	}

	if (!has_capability(data, 'download')) {
		$('#fileinfo').find('button#download').hide();
	} else {
		$('#fileinfo').find('button#download').click(function(){
			window.location = fileConnector + '?mode=download&path=' + encodeURIComponent(data['Path']) + '&config=' + userconfig;
		}).show();
	}
};

// Returns current active path
var getCurrentPath = function() {
	return $('#currentpath').val();
};

// Set current active path
var setCurrentPath = function(path) {
	$('#currentpath').val(path);
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

// Apply actions after manipulating with filetree or its single node
var adjustFileTree = function() {
	// apply context menu
	$('#filetree').contextMenu({
		selector: 'li a',
		appendTo: '.fm-container',
		items: getContextMenuItems(),
		callback: function(itemKey, opt) {
			var path = opt.$trigger.attr('data-path');
			setMenus(itemKey, path);
		}
	});

	// search function
	if (config.options.searchBox == true) {
		$('#q').liveUpdate('#filetree ul').blur();
		$('#search span.q-inactive').html(lg.search);
		$('#search a.q-reset').attr('title', lg.search_reset);
	}
};

// Create FileTree and bind events
var createFileTree = function() {
	var $treeNode = getSectionContainer($('#filetree')),
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
		options.expandSpeed = state ? 500 : 0;
	};

	var expandFolderDefault = function($el, data) {
		if (fullexpandedFolder !== null) {
			var flag = false;
			$el.find(".directory.collapsed").each(function (i, folder) {
				var $link = $(folder).children();
				if (fullexpandedFolder.indexOf($link.attr('rel')) === 0) {
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
			var $el = $(e.target);
			expandFolderDefault($el, data);
			adjustFileTree();
		})
		.on('filetreeexpanded', function (e, data) {
			var $el = $(e.target);
			expandFolderDefault($el, data);

			// prevent opening folder and loader when clicking locked folder
			if($el.parent().hasClass('directory-locked')) {
				$el.parent().removeClass('expanded').removeClass('wait');
			}
			getFolderInfo(data.rel);

			// clean autoexpand folder and restore animation
			if (fullexpandedFolder == data.rel) {
				fullexpandedFolder = null;
				handleAnimation(data.options, true);
			}
			adjustFileTree();
		})
		// Creates file tree.
		.fileTree({
			root: fileRoot,
			script: buildFileTreeNode,
			multiFolder: false
		}, function(file){
			getFileInfo(file);
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
	if(config.options.baseUrl !== false ) {
		var url = smartPath(baseUrl, data['Path'].replace(fileRoot,""));
	} else {
		var url = data['Path'];
	}

	if(window.opener || window.tinyMCEPopup || $.urlParam('field_name') || $.urlParam('CKEditorCleanUpFuncNum') || $.urlParam('CKEditor') || $.urlParam('ImperaviElementId')) {
	 	if(window.tinyMCEPopup){
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
	 	if($.urlParam('field_name')){
	 		parent.document.getElementById($.urlParam('field_name')).value = url;

	 		if(typeof parent.tinyMCE !== "undefined") {
		 		parent.tinyMCE.activeEditor.windowManager.close();
		 	}
		 	if(typeof parent.$.fn.colorbox !== "undefined") {
		 		parent.$.fn.colorbox.close();
		 	}
	 	}

		else if($.urlParam('ImperaviElementId')){
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
		else if($.urlParam('CKEditor')){
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
			if(data['Properties']['Width'] != ''){
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
		$.prompt(lg.fck_select_integration);
	}
};

// Renames the current item and returns the new name.
// Called by clicking the "Rename" button in detail views
// or choosing the "Rename" contextual menu option in
// list views.
var renameItem = function(data) {
	var finalName = '';
	var fileName = config.security.allowChangeExtensions ? data['Filename'] : getFilename(data['Filename']);
	var msg = lg.new_filename + ' : <input id="rname" name="rname" type="text" value="' + fileName + '" />';

	var getNewName = function(e, value, message, formVals){
		if(!value) return;
		var rname = message.children('#rname').val();

		if(rname != ''){

			var givenName = rname;

 			if (! config.security.allowChangeExtensions) {
				givenName = nameFormat(rname);
				var suffix = getExtension(data['Filename']);
				if(suffix.length > 0) {
					givenName = givenName + '.' + suffix;
				}
 			}

 			// File only - Check if file extension is allowed
			if (isFile(data['Path']) && !isAuthorizedFile(givenName)) {
				var str = '<p>' + lg.INVALID_FILE_TYPE + '</p>';
				if(config.security.uploadPolicy == 'DISALLOW_ALL') {
					str += '<p>' + lg.ALLOWED_FILE_TYPE +  config.security.uploadRestrictions.join(', ') + '.</p>';
				}
				if(config.security.uploadPolicy == 'ALLOW_ALL') {
					str += '<p>' + lg.DISALLOWED_FILE_TYPE +  config.security.uploadRestrictions.join(', ') + '.</p>';
				}
				$("#filepath").val('');
				$.prompt(str);
				return false;
			}

			var connectString = fileConnector + '?mode=rename&old=' + encodeURIComponent(data['Path']) + '&new=' + encodeURIComponent(givenName) + '&config=' + userconfig;

			$.ajax({
				type: 'GET',
				url: connectString,
				dataType: 'json',
				async: false,
				success: function(result){
					if(result['Code'] == 0){
						var newPath = result['New Path'];
						var newName = result['New Name'];
						var oldPath = result['Old Path'];
						var $preview = $('#preview');
						var isExtChanged = isFile(newPath) && getExtension(newPath) !== getExtension(oldPath);

						updateNode(oldPath, newPath, newName);

						// file preview
						if($preview.length > 0) {
							// reload detail view if extension was changed (new icon, preview etc.)
							if(isExtChanged) {
								getDetailView(newPath);
							} else {
								$('h1', $preview).text(newName).attr("title", newPath);

								// actualized data for binding
								data['Path']=newPath;
								data['Filename']=newName;

								// Bind toolbar functions.
								$preview.find('button#rename, button#delete, button#download').unbind();
								bindToolbar(data);
							}
						// grid/list view
						} else {
							if(isExtChanged) {
								getFolderInfo(getDirname(newPath));
							} else {
								if($('#fileinfo').data('view') == 'grid'){
									$('#fileinfo img[data-path="' + oldPath + '"]').parent().next('p').text(newName);
									$('#fileinfo img[data-path="' + oldPath + '"]').attr('data-path', newPath);
								} else {
									$('#fileinfo td[data-path="' + oldPath + '"]').text(newName);
									$('#fileinfo td[data-path="' + oldPath + '"]').attr('data-path', newPath);
								}
							}
						}

						if(config.options.showConfirmation) $.prompt(lg.successful_rename);
					} else {
						$.prompt(result['Error']);
					}

					finalName = result['New Name'];
				}
			});
		}
	};
	var btns = {};
	btns[lg.rename] = true;
	btns[lg.cancel] = false;
	$.prompt(msg, {
		submit: getNewName,
		buttons: btns
	});

	return finalName;
};

// Replace the current file and keep the same name.
// Called by clicking the "Replace" button in detail views
// or choosing the "Replace" contextual menu option in list views.
var replaceItem = function(data) {
    // auto-submit form when user filled it up
    $('#fileR').bind('change', function () {
        $(this).closest("form#toolbar").submit();
    });

    // set the connector to send data to
    $('#toolbar').attr('action', fileConnector);
    $('#toolbar').attr('method', 'post');

    // submission script
    $('#toolbar').ajaxForm({
        target: '#uploadresponse',
        beforeSubmit: function (arr, form, options) {

            var newFile = $('#fileR', form).val();

            // Test if a value is given
            if (newFile == '') {
                return false;
            }

            // Check if file extension is matching with the original
            if (getExtension(newFile) != data["File Type"]) {
                $.prompt(lg.ERROR_REPLACING_FILE + " ." + getExtension(data["Filename"]));
                return false;
            }
            $('#replace').attr('disabled', true);
            $('#upload span').addClass('loading').text(lg.loading_data);

            // if config.upload.fileSizeLimit == auto we delegate size test to connector
            if (typeof FileReader !== "undefined" && typeof config.upload.fileSizeLimit != "auto") {
                // Check file size using html5 FileReader API
                var size = $('#fileR', form).get(0).files[0].size;
                if (size > config.upload.fileSizeLimit * 1024 * 1024) {
                    $.prompt("<p>" + lg.file_too_big + "</p><p>" + lg.file_size_limit + config.upload.fileSizeLimit + " " + lg.mb + ".</p>");
                    $('#upload').removeAttr('disabled').find("span").removeClass('loading').text(lg.upload);
                    return false;
                }
            }
        },
        error: function (jqXHR, textStatus, errorThrown) {
            $('#upload').removeAttr('disabled').find("span").removeClass('loading').text(lg.upload);
            $.prompt(lg.ERROR_UPLOADING_FILE);
        },
        success: function (result) {
            var data = jQuery.parseJSON($('#uploadresponse').find('textarea').text());

            if (data['Code'] == 0) {
                var fullpath = data["Path"] + '/' + data["Name"];

                // Reloading file info
                getFileInfo(fullpath);
                // Visual effects for user to see action is successful
                $('#preview').find('img').hide().fadeIn('slow'); // on right panel
                $('ul.jqueryFileTree').find('li a[data-path="' + fullpath + '"]').parent().hide().fadeIn('slow'); // on fileTree

                if (config.options.showConfirmation) $.prompt(lg.successful_replace);

            } else {
                $.prompt(data['Error']);
            }
            $('#replace').removeAttr('disabled');
            $('#upload span').removeClass('loading').text(lg.upload);
        }
    });

    // pass data path value - original file
    $('#newfilepath').val(data["Path"]);

    // open the input file dialog window
    $('#fileR').click();
};

// Move the current item to specified dir and returns the new name.
// Called by clicking the "Move" button in detail views
// or choosing the "Move" contextual menu option in list views.
var moveItem = function(data) {
	var finalName = '';
	var msg  = lg.move + ' : <input id="rname" name="rname" type="text" value="" />';
		msg += '<div class="prompt-info">' + lg.help_move + '</div>';

	var doMove = function(e, value, message, formVals){
		if(!value) return;
		var rname = message.children('#rname').val();

		if(rname != ''){
			var givenName = rname;
			var oldPath = data['Path'];
			var connectString = fileConnector + '?mode=move&old=' + encodeURIComponent(oldPath) + '&new=' + encodeURIComponent(givenName) + '&root=' + encodeURIComponent(fileRoot) + '&config=' + userconfig;

			$.ajax({
				type: 'GET',
				url: connectString,
				dataType: 'json',
				async: false,
				success: function(result){
                    if(result['Code'] == 0){
                        var newPath = result['New Path'];
                        var newName = result['New Name'];

						moveNode(newPath, oldPath);

						if(config.options.showConfirmation) $.prompt(lg.successful_moved);
					} else {
						$.prompt(result['Error']);
					}

					finalName = newPath + newName;
				}
			});
		}
	};
	var btns = {};
	btns[lg.move] = true;
	btns[lg.cancel] = false;
	$.prompt(msg, {
		submit: doMove,
		buttons: btns
	});

	return finalName;
};

// Prompts for confirmation, then deletes the current item.
// Called by clicking the "Delete" button in detail views
// or choosing the "Delete contextual menu item in list views.
var deleteItem = function(data) {
	var isDeleted = false;
	var msg = lg.confirmation_delete;

	var doDelete = function(e, value, message, formVals){
		if(!value) return;
		var d = new Date(), // to prevent IE cache issues
			connectString = fileConnector + '?mode=delete&path=' + encodeURIComponent(data['Path'])  + '&time=' + d.getMilliseconds() + '&config=' + userconfig;

		$.ajax({
			type: 'GET',
			url: connectString,
			dataType: 'json',
			async: false,
			success: function(result) {
				if(result['Code'] == 0) {
                    var path = result['Path'],
					    cpath = getClosestNode(path);

                    removeNode(path);
                    setCurrentPath(cpath);
					$('#uploader h1').text(lg.current_folder + displayPath(cpath)).attr("title", displayPath(cpath, false));
					isDeleted = true;

					if(config.options.showConfirmation) $.prompt(lg.successful_delete);
				} else {
					isDeleted = false;
					$.prompt(result['Error']);
				}
			}
		});
	};
	var btns = {};
	btns[lg.yes] = true;
	btns[lg.no] = false;
	$.prompt(msg, {
		submit: doDelete,
		buttons: btns
	});

	return isDeleted;
};

// Display an 'edit' link for editable files
// Then let user change the content of the file
// Save action is handled by the method using ajax
var editItem = function(data) {

	isEdited = false;

	$('#fileinfo').find('div#tools').append(' <a id="edit-file" href="#" title="' + lg.edit + '"><span>' + lg.edit + '</span></a>');

	$('#edit-file').click(function () {

		$(this).hide(); // hiding Edit link

		var d = new Date(); // to prevent IE cache issues
		var connectString = fileConnector + '?mode=editfile&path=' + encodeURIComponent(data['Path']) + '&config=' + userconfig + '&time=' + d.getMilliseconds();

		$.ajax({
			type: 'GET',
			url: connectString,
			dataType: 'json',
			async: false,
			success: function (result) {
				if (result['Code'] == 0) {

					var content = '<form id="edit-form">';
					content += '<textarea id="edit-content" name="content">' + result['Content'] + '</textarea>';
					content += '<input type="hidden" name="mode" value="savefile" />';
					content += '<input type="hidden" name="path" value="' + data['Path'] + '" />';
					content += '<button id="edit-cancel" class="edition" type="button">' + lg.quit_editor + '</button>';
					content += '<button id="edit-save" class="edition" type="button">' + lg.save + '</button>';
					content += '</form>';

					$('#preview').find('img').hide();
					$('#preview').prepend(content).hide().fadeIn();

					// Cancel Button Behavior
					$('#edit-cancel').click(function () {
						$('#preview').find('form#edit-form').hide();
						$('#preview').find('img').fadeIn();
						$('#edit-file').show();
					});

					// Save Button Behavior
					$('#edit-save').click(function () {

						// get new textarea content
						var newcontent = codeMirrorEditor.getValue();
						$("textarea#edit-content").val(newcontent);

						var postData = $('#edit-form').serializeArray();

						$.ajax({
							type: 'POST',
							url: fileConnector + '?config=' + userconfig,
							dataType: 'json',
							data: postData,
							async: false,
							success: function (result) {
								if (result['Code'] == 0) {
									isEdited = true;
									// if (config.options.showConfirmation) $.prompt(lg.successful_edit);
									$.prompt(lg.successful_edit);
								} else {
									isEdited = false;
									$.prompt(result['Error']);
								}
							}
						});

					});

					// instantiate codeMirror according to config options
					codeMirrorEditor = instantiateCodeMirror(getExtension(data['Path']), config);

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

// Removes file or folder DOM element
var removeDomItem = function(path, speed) {
	// from filetree
    $('#filetree')
        .find('a[data-path="' + path + '"]')
        .parent()
        .fadeOut(speed, function() {
            $(this).remove();
        });

    // from main window - grid view
    if ($('#fileinfo').data('view') == 'grid') {
        $('#contents img[data-path="' + path + '"]').parent().parent()
            .fadeOut(speed, function() {
                $(this).remove();
            });
    // from main window - list view
    } else {
        $('table#contents')
            .find('td[data-path="' + path + '"]')
            .parent()
            .fadeOut(speed, function () {
                $(this).remove();
            });
    }
};

/*---------------------------------------------------------
  Functions to Update the File Tree
---------------------------------------------------------*/

// Adds a new node.
// Called after a successful file upload.
var addNode = function(path, name) {
	var parentNode,
		newNode = $(buildFileTreeNode({dir: path, visible: true}));

	if(path != fileRoot){
		parentNode = $('#filetree').find('a[data-path="' + path + '"]').next('ul');
	} else {
		parentNode = $('#filetree ul.jqueryFileTree');
	}
	parentNode.replaceWith(newNode);
	adjustFileTree();

	if(config.options.showConfirmation) $.prompt(lg.successful_added_file);
};

// Updates the specified node with a new name.
// Called after a successful rename operation.
var updateNode = function(oldPath, newPath, newName){
	var thisNode = $('#filetree').find('a[data-path="' + oldPath + '"]'),
		parentNode = thisNode.parent().parent();

	// reload node if extension was changed (new icon, etc.)
	if(isFile(newPath) && getExtension(newPath) !== getExtension(oldPath)) {
		var newNode = $(buildFileTreeNode({dir: getDirname(newPath), visible: true}));
		parentNode.replaceWith(newNode);
	} else {
		thisNode.attr('data-path', newPath).attr('rel', newPath).text(newName);
	}
	adjustFileTree();
};

// Moves the specified node.
// Called after a successful move operation.
var moveNode = function(newPath, oldFullPath, forceExpand) {
	forceExpand = forceExpand || false; // TODO: supposed to force for MANUAL remove and disable for DRAG & DROP
    removeDomItem(oldFullPath, 0);

	// displays parent folder if the actual view is moved
	if(oldFullPath == getCurrentPath() && !forceExpand) {
		getFolderInfo(getParentDirname(oldFullPath));
	}

    if(!forceExpand) return; // prevent of expanding new path
	var $nodeLink = $('#filetree').find('a[data-path="' + newPath + '"]');

    // update filetree
	if(newPath != fileRoot && $nodeLink.is(':visible')) {
		// reloads descendants of node if the node is opened
		if($nodeLink.parent().hasClass('expanded')) {
			var $newNode = $(buildFileTreeNode({dir: newPath}));
			$nodeLink.next('ul').replaceWith($newNode).show();
			adjustFileTree();
		// trigger click event to expand folder
		} else {
			$nodeLink.click();
		}
	} else {
		// set fullexpandedFolder value to automatically open file in
		// filetree when calling createFileTree() function
		fullexpandedFolder = newPath;
		createFileTree();
	}
	// update list in main window
	getFolderInfo(newPath);
};

// Removes the specified node.
// Called after a successful delete operation.
var removeNode = function(path) {
    removeDomItem(path, 600);

    // displays parent folder if the deleted folder is the actual view
    if(path == getCurrentPath()) {
    	getFolderInfo(getParentDirname(path));
    }
    // remove fileinfo when item to remove is currently selected
    if ($('#preview').length) {
    	getFolderInfo(path.substr(0, path.lastIndexOf('/') + 1));
	}
};

// Adds a new folder.
// Called after a new folder is successfully created.
var addFolder = function(parent, name) {
	var parentNode,
		newNode = $(buildFileTreeNode({dir: parent, visible: true}));

	if(parent != fileRoot){
		parentNode = $('#filetree').find('a[data-path="' + parent + '"]').next('ul');
	} else {
		parentNode = $('#filetree ul.jqueryFileTree');
	}
	parentNode.replaceWith(newNode);
	adjustFileTree();

	if(config.options.showConfirmation) $.prompt(lg.successful_added_folder);
};




/*---------------------------------------------------------
  Functions to Retrieve File and Folder Details
---------------------------------------------------------*/

// Decides whether to retrieve file or folder info based on the path provided.
var getDetailView = function(path) {
	if(path.lastIndexOf('/') == path.length - 1){
		getFolderInfo(path);
		$('#filetree').find('a[data-path="' + path + '"]').click();
	} else {
		getFileInfo(path);
	}
};

// Options for context menu plugin
function getContextMenuItems() {
	var contextMenuItems = {
		select: {name: lg.select, className: 'select'},
		download: {name: lg.download, className: 'download'},
		rename: {name: lg.rename, className: 'rename'},
		move: {name: lg.move, className: 'move'},
		replace: {name: lg.replace, className: 'replace'},
		separator1: "-----",
		delete: {name: lg.del, className: 'delete'}
	};

	if($.inArray('download', capabilities) === -1) delete contextMenuItems.download;
	if($.inArray('rename', capabilities) === -1 || config.options.browseOnly === true) delete contextMenuItems.rename;
	if($.inArray('move', capabilities) === -1 || config.options.browseOnly === true) delete contextMenuItems.move;
	if($.inArray('delete', capabilities) === -1 || config.options.browseOnly === true) delete contextMenuItems.delete;
	// remove 'select' if there is no window.opener
	if($.inArray('select', capabilities)  === -1 || !(window.opener || window.tinyMCEPopup || $.urlParam('field_name'))) delete contextMenuItems.select;
	// remove 'replace' since it is implemented on #preview panel only (for FF and Chrome, need to check in Opera)
	delete contextMenuItems.replace;

	return contextMenuItems
}

// Binds contextual menus to items in list and grid views.
var setMenus = function(action, path) {
	var d = new Date(); // to prevent IE cache issues
	$.getJSON(fileConnector + '?mode=getinfo&path=' + encodeURIComponent(path) + '&config=' + userconfig + '&time=' + d.getMilliseconds(), function(data){
		// TODO: remove
		//if($('#fileinfo').data('view') == 'grid'){
		//	var item = $('#fileinfo').find('img[data-path="' + data['Path'] + '"]').parent();
		//} else {
		//	var item = $('#fileinfo').find('td[data-path="' + data['Path'] + '"]').parent();
		//}

		switch(action){
			case 'select':
				selectItem(data);
				break;

			case 'download': // TODO: implement javascript method to test if exstension is correct
				window.location = fileConnector + '?mode=download&path=' + data['Path']  + '&config=' + userconfig + '&time=' + d.getMilliseconds();
				break;

			case 'rename':
				var newName = renameItem(data);
				break;

			case 'replace':
				replaceItem(data);
				break;

			case 'move':
				var newName = moveItem(data);
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

	var $fileinfo = $('#fileinfo'),
		currentpath = file.substr(0, file.lastIndexOf('/') + 1);

	// update location for status, upload, & new folder functions
	setUploader(currentpath);

	// include the template
	var template = '<div id="preview"><img /><div id="main-title"><h1></h1><div id="tools"></div></div><dl></dl></div>';
	template += '<form id="toolbar">';
	template += '<button id="parentfolder" type="button" value="ParentFolder">' + lg.parentfolder + '</button>';
	if($.inArray('select', capabilities) != -1 && ($.urlParam('CKEditor') || window.opener || window.tinyMCEPopup || $.urlParam('field_name') || $.urlParam('ImperaviElementId'))) template += '<button id="select" name="select" type="button" value="Select">' + lg.select + '</button>';
	if($.inArray('download', capabilities) != -1) template += '<button id="download" name="download" type="button" value="Download">' + lg.download + '</button>';
	if($.inArray('rename', capabilities) != -1 && config.options.browseOnly != true) template += '<button id="rename" name="rename" type="button" value="Rename">' + lg.rename + '</button>';
	if($.inArray('move', capabilities) != -1 && config.options.browseOnly != true) template += '<button id="move" name="move" type="button" value="Move">' + lg.move + '</button>';
	if($.inArray('delete', capabilities) != -1 && config.options.browseOnly != true) template += '<button id="delete" name="delete" type="button" value="Delete">' + lg.del + '</button>';
	if($.inArray('replace', capabilities) != -1 && config.options.browseOnly != true) {
		template += '<button id="replace" name="replace" type="button" value="Replace">' + lg.replace + '</button>';
		template += '<div class="hidden-file-input"><input id="fileR" name="fileR" type="file" /></div>';
		template += '<input id="mode" name="mode" type="hidden" value="replace" /> ';
		template += '<input id="newfilepath" name="newfilepath" type="hidden" />';
	}
	template += '</form>';

	// add the new markup to the DOM
	getSectionContainer($fileinfo).html(template);

	$('#parentfolder').click(function(e) {
		getFolderInfo(currentpath);
	});

	// Retrieve the data & populate the template.
	var d = new Date(); // to prevent IE cache issues
	$.getJSON(fileConnector + '?mode=getinfo&path=' + encodeURIComponent(file)  + '&config=' + userconfig + '&time=' + d.getMilliseconds(), function(data){
		if(data['Code'] == 0){
			$fileinfo.find('h1').text(data['Filename']).attr('title', file);

			$fileinfo.find('img').attr('src',data['Preview']);
			if(isVideoFile(data['Filename']) && config.videos.showVideoPlayer == true) {
				getVideoPlayer(data);
			}
			if(isAudioFile(data['Filename']) && config.audios.showAudioPlayer == true) {
				getAudioPlayer(data);
			}
			//Pdf
			if(isPdfFile(data['Filename']) && config.pdfs.showPdfReader == true) {
				getPdfReader(data);
			}
			if(isEditableFile(data['Filename']) && config.edit.enabled == true && data['Protected']==0) {
				editItem(data);
			}

			// copy URL instructions - zeroclipboard
			var d = new Date(); // to prevent IE cache issues

			if(config.options.baseUrl !== false ) {
				var url = smartPath(baseUrl, data['Path'].replace(fileRoot,""));
			} else {
				var url = data['Path'];
			}
			if(data['Protected']==0) {
				$fileinfo.find('div#tools').append(' <a id="copy-button" data-clipboard-text="'+ url + '" title="' + lg.copy_to_clipboard + '" href="#"><span>' + lg.copy_to_clipboard + '</span></a>');

				// zeroClipboard code
				ZeroClipboard.config({swfPath: config.globals.pluginPath + '/scripts/zeroclipboard/dist/ZeroClipboard.swf'});
				var client = new ZeroClipboard(document.getElementById("copy-button"));
				client.on( "ready", function(readyEvent) {
					client.on( "aftercopy", function(event) {
						// console.log("Copied text to clipboard: " + event.data["text/plain"]);
					});
				});

				$('#copy-button').click(function () {
					$fileinfo.find('div#tools').append('<span id="copied">' + lg.copied + '</span>');
					$('#copied').delay(500).fadeOut(1000, function() { $(this).remove(); });
				});
			}

			var properties = '';

			if(data['Properties']['Width'] && data['Properties']['Width'] != '') properties += '<dt>' + lg.dimensions + '</dt><dd>' + data['Properties']['Width'] + 'x' + data['Properties']['Height'] + '</dd>';
			if(data['Properties']['Date Created'] && data['Properties']['Date Created'] != '') properties += '<dt>' + lg.created + '</dt><dd>' + data['Properties']['Date Created'] + '</dd>';
			if(data['Properties']['Date Modified'] && data['Properties']['Date Modified'] != '') properties += '<dt>' + lg.modified + '</dt><dd>' + data['Properties']['Date Modified'] + '</dd>';
			if(data['Properties']['Size'] || parseInt(data['Properties']['Size'])==0) properties += '<dt>' + lg.size + '</dt><dd>' + formatBytes(data['Properties']['Size']) + '</dd>';
			$fileinfo.find('dl').html(properties);

			// Bind toolbar functions.
			bindToolbar(data);

		} else {
			$.prompt(data['Error']);
		}
	});
};

// Retrieves data for all items within the given folder and
// creates a list view. Binds contextual menu options.
// TODO: consider stylesheet switching to switch between grid
// and list views with sorting options.
var getFolderInfo = function(path) {
	// update location for status, upload, & new folder functions
	setUploader(path);

	var $fileinfo = $('#fileinfo'),
		loading = '<img id="activity" src="' + config.globals.pluginPath + '/themes/' + config.options.theme + '/images/wait30trans.gif" width="30" height="30" />';

	// display an activity indicator
	getSectionContainer($fileinfo).html(loading);

	$('#loading-wrap').fadeOut(800); // remove loading screen div

	var result = '',
		data = getFolderData(path);

	// Is there any error or user is unauthorized?
	if(data.Code=='-1') {
		handleError(data.Error);
		return;
	}

	setDimensions(); //fix dimensions before all images load

	if(data){
		var counter = 0;
		var totalSize = 0;
		if($fileinfo.data('view') == 'grid'){
			result += '<ul id="contents" class="grid">';

			for(key in data){
				counter++;
				var props = data[key]['Properties'];
				var cap_classes = "";
				for (cap in capabilities) {
					if (has_capability(data[key], capabilities[cap])) {
						cap_classes += " cap_" + capabilities[cap];
					}
				}

				var scaledWidth = 64;
				var actualWidth = props['Width'];
				if(actualWidth > 1 && actualWidth < scaledWidth) scaledWidth = actualWidth;

				config.options.showTitleAttr ? title = ' title="' + data[key]['Path'] + '"' : title = '';

				result += '<li class="' + cap_classes + '"' + title + '"><div class="clip"><img src="' + data[key]['Preview'] + '" width="' + scaledWidth + '" alt="' + data[key]['Path'] + '" data-path="' + data[key]['Path'] + '" /></div><p>' + data[key]['Filename'] + '</p>';
				if(props['Width'] && props['Width'] != '') result += '<span class="meta dimensions">' + props['Width'] + 'x' + props['Height'] + '</span>';
				if(props['Size'] && props['Size'] != '') result += '<span class="meta size">' + props['Size'] + '</span>';
				if(props['Size'] && props['Size'] != '') totalSize += props['Size'];
				if(props['Date Created'] && props['Date Created'] != '') result += '<span class="meta created">' + props['Date Created'] + '</span>';
				if(props['Date Modified'] && props['Date Modified'] != '') result += '<span class="meta modified">' + props['Date Modified'] + '</span>';
				result += '</li>';
			}

			result += '</ul>';
		} else {
			result += '<table id="contents" class="list">';
			result += '<thead><tr><th class="headerSortDown"><span>' + lg.name + '</span></th><th><span>' + lg.dimensions + '</span></th><th><span>' + lg.size + '</span></th><th><span>' + lg.modified + '</span></th></tr></thead>';
			result += '<tbody>';

			for(key in data){
				counter++;
				var path = data[key]['Path'];
				var props = data[key]['Properties'];
				var cap_classes = "";
				config.options.showTitleAttr ? title = ' title="' + data[key]['Path'] + '"' : title = '';

				for (cap in capabilities) {
					if (has_capability(data[key], capabilities[cap])) {
						cap_classes += " cap_" + capabilities[cap];
					}
				}
				result += '<tr class="' + cap_classes + '">';
				result += '<td data-path="' + data[key]['Path'] + '"' + title + '">' + data[key]['Filename'] + '</td>';

				if(props['Width'] && props['Width'] != ''){
					result += ('<td>' + props['Width'] + 'x' + props['Height'] + '</td>');
				} else {
					result += '<td></td>';
				}

				if(props['Size'] && props['Size'] != ''){
					result += '<td><abbr title="' + props['Size'] + '">' + formatBytes(props['Size']) + '</abbr></td>';
					totalSize += props['Size'];
				} else {
					result += '<td></td>';
				}

				if(props['Date Modified'] && props['Date Modified'] != ''){
					result += '<td>' + props['Date Modified'] + '</td>';
				} else {
					result += '<td></td>';
				}

				result += '</tr>';
			}

			result += '</tbody>';
			result += '</table>';
		}
	} else {
		result += '<h1>' + lg.could_not_retrieve_folder + '</h1>';
	}

	// add the new markup to the DOM
	getSectionContainer($fileinfo).html(result);

	// update #folder-info
	$('#items-counter').text(counter);
	$('#items-size').text(Math.round(totalSize / 1024 /1024 * 100) / 100);

	// add context menu and bind click events to create detail views
	if($fileinfo.data('view') == 'grid') {
		$fileinfo.find('#contents').contextMenu({
			selector: 'li',
			appendTo: '.fm-container',
			items: getContextMenuItems(),
			callback: function(itemKey, opt) {
				var path = opt.$trigger.find('img').attr('data-path');
				setMenus(itemKey, path);
			}
		}).find('li').click(function(){
			var path = $(this).find('img').attr('data-path');
			getDetailView(path);
		});
	} else {
		$fileinfo.find('tbody').contextMenu({
			selector: 'tr',
			appendTo: '.fm-container',
			items: getContextMenuItems(),
			callback: function(itemKey, opt) {
				var path = $('td:first-child', opt.$trigger).attr('data-path');
				setMenus(itemKey, path);
			}
		}).find('tr').click(function(){
			var path = $('td:first-child', this).attr('data-path');
			getDetailView(path);
		});

		$fileinfo.find('table').tablesorter({
			textExtraction: function(node){
				if($(node).find('abbr').size()){
					return $(node).find('abbr').attr('title');
				} else {
					return node.innerHTML;
				}
			}
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
		var d = new Date(); // to prevent IE cache issues
		var url = fileConnector + '?path=' + encodeURIComponent(path) + '&config=' + userconfig + '&mode=getfolder&showThumbs=' + config.options.showThumbs + '&time=' + d.getMilliseconds();
		if ($.urlParam('type')) url += '&type=' + $.urlParam('type');

		$.ajax({
			'async': false,
			'url': url,
			'dataType': "json",
			cache: false,
			'success': function(data) {
				loadedFolderData[path] = {
					cached: Date.now(),
					data: data
				};
			}
		});
	}
	return loadedFolderData[path].data;
};


// Retrieve data (file/folder listing) and build html for jqueryFileTree
var buildFileTreeNode = function(options) {
	var result = '',
		visible = options.visible || false,
		data = getFolderData(options.dir);

	// Is there any error or user is unauthorized?
	if(data.Code=='-1') {
		handleError(data.Error);
		return;
	}

	if(data) {
		var display = visible ? "block" : "none";
		result += "<ul class=\"jqueryFileTree\" style=\"display: "+display+";\">";
		for(key in data) {
			var cap_classes = "";

			for (cap in capabilities) {
				if (has_capability(data[key], capabilities[cap])) {
					cap_classes += " cap_" + capabilities[cap];
				}
			}
			if (data[key]['File Type'] == 'dir') {
				var extraclass = data[key]['Protected'] == 0 ? '' : ' directory-locked';
				result += "<li class=\"directory collapsed" + extraclass + "\"><a href=\"#\" class=\"" + cap_classes + "\" rel=\"" + data[key]['Path'] + "\" data-path=\"" + data[key]['Path'] + "\">" + data[key]['Filename'] + "</a></li>";
			} else {
				if(config.options.listFiles) {
					var extraclass = data[key]['Protected'] == 0 ? '' : ' file-locked';
					result += "<li class=\"file ext_" + data[key]['File Type'].toLowerCase() + extraclass + "\"><a href=\"#\" class=\"" + cap_classes + "\" rel=\"" + data[key]['Path'] + "\" data-path=\"" + data[key]['Path'] + "\">" + data[key]['Filename'] + "</a></li>";
				}
			}
		}
		result += "</ul>";
	} else {
		result += '<h1>' + lg.could_not_retrieve_folder + '</h1>';
	}

	return result;
};




/*---------------------------------------------------------
  Initialization
---------------------------------------------------------*/

$(function(){

	if(config.extras.extra_js) {
		for(var i=0; i< config.extras.extra_js.length; i++) {
			$.ajax({
				url: config.extras.extra_js[i],
				dataType: "script",
				async: config.extras.extra_js_async
			});
		}
	}

	$('#link-to-project').attr('href', config.url).attr('target', '_blank').attr('title', lg.support_fm + ' [' + lg.version + ' : ' + config.version + ']');
	$('div.version').html(config.version);

	// Loading theme
	loadCSS(config.globals.pluginPath + '/themes/' + config.options.theme + '/styles/filemanager.css');
	$.ajax({
	    url: config.globals.pluginPath + '/themes/' + config.options.theme + '/styles/ie.css',
	    async: false,
	    success: function(data)
	    {
	        $('head').append(data);
	    }
	});

	// loading zeroClipboard
	loadJS(config.globals.pluginPath + '/scripts/zeroclipboard/dist/ZeroClipboard.js');

	// Loading CodeMirror if enabled for online edition
	if(config.edit.enabled) {
		loadCSS(config.globals.pluginPath + '/scripts/CodeMirror/lib/codemirror.css');
		loadCSS(config.globals.pluginPath + '/scripts/CodeMirror/theme/' + config.edit.theme + '.css');
		loadJS(config.globals.pluginPath + '/scripts/CodeMirror/lib/codemirror.js');
		loadJS(config.globals.pluginPath + '/scripts/CodeMirror/addon/selection/active-line.js');
		loadCSS(config.globals.pluginPath + '/scripts/CodeMirror/addon/display/fullscreen.css');
		loadJS(config.globals.pluginPath + '/scripts/CodeMirror/addon/display/fullscreen.js');
		loadJS(config.globals.pluginPath + '/scripts/CodeMirror/dynamic-mode.js');
	}

	if(!config.options.fileRoot) {
		fileRoot = '/' + document.location.pathname.substring(1, document.location.pathname.lastIndexOf('/') + 1) + 'userfiles/';
	} else {
		if(!config.options.serverRoot) {
			fileRoot = config.options.fileRoot;
		} else {
			fileRoot = '/' + config.options.fileRoot;
		}
		// remove double slashes - can happen when using PHP SetFileRoot() function with fileRoot = '/' value
		fileRoot = fileRoot.replace(/\/\//g, '\/');
	}

	if(config.options.baseUrl === false) {
		baseUrl = window.location.protocol + "//" + window.location.host;
	} else {
		baseUrl = config.options.baseUrl;
	}

	if($.urlParam('exclusiveFolder') != 0) {
		fileRoot += $.urlParam('exclusiveFolder');
		if(isFile(fileRoot)) fileRoot += '/'; // add last '/' if needed
		fileRoot = fileRoot.replace(/\/\//g, '\/');
	}

	if($.urlParam('expandedFolder') != 0) {
		expandedFolder = $.urlParam('expandedFolder');
		fullexpandedFolder = fileRoot + expandedFolder;
	} else {
		expandedFolder = '';
		fullexpandedFolder = null;
	}


	$('#folder-info').html('<span id="items-counter"></span> ' + lg.items + ' - ' + lg.size + ' : <span id="items-size"></span> ' + lg.mb);

	// finalize the FileManager UI initialization
	// with localized text if necessary
	if(config.options.autoload == true) {
		$('#upload').append(lg.upload);
		$('#newfolder').append(lg.new_folder);
		$('#grid').attr('title', lg.grid_view);
		$('#list').attr('title', lg.list_view);
		$('#fileinfo h1').append(lg.select_from_left);
	}

	/** Adding a close button triggering callback function if CKEditorCleanUpFuncNum passed */
	if($.urlParam('CKEditorCleanUpFuncNum')) {
		$("body").append('<button id="close-btn" type="button">' + lg.close + '</button>');

		$('#close-btn').click(function () {
			parent.CKEDITOR.tools.callFunction($.urlParam('CKEditorCleanUpFuncNum'));
		});
	}

	/** Input file Replacement */
	$('#browse').append('+');
	$('#browse').attr('title', lg.browse);
	$("#newfile").change(function() {
		$("#filepath").val($(this).val().replace(/.+[\\\/]/, ""));
	});

	/** load searchbox */
	if(config.options.searchBox === true)  {
		loadJS(config.globals.pluginPath + '/scripts/filemanager.liveSearch.min.js');
	} else {
		$('#search').remove();
	}

	// cosmetic tweak for buttons
	$('button').wrapInner('<span></span>');

	// Set initial view state.
	$('#fileinfo').data('view', config.options.defaultViewMode);
	setViewButtonsFor(config.options.defaultViewMode);

	$('#home').click(function() {
		createFileTree();
		getFolderInfo(fileRoot);
	});

	$('#level-up').click(function() {
		var cpath = getCurrentPath();
		if(cpath != fileRoot) {
            // close the previous folder
			$('#filetree').find('a[data-path="' + cpath + '"]').click();
			getFolderInfo(getClosestNode(cpath));
		}
	});

	// Set buttons to switch between grid and list views.
	$('#grid').click(function() {
		setViewButtonsFor('grid');
		$('#fileinfo').data('view', 'grid');
		getFolderInfo(getCurrentPath());
	});

	$('#list').click(function() {
		setViewButtonsFor('list');
		$('#fileinfo').data('view', 'list');
		getFolderInfo(getCurrentPath());
	});

	// Provide initial values for upload form, status, etc.
	setUploader(fileRoot);

	// Handling File upload

	// Multiple Uploads
	if(config.upload.multiple) {

		// load dropzone library
		loadCSS(config.globals.pluginPath + '/scripts/dropzone/dist/min/dropzone.min.css');
		loadJS(config.globals.pluginPath + '/scripts/dropzone/dist/min/dropzone.min.js');
		Dropzone.autoDiscover = false;

		// remove simple file upload element
		$('#file-input-container').remove();

		// add multiple-files upload button using upload button
		// $('#upload').prop('type', 'button');
		// replaced by code below because og Chrome 18 bug https://github.com/simogeo/Filemanager/issues/304
		// and it may also be safer for IE (see http://stackoverflow.com/questions/1544317/change-type-of-input-field-with-jquery
		$('#upload').remove();
		$( "#newfolder" ).before( '<button value="Upload" type="button" name="upload" id="upload" class="em"><span>' + lg.upload + '</span></button> ' );

		$('#upload').unbind().click(function() {
			// create prompt
			var msg  = '<div id="dropzone-container"><h2>' + lg.current_folder + $('#uploader h1').attr('title')  + '</h2><div id="multiple-uploads" class="dropzone"></div>';
				msg += '<div id="total-progress"><div data-dz-uploadprogress="" style="width:0%;" class="progress-bar"></div></div>';
				msg += '<div class="prompt-info">' + lg.dz_dictMaxFilesExceeded.replace('%s', config.upload.number) + lg.file_size_limit + config.upload.fileSizeLimit + ' ' + lg.mb + '.</div>';
				msg += '<button id="process-upload">' + lg.upload + '</button></div>';

			error_flag = false;
			var path = getCurrentPath();

			var fileSize = (config.upload.fileSizeLimit != 'auto') ? config.upload.fileSizeLimit : 256; // default dropzone value

			if(config.security.uploadPolicy == 'DISALLOW_ALL') {
				var allowedFiles = '.' + config.security.uploadRestrictions.join(',.');
			} else {
				// allow any extension since we have no easy way to handle the the built-in `acceptedFiles` params
				// Would be handled later by the connector
				var allowedFiles = null;
			}

			if ($.urlParam('type').toString().toLowerCase() == 'images' || config.upload.imagesOnly) {
				var allowedFiles = '.' + config.images.imagesExt.join(',.');
			}

			var btns = {};
			btns[lg.close] = false;
			$.prompt(msg, {
				buttons: btns
			});

			$("div#multiple-uploads").dropzone({
				paramName: "newfile",
				url: fileConnector + '?config=' + userconfig,
				maxFilesize: fileSize,
				maxFiles: config.upload.number,
				addRemoveLinks: true,
				parallelUploads: config.upload.number,
				dictCancelUpload: lg.cancel,
				dictRemoveFile: lg.del,
				dictMaxFilesExceeded: lg.dz_dictMaxFilesExceeded.replace("%s", config.upload.number),
				dictDefaultMessage: lg.dz_dictDefaultMessage,
				dictInvalidFileType: lg.dz_dictInvalidFileType,
				dictFileTooBig: lg.file_too_big + ' ' + lg.file_size_limit + config.upload.fileSizeLimit + ' ' + lg.mb,
				acceptedFiles: allowedFiles,
				autoProcessQueue: false,
				renameFilename: function (name) {
					return nameFormat(name);
				},
				init: function() {
					// for accessing dropzone : https://github.com/enyo/dropzone/issues/180
					var dropzone = this;
				    $("#process-upload").click(function() {
				    	// to proceed full queue parallelUploads ust be equal or > to maxFileSize
				    	// https://github.com/enyo/dropzone/issues/462
				    	dropzone.processQueue();
				    });
				},
				totaluploadprogress: function(progress) {
					$("#total-progress .progress-bar").css('width', progress + "%");
				},
				sending: function(file, xhr, formData) {
					formData.append("mode", "add");
					formData.append("currentpath", path);
				},
				success: function(file, response) {
					$('#uploadresponse').empty().html(response);
					var data = jQuery.parseJSON($('#uploadresponse').find('textarea').text());

					if (data['Code'] == 0) {
						this.removeFile(file);
					} else {
						// this.removeAllFiles();
						getFolderInfo(path);
						$('#filetree').find('a[data-path="' + path + '"]').click();
						$.prompt(data['Error']);
						error_flag = true;

					}
				},
				complete: function(file) {
					if (this.getUploadingFiles().length === 0 && this.getQueuedFiles().length === 0) {
						$("#total-progress .progress-bar").css('width', '0%');
						if(this.getRejectedFiles().length === 0 && error_flag === false) {
							setTimeout(function() { $.prompt.close();}, 800);
						}
						getFolderInfo(path);
						if(path == fileRoot) createFileTree();
						$('#filetree').find('a[data-path="' + path + '"]').click().click();
						if(config.options.showConfirmation) {
							$.prompt(lg.successful_added_file);
						}
				    }
				}
			});

		});

	// Simple Upload
	} else {

		$('#uploader').attr('action', fileConnector  + '?config=' + userconfig);

		$('#uploader').ajaxForm({
			target: '#uploadresponse',
			beforeSubmit: function (arr, form, options) {
				// Test if a value is given
				if($('#newfile', form).val()=='') {
					return false;
				}
				// Check if file extension is allowed
				if (!isAuthorizedFile($('#newfile', form).val())) {
					var str = '<p>' + lg.INVALID_FILE_TYPE + '</p>';
					if(config.security.uploadPolicy == 'DISALLOW_ALL') {
						str += '<p>' + lg.ALLOWED_FILE_TYPE +  config.security.uploadRestrictions.join(', ') + '.</p>';
					}
					if(config.security.uploadPolicy == 'ALLOW_ALL') {
						str += '<p>' + lg.DISALLOWED_FILE_TYPE +  config.security.uploadRestrictions.join(', ') + '.</p>';
					}
					$("#filepath").val('');
					$.prompt(str);
					return false;
				}
				$('#upload').attr('disabled', true);
				$('#upload span').addClass('loading').text(lg.loading_data);
				if ($.urlParam('type').toString().toLowerCase() == 'images') {
					// Test if uploaded file extension is in valid image extensions
				    var newfileSplitted = $('#newfile', form).val().toLowerCase().split('.');
				    var found = false;
					for (key in config.images.imagesExt) {
						if (config.images.imagesExt[key] == newfileSplitted[newfileSplitted.length - 1]) {
						    found = true;
						}
					}
				    if (found === false) {
				        $.prompt(lg.UPLOAD_IMAGES_ONLY);
				        $('#upload').removeAttr('disabled').find("span").removeClass('loading').text(lg.upload);
				        return false;
				    }
				}
				// if config.upload.fileSizeLimit == auto we delegate size test to connector
				if (typeof FileReader !== "undefined" && typeof config.upload.fileSizeLimit != "auto") {
					// Check file size using html5 FileReader API
					var size = $('#newfile', form).get(0).files[0].size;
					if (size > config.upload.fileSizeLimit * 1024 * 1024) {
						$.prompt("<p>" + lg.file_too_big + "</p><p>" + lg.file_size_limit + config.upload.fileSizeLimit + " " + lg.mb + ".</p>");
						$('#upload').removeAttr('disabled').find("span").removeClass('loading').text(lg.upload);
						return false;
					}
				}
			},
			error: function (jqXHR, textStatus, errorThrown) {
				$('#upload').removeAttr('disabled').find("span").removeClass('loading').text(lg.upload);
				$.prompt(lg.ERROR_UPLOADING_FILE);
			},
			success: function (result) {
				var data = jQuery.parseJSON($('#uploadresponse').find('textarea').text());
				if (data['Code'] == 0) {
					addNode(data['Path'], data['Name']);
					getFolderInfo(data['Path']);

					$("#filepath, #newfile").val('');
					// IE can not empty input='file'. A fix consist to replace the element (see github issue #215)
					if($.browser.msie) $("#newfile").replaceWith($("#newfile").clone(true));
				} else {
					$.prompt(data['Error']);
				}
				$('#upload').removeAttr('disabled');
				$('#upload span').removeClass('loading').text(lg.upload);
				$("#filepath").val('');
			}
		});
	}

	// Loading CustomScrollbar if enabled
	// Important, the script should be called after calling createFileTree() to prevent bug
	if(config.customScrollbar.enabled) {
		loadCSS(config.globals.pluginPath + '/scripts/custom-scrollbar-plugin/jquery.mCustomScrollbar.min.css');
		loadJS(config.globals.pluginPath + '/scripts/custom-scrollbar-plugin/jquery.mCustomScrollbar.concat.min.js');

		var csTheme = config.customScrollbar.theme != undefined ? config.customScrollbar.theme : 'inset-2-dark';
		var csButton = config.customScrollbar.button != undefined ? config.customScrollbar.button : true;

		$(window).load(function(){
			$("#filetree").append('<div style="height:3000px"></div>'); // because if #filetree has height equal to 0, mCustomScrollbar is not applied
			$("#filetree").mCustomScrollbar({
				theme:csTheme,
				scrollButtons:{enable:csButton},
				advanced:{ autoExpandHorizontalScroll:true, updateOnContentResize: true },
				callbacks:{
					onInit:function(){ createFileTree(); }
				},
				axis: "yx"
				});
			$("#fileinfo").mCustomScrollbar({
				theme:csTheme,
				scrollButtons:{enable:csButton},
				advanced:{ autoExpandHorizontalScroll:true, updateOnContentResize: true },
				axis: "y",
				alwaysShowScrollbar: 1
			});
		});
	} else {
		createFileTree();
	}

	// keep only browseOnly features if needed
	if(config.options.browseOnly == true) {
		$('#file-input-container').remove();
		$('#upload').remove();
		$('#newfolder').remove();
		$('#toolbar').remove('#rename');
	}

	// Adjust layout.
	setDimensions();
	$(window).resize(setDimensions);

    // Provides support for adjustible columns.
	$('#splitter').splitter({
		sizeLeft: config.options.splitterMinWidth,
		minLeft: config.options.splitterMinWidth,
		minRight: 200
	});

    getDetailView(fileRoot + expandedFolder);
});

// add useragent string to html element for IE 10/11 detection
var doc = document.documentElement;
doc.setAttribute('data-useragent', navigator.userAgent);

if(config.options.logger) {
	var end = new Date().getTime();
	var time = end - start;
	console.log('Total execution time : ' + time + ' ms');
}

$(window).load(function() {
	setDimensions();
});

})(jQuery);

$(window).load(function() {
    $('#fileinfo').css({'left':$('#splitter .vsplitbar').width()+$('#filetree').width()});
});