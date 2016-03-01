/*global module,require*/
/**
 * Grunt task to replace the block between comments marked by: '<!-- bower:js -->' to '<!-- endbower -->' with files listed in bower.json (and subsequent bower.json files).
 * Use the .bowerrc file to override includes (also handy for packages that don't contain a bower.json file).
 * @example .bowerrc
{
    "directory": "vendor"
    ,"overrides": {
		"devicejs": {
			"main": ["lib/device.min.js"]
		}
	}
}
 * @example gruntTask
bower: {
	main: {
		json: 'bower.json'
		,bowerrc: '.bowerrc'
		,prefix: '../../'
		,dest: ['test/unit/index.html']
	}
}
 * @param grunt
 */
module.exports = function(grunt) {
	'use strict';

	/**
	 * Replaces the block between comments marked by: '<!-- [id]:js -->' to '<!-- end[id] -->'
	 * @param source
	 * @param replace
	 * @param id
	 * @returns {string}
	 */
	function blockReplace(source,replace,id){
		var aSource = source.split(/\r\n|\n|\r/)
			,rxStart = new RegExp('<!--\\s?'+id+':js\\s?-->')
			,rxEnd = new RegExp('<!--\\s?end'+id+'\\s?-->')
			,bStarted = false
			,iStart = -1
			,aSourceNew = aSource.filter(function(line,i){
				var bReturn = true;
				if ((bStarted?rxEnd:rxStart).test(line)) {
					bStarted = !bStarted;
					if (bStarted) iStart = i;
				} else if (bStarted) {
					bReturn = false;
				}
				return bReturn;
			})
		;
		aSourceNew.splice(iStart+1,0,replace);
		return aSourceNew.join('\n');
	}

	/**
	 * Processes bower to enqueue script
	 */
	grunt.registerMultiTask('bower', 'Processes HTML', function() {
		var fs = require('fs')
			,oData = this.data
			,sPrefix = oData.prefix!==undefined?oData.prefix:'/'
			,oBower = JSON.parse(fs.readFileSync(oData.json).toString())
			,oBowrc = JSON.parse(fs.readFileSync(oData.bowerrc).toString())
			,oOverrides = oBowrc.overrides||{}
			,sBaseUri = oBowrc.directory
			,aDst = typeof(oData.dest)==='string'?[oData.dest]:oData.dest
			,aBower = []
			,sSave
		;
		for (var dep in oBower.dependencies) {
			var oDepBower = JSON.parse(fs.readFileSync(sBaseUri+'/'+dep+'/.bower.json').toString())
				,oMain = oOverrides.hasOwnProperty(dep)&&oOverrides[dep].hasOwnProperty('main')?oOverrides[dep].main:oDepBower.main
				,aMain = isString(oMain)?[oMain]:oMain
				,sSrcBase = sBaseUri.replace(/^src\//,'')+'/'+dep+'/'
			;
			if (!oMain) {
				console.log(dep+' could not be added! Add manually or override in your .bowerrc file.'); // log
			} else {
				aMain.forEach(function(src){
					var isCDN = !!src.match(/^(http)?s?:?\/\//)
						,sSrc = isCDN?src:sPrefix+sSrcBase+(src[0]==='.'?src.substr(1):src);
					aBower.push('<script src="'+sSrc+'"></script>');
				});
			}
		}
		aDst.forEach(function(target){
			var sDst = fs.readFileSync(target).toString();
			sSave = blockReplace(sDst,aBower.join('\r\n'),'bower');
			fs.writeFileSync(target,sSave);
		});
		function isString(s){
			return typeof s==='string';
		}
	});

};