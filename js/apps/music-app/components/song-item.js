/**
 * music-app · components/song-item.js
 * 歌曲列表项组件(行式卡片)。
 *
 * 旧 music-app.js 的 generateSongItemHtml 拆成独立模块。
 * 所有点击走 data-app-action 派发,framework 顶层 click 委托。
 */

import { escapeHtml } from '@/src/core/escape.js';
import { createActionAttr } from '@/src/core/actions.js';
import { SVGIcons } from '../icons.js';
import { renderLikeButton, renderPlayToggleButton } from './track-controls.js';

/**
 * 生成单首歌曲的列表行 HTML
 * @param {Object} song - {id, title, artist, cover, color}
 * @param {Object} opts - {liked, isPlaying, isCurrent, appId, removeFromPlaylistId}
 *        isPlaying 表示「这一行正在响」；isCurrent 不传时按 isPlaying 推断
 *        removeFromPlaylistId 传了就多出一个"从歌单移除"按钮(对齐原型歌单详情页)
 * @returns {string} HTML 字符串
 */
export function generateSongItemHtml(song, opts = {}) {
    if (!song) return '';
    const appId = opts.appId || 'music';
    const liked = !!opts.liked;
    const isPlaying = !!opts.isPlaying;
    const isCurrent = opts.isCurrent === undefined ? isPlaying : !!opts.isCurrent;
    const removeFromPlaylistId = opts.removeFromPlaylistId ?? null;
    const safeTitle = escapeHtml(song.title || '未知歌曲');
    const safeArtist = escapeHtml(song.artist || '未知艺人');

    // playOnTap:点整行 = 播放并打开播放器（搜索结果 / 电台等场景，对齐原型）
    const openAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: opts.playOnTap ? 'playSharedSong' : 'openPlayerPage',
        payload: { songId: song.id },
    }, appId);

    // 封面:使用 CSS 类替代内联样式
    const coverHtml = song.cover
        ? `<img class="music-song-cover-img" src="${escapeHtml(song.cover)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" /><div class="music-song-cover-fallback" style="display:none;">${escapeHtml((song.title || '?').charAt(0))}</div>`
        : `<div class="music-song-cover-fallback">${escapeHtml((song.title || '?').charAt(0))}</div>`;

    return `
        <div class="music-song-item${isCurrent ? ' is-current' : ''}${isPlaying ? ' is-playing' : ''}" data-song-id="${song.id}" ${openAction}>
            <div class="music-song-cover" ${openAction}>${coverHtml}</div>
            <div class="music-song-info" ${openAction}>
                <div class="music-song-name">${safeTitle}</div>
                <div class="music-song-artist">${safeArtist}</div>
            </div>
            <div class="music-song-actions">
                ${renderLikeButton({ appId, songId: song.id, liked, extraClass: 'music-song-btn' })}
                ${removeFromPlaylistId != null ? `
                    <button class="music-song-btn delete-btn" aria-label="从歌单移除" ${createActionAttr({
                        action: 'appMethod',
                        appId,
                        method: 'removeSongFromPlaylist',
                        payload: { playlistId: removeFromPlaylistId, songId: song.id },
                    }, appId)}>
                        ${SVGIcons.delete}
                    </button>
                ` : ''}
                ${renderPlayToggleButton({ appId, songId: song.id, isCurrent, isPlaying: isPlaying })}
            </div>
        </div>
    `;
}

/**
 * 批量生成歌曲列表
 * @param {Array} songs - 歌曲数组
 * @param {Object} opts - 同 generateSongItemHtml；liked / isPlaying / isCurrent 允许传
 *        (song) => boolean 的判定函数，这里按歌逐个求值。
 *        ★ 以前是把函数原样透传给 generateSongItemHtml，那边 !!opts.liked
 *          对函数恒为 true —— 结果整张列表的歌全都显示成"已喜欢 + 正在播放"。
 */
export function generateSongListHtml(songs, opts = {}) {
    if (!Array.isArray(songs) || songs.length === 0) {
        return '<div class="music-empty-state">暂无歌曲</div>';
    }
    const resolve = (v, song) => (typeof v === 'function' ? v(song) : v);
    return songs.map((s) => generateSongItemHtml(s, {
        ...opts,
        liked: resolve(opts.liked, s),
        isPlaying: resolve(opts.isPlaying, s),
        isCurrent: opts.isCurrent === undefined ? undefined : resolve(opts.isCurrent, s),
    })).join('');
}