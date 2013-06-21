declare('Game.Collisions', {

	initialize: function (controller) {
		this.bindMethods('update');

		this.controller = controller;
		this.users = [];
		this.enemies = [];
		this.skills = [];
		this.blocks = [];

		console.log(this.blocks);
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
	},

	skillsToBlocks: function () {
		var i, k, sk = this.skills, bl = this.blocks;

		if (!sk.length) return;

		for (i = bl.length; i--;)
			for (k = sk.length; k--;)
				if (sk[k].shape.hasPoint(bl[i].position)) {
					sk[k].die();
				}
	}

});
























