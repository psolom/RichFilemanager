iddqd.ns('jsdoc',(function(undefined){
	'use strict';

	var loadScript = iddqd.pattern.callbackToPromise(iddqd.loadScript)
		,toSlug = iddqd.internal.native.string.toSlug
		,createElement = iddqd.createElement
		,forEach = Array.prototype.forEach;

	function init(){
		initTableOfContents();
		initPreCode();
		initTutorials();
		//initHash();
		//initSmoothScroll();
//		loadScript('scripts/jsdoc.tinysort.js').then(function(){
//			jsdoc.tinysort();
//		});
		loadScript('scripts/jsdoc.tinysort.js').then(function(){
			jsdoc.tinysort();
		});

		/*var mClone = document.querySelector('a[href="namespaces.list.html"').parentNode
			,mRL = mClone.cloneNode(true)
			,mPrn = mClone.parentNode
			,mExp = mPrn.querySelector('a[href="#examples"').parentNode
			;
		mRL.querySelector('a').setAttribute('href','#');
		console.log('mClone',mClone); // log
		mPrn.appendChild(mRL);
		mPrn.appendChild(mExp);*/

		loadScript('http://maxcdn.bootstrapcdn.com/bootstrap/3.3.1/js/bootstrap.min.js');
		//account: 'UA-37777223-1'
		//,domain: 'sjeiti.com'
	}

	function initTableOfContents(){
		var mList = document.createDocumentFragment()
			,aList = [mList]
			,iHeaderNrLast
			,mNavBar = document.querySelector('nav.navbar')
			,iNavBar = mNavBar.offsetHeight;
		forEach.call(document.querySelectorAll('h1,h2,h3,h4,h5,h6'),function(elm){
			var sNodeName = elm.nodeName
				,iHeaderNr = parseInt(sNodeName.match(/\d+/).pop(),10)
				,bIgnore = iHeaderNr===1
				,sText = elm.textContent
				,sSlug = toSlug(sText)
				,wasH1 = false
				,mLi
			;
			if (iHeaderNr===2) iHeaderNr = 1;
			//
			var mA = createElement('div',null,null,{id:sSlug,style:'position:relative;top:-'+iNavBar+'px'});//type,classes,parent,attributes,text,click
			elm.parentNode.insertBefore(mA,elm);
//			createElement('span',null,elm,{id:sSlug,style:'position:relative;top:-50px'});//type,classes,parent,attributes,text,click
//			elm.setAttribute('id',sSlug);
			//
			if (iHeaderNrLast!==undefined) {
				if (iHeaderNr>iHeaderNrLast) {
					var mLiLast = mList.lastChild;
					wasH1 = iHeaderNrLast===1;
					if (wasH1) {
						mLiLast.classList.add('dropdown');
						var mALast = mLiLast.querySelector('a');
						mALast.classList.add('dropdown-toggle');
						mALast.setAttribute('data-toggle','dropdown');
						createElement('b','caret',mALast);
//						jQuery(mALast).dropdown();
//						jQuery(mALast).parent().dropdown();
						/*mALast.addEventListener('click',function(e){
							e.currentTarget.parentNode.classList.toggle('open');
						});*/
						mALast.removeAttribute('href'); // otherwise dropdown doesn't work
					}
					mList = createElement('ul',wasH1?'dropdown-menu':null,mLiLast,{role:'menu'});
//					mList.setAttribute('role','menu');
					aList.push(mList);
				} else if (iHeaderNr<iHeaderNrLast) {
					aList.pop();
					mList = aList[aList.length-1];
				}
			}
			iHeaderNrLast = iHeaderNr;
			mLi = createElement('li',null,mList);
			!bIgnore&&createElement('a',null,mLi,{href:'#'+sSlug},sText);
		});
		var mNav = document.querySelector('.nav.navbar-nav');
		while (mNav.firstChild) mNav.removeChild(mNav.firstChild);
		mNav.appendChild(aList[0]);
	}

	function initPreCode(){
		forEach.call(document.querySelectorAll('pre.source'),function(pre){
			var aMatchLang = pre.getAttribute('class').match(/lang-(\w+)/)
				,sLang = aMatchLang&&aMatchLang.length>1?aMatchLang[1]:'javascript'
				,mCode
			;
			pre.classList.remove('prettyprint');
			if (sLang) {
				mCode = pre.querySelector('code');
				if (mCode.textContent.split(/\n/g).length<10) {
					mCode.setAttribute('data-line',-1);
				}
				if (mCode&&!mCode.classList.contains('rainbow')) {
					mCode.setAttribute('data-language',sLang);
				} else if (mCode&&mCode.classList.contains('rainbow')) {
					console.warn('Rainbow already initialised for',mCode);
				}
			}
		});
	}

	function initTutorials(){
		/*global jsdoc*/
		var aMatchTutorial = location.pathname.match(/\/tutorial-([^.]*).html/);
		if (aMatchTutorial) {
			var sTutorial = aMatchTutorial.pop();
			if (jsdoc.tutorial.hasOwnProperty(sTutorial)) {
				jsdoc.tutorial[sTutorial]();
			}
		}
	}

	/*function initHash(){
		if (location.hash) {
			*//*setTimeout(function () {
				$(location.hash).addClass('highlight');
				$.scrollTo&&$.scrollTo(location.hash,500,{axis: 'y',offset: -50});
			},500);*//*
		}
	}

	function initSmoothScroll(){
		var amAnchors = document.querySelectorAll('a[href*=\'#\']')
			,iAnchors = amAnchors.length;
		while(iAnchors--) {
			amAnchors[iAnchors].setAttribute('data-scroll',1);
		}
	}*/

	return {init:init};
})());