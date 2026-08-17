/**
 * 手书 · 持久化
 *
 * 三张表:
 *
 *   | 表 | keyPath | 装什么 | 写入频率 |
 *   |---|---|---|---|
 *   | `hsProjects` | id | 一份手书企划:轨道 / 剪辑 / 脚本 / 舞台 / 上下文开关 | 高(编辑时防抖落盘) |
 *   | `hsLibrary`  | id | 单例:设置 / 用户自建效果预设 / 当前企划 id | 低 |
 *   | `hsAssets`   | id | 用户上传的背景图或字体(dataUrl) | 极低 |
 *
 * ★ 剪辑是**整份企划一起写**的,不像剧情树那样能只写新增的一条 ——
 *   因为拖动一个剪辑可能连带改动同轨其他剪辑的位置。
 *   代价是每次落盘序列化整份企划,所以 store 那边必须防抖(300ms),
 *   否则拖动过程中每一帧都在写 IndexedDB,手机上会明显卡。
 */

import {
    STORE_PROJECTS, STORE_LIBRARY, STORE_ASSETS, LIBRARY_KEY,
    DEFAULT_TRACK_IDS, CLIP_TYPE_IDS, MAX_PROJECT_MS, MIN_CLIP_MS,
    TITLE_MAX, DESC_MAX, SCRIPT_MAX, MAX_CLIPS,
    createDefaultSettings, createDefaultContextConfig, createDefaultStage,
    STAGE_BACKDROPS, STAGE_POSITIONS, TEXT_ALIGNS, ASPECTS,
} from '../constants.js';
import { makeId, toPlain, asArray, clamp, safeColor } from '../utils.js';
import { normalizeEffect } from '../presets/effects.js';
import { isTheme } from '../theme.js';

function dbOf(app) {
    return app?.toolkit?.db || null;
}

function pickId(value, list, fallback) {
    const v = String(value || '');
    return list.some((item) => item.id === v) ? v : fallback;
}

// ============================================================
// 归一化 —— 读出来的东西一律先过一遍
// ============================================================

export function normalizeClip(raw = {}) {
    const type = CLIP_TYPE_IDS.includes(String(raw.type)) ? String(raw.type) : 'type';
    const trackId = String(raw.trackId || DEFAULT_TRACK_IDS.text);
    return {
        id: String(raw.id || makeId('clip')),
        trackId,
        type,
        start: Math.max(0, Math.round(Number(raw.start) || 0)),
        duration: clamp(Math.round(Number(raw.duration) || MIN_CLIP_MS), MIN_CLIP_MS, MAX_PROJECT_MS),
        text: String(raw.text || ''),
        count: Math.max(0, Math.round(Number(raw.count) || 0)),
        from: String(raw.from || ''),
        to: String(raw.to || ''),
        effectId: String(raw.effectId || ''),
        backdrop: pickId(raw.backdrop, STAGE_BACKDROPS, ''),
        /** 单个剪辑可以覆盖舞台样式(字号 / 颜色 / 位置),空 = 跟随舞台 */
        style: normalizeClipStyle(raw.style),
    };
}

function normalizeClipStyle(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const out = {};
    if (Number.isFinite(Number(raw.fontSize))) out.fontSize = clamp(Number(raw.fontSize), 12, 96);
    if (Number.isFinite(Number(raw.letterSpacing))) out.letterSpacing = clamp(Number(raw.letterSpacing), -4, 24);
    const color = safeColor(raw.color);
    if (color) out.color = color;
    if (raw.position) out.position = pickId(raw.position, STAGE_POSITIONS, 'center');
    if (raw.align) out.align = pickId(raw.align, TEXT_ALIGNS, 'center');
    return Object.keys(out).length ? out : null;
}

export function normalizeStage(raw = {}) {
    const base = createDefaultStage();
    return {
        backdrop: pickId(raw.backdrop, STAGE_BACKDROPS, base.backdrop),
        aspect: pickId(raw.aspect, ASPECTS, base.aspect),
        position: pickId(raw.position, STAGE_POSITIONS, base.position),
        align: pickId(raw.align, TEXT_ALIGNS, base.align),
        fontSize: clamp(Number(raw.fontSize ?? base.fontSize), 12, 96),
        fontWeight: clamp(Number(raw.fontWeight ?? base.fontWeight), 300, 900),
        letterSpacing: clamp(Number(raw.letterSpacing ?? base.letterSpacing), -4, 24),
        lineHeight: clamp(Number(raw.lineHeight ?? base.lineHeight), 1, 3),
        color: safeColor(raw.color),
        caret: raw.caret !== false,
    };
}

function normalizeTracks(raw) {
    const list = asArray(raw).filter((t) => t && t.id);
    if (list.length) {
        return list.map((t) => ({
            id: String(t.id),
            kind: ['text', 'effect', 'bg'].includes(String(t.kind)) ? String(t.kind) : 'text',
            label: String(t.label || '轨道'),
            muted: t.muted === true,
            locked: t.locked === true,
        }));
    }
    return createDefaultTracks();
}

export function createDefaultTracks() {
    return [
        { id: DEFAULT_TRACK_IDS.text, kind: 'text', label: '文字轨', muted: false, locked: false },
        { id: DEFAULT_TRACK_IDS.effect, kind: 'effect', label: '效果轨', muted: false, locked: false },
        { id: DEFAULT_TRACK_IDS.bg, kind: 'bg', label: '背景轨', muted: false, locked: false },
    ];
}

export function normalizeProject(raw = {}) {
    const clips = asArray(raw.clips).slice(0, MAX_CLIPS).map(normalizeClip);
    return {
        id: String(raw.id || makeId('proj')),
        title: String(raw.title || '未命名手书').slice(0, TITLE_MAX),
        description: String(raw.description || '').slice(0, DESC_MAX),
        /** 作者名。空 = 渲染时现读 nook 的默认用户卡,不在这里冻结 */
        author: String(raw.author || ''),

        /** 封面:纯 CSS,存两个字段就够了 */
        cover: {
            backdrop: pickId(raw.cover?.backdrop, STAGE_BACKDROPS, 'ink'),
            headline: String(raw.cover?.headline || '').slice(0, 12),
        },

        tracks: normalizeTracks(raw.tracks),
        clips,
        stage: normalizeStage(raw.stage),

        /** 脚本原文。剪辑才是真相,脚本只是「上一次用来生成它们的那份输入」 */
        script: String(raw.script || '').slice(0, SCRIPT_MAX),
        /** 给 AI 的企划说明(主题 / 情绪 / 长度) */
        brief: String(raw.brief || '').slice(0, 500),

        /** 上下文分段开关与顺序,和 galgame / 情景一致 */
        contextConfig: { ...createDefaultContextConfig(), ...(raw.contextConfig || {}) },
        contextOrder: asArray(raw.contextOrder).map(String),
        customPrompts: asArray(raw.customPrompts).map(normalizeCustomPrompt),

        /** 播放次数,作品列表上显示 */
        plays: Math.max(0, Math.round(Number(raw.plays) || 0)),

        createdAt: Number(raw.createdAt) || Date.now(),
        updatedAt: Number(raw.updatedAt) || Date.now(),
    };
}

function normalizeCustomPrompt(raw = {}) {
    return {
        id: String(raw.id || makeId('cp')),
        title: String(raw.title || ''),
        content: String(raw.content || ''),
        enabled: raw.enabled !== false,
    };
}

export function normalizeLibrary(raw = {}) {
    const settings = { ...createDefaultSettings(), ...(raw.settings || {}) };
    if (!isTheme(settings.theme)) settings.theme = 'ink';
    return {
        id: LIBRARY_KEY,
        settings,
        /** 用户自建的效果预设 */
        effects: asArray(raw.effects).map((e) => normalizeEffect(e, { builtin: false })).filter((e) => e.id),
        activeProjectId: raw.activeProjectId ? String(raw.activeProjectId) : '',
        updatedAt: Number(raw.updatedAt) || Date.now(),
    };
}

export function normalizeAsset(raw = {}) {
    return {
        id: String(raw.id || makeId('asset')),
        kind: ['image', 'font'].includes(String(raw.kind)) ? String(raw.kind) : 'image',
        name: String(raw.name || '未命名素材').slice(0, 40),
        dataUrl: safeDataUrl(raw.dataUrl),
        createdAt: Number(raw.createdAt) || Date.now(),
    };
}

/** 只放行图片 / 字体的 data URL —— 别的协议不该有机会进 style 或 src */
function safeDataUrl(raw) {
    const url = String(raw ?? '').trim();
    if (!url) return '';
    if (/^data:image\/(png|jpe?g|gif|webp|avif);base64,/i.test(url)) return url;
    if (/^data:font\/(woff2?|ttf|otf);base64,/i.test(url)) return url;
    if (/^data:application\/(font-woff2?|x-font-ttf);base64,/i.test(url)) return url;
    return '';
}

// ============================================================
// 读写
// ============================================================

export async function loadLibrary(app) {
    const db = dbOf(app);
    if (!db) return normalizeLibrary({});
    try {
        const raw = await db.get(STORE_LIBRARY, LIBRARY_KEY);
        return normalizeLibrary(raw || {});
    } catch (err) {
        console.warn('[handwrite/db] 读取设置失败,用默认值', err);
        return normalizeLibrary({});
    }
}

export async function saveLibrary(app, library) {
    const db = dbOf(app);
    if (!db) return false;
    const plain = toPlain({ ...library, id: LIBRARY_KEY, updatedAt: Date.now() });
    if (!plain) return false;
    try {
        await db.put(STORE_LIBRARY, plain);
        return true;
    } catch (err) {
        console.warn('[handwrite/db] 保存设置失败', err);
        return false;
    }
}

export async function loadProjects(app) {
    const db = dbOf(app);
    if (!db) return [];
    try {
        const rows = await db.getAllRecords(STORE_PROJECTS);
        return asArray(rows)
            .map(normalizeProject)
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch (err) {
        console.warn('[handwrite/db] 读取作品失败', err);
        return [];
    }
}

export async function saveProject(app, project) {
    const db = dbOf(app);
    if (!db || !project?.id) return false;
    const plain = toPlain({ ...project, updatedAt: Date.now() });
    if (!plain) return false;
    try {
        await db.put(STORE_PROJECTS, plain);
        return true;
    } catch (err) {
        console.warn('[handwrite/db] 保存作品失败', err);
        return false;
    }
}

export async function deleteProject(app, projectId) {
    const db = dbOf(app);
    if (!db || !projectId) return false;
    try {
        await db.remove(STORE_PROJECTS, String(projectId));
        return true;
    } catch (err) {
        console.warn('[handwrite/db] 删除作品失败', err);
        return false;
    }
}

export async function loadAssets(app) {
    const db = dbOf(app);
    if (!db) return [];
    try {
        const rows = await db.getAllRecords(STORE_ASSETS);
        return asArray(rows).map(normalizeAsset).filter((a) => a.dataUrl);
    } catch (err) {
        console.warn('[handwrite/db] 读取素材失败', err);
        return [];
    }
}

export async function saveAsset(app, asset) {
    const db = dbOf(app);
    if (!db || !asset?.id) return false;
    const plain = toPlain(normalizeAsset(asset));
    if (!plain || !plain.dataUrl) return false;
    try {
        await db.put(STORE_ASSETS, plain);
        return true;
    } catch (err) {
        console.warn('[handwrite/db] 保存素材失败', err);
        return false;
    }
}

export async function deleteAsset(app, assetId) {
    const db = dbOf(app);
    if (!db || !assetId) return false;
    try {
        await db.remove(STORE_ASSETS, String(assetId));
        return true;
    } catch (err) {
        console.warn('[handwrite/db] 删除素材失败', err);
        return false;
    }
}
