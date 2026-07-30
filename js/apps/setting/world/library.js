/**
 * 世界观模块 · 渲染层（v0.17）
 *
 * 按「世界观制作思路.md」§0.1 核心模块 + 阶段×地点×时间联动
 * 还原所有 UI：
 *   顶部 tab：预览 / 世界观 / 空间 / 时间 + 折叠面板
 *
 * 所有列表/编辑/详情都基于 data-world-field / data-location-field /
 * data-timeline-field / data-anchor-bind-field 等约定字段，
 * 配合 methods.js 里的读取函数收集。
 *
 * v0.17：删除「社媒」/「App绑定」/「上下文注入」三个 tab & 入口；
 *       时间日期统一 3 段 year/month/day（彻底移除基周期/周概念）。
 */

import { escapeHtml } from '@/src/core/escape.js';
import {
    REAL_CITIES,
    TIMELINE_TYPES,
    ANCHOR_TYPES,
} from './sdk/defaults.js';
import { buildPresetGroupState } from './presets/world-presets.js';
import { renderEditForm } from './sdk/form-renderer.js';
import {
    WORLD_GROUP_FORM_SCHEMA,
    ANCHOR_FORM_SCHEMA,
    TIMELINE_FORM_SCHEMA,
    CHRONICLE_EVENT_FORM_SCHEMA,
    LOCATION_FORM_SCHEMA,
    PLACE_FORM_SCHEMA,
    WORLD_FORM_SCHEMA,
} from './sdk/form-schema.js';

const SETTINGS_APP_ID = 'settings';

// ============================================
// 工具
// ============================================

/** 拼一个 settings appMethod 的 data-app-action。 */
const wvAction = (method, payload = {}) => {
    const json = JSON.stringify({ action: 'appMethod', appId: SETTINGS_APP_ID, method, payload });
    return `data-app-action="${encodeURIComponent(json)}"`;
};

/** 拼一个 worldRoute 的 data-app-action。 */
const wvRouteAction = (sub, extraPayload = {}) =>
    wvAction('worldRoute', { sub, ...extraPayload });

/** ISO 日期。 */
const formatDate = (timestamp) => {
    if (!timestamp) return '—';
    const d = new Date(timestamp);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** ISO 日期 + 时间。 */
const formatDateTime = (timestamp) => {
    if (!timestamp) return '—';
    const d = new Date(timestamp);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** 安全 escape 后输出。 */
const e = escapeHtml;

/** 根据城市 ID 获取城市标签。 */
const getCityLabel = (cityId) => {
    if (!cityId) return '';
    const city = REAL_CITIES.find(c => c.id === cityId);
    return city ? city.label : cityId;
};

/**
 * 拿到「当前应用上下文里的世界」：优先 route.currentWorldId（用户已进入的世界），
 * 否则退到 sdk.worlds.getActive()。所有 renderChronicle / renderChronicleEventList 等都应该用它。
 */
const getCurrentWorld = (app, sdk) => {
    if (!sdk) return null;
    const route = app?.state?.world || {};
    if (route.currentWorldId) return sdk.worlds.get(route.currentWorldId) || null;
    return sdk.worlds.getActive() || null;
};

/** 转 boolean checkbox checked。 */
const checkedAttr = (v) => (v ? 'checked' : '');

/** 列表空提示。 */
const emptyHint = (glyph, text) => `
    <div class="wv-list__empty">
        ${glyph ? `<div class="wv-list__empty-glyph">${e(glyph)}</div>` : ''}
        <div class="wv-list__empty-text">${e(text)}</div>
    </div>
`;

// ============================================
// 顶部 tab 切换（v0.12：库级 + 世界级 两层）
// ============================================
// 设计：
//   - 库级 tab：预览 / 世界观（组+世界列表）
//   - 世界级 tab：概览 / 空间 / 时间 （其它模块全部并入 body 末尾的
//     「设置面板」折叠容器，包括：地点、标签、草稿、快照、预设、导入导出。）
//
// 「时间」是叙事骨架（自定义粒度的年/月/日 + 自定义事），与「阶段」（剧情节点）
// 是两个独立的维度：时间提供背景年份，阶段挂在某个/某些时间位置上。
// ============================================

const LIBRARY_TABS = [
    { id: 'overview', label: '预览',   glyph: '◉' },
    { id: 'worlds',   label: '世界观', glyph: '◯' },
];

const WORLD_TABS = [
    { id: 'overview',  label: '概览',     glyph: '◉' },
    { id: 'map',       label: '空间',     glyph: '◈' },
    { id: 'timelines', label: '时间',     glyph: '⌚' },
    { id: 'flow',      label: '夹子',     glyph: '≋' },
];

// v0.17：删除"场所"（空间tab已有）、"标签"、"快照"；只保留"预设"、"导入导出"
// 流动功能暂时注释，后续实现 prompt 数据结构
// v0.18：新增"资产系统"入口
const SETTINGS_PANEL_SECTIONS = [
    // —— 资产 ——
    { id: 'assets',   label: '资产',     glyph: '', desc: '货币名称与资产设定' },
    // —— 运维 / 导出 ——
    { id: 'presets',   label: '预设',     glyph: '', desc: '预设世界观方案' },
    { id: 'export',    label: '导入导出', glyph: '↕', desc: '打包 / 分享 / 同步' },
];

const renderLibraryTabs = (activeSub, route) => {
    // 库级 sub 限定在 LIBRARY_TABS 已知的 id；否则回到 overview
    const known = LIBRARY_TABS.some(t => t.id === activeSub);
    const sub = known ? activeSub : 'overview';
    return `
        <div class="wv-tabs wv-tabs--library">
            ${LIBRARY_TABS.map(tab => `
                <button class="wv-tab ${sub === tab.id ? 'is-active' : ''}" ${wvRouteAction(tab.id)}>
                    <span class="wv-tab__glyph">${e(tab.glyph)}</span>
                    <span class="wv-tab__label">${e(tab.label)}</span>
                </button>
            `).join('')}
        </div>
    `;
};

const renderWorldTabs = (activeSub) => {
    // 世界级：保持当前 world active，并把左侧「‹ 返回」按钮放最前
    const safeSub = WORLD_TABS.some(t => t.id === activeSub) ? activeSub : 'overview';
    const backAttr = wvAction('worldBackToLibrary');
    return `
        <div class="wv-tabs wv-tabs--world">
            <button class="wv-tab wv-tab--back" ${backAttr}>
                <span class="wv-tab__glyph">‹</span>
                <span class="wv-tab__label">返回</span>
            </button>
            <div class="wv-tabs__world-tabs">
                ${WORLD_TABS.map(tab => `
                    <button class="wv-tab ${safeSub === tab.id ? 'is-active' : ''}" ${wvRouteAction(tab.id)}>
                        <span class="wv-tab__label">${e(tab.label)}</span>
                    </button>
                `).join('')}
            </div>
        </div>
    `;
};

// ============================================
// 顶部总览 / 入口卡
// ============================================
// 库级 preview（renderLibraryOverview）：只展示世界观库本身的体量
//   （世界 / 库 / 标签）。不依赖 sdk.worlds.getActive()，因为「当前世界观」
//   由用户人设绑定决定，不在世界观设置里手动切换。
//
// 世界级 preview（renderWorldOverview）：用户已经进入某个具体的世界，
//   这里展示「我 [world] AI」登录卡 + 用户阶段。
// ============================================

const renderLibraryOverview = (app) => {
    const sdk = window.settingsSdk;
    if (!sdk) return '<div class="wv-empty">SDK 未初始化</div>';

    const worlds = sdk.worlds.list();
    const groups = sdk.worldGroups.list();

    const stats = [
        { num: worlds.length, label: '世界',     tab: 'worlds' },
        { num: groups.length, label: '世界观库', tab: 'worlds' },
    ];

    const empty = worlds.length === 0;

    return `
        <div class="wv-overview">
            <div class="wv-landing ${empty ? 'wv-landing--empty' : ''}" ${wvRouteAction('worlds')}>
                <div class="wv-callout wv-callout--info">
                    <div class="wv-callout__title">世界观库</div>
                    <div class="wv-callout__desc">
                        先建「库」（比如「现代世界观」「古代世界观」），再在库里添加具体的世界观。
                        每个世界观都自包含阶段 / 地点 / 时间线等完整结构。
                    </div>
                </div>
                <div class="wv-landing__cta">${empty ? '点击此处新建第一个世界观' : '点击进入世界观视图 ›'}</div>
            </div>

            <div class="wv-card-grid">
                ${stats.map(s => `
                    <button class="wv-overview__card" ${wvRouteAction(s.tab)}>
                        <div class="wv-overview__card-icon wv-overview__card-icon--${s.tab}" style="background:${statColor(s.tab)}">${e(s.num)}</div>
                        <div class="wv-overview__card-body">
                            <div class="wv-overview__card-title">CURRENT</div>
                            <div class="wv-overview__card-name">${e(s.label)}</div>
                            <div class="wv-overview__card-detail">点击进入 ${e(s.tab)} 视图</div>
                        </div>
                    </button>
                `).join('')}
            </div>
        </div>
    `;
};

// 世界级 overview：用户已经进入某个具体的世界。
// v0.17：阶段已挪到人设，这里只展示概述。
const renderWorldOverview = (app) => {
    const sdk = window.settingsSdk;
    if (!sdk) return '<div class="wv-empty">SDK 未初始化</div>';
    const route = app?.state?.world || {};
    const world = sdk.worlds.get(route.currentWorldId);
    if (!world) {
        return renderLibraryOverview(app);
    }

    // 检查是否处于编辑态
    const editingId = route.editingId;
    const isEditing = editingId === world.id;

    if (isEditing) {
        return `
            <div class="wv-overview wv-overview--editing">
                ${renderWorldEditForm(world, route)}
            </div>
        `;
    }

    const summary = (world.summary || '').trim();
    const summaryHtml = summary
        ? `<div class="wv-landing__summary">${e(summary)}</div>`
        : `<div class="wv-landing__summary wv-landing__summary--empty">还没有世界观概述，点击下方补充 ›</div>`;

    return `
        <div class="wv-overview">
            <div class="wv-landing" ${wvAction('worldEdit', { id: world.id })}>
                <div class="wv-landing__title">世界观概述</div>
                ${summaryHtml}
                <div class="wv-landing__cta">点击进入完整编辑视图 ›</div>
            </div>
        </div>
    `;
};

const statColor = (tab) => ({
    groups: 'linear-gradient(145deg, #34C759, #30D158)',
    anchors: 'linear-gradient(145deg, #0A84FF, #5856D6)',
    map: 'linear-gradient(145deg, #30D158, #34C759)',
    locations: 'linear-gradient(145deg, #FF9F0A, #FFCC00)',
    tags: 'linear-gradient(145deg, #5AC8FA, #64D2FF)',
}[tab] || '#8E8E93');

// ============================================
// 世界观库 / 世界观（满血版）
// ============================================

const renderGroupsList = (app) => {
    const sdk = window.settingsSdk;
    if (!sdk) return '<div class="wv-empty">SDK 未初始化</div>';
    const groups = sdk.worldGroups.list();
    const ungrouped = sdk.worldGroups.listWorldsByGroup(null);
    const editingGroupId = app?.state?.world?.editingGroupId;

    const renderGroupRow = (group) => {
        const isEditing = group.id === editingGroupId;
        if (isEditing) return renderWorldGroupEditForm(group);
        const count = sdk.worldGroups.listWorldsByGroup(group.id).length;
        const deleteButton = count === 0
            ? `<button class="wv-btn wv-btn--danger wv-btn--sm" ${wvAction('worldDeleteGroup', { groupId: group.id })}>删除</button>`
            : '<button class="wv-btn wv-btn--danger wv-btn--sm" disabled title="请先删除库内的世界观">删除</button>';
        return `
            <div class="wv-list__item">
                <div class="wv-list__item-head">
                    <div class="wv-list__item-name">${e(group.name)}</div>
                    <div class="wv-list__item-actions">
                        <button class="wv-btn wv-btn--ghost wv-btn--sm" ${wvAction('worldOpenGroup', { groupId: group.id })}>查看</button>
                        <button class="wv-btn wv-btn--ghost wv-btn--sm" ${wvAction('worldEditGroup', { groupId: group.id })}>编辑</button>
                        ${deleteButton}
                    </div>
                </div>
                ${group.description ? `<div class="wv-list__item-summary">${e(group.description)}</div>` : ''}
                <div class="wv-list__item-meta">${count} 个世界观</div>
            </div>
        `;
    };

    return `
        <div class="wv-list">
            <div class="wv-list__head">
                <button class="wv-btn wv-btn--primary wv-btn--block" ${wvAction('worldCreateGroup')}>+ 新建库</button>
            </div>
            ${groups.length === 0 ? `
                ${emptyHint('', '还没有世界观库。点击新建按钮添加（比如「现代世界观」「古代世界观」）。')}
            ` : groups.map(renderGroupRow).join('')}
            ${ungrouped.length > 0 ? `
                <div class="wv-list__item" ${wvAction('worldOpenGroup', { groupId: null })}>
                    <div class="wv-list__item-head">
                        <div class="wv-list__item-name">未分组</div>
                        <div class="wv-list__item-actions">
                            <button class="wv-btn wv-btn--ghost wv-btn--sm" ${wvAction('worldOpenGroup', { groupId: null })}>查看 ›</button>
                        </div>
                    </div>
                    <div class="wv-list__item-summary">这部分世界观还没归属到任何库。</div>
                    <div class="wv-list__item-meta">${ungrouped.length} 个世界观</div>
                </div>
            ` : ''}
        </div>
    `;
};

const renderWorldGroupEditForm = (group) => renderEditForm(
    WORLD_GROUP_FORM_SCHEMA,
    group,
    {
        e,
        checkedAttr,
        saveAction: wvAction('worldSaveGroup', { groupId: group.id }),
        cancelAction: wvAction('worldEditGroupCancel'),
    }
);

const renderWorldsList = (app) => {
    const sdk = window.settingsSdk;
    if (!sdk) return '<div class="wv-empty">SDK 未初始化</div>';
    const route = app?.state?.world || {};
    const currentGroupId = route.currentGroupId ?? null;

    const items = sdk.worldGroups.listWorldsByGroup(currentGroupId);
    const editingId = route.editingId;

    const group = currentGroupId ? sdk.worldGroups.get(currentGroupId) : null;
    const isUngrouped = currentGroupId === null && route.currentGroupId !== undefined;
    const groupLabel = isUngrouped ? '未分组的世界观'
        : (group ? group.name : '全部世界观');
    const groupDesc = group?.description || '';

    return `
        <div class="wv-list">
            <div class="wv-list__head">
                <button class="wv-btn wv-btn--ghost wv-btn--sm wv-list__back" ${wvAction('worldBackToGroups')}>‹ 返回库</button>
                <div class="wv-list__title-block">
                    <div class="wv-list__title">${e(groupLabel)}</div>
                    ${groupDesc ? `<div class="wv-list__desc">${e(groupDesc)}</div>` : ''}
                </div>
                <button class="wv-btn wv-btn--primary" ${wvAction('worldCreate')}>+ 新建世界观</button>
            </div>
            ${items.length === 0 ? `
                ${emptyHint('', isUngrouped ? '「未分组」区为空。' : '还没有世界观，点击右上角新建。')}
            ` : items.map(item => {
                const isEditing = item.id === editingId;
                return isEditing
                    ? renderWorldEditForm(item)
                    : `<div class="wv-list__item">${renderWorldItemCard(item, currentGroupId)}</div>`;
            }).join('')}
        </div>
    `;
};

const renderWorldItemCard = (item, currentGroupId) => {
    const sdk = window.settingsSdk;
    const anchorCount = sdk.anchors?.getAnchors?.(item.id)?.length || 0;
    const locCount = sdk.locations.list({ worldRef: item.id }).length;
    const tagCount = (item.tagRefs || []).length;
    return `
        <div class="wv-list__item-head">
            <div class="wv-list__item-name">${e(item.name || item.id)}</div>
            <div class="wv-list__item-actions">
                <button class="wv-btn wv-btn--primary wv-btn--sm" ${wvAction('worldEnter', { id: item.id })}>进入 ›</button>
                <button class="wv-btn wv-btn--ghost wv-btn--sm" ${wvAction('worldEdit', { id: item.id })}>编辑</button>
                ${currentGroupId !== undefined ? `
                    <div class="wv-select-icon-wrap">
                        <select class="wv-editor__select wv-editor__select--sm wv-editor__select--icon"
                            title="移动到其他库"
                            data-world-assign="${e(item.id)}">
                            <option value="">⇄</option>
                            ${window.settingsSdk.worldGroups.list().map(g => `<option value="${e(g.id)}">${e(g.name)}</option>`).join('')}
                        </select>
                    </div>
                ` : ''}
                <button class="wv-btn wv-btn--danger wv-btn--sm" ${wvAction('worldDelete', { id: item.id })}>删除</button>
            </div>
        </div>
        ${item.summary ? `<div class="wv-list__item-summary">${e(item.summary)}</div>` : ''}
        <div class="wv-list__item-fields">
            <span class="wv-list__item-field"><span class="wv-list__item-field-key">时间锚点</span> ${anchorCount}</span>
            <span class="wv-list__item-field"><span class="wv-list__item-field-key">场所</span> ${locCount}</span>
            <span class="wv-list__item-field"><span class="wv-list__item-field-key">标签</span> ${tagCount}</span>
        </div>
        <div class="wv-list__item-meta">
            <span class="wv-list__item-id">${e(item.id)}</span>
            <span class="wv-list__item-dot">·</span>
            <span class="wv-list__item-updated">更新于 ${e(formatDateTime(item.updatedAt))}</span>
        </div>
    `;
};

const renderWorldEditForm = (world, route, opts = {}) => {
    const ctx = {
        e,
        checkedAttr,
        route,
        saveAction: wvAction('worldSave', { id: world.id }),
        cancelAction: wvAction('worldEditCancel'),
    };
    return renderEditForm(WORLD_FORM_SCHEMA, world, ctx);
};

// ★ 仅渲染「★ 纪时系统」一节（独立表单，用于时间详情页内联编辑）
const renderChronologyEditForm = (world) => {
    const chronoSection = (WORLD_FORM_SCHEMA.sections || []).find(
        s => s.title === '纪时系统'
    );
    if (!chronoSection) {
        return `<div class="wv-empty">找不到纪时系统 section</div>`;
    }
    // 构造一个只含 chronology section 的临时 schema，复用渲染器
    const tempSchema = {
        ...WORLD_FORM_SCHEMA,
        sections: [chronoSection],
    };
    return renderEditForm(
        tempSchema,
        world,
        {
            e,
            checkedAttr,
            saveAction: wvAction('worldSaveChronology'),
            cancelAction: wvAction('worldEditChronologyCancel'),
        }
    );
};

// ============================================
// 场所 (Map)
// ============================================

const renderLocationsList = (app) => {
    const sdk = window.settingsSdk;
    if (!sdk) return '<div class="wv-empty">SDK 未初始化</div>';
    const world = sdk.worlds.getActive();
    const locations = world ? sdk.locations.list({ worldRef: world.id }) : [];
    const editingId = app?.state?.world?.editingLocationId;

    return `
        <div class="wv-list">
            <div class="wv-list__head">
                <div class="wv-list__title-block">
                    <div class="wv-list__title">场所库</div>
                    <div class="wv-list__desc">所有场所先在此编辑，再到「空间」页看可视化。</div>
                </div>
                <button class="wv-btn wv-btn--primary" ${wvAction('worldCreateLocation')}>+ 新建场所</button>
            </div>
            ${!world ? `<div class="wv-list__empty-text">先在「世界观」设一个当前。</div>` :
              locations.length === 0 ? `
                ${emptyHint('', '还没有场所，点击右上角新建。')}
            ` : locations.map(loc => {
                const isEditing = loc.id === editingId;
                return `
                    <div class="wv-list__item">
                        ${isEditing ? renderLocationEditForm(loc, world, app) : renderLocationCard(loc)}
                    </div>
                `;
            }).join('')}
        </div>
    `;
};

const renderLocationCard = (loc) => {
    const sdk = window.settingsSdk;
    const place = loc.placeRef ? sdk?.places.get(loc.placeRef) : null;
    const pos = loc.position || { x: 0, y: 0 };
    return `
        <div class="wv-list__item-head">
            <div class="wv-list__item-name">${e(loc.name)} ${loc.isCenter ? '<span class="wv-list__item-badge">主场所</span>' : ''}</div>
            <div class="wv-list__item-actions">
                ${!loc.isCenter ? `<button class="wv-btn wv-btn--ghost wv-btn--sm" ${wvAction('worldSetCenterLocation', { id: loc.id })}>设为主场所</button>` : ''}
                <button class="wv-btn wv-btn--ghost wv-btn--sm" ${wvAction('worldEditLocation', { id: loc.id })}>编辑</button>
                <button class="wv-btn wv-btn--danger wv-btn--sm" ${wvAction('worldDeleteLocation', { id: loc.id })}>删除</button>
            </div>
        </div>
        ${loc.summary ? `<div class="wv-list__item-summary">${e(loc.summary)}</div>` : ''}
        <div class="wv-list__item-fields">
            ${place ? `<span class="wv-list__item-field"><span class="wv-list__item-field-key">所属地点</span> ${e(place.name)}</span>` : ''}
            <span class="wv-list__item-field"><span class="wv-list__item-field-key">坐标</span> ${formatCoord(pos)}</span>
            ${loc.accessType === 'restricted' ? '<span class="wv-tag wv-tag--warn">受限</span>' : ''}
            <span class="wv-list__item-field"><span class="wv-list__item-field-key">可见角色</span> ${e((loc.allowedRoles || ['user','ai']).join(','))}</span>
        </div>
    `;
};

/** 坐标格式：`(x=12, y=-34)` 或主场所的 `(0, 0) 主`。 */
const formatCoord = (pos) => {
    const x = Number(pos?.x || 0);
    const y = Number(pos?.y || 0);
    return `x=${x}, y=${y}`;
};

/** 把世界坐标 (x ∈ [-100,100], y ∈ [-100,100]) 映射成百分比字符串。 */
const coordToPct = (v) => ((v + 100) / 200 * 100).toFixed(2);

/**
 * 地点编辑表单（用于地点地图编辑态）。
 */
const renderPlaceEditForm = (place, world) => {
    return renderEditForm(
        PLACE_FORM_SCHEMA,
        place,
        {
            e,
            saveAction: wvAction('worldSavePlace', { id: place.id }),
            cancelAction: wvAction('worldEditPlaceCancel'),
        }
    );
};

/**
 * 场所编辑表单（用于场所地图编辑态）。
 */
const renderLocationEditForm = (loc, world, app) => {
    const places = window.settingsSdk
        ? window.settingsSdk.places.list({ worldRef: world?.id })
        : [];
    const route = app?.state?.world || {};
    return renderEditForm(
        LOCATION_FORM_SCHEMA,
        loc,
        {
            e,
            checkedAttr,
            route,
            saveAction: wvAction('worldSaveLocation', { id: loc.id }),
            cancelAction: wvAction('worldEditLocationCancel'),
            places,
        }
    );
};

// ============================================
// 空间地图（v0.12）— 支持「地点地图」/「场所地图」两种模式
// ============================================

/** 渲染地点 pin（用于地点地图）。 */
const renderMapPlacePin = (place, editingId, world) => {
    if (editingId === place.id) {
        return renderPlaceEditForm(place, world);
    }
    return `
        <div class="wv-list__item">
            <div class="wv-list__item-head">
                <span class="wv-list__item-icon">${e(place.icon || '')}</span>
                <span class="wv-list__item-name">${e(place.name)}</span>
            </div>
            <div class="wv-list__item-actions">
                <button class="wv-btn wv-btn--ghost wv-btn--sm" ${wvAction('worldEditPlace', { id: place.id })}>编辑</button>
                <button class="wv-btn wv-btn--ghost wv-btn--sm wv-btn--danger" ${wvAction('worldDeletePlace', { id: place.id })}>删除</button>
            </div>
            ${place.realCityRef ? `<div class="wv-list__item-fields"><span class="wv-list__item-field"><span class="wv-list__item-field-key">天气映射</span> ${e(getCityLabel(place.realCityRef))}</span></div>` : ''}
        </div>
    `;
};

/** 渲染场所 pin（用于场所地图）。 */
const renderMapLocationRow = (loc, editingId, world, app) => {
    if (editingId === loc.id) {
        return renderLocationEditForm(loc, world, app);
    }
    const badges = [
        loc.isCenter ? '<span class="wv-tag wv-tag--primary">主场所</span>' : '',
        loc.accessType === 'restricted' ? '<span class="wv-tag wv-tag--warning">受限</span>' : '',
    ].join('');
    return `
        <div class="wv-list__item">
            <div class="wv-list__item-head">
                <span class="wv-list__item-icon">${e(loc.icon || '')}</span>
                <span class="wv-list__item-name">${e(loc.name)}</span>
                ${badges}
            </div>
            <div class="wv-list__item-actions">
                <button class="wv-btn wv-btn--ghost wv-btn--sm" ${wvAction('worldEditLocation', { id: loc.id })}>编辑</button>
                <button class="wv-btn wv-btn--ghost wv-btn--sm wv-btn--danger" ${wvAction('worldDeleteLocation', { id: loc.id })}>删除</button>
            </div>
        </div>
    `;
};

/** 空间地图主渲染器。 */
const renderMap = (app) => {
    const sdk = window.settingsSdk;
    if (!sdk) return '<div class="wv-empty">SDK 未初始化</div>';
    const world = sdk.worlds.getActive();
    if (!world) return '<div class="wv-empty">先在「世界观」里选一个当前</div>';

    const route = app?.state?.world || {};
    const mapMode = route.mapMode || 'place';
    const zoom = app?.state?.world?.mapZoom ?? 1;
    const editingPlaceId = route.editingPlaceId;
    const editingLocationId = route.editingLocationId;
    const centerPlaceId = route.mapCenterPlaceId;
    const selectedPlaceId = route.mapSelectedPlaceId;

    const places = sdk.places.list({ worldRef: world.id });
    const locations = sdk.locations.list({ worldRef: world.id });
    const filteredLocations = selectedPlaceId ? locations.filter(l => l.placeRef === selectedPlaceId) : locations;

    const centerPlace = centerPlaceId ? sdk.places.get(centerPlaceId) : null;
    const selectedPlace = selectedPlaceId ? sdk.places.get(selectedPlaceId) : null;
    const center = sdk.locations.getCenter(world.id);

    const locCountByPlace = {};
    locations.forEach(l => { const pr = l.placeRef || '__none__'; locCountByPlace[pr] = (locCountByPlace[pr] || 0) + 1; });

    const zoomSlider = (extra = '') => {
        const min = 0.25, max = 5;
        const fillPct = Math.max(0, Math.min(100, ((zoom - min) / (max - min)) * 100));
        return `
        <input type="range" class="wv-map__zoom-slider" min="0.25" max="5" step="0.01" value="${zoom}"
            data-wv-zoom ${extra}
            style="--wv-zoom-fill: ${fillPct.toFixed(2)}%">
        <span class="wv-map__zoom-val" data-wv-zoom-val>${(zoom * 100).toFixed(0)}%</span>
        <button class="wv-map__zoom-reset" ${wvAction('worldSetMapZoom', { zoom: 1 })} title="重置缩放 (1×)" aria-label="重置缩放"></button>
    `;
    };

    const invZoom = Math.max(0.35, 1 - (zoom - 1) * 0.08);

    // === 公共样式：分段 tab（左）+ 占位 select（中）+ 圆角胶囊按钮（右）===
    const tabsHtml = `
        <div class="wv-map__mode-tabs">
            <button class="wv-map__mode-tab ${mapMode === 'place' ? 'is-active' : ''}" ${wvAction('worldSetMapMode', { mode: 'place' })}>地点地图</button>
            <button class="wv-map__mode-tab ${mapMode === 'location' ? 'is-active' : ''}" ${wvAction('worldSetMapMode', { mode: 'location' })}>场所地图</button>
        </div>
    `;

    // === 地点地图模式 ===
    if (mapMode === 'place') {
        return `
            <div class="wv-map">
                <div class="wv-map__mode-bar">
                    ${tabsHtml}
                    <div class="wv-map__mode-picker">
                        <span class="wv-map__mode-picker-placeholder"></span>
                        <button class="wv-map__mode-create" ${wvAction('worldCreatePlace')}>+ 新建地点</button>
                    </div>
                </div>

                <div class="wv-callout wv-callout--info">
                    <div class="wv-callout__header">
                        <div>
                            <div class="wv-callout__title">地点地图</div>
                            <div class="wv-callout__desc">${places.length} 个地点 · 上传背景图自定义样式</div>
                        </div>
                        <label class="wv-upload-btn" title="上传地图背景图">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                <path d="M8 3V13M3 8H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                            </svg>
                            <input type="file" accept="image/*" class="wv-file-input" data-wv-upload-map-bg />
                        </label>
                    </div>
                </div>
                ${centerPlace?.mapImageUrl ? '<div class="wv-map__custom-bg-tip"><span class="wv-tag wv-tag--primary">自定义背景</span> 已应用自定义地图背景图</div>' : ''}

                <div class="wv-map__toolbar">
                    <div class="wv-map__toolbar-section wv-map__toolbar-section--zoom">
                        <span class="wv-map__toolbar-label">缩放：</span>
                        ${zoomSlider()}
                    </div>
                </div>

                <div class="wv-map__stage">
                    ${places.length === 0 ? emptyHint('◈', '还没有地点，请先创建') : `
                        <div class="wv-map__world" style="transform:scale(${zoom})">
                            ${centerPlace?.mapImageUrl
                                ? `<img class="wv-map__bg-image" src="${e(centerPlace.mapImageUrl)}" alt="地图背景" />`
                                : '<div class="wv-map__grid"></div>'}
                            ${places.map(place => {
                                const px = ((place.mapOffsetX + 100) / 200 * 100).toFixed(2);
                                const py = (100 - (place.mapOffsetY + 100) / 200 * 100).toFixed(2);
                                return `
                                    <div class="wv-map__pin ${place.id === centerPlaceId ? 'is-center' : ''}"
                                         style="left:${e(px)}%;top:${e(py)}%;--pin-scale:${invZoom.toFixed(4)}"
                                         title="${e(place.name)} · 坐标(${place.mapOffsetX}, ${place.mapOffsetY})"
                                         data-place-id="${e(place.id)}" data-wv-map-pin
                                         ${wvAction('worldSetMapCenterPlace', { placeId: place.id })}>
                                        <div class="wv-map__pin-icon">${e(place.icon || '')}</div>
                                        <div class="wv-map__pin-label">${e(place.name)}</div>
                                    </div>`;
                            }).join('')}
                        </div>
                    `}
                </div>

                <div class="wv-map__list">
                    <div class="wv-list__head"><div class="wv-list__title">所有地点</div></div>
                    <div class="wv-list">${places.map(p => renderMapPlacePin(p, editingPlaceId, world)).join('')}</div>
                </div>
            </div>
        `;
    }

    // === 场所地图模式 ===
    return `
        <div class="wv-map">
            <div class="wv-map__mode-bar">
                ${tabsHtml}
                <div class="wv-map__mode-picker">
                    <select class="wv-map__mode-select" data-wv-select-place>
                        <option value="">— 选择地点 —</option>
                        ${places.map(p => `<option value="${e(p.id)}" ${p.id === selectedPlaceId ? 'selected' : ''}>${e(p.name)} (${locCountByPlace[p.id] || 0} 个场所)</option>`).join('')}
                    </select>
                    <button class="wv-map__mode-create" ${wvAction('worldCreateLocation')}>+ 场所</button>
                </div>
            </div>

            ${!selectedPlaceId ? `
                <div class="wv-callout wv-callout--info">
                    <div class="wv-callout__title">场所地图</div>
                    <div class="wv-callout__desc">请先选择要查看的地点</div>
                </div>
                <div class="wv-map__empty-select">
                    <div class="wv-map__empty-icon"></div>
                    <div class="wv-map__empty-text">选择一个地点以查看其场所地图</div>
                </div>
            ` : `
                <div class="wv-callout wv-callout--info">
                    <div class="wv-callout__header">
                        <div>
                            <div class="wv-callout__title">${e(selectedPlace?.name || '未知地点')} · 场所地图</div>
                            <div class="wv-callout__desc">${filteredLocations.length} 个场所 · 坐标以主场所为中心</div>
                        </div>
                        <label class="wv-upload-btn" title="上传场所地图背景图">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                <path d="M8 3V13M3 8H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                            </svg>
                            <input type="file" accept="image/*" class="wv-file-input" data-wv-upload-place-bg />
                        </label>
                    </div>
                </div>
                ${selectedPlace?.mapImageUrl ? '<div class="wv-map__custom-bg-tip"><span class="wv-tag wv-tag--primary">自定义背景</span> 已应用自定义地图背景图</div>' : ''}

                <div class="wv-map__toolbar">
                    <div class="wv-map__toolbar-section">
                        <span class="wv-map__toolbar-label">切换中心：</span>
                        <select class="wv-editor__select wv-map__center-select" data-wv-map-center>
                            ${filteredLocations.length === 0 ? '<option value="">— 无 —</option>' :
                                filteredLocations.map(loc => `<option value="${e(loc.id)}" ${loc.id === center?.id ? 'selected' : ''}>${e(loc.name)}${loc.isCenter ? '（主）' : ''}</option>`).join('')}
                        </select>
                        <button class="wv-btn wv-btn--ghost wv-btn--sm" ${wvAction('worldSetMapCenter', { locId: center?.id || '' })} title="重置">↺</button>
                    </div>
                    <div class="wv-map__toolbar-section wv-map__toolbar-section--zoom">
                        <span class="wv-map__toolbar-label">缩放：</span>
                        ${zoomSlider()}
                    </div>
                </div>

                <div class="wv-map__stage">
                    ${filteredLocations.length === 0 ? emptyHint('', '该地点下还没有场所') : `
                        <div class="wv-map__world" style="transform:scale(${zoom})">
                            ${selectedPlace?.mapImageUrl
                                ? `<img class="wv-map__bg-image" src="${e(selectedPlace.mapImageUrl)}" alt="场所地图背景" />`
                                : '<div class="wv-map__grid"></div>'}
                            ${filteredLocations.map(loc => {
                                const px = coordToPct(Number(loc.position?.x || 0));
                                const py = (100 - coordToPct(Number(loc.position?.y || 0))).toFixed(2);
                                return `
                                    <div class="wv-map__pin ${loc.id === center?.id ? 'is-center' : ''} ${loc.accessType === 'restricted' ? 'is-restricted' : ''}"
                                         style="left:${e(px)}%;top:${e(py)}%;--pin-scale:${invZoom.toFixed(4)}"
                                         title="${e(loc.name)} · ${e(loc.summary || '')}"
                                         data-location-id="${e(loc.id)}" data-wv-map-pin
                                         ${wvAction('worldEditLocation', { id: loc.id })}>
                                        <div class="wv-map__pin-icon">${e(loc.icon || '')}</div>
                                        <div class="wv-map__pin-label">${e(loc.name)}</div>
                                        ${loc.id === center?.id ? '<div class="wv-map__pin-dist">主场所</div>' : ''}
                                    </div>`;
                            }).join('')}
                        </div>
                    `}
                </div>

                <div class="wv-map__list">
                    <div class="wv-list__head"><div class="wv-list__title">${e(selectedPlace?.name || '')} 的所有场所</div></div>
                    <div class="wv-list">${filteredLocations.map(loc => renderMapLocationRow(loc, editingLocationId, world, app)).join('')}</div>
                </div>
            `}
        </div>
    `;
};

// ============================================
// ★ v0.13 时间线（Chronicle）
// ============================================
// 「时间」是叙事骨架，统一记录「事件 / 循环 / 纪念日」三类时间锚。详细模型见
// `世界观制作思路.md §16`。本视图只展示「世界」时间线，颗粒度由 §5.12 纪时系统的
// "大周期"（largeCycleName）驱动：用户在大周期名里写什么，bucket 标题就叫什么。
//
// 数据源：settings-sdk.timelines.getWorldTimeline / getPersonalTimeline。
// 当前先展示 world 时间线；personal 的 +按钮故意去掉 —— 后面等我 / AI 个人页做好
// 再根据纪时自动添加并罗列到此（详见思路文档 §16.5）。
// ============================================

const renderChronicle = (app) => {
    const sdk = window.settingsSdk;
    if (!sdk) return '<div class="wv-empty">SDK 未初始化</div>';
    const world = getCurrentWorld(app, sdk);
    if (!world) return '<div class="wv-empty">请先选择一个世界观</div>';

    const route = app?.state?.world || {};

    // ★ 独立纪时编辑模式：直接渲染纪时表单，停在「时间详情页」不切换 sub
    if (route.editingChronologyId === world.id) {
        return `
            <div class="wv-overview">
                ${renderChronologyEditForm(world)}
            </div>
        `;
    }

    window.__wvRoute = route;

    const editingOwner = route.editingTimelineOwner;
    const editingEventId = route.editingChronicleEventId || null;

    const worldEvents = sdk.timelines.getWorldTimeline(world.id);

    if (window.__WV_DEBUG === undefined) window.__WV_DEBUG = true;
    if (window.__WV_DEBUG) {
        console.log('[renderChronicle]', {
            routeCurrentWorldId: route.currentWorldId,
            activeWorldId: sdk.worlds.getActive()?.id,
            usedWorldId: world.id,
            usedWorldName: world.name,
            worldEventsCount: worldEvents.length,
            chronoLargeName: world.chronologySettings?.largeCycleName,
        });
    }

    // ★ v0.12 纪时系统配置面板
    const chronoEnabled = world.chronologySettings?.enabled ?? false;
    const chronoSummary = sdk.chronology?.getChronologySummary(world.id);

    // 实时转换：现在 → 世界观时间（面板打开时渲染一次，refresh 时再更新）
    let liveWorldDate = '';
    let liveWorldTime = '';
    if (chronoEnabled && chronoSummary && sdk.chronology) {
        try {
            const now = new Date();
            const worldTime = sdk.chronology.realToWorld(now, world.id);
            liveWorldDate = sdk.chronology.format(worldTime, 'date', world.id);
            liveWorldTime = sdk.chronology.format(worldTime, 'time', world.id);
        } catch (err) {
            // 忽略：保持空串，下方条件不渲染
        }
    }

    // ★ 纪时设置面板（可折叠）
    const isChronologyOpen = route.chronologyPanelOpen ?? false;
    const chronoPanel = `
        <div class="wv-chronology-settings" data-wv-chronology-panel>
            <div class="wv-chronology-settings__header" ${wvAction('worldToggleChronologyPanel')}>
                <span class="wv-chronology-settings__title">纪时系统</span>
                <span class="wv-tag ${chronoEnabled ? 'wv-tag--primary' : ''}">${chronoEnabled ? '已启用' : '未启用'}</span>
                <span class="wv-chronology-settings__toggle">${isChronologyOpen ? '▲' : '▼'}</span>
            </div>
            ${isChronologyOpen ? `
                <div class="wv-chronology-settings__body">
                    ${chronoEnabled && chronoSummary ? `
                        <div class="wv-chronology-settings__summary">
                            <div class="wv-chronology-settings__ratio-row">
                                <span class="wv-chronology-settings__label">周期配置：</span>
                                <span class="wv-chronology-settings__value wv-chronology-cycle-tags">
                                    ${chronoSummary.cycleNames.large ? `<b class="wv-cycle-tag wv-cycle-tag--large">${e(chronoSummary.cycleNames.large)}</b>` : `<span class="wv-cycle-tag wv-cycle-tag--empty">大周期未设</span>`}
                                    ${chronoSummary.cycleNames.medium ? `<b class="wv-cycle-tag wv-cycle-tag--medium">${e(chronoSummary.cycleNames.medium)}</b>` : `<span class="wv-cycle-tag wv-cycle-tag--empty">中周期未设</span>`}
                                    ${chronoSummary.cycleNames.small ? `<b class="wv-cycle-tag wv-cycle-tag--small">${e(chronoSummary.cycleNames.small)}</b>` : `<span class="wv-cycle-tag wv-cycle-tag--empty">小周期未设</span>`}
                                </span>
                            </div>
                            <div class="wv-chronology-settings__ratio-row">
                                <span class="wv-chronology-settings__label">纪年格式：</span>
                                <span class="wv-chronology-settings__value">
                                    ${chronoSummary.cycleNames.large ? e(chronoSummary.cycleNames.large) + ' N ' + e(chronoSummary.unitLabels.year) : 'N ' + e(chronoSummary.unitLabels.year)}
                                    ${chronoSummary.cycleNames.medium ? ' · ' + e(chronoSummary.cycleNames.medium) + ' N ' + e(chronoSummary.unitLabels.month) : ''}
                                    ${chronoSummary.cycleNames.small ? ' · ' + e(chronoSummary.cycleNames.small) + ' N ' + e(chronoSummary.unitLabels.day) : ''}
                                </span>
                            </div>
                            <div class="wv-chronology-settings__ratio-row">
                                <span class="wv-chronology-settings__label">基准年：</span>
                                <span class="wv-chronology-settings__value">
                                    现实 ${chronoSummary.baseYear}年 = 世界观 ${e(chronoSummary.cycleNames.large || '')}0${e(chronoSummary.unitLabels.year)}
                                </span>
                            </div>
                            ${liveWorldDate || liveWorldTime ? `
                                <div class="wv-chronology-settings__ratio-row wv-chronology-settings__ratio-row--live">
                                    <span class="wv-chronology-settings__label">当前时间：</span>
                                    <span class="wv-chronology-settings__value">
                                        ${e(liveWorldDate)} ${e(liveWorldTime)}
                                    </span>
                                </div>
                            ` : ''}
                            ${chronoSummary.hourSystem?.type === 'custom' ? `
                                <div class="wv-chronology-settings__ratio-row">
                                    <span class="wv-chronology-settings__label">时辰制：</span>
                                    <span class="wv-chronology-settings__value">${chronoSummary.hourSystem.names.map(h => e(h)).join(' / ')}</span>
                                </div>
                            ` : ''}
                            <div class="wv-chronology-settings__actions">
                                <button class="wv-btn wv-btn--primary wv-btn--sm" ${wvAction('worldQuickSaveCycleNames')}>保存周期名</button>
                                <button class="wv-btn wv-btn--ghost wv-btn--sm" ${wvAction('worldEditChronology')}>完整设置</button>
                                <button class="wv-btn wv-btn--ghost wv-btn--sm" ${wvAction('worldTestChronologyConversion')}>测试转换</button>
                            </div>
                        </div>
                    ` : `
                        <div class="wv-chronology-settings__empty">
                            <p>纪时系统可以将现实时间映射为自定义的时间单位名称和比例。</p>
                            <p>例如：古代世界用「卯时/寅时」，魔法世界「1年=2现实年」等。</p>
                            <div class="wv-chronology-settings__actions">
                                <button class="wv-btn wv-btn--primary wv-btn--sm" ${wvAction('worldEditChronology')}>启用纪时系统</button>
                            </div>
                        </div>
                    `}
                </div>
            ` : ''}
        </div>
    `;

    // ★ 按纪时「年」（large 周期）分组：当事件 date 形如 "0/0/0/2027/0/0/0" 这种
    // 7 段表达时，第 3 段（index=3）是大周期数值；纪时未启用则用现实年（YYYY）兜底。
    // 这是「按年/季/月」的替代方案：颗粒度由 §5.12 的 largeCycleName 决定，不再在 UI 上
    // 让用户手动切换。后续若需要更细颗粒（季/月），直接在纪时面板里切换 mediumCycleName
    // / smallCycleName 单位即可，bucket 标题跟着变。
    const largeCycleName = (chronoSummary && chronoSummary.cycleNames && chronoSummary.cycleNames.large)
        || (world.chronologySettings && world.chronologySettings.largeCycleName)
        || '';
    const largeUnitLabel = chronoSummary && chronoSummary.unitLabels
        ? chronoSummary.unitLabels.year
        : (world.chronologySettings && world.chronologySettings.yearLabel) || '年';

    const bucketKeyFor = (evt) => {
        const dateStr = evt.date || '';
        if (!dateStr.includes('/')) return '__custom__';
        const parts = dateStr.split('/');
        // v0.17：3 段格式 "year/month/day"，第 0 段是年
        const yearVal = parts[0];
        if (!yearVal) return '__custom__';
        if (largeCycleName) return `${largeCycleName} ${yearVal} ${largeUnitLabel || '·'}`;
        return yearVal;
    };

    const buckets = new Map();
    worldEvents.forEach(evt => {
        const k = bucketKeyFor(evt);
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k).push({ ...evt, _owner: 'world', _ownerLabel: '世界' });
    });
    const sortedBuckets = Array.from(buckets.entries());

    // ★ v0.14 三个维度：时间轴（event）/ 时间锚点（event + injection range，原"拼接"）/ 时间表（routine）
    // 默认进入「时间轴」。
    const CHRONICLE_VIEWS = [
        { id: 'timeline', label: '时间轴' },
        { id: 'anchor',   label: '时间锚点' },
        { id: 'schedule', label: '时间表' },
    ];
    const activeView = CHRONICLE_VIEWS.find(v => v.id === route.chronicleView)
        || CHRONICLE_VIEWS[0];

    // 时间轴 tab + 「+ 时间轴」按钮 + 我的事 提示（+ 时间轴仅在时间轴视图出现）
    const addButtons = `
        <div class="wv-chronicle__tabs">
            ${CHRONICLE_VIEWS.map(v => `
                <button class="wv-chronicle__tab ${v.id === activeView.id ? 'is-active' : ''}"
                    ${wvAction('worldSetChronicleView', { view: v.id })}>
                    ${e(v.label)}
                </button>
            `).join('')}
        </div>
        ${activeView.id === 'timeline' ? `
        <div class="wv-chronicle__actions">
            <button class="wv-btn wv-btn--primary" ${wvAction('worldShowTimelineAdd', { type: 'world' })}>+ 时间轴</button>
            <span class="wv-chronicle__hint">我的事、AI 的事会在「个人页 / AI 个人页」绑定该世界观后自动出现。长按卡片可拖动改顺序。</span>
        </div>
        ` : ''}
    `;

    const addForm = editingOwner && activeView.id === 'timeline'
        ? renderTimelineAddForm(getTimelineTypeFromOwner(editingOwner), getTimelineOwnerFromOwner(editingOwner))
        : '';

    // === 时间轴视图：左竖线 + 事件点 + 右侧详情卡片，按 manualOrder 优先、按 3 段日期 ===
    //     排序规则：
    //       ① 都有 manualOrder：按 manualOrder 升序（数字小的排前）
    //       ② 只一方有 manualOrder：有 manualOrder 排前
    //       ③ 都没有 manualOrder：按 date 字段（"year/month/day" 3 段）逐段数值比较。
    //          空白段（val 为 ''）数值化为 -Infinity，使得「用户没填的段」小于任何已填值，
    //          但非空时仍按实际数字排序，避免空白事件被一律丢到末尾。
    const segmentValue = (dateStr, idx) => {
        if (!dateStr || !dateStr.includes('/')) return Number.NEGATIVE_INFINITY;
        const parts = String(dateStr).split('/');
        // v0.17：统一为 3 段 "year/month/day"
        if (parts.length !== 3) return Number.NEGATIVE_INFINITY;
        const v = parts[idx];
        if (v === undefined || v === '' || v === null) return Number.NEGATIVE_INFINITY;
        const n = Number(v);
        return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
    };
    const compareChronoDate = (a, b) => {
        // 索引顺序：年、月、日（v0.17 后只剩这 3 段）
        for (const idx of [0, 1, 2]) {
            const va = segmentValue(a.date, idx);
            const vb = segmentValue(b.date, idx);
            if (va !== vb) return va - vb;
        }
        return 0;
    };

    const timelineView = sortedBuckets.length === 0
        ? emptyHint('', '时间轴还是一片空白。先建一个「时间轴」事件。')
        : (() => {
            // 拍平所有事件：① manualOrder 优先；② 否则按多段日期顺序
            const flat = sortedBuckets
                .flatMap(([, evts]) => evts)
                .slice()
                .sort((a, b) => {
                    const ma = (typeof a.manualOrder === 'number' && Number.isFinite(a.manualOrder)) ? a.manualOrder : null;
                    const mb = (typeof b.manualOrder === 'number' && Number.isFinite(b.manualOrder)) ? b.manualOrder : null;
                    if (ma !== null && mb !== null) {
                        if (ma !== mb) return ma - mb;
                        // manualOrder 相同则继续按日期
                    } else if (ma !== null) {
                        return -1;
                    } else if (mb !== null) {
                        return 1;
                    }
                    return compareChronoDate(a, b);
                });
            if (flat.length === 0) {
                return emptyHint('', '时间轴还是一片空白。先建一个「时间轴」事件。');
            }
            return `
                <div class="wv-timeline" data-wv-timeline>
                    <div class="wv-timeline__rail"></div>
                    ${flat.map((evt, idx) => `
                        <div class="wv-timeline__node ${editingEventId === evt.id ? 'is-editing' : ''}"
                             draggable="false"
                             data-wv-tl-node
                             data-wv-tl-id="${e(evt.id)}"
                             data-wv-tl-index="${idx}">
                            <div class="wv-timeline__dot"></div>
                            <div class="wv-timeline__card"
                                 data-wv-tl-card
                                 data-wv-tl-id="${e(evt.id)}"
                                 data-wv-tl-handle>
                                ${editingEventId === evt.id
                                    ? renderChronicleEventEditForm(evt)
                                    : renderChronicleEventRow(evt)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        })();

    // === 时间表视图：周度时间表（按「小周期」循环，目前只读，由个人页/AI 个人页联动注入数据） ===
    const scheduleView = renderChronicleScheduleView(world, sdk, route, chronoSummary, e);

    // === 拼接视图：列出所有事件，可设置「提醒拼接范围」，按映射来回转 ===
    const injectView = renderChronicleInjectView(world, sdk, route, e);

    let viewBody = '';
    if (activeView.id === 'timeline') viewBody = timelineView;
    else if (activeView.id === 'schedule') viewBody = scheduleView;
    else viewBody = injectView;

    return `
        <div class="wv-chronicle">
            <div class="wv-callout wv-callout--info">
                <div class="wv-callout__title">时间线</div>
                <div class="wv-callout__desc">
                    叙事骨架 —— 记录世界的关键时间点。阶段是剧情节点，时间是节点所在的时序背景；
                    二者独立，到阶段设置中再挂到时间位置。三个维度：
                    <b>时间轴</b>=一次性事件、<b>时间锚点</b>=注入 AI 上下文的范围、<b>时间表</b>=周期性循环。
                </div>
            </div>
            ${chronoPanel}
            ${addButtons}
            ${addForm}
            ${viewBody}
        </div>
    `;
};

// ============================================
// ★ v0.18 时间表视图（schedule / 周度循环）
// ============================================
// v0.18：「时间表」展示「周」级别的循环视图，直接显示周一到周日共7天。
// 使用 weekDayNames 配置显示周几的名称（如"周一"、"周二"等）。
// 数据由「个人页 / AI 个人页」绑定该世界观后注入（课表、训练表等）。
// ============================================
// v0.19：只读接入 sdk.schedule.listWeekForWorld(worldId, dates)。
//   - 翻页：route.scheduleWeekIndex（0=本周，+1=下周，-1=上周 …）
//   - 不允许编辑；编辑入口在「人设主页 → 本周日程」。
// ============================================
const renderChronicleScheduleView = (world, sdk, route, chronoSummary, e) => {
    // 周期配置：读 world.chronologySettings
    const cfg = world.chronologySettings || {};

    // 周名称数组（默认中文 7 天：周一到周日）
    const defaultWeekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const weekDayNames = Array.isArray(cfg.weekDayNames) && cfg.weekDayNames.length >= 7
        ? cfg.weekDayNames.slice(0, 7)
        : defaultWeekDays;

    // 翻页：route.scheduleWeekIndex 0=本周，+1=下周，-1=上周
    const weekIndex = Number(route.scheduleWeekIndex ?? 0) || 0;
    const today = new Date();
    // 把 today 调整到「本周一」
    const dayOfWeek = (today.getDay() + 6) % 7; // 把 Sun=0 转成 Mon=0
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek + weekIndex * 7);
    monday.setHours(0, 0, 0, 0);

    // 一周 7 天的 YYYY-MM-DD 数组
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const pad = (n) => String(n).padStart(2, '0');
        dates.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    }
    const monthLabel = `${monday.getMonth() + 1} 月`;

    // 拉取本周 7 天各人设合并的日程
    const weekMap = sdk?.schedule?.listWeekForWorld
        ? sdk.schedule.listWeekForWorld(sdk, world.id, dates)
        : new Map();

    const kindLabels = { routine: '例行', custom: '自定义', event: '事件' };
    // 兼容：若旧数据带 kind 字段，仍展示；新数据已不再写入 kind
    const renderKind = (k) => k && kindLabels[k]
        ? `<span class="wv-schedule__item-kind wv-schedule__item-kind--${e(k)}">${e(kindLabels[k])}</span>`
        : '';

    // 把「按角色分组」扁平化成「单条 event 数组」,按 startTime 升序、全天置顶,同时间按 createdAt 兜底
    const toMinutes = (t) => {
        if (!t) return -1; // 全天排最前
        const [h, m] = String(t).split(':').map((n) => parseInt(n, 10) || 0);
        return h * 60 + m;
    };
    const flatEvents = (dayItems) => {
        const list = [];
        for (const { personaName, entityType, entityId, events } of dayItems) {
            for (const ev of (events || [])) {
                list.push({ ev, personaName, entityType, entityId });
            }
        }
        list.sort((a, b) => {
            const ta = toMinutes(a.ev.startTime);
            const tb = toMinutes(b.ev.startTime);
            if (ta !== tb) return ta - tb;
            return (a.ev.createdAt || 0) - (b.ev.createdAt || 0);
        });
        return list;
    };

    const dayCells = dates.map((date, i) => {
        const dayName = weekDayNames[i] || '';
        const items = weekMap.get(date) || [];
        const flat = flatEvents(items);
        const body = flat.length === 0
            ? `<div class="wv-schedule__slot-empty">暂无</div>`
            : flat.map(({ ev, personaName }) => {
                const timeLabel = ev.startTime
                    ? (ev.endTime ? `${ev.startTime}–${ev.endTime}` : ev.startTime)
                    : '全天';
                return `
                    <div class="wv-schedule__item" title="${e(ev.title)}${ev.note ? ' · ' + e(ev.note) : ''}">
                        <div class="wv-schedule__item-meta">
                            <span class="wv-schedule__item-time">${e(timeLabel)}</span>
                            ${renderKind(ev.kind)}
                        </div>
                        <div class="wv-schedule__item-title">${e(ev.title)}</div>
                        <div class="wv-schedule__item-from">${e(personaName)}</div>
                    </div>
                `;
            }).join('');
        return `
            <div class="wv-schedule__day">
                <div class="wv-schedule__day-header">
                    <span class="wv-schedule__day-name">${e(dayName)}</span>
                    <span class="wv-schedule__day-date">${e(date.slice(5))}</span>
                </div>
                <div class="wv-schedule__day-content">${body}</div>
            </div>
        `;
    }).join('');

    // 翻页按钮
    const canPrev = weekIndex > -4; // 任意下界，避免无止境翻
    const canNext = weekIndex < 4;
    const prev = canPrev
        ? `<button class="wv-btn wv-btn--ghost wv-btn--small" data-app-action='${e(JSON.stringify({ action: 'appMethod', appId: SETTINGS_APP_ID, method: 'worldSetScheduleWeek', payload: { delta: -1 } }))}' aria-label="上一周">‹</button>`
        : `<button class="wv-btn wv-btn--ghost wv-btn--small" disabled aria-label="上一周">‹</button>`;
    const next = canNext
        ? `<button class="wv-btn wv-btn--ghost wv-btn--small" data-app-action='${e(JSON.stringify({ action: 'appMethod', appId: SETTINGS_APP_ID, method: 'worldSetScheduleWeek', payload: { delta: 1 } }))}' aria-label="下一周">›</button>`
        : `<button class="wv-btn wv-btn--ghost wv-btn--small" disabled aria-label="下一周">›</button>`;

    return `
        <div class="wv-schedule">
            <div class="wv-callout wv-callout--info">
                <div class="wv-callout__title">时间表（按周循环）</div>
                <div class="wv-callout__desc">
                    周度时间表 —— 显示周一到周日共7天循环。
                    数据从绑定此世界观的「用户 / AI 人设」聚合而来（只读 · 编辑入口在「人设主页 → 本周日程」）。
                </div>
            </div>
            <div class="wv-schedule__pager">
                ${prev}
                <div class="wv-schedule__pager-info">
                    <span class="wv-schedule__pager-current">${monthLabel}</span>
                    <span class="wv-schedule__pager-sep">·</span>
                    <span class="wv-schedule__pager-label">第 ${weekIndex >= 0 ? weekIndex + 1 : weekIndex} 周（${weekIndex === 0 ? '本周' : (weekIndex > 0 ? '未来' : '过去')}）</span>
                </div>
                ${next}
            </div>
            <div class="wv-schedule__board">
                <div class="wv-schedule__week-grid">${dayCells}</div>
            </div>
            <div class="wv-schedule__hint">
                只读视图 · 如需新增 / 修改日程，请前往「人设主页 → 本周日程」选择具体日期编辑。
            </div>
        </div>
    `;
};

// ============================================
// ★ v0.17 流动数据（Prompt 数据结构）
// ============================================
// 流动数据是「可以被别的软件读取的 prompt 数据结构」，
// 用于在别的 App 里调用 prompt 时显示名字和内容。
// UI 采用票根风格：横向排列，右侧有缺口。
// ============================================

const renderFlow = (app) => {
    const sdk = window.settingsSdk;
    if (!sdk) return '<div class="wv-empty">SDK 未初始化</div>';
    const world = getCurrentWorld(app, sdk);
    if (!world) return '<div class="wv-empty">请先选择一个世界观</div>';

    const route = app?.state?.world || {};
    // 直接从 world.flows 读取，与 methods.js 保持一致
    const flows = world.flows || [];
    const editingFlowId = route.editingFlowId || null;
    // 票根风格卡片
    const renderFlowTicket = (flow) => {
        const isEditing = flow.id === editingFlowId;
        const truncatedContent = flow.content && flow.content.length > 60
            ? e(flow.content.substring(0, 60)) + '…'
            : e(flow.content || '');
        const createdDate = formatDate(flow.createdAt || Date.now());

        if (isEditing) {
            return `
                <div class="wv-editor wv-ticket-editor">
                    <div class="wv-editor__row">
                        <label class="wv-editor__label">名称 *</label>
                        <input class="wv-editor__input" type="text" data-flow-field="title"
                            placeholder="如：电竞" value="${e(flow.title || '')}">
                    </div>
                    <div class="wv-editor__row">
                        <label class="wv-editor__label">Prompt 内容 *</label>
                        <textarea class="wv-editor__textarea" data-flow-field="content" rows="5"
                            placeholder="这个世界以电竞为尊，所有竞争都通过游戏解决...">${e(flow.content || '')}</textarea>
                    </div>
                    <div class="wv-editor__actions">
                        <button class="wv-btn wv-btn--primary" ${wvAction('worldSaveFlow', { flowId: flow.id })}>保存</button>
                        <button class="wv-btn wv-btn--ghost" ${wvAction('worldCancelFlowEdit')}>取消</button>
                    </div>
                </div>
            `;
        }

        return `
            <div class="wv-ticket" ${wvAction('worldEditFlow', { flowId: flow.id })}>
                <div class="wv-ticket__body">
                    <div class="wv-ticket__header">
                        <span class="wv-ticket__date">${createdDate}</span>
                    </div>
                    <div class="wv-ticket__title">${e(flow.title || '未命名')}</div>
                    <div class="wv-ticket__content">${truncatedContent}</div>
                </div>
                <div class="wv-ticket__footer">
                    <button class="wv-btn wv-btn--ghost wv-btn--sm" ${wvAction('worldEditFlow', { flowId: flow.id })}>编辑</button>
                    <button class="wv-btn wv-btn--danger wv-btn--sm" ${wvAction('worldDeleteFlow', { flowId: flow.id })}>删除</button>
                </div>
            </div>
        `;
    };

    // 新建表单
    const renderNewForm = () => `
        <div class="wv-editor wv-ticket-editor">
            <div class="wv-editor__row">
                <label class="wv-editor__label">名称 *</label>
                <input class="wv-editor__input" type="text" data-flow-field="title"
                    placeholder="如：电竞">
            </div>
            <div class="wv-editor__row">
                <label class="wv-editor__label">Prompt 内容 *</label>
                <textarea class="wv-editor__textarea" data-flow-field="content" rows="5"
                    placeholder="这个世界以电竞为尊..."></textarea>
            </div>
            <div class="wv-editor__actions">
                <button class="wv-btn wv-btn--primary" ${wvAction('worldSaveFlow', { flowId: '__new__' })}>保存</button>
                <button class="wv-btn wv-btn--ghost" ${wvAction('worldCancelFlowEdit')}>取消</button>
            </div>
        </div>
    `;

    return `
        <div class="wv-flows">
            <div class="wv-flows__header">
                <div class="wv-flows__title-block">
                    <div class="wv-flows__title">夹子列表</div>
                    <div class="wv-flows__desc">当前世界观：${e(world.name)} · ${flows.length} 个流动体</div>
                </div>
                <button class="wv-btn wv-btn--primary" ${wvAction('worldCreateFlow')}>+ 新建</button>
            </div>

            ${flows.length === 0 ? `
                ${emptyHint('≋', '还没有流动体。点击右上角新建一个 prompt 数据。')}
            ` : `
                <div class="wv-ticket-strip">
                    ${flows.map(renderFlowTicket).join('')}
                </div>
            `}

            ${editingFlowId === '__new__' ? renderNewForm() : ''}
        </div>
    `;
};

// ============================================
// ★ v0.17 时间锚点视图（段锚点 + 点锚点）
// ============================================
// 锚点 = 一段或一个具体日期，用来：
//   - 段锚点（按中周期）：例「11月-2月 春季赛」「5-7月 夏季赛」
//   - 点锚点（按日级）：例「2021.2.5 往后所有 2.5 是 xx 的纪念日」
// 数据来源：world.anchors（每个世界独立）。
// ============================================
const renderChronicleAnchorView = (world, sdk, route, e) => {
    const route2 = window.__wvRoute || route;
    const editingId = route2?.editingAnchorId || null;
    const creatingType = route2?.creatingAnchorType || null; // 'range' | 'point' | null
    const anchors = sdk.anchors?.getAnchors?.(world.id) || [];
    const rangeAnchors = anchors.filter(a => a.type === ANCHOR_TYPES.RANGE);
    const pointAnchors = anchors.filter(a => a.type === ANCHOR_TYPES.POINT);
    const aiList = sdk.aiPersons.list();

    const renderAnchorCard = (a) => {
        const isEditing = a.id === editingId;
        const chrono = world.chronologySettings || {};
        const yearLabel = chrono.yearLabel || '年';
        const monthLabel = chrono.monthLabel || '月';
        const dayLabel = chrono.dayLabel || '日';

        if (isEditing) {
            return `
                ${renderEditForm(
                    ANCHOR_FORM_SCHEMA,
                    {
                        ...a,
                        startYear: a.start?.year ?? 0,
                        startMonth: a.start?.month ?? 0,
                        startDay: a.start?.day ?? 0,
                    },
                    {
                        e,
                        checkedAttr,
                        saveAction: wvAction('worldSaveAnchor', { anchorId: a.id }),
                        cancelAction: wvAction('worldEditAnchorCancel'),
                    }
                )}
            `;
        }

        const fmtRange = () => {
            const s = a.start || { year: 0, month: 0, day: 0 };
            const e2 = a.end || { year: 0, month: 0, day: 0 };
            return `${s.year || '·'}${yearLabel} ${s.month || '·'}${monthLabel} ~ ${e2.year || '·'}${yearLabel} ${e2.month || '·'}${monthLabel}`;
        };
        const fmtPoint = () => {
            const s = a.start || { year: 0, month: 0, day: 0 };
            return `${s.year || '·'}${yearLabel} ${s.month || '·'}${monthLabel} ${s.day || '·'}${dayLabel}`;
        };
        const boundNames = (a.boundAiIds || []).map(id => {
            const ai = aiList.find(x => x.id === id);
            return ai ? ai.name : id;
        });

        return `
            <div class="wv-list__item">
                <div class="wv-list__item-head">
                    <span class="wv-tag ${a.type === 'range' ? 'wv-tag--primary' : 'wv-tag--ok'}">${a.type === 'range' ? '段' : '点'}</span>
                    <div class="wv-list__item-name">${e(a.label)}</div>
                    <div class="wv-list__item-actions">
                        <button class="wv-btn wv-btn--ghost wv-btn--sm" ${wvAction('worldEditAnchor', { anchorId: a.id })}>编辑</button>
                        <button class="wv-btn wv-btn--danger wv-btn--sm" ${wvAction('worldDeleteAnchor', { anchorId: a.id })}>删除</button>
                    </div>
                </div>
                <div class="wv-list__item-summary">${e(a.description || '—')}</div>
                <div class="wv-list__item-fields">
                    <span class="wv-list__item-field"><span class="wv-list__item-field-key">范围</span> ${e(a.type === 'range' ? fmtRange() : fmtPoint())}</span>
                    ${boundNames.length ? `<span class="wv-list__item-field"><span class="wv-list__item-field-key">绑定 AI</span> ${e(boundNames.join(', '))}</span>` : ''}
                </div>
            </div>
        `;
    };

    const renderAddForm = () => {
        if (!creatingType) return '';
        const chrono = world.chronologySettings || {};
        const yearLabel = chrono.yearLabel || '年';
        const monthLabel = chrono.monthLabel || '月';
        const dayLabel = chrono.dayLabel || '日';
        return `
            <div class="wv-editor wv-anchor-add-form wv-anchor-editor">
                    <div class="wv-editor__row">
                        <label class="wv-editor__label">标签 *</label>
                        <input class="wv-editor__input" type="text" data-anchor-field="label"
                            placeholder="${creatingType === 'range' ? '如：春季赛 / 夏季赛' : '如：xxx 的纪念日'}">
                    </div>
                    <div class="wv-editor__row wv-editor__row--no-label">
                        <textarea class="wv-editor__textarea" data-anchor-field="description" rows="2"
                            placeholder="${creatingType === 'range' ? '5-7月 夏季赛 …' : '往后每年这天都作为某纪念日'}"></textarea>
                    </div>
                    <div class="wv-editor__row wv-editor__row--inline">
                        <label class="wv-editor__label">${creatingType === 'range' ? '起' : '日期'}</label>
                        <input class="wv-editor__input wv-editor__input--num" type="number" data-anchor-field="startYear" placeholder="${yearLabel}" value="0">
                        <span class="wv-editor__sep">${yearLabel}</span>
                        <input class="wv-editor__input wv-editor__input--num" type="number" data-anchor-field="startMonth" placeholder="${monthLabel}" value="${creatingType === 'range' ? 1 : 1}">
                        <span class="wv-editor__sep">${monthLabel}</span>
                        ${creatingType === 'point' ? `<input class="wv-editor__input wv-editor__input--num" type="number" data-anchor-field="startDay" placeholder="${dayLabel}" value="1"><span class="wv-editor__sep">${dayLabel}</span>` : ''}
                    </div>
                    ${creatingType === 'range' ? `
                    <div class="wv-editor__row wv-editor__row--inline">
                        <label class="wv-editor__label">止</label>
                        <input class="wv-editor__input wv-editor__input--num" type="number" data-anchor-field="endYear" placeholder="${yearLabel}" value="0">
                        <span class="wv-editor__sep">${yearLabel}</span>
                        <input class="wv-editor__input wv-editor__input--num" type="number" data-anchor-field="endMonth" placeholder="${monthLabel}" value="2">
                        <span class="wv-editor__sep">${monthLabel}</span>
                    </div>
                    ` : ''}
                    <div class="wv-editor__row">
                        <label class="wv-editor__label">绑定 AI（可多选）</label>
                        <select class="wv-editor__select wv-anchor-add-ais" data-anchor-field="boundAiIds" multiple size="${Math.min(aiList.length || 1, 4)}">
                            ${aiList.length === 0 ? '<option value="" disabled>(尚无 AI)</option>' : aiList.map(ai => `<option value="${e(ai.id)}">${e(ai.name)}</option>`).join('')}
                        </select>
                        <span class="wv-editor__hint">按住 Ctrl/⌘ 多选；后续可绑定提醒（待开发）</span>
                    </div>
                    <div class="wv-editor__actions">
                        <button class="wv-btn wv-btn--primary" ${wvAction('worldCreateAnchor', { type: creatingType })}>保存</button>
                        <button class="wv-btn wv-btn--ghost" ${wvAction('worldCancelAnchorCreate')}>取消</button>
                    </div>
            </div>
        `;
    };

    return `
        <div class="wv-anchors">
            <div class="wv-callout wv-callout--info">
                <div class="wv-callout__title">时间锚点</div>
                <div class="wv-callout__desc">
                    时间锚点用来给 AI 圈定"应当注意的时间范围"，可以绑定到 AI，后续给 AI 注入上下文。
                    段锚点按中周期（月）定义一段范围，点锚点按基周期（日）定义一个具体日期。
                    <br/>绑定 AI / 提醒功能 <b>待开发</b>，先做好数据骨架。
                </div>
            </div>

            <div class="wv-list__head wv-anchor__head wv-anchor__head--inline">
                <div class="wv-anchor__head-group">
                    <div class="wv-list__title">段锚点（按月）</div>
                    <button class="wv-btn wv-btn--primary" ${wvAction('worldStartAnchorCreate', { type: 'range' })}>+ 新建段锚点</button>
                </div>
            </div>
            ${rangeAnchors.length === 0 ? emptyHint('↔', '还没有段锚点。') : rangeAnchors.map(renderAnchorCard).join('')}
            ${creatingType === 'range' ? renderAddForm() : ''}

            <div class="wv-list__head wv-anchor__head wv-anchor__head--inline">
                <div class="wv-anchor__head-group">
                    <div class="wv-list__title">点锚点（按日）</div>
                    <button class="wv-btn wv-btn--primary" ${wvAction('worldStartAnchorCreate', { type: 'point' })}>+ 新建点锚点</button>
                </div>
            </div>
            ${pointAnchors.length === 0 ? emptyHint('⊙', '还没有点锚点。') : pointAnchors.map(renderAnchorCard).join('')}
            ${creatingType === 'point' ? renderAddForm() : ''}
        </div>
    `;
};

// 兼容旧引用名（views.js 里可能用到）
const renderChronicleInjectView = renderChronicleAnchorView;

// 把 evt.date（v0.17：3 段 "year/month/day"）尽量还原成 Date
const resolveWorldTimeToReal = (evt, world, sdk) => {
    if (!evt || !evt.date) return null;
    const cfg = (sdk.chronology?.getChronologyConfig?.(world.id)) || world.chronologySettings || {};
    if (!cfg.enabled) {
        // 未启用纪时：直接用 3 段组装 ISO
        const parts = String(evt.date).split('/');
        if (parts.length !== 3) return null;
        const year = parts[0], month = parts[1], day = parts[2];
        if (!year || !month || !day) return null;
        return new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00`);
    }
    // 启用纪时：用 sdk.worldToReal 把世界时间转回现实 Date
    const parts = String(evt.date).split('/');
    if (parts.length !== 3) return null;
    const year = parts[0], month = parts[1], day = parts[2];
    try {
        return sdk.chronology.worldToReal({
            year: Number(year),
            month: Number(month),
            day: Number(day),
        }, world.id);
    } catch (_) { return null; }
};

const renderChronicleEventRow = (evt) => {
    const sdk = window.settingsSdk;
    const route = window.__wvRoute || null;
    const worldId = route?.currentWorldId;
    const activeWorld = worldId
        ? sdk?.worlds?.get?.(worldId)
        : (sdk?.worlds?.getActive?.() || null);
    const chrono = sdk?.chronology?.getChronologyConfig?.(activeWorld?.id) || activeWorld?.chronologySettings || {};
    // 大周期（如"洪武"）+ 大周期单位（如"年"）
    const largeCycleName = chrono.largeCycleName || '';
    const yearLabel = chrono.yearLabel || '年';
    // 中周期（如"新"）+ 中周期单位（如"月"）
    const mediumCycleName = chrono.mediumCycleName || '';
    const monthLabel = chrono.monthLabel || '月';
    // 小周期名称 + 小周期单位（v0.17 起即代表"日"）
    const smallCycleName = chrono.smallCycleName || '';
    const dayLabel = chrono.dayLabel || '日';

    // 格式化日期显示（v0.17）：「大周期名称 数值 大周期单位 中周期名称 数值 中周期单位 小周期名称 数值 小周期单位」
    // 例如：洪武 5 年 新 3 月
    const formatChronoDate = (dateStr) => {
        if (!dateStr || !dateStr.includes('/')) return '自定义';
        const parts = dateStr.split('/');
        // 统一格式（v0.17）：3 段 "year/month/day"
        //   - 1 段/2 段：认为是自定义
        //   - 3 段：year / month / day
        if (parts.length !== 3) return '自定义';
        const year = parts[0] || '', month = parts[1] || '', day = parts[2] || '';
        if (!year && !month && !day) return '自定义';

    // 拼装 3 段：大、中、小（"小" 在 v0.17 后代表"日"）
    // 没填的段（name + val + label 全空）直接省略，否则渲染「名 数值 单位」
    // val 为空字符串时显示 '·' 而不是 '_'（_ 留给「输入了无效值」的语义）
    const renderNumericPart = (name, val, label) => {
        const hasAny = name || val || label;
        if (!hasAny) return '';
        const displayVal = val === '' ? '·' : (val || '_');
        return `${name || '·'} ${displayVal} ${label || '·'}`;
    };
    return [
        renderNumericPart(largeCycleName, year, yearLabel),
        renderNumericPart(mediumCycleName, month, monthLabel),
        renderNumericPart(smallCycleName, day, dayLabel),
    ].filter(s => s).join(' ');
    };

    const ownerLabel = evt._ownerLabel || '';
    return `
        <div class="wv-chronicle__event-head">
            <span class="wv-chronicle__event-date">${e(formatChronoDate(evt.date || ''))}</span>
            ${ownerLabel ? `<span class="wv-chronicle__event-owner">${e(ownerLabel)}</span>` : ''}
            <span class="wv-chronicle__event-title">${e(evt.title)}</span>
        </div>
        ${evt.description ? `<div class="wv-chronicle__event-desc">${e(evt.description)}</div>` : ''}
        <div class="wv-chronicle__event-actions">
            <button class="wv-btn wv-btn--ghost wv-btn--sm" ${wvAction('worldEditTimelineEvent', { eventId: evt.id })}>编辑</button>
            <button class="wv-btn wv-btn--danger wv-btn--sm" ${wvAction('worldDeleteTimelineEvent', { eventId: evt.id })}>×</button>
        </div>
    `;
};

const renderChronicleEventEditForm = (evt) => {
    const sdk = window.settingsSdk;
    const route = window.__wvRoute || {};
    const worldId = route?.currentWorldId;
    const activeWorld = worldId
        ? sdk?.worlds?.get?.(worldId)
        : (sdk?.worlds?.getActive?.() || null);
    const chrono = sdk?.chronology?.getChronologyConfig?.(activeWorld?.id) || activeWorld?.chronologySettings || {};
    return renderEditForm(
        CHRONICLE_EVENT_FORM_SCHEMA,
        { ...evt, chronologySettings: chrono },
        {
            e,
            checkedAttr,
            saveAction: wvAction('worldSaveTimelineEvent', { eventId: evt.id }),
            cancelAction: wvAction('worldCancelChronicleEdit'),
        }
    );
};

const renderTimelineAddForm = (type, ownerKey) => {
    const sdk = window.settingsSdk;
    const route = window.__wvRoute || {};
    const worldId = route?.currentWorldId;
    const activeWorld = worldId
        ? sdk?.worlds?.get?.(worldId)
        : (sdk?.worlds?.getActive?.() || null);
    const chrono = sdk?.chronology?.getChronologyConfig?.(activeWorld?.id) || activeWorld?.chronologySettings || {};
    const model = { title: '', date: '', category: '', description: '', chronologySettings: chrono };
    return renderEditForm(
        TIMELINE_FORM_SCHEMA,
        model,
        {
            e,
            checkedAttr,
            saveAction: wvAction('worldAddTimelineEvent', { type, ownerKey }),
            cancelAction: wvAction('worldCancelTimelineAdd'),
        }
    );
};

const getTimelineTypeFromOwner = (owner) => owner?.startsWith('personal-') ? 'personal' : owner;
const getTimelineOwnerFromOwner = (owner) => {
    if (!owner) return null;
    if (owner === 'world') return 'world';
    return owner.replace(/^personal-/, '');
};

// ============================================
// ★ v0.18 资产系统（多货币）
// ============================================
// 资产系统支持多种货币 + 汇率比例。
// 数据存储在 world.currencies 数组中，每个元素：
//   { id, name, symbol, note, exchangeToBase, isBase, order }
// ============================================

const renderAssets = (app) => {
    const sdk = window.settingsSdk;
    if (!sdk) return '<div class="wv-empty">SDK 未初始化</div>';
    const route = app?.state?.world || {};
    const worldId = route.currentWorldId || sdk.worlds.getActive()?.id;
    const world = worldId ? sdk.worlds.get(worldId) : null;

    if (!world) {
        return `
            <div class="wv-assets">
                <div class="wv-callout wv-callout--info">
                    <div class="wv-callout__title">资产系统</div>
                    <div class="wv-callout__desc">请先选择一个世界观，再在此设定货币体系。</div>
                </div>
            </div>
        `;
    }

    const currencies = world.currencies || [];
    const baseCurrency = currencies.find(c => c.isBase) || currencies[0];
    const editingId = route.editingCurrencyId;
    const isCreating = editingId === '__new__';

    // 渲染单个货币卡片
    const renderCurrencyCard = (curr) => {
        const isEditing = curr.id === editingId;
        if (isEditing) {
            return renderCurrencyEditForm(curr, currencies);
        }
        const exchangeRate = curr.isBase ? '基准' : (curr.exchangeToBase != null ? `1 ${curr.name} = ${curr.exchangeToBase} ${baseCurrency?.name || '基准'}` : '—');
        return `
            <div class="wv-list__item wv-assets__currency-card">
                <div class="wv-list__item-head">
                    <span class="wv-assets__currency-symbol">${e(curr.symbol || curr.name?.charAt(0) || '')}</span>
                    <div class="wv-list__item-name">${e(curr.name)}</div>
                    ${curr.unit ? `<span class="wv-tag wv-tag--secondary">${e(curr.unit)}</span>` : ''}
                    ${curr.isBase ? '<span class="wv-tag wv-tag--primary">基准</span>' : ''}
                    <div class="wv-list__item-actions">
                        ${!curr.isBase ? `<button class="wv-btn wv-btn--ghost wv-btn--sm" ${wvAction('worldSetBaseCurrency', { id: curr.id })}>设基准</button>` : ''}
                        <button class="wv-btn wv-btn--ghost wv-btn--sm" ${wvAction('worldEditCurrency', { id: curr.id })}>编辑</button>
                        ${!curr.isBase ? `<button class="wv-btn wv-btn--danger wv-btn--sm" ${wvAction('worldDeleteCurrency', { id: curr.id })}>删除</button>` : ''}
                    </div>
                </div>
                ${curr.note ? `<div class="wv-list__item-summary">${e(curr.note)}</div>` : ''}
                <div class="wv-list__item-fields">
                    <span class="wv-list__item-field"><span class="wv-list__item-field-key">汇率</span> ${e(exchangeRate)}</span>
                </div>
            </div>
        `;
    };

    // 渲染编辑/新建表单
    const renderCurrencyEditForm = (curr, allCurrencies) => {
        const isNew = !curr.id;
        const baseOptions = allCurrencies.filter(c => c.isBase && (!curr.id || c.id !== curr.id));
        const selectedBaseId = curr.baseCurrencyId || baseOptions[0]?.id || '';

        return `
            <div class="wv-editor wv-assets__currency-form">
                <div class="wv-editor__row wv-editor__row--first">
                    <input class="wv-editor__input" type="text"
                        data-currency-field="name"
                        placeholder="货币名称 *"
                        value="${e(curr.name || '')}">
                </div>
                <div class="wv-editor__row wv-editor__row--inline">
                    <input class="wv-editor__input wv-editor__input--small" type="text"
                        data-currency-field="symbol"
                        placeholder="符号"
                        value="${e(curr.symbol || '')}" maxlength="3">
                    <input class="wv-editor__input wv-editor__input--small" type="text"
                        data-currency-field="unit"
                        placeholder="单位"
                        value="${e(curr.unit || '')}" maxlength="6">
                </div>
                <div class="wv-editor__row wv-editor__row--stacked">
                    <textarea class="wv-editor__textarea" rows="2"
                        data-currency-field="note"
                        placeholder="说明（如：1 金币 = 100 铜币）">${e(curr.note || '')}</textarea>
                </div>
                <div class="wv-editor__row wv-editor__row--exchange-row">
                    <div class="wv-editor__row-inline wv-editor__row-inline--exchange">
                        <input class="wv-editor__input wv-editor__input--num" type="number" step="0.01" min="0"
                            data-currency-field="exchangeToBase"
                            placeholder="1"
                            value="${curr.exchangeToBase != null ? e(String(curr.exchangeToBase)) : ''}">
                        <span class="wv-exchange__name" data-exchange-currency-name="${e(curr.name || '')}">${e(curr.name || '货币')}</span>
                        <span class="wv-exchange__equals">=</span>
                        <input class="wv-editor__input wv-editor__input--num" type="number" step="0.01" min="0"
                            data-currency-field="baseAmount"
                            placeholder="1"
                            value="${curr.baseAmount != null ? e(String(curr.baseAmount)) : '1'}">
                        <select class="wv-editor__select wv-editor__select--currency" data-currency-field="baseCurrencyId">
                            <option value="">选择基准货币</option>
                            ${baseOptions.map(b => `<option value="${e(b.id)}" ${b.id === selectedBaseId ? 'selected' : ''}>${e(b.name)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="wv-editor__actions">
                    <button class="wv-btn wv-btn--primary" ${wvAction('worldSaveCurrency', { id: curr.id || '__new__' })}>保存</button>
                    <button class="wv-btn wv-btn--ghost" ${wvAction('worldCancelCurrencyEdit')}>取消</button>
                </div>
            </div>
        `;
    };

    // 货币列表
    const currencyListHtml = currencies.length === 0
        ? emptyHint('', '还没有货币，点击上方添加第一个货币')
        : currencies.map(renderCurrencyCard).join('');

    // 新建表单（内联在列表顶部）
    const createFormHtml = isCreating
        ? renderCurrencyEditForm({ name: '', symbol: '', note: '' }, currencies)
        : '';

    return `
        <div class="wv-assets">
            <div class="wv-callout wv-callout--info">
                <div class="wv-callout__title">资产系统</div>
                <div class="wv-callout__desc">
                    设定这个世界的货币体系。基准货币是换算的基准，其他货币设置相对于基准的汇率。
                </div>
            </div>

            <div class="wv-assets__header">
                <div class="wv-assets__stats">
                    <span class="wv-assets__stat">
                        <span class="wv-assets__stat-num">${currencies.length}</span>
                        <span class="wv-assets__stat-label">种货币</span>
                    </span>
                    ${baseCurrency ? `
                        <span class="wv-assets__stat">
                            <span class="wv-assets__stat-label">基准货币：</span>
                            <span class="wv-assets__stat-num">${e(baseCurrency.name)}</span>
                        </span>
                    ` : ''}
                </div>
                <button class="wv-btn wv-btn--primary wv-btn--sm" ${wvAction('worldCreateCurrency')}>+ 添加货币</button>
            </div>

            <div class="wv-assets__list">
                ${currencyListHtml}
                ${createFormHtml}
            </div>
        </div>
        <script>
            (function() {
                var panel = document.querySelector('.wv-assets');
                if (!panel || panel.dataset.bound) return;
                panel.dataset.bound = '1';
                panel.addEventListener('input', function(e) {
                    var nameInput = e.target.closest('[data-currency-field="name"]');
                    if (!nameInput) return;
                    var name = nameInput.value || '货币';
                    var nameSpan = panel.querySelector('[data-exchange-currency-name]');
                    if (nameSpan) nameSpan.textContent = name;
                });
            })();
        </script>
    `;
};

// ============================================
// 预设（v0.17：只保留组，删除组内的预设世界观内容）
// ============================================

const renderPresets = () => {
    const groups = buildPresetGroupState();
    return `
        <div class="wv-presets">
            <div class="wv-list__head">
                <div class="wv-list__title-block">
                    <div class="wv-list__title">预设世界观组</div>
                    <div class="wv-list__desc">快速创建预设世界观，可一键导入（功能开发中）</div>
                </div>
            </div>
            ${groups.length === 0 ? emptyHint('', '暂无预设世界观组') : groups.map(group => `
                <div class="wv-preset-group">
                    <div class="wv-list__item">
                        <div class="wv-list__item-head">
                            <div class="wv-list__item-name">${e(group.icon)} ${e(group.name)}</div>
                            <span class="wv-tag">${group.presets?.length || 0} 个预设</span>
                        </div>
                        ${group.description ? `<div class="wv-list__item-summary">${e(group.description)}</div>` : ''}
                        <div class="wv-list__item-meta">预设功能开发中…</div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
};

// ============================================
// 导入导出
// ============================================

const renderExport = (app) => {
    const sdk = window.settingsSdk;
    if (!sdk) return '<div class="wv-empty">SDK 未初始化</div>';
    const worlds = sdk.worlds.list();
    return `
        <div class="wv-export">
            <div class="wv-callout wv-callout--info">
                <div class="wv-callout__title">导入 / 导出</div>
                <div class="wv-callout__desc">单个世界观可单独打包导出；人设包的从属部分会自动打包。</div>
            </div>

            <div class="wv-list__head">
                <div class="wv-list__title">导出</div>
            </div>
            ${worlds.length === 0 ? `<div class="wv-list__empty-text">还没有世界观</div>` :
                worlds.map(w => `
                    <div class="wv-list__item">
                        <div class="wv-list__item-head">
                            <div class="wv-list__item-name">${e(w.name)}</div>
                            <div class="wv-list__item-actions">
                                <button class="wv-btn wv-btn--primary wv-btn--sm" ${wvAction('worldExportPreview', { id: w.id })}>预览</button>
                                <button class="wv-btn wv-btn--ghost wv-btn--sm" ${wvAction('worldExportDownload', { id: w.id })}>下载 JSON</button>
                            </div>
                        </div>
                        <div class="wv-list__item-meta">v${e(w.version || '1.0.0')} · ${e(formatDate(w.updatedAt))}</div>
                    </div>
                `).join('')}

            <div class="wv-list__head">
                <div class="wv-list__title">导入</div>
            </div>
            <div class="wv-list__item">
                <div class="wv-list__item-head">
                    <div class="wv-list__item-name">从 JSON 文件导入</div>
                </div>
                <div class="wv-editor__row">
                    <label class="wv-editor__label">选择文件</label>
                    <input type="file" class="wv-editor__input" accept=".json" id="wv-import-file">
                </div>
                <div class="wv-editor__row">
                    <label class="wv-editor__label">冲突策略</label>
                    <select class="wv-editor__select" id="wv-import-strategy">
                        <option value="merge">合并（保留用户本地修改）</option>
                        <option value="overwrite">覆盖</option>
                        <option value="skip">跳过</option>
                        <option value="coexist">并存（新 id）</option>
                    </select>
                </div>
                <div class="wv-editor__actions">
                    <button class="wv-btn wv-btn--primary" ${wvAction('worldImportFile')}>导入</button>
                </div>
            </div>
        </div>
    `;
};

// ============================================
// sub 路由表
// ============================================
// 库级 (scope=library)：overview + worlds；worlds 根据是否已选库显示库列表或库内世界观
// 世界级 (scope=world)：进入某个世界后才出现
//   - 'overview' 表示「该世界的概览」（与库级 preview 不同）

const renderLibraryWorlds = (app) => {
    const route = app?.state?.world || {};
    const hasSelectedGroup = Object.prototype.hasOwnProperty.call(route, 'currentGroupId');
    return hasSelectedGroup ? renderWorldsList(app) : renderGroupsList(app);
};

const LIBRARY_ROUTES = {
    overview: renderLibraryOverview,
    worlds:   renderLibraryWorlds,
};

// v0.17：「场所」已移到「空间」tab；「标签」「快照」功能删除；保留「预设」和「导入导出」
const WORLD_ROUTES = {
    overview:  renderWorldOverview,
    map:       renderMap,
    anchors:   renderChronicle,    // ★ v0.17 时间线 + 时间锚点
    timelines: renderChronicle,    // 向后兼容
    flow:      renderFlow,         // ★ v0.17 流动数据（prompt 数据结构）
    presets:   renderPresets,
    export:    renderExport,
};

// 「设置面板」是 body 末尾一个折叠容器，里面折叠 6 个旧 tab 的入口：
// 进入时会用 route.sub === <section-id> + route.settingsPanelOpen 控制「展开/收起」。
// v0.17：阶段已挪到人设；社媒 / App绑定 / 上下文注入 已彻底移除，不在此面板里出现。
const SETTINGS_PANEL_ROUTE_SUBS = new Set(SETTINGS_PANEL_SECTIONS.map(s => s.id));

// ============================================
// ★ v0.17 「设置面板」折叠容器
// ============================================
// 顶部 tab 只剩 3 个：概览 / 空间 / 时间。
// 其它模块（地点 / 标签 / 草稿 / 快照 / 预设 / 导入导出）全部沉到 body 末尾这个折叠容器。
//
// 折叠状态由 route.settingsPanelOpen 控制；当前激活的 section 由
// route.activeSettingsSection 控制（默认 'presets'：第一项）。
// 点击 section 入口 → worldRoute({ sub: 'overview', openSettingsSection: <id> })
// 因为只有从「概览」tab 才能在面板里展开子视图。
// ============================================

/**
 * 在概览页底部平铺展示设置面板（资产/预设/导入导出）。
 * 入口和内容都是上下结构，不需要折叠按钮。
 */
const renderSettingsPanel = (app, activeSub, world) => {
    const sdk = window.settingsSdk;
    if (!sdk || !world) return '';

    const route = app?.state?.world || {};
    const activeSection = route.activeSettingsSection || 'assets';

    const sectionRenderers = {
        assets:   renderAssets,
        presets:  renderPresets,
        export:   renderExport,
    };
    const renderer = sectionRenderers[activeSection] || renderAssets;

    // 入口排（每一项只保留 label）- 横向排列
    const sections = SETTINGS_PANEL_SECTIONS.map(s => {
        const isActive = s.id === activeSection;
        return `
            <button class="wv-chronicle__tab ${isActive ? 'is-active' : ''}" ${wvRouteAction('overview', { openSettingsSection: s.id })}>
                ${e(s.label)}
            </button>
        `;
    }).join('');

    return `
        <div class="wv-settings-panel">
            <div class="wv-chronicle__tabs">${sections}</div>
            <div class="wv-settings-panel__content">${renderer(app)}</div>
        </div>
    `;
};

// ============================================
// 主入口
// ============================================

export function renderWorldLibrary(app) {
    const sdk = window.settingsSdk;
    if (!sdk) {
        return `
            <div class="wv">
                <div class="wv__body">
                    <div class="wv-empty">
                        <div class="wv-empty__title">正在初始化...</div>
                        <div class="wv-empty__desc">加载世界观数据中。</div>
                    </div>
                </div>
            </div>
        `;
    }

    const route = app?.state?.world || {};
    // ===== scope 分层：library（库）还是 world（已进某个世界）=====
    // 「世界级 scope」只在用户调用 worldEnter(payload.id) 进入编辑态时才出现，
    // 通过 route.currentWorldId 标识。该标识只作用于设置 App 内部的导航，
    // 不影响全局的「当前世界观」（那个由用户人设绑定决定）。
    const activeSub = route.sub || 'worlds';
    const currentWorldId = route.currentWorldId || null;
    const world = currentWorldId ? sdk.worlds.get(currentWorldId) : null;

    const scope = (currentWorldId && world) ? 'world' : 'library';

    let tabsHtml, bodyHtml;
    if (scope === 'world') {
        // 世界级 tab：左侧附返回按钮
        tabsHtml = renderWorldTabs(activeSub);
        const mainBody = WORLD_ROUTES[activeSub]
            ? WORLD_ROUTES[activeSub](app)
            : (WORLD_ROUTES.overview ? WORLD_ROUTES.overview(app) : '');
        // 设置面板只在「概览」页面底部出现（其它子页面保持纯净）
        const settingsPanel = (activeSub === 'overview') ? renderSettingsPanel(app, activeSub, world) : '';
        bodyHtml = `${mainBody}${settingsPanel}`;
    } else {
        // 库级：默认直接展示「库列表」（无 tabs / 无 overview 卡片 / 无 landing 大卡）。
        // 顶部不显示任何 sub 切换器；保留 worldRoute 兼容，但忽略其 sub 字段。
        // 有 currentGroupId 时（通过 worldOpenGroup 进入）展示「组内世界列表」。
        tabsHtml = '';
        bodyHtml = renderLibraryWorlds(app);
    }

    return `
        <div class="wv wv--scope-${scope}">
            ${tabsHtml}
            <div class="wv__body">
                ${bodyHtml}
            </div>
        </div>
    `;
}

// ============================================
// ★ v0.14 时间轴拖拽排序（长按 → 拖动 → 重排 → 持久化 manualOrder）
// ============================================
//  设计：
//   - 在桌面/移动端都是「长按 350ms 抬起后才进入拖拽态」，避免误操作
//   - 进入拖拽时给卡片一个 grabbing cursor、半透明；DOM 上挂一根红/紫线表示插入位置
//   - 释放时把目标位置之前的所有节点读出来，把被拖元素的 manualOrder 重排为目标索引；
//     调用 sdk.timelines.updateTimelineEvent 写回 manualOrder，其它所有事件也按
//     目标索引批量重写 manualOrder（保证后续顺序稳定，不会"差一格"）。
//   - Vue 重渲染后 attach 再次被调用，handle 元素会更新。
// ============================================

const TL_LONG_PRESS_MS = 350;
const TL_DRAG_ACTIVATED_CLASS = 'is-dragging';
const TL_PLACEHOLDER_CLASS = 'wv-timeline__placeholder';

let __wvTlDrag = null;

const tlFindEventById = (world, id) => {
    if (!world || !world.timelines) return null;
    const t = world.timelines;
    for (const e of (t.world || [])) if (e.id === id) return e;
    for (const owner of Object.keys(t.personal || {})) {
        for (const e of (t.personal[owner] || [])) if (e.id === id) return e;
    }
    return null;
};

const tlGetRenderedCardNodes = (timeline) => {
    if (!timeline) return [];
    return Array.from(timeline.querySelectorAll('[data-wv-tl-card]'));
};

const tlCollectOrderedIds = (timeline) => tlGetRenderedCardNodes(timeline).map(c => c.getAttribute('data-wv-tl-id'));

const tlResetDragStyles = () => {
    if (__wvTlDrag) {
        const { card, placeholder } = __wvTlDrag;
        card?.classList?.remove(TL_DRAG_ACTIVATED_CLASS);
        placeholder?.parentNode?.removeChild?.(placeholder);
        document.body.classList.remove('wv-timeline-dragging');
    }
    __wvTlDrag = null;
};

const __wvAttachTimelineDrag = () => {
    const timelines = document.querySelectorAll('[data-wv-timeline]');
    timelines.forEach(timeline => {
        if (timeline.__wvAttached) return;
        timeline.__wvAttached = true;

        let longPressTimer = null;
        let pressStartXY = null;
        let activePointerId = null;
        let activeCardEl = null;
        let activeNodeEl = null;
        let placeholderEl = null;
        let lastInsertBeforeEl = null;

        const clearLongPress = () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            pressStartXY = null;
        };

        const findInsertBeforeNode = (clientY) => {
            const nodes = Array.from(timeline.querySelectorAll('[data-wv-tl-node]'))
                .filter(n => n !== activeNodeEl);
            for (const n of nodes) {
                const rect = n.getBoundingClientRect();
                if (clientY < rect.top + rect.height / 2) return n;
            }
            return null;
        };

        const showInsertLineAt = (insertBeforeEl) => {
            // 移除上次的插入指示
            timeline.querySelectorAll(`.${TL_PLACEHOLDER_CLASS}`).forEach(n => n.remove());
            if (!insertBeforeEl) {
                // 插到末尾：在 rail 上方画线
                const last = timeline.querySelectorAll('[data-wv-tl-node]');
                const lastNode = last[last.length - 1];
                if (lastNode && lastNode !== activeNodeEl) {
                    const ph = document.createElement('div');
                    ph.className = TL_PLACEHOLDER_CLASS;
                    ph.style.height = '4px';
                    ph.style.background = 'rgba(99, 102, 241, 0.9)';
                    ph.style.borderRadius = '2px';
                    ph.style.margin = '4px 0';
                    lastNode.parentNode.insertBefore(ph, lastNode.nextSibling);
                    placeholderEl = ph;
                }
                return;
            }
            const ph = document.createElement('div');
            ph.className = TL_PLACEHOLDER_CLASS;
            ph.style.height = '4px';
            ph.style.background = 'rgba(99, 102, 241, 0.9)';
            ph.style.borderRadius = '2px';
            ph.style.margin = '4px 0';
            insertBeforeEl.parentNode.insertBefore(ph, insertBeforeEl);
            placeholderEl = ph;
        };

        timeline.addEventListener('pointerdown', (ev) => {
            const card = ev.target.closest?.('[data-wv-tl-card]');
            if (!card || !timeline.contains(card)) return;
            const node = card.closest('[data-wv-tl-node]');
            if (!node) return;
            // 编辑态不允许拖动，避免与表单冲突
            if (node.classList.contains('is-editing')) return;
            activeCardEl = card;
            activeNodeEl = node;
            activePointerId = ev.pointerId;
            pressStartXY = { x: ev.clientX, y: ev.clientY };
            longPressTimer = setTimeout(() => {
                // 进入拖拽态
                if (!activeCardEl) return;
                card.classList.add(TL_DRAG_ACTIVATED_CLASS);
                document.body.classList.add('wv-timeline-dragging');
                __wvTlDrag = { card, placeholder: null };
                timeline.setPointerCapture?.(activePointerId);
            }, TL_LONG_PRESS_MS);
        });

        timeline.addEventListener('pointermove', (ev) => {
            if (!activeCardEl) return;
            if (pressStartXY && longPressTimer) {
                const dx = Math.abs(ev.clientX - pressStartXY.x);
                const dy = Math.abs(ev.clientY - pressStartXY.y);
                // 长按阈值期间位移过大则取消（认为是滚动/误触）
                if (dx > 8 || dy > 8) {
                    clearLongPress();
                    return;
                }
            }
            if (!activeCardEl.classList.contains(TL_DRAG_ACTIVATED_CLASS)) return;
            const insertBeforeNode = findInsertBeforeNode(ev.clientY);
            if (insertBeforeNode !== lastInsertBeforeEl) {
                lastInsertBeforeEl = insertBeforeNode;
                showInsertLineAt(insertBeforeNode);
            }
        });

        const finalizeDrag = async () => {
            if (!activeCardEl) return;
            const wasDragging = activeCardEl.classList.contains(TL_DRAG_ACTIVATED_CLASS);
            const draggedId = activeCardEl.getAttribute('data-wv-tl-id');
            clearLongPress();
            if (!wasDragging) {
                activeCardEl = null;
                activeNodeEl = null;
                return;
            }
            // 收尾：拿当前 DOM 顺序，把 draggedId 放到 placeholder 所在位置
            const timelineChildren = Array.from(timeline.querySelectorAll('[data-wv-tl-node]'));
            const draggedNode = activeNodeEl;
            // 找出 placeholder 的位置
            const placeholder = timeline.querySelector(`.${TL_PLACEHOLDER_CLASS}`);
            // 重新拍一个「去掉 draggedNode、按 placeholder 位置插入」的新顺序
            const without = timelineChildren.filter(n => n !== draggedNode);
            let insertAt;
            if (placeholder) {
                const before = placeholder.previousElementSibling;
                insertAt = before ? without.indexOf(before) + 1 : 0;
            } else {
                insertAt = without.length;
            }
            const newOrder = without.slice();
            newOrder.splice(insertAt, 0, draggedNode);

            // 把新 DOM 顺序映射回 eventId 顺序
            const newIds = newOrder.map(n => n.getAttribute('data-wv-tl-id'));

            // 还原 DOM（因为后续 renderChronicle 会重新渲染，但手动顺序先得出来）
            tlResetDragStyles();

            // 写回 manualOrder：给所有事件一个 0..n-1 的 manualOrder
            try {
                const sdk = window.settingsSdk;
                const route = window.__wvRoute;
                const worldId = route?.currentWorldId || sdk?.worlds?.getActive?.()?.id;
                const world = sdk?.worlds?.get?.(worldId);
                if (sdk && world) {
                    newIds.forEach((id, idx) => {
                        const ev = tlFindEventById(world, id);
                        if (ev) ev.manualOrder = idx;
                    });
                    // 整一个 world 持久化一次（不用每条 updateTimelineEvent 走一遍）
                    if (sdk.worlds?.update) {
                        await sdk.worlds.update(world.id, { timelines: world.timelines });
                    }
                }
            } catch (err) {
                console.warn('[world/timeline-drag] persist manualOrder failed', err);
            }

            // 触发 Vue 重新渲染
            window.refreshPhoneApps?.();

            // 重新挂载时间轴拖拽事件：Vue 重渲染后 [data-wv-timeline] 是新 DOM 节点，
            // 原节点的事件监听器随着旧节点一起被丢弃，所以这里必须主动重新 attach。
            requestAnimationFrame(() => {
                try { window.__wvAttachTimelineDrag?.(); } catch (_) {}
            });

            activeCardEl = null;
            activeNodeEl = null;
            lastInsertBeforeEl = null;
            activePointerId = null;
        };

        timeline.addEventListener('pointerup', finalizeDrag);
        timeline.addEventListener('pointercancel', () => {
            clearLongPress();
            tlResetDragStyles();
            activeCardEl = null;
            activeNodeEl = null;
        });
    });
};

if (typeof window !== 'undefined') {
    window.__wvAttachTimelineDrag = __wvAttachTimelineDrag;
}
