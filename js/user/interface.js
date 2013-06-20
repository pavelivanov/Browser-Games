declare('User.Interface', App.Element, {

	zIndex: 3,

	configure: function () {

	},

	_configure: function () {
		this.settings.properties(this, ['fieldSize', 'user', 'color', 'value', 'maxValue']);

		this.textShape = this.shape.clone();
		this.setShapeWidth();
		this.animator = new atom.Animatable(this);
		this.stroke = this.shape.clone().snapToPixel();
	},

	setShapeWidth: function () {
		if (!this.value) return;

		this.shape.width = this.value * this.fieldSize.x / this.maxValue;
	},

	renderTo: function (ctx, resources) {
		var size = this.textShape.height * 0.75;

		ctx.fill(this.shape, this.color);

		if (this.value) {
			ctx.text({
				text: this.value +' / '+ this.maxValue,
				align: 'center',
				color: '#fff',
				size: size,
				lineHeight: size,
				padding: [0, 10],
				shadow: "1 1 2 #000",
				to: this.textShape
			});
		}

	}

});


declare('User.Hp', User.Interface, {

	configure: function () {
		this._configure();
	}

});


declare('User.Mana', User.Interface, {

	configure: function () {
		this._configure();
	}

});


declare('User.Cast', User.Interface, {

	configure: function () {
		this._configure();
		this.shape.width = 0;

		this.user.events.add('start', this.start.bind(this));
		this.user.events.add('done', this.stop.bind(this));
	},

	start: function(moves){
		var timeout = this.settings.get('timeout'),
			game = this.settings.get('game');

		this.moves = moves;

		this.animator.animate({
			props: {},
			time: timeout,
			onTick: function(animation){
				this.shape.width = animation.timeLeft / timeout * this.width;
				this.redraw();
			}.bind(this),
			onComplete: function(){
				game.timeout();
			}
		});
	},

	stop: function(){
		this.animator.stop();
		this.shape.width = this.width;
		this.redraw();
	}

});























