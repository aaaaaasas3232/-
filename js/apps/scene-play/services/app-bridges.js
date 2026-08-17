/**
 * 情景聊天 · 读其他 App 的东西
 *
 * 两条路:
 *   气泡机  → 拿气泡配置和 SVG 形状库,渲染对话体
 *   四叶草  → 拿小剧场,把「已经演过的一场」接着往下演
 *
 * ── 为什么走 invokeService 而不是 import ──────────────────────────
 *
 * `externalAppRegistry.invokeService(appId, name, payload)` 是框架给的
 * **唯一**跨 App 调用口。直接 import 对方的内部模块有两个后果:
 *   1. 生命周期绑死 —— 对方 App 出错,这个 App 连注册都失败
 *   2. dev server 的 `?t=` 会给你另一个模块实例,读到的是另一份内存状态
 *
 * `invokeService` 找不到 App 或找不到方法时返回 `Promise.resolve(null)`,
 * **不抛**。所以下面每一处都要处理「对方不在」的情况,
 * 而不是假设它一定在(用户可能把气泡机卸载了)。
 */

import { externalAppRegistry } from '@/src/core/app-registry.js';
import { createBubbleConfig } from '@/src/core/bubble-style.js';
import { asArray, truncate } from '../utils.js';

const BUBBLE_APP = 'bubble-maker';
const SHOP_APP = 'shop';

function callService(appId, name, payload) {
    try {
        return externalAppRegistry.invokeService(appId, name, payload);
    } catch (err) {
        console.warn(`[scene-play/bridge] 调 ${appId}.${name} 失败`, err);
        return Promise.resolve(null);
    }
}

// ============================================================
// 气泡机
// ============================================================

export function hasBubbleApp() {
    return Boolean(externalAppRegistry.getApp(BUBBLE_APP));
}

/** 气泡选择器用的摘要列表 */
export async function listBubbles() {
    const rows = await callService(BUBBLE_APP, 'listBubbles');
    return asArray(rows);
}

/** 按 id 取完整气泡配置(含尾巴) */
export async function getBubble(id) {
    if (!id) return null;
    const raw = await callService(BUBBLE_APP, 'getBubble', { id });
    return raw ? createBubbleConfig(raw) : null;
}

/**
 * SVG 形状库。
 *
 * 尾巴里存的是 `shapeId`,渲染时要拿这张表去查。整份拉过来 ——
 * 形状封顶 60 个,而每渲染一条消息去查一次会把渲染变成异步的。
 */
export async function getShapes() {
    const rows = await callService(BUBBLE_APP, 'getShapes');
    return asArray(rows);
}

/**
 * 主题真正要用的两套气泡。
 *
 * 取不到时返回 null,由调用方回落到内置默认气泡 —— **不要**在这里造一个
 * 兜底配置,那样用户「气泡没生效」时会以为是自己选错了,
 * 而实际上是气泡机被卸载了。回落发生在渲染层,并且 UI 上会标出来。
 */
export async function loadThemeBubbles(theme) {
    const [left, right, shapes] = await Promise.all([
        getBubble(theme?.bubbleLeftId),
        getBubble(theme?.bubbleRightId),
        getShapes(),
    ]);
    return { left, right, shapes };
}

// ============================================================
// 四叶草小剧场
// ============================================================

export function hasShopApp() {
    return Boolean(externalAppRegistry.getApp(SHOP_APP));
}

/**
 * 当前档下的小剧场摘要。
 *
 * 四叶草那边刻意只给摘要(不含全部台词),完整台词要按 id 单独取 ——
 * 列表里一次拉十几场全文会很沉。
 */
export async function listTheaters() {
    const rows = await callService(SHOP_APP, 'listTheaters');
    return asArray(rows).map((t) => ({
        id: String(t.id),
        title: String(t.title || '未命名'),
        summary: String(t.summary || ''),
        occasion: String(t.occasion || ''),
        createdAt: Number(t.createdAt) || 0,
    }));
}

/**
 * 取一整场戏。
 *
 * 四叶草存的是**结构化台词**(`scenes[].lines[] = {speaker, text}`)
 * 加上带真实 `aiPersonId` 的参演者 —— 这是它当初特意留的口子
 * (AGENTS2 §16.8),所以这边不需要再解析一遍「谁说的」。
 */
export async function getTheater(id) {
    if (!id) return null;
    const raw = await callService(SHOP_APP, 'getTheater', { id });
    if (!raw) return null;
    return {
        id: String(raw.id),
        title: String(raw.title || '未命名'),
        summary: String(raw.summary || ''),
        closing: String(raw.closing || ''),
        participants: asArray(raw.participants).map((p) => ({
            id: String(p?.id || ''),
            name: String(p?.name || ''),
        })).filter((p) => p.name),
        scenes: asArray(raw.scenes).map((s) => ({
            place: String(s?.place || ''),
            narration: String(s?.narration || ''),
            lines: asArray(s?.lines).map((l) => ({
                speaker: String(l?.speaker || ''),
                text: String(l?.text || ''),
            })).filter((l) => l.text),
        })),
    };
}

/**
 * 把一场戏摊平成给 AI 看的「前情」。
 *
 * ★ 给全文而不是概要。这里和四叶草注册给 murmur 的那段是**两回事**:
 *   murmur 里塞全文会把用户真正的聊天记录挤掉,所以那边只给概要;
 *   而这个 App 的整件事就是「接着这一场往下演」,少了台词原文,
 *   AI 接出来的语气和称呼会全对不上。
 */
export function describeTheater(theater) {
    if (!theater) return '';
    const cast = theater.participants.map((p) => p.name).filter(Boolean).join('、');
    const body = theater.scenes.map((s, i) => {
        const head = `第${i + 1}场${s.place ? ` · ${s.place}` : ''}`;
        const lines = s.lines.map((l) => `${l.speaker}:${l.text}`).join('\n');
        return [head, s.narration, lines].filter(Boolean).join('\n');
    }).join('\n\n');

    return [
        theater.title ? `《${theater.title}》` : '',
        cast ? `在场的人:${cast}` : '',
        body,
        theater.closing,
        '\n注意: 以上是**已经发生过的事**。接着往下演,不要复述,也不要当成还没发生。',
    ].filter(Boolean).join('\n');
}

/**
 * 把一场戏摊平成一串消息,直接落进存档。
 *
 * 用户在「情景」里选「接住这一场」时走这条 —— 比只当上下文更直观:
 * 打开存档就能看到之前那些台词,而不是一个空白页面加一段看不见的 prompt。
 */
export function theaterToMessages(theater, castNameToRole) {
    if (!theater) return [];
    const out = [];
    for (const scene of theater.scenes) {
        if (scene.narration) {
            out.push({ role: 'system', text: scene.place ? `【${scene.place}】${scene.narration}` : scene.narration });
        }
        for (const line of scene.lines) {
            const role = typeof castNameToRole === 'function' ? castNameToRole(line.speaker) : 'ai';
            out.push({ role: role === 'user' ? 'user' : 'ai', speaker: line.speaker, text: line.text });
        }
    }
    if (theater.closing) out.push({ role: 'system', text: theater.closing });
    return out;
}

/** 列表里显示一行摘要 */
export function theaterBrief(theater) {
    return {
        id: theater.id,
        title: theater.title,
        line: truncate(theater.summary, 46),
    };
}
