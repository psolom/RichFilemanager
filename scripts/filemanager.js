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

$.richFilemanagerPlugin = function(element, pluginOptions)
{
	/**
	 * Plugin's default options
	 */
	var defaults = {
		baseUrl: '.',	// relative path to the FM plugin folder
		config: {},		// configuration options
        callbacks: {
            beforeCreateImageUrl: function (resourceObject, url) {
                return url;
            },
            beforeCreatePreviewUrl: function (resourceObject, url) {
                return url;
            },
			beforeSelectItem: function (resourceObject, url) {
				return url;
			},
			afterSelectItem: function (resourceObject, url) {}
		}
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
		$viewItems = $fileinfo.find('.view-items'),
		$uploadButton = $uploader.children('.fm-upload'),

		config = null,				// configuration options
		lg = null,					// localized messages
		fileRoot = '/',				// relative files root, may be changed with some query params
		apiConnector = null,		// API connector URL to perform requests to server
		capabilities = [],			// allowed actions to perform in FM
		configSortField = null,		// items sort field name
		configSortOrder = null,		// items sort order 'asc'/'desc'
		fmModel = null,				// filemanager knockoutJS model

		/** variables to keep request options data **/
		fullexpandedFolder = null,	// path to be automatically expanded by filetree plugin

		/** service variables **/
		timeStart = new Date().getTime();

	/**
	 * This holds the merged default and user-provided options.
	 * Plugin's properties will be available through this object like:
	 * - fm.propertyName from inside the plugin
	 * - element.data('richFilemanager').propertyName from outside the plugin, where "element" is the element the plugin is attached to;
	 * @type {{}}
	 */

	// The plugin's final settings, contains the merged default and user-provided options (if any)
    fm.settings = $.extend(true, defaults, pluginOptions);


	/*--------------------------------------------------------------------------------------------------------------
	 Public methods
	 Can be called like:
	 - fm.methodName(arg1, arg2, ... argn) from inside the plugin
	 - element.data('richFilemanager').publicMethod(arg1, arg2, ... argn) from outside the plugin,
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

	fm.success = function(message, options) {
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
		var deferred = $.Deferred();

		deferred
			.then(function() {
				return configure();
			})
			.then(function(conf_d, conf_u) {
				return performInitialRequest();
			})
			.then(function() {
				return localize();
			})
			.then(function() {
				return includeTemplates();
			})
			.then(function() {
				includeAssets(function() {
                    initialize();
				});
			});

		deferred.resolve();
	};

	var configure = function() {
		return $.when(loadConfigFile('default'), loadConfigFile('user')).done(function(confd, confu) {
			var config_default = confd[0];
			var config_user = confu[0];

			// remove version from user config file
			if (config_user !== undefined && config_user !== null) {
				delete config_user.version;
			}
			// merge default config and user config file
			config = $.extend({}, config_default, config_user);

			// setup apiConnector
			if(config.api.connectorUrl) {
				apiConnector = config.api.connectorUrl;
			} else {
				var connectorUrl = location.origin + location.pathname;
				var langConnector = 'connectors/' + config.api.lang + '/filemanager.' + config.api.lang;

				// for url like http://site.com/index.html
				if(getExtension(connectorUrl).length > 0) {
					connectorUrl = connectorUrl.substring(0, connectorUrl.lastIndexOf('/') + 1);
				}
				apiConnector = connectorUrl + langConnector;
			}
		});
	};

	// performs initial request to server to retrieve initial params
	var performInitialRequest = function() {
        return $.ajax({
            type: 'GET',
            url: buildConnectorUrl({
                mode: 'initiate'
            }),
            dataType: 'json'
        }).done(function(response) {
            if(response.data) {
                var serverConfig = response.data.attributes.config;
                // override configuration with options retrieved from the server (which are common)
                $.each(serverConfig, function(section, options) {
                    $.each(options, function(param, value) {
                        if(config[section] !== "undefined" && config[section][param] !== "undefined") {
                            config[section][param] = value;
                        }
                    });
                });
            }
            handleAjaxResponseErrors(response);
        }).fail(function() {
            fm.error('Unable to perform initial request to server.');
        }).then(function (response) {
			if(response.errors) {
				return $.Deferred().reject();
			}
		});
	};

	// localize messages based on culture var or from URL
	var localize = function() {
		var langCode = $.urlParam('langCode');
		var langPath = fm.settings.baseUrl + '/languages/';

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

	var includeTemplates = function() {
		return $.when(loadTemplate('upload-container'), loadTemplate('upload-item')).done(function(uc, ui) {
			var tmpl_upload_container = uc[0];
			var tmpl_upload_item = ui[0];

			$wrapper
				.append(tmpl_upload_container)
				.append(tmpl_upload_item);
		});
	};

	var includeAssets = function(callback) {
		var primary = [],
        	secondary = [];

        // theme defined in configuration file
        primary.push('/themes/' + config.options.theme + '/styles/theme.css');

        if(config.customScrollbar.enabled) {
            primary.push('/scripts/custom-scrollbar-plugin/jquery.mCustomScrollbar.min.css');
            primary.push('/scripts/custom-scrollbar-plugin/jquery.mCustomScrollbar.concat.min.js');
        }

        // add callback on loaded assets and inject primary ones
        primary.push(callback);
        loadAssets(primary);

		// Loading CodeMirror if enabled for online edition
		if(config.viewer.editable.enabled) {
			var editorTheme = config.viewer.editable.theme;
            if (editorTheme && editorTheme !== 'default') {
                secondary.push('/scripts/CodeMirror/theme/' + editorTheme + '.css');
            }
            secondary.push('/scripts/CodeMirror/lib/codemirror.css');
            secondary.push('/scripts/CodeMirror/lib/codemirror.js');
            secondary.push('/scripts/CodeMirror/addon/selection/active-line.js');
            secondary.push('/scripts/CodeMirror/addon/display/fullscreen.css');
            secondary.push('/scripts/CodeMirror/addon/display/fullscreen.js');
		}

		if(!config.options.browseOnly) {
			// Loading jquery file upload library
            secondary.push('/scripts/jQuery-File-Upload/js/vendor/jquery.ui.widget.js');
            secondary.push('/scripts/jQuery-File-Upload/js/canvas-to-blob.min.js');
            secondary.push('/scripts/jQuery-File-Upload/js/load-image.all.min.js');
            secondary.push('/scripts/jQuery-File-Upload/js/jquery.iframe-transport.js');
            secondary.push('/scripts/jQuery-File-Upload/js/jquery.fileupload.js');
            secondary.push('/scripts/jQuery-File-Upload/js/jquery.fileupload-process.js');
            secondary.push('/scripts/jQuery-File-Upload/js/jquery.fileupload-image.js');
            secondary.push('/scripts/jQuery-File-Upload/js/jquery.fileupload-validate.js');

			if(config.upload.multiple) {
                secondary.push('/scripts/jQuery-File-Upload/css/dropzone.css');
			}
		}

		if(config.options.charsLatinOnly) {
            secondary.push('/scripts/speakingurl/speakingurl.min.js');
		}

		if(secondary.length) {
            loadAssets(secondary);
		}
	};

	var initialize = function () {
		// reads capabilities from config files if exists else apply default settings
		capabilities = config.options.capabilities || ['upload', 'select', 'download', 'rename', 'copy', 'move', 'delete', 'replace'];

		// defines sort params
		var chunks = [];
		if(config.options.fileSorting) {
			chunks = config.options.fileSorting.toLowerCase().split('_');
		}

		configSortField = chunks[0] || 'name';
		configSortOrder = chunks[1] || 'asc';

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

		// Activates knockout.js
		fmModel = new FmModel();
		ko.applyBindings(fmModel);

		ko.bindingHandlers.toggleNodeVisibility = {
			init: function (element, valueAccessor) {
				var node = valueAccessor();
				$(element).toggle(node.isExpanded());
			},
			update: function (element, valueAccessor) {
				var node = valueAccessor();
				if(node.isSliding() === false) {
					return false;
				}
				if(node.isExpanded() === false) {
					$(element).slideDown(fmModel.treeModel.options.expandSpeed, function() {
						node.isSliding(false);
						node.isExpanded(true);
					});
				}
				if(node.isExpanded() === true) {
					$(element).slideUp(fmModel.treeModel.options.expandSpeed, function() {
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
							var $cloned,
								selectedItems = fmModel.itemsModel.getSelected(),
								helperClass = 'drag-helper-' + fmModel.viewMode(),
								$wrapper = $('<div>', {class: helperClass});

							if(selectedItems.length > 1) {
								$cloned = $('#drag-helper-' + fmModel.viewMode() + '-template').clone();
							} else {
								$cloned = $(this).clone();
							}

							return $wrapper.append($cloned.html());
						},
						appendTo: config.customScrollbar.enabled ? $fileinfo.find('.mCustomScrollBox') : $fileinfo,
						start: function(event, ui) {
							if(!koItem.selected()) {
								fmModel.itemsModel.unselectItems(false);
								koItem.selected(true);
							}
						},
						drag: function(event, ui) {
							$(this).draggable('option', 'refreshPositions', fmModel.itemsModel.isScrolling());
						}
					});
				}
			}
		};

		ko.bindingHandlers.droppableView = {
			init: function(element, valueAccessor, allBindingsAccessor) {

				// check whether draggable items can be accepted by target item
				function isDropAllowed(targetItem, draggableItems) {
					var matches = $.grep(draggableItems, function(itemObject, i) {
						return (itemObject.id === targetItem.id);
					});
					// prevent on moving (to) protect folder or to the one of selected items
					return (targetItem.rdo.attributes.writable && matches.length === 0);
				}

				if(valueAccessor().rdo.type === "folder" || valueAccessor().rdo.type === "parent") {
					$(element).droppable({
						enableExtendedEvents: true,
						//hoverClass: "drop-hover",
						accept: function($draggable) {
							var koItem = ko.dataFor($draggable[0]),
								type = koItem ? koItem.rdo.type : null;
							return (type === "file" || type === "folder");
						},
						over: function(event, ui) {
							var targetItem = ko.dataFor(event.target),
								draggableItems = fmModel.itemsModel.getSelected();

							if(isDropAllowed(targetItem, draggableItems)) {
								$(this).addClass('drop-hover');
							} else {
								ui.helper.addClass('drop-restricted');
							}
						},
						out: function(event, ui) {
							$(this).removeClass('drop-hover');
							ui.helper.removeClass('drop-restricted');
						},
						drop: function(event, ui) {
							var targetItem = ko.dataFor(event.target),
								draggableItems = fmModel.itemsModel.getSelected();

							$(event.target).removeClass('drop-hover');

							if(!isDropAllowed(targetItem, draggableItems)) {
								return false;
							}

							processMultipleActions(draggableItems, function(i, itemObject) {
								return moveItem(itemObject.rdo, targetItem.id);
							});
						}
					});
				}
			}
		};

		$viewItems.selectable({
            filter: "li:not(.directory-parent), tr:not(.directory-parent)",
            cancel: ".directory-parent",
            disabled: !config.manager.selection.enabled,
            appendTo: '.fm-container',
			start: function(event, ui) {
				clearSelection();
			},
			selected: function(event, ui) {
				var koItem = ko.dataFor(ui.selected);
				koItem.selected(true);
			},
			unselected: function(event, ui) {
				var koItem = ko.dataFor(ui.unselected);
				koItem.selected(false);
			}
        });

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
						drag: function(event, ui) {
							$(this).draggable('option', 'refreshPositions', fmModel.treeModel.isScrolling());
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
							moveItem(ko.dataFor(ui.draggable[0]), ko.dataFor(event.target).id);
						}
					});
				}
			}
		};

        $fileinfo.contextMenu({
            selector: '.view-items',
            zIndex: 10,
            // wrap options with "build" allows to get item element
            build: function ($triggerElement, e) {
                var contextMenuItems = {
                    createFolder: {
                    	name: lg.create_folder,
						className: 'create-folder'
                    },
                    paste: {
                    	name: lg.clipboard_paste,
						className: 'paste',
                        disabled: function (key, options) {
							return fmModel.clipboardModel.isEmpty();
                        }
                    }
                };

                if (!fmModel.clipboardModel.enabled() || config.options.browseOnly === true ) {
                    delete contextMenuItems.paste;
                }

                return {
                    appendTo: '.fm-container',
                    items: contextMenuItems,
					reposition: false,
                    callback: function(itemKey, options) {
                        switch(itemKey) {
                            case 'createFolder':
                                fmModel.headerModel.createFolder();
                                break;

                            case 'paste':
                                fmModel.clipboardModel.paste();
                                break;
                        }
                    }
                }
            }
        });

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

		// adding a close button triggering callback function if CKEditorCleanUpFuncNum passed
		if($.urlParam('CKEditorCleanUpFuncNum')) {
			$("body").append('<button id="fm-js-btn-close" type="button">' + lg.close + '</button>');

			$('#fm-js-btn-close').click(function () {
				parent.CKEDITOR.tools.callFunction($.urlParam('CKEditorCleanUpFuncNum'));
			});
		}

		// input file replacement
		$("#newfile").change(function() {
			$("#filepath").val($(this).val().replace(/.+[\\\/]/, ""));
		});

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
						fmModel.treeModel.isScrolling(true);
					},
					onScroll: function() {
						fmModel.treeModel.isScrolling(false);
					}
				},
				axis: "yx"
			});

            $viewItems.mCustomScrollbar({
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
						fmModel.itemsModel.isScrolling(true);
					},
					onScroll: function() {
						fmModel.itemsModel.isScrolling(false);
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

		// Provides support for adjustible columns.
		$splitter.splitter({
			sizeLeft: config.options.splitterWidth,
			minLeft: config.options.splitterMinWidth,
			minRight: 200
		});

		var $loading = $container.find('.fm-loading-wrap');
		$loading.fadeOut(800); // remove loading screen div
		$(window).trigger('resize');

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
        this.localizeGUI = ko.observable(config.options.localizeGUI);
		this.loadingView = ko.observable(true);
		this.previewFile = ko.observable(false);
		this.viewMode = ko.observable(config.options.defaultViewMode);
		this.currentPath = ko.observable(fileRoot);
		this.browseOnly = ko.observable(config.options.browseOnly);

        this.previewFile.subscribe(function (value) {
            if (!value) {
            	// close editor upon disabling preview
                model.previewModel.closeEditor();
			}
        });

		this.addItem = function(resourceObject, targetPath) {
			// handle tree nodes
			var targetNode = fmModel.treeModel.findByParam('id', targetPath);
			if(targetNode) {
				var newNode = fmModel.treeModel.createNode(resourceObject);
				fmModel.treeModel.addNodes(targetNode, newNode);
			}

			// handle view objects
			if(fmModel.currentPath() === targetPath) {
				fmModel.itemsModel.addNew(resourceObject);
			}
		};

		this.removeItem = function(resourceObject) {
			// handle tree nodes
			var treeNode = fmModel.treeModel.findByParam('id', resourceObject.id);
			if(treeNode) {
				treeNode.remove();
			}

			// handle view objects
			var viewItem = fmModel.itemsModel.findByParam('id', resourceObject.id);
			if(viewItem) {
				viewItem.remove();
			}
		};

		var SearchModel = function() {
			var search_model = this;
			this.value = ko.observable('');

			this.findAll = function(data, event) {
				var delay = 200,
					insensitive = true;

				search_model.value(event.target.value);

				delayCallback(function(){
					var searchString = insensitive ? search_model.value().toLowerCase() : search_model.value();

					$.each(model.itemsModel.objects(), function(i, itemObject) {
                        if(itemObject.rdo.type === 'parent') {
                            return;
                        }
						var itemName = itemObject.rdo.attributes.name;
						if(insensitive) {
							itemName = itemName.toLowerCase();
						}
						var visibility = (itemName.indexOf(searchString) === 0);
						itemObject.visible(visibility)
					});
				}, delay);
			};

			this.reset = function(data, event) {
				search_model.value('');
				$.each(model.itemsModel.objects(), function(i, itemObject) {
					itemObject.visible(true);
				});
			};
		};

		var PreviewModel = function() {
			var preview_item = this;

			this.rdo = {};
			this.cdo = {};
			this.viewer = ko.observable({});
			this.editor = {
				enabled: ko.observable(false),
				content: ko.observable(''),
				codeMirror: ko.observable(null)
			};

			// fires specific action by clicking toolbar buttons in detail view
			this.bindToolbar = function(action) {
				if (has_capability(preview_item.rdo, action)) {
					performAction(action, preview_item.rdo);
				}
			};

			this.load = function(resourceObject) {
				model.previewFile(false);
				preview_item.rdo = resourceObject; // original resource data object
				preview_item.cdo = { // computed data object
					isFolder: (resourceObject.type === 'folder'),
					sizeFormatted: formatBytes(resourceObject.attributes.size),
					dimensions: resourceObject.attributes.width ? resourceObject.attributes.width + 'x' + resourceObject.attributes.height : null
				};

				var filename = resourceObject.attributes.name;
				var viewerObject = {
					type: 'image',
					url: createImageUrl(resourceObject, false),
					options: {}
				};

				if(isEditableFile(filename) && config.viewer.editable.enabled === true) {
					viewerObject.type = 'editable';
				}
				if(isAudioFile(filename) && config.viewer.audio.enabled === true) {
					viewerObject.type = 'audio';
					viewerObject.url = createPreviewUrl(resourceObject, true);
				}
				if(isVideoFile(filename) && config.viewer.video.enabled === true) {
					viewerObject.type = 'video';
					viewerObject.url = createPreviewUrl(resourceObject, true);
					viewerObject.options = {
						width: config.viewer.video.playerWidth,
						height: config.viewer.video.playerHeight
					};
				}
				if(isOpenDocFile(filename) && config.viewer.opendoc.enabled === true) {
					viewerObject.type = 'opendoc';
					viewerObject.url = fm.settings.baseUrl + '/scripts/ViewerJS/index.html#' + createPreviewUrl(resourceObject, true);
					viewerObject.options = {
						width: config.viewer.opendoc.readerWidth,
						height: config.viewer.opendoc.readerHeight
					};
				}
				if(isGoogleDocsFile(filename) && config.viewer.google.enabled === true) {
					viewerObject.type = 'google';
					viewerObject.url = 'http://docs.google.com/viewer?url=' + encodeURIComponent(createPreviewUrl(resourceObject, false)) + '&embedded=true';
					viewerObject.options = {
						width: config.viewer.google.readerWidth,
						height: config.viewer.google.readerHeight
					};
				}

				this.previewIconClass = ko.pureComputed(function() {
					var cssClass = [],
						extraClass = ['ico'];
					if((viewerObject.type === 'image' || viewerObject.type === 'editable') && !viewerObject.url) {
						cssClass.push('grid-icon');
						if(this.cdo.isFolder === true) {
							cssClass.push('ico_folder');
							extraClass.push('folder');
							if(!this.rdo.attributes.readable) {
								extraClass.push('lock');
							}
						} else {
							cssClass.push('ico_file');
							if(this.rdo.attributes.readable) {
                                extraClass.push('ext', this.rdo.attributes.extension);
							} else {
                                extraClass.push('file', 'lock');
							}
						}
						cssClass.push(extraClass.join('_'));
					}
					return cssClass.join(' ');
				}, this);

                preview_item.viewer(viewerObject);
                model.previewFile(true);

				// zeroClipboard code
				ZeroClipboard.config({swfPath: fm.settings.baseUrl + '/scripts/zeroclipboard/dist/ZeroClipboard.swf'});
				var client = new ZeroClipboard(document.getElementById("fm-js-clipboard-copy"));
				client.on("ready", function(readyEvent) {
					client.on("aftercopy", function(event) {
						fm.success(lg.copied);
						// console.log("Copied text to clipboard: " + event.data["text/plain"]);
					});
				});
			};

			this.editFile = function() {
				editItem(preview_item.rdo)
			};

			this.saveFile = function() {
				saveItem(preview_item.rdo)
			};

			this.closeEditor = function() {
				preview_item.editor.enabled(false);
			};

			this.buttonVisibility = function(action) {
				switch(action) {
					case 'select':
						return (has_capability(preview_item.rdo, action) && hasContext());
					case 'move':
					case 'rename':
					case 'delete':
					case 'replace':
						return (has_capability(preview_item.rdo, action) && config.options.browseOnly !== true);
					case 'download':
						return (has_capability(preview_item.rdo, action));
				}
			};
		};

		var TreeModel = function() {
			var tree_model = this;
			this.isScrolling = ko.observable(false);
			this.selecledNode = ko.observable(null);

			this.options = {
				showLine: true,
				dblClickOpen: config.manager.dblClickOpen,
				reloadOnClick: false,
				expandSpeed: 200
			};

			this.treeData = {
				id: fileRoot,
				level: ko.observable(-1),
				children: ko.observableArray([])
			};

			this.treeData.children.subscribe(function (value) {
				tree_model.arrangeNode(tree_model.treeData);
			});

			var expandFolderDefault = function (parentNode) {
				if (fullexpandedFolder !== null) {
					if(!parentNode) {
						parentNode = tree_model.treeData
					}

					// looking for node that starts with specified path
					var node = tree_model.findByFilter(function (node) {
						return (fullexpandedFolder.indexOf(node.id) === 0);
					}, parentNode);

					if (node) {
						tree_model.options.expandSpeed = 10;
						tree_model.loadNodes(node, false);
					} else {
						fullexpandedFolder = null;
						tree_model.options.expandSpeed = 200;
					}
				}
			};

			this.findByParam = function(key, value, contextNode) {
				if(!contextNode) {
					contextNode = tree_model.treeData;
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
					var result = tree_model.findByParam(key, value, nodes[i]);
					if(result) return result;
				}
				return null;
			};

			this.findByFilter = function(filter, contextNode) {
				if(!contextNode) {
					contextNode = tree_model.treeData;
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
					var result = tree_model.findByFilter(filter, nodes[i]);
					if(result) return result;
				}
				return null;
			};

			this.loadNodes = function(targetNode, refresh) {
				var path = targetNode ? targetNode.id : tree_model.treeData.id;
				if(targetNode) {
					targetNode.isLoaded(false);
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
						if(response.data) {
							fmModel.currentPath(path);
							fmModel.itemsModel.setList(response.data);

							var nodes = [];
							$.each(response.data, function(i, resourceObject) {
								var nodeObject = tree_model.createNode(resourceObject);
								nodes.push(nodeObject);
							});
							if(refresh) {
								targetNode.children([]);
							}
							tree_model.addNodes(targetNode, nodes);
							// not root
							if(targetNode) {
								targetNode.isLoaded(true);
								tree_model.expandNode(targetNode);
							}
							expandFolderDefault(targetNode);
						}
						handleAjaxResponseErrors(response);
					},
					error: handleAjaxError
				});
			};

			this.createNode = function(resourceObject) {
				return new TreeNodeModel(resourceObject);
			};

			this.addNodes = function(targetNode, newNodes) {
				if(!$.isArray(newNodes)) {
					newNodes = [newNodes];
				}
				if (!targetNode) {
					targetNode = tree_model.treeData;
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
					zIndex: 100,
					// wrap options with "build" allows to get item element
					build: function ($triggerElement, e) {
						return {
							appendTo: '.fm-container',
							items: getContextMenuItems(node.rdo),
							callback: function(itemKey, options) {
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
						tree_model.actualizeNodeObject(cNode, oldFolder, newFolder);
					});
				}
			};

			var TreeNodeModel = function(resourceObject) {
				var tree_node = this;
				this.id = resourceObject.id;
				this.rdo = resourceObject;
				this.cdo = { // computed data object
					isFolder: (resourceObject.type === 'folder'),
					dimensions: resourceObject.attributes.width ? resourceObject.attributes.width + 'x' + resourceObject.attributes.height : null,
					cssItemClass: (resourceObject.type === 'folder') ? 'directory' : 'file'
				};

				this.nodeTitle = ko.observable(resourceObject.attributes.name);
				this.children = ko.observableArray([]);
				this.parentNode = ko.observable(null);
				this.isSliding = ko.observable(false);
				this.isLoading = ko.observable(false);
				this.isLoaded = ko.observable(false);
				this.isExpanded = ko.observable(false);
				this.isSelected = ko.observable(false);
				// arrangable properties
				this.level = ko.observable(0);
				this.isFirstNode = ko.observable(false);
				this.isLastNode = ko.observable(false);

				this.nodeTitle.subscribe(function (value) {
					tree_node.rdo.attributes.name = value;
				});
				this.children.subscribe(function (value) {
					tree_model.arrangeNode(tree_node);
				});

				this.isLoaded.subscribe(function (value) {
					tree_node.isLoading(!value);
				});

				this.switchNode = function(node) {
					if(!node.cdo.isFolder) {
						return false;
					}
					if(!node.rdo.attributes.readable) {
						fm.error(lg.NOT_ALLOWED_SYSTEM);
						return false;
					}
					tree_node.toggleNode(node, false);
				};

				this.nodeClick = function(node) {
					if(!tree_model.options.dblClickOpen) {
						tree_node.openNode(node);
						tree_node.toggleNode(node, tree_model.options.reloadOnClick);
					}

					if(tree_model.selecledNode() !== null) {
						tree_model.selecledNode().isSelected(false);
					}
					node.isSelected(true);
					tree_model.selecledNode(node);
				};

				this.nodeDblClick = function(node) {
					if(tree_model.options.dblClickOpen) {
						tree_node.openNode(node);
						tree_node.toggleNode(node, tree_model.options.reloadOnClick);
					}
				};

				this.toggleNode = function(node, forceReload) {
					if(node.rdo.type === 'folder') {
						if(!node.isExpanded() && (forceReload || !node.isLoaded())) {
							tree_model.loadNodes(node, true);
						} else {
							node.isSliding(true);
						}
					}
				};

				this.openNode = function(node) {
					if(node.rdo.type === 'file') {
						getDetailView(node.rdo);
					}
					if(node.rdo.type === 'folder' && node.isLoaded()) {
						var childrenObjects = [];
						if(node.children().length) {
							$.each(node.children(), function(index, cNode) {
								childrenObjects.push(cNode.rdo);
							});
						}
						model.currentPath(node.rdo.id);
						model.itemsModel.setList(childrenObjects);
					}
				};

				this.remove = function() {
					tree_node.parentNode().children.remove(tree_node);
				};

				this.isRoot = function() {
					return tree_node.level() === tree_model.treeData.id;
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
							if(!this.rdo.attributes.readable) {
								extraClass.push('lock');
							} else if(this.isExpanded() || !this.isExpanded() && this.isSliding()) {
								extraClass.push('open');
							}
						}
					} else {
						cssClass = 'ico_file';
						if(this.rdo.attributes.readable) {
                            extraClass.push('ext', this.rdo.attributes.extension);
						} else {
                            extraClass.push('file', 'lock');
						}
					}
					return cssClass + ' ' + extraClass.join('_');
				}, this);

				this.switcherClass = ko.pureComputed(function() {
					var cssClass = [];
					if (tree_model.options.showLine) {
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
					return (tree_model.options.showLine && !this.isLastNode()) ? 'line' : '';
				}, this);
			};
		};

		var ItemsModel = function() {
			var items_model = this;
			this.objects = ko.observableArray([]);
			this.objectsSize = ko.observable(0);
			this.objectsNumber = ko.observable(0);
			this.selectedNumber = ko.observable(0);
			this.listSortField = ko.observable(configSortField);
			this.listSortOrder = ko.observable(configSortOrder);
			this.isScrolling = ko.observable(false);

			this.createObject = function(resourceObject) {
				return new ItemObject(resourceObject);
			};

			this.addNew = function(dataObjects) {
				if(!$.isArray(dataObjects)) {
					dataObjects = [dataObjects];
				}
				$.each(dataObjects, function (i, resourceObject) {
					model.itemsModel.objects.push(items_model.createObject(resourceObject));
				});
				model.itemsModel.sortObjects();
			};

			this.loadList = function(path) {
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
							model.itemsModel.setList(response.data);
						}
						handleAjaxResponseErrors(response);
					},
					error: handleAjaxError
				});
			};

			this.setList = function(dataObjects) {
				var objects = [];
				// add parent folder object
				if(!isFile(model.currentPath()) && model.currentPath() !== fileRoot) {
					var parentPath = getParentDirname(model.currentPath());
					var parent = {
						id: parentPath,
						rdo: {
							id: parentPath,
							type: 'parent',
							attributes: {
                                readable: true,
                                writable: true
							}
						}
					};

					parent.open = function(item, e) {
                        if(isItemOpenable(e)) {
                            items_model.loadList(parent.id);
                        }
					};
					objects.push(parent);
				}
				$.each(dataObjects, function (i, resourceObject) {
					objects.push(items_model.createObject(resourceObject));
				});
				model.itemsModel.objects(objects);
				model.itemsModel.sortObjects();
				model.loadingView(false);
			};

			this.findByParam = function(key, value) {
				return ko.utils.arrayFirst(model.itemsModel.objects(), function(object) {
					return object[key] === value;
				});
			};

			this.findByFilter = function(filter, allMatches) {
				var firstMatch = !(allMatches || false);

				var resultItems = [],
					items = items_model.objects();

				if(!items || items.length === 0) {
					return null;
				}
				for (var i = 0, l = items.length; i < l; i++) {
					if(filter(items[i])) {
						if(firstMatch) {
							return items[i];
						}
						resultItems.push(items[i]);
					}
				}
				return firstMatch ? null : resultItems;
			};

			this.sortObjects = function() {
				var sortedList = sortItems(items_model.objects());
				items_model.objects(sortedList);
			};

			this.getSelected = function() {
				var selectedItems = items_model.findByFilter(function (item) {
					return item.rdo.type !== "parent" && item.selected();
				}, true);
				items_model.selectedNumber(selectedItems.length);
				return selectedItems;
			};

			this.unselectItems = function(ctrlKey) {
				var appendSelection = (config.manager.selection.enabled && config.manager.selection.useCtrlKey && ctrlKey === true);
				if(!appendSelection) {
					// drop selection from selected items
					$.each(items_model.getSelected(), function(i, itemObject) {
						itemObject.selected(false);
					});
				}
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
				items_model.objectsNumber(totalNumber);
				items_model.objectsSize(formatBytes(totalSize));

				// context menu
				$viewItems.contextMenu({
					selector: '.file, .directory',
					zIndex: 100,
					// wrap options with "build" allows to get item element
					build: function ($triggerElement, e) {
						var koItem = ko.dataFor($triggerElement[0]);
						if(!koItem.selected()) {
							fmModel.itemsModel.unselectItems(false);
							koItem.selected(true);
						}

						return {
							appendTo: '.fm-container',
							items: getContextMenuItems(koItem.rdo),
							callback: function(itemKey, options) {
								var selectedObjects = [];
								$.each(fmModel.itemsModel.getSelected(), function(i, itemObject) {
									selectedObjects.push(itemObject.rdo);
								});
								performAction(itemKey, koItem.rdo, selectedObjects);
							}
						}
					}
				});
			});

			var ItemObject = function(resourceObject) {
				var previewWidth = config.viewer.image.thumbMaxWidth;
				if(resourceObject.attributes.width && resourceObject.attributes.width < previewWidth) {
					previewWidth = resourceObject.attributes.width;
				}

				this.id = resourceObject.id; // for search purpose
				this.rdo = resourceObject; // original resource data object
				this.cdo = { // computed data object
					isFolder: (resourceObject.type === 'folder'),
					sizeFormatted: formatBytes(resourceObject.attributes.size),
					dimensions: resourceObject.attributes.width ? resourceObject.attributes.width + 'x' + resourceObject.attributes.height : null,
					cssItemClass: (resourceObject.type === 'folder') ? 'directory' : 'file',
					imageUrl: createImageUrl(resourceObject, true),
					previewWidth: previewWidth
				};
				this.visible = ko.observable(true);
				this.selected = ko.observable(false);

				this.title = ko.pureComputed(function() {
					return (config.options.showTitleAttr) ? this.rdo.id : null;
				}, this);

				this.itemClass = ko.pureComputed(function() {
					var cssClass = [];
					if(this.selected() && config.manager.selection.enabled) {
						cssClass.push('ui-selected');
					}
					return this.cdo.cssItemClass + ' ' + cssClass.join(' ');
				}, this);

				this.listIconClass = ko.pureComputed(function() {
                    var cssClass,
                        extraClass = ['ico'];
                    if (this.cdo.isFolder === true) {
                        cssClass = 'ico_folder';
                        extraClass.push('folder');
                        if (!this.rdo.attributes.readable) {
                            extraClass.push('lock');
                        }
                    } else {
                        cssClass = 'ico_file';
                        if (this.rdo.attributes.readable) {
                            extraClass.push('ext', this.rdo.attributes.extension);
                        } else {
                            extraClass.push('file', 'lock');
                        }
                    }
                    return cssClass + ' ' + extraClass.join('_');
				}, this);

				this.gridIconClass = ko.pureComputed(function() {
                    var cssClass = [],
                        extraClass = ['ico'];
                    if (!this.cdo.imageUrl) {
                        cssClass.push('grid-icon');
                        if (this.cdo.isFolder === true) {
                            cssClass.push('ico_folder');
                            extraClass.push('folder');
                            if (!this.rdo.attributes.readable) {
                                extraClass.push('lock');
                            }
                        } else {
                            cssClass.push('ico_file');
                            if (this.rdo.attributes.readable) {
                                extraClass.push('ext', this.rdo.attributes.extension);
                            } else {
                                extraClass.push('file', 'lock');
                            }
                        }
                        cssClass.push(extraClass.join('_'));
                    }
					return cssClass.join(' ');
				}, this);

				this.open = function(item, e) {
					var koItem = this;
					items_model.unselectItems(e.ctrlKey);
					koItem.selected(!koItem.selected());

					if(isItemOpenable(e)) {
						if(config.options.quickSelect && koItem.rdo.type === 'file' && has_capability(koItem.rdo, 'select')) {
							selectItem(koItem.rdo);
						} else {
							getDetailView(koItem.rdo);
						}
					}
				};

				this.remove = function() {
					items_model.objects.remove(this);
				};
			};

			function isItemOpenable(event) {
				// selecting with Ctrl key
				if(config.manager.selection.enabled && config.manager.selection.useCtrlKey && event.ctrlKey === true) {
                    return false;
				}

				// single clicked while expected dblclick
				if(config.manager.dblClickOpen && event.type === 'click') {
					return false;
				}

				return true;
			}
		};

		var TableViewModel = function() {
			var SortableHeader = function(name) {
				var thead = this;
				this.column = ko.observable(name);
				this.order = ko.observable(model.itemsModel.listSortOrder());

				this.sortClass = ko.pureComputed(function() {
					var cssClass;
					if(model.itemsModel.listSortField() === thead.column()) {
						cssClass = 'sorted sorted-' + this.order();
					}
					return cssClass;
				}, this);

				this.sort = function() {
					var isAscending = thead.order() === 'asc';
					var isSameColumn = model.itemsModel.listSortField() === thead.column();
					thead.order(isSameColumn ? (isAscending ? 'desc' : 'asc') : model.itemsModel.listSortOrder());
					model.itemsModel.listSortField(thead.column());
					model.itemsModel.listSortOrder(thead.order());
					model.itemsModel.sortObjects();
				};
			};

			this.thName = new SortableHeader('name');
			this.thType = new SortableHeader('type');
			this.thSize = new SortableHeader('size');
			this.thDimensions = new SortableHeader('dimensions');
			this.thModified = new SortableHeader('modified');
		};

		var HeaderModel = function() {
			this.goHome = function() {
				model.previewFile(false);
				model.itemsModel.loadList(fileRoot);
			};

			this.goParent = function() {
				var parentFolder = model.previewFile()
                    ? getDirname(model.previewModel.rdo.id)
                    : getParentDirname(model.currentPath());

				if(model.previewFile()) {
					model.previewFile(false);
				}

                if(parentFolder !== model.currentPath()) {
					model.itemsModel.loadList(parentFolder);
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
								fmModel.addItem(response.data, fmModel.currentPath());

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

		var SummaryModel = function() {
			this.files = ko.observable(null);
			this.folders = ko.observable(null);
			this.size = ko.observable(null);
			this.enabled = ko.observable(false);

			this.doSummarize = function() {
				summarizeItems();
			};
		};

		var ClipboardModel = function() {
			var cbItems = [],
				cbMode = null,
            	clipboard_model = this,
				active = capabilities.indexOf('copy') > -1 || capabilities.indexOf('move') > -1;

            this.enabled = ko.observable(model.config().options.clipboard && active);

			this.copy = function() {
				if (!clipboard_model.hasCapability('copy')) {
					return;
				}
                cbMode = 'copy';
                cbItems = model.itemsModel.getSelected();
			};

			this.cut = function() {
                if (!clipboard_model.hasCapability('cut')) {
                    return;
                }
                cbMode = 'cut';
                cbItems = model.itemsModel.getSelected();
			};

			this.paste = function() {
                if (!clipboard_model.hasCapability('paste')) {
                    return;
                }
                if (cbMode === null || cbItems.length === 0) {
                    fm.warning(lg.clipboard_empty);
                    return;
                }

                var	targetPath = model.currentPath();

                processMultipleActions(cbItems, function (i, itemObject) {
                    if (cbMode === 'cut') {
                        return moveItem(itemObject, targetPath);
                    }
                    if (cbMode === 'copy') {
                        return copyItem(itemObject, targetPath);
                    }
                }, clearClipboard);
			};

			this.clear = function() {
                if (!clipboard_model.hasCapability('clear')) {
                    return;
                }
                clearClipboard();
                fm.success(lg.clipboard_cleared);
			};

            this.isEmpty = function() {
            	return cbItems.length === 0;
			};

            this.hasCapability = function(capability) {
            	if (!clipboard_model.enabled) {
            		return false;
				}

            	switch(capability) {
					case 'copy':
						return capabilities.indexOf('copy') > -1;
                    case 'cut':
                        return capabilities.indexOf('move') > -1;
					default:
                        return true;
				}
			};

			function clearClipboard() {
                cbItems = [];
                cbMode = null;
			}
		};

		this.treeModel = new TreeModel();
		this.itemsModel = new ItemsModel();
		this.tableViewModel = new TableViewModel();
		this.previewModel = new PreviewModel();
		this.headerModel = new HeaderModel();
		this.summaryModel = new SummaryModel();
		this.searchModel = new SearchModel();
		this.clipboardModel = new ClipboardModel();
	};


	/*---------------------------------------------------------
	 Helper functions
	 ---------------------------------------------------------*/

	var sortItems = function(items) {
		var sortOrder = (fmModel.viewMode() === 'list') ? fmModel.itemsModel.listSortOrder() : configSortOrder;
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
				sortField = fmModel.itemsModel.listSortField();
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
				url = fm.settings.baseUrl + '/config/' + $.urlParam('config');
			} else {
				url = fm.settings.baseUrl + '/config/filemanager.config.json';
			}
		} else {
			url = fm.settings.baseUrl + '/config/filemanager.config.default.json';
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

	// Loads a given js/css files dynamically into header
	var loadAssets = function(assets) {
        for (var i = 0, l = assets.length; i < l; i++) {
			if(typeof assets[i] === 'string') {
                assets[i] = fm.settings.baseUrl + assets[i];
			}
        }

        toast.apply(this, assets);
	};

	// Loads a given js template file into header if not already included
	var loadTemplate = function(id, data) {
		return $.ajax({
			type: 'GET',
			url: fm.settings.baseUrl + '/scripts/templates/' + id + '.html',
			error: handleAjaxError
		});
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
		var u = [lg.unit_bytes, lg.unit_kb, lg.unit_mb, lg.unit_gb];

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
			$.each(response.errors, function(i, errorObject) {
				fm.error(errorObject.title);
			});
		}
	};

	// Test if item has the 'cap' capability
	// 'cap' is one of 'select', 'rename', 'delete', 'download', 'replace', 'copy', 'move'
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

	// Replace all leading or trailing chars with an empty string
	var trim = function(string, char) {
		var regExp = new RegExp('^' + char + '+|' + char + '+$', 'g');
		return string.replace(regExp, '');
	};

	// Replace all trailing chars with an empty string
	var rtrim = function(string, char) {
		var regExp = new RegExp(char + '+$', 'g');
		return string.replace(regExp, '');
	};

	var encodePath = function(path) {
		var parts = [];
		$.each(path.split('/'), function(i, part) {
			parts.push(encodeURIComponent(part));
		});
		return parts.join('/');
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
		return ($.inArray(getExtension(filename), config.viewer.editable.extensions) !== -1);
	};

	// Test if is image file
	var isImageFile = function(filename) {
		return ($.inArray(getExtension(filename), config.viewer.image.extensions) !== -1);
	};

	// Test if file is supported web video file
	var isVideoFile = function(filename) {
		return ($.inArray(getExtension(filename), config.viewer.video.extensions) !== -1);
	};

	// Test if file is supported web audio file
	var isAudioFile = function(filename) {
		return ($.inArray(getExtension(filename), config.viewer.audio.extensions) !== -1);
	};

	// Test if file is opendoc file
	// Supported file types: http://viewerjs.org/examples/
	var isOpenDocFile = function(filename) {
		return ($.inArray(getExtension(filename), config.viewer.opendoc.extensions) !== -1);
	};

	// Test if file is supported by Google Docs viewer
	// Supported file types: http://stackoverflow.com/q/24325363/1789808
	var isGoogleDocsFile = function(filename) {
		return ($.inArray(getExtension(filename), config.viewer.google.extensions) !== -1);
	};

	var buildConnectorUrl = function(params) {
		var defaults = {
			time: new Date().getTime()
		};
		var queryParams = $.extend({}, params || {}, defaults);
		return apiConnector + '?' + $.param(queryParams);
	};

	// Build url to preview files
	var createPreviewUrl = function(resourceObject, encode) {
		encode = encode || false;
		var previewUrl,
			objectPath = resourceObject.attributes.path;

		if(config.viewer.absolutePath && objectPath) {
			if(encode) {
				objectPath = encodePath(objectPath);
			}
            previewUrl = buildAbsolutePath(objectPath);
		} else {
            previewUrl = buildConnectorUrl({
				mode: 'readfile',
				path: resourceObject.id
			});
		}

        previewUrl = fm.settings.callbacks.beforeCreatePreviewUrl(resourceObject, previewUrl);
		return previewUrl;
	};

	// Build url to display image or its thumbnail
	var createImageUrl = function(resourceObject, thumbnail) {
		var imageUrl;
		if (isImageFile(resourceObject.id) &&
			resourceObject.attributes.readable && (
			(thumbnail && config.viewer.image.showThumbs) ||
			(!thumbnail && config.viewer.image.enabled === true)
		)) {
			if(config.viewer.absolutePath && !thumbnail && resourceObject.attributes.path) {
                imageUrl = buildAbsolutePath(encodePath(resourceObject.attributes.path));
			} else {
				var queryParams = {path: resourceObject.id};
				if (resourceObject.attributes.extension === 'svg') {
					queryParams.mode = 'readfile';
				} else {
					queryParams.mode = 'getimage';
					if (thumbnail) {
						queryParams.thumbnail = 'true';
					}
				}
                imageUrl = buildConnectorUrl(queryParams);
			}
            imageUrl = fm.settings.callbacks.beforeCreateImageUrl(resourceObject, imageUrl);
		}
		return imageUrl;
	};

	var buildAbsolutePath = function(path) {
		var url = (typeof config.viewer.previewUrl === "string") ? config.viewer.previewUrl : location.origin;
		return trim(url, '/') + path + '?time=' + (new Date().getTime());
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

	// Delays execution of function that is passed as argument
	var delayCallback = (function () {
		var timer = 0;
		return function(callback, ms) {
			clearTimeout(timer);
			timer = setTimeout(callback, ms);
		};
	})();

	// Handle multiple actions in loop with deferred object
	var processMultipleActions = function(items, callbackFunction, finishCallback) {
		var successCounter = 0,
			totalCounter = items.length,
			deferred = $.Deferred().resolve();

		$.each(items, function(i, item) {
			deferred = deferred.then(function() {
				return callbackFunction(i, item);
			}).then(function(result) {
				if(result && result.data) {
					successCounter++;
				}
			});
		});

		if(totalCounter > 1) {
			deferred.then(function() {
				fm.log(lg.successful_processed.replace('%s', successCounter).replace('%s', totalCounter));
			});
		}

        deferred.then(function() {
            if (typeof finishCallback === 'function') {
                finishCallback();
			}
        });
	};

	// Clears browser window selection
	var clearSelection = function() {
		if(document.selection && document.selection.empty) {
			document.selection.empty();
		} else if(window.getSelection) {
			var sel = window.getSelection();
			sel.removeAllRanges();
		}
	};

	// Create FileTree and bind events
	var createFileTree = function() {
		fmModel.treeModel.loadNodes(null, false);
	};

	// check if plugin instance created inside some context
	function hasContext() {
		return window.opener // window.open()
			|| window.tinyMCEPopup // tinyMCE >= 3.0
			|| window.self !== window.top // any <iframe>
			|| $.urlParam('field_name') // tinymce 4 or colorbox
			|| $.urlParam('CKEditor') // CKEditor 3.0 + integration method
			|| $.urlParam('ImperaviElementId'); // Imperavi Redactor I >= 10.x.x
	}


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
		var previewUrl = createPreviewUrl(resourceObject, true);
        previewUrl = fm.settings.callbacks.beforeSelectItem(resourceObject, previewUrl);

		if(window.tinyMCEPopup) {
			// use tinyMCE > 3.0 integration method
			var win = tinyMCEPopup.getWindowArg("window");
			win.document.getElementById(tinyMCEPopup.getWindowArg("input")).value = previewUrl;
			if (typeof(win.ImageDialog) != "undefined") {
				// Update image dimensions
				if (win.ImageDialog.getImageData)
					win.ImageDialog.getImageData();

				// Preview if necessary
				if (win.ImageDialog.showPreviewImage)
					win.ImageDialog.showPreviewImage(previewUrl);
			}
			tinyMCEPopup.close();
			return;
		}

		// tinymce 4 and colorbox
		if($.urlParam('field_name')) {
			parent.document.getElementById($.urlParam('field_name')).value = previewUrl;

			if(typeof parent.tinyMCE !== "undefined") {
				parent.tinyMCE.activeEditor.windowManager.close();
			}
			if(typeof parent.$.fn.colorbox !== "undefined") {
				parent.$.fn.colorbox.close();
			}
		}

		if($.urlParam('ImperaviElementId')) {
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
						instance.insert.html('<img src="' + previewUrl + '">');
					} else {
						instance.insert.html('<a href="' + previewUrl + '">' + resourceObject.attributes.name + '</a>');
					}
				}
			}
		}

		if($.urlParam('CKEditor')) {
			// use CKEditor 3.0 + integration method
			if (window.opener) {
				// Popup
				window.opener.CKEDITOR.tools.callFunction($.urlParam('CKEditorFuncNum'), previewUrl);
			} else {
				// Modal (in iframe)
				parent.CKEDITOR.tools.callFunction($.urlParam('CKEditorFuncNum'), previewUrl);
				parent.CKEDITOR.tools.callFunction($.urlParam('CKEditorCleanUpFuncNum'));
			}
		} else if(window.opener) {
			// use FCKEditor 2.0 integration method
			if(resourceObject.attributes.width) {
				var p = previewUrl;
				var w = resourceObject.attributes.width;
				var h = resourceObject.attributes.height;
				window.opener.SetUrl(p,w,h);
			} else {
				window.opener.SetUrl(previewUrl);
			}
		}

		fm.settings.callbacks.afterSelectItem(resourceObject, previewUrl);
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
						var sourceNode = fmModel.treeModel.findByParam('id', oldPath);
						if(sourceNode) {
							if(sourceNode.rdo.type === 'folder') {
								sourceNode.nodeTitle(newItem.attributes.name);
								// update object data for the current and all child nodes
								fmModel.treeModel.actualizeNodeObject(sourceNode, oldPath, newItem.id);
							}
							if(sourceNode.rdo.type === 'file') {
								var parentNode = sourceNode.parentNode();
								var newNode = fmModel.treeModel.createNode(newItem);
								sourceNode.remove();

								if(parentNode) {
									fmModel.treeModel.addNodes(parentNode, newNode);
								}
							}
						}

						// handle view objects
						var sourceItem = fmModel.itemsModel.findByParam('id', oldPath);
						if(sourceItem) {
							if(sourceItem.rdo.type === 'parent') {
								sourceItem.id = newItem.id;
							} else {
								sourceItem.remove();
								fmModel.itemsModel.addNew(newItem);
							}
						}
						// ON rename currently open folder
						if(fmModel.currentPath() === oldPath) {
							fmModel.itemsModel.loadList(newItem.id);
						}
						// ON rename currently previewed file
						if(fmModel.previewFile() && fmModel.previewModel.rdo.id === oldPath) {
							fmModel.previewModel.load(newItem);
						}

						ui.closeDialog();
						if(config.options.showConfirmation) {
							fm.success(lg.successful_rename);
						}
					}
					handleAjaxResponseErrors(response);
				},
				error: handleAjaxError
			});
		};

		fm.prompt({
			message: lg.new_filename,
			value: config.security.allowChangeExtensions ? resourceObject.attributes.name : getFilename(resourceObject.attributes.name),
			okBtn: {
				label: lg.action_rename,
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
		var $toolbar = $('#fm-js-preview-toolbar');
		var $button = $toolbar.find(':file');

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
					if(getExtension(file.name) != resourceObject.attributes.extension) {
						fm.error(lg.ERROR_REPLACING_FILE + " ." + resourceObject.attributes.extension);
						return false;
					}
					data.submit();
				})

				.on('fileuploadsubmit', function(e, data) {
					data.formData = {
						mode: 'replace',
						path: resourceObject.id
					};
					$uploadButton.addClass('loading').prop('disabled', true);
					$uploadButton.children('span').text(lg.loading_data);
				})

				.on('fileuploadalways', function(e, data) {
					$uploadButton.removeData().removeClass('loading').prop('disabled', false);
					$uploadButton.children('span').text(lg.action_upload);
					var response = data.result;

					// handle server-side errors
					if(response && response.errors) {
						fm.error(lg.upload_failed + "<br>" + response.errors[0].title);
					}
					if(response && response.data) {
						var resourceObject = response.data[0];
						fmModel.removeItem(resourceObject);
						fmModel.addItem(resourceObject, fmModel.currentPath());

						// set new file for preview
                        if(fmModel.previewFile()) {
							fmModel.previewModel.load(resourceObject);
						}

						if(config.options.showConfirmation) {
							fm.success(lg.successful_replace);
						}
					}
				})

				.on('fileuploadchunkdone', function (e, data) {
					var response = data.result;
					if(response.data && response.data[0]) {
						var resourceObject = response.data[0];
						fmModel.removeItem(resourceObject);
						fmModel.addItem(resourceObject, fmModel.currentPath());
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
	// Called by clicking the "Move" button in de tail views
	// or choosing the "Move" contextual menu option in list views.
	var moveItemPrompt = function(objects, successCallback) {
		var doMove = function(e, ui) {
			var targetPath = ui.getInputValue();
			if(!targetPath) {
				fm.error(lg.prompt_foldername);
				return;
			}
			targetPath = rtrim(targetPath, '/') + '/';
			successCallback(targetPath);
		};

		var objectsTotal = objects.length,
			message = (objectsTotal > 1) ? lg.prompt_move_multiple.replace('%s', objectsTotal) : lg.prompt_move;

		fm.prompt({
			message: message,
			value: fmModel.currentPath(),
			okBtn: {
				label: lg.action_move,
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

	// Copy the current item to specified dir and returns the new name.
	// Called upon paste copied items via clipboard.
	var copyItem = function(resourceObject, targetPath) {
		return $.ajax({
			type: 'GET',
			url: buildConnectorUrl({
				mode: 'copy',
                source: resourceObject.id,
                target: targetPath
			}),
			dataType: 'json',
			success: function(response) {
                console.log(response);
				if(response.data) {
					var newItem = response.data;

					fmModel.addItem(newItem, targetPath);

					alertify.clearDialogs();
					if(config.options.showConfirmation) {
						fm.success(lg.successful_copied);
					}
				}
				handleAjaxResponseErrors(response);
			},
			error: handleAjaxError
		});
	};

	// Move the current item to specified dir and returns the new name.
	// Called by clicking the "Move" button in detail views
	// or choosing the "Move" contextual menu option in list views.
	var moveItem = function(resourceObject, targetPath) {
		return $.ajax({
			type: 'GET',
			url: buildConnectorUrl({
				mode: 'move',
				old: resourceObject.id,
				new: targetPath
			}),
			dataType: 'json',
			success: function(response) {
				if(response.data) {
					var newItem = response.data;

					fmModel.removeItem(resourceObject);
					fmModel.addItem(newItem, targetPath);

					// ON move currently open folder to another folder
					if(fmModel.currentPath() === resourceObject.id) {
						fmModel.itemsModel.loadList(newItem.id);
					}
					// ON move currently previewed file
					if(fmModel.previewFile() && fmModel.previewModel.rdo.id === resourceObject.id) {
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
	var deleteItemPrompt = function(objects, successCallback) {
		var objectsTotal = objects.length,
			message = (objectsTotal > 1) ? lg.confirm_delete_multiple.replace('%s', objectsTotal) : lg.confirm_delete;

		fm.confirm({
			message: message,
			okBtn: {
				label: lg.yes,
				click: function(e, ui) {
					successCallback();
				}
			},
			cancelBtn: {
				label: lg.no
			}
		});
	};

	// Delete item by path
	var deleteItem = function(path) {
		return $.ajax({
			type: 'GET',
			url: buildConnectorUrl({
				mode: 'delete',
				path: path
			}),
			dataType: 'json',
			success: function (response) {
				if(response.data) {
					var targetItem = response.data;

					fmModel.removeItem(targetItem);

					// ON delete currently previewed file
					if(fmModel.previewFile() && fmModel.previewModel.rdo.id === targetItem.id) {
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

	// Starts file download process.
	// Called by clicking the "Download" button in detail views
	// or choosing the "Download" contextual menu item in list views.
	var downloadItem = function(resourceObject) {
		var queryParams = {
			mode: 'download',
			path: resourceObject.id
		};

		return $.ajax({
			type: 'GET',
			url: buildConnectorUrl(queryParams),
			dataType: 'json',
			success: function (response) {
				if(response.data) {
					//window.location = buildConnectorUrl(queryParams);
					$.fileDownload(buildConnectorUrl(queryParams));
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
					fmModel.previewModel.editor.enabled(true);
					fmModel.previewModel.editor.content(response.data.attributes.content);
					// instantiate codeMirror according to config options
                    instantiateCodeMirror(resourceObject.attributes.extension);
				}
				handleAjaxResponseErrors(response);
			},
			error: handleAjaxError
		});
	};

	// Save CodeMirror editor content to file
	var saveItem = function(resourceObject) {
		var newValue = fmModel.previewModel.editor.codeMirror().getValue();
		fmModel.previewModel.editor.content(newValue);

		$.ajax({
			type: 'POST',
			url: buildConnectorUrl(), // request 'savefile' connector action
			dataType: 'json',
			data: $('#fm-js-editor-form').serializeArray(),
			success: function (response) {
				if(response.data) {
					fmModel.previewModel.editor.enabled(false);
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

					fmModel.summaryModel.files(data.files);
					fmModel.summaryModel.folders(data.folders);
					fmModel.summaryModel.size(size);

					fmModel.summaryModel.enabled(true);
					var $content = $('#summary-popup').clone().show();
					fmModel.summaryModel.enabled(false);

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
		if(!resourceObject.attributes.readable) {
			fm.error(lg.NOT_ALLOWED_SYSTEM);
			return false;
		}
		if(resourceObject.type === 'file') {
			fmModel.previewModel.load(resourceObject);
		}
		if(resourceObject.type === 'folder' || resourceObject.type === 'parent') {
			fmModel.itemsModel.loadList(resourceObject.id);
		}
	};

	// Options for context menu plugin
	function getContextMenuItems(resourceObject) {
        var clipboardDisabled = !fmModel.clipboardModel.enabled(),
            contextMenuItems = {
                select: {name: lg.action_select, className: 'select'},
                download: {name: lg.action_download, className: 'download'},
                rename: {name: lg.action_rename, className: 'rename'},
                move: {name: lg.action_move, className: 'move'},
                replace: {name: lg.action_replace, className: 'replace'},
                separator1: "-----",
                copy: {name: lg.clipboard_copy, className: 'copy'},
                cut: {name: lg.clipboard_cut, className: 'cut'},
                delete: {name: lg.action_delete, className: 'delete'}
            };

		if(!has_capability(resourceObject, 'download')) delete contextMenuItems.download;
        if(!has_capability(resourceObject, 'select') || !hasContext()) delete contextMenuItems.select;
        if(!has_capability(resourceObject, 'rename') || config.options.browseOnly === true) delete contextMenuItems.rename;
		if(!has_capability(resourceObject, 'delete') || config.options.browseOnly === true) delete contextMenuItems.delete;
		if(!has_capability(resourceObject, 'copy') || config.options.browseOnly === true || clipboardDisabled) delete contextMenuItems.copy;
		if(!has_capability(resourceObject, 'move') || config.options.browseOnly === true || clipboardDisabled) {
            delete contextMenuItems.cut;
            delete contextMenuItems.move;
		}
		// remove 'replace' since it is implemented on toolbar panel in preview mode only
		delete contextMenuItems.replace;

		return contextMenuItems
	}

	// Binds contextual menu to items in list and grid views.
	var performAction = function(action, targetObject, selectedObjects) {
		// suppose that target object is part of selected objects while multiple selection
		var objects = selectedObjects ? selectedObjects : [targetObject];

		switch(action) {
			case 'select':
				selectItem(targetObject);
				break;

			case 'download':
				$.each(objects, function(i, itemObject) {
					downloadItem(itemObject);
				});
				break;

			case 'rename':
				renameItem(targetObject);
				break;

			case 'replace':
				replaceItem(targetObject);
				break;

			case 'move':
				moveItemPrompt(objects, function(targetPath) {
					processMultipleActions(objects, function(i, itemObject) {
						return moveItem(itemObject, targetPath);
					});
				});
				break;

			case 'delete':
				deleteItemPrompt(objects, function() {
					processMultipleActions(objects, function(i, itemObject) {
						return deleteItem(itemObject.id);
					});
				});
				break;

			case 'copy':
                fmModel.clipboardModel.copy();
				break;

			case 'cut':
                fmModel.clipboardModel.cut();
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
						info: lg.upload_files_number_limit.replace('%s', config.upload.maxNumberOfFiles) + ' ' + lg.upload_file_size_limit + formatBytes(config.upload.fileSizeLimit, true),
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
						label: lg.action_upload,
						autoClose: false,
						click: function(e, ui) {
							if($dropzone.children('.upload-item').length > 0) {
								$dropzone.find('.button-start').trigger('click');
							} else {
								fm.error(lg.upload_choose_file);
							}
						}
					},{
						label: lg.action_select,
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

					function resumeUpload(data) {
						$.blueimp.fileupload.prototype.options.add.call($('#fileupload')[0], e, data);
						data.submit();
					}

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
									resumeUpload(data);
								}
								handleAjaxResponseErrors(response);
							},
							error: handleAjaxError
						});
					} else {
						resumeUpload(data);
					}
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
						deleteItem(currentPath + file.serverName);
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
						singleFileUploads: true,
						formData: {
							mode: 'upload',
							path: currentPath
						},
						// validation
						// maxNumberOfFiles works only for single "add" call when "singleFileUploads" is set to "false"
						maxNumberOfFiles: config.upload.maxNumberOfFiles,
						acceptFileTypes: allowedFileTypes,
						maxFileSize: config.upload.fileSizeLimit,
						messages: {
							maxNumberOfFiles: lg.upload_files_number_limit.replace("%s", config.upload.maxNumberOfFiles),
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
							if($items.length >= config.upload.maxNumberOfFiles) {
								fm.error(lg.upload_files_number_limit.replace("%s", config.upload.maxNumberOfFiles), {
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
								imagesPath: fm.settings.baseUrl + '/scripts/jQuery-File-Upload/img'
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
							file.error = lg.upload_failed;
							var $node = file.context;
							$node.removeClass('added process').addClass('error');
						});
					})

					.on('fileuploaddone', function(e, data) {
						var response = data.result;
						$.each(data.files, function (index, file) {
							var $node = file.context;
							// handle server-side errors
							if(response && response.errors) {
								$node.removeClass('added process').addClass('error');
								$node.find('.error-message').text(response.errors[0].title);
								$node.find('.button-start').remove();
							} else {
								// remove file preview item on success upload
								$node.remove();
							}
						});
					})

					.on('fileuploadalways', function(e, data) {
						var response = data.result;
						$.each(data.files, function (index, file) {
							if(response && response.data && response.data[index]) {
								var resourceObject = response.data[index];
								fmModel.removeItem(resourceObject);
								fmModel.addItem(resourceObject, fmModel.currentPath());
							}
						});

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
						}
						updateDropzoneView();
					})

					.on('fileuploadchunkdone', function (e, data) {
						var response = data.result;
						$.each(data.files, function (index, file) {
							if(response.data && response.data[index]) {
								var resourceObject = response.data[index];
								fmModel.removeItem(resourceObject);
								fmModel.addItem(resourceObject, fmModel.currentPath());

								// get filename from server, it may differ from original
								file.serverName = resourceObject.attributes.name;
								// mark that file has uploaded chunk(s)
								file.chunkUploaded = 1;
							}
						});
					})

					.on('fileuploadprocessalways', function(e, data) {
						$.each(data.files, function (index, file) {
							var $node = file.context;
							// file wasn't added to queue (due to config.upload.maxNumberOfFiles limit e.g.)
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
					paramName: config.upload.paramName,
					maxChunkSize: config.upload.chunkSize
				})

				.on('fileuploadadd', function(e, data) {
					$uploadButton.data(data);
				})

				.on('fileuploadsubmit', function(e, data) {
					data.formData = {
						mode: 'upload',
						path: fmModel.currentPath()
					};
					$uploadButton.addClass('loading').prop('disabled', true);
					$uploadButton.children('span').text(lg.loading_data);
				})

				.on('fileuploadalways', function(e, data) {
					$("#filepath").val('');
					$uploadButton.removeData().removeClass('loading').prop('disabled', false);
					$uploadButton.children('span').text(lg.action_upload);
					var response = data.result;

					// handle server-side errors
					if(response && response.errors) {
						fm.error(lg.upload_failed + "<br>" + response.errors[0].title);
					}
					if(response && response.data) {
						var resourceObject = response.data[0];
						fmModel.removeItem(resourceObject);
						fmModel.addItem(resourceObject, fmModel.currentPath());

						if(config.options.showConfirmation) {
							fm.success(lg.upload_successful_file);
						}
					}
				})

				.on('fileuploadchunkdone', function (e, data) {
					var response = data.result;
					if(response.data && response.data[0]) {
						var resourceObject = response.data[0];
						fmModel.removeItem(resourceObject);
						fmModel.addItem(resourceObject, fmModel.currentPath());
					}
				})

				.on('fileuploadfail', function(e, data) {
					// server error 500, etc.
					fm.error(lg.upload_failed);
				});
		}
	};

	var instantiateCodeMirror = function(extension) {
		var currentMode,
			assets = [];

		// if no code highlight needed, we apply default settings
		if (!config.viewer.editable.codeHighlight) {
			currentMode = 'default';
			// we highlight code according to extension file
		} else {
			if (extension === 'txt') {
				currentMode = 'default';
			}
			if (extension === 'js') {
                assets.push('/scripts/CodeMirror/mode/javascript/javascript.js');
				currentMode = 'javascript';
			}
			if (extension === 'css') {
                assets.push('/scripts/CodeMirror/mode/css/css.js');
				currentMode = 'css';
			}
			if (extension === 'html') {
                assets.push('/scripts/CodeMirror/mode/xml/xml.js');
				currentMode = 'text/html';
			}
			if (extension === 'xml') {
                assets.push('/scripts/CodeMirror/mode/xml/xml.js');
				currentMode = 'application/xml';
			}
			if (extension === 'php') {
                assets.push('/scripts/CodeMirror/mode/htmlmixed/htmlmixed.js');
                assets.push('/scripts/CodeMirror/mode/xml/xml.js');
                assets.push('/scripts/CodeMirror/mode/javascript/javascript.js');
                assets.push('/scripts/CodeMirror/mode/css/css.js');
                assets.push('/scripts/CodeMirror/mode/clike/clike.js');
                assets.push('/scripts/CodeMirror/mode/php/php.js');
				currentMode = 'application/x-httpd-php';
			}
			if (extension === 'sql') {
                assets.push('/scripts/CodeMirror/mode/sql/sql.js');
				currentMode = 'text/x-mysql';
			}
			if (extension === 'md') {
                assets.push('/scripts/CodeMirror/addon/mode/overlay.js');
                assets.push('/scripts/CodeMirror/mode/xml/xml.js');
                assets.push('/scripts/CodeMirror/mode/markdown/markdown.js');
                assets.push('/scripts/CodeMirror/mode/gfm/gfm.js');
                assets.push('/scripts/CodeMirror/mode/javascript/javascript.js');
                assets.push('/scripts/CodeMirror/mode/css/css.js');
                assets.push('/scripts/CodeMirror/mode/htmlmixed/htmlmixed.js');
                assets.push('/scripts/CodeMirror/mode/clike/clike.js');
                assets.push('/scripts/CodeMirror/mode/meta.js');
				currentMode = 'gfm';
			}
		}

        if(assets.length) {
            assets.push(runCodeMirror);
            loadAssets(assets);
        } else {
            runCodeMirror();
		}

		function runCodeMirror() {
            var editor = CodeMirror.fromTextArea(document.getElementById("fm-js-editor-content"), {
                styleActiveLine: true,
                viewportMargin: Infinity,
                lineNumbers: config.viewer.editable.lineNumbers,
                lineWrapping: config.viewer.editable.lineWrapping,
                theme: config.viewer.editable.theme,
                extraKeys: {
                    "F11": function (cm) {
                        cm.setOption("fullScreen", !cm.getOption("fullScreen"));
                    },
                    "Esc": function (cm) {
                        if (cm.getOption("fullScreen")) cm.setOption("fullScreen", false);
                    }
                }
            });

            // setup "mode"
            editor.setOption("mode", currentMode);

            fmModel.previewModel.editor.codeMirror(editor);
		}
	};

	// call the "constructor" method
	construct();

	$(window).resize(fm.setDimensions);
};
})(jQuery);

// add the plugin to the jQuery.fn object
$.fn.richFilemanager = function(options) {

	// iterate through the DOM elements we are attaching the plugin to
	return this.each(function() {

		// if plugin has not already been attached to the element
		if (undefined == $(this).data('richFilemanager')) {

			/**
			 * Creates a new instance of the plugin
			 * Pass the DOM element and the user-provided options as arguments
			 */
			var plugin = new $.richFilemanagerPlugin(this, options);

			/**
			 * Store a reference to the plugin object
			 * The plugin are available like:
			 * - element.data('richFilemanager').publicMethod(arg1, arg2, ... argn);  for methods
			 * - element.data('richFilemanager').settings.propertyName;  for properties
			 */
			$(this).data('richFilemanager', plugin);
		}
	});
};

// add location.origin for IE
if (!window.location.origin) {
	window.location.origin = window.location.protocol + "//"
		+ window.location.hostname
		+ (window.location.port ? ':' + window.location.port : '');
}
