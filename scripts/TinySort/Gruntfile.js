/*global module,require*/
module.exports = function (grunt) {
	'use strict';

    // Load grunt tasks automatically
    require('load-grunt-tasks')(grunt);
	grunt.loadTasks('gruntTasks');
	require('time-grunt')(grunt);

	grunt.initConfig({

		watch: {
			gruntfile: {
				files: ['Gruntfile.js', '.jshintrc']
				,options: { spawn: false, reload: true }
			}
			,default: {
				files: ['src/*.js']
				,tasks: ['dist']
				,options: { spawn: false }
			}
			,jsdoc: {
				files: [
					'jsdoc/template/tmpl/*.tmpl'
					,'jsdoc/src/**/*'
					,'jsdoc/template/static/styles/*.css'
					,'jsdoc/**/*.md'
				]
				,tasks: ['jsdoc']
				,options: { spawn: false }
			}
		}

		// versioning
		,version_git: {
			main: {
				options: { regex: [/\d+\.\d+\.\d+/,/sVersion\s*=\s*'(\d+\.\d+\.\d+)'/] }
				,src: [
                    'src/tinysort.js'
					,'src/tinysort.charorder.js'
					,'src/jquery.tinysort.js'
					,'package.json'
					,'bower.json'
				]
			}
		}

		// command line interface
		,cli: {
			jsdoc: { cwd: './', command: '"node_modules/.bin/jsdoc" -c jsdoc.json', output: true }
			,jsdocprepare: { cwd: './jsdoc', command: 'grunt prepare', output: true }
			,jsdocInitNpm: { cwd: './jsdoc', command: 'npm install', output: true }
			,jsdocInitBower: { cwd: './jsdoc', command: 'bower install', output: true }
			,selenium: { cwd: './bin', command: 'java -jar selenium-server-standalone-2.44.0.jar', output: true }
		}

		,clean: {
			dist:	{ src: ['dist/**'] }
			,jsdoc:	{ src: ['doc/**'] }
			,temp:	{ src: ['temp/**'] }
		}

		,jshint: {
			options: { jshintrc: '.jshintrc' }
			,files: [
				'src/tinysort.js'
				,'src/tinysort.charorder.js'
				,'src/jquery.tinysort.js'
			]
		}

		,uglify: {
			tinysort: {
				options: { preserveComments: 'some' }
				,src: 'src/tinysort.js'
				,dest: 'dist/tinysort.min.js'
			}
			,charorder: {
				options: { preserveComments: 'some' }
				,src: 'src/tinysort.charorder.js'
				,dest: 'dist/tinysort.charorder.min.js'
			}
			,jquerytinysort: {
				options: { preserveComments: 'some' }
				,src: 'src/jquery.tinysort.js'
				,dest: 'dist/jquery.tinysort.min.js'
			}
			,tinysortgz: {
				options: { compress: true }
				,src: 'src/tinysort.js'
				,dest: 'dist/tinysort.jgz'
				,compress: true
			}
			,charordergz: {
				options: { compress: true }
				,src: 'src/tinysort.charorder.js'
				,dest: 'dist/tinysort.charorder.jgz'
				,compress: true
			}
		}

		,connect: {
			server: {
				options: {
					port: 9001
					,hostname: 'localhost'
					/*,onCreateServer: function (server,connect,options) {
						var io = require('socket.io').listen(server);
						io.sockets.on('connection',function (socket) {
							// do something with socket
						});
					}*/
				}
			}
		}
		,qunit: {
			all: { options: { urls: ['http://localhost:9001/test/unit/index.html'] } }
		}

		,copy: {
			src2dist: {
				files: [
					{
						expand: true
						,cwd: './src/'
						,src: ['tinysort.js','tinysort.charorder.js','jquery.tinysort.js']
						,dest: 'dist/'
						,filter: 'isFile'
						,dot: true
					}
				]
			}
			,dist2doc: {
				files: [
					{
						expand: true
						,cwd: './'
						,src: ['dist/**']
						,dest: 'doc/'
						,filter: 'isFile'
						,dot: true
					}
				]
			}
		}

		// uses Phantomjs to render pages and inject a js file
		,renderPages: {
			docs: {
				baseUri: 'doc/'
				,dest: './temp/'
				,destType: 'json'
				,pages: ['tinysort.html']
				,inject: 'src-dev/js/phantomRenderDocs.js'
				,renderImage: false
			}
		}
	});

	grunt.registerTask('default',[
		'watch'
	]);
	grunt.registerTask('test',[
		'connect'
		,'qunit'
	]);
	grunt.registerTask('dist',[
		'jshint'
		,'test'
		,'uglify'
		,'copy:src2dist'
	]);
	grunt.registerTask('jsdocInit',[
		'cli:jsdocInitNpm'
		,'cli:jsdocInitBower'
	]);
	grunt.registerTask('jsdoc',[
		'clean:jsdoc'
		,'cli:jsdocprepare'
		,'cli:jsdoc'
		,'copy:dist2doc'
		,'renderPages:docs'
		,'extendDocs'
		,'extendMarkdown'
	]);
};