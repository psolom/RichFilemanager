/**
 * Execute cordova tasks
 * @example <caption>Grunt config</caption>
cli: {
	build: { command: 'cordova build android' }
	,release: { command: 'cordova build android --release' }
	,clean: { cwd: 'platforms/android/cordova/', command: 'node clean', output: true }
}
 * @see {@link http://stackoverflow.com/questions/21557461/execute-a-batch-file-from-nodejs|Stackoverflow}
 */
module.exports = function(grunt) {
	'use strict';
	grunt.registerMultiTask('cli', 'Execute cli tasks', function() {
		if (this.data.command===undefined){
			throw grunt.util.error('No command specified.');
		}
		var done = this.async()
			,oChildExec = require('child_process').exec
			,sCommand = this.data.command
			,oOptions = {}
			,bOutput = !!this.data.output
		;
		if (this.data.cwd!==undefined) {
			oOptions.cwd = this.data.cwd;
		}
		oChildExec(sCommand, oOptions, function(error, stdout, stderr) {
			if (error) {
				console.log(stdout);
				throw grunt.util.error(stderr);
			}
			if (bOutput) {
				console.log(stdout);
			}
			/// find apk dest
			var fs = require('fs')
				,sPathApk = 'platforms/android/ant-build/'
				,sPathBuild = 'build/'
				,aMatchApk = stdout.match(/\[zipalign\].*[\n\r]*\s*\[echo\] Debug Package: (.*)/gm)
				,sFileName = (aMatchApk?aMatchApk.pop():'').split('\\').pop()
			;
			if (aMatchApk) {
				fs.writeFileSync(sPathBuild+sFileName, fs.readFileSync(sPathApk+sFileName));
				console.log('copied:',sFileName); // log
			}
			//
			done();
		});
	});
};