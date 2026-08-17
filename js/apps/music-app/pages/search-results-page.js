/**
 * music-app · pages/search-results-page.js
 * 搜索结果页(步骤 9 完整版之前,先用步骤 6 占位实现)。
 */

import { escapeHtml } from '@/src/core/escape.js';
import { createActionAttr } from '@/src/core/actions.js';
import { SVGIcons } from '../icons.js';
import { generateSongListHtml } from '../components/song-item.js';
import { renderDetailTopbar } from '../components/detail-topbar.js';

export function renderSearchResultsPage(content, page, app) {
    const state = app?.state?.music || {};
    const appId = app.id;
    // ★ 参数在 page.payload 里。content 是 appConfig.detailContent 那份静态标题配置，
    //   永远不会带 query —— 只读 content.query 的话搜什么都是 0 条。
    const query = (page?.payload?.query ?? content?.query ?? '').toString().trim();
    const songs = (Array.isArray(state.songs) ? state.songs : [])
        .filter((s) => {
            if (!query) return false;
            const q = query.toLowerCase();
            return (s.title || '').toLowerCase().includes(q)
                || (s.artist || '').toLowerCase().includes(q);
        });
    const playlists = (Array.isArray(state.playlists) ? state.playlists : [])
        .filter((p) => (p.name || '').toLowerCase().includes(query.toLowerCase()));

    const likedSet = new Set(Array.isArray(state.likedSongs) ? state.likedSongs : []);

    return `
        <div class="music-app music-search-results music-detail-page">
            ${renderDetailTopbar({ appId })}
            <div class="music-search-results-header">
                <span class="music-search-results-label">搜索结果</span>
                <span class="music-search-results-query">找到 ${songs.length} 首 "${escapeHtml(query)}"</span>
            </div>

            ${playlists.length > 0 ? `
                <section class="music-section">
                    <div class="music-section-header">
                        <span class="music-section-title">歌单</span>
                    </div>
                    <div class="music-search-results-playlists">
                        ${playlists.map((p) => {
                            const action = createActionAttr({
                                action: 'appMethod',
                                appId,
                                method: 'openPlaylistPage',
                                payload: { playlistId: p.id },
                            }, appId);
                            return `
                            <div class="music-search-result-playlist" ${action}>
                                <div class="music-search-result-playlist-cover" style="background:${escapeHtml(p.color || '#fb7299')};">${SVGIcons.playlist}</div>
                                <div class="music-search-result-playlist-name">${escapeHtml(p.name)}</div>
                            </div>
                        `}).join('')}
                    </div>
                </section>
            ` : ''}

            <section class="music-section">
                <div class="music-section-header">
                    <span class="music-section-title">歌曲</span>
                    <span class="music-section-subtitle">${songs.length} 首</span>
                </div>
                <div class="music-song-list">
                    ${generateSongListHtml(songs, {
                        appId,
                        playOnTap: true,
                        liked: (song) => likedSet.has(song.id),
                        isCurrent: (song) => !!state.currentSong && state.currentSong.id === song.id,
                        isPlaying: (song) => state.currentSong && state.currentSong.id === song.id && state.isPlaying,
                    })}
                </div>
                ${songs.length === 0 ? '<div class="music-empty-state">没找到匹配的歌曲</div>' : ''}
            </section>
        </div>
    `;
}