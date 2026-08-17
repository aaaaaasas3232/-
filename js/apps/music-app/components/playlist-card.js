/**
 * music-app · components/playlist-card.js
 * 歌单卡片组件(横滑列表用)。
 *
 * 旧 music-app.js 的 generatePlaylistCardHtml 拆成独立模块。
 */

import { escapeHtml } from '@/src/core/escape.js';
import { createActionAttr } from '@/src/core/actions.js';
import { SVGIcons } from '../icons.js';
import { getPlaylistSongIds } from '../state.js';

/**
 * 生成创建歌单卡片(首页横滑第一个位置)
 * @param {Object} opts - {appId, onClick}
 * @returns {string} HTML 字符串
 */
export function generateCreatePlaylistCardHtml(opts = {}) {
    const appId = opts.appId || 'music';
    const createAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'openCreatePlaylistModal',
    }, appId);

    return `
        <div class="music-playlist-card music-playlist-card--create" ${createAction}>
            <div class="music-playlist-card-cover">
                <div class="music-playlist-card-cover-fallback music-playlist-cover-add">
                    ${SVGIcons.add}
                </div>
            </div>
            <div class="music-playlist-card-name">新建歌单</div>
        </div>
    `;
}

/**
 * 生成歌单卡片 HTML(用于首页横滑列表)
 * @param {Object} playlist - {id, name, cover, color, songs}
 * @param {Object} opts - {appId}
 * @returns {string} HTML 字符串
 */
export function generatePlaylistCardHtml(playlist, opts = {}) {
    if (!playlist) return '';
    const appId = opts.appId || 'music';
    const safeName = escapeHtml(playlist.name || '未知歌单');
    const color = escapeHtml(playlist.color || '#fb7299');
    const color2 = escapeHtml(playlist.color2 || color);
    const songCount = getPlaylistSongIds(playlist).length;

    const detailAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'openPlaylistPage',
        payload: { playlistId: playlist.id },
    }, appId);

    // 封面:使用 CSS 类替代内联样式
    const coverHtml = playlist.cover
        ? `<img class="music-playlist-card-cover-img" src="${escapeHtml(playlist.cover)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" /><div class="music-playlist-card-cover-fallback music-playlist-cover-gradient" style="display:none;">${SVGIcons.playlist}</div>`
        : `<div class="music-playlist-card-cover-fallback music-playlist-cover-gradient music-playlist-cover-gradient--pink">${SVGIcons.playlist}</div>`;

    return `
        <div class="music-playlist-card" ${detailAction}>
            <div class="music-playlist-card-cover">${coverHtml}</div>
            <div class="music-playlist-card-name">${safeName}</div>
            <div class="music-playlist-card-count">${songCount}首</div>
        </div>
    `;
}

/**
 * 批量生成歌单横滑列表(包含创建歌单按钮)
 * @param {Array} playlists
 * @param {Object} opts - {appId, showCreateCard: boolean}
 */
export function generatePlaylistCardsHtml(playlists, opts = {}) {
    if (!Array.isArray(playlists)) {
        playlists = [];
    }

    let html = '';

    // 添加创建歌单按钮(如果需要)
    if (opts.showCreateCard !== false) {
        html += generateCreatePlaylistCardHtml(opts);
    }

    // 添加歌单列表
    if (playlists.length === 0) {
        return html || '<div class="music-empty-state">暂无歌单</div>';
    }

    return html + playlists.map((p) => generatePlaylistCardHtml(p, opts)).join('');
}