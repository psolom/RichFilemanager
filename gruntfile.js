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
                    'scripts/filemanager.min.js': ['scripts/filemanager.js']
                }
            }
        }

    });

    // load plugins
    grunt.loadNpmTasks('grunt-contrib-uglify');

    // default tasks
    grunt.registerTask('default', ['uglify']);
};