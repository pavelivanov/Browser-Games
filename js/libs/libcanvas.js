

(function (atom, Math) { // LibCanvas

// bug in Safari 5.1 ( 'use strict' + 'set prop' )
// 'use strict';

	var undefined,
		
			global   = this,
		
			slice    = [].slice,
		
			declare  = atom.declare,
		
			Registry = atom.Registry,
		
			Events   = atom.Events,
		
			Settings = atom.Settings;
	

	var LibCanvas = this.LibCanvas = declare({ name: 'LibCanvas', prototype: {} })
		.own({
			Buffer: function () {
				return LibCanvas.buffer.apply( LibCanvas, arguments );
			},
			buffer: function (width, height, withCtx) {
				var canvas, size, a = slice.call(arguments), last = a[a.length-1];

				withCtx = (typeof last === 'boolean' ? a.pop() : false);

				size = Size(a.length == 1 ? a[0] : a);

				canvas = atom.dom.create("canvas", {
					width  : size.width,
					height : size.height
				}).first;

				if (withCtx) canvas.ctx = new Context2D(canvas);
				return canvas;
			},
			'declare.classes': {},
			declare: function (declareName, shortName, Parent, object) {
				if (typeof shortName == 'object') {
					object = Parent;
					Parent = shortName;
					shortName = null;
				}
				if (object == null) {
					object = Parent;
					Parent = null;
				}
				var Class = declare( declareName, Parent, object );
				if (shortName) {
					if (shortName in this['declare.classes']) {
						throw new Error( 'Duplicate declaration: ' + shortName );
					}
					this['declare.classes'][shortName] = Class;
				}
				return Class;
			},
			extract: function (to) {
				to = to || global;
				for (var k in this['declare.classes']) {
					to[k] = this['declare.classes'][k];
				}
				return to;
			}
		});

	

	
	LibCanvas.declare( 'LibCanvas.App', 'App', {
		initialize: function (settings) {
			this.bindMethods( 'tick' );

			this.layers    = [];
			this.settings  = new Settings({ appendTo: 'body' }).set(settings);
			this.container = new App.Container(
				this.settings.subset(['simple', 'size', 'appendTo'])
			);
			this.resources = new Registry();

			atom.frame.add( this.tick );
		},

		destroy: function () {
			atom.array.invoke( this.layers, 'destroy' );
			atom.frame.remove( this.tick );
			this.container.destroy();
		},

		get rectangle () {
			return this.container.rectangle;
		},

		
		zIndexCompare: function (left, right, inverted) {
			var leftZ, rightZ, factor = inverted ? -1 : +1;

			if (!left  || !left .layer) throw new TypeError( 'Wrong left element'  );
			if (!right || !right.layer) throw new TypeError( 'Wrong right element' );


			leftZ =  left.layer.dom.zIndex;
			rightZ = right.layer.dom.zIndex;

			if (leftZ > rightZ) return -1 * factor;
			if (leftZ < rightZ) return +1 * factor;

			leftZ =  left.zIndex;
			rightZ = right.zIndex;

			if (leftZ > rightZ) return -1 * factor;
			if (leftZ < rightZ) return +1 * factor;

			return 0;
		},

		createLayer: function (settings) {
			if (this.settings.get('simple') && this.layers.length) {
				throw new Error('You can create only one layer in "Simple" mode');
			}

			var layer = new App.Layer(this, settings);
			this.layers.push(layer);
			return layer;
		},

		tick: function (time) {
			atom.array.invoke(this.layers, 'tick', time);
		}
	});

	var App = LibCanvas.App;

	

	
	var Behavior = declare( 'LibCanvas.App.Behavior', {

		eventName: null,

		initialize: function (element, callback) {
			this.element = element;
			this.events  = element.events;
			this.eventArgs(callback);
		},

		started: false,


		changeStatus: function (status){
			if (this.started == status) {
				return false;
			} else {
				this.started = status;
				return true;
			}
		},


		eventArgs: function (callback) {
			if (this.eventName && atom.core.isFunction(callback)) {
				this.events.add( this.eventName, callback );
			}
			return this;
		},


		getMouse: function (handler, strict) {
			var mouse = this.element.layer.app.resources.get(
				handler ? 'mouseHandler' : 'mouse'
			);

			if (strict && !mouse) {
				throw new Error('No mouse in element');
			}

			return mouse;
		}

	});

	

	
	var Clickable = declare( 'LibCanvas.App.Clickable', App.Behavior, {

		eventName: 'statusChange',

		callbacks: {
			mousedown: function (e) {
				Clickable.setValue(this, 'active', true , e);
			},
			mouseup  : function (e) {
				Clickable.setValue(this, 'active', false, e);
			},
			mouseover: function (e) {
				Clickable.setValue(this, 'hover' , true , e);
			},
			mouseout : function (e) {
				Clickable.setValue(this, 'hover' , false, e);
				Clickable.setValue(this, 'active', false, e);
			}
		},

		start: function (callback) {
			if (this.changeStatus(true)) {
				this.eventArgs(callback);
				this.events.add(this.callbacks);
			}
			return this;
		},

		stop: function () {
			if (this.changeStatus(false)) {
				this.events.remove(this.callbacks);
			}
			return this;
		}

	});

	Clickable.setValue = function (element, name, val, event) {
		if (element[name] != val) {
			element[name] = val;
			element.events.fire(
				Clickable.prototype.eventName,
				[name, val, event]
			);
		}
	};

	

	
	declare( 'LibCanvas.App.Container', {
		
		currentSize: null,

		
		doms: [],

		wrapper: null,
		bounds : null,

		initialize: function (settings) {
			this.doms        = [];
			this.settings    = new Settings(settings);
			this.currentSize = new Size(this.settings.get('size') || [0,0]);

			this.isSimple = this.settings.get('simple');

			if (this.isSimple) {
				this.createWrappersSimple();
			} else {
				this.createWrappers();
			}
		},

		get rectangle () {
			var size = this.size;
			return new Rectangle(0, 0, size.width, size.height);
		},

		set size(size) {
			if (this.isSimple) {
				this.doms[0].size = size;
			} else {
				size = this.currentSize.set(size).toObject();
				this.wrapper.css(size);
				this.bounds .css(size);
			}
		},

		get size() {
			return this.currentSize;
		},

		destroy: function () {
			if (!this.isSimple) {
				this.wrapper.destroy();
			}
			return this;
		},

		createDom: function (settings) {
			var dom = new App.Dom( this, settings );
			this.doms.push(dom);
			return dom;
		},

		appendTo: function (element) {
			if (element) this.wrapper.appendTo( element );
			return this;
		},


		createWrappersSimple: function () {
			var size = this.currentSize.toObject();

			this.wrapper = atom.dom(LibCanvas.buffer(size,true));
			this.bounds  = this.wrapper;

			this.wrapper
				.addClass('libcanvas-app-simple')
				.appendTo( this.settings.get('appendTo') )
		},


		createWrappers: function () {
			var size = this.currentSize.toObject();

			this.wrapper = atom.dom.create('div')
				.css(size)
				.addClass('libcanvas-app')
				.appendTo(this.settings.get( 'appendTo' ));

			this.bounds = atom.dom.create('div')
				.css({
					overflow: 'hidden',
					position: 'absolute'
				})
				.css(size)
				.appendTo(this.wrapper);
		}
	});

	


	
	declare( 'LibCanvas.App.Dom', {
		
		currentSize: null,

		
		container: null,

		
		shift: null,


		z: 0,

		initialize: function (container, settings) {
			this.container = container;
			this.settings  = new Settings(settings);
			this.shift = new Point(0,0);
			this.name  = this.settings.get('name') || '';
			this.createSize();
			this.createElement();
		},

		set zIndex (z) {
			this.z = z;
			if (!this.container.isSimple) {
				this.element.css('zIndex', z);
			}
		},

		get zIndex () {
			return this.z;
		},

		set size(size) {
			size = this.currentSize.set(size);

			this.canvas.width  = size.width ;
			this.canvas.height = size.height;
		},

		get size() {
			return this.currentSize;
		},

		destroy: function () {
			this.element.destroy();
			this.size = new Size(0,0);
		},

		
		addShift: function ( shift ) {
			var newShift = this.getShift().move( shift );
			this.element.css({
				marginLeft: newShift.x,
				marginTop : newShift.y
			});
			return this;
		},

		
		setShift: function (shift) {
			return this.addShift( this.shift.diff(shift) );
		},

		
		getShift: function () {
			if (this.container.isSimple) {
				throw new Error('Shift not available in Simple mode');
			}

			return this.shift;
		},


		createSize: function () {
			var size = this.settings.get('size');

			if (this.container.isSimple) {
				this.currentSize = this.container.size;
				if (size) {
					this.currentSize.set(size);
				}
			} else {
				this.currentSize = size || this.container.size.clone();
			}


		},


		createElement: function () {
			if (this.container.isSimple) {
				this.createElementSimple();
			} else {
				this.createElementNormal();
			}
		},


		createElementNormal: function () {
			this.canvas  = new LibCanvas.Buffer(this.size, true);

			this.element = atom.dom(this.canvas);

			this.element
				.attr({ 'data-name': this.name  })
				.css ({ 'position' : 'absolute' })
				.appendTo( this.container.bounds );

			this.zIndex = this.settings.get('zIndex') || 0;
		},


		createElementSimple: function () {
			this.element = this.container.wrapper;

			this.canvas  = this.element.first;
			this.canvas.width  = this.size.width;
			this.canvas.height = this.size.height;
		}
	});

	

	
	declare( 'LibCanvas.App.Draggable', App.Behavior, {

		eventName: 'moveDrag',

		stopDrag: [ 'up', 'out' ],

		initialize: function method (element, callback) {
			this.bindMethods([ 'onStop', 'onDrag', 'onStart' ]);

			method.previous.call( this, element, callback );
		},

		start: function (callback) {
			if (this.changeStatus(true)) {
				this.mouse = this.getMouse(false, true);
				this.eventArgs(callback);
				this.events.add( 'mousedown', this.onStart )
			}
			return this;
		},

		stop: function () {
			if (this.changeStatus(false)) {
				this.events.remove( 'mousedown', this.onStart );
			}
			return this;
		},


		bindMouse: function (method) {
			var mouse = this.mouse, stop = this.stopDrag;

			mouse.events
				[method]( 'move', this.onDrag )
				[method](  stop , this.onStop );

			return mouse;
		},


		onStart: function (e) {
			if (e.button !== 0) return;

			this.bindMouse('add');
			this.events.fire('startDrag', [ e ]);
		},


		onDrag: function (e) {
			if (!this.element.layer) {
				return this.onStop(e, true);
			}

			var delta = this.mouse.delta;
			this.element.distanceMove( delta );
			this.events.fire('moveDrag', [delta, e]);
		},


		onStop: function (e, forced) {
			if (e.button === 0 || forced === true) {
				this.bindMouse('remove');
				this.events.fire('stopDrag', [ e ]);
			}
		}
	});

	

	
	declare( 'LibCanvas.App.LayerShift', {

		initialize: function (layer) {
			this.layer    = layer;
			this.shift    = new Point(0, 0);
			this.elementsShift = new Point(0, 0);
		},

		
		shift: null,

		
		elementsShift: null,

		
		addElementsShift: function (shift) {
			if (!shift) {
				shift = this.elementsShift.diff(this.shift);
			} else {
				shift = Point(shift);
			}
			var e = this.layer.elements, i = e.length;
			while (i--) e[i].addShift(shift);
			this.elementsShift.move(shift);
			return this;
		},

		
		limitShift: null,

		
		setLimitShift: function (limitShift) {
			this.limitShift = limitShift ? Rectangle(limitShift) : null;
			return this;
		},

		
		addShift: function ( shift, withElements ) {
			shift = new Point( shift );

			var limit = this.limitShift, current = this.shift;
			if (limit) {
				shift.x = atom.number.limit(shift.x, limit.from.x - current.x, limit.to.x - current.x);
				shift.y = atom.number.limit(shift.y, limit.from.y - current.y, limit.to.y - current.y);
			}

			current.move( shift );
			this.layer.dom.addShift( shift );
			this.layer.dom.canvas.ctx.translate( shift, true );
			if (withElements) this.addElementsShift( shift );
			return this;
		},

		
		setShift: function (shift, withElements) {
			return this.addShift( this.shift.diff(shift), withElements );
		},

		
		getShift: function () {
			return this.shift;
		}
	});

	
	
	declare( 'LibCanvas.App.Dragger', {
		initialize: function (mouse) {
			this.bindMethods([ 'dragStart', 'dragStop', 'dragMove' ]);
			this.events = new Events(this);

			this.mouse  = mouse;
			this.shifts = [];

			this._events = {
				down: this.dragStart,
				up  : this.dragStop,
				out : this.dragStop,
				move: this.dragMove
			};
		},

		addLayerShift: function (shift) {
			this.shifts.push( shift );
			return this;
		},

		started: false,

		start: function (callback) {
			if (callback !== undefined) {
				this.callback = callback;
			}
			this.started = true;
			this.mouse.events.add( this._events );
			return this;
		},

		stop: function () {
			this.started = false;
			this.mouse.events.remove( this._events );
			return this;
		},


		dragStart: function (e) {
			if (!this.shouldStartDrag(e)) return;

			for (var i = this.shifts.length; i--;) {
				this.shifts[i].layer.stop();
			}
			this.drag = true;
			this.events.fire( 'start', [ e ]);
		},

		dragStop: function (e) {
			if (!this.drag) return;

			for (var i = this.shifts.length; i--;) {
				var shift = this.shifts[i];
				shift.addElementsShift();
				shift.layer.start();
			}

			this.drag = false;
			this.events.fire( 'stop', [ e ]);
		},

		dragMove: function (e) {
			if (!this.drag) return;
			for (var i = this.shifts.length; i--;) {
				this.shifts[i].addShift(this.mouse.delta);
			}
		},

		shouldStartDrag: function (e) {
			if (!this.started) return false;

			return this.callback ? this.callback(e) : true;
		}
	});

	

	
	declare( 'LibCanvas.App.Element', {

		layer   : null,
		zIndex  : 0,
		renderer: null,
		settings: {},

		
		initialize: function (layer, settings) {
			this.bindMethods([ 'redraw', 'destroy' ]);

			this.events = new Events(this);
			this.settings = new Settings({ hidden: false })
				.set(this.settings)
				.set(settings)
				.addEvents(this.events);
			layer.addElement( this );

			var ownShape = this.shape && this.shape != this.constructor.prototype.shape;

			if (ownShape || this.settings.get('shape')) {
				if (!ownShape) this.shape = this.settings.get('shape');
				this.saveCurrentBoundingShape();
			}
			if (this.settings.get('zIndex') != null) {
				this.zIndex = Number( this.settings.get('zIndex') );
			}

			this.configure();
		},

		configure: function () {
			return this;
		},

		previousBoundingShape: null,

		get currentBoundingShape () {
			return this.shape.getBoundingRectangle().fillToPixel();
		},

		destroy: function () {
			this.layer.rmElement( this );
			return this;
		},

		distanceMove: function (point) {
			this.shape.move(point);
			return this;
		},

		hasPoint: function (point) {
			return this.shape.hasPoint( point );
		},

		isTriggerPoint: function (point) {
			if (this.hasMousePoint) {
				return this.hasMousePoint(point);
			} else {
				return this.hasPoint(point);
			}
		},

		addShift: function (shift) {
			this.shape.move( shift );
			if (this.previousBoundingShape)
				this.previousBoundingShape.move( shift );
			return this;
		},

		isVisible: function () {
			return !this.settings.get('hidden');
		},

		redraw: function () {
			this.layer.redrawElement( this );
			return this;
		},

		onUpdate: function (time) {
			return this;
		},

		clearPrevious: function ( ctx ) {
			if (this.previousBoundingShape) ctx.clear( this.previousBoundingShape );
			return this;
		},

		saveCurrentBoundingShape: function () {
			var shape = this.currentBoundingShape;
			this.previousBoundingShape = shape.fillToPixel ?
				shape.clone().fillToPixel() : shape.clone().grow( 2 );
			return this;
		},

		renderToWrapper: function (ctx, resources) {
			this.renderTo(ctx, resources);
			return this;
		},

		renderTo: function (ctx, resources) {
			if (this.renderer) {
				this.renderer.renderTo(ctx, resources);
			}
			return this;
		}
	});

	


	
	declare( 'LibCanvas.App.Layer', {

		initialize: function (app, settings) {
			this.settings = new Settings({
				invoke      : app.settings.get('invoke'),
				intersection: 'auto' // auto|manual|all
			}).set(settings);

			this.intersection  = this.settings.get('intersection');
			this.redrawAllMode = this.intersection === 'all' || this.intersection === 'full';

			this.app      = app;
			this.elements = [];
			this.redraw   = this.redrawAllMode ? this.elements : [];
			this.clear    = [];
			this.createDom();
		},

		get ctx () {
			return this.dom.canvas.ctx;
		},


		stopped: false,

		destroy: function () {
			atom.array.invoke( this.elements, 'destroy' );
			this.dom.destroy();
		},

		hide: function () {
			this.dom.element.css({ display: 'none' });
			return this.stop();
		},

		show: function () {
			this.dom.element.css({ display: null });
			return this.stop();
		},

		start: function () {
			this.stopped = false;
			return this;
		},

		stop: function () {
			this.stopped = true;
			return this;
		},

		redrawAll: function () {
			this.elements.invoke('redraw');
			return this;
		},


		tick: function (time) {
			if (this.stopped) return this;

			if (this.settings.get( 'invoke' )) {
				this.sortElements();
				this.updateAll(time);
			}

			if (this.needUpdate) {
				this.draw();
				this.needUpdate = false;
			}

			return this;
		},



		draw: function () {
			var
				intersection = this.intersection,
				ctx          = this.dom.canvas.ctx,
				resources    = this.app.resources;

			if (intersection === 'full') {
				ctx.clearAll();
			} else {
				if (intersection === 'auto') {
					this.addIntersections();
				} else if (intersection === 'all') {
					atom.array.invoke(this.clear, 'clearPrevious', ctx, resources);
				}

				atom.array.invoke(this.redraw, 'clearPrevious', ctx, resources);
			}

			this.drawElements(this.redraw, ctx, resources);

			if (intersection === 'all') {
				this.clear.length = 0;
			} else if (intersection !== 'full') {
				this.redraw.length = 0;
			}
		},


		drawElements: function (elements, ctx, resources) {
			// draw elements with the lower zIndex first
			atom.array.sortBy( elements, 'zIndex' );

			for (var i = elements.length; i--;) {
				this.drawElement(elements[i], ctx, resources);
			}
		},


		drawElement: function (elem, ctx, resources) {
			if (elem.layer == this) {
				elem.redrawRequested = false;
				if (elem.isVisible()) {
					elem.renderToWrapper( ctx, resources );
					if (this.intersection !== 'full') {
						elem.saveCurrentBoundingShape();
					}
				}
			}
		},


		sortElements: function () {
			atom.array.sortBy( this.elements, 'zIndex' );
		},


		updateAll: function (time) {
			atom.array.invoke( this.elements, 'onUpdate', time, this.app.resources );
		},


		needUpdate: false,


		createDom: function () {
			this.dom = this.app.container.createDom(
				this.settings.subset([ 'name', 'zIndex', 'size' ])
			);
		},


		addElement: function (element) {
			if (element.layer != this) {
				if (element.layer) {
					element.layer.rmElement( element );
				}

				element.layer = this;
				this.elements.push( element );
				this.redrawElement( element );
			}
			return this;
		},


		rmElement: function (element) {
			if (element.layer == this) {
				if (this.intersection === 'all') {
					this.needUpdate = true;
					this.clear.push(element);
				} else {
					this.redrawElement( element );
				}
				atom.core.eraseOne( this.elements, element );
				element.layer = null;
			}
			return this;
		},


		redrawElement: function (element) {
			if (element.layer == this && !element.redrawRequested) {
				this.needUpdate = true;
				element.redrawRequested = true;
				if (!this.redrawAllMode) {
					this.redraw.push( element );
				}
			}
			return this;
		},


		addIntersections: function () {
			var i, elem, layer = this;

			for (i = 0; i < this.redraw.length; i++) {
				elem = this.redraw[i];

				this.findIntersections(elem.previousBoundingShape, elem, this.redrawElement);
				this.findIntersections(elem. currentBoundingShape, elem, function (e) {
					// we need to redraw it, only if it will be over our element
					if (e.zIndex > elem.zIndex) {
						layer.redrawElement( e );
					}
				});
			}
		},


		findIntersections: function (shape, elem, fn) {
			if (!shape) return;

			var i = this.elements.length, e;
			while (i--) {
				e = this.elements[i];
				// check if we need also `e.currentBoundingShape.intersect( shape )`
				if (e != elem && e.isVisible() &&
					e.previousBoundingShape &&
					e.previousBoundingShape.intersect( shape )
					) fn.call( this, e );
			}
		}

	});


	

	
	var Geometry = declare( 'LibCanvas.Geometry', {
		initialize : function () {
			if (arguments.length) this.set.apply(this, arguments);
		},
		cast: function (args) {
			return this.constructor.castArguments(args);
		}
	}).own({
			invoke: declare.castArguments,
			from : function (obj) {
				return this(obj);
			}
		});

	

	
	var Point = LibCanvas.declare( 'LibCanvas.Point', 'Point', Geometry, {
		x: 0,
		y: 0,

		
		set : function (x, y) {
			if (arguments.length != 2) {
				if (atom.core.isArrayLike(x)) {
					y = x[1];
					x = x[0];
				} else if (x && x.x != null && x.y != null) {
					y = x.y;
					x = x.x;
				} else {
					throw new TypeError( 'Wrong Arguments In Point.Set' );
				}
			}

			this.x = Number(x);
			this.y = Number(y);
			return this;
		},
		
		move: function (distance, reverse) {
			distance = this.cast(distance);
			reverse  = reverse ? -1 : 1;
			this.x += distance.x * reverse;
			this.y += distance.y * reverse;
			return this;
		},
		
		moveTo : function (point) {
			return this.move(this.diff(this.cast(point)));
		},
		
		angleTo : function (point) {
			var diff = this.cast(point).diff(this);
			return atom.math.normalizeAngle( Math.atan2(diff.y, diff.x) );
		},
		
		distanceTo : function (point) {
			var diff = this.cast(point).diff(this);
			return atom.math.hypotenuse(diff.x, diff.y);
		},
		
		checkDistanceTo : function (point, distance, equals) {
			var deltaX, deltaY, realDistanceSq, maxDistanceSq;

			deltaX = Math.abs(this.x - point.x);
			if (deltaX > distance) return false;

			deltaY = Math.abs(this.y - point.y);
			if (deltaY > distance) return false;

			realDistanceSq = deltaX*deltaX + deltaY*deltaY;
			maxDistanceSq  = distance*distance;

			return (realDistanceSq < maxDistanceSq) ||
				(equals && realDistanceSq == maxDistanceSq)
		},
		
		diff : function (point) {
			return new this.constructor(point).move(this, true);
		},
		
		rotate : function (angle, pivot) {
			pivot = pivot ? this.cast(pivot) : new this.constructor(0, 0);
			if (this.equals(pivot)) return this;

			var radius = pivot.distanceTo(this);
			var sides  = pivot.diff(this);
			// TODO: check, maybe here should be "sides.y, sides.x" ?
			var newAngle = Math.atan2(sides.x, sides.y) - angle;

			return this.moveTo({
				x : Math.sin(newAngle) * radius + pivot.x,
				y : Math.cos(newAngle) * radius + pivot.y
			});
		},
		
		scale : function (power, pivot) {
			pivot = pivot ? this.cast(pivot) : new this.constructor(0, 0);

			var diff = this.diff(pivot), isObject = typeof power == 'object';
			return this.moveTo({
				x : pivot.x - diff.x  * (isObject ? power.x : power),
				y : pivot.y - diff.y  * (isObject ? power.y : power)
			});
		},
		
		alterPos : function (arg, fn) {
			return this.moveTo({
				x: fn(this.x, typeof arg == 'object' ? arg.x : arg),
				y: fn(this.y, typeof arg == 'object' ? arg.y : arg)
			});
		},
		
		mul : function (arg) {
			return this.alterPos(arg, function(a, b) {
				return a * b;
			});
		},
		
		getNeighbour : function (dir) {
			return this.clone().move(this.constructor.shifts[dir]);
		},
		
		get neighbours () {
			return this.getNeighbours( true );
		},
		
		getNeighbours: function (corners, asObject) {
			var shifts = ['t', 'l', 'r', 'b'], result, i, dir;

			if (corners) shifts.push('tl', 'tr', 'bl', 'br');

			if (asObject) {
				result = {};
				for (i = shifts.length; i--;) {
					dir = shifts[i];
					result[dir] = this.getNeighbour( dir );
				}
				return result;
			} else {
				return shifts.map(this.getNeighbour.bind(this));
			}
		},
		
		equals : function (to, accuracy) {
			to = this.cast(to);
			if (accuracy == null) {
				return to.x == this.x && to.y == this.y;
			}
			return atom.number.equals(this.x, to.x, accuracy)
				&& atom.number.equals(this.y, to.y, accuracy);
		},
		
		toObject: function () {
			return { x: this.x, y: this.y };
		},
		toArray: function () {
			return [ this.x, this.y ];
		},
		
		invoke: function (method) {
			this.x = this.x[method]();
			this.y = this.y[method]();
			return this;
		},
		
		map: function (fn, context) {
			this.x = fn.call(context || this, this.x, 'x', this);
			this.y = fn.call(context || this, this.y, 'y', this);
			return this;
		},
		
		mean: function (points) {
			var l = points.length, i = l, x = 0, y = 0;
			while (i--) {
				x += points[i].x;
				y += points[i].y;
			}
			return this.set(x/l, y/l);
		},
		
		snapToPixel: function () {
			this.x += 0.5 - (this.x - Math.floor(this.x));
			this.y += 0.5 - (this.y - Math.floor(this.y));
			return this;
		},
		
		reverse: function () {
			this.x *= -1;
			this.y *= -1;
			return this;
		},
		
		clone : function () {
			return new this.constructor(this);
		},
		
		dump: function () {
			return '[Point(' + this.x + ', ' + this.y + ')]';
		}
	});


	Point.from = function (object) {
		if (object == null) return null;

		return object instanceof Point ? object : new Point(object);
	};

	Point.shifts = atom.object.map({
		top    : [ 0, -1],
		right  : [ 1,  0],
		bottom : [ 0,  1],
		left   : [-1,  0],
		t      : [ 0, -1],
		r      : [ 1,  0],
		b      : [ 0,  1],
		l      : [-1,  0],
		tl     : [-1, -1],
		tr     : [ 1, -1],
		bl     : [-1,  1],
		br     : [ 1,  1]
	}, Point);

	

	
	var Mouse = LibCanvas.declare( 'LibCanvas.Mouse', 'Mouse', {

		elem: null,

		
		inside: false,
		
		point: null,
		
		previous: null,
		
		delta: null,
		
		events: null,


		mapping: {
			click      : 'click',
			dblclick   : 'dblclick',
			contextmenu: 'contextmenu',

			mouseover : 'over',
			mouseout  : 'out',
			mousedown : 'down',
			mouseup   : 'up',
			mousemove : 'move',

			DOMMouseScroll: 'wheel',
			mousewheel    : 'wheel'
		},

		initialize : function (elem, offsetElem) {
			this.bindMethods( 'onEvent' );

			if (elem == null) {
				throw new TypeError('`elem` is undefined');
			}

			this.elem       = atom.dom(elem);
			this.offsetElem = offsetElem ? atom.dom(offsetElem) : this.elem;

			this.point    = new Point(0, 0);
			this.previous = new Point(0, 0);
			this.delta    = new Point(0, 0);
			this.events   = new Events(this);

			this.listen(this.onEvent);
		},

		fire: function (name, e) {
			this.events.fire(name, [e, this]);
			return this;
		},

		onEvent: function (e) {
			var
				name = this.mapping[e.type],
				fn   = this.eventActions[name];

			if (fn) fn.call(this, e);

			this.fire(name, e);
		},

		getOffset: function (e) {
			return this.constructor.getOffset(e, this.offsetElem);
		},

		set: function (e, inside) {
			var point = this.getOffset(e);

			this.previous.set( this.point );
			this.delta   .set( this.previous.diff( point ) );
			this.point   .set( point );
			this.inside = inside;
		},

		eventActions: {
			wheel: function (e) {
				this.constructor.addWheelDelta(e);
			},

			move: function (e) {
				this.set(e, true);
			},

			down: function (e) {
				this.set(e, true);
			},

			over: function (e) {
				if (this.checkEvent(e)) {
					this.fire('enter', e);
				}
			},

			out: function (e) {
				if (this.checkEvent(e)) {
					this.set(e, false);
					this.fire('leave', e);
				}
			}
		},

		checkEvent: function (e) {
			var related = e.relatedTarget, elem = this.elem;

			return related == null || (
				related && related != elem.first && !elem.contains(related)
				);
		},

		listen : function (callback) {
			this.elem
				.bind({ selectstart: false })
				.bind(atom.object.map(
				this.mapping, atom.fn.lambda(callback)
			));
		}
	}).own({
			prevent: function (e) {e.preventDefault()},
			addWheelDelta: function (e) {
				e.delta =
					// IE, Opera, Chrome
					e.wheelDelta ? e.wheelDelta > 0 ? 1 : -1 :
						// Fx
						e.detail     ? e.detail     < 0 ? 1 : -1 : null;

				return e;
			},
			eventSource: function (e) {
				return e.changedTouches ? e.changedTouches[0] : e;
			},
			expandEvent: function (e) {
				var source = this.eventSource(e);

				if (e.pageX == null) {
					e.pageX = source.pageX != null ? source.pageX : source.clientX + document.scrollLeft;
					e.pageY = source.pageY != null ? source.pageY : source.clientY + document.scrollTop ;
				}

				return e;
			},
			getOffset : function (e, element) {
				var elementOffset = atom.dom(element || this.eventSource(e).target).offset();

				this.expandEvent(e);

				return new Point(
					e.pageX - elementOffset.x,
					e.pageY - elementOffset.y
				);
			}
		});

	

	
	declare( 'LibCanvas.App.PointSearch', {

		initialize: function () {
			this.elements = [];
		},

		add: function (elem) {
			this.elements.push( elem );
			return this;
		},

		remove: function (elem) {
			atom.core.eraseOne( this.elements, elem );
			return this;
		},

		removeAll: function () {
			this.elements.length = 0;
			return this;
		},

		findByPoint: function (point) {
			var e = this.elements, i = e.length, result = [];
			while (i--) if (e[i].isTriggerPoint( point )) {
				result.push(e[i]);
			}
			return result;
		}

	});

	
	App.ElementsMouseSearch = App.PointSearch;

	

	
	declare( 'LibCanvas.App.MouseHandler', {

		events: 'down up move out dblclick contextmenu wheel'.split(' '),


		mouse: null,

		
		initialize: function (settings) {
			var handler = this;

			handler.settings = new Settings(settings);
			handler.lastMouseMove = [];
			handler.lastMouseDown = [];
			handler.subscribers   = [];

			handler.app    = handler.settings.get('app');
			handler.mouse  = handler.settings.get('mouse');
			handler.compareFunction = function (left, right) {
				return handler.app.zIndexCompare(left, right, true);
			};
			handler.search =
				handler.settings.get('search') ||
					new App.PointSearch();

			this.events.forEach(function (type) {
				handler.mouse.events.add( type, function (e) {
					handler.event(type, e);
				});
			});
		},

		stop: function () {
			this.stopped = true;
			return this;
		},

		start: function () {
			this.stopped = false;
			return this;
		},

		subscribe : function (elem) {
			if (this.subscribers.indexOf(elem) == -1) {
				this.subscribers.push(elem);
				this.search.add(elem);
			}
			return this;
		},

		unsubscribe : function (elem) {
			var index = this.subscribers.indexOf(elem);
			if (index != -1) {
				this.subscribers.splice(index, 1);
				atom.core.eraseOne(this.lastMouseDown, elem);
				atom.core.eraseOne(this.lastMouseMove, elem);
				this.search.remove(elem);
			}
			return this;
		},

		unsubscribeAll: function () {
			this.subscribers.length = 0;
			this.search.removeAll();
			return this;
		},

		fall: function () {
			this.falling = true;
			return this;
		},

		getOverElements: function () {
			if (!this.mouse.inside) return [];

			var
				elements = this.search.findByPoint( this.mouse.point ),
				i = elements.length;

			while (i--) if (!elements[i].layer) {
				this.unsubscribe(elements[i]);
				elements.splice(i, 1);
			}

			return elements.sort( this.compareFunction );
		},


		stopped: false,


		falling: false,


		checkFalling: function () {
			var value = this.falling;
			this.falling = false;
			return value;
		},


		event: function (type, e) {
			if (this.stopped) return;

			var method = ['dblclick', 'contextmenu', 'wheel'].indexOf( type ) >= 0
				? 'forceEvent' : 'parseEvent';

			return this[method]( type, e );
		},


		parseEvent: function (type, event) {
			if (type == 'down') this.lastMouseDown.length = 0;

			var i, elem,
				elements = this.getOverElements(),
				stopped  = false,
				eventArgs = [event],
				isChangeCoordEvent = (type == 'move' || type == 'out');

			// В первую очередь - обрабатываем реальный mouseout с элементов
			if (isChangeCoordEvent) {
				this.informOut(eventArgs, elements);
			}

			for (i = elements.length; i--;) {
				elem = elements[i];
				// мышь над элементом, сообщаем о mousemove
				// о mouseover, mousedown, click, если необходимо
				if (!stopped) {
					if (this.fireElem( type, elem, eventArgs )) {
						stopped = true;
						if (!isChangeCoordEvent) break;
					}
					// предыдущий элемент принял событие на себя
					// необходимо сообщить остальным элементам под ним о mouseout
					// Но только если это событие передвижения или выхода за границы холста
					// а не активационные, как маусдаун или маусап
				} else {
					this.stoppedElem(elem, eventArgs);
				}
			}

			return stopped;
		},


		informOut: function (eventArgs, elements) {
			var
				elem,
				lastMove = this.lastMouseMove,
				i = lastMove.length;
			while (i--) {
				elem = lastMove[i];
				if (elements.indexOf(elem) < 0) {
					elem.events.fire( 'mouseout', eventArgs );
					lastMove.splice(i, 1);
				}
			}
		},


		stoppedElem: function (elem, eventArgs) {
			var
				lastMove = this.lastMouseMove,
				index    = lastMove.indexOf(elem);
			if (index > -1) {
				elem.events.fire( 'mouseout', eventArgs );
				lastMove.splice(index, 1);
			}
		},


		fireElem: function (type, elem, eventArgs) {
			var
				lastDown = this.lastMouseDown,
				lastMove = this.lastMouseMove;

			if (type == 'move') {
				if (lastMove.indexOf(elem) < 0) {
					elem.events.fire( 'mouseover', eventArgs );
					lastMove.push( elem );
				}
			} else if (type == 'down') {
				lastDown.push(elem);
				// If mouseup on this elem and last mousedown was on this elem - click
			} else if (type == 'up' && lastDown.indexOf(elem) > -1) {
				elem.events.fire( 'click', eventArgs );
			}
			elem.events.fire( 'mouse' + type, eventArgs );

			return !this.checkFalling();
		},


		forceEvent: function (type, event) {
			var
				elements = this.getOverElements(),
				i = elements.length;
			while (i--) {
				elements[i].events.fire( type, [ event ]);
				if (!this.checkFalling()) {
					break;
				}
			}
		}

	});

	

	
	var Size = LibCanvas.declare( 'LibCanvas.Size', 'Size', Point, {
		set: function method (size) {
			if (typeof size == 'object' && size.width != null) {
				this.x = Number(size.width);
				this.y = Number(size.height);

				return this;
			}
			return method.previous.apply( this, arguments );
		},

		get width  ( ) { return this.x },
		get height ( ) { return this.y },
		set width  (w) { this.x = w },
		set height (h) { this.y = h },

		
		toObject: function () {
			return { width: this.x, height: this.y };
		}
	});


	Size.from = function (object) {
		if (object == null) return null;

		return object instanceof Size ? object : new Size(object);
	};

	

	var shapeTestBuffer = function () {
		if (!shapeTestBuffer.buffer) {
			return shapeTestBuffer.buffer = LibCanvas.buffer(1, 1, true);
		}
		return shapeTestBuffer.buffer;
	};

	
	var Shape = declare( 'LibCanvas.Shape', Geometry, {
		set        : 'abstract',
		hasPoint   : 'abstract',
		processPath: 'abstract',
		draw : function (ctx, type) {
			this.processPath(ctx)[type]();
			return this;
		},
		// Методы ниже рассчитывают на то, что в фигуре есть точки from и to
		getCoords : function () {
			return this.from;
		},
		
		grow: function (size) {
			if (typeof size == 'number') {
				size = new Point(size/2, size/2);
			} else {
				size = new Point(size.x/2, size.y/2);
			}

			this.from.move(size, true);
			this. to .move(size);
			return this;
		},
		get x () { return this.from.x },
		get y () { return this.from.y },
		set x (x) {
			return this.move(new Point(x - this.x, 0));
		},
		set y (y) {
			return this.move(new Point(0, y - this.y));
		},
		get bottomLeft () {
			return new Point(this.from.x, this.to.y);
		},
		get topRight() {
			return new Point(this.to.x, this.from.y);
		},
		get center() {
			var from = this.from, to = this.to;
			return new Point( (from.x + to.x) / 2, (from.y + to.y) / 2 );
		},
		getBoundingRectangle: function () {
			return new Rectangle( this.from, this.to );
		},
		getCenter : function () {
			return this.center;
		},
		move : function (distance, reverse) {
			this.from.move(distance, reverse);
			this. to .move(distance, reverse);
			return this;
		},
		equals : function (shape, accuracy) {
			return shape instanceof this.constructor &&
				shape.from.equals(this.from, accuracy) &&
				shape.to  .equals(this.to  , accuracy);
		},
		clone : function () {
			return new this.constructor(this.from.clone(), this.to.clone());
		},
		dumpPoint: function (point) {
			return '[' + point.x + ', ' + point.y + ']';
		},
		dump: function (shape) {
			if (!shape) return this.toString();
			return '[shape '+shape+'(from'+this.dumpPoint(this.from)+', to'+this.dumpPoint(this.to)+')]';
		}
	});

	

	
	var MinusOnePoint = new Point(-1, -1);

	var Rectangle = LibCanvas.declare( 'LibCanvas.Shapes.Rectangle', 'Rectangle', Shape, {
		set : function () {
			var
				center,
				size,
				a = atom.array.pickFrom(arguments),
				first = a[0];

			this.from = null;
			this.to   = null;

			if (a.length == 4) {
				this.from = new Point(a[0], a[1]);
				this.to   = new Point(a[0]+a[2], a[1]+a[3]);
			} else if (a.length == 2) {
				if ('width' in a[1] && 'height' in a[1]) {
					this.set({ from: a[0], size: a[1] });
				} else {
					this.from = Point.from(a[0]);
					this.to   = Point.from(a[1]);
				}
			} else if (first.center && first.size) {
				center = Point.from(first.center);
				size   = Size.from(first.size);

				this.from = new Point(center.x - size.x/2, center.y - size.y/2);
				this.to   = new Point(center.x + size.x/2, center.y + size.y/2);
			} else {
				if (first.from) this.from = Point.from(first.from);
				if (first.to  ) this.to   = Point.from(first.to);

				if (!this.from || !this.to && first.size) {
					size = Size.from(first.size);

					if (this.from) {
						this.to   = new Point(this.from.x + size.x, this.from.y + size.y);
					} else {
						this.from = new Point(this.to.x   - size.x, this.to.y   - size.y);
					}
				}
			}

			return this;
		},

		get width() {
			return this.to.x - this.from.x;
		},
		get height() {
			return this.to.y - this.from.y;
		},
		set width (width) {
			this.to.x = this.from.x + width;
		},
		set height (height) {
			this.to.y = this.from.y + height;
		},
		get size () {
			return new Size( this.width, this.height );
		},
		set size (size) {
			this.to.set(this.from.x + size.width, this.from.y + size.height);
		},
		
		hasPoint : function (point, padding) {
			point   = Point.from(point);
			padding = padding || 0;
			return point.x != null && point.y != null
				&& atom.number.between(point.x, Math.min(this.from.x, this.to.x) + padding, Math.max(this.from.x, this.to.x) - padding, 'L')
				&& atom.number.between(point.y, Math.min(this.from.y, this.to.y) + padding, Math.max(this.from.y, this.to.y) - padding, 'L');
		},
		align: function (rect, sides) {
			if (sides == null) sides = 'center middle';

			var moveTo = this.from.clone();
			if (sides.indexOf('left') != -1) {
				moveTo.x = rect.from.x;
			} else if (sides.indexOf('center') != -1) {
				moveTo.x = rect.from.x + (rect.width - this.width) / 2;
			} else if (sides.indexOf('right') != -1) {
				moveTo.x = rect.to.x - this.width;
			}

			if (sides.indexOf('top') != -1) {
				moveTo.y = rect.from.y;
			} else if (sides.indexOf('middle') != -1) {
				moveTo.y = rect.from.y + (rect.height - this.height) / 2;
			} else if (sides.indexOf('bottom') != -1) {
				moveTo.y = rect.to.y - this.height;
			}

			return this.moveTo( moveTo );
		},
		
		moveTo: function (rect) {
			if (rect instanceof Point) {
				this.move( this.from.diff(rect) );
			} else {
				rect = Rectangle.from(rect);
				this.from.moveTo(rect.from);
				this.  to.moveTo(rect.to);
			}
			return this;
		},
		
		draw : function (ctx, type) {
			// fixed Opera bug - cant drawing rectangle with width or height below zero
			ctx.original(type + 'Rect', [
				Math.min(this.from.x, this.to.x),
				Math.min(this.from.y, this.to.y),
				Math.abs(this.width ),
				Math.abs(this.height)
			]);
			return this;
		},
		
		processPath : function (ctx, noWrap) {
			if (!noWrap) ctx.beginPath();
			ctx.ctx2d.rect( this.from.x, this.from.y, this.width, this.height );
			if (!noWrap) ctx.closePath();
			return ctx;
		},
		
		intersect : function (obj) {
			if (obj.prototype != this.constructor) {
				if (obj.getBoundingRectangle) {
					obj = obj.getBoundingRectangle();
				} else return false;
			}
			return this.from.x < obj.to.x && this.to.x > obj.from.x
				&& this.from.y < obj.to.y && this.to.y > obj.from.y;
		},
		getBoundingRectangle: function () {
			return this;
		},
		
		getRandomPoint : function (margin) {
			margin = margin || 0;
			return new Point(
				atom.number.random(margin, this.width  - margin),
				atom.number.random(margin, this.height - margin)
			);
		},
		
		fillToPixel: function () {
			var from = this.from, to = this.to,
				point = function (side, round) {
					return new Point(
						Math[round](Math[side](from.x, to.x)),
						Math[round](Math[side](from.y, to.y))
					);
				};

			return new Rectangle(
				point( 'min', 'floor' ),
				point( 'max', 'ceil'  )
			);
		},
		
		snapToPixel: function () {
			this.from.snapToPixel();
			this.to.snapToPixel().move(MinusOnePoint);
			return this;
		},
		
		dump: function method (name) {
			return method.previous.call(this, name || 'Rectangle');
		},
		
		toPolygon: function () {
			return new Polygon(
				this.from.clone(), this.topRight, this.to.clone(), this.bottomLeft
			);
		}
	});


	Rectangle.from = function (object) {
		if (object == null) return null;

		return object instanceof Rectangle ? object : new Rectangle(object);
	};

	

	
	var Circle = LibCanvas.declare( 'LibCanvas.Shapes.Circle', 'Circle', Shape, {
		set : function () {
			var
				center, radius,
				a = atom.array.pickFrom(arguments);

			if (a.length >= 3) {
				center = new Point(a[0], a[1]);
				radius = a[2];
			} else if (a.length == 2) {
				center = Point.from(a[0]);
				radius = a[1];
			} else {
				a = a[0];
				radius = a.r == null ? a.radius : a.r;
				if ('x' in a && 'y' in a) {
					center = new Point(a.x, a.y);
				} else if ('center' in a) {
					center = Point.from(a.center);
				} else if ('from' in a) {
					center = new Point(a.from).move({
						x: this.radius,
						y: this.radius
					});
				}
			}

			this.center = center;
			this.radius = radius;

			if (center == null) throw new TypeError('center is null');
			if (radius == null) throw new TypeError('radius is null');
		},
		// we need accessors to redefine parent "get center"
		get center ( ) { return this._center; },
		set center (c) { this._center = c; },
		grow: function (size) {
			this.radius += size/2;
			return this;
		},
		getCoords : function () {
			return this.center;
		},
		hasPoint : function (point) {
			return this.center.checkDistanceTo(point, this.radius, true);
		},
		scale : function (factor, pivot) {
			if (pivot) this.center.scale(factor, pivot);
			this.radius *= factor;
			return this;
		},
		getCenter: function () {
			return this.center;
		},
		intersect : function (obj) {
			if (obj instanceof this.constructor) {
				return this.center.checkDistanceTo(obj.center, this.radius + obj.radius, true);
			} else {
				return this.getBoundingRectangle().intersect( obj );
			}
		},
		move : function (distance, reverse) {
			this.center.move(distance, reverse);
			return this;
		},
		processPath : function (ctx, noWrap) {
			if (!noWrap) ctx.beginPath();
			if (this.radius) {
				ctx.arc({
					circle : this,
					angle  : [0, Math.PI * 2]
				});
			}
			if (!noWrap) ctx.closePath();
			return ctx;
		},
		getBoundingRectangle: function () {
			var r = this.radius, center = this.center;
			return new Rectangle(
				new Point(center.x - r, center.y - r),
				new Point(center.x + r, center.y + r)
			);
		},
		clone : function () {
			return new this.constructor(this.center.clone(), this.radius);
		},
		getPoints : function () {
			return { center : this.center };
		},
		equals : function (shape, accuracy) {
			return shape instanceof this.shape &&
				shape.radius == this.radius    &&
				shape.center.equals(this.center, accuracy);
		},
		dump: function () {
			return '[shape Circle(center['+this.center.x+', '+this.center.y+'], '+this.radius+')]';
		}
	});


	Circle.from = function (object) {
		if (object == null) return null;

		return object instanceof Circle ? object : new Circle(object);
	};


	

	atom.core.append(HTMLCanvasElement,
		
		{

			_newContexts: {},
			
			addContext: function (name, ctx) {
				this._newContexts[name] = ctx;
				return this;
			},
			
			getContext: function (name) {
				return this._newContexts[name] || null;
			}
		});

	atom.core.append(HTMLCanvasElement.prototype,
		
		{
			getOriginalContext: HTMLCanvasElement.prototype.getContext,
			
			getContext: function (type) {
				if (!this.contextsList) {
					this.contextsList = {};
				}

				if (!this.contextsList[type]) {
					var ctx = HTMLCanvasElement.getContext(type);
					if (ctx) {
						ctx = new ctx(this);
					} else try {
						ctx = this.getOriginalContext.apply(this, arguments);
					} catch (e) {
						throw (!e.toString().match(/NS_ERROR_ILLEGAL_VALUE/)) ? e :
							new TypeError('Wrong Context Type: «' + type + '»');
					}
					this.contextsList[type] = ctx;
				}
				return this.contextsList[type];
			}
		});

	

	new function () {

		var toPoint = Point.from, toRectangle = Rectangle.from;

		
		LibCanvas.declare( 'LibCanvas.Context.DrawImage', {
			initialize: function (context) {
				this.context = context;
				this.ctx2d   = context.ctx2d;
			},

			drawImage: function (args) {
				var a, center, from, draw, crop, scale, image, pivot, angle;

				if (this.checkNonObject(args)) return;

				a = args[0];

				image  = a.image;
				angle  = a.angle;
				scale  = a.scale  && toPoint(a.scale);
				center = a.center && toPoint(a.center);
				from   = a.from   && toPoint(a.from);
				draw   = a.draw   && toRectangle(a.draw);
				crop   = a.crop   && toRectangle(a.crop);

				if (! atom.dom.isElement(image) ) throw new TypeError('Wrong image in Context.DrawImage');
				if (! (center || from || draw)  ) throw new TypeError('Wrong arguments in Context.DrawImage');

				pivot = this.getTransformPivot(
					angle, scale, image,
					center, from, draw
				);

				if (pivot) this.transform(pivot, angle, scale);
				draw ?
					this.drawRect (image, draw, crop  , a.optimize) :
					this.drawPoint(image, from, center, a.optimize);
				if (pivot) this.ctx2d.restore();

				return this.context;
			},


			run: function (array) {
				this.ctx2d.drawImage.apply( this.ctx2d, array );
			},

			transform: function (center, angle, scale) {
				this.ctx2d.save();
				if (angle) this.context.rotate(angle, center);
				if (scale) this.context.scale (scale, center);
			},

			checkNonObject: function (args) {
				var image = args[0], length = args.length, target;
				if (length > 2) {
					this.run(args);
					return true;
				}
				if (length == 2) {
					target = args[1];

					if (target instanceof Point) {
						this.drawPoint(image, target);
						return true;
					}
					if (target instanceof Rectangle) {
						this.drawRect(image, target);
						return true;
					}

					throw new Error('Unknown second argument in Context.DrawImage');
				}

				if (length == 0) {
					throw new Error('Empty arguments in Context.DrawImage');
				}

				if (atom.dom.isElement(image)) {
					this.ctx2d.drawImage(image, 0, 0);
					return true;
				}

				return false;
			},

			drawPoint: function (image, from, center, optimize) {
				var
					point = center || from,
					fromX = point.x,
					fromY = point.y;

				if (center) {
					fromX -= image.width  / 2;
					fromY -= image.height / 2;
				}

				if (optimize) {
					fromX = Math.round(fromX);
					fromY = Math.round(fromY);
				}

				this.ctx2d.drawImage(image, fromX, fromY);
			},

			drawRect: function (image, rect, crop, optimize) {
				var deltaX, deltaY, fromX, fromY;

				if (crop) {
					this.ctx2d.drawImage( image,
						crop.from.x, crop.from.y, crop.width, crop.height,
						rect.from.x, rect.from.y, rect.width, rect.height
					);
					return;
				}

				if (optimize) {
					fromX  = Math.round(rect.from.x);
					fromY  = Math.round(rect.from.y);
					deltaX = Math.abs(rect.width  - image.width );
					deltaY = Math.abs(rect.height - image.width );

					if (deltaX < 1.1 && deltaY < 1.1) {
						this.ctx2d.drawImage(image, fromX, fromY);
					} else {
						this.ctx2d.drawImage(image, fromX, fromY,
							Math.round(rect.width),
							Math.round(rect.height)
						);
					}
					return;
				}

				this.ctx2d.drawImage( image,
					rect.from.x, rect.from.y,
					rect.width , rect.height
				);
			},

			getTransformPivot: function (angle, scale, image, center, from, draw) {
				if ( !angle && (!scale || (scale.x == 1 && scale.y == 1)) ) return null;

				if (center) return center;
				if ( draw ) return draw.center;

				return new Point(from.x + image.width/2, from.y + image.height/2);
			}
		});

	};


	

	new function () {

		var toPoint = Point.from, toRectangle = Rectangle.from, toCircle = Circle.from;


		var addColorStopSource = document
			.createElement('canvas')
			.getContext('2d')
			.createLinearGradient(0,0,1,1)
			.addColorStop;

		var addColorStop = function (colors) {
			if (typeof colors == 'object') {
				for (var position in colors) if (colors.hasOwnProperty(position)) {
					addColorStopSource.call( this, parseFloat(position), colors[position] );
				}
			} else {
				addColorStopSource.apply( this, arguments );
			}
			return this;
		};


		var fixGradient = function (grad) {
			grad.addColorStop = addColorStop;
			return grad;
		};

		
		LibCanvas.declare( 'LibCanvas.Context.Gradients', {
			initialize: function (context) {
				this.context = context;
				this.ctx2d   = context.ctx2d;
			},

			
			createGradient: function (from, to, colors) {
				var gradient;
				if ( from instanceof Rectangle ) {
					colors   = to;
					gradient = this.createLinearGradient([ from ]);
				} else if (from instanceof Circle) {
					gradient = this.createRadialGradient([ from, to ]);
				} else if (from instanceof Point) {
					gradient = this.createLinearGradient([ from, to ]);
				} else {
					throw new Error('Unknown arguments in Context.Gradients.createGradient');
				}
				if (typeof colors == 'object') gradient.addColorStop( colors );
				return gradient;
			},
			
			createRectangleGradient: function (rectangle, colors) {
				rectangle = toRectangle( rectangle );

				var from = rectangle.from, line = new Line( rectangle.bottomLeft, rectangle.topRight );

				return this.createGradient( from, line.perpendicular(from).scale(2, from), colors );
			},
			
			createLinearGradient : function (a) {
				var from, to;
				if (a.length != 4) {
					if (a.length == 2) {
						to   = toPoint(a[0]);
						from = toPoint(a[1]);
					} else if (a.length == 1) {
						to   = toPoint(a[0].to);
						from = toPoint(a[0].from);
					} else {
						throw new TypeError('Wrong arguments.length in the Context.createLinearGradient');
					}
					a = [from.x, from.y, to.x, to.y];
				}
				return fixGradient( this.ctx2d.createLinearGradient.apply(this.ctx2d, a) );
			},
			
			createRadialGradient: function (a) {
				var points, c1, c2, length = a.length;
				if (length == 1 || length == 2) {
					if (length == 2) {
						c1 = toCircle( a[0] );
						c2 = toCircle( a[1] );
					} else {
						c1 = toCircle( a.start );
						c2 = toCircle( a.end   );
					}
					points = [c1.center.x, c1.center.y, c1.radius, c2.center.x, c2.center.y, c2.radius];
				} else if (length == 6) {
					points = a;
				} else {
					throw new TypeError('Wrong arguments.length in the Context.createRadialGradient');
				}

				return fixGradient( this.ctx2d.createRadialGradient.apply(this.ctx2d, points) );
			}
		});

	};


	

	new function () {

		var toPoint = Point.from, toCircle = Circle.from;


		
		LibCanvas.declare( 'LibCanvas.Context.Path', {
			initialize: function (context) {
				this.context = context;
				this.ctx2d   = context.ctx2d;
			},


			
			arc : function (a) {

				if (a.length > 1) {
					return this.ctx2d.arc.apply(this.ctx2d, a);
				} else if (!a[0].circle) {
					throw new TypeError('Wrong arguments in CanvasContext.arc');
				}

				var f = a[0], circle, angle, angleStart, angleEnd, angleSize;
				circle = toCircle(f.circle);
				angle = f.angle;

				if (Array.isArray(angle)) {
					angleStart = angle[0];
					angleEnd   = angle[1];
				} else {
					angleStart = angle.start;
					angleEnd   = angle.end;
					angleSize  = angle.size;

					if (angleSize == null) {
						// do nothing
					} else if (angleEnd == null) {
						angleEnd = angleSize + angleStart;
					} else if (angleStart == null) {
						angleStart = angleEnd - angleSize;
					}
				}
				this.ctx2d.arc(
					circle.center.x, circle.center.y, circle.radius,
					angleStart, angleEnd, !!(f.anticlockwise || f.acw)
				);
				return this.context;
			},

			
			arcTo : function () {
				// @todo Beauty arguments
				this.ctx2d.arcTo.apply(this.ctx2d, arguments);
				return this.context;
			},
			
			curveTo: function (a) {
				var p, l, to, curve = a[0];

				if (typeof curve == 'number') {
					if (a.length === 4) {
						return this.quadraticCurveTo(a);
					} else if (a.length === 6) {
						return this.bezierCurveTo(a);
					}
				} else if (a.length > 1) {
					p  = atom.array.from( a ).map(toPoint);
					to = p.shift()
				} else {
					p  = atom.array.from( curve.points ).map(toPoint);
					to = toPoint(curve.to);
				}

				l = p.length;

				if (l == 2) {
					this.ctx2d.bezierCurveTo(
						p[0].x, p[0].y, p[1].x, p[1].y, to.x, to.y
					);
				} else if (l == 1) {
					this.ctx2d.quadraticCurveTo(
						p[0].x, p[0].y, to.x, to.y
					);
				} else {
					this.ctx2d.lineTo(to.x, to.y);
				}
				return this.context;
			},
			
			quadraticCurveTo : function (a) {
				if (a.length == 4) {
					this.ctx2d.quadraticCurveTo.apply(this.ctx2d, a);
					return this.context;
				} else {
					a = a.length == 2 ? {p:a[0], to:a[1]} : a[0];
					return this.curveTo([{
						to: a.to,
						points: [a.p]
					}]);
				}
			},
			
			bezierCurveTo : function (a) {
				if (a.length == 6) {
					this.ctx2d.bezierCurveTo.apply(this.ctx2d, a);
					return this.context;
				} else {
					a = a.length == 3 ? {p1:a[0], p2:a[1], to:a[2]} : a[0];
					return this.curveTo([{
						to: a.to,
						points: [a.p1, a.p2]
					}]);
				}
			},
			isPointInPath: function (x, y) {
				if (y == null) {
					x = toPoint(x);
					y = x.y;
					x = x.x;
				}
				return this.ctx2d.isPointInPath(x, y);
			}

		});

	};


	

	new function () {

		var toPoint = Point.from, toRectangle = Rectangle.from, size1x1 = new Size(1,1);


		
		LibCanvas.declare( 'LibCanvas.Context.Pixels', {
			initialize: function (context) {
				this.context = context;
				this.ctx2d   = context.ctx2d;
			},

			// image data
			
			createImageData : function (w, h) {
				if (w == null) {
					w = this.context.width;
					h = this.context.height;
				} else if (h == null) {
					if (w.width == null && w.height == null) {
						throw new TypeError('Wrong argument in the Context.createImageData');
					} else {
						h = w.height;
						w = w.width;
					}
				}

				return this.ctx2d.createImageData(w, h);
			},

			
			putImageData : function (a) {
				var put = {}, args, rect;

				switch (a.length) {
					case 1: {
						if (typeof a != 'object') {
							throw new TypeError('Wrong argument in the Context.putImageData');
						}

						a = a[0];
						put.image = a.image;
						put.from = toPoint(a.from);

						if (a.crop) put.crop = toRectangle(a.crop);
					} break;

					case 3: {
						put.image = a[0];
						put.from = new Point(a[1], a[2]);
					} break;

					case 7: {
						put.image = a[0];
						put.from = new Point(a[1], a[2]);
						put.crop = new Rectangle(a[3], a[4], a[5], a[6]);
					} break;

					default : throw new TypeError('Wrong args number in the Context.putImageData');
				}

				args = [put.image, put.from.x, put.from.y];

				if (put.crop) {
					rect = put.crop;
					atom.array.append(args, [rect.from.x, rect.from.y, rect.width, rect.height])
				}

				this.ctx2d.putImageData.apply(this.ctx2d, args);
				return this.context;
			},
			
			getImageData : function (args) {
				var rect = toRectangle(args.length > 1 ? args : args[0]);

				return this.ctx2d.getImageData(rect.from.x, rect.from.y, rect.width, rect.height);
			},
			getPixels : function (args) {
				var
					rect = toRectangle(args.length > 1 ? args : args[0]),
					data = this.getImageData(rect).data,
					result = [],
					line = [];
				for (var i = 0, L = data.length; i < L; i+=4)  {
					line.push({
						r : data[i],
						g : data[i+1],
						b : data[i+2],
						a : data[i+3] / 255
					});
					if (line.length == rect.width) {
						result.push(line);
						line = [];
					}
				}
				return result;
			},

			getPixel: function (point) {
				var
					rect = new Rectangle(toPoint( point ), size1x1),
					data = slice.call(this.getImageData([rect]).data);

				data[3] /= 255;

				return new atom.Color(data);
			}

		});

	};


	

	new function () {

		var toPoint = Point.from, toRectangle = Rectangle.from, size1x1 = new Size(1,1);


		
		LibCanvas.declare( 'LibCanvas.Context.Text', {
			initialize: function (context) {
				this.context = context;
				this.ctx2d   = context.ctx2d;
			},
			// text
			
			method: function (method, text, x, y, maxWidth) {
				var type = typeof x;
				if (type != 'number' && type != 'string') {
					maxWidth = y;
					x = toPoint( x );
					y = x.y;
					x = x.x;
				}
				var args = [text, x, y];
				if (maxWidth) args.push( maxWidth );
				this.ctx2d[method].apply( this.ctx2d, args );
				return this.context;
			},
			fillText : function (text, x, y, maxWidth) {
				return this.method(  'fillText', text, x, y, maxWidth);
			},
			strokeText : function (text, x, y, maxWidth) {
				return this.method('strokeText', text, x, y, maxWidth);
			},
			
			measureText : function (args) {
				return this.ctx2d.measureText.call(this.ctx2d, args)
			},
			
			text : function (cfg) {
				if (!this.ctx2d.fillText) return this;

				var ctx = this.ctx2d;

				cfg = atom.core.append({
					text   : '',
					color  : null, 
					wrap   : 'normal', 
					to     : null,
					align  : 'left', 
					size   : 16,
					weight : 'normal', 
					style  : 'normal', 
					family : 'arial,sans-serif', 
					lineHeight : null,
					overflow   : 'visible', 
					padding : [0,0],
					shadow : null
				}, cfg);

				ctx.save();
				if (typeof cfg.padding == 'number') {
					cfg.padding = [cfg.padding, cfg.padding];
				}
				var to = cfg.to ? toRectangle(cfg.to) : this.context.rectangle;
				var lh = Math.round(cfg.lineHeight || (cfg.size * 1.15));
				this.context.set('font', atom.string.substitute(
					'{style}{weight}{size}px {family}', {
						style  : cfg.style == 'italic' ? 'italic ' : '',
						weight : cfg.weight == 'bold'  ? 'bold '   : '',
						size   : cfg.size,
						family : cfg.family
					})
				);
				if (cfg.shadow) this.context.shadow = cfg.shadow;
				if (cfg.color) this.context.set({ fillStyle: cfg.color });
				if (cfg.overflow == 'hidden') this.context.clip(to);

				function xGet (lineWidth) {
					var al = cfg.align, pad = cfg.padding[1];
					return Math.round(
						al == 'left'  ? to.from.x + pad :
							al == 'right' ? to.to.x - lineWidth - pad :
								to.from.x + (to.width - lineWidth)/2
					);
				}
				function measure (text) {
					return Number(ctx.measureText(text).width);
				}
				var lines = String(cfg.text).split('\n');

				if (cfg.wrap == 'no') {
					lines.forEach(function (line, i) {
						if (!line) return;

						ctx.fillText(line, xGet(cfg.align == 'left' ? 0 : measure(line)), to.from.y + (i+1)*lh);
					});
				} else {
					var lNum = 0;
					lines.forEach(function (line) {
						if (!line) {
							lNum++;
							return;
						}

						var words = (line || ' ').match(/.+?(\s|$)/g);
						if (!words) {
							lNum++;
							return;
						}
						var L  = '';
						var Lw = 0;
						for (var i = 0; i <= words.length; i++) {
							var last = i == words.length;
							if (!last) {
								var text = words[i];
								// @todo too slow. 2-4ms for 50words
								var wordWidth = measure(text);
								if (!Lw || Lw + wordWidth < to.width) {
									Lw += wordWidth;
									L  += text;
									continue;
								}
							}
							if (Lw) {
								ctx.fillText(L, xGet(Lw), to.from.y + (++lNum)*lh + cfg.padding[0]);
								if (last) {
									L  = '';
									Lw = 0;
								} else {
									L  = text;
									Lw = wordWidth;
								}
							}
						}
						if (Lw) ctx.fillText(L, xGet(Lw), to.from.y + (++lNum)*lh + cfg.padding[0]);
					});

				}
				ctx.restore();
				return this.context;
			}

		});

	};


	

	
	var Context2D = function () {

		var office = {
			all : function (type, style) {
				this.save();
				if (style) this.set(type + 'Style', style);
				this[type + 'Rect'](this.rectangle);
				this.restore();
				return this;
			},
			rect : function (func, args) {
				var rect = office.makeRect.call(this, args);
				return this.original(func,
					[rect.from.x, rect.from.y, rect.width, rect.height]);
			},
			makeRect: function (args) {
				return args.length ? Rectangle(args) : this.rectangle;
			},
			fillStroke : function (type, args) {
				if (args.length >= 1 && args[0] instanceof Shape) {
					if (args[1]) this.save().set(type + 'Style', args[1]);
					args[0].draw(this, type);
					if (args[1]) this.restore();
				} else {
					if (args.length && args[0]) this.save().set(type + 'Style', args[0]);
					this.original(type);
					if (args.length && args[0]) this.restore();
				}

				return this;
			},
			originalPoint : function (func, args) {
				var point = Point(args);
				return this.original(func, [point.x, point.y]);
			}
		};

		
		var shadowBug = function () {
			// todo: use LibCanvas.buffer
			var ctx = atom.dom
				.create('canvas', { width: 15, height: 15 })
				.first.getContext( '2d' );

			ctx.shadowBlur    = 1;
			ctx.shadowOffsetX = 0;
			ctx.shadowOffsetY = -5;
			ctx.shadowColor   = 'green';

			ctx.fillRect( 0, 5, 5, 5 );

			// Color should contains green component to be correct (128 is correct value)
			return ctx.getImageData(0, 0, 1, 1).data[1] < 64;

		}();

		var constants =
		
		{
			COMPOSITE: {
				SOURCE_OVER: 'source-over',
				SOURCE_IN  : 'source-in',
				SOURCE_OUT : 'source-out',
				SOURCE_ATOP: 'source-atop',

				DESTINATION_OVER: 'destination-over',
				DESTINATION_IN  : 'destination-in',
				DESTINATION_OUT : 'destination-out',
				DESTINATION_ATOP: 'destination-atop',

				LIGHTER: 'lighter',
				DARKER : 'darker',
				COPY   : 'copy',
				XOR    : 'xor'
			},

			LINE_CAP: {
				BUTT  : 'butt',
				ROUND : 'round',
				SQUARE: 'square'
			},

			LINE_JOIN: {
				ROUND: 'round',
				BEVEL: 'bevel',
				MITER: 'miter'
			},

			TEXT_ALIGN: {
				LEFT  : 'left',
				RIGHT : 'right',
				CENTER: 'center',
				START : 'start',
				END   : 'end'
			},

			TEXT_BASELINE: {
				TOP        : 'top',
				HANGING    : 'hanging',
				MIDDLE     : 'middle',
				ALPHABETIC : 'alphabetic',
				IDEOGRAPHIC: 'ideographic',
				BOTTOM     : 'bottom'
			},

			SHADOW_BUG: shadowBug

		};

		var Context2D = LibCanvas.declare( 'LibCanvas.Context2D', 'Context2D',
			
			{
				initialize : function (canvas) {
					if (canvas instanceof CanvasRenderingContext2D) {
						this.ctx2d  = canvas;
						this.canvas = this.ctx2d.canvas;
					} else {
						this.canvas = canvas;
						this.ctx2d  = atom.core.isFunction(canvas.getOriginalContext) ?
							canvas.getOriginalContext('2d') :
							canvas.getContext('2d');
					}

					this.helpers = {
						image    : new LibCanvas.Context.DrawImage(this),
						gradients: new LibCanvas.Context.Gradients(this),
						pixels   : new LibCanvas.Context.Pixels   (this),
						text     : new LibCanvas.Context.Text     (this),
						path     : new LibCanvas.Context.Path     (this)
					};
				},
				get width () { return this.canvas.width; },
				get height() { return this.canvas.height; },
				set width (width)  { this.canvas.width  = width; },
				set height(height) { this.canvas.height = height;},

				get size () {
					return new Size(this.width, this.height);
				},
				set size (size) {
					size = Size.from(size);
					this.width  = size.width;
					this.height = size.height;
				},


				get shadow () {
					return [this.shadowOffsetX, this.shadowOffsetY, this.shadowBlur, this.shadowColor].join( ' ' );
				},

				set shadow (value) {
					value = value.split( ' ' );
					this.shadowOffsetX = value[0];
					this.shadowOffsetY = value[1];
					this.shadowBlur    = value[2];
					this.shadowColor   = value[3];
				},


				safeSet: function (property, value) {
					try {
						this.ctx2d[property] = value;
					} catch (e) {
						throw TypeError('Exception while setting «' + property + '» to «' + value + '»: ' + e.message);
					}
				},

				set shadowOffsetY (value) {
					if (shadowBug) value *= -1;
					this.safeSet('shadowOffsetY', value);
				},

				set shadowBlur (value) {
					if (shadowBug && value < 1) value = 1;
					this.safeSet('shadowBlur', value);
				},

				get shadowOffsetY () {
					return this.ctx2d.shadowOffsetY;
				},

				get shadowBlur () {
					return this.ctx2d.shadowBlur;
				},

				get opacity () {
					return this.globalAlpha;
				},

				set opacity (value) {
					this.globalAlpha = value;
				},

				_rectangle: null,
				
				get rectangle () {
					var rect = this._rectangle;
					if (!rect) {
						this._rectangle = rect = new Rectangle(0, 0, this.width, this.height)
					} else {
						rect.size = this;
					}
					return rect;
				},
				
				original : function (method, args, returnResult) {
					var result = this.ctx2d[method].apply(this.ctx2d, args || []);
					return returnResult ? result: this;
				},
				
				getClone : function (width, height) {
					var resize = !!(width || height), canvas = this.canvas;
					width  = width  || canvas.width;
					height = height || canvas.height;

					var args = [canvas, 0, 0];
					if (resize) args.push(width, height);

					var clone = LibCanvas.buffer(width, height, true);
					clone.ctx.original('drawImage', args);
					return clone;
				},

				// Values
				
				set : function (name, value) {
					if (typeof name == 'object') {
						for (var i in name) this[i] = name[i];
					} else this[name] = value;
					return this;
				},
				
				get : function (name) {
					return this[name];
				},

				// All
				
				fillAll : function (style) {
					return office.all.call(this, 'fill', style);
				},
				
				strokeAll : function (style) {
					return office.all.call(this, 'stroke', style);
				},
				
				clearAll : function () {
					return this.ctx2d.clearRect(0,0,this.canvas.width,this.canvas.height);
				},

				// Save/Restore
				
				save : function () {
					this.ctx2d.save();
					return this;
				},
				
				restore : function () {
					this.ctx2d.restore();
					return this;
				},

				// Fill/Stroke
				
				fill : function (shape) {
					return office.fillStroke.call(this, 'fill', arguments);
				},
				
				stroke : function (shape) {
					return office.fillStroke.call(this, 'stroke', arguments);
				},
				
				clear: function (shape, stroke) {
					return shape instanceof Shape && shape.constructor != Rectangle ?
						this
							.save()
							.set({ globalCompositeOperation: Context2D.COMPOSITE.DESTINATION_OUT })
							[stroke ? 'stroke' : 'fill']( shape )
							.restore() :
						this.clearRect( Rectangle.from(shape) );
				},

				// Path
				
				beginPath : function (moveTo) {
					var ret = this.original('beginPath');
					arguments.length && this.moveTo.apply(this, arguments);
					return ret;
				},
				
				closePath : function () {
					arguments.length && this.lineTo.apply(this, arguments);
					return this.original('closePath');
				},
				
				moveTo : function (point) {
					return office.originalPoint.call(this, 'moveTo', arguments);
				},
				
				lineTo : function (point) {
					return office.originalPoint.call(this, 'lineTo', arguments);
				},
				
				arc : function (x, y, r, startAngle, endAngle, anticlockwise) {
					return this.helpers.path.arc(arguments);
				},
				
				arcTo : function () {
					return this.helpers.path.arcTo(arguments);
				},
				
				curveTo: function (curve) {
					return this.helpers.path.curveTo(arguments);
				},
				
				quadraticCurveTo : function () {
					return this.helpers.path.quadraticCurveTo(arguments);
				},
				
				bezierCurveTo : function () {
					return this.helpers.path.bezierCurveTo(arguments);
				},
				
				isPointInPath : function (x, y) {
					return this.helpers.path.isPointInPath(x, y);
				},
				
				clip : function (shape) {
					if (shape && typeof shape.processPath == 'function') {
						shape.processPath(this);
					}
					return this.original('clip');
				},

				// transformation
				
				rotate : function (angle, pivot) {
					if (angle) {
						if (pivot) this.translate(pivot);
						this.original('rotate', [angle]);
						if (pivot) this.translate(pivot, true);
					}
					return this;
				},
				
				translate : function (point, reverse) {
					point = Point(
						(arguments.length === 1 || typeof reverse === 'boolean')
							? point : arguments
					);
					var multi = reverse === true ? -1 : 1;
					this.original('translate', [point.x * multi, point.y * multi]);
					return this;
				},
				
				scale : function (power, pivot) {
					if (typeof pivot == 'number') {
						power = new Point(power, pivot);
						pivot = null;
					} else {
						power = Point(power);
					}
					if (power.x != 1 || power.y != 1) {
						if (pivot) this.translate(pivot);
						this.original('scale', [power.x, power.y]);
						if (pivot) this.translate(pivot, true);
					}
					return this;
				},
				
				transform : function () {
					// @todo Beauty arguments
					return this.original('transform', arguments);
				},
				
				setTransform : function () {
					// @todo Beauty arguments
					return this.original('setTransform', arguments);
				},

				// Rectangle
				
				fillRect : function (rectangle) {
					return office.rect.call(this, 'fillRect', arguments);
				},
				
				strokeRect : function (rectangle) {
					return office.rect.call(this, 'strokeRect', arguments);
				},
				
				clearRect : function (rectangle) {
					return office.rect.call(this, 'clearRect', arguments);
				},

				// === helpers.text === //

				
				fillText : function (text, x, y, maxWidth) {
					return this.helpers.text.fillText(text, x, y, maxWidth);
				},
				
				strokeText : function (text, x, y, maxWidth) {
					return this.helpers.text.strokeText(text, x, y, maxWidth);
				},
				
				measureText : function (textToMeasure) {
					return this.helpers.text.measureText(arguments);
				},
				
				text : function (cfg) {
					return this.helpers.text.text(cfg);
				},

				// === helpers.drawImage === //

				
				drawImage : function () {
					return this.helpers.image.drawImage(arguments);
				},

				// === helpers.pixels === //

				
				createImageData : function (w, h) {
					return this.helpers.pixels.createImageData(w, h);
				},
				
				putImageData : function () {
					return this.helpers.pixels.putImageData(arguments);
				},
				
				getImageData : function (rectangle) {
					return this.helpers.pixels.getImageData(arguments);
				},
				getPixels : function (rectangle) {
					return this.helpers.pixels.getPixels(arguments);
				},
				getPixel: function (point) {
					return this.helpers.pixels.getPixel(point);
				},

				// === helpers.gradients === //

				
				createGradient: function (from, to, colors) {
					return this.helpers.gradients.createGradient(from, to, colors);
				},
				
				createRectangleGradient: function (rectangle, colors) {
					return this.helpers.gradients.createRectangleGradient(rectangle, colors);
				},
				
				createLinearGradient : function () {
					return this.helpers.gradients.createLinearGradient(arguments);
				},
				
				createRadialGradient: function () {
					return this.helpers.gradients.createRadialGradient(arguments);
				},

				// === etc === //

				
				createPattern : function () {
					return this.original('createPattern', arguments, true);
				},

				drawWindow : function () {
					return this.original('drawWindow', arguments);
				}

			}).own(constants);


		[ 'fillStyle','font','globalAlpha','globalCompositeOperation','lineCap',
			'lineJoin','lineWidth','miterLimit','shadowOffsetX','shadowColor',
			'strokeStyle','textAlign','textBaseline'
			// we'll set this values manually because of bug in Mobile Phones
			// 'shadowOffsetY','shadowBlur'
		].forEach(function (property) {
				atom.accessors.define(Context2D.prototype, property, {
					set: function (value) {
						this.safeSet(property, value);
					},
					get: function () {
						return this.ctx2d[property];
					}
				})
			});

		Context2D.office = office;

		if (atom.core.isFunction(HTMLCanvasElement.addContext)) {
			HTMLCanvasElement.addContext('2d-libcanvas', Context2D);
		}

		return Context2D;

	}();


	

	
	var Point3D = LibCanvas.declare( 'LibCanvas.Point3D', 'Point3D', Geometry, {
		x: 0,
		y: 0,
		z: 0,


		coordinatesArray: ['x', 'y', 'z'],

		
		set: function (x, y, z) {
			if ( arguments.length > 1 ) {
				this.x = Number(x) || 0;
				this.y = Number(y) || 0;
				this.z = Number(z) || 0;
			} else if ( x && typeof x.x  === 'number' ) {
				this.set( x.x, x.y, x.z );
			} else if ( x && typeof x[0] === 'number' ) {
				this.set( x[0], x[1], x[2] );
			} else {
				throw new Error( 'Wrong arguments in Isometric.Point3D' );
			}
			return this;
		},

		
		map: function (fn, context) {
			var point = this;
			point.coordinatesArray.forEach(function (axis) {
				point[axis] = fn.call( context || point, point[axis], axis, point );
			});
			return this;
		},

		
		add: function (factor) {
			return this.map(function (c) { return c+factor });
		},

		
		mul: function (factor) {
			return this.map(function (c) { return c*factor });
		},

		
		diff: function (point3d) {
			point3d = this.cast( point3d );
			return new this.constructor(
				point3d.x - this.x,
				point3d.y - this.y,
				point3d.z - this.z
			);
		},

		
		move: function (point3d) {
			point3d = this.cast( arguments );
			this.x += point3d.x;
			this.y += point3d.y;
			this.z += point3d.z;
			return this;
		},

		
		equals: function (point3d, accuracy) {
			return point3d.x.equals( this.x, accuracy ) &&
				point3d.y.equals( this.y, accuracy ) &&
				point3d.z.equals( this.z, accuracy );
		},

		
		clone: function () {
			return new this.constructor( this );
		},

		
		toArray: function () {
			return [this.x, this.y, this.z];
		},

		
		dump: function () {
			return '[LibCanvas.Point3D(' + this.toArray() + ')]';
		}
	});

	

	new function () {

		var object = {
				initialize: function (canvas) {
					if (canvas instanceof CanvasRenderingContext2D) {
						this.ctx2d  = canvas;
						this.canvas = this.ctx2d.canvas;
					} else {
						this.canvas = canvas;
						this.ctx2d  = canvas.getOriginalContext('2d');
					}
				},
				get width () { return this.canvas.width  },
				get height() { return this.canvas.height  },
				set width (width)  { this.canvas.width  = width  },
				set height(height) { this.canvas.height = height }
			},

			methods = (
				'arc arcTo beginPath bezierCurveTo clearRect clip ' +
					'closePath drawImage fill fillRect fillText lineTo moveTo ' +
					'quadraticCurveTo rect restore rotate save scale setTransform ' +
					'stroke strokeRect strokeText transform translate'
				).split(' '),

			getterMethods = (
				'createPattern drawFocusRing isPointInPath measureText ' +
					'createImageData createLinearGradient ' +
					'createRadialGradient getImageData putImageData'
				).split(' '),

			properties = (
				'fillStyle font globalAlpha globalCompositeOperation lineCap ' +
					'lineJoin lineWidth miterLimit shadowOffsetX shadowOffsetY ' +
					'shadowBlur shadowColor strokeStyle textAlign textBaseline'
				).split(' ');

		properties.forEach(function (property) {
			atom.accessors.define(object, property, {
				set: function (value) {
					try {
						this.ctx2d[property] = value;
					} catch (e) {
						throw TypeError('Exception while setting «' + property + '» to «' + value + '»: ' + e.message);
					}
				},
				get: function () {
					return this.ctx2d[property];
				}
			})
		});

		methods.forEach(function (method) {
			object[method] = function () {
				this.ctx2d[method].apply(this.ctx, arguments);
				return this;
			};
		});

		getterMethods.forEach(function (method) {
			object[method] = function () {
				return this.ctx2d[method].apply(this.ctx, arguments);
			};
		});

		atom.declare( 'LibCanvas.Canvas2DContext', object );

	};

	

	new function () {

// The following text contains bad code and due to it's code it should not be readed by ANYONE!

		var
			Transition = atom.Transition,
			Color = atom.Color,
			EC = {};

		
		EC.getColor = function (color) {
			return new Color(color || [0,0,0,1]);
		};

		EC.getPoints = function (prevPos, pos, width, inverted) {
			var
				w    = pos.x-prevPos.x,
				h    = pos.y-prevPos.y,
				dist = atom.math.hypotenuse(w, h),

				sin = h / dist,
				cos = w / dist,

				dx = sin * width,
				dy = cos * width;

			return [
				new Point(pos.x + dx, pos.y + dy*inverted),
				new Point(pos.x - dx, pos.y - dy*inverted)
			];
		};

		EC.getGradientFunction = function (attr) {
			switch (typeof attr.gradient) {
				case 'undefined' :
					return atom.fn.lambda( EC.getColor(attr.color) );

				case 'function' :
					return attr.gradient;

				default :
					var gradient = { fn: attr.gradient.fn || 'linear' };

					if (typeof gradient.fn != 'string') {
						throw new Error('LibCanvas.Context2D.drawCurve -- unexpected type of gradient function');
					}

					gradient.from = EC.getColor(attr.gradient.from);
					gradient.to   = EC.getColor(attr.gradient.to  );

					var diff = gradient.from.diff( gradient.to );

					return function (t) {
						var factor = Transition.get(gradient.fn)(t);
						return gradient.from.shift( diff.clone().mul(factor) ).toString();
					};
			}
		};

		EC.getWidthFunction = function (attr) {
			attr.width = attr.width || 1;
			switch (typeof attr.width) {
				case 'number'  : return atom.fn.lambda(attr.width);
				case 'function': return attr.width;
				case 'object'  : return EC.getWidthFunction.range( attr.width );
				default: throw new TypeError('LibCanvas.Context2D.drawCurve -- unexpected type of width');
			}
		};

		EC.getWidthFunction.range = function (width) {
			if(!width.from || !width.to){
				throw new Error('LibCanvas.Context2D.drawCurve -- width.from or width.to undefined');
			}
			var diff = width.to - width.from;
			return function(t){
				return width.from + diff * Transition.get(width.fn || 'linear')(t);
			}
		};

		EC.curvesFunctions = [
			function (p, t) { // linear
				return {
					x:p[0].x + (p[1].x - p[0].x) * t,
					y:p[0].y + (p[1].y - p[0].y) * t
				};
			},
			function (p,t) { // quadratic
				var i = 1-t;
				return {
					x:i*i*p[0].x + 2*t*i*p[1].x + t*t*p[2].x,
					y:i*i*p[0].y + 2*t*i*p[1].y + t*t*p[2].y
				};
			},
			function (p, t) { // qubic
				var i = 1-t;
				return {
					x:i*i*i*p[0].x + 3*t*i*i*p[1].x + 3*t*t*i*p[2].x + t*t*t*p[3].x,
					y:i*i*i*p[0].y + 3*t*i*i*p[1].y + 3*t*t*i*p[2].y + t*t*t*p[3].y
				};
			}
		];

		Context2D.prototype.drawCurve = function (obj) {
			var points = atom.array.append( [Point(obj.from)], obj.points.map(Point), [Point(obj.to)] );

			var gradientFunction = EC.getGradientFunction(obj),             //Getting gradient function
				widthFunction    = EC.getWidthFunction(obj),                //Getting width function
				curveFunction    = EC.curvesFunctions[ obj.points.length ]; //Getting curve function

			if (!curveFunction) throw new Error('LibCanvas.Context2D.drawCurve -- unexpected number of points');

			var step = obj.step || 0.02;

			var invertedMultipler = obj.inverted ? 1 : -1;

			var controlPoint, prevContorolPoint,
				drawPoints  , prevDrawPoints   ,
				width , color, prevColor, style;

			prevContorolPoint = curveFunction(points, -step);

			for (var t=-step ; t<1.02 ; t += step) {
				controlPoint = curveFunction(points, t);
				color = gradientFunction(t);
				width = widthFunction(t) / 2;

				drawPoints = EC.getPoints(prevContorolPoint, controlPoint, width, invertedMultipler);

				if (t >= step) {
					// #todo: reduce is part of array, not color
					var diff = EC.getColor(prevColor).diff(color);

					if ( (diff.red + diff.green + diff.blue) > 150 ) {
						style = this.createLinearGradient(prevContorolPoint, controlPoint);
						style.addColorStop(0, prevColor);
						style.addColorStop(1,     color);
					} else {
						style = color;
					}

					this
						.set("lineWidth",1)
						.beginPath(prevDrawPoints[0])
						.lineTo   (prevDrawPoints[1])
						.lineTo   (drawPoints[1])
						.lineTo   (drawPoints[0])
						.fill  (style)
						.stroke(style);
				}
				prevDrawPoints    = drawPoints;
				prevContorolPoint = controlPoint;
				prevColor         = color;
			}
			return this;
		};

	};

	

	var UtilsImage = atom.declare( 'LibCanvas.Utils.Image', {
		canvasCache: null,

		initialize: function (image) {
			this.image = image;
			this.cache = {};
		},

		
		createSprite: function (rect) {
			var image, buf, xShift, yShift, x, y, xMax, yMax, crop, size, current, from, to;

			if (rect.width <= 0 || rect.height <= 0) {
				throw new TypeError('Wrong rectangle size');
			}

			image = this.image;
			buf = LibCanvas.buffer(rect.width, rect.height, true);

			// если координаты выходят за левый/верхний край картинки
			if (rect.from.x < 0) xShift = Math.ceil(Math.abs(rect.from.x) / rect.width );
			if (rect.from.y < 0) yShift = Math.ceil(Math.abs(rect.from.y) / rect.height);
			if (xShift || yShift) {
				rect = rect.clone().move(new Point(
					xShift * image.width,
					yShift * image.height
				));
			}

			// для того, чтобы была возможность указывать ректангл, выходящий
			// за пределы картинки. текущая картинка повторяется как паттерн
			xMax = Math.ceil(rect.to.x / image.width );
			yMax = Math.ceil(rect.to.y / image.height);
			for (y = yMax; y-- > 0;) for (x = xMax; x-- > 0;) {
				current = new Point(x * image.width, y * image.height);
				from = current.clone();
				to   = from.clone().move([image.width, image.height]);

				if (from.x < rect.from.x) from.x = rect.from.x;
				if (from.y < rect.from.y) from.y = rect.from.y;
				if (  to.x > rect. to .x)   to.x = rect. to .x;
				if (  to.y > rect. to .y)   to.y = rect. to .y;

				crop = new Rectangle(from, to);
				size = crop.size;
				crop.from.x %= image.width;
				crop.from.y %= image.height;
				crop.size    = size;

				if (x) current.x -= rect.from.x;
				if (y) current.y -= rect.from.y;

				if (size.width && size.height) buf.ctx.drawImage({
					image : image,
					crop  : crop,
					draw  : new Rectangle( current, size )
				});
			}

			return buf;
		},

		toCanvas: function () {
			var cache = this.canvasCache;

			if (!cache) {
				cache = this.canvasCache = LibCanvas.buffer(this, true);
				cache.ctx.drawImage(this);
			}
			return cache;
		},

		isLoaded: function () {
			return this.constructor.isLoaded( this.image );
		},

		sprite: function () {
			if (!this.isLoaded()) throw new Error('Not loaded in Image.sprite, logged');

			if (arguments.length) {
				var
					rect  = Rectangle(arguments),
					index = rect.dump(),
					cache = this.cache[index];

				if (!cache) {
					cache = this.cache[index] = this.createSprite(rect);
				}
				return cache;
			} else {
				return this.toCanvas();
			}
		}
	});

	UtilsImage.own({
		isLoaded : function (image) {
			return image.complete && ( (image.naturalWidth == null) || !!image.naturalWidth );
		},

		sprite: function (image, rectangle) {
			return this.mix(image).sprite(rectangle);
		},

		toCanvas: function (image) {
			return this.mix(image).toCanvas();
		},

		mix: function (image) {
			var key = 'libcanvas.image';

			if (!image[key]) {
				image[key] = new this(image);
			}

			return image[key];
		}
	});

	

	
	var ImageBuilder = LibCanvas.declare(
		'LibCanvas.Plugins.ImageBuilder', 'ImageBuilder', {
			ctx     : null,
			shape   : null,
			images  : [
				0, 1, 2,
				3, 4, 5,
				6, 7, 8
			],

			
			initialize: function (data) {
				this.cropImage( data );
			},


			renderSingle: function (image, xDir, yDir) {
				if (image != null) this.ctx.drawImage({
					image: image,
					from: this.countShape( xDir, yDir ).from
				});

				return this;
			},

			renderRepeated: function (image, xDir, yDir) {
				if (image != null) {
					var pattern = this.ctx.createPattern( image, 'repeat' );

					var shape = this.countShape(xDir, yDir);
					this.ctx
						.translate(shape.from)
						.fill( new Rectangle(new Point(0,0), shape.size), pattern)
						.translate(shape.from, true);
				}
				return this;
			},

			countShape: function (xDir, yDir) {
				var
					size = this.shape.size,
					from = new Point(0,0),
					to   = new Point(0,0);

				from.x = xDir == 'left'   ? 0 :
					this.countBasis( xDir == 'center' ? 'left' : 'right' );

				from.y = yDir == 'top'    ? 0 :
					this.countBasis( yDir == 'middle' ? 'top' : 'bottom' );

				to.x   = xDir == 'right'  ? size.width  :
					this.countBasis( xDir == 'center' ? 'right' : 'left' );

				to.y   = yDir == 'bottom' ? size.height :
					this.countBasis( yDir == 'middle' ? 'bottom' : 'top' );

				return new Rectangle( from, to ).move( this.shape );
			},

			countBasis: function (basis) {
				var images = this.images, size = this.shape.size;

				switch (basis) {
					case 'left'  : return               images[0].width;
					case 'right' : return size.width  - images[2].width;
					case 'top'   : return               images[0].height;
					case 'bottom': return size.height - images[6].height;
					default: throw new TypeError('Wrong basis: ' + basis);
				}
			},

			renderParts: function () {
				var images = this.images;
				this
					.renderRepeated( images[1], 'center', 'top'    )
					.renderRepeated( images[3], 'left'  , 'middle' )
					.renderRepeated( images[4], 'center', 'middle' )
					.renderRepeated( images[5], 'right' , 'middle' )
					.renderRepeated( images[7], 'center', 'bottom' )
					.renderSingle  ( images[0], 'left'  , 'top'    )
					.renderSingle  ( images[2], 'right' , 'top'    )
					.renderSingle  ( images[6], 'left'  , 'bottom' )
					.renderSingle  ( images[8], 'right' , 'bottom' );
			},

			cropImage: function (data) {
				var w, h, x, y, width, height,
					images  = [],
					widths  = data.widths,
					heights = data.heights;

				for (y = 0, h = 0; h < heights.length; h++) {
					height = heights[h];
					for (x = 0, w = 0; w < widths.length; w++) {
						width = widths[w];

						images.push(this.createCroppedImage( data.source,
							new Rectangle(x,y,width,height)
						));

						x += width;
					}
					y += height;
				}

				this.images = images;
			},

			createCroppedImage: function (source, shape) {
				var buffer = LibCanvas.buffer( shape.size, true );

				buffer.ctx.drawImage({
					image: source,
					draw : buffer.ctx.rectangle,
					crop : shape
				});

				return buffer;
			},

			renderTo: function (ctx, shape) {
				this.ctx   = ctx;
				this.shape = shape;
				this.renderParts();
			}
		}
	);

	
	atom.declare( 'LibCanvas.Plugins.ImageBuilder.Horisontal', ImageBuilder, {
		images: [ 0, 1, 2 ],

		countBasis: function (basis) {
			var images = this.images, size = this.shape.size;

			switch (basis) {
				case 'left'  : return images[0].width;
				case 'right' : return size.width  - images[2].width;
				case 'top'   : return 0;
				case 'bottom': return size.height;
				default: throw new TypeError('Wrong basis: ' + basis);
			}
		},

		renderParts: function () {
			var images = this.images;
			this
				.renderRepeated( images[1], 'center', 'middle' )
				.renderSingle  ( images[0], 'left'  , 'middle' )
				.renderSingle  ( images[2], 'right' , 'middle' );
		},

		cropImage: function (data) {
			var w, x, width,
				images  = [],
				widths  = data.widths;

			this.height = data.source.height;

			for (x = 0, w = 0; w < widths.length; w++) {
				width = widths[w];

				images.push(this.createCroppedImage( data.source,
					new Rectangle(x,0,width,this.height)
				));

				x += width;
			}

			this.images = images;
		}
	});

	
	atom.declare( 'LibCanvas.Plugins.ImageBuilder.Vertical', ImageBuilder, {
		images: [ 0, 1, 2 ],

		countBasis: function (basis) {
			var images = this.images, size = this.shape.size;

			switch (basis) {
				case 'left'  : return 0;
				case 'right' : return size.width;
				case 'top'   : return images[0].height;
				case 'bottom': return size.height - images[2].height;
				default: throw new TypeError('Wrong basis: ' + basis);
			}
		},

		renderParts: function () {
			var images = this.images;
			this
				.renderRepeated( images[1], 'center', 'middle' )
				.renderSingle  ( images[0], 'center', 'top'    )
				.renderSingle  ( images[2], 'center', 'bottom' );
		},

		cropImage: function (data) {
			var h, y, height,
				images  = [],
				heights = data.heights;

			this.width = data.source.width;

			for (y = 0, h = 0; h < heights.length; h++) {
				height = heights[h];

				images.push(this.createCroppedImage( data.source,
					new Rectangle(0,y,this.width,height)
				));

				y += height;
			}

			this.images = images;
		}
	});

	

// <image> tag
	atom.core.append(HTMLImageElement.prototype, {
		createSprite: function (rect) {
			return UtilsImage.mix(this).createSprite(rect);
		},
		toCanvas: function () {
			return UtilsImage.mix(this).toCanvas();
		},
		sprite : function () {
			var utils = UtilsImage.mix(this);

			return utils.sprite.apply( utils, arguments );
		},
		isLoaded : function () {
			return UtilsImage.isLoaded(this);
		}
	});

// mixin from image
	atom.core.append(HTMLCanvasElement.prototype, {
		createSprite : HTMLImageElement.prototype.createSprite,
		sprite   : HTMLImageElement.prototype.sprite,
		isLoaded : atom.fn.lambda(true),
		toCanvas : atom.fn.lambda()
	});

	

	var ProjectiveTexture = function () {

		Context2D.prototype.projectiveImage = function (arg) {
			// test
			new ProjectiveTexture(arg.image)
				.setContext(this.ctx2d)
				.setQuality(arg.patchSize, arg.limit)
				.render( arg.to );
			return this;
		};

		var ProjectiveTexture = declare( 'LibCanvas.Plugins.ProjectiveTexture', {
			initialize : function (image) {
				if (typeof image == 'string') {
					this.image = new Image;
					image.src = image
				} else {
					this.image = image;
				}
				this.patchSize = 64;
				this.limit = 4;
			},
			setQuality : function (patchSize, limit) {
				this.patchSize = patchSize == null ? 64 : patchSize;
				this.limit = limit == null ? 4 : limit;
				return this;
			},
			setContext : function (ctx) {
				this.ctx = ctx;
				return this;
			},
			render : function (polygon) {

				var points = polygon.points;
				points = [
					[points[0].x, points[0].y],
					[points[1].x, points[1].y],
					[points[3].x, points[3].y],
					[points[2].x, points[2].y]
				];

				var tr = getProjectiveTransform(points);

				// Begin subdivision process.
				var ptl = tr.transformProjectiveVector([0, 0, 1]);
				var ptr = tr.transformProjectiveVector([1, 0, 1]);
				var pbl = tr.transformProjectiveVector([0, 1, 1]);
				var pbr = tr.transformProjectiveVector([1, 1, 1]);

				this.transform = tr;
				divide.call(this, 0, 0, 1, 1, ptl, ptr, pbl, pbr, this.limit);

				return this;
			}
		});

		var divide = function (u1, v1, u4, v4, p1, p2, p3, p4, limit) {

			// See if we can still divide.
			if (limit) {
				// Measure patch non-affinity.
				var d1 = [p2[0] + p3[0] - 2 * p1[0], p2[1] + p3[1] - 2 * p1[1]];
				var d2 = [p2[0] + p3[0] - 2 * p4[0], p2[1] + p3[1] - 2 * p4[1]];
				var d3 = [d1[0] + d2[0], d1[1] + d2[1]];
				var r = Math.abs((d3[0] * d3[0] + d3[1] * d3[1]) / (d1[0] * d2[0] + d1[1] * d2[1]));

				// Measure patch area.
				d1 = [p2[0] - p1[0] + p4[0] - p3[0], p2[1] - p1[1] + p4[1] - p3[1]];
				d2 = [p3[0] - p1[0] + p4[0] - p2[0], p3[1] - p1[1] + p4[1] - p2[1]];
				var area = Math.abs(d1[0] * d2[1] - d1[1] * d2[0]);

				// Check area > patchSize pixels (note factor 4 due to not averaging d1 and d2)
				// The non-affinity measure is used as a correction factor.
				if ((u1 == 0 && u4 == 1) || ((.25 + r * 5) * area > (this.patchSize * this.patchSize))) {
					// Calculate subdivision points (middle, top, bottom, left, right).
					var umid = (u1 + u4) / 2;
					var vmid = (v1 + v4) / 2;
					var tr   = this.transform;
					var pmid = tr.transformProjectiveVector([umid, vmid, 1]);
					var pt   = tr.transformProjectiveVector([umid, v1, 1]);
					var pb   = tr.transformProjectiveVector([umid, v4, 1]);
					var pl   = tr.transformProjectiveVector([u1, vmid, 1]);
					var pr   = tr.transformProjectiveVector([u4, vmid, 1]);

					// Subdivide.
					limit--;
					divide.call(this,   u1,   v1, umid, vmid,   p1,   pt,   pl, pmid, limit);
					divide.call(this, umid,   v1,   u4, vmid,   pt,   p2, pmid,   pr, limit);
					divide.call(this,  u1,  vmid, umid,   v4,   pl, pmid,   p3,   pb, limit);
					divide.call(this, umid, vmid,   u4,   v4, pmid,   pr,   pb,   p4, limit);

					return;
				}
			}

			var ctx = this.ctx;

			// Render this patch.
			ctx.save();
			// Set clipping path.
			ctx.beginPath();
			ctx.moveTo(p1[0], p1[1]);
			ctx.lineTo(p2[0], p2[1]);
			ctx.lineTo(p4[0], p4[1]);
			ctx.lineTo(p3[0], p3[1]);
			ctx.closePath();
			//ctx.clip();

			// Get patch edge vectors.
			var d12 = [p2[0] - p1[0], p2[1] - p1[1]];
			var d24 = [p4[0] - p2[0], p4[1] - p2[1]];
			var d43 = [p3[0] - p4[0], p3[1] - p4[1]];
			var d31 = [p1[0] - p3[0], p1[1] - p3[1]];

			// Find the corner that encloses the most area
			var a1 = Math.abs(d12[0] * d31[1] - d12[1] * d31[0]);
			var a2 = Math.abs(d24[0] * d12[1] - d24[1] * d12[0]);
			var a4 = Math.abs(d43[0] * d24[1] - d43[1] * d24[0]);
			var a3 = Math.abs(d31[0] * d43[1] - d31[1] * d43[0]);
			var amax = Math.max(Math.max(a1, a2), Math.max(a3, a4));
			var dx = 0, dy = 0, padx = 0, pady = 0;

			// Align the transform along this corner.
			switch (amax) {
				case a1:
					ctx.transform(d12[0], d12[1], -d31[0], -d31[1], p1[0], p1[1]);
					// Calculate 1.05 pixel padding on vector basis.
					if (u4 != 1) padx = 1.05 / Math.sqrt(d12[0] * d12[0] + d12[1] * d12[1]);
					if (v4 != 1) pady = 1.05 / Math.sqrt(d31[0] * d31[0] + d31[1] * d31[1]);
					break;
				case a2:
					ctx.transform(d12[0], d12[1],  d24[0],  d24[1], p2[0], p2[1]);
					// Calculate 1.05 pixel padding on vector basis.
					if (u4 != 1) padx = 1.05 / Math.sqrt(d12[0] * d12[0] + d12[1] * d12[1]);
					if (v4 != 1) pady = 1.05 / Math.sqrt(d24[0] * d24[0] + d24[1] * d24[1]);
					dx = -1;
					break;
				case a4:
					ctx.transform(-d43[0], -d43[1], d24[0], d24[1], p4[0], p4[1]);
					// Calculate 1.05 pixel padding on vector basis.
					if (u4 != 1) padx = 1.05 / Math.sqrt(d43[0] * d43[0] + d43[1] * d43[1]);
					if (v4 != 1) pady = 1.05 / Math.sqrt(d24[0] * d24[0] + d24[1] * d24[1]);
					dx = -1;
					dy = -1;
					break;
				case a3:
					// Calculate 1.05 pixel padding on vector basis.
					ctx.transform(-d43[0], -d43[1], -d31[0], -d31[1], p3[0], p3[1]);
					if (u4 != 1) padx = 1.05 / Math.sqrt(d43[0] * d43[0] + d43[1] * d43[1]);
					if (v4 != 1) pady = 1.05 / Math.sqrt(d31[0] * d31[0] + d31[1] * d31[1]);
					dy = -1;
					break;
			}

			// Calculate image padding to match.
			var du = (u4 - u1);
			var dv = (v4 - v1);
			var padu = padx * du;
			var padv = pady * dv;


			var iw = this.image.width;
			var ih = this.image.height;

			ctx.drawImage(
				this.image,
				u1 * iw,
				v1 * ih,
				Math.min(u4 - u1 + padu, 1) * iw,
				Math.min(v4 - v1 + padv, 1) * ih,
				dx, dy,
				1 + padx, 1 + pady
			);
			ctx.restore();
		}

		
		var Matrix = function (w, h, values) {
			this.w = w;
			this.h = h;
			this.values = values || allocate(h);
		};

		var allocate = function (w, h) {
			var values = [];
			for (var i = 0; i < h; ++i) {
				values[i] = [];
				for (var j = 0; j < w; ++j) {
					values[i][j] = 0;
				}
			}
			return values;
		}

		var cloneValues = function (values) {
			var clone = [];
			for (var i = 0; i < values.length; ++i) {
				clone[i] = [].concat(values[i]);
			}
			return clone;
		}

		function getProjectiveTransform(points) {
			var eqMatrix = new Matrix(9, 8, [
				[ 1, 1, 1,   0, 0, 0, -points[3][0],-points[3][0],-points[3][0] ],
				[ 0, 1, 1,   0, 0, 0,  0,-points[2][0],-points[2][0] ],
				[ 1, 0, 1,   0, 0, 0, -points[1][0], 0,-points[1][0] ],
				[ 0, 0, 1,   0, 0, 0,  0, 0,-points[0][0] ],

				[ 0, 0, 0,  -1,-1,-1,  points[3][1], points[3][1], points[3][1] ],
				[ 0, 0, 0,   0,-1,-1,  0, points[2][1], points[2][1] ],
				[ 0, 0, 0,  -1, 0,-1,  points[1][1], 0, points[1][1] ],
				[ 0, 0, 0,   0, 0,-1,  0, 0, points[0][1] ]

			]);

			var kernel = eqMatrix.rowEchelon().values;
			var transform = new Matrix(3, 3, [
				[-kernel[0][8], -kernel[1][8], -kernel[2][8]],
				[-kernel[3][8], -kernel[4][8], -kernel[5][8]],
				[-kernel[6][8], -kernel[7][8],             1]
			]);
			return transform;
		}

		Matrix.prototype = {
			add : function (operand) {
				if (operand.w != this.w || operand.h != this.h) {
					throw new Error("Matrix add size mismatch");
				}

				var values = allocate(this.w, this.h);
				for (var y = 0; y < this.h; ++y) {
					for (var x = 0; x < this.w; ++x) {
						values[y][x] = this.values[y][x] + operand.values[y][x];
					}
				}
				return new Matrix(this.w, this.h, values);
			},
			transformProjectiveVector : function (operand) {
				var out = [], x, y;
				for (y = 0; y < this.h; ++y) {
					out[y] = 0;
					for (x = 0; x < this.w; ++x) {
						out[y] += this.values[y][x] * operand[x];
					}
				}
				var iz = 1 / (out[out.length - 1]);
				for (y = 0; y < this.h; ++y) {
					out[y] *= iz;
				}
				return out;
			},
			multiply : function (operand) {
				var values, x, y;
				if (+operand !== operand) {
					// Matrix mult
					if (operand.h != this.w) {
						throw new Error("Matrix mult size mismatch");
					}
					values = allocate(this.w, this.h);
					for (y = 0; y < this.h; ++y) {
						for (x = 0; x < operand.w; ++x) {
							var accum = 0;
							for (var s = 0; s < this.w; s++) {
								accum += this.values[y][s] * operand.values[s][x];
							}
							values[y][x] = accum;
						}
					}
					return new Matrix(operand.w, this.h, values);
				}
				else {
					// Scalar mult
					values = allocate(this.w, this.h);
					for (y = 0; y < this.h; ++y) {
						for (x = 0; x < this.w; ++x) {
							values[y][x] = this.values[y][x] * operand;
						}
					}
					return new Matrix(this.w, this.h, values);
				}
			},
			rowEchelon : function () {
				if (this.w <= this.h) {
					throw new Error("Matrix rowEchelon size mismatch");
				}

				var temp = cloneValues(this.values);

				// Do Gauss-Jordan algorithm.
				for (var yp = 0; yp < this.h; ++yp) {
					// Look up pivot value.
					var pivot = temp[yp][yp];
					while (pivot == 0) {
						// If pivot is zero, find non-zero pivot below.
						for (var ys = yp + 1; ys < this.h; ++ys) {
							if (temp[ys][yp] != 0) {
								// Swap rows.
								var tmpRow = temp[ys];
								temp[ys] = temp[yp];
								temp[yp] = tmpRow;
								break;
							}
						}
						if (ys == this.h) {
							// No suitable pivot found. Abort.
							return new Matrix(this.w, this.h, temp);
						}
						else {
							pivot = temp[yp][yp];
						}
					}
					// Normalize this row.
					var scale = 1 / pivot;
					for (var x = yp; x < this.w; ++x) {
						temp[yp][x] *= scale;
					}
					// Subtract this row from all other rows (scaled).
					for (var y = 0; y < this.h; ++y) {
						if (y == yp) continue;
						var factor = temp[y][yp];
						temp[y][yp] = 0;
						for (x = yp + 1; x < this.w; ++x) {
							temp[y][x] -= factor * temp[yp][x];
						}
					}
				}

				return new Matrix(this.w, this.h, temp);
			},
			invert : function () {
				var x, y;

				if (this.w != this.h) {
					throw new Error("Matrix invert size mismatch");
				}

				var temp = allocate(this.w * 2, this.h);

				// Initialize augmented matrix
				for (y = 0; y < this.h; ++y) {
					for (x = 0; x < this.w; ++x) {
						temp[y][x] = this.values[y][x];
						temp[y][x + this.w] = (x == y) ? 1 : 0;
					}
				}

				temp = new Matrix(this.w * 2, this.h, temp);
				temp = temp.rowEchelon();

				// Extract right block matrix.
				var values = allocate(this.w, this.h);
				for (y = 0; y < this.w; ++y) {
					// @todo check if "x < this.w;" is mistake
					for (x = 0; x < this.w; ++x) {
						values[y][x] = temp.values[y][x + this.w];
					}
				}
				return new Matrix(this.w, this.h, values);
			}
		};

		return ProjectiveTexture;
	}();

	

	
	var SpriteFont = LibCanvas.declare(
		'LibCanvas.Plugins.SpriteFont', 'SpriteFont',
		{
			initialize: function (symbols) {
				if (typeof symbols == 'string') {
					symbols = symbols.split('');
				}
				this.symbols = symbols;
				this.normal  = {};
				this.bold    = {};
			},

			make: function (sheet) {
				sheet = new SpriteFont.Sheet(this, sheet);

				var target = sheet.bold ? this.bold : this.normal;

				if (target[sheet.size]) {
					throw new TypeError('Size already exists');
				}

				target[sheet.size] = sheet;

				return sheet;
			},

			get: function (symbol, data) {
				var font = ( data.bold ? this.bold : this.normal )[ data.size ];
				if (font) {
					return font.get(symbol, data.color);
				} else {
					throw new Error('No such sheet in font');
				}
			}
		}
	);

	
	atom.declare( 'LibCanvas.Plugins.SpriteFont.Sheet', {
		defaultColor: atom.Color.colorNames.black,

		settings: {
			image  : null,
			width  : [],
			symbols: [],
			bold   : false,
			size   : false
		},

		initialize: function (font, data) {
			this.settings = new atom.Settings(this.settings).set(data);
			this.symbols  = font.symbols;
			this.colors   = {};
			this.icons    = {};
		},

		get bold () { return this.settings.get('bold') },
		get size () { return this.settings.get('size') },

		get: function (symbol, color) {
			if (symbol in this.icons) {
				return this.icons[symbol];
			}

			if (!symbol in this.symbols) {
				throw new TypeError('Unknown symbol: ' + symbol);
			}
			if (color == null) {
				color = this.defaultColor;
			}
			color = atom.Color(color).toString('hex');

			var colors = this.colors;

			if (!colors[color]) {
				colors[color] = {};
			}
			if (!colors[color][symbol]) {
				colors[color][symbol] = this.generateSymbol(symbol, color);
			}

			return colors[color][symbol];
		},

		addIcon: atom.core.overloadSetter(function (name, image) {
			this.icons[name] = image;
		}),

		generateSymbol: function (symbol, color) {
			var i, w, h, x, img, buffer,
				width   = this.settings.get('width'),
				found   = false,
				symbols = this.symbols;

			for ( i = 0, x = 0; i < symbols.length; i++ ) {
				w = width[i];
				if (symbols[i] == symbol) {
					found = true;
					break;
				}
				x += w;
			}

			if (!found) {
				throw new Error('No symbol in list: ' + symbol);
			}

			img = this.settings.get('image');
			h   = img.height;
			buffer = LibCanvas.buffer(w, h, true);
			buffer.ctx.drawImage({
				image: img,
				crop : [ x, 0, w, h ],
				draw : buffer.ctx.rectangle
			});

			if (color != this.defaultColor) {
				buffer.ctx
					.save()
					.set({ globalCompositeOperation: Context2D.COMPOSITE.SOURCE_IN })
					.fillAll(color)
					.restore();

			}

			return buffer;
		}
	});


	
	atom.declare( 'LibCanvas.Plugins.SpriteFont.Render', {

		
		initialize: function (ctx, options) {
			this.ctx = ctx;
			this.options = atom.core.append({
				size : 16,
				bold : false,
				text : '',
				tags : '{*}',
				font : null,
				shape: null,
				color: 'black',
				align: 'left',
				lines: null,
				noWrap: false,
				letterSpacing: 0,
				autoRender: true,
				forceSplit: false
			}, options);

			this.options.text = String( this.options.text );

			if (this.options.autoRender) {
				var completeLines = this.parseAndGetLines();
				this.render(completeLines);
			}
		},

		getLinesHeight: function(lines) {
			var height = 0;
			for (var idx = 0; idx < lines.length; idx++) {
				height += lines[idx].height;
			}
			return height;
		},

		parseAndGetLines: function() {
			var steps = new SpriteFont.Steps(this, new SpriteFont.Lexer(
				this.options.text, this.options.tags
			));

			steps.countSizes(this.options.font, this.options.letterSpacing);

			var lines = this.options.lines;
			if (!lines) lines = new SpriteFont.LinesEnRu();
			lines.setConfig(this.options.font, this.options.noWrap, this.options.forceSplit);

			return lines.run( steps.steps, this.options.shape.width );
		},

		render: function (lines) {
			var x, y, w, l, i, from = this.options.shape.from;

			for (l = 0, y = from.y.floor(); l < lines.length; l++) {
				x = from.x.floor();

				if (this.options.align != 'left') {
					w = lines[l].reduce(function (current, elem) { return current + elem.width }, 0);

					if (this.options.align == 'center') {
						x += parseInt((this.options.shape.width - w) / 2);
					}

					if (this.options.align == 'right') {
						x += this.options.shape.width - w;
					}
				}

				for (i = 0; i < lines[l].length; i++) {
					this.ctx.drawImage( lines[l][i].image, x, y );
					x += lines[l][i].width;
				}
				y += lines[l].height;
			}
		}
	});

	
	atom.declare( 'LibCanvas.Plugins.SpriteFont.Steps', {
		tags: {
			bold : false,
			size : true,
			color: true
		},

		tagRegExp: /(\w+)(=.*)?/,

		initialize: function (render, lexer) {
			this.steps  = [];
			this.tokens = lexer.tokens;
			this.index  = -1;

			this.split(atom.object.collect(render.options, [ 'color', 'size', 'bold' ]));
		},

		split: function (initialMode) {
			var t,
				i = 0,
				l = this.tokens.length,
				stack = [ initialMode ],
				last  = function () {
					return stack[ stack.length - 1 ];
				};

			for (; i < l; i++) {
				t = this.tokens[i];
				if (t.type == 'string') {
					t.content.split('').forEach(function (l) {
						this.steps.push({ type: 'symbol', content: l, mode: last() });
					}.bind(this));
				} else if (t.type == 'nl') {
					this.steps.push(t);
				} else if (t.type == 'tag') {
					if (this.isCloseModeTag(t)) {
						stack.pop();
					} else if (this.isChangeModeTag(t)) {
						stack.push(this.createMode(t, last()));
					} else {
						this.steps.push({ type: 'icon', content: t.content, mode: last() });
					}
				} else {
					throw new Error('Unknown type: ' + t.type);
				}
			}
		},

		isChangeModeTag: function (t) {
			return t.content.match( this.tagRegExp )[1] in this.tags;
		},

		isCloseModeTag: function (t) {
			return t.content == '/';
		},

		createMode: function (t, currentMode) {
			var
				parts = t.content.match( this.tagRegExp ),
				tag   = parts[1],
				value = parts[2],
				mode  = atom.core.append({}, currentMode);

			if (this.tags[tag]) {
				if (value) value = value.substr(1);
				if (value == '') throw new Error('Value required in tag ' + tag);
			} else {
				value = true;
			}

			mode[tag] = value;
			return mode;
		},

		countSizes: function (font, letterSpacing) {
			var i, s, img;
			for (i = 0; i < this.steps.length; i++) {
				s = this.steps[i];
				if (s.type == 'symbol' || s.type == 'icon') {
					img = font.get( s.content, s.mode );
					s.image  = img;
					s.width  = img.width + letterSpacing;
					s.height = img.height;
				}
			}
		}
	});

	
	atom.declare( 'LibCanvas.Plugins.SpriteFont.Lexer', {

		initialize: function (string, tags) {
			this.string = string;
			this.tags   = this.parseTags(tags);
			this.tokens = this.tokenize();
		},

		tokenize: function () {
			var t = this.tags, s = this.string;
			return t ?
				this.parseTaggedText(s, t) :
				this.parsePlainText (s);
		},

		parseTaggedText: function (string, tags) {
			var
				i = 0,
				last,
				symbol = '',
				result = [],
				length = string.length;

			for (; i < length; i++) {
				symbol = string[i];
				if (symbol == '\n') {
					if (last && last.type == 'tag') {
						throw new Error('Tag started, but not finished at symbol ' + i);
					}
					result.push({ type: 'nl' });
					last = null;
				} else if (symbol == tags[0]) {
					if (last && last.type == 'tag') {
						throw new Error('Wrong tag opening at symbol ' + i);
					}
					result.push(last = { type: 'tag'   , content: '' });
				} else if (!last) {
					result.push(last = { type: 'string', content: string[i] });
				} else if (symbol == tags[1] && last.type == 'tag') {
					last = null;
				} else {
					last.content += string[i];
				}
			}

			return result;
		},

		parsePlainText: function (string) {
			var
				i = 0,
				last,
				result = [],
				length = string.length;
			for (; i < length; i++) {
				if (string[i] == '\n') {
					last = null;
					result.push({ type: 'nl' });
				} else if (!last) {
					last = { type: 'string', content: string[i] };
					result.push(last);
				} else {
					last.content += string[i];
				}
			}
			return result;
		},

		parseTags: function (tags) {
			if (tags == null) return null;

			function wrong (part) {
				throw new TypeError('String like "[*]" required (' + part + ')');
			}

			if (typeof tags != 'string') wrong('typeof');

			tags = tags.split('*');

			if (tags   .length != 2) wrong('split');
			if (tags[0].length != 1) wrong('left' );
			if (tags[1].length != 1) wrong('right');

			return tags;
		}
	});

	
	atom.declare( 'LibCanvas.Plugins.SpriteFont.MorphemesFinder', {
		vowels: 'AEIOUYaeiouyАОУЮИЫЕЭЯЁаоуюиыеэяёьЄІЇЎєіїў',

		initialize: function () {
		},

		isLetter: function(str) {
			return (str >= 'a' && str <= 'z') || (str >= 'A' && str <= 'я') ||
				(str >= 'A' && str <= 'Z') || (str >= '\u00c0' && str <= '\u02a8') ||
				(str >= '0' && str <= '9') || (str >= '\u0386' && str <= '\u04ff');
		},

		isVowel: function(str) {
			return str && str.length == 1 && this.vowels.indexOf(str) > -1;
		},

		isMorpheme: function (str) {
			if (!str || str.length <= 1) return false;

			for (var i = str.length; i--;) if (this.isVowel(str[i])) return true;

			return false;
		},

		findMorphemes: function (line) {
			var i = 0, c, morphemes = [], lastStr = '', last = [], prev;

			var pushLast = function () {
				prev = morphemes[ morphemes.length - 1 ];
				if (Array.isArray(prev)) {
					atom.array.append( prev, last );
				} else {
					morphemes.push(last);
				}
				last = [];
				lastStr = '';

				if (!this.isLetter(c)) {
					morphemes.push( line[i] );
				}
			}.bind(this);

			for (; i < line.length; i++) {
				c = line[i].content;

				if (line[i].type == 'icon') {
					morphemes.push(last);
					last = [];
					lastStr = '';
					morphemes.push( line[i] );
				} else if (line[i].type == 'symbol' && this.isLetter(c)) {
					lastStr += c;
					last.push(line[i]);
					if (this.isMorpheme(lastStr)) {
						morphemes.push(last);
						last = [];
						lastStr = '';
					}
				} else if (lastStr) {
					pushLast();
				} else {
					morphemes.push( line[i] );
				}
			}

			if (lastStr) pushLast();

			return morphemes;
		}
	});

	
	atom.declare( 'LibCanvas.Plugins.SpriteFont.LinesEnRu', {
		setConfig: function (font, noWrap, forceSplit) {
			this.font = font;
			this.noWrap = noWrap;
			this.forceSplit = forceSplit;
			this.morphemesFinder = new SpriteFont.MorphemesFinder();
		},

		run: function (steps, maxWidth) {
			var i, line = [], morphemes = [], tmpMark = false;

			for (i = 0; i < steps.length; i++) {

				if (this.forceSplit) {
					line.push(steps[i]);
				} else {
					if (steps[i].type == 'icon') tmpMark = true;

					if (steps[i].type == 'nl' || i == steps.length - 1) {
						if (steps[i].type != 'nl') {
							line.push(steps[i]);
						}

						morphemes.push( this.morphemesFinder.findMorphemes(line) );
						line = [];
					} else {
						line.push(steps[i]);
					}
				}
			}

			if (this.forceSplit) {
				morphemes.push(line);
			}

			return this.countLines(morphemes, maxWidth);

		},

		countLines: function (mLines, maxWidth) {
			var lines = [], l, i, line = [], width = 0, mWidth;

			function add (data) {
				if (!Array.isArray(data)) data = [ data ];
				for (var i = 0; i < data.length; i++) {
					line.push(data[i]);
					width += data[i].width;
				}
			}

			for (l = 0; l < mLines.length; l++) {
				for (i = 0; i < mLines[l].length; i++) {
					mWidth = this.countLength(mLines[l][i]);

					if (mWidth > maxWidth) {
						throw new Error('Morpheme too long');
					}

					if (!this.noWrap && (width + mWidth > maxWidth || (i == 0 && l > 0))) {
						lines.push(line);
						line  = [];
						width = 0;
					}

					add(mLines[l][i]);
				}
			}

			if (line.length > 0) lines.push(line);

			lines.forEach(function (l) {
				l.height = 0;

				l.forEach(function (obj) {
					l.height = Math.max( l.height, obj.height );
				});
			});

			return lines;
		},

		countLength: function (m) {
			if (Array.isArray(m)) {
				return atom.array.reduce(
					m, function (value, sym) { return value + sym.width }, 0
				);
			} else {
				return m.width;
			}
		}
	});


	

	
	var Ellipse = LibCanvas.declare( 'LibCanvas.Shapes.Ellipse', 'Ellipse', Rectangle, {
		set: function () {
			this.bindMethods( 'update' );
			Rectangle.prototype.set.apply(this, arguments);
		},
		_angle : 0,
		get angle () {
			return this._angle;
		},
		set angle (a) {
			if (this._angle == a) return;
			this._angle = atom.math.normalizeAngle(a);
			this.updateCache = true;
		},
		update: function () {
			this.updateCache = true;
		},
		rotate : function (degree) {
			this.angle += degree;
			return this;
		},
		hasPoint : function () {
			var ctx = this.processPath( shapeTestBuffer().ctx );
			return ctx.isPointInPath(Point(arguments));
		},
		cache : null,
		updateCache : true,
		countCache : function () {
			if (this.cache && !this.updateCache) {
				return this.cache;
			}

			if (this.cache === null) {
				this.cache = [];
				for (var i = 12; i--;) this.cache.push(new Point());
			}
			var c = this.cache,
				angle = this._angle,
				kappa = .5522848,
				x  = this.from.x,
				y  = this.from.y,
				xe = this.to.x,
				ye = this.to.y,
				xm = (xe + x) / 2,
				ym = (ye + y) / 2,
				ox = (xe - x) / 2 * kappa,
				oy = (ye - y) / 2 * kappa;
			c[0].set(x, ym - oy); c[ 1].set(xm - ox, y); c[ 2].set(xm, y);
			c[3].set(xm + ox, y); c[ 4].set(xe, ym -oy); c[ 5].set(xe, ym);
			c[6].set(xe, ym +oy); c[ 7].set(xm +ox, ye); c[ 8].set(xm, ye);
			c[9].set(xm -ox, ye); c[10].set(x, ym + oy); c[11].set(x, ym);

			if (angle) {
				var center = new Point(xm, ym);
				for (i = c.length; i--;) c[i].rotate(angle, center);
			}

			return c;
		},
		processPath : function (ctx, noWrap) {
			if (!noWrap) ctx.beginPath();
			var c = this.countCache();
			ctx.beginPath(c[11])
				.bezierCurveTo(c[0], c[1], c[2])
				.bezierCurveTo(c[3], c[4], c[5])
				.bezierCurveTo(c[6], c[7], c[8])
				.bezierCurveTo(c[9], c[10],c[11]);
			if (!noWrap) ctx.closePath();
			return ctx;
		},
		equals : function (shape, accuracy) {
			return Rectangle.prototype.equals.call( this, shape, accuracy ) && shape.angle == this.angle;
		},
		draw : function (ctx, type) {
			this.processPath(ctx)[type]();
			return this;
		},
		dump: function (name) {
			return Rectangle.prototype.dump.call(this, name || 'Ellipse');
		}
	});

	

	var Line = function () {

		var between = function (x, a, b, accuracy) {
			return atom.number.equals(x, a, accuracy)
				|| atom.number.equals(x, b, accuracy)
				|| (a < x && x < b)
				|| (b < x && x < a);
		};

		var halfPi = Math.PI/2;

		
		return LibCanvas.declare( 'LibCanvas.Shapes.Line', 'Line', Shape, {
			set : function (from, to) {
				var a = atom.array.pickFrom(arguments);

				if (a.length === 4) {
					this.from = new Point( a[0], a[1] );
					this.to   = new Point( a[2], a[3] );
				} else {
					this.from = Point.from(a[0] || a.from);
					this.to   = Point.from(a[1] || a.to);
				}

				return this;
			},
			hasPoint : function (point) {
				var fx = this.from.x,
					fy = this.from.y,
					tx = this.to.x,
					ty = this.to.y,
					px = point.x,
					py = point.y;

				if (!( atom.number.between(point.x, Math.min(fx, tx), Math.max(fx, tx))
					&& atom.number.between(point.y, Math.min(fy, ty), Math.max(fy, ty))
					)) return false;

				// if triangle square is zero - points are on one line
				return atom.number.round(((fx-px)*(ty-py)-(tx-px)*(fy-py)), 6) == 0;
			},
			getBoundingRectangle: function () {
				return new Rectangle(this.from, this.to).fillToPixel().grow(2);
			},
			intersect: function (line, point, accuracy) {
				if (line.constructor != this.constructor) {
					return this.getBoundingRectangle().intersect( line );
				}
				var a = this.from, b = this.to, c = line.from, d = line.to, x, y, FALSE = point ? null : false;
				if (atom.number.equals(d.x, c.x, accuracy)) { // DC == vertical line
					if (atom.number.equals(b.x, a.x, accuracy)) {
						if (atom.number.equals(a.x, d.x, accuracy)) {
							if (atom.number.between(a.y, c.y, d.y)) {
								return a.clone();
							} else if (atom.number.between(b.y, c.y, d.y)) {
								return b.clone();
							} else {
								return FALSE;
							}
						} else {
							return FALSE;
						}
					}
					x = d.x;
					y = b.y + (x-b.x)*(a.y-b.y)/(a.x-b.x);
				} else {
					x = ((a.x*b.y - b.x*a.y)*(d.x-c.x)-(c.x*d.y - d.x*c.y)*(b.x-a.x))/((a.y-b.y)*(d.x-c.x)-(c.y-d.y)*(b.x-a.x));
					y = ((c.y-d.y)*x-(c.x*d.y-d.x*c.y))/(d.x-c.x);
					x *= -1;
				}

				if (!between(x, a.x, b.x, accuracy)) return FALSE;
				if (!between(y, a.y, b.y, accuracy)) return FALSE;
				if (!between(x, c.x, d.x, accuracy)) return FALSE;
				if (!between(y, c.y, d.y, accuracy)) return FALSE;

				return point ? new Point(x, y) : true;
			},
			perpendicular: function (point) {
				point = Point( point );
				var
					fX = this.from.x,
					fY = this.from.y,
					tX = this.to.x,
					tY = this.to.y,
					pX = point.x,
					pY = point.y,
					dX = (tX-fX) * (tX-fX),
					dY = (tY-fY) * (tY-fY),
					rX = ((tX-fX)*(tY-fY)*(pY-fY)+fX*dY+pX*dX) / (dX+dY),
					rY = (tY-fY)*(rX-fX)/(tX-fX)+fY;

				return new Point( rX, rY );
			},
			distanceTo: function (p, asInfiniteLine) {
				p = Point(p);
				var f = this.from, t = this.to, angle, s, x, y;

				if (!asInfiniteLine) {
					angle = Math.atan2(p.x - t.x, p.y - t.y);
					if ( atom.number.between(angle, -halfPi, halfPi) ) {
						return t.distanceTo( p );
					}

					angle = Math.atan2(f.x - p.x, f.y - p.y);
					if ( atom.number.between(angle, -halfPi, halfPi) ) {
						return f.distanceTo( p );
					}
				}

				s = Math.abs(
					f.x * (t.y - p.y) +
						t.x * (p.y - f.y) +
						p.x * (f.y - t.y)
				) / 2;

				x = f.x - t.x;
				y = f.y - t.y;
				return 2 * s / Math.sqrt(x*x+y*y);
			},
			get length () {
				return this.to.distanceTo(this.from);
			},
			getLength : function () {
				return this.length;
			},
			processPath : function (ctx, noWrap) {
				if (!noWrap) ctx.beginPath();
				ctx.moveTo(this.from).lineTo(this.to);
				if (!noWrap) ctx.closePath();
				return ctx;
			},
			dump: function () {
				return Shape.prototype.dump.call(this, 'Line');
			}
		});

	}();


	

	
	var Polygon = LibCanvas.declare( 'LibCanvas.Shapes.Polygon', 'Polygon', Shape, {
		initialize: function method () {
			this.points = [];
			this._lines = [];
			method.previous.apply(this, arguments);
		},
		set : function (poly) {
			this.points.length = 0;

			var source = Array.isArray(poly) ? poly : atom.core.toArray(arguments);

			atom.array.append( this.points,
				source
					.filter(Boolean)
					.map(Point)
			);

			this._lines.length = 0;

			return this;
		},
		get length () {
			return this.points.length;
		},
		get lines () {
			var
				lines = this._lines,
				p = this.points,
				l = p.length,
				i = 0;

			if (lines.length != l) for (;i < l; i++) {
				lines.push( new Line( p[i], i+1 == l ? p[0] : p[i+1] ) );
			}

			return this._lines;
		},
		get center () {
			return new Point().mean(this.points);
		},
		get: function (index) {
			return this.points[index];
		},
		getCoords : function () {
			return this.points[0];
		},
		processPath : function (ctx, noWrap) {
			var p = this.points, i = 0, l = p.length;

			if (!noWrap) ctx.beginPath();
			for (; i <= l; i++) {
				if (i == 0) {
					ctx.moveTo(p[i]);
				} else {
					ctx.lineTo(p[i == l ? 0 : i]);
				}
			}
			if (!noWrap) ctx.closePath();

			return ctx;
		},

		grow: function () { return this; },

		getBoundingRectangle: function () {
			var p = this.points, l = p.length, from, to;

			if (l == 0) {
				throw new Error('Shape is empty');
			}

			while (l--) {

				if (from) {
					from.x = Math.min( from.x, p[l].x );
					from.y = Math.min( from.y, p[l].y );
					to.x = Math.max(   to.x, p[l].x );
					to.y = Math.max(   to.y, p[l].y );
				} else {
					from = p[l].clone();
					to   = p[l].clone();
				}

			}

			return new Rectangle( from, to );
		},

		// points invoking
		move : function (distance, reverse) {
			return this.invoke('move', distance, reverse)
		},
		rotate : function (angle, pivot) {
			return this.invoke('rotate', angle, pivot)
		},
		scale : function (power, pivot) {
			return this.invoke('scale', power, pivot)
		},
		invoke: function (method, args) {
			args = Array.prototype.slice.call(arguments, 1);

			this.points.map(function (point) {
				point[method].apply(point, args);
			});
			return this;
		},
		forEach : function (fn) {
			this.points.forEach(fn);
			return this;
		},
		each: function (fn, context) {
			return this.forEach(context ? fn.bind(context) : fn);
		},

		hasPoint : function (point) {
			point = Point.from(point);

			var result = false, points = this.points;
			for (var i = 0, l = this.length; i < l; i++) {
				var k = (i || l) - 1, I = points[i], K = points[k];
				if (
					(atom.number.between(point.y, I.y , K.y, "L")
						|| atom.number.between(point.y, K.y , I.y, "L")
						) && point.x < (K.x - I.x) * (point.y -I.y) / (K.y - I.y) + I.x
					) {
					result = !result;
				}
			}
			return result;
		},
		intersect : function (poly) {
			if (poly.constructor != this.constructor) {
				return this.getBoundingRectangle().intersect( poly );
			}

			var tL = this.lines, pL = poly.lines, i = tL.length, k = pL.length;
			while (i-- > 0) for (k = pL.length; k-- > 0;) {
				if (tL[i].intersect(pL[k])) return true;
			}
			return false;
		},
		getPoints : function () {
			return atom.array.toHash(this.points);
		},
		clone: function () {
			return new this.constructor( atom.array.invoke(this.points, 'clone') );
		}
	});

	

	
	var Path = LibCanvas.declare( 'LibCanvas.Shapes.Path', 'Path', Polygon, {
		parts: [],

		initialize : function (parts) {
			this.parts = [];

			if (parts) this.set(parts);
		},

		set : function (parts) {
			this.parts.length = 0;

			if (Array.isArray(parts)) {
				for (var i = 0, l = parts.length; i < l; i++) {
					this.push(parts[i]);
				}
			}
		},

		get length () {
			return this.parts.length;
		},

		// methods
		moveTo: function (point) {
			return this.push('moveTo', [ Point.from(point) ]);
		},
		lineTo: function (point) {
			return this.push('lineTo', [ Point.from(point) ]);
		},
		curveTo: function (to, cp1, cp2) {
			var points = atom.array.pickFrom(arguments).map(Point);
			return this.push('curveTo', points);
		},

		// queue/stack
		push : function (method, points) {
			this.parts.push(Path.Part.from(method, points));
			return this;
		},
		unshift: function (method, points) {
			this.parts.unshift(Path.Part.from(method, points));
			return this;
		},
		pop : function () {
			return this.parts.pop();
		},
		shift: function () {
			return this.parts.shift();
		},

		processPath : function (ctx, noWrap) {
			if (!noWrap) ctx.beginPath();
			this.forEach(function (part) {
				ctx[part.method].apply(ctx, part.points);
			});
			if (!noWrap) ctx.closePath();
			return ctx;
		},

		intersect: function (obj) {
			return this.getBoundingRectangle()
				.intersect(	obj.getBoundingRectangle() );
		},

		forEach: function (fn) {
			var parts = this.parts, i = 0, l = parts.length;
			while (i < l) {
				fn.call( this, parts[i++], i, this );
			}
			return this;
		},

		get points () {
			var points = [];
			this.forEach(function (part) {
				for (var i = 0, l = part.points.length; i < l; i++) {
					atom.array.include(points, part.points[i]);
				}
			});
			return points;
		},

		hasPoint : function (point) {
			var ctx = shapeTestBuffer().ctx;
			this.processPath(ctx);
			return ctx.isPointInPath(Point.from(point));
		},
		clone: function () {
			return new this.constructor(
				this.parts.invoke('clone')
			);
		}
	});
	
	atom.declare('LibCanvas.Shapes.Path.Part', {
		initialize: function (method, points) {
			this.method = method;
			this.points = points.map(Point);
		},

		clone: function () {
			return new this.constructor(
				this.method,
				this.points.invoke('clone')
			);
		}
	}).own({
			from: function (method, args) {
				if (method == null) {
					throw new Error('Empty path method');
				}

				if (typeof method == 'string') {
					return new this(method, args) ;
				} else if (atom.core.isArrayLike(method)) {
					return new this(method[0], args[1]);
				} else {
					return this;
				}
			}
		});

	

	
	var RoundedRectangle = LibCanvas.declare(
		'LibCanvas.Shapes.RoundedRectangle', 'RoundedRectangle', Rectangle, {
			radius: 0,

			setRadius: function (value) {
				this.radius = value;
				return this;
			},
			draw : Shape.prototype.draw,
			processPath : function (ctx, noWrap) {
				var from = this.from, to = this.to, radius = this.radius;
				if (!noWrap) ctx.beginPath();
				ctx
					.moveTo (from.x, from.y+radius)
					.lineTo (from.x,   to.y-radius)
					.curveTo(from.x, to.y, from.x + radius, to.y)
					.lineTo (to.x-radius, to.y)
					.curveTo(to.x,to.y, to.x,to.y-radius)
					.lineTo (to.x, from.y+radius)
					.curveTo(to.x, from.y, to.x-radius, from.y)
					.lineTo (from.x+radius, from.y)
					.curveTo(from.x,from.y,from.x,from.y+radius);
				if (!noWrap) ctx.closePath();
				return ctx;
			},

			equals: function (shape, accuracy) {
				return Rectangle.prototype.equals.call( this, shape, accuracy ) && shape.radius == this.radius;
			},

			dump: function () {
				var p = function (p) { return '[' + p.x + ', ' + p.y + ']'; };
				return '[shape RoundedRectangle(from'+p(this.from)+', to'+p(this.to)+', radius='+this.radius+')]';
			}
		});

	

	
	var Behaviors = declare( 'LibCanvas.App.Behaviors', {
		behaviors: {},

		initialize: function (element) {
			this.element   = element;
			this.behaviors = {};
		},

		
		getMouse: function (handler) {
			return this.element.layer.app.resources.get(
				handler ? 'mouseHandler' : 'mouse'
			);
		},

		add: function (Behaviour, args) {
			if (typeof Behaviour == 'string') {
				Behaviour = this.constructor[Behaviour];
			}

			return this.behaviors[Behaviour.index] = new Behaviour(this, slice.call( arguments, 1 ));
		},

		get: function (name) {
			return this.behaviors[name] || null;
		},

		startAll: function (arg) {
			this.invoke('start', arguments);
			return this;
		},

		stopAll: function () {
			this.invoke('stop', arguments);
			return this;
		},


		invoke: function (method, args) {
			var i, b = this.behaviors;
			for (i in b) if (b.hasOwnProperty(i)) {
				b[i][method].apply(b[i], args);
			}
			return this;
		}

	}).own({
			attach: function (target, types, arg) {
				target.behaviors = new Behaviors(target);

				types.forEach(function (type) {
					target.behaviors.add(type, arg);
				});

				return target.behaviors;
			}
		});


	declare( 'LibCanvas.App.Behaviors.Behavior', {
		started: false,


		eventArgs: function (args, eventName) {
			if (atom.core.isFunction(args[0])) {
				this.events.add( eventName, args[0] );
			}
		},


		changeStatus: function (status){
			if (this.started == status) {
				return false;
			} else {
				this.started = status;
				return true;
			}
		}
	});

	

	new function () {

		function setValueFn (name, val) {
			var result = [name, val];
			return function () {
				if (this[name] != val) {
					this[name] = val;
					this.events.fire('statusChange', result);
				}
			};
		}

		return declare( 'LibCanvas.App.Behaviors.Clickable', App.Behaviors.Behavior, {

			callbacks: {
				'mouseover'   : setValueFn('hover' , true ),
				'mouseout'    : (function () {
					var dehover  = setValueFn('hover' , false),
						deactive = setValueFn('active', false);

					return function (e) {
						dehover .call(this, e);
						deactive.call(this, e);
					};
				})(),
				'mousedown'   : setValueFn('active', true ),
				'mouseup'     : setValueFn('active', false)
			},

			initialize: function (behaviors, args) {
				this.events = behaviors.element.events;
				this.eventArgs(args, 'statusChange');
			},

			start: function () {
				if (!this.changeStatus(true)) return this;

				this.eventArgs(arguments, 'statusChange');
				this.events.add(this.callbacks);
			},

			stop: function () {
				if (!this.changeStatus(false)) return this;

				this.events.remove(this.callbacks);
			}

		}).own({ index: 'clickable' });

	};

	

	declare( 'LibCanvas.App.Behaviors.Draggable', App.Behaviors.Behavior, {
		stopDrag: [ 'up', 'out' ],

		initialize: function (behaviors, args) {
			this.bindMethods([ 'onStop', 'onDrag', 'onStart' ]);

			this.behaviors = behaviors;
			this.element   = behaviors.element;
			if (!atom.core.isFunction(this.element.move)) {
				throw new TypeError( 'Element ' + this.element + ' must has «move» method' );
			}
			this.events  = behaviors.element.events;
			this.eventArgs(args, 'moveDrag');
		},

		bindMouse: function (method) {
			var mouse = this.mouse, stop = this.stopDrag;

			mouse.events
				[method]( 'move', this.onDrag )
				[method](  stop , this.onStop );

			return mouse;
		},

		start: function () {
			if (!this.changeStatus(true)) return this;

			this.mouse = this.behaviors.getMouse();
			if (!this.mouse) throw new Error('No mouse in element');
			this.eventArgs(arguments, 'moveDrag');
			this.events.add( 'mousedown', this.onStart );
		},

		stop: function () {
			if (!this.changeStatus(false)) return this;

			this.events.remove( 'mousedown', this.onStart );
		},


		onStart: function (e) {
			if (e.button !== 0) return;

			this.bindMouse('add');
			this.events.fire('startDrag', [ e ]);
		},


		onDrag: function (e) {
			if (!this.element.layer) {
				return this.onStop(e, true);
			}

			var delta = this.behaviors.getMouse().delta;
			this.element.move( delta );
			this.events.fire('moveDrag', [delta, e]);
		},


		onStop: function (e, forced) {
			if (e.button === 0 || forced === true) {
				this.bindMouse('remove');
				this.events.fire('stopDrag', [ e ]);
			}
		}
	}).own({ index: 'draggable' });

	

	
	declare( 'LibCanvas.App.Light', {

		initialize: function (size, settings) {
			var mouse, mouseHandler;

			this.settings = new Settings({
				size    : Size.from(size),
				name    : 'main',
				mouse   : true,
				invoke  : false,
				simple  : true,
				appendTo: 'body',
				intersection: 'auto'
			}).set(settings || {});

			this.app   = new App( this.settings.subset(['size', 'appendTo', 'simple']) );
			this.layer = this.app.createLayer(this.settings.subset(['name','invoke','intersection']));
			if (this.settings.get('mouse') === true) {
				mouse = new Mouse(this.app.container.bounds);
				mouseHandler = new App.MouseHandler({ mouse: mouse, app: this.app });

				this.app.resources.set({ mouse: mouse, mouseHandler: mouseHandler });
			}
		},

		createVector: function (shape, settings) {
			settings = atom.core.append({ shape:shape }, settings || {});
			return new App.Light.Vector(this.layer, settings);
		},

		createText: function (shape, style, settings) {
			settings = atom.core.append({ shape: shape, style: style }, settings);
			return new App.Light.Text(this.layer, settings);
		},

		createImage: function (shape, image, settings) {
			return new App.Light.Image(this.layer, atom.core.append({
				shape: shape, image: image
			}, settings));
		},

		get mouse () {
			return this.app.resources.get( 'mouse' );
		},

		get mouseHandler () {
			return this.app.resources.get( 'mouseHandler' );
		}

	});

	

	
	App.Light.Element = atom.declare( 'LibCanvas.App.Light.Element', App.Element, {

		get behaviors () {
			throw new Error( 'Please, use `element.clickable` & `element.draggable` instead' );
		},

		clickable : null,
		draggable : null,
		animatable: null,

		configure: function () {
			this.clickable  = new App.Clickable(this, this.redraw);
			this.draggable  = new App.Draggable(this, this.redraw);
			this.animatable = new atom.Animatable(this);
			this.animate    = this.animatable.animate;

			if (this.settings.get('mouse') !== false) {
				this.listenMouse();
			}
		},

		
		animate: function(){},

		listenMouse: function (unsubscribe) {
			var method = unsubscribe ? 'unsubscribe' : 'subscribe';
			return this.layer.app.resources.get('mouseHandler')[method](this);
		},

		destroy: function method () {
			this.listenMouse(true);
			return method.previous.call(this);
		}
	});

	

	
	App.Light.Image = atom.declare( 'LibCanvas.App.Light.Image', App.Light.Element, {
		get currentBoundingShape () {
			return this.shape.clone().fillToPixel();
		},

		renderTo: function (ctx) {
			ctx.drawImage({
				image: this.settings.get('image'),
				draw : this.shape
			})
		}
	});

	

	
	atom.declare( 'LibCanvas.App.Light.Text', App.Element, {
		get style () {
			return this.settings.get('style') || {};
		},

		get content () {
			return this.style.text || '';
		},

		set content (c) {
			if (Array.isArray(c)) c = c.join('\n');

			if (c != this.content) {
				this.redraw();
				this.style.text = String(c) || '';
			}
		},

		renderTo: function (ctx) {
			var bg    = this.settings.get('background');

			if (bg) ctx.fill( this.shape, bg );
			ctx.text(atom.core.append({
				to  : this.shape
			}, this.style));
		}
	});

	

	
	App.Light.Vector = atom.declare( 'LibCanvas.App.Light.Vector', App.Light.Element, {
		active: false,
		hover : false,

		configure: function method () {
			method.previous.call(this);

			this.style       = {};
			this.styleActive = {};
			this.styleHover  = {};
		},

		setStyle: function (key, values) {
			if (typeof key == 'object') {
				values = key;
				key = '';
			}
			key = 'style' + atom.string.ucfirst(key);

			atom.core.append( this[key], values );
			return this.redraw();
		},

		getStyle: function (type) {
			if (!this.style) return null;

			var
				active = (this.active || null) && this.styleActive[type],
				hover  = (this.hover  || null)  && this.styleHover [type],
				plain  = this.style[type];

			return active != null ? active :
				hover  != null ? hover  :
					plain  != null ? plain  : null;
		},

		get currentBoundingShape () {
			var
				br = this.shape.getBoundingRectangle(),
				lw = this.getStyle('stroke') && (this.getStyle('lineWidth') || 1);

			return lw ? br.fillToPixel().grow(2 * Math.ceil(lw)) : br;
		},

		renderTo: function (ctx) {
			var fill    = this.getStyle('fill'),
				stroke  = this.getStyle('stroke'),
				lineW   = this.getStyle('lineWidth'),
				opacity = this.getStyle('opacity');

			if (opacity === 0) return this;

			ctx.save();
			if (opacity) ctx.globalAlpha = atom.number.round(opacity, 3);
			if (fill) ctx.fill(this.shape, fill);
			if (stroke) {
				ctx.lineWidth = lineW || 1;
				ctx.stroke(this.shape, stroke);
			}
			ctx.restore();
			return this;
		}
	});

	

	
	LibCanvas.declare( 'LibCanvas.Engines.Hex', 'HexEngine', { });

	

	
	atom.declare( 'LibCanvas.Engines.Hex.Projection', {
		multipliers: {
			height: Math.cos( Math.PI / 6 ) * 2,
			chord : 1/2 // Math.sin( Math.PI / 6 )
		},

		
		initialize: function (settings) {
			settings = this.settings = new Settings({
				baseLength : 0,
				chordLength: null,
				hexHeight  : null,
				start      : new Point(0, 0)
			}).set(settings);

			if (settings.get('chordLength') == null) {
				settings.set({
					chordLength: settings.get('baseLength') * this.multipliers.chord,
					hexHeight  : settings.get('hexHeight' ) * this.multipliers.height
				});
			}
		},

		
		sizes: function (padding) {
			return new this.constructor.Sizes(this, padding);
		},

		
		isZero: function (c) {
			return c[0] === 0 && c[1] === 0 && c[2] === 0;
		},

		
		rgbToPoint: function (coordinates) {
			var
				red      = coordinates[0],
				green    = coordinates[1],
				blue     = coordinates[2],
				settings = this.settings,
				base     = settings.get('baseLength'),
				chord    = settings.get('chordLength'),
				height   = settings.get('hexHeight'),
				start    = settings.get('start');
			if (red + green + blue !== 0) {
				throw new Error( 'Wrong coordinates: ' + red + ' ' + green + ' ' + blue);
			}

			return new Point(
				start.x + (base + chord) * red,
				start.y + (blue - green) * height / 2
			);
		},

		
		pointToRgb: function (point) {
			var
				settings = this.settings,
				base     = settings.get('baseLength'),
				chord    = settings.get('chordLength'),
				height   = settings.get('hexHeight'),
				start    = settings.get('start'),
			// counting coords
				red   = (point.x - start.x) / (base + chord),
				blue  = (point.y - start.y - red * height / 2) / height,
				green = 0 - red - blue;

			var dist = function (c) {
				return Math.abs(c[0] - red) + Math.abs(c[1] - green) + Math.abs(c[2] - blue);
			};

			var
				rF = Math.floor(red  ), rC = Math.ceil(red  ),
				gF = Math.floor(green), gC = Math.ceil(green),
				bF = Math.floor(blue ), bC = Math.ceil(blue );

			return [
				// we need to find closest integer coordinates
				[rF, gF, bF],
				[rF, gC, bF],
				[rF, gF, bC],
				[rF, gC, bC],
				[rC, gF, bF],
				[rC, gC, bF],
				[rC, gF, bC],
				[rC, gC, bC]
			].filter(function (v) {
					// only correct variants - sum must be equals to zero
					return atom.array.sum(v) == 0;
				})
				.sort(function (left, right) {
					// we need coordinates with the smallest distance
					return dist(left) < dist(right) ? -1 : 1;
				})[0];
		},

		
		createPolygon: function (center) {
			var
				settings   = this.settings,
				halfBase   = settings.get('baseLength') / 2,
				halfHeight = settings.get('hexHeight')  / 2,
				radius     = halfBase + settings.get('chordLength'),

				right  = center.x + halfBase,
				left   = center.x - halfBase,
				top    = center.y - halfHeight,
				bottom = center.y + halfHeight;

			return new Polygon([
				new Point(left , top),                  // top-left
				new Point(right, top),                  // top-right
				new Point(center.x + radius, center.y), // right
				new Point(right, bottom),               // bottom-right
				new Point(left , bottom),               // bottom-left
				new Point(center.x - radius, center.y)  // left
			]);
		}
	});

	declare( 'LibCanvas.Engines.Hex.Projection.Sizes', {

		initialize: function (projection, padding) {
			this.projection = projection;
			this.padding    = padding || 0;
			this.centers    = [];
		},

		_limits: null,

		
		add: function (coordinates) {
			this._limits = null;
			this.centers.push(this.projection.rgbToPoint( coordinates ));
			return this;
		},

		
		limits: function () {
			if (this._limits) return this._limits;

			var min, max, centers = this.centers, i = centers.length, c;

			while (i--) {
				c = centers[i];
				if (min == null) {
					min = c.clone();
					max = c.clone();
				} else {
					min.x = Math.min( min.x, c.x );
					min.y = Math.min( min.y, c.y );
					max.x = Math.max( max.x, c.x );
					max.y = Math.max( max.y, c.y );
				}
			}

			return this._limits = { min: min, max: max };
		},

		
		size: function () {
			var
				limits   = this.limits(),
				settings = this.projection.settings,
				base     = settings.get('baseLength'),
				chord    = settings.get('chordLength'),
				height   = settings.get('hexHeight'),
				padding  = this.padding;

			return new Size(
				limits.max.x - limits.min.x + base    + 2 * (padding + chord),
				limits.max.y - limits.min.y + height  + 2 *  padding
			);
		},

		
		center: function () {
			var
				min      = this.limits().min,
				settings = this.projection.settings,
				base     = settings.get('baseLength'),
				chord    = settings.get('chordLength'),
				height   = settings.get('hexHeight'),
				padding  = this.padding;

			return new Point(
				padding + base   /2 + chord - min.x,
				padding + height /2         - min.y
			);
		}


	});

	

	
	LibCanvas.declare( 'LibCanvas.Engines.Isometric', 'IsometricEngine', { });

	

	
	atom.declare( 'LibCanvas.Engines.Isometric.Projection', {

		
		factor: [0.866, 0.5, 0.866],

		
		size: 1,

		
		start: [0, 0],

		
		initialize: function (settings) {
			this.bindMethods([ 'toIsometric', 'to3D' ]);
			this.settings = new Settings(settings);

			this.factor = Point3D( this.settings.get('factor') || this.factor );
			this.size   = Number ( this.settings.get('size')   || this.size   );
			this.start  = Point  ( this.settings.get('start')  || this.start  );
		},

		
		toIsometric: function (point3d) {
			point3d = Point3D( point3d );
			return new Point(
				(point3d.y + point3d.x) * this.factor.x,
				(point3d.y - point3d.x) * this.factor.y - point3d.z * this.factor.z
			)
				.mul(this.size)
				.move(this.start);
		},

		
		to3D: function (point, z) {
			point = Point(point);
			z = Number(z) || 0;

			var
				size  = this.size,
				start = this.start,
				dXY = ((point.y - start.y) / size + z * this.factor.z) / this.factor.y,
				pX  = ((point.x - start.x) / size / this.factor.x - dXY) / 2;

			return new Point3D( pX, pX + dXY, z );
		}
	});

	

	
	var TileEngine = LibCanvas.declare( 'LibCanvas.Engines.Tile', 'TileEngine', {

		
		initialize: function (settings) {
			this.cells   = [];
			this.methods = {};
			this.cellsUpdate = [];

			this.events   = new Events(this);
			this.settings = new Settings(settings).addEvents(this.events);
			this.createMatrix();
		},

		setMethod: atom.core.overloadSetter(function (name, method) {
			if (this.isValidMethod(method)) {
				this.methods[ name ] = method;
			} else {
				throw new TypeError( 'Unknown method: «' + name + '»' );
			}
		}),

		countSize: function () {
			var
				settings   = this.settings,
				cellSize   = settings.get('cellSize'),
				cellMargin = settings.get('cellMargin');

			return new Size(
				(cellSize.x + cellMargin.x) * this.width  - cellMargin.x,
				(cellSize.y + cellMargin.y) * this.height - cellMargin.y
			);
		},

		getCellByIndex: function (point) {
			point = Point.from(point);
			return this.isIndexOutOfBounds(point) ? null:
				this.cells[ this.width * point.y + point.x ];
		},

		getCellByPoint: function (point) {
			var
				settings   = this.settings,
				cellSize   = settings.get('cellSize'),
				cellMargin = settings.get('cellMargin');

			point = Point.from(point);

			return this.getCellByIndex(new Point(
				parseInt(point.x / (cellSize.width  + cellMargin.x)),
				parseInt(point.y / (cellSize.height + cellMargin.y))
			));
		},

		refresh: function (ctx, translate) {
			if (this.requireUpdate) {
				ctx.save();
				if (translate) ctx.translate(translate);
				atom.array.invoke( this.cellsUpdate, 'renderTo', ctx );
				ctx.restore();
				this.cellsUpdate.length = 0;
			}
			return this;
		},

		get width () {
			return this.settings.get('size').width;
		},

		get height () {
			return this.settings.get('size').height;
		},

		get requireUpdate () {
			return !!this.cellsUpdate.length;
		},


		isValidMethod: function (method) {
			var type = typeof method;

			return type == 'function'
				|| type == 'string'
				|| atom.dom.isElement(method);
		},


		createMatrix : function () {
			var x, y,
				settings   = this.settings,
				size       = settings.get('size'),
				value      = settings.get('defaultValue'),
				cellSize   = settings.get('cellSize'),
				cellMargin = settings.get('cellMargin');

			for (y = 0; y < size.height; y++) for (x = 0; x < size.width; x++) {
				this.createMatrixCell(new Point(x, y), cellSize, cellMargin, value);
			}
			return this;
		},


		createMatrixCell: function (point, size, margin, value) {
			var shape = this.createCellRectangle(point, size, margin);

			this.cells.push(this.createCell(point, shape, value));
		},


		createCell: function (point, shape, value) {
			return new TileEngine.Cell( this, point, shape, value );
		},


		createCellRectangle: function (point, cellSize, cellMargin) {
			return new Rectangle({
				from: new Point(
					(cellSize.x + cellMargin.x) * point.x,
					(cellSize.y + cellMargin.y) * point.y
				),
				size: cellSize
			});
		},


		isIndexOutOfBounds: function (point) {
			return point.x < 0 || point.y < 0 || point.x >= this.width || point.y >= this.height;
		},


		updateCell: function (cell) {
			if (!this.requireUpdate) {
				this.events.fire('update', [ this ]);
			}
			atom.array.include( this.cellsUpdate, cell );
			return this;
		}

	});

	
	
	declare( 'LibCanvas.Engines.Tile.Cell', {

		initialize: function (engine, point, rectangle, value) {
			this.engine = engine;
			this.point  = point;
			this.value  = value;
			this.rectangle = rectangle;
		},


		_value: null,

		get value () {
			return this._value;
		},

		set value (value) {
			this._value = value;
			this.engine.updateCell(this);
		},

		renderTo: function (ctx) {
			var method, value = this.value, rectangle = this.rectangle;

			ctx.clear( rectangle );

			if (value == null) return this;

			method = this.engine.methods[ value ];

			if (method == null) {
				throw new Error( 'No method in tile engine: «' + this.value + '»')
			}

			if (atom.dom.isElement(method)) {
				ctx.drawImage( method, rectangle );
			} else if (typeof method == 'function') {
				method.call( this, ctx, this );
			} else {
				ctx.fill( rectangle, method );
			}
			return this;
		}

	});

	
	
	declare( 'LibCanvas.Engines.Tile.Element', App.Element, {
		configure: function () {
			this.shape = new Rectangle(
				this.settings.get('from') || new Point(0, 0),
				this.engine.countSize()
			);
			this.engine.events.add( 'update', this.redraw );
		},

		get engine () {
			return this.settings.get('engine');
		},

		clearPrevious: function () {},

		renderTo: function (ctx) {
			this.engine.refresh(ctx, this.shape.from);
		}
	}).own({
			app: function (app, engine, from) {
				return new this( app.createLayer({
					name: 'tile-engine',
					intersection: 'manual',
					invoke: false
				}), {
					engine: engine,
					from: from
				});
			}
		});



	
	
	declare( 'LibCanvas.Engines.Tile.Mouse', {
		eventsList: 'mousemove mouseout mousedown mouseup contextmenu'
			.split(' '),

		initialize: function (element, mouse) {
			this.bindMethods(this.eventsList);

			this.events   = new Events(this);


			this.mouse    = mouse;

			this.element  = element;

			this.previous = null;

			this.lastDown = null;
			this.subscribe(false);
		},


		subscribe: function (un) {
			var events = atom.object.collect(this, this.eventsList, null);

			this.element.events
				[ un ? 'remove' : 'add' ]
				(events);
		},

		mousemove: function (e) {
			var cell = this.get();
			if (this.previous != cell) {
				this.outCell(e);
				this.fire( 'over', cell, e );
				this.previous = cell;
			}
		},

		mouseout: function (e) {
			this.outCell(e);
		},

		mousedown: function (e) {
			var cell = this.get();
			this.fire( 'down', cell, e );
			this.lastDown = cell;
		},

		mouseup: function (e) {
			var cell = this.get();
			this.fire( 'up', cell, e );
			if (cell != null && cell == this.lastDown) {
				this.fire( 'click', cell, e );
			}
			this.lastDown = null;
		},

		contextmenu: function (e) {
			var cell = this.get();
			if (cell != null) {
				this.fire( 'contextmenu', cell, e );
			}
		},

		get: function () {
			return this.element.engine.getCellByPoint(
				this.mouse.point.clone().move(this.element.shape.from, true)
			);
		},


		fire: function (event, cell, e) {
			return this.events.fire( event, [ cell, e ]);
		},


		outCell: function (e) {
			if (this.previous) {
				this.fire( 'out', this.previous, e );
				this.previous = null;
			}
		}
	});

	

	
	var Animation = LibCanvas.declare( 'LibCanvas.Plugins.Animation', 'Animation', {

		ownStartTime: null,

		timeoutId   : 0,

		synchronizedWith: null,

		initialize: function (settings) {
			this.bindMethods('update');

			this.events = new atom.Events(this);
			this.settings = new atom.Settings(settings).addEvents(this.events);
			this.run();
		},

		stop: function () {
			this.startTime = null;
			return this.update();
		},

		run: function () {
			this.startTime = Date.now();
			return this.update();
		},

		synchronize: function (anim) {
			this.synchronizedWith = anim;
			return this;
		},

		get: function () {
			return this.sheet.get(this.startTime);
		},


		get sheet () {
			return this.settings.get('sheet');
		},


		set sheet (sheet) {
			return this.settings.set('sheet', sheet);
		},


		set startTime (time) {
			this.ownStartTime = time;
		},


		get startTime () {
			if (this.synchronizedWith) {
				return this.synchronizedWith.startTime;
			} else {
				return this.ownStartTime;
			}
		},


		update: function () {
			var delay = this.getDelay();

			clearTimeout(this.timeoutId);

			if (delay == null || this.startTime == null) {
				this.events.fire('stop');
			} else {
				this.timeoutId = setTimeout( this.update, delay );
				this.events.fire('update', [ this.get() ]);
			}
			return this;
		},


		getDelay: function () {
			return this.startTime == null ? null :
				this.sheet.getCurrentDelay(this.startTime);
		}
	});

	

	
	atom.declare( 'LibCanvas.Plugins.Animation.Frames', {

		sprites: [],

		initialize: function (image, width, height) {
			if (image == null) throw new TypeError('`image` cant be null');

			this.sprites = [];
			this.image   = image;
			this.size    = new Size(
				Math.round( width  == null ? image.width  : width  ),
				Math.round( height == null ? image.height : height )
			);

			this.prepare();
		},

		get: function (id) {
			var sprite = this.sprites[id];

			if (!sprite) {
				throw new Error('No sprite with such id: ' + id);
			}

			return sprite;
		},

		get length () {
			return this.sprites.length;
		},


		prepare: function () {
			var x, y,
				im = this.image,
				w  = this.size.width,
				h  = this.size.height;

			for     (y = 0; y <= im.height - h; y += h) {
				for (x = 0; x <= im.width  - w; x += w) {
					this.sprites.push( this.makeSprite(new Point(x, y)) );
				}
			}

			if (!this.length) {
				throw new TypeError('Animation is empty');
			}
		},


		makeSprite: function (from) {
			var
				size = this.size,
				buffer = LibCanvas.buffer(size, true);

			buffer.ctx.drawImage({
				image: this.image,
				draw : buffer.ctx.rectangle,
				crop : new Rectangle(from, size)
			});

			return buffer;
		}
	});

	

	
	atom.declare( 'LibCanvas.Plugins.Animation.Image', {

		initialize: function (animation) {
			this.bindMethods('update');

			if (animation instanceof Animation.Sheet) {
				animation = { sheet: animation };
			}
			if (!(animation instanceof Animation)) {
				animation = new Animation(animation);
			}

			this.buffer    = LibCanvas.buffer(animation.sheet.size, true);
			this.element   = atom.dom(this.buffer);
			this.animation = animation;
			this.element.controller = this;

			animation.events.add( 'update', this.update );
		},


		update: function (image) {
			var ctx = this.buffer.ctx;

			ctx.clearAll();
			if (image) ctx.drawImage(image);
		}
	}).own({
			element: function (animation) {
				return new this(animation).element;
			}
		});

	

	
	atom.declare( 'LibCanvas.Plugins.Animation.Sheet', {

		initialize: function (options) {
			this.frames = options.frames;
			this.delay  = options.delay;
			this.looped = options.looped;
			if (options.sequence == null) {
				this.sequence = atom.array.range(0, this.frames.length - 1);
			} else {
				this.sequence = options.sequence;
			}
		},


		get size () {
			return this.frames.size;
		},


		get: function (startTime) {
			if (startTime == null) return null;

			var id = this.getFrameId(this.countFrames(startTime));
			return id == null ? id : this.frames.get( id );
		},


		getCurrentDelay: function (startTime) {
			var frames, switchTime;

			frames = this.countFrames(startTime);

			if (this.getFrameId(frames) == null) {
				return null;
			}

			// когда был включён текущий кадр
			switchTime = frames * this.delay + startTime;

			// до следующего кадра - задержка минус время, которое уже показывается текущий
			return this.delay - ( Date.now() - switchTime );
		},


		getFrameId: function (framesCount) {
			if (this.looped) {
				return this.sequence[ framesCount % this.sequence.length ];
			} else if (framesCount >= this.sequence.length) {
				return null;
			} else {
				return this.sequence[framesCount];
			}
		},


		countFrames: function (startTime) {
			return Math.floor( (Date.now() - startTime) / this.delay );
		}

	});

	

	
	atom.declare( 'LibCanvas.Plugins.Curve', {

		step: 0.0001,

		initialize: function (data) {
			var Class = this.constructor.classes[data.points.length];

			if (Class) return new Class(data);

			this.setData(data);
		},

		setData: function (data) {
			this.from = data.from;
			this.to   = data.to;
			this.cp   = data.points;
		},

		getAngle: function (t) {
			var f;

			if (t < this.step) {
				f = t - this.step;
			} else {
				f  = t;
				t += this.step;
			}

			return this.getPoint(t).angleTo(this.getPoint(f));
		}

	}).own({
			classes: {},

			addClass: function (points, Class) {
				this.classes[points] = Class;
			}
		});

	

	
	atom.declare( 'LibCanvas.Plugins.Curve.Quadratic', LibCanvas.Plugins.Curve, {

		initialize: function (data) {
			this.setData(data);
		},

		getPoint: function (t) {
			var
				from = this.from,
				to   = this.to,
				point= this.cp[0],
				i    = 1 - t;

			return new Point(
				i*i*from.x + 2*t*i*point.x + t*t*to.x,
				i*i*from.y + 2*t*i*point.y + t*t*to.y
			);
		}

	});

	LibCanvas.Plugins.Curve.addClass(1, LibCanvas.Plugins.Curve.Quadratic);

	

	
	atom.declare( 'LibCanvas.Plugins.Curve.Qubic', LibCanvas.Plugins.Curve, {

		initialize: function (data) {
			this.setData(data);
		},

		getPoint: function (t) {
			var
				from = this.from,
				to   = this.to,
				cp   = this.cp,
				i    = 1 - t;

			return new Point(
				i*i*i*from.x + 3*t*i*i*cp[0].x + 3*t*t*i*cp[1].x + t*t*t*to.x,
				i*i*i*from.y + 3*t*i*i*cp[0].y + 3*t*t*i*cp[1].y + t*t*t*to.y
			);
		}

	});

	LibCanvas.Plugins.Curve.addClass(2, LibCanvas.Plugins.Curve.Qubic);

}).call(typeof window == 'undefined' ? exports : window, atom, Math);