/**
 * music-app · services/lyrics-service.js
 * LRC 解析 + 持久化 + 时间微调。
 *
 * 步骤 2:基础解析 + 持久化
 * 步骤 7:可视化微调 + 批量调整
 */

import { loadLyricsMap, saveLyricsMap, applyLyricsMap } from '../state.js';
import { defaultLyrics } from '../default-songs.js';

// ============================================================================
// LRC 解析
// ============================================================================

/**
 * 解析 LRC 文本 → 歌词数组
 * @param {string} lrcText - LRC 格式文本
 * @returns {Array<{time: number, text: string}>}
 *
 * 支持格式:
 *   [00:12.34]歌词行
 *   [00:12.34][00:45.67]多个时间戳(同一行)
 *   [00:12]无毫秒
 *   [ar:艺人] / [ti:标题] / [al:专辑] — 元数据,跳过
 */
export function parseLrcFile(lrcText) {
    if (!lrcText || typeof lrcText !== 'string') return [];
    const result = [];
    const lines = lrcText.split(/\r?\n/);

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        // 跳过元数据标签
        if (/^\[(ar|ti|al|by|offset|re|ve):/i.test(line)) continue;

        // 提取所有 [mm:ss.xx] 时间戳
        const timeMatches = [...line.matchAll(/\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g)];
        if (timeMatches.length === 0) continue;

        // 提取时间戳后的文本
        const text = line.replace(/\[\d{1,2}:\d{1,2}(?:[.:]\d{1,3})?\]/g, '').trim();
        if (!text) continue;

        for (const m of timeMatches) {
            const min = parseInt(m[1], 10) || 0;
            const sec = parseInt(m[2], 10) || 0;
            const msRaw = m[3] || '0';
            // 毫秒位补齐到 3 位 (e.g. "5" → 500, "50" → 500, "500" → 500)
            const ms = parseInt(msRaw.padEnd(3, '0').slice(0, 3), 10) || 0;
            const time = min * 60 + sec + ms / 1000;
            result.push({ time, text });
        }
    }

    // 按时间排序
    result.sort((a, b) => a.time - b.time);
    return result;
}

/**
 * 解析纯文本歌词(无时间戳)→ 默认按 5s/行 估算
 * @param {string} text
 * @returns {Array<{time: number, text: string}>}
 */
export function parsePlainText(text) {
    if (!text || typeof text !== 'string') return [];
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return lines.map((line, idx) => ({
        time: idx * 5,
        text: line,
    }));
}

/**
 * 智能解析:优先按 LRC 格式,失败回退纯文本
 */
export function parseLyrics(text) {
    const lrc = parseLrcFile(text);
    if (lrc.length > 0) return lrc;
    return parsePlainText(text);
}

// ============================================================================
// 持久化
// ============================================================================

/**
 * 读取所有自定义歌词
 * @returns {Object} { [songId]: lyricsArray }
 */
export function getAllLyrics() {
    return loadLyricsMap();
}

/**
 * 读取指定歌曲的自定义歌词
 */
export function getCustomLyrics(songId) {
    const map = loadLyricsMap();
    return map?.[songId] || null;
}

/**
 * 保存指定歌曲的自定义歌词
 */
export function setCustomLyrics(songId, lyrics) {
    const map = loadLyricsMap();
    map[songId] = Array.isArray(lyrics) ? lyrics : [];
    saveLyricsMap(map);
    return map;
}

/**
 * 清除指定歌曲的自定义歌词(恢复默认)
 */
export function clearCustomLyrics(songId) {
    const map = loadLyricsMap();
    if (map[songId]) {
        delete map[songId];
        saveLyricsMap(map);
    }
    return map;
}

/**
 * 拿歌曲的最终歌词(优先自定义,fallback defaultLyrics)
 */
export function getSongLyrics(song) {
    if (!song) return defaultLyrics;
    const custom = getCustomLyrics(song.id);
    if (Array.isArray(custom) && custom.length > 0) return custom;
    return song.lyrics || defaultLyrics;
}

// ============================================================================
// 时间微调(步骤 7 用)
// ============================================================================

/**
 * 对单条歌词微调时间
 * @param {Array} lyrics
 * @param {number} index
 * @param {number} deltaSec
 * @returns {Array} 新歌词数组(不修改原数组)
 */
export function shiftLyricsTime(lyrics, index, deltaSec) {
    if (!Array.isArray(lyrics)) return lyrics;
    return lyrics.map((line, i) => {
        if (i !== index) return line;
        const newTime = Math.max(0, (line.time || 0) + deltaSec);
        return { ...line, time: Math.round(newTime * 1000) / 1000 };
    });
}

/**
 * 批量调整时间偏移
 * @param {Array} lyrics
 * @param {number} deltaSec
 */
export function shiftAllLyricsTime(lyrics, deltaSec) {
    if (!Array.isArray(lyrics)) return lyrics;
    return lyrics.map((line) => {
        const newTime = Math.max(0, (line.time || 0) + deltaSec);
        return { ...line, time: Math.round(newTime * 1000) / 1000 };
    });
}

/**
 * 从某一句开始，之后所有歌词整体平移（原型「此句后」按钮）。
 * 用于「前半段对得上、后半段整体慢半拍」这种情况。
 * @param {Array} lyrics
 * @param {number} fromIndex - 含这一句
 * @param {number} deltaSec
 */
export function shiftLyricsFrom(lyrics, fromIndex, deltaSec) {
    if (!Array.isArray(lyrics)) return lyrics;
    const start = Number(fromIndex);
    if (!Number.isFinite(start)) return lyrics;
    return lyrics.map((line, i) => {
        if (i < start) return line;
        const newTime = Math.max(0, (line.time || 0) + deltaSec);
        return { ...line, time: Math.round(newTime * 1000) / 1000 };
    });
}

/**
 * 把歌词数组转成 LRC 文本
 */
export function toLrcText(lyrics, meta = {}) {
    if (!Array.isArray(lyrics)) return '';
    const lines = [];
    if (meta.title) lines.push(`[ti:${meta.title}]`);
    if (meta.artist) lines.push(`[ar:${meta.artist}]`);
    if (meta.album) lines.push(`[al:${meta.album}]`);
    for (const line of lyrics) {
        const t = line.time || 0;
        const min = Math.floor(t / 60);
        const sec = Math.floor(t % 60);
        const ms = Math.round((t % 1) * 1000);
        lines.push(`[${pad2(min)}:${pad2(sec)}.${pad3(ms)}]${line.text || ''}`);
    }
    return lines.join('\n');
}

function pad2(n) { return String(n).padStart(2, '0'); }
function pad3(n) { return String(n).padStart(3, '0'); }

// 暴露内部 helper 给 state.js 用
export { applyLyricsMap };
