Rich Filemanager
========================

Rich Filemanager is an open-source file manager released under MIT license.
Based on the [simogeo Filemanager](https://github.com/simogeo/Filemanager), with a lot of improvements and new features.


Demo
----

Filemanager live example: http://fm.16mb.com/


Compatibility
-------------

Filemanager was initially designed to interact with a number of programming languages via [connectors](https://github.com/servocoder/RichFilemanager/tree/master/connectors).
But since many changes have been done recently, **only PHP connector** is the only actual connector currently. Compatibility with other connectors is most likely completely broken.
You are still able you to download unsupported v0.8 from [archive](https://github.com/simogeo/Filemanager/archive/v0.8.zip) (PHP, ASHX, ASP, CFM, lasso, PL and JSP)


Contribution
------------

Any contribution is greatly appreciated.
You can become a maintainer for any of existent connectors, or create new one for your server side language.
Check the details in [API](https://github.com/servocoder/RichFilemanager/wiki/API) section.


Main features
-------------

* A Filemanager relying on jquery.
* Available in more than 20 languages.
* [Highly customizable](https://github.com/servocoder/RichFilemanager/wiki/Filemanager-configuration-file)
* Can work as standalone application
* Easy integration with RTE like CKEditor, TinyMCE, Imperavi Redactor and so on.
* Easy integration with [AWS S3 storage](https://github.com/servocoder/RichFilemanager/wiki/Integration-with-AWS-S3-storage) to manipulate your files on remote S3 server.
* Easy integration with [colorbox jquery plugin](https://github.com/servocoder/RichFilemanager/wiki/How-to-use-the-filemanager-with-colorbox) or [HTML simple textfield](https://github.com/servocoder/RichFilemanager/wiki/How-to-use-the-filemanager-from-a-simple-textfield)
* Several computer language connectors available. **PHP is up-to-date**
* Drag-and-drop support
* Ability to upload, delete, modify, download and move files
* Ability to create folders
* Support user permissions - based on session
* Handle system permissions
* Ability to pass config user file in URL
* Multiple & chunked uploads support - based on [jQuery-File-Upload](https://github.com/blueimp/jQuery-File-Upload)
* Online text / code edition - based on [codeMirror](http://codemirror.net/)
* Online PDF & OpenOffice documents viewer - based on [viewerJS](http://viewerjs.org/)
* Online MS Office documents viewer - based on [Google Docs Viewer](http://docs.google.com/viewer/)
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
* Switch from list to grid view and vice-versa
* [CSS Themes](https://github.com/servocoder/RichFilemanager/wiki/Create-your-own-theme) - **Please, share your themes with others !**
* and more ...


Screenshot
-------------

![Filemanager Screenshot](http://i57.tinypic.com/35cqw74.png)


Documentation
-------------

Filemanager is highly documented on the [wiki pages](https://github.com/servocoder/RichFilemanager/wiki). API, see below.


Installation and Setup
----------------------

**(1)** Check out a copy of the Rich Filemanager from the repository using Git:

git clone http://github.com/servocoder/RichFilemanager.git

or download the archive from Github : https://github.com/servocoder/RichFilemanager/archive/master.zip

You can place the FileManager anywhere within your web serving root directory.


**(2)** Make a copy of the default configuration file ("filemanager.config.default.json" located in the scripts directory), removing the '.default' from the end of the filename, and edit the options according to the following wiki page : https://github.com/servocoder/RichFilemanager/wiki/Filemanager-configuration-file
   Having a look on configuration cases study may also be helpful to you : https://github.com/servocoder/RichFilemanager/wiki/Specify-user-folder%2C-configuration-cases


**(3a)** If you are integrating the FileManager with FCKEditor, open your fckconfig.js file and find the lines which specify what file browser to use for images, links, etc. Look toward the bottom of the file. You will need to change lines such as this:

```javascript
FCKConfig.ImageBrowser = false ;
FCKConfig.ImageBrowserURL = FCKConfig.BasePath + 'filemanager/browser/default/browser.html?Type=Image&Connector=../../connectors/' + _FileBrowserLanguage + '/connector.' + _FileBrowserExtension ;
```

...to this:

```javascript
FCKConfig.ImageBrowser = true ;
FCKConfig.ImageBrowserURL = '[Path to Filemanager]/index.html' ;
```


**(3b)** If you are integrating the FileManager with CKEditor 3.x or higher, simply set the URL when you configure your instance, like so:

```javascript
CKEDITOR.replace('instancename', {
	filebrowserBrowseUrl: '[Path to Filemanager]/index.html',
	...other configuration options...
});
```

If you want to use the **modal dialog mode** (instead of pop-up), please refer to [the dedicated wiki page](https://github.com/servocoder/RichFilemanager/wiki/How-to-open-the-Filemanager-from-CKEditor-in-a-modal-window).


**(3c)** If you are integrating the FileManager with TinyMCE (>= 3.0), you should:

Create a Javascript callback function that will open the FileManager index.html base page (see URL below for examples)
Add a line like: "file_browser_callback : 'name_of_callback_function'" in the tinyMCE.init command
See http://www.tinymce.com/wiki.php/TinyMCE3x:How-to_implement_a_custom_file_browser for more details.

See also the dedicated wiki page, with TinyMCE 4 sample : https://github.com/servocoder/RichFilemanager/wiki/How-to-use-the-Filemanager-with-tinyMCE-3-or-4


**(4)** Last but not least, **worry about security**!

For **PHP connector** : setup `/connectors/php/filemanager.php` to define your own authentication function.
To do so, you will find an example on the [dedicated wiki page](https://github.com/servocoder/RichFilemanager/wiki/Security-concern).
(optional) Check `/connectors/php/config.php` to enable desired plugin or setup some server-side related settings.

**jQuery dependency and compatibility**

We try to keep updating jQuery core library regularly.
If, for any reason, you can't use the embedded jQuery version just now that the Filemanager will probably work with a jQuery version >= 1.6.
You'll have to use the [jQuery.migrate() plugin](https://github.com/jquery/jquery-migrate) to use it with jQuery version 1.9+.


Set-up & security
-----------------

**Important** : The Filemanager is designed to work without any special configuration but **using it without any configuration is VERY unsafe**.
Please set-up your own **authentication function**, based on [default file](https://github.com/servocoder/RichFilemanager/blob/master/connectors/php/filemanager.php) and refering to the [dedicated wiki page](https://github.com/servocoder/RichFilemanager/wiki/Security-concern).


MIT LICENSE
-----------

Released under the [MIT license](http://opensource.org/licenses/MIT).