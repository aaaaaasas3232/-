/**
 * music-app · pages/me-page.js
 * 我的 Tab
 */

import { escapeHtml } from '@/src/core/escape.js';
import { createActionAttr } from '@/src/core/actions.js';
import { SVGIcons } from '../icons.js';

export function renderMePageReadonly(content, page, app) {
    const state = app?.state?.music || {};
    const appId = app?.id || 'music';

    // 统计
    const likedCount = Array.isArray(state.likedSongs) ? state.likedSongs.length : 0;
    const playlistCount = Array.isArray(state.playlists) ? state.playlists.length : 0;
    const songsCount = Array.isArray(state.songs) ? state.songs.length : 0;

    // 用户信息
    let userName = '音乐爱好者';
    let userBio = '用音乐治愈每一天';
    let userColor = '#fb7299';
    try {
        const sdk = window.settingsSdk;
        if (sdk?.users) {
            const u = sdk.users.getActive?.() || sdk.defaultUserCard?.getDefault?.();
            if (u) {
                userName = u.name || u.nickname || userName;
                userBio = u.bio || userBio;
                userColor = u.color || u.themeColor || userColor;
            }
        }
    } catch (_) { /* noop */ }

    const safeName = escapeHtml(userName);

    // 设置按钮
    const settingsAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'openSettings',
    }, appId);

    return `
        <div class="music-app-container">
            <div class="music-header">
                <div class="music-header-title">我的</div>
                <div class="music-header-actions">
                    <button class="music-header-btn" ${settingsAction}>
                        ${SVGIcons.settings}
                    </button>
                </div>
            </div>

            <div class="music-user-header">
                <div class="music-user-avatar" style="background:linear-gradient(135deg, ${escapeHtml(userColor)}, ${escapeHtml(userColor)}99);">
                    ${SVGIcons.user}
                </div>
                <div class="music-user-name">${safeName}</div>
                <div class="music-user-bio">${escapeHtml(userBio)}</div>
            </div>

            <div class="music-user-stats">
                ${_renderStat(appId, likedCount, '喜欢', 'openLikedSongsPage')}
                ${_renderStat(appId, playlistCount, '歌单', 'openPlaylists')}
                ${_renderStat(appId, songsCount, '曲库', 'openLibrary')}
            </div>

            <div class="music-menu-list">
                ${_renderMenuItem(appId, 'liked-songs-menu', SVGIcons.heart, 'music-menu-icon--pink', '我喜欢的音乐', 'openLikedSongsPage')}
                ${_renderMenuItem(appId, 'lyrics-editor-menu', SVGIcons.edit, 'music-menu-icon--blue', '歌词编辑', 'openLyricsEditorPage')}
                ${_renderPresenceEntry(appId)}
            </div>
        </div>
    `;
}

function _renderStat(appId, count, label, method) {
    const action = createActionAttr({
        action: 'appMethod',
        appId,
        method,
    }, appId);
    return `
        <div class="music-user-stat" ${action}>
            <div class="music-user-stat-num">${count}</div>
            <div class="music-user-stat-label">${escapeHtml(label)}</div>
        </div>
    `;
}

/**
 * 「灵动岛与小组件」入口。走 framework 的全局委托（data-presence-center），
 * 不用注册 method、不用改路由，App 侧只要这一个按钮。
 * 详见 docs/framework-灵动岛与小组件总览.md
 */
function _renderPresenceEntry(appId) {
    const icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="8" width="18" height="8" rx="4"/><circle cx="8" cy="12" r="1.4" fill="currentColor" stroke="none"/></svg>`;
    return `
        <div class="music-menu-item music-presence-menu" data-presence-center="${escapeHtml(appId)}">
            <div class="music-menu-icon music-menu-icon--blue">
                ${icon}
            </div>
            <div class="music-menu-text">灵动岛与小组件</div>
            <div class="music-menu-arrow">›</div>
        </div>
    `;
}

function _renderMenuItem(appId, className, icon, iconClass, label, method) {
    const action = createActionAttr({
        action: 'appMethod',
        appId,
        method,
    }, appId);
    return `
        <div class="music-menu-item ${escapeHtml(className)}" ${action}>
            <div class="music-menu-icon ${iconClass}">
                ${icon}
            </div>
            <div class="music-menu-text">${escapeHtml(label)}</div>
            <div class="music-menu-arrow">›</div>
        </div>
    `;
}

// 兼容 export alias
export const renderMePage = renderMePageReadonly;