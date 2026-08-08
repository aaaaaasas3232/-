/**
 * 小听 - 设置 App · 主入口
 *
 * 整个 App 的结构（iOS Settings 风格）：
 *   - 主页面：顶部「Apple ID」卡 + 7 个分组入口
 *   - detail 子页：外观与通用 / 用户 / AI / 世界观 / 图库 / Prompt / API
 *
 * 入口：
 *   - 外观与通用  → appearance-general/
 *   - 用户        → user/
 *   - AI          → ai/
 *   - 世界观      → world/
 *   - 图库        → gallery/
 *   - Prompt      → prompt/
 *   - API         → api-manager/（新）
 *
 * 本文件只做「组装」：
 *   - 拼出 appConfig（id / name / icon / pages / stores / methods / services）
 *   - 把 SDK bootstrap 委托给各模块（user/ai/world 各自 bootstrap 自己的数据）
 *   - 页面渲染委托给各模块的 section
 *   - 公共 UI 组件（renderRow / renderGroup ...）来自 ui-components.js
 */

import { escapeHtml } from '@/src/core/escape.js';

/** HTML 属性值转义（单向，仅转义 & " < >）*/
function escapeAttr(val) {
    return String(val)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/** 根据当前选中的 frequency，只显示对应行（月/周/一次性）。*/
function syncIncomeFreqRows(compose, frequency) {
    if (!compose) return;
    const rows = compose.querySelectorAll('[data-income-freq]');
    rows.forEach(r => {
        const f = r.getAttribute('data-income-freq');
        r.hidden = f !== frequency;
    });
}

import { DEFAULT_API_PARAMS } from './defaults.js';
import { T } from './tokens.js';
import {
    bindSliderChangeListener,
    bindInputFieldListener,
} from './ui-components.js';
import { hydrateAll } from './state/hydrate.js';
import { buildApiMethods } from './state/methods.js';
import { buildServices } from './state/services.js';

import {
    buildAppearanceMethods,
    renderAppearanceSection,
    initialAppearance,
} from './appearance-general/index.js';

// 世界观 SDK 共享层
import { getSettingsSdk, whenSettingsSdkReady } from './world/sdk/settings-sdk.js';
import { USER_SCHEMA, AI_SCHEMA, WORLD_SCHEMA } from './world/sdk/profile-schema.js';

// 世界观模块（含 bootstrap + 库页 + 方法 + 预设）
import { bootstrapWorldSdk, renderWorldLibrary, buildWorldMethods, initWorldEventHandlers } from './world/index-ui.js';
// 用户模块
import { renderUserSection, buildUserMethods } from './user/index.js';
// AI 模块
import { renderAiSection, buildAiMethods } from './ai/index.js';
// 人设主页模块（v0.18）
import { renderPersonaHome, buildPersonaHomeMethods } from './persona/index.js';
// ★ v0.67 钱包流水历史页
import { renderTransactionHistory } from './persona/transaction-history.js';
// 人设主页 API Bridge（v0.18）—— toolkit.persona.asset.*（同时兼容旧 persona.diary.generate）
import { installPersonaDiaryApi } from './persona/persona-bridge.js';
// 人设共享模块（AI / User 共用渲染 + 业务方法）
import { buildPersonaMethods } from './persona/methods.js';
// 图库模块
import { renderGallerySection, bootstrapGallery } from './gallery/index.js';
import { buildGalleryMethods } from './gallery/gallery-methods.js';
// Prompt 模块
import { renderPromptSection, bootstrapPrompt, buildPromptMethods } from './prompt/index.js';

import { renderMainSection } from './sections/main-page.js';
// 旧 API 页面（已删除，改用 api-manager）
// import { renderApiSection } from './sections/api-page.js';
// 新的 API 管理器
import { renderApiManagerSection } from './api-manager/api-manager-section.js';
import { buildApiManagerMethods } from './api-manager/api-manager-methods.js';
// 数据库管理模块
import { renderDatabaseSection, buildDatabaseMethods, handleDatabaseChange as _dbChange, handleDatabaseClick as _dbClick } from './database/section.js';
// 导入与导出模块
import { renderImportExportSection, buildImportExportMethods } from './import-export/section.js';
// 软件管理模块
import { renderSoftwareSection, buildSoftwareMethods, handleSoftwareChange as _swChange, handleSoftwareClick as _swClick } from './software/section.js';

// 别名供 installGlobalBindings 使用
const handleDatabaseChange = _dbChange;
const handleDatabaseClick = _dbClick;
const handleSoftwareChange = _swChange;
const handleSoftwareClick = _swClick;

// ============================================
// 应用配置
// ============================================

const SETTINGS_APP_CONFIG = {
    id: 'settings',
    name: 'nook',
    icon: `
        <svg viewBox="0 0 60 60" width="56" height="56" xmlns="http://www.w3.org/2000/svg" style="display:block;">
            <defs>
                <linearGradient id="settings-gloss" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.45" />
                    <stop offset="60%" stop-color="#FFFFFF" stop-opacity="0.10" />
                    <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
                </linearGradient>
                <clipPath id="settings-clip">
                    <rect x="0" y="0" width="60" height="60" rx="14" ry="14" />
                </clipPath>
            </defs>
            <g clip-path="url(#settings-clip)">
                <!-- 顶部内反光（贴合粉色背景的微弱高光） -->
                <rect x="0" y="0" width="60" height="30" fill="url(#settings-gloss)" />
                <!-- 白色 "nook" 剪影：两耳（圆）+ 头身（椭圆），旋转 -45° 顶在右下角 -->
                <g transform="translate(45 47) rotate(-45)">
                    <circle cx="-16" cy="-15" r="10" fill="#FFFFFF" />
                    <circle cx="16" cy="-15" r="10" fill="#FFFFFF" />
                    <ellipse cx="0" cy="0" rx="22" ry="20" fill="#FFFFFF" />
                </g>
            </g>
        </svg>
    `,
    iconBg: 'linear-gradient(145deg, #FFB6C1 0%, #FF8FAB 50%, #FF69B4 100%)',
    background: `linear-gradient(180deg, ${T.color.pageBackground} 0%, ${T.color.pageBackground} 100%)`,
    statusBarColor: T.color.label,
    homeIndicatorColor: T.color.quaternaryLabel,
    dock: { visible: true, order: 4 },
    topbar: {
        visible: true,
        title: '设置',
        subtitle: '让小听更贴近你',
    },
    nav: { type: 'none' },

    pages: [
        { id: 'main',       label: '设置', icon: '◦', nav: true },
        { id: 'appearance', type: 'detail' },
        { id: 'user',       type: 'detail' },
        { id: 'ai',         type: 'detail' },
        { id: 'personaHome', type: 'detail' },        // ★ v0.18 人设主页（user/ai 通用）
        { id: 'world',      type: 'detail' },
        { id: 'gallery',    type: 'detail' },
        { id: 'prompt',     type: 'detail' },
        { id: 'importExport', type: 'detail' },
        { id: 'database',   type: 'detail' },
        { id: 'software',   type: 'detail' },
        { id: 'api',        type: 'detail' },
        { id: 'transaction-history', type: 'detail' }, // ★ v0.67 钱包流水历史页(无 50 条限制)
    ],
    defaultRootPageId: 'main',

    detailContent: {
        appearance:   { title: '外观与通用', subtitle: '手机壳 / 电池 / 状态栏' },
        user:         { title: '用户',       subtitle: '多个「我」的人设实例' },
        ai:           { title: 'AI 人设',    subtitle: '多个 AI 实例与默认人设' },
        personaHome:  { title: '人设主页',   subtitle: '心情 · 周历 · 资产 · 阶段' },
        world:        { title: '世界观',     subtitle: '世界 / 标签 / 地点 / 快照' },
        gallery:      { title: '图库',       subtitle: '收藏 · 灵感 · 参考' },
        prompt:       { title: 'Prompt 工程', subtitle: '提示词库 · 模板 · 变量' },
        importExport: { title: '导入与导出', subtitle: '角色卡 / AI / 世界观 / Prompt' },
        database:     { title: '数据库管理',  subtitle: '数据表浏览 · 数据库检查' },
        software:     { title: '软件管理',    subtitle: '插件安装 · JS 文件注册' },
        api:          { title: 'API',        subtitle: '当前提供方 / Key / 模型' },
        transactionHistory: { title: '钱包流水', subtitle: '最近的收支记录' },
    },

    // IndexedDB 表声明（与 store 名一一对应）
    stores: [
        { name: 'deviceSettings', keyPath: 'key' },
        { name: 'apiProfiles',    keyPath: 'key' },
        // settings-sdk 新表（与 js/db/base-stores.js 同步）
        // v0.17：删除 sdkSocialAccounts / sdkSocialAccountTemplates（社媒已移除）
        // v0.18：sdkDiaries 保留供未来的日记 App 使用
        { name: 'sdkUsers',                    keyPath: 'id' },
        { name: 'sdkAiPersons',                keyPath: 'id' },
        { name: 'sdkWorlds',                   keyPath: 'id' },
        { name: 'sdkWorldGroups',              keyPath: 'id' },
        { name: 'sdkTagGroups',                keyPath: 'id' },
        { name: 'sdkTags',                     keyPath: 'id' },
        { name: 'sdkFactions',                 keyPath: 'id' },
        { name: 'sdkPlaces',                   keyPath: 'id' },          // ★ 地点（箱庭地图容器）
        { name: 'sdkLocations',                 keyPath: 'id' },          // ★ 场所（地点下的 pin）
        { name: 'sdkSnapshots',                keyPath: 'key' },
        { name: 'sdkActive',                   keyPath: 'key' },
        { name: 'sdkDrafts',                   keyPath: 'id' },
        { name: 'sdkDiaries',                  keyPath: 'id' },          // 人设日记（v0.18）—— 等待独立日记 App 接管 UI
        { name: 'sdkSchedules',                keyPath: 'id' },          // ★ v0.19 人设日程
        // ★ API 管理器表
        { name: 'apiKeys',                   keyPath: 'id' },
        { name: 'apiGroups',                 keyPath: 'id' },
        { name: 'apiUsageLogs',              keyPath: 'id' },
        // 图库模块（独立 gallery_db，不需要在此声明）
    ],

    setup({ app: appConfigArg }) {
        const defaults = DEFAULT_API_PARAMS;
        const result = {
            ui: {
                appearance: initialAppearance(),
                api: { ...defaults },
            },
            savedAt: {
                appearance: 0,
                api: 0,
            },
            world:        { sub: 'worlds' },
            user:         { sub: 'list' },
            ai:           { sub: 'list' },
            personaHome:  { entityType: 'user', entityId: 'user0' }, // ★ v0.18 默认进当前用户人设
            apiMgr:       { tab: 'keys', statsDays: 7 },              // ★ API 管理器状态
            importExport: { tab: 'export', policy: 'overwrite', importTarget: '' },
            _hydrated:    false,
        };
        // ★ v0.19b 给长按 / schedule UI 提供访问 normalized app 的入口
        // setup 时拿到的 appConfigArg = 原始 appConfig，hydrate 后通过 methods 的 this.app 拿到 normalized 版本
        // window.settingsApp = appConfigArg;  // 不在 setup 阶段写，避免引用混乱
        return result;
    },

    methods: (() => {
        const all = {
            escapeHtml,
            ...buildAppearanceMethods(),
            ...buildApiMethods(),
            ...buildApiManagerMethods(),
            ...buildDatabaseMethods(),
            ...buildImportExportMethods(),
            ...buildSoftwareMethods(),
            ...buildWorldMethods(),
            ...buildUserMethods(),
            ...buildAiMethods(),
            // ★ v0.17 人设共享方法（persona 模块开关 / 阶段 / parO / 保存等）
            ...buildPersonaMethods(),
            // ★ v0.18 人设主页方法（心情 / 资产 / 阶段 / 日程）
            ...buildPersonaHomeMethods(),
            // ★ 图库模块方法
            ...buildGalleryMethods(),
            // ★ Prompt 模块方法
            ...buildPromptMethods(),
            async hydrate() {
                // ★ v0.19b 把 normalized app 暴露给 document-level 监听器（长按 / schedule UI）
                window.settingsApp = this.app;
                await hydrateAll({
                    toolkit: this.toolkit,
                    app: this.app,
                });
                await this._bootstrapSettingsSdk();
            },
            async _bootstrapSettingsSdk() {
                if (getSettingsSdk()) {
                    installPersonaDiaryApi(this.toolkit);
                    return;
                }
                try {
                    await bootstrapWorldSdk({ toolkit: this.toolkit });
                } catch (err) {
                    console.warn('[settings] bootstrapSettingsSdk 失败', err);
                }
                window.__WV_USER_SCHEMA = USER_SCHEMA;
                window.__WV_AI_SCHEMA = AI_SCHEMA;
                window.__WV_WORLD_SCHEMA = WORLD_SCHEMA;
                // 挂载 toolkit.persona.asset.* / .diary.generate 桥接（供其他 App / 主页资产卡片使用）
                installPersonaDiaryApi(this.toolkit);
            },
        };
        return all;
    })(),

    services: buildServices(),

    // ============================================
    // 渲染
    // ============================================

    renderPage(content, page, app) {
        if (!app.state._hydrated) {
            app.state._hydrated = true;
            Promise.resolve().then(() => app.methods.hydrate());
        }
        return `<div class="settings-app">${renderMainSection(app)}</div>`;
    },

    renderDetailPage(content, page, app) {
        if (!app.state._hydrated) {
            app.state._hydrated = true;
            Promise.resolve().then(() => app.methods.hydrate());
        }
        // ★ v0.18 人设主页需要 settings-sdk，若未就绪则渲染 loading 并等 ready 后强制刷新
        if (page.id === 'personaHome' && !getSettingsSdk()) {
            whenSettingsSdkReady().then(() => {
                if (typeof window !== 'undefined') window.refreshPhoneApps?.();
            });
            return `<div class="settings-app"><div class="persona-empty">人设主页加载中…</div></div>`;
        }
        // v0.27：[已撤回] 不再在这里监听 weather-hydrated 触发 refreshPhoneApps。
        // 原因：refreshPhoneApps 会重建所有 phone app → weather 重新 hydrate → 又触发
        // weather-hydrated → 又 refresh → 死循环，并且会冲掉 settings 的 world 页。
        // optionsFn 会在 settings world 页每次 render 时重新查 window.weatherAppState。
        // 由于 weather 是 async 注册（hydrate 完才完成 register），settings world 页
        // 首次 render 时 window.weatherAppState 必然已就绪。
        let body = '';
        switch (page.id) {
            case 'appearance':  body = renderAppearanceSection(app); break;
            case 'user':        body = renderUserSection(app); break;
            case 'ai':          body = renderAiSection(app); break;
            case 'personaHome': body = renderPersonaHome(app); break;
            case 'world':       body = renderWorldLibrary(app); break;
            case 'gallery':     body = renderGallerySection(app); break;
            case 'prompt':      body = renderPromptSection(app); break;
            case 'importExport': body = renderImportExportSection(app); break;
            case 'database':     body = renderDatabaseSection(app); break;
            case 'software':     body = renderSoftwareSection(app); break;
            case 'api':         body = renderApiManagerSection(app); break;
            case 'transaction-history': body = renderTransactionHistory(app); break;
            default:            body = '';
        }
        return `<div class="settings-app">${body}</div>`;
    },
};

// ============================================
// 工厂函数
// ============================================

let _eventBindingsInstalled = false;
function installGlobalBindings() {
    if (_eventBindingsInstalled) return;
    _eventBindingsInstalled = true;
    bindSliderChangeListener();
    bindInputFieldListener();
    // 世界观编辑器的预设按钮、日期清除等交互
    initWorldEventHandlers();
    // 用户/AI 编辑器字段实时同步
    document.addEventListener('input', handleEditorInput);
    // 地图背景图上传事件
    document.addEventListener('change', handleMapUploadChange);
    // 地图拖拽功能
    initMapDragListeners();
    // ★ v0.19 人设主页 · 日程点击（添加 / 删除 / 切换编辑 / 保存）
    document.addEventListener('click', handlePersonaScheduleClick, true);
    document.addEventListener('click', onScheduleItemAnyClick, true);
    document.addEventListener('change', onScheduleCheckboxChange, true);
    document.addEventListener('change', onScheduleSelectChange, true);
    document.addEventListener('input', onScheduleCheckboxChange, true);
    // 作息模块事件（每天 checkbox 联动 + 星期选择）
    document.addEventListener('change', onRhythmDayChange, true);
    console.log('[schedule-handler] BOUND v=2026-07-27-checkbox');
    // 图库模块事件
    bootstrapGallery();

    // Prompt 模块初始化
    bootstrapPrompt();

    // ★ v0.20 人设主页 · 阶段 / parO 独立卡点击交互
    document.addEventListener('click', onVariantCardClick, true);
    document.addEventListener('click', handlePersonaVariantAction, true);

    // ★ v0.20 全局「点击空白收起」—— 同时清日程 pressed 与阶段/parO pressed
    //    用 bubble 阶段晚于以上 capture 阶段执行，确保 stopPropagation 已先决定去留
    document.addEventListener('click', onPressStateDismissClick, false);

    // ★ v0.19 人设主页 · 上下文区块交互（上下文预览、刷新、App 选择）
    document.addEventListener('change', handleContextAppSelect, true);
    document.addEventListener('click', handleContextRefresh, true);
    document.addEventListener('click', handleContextPreClick, true);

    // ★ API 管理器事件
    document.addEventListener('change', handleApiMgrChange, true);
    document.addEventListener('click', handleApiMgrClick, true);

    // ★ 数据库管理事件
    document.addEventListener('change', handleDatabaseChange, true);
    document.addEventListener('click', handleDatabaseClick, true);

    // ★ 软件管理事件
    document.addEventListener('change', handleSoftwareChange, true);
    document.addEventListener('click', handleSoftwareClick, true);
}

// checkbox「指定时间」勾选态 → 切换时间 row 的视觉态
function onScheduleCheckboxChange(event) {
    const t = event.target;
    if (!(t instanceof HTMLElement)) return;
    if (!t.matches('[data-schedule-field="hasTime"], [data-edit-field="hasTime"]')) return;
    // checkbox 和 time-row 是兄弟关系，都在外层 .phome-schedule__compose 或 .phome-schedule__edit-panel 里
    const container = t.closest('.phome-schedule__compose') || t.closest('.phome-schedule__edit-panel') || t.closest('.phome-schedule__item');
    const row = container ? container.querySelector('[data-time-row]') : null;
    if (!row) {
        console.log('[schedule] no time-row found for checkbox', t);
        return;
    }
    if (t.checked) {
        row.classList.remove('is-disabled');
        // 激活：恢复正常显示，去掉灰蒙蒙
        row.style.cssText = 'opacity:1 !important; filter:none !important;';
        row.querySelectorAll('select').forEach(sel => {
            sel.disabled = false;
            sel.style.cssText = '';
        });
    } else {
        row.classList.add('is-disabled');
        // 禁用：灰蒙蒙
        row.style.cssText = 'opacity:0.55 !important; filter:grayscale(0.3);';
        row.querySelectorAll('select').forEach(sel => {
            sel.disabled = true;
            sel.style.cssText = 'background:rgba(120,120,128,0.08) !important; color:rgba(60,60,67,0.6) !important;';
        });
    }
}

/* 作息模块：「每天」checkbox 联动禁用其他星期 checkbox */
function onRhythmDayChange(event) {
    const t = event.target;
    if (!(t instanceof HTMLElement)) return;
    // 「每天」checkbox
    if (t.matches('[data-rhythm-day-all]')) {
        const container = t.closest('.phome-rhythm__day-cbs');
        if (!container) return;
        const dayCbs = container.querySelectorAll('[data-rhythm-day]');
        dayCbs.forEach(cb => { cb.disabled = t.checked; });
    }
    // 单个星期 checkbox → 取消「每天」
    if (t.matches('[data-rhythm-day]')) {
        const container = t.closest('.phome-rhythm__day-cbs');
        if (!container) return;
        const allCb = container.querySelector('[data-rhythm-day-all]');
        if (allCb && t.checked) {
            allCb.checked = false;
        }
    }
}

// select 调试：change 时打印值
function safeDatasetKey(key) {
    // data-time-field 是 "startTime-h"，连字符在 dataset 上非法
    // 改成 "startTimeH"
    return String(key || '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function onScheduleSelectChange(event) {
    const t = event.target;
    if (!(t instanceof HTMLElement)) return;
    if (!t.matches('[data-time-field]')) return;
    const field = t.getAttribute('data-time-field');
    console.log('[schedule] select change:', field, '→', t.value);
    // ★ 关键修复：select 的 value 在某些情况下会因 Vue 重渲被丢弃。
    //   这里把最新的值写到对应 schedule item 的 dataset 上（用合法 key），
    //   collectScheduleFields 优先从这里读，而不是从 el.value。
    const dk = safeDatasetKey(field);
    const row = t.closest('[data-time-row]');
    if (row) row.dataset[dk] = t.value;
    const edit = t.closest('.phome-schedule__edit-panel');
    if (edit) edit.dataset[dk] = t.value;
    const compose = t.closest('.phome-schedule__compose');
    if (compose) compose.dataset[dk] = t.value;
}

/**
 * 地图背景图上传处理：
 *   data-wv-upload-map-bg  → handleMapBgUpload
 *   data-wv-upload-place-bg → handlePlaceBgUpload
 */
function handleMapUploadChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const shell = target.closest('.app-shell');
    if (!shell) return;

    const mapBgUpload = target.getAttribute('data-wv-upload-map-bg');
    if (mapBgUpload !== null) {
        dispatchMethodAction('handleMapBgUpload', { _event: event });
        return;
    }
    const placeBgUpload = target.getAttribute('data-wv-upload-place-bg');
    if (placeBgUpload !== null) {
        dispatchMethodAction('handlePlaceBgUpload', { _event: event });
    }
}

// ============================================
// 地图拖拽功能
// ============================================

let _mapDragState = null;

function initMapDragListeners() {
    // 只初始化一次
    if (window._mapDragInitialized) return;
    window._mapDragInitialized = true;

    document.addEventListener('mousedown', handleMapDragStart, true);
    document.addEventListener('mousemove', handleMapDragMove, true);
    document.addEventListener('mouseup', handleMapDragEnd, true);
    // 触摸支持
    document.addEventListener('touchstart', handleMapDragStart, { passive: false });
    document.addEventListener('touchmove', handleMapDragMove, { passive: false });
    document.addEventListener('touchend', handleMapDragEnd, true);
}

function handleMapDragStart(e) {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    
    // 检查是否点击了地图 pin
    const pin = target.closest('[data-wv-map-pin]');
    const stage = target.closest('.wv-map__stage');
    
    if (!pin) return;
    
    const shell = target.closest('.app-shell');
    if (!shell) return;
    
    // 获取 place-id 或 location-id
    const placeId = pin.dataset.placeId;
    const locationId = pin.dataset.locationId;
    if (!placeId && !locationId) return;
    
    // 获取地图容器的尺寸
    if (!stage) return;
    const stageRect = stage.getBoundingClientRect();
    
    // 计算 pin 中心点在舞台中的初始百分比位置
    const pinRect = pin.getBoundingClientRect();
    const pinCenterX = pinRect.left + pinRect.width / 2 - stageRect.left;
    const pinCenterY = pinRect.top + pinRect.height / 2 - stageRect.top;
    const initialPercentX = (pinCenterX / stageRect.width) * 100;
    const initialPercentY = (pinCenterY / stageRect.height) * 100;
    
    // 长按 300ms 后开始拖拽
    _mapDragState = {
        placeId,
        locationId,
        startX: e.clientX || e.touches?.[0]?.clientX,
        startY: e.clientY || e.touches?.[0]?.clientY,
        stageRect,
        initialPercentX,
        initialPercentY,
        pin,
        timeoutId: setTimeout(() => {
            _mapDragState.dragging = true;
            pin.classList.add('is-dragging');
        }, 300)
    };
}

function handleMapDragMove(e) {
    if (!_mapDragState || !_mapDragState.dragging) return;
    
    const clientX = e.clientX || e.touches?.[0]?.clientX;
    const clientY = e.clientY || e.touches?.[0]?.clientY;
    
    if (clientX === undefined || clientY === undefined) return;
    
    const deltaX = clientX - _mapDragState.startX;
    const deltaY = clientY - _mapDragState.startY;
    const { stageRect, initialPercentX, initialPercentY, pin } = _mapDragState;
    
    // 计算舞台中移动的像素对应的百分比变化
    const deltaPercentX = (deltaX / stageRect.width) * 100;
    const deltaPercentY = (deltaY / stageRect.height) * 100;
    
    // 计算新的百分比位置
    let newPercentX = _mapDragState.initialPercentX + deltaPercentX;
    let newPercentY = _mapDragState.initialPercentY + deltaPercentY;
    
    // 限制在 0-100% 范围内
    newPercentX = Math.max(0, Math.min(100, newPercentX));
    newPercentY = Math.max(0, Math.min(100, newPercentY));
    
    // 更新 pin 位置
    pin.style.left = `${newPercentX.toFixed(2)}%`;
    pin.style.top = `${newPercentY.toFixed(2)}%`;
    
    e.preventDefault();
}

function handleMapDragEnd(e) {
    if (!_mapDragState) return;
    
    clearTimeout(_mapDragState.timeoutId);
    
    if (_mapDragState.dragging) {
        // 计算最终坐标并保存
        const pin = _mapDragState.pin;
        const left = parseFloat(pin.style.left);
        const top = parseFloat(pin.style.top);
        
        const placeId = _mapDragState.placeId;
        const locationId = _mapDragState.locationId;
        
        if (placeId) {
            // 地点地图：转换为世界坐标 (-100 到 100)
            const mapOffsetX = Math.round((left / 100) * 200 - 100);
            const mapOffsetY = Math.round(100 - (top / 100) * 200);
            dispatchMethodAction('worldUpdatePlacePosition', {
                id: placeId,
                mapOffsetX,
                mapOffsetY
            });
        } else if (locationId) {
            // 场所地图：转换为相对坐标 (-100 到 100)
            const posX = Math.round((left / 100) * 200 - 100);
            const posY = Math.round(100 - (top / 100) * 200);
            dispatchMethodAction('worldUpdateLocationPosition', {
                id: locationId,
                posX,
                posY
            });
        }
        
        pin.classList.remove('is-dragging');
    } else {
        // 没有拖拽，视为点击，触发原来的 action
        const pin = _mapDragState.pin;
        if (pin) {
            // 触发原有的点击事件
            const actionAttr = pin.getAttribute('data-app-action');
            if (actionAttr) {
                try {
                    const action = JSON.parse(actionAttr);
                    dispatchMethodAction(action.method, action.payload);
                } catch (err) {
                    // ignore
                }
            }
        }
    }
    
    _mapDragState = null;
}

/**
 * 用户 / AI 编辑器的实时同步：
 *   data-user-field="name" → userUpdateField({ field, value })
 *   data-ai-field="name"   → aiUpdateField({ field, value })
 */
function handleEditorInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const shell = target.closest('.app-shell');
    if (!shell) return;

    // 人设上下文编辑框实时同步
    if (target.matches('[data-context-textarea]')) {
        const draft = target.value || '';
        if (window.settingsApp?.state?.personaHome) {
            window.settingsApp.state.personaHome.contextDraft = draft;
        }
        return;
    }

    const personaField = target.getAttribute('data-persona-field');
    if (personaField) {
        // 由 personaSave 一次性整体收集，这里无需单字段同步
        return;
    }
    const userField = target.getAttribute('data-user-field');
    if (userField) {
        dispatchMethodAction('userUpdateField', {
            field: userField,
            value: target.value,
        });
        return;
    }
    const aiField = target.getAttribute('data-ai-field');
    if (aiField) {
        dispatchMethodAction('aiUpdateField', {
            field: aiField,
            value: target.value,
        });
        return;
    }
    // AI 搜索框：实时去抖同步搜索关键词
    const aiSearch = target.getAttribute('data-ai-search-input');
    if (aiSearch !== null) {
        if (!aiSearchDebounce) aiSearchDebounce = {};
        const value = target.value || '';
        const existing = aiSearchDebounce.t;
        if (existing) clearTimeout(existing);
        aiSearchDebounce.t = setTimeout(() => {
            dispatchMethodAction('aiSearch', { value });
        }, 180);
        return;
    }

    // 心情编辑：range 拖动实时更新百分比和浓度条
    if (target.matches('[data-edit-intensity]')) {
        const value = parseInt(target.value) || 0;
        const label = target.closest('.prompt-form-field')?.querySelector('.intensity-label');
        if (label) label.textContent = value;
        const fill = shell.querySelector('.phome-mood__intensity-fill');
        if (fill) fill.style.width = value + '%';
        const labelEl = shell.querySelector('.phome-mood__intensity-label');
        if (labelEl) labelEl.textContent = value + '%';
    }

    // 心情编辑：输入心情名称实时更新
    if (target.matches('[data-edit-mood]')) {
        const value = target.value || '';
        const moodDisplay = shell.querySelector('.phome-mood__mood-name');
        if (moodDisplay) moodDisplay.textContent = value;
    }
}

/**
 * 人设主页 · 日程事件代理（v0.19）
 *   data-schedule-add       → 收集面板字段，personaScheduleAddEvent
 *   data-schedule-edit      → 切换某条进入编辑态
 *   data-schedule-remove    → personaScheduleRemoveEvent
 *   data-schedule-save      → 收集编辑字段，personaScheduleUpdateEvent
 *   data-schedule-cancel    → 收起编辑面板（直接走 refresh）
 */
function handlePersonaScheduleClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const shell = target.closest('.app-shell');
    if (!shell) return;

    /* ============================================
     * 资产卡片（v2 · 单 balance + income events · 无 emoji / 无固定类型）
     * ============================================ */
    const assetCard = target.closest('.phome-asset');

    // 打开「设置余额」表单
    if (target.matches('[data-asset-set-balance]')) {
        event.stopPropagation();
        event.preventDefault();
        const card = target.closest('.phome-asset');
        const compose = card?.querySelector('[data-balance-compose]');
        if (!compose) return;
        compose.hidden = false;
        compose.querySelector('[data-balance-field="balance"]')?.focus();
        compose.querySelector('[data-balance-field="balance"]')?.select?.();
        return;
    }

    // 打开「添加收入事件」表单
    if (target.matches('[data-asset-add-income]')) {
        event.stopPropagation();
        event.preventDefault();
        const card = target.closest('.phome-asset');
        const compose = card?.querySelector('[data-income-compose]');
        if (!compose) return;
        compose.hidden = false;
        // 写入当前 mode（区分新建 / 编辑）
        compose.dataset.mode = 'create';
        compose.dataset.eventId = '';
        // 默认聚焦名称输入
        compose.querySelector('[data-income-field="name"]')?.focus();
        return;
    }

    // 取消任何资产表单
    if (target.matches('[data-income-cancel]') || target.matches('[data-balance-cancel]')) {
        event.stopPropagation();
        event.preventDefault();
        const compose = target.closest('[data-income-compose], [data-balance-compose]');
        if (compose) compose.hidden = true;
        return;
    }

    // 切换收入事件的「启用」开关
    const toggleId = target.getAttribute('data-event-toggle');
    if (toggleId && target.tagName === 'INPUT') {
        event.stopPropagation();
        event.preventDefault();
        const enabled = target.checked;
        dispatchMethodAction('personaIncomeToggle', { eventId: toggleId, enabled });
        return;
    }

    // 删除收入事件
    const deleteEventId = target.getAttribute('data-event-delete');
    if (deleteEventId) {
        event.stopPropagation();
        event.preventDefault();
        if (!window.confirm('删除这条收入事件？')) return;
        dispatchMethodAction('personaIncomeRemove', { eventId: deleteEventId });
        return;
    }

    // 编辑收入事件：把表单塞进对应 item 下方
    const editEventId = target.getAttribute('data-event-edit');
    if (editEventId) {
        event.stopPropagation();
        event.preventDefault();
        const item = target.closest('.phome-income__item');
        if (!item) return;
        // 通过 DOM 读出当前值
        const name = item.querySelector('.phome-income__item-name')?.textContent?.trim() || '';
        const metaText = item.querySelector('.phome-income__item-amount')?.textContent || '';
        // meta 形如 "2000.00 堆金币 / 月"，取数字部分
        const amountMatch = /([\d,]+(?:\.\d+)?)/.exec(metaText);
        const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
        const nextText = item.querySelector('.phome-income__item-next')?.textContent || '';
        // 从下次日期"下次 YYYY-MM-DD"反推频率(粗略)：monthly/weekly/daily/once
        const freqGuess = /\/ (\S+)$/.exec(metaText);
        let frequency = 'monthly';
        if (freqGuess) {
            const t = freqGuess[1];
            if (t === '周') frequency = 'weekly';
            else if (t === '日') frequency = 'daily';
            else if (t === '一次性') frequency = 'once';
        }
        const compose = assetCard?.querySelector('[data-income-compose]');
        if (!compose) return;
        compose.hidden = false;
        compose.dataset.mode = 'edit';
        compose.dataset.eventId = editEventId;
        compose.querySelector('[data-income-field="name"]').value = name;
        compose.querySelector('[data-income-field="amount"]').value = amount;
        compose.querySelector('[data-income-field="frequency"]').value = frequency;
        // 同步显示额外字段
        syncIncomeFreqRows(compose, frequency);
        // 滚动到表单
        compose.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
    }

    // 保存收入事件（创建 / 编辑）
    if (target.matches('[data-income-save]')) {
        event.stopPropagation();
        const compose = target.closest('[data-income-compose]');
        if (!compose) return;
        const mode = compose.dataset.mode || 'create';
        const eventId = compose.dataset.eventId || '';
        const name = compose.querySelector('[data-income-field="name"]')?.value?.trim() || '';
        const amount = parseFloat(compose.querySelector('[data-income-field="amount"]')?.value) || 0;
        const frequency = compose.querySelector('[data-income-field="frequency"]')?.value || 'monthly';
        const payload = { name, amount, frequency };
        if (frequency === 'monthly') {
            payload.dayOfMonth = parseInt(compose.querySelector('[data-income-field="dayOfMonth"]')?.value, 10) || 1;
        } else if (frequency === 'weekly') {
            payload.dayOfWeek = parseInt(compose.querySelector('[data-income-field="dayOfWeek"]')?.value, 10) || 0;
        } else if (frequency === 'once') {
            const d = compose.querySelector('[data-income-field="startDateOnce"]')?.value || '';
            if (d) payload.startDate = d;
        }
        if (!name) {
            window.dispatchEvent(new CustomEvent('settings:toast', {
                detail: { kind: 'warn', title: '需要名称', text: '请先填写事件名称' },
            }));
            return;
        }
        if (mode === 'edit' && eventId) {
            payload.eventId = eventId;
            dispatchMethodAction('personaIncomeUpdate', payload);
        } else {
            dispatchMethodAction('personaIncomeAdd', payload);
        }
        return;
    }

    // 保存余额
    if (target.matches('[data-balance-save]')) {
        event.stopPropagation();
        const compose = target.closest('[data-balance-compose]');
        if (!compose) return;
        const balance = parseFloat(compose.querySelector('[data-balance-field="balance"]')?.value) || 0;
        dispatchMethodAction('personaAssetSetBalance', { balance });
        return;
    }

    // 没匹配到的资产相关事件不往下走
    if (assetCard) {
        // 频率切换是 select onchange，不在这里拦截
        const sel = target.closest('[data-income-field="frequency"]');
        if (sel && sel.tagName === 'SELECT') {
            syncIncomeFreqRows(target.closest('[data-income-compose]'), sel.value);
        }
        return;
    }

    const scheduleRoot = target.closest('.phome-schedule');
    if (!scheduleRoot) return;

    // ★ v0.31：始终从 data-schedule-date 读取，转换为周几，写入 weeklySchedule
    const openDate = scheduleRoot.getAttribute('data-schedule-date')
        || window.settingsApp?.state?.personaHome?.scheduleOpenDate
        || '';
    // 把 YYYY-MM-DD 转成 JS getDay() 的 0=周日~6=周六
    const weekday = (() => {
        if (!openDate) return null;
        const d = new Date(openDate);
        return isNaN(d) ? null : d.getDay();
    })();

    // 添加
    if (target.matches('[data-schedule-add]')) {
        event.stopPropagation();
        const payload = collectScheduleFields(scheduleRoot, '[data-schedule-field]');
        if (!payload.title) {
            window.dispatchEvent(new CustomEvent('settings:toast', {
                detail: { kind: 'warn', title: '需要标题', text: '请先填写日程标题' },
            }));
            return;
        }
        if (weekday === null) return;
        dispatchMethodAction('personaWeeklyScheduleAddEvent', { weekday, ...payload });
        clearScheduleFields(scheduleRoot, '[data-schedule-field]');
        return;
    }
    // 编辑（长按/点击浮层内的「编辑」按钮）
    const editAttr = target.getAttribute('data-schedule-longpress-edit');
    if (editAttr) {
        event.stopPropagation();
        const item = target.closest('.phome-schedule__item');
        if (!item) return;
        if (window.settingsApp) window.settingsApp.state.personaHome.schedulePressed = `edit::${editAttr}`;
        bumpSettingsDetailView();
        return;
    }
    // 删除（长按/点击浮层内的「删除」按钮）
    const removeAttr = target.getAttribute('data-schedule-longpress-remove');
    if (removeAttr) {
        event.stopPropagation();
        const evtId = removeAttr;
        if (weekday === null) return;
        if (window.__phoneConfirm?.request) {
            window.__phoneConfirm.request({
                title: '删除日程',
                text: '确定要删除这条每周重复日程吗？删除后不可恢复。',
                confirmLabel: '删除',
                danger: true,
                onConfirm: () => {
                    if (window.settingsApp) window.settingsApp.state.personaHome.schedulePressed = '';
                    dispatchMethodAction('personaWeeklyScheduleRemoveEvent', { weekday, eventId: evtId });
                },
            });
        } else {
            if (confirm('确定要删除这条每周重复日程吗？')) {
                if (window.settingsApp) window.settingsApp.state.personaHome.schedulePressed = '';
                dispatchMethodAction('personaWeeklyScheduleRemoveEvent', { weekday, eventId: evtId });
            }
        }
        return;
    }
    // 保存
    const saveAttr = target.getAttribute('data-schedule-save');
    if (saveAttr) {
        event.stopPropagation();
        const item = target.closest('.phome-schedule__item');
        if (!item) return;
        const patch = collectScheduleFields(item, '[data-edit-field]');
        if (!patch.title) return;
        if (window.settingsApp) window.settingsApp.state.personaHome.schedulePressed = '';
        bumpSettingsDetailView();
        if (weekday !== null) {
            dispatchMethodAction('personaWeeklyScheduleUpdateEvent', { weekday, eventId: saveAttr, ...patch });
        }
        return;
    }
    // 取消
    if (target.matches('[data-schedule-cancel]')) {
        if (window.settingsApp) window.settingsApp.state.personaHome.schedulePressed = '';
        bumpSettingsDetailView();
        return;
    }
    // 长按浮层里的「编辑」
    const lpEdit = target.getAttribute('data-schedule-longpress-edit');
    if (lpEdit) {
        if (window.settingsApp) window.settingsApp.state.personaHome.schedulePressed = `edit::${lpEdit}`;
        bumpSettingsDetailView();
        return;
    }
    // 长按浮层里的「删除」
    const lpRemove = target.getAttribute('data-schedule-longpress-remove');
    if (lpRemove) {
        event.stopPropagation();
        const evtId = lpRemove;
        if (weekday === null) return;
        if (window.__phoneConfirm?.request) {
            window.__phoneConfirm.request({
                title: '删除日程',
                text: '确定要删除这条每周重复日程吗？删除后不可恢复。',
                confirmLabel: '删除',
                danger: true,
                onConfirm: () => {
                    if (window.settingsApp) window.settingsApp.state.personaHome.schedulePressed = '';
                    dispatchMethodAction('personaWeeklyScheduleRemoveEvent', { weekday, eventId: evtId });
                },
                onCancel: () => {
                    if (window.settingsApp) window.settingsApp.state.personaHome.schedulePressed = '';
                },
            });
        } else if (confirm('确定要删除这条每周重复日程吗？')) {
            if (window.settingsApp) window.settingsApp.state.personaHome.schedulePressed = '';
            dispatchMethodAction('personaWeeklyScheduleRemoveEvent', { weekday, eventId: evtId });
        }
        return;
    }
}

// ============================================
// ★ v0.19b 人设主页 · 日程长按交互
//   - 按住 item 350ms → 模糊 + 浮层「编辑 / 删除」
//   - 点 item 空白处 / item 外部 / 切别的日期 → 自动收起
//   - 通过 app.state.personaHome.schedulePressed 持久化重渲状态
// ============================================

function findScheduleItem(target) {
    if (!(target instanceof HTMLElement)) return null;
    return target.closest('.phome-schedule__item');
}

function bumpSettingsDetailView() {
    try { window.__detailRenderTick?.value; if (window.__detailRenderTick) window.__detailRenderTick.value++; } catch (_) {}
}

let longPressTimer = null;
let longPressTarget = null;
const LONG_PRESS_MS = 700;
const LONG_PRESS_TOLERANCE_PX = 8;

// (长按相关函数已废弃，保留空壳以避免误删其它代码。点击直接切换 pressed 状态见 onScheduleItemAnyClick。)

// 点 item 空白（不在编辑面板）→ 切换 pressed 状态
function onScheduleItemAnyClick(event) {
    const item = findScheduleItem(event.target);
    if (!item) return;
    // 在编辑面板里点不算（让 input 能正常 focus / 点保存按钮不触发切换）
    if (event.target.closest('.phome-schedule__edit-panel')) return;
    // 浮层里点按钮也不算（走 handlePersonaScheduleClick 的编辑/删除分支）
    if (event.target.closest('.phome-schedule__item-actions')) return;
    const id = item.getAttribute('data-schedule-edit-id');
    if (!id) return;
    // 切换：当前已按下 → 收起；未按下 → 浮层
    const app = window.settingsApp;
    if (!app) {
        console.warn('[schedule] click handler: window.settingsApp not ready');
        return;
    }
    const cur = app?.state?.personaHome?.schedulePressed;
    // 如果当前有展开的卡片，点击另一个卡片则切换展开目标；点击已展开的卡片则收起
    if (cur && cur !== id) {
        // 切换到新的卡片
        app.state.personaHome.schedulePressed = id;
    } else if (cur === id) {
        // 点击已展开的卡片则收起
        app.state.personaHome.schedulePressed = '';
    } else {
        // 没有展开的卡片，点击则展开
        app.state.personaHome.schedulePressed = id;
    }
    bumpSettingsDetailView();
}

// ============================================
// ★ v0.20 人设主页 · 阶段 / parO 独立卡 · 点击交互
//   - 点卡空白 → 进入「按下」态（主内容模糊 + 浮出 打开/AI生成/删除）
//   - 点卡 → 切换 pressed；点浮层里的按钮 → 走具体动作（不再保留 pressed）
//   - 点任何卡片外部 → 自动收起 pressed
//   - 通过 app.state.personaHome.variantPressed = "<variantType>::<cardId>" 持久化
// ============================================

function findVariantCard(target) {
    if (!(target instanceof HTMLElement)) return null;
    return target.closest('.persona-variant-card');
}

function onVariantCardClick(event) {
    const card = findVariantCard(event.target);
    if (!card) return;
    // 点在操作按钮上 → 不参与 toggle（由 handlePersonaVariantAction 处理）
    if (event.target.closest('.persona-variant-card__actions')) return;
    const variantKey = card.getAttribute('data-variant-edit-id');
    if (!variantKey) return;
    const app = window.settingsApp;
    if (!app) return;
    const cur = app?.state?.personaHome?.variantPressed;
    if (cur && cur !== variantKey) {
        app.state.personaHome.variantPressed = variantKey;
    } else if (cur === variantKey) {
        app.state.personaHome.variantPressed = '';
    } else {
        app.state.personaHome.variantPressed = variantKey;
    }
    bumpSettingsDetailView();
}

function handlePersonaVariantAction(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const shell = target.closest('.app-shell');
    if (!shell) return;
    const btn = target.closest('[data-variant-action]');
    if (!btn) return;
    event.stopPropagation(); // 阻止冒泡到 onVariantCardClick，避免被错误收起
    const action = btn.getAttribute('data-variant-action');
    const cardId = btn.getAttribute('data-variant-id');
    const variantType = btn.getAttribute('data-variant-type');
    const entityType = btn.getAttribute('data-variant-entity');

    // 1. 打开
    if (action === 'open') {
        dispatchMethodAction('personaOpenVariant', { entityType, cardId });
        clearVariantPressed();
        return;
    }
    // 2. AI 生成
    if (action === 'ai') {
        dispatchMethodAction('personaAiFillVariant', { entityType, variantType, cardId });
        clearVariantPressed();
        return;
    }
    // 3. 删除
    if (action === 'remove') {
        const isPhase = variantType === 'lifePhase';
        const payload = isPhase
            ? { entityType, phaseId: cardId }
            : { entityType, parOId: cardId };
        const method = isPhase ? 'personaRemovePhase' : 'personaRemoveParO';
        if (window.__phoneConfirm?.request) {
            window.__phoneConfirm.request({
                title: isPhase ? '删除阶段' : '删除 parO',
                text: `确定要删除这张${isPhase ? '阶段' : 'parO'}卡吗？删除后不可恢复。`,
                confirmLabel: '删除',
                danger: true,
                onConfirm: () => {
                    dispatchMethodAction(method, payload);
                    clearVariantPressed();
                },
            });
        } else if (confirm(`确定要删除这张${isPhase ? '阶段' : 'parO'}卡吗？`)) {
            dispatchMethodAction(method, payload);
            clearVariantPressed();
        }
        return;
    }
}

function clearVariantPressed() {
    const app = window.settingsApp;
    if (!app) return;
    if (app.state?.personaHome?.variantPressed) {
        app.state.personaHome.variantPressed = '';
        bumpSettingsDetailView();
    }
}

// ============================================
// ★ v0.20 全局「点击空白收起」—— 同时清掉日程 pressed 与阶段/parO pressed
//   - 用 mousedown 在捕获阶段判断，避免被框架内其它 click handler 的 stopPropagation 影响
//   - 必须在 schedule / variant action 已处理完毕后才判断是否「落在卡片外」
// ============================================

function onPressStateDismissClick(event) {
    if (!(event.target instanceof HTMLElement)) return;
    const app = window.settingsApp;
    if (!app?.state?.personaHome) return;

    const route = app.state.personaHome;

    // 1. 日程卡片：点 .phome-schedule__item 内部的不算「点外面」
    //    注意：onScheduleItemAnyClick 已经在 capture 阶段处理点击切换；
    //    这里只负责「点外面」的情况——所以直接判断 target 是否在某个 schedule item 内。
    if (route.schedulePressed) {
        const inItem = event.target.closest('.phome-schedule__item');
        if (!inItem) {
            // 防止与 onScheduleItemAnyClick 互相打架——如果这次点击本来就要切换它，那边会处理；
            // 这边只点外面的时候清。
            route.schedulePressed = '';
            bumpSettingsDetailView();
        }
    }

    // 2. 阶段 / parO 卡片：同上
    if (route.variantPressed) {
        const inCard = event.target.closest('.persona-variant-card');
        if (!inCard) {
            route.variantPressed = '';
            bumpSettingsDetailView();
        }
    }
}

function collectScheduleFields(root, selector) {
    const out = {};
    // 1. 普通字段（input/textarea/select 都按 value 拿）
    root.querySelectorAll(selector).forEach((el) => {
        let key = null;
        if (selector === '[data-schedule-field]') key = el.getAttribute('data-schedule-field');
        else if (selector === '[data-edit-field]') key = el.getAttribute('data-edit-field');
        if (!key) return;
        // checkbox：把 checked 转成 'on' / undefined
        if (el.type === 'checkbox') {
            out[key] = el.checked ? 'on' : '';
            return;
        }
        out[key] = el.value;
    });
    // 2. 时间字段（[data-time-field] = "<prefix>-h" / "<prefix>-m"）→ 拼 "HH:MM"
    //    ★ 修复：始终从 dataset/select 收集用户最近选的值（hasTime 勾不勾不影响收集），
    //    末尾再统一处理：hasTime=false 时清空 startTime/endTime。
    root.querySelectorAll('[data-time-field]').forEach((el) => {
        const key = el.getAttribute('data-time-field'); // e.g. startTime-h
        if (!key) return;
        const m = key.match(/^(.+)-([hm])$/);
        if (!m) return;
        const prefix = m[1];
        const part = m[2];
        // ★ 优先从 row.dataset 读（用户最近选的值），fallback 到 el.value
        let val = '';
        const row = el.closest('[data-time-row]');
        const dk = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        if (row && row.dataset[dk] != null && row.dataset[dk] !== '') {
            val = row.dataset[dk];
        } else {
            val = el.value || '';
        }
        if (!out.__timeRaw) out.__timeRaw = {};
        if (!out.__timeRaw[prefix]) out.__timeRaw[prefix] = {};
        out.__timeRaw[prefix][part] = val;
    });
    // 把 __timeRaw 格式化成 "HH:MM" 字符串
    if (out.__timeRaw) {
        for (const [prefix, slot] of Object.entries(out.__timeRaw)) {
            const h = (slot.h || '').padStart(2, '0');
            const m = (slot.m || '').padStart(2, '0');
            // ★ 任一为空则视为空时间（"HH:MM" 要么完整要么空字符串）
            out[prefix] = (h.length === 2 && m.length === 2) ? `${h}:${m}` : '';
        }
        delete out.__timeRaw;
    }
    // hasTime=false 时强制 startTime/endTime 为空
    if (out.hasTime !== 'on') {
        out.startTime = '';
        out.endTime = '';
    }
    // hasTime 字段不参与 SDK payload
    delete out.hasTime;
    return out;
}

function clearScheduleFields(root, selector) {
    root.querySelectorAll(selector).forEach((el) => {
        if (el.type === 'checkbox') {
            el.checked = false;
            // 同步：时间行变灰
            const container = el.closest('.phome-schedule__compose') || el.closest('.phome-schedule__edit-panel') || el.closest('.phome-schedule__item');
            const row = container ? container.querySelector('[data-time-row]') : null;
            if (row) {
                row.classList.add('is-disabled');
                row.style.cssText = 'opacity:0.55 !important; filter:grayscale(0.3);';
                row.querySelectorAll('select').forEach(sel => {
                    sel.disabled = true;
                    sel.style.cssText = 'background:rgba(120,120,128,0.08) !important; color:rgba(60,60,67,0.6) !important;';
                });
            }
        } else {
            el.value = '';
        }
    });
}

// ============================================
// 人设主页 · 上下文区块交互
// ============================================

/**
 * 上下文 App 选择器 change 事件
 */
function handleContextAppSelect(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const shell = target.closest('.app-shell');
    if (!shell) return;

    if (target.matches('[data-context-app-select]')) {
        const selectedAppId = target.value;
        // 写入 personaHome state
        if (window.settingsApp?.state?.personaHome) {
            window.settingsApp.state.personaHome.contextAppId = selectedAppId;
            // 触发重渲染
            try {
                if (window.__detailRenderTick) window.__detailRenderTick.value++;
            } catch (_) {}
            window.refreshPhoneApps?.();
        }
    }
}

/**
 * 上下文刷新按钮点击
 */
function handleContextRefresh(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const shell = target.closest('.app-shell');
    if (!shell) return;

    if (target.matches('[data-context-refresh]')) {
        event.stopPropagation();
        // 刷新上下文预览（强制重渲染）
        try {
            if (window.__detailRenderTick) window.__detailRenderTick.value++;
        } catch (_) {}
        window.refreshPhoneApps?.();
    }
}

/**
 * 上下文 pre 区域点击复制
 */
function handleContextPreClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const shell = target.closest('.app-shell');
    if (!shell) return;

    // 点击的是上下文预览区域
    const preEl = target.closest('[data-context-pre]');
    if (preEl) {
        event.stopPropagation();
        const text = preEl.textContent || '';
        navigator.clipboard.writeText(text).then(() => {
            // 可以通过 toast 或 island 提示
        }).catch(() => {});
    }
}

let aiSearchDebounce = null;

function dispatchMethodAction(method, payload) {
    window.dispatchEvent(new CustomEvent('app:page-action', {
        detail: {
            action: 'appMethod',
            appId: 'settings',
            method,
            payload,
        },
    }));
}

// ============================================
// API 管理器事件处理
// ============================================

function handleApiMgrChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const shell = target.closest('.app-shell');
    if (!shell) return;

    // API Key 启用/禁用开关
    const keyToggle = target.getAttribute('data-api-key-toggle');
    if (keyToggle !== null && target.type === 'checkbox') {
        event.stopPropagation();
        const enabled = target.checked;
        dispatchMethodAction('apiKeyToggle', { id: keyToggle, enabled });
        return;
    }
}

function handleApiMgrClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const shell = target.closest('.app-shell');
    if (!shell) return;

    // 策略选项点击
    const strategyOption = target.closest('.api-mgr-strategy-option');
    if (strategyOption) {
        event.stopPropagation();
        const radio = strategyOption.querySelector('input[type="radio"]');
        if (radio) {
            // 取消所有选中
            document.querySelectorAll('.api-mgr-strategy-option').forEach(opt => {
                opt.classList.remove('is-active');
            });
            // 选中当前
            strategyOption.classList.add('is-active');
            radio.checked = true;
        }
        return;
    }

    // 密钥选项点击
    const keyOption = target.closest('.api-mgr-key-option');
    if (keyOption) {
        event.stopPropagation();
        const checkbox = keyOption.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.checked = !checkbox.checked;
            if (checkbox.checked) {
                keyOption.classList.add('is-selected');
            } else {
                keyOption.classList.remove('is-selected');
            }
        }
        return;
    }

    // 模态框背景点击关闭
    if (target.matches('.api-mgr-modal-overlay') && !target.closest('.api-mgr-modal')) {
        event.stopPropagation();
        dispatchMethodAction('apiCloseKeyEditor');
        dispatchMethodAction('apiCloseGroupEditor');
        return;
    }
}

export default function createSettingApp() {
    installGlobalBindings();
    return SETTINGS_APP_CONFIG;
}