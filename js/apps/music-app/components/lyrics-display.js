/**
 * music-app · components/lyrics-display.js
 * 歌词列表展示组件。
 *
 * 返回静态 HTML(行号 + 时间 + 文本),active 高亮由 framework 重画时计算。
 * 实际滚动定位走 CSS transform,避免每帧 query DOM。
 */

import { escapeHtml } from '@/src/core/escape.js';

/**
 * 格式化时间 mm:ss
 */
function _formatTime(seconds) {
    if (!Number.isFinite(seconds)) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * 找出当前播放进度对应的歌词行索引
 * @param {Array} lyrics
 * @param {number} currentTime
 * @returns {number}
 */
export function findActiveLyricIndex(lyrics, currentTime) {
    if (!Array.isArray(lyrics) || lyrics.length === 0) return -1;
    if (currentTime == null || !Number.isFinite(currentTime)) return -1;
    let idx = -1;
    for (let i = 0; i < lyrics.length; i++) {
        if (lyrics[i].time <= currentTime) {
            idx = i;
        } else {
            break;
        }
    }
    return idx;
}

/**
 * 渲染歌词列表 HTML
 * @param {Array} lyrics
 * @param {number} currentTime - 当前播放时间(秒)
 * @returns {string}
 */
export function renderLyricsListHtml(lyrics, currentTime = 0) {
    if (!Array.isArray(lyrics) || lyrics.length === 0) {
        return '<div class="music-lyrics-empty">暂无歌词</div>';
    }
    const activeIdx = findActiveLyricIndex(lyrics, currentTime);
    return lyrics.map((line, idx) => {
        const time = _formatTime(line.time);
        const text = escapeHtml(line.text || '');
        const isActive = idx === activeIdx;
        const isPast = idx < activeIdx;
        return `
            <div class="music-lyric-line${isActive ? ' active' : ''}${isPast ? ' past' : ''}" data-idx="${idx}" data-time="${line.time || 0}">
                <span class="music-lyric-time">${time}</span>
                <span class="music-lyric-text">${text}</span>
            </div>
        `;
    }).join('');
}

/**
 * 生成可点击跳转的歌词列表 HTML(点击歌词行跳到对应时间)
 * 走 data-app-action 派发,调用 methods.seekToTime
 */
export function renderInteractiveLyricsHtml(lyrics, currentTime, appId) {
    if (!Array.isArray(lyrics) || lyrics.length === 0) {
        return '<div class="music-lyrics-empty">暂无歌词</div>';
    }
    const activeIdx = findActiveLyricIndex(lyrics, currentTime);
    const baseAction = JSON.stringify({
        action: 'appMethod',
        appId,
        method: 'seekToTime',
        payload: { seconds: '__TIME__' },
    });
    return lyrics.map((line, idx) => {
        const time = _formatTime(line.time);
        const text = escapeHtml(line.text || '');
        const isActive = idx === activeIdx;
        const isPast = idx < activeIdx;
        // 用字符串 replace 注入 time(escapeHtml JSON 时要小心)
        const actionAttr = baseAction.replace('"__TIME__"', String(line.time || 0));
        return `
            <div class="music-lyric-line${isActive ? ' active' : ''}${isPast ? ' past' : ''}" data-app-action='${escapeHtml(actionAttr)}' data-idx="${idx}" data-time="${line.time || 0}">
                <span class="music-lyric-time">${time}</span>
                <span class="music-lyric-text">${text}</span>
            </div>
        `;
    }).join('');
}