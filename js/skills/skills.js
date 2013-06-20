declare('Skills.Skill', Skills.Default, {

	zIndex: 3,
	mousePos: null,
	sets: {},

	configure: function () {
		this.settings.properties(this, ['position', 'startPos', 'mousePos', 'sets']);
		this.configureSkill();
	},

	getAngleBetweenPoints: function () {
		var p1 = this.mousePos,
			p2 = this.position;

		return Math.atan2(p1.y - p2.y, p1.x - p2.x);
	},

	getSettingsByType: {
		ground: function () {

		}
	},

	configureSkill: function () {
		this.img = this.sets.img;
		this.shape = new Circle(this.position, this.sets.radius);
		this.onUpdate = this.sets.onUpdate;

		//this.getSettingsByType[this.sets.type]();




		this.angle = this.getAngleBetweenPoints();
	},



	renderTo: function (ctx, recources) {
		ctx.save();
		ctx.clip(this.shape);

		var img = recources.get('images').get(this.img);

		ctx.drawImage({
			image: img,
			center: this.shape.center
		});

		ctx.restore();
	}

});




Skills.Skill.skillsDefault = {

	fire: [
		{
			img: 'skill:fire',

			range: 100,
			radius: 20,

			cast_speed: 0.1,
			move_speed: 200,

			damage: 200,

			type: 'ground',

			create: function () {

			},
			onUpdate: function (time) {
				this.impulse( this.getVelocity().mul(time / 1000) );
			}
		},
		[
			{
				img: 'skill:fire',

				range: 100,
				radius: 40,

				cast_speed: 0.1,
				move_speed: 0,

				damage: 200,
				
				type: 'ground_aoe'
			},
			{
				img: 'skill:fire',
				range: 100,
				radius: 20,
				cast_speed: 0.1,
				move_speed: 50,
				damage: 200,
				type: 'ground'
			}
		],
		[
			{
				img: 'skill:fire',
				range: 100,
				radius: 20,
				cast_speed: 0.1,
				move_speed: 50,
				damage: 200,
				type: 'ground'
			},
			{
				img: 'skill:fire',
				range: 100,
				radius: 20,
				cast_speed: 0.1,
				move_speed: 50,
				damage: 200,
				type: 'ground'
			}
		]
	]

};














