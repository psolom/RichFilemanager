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
                    'scripts/purl/purl.min.js': ['scripts/purl/purl.js']
                }
            }
        }

    });

    // load plugins
    grunt.loadNpmTasks('grunt-contrib-uglify');

    // default tasks
    grunt.registerTask('default', ['uglify']);
};