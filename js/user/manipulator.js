declare('User.Manipulator', {

	owner: null,

	keys: {
		states: {
			top:    'w',
			bot:    's',
			left:   'a',
			right:  'd'
		},

		skills: {
			s1: 'click',
			s2: 'contextmenu',
			s3: 'n3',
			s4: 'n4',
			s5: 'n5'
		}
	},

	states: {
		top: [
			function () {
				this.deltaSpeed.y -= 1;
				this.img = 'hero_1:top';
				this.stopSpeed.y = 1;
			},
			function () { this.deltaSpeed.y += 1; }
		],
		bot: [
			function () {
				this.deltaSpeed.y += 1;
				this.img = 'hero_1:bot';
				this.stopSpeed.y = 1;
			},
			function () { this.deltaSpeed.y -= 1; }
		],
		left: [
			function () {
				this.deltaSpeed.x -= 1;
				this.img = 'hero_1:left';
				this.stopSpeed.x = 1;
			},
			function () { this.deltaSpeed.x += 1; }
		],
		right: [
			function () {
				this.deltaSpeed.x += 1;
				this.img = 'hero_1:right';
				this.stopSpeed.x = 1;
			},
			function () { this.deltaSpeed.x -= 1; }
		]
	},


	// INIT -------------------------------------------------------------------------------------- /

	initialize: function (controller, uses) {
		this.keyboard = new atom.Keyboard();
		this.controller = controller;

		this.mouse = this.controller.mouse;

		// TODO сделать замену клавишь на пользовательские

//		if (Array.isArray(uses)) {
//			uses = uses.associate('top bot left right'.split(' '));
//		}
//		this.uses = uses;

	},

	setOwner: function (owner) {
		this.owner = owner;
		return this;
	},



	// STATES -------------------------------------------------------------------------------------- /

	stateChange: function (state, callback, status, e) {
		if (this.states[state] == null) this.states[state] = false;
		if (this.states[state] == status) return;

		// TODO в state передается направление - применить к смене анимации

		this.states[state] = status;

		callback.call(this.owner);
		e.preventDefault();
	},

	setStates: function () {
		var state, states = this.states;

		for (state in states) if (states.hasOwnProperty(state)) {
			this.keyboard.events
				.add( this.keys.states[state],
					this.stateChange.bind(this, state, states[state][0], true)
				)
				.add( this.keys.states[state] + ':up',
					this.stateChange.bind(this, state, states[state][1], false)
				);
		}
		return this;
	},



	// SKILLS -------------------------------------------------------------------------------------- /

	createSkill: function (skillNum) {
		var user = this.owner,
			skillSets = user.skillsChoosed[skillNum];

		if (skillSets) {
			this.controller.collisions.add(
				new Skills.Skill(user.layer, {
					controller: user.controller,
					position: user.position,
					mousePos: user.controller.mouse.point.clone(),
					startPos: user.position.clone(),
					sets: skillSets
				})
			);
		}
	},

	useSkill: function (skill, e) {
		this.createSkill(skill);
		e.preventDefault();
	},

	setSkills: function () {
		var skill, skills = this.keys.skills;

		for (skill in skills) if (skills.hasOwnProperty(skill)) {
			if (skills[skill] == 'click' || skills[skill] == 'contextmenu') {
				this.mouse.events.add(
					skills[skill],
					this.useSkill.bind(this, skill)
				);
			} else {
				this.keyboard.events.add(
					skills[skill],
					this.useSkill.bind(this, skill)
				);
			}
		}
		return this;
	}

});