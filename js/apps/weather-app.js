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
import WeatherAPI from '@/js/apps/weather-app/weather-api.js';

// =========================================================================
// 天气条件配置
// =========================================================================
// 只在 API 没给 description 时兜底（老缓存里没有这个字段）
const CONDITION_DESC = {
    sunny: '晴',
    cloudy: '阴',
    partly_cloudy: '多云',
    rainy: '有雨',
    stormy: '雷阵雨',
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

// =========================================================================
// 数据新鲜度
// 之前 weatherCache 是「拉一次存一辈子」：_hydrated 置 true 后再也不会重新请求，
// 页面不刷新就永远显示第一次拉到的那份数据，用户看到的自然不是实况。
// =========================================================================
const CURRENT_TTL = 30 * 60 * 1000;          // 实况超过 30 分钟视为过期，进 App 自动重拉
const FORECAST_TTL = 3 * 60 * 60 * 1000;     // 预报变化慢，超过 3 小时才提示过期
const OFFLINE_AFTER = 12 * 60 * 60 * 1000;   // 超过半天没拉到新数据，UI 必须标「离线数据」
const AUTO_CHECK_INTERVAL = 60 * 1000;       // renderPage 每次重绘都会问一次，这里兜住频率
const BACKGROUND_CHECK_INTERVAL = 5 * 60 * 1000; // 桌面 widget 也在显示天气，不能只在进 App 时才刷

// framework 会缓存 renderPage 的 HTML（use-app-navigation.resolveAsyncRenderer），
// 重新进 App 不一定会重新调 renderPage，只靠渲染钩子检查新鲜度会漏。
let backgroundTimer = null;
function startBackgroundRefresh(methods) {
    if (backgroundTimer || typeof setInterval !== 'function') return;
    backgroundTimer = setInterval(() => {
        // 页面在后台时不打接口，回到前台后下一拍自然补上
        if (typeof document !== 'undefined' && document.hidden) return;
        try { methods._maybeAutoRefresh?.(); } catch (_) { /* 静默，定时器不能被单次异常打死 */ }
    }, BACKGROUND_CHECK_INTERVAL);
}

// =========================================================================
// 天气图标（线性 SVG，开发者手写固定字符串，不需 escape）
// 只存路径，宽高由 renderIcon 注入 —— 详情页/预报行/widget 的图标尺寸差很多，
// 而 CSS 里只有 .wth-temp-icon / .wth-widget-icon 声明了 svg 宽高。
// =========================================================================
const WEATHER_ICON_PATHS = {
    sunny: '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path>',
    partly_cloudy: '<path d="M12 2v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="M20 12h2"></path><path d="m19.07 4.93-1.41 1.41"></path><path d="M15.95 12.65a4 4 0 0 0-5.93-4.13"></path><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"></path>',
    cloudy: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>',
    overcast: '<path d="M17.5 21H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path><path d="M22 10a3 3 0 0 0-3-3h-2.21a5.5 5.5 0 0 0-10.7.5"></path>',
    rainy: '<path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24"></path><path d="M8 19v1"></path><path d="M8 14v1"></path><path d="M16 19v1"></path><path d="M16 14v1"></path><path d="M12 21v1"></path><path d="M12 16v1"></path>',
    heavy_rain: '<path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24"></path><path d="m9 14-2 6"></path><path d="m13 14-2 6"></path><path d="m17 14-2 6"></path>',
    stormy: '<path d="M6 16.33A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.97"></path><path d="m13 12-3 5h4l-3 5"></path>',
    snowy: '<path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24"></path><path d="M8 15h.01"></path><path d="M8 19h.01"></path><path d="M12 17h.01"></path><path d="M12 21h.01"></path><path d="M16 15h.01"></path><path d="M16 19h.01"></path>',
    foggy: '<path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24"></path><path d="M16 17H7"></path><path d="M17 21H9"></path>',
    windy: '<path d="M12.8 19.6A2 2 0 1 0 14 16H2"></path><path d="M17.5 8a2.5 2.5 0 1 1 2 4H2"></path><path d="M9.8 4.4A2 2 0 1 1 11 8H2"></path>',
    night: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>',
    night_cloudy: '<path d="M10.08 9A6 6 0 0 1 16 4a4.24 4.24 0 0 0 6 6c0 2.22-1.21 4.16-3 5.2"></path><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"></path>',
};

// 非天气类的功能图标，保持同一套线性风格
const UI_ICON_PATHS = {
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M8 16H3v5"></path>',
    sunrise: '<path d="M12 2v8"></path><path d="m4.93 10.93 1.41 1.41"></path><path d="M2 18h2"></path><path d="M20 18h2"></path><path d="m19.07 10.93-1.41 1.41"></path><path d="M22 22H2"></path><path d="m8 6 4-4 4 4"></path><path d="M16 18a4 4 0 0 0-8 0"></path>',
    sunset: '<path d="M12 10V2"></path><path d="m4.93 10.93 1.41 1.41"></path><path d="M2 18h2"></path><path d="M20 18h2"></path><path d="m19.07 10.93-1.41 1.41"></path><path d="M22 22H2"></path><path d="m16 6-4 4-4-4"></path><path d="M16 18a4 4 0 0 0-8 0"></path>',
    droplet: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7Z"></path>',
    alert: '<path d="M12 9v4"></path><path d="M12 17h.01"></path><circle cx="12" cy="12" r="9"></circle>',
};

function renderIcon(paths, size) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

function getUiIcon(name, size = 18) {
    return renderIcon(UI_ICON_PATHS[name] || UI_ICON_PATHS.alert, size);
}

/**
 * 天气图标。entry 可以是完整天气对象（优先用 API 给的细分 icon 键，能区分
 * 小雨/大雨/白天/夜间），也可以直接是 condition 字符串（兼容老缓存）。
 */
function getWeatherIcon(entry, size = 24) {
    const key = typeof entry === 'string' ? entry : (entry?.icon || entry?.condition);
    return renderIcon(WEATHER_ICON_PATHS[key] || WEATHER_ICON_PATHS.cloudy, size);
}

function getWeatherGradient(condition, isDay) {
    // 夜里晴天还画成亮蓝色会很违和
    if (isDay === false && (condition === 'sunny' || condition === 'partly_cloudy' || !condition)) {
        return GRADIENTS.night;
    }
    return GRADIENTS[condition] || GRADIENTS.sunny;
}

// =========================================================================
// 数据展示工具
// =========================================================================
function conditionText(entry) {
    if (!entry) return '';
    return entry.description || CONDITION_DESC[entry.condition] || '';
}

/** 数值缺失时统一显示 --（0 不算缺失）；顺手 escape，API 返回值一律不预设可信 */
function num(value, fallback = '--') {
    if (value === undefined || value === null || value === '') return fallback;
    return escapeHtml(value);
}

function formatRelativeTime(timestamp) {
    if (!timestamp) return '';
    const diff = Date.now() - Number(timestamp);
    if (diff < 0) return '刚刚';
    if (diff < 60 * 1000) return '刚刚';
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))} 小时前`;
    return `${Math.floor(diff / (24 * 60 * 60 * 1000))} 天前`;
}

function isStaleWeather(weather) {
    if (!weather || !weather.updatedAt) return true;
    return Date.now() - weather.updatedAt > CURRENT_TTL;
}

function isOfflineWeather(weather) {
    if (!weather || !weather.updatedAt) return false;
    return Date.now() - weather.updatedAt > OFFLINE_AFTER;
}

function isForecastStale(weather) {
    if (!weather || !weather.updatedAt) return false;
    return Date.now() - weather.updatedAt > FORECAST_TTL;
}

/** 数据过期时给一句人话，别让用户把上次的缓存当实况 */
function freshnessLabel(weather) {
    if (!weather || !weather.updatedAt) return '';
    const relative = formatRelativeTime(weather.updatedAt);
    return isOfflineWeather(weather) ? `离线数据 · 更新于${relative}` : `更新于${relative}`;
}

// =========================================================================
// 天气 API（使用 Open-Meteo 真实天气数据）
// =========================================================================

/**
 * 根据城市名获取真实天气
 * @param {string} cityName - 城市名称
 * @param {Object} [options] - { force } 强制跳过 API 层内存缓存
 * @returns {Promise<Object>} 天气数据
 */
async function fetchWeatherByName(cityName, options) {
    try {
        const weather = await WeatherAPI.fetchWeather(cityName, options);
        return weather;
    } catch (error) {
        console.error('[weather] fetchWeatherByName 失败:', error);
        throw error;
    }
}

/**
 * 根据坐标获取真实天气
 * @param {Object} coords - {latitude, longitude, name, timezone}
 * @param {Object} [options] - { force } 强制跳过 API 层内存缓存
 * @returns {Promise<Object>} 天气数据
 */
async function fetchWeatherByCoords(coords, options) {
    try {
        const weather = await WeatherAPI.fetchWeather(coords, options);
        return weather;
    } catch (error) {
        console.error('[weather] fetchWeatherByCoords 失败:', error);
        throw error;
    }
}

/**
 * 搜索城市。异常继续往上抛 —— 吞掉的话「网络挂了」会被显示成「查无此城」。
 * @param {string} query - 搜索关键词
 * @returns {Promise<Array>} 城市列表
 */
function searchCities(query) {
    return WeatherAPI.searchCities(query);
}

/**
 * 保留旧接口兼容，内部调用新的真实API
 * @param {string} cityName - 城市名称
 * @param {Object} [options] - { force }
 * @returns {Promise<Object>} 天气数据
 */
function fetchWeather(cityName, options) {
    return fetchWeatherByName(cityName, options);
}

/** 统一把异常转成能直接给用户看的一句话 */
function errorText(error) {
    const message = error && error.message ? String(error.message) : '';
    return message || '网络异常，暂时拿不到天气';
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

/**
 * 每次渲染的入口钩子：先补齐持久化数据，再按 TTL 判断要不要重新拉实况。
 * renderPage 是唯一「用户在看这个 App」的可靠信号（framework 没给 onShow），
 * 所以自动刷新挂在这里，节流交给 methods._maybeAutoRefresh。
 */
function ensureFreshWeather(app) {
    const methods = app.methods || {};
    if (!app.state._hydrated && !app.state._hydrating) {
        if (typeof methods.hydrate === 'function') {
            Promise.resolve().then(() => methods.hydrate());
        }
        return;
    }
    if (typeof methods._maybeAutoRefresh === 'function') {
        Promise.resolve().then(() => methods._maybeAutoRefresh());
    }
}

// =========================================================================
// 模块顶层渲染函数（renderPage 内只能 dispatch 到这里）
// =========================================================================

// 搜索栏 + 状态条 + 城市列表 + 空状态
function renderHomePage(app) {
    const state = app.state;
    const citiesHtml = (state.cities || []).map((city) => renderCityCard(city, state, app)).join('');
    const emptyHtml = (state.cities || []).length === 0 ? renderEmptyHint() : '';
    return `
        <div class="weather-app" style="padding:16px 14px 18px;">
            ${renderSearchBar(app)}
            ${renderRefreshBar(app)}
            ${renderErrorBanner(app)}
            <div class="wth-cities" id="wth-cities-container">${citiesHtml}</div>
            ${emptyHtml}
            ${renderPresenceEntry(app)}
        </div>
    `;
}

/**
 * 「灵动岛与小组件」入口。走 framework 的全局委托（data-presence-center），
 * 不用注册 method、不占 detail 路由。
 * 放在城市列表末尾：天气 App 没有设置页，这里是唯一合适的「附属功能」落点。
 */
function renderPresenceEntry(app) {
    const icon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="8" width="18" height="8" rx="4"/><circle cx="8" cy="12" r="1.4" fill="currentColor" stroke="none"/></svg>`;
    const arrow = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
    return `
        <button data-presence-center="${escapeHtml(app.id)}"
                style="display:flex;align-items:center;gap:9px;width:100%;margin-top:14px;padding:12px 14px;border:0.5px solid rgba(255,255,255,0.22);border-radius:16px;background:rgba(255,255,255,0.14);color:#ffffff;font-size:13px;text-align:left;cursor:pointer;">
            <span style="display:flex;flex-shrink:0;opacity:0.9;">${icon}</span>
            <span style="flex:1;min-width:0;">灵动岛与小组件</span>
            <span style="display:flex;flex-shrink:0;opacity:0.6;">${arrow}</span>
        </button>
    `;
}

/** 更新时间 + 手动刷新：不给这个入口，用户没法确认自己看的是不是实况 */
function renderRefreshBar(app) {
    const state = app.state;
    if (!(state.cities || []).length) return '';
    const attr = createActionAttr({ action: 'appMethod', method: 'refreshAll' }, app.id);
    // 冷启动时 lastRefreshAt 还是 0，但缓存里的数据是有时间戳的，直接说「尚未获取」会误导
    let updatedAt = state.lastRefreshAt || 0;
    for (const city of state.cities) {
        const cached = city && state.weatherCache[city.name];
        if (cached && cached.updatedAt > updatedAt) updatedAt = cached.updatedAt;
    }
    const label = state.refreshing
        ? '正在获取实时天气…'
        : (updatedAt ? `更新于${formatRelativeTime(updatedAt)}` : '尚未获取实时数据');
    return `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin:-8px 2px 14px;color:rgba(255,255,255,0.75);font-size:12px;">
            <span>${escapeHtml(label)}</span>
            <button ${attr} style="display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border:none;border-radius:20px;background:rgba(255,255,255,0.18);color:#ffffff;font-size:12px;cursor:pointer;${state.refreshing ? 'opacity:0.55;' : ''}">
                ${getUiIcon('refresh', 13)}
                <span>${state.refreshing ? '刷新中' : '刷新'}</span>
            </button>
        </div>
    `;
}

/** API 报错必须让用户看见，不能只 console.warn 然后继续显示旧数据 */
function renderErrorBanner(app) {
    const state = app.state;
    if (!state.lastError) return '';
    const attr = createActionAttr({ action: 'appMethod', method: 'refreshAll' }, app.id);
    return `
        <div style="display:flex;align-items:center;gap:8px;margin:0 0 14px;padding:10px 12px;border-radius:12px;background:rgba(255,86,72,0.22);border:0.5px solid rgba(255,255,255,0.25);color:#ffffff;font-size:12px;line-height:1.5;">
            <span style="flex-shrink:0;opacity:0.9;">${getUiIcon('alert', 15)}</span>
            <span style="flex:1;min-width:0;">${escapeHtml(state.lastError)}</span>
            <button ${attr} style="flex-shrink:0;border:none;border-radius:16px;padding:4px 10px;background:rgba(255,255,255,0.25);color:#ffffff;font-size:12px;cursor:pointer;">重试</button>
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
    const hasTemp = temp !== undefined && temp !== null;
    // v0.27：显示名优先用 mappedName（地点编辑器映射后替换城市名），
    // city.name 保留为内部索引（weatherCache key / openCityDetail payload）。
    const displayName = city.mappedName || city.name;
    const loading = state.refreshing || state.loadingCity === city.name;
    const desc = conditionText(w) || (loading ? '获取中…' : '暂无数据');
    // 先调 setDetailCity 把 detailCity 写进 state，再推 city-detail 页
    const attr = createActionAttr({
        action: 'appMethod',
        method: 'openCityDetail',
        payload: { cityName: city.name },
    }, app.id);
    return `
        <div class="wth-card" style="background:${getWeatherGradient(w.condition, w.isDay)};" ${attr} data-city="${escapeHtml(city.name)}">
            ${city.backgroundImage ? `<div class="wth-card-bg" style="background-image:url('${escapeHtml(city.backgroundImage)}');"></div>` : ''}
            <div class="wth-card-body">
                <div class="wth-card-head">
                    <div>
                        <div class="wth-card-name">${escapeHtml(displayName)}</div>
                        <div class="wth-card-desc">${escapeHtml(desc)}</div>
                    </div>
                    ${isOfflineWeather(w) ? `<div style="flex-shrink:0;padding:3px 9px;border-radius:10px;background:rgba(0,0,0,0.22);font-size:10px;">离线数据</div>` : ''}
                </div>
                <div class="wth-card-temp">
                    <div class="${hasTemp ? 'wth-temp' : 'wth-temp-loading'}">${hasTemp ? temp + '°' : '--'}</div>
                    <div class="wth-temp-icon">${getWeatherIcon(w, 56)}</div>
                </div>
                <div class="wth-card-hl">最高 ${num(w.high)}° 最低 ${num(w.low)}°${w.updatedAt ? ` · ${escapeHtml(formatRelativeTime(w.updatedAt))}` : ''}</div>
            </div>
        </div>
    `;
}

function renderEmptyHint() {
    return `
        <div class="wth-empty">
            <div class="wth-empty-icon">${getWeatherIcon('partly_cloudy', 48)}</div>
            <div class="wth-empty-text">搜索并添加城市</div>
            <div class="wth-empty-sub">查看实时天气信息</div>
        </div>
    `;
}

// 搜索结果页
function renderSearchResultPage(app) {
    const state = app.state;
    const sr = state.searchResult || {};
    // 使用真实天气数据的condition来确定背景，没有则用默认
    const bgCondition = sr.weather?.condition || 'sunny';
    return `
        <div class="weather-app wth-result-page" style="background:${getWeatherGradient(bgCondition, sr.weather?.isDay)};">
            <div class="wth-result-title">搜索结果</div>
            ${sr.loading ? renderSearchLoading() : ''}
            ${sr.error && !sr.loading ? `<div class="wth-result-empty">${escapeHtml(sr.error)}</div>` : ''}
            ${sr.found === false && !sr.loading && !sr.error ? renderSearchEmpty(sr.searchQuery) : ''}
            ${sr.weather ? renderSearchResultCard(sr.weather, app) : ''}
            ${sr.weather && sr.alternatives?.length > 0 ? renderAlternativeCities(sr.alternatives, app) : ''}
            ${sr.weather ? renderAiBindCard(sr.weather.city, app) : ''}
        </div>
    `;
}

function renderSearchLoading() {
    return `<div class="wth-result-loading">正在搜索城市并获取天气...</div>`;
}

function renderSearchEmpty(query) {
    return `<div class="wth-result-empty">未找到与"${escapeHtml(query || '')}"相关的城市<br><span style="font-size:12px;opacity:0.7;">请尝试使用拼音或更通用的名称</span></div>`;
}

function renderAlternativeCities(alternatives, app) {
    if (!alternatives || alternatives.length === 0) return '';
    const items = alternatives.map(city => {
        const attr = createActionAttr({
            action: 'appMethod',
            method: 'selectAlternativeCity',
            payload: { city },
        }, app.id);
        return `<button class="wth-alternative-item" ${attr}>${escapeHtml(city.displayName || city.name)}</button>`;
    }).join('');
    return `
        <div class="wth-alternatives">
            <div class="wth-alternatives-title">其他可能的结果</div>
            <div class="wth-alternatives-list">${items}</div>
        </div>
    `;
}

function renderSearchResultCard(weather, app) {
    const cityName = weather.city;
    const addAttr = createActionAttr({ action: 'appMethod', method: 'addCityFromResult' }, app.id);
    return `
        <div class="wth-result-card">
            <div class="wth-result-head">
                <div>
                    <div class="wth-result-name">${escapeHtml(cityName)}</div>
                    <div class="wth-result-desc">${escapeHtml(conditionText(weather))}${weather.localTime ? ` · 当地 ${escapeHtml(weather.localTime)}` : ''}</div>
                </div>
                <div class="wth-temp-icon">${getWeatherIcon(weather, 56)}</div>
            </div>
            <div class="wth-result-temp">
                <div class="wth-result-big-temp">${num(weather.temperature)}°</div>
                <div class="wth-result-hl">
                    <div>最高 ${num(weather.high)}°</div>
                    <div>最低 ${num(weather.low)}°</div>
                </div>
            </div>
            <div class="wth-result-grid">
                <div class="wth-result-cell">
                    <div class="wth-result-cell-label">湿度</div>
                    <div class="wth-result-cell-val">${num(weather.humidity)}%</div>
                </div>
                <div class="wth-result-cell">
                    <div class="wth-result-cell-label">风速</div>
                    <div class="wth-result-cell-val">${num(weather.wind)}<span style="font-size:11px;opacity:0.7;">m/s</span></div>
                </div>
                <div class="wth-result-cell">
                    <div class="wth-result-cell-label">空气质量</div>
                    <div class="wth-result-cell-val" style="font-size:15px;">${weather.aqi === null || weather.aqi === undefined ? '--' : `${weather.aqi} ${escapeHtml(weather.aqiLevel || '')}`}</div>
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
            ${renderDetailRefreshBar(cityName, weather, app)}
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
            <div class="wth-detail-big-temp">${num(weather.temperature)}°</div>
            <div class="wth-detail-desc">${escapeHtml(conditionText(weather))}</div>
            <div class="wth-detail-hl">最高 ${num(weather.high)}° 最低 ${num(weather.low)}°${weather.apparentTemp !== undefined && weather.apparentTemp !== null ? ` · 体感 ${weather.apparentTemp}°` : ''}</div>
        </div>
    `;
}

/** 详情页也要能单独刷新一座城市，并把数据时间摆在明面上 */
function renderDetailRefreshBar(cityName, weather, app) {
    const state = app.state;
    const attr = createActionAttr({
        action: 'appMethod',
        method: 'refreshCity',
        payload: { cityName },
    }, app.id);
    const busy = state.refreshing || state.loadingCity === cityName;
    const label = busy ? '正在获取实时天气…' : (freshnessLabel(weather) || '尚未获取实时数据');
    return `
        <div style="display:flex;align-items:center;justify-content:center;gap:10px;padding:0 20px 14px;color:rgba(255,255,255,0.8);font-size:12px;">
            <span>${escapeHtml(label)}</span>
            <button ${attr} style="display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border:none;border-radius:20px;background:rgba(255,255,255,0.2);color:#ffffff;font-size:12px;cursor:pointer;${busy ? 'opacity:0.55;' : ''}">
                ${getUiIcon('refresh', 13)}
                <span>${busy ? '刷新中' : '刷新'}</span>
            </button>
        </div>
        ${state.lastError ? `<div style="margin:0 20px 14px;padding:10px 12px;border-radius:12px;background:rgba(255,86,72,0.22);color:#ffffff;font-size:12px;line-height:1.5;">${escapeHtml(state.lastError)}</div>` : ''}
    `;
}

function renderHourlyForecast(weather) {
    if (!weather.hourly || !weather.hourly.length) return '';
    const items = weather.hourly.slice(0, 24).map((hour) => `
        <div class="wth-hour-cell">
            <div class="wth-hour-time"${hour.isNow ? ' style="font-weight:600;"' : ''}>${escapeHtml(hour.hour)}</div>
            <div class="wth-hour-icon" style="display:flex;justify-content:center;">${getWeatherIcon(hour, 22)}</div>
            <div class="wth-hour-temp">${num(hour.temperature)}°</div>
            <div style="font-size:10px;opacity:${hour.pop ? '0.85' : '0'};margin-top:3px;">${num(hour.pop, 0)}%</div>
        </div>
    `).join('');
    return `
        <div class="wth-hourly">
            <div style="font-size:13px;opacity:0.8;margin-bottom:10px;">未来 24 小时</div>
            <div class="wth-hourly-scroll">${items}</div>
        </div>
    `;
}

function renderForecastCard(weather) {
    const days = weather.forecast || [];
    if (!days.length) return '';

    // 温度条要按整周的极值定位，否则那根轨道就是纯装饰
    const lows = days.map((d) => d.low).filter((v) => typeof v === 'number');
    const highs = days.map((d) => d.high).filter((v) => typeof v === 'number');
    const weekLow = lows.length ? Math.min(...lows) : 0;
    const weekHigh = highs.length ? Math.max(...highs) : 1;
    const span = Math.max(1, weekHigh - weekLow);

    const rows = days.map((day) => {
        const hasRange = typeof day.low === 'number' && typeof day.high === 'number';
        const left = hasRange ? ((day.low - weekLow) / span) * 100 : 0;
        const width = hasRange ? Math.max(10, ((day.high - day.low) / span) * 100) : 0;
        const pop = (day.pop !== undefined && day.pop !== null && day.pop > 0) ? `${day.pop}%` : '';
        return `
        <div class="wth-forecast-row">
            <div class="wth-forecast-day">
                <div>${escapeHtml(day.day)}</div>
                ${day.dateLabel ? `<div style="font-size:10px;opacity:0.6;margin-top:2px;">${escapeHtml(day.dateLabel)}</div>` : ''}
            </div>
            <div class="wth-forecast-icon" style="margin:0 10px;display:flex;align-items:center;">${getWeatherIcon(day, 22)}</div>
            <div style="flex:1;min-width:0;">
                <div style="font-size:13px;line-height:1.3;">${escapeHtml(conditionText(day) || '--')}</div>
                ${pop ? `<div style="display:flex;align-items:center;gap:3px;font-size:11px;opacity:0.72;margin-top:2px;">${getUiIcon('droplet', 10)}<span>${pop}</span></div>` : ''}
            </div>
            <div class="wth-forecast-bar" style="flex:0 0 116px;">
                <span class="wth-forecast-low">${num(day.low)}°</span>
                <div class="wth-forecast-track" style="position:relative;overflow:hidden;">
                    ${hasRange ? `<div style="position:absolute;top:0;bottom:0;left:${left.toFixed(1)}%;width:${width.toFixed(1)}%;border-radius:2px;background:linear-gradient(90deg,#8FD3FF,#FFD479);"></div>` : ''}
                </div>
                <span class="wth-forecast-high">${num(day.high)}°</span>
            </div>
        </div>
    `;
    }).join('');

    const today = days[0] || {};
    const sunLine = (today.sunrise || today.sunset) ? `
        <div style="display:flex;justify-content:space-around;margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.18);font-size:12px;">
            <span style="display:inline-flex;align-items:center;gap:6px;">${getUiIcon('sunrise', 15)}日出 ${escapeHtml(today.sunrise || '--')}</span>
            <span style="display:inline-flex;align-items:center;gap:6px;">${getUiIcon('sunset', 15)}日落 ${escapeHtml(today.sunset || '--')}</span>
        </div>
    ` : '';

    return `
        <div class="wth-forecast">
            <div class="wth-forecast-title" style="display:flex;justify-content:space-between;align-items:baseline;">
                <span>7 天预报</span>
                ${isForecastStale(weather) ? `<span style="font-size:11px;opacity:0.7;font-weight:400;">${escapeHtml(freshnessLabel(weather))}</span>` : ''}
            </div>
            ${rows}
            ${sunLine}
        </div>
    `;
}

function renderDetailGrid(weather) {
    const aqiText = (weather.aqi === undefined || weather.aqi === null)
        ? '--'
        : `${weather.aqi}${weather.aqiLevel ? ` ${weather.aqiLevel}` : ''}`;
    const uvText = (weather.uv === undefined || weather.uv === null)
        ? '--'
        : `${weather.uv}${weather.uvLevel ? ` ${weather.uvLevel}` : ''}`;
    return `
        <div class="wth-detail-grid">
            <div class="wth-detail-cell">
                <div class="wth-detail-cell-label">湿度</div>
                <div class="wth-detail-cell-val">${num(weather.humidity)}<span class="wth-detail-cell-unit">%</span></div>
            </div>
            <div class="wth-detail-cell">
                <div class="wth-detail-cell-label" style="display:flex;align-items:center;gap:5px;">${getWeatherIcon('windy', 13)}风速</div>
                <div class="wth-detail-cell-val">${num(weather.wind)}<span class="wth-detail-cell-unit">m/s</span></div>
                ${weather.windDirectionLabel ? `<div style="font-size:11px;opacity:0.7;margin-top:2px;">${escapeHtml(weather.windDirectionLabel)}风</div>` : ''}
            </div>
            <div class="wth-detail-cell">
                <div class="wth-detail-cell-label" style="display:flex;align-items:center;gap:5px;">${getUiIcon('droplet', 13)}降水概率</div>
                <div class="wth-detail-cell-val">${num(weather.pop)}<span class="wth-detail-cell-unit">%</span></div>
            </div>
            <div class="wth-detail-cell">
                <div class="wth-detail-cell-label">云量</div>
                <div class="wth-detail-cell-val">${num(weather.cloudCover)}<span class="wth-detail-cell-unit">%</span></div>
            </div>
            <div class="wth-detail-cell">
                <div class="wth-detail-cell-label">空气质量</div>
                <div class="wth-detail-cell-val" style="font-size:20px;">${escapeHtml(aqiText)}</div>
            </div>
            <div class="wth-detail-cell">
                <div class="wth-detail-cell-label">紫外线</div>
                <div class="wth-detail-cell-val" style="font-size:20px;">${escapeHtml(uvText)}</div>
            </div>
        </div>
    `;
}

function renderDetailActions(cityName, app) {
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

    // widget 跟着实况变颜色，不再永远是那张蓝色底图
    const bg = getWeatherGradient(weather.condition, weather.isDay);
    const desc = conditionText(weather);
    const stale = isOfflineWeather(weather);

    if (size === 'S') {
        return `
            <div class="wth-widget" style="background:${bg};">
                <div>
                    <div class="wth-widget-city">${escapeHtml(cityName)}</div>
                    <div class="wth-widget-temp">${num(weather.temperature)}°</div>
                </div>
                <div class="wth-widget-icon">${getWeatherIcon(weather, 28)}</div>
            </div>
        `;
    }

    if (size === 'M') {
        return `
            <div class="wth-widget" style="background:${bg};flex-direction:column;justify-content:space-between;align-items:flex-start;padding:12px 14px;">
                <div style="display:flex;justify-content:space-between;width:100%;">
                    <div>
                        <div style="font-size:13px;font-weight:500;">${escapeHtml(cityName)}</div>
                        <div style="font-size:11px;opacity:0.8;">${escapeHtml(desc)}</div>
                    </div>
                    <div class="wth-widget-icon">${getWeatherIcon(weather, 28)}</div>
                </div>
                <div style="font-size:32px;font-weight:300;line-height:1;">${num(weather.temperature)}°</div>
                <div style="font-size:11px;opacity:0.8;">H:${num(weather.high)}° L:${num(weather.low)}°${stale ? ' · 离线数据' : ''}</div>
            </div>
        `;
    }

    // L：一周天气，每天都要能看到状况文案而不只是图标
    const forecast = (weather.forecast || []).slice(0, 5).map((day) => `
        <div style="flex:1;min-width:0;text-align:center;">
            <div style="font-size:10px;opacity:0.8;">${escapeHtml(day.day)}</div>
            <div class="wth-widget-icon" style="display:flex;justify-content:center;font-size:18px;margin:4px 0;">${getWeatherIcon(day, 18)}</div>
            <div style="font-size:9px;opacity:0.85;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(conditionText(day))}</div>
            <div style="font-size:11px;margin-top:2px;">${num(day.high)}°</div>
            <div style="font-size:10px;opacity:0.7;">${num(day.low)}°</div>
        </div>
    `).join('');

    return `
        <div class="wth-widget" style="background:${bg};flex-direction:column;justify-content:space-between;align-items:flex-start;padding:12px 14px;">
            <div style="display:flex;justify-content:space-between;width:100%;">
                <div>
                    <div style="font-size:14px;font-weight:500;">${escapeHtml(cityName)}</div>
                    <div style="font-size:11px;opacity:0.8;">${escapeHtml(desc)}${stale ? ' · 离线数据' : ''}</div>
                    <div class="wth-widget-temp-large" style="margin-top:4px;">${num(weather.temperature)}°</div>
                </div>
                <div class="wth-widget-icon" style="font-size:36px;">${getWeatherIcon(weather, 36)}</div>
            </div>
            <div style="display:flex;justify-content:space-between;gap:2px;width:100%;padding-top:10px;border-top:1px solid rgba(255,255,255,0.2);">${forecast}</div>
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

        distribution: {
            requiresInstall: false,
            appStore: {
                subtitle: '看一眼此刻的天',
                category: '天气',
                description:
                    '出门以前，人通常只想先知道：现在是什么天气，往后几个小时会不会变。\n\n'
                    + '天气可以搜索并留下多座城市，显示实时温度、体感、湿度、风、降水、空气质量与紫外线，也把未来 24 小时和 7 天预报放在同一处。数据旧了会标出更新时间，超过半天则明确写成离线数据。\n\n'
                    + '第一座城市会出现在桌面小组件里。需要时，也可以把一座城市绑定给 AI 角色，让它读到那里的天气。',
                accent: 'linear-gradient(145deg, #4A90D9 0%, #67B8DE 100%)',
            },
        },

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
            // 手动刷新入口走 framework 的 headerActions（见 AGENTS.md §16.23），
            // 不自己在 v-html 里画顶栏按钮。
            headerActions: [
                {
                    iconHtml: getUiIcon('refresh', 16),
                    ariaLabel: '刷新天气',
                    action: { action: 'appMethod', method: 'refreshAll' },
                },
            ],
        },

        // ★ v0.87 声明天气 App 会占用灵动岛的时机。
        //   用户在首页底部「灵动岛与小组件」里能预览、逐条关掉。
        //   详见 docs/framework-灵动岛与小组件总览.md
        islandKinds: [
            {
                id: 'weather-toast',
                label: '操作反馈',
                desc: '添加/移除城市、刷新失败之类的短提示，3.5 秒后自动消失。',
                when: '添加或移除城市、刷新天气出错时',
                sizes: ['compact'],
                previewPayload: { title: '已添加城市', message: '北京 · 27° 雷阵雨' },
            },
        ],
        // v0.28：让 framework 的 .app-background-layer 跟随当前 detailCity 的天气
        // 状况切换渐变，让「投票 bar（.app-detail-header）」区域与下方内容区颜色一致。
        getBackground(state) {
            const detailCity = state && state.detailCity;
            if (!detailCity) return null;
            const cache = state.weatherCache || {};
            const w = cache[detailCity];
            if (!w || !w.condition) return null;
            return getWeatherGradient(w.condition, w.isDay);
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
                refreshing: false,
                lastRefreshAt: 0,
                lastError: '',
                _hydrated: false,
                _hydrating: false,
                _autoCheckedAt: 0,
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
                // renderPage / renderDetailPage 可能在同一帧各排一次 hydrate，
                // 不挡住并发的话会打两轮 db.get + 两轮天气请求。
                if (this.app.state._hydrating) return;
                if (this.app.state._hydrated && !force) return;
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

                    // 先用缓存把界面画出来，再补拉真实数据
                    this._forceRerender();
                    await this._refreshCities(this.app.state.cities, { force: true });
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
                // 无论有没有读到数据都要落 _hydrated：读不到通常就是「用户还没添加城市」，
                // 保持 false 会让 renderPage 每次重绘都重新跑一遍 hydrate（db.get 重试 + 重渲染
                // 互相触发）。真正的数据新鲜度交给 _maybeAutoRefresh 的 TTL 判断。
                this.app.state._hydrated = true;

                startBackgroundRefresh(this.methods);

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
                // 注意：不要在这里 refreshPhoneApps() —— 会导致循环：refresh → weather 重建
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
                // widget 读的是 window.weatherAppState 快照，不在这里同步的话
                // 桌面小组件会一直停在 hydrate 结束那一刻的数据上。
                try { window.weatherAppState = snapshot(this.app.state); } catch (_) {}
                try { if (window.__detailRenderTick) window.__detailRenderTick.value++; } catch (_) {}
                try { window.__requestAppRerender?.(this.app.id, null); } catch (_) {}
                if (typeof window.refreshPhoneApps === 'function') window.refreshPhoneApps();
            },

            // ============================================
            // 实时性：TTL + 自动/手动刷新
            // ============================================

            /**
             * 拉取一批城市的天气。逐个城市写回 state 并重绘，
             * 失败的城市保留旧数据，但把错误抛到 state.lastError 让 UI 能显示。
             */
            async _refreshCities(cities, options = {}) {
                const list = (cities || []).filter((c) => c && c.name);
                if (!list.length) return { ok: 0, failed: 0 };
                if (this.app.state.refreshing) return { ok: 0, failed: 0 };

                this.app.state.refreshing = true;
                this.app.state.lastError = '';
                this._forceRerender();

                let ok = 0;
                let failed = 0;
                let lastError = null;
                for (const city of list) {
                    this.app.state.loadingCity = city.name;
                    try {
                        const weather = await this._fetchCityWeather(city, options);
                        this.app.state.weatherCache[city.name] = weather;
                        ok++;
                    } catch (e) {
                        failed++;
                        lastError = e;
                        console.warn(`[weather] 获取 ${city.name} 天气失败:`, e);
                    }
                    this.app.state.loadingCity = '';
                    this._forceRerender();
                }

                this.app.state.refreshing = false;
                if (ok > 0) this.app.state.lastRefreshAt = Date.now();
                const scope = list.length === 1 ? list[0].name : `${failed} 座城市`;
                this.app.state.lastError = failed ? `${scope}天气获取失败：${errorText(lastError)}` : '';

                if (ok > 0) await this._saveCities();
                this._forceRerender();
                return { ok, failed, error: lastError };
            },

            /** 有坐标就走坐标（更准，也省一次地理编码请求），没有才回退城市名 */
            _fetchCityWeather(city, options = {}) {
                const fetchOptions = { force: options.force !== false };
                if (city.latitude !== undefined && city.longitude !== undefined) {
                    return fetchWeatherByCoords({
                        latitude: city.latitude,
                        longitude: city.longitude,
                        name: city.name,
                        timezone: city.timezone || 'Asia/Shanghai',
                    }, fetchOptions);
                }
                return fetchWeather(city.name, fetchOptions);
            },

            /** 顶栏 / 状态条上的手动刷新 */
            async refreshAll() {
                const cities = this.app.state.cities || [];
                if (!cities.length) {
                    this.toolkit.island.notify('info', '还没有城市', '先搜索并添加一个城市');
                    return;
                }
                const result = await this._refreshCities(cities, { force: true });
                if (result.failed) {
                    this.toolkit.island.notify('error', '刷新失败', errorText(result.error));
                } else if (result.ok) {
                    this.toolkit.island.notify('success', '已更新', '天气数据已刷新到最新');
                }
            },

            /** 详情页里只刷当前这一座城市 */
            async refreshCity(payload) {
                const cityName = (payload && payload.cityName) || this.app.state.detailCity;
                const city = findCity(this.app.state, cityName);
                if (!city) return;
                const result = await this._refreshCities([city], { force: true });
                if (result.failed) {
                    this.toolkit.island.notify('error', '刷新失败', errorText(result.error));
                } else if (result.ok) {
                    this.toolkit.island.notify('success', '已更新', `${cityName} 天气已刷新`);
                }
            },

            /**
             * renderPage 每次重绘都会调，负责「进 App 看到的是不是实况」。
             * 双重节流：AUTO_CHECK_INTERVAL 限制检查频率，CURRENT_TTL 决定是否真的发请求。
             */
            _maybeAutoRefresh() {
                const state = this.app.state;
                if (state.refreshing || state._hydrating) return;
                const now = Date.now();
                if (now - (state._autoCheckedAt || 0) < AUTO_CHECK_INTERVAL) return;
                state._autoCheckedAt = now;

                const stale = (state.cities || []).filter(
                    (c) => c && c.name && isStaleWeather(state.weatherCache[c.name]),
                );
                if (!stale.length) return;
                console.debug('[weather] 自动刷新过期城市:', stale.map((c) => c.name).join(', '));
                this._refreshCities(stale, { force: true });
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
                const query = (input?.value || '').trim();
                if (!query) {
                    this.toolkit.island.notify('warning', '请输入城市名', '');
                    return;
                }

                // 先打开搜索结果页（loading状态）
                this.app.state.searchResult = { loading: true, weather: null, found: null, cityName: query, searchQuery: query };
                this.app.state.detailCity = '';
                window.dispatchEvent(new CustomEvent('app:page-action', {
                    detail: { action: 'detail', appId: this.app.id, pageId: 'search-result' },
                }));

                try {
                    // 先搜索城市列表
                    const cities = await searchCities(query);
                    
                    if (cities.length === 0) {
                        this.app.state.searchResult = { loading: false, weather: null, found: false, cityName: query, searchQuery: query };
                        this.toolkit.island.notify('warning', '未找到', `未找到与"${query}"相关的城市`);
                        this._forceRerender();
                        return;
                    }

                    // 使用第一个匹配的城市获取天气
                    const bestMatch = cities[0];
                    const w = await fetchWeatherByCoords(bestMatch, { force: true });
                    
                    this.app.state.searchResult = { 
                        loading: false, 
                        weather: w, 
                        found: true, 
                        cityName: bestMatch.name,
                        searchQuery: query,
                        cityData: bestMatch, // 保存完整城市数据（包含坐标）
                        alternatives: cities.slice(1, 5), // 其他可能的结果
                    };
                    this.app.state.weatherCache[bestMatch.name] = w;
                    this._forceRerender();
                } catch (e) {
                    console.error('[weather] 搜索城市失败:', e);
                    // 把真实原因写进结果页：网络异常和「查无此城」是两回事
                    this.app.state.searchResult = {
                        loading: false,
                        weather: null,
                        found: false,
                        cityName: query,
                        searchQuery: query,
                        error: errorText(e),
                    };
                    this.toolkit.island.notify('error', '获取失败', errorText(e));
                    this._forceRerender();
                }
            },

            // ---- 搜索结果上的操作 ----
            async addCityFromResult() {
                const sr = this.app.state.searchResult;
                if (!sr || !sr.weather) return;
                const w = sr.weather;
                const cityName = sr.cityName;
                const cityData = sr.cityData; // 包含坐标等完整信息

                if (!(this.app.state.cities || []).some((c) => c && c.name === cityName)) {
                    // 保存完整城市数据（包含坐标）
                    this.app.state.cities.push({ 
                        name: cityName, 
                        addedAt: Date.now(),
                        latitude: cityData?.latitude,
                        longitude: cityData?.longitude,
                        timezone: cityData?.timezone || 'Asia/Shanghai',
                        country: cityData?.country,
                        displayName: cityData?.displayName,
                    });
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

            // ---- 选择其他候选城市 ----
            async selectAlternativeCity(payload) {
                const city = payload?.city;
                if (!city) return;

                this.app.state.searchResult = { 
                    loading: true, 
                    weather: null, 
                    found: null, 
                    cityName: city.name,
                    searchQuery: city.name,
                    cityData: city,
                };
                this._forceRerender();

                try {
                    const w = await fetchWeatherByCoords(city, { force: true });
                    this.app.state.searchResult = { 
                        loading: false, 
                        weather: w, 
                        found: true, 
                        cityName: city.name,
                        searchQuery: city.name,
                        cityData: city,
                    };
                    this.app.state.weatherCache[city.name] = w;
                    this._forceRerender();
                } catch (e) {
                    console.error('[weather] selectAlternativeCity 失败:', e);
                    this.app.state.searchResult = {
                        loading: false,
                        weather: null,
                        found: false,
                        cityName: city.name,
                        searchQuery: city.name,
                        cityData: city,
                        error: errorText(e),
                    };
                    this.toolkit.island.notify('error', '获取失败', errorText(e));
                    this._forceRerender();
                }
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
            ensureFreshWeather(app);
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
            ensureFreshWeather(app);
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
                const today = (w.forecast || [])[0];
                const parts = [`${w.displayCity}天气：当前${conditionText(w)}，${num(w.temperature)}°C，湿度${num(w.humidity)}%`];
                if (today) parts.push(`今天${conditionText(today)}，${num(today.low)}~${num(today.high)}°C`);
                // 数据太旧时明说，免得 AI 把上次的缓存当今天的天气播报
                if (isOfflineWeather(w)) parts.push(`（数据更新于${formatRelativeTime(w.updatedAt)}）`);
                return `${parts.join('。')}。`;
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