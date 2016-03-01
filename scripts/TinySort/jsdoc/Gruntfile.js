/* global module, require */
/* jshint strict: false */
module.exports = function (grunt) {

    // Load grunt tasks automatically
	require('load-grunt-tasks')(grunt, {pattern: ['grunt-*','!grunt-lib-phantomjs']});
	grunt.loadTasks('gruntTasks');

	var aJS = [
		'src/js/sk123ow.js'
		,'src/js/sk123ow.lang.js'
	];

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json')

		// watchers
		,watch: {
			gruntfile: {
				files: ['Gruntfile.js', '.jshintrc'],
				options: { spawn: false, reload: true }
			}
			/*js: {
				files: ['src/js*//*.js'],
				tasks: ['js'],
				options: { spawn: false }
			},
			less: {
				files: ['src/style*//*.less']
				,tasks: ['css']
				,options: { spawn: false }
			},
			jsdoc: {
				files: [
					'jsdoc/template/static/styles*//*.less'
					,'jsdoc/template/tmpl*//*.tmpl'
					,'jsdoc/tutorials*//**'
					,'jsdoc*//*.md'
				]
				,tasks: ['jsdoc']
				,options: { spawn: false }
			},
			template: {
				files: ['src/widget.html','style/main.css']
				,tasks: ['updateTemplate']
				,options: { spawn: false }
			},
			revision: {
				files: ['.git/COMMIT_EDITMSG']
				,tasks: ['revision']
				,options: { spawn: false }
			},
			bower: {
				files: ['.bowerrc','bower.json']
				,tasks: ['bower']
				,options: { spawn: false }
			},
			lang: {
				files: ['lang*//*.po']
				,tasks: ['po_json']
				,options: { spawn: false }
			}*/
		}

		// command line interface
		,cli: {
			//jsdoc: { cwd: './', command: 'jsdoc -c jsdoc.json', output: true }
		}

		// update revision
		,version_git: {
			main: {
				files: {src:aJS[0]}
			}
			,mainVar: {
				files: {src:aJS[0]}
				,options: {regex: /sVersion\s*=\s*'(\d+\.\d+\.\d+)'/}
			}
		}

		// js-hint
		,jshint: {
			options: { jshintrc: '.jshintrc' },
			files: aJS
		}

		// clean
		,clean: {
			static: {
				src: ['template/static/**']
			}
		}

        // inject Bower components into HTML
		,bower: {
			main: {
				json: 'bower.json'
				,bowerrc: '.bowerrc'
				,prefix: ''
				,dest: ['template/tmpl/layout.tmpl']
			}
		}

        // inject Bower components into HTML
		,bowerCopy: {
			main: {
				json: 'bower.json',
				bowerrc: '.bowerrc',
				dest: 'template/static'
			}
		}

        // concatenate Bower components to single file
		,bowerConcat: {
			main: {
				json: 'bower.json',
				bowerrc: '.bowerrc',
				dest: 'temp/vendor.concat.js'
			}
		}

		// insert variables into js
		/*,insert_vars: {
			main: {
				file: aJS[0]
				,replace: {
					'sHTML': ['temp/widget.html']
					,'sCSS': ['src/style/main.css']
				}
			}
		}*/

		// copy all the stuff
		,copy: {
			js: {
				files: [
					{
						expand: true
						,cwd: 'src/js/'
						,src: ['*']
						,dest: 'template/static/scripts/'
						,filter: 'isFile'
						,dot: true
					}
				]
			}
			,html: {
				files: [
					{
						expand: true
						,cwd: 'src/'
						,src: ['*.html']
						,dest: 'template/static/'
						,filter: 'isFile'
						,dot: true
					}
				]
			}
		}

		// concatenate and minify
		,uglify: {
			src: {
				options: { banner: '' }
				,src: 'src/js/*.js'
				,dest: 'template/static/scripts/main.min.js'
			}
			,vendor: {
				options: { banner: '' }
				,src: ['temp/vendor.concat.js'].concat(aJS)
				,dest: 'template/static/scripts/vendor.min.js'
			}
		}

		// compile less
		,less: {
			options: {
				compress: true
			}
			,src: {
				src: ['src/style/site.sjeiti.less'],
				dest: 'template/static/styles/site.sjeiti.css'
			}
		}

	});

	grunt.registerTask('default',['js']);
	grunt.registerTask('js',[
		'jshint'
		,'copy:js'
	]);
	grunt.registerTask('bw',[
		'bower'
		,'bowerCopy'
	]);
	grunt.registerTask('prepare',[
		'less'
		,'js'
		,'bw'
		,'uglify:src'
		,'copy:html'
	]);

};