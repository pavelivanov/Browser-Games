declare('Game.ShadowMouse', App.Element, {

	// TODO пока не используется

	get controller () {
		return this.settings.get('controller');
	},

	configure: function () {
		this.mouse = this.controller.mouse.point;
		this.radius = 80;
		this.ambientLight = 0;
		this.intensity = .9;
	},

	onUpdate: function () {
		this.redraw();
	},

	renderTo: function (ctx) {
		ctx.save();

		var m = this.mouse,
			g = ctx.createRadialGradient(m.x, m.y, 40, m.x, m.y, this.radius),
			amb = 'rgba(0,0,0,' + (1 - this.ambientLight) + ')';

		g.addColorStop(0, 'rgba(0,0,0,'+ (1 - this.intensity) +')');
		g.addColorStop(1, amb);

		ctx.fill(this.shape, g);

		ctx.restore();
	}

});


declare('Game.ShadowUser', App.Element, {

	get controller () {
		return this.settings.get('controller');
	},

	configure: function () {

		this.user = this.settings.get('user');
		this.radius = 250;
		this.ambientLight = 0;
		this.intensity = .9;
	},

	onUpdate: function () {
		this.redraw();
	},

	renderTo: function (ctx) {
		ctx.save();

		var m = this.user.position,
			g = ctx.createRadialGradient(m.x, m.y, 200, m.x, m.y, this.radius),
			amb = 'rgba(0,0,0,' + (1 - this.ambientLight) + ')';

		g.addColorStop(0, 'rgba(0,0,0,'+ (1 - this.intensity) +')');
		g.addColorStop(1, amb);

		ctx.fill(this.shape, g);

		ctx.restore();
	}

});