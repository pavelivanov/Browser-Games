declare('Game.User', User.Default, {

	currentHp: 500,
	currentMana: 10,
	stopSpeed: new Point(1,1),

	skillsLearned: {
		fire:   [0, [0, 0], [0, 0]],
		water:  [0, [0, 0], [0, 0]],
		wind:   [0, [0, 0], [0, 0]],
		earth:  [0, [0, 0], [0, 0]]
	},

	skillsChoosed: {
		s1: null,
		s2: null,
		s3: null,
		s4: null,
		s5: null
	},

	configure: function () {
		atom.extend(this, models.user);

		var size = this.size,
			fieldSize = this.fieldSize = this.globalSettings.get('fieldSize');

		this.mouse = this.controller.mouse.point;

		// TODO Сделать рандомный выбор спавна
		this.shape = new Rectangle(
			100 - (size.x / 2),
			(fieldSize.y - size.y) / 2,
			size.x,
			size.y
		);

		this.position = this.shape.center;

		this.settings
			.get('manipulator')
			.setOwner(this)
			.setStates()
			.setSkills();


		// TODO написать норм привязку скилов
		this.skillsChoosed = {
			s1: Skills.Skill.skillsDefault.fire[0],
			s2: Skills.Skill.skillsDefault.fire[1][0],
			s3: Skills.Skill.skillsDefault.fire[1][1],
			s4: Skills.Skill.skillsDefault.fire[2][0],
			s5: Skills.Skill.skillsDefault.fire[2][1]
		};



		this.hp = new User.Hp(this.layer, {
			fieldSize: fieldSize,
			user: this,
			value: this.currentHp,
			maxValue: this.hp,
			color: this.colors.hp,
			shape: new Rectangle({
				from: [0, this.fieldSize.y - 40],
				to: [this.fieldSize.x, this.fieldSize.y - 20]
			})
		});

		this.mana = new User.Mana(this.layer, {
			fieldSize: fieldSize,
			user: this,
			value: this.currentMana,
			maxValue: this.mana,
			color: this.colors.mana,
			shape: new Rectangle({
				from: [0, this.fieldSize.y - 20],
				to: [this.fieldSize.x, this.fieldSize.y]
			})
		});

		this.cast = new User.Cast(this.layer, {
			fieldSize: fieldSize,
			user: this,
			color: this.colors.cast,
			shape: new Rectangle({
				from: [0, this.fieldSize.y - 50],
				to: [this.fieldSize.x, this.fieldSize.y - 40]
			})
		});
	},

	moveHero: function (time) {
		this.fitToField();
		//this.checkBounds();

		this.shape.move( this.speed.clone().mul( time / 1000 ) );
		this.redraw();
	},

	updateSpeed: function () {
		// TODO рассчитывать замедления

		this.speed.x = this.deltaSpeed.x * this.moveSpeed * this.stopSpeed.x;
		this.speed.y = this.deltaSpeed.y * this.moveSpeed * this.stopSpeed.y;
	},

	onUpdate: function (time) {
		this.position = this.shape.center;
		this.updateSpeed();
		this.moveHero(time);
	},

	renderTo: function (ctx, resources) {
		ctx.drawImage({
			image: resources.get('images').get(this.img),
			draw : this.shape,
			optimize: true
		});
	}

});