declare('Skills.Default', App.Element, {

	get controller () {
		return this.settings.get('controller');
	},

	get globalSettings () {
		return this.controller.settings;
	},

	configure: function () {
		this.layer = this.globalSettings.get('layer');
	},

	checkBounds: function () {
		var pos = this.position,
			gSet = this.globalSettings,
			field = gSet.get('fieldSize');

		if (
			pos.x > field.width ||
			pos.x < 0 ||
			pos.y > field.height - 50 ||
			pos.y < 0
		) this.die();

		return this;
	},

	die: function () {
		this.controller.collisions.remove(this);
		this.destroy();
	},

	fitToField: function () {
		var shape = this.shape,
			top = shape.from.y,
			bottom = shape.to.y - this.fieldSize.height;

		if (top < 0) shape.move(new Point(0, -top));
		if (bottom > 0) shape.move(new Point(0, -bottom));
	},

	impulse : function (pos, reverse) {
		this.redraw();
		this.position.move(pos, reverse);
		this.checkBounds();
		return this;
	},

	getVelocity: function () {
		var angle = this.angle;

		return new Point(
			Math.cos(angle) * this.sets.move_speed,
			Math.sin(angle) * this.sets.move_speed
		);
	},

//	onUpdate: function (time) {
//		this.impulse( this.getVelocity().mul(time / 1000) );
//	},

	renderTo: function (ctx) {
		ctx.save();
		ctx.restore();
	}

});