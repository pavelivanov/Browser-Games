declare('User.Default', App.Element, {

	speed: new Point(0,0),

	get controller () {
		return this.settings.get('controller');
	},

	get globalSettings () {
		return this.controller.settings;
	},

	configure: function () {
		this.layer = this.globalSettings.get('layer');
		this.fieldSize = this.globalSettings.get('fieldSize');
		this.position = this.shape.center;
	},


	remove: function () {
		this.controller.collisions.remove(this);
		this.destroy();
	},

	fitToField: function () {
		var shape = this.shape,
			top = shape.from.y,
			bottom = shape.to.y - this.fieldSize.height + 52,
			left = shape.from.x,
			right = shape.to.x - this.fieldSize.width;

		if (top < 0) shape.move(new Point(0, -top));
		if (bottom > 0) shape.move(new Point(0, -bottom));
		if (left < 0) shape.move(new Point(-left, 0));
		if (right > 0) shape.move(new Point(-right, 0));
	},

	renderTo: function (ctx) {
		ctx.save();
		ctx.restore();
	}

});