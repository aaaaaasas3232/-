/**
 * 气泡机 · 持久化
 *
 * 两张表:
 *
 *   | 表 | keyPath | 装什么 | 写入频率 |
 *   |---|---|---|---|
 *   | `bbLibrary` | id | 设置 / 界面配色 / SVG 形状库(单例) | 低 |
 *   | `bbBubbles` | id | 一个气泡预设(含尾巴)                | 高(只写改动的那一个) |
 *
 * ── 为什么气泡单独一张表 ──────────────────────────────────────────
 *
 * 参考软件把所有主题塞在一个 localStorage key(`bubble-editor-themes`)里,
 * 每存一次都要把整个库重新序列化。气泡带 SVG 尾巴之后单条就能上 10KB,
 * 存到二十来套时每次调滑块都会卡一下 —— 而 `localStorage.setItem` 超配额
 * 抛的是**同步异常**,参考软件那里只有 `console.warn`,
 * 表现是「点保存没反应,而且下次打开少了几套」。
 *
 * 拆表之后:改哪个气泡只写那一条,写盘量恒定。
 */

import { STORE_LIBRARY, STORE_BUBBLES, LIBRARY_KEY, SVG_MAX_CHARS, createDefaultSettings } from '../constants.js';
import { makeId, toPlain, asArray, truncate } from '../utils.js';
import { createBubbleConfig } from '@/src/core/bubble-style.js';
import { sanitizeSvg } from '@/src/core/bubble-style.js';

function dbOf(app) {
    return app?.toolkit?.db || null;
}

// ============================================================
// 归一化
// ============================================================

export function normalizeBubble(raw = {}) {
    const cfg = createBubbleConfig(raw);
    cfg.id = String(raw.id || makeId('bub'));
    cfg.name = String(raw.name || '未命名气泡').slice(0, 24);
    cfg.createdAt = Number(raw.createdAt) || Date.now();
    cfg.updatedAt = Number(raw.updatedAt) || Date.now();
    /** 被情景聊天引用过的次数由那边算,这里只存一个「收藏」标记 */
    cfg.starred = raw.starred === true;
    return cfg;
}

/**
 * SVG 形状库的一条。
 *
 * ★ 存进来的一定是**消毒过**的 SVG。在写入这一层拦住,而不是渲染时再消毒:
 *   渲染点有五六处(库缩略图 / 尾巴预览 / 气泡预览 / 情景聊天里的消息 …),
 *   靠「每处都记得消毒」维持安全,漏一处就是一个 XSS。
 */
export function normalizeShape(raw = {}) {
    const svg = sanitizeSvg(String(raw.svg || '').slice(0, SVG_MAX_CHARS));
    return {
        id: String(raw.id || makeId('svg')),
        name: String(raw.name || '未命名形状').slice(0, 20),
        svg,
        createdAt: Number(raw.createdAt) || Date.now(),
    };
}

export function normalizeLibrary(raw = {}) {
    return {
        id: LIBRARY_KEY,
        settings: { ...createDefaultSettings(), ...(raw.settings || {}) },
        shapes: asArray(raw.shapes).map(normalizeShape).filter((s) => s.svg),
        /** 上次编辑到哪个气泡 —— 重开时接着改,不用再找一遍 */
        activeBubbleId: raw.activeBubbleId ? String(raw.activeBubbleId) : '',
        /** 是否已经灌过一次内置预设 */
        seeded: raw.seeded === true,
        updatedAt: Number(raw.updatedAt) || Date.now(),
    };
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
        console.warn('[bubble-maker/db] 读取设置失败,用默认值', err);
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
        console.warn('[bubble-maker/db] 保存设置失败', err);
        return false;
    }
}

export async function loadBubbles(app) {
    const db = dbOf(app);
    if (!db) return [];
    try {
        const rows = await db.getAllRecords(STORE_BUBBLES);
        return asArray(rows)
            .map(normalizeBubble)
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch (err) {
        console.warn('[bubble-maker/db] 读取气泡库失败', err);
        return [];
    }
}

export async function saveBubble(app, bubble) {
    const db = dbOf(app);
    if (!db || !bubble?.id) return false;
    const plain = toPlain({ ...bubble, updatedAt: Date.now() });
    if (!plain) return false;
    try {
        await db.put(STORE_BUBBLES, plain);
        return true;
    } catch (err) {
        console.warn('[bubble-maker/db] 保存气泡失败', err);
        return false;
    }
}

export async function deleteBubble(app, id) {
    const db = dbOf(app);
    if (!db || !id) return false;
    try {
        await db.remove(STORE_BUBBLES, String(id));
        return true;
    } catch (err) {
        console.warn('[bubble-maker/db] 删除气泡失败', err);
        return false;
    }
}

/**
 * 按 id 直接读一个气泡(不经过 store)。
 *
 * ★ 这是给**情景聊天**留的口子:它需要按 id 取一套气泡,
 *   而它不该知道气泡机内部怎么组织数据。对外入口是
 *   `appConfig.services.getBubble`(见 index.js)。
 */
export async function getBubble(app, id) {
    const db = dbOf(app);
    if (!db || !id) return null;
    try {
        const raw = await db.get(STORE_BUBBLES, String(id));
        return raw ? normalizeBubble(raw) : null;
    } catch (err) {
        console.warn('[bubble-maker/db] 读单个气泡失败', err);
        return null;
    }
}

/** 给外部用的摘要列表(不含尾巴细节,列表页不需要) */
export function briefOf(bubble) {
    return {
        id: bubble.id,
        name: bubble.name,
        side: bubble.side,
        bgColor: bubble.bgColor,
        textColor: bubble.textColor,
        hasTail: asArray(bubble.tails).some((t) => t.enabled),
        updatedAt: bubble.updatedAt,
        preview: truncate(bubble.name, 12),
    };
}
