Rich Filemanager
========================

Rich Filemanager is an open-source file manager released under MIT license.
Based on the @simogeo [Filemanager](https://github.com/simogeo/Filemanager), with a lot of improvements and new features:

* Drag-and-drop support
* Clipboard feature: copy, cut, paste, clear
* Selectable files & folders support (mouse dragging & Ctrl key)
* Multiple actions support for selected files & folders: move, delete, download
* Before and After callback functions for some actions
* Double or single click setup to open files & folders
* Integration with AWS S3 storage
* Integration with Imperavi Redactor WYSIWYG editor
* Multiple & chunked uploads support - based on jQuery-File-Upload
* New design of multiple upload window; New upload controls for each previewed file (start, abort, resume, delete, etc.)
* Filetree: allow to open and display multiple subfolders at a time
* Online MS Office documents viewer - based on Google Docs Viewer
* Extended list of previewed file types via ViewerJS
* Standardized API that follows JSON API best practices to create connectors for any server-side language
* Independent client and server sides. Can be located on different servers.
* Independent configuration files for client and server sides.
* Client-side configuration options may be overwritten with server-side ones using PHP connector.
* Implemented plugins system for PHP connector (server-based)
* Added new "Type" column in the list view
* Added ability to limit max size of the storage (root folder)
* Implemented natural sorting on the client-side

To see the full list check out [changelog file](https://github.com/servocoder/RichFilemanager/blob/master/changelog).


Demo
----

Filemanager live example: http://fm.devale.pro


Compatibility
-------------

Filemanager was initially designed to interact with a number of programming languages via [connectors](https://github.com/servocoder/RichFilemanager/tree/master/connectors).
But since many changes have been done recently, **PHP & ASHX connectors** are the only actual connectors currently. Compatibility with other connectors is most likely completely broken.
You are still able you to download unsupported v0.8 from [archive](https://github.com/simogeo/Filemanager/archive/v0.8.zip) (PHP, ASHX, ASP, CFM, lasso, PL and JSP)

Browser compatibility:

* IE9+
* Chrome
* FireFox
* Opera


Installation and Setup
----------------------

* [Deploy and setup RichFilemanager on your website](https://github.com/servocoder/RichFilemanager/wiki/Deploy-and-setup)
* [Discover complete configuration guidelines](https://github.com/servocoder/RichFilemanager/wiki/Configuration-options)
* [Worry about security of your application](https://github.com/servocoder/RichFilemanager/wiki/Security-concern)


Documentation
-------------

Filemanager is highly documented on the [wiki pages](https://github.com/servocoder/RichFilemanager/wiki). API, see below.


Main features
-------------

* Available in more than 20 languages.
* [Highly customizable](https://github.com/servocoder/RichFilemanager/wiki/Configuration-options)
* Can work as standalone application
* Easy integration with WYSIWYG editors like CKEditor, TinyMCE, Imperavi Redactor and so on.
* Easy integration with [AWS S3 storage](https://github.com/servocoder/RichFilemanager/wiki/Integration-with-AWS-S3-storage) to manipulate your files on remote S3 server.
* Easy integration with [colorbox jquery plugin](https://github.com/servocoder/RichFilemanager/wiki/How-to-use-the-filemanager-with-colorbox) or [HTML simple textfield](https://github.com/servocoder/RichFilemanager/wiki/How-to-use-the-filemanager-from-a-simple-textfield)
* 2 view modes: grid and list
* Drag-and-drop support
* Clipboard feature: copy, cut, paste, clear
* Single file actions: upload, modify, move, delete, download
* Single folder actions: create, modify, move, delete, download (zip archive)
* Selectable support for files & folders (mouse dragging & Ctrl key)
* Multiple actions support for selected files & folders: move, delete, download
* Support user permissions - based on session
* Handle system permissions
* Ability to pass config user file in URL
* Multiple & chunked uploads support - based on [jQuery-File-Upload](https://github.com/blueimp/jQuery-File-Upload)
* Online text / code edition - based on [codeMirror](http://codemirror.net/)
* Online PDF & OpenOffice documents viewer - based on [viewerJS](http://viewerjs.org/)
* Online MS Office documents viewer - based on [Google Docs Viewer](http://docs.google.com/viewer/)
* Several server-side language connectors available. **PHP & ASHX are up-to-date**
* Standardized API that follows JSON API best practices to create connectors for any server-side language
* Independent client and server sides. Can be located on different servers.
* [Opening a given folder](https://github.com/servocoder/RichFilemanager/wiki/How-to-open-a-given-folder-different-from-root-folder-when-opening-the-filemanager)
* [Opening exclusively a given folder](https://github.com/servocoder/RichFilemanager/wiki/How-to-open-%28exclusively%29-a-given-subfolder)
* [Passing parameters to the FM](https://github.com/servocoder/RichFilemanager/wiki/Passing-parameters-to-the-FM)
* [File types restriction](https://github.com/servocoder/RichFilemanager/wiki/Set-up-upload-restriction-on-file-type)
* Video and audio player relying on web browser capabilities
* Textbox Search filter
* Thumbnails generation
* Image auto-resize
* File size limit
* File exclusion based on name and patterns
* Images files only
* Prevent files overwriting (or not)
* Copy direct file URL
* [CSS Themes](https://github.com/servocoder/RichFilemanager/wiki/Create-your-own-theme) - **Please, share your themes with others !**
* and more ...


Screenshot
-------------

![Filemanager Screenshot](http://i57.tinypic.com/35cqw74.png)


Contribution
------------

Any contribution is greatly appreciated.
You can become a maintainer for any of existent connectors, or create new one for your server side language.
Check the details in [API](https://github.com/servocoder/RichFilemanager/wiki/API) section.


MIT LICENSE
-----------

Released under the [MIT license](http://opensource.org/licenses/MIT).