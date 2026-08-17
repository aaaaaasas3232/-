/**
 * music-app · pages/player-page.js
 * 全屏播放器 detail 页。
 *
 * 步骤 4 产出:
 *  - 顶部:关闭按钮 + 标题 + 副标题(歌曲+艺人)
 *  - 中央:大封面(主题色提取) + 歌词(可滚动)
 *  - 底部:进度条 + 播放控制 + 喜欢 + 播放模式
 *  - 60s 闲置 → 灵动岛自动 dismiss
 *
 * 所有交互:
 *  - 点击歌词行 → methods.seekToTime({seconds})
 *  - 进度条点击 → methods.seekTo({percentage})
 *  - 上一首 / 下一首 / 播放暂停 → methods.xxx
 *  - 喜欢 → methods.toggleLike({songId})
 *  - 模式 → methods.togglePlayMode
 */

import { escapeHtml } from '@/src/core/escape.js';
import { createActionAttr } from '@/src/core/actions.js';
import { SVGIcons } from '../icons.js';
import { renderInteractiveLyricsHtml } from '../components/lyrics-display.js';
import { renderLikeButton } from '../components/track-controls.js';
import { getSongLyrics } from '../services/lyrics-service.js';

/**
 * 渲染全屏播放器
 */
export function renderPlayerPage(content, page, app) {
    const state = app?.state?.music || {};
    const appId = app.id;
    
    // payload 在 page 对象里（framework 的 openDetailPage 现在传递 payload）
    const payload = page?.payload || {};
    const songIdFromPayload = payload?.songId;
    const songId = songIdFromPayload !== undefined && songIdFromPayload !== null 
        ? Number(songIdFromPayload) 
        : 0;
    const currentSongId = state.currentSong?.id;
    
    const songs = state.songs || [];
    const song = songs.find((s) => s.id === songId);

    // 如果 songId 为 0 但有当前播放的歌曲，使用当前播放的歌曲
    const displaySong = song || state.currentSong || null;
    if (!displaySong) {
        return renderEmptyPlayer(appId);
    }

    const isPlaying = !!state.isPlaying;
    const likedSet = new Set(Array.isArray(state.likedSongs) ? state.likedSongs : []);
    const isLiked = likedSet.has(displaySong.id);
    // ★ v0.83:progress 已是 0~100 整数(对齐 prototype),不再 *100
    const progress = Number.isFinite(state.progress) ? state.progress : 0;
    const playMode = state.playMode || 'list';

    // 歌词(优先自定义)
    const lyrics = getSongLyrics(displaySong);
    const themeColor = displaySong.color || '#fb7299';

    const backAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'closePlayerPage',
    }, appId);
    // 播放和暂停都走 togglePlay：它内部会判断当前状态，也会等 hydrate 完成。
    // 以前播放态点的是 pauseSong、暂停态点的是 togglePlay，两条路径对灵动岛档位、
    // 闲置计时器的处理不一样，按钮点快了状态就对不上。
    const togglePlayAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'togglePlay',
    }, appId);
    // 播放器页的上一首/下一首是真正切歌(对齐原型 playPrevSong / playNextSong)。
    // ±10 秒快进只在灵动岛上，那里没地方放切歌按钮。
    const nextAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'nextSong',
    }, appId);
    const prevAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'prevSong',
    }, appId);
    const modeAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'togglePlayMode',
    }, appId);
    const lyricsEditAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'openSongLyricsEditor',
        payload: { songId: displaySong.id },
    }, appId);
    // 「加入歌单」= 把当前这首收藏进某张歌单，不是跳去某张固定歌单
    const openPlaylistAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'openAddToPlaylistModal',
        payload: { songId: displaySong.id },
    }, appId);
    const seekAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'seekTo',
        payload: { percentage: 50 },
    }, appId);
    const islandAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'onIslandAction',
        payload: { action: 'show' },
    }, appId);
    const shareAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'shareCurrentSong',
    }, appId);

    // 主题色 hex(优先用封面图片提取,失败 fallback song.color)
    const safeTheme = escapeHtml(themeColor);

    // 纵向顺序对齐原型:封面 → 歌曲信息 → 进度 → 播放控制 → 操作栏 → 歌词
    return `
        <div class="music-app music-player-full music-detail-page" data-theme-color="${safeTheme}" data-song-id="${displaySong.id}">
            <div class="music-player-bg" style="background:linear-gradient(180deg, ${safeTheme}30 0%, transparent 60%);"></div>

            <div class="music-player-topbar">
                <button class="music-player-back" ${backAction} aria-label="关闭">
                    ${'<svg viewBox="0 0 24 24" width="22" height="22"><path d="M19 11H7.83l4.88-4.88c.39-.39.39-1.03 0-1.42-.39-.39-1.02-.39-1.41 0l-6.59 6.59c-.39.39-.39 1.02 0 1.41l6.59 6.59c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L7.83 13H19c.55 0 1-.45 1-1s-.45-1-1-1z" fill="currentColor"/></svg>'}
                </button>
                <div class="music-player-topbar-label">正在播放</div>
                <div class="music-player-topbar-actions">
                    <button class="music-player-lyrics-btn" ${islandAction} aria-label="灵动岛">
                        ${SVGIcons.headphones}
                    </button>
                    <button class="music-player-lyrics-btn" ${lyricsEditAction} aria-label="歌词编辑">
                        ${SVGIcons.edit}
                    </button>
                </div>
            </div>

            <div class="music-player-cover-wrap">
                <div class="music-player-cover" style="background:${safeTheme};">
                    ${displaySong.cover
                        ? `<img class="music-player-cover-img" src="${escapeHtml(displaySong.cover)}" alt="" onerror="this.style.display='none'" />`
                        : `<div class="music-player-cover-fallback">${escapeHtml((displaySong.title || '?').charAt(0))}</div>`
                    }
                    <div class="music-player-cover-shine"></div>
                </div>
            </div>

            <div class="music-player-info">
                <div class="music-player-title">${escapeHtml(displaySong.title || '未知')}</div>
                <div class="music-player-artist">${escapeHtml(displaySong.artist || '未知')}</div>
            </div>

            <div class="music-player-progress">
                <div class="music-player-progress-bar" data-progress-bar="1" ${seekAction}>
                    <div class="music-player-progress-fill" style="width:${progress.toFixed(2)}%; background:${safeTheme};"></div>
                    <div class="music-player-progress-thumb" style="left:${progress.toFixed(2)}%; background:${safeTheme};"></div>
                </div>
                <div class="music-player-time">
                    <span class="music-player-time-now">${_formatTime(state.currentTime)}</span>
                    <span class="music-player-time-total">${_formatTime(state.duration)}</span>
                </div>
            </div>

            <div class="music-player-controls">
                <button class="music-player-prev" ${prevAction} aria-label="上一首">
                    ${SVGIcons.prev}
                </button>
                <button class="music-player-play" ${togglePlayAction} aria-label="${isPlaying ? '暂停' : '播放'}" style="background:${safeTheme};">
                    ${isPlaying ? SVGIcons.pause : SVGIcons.play}
                </button>
                <button class="music-player-next" ${nextAction} aria-label="下一首">
                    ${SVGIcons.next}
                </button>
            </div>

            <div class="music-player-actions">
                <button class="music-player-action play-mode-btn" ${modeAction} data-mode="${escapeHtml(playMode)}">
                    ${_renderModeIcon(playMode)}
                    <span>${escapeHtml(MODE_LABELS[playMode] || MODE_LABELS.list)}</span>
                </button>
                ${renderLikeButton({
                    appId,
                    songId: displaySong.id,
                    liked: isLiked,
                    variant: 'labeled',
                    extraClass: 'music-player-action',
                    color: safeTheme,
                })}
                <button class="music-player-action add-to-playlist-btn" ${openPlaylistAction}>
                    ${SVGIcons.add}
                    <span>收藏</span>
                </button>
                <button class="music-player-action share-btn" ${shareAction}>
                    ${SVGIcons.share}
                    <span>分享</span>
                </button>
            </div>

            <div class="music-lyrics-container" data-lyrics-scroll="1">
                ${renderInteractiveLyricsHtml(lyrics, state.currentTime, appId)}
            </div>
        </div>
    `;
}

function renderEmptyPlayer(appId) {
    const backAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'closePlayerPage',
    }, appId);
    return `
        <div class="music-app music-player-empty music-detail-page">
            <div class="music-player-topbar">
                <button class="music-player-back" ${backAction} aria-label="关闭">
                    ${'<svg viewBox="0 0 24 24" width="22" height="22"><path d="M19 11H7.83l4.88-4.88c.39-.39.39-1.03 0-1.42-.39-.39-1.02-.39-1.41 0l-6.59 6.59c-.39.39-.39 1.02 0 1.41l6.59 6.59c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L7.83 13H19c.55 0 1-.45 1-1s-.45-1-1-1z" fill="currentColor"/></svg>'}
                </button>
            </div>
            <div class="music-placeholder-card">
                <div class="music-placeholder-icon">${SVGIcons.music}</div>
                <div class="music-placeholder-text">未选择歌曲</div>
                <div class="music-placeholder-sub">请从首页选择一首歌曲开始播放</div>
            </div>
        </div>
    `;
}

// 操作栏上「播放模式」按钮的文案(对齐原型:列表循环 / 单曲循环 / 随机播放)
const MODE_LABELS = { list: '列表循环', repeat: '单曲循环', shuffle: '随机播放' };

function _renderModeIcon(mode) {
    const icons = {
        list: '<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" fill="currentColor"/></svg>',
        repeat: '<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-3V9h-1l-2 1v1h1.5v3H13z" fill="currentColor"/></svg>',
        shuffle: '<svg viewBox="0 0 24 24"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" fill="currentColor"/></svg>',
    };
    return icons[mode] || icons.list;
}

// 格式跟 dom-sync._fmtTime 保持一致(m:ss)。
// 不一致的话首屏渲染是 00:00,timeupdate 一来又变成 0:00,会看到跳一下。
function _formatTime(seconds) {
    if (!Number.isFinite(seconds)) return '0:00';
    const s = Math.max(0, Math.floor(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
