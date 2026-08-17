/**
 * music-app · state.js
 * MusicPlayerState 模块化封装 + 三段式持久化（IndexedDB + localStorage）。
 *
 * 旧 MusicPlayerState.*{...} 全部映射到 app.state.music.*
 *
 * 持久化策略:
 *   - playlists / likedSongs / playHistory / listenTogetherSessions
 *       → IndexedDB（toolkit.db, 4 张 app 声明表）
 *   - playMode / currentSong / lyrics / songs
 *       → localStorage（xiaoting::music-state-v1, 启动快、不依赖 db）
 */

import { defaultSongs, defaultPlaylists } from './default-songs.js';

const LS_KEY = 'xiaoting::music-state-v1';
const LS_LYRICS_KEY = 'xiaoting::music-lyrics-v1';
const LS_MODE_KEY = 'xiaoting::music-play-mode-v1';
const LS_PLAYCOUNT_KEY = 'xiaoting::music-play-count-v1';

// IndexedDB 表名（与 appConfig.stores 同步）
const STORE_LIKED = 'likedSongs';
const STORE_PLAYLISTS = 'playlists';
const STORE_HISTORY = 'playHistory';
const STORE_LISTEN_TOGETHER = 'listenTogetherSessions';

// ============================================================================
// 初始状态
// ============================================================================

export function createInitialPlayerState() {
    return {
        // 运行时
        isPlaying: false,
        currentSong: null,
        currentTime: 0,
        duration: 180,
        progress: 0,
        // 列表
        songs: deepClone(defaultSongs),
        playlists: defaultPlaylists.map((p) => ({ ...p, songs: [] })),
        likedSongs: [],
        playHistory: [],
        playMode: 'list',
        // 一起听
        listenTogether: {
            active: false,
            sessionId: null,
            aiId: null,
            aiName: null,
            startTime: null,
            invitePending: false,
        },
    };
}

// ============================================================================
// localStorage 兜底（防 HMR / 旧实例 / IndexedDB 升级失败）
// ============================================================================

export function loadMusicSnapshot() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        return obj && typeof obj === 'object' ? obj : null;
    } catch (_) {
        return null;
    }
}

export function saveMusicSnapshot(snapshot) {
    try {
        const persist = {
            currentSong: snapshot.currentSong ? {
                id: snapshot.currentSong.id,
                title: snapshot.currentSong.title,
                artist: snapshot.currentSong.artist,
                color: snapshot.currentSong.color,
                cover: snapshot.currentSong.cover,
            } : null,
            currentTime: snapshot.currentTime,
            duration: snapshot.duration,
            likedSongs: snapshot.likedSongs || [],
            playlists: snapshot.playlists || [],
            playHistory: snapshot.playHistory || [],
            songs: (snapshot.songs || []).map((s) => ({
                id: s.id,
                title: s.title,
                artist: s.artist,
                cover: s.cover,
                color: s.color,
                url: s.url,
            })),
            listenTogether: snapshot.listenTogether || {},
        };
        localStorage.setItem(LS_KEY, JSON.stringify(persist));
    } catch (_) { /* quota / private */ }
}

// 播放模式（独立 localStorage key）
export function loadPlayMode() {
    try {
        const raw = localStorage.getItem(LS_MODE_KEY);
        if (!raw) return 'list';
        const obj = JSON.parse(raw);
        return (obj && obj.mode) || 'list';
    } catch (_) { return 'list'; }
}

export function savePlayMode(mode) {
    try {
        localStorage.setItem(LS_MODE_KEY, JSON.stringify({ mode }));
    } catch (_) { /* noop */ }
}

// ---------- 歌单字段归一化 ----------
// 历史上歌单里的曲目 id 有两个字段名：内置歌单用 songs，新建歌单写 songIds，
// 于是「歌单里有几首歌」在不同页面算出来的结果对不上。统一从这里读写，
// 写的时候两个字段都写，老数据也能正常显示。

export function getPlaylistSongIds(playlist) {
    if (!playlist) return [];
    if (Array.isArray(playlist.songIds)) return playlist.songIds;
    if (Array.isArray(playlist.songs)) return playlist.songs;
    return [];
}

export function setPlaylistSongIds(playlist, ids) {
    if (!playlist) return;
    const list = Array.isArray(ids) ? [...ids] : [];
    playlist.songIds = list;
    playlist.songs = list;
}

/** 歌单 id 可能是数字（内置）也可能是 pl_xxx 字符串（新建），比较时别硬转 Number */
export function isSamePlaylistId(a, b) {
    if (a == null || b == null) return false;
    return String(a) === String(b);
}

export function findPlaylist(playlists, playlistId) {
    if (!Array.isArray(playlists)) return null;
    return playlists.find((p) => isSamePlaylistId(p?.id, playlistId)) || null;
}

// ---------- 播放次数（这首歌听过几次）----------
// 原型只在内存里记 song.playCount，刷新就归零；这里落到 localStorage，
// 「一起听」的 prompt 和排行榜都要读它。
// 结构：{ [songId]: { count: number, lastPlayedAt: number } }

export function loadPlayCounts() {
    try {
        const raw = localStorage.getItem(LS_PLAYCOUNT_KEY);
        if (!raw) return {};
        const obj = JSON.parse(raw);
        return (obj && typeof obj === 'object') ? obj : {};
    } catch (_) { return {}; }
}

export function savePlayCounts(map) {
    try {
        localStorage.setItem(LS_PLAYCOUNT_KEY, JSON.stringify(map || {}));
    } catch (_) { /* noop */ }
}

export function bumpPlayCount(songId) {
    if (songId == null) return 0;
    const map = loadPlayCounts();
    const key = String(songId);
    const prev = map[key] || { count: 0, lastPlayedAt: 0 };
    const next = { count: (Number(prev.count) || 0) + 1, lastPlayedAt: Date.now() };
    map[key] = next;
    savePlayCounts(map);
    return next.count;
}

export function getPlayCount(songId) {
    if (songId == null) return 0;
    const entry = loadPlayCounts()[String(songId)];
    return Number(entry?.count) || 0;
}

// 自定义歌词
export function loadLyricsMap() {
    try {
        const raw = localStorage.getItem(LS_LYRICS_KEY);
        if (!raw) return {};
        const obj = JSON.parse(raw);
        return (obj && typeof obj === 'object') ? obj : {};
    } catch (_) { return {}; }
}

export function saveLyricsMap(map) {
    try {
        localStorage.setItem(LS_LYRICS_KEY, JSON.stringify(map || {}));
    } catch (_) { /* noop */ }
}

export function applyLyricsMap(songs, lyricsMap) {
    if (!songs || !lyricsMap) return songs;
    return songs.map((song) => {
        const custom = lyricsMap[song.id];
        if (Array.isArray(custom) && custom.length > 0) {
            return { ...song, lyrics: custom };
        }
        return song;
    });
}

// ============================================================================
// IndexedDB CRUD（通过 toolkit.db）
// ============================================================================

// helper：拿 db handle（容错）
function _getDb(app) {
    if (app?.toolkit?.db) return app.toolkit.db;
    if (typeof window !== 'undefined' && window.myDb) return window.myDb;
    return null;
}

// ---------- likedSongs ----------

export async function loadLikedSongs(app) {
    const db = _getDb(app);
    if (!db) return [];
    try {
        const list = await db.getAll?.(STORE_LIKED);
        return Array.isArray(list) ? list : [];
    } catch (e) {
        console.warn('[music] loadLikedSongs fallback to localStorage', e);
        const snap = loadMusicSnapshot();
        return snap?.likedSongs || [];
    }
}

export async function saveLikedSong(app, songId) {
    const db = _getDb(app);
    if (!db) return false;
    const record = {
        songId: Number(songId),
        likedAt: Date.now(),
    };
    try {
        if (typeof db.put === 'function') {
            await db.put(STORE_LIKED, record);
            return true;
        }
    } catch (e) {
        console.warn('[music] saveLikedSong failed', e);
    }
    return false;
}

export async function removeLikedSong(app, songId) {
    const db = _getDb(app);
    if (!db) return false;
    try {
        if (typeof db.remove === 'function') {
            await db.remove(STORE_LIKED, Number(songId));
            return true;
        }
    } catch (e) {
        console.warn('[music] removeLikedSong failed', e);
    }
    return false;
}

export async function isLikedSong(app, songId) {
    const list = await loadLikedSongs(app);
    return list.some((r) => Number(r.songId) === Number(songId));
}

// ---------- playlists ----------

export async function loadPlaylists(app) {
    const db = _getDb(app);
    if (!db) {
        const snap = loadMusicSnapshot();
        return snap?.playlists || [];
    }
    try {
        const list = await db.getAll?.(STORE_PLAYLISTS);
        return Array.isArray(list) ? list : [];
    } catch (e) {
        console.warn('[music] loadPlaylists fallback to localStorage', e);
        const snap = loadMusicSnapshot();
        return snap?.playlists || [];
    }
}

export async function savePlaylist(app, playlist) {
    const db = _getDb(app);
    if (!db || !playlist) return false;
    try {
        if (typeof db.put === 'function') {
            await db.put(STORE_PLAYLISTS, playlist);
            return true;
        }
    } catch (e) {
        console.warn('[music] savePlaylist failed', e);
    }
    return false;
}

export async function removePlaylist(app, playlistId) {
    const db = _getDb(app);
    if (!db) return false;
    try {
        if (typeof db.remove === 'function') {
            await db.remove(STORE_PLAYLISTS, playlistId);
            return true;
        }
    } catch (e) {
        console.warn('[music] removePlaylist failed', e);
    }
    return false;
}

// ---------- playHistory ----------

export async function loadPlayHistory(app) {
    const db = _getDb(app);
    if (!db) {
        const snap = loadMusicSnapshot();
        return snap?.playHistory || [];
    }
    try {
        const list = await db.getAll?.(STORE_HISTORY);
        if (!Array.isArray(list)) return [];
        // 按 playTime / id 倒序
        return list.sort((a, b) => (b.playTime || b.id || 0) - (a.playTime || a.id || 0));
    } catch (e) {
        console.warn('[music] loadPlayHistory fallback to localStorage', e);
        const snap = loadMusicSnapshot();
        return snap?.playHistory || [];
    }
}

export async function recordPlayHistory(app, entry) {
    const db = _getDb(app);
    if (!db) return false;
    const record = {
        ...entry,
        id: Date.now() + Math.floor(Math.random() * 1000),
        playTime: Date.now(),
    };
    try {
        if (typeof db.add === 'function') {
            await db.add(STORE_HISTORY, record);
            return true;
        }
        if (typeof db.put === 'function') {
            await db.put(STORE_HISTORY, record);
            return true;
        }
    } catch (e) {
        console.warn('[music] recordPlayHistory failed', e);
    }
    return false;
}

export async function clearPlayHistory(app) {
    const db = _getDb(app);
    if (!db) return false;
    try {
        if (typeof db.clear === 'function') {
            await db.clear(STORE_HISTORY);
            return true;
        }
    } catch (e) {
        console.warn('[music] clearPlayHistory failed', e);
    }
    return false;
}

// ---------- listenTogetherSessions ----------

export async function loadListenTogetherSessions(app) {
    const db = _getDb(app);
    if (!db) return [];
    try {
        const list = await db.getAll?.(STORE_LISTEN_TOGETHER);
        return Array.isArray(list) ? list : [];
    } catch (e) {
        console.warn('[music] loadListenTogetherSessions failed', e);
        return [];
    }
}

export async function saveListenTogetherSession(app, session) {
    const db = _getDb(app);
    if (!db || !session) return false;
    try {
        if (typeof db.put === 'function') {
            await db.put(STORE_LISTEN_TOGETHER, session);
            return true;
        }
    } catch (e) {
        console.warn('[music] saveListenTogetherSession failed', e);
    }
    return false;
}

// ---------- helper：批量把当前 in-memory state 同步到 IndexedDB ----------

export async function persistLikedSongs(app, likedSongs) {
    const db = _getDb(app);
    if (!db) return false;
    try {
        if (typeof db.clear === 'function') {
            await db.clear(STORE_LIKED);
        }
        if (typeof db.bulkPut === 'function' && Array.isArray(likedSongs)) {
            const records = likedSongs.map((songId) => ({
                songId: Number(songId),
                likedAt: Date.now(),
            }));
            await db.bulkPut(STORE_LIKED, records);
            return true;
        }
    } catch (e) {
        console.warn('[music] persistLikedSongs failed', e);
    }
    return false;
}

export async function persistPlaylists(app, playlists) {
    const db = _getDb(app);
    if (!db) return false;
    try {
        if (typeof db.clear === 'function') {
            await db.clear(STORE_PLAYLISTS);
        }
        if (typeof db.bulkPut === 'function' && Array.isArray(playlists)) {
            await db.bulkPut(STORE_PLAYLISTS, playlists);
            return true;
        }
    } catch (e) {
        console.warn('[music] persistPlaylists failed', e);
    }
    return false;
}

// ============================================================================
// 工具
// ============================================================================

function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

export { defaultSongs, defaultPlaylists };
