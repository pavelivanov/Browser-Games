declare('Game.Controller', {

	settings: {
		fieldSize: new Size(810, 650),
		cells: new Size(27, 20),
		cellSize: new Size(30, 30)
	},

	initialize: function () {
		this.settings = new Settings(this.settings);

		var heroes = 'img/heroes.png';
		var skills = 'img/skills.png';
		var cast_circle = 'img/cast_circle.png';

		atom.ImagePreloader.run({
			'hero_1:bot':       heroes + ' [0:0:32:32]',
			'hero_1:left':      heroes + ' [0:32:32:32]',
			'hero_1:right':     heroes + ' [0:64:32:32]',
			'hero_1:top':       heroes + ' [0:96:32:32]',

			'skill:fire':       skills + ' [20:20]{0:0}',

			'cast:aoe':         cast_circle + ' [40:40]{0:0}'
		}, this.init.bind(this) );
	},

	init: function (images) {

		this.images = images;
		this.fieldRectangle = new Rectangle({
			from: new Point(0,0),
			size: this.settings.get('fieldSize')
		});


		/* collisions */
		this.collisions = new Game.Collisions(this);
		atom.frame.add(this.collisions.update);


		/* app */
		this.app = new App({size: this.settings.get('fieldSize')});
		this.app.resources.set('images', images);


		/* mouse */
		this.mouse = new LibCanvas.Mouse(this.app.container.bounds);
		this.mouseHandler = new LibCanvas.App.MouseHandler({
			app: this.app,
			mouse: this.mouse
		});


		/* layer */
		this.layer = this.app.createLayer({ invoke: true, name: 'main' });
		this.layer.dom.element.css({background: 'url(img/bg.png)'});


		/* animate */
//		this.userAnim = {
//			top:    this.createAnimation('hero_1:top:anim', 140, 120, 60),
//			bot:    this.createAnimation('hero_1:bot:anim', 140, 120, 60),
//			left:   this.createAnimation('hero_1:left:anim', 140, 120, 60),
//			right:  this.createAnimation('hero_1:right:anim', 140, 120, 60)
//		}


		this.createUser();
		this.calculateMap();
		this.createBlocks();

		this.collisions.add(this.users[0]);
	},

	createUser: function () {
		this.users = [new Game.User(this.layer, {
			controller: this,
			manipulator: new User.Manipulator(models.user.controls)
		})];
	},

	calculateMap: function () {
		var cS = this.settings.get('cellSize');
		this.map = [];

		for (var i=0; i<map.length; i++) {
			var line = map[i];

			for (var k=0; k<line.length; k++) {
				var cell = line[k];

				if (cell == 'X') {
					this.map.push(new Point(k * cS.width, i * cS.height));
				}
			}
		}
	},

	createBlocks: function () {
		var cell, map = this.map;

		for (cell = 0; cell<map.length; cell++) {
			var pos = map[cell],
				size = this.settings.get('cellSize');

			this.collisions.add(
				new Map.Block(this.layer, {
					shape: new Rectangle(
						pos.x, pos.y,
						size.width, size.height
					)
				})
			);
		}
	}

//	createAnimation: function (img, w, h, delay) {
//		console.log(this.images.get(img));
//
//		return new Animation.Sheet({
//			frames: new Animation.Frames( this.images.get(img), w, h ),
//			delay : delay
//		});
//	}

});