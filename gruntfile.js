module.exports = function (grunt) {
    grunt.initConfig({
        copy: {
            main: {
                files: [
                    {
                        expand: true,
                        flatten: true,
                        src: ['node_modules/codemirror/theme/*'],
                        dest: 'src/css/codemirror-theme',
                        filter: 'isFile'
                    },
                    {
                        expand: true,
                        flatten: true,
                        src: ['node_modules/highlightjs/highlight.pack.min.js'],
                        dest: 'src/js',
                        filter: 'isFile'
                    },
                ]
            }
        },
        sass: {
            options: {
                outputStyle: 'compressed',
                includePaths: [
                    'src/css',
                    'libs'
                ]
            },
            dist: {
                files: {
                    'src/css/libs-main.css': 'src/scss/libs-main.scss',
                    'src/css/codemirror.min.css': 'src/scss/codemirror.scss',
                    'src/css/filemanager.min.css': 'src/css/filemanager.css',
                    'src/css/highlight.min.css': 'node_modules/highlightjs/styles/default.css'
                }
            }
        },
        uglify: {
            options: {
                compress: {
                    drop_console: true
                }
            },
            main: {
                files: {
                    // lazyLoad script was modified to support IE9 & IE10
                    'libs/lazyload/dist/lazyload.min.js': ['libs/lazyload/dist/lazyload.js'],
                    'src/js/filemanager.min.js': ['src/js/filemanager.js'],
                    'src/js/libs-main.js': [
                        'node_modules/jquery/dist/jquery.min.js',
                        <!-- drag&drop + selectable build (includes customizations for RichFilemanager) -->
                        'libs/jquery-ui.js',
                        'libs/jquery-browser.js',
                        'node_modules/knockout/build/output/knockout-latest.js',
                        'node_modules/jquery-mousewheel/jquery.mousewheel.js',
                        'node_modules/jquery-splitter/dist/jquery-splitter.min.js',
                        'node_modules/jquery-contextmenu/dist/jquery.contextMenu.min.js',
                        'libs/alertify.js/dist/js/alertify.js',
                        'node_modules/clipboard/dist/clipboard.min.js',
                        'node_modules/jquery-file-download/src/Scripts/jquery.fileDownload.js',
                        'node_modules/blueimp-tmpl/js/tmpl.min.js',
                        'node_modules/pyrsmk-toast/lib/toast.min.js',
                        'libs/cldrjs/cldr.js',
                        'libs/cldrjs/cldr/event.js',
                        'libs/cldrjs/cldr/supplemental.js',
                        'node_modules/globalize/dist/globalize.js',
                        'node_modules/globalize/dist/globalize/number.js',
                        'node_modules/globalize/dist/globalize/date.js',
                        'node_modules/@allmarkedup/purl/purl.js'
                    ],
                    'src/js/libs-fileupload.js': [
                        'node_modules/blueimp-load-image/js/load-image.js',
                        'node_modules/blueimp-load-image/js/load-image-meta.js',
                        'node_modules/blueimp-load-image/js/load-image-exif.js',
                        'node_modules/blueimp-file-upload/js/vendor/jquery.ui.widget.js',
                        'node_modules/blueimp-file-upload/js/canvas-to-blob.min.js',
                        'node_modules/blueimp-file-upload/js/load-image.all.min.js',
                        'node_modules/blueimp-file-upload/js/jquery.iframe-transport.js',
                        'node_modules/blueimp-file-upload/js/jquery.fileupload.js',
                        'node_modules/blueimp-file-upload/js/jquery.fileupload-process.js',
                        'node_modules/blueimp-file-upload/js/jquery.fileupload-image.js',
                        'node_modules/blueimp-file-upload/js/jquery.fileupload-validate.js'
                    ],
                    'src/js/markdown-it.min.js': [
                        'node_modules/markdown-it/dist/markdown-it.js',
                        'node_modules/markdown-it-footnote/dist/markdown-it-footnote.js',
                        'node_modules/markdown-it-replace-link/dist/markdown-it-replace-link.js'
                    ],
                    'src/js/jquery.mCustomScrollbar.min.js': [
                        'node_modules/malihu-custom-scrollbar-plugin/jquery.mCustomScrollbar.js'
                    ],
                    'src/js/codemirror.min.js': [
                        'node_modules/codemirror/lib/codemirror.js',
                        'node_modules/codemirror/addon/selection/active-line.js',
                    ],
                    'src/js/codemirror-modes.min.js': [
                        'node_modules/codemirror/addon/mode/overlay.js',
                        'node_modules/codemirror/mode/javascript/javascript.js',
                        'node_modules/codemirror/mode/css/css.js',
                        'node_modules/codemirror/mode/xml/xml.js',
                        'node_modules/codemirror/mode/htmlmixed/htmlmixed.js',
                        'node_modules/codemirror/mode/clike/clike.js',
                        'node_modules/codemirror/mode/php/php.js',
                        'node_modules/codemirror/mode/sql/sql.js',
                        'node_modules/codemirror/mode/markdown/markdown.js',
                        'node_modules/codemirror/mode/gfm/gfm.js',
                        'node_modules/codemirror/mode/shell/shell.js',
                        'node_modules/codemirror/mode/meta/meta.js',
                    ]
                }
            }
        }

    });

    // load plugins
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-sass');

    // default tasks
    grunt.registerTask('default', ['copy', 'uglify', 'sass']);
};
