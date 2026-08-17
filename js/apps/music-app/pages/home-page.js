/**
 * music-app · pages/home-page.js
 * 首页(推荐 Tab)完整版。
 *
 * 步骤 3 产出:歌单横滑 + 歌曲列表 + 搜索框 + 喜欢按钮 + 播放入口
 *
 * 交互:
 *  - 搜索框 → 回车跳 search-results-page(payload.query)
 *  - 歌曲行 → methods.playSong(songId) → 进播放器 detail
 *  - 歌单卡片 → methods.openPlaylistPage(playlistId) → 详情
 *  - 喜欢按钮 → methods.toggleLike(songId)(独立按钮 stopPropagation)
 *  - "+" 创建歌单 → methods.openCreatePlaylist
 */

import { createActionAttr } from '@/src/core/actions.js';
import { SVGIcons } from '../icons.js';
import { generateSongListHtml } from '../components/song-item.js';
import { generatePlaylistCardsHtml } from '../components/playlist-card.js';

/**
 * 渲染首页(推荐 Tab)
 * @param {Object} content - detail 页 payload
 * @param {Object} page - page config
 * @param {Object} app - app config
 * @returns {string} HTML
 */
export function renderHomePage(content, page, app) {
    const state = app?.state?.music || {};
    const appId = app.id;

    const songs = Array.isArray(state.songs) ? state.songs : [];
    const likedSet = new Set(Array.isArray(state.likedSongs) ? state.likedSongs : []);
    const playlists = Array.isArray(state.playlists) ? state.playlists : [];
    const currentSong = state.currentSong;
    const isPlaying = !!state.isPlaying;

    // 搜索按钮(回车由 index._setupSearchInputListener 处理)
    const searchAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'openSearchResults',
        payload: {},
    }, appId);

    // 右上角「+」= 添加歌曲(对齐原型 add-song-btn → showAddSongModal)
    const addSongAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'openAddSongModal',
    }, appId);

    // 「查看全部」→ 精选歌单页
    const allPlaylistsAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'openPlaylists',
    }, appId);

    return `
        <div class="music-app-container">
            <div class="music-header">
                <div class="music-header-title">音乐</div>
                <div class="music-header-actions">
                    <button class="music-header-btn add-song-btn" ${addSongAction} aria-label="添加歌曲">
                        ${SVGIcons.add}
                    </button>
                </div>
            </div>

            <div class="music-search-bar">
                <span class="music-search-icon" ${searchAction}>${SVGIcons.search}</span>
                <input type="text" placeholder="搜索歌曲、艺术家" data-search-input="1" />
            </div>

            <section class="music-section">
                <div class="music-section-header">
                    <span class="music-section-title">我的歌单</span>
                    <span class="music-section-more" ${allPlaylistsAction}>查看全部</span>
                </div>
                <div class="music-playlist-scroll">
                    ${generatePlaylistCardsHtml(playlists, { appId, showCreateCard: true })}
                </div>
            </section>

            <section class="music-section">
                <div class="music-section-header">
                    <span class="music-section-title">推荐歌曲</span>
                </div>
                <div class="music-song-list">
                    ${generateSongListHtml(songs, {
                        appId,
                        liked: (song) => likedSet.has(song.id),
                        isCurrent: (song) => !!currentSong && currentSong.id === song.id,
                        isPlaying: (song) => currentSong && currentSong.id === song.id && isPlaying,
                    })}
                </div>
            </section>

        </div>
    `;
}