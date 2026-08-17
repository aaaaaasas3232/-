/**
 * music-app · pages/lyrics-editor-page.js
 * 歌词编辑入口(步骤 6 占位,步骤 7 完整版)。
 *
 * 列出所有有自定义歌词的歌曲,点歌进入单曲编辑器(单曲编辑器步骤 7 实现)。
 */

import { escapeHtml } from '@/src/core/escape.js';
import { createActionAttr } from '@/src/core/actions.js';
import { SVGIcons } from '../icons.js';
import { getAllLyrics } from '../services/lyrics-service.js';
import { renderDetailTopbar } from '../components/detail-topbar.js';

export function renderLyricsEditorPage(content, page, app) {
    const state = app?.state?.music || {};
    const appId = app.id;
    const lyricsMap = getAllLyrics();
    const customSongIds = Object.keys(lyricsMap || {}).map(Number).filter(Boolean);

    const songsWithCustom = customSongIds
        .map((id) => (Array.isArray(state.songs) ? state.songs : []).find((s) => s.id === id))
        .filter(Boolean);

    const allSongs = Array.isArray(state.songs) ? state.songs : [];

    return `
        <div class="music-app music-lyrics-editor music-detail-page">
            ${renderDetailTopbar({ appId })}
            <div class="music-lyrics-editor-header">
                <div class="music-lyrics-editor-icon">${SVGIcons.edit}</div>
                <div class="music-lyrics-editor-title">歌词编辑</div>
                <div class="music-lyrics-editor-sub">${songsWithCustom.length} 首已自定义</div>
            </div>

            <div class="music-lyrics-editor-tip">
                <div class="music-lyrics-editor-tip-title">LRC 格式</div>
                <div class="music-lyrics-editor-tip-body">每行 <code>[mm:ss.xx]歌词</code>，例如 <code>[00:12.34]月光洒落在窗台</code>。可以直接粘贴，也可以导入 .lrc 文件。</div>
            </div>

            <section class="music-section">
                <div class="music-section-header">
                    <span class="music-section-title">已自定义歌词</span>
                </div>
                <div class="music-lyrics-editor-list">
                    ${songsWithCustom.length > 0
                        ? songsWithCustom.map((s) => _renderSongRow(s, lyricsMap[s.id], appId)).join('')
                        : '<div class="music-empty-state">还没有自定义歌词,导入 LRC 试试</div>'
                    }
                </div>
            </section>

            <section class="music-section">
                <div class="music-section-header">
                    <span class="music-section-title">所有歌曲(可新建自定义)</span>
                </div>
                <div class="music-lyrics-editor-list">
                    ${allSongs.map((s) => _renderSongRow(s, lyricsMap[s.id], appId, !lyricsMap[s.id])).join('')}
                </div>
            </section>
        </div>
    `;
}

function _renderSongRow(song, customLyrics, appId, isCreate = false) {
    const safeTitle = escapeHtml(song.title || '');
    const safeArtist = escapeHtml(song.artist || '');
    const count = Array.isArray(customLyrics) ? customLyrics.length : 0;
    const action = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'openSongLyricsEditor',
        payload: { songId: song.id },
    }, appId);
    return `
        <div class="music-lyrics-editor-row" ${action}>
            <div class="music-song-cover" style="background:${escapeHtml(song.color || '#fb7299')};">
                ${escapeHtml((song.title || '?').charAt(0))}
            </div>
            <div class="music-song-info">
                <div class="music-song-title">${safeTitle}</div>
                <div class="music-song-artist">${safeArtist}</div>
            </div>
            <div class="music-lyrics-editor-badge">${isCreate ? '新建' : `${count} 行`}</div>
        </div>
    `;
}