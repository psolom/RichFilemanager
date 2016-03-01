/*global module,require*/
module.exports = function(grunt) {
'use strict';
	grunt.registerMultiTask('renderPages', 'Render pages with PhantomJS', function(){
		var done = this.async()
			,exec = require('child_process').exec
			,fs = require('fs')
			,mkdirp = require('mkdirp')
			//
			,data = this.data
			,sInject = data.inject
			,sBaseUri = data.baseUri //||'http://localhost.ttl/'
			,sTargetPath = data.dest||'render/'
			,sDestType = data.destType||''
			,aPages = data.pages
			,bRenderImage = data.renderImage||false
			//
			,iPages = aPages?aPages.length:0
			,iPage = 0
			//
			,sUrl
			,sName
			,sTarget
		;

		// check if target path exists
		mkdirp(sTargetPath,function (err) {
			err&&console.error(err);
		});

		nextPage();

		function handleWriteHTML(err){
			console.log(err||'file '+(iPages-iPage)+' \''+sTarget+'\' saved');
			whatNext();
		}

		function whatNext(){
			iPage++;
			if (iPage>=iPages) {
				done();
			} else {
				nextPage();
			}
		}

		function nextPage(){
			sUrl = sBaseUri+aPages[iPage];//'http://localhost/studieKeuze123/src/clean.html';//sBaseUri+aPages[iPage];
			sName = sUrl.split('/').pop();
			sTarget = sName.indexOf(sName)===-1?sName+'.html':sName;
			console.log('rendering:',sUrl); // log
			var aExec = ['phantomjs',sInject,sUrl];
//			var aExec = ['phantomjs','src/js/phantomRender.js',sUrl];
			bRenderImage&&aExec.push(sTargetPath);
			exec(aExec.join(' '), handleExecPhantomRender);
		}

		function handleExecPhantomRender(error, stdout){//, stderr){
			// save the file
			if (sDestType!=='') sTarget = sTarget.replace(/\.\w+$/,'.'+sDestType);
			console.log('writing:',sTargetPath+sTarget); // log
			fs.writeFile(sTargetPath+sTarget, stdout, handleWriteHTML);
		}
	});
};
