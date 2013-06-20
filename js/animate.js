declare('Game.Animate', App.Element, {
	zIndex: 5,

	get controller () {
		return this.settings.get('controller');
	},

	configure: function () {
		this.animation = new Animation({
			sheet: this.settings.get('sheet'),
			onUpdate: this.redraw,
			onStop: this.destroy
		});
	},

	renderTo: function (ctx) {
		var image = this.animation.get();

		if (image) {
			ctx.drawImage({
				image: image,
				center: this.shape.center
			});
		}
	}
});