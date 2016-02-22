describe('jquery-impromptu', function() {

	// ====================================================================================
	// ====================================================================================
	describe('base structure', function(){

		// ====================================================================================
		describe('basic initialization', function() {

			beforeEach(function() {			
				$.fx.off = true; // for our testing lets turn off fx
			});

			afterEach(function() {
				$.prompt.close();
			});

			it('should be defined', function() {
				
				expect($.prompt).not.toBeUndefined();
			});

			it('should generate markup', function() {
				var expectedTitle = 'This is a title',
					expectedText = 'This is a test';

				$.prompt(expectedText, { title: expectedTitle });

				expect($('.jqibox')).toExist();
				expect($('.jqifade')).toExist();
				expect($('.jqi')).toExist();
				expect($('.jqi .jqititle')).toHaveText(expectedTitle);
				expect($('.jqi .jqimessage')).toHaveText(expectedText);
			});

		});

		// ====================================================================================
		describe('instance initialization', function() {
			var imp = new Impromptu();

			beforeEach(function() {			
				$.fx.off = true; // for our testing lets turn off fx
			});

			afterEach(function() {
				imp.close();
			});

			it('should be defined', function() {
				
				expect(imp).not.toBeUndefined();
			});

			it('should generate markup', function() {
				var expectedTitle = 'This is a title',
					expectedText = 'This is a test';

				imp.open(expectedText, { title: expectedTitle });

				expect($('.jqibox')).toExist();
				expect($('.jqifade')).toExist();
				expect($('.jqi')).toExist();
				expect($('.jqi .jqititle')).toHaveText(expectedTitle);
				expect($('.jqi .jqimessage')).toHaveText(expectedText);
			});

		});


		// ====================================================================================
		describe('button creation', function() {

			beforeEach(function() {			
				$.fx.off = true; // for our testing lets turn off fx
			});

			afterEach(function() {
				$.prompt.close();
			});


			it('should generate buttons from hash', function() {

				$.prompt('This is a test', {
					buttons: { Ok:true, Cancel:false }
				});
				var okBtn = $('button[name="jqi_state0_buttonOk"]'),
					cancelBtn = $('button[name="jqi_state0_buttonCancel"]');

				expect($('.jqibutton')).toHaveLength(2);

				expect(okBtn).toExist();
				expect(cancelBtn).toExist();

				expect(okBtn).toHaveText('Ok');
				expect(cancelBtn).toHaveText('Cancel');

				expect(okBtn).toHaveValue('true');
				expect(cancelBtn).toHaveValue('false');
			});

			it('should generate buttons from array', function() {

				$.prompt('This is a test', {
					buttons: [
						{ title: 'Ok', value: true },
						{ title: 'Cancel', value: false }
					]
				});
				var okBtn = $('button[name="jqi_state0_buttonOk"]'),
					cancelBtn = $('button[name="jqi_state0_buttonCancel"]');

				expect($('.jqibutton')).toHaveLength(2);

				expect(okBtn).toExist();
				expect(cancelBtn).toExist();

				expect(okBtn).toHaveText('Ok');
				expect(cancelBtn).toHaveText('Cancel');

				expect(okBtn.val()).toBe('true');
				expect(cancelBtn.val()).toBe('false');
			});

			it('should add classes to buttons', function() {

				$.prompt('This is a test', {
					buttons: [
						{ title: 'Ok', value: true, classes: ['ok1','ok2'] },
						{ title: 'Cancel', value: false, classes: 'cancel1 cancel2' }
					]
				});
				var okBtn = $('button[name="jqi_state0_buttonOk"]'),
					cancelBtn = $('button[name="jqi_state0_buttonCancel"]');

				expect(okBtn).toHaveClass('ok1');
				expect(okBtn).toHaveClass('ok2');

				expect(cancelBtn).toHaveClass('cancel1');
				expect(cancelBtn).toHaveClass('cancel2');
			});

			it('should add classes to buttons from classes obj', function() {

				$.prompt('This is a test', {
					buttons: [
						{ title: 'Ok', value: true, classes: ['ok1','ok2'] },
						{ title: 'Cancel', value: false, classes: 'cancel1 cancel2' }
					],
					classes: { button: 'testclass' }
				});
				var okBtn = $('button[name="jqi_state0_buttonOk"]'),
					cancelBtn = $('button[name="jqi_state0_buttonCancel"]');

				expect(okBtn).toHaveClass('testclass');
				expect(cancelBtn).toHaveClass('testclass');
			});

			it('should default correct button', function() {

				$.prompt('This is a test', {
					buttons: [
						{ title: 'Ok', value: 1 },
						{ title: 'Cancel', value: 2 },
						{ title: 'Another', value: 3 }
					],
					focus: 1
				});
				var okBtn = $('button[name="jqi_state0_buttonOk"]'),
					cancelBtn = $('button[name="jqi_state0_buttonCancel"]'),
					anotherBtn = $('button[name="jqi_state0_buttonAnother"]');

				expect(okBtn).not.toHaveClass('jqidefaultbutton');
				expect(cancelBtn).toHaveClass('jqidefaultbutton');
				expect(anotherBtn).not.toHaveClass('jqidefaultbutton');
			});

			it('should default correct button when focus on an input', function() {

				$.prompt('This is a test <input type="text" id="testInput" />', {
					buttons: [
						{ title: 'Ok', value: 1 },
						{ title: 'Cancel', value: 2 },
						{ title: 'Another', value: 3 }
					],
					focus: '#testInput',
					defaultButton: 1
				});
				var okBtn = $('button[name="jqi_state0_buttonOk"]'),
					cancelBtn = $('button[name="jqi_state0_buttonCancel"]'),
					anotherBtn = $('button[name="jqi_state0_buttonAnother"]');

				expect(okBtn).not.toHaveClass('jqidefaultbutton');
				expect(cancelBtn).toHaveClass('jqidefaultbutton');
				expect(anotherBtn).not.toHaveClass('jqidefaultbutton');
			});

		});

		// ====================================================================================
		describe('state creation', function() {

			beforeEach(function() {			
				$.fx.off = true; // for our testing lets turn off fx
			});

			afterEach(function() {
				$.prompt.close();
			});

			it('should create a single state from string', function() {

				$.prompt('This is a test');
				
				expect($('.jqistate')).toExist();
			});

			it('should create states from hash', function() {
				var states = {
					s1: { html: 'state 1' },
					s2: { html: 'state 2' },
					s3: { html: 'state 3' }
				};

				$.prompt(states);
				
				expect($('.jqistate')).toHaveLength(3);

				expect($('.jqistate[data-jqi-name="s1"] .jqimessage')).toHaveText(states.s1.html);
				expect($('.jqistate[data-jqi-name="s2"] .jqimessage')).toHaveText(states.s2.html);
				expect($('.jqistate[data-jqi-name="s3"] .jqimessage')).toHaveText(states.s3.html);
			});

			it('should create states from array', function() {
				var states = [
					{ html: 'state 1' },
					{ html: 'state 2' },
					{ html: 'state 3' }
				];

				$.prompt(states);
				
				expect($('.jqistate')).toHaveLength(3);

				expect($('.jqistate[data-jqi-name="0"] .jqimessage')).toHaveText(states[0].html);
				expect($('.jqistate[data-jqi-name="1"] .jqimessage')).toHaveText(states[1].html);
				expect($('.jqistate[data-jqi-name="2"] .jqimessage')).toHaveText(states[2].html);
			});

			it('should show the first state automatically', function() {

				// we can't reliably determine which entry is the first with a hash, js doesn't preserve order
				var states = [
					{ html: 'state 1' },
					{ html: 'state 2' },
					{ html: 'state 3' }
				];

				$.prompt(states);

				expect($('.jqistate[data-jqi-name="0"]')).toHaveCss({display:'block'});
				expect($('.jqistate[data-jqi-name="1"]')).toHaveCss({display:'none'});
				expect($('.jqistate[data-jqi-name="2"]')).toHaveCss({display:'none'});
			});

			it('should name states properly when name specified', function() {
				var states = [
					{ name: 's1', html: 'state 1' },
					{ name: 's2', html: 'state 2' },
					{ name: 's3', html: 'state 3' }
				];

				$.prompt(states);
				
				expect($('.jqistate[data-jqi-name="s1"]')).toExist();
				expect($('.jqistate[data-jqi-name="s2"]')).toExist();
				expect($('.jqistate[data-jqi-name="s3"]')).toExist();
			});
		});

	}); // base structure


	// ====================================================================================
	// ====================================================================================
	describe('api methods', function() {
		var states = [
				{ name: 's1', html: 'state 1' },
				{ name: 's2', html: 'state 2' },
				{ name: 's3', html: 'state 3' }
			];

		beforeEach(function() {			
			$.fx.off = true; // for our testing lets turn off fx
		});

		afterEach(function() {
			$.prompt.close();
		});

		describe('static methods', function() {
			// ====================================================================================
			describe('$.prompt.setDefaults()', function() {
				it('should change the default values', function() {
					var origDefs = $.extend(true, {}, Impromptu.defaults),
						overrides = { prefix: 'myjqi', classes: { box: 'boxclass' } };
					
					$.prompt.setDefaults(overrides);

					expect(Impromptu.defaults.prefix).toBe(overrides.prefix);
					expect(Impromptu.defaults.classes.box).toBe(overrides.classes.box);
					expect(Impromptu.defaults.speed).toBe(origDefs.speed);

					Impromptu.defaults = origDefs;
				});
			});
			
			// ====================================================================================
			describe('$.prompt.setStateDefaults()', function() {
				it('should change the default state values', function() {
					var origDefs = $.extend(true, {}, Impromptu.defaults),
						overrides = { title: 'My Title', position: { width: 123 } };
					
					$.prompt.setStateDefaults(overrides);

					expect(Impromptu.defaults.state.title).toBe(overrides.title);
					expect(Impromptu.defaults.state.position.width).toBe(overrides.position.width);
					expect(Impromptu.defaults.state.focus).toBe(origDefs.state.focus);

					Impromptu.defaults = origDefs;
				});
			});
		});

		describe('instance methods', function() {
			// ====================================================================================
			describe('$.prompt.getBox()', function() {
				it('should return the box jquery object', function() {
					
					$.prompt('This is a test');

					var actualResult = $.prompt.getBox(),
						expectedResult = $('.jqibox');

					expect(actualResult[0]).toBe(expectedResult[0]);
				});
			});

			// ====================================================================================
			describe('$.prompt.getPrompt()', function() {
				it('should return the prompt jquery object', function() {
					
					$.prompt('This is a test');

					var actualResult = $.prompt.getPrompt(),
						expectedResult = $('.jqi');

					expect(actualResult[0]).toBe(expectedResult[0]);
				});
			});

			// ====================================================================================
			describe('$.prompt.getState()', function() {
				it('should return the state jquery object', function() {

					$.prompt(states);
					
					var actualResult = $.prompt.getState('s2'),
						expectedResult = $('.jqistate[data-jqi-name="s2"]');

					expect(actualResult[0]).toBe(expectedResult[0]);
				});
			});

			// ====================================================================================
			describe('$.prompt.getCurrentState()', function() {
				it('should return the current state jquery object', function() {

					$.prompt(states);
					
					var actualResult = $.prompt.getCurrentState(),
						expectedResult = $('.jqistate[data-jqi-name="s1"]');

					expect(actualResult[0]).toBe(expectedResult[0]);
				});

				it('should return the current state jquery object after a state change', function() {

					$.prompt(states);
					$.prompt.goToState('s2');
					var actualResult = $.prompt.getCurrentState(),
						expectedResult = $('.jqistate[data-jqi-name="s2"]');

					expect(actualResult[0]).toBe(expectedResult[0]);
				});
			});

			// ====================================================================================
			describe('$.prompt.getCurrentStateName()', function() {
				it('should return the current state name', function() {

					$.prompt(states);
					
					var actualResult = $.prompt.getCurrentStateName(),
						expectedResult = 's1';

					expect(actualResult).toBe(expectedResult);
				});

				it('should return the current state name after a state change', function() {

					$.prompt(states);
					$.prompt.goToState('s2');
					var actualResult = $.prompt.getCurrentStateName(),
						expectedResult = 's2';

					expect(actualResult).toBe(expectedResult);
				});
			});

			// ====================================================================================
			describe('$.prompt.goToState()', function() {
				it('should make the requested state visible', function() {

					$.prompt(states);
					
					$.prompt.goToState('s3');

					expect($('.jqistate[data-jqi-name="s1"]')).toHaveCss({display:'none'});
					expect($('.jqistate[data-jqi-name="s2"]')).toHaveCss({display:'none'});
					expect($('.jqistate[data-jqi-name="s3"]')).toHaveCss({display:'block'});
				});

				it('should do nothing if the state is not available', function() {

					$.prompt(states);
					
					$.prompt.goToState('s4');

					expect($('.jqistate[data-jqi-name="s1"]')).toHaveCss({display:'block'});
					expect($('.jqistate[data-jqi-name="s2"]')).toHaveCss({display:'none'});
					expect($('.jqistate[data-jqi-name="s3"]')).toHaveCss({display:'none'});
				});

				it('should handle substate option', function() {

					$.prompt(states);
					
					$.prompt.goToState('s2',true);

					expect($('.jqistate[data-jqi-name="s1"]')).toHaveCss({display:'block'});
					expect($('.jqistate[data-jqi-name="s2"]')).toHaveCss({display:'block'});
					expect($('.jqistate[data-jqi-name="s3"]')).toHaveCss({display:'none'});

					expect($('.jqistate[data-jqi-name="s2"]')).toHaveClass('jqisubstate');
				});
			});

			// ====================================================================================
			describe('$.prompt.nextState()', function() {
				it('should make the next state visible', function() {
					
					$.prompt(states);
					
					$.prompt.nextState();

					expect($('.jqistate[data-jqi-name="s1"]')).toHaveCss({display:'none'});
					expect($('.jqistate[data-jqi-name="s2"]')).toHaveCss({display:'block'});
					expect($('.jqistate[data-jqi-name="s3"]')).toHaveCss({display:'none'});
				});

				it('should do nothing if the state is not available', function() {

					$.prompt(states);
					
					$.prompt.goToState('s3');
					$.prompt.nextState();

					expect($('.jqistate[data-jqi-name="s1"]')).toHaveCss({display:'none'});
					expect($('.jqistate[data-jqi-name="s2"]')).toHaveCss({display:'none'});
					expect($('.jqistate[data-jqi-name="s3"]')).toHaveCss({display:'block'});
				});
			});

			// ====================================================================================
			describe('$.prompt.prevState()', function() {
				it('should make the previous state visible', function() {
					
					$.prompt(states);
					
					$.prompt.goToState('s3');
					$.prompt.prevState();

					expect($('.jqistate[data-jqi-name="s1"]')).toHaveCss({display:'none'});
					expect($('.jqistate[data-jqi-name="s2"]')).toHaveCss({display:'block'});
					expect($('.jqistate[data-jqi-name="s3"]')).toHaveCss({display:'none'});
				});

				it('should do nothing if the state is not available', function() {

					$.prompt(states);
					
					$.prompt.prevState();

					expect($('.jqistate[data-jqi-name="s1"]')).toHaveCss({display:'block'});
					expect($('.jqistate[data-jqi-name="s2"]')).toHaveCss({display:'none'});
					expect($('.jqistate[data-jqi-name="s3"]')).toHaveCss({display:'none'});
				});
			});

			// ====================================================================================
			describe('$.prompt.addState()', function() {
				it('should add a new state as the last state', function() {
					var newState = {
						name: 's4',
						title: 's4',
						html: 'testing s4',
						buttons: { Ok:true,Cancel:false}
					};

					$.prompt(states);
					
					var $stateobj = $.prompt.addState(newState.name, newState);

					// element created?
					expect($stateobj).toExist();

					// element in the right place?
					expect($stateobj.prev().data('jqi-name')).toBe('s3');

					// element visibility correct?
					expect($('.jqistate[data-jqi-name="s1"]')).toHaveCss({display:'block'});
					expect($stateobj).toHaveCss({display:'none'});

					// content generated ok?
					expect($stateobj.find('.jqimessage')).toHaveText(newState.html);
					expect($stateobj.find('.jqititle')).toHaveText(newState.title);
					expect($stateobj.find('.jqibutton')).toHaveLength(2);
				});

				it('should add a new state after specified state', function() {
					var newState = {
						name: 's4',
						title: 's4',
						html: 'testing s4',
						buttons: { Ok:true,Cancel:false}
					},
					afterState = 's2';

					$.prompt(states);
					
					var $stateobj = $.prompt.addState(newState.name, newState, afterState);

					expect($stateobj.prev().data('jqi-name')).toBe(afterState);
				});
			});

			// ====================================================================================
			describe('$.prompt.removeState()', function() {
				it('should remove the specified state', function() {
					
					$.prompt(states);
					
					$.prompt.removeState('s2');

					expect($('.jqistate[data-jqi-name="s2"]')).not.toExist();
				});
				
				it('should display requested state', function() {

					$.prompt(states);
					
					$.prompt.removeState('s1','s3');

					expect($('.jqistate[data-jqi-name="s2"]')).toHaveCss({display:'none'});
					expect($('.jqistate[data-jqi-name="s3"]')).toHaveCss({display:'block'});
				});
				
				it('should display next state', function() {

					$.prompt(states);
					
					$.prompt.removeState('s1');

					expect($('.jqistate[data-jqi-name="s2"]')).toHaveCss({display:'block'});
					expect($('.jqistate[data-jqi-name="s3"]')).toHaveCss({display:'none'});
				});
				
				it('should display previous state', function() {

					$.prompt(states);
					$.prompt.goToState('s3');
					$.prompt.removeState('s3');

					expect($('.jqistate[data-jqi-name="s1"]')).toHaveCss({display:'none'});
					expect($('.jqistate[data-jqi-name="s2"]')).toHaveCss({display:'block'});
				});
				
			});

			// ====================================================================================
			describe('$.prompt.disableStateButtons()', function() {
				it('should disable the buttons in a state', function() {
					
					$.prompt(states);
					
					$.prompt.disableStateButtons();

					expect($('.jqistate[data-jqi-name="s1"] button[disabled]').length).toBe(1);
					expect($('.jqistate[data-jqi-name="s2"] button[disabled]').length).toBe(0);
				});

				it('should disable the buttons in a specific state', function() {
					
					$.prompt(states);
					
					$.prompt.disableStateButtons('s2');

					expect($('.jqistate[data-jqi-name="s1"] button[disabled]').length).toBe(0);
					expect($('.jqistate[data-jqi-name="s2"] button[disabled]').length).toBe(1);
				});
			});

			// ====================================================================================
			describe('$.prompt.enbleStateButtons()', function() {
				it('should enable the buttons in a state', function() {
					
					$.prompt(states);
					
					$.prompt.disableStateButtons('s1');
					$.prompt.disableStateButtons('s2');
					$.prompt.enableStateButtons();

					expect($('.jqistate[data-jqi-name="s1"] button[disabled]').length).toBe(0);
					expect($('.jqistate[data-jqi-name="s2"] button[disabled]').length).toBe(1);
				});

				it('should enable the buttons in a specific state', function() {
					
					$.prompt(states);
					
					$.prompt.disableStateButtons('s1');
					$.prompt.disableStateButtons('s2');
					$.prompt.enableStateButtons('s2');

					expect($('.jqistate[data-jqi-name="s1"] button[disabled]').length).toBe(1);
					expect($('.jqistate[data-jqi-name="s2"] button[disabled]').length).toBe(0);
				});
			});

			// ====================================================================================
			describe('$.prompt.close()', function() {
				it('should close the prompt', function() {
					
					$.prompt(states);
					
					$.prompt.close();

					expect($('.jqibox')).not.toExist();
				});

			});
		}); // end instance methods
	}); // end api methods
	
	// ====================================================================================
	// ====================================================================================
	describe('api events', function() {
		var states = [
				{ name: 's1', html: 'state 1', buttons: { next: true, cancel: false } },
				{ name: 's2', html: 'state 2', buttons: { back: -1, cancel: 0, next: 1 } },
				{ name: 's3', html: 'state 3', buttons: { done: true} }
			];

		beforeEach(function() {
			$.fx.off = true; // for our testing lets turn off fx
		});

		afterEach(function() {
			$.prompt.close();
			$('.jqibox').remove();
		});

		// ====================================================================================
		describe('impromptu:loaded', function(){
			describe('running through jquery event binding', function(){
				var spyEventCalled;

				beforeEach(function(done){
					spyEventCalled = false;
					$('body').on('impromptu:loaded', '.jqibox', function(){ spyEventCalled=true; done(); });
					$.prompt(states);
				});

				it('should fire event', function(){
					expect(spyEventCalled).toBe(true);
				});
			});

			describe('passing loaded event through as option', function(){
				var spyEventCalled;

				beforeEach(function(done){
					spyEventCalled = false;
					$.prompt(states, { loaded: function(){ spyEventCalled = true; done(); } });
				});

				it('should allow event function as option parameter', function(){
					expect(spyEventCalled).toBe(true);
				});
			});
		});

		// ====================================================================================
		describe('impromptu:close', function(){

			describe('running through jquery event binding', function(){
				var spyEventCalled;

				beforeEach(function(done){
					spyEventCalled = false;
					$('body').on('impromptu:close', '.jqibox', function(){ spyEventCalled=true; done(); });
					$.prompt(states, {
						loaded: function(){
							$.prompt.close();
						}
					});
				});

				it('should fire event', function(){
					expect(spyEventCalled).toBe(true);
				});
			});

			describe('passing loaded event through as option', function(){
				var spyEventCalled;

				beforeEach(function(done){
					spyEventCalled = false;
					$.prompt(states, { 
						loaded: function(){ $.prompt.close(); },
						close: function(){ spyEventCalled = true; done(); }
					});
				});

				it('should allow event function as option parameter', function(){
					expect(spyEventCalled).toBe(true);
				});
			});

		});

		// ====================================================================================
		describe('impromptu:statechanging', function(){

			describe('running through jquery event binding', function(){
				var spyEventCalled;

				beforeEach(function(done){
					spyEventCalled = false;

					$('body').on('impromptu:statechanging', '.jqibox', function(){ spyEventCalled = true; done(); });
					$.prompt(states, {
						loaded: function(){
							$.prompt.goToState('s2');
						}
					});
				});

				it('should fire event', function(){
					expect(spyEventCalled).toBe(true);
				});
			});

			describe('passing loaded event through as option', function(){
				var spyEventCalled;

				beforeEach(function(done){
					spyEventCalled = false;

					$.prompt(states, { 
						loaded: function(){
							$.prompt.goToState('s2');
						},
						statechanging: function(){ spyEventCalled = true; done(); }
					});
				});

				it('should allow event function as option parameter', function(){
					expect(spyEventCalled).toBe(true);
				});
			});


			it('should allow preventDefault', function(){
				var spyEvent = spyOnEvent('body', 'impromptu:statechanging');

				$.prompt(states, { 
					loaded: function(){
						$.prompt.goToState('s2');
					},
					statechanging: function(e){
						e.preventDefault();
					}
				});
				
				expect(spyEvent).toHaveBeenTriggered();
				expect(spyEvent).toHaveBeenPrevented();
			});

		});

		// ====================================================================================
		describe('impromptu:statechanged', function(){

			describe('running through jquery event binding', function(){
				var spyEventCalled;

				beforeEach(function(done){
					spyEventCalled = false;

					$('body').on('impromptu:statechanged', '.jqibox', function(){ spyEventCalled = true; done(); });
					$.prompt(states, {
						loaded: function(){
							$.prompt.goToState('s2');
						}
					});
				});

				it('should fire event', function(){
					expect(spyEventCalled).toBe(true);
				});
			});

			describe('passing loaded event through as option', function(){
				var spyEventCalled;

				beforeEach(function(done){
					spyEventCalled = false;

					$.prompt(states, { 
						loaded: function(){
							$.prompt.goToState('s2');
						},
						statechanged: function(){ spyEventCalled = true; done(); }
					});
				});

				it('should allow event function as option parameter', function(){
					expect(spyEventCalled).toBe(true);
				});
			});

		});

		// ====================================================================================
		describe('impromptu:submit', function(){

			describe('running through jquery event binding', function(){
				var spyEventCalled;

				beforeEach(function(done){
					spyEventCalled = false;

					$('body').on('impromptu:submit', '.jqibox', function(){ spyEventCalled = true; done(); });
					$.prompt(states, {
						loaded: function(){
							$.prompt.getState('s1').find('.jqibutton:first').click();
						}
					});
				});

				it('should fire event', function(){
					expect(spyEventCalled).toBe(true);
				});
			});



			describe('passing submit event through as option if string message', function(){
				var spyEventCalled;

				beforeEach(function(done){
					spyEventCalled = false;

					$.prompt('Test message', { 
						loaded: function(){
							$('.jqibutton:first').click();
						},
						submit: function(){ spyEventCalled = true; done(); }
					});
				});

				it('should allow event function as option parameter', function(){
					expect(spyEventCalled).toBe(true);
				});
			});


			describe('should detect button clicked', function(){
				var btnClicked,
					msgReturned,
					formVals;

				beforeEach(function(done){

					$('body').on('impromptu:submit', '.jqibox', function(e,v,m,f){ 
						btnClicked = v; 
						msgReturned = m;
						formVals = f;
						done();
					});

					$.prompt(states, {
						loaded: function(){
							$.prompt.getState('s1').find('button[value="false"]').click();
						}
					});
				});

				it('should detect button', function(){
					expect(btnClicked).toBe(false);
				});

				it('should pass the state message', function(){
					expect(msgReturned.is('.jqimessage')).toBe(true);
				});
			});

			describe('verifying form values', function(){
				var tmpStates = [],
					btnClicked,
					msgReturned,
					formVals,
					expectedValues = {
						textInput: 'my text input',
						selectSingle: 'select single 3',
						selectMulti: ['select multi 2', 'select multi 3'],
						radioInput: 'my radio yes',
						chkInput: ['my chk no', 'my chk maybe'],
						textareaInput: 'my textarea val'
					};

				tmpStates[0] = $.extend({}, states[0]);
				tmpStates[0].html = '<input type="text" name="textInput" value="my text input" />'+
									'<select name="selectSingle"><option value="select single 1">select single 1</option><option value="select single 2">select single 2</option><option value="select single 3" selected>select single 3</option></select>'+
									'<select name="selectMulti" multiple><option value="select multi1">select multi 1</option><option value="select multi 2" selected>select multi 2</option><option value="select multi 3" selected>select multi 3</option></select>';
				tmpStates[1] = $.extend({}, states[1]);
				tmpStates[1].html = '<input type="radio" name="radioInput" value="my radio yes" checked />'+
									'<input type="radio" name="radioInput" value="my radio no" />'+
									'<input type="checkbox" name="chkInput" value="my chk no" checked />'+
									'<input type="checkbox" name="chkInput" value="my chk yes" />'+
									'<input type="checkbox" name="chkInput" value="my chk maybe" checked />';
				tmpStates[3] = $.extend({}, states[3]);
				tmpStates[3].html = '<textarea name="textareaInput">my textarea val</textarea>';

				beforeEach(function(done){

					$('body').on('impromptu:submit', '.jqibox', function(e,v,m,f){ 
						btnClicked = v; 
						msgReturned = m;
						formVals = f;
						done();
					});

					$.prompt(tmpStates, {
						loaded: function(){
							$.prompt.getState('s1').find('button[value="true"]').click();
						}
					});
				});

				it('should pass the correct form values', function(){
					expect(formVals).toEqual(expectedValues);
				});

			});

		});

	}); // end api events

	// ====================================================================================
	// ====================================================================================
	describe('native events', function() {
		var states = [
				{ name: 's1', html: 'state 1', buttons: [{ title:'One', value: 1}, { title:'Two', value: 2}, { title:'Three', value: 3 }], focus: 1 },
				{ name: 's2', html: 'state 2', buttons: { back: -1, cancel: 0, next: 1 } },
				{ name: 's3', html: 'state 3', buttons: { done: true} }
			];

		beforeEach(function() {			
			$.fx.off = true; // for our testing lets turn off fx

		});

		afterEach(function() {
			$.prompt.close();
		});

		// ====================================================================================
		describe('keydown', function(){

			describe('on fade when persistent option true', function(){

				beforeEach(function(done){

					$.prompt(states, { 
						loaded: function(){
							var e = $.Event('keydown');
							e.keyCode = 27;
							$.prompt.getBox().trigger(e);
							done();
						},
						persistent: true
					});
				});

				it('should not close prompt', function(){
					expect($('.jqi')).toExist();
				});
			});


			describe('on fade when persistent option false', function(){

				beforeEach(function(done){

					$.prompt(states, { 
						loaded: function(){
							var e = $.Event('keydown');
							e.keyCode = 27;
							$.prompt.getBox().trigger(e);
							done();
						},
						persistent: false
					});
				});

				it('should close prompt', function(){
					expect($('.jqi')).not.toExist();
				});
			});


			describe('enter key in prompt', function(){
				var buttonTriggered = null;

				beforeEach(function(done){

					$('body').on('impromptu:submit', function(e,v){
						buttonTriggered = v;
						done();
					});

					$.prompt(states, { 
						loaded: function(){
							var e = $.Event('keydown');
							e.keyCode = 13;
							$.prompt.getPrompt().trigger(e);
						}
					});	
				});

				it('should trigger click on the correct button', function(){
					expect(buttonTriggered).toBe(2);
				});
			});
			
		});

		// ====================================================================================
		describe('click', function(){

			describe('fade click', function(){

				beforeEach(function(done){
					$.prompt(states, { 
						loaded: function(){
							var e = $.Event('click');
							$.prompt.getBox().trigger(e);

							done();
						},
						persistent: true
					});
				});

				it('should not close fade if persistent option true',function(){
					expect($('.jqi')).toExist();
				});
			});
			
		});

	});// end native events

});
