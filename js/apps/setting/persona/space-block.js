/**
 * Settings App · 人设主页 · 「空间」模块 · 渲染层
 *
 * 入口：renderSpaceBlock(app, persona)
 *   - renderSpaceWeatherCard          当前地点 + 天气
 *   - renderSpaceCurrentLocation      现在所在(基于今日日程)
 *   - renderSpaceLocationsList        可去场所列表(按地点分组)
 *   - renderSpaceSchedulePreview      今日日程预览(按时段)
 *   - renderSpaceActionBar            「生成今日日程」/「重 roll」按钮
 *
 * 所有函数模块顶层,无 this。
 */

import { escapeHtml } from '@/src/core/escape.js';
import {
    getAccessibleLocationsForPersona,
    getPlaceWeather,
    getCurrentPhase,
    getCurrentLocationBySchedule,
    isSleepPhase,
    validateScheduleAgainstRhythm,
    validateScheduleAgainstWeekly,
} from './space-sdk.js';

// ============================================
// 通用 action 构造器(与 home-section.js wvAction 同风格)
// ============================================

function spAction(method, payload = {}) {
    const obj = { action: 'appMethod', appId: 'settings', method, payload };
    return `data-app-action='${escapeHtml(JSON.stringify(obj))}'`;
}

// ============================================
// 简易天气图标(不引用 weather-app.js 的 SVG,保持解耦)
// ============================================

/**
 * 把一个现实小时转成显示用的时段标签:
 *   - 若当前世界观开启了纪时系统且 customHours 是 12 项(子丑寅卯…),显示「戌时」
 *   - 否则显示「19 时」
 * @param {number} hour  现实小时(0-23)
 * @param {object} chronologySettings
 */
function formatHourLabel(hour, chronologySettings) {
    const safeHour = Math.max(0, Math.min(23, Number.parseInt(hour, 10) || 0));
    const custom = Array.isArray(chronologySettings?.customHours) ? chronologySettings.customHours : [];
    const enabled = !!chronologySettings?.enabled;
    if (enabled && custom.length === 12) {
        const idx = Math.floor((safeHour + 1) / 2) % 12;
        return custom[idx] || `${safeHour} 时`;
    }
    return `${safeHour} 时`;
}

/** 拼一段 from-to 时段标签(自动遵循当前世界观的时辰制)。*/
function formatHourRangeLabel(fromHour, toHour, chronologySettings) {
    return `${formatHourLabel(fromHour, chronologySettings)}–${formatHourLabel(toHour, chronologySettings)}`;
}

const WX_SIMPLE_ICON = {
    sunny: '晴',
    cloudy: '阴',
    partly_cloudy: '多云',
    rainy: '雨',
    stormy: '雷',
    snowy: '雪',
    foggy: '雾',
    windy: '风',
    night: '夜',
    night_cloudy: '夜阴',
};

function wxIcon(condition) {
    return WX_SIMPLE_ICON[condition] || '多云';
}

// ============================================
// 取数(全部容错)
// ============================================

import { readWeatherAppState } from './space-sdk.js';

function readSpaceData(app, persona) {
    const sdk = (typeof window !== 'undefined' ? window.settingsSdk : null);
    const worldId = persona?.boundWorldId;
    const world = worldId ? sdk?.worlds?.get?.(worldId) : null;
    const places = worldId && sdk?.places?.list ? sdk.places.list({ worldRef: worldId }) : [];
    const accessible = getAccessibleLocationsForPersona(sdk, worldId, persona?.id, { includeRare: false });

    // 找当前 persona 的「主要地点」:第一个 accessible.location.placeRef 对应的 place
    const primaryPlace = accessible.find(a => a.place)?.place || places[0] || null;

    // 天气：优先读运行时 state；天气 App 尚未 hydrate 时回退到其持久化快照。
    const weatherAppState = readWeatherAppState();
    const weather = getPlaceWeather(weatherAppState, primaryPlace);

    // 当前时刻 + phase
    const now = new Date();
    const worldTime = getCurrentPhase(world, now);

    // 今日 diary(只保留 todaySchedule)
    const entityType = app?.state?.personaHome?.entityType || 'user';
    const entityId = persona?.id;
    let todayDiary = null;
    try {
        todayDiary = sdk?.diary?.getToday?.(entityType, entityId);
    } catch (_) {}

    const todaySchedule = Array.isArray(todayDiary?.todaySchedule) ? todayDiary.todaySchedule : [];

    // 当前所在
    const currentSeg = getCurrentLocationBySchedule(todaySchedule, now);

    // 本周日程(用于冲突检测)
    let weeklyEvents = [];
    try {
        const todayStr = now.toLocaleDateString('en-CA');
        const day = sdk?.schedule?.getDay?.(entityType, entityId, todayStr);
        weeklyEvents = Array.isArray(day?.events) ? day.events : [];
    } catch (_) {}

    return {
        sdk, world, places, accessible, primaryPlace, weather,
        now, worldTime,
        todayDiary, todaySchedule,
        currentSeg, weeklyEvents,
        isSleep: isSleepPhase(persona, now),
    };
}

// ============================================
// 天气卡
// ============================================

function renderSpaceWeatherCard(data) {
    const { primaryPlace, weather, world, worldTime } = data;
    const placeName = escapeHtml(primaryPlace?.name || '未映射地点');
    const cityName = escapeHtml(primaryPlace?.realCityRef || '(未映射城市)');
    const phaseLabel = escapeHtml(worldTime.rawWorldTime ? worldTime.name : worldTime.name);
    const realHm = `${worldTime.realHour}:${String(worldTime.realMinute).padStart(2, '0')}`;

    let wxBody;
    if (weather) {
        wxBody = `
            <div class="phome-space__wx-icon">${wxIcon(weather.condition)}</div>
            <div class="phome-space__wx-temp">${escapeHtml(String(weather.temperature))}°</div>
            <div class="phome-space__wx-desc">${escapeHtml(weather.description || '')}</div>
            <div class="phome-space__wx-extra">湿度 ${escapeHtml(String(weather.humidity ?? '--'))}% · 风 ${escapeHtml(String(weather.wind ?? '--'))} 级</div>
        `;
    } else {
        wxBody = `
            <div class="phome-space__wx-icon">城</div>
            <div class="phome-space__wx-desc">暂无天气映射</div>
            <div class="phome-space__wx-extra">到「天气 App」添加 ${cityName} 再回此页</div>
        `;
    }

    const chronoBadge = world?.chronologySettings?.enabled
        ? `<span class="phome-space__chrono-badge">${phaseLabel} · 现实 ${realHm}</span>`
        : `<span class="phome-space__chrono-badge">现实 ${realHm}</span>`;

    return `
        <div class="phome-space__wx">
            <div class="phome-space__wx-head">
                <div class="phome-space__wx-head-row">
                    <div class="phome-space__place-name">${placeName}</div>
                    <div class="phome-space__city-name">${cityName}</div>
                </div>
            </div>
            <div class="phome-space__wx-body">${wxBody}</div>
            ${chronoBadge}
        </div>
    `;
}

// ============================================
// 当前所在
// ============================================

function renderSpaceCurrentLocation(data, persona) {
    const { currentSeg, todaySchedule } = data;
    if (todaySchedule.length === 0) {
        return `
            <div class="phome-space__current phome-space__current--empty">
                <div class="phome-space__current-label">今日行程</div>
                <div class="phome-space__current-text">尚未生成 · 点下方「生成今日日程」让 AI 规划</div>
            </div>
        `;
    }
    if (!currentSeg) {
        return `
            <div class="phome-space__current phome-space__current--idle">
                <div class="phome-space__current-label">当前</div>
                <div class="phome-space__current-text">空闲时段 · 日程已规划 ${todaySchedule.length} 段</div>
            </div>
        `;
    }
    const segName = escapeHtml(currentSeg.locationName || currentSeg.locationId);
    const placeName = escapeHtml(currentSeg.placeName || '');
    const activity = escapeHtml(currentSeg.activity || '');
    const timeRange = formatHourRangeLabel(currentSeg.fromHour, currentSeg.toHour, data.world?.chronologySettings);
    return `
        <div class="phome-space__current">
            <div class="phome-space__current-label">现在应在</div>
            <div class="phome-space__current-text">
                <strong>${segName}</strong>${placeName ? ` · ${placeName}` : ''}
            </div>
            <div class="phome-space__current-time">${timeRange} 时段 · ${activity}</div>
        </div>
    `;
}

// ============================================
// 可去场所列表(按地点分组)
// ============================================

function renderSpaceLocationsList(data) {
    const { accessible, world } = data;
    if (!world) {
        return `<div class="phome-space__hint">未绑定世界观,空间不可用。</div>`;
    }
    if (accessible.length === 0) {
        return `
            <div class="phome-space__hint">
                此人设还没在任何场所被勾选为「可以去」。
                <br>到 <strong>设置 → 世界观 → ${escapeHtml(world.name)}</strong> 编辑场所,把当前人设加到「访问备注」里。
            </div>
        `;
    }

    // 按地点分组
    const groups = new Map();
    for (const a of accessible) {
        const key = a.place?.id || 'unbound';
        if (!groups.has(key)) groups.set(key, { place: a.place, items: [] });
        groups.get(key).items.push(a);
    }

    const groupsHtml = Array.from(groups.values()).map(g => {
        const placeName = escapeHtml(g.place?.name || '未分组');
        const itemsHtml = g.items.map(item => {
            const locName = escapeHtml(item.location?.name || item.location?.id);
            const note = item.accessConfig?.note ? escapeHtml(item.accessConfig.note) : '';
            const freqLabel = item.frequencyLabel;
            const freqCls = `phome-space__freq phome-space__freq--${item.frequencyValue}`;
            return `
                <div class="phome-space__loc-row">
                    <div class="phome-space__loc-name">${locName}</div>
                    <div class="${freqCls}">${freqLabel}</div>
                    ${note ? `<div class="phome-space__loc-note">${note}</div>` : ''}
                </div>
            `;
        }).join('');
        return `
            <div class="phome-space__place-group">
                <div class="phome-space__place-title">${placeName}</div>
                <div class="phome-space__loc-list">${itemsHtml}</div>
            </div>
        `;
    }).join('');

    return `<div class="phome-space__groups">${groupsHtml}</div>`;
}

// ============================================
// 今日日程预览 + 校验警告
// ============================================

function renderSpaceSchedulePreview(data, persona) {
    const { todaySchedule, sdk, weeklyEvents } = data;
    const rhythmEntries = Array.isArray(persona?.rhythm?.entries) ? persona.rhythm.entries : [];
    const locationNameById = {};
    for (const a of (data.accessible || [])) {
        if (a.location?.id) locationNameById[a.location.id] = a.location.name;
    }
    const rhythmWarn = validateScheduleAgainstRhythm(todaySchedule, rhythmEntries, locationNameById);
    const weeklyWarn = validateScheduleAgainstWeekly(todaySchedule, weeklyEvents);
    const warns = [...rhythmWarn, ...weeklyWarn];

    if (todaySchedule.length === 0) {
        return `<div class="phome-space__sched-empty">还没有今日行程</div>`;
    }

    const rowsHtml = todaySchedule.map(seg => {
        const timeLabel = formatHourRangeLabel(seg.fromHour, seg.toHour, data.world?.chronologySettings);
        const name = escapeHtml(seg.locationName || seg.locationId);
        const place = escapeHtml(seg.placeName || '');
        const activity = escapeHtml(seg.activity || '');
        const conf = Math.round((seg.confidence ?? 0.5) * 100);
        const phaseTag = seg.phase === 'past'
            ? `<span class="phome-space__sched-phase phome-space__sched-phase--past">已发生</span>`
            : `<span class="phome-space__sched-phase phome-space__sched-phase--future">即将</span>`;
        return `
            <div class="phome-space__sched-row${seg.phase === 'past' ? ' is-past' : ' is-future'}">
                <div class="phome-space__sched-time">${timeLabel}</div>
                <div class="phome-space__sched-main">
                    <div class="phome-space__sched-name">${name}${place ? ` · ${place}` : ''} ${phaseTag}</div>
                    <div class="phome-space__sched-activity">${activity}</div>
                </div>
                <div class="phome-space__sched-conf" title="置信度 ${conf}%">${conf}%</div>
            </div>
        `;
    }).join('');

    const warnHtml = warns.length > 0 ? `
        <div class="phome-space__warn">
            <div class="phome-space__warn-title">! ${warns.length} 处与作息/本周日程不匹配</div>
            ${warns.map(w => `<div class="phome-space__warn-row">${escapeHtml(w.reason)}</div>`).join('')}
        </div>
    ` : '';

    return `
        <div class="phome-space__sched">
            ${rowsHtml}
        </div>
        ${warnHtml}
    `;
}

// ============================================
// 操作栏
// ============================================

function renderSpaceActionBar(data) {
    const { todaySchedule } = data;
    const hasSched = todaySchedule.length > 0;
    return `
        <div class="phome-space__actions">
            <button class="persona-btn persona-btn--small" ${spAction('personaSpaceGenerateTodaySchedule', {})}>
                ${hasSched ? '重 roll 今日日程' : '生成今日日程'}
            </button>
        </div>
    `;
}

// ============================================
// 主入口
// ============================================

export function renderSpaceBlock(app, persona) {
    if (!persona?.boundWorldId) {
        return `
            <section class="phome-card phome-card--space">
                <header class="phome-card__head">
                    <div class="phome-card__title">空间</div>
                    <div class="phome-card__sub">未绑定世界观 · 绑定后可启用行程生成</div>
                </header>
            </section>
        `;
    }
    const data = readSpaceData(app, persona);

    const injectMode = persona?.space?.injectMode || 'none';
    const INJECT_LABELS = { none: '注入关', current: '注入' };
    const injectLabel = INJECT_LABELS[injectMode] || '注入关';

    return `
        <section class="phome-card phome-card--space">
            <header class="phome-card__head">
                <div class="phome-card__title">空间</div>
                <div class="phome-card__sub">
                    ${escapeHtml(data.world?.name || '')} ·
                    ${data.accessible.length} 个可去场所
                </div>
                <button class="phome-rhythm__inject-btn" ${spAction('personaSpaceCycleInject', {})} title="点击切换注入模式：${injectLabel}">
                    <span class="phome-rhythm__inject-label">${injectLabel}</span>
                </button>
            </header>
            <div class="phome-card__body phome-space">
                ${renderSpaceWeatherCard(data)}
                ${renderSpaceCurrentLocation(data, persona)}
                ${renderSpaceSchedulePreview(data, persona)}
                ${renderSpaceActionBar(data)}

                <div class="phome-space__section-title">可去场所</div>
                ${renderSpaceLocationsList(data)}
            </div>
        </section>
    `;
}

// 暴露给详情面板 / 其他模块用
export {
    renderSpaceWeatherCard,
    renderSpaceCurrentLocation,
    renderSpaceLocationsList,
    renderSpaceSchedulePreview,
    renderSpaceActionBar,
    readSpaceData,
};