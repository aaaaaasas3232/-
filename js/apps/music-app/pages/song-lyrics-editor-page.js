/**
 * music-app · pages/song-lyrics-editor-page.js
 * 单曲歌词编辑器 - 重新设计版
 * 风格:磨砂玻璃、粉色系、精巧不冗余
 */

import { escapeHtml } from '@/src/core/escape.js';
import { createActionAttr } from '@/src/core/actions.js';
import {
    getCustomLyrics,
    toLrcText,
} from '../services/lyrics-service.js';

export function renderSongLyricsEditorPage(content, page, app) {
    const state = app?.state?.music || {};
    const appId = app.id;
    const rawSongId = page?.payload?.songId ?? content?.songId;
    const requestedId = Number(rawSongId);
    const songs = Array.isArray(state.songs) ? state.songs : [];
    const song = songs.find((s) => s.id === requestedId)
        || (state.currentSong ? songs.find((s) => s.id === state.currentSong.id) : null)
        || null;
    if (!song) {
        return renderNotFound(appId);
    }
    const songId = song.id;

    // 优先 custom,fallback default
    const custom = getCustomLyrics(songId);
    const lyrics = Array.isArray(custom) && custom.length > 0 ? custom : (song.lyrics || []);

    const safeTitle = escapeHtml(song.title || '');
    const safeArtist = escapeHtml(song.artist || '');

    // 封面
    const coverHtml = song.cover
        ? `<img class="lyric-editor-cover-img" src="${escapeHtml(song.cover)}" alt="" onerror="this.style.display='none'" />`
        : `<div class="lyric-editor-cover-placeholder">${escapeHtml((song.title || '?').charAt(0))}</div>`;

    const backAction = createActionAttr({ action: 'appMethod', appId, method: 'closePlayerPage' }, appId);
    const saveAction = createActionAttr({ action: 'appMethod', appId, method: 'saveSongLyrics', payload: { songId } }, appId);
    const importAction = createActionAttr({ action: 'appMethod', appId, method: 'importLrcForSong', payload: { songId } }, appId);
    const exportAction = createActionAttr({ action: 'appMethod', appId, method: 'exportLrcForSong', payload: { songId } }, appId);
    const clearAction = createActionAttr({ action: 'appMethod', appId, method: 'clearSongLyrics', payload: { songId } }, appId);

    // 批量微调按钮 action
    const batchToggleAction = createActionAttr({ action: 'appMethod', appId, method: 'toggleBatchAdjust', payload: { songId } }, appId);

    // 模式切换 action - 使用 data-app-action
    const visualTabAction = createActionAttr({ action: 'appMethod', appId, method: 'switchLyricsEditorMode', payload: { songId, mode: 'visual' } }, appId);
    const textTabAction = createActionAttr({ action: 'appMethod', appId, method: 'switchLyricsEditorMode', payload: { songId, mode: 'text' } }, appId);

    return `
<div class="lyric-editor-root">
    <div class="lyric-editor-topbar">
        <button class="lyric-editor-btn lyric-editor-btn--back" ${backAction}>
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" fill="currentColor"/></svg>
        </button>
        <span class="lyric-editor-topbar-title">歌词编辑</span>
        <button class="lyric-editor-btn lyric-editor-btn--save" ${saveAction}>保存</button>
    </div>

    <div class="lyric-editor-content">
        <div class="lyric-editor-song-card">
            <div class="lyric-editor-cover">${coverHtml}</div>
            <div class="lyric-editor-song-info">
                <div class="lyric-editor-song-title">${safeTitle}</div>
                <div class="lyric-editor-song-artist">${safeArtist}</div>
            </div>
        </div>

        <div class="lyric-editor-toolbar">
            <button class="lyric-editor-tool" ${importAction}>
                <svg viewBox="0 0 24 24" width="16" height="16"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z" fill="currentColor"/></svg>
                <span>导入</span>
            </button>
            <input type="file" class="lyric-editor-file-input" accept=".lrc,.txt" data-file-input="1" hidden />
            <button class="lyric-editor-tool" ${exportAction}>
                <svg viewBox="0 0 24 24" width="16" height="16"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor"/></svg>
                <span>导出</span>
            </button>
            <button class="lyric-editor-tool lyric-editor-tool--danger" ${clearAction}>
                <svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/></svg>
                <span>清除</span>
            </button>
            <button class="lyric-editor-tool lyric-editor-tool--batch" ${batchToggleAction}>
                <svg viewBox="0 0 24 24" width="16" height="16"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z" fill="currentColor"/></svg>
                <span>批量</span>
            </button>
        </div>

        <div class="lyric-editor-batch-row lyric-editor-batch-row--hidden">
            <button class="lyric-editor-batch-btn" data-delta="-1" data-song-id="${songId}">-1s</button>
            <button class="lyric-editor-batch-btn" data-delta="-0.5" data-song-id="${songId}">-0.5s</button>
            <button class="lyric-editor-batch-btn" data-delta="-0.1" data-song-id="${songId}">-0.1s</button>
            <button class="lyric-editor-batch-btn" data-delta="0.1" data-song-id="${songId}">+0.1s</button>
            <button class="lyric-editor-batch-btn" data-delta="0.5" data-song-id="${songId}">+0.5s</button>
            <button class="lyric-editor-batch-btn" data-delta="1" data-song-id="${songId}">+1s</button>
        </div>

        <div class="lyric-editor-tabs">
            <button class="lyric-editor-tab is-active" data-mode="visual" ${visualTabAction}>
                <span>可视化</span>
            </button>
            <button class="lyric-editor-tab" data-mode="text" ${textTabAction}>
                <span>文本</span>
            </button>
        </div>

        <div class="lyric-editor-body">
            <div class="lyric-editor-panel lyric-editor-panel--visual is-active" data-panel="visual">
                ${_renderVisualMode(lyrics, songId, appId)}
            </div>
            <div class="lyric-editor-panel lyric-editor-panel--text" data-panel="text">
                ${_renderTextMode(lyrics, song, appId)}
            </div>
        </div>
    </div>
</div>
    `;
}

export function _renderVisualMode(lyrics, songId, appId) {
    if (!Array.isArray(lyrics) || lyrics.length === 0) {
        return '<div class="lyric-editor-empty">暂无歌词，请切换到文本模式导入</div>';
    }
    return lyrics.map((line, idx) => {
        const time = _fmtTime(line.time || 0);
        const actionBase = { action: 'appMethod', appId, method: 'shiftSingleLyric', payload: { songId, idx } };
        const minus1Action = createActionAttr({ ...actionBase, payload: { songId, idx, delta: -1 } }, appId);
        const minus05Action = createActionAttr({ ...actionBase, payload: { songId, idx, delta: -0.5 } }, appId);
        const plus05Action = createActionAttr({ ...actionBase, payload: { songId, idx, delta: 0.5 } }, appId);
        const plus1Action = createActionAttr({ ...actionBase, payload: { songId, idx, delta: 1 } }, appId);
        const fromHereAction = createActionAttr({
            action: 'appMethod', appId, method: 'openShiftFromHereMenu',
            payload: { songId, idx },
        }, appId);
        return `
<div class="lyric-row" data-idx="${idx}">
    <div class="lyric-row-text">${escapeHtml(line.text || '')}</div>
    <div class="lyric-row-footer">
        <span class="lyric-row-time">${time}</span>
        <div class="lyric-row-actions">
            <button class="lyric-row-btn" ${minus1Action}>-1s</button>
            <button class="lyric-row-btn" ${minus05Action}>-.5s</button>
            <button class="lyric-row-btn" ${plus05Action}>+.5s</button>
            <button class="lyric-row-btn" ${plus1Action}>+1s</button>
            <button class="lyric-row-btn lyric-row-btn--accent" ${fromHereAction}>此句后</button>
        </div>
    </div>
</div>
        `;
    }).join('');
}

function _renderTextMode(lyrics, song, appId) {
    const lrcText = toLrcText(lyrics, { title: song.title, artist: song.artist });
    return `
<div class="lyric-textarea-wrap">
    <textarea class="lyric-textarea" data-lyrics-textarea="1" rows="20"
        placeholder="每行格式: [mm:ss.xx]歌词文字&#10;例: [00:12.34]月光洒落在窗台">${escapeHtml(lrcText)}</textarea>
</div>
    `;
}

function renderNotFound(appId) {
    return `
<div class="lyric-editor-root lyric-editor-root--center">
    <div class="lyric-editor-empty">歌曲不存在</div>
</div>
    `;
}

function _fmtTime(s) {
    if (!Number.isFinite(s)) return '00:00.000';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.round((s % 1) * 1000);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}
