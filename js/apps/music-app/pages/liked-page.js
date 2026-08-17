/**
 * music-app · pages/liked-page.js
 * 我喜欢的音乐(步骤 6)。
 */

import { SVGIcons } from '../icons.js';
import { generateSongListHtml } from '../components/song-item.js';
import { renderDetailTopbar } from '../components/detail-topbar.js';

export function renderLikedPage(content, page, app) {
    const state = app?.state?.music || {};
    const appId = app.id;
    const likedSet = new Set(Array.isArray(state.likedSongs) ? state.likedSongs : []);
    const songs = (Array.isArray(state.songs) ? state.songs : [])
        .filter((s) => likedSet.has(s.id));

    return `
        <div class="music-app music-liked music-detail-page">
            ${renderDetailTopbar({ appId })}
            <div class="music-liked-hero" style="background:linear-gradient(135deg, #fb7299 0%, #ff9a9e 100%);">
                <div class="music-liked-hero-icon">${SVGIcons.heart}</div>
                <div class="music-liked-hero-name">我喜欢的音乐</div>
                <div class="music-liked-hero-count">${songs.length} 首</div>
            </div>

            <section class="music-section">
                <div class="music-section-header">
                    <span class="music-section-title">全部</span>
                </div>
                <div class="music-song-list">
                    ${generateSongListHtml(songs, {
                        appId,
                        liked: () => true,
                        isCurrent: (song) => !!state.currentSong && state.currentSong.id === song.id,
                        isPlaying: (song) => state.currentSong && state.currentSong.id === song.id && state.isPlaying,
                    })}
                </div>
                ${songs.length === 0 ? '<div class="music-empty-state">还没有喜欢的歌，点首页歌曲右侧的心形收藏</div>' : ''}
            </section>
        </div>
    `;
}