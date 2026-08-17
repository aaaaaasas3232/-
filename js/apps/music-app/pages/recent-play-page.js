/**
 * music-app · pages/recent-play-page.js
 * 听歌回顾(步骤 6)。
 *
 * - 历史列表(点歌曲回放)
 * - 清空历史按钮(走 framework __phoneConfirm.request 确认弹窗)
 * - 统计卡(总次数 / 不同歌曲)
 */

import { escapeHtml } from '@/src/core/escape.js';
import { createActionAttr } from '@/src/core/actions.js';
import { SVGIcons } from '../icons.js';
import { renderDetailTopbar } from '../components/detail-topbar.js';

export function renderRecentPlayPage(content, page, app) {
    const state = app?.state?.music || {};
    const appId = app.id;
    const history = Array.isArray(state.playHistory) ? state.playHistory.slice(0, 100) : [];
    const distinctSongs = new Set(history.map((h) => h.songId || h.id)).size;
    const clearAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'clearPlayHistoryWithConfirm',
    }, appId);

    return `
        <div class="music-app music-recent music-detail-page">
            ${renderDetailTopbar({ appId })}
            <div class="music-recent-hero">
                <div class="music-recent-hero-icon">${SVGIcons.clock}</div>
                <div class="music-recent-hero-title">听歌回顾</div>
                <div class="music-recent-hero-sub">你的音乐足迹</div>
            </div>

            <div class="music-recent-stat-cards">
                <div class="music-recent-stat-card music-recent-stat-card--pink">
                    <div class="music-recent-stat-num">${history.length}</div>
                    <div class="music-recent-stat-label">播放次数</div>
                </div>
                <div class="music-recent-stat-card music-recent-stat-card--purple">
                    <div class="music-recent-stat-num">${distinctSongs}</div>
                    <div class="music-recent-stat-label">不同歌曲</div>
                </div>
            </div>

            ${history.length === 0 ? '' : `
                <div class="music-recent-actions">
                    <button class="music-btn music-btn--danger" ${clearAction}>
                        ${SVGIcons.delete}
                        <span>清空播放记录</span>
                    </button>
                </div>
            `}

            <section class="music-section">
                <div class="music-section-header">
                    <span class="music-section-title">最近播放</span>
                </div>
                <div class="music-song-list">
                    ${_renderHistoryList(history, state, appId)}
                </div>
                ${history.length === 0 ? '<div class="music-empty-state">还没有播放记录</div>' : ''}
            </section>
        </div>
    `;
}

function _renderHistoryList(history, state, appId) {
    if (history.length === 0) return '';
    return history.map((entry) => {
        const song = (Array.isArray(state.songs) ? state.songs : [])
            .find((s) => s.id === (entry.songId || entry.id));
        if (!song) return '';
        const date = entry.playTime ? new Date(entry.playTime) : null;
        const timeLabel = date ? `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` : '';
        // 对齐原型:点条目 = 播放 + 打开播放器
        const action = createActionAttr({
            action: 'appMethod',
            appId,
            method: 'playSharedSong',
            payload: { songId: song.id },
        }, appId);
        const cover = song.cover
            ? `<img src="${escapeHtml(song.cover)}" alt="" onerror="this.style.display='none'" />`
            : escapeHtml((song.title || '?').charAt(0));
        const playCount = Number(song.playCount) || 0;
        return `
            <div class="music-song-row" ${action}>
                <div class="music-song-cover" style="background:${escapeHtml(song.color || '#fb7299')};">
                    ${cover}
                </div>
                <div class="music-song-info">
                    <div class="music-song-title">${escapeHtml(song.title || '')}</div>
                    <div class="music-song-artist">${escapeHtml(song.artist || '未知歌手')} · ${escapeHtml(timeLabel)}</div>
                </div>
                ${playCount > 1 ? `<div class="music-recent-play-count">${playCount} 次</div>` : ''}
                <div class="music-song-play-icon">${SVGIcons.play}</div>
            </div>
        `;
    }).join('');
}