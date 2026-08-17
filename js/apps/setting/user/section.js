/**
 * 设置 App · 用户人设模块 · 渲染层
 *
 * 渲染接口：
 *   - renderUserSection(app)   「用户」detail 页主体
 *
 * 库页内部分成 2 个 tab：
 *   - 列表（list）: 用户库 + 新建
 *   - 编辑（edit）: 当前用户的完整字段编辑（基于人设 renderer）
 */

import { escapeHtml } from '@/src/core/escape.js';
import { renderPersonaEditor } from '../persona/renderer.js';
import { renderPersonaAvatarContent } from '../persona/avatar.js';

function wvAction(method, payload = {}) {
    const obj = { action: 'appMethod', appId: 'settings', method, payload };
    return `data-app-action='${escapeHtml(JSON.stringify(obj))}'`;
}

function wvRouteAction(sub) {
    return wvAction('userRoute', { sub });
}

function formatDateTime(timestamp) {
    if (!timestamp) return '—';
    const d = new Date(timestamp);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function renderWorldCard(activeUser) {
    const sdk = window.settingsSdk;
    if (!sdk) return '';
    const boundId = activeUser?.boundWorldId || '';
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

const USER_TABS = [
    { id: 'list', label: '用户库' },
    { id: 'edit', label: '编辑' },
];

function renderTabs(activeSub) {
    return `
        <div class="persona-tabs">
            ${USER_TABS.map(tab => `
                <button class="persona-tab ${activeSub === tab.id ? 'is-active' : ''}" ${wvRouteAction(tab.id)}>
                    ${escapeHtml(tab.label)}
                </button>
            `).join('')}
        </div>
    `;
}

function renderOverview(activeUser) {
    if (!activeUser) {
        return `
            <div class="persona-overview">
                <div class="persona-overview__avatar">?</div>
                <div class="persona-overview__body">
                    <div class="persona-overview__name">还没有用户</div>
                    <div class="persona-overview__meta">在用户库里新建一个「我」开始设置</div>
                </div>
            </div>
        `;
    }
    const sdk = window.settingsSdk;
    const boundWorld = (activeUser.boundWorldId && sdk) ? sdk.worlds.get(activeUser.boundWorldId) : null;
    const meta = [
        activeUser.pronouns && `代词 · ${activeUser.pronouns}`,
        boundWorld && `世界观 · ${boundWorld.name || boundWorld.id}`,
        !boundWorld && activeUser.boundWorldId === '' && '未绑定世界观',
        `更新于 ${formatDateTime(activeUser.updatedAt)}`,
    ].filter(Boolean).join(' · ');
    const homeAction = wvAction('personaHomeOpen', { entityType: 'user', entityId: activeUser.id });
    const isDefaultUser = activeUser.id === (sdk?.defaultUserCard?.getDefaultId?.() || null);
    return `
        <div class="persona-overview persona-overview--clickable" ${homeAction}>
            <div class="persona-overview__avatar">${renderPersonaAvatarContent(activeUser)}</div>
            <div class="persona-overview__body">
                <div class="persona-overview__name">${escapeHtml(activeUser.name || activeUser.id)}</div>
                ${meta ? `<div class="persona-overview__meta">${escapeHtml(meta)}</div>` : ''}
                <span class="persona-overview__badge">当前用户 · 主页${isDefaultUser ? ' · 默认' : ''}</span>
            </div>
            <span class="persona-overview__chevron" aria-hidden="true">›</span>
        </div>
    `;
}

function renderUserList(app, users, activeId) {
    const sdk = window.settingsSdk;
    const defaultId = sdk?.defaultUserCard?.getDefaultId?.() || null;
    return `
        <div class="persona-list-head">
            <div class="persona-list-head__title">
                用户库<span class="persona-list-head__count">${users.length}</span>
            </div>
            <button class="persona-btn" ${wvAction('userCreate', {})}>
                <span style="font-size: 14px; line-height: 1;">+</span> 新建
            </button>
        </div>
        ${users.length === 0 ? `
            <div class="persona-empty">
                <div class="persona-empty__icon">○</div>
                <div class="persona-empty__text">还没有用户</div>
                <div class="persona-empty__hint">点击右上角「+ 新建」创建第一个用户人设</div>
            </div>
        ` : `
            <div class="persona-grid">
                ${users.map(item => {
                    const isActive = item.id === activeId;
                    const isDefault = item.id === defaultId;
                    const badges = [];
                    if (isActive) badges.push('<span class="persona-card__badge persona-card__badge--active">当前</span>');
                    return `
                        <div class="persona-card ${isActive ? 'is-active' : ''} ${isDefault ? 'is-default' : ''}" ${wvAction('userSetActive', { id: item.id })}>
                            ${badges.join('')}
                            <div class="persona-card__head">
                                <div class="persona-card__avatar">${renderPersonaAvatarContent(item)}</div>
                                <div class="persona-card__name">${escapeHtml(item.name || item.id)}</div>
                            </div>
                            <div class="persona-card__meta">
                                ${item.pronouns ? `${escapeHtml(item.pronouns)} · ` : ''}${escapeHtml(item.id)}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `}
    `;
}

export function renderUserSection(app) {
    const sdk = window.settingsSdk;
    if (!sdk) return '<div class="persona-empty"><div class="persona-empty__text">SDK 未初始化</div></div>';

    const sub = app.state.user?.sub || 'list';
    const users = sdk.users.list();
    const activeUser = sdk.users.getActive();

    let uiLevel = app.state.ui?.profileLevel;
    if (uiLevel !== 'simple' && uiLevel !== 'detailed' && activeUser) {
        const sdkLevel = sdk.profile?.getLevelFor?.('user', activeUser.id);
        uiLevel = sdkLevel === 'detailed' ? 'detailed' : 'simple';
    } else if (!uiLevel) {
        uiLevel = 'simple';
    }

    return `
        <div>
            ${renderOverview(activeUser)}
            ${renderWorldCard(activeUser)}
            ${renderTabs(sub)}
            ${sub === 'edit' && activeUser
                ? renderPersonaEditor(activeUser, 'user', uiLevel, app)
                : renderUserList(app, users, activeUser?.id)
            }
        </div>
    `;
}
