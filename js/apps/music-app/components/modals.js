/**
 * music-app · components/modals.js
 * 步骤 9 — 模态组件:
 *   1. 添加歌曲 (addSong)
 *   2. 创建歌单 (createPlaylist)
 *   3. 编辑歌单 (editPlaylist)
 *   4. 分享歌单给 AI (sharePlaylistToAiModal)
 *
 * 所有模态都是返回一段 HTML 字符串(内嵌 data-app-action),由 framework `template` 渲染模式渲到主壳。
 * 由 index.js 在用户点击 "添加歌曲/创建歌单/分享/编辑" 时调,拿到 markup,通过
 * `this._openModal(markup)` 显示(实现见 index.js)。
 */

import { escapeHtml } from '@/src/core/escape.js';
import { createActionAttr } from '@/src/core/actions.js';
import { SVGIcons } from '../icons.js';

const SVG_PLAYLIST = SVGIcons.playlist;
const SVG_CHECK = SVGIcons.check;
const SVG_CLOSE = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

/**
 * 添加歌曲 modal
 * @param {string} appId
 * @param {string|null} playlistId - 若指定,则为"添加到指定歌单";否则为"添加到默认歌曲库"
 */
export function renderAddSongModal(appId, playlistId = null) {
    const isForPlaylist = !!playlistId;
    const payload = playlistId ? { playlistId } : {};
    const closeAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'closeModal',
    }, appId);
    const submitAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'submitAddSong',
        payload,
    }, appId);
    return `
        <div class="music-modal-overlay" data-modal-overlay="add-song">
            <div class="music-modal" data-modal-box="add-song">
                <div class="music-modal-header">
                    <span class="music-modal-title">${isForPlaylist ? '添加歌曲到歌单' : '添加歌曲'}</span>
                    <button class="music-modal-close" ${closeAction}>${SVG_CLOSE}</button>
                </div>
                <div class="music-modal-body">
                    <div class="music-form-group">
                        <label class="music-form-label">音频 URL <span class="music-form-required">*</span></label>
                        <input type="url" class="music-input" data-input="add-song-url"
                               placeholder="https://example.com/song.mp3" />
                    </div>
                    <div class="music-form-group">
                        <label class="music-form-label">歌曲标题 <span class="music-form-required">*</span></label>
                        <input type="text" class="music-input" data-input="add-song-title"
                               placeholder="例如:示例曲" />
                    </div>
                    <div class="music-form-group">
                        <label class="music-form-label">歌手</label>
                        <input type="text" class="music-input" data-input="add-song-artist"
                               placeholder="例如:小听" />
                    </div>
                    <div class="music-form-group">
                        <label class="music-form-label">封面 URL(可选)</label>
                        <input type="url" class="music-input" data-input="add-song-cover"
                               placeholder="https://example.com/cover.jpg" />
                    </div>
                    <div class="music-form-group">
                        <label class="music-form-label">LRC 歌词(可选)</label>
                        <textarea class="music-textarea" data-input="add-song-lrc" rows="4"
                                  placeholder="[00:00.00] 歌曲名\n[00:01.00] 第一句歌词"></textarea>
                    </div>
                    <div class="music-form-error" data-error="add-song" hidden></div>
                </div>
                <div class="music-modal-footer">
                    <button class="music-btn music-btn--ghost" ${closeAction}>取消</button>
                    <button class="music-btn music-btn--primary" ${submitAction}>保存</button>
                </div>
            </div>
        </div>
    `;
}

/**
 * 创建歌单 modal
 */
export function renderCreatePlaylistModal(appId) {
    const palette = ['#fb7299', '#74b9ff', '#55efc4', '#ffeaa7', '#a29bfe', '#fd79a8', '#ff7675', '#00b894'];
    const closeAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'closeModal',
    }, appId);
    const submitAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'submitCreatePlaylist',
    }, appId);
    return `
        <div class="music-modal-overlay" data-modal-overlay="create-playlist">
            <div class="music-modal" data-modal-box="create-playlist">
                <div class="music-modal-header">
                    <span class="music-modal-title">创建新歌单</span>
                    <button class="music-modal-close" ${closeAction}>${SVG_CLOSE}</button>
                </div>
                <div class="music-modal-body">
                    <div class="music-form-group">
                        <label class="music-form-label">歌单名称 <span class="music-form-required">*</span></label>
                        <input type="text" class="music-input" data-input="create-playlist-name"
                               placeholder="例如:我的最爱" />
                    </div>
                    <div class="music-form-group">
                        <label class="music-form-label">选个颜色</label>
                        <div class="music-color-palette">
                            ${palette.map((c, i) => {
                                const pickAction = createActionAttr({
                                    action: 'appMethod',
                                    appId,
                                    method: 'pickPlaylistColor',
                                    payload: { color: c },
                                }, appId);
                                return `
                                <button type="button" class="music-color-swatch ${i === 0 ? 'is-active' : ''}"
                                        data-color="${escapeHtml(c)}"
                                        style="background:${escapeHtml(c)};"
                                        ${pickAction}></button>
                            `}).join('')}
                        </div>
                    </div>
                    <div class="music-form-group">
                        <label class="music-form-label">描述(可选)</label>
                        <textarea class="music-textarea" data-input="create-playlist-desc" rows="2"
                                  placeholder="一句话描述这张歌单"></textarea>
                    </div>
                    <div class="music-form-error" data-error="create-playlist" hidden></div>
                </div>
                <div class="music-modal-footer">
                    <button class="music-btn music-btn--ghost" ${closeAction}>取消</button>
                    <button class="music-btn music-btn--primary" ${submitAction}>创建</button>
                </div>
            </div>
        </div>
    `;
}

/**
 * 编辑歌单 modal(改名/换封面/换色/描述)
 * @param {string} appId
 * @param {object} playlist - 当前歌单对象
 */
export function renderEditPlaylistModal(appId, playlist) {
    const palette = ['#fb7299', '#74b9ff', '#55efc4', '#ffeaa7', '#a29bfe', '#fd79a8', '#ff7675', '#00b894'];
    const safe = {
        id: playlist?.id || '',
        name: playlist?.name || '',
        desc: playlist?.desc || '',
        color: playlist?.color || '#fb7299',
        cover: playlist?.cover || '',
    };
    const closeAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'closeModal',
    }, appId);
    const deleteAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'deletePlaylistWithConfirm',
        payload: { playlistId: safe.id },
    }, appId);
    const submitAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'submitEditPlaylist',
        payload: { playlistId: safe.id },
    }, appId);
    return `
        <div class="music-modal-overlay" data-modal-overlay="edit-playlist">
            <div class="music-modal" data-modal-box="edit-playlist">
                <div class="music-modal-header">
                    <span class="music-modal-title">编辑歌单</span>
                    <button class="music-modal-close" ${closeAction}>${SVG_CLOSE}</button>
                </div>
                <div class="music-modal-body">
                    <div class="music-form-group">
                        <label class="music-form-label">名称</label>
                        <input type="text" class="music-input" data-input="edit-playlist-name"
                               value="${escapeHtml(safe.name)}" />
                    </div>
                    <div class="music-form-group">
                        <label class="music-form-label">描述</label>
                        <textarea class="music-textarea" data-input="edit-playlist-desc" rows="2">${escapeHtml(safe.desc)}</textarea>
                    </div>
                    <div class="music-form-group">
                        <label class="music-form-label">封面 URL</label>
                        <input type="url" class="music-input" data-input="edit-playlist-cover"
                               value="${escapeHtml(safe.cover)}" placeholder="可选" />
                    </div>
                    <div class="music-form-group">
                        <label class="music-form-label">颜色</label>
                        <div class="music-color-palette">
                            ${palette.map((c) => {
                                const pickAction = createActionAttr({
                                    action: 'appMethod',
                                    appId,
                                    method: 'pickPlaylistColor',
                                    payload: { color: c, target: 'edit' },
                                }, appId);
                                return `
                                <button type="button" class="music-color-swatch ${c === safe.color ? 'is-active' : ''}"
                                        data-color="${escapeHtml(c)}"
                                        style="background:${escapeHtml(c)};"
                                        ${pickAction}></button>
                            `}).join('')}
                        </div>
                    </div>
                    <div class="music-form-error" data-error="edit-playlist" hidden></div>
                </div>
                <div class="music-modal-footer">
                    <button class="music-btn music-btn--danger" ${deleteAction}>删除</button>
                    <div class="music-modal-footer-right">
                        <button class="music-btn music-btn--ghost" ${closeAction}>取消</button>
                        <button class="music-btn music-btn--primary" ${submitAction}>保存</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * 分享歌单给 AI modal
 * @param {string} appId
 * @param {object} playlist - 当前歌单
 * @param {Array} aiList - settingsSdk 返回的 AI 列表
 */
export function renderSharePlaylistModal(appId, playlist, aiList) {
    const safeList = Array.isArray(aiList) ? aiList : [];
    const title = playlist?.name || '歌单';
    const closeAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'closeModal',
    }, appId);
    const overlayClick = `onclick="if(event.target===this)this.dispatchEvent(new CustomEvent('close',{bubbles:true}))"`;
    return `
        <div class="music-modal-overlay" data-modal-overlay="share-playlist" ${overlayClick}>
            <div class="music-modal" data-modal-box="share-playlist" onclick="event.stopPropagation()">
                <div class="music-modal-header">
                    <span class="music-modal-title">分享给 AI</span>
                    <button class="music-modal-close" ${closeAction}>${SVG_CLOSE}</button>
                </div>
                <div class="music-modal-body">
                    <div class="music-share-target">
                        <div class="music-share-target-label">将分享</div>
                        <div class="music-share-target-name">${escapeHtml(title)}</div>
                    </div>
                    ${safeList.length === 0 ? `
                        <div class="music-empty-state">暂无可邀请的 AI(去设置添加 AI 人设)</div>
                    ` : `
                        <div class="music-share-ai-grid">
                            ${safeList.map((ai) => {
                                const aiName = escapeHtml(ai.name || ai.displayName || 'AI');
                                const aiId = escapeHtml(ai.id);
                                const shareAction = createActionAttr({
                                    action: 'appMethod',
                                    appId,
                                    method: 'submitSharePlaylistToAi',
                                    payload: { aiId: ai.id, playlistId: playlist?.id || '' },
                                }, appId);
                                return `
                                    <button class="music-share-ai-card" ${shareAction}>
                                        <div class="music-share-ai-avatar"
                                             style="background:linear-gradient(135deg, #fb7299 0%, #ff9a9e 100%);">
                                            ${(aiName || 'A').charAt(0)}
                                        </div>
                                        <div class="music-share-ai-name">${aiName}</div>
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;
}

/**
 * 添加到歌单（对齐原型 showAddToPlaylistModal）
 * 列出全部歌单，已包含这首歌的打勾，点一下切换。
 * @param {string} appId
 * @param {Object} song
 * @param {Array} playlists
 * @param {(playlist) => boolean} hasSong
 */
export function renderAddToPlaylistModal(appId, song, playlists, hasSong) {
    const safeList = Array.isArray(playlists) ? playlists : [];
    const closeAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'closeModal',
    }, appId);
    const createAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'openCreatePlaylistModal',
    }, appId);

    return `
        <div class="music-modal-overlay" data-modal-overlay="add-to-playlist">
            <div class="music-modal" data-modal-box="add-to-playlist">
                <div class="music-modal-header">
                    <span class="music-modal-title">添加到歌单</span>
                    <button class="music-modal-close" ${closeAction}>${SVG_CLOSE}</button>
                </div>
                <div class="music-modal-body">
                    <div class="music-share-target">
                        <div class="music-share-target-label">将收藏</div>
                        <div class="music-share-target-name">${escapeHtml(song?.title || '当前歌曲')}</div>
                    </div>
                    ${safeList.length === 0 ? `
                        <div class="music-empty-state">
                            还没有歌单
                            <div style="margin-top:14px;">
                                <button class="music-btn music-btn--primary" ${createAction}>新建一个</button>
                            </div>
                        </div>
                    ` : `
                        <div class="music-menu-list music-playlist-picker">
                            ${safeList.map((pl) => {
                                const checked = typeof hasSong === 'function' ? !!hasSong(pl) : false;
                                const color = escapeHtml(pl.color || '#fb7299');
                                const toggleAction = createActionAttr({
                                    action: 'appMethod',
                                    appId,
                                    method: 'toggleSongInPlaylist',
                                    payload: { playlistId: pl.id, songId: song?.id ?? null },
                                }, appId);
                                return `
                                    <div class="music-menu-item playlist-select-item${checked ? ' is-checked' : ''}" ${toggleAction}>
                                        <div class="music-menu-icon" style="background:linear-gradient(135deg, ${color}, ${color}88);">
                                            ${SVG_PLAYLIST}
                                        </div>
                                        <div class="music-menu-text">${escapeHtml(pl.name || '未命名歌单')}</div>
                                        <div class="music-menu-arrow music-playlist-picker-check">${checked ? SVG_CHECK : ''}</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
                <div class="music-modal-footer">
                    <button class="music-btn music-btn--primary" ${closeAction}>完成</button>
                </div>
            </div>
        </div>
    `;
}

/**
 * 从曲库勾选歌曲加入歌单（对齐原型 showAddSongsToPlaylistModal）
 * 原来这里是 window.prompt 让用户手输歌曲 id，基本没法用。
 * @param {string} appId
 * @param {Object} playlist
 * @param {Array} songs - 曲库里还不在该歌单的歌
 */
export function renderPickSongsModal(appId, playlist, songs) {
    const safeSongs = Array.isArray(songs) ? songs : [];
    const closeAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'closeModal',
    }, appId);
    const submitAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'submitPickSongs',
        payload: { playlistId: playlist?.id ?? null },
    }, appId);
    const newSongAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'openAddSongModal',
        payload: { playlistId: playlist?.id ?? null },
    }, appId);

    return `
        <div class="music-modal-overlay" data-modal-overlay="pick-songs">
            <div class="music-modal" data-modal-box="pick-songs">
                <div class="music-modal-header">
                    <span class="music-modal-title">添加歌曲到「${escapeHtml(playlist?.name || '歌单')}」</span>
                    <button class="music-modal-close" ${closeAction}>${SVG_CLOSE}</button>
                </div>
                <div class="music-modal-body">
                    ${safeSongs.length === 0 ? `
                        <div class="music-empty-state">
                            曲库里的歌都已经在这张歌单里了
                            <div style="margin-top:14px;">
                                <button class="music-btn music-btn--primary" ${newSongAction}>添加新歌曲</button>
                            </div>
                        </div>
                    ` : `
                        <div class="music-song-picker">
                            ${safeSongs.map((s) => `
                                <label class="music-song-picker-row">
                                    <input type="checkbox" data-pick-song="${escapeHtml(String(s.id))}" />
                                    <div class="music-song-picker-info">
                                        <div class="music-song-picker-title">${escapeHtml(s.title || '未知歌曲')}</div>
                                        <div class="music-song-picker-artist">${escapeHtml(s.artist || '未知歌手')}</div>
                                    </div>
                                </label>
                            `).join('')}
                        </div>
                    `}
                </div>
                <div class="music-modal-footer">
                    <button class="music-btn music-btn--ghost" ${closeAction}>取消</button>
                    ${safeSongs.length === 0 ? '' : `<button class="music-btn music-btn--primary" ${submitAction}>加入歌单</button>`}
                </div>
            </div>
        </div>
    `;
}

/**
 * 分享单曲给 AI（发一张歌曲卡到 murmur 的会话里）
 * @param {string} appId
 * @param {Object} song
 * @param {Array} aiList
 */
export function renderShareSongModal(appId, song, aiList) {
    const safeList = Array.isArray(aiList) ? aiList : [];
    const closeAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'closeModal',
    }, appId);
    return `
        <div class="music-modal-overlay" data-modal-overlay="share-song">
            <div class="music-modal" data-modal-box="share-song">
                <div class="music-modal-header">
                    <span class="music-modal-title">分享歌曲</span>
                    <button class="music-modal-close" ${closeAction}>${SVG_CLOSE}</button>
                </div>
                <div class="music-modal-body">
                    <div class="music-share-target">
                        <div class="music-share-target-label">将分享</div>
                        <div class="music-share-target-name">${escapeHtml(song?.title || '当前歌曲')}${
                            song?.artist ? ` · ${escapeHtml(song.artist)}` : ''
                        }</div>
                    </div>
                    ${safeList.length === 0 ? `
                        <div class="music-empty-state">暂无可分享的 AI(去设置添加 AI 人设)</div>
                    ` : `
                        <div class="music-share-ai-grid">
                            ${safeList.map((ai) => {
                                const aiName = escapeHtml(ai.name || ai.displayName || 'AI');
                                const shareAction = createActionAttr({
                                    action: 'appMethod',
                                    appId,
                                    method: 'submitShareSongToAi',
                                    payload: { aiId: ai.id, songId: song?.id ?? null },
                                }, appId);
                                return `
                                    <button class="music-share-ai-card" ${shareAction}>
                                        <div class="music-share-ai-avatar"
                                             style="background:linear-gradient(135deg, #fb7299 0%, #ff9a9e 100%);">
                                            ${(aiName || 'A').charAt(0)}
                                        </div>
                                        <div class="music-share-ai-name">${aiName}</div>
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;
}

/**
 * 添加歌曲到指定歌单的小 modal(在歌单详情页点"+"时)
 * 复用 renderAddSongModal(playlistId 模式)
 */
export function renderAddSongToPlaylistModal(appId, playlistId) {
    return renderAddSongModal(appId, playlistId);
}
