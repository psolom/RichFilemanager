### 2.1.1 - 02/16/2016
* Finally pushing '-expanded' and '-collapsed' events into a callback
* Adding 'filetreeinitiated' event

### 2.1.0 - 02/15/2016
* Replacing the plethora of event binding with one delegate event.

### 2.0.2 - 08/13/2015
* Add javascript function as possible data source (#19)
* Some gulpfile.js modifications
* README updated

### 2.0.1 - 06/24/2015
* Fixing test CSS URL issue
* Moved repo to its own named organization and now using that name style throughout this project (jQueryFileTree)
* Updated Bower JSON files

### 2.0.0 - 06/24/2015
* Now written with LESS and CoffeeScript (core functionality remains essentially the same)
* Using a custom easing now checks that the easing function exists, else logs error and reverts to default easing (swing). ‘Swing’ now explicitly set as default rather than NULL.
* Creating Bower project - “jqueryfiletree”
* File structure updated to be more Bower-friendly (dist, src).
* Gulp support added for compiling LESS/CS
* Updating demo page to something way more expansive and informative. Moved into `/tests/manual/` and also utilizes Bower/Gulp.
* Removing event property `trigger` (type) because it’s just as easy to get with jQuery's `event.type`
* Adding event property `container` to easily find file tree when implementing more than one on a page
* Adding option `errorMessages` to allow users to customize error message if AJAX fails
* README updated
