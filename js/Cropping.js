/*
* image cropping entry,preview,cut,compress,correction image
* @params{target},string | dom element,The file select element or image source
* @params{options},object, image params
*/
function cropping(srcOrImg,options){
	return new Croper(srcOrImg,options);
}

/*
* image cropping entry,preview,cut,compress,correction image
* @params{target},string | dom element,The file select element or image source
* @params{options},object, image params
*/
function Croper(srcOrImg,options){
	this._installGlobalProperty();

	this._mergeOptions(options);

	this._callhook(this.beforeCrop);

	this._loadImg(srcOrImg,this._init.bind(this));

}

var defaultHander = {
	beginDrag: function(e){
		this.isDragging = true;
		this._callhook(this.beginDrag);
		var cropBox = this.cropBox,
			x = cropBox.x,
			y = cropBox.y;
		this._distanceX = e.offsetX - x;
		this._distanceY = e.offsetY - y;
	},
	dragging: function(e){
		var canvas = this.canvas,
			cropBox = this.cropBox,
			x = e.offsetX,
			y = e.offsetY,
			startX = cropBox.x,
			startY = cropBox.y,
			cropWidth = cropBox.width,
			cropHeight = cropBox.height;

		if(x < startX || x > (startX + cropWidth) || y < startY || y > (startY + cropHeight)){
			canvas.style.cursor = 'default';
			return ;
		}
		if(this.isDragging){
			this.drawImage();
			this.cropBox.draw(x - this._distanceX,y - this._distanceY);
			this._callhook(this.dragging,this.canvas,this.cropBox);
		}
		canvas.style.cursor = 'move';
		
	},
	endDrag: function(){
		this.canvas.style.cursor = 'move';
		this.isDragging = false;
		this._callhook(this.endDrag);
		try{
			delete this._distanceX;
			delete this._distanceY;
		}catch(e){};
		console.log(this);
	}
};

Croper.prototype._installGlobalProperty = function(){
	this._defaultHander = defaultHander;
	this.version = '1.0.0';
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

			that.img = this;
			that.width = this.width;
			that.height = this.height;
			that.isImgLoaded = true;

			callback && typeof callback === 'function' && callback.call();

			image = that = null;
		}catch(e){
			throw e;
		};
	};
};

Croper.prototype._mergeOptions = function(options){
	var opts = this._opts = extend({
		maxSize: 2000,
		quality: 1,
		type: 'image/jpeg'
	},options);

	for(var key in opts){
		if(opts.hasOwnProperty(key)){
			(this[key] === undefined) && (this[key] = opts[key]);
		}
	}

	opts = null;
}

Croper.prototype._callhook = function(func){
	return func && typeof func === 'function' && func.apply(this,arguments);
}

Croper.prototype._init = function(){
	this._imageScale();
	this._initViewport();
	this.drawImage();
	this._initCropBox();
	this._initEvent();
	this._callhook(this.afterCreate);
	this.showCropper();

	console.log(this);
}

Croper.prototype._initViewport = function(){
	var viewEl = this.viewEl,
		viewWidth = this.viewWidth,
		viewHeight = this.viewHeight,
		width = this.width,
		height = this.height;

	if(typeof viewEl === 'string'){
		try{
			this.viewEl = viewEl = document.querySelector(viewEl);
		}catch(e){
			throw e;
		};
	}

	this.viewWidth = viewWidth  = viewWidth 
					? viewWidth 
					: viewEl
						? viewEl.clientWidth
						: this.width;
	this.viewHeight = viewHeight = viewHeight
					? viewHeight
					: viewEl
						? viewEl.clientHeight
						: this.height;

	var minRatio = Math.min(viewWidth / width ,viewHeight / height);
	if(minRatio < 1){
		this.width = this.img.width = width * minRatio;
		this.height = this.img.height = height * minRatio;
	}

};

Croper.prototype._imageScale = function(){
	var img = this.img,
		width = this.width,
		height = this.height,
		maxSize = this.maxSize,
		max = Math.max(width,height);

	if(max > maxSize){
		this.width = width = width * (maxSize / max);
		this.height = height = height * (maxSize / max);
		img.width = width;
		img.height = height;
	}
};

Croper.prototype.drawImage = function(){
	var canvas = this.canvas,
		width = this.width,
		height = this.height;
	if(!canvas){
		canvas = document.createElement('canvas');
		canvas.innerText = '浏览器不支持canvas';
		canvas.width = width;
		canvas.height = height;

		this.canvas = canvas;
	}
	
	var ctx = canvas.getContext('2d');

	ctx.clearRect(0,0,width,height);
	ctx.drawImage(this.img,0,0,width,height);

};

Croper.prototype._initCropBox = function(){
	var cropBox = this.cropBox = new CropBox(this.canvas);
	cropBox.draw();
};

Croper.prototype._initEvent = function(){
	var canvas = this.canvas,
		defaultHander = this._defaultHander;

	canvas.addEventListener('mousedown',defaultHander.beginDrag.bind(this),false);
	canvas.addEventListener('mousemove',defaultHander.dragging.bind(this),false);
	canvas.addEventListener('mouseup',defaultHander.endDrag.bind(this),false);
};

Croper.prototype.cut = function(){
	var canvas = this.canvas,
		canvasWidth = this.width,
		canvasHeight = this.height,
		cropBox = this.cropBox,
		lineWidth = cropBox.lineWidth,
		x = cropBox.x + lineWidth,
		y = cropBox.y + lineWidth,
		width = cropBox.width,
		height = cropBox.height,
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

Croper.prototype.destory = function(){
	var defaultHander = this._defaultHander;

	canvas.removeEventListener('mousedown',defaultHander.beginDrag,false);
};

Croper.prototype.showCropper = function(){
	var canvas = this.canvas,
		viewEl = this.viewEl;

	viewEl && viewEl.appendChild(canvas);
};


function CropBox(canvas,options){
	if(!canvas){
		throw new Error('');
	}
	this._mergeOptions(canvas,options);
	this._init();

	console.log(this);
}

CropBox.prototype._mergeOptions = function(canvas,options){
	var opts = this._opts = extend({
		canvas: canvas,
		lineWidth: 3,
		strokeStyle: 'red',
		stokeHeight: '20%'
	},options);

	for(var key in opts){
		if(opts.hasOwnProperty(key)){
			(this[key] === undefined) && (this[key] = opts[key]);
		}
	}
};

CropBox.prototype._init = function(){
	var canvas = this.canvas,
		canvasWidth = canvas.width,
		canvasHeight = canvas.height,
		size = Math.min(canvasWidth,canvasHeight),
		width = this.width,
		height = this.height,
		x = this.x,
		y = this.y,
		lineWidth = this.lineWidth;

	this.lineWidth = lineWidth = Math.max(lineWidth,1);
	this.width = width = width ? width : size / 2;
	this.height = height = height ? height : size / 2;
	this.hSize = coverStrToNum(this.stokeHeight,width);
	this.vSize = coverStrToNum(this.stokeHeight,height);
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
		hSize = this.hSize + lineWidth,
		vSize = this.vSize + lineWidth;
	this.x = x = Math.min(Math.max(x === undefined ? this.x : x,0),canvasWidth - width);
	this.y = y = Math.min(Math.max(y === undefined ? this.y : y,0),canvasHeight - height);

	ctx.strokeStyle = this.strokeStyle;
	ctx.lineWidth = this.lineWidth;
	ctx.beginPath();
	ctx.moveTo(x,y);
	ctx.lineTo(x + hSize,y);
	ctx.moveTo(x + width - hSize,y);
	ctx.lineTo(x + width,y);
	ctx.moveTo(x + width,y);
	ctx.lineTo(x + width,y + vSize);
	ctx.moveTo(x + width,y + height - vSize);
	ctx.lineTo(x + width,y + height);
	ctx.moveTo(x + width,y + height);
	ctx.lineTo(x + width - hSize,y + height);
	ctx.moveTo(x + hSize,y + height);
	ctx.lineTo(x,y + height);
	ctx.moveTo(x,y + height);
	ctx.lineTo(x,y + height - vSize);
	ctx.moveTo(x,y + vSize);
	ctx.lineTo(x,y);
	ctx.stroke();
}
CropBox.prototype.dashed = function(x,y){

}

function extend(to,from){
	if(!from || !isObject(from)){
		return to;
	}
	if(!to || !isObject(to)){
		return to;
	}

	for(var key in from){
		if(from.hasOwnProperty(key)){
			to[key] = from[key];
		}
	}
	return to;
}

function isObject(obj){
	return Object.prototype.toString.call(obj) === '[object Object]';
}

function coverStrToNum(str,total){
	var num = Number(str);
	if(isNaN(num)){
		num = String(str).match(/([\d\.]+)\%/);
		num = Number(num[1]);
		if(isNaN(num)){
			throw new Error('Error number type');
		}
		return num / 100 * total;
	}else{
		return num;
	}
}

window.cropping = cropping;