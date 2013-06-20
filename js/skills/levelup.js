declare('Skills.Interface', App.Element, {

	zIndex: -1,

	configure: function () {
		this.controller = this.settings.get('controller');

		this.shape = new Rectangle({
			from: [0, 0],
			to: this.controller.settings.get('fieldSize')
		});
	},

	renderTo: function (ctx, resources) {
		ctx.drawImage({
			image: resources.get('images').get('interface'),
			draw : this.shape,
			optimize: true
		});
	}

});