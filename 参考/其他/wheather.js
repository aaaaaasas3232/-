
// ==================== weather-app.js ====================
// 天气应用 - 主页面 + 搜索 + 详情

(function(global) {
    'use strict';

    function WeatherApp() {
        EnhancedApp.call(this, {
            id: 'weather-app',
            name: '天气',
            color: 'linear-gradient(135deg, #4A90D9 0%, #67B8DE 100%)',
            barStyle: 'light',
            tabs: []
        });
        
        this.cities = [];
        this.primaryCity = null;
        this.weatherCache = {};
        this.npcWeatherGenerator = null;
    }

    WeatherApp.prototype = Object.create(EnhancedApp.prototype);
    WeatherApp.prototype.constructor = WeatherApp;

    // 渲染主页面
    WeatherApp.prototype.render = function() {
        var self = this;
        
        var win = document.createElement('div');
        win.className = 'app-window hidden';
        win.style.background = 'linear-gradient(135deg, #4A90D9 0%, #67B8DE 100%)';
        
        var html = '';
        html += '<div class="app-status-bar-gap"></div>';
        html += '<div class="app-content-page" id="main-content-area" style="padding:20px;">';
        html += this.renderMainContent();
        html += '</div>';
        html += '<div class="home-indicator" style="background-color:rgba(255,255,255,0.6);"></div>';
        html += '<div class="home-indicator-area"></div>';
        
        win.innerHTML = html;
        document.getElementById('appContainer').appendChild(win);
        this.appWindow = win;
        this.windowCache = true;
        
        this.bindHomeIndicatorEvents();
        this.bindMainEvents();
        
        // 加载保存的城市
        this.loadSavedCities();
    };

    WeatherApp.prototype.renderMainContent = function() {
        var html = '';
        
        // 搜索栏
html += '<div style="margin-bottom:20px;position:relative;z-index:100;">';
html += '<div style="display:flex;align-items:center;background:rgba(255,255,255,0.1);border-radius:14px;padding:12px 16px;backdrop-filter:blur(20px);min-height:48px;box-sizing:border-box;border:0.5px solid rgba(255,255,255,0.15);transition:all 0.2s ease;box-shadow:0 4px 12px rgba(0,0,0,0.08);">';
html += '<span style="color:rgba(255,255,255,0.8);margin-right:12px;flex-shrink:0;display:flex;align-items:center;justify-content:center;width:20px;height:20px;">';
html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
html += '</span>';
html += '<input type="text" id="search-city" style="flex:1;border:none;background:transparent;font-size:15px;outline:none;color:white;min-width:0;padding:0 6px;caret-color:rgba(255,255,255,0.9);font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;" placeholder-style="color:rgba(255,255,255,0.5);font-weight:400;">';
html += '<button id="search-btn" style="background:linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.15));border:none;padding:9px 18px;border-radius:10px;color:white;font-size:14px;cursor:pointer;flex-shrink:0;white-space:nowrap;font-weight:500;letter-spacing:0.2px;transition:all 0.2s ease;box-shadow:0 2px 8px rgba(0,0,0,0.1);">搜索</button>';
html += '</div>';
html += '</div>';
        
        // 城市列表
        html += '<div id="cities-container">';
        html += this.renderCitiesList();
        html += '</div>';
        
        // 添加城市提示
html += '<div id="add-city-hint" style="text-align:center;padding:30px;color:rgba(255,255,255,0.6);' + (this.cities.length > 0 ? 'display:none;' : '') + '">';
html += '<div style="font-size:48px;margin-bottom:15px;display:flex;justify-content:center;">';
html += '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 256 256" style="opacity:0.6;"><path d="M160,40A88.09,88.09,0,0,0,81.29,88.67,64,64,0,1,0,72,216h88a88,88,0,0,0,0-176Zm0,160H72a48,48,0,0,1,0-96c1.1,0,2.2,0,3.29.11A88,88,0,0,0,72,128a8,8,0,0,0,16,0,72,72,0,1,1,72,72Z"></path></svg>';
html += '</div>';
html += '<div>搜索并添加城市</div>';
html += '<div style="font-size:12px;margin-top:10px;">查看实时天气信息</div>';
html += '</div>';
        
        return html;
    };

    WeatherApp.prototype.renderCitiesList = function() {
        var self = this;
        var html = '';
        
        this.cities.forEach(function(city, index) {
            var weather = self.weatherCache[city.name] || {};
            var isPrimary = self.primaryCity === city.name;
            
            html += '<div class="weather-card" data-city="' + city.name + '" style="';
            html += 'background:' + self.getWeatherGradient(weather.condition) + ';';
            html += 'border-radius:20px;padding:20px;margin-bottom:15px;color:white;cursor:pointer;';
            html += 'box-shadow:0 4px 15px rgba(0,0,0,0.15);position:relative;overflow:hidden;';
            html += '">';
            
            // 背景图片（如果有）
            if (city.backgroundImage) {
                html += '<div style="position:absolute;top:0;left:0;right:0;bottom:0;background:url(' + city.backgroundImage + ') center/cover;opacity:0.3;"></div>';
            }
            
            html += '<div style="position:relative;z-index:1;">';
            
            // 顶部：城市名和主城市标识
            html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:15px;">';
            html += '<div>';
            html += '<div style="font-size:20px;font-weight:600;">' + city.name + '</div>';
            if (city.mappedName) {
                html += '<div style="font-size:12px;opacity:0.8;">(' + city.mappedName + ')</div>';
            }
            html += '<div style="font-size:13px;opacity:0.8;margin-top:3px;">' + (weather.description || '加载中...') + '</div>';
            html += '</div>';
            if (isPrimary) {
                html += '<div style="background:rgba(255,255,255,0.3);padding:4px 10px;border-radius:10px;font-size:11px;"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="#fff" viewBox="0 0 256 256" style="vertical-align:-1px;"><path d="M128,64a40,40,0,1,0,40,40A40,40,0,0,0,128,64Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,128Zm0-112a88.1,88.1,0,0,0-88,88c0,31.4,14.51,64.68,42,96.25a254.19,254.19,0,0,0,41.45,38.3,8,8,0,0,0,9.18,0A254.19,254.19,0,0,0,174,200.25c27.45-31.57,42-64.85,42-96.25A88.1,88.1,0,0,0,128,16Zm0,206c-16.53-13-72-60.75-72-118a72,72,0,0,1,144,0C200,161.23,144.53,209,128,222Z"></path></svg></div>';
            }
            html += '</div>';
            
            // 温度
            html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
            html += '<div style="font-size:56px;font-weight:300;">' + (weather.temperature !== undefined ? weather.temperature + '°' : '--') + '</div>';
            html += '<div style="text-align:right;">';
            html += '<div style="font-size:36px;">' + self.getWeatherIcon(weather.condition) + '</div>';
            html += '<div style="font-size:12px;opacity:0.8;margin-top:5px;">H:' + (weather.high || '--') + '° L:' + (weather.low || '--') + '°</div>';
            html += '</div>';
            html += '</div>';
            
            html += '</div>';
            html += '</div>';
        });
        
        return html;
    };

    WeatherApp.prototype.getWeatherGradient = function(condition) {
        var gradients = {
            'sunny': 'linear-gradient(135deg, #4A90D9 0%, #67B8DE 100%)',
            'cloudy': 'linear-gradient(135deg, #8E9EAB 0%, #B0BEC5 100%)',
            'rainy': 'linear-gradient(135deg, #5D6D7E 0%, #85929E 100%)',
            'stormy': 'linear-gradient(135deg, #2C3E50 0%, #4A5568 100%)',
            'snowy': 'linear-gradient(135deg, #E8EAF6 0%, #C5CAE9 100%)',
            'foggy': 'linear-gradient(135deg, #9E9E9E 0%, #BDBDBD 100%)',
            'night': 'linear-gradient(135deg, #1A237E 0%, #3949AB 100%)'
        };
        return gradients[condition] || gradients['sunny'];
    };

    WeatherApp.prototype.getWeatherIcon = function(condition) {
        var icons = {
            'sunny': '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 256 256"><defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="1" dy="1" stdDeviation="1.5" flood-color="rgba(0,0,0,0.3)" flood-opacity="0.8"/></filter></defs><path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z" fill="#ffffff" filter="url(#shadow)"/></svg>',
            'cloudy': '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 256 256"><defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="1" dy="1" stdDeviation="1.5" flood-color="rgba(0,0,0,0.3)" flood-opacity="0.8"/></filter></defs><path d="M160,40A88.09,88.09,0,0,0,81.29,88.67,64,64,0,1,0,72,216h88a88,88,0,0,0,0-176Zm0,160H72a48,48,0,0,1,0-96c1.1,0,2.2,0,3.29.11A88,88,0,0,0,72,128a8,8,0,0,0,16,0,72,72,0,1,1,72,72Z" fill="#ffffff" filter="url(#shadow)"/></svg>',
            'partly_cloudy': '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 256 256"><defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="1" dy="1" stdDeviation="1.5" flood-color="rgba(0,0,0,0.3)" flood-opacity="0.8"/></filter></defs><path d="M164,72a76.2,76.2,0,0,0-20.26,2.73,55.63,55.63,0,0,0-9.41-11.54l9.51-13.57a8,8,0,1,0-13.11-9.18L121.22,54A55.9,55.9,0,0,0,96,48c-.58,0-1.16,0-1.74,0L91.37,31.71a8,8,0,1,0-15.75,2.77L78.5,50.82A56.1,56.1,0,0,0,55.23,65.67L41.61,56.14a8,8,0,1,0-9.17,13.11L46,78.77A55.55,55.55,0,0,0,40,104c0,.57,0,1.15,0,1.72L23.71,108.6a8,8,0,0,0,1.38,15.88,8.24,8.24,0,0,0,1.39-.12l16.32-2.88a55.74,55.74,0,0,0,5.86,12.42A52,52,0,0,0,84,224h80a76,76,0,0,0,0-152ZM56,104a40,40,0,0,1,72.54-23.24,76.26,76.26,0,0,0-35.62,40,52.14,52.14,0,0,0-31,4.17A40,40,0,0,1,56,104ZM164,208H84a36,36,0,1,1,4.78-71.69c-.37,2.37-.63,4.79-.77,7.23a8,8,0,0,0,16,.92,58.91,58.91,0,0,1,1.88-11.81c0-.16.09-.32.12-.48A60.06,60.06,0,1,1,164,208Z" fill="#ffffff" filter="url(#shadow)"/></svg>',
            'rainy': '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 256 256"><defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="1" dy="1" stdDeviation="1.5" flood-color="rgba(0,0,0,0.3)" flood-opacity="0.8"/></filter></defs><path d="M158.66,196.44l-32,48a8,8,0,1,1-13.32-8.88l32-48a8,8,0,0,1,13.32,8.88ZM232,92a76.08,76.08,0,0,1-76,76H132.28l-29.62,44.44a8,8,0,1,1-13.32-8.88L113.05,168H76A52,52,0,0,1,76,64a53.26,53.26,0,0,1,8.92.76A76.08,76.08,0,0,1,232,92Zm-16,0A60.06,60.06,0,0,0,96,88.46a8,8,0,0,1-16-.92q.21-3.66.77-7.23A38.11,38.11,0,0,0,76,80a36,36,0,0,0,0,72h80A60.07,60.07,0,0,0,216,92Z" fill="#ffffff" filter="url(#shadow)"/></svg>',
            'stormy': '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 256 256"><defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="1" dy="1" stdDeviation="1.5" flood-color="rgba(0,0,0,0.3)" flood-opacity="0.8"/></filter></defs><path d="M156,16A76.2,76.2,0,0,0,84.92,64.76,53.26,53.26,0,0,0,76,64a52,52,0,0,0,0,104h37.87L97.14,195.88A8,8,0,0,0,104,208h25.87l-16.73,27.88a8,8,0,0,0,13.72,8.24l24-40A8,8,0,0,0,144,192H118.13l14.4-24H156a76,76,0,0,0,0-152Zm0,136H76a36,36,0,0,1,0-72,38.11,38.11,0,0,1,4.78.31q-.56,3.57-.77,7.23a8,8,0,0,0,16,.92A60.06,60.06,0,1,1,156,152Z" fill="#ffffff" filter="url(#shadow)"/></svg>',
            'snowy': '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 256 256"><defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="1" dy="1" stdDeviation="1.5" flood-color="rgba(0,0,0,0.3)" flood-opacity="0.8"/></filter></defs><path d="M223.77,150.09a8,8,0,0,1-5.86,9.68l-24.64,6,6.46,24.11a8,8,0,0,1-5.66,9.8A8.25,8.25,0,0,1,192,200a8,8,0,0,1-7.72-5.93l-7.72-28.8L136,141.86v46.83l21.66,21.65a8,8,0,0,1-11.32,11.32L128,203.31l-18.34,18.35a8,8,0,0,1-11.32-11.32L120,188.69V141.86L79.45,165.27l-7.72,28.8A8,8,0,0,1,64,200a8.25,8.25,0,0,1-2.08-.27,8,8,0,0,1-5.66-9.8l6.46-24.11-24.64-6a8,8,0,0,1,3.82-15.54l29.45,7.23L112,128,71.36,104.54l-29.45,7.23A7.85,7.85,0,0,1,40,112a8,8,0,0,1-1.91-15.77l24.64-6L56.27,66.07a8,8,0,0,1,15.46-4.14l7.72,28.8L120,114.14V67.31L98.34,45.66a8,8,0,0,1,11.32-11.32L128,52.69l18.34-18.35a8,8,0,0,1,11.32,11.32L136,67.31v46.83l40.55-23.41,7.72-28.8a8,8,0,0,1,15.46,4.14l-6.46,24.11,24.64,6A8,8,0,0,1,216,112a7.85,7.85,0,0,1-1.91-.23l-29.45-7.23L144,128l40.64,23.46,29.45-7.23A8,8,0,0,1,223.77,150.09Z" fill="#ffffff" filter="url(#shadow)"/></svg>',
            'foggy': '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 256 256"><defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="1" dy="1" stdDeviation="1.5" flood-color="rgba(0,0,0,0.3)" flood-opacity="0.8"/></filter></defs><path d="M120,208H72a8,8,0,0,1,0-16h48a8,8,0,0,1,0,16Zm64-16H160a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Zm-24,32H104a8,8,0,0,0,0,16h56a8,8,0,0,0,0-16Zm72-124a76.08,76.08,0,0,1-76,76H76A52,52,0,0,1,76,72a53.26,53.26,0,0,1,8.92.76A76.08,76.08,0,0,1,232,100Zm-16,0A60.06,60.06,0,0,0,96,96.46a8,8,0,0,1-16-.92q.21-3.66.77-7.23A38.11,38.11,0,0,0,76,88a36,36,0,0,0,0,72h80A60.07,60.07,0,0,0,216,100Z" fill="#ffffff" filter="url(#shadow)"/></svg>',
            'windy': '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 256 256"><defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="1" dy="1" stdDeviation="1.5" flood-color="rgba(0,0,0,0.3)" flood-opacity="0.8"/></filter></defs><path d="M184,184a32,32,0,0,1-32,32c-13.7,0-26.95-8.93-31.5-21.22a8,8,0,0,1,15-5.56C137.74,195.27,145,200,152,200a16,16,0,0,0,0-32H40a8,8,0,0,1,0-16H152A32,32,0,0,1,184,184Zm-64-80a32,32,0,0,0,0-64c-13.7,0-26.95,8.93-31.5,21.22a8,8,0,0,0,15,5.56C105.74,60.73,113,56,120,56a16,16,0,0,1,0,32H24a8,8,0,0,0,0,16Zm88-32c-13.7,0-26.95,8.93-31.5,21.22a8,8,0,0,0,15,5.56C193.74,92.73,201,88,208,88a16,16,0,0,1,0,32H32a8,8,0,0,0,0,16H208a32,32,0,0,0,0-64Z" fill="#ffffff" filter="url(#shadow)"/></svg>',
            'night': '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 256 256"><defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="1" dy="1" stdDeviation="1.5" flood-color="rgba(0,0,0,0.3)" flood-opacity="0.8"/></filter></defs><path d="M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-10,104.84,104.84,0,0,0-52.91,37A104,104,0,0,0,136,224a103.09,103.09,0,0,0,62.52-20.88,104.84,104.84,0,0,0,37-52.91A8,8,0,0,0,233.54,142.23ZM188.9,190.34A88,88,0,0,1,65.66,67.11a89,89,0,0,1,31.4-26A106,106,0,0,0,96,56,104.11,104.11,0,0,0,200,160a106,106,0,0,0,14.92-1.06A89,89,0,0,1,188.9,190.34Z" fill="#ffffff" filter="url(#shadow)"/></svg>',
            'night_cloudy': '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 256 256"><defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="1" dy="1" stdDeviation="1.5" flood-color="rgba(0,0,0,0.3)" flood-opacity="0.8"/></filter></defs><path d="M160,40A88.09,88.09,0,0,0,81.29,88.67,64,64,0,1,0,72,216h88a88,88,0,0,0,0-176Zm0,160H72a48,48,0,0,1,0-96c1.1,0,2.2,0,3.29.11A88,88,0,0,0,72,128a8,8,0,0,0,16,0,72,72,0,1,1,72,72Z" fill="#ffffff" filter="url(#shadow)"/></svg>'
        };
        return icons[condition] || '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 256 256"><defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="1" dy="1" stdDeviation="1.5" flood-color="rgba(0,0,0,0.3)" flood-opacity="0.8"/></filter></defs><path d="M164,72a76.2,76.2,0,0,0-20.26,2.73,55.63,55.63,0,0,0-9.41-11.54l9.51-13.57a8,8,0,1,0-13.11-9.18L121.22,54A55.9,55.9,0,0,0,96,48c-.58,0-1.16,0-1.74,0L91.37,31.71a8,8,0,1,0-15.75,2.77L78.5,50.82A56.1,56.1,0,0,0,55.23,65.67L41.61,56.14a8,8,0,1,0-9.17,13.11L46,78.77A55.55,55.55,0,0,0,40,104c0,.57,0,1.15,0,1.72L23.71,108.6a8,8,0,0,0,1.38,15.88,8.24,8.24,0,0,0,1.39-.12l16.32-2.88a55.74,55.74,0,0,0,5.86,12.42A52,52,0,0,0,84,224h80a76,76,0,0,0,0-152ZM56,104a40,40,0,0,1,72.54-23.24,76.26,76.26,0,0,0-35.62,40,52.14,52.14,0,0,0-31,4.17A40,40,0,0,1,56,104ZM164,208H84a36,36,0,1,1,4.78-71.69c-.37,2.37-.63,4.79-.77,7.23a8,8,0,0,0,16,.92,58.91,58.91,0,0,1,1.88-11.81c0-.16.09-.32.12-.48A60.06,60.06,0,1,1,164,208Z" fill="#ffffff" filter="url(#shadow)"/></svg>';
    };

    WeatherApp.prototype.bindMainEvents = function() {
        var self = this;
        var contentArea = this.appWindow.querySelector('#main-content-area');
        
        // 搜索按钮
        var searchBtn = contentArea.querySelector('#search-btn');
        var searchInput = contentArea.querySelector('#search-city');
        
        if (searchBtn && searchInput) {
            searchBtn.onclick = function() {
                var city = searchInput.value.trim();
                if (city) {
                    self.searchCity(city);
                }
            };
            
            searchInput.onkeypress = function(e) {
                if (e.key === 'Enter') {
                    var city = searchInput.value.trim();
                    if (city) {
                        self.searchCity(city);
                    }
                }
            };
        }
        
        // 城市卡片点击
        this.bindCityCardEvents();
    };

    WeatherApp.prototype.bindCityCardEvents = function() {
        var self = this;
        var cards = this.appWindow.querySelectorAll('.weather-card');
        
        cards.forEach(function(card) {
            card.onclick = function() {
                var cityName = card.getAttribute('data-city');
                self.openCityDetail(cityName);
            };
        });
    };

    // 搜索城市
    WeatherApp.prototype.searchCity = function(cityName) {
        var self = this;
        
        // 显示搜索结果
        var html = '<div style="padding:20px;">';
        html += '<div style="font-size:20px;font-weight:600;color:white;margin-bottom:20px;">搜索结果</div>';
        html += '<div id="search-results" style="color:white;">搜索中...</div>';
        html += '</div>';
        
        var page = this.openDetailPage(html, { background: 'linear-gradient(135deg, #4A90D9 0%, #67B8DE 100%)' });
        
        // 获取天气数据
        this.fetchWeather(cityName).then(function(weather) {
            var resultsContainer = page.querySelector('#search-results');
            
            if (weather) {
                var resultHtml = '';
                resultHtml += '<div class="search-result-card" style="background:rgba(255,255,255,0.15);border-radius:16px;padding:20px;backdrop-filter:blur(10px);">';
                resultHtml += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">';
                resultHtml += '<div>';
                resultHtml += '<div style="font-size:24px;font-weight:600;">' + cityName + '</div>';
                resultHtml += '<div style="font-size:14px;opacity:0.8;margin-top:5px;">' + weather.description + '</div>';
                resultHtml += '</div>';
                resultHtml += '<div style="font-size:48px;">' + self.getWeatherIcon(weather.condition) + '</div>';
                resultHtml += '</div>';
                
                resultHtml += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">';
                resultHtml += '<div style="font-size:48px;font-weight:300;">' + weather.temperature + '°</div>';
                resultHtml += '<div style="text-align:right;font-size:14px;">';
                resultHtml += '<div>最高 ' + weather.high + '°</div>';
                resultHtml += '<div>最低 ' + weather.low + '°</div>';
                resultHtml += '</div>';
                resultHtml += '</div>';
                
                // 更多信息
                resultHtml += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;">';
                resultHtml += '<div style="background:rgba(255,255,255,0.1);border-radius:10px;padding:12px;text-align:center;">';
                resultHtml += '<div style="font-size:11px;opacity:0.7;">湿度</div>';
                resultHtml += '<div style="font-size:16px;margin-top:5px;">' + (weather.humidity || '--') + '%</div>';
                resultHtml += '</div>';
                resultHtml += '<div style="background:rgba(255,255,255,0.1);border-radius:10px;padding:12px;text-align:center;">';
                resultHtml += '<div style="font-size:11px;opacity:0.7;">风速</div>';
                resultHtml += '<div style="font-size:16px;margin-top:5px;">' + (weather.wind || '--') + 'm/s</div>';
                resultHtml += '</div>';
                resultHtml += '<div style="background:rgba(255,255,255,0.1);border-radius:10px;padding:12px;text-align:center;">';
                resultHtml += '<div style="font-size:11px;opacity:0.7;">空气质量</div>';
                resultHtml += '<div style="font-size:16px;margin-top:5px;">' + (weather.aqi || '优') + '</div>';
                resultHtml += '</div>';
                resultHtml += '</div>';
                
                // 操作按钮
                resultHtml += '<div style="display:flex;gap:10px;">';
                resultHtml += '<button id="add-city-btn" style="flex:1;padding:15px;background:rgba(255,255,255,0.3);color:white;border:none;border-radius:12px;font-size:16px;cursor:pointer;">添加到列表</button>';
                resultHtml += '<button id="set-primary-btn" style="flex:1;padding:15px;background:white;color:#4A90D9;border:none;border-radius:12px;font-size:16px;cursor:pointer;">设为主城市</button>';
                resultHtml += '</div>';
                
                resultHtml += '</div>';
                
                // AI绑定选项
                resultHtml += '<div style="margin-top:20px;background:rgba(255,255,255,0.1);border-radius:16px;padding:15px;">';
                resultHtml += '<div style="font-size:14px;font-weight:500;margin-bottom:10px;">绑定到AI角色</div>';
                resultHtml += '<div style="font-size:12px;opacity:0.8;margin-bottom:15px;">将此城市的天气绑定给AI，AI会知道自己所在地的天气</div>';
                resultHtml += '<select id="bind-ai-select" style="width:100%;padding:12px;border:none;border-radius:10px;font-size:14px;background:rgba(255,255,255,0.2);color:white;">';
                resultHtml += '<option value="">选择AI角色</option>';
                
                Object.values(PhoneCore.ais).forEach(function(ai) {
                    resultHtml += '<option value="' + ai.id + '">' + ai.name + '</option>';
                });
                
                resultHtml += '</select>';
                resultHtml += '<button id="bind-ai-btn" style="width:100%;padding:12px;background:rgba(255,255,255,0.2);color:white;border:none;border-radius:10px;font-size:14px;cursor:pointer;margin-top:10px;">确认绑定</button>';
                resultHtml += '</div>';
                
                resultsContainer.innerHTML = resultHtml;
                
                // 缓存天气数据
                self.weatherCache[cityName] = weather;
                
                // 绑定按钮事件
                var addBtn = page.querySelector('#add-city-btn');
                if (addBtn) {
                    addBtn.onclick = function() {
                        self.addCity(cityName, weather);
                        page.querySelector('.app-back-btn').click();
                    };
                }
                
                var setPrimaryBtn = page.querySelector('#set-primary-btn');
                if (setPrimaryBtn) {
                    setPrimaryBtn.onclick = function() {
                        self.addCity(cityName, weather, true);
                        page.querySelector('.app-back-btn').click();
                    };
                }
                
                var bindAIBtn = page.querySelector('#bind-ai-btn');
                var bindAISelect = page.querySelector('#bind-ai-select');
                if (bindAIBtn && bindAISelect) {
                    bindAIBtn.onclick = function() {
                        var aiId = bindAISelect.value;
                        if (aiId) {
                            self.bindCityToAI(cityName, aiId);
                        } else {
                            alert('请选择AI角色');
                        }
                    };
                }
                
            } else {
                resultsContainer.innerHTML = '<div style="text-align:center;padding:30px;opacity:0.8;">未找到该城市的天气信息</div>';
            }
        });
    };

    // 获取天气数据（模拟）
    WeatherApp.prototype.fetchWeather = function(cityName) {
        var self = this;
        
        return new Promise(function(resolve) {
            // 模拟网络延迟
            setTimeout(function() {
                // 生成模拟天气数据
                var conditions = ['sunny', 'cloudy', 'partly_cloudy', 'rainy'];
                var condition = conditions[Math.floor(Math.random() * conditions.length)];
                var temp = Math.floor(Math.random() * 20) + 10;
                
                var weather = {
                    city: cityName,
                    temperature: temp,
                    high: temp + Math.floor(Math.random() * 5) + 2,
                    low: temp - Math.floor(Math.random() * 5) - 2,
                    condition: condition,
                    description: self.getConditionDescription(condition),
                    humidity: Math.floor(Math.random() * 40) + 40,
                    wind: (Math.random() * 5 + 1).toFixed(1),
                    aqi: ['优', '良', '轻度'][Math.floor(Math.random() * 3)],
                    forecast: self.generateForecast(),
                    hourly: self.generateHourlyForecast(),
                    updatedAt: Date.now()
                };
                
                resolve(weather);
            }, 800);
        });
    };

    WeatherApp.prototype.getConditionDescription = function(condition) {
        var descriptions = {
            'sunny': '晴朗',
            'cloudy': '多云',
            'partly_cloudy': '局部多云',
            'rainy': '有雨',
            'stormy': '雷暴',
            'snowy': '有雪',
            'foggy': '有雾',
            'windy': '大风'
        };
        return descriptions[condition] || '晴';
    };

    WeatherApp.prototype.generateForecast = function() {
        var forecast = [];
        var conditions = ['sunny', 'cloudy', 'partly_cloudy', 'rainy'];
        var days = ['今天', '明天', '后天', '周四', '周五', '周六', '周日'];
        
        for (var i = 0; i < 7; i++) {
            var condition = conditions[Math.floor(Math.random() * conditions.length)];
            var temp = Math.floor(Math.random() * 20) + 10;
            forecast.push({
                day: days[i],
                condition: condition,
                high: temp + Math.floor(Math.random() * 5) + 2,
                low: temp - Math.floor(Math.random() * 5) - 2
            });
        }
        
        return forecast;
    };

    WeatherApp.prototype.generateHourlyForecast = function() {
        var hourly = [];
        var conditions = ['sunny', 'cloudy', 'partly_cloudy'];
        var now = new Date();
        
        for (var i = 0; i < 24; i++) {
            var hour = (now.getHours() + i) % 24;
            var condition = conditions[Math.floor(Math.random() * conditions.length)];
            var temp = Math.floor(Math.random() * 10) + 15;
            
            hourly.push({
                hour: hour.toString().padStart(2, '0') + ':00',
                condition: condition,
                temperature: temp
            });
        }
        
        return hourly;
    };

    // 添加城市
    WeatherApp.prototype.addCity = function(cityName, weather, isPrimary) {
        var self = this;
        
        // 检查是否已存在
        var exists = this.cities.some(function(c) {
            return c.name === cityName;
        });
        
        if (!exists) {
            this.cities.push({
                name: cityName,
                addedAt: Date.now()
            });
        }
        
        if (isPrimary) {
            this.primaryCity = cityName;
        }
        
        // 缓存天气
        this.weatherCache[cityName] = weather;
        
        // 保存到数据库
        this.saveCities();
        
        // 刷新列表
        this.refreshCitiesList();
        
        PhoneCore.notifications.send({
            type: 'success',
            title: isPrimary ? '已设为主城市' : '添加成功',
            message: cityName + ' 已添加到列表',
            icon: '🌤️',
            duration: 2000
        });
    };

    // 保存城市列表
    WeatherApp.prototype.saveCities = function() {
        PhoneCore.db.put('app_data', {
            appId: 'weather-cities',
            cities: this.cities,
            primaryCity: this.primaryCity,
            weatherCache: this.weatherCache
        });
    };

    // 加载保存的城市
    WeatherApp.prototype.loadSavedCities = function() {
        var self = this;
        
        PhoneCore.db.get('app_data', 'weather-cities').then(function(data) {
            if (data) {
                self.cities = data.cities || [];
                self.primaryCity = data.primaryCity || null;
                self.weatherCache = data.weatherCache || {};
                
                // 刷新显示
                self.refreshCitiesList();
                
                // 更新天气数据
                self.cities.forEach(function(city) {
                    self.fetchWeather(city.name).then(function(weather) {
                        self.weatherCache[city.name] = weather;
                        self.saveCities();
                        self.refreshCitiesList();
                    });
                });
            }
        });
    };

    // 刷新城市列表
    WeatherApp.prototype.refreshCitiesList = function() {
        var container = this.appWindow.querySelector('#cities-container');
        var hint = this.appWindow.querySelector('#add-city-hint');
        
        if (container) {
            container.innerHTML = this.renderCitiesList();
            this.bindCityCardEvents();
        }
        
        if (hint) {
            hint.style.display = this.cities.length > 0 ? 'none' : 'block';
        }
    };

    // 城市详情页
    WeatherApp.prototype.openCityDetail = function(cityName) {
        var self = this;
        var city = this.cities.find(function(c) { return c.name === cityName; });
        var weather = this.weatherCache[cityName] || {};
        
        var html = '<div style="padding:0;color:white;">';
        
        // 主要天气信息
        html += '<div style="text-align:center;padding:30px 20px 20px;">';
        html += '<div style="font-size:24px;font-weight:500;margin-bottom:5px;">' + cityName + '</div>';
        html += '<div style="font-size:80px;font-weight:200;margin:10px 0;">' + (weather.temperature || '--') + '°</div>';
        html += '<div style="font-size:18px;opacity:0.9;">' + (weather.description || '') + '</div>';
        html += '<div style="font-size:14px;opacity:0.7;margin-top:5px;">最高 ' + (weather.high || '--') + '° 最低 ' + (weather.low || '--') + '°</div>';
        html += '</div>';
        
        // 小时预报
        html += '<div style="padding:20px 0;border-top:1px solid rgba(255,255,255,0.12);border-bottom:1px solid rgba(255,255,255,0.12);margin:0 20px;">';
html += '<div style="display:flex;overflow-x:auto;padding-bottom:16px;scrollbar-width:none;-ms-overflow-style:none;">'; // 隐藏滚动条
	html += '<style>.scroll-container::-webkit-scrollbar{display:none;}</style>'; // Webkit浏览器隐藏滚动条
        
        if (weather.hourly) {
            weather.hourly.slice(0, 12).forEach(function(hour) {
                html += '<div style="flex-shrink:0;width:60px;text-align:center;margin-right:10px;">';
                html += '<div style="font-size:13px;opacity:0.8;">' + hour.hour + '</div>';
                html += '<div style="font-size:24px;margin:8px 0;">' + self.getWeatherIcon(hour.condition) + '</div>';
                html += '<div style="font-size:15px;font-weight:500;">' + hour.temperature + '°</div>';
                html += '</div>';
            });
        }
        
        html += '</div>';
        html += '</div>';
        
        // 七天预报
        html += '<div style="padding:20px;margin:0 20px;background:rgba(255,255,255,0.1);border-radius:15px;margin-top:20px;">';
        html += '<div style="font-size:14px;font-weight:500;margin-bottom:15px;">7天预报</div>';
        
        if (weather.forecast) {
            weather.forecast.forEach(function(day, index) {
                html += '<div style="display:flex;align-items:center;padding:10px 0;' + (index < weather.forecast.length - 1 ? 'border-bottom:1px solid rgba(255,255,255,0.1);' : '') + '">';
                html += '<div style="width:60px;font-size:14px;">' + day.day + '</div>';
                html += '<div style="font-size:24px;margin:0 15px;">' + self.getWeatherIcon(day.condition) + '</div>';
                html += '<div style="flex:1;display:flex;align-items:center;">';
                html += '<span style="opacity:0.6;margin-right:10px;">' + day.low + '°</span>';
                html += '<div style="flex:1;height:4px;background:linear-gradient(to right, #67B8DE, #4A90D9);border-radius:2px;margin:0 5px;"></div>';
                html += '<span style="margin-left:10px;">' + day.high + '°</span>';
                html += '</div>';
                html += '</div>';
            });
        }
        
        html += '</div>';
        
        // 详细信息
        html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:15px;padding:20px;margin-top:10px;">';
        
        html += '<div style="background:rgba(255,255,255,0.1);border-radius:15px;padding:15px;">';
        html += '<div style="font-size:12px;opacity:0.7;">湿度</div>';
        html += '<div style="font-size:28px;font-weight:500;margin-top:8px;">' + (weather.humidity || '--') + '%</div>';
        html += '</div>';
        
        html += '<div style="background:rgba(255,255,255,0.1);border-radius:15px;padding:15px;">';
        html += '<div style="font-size:12px;opacity:0.7;">风速</div>';
        html += '<div style="font-size:28px;font-weight:500;margin-top:8px;">' + (weather.wind || '--') + '<span style="font-size:14px;"> m/s</span></div>';
        html += '</div>';
        
        html += '<div style="background:rgba(255,255,255,0.1);border-radius:15px;padding:15px;">';
        html += '<div style="font-size:12px;opacity:0.7;">空气质量</div>';
        html += '<div style="font-size:28px;font-weight:500;margin-top:8px;">' + (weather.aqi || '优') + '</div>';
        html += '</div>';
        
        html += '<div style="background:rgba(255,255,255,0.1);border-radius:15px;padding:15px;">';
        html += '<div style="font-size:12px;opacity:0.7;">紫外线</div>';
        html += '<div style="font-size:28px;font-weight:500;margin-top:8px;">中等</div>';
        html += '</div>';
        
        html += '</div>';
        
        // 操作按钮
        html += '<div style="padding:20px;display:flex;gap:10px;">';
        
        if (this.primaryCity !== cityName) {
            html += '<button id="set-primary-city-btn" style="flex:1;padding:15px;background:rgba(255,255,255,0.2);color:white;border:none;border-radius:12px;font-size:14px;cursor:pointer;">设为主城市</button>';
        }
        
        html += '<button id="remove-city-btn" style="flex:1;padding:15px;background:rgba(255,59,48,0.3);color:white;border:none;border-radius:12px;font-size:14px;cursor:pointer;">移除</button>';
        
        html += '</div>';
        
        // 背景图设置
        html += '<div style="padding:0 20px 20px;">';
        html += '<button id="set-bg-btn" style="width:100%;padding:12px;background:rgba(255,255,255,0.15);color:white;border:none;border-radius:10px;font-size:13px;cursor:pointer;">设置卡片背景图</button>';
        html += '</div>';
        
        html += '</div>';
        
        var page = this.openDetailPage(html, { background: this.getWeatherGradient(weather.condition) });
        
        // 设为主城市
        var setPrimaryBtn = page.querySelector('#set-primary-city-btn');
        if (setPrimaryBtn) {
            setPrimaryBtn.onclick = function() {
                self.primaryCity = cityName;
                self.saveCities();
                self.refreshCitiesList();
                
                PhoneCore.notifications.send({
                    type: 'success',
                    title: '设置成功',
                    message: cityName + ' 已设为主城市',
                    icon: '📍',
                    duration: 2000
                });
                
                page.querySelector('.app-back-btn').click();
            };
        }
        
        // 移除城市
        var removeBtn = page.querySelector('#remove-city-btn');
        if (removeBtn) {
            removeBtn.onclick = function() {
                if (confirm('确定移除 ' + cityName + '？')) {
                    self.cities = self.cities.filter(function(c) {
                        return c.name !== cityName;
                    });
                    
                    if (self.primaryCity === cityName) {
                        self.primaryCity = self.cities.length > 0 ? self.cities[0].name : null;
                    }
                    
                    delete self.weatherCache[cityName];
                    self.saveCities();
                    self.refreshCitiesList();
                    
                    page.querySelector('.app-back-btn').click();
                }
            };
        }
        
        // 设置背景图
        var setBgBtn = page.querySelector('#set-bg-btn');
        if (setBgBtn) {
            setBgBtn.onclick = function() {
                PhoneCore.resources.createImageInput(function(resource) {
                    var cityIndex = self.cities.findIndex(function(c) {
                        return c.name === cityName;
                    });
                    
                    if (cityIndex !== -1) {
                        self.cities[cityIndex].backgroundImage = resource.data;
                        self.saveCities();
                        self.refreshCitiesList();
                        
                        PhoneCore.notifications.send({
                            type: 'success',
                            title: '设置成功',
                            message: '背景图已更新',
                            icon: '🖼️',
                            duration: 2000
                        });
                    }
                });
            };
        }
    };

    // 绑定城市到AI
    WeatherApp.prototype.bindCityToAI = function(cityName, aiId) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        
        if (!ai) {
            alert('AI不存在');
            return;
        }
        
        // 询问是否需要映射名称
        var mappedName = prompt('为AI设置虚构地名（留空则使用真实城市名）：\n例如：AI所在的"云城"实际对应"' + cityName + '"的天气', '');
        
        // 保存城市映射到AI
        ai.weatherCity = {
            realCity: cityName,
            mappedName: (mappedName && mappedName.trim()) ? mappedName.trim() : null
        };
        PhoneCore.saveAI(ai);
        
        // 添加到天气app的城市列表（显示在主界面）
        var exists = this.cities.some(function(c) {
            return c.name === cityName;
        });
        
        if (!exists) {
            this.cities.push({
                name: cityName,
                mappedName: ai.weatherCity.mappedName,
                boundToAI: aiId,  // 标记绑定给了哪个AI
                addedAt: Date.now()
            });
        } else {
            // 如果城市已存在，更新绑定信息
            var cityIndex = this.cities.findIndex(function(c) {
                return c.name === cityName;
            });
            if (cityIndex !== -1) {
                this.cities[cityIndex].boundToAI = aiId;
                this.cities[cityIndex].mappedName = ai.weatherCity.mappedName;
            }
        }
        
        // 确保天气数据被缓存
        if (!this.weatherCache[cityName]) {
            this.fetchWeather(cityName).then(function(weather) {
                self.weatherCache[cityName] = weather;
                self.saveCities();
                self.refreshCitiesList();
            });
        } else {
            this.saveCities();
            this.refreshCitiesList();
        }
        
        if (ai.weatherCity.mappedName) {
            PhoneCore.notifications.send({
                type: 'success',
                title: '绑定成功',
                message: ai.name + ' 的"' + ai.weatherCity.mappedName + '"已绑定到' + cityName + '的天气',
                icon: '🌤️',
                duration: 3000
            });
        } else {
            PhoneCore.notifications.send({
                type: 'success',
                title: '绑定成功',
                message: ai.name + ' 已绑定到' + cityName + '的天气',
                icon: '🌤️',
                duration: 2000
            });
        }
    };

    // 获取AI的天气信息（供其他模块调用）
    WeatherApp.prototype.getWeatherForAI = function(aiId) {
        var ai = PhoneCore.getAI(aiId);
        if (!ai || !ai.weatherCity) {
            return null;
        }
        
        var realCity = ai.weatherCity.realCity;
        var weather = this.weatherCache[realCity];
        
        if (!weather) {
            return null;
        }
        
        // 如果有映射名称，替换城市名
        var result = Object.assign({}, weather);
        if (ai.weatherCity.mappedName) {
            result.displayCity = ai.weatherCity.mappedName;
        } else {
            result.displayCity = realCity;
        }
        
        return result;
    };

    // 获取近七天天气摘要（供AI prompt使用）
    WeatherApp.prototype.getWeatherSummaryForAI = function(aiId) {
        var weather = this.getWeatherForAI(aiId);
        if (!weather) {
            return '天气信息暂不可用';
        }
        
        var summary = weather.displayCity + '天气：';
        summary += '当前' + weather.description + '，' + weather.temperature + '°C，';
        summary += '湿度' + weather.humidity + '%。';
        
        if (weather.forecast && weather.forecast.length > 0) {
            summary += '未来几天：';
            weather.forecast.slice(0, 3).forEach(function(day) {
                summary += day.day + this.getConditionDescription(day.condition) + '(' + day.low + '-' + day.high + '°)，';
            }.bind(this));
        }
        
        return summary;
    };

    // NPC天气生成器（用于架空世界观）
    WeatherApp.prototype.initNPCWeatherGenerator = function(worldId) {
        var self = this;
        var world = PhoneCore.getWorld(worldId);
        
        if (!world) {
            return Promise.reject(new Error('世界观不存在'));
        }
        
        // 获取世界观中的地点
        var locations = Object.values(world.locations);
        
        if (locations.length === 0) {
            return Promise.reject(new Error('世界观中没有地点'));
        }
        
        // 显示配置界面
        return new Promise(function(resolve, reject) {
            var html = '<div style="padding:20px;color:white;">';
            html += '<div style="font-size:20px;font-weight:600;margin-bottom:10px;">配置天气系统</div>';
            html += '<div style="font-size:13px;opacity:0.8;margin-bottom:20px;">为"' + world.name + '"的地点配置天气规则</div>';
            
            html += '<div id="location-weather-configs">';
            
            locations.forEach(function(loc, index) {
                html += '<div class="location-config" style="background:rgba(255,255,255,0.1);border-radius:12px;padding:15px;margin-bottom:15px;">';
                html += '<div style="font-weight:500;margin-bottom:10px;">📍 ' + loc.name + '</div>';
                
                // 天气来源选择
                html += '<div style="margin-bottom:10px;">';
                html += '<label style="font-size:13px;opacity:0.8;">天气来源</label>';
                html += '<select class="weather-source" data-location-id="' + loc.id + '" style="width:100%;padding:10px;border:none;border-radius:8px;margin-top:5px;background:rgba(255,255,255,0.2);color:white;">';
                html += '<option value="real">绑定现实城市</option>';
                html += '<option value="custom">自定义规则</option>';
                html += '</select>';
                html += '</div>';
                
                // 现实城市输入
                html += '<div class="real-city-input" data-location-id="' + loc.id + '">';
                html += '<input type="text" class="real-city-name" data-location-id="' + loc.id + '" value="' + (loc.realCityMapping || '') + '" placeholder="输入现实城市名" style="width:100%;padding:10px;border:none;border-radius:8px;background:rgba(255,255,255,0.2);color:white;box-sizing:border-box;">';
                html += '</div>';
                
                // 自定义规则
                html += '<div class="custom-rule-input" data-location-id="' + loc.id + '" style="display:none;">';
                html += '<textarea class="custom-rule" data-location-id="' + loc.id + '" placeholder="描述天气规则，如：终年寒冷，经常下雪，温度在-20到5度之间" style="width:100%;padding:10px;border:none;border-radius:8px;background:rgba(255,255,255,0.2);color:white;min-height:60px;resize:none;box-sizing:border-box;"></textarea>';
                html += '</div>';
                
                html += '</div>';
            });
            
            html += '</div>';
            
            html += '<button id="save-weather-config" style="width:100%;padding:15px;background:rgba(255,255,255,0.3);color:white;border:none;border-radius:12px;font-size:16px;cursor:pointer;margin-top:10px;">保存配置</button>';
            
            html += '</div>';
            
            var page = self.openDetailPage(html, { background: 'linear-gradient(135deg, #4A90D9 0%, #67B8DE 100%)' });
            
            // 切换天气来源
            page.querySelectorAll('.weather-source').forEach(function(select) {
                select.onchange = function() {
                    var locId = select.getAttribute('data-location-id');
                    var realInput = page.querySelector('.real-city-input[data-location-id="' + locId + '"]');
                    var customInput = page.querySelector('.custom-rule-input[data-location-id="' + locId + '"]');
                    
                    if (select.value === 'real') {
                        realInput.style.display = 'block';
                        customInput.style.display = 'none';
                    } else {
                        realInput.style.display = 'none';
                        customInput.style.display = 'block';
                    }
                };
            });
            
            // 保存配置
            var saveBtn = page.querySelector('#save-weather-config');
            if (saveBtn) {
                saveBtn.onclick = function() {
                    var configs = {};
                    
                    locations.forEach(function(loc) {
                        var source = page.querySelector('.weather-source[data-location-id="' + loc.id + '"]').value;
                        
                        if (source === 'real') {
                            var realCity = page.querySelector('.real-city-name[data-location-id="' + loc.id + '"]').value.trim();
                            configs[loc.id] = {
                                type: 'real',
                                realCity: realCity
                            };
                            
                            // 更新世界观中的映射
                            world.setWeatherMapping(loc.id, realCity);
                        } else {
                            var rule = page.querySelector('.custom-rule[data-location-id="' + loc.id + '"]').value.trim();
                            configs[loc.id] = {
                                type: 'custom',
                                rule: rule
                            };
                        }
                    });
                    
                    // 保存世界观
                    PhoneCore.saveWorld(world);
                    
                    // 保存天气配置
                    PhoneCore.db.put('app_data', {
                        appId: 'weather-world-config-' + worldId,
                        configs: configs
                    });
                    
                    PhoneCore.notifications.send({
                        type: 'success',
                        title: '配置成功',
                        message: '天气系统已配置',
                        icon: '🌤️',
                        duration: 2000
                    });
                    
                    page.querySelector('.app-back-btn').click();
                    resolve(configs);
                };
            }
        });
    };

    // 根据自定义规则生成天气
    WeatherApp.prototype.generateCustomWeather = function(rule) {
        // 简单的规则解析
        var weather = {
            temperature: 20,
            high: 25,
            low: 15,
            condition: 'sunny',
            description: '晴朗',
            humidity: 50,
            wind: 3
        };
        
        // 解析温度
        var tempMatch = rule.match(/(-?\d+).*?(-?\d+).*?度/);
        if (tempMatch) {
            var low = parseInt(tempMatch[1]);
            var high = parseInt(tempMatch[2]);
            weather.low = Math.min(low, high);
            weather.high = Math.max(low, high);
            weather.temperature = Math.floor((weather.low + weather.high) / 2 + (Math.random() - 0.5) * 10);
        }
        
        // 解析天气状况
        if (rule.includes('雪') || rule.includes('寒冷')) {
            weather.condition = 'snowy';
            weather.description = '有雪';
        } else if (rule.includes('雨')) {
            weather.condition = 'rainy';
            weather.description = '有雨';
        } else if (rule.includes('云') || rule.includes('阴')) {
            weather.condition = 'cloudy';
            weather.description = '多云';
        } else if (rule.includes('热') || rule.includes('炎热')) {
            weather.condition = 'sunny';
            weather.description = '晴热';
        }
        
        return weather;
    };

    // 小组件
    WeatherApp.prototype.createWeatherWidget = function(size) {
        var self = this;
        var widget = this.createWidget(size, function() {
            var cityName = self.primaryCity || (self.cities.length > 0 ? self.cities[0].name : null);
            var weather = cityName ? self.weatherCache[cityName] : null;
            
            if (!weather) {
                return '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;">暂无天气数据</div>';
            }
            
            if (size === 'small') {
                return '<div style="display:flex;align-items:center;justify-content:space-between;height:100%;padding:10px 15px;background:linear-gradient(135deg,#4A90D9,#67B8DE);color:white;border-radius:inherit;">' +
                    '<div>' +
                        '<div style="font-size:12px;opacity:0.8;">' + cityName + '</div>' +
                        '<div style="font-size:24px;font-weight:500;">' + weather.temperature + '°</div>' +
                    '</div>' +
                    '<div style="font-size:28px;">' + self.getWeatherIcon(weather.condition) + '</div>' +
                '</div>';
            }
            
            if (size === 'medium') {
                return '<div style="height:100%;padding:15px;background:linear-gradient(135deg,#4A90D9,#67B8DE);color:white;border-radius:inherit;">' +
                    '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
                        '<div>' +
                            '<div style="font-size:14px;font-weight:500;">' + cityName + '</div>' +
                            '<div style="font-size:11px;opacity:0.8;">' + weather.description + '</div>' +
                        '</div>' +
                        '<div style="font-size:32px;">' + self.getWeatherIcon(weather.condition) + '</div>' +
                    '</div>' +
                    '<div style="font-size:40px;font-weight:300;margin:10px 0;">' + weather.temperature + '°</div>' +
                    '<div style="font-size:11px;opacity:0.8;">H:' + weather.high + '° L:' + weather.low + '°</div>' +
                '</div>';
            }
            
            // large
            var forecastHtml = '';
            if (weather.forecast) {
                weather.forecast.slice(0, 5).forEach(function(day) {
                    forecastHtml += '<div style="text-align:center;">' +
                        '<div style="font-size:11px;opacity:0.8;">' + day.day + '</div>' +
                        '<div style="font-size:20px;margin:5px 0;">' + self.getWeatherIcon(day.condition) + '</div>' +
                        '<div style="font-size:12px;">' + day.high + '°</div>' +
                        '<div style="font-size:11px;opacity:0.7;">' + day.low + '°</div>' +
                    '</div>';
                });
            }
            
            return '<div style="height:100%;padding:15px;background:linear-gradient(135deg,#4A90D9,#67B8DE);color:white;border-radius:inherit;">' +
                '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:15px;">' +
                    '<div>' +
                        '<div style="font-size:16px;font-weight:500;">' + cityName + '</div>' +
                        '<div style="font-size:12px;opacity:0.8;">' + weather.description + '</div>' +
                        '<div style="font-size:36px;font-weight:300;margin-top:5px;">' + weather.temperature + '°</div>' +
                    '</div>' +
                    '<div style="font-size:48px;">' + self.getWeatherIcon(weather.condition) + '</div>' +
                '</div>' +
                '<div style="display:flex;justify-content:space-between;padding-top:15px;border-top:1px solid rgba(255,255,255,0.2);">' +
                    forecastHtml +
                '</div>' +
            '</div>';
        });
        
        return widget;
    };

    // 导出
    global.WeatherApp = WeatherApp;

    // 自动初始化
    EventBus.on('core:initialized', function() {
        var weatherApp = new WeatherApp();
        PhoneCore.registerApp(weatherApp);
        
        // 预加载保存的城市数据，第二次打开网页时显示主城市天气
        PhoneCore.db.get('app_data', 'weather-cities').then(function(data) {
            if (data) {
                weatherApp.cities = data.cities || [];
                weatherApp.primaryCity = data.primaryCity || null;
                weatherApp.weatherCache = data.weatherCache || {};
                
                // 如果有主城市，显示天气通知
                if (weatherApp.primaryCity) {
                    var cachedWeather = weatherApp.weatherCache[weatherApp.primaryCity];
                    
                    // 先显示缓存的天气（如果有）
                    if (cachedWeather) {
                        setTimeout(function() {
                            // 检查是否启用了天气通知
                            var desktopSettings = PhoneCore.desktopSettings || {};
                            if (desktopSettings.showWeatherNotification !== false) {
                                PhoneCore.notifications.send({
                                    type: 'info',
                                    title: weatherApp.primaryCity,
                                    message: cachedWeather.description + ' ' + cachedWeather.temperature + '°C，最高' + cachedWeather.high + '° 最低' + cachedWeather.low + '°',
                                    icon: '🌤️',
                                    size: 'mini',
                                    duration: 4000
                                });
                            }
                        }, 1500); // 延迟显示，等待页面加载完成
                    }
                    
                    // 更新主城市天气数据
                    weatherApp.fetchWeather(weatherApp.primaryCity).then(function(newWeather) {
                        weatherApp.weatherCache[weatherApp.primaryCity] = newWeather;
                        weatherApp.saveCities();
                        
                        // 如果没有缓存，显示更新后的天气
                        if (!cachedWeather) {
                            // 检查是否启用了天气通知
                            var desktopSettings = PhoneCore.desktopSettings || {};
                            if (desktopSettings.showWeatherNotification !== false) {
                                PhoneCore.notifications.send({
                                    type: 'info',
                                    title: weatherApp.primaryCity,
                                    message: newWeather.description + ' ' + newWeather.temperature + '°C，最高' + newWeather.high + '° 最低' + newWeather.low + '°',
                                    icon: '🌤️',
                                    size: 'mini',
                                    duration: 4000
                                });
                            }
                        }
                    });
                }
            }
        });
        
        // 注册到全局供AI调用
        global.getWeatherForAI = function(aiId) {
            return weatherApp.getWeatherForAI(aiId);
        };
        
        global.getWeatherSummaryForAI = function(aiId) {
            return weatherApp.getWeatherSummaryForAI(aiId);
        };
    });

})(window);
