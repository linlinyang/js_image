/*!
 * jCrop.js v2.0.0
 * (c) 2018-12 Zoro Yang
 */
(function(win,doc){
	var tempDiv = document.createElement('div'),
		MOUSEWHEELEVENT = 'onwheel' in tempDiv
							? 'wheel'
							: doc.onmousewheel !== undefined
								? 'mousewheel'
								: 'DOMMouseScroll';
	tempDiv = null;

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
		x = numberCovert(x);
		y = numberCovert(y);
		width = Math.floor(width);
		height = Math.floor(height);
		if(!!direction){//逆时针绘制矩形
			ctx.moveTo(x,y);
			ctx.lineTo(x,y + height)
			ctx.lineTo(x + width,y + height);
			ctx.lineTo(x + width,y);
		}else{//顺时针，调用原生方法
			ctx.rect(x,y,width,height);
		}
	}

	/*
	* 连接子路径的终点到转换后的x,y坐标点
	*
	* @params {ctx},CanvasRenderingContext2D;
	* @params {x} Number;终点x坐标
	* @params {y} Number;终点y坐标
	*/
	function lineTo(ctx,x,y){
		ctx.lineTo(numberCovert(x),numberCovert(y));
	}

	/*
	* 移动新路径的起点坐标移动到转换后的x,y坐标
	* @params {ctx},CanvasRenderingContext2D;
	*/
	function moveTo(ctx,x,y){
		ctx.moveTo(numberCovert(x),numberCovert(y));
	}

	/*
	* 数值向下取整再加0.5，便于canvas画1px的直线
	* @params{num} Number;要转换的值
	*/
	function numberCovert(num){
		return parseInt(num) + 0.5;
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
		sx = numberCovert(sx);
		sy = numberCovert(sy);
		dx = numberCovert(dx);
		dy = numberCovert(dy);
		dashLength = dashLength || 5;

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
	* 获取元素相对body偏移量
	* @params{el} HTMLElement;原生dom元素
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
	* 核心类
	*/
	function Croper(srcOrImg,options){
		if(!srcOrImg){
			throw new Error('The img source must be required');
		}
		assign(this,{//合并参数
			maxSize: 2000,
			croperWidth: 800,
			croperHeight: 600,
			width: 300,
			height: 300,
			shadowColor: 'rgba(0,0,0,0.4)',
			lineColor: '#39f',
			dashLineColor: 'rgba(254,254,254,0.3)',
			edgeWidth: 3,
			quality: 1,
			offBackgroundColor: 'rgba(0,0,0,0.6)',
			onBackgroundColor: 'rgba(0,0,0,0.2)',
			imgType: 'image/png',
			scalable: true,
			scaleStep: this.scaleStep,
			_zoom: 2
		},this._opts = options);

		this._loadImg(srcOrImg,this._init);
		this._uid = ++uid;
	}

	/*
	* 加载图片
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
			that._img = this;
			that._originWidth = this.width;
			that._originHeight = this.height;
			that.isImgLoaded = true;

			callback && typeof callback === 'function' && callback.call(that);

			image = that = null;
		};
	};

	/*
	* 裁剪初始化，限制图片尺寸
	*/
	Croper.prototype._init = function(){
		
		this._limitImageSize();

		this._initData();

		this._createImageSource();

		this._initCanvas();

		this._initEvent();

		this.reset();

		callhook(this,'created',this.canvas,this.width,this.height);
	};

	/*
	* 限制图片最大宽度或高度，超出则等比缩小
	*/
	Croper.prototype._limitImageSize = function(){
		var img = this._img,
			imgWidth = this._originWidth,
			imgHeight = this._originHeight,
			maxSize = this.maxSize,
			max = Math.max(imgWidth,imgHeight);

		if(max > maxSize){//超出最大尺寸限制
			var ratio = maxSize / max;
			this._originWidth = imgWidth * ratio;
			this._originHeight = imgHeight * ratio;
		}
	};

	/*
	* 初始化裁剪框数据
	*/
	Croper.prototype._initData = function(){
		var width = this.width,
			height = this.height,
			croperWidth = this.croperWidth,
			croperHeight = this.croperHeight,
			originWidth = this._originWidth,
			originHeight = this._originHeight;

		width = this.width = Math.min(width,croperWidth);
		height = this.height = Math.min(height,croperHeight);

		var maxRatio = Math.max(originWidth / croperWidth,originHeight / croperHeight),
			minRatio = Math.min(originWidth / width,originHeight / height);

		if(maxRatio > 1){//图片超出裁剪面板则等比缩放
			originWidth = this._originWidth = originWidth / maxRatio;
			originHeight = this._originHeight = originHeight / maxRatio;
		}
		//限制图片缩小最小值，不得小于裁剪框尺寸
		this._minScale = Math.max(width / originWidth,height / originHeight);

		//图片宽高均小于裁剪框则等比放大图片
		if(minRatio < 1){
			this._originWidth = originWidth / minRatio;
			this._originHeight = originHeight / minRatio;
			//限制最小缩小值，图片不能比裁剪框还小
			this._minScale = 1;
		}
	};

	/*
	* 根据图片创建图片资源的画布，放弃图片导入
	*/
	Croper.prototype._createImageSource = function(){
		var tempCanvas = doc.createElement('canvas'),
			tempCtx = tempCanvas.getContext('2d'),
			originWidth = this._originWidth,
			originHeight = this._originHeight,
			zoom = this._zoom;

		tempCanvas.width = originWidth * zoom;
		tempCanvas.height = originHeight * zoom;
		tempCanvas.style.width = originWidth + 'px';
		tempCanvas.style.height = originHeight + 'px';

		tempCtx.mozImageSmoothingEnabled = false;
	    tempCtx.webkitImageSmoothingEnabled = false;
	    tempCtx.msImageSmoothingEnabled = false;
	    tempCtx.imageSmoothingEnabled = false;
		tempCtx.drawImage(this._img,0,0,originWidth * zoom,originHeight * zoom);

		this._imageSource = tempCanvas;
	};

	/*
	* 初始化画布尺寸，取消画布锯齿
	*/
	Croper.prototype._initCanvas = function(){
		var canvas = this.canvas;

		if(canvas){
			return ;
		}

		canvas = this.canvas = doc.createElement('canvas');
		var width = this.croperWidth,
			height = this.croperHeight,
			zoom = this._zoom;

		canvas.width = width * zoom;
		canvas.height = height * zoom;
		canvas.style.width = width + 'px';
		canvas.style.height = height + 'px';

		var ctx = this.ctx = canvas.getContext('2d');
		ctx.mozImageSmoothingEnabled = false;
	    ctx.webkitImageSmoothingEnabled = false;
	    ctx.msImageSmoothingEnabled = false;
	    ctx.imageSmoothingEnabled = false;
	};

	/*
	* 初始化当前画布绑定事件
	*/
	Croper.prototype._initEvent = function(){
		this.on('mousedown',this._beginDrag.bind(this));
		this.on('mousemove',this._dragging.bind(this));
		this.on('mouseup',this._endDrag.bind(this));
		this.on(MOUSEWHEELEVENT,this._scroll.bind(this));
		this.on('touchstart',this._touchStart.bind(this),false);
		this.on('touchmove',this._touchMove.bind(this),false);
		this.on('touchend',this._touchEnd.bind(this),false);
	};

	/*
	* 当前画布事件绑定
	* @params{event} String;事件类型
	* @params{handle} Function;事件操作方法
	* @params{isBobble} Boolean;是否冒泡
	*/
	Croper.prototype.on = function(event,handler,isBobble){
		var canvas = this.canvas,
			cacheEvents = this._cacheEvents || [];

		if(!canvas){
			return ;
		}

		cacheEvents.push({
			type: event,
			handler: handler,
			isBobble: !!isBobble
		});

		canvas.addEventListener(event,handler,!!isBobble);
		this._cacheEvents = cacheEvents;
	};

	/*
	* 移除指定绑定事件，如果参数为0则移除所有绑定事件
	* @params{event} String;要移除的事件类型
	* @params{handle} Function;要移除的事件方法
	* @params{isBobble} Boolean;是否冒泡
	*/
	Croper.prototype.off = function(event,handler,isBobble){
		var canvas = this.canvas,
			cacheEvents = this._cacheEvents;

		if(!canvas || !cacheEvents){
			return ;
		}

		var len = cacheEvents.length;
		while(len--){
			var tempEvent = cacheEvents[len],
				curEvent = tempEvent.type,
				curHandler = tempEvent.handler,
				curIsBooble = tempEvent.isBooble;

			if(
				event === undefined ||//移除所有
				(//移除单个
					curEvent === event
					&& curHandler === handler
					&& curIsBooble === isBobble
				)
			){
				canvas.removeEventListener(curEvent,curHandler,curIsBooble);
				cacheEvents.splice(len,1);
			}
		}
	};

	/*
	* 开始拖拽图片
	*/
	Croper.prototype._beginDrag = function(e){
		var zoom = this._zoom;
		this._isDragging = true;
		this._distanceX = ( e.offsetX ) * zoom - this.x;
		this._distanceY = ( e.offsetY ) * zoom - this.y;
		this._backgroundColor = this.onBackgroundColor;
		this._redraw();
	};

	/*
	* 正在拖拽图片
	*/
	Croper.prototype._dragging = function(e){
		if(!this._isDragging){
			return ;
		}

		var startX = this.x,
			startY = this.y,
			x = e.offsetX,
			y = e.offsetY,
			spaceX = this.croperWidth * 0.01,
			spaceY = this.croperHeight * 0.01;

		if(x < spaceX || x > this.croperWidth * 0.99 || y < spaceY || y > this.croperHeight * 0.99){
			this._endDrag();
			return ;
		}

		var zoom = this._zoom;

		this.x = x * zoom - this._distanceX;
		this.y = y * zoom - this._distanceY;
		this._redraw();
	};

	/*
	* 结束拖拽图片
	*/
	Croper.prototype._endDrag = function(){
		this._isDragging = false;
		this._backgroundColor = this.offBackgroundColor;
		this._distanceX = this._distanceY = null;
		this._redraw();
	};

	/*
	* 滚轮事件缩放图片
	*/
	Croper.prototype._scroll = function(e){
		e.preventDefault();
		if(!this.scalable){
			return ;
		}
		var wheelDelta = e.wheelDelta
							? e.wheelDelta / -120
							: e.deltaY
								? e.deltaY / 3
								: e.detail / 3,
			scale = this.scale,
			scaleStep = parseFloat(this.scaleStep);

		if(wheelDelta === -1){//scroll up
			this.scaling(scale - scaleStep)
		}else if(wheelDelta === 1){//scroll down
			this.scaling(scale + scaleStep);
		}
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
						touches[0].clientX,
						touches[0].clientY,
						touches[1].clientX,
						touches[1].clientY
					) / distanceComputed(
						startTouches[0].clientX,
						startTouches[0].clientY,
						startTouches[1].clientX,
						startTouches[1].clientY
					),
				scaleStep = parseFloat(this.scaleStep);

			//双指距离拉大，放大图片
			if(scale > 1){
				this.scaling(this.scale + scaleStep);
			}else if(scale < 1){//双指距离缩小，缩小图片
				this.scaling(this.scale - scaleStep);
			}
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
		}else if(fingersNum == 2){//两个手指，缩放
			this._startTouches = null;
		}
	};

	/*
	* 缩放接口
	* @params{scale} Number;缩放倍数
	*/
	Croper.prototype.scaling = function(scale){
		scale = parseFloat(scale);

		if(isNaN(scale)){
			return ;
		}

		this.scale = Math.max(scale,this._minScale || 0);

		this._redraw();
	};

	/*
	* 重置图片位置和放大倍数
	*/
	Croper.prototype.reset = function(x,y,scale){
		var width = this._originWidth,
			height = this._originHeight,
			croperWidth = this.croperWidth,
			croperHeight = this.croperHeight,
			x = parseFloat(x),
			y = parseFloat(y),
			scale = parseFloat(scale),
			zoom = this._zoom;

		this.x = ( isNaN(x) ? (croperWidth - width) / 2 : x ) * zoom;
		this.y = ( isNaN(y) ? (croperHeight - height) / 2 : y ) * zoom;
		this.scale = isNaN(scale) ? 1 : scale;
		this._backgroundColor = this.offBackgroundColor;

		this._redraw();
	};

	/*
	* 裁剪面板重绘
	*/
	Croper.prototype._redraw = function(){
		this._limitPosition();

		var ctx = this.ctx,
			scale = this.scale,
			zoom = this._zoom,
			croperWidth = this.croperWidth * zoom,
			croperHeight = this.croperHeight * zoom,
			originWidth = this._originWidth * zoom,
			originHeight = this._originHeight * zoom,
			width = this.width,
			height = this.height,
			x = this.x,
			y = this.y;

		ctx.clearRect(0,0,croperWidth,croperHeight);
	    ctx.save();

	    ctx.fillStyle = this._backgroundColor;//填充裁剪面板背景色
	    ctx.fillRect(0,0,croperWidth,croperHeight);

		ctx.drawImage(
			this._imageSource,
			x,
			y,
			originWidth * scale,
			originHeight * scale
		);

	    ctx.restore();

		this._drawCropBox();
	};

	/*
	* 限制图片移动位置，防止图片移动超出裁剪框范围
	*/
	Croper.prototype._limitPosition = function(){
		var scale = this.scale,
			zoom = this._zoom,
			croperWidth = this.croperWidth * zoom,
			croperHeight = this.croperHeight * zoom,
			originWidth = this._originWidth * zoom * scale,
			originHeight = this._originHeight * zoom * scale,
			width = this.width * zoom,
			height = this.height * zoom,
			xSpace = (croperWidth - width) / 2,
			ySpace = (croperHeight - height) / 2,
			x = this.x,
			y = this.y;

		this.x = Math.max(
			Math.min(
				x,
				xSpace
			),
			croperWidth - xSpace - originWidth
		);
		
		this.y = Math.max(
			Math.min(
				y,
				ySpace
			),
			croperHeight - ySpace - originHeight
		);
	};

	/*
	* 裁剪框绘制
	*/
	Croper.prototype._drawCropBox = function(){
		var ctx = this.ctx,
			zoom = this._zoom,
			width = this.width * zoom,
			height = this.height * zoom,
			hDistance = width / 10
			vDistance = height / 10,
			edgeWidth = this.edgeWidth,
			lineColor = this.lineColor,
			shadowColor = this.shadowColor,
			croperWidth = this.croperWidth * zoom,
			croperHeight = this.croperHeight * zoom,
			x = (croperWidth - width) / 2,
			y = (croperHeight - height) / 2,
			edgeX = (croperWidth - width - edgeWidth) / 2,
			edgeY = (croperHeight - height - edgeWidth) / 2,
			cWidth = width + edgeWidth,
			cHeight = height + edgeWidth;

		/*
		* 绘制裁剪框与裁剪裁剪面板之间的阴影
		*/
		ctx.save();
		ctx.beginPath();
		ctx.fillStyle = shadowColor;
		rect(ctx,0,0,croperWidth,croperHeight,true);
		rect(ctx,x,y,width,height);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
		//绘制裁剪框与裁剪裁剪面板之间的阴影 结束

		ctx.save();
		ctx.strokeStyle = lineColor;
		/*
		* 绘制裁剪框边线
		*/
		ctx.beginPath();
		rect(ctx,x,y,width,height);
		ctx.closePath();
		ctx.stroke();
		//绘制裁剪框边线  结束

		/*
		* 绘制裁剪框边缘边线
		*/
		ctx.lineWidth = edgeWidth;
		ctx.beginPath();

		//坐上横线
		moveTo(ctx,edgeX,edgeY);
		lineTo(ctx,edgeX + hDistance,edgeY);

		//右上横线
		moveTo(ctx,edgeX + cWidth - hDistance,edgeY);
		lineTo(ctx,edgeX + cWidth,edgeY);

		//右上竖线
		moveTo(ctx,edgeX + cWidth,edgeY);
		lineTo(ctx,edgeX + cWidth,edgeY + vDistance);

		//右下竖线
		moveTo(ctx,edgeX + cWidth,edgeY + cHeight - vDistance);
		lineTo(ctx,edgeX + cWidth,edgeY + cHeight);

		//右下横线
		moveTo(ctx,edgeX + cWidth,edgeY + cHeight);
		lineTo(ctx,edgeX + cWidth - hDistance,edgeY + cHeight);

		//左下横线
		moveTo(ctx,edgeX + hDistance,edgeY + cHeight);
		lineTo(ctx,edgeX,edgeY + cHeight);

		//左下竖线
		moveTo(ctx,edgeX,edgeY + cHeight);
		lineTo(ctx,edgeX,edgeY + cHeight - vDistance);

		//右上竖线
		moveTo(ctx,edgeX,edgeY);
		lineTo(ctx,edgeX,edgeY + vDistance);

		ctx.stroke();
		ctx.restore();
		//绘制裁剪框边缘边线 结束

		/*
		* 在裁剪框中绘制虚线
		*/
		drawDashLine(//第一条水平线
			ctx,
			x,
			y + height / 3,
			x + width,
			y + height / 3,
			this.dashLineColor,
			5
		);
		drawDashLine(//第二条水平线
			ctx,
			x,
			y + (height / 3) * 2,
			x + width,
			y + (height / 3) * 2,
			this.dashLineColor,
			5
		);
		drawDashLine(//第一条垂直线
			ctx,
			x + width / 3,
			y,
			x + width / 3,
			y + height,
			this.dashLineColor,
			5
		);
		drawDashLine(//第二条垂直线
			ctx,
			x + (width / 3) * 2,
			y,
			x + (width / 3) * 2,
			y + height,
			this.dashLineColor,
			5
		);
		//绘制虚线结束
	};

	/*
	* 裁剪图片
	* 返回图片裁剪结果
	*/
	Croper.prototype.cut = function(){
		var scale = this.scale,
			zoom = this._zoom,
			croperWidth = this.croperWidth * zoom,
			croperHeight = this.croperHeight * zoom,
			originWidth = this._originWidth * scale,
			originHeight = this._originHeight * scale,
			width = this.width,
			height = this.height,
			xSpace = (croperWidth - width * zoom) / 2,
			ySpace = (croperHeight - height * zoom) / 2,
			x = this.x,
			y = this.y,
			tempCanvas = document.createElement('canvas'),
			tempCtx = tempCanvas.getContext('2d');

		tempCanvas.width = originWidth * zoom;
		tempCanvas.height = originHeight * zoom;
		tempCanvas.style.width = originWidth + 'px';
		tempCanvas.style.height = originHeight + 'px';

		tempCtx.clearRect(0,0,originWidth* zoom,originHeight* zoom);
		x = (xSpace - x);
		y = (ySpace - y);
		tempCtx.rect(x,y,width * zoom,height * zoom);
		tempCtx.clip();

		tempCtx.drawImage(
			this._imageSource,
			0,
			0,
			originWidth * zoom,
			originHeight * zoom
		);

		var resultCanvas = document.createElement('canvas'),
			resultCtx = resultCanvas.getContext('2d'),
			tempData = tempCtx.getImageData(x,y,width * zoom,height * zoom);

		resultCanvas.width = width * zoom;
		resultCanvas.height = height * zoom;
		resultCanvas.style.width = width + 'px';
		resultCanvas.style.height = height + 'px';
		resultCtx.putImageData(tempData,0,0,0,0,width * zoom,height * zoom);

		var canvas = document.createElement('canvas'),
			ctx = canvas.getContext('2d');
		canvas.width = width;
		canvas.height = height;
		ctx.drawImage(resultCanvas,0,0,width*zoom,height*zoom,0,0,width,height);

		return canvas.toDataURL('image/png',this.quality);
		//return resultCanvas.toDataURL('image/png',this.quality);
	}

	/*
	* 裁剪框销毁
	*/
	Croper.prototype.destroy = function(){
		var canvas = this.canvas;
		canvas.parentNode && canvas.parentNode.removeChild(canvas);
		this.off();
		canvas = this.canvas = this.ctx = this._imageSource = this._opts = this._cacheEvents = null;
	};

	function jCrop(srcOrImg,options){
		return new Croper(srcOrImg,options);
	}
	win.jCrop = jCrop;

})(window,document);