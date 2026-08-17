/**
 * music-app · pages/playlist-detail-page.js
 * 歌单详情页。结构对齐原型 openPlaylistPage：
 *
 *   头图（封面 / 渐变占位）+ 歌单名 + N 首歌曲
 *   播放全部 / 编辑 / 添加歌曲 / 分享给 AI
 *   歌曲列表（行内可删）
 */

import { escapeHtml } from '@/src/core/escape.js';
import { createActionAttr } from '@/src/core/actions.js';
import { SVGIcons } from '../icons.js';
import { generateSongItemHtml } from '../components/song-item.js';
import { getPlaylistSongIds, findPlaylist } from '../state.js';
import { renderDetailTopbar } from '../components/detail-topbar.js';

export function renderPlaylistDetailPage(content, page, app) {
    const state = app?.state?.music || {};
    const appId = app.id;
    // 歌单 id 可能是 1 也可能是 'pl_1723...'，不能硬转 Number（否则新建的歌单永远打不开）
    const playlistId = content?.playlistId ?? page?.payload?.playlistId;
    const playlist = findPlaylist(state.playlists, playlistId);

    if (!playlist) {
        return renderNotFound(appId);
    }

    const songIds = getPlaylistSongIds(playlist);
    const songs = songIds
        .map((id) => state.songs?.find((s) => s.id === id))
        .filter(Boolean);

    const likedSet = new Set(Array.isArray(state.likedSongs) ? state.likedSongs : []);
    const act = (method, payload) => createActionAttr({ action: 'appMethod', appId, method, payload }, appId);

    const color = escapeHtml(playlist.color || '#fb7299');
    const coverHtml = playlist.cover
        ? `<img class="music-playlist-detail-hero-img" src="${escapeHtml(playlist.cover)}" alt="" onerror="this.style.display='none'" />`
        : `<div class="music-playlist-detail-hero-icon">${SVGIcons.playlist}</div>`;

    return `
        <div class="music-app music-playlist-detail music-detail-page">
            ${renderDetailTopbar({ appId })}
            <div class="music-playlist-detail-hero" style="background:linear-gradient(135deg, ${color} 0%, #ff9a9e 100%);">
                ${coverHtml}
                <div class="music-playlist-detail-hero-name">${escapeHtml(playlist.name || '未命名歌单')}</div>
                <div class="music-playlist-detail-hero-count">${songs.length} 首歌曲</div>
            </div>

            <div class="music-playlist-detail-actions">
                <button class="music-btn music-btn--primary" ${act('playAllInPlaylist', { playlistId: playlist.id })}>
                    ${SVGIcons.play}
                    <span>播放全部</span>
                </button>
                <button class="music-btn music-btn--secondary" ${act('openEditPlaylistModal', { playlistId: playlist.id })}>
                    ${SVGIcons.edit}
                    <span>编辑</span>
                </button>
            </div>

            <div class="music-playlist-detail-actions">
                <button class="music-btn music-btn--secondary" ${act('openPickSongsModal', { playlistId: playlist.id })}>
                    ${SVGIcons.add}
                    <span>添加歌曲</span>
                </button>
                <button class="music-btn music-btn--secondary" ${act('sharePlaylistToAI', { playlistId: playlist.id })}>
                    ${SVGIcons.share}
                    <span>分享给 AI</span>
                </button>
            </div>

            <section class="music-section">
                <div class="music-section-header">
                    <span class="music-section-title">歌曲列表</span>
                </div>
                <div class="music-song-list">
                    ${songs.map((song) => generateSongItemHtml(song, {
                        appId,
                        liked: likedSet.has(song.id),
                        isCurrent: state.currentSong?.id === song.id,
                        isPlaying: state.currentSong?.id === song.id && state.isPlaying,
                        removeFromPlaylistId: playlist.id,
                    })).join('')}
                </div>
                ${songs.length === 0 ? '<div class="music-empty-state">歌单还没有歌曲，点上方「添加歌曲」</div>' : ''}
            </section>
        </div>
    `;
}

function renderNotFound(appId) {
    const backAction = createActionAttr({ action: 'appMethod', appId, method: 'closePlayerPage' }, appId);
    return `
        <div class="music-app music-playlist-detail-empty music-detail-page">
            ${renderDetailTopbar({ appId })}
            <div class="music-placeholder-card">
                <div class="music-placeholder-icon">${SVGIcons.playlist}</div>
                <div class="music-placeholder-text">歌单不存在</div>
                <button class="music-btn" ${backAction}>返回</button>
            </div>
        </div>
    `;
}
