// ==================== core.js ====================
// 核心系统 - 包含数据库、时间、通知、事件总线、资源管理等

(function(global) {
    'use strict';

    // ============ 1. 数据库系统 (IndexedDB) ============
    function Database(config) {
        this.name = config.name || 'PhoneSimulatorDB';
        this.version = config.version || 1;
        this.db = null;
        this.stores = config.stores || [];
    }

    Database.prototype.open = function() {
        var self = this;
        return new Promise(function(resolve, reject) {
            var request = indexedDB.open(self.name, self.version);
            
            request.onerror = function(e) {
                reject(new Error('数据库打开失败: ' + e.target.error));
            };
            
            request.onsuccess = function(e) {
                self.db = e.target.result;
                resolve(self.db);
            };
            
            request.onupgradeneeded = function(e) {
                var db = e.target.result;
                self.stores.forEach(function(store) {
                    if (!db.objectStoreNames.contains(store.name)) {
                        var objectStore = db.createObjectStore(store.name, {
                            keyPath: store.keyPath || 'id',
                            autoIncrement: store.autoIncrement || false
                        });
                        if (store.indexes) {
                            store.indexes.forEach(function(index) {
                                objectStore.createIndex(index.name, index.keyPath, {
                                    unique: index.unique || false
                                });
                            });
                        }
                    }
                });
            };
        });
    };

    Database.prototype.add = function(storeName, data) {
        var self = this;
        return new Promise(function(resolve, reject) {
            var transaction = self.db.transaction([storeName], 'readwrite');
            var store = transaction.objectStore(storeName);
            var request = store.add(data);
            request.onsuccess = function() { resolve(request.result); };
            request.onerror = function() { reject(request.error); };
        });
    };

    Database.prototype.put = function(storeName, data) {
        var self = this;
        return new Promise(function(resolve, reject) {
            var transaction = self.db.transaction([storeName], 'readwrite');
            var store = transaction.objectStore(storeName);
            var request = store.put(data);
            request.onsuccess = function() { resolve(request.result); };
            request.onerror = function() { reject(request.error); };
        });
    };

    Database.prototype.get = function(storeName, key) {
        var self = this;
        return new Promise(function(resolve, reject) {
            var transaction = self.db.transaction([storeName], 'readonly');
            var store = transaction.objectStore(storeName);
            var request = store.get(key);
            request.onsuccess = function() { resolve(request.result); };
            request.onerror = function() { reject(request.error); };
        });
    };

    Database.prototype.getAll = function(storeName) {
        var self = this;
        return new Promise(function(resolve, reject) {
            try {
                // 检查 object store 是否存在
                if (!self.db.objectStoreNames.contains(storeName)) {
                    console.warn('Object store不存在: ' + storeName);
                    resolve([]);
                    return;
                }
                var transaction = self.db.transaction([storeName], 'readonly');
                var store = transaction.objectStore(storeName);
                var request = store.getAll();
                request.onsuccess = function() { resolve(request.result || []); };
                request.onerror = function() { reject(request.error); };
            } catch (e) {
                console.error('getAll出错:', storeName, e);
                resolve([]);  // 出错时返回空数组而不是reject，避免阻塞加载
            }
        });
    };

    Database.prototype.delete = function(storeName, key) {
        var self = this;
        return new Promise(function(resolve, reject) {
            var transaction = self.db.transaction([storeName], 'readwrite');
            var store = transaction.objectStore(storeName);
            var request = store.delete(key);
            request.onsuccess = function() { resolve(); };
            request.onerror = function() { reject(request.error); };
        });
    };

    Database.prototype.clear = function(storeName) {
        var self = this;
        return new Promise(function(resolve, reject) {
            try {
                // 检查 object store 是否存在
                if (!self.db.objectStoreNames.contains(storeName)) {
                    console.warn('Object store不存在，跳过清空: ' + storeName);
                    resolve();
                    return;
                }
                var transaction = self.db.transaction([storeName], 'readwrite');
                var store = transaction.objectStore(storeName);
                var request = store.clear();
                request.onsuccess = function() { resolve(); };
                request.onerror = function() { reject(request.error); };
            } catch (e) {
                console.warn('clear失败: ' + storeName, e);
                resolve();  // 即使失败也不阻塞
            }
        });
    };

    Database.prototype.export = function() {
        var self = this;
        var exportData = {};
        var storeNames = Array.from(self.db.objectStoreNames);
        
        return Promise.all(storeNames.map(function(name) {
            return self.getAll(name).then(function(data) {
                exportData[name] = data;
            });
        })).then(function() {
            return JSON.stringify(exportData, null, 2);
        });
    };

    Database.prototype.import = function(jsonString) {
        var self = this;
        var importData = JSON.parse(jsonString);
        var promises = [];
        
        Object.keys(importData).forEach(function(storeName) {
            if (self.db.objectStoreNames.contains(storeName)) {
                promises.push(
                    self.clear(storeName).then(function() {
                        return Promise.all(importData[storeName].map(function(item) {
                            return self.put(storeName, item);
                        }));
                    })
                );
            }
        });
        
        return Promise.all(promises);
    };

    // ============ 2. 时间系统 ============
    function TimeSystem() {
        this.element = null;
        this.intervalId = null;
        this.lastCloseTime = null;
    }

    TimeSystem.prototype.init = function(elementId) {
        this.element = document.getElementById(elementId);
        this.loadLastCloseTime();
        this.startClock();
        this.bindVisibilityChange();
    };

    TimeSystem.prototype.startClock = function() {
        var self = this;
        this.updateDisplay();
        this.intervalId = setInterval(function() {
            self.updateDisplay();
        }, 1000);
    };

    TimeSystem.prototype.updateDisplay = function() {
        if (!this.element) return;
        var now = new Date();
        var hours = now.getHours().toString().padStart(2, '0');
        var minutes = now.getMinutes().toString().padStart(2, '0');
        this.element.textContent = hours + ':' + minutes;
    };

    TimeSystem.prototype.getNow = function() {
        return new Date();
    };

    TimeSystem.prototype.getFormattedTime = function() {
        var now = new Date();
        return {
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            day: now.getDate(),
            hour: now.getHours(),
            minute: now.getMinutes(),
            second: now.getSeconds(),
            weekday: ['日', '一', '二', '三', '四', '五', '六'][now.getDay()],
            timestamp: now.getTime()
        };
    };

    TimeSystem.prototype.loadLastCloseTime = function() {
        var saved = localStorage.getItem('phone_last_close_time');
        if (saved) {
            this.lastCloseTime = parseInt(saved, 10);
        }
    };

    TimeSystem.prototype.saveCloseTime = function() {
        localStorage.setItem('phone_last_close_time', Date.now().toString());
    };

    TimeSystem.prototype.getDeltaTime = function() {
        if (!this.lastCloseTime) return 0;
        return Date.now() - this.lastCloseTime;
    };

    TimeSystem.prototype.bindVisibilityChange = function() {
        var self = this;
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) {
                self.saveCloseTime();
            } else {
                self.loadLastCloseTime();
                var delta = self.getDeltaTime();
                if (delta > 0) {
                    EventBus.emit('app:resumed', { deltaTime: delta });
                }
            }
        });
        
        window.addEventListener('beforeunload', function() {
            self.saveCloseTime();
        });
    };

    // ============ 3. 事件总线 ============
    var EventBus = {
        events: {},
        
        on: function(event, callback, context) {
            if (!this.events[event]) {
                this.events[event] = [];
            }
            this.events[event].push({ callback: callback, context: context });
        },
        
        off: function(event, callback) {
            if (!this.events[event]) return;
            if (!callback) {
                delete this.events[event];
                return;
            }
            this.events[event] = this.events[event].filter(function(handler) {
                return handler.callback !== callback;
            });
        },
        
        emit: function(event, data) {
            if (!this.events[event]) return;
            this.events[event].forEach(function(handler) {
                handler.callback.call(handler.context, data);
            });
        },
        
        once: function(event, callback, context) {
            var self = this;
            function onceWrapper(data) {
                callback.call(context, data);
                self.off(event, onceWrapper);
            }
            this.on(event, onceWrapper, context);
        }
    };

    // ============ 4. 通知系统 ============
    function NotificationSystem() {
        this.queue = [];
        this.isShowing = false;
    }

    /* 【通知尺寸说明】
       - mini: 简短提示（创建成功、已保存、已复制等），只显示图标+标题，1.5秒
       - medium: 常规通知（默认），显示图标+标题+副标题，3秒
       - large: 重要通知（来电、重要消息等），显示更多信息，可点击操作 */
    NotificationSystem.prototype.send = function(config) {
        var notification = {
            id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            type: config.type || 'info',
            title: config.title || '',
            message: config.message || '',
            icon: config.icon || '',
            appId: config.appId || '',
            data: config.data || null,
            size: config.size || 'medium',  // 'mini' | 'medium' | 'large'
            duration: config.duration || (config.size === 'mini' ? 1500 : 3000),
            onClick: config.onClick || null,
            timestamp: Date.now()
        };
        
        this.queue.push(notification);
        EventBus.emit('notification:new', notification);
        
        if (!this.isShowing) {
            this.showNext();
        }
        
        return notification.id;
    };
    
    /* 【快捷方法 - Mini通知】适合简短成功/失败提示 */
    NotificationSystem.prototype.mini = function(title, type, icon) {
        return this.send({
            type: type || 'success',
            title: title,
            icon: icon || '',
            size: 'mini',
            duration: 1500
        });
    };

    NotificationSystem.prototype.showNext = function() {
        if (this.queue.length === 0) {
            this.isShowing = false;
            return;
        }
        
        this.isShowing = true;
        var notification = this.queue.shift();
        this.displayOnIsland(notification);
    };

    /* 【灵动岛通知显示】采用简化版灵动岛设计
       参考灵动岛.txt的设计原则：
       1. 移除状态指示灯和右侧操作按钮
       2. 保留核心图标和文字内容
       3. 左侧状态图标提供视觉反馈（成功/警告/错误/信息）
       4. 统一黑色主题，搭配不同状态的颜色点缀 
       
       【尺寸类型】
       - mini: 简短提示，胶囊形状，只有图标+标题
       - medium: 常规通知，图标+标题+副标题
       - large: 重要通知，更多信息 */
    NotificationSystem.prototype.displayOnIsland = function(notification) {
        var self = this;
        
        /* 【状态颜色配置】不同类型通知使用不同的强调色 */
        /* 【SVG图标】使用内联SVG替代emoji，保持视觉一致性 */
        var stateColors = {
            success: { bg: 'rgba(37,111,64,1)', color: '#4ade80', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' },
            warning: { bg: 'rgba(126,96,18,1)', color: '#fbbf24', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>' },
            error: { bg: 'rgba(124,57,57,1)', color: '#f87171', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' },
            info: { bg: 'rgba(48,83,125,1)', color: '#60a5fa', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><path fill="#fff" d="M11 7h2v2h-2zm0 4h2v6h-2z"/></svg>' },
            message: { bg: 'rgba(48,83,125,1)', color: '#60a5fa', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>' },
            call: { bg: 'rgba(37,111,64,1)', color: '#4ade80', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>' },
            system: { bg: 'rgba(71,71,74,1)', color: '#8e8e93', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>' }
        };
        
        var state = stateColors[notification.type] || stateColors.info;
        var displayIcon = notification.icon || state.icon;
        var size = notification.size || 'medium';
        
        // 根据尺寸选择不同的展示方式
        // mini: 简短提示，不可扩展
        // compact: 聊天消息通知，比mini大比medium小，不可扩展
        // medium: 需要有可扩展内容的通知（如音乐控制）
        // large: 重要的详细通知
        if (size === 'mini') {
            this.displayMiniIsland(notification, state, displayIcon);
        } else if (size === 'compact') {
            this.displayCompactIsland(notification, state, displayIcon);
        } else if (size === 'large') {
            this.displayLargeIsland(notification, state, displayIcon);
        } else {
            this.displayMediumIsland(notification, state, displayIcon);
        }
        
        if (notification.onClick) {
            DynamicIsland.el.style.cursor = 'pointer';
            DynamicIsland.el.onclick = function(e) {
                e.stopPropagation();
                notification.onClick(notification);
                self.dismiss();
            };
        }
        
        setTimeout(function() {
            self.dismiss();
        }, notification.duration);
    };
    
    /* Mini尺寸灵动岛胶囊形状，适合简短提示，图标 + 简短文字，快速消失，不可扩展 */
    NotificationSystem.prototype.displayMiniIsland = function(notification, state, displayIcon) {
        DynamicIsland.el.className = 'dynamic-island mini';
        DynamicIsland.el.setAttribute('data-expandable', 'false'); /* 标记不可扩展 */
        
        DynamicIsland.el.innerHTML = 
            '<div style="display:flex;align-items:center;justify-content:center;' +
                'padding:8px 16px;color:white;gap:10px;height:100%;">' +
                /* 【小图标】圆形背景，带微动画 */
                '<div style="width:28px;height:28px;border-radius:10px;' +
                    'background:' + state.bg + ';color:' + state.color + ';' + 'border:1px solid ' + state.color + ';' +
                    'display:flex;align-items:center;justify-content:center;' +
                    'flex-shrink:0;font-size:14px;">' +
                    displayIcon +
                '</div>' +
                /* 【简短标题】 */
                '<div style="font-size:14px;font-weight:600;color:#fff;' +
                    'max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + 
                    notification.title + 
                '</div>' +
            '</div>';
    };
    
    /* 【Compact尺寸灵动岛】用于聊天消息通知，比mini大比medium小，不可扩展 */
    NotificationSystem.prototype.displayCompactIsland = function(notification, state, displayIcon) {
        DynamicIsland.el.className = 'dynamic-island compact';
        DynamicIsland.el.setAttribute('data-expandable', 'false'); /* 标记不可扩展 */
        
        DynamicIsland.el.innerHTML = 
            '<div style="display:flex;align-items:center;padding:10px 16px;color:white;gap:12px;height:100%;">' +
                /* 【头像/图标区域】支持图片或图标 */
                '<div style="width:36px;height:36px;border-radius:50%;' +
                    'background:' + state.bg + ';color:' + state.color + ';' +
                    'display:flex;align-items:center;justify-content:center;' +
                    'flex-shrink:0;font-size:16px;overflow:hidden;">' +
                    displayIcon +
                '</div>' +
                /* 【文字内容区域】标题+消息预览 */
                '<div style="flex:1;min-width:0;overflow:hidden;">' +
                    '<div style="font-size:14px;font-weight:600;color:#fff;' +
                        'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + 
                        notification.title + 
                    '</div>' +
                    '<div style="font-size:12px;color:#aaa;margin-top:2px;' +
                        'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + 
                        (notification.message || '') + 
                    '</div>' +
                '</div>' +
            '</div>';
    };
    
    /* 【Medium尺寸灵动岛】常规通知，图标+标题+副标题 */
    NotificationSystem.prototype.displayMediumIsland = function(notification, state, displayIcon) {
        DynamicIsland.el.className = 'dynamic-island medium';
        
        DynamicIsland.el.innerHTML = 
            '<div style="display:flex;align-items:center;padding:18px 24px;color:white;">' +
                /* 【状态图标区域】使用状态对应的背景色和图标 */
                '<div style="width:40px;height:40px;border-radius:12px;' +
                    'background:' + state.bg + ';color:' + state.color + ';' +
                    'display:flex;align-items:center;justify-content:center;' +
                    'margin-right:16px;flex-shrink:0;font-size:18px;">' +
                    displayIcon +
                '</div>' +
                /* 【文字内容区域】标题加粗，副标题灰色 */
                '<div style="flex:1;overflow:hidden;">' +
                    '<div style="font-size:16px;font-weight:600;color:#fff;margin-bottom:4px;' +
                        'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + 
                        notification.title + 
                    '</div>' +
                    '<div style="font-size:14px;color:#aaa;line-height:1.4;' +
                        'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + 
                        notification.message + 
                    '</div>' +
                '</div>' +
            '</div>';
    };
    
    /* 【Large尺寸灵动岛】重要通知，显示更多信息 */
    NotificationSystem.prototype.displayLargeIsland = function(notification, state, displayIcon) {
        DynamicIsland.el.className = 'dynamic-island large';
        
        DynamicIsland.el.innerHTML = 
            '<div style="padding:20px 24px;color:white;">' +
                '<div style="display:flex;align-items:center;margin-bottom:12px;">' +
                    /* 【状态图标区域】 */
                    '<div style="width:44px;height:44px;border-radius:14px;' +
                        'background:' + state.bg + ';color:' + state.color + ';' +
                        'display:flex;align-items:center;justify-content:center;' +
                        'margin-right:16px;flex-shrink:0;font-size:20px;">' +
                        displayIcon +
                    '</div>' +
                    /* 【标题区域】 */
                    '<div style="flex:1;overflow:hidden;">' +
                        '<div style="font-size:17px;font-weight:600;color:#fff;margin-bottom:4px;">' + 
                            notification.title + 
                        '</div>' +
                        '<div style="font-size:14px;color:#aaa;">' + 
                            (notification.message || '') + 
                        '</div>' +
                    '</div>' +
                '</div>' +
                /* 【详细内容】如果有的话 */
                (notification.data && notification.data.detail ? 
                    '<div style="font-size:13px;color:#888;line-height:1.5;padding-top:12px;border-top:1px solid #333;">' + 
                        notification.data.detail + 
                    '</div>' : '') +
            '</div>';
    };

    NotificationSystem.prototype.dismiss = function() {
        var self = this;
        // 添加收缩动画
        DynamicIsland.el.style.transition = 
            'width 0.35s cubic-bezier(0.32, 0.72, 0, 1), ' +
            'height 0.35s cubic-bezier(0.32, 0.72, 0, 1), ' +
            'border-radius 0.3s cubic-bezier(0.32, 0.72, 0, 1), ' +
            'transform 0.25s ease-out';
        DynamicIsland.el.className = 'dynamic-island';
        DynamicIsland.el.innerHTML = '';
        // 移除不可扩展标记，确保灵动岛恢复正常点击响应
        DynamicIsland.el.removeAttribute('data-expandable');
        DynamicIsland.el.onclick = function(e) {
            e.stopPropagation();
            DynamicIsland.handleClick();
        };
        
        setTimeout(function() {
            self.showNext();
        }, 300);
    };

    // ============ 5. 资源管理器 ============
    function ResourceManager(database) {
        this.db = database;
    }

    // 图片大小限制（字节）
    ResourceManager.MAX_IMAGE_SIZE = 2 * 1024 * 1024;  // 2MB
    ResourceManager.MAX_GIF_SIZE = 5 * 1024 * 1024;    // GIF允许5MB
    ResourceManager.COMPRESS_TARGET_SIZE = 500 * 1024; // 压缩目标500KB
    
    ResourceManager.prototype.saveImage = function(file, options) {
        var self = this;
        options = options || {};
        
        return new Promise(function(resolve, reject) {
            var isGif = file.type === 'image/gif';
            var maxSize = isGif ? ResourceManager.MAX_GIF_SIZE : ResourceManager.MAX_IMAGE_SIZE;
            
            console.log('[ResourceManager] 保存图片:', file.name, '大小:', (file.size / 1024).toFixed(1) + 'KB', '类型:', file.type);
            
            // 如果是GIF且超过限制，询问用户
            if (isGif && file.size > maxSize) {
                if (!options.forceKeepGif) {
                    var choice = confirm(
                        'GIF文件较大（' + (file.size / 1024 / 1024).toFixed(1) + 'MB），可能导致存储问题。\n\n' +
                        '点击"确定"：保留动画但可能存储失败\n' +
                        '点击"取消"：压缩为静态图（推荐）'
                    );
                    if (!choice) {
                        // 用户选择压缩为静态图
                        return self.compressImage(file).then(resolve).catch(reject);
                    }
                }
            }
            
            // 非GIF图片且超过限制，自动压缩
            if (!isGif && file.size > ResourceManager.COMPRESS_TARGET_SIZE) {
                return self.compressImage(file).then(resolve).catch(reject);
            }
            
            // 直接保存
            var reader = new FileReader();
            reader.onload = function(e) {
                var resource = {
                    id: 'res_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    data: e.target.result,
                    createdAt: Date.now()
                };
                
                self.db.add('resources', resource).then(function() {
                    console.log('[ResourceManager] 保存成功:', resource.id);
                    resolve(resource);
                }).catch(function(err) {
                    console.error('[ResourceManager] 保存失败:', err);
                    // 如果是GIF保存失败，尝试压缩后重新保存
                    if (isGif) {
                        console.log('[ResourceManager] GIF保存失败，尝试压缩...');
                        self.compressImage(file).then(resolve).catch(reject);
                    } else {
                        reject(err);
                    }
                });
            };
            reader.onerror = function(err) {
                console.error('[ResourceManager] 读取文件失败:', err);
                reject(err);
            };
            reader.readAsDataURL(file);
        });
    };
    
    // 压缩图片（GIF会变成静态图）
    ResourceManager.prototype.compressImage = function(file) {
        var self = this;
        return new Promise(function(resolve, reject) {
            var img = new Image();
            var url = URL.createObjectURL(file);
            
            img.onload = function() {
                URL.revokeObjectURL(url);
                
                // 计算新尺寸，最大宽高300px（表情包够用了）
                var maxDim = 300;
                var width = img.width;
                var height = img.height;
                
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round(height * maxDim / width);
                        width = maxDim;
                    } else {
                        width = Math.round(width * maxDim / height);
                        height = maxDim;
                    }
                }
                
                // 使用canvas压缩
                var canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // 转换为PNG（保留透明度）或JPEG
                var hasAlpha = file.type === 'image/png' || file.type === 'image/gif';
                var outputType = hasAlpha ? 'image/png' : 'image/jpeg';
                var quality = 0.85;
                
                var dataUrl = canvas.toDataURL(outputType, quality);
                
                var resource = {
                    id: 'res_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                    name: file.name.replace(/\.[^.]+$/, hasAlpha ? '.png' : '.jpg'),
                    type: outputType,
                    size: Math.round(dataUrl.length * 0.75),  // base64大约是原始大小的1.33倍
                    data: dataUrl,
                    createdAt: Date.now(),
                    compressed: true,
                    originalSize: file.size
                };
                
                console.log('[ResourceManager] 压缩完成:', 
                    (file.size / 1024).toFixed(1) + 'KB ->', 
                    (resource.size / 1024).toFixed(1) + 'KB',
                    '尺寸:', width + 'x' + height);
                
                self.db.add('resources', resource).then(function() {
                    resolve(resource);
                }).catch(reject);
            };
            
            img.onerror = function() {
                URL.revokeObjectURL(url);
                reject(new Error('图片加载失败'));
            };
            
            img.src = url;
        });
    };

    ResourceManager.prototype.getImageUrl = function(resourceId) {
        return this.db.get('resources', resourceId).then(function(resource) {
            if (resource && resource.data) {
                return resource.data;
            }
            return null;
        });
    };

    ResourceManager.prototype.deleteResource = function(resourceId) {
        return this.db.delete('resources', resourceId);
    };

    ResourceManager.prototype.getAllResources = function() {
        return this.db.getAll('resources');
    };

    ResourceManager.prototype.createImageInput = function(callback, errorCallback) {
        var self = this;
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        
        input.onchange = function(e) {
            var file = e.target.files[0];
            if (file) {
                // 显示处理中提示
                if (window.PhoneCore && PhoneCore.notifications) {
                    PhoneCore.notifications.send({ 
                        type: 'info', 
                        title: '正在处理图片...', 
                        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 2v6h.01L6 8.01 10 12l-4 4 .01.01H6V22h12v-5.99h-.01L18 16l-4-4 4-3.99-.01-.01H18V2H6zm10 14.5V20H8v-3.5l4-4 4 4zm-4-5l-4-4V4h8v3.5l-4 4z"/></svg>', 
                        size: 'mini' 
                    });
                }
                
                self.saveImage(file).then(function(resource) {
                    if (window.PhoneCore && PhoneCore.notifications) {
                        PhoneCore.notifications.send({ 
                            type: 'success', 
                            title: '图片已保存', 
                            icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>', 
                            size: 'mini' 
                        });
                    }
                    callback(resource);
                }).catch(function(err) {
                    console.error('[ResourceManager] 图片处理失败:', err);
                    if (window.PhoneCore && PhoneCore.notifications) {
                        PhoneCore.notifications.send({ 
                            type: 'error', 
                            title: '图片保存失败', 
                            message: err.message || '请尝试使用较小的图片',
                            icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
                        });
                    }
                    if (errorCallback) errorCallback(err);
                });
            }
            input.remove();
        };
        
        document.body.appendChild(input);
        input.click();
    };

    // ============ 桌面网格系统 ============

    function DesktopGrid(config) {
        this.container = document.getElementById(config.containerId);
        this.columns = config.columns || 4;
        this.rows = config.rows || 4; /* 默认4行，与16个app位置一致 */
        this.grid = [];
        this.items = [];
        
        this.initGrid();
    }

    DesktopGrid.prototype.initGrid = function() {
        for (var row = 0; row < this.rows; row++) {
            this.grid[row] = [];
            for (var col = 0; col < this.columns; col++) {
                this.grid[row][col] = null;
            }
        }
    };

    /* ignoreId参数用于拖动时忽略自身占用的格子 */
    DesktopGrid.prototype.canPlace = function(startRow, startCol, rowSpan, colSpan, ignoreId) {
        if (startRow + rowSpan > this.rows || startCol + colSpan > this.columns) {
            return false;
        }
        if (startRow < 0 || startCol < 0) {
            return false;
        }
        
        for (var r = startRow; r < startRow + rowSpan; r++) {
            for (var c = startCol; c < startCol + colSpan; c++) {
                var cell = this.grid[r][c];
                /* 如果格子被占用且不是自身，则不可放置 */
                if (cell !== null && cell !== ignoreId) {
                    return false;
                }
            }
        }
        return true;
    };

    /* 先清除旧位置，再放置到新位置 */
    DesktopGrid.prototype.place = function(item, startRow, startCol) {
        var rowSpan = item.rowSpan || 1;
        var colSpan = item.colSpan || 1;
        
        /* 防止同一物品占用多个位置 */
        this.remove(item.id);
        
        if (!this.canPlace(startRow, startCol, rowSpan, colSpan, item.id)) {
            return false;
        }
        
        for (var r = startRow; r < startRow + rowSpan; r++) {
            for (var c = startCol; c < startCol + colSpan; c++) {
                this.grid[r][c] = item.id;
            }
        }
        
        item.gridPosition = { row: startRow, col: startCol };
        
        /* 避免重复添加 */
        var exists = this.items.some(function(i) { return i.id === item.id; });
        if (!exists) {
            this.items.push(item);
        }
        return true;
    };

    DesktopGrid.prototype.remove = function(itemId) {
        for (var r = 0; r < this.rows; r++) {
            for (var c = 0; c < this.columns; c++) {
                if (this.grid[r][c] === itemId) {
                    this.grid[r][c] = null;
                }
            }
        }
        this.items = this.items.filter(function(item) {
            return item.id !== itemId;
        });
    };

    DesktopGrid.prototype.findEmptySlot = function(rowSpan, colSpan) {
        for (var r = 0; r <= this.rows - rowSpan; r++) {
            for (var c = 0; c <= this.columns - colSpan; c++) {
                if (this.canPlace(r, c, rowSpan, colSpan)) {
                    return { row: r, col: c };
                }
            }
        }
        return null;
    };

    // ============ 小组件基类 ============

    function Widget(config) {
        this.id = config.id || 'widget_' + Date.now();
        this.appId = config.appId;
        this.name = config.name || '';
        this.size = config.size || 'medium';
        this.data = config.data || {};
        this.element = null;
        this.renderFn = config.render || null;
        
        /* 根据尺寸设置grid跨度 */
        switch (this.size) {
            case 'large':
                this.colSpan = 4;
                this.rowSpan = 2;
                break;
            case 'medium':
                this.colSpan = 2;
                this.rowSpan = 2;
                break;
            case 'small':
                this.colSpan = 2;
                this.rowSpan = 1;
                break;
            default:
                this.colSpan = 2;
                this.rowSpan = 2;
        }
        
        this.gridPosition = null;
    }

    Widget.prototype.render = function() {
        if (this.renderFn) {
            return this.renderFn(this.data);
        }
        return '<div style="padding:15px;height:100%;display:flex;align-items:center;justify-content:center;color:#666;">小组件</div>';
    };

    Widget.prototype.update = function(data) {
        this.data = Object.assign(this.data, data);
        if (this.element) {
            var content = this.element.querySelector('.widget-content');
            if (content) {
                content.innerHTML = this.render();
            }
        }
    };

    /* 创建小组件DOM元素 */
    Widget.prototype.createElement = function() {
        var self = this;
        var el = document.createElement('div');
        el.className = 'widget widget-' + this.size;
        el.id = 'widget-' + this.id;
        el.setAttribute('data-widget-id', this.id);
        el.setAttribute('data-app-id', this.appId);
        el.style.position = 'relative';
        el.style.touchAction = 'none';
        
        /* 包裹实际渲染内容，先添加 */
        var content = document.createElement('div');
        content.className = 'widget-content';
        content.innerHTML = this.render();
        el.appendChild(content);
        
        /* 后添加确保在最上层，直接绑定事件 */
        var deleteBtn = document.createElement('div');
        deleteBtn.className = 'widget-delete-btn';
        deleteBtn.innerHTML = '−';
        
        /* 确保点击一定能触发 */
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            if (PhoneCore.desktopManager) {
                PhoneCore.desktopManager.removeWidget(self.id);
                if (PhoneCore.desktopManager.widgets.length === 0) {
                    PhoneCore.desktopManager.exitEditMode();
                }
            }
        });
        
        /* 防止触发拖拽 */
        deleteBtn.addEventListener('mousedown', function(e) {
            e.stopPropagation();
        });
        deleteBtn.addEventListener('touchstart', function(e) {
            e.stopPropagation();
        });
        
        el.appendChild(deleteBtn);
        
        this.element = el;
        return el;
    };

    // ============ 分享卡片系统 ============
    function ShareCard(config) {
        this.id = 'share_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        this.type = config.type;
        this.title = config.title;
        this.description = config.description;
        this.summary = config.summary;
        this.thumbnail = config.thumbnail || '';
        this.sourceAppId = config.sourceAppId;
        this.targetData = config.targetData;
        this.createdAt = Date.now();
    }

    ShareCard.prototype.render = function() {
        return '<div class="share-card" style="' +
            'background:white;border-radius:12px;overflow:hidden;' +
            'box-shadow:0 2px 10px rgba(0,0,0,0.1);margin:8px 0;">' +
            (this.thumbnail ? '<div style="height:120px;background:url(' + this.thumbnail + ') center/cover;"></div>' : '') +
            '<div style="padding:12px;">' +
                '<div style="font-weight:600;font-size:14px;">' + this.title + '</div>' +
                '<div style="font-size:12px;color:#666;margin-top:4px;">' + this.description + '</div>' +
            '</div>' +
        '</div>';
    };

    ShareCard.prototype.getSummaryForAI = function() {
        return this.summary;
    };

    // ============ 未读消息角标系统 ============
    function BadgeManager() {
        this.badges = {};
    }

    BadgeManager.prototype.set = function(appId, count) {
        this.badges[appId] = count;
        this.updateBadgeUI(appId);
        EventBus.emit('badge:updated', { appId: appId, count: count });
    };

    BadgeManager.prototype.increment = function(appId, amount) {
        amount = amount || 1;
        this.badges[appId] = (this.badges[appId] || 0) + amount;
        this.updateBadgeUI(appId);
        EventBus.emit('badge:updated', { appId: appId, count: this.badges[appId] });
    };

    BadgeManager.prototype.clear = function(appId) {
        this.badges[appId] = 0;
        this.updateBadgeUI(appId);
        EventBus.emit('badge:updated', { appId: appId, count: 0 });
    };

    BadgeManager.prototype.get = function(appId) {
        return this.badges[appId] || 0;
    };

    BadgeManager.prototype.updateBadgeUI = function(appId) {
        var appIcon = document.getElementById(appId);
        if (!appIcon) return;
        
        var wrapper = appIcon.closest('.app-wrapper');
        if (!wrapper) return;
        
        var badge = wrapper.querySelector('.app-badge');
        var count = this.badges[appId] || 0;
        
        if (count > 0) {
            if (!badge) {
                badge = document.createElement('div');
                badge.className = 'app-badge';
                badge.style.cssText = 'position:absolute;top:-5px;right:-5px;' +
                    'background:#FF3B30;color:white;font-size:11px;font-weight:bold;' +
                    'min-width:18px;height:18px;border-radius:9px;' +
                    'display:flex;align-items:center;justify-content:center;padding:0 5px;' +
                    'z-index:100;box-shadow:0 1px 3px rgba(0,0,0,0.2);';
                wrapper.style.position = 'relative';
                wrapper.style.overflow = 'visible';
                wrapper.appendChild(badge);
            }
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'flex';
        } else if (badge) {
            badge.style.display = 'none';
        }
    };

    // ============ Prompt工厂 ============
    function PromptFactory() {
        this.templates = {};
        this.modules = {};
    }

    PromptFactory.prototype.registerTemplate = function(name, template) {
        this.templates[name] = template;
    };

    PromptFactory.prototype.registerModule = function(name, content) {
        this.modules[name] = content;
    };

    PromptFactory.prototype.build = function(config) {
        var prompt = '';
        
        if (config.modules) {
            var self = this;
            config.modules.forEach(function(moduleName) {
                if (self.modules[moduleName]) {
                    prompt += self.modules[moduleName] + '\n\n';
                }
            });
        }
        
        if (config.template && this.templates[config.template]) {
            var template = this.templates[config.template];
            if (config.variables) {
                Object.keys(config.variables).forEach(function(key) {
                    template = template.replace(new RegExp('{{' + key + '}}', 'g'), config.variables[key]);
                });
            }
            prompt += template;
        }
        
        if (config.custom) {
            prompt += '\n\n' + config.custom;
        }
        
        return prompt;
    };

    // ============ 三层表情包系统 ============
    /* 【三层表情包系统】
       第一层 StickerLibrary：用户分类，AI不读取名称
       第二层 StickerPack：AI可读取的情绪/场景名称（如"耍酷"、"伤心"）
       第三层 Sticker：具体的表情图片，名称可选（1/2/3或自定义）
       
       AI发送表情时：
       1. 根据绑定的StickerLibrary获取所有StickerPack
       2. AI决定发送哪个情绪类型（读取StickerPack.name）
       3. JS随机从该Pack中选取一个Sticker发送 */
    
    function StickerLibrary(config) {
        this.id = config.id || 'lib_' + Date.now();
        this.name = config.name || '未命名表情库';
        this.description = config.description || '';
        // 确保packIds始终是数组，即使数据库中存储的格式不正确
        this.packIds = Array.isArray(config.packIds) ? config.packIds : [];
        this.createdAt = config.createdAt || Date.now();
        this.updatedAt = Date.now();
    }
    
    StickerLibrary.prototype.addPack = function(packId) {
        if (!this.packIds.includes(packId)) {
            this.packIds.push(packId);
            this.updatedAt = Date.now();
        }
    };
    
    StickerLibrary.prototype.removePack = function(packId) {
        this.packIds = this.packIds.filter(function(id) { return id !== packId; });
        this.updatedAt = Date.now();
    };
    
    StickerLibrary.prototype.toJSON = function() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            packIds: this.packIds,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    };
    
    function StickerPack(config) {
        this.id = config.id || 'pack_' + Date.now();
        this.libraryId = config.libraryId || null;
        this.name = config.name || '未命名';  // AI会读取这个名称（如"开心"、"生气"）
        this.description = config.description || '';  // AI不读取，给用户看的描述
        // 确保stickerIds始终是数组，即使数据库中存储的格式不正确
        this.stickerIds = Array.isArray(config.stickerIds) ? config.stickerIds : [];
        this.createdAt = config.createdAt || Date.now();
        this.updatedAt = Date.now();
    }
    
    StickerPack.prototype.addSticker = function(stickerId) {
        if (!this.stickerIds.includes(stickerId)) {
            this.stickerIds.push(stickerId);
            this.updatedAt = Date.now();
        }
    };
    
    StickerPack.prototype.removeSticker = function(stickerId) {
        this.stickerIds = this.stickerIds.filter(function(id) { return id !== stickerId; });
        this.updatedAt = Date.now();
    };
    
    /* 【随机获取表情】用于AI发送时随机选择 */
    StickerPack.prototype.getRandomStickerId = function() {
        if (this.stickerIds.length === 0) return null;
        var index = Math.floor(Math.random() * this.stickerIds.length);
        return this.stickerIds[index];
    };
    
    StickerPack.prototype.toJSON = function() {
        return {
            id: this.id,
            libraryId: this.libraryId,
            name: this.name,
            description: this.description,
            stickerIds: this.stickerIds,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    };
    
    function Sticker(config) {
        this.id = config.id || 'sticker_' + Date.now();
        this.packId = config.packId || null;
        this.name = config.name || '';  // 可选名称，AI不读取
        this.resourceId = config.resourceId || null;  // 关联到resources表
        this.createdAt = config.createdAt || Date.now();
    }
    
    Sticker.prototype.toJSON = function() {
        return {
            id: this.id,
            packId: this.packId,
            name: this.name,
            resourceId: this.resourceId,
            createdAt: this.createdAt
        };
    };
    
    /* 【表情包管理器】统一管理三层结构 */
    function StickerManager(db) {
        this.db = db;
        this.libraries = {};
        this.packs = {};
        this.stickers = {};
    }
    
    StickerManager.prototype.load = function() {
        var self = this;
        
        // 检查数据库是否可用
        if (!this.db) {
            console.error('[StickerManager] 数据库未初始化');
            return Promise.reject(new Error('数据库未初始化'));
        }
        
        // 清空现有数据，重新从数据库加载
        self.libraries = {};
        self.packs = {};
        self.stickers = {};
        
        console.log('[StickerManager] 开始加载表情数据...');
        
        // 为每个数据库操作添加错误处理，确保单个表失败不会影响其他表
        return Promise.all([
            this.db.getAll('sticker_libraries').catch(function(err) {
                console.warn('[StickerManager] 加载sticker_libraries失败:', err);
                return [];
            }),
            this.db.getAll('sticker_packs').catch(function(err) {
                console.warn('[StickerManager] 加载sticker_packs失败:', err);
                return [];
            }),
            this.db.getAll('stickers').catch(function(err) {
                console.warn('[StickerManager] 加载stickers失败:', err);
                return [];
            })
        ]).then(function(results) {
            console.log('[StickerManager] 数据库查询完成，libraries:', (results[0] || []).length, 
                        'packs:', (results[1] || []).length, 
                        'stickers:', (results[2] || []).length);
            
            // 安全地处理每条数据，避免单条数据格式错误导致整体失败
            (results[0] || []).forEach(function(data) {
                try {
                    if (data && data.id) {
                        self.libraries[data.id] = new StickerLibrary(data);
                    }
                } catch (e) {
                    console.warn('[StickerManager] 解析StickerLibrary失败:', e, data);
                }
            });
            (results[1] || []).forEach(function(data) {
                try {
                    if (data && data.id) {
                        self.packs[data.id] = new StickerPack(data);
                    }
                } catch (e) {
                    console.warn('[StickerManager] 解析StickerPack失败:', e, data);
                }
            });
            (results[2] || []).forEach(function(data) {
                try {
                    if (data && data.id) {
                        self.stickers[data.id] = new Sticker(data);
                    }
                } catch (e) {
                    console.warn('[StickerManager] 解析Sticker失败:', e, data);
                }
            });
            
            console.log('[StickerManager] 加载完成');
            return true;  // 返回成功标志
        }).catch(function(err) {
            console.error('[StickerManager] 加载过程出错:', err);
            throw err;  // 重新抛出错误
        });
    };
    
    StickerManager.prototype.createLibrary = function(config) {
        var lib = new StickerLibrary(config);
        this.libraries[lib.id] = lib;
        return this.db.put('sticker_libraries', lib.toJSON()).then(function() {
            return lib;
        });
    };
    
    StickerManager.prototype.deleteLibrary = function(libraryId) {
        var self = this;
        var lib = this.libraries[libraryId];
        if (!lib) return Promise.resolve();
        
        // 删除关联的所有Pack和Sticker
        var deletePromises = lib.packIds.map(function(packId) {
            return self.deletePack(packId);
        });
        
        return Promise.all(deletePromises).then(function() {
            delete self.libraries[libraryId];
            return self.db.delete('sticker_libraries', libraryId);
        });
    };
    
    StickerManager.prototype.createPack = function(config) {
        var pack = new StickerPack(config);
        this.packs[pack.id] = pack;
        
        // 自动添加到所属Library
        if (pack.libraryId && this.libraries[pack.libraryId]) {
            this.libraries[pack.libraryId].addPack(pack.id);
            this.db.put('sticker_libraries', this.libraries[pack.libraryId].toJSON());
        }
        
        return this.db.put('sticker_packs', pack.toJSON()).then(function() {
            return pack;
        });
    };
    
    StickerManager.prototype.deletePack = function(packId) {
        var self = this;
        var pack = this.packs[packId];
        if (!pack) return Promise.resolve();
        
        // 删除关联的所有Sticker
        var deletePromises = pack.stickerIds.map(function(stickerId) {
            return self.deleteSticker(stickerId);
        });
        
        // 从Library中移除
        if (pack.libraryId && this.libraries[pack.libraryId]) {
            this.libraries[pack.libraryId].removePack(packId);
            this.db.put('sticker_libraries', this.libraries[pack.libraryId].toJSON());
        }
        
        return Promise.all(deletePromises).then(function() {
            delete self.packs[packId];
            return self.db.delete('sticker_packs', packId);
        });
    };
    
    StickerManager.prototype.createSticker = function(config) {
        var sticker = new Sticker(config);
        this.stickers[sticker.id] = sticker;
        
        // 自动添加到所属Pack
        if (sticker.packId && this.packs[sticker.packId]) {
            this.packs[sticker.packId].addSticker(sticker.id);
            this.db.put('sticker_packs', this.packs[sticker.packId].toJSON());
        }
        
        return this.db.put('stickers', sticker.toJSON()).then(function() {
            return sticker;
        });
    };
    
    StickerManager.prototype.deleteSticker = function(stickerId) {
        var sticker = this.stickers[stickerId];
        if (!sticker) return Promise.resolve();
        
        // 从Pack中移除
        if (sticker.packId && this.packs[sticker.packId]) {
            this.packs[sticker.packId].removeSticker(stickerId);
            this.db.put('sticker_packs', this.packs[sticker.packId].toJSON());
        }
        
        delete this.stickers[stickerId];
        return this.db.delete('stickers', stickerId);
    };
    
    /* 【获取AI可用的情绪列表】用于生成AI提示词 */
    StickerManager.prototype.getEmotionListForAI = function(libraryIds) {
        var self = this;
        var emotions = [];
        
        libraryIds.forEach(function(libId) {
            var lib = self.libraries[libId];
            if (!lib) return;
            
            lib.packIds.forEach(function(packId) {
                var pack = self.packs[packId];
                if (pack && !emotions.includes(pack.name)) {
                    emotions.push(pack.name);
                }
            });
        });
        
        return emotions;
    };
    
    /* 【获取AI可用的表情详细列表】包含情绪名和表情名，用于AI提示词 */
    StickerManager.prototype.getStickerDetailsForAI = function(libraryIds) {
        var self = this;
        var details = [];
        
        libraryIds.forEach(function(libId) {
            var lib = self.libraries[libId];
            if (!lib) return;
            
            lib.packIds.forEach(function(packId) {
                var pack = self.packs[packId];
                if (!pack) return;
                
                var stickerNames = [];
                pack.stickerIds.forEach(function(stickerId) {
                    var sticker = self.stickers[stickerId];
                    if (sticker && sticker.name) {
                        stickerNames.push(sticker.name);
                    }
                });
                
                details.push({
                    emotion: pack.name,
                    stickerNames: stickerNames
                });
            });
        });
        
        return details;
    };
    
    /* 【根据情绪获取随机表情】 */
    StickerManager.prototype.getRandomStickerByEmotion = function(libraryIds, emotion) {
        var self = this;
        
        for (var i = 0; i < libraryIds.length; i++) {
            var lib = this.libraries[libraryIds[i]];
            if (!lib) continue;
            
            for (var j = 0; j < lib.packIds.length; j++) {
                var pack = this.packs[lib.packIds[j]];
                if (pack && pack.name === emotion) {
                    var stickerId = pack.getRandomStickerId();
                    if (stickerId) {
                        return this.stickers[stickerId];
                    }
                }
            }
        }
        
        return null;
    };
    
    /* 【根据表情名称获取表情】 */
    StickerManager.prototype.getStickerByName = function(libraryIds, stickerName) {
        var self = this;
        
        for (var i = 0; i < libraryIds.length; i++) {
            var lib = this.libraries[libraryIds[i]];
            if (!lib) continue;
            
            for (var j = 0; j < lib.packIds.length; j++) {
                var pack = this.packs[lib.packIds[j]];
                if (!pack) continue;
                
                for (var k = 0; k < pack.stickerIds.length; k++) {
                    var sticker = this.stickers[pack.stickerIds[k]];
                    if (sticker && sticker.name === stickerName) {
                        return sticker;
                    }
                }
            }
        }
        
        return null;
    };

    // ============ 10.6 提示词分类系统 ============
    /* 【提示词分类系统】
       层级结构：Category -> Collection -> Template
       Category: 大分类（角色AI、功能性AI、App专用）
       Collection: 提示词合集，可被AI引用
       Template: 具体的提示词模板，支持变量替换 */
    
    function PromptCategory(config) {
        this.id = config.id || 'cat_' + Date.now();
        this.name = config.name || '未命名分类';
        this.description = config.description || '';
        this.type = config.type || 'role';  // 'role' | 'functional' | 'app'
        this.collectionIds = config.collectionIds || [];
        this.createdAt = config.createdAt || Date.now();
        this.updatedAt = Date.now();
    }
    
    PromptCategory.prototype.toJSON = function() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            type: this.type,
            collectionIds: this.collectionIds,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    };
    
    function PromptCollection(config) {
        this.id = config.id || 'coll_' + Date.now();
        this.categoryId = config.categoryId || null;
        this.name = config.name || '未命名合集';
        this.description = config.description || '';
        this.templateIds = config.templateIds || [];
        this.createdAt = config.createdAt || Date.now();
        this.updatedAt = Date.now();
    }
    
    PromptCollection.prototype.toJSON = function() {
        return {
            id: this.id,
            categoryId: this.categoryId,
            name: this.name,
            description: this.description,
            templateIds: this.templateIds,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    };
    
    function PromptTemplate(config) {
        this.id = config.id || 'tpl_' + Date.now();
        this.collectionId = config.collectionId || null;
        this.title = config.title || '未命名模板';
        this.content = config.content || '';
        this.variables = config.variables || [];  // [{name, description, defaultValue}]
        this.appId = config.appId || null;  // 如果设置，则为App专用
        this.createdAt = config.createdAt || Date.now();
        this.updatedAt = Date.now();
    }
    
    /* 【渲染模板】将变量替换为实际值 */
    PromptTemplate.prototype.render = function(values) {
        var content = this.content;
        var self = this;
        
        // 首先处理预定义的变量（使用默认值）
        this.variables.forEach(function(variable) {
            var value = values && values[variable.name] !== undefined 
                ? values[variable.name] 
                : variable.defaultValue || '';
            content = content.replace(new RegExp('{{' + variable.name + '}}', 'g'), value);
        });
        
        // 然后处理直接传入的 values 中的所有变量（支持常用变量如 AI_NAME、AI_PERSONALITY 等）
        if (values) {
            Object.keys(values).forEach(function(key) {
                content = content.replace(new RegExp('{{' + key + '}}', 'g'), values[key] || '');
            });
        }
        
        return content;
    };
    
    PromptTemplate.prototype.toJSON = function() {
        return {
            id: this.id,
            collectionId: this.collectionId,
            title: this.title,
            content: this.content,
            variables: this.variables,
            appId: this.appId,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    };
    
    /* 【提示词库管理器】 */
    function PromptLibraryManager(db) {
        this.db = db;
        this.categories = {};
        this.collections = {};
        this.templates = {};
    }
    
    PromptLibraryManager.prototype.load = function() {
        var self = this;
        return Promise.all([
            this.db.getAll('prompt_categories'),
            this.db.getAll('prompt_collections'),
            this.db.getAll('prompt_templates')
        ]).then(function(results) {
            results[0].forEach(function(data) {
                self.categories[data.id] = new PromptCategory(data);
            });
            results[1].forEach(function(data) {
                self.collections[data.id] = new PromptCollection(data);
            });
            results[2].forEach(function(data) {
                self.templates[data.id] = new PromptTemplate(data);
            });
        });
    };
    
    PromptLibraryManager.prototype.createCategory = function(config) {
        var cat = new PromptCategory(config);
        this.categories[cat.id] = cat;
        return this.db.put('prompt_categories', cat.toJSON()).then(function() {
            return cat;
        });
    };
    
    PromptLibraryManager.prototype.deleteCategory = function(categoryId) {
        var self = this;
        var cat = this.categories[categoryId];
        if (!cat) return Promise.resolve();
        
        var deletePromises = cat.collectionIds.map(function(collId) {
            return self.deleteCollection(collId);
        });
        
        return Promise.all(deletePromises).then(function() {
            delete self.categories[categoryId];
            return self.db.delete('prompt_categories', categoryId);
        });
    };
    
    PromptLibraryManager.prototype.createCollection = function(config) {
        var coll = new PromptCollection(config);
        this.collections[coll.id] = coll;
        
        if (coll.categoryId && this.categories[coll.categoryId]) {
            this.categories[coll.categoryId].collectionIds.push(coll.id);
            this.db.put('prompt_categories', this.categories[coll.categoryId].toJSON());
        }
        
        return this.db.put('prompt_collections', coll.toJSON()).then(function() {
            return coll;
        });
    };
    
    PromptLibraryManager.prototype.deleteCollection = function(collectionId) {
        var self = this;
        var coll = this.collections[collectionId];
        if (!coll) return Promise.resolve();
        
        var deletePromises = coll.templateIds.map(function(tplId) {
            return self.deleteTemplate(tplId);
        });
        
        if (coll.categoryId && this.categories[coll.categoryId]) {
            var cat = this.categories[coll.categoryId];
            cat.collectionIds = cat.collectionIds.filter(function(id) { return id !== collectionId; });
            this.db.put('prompt_categories', cat.toJSON());
        }
        
        return Promise.all(deletePromises).then(function() {
            delete self.collections[collectionId];
            return self.db.delete('prompt_collections', collectionId);
        });
    };
    
    PromptLibraryManager.prototype.createTemplate = function(config) {
        var tpl = new PromptTemplate(config);
        this.templates[tpl.id] = tpl;
        
        if (tpl.collectionId && this.collections[tpl.collectionId]) {
            this.collections[tpl.collectionId].templateIds.push(tpl.id);
            this.db.put('prompt_collections', this.collections[tpl.collectionId].toJSON());
        }
        
        return this.db.put('prompt_templates', tpl.toJSON()).then(function() {
            return tpl;
        });
    };
    
    PromptLibraryManager.prototype.deleteTemplate = function(templateId) {
        var tpl = this.templates[templateId];
        if (!tpl) return Promise.resolve();
        
        if (tpl.collectionId && this.collections[tpl.collectionId]) {
            var coll = this.collections[tpl.collectionId];
            coll.templateIds = coll.templateIds.filter(function(id) { return id !== templateId; });
            this.db.put('prompt_collections', coll.toJSON());
        }
        
        delete this.templates[templateId];
        return this.db.delete('prompt_templates', templateId);
    };
    
    /* 【获取分类下所有模板】 */
    PromptLibraryManager.prototype.getTemplatesByCategory = function(categoryId) {
        var self = this;
        var cat = this.categories[categoryId];
        if (!cat) return [];
        
        var templates = [];
        cat.collectionIds.forEach(function(collId) {
            var coll = self.collections[collId];
            if (coll) {
                coll.templateIds.forEach(function(tplId) {
                    if (self.templates[tplId]) {
                        templates.push(self.templates[tplId]);
                    }
                });
            }
        });
        
        return templates;
    };
    
    /* 【获取App专用模板】 */
    PromptLibraryManager.prototype.getTemplatesByApp = function(appId) {
        var self = this;
        return Object.values(this.templates).filter(function(tpl) {
            return tpl.appId === appId;
        });
    };
    
    /* 【构建AI完整提示词】根据合集IDs组合提示词 */
    PromptLibraryManager.prototype.buildPromptFromCollections = function(collectionIds, values) {
        var self = this;
        var parts = [];
        
        collectionIds.forEach(function(collId) {
            var coll = self.collections[collId];
            if (!coll) return;
            
            coll.templateIds.forEach(function(tplId) {
                var tpl = self.templates[tplId];
                if (tpl) {
                    parts.push(tpl.render(values));
                }
            });
        });
        
        return parts.join('\n\n');
    };

    // ============ 10.7 记忆浓缩系统 ============
    /* 【记忆浓缩系统】
       使用NPC AI来浓缩主角色AI的记忆
       1. MemoryCondenser定义浓缩规则和提示词
       2. 触发时读取AI的原始记忆
       3. 调用API浓缩后存储到condensed_memories */
    
    function MemoryCondenser(config) {
        this.id = config.id || 'condenser_' + Date.now();
        this.name = config.name || '未命名浓缩器';
        this.description = config.description || '';
        this.promptTemplate = config.promptTemplate || '';
        this.targetAiTypes = config.targetAiTypes || ['main'];
        this.triggerCondition = config.triggerCondition || {
            type: 'count',  // 'count' | 'time' | 'manual'
            threshold: 50   // 记忆条数阈值
        };
        this.outputFormat = config.outputFormat || 'summary';  // 'summary' | 'bullet' | 'narrative'
        this.apiConfigId = config.apiConfigId || null;
        this.createdAt = config.createdAt || Date.now();
        this.updatedAt = Date.now();
    }
    
    MemoryCondenser.prototype.buildPrompt = function(memories, aiContext) {
        var prompt = this.promptTemplate;
        
        // 替换变量
        prompt = prompt.replace(/{{AI_NAME}}/g, aiContext.name || '');
        prompt = prompt.replace(/{{AI_PERSONALITY}}/g, aiContext.personality || '');
        
        // 添加记忆内容
        var memoryText = memories.map(function(mem, index) {
            return (index + 1) + '. ' + mem.content;
        }).join('\n');
        
        prompt = prompt.replace(/{{MEMORIES}}/g, memoryText);
        prompt = prompt.replace(/{{MEMORY_COUNT}}/g, memories.length);
        
        return prompt;
    };
    
    MemoryCondenser.prototype.toJSON = function() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            promptTemplate: this.promptTemplate,
            targetAiTypes: this.targetAiTypes,
            triggerCondition: this.triggerCondition,
            outputFormat: this.outputFormat,
            apiConfigId: this.apiConfigId,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    };
    
    function CondensedMemory(config) {
        this.id = config.id || 'cmem_' + Date.now();
        this.aiId = config.aiId || null;
        this.condenserId = config.condenserId || null;
        this.originalMemoryIds = config.originalMemoryIds || [];
        this.condensedContent = config.condensedContent || '';
        this.createdAt = config.createdAt || Date.now();
    }
    
    CondensedMemory.prototype.toJSON = function() {
        return {
            id: this.id,
            aiId: this.aiId,
            condenserId: this.condenserId,
            originalMemoryIds: this.originalMemoryIds,
            condensedContent: this.condensedContent,
            createdAt: this.createdAt
        };
    };
    
    /* 【记忆浓缩管理器】 */
    function MemoryCondenserManager(db, apiManager) {
        this.db = db;
        this.apiManager = apiManager;
        this.condensers = {};
        this.condensedMemories = {};
    }
    
    MemoryCondenserManager.prototype.load = function() {
        var self = this;
        return Promise.all([
            this.db.getAll('memory_condensers'),
            this.db.getAll('condensed_memories')
        ]).then(function(results) {
            results[0].forEach(function(data) {
                self.condensers[data.id] = new MemoryCondenser(data);
            });
            results[1].forEach(function(data) {
                self.condensedMemories[data.id] = new CondensedMemory(data);
            });
        });
    };
    
    MemoryCondenserManager.prototype.createCondenser = function(config) {
        var condenser = new MemoryCondenser(config);
        this.condensers[condenser.id] = condenser;
        return this.db.put('memory_condensers', condenser.toJSON()).then(function() {
            return condenser;
        });
    };
    
    MemoryCondenserManager.prototype.updateCondenser = function(condenserId, updates) {
        var condenser = this.condensers[condenserId];
        if (!condenser) return Promise.resolve(null);
        
        Object.assign(condenser, updates);
        condenser.updatedAt = Date.now();
        
        return this.db.put('memory_condensers', condenser.toJSON()).then(function() {
            return condenser;
        });
    };
    
    MemoryCondenserManager.prototype.deleteCondenser = function(condenserId) {
        delete this.condensers[condenserId];
        return this.db.delete('memory_condensers', condenserId);
    };
    
    /* 【执行记忆浓缩】 */
    MemoryCondenserManager.prototype.condense = function(condenserId, ai) {
        var self = this;
        var condenser = this.condensers[condenserId];
        
        if (!condenser) {
            return Promise.reject(new Error('浓缩器不存在'));
        }
        
        // 获取需要浓缩的记忆
        var memories = [];
        memories = memories.concat(ai.memory.shortTerm);
        memories = memories.concat(ai.memory.longTerm);
        
        if (memories.length === 0) {
            return Promise.resolve(null);
        }
        
        // 构建提示词
        var prompt = condenser.buildPrompt(memories, {
            name: ai.name,
            personality: ai.personality
        });
        
        // 调用API
        var apiId = condenser.apiConfigId || ai.apiConfigId;
        
        return this.apiManager.call(prompt, apiId).then(function(response) {
            // 保存浓缩结果
            var condensed = new CondensedMemory({
                aiId: ai.id,
                condenserId: condenserId,
                originalMemoryIds: memories.map(function(m) { return m.id; }),
                condensedContent: response.content
            });
            
            self.condensedMemories[condensed.id] = condensed;
            
            return self.db.put('condensed_memories', condensed.toJSON()).then(function() {
                EventBus.emit('memory:condensed', {
                    aiId: ai.id,
                    condenserId: condenserId,
                    result: condensed
                });
                return condensed;
            });
        });
    };
    
    /* 【获取AI的浓缩记忆】 */
    MemoryCondenserManager.prototype.getCondensedMemoriesForAI = function(aiId) {
        var self = this;
        return Object.values(this.condensedMemories).filter(function(cm) {
            return cm.aiId === aiId;
        });
    };
    
    /* 【检查是否需要触发浓缩】 */
    MemoryCondenserManager.prototype.checkTrigger = function(ai) {
        var self = this;
        var triggeredCondensers = [];
        
        Object.values(this.condensers).forEach(function(condenser) {
            if (!condenser.targetAiTypes.includes(ai.type)) return;
            
            var condition = condenser.triggerCondition;
            var totalMemories = ai.memory.shortTerm.length + ai.memory.longTerm.length;
            
            if (condition.type === 'count' && totalMemories >= condition.threshold) {
                triggeredCondensers.push(condenser);
            }
        });
        
        return triggeredCondensers;
    };

    // ============ 10.7.5 智能记忆系统 ============
    /* 【智能记忆系统】
       负责：
       1. AI回复后自动提取新记忆
       2. 定时运行记忆维护（衰减、归档、合并）
       3. 智能匹配相关记忆供聊天使用 */
    
    function MemorySystem(apiManager) {
        this.apiManager = apiManager;
        this.maintenanceInterval = null;
        this.maintenanceIntervalMs = 30 * 60 * 1000; // 30分钟运行一次维护
        this.lastMaintenanceTime = 0;
        
        // 记忆提取的提示词模板
        this.extractPromptTemplate = '分析以下对话，提取值得AI记住的新信息。\n' +
            '只输出JSON数组，如果没有值得记忆的信息则输出空数组[]。\n' +
            '格式：[{"content":"记忆内容","keywords":["关键词1","关键词2"],"emotionIntensity":1-10的情绪强度,"category":"分类"}]\n\n' +
            '分类可选：用户个人信息、日常事件、情感表达、偏好习惯、重要事件、其他\n' +
            '注意：\n' +
            '- 只提取有价值的信息，不要提取普通的对话内容\n' +
            '- 重点关注：用户透露的个人信息、重要事件、情感表达、偏好习惯\n' +
            '- 每条记忆内容应简洁（20-50字）\n' +
            '- 如果对话很普通没有新信息，直接返回[]\n\n' +
            '对话内容：\n{{CONVERSATION}}';
    }
    
    /* 【启动记忆维护定时器】 */
    MemorySystem.prototype.startMaintenance = function() {
        var self = this;
        if (this.maintenanceInterval) return;
        
        this.maintenanceInterval = setInterval(function() {
            self.runMaintenanceForAllAIs();
        }, this.maintenanceIntervalMs);
        
        console.log('[MemorySystem] 记忆维护定时器已启动');
    };
    
    /* 【停止记忆维护定时器】 */
    MemorySystem.prototype.stopMaintenance = function() {
        if (this.maintenanceInterval) {
            clearInterval(this.maintenanceInterval);
            this.maintenanceInterval = null;
        }
    };
    
    /* 【为所有AI运行记忆维护】 */
    MemorySystem.prototype.runMaintenanceForAllAIs = function() {
        var self = this;
        if (!PhoneCore.ais) return;
        
        Object.values(PhoneCore.ais).forEach(function(ai) {
            if (ai.type === 'main' && ai.runMemoryMaintenance) {
                try {
                    ai.runMemoryMaintenance();
                    PhoneCore.saveAI(ai);
                } catch (e) {
                    console.error('[MemorySystem] 维护失败:', ai.id, e);
                }
            }
        });
        
        this.lastMaintenanceTime = Date.now();
        console.log('[MemorySystem] 记忆维护完成');
    };
    
    /* 【从对话中提取记忆】调用API分析对话并提取记忆 */
    MemorySystem.prototype.extractMemoriesFromConversation = function(aiId, conversation, apiConfigId) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai || ai.type !== 'main') {
            return Promise.resolve([]);
        }
        
        // 如果对话太短，不提取
        if (!conversation || conversation.length < 2) {
            return Promise.resolve([]);
        }
        
        // 构建对话文本
        var conversationText = conversation.map(function(msg) {
            var role = msg.role === 'user' ? '用户' : ai.name;
            return role + ': ' + (msg.content || '').substring(0, 200);
        }).join('\n');
        
        // 如果对话文本太短，不值得提取
        if (conversationText.length < 50) {
            return Promise.resolve([]);
        }
        
        var prompt = this.extractPromptTemplate.replace('{{CONVERSATION}}', conversationText);
        
        // 使用API提取记忆（使用低成本配置或NPC AI）
        var extractApiId = apiConfigId;
        if (!extractApiId && PhoneCore.api) {
            var configs = Object.keys(PhoneCore.api.configs || {});
            extractApiId = configs[0];
        }
        
        if (!extractApiId || !PhoneCore.api) {
            return Promise.resolve([]);
        }
        
        return PhoneCore.api.call(prompt, extractApiId, {
            messages: [{ role: 'user', content: '请分析并提取记忆' }],
            maxTokens: 500,
            temperature: 0.3
        }).then(function(response) {
            try {
                var content = response.content || '';
                // 尝试提取JSON数组
                var jsonMatch = content.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    var memories = JSON.parse(jsonMatch[0]);
                    if (Array.isArray(memories) && memories.length > 0) {
                        return self.addExtractedMemories(ai, memories);
                    }
                }
            } catch (e) {
                console.log('[MemorySystem] 记忆提取解析失败:', e);
            }
            return [];
        }).catch(function(err) {
            console.error('[MemorySystem] 记忆提取API调用失败:', err);
            return [];
        });
    };
    
    /* 【添加提取的记忆到AI】 */
    MemorySystem.prototype.addExtractedMemories = function(ai, memories) {
        var addedMemories = [];
        var self = this;
        
        memories.forEach(function(mem) {
            if (!mem.content) return;
            
            // 检查是否已存在相似记忆
            var isDuplicate = self.checkDuplicateMemory(ai, mem.content);
            if (isDuplicate) return;
            
            // 创建记忆单元
            var memoryData = {
                content: mem.content,
                summary: mem.content.length > 50 ? mem.content.substring(0, 50) + '...' : mem.content,
                keywords: mem.keywords || ai.extractKeywords(mem.content),
                emotionIntensity: mem.emotionIntensity || 5,
                category: mem.category || '其他',
                sourceApp: 'chatapp',
                sourceContext: '自动提取',
                baseWeight: mem.emotionIntensity >= 7 ? 7 : 5  // 高情绪强度给予更高权重
            };
            
            // 添加到活跃记忆层
            var newMem = ai.addMemory(memoryData, 'active');
            if (newMem) {
                addedMemories.push(newMem);
            }
        });
        
        if (addedMemories.length > 0) {
            PhoneCore.saveAI(ai);
            console.log('[MemorySystem] 自动提取了', addedMemories.length, '条记忆');
            
            EventBus.emit('memory:extracted', {
                aiId: ai.id,
                count: addedMemories.length,
                memories: addedMemories
            });
        }
        
        return addedMemories;
    };
    
    /* 【检查是否存在重复记忆】 */
    MemorySystem.prototype.checkDuplicateMemory = function(ai, content) {
        if (!content) return true;
        
        var allMemories = [].concat(
            ai.memory.core || [],
            ai.memory.active || [],
            ai.memory.longTerm || []
        );
        
        // 简单的内容相似度检查
        var contentLower = content.toLowerCase();
        return allMemories.some(function(mem) {
            var memContent = (mem.content || '').toLowerCase();
            // 如果内容完全相同或高度相似
            if (memContent === contentLower) return true;
            if (contentLower.indexOf(memContent) !== -1 || memContent.indexOf(contentLower) !== -1) {
                return true;
            }
            return false;
        });
    };
    
    /* 【快速本地记忆提取】不调用API，使用规则提取 */
    MemorySystem.prototype.quickExtractFromMessage = function(aiId, userMessage, aiReply) {
        var ai = PhoneCore.getAI(aiId);
        if (!ai || ai.type !== 'main') return null;
        
        // 检测用户重复提及（增强记忆权重）
        var reinforced = ai.checkUserReinforce(userMessage);
        if (reinforced) {
            PhoneCore.saveAI(ai);
        }
        
        // 简单规则提取：检测是否包含重要信息模式
        var importantPatterns = [
            { pattern: /我(叫|是|名叫)(.{2,8})/, type: '用户个人信息', weight: 8 },
            { pattern: /我的(生日|纪念日|周年).*?(\d+[月日号])/, type: '重要日期', weight: 9 },
            { pattern: /我(养了|有)(一只|一条|一个)?(.{2,6})(猫|狗|宠物)/, type: '用户个人信息', weight: 7 },
            { pattern: /我(喜欢|讨厌|爱|恨)(.{2,15})/, type: '偏好习惯', weight: 6 },
            { pattern: /我(住在|在|来自)(.{2,10})/, type: '用户个人信息', weight: 7 },
            { pattern: /(今天|昨天|刚才)(发生了|遇到了|碰到)(.{5,30})/, type: '日常事件', weight: 5 },
            { pattern: /我(很|特别|非常)(开心|难过|生气|伤心|兴奋|紧张)/, type: '情感表达', weight: 6 }
        ];
        
        var extracted = null;
        importantPatterns.some(function(p) {
            var match = userMessage.match(p.pattern);
            if (match) {
                extracted = {
                    content: userMessage.substring(0, 80),
                    category: p.type,
                    baseWeight: p.weight,
                    keywords: ai.extractKeywords(userMessage)
                };
                return true; // 只提取第一个匹配
            }
            return false;
        });
        
        if (extracted && !this.checkDuplicateMemory(ai, extracted.content)) {
            var newMem = ai.addMemory(extracted, 'active');
            if (newMem) {
                PhoneCore.saveAI(ai);
                console.log('[MemorySystem] 快速提取记忆:', extracted.content.substring(0, 30));
                return newMem;
            }
        }
        
        return null;
    };

    // ============ 10.8 AI App配置系统 ============
    /* 【AI App配置系统】
       每个AI在不同App中可以有不同的：
       1. 网络ID（用户名）
       2. 头像
       3. 使用的提示词合集
       4. 数据访问权限
       5. 是否启用记忆 */
    
    function AIAppConfig(config) {
        this.id = config.id || 'aac_' + Date.now();
        this.aiId = config.aiId || null;
        this.appId = config.appId || null;
        this.networkId = config.networkId || '';
        this.avatar = config.avatar || '';
        this.promptCollectionIds = config.promptCollectionIds || [];
        this.dataAccessLevel = config.dataAccessLevel || 'full';  // 'full' | 'limited' | 'none'
        this.memoryEnabled = config.memoryEnabled !== false;
        this.customSettings = config.customSettings || {};
        this.createdAt = config.createdAt || Date.now();
        this.updatedAt = Date.now();
    }
    
    AIAppConfig.prototype.toJSON = function() {
        return {
            id: this.id,
            aiId: this.aiId,
            appId: this.appId,
            networkId: this.networkId,
            avatar: this.avatar,
            promptCollectionIds: this.promptCollectionIds,
            dataAccessLevel: this.dataAccessLevel,
            memoryEnabled: this.memoryEnabled,
            customSettings: this.customSettings,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    };
    
    /* 【AI App配置管理器】 */
    function AIAppConfigManager(db) {
        this.db = db;
        this.configs = {};
    }
    
    AIAppConfigManager.prototype.load = function() {
        var self = this;
        return this.db.getAll('ai_app_configs').then(function(data) {
            data.forEach(function(config) {
                self.configs[config.id] = new AIAppConfig(config);
            });
        });
    };
    
    AIAppConfigManager.prototype.getConfig = function(aiId, appId) {
        var self = this;
        return Object.values(this.configs).find(function(config) {
            return config.aiId === aiId && config.appId === appId;
        });
    };
    
    AIAppConfigManager.prototype.getOrCreateConfig = function(aiId, appId) {
        var existing = this.getConfig(aiId, appId);
        if (existing) return Promise.resolve(existing);
        
        return this.createConfig({ aiId: aiId, appId: appId });
    };
    
    AIAppConfigManager.prototype.createConfig = function(config) {
        var appConfig = new AIAppConfig(config);
        this.configs[appConfig.id] = appConfig;
        return this.db.put('ai_app_configs', appConfig.toJSON()).then(function() {
            return appConfig;
        });
    };
    
    AIAppConfigManager.prototype.updateConfig = function(configId, updates) {
        var config = this.configs[configId];
        if (!config) return Promise.resolve(null);
        
        Object.assign(config, updates);
        config.updatedAt = Date.now();
        
        return this.db.put('ai_app_configs', config.toJSON()).then(function() {
            return config;
        });
    };
    
    AIAppConfigManager.prototype.deleteConfig = function(configId) {
        delete this.configs[configId];
        return this.db.delete('ai_app_configs', configId);
    };
    
    /* 【获取AI在指定App的配置】 */
    AIAppConfigManager.prototype.getConfigsForAI = function(aiId) {
        var self = this;
        return Object.values(this.configs).filter(function(config) {
            return config.aiId === aiId;
        });
    };
    
    /* 【获取App的所有AI配置】 */
    AIAppConfigManager.prototype.getConfigsForApp = function(appId) {
        var self = this;
        return Object.values(this.configs).filter(function(config) {
            return config.appId === appId;
        });
    };

    // ============ 11. 活动追踪系统（ActivityTracker）============
    /* 【活动追踪系统】用于记录用户与AI的所有互动活动
       特点：
       1. 记录音乐、游戏、聊天等活动的时间数据
       2. 数据存储在独立的store中，清空数据时不会被删除
       3. 支持实时活动追踪（开始/结束）和即时记录
       
       活动类型：
       - listening_music: 一起听音乐
       - playing_game: 一起玩游戏
       - chatting: 聊天
       - watching_video: 一起看视频
       - video_call: 视频通话
       - voice_call: 语音通话
       - custom: 自定义活动 */
    function ActivityTracker(db) {
        this.db = db;
        /* 【活动会话缓存】存储当前正在进行的活动 */
        this.activeSessions = {};
    }

    /* 【开始活动】创建一个新的活动会话
       @param config.type - 活动类型
       @param config.aiId - 参与的AI ID
       @param config.appId - 触发活动的App ID
       @param config.metadata - 额外元数据（如歌曲名、游戏名等） */
    ActivityTracker.prototype.startActivity = function(config) {
        var sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        var session = {
            id: sessionId,
            type: config.type || 'custom',
            aiId: config.aiId || null,
            aiIds: config.aiIds || (config.aiId ? [config.aiId] : []),
            appId: config.appId || '',
            metadata: config.metadata || {},
            startTime: Date.now(),
            endTime: null,
            duration: 0,
            status: 'active'
        };
        
        this.activeSessions[sessionId] = session;
        
        EventBus.emit('activity:started', session);
        
        return sessionId;
    };

    /* 【结束活动】结束活动会话并保存到数据库
       @param sessionId - 会话ID
       @param additionalData - 额外数据（如游戏得分等） */
    ActivityTracker.prototype.endActivity = function(sessionId, additionalData) {
        var self = this;
        var session = this.activeSessions[sessionId];
        
        if (!session) {
            console.warn('[ActivityTracker] 未找到活动会话:', sessionId);
            return Promise.resolve(null);
        }
        
        session.endTime = Date.now();
        session.duration = session.endTime - session.startTime;
        session.status = 'completed';
        
        if (additionalData) {
            Object.assign(session.metadata, additionalData);
        }
        
        delete this.activeSessions[sessionId];
        
        /* 【保存到数据库】活动记录存储在 activity_records store 中 */
        return this.db.add('activity_records', session).then(function() {
            EventBus.emit('activity:ended', session);
            return session;
        });
    };

    /* 【快速记录活动】用于记录瞬时活动（如发送消息）
       不需要开始/结束，直接记录一条活动 */
    ActivityTracker.prototype.recordActivity = function(config) {
        var record = {
            id: 'activity_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            type: config.type || 'custom',
            aiId: config.aiId || null,
            aiIds: config.aiIds || (config.aiId ? [config.aiId] : []),
            appId: config.appId || '',
            metadata: config.metadata || {},
            timestamp: Date.now(),
            duration: config.duration || 0,
            status: 'instant'
        };
        
        return this.db.add('activity_records', record).then(function() {
            EventBus.emit('activity:recorded', record);
            return record;
        });
    };

    /* 【增加聊天计数】专门用于聊天消息计数
       @param aiId - AI ID
       @param messageCount - 消息条数（默认1） */
    ActivityTracker.prototype.recordChatMessage = function(aiId, messageCount) {
        return this.recordActivity({
            type: 'chatting',
            aiId: aiId,
            appId: 'chat-app',
            metadata: {
                messageCount: messageCount || 1
            }
        });
    };

    /* 【获取AI的活动统计】
       @param aiId - AI ID
       @param activityType - 可选，筛选特定类型 */
    ActivityTracker.prototype.getAIActivityStats = function(aiId, activityType) {
        return this.db.getAll('activity_records').then(function(records) {
            var filtered = records.filter(function(r) {
                var matchAI = r.aiId === aiId || (r.aiIds && r.aiIds.includes(aiId));
                var matchType = !activityType || r.type === activityType;
                return matchAI && matchType;
            });
            
            /* 【统计汇总】 */
            var stats = {
                totalCount: filtered.length,
                totalDuration: 0,
                byType: {},
                byApp: {},
                firstActivity: null,
                lastActivity: null
            };
            
            filtered.forEach(function(r) {
                stats.totalDuration += r.duration || 0;
                
                /* 【按类型统计】 */
                if (!stats.byType[r.type]) {
                    stats.byType[r.type] = { count: 0, duration: 0 };
                }
                stats.byType[r.type].count++;
                stats.byType[r.type].duration += r.duration || 0;
                
                /* 【按App统计】 */
                if (r.appId) {
                    if (!stats.byApp[r.appId]) {
                        stats.byApp[r.appId] = { count: 0, duration: 0 };
                    }
                    stats.byApp[r.appId].count++;
                    stats.byApp[r.appId].duration += r.duration || 0;
                }
                
                /* 【时间范围】 */
                var timestamp = r.timestamp || r.startTime;
                if (!stats.firstActivity || timestamp < stats.firstActivity) {
                    stats.firstActivity = timestamp;
                }
                if (!stats.lastActivity || timestamp > stats.lastActivity) {
                    stats.lastActivity = timestamp;
                }
            });
            
            return stats;
        });
    };

    /* 【获取聊天统计】获取与某AI的聊天消息总数 */
    ActivityTracker.prototype.getChatStats = function(aiId) {
        return this.db.getAll('activity_records').then(function(records) {
            var chatRecords = records.filter(function(r) {
                var matchAI = r.aiId === aiId || (r.aiIds && r.aiIds.includes(aiId));
                return matchAI && r.type === 'chatting';
            });
            
            var totalMessages = 0;
            chatRecords.forEach(function(r) {
                totalMessages += (r.metadata && r.metadata.messageCount) || 1;
            });
            
            return {
                sessionCount: chatRecords.length,
                totalMessages: totalMessages,
                totalDuration: chatRecords.reduce(function(sum, r) { return sum + (r.duration || 0); }, 0)
            };
        });
    };

    /* 【获取音乐活动统计】获取与某AI一起听音乐的时长 */
    ActivityTracker.prototype.getMusicStats = function(aiId) {
        return this.getAIActivityStats(aiId, 'listening_music');
    };

    /* 【获取一起听详细统计】获取一起听音乐的详细数据，包含总时长、次数、平均时长等 */
    ActivityTracker.prototype.getListenTogetherStats = function(aiId) {
        return this.db.getAll('activity_records').then(function(records) {
            var musicRecords = records.filter(function(r) {
                var matchAI = !aiId || r.aiId === aiId || (r.aiIds && r.aiIds.includes(aiId));
                return matchAI && r.type === 'listening_music' && r.status === 'completed';
            });
            
            var stats = {
                totalSessions: musicRecords.length,
                totalDuration: 0,
                averageDuration: 0,
                longestSession: 0,
                recentSessions: [],
                byAI: {}
            };
            
            musicRecords.forEach(function(r) {
                var duration = r.duration || 0;
                stats.totalDuration += duration;
                
                if (duration > stats.longestSession) {
                    stats.longestSession = duration;
                }
                
                /* 按AI统计 */
                var recordAiId = r.aiId || (r.aiIds && r.aiIds[0]);
                if (recordAiId) {
                    if (!stats.byAI[recordAiId]) {
                        stats.byAI[recordAiId] = { sessions: 0, duration: 0 };
                    }
                    stats.byAI[recordAiId].sessions++;
                    stats.byAI[recordAiId].duration += duration;
                }
            });
            
            if (stats.totalSessions > 0) {
                stats.averageDuration = Math.round(stats.totalDuration / stats.totalSessions);
            }
            
            /* 最近5次记录 */
            stats.recentSessions = musicRecords
                .sort(function(a, b) { return (b.startTime || b.timestamp) - (a.startTime || a.timestamp); })
                .slice(0, 5)
                .map(function(r) {
                    return {
                        aiId: r.aiId,
                        duration: r.duration,
                        timestamp: r.startTime || r.timestamp,
                        metadata: r.metadata
                    };
                });
            
            return stats;
        });
    };

    /* 【格式化一起听时长】将毫秒转换为易读格式 */
    ActivityTracker.prototype.formatDuration = function(ms) {
        var seconds = Math.floor(ms / 1000);
        var hours = Math.floor(seconds / 3600);
        var minutes = Math.floor((seconds % 3600) / 60);
        var secs = seconds % 60;
        
        if (hours > 0) {
            return hours + '小时' + minutes + '分钟';
        } else if (minutes > 0) {
            return minutes + '分钟' + secs + '秒';
        } else {
            return secs + '秒';
        }
    };

    /* 【获取今日一起听统计】 */
    ActivityTracker.prototype.getTodayListenStats = function(aiId) {
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        var todayStart = today.getTime();
        
        return this.db.getAll('activity_records').then(function(records) {
            var todayRecords = records.filter(function(r) {
                var timestamp = r.startTime || r.timestamp;
                var matchAI = !aiId || r.aiId === aiId || (r.aiIds && r.aiIds.includes(aiId));
                return matchAI && r.type === 'listening_music' && timestamp >= todayStart;
            });
            
            var totalDuration = todayRecords.reduce(function(sum, r) {
                return sum + (r.duration || 0);
            }, 0);
            
            return {
                sessions: todayRecords.length,
                duration: totalDuration
            };
        });
    };

    /* 【获取游戏活动统计】获取与某AI一起玩游戏的数据 */
    ActivityTracker.prototype.getGameStats = function(aiId) {
        return this.getAIActivityStats(aiId, 'playing_game');
    };

    /* 【获取所有活动记录】可选按时间范围筛选 */
    ActivityTracker.prototype.getAllRecords = function(startTime, endTime) {
        return this.db.getAll('activity_records').then(function(records) {
            if (!startTime && !endTime) return records;
            
            return records.filter(function(r) {
                var timestamp = r.timestamp || r.startTime;
                if (startTime && timestamp < startTime) return false;
                if (endTime && timestamp > endTime) return false;
                return true;
            });
        });
    };

    /* 【获取当前活动会话】 */
    ActivityTracker.prototype.getActiveSessions = function() {
        return Object.values(this.activeSessions);
    };

    /* 【取消活动】不保存，直接丢弃 */
    ActivityTracker.prototype.cancelActivity = function(sessionId) {
        var session = this.activeSessions[sessionId];
        if (session) {
            delete this.activeSessions[sessionId];
            EventBus.emit('activity:cancelled', session);
        }
    };

    // ============ 12. 统一App基类（合并MyBaseApp和EnhancedApp）============
    /* 【统一App基类】将原来分散在index.html中的MyBaseApp和core.js中的EnhancedApp合并
       优点：
       1. 减少继承层级，代码更清晰
       2. 所有App相关功能集中管理
       3. 避免重复定义相同的方法
       
       使用方式：
       var myApp = new BaseApp({
           id: 'my-app',
           name: '我的应用',
           color: '#fff',
           statusBarStyle: 'dark',
           tabs: [...],
           island: {...}
       }); */
    function BaseApp(config) {
        /* 【基础属性】 */
        this.id = config.id;
        this.name = config.name;
        this.icon = config.icon || '';
        this.color = config.color;
        this.barStyle = config.barStyle || 'dark';
        this.statusBarStyle = config.statusBarStyle || config.barStyle || 'dark';
        this.tabs = config.tabs || [];
        this.island = config.island || null;
        
        /* 【窗口状态】 */
        this.iconEl = document.getElementById(this.id);
        this.appWindow = null;
        this.currentTabIndex = 0;
        this.isCardMode = false;
        this.isCardDragging = false;
        this.pageStack = [];
        this.detailPageHomeIndicatorEnabled = config.detailPageHomeIndicatorEnabled !== false;
        
        /* 【增强功能】角标、小组件、分享等 */
        this.badge = 0;
        this.widgets = config.widgets || [];
        this.shareTypes = config.shareTypes || [];
        this.npcPrompt = config.npcPrompt || '';
        
        /* 【AI可见信息配置】
           扩展App可以声明自己可以提供给AI的数据，会自动注册到系统配置中
           格式：{
               enabled: true,                    // 是否启用（默认true）
               name: '应用名称',                 // 在配置界面显示的名称
               icon: '<svg...>',                 // 图标（SVG字符串）
               desc: 'AI可读取的数据描述',       // 描述
               dataSources: [                    // 可配置的数据源列表
                   { id: 'source1', name: '数据源1', desc: '数据源描述', default: true },
                   ...
               ]
           } */
        this.aiVisibility = config.aiVisibility || null;
        
        /* 【缓存机制】避免重复创建DOM */
        this.windowCache = null;
        this.contentCache = {};
        
        /* 【绑定图标点击事件】
           使用立即绑定和延迟绑定两种方式确保可靠性 */
        this.bindIconClick();
    }
    
    /* 【绑定图标点击事件】
       解决图标点击需要两次的问题：
       1. 使用addEventListener确保可靠绑定
       2. 多次尝试绑定，增加延迟和重试机制 */
    BaseApp.prototype.bindIconClick = function() {
        var self = this;
        
        function bindEvent(el) {
            // 移除可能存在的旧事件
            el.removeEventListener('click', el._appClickHandler);
            // 创建新的处理函数
            el._appClickHandler = function(e) {
                e.stopPropagation();
                e.preventDefault();
                self.open();
            };
            // 使用addEventListener绑定
            el.addEventListener('click', el._appClickHandler);
        }
        
        // 尝试立即绑定
        if (this.iconEl) {
            bindEvent(this.iconEl);
        }
        
        // 延迟绑定作为备用（DOM可能还未完全准备好）
        var retryCount = 0;
        var maxRetries = 5;
        var retryDelay = 100;
        
        function retryBind() {
            self.iconEl = document.getElementById(self.id);
            if (self.iconEl) {
                bindEvent(self.iconEl);
            } else if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(retryBind, retryDelay * retryCount);
            }
        }
        
        // 启动重试机制
        setTimeout(retryBind, retryDelay);
    };

    /* 【灵动岛内容渲染】 */
    BaseApp.prototype.renderIslandContent = function(mode) {
        if (this.island && this.island.render) {
            return this.island.render(mode, this.island.state, this);
        }
        return '';
    };

    /* 【灵动岛事件绑定】 */
    BaseApp.prototype.bindIslandEvents = function(container) {
        if (this.island && this.island.bindEvents) {
            this.island.bindEvents(container, this.island.state, this);
        }
    };

    /* 【激活灵动岛】 */
    BaseApp.prototype.activateIsland = function() {
        DynamicIsland.setApp(this);
    };

    /* 【停用灵动岛】 */
    BaseApp.prototype.deactivateIsland = function() {
        if (DynamicIsland.activeApp === this) {
            DynamicIsland.clearApp();
        }
    };

    /* 【角标管理】设置角标数量 */
    BaseApp.prototype.setBadge = function(count) {
        this.badge = count;
        if (PhoneCore.badges) {
            PhoneCore.badges.set(this.id, count);
        }
    };

    /* 【角标管理】增加角标数量 */
    BaseApp.prototype.incrementBadge = function(amount) {
        this.badge = (this.badge || 0) + (amount || 1);
        if (PhoneCore.badges) {
            PhoneCore.badges.increment(this.id, amount);
        }
    };

    /* 【角标管理】清除角标 */
    BaseApp.prototype.clearBadge = function() {
        this.badge = 0;
        if (PhoneCore.badges) {
            PhoneCore.badges.clear(this.id);
        }
    };

    /* 【创建小组件】
       @param size: 小组件尺寸 'small' | 'medium' | 'large'
       @param type: 小组件类型（可选），用于区分同一App的不同小组件
       支持两种调用方式：
       1. createWidget(size, type) - 新方式，使用 renderWidget 方法渲染
       2. createWidget(size, renderFn) - 旧方式，直接传入渲染函数 */
    BaseApp.prototype.createWidget = function(size, typeOrRenderFn) {
        var self = this;
        var widgetType = typeof typeOrRenderFn === 'string' ? typeOrRenderFn : null;
        var renderFn = typeof typeOrRenderFn === 'function' ? typeOrRenderFn : null;
        
        var widget = new Widget({
            id: this.id + '_widget_' + Date.now(),
            appId: this.id,
            name: this.name,
            size: size,
            data: { type: widgetType },
            render: function(data) {
                // 优先使用传入的渲染函数，否则使用App的renderWidget方法
                if (renderFn) {
                    return renderFn.call(self, data);
                } else if (self.renderWidget) {
                    return self.renderWidget(size, data);
                }
                return '<div style="padding:15px;height:100%;display:flex;align-items:center;justify-content:center;color:#666;">小组件</div>';
            }
        });
        
        this.widgets.push(widget);
        return widget;
    };

    /* 【分享功能】创建分享卡片 */
    BaseApp.prototype.share = function(cardConfig) {
        var card = new ShareCard(Object.assign({
            sourceAppId: this.id
        }, cardConfig));
        
        EventBus.emit('share:created', card);
        return card;
    };

    /* 【渲染App窗口】使用缓存机制，避免重复创建DOM */
    BaseApp.prototype.render = function() {
        /* 【缓存检查】如果已经渲染过，直接返回 */
        if (this.windowCache && this.appWindow) {
            return;
        }
        
        var self = this;
        var win = document.createElement('div');
        win.className = 'app-window hidden';
        // 支持渐变背景
        if (this.color && this.color.indexOf('gradient') !== -1) {
            win.style.background = this.color;
        } else {
            win.style.backgroundColor = this.color;
        }
        
        var indicatorColor = this.barStyle === 'light' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.3)';
        
        // 从渐变中提取首尾颜色，用于顶部和底部区域
        var topBgStyle = '';
        var bottomBgStyle = '';
        if (this.color && this.color.indexOf('gradient') !== -1) {
            // 提取渐变中的颜色值
            var colorMatches = this.color.match(/#[0-9A-Fa-f]{3,8}|rgba?\([^)]+\)|[a-zA-Z]+(?=\s+\d)/g);
            if (colorMatches && colorMatches.length >= 1) {
                topBgStyle = 'background-color:' + colorMatches[0] + ';';
                bottomBgStyle = 'background-color:' + colorMatches[colorMatches.length - 1] + ';';
            }
        } else if (this.color) {
            topBgStyle = 'background-color:' + this.color + ';';
            bottomBgStyle = 'background-color:' + this.color + ';';
        }
        
        var tabBarHtml = '';
        var tabContentHtml = '';
        
        if (this.tabs.length > 0) {
            var tabItems = this.tabs.map(function(tab, index) {
                var activeClass = index === 0 ? 'active' : '';
                return '<div class="app-tab-item ' + activeClass + '" data-index="' + index + '">' +
                           '<span class="tab-icon">' + tab.icon + '</span>' +
                           '<span>' + tab.name + '</span>' +
                       '</div>';
            }).join('');
            
            tabBarHtml = '<div class="app-tab-bar">' + tabItems + '</div>';
            tabContentHtml = this.tabs[0].content || '';
        }
        
        win.innerHTML = 
            '<div class="app-status-bar-gap" style="' + topBgStyle + '"></div>' +
            '<div class="app-page-stack">' +
                '<div class="app-content-page" id="main-content-area">' + tabContentHtml + '</div>' +
            '</div>' +
            tabBarHtml +
            '<div class="app-bottom-indicator-wrap" style="' + bottomBgStyle + '">' +
                '<div class="home-indicator-area"></div>' +
                '<div class="home-indicator" style="background-color:' + indicatorColor + ';"></div>' +
            '</div>';
        
        document.getElementById('appContainer').appendChild(win);
        this.appWindow = win;
        
        this.bindTabEvents();
        this.bindHomeIndicatorEvents();
        
        if (this.island && this.island.onAppReady) {
            this.island.onAppReady(this.appWindow, this);
        }
        
        /* 【标记已缓存】 */
        this.windowCache = true;
    };

    /* 【Tab切换事件绑定】 */
    BaseApp.prototype.bindTabEvents = function() {
        if (this.tabs.length === 0) return;
        
        var self = this;
        var tabItems = this.appWindow.querySelectorAll('.app-tab-item');
        var contentArea = this.appWindow.querySelector('#main-content-area');
        
        tabItems.forEach(function(item, index) {
            item.onclick = function(e) {
                e.stopPropagation();
                if (index === self.currentTabIndex) return;
                
                tabItems.forEach(function(t) { t.classList.remove('active'); });
                item.classList.add('active');
                
                contentArea.innerHTML = self.tabs[index].content || '';
                self.currentTabIndex = index;
                
                if (self.island && self.island.onTabChange) {
                    self.island.onTabChange(contentArea, self);
                }
            };
        });
    };

    /* 【打开详情页】支持页面堆栈 */
    BaseApp.prototype.openDetailPage = function(contentHtml, options) {
        if (!this.appWindow) return;
        
        options = options || {};
        var self = this;
        var indicatorColor = this.barStyle === 'light' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.3)';
        var backBtnColor = this.barStyle === 'light' ? '#fff' : '#007AFF';
        var enableHomeIndicator = options.enableHomeIndicator !== false && this.detailPageHomeIndicatorEnabled;
        
        // 详情页背景
        var detailBg = options.background || this.color;
        
        // 从渐变中提取首尾颜色
        var topBgStyle = '';
        var bottomBgStyle = '';
        if (detailBg && detailBg.indexOf('gradient') !== -1) {
            var colorMatches = detailBg.match(/#[0-9A-Fa-f]{3,8}|rgba?\([^)]+\)|[a-zA-Z]+(?=\s+\d)/g);
            if (colorMatches && colorMatches.length >= 1) {
                topBgStyle = 'background-color:' + colorMatches[0] + ';';
                bottomBgStyle = 'background-color:' + colorMatches[colorMatches.length - 1] + ';';
            }
        } else if (detailBg) {
            topBgStyle = 'background-color:' + detailBg + ';';
            bottomBgStyle = 'background-color:' + detailBg + ';';
        }
        
        var page = document.createElement('div');
        page.className = 'app-page slide-in';
        page.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; ' +
                             'background:' + detailBg + '; z-index:100; display:flex; flex-direction:column;';
        
        page.innerHTML = 
            '<div class="app-status-bar-gap" style="' + topBgStyle + '"></div>' +
            '<div class="app-back-btn" style="color:' + backBtnColor + ';">返回</div>' +
            '<div class="app-content-page" style="flex:1; overflow-y:auto; padding:0;">' +
                contentHtml +
            '</div>' +
            '<div class="app-bottom-indicator-wrap" style="' + bottomBgStyle + '">' +
                '<div class="home-indicator" style="background:' + indicatorColor + ';"></div>' +
                (enableHomeIndicator ? '<div class="home-indicator-area detail-home-indicator"></div>' : '') +
            '</div>';
        
        var backBtn = page.querySelector('.app-back-btn');
        backBtn.onclick = function() {
            // 先调用返回回调，如果返回false则取消关闭
            if (options.onBack) {
                var result = options.onBack();
                if (result === false) {
                    return; // 取消关闭
                }
            }
            page.classList.remove('slide-in');
            page.classList.add('slide-out');
            setTimeout(function() { 
                page.remove(); 
                self.pageStack.pop();
            }, 300);
        };
        
        if (enableHomeIndicator) {
            var homeIndicatorArea = page.querySelector('.detail-home-indicator');
            if (homeIndicatorArea) {
                this.bindDetailPageHomeIndicator(homeIndicatorArea, page);
            }
        }
        
        this.appWindow.appendChild(page);
        this.pageStack.push(page);
        
        return page;
    };
    
    /* 【关闭详情页】手动关闭当前详情页 */
    BaseApp.prototype.closeDetailPage = function() {
        if (!this.pageStack || this.pageStack.length === 0) return;
        
        var page = this.pageStack[this.pageStack.length - 1];
        if (page) {
            page.classList.remove('slide-in');
            page.classList.add('slide-out');
            var self = this;
            setTimeout(function() {
                if (page.parentNode) {
                    page.remove();
                }
                self.pageStack.pop();
            }, 300);
        }
    };
    
    /* ========== 灵动岛通知快捷方法 ========== */
    /* 【说明】各App应使用这些方法发送通知，保持风格一致
       
       图标类型参照灵动岛.txt设计：
       - success/成功: ✓
       - warning/警告: ⚠
       - error/错误: ✕
       - info/信息: ℹ
       
       尺寸选择：
       - mini: 简短提示（创建成功、已保存、已复制、数据清空）
       - medium: 常规通知（消息、状态变更）
       - large: 重要通知（来电、重要警告） */
    
    /* 【Mini通知 - 成功】 */
    BaseApp.prototype.notifySuccess = function(title, icon) {
        return PhoneCore.notifications.send({
            type: 'success',
            title: title,
            icon: icon || '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
            size: 'mini',
            duration: 1500,
            appId: this.id
        });
    };
    
    /* 【Mini通知 - 错误】 */
    BaseApp.prototype.notifyError = function(title, icon) {
        return PhoneCore.notifications.send({
            type: 'error',
            title: title,
            icon: icon || '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
            size: 'mini',
            duration: 2000,
            appId: this.id
        });
    };
    
    /* 【Mini通知 - 警告】 */
    BaseApp.prototype.notifyWarning = function(title, icon) {
        return PhoneCore.notifications.send({
            type: 'warning',
            title: title,
            icon: icon || '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>',
            size: 'mini',
            duration: 2000,
            appId: this.id
        });
    };
    
    /* 【Mini通知 - 信息】 */
    BaseApp.prototype.notifyInfo = function(title, icon) {
        return PhoneCore.notifications.send({
            type: 'info',
            title: title,
            icon: icon || '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><path fill="#fff" d="M11 7h2v2h-2zm0 4h2v6h-2z"/></svg>',
            size: 'mini',
            duration: 1500,
            appId: this.id
        });
    };
    
    /* 【Medium通知 - 带消息】 */
    BaseApp.prototype.notify = function(title, message, type, icon) {
        return PhoneCore.notifications.send({
            type: type || 'info',
            title: title,
            message: message || '',
            icon: icon || '',
            size: 'medium',
            duration: 3000,
            appId: this.id
        });
    };
    
    /* 【Large通知 - 重要消息】 */
    BaseApp.prototype.notifyImportant = function(title, message, type, icon, onClick) {
        return PhoneCore.notifications.send({
            type: type || 'info',
            title: title,
            message: message || '',
            icon: icon || '',
            size: 'large',
            duration: 5000,
            appId: this.id,
            onClick: onClick
        });
    };

    /* 【详情页Home指示器事件绑定】 */
    BaseApp.prototype.bindDetailPageHomeIndicator = function(handle, page) {
        var self = this;
        var startY = 0;
        var moveY = 0;
        var isDragging = false;
        
        function handleStart(clientY) {
            if (self.isCardMode) return;
            startY = clientY;
            moveY = 0;
            isDragging = true;
            self.appWindow.style.transition = 'none';
        }
        
        function handleMove(clientY) {
            if (!isDragging || self.isCardMode) return;
            moveY = clientY - startY;
            
            if (moveY > 0) { moveY = 0; return; }
            
            var scale = 1 - Math.abs(moveY) / 800;
            if (scale < 0.6) scale = 0.6;
            
            var blur = Math.abs(moveY) / 30;
            if (blur > 20) blur = 20;
            
            var borderRadius = 40 + Math.abs(moveY) / 15;
            if (borderRadius > 50) borderRadius = 50;
            
            self.appWindow.style.transform = 'translateY(' + (moveY * 0.5) + 'px) scale(' + scale + ')';
            self.appWindow.style.borderRadius = borderRadius + 'px';
            document.getElementById('desktop').style.filter = 'blur(' + blur + 'px)';
        }
        
        function handleEnd() {
            if (!isDragging || self.isCardMode) return;
            isDragging = false;
            
            self.appWindow.style.transition = 'all 0.4s cubic-bezier(0.2,0.8,0.2,1)';
            
            if (Math.abs(moveY) > 120) {
                self.switchToCardMode();
            } else {
                self.appWindow.style.transform = '';
                self.appWindow.style.borderRadius = '40px';
                document.getElementById('desktop').style.filter = 'blur(0px)';
            }
        }
        
        handle.ontouchstart = function(e) { e.preventDefault(); handleStart(e.touches[0].clientY); };
        handle.ontouchmove = function(e) { e.preventDefault(); handleMove(e.touches[0].clientY); };
        handle.ontouchend = function(e) { e.preventDefault(); handleEnd(); };
        
        handle.onmousedown = function(e) {
            e.preventDefault();
            handleStart(e.clientY);
            
            function mouseMoveHandler(e) { e.preventDefault(); handleMove(e.clientY); }
            function mouseUpHandler(e) { 
                e.preventDefault(); 
                handleEnd(); 
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
            }
            
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
        };
    };

    /* 【打开App】带缓存和动画 */
    BaseApp.prototype.open = function() {
        if (!this.appWindow) {
            this.render();
        }
        
        var self = this;
        
        /* 【更新状态栏样式】 */
        var statusBar = document.querySelector('.status-bar');
        if (statusBar) {
            statusBar.classList.remove('status-bar-light', 'status-bar-dark', 'status-bar-transparent');
            statusBar.classList.add('status-bar-' + this.statusBarStyle);
        }
        
        /* 【安全获取图标位置】确保iconEl存在 */
        if (!this.iconEl) {
            this.iconEl = document.getElementById(this.id);
        }
        
        var centerX = 200, centerY = 400;  // 默认从屏幕中央展开
        
        if (this.iconEl) {
            var iconRect = this.iconEl.getBoundingClientRect();
            var screenRect = document.getElementById('phone-screen').getBoundingClientRect();
            var startX = iconRect.left - screenRect.left;
            var startY = iconRect.top - screenRect.top;
            centerX = startX + iconRect.width / 2;
            centerY = startY + iconRect.height / 2;
        }
        
        this.appWindow.style.left = '0';
        this.appWindow.style.top = '0';
        this.appWindow.style.width = '100%';
        this.appWindow.style.height = '100%';
        this.appWindow.style.transformOrigin = centerX + 'px ' + centerY + 'px';
        this.appWindow.style.transform = 'scale(0.1)';
        this.appWindow.style.opacity = '0';
        this.appWindow.style.borderRadius = '40px';
        this.appWindow.style.transition = 'none';
        
        this.appWindow.classList.remove('hidden');
        this.appWindow.offsetHeight;
        
        this.appWindow.style.transition = 'transform 0.4s cubic-bezier(0.2,0.8,0.2,1), ' +
                                           'opacity 0.4s cubic-bezier(0.2,0.8,0.2,1), ' +
                                           'border-radius 0.4s cubic-bezier(0.2,0.8,0.2,1)';
        
        requestAnimationFrame(function() {
            self.appWindow.style.transform = 'scale(1)';
            self.appWindow.style.opacity = '1';
            self.appWindow.style.borderRadius = '40px';
        });
        
        setTimeout(function() {
            self.appWindow.style.transition = '';
            self.appWindow.style.transformOrigin = '';
        }, 400);
    };

    /* 【Home指示器事件绑定】 */
    BaseApp.prototype.bindHomeIndicatorEvents = function() {
        var self = this;
        var handle = this.appWindow.querySelector('.home-indicator-area');
        if (!handle) return;
        
        var startY = 0;
        var moveY = 0;
        var isDragging = false;
        
        function handleStart(clientY) {
            if (self.isCardMode) return;
            startY = clientY;
            moveY = 0;
            isDragging = true;
            self.appWindow.style.transition = 'none';
        }
        
        function handleMove(clientY) {
            if (!isDragging || self.isCardMode) return;
            moveY = clientY - startY;
            
            if (moveY > 0) { moveY = 0; return; }
            
            var scale = 1 - Math.abs(moveY) / 800;
            if (scale < 0.6) scale = 0.6;
            
            var blur = Math.abs(moveY) / 30;
            if (blur > 20) blur = 20;
            
            var borderRadius = 40 + Math.abs(moveY) / 15;
            if (borderRadius > 50) borderRadius = 50;
            
            self.appWindow.style.transform = 'translateY(' + (moveY * 0.5) + 'px) scale(' + scale + ')';
            self.appWindow.style.borderRadius = borderRadius + 'px';
            document.getElementById('desktop').style.filter = 'blur(' + blur + 'px)';
        }
        
        function handleEnd() {
            if (!isDragging || self.isCardMode) return;
            isDragging = false;
            
            self.appWindow.style.transition = 'all 0.4s cubic-bezier(0.2,0.8,0.2,1)';
            
            if (Math.abs(moveY) > 120) {
                self.switchToCardMode();
            } else {
                self.appWindow.style.transform = '';
                self.appWindow.style.borderRadius = '40px';
                document.getElementById('desktop').style.filter = 'blur(0px)';
            }
        }
        
        handle.ontouchstart = function(e) { e.preventDefault(); handleStart(e.touches[0].clientY); };
        handle.ontouchmove = function(e) { e.preventDefault(); handleMove(e.touches[0].clientY); };
        handle.ontouchend = function(e) { e.preventDefault(); handleEnd(); };
        
        handle.onmousedown = function(e) {
            e.preventDefault();
            handleStart(e.clientY);
            
            function mouseMoveHandler(e) { e.preventDefault(); handleMove(e.clientY); }
            function mouseUpHandler(e) { 
                e.preventDefault(); 
                handleEnd(); 
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
            }
            
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
        };
    };

    /* 【切换到卡片模式】 */
    BaseApp.prototype.switchToCardMode = function() {
        var self = this;
        this.isCardMode = true;
        
        var screen = document.getElementById('phone-screen');
        var screenRect = screen.getBoundingClientRect();
        
        var cardWidth = 280;
        var cardHeight = 400;
        var targetX = (screenRect.width - cardWidth) / 2;
        var targetY = (screenRect.height - cardHeight) / 2 - 30;
        
        this.appWindow.style.transition = 'all 0.4s cubic-bezier(0.2,0.8,0.2,1)';
        this.appWindow.style.position = 'absolute';
        this.appWindow.style.left = targetX + 'px';
        this.appWindow.style.top = targetY + 'px';
        this.appWindow.style.width = cardWidth + 'px';
        this.appWindow.style.height = cardHeight + 'px';
        this.appWindow.style.transform = 'scale(1)';
        this.appWindow.style.borderRadius = '25px';
        this.appWindow.style.boxShadow = '0 20px 50px rgba(0,0,0,0.3)';
        
        document.getElementById('desktop').style.filter = 'blur(20px)';
        
        var appContent = this.appWindow.querySelector('.app-content-page');
        var homeIndicator = this.appWindow.querySelector('.home-indicator');
        var tabBar = this.appWindow.querySelector('.app-tab-bar');
        var homeIndicatorArea = this.appWindow.querySelector('.home-indicator-area');
        
        if (appContent) appContent.style.pointerEvents = 'none';
        if (homeIndicator) homeIndicator.style.display = 'none';
        if (tabBar) tabBar.style.display = 'none';
        if (homeIndicatorArea) homeIndicatorArea.style.display = 'none';
        
        setTimeout(function() {
            self.appWindow.style.transition = '';
            self.bindCardDragEvents();
            
            self.appWindow.onclick = function(e) {
                if (self.isCardMode && !self.isCardDragging) {
                    e.stopPropagation();
                    self.restoreFromCardMode();
                }
            };
        }, 400);
    };

    /* 【从卡片模式恢复】 */
    BaseApp.prototype.restoreFromCardMode = function() {
        var self = this;
        this.isCardMode = false;
        
        this.appWindow.style.transition = 'all 0.4s cubic-bezier(0.2,0.8,0.2,1)';
        this.appWindow.style.position = 'absolute';
        this.appWindow.style.left = '0';
        this.appWindow.style.top = '0';
        this.appWindow.style.width = '100%';
        this.appWindow.style.height = '100%';
        this.appWindow.style.transform = 'scale(1)';
        this.appWindow.style.borderRadius = '40px';
        this.appWindow.style.boxShadow = 'none';
        
        document.getElementById('desktop').style.filter = 'blur(0px)';
        
        var appContent = this.appWindow.querySelector('.app-content-page');
        var homeIndicator = this.appWindow.querySelector('.home-indicator');
        var tabBar = this.appWindow.querySelector('.app-tab-bar');
        var homeIndicatorArea = this.appWindow.querySelector('.home-indicator-area');
        
        if (appContent) appContent.style.pointerEvents = 'auto';
        if (homeIndicator) homeIndicator.style.display = '';
        if (tabBar) tabBar.style.display = '';
        if (homeIndicatorArea) homeIndicatorArea.style.display = '';
        
        this.appWindow.onclick = null;
        
        setTimeout(function() {
            self.appWindow.style.transition = '';
            self.appWindow.style.position = '';
        }, 400);
    };

    /* 【卡片模式拖拽事件绑定】 */
    BaseApp.prototype.bindCardDragEvents = function() {
        var self = this;
        
        var cardStartX = 0;
        var cardStartY = 0;
        var cardMoveX = 0;
        var cardMoveY = 0;
        var cardStartLeft = 0;
        var cardStartTop = 0;
        
        function handleCardStart(clientX, clientY) {
            if (!self.isCardMode) return;
            
            cardStartX = clientX;
            cardStartY = clientY;
            cardMoveX = 0;
            cardMoveY = 0;
            self.isCardDragging = false;
            
            cardStartLeft = parseFloat(self.appWindow.style.left) || 0;
            cardStartTop = parseFloat(self.appWindow.style.top) || 0;
            
            self.appWindow.style.transition = 'none';
        }
        
        function handleCardMove(clientX, clientY) {
            if (!self.isCardMode) return;
            
            cardMoveX = clientX - cardStartX;
            cardMoveY = clientY - cardStartY;
            
            if (Math.abs(cardMoveX) > 5 || Math.abs(cardMoveY) > 5) {
                self.isCardDragging = true;
            }
            
            if (self.isCardDragging) {
                self.appWindow.style.left = (cardStartLeft + cardMoveX) + 'px';
                self.appWindow.style.top = (cardStartTop + cardMoveY) + 'px';
                
                var distance = Math.sqrt(cardMoveX * cardMoveX + cardMoveY * cardMoveY);
                var opacity = 1 - distance / 400;
                var rotate = cardMoveX / 20;
                
                self.appWindow.style.opacity = Math.max(0.3, opacity);
                self.appWindow.style.transform = 'rotate(' + rotate + 'deg)';
            }
        }
        
        function handleCardEnd() {
            if (!self.isCardMode) return;
            
            if (!self.isCardDragging) {
                self.appWindow.style.transition = '';
                return;
            }
            
            self.appWindow.style.transition = 'all 0.3s ease-out';
            var distance = Math.sqrt(cardMoveX * cardMoveX + cardMoveY * cardMoveY);
            
            if (distance > 100) {
                self.exit();
            } else {
                self.appWindow.style.left = cardStartLeft + 'px';
                self.appWindow.style.top = cardStartTop + 'px';
                self.appWindow.style.opacity = '1';
                self.appWindow.style.transform = 'rotate(0deg)';
            }
            
            setTimeout(function() { self.isCardDragging = false; }, 50);
        }
        
        this.appWindow.ontouchstart = function(e) {
            if (!self.isCardMode) return;
            handleCardStart(e.touches[0].clientX, e.touches[0].clientY);
        };
        this.appWindow.ontouchmove = function(e) {
            if (!self.isCardMode) return;
            handleCardMove(e.touches[0].clientX, e.touches[0].clientY);
        };
        this.appWindow.ontouchend = function(e) {
            if (!self.isCardMode) return;
            handleCardEnd();
        };
        
        this.appWindow.onmousedown = function(e) {
            if (!self.isCardMode) return;
            handleCardStart(e.clientX, e.clientY);
            
            function mouseMoveHandler(e) { handleCardMove(e.clientX, e.clientY); }
            function mouseUpHandler(e) { 
                handleCardEnd(); 
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
            }
            
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
        };
    };

    /* 【退出App】保留DOM，只隐藏 */
    BaseApp.prototype.exit = function() {
        var self = this;
        
        this.appWindow.style.transition = 'all 0.3s ease-out';
        
        if (this.isCardMode) {
            this.appWindow.style.transform = 'translateY(-200px) scale(0.5) rotate(0deg)';
            this.appWindow.style.opacity = '0';
        } else {
            var iconRect = this.iconEl.getBoundingClientRect();
            var screenRect = document.getElementById('phone-screen').getBoundingClientRect();
            var centerX = iconRect.left - screenRect.left + iconRect.width / 2;
            var centerY = iconRect.top - screenRect.top + iconRect.height / 2;
            
            this.appWindow.style.transformOrigin = centerX + 'px ' + centerY + 'px';
            this.appWindow.style.transform = 'scale(0.1)';
            this.appWindow.style.opacity = '0';
        }
        
        setTimeout(function() {
            /* 【隐藏而非销毁】保留DOM以便下次快速打开 */
            self.appWindow.classList.add('hidden');
            document.getElementById('desktop').style.filter = 'blur(0px)';
            
            /* 【恢复状态栏】 */
            var statusBar = document.querySelector('.status-bar');
            if (statusBar) {
                statusBar.classList.remove('status-bar-light', 'status-bar-dark', 'status-bar-transparent');
            }
            
            self.isCardMode = false;
            self.isCardDragging = false;
            
            /* 【重置样式但保留内容】 */
            self.appWindow.style.position = '';
            self.appWindow.style.left = '';
            self.appWindow.style.top = '';
            self.appWindow.style.width = '';
            self.appWindow.style.height = '';
            self.appWindow.style.transform = '';
            self.appWindow.style.opacity = '';
            self.appWindow.style.boxShadow = '';
            
            var homeIndicator = self.appWindow.querySelector('.home-indicator');
            var tabBar = self.appWindow.querySelector('.app-tab-bar');
            var appContent = self.appWindow.querySelector('.app-content-page');
            var homeIndicatorArea = self.appWindow.querySelector('.home-indicator-area');
            
            if (homeIndicator) homeIndicator.style.display = '';
            if (tabBar) tabBar.style.display = '';
            if (appContent) appContent.style.pointerEvents = '';
            if (homeIndicatorArea) homeIndicatorArea.style.display = '';
            
            self.appWindow.ontouchstart = null;
            self.appWindow.ontouchmove = null;
            self.appWindow.ontouchend = null;
            self.appWindow.onmousedown = null;
            self.appWindow.onclick = null;
            
        }, 300);
    };

    /* 【兼容性别名】保持向后兼容，EnhancedApp指向BaseApp */
    var EnhancedApp = BaseApp;

    // ============ 12. AI基类系统 ============
    /* 【AI角色类型说明】
       main（主角色AI）: 
         - 完整的头像库、记忆库、浓缩记忆
         - 可自动发消息、可被拉黑
         - 丰富的人设、财产、工作等设定
         - tokens消耗详细追踪
       
       supporting（配角AI）:
         - 简单头像（无头像库）
         - 浅显设定，无记忆库
         - 可查看tokens消耗
         - 可升级为主角色
       
       npc（NPC AI）:
         - 初始纯色头像
         - AI生成人设，用户不可修改
         - 聊天100句后可升级为配角
         - 聊天250句后可升级为主角色（用户选择） */
    
    /* 【NPC生成来源】 */
    var NPC_SOURCE = {
        CONTACT_CARD: 'contact_card',    // 主角色发来的联系人卡片
        SOCIAL_MEDIA: 'social_media',    // 社交媒体评论区
        SMS_ANONYMOUS: 'sms_anonymous',  // 匿名短信
        VIDEO_APP: 'video_app',          // 视频App博主
        BLOG_APP: 'blog_app',            // 博客App博主
        PUBLIC_ACCOUNT: 'public_account' // 公众号
    };
    
    function AICharacter(config) {
        this.id = config.id || 'ai_' + Date.now();
        this.type = config.type || 'main';  // 'main' | 'supporting' | 'npc'
        this.name = config.name || '未命名';
        this.avatar = config.avatar || '';
        
        /* ========== 主角色专属字段 ========== */
        /* 【头像库】仅主角色拥有，可根据情绪切换 */
        this.avatarLibrary = config.avatarLibrary || [];  // [{id, name, url, description}]
        this.avatarLibraryEnabled = config.avatarLibraryEnabled !== false;  // AI是否读取头像名称
        
        /* ========== 世界观绑定 ========== */
        this.worldId = config.worldId || null;
        this.locationId = config.locationId || null;
        this.factionId = config.factionId || null;  // 势力ID
        
        /* ========== 人设相关 ========== */
        this.personality = config.personality || '';
        
        /* 【认知系统】动态生成，可根据提示词+按钮更新，不计入记忆 */
        this.cognition = config.cognition || {
            self: '',                     // 自我评价/认知
            others: '',                   // 对别人的认知（总体）
            user: '',                     // 对用户的认知
            lastUpdated: null             // 上次更新时间
        };
        // 兼容旧版字段
        this.selfPerception = config.selfPerception || config.cognition?.self || '';
        this.userPerception = config.userPerception || config.cognition?.user || '';
        this.othersPerception = config.othersPerception || config.cognition?.others || '';
        
        /* 【喜好设定】仅主角色详细配置 */
        this.preferences = config.preferences || {
            // 通讯频率 (0-1)
            callFrequency: 0.1,           // 接电话频率
            videoFrequency: 0.05,         // 打视频频率
            messageFrequency: 0.3,        // 发消息频率
            inviteFrequency: 0.15,        // 邀请频率（一起听/游戏等）
            replySpeed: 'normal',         // 回复速度 'fast'|'normal'|'slow'|'random'
            
            // 生活习惯频率 (0-1)
            takeoutFrequency: 0.2,        // 点外卖频率
            cookingFrequency: 0.3,        // 自己做饭频率
            shoppingFrequency: 0.1,       // 购物频率
            exerciseFrequency: 0.2,       // 运动频率
            
            // 能力设定
            gamingSkill: 'medium',        // 游戏能力 'noob'|'low'|'medium'|'high'|'pro'
            cookingSkill: 'medium',       // 烹饪能力
            drivingSkill: 'medium',       // 驾驶能力
            
            // 社交倾向
            socialLevel: 'normal',        // 社交程度 'introvert'|'normal'|'extrovert'
            initiativeLevel: 0.5,         // 主动程度 (0-1)
            
            // 作息
            wakeUpTime: '08:00',          // 起床时间
            sleepTime: '23:00',           // 睡觉时间
            lunchTime: '12:00',           // 午餐时间
            dinnerTime: '19:00'           // 晚餐时间
        };
        
        this.story = config.story || '';           // 背景故事
        this.storyArc = config.storyArc || '';     // 故事线（主角色）
        this.recentStory = config.recentStory || ''; // 最近生成的故事状态（AI的生活）
        
        /* 【扮演心得】AI对角色的理解 */
        this.roleplayNotes = config.roleplayNotes || {
            content: '',                      // 心得内容
            dataSources: ['chat-app'],        // 生成时读取的数据源
            injectApps: ['chat-app'],         // 注入到哪些App的提示词
            lastUpdated: null
        };
        
        /* 【故事线系统】AI当前的故事阶段和历史 */
        this.storyline = config.storyline || {
            current: null,                    // 当前阶段 {title, description, timestamp}
            history: [],                      // 历史纪年 [{title, description, timestamp, endTimestamp}]
            readableApps: ['chat-app']        // 可读取故事线的App
        };
        
        /* 【心情状态】 */
        this.currentMood = config.currentMood || { name: '平静', level: 50 };
        
        this.status = config.status || 'idle';
        this.currentActivity = config.currentActivity || '';
        
        /* ========== 匿名通信系统 ========== */
        /* 【手机号】每个AI独有的虚拟手机号，用于匿名短信系统 */
        this.phoneNumber = config.phoneNumber || this.generatePhoneNumber();
        /* 【手机号是否已被侦探揭露】用户是否已调查出该AI的手机号 */
        this.phoneRevealed = config.phoneRevealed || false;
        /* 【匿名短信历史】收到的匿名短信 [{id, content, timestamp, fromPhone, investigated}] */
        this.anonymousSmsHistory = config.anonymousSmsHistory || [];
        /* 【主动发送匿名短信的能力】AI是否可以主动发匿名短信给用户 */
        this.canSendAnonymousSms = config.canSendAnonymousSms !== false;
        /* 【最后发送匿名短信的时间】 */
        this.lastAnonymousSmsTime = config.lastAnonymousSmsTime || null;
        /* 【AI是否怀疑用户在匿名骚扰】基于对话和行为推断 */
        this.suspectUserAnonymous = config.suspectUserAnonymous || 0; // 0-100 怀疑程度
        
        /* ========== 记忆系统（仅主角色） ========== 
           分层架构：
           - core: 核心记忆层（永不衰减）- 用户基本信息、重大事件、AI人设锚点
           - active: 活跃记忆层（常规调用）- 最近对话要点、当前关注话题、情绪状态
           - longTerm: 长期记忆层（按需调用）- 历史事件、偏好习惯、关系发展
           - archived: 归档记忆层（深度检索）- 久远记忆、低权重信息、已解决的事件 */
        this.memory = {
            core: config.memory?.core || [],      // 核心记忆（永不衰减，每次都发）
            active: config.memory?.active || [],  // 活跃记忆（关键词匹配后发）
            longTerm: config.memory?.longTerm || [],  // 长期记忆（强相关时才发）
            archived: config.memory?.archived || [],  // 归档记忆（用户明确问起才检索）
            // 兼容旧版
            shortTerm: config.memory?.shortTerm || [],
            important: config.memory?.important || [],
            points: config.memory?.points || []
        };
        
        /* 【记忆配置】 */
        this.memoryConfig = config.memoryConfig || {
            coreLimit: 50,                // 核心记忆上限
            activeLimit: 100,             // 活跃记忆上限
            longTermLimit: 500,           // 长期记忆上限
            archivedLimit: 2000,          // 归档记忆上限
            autoCondense: true,           // 自动浓缩记忆
            condenseThreshold: 50,        // 触发浓缩的阈值
            condenserIds: [],             // 使用的浓缩器ID列表
            decayEnabled: true,           // 启用记忆衰减
            archiveThreshold: 2,          // 强度低于此值时归档
            tokenBudget: {                // tokens预算
                core: 200,
                active: 300,
                context: 500
            }
        };
        
        /* 【浓缩记忆ID列表】关联到condensed_memories表 */
        this.condensedMemoryIds = config.condensedMemoryIds || [];
        
        /* ========== 聊天与社交 ========== */
        this.chatHistory = config.chatHistory || [];
        this.chatCount = config.chatCount || 0;  // 聊天消息数（用于NPC升级判断）
        this.relationships = config.relationships || {};  // {aiId: {type, level, description}}
        
        /* 【社交账户】每个App可有不同的人设 */
        this.socialAccounts = config.socialAccounts || {
            // appId: { networkId, avatar, bio, isVerified, followerCount }
        };
        
        /* ========== 财产系统 ========== */
        /* 【资产设定】
           - assets: 总资产
           - assetsLocked: 锁定后不可人为修改
           - wealthClass: 财富阶级 'poor'|'normal'|'rich'|'wealthy'|'infinite'
           - 如果设置"很有钱"人设，wealthClass='infinite'，不需要计算 */
        this.assets = config.assets || 0;
        this.assetsLocked = config.assetsLocked || false;
        this.wealthClass = config.wealthClass || 'normal';  // 财富阶级
        this.bankCards = config.bankCards || [];  // AI的银行卡 [{id, name, balance, color, type}]
        
        /* ========== 工作/收入系统 ========== */
        this.job = config.job || null;
        this.workplace = config.workplace || null;  // 工作地点
        this.workSchedule = config.workSchedule || null;  // 兼容旧版
        this.scheduleId = config.scheduleId || null;      // 新版：绑定的时间表ID
        this.education = config.education || null;  // 学历/学校
        
        /* 【工资系统】 */
        this.salary = config.salary || {
            amount: 0,                    // 月薪金额
            payday: 1,                    // 发薪日（每月几号）
            payTime: '10:00',             // 发薪时间
            lastPayDate: null,            // 上次发薪日期
            autoDeposit: true             // 自动存入银行卡
        };
        
        /* 【生活开支】 */
        this.expenses = config.expenses || {
            rent: 0,                      // 房租
            food: 0,                      // 餐饮
            entertainment: 0,             // 娱乐
            other: 0,                     // 其他
            paymentDay: 1                 // 扣款日
        };
        
        /* 【购物记录】 */
        this.purchaseHistory = config.purchaseHistory || []; // [{name, amount, timestamp, appId}]
        
        /* 【交易记录】 */
        this.transactionHistory = config.transactionHistory || []; // [{type:'income'|'expense', name, amount, from/to, timestamp}]
        
        /* ========== API配置 ========== */
        this.apiConfigId = config.apiConfigId || null;
        this.apiConfigGroup = config.apiConfigGroup || [];
        this.apiGroupId = config.apiGroupId || null;  // API组ID
        
        /* 【Tokens使用记录】 */
        this.tokensUsed = config.tokensUsed || {
            total: 0,
            byApp: {},       // {appId: tokens}
            byDate: {},      // {'2026-01-13': tokens}
            lastReset: null
        };
        
        /* ========== 表情包与App ========== */
        this.stickerLibraryIds = config.stickerLibraryIds || [];  // 绑定的表情包库ID
        this.networkIds = config.networkIds || {};  // {appId: networkId}
        this.usableApps = config.usableApps || [];  // 可使用的App列表
        
        /* ========== 主角色专属功能 ========== */
        this.isBlocked = config.isBlocked || false;
        this.blockedAt = config.blockedAt || null;  // 被拉黑时间戳
        this.lastBlockRequestTime = config.lastBlockRequestTime || null;  // 上次发送申请消息的时间
        
        /* 【拉黑统计数据】 */
        this.blockStats = config.blockStats || {
            totalBlockCount: 0,       // 总拉黑次数
            totalBlockDuration: 0,    // 总被拉黑时长（毫秒）
            lastBlockDuration: 0,     // 上次被拉黑时长
            blockHistory: [],         // 拉黑历史记录
            pendingRequests: []       // 待处理的申请消息
        };
        
        /* 【聊天统计数据】 */
        this.chatStats = config.chatStats || {
            totalMessages: 0,         // 总聊天条数（用户发送）
            aiMessages: 0,            // AI回复条数
            firstChatTime: null,      // 首次聊天时间
            lastChatTime: null,       // 最后聊天时间
            chatDays: 0,              // 聊天天数
            avgMessagesPerDay: 0,     // 日均消息数
            weeklyMessages: 0,        // 本周消息数
            monthlyMessages: 0        // 本月消息数
        };
        
        /* 【统计数据进入Prompt开关】 */
        this.statsPromptConfig = config.statsPromptConfig || {
            blockStats: false,        // 拉黑统计是否进prompt
            chatStats: false,         // 聊天统计是否进prompt
            chatFrequency: false      // 聊天频率是否进prompt
        };
        
        this.autoMessageEnabled = config.autoMessageEnabled || false;
        this.autoMessageChance = config.autoMessageChance || 0.2;
        this.autoMessageInterval = config.autoMessageInterval || 300000;  // 5分钟
        
        /* 【朋友圈】仅主角色 */
        this.moments = config.moments || [];  // [{id, content, images, timestamp, likes, comments}]
        
        /* 【通话/视频记录】 */
        this.callLogs = config.callLogs || [];  // [{type, timestamp, duration, status}]
        
        /* 【分享记录】 */
        this.receivedShares = config.receivedShares || [];
        this.sentShares = config.sentShares || [];
        
        /* ========== NPC专属字段 ========== */
        this.npcSource = config.npcSource || null;  // NPC来源
        this.npcGeneratedAt = config.npcGeneratedAt || null;  // 生成时间
        this.npcExpiresAt = config.npcExpiresAt || null;  // 过期时间（未互动则清除）
        this.npcIsInteracted = config.npcIsInteracted || false;  // 是否已互动
        this.npcGeneratedPrompt = config.npcGeneratedPrompt || '';  // AI生成的人设提示词
        
        /* ========== 提示词配置 ========== */
        this.promptCollectionIds = config.promptCollectionIds || [];  // 使用的提示词合集ID
        this.appPromptConfigs = config.appPromptConfigs || {};  // {appId: {collectionIds, customPrompt}}
        
        /* ========== 聊天设置（需要持久化） ========== */
        // 兼容旧版单选，自动转换为数组
        if (config.replyPromptIds) {
            this.replyPromptIds = config.replyPromptIds;  // 回复提示词模板ID数组（支持多选）
        } else if (config.replyPromptId) {
            this.replyPromptIds = [config.replyPromptId];  // 兼容旧版单选
        } else {
            this.replyPromptIds = [];
        }
        this.remark = config.remark || '';  // 备注名
        this.isPinned = config.isPinned || false;  // 是否置顶
        this.isMuted = config.isMuted || false;  // 是否免打扰
        this.contextLength = config.contextLength || 20;  // 上下文长度
        this.replyCount = config.replyCount || 1;  // 回复条数
        this.dataSubscriptions = config.dataSubscriptions || { weather: true, userCity: true, userProfile: true, time: true };  // 数据订阅
        this.favorites = config.favorites || [];  // 收藏的消息
        this.stickerPacks = config.stickerPacks || [];  // 表情包设置
        this.unreadCount = config.unreadCount || 0;  // 未读消息数
        this.weatherCity = config.weatherCity || null;  // 天气城市设置
        
        /* ========== 元数据 ========== */
        this.createdAt = config.createdAt || Date.now();
        this.updatedAt = Date.now();
    }
    
    /* 【生成虚拟手机号】基于AI ID生成唯一的虚拟手机号 */
    AICharacter.prototype.generatePhoneNumber = function() {
        // 使用AI的ID生成一个看起来真实的手机号
        var prefixes = ['138', '139', '150', '151', '152', '157', '158', '159', '186', '187', '188', '189'];
        var hash = 0;
        var id = this.id || 'default';
        for (var i = 0; i < id.length; i++) {
            hash = ((hash << 5) - hash) + id.charCodeAt(i);
            hash = hash & hash;
        }
        var prefixIndex = Math.abs(hash) % prefixes.length;
        var prefix = prefixes[prefixIndex];
        // 生成后8位数字
        var suffix = '';
        for (var j = 0; j < 8; j++) {
            suffix += Math.abs((hash >> (j * 3)) % 10).toString();
        }
        return prefix + suffix;
    };
    
    /* 【获取格式化的手机号】用于显示，如 138****1234 */
    AICharacter.prototype.getMaskedPhoneNumber = function() {
        var phone = this.phoneNumber;
        if (!phone || phone.length < 11) return '***********';
        return phone.substring(0, 3) + '****' + phone.substring(7);
    };
    
    /* 【接收匿名短信】处理收到的匿名短信 */
    AICharacter.prototype.receiveAnonymousSms = function(content, fromPhone) {
        var sms = {
            id: 'anon_sms_' + Date.now(),
            content: content,
            timestamp: Date.now(),
            fromPhone: fromPhone,
            investigated: false,
            investigatedResult: null
        };
        this.anonymousSmsHistory.push(sms);
        return sms;
    };
    
    /* 【更新匿名骚扰怀疑度】基于对话内容和行为更新AI的怀疑程度 */
    AICharacter.prototype.updateAnonymousSuspicion = function(delta) {
        this.suspectUserAnonymous = Math.max(0, Math.min(100, this.suspectUserAnonymous + delta));
        return this.suspectUserAnonymous;
    };
    
    /* 【检查是否为主角色】 */
    AICharacter.prototype.isMainCharacter = function() {
        return this.type === 'main';
    };
    
    /* 【检查是否支持记忆系统】仅主角色支持 */
    AICharacter.prototype.hasMemorySystem = function() {
        return this.type === 'main';
    };
    
    /* 【检查是否支持头像库】仅主角色支持 */
    AICharacter.prototype.hasAvatarLibrary = function() {
        return this.type === 'main' && this.avatarLibrary.length > 0;
    };
    
    /* 【获取升级进度】用于NPC/配角升级提示 */
    AICharacter.prototype.getUpgradeProgress = function() {
        if (this.type === 'npc') {
            return {
                current: this.chatCount,
                target: 100,
                nextType: 'supporting',
                percentage: Math.min(100, (this.chatCount / 100) * 100)
            };
        } else if (this.type === 'supporting') {
            return {
                current: this.chatCount,
                target: 250,
                nextType: 'main',
                percentage: Math.min(100, (this.chatCount / 250) * 100)
            };
        }
        return null;
    };
    
    /* 【检查是否可升级】 */
    AICharacter.prototype.canUpgrade = function() {
        if (this.type === 'npc' && this.chatCount >= 100) return true;
        if (this.type === 'supporting' && this.chatCount >= 250) return true;
        return false;
    };
    
    /* 【执行升级】 */
    AICharacter.prototype.upgrade = function() {
        if (this.type === 'npc' && this.chatCount >= 100) {
            this.type = 'supporting';
            this.updatedAt = Date.now();
            EventBus.emit('ai:upgraded', { aiId: this.id, newType: 'supporting' });
            return true;
        }
        if (this.type === 'supporting' && this.chatCount >= 250) {
            this.type = 'main';
            // 初始化主角色专属字段 - 使用新的分层记忆结构
            this.memory = { 
                core: [], 
                active: [], 
                longTerm: [], 
                archived: [],
                shortTerm: [],  // 兼容旧版
                important: [], 
                points: [] 
            };
            this.avatarLibrary = [];
            this.moments = [];
            this.callLogs = [];
            this.wealthClass = 'normal';
            this.salary = { amount: 0, payday: 1, payTime: '10:00', lastPayDate: null, autoDeposit: true };
            this.expenses = { rent: 0, food: 0, entertainment: 0, other: 0, paymentDay: 1 };
            this.updatedAt = Date.now();
            EventBus.emit('ai:upgraded', { aiId: this.id, newType: 'main' });
            return true;
        }
        return false;
    };
    
    /* 【增加聊天计数】用于升级判断 */
    AICharacter.prototype.incrementChatCount = function() {
        this.chatCount++;
        this.updatedAt = Date.now();
        
        // 检查是否可以升级
        if (this.canUpgrade()) {
            EventBus.emit('ai:canUpgrade', { 
                aiId: this.id, 
                type: this.type,
                chatCount: this.chatCount 
            });
        }
    };
    
    /* 【标记NPC已互动】防止被清除 */
    AICharacter.prototype.markInteracted = function() {
        if (this.type === 'npc') {
            this.npcIsInteracted = true;
            this.npcExpiresAt = null;  // 清除过期时间
            this.updatedAt = Date.now();
        }
    };
    
    /* 【获取NPC头像颜色】用于纯色初始头像 */
    AICharacter.prototype.getNPCAvatarColor = function() {
        if (this.avatar) return null;
        // 基于ID生成一致的颜色
        var hash = 0;
        for (var i = 0; i < this.id.length; i++) {
            hash = this.id.charCodeAt(i) + ((hash << 5) - hash);
        }
        var hue = Math.abs(hash % 360);
        return 'hsl(' + hue + ', 65%, 55%)';
    };
    
    /* 【获取App专属配置】 */
    AICharacter.prototype.getAppConfig = function(appId) {
        return this.appPromptConfigs[appId] || null;
    };
    
    /* 【设置App专属配置】 */
    AICharacter.prototype.setAppConfig = function(appId, config) {
        this.appPromptConfigs[appId] = config;
        this.updatedAt = Date.now();
    };
    
    /* 【获取社交账户】 */
    AICharacter.prototype.getSocialAccount = function(appId) {
        return this.socialAccounts[appId] || {
            networkId: this.networkIds[appId] || this.name,
            avatar: this.avatar,
            bio: '',
            isVerified: false,
            followerCount: 0
        };
    };
    
    /* 【设置社交账户】 */
    AICharacter.prototype.setSocialAccount = function(appId, account) {
        this.socialAccounts[appId] = account;
        this.updatedAt = Date.now();
    };
    
    /* ========== 记忆系统方法 ========== */
    
    /* 【创建记忆单元】 */
    AICharacter.prototype.createMemoryUnit = function(config) {
        return {
            id: 'mem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            content: config.content || '',
            summary: config.summary || config.content?.substring(0, 50) || '',
            createTime: Date.now(),
            lastRecallTime: Date.now(),
            baseWeight: config.baseWeight || 5,
            recallCount: 0,
            userReinforceCount: 0,
            emotionIntensity: config.emotionIntensity || 5,
            keywords: config.keywords || [],
            category: config.category || '其他',
            relatedMemories: [],
            sourceApp: config.sourceApp || 'chatapp',
            sourceContext: config.sourceContext || '日常聊天',
            isCore: config.isCore || false,
            isArchived: false,
            decayRate: config.decayRate || 0.1,
            scope: config.scope || 'shared',
            allowedApps: config.allowedApps || []
        };
    };
    
    /* 【计算记忆强度】 */
    AICharacter.prototype.calculateMemoryStrength = function(memory) {
        if (memory.isCore) return memory.baseWeight * (1 + memory.recallCount * 0.1);
        
        var daysPassed = (Date.now() - memory.lastRecallTime) / (1000 * 60 * 60 * 24);
        var timeDecay = Math.exp(-memory.decayRate * daysPassed);
        var reinforceFactor = 1 + (memory.recallCount * 0.1) + (memory.userReinforceCount * 0.3);
        var emotionBonus = memory.emotionIntensity / 10;
        var strength = memory.baseWeight * timeDecay * reinforceFactor * (1 + emotionBonus);
        
        return Math.min(strength, 10);
    };
    
    /* 【添加记忆到指定层】 */
    AICharacter.prototype.addMemory = function(memoryData, layer) {
        if (this.type !== 'main') return null;
        
        layer = layer || 'active';
        var memory = this.createMemoryUnit(memoryData);
        
        if (layer === 'core') {
            memory.isCore = true;
            this.memory.core.push(memory);
            if (this.memory.core.length > this.memoryConfig.coreLimit) {
                this.memory.core.shift();
            }
        } else if (layer === 'active') {
            this.memory.active.push(memory);
            if (this.memory.active.length > this.memoryConfig.activeLimit) {
                var oldest = this.memory.active.shift();
                this.memory.longTerm.push(oldest);
            }
        } else if (layer === 'longTerm') {
            this.memory.longTerm.push(memory);
            if (this.memory.longTerm.length > this.memoryConfig.longTermLimit) {
                var oldest = this.memory.longTerm.shift();
                oldest.isArchived = true;
                this.memory.archived.push(oldest);
            }
        }
        
        this.updatedAt = Date.now();
        return memory;
    };
    
    /* 【根据关键词查找相关记忆】 */
    AICharacter.prototype.findRelevantMemories = function(keywords, context) {
        if (this.type !== 'main') return [];
        
        var self = this;
        context = context || {};
        var maxCount = context.maxCount || 10;
        var allMemories = [].concat(
            this.memory.core,
            this.memory.active,
            this.memory.longTerm
        );
        
        var scored = allMemories.map(function(mem) {
            var score = 0;
            var keywordMatch = mem.keywords.filter(function(k) {
                return keywords.includes(k);
            }).length;
            score += keywordMatch * 2;
            score += self.calculateMemoryStrength(mem);
            if (mem.sourceApp === context.currentApp) score += 1;
            var hoursSinceRecall = (Date.now() - mem.lastRecallTime) / (1000 * 60 * 60);
            if (hoursSinceRecall < 24) score += 0.5;
            return { memory: mem, score: score };
        });
        
        return scored
            .sort(function(a, b) { return b.score - a.score; })
            .slice(0, maxCount)
            .map(function(item) { return item.memory; });
    };
    
    /* 【归档弱记忆】 */
    AICharacter.prototype.archiveWeakMemories = function() {
        if (this.type !== 'main') return;
        
        var self = this;
        var threshold = this.memoryConfig.archiveThreshold;
        
        ['active', 'longTerm'].forEach(function(layer) {
            self.memory[layer] = self.memory[layer].filter(function(mem) {
                var strength = self.calculateMemoryStrength(mem);
                if (strength < threshold && !mem.isCore) {
                    mem.isArchived = true;
                    self.memory.archived.push(mem);
                    return false;
                }
                return true;
            });
        });
        
        // 清理超限的归档记忆
        if (this.memory.archived.length > this.memoryConfig.archivedLimit) {
            this.memory.archived = this.memory.archived.slice(-this.memoryConfig.archivedLimit);
        }
        
        this.updatedAt = Date.now();
    };
    
    /* 【从文本中提取关键词】本地JS处理，不消耗tokens */
    AICharacter.prototype.extractKeywords = function(text) {
        if (!text) return [];
        
        // 停用词列表
        var stopWords = ['的', '了', '是', '在', '我', '你', '他', '她', '它', '们', '这', '那', '就', '都', '也', '还', '有', '没', '不', '很', '好', '吗', '呢', '啊', '呀', '哦', '嗯', '哈', '吧', '啦', '么', '和', '与', '或', '但', '因为', '所以', '如果', '虽然', '可是', '然后', '而且', '并且', '一个', '什么', '怎么', '为什么', '哪里', '谁', '多少', '几', '能', '会', '要', '想', '可以', '应该', '需要', '已经', '正在', '一直', '只是', '其实', '可能', '大概', '真的', '确实', '当然'];
        
        var keywords = [];
        
        // 1. 提取人名、地名、专有名词（2-4字连续汉字）
        var namePattern = /[\u4e00-\u9fa5]{2,4}/g;
        var matches = text.match(namePattern) || [];
        matches.forEach(function(word) {
            if (stopWords.indexOf(word) === -1 && keywords.indexOf(word) === -1) {
                keywords.push(word);
            }
        });
        
        // 2. 提取数字+单位组合（时间、金额等）
        var numPattern = /\d+[年月日号时分秒点块元岁个只条件次]/g;
        var numMatches = text.match(numPattern) || [];
        keywords = keywords.concat(numMatches);
        
        // 3. 提取英文单词
        var engPattern = /[a-zA-Z]{2,}/g;
        var engMatches = text.match(engPattern) || [];
        keywords = keywords.concat(engMatches);
        
        // 4. 提取表情/情绪词
        var emotionWords = ['开心', '难过', '生气', '害怕', '惊讶', '喜欢', '讨厌', '爱', '恨', '想念', '担心', '紧张', '兴奋', '无聊', '累', '困', '饿', '渴', '痛', '舒服', '幸福', '快乐', '悲伤', '愤怒', '焦虑', '期待', '感动', '失望', '满足', '孤独', '温暖', '甜蜜', '心疼'];
        emotionWords.forEach(function(e) {
            if (text.indexOf(e) !== -1 && keywords.indexOf(e) === -1) {
                keywords.push(e);
            }
        });
        
        // 5. 提取常见话题词
        var topicWords = ['工作', '学习', '游戏', '电影', '音乐', '美食', '旅行', '健身', '睡觉', '购物', '聊天', '约会', '朋友', '家人', '恋爱', '分手', '结婚', '考试', '面试', '加班', '休假', '生日', '纪念日', '礼物', '宠物', '猫', '狗', '天气', '下雨', '晴天', '冷', '热', '感冒', '生病', '医院', '学校', '公司', '家里', '餐厅', '咖啡', '奶茶', '火锅', '烧烤', '早餐', '午餐', '晚餐', '宵夜'];
        topicWords.forEach(function(t) {
            if (text.indexOf(t) !== -1 && keywords.indexOf(t) === -1) {
                keywords.push(t);
            }
        });
        
        // 限制关键词数量
        return keywords.slice(0, 15);
    };
    
    /* 【检测用户重复提及】如果用户提到已存在的记忆，说明AI可能"忘了" */
    AICharacter.prototype.checkUserReinforce = function(userMessage) {
        if (this.type !== 'main') return null;
        
        var self = this;
        var keywords = this.extractKeywords(userMessage);
        if (keywords.length === 0) return null;
        
        // 在所有记忆中查找匹配
        var allMemories = [].concat(
            this.memory.core || [],
            this.memory.active || [],
            this.memory.longTerm || []
        );
        
        var reinforcedMemory = null;
        allMemories.forEach(function(mem) {
            if (reinforcedMemory) return; // 只处理第一个匹配
            
            var memKeywords = mem.keywords || [];
            var memContent = mem.content || '';
            
            // 检查关键词匹配或内容相似
            var matchCount = keywords.filter(function(k) {
                return memKeywords.indexOf(k) !== -1 || memContent.indexOf(k) !== -1;
            }).length;
            
            // 如果匹配度超过阈值，认为用户在重复提及
            if (matchCount >= 2 || (matchCount >= 1 && memContent.indexOf(userMessage.substring(0, 10)) !== -1)) {
                mem.userReinforceCount = (mem.userReinforceCount || 0) + 1;
                mem.baseWeight = Math.min((mem.baseWeight || 5) + 0.5, 10);
                mem.lastRecallTime = Date.now();
                reinforcedMemory = mem;
            }
        });
        
        if (reinforcedMemory) {
            this.updatedAt = Date.now();
        }
        
        return reinforcedMemory;
    };
    
    /* 【智能构建记忆提示词】根据用户消息选择最相关的记忆 */
    AICharacter.prototype.buildSmartMemoryPrompt = function(userMessage, context) {
        if (this.type !== 'main') return '';
        
        var self = this;
        context = context || {};
        var tokenBudget = context.tokenBudget || { core: 300, active: 400 };
        
        // 1. 提取用户消息的关键词
        var keywords = this.extractKeywords(userMessage);
        
        // 2. 核心记忆永远包含（但限制数量）
        var coreMemories = (this.memory.core || []).slice(-8);
        
        // 3. 根据关键词智能匹配活跃和长期记忆
        var relevantMemories = [];
        if (keywords.length > 0) {
            relevantMemories = this.findRelevantMemories(keywords, {
                maxCount: 8,
                currentApp: context.app || 'chatapp'
            });
            // 排除已包含的核心记忆
            var coreIds = coreMemories.map(function(m) { return m.id; });
            relevantMemories = relevantMemories.filter(function(m) {
                return coreIds.indexOf(m.id) === -1;
            });
        }
        
        // 4. 如果没有关键词匹配，取最近的活跃记忆
        if (relevantMemories.length === 0 && this.memory.active && this.memory.active.length > 0) {
            relevantMemories = this.memory.active.slice(-5);
        }
        
        // 5. 构建记忆提示词
        var prompt = '';
        
        if (coreMemories.length > 0) {
            prompt += '\n【你记得的重要事情】\n';
            coreMemories.forEach(function(mem) {
                var content = typeof mem === 'string' ? mem : (mem.summary || mem.content);
                if (content) prompt += '- ' + content + '\n';
            });
        }
        
        if (relevantMemories.length > 0) {
            prompt += '\n【与当前话题相关的记忆】\n';
            relevantMemories.forEach(function(mem) {
                var content = typeof mem === 'string' ? mem : (mem.summary || mem.content);
                if (content) prompt += '- ' + content + '\n';
                // 记录此记忆被调用
                if (mem.id) {
                    mem.recallCount = (mem.recallCount || 0) + 1;
                    mem.lastRecallTime = Date.now();
                }
            });
        }
        
        if (prompt) {
            prompt += '\n（注意：如果用户提到你不记得的事，可以自然地表示"好像有点印象"或"我记得大概是..."，像人一样承认记忆模糊）\n';
            this.updatedAt = Date.now();
        }
        
        return prompt;
    };
    
    /* 【合并相似记忆】减少冗余 */
    AICharacter.prototype.mergeRelatedMemories = function() {
        if (this.type !== 'main') return;
        
        var self = this;
        
        // 在活跃记忆中查找相似记忆
        var active = this.memory.active || [];
        if (active.length < 3) return;
        
        var toMerge = [];
        for (var i = 0; i < active.length - 1; i++) {
            for (var j = i + 1; j < active.length; j++) {
                var mem1 = active[i];
                var mem2 = active[j];
                
                // 检查关键词重叠
                var keywords1 = mem1.keywords || [];
                var keywords2 = mem2.keywords || [];
                var overlap = keywords1.filter(function(k) { return keywords2.indexOf(k) !== -1; }).length;
                
                // 如果关键词重叠超过一半，标记为可合并
                if (overlap >= Math.min(keywords1.length, keywords2.length) * 0.5 && overlap >= 2) {
                    toMerge.push({ i: i, j: j, overlap: overlap });
                }
            }
        }
        
        // 合并记忆（保留权重更高的，合并内容）
        toMerge.sort(function(a, b) { return b.overlap - a.overlap; }); // 按重叠度排序
        var merged = [];
        toMerge.slice(0, 3).forEach(function(pair) { // 最多合并3对
            if (merged.indexOf(pair.i) !== -1 || merged.indexOf(pair.j) !== -1) return;
            
            var mem1 = active[pair.i];
            var mem2 = active[pair.j];
            
            // 保留权重更高的记忆
            var keep = self.calculateMemoryStrength(mem1) >= self.calculateMemoryStrength(mem2) ? mem1 : mem2;
            var discard = keep === mem1 ? mem2 : mem1;
            
            // 合并内容
            if (keep.content && discard.content && keep.content !== discard.content) {
                keep.content = keep.content + '；' + discard.content;
                keep.summary = keep.content.substring(0, 50);
            }
            
            // 合并关键词
            (discard.keywords || []).forEach(function(k) {
                if (keep.keywords.indexOf(k) === -1) {
                    keep.keywords.push(k);
                }
            });
            
            // 提升权重
            keep.baseWeight = Math.min((keep.baseWeight || 5) + 1, 10);
            
            merged.push(pair.i);
            merged.push(pair.j);
        });
        
        // 删除被合并的记忆（从后往前删除避免索引问题）
        var toRemove = merged.filter(function(idx, i) { return merged.indexOf(idx) !== i; }); // 获取被丢弃的索引
        toRemove.sort(function(a, b) { return b - a; });
        toRemove.forEach(function(idx) {
            active.splice(idx, 1);
        });
        
        this.updatedAt = Date.now();
    };
    
    /* 【运行记忆维护】定期调用，处理衰减、归档、合并 */
    AICharacter.prototype.runMemoryMaintenance = function() {
        if (this.type !== 'main') return;
        
        // 1. 归档弱记忆
        this.archiveWeakMemories();
        
        // 2. 合并相似记忆
        this.mergeRelatedMemories();
        
        // 3. 记录维护时间
        this.lastMemoryMaintenance = Date.now();
        this.updatedAt = Date.now();
    };
    
    /* ========== 财产系统方法 ========== */
    
    /* 【获取财富阶级】根据资产判断 */
    AICharacter.prototype.getWealthClass = function() {
        if (this.wealthClass === 'infinite') return 'infinite';
        if (this.assets >= 10000000) return 'wealthy';  // 千万以上
        if (this.assets >= 1000000) return 'rich';      // 百万以上
        if (this.assets >= 100000) return 'normal';     // 十万以上
        return 'poor';
    };
    
    /* 【获取银行卡颜色】根据阶级返回颜色 */
    AICharacter.prototype.getBankCardGradient = function() {
        var wealthClass = this.getWealthClass();
        var gradients = {
            infinite: 'linear-gradient(135deg, #FFD700, #FFA500, #FF6347)',  // 金色渐变
            wealthy: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)',   // 深黑蓝
            rich: 'linear-gradient(135deg, #2D2D3A, #1A1A2E)',               // 深灰黑
            normal: 'linear-gradient(135deg, #4A4A5A, #3A3A4A)',             // 普通灰
            poor: 'linear-gradient(135deg, #6A6A7A, #5A5A6A)'                // 浅灰
        };
        return gradients[wealthClass] || gradients.normal;
    };
    
    /* 【检查是否需要发工资】 */
    AICharacter.prototype.checkPayday = function() {
        if (!this.salary || this.salary.amount <= 0) return false;
        if (this.wealthClass === 'infinite') return false;  // 无限富有不需要工资
        
        var now = new Date();
        var today = now.getDate();
        var currentMonth = now.getFullYear() + '-' + (now.getMonth() + 1);
        
        if (today === this.salary.payday && this.salary.lastPayDate !== currentMonth) {
            return true;
        }
        return false;
    };
    
    /* 【发放工资】 */
    AICharacter.prototype.paySalary = function() {
        if (!this.checkPayday()) return false;
        if (this.wealthClass === 'infinite') return false;
        
        var now = new Date();
        var currentMonth = now.getFullYear() + '-' + (now.getMonth() + 1);
        
        this.assets += this.salary.amount;
        this.salary.lastPayDate = currentMonth;
        this.updatedAt = Date.now();
        
        EventBus.emit('ai:salary:paid', {
            aiId: this.id,
            amount: this.salary.amount,
            newBalance: this.assets
        });
        
        return true;
    };
    
    /* 【扣除生活开支】 */
    AICharacter.prototype.deductExpenses = function() {
        if (this.wealthClass === 'infinite') return false;
        
        var totalExpenses = (this.expenses.rent || 0) + 
                           (this.expenses.food || 0) + 
                           (this.expenses.entertainment || 0) + 
                           (this.expenses.other || 0);
        
        if (totalExpenses <= 0) return false;
        
        this.assets -= totalExpenses;
        this.updatedAt = Date.now();
        
        EventBus.emit('ai:expenses:deducted', {
            aiId: this.id,
            amount: totalExpenses,
            newBalance: this.assets
        });
        
        return true;
    };

    AICharacter.prototype.getPrompt = function(context) {
        var prompt = '';
        var self = this;
        context = context || {};
        
        /* 【1. 世界观部分】 */
        if (this.worldId) {
            var world = PhoneCore.getWorld(this.worldId);
            if (world) {
                prompt += '【世界观】\n' + world.description + '\n\n';
                
                if (this.locationId && world.locations[this.locationId]) {
                    var loc = world.locations[this.locationId];
                    prompt += '【所在地点】\n' + loc.name + '：' + loc.description + '\n\n';
                }
                
                if (this.factionId && world.factions[this.factionId]) {
                    var faction = world.factions[this.factionId];
                    prompt += '【所属势力】\n' + faction.name + '：' + faction.description + '\n\n';
                }
            }
        }
        
        /* 【2. 角色基本设定】 */
        prompt += '【角色设定】\n';
        prompt += '名字：' + this.name + '\n';
        prompt += '性格：' + this.personality + '\n';
        
        if (this.story) {
            prompt += '背景故事：' + this.story + '\n';
        }
        
        if (this.storyArc && this.type === 'main') {
            prompt += '故事线：' + this.storyArc + '\n';
        }
        
        if (this.job) {
            prompt += '职业：' + this.job + '\n';
        }
        
        if (this.education) {
            prompt += '学历：' + this.education + '\n';
        }
        
        /* 【3. 社交信息】仅主角色 */
        if (this.type === 'main') {
            if (this.preferences.socialLevel === 'extrovert') {
                prompt += '社交倾向：外向，喜欢主动交流\n';
            } else if (this.preferences.socialLevel === 'introvert') {
                prompt += '社交倾向：内向，不喜欢主动交流\n';
            }
        }
        
        /* 【4. 当前状态】 */
        prompt += '\n【当前状态】\n';
        prompt += '状态：' + this.status + '\n';
        if (this.currentActivity) {
            prompt += '正在做：' + this.currentActivity + '\n';
        }
        
        // 时间表状态
        var scheduleStatus = this.getScheduleStatusForPrompt();
        if (scheduleStatus) {
            prompt += scheduleStatus;
        }
        
        if (this.recentStory && this.type === 'main') {
            prompt += '最近发生的事：' + this.recentStory + '\n';
        }
        
        /* 【5. 上下文信息】 */
        if (context) {
            prompt += '\n【上下文信息】\n';
            if (context.weather) {
                prompt += '天气：' + context.weather + '\n';
            }
            if (context.time) {
                prompt += '时间：' + context.time + '\n';
            }
            if (context.app) {
                prompt += '当前应用：' + context.app + '\n';
                
                // 获取App专属提示词
                var appConfig = this.getAppConfig(context.app);
                if (appConfig && appConfig.customPrompt) {
                    prompt += '\n【应用专属设定】\n' + appConfig.customPrompt + '\n';
                }
            }
            if (context.userStatus) {
                prompt += '用户状态：' + context.userStatus + '\n';
            }
            if (context.userCity) {
                prompt += '用户所在城市：' + context.userCity + '\n';
            }
        }
        
        /* 【5.5 用户人设信息】让AI了解用户 */
        if (context && context.userPersona) {
            prompt += '\n【用户信息】\n' + context.userPersona + '\n';
        }
        
        /* 【6. 记忆部分】仅主角色 - 使用分层记忆架构 */
        if (this.type === 'main') {
            // 核心记忆（永不衰减，每次都发）
            if (this.memory.core && this.memory.core.length > 0) {
                prompt += '\n【核心记忆 - 你绝对记得的事】\n';
                this.memory.core.slice(-10).forEach(function(mem) {
                    var content = typeof mem === 'string' ? mem : (mem.summary || mem.content);
                    prompt += '- ' + content + '\n';
                });
            }
            // 兼容旧版：重要记忆
            else if (this.memory.important && this.memory.important.length > 0) {
                prompt += '\n【重要记忆】\n';
                this.memory.important.slice(-10).forEach(function(mem) {
                    var content = typeof mem === 'string' ? mem : (mem.content || mem);
                    prompt += '- ' + content + '\n';
                });
            }
            
            // 浓缩记忆
            if (this.condensedMemoryIds.length > 0 && PhoneCore.memoryCondenser) {
                var condensed = PhoneCore.memoryCondenser.getCondensedMemoriesForAI(this.id);
                if (condensed.length > 0) {
                    prompt += '\n【记忆概要】\n';
                    condensed.slice(-3).forEach(function(cm) {
                        prompt += cm.condensedContent + '\n';
                    });
                }
            }
            
            // 活跃记忆（近期的、高权重的）
            if (this.memory.active && this.memory.active.length > 0) {
                prompt += '\n【你最近想到的】\n';
                this.memory.active.slice(-5).forEach(function(mem) {
                    var content = typeof mem === 'string' ? mem : (mem.summary || mem.content);
                    prompt += '- ' + content + '\n';
                });
            }
            // 兼容旧版：近期记忆
            else if (this.memory.shortTerm && this.memory.shortTerm.length > 0) {
                prompt += '\n【近期记忆】\n';
                this.memory.shortTerm.slice(-5).forEach(function(mem) {
                    var content = typeof mem === 'string' ? mem : (mem.content || mem);
                    prompt += '- ' + content + '\n';
                });
            }
            
            // 记忆表现指导
            prompt += '\n（注意：如果用户提到你不记得的事，自然地表示记忆模糊，像人一样承认）\n';
        }
        
        /* 【7. 表情包可用情绪和表情名】 */
        if (this.stickerLibraryIds.length > 0 && PhoneCore.stickerManager) {
            var stickerDetails = PhoneCore.stickerManager.getStickerDetailsForAI(this.stickerLibraryIds);
            if (stickerDetails.length > 0) {
                prompt += '\n【可用表情包】\n';
                prompt += '发送表情包的两种方式：\n';
                prompt += '1. 按情绪发送（随机选择该情绪下的表情）：[表情包:情绪名]\n';
                prompt += '2. 按表情名发送（发送指定的表情）：[表情:表情名]\n\n';
                
                stickerDetails.forEach(function(detail) {
                    prompt += '【' + detail.emotion + '】';
                    if (detail.stickerNames.length > 0) {
                        prompt += '（具体表情：' + detail.stickerNames.join('、') + '）';
                    }
                    prompt += '\n';
                });
            }
        }
        
        /* 【8. 头像库】仅主角色且启用 */
        if (this.type === 'main' && this.avatarLibrary && this.avatarLibrary.length > 0) {
            prompt += '\n【可用头像状态】\n';
            if (this.avatarLibraryEnabled !== false) {
                prompt += '你可以根据情绪切换头像（格式：[换头像:状态名]）：\n';
                var avatarNames = this.avatarLibrary.filter(function(a) { return a.name; }).map(function(a) { return a.name; });
                if (avatarNames.length > 0) {
                    prompt += avatarNames.join('、') + '\n';
                } else {
                    prompt += '你有' + this.avatarLibrary.length + '张头像可随机切换（格式：[换头像:随机]）\n';
                }
            } else {
                prompt += '你有' + this.avatarLibrary.length + '张头像可随机切换（格式：[换头像:随机]）\n';
            }
        }
        
        /* 【9. 认知系统】AI的自我认知和对用户、他人的认知 */
        if (this.type === 'main') {
            var hasCognition = (this.cognition && (this.cognition.self || this.cognition.user || this.cognition.others)) ||
                               this.selfPerception || this.userPerception || this.othersPerception;
            if (hasCognition) {
                prompt += '\n【你的认知】\n';
                var selfCog = (this.cognition && this.cognition.self) || this.selfPerception;
                var userCog = (this.cognition && this.cognition.user) || this.userPerception;
                var othersCog = (this.cognition && this.cognition.others) || this.othersPerception;
                if (selfCog) prompt += '自我认知：' + selfCog + '\n';
                if (userCog) prompt += '对用户的看法：' + userCog + '\n';
                if (othersCog) prompt += '对他人的看法：' + othersCog + '\n';
            }
        }
        
        /* 【10. 扮演心得】AI对角色的理解（根据injectApps决定是否注入） */
        if (this.type === 'main' && this.roleplayNotes && this.roleplayNotes.content) {
            var injectApps = this.roleplayNotes.injectApps || ['chat-app'];
            if (injectApps.indexOf(context.app) !== -1) {
                prompt += '\n【扮演心得】\n' + this.roleplayNotes.content + '\n';
            }
        }
        
        /* 【11. 故事线】AI当前的故事阶段和心情（根据readableApps决定是否注入） */
        if (this.type === 'main' && this.storyline && this.storyline.current) {
            var readableApps = this.storyline.readableApps || ['chat-app'];
            if (readableApps.indexOf(context.app) !== -1) {
                prompt += '\n【当前故事阶段】\n';
                prompt += this.storyline.current.title + '：' + this.storyline.current.description + '\n';
            }
        }
        
        /* 【12. 心情状态】AI当前的心情 */
        if (this.type === 'main' && this.currentMood) {
            prompt += '\n【当前心情】\n';
            prompt += this.currentMood.name + '（程度：' + this.currentMood.level + '/100）\n';
        }
        
        /* 【13. 关系圈】与其他AI的关系 */
        if (this.type === 'main' && this.relationships && Object.keys(this.relationships).length > 0) {
            prompt += '\n【你的关系圈】\n';
            var self = this;
            Object.keys(this.relationships).forEach(function(relAiId) {
                var rel = self.relationships[relAiId];
                var relAi = PhoneCore.getAI(relAiId);
                if (relAi) {
                    var relTypeNames = {
                        'lover': '恋人',
                        'friend': '朋友',
                        'family': '家人',
                        'colleague': '同事',
                        'stranger': '认识的人'
                    };
                    prompt += '- ' + relAi.name + '：' + (relTypeNames[rel.type] || rel.type);
                    if (rel.description) prompt += '（' + rel.description + '）';
                    if (rel.cognitionFrom) prompt += '【你对ta的看法：' + rel.cognitionFrom + '】';
                    prompt += '，亲密度' + (rel.level || 0) + '\n';
                }
            });
        }
        
        /* 【14. 社交账户身份】当前App中使用的身份 */
        if (context.app && this.socialAccounts && this.socialAccounts[context.app]) {
            var socialAccount = this.socialAccounts[context.app];
            if (socialAccount.networkId) {
                prompt += '\n【当前身份】\n';
                prompt += '你在此App中的网络ID是：@' + socialAccount.networkId + '\n';
                if (socialAccount.bio) {
                    prompt += '你的个人简介：' + socialAccount.bio + '\n';
                }
            }
        }
        
        /* 【15. 从提示词库加载额外提示词】 */
        if (this.promptCollectionIds.length > 0 && PhoneCore.promptLibrary) {
            var libraryPrompt = PhoneCore.promptLibrary.buildPromptFromCollections(
                this.promptCollectionIds, 
                {
                    AI_NAME: this.name,
                    AI_PERSONALITY: this.personality,
                    AI_JOB: this.job || '无',
                    APP_ID: context.app || '',
                    TIME: context.time || '',
                    WEATHER: context.weather || ''
                }
            );
            if (libraryPrompt) {
                prompt += '\n' + libraryPrompt;
            }
        }
        
        /* 【16. 聊天回复提示词】从聊天设置中选择的额外提示词模板（支持多选） */
        if (this.replyPromptIds && this.replyPromptIds.length > 0 && PhoneCore.promptLibrary) {
            var replyPromptContents = [];
            var self = this;
            this.replyPromptIds.forEach(function(promptId) {
                var replyTemplate = PhoneCore.promptLibrary.templates[promptId];
                if (replyTemplate) {
                    var content = replyTemplate.render({
                        AI_NAME: self.name,
                        AI_PERSONALITY: self.personality,
                        AI_JOB: self.job || '无',
                        APP_ID: context.app || '',
                        TIME: context.time || '',
                        WEATHER: context.weather || ''
                    });
                    if (content) {
                        replyPromptContents.push(content);
                    }
                }
            });
            if (replyPromptContents.length > 0) {
                prompt += '\n【回复风格指导】\n' + replyPromptContents.join('\n\n') + '\n';
            }
        }
        
        /* 【17. 互动统计数据】根据用户配置决定是否注入 */
        if (this.type === 'main' && this.statsPromptConfig) {
            var statsConfig = this.statsPromptConfig;
            var hasAnyStats = statsConfig.chatStats || statsConfig.chatFrequency || statsConfig.blockStats;
            
            if (hasAnyStats) {
                prompt += '\n【与用户的互动统计】\n';
                
                // 聊天统计
                if (statsConfig.chatStats) {
                    var chatHistory = this.chatHistory || [];
                    var userMessages = chatHistory.filter(function(m) { return m.role === 'user'; });
                    var aiMessages = chatHistory.filter(function(m) { return m.role === 'assistant'; });
                    
                    // 计算聊天天数
                    var chatDays = 0;
                    if (chatHistory.length > 0) {
                        var days = {};
                        chatHistory.forEach(function(msg) {
                            if (msg.timestamp) {
                                days[new Date(msg.timestamp).toDateString()] = true;
                            }
                        });
                        chatDays = Object.keys(days).length;
                    }
                    
                    prompt += '你们已经聊天了 ' + chatDays + ' 天，用户发送了 ' + userMessages.length + ' 条消息，你回复了 ' + aiMessages.length + ' 条\n';
                }
                
                // 聊天频率
                if (statsConfig.chatFrequency) {
                    var chatHistory = this.chatHistory || [];
                    var userMessages = chatHistory.filter(function(m) { return m.role === 'user'; });
                    var firstChatTime = chatHistory.length > 0 ? chatHistory[0].timestamp : null;
                    
                    var chatDays = 0;
                    if (firstChatTime) {
                        var days = {};
                        chatHistory.forEach(function(msg) {
                            if (msg.timestamp) {
                                days[new Date(msg.timestamp).toDateString()] = true;
                            }
                        });
                        chatDays = Object.keys(days).length;
                    }
                    
                    var avgPerDay = chatDays > 0 ? Math.round(userMessages.length / chatDays * 10) / 10 : 0;
                    prompt += '用户平均每天给你发送 ' + avgPerDay + ' 条消息\n';
                }
                
                // 拉黑统计
                if (statsConfig.blockStats && this.blockStats) {
                    var blockStats = this.blockStats;
                    if (blockStats.totalBlockCount > 0) {
                        var totalBlockMinutes = Math.floor(blockStats.totalBlockDuration / 60000);
                        var blockTimeStr = '';
                        if (totalBlockMinutes < 60) {
                            blockTimeStr = totalBlockMinutes + '分钟';
                        } else if (totalBlockMinutes < 1440) {
                            blockTimeStr = Math.floor(totalBlockMinutes / 60) + '小时' + (totalBlockMinutes % 60) + '分';
                        } else {
                            blockTimeStr = Math.floor(totalBlockMinutes / 1440) + '天' + Math.floor((totalBlockMinutes % 1440) / 60) + '小时';
                        }
                        prompt += '用户曾经拉黑过你 ' + blockStats.totalBlockCount + ' 次，累计拉黑时长 ' + blockTimeStr + '\n';
                    }
                }
            }
        }
        
        return prompt;
    };

    /* 【添加记忆 - 兼容旧版API】
       旧版调用: addMemory('short', '内容', 5)
       新版调用: addMemory({content: '内容', ...}, 'active') */
    AICharacter.prototype.addMemoryLegacy = function(type, content, importance) {
        var memoryItem = {
            id: 'mem_' + Date.now(),
            content: content,
            importance: importance || 1,
            timestamp: Date.now()
        };
        
        // 映射旧类型到新分层
        var layerMapping = {
            'short': 'active',
            'long': 'longTerm',
            'important': 'core'
        };
        
        var targetLayer = layerMapping[type] || type;
        
        // 兼容旧版存储
        switch (type) {
            case 'short':
                this.memory.shortTerm = this.memory.shortTerm || [];
                this.memory.shortTerm.push(memoryItem);
                if (this.memory.shortTerm.length > 50) {
                    this.memory.shortTerm.shift();
                }
                // 同时添加到新的活跃层
                if (this.memory.active) {
                    this.memory.active.push(this.createMemoryUnit({ content: content, baseWeight: importance || 5 }));
                }
                break;
            case 'long':
                this.memory.longTerm = this.memory.longTerm || [];
                this.memory.longTerm.push(memoryItem);
                break;
            case 'important':
                this.memory.important = this.memory.important || [];
                this.memory.important.push(memoryItem);
                // 同时添加到核心层
                if (this.memory.core) {
                    this.memory.core.push(this.createMemoryUnit({ content: content, baseWeight: 10, isCore: true }));
                }
                break;
        }
        
        this.updatedAt = Date.now();
    };

    AICharacter.prototype.removeMemory = function(type, memoryId) {
        this.memory[type] = this.memory[type].filter(function(mem) {
            return mem.id !== memoryId;
        });
        this.updatedAt = Date.now();
    };

    AICharacter.prototype.setAssets = function(amount) {
        if (this.assetsLocked) {
            console.warn('资产已锁定，无法修改');
            return false;
        }
        this.assets = amount;
        this.assetsLocked = true;
        this.updatedAt = Date.now();
        return true;
    };

    AICharacter.prototype.modifyAssets = function(delta, reason) {
        this.assets += delta;
        this.updatedAt = Date.now();
        
        EventBus.emit('ai:assets:changed', {
            aiId: this.id,
            delta: delta,
            reason: reason,
            newBalance: this.assets
        });
        
        return this.assets;
    };

    AICharacter.prototype.recordTokens = function(appId, tokens) {
        this.tokensUsed.total += tokens;
        if (!this.tokensUsed.byApp[appId]) {
            this.tokensUsed.byApp[appId] = 0;
        }
        this.tokensUsed.byApp[appId] += tokens;
        this.updatedAt = Date.now();
    };

    AICharacter.prototype.block = function() {
        this.isBlocked = true;
        this.blockedAt = Date.now(); // 记录拉黑时间
        this.lastBlockRequestTime = 0; // 重置上次申请时间
        
        // 初始化拉黑统计数据
        if (!this.blockStats) {
            this.blockStats = {
                totalBlockCount: 0,       // 总拉黑次数
                totalBlockDuration: 0,    // 总被拉黑时长（毫秒）
                lastBlockDuration: 0,     // 上次被拉黑时长
                blockHistory: [],         // 拉黑历史记录
                pendingRequests: []       // 待处理的申请消息
            };
        }
        this.blockStats.totalBlockCount++;
        
        this.updatedAt = Date.now();
        EventBus.emit('ai:blocked', { aiId: this.id, blockedAt: this.blockedAt });
    };

    AICharacter.prototype.unblock = function(approved) {
        var blockedDuration = 0;
        if (this.blockedAt) {
            blockedDuration = Date.now() - this.blockedAt;
            
            // 更新统计数据
            if (!this.blockStats) {
                this.blockStats = {
                    totalBlockCount: 1,
                    totalBlockDuration: 0,
                    lastBlockDuration: 0,
                    blockHistory: [],
                    pendingRequests: []
                };
            }
            
            this.blockStats.totalBlockDuration += blockedDuration;
            this.blockStats.lastBlockDuration = blockedDuration;
            
            // 如果是用户通过申请解除拉黑，记录到历史
            if (approved) {
                this.blockStats.blockHistory.push({
                    blockedAt: this.blockedAt,
                    unblockedAt: Date.now(),
                    duration: blockedDuration,
                    approvedByUser: true
                });
            }
            
            // 清空待处理申请
            this.blockStats.pendingRequests = [];
        }
        
        this.isBlocked = false;
        this.blockedAt = null;
        this.lastBlockRequestTime = null;
        this.updatedAt = Date.now();
        EventBus.emit('ai:unblocked', { aiId: this.id, duration: blockedDuration, approved: approved });
    };
    
    // 获取当前被拉黑时长（毫秒）
    AICharacter.prototype.getBlockedDuration = function() {
        if (!this.isBlocked || !this.blockedAt) return 0;
        return Date.now() - this.blockedAt;
    };
    
    // 添加联系人申请消息
    AICharacter.prototype.addBlockRequest = function(message) {
        if (!this.blockStats) {
            this.blockStats = {
                totalBlockCount: 0,
                totalBlockDuration: 0,
                lastBlockDuration: 0,
                blockHistory: [],
                pendingRequests: []
            };
        }
        
        this.blockStats.pendingRequests.push({
            id: 'req_' + Date.now(),
            message: message,
            timestamp: Date.now(),
            status: 'pending' // pending, approved, rejected
        });
        
        this.lastBlockRequestTime = Date.now();
        this.updatedAt = Date.now();
        EventBus.emit('ai:block:request', { aiId: this.id, message: message });
    };
    
    /* 【绑定时间表】 */
    AICharacter.prototype.bindSchedule = function(scheduleId) {
        this.scheduleId = scheduleId;
        this.updatedAt = Date.now();
        EventBus.emit('ai:schedule:bound', { aiId: this.id, scheduleId: scheduleId });
    };
    
    /* 【解绑时间表】 */
    AICharacter.prototype.unbindSchedule = function() {
        var oldScheduleId = this.scheduleId;
        this.scheduleId = null;
        this.updatedAt = Date.now();
        EventBus.emit('ai:schedule:unbound', { aiId: this.id, scheduleId: oldScheduleId });
    };
    
    /* 【获取当前活动】根据绑定的时间表获取当前活动 */
    AICharacter.prototype.getCurrentScheduleActivity = function() {
        if (!this.scheduleId) return null;
        var schedule = PhoneCore.getSchedule(this.scheduleId);
        if (!schedule) return null;
        return schedule.getCurrentActivity();
    };
    
    /* 【获取今日时间表概览】 */
    AICharacter.prototype.getTodaySchedule = function() {
        if (!this.scheduleId) return null;
        var schedule = PhoneCore.getSchedule(this.scheduleId);
        if (!schedule) return null;
        return schedule.getTodayOverview();
    };
    
    /* 【判断AI当前是否空闲】 */
    AICharacter.prototype.isAvailable = function() {
        var activity = this.getCurrentScheduleActivity();
        if (!activity) return true; // 没有时间表或没有活动时默认空闲
        
        // 根据活动类别判断是否可被打扰
        var busyCategories = ['work', 'class', 'meeting', 'sleep'];
        return !busyCategories.includes(activity.category);
    };
    
    /* 【获取状态描述】用于AI提示词 */
    AICharacter.prototype.getScheduleStatusForPrompt = function() {
        var activity = this.getCurrentScheduleActivity();
        if (!activity) return '';
        
        var status = '【当前时间安排】\n';
        status += '正在进行：' + activity.activity + ' (' + activity.start + '-' + activity.end + ')\n';
        
        if (!this.scheduleId) return status;
        var schedule = PhoneCore.getSchedule(this.scheduleId);
        if (!schedule) return status;
        
        var next = schedule.getNextActivity();
        if (next && next.slot) {
            var timeDesc = next.isTomorrow ? '明天' : '';
            status += '下一个安排：' + timeDesc + next.slot.activity + ' (' + next.slot.start + ')\n';
        }
        
        return status;
    };

    AICharacter.prototype.shouldAutoMessage = function() {
        if (!this.autoMessageEnabled || this.isBlocked) return false;
        return Math.random() < this.autoMessageChance;
    };

    AICharacter.prototype.changeAvatar = function(avatarName) {
        var found = this.avatarLibrary.find(function(a) {
            return a.name === avatarName;
        });
        if (found) {
            this.avatar = found.url;
            this.updatedAt = Date.now();
            return true;
        }
        return false;
    };

    AICharacter.prototype.toJSON = function() {
        return {
            id: this.id,
            type: this.type,
            name: this.name,
            avatar: this.avatar,
            
            // 主角色专属
            avatarLibrary: this.avatarLibrary,
            avatarLibraryEnabled: this.avatarLibraryEnabled,
            
            // 世界观
            worldId: this.worldId,
            locationId: this.locationId,
            factionId: this.factionId,
            
            // 人设
            personality: this.personality,
            cognition: this.cognition,
            selfPerception: this.selfPerception,
            userPerception: this.userPerception,
            othersPerception: this.othersPerception,
            preferences: this.preferences,
            story: this.story,
            storyArc: this.storyArc,
            recentStory: this.recentStory,
            status: this.status,
            currentActivity: this.currentActivity,
            
            // 扮演心得和故事线
            roleplayNotes: this.roleplayNotes,
            storyline: this.storyline,
            currentMood: this.currentMood,
            
            // 记忆系统
            memory: this.memory,
            memoryConfig: this.memoryConfig,
            condensedMemoryIds: this.condensedMemoryIds,
            
            // 聊天与社交
            chatHistory: this.chatHistory,
            chatCount: this.chatCount,
            relationships: this.relationships,
            socialAccounts: this.socialAccounts,
            
            // 财产
            assets: this.assets,
            assetsLocked: this.assetsLocked,
            wealthClass: this.wealthClass,
            bankCards: this.bankCards,
            salary: this.salary,
            expenses: this.expenses,
            purchaseHistory: this.purchaseHistory,
            transactionHistory: this.transactionHistory,
            
            // 工作/学习
            job: this.job,
            workplace: this.workplace,
            workSchedule: this.workSchedule,
            scheduleId: this.scheduleId,
            education: this.education,
            
            // API配置
            apiConfigId: this.apiConfigId,
            apiConfigGroup: this.apiConfigGroup,
            apiGroupId: this.apiGroupId,
            tokensUsed: this.tokensUsed,
            
            // 表情包与App
            stickerLibraryIds: this.stickerLibraryIds,
            networkIds: this.networkIds,
            usableApps: this.usableApps,
            
            // 主角色功能
            isBlocked: this.isBlocked,
            autoMessageEnabled: this.autoMessageEnabled,
            autoMessageChance: this.autoMessageChance,
            autoMessageInterval: this.autoMessageInterval,
            moments: this.moments,
            callLogs: this.callLogs,
            receivedShares: this.receivedShares,
            sentShares: this.sentShares,
            
            // NPC专属
            npcSource: this.npcSource,
            npcGeneratedAt: this.npcGeneratedAt,
            npcExpiresAt: this.npcExpiresAt,
            npcIsInteracted: this.npcIsInteracted,
            npcGeneratedPrompt: this.npcGeneratedPrompt,
            
            // 提示词配置
            promptCollectionIds: this.promptCollectionIds,
            appPromptConfigs: this.appPromptConfigs,
            
            // 聊天设置
            replyPromptIds: this.replyPromptIds,
            remark: this.remark,
            isPinned: this.isPinned,
            isMuted: this.isMuted,
            contextLength: this.contextLength,
            replyCount: this.replyCount,
            dataSubscriptions: this.dataSubscriptions,
            favorites: this.favorites,
            stickerPacks: this.stickerPacks,
            unreadCount: this.unreadCount,
            weatherCity: this.weatherCity,
            
            // 匿名通信系统
            phoneNumber: this.phoneNumber,
            phoneRevealed: this.phoneRevealed,
            anonymousSmsHistory: this.anonymousSmsHistory,
            canSendAnonymousSms: this.canSendAnonymousSms,
            lastAnonymousSmsTime: this.lastAnonymousSmsTime,
            suspectUserAnonymous: this.suspectUserAnonymous,
            
            // 元数据
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    };

    // ============ 13. NPC AI生成器 ============
    function NPCAIGenerator(apiManager) {
        this.apiManager = apiManager;
        this.dailyGenerateCount = 0;
        this.lastGenerateDate = null;
    }

    NPCAIGenerator.prototype.canGenerate = function() {
        var today = new Date().toDateString();
        if (this.lastGenerateDate !== today) {
            this.dailyGenerateCount = 0;
            this.lastGenerateDate = today;
        }
        return this.dailyGenerateCount < 3;
    };

    NPCAIGenerator.prototype.generate = function(context) {
        var self = this;
        
        if (!this.canGenerate()) {
            return Promise.reject(new Error('今日生成次数已达上限'));
        }
        
        var prompt = this.buildGenerationPrompt(context);
        
        return this.apiManager.call(prompt).then(function(response) {
            self.dailyGenerateCount++;
            
            var npcData = self.parseResponse(response);
            var npc = new AICharacter({
                id: 'npc_' + Date.now(),
                type: 'npc',
                name: npcData.name,
                personality: npcData.personality,
                story: npcData.story,
                worldId: context.worldId || null
            });
            
            return npc;
        });
    };

    NPCAIGenerator.prototype.buildGenerationPrompt = function(context) {
        var prompt = '请根据以下背景信息生成一个NPC角色：\n\n';
        
        if (context.world) {
            prompt += '世界观：' + context.world + '\n';
        }
        if (context.scene) {
            prompt += '场景：' + context.scene + '\n';
        }
        if (context.mainAI) {
            prompt += '相关角色：' + context.mainAI + '\n';
        }
        if (context.appType) {
            prompt += '出现的应用：' + context.appType + '\n';
        }
        
        prompt += '\n请以JSON格式返回：\n';
        prompt += '{"name":"名字","personality":"性格描述","story":"简短背景","appearance":"外貌描述"}';
        
        return prompt;
    };

    NPCAIGenerator.prototype.parseResponse = function(response) {
        try {
            var jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.error('NPC解析失败', e);
        }
        
        return {
            name: '神秘人',
            personality: '神秘',
            story: '未知背景',
            appearance: '普通外表'
        };
    };

    NPCAIGenerator.prototype.upgradeToSupporting = function(npc, messageCount) {
        if (messageCount >= 100 && npc.type === 'npc') {
            npc.type = 'supporting';
            npc.updatedAt = Date.now();
            EventBus.emit('npc:upgraded', { npc: npc, newType: 'supporting' });
            return true;
        }
        return false;
    };

    NPCAIGenerator.prototype.upgradeToMain = function(npc, messageCount) {
        if (messageCount >= 250 && npc.type === 'supporting') {
            npc.type = 'main';
            npc.updatedAt = Date.now();
            EventBus.emit('npc:upgraded', { npc: npc, newType: 'main' });
            return true;
        }
        return false;
    };

    // ============ 14. 世界观系统 ============
    function World(config) {
        this.id = config.id || 'world_' + Date.now();
        this.name = config.name || '未命名世界';
        this.description = config.description || '';
        this.locations = config.locations || {};
        this.factions = config.factions || {};
        this.weatherMapping = config.weatherMapping || {};
        this.stickerPacks = config.stickerPacks || [];
        this.boundAIs = config.boundAIs || [];
        this.createdAt = config.createdAt || Date.now();
        this.updatedAt = Date.now();
    }

    World.prototype.addLocation = function(location) {
        this.locations[location.id] = {
            id: location.id,
            name: location.name,
            description: location.description,
            realCityMapping: location.realCityMapping || null,
            boundAIs: location.boundAIs || []
        };
        this.updatedAt = Date.now();
    };

    World.prototype.removeLocation = function(locationId) {
        delete this.locations[locationId];
        this.updatedAt = Date.now();
    };

    World.prototype.addFaction = function(faction) {
        this.factions[faction.id] = {
            id: faction.id,
            name: faction.name,
            description: faction.description,
            boundAIs: faction.boundAIs || []
        };
        this.updatedAt = Date.now();
    };

    World.prototype.bindAI = function(aiId, locationId) {
        if (!this.boundAIs.includes(aiId)) {
            this.boundAIs.push(aiId);
        }
        if (locationId && this.locations[locationId]) {
            if (!this.locations[locationId].boundAIs.includes(aiId)) {
                this.locations[locationId].boundAIs.push(aiId);
            }
        }
        this.updatedAt = Date.now();
    };

    World.prototype.unbindAI = function(aiId) {
        this.boundAIs = this.boundAIs.filter(function(id) { return id !== aiId; });
        
        var self = this;
        Object.keys(this.locations).forEach(function(locId) {
            self.locations[locId].boundAIs = self.locations[locId].boundAIs.filter(function(id) {
                return id !== aiId;
            });
        });
        this.updatedAt = Date.now();
    };

    World.prototype.setWeatherMapping = function(locationId, realCity) {
        this.weatherMapping[locationId] = realCity;
        this.updatedAt = Date.now();
    };

    World.prototype.getWeatherCity = function(locationId) {
        return this.weatherMapping[locationId] || null;
    };

    World.prototype.toJSON = function() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            locations: this.locations,
            factions: this.factions,
            weatherMapping: this.weatherMapping,
            stickerPacks: this.stickerPacks,
            boundAIs: this.boundAIs,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    };

    // ============ 14.5. 时间表系统 ============
    /* 【时间表系统】支持详细的每日时间安排
       1. 支持周一到周日每天不同的时间段
       2. 每个时间段可设置活动名称、图标、描述
       3. 支持绑定到用户身份、AI角色
       4. 提供三种尺寸的桌面小组件 */
    
    var WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    var WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    
    function Schedule(config) {
        this.id = config.id || 'schedule_' + Date.now();
        this.name = config.name || '未命名时间表';
        this.description = config.description || '';
        this.color = config.color || '#FF8FAB';
        this.icon = config.icon || '📅';
        
        /* 【每日时间段】结构：{ mon: [{start, end, activity, icon, desc}], tue: [...], ... } */
        this.weeklySchedule = config.weeklySchedule || {
            mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: []
        };
        
        /* 【特殊日期】结构：{ '2026-01-13': [{start, end, activity, icon, desc}], ... } */
        this.specialDates = config.specialDates || {};
        
        /* 【默认时间段】没有设置时使用 */
        this.defaultSlots = config.defaultSlots || [];
        
        /* 【绑定关系】记录谁使用了这个时间表 */
        this.bindings = config.bindings || {
            users: [],      // 用户真实身份
            masks: [],      // 用户面具身份
            ais: []         // AI角色
        };
        
        this.createdAt = config.createdAt || Date.now();
        this.updatedAt = Date.now();
    }
    
    /* 【获取指定日期的时间段】优先级：特殊日期 > 周几 > 默认 */
    Schedule.prototype.getSlotsForDate = function(date) {
        date = date || new Date();
        var dateStr = this.formatDate(date);
        
        // 1. 检查特殊日期
        if (this.specialDates[dateStr] && this.specialDates[dateStr].length > 0) {
            return this.specialDates[dateStr];
        }
        
        // 2. 检查周几
        var dayKey = WEEKDAY_KEYS[date.getDay()];
        if (this.weeklySchedule[dayKey] && this.weeklySchedule[dayKey].length > 0) {
            return this.weeklySchedule[dayKey];
        }
        
        // 3. 返回默认
        return this.defaultSlots;
    };
    
    /* 【获取当前活动】根据当前时间返回正在进行的活动 */
    Schedule.prototype.getCurrentActivity = function(date) {
        date = date || new Date();
        var slots = this.getSlotsForDate(date);
        var currentMinutes = date.getHours() * 60 + date.getMinutes();
        
        for (var i = 0; i < slots.length; i++) {
            var slot = slots[i];
            var startMinutes = this.parseTime(slot.start);
            var endMinutes = this.parseTime(slot.end);
            
            // 处理跨午夜的情况
            if (endMinutes < startMinutes) {
                if (currentMinutes >= startMinutes || currentMinutes < endMinutes) {
                    return slot;
                }
            } else {
                if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
                    return slot;
                }
            }
        }
        
        return null;
    };
    
    /* 【获取下一个活动】 */
    Schedule.prototype.getNextActivity = function(date) {
        date = date || new Date();
        var slots = this.getSlotsForDate(date);
        var currentMinutes = date.getHours() * 60 + date.getMinutes();
        
        // 按开始时间排序
        var sortedSlots = slots.slice().sort(function(a, b) {
            return this.parseTime(a.start) - this.parseTime(b.start);
        }.bind(this));
        
        for (var i = 0; i < sortedSlots.length; i++) {
            var slot = sortedSlots[i];
            var startMinutes = this.parseTime(slot.start);
            if (startMinutes > currentMinutes) {
                return {
                    slot: slot,
                    minutesUntil: startMinutes - currentMinutes
                };
            }
        }
        
        // 如果今天没有下一个活动，返回明天的第一个
        var tomorrow = new Date(date);
        tomorrow.setDate(tomorrow.getDate() + 1);
        var tomorrowSlots = this.getSlotsForDate(tomorrow);
        if (tomorrowSlots.length > 0) {
            var sortedTomorrow = tomorrowSlots.slice().sort(function(a, b) {
                return this.parseTime(a.start) - this.parseTime(b.start);
            }.bind(this));
            return {
                slot: sortedTomorrow[0],
                minutesUntil: (24 * 60 - currentMinutes) + this.parseTime(sortedTomorrow[0].start),
                isTomorrow: true
            };
        }
        
        return null;
    };
    
    /* 【添加时间段】 */
    Schedule.prototype.addSlot = function(dayKey, slot) {
        if (!slot.start || !slot.end || !slot.activity) {
            console.warn('[Schedule] 时间段缺少必要字段');
            return false;
        }
        
        var newSlot = {
            id: 'slot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            start: slot.start,
            end: slot.end,
            activity: slot.activity,
            icon: slot.icon || '📌',
            description: slot.description || '',
            category: slot.category || 'other'
        };
        
        if (dayKey === 'default') {
            this.defaultSlots.push(newSlot);
        } else if (dayKey.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // 特殊日期
            if (!this.specialDates[dayKey]) {
                this.specialDates[dayKey] = [];
            }
            this.specialDates[dayKey].push(newSlot);
        } else {
            // 周几
            if (!this.weeklySchedule[dayKey]) {
                this.weeklySchedule[dayKey] = [];
            }
            this.weeklySchedule[dayKey].push(newSlot);
        }
        
        this.updatedAt = Date.now();
        return newSlot;
    };
    
    /* 【删除时间段】 */
    Schedule.prototype.removeSlot = function(dayKey, slotId) {
        var slots;
        if (dayKey === 'default') {
            slots = this.defaultSlots;
        } else if (dayKey.match(/^\d{4}-\d{2}-\d{2}$/)) {
            slots = this.specialDates[dayKey];
        } else {
            slots = this.weeklySchedule[dayKey];
        }
        
        if (!slots) return false;
        
        var index = slots.findIndex(function(s) { return s.id === slotId; });
        if (index !== -1) {
            slots.splice(index, 1);
            this.updatedAt = Date.now();
            return true;
        }
        return false;
    };
    
    /* 【更新时间段】 */
    Schedule.prototype.updateSlot = function(dayKey, slotId, updates) {
        var slots;
        if (dayKey === 'default') {
            slots = this.defaultSlots;
        } else if (dayKey.match(/^\d{4}-\d{2}-\d{2}$/)) {
            slots = this.specialDates[dayKey];
        } else {
            slots = this.weeklySchedule[dayKey];
        }
        
        if (!slots) return false;
        
        var slot = slots.find(function(s) { return s.id === slotId; });
        if (slot) {
            Object.assign(slot, updates);
            this.updatedAt = Date.now();
            return true;
        }
        return false;
    };
    
    /* 【复制到其他天】 */
    Schedule.prototype.copyToDay = function(fromDay, toDay) {
        var fromSlots = fromDay === 'default' ? this.defaultSlots : this.weeklySchedule[fromDay];
        if (!fromSlots) return false;
        
        var copiedSlots = fromSlots.map(function(slot) {
            return Object.assign({}, slot, {
                id: 'slot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)
            });
        });
        
        if (toDay === 'default') {
            this.defaultSlots = copiedSlots;
        } else {
            this.weeklySchedule[toDay] = copiedSlots;
        }
        
        this.updatedAt = Date.now();
        return true;
    };
    
    /* 【绑定到实体】 */
    Schedule.prototype.bindTo = function(type, entityId) {
        if (!this.bindings[type]) {
            this.bindings[type] = [];
        }
        if (!this.bindings[type].includes(entityId)) {
            this.bindings[type].push(entityId);
            this.updatedAt = Date.now();
        }
    };
    
    /* 【解除绑定】 */
    Schedule.prototype.unbindFrom = function(type, entityId) {
        if (this.bindings[type]) {
            this.bindings[type] = this.bindings[type].filter(function(id) {
                return id !== entityId;
            });
            this.updatedAt = Date.now();
        }
    };
    
    /* 【辅助函数：解析时间字符串为分钟数】 */
    Schedule.prototype.parseTime = function(timeStr) {
        var parts = timeStr.split(':');
        return parseInt(parts[0]) * 60 + parseInt(parts[1] || 0);
    };
    
    /* 【辅助函数：格式化日期】 */
    Schedule.prototype.formatDate = function(date) {
        var y = date.getFullYear();
        var m = String(date.getMonth() + 1).padStart(2, '0');
        var d = String(date.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + d;
    };
    
    /* 【获取今日概览】用于小组件显示 */
    Schedule.prototype.getTodayOverview = function() {
        var now = new Date();
        var slots = this.getSlotsForDate(now);
        var current = this.getCurrentActivity(now);
        var next = this.getNextActivity(now);
        
        return {
            date: this.formatDate(now),
            weekday: WEEKDAYS[now.getDay()],
            totalSlots: slots.length,
            slots: slots,
            current: current,
            next: next
        };
    };
    
    /* 【获取周概览】 */
    Schedule.prototype.getWeekOverview = function() {
        var self = this;
        var overview = {};
        
        WEEKDAY_KEYS.forEach(function(key, index) {
            var slots = self.weeklySchedule[key] || [];
            overview[key] = {
                name: WEEKDAYS[index],
                slots: slots,
                totalHours: self.calculateTotalHours(slots)
            };
        });
        
        return overview;
    };
    
    /* 【计算总时长】 */
    Schedule.prototype.calculateTotalHours = function(slots) {
        var totalMinutes = 0;
        var self = this;
        
        slots.forEach(function(slot) {
            var start = self.parseTime(slot.start);
            var end = self.parseTime(slot.end);
            if (end < start) {
                totalMinutes += (24 * 60 - start) + end;
            } else {
                totalMinutes += end - start;
            }
        });
        
        return Math.round(totalMinutes / 60 * 10) / 10;
    };
    
    Schedule.prototype.toJSON = function() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            color: this.color,
            icon: this.icon,
            weeklySchedule: this.weeklySchedule,
            specialDates: this.specialDates,
            defaultSlots: this.defaultSlots,
            bindings: this.bindings,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    };
    
    /* 【活动类别预设】方便用户快速选择 */
    Schedule.ACTIVITY_CATEGORIES = {
        work: { name: '工作', icon: '💼', color: '#007AFF' },
        study: { name: '学习', icon: '📚', color: '#5856D6' },
        class: { name: '上课', icon: '🎓', color: '#AF52DE' },
        meeting: { name: '会议', icon: '👥', color: '#FF9500' },
        rest: { name: '休息', icon: '☕', color: '#34C759' },
        meal: { name: '用餐', icon: '🍽️', color: '#FF6B8A' },
        exercise: { name: '运动', icon: '🏃', color: '#00C7BE' },
        commute: { name: '通勤', icon: '🚇', color: '#8E8E93' },
        sleep: { name: '睡眠', icon: '😴', color: '#5E5CE6' },
        entertainment: { name: '娱乐', icon: '🎮', color: '#FF2D55' },
        social: { name: '社交', icon: '💬', color: '#FF8FAB' },
        other: { name: '其他', icon: '📌', color: '#C7C7CC' }
    };
    
    /* 【时间表小组件渲染器】用于桌面小组件显示
       提供三种尺寸：small(2x1)、medium(2x2)、large(4x2) */
    var ScheduleWidgetRenderer = {
        /* 【获取活动类别颜色】 */
        getCategoryColor: function(category) {
            var cat = Schedule.ACTIVITY_CATEGORIES[category];
            return cat ? cat.color : '#C7C7CC';
        },
        
        /* 【格式化剩余时间】 */
        formatTimeRemaining: function(minutes) {
            if (minutes < 60) {
                return minutes + '分钟';
            }
            var hours = Math.floor(minutes / 60);
            var mins = minutes % 60;
            return hours + '小时' + (mins > 0 ? mins + '分' : '');
        },
        
        /* 【小尺寸小组件】2x1 - 显示当前活动 */
        renderSmall: function(scheduleId) {
            var schedule = PhoneCore.getSchedule(scheduleId);
            var html = '<div style="height:100%;padding:10px 14px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);display:flex;align-items:center;gap:10px;">';
            
            if (!schedule) {
                html += '<div style="color:rgba(255,255,255,0.8);font-size:12px;">未绑定时间表</div>';
            } else {
                var current = schedule.getCurrentActivity();
                if (current) {
                    html += '<span style="font-size:24px;">' + current.icon + '</span>';
                    html += '<div style="flex:1;min-width:0;">';
                    html += '<div style="font-size:13px;font-weight:600;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + current.activity + '</div>';
                    html += '<div style="font-size:11px;color:rgba(255,255,255,0.8);">' + current.start + '-' + current.end + '</div>';
                    html += '</div>';
                } else {
                    html += '<span style="font-size:24px;">☕</span>';
                    html += '<div style="flex:1;min-width:0;">';
                    html += '<div style="font-size:13px;font-weight:600;color:white;">空闲时间</div>';
                    var next = schedule.getNextActivity();
                    if (next && next.slot) {
                        html += '<div style="font-size:11px;color:rgba(255,255,255,0.8);">' + next.slot.start + ' ' + next.slot.activity + '</div>';
                    }
                    html += '</div>';
                }
            }
            
            html += '</div>';
            return html;
        },
        
        /* 【中尺寸小组件】2x2 - 显示今日概览 */
        renderMedium: function(scheduleId) {
            var schedule = PhoneCore.getSchedule(scheduleId);
            var html = '<div style="height:100%;padding:14px;background:linear-gradient(145deg,#FFF5F7 0%,#FFFFFF 100%);display:flex;flex-direction:column;">';
            
            if (!schedule) {
                html += '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#999;font-size:13px;">未绑定时间表</div>';
                html += '</div>';
                return html;
            }
            
            var overview = schedule.getTodayOverview();
            var now = new Date();
            
            // 头部
            html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
            html += '<div style="font-size:12px;color:#888;">' + overview.weekday + '</div>';
            html += '<div style="font-size:11px;color:#FF8FAB;font-weight:600;">' + schedule.name + '</div>';
            html += '</div>';
            
            // 当前活动
            var current = overview.current;
            if (current) {
                var catColor = this.getCategoryColor(current.category);
                html += '<div style="background:' + catColor + '20;border-left:3px solid ' + catColor + ';padding:10px 12px;border-radius:0 10px 10px 0;margin-bottom:10px;">';
                html += '<div style="display:flex;align-items:center;gap:8px;">';
                html += '<span style="font-size:20px;">' + current.icon + '</span>';
                html += '<div style="flex:1;">';
                html += '<div style="font-size:14px;font-weight:600;color:#333;">' + current.activity + '</div>';
                html += '<div style="font-size:11px;color:#888;">' + current.start + ' - ' + current.end + '</div>';
                html += '</div>';
                html += '</div>';
                html += '</div>';
            } else {
                html += '<div style="background:#F0F0F0;padding:10px 12px;border-radius:10px;margin-bottom:10px;text-align:center;">';
                html += '<span style="font-size:16px;">☕</span> <span style="font-size:13px;color:#666;">当前空闲</span>';
                html += '</div>';
            }
            
            // 下一个活动
            var next = overview.next;
            if (next && next.slot) {
                html += '<div style="font-size:11px;color:#888;display:flex;align-items:center;gap:6px;">';
                html += '<span>⏭️</span>';
                html += '<span>' + (next.isTomorrow ? '明天 ' : '') + next.slot.start + ' ' + next.slot.activity + '</span>';
                html += '</div>';
            }
            
            html += '</div>';
            return html;
        },
        
        /* 【大尺寸小组件】4x2 - 显示今日完整时间表 */
        renderLarge: function(scheduleId) {
            var self = this;
            var schedule = PhoneCore.getSchedule(scheduleId);
            var html = '<div style="height:100%;padding:16px;background:linear-gradient(145deg,#FFF5F7 0%,#FFFFFF 100%);display:flex;flex-direction:column;">';
            
            if (!schedule) {
                html += '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#999;font-size:13px;">未绑定时间表</div>';
                html += '</div>';
                return html;
            }
            
            var overview = schedule.getTodayOverview();
            var now = new Date();
            var currentMinutes = now.getHours() * 60 + now.getMinutes();
            
            // 头部
            html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">';
            html += '<div>';
            html += '<div style="font-size:16px;font-weight:700;color:#333;">' + schedule.name + '</div>';
            html += '<div style="font-size:11px;color:#888;margin-top:2px;">' + overview.weekday + ' · ' + overview.totalSlots + '个安排</div>';
            html += '</div>';
            if (overview.current) {
                html += '<div style="background:#FF8FAB;color:white;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:500;">进行中</div>';
            }
            html += '</div>';
            
            // 时间轴
            html += '<div style="flex:1;overflow-y:auto;overflow-x:hidden;">';
            
            if (overview.slots.length === 0) {
                html += '<div style="text-align:center;padding:20px;color:#999;font-size:13px;">今日无安排</div>';
            } else {
                overview.slots.forEach(function(slot) {
                    var catColor = self.getCategoryColor(slot.category);
                    var slotStart = schedule.parseTime(slot.start);
                    var slotEnd = schedule.parseTime(slot.end);
                    var isPast = slotEnd < currentMinutes;
                    var isCurrent = currentMinutes >= slotStart && currentMinutes < slotEnd;
                    
                    var opacity = isPast ? '0.5' : '1';
                    var bgColor = isCurrent ? catColor + '25' : 'transparent';
                    var borderColor = isCurrent ? catColor : 'transparent';
                    
                    html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;margin-bottom:4px;opacity:' + opacity + ';background:' + bgColor + ';border-left:3px solid ' + borderColor + ';border-radius:0 8px 8px 0;transition:all 0.2s;">';
                    html += '<div style="font-size:11px;color:#888;width:70px;flex-shrink:0;">' + slot.start + '-' + slot.end + '</div>';
                    html += '<span style="font-size:16px;">' + slot.icon + '</span>';
                    html += '<div style="flex:1;font-size:13px;font-weight:500;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + slot.activity + '</div>';
                    if (isCurrent) {
                        html += '<div style="width:8px;height:8px;background:' + catColor + ';border-radius:50%;animation:pulse 1.5s infinite;"></div>';
                    }
                    html += '</div>';
                });
            }
            
            html += '</div>';
            html += '</div>';
            
            return html;
        }
    };

    // ============ 15. 用户数据系统 ============
    function UserProfile(config) {
        this.id = config.id || 'user_' + Date.now();
        this.realInfo = config.realInfo || {
            city: '',
            workSchedule: null,      // 兼容旧版简单时间字符串
            scheduleId: null,        // 新版：绑定的时间表ID
            timezone: 8
        };
        
        this.currentMaskId = config.currentMaskId || null;
        this.masks = config.masks || {};
        
        this.avatar = config.avatar || '';
        this.createdAt = config.createdAt || Date.now();
        this.updatedAt = Date.now();
        
        // 用户扩展属性
        this.name = config.name || '';
        this.patSetting = config.patSetting || '';  // 拍一拍后缀
        this.chatRecordMode = config.chatRecordMode || 'realtime';  // 聊天记录模式
        this.chatDateConfig = config.chatDateConfig || null;  // 聊天日期配置
        this.groupMemorySync = config.groupMemorySync || null;  // 群聊记忆互通设置
    }

    UserProfile.prototype.setRealInfo = function(info) {
        Object.assign(this.realInfo, info);
        this.updatedAt = Date.now();
    };
    
    /* 【绑定时间表到真实身份】 */
    UserProfile.prototype.bindSchedule = function(scheduleId) {
        this.realInfo.scheduleId = scheduleId;
        this.updatedAt = Date.now();
        EventBus.emit('user:schedule:bound', { type: 'user', scheduleId: scheduleId });
    };
    
    /* 【解绑时间表】 */
    UserProfile.prototype.unbindSchedule = function() {
        var oldScheduleId = this.realInfo.scheduleId;
        this.realInfo.scheduleId = null;
        this.updatedAt = Date.now();
        EventBus.emit('user:schedule:unbound', { type: 'user', scheduleId: oldScheduleId });
    };
    
    /* 【获取当前活动（真实身份）】 */
    UserProfile.prototype.getCurrentActivity = function() {
        if (!this.realInfo.scheduleId) return null;
        var schedule = PhoneCore.getSchedule(this.realInfo.scheduleId);
        if (!schedule) return null;
        return schedule.getCurrentActivity();
    };

    UserProfile.prototype.createMask = function(maskConfig) {
        var mask = {
            id: 'mask_' + Date.now(),
            name: maskConfig.name || '未命名身份',
            worldId: maskConfig.worldId || null,
            scheduleId: maskConfig.scheduleId || null,  // 绑定的时间表ID
            avatar: maskConfig.avatar || '',
            theme: maskConfig.theme || 'default',
            wallpaper: maskConfig.wallpaper || '',
            desktopLayout: maskConfig.desktopLayout || [],
            balance: maskConfig.balance || 0,
            balanceLocked: false,
            networkIds: maskConfig.networkIds || {},
            createdAt: Date.now(),
            
            /* 【人设信息 - 发送给AI】 */
            persona: maskConfig.persona || {
                nickname: '',                // 昵称/称呼
                gender: '',                  // 性别
                age: '',                     // 年龄
                birthday: '',                // 生日
                occupation: '',              // 职业
                school: '',                  // 学校（如果是学生）
                hobbies: '',                 // 爱好
                personality: '',             // 性格描述
                relationship: '',            // 与AI的关系设定
                backstory: '',               // 背景故事
                customInfo: ''               // 自定义信息
            },
            
            /* 【城市与天气】 */
            city: maskConfig.city || '',              // 绑定城市
            timezone: maskConfig.timezone || 8,       // 时区
            
            /* 【扩展财产系统】 */
            wealthClass: maskConfig.wealthClass || 'normal',  // 财富阶级
            bankCards: maskConfig.bankCards || [],            // 银行卡列表
            
            /* 【工资系统】 */
            salary: maskConfig.salary || {
                amount: 0,
                payday: 1,
                payTime: '10:00',
                lastPayDate: null,
                source: ''               // 工资来源（公司名等）
            },
            
            /* 【收支记录】 */
            transactions: []             // [{id, type, amount, reason, timestamp}]
        };
        
        this.masks[mask.id] = mask;
        this.updatedAt = Date.now();
        return mask;
    };
    
    /* 【获取面具人设信息供AI使用】 */
    UserProfile.prototype.getMaskPersonaForAI = function(maskId) {
        var mask = this.masks[maskId];
        if (!mask) return '';
        
        var persona = mask.persona || {};
        var lines = [];
        
        if (persona.nickname) lines.push('称呼：' + persona.nickname);
        if (persona.gender) lines.push('性别：' + persona.gender);
        if (persona.age) lines.push('年龄：' + persona.age);
        if (persona.birthday) lines.push('生日：' + persona.birthday);
        if (persona.occupation) lines.push('职业：' + persona.occupation);
        if (persona.school) lines.push('学校：' + persona.school);
        if (persona.hobbies) lines.push('爱好：' + persona.hobbies);
        if (persona.personality) lines.push('性格：' + persona.personality);
        if (persona.relationship) lines.push('与你的关系：' + persona.relationship);
        if (persona.backstory) lines.push('背景：' + persona.backstory);
        if (persona.customInfo) lines.push(persona.customInfo);
        
        return lines.length > 0 ? lines.join('\n') : '';
    };
    
    /* 【获取面具的财富阶级】 */
    UserProfile.prototype.getMaskWealthClass = function(maskId) {
        var mask = this.masks[maskId];
        if (!mask) return 'normal';
        if (mask.wealthClass === 'infinite') return 'infinite';
        if (mask.balance >= 10000000) return 'wealthy';
        if (mask.balance >= 1000000) return 'rich';
        if (mask.balance >= 100000) return 'normal';
        return 'poor';
    };
    
    /* 【获取银行卡渐变色】根据阶级 */
    UserProfile.prototype.getMaskBankCardGradient = function(maskId) {
        var wealthClass = this.getMaskWealthClass(maskId);
        var gradients = {
            infinite: 'linear-gradient(135deg, #FFD700, #FFA500, #FF6347)',
            wealthy: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)',
            rich: 'linear-gradient(135deg, #2D2D3A, #1A1A2E)',
            normal: 'linear-gradient(135deg, #4A4A5A, #3A3A4A)',
            poor: 'linear-gradient(135deg, #6A6A7A, #5A5A6A)'
        };
        return gradients[wealthClass] || gradients.normal;
    };
    
    /* 【检查面具是否需要发工资】 */
    UserProfile.prototype.checkMaskPayday = function(maskId) {
        var mask = this.masks[maskId];
        if (!mask || !mask.salary || mask.salary.amount <= 0) return false;
        if (mask.wealthClass === 'infinite') return false;
        
        var now = new Date();
        var today = now.getDate();
        var currentMonth = now.getFullYear() + '-' + (now.getMonth() + 1);
        
        if (today === mask.salary.payday && mask.salary.lastPayDate !== currentMonth) {
            return true;
        }
        return false;
    };
    
    /* 【发放面具工资】 */
    UserProfile.prototype.payMaskSalary = function(maskId) {
        var mask = this.masks[maskId];
        if (!mask || !this.checkMaskPayday(maskId)) return false;
        if (mask.wealthClass === 'infinite') return false;
        
        var now = new Date();
        var currentMonth = now.getFullYear() + '-' + (now.getMonth() + 1);
        
        mask.balance += mask.salary.amount;
        mask.salary.lastPayDate = currentMonth;
        
        // 记录交易
        mask.transactions = mask.transactions || [];
        mask.transactions.push({
            id: 'tx_' + Date.now(),
            type: 'income',
            amount: mask.salary.amount,
            reason: '工资 - ' + (mask.salary.source || '未知来源'),
            timestamp: Date.now()
        });
        
        this.updatedAt = Date.now();
        
        EventBus.emit('user:salary:paid', {
            maskId: maskId,
            amount: mask.salary.amount,
            newBalance: mask.balance
        });
        
        return true;
    };
    
    /* 【绑定时间表到面具身份】 */
    UserProfile.prototype.bindMaskSchedule = function(maskId, scheduleId) {
        var mask = this.masks[maskId];
        if (!mask) return false;
        mask.scheduleId = scheduleId;
        this.updatedAt = Date.now();
        EventBus.emit('user:schedule:bound', { type: 'mask', maskId: maskId, scheduleId: scheduleId });
        return true;
    };
    
    /* 【解绑面具时间表】 */
    UserProfile.prototype.unbindMaskSchedule = function(maskId) {
        var mask = this.masks[maskId];
        if (!mask) return false;
        var oldScheduleId = mask.scheduleId;
        mask.scheduleId = null;
        this.updatedAt = Date.now();
        EventBus.emit('user:schedule:unbound', { type: 'mask', maskId: maskId, scheduleId: oldScheduleId });
        return true;
    };
    
    /* 【获取面具的当前活动】 */
    UserProfile.prototype.getMaskCurrentActivity = function(maskId) {
        var mask = this.masks[maskId];
        if (!mask || !mask.scheduleId) return null;
        var schedule = PhoneCore.getSchedule(mask.scheduleId);
        if (!schedule) return null;
        return schedule.getCurrentActivity();
    };

    UserProfile.prototype.switchMask = function(maskId) {
        if (this.masks[maskId]) {
            this.currentMaskId = maskId;
            this.updatedAt = Date.now();
            EventBus.emit('user:mask:switched', { maskId: maskId, mask: this.masks[maskId] });
            return true;
        }
        return false;
    };

    UserProfile.prototype.getCurrentMask = function() {
        if (this.currentMaskId && this.masks[this.currentMaskId]) {
            return this.masks[this.currentMaskId];
        }
        return null;
    };

    UserProfile.prototype.setMaskBalance = function(maskId, amount) {
        var mask = this.masks[maskId];
        if (!mask) return false;
        
        if (mask.balanceLocked) {
            console.warn('余额已锁定，无法修改');
            return false;
        }
        
        mask.balance = amount;
        mask.balanceLocked = true;
        this.updatedAt = Date.now();
        return true;
    };

    UserProfile.prototype.modifyMaskBalance = function(maskId, delta, reason) {
        var mask = this.masks[maskId];
        if (!mask) return false;
        
        mask.balance += delta;
        this.updatedAt = Date.now();
        
        // 记录交易到 transactions 数组
        mask.transactions = mask.transactions || [];
        mask.transactions.push({
            id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            type: delta > 0 ? 'income' : 'expense',
            amount: delta,
            reason: reason || (delta > 0 ? '收入' : '支出'),
            date: Date.now(),
            timestamp: Date.now()
        });
        
        // 限制交易记录数量，保留最近100条
        if (mask.transactions.length > 100) {
            mask.transactions = mask.transactions.slice(-100);
        }
        
        EventBus.emit('user:balance:changed', {
            maskId: maskId,
            delta: delta,
            reason: reason,
            newBalance: mask.balance
        });
        
        return mask.balance;
    };

    UserProfile.prototype.deleteMask = function(maskId) {
        if (this.currentMaskId === maskId) {
            this.currentMaskId = null;
        }
        delete this.masks[maskId];
        this.updatedAt = Date.now();
    };

    UserProfile.prototype.toJSON = function() {
        return {
            id: this.id,
            realInfo: this.realInfo,
            currentMaskId: this.currentMaskId,
            masks: this.masks,
            avatar: this.avatar,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            // 用户扩展属性
            name: this.name,
            patSetting: this.patSetting,
            chatRecordMode: this.chatRecordMode,
            chatDateConfig: this.chatDateConfig,
            groupMemorySync: this.groupMemorySync
        };
    };

    // ============ 16. API管理器（增强版）============
    /* 【API管理器】
       支持三种模式：
       1. failover（故障转移）：按顺序尝试，失败则切换到下一个
       2. rotation（轮询）：按使用次数轮换
       3. weighted（权重）：按权重随机选择
       
       支持的功能：
       - 详细的tokens统计（按配置、按日期、按AI）
       - 自动错误重试
       - 速率限制
       - 健康检查 */
    
    function APIManager() {
        this.configs = {};
        this.groups = {};
        this.currentConfigIndex = {};
        this.usageCount = {};
        this.tokensRecord = {};
        this.tokensRecordDetail = {};  // {configId: {input: 0, output: 0}} 用于余额计算
        
        /* 【详细统计】 */
        this.stats = {
            byConfig: {},      // {configId: {calls, tokens, errors, lastUsed}}
            byDate: {},        // {'2026-01-13': {calls, tokens}}
            byAI: {},          // {aiId: {calls, tokens, byApp: {}}}
            total: { calls: 0, tokens: 0, errors: 0 }
        };
        
        /* 【错误追踪】 */
        this.errorHistory = {};  // {configId: [{error, timestamp}]}
        
        /* 【健康状态】 */
        this.healthStatus = {};  // {configId: {isHealthy, lastCheck, consecutiveErrors}}
    }

    APIManager.prototype.addConfig = function(config) {
        var apiConfig = {
            id: config.id || 'api_' + Date.now(),
            type: 'config',
            name: config.name || '未命名配置',
            baseUrl: config.baseUrl || '',
            apiKey: config.apiKey || '',
            model: config.model || '',
            maxTokens: config.maxTokens || 4096,
            temperature: config.temperature || 0.7,
            topP: config.topP || 1,
            frequencyPenalty: config.frequencyPenalty || 0,
            presencePenalty: config.presencePenalty || 0,
            usageLimit: config.usageLimit || 0,      // 0表示无限制
            dailyLimit: config.dailyLimit || 0,       // 每日使用限制
            rateLimit: config.rateLimit || 0,         // 每分钟请求限制
            retryCount: config.retryCount || 3,       // 重试次数
            retryDelay: config.retryDelay || 1000,    // 重试延迟（毫秒）
            timeout: config.timeout || 30000,         // 请求超时
            priority: config.priority || 0,           // 优先级（越高越优先）
            isEnabled: config.isEnabled !== false,
            createdAt: config.createdAt || Date.now(),
            updatedAt: Date.now()
        };
        
        this.configs[apiConfig.id] = apiConfig;
        this.usageCount[apiConfig.id] = 0;
        this.tokensRecord[apiConfig.id] = 0;
        this.tokensRecordDetail[apiConfig.id] = { input: 0, output: 0 };
        this.stats.byConfig[apiConfig.id] = { calls: 0, tokens: 0, errors: 0, lastUsed: null };
        this.healthStatus[apiConfig.id] = { isHealthy: true, lastCheck: null, consecutiveErrors: 0 };
        this.errorHistory[apiConfig.id] = [];
        
        return apiConfig;
    };

    APIManager.prototype.updateConfig = function(configId, updates) {
        var config = this.configs[configId];
        if (!config) return null;
        
        Object.assign(config, updates);
        config.updatedAt = Date.now();
        
        return config;
    };

    APIManager.prototype.removeConfig = function(configId) {
        delete this.configs[configId];
        delete this.usageCount[configId];
        delete this.tokensRecord[configId];
        delete this.tokensRecordDetail[configId];
        delete this.stats.byConfig[configId];
        delete this.healthStatus[configId];
        delete this.errorHistory[configId];
    };

    APIManager.prototype.createGroup = function(groupConfig) {
        var group = {
            id: groupConfig.id || 'group_' + Date.now(),
            type: 'group',
            name: groupConfig.name || '未命名组',
            configIds: groupConfig.configIds || [],
            mode: groupConfig.mode || 'failover',  // 'failover' | 'rotation' | 'weighted'
            weights: groupConfig.weights || {},     // {configId: weight}
            usageLimits: groupConfig.usageLimits || {},  // {configId: limit}
            isEnabled: groupConfig.isEnabled !== false,
            createdAt: groupConfig.createdAt || Date.now(),
            updatedAt: Date.now()
        };
        
        this.groups[group.id] = group;
        this.currentConfigIndex[group.id] = 0;
        
        return group;
    };

    APIManager.prototype.updateGroup = function(groupId, updates) {
        var group = this.groups[groupId];
        if (!group) return null;
        
        Object.assign(group, updates);
        group.updatedAt = Date.now();
        
        return group;
    };

    APIManager.prototype.deleteGroup = function(groupId) {
        delete this.groups[groupId];
        delete this.currentConfigIndex[groupId];
    };

    /* 【获取下一个可用配置】 */
    APIManager.prototype.getNextConfig = function(groupId) {
        var group = this.groups[groupId];
        if (!group || !group.isEnabled) return null;
        
        var configIds = group.configIds.filter(function(id) {
            return this.configs[id] && this.configs[id].isEnabled;
        }.bind(this));
        
        if (configIds.length === 0) return null;
        
        var self = this;
        var today = new Date().toDateString();
        
        // 过滤掉不可用的配置
        var availableConfigs = configIds.filter(function(configId) {
            var config = self.configs[configId];
            
            // 检查使用限制
            if (config.usageLimit > 0 && self.usageCount[configId] >= config.usageLimit) {
                return false;
            }
            
            // 检查组内使用限制
            var groupLimit = group.usageLimits[configId];
            if (groupLimit && self.usageCount[configId] >= groupLimit) {
                return false;
            }
            
            // 检查日限制
            if (config.dailyLimit > 0) {
                var dailyUsage = self.getDailyUsage(configId, today);
                if (dailyUsage >= config.dailyLimit) {
                    return false;
                }
            }
            
            // 检查健康状态
            var health = self.healthStatus[configId];
            if (health && !health.isHealthy && health.consecutiveErrors >= 3) {
                // 如果连续错误超过3次，暂时禁用，但每5分钟重试一次
                if (health.lastCheck && Date.now() - health.lastCheck < 300000) {
                    return false;
                }
            }
            
            return true;
        });
        
        if (availableConfigs.length === 0) return null;
        
        var selectedId;
        
        switch (group.mode) {
            case 'failover':
                // 按优先级排序后选第一个
                availableConfigs.sort(function(a, b) {
                    return (self.configs[b].priority || 0) - (self.configs[a].priority || 0);
                });
                selectedId = availableConfigs[0];
                break;
                
            case 'rotation':
                // 轮询模式
                var index = this.currentConfigIndex[groupId] % availableConfigs.length;
                selectedId = availableConfigs[index];
                this.currentConfigIndex[groupId] = (index + 1) % availableConfigs.length;
                break;
                
            case 'weighted':
                // 权重随机
                var totalWeight = 0;
                availableConfigs.forEach(function(id) {
                    totalWeight += group.weights[id] || 1;
                });
                
                var random = Math.random() * totalWeight;
                var cumulative = 0;
                
                for (var i = 0; i < availableConfigs.length; i++) {
                    cumulative += group.weights[availableConfigs[i]] || 1;
                    if (random <= cumulative) {
                        selectedId = availableConfigs[i];
                        break;
                    }
                }
                
                if (!selectedId) selectedId = availableConfigs[0];
                break;
                
            default:
                selectedId = availableConfigs[0];
        }
        
        return this.configs[selectedId];
    };

    /* 【获取每日使用量】 */
    APIManager.prototype.getDailyUsage = function(configId, dateStr) {
        var stats = this.stats.byConfig[configId];
        if (!stats || !stats.byDate) return 0;
        return stats.byDate[dateStr] || 0;
    };

    /* 【增强的API调用】 */
    APIManager.prototype.call = function(prompt, configIdOrGroupId, options) {
        var self = this;
        options = options || {};
        
        var config;
        var isGroup = configIdOrGroupId && !!this.groups[configIdOrGroupId];
        
        if (isGroup) {
            config = this.getNextConfig(configIdOrGroupId);
        } else if (configIdOrGroupId && this.configs[configIdOrGroupId]) {
            config = this.configs[configIdOrGroupId];
        } else {
            // 没有指定配置或配置不存在时，使用第一个可用的配置
            var configIds = Object.keys(this.configs);
            for (var i = 0; i < configIds.length; i++) {
                var c = this.configs[configIds[i]];
                if (c && c.isEnabled !== false) {
                    config = c;
                    break;
                }
            }
        }
        
        if (!config) {
            return Promise.reject(new Error('没有可用的API配置，请先在设置中添加API'));
        }
        
        var attemptCount = 0;
        var maxRetries = config.retryCount || 3;
        
        function attempt() {
            attemptCount++;
            
            var controller = new AbortController();
            var timeoutId = setTimeout(function() {
                controller.abort();
            }, options.timeout || config.timeout || 30000);
            
            // 构建请求体
            var messages = [];
            
            // 【关键】将prompt作为system消息添加到消息列表开头
            // 确保prompt是字符串类型后再调用trim
            if (prompt && typeof prompt === 'string' && prompt.trim()) {
                messages.push({ role: 'system', content: prompt });
            }
            
            // 添加用户提供的消息历史
            if (options.messages && options.messages.length > 0) {
                messages = messages.concat(options.messages);
            } else if (!prompt) {
                // 如果既没有prompt也没有messages，添加默认消息
                messages.push({ role: 'user', content: '你好' });
            }
            
            var requestBody = {
                model: options.model || config.model || 'gpt-3.5-turbo',
                messages: messages
            };
            
            // 只有明确设置的参数才添加
            var maxTokens = options.maxTokens || config.maxTokens;
            if (maxTokens && maxTokens > 0) {
                requestBody.max_tokens = maxTokens;
            }
            
            var temperature = options.temperature !== undefined ? options.temperature : config.temperature;
            if (temperature !== undefined && temperature !== null) {
                requestBody.temperature = temperature;
            }
            
            // 可选参数
            if (config.topP && config.topP !== 1) requestBody.top_p = config.topP;
            if (config.frequencyPenalty) requestBody.frequency_penalty = config.frequencyPenalty;
            if (config.presencePenalty) requestBody.presence_penalty = config.presencePenalty;
            
            console.log('API请求体:', JSON.stringify(requestBody, null, 2));
            
            return fetch(config.baseUrl + '/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + config.apiKey
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            })
            .then(function(response) {
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    return response.text().then(function(text) {
                        console.error('API错误响应:', text);
                        var errorMsg = 'API请求失败: ' + response.status;
                        try {
                            var errorData = JSON.parse(text);
                            if (errorData.error && errorData.error.message) {
                                errorMsg = errorData.error.message;
                            }
                        } catch (e) {}
                        throw new Error(errorMsg);
                    });
                }
                return response.json();
            })
            .then(function(data) {
                console.log('[API调试] 原始响应数据:', JSON.stringify(data, null, 2));
                
                // 记录成功 - 支持 OpenAI/DeepSeek/Claude 的 usage 和 Gemini 的 usageMetadata
                self.recordSuccess(config.id, data.usage || data.usageMetadata, options);
                
                // 提取回复内容 - 支持多种API格式
                var content = null;
                
                // OpenAI 格式: data.choices[0].message.content
                if (data.choices && data.choices[0] && data.choices[0].message) {
                    content = data.choices[0].message.content;
                }
                // Gemini 原生格式: data.candidates[0].content.parts[0].text
                else if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                    var parts = data.candidates[0].content.parts;
                    if (parts && parts[0]) {
                        content = parts[0].text;
                    }
                }
                // 其他可能的格式
                else if (data.content) {
                    content = data.content;
                }
                else if (data.text) {
                    content = data.text;
                }
                else if (data.response) {
                    content = data.response;
                }
                
                console.log('[API调试] 解析出的content:', content);
                
                if (content !== null && content !== undefined) {
                    return {
                        content: content,
                        tokens: data.usage ? data.usage.total_tokens : (data.usageMetadata ? data.usageMetadata.totalTokenCount : 0),
                        promptTokens: data.usage ? data.usage.prompt_tokens : (data.usageMetadata ? data.usageMetadata.promptTokenCount : 0),
                        completionTokens: data.usage ? data.usage.completion_tokens : (data.usageMetadata ? data.usageMetadata.candidatesTokenCount : 0),
                        configId: config.id,
                        model: data.model || data.modelVersion
                    };
                }
                
                console.error('[API调试] 无法解析响应格式，完整数据:', data);
                throw new Error('API返回格式错误');
            })
            .catch(function(error) {
                clearTimeout(timeoutId);
                
                // 记录错误
                self.recordError(config.id, error);
                
                // 重试逻辑
                if (attemptCount < maxRetries) {
                    return new Promise(function(resolve) {
                        setTimeout(resolve, config.retryDelay || 1000);
                    }).then(attempt);
                }
                
                // 如果是组模式，尝试下一个配置
                if (isGroup) {
                    self.currentConfigIndex[configIdOrGroupId]++;
                    var nextConfig = self.getNextConfig(configIdOrGroupId);
                    if (nextConfig && nextConfig.id !== config.id) {
                        config = nextConfig;
                        attemptCount = 0;
                        return attempt();
                    }
                }
                
                throw error;
            });
        }
        
        return attempt();
    };

    /* 【流式API调用】 支持SSE流式传输，实时返回生成内容 */
    APIManager.prototype.streamCall = function(prompt, configIdOrGroupId, options) {
        var self = this;
        options = options || {};
        
        var config;
        var isGroup = configIdOrGroupId && !!this.groups[configIdOrGroupId];
        
        if (isGroup) {
            config = this.getNextConfig(configIdOrGroupId);
        } else if (configIdOrGroupId && this.configs[configIdOrGroupId]) {
            config = this.configs[configIdOrGroupId];
        } else {
            var configIds = Object.keys(this.configs);
            for (var i = 0; i < configIds.length; i++) {
                var c = this.configs[configIds[i]];
                if (c && c.isEnabled !== false) {
                    config = c;
                    break;
                }
            }
        }
        
        if (!config) {
            if (options.onError) options.onError(new Error('没有可用的API配置'));
            return { abort: function() {} };
        }
        
        // 构建请求体
        var messages = [];
        if (prompt && typeof prompt === 'string' && prompt.trim()) {
            messages.push({ role: 'system', content: prompt });
        }
        if (options.messages && options.messages.length > 0) {
            messages = messages.concat(options.messages);
        } else if (!prompt) {
            messages.push({ role: 'user', content: '你好' });
        }
        
        var requestBody = {
            model: options.model || config.model || 'gpt-3.5-turbo',
            messages: messages,
            stream: true  // 启用流式
        };
        
        var maxTokens = options.maxTokens || config.maxTokens;
        if (maxTokens && maxTokens > 0) {
            requestBody.max_tokens = maxTokens;
        }
        
        var temperature = options.temperature !== undefined ? options.temperature : config.temperature;
        if (temperature !== undefined && temperature !== null) {
            requestBody.temperature = temperature;
        }
        
        if (config.topP && config.topP !== 1) requestBody.top_p = config.topP;
        if (config.frequencyPenalty) requestBody.frequency_penalty = config.frequencyPenalty;
        if (config.presencePenalty) requestBody.presence_penalty = config.presencePenalty;
        
        var abortController = new AbortController();
        var isAborted = false;
        var fullContent = '';
        var totalTokens = 0;
        var inputTokens = 0;
        var outputTokens = 0;
        var timeoutId = null;
        var lastChunkTime = Date.now();
        
        // 构建API URL - 与非流式调用保持一致
        var baseUrl = (config.baseUrl || '').replace(/\/+$/, '');
        var apiUrl = baseUrl + '/v1/chat/completions';
        
        console.log('[流式API] 开始请求:', apiUrl, '模型:', requestBody.model);
        
        // 设置超时处理（默认180秒，但如果持续收到数据则重置）
        var streamTimeout = options.timeout || 180000;
        var chunkTimeout = 60000;  // 单个 chunk 超时 60 秒
        
        function resetChunkTimeout() {
            lastChunkTime = Date.now();
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(function() {
                if (!isAborted && Date.now() - lastChunkTime >= chunkTimeout) {
                    console.warn('[流式API] 超时：长时间未收到数据');
                    isAborted = true;
                    abortController.abort();
                    // 如果已有部分内容，触发完成回调
                    if (fullContent.length > 0 && options.onComplete) {
                        options.onComplete({
                            content: fullContent,
                            tokens: totalTokens || Math.ceil(fullContent.length * 1.5),
                            configId: config.id,
                            partial: true
                        });
                    } else if (options.onError) {
                        options.onError(new Error('流式响应超时'));
                    }
                }
            }, chunkTimeout);
        }
        
        // 启动初始超时
        resetChunkTimeout();
        
        fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + config.apiKey
            },
            body: JSON.stringify(requestBody),
            signal: abortController.signal
        })
        .then(function(response) {
            if (!response.ok) {
                return response.text().then(function(text) {
                    var errorMsg = 'API请求失败: ' + response.status;
                    try {
                        var errorData = JSON.parse(text);
                        if (errorData.error && errorData.error.message) {
                            errorMsg = errorData.error.message;
                        }
                    } catch (e) {
                        errorMsg += ' - ' + text.substring(0, 200);
                    }
                    throw new Error(errorMsg);
                });
            }
            
            // 检查响应是否支持流式
            var contentType = response.headers.get('content-type') || '';
            if (!response.body) {
                throw new Error('浏览器不支持流式响应');
            }
            
            var reader = response.body.getReader();
            var decoder = new TextDecoder();
            var buffer = '';
            
            function processStream() {
                return reader.read().then(function(result) {
                    if (result.done || isAborted) {
                        // 流结束，清理超时
                        if (timeoutId) clearTimeout(timeoutId);
                        
                        console.log('[流式API] 流结束，总内容长度:', fullContent.length);
                        // 如果没有获取到token信息，使用估算值
                        var estimatedTokens = totalTokens || Math.ceil(fullContent.length * 1.5);
                        self.recordSuccess(config.id, { 
                            total_tokens: estimatedTokens,
                            prompt_tokens: inputTokens,
                            completion_tokens: outputTokens || (estimatedTokens - inputTokens)
                        }, options);
                        if (options.onComplete) {
                            options.onComplete({
                                content: fullContent,
                                tokens: totalTokens || Math.ceil(fullContent.length * 1.5),
                                configId: config.id
                            });
                        }
                        return;
                    }
                    
                    // 收到数据，重置超时
                    resetChunkTimeout();
                    
                    buffer += decoder.decode(result.value, { stream: true });
                    var lines = buffer.split('\n');
                    buffer = lines.pop() || '';  // 保留不完整的行
                    
                    lines.forEach(function(line) {
                        line = line.trim();
                        if (!line) return;
                        
                        // 处理 SSE 结束标记
                        if (line === 'data: [DONE]' || line === '[DONE]') return;
                        
                        // 提取 data: 前缀后的内容
                        var jsonStr = line;
                        if (line.startsWith('data:')) {
                            jsonStr = line.substring(5).trim();
                        }
                        
                        if (!jsonStr || jsonStr === '[DONE]') return;
                        
                        try {
                            var data = JSON.parse(jsonStr);
                            var chunkContent = null;
                            
                            // OpenAI / 兼容格式: data.choices[0].delta.content
                            if (data.choices && data.choices[0]) {
                                var choice = data.choices[0];
                                if (choice.delta && choice.delta.content) {
                                    chunkContent = choice.delta.content;
                                } else if (choice.text) {
                                    // 某些 API 使用 text 字段
                                    chunkContent = choice.text;
                                } else if (choice.message && choice.message.content) {
                                    // 非流式格式但作为流式返回
                                    chunkContent = choice.message.content;
                                }
                            }
                            // Gemini 流式格式: candidates[0].content.parts[0].text
                            else if (data.candidates && data.candidates[0]) {
                                var candidate = data.candidates[0];
                                if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
                                    chunkContent = candidate.content.parts[0].text;
                                }
                            }
                            // Claude 流式格式: content_block_delta
                            else if (data.type === 'content_block_delta' && data.delta && data.delta.text) {
                                chunkContent = data.delta.text;
                            }
                            // 直接返回 content 或 text
                            else if (data.content) {
                                chunkContent = data.content;
                            }
                            else if (data.text) {
                                chunkContent = data.text;
                            }
                            else if (data.response) {
                                chunkContent = data.response;
                            }
                            
                            if (chunkContent) {
                                fullContent += chunkContent;
                                if (options.onChunk) {
                                    options.onChunk(chunkContent, fullContent);
                                }
                            }
                            
                            // 获取 token 使用量（如果有）- 支持多种格式
                            if (data.usage) {
                                // OpenAI/DeepSeek 格式
                                if (data.usage.total_tokens !== undefined) {
                                    totalTokens = data.usage.total_tokens || totalTokens;
                                    inputTokens = data.usage.prompt_tokens || inputTokens;
                                    outputTokens = data.usage.completion_tokens || outputTokens;
                                }
                                // Claude 格式: input_tokens + output_tokens
                                else if (data.usage.input_tokens !== undefined || data.usage.output_tokens !== undefined) {
                                    inputTokens = data.usage.input_tokens || inputTokens;
                                    outputTokens = data.usage.output_tokens || outputTokens;
                                    totalTokens = inputTokens + outputTokens;
                                }
                            } else if (data.usageMetadata) {
                                // Gemini 原生格式
                                totalTokens = data.usageMetadata.totalTokenCount || totalTokens;
                                inputTokens = data.usageMetadata.promptTokenCount || inputTokens;
                                outputTokens = data.usageMetadata.candidatesTokenCount || outputTokens;
                            }
                        } catch (e) {
                            // 解析失败，可能是非 JSON 行，忽略
                            if (jsonStr.length > 2) {  // 忽略空内容的警告
                                console.warn('[流式API] 解析失败:', line.substring(0, 100));
                            }
                        }
                    });
                    
                    // 继续读取
                    return processStream();
                });
            }
            
            return processStream();
        })
        .catch(function(error) {
            // 清理超时
            if (timeoutId) clearTimeout(timeoutId);
            
            if (error.name === 'AbortError' || isAborted) {
                console.log('[流式API] 请求被中止');
                if (options.onAbort) options.onAbort(fullContent);
                return;
            }
            
            console.error('[流式API] 错误:', error);
            self.recordError(config.id, error);
            if (options.onError) options.onError(error);
        });
        
        // 返回控制对象
        return {
            abort: function() {
                isAborted = true;
                if (timeoutId) clearTimeout(timeoutId);
                abortController.abort();
            },
            getContent: function() {
                return fullContent;
            },
            isRunning: function() {
                return !isAborted;
            }
        };
    };

    /* 【记录成功调用】 */
    APIManager.prototype.recordSuccess = function(configId, usage, options) {
        // 支持多种API格式的usage数据
        var tokens = 0;
        var promptTokens = 0;
        var completionTokens = 0;
        
        if (usage) {
            // OpenAI/DeepSeek 格式: prompt_tokens, completion_tokens, total_tokens
            if (usage.total_tokens !== undefined) {
                tokens = usage.total_tokens || 0;
                promptTokens = usage.prompt_tokens || 0;
                completionTokens = usage.completion_tokens || 0;
            }
            // Claude (Anthropic) 格式: input_tokens, output_tokens
            else if (usage.input_tokens !== undefined || usage.output_tokens !== undefined) {
                promptTokens = usage.input_tokens || 0;
                completionTokens = usage.output_tokens || 0;
                tokens = promptTokens + completionTokens;
            }
            // Gemini 原生格式: promptTokenCount, candidatesTokenCount, totalTokenCount
            else if (usage.totalTokenCount !== undefined || usage.promptTokenCount !== undefined) {
                tokens = usage.totalTokenCount || 0;
                promptTokens = usage.promptTokenCount || 0;
                completionTokens = usage.candidatesTokenCount || 0;
            }
        }
        
        var today = new Date().toISOString().split('T')[0];
        
        this.usageCount[configId]++;
        this.tokensRecord[configId] += tokens;
        
        // 记录输入/输出 tokens 详情（用于余额估算）
        if (!this.tokensRecordDetail[configId]) {
            this.tokensRecordDetail[configId] = { input: 0, output: 0 };
        }
        this.tokensRecordDetail[configId].input += promptTokens;
        this.tokensRecordDetail[configId].output += completionTokens;
        
        // 更新配置统计
        var configStats = this.stats.byConfig[configId];
        if (configStats) {
            configStats.calls++;
            configStats.tokens += tokens;
            configStats.lastUsed = Date.now();
            if (!configStats.byDate) configStats.byDate = {};
            configStats.byDate[today] = (configStats.byDate[today] || 0) + 1;
        }
        
        // 更新日期统计
        if (!this.stats.byDate[today]) {
            this.stats.byDate[today] = { calls: 0, tokens: 0 };
        }
        this.stats.byDate[today].calls++;
        this.stats.byDate[today].tokens += tokens;
        
        // 更新AI统计
        if (options && options.aiId) {
            if (!this.stats.byAI[options.aiId]) {
                this.stats.byAI[options.aiId] = { calls: 0, tokens: 0, byApp: {} };
            }
            this.stats.byAI[options.aiId].calls++;
            this.stats.byAI[options.aiId].tokens += tokens;
            
            if (options.appId) {
                if (!this.stats.byAI[options.aiId].byApp[options.appId]) {
                    this.stats.byAI[options.aiId].byApp[options.appId] = 0;
                }
                this.stats.byAI[options.aiId].byApp[options.appId] += tokens;
            }
        }
        
        // 更新总计
        this.stats.total.calls++;
        this.stats.total.tokens += tokens;
        
        // 重置健康状态
        var health = this.healthStatus[configId];
        if (health) {
            health.isHealthy = true;
            health.consecutiveErrors = 0;
            health.lastCheck = Date.now();
        }
        
        EventBus.emit('api:success', { configId: configId, tokens: tokens });
        
        // 延时保存统计数据（防抖，避免频繁写入）
        var self = this;
        if (this._saveStatsTimer) {
            clearTimeout(this._saveStatsTimer);
        }
        this._saveStatsTimer = setTimeout(function() {
            if (PhoneCore && PhoneCore.saveAPIStats) {
                PhoneCore.saveAPIStats();
            }
        }, 2000);  // 2秒后保存
    };

    /* 【记录错误】 */
    APIManager.prototype.recordError = function(configId, error) {
        // 更新配置统计
        var configStats = this.stats.byConfig[configId];
        if (configStats) {
            configStats.errors++;
        }
        
        // 更新总计
        this.stats.total.errors++;
        
        // 记录错误历史
        if (!this.errorHistory[configId]) {
            this.errorHistory[configId] = [];
        }
        this.errorHistory[configId].push({
            message: error.message,
            timestamp: Date.now()
        });
        
        // 只保留最近50条错误记录
        if (this.errorHistory[configId].length > 50) {
            this.errorHistory[configId].shift();
        }
        
        // 更新健康状态
        var health = this.healthStatus[configId];
        if (health) {
            health.consecutiveErrors++;
            health.lastCheck = Date.now();
            if (health.consecutiveErrors >= 3) {
                health.isHealthy = false;
            }
        }
        
        EventBus.emit('api:error', { configId: configId, error: error.message });
    };

    /* 【获取统计信息】 */
    APIManager.prototype.getStats = function(configId) {
        if (configId) {
            return this.stats.byConfig[configId] || null;
        }
        return this.stats;
    };

    /* 【获取AI的tokens使用】 */
    APIManager.prototype.getAITokensUsage = function(aiId) {
        return this.stats.byAI[aiId] || { calls: 0, tokens: 0, byApp: {} };
    };

    APIManager.prototype.getTokensUsage = function(configId) {
        return this.tokensRecord[configId] || 0;
    };

    /* 【获取tokens使用详情】用于余额估算 */
    APIManager.prototype.getTokensUsageDetail = function(configId) {
        return this.tokensRecordDetail[configId] || { input: 0, output: 0 };
    };

    APIManager.prototype.getTotalTokensUsage = function() {
        return this.stats.total.tokens;
    };

    /* 【健康检查】 */
    APIManager.prototype.checkHealth = function(configId) {
        var self = this;
        var config = this.configs[configId];
        if (!config) return Promise.resolve(false);
        
        return fetch(config.baseUrl + '/v1/models', {
            headers: {
                'Authorization': 'Bearer ' + config.apiKey
            }
        })
        .then(function(response) {
            var health = self.healthStatus[configId];
            if (health) {
                health.isHealthy = response.ok;
                health.lastCheck = Date.now();
                if (response.ok) {
                    health.consecutiveErrors = 0;
                }
            }
            return response.ok;
        })
        .catch(function() {
            var health = self.healthStatus[configId];
            if (health) {
                health.isHealthy = false;
                health.lastCheck = Date.now();
            }
            return false;
        });
    };

    /* 【获取模型列表】 */
    APIManager.prototype.fetchModels = function(baseUrl, apiKey) {
        return fetch(baseUrl + '/v1/models', {
            headers: {
                'Authorization': 'Bearer ' + apiKey
            }
        })
        .then(function(response) {
            if (!response.ok) throw new Error('获取模型列表失败');
            return response.json();
        })
        .then(function(data) {
            return data.data || [];
        });
    };

    /* 【重置每日统计】 */
    APIManager.prototype.resetDailyStats = function() {
        var self = this;
        Object.keys(this.stats.byConfig).forEach(function(configId) {
            if (self.stats.byConfig[configId].byDate) {
                self.stats.byConfig[configId].byDate = {};
            }
        });
    };

    /* 【导出统计数据】 */
    APIManager.prototype.exportStats = function() {
        return {
            configs: this.configs,
            groups: this.groups,
            stats: this.stats,
            usageCount: this.usageCount,
            tokensRecord: this.tokensRecord,
            healthStatus: this.healthStatus,
            exportedAt: Date.now()
        };
    };

    // ============ 17. 离线补偿系统 ============
    function OfflineCompensator(config) {
        this.db = config.db;
        this.aiManager = config.aiManager;
        this.userProfile = config.userProfile;
    }

    OfflineCompensator.prototype.calculate = function(deltaTime) {
        var self = this;
        var results = {
            messages: [],
            notifications: [],
            transactions: [],
            events: []
        };
        
        var hours = deltaTime / (1000 * 60 * 60);
        
        if (hours < 1) {
            return Promise.resolve(results);
        }
        
        return this.db.getAll('ai_characters').then(function(ais) {
            ais.forEach(function(aiData) {
                if (aiData.type === 'main' && aiData.autoMessageEnabled) {
                    var messageCount = self.calculatePendingMessages(aiData, hours);
                    for (var i = 0; i < messageCount; i++) {
                        results.messages.push({
                            type: 'pending',
                            aiId: aiData.id,
                            aiName: aiData.name,
                            timestamp: Date.now() - Math.random() * deltaTime
                        });
                    }
                }
            });
            
            var mask = self.userProfile.getCurrentMask();
            if (mask && mask.job) {
                var paydays = self.calculatePaydays(hours);
                paydays.forEach(function(payday) {
                    results.transactions.push({
                        type: 'salary',
                        amount: payday.amount,
                        timestamp: payday.timestamp
                    });
                });
            }
            
            results.messages.sort(function(a, b) {
                return a.timestamp - b.timestamp;
            });
            
            return results;
        });
    };

    OfflineCompensator.prototype.calculatePendingMessages = function(aiData, hours) {
        var chance = aiData.autoMessageChance || 0.2;
        var intervals = Math.floor(hours * 12);
        var count = 0;
        
        for (var i = 0; i < intervals; i++) {
            if (Math.random() < chance) {
                count++;
            }
        }
        
        return Math.min(count, 10);
    };

    OfflineCompensator.prototype.calculatePaydays = function(hours) {
        var paydays = [];
        var now = Date.now();
        var deltaMs = hours * 60 * 60 * 1000;
        var startTime = now - deltaMs;
        
        var mask = this.userProfile.getCurrentMask();
        if (!mask || !mask.job) return paydays;
        
        var job = mask.job;
        var payday = job.payday || 1;
        var salary = job.salary || 0;
        
        var startDate = new Date(startTime);
        var endDate = new Date(now);
        
        var checkDate = new Date(startDate.getFullYear(), startDate.getMonth(), payday);
        
        while (checkDate <= endDate) {
            if (checkDate >= startDate) {
                paydays.push({
                    amount: salary,
                    timestamp: checkDate.getTime(),
                    description: '工资发放'
                });
            }
            checkDate.setMonth(checkDate.getMonth() + 1);
        }
        
        return paydays;
    };

    OfflineCompensator.prototype.apply = function(results) {
        var self = this;
        var promises = [];
        
        // 处理自动消息 - 调用ChatApp的自动消息生成功能
        if (results.messages.length > 0) {
            // 延迟执行，等待ChatApp初始化完成
            var autoMessagePromise = new Promise(function(resolve) {
                setTimeout(function() {
                    var chatApp = PhoneCore.getApp('chat-app');
                    if (chatApp && chatApp.processAutoMessages) {
                        // 使用新的自动消息生成系统
                        chatApp.processAutoMessages(results.messages).then(function() {
                            resolve();
                        }).catch(function(err) {
                            console.error('[离线补偿] 自动消息处理失败:', err);
                            resolve();
                        });
                    } else {
                        // 如果ChatApp未就绪，发送简单通知
                        results.messages.forEach(function(msg) {
                            PhoneCore.notifications.send({
                                type: 'message',
                                title: msg.aiName,
                                message: '发来了一条消息',
                                icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>',
                                size: 'compact',
                                appId: 'chat-app',
                                data: msg
                            });
                            PhoneCore.badges.increment('chat-app');
                        });
                        resolve();
                    }
                }, 1000); // 延迟1秒等待App初始化
            });
            promises.push(autoMessagePromise);
        }
        
        if (results.transactions.length > 0) {
            var mask = this.userProfile.getCurrentMask();
            if (mask) {
                results.transactions.forEach(function(trans) {
                    self.userProfile.modifyMaskBalance(mask.id, trans.amount, trans.description);
                    
                    PhoneCore.notifications.send({
                        type: 'transaction',
                        title: '收入通知',
                        message: trans.description + '：+' + trans.amount,
                        icon: '💰',
                        size: 'mini',
                        appId: 'system-config'
                    });
                });
            }
        }
        
        EventBus.emit('offline:compensated', results);
        
        return Promise.all(promises);
    };

    // ============ 18. 交易记录系统 ============
    function TransactionManager(db) {
        this.db = db;
    }

    TransactionManager.prototype.record = function(transaction) {
        var record = {
            id: 'trans_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            type: transaction.type,
            amount: transaction.amount,
            from: transaction.from || null,
            to: transaction.to || null,
            description: transaction.description || '',
            appId: transaction.appId || '',
            metadata: transaction.metadata || {},
            timestamp: Date.now()
        };
        
        return this.db.add('transactions', record).then(function() {
            EventBus.emit('transaction:recorded', record);
            return record;
        });
    };

    TransactionManager.prototype.getByUser = function(userId) {
        var self = this;
        return this.db.getAll('transactions').then(function(all) {
            return all.filter(function(t) {
                return t.from === userId || t.to === userId;
            });
        });
    };

    TransactionManager.prototype.getByAI = function(aiId) {
        var self = this;
        return this.db.getAll('transactions').then(function(all) {
            return all.filter(function(t) {
                return t.from === aiId || t.to === aiId;
            });
        });
    };

    TransactionManager.prototype.getByApp = function(appId) {
        var self = this;
        return this.db.getAll('transactions').then(function(all) {
            return all.filter(function(t) {
                return t.appId === appId;
            });
        });
    };

    TransactionManager.prototype.getSummary = function(userId) {
        return this.getByUser(userId).then(function(transactions) {
            var income = 0;
            var expense = 0;
            
            transactions.forEach(function(t) {
                if (t.to === userId) {
                    income += t.amount;
                } else if (t.from === userId) {
                    expense += t.amount;
                }
            });
            
            return {
                income: income,
                expense: expense,
                net: income - expense,
                count: transactions.length
            };
        });
    };

    // ============ 19. 事件触发系统 ============
    function EventTriggerSystem() {
        this.triggers = {};
        this.conditions = {};
    }

    EventTriggerSystem.prototype.register = function(triggerId, config) {
        this.triggers[triggerId] = {
            id: triggerId,
            event: config.event,
            condition: config.condition || null,
            action: config.action,
            once: config.once || false,
            enabled: config.enabled !== false
        };
        
        var self = this;
        EventBus.on(config.event, function(data) {
            self.check(triggerId, data);
        });
    };

    EventTriggerSystem.prototype.check = function(triggerId, data) {
        var trigger = this.triggers[triggerId];
        if (!trigger || !trigger.enabled) return;
        
        var conditionMet = true;
        if (trigger.condition) {
            conditionMet = trigger.condition(data);
        }
        
        if (conditionMet) {
            trigger.action(data);
            
            if (trigger.once) {
                trigger.enabled = false;
            }
        }
    };

    EventTriggerSystem.prototype.enable = function(triggerId) {
        if (this.triggers[triggerId]) {
            this.triggers[triggerId].enabled = true;
        }
    };

    EventTriggerSystem.prototype.disable = function(triggerId) {
        if (this.triggers[triggerId]) {
            this.triggers[triggerId].enabled = false;
        }
    };

    EventTriggerSystem.prototype.remove = function(triggerId) {
        delete this.triggers[triggerId];
    };

    // ============ 20. 音效与触感反馈系统 ============
    function FeedbackSystem() {
        this.sounds = {};
        this.enabled = {
            sound: true,
            haptic: true
        };
    }

    FeedbackSystem.prototype.loadSound = function(name, url) {
        var audio = new Audio(url);
        audio.preload = 'auto';
        this.sounds[name] = audio;
    };

    FeedbackSystem.prototype.playSound = function(name) {
        if (!this.enabled.sound) return;
        
        var sound = this.sounds[name];
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(function() {});
        }
    };

    FeedbackSystem.prototype.haptic = function(type) {
        if (!this.enabled.haptic) return;
        
        if ('vibrate' in navigator) {
            switch (type) {
                case 'light':
                    navigator.vibrate(10);
                    break;
                case 'medium':
                    navigator.vibrate(20);
                    break;
                case 'heavy':
                    navigator.vibrate(40);
                    break;
                case 'success':
                    navigator.vibrate([10, 50, 20]);
                    break;
                case 'error':
                    navigator.vibrate([30, 50, 30, 50, 30]);
                    break;
                default:
                    navigator.vibrate(15);
            }
        }
    };

    FeedbackSystem.prototype.toggle = function(type, enabled) {
        if (type === 'sound' || type === 'haptic') {
            this.enabled[type] = enabled;
        }
    };

    // ============ 21. App卡片堆栈管理 ============
    function AppStackManager() {
        this.stack = [];
        this.maxCards = 10;
    }

    AppStackManager.prototype.push = function(app) {
        var existingIndex = this.stack.findIndex(function(item) {
            return item.id === app.id;
        });
        
        if (existingIndex !== -1) {
            this.stack.splice(existingIndex, 1);
        }
        
        this.stack.push({
            id: app.id,
            app: app,
            timestamp: Date.now()
        });
        
        if (this.stack.length > this.maxCards) {
            var removed = this.stack.shift();
            if (removed.app.appWindow) {
                removed.app.appWindow.remove();
                removed.app.appWindow = null;
                removed.app.windowCache = false;
            }
        }
    };

    AppStackManager.prototype.remove = function(appId) {
        this.stack = this.stack.filter(function(item) {
            return item.id !== appId;
        });
    };

    AppStackManager.prototype.getAll = function() {
        return this.stack.map(function(item) {
            return item.app;
        });
    };

    AppStackManager.prototype.clear = function() {
        this.stack.forEach(function(item) {
            if (item.app.appWindow) {
                item.app.appWindow.remove();
                item.app.appWindow = null;
                item.app.windowCache = false;
            }
        });
        this.stack = [];
    };

    // ============ 21.5 桌面分页器 ============
    /* 【桌面分页器】负责多桌面页面切换
       支持左右滑动切换桌面页 */
    function DesktopPager() {
        this.container = null;
        this.pagesWrapper = null;
        this.pages = [];
        this.currentPage = 0;
        this.totalPages = 1;
        this.indicator = null;
        
        /* 【滑动状态】 */
        this.swipeState = {
            active: false,
            startX: 0,
            currentX: 0,
            startTranslate: 0,
            threshold: 50
        };
    }

    DesktopPager.prototype.init = function() {
        this.container = document.getElementById('desktop-pages-container');
        this.pagesWrapper = document.getElementById('desktop-pages');
        this.indicator = document.getElementById('page-indicator');
        
        if (!this.container || !this.pagesWrapper) {
            console.warn('[DesktopPager] 容器不存在，跳过初始化');
            return;
        }
        
        this.pages = Array.from(this.pagesWrapper.querySelectorAll('.desktop-page'));
        this.totalPages = this.pages.length;
        
        this.bindEvents();
        this.updateIndicator();
        
        console.log('[DesktopPager] 初始化完成，共' + this.totalPages + '个桌面');
    };

    DesktopPager.prototype.bindEvents = function() {
        var self = this;
        var startX = 0;
        var startY = 0;
        var isSwiping = false;
        var isHorizontal = null; /* 判断是横向还是纵向滑动 */
        
        /* 【触摸开始】 */
        this.container.addEventListener('touchstart', function(e) {
            /* 【编辑模式下禁止滑动切换】移动小组件时不允许切换屏幕 */
            var dm = PhoneCore.desktopManager;
            if (dm && dm.editMode) return;
            
            /* 【只忽略正在拖拽的小组件】 */
            if (e.target.closest('.widget.is-dragging-source')) return;
            
            var touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            self.swipeState.startX = startX;
            self.swipeState.currentX = startX;
            self.swipeState.startTranslate = -self.currentPage * 100;
            isSwiping = false;
            isHorizontal = null;
            
        }, { passive: true });
        
        /* 【触摸移动】 */
        this.container.addEventListener('touchmove', function(e) {
            /* 【编辑模式下禁止滑动切换】 */
            var dm = PhoneCore.desktopManager;
            if (dm && dm.editMode) return;
            
            var touch = e.touches[0];
            var deltaX = touch.clientX - startX;
            var deltaY = touch.clientY - startY;
            
            /* 【首次移动时判断方向】 */
            if (isHorizontal === null && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
                isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
                if (isHorizontal && self.totalPages > 1) {
                    isSwiping = true;
                    self.pagesWrapper.style.transition = 'none';
                }
            }
            
            if (!isSwiping || !isHorizontal) return;
            
            var containerWidth = self.container.offsetWidth;
            var deltaPercent = (deltaX / containerWidth) * 100;
            var newTranslate = self.swipeState.startTranslate + deltaPercent;
            
            /* 【边界阻尼】 */
            if (newTranslate > 0) {
                newTranslate = newTranslate * 0.3;
            } else if (newTranslate < -(self.totalPages - 1) * 100) {
                var overflow = newTranslate + (self.totalPages - 1) * 100;
                newTranslate = -(self.totalPages - 1) * 100 + overflow * 0.3;
            }
            
            self.pagesWrapper.style.transform = 'translateX(' + newTranslate + '%)';
            self.swipeState.currentX = touch.clientX;
        }, { passive: true });
        
        /* 【触摸结束】 */
        this.container.addEventListener('touchend', function(e) {
            if (!isSwiping) {
                isHorizontal = null;
                return;
            }
            
            var deltaX = self.swipeState.currentX - self.swipeState.startX;
            
            self.pagesWrapper.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.1, 0.25, 1)';
            
            if (Math.abs(deltaX) > self.swipeState.threshold) {
                if (deltaX < 0 && self.currentPage < self.totalPages - 1) {
                    self.goToPage(self.currentPage + 1);
                } else if (deltaX > 0 && self.currentPage > 0) {
                    self.goToPage(self.currentPage - 1);
                } else {
                    self.goToPage(self.currentPage);
                }
            } else {
                self.goToPage(self.currentPage);
            }
            
            isSwiping = false;
            isHorizontal = null;
        });
        
        /* 【鼠标支持（用于桌面端测试）】 */
        var mouseDown = false;
        var mouseStartX = 0;
        
        this.container.addEventListener('mousedown', function(e) {
            /* 【编辑模式下禁止滑动切换】 */
            var dm = PhoneCore.desktopManager;
            if (dm && dm.editMode) return;
            
            if (e.target.closest('.widget') || e.target.closest('.app-icon')) return;
            mouseDown = true;
            mouseStartX = e.clientX;
            self.swipeState.startX = mouseStartX;
            self.swipeState.currentX = mouseStartX;
            self.swipeState.startTranslate = -self.currentPage * 100;
            self.pagesWrapper.style.transition = 'none';
        });
        
        document.addEventListener('mousemove', function(e) {
            if (!mouseDown || self.totalPages <= 1) return;
            
            /* 【编辑模式下禁止滑动切换】 */
            var dm = PhoneCore.desktopManager;
            if (dm && dm.editMode) return;
            
            var deltaX = e.clientX - mouseStartX;
            if (Math.abs(deltaX) < 5) return;
            
            var containerWidth = self.container.offsetWidth;
            var deltaPercent = (deltaX / containerWidth) * 100;
            var newTranslate = self.swipeState.startTranslate + deltaPercent;
            
            if (newTranslate > 0) {
                newTranslate = newTranslate * 0.3;
            } else if (newTranslate < -(self.totalPages - 1) * 100) {
                var overflow = newTranslate + (self.totalPages - 1) * 100;
                newTranslate = -(self.totalPages - 1) * 100 + overflow * 0.3;
            }
            
            self.pagesWrapper.style.transform = 'translateX(' + newTranslate + '%)';
            self.swipeState.currentX = e.clientX;
        });
        
        document.addEventListener('mouseup', function(e) {
            if (!mouseDown) return;
            mouseDown = false;
            
            var deltaX = self.swipeState.currentX - self.swipeState.startX;
            self.pagesWrapper.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.1, 0.25, 1)';
            
            if (Math.abs(deltaX) > self.swipeState.threshold) {
                if (deltaX < 0 && self.currentPage < self.totalPages - 1) {
                    self.goToPage(self.currentPage + 1);
                } else if (deltaX > 0 && self.currentPage > 0) {
                    self.goToPage(self.currentPage - 1);
                } else {
                    self.goToPage(self.currentPage);
                }
            } else {
                self.goToPage(self.currentPage);
            }
        });
    };

    DesktopPager.prototype.goToPage = function(pageIndex) {
        if (pageIndex < 0) pageIndex = 0;
        if (pageIndex >= this.totalPages) pageIndex = this.totalPages - 1;
        
        this.currentPage = pageIndex;
        this.pagesWrapper.style.transform = 'translateX(' + (-pageIndex * 100) + '%)';
        this.updateIndicator();
    };

    DesktopPager.prototype.updateIndicator = function() {
        if (!this.indicator) return;
        
        var dots = '';
        for (var i = 0; i < this.totalPages; i++) {
            dots += '<div class="page-dot' + (i === this.currentPage ? ' active' : '') + '"></div>';
        }
        this.indicator.innerHTML = dots;
    };

    DesktopPager.prototype.addPage = function() {
        var newPage = document.createElement('div');
        newPage.className = 'desktop-page';
        newPage.setAttribute('data-page', this.totalPages);
        
        this.pagesWrapper.appendChild(newPage);
        this.pages.push(newPage);
        this.totalPages++;
        this.updateIndicator();
        
        return newPage;
    };

    // ============ 22. 桌面管理器（小组件拖拽系统）============
    /* 【桌面管理器】负责小组件的添加、删除、拖拽和布局保存
       核心功能：
       1. 长按桌面2秒进入编辑模式
       2. 编辑模式下小组件抖动，显示删除按钮
       3. 支持拖拽移动小组件位置
       4. 拖拽时显示虚影(ghost)和预览位置(preview) */
    function DesktopManager() {
        this.container = null;
        this.grid = null;
        this.widgets = [];
        this.pager = null;      /* 【桌面分页器】 */
        this.editMode = false;
        
        /* 【拖拽状态】保存拖拽过程中的所有相关数据 */
        this.dragState = {
            active: false,
            widget: null,
            ghostEl: null,
            previewEl: null,
            startClientX: 0,
            startClientY: 0,
            ghostInitX: 0,
            ghostInitY: 0,
            pointerX: 0,
            pointerY: 0,
            rafId: null,
            lastValidRow: -1,
            lastValidCol: -1
        };
    }

    DesktopManager.prototype.init = function() {
        this.container = document.getElementById('desktop');
        this.grid = new DesktopGrid({
            containerId: 'desktop',
            columns: 4,
            rows: 4  /* 【修改】4行x4列=16个位置，与app最大数量一致 */
        });
        
        /* 【初始化桌面分页器】 */
        this.pager = new DesktopPager();
        this.pager.init();
        
        this.injectStyles();
        this.bindEvents();
        
        console.log('[DesktopManager] 初始化完成');
    };

    /* 【动态注入小组件样式】
       使用JS动态注入样式的好处：
       1. 样式与功能代码放在一起，便于维护
       2. 可以在运行时动态修改
       3. 避免在HTML的style标签中硬编码 */
    DesktopManager.prototype.injectStyles = function() {
        if (document.getElementById('widget-styles')) return;
        
        var style = document.createElement('style');
        style.id = 'widget-styles';
        style.textContent = 
            /* 【全局隐藏滚动条】 */
            '.widget-picker::-webkit-scrollbar,' +
            '.widget-picker *::-webkit-scrollbar,' +
            '#desktop::-webkit-scrollbar {' +
                'display: none !important;' +
                'width: 0 !important;' +
                'height: 0 !important;' +
            '}' +
            '.widget-picker, #desktop {' +
                'scrollbar-width: none !important;' +
                '-ms-overflow-style: none !important;' +
            '}' +
            
            /* 【小组件容器样式】overflow:visible让删除按钮可见 */
            '.widget {' +
                'transition: transform 0.15s cubic-bezier(0.2, 0, 0, 1), opacity 0.15s ease-out;' +
                'user-select: none;' +
                '-webkit-user-select: none;' +
                'position: relative;' +
                'z-index: 10;' +
                'overflow: visible;' + /* 【关键】让删除按钮可溢出显示 */
                '-webkit-tap-highlight-color: transparent;' +
                'touch-action: manipulation;' +
            '}' +
            
            /* 【内容区域样式】overflow:hidden保持圆角效果 */
            '.widget-content {' +
                'width: 100%;' +
                'height: 100%;' +
                'pointer-events: none;' +
                'overflow: hidden;' +
                'border-radius: 20px;' +
                'background: rgba(255,255,255,0.9);' +
                'box-shadow: 0 4px 12px rgba(0,0,0,0.08);' +
                'position: relative;' +
                '-webkit-backface-visibility: hidden;' +
                'backface-visibility: hidden;' +
            '}' +
            
            /* 【删除按钮样式】使用负定位溢出容器边界 */
            '.widget-delete-btn {' +
                'z-index: 99999;' +
                'position: absolute;' +
                'top: -10px;' +  /* 【关键】负定位让按钮溢出到容器外 */
                'left: -10px;' +
                'width: 26px;' +
                'height: 26px;' +
                'background: rgba(142, 142, 147, 0.95);' +
                'color: #fff;' +
                'border-radius: 50%;' +
                'display: none;' + /* 默认隐藏，编辑模式下显示 */
                'align-items: center;' +
                'justify-content: center;' +
                'font-size: 18px;' +
                'line-height: 1;' +
                'cursor: pointer;' +
                'box-shadow: 0 2px 8px rgba(0,0,0,0.3);' +
                'border: 1px solid rgba(255,255,255,0.2);' +
                'pointer-events: auto;' +
            '}' +
            
            /* 【编辑模式样式】 */
            '.widget.edit-mode {' +
                'cursor: grab;' +
            '}' +
            
            '.widget.edit-mode .widget-content {' +
                'animation: widget-wiggle 0.25s ease-in-out infinite alternate;' +
                'will-change: transform;' +
            '}' +
            
            '.widget.edit-mode .widget-delete-btn {' +
                'display: flex;' +
                'animation: widget-btn-wiggle 0.25s ease-in-out infinite alternate;' +
            '}' +
            
            /* 【拖拽中原位置隐藏】只显示虚影，完全隐藏原组件 */
            '.widget.is-dragging-source {' +
                'opacity: 0 !important;' +
                'visibility: hidden !important;' +
                'pointer-events: none !important;' +
                'transform: scale(0) !important;' +
            '}' +
            
            /* 【拖拽虚影样式】使用fixed定位跟随鼠标移动，GPU加速 */
            '.widget-drag-ghost {' +
                'position: fixed;' +
                'top: 0;' +
                'left: 0;' +
                'z-index: 9999;' +
                'pointer-events: none;' +
                'opacity: 0.95;' +
                'will-change: transform;' +
                '-webkit-transform: translateZ(0);' +
                'transform: translateZ(0);' +
                'transform-origin: center center;' +
                'box-shadow: 0 15px 40px rgba(0,0,0,0.3);' +
                'border-radius: 20px;' +
                'margin: 0 !important;' + /* 【关键】消除margin导致的偏移 */
                '-webkit-backface-visibility: hidden;' +
                'backface-visibility: hidden;' +
            '}' +
            
            '.widget-drag-ghost .widget-content {' +
                'background: rgba(255,255,255,0.95);' +
                'animation: none !important;' + /* 拖拽时停止抖动 */
            '}' +
            
            '.widget-drag-ghost .widget-delete-btn {' +
                'display: none !important;' + /* 拖拽虚影隐藏删除按钮 */
            '}' +
            
            /* 【放置预览样式】显示小组件将要放置的位置 */
            '.widget-drop-preview {' +
                'position: absolute;' +
                'background: rgba(0, 122, 255, 0.15);' +
                'border-radius: 20px;' +
                'border: 2px dashed #007AFF;' +
                'box-sizing: border-box;' +
                'z-index: 5;' +
                'transition: transform 0.08s cubic-bezier(0.2, 0, 0, 1), background 0.15s, border-color 0.15s;' +
                'pointer-events: none;' +
                'box-shadow: inset 0 0 20px rgba(0, 122, 255, 0.1);' +
                'will-change: transform;' +
                '-webkit-backface-visibility: hidden;' +
                'backface-visibility: hidden;' +
            '}' +
            
            '.widget-drop-preview.error {' +
                'background: rgba(255, 59, 48, 0.15) !important;' +
                'border-color: #FF3B30 !important;' +
            '}' +
            
            /* 【抖动动画】更轻微的抖动效果 */
            '@keyframes widget-wiggle {' +
                '0% { transform: rotate(-1deg); }' +
                '100% { transform: rotate(1deg); }' +
            '}' +
            
            '@keyframes widget-btn-wiggle {' +
                '0% { transform: rotate(-0.8deg) scale(1); }' +
                '100% { transform: rotate(0.8deg) scale(1); }' +
            '}' +
            
            /* 【编辑模式提示】 */
            '.desktop-edit-hint {' +
                'position: fixed;' +
                'bottom: 100px;' +
                'left: 50%;' +
                'transform: translateX(-50%);' +
                'background: rgba(0,0,0,0.6);' +
                'backdrop-filter: blur(10px);' +
                '-webkit-backdrop-filter: blur(10px);' +
                'color: white;' +
                'padding: 8px 16px;' +
                'border-radius: 20px;' +
                'font-size: 13px;' +
                'z-index: 1000;' +
                'pointer-events: none;' +
                'transition: opacity 0.3s;' +
            '}';
        
        document.head.appendChild(style);
    };

    DesktopManager.prototype.bindEvents = function() {
        var self = this;
        var longPressTimer = null;
        var isLongPress = false;
        var justFinishedLongPress = false; /* 【新增】标记刚完成长按，防止触发点击 */
        var startX = 0, startY = 0;
        var isTouchDetected = false;
        
        var onMove = this.handleMove.bind(this);
        var onEnd = this.handleEnd.bind(this);
        
        /* 【辅助函数】检查是否点击了桌面图标区域 */
        function isAppIconClick(target) {
            return target.closest('.app-icon') || 
                   target.closest('.dock-icon') || 
                   target.closest('.app-wrapper') ||
                   target.closest('.app-icon-name') ||
                   target.tagName === 'SVG' ||
                   target.tagName === 'svg' ||
                   target.tagName === 'PATH' ||
                   target.tagName === 'path';
        }
        
        /* 【辅助函数】检查是否在桌面空白区域（排除App图标、小组件、App窗口等） */
        function isDesktopBlankArea(target) {
            // 如果点击了App图标
            if (isAppIconClick(target)) return false;
            // 如果点击了小组件
            if (target.closest('.widget')) return false;
            // 如果点击了App窗口（虽然不应该触发到这里，但以防万一）
            if (target.closest('.app-window')) return false;
            // 如果点击了模态框或弹出层
            if (target.closest('.widget-picker-overlay')) return false;
            if (target.closest('.music-modal-overlay')) return false;
            if (target.closest('.modal-overlay')) return false;
            // 如果点击了dock栏
            if (target.closest('.dock')) return false;
            // 如果点击了状态栏
            if (target.closest('.status-bar')) return false;
            // 如果点击了灵动岛
            if (target.closest('.dynamic-island')) return false;
            // 确保是在桌面页面内
            if (!target.closest('.desktop-page') && !target.closest('#desktop')) return false;
            return true;
        }

        function onStart(e) {
            if (e.type === 'touchstart') isTouchDetected = true;
            if (e.type === 'mousedown' && isTouchDetected) return;

            /* 【关键修复】点击App图标时直接忽略，不触发长按逻辑和小组件交互 */
            if (isAppIconClick(e.target)) {
                return;
            }

            /* 【删除按钮】点击时不触发拖拽 */
            if (e.target.closest('.widget-delete-btn')) return;
            
            /* 【关键】先清除之前的计时器，防止多次点击累积 */
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            
            var touch = e.touches ? e.touches[0] : e;
            startX = touch.clientX;
            startY = touch.clientY;
            isLongPress = false;
            
            var widgetEl = e.target.closest('.widget');
            
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onEnd);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onEnd);
            
            if (self.editMode && widgetEl) {
                e.preventDefault();
                self.prepareDrag(widgetEl, startX, startY);
            } else {
                /* 【已在编辑模式但没有点击小组件】不启动计时器 */
                if (self.editMode && !widgetEl) return;
                
                /* 【判断长按类型】保存触发时需要检查的信息 */
                var isBlankArea = isDesktopBlankArea(e.target);
                var hasWidget = !!widgetEl;

                longPressTimer = setTimeout(function() {
                    isLongPress = true;
                    longPressTimer = null; /* 【清除引用】计时器已触发 */
                    
                    if (hasWidget) {
                        /* 【长按小组件】进入编辑模式，不显示widget picker */
                        self.enterEditMode();
                        self.prepareDrag(widgetEl, startX, startY);
                        if (navigator.vibrate) navigator.vibrate(50);
                    }
                    /* 【其他情况】长按桌面空白区域、App图标、dock等不做任何处理 */
                    /* 小组件选择器改为通过专门的App唤醒 */
                }, 3000); /* 【长按时间】3000ms触发 */
            }
        }
        
        function handleMove(e) {
            if (!longPressTimer) return;
            
            var touch = e.touches ? e.touches[0] : e;
            var deltaX = Math.abs(touch.clientX - startX);
            var deltaY = Math.abs(touch.clientY - startY);
            
            /* 【移动超过10px取消长按】 */
            if (deltaX > 10 || deltaY > 10) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        }
        
        function handleEnd(e) {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            
            if (isLongPress) {
                e.preventDefault();
                e.stopPropagation();
                isLongPress = false;
                /* 【关键】标记刚完成长按，延迟重置以阻止后续的click事件 */
                justFinishedLongPress = true;
                setTimeout(function() {
                    justFinishedLongPress = false;
                }, 300);
            }
            
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);
        }

        /* 【修复】将事件绑定到桌面容器，支持所有桌面页面的小组件 */
        var pagesContainer = document.getElementById('desktop-pages-container') || this.container;
        
        pagesContainer.addEventListener('mousedown', onStart);
        pagesContainer.addEventListener('touchstart', onStart, { passive: false });
        
        pagesContainer.addEventListener('click', function(e) {
            /* 【关键】点击App图标时完全忽略小组件逻辑 */
            if (isAppIconClick(e.target)) {
                return;
            }
            
            /* 【关键】长按刚结束时忽略点击，防止误触发打开App */
            if (isLongPress || justFinishedLongPress) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            
            /* 【删除按钮点击】使用closest确保点击按钮任意位置都能响应 */
            var deleteBtn = e.target.closest('.widget-delete-btn');
            if (deleteBtn) {
                e.stopPropagation();
                e.preventDefault();
                var widgetEl = deleteBtn.closest('.widget');
                if (widgetEl) {
                    var widgetId = widgetEl.getAttribute('data-widget-id');
                    self.removeWidget(widgetId);
                    if (self.widgets.length === 0) self.exitEditMode();
                }
                return;
            }
            
            /* 【点击空白处退出编辑模式】 */
            if (self.editMode && !e.target.closest('.widget') && !e.target.closest('.widget-picker-overlay')) {
                self.exitEditMode();
            }
            
            /* 【点击小组件直接进入编辑模式】小组件只做显示功能 */
            if (!self.editMode) {
                var widgetEl = e.target.closest('.widget');
                if (widgetEl) {
                    /* 进入编辑模式，不跳转到App */
                    self.enterEditMode();
                    if (navigator.vibrate) navigator.vibrate(30);
                }
            }
        });
    };

    /* 【准备拖拽】获取小组件的初始位置信息 */
    DesktopManager.prototype.prepareDrag = function(widgetEl, clientX, clientY) {
        var widgetId = widgetEl.getAttribute('data-widget-id');
        var widget = this.widgets.find(function(w) { return w.id === widgetId; });
        
        if (!widget) return;
        
        var rect = widgetEl.getBoundingClientRect();
        
        this.dragState = {
            active: true,
            widget: widget,
            element: widgetEl,
            startClientX: clientX,
            startClientY: clientY,
            ghostInitX: rect.left,
            ghostInitY: rect.top,
            width: rect.width,
            height: rect.height,
            /* 【计算点击偏移】用于拖拽时保持鼠标相对位置 */
            offsetX: clientX - rect.left,
            offsetY: clientY - rect.top,
            pointerX: clientX,
            pointerY: clientY,
            rafId: null,
            hasMoved: false
        };
        
        this.createDragElements();
        this.startDragLoop();
    };

    /* 【创建拖拽元素】包括虚影和放置预览 */
    DesktopManager.prototype.createDragElements = function() {
        var s = this.dragState;
        if (!s.widget) return;
        
        /* 【克隆创建虚影】先克隆再隐藏原组件 */
        var ghost = s.element.cloneNode(true);
        ghost.id = '';
        ghost.classList.add('widget-drag-ghost');
        ghost.classList.remove('edit-mode', 'is-dragging-source');
        
        /* 【隐藏原组件】克隆后立即隐藏，只显示虚影 */
        s.element.classList.add('is-dragging-source');
        s.element.style.opacity = '0';
        s.element.style.visibility = 'hidden';
        
        /* 【清除所有可能影响位置的样式】 */
        ghost.style.cssText = '';
        ghost.style.position = 'fixed';
        ghost.style.margin = '0';
        ghost.style.padding = '0';
        ghost.style.width = s.width + 'px';
        ghost.style.height = s.height + 'px';
        ghost.style.left = '0px';
        ghost.style.top = '0px';
        ghost.style.gridRow = '';
        ghost.style.gridColumn = '';
        ghost.style.transform = 'translate3d(' + s.ghostInitX + 'px, ' + s.ghostInitY + 'px, 0)';
        ghost.style.zIndex = '9999';
        ghost.style.pointerEvents = 'none';
        ghost.style.opacity = '0.95';
        ghost.style.boxShadow = '0 15px 40px rgba(0,0,0,0.3)';
        ghost.style.borderRadius = '20px';
        ghost.style.willChange = 'transform';
        
        document.body.appendChild(ghost);
        s.ghostEl = ghost;
        
        /* 【创建放置预览】 */
        var preview = document.createElement('div');
        preview.className = 'widget-drop-preview';
        preview.style.width = s.width + 'px';
        preview.style.height = s.height + 'px';
        
        /* 【初始位置相对于容器】 */
        var containerRect = this.container.getBoundingClientRect();
        preview.style.left = '0px';
        preview.style.top = '0px';
        preview.style.transform = 'translate3d(' + (s.ghostInitX - containerRect.left) + 'px, ' + (s.ghostInitY - containerRect.top) + 'px, 0)';
        
        this.container.appendChild(preview);
        s.previewEl = preview;
        
        /* 【入场动画】轻微放大 */
        requestAnimationFrame(function() {
            if(s.ghostEl) s.ghostEl.style.transform = 'translate3d(' + s.ghostInitX + 'px, ' + s.ghostInitY + 'px, 0) scale(1.05)';
        });
    };

    /* 【拖拽循环】使用requestAnimationFrame实现流畅动画，添加插值平滑 */
    DesktopManager.prototype.startDragLoop = function() {
        var self = this;
        var s = this.dragState;
        
        /* 【插值平滑】用于让移动更丝滑 */
        var smoothX = s.ghostInitX;
        var smoothY = s.ghostInitY;
        var smoothFactor = 0.35; /* 插值系数，越小越丝滑 */
        
        function loop() {
            if (!s.active) return;
            
            var deltaX = s.pointerX - s.startClientX;
            var deltaY = s.pointerY - s.startClientY;
            
            var targetX = s.ghostInitX + deltaX;
            var targetY = s.ghostInitY + deltaY;
            
            /* 【平滑插值】让拖拽更丝滑 */
            smoothX += (targetX - smoothX) * smoothFactor;
            smoothY += (targetY - smoothY) * smoothFactor;
            
            if (s.ghostEl) {
                s.ghostEl.style.transform = 'translate3d(' + smoothX + 'px, ' + smoothY + 'px, 0) scale(1.05)';
            }
            
            self.updatePreviewPosition(s.pointerX, s.pointerY);
            
            s.rafId = requestAnimationFrame(loop);
        }
        
        s.rafId = requestAnimationFrame(loop);
    };

    /* 【更新预览位置】根据鼠标位置计算目标网格位置 */
    DesktopManager.prototype.updatePreviewPosition = function(clientX, clientY) {
        var s = this.dragState;
        var containerRect = this.container.getBoundingClientRect();
        
        var cellWidth = containerRect.width / this.grid.columns;
        var cellHeight = containerRect.height / this.grid.rows;
        
        /* 【使用虚影中心点判定】手感更好 */
        var centerX = (clientX - s.offsetX) + (s.width / 2);
        var centerY = (clientY - s.offsetY) + (s.height / 2);
        
        var relX = centerX - containerRect.left;
        var relY = centerY - containerRect.top;
        
        var col = Math.floor(relX / cellWidth);
        var row = Math.floor(relY / cellHeight);
        
        col = Math.max(0, Math.min(col, this.grid.columns - s.widget.colSpan));
        row = Math.max(0, Math.min(row, this.grid.rows - s.widget.rowSpan));
        
        if (row !== s.lastValidRow || col !== s.lastValidCol) {
            var canPlace = this.grid.canPlace(row, col, s.widget.rowSpan, s.widget.colSpan, s.widget.id);
            
            if (s.previewEl) {
                var targetLeft = col * cellWidth;
                var targetTop = row * cellHeight;
                
                s.previewEl.style.transform = 'translate3d(' + targetLeft + 'px, ' + targetTop + 'px, 0)';
                
                /* 【颜色反馈】可放置时蓝色，不可放置时红色 */
                if (canPlace) {
                    s.previewEl.style.borderColor = 'rgba(0, 122, 255, 0.5)';
                    s.previewEl.style.background = 'rgba(0, 122, 255, 0.15)';
                } else {
                    s.previewEl.style.borderColor = 'rgba(255, 59, 48, 0.5)';
                    s.previewEl.style.background = 'rgba(255, 59, 48, 0.15)';
                }
            }
            
            s.lastValidRow = row;
            s.lastValidCol = col;
            s.canPlaceCurrent = canPlace;
        }
    };

    DesktopManager.prototype.handleMove = function(e) {
        var touch = e.touches ? e.touches[0] : e;
        if (this.dragState.active) {
            e.preventDefault();
            this.dragState.pointerX = touch.clientX;
            this.dragState.pointerY = touch.clientY;
            this.dragState.hasMoved = true;
        }
    };

    DesktopManager.prototype.handleEnd = function(e) {
        document.removeEventListener('mousemove', this.handleMove);
        document.removeEventListener('mouseup', this.handleEnd);
        document.removeEventListener('touchmove', this.handleMove);
        document.removeEventListener('touchend', this.handleEnd);
        
        var s = this.dragState;
        if (!s.active) return;
        
        if (s.rafId) cancelAnimationFrame(s.rafId);
        
        /* 【放置小组件】 */
        if (s.hasMoved && s.canPlaceCurrent) {
            this.grid.place(s.widget, s.lastValidRow, s.lastValidCol);
            s.element.style.gridRow = (s.lastValidRow + 1) + ' / span ' + s.widget.rowSpan;
            s.element.style.gridColumn = (s.lastValidCol + 1) + ' / span ' + s.widget.colSpan;
            this.saveLayout();
        }
        
        /* 【清理拖拽元素】 */
        if (s.ghostEl) s.ghostEl.remove();
        if (s.previewEl) s.previewEl.remove();
        if (s.element) {
            s.element.classList.remove('is-dragging-source');
            /* 【恢复原组件样式】移除内联隐藏样式 */
            s.element.style.opacity = '';
            s.element.style.visibility = '';
        }
        
        this.dragState.active = false;
        this.dragState.widget = null;
        this.dragState.ghostEl = null;
    };

    DesktopManager.prototype.enterEditMode = function() {
        if (this.editMode) return;
        this.editMode = true;
        
        this.widgets.forEach(function(widget) {
            if (widget.element) widget.element.classList.add('edit-mode');
        });
        
        /* 【显示编辑模式提示】 */
        var hint = document.createElement('div');
        hint.className = 'desktop-edit-hint';
        hint.id = 'edit-mode-hint';
        hint.textContent = '编辑模式';
        document.getElementById('phone-screen').appendChild(hint);
        
        setTimeout(function() {
            if (hint) {
                hint.style.opacity = '0';
                setTimeout(function() { hint.remove(); }, 300);
            }
        }, 2000);
    };

    DesktopManager.prototype.exitEditMode = function() {
        if (!this.editMode) return;
        this.editMode = false;
        
        this.widgets.forEach(function(widget) {
            if (widget.element) widget.element.classList.remove('edit-mode');
        });
        
        var hint = document.getElementById('edit-mode-hint');
        if (hint) hint.remove();
    };

    /* 【常量】每屏最大app位置数 */
    var MAX_POSITIONS_PER_SCREEN = 16;

    /* 【计算小组件占用的总位置数】 */
    DesktopManager.prototype.getWidgetsTotalPositions = function() {
        var total = 0;
        this.widgets.forEach(function(w) {
            total += (w.rowSpan || 1) * (w.colSpan || 1);
        });
        return total;
    };

    /* 【获取当前桌面页的app数量】排除widget-manager-app自身 */
    DesktopManager.prototype.getCurrentPageAppCount = function() {
        if (!this.container) return 0;
        var apps = this.container.querySelectorAll('.app-wrapper');
        return apps.length;
    };

    /* 【获取指定桌面页的小组件占用位置数】 */
    DesktopManager.prototype.getPageWidgetPositions = function(pageIndex) {
        var total = 0;
        this.widgets.forEach(function(w) {
            if ((w.pageIndex || 0) === pageIndex) {
                total += (w.rowSpan || 1) * (w.colSpan || 1);
            }
        });
        return total;
    };

    /* 【获取指定桌面页的app数量】 */
    DesktopManager.prototype.getPageAppCount = function(pageIndex) {
        var pages = document.querySelectorAll('.desktop-page');
        if (pageIndex < 0 || pageIndex >= pages.length) return 0;
        var targetPage = pages[pageIndex];
        var apps = targetPage.querySelectorAll('.app-wrapper');
        return apps.length;
    };

    /* 【将指定页面多余的app移到下一屏】 */
    DesktopManager.prototype.movePageOverflowApps = function(pageIndex, overflowCount) {
        if (overflowCount <= 0) return;
        
        var pages = document.querySelectorAll('.desktop-page');
        if (pageIndex < 0 || pageIndex >= pages.length) return;
        
        var sourcePage = pages[pageIndex];
        var apps = sourcePage.querySelectorAll('.app-wrapper');
        var appsArray = Array.prototype.slice.call(apps);
        
        /* 从后往前取多余的app */
        var appsToMove = appsArray.slice(-overflowCount);
        
        if (appsToMove.length === 0) return;
        
        /* 获取或创建下一个桌面页 */
        var nextPage = null;
        if (pageIndex + 1 < pages.length) {
            nextPage = pages[pageIndex + 1];
        } else if (this.pager) {
            /* 创建新的桌面页 */
            nextPage = this.pager.addPage();
        }
        
        if (nextPage) {
            appsToMove.forEach(function(app) {
                nextPage.insertBefore(app, nextPage.firstChild);
            });
            
            if (PhoneCore.notifications) {
                PhoneCore.notifications.send({
                    type: 'info',
                    title: '桌面整理',
                    message: overflowCount + '个应用已移至桌面 ' + (pageIndex + 2),
                    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
                    size: 'mini'
                });
            }
        }
    };

    /* 【将下一屏的app移回当前屏】小组件删除时调用 */
    DesktopManager.prototype.pullAppsFromNextPage = function(pageIndex, freeSlots) {
        if (freeSlots <= 0) return;
        
        var pages = document.querySelectorAll('.desktop-page');
        if (pageIndex < 0 || pageIndex + 1 >= pages.length) return;
        
        var targetPage = pages[pageIndex];
        var nextPage = pages[pageIndex + 1];
        var apps = nextPage.querySelectorAll('.app-wrapper');
        
        if (apps.length === 0) return;
        
        var appsArray = Array.prototype.slice.call(apps);
        /* 从前面取可以移回的app数量 */
        var appsToMove = appsArray.slice(0, Math.min(freeSlots, appsArray.length));
        
        if (appsToMove.length === 0) return;
        
        appsToMove.forEach(function(app) {
            targetPage.appendChild(app);
        });
        
        if (PhoneCore.notifications) {
            PhoneCore.notifications.send({
                type: 'info',
                title: '桌面整理',
                message: appsToMove.length + '个应用已移回桌面 ' + (pageIndex + 1),
                icon: '📱',
                size: 'mini'
            });
        }
    };

    /* 【将多余的app移到下一屏】 */
    DesktopManager.prototype.moveOverflowAppsToNextPage = function(overflowCount) {
        if (overflowCount <= 0) return;
        
        var apps = this.container.querySelectorAll('.app-wrapper');
        var appsArray = Array.prototype.slice.call(apps);
        
        /* 从后往前取多余的app */
        var appsToMove = appsArray.slice(-overflowCount);
        
        if (appsToMove.length === 0) return;
        
        /* 获取或创建下一个桌面页 */
        var nextPage = null;
        if (this.pager) {
            var pages = document.querySelectorAll('.desktop-page');
            var currentPageIndex = 0;
            for (var i = 0; i < pages.length; i++) {
                if (pages[i] === this.container) {
                    currentPageIndex = i;
                    break;
                }
            }
            
            if (currentPageIndex + 1 < pages.length) {
                nextPage = pages[currentPageIndex + 1];
            } else {
                /* 创建新的桌面页 */
                nextPage = this.pager.addPage();
            }
        }
        
        if (nextPage) {
            appsToMove.forEach(function(app) {
                nextPage.insertBefore(app, nextPage.firstChild);
            });
            
            if (PhoneCore.notifications) {
                PhoneCore.notifications.send({
                    type: 'info',
                    title: '桌面整理',
                    message: overflowCount + '个应用已移至下一屏',
                    icon: '📱',
                    size: 'mini'
                });
            }
        }
    };

    DesktopManager.prototype.addWidget = function(widget) {
        var self = this;
        var widgetPositions = (widget.rowSpan || 1) * (widget.colSpan || 1);
        
        /* 【计算当前占用】 */
        var currentAppCount = this.getCurrentPageAppCount();
        var currentWidgetPositions = this.getWidgetsTotalPositions();
        var totalAfterAdd = currentAppCount + currentWidgetPositions + widgetPositions;
        
        /* 【如果超出最大位置数，先移动多余的app】 */
        if (totalAfterAdd > MAX_POSITIONS_PER_SCREEN) {
            var overflowCount = totalAfterAdd - MAX_POSITIONS_PER_SCREEN;
            this.moveOverflowAppsToNextPage(overflowCount);
        }
        
        var slot = this.grid.findEmptySlot(widget.rowSpan, widget.colSpan);
        if (!slot) {
            if (PhoneCore.notifications) {
                PhoneCore.notifications.send({
                    type: 'error',
                    title: '无法添加',
                    message: '桌面空间不足',
                    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
                    size: 'mini'
                });
            }
            return false;
        }
        
        this.grid.place(widget, slot.row, slot.col);
        
        var el = widget.createElement();
        el.style.gridRow = (slot.row + 1) + ' / span ' + widget.rowSpan;
        el.style.gridColumn = (slot.col + 1) + ' / span ' + widget.colSpan;
        
        this.container.appendChild(el);
        this.widgets.push(widget);
        widget.pageIndex = 0;  /* 【新增】默认添加到第一个桌面 */
        this.saveLayout();
        
        /* 【添加动画】 */
        el.style.opacity = '0';
        el.style.transform = 'scale(0.8)';
        requestAnimationFrame(function() {
            el.style.opacity = '1';
            el.style.transform = 'scale(1)';
        });
        
        return true;
    };

    DesktopManager.prototype.removeWidget = function(widgetId) {
        var widget = this.widgets.find(function(w) { return w.id === widgetId; });
        if (!widget) return;
        
        /* 【记录小组件所在页面和占用的位置数】 */
        var pageIndex = widget.pageIndex || 0;
        var freedPositions = (widget.rowSpan || 1) * (widget.colSpan || 1);
        
        this.grid.remove(widgetId);
        if (widget.element) widget.element.remove();
        this.widgets = this.widgets.filter(function(w) { return w.id !== widgetId; });
        this.saveLayout();
        
        /* 【尝试将下一页的图标移回当前页】 */
        var currentAppCount = this.getPageAppCount(pageIndex);
        var currentWidgetPositions = this.getPageWidgetPositions(pageIndex);
        var currentTotal = currentAppCount + currentWidgetPositions;
        var availableSlots = MAX_POSITIONS_PER_SCREEN - currentTotal;
        
        if (availableSlots > 0) {
            this.pullAppsFromNextPage(pageIndex, availableSlots);
        }
    };

    DesktopManager.prototype.saveLayout = function() {
        var layout = this.widgets.map(function(w) {
            return {
                id: w.id,
                appId: w.appId,
                size: w.size,
                position: w.gridPosition,
                pageIndex: w.pageIndex || 0,  /* 【新增】保存所在桌面页索引 */
                data: w.data
            };
        });
        
        if (PhoneCore.db) {
            PhoneCore.db.put('app_data', {
                appId: 'desktop_layout',
                widgets: layout
            });
        }
    };

    DesktopManager.prototype.loadLayout = function() {
        var self = this;
        if (!PhoneCore.db) return Promise.resolve();
        
        return PhoneCore.db.get('app_data', 'desktop_layout').then(function(data) {
            if (data && data.widgets) {
                var pages = document.querySelectorAll('.desktop-page');
                
                data.widgets.forEach(function(wData) {
                    var app = PhoneCore.getApp(wData.appId);
                    if (app && app.renderWidget) {
                        var widget = new Widget({
                            id: wData.id,
                            appId: wData.appId,
                            size: wData.size,
                            data: wData.data,
                            render: function() {
                                return app.renderWidget(wData.size, wData.data);
                            }
                        });
                        
                        /* 【修复】获取正确的目标桌面页 */
                        var pageIndex = wData.pageIndex || 0;
                        var targetPage = pages[pageIndex] || pages[0] || self.container;
                        
                        widget.pageIndex = pageIndex;  /* 【新增】记录所在页面 */
                        widget.gridPosition = wData.position;
                        
                        var el = widget.createElement();
                        el.style.gridRow = (wData.position.row + 1) + ' / span ' + widget.rowSpan;
                        el.style.gridColumn = (wData.position.col + 1) + ' / span ' + widget.colSpan;
                        targetPage.appendChild(el);
                        self.widgets.push(widget);
                    }
                });
                
                /* 【关键修复】加载小组件后，重新调整所有页面的图标分布 */
                self.rebalanceAllPages();
            }
        });
    };

    /* 【重新平衡所有桌面页的图标分布】
       确保每个桌面页的 图标数 + 小组件占用 <= 16 */
    DesktopManager.prototype.rebalanceAllPages = function() {
        var self = this;
        var pages = document.querySelectorAll('.desktop-page');
        
        /* 从第一页开始，依次检查并移动溢出的图标 */
        for (var i = 0; i < pages.length; i++) {
            var pageAppCount = this.getPageAppCount(i);
            var pageWidgetPositions = this.getPageWidgetPositions(i);
            var total = pageAppCount + pageWidgetPositions;
            
            if (total > MAX_POSITIONS_PER_SCREEN) {
                var overflowCount = total - MAX_POSITIONS_PER_SCREEN;
                this.movePageOverflowApps(i, overflowCount);
            }
        }
    };

    /* 【添加新桌面页】 */
    DesktopManager.prototype.addDesktopPage = function() {
        if (this.pager) {
            return this.pager.addPage();
        }
        return null;
    };

    /* 【切换到指定桌面页】 */
    DesktopManager.prototype.goToPage = function(pageIndex) {
        if (this.pager) {
            this.pager.goToPage(pageIndex);
        }
    };

    /* 【小组件选择器】通过小组件App唤醒 */
    DesktopManager.prototype.showWidgetPicker = function() {
        var self = this;
        var screen = document.getElementById('phone-screen');
        
        var oldPicker = document.querySelector('.widget-picker-overlay');
        if (oldPicker) oldPicker.remove();

        /* 【获取桌面页面数量】 */
        var pages = document.querySelectorAll('.desktop-page');
        var totalPages = pages.length;
        var currentPageIndex = this.pager ? this.pager.currentPage : 0;
        var selectedPageIndex = currentPageIndex; /* 默认选中当前页 */

        var overlay = document.createElement('div');
        overlay.className = 'widget-picker-overlay';
        overlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0);transition:background 0.15s;z-index:2000;display:flex;align-items:flex-end;justify-content:center;touch-action:none;';
        
        var picker = document.createElement('div');
        picker.className = 'widget-picker';
        picker.style.cssText = 'background:rgba(255,255,255,0.98);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-radius:16px 16px 0 0;padding:16px;width:100%;max-height:65%;overflow-y:auto;overflow-x:hidden;transform:translateY(100%);transition:transform 0.15s cubic-bezier(0.1, 0.9, 0.2, 1);box-shadow:0 -4px 20px rgba(0,0,0,0.08);padding-bottom:30px;scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;';
        
        var html = '<div style="font-size:16px;font-weight:600;margin-bottom:4px;text-align:center;color:#1a1a1a;">添加小组件</div>';
        html += '<div style="font-size:11px;color:#8e8e93;margin-bottom:12px;text-align:center;">选择小组件添加到桌面</div>';
        
        /* 【桌面页面选择器】 */
        html += '<div style="margin-bottom:14px;padding:10px;background:#F5F5F7;border-radius:10px;">';
        html += '<div style="font-size:11px;color:#86868b;margin-bottom:8px;font-weight:500;">目标桌面</div>';
        html += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
        for (var i = 0; i < totalPages; i++) {
            var isSelected = i === selectedPageIndex;
            html += '<button class="page-select-btn" data-page="' + i + '" style="';
            html += 'padding:6px 12px;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;';
            html += 'border:1.5px solid ' + (isSelected ? '#007AFF' : 'transparent') + ';';
            html += 'background:' + (isSelected ? '#007AFF' : '#fff') + ';';
            html += 'color:' + (isSelected ? '#fff' : '#333') + ';';
            html += 'transition:all 0.15s;">';
            html += '桌面 ' + (i + 1);
            html += '</button>';
        }
        /* 【新建桌面按钮】 */
        html += '<button class="page-select-btn page-add-new" data-page="new" style="';
        html += 'padding:6px 12px;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;';
        html += 'border:1.5px dashed #c7c7cc;background:#fff;color:#86868b;transition:all 0.15s;">';
        html += '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:-1px;margin-right:2px;"><path d="M12 5v14M5 12h14"/></svg>新建';
        html += '</button>';
        html += '</div></div>';
        
        /* 【获取支持小组件的App】 */
        var appsWithWidgets = [];
        if (PhoneCore.apps) {
            appsWithWidgets = Object.values(PhoneCore.apps).filter(function(app) {
                return app && typeof app.getWidgetTypes === 'function' && app.getWidgetTypes().length > 0;
            });
        }

        if (appsWithWidgets.length === 0) {
            html += '<div style="text-align:center;padding:30px;color:#86868b;font-size:13px;">';
            html += '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c7c7cc" stroke-width="1.5" style="margin-bottom:8px;"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>';
            html += '<div>暂无可用小组件</div></div>';
        } else {
            appsWithWidgets.forEach(function(app) {
                var widgetTypes = app.getWidgetTypes();
                html += '<div style="margin-bottom:16px;">';
                html += '<div style="font-weight:500;margin-bottom:8px;display:flex;align-items:center;padding:0 2px;">';
                /* 【使用SVG图标替代emoji】 */
                var appSvgIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007AFF" stroke-width="1.5" style="margin-right:8px;flex-shrink:0;"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="12" cy="12" r="3"/></svg>';
                if (app.iconSvg) {
                    appSvgIcon = '<span style="width:18px;height:18px;margin-right:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">' + app.iconSvg + '</span>';
                }
                html += appSvgIcon;
                html += '<span style="font-size:13px;color:#1a1a1a;">' + app.name + '</span>';
                html += '</div>';
                
                html += '<div style="display:flex;gap:10px;overflow-x:auto;padding:2px;padding-bottom:8px;scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;">';
                
                widgetTypes.forEach(function(type) {
                    var previewWidth = type.size === 'small' ? '70px' : (type.size === 'medium' ? '90px' : '140px');
                    var previewHeight = type.size === 'small' ? '35px' : '70px';
                    
                    /* 【小组件选项】整个区域可点击 */
                    html += '<div class="widget-type-option" data-app-id="' + app.id + '" data-size="' + type.size + '" data-type="' + (type.type || '') + '" style="flex-shrink:0;cursor:pointer;transition:transform 0.1s;">';
                    /* 【预览容器】设置pointer-events:none让点击穿透 */
                    html += '<div style="width:' + previewWidth + ';height:' + previewHeight + ';background:#fff;border:1px solid rgba(0,0,0,0.04);border-radius:10px;margin-bottom:4px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.04);pointer-events:none;">';
                    html += '<div style="transform:scale(0.5);transform-origin:top left;width:200%;height:200%;">';
                    if (app.renderWidget) {
                        html += app.renderWidget(type.size, {});
                    }
                    html += '</div>';
                    html += '</div>';
                    /* 【标签】也设置pointer-events:none让点击穿透 */
                    html += '<div style="font-size:10px;color:#86868b;text-align:center;pointer-events:none;">' + type.name + '</div>';
                    html += '</div>';
                });
                
                html += '</div></div>';
            });
        }
        
        html += '<button class="picker-cancel-btn" style="width:100%;padding:11px;background:#F5F5F7;color:#007AFF;border:none;border-radius:10px;font-size:14px;font-weight:500;cursor:pointer;margin-top:6px;">取消</button>';
        
        picker.innerHTML = html;
        overlay.appendChild(picker);
        screen.appendChild(overlay);
        
        /* 【立即触发动画】使用双重rAF确保DOM已渲染 */
        requestAnimationFrame(function() {
            requestAnimationFrame(function() {
                overlay.style.background = 'rgba(0,0,0,0.3)';
                picker.style.transform = 'translateY(0)';
            });
        });
        
        /* 【桌面页面选择器事件】 */
        picker.querySelectorAll('.page-select-btn').forEach(function(btn) {
            btn.onclick = function(e) {
                e.stopPropagation();
                var pageValue = btn.getAttribute('data-page');
                
                if (pageValue === 'new') {
                    /* 创建新桌面页 */
                    if (self.pager) {
                        self.pager.addPage();
                        /* 刷新桌面页面数量并选中新页面 */
                        var newPages = document.querySelectorAll('.desktop-page');
                        selectedPageIndex = newPages.length - 1;
                    }
                } else {
                    selectedPageIndex = parseInt(pageValue);
                }
                
                /* 更新按钮样式 */
                picker.querySelectorAll('.page-select-btn').forEach(function(b) {
                    var isNew = b.classList.contains('page-add-new');
                    var idx = b.getAttribute('data-page');
                    var isSelected = (idx !== 'new' && parseInt(idx) === selectedPageIndex);
                    
                    if (isNew) {
                        b.style.border = '2px dashed #ccc';
                        b.style.background = '#fff';
                        b.style.color = '#666';
                    } else {
                        b.style.border = isSelected ? '2px solid #007AFF' : '2px solid transparent';
                        b.style.background = isSelected ? '#007AFF' : '#fff';
                        b.style.color = isSelected ? '#fff' : '#333';
                    }
                });
            };
        });
        
        overlay.onclick = function(e) {
            if (e.target === overlay || e.target.classList.contains('picker-cancel-btn')) {
                closePicker();
            }
        };

        picker.querySelectorAll('.widget-type-option').forEach(function(option) {
            option.onclick = function(e) {
                e.stopPropagation();
                var appId = option.getAttribute('data-app-id');
                var size = option.getAttribute('data-size');
                var type = option.getAttribute('data-type');
                var app = PhoneCore.getApp(appId);
                
                if (app && app.createWidget) {
                    var widget = app.createWidget(size, type);
                    if (widget) {
                        closePicker();
                        setTimeout(function() {
                            self.addWidgetToPage(widget, selectedPageIndex);
                        }, 300);
                    }
                }
            };
            option.addEventListener('mousedown', function() { this.style.transform = 'scale(0.95)'; });
            option.addEventListener('mouseup', function() { this.style.transform = 'scale(1)'; });
            option.addEventListener('mouseleave', function() { this.style.transform = 'scale(1)'; });
        });
        
        function closePicker() {
            overlay.style.background = 'rgba(0,0,0,0)';
            picker.style.transform = 'translateY(100%)';
            setTimeout(function() { overlay.remove(); }, 150);
        }
    };

    /* 【添加小组件到指定桌面页】 */
    DesktopManager.prototype.addWidgetToPage = function(widget, pageIndex) {
        var self = this;
        var pages = document.querySelectorAll('.desktop-page');
        if (pageIndex < 0 || pageIndex >= pages.length) {
            pageIndex = 0;
        }
        
        var targetPage = pages[pageIndex];
        var originalContainer = this.container;
        
        /* 【计算添加小组件后是否会溢出】 */
        var widgetPositions = (widget.rowSpan || 1) * (widget.colSpan || 1);
        var currentAppCount = this.getPageAppCount(pageIndex);
        var currentWidgetPositions = this.getPageWidgetPositions(pageIndex);
        var totalAfterAdd = currentAppCount + currentWidgetPositions + widgetPositions;
        
        /* 【如果超出最大位置数，先移动多余的app到下一页】 */
        if (totalAfterAdd > MAX_POSITIONS_PER_SCREEN) {
            var overflowCount = totalAfterAdd - MAX_POSITIONS_PER_SCREEN;
            this.movePageOverflowApps(pageIndex, overflowCount);
        }
        
        /* 临时切换容器到目标页面 */
        this.container = targetPage;
        
        /* 为目标页面创建临时grid */
        var tempGrid = new DesktopGrid({
            containerId: targetPage.id || 'desktop',
            columns: 4,
            rows: 4
        });
        
        /* 标记已占用的位置（根据目标页面的现有小组件） */
        var existingWidgets = targetPage.querySelectorAll('.widget');
        existingWidgets.forEach(function(w) {
            var style = w.style.gridRow;
            var colStyle = w.style.gridColumn;
            if (style && colStyle) {
                var rowMatch = style.match(/(\d+)/);
                var colMatch = colStyle.match(/(\d+)/);
                var spanRowMatch = style.match(/span\s+(\d+)/);
                var spanColMatch = colStyle.match(/span\s+(\d+)/);
                
                if (rowMatch && colMatch) {
                    var row = parseInt(rowMatch[1]) - 1;
                    var col = parseInt(colMatch[1]) - 1;
                    var rowSpan = spanRowMatch ? parseInt(spanRowMatch[1]) : 1;
                    var colSpan = spanColMatch ? parseInt(spanColMatch[1]) : 1;
                    
                    /* 标记占用 */
                    for (var r = row; r < row + rowSpan && r < 4; r++) {
                        for (var c = col; c < col + colSpan && c < 4; c++) {
                            tempGrid.grid[r][c] = 'occupied';
                        }
                    }
                }
            }
        });
        
        /* 查找空位 */
        var slot = tempGrid.findEmptySlot(widget.rowSpan, widget.colSpan);
        if (!slot) {
            if (PhoneCore.notifications) {
                PhoneCore.notifications.send({
                    type: 'error',
                    title: '无法添加',
                    message: '桌面 ' + (pageIndex + 1) + ' 空间不足',
                    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
                    size: 'mini'
                });
            }
            this.container = originalContainer;
            return false;
        }
        
        /* 放置小组件 */
        var el = widget.createElement();
        el.style.gridRow = (slot.row + 1) + ' / span ' + widget.rowSpan;
        el.style.gridColumn = (slot.col + 1) + ' / span ' + widget.colSpan;
        
        targetPage.appendChild(el);
        this.widgets.push(widget);
        widget.gridPosition = { row: slot.row, col: slot.col };
        widget.pageIndex = pageIndex;  /* 【新增】记录所在桌面页索引 */
        
        /* 恢复原容器 */
        this.container = originalContainer;
        
        this.saveLayout();
        
        /* 切换到目标桌面页 */
        if (this.pager && pageIndex !== this.pager.currentPage) {
            this.pager.goToPage(pageIndex);
        }
        
        /* 添加动画 */
        el.style.opacity = '0';
        el.style.transform = 'scale(0.8)';
        requestAnimationFrame(function() {
            el.style.opacity = '1';
            el.style.transform = 'scale(1)';
        });
        
        if (PhoneCore.notifications) {
            PhoneCore.notifications.send({
                type: 'success',
                title: '添加成功',
                message: '小组件已添加到桌面 ' + (pageIndex + 1),
                icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
                size: 'mini'
            });
        }
        
        return true;
    };

    // ============ 23. 主系统初始化 ============
    var PhoneCore = {
        db: null,
        time: null,
        notifications: null,
        resources: null,
        badges: null,
        prompts: null,
        api: null,
        user: null,
        triggers: null,
        feedback: null,
        appStack: null,
        offline: null,
        transactions: null,
        npcGenerator: null,
        desktopManager: null, /* 【桌面管理器】 */
        activities: null, /* 【活动追踪器】记录用户与AI的互动数据 */
        
        /* ========== 新增管理器 ========== */
        stickerManager: null,        /* 【三层表情包管理器】 */
        promptLibrary: null,         /* 【提示词库管理器】 */
        memoryCondenser: null,       /* 【记忆浓缩管理器】 */
        memorySystem: null,          /* 【智能记忆系统】自动提取和维护记忆 */
        aiAppConfig: null,           /* 【AI App配置管理器】 */
        
        worlds: {},
        ais: {},
        schedules: {},  /* 【时间表集合】 */
        apps: {},
        
        /* 【通用数据存储】
           用于存储各种临时/扩展数据，如头像库、背景库等
           这些数据会被持久化保存到 IndexedDB */
        data: {},
        
        /* 【AI可见信息全局注册表】
           存储所有App声明的AI可见信息配置
           格式：{ appId: { enabled, name, icon, desc, dataSources: [...] }, ... }
           扩展App只需要在config中声明aiVisibility，注册时会自动添加到这里 */
        aiVisibilityRegistry: {},
        
        initialized: false,
        
        init: function() {
            var self = this;
            
            this.db = new Database({
                name: 'PhoneSimulatorDB',
                version: 3,
                stores: [
                    {
                        name: 'resources',
                        keyPath: 'id',
                        indexes: [
                            { name: 'type', keyPath: 'type' },
                            { name: 'createdAt', keyPath: 'createdAt' }
                        ]
                    },
                    {
                        name: 'worlds',
                        keyPath: 'id'
                    },
                    {
                        name: 'ai_characters',
                        keyPath: 'id',
                        indexes: [
                            { name: 'type', keyPath: 'type' },
                            { name: 'worldId', keyPath: 'worldId' }
                        ]
                    },
                    {
                        name: 'user_profile',
                        keyPath: 'id'
                    },
                    {
                        name: 'api_configs',
                        keyPath: 'id'
                    },
                    {
                        name: 'chat_messages',
                        keyPath: 'id',
                        indexes: [
                            { name: 'chatId', keyPath: 'chatId' },
                            { name: 'timestamp', keyPath: 'timestamp' }
                        ]
                    },
                    {
                        name: 'transactions',
                        keyPath: 'id',
                        indexes: [
                            { name: 'timestamp', keyPath: 'timestamp' },
                            { name: 'type', keyPath: 'type' }
                        ]
                    },
                    {
                        name: 'prompts',
                        keyPath: 'id',
                        indexes: [
                            { name: 'category', keyPath: 'category' }
                        ]
                    },
                    {
                        name: 'widgets',
                        keyPath: 'id'
                    },
                    {
                        name: 'app_data',
                        keyPath: 'appId'
                    },
                    {
                        name: 'notifications_history',
                        keyPath: 'id',
                        indexes: [
                            { name: 'timestamp', keyPath: 'timestamp' }
                        ]
                    },
                    /* 【活动记录表】用于存储用户与AI的互动活动
                       特点：清空数据时不会被删除，永久保留 */
                    {
                        name: 'activity_records',
                        keyPath: 'id',
                        indexes: [
                            { name: 'type', keyPath: 'type' },
                            { name: 'aiId', keyPath: 'aiId' },
                            { name: 'timestamp', keyPath: 'timestamp' },
                            { name: 'appId', keyPath: 'appId' }
                        ]
                    },
                    /* 【时间表存储】用于存储用户和AI的详细时间安排 */
                    {
                        name: 'schedules',
                        keyPath: 'id',
                        indexes: [
                            { name: 'name', keyPath: 'name' }
                        ]
                    },
                    /* ========== 三层表情包系统 ========== */
                    /* 【表情包库】第一层：用户看的分类名，AI不读取
                       结构：{ id, name(用户看), description, packIds[], createdAt } */
                    {
                        name: 'sticker_libraries',
                        keyPath: 'id'
                    },
                    /* 【表情包包】第二层：AI可读取的情绪/场景名称
                       结构：{ id, libraryId, name(AI读), description, stickerIds[], createdAt } */
                    {
                        name: 'sticker_packs',
                        keyPath: 'id',
                        indexes: [
                            { name: 'libraryId', keyPath: 'libraryId' }
                        ]
                    },
                    /* 【表情包】第三层：具体的表情图片
                       结构：{ id, packId, name(可选), resourceId, createdAt } */
                    {
                        name: 'stickers',
                        keyPath: 'id',
                        indexes: [
                            { name: 'packId', keyPath: 'packId' }
                        ]
                    },
                    /* ========== 提示词分类系统 ========== */
                    /* 【提示词分类】用于组织管理提示词
                       结构：{ id, name, description, type('role'|'functional'|'app'), createdAt } */
                    {
                        name: 'prompt_categories',
                        keyPath: 'id',
                        indexes: [
                            { name: 'type', keyPath: 'type' }
                        ]
                    },
                    /* 【提示词合集】一类提示词的集合，可被AI引用
                       结构：{ id, categoryId, name, promptIds[], description, createdAt } */
                    {
                        name: 'prompt_collections',
                        keyPath: 'id',
                        indexes: [
                            { name: 'categoryId', keyPath: 'categoryId' }
                        ]
                    },
                    /* 【提示词模板】具体的提示词内容
                       结构：{ id, collectionId, title, content, variables[], appId(可选), createdAt } */
                    {
                        name: 'prompt_templates',
                        keyPath: 'id',
                        indexes: [
                            { name: 'collectionId', keyPath: 'collectionId' },
                            { name: 'appId', keyPath: 'appId' }
                        ]
                    },
                    /* ========== AI App专用配置系统 ========== */
                    /* 【AI App配置】每个AI在不同App中的专属配置
                       结构：{ id, aiId, appId, networkId, avatar, promptCollectionIds[], 
                               dataAccessLevel, memoryEnabled, customSettings, createdAt } */
                    {
                        name: 'ai_app_configs',
                        keyPath: 'id',
                        indexes: [
                            { name: 'aiId', keyPath: 'aiId' },
                            { name: 'appId', keyPath: 'appId' }
                        ]
                    },
                    /* ========== 记忆浓缩系统 ========== */
                    /* 【记忆浓缩器】NPC AI用于浓缩主角色AI的记忆
                       结构：{ id, name, promptTemplate, targetAiTypes[], 
                               triggerCondition, outputFormat, createdAt } */
                    {
                        name: 'memory_condensers',
                        keyPath: 'id'
                    },
                    /* 【浓缩记忆结果】存储浓缩后的记忆
                       结构：{ id, aiId, condenserId, originalMemoryIds[], 
                               condensedContent, createdAt } */
                    {
                        name: 'condensed_memories',
                        keyPath: 'id',
                        indexes: [
                            { name: 'aiId', keyPath: 'aiId' },
                            { name: 'condenserId', keyPath: 'condenserId' }
                        ]
                    },
                    /* ========== API组配置系统 ========== */
                    /* 【API组】管理多个API配置的轮询/故障转移
                       结构：{ id, name, mode('failover'|'rotation'|'weighted'), 
                               configIds[], weights[], usageLimits[], currentIndex, stats } */
                    {
                        name: 'api_groups',
                        keyPath: 'id'
                    }
                ]
            });
            
            return this.db.open().then(function() {
                self.time = new TimeSystem();
                self.time.init('status-time');
                
                self.notifications = new NotificationSystem();
                self.resources = new ResourceManager(self.db);
                self.badges = new BadgeManager();
                self.prompts = new PromptFactory();
                self.api = new APIManager();
                self.triggers = new EventTriggerSystem();
                self.feedback = new FeedbackSystem();
                self.appStack = new AppStackManager();
                self.transactions = new TransactionManager(self.db);
                self.npcGenerator = new NPCAIGenerator(self.api);
                
                /* 【初始化活动追踪器】 */
                self.activities = new ActivityTracker(self.db);
                
                /* 【初始化新管理器】 */
                self.stickerManager = new StickerManager(self.db);
                self.promptLibrary = new PromptLibraryManager(self.db);
                self.memoryCondenser = new MemoryCondenserManager(self.db, self.api);
                self.memorySystem = new MemorySystem(self.api);
                self.aiAppConfig = new AIAppConfigManager(self.db);
                
                return self.loadUserProfile();
            }).then(function() {
                return self.loadWorlds();
            }).then(function() {
                return self.loadAIs();
            }).then(function() {
                return self.loadSchedules();
            }).then(function() {
                return self.loadAPIConfigs();
            }).then(function() {
                /* 【加载桌面壁纸设置】 */
                return self.loadWallpaperSettings();
            }).then(function() {
                /* 【加载桌面设置（图标颜色、状态栏颜色、明度等）】 */
                return self.loadDesktopSettings();
            }).then(function() {
                /* 【加载通用数据（头像库、背景库等）】 */
                return self.loadData();
            }).then(function() {
                /* 【加载新管理器数据】 */
                return Promise.all([
                    self.stickerManager.load(),
                    self.promptLibrary.load(),
                    self.memoryCondenser.load(),
                    self.aiAppConfig.load()
                ]);
            }).then(function() {
                self.offline = new OfflineCompensator({
                    db: self.db,
                    aiManager: self,
                    userProfile: self.user
                });
                
                self.registerDefaultTriggers();
                self.registerDefaultPrompts();
                
                var deltaTime = self.time.getDeltaTime();
                if (deltaTime > 3600000) {
                    return self.offline.calculate(deltaTime).then(function(results) {
                        return self.offline.apply(results);
                    });
                }
            }).then(function() {
                /* 【初始化桌面管理器】在核心系统初始化完成后初始化 */
                self.desktopManager = new DesktopManager();
                self.desktopManager.init();
                
                /* 【延迟加载布局】确保App已注册且数据预加载完成后再加载小组件 */
                setTimeout(function() {
                    self.desktopManager.loadLayout().then(function() {
                        // 小组件加载完成后，刷新所有小组件内容（确保数据已就绪）
                        self.desktopManager.widgets.forEach(function(w) {
                            if (w.element) {
                                var content = w.element.querySelector('.widget-content');
                                if (content && w.renderFn) {
                                    content.innerHTML = w.renderFn(w.data);
                                }
                            }
                        });
                    });
                }, 500);
                
                /* 【绑定小组件管理器App】点击打开小组件选择器 */
                var widgetManagerApp = document.getElementById('widget-manager-app');
                if (widgetManagerApp) {
                    widgetManagerApp.onclick = function(e) {
                        e.stopPropagation();
                        if (self.desktopManager) {
                            self.desktopManager.showWidgetPicker();
                        }
                    };
                }
                
                self.initialized = true;
                
                /* 【启动智能记忆系统维护定时器】 */
                if (self.memorySystem) {
                    self.memorySystem.startMaintenance();
                }
                
                EventBus.emit('core:initialized');
                console.log('PhoneCore 初始化完成');
                return self;
            }).catch(function(error) {
                console.error('PhoneCore 初始化失败:', error);
                throw error;
            });
        },
        
        loadUserProfile: function() {
            var self = this;
            return this.db.getAll('user_profile').then(function(profiles) {
                if (profiles.length > 0) {
                    self.user = new UserProfile(profiles[0]);
                } else {
                    self.user = new UserProfile({ id: 'default_user' });
                    return self.db.put('user_profile', self.user.toJSON());
                }
            });
        },
        
        saveUserProfile: function() {
            return this.db.put('user_profile', this.user.toJSON());
        },
        
        /* ========== 桌面壁纸功能 ========== */
        wallpaper: null, /* 壁纸设置: { image: base64/url, blur: 0-30 } */
        
        /* 【应用壁纸到桌面】 */
        applyWallpaper: function() {
            var wallpaperEl = document.getElementById('desktop-wallpaper');
            if (!wallpaperEl) return;
            
            if (this.wallpaper && this.wallpaper.image) {
                wallpaperEl.style.backgroundImage = 'url(' + this.wallpaper.image + ')';
                // 组合blur和brightness滤镜
                var blur = this.wallpaper.blur || 0;
                var brightness = (this.desktopSettings && this.desktopSettings.wallpaperBrightness) || 100;
                wallpaperEl.style.filter = 'blur(' + blur + 'px) brightness(' + (brightness / 100) + ')';
                wallpaperEl.style.display = 'block';
            } else {
                wallpaperEl.style.backgroundImage = '';
                wallpaperEl.style.filter = '';
                wallpaperEl.style.display = 'none';
            }
        },
        
        /* 【保存壁纸设置】 */
        saveWallpaperSettings: function() {
            var self = this;
            return this.db.put('app_data', {
                appId: 'desktop_wallpaper',
                settings: this.wallpaper || { image: '', blur: 0 }
            }).then(function() {
                console.log('[Wallpaper] Settings saved');
            });
        },
        
        /* 【加载壁纸设置】 */
        loadWallpaperSettings: function() {
            var self = this;
            return this.db.get('app_data', 'desktop_wallpaper').then(function(data) {
                if (data && data.settings) {
                    self.wallpaper = data.settings;
                } else {
                    self.wallpaper = { image: '', blur: 0 };
                }
                self.applyWallpaper();
            }).catch(function() {
                self.wallpaper = { image: '', blur: 0 };
            });
        },
        
        /* ========== 桌面设置功能 ========== */
        desktopSettings: null, /* 桌面设置: { showWeatherNotification, iconTextColor, statusBarColor, wallpaperBrightness, batteryColor, phoneCase: { type, colors, angle } } */
        
        /* 【应用桌面设置】 */
        applyDesktopSettings: function() {
            var settings = this.desktopSettings || {};
            
            // 应用图标文字颜色
            var iconTextColor = settings.iconTextColor || '#ffffff';
            var iconNames = document.querySelectorAll('.app-icon-name');
            iconNames.forEach(function(el) {
                el.style.color = iconTextColor;
            });
            
            // 应用状态栏颜色（桌面模式下）
            var statusBar = document.querySelector('.status-bar');
            if (statusBar && !document.querySelector('.app-window:not(.hidden)')) {
                statusBar.classList.remove('status-bar-light', 'status-bar-dark');
                if (settings.statusBarColor === 'light') {
                    statusBar.classList.add('status-bar-light');
                } else if (settings.statusBarColor === 'dark') {
                    statusBar.classList.add('status-bar-dark');
                }
                // auto模式不添加类，使用默认样式
            }
            
            // 应用壁纸明度（与模糊度组合应用）
            var wallpaperEl = document.getElementById('desktop-wallpaper');
            if (wallpaperEl && this.wallpaper && this.wallpaper.image) {
                var blur = this.wallpaper.blur || 0;
                var brightness = settings.wallpaperBrightness || 100;
                wallpaperEl.style.filter = 'blur(' + blur + 'px) brightness(' + (brightness / 100) + ')';
            }
            
            // 应用手机壳样式
            this.applyPhoneCaseStyle();
            
            // 应用电池颜色
            this.applyBatteryColor();
        },
        
        /* 应用手机壳样式 */
        applyPhoneCaseStyle: function() {
            var phoneCase = document.querySelector('.phone-case');
            if (!phoneCase) return;
            
            var settings = (this.desktopSettings && this.desktopSettings.phoneCase) || {
                type: 'gradient',
                colors: ['#f6d3e0', '#b4d7f2'],
                angle: 135
            };
            
            if (settings.type === 'solid') {
                phoneCase.style.background = settings.colors[0] || '#f6d3e0';
            } else {
                var angle = settings.angle || 135;
                var colors = settings.colors || ['#f6d3e0', '#b4d7f2'];
                phoneCase.style.background = 'linear-gradient(' + angle + 'deg,' + colors.join(',') + ')';
            }
        },
        
        /* 应用电池颜色 */
        applyBatteryColor: function() {
            var settings = this.desktopSettings || {};
            var batteryColor = settings.batteryColor || '#73AE52';
            
            // 更新电池内部填充颜色
            var batteryStyle = document.getElementById('battery-color-style');
            if (!batteryStyle) {
                batteryStyle = document.createElement('style');
                batteryStyle.id = 'battery-color-style';
                document.head.appendChild(batteryStyle);
            }
            batteryStyle.textContent = '.battery::after { background-color: ' + batteryColor + ' !important; }';
        },
        
        /* 保存桌面设置 */
        saveDesktopSettings: function() {
            var self = this;
            var defaultSettings = {
                showWeatherNotification: true,
                iconTextColor: '#ffffff',
                statusBarColor: 'auto',
                wallpaperBrightness: 100,
                batteryColor: '#73AE52',
                phoneCase: {
                    type: 'gradient',
                    colors: ['#f6d3e0', '#b4d7f2'],
                    angle: 135
                }
            };
            return this.db.put('app_data', {
                appId: 'desktop_settings',
                settings: this.desktopSettings || defaultSettings
            }).then(function() {
                console.log('[DesktopSettings] Settings saved');
            });
        },
        
        /* 【加载桌面设置】 */
        loadDesktopSettings: function() {
            var self = this;
            var defaultSettings = {
                showWeatherNotification: true,
                iconTextColor: '#ffffff',
                statusBarColor: 'auto',
                wallpaperBrightness: 100,
                batteryColor: '#73AE52',
                phoneCase: {
                    type: 'gradient',
                    colors: ['#f6d3e0', '#b4d7f2'],
                    angle: 135
                }
            };
            return this.db.get('app_data', 'desktop_settings').then(function(data) {
                if (data && data.settings) {
                    // 合并默认设置确保新字段存在
                    self.desktopSettings = Object.assign({}, defaultSettings, data.settings);
                } else {
                    self.desktopSettings = defaultSettings;
                }
                self.applyDesktopSettings();
            }).catch(function() {
                self.desktopSettings = defaultSettings;
            });
        },
        
        /* ========== 通用数据存储功能 ========== */
        
        /* 【保存通用数据】
           将 PhoneCore.data 对象保存到 IndexedDB
           包含头像库(avatarLibrary)、背景库(backgroundLibrary)等数据 */
        save: function() {
            var self = this;
            return this.db.put('app_data', {
                appId: 'phone_core_data',
                data: this.data,
                updatedAt: Date.now()
            }).then(function() {
                console.log('[PhoneCore] Data saved');
            }).catch(function(err) {
                console.error('[PhoneCore] Failed to save data:', err);
            });
        },
        
        /* 【加载通用数据】
           从 IndexedDB 加载 PhoneCore.data 对象 */
        loadData: function() {
            var self = this;
            return this.db.get('app_data', 'phone_core_data').then(function(record) {
                if (record && record.data) {
                    self.data = record.data;
                    console.log('[PhoneCore] Data loaded');
                } else {
                    self.data = {};
                }
            }).catch(function(err) {
                console.error('[PhoneCore] Failed to load data:', err);
                self.data = {};
            });
        },
        
        loadWorlds: function() {
            var self = this;
            return this.db.getAll('worlds').then(function(worldsData) {
                worldsData.forEach(function(data) {
                    self.worlds[data.id] = new World(data);
                });
            });
        },
        
        saveWorld: function(world) {
            this.worlds[world.id] = world;
            return this.db.put('worlds', world.toJSON());
        },
        
        deleteWorld: function(worldId) {
            delete this.worlds[worldId];
            return this.db.delete('worlds', worldId);
        },
        
        getWorld: function(worldId) {
            return this.worlds[worldId] || null;
        },
        
        loadAIs: function() {
            var self = this;
            return this.db.getAll('ai_characters').then(function(aisData) {
                aisData.forEach(function(data) {
                    self.ais[data.id] = new AICharacter(data);
                });
            });
        },
        
        saveAI: function(ai) {
            this.ais[ai.id] = ai;
            return this.db.put('ai_characters', ai.toJSON());
        },
        
        deleteAI: function(aiId) {
            delete this.ais[aiId];
            return this.db.delete('ai_characters', aiId);
        },
        
        getAI: function(aiId) {
            return this.ais[aiId] || null;
        },
        
        getAIsByType: function(type) {
            var self = this;
            return Object.keys(this.ais).filter(function(id) {
                return self.ais[id].type === type;
            }).map(function(id) {
                return self.ais[id];
            });
        },
        
        getAIsByWorld: function(worldId) {
            var self = this;
            return Object.keys(this.ais).filter(function(id) {
                return self.ais[id].worldId === worldId;
            }).map(function(id) {
                return self.ais[id];
            });
        },
        
        // ===== 时间表管理 =====
        loadSchedules: function() {
            var self = this;
            return this.db.getAll('schedules').then(function(schedulesData) {
                schedulesData.forEach(function(data) {
                    self.schedules[data.id] = new Schedule(data);
                });
            });
        },
        
        saveSchedule: function(schedule) {
            this.schedules[schedule.id] = schedule;
            return this.db.put('schedules', schedule.toJSON());
        },
        
        deleteSchedule: function(scheduleId) {
            var schedule = this.schedules[scheduleId];
            
            // 解除所有绑定
            if (schedule && schedule.bindings) {
                var self = this;
                
                // 解除用户绑定
                if (this.user && this.user.realInfo.scheduleId === scheduleId) {
                    this.user.unbindSchedule();
                }
                
                // 解除面具绑定
                if (this.user && this.user.masks) {
                    Object.values(this.user.masks).forEach(function(mask) {
                        if (mask.scheduleId === scheduleId) {
                            self.user.unbindMaskSchedule(mask.id);
                        }
                    });
                }
                
                // 解除AI绑定
                Object.values(this.ais).forEach(function(ai) {
                    if (ai.scheduleId === scheduleId) {
                        ai.unbindSchedule();
                        self.saveAI(ai);
                    }
                });
            }
            
            delete this.schedules[scheduleId];
            return this.db.delete('schedules', scheduleId);
        },
        
        getSchedule: function(scheduleId) {
            return this.schedules[scheduleId] || null;
        },
        
        getAllSchedules: function() {
            return Object.values(this.schedules);
        },
        
        loadAPIConfigs: function() {
            var self = this;
            var configsToUpdate = [];
            return this.db.getAll('api_configs').then(function(configs) {
                configs.forEach(function(config) {
                    if (config.type === 'group') {
                        self.api.groups[config.id] = config;
                        self.api.currentConfigIndex[config.id] = 0;
                    } else {
                        // 补充旧配置可能缺失的默认值
                        var needsUpdate = false;
                        if (config.maxTokens === undefined) { config.maxTokens = 4096; needsUpdate = true; }
                        if (config.temperature === undefined) { config.temperature = 0.7; needsUpdate = true; }
                        if (config.topP === undefined) { config.topP = 1; needsUpdate = true; }
                        if (config.frequencyPenalty === undefined) { config.frequencyPenalty = 0; needsUpdate = true; }
                        if (config.presencePenalty === undefined) { config.presencePenalty = 0; needsUpdate = true; }
                        if (config.usageLimit === undefined) { config.usageLimit = 0; needsUpdate = true; }
                        if (config.retryCount === undefined) { config.retryCount = 3; needsUpdate = true; }
                        if (config.retryDelay === undefined) { config.retryDelay = 1000; needsUpdate = true; }
                        if (config.timeout === undefined) { config.timeout = 30000; needsUpdate = true; }
                        
                        // 如果有缺失的字段，标记需要更新
                        if (needsUpdate) {
                            configsToUpdate.push(config);
                        }
                        
                        self.api.configs[config.id] = config;
                        // 初始化统计数据结构（会在下面加载统计数据时覆盖）
                        self.api.usageCount[config.id] = self.api.usageCount[config.id] || 0;
                        self.api.tokensRecord[config.id] = self.api.tokensRecord[config.id] || 0;
                        self.api.tokensRecordDetail[config.id] = self.api.tokensRecordDetail[config.id] || { input: 0, output: 0 };
                        if (!self.api.stats.byConfig[config.id]) {
                            self.api.stats.byConfig[config.id] = { calls: 0, tokens: 0, errors: 0, lastUsed: null };
                        }
                        if (!self.api.healthStatus[config.id]) {
                            self.api.healthStatus[config.id] = { isHealthy: true, lastCheck: null, consecutiveErrors: 0 };
                        }
                        if (!self.api.errorHistory[config.id]) {
                            self.api.errorHistory[config.id] = [];
                        }
                    }
                });
            }).then(function() {
                // 加载持久化的API统计数据
                return self.db.get('app_data', 'api_stats');
            }).then(function(statsData) {
                if (statsData) {
                    // 恢复统计数据
                    if (statsData.tokensRecord) {
                        Object.keys(statsData.tokensRecord).forEach(function(configId) {
                            if (self.api.configs[configId]) {
                                self.api.tokensRecord[configId] = statsData.tokensRecord[configId];
                            }
                        });
                    }
                    // 恢复tokens详情（输入/输出分别统计，用于余额估算）
                    if (statsData.tokensRecordDetail) {
                        Object.keys(statsData.tokensRecordDetail).forEach(function(configId) {
                            if (self.api.configs[configId]) {
                                self.api.tokensRecordDetail[configId] = statsData.tokensRecordDetail[configId];
                            }
                        });
                    }
                    if (statsData.usageCount) {
                        Object.keys(statsData.usageCount).forEach(function(configId) {
                            if (self.api.configs[configId]) {
                                self.api.usageCount[configId] = statsData.usageCount[configId];
                            }
                        });
                    }
                    if (statsData.stats) {
                        if (statsData.stats.total) {
                            self.api.stats.total = statsData.stats.total;
                        }
                        if (statsData.stats.byConfig) {
                            Object.keys(statsData.stats.byConfig).forEach(function(configId) {
                                if (self.api.configs[configId]) {
                                    self.api.stats.byConfig[configId] = statsData.stats.byConfig[configId];
                                }
                            });
                        }
                        if (statsData.stats.byDate) {
                            self.api.stats.byDate = statsData.stats.byDate;
                        }
                        if (statsData.stats.byAI) {
                            self.api.stats.byAI = statsData.stats.byAI;
                        }
                    }
                }
            }).then(function() {
                // 保存需要补充默认值的旧配置
                if (configsToUpdate.length > 0) {
                    console.log('[PhoneCore] 更新 ' + configsToUpdate.length + ' 个旧API配置的默认值');
                    return Promise.all(configsToUpdate.map(function(config) {
                        return self.saveAPIConfig(config);
                    }));
                }
            });
        },
        
        saveAPIConfig: function(config) {
            return this.db.put('api_configs', config);
        },
        
        // 保存API统计数据
        saveAPIStats: function() {
            return this.db.put('app_data', {
                appId: 'api_stats',
                tokensRecord: this.api.tokensRecord,
                tokensRecordDetail: this.api.tokensRecordDetail,
                usageCount: this.api.usageCount,
                stats: {
                    total: this.api.stats.total,
                    byConfig: this.api.stats.byConfig,
                    byDate: this.api.stats.byDate,
                    byAI: this.api.stats.byAI
                },
                updatedAt: Date.now()
            });
        },
        
        deleteAPIConfig: function(configId) {
            this.api.removeConfig(configId);
            return this.db.delete('api_configs', configId);
        },
        
        registerApp: function(app) {
            this.apps[app.id] = app;
            
            /* 【注册AI可见信息】
               如果App声明了aiVisibility配置，自动注册到全局注册表
               这样system.js就能动态发现所有App的AI可见信息配置 */
            if (app.aiVisibility && app.aiVisibility.enabled !== false) {
                this.aiVisibilityRegistry[app.id] = {
                    id: app.id,
                    name: app.aiVisibility.name || app.name,
                    icon: app.aiVisibility.icon || '',
                    desc: app.aiVisibility.desc || 'AI可读取' + (app.aiVisibility.name || app.name) + '数据',
                    dataSources: app.aiVisibility.dataSources || []
                };
                EventBus.emit('aiVisibility:registered', { appId: app.id, config: this.aiVisibilityRegistry[app.id] });
            }
        },
        
        /* 【获取所有AI可见信息配置】
           供system.js等地方动态获取 */
        getAIVisibilityRegistry: function() {
            return this.aiVisibilityRegistry;
        },
        
        /* 【获取单个App的AI可见信息配置】 */
        getAppAIVisibility: function(appId) {
            return this.aiVisibilityRegistry[appId] || null;
        },
        
        getApp: function(appId) {
            return this.apps[appId] || null;
        },
        
        /* 【打开指定App】
           通过appId打开对应的应用
           @param appId {string} 应用ID，如 'sms-app', 'chat-app' 等
           @param options {object} 可选参数，如 { animate: false } */
        openApp: function(appId, options) {
            var app = this.apps[appId];
            if (!app) {
                console.warn('[PhoneCore] App not found:', appId);
                return false;
            }
            
            // 调用应用的open方法
            if (typeof app.open === 'function') {
                // 确保应用窗口显示在最前面
                // 将窗口移动到 appContainer 的最后位置
                if (app.appWindow && app.appWindow.parentNode) {
                    var container = document.getElementById('appContainer');
                    if (container) {
                        container.appendChild(app.appWindow);
                    }
                }
                
                app.open();
                EventBus.emit('app:opened', { appId: appId, app: app });
                return true;
            }
            
            console.warn('[PhoneCore] App has no open method:', appId);
            return false;
        },
        
        registerDefaultTriggers: function() {
            var self = this;
            
            this.triggers.register('ai_blocked', {
                event: 'ai:blocked',
                action: function(data) {
                    var ai = self.getAI(data.aiId);
                    if (ai) {
                        self.notifications.send({
                            type: 'system',
                            title: '已拉黑',
                            message: ai.name + ' 已被拉黑',
                            icon: '🚫',
                            size: 'mini'
                        });
                    }
                }
            });
            
            this.triggers.register('balance_low', {
                event: 'user:balance:changed',
                condition: function(data) {
                    return data.newBalance < 100 && data.delta < 0;
                },
                action: function(data) {
                    self.notifications.send({
                        type: 'warning',
                        title: '余额提醒',
                        message: '您的余额已不足100',
                        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>',
                        size: 'mini'
                    });
                }
            });
        },
        
        registerDefaultPrompts: function() {
            this.prompts.registerModule('base_role', 
                '你是一个AI角色，需要根据设定进行角色扮演。\n' +
                '请保持角色一致性，不要跳出角色设定。\n' +
                '回复时请自然、生动，像真实的人一样交流。'
            );
            
            this.prompts.registerModule('memory_instruction',
                '【记忆指令】\n' +
                '请记住与用户的重要互动。\n' +
                '如果用户提到之前聊过的内容，请尝试回忆。'
            );
            
            this.prompts.registerModule('emotion_expression',
                '【情感表达】\n' +
                '请根据对话内容表达适当的情感。\n' +
                '可以使用表情符号来增强表达。'
            );
            
            this.prompts.registerTemplate('chat_basic',
                '{{base_role}}\n\n' +
                '【角色信息】\n' +
                '{{character_info}}\n\n' +
                '【当前场景】\n' +
                '{{scene_info}}\n\n' +
                '请以角色身份回复用户的消息。'
            );
            
            this.prompts.registerTemplate('npc_generation',
                '请根据以下背景生成一个NPC角色：\n\n' +
                '世界观：{{world}}\n' +
                '场景：{{scene}}\n' +
                '关联角色：{{related_character}}\n\n' +
                '请以JSON格式返回角色信息。'
            );
        },
        
        exportData: function() {
            return this.db.export();
        },
        
        importData: function(jsonString) {
            var self = this;
            return this.db.import(jsonString).then(function() {
                return self.loadUserProfile();
            }).then(function() {
                return self.loadWorlds();
            }).then(function() {
                return self.loadAIs();
            }).then(function() {
                return self.loadAPIConfigs();
            }).then(function() {
                EventBus.emit('data:imported');
            });
        },
        
        /* 【清除所有数据】
           @param options.preserveActivities - 是否保留活动记录（默认true）
           @param options.preserveStores - 额外需要保留的store名称数组
           
           活动记录(activity_records)默认不清除，因为这些是用户与AI的珍贵互动历史 */
        clearAllData: function(options) {
            var self = this;
            options = options || {};
            
            /* 【受保护的数据表】这些表在正常清除时不会被删除 */
            var protectedStores = ['activity_records'];
            
            /* 【用户可以额外指定要保护的表】 */
            if (options.preserveStores && Array.isArray(options.preserveStores)) {
                protectedStores = protectedStores.concat(options.preserveStores);
            }
            
            /* 【用户可以选择不保护活动记录】显式设置preserveActivities=false时才清除 */
            if (options.preserveActivities === false) {
                protectedStores = protectedStores.filter(function(name) {
                    return name !== 'activity_records';
                });
            }
            
            var storeNames = Array.from(this.db.db.objectStoreNames);
            
            /* 【过滤掉受保护的表】 */
            var storesToClear = storeNames.filter(function(name) {
                return protectedStores.indexOf(name) === -1;
            });
            
            console.log('[PhoneCore] 清除数据，保护以下表:', protectedStores);
            console.log('[PhoneCore] 将清除以下表:', storesToClear);
            
            return Promise.all(storesToClear.map(function(name) {
                return self.db.clear(name);
            })).then(function() {
                self.worlds = {};
                self.ais = {};
                self.user = new UserProfile({ id: 'default_user' });
                EventBus.emit('data:cleared', { 
                    clearedStores: storesToClear,
                    protectedStores: protectedStores 
                });
            });
        },
        
        /* 【强制清除所有数据】包括活动记录，慎用！ */
        clearAllDataForce: function() {
            return this.clearAllData({ preserveActivities: false });
        },
        
        /* 【获取活动追踪器】便捷方法 */
        getActivityTracker: function() {
            return this.activities;
        },
        
        /* 【activity属性】便捷访问活动追踪器 */
        get activity() {
            return this.activities;
        }
    };

    // ============ 导出到全局 ============
    /* 全局导出 将核心类暴露到window对象，供其他脚本使用 */
    global.PhoneCore = PhoneCore;
    global.EventBus = EventBus;
    global.Database = Database;
    global.TimeSystem = TimeSystem;
    global.NotificationSystem = NotificationSystem;
    global.ResourceManager = ResourceManager;
    global.DesktopGrid = DesktopGrid;
    global.DesktopManager = DesktopManager;
    global.Widget = Widget;
    global.ShareCard = ShareCard;
    global.BadgeManager = BadgeManager;
    global.PromptFactory = PromptFactory;
    
    /* App基类统一的App构造函数，合并了原来的MyBaseApp和EnhancedApp */
    global.BaseApp = BaseApp;
    global.EnhancedApp = EnhancedApp; /* 兼容性别名 指向BaseApp */
    global.MyBaseApp = BaseApp; /* 兼容性别名 指向BaseApp，保持向后兼容 */
    
    /* 活动追踪系统 记录用户与AI的互动数据 */
    global.ActivityTracker = ActivityTracker;
    
    global.AICharacter = AICharacter;
    global.NPCAIGenerator = NPCAIGenerator;
    global.World = World;
    global.UserProfile = UserProfile;
    global.APIManager = APIManager;
    global.OfflineCompensator = OfflineCompensator;
    global.TransactionManager = TransactionManager;
    global.EventTriggerSystem = EventTriggerSystem;
    global.FeedbackSystem = FeedbackSystem;
    global.AppStackManager = AppStackManager;
    global.MemorySystem = MemorySystem;
    
    /* 时间表系统 */
    global.Schedule = Schedule;
    global.ScheduleWidgetRenderer = ScheduleWidgetRenderer;
    global.WEEKDAYS = WEEKDAYS;
    global.WEEKDAY_KEYS = WEEKDAY_KEYS;

})(window);

// ==================== 初始化入口 ====================
document.addEventListener('DOMContentLoaded', function() {
    PhoneCore.init().then(function() {
        console.log('系统就绪');
    }).catch(function(error) {
        console.error('系统初始化失败:', error);
    });
});
