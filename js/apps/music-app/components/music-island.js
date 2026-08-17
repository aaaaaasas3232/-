/**
 * music-app · components/music-island.js
 * music-app 灵动岛辅助工具。
 *
 * 不重复造 island 组件,而是:
 *   1. 提供 buildMusicIslandPayload(state) — 从 app.state.music 提取 island payload
 *   2. 通过 this.toolkit.island.show('large', { islandTemplate: 'music', payload })
 *      复用 framework 内置 'music' 模板(css/music-island.css)
 *   3. 主题色覆盖走 music-app 自己的 CSS(.dynamic-island 下的 [data-color] 选择器)
 */

/**
 * 生成 island payload(从 app.state.music 提取)
 * @param {Object} state
 * @returns {Object|null}
 *
 * ★ v0.83:progress 字段语义对齐 prototype → 0~100 整数(原来是 0~1 比例)
 */
export function buildMusicIslandPayload(state) {
    if (!state) return null;
    const song = state.currentSong;
    if (!song) return null;
    // progress 可能是 0~1 旧值,也可能是 0~100 新值。统一 clamp 到 0~100
    let progress = 0;
    if (Number.isFinite(state.progress)) {
        progress = state.progress;
        // 旧值自动 ×100(0~1 范围)
        if (progress > 0 && progress <= 1) progress = progress * 100;
        progress = Math.max(0, Math.min(100, progress));
    }
    return {
        song,
        title: song.title,
        artist: song.artist,
        cover: song.cover || null,
        color: song.color || '#fb7299',
        isPlaying: !!state.isPlaying,
        liked: Array.isArray(state.likedSongs) && state.likedSongs.includes(song.id),
        progress,
        currentTime: Number.isFinite(state.currentTime) ? state.currentTime : 0,
        duration: Number.isFinite(state.duration) ? state.duration : 180,
        lyrics: Array.isArray(song.lyrics) ? song.lyrics : [],
    };
}

/**
 * 构造 framework 灵动岛 show 调用参数
 * @param {Object} state
 * @param {string} size - 'mini' | 'medium' | 'large'
 */
export function makeIslandShowCall(state, size = 'large') {
    const payload = buildMusicIslandPayload(state);
    if (!payload) return null;
    return {
        type: 'info',
        islandTemplate: 'music',
        payload,
        title: payload.title || '',
        size,
        maxSize: 'large',
    };
}