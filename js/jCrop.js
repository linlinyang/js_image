(function(win,doc){

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
	* check some value is object or nor
	* @params{obj};The value
	* @return Boolean;True for Object
	*/
	function isObject(obj){
		return Object.prototype.toString.call(obj) === '[object Object]';
	}

	/*
	* merge one or more object to the first object,just like Object.assign
	* @params{to,...} Object;
	* return object;
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
	* computed distance of two points by coordinate
	*/
	function distanceComputed(sx,sy,dx,dy){
		return Math.sqrt(Math.pow(dx - sx,2) + Math.pow(dy - sy,2));
	}

	/*
	* draw rect by direction
	*/
	function rect(ctx,x,y,width,height,direction){
		if(direction){//counterclockwise
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

	function Croper(srcOrImg,options){
		this._installGlobalProperty();

		this._mergeOptions(options);

		callhook(this,'beforeCreate');

		this._loadImg(srcOrImg,this._init);
		this._uid = ++uid;
	}

	Croper.prototype._installGlobalProperty = function(){
		Croper.version = '1.2.0';
	};

	Croper.prototype._mergeOptions = function(options){
		assign(this,{
			maxSize: 2000,
			quality: 1,
			type: 'image/png'
		},this._opts = options);
	};

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
				ctx.drawImage(this,0,0,0,0);
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

	Croper.prototype._init = function(){
		this._limitImage();
		this._initViewport();
		this.drawImage();
		this.drawCropBox(this.cropType);
		this._initEvent();
		callhook(this,'afterCreate');
		this.showCroper();
	};

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
	};

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
			if(minRatio < 1){
				this._imgWidth = this._img.width = imgWidth * minRatio;
				this._imgHeight = this._img.height = imgHeight * minRatio;
			}
		}

	};

	Croper.prototype.drawImage = function(){
		var canvas = this.canvas,
			width = this._imgWidth,
			height = this._imgHeight;

		if(!canvas){
			this.canvas = canvas = doc.createElement('canvas');
			
			canvas.innerHTML = '浏览器不支持canvas';
			canvas.width = width;
			canvas.height = height;
		}

		var ctx = canvas.getContext('2d');

		ctx.clearRect(0,0,width,height);
		ctx.drawImage(this._img,0,0,width,height);
	};

	Croper.prototype.showCroper = function(){
		var canvas = this.canvas,
			el = this.el;

		if(el && el.firstElementChild){
			el.removeChild(el.firstElementChild);
		}
		el && el.appendChild && el.appendChild(canvas);
	};

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
			case 'circle':
				cropBox = new CircleCropBox(cropBoxOpts);
				break;
			default:
				cropBox = new CropBox(cropBoxOpts);
		}

		this._cropBox = cropBox;
		cropBox._parent = this;
	};

	Croper.prototype._initEvent = function(){
		var canvas = this.canvas;

		canvas.addEventListener('mousedown',this._beginDrag.bind(this),false);
		canvas.addEventListener('mousemove',this._dragging.bind(this),false);
		canvas.addEventListener('mouseup',this._endDrag.bind(this),false);
	};

	Croper.prototype._beginDrag = function(e){
		var cropBox = this._cropBox;
		callhook(this,'beforeDrag');
		cropBox.beforeDrag && cropBox.beforeDrag.call(cropBox,e.offsetX,e.offsetY);
	};
	Croper.prototype._dragging = function(e){
		var cropBox = this._cropBox;
		callhook(this,'dragging');
		cropBox.dragging && cropBox.dragging.call(cropBox,e.offsetX,e.offsetY);
	};
	Croper.prototype._endDrag = function(e){
		var cropBox = this._cropBox;
		callhook(this,'endDrag');
		cropBox.endDrag && cropBox.endDrag.call(cropBox,e.offsetX,e.offsetY);
	};

	Croper.prototype.cut = function(){
		return this._cropBox.cut();
	};

	Croper.prototype.destroy = function(){
		console.log('destory');
	};


	function CropBox(options){
		assign(this,{
			strokeStyle: '#39f',
			resizable: false,
			dashStyle: 'rgba(254,254,254,0.3)',
			fillStyle: '#39f',
			dotSize: 5
		},options);

		this._init();

		this.draw();
	}

	CropBox.prototype._init = function(){
		var canvasWidth = this.cwidth,
			canvasHeight = this.cheight,
			size = Math.min(canvasWidth,canvasHeight),
			width = this.width,
			height = this.height,
			x = this.x,
			y = this.y;

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

		/*
		* draw dots on first horizontal line in grid
		*/
		drawFillRect(ctx,x,y,dotSize);
		drawFillRect(ctx,x + width / 2,y,dotSize);
		drawFillRect(ctx,x + width,y,dotSize);

		/*
		*  draw dots on middle horizontal line in grid
		*/
		drawFillRect(ctx,x,y + height / 2,dotSize);
		drawFillRect(ctx,x + width,y + height / 2,dotSize);

		/*
		*  draw dots on last horizontal line in grid
		*/
		drawFillRect(ctx,x,y + height,dotSize);
		drawFillRect(ctx,x + width / 2,y + height,dotSize);
		drawFillRect(ctx,x + width,y + height,dotSize);
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
		var startX = this.x,
			startY = this.y;
		this._distanceX = x - startX;
		this._distanceY = y - startY;
		this._hoverStatus = mouseWheelCursor(
			this.canvas,
			startX,
			startY,
			this.width,
			this.height,
			x,
			y,
			this.resizable ? this.dotSize : this.resizable
		);
	};
	CropBox.prototype.dragging = function(x,y){
		var canvas = this.canvas,
			startX = this.x,
			startY = this.y,
			cropWidth = this.width,
			cropHeight = this.height,
			status = this._hoverStatus;

		mouseWheelCursor(
			this.canvas,
			startX,
			startY,
			cropWidth,
			cropHeight,
			x,
			y,
			this.resizable ? this.dotSize : this.resizable
		);

		if(!status){
			return ;
		}
		this._parent.drawImage();
		var targetX = x - this._distanceX,
			targetY = y - this._distanceY;
		switch(status){
			case 11://draw on left top
				this.width = cropWidth - (x - startX);
				this.height = cropHeight - (y - startY);
				this.draw(x,y);
				break ;
			case 12://drag on left center
				this.width = cropWidth - (x - startX);
				this.draw(x,startY);
				break ;
			case 13://drag on left bottom
				this.width = cropWidth - (x - startX);
				this.height = cropHeight + (y - startY - cropHeight);
				this.draw(x,startY);
				break ;
			case 21://drag on center top
				this.height = cropHeight - (y - startY);
				this.draw(startX,y);
				break ;
			case 23://drag on center bottom
				this.height = cropHeight + (y - startY - cropHeight);
				this.draw(startX,startY);
				break ;
			case 31://drag on right top
				this.width = cropWidth + (x - startX - cropWidth);
				this.height = cropHeight + (startY - y);
				this.draw(startX,y);
				break ;
			case 32://drag on right center
				this.width = cropWidth + (x - startX - cropWidth);
				this.draw(startX,startY);
				break ;
			case 33://drag on right bottom
				this.width = cropWidth + (x - startX - cropWidth);
				this.height = cropHeight + (y - startY - cropHeight);
				this.draw(startX,startY);
				break ;
			default :
				this.draw(targetX,targetY);
		}

	};
	CropBox.prototype.endDrag = function(x,y){
		var startX = this.x,
			startY = this.y;

		this.canvas.style.cursor = 'move';
		this._hoverStatus = null;
		mouseWheelCursor(
			this.canvas,
			startX,
			startY,
			this.width,
			this.height,
			x,
			y,
			this.resizable ? this.dotSize : this.resizable
		);
		try{
			delete this._distanceX;
			delete this._distanceY;
			delete this._hoverStatus;
		}catch(e){};
	};

	function mouseWheelCursor(obj,sx,sy,width,height,dx,dy,innserSpace){
		if(!innserSpace){//cannot resize cropbox
			if(
				dx < sx 
				|| dx > (sx + width) 
				|| dy < sy 
				|| dy > sy + height
			){//outer of crop box
				obj.style.cursor = 'default';
				return 1;
			}else{//inner of crop box
				obj.style.cursor = 'move';
				return 2;
			}
		}

		//cropbox is resizable
		sx -= innserSpace / 2;
		sy -= innserSpace / 2;
		if(
			dx < sx 
			|| dx > (sx + width + innserSpace) 
			|| dy < sy 
			|| dy > sy + height + innserSpace
		){//outer of crop box
			obj.style.cursor = 'default';
			return 1;
		}else if(dx < sx + innserSpace){
			if(dy < sy + innserSpace){
				obj.style.cursor = 'nwse-resize';
				return 11;
			}
			if(dy <= sy + height - innserSpace){
				obj.style.cursor = 'ew-resize';
				return 12;
			}
			obj.style.cursor = 'nesw-resize';
			return 13;
		}else if(dx >= sx + innserSpace && dx <= (sx + width - innserSpace)){
			if(dy < sy + innserSpace){
				obj.style.cursor = 'ns-resize';
				return 21;
			}
			if(dy <= sy + height - innserSpace){
				obj.style.cursor = 'move';
				return 22;
			}
			obj.style.cursor = 'ns-resize';
			return 23;
		}else if(dx > sx + width -innserSpace){
			if(dy < sy + innserSpace){
				obj.style.cursor = 'nesw-resize';
				return 31;
			}
			if(dy <= sy + height - innserSpace){
				obj.style.cursor = 'ew-resize';
				return 32;
			}
			obj.style.cursor = 'nwse-resize';
			return 33;
		}
	}

	CropBox.prototype.cut = function(){
		var img = this._img,
			imgWidth = img.width,
			imgHeight = img.height,
			x = this.x,
			y = this.y,
			width = this.width,
			height = this.height,
			tempCanvas = document.createElement('canvas'),
			tempCtx = tempCanvas.getContext('2d');
		tempCanvas.width = imgWidth;
		tempCanvas.height = imgHeight;
		tempCtx.mozImageSmoothingEnabled = false;
	    tempCtx.webkitImageSmoothingEnabled = false;
	    tempCtx.msImageSmoothingEnabled = false;
	    tempCtx.imageSmoothingEnabled = false;

		tempCtx.clearRect(0,0,imgWidth,imgHeight);
		tempCtx.drawImage(img,0,0,imgWidth,imgHeight);

		var resCanvas = document.createElement('canvas'),
			resCtx = resCanvas.getContext('2d');
		resCanvas.width = width;
		resCanvas.height = height;
		resCtx.mozImageSmoothingEnabled = false;
	    resCtx.webkitImageSmoothingEnabled = false;
	    resCtx.msImageSmoothingEnabled = false;
	    resCtx.imageSmoothingEnabled = false;

		resCtx.clearRect(0,0,imgWidth,imgHeight);
		resCtx.drawImage(tempCanvas,x,y,width,height,0,0,width,height);

		return resCanvas.toDataURL(this.type,this.quality);
	};

	function CircleCropBox(options){
		/*assign(this,{
			radius: 
		});*/
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
		ctx.arc(x + radius,y + radius,radius,0,2 * Math.PI,true);
		ctx.fill();
	};

	CircleCropBox.prototype.drawContent = function(x,y){
		var canvas = this.canvas,
			ctx = canvas.getContext('2d'),
			radius = this.radius,
			strokeStyle = this.strokeStyle;

		drawCircleBox(ctx,x,y,radius,strokeStyle,this.dashStyle);
		//this.resizable && addDotsOnGrid(ctx,x,y,width,height,Math.max(this.dotSize,1),this.fillStyle);
	};

	function drawCircleBox(ctx,x,y,radius,strokeStyle,dashStyle){
		ctx.beginPath();
		ctx.strokeStyle = strokeStyle;
		ctx.arc(x + radius,y + radius,radius,0, 2 * Math.PI);
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
		
	}


	function jCrop(srcOrImg,options){
		return new Croper(srcOrImg,options);
	}
	win.jCrop = jCrop;

})(window,document);