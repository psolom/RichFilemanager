/*global module,require*/
module.exports = function (grunt) {
	'use strict';

	grunt.registerTask('extendDocs','',function () {
		var fs = require('fs')
			,fileSrc = './src/tinysort.js'
			,fileJson = './temp/tinysort.json'
			,docIndex = './doc/index.html'
			,parse = require('jsdoc-parse')
			,parsed = parse({
				src:fileSrc
				//,stats:true
				//,private:true
			})
			,writeStream = fs.createWriteStream(fileJson)
			,done = this.async()
			,options = ''
		;
		parsed.on('readable',parsed.pipe.bind(parsed,writeStream));
		parsed.on('end',function(e) {
			var parsedJson = JSON.parse(fs.readFileSync(fileJson).toString());
			parsedJson.forEach(function(o){
				if (o.id==='tinysort.tinysort') {
					o.params.forEach(function(param){
						console.log('param\n\t'
							,param.name
							,'\n\t=',param.defaultvalue
							,'\n\t',param.description
							,'\n\t',param.optional
							,'\n\t',param.type.names
							,'\n\t'
						); // todo: remove log
						var name = param.name
							,type = param.type.names.join(',')
							,defaultvalue = param.defaultvalue||''
							,description = param.description;
						options += '<dt id="option-'+name+'">aha<a href="#option-'+name+'"">'+name+'</a><small class="option-type" title="type">'+type+'</small><small class="option-default" title="default: '+defaultvalue+'">'+defaultvalue+'</small></dt>';
						options += '<dd>'+description+'</dd>';
					});
					var fileNew = fs.readFileSync(docIndex).toString().replace(/{{options}}/,'<dl class="dl-horizontal options">'+options+'</dl>');
					fs.writeFileSync(docIndex,fileNew);
				}
			});
			done();
		});
	});
};