function Suggest(textInput, config) {
    if (!(this instanceof Suggest)) {
        return new Suggest(textInput, config);
    }
    var now = function() {
        return (new Date).getTime();
    };
    var EMPTY = "",
                SPACE = " ",
                HIDDEN = "hidden",
                NULL = null,
                UNDEFINED,
                WIN = window,
                DOC = document,
                BODY = document.body,
                ARRAY_VALUE = "[object Array]",
                EMPTY_FUNCTION = function() { },
                PREFIX_CLS = EMPTY, //全局前缀，方便自定义
                CLS_CONTAINER = PREFIX_CLS + "sug-list-container",
                CLS_CONTENT = PREFIX_CLS + "sug-list-content",
                CLS_ITEM_SELECTED = PREFIX_CLS + "sug-item-selected",
                CLS_ITEM_KEY = PREFIX_CLS + "sug-item-key",
                CLS_ITEM_RESULT = PREFIX_CLS + "sug-item-result",
                DEFAULT_VALUE = "", //input 默认值
                isIE = /\w/.test('\u0130'),
	            isIE6 = isIE && !window.XMLHttpRequest,
	            isIE9 = document.documentMode && document.documentMode === 9,
	            toString = Object.prototype.toString;

    var timeout = false, //script 请求是否过时
                timeoutID = null,
	            lockIE = NaN,
	            reqScript = '', //jsonp请求标签
	            latestReqScriptTime = '',
                scriptDataIsOut = false,  //非ie6-8判断是否数据过期
                isLocalDataSource = false, //根据config判断是否是本地数据源
                selectedIndex = -1, //选中项索引
                selectedItem = null, //当前选中项
                taobaoURL = "http://suggest.taobao.com/sug?callback=callback&q=",
                youaURL = "http://youa.baidu.com/suggest/se/s?cmd=suggest&type=kwd&max_count=10&callback=callback&keyword=",
                baiduURL = "http://suggestion.baidu.com/su?p=3&cb=window.bdsug.sug",
    //在键盘操作up,down时，忽略鼠标的mousemove,mousedown操作
                mouseMoveFlag = true,
    //config全部小写
                defaultConfig = {
                    queryname: 'wd',
                    charset: 'gbk',
                    callbackname: 'callback',
                    callbackfn: 'bdsug.sug',
                    resultkey: 's',
                    containerwidth: 0,
                    offsettop: -1,
                    usecache: true,
                    //string || json object
                    datasource: "http://suggestion.baidu.com/su?p=3&cb=window.bdsug.sug",
                    autofocus: false,
                    inputdelay: inputDelay,
                    updowndelay: updownDelay,
                    /*是否使用外部css文件,动态添加
                    *使用外部定制样式
                    * 外部定制css<style>文件
                    * 定制的className
                    * 可在_init以后调用this._setCss来修改样式
                    */
                    usestylefile: false,
                    styleid: PREFIX_CLS + "style",
                    prefixclass: PREFIX_CLS, //定制前缀
                    //事件
                    //替换
                    buildhtml: NULL,
                    formatdata: NULL,
                    //插入
                    onbeforeconstructor: NULL,
                    onbeforeinit: NULL,
                    oninit: NULL,
                    onbeforerequest: NULL,
                    onrequestload: NULL,
                    oncomplete: NULL,
                    onbeforeselect: NULL,
                    onbeforeshow: NULL,
                    onhide: NULL
                },
                CFG_RESULT_KEY = "resultkey",
                CFG_INPUT_DELAY = "inputdelay",
                inputDelay = 3000,
                CFG_UP_DOWN_DELAY = "updowndelay",
                updownDelay = 160,
                CFG_STYLE_ID = "styleid",
                callee = arguments.callee,
                ctrlLockFlag = false; //ie下使用ctrl+y/z时，不在propertychange中请求数据
    //Static
    callee._focusInstance = UNDEFINED;
    //Constructor
    function Sug(textInput, config) {
        if (!(this instanceof Sug)) {
            return new Sug();
        }
        this._regisEvent("onbeforeconstructor", config);
        this._initThis.call(this);
        this._preInit.call(this);
        this._initConfig.call(this, config);
        this.textInput = typeof textInput == 'string' ? DOC.getElementById(textInput) : textInput;

        this._regisEvent("onbeforeinit");
        this._initialize.call(this);
        this._regisEvent("oninit");
    }
    Sug.prototype = {
        constructor: Sug,
        guid: now(), //prototype对象共用实例   
        //注册外部事件
        _regisEvent: function(evType, config) {
            config = config || this.config;
            if (config&&config[evType]) {
                config[evType].call(this);
            }
        },
        _initThis: function() {
            //数据
            this._PreHandleData = NULL;
            this._HandledData = NULL;
            //this._HtmlContent = NULL;
            //劲量确保当前查询处理数据的查询关键字实时准确，最好由服务端返回，好确保缓存key:value准确，避免延时产生交叉
            this._CurrentQueryWord = EMPTY;
            this._QueryData = [];
            this._QueryData._QueryIndex = -1;
            this._CacheData = {};
            /* 数据来源类型;默认0
            * 不使用&运算
            * a,使用cache;b,使用url;c,使用传入data;
            * 0:[cache+url],1:[cache+data],2:[url],3:[data]
            */
            this._DataType = 0;
            //操作sug结果List
            //List是否有数据
            this._HasData = false;
        },
        //初始化前的任务
        _preInit: function() {
            //缓存外部config可能修改的
            this.__buildHTML__ = this.buildHTML;
            this.__formatData__ = this._formatData;
        },
        //初始化config
        _initConfig: function(_config) {
            this.config = mix(deepCopy({}, defaultConfig), _config);
            //datasource
            var that = this,
                        config = that.config,
                        _dataSource = config.datasource,
                        _useCache = config.usecache;
            //初始化稀释执行相关函数
            this._updownDiute = NULL; //updown
            this._updownDiute = this.__updownDiute__(config[CFG_UP_DOWN_DELAY] || updownDelay); //该闭包是否泄漏?验证>0?
            this._reqDiute = NULL; //request data
            this._reqDiute = this.__reqDiute__(config[CFG_INPUT_DELAY] || inputDelay);
            //className
            this._initClassName(config["prefixclass"]);
            //如果不使用外部css文件或标签则初始化样式
            if (!config["usestylefile"]) {
                this._initStyle();
            }
            //数据源
            if (typeof _dataSource === 'string') {
                that._DataType = _useCache ? 0 : 2;
                isLocalDataSource = false;
                _dataSource += (_dataSource.indexOf('?') === -1) ? '?' : '&';
                config.dataSource = _dataSource + config.callbackname + '=' + config.callbackfn;
                //初始化回调函数
                this._initCallback(config.callbackfn);
            } else {
                that._PreHandleData = _dataSource;
                that._DataType = _useCache ? 1 : 3; //本地传入数据源
                isLocalDataSource = true;
            }
            //bulidHTML
            if (!config.buildhtml) {
                that.buildHTML = that.__buildHTML__;
            } else {
                that.buildHTML = function(data) {
                    var html = config.buildhtml(data);
                    //保存键值cache
                    if (that.config.usecache)
                        that._CacheData[that._CurrentQueryWord] = html;
                    return html;
                };
            }
            //formatData  空函数相等判断?
            if (!config.formatdata) {
                that._formatData = that.__formatData__;
            } else {
                that._formatData = config.formatdata;
            }
        },
        _initClassName: function(prefix_cls) {
            var styleId = this.config[CFG_STYLE_ID];
            if (styleId == PREFIX_CLS + "style") {//判断是否用户自定义id
                styleId = prefix_cls + "style";
            }
            PREFIX_CLS = prefix_cls;
            CLS_CONTAINER = PREFIX_CLS + "sug-list-container";
            CLS_CONTENT = PREFIX_CLS + "sug-list-content";
            CLS_ITEM_SELECTED = PREFIX_CLS + "sug-item-selected";
            CLS_ITEM_KEY = PREFIX_CLS + "sug-item-key";
            CLS_ITEM_RESULT = PREFIX_CLS + "sug-item-result";
        },
        _initStyle: function() {
            var styleId = this.config[CFG_STYLE_ID];
            if (DOC.getElementById(styleId) && !PREFIX_CLS) return; //已存在并样式前缀相同时不重复初始化该样式
            var s = {};
            s["." + CLS_CONTAINER] = "border: 1px solid #ccc;background: #fff;z-index: 9999;overflow: hidden;";
            s["." + CLS_CONTENT] = "overflow: hidden;";
            s["." + CLS_CONTENT + SPACE + "ul"] = "margin:0;padding:0;";
            s["." + CLS_CONTENT + SPACE + "li"] = "cursor: default;color: #333;font-size: 14px;line-height: 20px;clear: both;float: left;width: 100%;overflow: hidden;text-decoration: none;padding: 2px 0 3px 2px;margin: 0;";
            s["." + CLS_CONTAINER + SPACE + "li" + SPACE + "span." + CLS_ITEM_KEY] = "float:left;";
            s["." + CLS_CONTAINER + SPACE + "li" + SPACE + "span." + CLS_ITEM_RESULT] = "float:right";
            s["." + CLS_CONTAINER + SPACE + "." + CLS_ITEM_SELECTED] = "background:#ddd;";
            this._setCss(s, styleId);
        },
        _setCss: setCss,
        _initialize: function() {
            this._initTextInput();
            this._initContainer();
            if (isIE6)
                this._initShim();
            //初始化
            this._initSugList();
            this._initEvent();
        },
        _initTextInput: function() {
            var textInput = this.textInput;
            textInput.setAttribute("autocomplete", "off");
            if (this.config["autofocus"]) {
                textInput.focus();
            }
        },
        _initContainer: function() {
            var that = this,
                    container = document.createElement('div'),
                    content = document.createElement('div');
            container.style.cssText = "position:absolute; visiblility:hidden;";
            addClass(container, CLS_CONTAINER);
            addClass(content, CLS_CONTENT);
            container.appendChild(content);
            BODY.insertBefore(container, BODY.firstChild);

            that.container = container;
            that.content = content;
        },
        _setContainerRegion: function() {
            var that = this;
            var inputCoords = getCoords(that.textInput);
            that.container.style.left = inputCoords.left + "px";
            that.container.style.top = inputCoords.top + that.textInput.offsetHeight + that.config["offsettop"] + "px";
            var configWidth = that.config["containerwidth"];
            that.container.style.width = (configWidth || (that.textInput.offsetWidth - 2)) + "px";

        },
        _initShim: function() {
            var iframe = document.createElement('iframe');
            iframe.src = "about:blank";
            iframe.style.cssText = "position:absolute;visibility:hidden;border:none;";
            this.container.shim = iframe;
            BODY.insertBefore(iframe, BODY.firstChild);
        },
        _setShimRegion: function() {
            var that = this, container = that.container,
                    shim = container.shim, style = container.style;
            if (shim) {
                shim.style.left = style.left;
                shim.style.top = style.top;
                shim.style.width = container.offsetWidth + "px"; //auto width时需要精确获取
                shim.style.height = container.offsetHeight + "px";
            }
        },
        _initEvent: function() {
            var that = this;
            addEvent(window, 'resize', function() {
                that._setContainerRegion();
                that._setShimRegion();
            });
            //input keyup
            //文本框内容改变触发
            addEvent(that.textInput, 'input', function(e) {
                //使用当前this作为环境
                that._inputValue(e);
            });
            addEvent(that.textInput, 'propertychange', function(e) { that._inputValue(e); }); //ie
            //hide
            that.textInput.onblur = function() {
                that._hide();
                callee._focusInstance = UNDEFINED;
            }
            //up down
            //上下按，选择内容触发
            //addEvent(document, 'keypress', _keyUpDown);//chrome,safari,ie  问题
            //keyup时chrome阻止光标移动到最前无效
            //ie向下选择后，输入框中值改变触发事件,//opera 一开始不行，后来向下选择按钮有效。。。
            addEvent(that.textInput, 'keydown', function(e) { that._keyUpDown(e); });
            addEvent(that.textInput, 'keyup', function() {
                mouseMoveFlag = true;
            });
            addEvent(that.textInput, 'focus', function(e) {
                //sugList._show.call(sugList);
            });
            addEvent(that.textInput, 'click', function(e) {
                //click处hold会在ie中需要2次点击空处才能blur
                //holdFocus(e, that.textInput);
                //sugList._show.call(sugList);
            });
            //点击选中下面选项
            addEvent(that.content, 'mousedown', function(ev) {
                if (!mouseMoveFlag) {
                    holdFocus(ev, that.textInput);
                    return;
                }
                // 非左键和中键点击
                if (eWhich(ev).which > 2) {
                    //ie下右键后input仍然有焦点为activeElement但是光标不显示
                    holdFocus(ev, that.textInput);
                    return;
                }
                ev = ev || window.event;
                var elem = ev.target || ev.srcElement;
                elem = matchElem(elem, that.content, function() {
                    return this.tagName.toLowerCase() == 'li';
                });
                that.setSelectedIndexByValue(elem);
                that.selectItem.call(that, elem);
                holdFocus.call(that, ev, that.textInput);
            });
            //"hover":
            //list item高亮  mouseover
            addEvent(that.content, 'mousemove', function(e) {
                if (!mouseMoveFlag) return;
                e = e || window.event;
                var elem = e.target || e.srcElement,
                            li = matchElem(elem, that.content, function() { return this.tagName.toLowerCase() == 'li'; });
                if (!li) return;
                //同一个li会触发2-3次,在remove时判断，是否需要remove
                that.selectItemByMouse(li);
            })
        },
        _inputValue: function(e) {
            e = e || window.event;
            var _keyCode = e.which || e.keyCode,
                    that = this,
                    val = that.textInput.value;
            callee._focusInstance = that; //?
            //that._CurrentQueryWord = val;
            //propertychange,输入框val可能会被赋初值,当val与lockie相同，如果无数据需要继续请求；使用ctrl+z/y时锁住不往下请求数据
            if (val === lockIE && (that._HasData || ctrlLockFlag)) return;
            /*若需要不断更新list，选中listItem后根据value继续更新list则在此更新lockIE,不在select时同时更新
            * 修复右键后左击显示2次list,确保lockIE为最新,更新list后也要保证lockIE值也是最新
            */
            //初始化时不检索，此时：lockIE无数据,val为空或为默认值(当lockIE有数据时，需要隐藏下面list，需要进入_reqDiute延时处理，防止交叉)
            if (!lockIE && (!val || val == DEFAULT_VALUE)) return;
            val && that._QueryData.push(val);
            lockIE = val;
            //请求数据
            that._reqDiute(val);
        },
        _keyUpDown: function(e) {
            e = e || window.event;
            var _keyCode = e.which || e.keyCode,
                    that = this,
                    targetEl = e.target || e.srcElement;
            if (targetEl == that.textInput) {
                //Enter,在ie_tester中ie6-7检测不到enter键,原生ie6-7可以检测到
                if (_keyCode == 13 || _keyCode == 108) {
                    return that.selectItem(that.getSelectedItemByIndex());
                }
                //可以用event.altKey，event.ctrlKey，event.metaKey(上有微软的旗帜)，event.shiftKey来判断对应的键是否被按下
                if (e.ctrlKey) {
                    var qData = that._QueryData,
                            qDataIndex = qData._QueryIndex,
                            maxIndex = qData.length - 1,
                            minIndex = -1;
                    //qData._QueryIndex
                    qData._QueryIndex = qDataIndex = qDataIndex == -1 ? maxIndex : qDataIndex;
                    if (_keyCode == 89) {
                        //前进
                        if (qDataIndex < maxIndex) {//最大值问题。。。这里修改值时，会再次记录querydata...
                            //?是否保证的了ctrlLockFlag瞬时为true,ff下不会触发oninput事件
                            ctrlLockFlag = true;
                            targetEl.value = lockIE = ++qDataIndex <= maxIndex ? qData[++qData._QueryIndex] : qData[qData._QueryIndex];
                            setTimeout(function() {//改变值瞬时不为false;
                                ctrlLockFlag = false;
                            }, 0);
                            //保证_CurrentQueryWord即时性，不在延时后修正?
                            //that._CurrentQueryWord = lockIE;
                            that._reqDiute(lockIE);
                        }
                        stopEvent(e); //阻止默认ctrl+y
                        return;
                    } else if (_keyCode == 90) {
                        //后退
                        if (qDataIndex > minIndex) {
                            ctrlLockFlag = true;
                            targetEl.value = lockIE = --qDataIndex > -1 ? qData[--qData._QueryIndex] : EMPTY;
                            setTimeout(function() {
                                ctrlLockFlag = false;
                            }, 0);
                            //从无数据到有数据hasData
                            //that._CurrentQueryWord = lockIE;
                            that._reqDiute(lockIE);
                        }
                        stopEvent(e);
                        return;
                    }
                }
                if (_keyCode == 27) {
                    that._hide();
                }
                var upOrDown = 0;
                if (_keyCode === 38 || _keyCode === 104) {
                    upOrDown--;
                } else if (_keyCode === 40 || _keyCode == 98) {
                    upOrDown++;
                }
                //执行向上向下选择
                if (upOrDown) {
                    mouseMoveFlag = false;
                    //失去焦点后回来按up,down继续显示sugList._show()并判断是否有数据_HasData
                    //如果是从未显示状态到显示，则第一次按键不修改selectedIndex
                    if (!that.getDisplayState()) {
                        that._show.call(that); //如果显示不了，则是没数据，其他地方保证数据一致性
                    } else {
                        that._selectItemByIndexIncrease(upOrDown);
                    }
                    //阻止光标在chrome下，按up时跳到最前
                    e.preventDefault && e.preventDefault();
                    //ie下阻止输入框不显示光标，但任然有焦点为激活对象时，按up,down时，body的scroll也跟着滚动
                    e.returnValue = false;
                    return false;
                }
            }
        },
        /* selectedIndex,selectedItem,selectedValue
        *keyboard:高亮显示某项(1),
        *   updown:取消前面选中项(2),选中新项(3),给input赋当前项值(4)
        *   enter:隐藏list,使用该选中项(5), 执行跳转等操作(6)
        *mouse:
        *   mousemove:取消前面选中项(2),选中新项(3)
        *   mousedown:选中鼠标停留项(3),给input赋当前项值(4),隐藏List,使用该选中项(5), 执行跳转等操作(6)
        */
        //select item 最终 选中某项
        //mouse,key选中后直接跳转操作，还是再按submit/enter进行进一步操作?
        selectItem: function(elem) {
            this._regisEvent("onbeforeselect");
            if (elem != selectedItem) {
                this.removeSelectedItem();
                this.setSelectedItem(elem);
            }
            this.updateInputBySelectedItem(elem);
            this._hide();
        },
        //up down延时
        __updownDiute__: function(updownDelay) {
            var that = this;
            return diuteEvent(function(upDownNum) {
                selectedIndex += upDownNum;
                var elem = that.getSelectedItemByIndex();
                that.removeSelectedItem();
                that.setSelectedItem(elem);
                that.updateInputBySelectedItem(elem);
            }, updownDelay);
        },
        _updownDiute: NULL,
        //up down 键盘，根据index的增量大小，来显示选中项，使用延迟时间
        //稀释up down按键，避免过快操作
        _selectItemByIndexIncrease: function(upDownNum) {
            this._updownDiute.call(this, upDownNum);
        },
        _reqDiute: NULL,
        //请求数据,100毫秒间隔
        __reqDiute__: function(inputDelay) {
            var that = this;
            return diuteEvent(function(val) {
                this._regisEvent("onbeforerequest");
                //val为空或者默认定义的初始值时，不请求数据，不更新lockIE,延时处理可能出现请求未完成，已经初始化，后显示未完成的请求  
                if (!val) {
                    that._initSugList();
                    return;
                }
                that._updataContent(val, that._DataType);
            }, inputDelay);
        },
        //mouse hover,会触发多次,因为多个子节点到li?
        selectItemByMouse: function(elem) {
            if (elem != selectedItem) {
                this.removeSelectedItem();
                this.setSelectedItem(elem);
                //set selectedIndex
                this.setSelectedIndexByValue(elem);
            }
        },
        //set selectedIndex
        setSelectedIndexByValue: function(item) {
            return (selectedIndex = indexOfArray(item, this._get()));
        },
        //根据selectIndex获取selectItem
        getSelectedItemByIndex: function() {
            var list = this._get(), count = list.length || 0;
            //调整selectedIndex位于0和count-1之间
            (selectedIndex >= count) && (selectedIndex = 0);
            (selectedIndex < 0) && (selectedIndex = count - 1);
            return list[selectedIndex];
        },
        //2移除之前选中项
        removeSelectedItem: function() {
            if (selectedItem) {
                do {
                    removeClass(selectedItem, CLS_ITEM_SELECTED);
                } while (hasClass(selectedItem, CLS_ITEM_SELECTED));
                selectedItem = null;
            }
        },
        //3设置选中项
        setSelectedItem: function(item) {
            if (item) {
                addClass(item, CLS_ITEM_SELECTED);
                selectedItem = item;
            }
        },
        /*4更新input中文字内容
        * elem:selectedItem
        */
        updateInputBySelectedItem: function(elem) {
            //#2更新lockie值，=运算从右往左执行
            if (elem) {
                var input = this.getSelectedItemValue(elem);
                input && (this.textInput.value = lockIE = input);
                //记录Ctrl+z/y
                this._QueryData.push(input);
            }
        },
        //获取对应item选中项的值,默认为当前选中项的值
        getSelectedItemValue: function(elem) {
            elem = elem || selectedItem;
            elem = matchElem(elem, this.content, function() {
                return this.tagName.toLowerCase() == 'li';
            });
            if (elem) {
                //鼠标点击或enter选中某项后，不需要更新sug数据
                elem = matchChild(elem, function() {
                    return this.tagName.toLowerCase() == 'span' && hasClass(this, CLS_ITEM_KEY); //(this.className.indexOf('sug-key') != -1);
                }, 0);
                if (elem) {
                    return elem.innerText || elem.textContent || elem.innerHTML || ''; //elem.innerHTML; //?是否将''空值换成当前input中的值
                }
            }
        },
        //jsonp request
        _requestData: function(q) {
            var that = this, config = this.config;
            //ie6-8的script直接替换src请求新数据，其他浏览器不重建script则不请求新数据
            if (!reqScript || !isIE || isIE9) {
                var _script = document.createElement('script'),
                    _head = document.getElementsByTagName('head')[0];
                _script.type = "text/javascript";
                //async不能解决异步执行的问题，只能是异步加载
                //如果 async 属性为 true，则脚本会相对于文档的其余部分异步执行，这样脚本会可以在页面继续解析的过程中来执行。
                _script.async = true;
                if (reqScript) {
                    _head.replaceChild(_script, reqScript);
                } else {
                    _head.appendChild(_script);
                    //ie6-8  load
                    //ie不支持onerror, opera与ie支持readyState
                    if (isIE) {
                        _script.onreadystatechange = function(e) {
                            e = e || window.event;
                            //opera的script也存在readyState,但如果请求地址不存在,是不会进入onload回调的
                            //http://www.cnblogs.com/_franky/archive/2010/06/20/1761370.html#1875070
                            if (isIE && /loaded|complete/i.test(_script.readyState)) {
                                //ie会执行2次
                                that._regisEvent("onrequestload");
                            }
                        };
                    }
                }
                reqScript = _script;
                //仅仅对非ie6-8有效判断获取过来的数据是否过期？,ie会自动abort之前的请求,不在触发onload
                var t = now();
                _script.setAttribute('data-time', t);
                latestReqScriptTime = t;
                //_script这个唯一的，用来替换的script
                //error url:op返回1个load;ff、chrome返回请求数量的error;safari返回1个error
                _script.onload = function() {
                    that._regisEvent("onrequestload");
                    //判断返回的数据是否已经过期,true则过期
                    scriptDataIsOut = (_script.getAttribute('data-time') != latestReqScriptTime);
                };
                _script.onerror = function() {
                   
                };
                /*加载script
                * http://www.cnblogs.com/rubylouvre/archive/2011/02/13/1953087.html
                * http://www.cnblogs.com/rubylouvre/archive/2011/03/01/1968397.html 
                */
            }
            /*过期：
            *  1,发送请求a前,产生最新请求b,取消a使用b；
            *  2,请求a返回数据,此时请求b,c..等已经发出,不使用a,等待最后一个请求返回数据；
            */
            reqScript.charset = config.charset; //"utf-8"; baidu使用gbk编码
            /*var t = new Date();
            reqScript.setAttribute('data-time', t);
            latestReqScriptTime = t;
            */
            //第1种过期?
            //script src设置，ie6-8已最后设置值为准，可赋值更换，chrome以先设置的值为准，不再更换...
            //最好先给script 设置 src属性  然后 再 appedChild 他 到 DOM树中，这样ie6中loaded与complete出现顺序不会乱                   
            reqScript.src = config.datasource + "&" + config.queryname + "=" + encodeURIComponent(q) + "&t=" + now();
        },
        _initCallback: function(_callbackFn) {
            if (!_callbackFn) return;
            if (typeof _callbackFn === 'string') {
                var context = setNamespace(_callbackFn),
                        lastName = _callbackFn.split('.').pop();
                context[lastName] = this._jsonpCallback;
            } else {
                _callbackFn = this._jsonpCallback;
            }
        },
        _jsonpCallback: function(data) {
            var that = callee._focusInstance;
            if (scriptDataIsOut || !data || !that) return;
            
            /*
            * 超时判断不靠谱，如果第一个请求未超时阶段发送第2个请求，并返回数据。。。
            * 目前返回数据不会出现2个数据先后颠倒，并只返回一个有用数据
            */
            that._PreHandleData = data;
            that._handlePreData(data);
        },
        //原始数据处理入口
        _handlePreData: function(preHandleData) {
            this._HandledData = this._formatData(preHandleData);
            var outHTML = this.buildHTML(this._HandledData);
            //如果没数据，则在_set初始化中会隐藏suglist
            this._set(outHTML) && this._show();
        },
        /*数据处理
        1,config数据源 || _requestData
        2,config呈现方法 || buildHTML
        */
        _formatData: function(data) {
            var key = this.config[CFG_RESULT_KEY];
            data = key ? data[key] : data;
            if (!isLocalDataSource) {
                //return data["result"];//taobao
                return data; //baidu
            }
            //local datasource
            var len = data.length, ret = [];
            for (len; len--; ) {
                if (data[len].indexOf(this._CurrentQueryWord) != -1) {//?过滤规则
                    ret.push(data[len]);
                }
            }
            return ret;
        },
        /*获取、请求数据入口
        0,cache+url
        1,cache+config.datasource
        2,url
        3,config.datasource
        */
        _updataContent: function(val, this_DataType) {
            //确保是当前正在执行的_CurrentQueryWord作为进一步确认修正?
            this._CurrentQueryWord = val;
            switch (this_DataType) {//this._DataType
                case 0:
                    var cacheValue = this._CacheData[val];
                    if (cacheValue) {
                        this._set(cacheValue) && this._show();
                    } else {
                        this._requestData(val);
                    }
                    break;
                case 1:
                    var cacheValue = this._CacheData[val];
                    if (cacheValue) {
                        this._set(cacheValue) && this._show();
                    } else {
                        this._handlePreData(this._PreHandleData);
                    }
                    break;
                case 2:
                    this._requestData(val);
                    break;
                case 3:
                    this._handlePreData(this._PreHandleData);
                    break;
                default: break;
            }
        },
        buildHTML: function(arr) {
            var html = '';
            if (isArray(arr)) {
                var len = arr.length;
                //html += "<ul>";
                for (var i = 0; i < len && i < 10; i++) {
                    //html += '<li><a href="javascript:void(0)"  >' + arr[i][0] + '<span style="float:right;">'+arr[i][1]+'</span></a></li>';
                    html += '<li>';
                    html += '<span class="' + CLS_ITEM_KEY + '">' + arr[i] + '</span>'; //arr[i][0]
                    //html += '<span class="'+CLS_ITEM_RESULT+'">' + arr[i][1] + '</span>';
                    html += '</li>';
                }
                //html += '</ul>';
            }
            //保存键值cache
            if (this.config.usecache)
                this._CacheData[this._CurrentQueryWord] = html;
            return html;
        },
        _initSugList: function() {
            //获取到新的sugList时初始化参数
            selectedIndex = -1;
            selectedItem = null;
            this._HasData = false;
            this.content.innerHTML = '';
            this._hide();
        },
        "_get": function() {
            return this.content.getElementsByTagName('li');
        },
        "_set": function(outHTML) {//_set()清空
            this._initSugList.call(this);
            //确保不展示延时的数据，与输入框不匹配
            if (outHTML && this.textInput.value == this._CurrentQueryWord) {
                //设置sugListWrap内容
                this.content.innerHTML = "<ul>" + outHTML + "</ul>";
                return this._HasData = true;
            } else {
                return false; //this._HasData = false; //that.content.innerHTML = ''; //_initSugList中以作清空
            }
        },
        "getDisplayState": function() {//注意是方法..getDisplayState()
            return this.container.style.visibility.toLowerCase() != HIDDEN;
        },
        _show: function() {
            this._regisEvent("onbeforeshow");
            //确认无数据情况下清空sugList
            if (this._HasData) {
                if (DOC.activeElement != this.textInput) return;
                var container = this.container, shim = this.container.shim;
                //显示前重新计算位置
                this._setContainerRegion();
                visible(container);
                if (shim) {
                    this._setShimRegion();
                    visible(shim);
                }
                return true;
            }
            return false; //sugList._initSugList();
        },
        _hide: function() {

            var shim = this.container.shim;
            if (shim)
                invisible(shim);
            invisible(this.container);
            this._regisEvent("onhide");
        }
    };


    //设置短时间连续执行时，光标会停止跳动
    //setInterval(function() { }, 30);
    //stop ie go back
    document.onkeydown = function(e) {
        e = e || window.event;
        var _keyCode = e.which || e.keyCode,
                targetEl = e.target || e.srcElement;
        if ((targetEl == document.body || targetEl == document.documentElement) && _keyCode == 8) {
            return false;
        }
    };
    //根据string: 如a.b.c获得当前全局执行环境相应命名空间对象
    //只返回到倒数第2个对象
    function setNamespace(_namespace, context) {
        context = context || WIN;
        if (!_namespace) return context;
        //去掉window开头的部分
        _namespace = _namespace.replace(/^window\.?/, '');
        var arr = _namespace.split('.'),
				len = arr.length,
				i = 0, p;
        for (; i < len - 1; i++) {
            p = arr[i];
            if (p in context) {
                context = context[p];
            } else {
                context = context[p] = {}; //需要更新context[p]->context
            }
        }
        return context;
    }
    function visible(elem) {
        elem.style.visibility = EMPTY;
    }
    function invisible(elem) {
        elem.style.visibility = HIDDEN;
    }
    //对象拷贝
    function deepCopy(result, source) {
        for (var key in source) {
            var copy = source[key];
            if (result === copy) continue;
            if (isPlainObject(copy)) {
                result[key] = arguments.callee(result[key] || {}, copy);
            } else if (isArray(copy)) {
                result[key] = arguments.callee(result[key] || [], copy);
            } else {
                result[key] = copy;
            }
        }
        return result;
    }
    function isPlainObject(obj) {
        if (!obj || toString.call(obj) !== "[object Object]" || obj.nodeType || obj.setInterval) {
            return false;
        }
        if (obj.constructor && !hasOwnProperty.call(obj, "constructor")
			            && !hasOwnProperty.call(obj.constructor.prototype, "isPrototypeOf")) {
            return false;
        }
        var key;
        for (key in obj) { }
        return key === undefined || hasOwnProperty.call(obj, key);
    }
    function isArray(arr) {
        return toString.call(arr) == ARRAY_VALUE;
    }
    //indexOf
    function indexOfArray(item, arr) {
        for (var i = 0, len = arr.length; i < len; ++i) {
            if (arr[i] === item) {
                return i;
            }
        }
        return -1;
    }
    //稀释事件，interval 执行密度
    function diuteEvent(fn, interval, args) {
        if (typeof fn !== 'function' || typeof interval !== 'number' || interval < 0) {
            return fn;
        }
        var timeStamp = 0, timer = null;
        return function() {
            clearTimeout(timer);
            var _args = [].slice.call(arguments, 0).concat(args),
                self = this,
                now = +new Date;
            if (now - timeStamp >= interval) {
                timeStamp = now;
                return fn.apply(self, _args); //self
            } else {
                //消除误差
                var delay = interval + timeStamp - now;
                timer = setTimeout(function() {
                    fn.apply(self, _args);
                    timeStamp = +new Date;
                }, delay > 15 ? delay : 15);
            }

        };
    }
    //elem是否在wrap子孙节点内
    function isElemInWrap(elem, wrap) {
        wrap = wrap || document.documentElement || document.body;
        while (elem) {
            if (elem == wrap) return true;
            elem = elem.parentNode;
        }
    }
    //匹配子元素elem的父元素中符合fn在wrap内的元素，返回第一个符合条件的elem
    function matchElem(elem, wrap, fn) {
        wrap = wrap || document.documentElement || document.body;
        while (elem !== wrap) {
            if (fn.call(elem, elem)) return elem;
            //不再往上检索document.docElement,没有tagName等属性(ie6没问题，有documentElement去掉<doc声明) ? body
            if (elem == document.documentElement) return;
            elem = elem.parentNode;
        }
        return; //return null?
    }
    //获取elem子元素符合fn条件的第eq(0-N)个childNode
    function matchChild(elem, fn, eq) {
        eq = eq || 0;
        var cNodes = elem.childNodes;
        len = cNodes.length,
                num = 0;
        for (var i = 0; i < len; i++) {
            if (fn.call(cNodes[i], cNodes[i])) {
                //符合条件的第num个
                if (num == eq) {
                    return cNodes[i];
                } else {
                    eq++;
                }
            }
        }
        return null;
    }
    //使输入框elem不失去焦点
    function holdFocus(ev, elem) {
        ev = ev || window.event;
        if (ev.preventDefault) {
            //w3c
            ev.preventDefault();
        } else {
            //ie
            elem.onbeforedeactivate = function() {
                ev.returnValue = false;
                elem.onbeforedeactivate = null;
            };
        }
    }

    //获取鼠标按键值，左1中2右3
    function eWhich(ev) {
        ev.which = (ev.button & 1 ? 1 : (ev.button & 2 ? 3 : (ev.button & 4 ? 2 : 0)));
        //ev.which = (ev.charCode === undefined) ? ev.keyCode : ev.charCode;
        return ev;
    }
    //bind event
    function addEvent(elem, evType, fn, useCapture) {
        if (document.addEventListener) {
            elem.addEventListener(evType, fn, false);
        } else if (document.attachEvent) {
            //elem.attachEvent('on' + evType, fn);
            //ie下，第一参数传入window.event这样不用一直取e||window.event;
            elem.attachEvent('on' + evType, function() { fn.call(elem, window.event); })
        } else {
            elem['on' + evType] = fn;
        }
        return elem;
    }
    //unbind event
    function removeEvent(elem, evType, fn, useCapture) {
        if (document.removeEventListener) {
            elem.removeEventListener(evType, fn, useCapture);
        } else if (document.detachEvent) {
            elem.detachEvent('on' + evType, fn);
        } else {
            elem['on' + evType] = null;
        }
        return elem;
    }
    //阻止默认事件、冒泡
    function stopEvent(e) {
        e = e || window.event;
        if (e.preventDefault) {
            e.preventDefault();
            e.stopPropagation();
        } else {
            e.returnValue = false;
            e.cancelBubble = true;
        }
    }
    //阻止冒泡
    function stopPropagation(e) {
        e = e || window.event;
        if (e.stopPropagation) {
            e.stopPropagation()
        } else {
            e.cancelBubble = true;
        }
    }
    //阻止默认事件
    function preventDefault(e) {
        e = e || window.event;
        if (e.preventDefault) {
            //chrome下可阻止按up键时，输入框中光标跳到最前
            e.preventDefault();
        } else {
            e.returnValue = false;
        }
    }
    //获取元素在页面上的位置
    function getCoords(el) {
        var box = el.getBoundingClientRect(),
                  doc = el.ownerDocument,
                  body = doc.body,
                  html = doc.documentElement,
                  clientTop = html.clientTop || body.clientTop || 0,
                  clientLeft = html.clientLeft || body.clientLeft || 0,
                  top = box.top + (self.pageYOffset || html.scrollTop || body.scrollTop) - clientTop,
                  left = box.left + (self.pageXOffset || html.scrollLeft || body.scrollLeft) - clientLeft;
        return { 'top': top, 'left': left };
    }
    //可添加多个className; "aaa bbb ccc" 消除重复
    function addClassNoRepeat(elem, value) {
        if (elem.nodeType === 1 && value && typeof value === 'string') {
            if (!elem.className) {
                elem.className = value;
            } else {
                //className解释效果时，只与style在html中出现的先后顺序为准，以最后一个出现的同名className解释效果，与className.sort()无关
                //消除className重复内容
                var classNames = (elem.className + " " + value).match(/\s+/g).sort(); //rspace=/\s+/g                    
                for (var len = classNames.length; --len; ) {
                    if (classNames[len] == classNames[len - 1])
                        classNames.splice(len, 1);
                }
                elem.className = classNames.join(" ");
            }
        }
    }
    //多node多className添加(div,'aaa bbb ccc'),不去除重复
    function addClass(elems, value) {
        if (value && typeof value === 'string') {
            var classNames = (value || '').split(/\s+/g);
            //elems为ElementNode时手动加进数组。。。?htmlCollection
            if (elems && elems.nodeType === 1) {
                elems = [elems];
            }
            for (var i = 0, l = elems.length; i < l; i++) {
                var elem = elems[i];
                if (elem.nodeType === 1) {
                    if (!elem.className) {
                        elem.className = value;
                    } else {
                        //className有重复无效果上影响，只判断消重新添加的className
                        var className = " " + elem.className + " ", setClass = elem.className;
                        for (var c = 0, cl = classNames.length; c < cl; c++) {
                            if ((className.indexOf(" " + classNames[c]) + " ") < 0) {
                                setClass += " " + classNames[c];
                            }
                        }
                        elem.className = rtrim(setClass);
                    }
                }
            }
        }
        return elems;
    }
    //删除elems上的classNames,不去除重复的className,不传value则清空className
    function removeClass(elems, value) {
        if ((value && typeof value === 'string') || value === void 0) {//void 0==undefined
            var classNames = (value || "").split(/\s+/g);
            if (elems && elems.nodeType === 1) {
                elems = [elems];
            }
            for (var i = 0, l = elems.length; i < l; i++) {
                var elem = elems[i];
                if (elem.nodeType === 1 && elem.className) {
                    if (value) {
                        var className = (" " + elem.className + " ").replace(/[\n\t]/g, " ");
                        for (var c = 0, cl = classNames.length; c < cl; c++) {
                            className = className.replace(" " + classNames[c] + " ", " ");
                        }
                        elem.className = rtrim(className);
                    } else {
                        elem.className = "";
                    }
                }
            }
        }
        return elems;
    }
    function hasClass(elem, value) {
        var className = " " + value + " ";
        return ((" " + elem.className + " ").replace(/[\n\t]/g, " ").indexOf(className) > -1);
    }
    function rtrim(value) {
        return (value || '').replace(/^(\s|\u00A0)+|(\s|\u00A0)+$/g, "");
    }
    /* 数组去重
    * for第三个条件不管j--还是--j都是先返回j,然后计算，下一次才使用计算后的值
    * 数组中超过数组索引的值，取当前最后一项索引值
    * for中第2个条件，初始化时会先执行一次，然后每次循环判断时执行一次
    */
    function removeRepeatItem(items) {
        if (toString.call(items) === ARRAY_VALUE) {
            items.sort();
            for (var len = items.length; --len; ) {
                if (items[len] == items[len - 1])
                    items.splice(len, 1);
            }
        }
        return items;
    }
    /**
    * 糅杂，为一个对象添加更多成员
    * @param {Object} target 目标对象
    * @param {Object} source 属性包
    * @return  {Object} 目标对象
    */
    function mix(target, source) {
        var args = [].slice.call(arguments), key,
                    ride = typeof args[args.length - 1] == "boolean" ? args.pop() : true;
        target = target || {};
        for (var i = 1; source = args[i++]; ) {
            for (key in source) {
                if (ride || !(key in target)) {
                    target[key] = source[key];
                }
            }
        }
        return target;
    }
    /*运行版本 创建style标签来添加样式，相同id时不创建新style
    * 信息保存到style id对应node上
    * 传入页面上自添加的styleNodeId时，memory为空，没有影响
    * @param Object  hash:{selector:declaration....} => {"#bodyid":"width:200px;height:200px;"}
    * @param string  styleNodeId,标签id
    */
    function setCss(hash, styleNodeId) {
        var _styleNode = document.getElementById(styleNodeId),
                    _sheet = _styleNode ? (_styleNode.sheet || _styleNode.styleSheet) : null,
                    _createStyleSheet = (function() {
                        function createStyleSheet(__sheet__) {
                            var sheet = null;
                            if (!__sheet__) {
                                var element = document.createElement('style');
                                element.type = 'text/css';
                                element.id = styleNodeId; //id
                                document.getElementsByTagName('head')[0].appendChild(element);
                                sheet = element.sheet || element.styleSheet;
                            } else {
                                sheet = __sheet__;
                            }
                            if (typeof sheet.addRule === 'undefined') {//ff
                                sheet.addRule = function(selectorText, cssText, index) {
                                    if (typeof index === 'undefined')
                                        index = this.cssRules.length;
                                    this.insertRule(selectorText + ' {' + cssText + '}', index);
                                };
                            }
                            return sheet;
                        }
                        return createStyleSheet;
                    })();
        if (_sheet && _sheet.memory) {
            for (var key in hash) {
                if (!_styleNode.memory.exists(key, hash[key])) {
                    _styleNode.memory.set(key, hash[key]);
                    _sheet.addRule(key, hash[key]);
                }
            }
        } else {
            if (_sheet) {
                _sheet = _createStyleSheet(_sheet);
            } else {
                _sheet = _createStyleSheet();
            }
            _styleNode = _sheet.ownerNode || _sheet.owningElement;
            var memory = function() {
                var keys = [], values = [], size = 0;
                return {
                    get: function(k) {
                        var results = [];
                        for (var i = 0, l = keys.length; i < l; i++) {
                            if (keys[i] == k) {
                                results.push(values[i])
                            }
                        }
                        return results;
                    },
                    exists: function(k, v) {
                        var vs = this.get(k);
                        for (var i = 0, l = vs.length; i < l; i++) {
                            if (vs[i] == v)
                                return true;
                        }
                        return false;
                    },
                    set: function(k, v) {
                        keys.push(k);
                        values.push(v);
                        size++;
                    },
                    length: function() {
                        return size;
                    }
                }
            }
            _styleNode.memory = memory();
            for (var key in hash) {
                _styleNode.memory.set(key, hash[key]);
                _sheet.addRule(key, hash[key]);
            }
        }
    }
    return new Sug(textInput, config);
} 
/*暂不解决
timeout  jq 5241，多个请求顺序不统一，可否js中断一个请求，不再返回数据?
右键list后，输入框有焦点但不显示光标
汉字输入
宽度自适应，最大、最小宽度(不设置容器宽度ie7,se360,ie6中li会自动延生最右边若float:left则li不会充满改行)
*/