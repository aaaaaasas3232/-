/**
 * 设置 App · 状态规范化（normalize）· 非外观部分
 *
 * 把 IndexedDB 读出来的记录（可能是旧版本、缺字段、类型错误）转成「完整且可信任」的对象。
 * 单独抽出文件是为了让 methods.js 保持薄（只关心业务）。
 *
 * 注意：normalizeTheme 已经迁到 appearance-general/theme-bridge.js 附近的 normalize 实现里，
 * hydrate.js 直接通过 initialAppearance + 字段合并做规范化，不需要单独的 normalizeTheme。
 */

import { DEFAULT_WORLD, DEFAULT_USER, DEFAULT_AI, DEFAULT_API } from '../defaults.js';

function asArray(value) {
    return Array.isArray(value) ? value.slice() : [];
}

export function normalizeWorld(raw) {
    const base = { ...DEFAULT_WORLD, keyPoints: [] };
    if (!raw || typeof raw !== 'object') return base;
    return {
        ...base,
        ...raw,
        keyPoints: asArray(raw.keyPoints),
    };
}

export function normalizeUser(raw) {
    const base = { ...DEFAULT_USER, preferences: [] };
    if (!raw || typeof raw !== 'object') return base;
    return {
        ...base,
        ...raw,
        preferences: asArray(raw.preferences),
    };
}

export function normalizeAI(raw) {
    const base = { ...DEFAULT_AI, rules: [] };
    if (!raw || typeof raw !== 'object') return base;
    return {
        ...base,
        ...raw,
        rules: asArray(raw.rules),
    };
}

export function normalizeApi(raw) {
    const base = { ...DEFAULT_API };
    if (!raw || typeof raw !== 'object') return base;
    return {
        ...base,
        ...raw,
        temperature: Number(raw.temperature) || DEFAULT_API.temperature,
    };
}