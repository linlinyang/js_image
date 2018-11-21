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

	var tempDiv = document.createElement('div'),
		MOUSEWHEELEVENT = 'onwheel' in tempDiv
							? 'wheel'
							: doc.onmousewheel !== undefined
								? 'mousewheel'
								: 'DOMMouseScroll';
	tempDiv = null;

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

	function cloneCanvas(oldCanvas){
		var newCanvas = document.createElement('canvas'),
			context = newCanvas.getContext('2d');

		newCanvas.width = oldCanvas.width;
		newCanvas.height = oldCanvas.height;

		context.mozImageSmoothingEnabled = false;
	    context.webkitImageSmoothingEnabled = false;
	    context.msImageSmoothingEnabled = false;
	    context.imageSmoothingEnabled = false;
		context.drawImage(oldCanvas,0,0);

		return newCanvas;
	}

	var uid = 0;

	/*
	* The Croper Class
	* Provide the viewport and handle event as the main function 
	*/
	function Croper(srcOrImg,options){
		assign(this,{
			_maxSize: 2000,
			quality: 1,
			type: 'image/png'
		},this._opts = options);

		callhook(this,'beforeCreate');

		this._loadImg(srcOrImg,this._init);
		this._uid = ++uid;
	}

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
				throw e;
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
		this._checkImageSize();

		this.reset();

		callhook(this,'afterCreate');
	};

	/*
	* compress the img proportionally while it width or height longer than the maxSize
	*
	* canvas cannot load img which width or height longer than maxSize by setted
	*/
	Croper.prototype._checkImageSize = function(){
		var img = this._img,
			imgWidth = this._imgWidth,
			imgHeight = this._imgHeight,
			maxSize = this._maxSize,
			max = Math.max(imgWidth,imgHeight);

		if(max > maxSize){
			var ratio = maxSize / max;
			img.width = this._imgWidth = imgWidth * ratio;
			img.height = this._imgHeight = imgHeight * ratio;
		}
	};

	/*
	* Init the viewport size by the view element if provided, or the img img size
	*/
	Croper.prototype._checkCropperSize = function(){
		var el = this.el,
			originWidth = this._imgWidth,
			originHeight = this._imgHeight;

		this.clientWidth = originWidth;
		this.clientHeight = originHeight;

		if(typeof el === 'string'){
			try{
				this.el = el = doc.querySelector(el);
			}catch(e){
				throw e;
			}
		}
		if(el && el.clientWidth){
			var clientWidth = el.clientWidth,
				clientHeight = el.clientHeight,
				minRatio = Math.max(originWidth / clientWidth,originHeight / clientHeight);
			if(minRatio > 1){//compress the img proportionally while the img bigger than the view
				this.clientWidth = this._img.width = originWidth / minRatio;
				this.clientHeight = this._img.height = originHeight / minRatio;
			}
		}

	};

	Croper.prototype.reset = function(){
		this._checkCropperSize();//reset viewport box size

		//reset transform status
		this.scaleX = 1;
		this.scaleY = 1;
		this.rotateZ = 0;

		this._installViewport();

		this._redraw();
		this.showCroper();
	};

	Croper.prototype._installViewport = function(){
		var width = this.clientWidth,
			height = this.clientHeight,
			canvas = this.canvas = doc.createElement('canvas');

		canvas.innerHTML = '浏览器不支持canvas';
		canvas.width = width;
		canvas.height = height;

		this._installCropBox(this.cropType);
		this._initEvent();
	};

	Croper.prototype._redraw = function(){
		var canvas = this.canvas,
			width = this.clientWidth,
			height = this.clientHeight,
			scaleX = this.scaleX,
			scaleY = this.scaleY,
			rotateZ = this.rotateZ;

		var ctx = canvas.getContext('2d');
		ctx.save();
		ctx.clearRect(0,0,width,height);

		ctx.translate((1 - scaleX) * width / 2,(1 - scaleY) * height / 2);
		ctx.scale(scaleX,scaleY);
		ctx.translate(width / 2,height / 2);
		ctx.rotate(rotateZ * Math.PI / 180);
		ctx.translate(-width / 2,-height / 2);

		ctx.drawImage(this._img,0,0,width,height);

		ctx.restore();

		this._beikCanvas = cloneCanvas(canvas);

		this._cropBox && this._cropBox._redraw();
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
	Croper.prototype._installCropBox = function(cropType){
		var cropBox = this._cropBox;

		cropType = String(cropType).toLowerCase();
		var cropBoxOpts = assign(this._opts,{
				canvas: this.canvas,
				croperWidth: this.clientWidth,
				croperHeight: this.clientHeight,
				type: this.type,
				quality: this.quality,
				resizable: this.resizable
			});
		switch(cropType){
			case 'circle'://draw the cricle crop box
				cropBox = new CircleCropBox(cropBoxOpts);
				break;
			default://draw the rect crop box
				cropBox = new CropBox(cropBoxOpts);
		}

		this._cropBox = cropBox;
		cropBox._parent = this;

		cropBox.reset();
	};

	/*
	* rotate this viewport image
	*/
	Croper.prototype.rotate = function(deg){
		this.rotateZ = parseFloat(deg);

		this._redraw();
	};

	/*
	* scale this viewport image
	*/
	Croper.prototype.scale = function(scaleX,scaleY){
		this.scaleX = Math.min(Math.max(parseFloat(scaleX),0.5),3);
		this.scaleY = Math.min(Math.max(parseFloat(scaleY),0.5),3);

		this._redraw();
	};

	/*
	* add event listener on this canvas
	*/
	Croper.prototype.on = function(event,handle,isBobble){
		var canvas = this.canvas,
			cacheEvents = this._cacheEvents || [];

		cacheEvents.push({
			type: event,
			handle: handle,
			isBobble: !!isBobble
		});
		
		canvas.addEventListener(event,handle,!!isBobble);
		this._cacheEvents = cacheEvents;
	};

	/*
	* remove event listener from this canvas
	*/
	Croper.prototype.off = function(event,handle,isBobble){
		var canvas = this.canvas,
			cacheEvents = this._cacheEvents,
			len = cacheEvents.length;

		while(len--){
			var tempEvent = cacheEvents[len],
				type = tempEvent.type,
				curHandle = tempEvent.handle,
				curIsBobble = tempEvent.isBobble;

			if(
				(//remove one event listener
					type == event
					&& curHandle == handle
					&& curIsBobble == isBobble
				)
				|| !arguments.length//remove all event listener
			){
				canvas.removeEventListener(type,curHandle,curIsBobble);
			}
		}
	}

	/*
	* add event listeners on this canvas
	*/
	Croper.prototype._initEvent = function(){
		var canvas = this.canvas;

		this.on('mousedown',this._beginDrag.bind(this));
		this.on('mousemove',this._dragging.bind(this));
		this.on('mouseup',this._endDrag.bind(this));
		this.on(MOUSEWHEELEVENT,this._scroll.bind(this));
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
			this.scale(this.scaleX - 0.1,this.scaleY - 0.1)
		}else if(wheelDelta === 1){//scroll down
			this.scale(this.scaleX + 0.1,this.scaleY + 0.1);
		}
		
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
		this._cropBox && this._cropBox.destroy();
		this._cropBox = null;

		this.off();

		var el = this.el;
		el && el.removeChild(this.canvas);

		this._cacheEvents = null;
		this.canvas = null;
	};

	/*
	* The crop box Class
	* draw the select shape,drag to select area,and cut it
	*/
	function CropBox(options){
		assign(this,{
			shadowStyle: 'rgba(0,0,0,0.4)',
			lineStyle: '#39f',
			resizable: false,
			dashLineStyle: 'rgba(254,254,254,0.3)',
			resizeDotStyle: '#39f',
			dotSize: 5
		},options);
	}

	/*
	* reset width,height,x and y for the cropbox
	*/
	CropBox.prototype.reset = function(){
		var croperWidth = this.croperWidth,
			croperHeight = this.croperHeight,
			minimumLength = Math.min(croperWidth,croperHeight),
			cropBoxWidth = this.cropBoxWidth,
			cropBoxHeight = this.cropBoxHeight,
			width,height;

		this.width = width = cropBoxWidth ? cropBoxWidth : minimumLength / 2;
		this.height = height = cropBoxHeight ? cropBoxHeight : minimumLength / 2;
		this.x = (croperWidth - width) / 2;
		this.y = (croperHeight - height) / 2;
	};

	CropBox.prototype._redraw = function(){
		var croperWidth = this.croperWidth,
			croperHeight = this.croperHeight,
			width = this.width,
			height = this.height,
			x = this.x,
			y = this.y;

		x = Math.min(Math.max(x),croperWidth - width - 1);
		y = Math.min(Math.max(y),croperHeight - height - 1);

		this.drawShadow(x,y);
		this.drawContent(x,y);
		this._updateProperty();
	};

	CropBox.prototype.drawShadow = function(x,y){
		var canvas = this.canvas,
			ctx = canvas.getContext('2d'),
			width = this.width,
			height = this.height,
			croperWidth = this.croperWidth,
			croperHeight = this.croperHeight;

		ctx.save();

		ctx.fillStyle = this.shadowStyle;
		ctx.beginPath();
		rect(ctx,0,0,croperWidth,croperHeight);
		rect(ctx,x,y,width,height,true);
		ctx.closePath();
		ctx.fill();

		ctx.restore();
	}

	CropBox.prototype.drawContent = function(x,y){
		var canvas = this.canvas,
			ctx = canvas.getContext('2d'),
			width = this.width,
			height = this.height,
			lineStyle = this.lineStyle;

		drawGrid(ctx,x,y,width,height,lineStyle,this.dashLineStyle);
		this.resizable && addDotsOnGrid(ctx,x,y,width,height,Math.max(this.dotSize,1),this.resizeDotStyle);
	};

	function drawGrid(ctx,x,y,width,height,lineStyle,dashLineStyle){
		/*
		* canvas has bugs on draw 1px line,fixed it by covert coordinate
		* @example 
		*  (10,20) => (10.5,20.5)
		*  (10.3,20.7) => (10.5,20.5)
		*/
		ctx.save();

		ctx.beginPath();
		ctx.lineWidth = 1;
		ctx.strokeStyle = lineStyle;
		ctx.rect(
			covertNumToHalf(x),
			covertNumToHalf(y),
			width,
			height
		);//Draw the crop box grid
		ctx.stroke();

		ctx.restore();

		/*
		* Draw two dashes in each of the horizontal and vertical directions
		*/
		drawDashLine(
			ctx,
			covertNumToHalf(x + width / 3),
			covertNumToHalf(y),
			covertNumToHalf(x + width / 3),
			covertNumToHalf(y + height),
			dashLineStyle
		);
		drawDashLine(
			ctx,
			covertNumToHalf(x + (width / 3) * 2),
			covertNumToHalf(y),
			covertNumToHalf(x + (width / 3) * 2),
			covertNumToHalf(y + height),
			dashLineStyle
		);
		drawDashLine(
			ctx,
			covertNumToHalf(x),
			covertNumToHalf(y + height / 3),
			covertNumToHalf(x + width),
			covertNumToHalf(y + height / 3),
			dashLineStyle
		);
		drawDashLine(
			ctx,
			covertNumToHalf(x),
			covertNumToHalf(y + (height / 3) * 2),
			covertNumToHalf(x + width),
			covertNumToHalf(y + (height / 3) * 2),
			dashLineStyle
		);
		/*end of draw dashes*/
	}

	function drawDashLine(ctx,sx,sy,dx,dy,strokeStyle,dashLength){
		dashLength = dashLength || 3;

		var distance = distanceComputed(sx,sy,dx,dy),
			totalDots = Math.floor(distance / dashLength);

		ctx.save();

		ctx.beginPath();
		ctx.strokeStyle = strokeStyle;

		for(var i = 0; i < totalDots; i++){
			var x = sx + ((dx - sx) / totalDots) * i,
				y = sy + ((dy - sy) / totalDots) * i;

			ctx[(i & 1) ? 'lineTo' : 'moveTo'](x,y);
		}

		ctx.stroke();

		ctx.restore();
	}

	function covertNumToHalf(num){
		num = Number(num);

		return parseInt(num) + 0.5;
	}

	/*
	* draw dots on the grid for resize it
	*/
	function addDotsOnGrid(ctx,x,y,width,height,dotSize,resizeDotStyle){
		dotSize = dotSize || 5;

		ctx.save();

		ctx.fillStyle = resizeDotStyle;

		drawFillRect(ctx,x,y,dotSize);//left top  dot
		drawFillRect(ctx,x + width / 2,y,dotSize);//center top dot
		drawFillRect(ctx,x + width,y,dotSize);//right top dot

		drawFillRect(ctx,x,y + height / 2,dotSize);//left middle dot
		drawFillRect(ctx,x + width,y + height / 2,dotSize);//right middle dot

		drawFillRect(ctx,x,y + height,dotSize);//right top dot
		drawFillRect(ctx,x + width / 2,y + height,dotSize);//right middle dot
		drawFillRect(ctx,x + width,y + height,dotSize);//right bottom dot

		ctx.restore();
	}

	/*
	* draw rect by x,y,width,height and fill it
	*/
	function drawFillRect(ctx,x,y,size){
		ctx.beginPath();
		ctx.rect(x - size / 2,y - size / 2,size,size);
		ctx.fill();
	}

	CropBox.prototype._updateProperty = function(){
		var parent = this._parent,
			child = this;

		assign(parent,{
			x: child.x,
			y: child.y,
			width: child.width,
			height: child.height
		});
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

		switch(status){
			case MOUSECURSORNWRESIZE://draw on left top
				this.width = width - (x - startX);
				this.height = height - (y - startY);
				this.x = x;
				this.y = y;
				break ;
			case MOUSECURSORWRESIZE://drag on left center
				this.width = width - (x - startX);
				this.x = x;
				this.y = startY;
				break ;
			case MOUSECURSORSWRESIZE://drag on left bottom
				this.width = width - (x - startX);
				this.height = height + (y - startY - height);
				this.x = x;
				this.y = startY;
				break ;
			case MOUSECURSORNRESIZE://drag on center top
				this.height = height - (y - startY);
				this.x = startX;
				this.y = y;
				break ;
			case MOUSECURSORSRESIZE://drag on center bottom
				this.height = height + (y - startY - height);
				this.x = startX;
				this.y = startY;
				break ;
			case MOUSECURSORNERESIZE://drag on right top
				this.width = width + (x - startX - width);
				this.height = height + (startY - y);
				this.x = startX;
				this.y = y;
				break ;
			case MOUSECURSORERESIZE://drag on right center
				this.width = width + (x - startX - width);
				this.x = startX;
				this.y = startY;
				break ;
			case MOUSECURSORSERESIZE://drag on right bottom
				this.width = width + (x - startX - width);
				this.height = height + (y - startY - height);
				this.x = startX;
				this.y = startY;
				break ;
			default ://drag by move
				this.x = x - this._distanceX;
				this.y = y - this._distanceY;
		}
		this._parent._redraw();
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
			beikCanvas = this._parent._beikCanvas,
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

	CropBox.prototype.destroy = function(){
		this.canvas = this._parent = null;
	};

	function CircleCropBox(options){
		CropBox.call(this,options);
	}
	CircleCropBox.prototypeExtend(CropBox);

	CircleCropBox.prototype.reset = function(){
		var croperWidth = this.croperWidth,
			croperHeight = this.croperHeight,
			size = Math.min(croperWidth,croperHeight),
			radius = this.radius,
			x = this.x,
			y = this.y;

		this.radius = radius = Math.min(radius ? radius : size / 4,size / 2);
		this.x = x === undefined ? (croperWidth - 2 * radius) / 2 : x;
		this.y = y === undefined ? (croperHeight - 2 * radius) / 2 : y;

	};

	CircleCropBox.prototype._redraw = function(){
		var croperWidth = this.croperWidth,
			croperHeight = this.croperHeight,
			radius = this.radius,
			x = this.x,
			y = this.y;

		this.x = x = Math.min(Math.max(x,0),croperWidth - 2 * radius);
		this.y = y = Math.min(Math.max(y,0),croperHeight - 2 * radius);

		this.drawShadow(x,y);
		this.drawContent(x,y);
		this._updateProperty();
	};

	CircleCropBox.prototype._updateProperty = function(){
		var parent = this._parent,
			child = this;

		assign(parent,{
			x: child.x,
			y: child.y,
			radius: child.radius
		});
	}

	CircleCropBox.prototype.drawShadow = function(x,y){
		var canvas = this.canvas,
			ctx = canvas.getContext('2d'),
			radius = this.radius,
			croperWidth = this.croperWidth,
			croperHeight = this.croperHeight;

		ctx.fillStyle = 'rgba(0,0,0,0.4)';
		ctx.beginPath();
		ctx.rect(0,0,croperWidth,croperHeight);
		ctx.arc(x + radius,y + radius,radius,0,DOUBLEPI,true);
		ctx.fill();
	};

	CircleCropBox.prototype.drawContent = function(x,y){
		var canvas = this.canvas,
			ctx = canvas.getContext('2d'),
			radius = this.radius,
			lineStyle = this.lineStyle;

		drawCircleBox(ctx,x,y,radius,lineStyle,this.dashLineStyle);
		this.resizable && addDotsOnCircle(ctx,x,y,radius,Math.max(this.dotSize,1),this.resizeDotStyle);
	};

	function drawCircleBox(ctx,x,y,radius,lineStyle,dashLineStyle){
		ctx.beginPath();
		ctx.strokeStyle = lineStyle;
		ctx.arc(x + radius,y + radius,radius,0,DOUBLEPI);
		ctx.stroke();

		drawDashLine(
			ctx,
			covertNumToHalf(x + radius),
			covertNumToHalf(y),
			covertNumToHalf(x + radius),
			covertNumToHalf(y + radius * 2),
			dashLineStyle
		);

		drawDashLine(
			ctx,
			covertNumToHalf(x),
			covertNumToHalf(y + radius),
			covertNumToHalf(x + radius * 2),
			covertNumToHalf(y + radius),
			dashLineStyle
		);
	}

	function addDotsOnCircle(ctx,x,y,radius,dotSize,resizeDotStyle){
		ctx.fillStyle = resizeDotStyle;
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

		switch(status){
			case MOUSECURSORWRESIZE://drag on left center
				this.radius = radius - (x - startX) / 2;
				this.x = x;
				this.y = startY + (x - startX) / 2;
				break ;
			case MOUSECURSORNRESIZE://drag on center top
				this.radius = radius - (y - startY) / 2;
				this.x = startX + (y - startY) / 2;
				this.y = y;
				break ;
			case MOUSECURSORSRESIZE://drag on center bottom
				this.radius = radius + (y - startY - diameter) / 2;
				this.x = startX - (y - startY - diameter) / 2;
				this.y = startY;
				break ;
			case MOUSECURSORERESIZE://drag on right center
				this.radius = radius + (x - startX - diameter) / 2;
				this.x = startX;
				this.y = startY - (x - startX - diameter) / 2;
				break ;
			default ://drag by move
				this.x = x - this._distanceX;
				this.y = y - this._distanceY;
		}
		this._parent._redraw();
	};

	CircleCropBox.prototype.cut = function(){
		var x = this.x,
			y = this.y,
			radius = this.radius,
			diameter = 2 * radius,
			beikCanvas = this._parent._beikCanvas,
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