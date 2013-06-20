declare('Game.Controller', {

	settings: {
		fieldSize: new Size(810, 650)
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


		/* app */
		this.app = new App({size: this.settings.get('fieldSize')});
		this.app.resources.set('images', images);


		/* mouse */
		this.mouse = new LibCanvas.Mouse(this.app.container.bounds);
		this.mouseHandler = new LibCanvas.App.MouseHandler({
			app: this.app,
			mouse: this.mouse
		});


		/* layers */
		this.layer = this.app.createLayer({ invoke: true, name: 'main', zIndex: 1 });
		this.layer.dom.element.css({background: 'url(img/bg.png)'});

		this.shadowLayer = this.app.createLayer({ invoke: true, name: 'shadow', zIndex: 2 });


		/* animate */
//		this.userAnim = {
//			top:    this.createAnimation('hero_1:top:anim', 140, 120, 60),
//			bot:    this.createAnimation('hero_1:bot:anim', 140, 120, 60),
//			left:   this.createAnimation('hero_1:left:anim', 140, 120, 60),
//			right:  this.createAnimation('hero_1:right:anim', 140, 120, 60)
//		}


		this.createUser();
		//this.createShadowUser();
	},

	createUser: function () {
		this.users = [new Game.User(this.layer, {
			controller: this,
			manipulator: new User.Manipulator(models.user.controls)
		})];
	},

	createShadowUser: function () {
		var s = this.settings.get('fieldSize');

		this.shadowUser = new Game.ShadowUser(this.shadowLayer, {
			controller: this,
			user: this.users[0],
			mouse: this.mouse,
			shape: new Rectangle({
				from: new Point(0,0),
				size: new Point(s.x, s.y - 50)
			})
		});
	},

	createAnimation: function (img, w, h, delay) {
		return new Animation.Sheet({
			frames: new Animation.Frames( this.images.get(img), w, h ),
			delay : delay
		});
	}

});