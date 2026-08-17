/**
 * 设置 App · AI 人设模块 · 渲染层
 *
 * 渲染接口：
 *   - renderAiSection(app)   「AI」detail 页主体
 *
 * 库页内部分成 2 个 tab：
 *   - 列表（list）: AI 库 + 新建（含搜索过滤）
 *   - 编辑（edit）: 当前 AI 的完整字段编辑（基于人设 renderer）
 */

import { escapeHtml } from '@/src/core/escape.js';
import { renderPersonaEditor } from '../persona/renderer.js';
import { renderPersonaAvatarContent } from '../persona/avatar.js';

function wvAction(method, payload = {}) {
    const obj = { action: 'appMethod', appId: 'settings', method, payload };
    return `data-app-action='${escapeHtml(JSON.stringify(obj))}'`;
}

function wvRouteAction(sub) {
    return wvAction('aiRoute', { sub });
}

function formatDateTime(timestamp) {
    if (!timestamp) return '—';
    const d = new Date(timestamp);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function filterAiList(items, keyword) {
    if (!keyword) return items;
    const lower = String(keyword).toLowerCase().trim();
    if (!lower) return items;
    return items.filter(it => {
        const name = (it.name || '').toLowerCase();
        const role = (it.role || '').toLowerCase();
        const tone = (it.tone || '').toLowerCase();
        const id = (it.id || '').toLowerCase();
        return name.includes(lower) || role.includes(lower) || tone.includes(lower) || id.includes(lower);
    });
}

/* ============================================
 * 世界观概览卡片
 * ============================================
 * 显示「当前 AI 人设」所绑定的世界观（persona.boundWorldId）。
 *   - 找到 world → 显示名字
 *   - 没绑 / world 不存在 → 显示「未绑定」
 *   - 点击 → 跳到 世界观 概览页
 */
function renderWorldCard(activeAi) {
    const sdk = window.settingsSdk;
    if (!sdk) return '';
    const boundId = activeAi?.boundWorldId || '';
    const world = boundId ? sdk.worlds.get(boundId) : null;
    const hasBinding = !!world;
    const worldAction = hasBinding
        ? wvAction('worldEnter', { id: world.id, openDetail: true })
        : wvAction('worldOpenLibrary');
    return `
        <div class="persona-world-card ${hasBinding ? '' : 'persona-world-card--empty'}" ${worldAction}>
            <div class="persona-world-card__icon">○</div>
            <div class="persona-world-card__body">
                <div class="persona-world-card__label">当前世界观</div>
                <div class="persona-world-card__name">${escapeHtml(hasBinding ? (world.name || world.id) : '未绑定')}</div>
            </div>
            <span class="persona-world-card__arrow">›</span>
        </div>
    `;
}

const AI_TABS = [
    { id: 'list', label: 'AI 库' },
    { id: 'edit', label: '编辑' },
];

function renderTabs(activeSub) {
    return `
        <div class="persona-tabs">
            ${AI_TABS.map(tab => `
                <button class="persona-tab ${activeSub === tab.id ? 'is-active' : ''}" ${wvRouteAction(tab.id)}>
                    ${escapeHtml(tab.label)}
                </button>
            `).join('')}
        </div>
    `;
}

/* ============================================
 * 顶部概览
 * ============================================ */

function renderOverview(activeAi) {
    if (!activeAi) {
        return `
            <div class="persona-overview">
                <div class="persona-overview__avatar">?</div>
                <div class="persona-overview__body">
                    <div class="persona-overview__name">还没有 AI 人设</div>
                    <div class="persona-overview__meta">在 AI 库里新建一个 AI 开始设置</div>
                </div>
            </div>
        `;
    }
    const sdk = window.settingsSdk;
    const boundWorld = (activeAi.boundWorldId && sdk) ? sdk.worlds.get(activeAi.boundWorldId) : null;
    const meta = [
        activeAi.role && `角色 · ${activeAi.role}`,
        boundWorld && `世界观 · ${boundWorld.name || boundWorld.id}`,
        !boundWorld && activeAi.boundWorldId === '' && '未绑定世界观',
        `更新于 ${formatDateTime(activeAi.updatedAt)}`,
    ].filter(Boolean).join(' · ');
    const homeAction = wvAction('personaHomeOpen', { entityType: 'ai', entityId: activeAi.id });

    return `
        <div class="persona-overview persona-overview--clickable" ${homeAction}>
            <div class="persona-overview__avatar">${renderPersonaAvatarContent(activeAi)}</div>
            <div class="persona-overview__body">
                <div class="persona-overview__name">${escapeHtml(activeAi.name || activeAi.id)}</div>
                ${meta ? `<div class="persona-overview__meta">${escapeHtml(meta)}</div>` : ''}
            </div>
            <span class="persona-overview__badge">当前 AI · 主页</span>
            <span class="persona-overview__chevron" aria-hidden="true">›</span>
        </div>
    `;
}

/* ============================================
 * AI 列表（含搜索）
 * ============================================ */

function renderAiList(app, allItems, filteredItems, activeId, searchKeyword) {
    return `
        <div class="persona-list-head">
            <div class="persona-list-head__title">
                AI 人设库<span class="persona-list-head__count">${allItems.length}${searchKeyword ? ` · 筛选 ${filteredItems.length}` : ''}</span>
            </div>
            <button class="persona-btn" ${wvAction('aiCreate', {})}>
                <span style="font-size: 14px; line-height: 1;">+</span> 新建
            </button>
        </div>

        ${allItems.length > 0 ? `
            <div class="persona-search">
                <span class="persona-search__icon">⌕</span>
                <input class="persona-search__input" type="search" placeholder="按名称 / 角色 / 语气 搜索"
                    value="${escapeHtml(searchKeyword || '')}"
                    data-ai-search-input
                    autocomplete="off">
                ${searchKeyword ? `<button class="persona-search__clear" ${wvAction('aiClearSearch', {})} aria-label="清除搜索">×</button>` : ''}
            </div>
        ` : ''}

        ${allItems.length === 0 ? `
            <div class="persona-empty">
                <div class="persona-empty__icon">○</div>
                <div class="persona-empty__text">还没有 AI 人设</div>
                <div class="persona-empty__hint">点击右上角「+ 新建」创建第一个 AI 人设</div>
            </div>
        ` : filteredItems.length === 0 ? `
            <div class="persona-empty">
                <div class="persona-empty__icon">⌕</div>
                <div class="persona-empty__text">没有匹配的 AI</div>
                <div class="persona-empty__hint">试试别的关键词，或清除搜索</div>
            </div>
        ` : `
            <div class="persona-grid">
                ${filteredItems.map(item => {
                    const isActive = item.id === activeId;
                    const sdk = window.settingsSdk;
                    const boundWorld = (item.boundWorldId && sdk) ? sdk.worlds.get(item.boundWorldId) : null;
                    const metaParts = [];
                    if (item.role) metaParts.push(item.role);
                    if (boundWorld) metaParts.push(`${boundWorld.name || boundWorld.id}`);
                    const meta = metaParts.join(' · ');
                    return `
                        <div class="persona-card ${isActive ? 'is-active' : ''}" ${wvAction('aiSetActive', { id: item.id })}>
                            ${isActive ? '<span class="persona-card__badge">当前</span>' : ''}
                            <div class="persona-card__head">
                                <div class="persona-card__avatar">${renderPersonaAvatarContent(item)}</div>
                                <div class="persona-card__name">${escapeHtml(item.name || item.id)}</div>
                            </div>
                            <div class="persona-card__meta">
                                ${meta ? `${escapeHtml(meta)}` : escapeHtml(item.id)}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `}
    `;
}

/* ============================================
 * 主入口
 * ============================================ */

export function renderAiSection(app) {
    const sdk = window.settingsSdk;
    if (!sdk) return '<div class="persona-empty"><div class="persona-empty__text">SDK 未初始化</div></div>';

    const sub = app.state.ai?.sub || 'list';
    const allItems = sdk.aiPersons.list();
    const activeAi = sdk.aiPersons.getActive();
    const searchKeyword = app.state.ai?.search || '';
    const filteredItems = filterAiList(allItems, searchKeyword);
    // UI 层用「simple / detailed」；SDK 层 profile 用「minimal / detailed」，这里做一次逆向映射
    // 以便 1) 跟随用户上次选择 2) 跨页 / 跨刷新保留
    let uiLevel = app.state.ui?.profileLevel;
    if (uiLevel !== 'simple' && uiLevel !== 'detailed' && activeAi) {
        const sdkLevel = sdk.profile?.getLevelFor?.('ai', activeAi.id);
        uiLevel = sdkLevel === 'detailed' ? 'detailed' : 'simple';
    } else if (!uiLevel) {
        uiLevel = 'simple';
    }

    return `
        <div>
            ${renderOverview(activeAi)}
            ${renderWorldCard(activeAi)}
            ${renderTabs(sub)}
            ${sub === 'edit' && activeAi
                ? renderPersonaEditor(activeAi, 'ai', uiLevel, app)
                : renderAiList(app, allItems, filteredItems, activeAi?.id, searchKeyword)
            }
        </div>
    `;
}
