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

$.richFmPlugin = function(element, options)
{
	/**
	 * Plugin's default options
	 */
	var defaults = {
		pluginPath: '.'	// relative path to the FM plugin folder
	};

	/**
	 * The reference the current instance of the object
	 */
	var fm = this;

	/**
	 * Private properties accessible only from inside the plugin
	 */
	var $container = $(element),	// reference to the jQuery version of DOM element the plugin is attached to
		$wrapper = $container.children('.fm-wrapper'),
		$header = $wrapper.find('.fm-header'),
		$uploader = $header.find('.fm-uploader'),
		$splitter = $wrapper.children('.fm-splitter'),
		$footer = $wrapper.children('.fm-footer'),
		$fileinfo = $splitter.children('.fm-fileinfo'),
		$filetree = $splitter.children('.fm-filetree'),
		$uploadButton = $uploader.children('.fm-upload'),
		$contents = $fileinfo.find('#contents'),

		HEAD_included_files = [],	// <head> included files collector
		fileIcons = [],				// icons in config.icons.path folder
		config = null,				// configuration options
		lg = null,					// localized messages
		fileRoot = '/',				// relative files root, may be changed with some query params
		baseUrl = null,				// base URL to access the FM
		apiConnector = null,		// API connector URL, based on `baseUrl` if not specified explicitly
		capabilities = [],			// allowed actions to perform in FM
		configSortField = null,		// items sort field name
		configSortOrder = null,		// items sort order 'asc'/'desc'
		loadedFolderData = {},		// file/folder listing data for jqueryFileTree and list/grid view
		fmModel = null,				// filemanager knockoutJS model
		treeObj = null,

		/** variables to keep request options data **/
		userconfig = null,			// config filename
		fullexpandedFolder = null,	// path to be automatically expanded by filetree plugin

		/** service variables **/
		timeStart = new Date().getTime();

	/**
	 * This holds the merged default and user-provided options.
	 * Plugin's properties will be available through this object like:
	 * - fm.settings.propertyName from inside the plugin
	 * - element.data('richFm').settings.propertyName from outside the plugin, where "element" is the element the plugin is attached to;
	 * @type {{}}
	 */
	fm.settings = {};


	/*--------------------------------------------------------------------------------------------------------------
	 Public methods
	 Can be called like:
	 - fm.methodName(arg1, arg2, ... argn) from inside the plugin
	 - element.data('richFm').publicMethod(arg1, arg2, ... argn) from outside the plugin,
	   where "element" is the element the plugin is attached to
	--------------------------------------------------------------------------------------------------------------*/

	fm.log = function(message, obj) {
		var log = alertify;
		var options = $.extend({}, {
			reset: true,
			delay: 5000,
			logMaxItems: 5,
			logPosition: 'bottom right',
			logContainerClass: 'fm-log',
			parent: $('.fm-popup').is(':visible') ? document.body : $fileinfo[0],
			onClick: undefined,
			unique: false,
			type: 'log'
		}, obj);

		// display only one log for the specified 'logClass'
		if(options.logClass && options.unique && $('.fm-log').children('.' + options.logClass).length > 0) {
			return log;
		}

		if(options.reset) log.reset();
		if(options.parent) log.parent(options.parent);
		log.logDelay(options.delay);
		log.logMaxItems(options.logMaxItems);
		log.logPosition(options.logPosition);
		log.logContainerClass(options.logContainerClass);
		log[options.type](message, options.onClick);
		return log;
	};

	fm.error = function(message, options) {
		return fm.log(message, $.extend({}, {
			type: 'error',
			delay: 10000
		}, options));
	};

	fm.warning = function(message, options) {
		return fm.log(message, $.extend({}, {
			type: 'warning',
			delay: 10000
		}, options));
	};

	fm.success = function(message) {
		return fm.log(message, $.extend({}, {
			type: 'success',
			delay: 6000
		}, options));
	};

	fm.alert = function(message) {
		alertify
			.reset()
			.dialogContainerClass('fm-popup')
			.alert(message);
	};

	fm.confirm = function(obj) {
		alertify
			.reset()
			.dialogWidth(obj.width)
			.dialogPersistent(obj.persistent)
			.dialogContainerClass('fm-popup')
			.confirm(obj.message, obj.okBtn, obj.cancelBtn);
	};

	fm.prompt = function(obj) {
		alertify
			.reset()
			.dialogWidth(obj.width)
			.dialogPersistent(obj.persistent)
			.dialogContainerClass('fm-popup')
			.theme(obj.template)
			.prompt(obj.message, obj.value || '', obj.okBtn, obj.cancelBtn);
	};

	fm.dialog = function(obj) {
		alertify
			.reset()
			.dialogWidth(obj.width)
			.dialogPersistent(obj.persistent)
			.dialogContainerClass('fm-popup')
			.dialog(obj.message, obj.buttons);
	};

	// Forces columns to fill the layout vertically.
	// Called on initial page load and on resize.
	fm.setDimensions = function() {
		var bheight = 0,
			padding = $container.outerHeight(true) - $container.height();

		if($.urlParam('CKEditorCleanUpFuncNum')) bheight +=60;

		var newH = $(window).height() - $header.height() - $footer.height() - padding - bheight;
		$splitter.height(newH);

		// adjust height of filemanager if there are other DOM elemements on page
		var delta = $(document).height() - $(window).height();
		if(!$container.parent().is('body') && delta > 0) {
			var diff = newH - delta;
			newH = (diff > 0) ? diff : 1;
			$splitter.height(newH);
		}

		// adjustment for window horizontal resize
		var newW = $splitter.width() - $splitter.children(".splitter-bar-vertical").outerWidth() - $filetree.outerWidth();
		$fileinfo.width(newW);
	};


	/*--------------------------------------------------------------------------------------------------------------
	 Private methods
	 These methods can be called only from inside the plugin like: methodName(arg1, arg2, ... argn)
	--------------------------------------------------------------------------------------------------------------*/

	/**
	 * The "constructor" method that gets called when the object is created
	 */
	var construct = function() {
		configure()
			.then(function(conf_d, conf_u) {
				return localize();
			})
			.then(function() {
				return readIcons();
			})
			.then(function() {
				return includeTemplates();
			})
			.then(function() {
				includeAssets();
				initialize();
			});
	};

	var configure = function() {
		// The plugin's final properties are the merged default and user-provided options (if any)
		fm.settings = $.extend(true, defaults, options);

		return $.when(loadConfigFile('default'), loadConfigFile('user')).done(function(confd, confu) {
			var config_default = confd[0];
			var config_user = confu[0];

			// remove version from user config file
			if (config_user !== undefined && config_user !== null) {
				delete config_user.version;
			}
			// merge default config and user config file
			config = $.extend({}, config_default, config_user);

			// setup baseUrl
			if(config.options.baseUrl === false) {
				baseUrl = location.origin + location.pathname;
			} else {
				baseUrl = config.options.baseUrl;
			}
			// for url like http://site.com/index.html
			if(getExtension(baseUrl).length > 0) {
				baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
			}
			baseUrl = trimSlashes(baseUrl) + '/';

			// setup apiConnector
			var langConnector = 'connectors/' + config.api.lang + '/filemanager.' + config.api.lang;
			apiConnector = config.api.connectorUrl || baseUrl + langConnector;
		});
	};

	// localize messages based on culture var or from URL
	var localize = function() {
		var langCode = $.urlParam('langCode');
		var langPath = fm.settings.pluginPath + '/scripts/languages/';

		function buildLangPath(code) {
			return langPath + code + '.json';
		}

		return $.ajax()
			.then(function() {
				if(langCode != 0) {
					// try to load lang file based on langCode in query params
					return file_exists(buildLangPath(langCode))
						.done(function() {
							config.options.culture = langCode;
						})
						.fail(function() {
							setTimeout(function() {
								fm.error('Given language file (' + buildLangPath(langCode) + ') does not exist!');
							}, 500);
						});
				}
			})
			.then(function() {
				return $.ajax({
					type: 'GET',
					url: buildLangPath(config.options.culture),
					dataType: 'json'
				}).done(function(conf_lg) {
					lg = conf_lg;
				});
			});
	};

	// read folder with icons for filetypes
	var readIcons = function() {
		return $.ajax({
			type: 'GET',
			url: fm.settings.pluginPath + '/' + config.icons.path + '/',
			success: function(response) {
				$(response).find("a").attr("href", function (i, filename) {
					if(filename.match(/\.(png)$/) ) {
						fileIcons.push(filename);
					}
				});
			}
		});
	};

	var includeTemplates = function() {
		return $.when(loadTemplate('upload-container'), loadTemplate('upload-item')).done(function(uc, ui) {
			var tmpl_upload_container = uc[0];
			var tmpl_upload_item = ui[0];

			$wrapper
				.append(tmpl_upload_container)
				.append(tmpl_upload_item);
		});
	};

	var includeAssets = function() {
		// Loading theme
		loadCSS('/themes/' + config.options.theme + '/styles/theme.css');

		// Loading zeroClipboard
		loadJS('/scripts/zeroclipboard/dist/ZeroClipboard.js');

		// Loading CodeMirror if enabled for online edition
		if(config.edit.enabled) {
			loadCSS('/scripts/CodeMirror/lib/codemirror.css');
			loadCSS('/scripts/CodeMirror/theme/' + config.edit.theme + '.css');
			loadJS('/scripts/CodeMirror/lib/codemirror.js');
			loadJS('/scripts/CodeMirror/addon/selection/active-line.js');
			loadCSS('/scripts/CodeMirror/addon/display/fullscreen.css');
			loadJS('/scripts/CodeMirror/addon/display/fullscreen.js');
			loadJS('/scripts/CodeMirror/dynamic-mode.js');
		}

		if(config.customScrollbar.enabled) {
			loadCSS('/scripts/custom-scrollbar-plugin/jquery.mCustomScrollbar.min.css');
			loadJS('/scripts/custom-scrollbar-plugin/jquery.mCustomScrollbar.concat.min.js');
		}

		if(!config.options.browseOnly) {
			// Loading jquery file upload library
			loadJS('/scripts/jQuery-File-Upload/js/vendor/jquery.ui.widget.js');
			loadJS('/scripts/jQuery-File-Upload/js/canvas-to-blob.min.js');
			loadJS('/scripts/jQuery-File-Upload/js/load-image.all.min.js');
			loadJS('/scripts/jQuery-File-Upload/js/jquery.iframe-transport.js');
			loadJS('/scripts/jQuery-File-Upload/js/jquery.fileupload.js');
			loadJS('/scripts/jQuery-File-Upload/js/jquery.fileupload-process.js');
			loadJS('/scripts/jQuery-File-Upload/js/jquery.fileupload-image.js');
			loadJS('/scripts/jQuery-File-Upload/js/jquery.fileupload-validate.js');

			if(config.upload.multiple) {
				loadCSS('/scripts/jQuery-File-Upload/css/dropzone.css');
			}
		}

		if(config.options.charsLatinOnly) {
			loadJS('/scripts/speakingurl/speakingurl.min.js');
		}
	};

	var initialize = function () {
		// reads capabilities from config files if exists else apply default settings
		capabilities = config.options.capabilities || ['upload', 'select', 'download', 'rename', 'move', 'delete', 'replace'];

		// defines sort params
		var chunks = [];
		if(config.options.fileSorting) {
			chunks = config.options.fileSorting.toLowerCase().split('_');
		}

		configSortField = chunks[0] || 'name';
		configSortOrder = chunks[1] || 'asc';

		// Activates knockout.js
		fmModel = new FmModel();
		ko.applyBindings(fmModel);

		ko.bindingHandlers.toggleNodeVisibility = {
			init: function (element, valueAccessor) {
				var node = valueAccessor();
				//console.log('toggleNodeVisibility INIT', node);
				$(element).toggle(node.isExpanded());
			},
			update: function (element, valueAccessor) {
				var node = valueAccessor();
				if(node.isSliding() === false) {
					return false;
				}
				//console.log('toggleNodeVisibility isExpanded', node.isExpanded());
				if(node.isExpanded() === false) {
					$(element).slideDown(fmModel.treeList.options.expandSpeed, function() {
						node.isSliding(false);
						node.isExpanded(true);
					});
				}
				if(node.isExpanded() === true) {
					$(element).slideUp(fmModel.treeList.options.expandSpeed, function() {
						node.isSliding(false);
						node.isExpanded(false);
					});
				}
			}
		};

		ko.bindingHandlers.draggableView = {
			init: function(element, valueAccessor, allBindingsAccessor) {
				var koItem = valueAccessor();
				if(koItem.rdo.type === "file" || koItem.rdo.type === "folder") {
					$(element).draggable({
						distance: 3,
						cursor: "pointer",
						refreshPositions: false,
						helper: function() {
							var helperClass = 'drag-helper-' + fmModel.viewMode();
							return $('<div>', {class: helperClass}).append($(this).clone().html());
						},
						appendTo: config.customScrollbar.enabled ? $fileinfo.find('.mCustomScrollBox') : $fileinfo,
						drag: function(event, ui) {
							$(this).draggable('option', 'refreshPositions', fmModel.itemsList.isScrolling());
						}
					});
				}
			}
		};

		ko.bindingHandlers.droppableView = {
			init: function(element, valueAccessor, allBindingsAccessor) {
				if(valueAccessor().rdo.type === "folder" || valueAccessor().rdo.type === "parent") {
					$(element).droppable({
						hoverClass: "drop-hover",
						accept: function($draggable) {
							var koItem = ko.dataFor($draggable[0]);
							var type = koItem ? koItem.rdo.type : null;
							return (type === "file" || type === "folder");
						},
						drop: function(event, ui) {
							moveItem(ko.dataFor(ui.draggable[0]), ko.dataFor(event.target));
						}
					});
				}
			}
		};

		ko.bindingHandlers.draggableTree = {
			init: function(element, valueAccessor, allBindingsAccessor) {
				var koItem = valueAccessor();
				if(koItem.rdo.type === "file" || koItem.rdo.type === "folder") {
					$(element).draggable({
						distance: 3,
						cursor: "pointer",
						refreshPositions: false,
						helper: function() {
							return $('<li>').append($(this).clone());
						},
						appendTo: config.customScrollbar.enabled ? $filetree.find('.mCustomScrollBox') : $filetree,
						start: function(event, ui) {
							console.log('DRAG start', koItem, event.target, ui, this);
							// var collapsed = fmModel.treeList.collapseNode(koItem);
							// koItem.collapsedOnDrag(collapsed);
							//ko.dataFor(event.target).isExpanded(false);
						},
						stop: function(event, ui) {
							console.log('DRAG stop', koItem, event.target, ui, this);
							//fmModel.treeList.draggingElement(null);
							// if(koItem.collapsedOnDrag() === true) {
							// 	fmModel.treeList.expandNode(koItem);
							// }
							//ko.dataFor(event.target).isExpanded(true);
						},
						drag: function(event, ui) {
							$(this).draggable('option', 'refreshPositions', fmModel.treeList.isScrolling());
						}
					});
				}
			}
		};

		ko.bindingHandlers.droppableTree = {
			init: function(element, valueAccessor, allBindingsAccessor) {
				if(valueAccessor().rdo.type === "folder" || valueAccessor().rdo.type === "parent") {
					$(element).droppable({
						hoverClass: "drop-hover",
						accept: function($draggable) {
							// prevent to drop inside parent element
							if($draggable.closest("ul").prev("a").is($(this))) {
								return false;
							}
							// prevent to drop inside children elements
							if($.contains($draggable.parent()[0], this)) {
								return false;
							}

							var koItem = ko.dataFor($draggable[0]);
							var type = koItem ? koItem.rdo.type : null;
							return (type === "file" || type === "folder");
						},
						drop: function(event, ui) {
							console.log('DROP - MOVE');
							moveItem(ko.dataFor(ui.draggable[0]), ko.dataFor(event.target));
						}
					});
				}
			}
		};

		if(config.extras.extra_js) {
			for(var i=0; i<config.extras.extra_js.length; i++) {
				$.ajax({
					type: 'GET',
					url: config.extras.extra_js[i],
					dataType: "script",
					async: config.extras.extra_js_async
				});
			}
		}

		// changes files root to restrict the view to a given folder
		if($.urlParam('exclusiveFolder') != 0) {
			fileRoot += $.urlParam('exclusiveFolder');
			if(isFile(fileRoot)) fileRoot += '/'; // add last '/' if needed
			fileRoot = fileRoot.replace(/\/\//g, '\/');
		}

		// get folder that should be expanded after filemanager is loaded
		var expandedFolder = '';
		if($.urlParam('expandedFolder') != 0) {
			expandedFolder = $.urlParam('expandedFolder');
			fullexpandedFolder = fileRoot + expandedFolder;
			fullexpandedFolder = fullexpandedFolder.replace(/\/\//g, '\/');
		}

		// finalize the FileManager UI initialization with localized text
		if(config.options.localizeGUI === true) {
			//$header.find('#newfolder').append(lg.button_new_folder);
			//$header.find('#home').attr('title', lg.button_home);
			//$header.find('#grid').attr('title', lg.button_mode_grid);
			//$header.find('#list').attr('title', lg.button_mode_list);
			//$header.find('#clipboard-copy').attr('title', lg.clipboard_copy);
			//$header.find('#clipboard-cut').attr('title', lg.clipboard_cut);
			//$header.find('#clipboard-paste').attr('title', lg.clipboard_paste_full);
			//$header.find('#clipboard-clear').attr('title', lg.clipboard_clear_full);
		}

		// adding a close button triggering callback function if CKEditorCleanUpFuncNum passed
		if($.urlParam('CKEditorCleanUpFuncNum')) {
			$("body").append('<button id="close-btn" type="button">' + lg.close + '</button>');

			$('#close-btn').click(function () {
				parent.CKEDITOR.tools.callFunction($.urlParam('CKEditorCleanUpFuncNum'));
			});
		}

		// input file replacement
		$("#newfile").change(function() {
			$("#filepath").val($(this).val().replace(/.+[\\\/]/, ""));
		});

		// load searchbox
		if(config.options.searchBox === true)  {
			loadJS('/scripts/filemanager.liveSearch.min.js');
		} else {
			$('#search').remove();
		}

		// Loading CustomScrollbar if enabled
		if(config.customScrollbar.enabled) {
			$filetree.mCustomScrollbar({
				theme: config.customScrollbar.theme,
				scrollButtons: {
					enable: config.customScrollbar.button
				},
				advanced: {
					autoExpandHorizontalScroll: true,
					updateOnContentResize: true
				},
				callbacks: {
					onScrollStart: function() {
						fmModel.treeList.isScrolling(true);
					},
					onScroll: function() {
						fmModel.treeList.isScrolling(false);
					}
				},
				axis: "yx"
			});

			$fileinfo.mCustomScrollbar({
				theme: config.customScrollbar.theme,
				scrollButtons: {
					enable: config.customScrollbar.button
				},
				advanced: {
					autoExpandHorizontalScroll:true,
					updateOnContentResize: true
				},
				callbacks: {
					onScrollStart: function() {
						fmModel.itemsList.isScrolling(true);
					},
					onScroll: function() {
						fmModel.itemsList.isScrolling(false);
					}
				},
				axis: "y",
				alwaysShowScrollbar: 0
			});
		}

		// add useragent string to html element for IE 10/11 detection
		var doc = document.documentElement;
		doc.setAttribute('data-useragent', navigator.userAgent);

		if(config.options.logger) {
			var timeEnd = new Date().getTime();
			var time = timeEnd - timeStart;
			console.log('Total execution time : ' + time + ' ms');
		}

		// TODO: use something better to be sure assets are loaded
		// delay until theme CSS file is loaded
		setTimeout(function() {
			// Provides support for adjustible columns.
			$splitter.splitter({
				sizeLeft: config.options.splitterWidth,
				minLeft: config.options.splitterMinWidth,
				minRight: 200
			});

			var $loading = $container.find('.fm-loading-wrap');
			$loading.fadeOut(800); // remove loading screen div
			$(window).trigger('resize');
		}, 200);

		createFileTree();
		setupUploader();
	};

	/**
	 * Knockout model to operate view items
	 * @constructor
	 */
	var FmModel = function() {
		var model = this;
		this.config = ko.observable(config);
		this.lg = ko.observable(lg);
		this.loadingView = ko.observable(true);
		this.previewFile = ko.observable(false);
		this.viewMode = ko.observable(config.options.defaultViewMode);
		this.currentPath = ko.observable(fileRoot);
		this.browseOnly = ko.observable(config.options.browseOnly);

		this.loadItems = function(path) {
			model.loadingView(true);

			var queryParams = {
				mode: 'getfolder',
				path: path
			};

			if($.urlParam('type')) {
				queryParams.type = $.urlParam('type');
			}

			$.ajax({
				type: 'GET',
				url: buildConnectorUrl(queryParams),
				dataType: "json",
				cache: false,
				success: function(response) {
					if(response.data) {
						model.currentPath(path);
						model.itemsList.setList(response.data);
					}
					handleAjaxResponseErrors(response);
				},
				error: handleAjaxError
			});
		};

		var PreviewItem = function() {
			var preview_item = this;
			this.rdo = ko.observable({});
			this.cdo = ko.observable({});
			this.viewer = ko.observable({});
			this.editor = {
				enabled: ko.observable(false),
				content: ko.observable(''),
				codeMirror: ko.observable(null)
			};

			// fires specific action by clicking toolbar buttons in detail view
			this.bindToolbar = function(action) {
				if (has_capability(preview_item.rdo(), action)) {
					performAction(action, preview_item.rdo());
				}
			};

			this.load = function(resourceObject) {
				preview_item.rdo(resourceObject);
				// computed data object
				preview_item.cdo().sizeFormatted = formatBytes(resourceObject.attributes.size);
				preview_item.cdo().dimensions = resourceObject.attributes.width ? resourceObject.attributes.width + 'x' + resourceObject.attributes.height : null;

				var filename = resourceObject.attributes.name;
				var viewerObject = {
					type: 'image',
					url: createImageUrl(resourceObject, false),
					options: {}
				};

				if(isEditableFile(filename) && config.edit.enabled == true) {
					viewerObject.type = 'edit';
				}
				if(isAudioFile(filename) && config.audios.showAudioPlayer === true) {
					viewerObject.type = 'audio';
					viewerObject.url = createPreviewUrl(resourceObject, true);
				}
				if(isVideoFile(filename) && config.videos.showVideoPlayer === true) {
					viewerObject.type = 'video';
					viewerObject.url = createPreviewUrl(resourceObject, true);
					viewerObject.options = {
						width: config.videos.videosPlayerWidth,
						height: config.videos.videosPlayerHeight
					};
				}
				if(isPdfFile(filename) && config.pdfs.showPdfReader === true) {
					viewerObject.type = 'pdf';
					viewerObject.url = fm.settings.pluginPath + '/scripts/ViewerJS/index.html#' + createPreviewUrl(resourceObject, true);
					viewerObject.options = {
						width: config.pdfs.pdfsReaderWidth,
						height: config.pdfs.pdfsReaderHeight
					};
				}
				if(isDocumentFile(filename) && config.docs.showGoogleViewer === true) {
					viewerObject.type = 'google';
					viewerObject.url = 'http://docs.google.com/viewer?url=' + encodeURIComponent(createPreviewUrl(resourceObject, false)) + '&embedded=true';
					viewerObject.options = {
						width: config.docs.docsReaderWidth,
						height: config.docs.docsReaderHeight
					};
				}

				preview_item.viewer(viewerObject);
				model.previewFile(true);

				// zeroClipboard code
				ZeroClipboard.config({swfPath: fm.settings.pluginPath + '/scripts/zeroclipboard/dist/ZeroClipboard.swf'});
				var client = new ZeroClipboard(document.getElementById("copy-button"));
				client.on("ready", function(readyEvent) {
					client.on("aftercopy", function(event) {
						// console.log("Copied text to clipboard: " + event.data["text/plain"]);
					});
				});
			};

			this.copyClipboard = function() {
				fm.success(lg.copied);
			};

			this.editFile = function() {
				editItem(preview_item.rdo())
			};

			this.saveFile = function() {
				saveItem(preview_item.rdo())
			};

			this.closeEditor = function() {
				preview_item.editor.enabled(false);
			};

			this.buttonVisibility = function(action) {
				switch(action) {
					case 'select':
						return (has_capability(preview_item.rdo(), action) && ($.urlParam('CKEditor') || window.opener || window.tinyMCEPopup || $.urlParam('field_name') || $.urlParam('ImperaviElementId')));
					case 'move':
					case 'rename':
					case 'delete':
					case 'replace':
						return (has_capability(preview_item.rdo(), action) && config.options.browseOnly !== true);
					case 'download':
						return (has_capability(preview_item.rdo(), action));
				}
			};
		};

		this.previewItem = new PreviewItem();

		var TreeModel = function() {
			var tree_list = this;
			this.isScrolling = ko.observable(false);

			this.options = {
				showLine: true,
				expandSpeed: 200
			};

			this.treeData = {
				id: '/',
				level: ko.observable(-1),
				children: ko.observableArray([])
			};

			this.treeData.children.subscribe(function (value) {
				console.log('treeData.children.subscribe', value);
				tree_list.arrangeNode(tree_list.treeData);
			});

			var expandFolderDefault = function (parentNode) {
				if (fullexpandedFolder !== null) {
					// looking for node that starts with specified path
					var node = tree_list.findByFilter(function (node) {
						return (fullexpandedFolder.indexOf(node.id) === 0);
					}, parentNode);

					if (node) {
						tree_list.options.expandSpeed = 10;
						tree_list.loadNodes(node, false);
					} else {
						fullexpandedFolder = null;
						tree_list.options.expandSpeed = 200;
					}
				}
			};

			this.findByParam = function(key, value, contextNode) {
				if(!contextNode) {
					contextNode = tree_list.treeData;
					if(contextNode[key] === value) {
						return contextNode;
					}
				}
				var nodes = contextNode.children();
				if(!nodes || nodes.length === 0) {
					return null;
				}
				for (var i = 0, l = nodes.length; i < l; i++) {
					if (nodes[i][key] === value) {
						return nodes[i];
					}
					var result = tree_list.findByParam(key, value, nodes[i]);
					if(result) return result;
				}
				return null;
			};

			this.findByFilter = function(filter, contextNode) {
				if(!contextNode) {
					contextNode = tree_list.treeData;
					if(filter(contextNode)) {
						return contextNode;
					}
				}
				var nodes = contextNode.children();
				if(!nodes || nodes.length === 0) {
					return null;
				}
				for (var i = 0, l = nodes.length; i < l; i++) {
					if(filter(nodes[i])) {
						return nodes[i];
					}
					var result = tree_list.findByFilter(filter, nodes[i]);
					if(result) return result;
				}
				return null;
			};

			this.loadNodes = function(targetNode, refresh) {
				var path = targetNode ? targetNode.id : tree_list.treeData.id;
				if(targetNode) {
					targetNode.isLoading(true);
				}

				var queryParams = {
					mode: 'getfolder',
					path: path
				};

				if($.urlParam('type')) {
					queryParams.type = $.urlParam('type');
				}

				$.ajax({
					type: 'GET',
					url: buildConnectorUrl(queryParams),
					dataType: "json",
					cache: false,
					success: function(response) {
						console.log('loadItems response', response);
						if(response.data) {
							fmModel.currentPath(path);
							fmModel.itemsList.setList(response.data);

							var nodes = [];
							$.each(response.data, function(i, resourceObject) {
								var nodeObject = tree_list.createNode(resourceObject);
								nodes.push(nodeObject);
							});
							if(refresh) {
								targetNode.children([]);
							}
							tree_list.addNodes(targetNode, nodes);
							// not root
							if(targetNode) {
								targetNode.isLoaded(true);
								tree_list.expandNode(targetNode);
							}
							expandFolderDefault(targetNode);
						}
						handleAjaxResponseErrors(response);
					},
					error: handleAjaxError
				});
			};

			this.createNode = function(resourceObject) {
				return new NodeModel(resourceObject);
			};

			this.addNodes = function(targetNode, newNodes) {
				if(!$.isArray(newNodes)) {
					newNodes = [newNodes];
				}
				if (!targetNode) {
					targetNode = tree_list.treeData;
				}
				// list only folders in tree
				if(!config.options.listFiles) {
					newNodes = $.grep(newNodes, function(node) {
						return (node.cdo.isFolder);
					});
				}
				$.each(newNodes, function(i, node) {
					node.parentNode(targetNode);
				});
				var allNodes = targetNode.children().concat(newNodes);
				targetNode.children(sortItems(allNodes));
			};

			this.expandNode = function(node) {
				if(node.isExpanded() === false && node.isLoaded() === true) {
					node.isSliding(true);
					return true;
				}
				return false;
			};

			this.collapseNode = function(node) {
				if(node.isExpanded() === true) {
					node.isSliding(true);
					return true;
				}
				return false;
			};

			this.arrangeNode = function(node) {
				var childrenLength = node.children().length;
				//console.log('childrenLength', childrenLength);
				$.each(node.children(), function(index, cNode) {
					cNode.level(node.level() + 1);
					cNode.isFirstNode(index === 0);
					cNode.isLastNode(index === (childrenLength - 1));
				});
			};

			this.nodeRendered = function(elements, node) {
				// attach context menu
				$(elements[1]).contextMenu({
					selector: '.file, .directory',
					// wrap options with "build" allows to get item element
					build: function ($triggerElement, e) {
						return {
							appendTo: '.fm-container',
							items: getContextMenuItems(node.rdo),
							callback: function(itemKey, opt) {
								console.log('contextMenu', node);
								performAction(itemKey, node.rdo);
							}
						}
					}
				});
			};

			this.actualizeNodeObject = function(node, oldFolder, newFolder) {
				var search = new RegExp('^' + oldFolder);
				var oldPath = node.rdo.id;
				var newPath = oldPath.replace(search, newFolder);
				node.id = newPath;
				node.rdo.id = newPath;
				node.rdo.attributes.path = node.rdo.attributes.path.replace(new RegExp(oldPath + '$'), newPath);

				if(node.children().length) {
					$.each(node.children(), function(index, cNode) {
						tree_list.actualizeNodeObject(cNode, oldFolder, newFolder);
					});
				}
			};

			var NodeModel = function(resourceObject) {
				var self = this;
				this.id = resourceObject.id;
				this.rdo = resourceObject;
				this.cdo = { // computed data object
					isFolder: (resourceObject.type === 'folder'),
					dimensions: resourceObject.attributes.width ? resourceObject.attributes.width + 'x' + resourceObject.attributes.height : null,
					itemClass: (resourceObject.type === 'folder') ? 'directory' : 'file'
				};

				this.nodeTitle = ko.observable(resourceObject.attributes.name);
				this.children = ko.observableArray([]);
				this.parentNode = ko.observable(null);
				this.isSliding = ko.observable(false);
				this.isExpanded = ko.observable(false);
				this.isLoading = ko.observable(false);
				this.isLoaded = ko.observable(false);
				this.collapsedOnDrag = ko.observable(false);
				// arrangable properties
				this.level = ko.observable(0);
				this.isFirstNode = ko.observable(false);
				this.isLastNode = ko.observable(false);

				this.nodeTitle.subscribe(function (value) {
					self.rdo.attributes.name = value;
				});
				this.children.subscribe(function (value) {
					tree_list.arrangeNode(self);
				});

				this.isLoaded.subscribe(function (value) {
					if(value === true) {
						self.isLoading(false);
					}
				});

				this.toggleNode = function(node) {
					if(!node.cdo.isFolder) {
						return false;
					}
					if(node.rdo.attributes.protected) {
						fm.error(lg.NOT_ALLOWED_SYSTEM);
						return false;
					}

					if(!node.isExpanded() && !node.isLoaded()) {
						tree_list.loadNodes(node, true);
					} else {
						node.isSliding(true);
					}
				};

				this.viewNode = function(node) {
					self.toggleNode(node);
					if(node.rdo.type === 'file') {
						getDetailView(node.rdo);
					}
				};

				this.remove = function() {
					self.parentNode().children.remove(self);
				};

				this.isRoot = function() {
					return self.level() === tree_list.treeData.id;
				};

				this.title = ko.pureComputed(function() {
					return (config.options.showTitleAttr) ? this.rdo.id : null;
				}, this);

				this.iconClass = ko.pureComputed(function() {
					var cssClass,
						extraClass = ['ico'];
					if(this.cdo.isFolder === true) {
						cssClass = 'ico_folder';
						if(this.isLoading() === true) {
							extraClass.push('loading');
						} else {
							extraClass.push('folder');
							if(this.rdo.attributes.protected) {
								extraClass.push('lock');
							} else if(this.isExpanded() || !this.isExpanded() && this.isSliding()) {
								extraClass.push('open');
							}
						}
					} else {
						cssClass = 'ico_file';
						if(this.rdo.attributes.protected) {
							extraClass.push('file', 'lock');
						} else {
							extraClass.push('ext', this.rdo.attributes.extension);
						}
					}
					return cssClass + ' ' + extraClass.join('_');
				}, this);

				this.switcherClass = ko.pureComputed(function() {
					var cssClass = [];
					if (tree_list.options.showLine) {
						if (this.level() === 0 && this.isFirstNode() && this.isLastNode()) {
							cssClass.push('root');
						} else if (this.level() == 0 && this.isFirstNode()) {
							cssClass.push('roots');
						} else if (this.isLastNode()) {
							cssClass.push('bottom');
						} else {
							cssClass.push('center');
						}
					} else {
						cssClass.push('noline');
					}
					if (this.cdo.isFolder) {
						var isOpen = (this.isExpanded() || !this.isExpanded() && this.isSliding());
						cssClass.push(isOpen ? 'open' : 'close');
					} else {
						cssClass.push('docu');
					}
					return cssClass.join('_');
				}, this);

				this.clusterClass = ko.pureComputed(function() {
					return (tree_list.options.showLine && !this.isLastNode()) ? 'line' : '';
				}, this);
			};
		};

		this.treeList = new TreeModel();

		var ItemsList = function() {
			var list = this;
			this.imageMaxWidth = 64;
			this.listSortField = ko.observable(configSortField);
			this.listSortOrder = ko.observable(configSortOrder);
			this.isScrolling = ko.observable(false);
			this.objectsSize = ko.observableArray(0);
			this.objectsNumber = ko.observableArray(0);
			this.objects = ko.observableArray([]);

			this.createObject = function(resourceObject) {
				return new ListObject(resourceObject);
			};

			this.addNew = function(dataObjects) {
				if(!$.isArray(dataObjects)) {
					dataObjects = [dataObjects];
				}
				$.each(dataObjects, function (i, resourceObject) {
					model.itemsList.objects.push(list.createObject(resourceObject));
				});
				model.itemsList.sortObjects();
			};

			this.setList = function(dataObjects) {
				var objects = [];
				// add parent folder object
				if(!isFile(model.currentPath()) && model.currentPath() !== fileRoot) {
					var parentPath = getParentDirname(model.currentPath());
					var parent = {
						id: parentPath,
						rdo: {
							type: 'parent'
						},
						cdo: {
							imageUrl: fm.settings.pluginPath + '/' + config.icons.path + '/' + config.icons.parent
						}
					};

					parent.open = function() {
						model.loadItems(parent.id);
					};
					objects.push(parent);
				}
				$.each(dataObjects, function (i, resourceObject) {
					objects.push(list.createObject(resourceObject));
				});
				model.itemsList.objects(objects);
				model.itemsList.sortObjects();
				model.loadingView(false);
			};

			this.findByParam = function(key, value) {
				return ko.utils.arrayFirst(fmModel.itemsList.objects(), function(object) {
					return object[key] === value;
				});
			};

			this.sortObjects = function() {
				var sortedList = sortItems(list.objects());
				list.objects(sortedList);
			};

			this.objects.subscribe(function(items) {
				var totalNumber = 0,
					totalSize = 0;

				$.each(items, function(i, item) {
					if(item.rdo.type !== 'parent') {
						totalNumber++;
					}
					if(item.rdo.type === 'file') {
						totalSize += Number(item.rdo.attributes.size);
					}
				});
				// updates folder summary info
				list.objectsNumber(totalNumber);
				list.objectsSize(formatBytes(totalSize));

				// context menu
				$fileinfo.contextMenu({
					selector: '.file, .directory',
					// wrap options with "build" allows to get item element
					build: function ($triggerElement, e) {
						var koItem = ko.dataFor($triggerElement[0]);
						return {
							appendTo: '.fm-container',
							items: getContextMenuItems(koItem.rdo),
							callback: function(itemKey, opt) {
								performAction(itemKey, koItem.rdo);
							}
						}
					}
				});
			});

			var ListObject = function(resourceObject) {
				var previewWidth = list.imageMaxWidth;
				if(resourceObject.attributes.width && resourceObject.attributes.width < list.imageMaxWidth) {
					previewWidth = resourceObject.attributes.width;
				}

				this.id = resourceObject.id; // for search purpose
				this.rdo = resourceObject; // original resource data object
				this.cdo = { // computed data object
					isFolder: (resourceObject.type === 'folder'),
					sizeFormatted: formatBytes(resourceObject.attributes.size),
					dimensions: resourceObject.attributes.width ? resourceObject.attributes.width + 'x' + resourceObject.attributes.height : null,
					itemClass: (resourceObject.type === 'folder') ? 'directory' : 'file',
					imageUrl: createImageUrl(resourceObject, true),
					previewWidth: previewWidth
				};

				this.title = ko.pureComputed(function() {
					return (config.options.showTitleAttr) ? this.rdo.id : null;
				}, this);

				this.listIconClass = ko.pureComputed(function() {
					var cssClass,
						extraClass = ['ico'];
					if(this.cdo.isFolder === true) {
						cssClass = 'ico_folder';
						extraClass.push('folder');
						if(this.rdo.attributes.protected) {
							extraClass.push('lock');
						}
					} else {
						cssClass = 'ico_file';
						if(this.rdo.attributes.protected) {
							extraClass.push('file', 'lock');
						} else {
							extraClass.push('ext', this.rdo.attributes.extension);
						}
					}
					return cssClass + ' ' + extraClass.join('_');
				}, this);

				this.open = function() {
					var koItem = this;
					if(config.options.quickSelect && koItem.rdo.type === 'file' && has_capability(koItem.rdo, 'select')) {
						selectItem(koItem.rdo);
					} else {
						getDetailView(koItem.rdo);
					}
				};

				this.remove = function() {
					list.objects.remove(this);
				};
			}
		};

		this.itemsList = new ItemsList();

		var TableView = function() {
			var SortableHeader = function(name) {
				var thead = this;
				this.column = ko.observable(name);
				this.order = ko.observable(model.itemsList.listSortOrder());

				this.sortClass = ko.pureComputed(function() {
					var cssClass;
					if(model.itemsList.listSortField() === thead.column()) {
						cssClass = 'sorted sorted-' + this.order();
					}
					return cssClass;
				}, this);

				this.sort = function() {
					var isAscending = thead.order() === 'asc';
					var isSameColumn = model.itemsList.listSortField() === thead.column();
					thead.order(isSameColumn ? (isAscending ? 'desc' : 'asc') : model.itemsList.listSortOrder());
					model.itemsList.listSortField(thead.column());
					model.itemsList.listSortOrder(thead.order());
					model.itemsList.sortObjects();
				};
			};

			this.thName = new SortableHeader('name');
			this.thType = new SortableHeader('type');
			this.thSize = new SortableHeader('size');
			this.thDimensions = new SortableHeader('dimensions');
			this.thModified = new SortableHeader('modified');
		};

		this.tableView = new TableView();

		var Header = function() {
			this.goHome = function() {
				model.previewFile(false);
				model.loadItems(fileRoot);
			};

			this.goParent = function() {
				// already in root folder
				if(model.currentPath() === fileRoot && !model.previewFile()) {
					return false;
				}

				if(model.previewFile()) {
					model.previewFile(false);
				} else {
					model.loadItems(getParentDirname(fmModel.currentPath()));
				}
			};

			this.displayGrid = function() {
				model.viewMode('grid');
				model.previewFile(false);
			};

			this.displayList = function() {
				model.viewMode('list');
				model.previewFile(false);
			};

			this.createFolder = function() {
				var makeFolder = function(e, ui) {
					var folderName = ui.getInputValue();
					if(!folderName) {
						fm.error(lg.no_foldername);
						return;
					}

					folderName = cleanString(folderName);
					$.ajax({
						type: 'GET',
						url: buildConnectorUrl({
							mode: 'addfolder',
							path: fmModel.currentPath(),
							name: folderName
						}),
						dataType: 'json',
						success: function(response) {
							if (response.data) {
								// handle tree nodes
								var targetNode = fmModel.treeList.findByParam('id', fmModel.currentPath());
								if(targetNode) {
									var newNode = fmModel.treeList.createNode(response.data);
									fmModel.treeList.addNodes(targetNode, newNode);
								}

								// handle view objects
								fmModel.itemsList.addNew(response.data);

								ui.closeDialog();
								if (config.options.showConfirmation) {
									fm.success(lg.successful_added_folder);
								}
							}
							handleAjaxResponseErrors(response);
						},
						error: handleAjaxError
					});
				};

				fm.prompt({
					message: lg.prompt_foldername,
					value: lg.default_foldername,
					okBtn: {
						label: lg.create_folder,
						autoClose: false,
						click: makeFolder
					},
					cancelBtn: {
						label: lg.cancel
					}
				});
			};
		};

		this.header = new Header();

		var Summary = function() {
			this.files = ko.observable(null);
			this.folders = ko.observable(null);
			this.size = ko.observable(null);
			this.enabled = ko.observable(false);

			this.doSummarize = function() {
				summarizeItems();
			};
		};

		this.summary = new Summary();
	};

	var sortItems = function(items) {
		var sortOrder = (fmModel.viewMode() === 'list') ? fmModel.itemsList.listSortOrder() : configSortOrder;
		var sortParams = {
			natural: true,
			order: sortOrder === 'asc' ? 1 : -1,
			cases: false
		};

		items.sort(function(a, b) {
			if(a.rdo.type === 'parent' || b.rdo.type === 'parent') {
				return -1;
			}

			var sortReturnNumber,
				aa = getSortSubject(a),
				bb = getSortSubject(b);

			if (aa === bb) {
				sortReturnNumber = 0;
			} else {
				if (aa === undefined || bb === undefined) {
					sortReturnNumber = 0;
				} else {
					if(!sortParams.natural || (!isNaN(aa) && !isNaN(bb))) {
						sortReturnNumber = aa < bb ? -1 : (aa > bb ? 1 : 0);
					} else {
						sortReturnNumber = naturalCompare(aa, bb);
					}
				}
			}
			// lastly assign asc/desc
			sortReturnNumber *= sortParams.order;
			return sortReturnNumber;
		});

		/**
		 * Get the string/number to be sorted by checking the array value with the criterium.
		 * @item KO or treeNode object
		 */
		function getSortSubject(item) {
			var sortBy,
				sortField = configSortField;

			if(fmModel.viewMode() === 'list') {
				sortField = fmModel.itemsList.listSortField();
			}

			switch(sortField) {
				case 'type':
					sortBy = item.rdo.attributes.extension || '';
					break;
				case 'size':
					sortBy = item.rdo.attributes.size;
					break;
				case 'modified':
					sortBy = item.rdo.attributes.timestamp;
					break;
				case 'dimensions':
					sortBy = item.cdo.dimensions || '';
					break;
				default:
					sortBy = item.rdo.attributes.name;
			}

			// strings should be ordered in lowercase (unless specified)
			if (typeof sortBy === "string") {
				if (!sortParams.cases) {
					sortBy = sortBy.toLowerCase();
				}
				// spaces/newlines
				sortBy = sortBy.replace(/\s+/g, ' ');
			}
			return sortBy;
		}

		/**
		 * Compare strings using natural sort order
		 * http://web.archive.org/web/20130826203933/http://my.opera.com/GreyWyvern/blog/show.dml/1671288
		 */
		function naturalCompare(a, b) {
			var aa = chunkify(a.toString()),
				bb = chunkify(b.toString());
			for (var x = 0; aa[x] && bb[x]; x++) {
				if (aa[x] !== bb[x]) {
					var c = Number(aa[x]),
						d = Number(bb[x]);
					if (c == aa[x] && d == bb[x]) {
						return c - d;
					} else {
						return aa[x] > bb[x] ? 1 : -1;
					}
				}
			}
			return aa.length - bb.length;
		}

		/**
		 * Split a string into an array by type: numeral or string
		 */
		function chunkify(t) {
			var tz = [], x = 0, y = -1, n = 0, i, j;
			while (i = (j = t.charAt(x++)).charCodeAt(0)) {
				var m = (i == 46 || (i >=48 && i <= 57));
				if (m !== n) {
					tz[++y] = '';
					n = m;
				}
				tz[y] += j;
			}
			return tz;
		}

		// handle folders position
		var folderItems = [];
		var i = items.length;
		while(i--) {
			if(items[i].rdo.type === 'folder') {
				folderItems.push(items[i]);
				items.splice(i, 1);
			}
		}
		if(config.options.folderPosition !== 'top') {
			folderItems.reverse();
		}
		for(var k = 0, fl = folderItems.length; k < fl; k++) {
			if(config.options.folderPosition === 'top') {
				items.unshift(folderItems[k]);
			} else {
				items.push(folderItems[k]);
			}
		}
		return items;
	};

	// Test if a given url exists
	var file_exists = function(url) {
		return $.ajax({
			type: 'HEAD',
			url: url
		});
	};

	// Retrieves config settings from config files
	var loadConfigFile = function (type) {
		var url = null;
		type = (typeof type === "undefined") ? "user" : type;

		if(type === 'user') {
			if($.urlParam('config') != 0) {
				url = fm.settings.pluginPath + '/scripts/' + $.urlParam('config');
				userconfig = $.urlParam('config');
			} else {
				url = fm.settings.pluginPath + '/scripts/filemanager.config.json';
				userconfig = 'filemanager.config.json';
			}
		} else {
			url = fm.settings.pluginPath + '/scripts/filemanager.config.default.json';
		}

		return $.ajax({
			type: 'GET',
			url: url,
			dataType: "json",
			cache: false,
			error: function(response) {
				fm.error('Given config file (' + url + ') does not exist!');
			}
		});
	};

	// Loads a given css file into header if not already included
	var loadCSS = function(href) {
		href = fm.settings.pluginPath + href;
		// check if already included
		if($.inArray(href, HEAD_included_files) === -1) {
			$("<link>").attr({
				rel:  "stylesheet",
				type: "text/css",
				href: href
			}).appendTo("head");
			HEAD_included_files.push(href);
		}
		return null;
	};

	// Loads a given js file into header if not already included
	var loadJS = function(src) {
		src = fm.settings.pluginPath + src;
		// check if already included
		if($.inArray(src, HEAD_included_files) === -1) {
			$("<script>").attr({
				type: "text/javascript",
				src: src
			}).appendTo("head");
			HEAD_included_files.push(src);
		}
	};

	// Loads a given js template file into header if not already included
	var loadTemplate = function(id, data) {
		return $.ajax({
			type: 'GET',
			url: fm.settings.pluginPath + '/scripts/templates/' + id + '.html',
			error: handleAjaxError
		});
	};

	// Display Min Path
	var displayPath = function (path, reduce) {
		reduce = (typeof reduce === "undefined");

		if (config.options.showFullPath === false) {
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

	// Sanitize and transliterate file/folder name as server side (connector) way
	var cleanString = function(string, allowed) {
		if(config.security.normalizeFilename) {
			// replace chars which are not related to any language
			var replacements = {' ': '_', '\'': '_', '/': '', '\\': ''};
			string = string.replace(/[\s\S]/g, function(c) {return replacements[c] || c});
		}

		// allow only latin alphabet
		if(config.options.charsLatinOnly) {
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
		if(!bytes) return '';
		round = round || false;
		var n = parseFloat(bytes);
		var d = parseFloat(round ? 1000 : 1024);
		var c = 0;
		var u = [lg.bytes, lg.kb, lg.mb, lg.gb];

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

	// Handle ajax request error.
	var handleAjaxError = function(response) {
		if(config.options.logger) {
			console.log(response.responseText || response);
		}
		fm.error(lg.ERROR_SERVER);
		fm.error(response.responseText);
	};

	// Handle ajax json response error.
	var handleAjaxResponseErrors = function(response) {
		if(response.errors) {
			$.each(response.errors, function(i, message) {
				fm.error(message);
			});
		}
	};

	// Test if item has the 'cap' capability
	// 'cap' is one of 'select', 'rename', 'delete', 'download', 'replace', 'move'
	function has_capability(resourceObject, cap) {
		if(capabilities.indexOf(cap) === -1) return false;
		if (resourceObject.type === 'folder' && cap === 'replace') return false;
		if (resourceObject.type === 'folder' && cap === 'select') return false;
		if (resourceObject.type === 'folder' && cap === 'download') {
			return (config.security.allowFolderDownload === true);
		}
		if (typeof(resourceObject.attributes.capabilities) !== "undefined") {
			return $.inArray(cap, resourceObject.attributes.capabilities) > -1
		}
		return true;
	}

	// Test if file is authorized
	var isAuthorizedFile = function(filename) {
		var ext = getExtension(filename);
		// no extension is allowed
		if(ext === '' && config.security.allowNoExtension === true) return true;

		if(config.upload.policy == 'DISALLOW_ALL') {
			if($.inArray(ext, config.upload.restrictions) !== -1) return true;
		}
		if(config.upload.policy == 'ALLOW_ALL') {
			if($.inArray(ext, config.upload.restrictions) === -1) return true;
		}
		return false;
	};

	// Test if path is dir
	var isFile = function(path) {
		return path.charAt(path.length - 1) !== '/';
	};

	// Replace all leading or trailing slashes with an empty string
	var trimSlashes = function(string) {
		return string.replace(/^\/+|\/+$/g, '');
	};

	var encodePath = function(path) {
		var parts = [];
		$.each(path.split('/'), function(i, part) {
			parts.push(encodeURIComponent(part));
		});
		return parts.join('/');
	};

	// from http://phpjs.org/functions/basename:360
	var basename = function(path, suffix) {
		var b = path.replace(/^.*[\/\\]/g, '');

		if (typeof(suffix) === 'string' && b.substr(b.length-suffix.length) === suffix) {
			b = b.substr(0, b.length-suffix.length);
		}
		return b;
	};

	// return filename extension
	var getExtension = function(filename) {
		if(filename.split('.').length === 1) {
			return "";
		}
		return filename.split('.').pop().toLowerCase();
	};

	// return filename without extension
	var getFilename = function(filename) {
		if(filename.lastIndexOf('.') !== -1) {
			return filename.substring(0, filename.lastIndexOf('.'));
		} else {
			return filename;
		}
	};

	// return path without filename
	// "/dir/to/" 		  --> "/dir/to/"
	// "/dir/to/file.txt" --> "/dir/to/"
	var getDirname = function(path) {
		if(path.lastIndexOf('/') !== path.length - 1) {
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
		return ($.inArray(getExtension(filename), config.edit.editExt) !== -1);
	};

	// Test if is image file
	var isImageFile = function(filename) {
		return ($.inArray(getExtension(filename), config.images.imagesExt) !== -1);
	};

	// Test if file is supported web video file
	var isVideoFile = function(filename) {
		return ($.inArray(getExtension(filename), config.videos.videosExt) !== -1);
	};

	// Test if file is supported web audio file
	var isAudioFile = function(filename) {
		return ($.inArray(getExtension(filename), config.audios.audiosExt) !== -1);
	};

	// Test if file is pdf file
	var isPdfFile = function(filename) {
		return ($.inArray(getExtension(filename), config.pdfs.pdfsExt) !== -1);
	};

	// Test if file is document file
	var isDocumentFile = function(filename) {
		return ($.inArray(getExtension(filename), config.docs.docsExt) !== -1);
	};

	var buildConnectorUrl = function(params) {
		var defaults = {
			config: userconfig,
			time: new Date().getTime()
		};
		var queryParams = $.extend({}, params || {}, defaults);
		return apiConnector + '?' + $.param(queryParams);
	};

	// Build url to preview files
	var createPreviewUrl = function(resourceObject, encode) {
		encode = encode || false;
		var objectPath = resourceObject.attributes.path;
		if(config.preview.absolutePath && objectPath) {
			if(encode) {
				objectPath = encodePath(objectPath);
			}
			return buildAbsolutePath(objectPath);
		} else {
			return buildConnectorUrl({
				mode: 'readfile',
				path: resourceObject.id
			});
		}
	};

	// Build url to display image or its thumbnail
	var createImageUrl = function(resourceObject, thumbnail) {
		var imagePath;
		var iconsFolderPath = fm.settings.pluginPath + '/' + config.icons.path;

		if(!isFile(resourceObject.id)) {
			imagePath = iconsFolderPath + (resourceObject.attributes.protected == 1 ? 'locked_' : '') + config.icons.folder;
		} else {
			if(resourceObject.attributes.protected == 1) {
				imagePath = iconsFolderPath + 'locked_' + config.icons.default;
			} else {
				var fileType = getExtension(resourceObject.id);
				var isAllowedImage = isImageFile(resourceObject.id);
				var iconFilename = fileType + '.png';
				imagePath = iconsFolderPath + config.icons.default;

				if(!(isAllowedImage && config.images.showThumbs) && fileIcons.indexOf(iconFilename) !== -1) {
					imagePath = iconsFolderPath + iconFilename;
				}
				if(isAllowedImage) {
					if(config.preview.absolutePath && !thumbnail && resourceObject.attributes.path) {
						imagePath = buildAbsolutePath(encodePath(resourceObject.attributes.path));
					} else {
						var queryParams = {path: resourceObject.id};
						if (fileType === 'svg') {
							queryParams.mode = 'readfile';
						} else {
							queryParams.mode = 'getimage';
							if (thumbnail) {
								queryParams.thumbnail = 'true';
							}
						}
						imagePath = buildConnectorUrl(queryParams);
					}
				}
			}
		}
		return imagePath;
	};

	var buildAbsolutePath = function(path) {
		var url = (typeof config.preview.previewUrl === "string") ? config.preview.previewUrl : baseUrl;
		return trimSlashes(url) + path;
	};

	// Returns container for filetree or fileinfo section based on scrollbar plugin state
	var getSectionContainer = function($section) {
		// if scrollbar plugin is enabled
		if (config.customScrollbar.enabled) {
			return $section.find('.mCSB_container');
		} else {
			return $section;
		}
	};

	// Create FileTree and bind events
	var createFileTree = function() {
		fmModel.treeList.loadNodes(null, false);

		return;

		var settings = {
			view: {
				showIcon: true,
				showLine: true,
				dblClickExpand: function(treeId, treeNode) {
					// only expand, prevent collapse
					return treeNode.open === false;
				},
				selectedMulti: false,
				expandSpeed: 300
			},
			edit: {
				drag: {
					autoExpandTrigger: false,
					isCopy: false,
					isMove: true,
					prev: true,
					next: true,
					inner: function (treeId, nodes, targetNode) {
						if (targetNode && targetNode.isParent === false) {
							return false;
						}
						return true;
					}
				},
				enable: true,
				showRemoveBtn: false,
				showRenameBtn: false
			},
			async: {
				enable: true,
				url: function(treeId, treeNode) {
					var queryParams = {
						mode: 'getfolder',
						path: treeNode ? treeNode.id : '/'
					};

					if($.urlParam('type')) {
						queryParams.type = $.urlParam('type');
					}
					return buildConnectorUrl(queryParams);
				},
				type: "get",
				dataType: "json",
				autoParam: ["path"],
				//otherParam: queryParams,
				dataFilter: function(treeId, parentNode, response) {
					var nodes = [];
					if(response.data) {
						$.each(response.data, function (index, item) {
							var node = buildZFileTreeItem(item);
							nodes.push(node);
						});
					}
					return sortItems(nodes);
				}
			},
			callback: {
				onNodeCreated: function (event, treeId, treeNode) {
					var $nodeIcon = $('#' + treeNode.tId + '_ico');
					if (treeNode.protected) {
						var classProtected = treeNode.isParent ? 'directory-locked' : 'file-locked';
						$nodeIcon.addClass(classProtected);
					}
				},
				beforeDblClick: function (treeId, treeNode) {
					return !treeNode.protected;
				},
				onDblClick: function (event, treeId, treeNode) {
					treeObj.reAsyncChildNodes(treeNode, "refresh");
				},
				beforeExpand: function (treeId, treeNode, clickFlag) {
					if(treeNode.protected === true) {
						fm.error(lg.NOT_ALLOWED_SYSTEM);
						return false;
					}
				},
				onExpand: function (event, treeId, treeNode) {

					if (fullexpandedFolder === treeNode.id) {
						fullexpandedFolder = null;
						treeObj.setting.view.expandSpeed = 300;
					}
				},
				onAsyncSuccess: function (event, treeId, treeNode, response) {
					console.log('onAsyncSuccess', event, treeId, treeNode, response);
					if (response.data) {
						fmModel.loadingView(true);
						fmModel.currentPath(treeNode ? treeNode.id : '/');
						fmModel.itemsList.setList(response.data);
					}
					handleAjaxResponseErrors(response);
				},
				beforeDrag: function beforeDrag(treeId, treeNodes) {
					console.log('beforeDrag', treeId, treeNodes);
					// for (var i=0,l=treeNodes.length; i<l; i++) {
					// 	if (treeNodes[i].protected === true) {
					// 		return false;
					// 	}
					// }
					return true;
				},
				beforeDragOpen: function(treeId, treeNode) {
					console.log('beforeDragOpen', treeId, treeNode);
					return !treeNode.protected;
				},
				beforeDrop: function beforeDrop(treeId, treeNodes, targetNode, moveType) {
					console.log('beforeDrop', treeId, treeNodes, moveType);

					for (var i = 0, l = treeNodes.length; i < l; i++) {
						if (treeNodes[i].protected === true) {
							fm.error(lg.NOT_ALLOWED_SYSTEM);
							return false;
						}
					}
					if(targetNode.protected === true) {
						fm.error(lg.NOT_ALLOWED_SYSTEM);
						return false;
					}
					if(targetNode.isParent === false) {
						return false;
					}

					moveItem(treeNodes[0].rdo, targetNode.rdo);

					// prevent trigger "onDrop" callback
					return false;
				},
				onDrop: function (event, treeId, treeNodes, targetNode, moveType) {
					// prevented in "beforeDrop"
				}
			}
		};

		var $treeNode = getSectionContainer($filetree);
		$treeNode.addClass('ztree');
		//var fileTreeId = $treeNode[0].id;
		//var nodes = buildFileZTreeBranch('/');

		treeObj = $.fn.zTree.init($treeNode, settings);

		// apply context menu
		$treeNode.contextMenu({
			selector: 'li a',
			// wrap options with "build" allows to get item element
			build: function ($triggerElement, e) {
				var nodeId = $triggerElement.parent()[0].id;
				var node = treeObj.getNodeByTId(nodeId);

				return {
					appendTo: $container,
					items: getContextMenuItems(node.rdo),
					callback: function (itemKey, opt) {
						setMenus(itemKey, node.id);
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
	var selectItem = function(resourceObject) {
		var url = createPreviewUrl(resourceObject, true);
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

						if(isImageFile(resourceObject.attributes.name)) {
							instance.insert.html('<img src="' + url + '">');
						} else {
							instance.insert.html('<a href="' + url + '">' + resourceObject.attributes.name + '</a>');
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
				if(resourceObject.attributes.width) {
					var p = url;
					var w = resourceObject.attributes.width;
					var h = resourceObject.attributes.height;
					window.opener.SetUrl(p,w,h);
				} else {
					window.opener.SetUrl(url);
				}
			}

			if (window.opener) {
				window.close();
			}
		} else {
			fm.error(lg.fck_select_integration);
		}
	};

	// Renames the current item and returns the new name.
	// Called by clicking the "Rename" button in detail views
	// or choosing the "Rename" contextual menu option in list views.
	var renameItem = function(resourceObject) {
		var doRename = function(e, ui) {
			var oldPath = resourceObject.id;
			var givenName = ui.getInputValue();
			if(!givenName) {
				// TODO: file/folder message depending on file type
				fm.error(lg.new_filename);
				return;
			}

			if (! config.security.allowChangeExtensions) {
				givenName = nameFormat(givenName);
				var suffix = getExtension(resourceObject.attributes.name);
				if(suffix.length > 0) {
					givenName = givenName + '.' + suffix;
				}
			}

			// File only - Check if file extension is allowed
			if (isFile(oldPath) && !isAuthorizedFile(givenName)) {
				var str = '<p>' + lg.INVALID_FILE_TYPE + '</p>';
				if(config.upload.policy == 'DISALLOW_ALL') {
					str += '<p>' + lg.ALLOWED_FILE_TYPE +  config.upload.restrictions.join(', ') + '.</p>';
				}
				if(config.upload.policy == 'ALLOW_ALL') {
					str += '<p>' + lg.DISALLOWED_FILE_TYPE +  config.upload.restrictions.join(', ') + '.</p>';
				}
				$("#filepath").val('');
				fm.error(str);
				return;
			}

			$.ajax({
				type: 'GET',
				url: buildConnectorUrl({
					mode: 'rename',
					old: oldPath,
					new: givenName
				}),
				dataType: 'json',
				success: function(response) {
					if(response.data) {
						var newItem = response.data;

						// handle tree nodes
						var sourceNode = fmModel.treeList.findByParam('id', oldPath);

						if(sourceNode) {
							if(sourceNode.rdo.type === 'folder') {
								sourceNode.nodeTitle(newItem.attributes.name);
								// update object data for the current and all child nodes
								fmModel.treeList.actualizeNodeObject(sourceNode, oldPath, newItem.id);
							}
							if(sourceNode.rdo.type === 'file') {
								var parentNode = sourceNode.parentNode();
								var newNode = fmModel.treeList.createNode(newItem);
								sourceNode.remove();

								if(parentNode) {
									fmModel.treeList.addNodes(parentNode, newNode);
								}
							}
						}

						// handle view objects
						var sourceObject = fmModel.itemsList.findByParam('id', oldPath);
						if(sourceObject) {
							sourceObject.remove();
							fmModel.itemsList.addNew(newItem);
						}
						// ON rename currently open folder
						if(fmModel.currentPath() === oldPath) {
							fmModel.loadItems(newItem.id);
						}

						// ON rename currently previewed file
						if(fmModel.previewFile() && fmModel.previewItem.rdo().id === oldPath) {
							fmModel.previewItem.load(newItem);
						}

						ui.closeDialog();
						if(config.options.showConfirmation) {
							fm.success(lg.successful_rename);
						}
					} else {
						fm.error(result['Error']);
					}
				},
				error: handleAjaxError
			});
		};

		fm.prompt({
			message: lg.new_filename,
			value: config.security.allowChangeExtensions ? resourceObject.attributes.name : getFilename(resourceObject.attributes.name),
			okBtn: {
				label: lg.rename,
				autoClose: false,
				click: doRename
			},
			cancelBtn: {
				label: lg.cancel
			}
		});
	};

	// Replace the current file and keep the same name.
	// Called by clicking the "Replace" button in detail views
	// or choosing the "Replace" contextual menu option in list views.
	var replaceItem = function(resourceObject) {
		var $toolbar = $('#toolbar');
		var $button = $toolbar.find('#replacement');

		if(typeof $toolbar.data('blueimpFileupload') === 'undefined') {
			$toolbar
				.fileupload({
					autoUpload: true,
					dataType: 'json',
					url: buildConnectorUrl(),
					paramName: config.upload.paramName
				})

				.on('fileuploadadd', function(e, data) {
					var file = data.files[0];
					// Check if file extension is matching with the original
					if(getExtension(file.name) != resourceObject.rdo.attributes.extension) {
						fm.error(lg.ERROR_REPLACING_FILE + " ." + resourceObject.rdo.attributes.extension);
						return false;
					}
					data.submit();
				})

				.on('fileuploadsubmit', function(e, data) {
					data.formData = {
						mode: 'replace',
						newfilepath: resourceObject.id
					};
					$uploadButton.addClass('loading').prop('disabled', true);
					$uploadButton.children('span').text(lg.loading_data);
				})

				.on('fileuploadalways', function(e, data) {
					$uploadButton.removeData().removeClass('loading').prop('disabled', false);
					$uploadButton.children('span').text(lg.upload);

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
						fm.error(lg.upload_failed + "<br>" + errorMessage);
					} else {
						// success upload
						var filePath = $fileinfo.find('#main-title > h1').attr('title');
						var currentPath = fmModel.currentPath();

						//getFileInfo(filePath);
						//reloadFileTreeNode(currentPath);

						// Visual effects for user to see action is successful
						$('#preview').find('img').hide().fadeIn('slow'); // on preview panel
						$filetree.find('a[data-path="' + filePath + '"]').parent().hide().fadeIn('slow'); // on fileTree

						if(config.options.showConfirmation) {
							fm.success(lg.successful_replace);
						}
					}
				})

				.on('fileuploadfail', function(e, data) {
					// server error 500, etc.
					fm.error(lg.upload_failed);
				});
		}

		// open the input file dialog window
		$button.click();
	};

	// Move the current item to specified dir and returns the new name.
	// Called by clicking the "Move" button in detail views
	// or choosing the "Move" contextual menu option in list views.
	var moveItemPrompt = function(data) {
		var doMove = function(e, ui) {
			var newPath = ui.getInputValue();
			if(!newPath) {
				fm.error(lg.prompt_foldername);
				return;
			}

			moveItem(data['Path'], newPath);
		};

		fm.prompt({
			message: lg.move,
			value: config.security.allowChangeExtensions ? data['Filename'] : getFilename(data['Filename']),
			okBtn: {
				label: lg.move,
				autoClose: false,
				click: doMove
			},
			cancelBtn: {
				label: lg.cancel
			},
			template: {
				dialogInput:
				'<input data-alertify-input type="text" value="" />' +
				'<div class="prompt-info">' + lg.help_move + '</div>'
			}
		});
	};

	// Move the current item to specified dir and returns the new name.
	// Called by clicking the "Move" button in detail views
	// or choosing the "Move" contextual menu option in list views.
	var moveItem = function(sourceItem, targetItem) {
		console.log('moveItem', sourceItem, targetItem);
		var oldPath = sourceItem.id,
			newPath = targetItem.id;

		$.ajax({
			type: 'GET',
			url: buildConnectorUrl({
				mode: 'move',
				old: oldPath,
				new: newPath
			}),
			dataType: 'json',
			success: function(response) {
				if(response.data) {
					var newItem = response.data;

					// handle tree nodes
					var sourceNode = fmModel.treeList.findByParam('id', sourceItem.id);
					var targetNode = fmModel.treeList.findByParam('id', targetItem.id);

					if(sourceNode) {
						sourceNode.remove();
					}
					if(targetNode) {
						var newNode = fmModel.treeList.createNode(newItem);
						fmModel.treeList.addNodes(targetNode, newNode);
					}

					// handle view objects
					var sourceObject = fmModel.itemsList.findByParam('id', sourceItem.id);
					if(sourceObject) {
						sourceObject.remove();
					}
					// ON move item to the currently open folder
					if(fmModel.currentPath() === targetItem.id) {
						fmModel.itemsList.addNew(newItem);
					}
					// ON move currently open folder to another folder
					if(fmModel.currentPath() === sourceItem.id) {
						fmModel.loadItems(newItem.id);
					}

					// ON move currently previewed file
					if(fmModel.previewFile() && fmModel.previewItem.rdo().id === sourceItem.id) {
						fmModel.previewFile(false);
					}

					alertify.clearDialogs();
					if(config.options.showConfirmation) {
						fm.success(lg.successful_moved);
					}
				}
				handleAjaxResponseErrors(response);
			},
			error: handleAjaxError
		});
	};

	// Prompts for confirmation, then deletes the current item.
	// Called by clicking the "Delete" button in detail views
	// or choosing the "Delete" context menu item in list views.
	var deleteItem = function(resourceObject) {
		console.log('deleteItem', resourceObject);
		var doDelete = function(e, ui) {
			$.ajax({
				type: 'GET',
				url: buildConnectorUrl({
					mode: 'delete',
					path: resourceObject.id
				}),
				dataType: 'json',
				success: function (response) {
					if(response.data) {
						var path = response.data.id;

						// handle tree nodes
						var targetNode = fmModel.treeList.findByParam('id', path);
						if(targetNode) {
							targetNode.remove();
						}

						// handle view objects
						var sourceObject = fmModel.itemsList.findByParam('id', path);
						if(sourceObject) {
							sourceObject.remove();
						}

						// ON delete currently previewed file
						if(fmModel.previewFile() && fmModel.previewItem.rdo().id === path) {
							fmModel.previewFile(false);
						}

						if(config.options.showConfirmation) {
							fm.success(lg.successful_delete);
						}
					}
					handleAjaxResponseErrors(response);
				},
				error: handleAjaxError
			});
		};

		fm.confirm({
			message: lg.confirmation_delete,
			okBtn: {
				label: lg.yes,
				click: doDelete
			},
			cancelBtn: {
				label: lg.no
			}
		});
	};

	// Starts file download process.
	// Called by clicking the "Download" button in detail views
	// or choosing the "Download" contextual menu item in list views.
	var downloadItem = function(resourceObject) {
		var queryParams = {
			mode: 'download',
			path: resourceObject.id
		};

		$.ajax({
			type: 'GET',
			url: buildConnectorUrl(queryParams),
			dataType: 'json',
			success: function (response) {
				if(response.data.attributes.success) {
					window.location = buildConnectorUrl(queryParams);
				}
				handleAjaxResponseErrors(response);
			},
			error: handleAjaxError
		});
	};

	// Creates CodeMirror instance to let user change the content of the file
	var editItem = function(resourceObject) {
		$.ajax({
			type: 'GET',
			url: buildConnectorUrl({
				mode: 'editfile',
				path: resourceObject.id
			}),
			dataType: 'json',
			success: function (response) {
				if(response.data) {
					fmModel.previewItem.editor.enabled(true);
					fmModel.previewItem.editor.content(response.data.attributes.content);
					// instantiate codeMirror according to config options
					var codeMirrorInstance = instantiateCodeMirror(getExtension(resourceObject.id), config, loadJS);
					fmModel.previewItem.editor.codeMirror(codeMirrorInstance);
				}
				handleAjaxResponseErrors(response);
			},
			error: handleAjaxError
		});
	};

	// Save CodeMirror editor content to file
	var saveItem = function(resourceObject) {
		var newValue = fmModel.previewItem.editor.codeMirror().getValue();
		fmModel.previewItem.editor.content(newValue);

		$.ajax({
			type: 'POST',
			url: buildConnectorUrl(),
			dataType: 'json',
			data: $('#edit-form').serializeArray(),
			success: function (response) {
				if(response.data) {
					fmModel.previewItem.editor.enabled(false);
					fm.success(lg.successful_edit);
				}
				handleAjaxResponseErrors(response);
			},
			error: handleAjaxError
		});
	};

	// Display storage summary info
	var summarizeItems = function() {
		$.ajax({
			type: 'GET',
			url: buildConnectorUrl({
				mode: 'summarize'
			}),
			dataType: "json",
			success: function (response) {
				if(response.data) {
					var data = response.data.attributes,
						size = formatBytes(data.size, true);

					if(data.sizeLimit > 0) {
						var sizeTotal = formatBytes(data.sizeLimit, true);
						var ratio = data.size * 100 / data.sizeLimit;
						var percentage = Math.round(ratio * 100) / 100;
						size += ' (' + percentage + '%) ' + lg.of + ' ' + sizeTotal;
					}

					fmModel.summary.files(data.files);
					fmModel.summary.folders(data.folders);
					fmModel.summary.size(size);

					fmModel.summary.enabled(true);
					var $content = $('#summary-popup').clone().show();
					fmModel.summary.enabled(false);

					fm.alert($content[0].outerHTML);
				}
				handleAjaxResponseErrors(response);
			},
			error: handleAjaxError
		});
	};


	/*---------------------------------------------------------
	 Functions to Retrieve File and Folder Details
	 ---------------------------------------------------------*/

	// Retrieves file or folder info based on the path provided.
	var getDetailView = function(resourceObject) {
		if(resourceObject.attributes.protected) {
			fm.error(lg.NOT_ALLOWED_SYSTEM);
			return false;
		}
		if(resourceObject.type === 'file') {
			fmModel.previewItem.load(resourceObject);
		}
		if(resourceObject.type === 'folder' || resourceObject.type === 'parent') {
			fmModel.loadItems(resourceObject.id);
		}
	};

	// Options for context menu plugin
	function getContextMenuItems(resourceObject) {
		var contextMenuItems = {
			select: {name: lg.select, className: 'select'},
			download: {name: lg.download, className: 'download'},
			rename: {name: lg.rename, className: 'rename'},
			move: {name: lg.move, className: 'move'},
			replace: {name: lg.replace, className: 'replace'},
			separator1: "-----",
			delete: {name: lg.del, className: 'delete'}
		};

		if(!has_capability(resourceObject, 'download')) delete contextMenuItems.download;
		if(!has_capability(resourceObject, 'rename') || config.options.browseOnly === true) delete contextMenuItems.rename;
		if(!has_capability(resourceObject, 'delete') || config.options.browseOnly === true) delete contextMenuItems.delete;
		if(!has_capability(resourceObject, 'move') || config.options.browseOnly === true) delete contextMenuItems.move;
		// remove 'select' if there is no window.opener
		if(!has_capability(resourceObject, 'select') || !(window.opener || window.tinyMCEPopup || $.urlParam('field_name'))) delete contextMenuItems.select;
		// remove 'replace' since it is implemented on #preview panel only (for FF and Chrome, need to check in Opera)
		delete contextMenuItems.replace;

		return contextMenuItems
	}

	// Binds contextual menu to items in list and grid views.
	var performAction = function(action, resourceObject) {
		switch(action) {
			case 'select':
				selectItem(resourceObject);
				break;

			case 'download':
				downloadItem(resourceObject);
				break;

			case 'rename':
				renameItem(resourceObject);
				break;

			case 'replace':
				replaceItem(resourceObject);
				break;

			case 'move':
				moveItemPrompt(resourceObject);
				break;

			case 'delete':
				deleteItem(resourceObject);
				break;
		}
	};

	// Handling file uploads
	var setupUploader = function() {
		if(config.options.browseOnly) {
			return false;
		}

		// Multiple Uploads
		if(config.upload.multiple) {
			// remove simple file upload element
			$('#file-input-container').remove();

			$uploadButton.unbind().click(function() {
				if(capabilities.indexOf('upload') === -1) {
					fm.error(lg.NOT_ALLOWED);
					return false;
				}

				var allowedFileTypes = null,
					currentPath = fmModel.currentPath(),
					templateContainer = tmpl('tmpl-fileupload-container', {
						folder: lg.current_folder + currentPath,
						info: lg.upload_files_number_limit.replace('%s', config.upload.numberOfFiles) + ' ' + lg.upload_file_size_limit + formatBytes(config.upload.fileSizeLimit, true),
						lang: lg
					});

				if(config.upload.policy == 'DISALLOW_ALL') {
					allowedFileTypes = new RegExp('(\\.|\\/)(' + config.upload.restrictions.join('|') + ')$', 'i');
				}

				fm.dialog({
					message: templateContainer,
					width: 'auto',
					buttons: [{
						type: "ok",
						label: lg.upload,
						autoClose: false,
						click: function(e, ui) {
							if($dropzone.children('.upload-item').length > 0) {
								$dropzone.find('.button-start').trigger('click');
							} else {
								fm.error(lg.upload_choose_file);
							}
						}
					},{
						label: lg.select,
						closeOnClick: false,
						click: function(e, ui) {
							$('#fileupload', $uploadContainer).trigger('click');
						}
					},{
						type: "cancel",
						label: lg.close
					}]
				});

				var $uploadContainer = $('.fm-fileupload-container'),
					$dropzone = $('.dropzone', $uploadContainer),
					$dropzoneWrapper = $('.dropzone-wrapper', $uploadContainer),
					$totalProgressBar = $('#total-progress', $uploadContainer).children();

				if(config.customScrollbar.enabled) {
					$dropzoneWrapper.mCustomScrollbar({
						theme: config.customScrollbar.theme,
						scrollButtons: {
							enable: config.customScrollbar.button
						},
						advanced: {
							autoExpandHorizontalScroll: true,
							updateOnContentResize: true
						},
						callbacks: {
							onOverflowY: function() {
								$dropzoneWrapper.find('.mCSB_container').css({
									'margin-right': $dropzoneWrapper.find('.mCSB_scrollTools').width()
								});
							},
							onOverflowYNone: function() {
								$dropzoneWrapper.find('.mCSB_container').css({
									'margin-right': 'auto'
								});
							}
						},
						axis: "y"
					});
				}

				$dropzoneWrapper.on("click", function(e) {
					if(e.target === this || $(e.target).parent()[0] === this || e.target === $dropzone[0] || $(e.target).parent().hasClass('default-message')) {
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
					$node.find('.error-message').text(lg.upload_aborted);
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
						$.ajax({
							type: 'GET',
							url: buildConnectorUrl({
								mode: 'getfile',
								path: currentPath + file.serverName
							}),
							dataType: "json",
							success: function (response) {
								if(response.data) {
									data.uploadedBytes = Number(response.data.attributes.size);
									if(!data.uploadedBytes) {
										file.chunkUploaded = undefined;
									}
								}
								handleAjaxResponseErrors(response);
							},
							error: handleAjaxError
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
						$.ajax({
							type: 'GET',
							url: buildConnectorUrl({
								mode: 'delete',
								path: currentPath + file.serverName
							}),
							dataType: "json",
							success: function (response) {
								if(response.data) {
									data.uploadedBytes = Number(response.data.attributes.size);
									if(!data.uploadedBytes) {
										file.chunkUploaded = undefined;
									}
								}
								handleAjaxResponseErrors(response);
							},
							error: handleAjaxError
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
						fm.error($message.text());
					}
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
						maxChunkSize: config.upload.chunkSize,
						url: buildConnectorUrl(),
						paramName: config.upload.paramName,
						formData: {
							mode: 'upload',
							currentpath: currentPath
						},
						// validation
						// maxNumberOfFiles works only for single "add" call when "singleFileUploads" is set to "false"
						maxNumberOfFiles: config.upload.numberOfFiles,
						acceptFileTypes: allowedFileTypes,
						maxFileSize: config.upload.fileSizeLimit,
						messages: {
							maxNumberOfFiles: lg.upload_files_number_limit.replace("%s", config.upload.numberOfFiles),
							acceptFileTypes: lg.upload_file_type_invalid,
							maxFileSize: lg.upload_file_too_big + ' ' + lg.upload_file_size_limit + formatBytes(config.upload.fileSizeLimit, true)
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
							if($items.length >= config.upload.numberOfFiles) {
								fm.error(lg.upload_files_number_limit.replace("%s", config.upload.numberOfFiles), {
									logClass: 'fileuploadadd',
									unique: true
								});
								return false;
							}
							// to display in item template
							file.formattedSize = formatBytes(file.size);
							var $template = $(tmpl('tmpl-upload-item', {
								file: file,
								lang: lg,
								imagesPath: fm.settings.pluginPath + '/scripts/jQuery-File-Upload/img'
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
						console.log('fileuploadfail', data);
						$.each(data.files, function (index, file) {
							file.error = lg.upload_failed;
							var $node = file.context;
							$node.removeClass('added process').addClass('error');
						});
					})

					.on('fileuploaddone', function(e, data) {
						console.log('fileuploaddone', data);
						$.each(data.files, function (index, file) {
							var errorMessage,
								result = data.result,
								$node = file.context;

							// error from upload handler
							if(result.files && result.files[index].error) {
								errorMessage = result.files[index].error;
							}
							// error from filemanager (common for all files)
							console.log('result', result);
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
								alertify.clearDialogs();

								if (config.options.showConfirmation) {
									fm.success(lg.upload_successful_files);
								}
							}
							// errors occurred
							if($items.filter('.error').length) {
								fm.error(lg.upload_partially + "<br>" + lg.upload_failed_details);
							}
							console.log('fileuploadalways');
							//getFolderInfo(currentPath);
							//reloadFileTreeNode(currentPath);
						}
						updateDropzoneView();
					})

					.on('fileuploadprocessalways', function(e, data) {
						$.each(data.files, function (index, file) {
							var $node = file.context;
							// file wasn't added to queue (due to config.upload.numberOfFiles limit e.g.)
							if(typeof $node === 'undefined') {
								return;
							}
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
				if(capabilities.indexOf('upload') === -1) {
					fm.error(lg.NOT_ALLOWED);
					return false;
				}

				var data = $(this).data();
				if($.isEmptyObject(data)) {
					fm.error(lg.upload_choose_file);
				} else {
					data.submit();
				}
			});

			$uploader
				.fileupload({
					autoUpload: false,
					dataType: 'json',
					url: buildConnectorUrl(),
					paramName: config.upload.paramName
				})

				.on('fileuploadadd', function(e, data) {
					$uploadButton.data(data);
				})

				.on('fileuploadsubmit', function(e, data) {
					data.formData = {
						mode: 'upload',
						currentpath: fmModel.currentPath()
					};
					$uploadButton.addClass('loading').prop('disabled', true);
					$uploadButton.children('span').text(lg.loading_data);
				})

				.on('fileuploadalways', function(e, data) {
					$("#filepath").val('');
					$uploadButton.removeData().removeClass('loading').prop('disabled', false);
					$uploadButton.children('span').text(lg.upload);

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
						fm.error(lg.upload_failed + "<br>" + errorMessage);
					} else {
						// success upload
						var currentPath = fmModel.currentPath();
						// getFolderInfo(currentPath);
						// reloadFileTreeNode(currentPath);

						if(config.options.showConfirmation) {
							fm.success(lg.upload_successful_file);
						}
					}
				})

				.on('fileuploadfail', function(e, data) {
					// server error 500, etc.
					fm.error(lg.upload_failed);
				});
		}
	};

	// call the "constructor" method
	construct();

	$(window).resize(fm.setDimensions);
};
})(jQuery);

// add the plugin to the jQuery.fn object
$.fn.richFm = function(options) {

	// iterate through the DOM elements we are attaching the plugin to
	return this.each(function() {

		// if plugin has not already been attached to the element
		if (undefined == $(this).data('richFm')) {

			/**
			 * Creates a new instance of the plugin
			 * Pass the DOM element and the user-provided options as arguments
			 */
			var plugin = new $.richFmPlugin(this, options);

			/**
			 * Store a reference to the plugin object
			 * The plugin are available like:
			 * - element.data('richFm').publicMethod(arg1, arg2, ... argn);  for methods
			 * - element.data('richFm').settings.propertyName;  for properties
			 */
			$(this).data('richFm', plugin);
		}
	});
};

// add location.origin for IE
if (!window.location.origin) {
	window.location.origin = window.location.protocol + "//"
		+ window.location.hostname
		+ (window.location.port ? ':' + window.location.port : '');
}

$(window).load(function() {
	$('.fm-container').richFm();
});