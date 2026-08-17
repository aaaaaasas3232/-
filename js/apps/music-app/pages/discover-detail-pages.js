/**
 * music-app · pages/discover-detail-pages.js
 *
 * 「发现」Tab 四张卡对应的详情页（原型 showChartPage / showRadioPage /
 * showRecommendPlaylistPage）。之前这三张卡的 method 压根没实现，点了没反应。
 *
 * 排行榜额外显示「听过 N 次」——原型只按 playCount 排序但不显示次数。
 */

import { escapeHtml } from '@/src/core/escape.js';
import { createActionAttr } from '@/src/core/actions.js';
import { SVGIcons } from '../icons.js';
import { generateSongListHtml } from '../components/song-item.js';
import { renderDetailTopbar } from '../components/detail-topbar.js';

const RANK_COLORS = ['#ff6b6b', '#ffa502', '#ffd700'];

function _cover(song, size = 48) {
    if (song?.cover) {
        return `<img src="${escapeHtml(song.cover)}" alt="" onerror="this.style.display='none'" />`;
    }
    const color = escapeHtml(song?.color || '#fb7299');
    return `<div class="music-song-cover-placeholder" style="background:linear-gradient(135deg, ${color}, ${color}99);width:${size}px;height:${size}px;">${SVGIcons.music}</div>`;
}

/** 🔥 热门排行榜 —— 按播放次数排序 */
export function renderRankingsPage(content, page, app) {
    const state = app?.state?.music || {};
    const appId = app.id;
    const songs = [...(state.songs || [])]
        .sort((a, b) => (Number(b.playCount) || 0) - (Number(a.playCount) || 0))
        .slice(0, 20);
    const played = songs.filter((s) => (Number(s.playCount) || 0) > 0);

    return `
        <div class="music-app music-rank-page music-detail-page">
            ${renderDetailTopbar({ appId })}
            <div class="music-rank-header">
                <div class="music-rank-title">热门排行榜</div>
                <div class="music-rank-sub">根据你的播放次数排序</div>
            </div>
            ${played.length === 0 ? `
                <div class="music-empty-state">还没有播放记录，多听几首就有排行榜了</div>
            ` : `
                <div class="music-song-list music-rank-list">
                    ${songs.map((song, idx) => {
                        const count = Number(song.playCount) || 0;
                        if (count === 0) return '';
                        const rankColor = idx < 3 ? RANK_COLORS[idx] : '#bbb';
                        const openAction = createActionAttr({
                            action: 'appMethod',
                            appId,
                            method: 'playSongById',
                            payload: { songId: song.id },
                        }, appId);
                        return `
                            <div class="music-song-item music-rank-item" ${openAction}>
                                <div class="music-rank-index${idx < 3 ? ' is-top' : ''}" style="color:${rankColor};">${idx + 1}</div>
                                <div class="music-song-cover">${_cover(song)}</div>
                                <div class="music-song-info">
                                    <div class="music-song-name">${escapeHtml(song.title || '未知歌曲')}</div>
                                    <div class="music-song-artist">${escapeHtml(song.artist || '未知歌手')}</div>
                                </div>
                                <div class="music-rank-count">听过 ${count} 次</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `}
        </div>
    `;
}

/** 📻 私人电台 —— 随机推荐一批 */
export function renderRadioPage(content, page, app) {
    const state = app?.state?.music || {};
    const appId = app.id;
    const seed = Number(page?.payload?.seed) || 0;
    const all = [...(state.songs || [])];
    // 用 seed 做确定性打散：同一次进入页面重渲染时顺序稳定，点「换一批」才变
    all.sort((a, b) => {
        const ha = (a.id * 9301 + seed * 49297) % 233280;
        const hb = (b.id * 9301 + seed * 49297) % 233280;
        return ha - hb;
    });
    const songs = all.slice(0, 10);
    const likedSet = new Set(Array.isArray(state.likedSongs) ? state.likedSongs : []);

    const refreshAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'refreshRadio',
    }, appId);

    return `
        <div class="music-app music-radio-page music-detail-page">
            ${renderDetailTopbar({ appId })}
            <div class="music-rank-header">
                <div class="music-rank-title">私人电台</div>
                <div class="music-rank-sub">为你随机推荐</div>
            </div>
            ${songs.length === 0 ? `
                <div class="music-empty-state">曲库为空，先去首页添加歌曲</div>
            ` : `
                <div class="music-radio-refresh-wrap">
                    <button class="music-radio-refresh" ${refreshAction}>
                        ${SVGIcons.shuffle}
                        <span>换一批推荐</span>
                    </button>
                </div>
                <div class="music-song-list">
                    ${generateSongListHtml(songs, {
                        appId,
                        playOnTap: true,
                        liked: (song) => likedSet.has(song.id),
                        isCurrent: (song) => state.currentSong?.id === song.id,
                        isPlaying: (song) => state.currentSong?.id === song.id && state.isPlaying,
                    })}
                </div>
            `}
        </div>
    `;
}

/** 📁 精选歌单 —— 列出全部歌单 */
export function renderFeaturedPlaylistsPage(content, page, app) {
    const state = app?.state?.music || {};
    const appId = app.id;
    const playlists = Array.isArray(state.playlists) ? state.playlists : [];

    const createAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'openCreatePlaylistModal',
    }, appId);

    return `
        <div class="music-app music-featured-page music-detail-page">
            ${renderDetailTopbar({ appId })}
            <div class="music-rank-header">
                <div class="music-rank-title">精选歌单</div>
                <div class="music-rank-sub">你创建的所有歌单</div>
            </div>
            ${playlists.length === 0 ? `
                <div class="music-empty-state">
                    还没有歌单
                    <div style="margin-top:16px;">
                        <button class="music-radio-refresh" ${createAction}>
                            ${SVGIcons.add}
                            <span>创建歌单</span>
                        </button>
                    </div>
                </div>
            ` : `
                <div class="music-featured-list">
                    ${playlists.map((pl) => {
                        const ids = Array.isArray(pl.songIds) ? pl.songIds : (Array.isArray(pl.songs) ? pl.songs : []);
                        const openAction = createActionAttr({
                            action: 'appMethod',
                            appId,
                            method: 'openPlaylistPage',
                            payload: { playlistId: pl.id },
                        }, appId);
                        const color = escapeHtml(pl.color || '#a29bfe');
                        return `
                            <div class="music-featured-item" ${openAction}>
                                <div class="music-featured-cover" style="background:linear-gradient(135deg, ${color}, ${color}99);">
                                    ${pl.cover
                                        ? `<img src="${escapeHtml(pl.cover)}" alt="" onerror="this.style.display='none'" />`
                                        : SVGIcons.playlist
                                    }
                                </div>
                                <div class="music-featured-info">
                                    <div class="music-featured-name">${escapeHtml(pl.name || '未命名歌单')}</div>
                                    <div class="music-featured-count">${ids.length} 首歌曲</div>
                                </div>
                                <div class="music-featured-arrow">›</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `}
        </div>
    `;
}
