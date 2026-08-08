/**
 * 天气 App - 主页面 + 搜索 + 详情
 *
 * 从 参考/wheather.js（旧 IIFE + 直接 DOM 操作版本）迁移到本项目框架。
 *
 * 设计要点：
 *  - renderMode: 'template'（简单 v-html 即可）
 *  - pages: home（搜索+列表） + search-result / city-detail（detail 页）
 *  - state: 城市列表 / 天气缓存 / loading 状态
 *  - methods: 走 data-app-action 调用，不直接绑 DOM 事件
 *  - 数据持久化：toolkit.db.put('weatherCities', { id, cities, weatherCache })
 *  - widget：3 种尺寸渲染当前第一个已添加城市的天气
 *  - topbar.bg 留 transparent（避框架 Bug #1 视觉断层）
 */

import { createActionAttr } from '@/src/core/actions.js';
import { escapeHtml } from '@/src/core/escape.js';

// =========================================================================
// 天气条件配置
// =========================================================================
const CONDITIONS = ['sunny', 'cloudy', 'partly_cloudy', 'rainy'];
const CONDITION_DESC = {
    sunny: '晴朗',
    cloudy: '多云',
    partly_cloudy: '局部多云',
    rainy: '有雨',
    stormy: '雷暴',
    snowy: '有雪',
    foggy: '有雾',
    windy: '大风',
};

const GRADIENTS = {
    sunny: 'linear-gradient(135deg, #4A90D9 0%, #67B8DE 100%)',
    cloudy: 'linear-gradient(135deg, #8E9EAB 0%, #B0BEC5 100%)',
    partly_cloudy: 'linear-gradient(135deg, #5B86C5 0%, #36D1DC 100%)',
    rainy: 'linear-gradient(135deg, #5D6D7E 0%, #85929E 100%)',
    stormy: 'linear-gradient(135deg, #2C3E50 0%, #4A5568 100%)',
    snowy: 'linear-gradient(135deg, #E8EAF6 0%, #C5CAE9 100%)',
    foggy: 'linear-gradient(135deg, #9E9E9E 0%, #BDBDBD 100%)',
    night: 'linear-gradient(135deg, #1A237E 0%, #3949AB 100%)',
};

const DAY_LABELS = ['今天', '明天', '后天', '周四', '周五', '周六', '周日'];

// =========================================================================
// 天气图标（Phosphor 风格 SVG，开发者手写固定 SVG，不需 escape）
// =========================================================================
const WEATHER_ICONS = {
    sunny: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z" fill="#ffffff"/></svg>',
    cloudy: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path d="M160,40A88.09,88.09,0,0,0,81.29,88.67,64,64,0,1,0,72,216h88a88,88,0,0,0,0-176Zm0,160H72a48,48,0,0,1,0-96c1.1,0,2.2,0,3.29.11A88,88,0,0,0,72,128a8,8,0,0,0,16,0,72,72,0,1,1,72,72Z" fill="#ffffff"/></svg>',
    partly_cloudy: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path d="M164,72a76.2,76.2,0,0,0-20.26,2.73,55.63,55.63,0,0,0-9.41-11.54l9.51-13.57a8,8,0,1,0-13.11-9.18L121.22,54A55.9,55.9,0,0,0,96,48c-.58,0-1.16,0-1.74,0L91.37,31.71a8,8,0,1,0-15.75,2.77L78.5,50.82A56.1,56.1,0,0,0,55.23,65.67L41.61,56.14a8,8,0,1,0-9.17,13.11L46,78.77A55.55,55.55,0,0,0,40,104c0,.57,0,1.15,0,1.72L23.71,108.6a8,8,0,0,0,1.38,15.88,8.24,8.24,0,0,0,1.39-.12l16.32-2.88a55.74,55.74,0,0,0,5.86,12.42A52,52,0,0,0,84,224h80a76,76,0,0,0,0-152ZM56,104a40,40,0,0,1,72.54-23.24,76.26,76.26,0,0,0-35.62,40,52.14,52.14,0,0,0-31,4.17A40,40,0,0,1,56,104ZM164,208H84a36,36,0,1,1,4.78-71.69c-.37,2.37-.63,4.79-.77,7.23a8,8,0,0,0,16,.92,58.91,58.91,0,0,1,1.88-11.81c0-.16.09-.32.12-.48A60.06,60.06,0,1,1,164,208Z" fill="#ffffff"/></svg>',
    rainy: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path d="M158.66,196.44l-32,48a8,8,0,1,1-13.32-8.88l32-48a8,8,0,0,1,13.32,8.88ZM232,92a76.08,76.08,0,0,1-76,76H132.28l-29.62,44.44a8,8,0,1,1-13.32-8.88L113.05,168H76A52,52,0,0,1,76,64a53.26,53.26,0,0,1,8.92.76A76.08,76.08,0,0,1,232,92Zm-16,0A60.06,60.06,0,0,0,96,88.46a8,8,0,0,1-16-.92q.21-3.66.77-7.23A38.11,38.11,0,0,0,76,80a36,36,0,0,0,0,72h80A60.07,60.07,0,0,0,216,92Z" fill="#ffffff"/></svg>',
    stormy: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path d="M156,16A76.2,76.2,0,0,0,84.92,64.76,53.26,53.26,0,0,0,76,64a52,52,0,0,0,0,104h37.87L97.14,195.88A8,8,0,0,0,104,208h25.87l-16.73,27.88a8,8,0,0,0,13.72,8.24l24-40A8,8,0,0,0,144,192H118.13l14.4-24H156a76,76,0,0,0,0-152Zm0,136H76a36,36,0,0,1,0-72,38.11,38.11,0,0,1,4.78.31q-.56,3.57-.77,7.23a8,8,0,0,0,16,.92A60.06,60.06,0,1,1,156,152Z" fill="#ffffff"/></svg>',
    snowy: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path d="M223.77,150.09a8,8,0,0,1-5.86,9.68l-24.64,6,6.46,24.11a8,8,0,0,1-5.66,9.8A8.25,8.25,0,0,1,192,200a8,8,0,0,1-7.72-5.93l-7.72-28.8L136,141.86v46.83l21.66,21.65a8,8,0,0,1-11.32,11.32L128,203.31l-18.34,18.35a8,8,0,0,1-11.32-11.32L120,188.69V141.86L79.45,165.27l-7.72,28.8A8,8,0,0,1,64,200a8.25,8.25,0,0,1-2.08-.27,8,8,0,0,1-5.66-9.8l6.46-24.11-24.64-6a8,8,0,0,1,3.82-15.54l29.45,7.23L112,128,71.36,104.54l-29.45,7.23A7.85,7.85,0,0,1,40,112a8,8,0,0,1-1.91-15.77l24.64-6L56.27,66.07a8,8,0,0,1,15.46-4.14l7.72,28.8L120,114.14V67.31L98.34,45.66a8,8,0,0,1,11.32-11.32L128,52.69l18.34-18.35a8,8,0,0,1,11.32,11.32L136,67.31v46.83l40.55-23.41,7.72-28.8a8,8,0,0,1,15.46,4.14l-6.46,24.11,24.64,6A8,8,0,0,1,216,112a7.85,7.85,0,0,1-1.91-.23l-29.45-7.23L144,128l40.64,23.46,29.45-7.23A8,8,0,0,1,223.77,150.09Z" fill="#ffffff"/></svg>',
    foggy: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path d="M120,208H72a8,8,0,0,1,0-16h48a8,8,0,0,1,0,16Zm64-16H160a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Zm-24,32H104a8,8,0,0,0,0,16h56a8,8,0,0,0,0-16Zm72-124a76.08,76.08,0,0,1-76,76H76A52,52,0,0,1,76,72a53.26,53.26,0,0,1,8.92.76A76.08,76.08,0,0,1,232,100Zm-16,0A60.06,60.06,0,0,0,96,96.46a8,8,0,0,1-16-.92q.21-3.66.77-7.23A38.11,38.11,0,0,0,76,88a36,36,0,0,0,0,72h80A60.07,60.07,0,0,0,216,100Z" fill="#ffffff"/></svg>',
    windy: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path d="M184,184a32,32,0,0,1-32,32c-13.7,0-26.95-8.93-31.5-21.22a8,8,0,0,1,15-5.56C137.74,195.27,145,200,152,200a16,16,0,0,0,0-32H40a8,8,0,0,1,0-16H152A32,32,0,0,1,184,184Zm-64-80a32,32,0,0,0,0-64c-13.7,0-26.95,8.93-31.5,21.22a8,8,0,0,0,15,5.56C105.74,60.73,113,56,120,56a16,16,0,0,1,0,32H24a8,8,0,0,0,0,16Zm88-32c-13.7,0-26.95,8.93-31.5,21.22a8,8,0,0,0,15,5.56C193.74,92.73,201,88,208,88a16,16,0,0,1,0,32H32a8,8,0,0,0,0,16H208a32,32,0,0,0,0-64Z" fill="#ffffff"/></svg>',
    night: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path d="M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-10,104.84,104.84,0,0,0-52.91,37A104,104,0,0,0,136,224a103.09,103.09,0,0,0,62.52-20.88,104.84,104.84,0,0,0,37-52.91A8,8,0,0,0,233.54,142.23ZM188.9,190.34A88,88,0,0,1,65.66,67.11a89,89,0,0,1,31.4-26A106,106,0,0,0,96,56,104.11,104.11,0,0,0,200,160a106,106,0,0,0,14.92-1.06A89,89,0,0,1,188.9,190.34Z" fill="#ffffff"/></svg>',
    night_cloudy: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path d="M160,40A88.09,88.09,0,0,0,81.29,88.67,64,64,0,1,0,72,216h88a88,88,0,0,0,0-176Zm0,160H72a48,48,0,0,1,0-96c1.1,0,2.2,0,3.29.11A88,88,0,0,0,72,128a8,8,0,0,0,16,0,72,72,0,1,1,72,72Z" fill="#ffffff"/></svg>',
};

function getWeatherIcon(condition) {
    return WEATHER_ICONS[condition] || WEATHER_ICONS.partly_cloudy;
}

function getWeatherGradient(condition) {
    return GRADIENTS[condition] || GRADIENTS.sunny;
}

// =========================================================================
// 模拟天气生成（fetchWeather → 返回 Promise<weatherObj>）
// =========================================================================
function generateForecast() {
    const out = [];
    for (let i = 0; i < 7; i++) {
        const cond = CONDITIONS[Math.floor(Math.random() * CONDITIONS.length)];
        const temp = Math.floor(Math.random() * 20) + 10;
        out.push({
            day: DAY_LABELS[i],
            condition: cond,
            high: temp + Math.floor(Math.random() * 5) + 2,
            low: temp - Math.floor(Math.random() * 5) - 2,
        });
    }
    return out;
}

function generateHourlyForecast() {
    const out = [];
    const conds = ['sunny', 'cloudy', 'partly_cloudy'];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
        const hour = (now.getHours() + i) % 24;
        out.push({
            hour: String(hour).padStart(2, '0') + ':00',
            condition: conds[Math.floor(Math.random() * conds.length)],
            temperature: Math.floor(Math.random() * 10) + 15,
        });
    }
    return out;
}

function fetchWeather(cityName) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const condition = CONDITIONS[Math.floor(Math.random() * CONDITIONS.length)];
            const temp = Math.floor(Math.random() * 20) + 10;
            resolve({
                city: cityName,
                temperature: temp,
                high: temp + Math.floor(Math.random() * 5) + 2,
                low: temp - Math.floor(Math.random() * 5) - 2,
                condition,
                description: CONDITION_DESC[condition] || '晴',
                humidity: Math.floor(Math.random() * 40) + 40,
                wind: (Math.random() * 5 + 1).toFixed(1),
                aqi: ['优', '良', '轻度'][Math.floor(Math.random() * 3)],
                uv: ['弱', '中等', '强'][Math.floor(Math.random() * 3)],
                forecast: generateForecast(),
                hourly: generateHourlyForecast(),
                updatedAt: Date.now(),
            });
        }, 800);
    });
}

// =========================================================================
// 工具：从 state 拿只读快照
// =========================================================================
function snapshot(state) {
    return {
        cities: Array.isArray(state.cities) ? state.cities.slice() : [],
        weatherCache: state.weatherCache || {},
        loadingCity: state.loadingCity || '',
    };
}

function readPersistedWeatherState() {
    try {
        const raw = window.localStorage?.getItem('weather-app::cities-v1');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
        return null;
    }
}

function findCity(state, cityName) {
    return (state.cities || []).find((c) => c && c.name === cityName) || null;
}

// =========================================================================
// 模块顶层渲染函数（renderPage 内只能 dispatch 到这里）
// =========================================================================

// 搜索栏 + 城市列表 + 空状态
function renderHomePage(app) {
    const state = app.state;
    const citiesHtml = (state.cities || []).map((city) => renderCityCard(city, state, app)).join('');
    const emptyHtml = (state.cities || []).length === 0 ? renderEmptyHint() : '';
    return `
        <div class="weather-app" style="padding:16px 14px 18px;">
            ${renderSearchBar(app)}
            <div class="wth-cities" id="wth-cities-container">${citiesHtml}</div>
            ${emptyHtml}
        </div>
    `;
}

function renderSearchBar(app) {
    const attr = createActionAttr({ action: 'appMethod', method: 'searchCity' }, app.id);
    return `
        <div class="wth-search">
            <div class="wth-search-bar">
                <span class="wth-search-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </span>
                <input id="wth-search-city" type="text" class="wth-search-input" placeholder="搜索城市，例如：北京" />
                <button id="wth-search-btn" class="wth-search-btn" ${attr}>搜索</button>
            </div>
        </div>
    `;
}

function renderCityCard(city, state, app) {
    const w = state.weatherCache[city.name] || {};
    const temp = w.temperature;
    // v0.27：显示名优先用 mappedName（地点编辑器映射后替换城市名），
    // city.name 保留为内部索引（weatherCache key / openCityDetail payload）。
    const displayName = city.mappedName || city.name;
    // 先调 setDetailCity 把 detailCity 写进 state，再推 city-detail 页
    const attr = createActionAttr({
        action: 'appMethod',
        method: 'openCityDetail',
        payload: { cityName: city.name },
    }, app.id);
    return `
        <div class="wth-card" style="background:${getWeatherGradient(w.condition)};" ${attr} data-city="${escapeHtml(city.name)}">
            ${city.backgroundImage ? `<div class="wth-card-bg" style="background-image:url('${escapeHtml(city.backgroundImage)}');"></div>` : ''}
            <div class="wth-card-body">
                <div class="wth-card-head">
                    <div>
                        <div class="wth-card-name">${escapeHtml(displayName)}</div>
                        <div class="wth-card-desc">${escapeHtml(w.description || '加载中...')}</div>
                    </div>
                </div>
                <div class="wth-card-temp">
                    <div class="${temp !== undefined ? 'wth-temp' : 'wth-temp-loading'}">${temp !== undefined ? temp + '°' : '--'}</div>
                    <div class="wth-temp-icon">${getWeatherIcon(w.condition)}</div>
                </div>
            </div>
        </div>
    `;
}

function renderEmptyHint() {
    return `
        <div class="wth-empty">
            <div class="wth-empty-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 256 256"><path d="M160,40A88.09,88.09,0,0,0,81.29,88.67,64,64,0,1,0,72,216h88a88,88,0,0,0,0-176Zm0,160H72a48,48,0,0,1,0-96c1.1,0,2.2,0,3.29.11A88,88,0,0,0,72,128a8,8,0,0,0,16,0,72,72,0,1,1,72,72Z"></path></svg>
            </div>
            <div class="wth-empty-text">搜索并添加城市</div>
            <div class="wth-empty-sub">查看实时天气信息</div>
        </div>
    `;
}

// 搜索结果页
function renderSearchResultPage(app) {
    const state = app.state;
    const sr = state.searchResult || {};
    return `
        <div class="weather-app wth-result-page" style="background:${getWeatherGradient(sr.condition)};">
            <div class="wth-result-title">搜索结果</div>
            ${sr.loading ? renderSearchLoading() : ''}
            ${sr.found === false && !sr.loading ? renderSearchEmpty() : ''}
            ${sr.weather ? renderSearchResultCard(sr.weather, app) : ''}
            ${sr.weather ? renderAiBindCard(sr.weather.city, app) : ''}
        </div>
    `;
}

function renderSearchLoading() {
    return `<div class="wth-result-loading">搜索中...</div>`;
}

function renderSearchEmpty() {
    return `<div class="wth-result-empty">未找到该城市的天气信息</div>`;
}

function renderSearchResultCard(weather, app) {
    const cityName = weather.city;
    const addAttr = createActionAttr({ action: 'appMethod', method: 'addCityFromResult' }, app.id);
    return `
        <div class="wth-result-card">
            <div class="wth-result-head">
                <div>
                    <div class="wth-result-name">${escapeHtml(cityName)}</div>
                    <div class="wth-result-desc">${escapeHtml(weather.description)}</div>
                </div>
                <div class="wth-temp-icon">${getWeatherIcon(weather.condition)}</div>
            </div>
            <div class="wth-result-temp">
                <div class="wth-result-big-temp">${weather.temperature}°</div>
                <div class="wth-result-hl">
                    <div>最高 ${weather.high}°</div>
                    <div>最低 ${weather.low}°</div>
                </div>
            </div>
            <div class="wth-result-grid">
                <div class="wth-result-cell">
                    <div class="wth-result-cell-label">湿度</div>
                    <div class="wth-result-cell-val">${weather.humidity || '--'}%</div>
                </div>
                <div class="wth-result-cell">
                    <div class="wth-result-cell-label">风速</div>
                    <div class="wth-result-cell-val">${weather.wind || '--'}<span style="font-size:11px;opacity:0.7;">m/s</span></div>
                </div>
                <div class="wth-result-cell">
                    <div class="wth-result-cell-label">空气质量</div>
                    <div class="wth-result-cell-val">${escapeHtml(weather.aqi || '优')}</div>
                </div>
            </div>
            <div class="wth-result-actions">
                <button class="wth-result-btn wth-result-btn--solid" ${addAttr}>添加到列表</button>
            </div>
        </div>
    `;
}

function renderAiBindCard(cityName, app) {
    const selectId = 'wth-bind-select';
    const bindAttr = createActionAttr({ action: 'appMethod', method: 'bindCityToAI' }, app.id);
    return `
        <div class="wth-bind-card">
            <div class="wth-bind-title">绑定到 AI 角色</div>
            <div class="wth-bind-sub">将此城市的天气绑定给 AI，让它知道自己所在地的天气</div>
            <select id="${selectId}" class="wth-bind-select" data-bind-city="${escapeHtml(cityName)}">
                <option value="">选择 AI 角色</option>
                ${(window.__phoneAiPersonsList || []).map((ai) => `
                    <option value="${escapeHtml(ai.id)}">${escapeHtml(ai.name)}</option>
                `).join('')}
            </select>
            <button class="wth-bind-btn" ${bindAttr}>确认绑定</button>
            ${!(window.__phoneAiPersonsList || []).length ? `<div class="wth-bind-empty">（暂无可绑定的 AI 角色）</div>` : ''}
        </div>
    `;
}

// 城市详情页
// v0.30 重做：业务层 .wth-detail-page transparent，让 framework 的
// .app-background-layer 一张渐变贯穿整个屏幕。getBackground(state) 已在
// v0.28 实现，会跟随 detailCity 切到对应天气的渐变。状态栏 / .app-detail-header
// / .wth-detail-page / 卡片全部漂浮在同一张渐变上，视觉一体。
function renderCityDetailPage(app) {
    const state = app.state;
    const cityName = state.detailCity || '';
    const city = findCity(state, cityName);
    const weather = state.weatherCache[cityName] || {};
    if (!city) {
        return `<div class="weather-app wth-detail-page"><div class="wth-detail-desc">未找到城市</div></div>`;
    }
    return `
        <div class="weather-app wth-detail-page">
            ${renderDetailHead(city, weather)}
            ${renderHourlyForecast(weather)}
            ${renderForecastCard(weather)}
            ${renderDetailGrid(weather)}
            ${renderDetailActions(cityName, app)}
            ${renderBgAction(cityName, app)}
        </div>
    `;
}

function renderDetailHead(city, weather) {
    // v0.27：显示名优先用 mappedName，替换掉城市名。
    const displayName = city.mappedName || city.name;
    return `
        <div class="wth-detail-head">
            <div class="wth-detail-city">${escapeHtml(displayName)}</div>
            <div class="wth-detail-big-temp">${(weather.temperature !== undefined ? weather.temperature : '--')}°</div>
            <div class="wth-detail-desc">${escapeHtml(weather.description || '')}</div>
            <div class="wth-detail-hl">最高 ${(weather.high !== undefined ? weather.high : '--')}° 最低 ${(weather.low !== undefined ? weather.low : '--')}°</div>
        </div>
    `;
}

function renderHourlyForecast(weather) {
    if (!weather.hourly) return '';
    const items = weather.hourly.slice(0, 12).map((hour) => `
        <div class="wth-hour-cell">
            <div class="wth-hour-time">${escapeHtml(hour.hour)}</div>
            <div class="wth-hour-icon">${getWeatherIcon(hour.condition)}</div>
            <div class="wth-hour-temp">${hour.temperature}°</div>
        </div>
    `).join('');
    return `
        <div class="wth-hourly">
            <div class="wth-hourly-scroll">${items}</div>
        </div>
    `;
}

function renderForecastCard(weather) {
    if (!weather.forecast) return '';
    const rows = weather.forecast.map((day, i) => `
        <div class="wth-forecast-row">
            <div class="wth-forecast-day">${escapeHtml(day.day)}</div>
            <div class="wth-forecast-icon">${getWeatherIcon(day.condition)}</div>
            <div class="wth-forecast-bar">
                <span class="wth-forecast-low">${day.low}°</span>
                <div class="wth-forecast-track"></div>
                <span class="wth-forecast-high">${day.high}°</span>
            </div>
        </div>
    `).join('');
    return `
        <div class="wth-forecast">
            <div class="wth-forecast-title">7 天预报</div>
            ${rows}
        </div>
    `;
}

function renderDetailGrid(weather) {
    return `
        <div class="wth-detail-grid">
            <div class="wth-detail-cell">
                <div class="wth-detail-cell-label">湿度</div>
                <div class="wth-detail-cell-val">${(weather.humidity || '--')}%</div>
            </div>
            <div class="wth-detail-cell">
                <div class="wth-detail-cell-label">风速</div>
                <div class="wth-detail-cell-val">${(weather.wind || '--')}<span class="wth-detail-cell-unit">m/s</span></div>
            </div>
            <div class="wth-detail-cell">
                <div class="wth-detail-cell-label">空气质量</div>
                <div class="wth-detail-cell-val">${escapeHtml(weather.aqi || '优')}</div>
            </div>
            <div class="wth-detail-cell">
                <div class="wth-detail-cell-label">紫外线</div>
                <div class="wth-detail-cell-val">${escapeHtml(weather.uv || '中等')}</div>
            </div>
        </div>
    `;
}

function renderDetailActions(cityName, app) {
    const state = app.state;
    const removeAttr = createActionAttr({ action: 'appMethod', method: 'removeCityFromDetail' }, app.id);
    return `
        <div class="wth-detail-actions">
            <button class="wth-detail-btn wth-detail-btn--danger" ${removeAttr}>移除</button>
        </div>
    `;
}

function renderBgAction(cityName, app) {
    const attr = createActionAttr({ action: 'appMethod', method: 'setCityBackground' }, app.id);
    return `
        <div class="wth-detail-bg-btn">
            <button ${attr}>设置卡片背景图</button>
        </div>
    `;
}

// =========================================================================
// Widget 渲染（render(size, payload) → html）
// =========================================================================
function renderWeatherWidget(size, payload) {
    const state = window.weatherAppState;
    // v0.27：不再有「主城市」概念，widget 显示第一个已添加的城市。
    const cityName = (state?.cities?.[0]?.name) || null;
    const weather = cityName ? state?.weatherCache?.[cityName] : null;

    if (!weather || !cityName) {
        return `<div class="wth-widget-empty" style="background:linear-gradient(135deg,#4A90D9,#67B8DE);">暂无天气数据</div>`;
    }

    if (size === 'S') {
        return `
            <div class="wth-widget" style="background:linear-gradient(135deg,#4A90D9,#67B8DE);">
                <div>
                    <div class="wth-widget-city">${escapeHtml(cityName)}</div>
                    <div class="wth-widget-temp">${weather.temperature}°</div>
                </div>
                <div class="wth-widget-icon">${getWeatherIcon(weather.condition)}</div>
            </div>
        `;
    }

    if (size === 'M') {
        return `
            <div class="wth-widget" style="background:linear-gradient(135deg,#4A90D9,#67B8DE);flex-direction:column;justify-content:space-between;align-items:flex-start;padding:12px 14px;">
                <div style="display:flex;justify-content:space-between;width:100%;">
                    <div>
                        <div style="font-size:13px;font-weight:500;">${escapeHtml(cityName)}</div>
                        <div style="font-size:11px;opacity:0.8;">${escapeHtml(weather.description)}</div>
                    </div>
                    <div class="wth-widget-icon">${getWeatherIcon(weather.condition)}</div>
                </div>
                <div style="font-size:32px;font-weight:300;line-height:1;">${weather.temperature}°</div>
                <div style="font-size:11px;opacity:0.8;">H:${weather.high}° L:${weather.low}°</div>
            </div>
        `;
    }

    // L
    const forecast = (weather.forecast || []).slice(0, 5).map((day) => `
        <div style="text-align:center;">
            <div style="font-size:10px;opacity:0.8;">${escapeHtml(day.day)}</div>
            <div class="wth-widget-icon" style="font-size:18px;margin:4px 0;">${getWeatherIcon(day.condition)}</div>
            <div style="font-size:11px;">${day.high}°</div>
            <div style="font-size:10px;opacity:0.7;">${day.low}°</div>
        </div>
    `).join('');

    return `
        <div class="wth-widget" style="background:linear-gradient(135deg,#4A90D9,#67B8DE);flex-direction:column;justify-content:space-between;align-items:flex-start;padding:12px 14px;">
            <div style="display:flex;justify-content:space-between;width:100%;">
                <div>
                    <div style="font-size:14px;font-weight:500;">${escapeHtml(cityName)}</div>
                    <div style="font-size:11px;opacity:0.8;">${escapeHtml(weather.description)}</div>
                    <div class="wth-widget-temp-large" style="margin-top:4px;">${weather.temperature}°</div>
                </div>
                <div class="wth-widget-icon" style="font-size:36px;">${getWeatherIcon(weather.condition)}</div>
            </div>
            <div style="display:flex;justify-content:space-between;width:100%;padding-top:10px;border-top:1px solid rgba(255,255,255,0.2);">${forecast}</div>
        </div>
    `;
}

// =========================================================================
// App 图标（用户提供的 100% 还原 SVG）
// =========================================================================
const WEATHER_APP_ICON = `
    <div class="weather-app-icon" id="weather-app" style="border-radius: 15px; overflow: hidden; box-shadow: inset 0 1px 2px rgba(255,255,255,0.6), inset 0 -1px 2px rgba(0,0,0,0.1), 0 4px 12px rgba(61,139,212,0.35); position: relative;">
        <svg width="100%" height="100%" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <rect width="120" height="120" fill="#3D8BD4"/>
            <defs>
                <pattern id="grid2" width="40" height="40" patternUnits="userSpaceOnUse">
                    <rect width="40" height="40" fill="#4A95DA"/>
                    <rect x="2" y="2" width="18" height="18" rx="3" fill="#3D8BD4"/>
                    <rect x="22" y="22" width="18" height="18" rx="3" fill="#3D8BD4"/>
                </pattern>
            </defs>
            <rect width="120" height="120" fill="url(#grid2)"/>
            <path d="M30 68 Q30 52 46 52 Q50 38 66 38 Q84 38 88 54 Q102 56 102 70 Q102 84 88 84 L38 84 Q24 84 24 70 Q24 60 30 68 Z" fill="#2D6EB8" transform="translate(2,4)"/>
            <path d="M28 64 Q28 48 44 48 Q48 34 64 34 Q82 34 86 50 Q100 52 100 66 Q100 80 86 80 L36 80 Q22 80 22 68" fill="#FFFFFF"/>
        </svg>
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 50%; background: linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.1) 50%, transparent 100%); border-radius: 15px 15px 0 0; pointer-events: none;"></div>
    </div>
`;

// =========================================================================
// App 工厂
// =========================================================================
export default function createWeatherApp() {
    return {
        id: 'weather-app',
        name: '天气',
        icon: WEATHER_APP_ICON,
        iconBg: 'transparent',

        background: 'linear-gradient(180deg, #4A90D9 0%, #67B8DE 100%)',
        statusBarColor: '#ffffff',
        homeIndicatorColor: 'rgba(255,255,255,0.6)',
        // ★ 顶栏留透明，避免框架 Bug #1 视觉断层
        topbar: {
            visible: true,
            title: '天气',
            subtitle: '',
            bg: 'transparent',
            color: '#ffffff',
            // v0.28：去掉顶栏右侧的「药丸」app 名标签 —— 视觉更干净。
            showPill: false,
        },
        // v0.28：让 framework 的 .app-background-layer 跟随当前 detailCity 的天气
        // 状况切换渐变，让「投票 bar（.app-detail-header）」区域与下方内容区颜色一致。
        getBackground(state) {
            const detailCity = state && state.detailCity;
            if (!detailCity) return null;
            const cache = state.weatherCache || {};
            const w = cache[detailCity];
            if (!w || !w.condition) return null;
            return getWeatherGradient(w.condition);
        },
        nav: { type: 'none' },

        pages: [
            { id: 'home', label: '天气', nav: true },
            { id: 'search-result', type: 'detail' },
            { id: 'city-detail', type: 'detail' },
        ],
        defaultRootPageId: 'home',

        // IndexedDB 表声明：单条主键记录，存全部城市 + 缓存
        stores: [
            { name: 'weatherCities', keyPath: 'id' },
        ],

        detailContent: {
            'search-result': { title: '搜索结果', subtitle: '实时天气信息' },
            'city-detail':    { title: '城市详情', subtitle: '小时预报 · 7 天 · 详细信息' },
        },

        // ============================================
        // state：注册时先同步恢复 localStorage 镜像，避免其他 App 首屏读取为空；
        // 进入天气 App 后 hydrate() 仍会用 IndexedDB 覆盖并刷新最新天气。
        // ============================================
        setup() {
            const persisted = readPersistedWeatherState();
            const state = {
                cities: Array.isArray(persisted?.cities) ? persisted.cities : [],
                weatherCache: persisted?.weatherCache && typeof persisted.weatherCache === 'object'
                    ? persisted.weatherCache
                    : {},
                searchResult: null,    // { loading, weather, found, cityName }
                detailCity: '',
                loadingCity: '',
                _hydrated: false,
                _hydrating: false,
            };
            if (typeof window !== 'undefined') {
                window.weatherAppState = snapshot(state);
            }
            return state;
        },

        // ============================================
        // methods：用方法简写，this 自动被 framework 注入
        // ============================================
        methods: {
            // ---- 兜底 localStorage 镜像 ----
            // 主备机制：IndexedDB 是首选；put 失败或读不到时，落到 localStorage。
            // 双写避免「表面写成功但实际丢」的隐性 bug。
            _lsGet() {
                try {
                    const raw = localStorage.getItem('weather-app::cities-v1');
                    if (!raw) return null;
                    const obj = JSON.parse(raw);
                    return (obj && typeof obj === 'object') ? obj : null;
                } catch (_) { return null; }
            },
            _lsSet(payload) {
                try {
                    localStorage.setItem('weather-app::cities-v1', JSON.stringify(payload));
                } catch (_) { /* quota / private mode 都有可能 */ }
            },

            // ---- 初始化：async 加载持久化数据 ----
            async hydrate(force = false) {
                if (this.app.state._hydrated && !force) return;
                // 注意：不要在 hydrate 一开始就置 _hydrated = true。
                // 那会阻止后续 renderPage 重试。等真正尝试过 db + ls 之后再标记。
                this.app.state._hydrating = true;
                console.debug('[weather] hydrate() START');

                // ★ 等 IndexedDB ready（避免 registerStore 在 background 升级时调用 get/put 失败）
                if (window.myDb?.open) {
                    try { await window.myDb.open(); } catch (_) { /* 已有 ready */ }
                }

                // 最多重试 3 次：有时候 IndexedDB open 还没完成，第一次 get 会抛 NotFoundError
                let data = null;
                for (let attempt = 0; attempt < 3 && !data; attempt++) {
                    try {
                        data = await this.toolkit.db.get('weatherCities', 'weather-cities');
                        if (data) break;
                    } catch (e) {
                        console.warn(`[weather] hydrate.db.get attempt ${attempt} failed:`, e?.name, e?.message);
                        // 等 200ms 后重试
                        await new Promise(r => setTimeout(r, 200));
                    }
                }
                console.debug('[weather] db.get =>', data ? `cities=${(data.cities||[]).length}` : 'null');

                // IndexedDB 拿不到时，落到 localStorage
                if (!data) {
                    data = this._lsGet();
                    if (data) {
                        console.debug('[weather] 回退到 localStorage 数据');
                    }
                } else {
                    // IndexedDB 有，也同步一份到 localStorage 兜底
                    this._lsSet(data);
                }

                if (data) {
                    this.app.state.cities = Array.isArray(data.cities) ? data.cities : [];
                    this.app.state.weatherCache = (data.weatherCache && typeof data.weatherCache === 'object') ? data.weatherCache : {};
                    console.debug('[weather] hydrate 恢复城市数=', this.app.state.cities.length);

                    // 拉取列表里每个城市的最新天气（不阻塞渲染，先重绘一次）
                    this._forceRerender();
                    for (const c of this.app.state.cities) {
                        if (!c || !c.name) continue;
                        try {
                            const w = await fetchWeather(c.name);
                            this.app.state.weatherCache[c.name] = w;
                            this._forceRerender();
                        } catch (e) { /* 单条失败不影响整体 */ }
                    }
                    await this._saveCities();
                } else {
                    console.debug('[weather] hydrate 没有持久化数据');
                }

                // 拉取 AI 列表（settings-sdk 可能还没加载，做 best-effort）
                try {
                    const sdk = window.settingsSdk;
                    if (sdk && sdk.aiPersons && typeof sdk.aiPersons.list === 'function') {
                        const list = sdk.aiPersons.list() || [];
                        window.__phoneAiPersonsList = list.map((p) => ({ id: p.id, name: p.name || p.id }));
                    }
                } catch (e) { /* ignore */ }

                this.app.state._hydrating = false;
                // 只有当 hydrate 真正恢复到了数据，才标记 _hydrated 完成。
                // 没数据时保持 _hydrated = false，下次 renderPage 会再次尝试。
                if (data) this.app.state._hydrated = true;

                // v0.27：从 places 表反向拉映射，刷新后 weather 卡片直接显示映射名。
                // 防止「用户必须先开 settings 才有 mappedName」的体验断环。
                await this._syncMappingsFromPlaces();

                // ★ v0.30 修复：设置安全的 self 引用供后续事件回调使用
                const selfApp = this.app;
                window.__weatherAppSelf = {
                    app: selfApp,
                    forceRerender: this._forceRerender.bind(this),
                    syncMappingsFromPlaces: this._syncMappingsFromPlaces.bind(this),
                };

                // ★ v0.30 修复：如果 settingsSdk 已经就绪但 _syncMappingsFromPlaces 内部检查时
                // 没考虑到 places API 是否真的能 list()（可能 sdk 存在但 places 还是空缓存）
                // 派发一个延迟事件，让 settings app 渲染时能拿到最新的映射
                if (window.settingsSdk && window.settingsSdk.places) {
                    console.log('[weather] settingsSdk 已就绪，再次确认 places 数据可访问');
                    try {
                        const placesTest = window.settingsSdk.places.list() || [];
                        console.log('[weather] 立即可用的 places 数:', placesTest.length);
                    } catch (e) {
                        console.warn('[weather] places.list() 立即可用性测试失败:', e);
                    }
                }

                // 把 state 挂到 window 让 widget render 能读
                window.weatherAppState = snapshot(this.app.state);
                // v0.27：派发 weather-hydrated 事件，让 settings app 监听做局部刷新。
                // ⚠️ 不要在这里 refreshPhoneApps() —— 会导致循环：refresh → weather 重建
                // → 再 hydrate → 再 refresh → 死循环，并且会冲掉 settings 的 world 页。
                try {
                    window.dispatchEvent(new CustomEvent('weather-hydrated', {
                        detail: {
                            cities: this.app.state.cities.map(c => ({ name: c.name, mappedName: c.mappedName || null })),
                        },
                    }));
                } catch (_) { /* ignore */ }
            // 调试辅助：暴露 IndexedDB / localStorage 状态，方便 DevTools 检查
                try {
                    window.__weatherDbDebug = {
                        cities: this.app.state.cities.length,
                        cachedWeathers: Object.keys(this.app.state.weatherCache || {}).length,
                        lsBytes: (localStorage.getItem('weather-app::cities-v1') || '').length,
                    };
                } catch (_) {}
                // ★ 暴露手动救援入口：如果 hydrate 出问题，在 console 跑
                //   __weatherRescue()  强制重置 _hydrated 并重新拉数据
                const theApp = this.app;
                window.__weatherRescue = () => {
                    theApp.state._hydrated = false;
                    return this.hydrate(true);
                };
                window.__weatherDumpLs = () => {
                    try {
                        const raw = localStorage.getItem('weather-app::cities-v1');
                        return raw ? JSON.parse(raw) : null;
                    } catch (_) { return null; }
                };
            },

            async _saveCities() {
                const payload = {
                    id: 'weather-cities',
                    cities: this.app.state.cities,
                    weatherCache: this.app.state.weatherCache,
                };
                // ★ 双写：先 localStorage（同步、几乎不会失败），再 IndexedDB
                this._lsSet(payload);
                try {
                    await this.toolkit.db.put('weatherCities', payload);
                    console.debug('[weather] _saveCities OK, cities=', (this.app.state.cities || []).length);
                    return true;
                } catch (e) {
                    console.error('[weather] IndexedDB 写入失败（localStorage 已落备）:', e);
                    this.toolkit.island.notify('warning', '已临时保存', 'IndexedDB 写入失败，城市列表已暂存到本地存储');
                    return false;
                }
            },

            _forceRerender() {
                try { if (window.__detailRenderTick) window.__detailRenderTick.value++; } catch (_) {}
                if (typeof window.refreshPhoneApps === 'function') window.refreshPhoneApps();
            },

            // ============================================
            // v0.27：从 settings-sdk 的 places 表反向拉 realCityRef 映射，
            // 写到 cities[].mappedName。解决「刷新页面后必须先打开 settings 才能看到映射」的体验断环。
            // 必须是 methods 成员，hydrate 通过 this 调用。
            // ★ v0.30 修复：使用 self 模式保存 this，避免事件回调中 this 丢失
            // ============================================
            async _syncMappingsFromPlaces() {
                console.log('[weather] _syncMappingsFromPlaces 开始');
                // ★ 关键：保存 self 引用，事件回调里 this 会丢
                const self = this;
                const sdk = window.settingsSdk;

                // 检查 settingsSdk 是否存在且 places API 可用
                if (!sdk) {
                    console.log('[weather] settingsSdk 还未就绪，订阅 settings-sdk-ready 事件');
                    window.addEventListener('settings-sdk-ready', () => {
                        console.log('[weather] 收到 settings-sdk-ready 事件，重新调用 _syncMappingsFromPlaces');
                        self._syncMappingsFromPlaces().then(() => {
                            console.log('[weather] _syncMappingsFromPlaces 完成，触发重渲染');
                            try {
                                window.weatherAppState = snapshot(self.app.state);
                            } catch (_) { /* ignore */ }
                            self._forceRerender();
                            try {
                                window.dispatchEvent(new CustomEvent('weather-hydrated', {
                                    detail: {
                                        cities: self.app.state.cities.map(c => ({ name: c.name, mappedName: c.mappedName || null })),
                                    },
                                }));
                            } catch (_) { /* ignore */ }
                        }).catch((err) => {
                            console.warn('[weather] _syncMappingsFromPlaces 重试失败:', err);
                        });
                    }, { once: true });
                    return;
                }

                // sdk 存在，但 places API 可能还没初始化完成
                if (!sdk.places || typeof sdk.places.list !== 'function') {
                    console.log('[weather] sdk.places API 还未就绪，订阅 settings-sdk-ready 事件');
                    window.addEventListener('settings-sdk-ready', () => {
                        console.log('[weather] 收到 settings-sdk-ready 事件（places API），重新调用 _syncMappingsFromPlaces');
                        self._syncMappingsFromPlaces().then(() => {
                            console.log('[weather] _syncMappingsFromPlaces 完成，触发重渲染');
                            try {
                                window.weatherAppState = snapshot(self.app.state);
                            } catch (_) { /* ignore */ }
                            self._forceRerender();
                            try {
                                window.dispatchEvent(new CustomEvent('weather-hydrated', {
                                    detail: {
                                        cities: self.app.state.cities.map(c => ({ name: c.name, mappedName: c.mappedName || null })),
                                    },
                                }));
                            } catch (_) { /* ignore */ }
                        }).catch((err) => {
                            console.warn('[weather] _syncMappingsFromPlaces 重试失败:', err);
                        });
                    }, { once: true });
                    return;
                }

                let places = [];
                try {
                    places = sdk.places.list() || [];
                    console.log('[weather] 从 places API 获取到', places.length, '个地点');
                } catch (e) {
                    console.warn('[weather] _syncMappingsFromPlaces: places.list 失败:', e);
                    return;
                }

                // ★ v0.30 修复：如果 sdk 存在但 places 列表为空（可能 places 还在异步加载），
                // 也要订阅 places 的事件，避免错过加载完成的数据。
                if (places.length === 0 && sdk.events && typeof sdk.events.on === 'function') {
                    console.log('[weather] places 列表为空，订阅 places 相关事件，等待数据加载');
                    let attemptCount = 0;
                    const maxAttempts = 5;
                    const trySyncAgain = () => {
                        attemptCount++;
                        const newPlaces = sdk.places.list() || [];
                        console.log(`[weather] 第 ${attemptCount} 次重试，places 数=`, newPlaces.length);
                        if (newPlaces.length > 0) {
                            // 数据到了，触发同步
                            self._forceRerender();
                            // 再调一次自己，确保映射应用
                            return self._syncMappingsFromPlaces();
                        }
                        if (attemptCount < maxAttempts) {
                            setTimeout(trySyncAgain, 500);
                        } else {
                            console.warn('[weather] 多次重试仍未获取到 places 数据');
                        }
                        return Promise.resolve();
                    };
                    setTimeout(trySyncAgain, 500);
                }

                // 构建 cityName -> place.name 映射（保留第一个非空 place.name）
                const mapping = new Map();
                for (const p of places) {
                    if (!p || !p.realCityRef) continue;
                    const cn = p.realCityRef;
                    if (!mapping.has(cn)) mapping.set(cn, p.name || null);
                }
                console.log('[weather] 构建映射:', Object.fromEntries(mapping));

                const cities = self.app.state.cities || [];
                let changed = false;
                for (const c of cities) {
                    if (!c || !c.name) continue;
                    const want = mapping.get(c.name) || null;
                    if ((c.mappedName || null) !== want) {
                        console.log('[weather] 城市', c.name, '的映射从', c.mappedName, '更新为', want);
                        c.mappedName = want;
                        changed = true;
                    }
                }
                if (changed) {
                    console.log('[weather] 映射有变化，保存到 IndexedDB');
                    try {
                        await self._saveCities();
                    } catch (e) {
                        console.warn('[weather] _syncMappingsFromPlaces: _saveCities 失败:', e);
                    }
                } else {
                    console.log('[weather] 映射没有变化');
                }

                // ★ 关键修复：即使没有变化，也要更新 weatherAppState 和触发重渲染
                // 因为 settings-sdk-ready 可能在 hydrate 完成后才触发
                try {
                    window.weatherAppState = snapshot(self.app.state);
                    self._forceRerender();
                    window.dispatchEvent(new CustomEvent('weather-hydrated', {
                        detail: {
                            cities: self.app.state.cities.map(c => ({ name: c.name, mappedName: c.mappedName || null })),
                        },
                    }));
                } catch (_) { /* ignore */ }
            },

            // ---- 搜索 ----
            async searchCity() {
                const input = document.querySelector('#wth-search-city');
                const cityName = (input?.value || '').trim();
                if (!cityName) {
                    this.toolkit.island.notify('warning', '请输入城市名', '');
                    return;
                }
                if ((this.app.state.cities || []).some((c) => c && c.name === cityName)) {
                    this.toolkit.island.notify('info', '已添加', `${cityName} 已在城市列表中`);
                    return;
                }
                // 打开搜索结果页
                this.app.state.searchResult = { loading: true, weather: null, found: null, cityName };
                this.app.state.detailCity = '';
                window.dispatchEvent(new CustomEvent('app:page-action', {
                    detail: { action: 'detail', appId: this.app.id, pageId: 'search-result' },
                }));
                // 拉取天气
                try {
                    const w = await fetchWeather(cityName);
                    this.app.state.searchResult = { loading: false, weather: w, found: true, cityName };
                    this.app.state.weatherCache[cityName] = w;
                    this._forceRerender();
                } catch (e) {
                    this.app.state.searchResult = { loading: false, weather: null, found: false, cityName };
                    this._forceRerender();
                }
            },

            // ---- 搜索结果上的操作 ----
            async addCityFromResult() {
                const sr = this.app.state.searchResult;
                if (!sr || !sr.weather) return;
                const w = sr.weather;
                const cityName = sr.cityName;
                if (!(this.app.state.cities || []).some((c) => c && c.name === cityName)) {
                    this.app.state.cities.push({ name: cityName, addedAt: Date.now() });
                }
                this.app.state.weatherCache[cityName] = w;
                this.app.state.searchResult = null;
                this._forceRerender();
                const ok = await this._saveCities();
                if (ok) {
                    this.toolkit.island.notify('success', '添加成功', `${cityName} 已添加到列表`);
                }
                this._fallbackCloseDetail();
            },

            _fallbackCloseDetail() {
                // framework 没暴露 closeDetailPage 到 window；
                // 这里用 openApp 重新打开 weather-app 重建栈，回到 home。
                window.dispatchEvent(new CustomEvent('app:page-action', {
                    detail: { action: 'openApp', targetAppId: this.app.id },
                }));
                this._forceRerender();
            },

            // ---- 详情页上的操作 ----
            openCityDetail(payload) {
                const cityName = (payload && payload.cityName) || '';
                if (!cityName) return;
                this.app.state.detailCity = cityName;
                // v0.28：让 framework 的 activeAppBackgroundStyle 重新求值，
                // 这样 .app-background-layer 才会切到新 detailCity 的天气渐变。
                if (window.__detailRenderTick) {
                    window.__detailRenderTick.value++;
                }
                window.dispatchEvent(new CustomEvent('app:page-action', {
                    detail: { action: 'detail', appId: this.app.id, pageId: 'city-detail' },
                }));
            },

            async setPrimaryFromDetail() {
                // v0.27 弃用：「设为主城市」按钮已移除；保留为空实现以防旧引用。
                const cityName = this.app.state.detailCity;
                if (!cityName) return;
                this.toolkit.island.notify('info', '已不需要', '此 App 不再区分主城市');
            },

            async removeCityFromDetail() {
                const cityName = this.app.state.detailCity;
                if (!cityName) return;
                this.app.state.cities = (this.app.state.cities || []).filter((c) => c && c.name !== cityName);
                delete this.app.state.weatherCache[cityName];
                await this._saveCities();
                this.toolkit.island.notify('info', '已移除', `${cityName} 已从列表中移除`);
                this.app.state.detailCity = '';
                this._forceRerender();
            },

            async setCityBackground() {
                const cityName = this.app.state.detailCity;
                if (!cityName) return;
                const city = findCity(this.app.state, cityName);
                if (!city) return;
                // 用文件 input 选择本地图片，转 base64 存到 state
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = async () => {
                    const file = input.files && input.files[0];
                    if (!file) return;
                    if (file.size > 2 * 1024 * 1024) {
                        this.toolkit.island.notify('warning', '图片过大', '请选择 2MB 以下的图片');
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = async () => {
                        const dataUrl = String(reader.result || '');
                        city.backgroundImage = dataUrl;
                        await this._saveCities();
                        this.toolkit.island.notify('success', '背景图已更新', '');
                        this._forceRerender();
                    };
                    reader.readAsDataURL(file);
                };
                input.click();
            },

            // ---- AI 绑定（实验性）：跨 App 共享记录 ----
            async bindCityToAI() {
                const select = document.querySelector('#wth-bind-select');
                const aiId = select?.value || '';
                const cityName = select?.getAttribute('data-bind-city') || '';
                if (!aiId) {
                    this.toolkit.island.notify('warning', '请选择 AI 角色', '');
                    return;
                }
                if (!cityName) return;
                // 把绑定写到 sharedRecords：sourceApp=weather-app, targetApp=ai
                await this.toolkit.shared.put({
                    entityType: 'weather-binding',
                    entityId: cityName,
                    targetApp: aiId,
                    title: `${cityName} 的天气`,
                    summary: '已绑定到天气 App',
                    payload: { city: cityName, condition: 'live' },
                });
                this.toolkit.island.notify('success', '绑定成功', `${cityName} 已绑定到 AI ${aiId}`);
            },

            // ---- widget 入口（暴露给 framework） ----
            onWidgetTap() {
                // 点击 widget → 打开 weather app
                window.dispatchEvent(new CustomEvent('app:page-action', {
                    detail: { action: 'openApp', targetAppId: this.app.id },
                }));
            },
        },

        // ============================================
        // 渲染：renderPage 不带 this，必须是模块顶层路由
        // ============================================
        renderPage(content, page, app) {
            // 首次进入页面时确保 hydrate（renderPage 会被 framework 调用多次）
            // 但 _hydrating 期间不要重复触发（避免 race）。
            if (!app.state._hydrated && !app.state._hydrating) {
                if (app.methods && typeof app.methods.hydrate === 'function') {
                    Promise.resolve().then(() => app.methods.hydrate());
                }
            }
            if (page.id === 'home') return renderHomePage(app);
            if (page.id === 'search-result') return renderSearchResultPage(app);
            if (page.id === 'city-detail') {
                // 同步设置 detailCity（如果是从城市卡片点击进来的）
                if (!app.state.detailCity && content) {
                    app.state.detailCity = content.title || '';
                }
                return renderCityDetailPage(app);
            }
            return '';
        },

        renderDetailPage(content, page, app) {
            // renderPage / renderDetailPage 都是 framework 拿出来当独立函数调，
            // this 已丢失；直接复用顶层分发（不能用 this.renderPage）。
            if (!app.state._hydrated && !app.state._hydrating) {
                if (app.methods && typeof app.methods.hydrate === 'function') {
                    Promise.resolve().then(() => app.methods.hydrate());
                }
            }
            if (page.id === 'search-result') return renderSearchResultPage(app);
            if (page.id === 'city-detail') {
                if (!app.state.detailCity && content) {
                    app.state.detailCity = content.title || '';
                }
                return renderCityDetailPage(app);
            }
            return '';
        },

        // ============================================
        // widget 注册
        // ============================================
        widgets: [
            {
                id: 'weather-mini',
                label: '天气',
                icon: '<svg viewBox="0 0 256 256" width="56" height="56"><path d="M160,40A88.09,88.09,0,0,0,81.29,88.67,64,64,0,1,0,72,216h88a88,88,0,0,0,0-176Z" fill="#ffffff"/></svg>',
                iconBg: 'linear-gradient(135deg, #4A90D9 0%, #67B8DE 100%)',
                size: 'S',
                orientation: 'h',
                render: renderWeatherWidget,
                onTap(instanceId, qualifiedId, ctx) {
                    if (ctx?.toolkit?.app?.methods?.onWidgetTap) {
                        return ctx.toolkit.app.methods.onWidgetTap();
                    }
                    return false;
                },
            },
            {
                id: 'weather-card',
                label: '天气详情',
                icon: '<svg viewBox="0 0 256 256" width="56" height="56"><path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128Z" fill="#ffffff"/></svg>',
                iconBg: 'linear-gradient(135deg, #4A90D9 0%, #67B8DE 100%)',
                size: 'M',
                render: renderWeatherWidget,
                onTap(instanceId, qualifiedId, ctx) {
                    if (ctx?.toolkit?.app?.methods?.onWidgetTap) {
                        return ctx.toolkit.app.methods.onWidgetTap();
                    }
                    return false;
                },
            },
            {
                id: 'weather-week',
                label: '一周天气',
                icon: '<svg viewBox="0 0 256 256" width="56" height="56"><path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Z" fill="#ffffff"/></svg>',
                iconBg: 'linear-gradient(135deg, #4A90D9 0%, #67B8DE 100%)',
                size: 'L',
                render: renderWeatherWidget,
                onTap(instanceId, qualifiedId, ctx) {
                    if (ctx?.toolkit?.app?.methods?.onWidgetTap) {
                        return ctx.toolkit.app.methods.onWidgetTap();
                    }
                    return false;
                },
            },
        ],

        // ============================================
        // services：给其他 App 调用的对外接口（兼容原 wheather.js 的全局函数）
        // serviceContext.app 已被 framework 注入，直接用 this.app.state
        // ============================================
        services: {
            getWeatherForAI(aiId) {
                const state = (this.app && this.app.state) || {};
                if (!aiId) return null;
                const cached = state.weatherCache || {};
                const cities = state.cities || [];
                // v0.27：不再有「主城市」，默认取第一个已添加的城市。
                const primary = cities[0] && cities[0].name;
                if (!primary || !cached[primary]) return null;
                return Object.assign({}, cached[primary], { displayCity: primary });
            },

            getWeatherSummaryForAI(aiId) {
                const w = this.getWeatherForAI(aiId);
                if (!w) return '天气信息暂不可用';
                return `${w.displayCity}天气：当前${w.description}，${w.temperature}°C，湿度${w.humidity}%。`;
            },

            /**
             * 给指定城市打映射标签（来自地点 A 城映射天气 宁波）。
             * 调用方：世界观 settings app 的 worldSavePlace。
             * @param {{cityName: string, mappedName: string|null}} payload
             * @returns {Promise<boolean>} 是否成功
             */
            setCityMapping(payload = {}) {
                const { cityName, mappedName } = payload;
                console.log('[weather] setCityMapping 调用', { cityName, mappedName });
                if (!cityName) return false;
                const state = this.app && this.app.state;
                if (!state) return false;
                const cities = state.cities || [];
                const idx = cities.findIndex(c => c && c.name === cityName);
                if (idx === -1) {
                    console.warn('[weather] setCityMapping: 未在 cities 中找到', cityName);
                    return false;
                }
                const trimmed = (mappedName || '').trim();
                cities[idx].mappedName = trimmed || null;
                console.log('[weather] setCityMapping: 更新 mappedName=', cities[idx].mappedName, '到 city=', cityName);

                // services 上下文不一定挂 methods/_saveCities,直接同步落 localStorage
                const payload_data = {
                    id: 'weather-cities',
                    cities: state.cities,
                    weatherCache: state.weatherCache,
                };

                // ★ v0.30 修复：services 上下文没有 _lsSet/_saveCities/_forceRerender，
                // 改用 window 全局函数 / 直接 IndexedDB API
                try {
                    localStorage.setItem('weather-app::cities-v1', JSON.stringify(payload_data));
                } catch (_) { /* quota */ }

                // 使用 window.myDb 直接写 IndexedDB
                if (window.myDb?.put) {
                    window.myDb.put('weatherCities', payload_data).catch(e =>
                        console.warn('[weather] setCityMapping db.put 失败:', e)
                    );
                }

                // ★ v0.30 修复：同步更新 window.weatherAppState，让 widget render 能读到最新数据
                try {
                    window.weatherAppState = snapshot(state);
                } catch (_) { /* ignore */ }

                // ★ 强制触发 weather app 重新渲染（即使在 detail 页也能工作）
                if (window.__detailRenderTick) {
                    try { window.__detailRenderTick.value++; } catch (_) {}
                }
                if (typeof window.refreshPhoneApps === 'function') {
                    try { window.refreshPhoneApps(); } catch (_) {}
                }

                // ★ 派发事件让任何 weather 监听者重新加载
                try {
                    window.dispatchEvent(new CustomEvent('weather-hydrated', {
                        detail: {
                            cities: state.cities.map(c => ({ name: c.name, mappedName: c.mappedName || null })),
                        },
                    }));
                } catch (_) { /* ignore */ }

                return true;
            },

            /** 列出所有城市（外部 app 拉选项用）。同步返回数组的浅拷贝。 */
            listCities() {
                return (this.app.state.cities || []).map(c => ({
                    name: c.name,
                    mappedName: c.mappedName || null,
                    addedAt: c.addedAt || 0,
                }));
            },
        },
    };
}