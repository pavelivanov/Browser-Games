window.declare  = atom.declare;
window.Settings = atom.Settings;

LibCanvas.extract();


var map = [
	'------------X------X-------'.split(''),
	'-------------------X-------'.split(''),
	'----X---X----X----X----X---'.split(''),
	'---X-------------------X---'.split(''),
	'---X-----------X-------X---'.split(''),
	'-----X---------X-----------'.split(''),
	'-X----XX--X--X-------------'.split(''),
	'----------------------X----'.split(''),
	'----------------------X----'.split(''),
	'---------X-----------X-----'.split(''),
	'-----X--------X------X-----'.split(''),
	'-----X---------------------'.split(''),
	'-----------------X---------'.split(''),
	'-------------X------XXX----'.split(''),
	'-----X---X-----------X-----'.split(''),
	'--------X------------X--XXX'.split(''),
	'---X----X------X-----------'.split(''),
	'--X------------------------'.split(''),
	'-XX--------X-------X-------'.split(''),
	'---X-----X---------X---X---'.split('')
];



var models = {
	user: {
		zIndex: 1,

		img: 'hero_1:bot',
		imgState: 'top',

		hp: 800,
		mana: 600,

		size: new Size(32,32),
		moveSpeed: 80,
		deltaSpeed: new Point(0,0),

		colors: {
			hp: '#85bc00',
			mana: '#008ed8',
			cast: '#ce55d2'
		},

		controls: {
			move: 'w s a d'.split(' '),
			skills: 'n1 n2 n3 n4 n5'.split(' ')
		}
	}
};




atom.dom(function(){

	new Game.Controller();

});