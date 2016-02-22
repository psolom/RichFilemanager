'use strict';

module.exports = function(grunt) {

	// Project configuration.
	grunt.initConfig({

		// Metadata.
		pkg: grunt.file.readJSON('jquery-impromptu.jquery.json'),
		banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %>' +
			//' - <%= grunt.template.today("yyyy-mm-dd") %>\n' +
			' - <%= pkg.modified %>\n' +
			'<%= pkg.homepage ? "* " + pkg.homepage + "\\n" : "" %>' +
			'* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
			' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %> */\n',

		// Task configuration.
		clean: {
			files: ['dist']
		},
		copy: {
			dist: {
				files: [
					{ src: 'src/index.html', dest: 'dist/index.html' },
					{ src: 'src/demos/*', dest: 'dist/demos/', expand:true, flatten: true },
					{ src: 'src/themes/*', dest: 'dist/themes/', expand:true, flatten: true }
				]
			}
		},
		concat: {	
			dist: {
				options: {
					banner: '<%= banner %>',
					stripBanners: true
				},
				files: [
					{ src: 'src/<%= pkg.name %>.js', dest: 'dist/<%= pkg.name %>.js' },
					{ src: 'src/<%= pkg.name %>.css', dest: 'dist/<%= pkg.name %>.css' }
				]
			}
		},
		uglify: {
			options: {
				banner: '<%= banner %>'
			},
			dist: {
				src: 'dist/<%= pkg.name %>.js',
				dest: 'dist/<%= pkg.name %>.min.js'
			},
		},
		cssmin: {
			options: {
				//banner: '<%= banner %>'
			},
			dist: {
				src: 'dist/<%= pkg.name %>.css',
				dest: 'dist/<%= pkg.name %>.min.css'
			},
		},
		replace: {
			dist: {
				options: {
					variables: {
						version: '<%= pkg.version %>',
						timestamp: '<%= pkg.modified %>'
					},
					prefix: '@@'
				},
				files: [
					//{ src: 'dist/<%= pkg.name %>.js', dest: 'dist/<%= pkg.name %>.js' },
					//{ src: 'dist/<%= pkg.name %>.css', dest: 'dist/<%= pkg.name %>.css' },
					{ src: 'dist/index.html', dest: 'dist/index.html' }
				]
			}
		},
		jasmine: {
			src: 'src/<%= pkg.name %>.js',
			options: {
				specs: 'test/*_spec.js',
				vendor: [
						'test/lib/jquery.min.js',
						'test/lib/jasmine-jquery.js'
					]
			}
		},
		jshint: {
			gruntfile: {
				options: {
					jshintrc: '.jshintrc'
				},
				src: 'Gruntfile.js'
			},
			src: {
				options: {
					jshintrc: 'src/.jshintrc'
				},
				src: ['src/**/*.js']
			},
			test: {
				options: {
					jshintrc: 'test/.jshintrc'
				},
				src: ['test/*_spec.js']
			}
		},
		watch: {
			gruntfile: {
				files: '<%= jshint.gruntfile.src %>',
				tasks: ['jshint:gruntfile']
			},
			src: {
				files: 'src/**',//'<%= jshint.src.src %>',
				tasks: ['jshint:src', 'jasmine', 'clean', 'copy', 'concat', 'replace', 'uglify', 'cssmin']
			},
			test: {
				files: '<%= jshint.test.src %>',
				tasks: ['jshint:test', 'jasmine']
			}
		},
	});

	// These plugins provide necessary tasks.
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-replace');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-cssmin');
	grunt.loadNpmTasks('grunt-contrib-jasmine');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-watch');

	// Default task.
	grunt.registerTask('default', ['jshint', 'jasmine', 'clean', 'copy', 'concat', 'replace', 'uglify', 'cssmin']);

	// test task.
	grunt.registerTask('test', ['jshint', 'jasmine']);

};
