/*global module,require*/
module.exports = function(grunt) {
	'use strict';

	/**
	 * Copy bower files from src to dist/web/whatever
	 */
	grunt.registerMultiTask('bowerCopy', 'Processes HTML', function() {
		var fs = require('fs')
			,oData = this.data
			,oBower = JSON.parse(fs.readFileSync(oData.json).toString())
			,oBowrc = JSON.parse(fs.readFileSync(oData.bowerrc).toString())
			,oOverrides = oBowrc.overrides||{}
			,sBaseUri = oBowrc.directory
		;
		for (var dep in oBower.dependencies) {
			var oDepBower = JSON.parse(fs.readFileSync(sBaseUri+'/'+dep+'/.bower.json').toString())
				,oMain = oOverrides.hasOwnProperty(dep)&&oOverrides[dep].hasOwnProperty('main')?oOverrides[dep].main:oDepBower.main
				,aMain = isString(oMain)?[oMain]:oMain
				,sSrcBase = sBaseUri.replace(/^src\//,'')+'/'+dep+'/'
			;
			if (!oMain) {
				console.log(dep+' could not be added, add manually!'); // log
			} else {

				aMain.forEach(function(src){
					var isCDN = !!src.match(/^(http)?s?:?\/\//)
						,sSrc = './'+sBaseUri+'/'+dep+'/'+(src[0]==='.'?src.substr(1):src)
						,sTarget = './'+oData.dest+'/'+sSrcBase+(src[0]==='.'?src.substr(1):src)
					;
					if (!isCDN) {
						copyFile(sSrc,sTarget);
					}
				});
			}
		}

		function isString(s){
			return typeof s==='string';
		}

		function copyFile(src,target) {
			var sSrc = fs.readFileSync(src)
				,sSlash = '/'
				,sTargetPath = (function(a){
					a.pop();return a.join(sSlash);
				})(target.split(sSlash))
				,aTargetPath = sTargetPath.split(sSlash)
			;
			for (var i=0,l=aTargetPath.length;i<l;i++) {
				var sSubPath = aTargetPath.slice(0,i+1).join(sSlash);
				if (!fs.existsSync(sSubPath)) fs.mkdirSync(sSubPath);
			}
			fs.writeFileSync(target,sSrc);
		}
	});

};