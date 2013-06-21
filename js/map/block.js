atom.declare( 'Map.Block', App.Element, {

	zIndex: 1,

	configure: function () {
		this.position = this.shape.center;
	},

	renderTo: function (ctx) {
		ctx.fill( this.shape, '#333');
	}

});