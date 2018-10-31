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

		while(--len){
			var from = arguments[len];
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
			type: 'image/jpeg'
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
				quality: this.quality
			};
		switch(type){
			case 'grid':
				cropBox = new GridCropBox(cropBoxOpts);
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
		callhook(this,'beforeDrag');
		this._cropBox.beforeDrag && this._cropBox.beforeDrag(e.offsetX,e.offsetY);
	};
	Croper.prototype._dragging = function(e){
		callhook(this,'dragging');
		this._cropBox.dragging && this._cropBox.dragging(e.offsetX,e.offsetY);
	};
	Croper.prototype._endDrag = function(){
		callhook(this,'endDrag');
		this._cropBox.endDrag && this._cropBox.endDrag();
	};

	Croper.prototype.cut = function(){
		return this._cropBox.cut();
	};

	Croper.prototype.destroy = function(){
		console.log('destory');
	};


	function CropBox(options){
		assign(this,{
			lineWidth: 3,
			strokeStyle: 'red',
			stokeHeight: '20%'
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
			y = this.y,
			lineWidth = this.lineWidth;

		this.lineWidth = lineWidth = Math.max(lineWidth,1);
		this.width = width = width ? width : size / 2;
		this.height = height = height ? height : size / 2;
		this.strokWidth = width * 0.2;
		this.strokHeight = height * 0.2;
		this.x = x === undefined ? (canvasWidth - width - lineWidth * 2) / 2 : x;
		this.y = y === undefined ? (canvasHeight - height - lineWidth * 2) / 2 : y;

	};

	CropBox.prototype.draw = function(x,y){
		var canvas = this.canvas,
			ctx = canvas.getContext('2d'),
			canvasWidth = canvas.width,
			canvasHeight = canvas.height,
			lineWidth = this.lineWidth,
			width = this.width + lineWidth * 2,
			height = this.height + lineWidth * 2,
			strokWidth = this.strokWidth + lineWidth,
			strokHeight = this.strokHeight + lineWidth;
		this.x = x = Math.min(Math.max(x === undefined ? this.x : x,0),canvasWidth - width);
		this.y = y = Math.min(Math.max(y === undefined ? this.y : y,0),canvasHeight - height);

		ctx.strokeStyle = this.strokeStyle;
		ctx.lineWidth = this.lineWidth;
		ctx.beginPath();
		ctx.moveTo(x,y);
		ctx.lineTo(x + strokWidth,y);
		ctx.moveTo(x + width - strokWidth,y);
		ctx.lineTo(x + width,y);
		ctx.moveTo(x + width,y);
		ctx.lineTo(x + width,y + strokHeight);
		ctx.moveTo(x + width,y + height - strokHeight);
		ctx.lineTo(x + width,y + height);
		ctx.moveTo(x + width,y + height);
		ctx.lineTo(x + width - strokWidth,y + height);
		ctx.moveTo(x + strokWidth,y + height);
		ctx.lineTo(x,y + height);
		ctx.moveTo(x,y + height);
		ctx.lineTo(x,y + height - strokHeight);
		ctx.moveTo(x,y + strokHeight);
		ctx.lineTo(x,y);
		ctx.stroke();
	};

	CropBox.prototype.beforeDrag = function(offsetX,offsetY){
		this.isDragging = true;
		this._distanceX = offsetX - this.x;
		this._distanceY = offsetY - this.y;
	};
	CropBox.prototype.dragging = function(x,y){
		var canvas = this.canvas,
			startX = this.x,
			startY = this.y,
			cropWidth = this.width,
			cropHeight = this.height;

		if(x < startX || x > (startX + cropWidth) || y < startY || y > (startY + cropHeight)){
			canvas.style.cursor = 'default';
			return ;
		}
		if(this.isDragging){
			this._parent.drawImage();
			this.draw(x - this._distanceX,y - this._distanceY);
		}
		canvas.style.cursor = 'move';
	};
	CropBox.prototype.endDrag = function(){
		this.canvas.style.cursor = 'move';
		this.isDragging = false;
		try{
			delete this._distanceX;
			delete this._distanceY;
		}catch(e){};
	};

	CropBox.prototype.cut = function(){
		var canvas = this.canvas,
			cwidth = this.cwidth,
			cheight = this.cheight,
			lineWidth = this.lineWidth,
			x = this.x + lineWidth,
			y = this.y + lineWidth,
			width = this.width,
			height = this.height,
			tempCanvas = document.createElement('canvas'),
			tempCtx = tempCanvas.getContext('2d');
		tempCanvas.width = width;
		tempCanvas.height = height;

		tempCtx.drawImage(canvas,x,y,width,height,0,0,width,height);
		tempCtx.mozImageSmoothingEnabled = false;
	    tempCtx.webkitImageSmoothingEnabled = false;
	    tempCtx.msImageSmoothingEnabled = false;
	    tempCtx.imageSmoothingEnabled = false;

		return tempCanvas.toDataURL(this.type,this.quality);
	};

	function GridCropBox(options){
		assign(this,{
			dotType: 'rect'
		});
		CropBox.call(this,options);
	}
	GridCropBox.prototypeExtend(CropBox);
	GridCropBox.prototype.draw = function(x,y){
		var canvas = this.canvas,
			ctx = canvas.getContext('2d'),
			canvasWidth = canvas.width,
			canvasHeight = canvas.height,
			lineWidth = this.lineWidth,
			width = this.width + lineWidth * 2,
			height = this.height + lineWidth * 2,
			strokWidth = this.strokWidth + lineWidth,
			strokHeight = this.strokHeight + lineWidth;
		this.x = x = Math.min(Math.max(x === undefined ? this.x : x,0),canvasWidth - width);
		this.y = y = Math.min(Math.max(y === undefined ? this.y : y,0),canvasHeight - height);

		ctx.strokeStyle = this.strokeStyle;
		ctx.lineWidth = this.lineWidth;
		ctx.strokeStyle = this.strokeStyle;
		ctx.lineWidth = this.lineWidth;
		ctx.beginPath();
		ctx.moveTo(x,y);
		ctx.lineTo(x + strokWidth,y);
		ctx.moveTo(x + width - strokWidth,y);
		ctx.lineTo(x + width,y);
		ctx.moveTo(x + width,y);
		ctx.lineTo(x + width,y + strokHeight);
		ctx.moveTo(x + width,y + height - strokHeight);
		ctx.lineTo(x + width,y + height);
		ctx.moveTo(x + width,y + height);
		ctx.lineTo(x + width - strokWidth,y + height);
		ctx.moveTo(x + strokWidth,y + height);
		ctx.lineTo(x,y + height);
		ctx.moveTo(x,y + height);
		ctx.lineTo(x,y + height - strokHeight);
		ctx.moveTo(x,y + strokHeight);
		ctx.lineTo(x,y);
		ctx.stroke();
	};


	function jCrop(srcOrImg,options){
		return new Croper(srcOrImg,options);
	}
	win.jCrop = jCrop;

})(window,document);