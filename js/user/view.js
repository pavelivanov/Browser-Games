declare('User.View', {

	hero_img: null,

	initialize: function (controller, hero_img) {
		this.hero_img = hero_img;
	},

	moveAnimation: function () {
		var frames = new Animation.Frames(
			this.controller.images.get(this.hero_img), 32, 32
		);

		// TODO переписать кадры и перерисовать спрайт

		this.animationSheets = atom.object.map({
			bot: atom.array.range(0,2),
			left: atom.array.range(12,14),
			right: atom.array.range(24,26),
			top: atom.array.range(36,38)
		}, function (key) {
			return new Animation.Sheet({
				frames: frames,
				delay : 40,
				sequence: key
			});
		});
	}

});