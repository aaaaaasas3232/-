/**
 * Settings App · 人设主页 · 渲染层
 *
 * 入口：renderPersonaHome(app)
 *
 * 期间读：
 *   - app.state.personaHome = { entityType, entityId }
 *   - window.settingsSdk（user / ai / world / persona）
 *
 * 期间发：
 *   - 通过 appMethod action 把交互交给 main.js → buildPersonaHomeMethods() 处理
 *
 * 主页内分 5 个 widget：
 *   1. 顶部概览（avatar + 名字 + role + 世界观入口）
 *   2. 心情面板（今日心情 + 重 roll + 权重入口）
 *   3. 周历（7 天，点击切到「这一天日程」）
 *   4. 资产卡片（单 balance + income events）
 *   5. 社媒（今日动态占位）
 *   6. 当前人设上下文（注入模式预览）
 *
 * 注：日记（segments 增删改查 / 生成 / 重 roll）已抽离为独立 App，
 *     不再挂在人设主页内。
 */

import { escapeHtml } from '@/src/core/escape.js';
import { renderPersonaAvatarContent } from './avatar.js';
import { formatDate } from '@/src/core/mood.js';
import { MOOD_LABELS, getMoodIsPositive, getMoodColor, getMoodBorderColor, getMoodIntensityStyle } from '@/src/core/mood.js';
import { renderSpaceBlock } from './space-block.js';
import { getAccessibleLocationsForPersona } from './space-sdk.js';
import { buildContextFromPersona } from './context-text.js';
import {
    computePersonaBalance,
    nextOccurrence,
    formatAmount,
} from './income-engine.js';

export { buildContextFromPersona };

// ============================================
// 辅助函数
// ============================================

function wvAction(method, payload = {}) {
    const obj = { action: 'appMethod', appId: 'settings', method, payload };
    return `data-app-action='${escapeHtml(JSON.stringify(obj))}'`;
}

function wvDetail(pageId) {
    return `data-app-action='${escapeHtml(JSON.stringify({ action: 'detail', appId: 'settings', pageId }))}'`;
}

/**
 * 齿轮式时分选择器（24h）。
 * name 形如 'startTime-h' / 'startTime-m'。
 * value 默认 '00:00'，这样 select 默认 selected 落在第一个有效小时/分钟上。
 * 收集逻辑：当外层 `hasTime` checkbox 未勾选时，把整个时间视为空。
 * disabled：true 时两个 select 加 disabled 属性（用于编辑面板初次渲染时）。
 */
function renderTimeSelect(name, value, disabled = false) {
    const safeValue = value || '00:00';
    const [vH = '00', vM = '00'] = safeValue.split(':');

    const hours = Array.from({ length: 24 }, (_, i) => i).map(h =>
        `<option value="${String(h).padStart(2, '0')}" ${String(h).padStart(2, '0') === vH ? 'selected' : ''}>${String(h).padStart(2, '0')}</option>`
    ).join('');

    const minutes = Array.from({ length: 60 }, (_, i) => i).map(m =>
        `<option value="${String(m).padStart(2, '0')}" ${String(m).padStart(2, '0') === vM ? 'selected' : ''}>${String(m).padStart(2, '0')}</option>`
    ).join('');

    const dis = disabled ? 'disabled' : '';

    return `
        <span class="phome-time">
            <select class="phome-time__select" data-time-field="${name}-h" aria-label="小时" ${dis}>${hours}</select>
            <span class="phome-time__colon">:</span>
            <select class="phome-time__select" data-time-field="${name}-m" aria-label="分钟" ${dis}>${minutes}</select>
        </span>
    `;
}

// 别名保持向后兼容
const renderTimeSelectDisabled = renderTimeSelect;

// ============================================
// 状态读取函数
// ============================================

function pickHome(app) {
    const route = app.state.personaHome || (app.state.personaHome = { entityType: 'user', entityId: 'user0' });
    const sdk = window.settingsSdk;
    if (!sdk) return null;

    const api = route.entityType === 'user' ? sdk.users : sdk.aiPersons;
    let inst = api.get(route.entityId);

    // 兜底：拿 active
    if (!inst) {
        inst = api.getActive();
        if (inst) {
            route.entityType = api === sdk.users ? 'user' : 'ai';
            route.entityId = inst.id;
        }
    }
    return inst || null;
}

function pickEntityType(app) {
    return app.state.personaHome?.entityType || 'user';
}

function pickEntityId(app) {
    // 优先从 state 取，其次从 SDK 获取 active id
    const stateId = app.state?.personaHome?.entityId;
    if (stateId) return stateId;

    const sdk = window.settingsSdk;
    const entityType = app.state?.personaHome?.entityType || 'user';
    if (entityType === 'user') {
        return sdk?.users?.getActive()?.id || 'user0';
    } else {
        return sdk?.aiPersons?.getActive()?.id || 'ai0';
    }
}

function renderAvatarPicker(app, persona) {
    const route = app.state.personaHome || {};
    if (!route.avatarPickerOpen) return '';

    const mode = route.mediaPickerMode === 'background' ? 'background' : 'avatar';
    const images = Array.isArray(route.avatarPickerImages) ? route.avatarPickerImages : [];
    const selectedCode = mode === 'background' ? persona?.profileBackgroundCode : persona?.avatarCode;
    const blur = Math.max(0, Math.min(24, Number(persona?.profileBackgroundBlur) || 0));
    const options = images.map(image => `
        <button class="phome-avatar-picker__option ${mode === 'background' ? 'is-background' : ''} ${image.code === selectedCode ? 'is-active' : ''}"
                ${wvAction(mode === 'background' ? 'personaBackgroundSelect' : 'personaAvatarSelect', { code: image.code })}
                aria-label="选择${mode === 'background' ? '背景' : '头像'} ${escapeHtml(image.name || image.code)}">
            <img src="${escapeHtml(image.src)}" alt="" />
        </button>
    `).join('');
    const onBlurInput = "this.parentElement.querySelector('[data-background-blur-value]').textContent=this.value+' px'";
    const onBlurChange = "window.dispatchEvent(new CustomEvent('settings:slider-change',{detail:{field:'profileBackgroundBlur',value:Number(this.value),appId:'settings',method:'personaBackgroundBlurSet'}}))";

    return `
        <div class="phome-avatar-picker ${route.avatarPickerLoading ? 'is-loading' : ''}">
            <div class="phome-media-tabs">
                <button class="phome-media-tab ${mode === 'avatar' ? 'is-active' : ''}" ${wvAction('personaMediaPickerMode', { mode: 'avatar' })}>头像</button>
                <button class="phome-media-tab ${mode === 'background' ? 'is-active' : ''}" ${wvAction('personaMediaPickerMode', { mode: 'background' })}>卡片背景</button>
            </div>
            <div class="phome-avatar-picker__head">
                <div>
                    <div class="phome-avatar-picker__title">选择当前人设${mode === 'background' ? '背景' : '头像'}</div>
                    <div class="phome-avatar-picker__hint">从已绑定的头像库中选择</div>
                </div>
                ${(mode === 'avatar' ? persona?.avatar : persona?.profileBackground) ? `<button class="phome-avatar-picker__clear" ${wvAction(mode === 'background' ? 'personaBackgroundSelect' : 'personaAvatarSelect', { code: '' })}>恢复默认</button>` : ''}
            </div>
            <div class="phome-avatar-picker__options ${mode === 'background' ? 'is-backgrounds' : ''}">
                ${route.avatarPickerLoading
                    ? '<div class="phome-avatar-picker__empty">正在读取图片库</div>'
                    : options || '<div class="phome-avatar-picker__empty">暂无可选图片，请先在人设资源中绑定头像库</div>'}
            </div>
            ${mode === 'background' ? `
                <label class="phome-background-blur">
                    <span>背景模糊</span>
                    <input class="settings-range" type="range" min="0" max="24" step="1" value="${blur}" oninput="${onBlurInput}" onchange="${onBlurChange}" />
                    <span data-background-blur-value>${blur} px</span>
                </label>
            ` : ''}
        </div>
    `;
}

// ============================================
// 顶部概览
// ============================================

function renderTopBlock(app, persona) {
    const sdk = window.settingsSdk;
    const entityType = pickEntityType(app);
    const boundWorld = (persona?.boundWorldId && sdk)
        ? sdk.worlds.get(persona.boundWorldId)
        : null;

    const role = persona?.role || '';

    const meta = [
        role && `角色 · ${role}`,
        persona?.age && `${persona.age} 岁`,
        boundWorld && `世界观 · ${boundWorld.name || boundWorld.id}`,
        !boundWorld && persona?.boundWorldId === '' && '未绑定世界观',
    ].filter(Boolean).join(' · ');

    return `
        <div class="phome-hero-wrap ${app.state.personaHome?.avatarPickerOpen ? 'is-open' : ''}">
            <button class="phome-hero" ${wvAction('personaAvatarPickerToggle')} aria-expanded="${app.state.personaHome?.avatarPickerOpen ? 'true' : 'false'}">
                <div class="phome-hero__avatar">${renderPersonaAvatarContent(persona)}</div>
                <div class="phome-hero__body">
                    <div class="phome-hero__name">${escapeHtml(persona?.name || persona?.id || '未命名')}</div>
                    ${meta ? `<div class="phome-hero__meta">${escapeHtml(meta)}</div>` : ''}
                    <div class="phome-hero__chips">
                        <span class="phome-chip">${entityType === 'user' ? '用户人设' : 'AI 人设'}</span>
                        ${boundWorld
                            ? `<span class="phome-chip phome-chip--world">${escapeHtml(boundWorld.name || boundWorld.id)}</span>`
                            : ''}
                    </div>
                </div>
                <span class="phome-hero__avatar-hint">更换</span>
            </button>
            ${renderAvatarPicker(app, persona)}
        </div>
    `;
}

// ============================================
// 心情面板（含月历）
// ============================================
// 注意：getMoodColor, getMoodBorderColor, getMoodIntensityStyle 已迁移到 @/src/core/mood.js

function renderMoodCalendar(app, persona) {
    const sdk = window.settingsSdk;
    const route = app.state.personaHome || {};
    const entityType = pickEntityType(app);
    const entityId = pickEntityId(app);

    // 当前显示的月份（默认本月）
    const now = new Date();
    const viewYear = route.calendarYear ?? now.getFullYear();
    const viewMonth = route.calendarMonth ?? (now.getMonth() + 1);

    // 获取该月的所有日记
    const monthDiaries = sdk?.diary?.getMonthDiaries?.(entityType, entityId, viewYear, viewMonth) || [];
    const diaryMap = new Map();
    monthDiaries.forEach(d => diaryMap.set(d.date, d));

    // 构建月历数据
    const firstDay = new Date(viewYear, viewMonth - 1, 1);
    const lastDay = new Date(viewYear, viewMonth, 0);
    const startWeekday = firstDay.getDay(); // 0=周日
    const daysInMonth = lastDay.getDate();
    const todayStr = formatDate(now);

    // 月份名称
    const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月',
                       '七月', '八月', '九月', '十月', '十一月', '十二月'];

    // 周几标题
    const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六'];

    // 前后月按钮
    const prevMonth = viewMonth === 1 ? 12 : viewMonth - 1;
    const prevYear = viewMonth === 1 ? viewYear - 1 : viewYear;
    const nextMonth = viewMonth === 12 ? 1 : viewMonth + 1;
    const nextYear = viewMonth === 12 ? viewYear + 1 : viewYear;

    // 渲染日期格子
    const cells = [];

    // 填充空白格子
    for (let i = 0; i < startWeekday; i++) {
        cells.push('<div class="phome-calendar__cell phome-calendar__cell--empty"></div>');
    }

    // 填充日期
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;
        const isSelected = route.calendarSelectedDate === dateStr;
        const diary = diaryMap.get(dateStr);
        const hasMood = !!diary?.mood;

        // 心情颜色 - 整个格子背景和边框
        let moodStyle = '';
        let dayColor = '';
        if (hasMood) {
            const isPositive = diary.isPositive !== undefined ? diary.isPositive : getMoodIsPositive(diary.mood);
            const intensity = diary.moodIntensity ?? 0.5;
            const moodColor = getMoodColor(isPositive, intensity);
            const borderColor = getMoodBorderColor(isPositive, intensity);
            // 根据浓度调整背景透明度
            const opacity = 0.3 + intensity * 0.5; // 0.3 ~ 0.8
            moodStyle = `background: rgba(${moodColor.match(/\d+/g).join(', ')}, ${opacity}); border-color: ${borderColor};`;
            // 浓度越高数字颜色越深
            const darken = Math.floor(intensity * 80);
            if (isPositive) {
                dayColor = `color: rgb(${200 - darken}, ${50 - darken}, ${70 - darken});`;
            } else {
                dayColor = `color: rgb(${20}, ${80 + darken}, ${180});`;
            }
        }

        const cls = [
            'phome-calendar__cell',
            isToday ? 'is-today' : '',
            isSelected ? 'is-selected' : '',
            hasMood ? 'has-mood' : '',
        ].filter(Boolean).join(' ');

        cells.push(`
            <div class="${cls}" style="${moodStyle}" ${wvAction('personaCalendarSelectDate', { date: dateStr })}>
                <span class="phome-calendar__day" style="${dayColor}">${day}</span>
            </div>
        `);
    }

    const cellsHtml = cells.join('');

    // 日历注入模式
    const injectMode = persona?.moodCalendar?.injectMode || 'none';
    const INJECT_LABELS = { none: '注入关', today: '今天', month: '本月', full: '全部' };
    const injectLabel = INJECT_LABELS[injectMode] || '注入关';

    return `
        <section class="phome-card phome-card--calendar">
            <header class="phome-card__head">
                <div class="phome-card__title">心情日历</div>
                <div class="phome-card__sub">点击日期查看当日心情</div>
                <button class="phome-rhythm__inject-btn" ${wvAction('personaMoodCalendarCycleInject', {})} title="点击切换注入模式：${injectLabel}">
                    <span class="phome-rhythm__inject-label">${injectLabel}</span>
                </button>
            </header>
            <div class="phome-card__body phome-calendar">
                <div class="phome-calendar__header">
                    <button class="phome-calendar__nav" ${wvAction('personaCalendarChangeMonth', { year: prevYear, month: prevMonth })} aria-label="上个月">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M15 18l-6-6 6-6"/>
                        </svg>
                    </button>
                    <div class="phome-calendar__title">${viewYear}年 ${monthNames[viewMonth - 1]}</div>
                    <button class="phome-calendar__nav" ${wvAction('personaCalendarChangeMonth', { year: nextYear, month: nextMonth })} aria-label="下个月">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 18l6-6-6-6"/>
                        </svg>
                    </button>
                </div>
                <div class="phome-calendar__weekdays">
                    ${weekdayLabels.map(d => `<div class="phome-calendar__weekday">${d}</div>`).join('')}
                </div>
                <div class="phome-calendar__grid">
                    ${cellsHtml}
                </div>
            </div>
        </section>
    `;
}

function renderMoodBlock(app, persona) {
    const sdk = window.settingsSdk;
    if (!sdk?.diary) return '';

    const route = app.state.personaHome || {};
    const entityType = pickEntityType(app);
    const entityId = pickEntityId(app);
    const todayRecord = sdk.diary.getToday(entityType, entityId);
    const today = formatDate();

    // 编辑其他日期时，todayRecord 应该保持今天的数据
    const editDate = route.moodEditDate;
    const isEditingOtherDate = route.moodEditMode && editDate && editDate !== today;
    
    // 只有编辑今天时才用 route.moodEditRecord（AI生成/重roll后的待保存数据）
    const pendingData = route.moodEditRecord;
    const effectiveRecord = (pendingData && !isEditingOtherDate) ? pendingData : todayRecord;
    // ★ v0.30 不再 fallback 到 persona.dailyMood —— 心情按日记记录,跨日必须刷新
    const hasTodayMood = !!(effectiveRecord?.mood);
    const mood = hasTodayMood ? effectiveRecord.mood : '';
    const moodIntensity = hasTodayMood ? (effectiveRecord.moodIntensity ?? 0.5) : 0.5;
    const isPositive = hasTodayMood
        ? (effectiveRecord.isPositive !== undefined ? effectiveRecord.isPositive : getMoodIsPositive(mood))
        : true;
    const diary = effectiveRecord?.diary || '';

    const hasWeights = persona?.moodProbability?.enabled
        && persona?.moodProbability?.weights
        && Object.keys(persona.moodProbability.weights).length > 0;

    const moodColor = getMoodColor(isPositive, moodIntensity);
    const intensityStyle = getMoodIntensityStyle(isPositive, moodIntensity);

    // 获取心情预设（支持新旧两种格式）
    const moodPresets = Array.isArray(sdk.diary.MOOD_PRESETS)
        ? sdk.diary.MOOD_PRESETS
        : MOOD_LABELS;

    const presetLabels = typeof moodPresets[0] === 'string'
        ? moodPresets
        : moodPresets.map(m => typeof m === 'string' ? m : m.label);

    // 检查是否在编辑模式（仅当编辑的是今天时才在今日卡片显示编辑表单）
    const isEditingToday = route.moodEditMode && editDate === today;

    // 编辑模式下的数据源：编辑今天时用 pendingData，编辑其他日期时保持显示今天的心情
    const editRecord = route.moodEditRecord;
    const editingMood = isEditingToday && editRecord ? (editRecord.mood || '') : mood;
    const editingIntensity = isEditingToday && editRecord ? (editRecord.moodIntensity ?? 0.5) : moodIntensity;
    const editingDiary = isEditingToday && editRecord ? (editRecord.diary || '') : diary;
    const editingIsPositive = isEditingToday && editRecord
        ? editRecord.isPositive
        : (effectiveRecord?.isPositive !== undefined ? effectiveRecord.isPositive : getMoodIsPositive(mood));

    // 编辑模式下的编辑表单（仅编辑今天时才显示）
    if (isEditingToday) {
        const editIntensity = Math.round(editingIntensity * 100);
        const editColor = getMoodColor(editingIsPositive, editingIntensity);
        const editStyle = `width: ${editIntensity}%`;

        return `
            <section class="phome-card phome-card--mood">
                <header class="phome-card__head">
                    <div class="phome-card__title">编辑心情</div>
                </header>
                <div class="phome-card__body phome-mood-edit-inline">
                    <label class="prompt-form-field">
                        <span>心情</span>
                        <input type="text" data-edit-mood value="${escapeHtml(editingMood)}" placeholder="例如：开心、平静、焦虑">
                    </label>
                    <label class="prompt-form-field">
                        <span>强度 (<span class="intensity-label" data-intensity-label="${editIntensity}">${editIntensity}</span>%)</span>
                        <input type="range" data-edit-intensity min="0" max="100" value="${editIntensity}">
                    </label>
                    <label class="prompt-form-field" style="margin-top: 12px;">
                        <span>日记</span>
                        <textarea data-edit-diary rows="3" placeholder="记录今天的心情...">${escapeHtml(editingDiary)}</textarea>
                    </label>
                </div>
                <div class="phome-mood__actions">
                    <button class="persona-btn persona-btn--small persona-btn--ghost" ${wvAction('personaCancelMoodEdit', {})}>
                        取消
                    </button>
                    <button class="persona-btn persona-btn--small" style="background: #34c759; color: white;" ${wvAction('personaSaveMoodEdit', {})}>
                        保存
                    </button>
                </div>
            </section>
        `;
    }

    // 优先显示待保存的心情（AI生成/重roll后）
    const pendingMood = route.moodPendingSave;
    const hasMoodData = !!(mood); // 有保存的心情数据
    const showMoodActions = pendingMood || hasMoodData;
    const displayMood = pendingMood ? pendingMood.mood : mood;
    const displayIntensity = pendingMood ? pendingMood.moodIntensity : moodIntensity;
    const displayDiary = pendingMood ? pendingMood.diary : diary;
    const displayColor = pendingMood ? getMoodColor(pendingMood.isPositive, pendingMood.moodIntensity) : moodColor;
    const displayStyle = displayIntensity ? `width: ${Math.round(displayIntensity * 100)}%` : intensityStyle;

    return `
        <section class="phome-card phome-card--mood">
            <header class="phome-card__head">
                <div class="phome-card__title">今日心情</div>
                <div class="phome-card__sub">${hasWeights ? '基于心情权重' : '点击选择或重抽'}</div>
            </header>
            <div class="phome-card__body phome-mood">
                <div class="phome-mood__display">
                    <div class="phome-mood__mood-name ${!displayMood ? 'is-placeholder' : ''}" ${displayMood ? `style="color: ${displayColor};"` : ''}>${escapeHtml(displayMood || '点击下方按钮生成心情')}</div>
                    ${displayDiary ? `<div class="phome-mood__diary">${escapeHtml(displayDiary)}</div>` : ''}
                    <div class="phome-mood__intensity-bar">
                        <div class="phome-mood__intensity-track">
                            <div class="phome-mood__intensity-fill" style="${displayStyle}"></div>
                        </div>
                        <div class="phome-mood__intensity-label">${Math.round(displayIntensity * 100)}%</div>
                    </div>
                </div>
                <div class="phome-mood__actions">
                    ${showMoodActions ? `
                    <button class="persona-btn persona-btn--small persona-btn--ghost" ${wvAction('personaRollTodayMood', {})}>
                        重roll
                    </button>
                    <button class="persona-btn persona-btn--small persona-btn--ghost" ${wvAction('personaEditMood', {})}>
                        编辑
                    </button>
                    ` : `
                    <button class="persona-btn persona-btn--small" ${wvAction('personaGenerateMood', {})}>
                        AI生成
                    </button>
                    `}
                </div>
            </div>
        </section>
    `;
}

// ============================================
// 选中日期的「今日日程」详情
// ============================================

function getChronoHourNamesForPersona(persona) {
    const sdk = (typeof window !== 'undefined' ? window.settingsSdk : null);
    const worldId = persona?.boundWorldId;
    const world = worldId && sdk?.worlds?.get ? sdk.worlds.get(worldId) : null;
    const custom = world?.chronologySettings?.customHours;
    return {
        customHours: Array.isArray(custom) ? custom : [],
        enabled: !!world?.chronologySettings?.enabled,
    };
}

function renderScheduleDetail(diary, persona) {
    const sched = Array.isArray(diary?.todaySchedule) ? diary.todaySchedule : [];
    const chrono = getChronoHourNamesForPersona(persona);
    const fmt = (h) => formatHourLabelForDiary(h, chrono);
    const rows = sched.length === 0 ? '' : sched.map(seg => {
        const phaseTag = seg.phase === 'past'
            ? `<span class="phome-mood-detail__sched-phase phome-mood-detail__sched-phase--past">已发生</span>`
            : (seg.phase === 'future'
                ? `<span class="phome-mood-detail__sched-phase phome-mood-detail__sched-phase--future">即将</span>`
                : '');
        return `
        <div class="phome-mood-detail__sched-row${seg.phase === 'past' ? ' is-past' : (seg.phase === 'future' ? ' is-future' : '')}">
            <div class="phome-mood-detail__sched-time">${fmt(seg.fromHour)}–${fmt(seg.toHour)}</div>
            <div class="phome-mood-detail__sched-main">
                <div class="phome-mood-detail__sched-name">${escapeHtml(seg.locationName || seg.locationId)}${seg.placeName ? ` · ${escapeHtml(seg.placeName)}` : ''} ${phaseTag}</div>
                ${seg.activity ? `<div class="phome-mood-detail__sched-activity">${escapeHtml(seg.activity)}</div>` : ''}
            </div>
        </div>
    `;
    }).join('');
    const tag = diary.todayScheduleSource === 'manual' ? '手动' : 'AI';
    return `
        <div class="phome-mood-detail__sched">
            <div class="phome-mood-detail__sched-head">
                <span class="phome-mood-detail__sched-title">今日日程</span>
                <span class="phome-mood-detail__sched-tag">${tag}</span>
            </div>
            ${rows}
        </div>
    `;
}

/**
 * 渲染选中日期的心情详情
 */
function renderMoodDetailPanel(app, persona) {
    const sdk = window.settingsSdk;
    const route = app.state.personaHome || {};
    const selectedDate = route.calendarSelectedDate;

    if (!selectedDate) return '';

    const entityType = pickEntityType(app);
    const entityId = pickEntityId(app);
    const diary = sdk?.diary?.getDateDiary?.(entityType, entityId, selectedDate);

    // 格式化日期
    const dateObj = new Date(selectedDate + 'T00:00:00');
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月',
                       '7月', '8月', '9月', '10月', '11月', '12月'];
    const weekdayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const dateLabel = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日 ${weekdayLabels[dateObj.getDay()]}`;

    // 检查是否在编辑此日期的心情
    const isEditingMoodDetail = route.moodEditMode && route.moodEditDate === selectedDate;
    const editRecord = route.moodEditRecord;
    const today = formatDate();
    const isEditingToday = isEditingMoodDetail && selectedDate === today;

    // 编辑模式：使用 moodEditRecord（AI生成/重roll后的待保存数据优先）
    if (isEditingMoodDetail) {
        const editMood = editRecord?.mood || '';
        const editIntensity = editRecord?.moodIntensity ?? 0.5;
        const editDiary = editRecord?.diary || '';
        const editIsPositive = editRecord?.isPositive ?? true;
        const editColor = getMoodColor(editIsPositive, editIntensity);
        const editIntensityPercent = Math.round(editIntensity * 100);
        // 实时更新强度 badge 的 script
        const intensityOnInput = `var badge=this.closest('.phome-mood-detail__edit-section').querySelector('.phome-mood-detail__intensity-badge');var v=parseInt(this.value)||0;badge.textContent=v+'%';var p=v/100;var isP=p>0.5;var r=isP?Math.max(30,180-p*120)|0:Math.max(20,30+p*80)|0;var g=isP?Math.max(60,180-p*100)|0:Math.max(80,180-p*120)|0;var b=isP?Math.max(70,220-p*100)|0:Math.max(180,255-p*60)|0;badge.style.background='rgba('+r+','+g+','+b+',0.2)';badge.style.color='rgb('+r+','+g+','+b+')';`;

        return `
            <div class="phome-mood-detail">
                <div class="phome-mood-detail__header">
                    <span class="phome-mood-detail__date">${dateLabel}</span>
                </div>
                <div class="phome-mood-detail__edit-section">
                    <div class="phome-mood-detail__edit-label">编辑心情</div>
                    <label class="phome-mood-detail__edit-field">
                        <span class="phome-mood-detail__edit-field-label">心情</span>
                        <input type="text" class="phome-mood-detail__edit-input" data-edit-mood value="${escapeHtml(editMood)}" placeholder="如：平静、开心、焦虑">
                    </label>
                    <label class="phome-mood-detail__edit-field">
                        <span class="phome-mood-detail__edit-field-label">
                            强度 <span class="phome-mood-detail__intensity-badge" id="detail-intensity-badge" style="background: ${editColor}20; color: ${editColor};">${editIntensityPercent}%</span>
                        </span>
                        <input type="range" class="phome-mood-detail__edit-range" data-edit-intensity min="0" max="100" value="${editIntensityPercent}" oninput="${intensityOnInput}">
                    </label>
                    <label class="phome-mood-detail__edit-field">
                        <span class="phome-mood-detail__edit-field-label">日记</span>
                        <textarea class="phome-mood-detail__edit-textarea" data-edit-diary rows="3" placeholder="记录今天的心情...">${escapeHtml(editDiary)}</textarea>
                    </label>
                    <label class="phome-mood-detail__edit-field">
                        <span class="phome-mood-detail__edit-field-label">日程</span>
                        <textarea class="phome-mood-detail__edit-textarea" data-edit-schedule rows="3" placeholder="可选，描述今天的日程安排...">${escapeHtml(editRecord?.todaySchedule ? editRecord.todaySchedule.map(s => `${s.fromHour}:00-${s.toHour}:00 ${s.locationName || s.locationId}${s.activity ? ' ' + s.activity : ''}`).join('\n') : '')}</textarea>
                    </label>
                </div>
                <div class="phome-mood-detail__edit-actions">
                    <button class="phome-mood-detail__edit-btn phome-mood-detail__edit-btn--cancel" ${wvAction('personaCancelMoodEdit', {})}>
                        取消
                    </button>
                    <button class="phome-mood-detail__edit-btn phome-mood-detail__edit-btn--save" ${wvAction('personaSaveMoodEdit', {})}>
                        保存
                    </button>
                </div>
            </div>
        `;
    }

    if (!diary || !diary.mood) {
        return `
            <div class="phome-mood-detail">
                <div class="phome-mood-detail__empty">
                    <div class="phome-mood-detail__date">${dateLabel}</div>
                    <div class="phome-mood-detail__no-mood">暂无心情记录</div>
                    <button class="persona-btn persona-btn--small persona-btn--ghost" ${wvAction('personaEditMood', { date: selectedDate })}>
                        添加心情
                    </button>
                </div>
            </div>
        `;
    }

    const mood = diary.mood;
    const intensity = diary.moodIntensity ?? 0.5;
    const isPositive = diary.isPositive !== undefined ? diary.isPositive : getMoodIsPositive(mood);
    const diaryText = diary.diary || '';
    const moodColor = getMoodColor(isPositive, intensity);
    const intensityStyle = getMoodIntensityStyle(isPositive, intensity);

    return `
        <div class="phome-mood-detail">
            <div class="phome-mood-detail__header">
                <span class="phome-mood-detail__date">${dateLabel}</span>
            </div>
            <div class="phome-mood-detail__mood">
                <span class="phome-mood-detail__mood-name" style="color: ${moodColor};">${escapeHtml(mood)}</span>
            </div>
            <div class="phome-mood-detail__intensity">
                <div class="phome-mood-detail__intensity-track">
                    <div class="phome-mood-detail__intensity-fill" style="${intensityStyle}"></div>
                </div>
                <span class="phome-mood-detail__intensity-label">${Math.round(intensity * 100)}%</span>
            </div>
            ${diaryText ? `<div class="phome-mood-detail__diary">${escapeHtml(diaryText)}</div>` : ''}

            ${renderScheduleDetail(diary, persona)}

            <div class="phome-mood-detail__actions">
                <button class="persona-btn persona-btn--small persona-btn--ghost" ${wvAction('personaEditMood', { date: selectedDate })}>
                    编辑
                </button>
            </div>
        </div>
    `;
}

// ============================================
// 周历（7 天）—— 点击切换「展开日」
//   每格右下角显示日程数量；高亮当前展开日；下方挂当日的 schedule 面板
// ============================================

function renderWeekBlock(app, persona) {
    const sdk = window.settingsSdk;
    const days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        days.push(d);
    }

    const weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];
    const todayStr = formatDate();

    const entityType = pickEntityType(app);
    const entityId = pickEntityId(app);

    const openDate = app.state.personaHome?.scheduleOpenDate || '';

    const injectMode = persona?.schedule?.injectMode || 'none';
    const SCHED_LABELS = { none: '注入关', current: '当前', nearby: '近三天', full: '全部' };
    const injectLabel = SCHED_LABELS[injectMode] || '注入关';
    const injectAction = wvAction('personaScheduleCycleInject', {});

    const items = days.map(d => {
        const date = formatDate(d);
        const dow = d.getDay();
        const isToday = date === todayStr;
        // ★ v0.31：只从 weeklySchedule 读，badge 也只显示每周重复数量
        const weeklyDay = sdk?.weeklySchedule?.getByDay?.(entityType, entityId, dow);
        const weeklyCount = Array.isArray(weeklyDay?.events) ? weeklyDay.events.length : 0;
        const isOpen = openDate === date;

        const cls = [
            'phome-week__day',
            isToday ? 'is-today' : '',
            weeklyCount ? 'has-events' : '',
            isOpen ? 'is-open' : '',
        ].filter(Boolean).join(' ');

        const badge = weeklyCount
            ? `<span class="phome-week__badge">${weeklyCount}</span>`
            : '';

        return `
            <div class="${cls}" ${wvAction('personaScheduleToggleOpen', { date })}>
                <div class="phome-week__num">${d.getDate()}</div>
                <div class="phome-week__wd">${weekdayNames[d.getDay()]}</div>
                ${badge}
            </div>
        `;
    }).join('');

    return `
        <section class="phome-card">
            <header class="phome-card__head">
                <div class="phome-card__title">本周日程</div>
                <div class="phome-card__sub">点击某天查看 / 新增每周重复日程</div>
                <button class="phome-rhythm__inject-btn" ${injectAction} title="点击切换注入模式：${injectLabel}">
                    <span class="phome-rhythm__inject-label">${injectLabel}</span>
                </button>
            </header>
            <div class="phome-card__body">
                <div class="phome-week">${items}</div>
                ${openDate ? renderSchedulePanel(app, openDate) : ''}
            </div>
        </section>
    `;
}

// ============================================
// 作息模块 (Rhythm)
//   不是日程，是「人设习惯」，AI 在对应时段对话时会引用。
//   injectMode: none | current | full
//   数据：persona.rhythm.entries = [{ id, startTime, endTime, daysOfWeek, description }]
// ============================================

/** 生成作息条目 ID。*/
function makeRhythmId() {
    return `rhythm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** 星期中文名（周一…周日）。*/
const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/** 获取当前作息模块。*/
function getRhythmModule(persona) {
    return persona?.rhythm || { enabled: false, injectMode: 'none', entries: [] };
}

/** 从作息条目里解析纪时名称。*/
function getChronoLabel(hour, hourNames) {
    if (hour == null || !hourNames?.length) return '';
    return hourNames[Math.floor((hour + 1) / 2) % 12] || '';
}

/**
 * 心情详情面板里的日程时段标签:遵循当前世界观的纪时制。
 *   - 时辰制(12 项):显示「戌时」「亥时」…
 *   - 24 时制或未开启:显示「19 时」「20 时」…
 */
function formatHourLabelForDiary(hour, chrono) {
    const safeHour = Math.max(0, Math.min(23, Number.parseInt(hour, 10) || 0));
    if (chrono?.enabled && Array.isArray(chrono.customHours) && chrono.customHours.length === 12) {
        const idx = Math.floor((safeHour + 1) / 2) % 12;
        return chrono.customHours[idx] || `${safeHour} 时`;
    }
    return `${safeHour} 时`;
}

/**
 * 把一条作息追加到上下文 sections（按"开始 / 结束是否都有"自动选现实时间 vs 纪时段）。
 *   - daysStr: 已格式化的"周一/周三"等
 */
function appendRhythmLine(sections, indent, e, daysStr, hourNames) {
    const startH = e.startTime ? parseInt(e.startTime.split(':')[0]) : null;
    const endH = e.endTime ? parseInt(e.endTime.split(':')[0]) : null;
    const chronoStart = getChronoLabel(startH, hourNames);
    const chronoEnd = endH != null && endH !== startH ? getChronoLabel(endH, hourNames) : '';
    const prefix = indent || '    ';
    const dayTag = daysStr ? `[${daysStr}]` : '';
    if (chronoStart) {
        const chronoStr = chronoEnd ? `${chronoStart}~${chronoEnd}` : chronoStart;
        sections.push(`${prefix}- ${dayTag}${chronoStr} ${e.description}`);
    } else {
        const range = e.endTime ? `${e.startTime}-${e.endTime}` : e.startTime;
        sections.push(`${prefix}- [${range}]${dayTag} ${e.description}`);
    }
}

/** 取绑定世界观的星期名映射（周一~周日，length=7）。无则用默认。*/
function getWeekDayNames(worldId) {
    const sdk = window.settingsSdk;
    const world = worldId ? sdk?.worlds?.get?.(worldId) : null;
    const list = world?.chronologySettings?.weekDayNames;
    if (Array.isArray(list) && list.length >= 7 && list.every(s => typeof s === 'string' && s.length > 0)) {
        return list.slice(0, 7);
    }
    return ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
}

/** 按 Date 拿所在星期的纪时名（idx 0..6 对应 周一~周日）。*/
function getWeekDayNameForDate(date, worldId) {
    const names = getWeekDayNames(worldId);
    const day = date.getDay(); // 0=Sun
    const idx = day === 0 ? 6 : day - 1; // 转 周一=0..周日=6
    return names[idx] || '';
}

/**
 * 给上下文开头加一句时间观提示：
 *   "用户消息的现实时间 = 当前纪时 XX"
 * 这样 AI 不用反复换算 / 不用追问"现在是几点"。
 * 仅当人设绑定了启用纪时的世界观时返回。
 */
/**
 * 给上下文开头加一句时间观提示：
 *   - 自定义小时/纪时 → 告知 AI "X时" = 现实几个小时
 *   - 自定义周名 → 告知 AI 周一~周日对应叫什么
 *   - 默认 24h / 默认 12时辰 / 默认 周一~周日 → 不必科普
 */
function buildChronoTimeNote(boundWorldId) {
    const sdk = window.settingsSdk;
    const world = boundWorldId ? sdk?.worlds?.get?.(boundWorldId) : null;
    if (!world?.chronologySettings?.enabled) return '';

    const cfg = world.chronologySettings;
    const lines = [];
    lines.push('> 时间观：本世界观使用专属纪时。');

    // 1. 当前时间 + 基准年（用户消息 = 世界时间）
    try {
        const worldTime = sdk.chronology.realToWorld?.(new Date(), boundWorldId);
        if (worldTime) {
            const worldTimeStr = sdk.chronology.format(worldTime, 'full', boundWorldId);
            lines.push(`> - 用户向你发送消息的现实时间（UTC+8 ${formatNowHm()}） = 当前世界时间 ${worldTimeStr}。请直接以此时间观理解用户的"现在"，不必反复换算现实时钟。`);
        }
    } catch (e) { /* ignore */ }

    // 2. 小时映射：默认 24h / 默认 12时辰不科普，自定义要科普
    const customHours = Array.isArray(cfg.customHours) ? cfg.customHours : [];
    const DEFAULT_12_NAMES = ['子时', '丑时', '寅时', '卯时', '辰时', '巳时',
        '午时', '未时', '申时', '酉时', '戌时', '亥时'];
    const DEFAULT_24_NAMES = Array.from({ length: 24 }, (_, i) => `${i}时`);
    const customHoursKey = customHours.join(',');
    const isPreset12 = customHours.length === 12 && customHoursKey === DEFAULT_12_NAMES.join(',');
    const isPreset24 = customHours.length === 24 && customHoursKey === DEFAULT_24_NAMES.join(',');
    const isPreset = isPreset12 || isPreset24;
    if (customHours.length > 0 && !isPreset) {
        const ratio = cfg.hoursRatio || { base: 1, real: 1 };
        const ratioStr = (ratio.base === ratio.real || !ratio.base || !ratio.real)
            ? ''
            : `（1 时段 = 现实 ${ratio.real / ratio.base} 小时）`;
        lines.push(`> - 时段名称：${customHours.join(' / ')}${ratioStr}。请使用这些时段名指代"X 时~Y 时"这类时间段。`);
    }

    // 3. 周名映射：默认 周一~周日不科普，自定义要科普
    const DEFAULT_WEEK = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const customWeekDays = Array.isArray(cfg.weekDayNames) && cfg.weekDayNames.length >= 7
        ? cfg.weekDayNames.slice(0, 7)
        : null;
    if (customWeekDays) {
        const isDefault = customWeekDays.every((n, i) => DEFAULT_WEEK[i] === n);
        if (!isDefault) {
            const pairs = customWeekDays.map((n, i) => `${n}=${DEFAULT_WEEK[i]}`);
            lines.push(`> - 周名映射：${pairs.join('，')}。当用户提到"周五"等现实周名时，请自动理解为本世界观的"${customWeekDays[4]}"；反之亦然。`);
        }
    }

    if (lines.length <= 1) return ''; // 全是默认，没必要给提示
    return lines.join('\n');
}

function formatNowHm() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 把一条日程追加到上下文 sections。
 *   - 若已映射纪时（hourNames 有值），只输出 `{纪时}`，不再重复 `[16:00-00:00]`
 *   - 否则保留原现实时间字符串
 */
function appendEventTimeLine(sections, indent, e, hourNames) {
    const startH = e.startTime ? parseInt(e.startTime.split(':')[0]) : null;
    const endH = e.endTime ? parseInt(e.endTime.split(':')[0]) : null;
    const chronoStart = getChronoLabel(startH, hourNames);
    const chronoEnd = endH != null && endH !== startH ? getChronoLabel(endH, hourNames) : '';
    const prefix = indent || '    ';
    if (chronoStart) {
        const chronoStr = chronoEnd ? `${chronoStart}~${chronoEnd}` : chronoStart;
        sections.push(`${prefix}- ${chronoStr} ${e.title}`);
    } else {
        const timeStr = e.endTime ? `${e.startTime}-${e.endTime}` : (e.startTime || '');
        sections.push(`${prefix}- [${timeStr}] ${e.title}`);
    }
}

/** 取当前人设绑定世界观的纪时名数组（无则空数组）。*/
function getHomeHourNames(app) {
    const sdk = window.settingsSdk;
    if (!sdk?.chronology) return [];
    const persona = pickHome(app);
    const worldId = persona?.boundWorldId;
    if (!worldId) return [];
    return sdk.chronology.getHourNames?.(worldId) || [];
}

function renderRhythmBlock(app) {
    const sdk = window.settingsSdk;
    if (!sdk) return '';

    const persona = pickHome(app);
    const module = getRhythmModule(persona);

    if (!module || !module.enabled) {
        const enableAction = wvAction('personaRhythmToggleEnabled', {});
        return `
            <section class="phome-card phome-card--rhythm">
                <header class="phome-card__head">
                    <div class="phome-card__title">作息</div>
                    <div class="phome-card__sub">未启用 · 点击下方按钮快速开启</div>
                    <button class="phome-rhythm__inject-btn" ${enableAction} title="快速启用作息">
                        <span class="phome-rhythm__inject-label">启用</span>
                    </button>
                </header>
            </section>
        `;
    }

    const worldId = persona.boundWorldId;
    const hourNames = worldId && sdk.chronology
        ? (sdk.chronology.getHourNames?.(worldId) || [])
        : [];

    const nowHour = new Date().getHours();
    const nowDay = new Date().getDay(); // 0=Sun
    const nowDayIndex = nowDay === 0 ? 6 : nowDay - 1; // Mon=0 … Sun=6

    // injectMode 切换
    const injectMode = module.injectMode || 'none';
    const injectLabel = injectMode === 'none' ? '注入关'
        : injectMode === 'current' ? '当前'
        : '全部';
    const injectAction = wvAction('personaRhythmCycleInject', {});

    // 渲染当前时段匹配条目
    const currentEntry = module.entries?.find(e => {
        const sh = parseInt(e.startTime?.split(':')[0]) ?? null;
        if (sh == null) return false;
        const eh = e.endTime ? parseInt(e.endTime.split(':')[0]) : sh;
        const matchesHour = nowHour >= sh && nowHour <= eh;
        const matchesDay = !e.daysOfWeek?.length || e.daysOfWeek.includes(nowDayIndex);
        return matchesHour && matchesDay;
    });

    const currentShi = hourNames.length ? hourNames[Math.floor((nowHour + 1) / 2) % 12] : '';
    const currentText = currentEntry?.description || '';

    // 条目列表
    const entries = Array.isArray(module.entries) ? module.entries : [];
    const editing = !!app.state.personaHome?.rhythmEditing;

    const itemsHtml = entries.length
        ? entries.map((entry, idx) => renderRhythmRow(entry, idx, hourNames, editing)).join('')
        : `<div class="phome-rhythm__empty">还没有作息 · 点下方「添加一条」开始记录</div>`;

    return `
        <section class="phome-card phome-card--rhythm">
            <header class="phome-card__head">
                <div class="phome-card__title">作息</div>
                <div class="phome-card__sub" style="display:flex;align-items:center;gap:6px;">
                    ${currentShi ? `<span>${escapeHtml(currentShi)}</span>` : ''}
                    ${currentText ? `<span>·</span><span>${escapeHtml(currentText)}</span>` : ''}
                </div>
                <button class="phome-rhythm__inject-btn" ${injectAction} title="点击切换注入模式：${injectLabel}">
                    <span class="phome-rhythm__inject-label">${injectLabel}</span>
                </button>
            </header>
            <div class="phome-card__body phome-rhythm">
                ${currentEntry ? `
                    <div class="phome-rhythm__current">
                        <div class="phome-rhythm__current-label">当前时段</div>
                        <div class="phome-rhythm__current-text">${escapeHtml(currentEntry.description || '')}</div>
                    </div>
                ` : ''}
                <div class="phome-rhythm__list">${itemsHtml}</div>
                ${app.state.personaHome?.rhythmDraft ? renderRhythmDraft(app, hourNames) : ''}
                <div class="phome-rhythm__actions">
                    ${editing
                        ? `<button class="persona-btn persona-btn--small" ${wvAction('personaRhythmFinishEdit')}>完成</button>`
                        : `<button class="persona-btn persona-btn--small persona-btn--ghost" ${wvAction('personaRhythmEdit')}>编辑</button>`}
                    <button class="persona-btn persona-btn--small persona-btn--ghost" ${wvAction('personaRhythmAddDraft')}>添加一条</button>
                </div>
            </div>
        </section>
    `;
}

/* 作息条目一行。*/
function renderRhythmRow(entry, idx, hourNames, editing) {
    const startH = parseInt(entry.startTime?.split(':')[0]) ?? null;
    const endH = entry.endTime ? parseInt(entry.endTime.split(':')[0]) : null;
    const chronoStart = startH != null ? getChronoLabel(startH, hourNames) : '';
    const chronoEnd = endH != null ? getChronoLabel(endH, hourNames) : '';

    const timeRange = entry.endTime
        ? `${entry.startTime}-${entry.endTime}`
        : entry.startTime;

    const dayBadges = Array.isArray(entry.daysOfWeek) && entry.daysOfWeek.length < 7
        ? entry.daysOfWeek.map(d => `<span class="phome-rhythm__day">${DAY_NAMES[d] || ''}</span>`).join('')
        : '<span class="phome-rhythm__day phome-rhythm__day--all">每天</span>';

    const removeBtn = editing
        ? `<button class="phome-rhythm__remove" ${wvAction('personaRhythmRemove', { id: entry.id })} aria-label="删除">×</button>`
        : '';

    return `
        <div class="phome-rhythm__item">
            <div class="phome-rhythm__head">
                <span class="phome-rhythm__time">${escapeHtml(timeRange)}</span>
                ${chronoStart
                    ? `<span class="phome-rhythm__chrono">${escapeHtml(chronoStart)}${chronoEnd && chronoEnd !== chronoStart ? '~' + escapeHtml(chronoEnd) : ''}</span>`
                    : ''}
                ${removeBtn}
            </div>
            <div class="phome-rhythm__text">${entry.description ? escapeHtml(entry.description) : '<span class="phome-rhythm__muted">（无描述）</span>'}</div>
            <div class="phome-rhythm__days">${dayBadges}</div>
        </div>
    `;
}

/* 添加/编辑作息条目表单。*/
function renderRhythmDraft(app, hourNames) {
    const draft = app.state.personaHome?.rhythmDraft || {};
    const isEdit = !!draft.id;
    const startVal = draft.startTime || '';
    const endVal = draft.endTime || '';
    const descVal = draft.description || '';
    const daysVal = draft.daysOfWeek || [];
    const daysChecked = (n) => daysVal.includes(n) ? 'checked' : '';

    // 时间选项：06:00 ~ 23:00 每30分钟
    const timeOptions = [];
    for (let h = 6; h <= 23; h++) {
        for (let m = 0; m < 60; m += 30) {
            const t = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
            timeOptions.push(t);
        }
    }

    const makeOpt = (t) => `<option value="${t}" ${startVal === t ? 'selected' : ''}>${t}</option>`;
    const makeEndOpt = (t) => `<option value="${t}" ${endVal === t ? 'selected' : ''}>${t}</option>`;

    const dayCbs = DAY_NAMES.map((d, i) => `
        <label class="phome-rhythm__day-cb">
            <input type="checkbox" value="${i}" ${daysChecked(i)} data-rhythm-day />
            <span>${d}</span>
        </label>
    `).join('');

    return `
        <div class="phome-rhythm__draft">
            <div class="phome-rhythm__draft-row">
                <div class="phome-rhythm__draft-field">
                    <label>开始时间</label>
                    <select class="phome-rhythm__select" data-rhythm-field="startTime">
                        <option value="">— 时:分 —</option>
                        ${timeOptions.map(makeOpt).join('')}
                    </select>
                </div>
                <div class="phome-rhythm__draft-field">
                    <label>结束时间</label>
                    <select class="phome-rhythm__select" data-rhythm-field="endTime">
                        <option value="">— 不限 —</option>
                        ${timeOptions.map(makeEndOpt).join('')}
                    </select>
                </div>
            </div>
            <div class="phome-rhythm__draft-row">
                <div class="phome-rhythm__draft-field">
                    <label>适用星期</label>
                    <div class="phome-rhythm__day-cbs">
                        ${dayCbs}
                        <label class="phome-rhythm__day-cb">
                            <input type="checkbox" data-rhythm-day-all ${daysVal.length === 0 ? 'checked' : ''} />
                            <span>每天</span>
                        </label>
                    </div>
                </div>
            </div>
            <div class="phome-rhythm__draft-row">
                <div class="phome-rhythm__draft-field">
                    <label>活动描述</label>
                    <input type="text" class="phome-rhythm__input" data-rhythm-field="description"
                        placeholder="起床 / 吃午饭 / 看小说" value="${escapeHtml(descVal)}" maxlength="40" />
                </div>
            </div>
            <div class="phome-rhythm__draft-actions">
                <button class="persona-btn persona-btn--small" ${wvAction('personaRhythmSaveDraft')}>${isEdit ? '保存' : '添加'}</button>
                ${isEdit ? `<button class="persona-btn persona-btn--small persona-btn--ghost" ${wvAction('personaRhythmCancelDraft')}>取消</button>` : ''}
            </div>
        </div>
    `;
}

// ============================================
// 当日日程面板（仅在 scheduleOpenDate 非空时渲染）
//   - 列出当日所有日程（按开始时间排序）
//   - 支持新增 / 编辑 / 删除
//   - 通过 data-schedule-field 收集输入字段
// ============================================

// 获取当前人设绑定的世界观的自定义周名称
function getChronoWeekNames(app) {
    const sdk = window.settingsSdk;
    if (!sdk) return null;

    const persona = pickHome(app);
    if (!persona?.boundWorldId) return null;

    const world = sdk.worlds.get(persona.boundWorldId);
    if (!world?.chronologySettings?.enabled) return null;

    const names = world.chronologySettings.weekDayNames;
    if (!Array.isArray(names) || names.length < 7) return null;
    return names;
}

function renderSchedulePanel(app, date) {
    const sdk = window.settingsSdk;
    const entityType = pickEntityType(app);
    const entityId = pickEntityId(app);

    const dateObj = parseYmd(date);
    const dow = dateObj instanceof Date ? dateObj.getDay() : 0;

    // ★ v0.31：始终从 weeklySchedule 读取（按周几存储）
    const weeklyDay = sdk?.weeklySchedule?.getByDay?.(entityType, entityId, dow);
    const events = sortScheduleEvents(Array.isArray(weeklyDay?.events) ? weeklyDay.events : []);
    const hourNames = getHomeHourNames(app);
    const weekNames = getChronoWeekNames(app);

    const eventsHtml = events.length === 0
        ? `<div class="phome-schedule__empty">这周还没有重复日程 · 点下方添加</div>`
        : events.map(e => renderScheduleItem(e, date, app, hourNames)).join('');

    // 日期标签：显示具体日期 + 如果有世界时间映射则显示时段
    let dateLabel = '';
    if (!isNaN(dateObj)) {
        const baseLabel = `${dateObj.getMonth() + 1} 月 ${dateObj.getDate()} 日 · ${
            weekNames
                ? weekNames[(dateObj.getDay() + 6) % 7]
                : ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dateObj.getDay()]
        }`;
        dateLabel = baseLabel;
    } else {
        dateLabel = date;
    }

    return `
        <div class="phome-schedule" data-schedule-date="${escapeHtml(date)}">
            <div class="phome-schedule__head">
                <div class="phome-schedule__date">${escapeHtml(dateLabel)}</div>
            </div>
            <div class="phome-schedule__list">
                ${eventsHtml}
            </div>
            <div class="phome-schedule__compose">
                <div class="phome-schedule__compose-title">
                    <input type="text" class="phome-schedule__input phome-schedule__title-input"
                        data-schedule-field="title" placeholder="每周重复日程标题（必填）" maxlength="32" />
                </div>
                <label class="phome-schedule__time-toggle">
                    <input type="checkbox" data-schedule-field="hasTime" />
                    <span>指定时间（不勾 = 全天）</span>
                </label>
                <div class="phome-schedule__compose-row is-disabled" data-time-row>
                    <label class="phome-time-label">起</label>
                    ${renderTimeSelect('startTime', '00:00', false)}
                    <span class="phome-schedule__dash">至</span>
                    <label class="phome-time-label">止</label>
                    ${renderTimeSelect('endTime', '00:00', false)}
                </div>
                <textarea class="phome-schedule__textarea"
                    data-schedule-field="note" placeholder="备注（可选）" rows="2" maxlength="120"></textarea>
                <div class="phome-schedule__compose-actions">
                    <button class="persona-btn persona-btn--small" data-schedule-add>添加每周重复</button>
                </div>
            </div>
        </div>
    `;
}

function sortScheduleEvents(events) {
    const ts = (e) => {
        // 全天视作 00:00 排在最前;无 startTime 直接给 0,排在最前
        if (!e || !e.startTime) return -1;
        const [h, m] = String(e.startTime).split(':').map((n) => parseInt(n, 10) || 0);
        return h * 60 + m;
    };
    return [...events].sort((a, b) => {
        const ta = ts(a);
        const tb = ts(b);
        if (ta !== tb) return ta - tb;
        // 同时间再按 createdAt 兜底
        return (a?.createdAt || 0) - (b?.createdAt || 0);
    });
}

function renderScheduleItem(event, date, app, hourNames = []) {
    const hasStart = !!event.startTime;
    const hasEnd = !!event.endTime;
    const timeLabel = hasStart
        ? (hasEnd ? `${event.startTime} – ${event.endTime}` : event.startTime)
        : '全天';

    const startH = hasStart ? parseInt(event.startTime.split(':')[0]) : null;
    const endH = hasEnd ? parseInt(event.endTime.split(':')[0]) : startH;
    const chronoStart = getChronoLabel(startH, hourNames);
    const chronoEnd = hasEnd && endH !== startH ? getChronoLabel(endH, hourNames) : '';
    const chronoText = chronoStart
        ? `${chronoStart}${chronoEnd ? '~' + chronoEnd : ''}`
        : '';

    const pressedId = app?.state?.personaHome?.schedulePressed;
    const isPressed = pressedId === event.id;
    const isEditing = pressedId === `edit::${event.id}`;

    // 进入编辑态时,继续保留模糊/弱化的「按压」视觉,只是把浮层换成交互表单
    const isDimmed = isPressed || isEditing;

    return `
        <article class="phome-schedule__item ${isDimmed ? 'is-pressed' : ''}" data-schedule-edit-id="${escapeHtml(event.id)}">
            <div class="phome-schedule__item-main">
                <div class="phome-schedule__head-row">
                    <span class="phome-schedule__time">${escapeHtml(timeLabel)}</span>
                    ${chronoText ? `<span class="phome-schedule__chrono">${escapeHtml(chronoText)}</span>` : ''}
                    <span class="phome-schedule__title">${escapeHtml(event.title)}</span>
                </div>
                ${event.note ? `<div class="phome-schedule__note">${escapeHtml(event.note)}</div>` : ''}
            </div>
            <div class="phome-schedule__item-actions" ${isEditing ? 'hidden' : ''}>
                <button class="phome-schedule__item-btn" data-schedule-longpress-edit="${escapeHtml(event.id)}" aria-label="编辑">编辑</button>
                <button class="phome-schedule__item-btn phome-schedule__item-btn--danger" data-schedule-longpress-remove="${escapeHtml(event.id)}" aria-label="删除">删除</button>
            </div>
            <div class="phome-schedule__edit-panel" ${isEditing ? '' : 'hidden'}>
                <input type="text" class="phome-schedule__input"
                    data-edit-field="title" value="${escapeHtml(event.title)}" placeholder="标题" maxlength="32" />
                <label class="phome-schedule__time-toggle">
                    <input type="checkbox" data-edit-field="hasTime" ${(event.startTime || event.endTime) ? 'checked' : ''} />
                    <span>指定时间（不勾 = 全天）</span>
                </label>
                <div class="phome-schedule__compose-row ${(event.startTime || event.endTime) ? '' : 'is-disabled'}" data-time-row>
                    <label class="phome-time-label">起</label>
                    ${renderTimeSelect('startTime', event.startTime || '00:00', false)}
                    <span class="phome-schedule__dash">至</span>
                    <label class="phome-time-label">止</label>
                    ${renderTimeSelect('endTime', event.endTime || '00:00', false)}
                </div>
                <textarea class="phome-schedule__textarea"
                    data-edit-field="note" placeholder="备注" rows="2" maxlength="120">${escapeHtml(event.note || '')}</textarea>
                <div class="phome-schedule__compose-actions">
                    <button class="persona-btn persona-btn--small" data-schedule-save="${escapeHtml(event.id)}">保存</button>
                    <button class="persona-btn persona-btn--small persona-btn--ghost" data-schedule-cancel>取消</button>
                </div>
            </div>
        </article>
    `;
}

function parseYmd(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(NaN);
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
}

// ============================================
// 资产卡片（v2：单 balance + 任意 income events，无 emoji、无固定标签）
// ============================================

function renderAssetBlock(app, persona) {
    const sdk = window.settingsSdk;

    // 未绑定世界观：提示去绑定
    if (!persona?.boundWorldId) {
        return `
            <section class="phome-card">
                <header class="phome-card__head">
                    <div class="phome-card__title">资产</div>
                    <div class="phome-card__sub">绑定世界观后可启用金币</div>
                </header>
                <div class="phome-card__body">
                    <div class="phome-asset__hint">关联的世界观会决定基准货币单位（金币、银币…）</div>
                </div>
            </section>
        `;
    }

    const world = sdk?.worlds?.get(persona.boundWorldId);
    if (!world) {
        return `
            <section class="phome-card">
                <header class="phome-card__head">
                    <div class="phome-card__title">资产</div>
                    <div class="phome-card__sub">世界观数据异常</div>
                </header>
            </section>
        `;
    }

    const currencies = world.currencies || [];
    const baseCurrency = currencies.find(c => c.isBase) || currencies[0];
    if (!baseCurrency) {
        return `
            <section class="phome-card">
                <header class="phome-card__head">
                    <div class="phome-card__title">资产</div>
                    <div class="phome-card__sub">世界观还未配置基准货币</div>
                </header>
                <div class="phome-card__body">
                    <button class="persona-btn persona-btn--ghost" ${wvAction('openWorldAssets')}>
                        去配置货币
                    </button>
                </div>
            </section>
        `;
    }

    const unitLabel = baseCurrency.unit ? ` ${escapeHtml(baseCurrency.unit)}` : '';
    const currencyName = escapeHtml(baseCurrency.name);

    // 计算当前实际余额（含积欠收入）
    const { balance, accrued, settledAt } = computePersonaBalance(persona, Date.now());
    const events = Array.isArray(persona.incomeEvents) ? persona.incomeEvents : [];

    const accruedBadge = accrued > 0
        ? `<span class="phome-asset__accrued">本次到账 +${formatAmount(accrued)}${unitLabel}</span>`
        : '';

    // 收入事件列表
    const eventsHtml = events.length === 0
        ? `<div class="phome-income__empty">还没有定时收入 · 可手动设基础余额，或添加收入事件</div>`
        : events.map(e => renderIncomeEventItem(e, unitLabel)).join('');

    return `
        <section class="phome-card phome-card--asset">
            <header class="phome-card__head">
                <div class="phome-card__title">资产</div>
                <div class="phome-card__sub">${currencyName} · 当前 ${formatAmount(balance)}${unitLabel}</div>
            </header>
            <div class="phome-card__body phome-asset">
                <div class="phome-asset__balance">
                    <div class="phome-asset__balance-label">当前余额</div>
                    <div class="phome-asset__balance-row">
                        <span class="phome-asset__balance-value">${formatAmount(balance)}</span>
                        <span class="phome-asset__balance-unit">${unitLabel}</span>
                    </div>
                    ${accruedBadge}
                    <div class="phome-asset__balance-meta">
                        ${events.length > 0
                            ? `<span>共 ${events.length} 条收入事件</span>`
                            : `<span>无定时收入</span>`}
                        ${settledAt > 0 ? `<span>· 上次结算 ${formatDate(new Date(settledAt))}</span>` : ''}
                    </div>
                </div>
                <div class="phome-asset__actions">
                    <button class="persona-btn persona-btn--small" data-asset-set-balance>设置余额</button>
                    <button class="persona-btn persona-btn--small persona-btn--ghost" data-asset-add-income>+ 添加收入事件</button>
                </div>
                <div class="phome-income__list">
                    ${eventsHtml}
                </div>
                <div class="phome-income__compose" hidden data-income-compose>
                    ${renderIncomeComposeForm()}
                </div>
                <div class="phome-asset__balance-compose" hidden data-balance-compose>
                    ${renderBalanceEditForm(balance)}
                </div>
            </div>
        </section>
    `;
}

function renderIncomeEventItem(e, unitLabel) {
    const amount = formatAmount(e.amount || 0);
    const freq = e.frequency || 'monthly';
    const unit = freq === 'weekly' ? '周'
        : freq === 'daily' ? '日'
        : freq === 'once' ? '一次性'
        : '月';

    const next = nextOccurrence(e, Date.now());
    const nextLabel = next ? `下次 ${next}` : '已结束';

    const name = escapeHtml(e.name || '未命名');
    const source = e.source ? escapeHtml(e.source) : '';

    return `
        <article class="phome-income__item" data-event-id="${escapeHtml(e.id)}">
            <div class="phome-income__item-main">
                <div class="phome-income__item-name">${name}</div>
                <div class="phome-income__item-meta">
                    <span class="phome-income__item-amount">${amount}${unitLabel} / ${unit}</span>
                    <span class="phome-income__item-next">${escapeHtml(nextLabel)}</span>
                </div>
                ${source ? `<div class="phome-income__item-source">来源 · ${source}</div>` : ''}
            </div>
            <div class="phome-income__item-actions">
                <label class="phome-income__switch" title="${e.enabled === false ? '已停用' : '已启用'}">
                    <input type="checkbox" data-event-toggle="${escapeHtml(e.id)}" ${e.enabled === false ? '' : 'checked'} />
                    <span>${e.enabled === false ? '停用' : '启用'}</span>
                </label>
                <button class="phome-income__btn" data-event-edit="${escapeHtml(e.id)}">编辑</button>
                <button class="phome-income__btn phome-income__btn--danger" data-event-delete="${escapeHtml(e.id)}">删除</button>
            </div>
        </article>
    `;
}

function renderIncomeComposeForm() {
    return `
        <div class="phome-income__form">
            <div class="phome-income__form-row">
                <label>名称</label>
                <input type="text" class="phome-income__input" data-income-field="name"
                    placeholder="例如 工资 / 兼职收入 / 主播打赏…" maxlength="24" />
            </div>
            <div class="phome-income__form-row">
                <label>金额</label>
                <input type="number" class="phome-income__input" data-income-field="amount"
                    step="0.01" placeholder="0" />
            </div>
            <div class="phome-income__form-row">
                <label>周期</label>
                <select class="phome-income__input" data-income-field="frequency">
                    <option value="monthly">每月</option>
                    <option value="weekly">每周</option>
                    <option value="daily">每天</option>
                    <option value="once">一次性</option>
                </select>
            </div>
            <div class="phome-income__form-row" data-income-freq="monthly">
                <label>每月哪一天</label>
                <input type="number" class="phome-income__input" data-income-field="dayOfMonth"
                    min="1" max="31" value="1" />
            </div>
            <div class="phome-income__form-row" data-income-freq="weekly" hidden>
                <label>每周星期几</label>
                <select class="phome-income__input" data-income-field="dayOfWeek">
                    <option value="0">周日</option>
                    <option value="1">周一</option>
                    <option value="2">周二</option>
                    <option value="3">周三</option>
                    <option value="4">周四</option>
                    <option value="5">周五</option>
                    <option value="6">周六</option>
                </select>
            </div>
            <div class="phome-income__form-row" data-income-freq="once" hidden>
                <label>发放日期</label>
                <input type="date" class="phome-income__input" data-income-field="startDateOnce" />
            </div>
            <div class="phome-income__form-actions">
                <button class="persona-btn persona-btn--small" data-income-save>保存</button>
                <button class="persona-btn persona-btn--small persona-btn--ghost" data-income-cancel>取消</button>
            </div>
        </div>
    `;
}

function renderBalanceEditForm(currentBalance) {
    return `
        <div class="phome-asset__balance-form">
            <div class="phome-income__form-row">
                <label>设置基础余额</label>
                <input type="number" class="phome-income__input" data-balance-field="balance"
                    step="0.01" value="${formatAmount(currentBalance)}" />
                <div class="phome-asset__hint-sm">已自动结算所有积欠收入，新值会直接覆盖</div>
            </div>
            <div class="phome-income__form-actions">
                <button class="persona-btn persona-btn--small" data-balance-save>保存</button>
                <button class="persona-btn persona-btn--small persona-btn--ghost" data-balance-cancel>取消</button>
            </div>
        </div>
    `;
}

// ============================================
// 社媒形象配置（v0.19 murmur/博客/日记）
// ============================================

// ★ 已删除:isOnline / formatOnlineHours 导入(chat-app 不再展示"在线/离线")
import { getSocialProfile } from './social-profile.js';
// 社交 App 注册表：人设页上有哪几张「社媒形象」卡由它决定
import { listSocialApps } from '@/src/core/social-app-registry.js';

/**
 * 渲染单个社媒软件配置卡片
 */
function renderSocialAppCard(app, persona, appId, appInfo) {
    const profile = getSocialProfile(persona, appId);
    const route = app.state.personaHome || {};
    const isExpanded = route.socialProfileExpanded === appId;
    const pending = route.socialProfilePending || {};
    const fields = appInfo.fields;

    // 当前配置状态（考虑 pending）
    const effectiveNickname = pending.nickname || profile.nickname || '';
    const effectiveSignature = pending.signature || profile.signature || '';
    const effectiveAvatarCode = pending.avatarCode || profile.avatarCode || '';
    const effectiveBackgroundCode = pending.backgroundCode || profile.backgroundCode || '';
    // ★ 已删除:effectiveOnlineHours(原用于在线/离线 badge,chat-app 已下线)

    // 摘要只统计这个 App 真的会配的字段 —— 否则 murmur 时代残留在
    // socialProfiles 里的签名会跑到氧气/萤火的卡上当作「已配置」。
    const configParts = [];
    if (fields.includes('nickname') && effectiveNickname) {
        configParts.push(`网名: ${escapeHtml(effectiveNickname)}`);
    }
    if (fields.includes('signature') && effectiveSignature) {
        configParts.push(`签名: ${escapeHtml(effectiveSignature.substring(0, 10))}${effectiveSignature.length > 10 ? '...' : ''}`);
    }
    if (fields.includes('avatar') && effectiveAvatarCode) configParts.push('已选头像');
    if (fields.includes('background') && effectiveBackgroundCode) configParts.push('已选背景');
    // ★ 已删除:formatOnlineHours(configParts)

    const configSummary = configParts.length > 0
        ? configParts.join(' · ')
        : '点击配置';

    // 底色跟着 App 走。少了它，图标就是一个飘在白底上的图形
    // （murmur 的两颗星、萤火的播放键本来都是靠底色撑起来的）。
    const iconStyle = appInfo.iconBg ? ` style="background:${escapeHtml(appInfo.iconBg)}"` : '';

    return `
        <div class="phome-social__app-card ${isExpanded ? 'is-expanded' : ''}">
            <div class="phome-social__app-header" ${wvAction('socialProfileToggle', { appId })}>
                <div class="phome-social__app-icon"${iconStyle}>
                    ${appInfo.icon}
                </div>
                <div class="phome-social__app-info">
                    <div class="phome-social__app-name">${escapeHtml(appInfo.name)}</div>
                    <div class="phome-social__app-status">${escapeHtml(configSummary)}</div>
                </div>
                <div class="phome-social__app-chevron">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="m6 9 6 6 6-6"/>
                    </svg>
                </div>
            </div>
            ${isExpanded ? renderSocialAppPanel(app, persona, appId, appInfo, profile) : ''}
        </div>
    `;
}

/**
 * 渲染社媒配置面板
 */
function renderSocialAppPanel(app, persona, appId, appInfo, profile) {
    const route = app.state.personaHome || {};
    const imagePickerOpen = route.socialImagePickerOpen === appId;
    const imagePickerMode = route.socialImagePickerMode || 'avatar';
    const images = Array.isArray(route.socialImagePickerImages) ? route.socialImagePickerImages : [];
    const loading = route.socialImagePickerLoading || false;

    // 当前选中的 code（考虑 pending 状态）
    const pending = route.socialProfilePending || {};
    const effectiveAvatarCode = pending.avatarCode || profile.avatarCode || '';
    const effectiveBackgroundCode = pending.backgroundCode || profile.backgroundCode || '';
    const effectiveAvatar = pending.avatar || profile.avatar || '';
    const effectiveBackground = pending.background || profile.background || '';

    // 获取头像预览 src：优先从选择器缓存找，否则用 URL
    const avatarPreviewSrc = images.find(i => i.code === effectiveAvatarCode)?.src || effectiveAvatar;
    const backgroundPreviewSrc = images.find(i => i.code === effectiveBackgroundCode)?.src || effectiveBackground;

    // 当前选中的 code
    const selectedAvatarCode = effectiveAvatarCode;
    const selectedBackgroundCode = effectiveBackgroundCode;

    // ★ 已删除:startHour / startMinute / endHour / endMinute 读取 profile.onlineHours 的代码
    //   (chat-app 不再展示"在线/离线",时间选择器也已下线)

    const avatarOptions = images.length > 0 ? images.map(img => `
        <button class="phome-social__image-option ${img.code === selectedAvatarCode ? 'is-active' : ''}"
                ${wvAction('socialImageSelect', { appId, type: 'avatar', code: img.code })}>
            <img src="${escapeHtml(img.src)}" alt="" />
        </button>
    `).join('') : '<div class="phome-social__image-empty">暂无头像库图片</div>';

    const backgroundOptions = images.length > 0 ? images.map(img => `
        <button class="phome-social__image-option phome-social__image-option--bg ${img.code === selectedBackgroundCode ? 'is-active' : ''}"
                ${wvAction('socialImageSelect', { appId, type: 'background', code: img.code })}>
            <img src="${escapeHtml(img.src)}" alt="" />
        </button>
    `).join('') : '<div class="phome-social__image-empty">暂无背景库图片</div>';

    // 只渲染这个 App 声明过的字段。以前这里写死五行，结果每个 App 的面板
    // 长得一模一样 —— 氧气 / 萤火 也有「拍一拍」，而拍一拍只有 murmur
    // (chat-page 读 socialProfiles.chat.patSetting) 会用，填了就是白填。
    const fields = appInfo.fields;

    const nicknameRow = !fields.includes('nickname') ? '' : `
            <div class="phome-social__config-row">
                <label class="phome-social__config-label">网名</label>
                <input class="phome-social__config-input"
                       type="text"
                       value="${escapeHtml(profile.nickname || '')}"
                       placeholder="设置在${escapeHtml(appInfo.name)}的显示名称"
                       data-social-nickname="${escapeHtml(appId)}" />
            </div>`;

    const signatureRow = !fields.includes('signature') ? '' : `
            <div class="phome-social__config-row">
                <label class="phome-social__config-label">签名</label>
                <input class="phome-social__config-input"
                       type="text"
                       value="${escapeHtml(profile.signature || '')}"
                       placeholder="一句话介绍自己,展示在通讯录中"
                       maxlength="50"
                       data-social-signature="${escapeHtml(appId)}" />
            </div>`;

    const patRow = !fields.includes('pat') ? '' : `
            <div class="phome-social__config-row">
                <label class="phome-social__config-label">拍一拍</label>
                <input class="phome-social__config-input"
                       type="text"
                       value="${escapeHtml(profile.patSetting || '')}"
                       placeholder="对方拍你时的文案,例如「揉了揉我的脑袋」"
                       maxlength="30"
                       data-social-pat-setting="${escapeHtml(appId)}" />
            </div>`;

    const avatarRow = !fields.includes('avatar') ? '' : `
            <div class="phome-social__config-row">
                <label class="phome-social__config-label">头像</label>
                <div class="phome-social__image-picker-wrap">
                    <button class="phome-social__picker-btn" ${wvAction('socialImagePickerToggle', { appId, mode: 'avatar' })}>
                        ${avatarPreviewSrc
                            ? `<img class="phome-social__preview-img" src="${escapeHtml(avatarPreviewSrc)}" alt="" />`
                            : '<span class="phome-social__preview-placeholder">选择头像</span>'
                        }
                    </button>
                    ${selectedAvatarCode ? `<button class="phome-social__clear-btn" ${wvAction('socialImageSelect', { appId, type: 'avatar', code: '' })}>清除</button>` : ''}
                </div>
            </div>
            ${imagePickerOpen && imagePickerMode === 'avatar' ? `
                <div class="phome-social__image-grid">
                    ${loading ? '<div class="phome-social__image-empty">加载中...</div>' : avatarOptions}
                </div>
            ` : ''}`;

    const backgroundRow = !fields.includes('background') ? '' : `
            <div class="phome-social__config-row">
                <label class="phome-social__config-label">背景</label>
                <div class="phome-social__image-picker-wrap">
                    <button class="phome-social__picker-btn phome-social__picker-btn--bg" ${wvAction('socialImagePickerToggle', { appId, mode: 'background' })}>
                        ${backgroundPreviewSrc
                            ? `<img class="phome-social__preview-img" src="${escapeHtml(backgroundPreviewSrc)}" alt="" />`
                            : '<span class="phome-social__preview-placeholder">选择背景</span>'
                        }
                    </button>
                    ${selectedBackgroundCode ? `<button class="phome-social__clear-btn" ${wvAction('socialImageSelect', { appId, type: 'background', code: '' })}>清除</button>` : ''}
                </div>
            </div>
            ${imagePickerOpen && imagePickerMode === 'background' ? `
                <div class="phome-social__image-grid">
                    ${loading ? '<div class="phome-social__image-empty">加载中...</div>' : backgroundOptions}
                </div>
            ` : ''}`;

    // AI 生成只产出网名 / 头像 / 背景，一个都不配的 App 就别放这个按钮
    const canGenerate = fields.some(f => f === 'nickname' || f === 'avatar' || f === 'background');

    return `
        <div class="phome-social__app-panel">
            ${nicknameRow}
            ${signatureRow}
            ${patRow}
            ${avatarRow}
            ${backgroundRow}

            <!-- ★ 已删除:在线时间段 (chat 专用) 配置 UI。
                 chat-app 不再展示"在线/离线"指示,用户也不需要设置在线时间。
                 persona.socialProfiles[appId].onlineHours 字段不再使用。 -->

            <div class="phome-social__config-actions">
                ${canGenerate ? `<button class="persona-btn persona-btn--small persona-btn--ghost" ${wvAction('socialProfileGenerate', { appId })}>AI 生成</button>` : ''}
                <button class="persona-btn persona-btn--small" ${wvAction('socialProfileSave', { appId })}>保存配置</button>
            </div>
        </div>
    `;
}

// ============================================
// 资金流水卡片（v0.67 私聊红包/转账流水记录）
// ============================================

const TRANSACTION_HISTORY_LIMIT = 50;

/**
 * 渲染单条流水
 */
function renderTransactionFlowItem(entry, personaType) {
    const isIn = entry.direction === 'in';
    const sign = isIn ? '+' : '-';
    const amountClass = isIn ? 'phome-tx__amount--in' : 'phome-tx__amount--out';
    const amountText = `${sign}${formatAmount(entry.amount || 0)}`;

    // 来源文案
    const typeMap = {
        'redpacket': isIn ? '收到红包' : '发红包',
        'transfer': isIn ? '收到转账' : '转账',
        'income-settle': '定时收入到账',
        'manual': '手动调整',
        'unknown': '其他',
    };
    const typeLabel = typeMap[entry.type] || entry.type || '其他';

    const counterparty = entry.counterpartyName ? escapeHtml(entry.counterpartyName) : '';
    const note = entry.note ? escapeHtml(entry.note) : '';

    const date = new Date(entry.timestamp || Date.now());
    const dateText = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

    return `
        <article class="phome-tx__item ${isIn ? 'is-in' : 'is-out'}">
            <div class="phome-tx__item-main">
                <div class="phome-tx__item-title">${typeLabel}${counterparty ? ` · ${counterparty}` : ''}</div>
                ${note ? `<div class="phome-tx__item-note">${note}</div>` : ''}
                <div class="phome-tx__item-meta">${dateText}</div>
            </div>
            <div class="phome-tx__item-amount ${amountClass}">${amountText}</div>
        </article>
    `;
}

/**
 * 渲染资金流水卡片（最近 50 条 + 查看全部按钮）
 *
 * ★ v0.67 私聊红包/转账的水滴,展示在哪里？
 *   - 用户卡 (defaultUserCard): 只展示 user 自己的钱包(资产 + 流水)
 *   - AI 人设卡: 展示 AI 钱包(由用户给 AI 发红包/转账 + 用户从 AI 收红包/转账)
 *   - 流水按 timestamp 倒序
 */
function renderTransactionHistoryBlock(app, persona) {
    const sdk = window.settingsSdk;
    if (!sdk?.assetFlow) {
        return ''; // sdk 未就绪,跳过
    }

    // 判断 entityType
    //   app.state.personaHome.entityType 决定这是 user 还是 ai
    const route = app.state.personaHome || {};
    const entityType = route.entityType || 'user';
    const entityId = route.entityId || '';

    // 默认 user 卡:取默认用户卡 id
    let resolvedId = entityId;
    if (entityType === 'user' && !resolvedId) {
        try {
            resolvedId = sdk?.defaultUserCard?.getDefault?.()?.id || sdk?.users?.getActive?.()?.id || '';
        } catch (_) { resolvedId = ''; }
    }
    if (!resolvedId) return '';

    // 读流水(限制 50 条)
    const flows = sdk.assetFlow.list(entityType, resolvedId, { limit: TRANSACTION_HISTORY_LIMIT });

    const listHtml = flows.length === 0
        ? `<div class="phome-tx__empty">还没有流水记录 · 在私聊中收/发红包、转账就会出现在这里</div>`
        : flows.map((e) => renderTransactionFlowItem(e, entityType)).join('');

    // "查看全部" 按钮:只有当实际数量 >= 50 才显示
    const showAllBtn = flows.length >= TRANSACTION_HISTORY_LIMIT
        ? `<button class="persona-btn persona-btn--small persona-btn--ghost" ${wvAction('openTransactionHistory', { entityType, entityId: resolvedId })}>查看全部</button>`
        : '';

    return `
        <section class="phome-card phome-card--tx">
            <header class="phome-card__head">
                <div class="phome-card__title">钱包流水</div>
                <div class="phome-card__sub">最近 ${flows.length} 条</div>
            </header>
            <div class="phome-card__body phome-tx">
                <div class="phome-tx__list">
                    ${listHtml}
                </div>
                ${showAllBtn ? `<div class="phome-tx__footer">${showAllBtn}</div>` : ''}
            </div>
        </section>
    `;
}

function renderSocialBlock(app, persona) {
    // 社媒软件列表从框架级注册表读，不再在这里硬编码。
    //
    // 以前这里写死了 [chat, blog, diary] 三项（连图标 SVG 都内联）。
    // 那意味着「再做一个 murmur 那样的社交 App」必须来改 settings 的
    // 内部实现 —— 而 App 之间本来只应该通过 registerPhoneApp 这一个口子
    // 打交道。新 App 作者最容易漏的就是这一步，漏了之后的症状是
    // 「人设页里没有我的 App」，而且没有任何报错。
    //
    // 现在 App 只要在 appConfig 里声明 socialProfile 就会自动出现在这里。
    // 详见 src/core/social-app-registry.js。
    const socialApps = listSocialApps().map((entry) => ({
        id: entry.id,
        name: entry.label,
        icon: entry.icon,
        // iconBg / fields 都要带上：前者决定图标底色，后者决定面板上有哪几行。
        // 漏掉任何一个都不会报错，症状只是「所有卡长得一样」。
        iconBg: entry.iconBg,
        desc: entry.desc,
        fields: Array.isArray(entry.fields) ? entry.fields : ['nickname', 'avatar', 'background'],
    }));

    const cardsHtml = socialApps.length > 0
        ? socialApps.map(appInfo => renderSocialAppCard(app, persona, appInfo.id, appInfo)).join('')
        : '<div class="phome-social__empty">还没有 App 声明社媒形象</div>';

    return `
        <section class="phome-card">
            <header class="phome-card__head">
                <div class="phome-card__title">社媒形象</div>
                <div class="phome-card__sub">配置 AI 在各软件的展示形象</div>
            </header>
            <div class="phome-card__body phome-social">
                ${cardsHtml}
            </div>
        </section>
    `;
}

// ============================================
// 当前人设上下文（显示将发送给 AI 的完整上下文）
// ============================================

/**
 * 构建当前人设的完整上下文文本（用于发送给 AI）。
 * 正文在 `context-text.js`，nook 预览和 murmur 共用一份。
 */


export function buildPersonaContextText(app) {
    const sdk = window.settingsSdk;
    if (!sdk) return '';

    const entityType = pickEntityType(app);
    const entityId = pickEntityId(app);
    const api = entityType === 'user' ? sdk.users : sdk.aiPersons;
    const persona = api.get(entityId);

    // 编辑模式下返回草稿
    const isEditing = app.state?.personaHome?.contextEditing;
    if (isEditing) {
        return app.state?.personaHome?.contextDraft || '';
    }

    // 非编辑模式：每次都从 persona 实时重新生成。
    const base = buildContextFromPersona(persona, entityType);

    // 顶部追加一行 target_app 提示，让用户能直观看到「这份上下文是给谁看的」。
    const targetAppId = app.state?.personaHome?.contextAppId || '';
    if (!targetAppId) return base;

    // 反查 app 名称（找不到就只显示 id）
    let targetLabel = targetAppId;
    try {
        const reg = window.externalAppRegistry;
        const found = reg?.apps?.find((a) => a.id === targetAppId);
        if (found?.name) targetLabel = `${found.name} (${targetAppId})`;
    } catch (_) {}

    // 注入到首行（紧跟标题之后），其它 sections 内容保持不变
    const header = `# 角色卡${persona?.name ? ': ' + persona.name : ''}`;
    const banner = `\n# 目标 App\ntarget_app: ${targetLabel}\n`;
    return base.replace(header, `${header}${banner}`);
}

/**
 * 渲染上下文预览区块（显示 YAML+JSON 融合格式，支持编辑）
 */
function renderContextBlock(app) {
    const sdk = window.settingsSdk;
    if (!sdk) return '';

    const contextText = buildPersonaContextText(app);
    const isEmpty = !contextText.trim();

    // 从 app-registry 拉所有已注册 App（realApp 数组，{ id, name, ... }）。
    // ★ 注意要用 externalAppRegistry.apps（运行时注册表）而不是 listApps()，
    //   后者只在依赖图加载完成后才存在。
    let apps = [];
    try {
        const reg = window.externalAppRegistry;
        if (reg && Array.isArray(reg.apps)) {
            apps = reg.apps.map((a) => ({ id: a.id, name: a.name }));
        }
    } catch (_) {
        apps = [];
    }

    // 当前选中的 appId：默认 user home 进「通用」，没存过就一直空字符串。
    const route = app.state?.personaHome || {};
    // 注：state 中的实际 key 是 contextAppId（由 main.js 的 handleContextAppSelect 写入），
    //     这就是「选了哪个 App 看上下文预览」的持久化位。
    const selectedAppId = route.contextAppId || '';
    const isEditing = app.state?.personaHome?.contextEditing;

    // App 选择下拉
    const appOptions = [
        `<option value="" ${selectedAppId === '' ? 'selected' : ''}>通用（所有场景）</option>`,
        ...apps
            .filter((a) => a.id !== 'settings')
            .map(
                (a) =>
                    `<option value="${escapeHtml(a.id)}" ${
                        selectedAppId === a.id ? 'selected' : ''
                    }>${escapeHtml(a.name)}</option>`,
            ),
    ].join('');

    // 刷新按钮（非编辑状态显示在右上角）
    const refreshBtn = `
        <button class="phome-context__action-btn" ${wvAction('contextRefresh')} title="刷新预览">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 2v6h-6"/>
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
                <path d="M3 22v-6h6"/>
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
            刷新
        </button>
    `;

    // 编辑内容区域（只有编辑状态显示）
    const draftText = app.state?.personaHome?.contextDraft || contextText;
    const editAreaContent = `
        <div class="phome-context__edit-area">
            <textarea class="phome-context__textarea" data-context-textarea placeholder="在此编辑人设上下文...">${escapeHtml(draftText)}</textarea>
            <div class="phome-context__edit-toolbar">
                <button class="phome-context__action-btn phome-context__action-btn--ghost" ${wvAction('contextRevert')} title="回退到上次保存的内容">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                        <path d="M3 3v5h5"/>
                    </svg>
                    回退
                </button>
                <div class="phome-context__edit-toolbar-spacer"></div>
                <button class="phome-context__action-btn phome-context__action-btn--danger" ${wvAction('contextCancel')}>取消</button>
                <button class="phome-context__action-btn phome-context__action-btn--primary" ${wvAction('contextSave')}>保存</button>
            </div>
        </div>
    `;

    // 恢复默认按钮（非编辑状态显示在上下文预览下方）
    const restoreDefaultLink = !isEditing ? `
        <button class="phome-context__restore-link" ${wvAction('contextRestoreDefault')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 2v6h-6"/>
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
                <path d="M3 22v-6h6"/>
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
            恢复默认（使用系统生成的上下文）
        </button>
    ` : '';

    // 预览内容（非编辑状态可点击复制）
    let displayContent = '';
    if (isEditing) {
        displayContent = editAreaContent;
    } else if (isEmpty) {
        displayContent = '<div class="phome-context__empty">暂无上下文数据。请完善人设信息后刷新预览。</div>';
    } else {
        displayContent = `
            <pre class="phome-context__raw" data-context-pre ${wvAction('contextCopy')} style="cursor:pointer">${escapeHtml(contextText)}</pre>
            <div class="phome-context__hint">点击复制 · 长按也可</div>
        `;
    }

    const editButton = isEditing ? '' : `
        <button class="phome-context__action-btn phome-context__action-btn--primary" ${wvAction('contextEditStart')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            编辑
        </button>
    `;

    return `
        <section class="phome-card">
            <header class="phome-card__head">
                <div class="phome-card__title">当前人设上下文</div>
                <div class="phome-card__sub">发送给 AI 的完整人设</div>
            </header>
            <div class="phome-card__body phome-context">
                <div class="phome-context__controls">
                    <div class="phome-context__app-select">
                        <label class="phome-context__select-label">目标 App</label>
                        <select class="phome-context__select" data-context-app-select>
                            ${appOptions}
                        </select>
                    </div>
                    <div class="phome-context__actions">
                        ${!isEditing ? refreshBtn : ''}
                        ${editButton}
                    </div>
                </div>
                ${displayContent}
                ${!isEmpty && !isEditing ? `
                    <div class="phome-context__restore-wrap">
                        <button class="phome-context__restore-link" ${wvAction('contextRestoreDefault')}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 2v6h-6"/>
                                <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
                                <path d="M3 22v-6h6"/>
                                <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
                            </svg>
                            恢复默认（使用系统生成的上下文）
                        </button>
                    </div>
                ` : ''}
            </div>
        </section>
    `;
}

// ============================================
// 主入口
// ============================================

export function renderPersonaHome(app) {
    const sdk = window.settingsSdk;
    if (!sdk) return '<div class="phome-empty"><div class="phome-empty__text">主页加载中…</div></div>';

    const persona = pickHome(app);
    if (!persona) {
        return `
            <div class="phome-empty">
                <div class="phome-empty__text">还没有人设</div>
                <button class="persona-btn" ${wvDetail(pickEntityType(app))}>去新建</button>
            </div>
        `;
    }

    return `
        <div class="phome-page">
            ${renderTopBlock(app, persona)}
            ${renderMoodCalendar(app, persona)}
            ${renderMoodDetailPanel(app, persona)}
            ${renderMoodBlock(app, persona)}
            ${renderWeekBlock(app, persona)}
            ${renderRhythmBlock(app)}
            ${renderSpaceBlock(app, persona)}
            ${renderAssetBlock(app, persona)}
            ${renderTransactionHistoryBlock(app, persona)}
            ${renderSocialBlock(app, persona)}
            ${renderContextBlock(app)}
        </div>
    `;
}
