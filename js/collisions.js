declare('Game.Collisions', {

	initialize: function (controller) {
		this.bindMethods('update');

		this.controller = controller;
		this.users = [];
		this.enemies = [];
		this.skills = [];
		this.blocks = [];
	},

	getArray: function (item) {
		var a = item instanceof Game.User ? this.users :
			//item instanceof Game.Enemy ? this.enemies :
			item instanceof Skills.Skill ? this.skills :
			item instanceof Map.Block ? this.blocks : null;

		if (a == null) throw new TypeError( 'unknown type of ' + item );

		return a;
	},

	add: function (item) {
		this.getArray(item).push(item);
		return this;
	},

	remove: function (item) {
		this.getArray(item).erase(item);
		return this;
	},

	removeAll: function () {
		var i, k,
			en = this.enemies,
			sk = this.skills;

		for (k = sk.length; k--;) {
			sk[k].remove();
		}

		for (i = en.length; i--;) {
			en[i].remove();
		}
	},

	update: function () {
		this.skillsToBlocks();
		this.userToBlock();
	},

	skillsToBlocks: function () {
		var i, k,
			sk = this.skills,
			bl = this.blocks

		if (!sk.length) return;

		for (i = bl.length; i--;)
			for (k = sk.length; k--;)
				if (sk[k].shape.hasPoint(bl[i].position)) {
					sk[k].die();
				}
	},

	userToBlock: function () {
		var i, x, y,
			bl = this.blocks,
			us = this.users[0];

		for (i = bl.length; i--;)
			if (us.shape.hasPoint(bl[i].position)) {
				// TODO хочу другую логику блокирования движения
				var dS = us.deltaSpeed;

				if (dS.x && dS.y) {
					us.stopSpeed = new Point(0,0);
					x = -2 * dS.x;
					y = -2 * dS.y;
				} else {
					if (dS.x) {
						us.stopSpeed = new Point(0,1);
						x = -2 * dS.x;
						y = 0;
					}

					if (dS.y) {
						us.stopSpeed = new Point(1,0);
						x = 0;
						y = -2 * dS.y;
					}
				}

				us.shape.move(new Point(x, y));


//				if (dS.x && dS.y) {
//					x = dP.x - dS.x;
//					y = dP.y - dS.y;
//				} else {
//					if (dS.x) {
//						x = dP.x - dS.x;
//						y = dS.y ? dP.y - dS.y : dP.y;
//					}
//
//					if (dS.y) {
//						x = dS.x ? dP.x - dS.x : dP.x;
//						y = dP.y - dS.y;
//					}
//				}

			}
	}

});
























