// ============================================
// 灵动岛模板（音乐 Island 的渲染）
// 从 apps.js 第 84-265 行提取
// ============================================

import { escapeHtml } from './escape.js';
import { UI_ICONS } from './icons.js';

function formatIslandTime(seconds) {
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = safeSeconds % 60;
    return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function clampIslandProgress(progress) {
    if (!Number.isFinite(progress)) {
        return 0;
    }
    return Math.min(100, Math.max(0, progress));
}

function renderIslandMusicCover(song = {}, coverClassName = '', placeholderClassName = '') {
    const color = song.color || '#fb7299';
    const noteIcon = UI_ICONS.musicNote;
    if (song.cover) {
        return `<div class="${coverClassName}"><img src="${escapeHtml(song.cover)}" alt=""></div>`;
    }
    return `
        <div class="${coverClassName}">
            <div class="${placeholderClassName}" style="background:linear-gradient(135deg, ${escapeHtml(color)}, ${escapeHtml(`${color}99`)});">
                ${noteIcon}
            </div>
        </div>
    `;
}

function getIslandMusicActiveLyricIndex(lyrics = [], currentTime = 0) {
    let activeIndex = 0;
    lyrics.forEach((line, index) => {
        if (Number(currentTime) >= Number(line?.time || 0)) {
            activeIndex = index;
        }
    });
    return activeIndex;
}

function renderMusicIslandTemplate(size, payload = {}) {
    const song = payload.song || {};
    const color = song.color || '#fb7299';
    const title = escapeHtml(song.title || payload.title || '未命名歌曲');
    const artist = escapeHtml(song.artist || payload.message || '未知歌手');
    const progress = clampIslandProgress(payload.progress);
    const liked = Boolean(payload.liked);
    const playing = Boolean(payload.isPlaying);
    const duration = Number(payload.duration || 0);
    const currentTime = Number(payload.currentTime || 0);
    const remaining = Math.max(duration - currentTime, 0);
    const likeIcon = liked ? UI_ICONS.heart : UI_ICONS.heartOutline;
    const activeLikeClass = liked ? ' is-liked' : '';

    if (size === 'mini') {
        return `
            <div class="island-template-music island-template-music-mini">
                ${renderIslandMusicCover(song, 'island-template-music-mini-cover', 'island-template-music-mini-cover-placeholder')}
                <div class="island-template-music-mini-wave${playing ? ' playing' : ''}">
                    <span style="background:${escapeHtml(color)};"></span>
                    <span style="background:${escapeHtml(color)};"></span>
                    <span style="background:${escapeHtml(color)};"></span>
                </div>
                <div class="island-template-music-mini-label">${title}</div>
            </div>
        `;
    }

    if (size === 'medium') {
        return `
            <div class="island-template-music island-template-music-medium">
                <div class="island-template-music-header">
                    ${renderIslandMusicCover(song, 'island-template-music-cover', 'island-template-music-cover-placeholder')}
                    <div class="island-template-music-info">
                        <div class="island-template-music-title">${title}</div>
                        <div class="island-template-music-artist">${artist}</div>
                    </div>
                </div>
                <div class="island-template-music-progress">
                    <div class="island-template-music-progress-bar">
                        <div class="island-template-music-progress-fill" style="width:${progress}%;background:${escapeHtml(color)};"></div>
                    </div>
                </div>
                <div class="island-template-music-time">
                    <span>${formatIslandTime(currentTime)}</span>
                    <span>${formatIslandTime(duration)}</span>
                </div>
                <div class="island-template-music-controls">
                    <div class="island-template-music-side-btns">
                        <button class="island-template-music-btn island-template-action-btn${activeLikeClass}" data-island-action="toggle-like" aria-label="收藏">${likeIcon}</button>
                    </div>
                    <div class="island-template-music-main-btns">
                        <button class="island-template-music-btn" data-island-action="prev" aria-label="上一首">${UI_ICONS.prev}</button>
                        <button class="island-template-music-btn" data-island-action="toggle-play" aria-label="播放暂停">${playing ? UI_ICONS.pause : UI_ICONS.play}</button>
                        <button class="island-template-music-btn" data-island-action="next" aria-label="下一首">${UI_ICONS.next}</button>
                    </div>
                </div>
            </div>
        `;
    }

    const lyrics = Array.isArray(payload.lyrics) && payload.lyrics.length
        ? payload.lyrics
        : [{ time: 0, text: '暂无歌词' }];
    const activeIndex = getIslandMusicActiveLyricIndex(lyrics, currentTime);
    const lyricsHtml = lyrics.map((line, index) => `
        <div class="island-template-music-lyric-line${index === activeIndex ? ' active' : ''}" data-lyric-index="${index}">
            <span>${escapeHtml(line?.text || '')}</span>
        </div>
    `).join('');

    return `
        <div class="island-template-music island-template-music-large" data-active-lyric-index="${activeIndex}">
            <div class="island-template-music-large-header">
                ${renderIslandMusicCover(song, 'island-template-music-large-cover', 'island-template-music-large-cover-placeholder')}
                <div class="island-template-music-large-info">
                    <div class="island-template-music-large-title">${title}</div>
                    <div class="island-template-music-large-artist">${artist}</div>
                </div>
                <button class="island-template-music-btn island-template-action-btn${activeLikeClass}" data-island-action="toggle-like" aria-label="收藏">${likeIcon}</button>
            </div>
            <div class="island-template-music-progress">
                <div class="island-template-music-progress-bar">
                    <div class="island-template-music-progress-fill" style="width:${progress}%;background:${escapeHtml(color)};"></div>
                </div>
            </div>
            <div class="island-template-music-time">
                <span>${formatIslandTime(currentTime)}</span>
                <span>- ${formatIslandTime(remaining)}</span>
            </div>
            <div class="island-template-music-large-controls">
                <button class="island-template-music-large-btn" data-island-action="prev" aria-label="上一首">${UI_ICONS.prev}</button>
                <button class="island-template-music-large-btn island-template-music-large-btn-main" data-island-action="toggle-play" aria-label="播放暂停">${playing ? UI_ICONS.pause : UI_ICONS.play}</button>
                <button class="island-template-music-large-btn" data-island-action="next" aria-label="下一首">${UI_ICONS.next}</button>
            </div>
            <div class="island-template-music-lyrics">${lyricsHtml}</div>
        </div>
    `;
}

function syncMusicIslandLyrics(container) {
    const lyricsContainer = container?.querySelector('.island-template-music-lyrics');
    const activeLine = lyricsContainer?.querySelector('.island-template-music-lyric-line.active');
    if (!lyricsContainer || !activeLine) {
        return;
    }

    const targetTop = activeLine.offsetTop - (lyricsContainer.clientHeight / 2) + (activeLine.clientHeight / 2);
    lyricsContainer.scrollTop = Math.max(0, targetTop);
}

function bindMusicIslandTemplate(container, payload = {}) {
    const actionButtons = container.querySelectorAll('[data-island-action]');
    actionButtons.forEach(button => {
        button.addEventListener('click', event => {
            event.stopPropagation();
            const actionName = button.getAttribute('data-island-action');
            const handler = payload?.actions?.[actionName];
            if (typeof handler === 'function') {
                handler({ action: actionName, payload, event });
            }
        });
    });

    syncMusicIslandLyrics(container);
}

/** 创建 Island 模板注册表 */
export function createIslandTemplates() {
    return {
        music: {
            render(size, payload) {
                return renderMusicIslandTemplate(size, payload);
            },
            bind(container, payload) {
                bindMusicIslandTemplate(container, payload);
            }
        }
    };
}

/** 确保 Island 模板所需 CSS 被加载（仅一次） */
export function ensureIslandTemplateStyles() {
    if (document.getElementById('music-island-template-styles')) {
        return;
    }

    const link = document.createElement('link');
    link.id = 'music-island-template-styles';
    link.rel = 'stylesheet';
    link.href = new URL('../../css/music-island.css', import.meta.url).pathname;
    document.head.appendChild(link);
}
