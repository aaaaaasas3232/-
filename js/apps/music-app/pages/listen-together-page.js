/**
 * music-app · pages/listen-together-page.js
 * 一起听 Tab。结构与视觉对齐原型 generateListenTogetherTabContent()：
 *
 *   header（标题 + 分享歌单）
 *   ├─ 进行中卡：脉冲「正在一起听」+ 秒表 + 伙伴 + 当前曲(含听过几次)
 *   │            + 让TA切歌 / 分享歌曲 + 结束一起听
 *   └─ 空闲卡：引导文案 +（有当前曲时）当前曲预览
 *   选择好友（[data-ai-list] 由 index._setupListenTogetherAiList 异步填充）
 *   一起听记录
 */

import { escapeHtml } from '@/src/core/escape.js';
import { createActionAttr } from '@/src/core/actions.js';
import { SVGIcons } from '../icons.js';
import { formatListenDuration } from '../services/listen-together-context.js';

export function renderListenTogetherPage(content, page, app) {
    const state = app?.state?.music || {};
    const appId = app.id;
    const lt = state.listenTogether || {};
    const hasActive = !!(lt.active && lt.sessionId);

    const shareAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'sharePlaylist',
    }, appId);

    return `
        <div class="music-app-container listen-together-page">
            <div class="music-header">
                <div class="music-header-title">一起听</div>
                <div class="music-header-actions">
                    <button class="music-header-btn send-playlist-btn" ${shareAction} title="分享歌单">
                        ${SVGIcons.share}
                    </button>
                </div>
            </div>
            ${hasActive ? _renderActiveCard(state, appId) : _renderIdleCard(state)}
            ${_renderFriendsSection()}
            ${_renderHistorySection(state)}
        </div>
    `;
}

// ---------------------------------------------------------------------------

function _renderCover(song, placeholderClass) {
    if (!song) {
        return `<div class="${placeholderClass}">${SVGIcons.music}</div>`;
    }
    if (song.cover) {
        return `<img src="${escapeHtml(song.cover)}" alt="" onerror="this.style.display='none'" />`;
    }
    const color = song.color || '#fb7299';
    return `<div class="${placeholderClass}" style="background:linear-gradient(135deg, ${escapeHtml(color)}, ${escapeHtml(color)}99);">${SVGIcons.music}</div>`;
}

function _renderActiveCard(state, appId) {
    const lt = state.listenTogether || {};
    const song = state.currentSong;
    const elapsed = lt.startTime ? formatListenDuration(Date.now() - lt.startTime) : '0 秒';
    const playCount = Number(song?.playCount) || 0;

    const switchSongAction = createActionAttr({ action: 'appMethod', appId, method: 'aiSwitchSong' }, appId);
    const shareSongAction = createActionAttr({ action: 'appMethod', appId, method: 'shareCurrentSong' }, appId);
    const endAction = createActionAttr({ action: 'appMethod', appId, method: 'endListenTogetherWithConfirm' }, appId);

    return `
        <div class="listen-together-active-card">
            <div class="listen-together-active-header">
                <div class="listen-together-active-indicator">
                    <div class="listen-together-pulse"></div>
                    <span class="listen-together-status-text">正在一起听</span>
                </div>
                <div class="listen-together-timer-wrap">
                    <div class="listen-together-timer-icon">${SVGIcons.clock}</div>
                    <span class="listen-together-timer" data-lt-timer="1">${escapeHtml(elapsed)}</span>
                </div>
            </div>

            <div class="listen-together-partner-info">
                <div class="listen-together-partner-label">与</div>
                <div class="listen-together-partner-name">${escapeHtml(lt.aiName || 'AI')}</div>
                <div class="listen-together-partner-label">一起</div>
            </div>

            <div class="listen-together-now-playing">
                <div class="listen-together-song-cover">
                    ${_renderCover(song, 'listen-together-song-cover-placeholder')}
                </div>
                <div class="listen-together-song-info">
                    <div class="listen-together-song-title">${escapeHtml(song?.title || '未播放歌曲')}</div>
                    <div class="listen-together-song-artist">${escapeHtml(song?.artist || '选择一首歌开始吧')}</div>
                    ${playCount > 0 ? `<div class="listen-together-song-plays">这首听过 ${playCount} 次</div>` : ''}
                </div>
            </div>

            <div class="listen-together-actions">
                <button class="listen-together-action-btn ai-switch-song-btn" ${switchSongAction}>
                    <div class="listen-together-action-icon">${SVGIcons.shuffle}</div>
                    <span>让TA切歌</span>
                </button>
                <button class="listen-together-action-btn share-current-song-btn" ${shareSongAction}>
                    <div class="listen-together-action-icon">${SVGIcons.share}</div>
                    <span>分享歌曲</span>
                </button>
            </div>

            <button class="listen-together-end-btn end-listen-together-btn" ${endAction}>
                <div class="listen-together-end-icon">${SVGIcons.stop}</div>
                <span>结束一起听</span>
            </button>
        </div>
    `;
}

function _renderIdleCard(state) {
    const song = state.currentSong;
    const pending = !!state.listenTogether?.invitePending;
    return `
        <div class="listen-together-idle-card">
            <div class="listen-together-idle-icon">
                ${SVGIcons.headphones}
            </div>
            <div class="listen-together-idle-content">
                <div class="listen-together-idle-title">一起听音乐</div>
                <div class="listen-together-idle-desc">${
                    pending ? '邀请已发出，等对方回应…' : '选择下方好友，邀请TA和你一起听歌'
                }</div>
            </div>
            ${song ? `
                <div class="listen-together-idle-song">
                    <div class="listen-together-idle-song-cover">
                        ${_renderCover(song, 'listen-together-song-cover-placeholder')}
                    </div>
                    <div class="listen-together-idle-song-info">
                        <div class="listen-together-idle-song-title">${escapeHtml(song.title || '')}</div>
                        <div class="listen-together-idle-song-artist">${escapeHtml(song.artist || '')}</div>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

function _renderFriendsSection() {
    return `
        <div class="listen-together-content">
            <div class="listen-together-section-header">
                <div class="listen-together-section-icon">
                    ${SVGIcons.users}
                </div>
                <span>选择好友</span>
            </div>
            <div class="listen-together-friends-list" data-ai-list="1">
                <div class="listen-together-friend-item" data-ai-loading="true">
                    <div class="listen-together-friend-avatar">
                        <div class="listen-together-friend-avatar-placeholder">...</div>
                    </div>
                    <div class="listen-together-friend-info">
                        <div class="listen-together-friend-name">加载中...</div>
                        <div class="listen-together-friend-status">正在获取好友列表</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function _renderHistorySection(state) {
    const sessions = (Array.isArray(state.listenTogetherSessions) ? state.listenTogetherSessions : [])
        .filter((s) => s && !s.active);
    return `
        <div class="listen-together-history-section">
            <div class="listen-together-section-header">
                <div class="listen-together-section-icon">
                    ${SVGIcons.history}
                </div>
                <span>一起听记录</span>
            </div>
            <div class="listen-together-history-list" id="listen-together-history">
                ${sessions.length === 0
                    ? '<div class="listen-together-history-empty">暂无一起听记录</div>'
                    : sessions.slice(0, 10).map(_renderHistoryRow).join('')
                }
            </div>
        </div>
    `;
}

function _renderHistoryRow(s) {
    const date = s.startTime ? new Date(s.startTime) : null;
    const dateLabel = date
        ? `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
        : '';
    const duration = s.duration ? formatListenDuration(s.duration) : '未知时长';
    const songCount = Number(s.songCount) || 0;
    return `
        <div class="listen-together-history-item">
            <div class="listen-together-history-icon">${SVGIcons.headphones}</div>
            <div class="listen-together-history-info">
                <div class="listen-together-history-ai">与 ${escapeHtml(s.aiName || 'AI')} 一起听</div>
                <div class="listen-together-history-time">${escapeHtml(dateLabel)} · ${escapeHtml(duration)}${songCount ? ` · ${songCount} 首` : ''}</div>
            </div>
        </div>
    `;
}
