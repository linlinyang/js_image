(function(win,doc){
	var MOUSECURSORMOVE = 2,
		MOUSECURSORNWRESIZE = 11,
		MOUSECURSORWRESIZE = 12,
		MOUSECURSORSWRESIZE = 13,
		MOUSECURSORNRESIZE = 21,
		MOUSECURSORSRESIZE = 22,
		MOUSECURSORNERESIZE = 31,
		MOUSECURSORERESIZE = 32,
		MOUSECURSORSERESIZE = 33,
		MOUSECURSORDEFAULT = 1,
		DOUBLEPI = 2 * Math.PI;

	/*
	* class extend by prototype
	* @params{superClass} Fucntion;The parent class
	*/
	Function.prototype.prototypeExtend = function(superClass){
		if(superClass.prototype){
			function F(){}
			F.prototype = superClass.prototype;
			this.prototype = new F();
			this.prototype.constructor = this;
			if(Object.defineProperty){
				Object.defineProperty(this.prototype,'constructor',{
					enumerable: false
				});
			}
			F = null;
		}
	};

	/*
	* check some value is object or not
	* @params{obj};Inspected object
	* @return Boolean;
	*/
	function isObject(obj){
		return Object.prototype.toString.call(obj) === '[object Object]';
	}

	/*
	* merge one or more object to the first object,just like Object.assign
	* @params{to,...} Object;
	* return Object;
	*/
	function assign(to){
		var len = arguments.length;
		if(len === 0){
			return Object.create(null);
		}

		for(var i = 1; i < len; i++){
			var from = arguments[i];
			if(!isObject(from)){
				continue ;
			}
			var fromKeys = Object.keys(from),
				keyLen = fromKeys.length;
			for(;keyLen--;){
				var tempKey = fromKeys[keyLen];
				to[tempKey] = from[tempKey];
			}
		}

		return to;
	}

	/*
	* call hook function
	*/
	function callhook(target,hook){
		var hookFunc = target._opts[hook];
		if(hookFunc && typeof hookFunc === 'function'){
			hookFunc.call(target);
		}
	}

	/*
	* computed distance of two points
	*/
	function distanceComputed(sx,sy,dx,dy){
		return Math.sqrt(Math.pow(dx - sx,2) + Math.pow(dy - sy,2));
	}

	/*
	* draw rect by direction
	*
	* @params {ctx},CanvasRenderingContext2D;
	* @params {x} Number;The X coordinate
	* @parmas {y} Number;The Y coordinate
	* @params {width} Number;The rect width
	* @params {height} Number;The rect height
	* @params {direction} Boolean;True will be counterclockwise
	*/
	function rect(ctx,x,y,width,height,direction){
		if(!!direction){//counterclockwise
			ctx.moveTo(x,y);
			ctx.lineTo(x,y + height)
			ctx.lineTo(x + width,y + height);
			ctx.lineTo(x + width,y);
		}else{//clockwise
			ctx.rect(x,y,width,height);
		}
		ctx.closePath();
	}

	var uid = 0;

	/*
	* The Croper Class
	* Provide the viewport and handle event as the main function 
	*/
	function Croper(srcOrImg,options){
		this._mergeOptions(options);

		callhook(this,'beforeCreate');

		this._loadImg(srcOrImg,this._init);
		this._uid = ++uid;
	}

	/*
	* merge default options and user privide options
	*/
	Croper.prototype._mergeOptions = function(options){
		assign(this,{
			maxSize: 2000,
			quality: 1,
			type: 'image/png'
		},this._opts = options);
	};

	/*
	* load img for string or image element
	*/
	Croper.prototype._loadImg = function(srcOrImg,callback){
		var that = this,
		image = srcOrImg;
		if(typeof srcOrImg === 'string'){
			try{
				image = new Image();
				image.src = srcOrImg;
			}catch(e){
				throw new Error('Image source ' + srcOrImg + ' cannot found');
			};
		}
		image.setAttribute('crossOrigin','anonymous');
		image.onload = function(){
			var canvas = document.createElement('canvas'),
				ctx = canvas.getContext('2d');
			try{
				ctx.drawImage(this,0,0,0,0);//testing img can be loaded or not
				canvas = ctx = null;

				that._img = this;
				that._imgWidth = this.width;
				that._imgHeight = this.height;
				that.isImgLoaded = true;

				callback && typeof callback === 'function' && callback.call(that);

				image = that = null;
			}catch(e){
				throw e;
			};
		};
	};

	/*
	* init the canvas and draw back img,crop box when the img has been loaded
	*/
	Croper.prototype._init = function(){
		this._limitImage();
		this._initViewport();
		this.drawImage();
		this.drawCropBox(this.cropType);
		this._initEvent();
		callhook(this,'afterCreate');
		this.showCroper();
	};

	/*
	* compress the img proportionally while it width or height longer than the maxSize
	*
	* canvas cannot load img which width or height longer than maxSize by setted
	*/
	Croper.prototype._limitImage = function(){
		var img = this._img,
			width = this._imgWidth,
			height = this._imgHeight,
			maxSize = this.maxSize,
			max = Math.max(width,height);

		if(max > maxSize){
			var ratio = maxSize / max;
			img.width = this._imgWidth = width * ratio;
			img.height = this._imgHeight = height * ratio;
		}

		this._scaleX = 1;
		this._scaleY = 1;
		this._rotateZ = 0;
	};

	/*
	* Init the viewport size by the view element if provided, or the original img size
	*/
	Croper.prototype._initViewport = function(){
		var el = this.el,
			imgWidth = this._imgWidth,
			imgHeight = this._imgHeight,
			width = this.width = imgWidth,
			height = this.height = imgHeight;
		if(typeof el === 'string'){
			try{
				this.el = el = doc.querySelector(el);
			}catch(e){
				throw e;
			}
		}
		if(el && el.clientWidth){
			this.width = width = el.clientWidth;
			this.height = height = el.clientHeight;					
			
			var minRatio = Math.min(width / imgWidth,height / imgHeight);
			if(minRatio < 1){//compress the img proportionally while the img bigger than the view
				this._imgWidth = this._img.width = imgWidth * minRatio;
				this._imgHeight = this._img.height = imgHeight * minRatio;
			}
		}

	};

	/*
	* draw canvas back as viewport
	*/
	Croper.prototype.drawImage = function(){
		var canvas = this.canvas,
			width = this._imgWidth,
			height = this._imgHeight,
			scaleX = this._scaleX,
			scaleY = this._scaleY,
			rotateZ = this._rotateZ;

		if(!canvas){
			this.canvas = canvas = doc.createElement('canvas');
			
			canvas.innerHTML = '浏览器不支持canvas';
			canvas.width = width;
			canvas.height = height;
		}

		var ctx = canvas.getContext('2d');
		ctx.save();
		ctx.clearRect(0,0,width,height);

		ctx.translate((1 - scaleX) * width / 2,(1 - scaleY) * height / 2);
		ctx.scale(scaleX,scaleY);
		ctx.translate(width / 2,height / 2);
		ctx.rotate(30 * Math.PI / 180);
		ctx.translate(-width / 2,-height / 2);

		ctx.drawImage(this._img,0,0,width,height);

		ctx.restore();
	};

	/*
	* append this viewport to the view provided
	*/
	Croper.prototype.showCroper = function(){
		var canvas = this.canvas,
			el = this.el;

		if(el && el.firstElementChild){
			el.removeChild(el.firstElementChild);
		}
		el && el.appendChild && el.appendChild(canvas);
	};

	/*
	* draw the crop box
	*/
	Croper.prototype.drawCropBox = function(type){
		type = String(type).toLowerCase();
		var cropBox,
			cropBoxOpts = {
				canvas: this.canvas,
				cwidth: this._imgWidth,
				cheight: this._imgHeight,
				type: this.type,
				quality: this.quality,
				_img: this._img,
				resizable: this.resizable
			};
		switch(type){
			case 'circle'://draw the cricle crop box
				cropBox = new CircleCropBox(cropBoxOpts);
				break;
			default://draw the rect crop box
				cropBox = new CropBox(cropBoxOpts);
		}

		this._cropBox = cropBox;
		cropBox._parent = this;
	};

	/*
	* add event listeners on this canvas
	*/
	Croper.prototype._initEvent = function(){
		var canvas = this.canvas;

		canvas.addEventListener('mousedown',this._beginDrag.bind(this),false);
		canvas.addEventListener('mousemove',this._dragging.bind(this),false);
		canvas.addEventListener('mouseup',this._endDrag.bind(this),false);

		var tempDiv = document.createElement('div'),
			mouseWheelEvent = 'onwheel' in tempDiv
								? 'wheel'
								: doc.onmousewheel !== undefined
									? 'mousewheel'
									: 'DOMMouseScroll';
		tempDiv = null;
		canvas.addEventListener(mouseWheelEvent,this._scroll.bind(this),false);
		mouseWheelEvent = undefined;
	};

	/*
	* before drag 
	*/
	Croper.prototype._beginDrag = function(e){
		var cropBox = this._cropBox;
		callhook(this,'beforeDrag');
		cropBox.beforeDrag && cropBox.beforeDrag.call(cropBox,e.offsetX,e.offsetY);
	};

	/*
	* dragging
	*/
	Croper.prototype._dragging = function(e){
		var cropBox = this._cropBox;
		callhook(this,'dragging');
		cropBox.dragging && cropBox.dragging.call(cropBox,e.offsetX,e.offsetY);
	};

	/*
	* after dragging
	*/
	Croper.prototype._endDrag = function(e){
		var cropBox = this._cropBox;
		callhook(this,'endDrag');
		cropBox.endDrag && cropBox.endDrag.call(cropBox,e.offsetX,e.offsetY);
	};

	Croper.prototype._scroll = function(e){
		var type = e.type,
			wheelDelta = e.wheelDelta
							? e.wheelDelta / -120
							: e.deltaY
								? e.deltaY / 3
								: e.detail / 3;

		if(wheelDelta === -1){//scroll up
			this._scaleX = Math.max(0.5,this._scaleX - 0.1); 
			this._scaleY = Math.max(0.5,this._scaleY - 0.1); 

		}else if(wheelDelta === 1){//scroll down
			this._scaleX = Math.min(3,this._scaleX + 0.1);
			this._scaleY = Math.min(3,this._scaleY + 0.1);
		}
		
		this.drawImage();
		this._cropBox.draw();
	};

	/*
	* cut the crop box selectd area and return it as img base64
	* @return String {base64}
	*/
	Croper.prototype.cut = function(){
		return this._cropBox.cut();
	};

	/*
	* destroy this cropper object
	*/
	Croper.prototype.destroy = function(){
		console.log('destory');
	};

	/*
	* The crop box Class
	* draw the select shape,drag to select area,and cut it
	*/
	function CropBox(options){
		assign(this,{
			strokeStyle: '#39f',
			resizable: false,
			dashStyle: 'rgba(254,254,254,0.3)',
			fillStyle: '#39f',
			dotSize: 5
		},options);

		this._beikCanvas();

		this._init();

		this.draw();
	}

	/*
	* save this origin canvas draw by img, no crop box for cut it
	*/
	CropBox.prototype._beikCanvas = function(){
		var img = this._img,
			width = this.cwidth,
			height = this.cheight,
			canvas = document.createElement('canvas'),
			ctx = canvas.getContext('2d');

		canvas.width = width;
		canvas.height = height;
		canvas.mozImageSmoothingEnabled = false;
	    canvas.webkitImageSmoothingEnabled = false;
	    canvas.msImageSmoothingEnabled = false;
	    canvas.imageSmoothingEnabled = false;

		ctx.clearRect(0,0,width,height);
		ctx.drawImage(img,0,0,width,height);

		this.beikCanvas = canvas;
	};

	/*
	* init crop box's width,height,x coordinate and y coordinate
	*/
	CropBox.prototype._init = function(){
		var canvasWidth = this.cwidth,
			canvasHeight = this.cheight,
			size = Math.min(canvasWidth,canvasHeight),
			width = this.width,
			height = this.height,
			x = this.x,
			y = this.y;

		//set the half of which the minimum value in canvans's width and height as this cropx box size by default
		this.width = width = width ? width : size / 2;
		this.height = height = height ? height : size / 2;
		this.x = x === undefined ? (canvasWidth - width) / 2 : x;
		this.y = y === undefined ? (canvasHeight - height) / 2 : y;

	};

	CropBox.prototype.draw = function(x,y){
		var canvasWidth = this.cwidth,
			canvasHeight = this.cheight,
			width = this.width,
			height = this.height;
		this.x = x = Math.min(Math.max(x === undefined ? this.x : x,0),canvasWidth - width - 1);
		this.y = y = Math.min(Math.max(y === undefined ? this.y : y,0),canvasHeight - height - 1);

		this.drawShadow(x,y);
		this.drawContent(x,y);
	};

	CropBox.prototype.drawShadow = function(x,y){
		var canvas = this.canvas,
			ctx = canvas.getContext('2d'),
			width = this.width,
			height = this.height,
			canvasWidth = this.cwidth,
			canvasHeight = this.cheight;

		ctx.fillStyle = 'rgba(0,0,0,0.4)';
		ctx.beginPath();
		rect(ctx,0,0,canvasWidth,canvasHeight);
		rect(ctx,x,y,width,height,true);
		ctx.fill();

	}

	CropBox.prototype.drawContent = function(x,y){
		var canvas = this.canvas,
			ctx = canvas.getContext('2d'),
			width = this.width,
			height = this.height,
			strokeStyle = this.strokeStyle;

		drawGrid(ctx,x,y,width,height,strokeStyle,this.dashStyle);
		this.resizable && addDotsOnGrid(ctx,x,y,width,height,Math.max(this.dotSize,1),this.fillStyle);

	};

	function drawGrid(ctx,x,y,width,height,strokeStyle,dashStyle){
		/*
		* canvas has bugs on draw 1px line,fixed it by covert coordinate
		* @example 
		*  (10,20) => (10.5,20.5)
		*  (10.3,20.7) => (10.5,20.5)
		*/
		ctx.beginPath();
		ctx.lineWidth = 1;
		ctx.strokeStyle = strokeStyle;
		ctx.rect(
			covertNumToHalf(x),
			covertNumToHalf(y),
			width,
			height
		);//Draw the crop box grid
		ctx.stroke();

		/*
		* Draw two dashes in each of the horizontal and vertical directions
		*/
		drawDashLine(
			ctx,
			covertNumToHalf(x + width / 3),
			covertNumToHalf(y),
			covertNumToHalf(x + width / 3),
			covertNumToHalf(y + height),
			dashStyle
		);
		drawDashLine(
			ctx,
			covertNumToHalf(x + (width / 3) * 2),
			covertNumToHalf(y),
			covertNumToHalf(x + (width / 3) * 2),
			covertNumToHalf(y + height),
			dashStyle
		);
		drawDashLine(
			ctx,
			covertNumToHalf(x),
			covertNumToHalf(y + height / 3),
			covertNumToHalf(x + width),
			covertNumToHalf(y + height / 3),
			dashStyle
		);
		drawDashLine(
			ctx,
			covertNumToHalf(x),
			covertNumToHalf(y + (height / 3) * 2),
			covertNumToHalf(x + width),
			covertNumToHalf(y + (height / 3) * 2),
			dashStyle
		);
		/*end of draw dashes*/
	}

	function drawDashLine(ctx,sx,sy,dx,dy,strokeStyle,dashLength){
		dashLength = dashLength || 3;

		var distance = distanceComputed(sx,sy,dx,dy),
			totalDots = Math.floor(distance / dashLength);
		ctx.beginPath();
		ctx.strokeStyle = strokeStyle || 'rgba(254,254,254,0.3)';

		for(var i = 0; i < totalDots; i++){
			var x = sx + ((dx - sx) / totalDots) * i,
				y = sy + ((dy - sy) / totalDots) * i;

			ctx[(i & 1) ? 'lineTo' : 'moveTo'](x,y);
		}

		ctx.stroke();
	}

	function covertNumToHalf(num){
		num = Number(num);

		return parseInt(num) + 0.5;
	}

	/*
	* draw dots on the grid for resize it
	*/
	function addDotsOnGrid(ctx,x,y,width,height,dotSize,fillStyle){
		dotSize = dotSize || 5;
		ctx.fillStyle = fillStyle || '#39f';

		drawFillRect(ctx,x,y,dotSize);//left top  dot
		drawFillRect(ctx,x + width / 2,y,dotSize);//center top dot
		drawFillRect(ctx,x + width,y,dotSize);//right top dot

		drawFillRect(ctx,x,y + height / 2,dotSize);//left middle dot
		drawFillRect(ctx,x + width,y + height / 2,dotSize);//right middle dot

		drawFillRect(ctx,x,y + height,dotSize);//right top dot
		drawFillRect(ctx,x + width / 2,y + height,dotSize);//right middle dot
		drawFillRect(ctx,x + width,y + height,dotSize);//right bottom dot
	}

	/*
	* draw rect by x,y,width,height and fill it
	*/
	function drawFillRect(ctx,x,y,size){
		ctx.beginPath();
		ctx.rect(x - size / 2,y - size / 2,size,size);
		ctx.fill();
	}

	CropBox.prototype.beforeDrag = function(x,y){
		this._distanceX = x - this.x;
		this._distanceY = y - this.y;
		this._hoverStatus = this.mouseWheelPositioning(x,y);
	};
	CropBox.prototype.dragging = function(x,y){
		var canvas = this.canvas,
			startX = this.x,
			startY = this.y,
			width = this.width,
			height = this.height,
			status = this._hoverStatus;

		this.mouseWheelPositioning(x,y);

		if(!status || status == MOUSECURSORDEFAULT){return;}

		this._parent.drawImage();
		switch(status){
			case MOUSECURSORNWRESIZE://draw on left top
				this.width = width - (x - startX);
				this.height = height - (y - startY);
				this.draw(x,y);
				break ;
			case MOUSECURSORWRESIZE://drag on left center
				this.width = width - (x - startX);
				this.draw(x,startY);
				break ;
			case MOUSECURSORSWRESIZE://drag on left bottom
				this.width = width - (x - startX);
				this.height = height + (y - startY - height);
				this.draw(x,startY);
				break ;
			case MOUSECURSORNRESIZE://drag on center top
				this.height = height - (y - startY);
				this.draw(startX,y);
				break ;
			case MOUSECURSORSRESIZE://drag on center bottom
				this.height = height + (y - startY - height);
				this.draw(startX,startY);
				break ;
			case MOUSECURSORNERESIZE://drag on right top
				this.width = width + (x - startX - width);
				this.height = height + (startY - y);
				this.draw(startX,y);
				break ;
			case MOUSECURSORERESIZE://drag on right center
				this.width = width + (x - startX - width);
				this.draw(startX,startY);
				break ;
			case MOUSECURSORSERESIZE://drag on right bottom
				this.width = width + (x - startX - width);
				this.height = height + (y - startY - height);
				this.draw(startX,startY);
				break ;
			default ://drag by move
				this.draw(x - this._distanceX,y - this._distanceY);
		}

	};
	CropBox.prototype.endDrag = function(x,y){
		this._hoverStatus = null;
		this.mouseWheelPositioning(x,y);
		try{
			delete this._distanceX;
			delete this._distanceY;
			delete this._hoverStatus;
		}catch(e){
			throw e;
		};
	};

	CropBox.prototype.mouseWheelPositioning = function(x,y){
		var canvas = this.canvas,
			startX = this.x,
			startY = this.y,
			width = this.width,
			height = this.height,
			resizable = this.resizable,
			dotSize = this.dotSize;

		if(!resizable){//cropbox cannot resizing
			if(
				x < startX
				|| x > startX + width
				|| y < startY
				|| y > startY + height
			){//outer of cropbox
				canvas.style.cursor = 'default';
				return MOUSECURSORDEFAULT;
			}else{//inner of cropbox
				canvas.style.cursor = 'move';
				return MOUSECURSORMOVE;
			}
		}

		/*cropbox is resizable*/
		startX -= dotSize / 2;
		startY -= dotSize / 2;

		if(
			x < startX
			|| x > (startX + width + dotSize)
			|| y < startY
			|| y > (startY + height + dotSize)
		){//outer of cropbox
			canvas.style.cursor = 'default';
			return MOUSECURSORDEFAULT;
		}else if(x < startX + dotSize){
			if(y < startY + dotSize){//left top
				canvas.style.cursor = 'nw-resize';
				return MOUSECURSORNWRESIZE;
			}
			if(y < startY + height - dotSize){//left center
				canvas.style.cursor = 'w-resize';
				return MOUSECURSORWRESIZE;
			}
			//left bottom
			canvas.style.cursor = 'sw-resize';
			return MOUSECURSORSWRESIZE;
		}else if(
			x >= startX + dotSize
			&& x <= (startX + width - dotSize)
		){
			if(y < startY + dotSize){//center top
				canvas.style.cursor = 'n-resize';
				return MOUSECURSORNRESIZE;
			}
			if(y <= startY + height - dotSize){//center middle
				canvas.style.cursor = 'move';
				return MOUSECURSORMOVE;
			}
			//center bottom
			canvas.style.cursor = 's-resize';
			return MOUSECURSORSRESIZE;
		}else if(x > startX + width - dotSize){
			if(y < startY + dotSize){//right top
				canvas.style.cursor = 'ne-resize';
				return MOUSECURSORNERESIZE;
			}
			if(y <= startY + height - dotSize){//right middle
				canvas.style.cursor = 'e-resize';
				return MOUSECURSORERESIZE;
			}
			//right bottom
			canvas.style.cursor = 'se-resize';
			return MOUSECURSORSERESIZE;
		}

	};

	CropBox.prototype.cut = function(){
		var x = this.x,
			y = this.y,
			width = this.width,
			height = this.height,
			beikCanvas = this.beikCanvas,
			resCanvas = document.createElement('canvas'),
			resCtx = resCanvas.getContext('2d');

		resCanvas.width = width;
		resCanvas.height = height;
		resCtx.mozImageSmoothingEnabled = false;
	    resCtx.webkitImageSmoothingEnabled = false;
	    resCtx.msImageSmoothingEnabled = false;
	    resCtx.imageSmoothingEnabled = false;

		resCtx.clearRect(0,0,width,height);
		resCtx.drawImage(beikCanvas,x,y,width,height,0,0,width,height);

		return resCanvas.toDataURL(this.type,this.quality);
	};

	function CircleCropBox(options){
		CropBox.call(this,options);
	}
	CircleCropBox.prototypeExtend(CropBox);

	CircleCropBox.prototype._init = function(){
		var canvasWidth = this.cwidth,
			canvasHeight = this.cheight,
			size = Math.min(canvasWidth,canvasHeight),
			radius = this.radius,
			x = this.x,
			y = this.y;

		this.radius = radius = Math.min(radius ? radius : size / 4,size / 2);
		this.x = x === undefined ? (canvasWidth - 2 * radius) / 2 : x;
		this.y = y === undefined ? (canvasHeight - 2 * radius) / 2 : y;

	};
	CircleCropBox.prototype.draw = function(x,y){
		var canvasWidth = this.cwidth,
			canvasHeight = this.cheight,
			radius = this.radius;
		this.x = x = Math.min(Math.max(x === undefined ? this.x : x,0),canvasWidth - 2 * radius);
		this.y = y = Math.min(Math.max(y === undefined ? this.y : y,0),canvasHeight - 2 * radius);

		this.drawShadow(x,y);
		this.drawContent(x,y);
	};

	CircleCropBox.prototype.drawShadow = function(x,y){
		var canvas = this.canvas,
			ctx = canvas.getContext('2d'),
			radius = this.radius,
			canvasWidth = this.cwidth,
			canvasHeight = this.cheight;

		ctx.fillStyle = 'rgba(0,0,0,0.4)';
		ctx.beginPath();
		ctx.rect(0,0,canvasWidth,canvasHeight);
		ctx.arc(x + radius,y + radius,radius,0,DOUBLEPI,true);
		ctx.fill();
	};

	CircleCropBox.prototype.drawContent = function(x,y){
		var canvas = this.canvas,
			ctx = canvas.getContext('2d'),
			radius = this.radius,
			strokeStyle = this.strokeStyle;

		drawCircleBox(ctx,x,y,radius,strokeStyle,this.dashStyle);
		this.resizable && addDotsOnCircle(ctx,x,y,radius,Math.max(this.dotSize,1),this.fillStyle);
	};

	function drawCircleBox(ctx,x,y,radius,strokeStyle,dashStyle){
		ctx.beginPath();
		ctx.strokeStyle = strokeStyle;
		ctx.arc(x + radius,y + radius,radius,0,DOUBLEPI);
		ctx.stroke();

		drawDashLine(
			ctx,
			covertNumToHalf(x + radius),
			covertNumToHalf(y),
			covertNumToHalf(x + radius),
			covertNumToHalf(y + radius * 2),
			dashStyle
		);

		drawDashLine(
			ctx,
			covertNumToHalf(x),
			covertNumToHalf(y + radius),
			covertNumToHalf(x + radius * 2),
			covertNumToHalf(y + radius),
			dashStyle
		);
	}

	function addDotsOnCircle(ctx,x,y,radius,dotSize,fillStyle){
		ctx.fillStyle = fillStyle;
		dotSize = dotSize || 5;

		drawFillRect(ctx,x + radius,y,dotSize);
		drawFillRect(ctx,x + 2 * radius,y + radius,dotSize);
		drawFillRect(ctx,x + radius,y + 2 * radius,dotSize);
		drawFillRect(ctx,x,y + radius,dotSize);
	}

	CircleCropBox.prototype.mouseWheelPositioning = function(x,y){
		var canvas = this.canvas,
			startX = this.x,
			startY = this.y,
			radius = this.radius,
			resizable = this.resizable,
			dotSize = this.dotSize;

		if(resizable){	

			if(
				x >= startX - dotSize / 2
				&& x <= startX + dotSize / 2
				&& y >= startY + radius - dotSize / 2
				&& y <= startY + radius + dotSize / 2
			){
				canvas.style.cursor = 'w-resize';
				return MOUSECURSORWRESIZE;
			}

			if(
				x >= startX + radius - dotSize / 2
				&& x <= startX + radius + dotSize / 2
				&& y >= startY - dotSize / 2
				&& y <= startY + dotSize / 2
			){
				canvas.style.cursor = 'n-resize';
				return MOUSECURSORNRESIZE;
			}

			if(
				x >= startX + radius - dotSize / 2
				&& x <= startX + radius + dotSize / 2
				&& y >= startY + 2 * radius - dotSize / 2
				&& y <= startY + 2 * radius + dotSize / 2
			){
				canvas.style.cursor = 's-resize';
				return MOUSECURSORSRESIZE;
			}

			if(
				x >= startX + 2 * radius - dotSize / 2
				&& x <= startX + 2 * radius + dotSize / 2
				&& y >= startY + radius - dotSize / 2
				&& y <= startY + radius + dotSize / 2
			){
				canvas.style.cursor = 'e-resize';
				return MOUSECURSORERESIZE;
			}

		}

		//move center from left top to center
		startX += radius;
		startY += radius;
		if(distanceComputed(startX,startY,x,y) > radius){
			canvas.style.cursor = 'default';
			return MOUSECURSORDEFAULT;
		}else{
			canvas.style.cursor = 'move';
			return MOUSECURSORMOVE;
		}

	};

	CircleCropBox.prototype.dragging = function(x,y){
		var canvas = this.canvas,
			startX = this.x,
			startY = this.y,
			radius = this.radius,
			status = this._hoverStatus,
			diameter = 2 * radius;

		this.mouseWheelPositioning(x,y);

		if(!status || status == MOUSECURSORDEFAULT){return;}

		this._parent.drawImage();
		switch(status){
			case MOUSECURSORWRESIZE://drag on left center
				this.radius = radius - (x - startX) / 2;
				this.draw(x,startY + (x - startX) / 2);
				break ;
			case MOUSECURSORNRESIZE://drag on center top
				this.radius = radius - (y - startY) / 2;
				this.draw(startX + (y - startY) / 2,y);
				break ;
			case MOUSECURSORSRESIZE://drag on center bottom
				this.radius = radius + (y - startY - diameter) / 2;
				this.draw(startX - (y - startY - diameter) / 2,startY);
				break ;
			case MOUSECURSORERESIZE://drag on right center
				this.radius = radius + (x - startX - diameter) / 2;
				this.draw(startX,startY - (x - startX - diameter) / 2);
				break ;
			default ://drag by move
				this.draw(x - this._distanceX,y - this._distanceY);
		}

	};

	CircleCropBox.prototype.cut = function(){
		var x = this.x,
			y = this.y,
			radius = this.radius,
			diameter = 2 * radius,
			beikCanvas = this.beikCanvas,
			resCanvas = document.createElement('canvas'),
			resCtx = resCanvas.getContext('2d');

		resCanvas.width = diameter;
		resCanvas.height = diameter;
		resCtx.mozImageSmoothingEnabled = false;
	    resCtx.webkitImageSmoothingEnabled = false;
	    resCtx.msImageSmoothingEnabled = false;
	    resCtx.imageSmoothingEnabled = false;

		resCtx.clearRect(0,0,diameter,diameter);
		resCtx.arc(radius,radius,radius,0,DOUBLEPI);
		resCtx.clip();
		resCtx.drawImage(beikCanvas,x,y,diameter,diameter,0,0,diameter,diameter);

		return resCanvas.toDataURL('image/png',this.quality);
	};


	function jCrop(srcOrImg,options){
		return new Croper(srcOrImg,options);
	}
	win.jCrop = jCrop;

})(window,document);