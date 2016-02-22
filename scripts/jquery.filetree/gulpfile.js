var gulp = require('gulp');
var coffee = require('gulp-coffee');
var gutil = require('gulp-util');
var uglify = require('gulp-uglify');
var rename = require("gulp-rename");
var minifyCss = require('gulp-minify-css');
var less = require('gulp-less');
var fs = require('fs');
//var changed = require('gulp-changed'); // doesn't seem to work; ALWAYS runs regardless

// compile LESS
gulp.task('less', function () {
    // jqueryfiletree assets
    return gulp.src('src/less/*.less')
        //.pipe(changed('dist'), {extension: '.min.css'})
        .pipe(less())
        .pipe(gulp.dest('src'))
        .pipe(minifyCss())
        .pipe(rename( {extname: '.min.css'} ))
        .pipe(gulp.dest('dist'))
});

// compile coffeescript
gulp.task('coffee', function() {
    return gulp.src('src/coffeescript/*.coffee')
        //.pipe(changed('dist'), {extension: '.min.js'})
        .pipe(coffee({bare: true}).on('error', gutil.log))
        .pipe(gulp.dest('src'))
        .pipe(uglify( {preserveComments: 'some'} ))
        .pipe(rename({ extname: '.min.js' }))
        .pipe(gulp.dest('dist'))
});

// 'gulp default' (or just 'gulp') will both build coffee/less, then reset test suite if applicable
gulp.task('default', ['coffee', 'less'], function(){
    // do if the test suite is set up
    attempt.test(function(){
        // copy images, connectors, and min files to tests/manual folder
        gulp.src(['dist/images/**', 'dist/connectors/**'], {base: 'dist'})
            //.pipe(changed('tests/manual'))
            .pipe(gulp.dest('tests/manual'));

        // compile skeleton & demo LESS files
        gulp.src(['tests/manual/bower_components/skeleton-less/less/*.less', 'tests/manual/css/less/*.less'])
            //.pipe(changed('tests/manual/css'), {extension: '.css'})
            .pipe(less())
            .pipe(gulp.dest('tests/manual/css'));

        // copy jQueryFileTree.min.css to test folder (if changed)
        gulp.src('dist/*.min.css')
            //.pipe(changed('tests/manual'))
            .pipe(gulp.dest('tests/manual'));

        // copy jQueryFileTree.min.js to test folder (if changed)
        gulp.src('dist/*.min.js')
            //.pipe(changed('tests/manual'))
            .pipe(gulp.dest('tests/manual'));
    });
});

// try/catch closure
var attempt = {
    // execute callback only if test suite is set up
    test: function(callback) {
        try {
            // Query if tests/bower_components is installed (else, that needs to be set up first)
            stats = fs.lstatSync('tests/manual/bower_components');

            // if bower is set up, the test suite is setup and we can run the test scripts
            if (stats.isDirectory()) {
                callback();
            }
        }
        catch (e) {
            // don't do anything with errors yet
        }
    }
}
