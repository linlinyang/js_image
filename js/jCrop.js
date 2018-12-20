/*!
 * jCrop.js v1.0.0
 * (c) 2018-2018 Zoro Yang
 */
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
	* 原型继承
	* @params{superClass} Fucntion;父类
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
	* 是否为对象
	* @params{obj};被检测对象
	* @return Boolean;
	*/
	function isObject(obj){
		return Object.prototype.toString.call(obj) === '[object Object]';
	}

	/*
	* 浅拷贝合并多个对象到第一个
	* @params{to,...} Object;参数都是对象类型
	* @return Object;
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
	* 钩子函数
	* @params{target} Object;执行对象
	* @params{hook} String;钩子函数名称
	*/
	function callhook(target,hook){
		var hookFunc = target._opts[hook],
			args = Array.prototype.slice.call(arguments,2);
		if(hookFunc && typeof hookFunc === 'function'){
			hookFunc.apply(target,args);
		}
	}

	/*
	* 计算两点间距离
	* @params{sx} Number;起点x坐标
	* @params{sy} Number;起点y坐标
	* @params{dx} Number;终点x坐标
	* @params{dy} Number;终点y坐标
	*/
	function distanceComputed(sx,sy,dx,dy){
		return Math.sqrt(Math.pow(dx - sx,2) + Math.pow(dy - sy,2));
	}

	/*
	* 计算两点相对以起点作水平线的角度
	* @params{sx} Number;起点x坐标
	* @params{sy} Number;起点y坐标
	* @params{dx} Number;终点x坐标
	* @params{dy} Number;终点y坐标
	*/
	function angleComputed(sx,sy,dx,dy){
		return Math.atan(dy - sy / dx - sx);
	}

	/*
	* 根据方向绘制矩形，默认顺时针
	* 原生CanvasRenderingContext2D.rect不能按逆时针方向绘制矩形
	*
	* @params {ctx},CanvasRenderingContext2D;
	* @params {x} Number;矩形起点x坐标
	* @parmas {y} Number;矩形起点y坐标
	* @params {width} Number;矩形宽度
	* @params {height} Number;矩形高度
	* @params {direction} Boolean;True 逆时针，False顺时针
	*/
	function rect(ctx,x,y,width,height,direction){
		if(!!direction){//逆时针绘制矩形
			ctx.moveTo(x,y);
			ctx.lineTo(x,y + height)
			ctx.lineTo(x + width,y + height);
			ctx.lineTo(x + width,y);
		}else{//顺时针，调用原生方法
			ctx.rect(x,y,width,height);
		}
		ctx.closePath();
	}

	/*
	* 获取元素相对body偏移量
	*/
	function offset(el){
		var pat = el,
			top = 0,
			left = 0;

		while(pat){
			top += pat.offsetTop;
			left += pat.offsetLeft;
			pat = pat.offsetParent;
		}
		return {
			'top': top,
			'left': left
		}
	}

	/*
	* 克隆画布及画布里绘制内容
	* @params{oldCanvas} HTMLElement;被克隆的画布元素
	* @return HTMLElement;返回新的画布元素
	*/
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
	* 核心类，控制及绘制图片背景，开放接口
	*/
	function Croper(srcOrImg,options){
		assign(this,{//合并参数
			maxSize: 2000,
			quality: 1,
			type: 'image/png',
			width: 800,
			height: 600
		},this._opts = options);

		this._loadImg(srcOrImg,this._init);
		this._uid = ++uid;
	}

	/*
	* 加载图片
	* @params{srcOrImg} String | HTMLElement;图片地址或图片元素
	* @params{callback} Function;图片加载完异步回调
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
				ctx.drawImage(this,0,0,0,0);//检查图片是否能被加载
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
	* 初始化图片大小，监测是否超出最大尺寸，重置图片背景和裁剪框
	*/
	Croper.prototype._init = function(){
		this._checkImageSize();

		//重置图片大小
		this._resetImgSize();

		//重新装载画布及裁剪框
		this._installViewport();

		//初始化事件绑定
		this._initEvent();

		this.reset();

		callhook(this,'created',this.canvas,this.width,this.height);
	};

	/*
	* 限制图片最大宽度或高度，超出则等比缩小
	*/
	Croper.prototype._checkImageSize = function(){
		var img = this._img,
			imgWidth = this._imgWidth,
			imgHeight = this._imgHeight,
			maxSize = this.maxSize,
			max = Math.max(imgWidth,imgHeight);

		if(max > maxSize){//超出最大尺寸限制
			var ratio = maxSize / max;
			img.width = this._imgWidth = imgWidth * ratio;
			img.height = this._imgHeight = imgHeight * ratio;
		}
	};

	/*
	* 根据画布大小设置图片大小，超出等比缩放
	*/
	Croper.prototype._resetImgSize = function(){
		var width = this.width,
			height = this.height,
			originWidth = this._imgWidth,
			originHeight = this._imgHeight,
			maxRatio = Math.max(originWidth / width,originHeight / height);

		if(maxRatio > 1){
			this._imgWidth = originWidth / maxRatio;
			this._imgHeight = originHeight / maxRatio;
		}
	};

	/*
	* 重置画布大小、放大缩小比例、旋转度数并重绘
	*/
	Croper.prototype.reset = function(){
		//重置画布放大缩小比例、旋转度数
		this.scaleX = 1;
		this.scaleY = 1;
		this.rotateZ = 0;

		//装载裁剪框及重置
		this._installCropBox(this.cropType);

		//重绘画布及裁剪框
		this._redraw();
	};

	/*
	* 装载画布及裁剪框
	*/
	Croper.prototype._installViewport = function(){
		var canvas = this.canvas;

		if(!canvas){
			canvas = this.canvas = doc.createElement('canvas');//生成新的画布
			canvas.innerHTML = '浏览器不支持canvas';
			canvas.width = this.width;
			canvas.height = this.height;
		}
	};

	/*
	* 在画布上重绘背景图、裁剪框
	*/
	Croper.prototype._redraw = function(){
		var canvas = this.canvas,
			width = this.width,
			height = this.height,
			originWidth = this._imgWidth,
			originHeight = this._imgHeight,
			scaleX = this.scaleX,
			scaleY = this.scaleY,
			rotateZ = this.rotateZ;

		var ctx = canvas.getContext('2d');
		ctx.mozImageSmoothingEnabled = false;
	    ctx.webkitImageSmoothingEnabled = false;
	    ctx.msImageSmoothingEnabled = false;
	    ctx.imageSmoothingEnabled = false;

		ctx.save();
		ctx.clearRect(0,0,width,height);

		ctx.translate((1 - scaleX) * width / 2,(1 - scaleY) * height / 2);
		ctx.scale(scaleX,scaleY);
		ctx.translate(width / 2,height / 2);
		ctx.rotate(rotateZ * Math.PI / 180);
		ctx.translate(-width / 2,-height / 2);
		
		ctx.drawImage(
			this._img,
			(width - originWidth) / 2,
			(height - originHeight) / 2,
			originWidth,
			originHeight
		);
		ctx.restore();

		//备份当前状态的背景图画布
		this._beikCanvas = cloneCanvas(canvas);

		//裁剪框重绘
		this._cropBox && this._cropBox._redraw();
	};

	/*
	* 装载裁剪框并重绘
	*/
	Croper.prototype._installCropBox = function(cropType){
		var cropBox = this._cropBox;

		cropType = String(cropType).toLowerCase();
		var cropBoxOpts = assign(this._opts,{
				canvas: this.canvas,
				croperWidth: this.width,
				croperHeight: this.height,
				imgWidth: this._imgWidth,
				imgHeight: this._imgHeight,
				type: this.type,//图片类型
				quality: this.quality,//图片质量
				resizable: this.resizable//裁剪框是否可拉伸变形
			});
		switch(cropType){
			case 'circle'://圆形裁剪框
				cropBox = new CircleCropBox(cropBoxOpts);
				break;
			default://矩形裁剪框
				cropBox = new CropBox(cropBoxOpts);
		}

		this._cropBox = cropBox;
		cropBox._parent = this;

		//裁剪框重置
		cropBox.reset();
	};

	/*
	* 旋转画布，即旋转背景图
	* @params{deg} Number;旋转度数，正数顺时针，负数逆时针
	*/
	Croper.prototype.rotate = function(deg){
		deg = parseFloat(deg);

		if(isNaN(deg)){
			return ;
		}

		this.rotateZ = parseFloat(deg);

		this._redraw();
	};

	/*
	* 缩放画布，即缩放背景图,最小不能缩小到原来的0.5，最大不能放大到原来的3倍
	* @params{scaleX} Number;水平方向缩放
	* @params{scaleY} Number;垂直方向缩放
	*/
	Croper.prototype.scale = function(scaleX,scaleY){
		scaleX = parseFloat(scaleX);
		scaleY = parseFloat(scaleY);

		if(isNaN(scaleX) || isNaN(scaleY)){
			return ;
		}

		this.scaleX = Math.min(Math.max(scaleX,0.5),3);
		this.scaleY = Math.min(Math.max(scaleY,0.5),3);

		this._redraw();
	};

	/*
	* 当前画布事件绑定
	* @params{event} String;事件类型
	* @params{handle} Function;事件操作方法
	* @params{isBobble} Boolean;是否冒泡
	*/
	Croper.prototype.on = function(event,handle,isBobble){
		var canvas = this.canvas,
			cacheEvents = this._cacheEvents || [];

		if(!canvas){
			return;
		}

		cacheEvents.push({
			type: event,
			handle: handle,
			isBobble: !!isBobble
		});
		
		canvas.addEventListener(event,handle,!!isBobble);
		this._cacheEvents = cacheEvents;
	};

	/*
	* 移除指定绑定事件，如果参数为0则移除所有绑定事件
	* @params{event} String;要移除的事件类型
	* @params{handle} Function;要移除的事件方法
	* @params{isBobble} Boolean;是否冒泡
	*/
	Croper.prototype.off = function(event,handle,isBobble){
		var canvas = this.canvas;

		if(!canvas){return ; } 

		var cacheEvents = this._cacheEvents || [],
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
		!arguments.length && (cacheEvents = []);
	}

	/*
	* 初始化当前画布绑定事件
	*/
	Croper.prototype._initEvent = function(){
		var canvas = this.canvas;
		this.off();

		this.on('mousedown',this._beginDrag.bind(this));
		this.on('mousemove',this._dragging.bind(this));
		this.on('mouseup',this._endDrag.bind(this));
		this.on(MOUSEWHEELEVENT,this._scroll.bind(this));
		this.on('touchstart',this._touchStart.bind(this),false);
		this.on('touchmove',this._touchMove.bind(this),false);
		this.on('touchend',this._touchEnd.bind(this),false);
	};

	/*
	* 鼠标点击事件
	*/
	Croper.prototype._beginDrag = function(e){
		var cropBox = this._cropBox;
		callhook(this,'beforeDrag');
		cropBox.beforeDrag && cropBox.beforeDrag.call(cropBox,e.offsetX,e.offsetY);
	};

	/*
	* 鼠标移动事件
	*/
	Croper.prototype._dragging = function(e){
		var cropBox = this._cropBox;
		callhook(this,'dragging');
		cropBox.dragging && cropBox.dragging.call(cropBox,e.offsetX,e.offsetY);
	};

	/*
	* 鼠标松开事件
	*/
	Croper.prototype._endDrag = function(e){
		var cropBox = this._cropBox;
		callhook(this,'endDrag');
		cropBox.endDrag && cropBox.endDrag.call(cropBox,e.offsetX,e.offsetY);
	};

	/*
	* 屏幕touch start事件
	*/
	Croper.prototype._touchStart = function(e){
		e.preventDefault();
		var touches = e.touches,
			fingersNum = touches.length;

		if(fingersNum == 1){//一个手指，拖拽
			var finger = e.changedTouches[0],
				offsetObj = offset(this.canvas);

			this._beginDrag({
				offsetX: finger.clientX - offsetObj.left,
				offsetY: finger.clientY - offsetObj.top
			});
			finger = offsetObj = null;
		}else if(fingersNum == 2){//两个手指，缩放旋转
			this._startTouches = touches;
		}
	};

	/*
	* 屏幕touch move事件
	*/
	Croper.prototype._touchMove = function(e){
		e.preventDefault();
		var touches = e.touches,
			fingersNum = touches.length;

		if(fingersNum == 1){//一个手指，拖拽
			var finger = e.changedTouches[0],
				offsetObj = offset(this.canvas);

			this._dragging({
				offsetX: finger.clientX - offsetObj.left,
				offsetY: finger.clientY - offsetObj.top
			});
			finger = offsetObj = null;
		}else if(fingersNum == 2){//两个手指，缩放旋转
			var startTouches = this._startTouches,
				scale = distanceComputed(
						startTouches[0].clientX,
						startTouches[0].clientY,
						startTouches[1].clientX,
						startTouches[1].clientY
					) / distanceComputed(
						touches[0].clientX,
						touches[0].clientY,
						touches[1].clientX,
						touches[1].clientY
					),
				rotation = angleComputed(
						startTouches[0].clientX,
						startTouches[0].clientY,
						startTouches[1].clientX,
						startTouches[1].clientY
					) - angleComputed(
						touches[0].clientX,
						touches[0].clientY,
						touches[1].clientX,
						touches[1].clientY
					);
			//双指拉开放大背景图，拉近缩小背景图
			if(scale > 1){
				this.scaleX = Math.min(3,this.scaleX + 0.1);
				this.scaleY = Math.min(3,this.scaleY + 0.1);
			}else if(scale < 1){
				this.scaleX = Math.max(0.5,this.scaleX + 0.1);
				this.scaleY = Math.max(0.5,this.scaleY + 0.1);
			}
			//双指旋转控制背景图
			this.rotateZ += rotation * 180 / Math.PI;

			this._redraw();
		}
	};

	/*
	* 屏幕touch end事件
	*/
	Croper.prototype._touchEnd = function(e){
		e.preventDefault();
		var touches = e.touches,
			fingersNum = touches.length;

		if(fingersNum == 1){//一个手指，拖拽
			var finger = e.changedTouches[0],
				offsetObj = offset(this.canvas);

			this._endDrag({
				offsetX: finger.clientX - offsetObj.left,
				offsetY: finger.clientY - offsetObj.top
			});
			finger = offsetObj = null;
		}else if(fingersNum == 2){//两个手指，缩放旋转
			this._startTouches = null;
		}
	};

	/*
	* 鼠标滚轮事件
	*/
	Croper.prototype._scroll = function(e){
		var wheelDelta = e.wheelDelta
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
	* 裁剪结果，返回base64图片
	* @return String {base64}
	*/
	Croper.prototype.cut = function(){
		return this._cropBox.cut();
	};

	/*
	* 销毁
	*/
	Croper.prototype.destroy = function(){
		this._cropBox && this._cropBox.destroy();//销毁裁剪框
		this._cropBox = null;

		this.off();//注销绑定事件

		var el = this.el;
		el && el.removeChild(this.canvas);//清除

		this._cacheEvents = null;
		this.canvas = null;
	};

	/*
	* 矩形裁剪框类
	* 绘制矩形裁剪框，实现拖拽、裁剪功能
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
	* 重置矩形裁剪框大小，位置居中
	*/
	CropBox.prototype.reset = function(){
		var imgWidth = this.imgWidth,
			imgHeight = this.imgHeight,
			cropWidth = this.croperWidth,
			cropHeight = this.croperHeight,
			minimumLength = Math.min(imgWidth,imgHeight),
			width = this.cropWidth,
			height = this.cropHeight;

		this.width = width = Math.min(width ? width : minimumLength / 2,imgWidth);
		this.height = height = Math.min(height ? height : minimumLength / 2,imgHeight);
		this.x = (cropWidth - width ) / 2;
		this.y = (cropHeight - height) / 2;
	};

	/*
	* 矩形裁剪框重绘
	*/
	CropBox.prototype._redraw = function(){
		var croperWidth = this.croperWidth,
			croperHeight = this.croperHeight,
			width = this.width,
			height = this.height,
			x = this.x,
			y = this.y;

		this.x = x = Math.min(Math.max(x,0),croperWidth - width - 1);
		this.y = y = Math.min(Math.max(y,0),croperHeight - height - 1);

		this.drawShadow(x,y);
		this.drawContent(x,y);
		this._updateProperty();
	};

	/*
	* 绘制矩形裁剪框之外的阴影
	*/
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

	/*
	* 绘制矩形裁剪框内容
	*/
	CropBox.prototype.drawContent = function(x,y){
		var canvas = this.canvas,
			ctx = canvas.getContext('2d'),
			width = this.width,
			height = this.height,
			lineStyle = this.lineStyle;

		//绘制矩形裁剪框
		drawGrid(ctx,x,y,width,height,lineStyle,this.dashLineStyle);
		//绘制拉伸点在裁剪框边线中间部分
		this.resizable && addDotsOnGrid(ctx,x,y,width,height,Math.max(this.dotSize,1),this.resizeDotStyle);
	};

	/*
	* 绘制矩形裁剪框及中间虚线
	*/
	function drawGrid(ctx,x,y,width,height,lineStyle,dashLineStyle){
		/*
		* 画布在绘制1px线的时候的bug，需要转换坐标
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
		);//绘制矩形边框
		ctx.stroke();

		ctx.restore();

		drawDashLine(//垂直虚线左三分之一处
			ctx,
			covertNumToHalf(x + width / 3),
			covertNumToHalf(y),
			covertNumToHalf(x + width / 3),
			covertNumToHalf(y + height),
			dashLineStyle
		);
		drawDashLine(//垂直虚线右三分之一处
			ctx,
			covertNumToHalf(x + (width / 3) * 2),
			covertNumToHalf(y),
			covertNumToHalf(x + (width / 3) * 2),
			covertNumToHalf(y + height),
			dashLineStyle
		);
		drawDashLine(//水平虚线上三分之一处
			ctx,
			covertNumToHalf(x),
			covertNumToHalf(y + height / 3),
			covertNumToHalf(x + width),
			covertNumToHalf(y + height / 3),
			dashLineStyle
		);
		drawDashLine(//水平虚线下三分之一处
			ctx,
			covertNumToHalf(x),
			covertNumToHalf(y + (height / 3) * 2),
			covertNumToHalf(x + width),
			covertNumToHalf(y + (height / 3) * 2),
			dashLineStyle
		);
	}

	/*
	* 绘制虚线
	* @params{ctx} CanvasRenderingContext2D;
	* @params{sx} Number;起点x坐标
	* @params{sy} Number;起点y坐标
	* @params{dx} Number;终点x坐标
	* @params{dy} Number;终点y坐标
	* @params{strokeStyle} String;线条颜色
	* @params{dashLength} Number;虚线长度,默认为 3
	*/
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

	/*
	* 数值转换，向下取整加0.5
	* @params{num} Number;
	* @return Number;
	*/
	function covertNumToHalf(num){
		return parseInt(num) + 0.5;
	}

	/*
	* 绘制拉伸点在矩形裁剪框
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
	* 绘制并填充矩形
	*/
	function drawFillRect(ctx,x,y,size){
		ctx.beginPath();
		ctx.rect(x - size / 2,y - size / 2,size,size);
		ctx.fill();
	}

	/*
	* 更新属性至Croper对象
	*/
	CropBox.prototype._updateProperty = function(){
		var parent = this._parent,
			child = this;

		assign(parent,{
			x: child.x,
			y: child.y,
			cropWidth: child.width,
			cropHeight: child.height
		});
	}

	/*
	* 拖拽之前，判断拖拽类型并保存
	*/
	CropBox.prototype.beforeDrag = function(x,y){
		this._distanceX = x - this.x;
		this._distanceY = y - this.y;
		this._hoverStatus = this.mouseWheelPositioning(x,y);
	};

	/*
	* 根据拖拽类型拖拽
	*/
	CropBox.prototype.dragging = function(x,y){
		var canvas = this.canvas,
			startX = this.x,
			startY = this.y,
			width = this.width,
			height = this.height,
			status = this._hoverStatus;

		this.mouseWheelPositioning(x,y);

		if(!status || status == MOUSECURSORDEFAULT){
			return;
		}

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

	/*
	* 结束拖拽
	*/
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

	/*
	* 判断鼠标形状
	*/
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

	/*
	* 生成裁剪结果
	*/
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

	/*
	* 销毁裁剪框
	*/
	CropBox.prototype.destroy = function(){
		this.canvas = this._parent = null;
	};

	/*
	* 圆形裁剪框
	*/
	function CircleCropBox(options){
		CropBox.call(this,options);//属性继承
	}
	CircleCropBox.prototypeExtend(CropBox);

	/*
	* 重置圆形裁剪框半径和位置
	*/
	CircleCropBox.prototype.reset = function(){
		var croperWidth = this.croperWidth,
			croperHeight = this.croperHeight,
			imgWidth = this.imgWidth,
			imgHeight = this.imgHeight,
			size = Math.min(imgWidth,imgHeight),
			radius = this.radius,
			x = this.x,
			y = this.y;

		this.radius = radius = Math.min(radius ? radius : size / 4,size / 2);
		this.x = x === undefined ? (croperWidth - 2 * radius) / 2 : x;
		this.y = y === undefined ? (croperHeight - 2 * radius) / 2 : y;

	};

	/*
	* 圆形裁剪框重绘
	*/
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

	/*
	* 更新属性至Croper对象
	*/
	CircleCropBox.prototype._updateProperty = function(){
		var parent = this._parent,
			child = this;

		assign(parent,{
			x: child.x,
			y: child.y,
			radius: child.radius
		});
	}

	/*
	* 绘制圆形裁剪框之外的阴影
	*/
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

	/*
	* 绘制圆形裁剪框内容
	*/
	CircleCropBox.prototype.drawContent = function(x,y){
		var canvas = this.canvas,
			ctx = canvas.getContext('2d'),
			radius = this.radius,
			lineStyle = this.lineStyle;

		//绘制圆形裁剪框边框
		drawCircleBox(ctx,x,y,radius,lineStyle,this.dashLineStyle);
		//绘制拉伸点在边线中间
		this.resizable && addDotsOnCircle(ctx,x,y,radius,Math.max(this.dotSize,1),this.resizeDotStyle);
	};

	/*
	* 绘制圆形裁剪框
	*/
	function drawCircleBox(ctx,x,y,radius,lineStyle,dashLineStyle){
		ctx.beginPath();
		ctx.strokeStyle = lineStyle;
		ctx.arc(x + radius,y + radius,radius,0,DOUBLEPI);//圆形裁剪框边框
		ctx.stroke();

		//中间绘制垂直虚线
		drawDashLine(
			ctx,
			covertNumToHalf(x + radius),
			covertNumToHalf(y),
			covertNumToHalf(x + radius),
			covertNumToHalf(y + radius * 2),
			dashLineStyle
		);

		//中间绘制水平虚线
		drawDashLine(
			ctx,
			covertNumToHalf(x),
			covertNumToHalf(y + radius),
			covertNumToHalf(x + radius * 2),
			covertNumToHalf(y + radius),
			dashLineStyle
		);
	}

	/*
	* 绘制拖拽点在圆形裁剪框周边中点
	*/
	function addDotsOnCircle(ctx,x,y,radius,dotSize,resizeDotStyle){
		ctx.fillStyle = resizeDotStyle;
		dotSize = dotSize || 5;

		drawFillRect(ctx,x + radius,y,dotSize);//center top
		drawFillRect(ctx,x + 2 * radius,y + radius,dotSize);//right center
		drawFillRect(ctx,x + radius,y + 2 * radius,dotSize);//center bottom
		drawFillRect(ctx,x,y + radius,dotSize);//left center
	}

	/*
	* 判断鼠标位置及拖拽状态
	*/
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
			){//left center
				canvas.style.cursor = 'w-resize';
				return MOUSECURSORWRESIZE;
			}

			if(
				x >= startX + radius - dotSize / 2
				&& x <= startX + radius + dotSize / 2
				&& y >= startY - dotSize / 2
				&& y <= startY + dotSize / 2
			){//center top
				canvas.style.cursor = 'n-resize';
				return MOUSECURSORNRESIZE;
			}

			if(
				x >= startX + radius - dotSize / 2
				&& x <= startX + radius + dotSize / 2
				&& y >= startY + 2 * radius - dotSize / 2
				&& y <= startY + 2 * radius + dotSize / 2
			){//center bottom
				canvas.style.cursor = 's-resize';
				return MOUSECURSORSRESIZE;
			}

			if(
				x >= startX + 2 * radius - dotSize / 2
				&& x <= startX + 2 * radius + dotSize / 2
				&& y >= startY + radius - dotSize / 2
				&& y <= startY + radius + dotSize / 2
			){//right bottom
				canvas.style.cursor = 'e-resize';
				return MOUSECURSORERESIZE;
			}

		}

		//当前点移至圆形中间判断位置
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

	/*
	* 拖拽圆形裁剪框
	*/
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

	/*
	* 保存裁剪结果
	*/
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

		//圆形裁剪结果必须是png格式图片
		return resCanvas.toDataURL('image/png',this.quality);
	};

	function jCrop(srcOrImg,options){
		return new Croper(srcOrImg,options);
	}
	win.jCrop = jCrop;

})(window,document);