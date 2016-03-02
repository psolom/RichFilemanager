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
$.urlParam = function(name) {
	var results = new RegExp('[\\?&]' + name + '=([^&#]*)').exec(window.location.href);
	if (results)
		return results[1];
	else
		return 0;
};

/*---------------------------------------------------------
  Setup, Layout, and Status Functions
---------------------------------------------------------*/

// Retrieves config settings from filemanager.config.json
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
			var url = pluginPath + '/scripts/filemanager.config.json';
			userconfig = 'filemanager.config.json';
		}
	} else {
		var url = pluginPath + '/scripts/filemanager.config.default.json';
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
var setDimensions = function() {
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

// natural sort function
// https://gist.github.com/devinus/453520#file-gistfile1-js
var naturalSort = function (a, b) {
	var NUMBER_GROUPS = /(-?\d*\.?\d+)/g,
		aa = String(a).split(NUMBER_GROUPS),
		bb = String(b).split(NUMBER_GROUPS),
		min = Math.min(aa.length, bb.length);

	for (var i = 0; i < min; i++) {
		var x = parseFloat(aa[i]) || aa[i].toLowerCase(),
			y = parseFloat(bb[i]) || bb[i].toLowerCase();
		if (x < y) return -1;
		else if (x > y) return 1;
	}
	return 0;
};

// preg_replace
// http://xuxu.fr/2006/05/20/preg-replace-javascript/
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

	while(true) {
		if(n < d) {
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
	$('#fileinfo').html('<h1>' + errMsg + '</h1>');
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
	$('#fileinfo').find('tr.file, tr.directory').find('td:first').each(function() {
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

	$('#newfolder').unbind().click(function() {
		var foldername =  lg.default_foldername;
		var msg = lg.prompt_foldername + ' : <input id="fname" name="fname" type="text" value="' + foldername + '" />';

		var getFolderName = function(e, value, message, formVals) {
			if(!value) return;
			var fname = message.children('#fname').val();

			if(fname != '') {
				foldername = cleanString(fname);
				var d = new Date(); // to prevent IE cache issues
				$.getJSON(fileConnector + '?mode=addfolder&path=' + getCurrentPath() + '&config=' + userconfig + '&name=' + encodeURIComponent(foldername) + '&time=' + d.getMilliseconds(), function(result) {
					if(result['Code'] == 0) {
						addFolder(result['Parent']);
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
	var $fileinfo = $('#fileinfo');

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
	        $('#preview img').attr('title', lg.select);
	        $('#preview img').click(function () { selectItem(data); }).css("cursor", "pointer");
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
			window.location = fileConnector + '?mode=download&path=' + encodeURIComponent(data['Path']) + '&config=' + userconfig;
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
	$('#uploader h1').text(lg.current_folder + displayPath(path)).attr('title', displayPath(path, false));
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

// Updates folder summary info
var updateFolderSummary = function(itemsTotal, sizeTotal) {
	var $fileinfo = $('#fileinfo'),
		$contents = $fileinfo.find('#contents'),
		isGridView = $fileinfo.data('view') == 'grid';

	if(!itemsTotal) {
		var selector = isGridView ? 'li' : 'tr';
		var items = $contents.find(selector + '.file, ' + selector + '.directory');
		itemsTotal = items.length;
	}
	if(!sizeTotal) {
		sizeTotal = 0;
		if(isGridView) {
			$contents.find('li.file').find('span.meta.size').each(function() {
				sizeTotal += Number($(this).text());
			});
		} else {
			var columnIndex = $contents.find('th.column-size').index();
			$contents.find('tr.file').find('td:eq('+columnIndex+')').each(function() {
				sizeTotal += Number($(this).data('sort'));
			});
		}
	}

	$('#items-counter').text(itemsTotal + ' ' + lg.items);
	$('#items-size').text(lg.size + ': ' + Math.round(sizeTotal / 1024 /1024 * 100) / 100 + ' ' + lg.mb);
};

// Apply actions after manipulating with filetree or its single node
var adjustFileTree = function($node) {
	$node = $node || $('#filetree');

	// apply context menu
	$node.contextMenu({
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
		options.expandSpeed = state ? 300 : 0;
		options.collapseSpeed = state ? 300 : 0;
	};

	var expandFolderDefault = function($el, data) {
		if (fullexpandedFolder !== null) {
			var flag = false;
			$el.find(".directory.collapsed").each(function (i, folder) {
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
			script: buildFileTreeBranch,
			multiFolder: true,
			expandSpeed: 300,
			collapseSpeed: 300
		}, function(file) {
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
		$.prompt(lg.fck_select_integration);
	}
};

// Renames the current item and returns the new name.
// Called by clicking the "Rename" button in detail views
// or choosing the "Rename" contextual menu option in list views.
var renameItem = function(data) {
	var fileName = config.security.allowChangeExtensions ? data['Filename'] : getFilename(data['Filename']);
	var msg = lg.new_filename + ' : <input id="rname" name="rname" type="text" value="' + fileName + '" />';

	var getNewName = function(e, value, message, formVals) {
		if(!value) return;
		var rname = message.children('#rname').val();

		if(rname != '') {
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
				success: function(result) {
					if(result['Code'] == 0) {
						var newPath = result['New Path'];
						var newName = result['New Name'];
						var oldPath = result['Old Path'];
						var newDir = getDirname(newPath);
						var oldDir = getDirname(oldPath);
						var currentPath = getCurrentPath();
						var $fileinfo = $('#fileinfo');
						var $preview = $('#preview', $fileinfo);
						var isPreview = $preview.length > 0;

						renameNode(oldPath, newPath, newName);

						// current view displays the item to rename
						if(newDir.indexOf(currentPath) === 0) {
							// reload view if file extension was changed (to replace file icon, etc.)
							if(isFile(newPath) && getExtension(newPath) !== getExtension(oldPath)) {
								var viewPath = (isPreview) ? newPath : newDir;
								getDetailView(viewPath);
							// update file data in preview window if it is currently displayed
							} else if(isPreview && oldPath === $('h1', $preview).attr("title")) {
								actualizePreviewItem(newPath);
							// update item data in grid/list view otherwise
							} else if(!isPreview) {
								actualizeViewItem(oldPath, newPath, newName);
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
								var selector = ($fileinfo.data('view') == 'grid') ? 'img' : 'td:first-child';
								actualizeChildrenItems(oldPath, newPath, $fileinfo.find(selector));
							}
						}
						sortViewItems();
						updateFolderSummary();

						if(config.options.showConfirmation) $.prompt(lg.successful_rename);
					} else {
						$.prompt(result['Error']);
					}
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
var moveItemPrompt = function(data) {
	var msg  = lg.move + ' : <input id="rname" name="rname" type="text" value="" />';
		msg += '<div class="prompt-info">' + lg.help_move + '</div>';

	var doMove = function(e, value, message, formVals) {
		if(!value) return;
		var newPath = message.children('#rname').val();

		if(newPath != '') {
			moveItem(data['Path'], newPath);
		}
	};
	var btns = {};
	btns[lg.move] = true;
	btns[lg.cancel] = false;
	$.prompt(msg, {
		submit: doMove,
		buttons: btns
	});
};

// Move the current item to specified dir and returns the new name.
// Called by clicking the "Move" button in detail views
// or choosing the "Move" contextual menu option in list views.
var moveItem = function(oldPath, newPath) {
	var connectString = fileConnector + '?mode=move&old=' + encodeURIComponent(oldPath) + '&new=' + encodeURIComponent(newPath) + '&config=' + userconfig;

	$.ajax({
		type: 'GET',
		url: connectString,
		dataType: 'json',
		async: false,
		success: function(result) {
			if(result['Code'] == 0) {
				var newPath = result['New Path'];
				var newName = result['New Name'];

				moveNode(newPath, newName, oldPath);
				sortViewItems();
				updateFolderSummary();

				if(config.options.showConfirmation) $.prompt(lg.successful_moved);
			} else {
				$.prompt(result['Error']);
			}
		}
	});
};

// Prompts for confirmation, then deletes the current item.
// Called by clicking the "Delete" button in detail views
// or choosing the "Delete contextual menu item in list views.
var deleteItem = function(data) {
	var isDeleted = false;
	var msg = lg.confirmation_delete;

	var doDelete = function(e, value, message, formVals) {
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
                    var path = result['Path'];

                    removeNode(path);
					isDeleted = true;

					// displays parent folder if the deleted item is the actual view
					if(path === getCurrentPath()) {
						var newCurrentPath = getClosestNode(path);
						setCurrentPath(newCurrentPath);
						getDetailView(newCurrentPath);

					// close fileinfo preview if deleted item is currently open
					} else if(isFile(path) && $('#preview').length) {
						getDetailView(getDirname(path));
					}

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
			.not('.directory-parent') // prevent removal "parent folder" item
            .fadeOut(speed, function() {
                $(this).remove();
            });
    // from main window - list view
    } else {
        $('table#contents')
            .find('td[data-path="' + path + '"]').parent()
			.not('.directory-parent')
            .fadeOut(speed, function () {
                $(this).remove();
            });
    }
};

/*---------------------------------------------------------
  Functions to Update the File Tree
---------------------------------------------------------*/

// Adds a new folder.
// Called after a new folder is successfully created.
var addFolder = function(parent) {
	reloadFileTreeNode(parent);
	if(config.options.showConfirmation) {
		$.prompt(lg.successful_added_folder);
	}
};

// Adds a new node.
// Called after a successful file upload.
var addNode = function(path) {
	reloadFileTreeNode(path);
	if(config.options.showConfirmation) {
		$.prompt(lg.successful_added_file);
	}
};

// Rename the specified node with a new name.
// Called after a successful rename operation.
var renameNode = function(oldPath, newPath, newName) {
	var $filetree = $('#filetree'),
		$oldNodeLink = $filetree.find('a[data-path="' + oldPath + '"]');

	if(isFile(newPath)) {
		// reload node if file extension was changed (to replace file icon, etc.)
		if(getExtension(newPath) !== getExtension(oldPath)) {
			updateNodeItem(getDirname(newPath), oldPath, newPath);
		} else {
			$oldNodeLink.attr('data-path', newPath).attr('rel', newPath).text(newName);
		}
	} else {
		$oldNodeLink.text(newName);
		actualizeChildrenItems(oldPath, newPath, $oldNodeLink.parent().find('a'));
	}
	sortFileTreeItems($filetree.find('a[data-path="' + newPath + '"]').parent().parent());
};

// Moves the specified node.
// Called after a successful move operation.
var moveNode = function(newPath, newName, oldFullPath, forceExpand) {
	// could be used on manual move via prompt window
	forceExpand = forceExpand || false;

	var $filetree = $('#filetree');
	// clone original element of the dragging node before it is removed
	var $node = $filetree.find('a[data-path="' + oldFullPath + '"]').parent().not('.ui-draggable-dragging').clone();
    removeDomItem(oldFullPath, 0);

	var currentPath = getCurrentPath();
	var $targetLink = $filetree.find('a[data-path="' + newPath + '"]');
	var $targetNode = $targetLink.next('ul');
	var $adjustNode = $targetNode.parent();

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
	if(newPath === fileRoot) {
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

	// ON move currently open file/folder to another node
	if(currentPath === getDirname(oldFullPath)) {
		var newFullDir = isFile(oldFullPath) ? newPath : newPath + newName + '/';

		var $fileinfo = $('#fileinfo');
		if($('#preview').length > 0) {
			actualizePreviewItem(newFullDir);
		} else {
			// actualize path of each item in main window
			var selector = ($fileinfo.data('view') == 'grid') ? 'img' : 'td:first-child';
			actualizeChildrenItems(oldFullPath, newFullDir, $fileinfo.find(selector));
		}
	}

	actualizeChildrenItems(getClosestNode(oldFullPath), newPath, $node.find('a'));
	$targetNode.append($node);
	sortFileTreeItems($targetNode);
	adjustFileTree($adjustNode);
};

// Removes the specified node.
// Called after a successful delete operation.
var removeNode = function(path) {
    removeDomItem(path, 600);
};




/*---------------------------------------------------------
  Functions to handle Filetree and Fileinfo items during the actions
  Helpers to actualize items paths, sort elements, and manage filetree nodes
---------------------------------------------------------*/

// Actualize data of file which is currently open in the preview window
var	actualizePreviewItem = function(newPath) {
	var $toolbar = $('#toolbar');
	var filename = basename(newPath) || $('#fileinfo').find('#main-title').find('h1').text();
	var fullPath = getDirname(newPath) + filename;

	$('h1', $('#preview')).text(filename).attr("title", fullPath);
	var data = $toolbar.data('fmitem');

	// actualized data for binding
	data['Path'] = fullPath;
	data['Filename'] = filename;

	// Bind toolbar functions.
	$toolbar.find('button').unbind();
	bindToolbar(data);
};

// Actualize data of file/folder item which is currently displayed in gris/list view
var	actualizeViewItem = function(oldPath, newPath, newName) {
	var $fileinfo = $('#fileinfo'),
		$item;
	// update DOM element based on view mode
	if($fileinfo.data('view') == 'grid') {
		$item = $fileinfo.find('img[data-path="' + oldPath + '"]');
		$item.parent().next('p').text(newName);
		$item.attr('data-path', newPath).attr('alt', newPath);
	} else {
		$item = $fileinfo.find('td[data-path="' + oldPath + '"]');
		$item.attr('data-path', newPath).attr('data-sort', newName).text(newName);
	}
};

// Actualize data of filetree branch descendants or grid/list view items.
// Created for "move" and "rename" actions to keep items up to date without reloading.
var actualizeChildrenItems = function(oldPath, newPath, $items) {
	var search = new RegExp('^' + oldPath);

	// replace paths in links along all nodes in cloned branch
	$items.each(function() {
		var subject = $(this).attr('data-path');
		var replaced = subject.replace(search, newPath);
		$(this).attr('data-path', replaced);
		// set extra attributes
		if($(this).is('a')) $(this).attr('rel', replaced);
		if($(this).is('img')) $(this).attr('alt', replaced);
	});
};

// Sorts children of specified filetree node
var sortFileTreeItems = function($node) {
	$node.find('> li').tsort({selector: 'a', order: 'asc', natural: true});
	$node.find('> li.directory').appendTo($node);
};

// Sorts children of specified filetree node
var sortViewItems = function() {
	var $fileinfo = $('#fileinfo'),
		$contents = $fileinfo.find('#contents');

	// sorting based on view mode
	if($fileinfo.data('view') == 'grid') {
		$contents.find('li.file, li.directory').tsort({selector: 'p', order: 'asc', natural: true});
		$contents.find('li.directory').appendTo($contents);
	} else {
		var data = $fileinfo.data('list-sort'),
			$headers = $contents.find('th'),
			columnIndex, order;

		// retrieve stored sort settings or use defaults
		columnIndex = data ? data.column : 0;
		order = data ? data.order : 'asc';

		// apply sort classes to table headers
		$headers.removeClass('sorted sorted-asc sorted-desc');
		$headers.eq(columnIndex).addClass('sorted sorted-' + order);

		$contents.find('tr.file, tr.directory').tsort({selector: 'td:nth-child('+(columnIndex+1)+')', data: 'sort', order: order, natural: true});
		$contents.find('tr.directory').appendTo($contents);
	}
};

// Replaces filetree item with the actual one from server in specifiс branch
// Use when a filetree item was changed and should be reloaded from server ("renameNode" action)
var updateNodeItem = function(branchPath, nodePathOld, nodePathNew) {
	var $oldNode = $('#filetree').find('a[data-path="' + nodePathOld + '"]').parent();
	var $newNode = $(buildFileTreeBranch({dir: getDirname(branchPath)}, nodePathNew));
	$oldNode.replaceWith($newNode);
	adjustFileTree($newNode.parent());
};

// Loads filetree node with new items that are on server
// Use after adding new item to filetree ("addNode", "addFolder" and "upload" actions)
var reloadFileTreeNode = function(targetPath) {
	var $targetNode,
		$filetree = $('#filetree'),
		isRoot = targetPath === fileRoot;

	if(isRoot) {
		$targetNode = getSectionContainer($filetree).children('ul');
	} else {
		$targetNode = $filetree.find('a[data-path="' + targetPath + '"]').next('ul');
	}

	// if target path is root or target node is expanded
	if(isRoot || $targetNode.parent().hasClass('expanded')) {
		var $newNode = $(buildFileTreeBranch({dir: targetPath}));

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
		var $treeLink = $('#filetree').find('a[data-path="' + path + '"]');
		if($treeLink.parent().hasClass('collapsed')) {
			$treeLink.click();
		}
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
	$.getJSON(fileConnector + '?mode=getinfo&path=' + encodeURIComponent(path) + '&config=' + userconfig + '&time=' + d.getMilliseconds(), function(data) {
		switch(action) {
			case 'select':
				selectItem(data);
				break;

			case 'download': // TODO: implement javascript method to test if exstension is correct
				window.location = fileConnector + '?mode=download&path=' + data['Path']  + '&config=' + userconfig + '&time=' + d.getMilliseconds();
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

	// Retrieve the data & populate the template.
	var d = new Date(); // to prevent IE cache issues
	$.getJSON(fileConnector + '?mode=getinfo&path=' + encodeURIComponent(file) + '&config=' + userconfig + '&time=' + d.getMilliseconds(), function(data) {
		if(data['Code'] == 0) {
			$fileinfo.find('#main-title').find('h1').text(data['Filename']).attr('title', file);

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
				client.on("ready", function(readyEvent) {
					client.on("aftercopy", function(event) {
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
			$('#toolbar').data('fmitem', data);
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

	// fix dimensions before all images load
	setDimensions();

	if(data) {
		var counter = 0;
		var totalSize = 0;
		if($fileinfo.data('view') == 'grid') {
			result += '<ul id="contents" class="grid">';

			if(!isFile(path) && path !== fileRoot) {
				result += '<li class="directory-parent" oncontextmenu="return false;">';
				result += '<div class="clip"><img src="' + config.icons.path + '/_Parent.png" alt="' + getParentDirname(path) + '" data-path="' + getParentDirname(path) + '" /></div>';
				result += '</li>';
			}

			for(var key in data) {
				counter++;
				var props = data[key]['Properties'];
				var typeClass = (data[key]['File Type'] == 'dir') ? 'directory' : 'file';
				var cap_classes = "";

				for(var cap in capabilities) {
					if(has_capability(data[key], capabilities[cap])) {
						cap_classes += " cap_" + capabilities[cap];
					}
				}

				var scaledWidth = 64;
				var actualWidth = props['Width'];
				if(actualWidth > 1 && actualWidth < scaledWidth) scaledWidth = actualWidth;

				config.options.showTitleAttr ? title = ' title="' + data[key]['Path'] + '"' : title = '';

				result += '<li class="' + typeClass + cap_classes + '"' + title + '><div class="clip"><img src="' + data[key]['Preview'] + '" width="' + scaledWidth + '" alt="' + data[key]['Path'] + '" data-path="' + data[key]['Path'] + '" /></div><p>' + data[key]['Filename'] + '</p>';
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
			result += '<thead><tr class="rowHeader">';
			result += '<th class="column-name"><span>' + lg.name + '</span></th>';
			result += '<th class="column-dimensions"><span>' + lg.dimensions + '</span></th>';
			result += '<th class="column-size"><span>' + lg.size + '</span></th>';
			result += '<th class="column-modified"><span>' + lg.modified + '</span></th>';
			result += '</tr></thead>';
			result += '<tbody>';

			if(!isFile(path) && path !== fileRoot) {
				result += '<tr class="directory-parent" oncontextmenu="return false;">';
				result += '<td data-path="' + getParentDirname(path) + '">..</td>';
				result += '<td></td>';
				result += '<td></td>';
				result += '<td></td>';
				result += '</tr>';
			}

			for(var key in data) {
				counter++;
				var props = data[key]['Properties'];
				var typeClass = (data[key]['File Type'] == 'dir') ? 'directory' : 'file';
				var cap_classes = "";

				config.options.showTitleAttr ? title = ' title="' + data[key]['Path'] + '"' : title = '';

				for(var cap in capabilities) {
					if (has_capability(data[key], capabilities[cap])) {
						cap_classes += " cap_" + capabilities[cap];
					}
				}
				result += '<tr class="' + typeClass + cap_classes + '">';
				result += '<td data-sort="' + data[key]['Filename'] + '" data-path="' + data[key]['Path'] + '"' + title + '>' + data[key]['Filename'] + '</td>';

				if(props['Width'] && props['Width'] != '') {
					var dimensions = props['Width'] + 'x' + props['Height'];
					result += ('<td data-sort="' + dimensions + '">' + dimensions + '</td>');
				} else {
					result += '<td data-sort=""></td>';
				}

				if(props['Size'] && props['Size'] != '') {
					result += '<td data-sort="' + props['Size'] + '">' + formatBytes(props['Size']) + '</td>';
					totalSize += props['Size'];
				} else {
					result += '<td data-sort=""></td>';
				}

				if(props['Date Modified'] && props['Date Modified'] != '') {
					result += '<td data-sort="' + props['filemtime'] + '">' + props['Date Modified'] + '</td>';
				} else {
					result += '<td data-sort=""></td>';
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
	// apply client-side sorting, required for persistent list view sorting
	sortViewItems();
	updateFolderSummary(counter, totalSize);

	var $contents = $fileinfo.find('#contents');

	// add context menu, init drag-and-drop and bind events
	if($fileinfo.data('view') == 'grid') {
		// context menu
		$contents.contextMenu({
			selector: 'li.file, li.directory',
			appendTo: '.fm-container',
			items: getContextMenuItems(),
			callback: function(itemKey, opt) {
				var path = opt.$trigger.find('img').attr('data-path');
				setMenus(itemKey, path);
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
				var oldPath = ui.draggable.find('img').attr('data-path'),
					newPath = $(event.target).find('img').attr('data-path');
				moveItem(oldPath, newPath);
			}
		});
		// bind click event to load and display detail view
		$contents.find('li').click(function() {
			var path = $(this).find('img').attr('data-path');
			if(config.options.quickSelect && data[path]['File Type'] != 'dir' && $(this).hasClass('cap_select')) {
				selectItem(data[path]);
			} else {
				getDetailView(path);
			}
		});
	} else {
		// context menu
		$contents.contextMenu({
			selector: 'tr.file, tr.directory',
			appendTo: '.fm-container',
			items: getContextMenuItems(),
			callback: function(itemKey, opt) {
				var path = $('td:first-child', opt.$trigger).attr('data-path');
				setMenus(itemKey, path);
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
				var oldPath = ui.draggable.find('td:first').attr('data-path'),
					newPath = $(event.target).find('td:first').attr('data-path');
				moveItem(oldPath, newPath);
			}
		});
		// bind click event to load and display detail view
		$contents.find('tr:has(td)').click(function() {
			var path = $('td:first-child', this).attr('data-path');
			if(config.options.quickSelect && data[path]['File Type'] != 'dir' && $(this).hasClass('cap_select')) {
				selectItem(data[path]);
			} else {
				getDetailView(path);
			}
		});
		// bind click event to table header to implement sorting
		$contents.find('.rowHeader > th').click(function(e) {
			var $th = $(this);
			var index = $th.index();
			var isAscending = !$th.hasClass('sorted-desc');
			var order = isAscending ? 'desc' : 'asc';

			// stores sorting settings as container data to retrieve them on sorting
			$fileinfo.data('list-sort', {column: index, order: order});
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
		var d = new Date(); // to prevent IE cache issues
		var url = fileConnector + '?mode=getfolder&path=' + encodeURIComponent(path) + '&config=' + userconfig + '&showThumbs=' + config.options.showThumbs + '&time=' + d.getMilliseconds();
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

// Retrieves data (file/folder listing) and build html for jqueryFileTree
var buildFileTreeBranch = function(options, itemPath) {
	var result = '',
		items = [],
		data = getFolderData(options.dir);

	// Is there any error or user is unauthorized?
	if(data.Code=='-1') {
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
		result += '<ul class="jqueryFileTree" style="display: none;">' + items.join("\n") + '</ul>';
	} else {
		result += '<h1>' + lg.could_not_retrieve_folder + '</h1>';
	}
	return result;
};

// Builds html node for filetree branch
var buildFileTreeItem = function(item) {
	var html = "",
		extraClass = "",
		cap_classes = "";

	for(var cap in capabilities) {
		if(has_capability(item, capabilities[cap])) {
			cap_classes += " cap_" + capabilities[cap];
		}
	}
	if(item['File Type'] == 'dir') {
		extraClass = item['Protected'] == 0 ? '' : ' directory-locked';
		html += "<li class=\"directory collapsed" + extraClass + "\"><a href=\"#\" class=\"" + cap_classes + "\" rel=\"" + item['Path'] + "\" data-path=\"" + item['Path'] + "\">" + item['Filename'] + "</a></li>";
	} else {
		if(config.options.listFiles) {
			extraClass = item['Protected'] == 0 ? '' : ' file-locked';
			html += "<li class=\"file ext_" + item['File Type'].toLowerCase() + extraClass + "\"><a href=\"#\" class=\"" + cap_classes + "\" rel=\"" + item['Path'] + "\" data-path=\"" + item['Path'] + "\">" + item['Filename'] + "</a></li>";
		}
	}
	return html;
};




/*---------------------------------------------------------
  Initialization
---------------------------------------------------------*/

$(function() {

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

	// finalize the FileManager UI initialization
	// with localized text if necessary
	if(config.options.autoload == true) {
		$('#upload').append(lg.upload);
		$('#newfolder').append(lg.new_folder);
		$('#grid').attr('title', lg.grid_view);
		$('#list').attr('title', lg.list_view);
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
		var currentPath = getCurrentPath();
		if(currentPath != fileRoot) {
            // loads current path in preview mode or parent folder otherwise
			var path = $('#preview').length ? currentPath : getParentDirname(currentPath);
			getFolderInfo(path);
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
				success: function(file, response, xhr) {
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
					// all files in queue are handled
					if (this.getUploadingFiles().length === 0 && this.getQueuedFiles().length === 0) {
						$("#total-progress .progress-bar").css('width', '0%');
						if(this.getRejectedFiles().length === 0 && error_flag === false) {
							$.prompt.close();
						}
						if(config.options.showConfirmation) {
							$.prompt(lg.successful_added_file);
						}
						getFolderInfo(path);
						reloadFileTreeNode(path);
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
					addNode(data['Path']);
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

		$(window).load(function() {
			$("#filetree").append('<div style="height:3000px"></div>'); // because if #filetree has height equal to 0, mCustomScrollbar is not applied
			$("#filetree").mCustomScrollbar({
				theme: csTheme,
				scrollButtons: {
					enable:csButton
				},
				advanced: {
					autoExpandHorizontalScroll: true,
					updateOnContentResize: true
				},
				callbacks: {
					onInit: function() {
						createFileTree();
					}
				},
				axis: "yx"
			});
			$("#fileinfo").mCustomScrollbar({
				theme: csTheme,
				scrollButtons: {
					enable:csButton
				},
				advanced: {
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