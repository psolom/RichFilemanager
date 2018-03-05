module.exports = function(grunt) {
    grunt.initConfig({

        uglify: {
            options: {
                compress: {
                    drop_console: true
                }
            },
            main: {
                files: {
                    'scripts/filemanager.min.js': ['scripts/filemanager.js'],
                    'scripts/jquery-ui/jquery-ui.min.js': ['scripts/jquery-ui/jquery-ui.js'],
                    'scripts/jquery.fileDownload/jquery.fileDownload.min.js': ['scripts/jquery.fileDownload/jquery.fileDownload.js'],
                    // lazyLoad script was modified to support IE9 & IE10
                    'scripts/lazyload/dist/lazyload.min.js': ['scripts/lazyload/dist/lazyload.js'],
                    'scripts/purl/purl.min.js': ['scripts/purl/purl.js'],
                    'scripts/merged.js': [
                        'scripts/jquery-1.11.3.min.js',
                        'scripts/jquery-ui/jquery-ui.js',
                        'scripts/jquery-browser.js',
                        'scripts/knockout-3.4.0.js',
                        'scripts/jquery-mousewheel/jquery.mousewheel.min.js',
                        'scripts/jquery.splitter/dist/jquery-splitter.js',
                        'scripts/jquery.contextmenu/dist/jquery.contextMenu.min.js',
                        'scripts/alertify.js/dist/js/alertify.js',
                        'scripts/clipboard.js/dist/clipboard.min.js',
                        'scripts/jquery.fileDownload/jquery.fileDownload.js',
                        'scripts/javascript-templates/js/tmpl.min.js',
                        'scripts/toast/lib/toast.min.js',
                        'scripts/cldrjs/cldr.js',
                        'scripts/cldrjs/cldr/event.js',
                        'scripts/cldrjs/cldr/supplemental.js',
                        'scripts/globalizejs/globalize.js',
                        'scripts/globalizejs/globalize/number.js',
                        'scripts/globalizejs/globalize/date.js',
                        'scripts/purl/purl.js',
                        'scripts/filemanager.js'
                    ]
                }
            }
        }

    });

    // load plugins
    grunt.loadNpmTasks('grunt-contrib-uglify');

    // default tasks
    grunt.registerTask('default', ['uglify']);
};
