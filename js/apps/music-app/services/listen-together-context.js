/**
 * music-app · services/listen-together-context.js
 *
 * 「一起听」写给 AI 的实时上下文。
 *
 * 对齐原型 chat.js 的 buildListenTogetherContext(aiId)，并补上原型没有的三件事：
 *   1. 当前唱到哪一句（跟着 currentTime 实时走，不是把整首歌词一次性倒给 AI）
 *   2. 已经一起听了多久
 *   3. 这首歌用户一共听过几次
 *
 * 取数优先级：内存 live state > localStorage 快照。
 * 后者是为了「音乐 App 这次还没被打开过，但上次的一起听会话还开着」的情况。
 *
 * chat 侧不 import 本模块，只通过 window.__musicListenTogether 读，
 * 这样即使音乐 App 被卸载，聊天也不会炸。
 */

import { loadMusicSnapshot, loadLyricsMap, getPlayCount } from '../state.js';
import { defaultSongs } from '../default-songs.js';
import { getStats } from './listen-together-stats.js';

// ai-service / prompt-manager 用这个标题识别并替换掉旧的一起听段落，
// 保证每次发消息带的都是最新歌词进度，而不是缓存里那份过期的。
export const LT_CONTEXT_HEADING = '# 一起听（实时状态）';

let _liveState = null;

/** 音乐 App 启动时把 app.state.music 挂进来 */
export function bindListenTogetherState(state) {
    _liveState = state || null;
}

function _readState() {
    if (_liveState) return _liveState;
    const snap = loadMusicSnapshot();
    if (!snap) return null;
    return {
        currentSong: snap.currentSong || null,
        currentTime: Number(snap.currentTime) || 0,
        duration: Number(snap.duration) || 0,
        isPlaying: false,
        listenTogether: snap.listenTogether || {},
        songs: Array.isArray(snap.songs) ? snap.songs : [],
    };
}

function _resolveLyrics(song, state) {
    if (!song) return [];
    if (Array.isArray(song.lyrics) && song.lyrics.length) return song.lyrics;
    const custom = loadLyricsMap()[song.id];
    if (Array.isArray(custom) && custom.length) return custom;
    const inList = (state?.songs || []).find((s) => s.id === song.id);
    if (Array.isArray(inList?.lyrics) && inList.lyrics.length) return inList.lyrics;
    const builtin = defaultSongs.find((s) => s.id === song.id);
    return Array.isArray(builtin?.lyrics) ? builtin.lyrics : [];
}

function _activeLyricIndex(lyrics, currentTime) {
    let idx = -1;
    for (let i = 0; i < lyrics.length; i++) {
        if (lyrics[i].time <= currentTime) idx = i;
        else break;
    }
    return idx;
}

function _fmtClock(seconds) {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function formatListenDuration(ms) {
    const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h} 小时 ${m} 分 ${s} 秒`;
    if (m > 0) return `${m} 分 ${s} 秒`;
    return `${s} 秒`;
}

/**
 * 按歌名（+可选歌手）在曲库里找歌。
 * 给 chat 用：AI 输出 [分享音乐:歌名:歌手] 时把卡片跟真实歌曲对上，点了才能播。
 */
export function findSongByTitle(title, artist) {
    const key = String(title || '').trim().toLowerCase();
    if (!key) return null;
    const state = _readState();
    const pool = [...(state?.songs || []), ...defaultSongs];
    const seen = new Set();
    const library = pool.filter((s) => {
        if (!s || seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
    });
    const artistKey = String(artist || '').trim().toLowerCase();
    const norm = (v) => String(v || '').trim().toLowerCase();

    if (artistKey) {
        const exact = library.find((s) => norm(s.title) === key && norm(s.artist) === artistKey);
        if (exact) return exact;
    }
    return library.find((s) => norm(s.title) === key)
        || library.find((s) => norm(s.title).includes(key) || key.includes(norm(s.title)))
        || null;
}

/** 当前是否正在和这个 AI 一起听 */
export function isListeningWith(aiId) {
    const state = _readState();
    const lt = state?.listenTogether;
    if (!lt?.active) return false;
    if (!aiId) return true;
    return String(lt.aiId) === String(aiId);
}

/**
 * 生成塞进 systemPrompt 的一起听段落。
 * @param {string} aiId - 当前对话的 AI 人设 id；不匹配就返回空串
 * @returns {string}
 */
export function buildListenTogetherContext(aiId) {
    const state = _readState();
    const lt = state?.listenTogether;
    if (!lt?.active) return '';
    if (aiId && String(lt.aiId) !== String(aiId)) return '';

    const lines = [LT_CONTEXT_HEADING];
    const together = lt.startTime ? formatListenDuration(Date.now() - lt.startTime) : '刚刚开始';

    // 累计账本：跨会话的总时长 + 一起听过的歌单（listen-together-stats.js）
    const stats = getStats(lt.aiId || aiId, lt);
    const cumulative = stats.totalMs > 0 ? formatListenDuration(stats.totalMs) : '';

    lines.push(`你正在和用户一起听歌，这是一个很好的互动时刻。本次已经听了 ${together}。`);
    if (cumulative) {
        const sessionNote = stats.sessions > 0 ? `，一共 ${stats.sessions + 1} 次一起听` : '';
        lines.push(`到现在为止，你和用户累计一起听了 ${cumulative}${sessionNote}。`);
    }

    // 一起听过哪些歌、各几次 —— 只给前 6 首，全给会挤掉真正重要的上下文
    if (stats.songs.length > 0) {
        const top = stats.songs.slice(0, 6)
            .map((s) => `《${s.title || '未知'}》${s.artist ? '-' + s.artist : ''} ×${s.count}`)
            .join('、');
        const more = stats.songs.length > 6 ? `，另外还有 ${stats.songs.length - 6} 首` : '';
        lines.push(`你们一起听过的歌：${top}${more}。`);
    }

    const song = state.currentSong;
    if (!song) {
        lines.push('现在没有在放歌。你可以推荐一首歌，或者聊聊音乐相关的话题。');
        return lines.join('\n');
    }

    lines.push(`当前播放：《${song.title || '未知歌曲'}》- ${song.artist || '未知歌手'}`);

    const playCount = getPlayCount(song.id);
    if (playCount > 0) {
        lines.push(`这首歌用户一共听过 ${playCount} 次${playCount >= 5 ? '，看起来是很偏爱的一首' : ''}。`);
    }
    const togetherCount = Number(stats.songs.find((s) => String(s.songId) === String(song.id))?.count) || 0;
    if (togetherCount > 1) {
        lines.push(`其中和你一起听过 ${togetherCount} 次。`);
    }

    const songsPlayed = Number(lt.songsPlayed) || 0;
    if (songsPlayed > 1) {
        lines.push(`本次一起听已经换过 ${songsPlayed} 首歌。`);
    }

    const duration = Number(state.duration) || 0;
    const currentTime = Number(state.currentTime) || 0;
    lines.push(`播放进度：${_fmtClock(currentTime)}${duration ? ` / ${_fmtClock(duration)}` : ''}${state.isPlaying === false ? '（已暂停）' : ''}`);

    // 实时歌词：只给"刚唱过 + 正在唱 + 马上要唱"这几句，
    // 整首倒给 AI 反而会让它对不上进度。
    const lyrics = _resolveLyrics(song, state);
    const idx = _activeLyricIndex(lyrics, currentTime);
    if (lyrics.length && idx >= 0) {
        const before = lyrics.slice(Math.max(0, idx - 2), idx).map((l) => l.text).filter(Boolean);
        const now = lyrics[idx]?.text || '';
        const after = lyrics.slice(idx + 1, idx + 3).map((l) => l.text).filter(Boolean);
        lines.push('这一刻的歌词：');
        before.forEach((t) => lines.push(`  ${t}`));
        if (now) lines.push(`  ${now}   （正在唱这句）`);
        after.forEach((t) => lines.push(`  ${t}`));
    } else if (lyrics.length) {
        lines.push(`这首歌马上要开始了，第一句是「${lyrics.find((l) => l.text)?.text || ''}」。`);
    }

    lines.push('');
    lines.push('你可以自然地聊：对这句歌词的感受、这首歌让你想到什么、推荐相似的歌，');
    lines.push('或者提议换一首。不要每句话都提"我们在一起听歌"，像真的在一起听那样说话就好。');

    return lines.join('\n');
}

/**
 * 把 pre 里旧的一起听段落删掉。
 * ai-service 每次发送前都会重新拼一份最新的。
 *
 * 两种格式都要能剪：
 *   1. 新版：prompt-manager 已经把每段包成 `<一起听开始>…<一起听结束>`，按标签整段切
 *   2. 老版：只有 `# 一起听（实时状态）` 一级标题，按「到下一个一级标题为止」切
 *      —— 这条路径要求段内不能出现 `#` 子标题，是标签化之前的历史约定
 */
export function stripListenTogetherBlock(text) {
    const src = String(text || '');
    if (!src) return '';

    const openTag = '<一起听开始>';
    const closeTag = '<一起听结束>';
    const tagStart = src.indexOf(openTag);
    if (tagStart !== -1) {
        const closeAt = src.indexOf(closeTag, tagStart + openTag.length);
        const tagEnd = closeAt === -1 ? src.length : closeAt + closeTag.length;
        const before = src.slice(0, tagStart).replace(/[\r\n]+$/, '');
        const after = src.slice(tagEnd).replace(/^[\r\n]+/, '');
        return [before, after].filter(Boolean).join('\n\n');
    }

    if (src.indexOf(LT_CONTEXT_HEADING) === -1) return src;
    const lines = src.split('\n');
    const out = [];
    let skipping = false;
    for (const line of lines) {
        if (line.trim() === LT_CONTEXT_HEADING) {
            skipping = true;
            continue;
        }
        if (skipping) {
            // 下一个一级标题开始就恢复
            if (/^#\s/.test(line)) skipping = false;
            else continue;
        }
        out.push(line);
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ---------------------------------------------------------------------------
// 暴露给 chat（不产生模块依赖）
// ---------------------------------------------------------------------------

if (typeof window !== 'undefined') {
    window.__musicListenTogether = {
        heading: LT_CONTEXT_HEADING,
        getContext: buildListenTogetherContext,
        isActive: isListeningWith,
        strip: stripListenTogetherBlock,
        findSong: findSongByTitle,
        getSession() {
            const lt = _readState()?.listenTogether;
            return lt?.active ? { ...lt } : null;
        },
    };
}
