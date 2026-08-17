/**
 * 专属世界 App 的数值、考核与首配协议。
 *
 * 这里不替任何 App 决定「境界」「职业生涯」有哪些字段；它只提供统一的
 * 校验、属性增减和概率结算。各 App 仍要在自己的 store 中保存数据，避免
 * 一个巨型全局表把修仙、末日、电竞、演员、爱豆的业务结构绑死。
 */

const DEFAULT_MIN_ATTRIBUTE = 0;
const DEFAULT_MAX_ATTRIBUTE = 999;

function finite(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

export function clampNumber(value, min = -Infinity, max = Infinity) {
    return Math.max(min, Math.min(max, finite(value)));
}

export function createExperienceProfileKey(appId, userOrId, worldOrId) {
    const app = String(appId || '').trim();
    const user = String(userOrId?.id || userOrId || '').trim();
    const world = String(worldOrId?.id || worldOrId || '').trim();
    return app && user && world ? `${app}::${user}::${world}` : null;
}

/**
 * schema:
 * [{ key, label, required=true, validate?(value, config), message? }]
 */
export function validateExperienceSetup(config = {}, schema = []) {
    const errors = [];
    for (const field of Array.isArray(schema) ? schema : []) {
        const key = String(field?.key || '').trim();
        if (!key) continue;
        const value = config?.[key];
        const missing = value == null
            || (typeof value === 'string' && value.trim() === '')
            || (Array.isArray(value) && value.length === 0);
        if (field.required !== false && missing) {
            errors.push({ key, message: field.message || `请填写${field.label || key}` });
            continue;
        }
        if (!missing && typeof field.validate === 'function') {
            const result = field.validate(value, config);
            if (result !== true) {
                errors.push({
                    key,
                    message: typeof result === 'string'
                        ? result
                        : (field.message || `${field.label || key}填写不正确`),
                });
            }
        }
    }
    return { ok: errors.length === 0, errors };
}

export function createExperienceSetupRecord(input = {}, options = {}) {
    const now = finite(options.now, Date.now());
    return {
        ...input,
        setupVersion: Math.max(1, Math.floor(finite(options.version, input.setupVersion || 1))),
        configured: true,
        configuredAt: finite(input.configuredAt, now),
        updatedAt: now,
    };
}

export function isExperienceSetupComplete(record, schema = [], minVersion = 1) {
    if (!record?.configured || finite(record.setupVersion) < finite(minVersion, 1)) return false;
    return validateExperienceSetup(record, schema).ok;
}

/**
 * 对属性做一批原子增减，返回新对象和可展示的变更明细，不修改原对象。
 *
 * deltas 可写成：
 *   { stamina: -2, focus: 1 }
 * 或：
 *   [{ key:'stamina', value:-2, reason:'连夜训练' }]
 */
export function applyAttributeDeltas(attributes = {}, deltas = {}, options = {}) {
    const min = finite(options.min, DEFAULT_MIN_ATTRIBUTE);
    const max = finite(options.max, DEFAULT_MAX_ATTRIBUTE);
    const next = { ...(attributes || {}) };
    const entries = Array.isArray(deltas)
        ? deltas
        : Object.entries(deltas || {}).map(([key, value]) => ({ key, value }));
    const changes = [];

    for (const entry of entries) {
        const key = String(entry?.key || '').trim();
        if (!key) continue;
        const before = finite(next[key]);
        const requested = finite(entry.value ?? entry.delta);
        const after = clampNumber(before + requested, min, max);
        next[key] = after;
        changes.push({
            key,
            before,
            requested,
            applied: after - before,
            after,
            reason: String(entry.reason || ''),
        });
    }
    return { attributes: next, changes };
}

function normalizeModifiers(modifiers = []) {
    return (Array.isArray(modifiers) ? modifiers : [])
        .map((modifier, index) => ({
            id: String(modifier?.id || `modifier-${index + 1}`),
            label: String(modifier?.label || modifier?.name || ''),
            value: finite(modifier?.value ?? modifier?.points),
            reason: String(modifier?.reason || ''),
        }))
        .filter((modifier) => modifier.value !== 0);
}

function outcomeGrade(success, chance) {
    if (success) {
        if (chance < 0.2) return 'miracle-win';
        if (chance >= 0.75) return 'decisive-win';
        return 'close-win';
    }
    if (chance >= 0.8) return 'collapse';
    if (chance < 0.2) return 'heavy-loss';
    return 'close-loss';
}

/**
 * 概率考核。
 *
 * - 分差通过 logistic 曲线转成胜率，不是简单的 score / total。
 * - upsetChance 给绝对劣势方保留「爆种」下限，同时也给强者保留翻车上限。
 * - volatility 只放大不确定区间，不会偷偷改双方原始属性。
 * - random 可注入，测试和剧情回放都能复现同一次结算。
 */
export function resolveContest(options = {}) {
    const playerBase = Math.max(0, finite(options.playerScore));
    const opponentBase = Math.max(0, finite(options.opponentScore));
    const modifiers = normalizeModifiers(options.modifiers);
    const modifierTotal = modifiers.reduce((sum, item) => sum + item.value, 0);
    const playerScore = Math.max(0, playerBase + modifierTotal);
    const opponentScore = opponentBase;
    const average = Math.max(1, (playerScore + opponentScore) / 2);
    const volatility = clampNumber(options.volatility ?? 0.15, 0, 1);
    const scale = Math.max(2, average * 0.22) * (1 + volatility);
    const logistic = 1 / (1 + Math.exp((opponentScore - playerScore) / scale));
    const upsetFloor = clampNumber(options.upsetChance ?? 0.04, 0, 0.25);
    const chance = clampNumber(upsetFloor + logistic * (1 - 2 * upsetFloor), upsetFloor, 1 - upsetFloor);
    const random = typeof options.random === 'function' ? options.random : Math.random;
    const roll = clampNumber(random(), 0, 0.999999999999);
    const success = roll < chance;

    return {
        success,
        grade: outcomeGrade(success, chance),
        chance,
        chancePercent: Math.round(chance * 10000) / 100,
        roll,
        playerScore,
        opponentScore,
        basePlayerScore: playerBase,
        modifierTotal,
        modifiers,
        upsetFloor,
        volatility,
    };
}

/**
 * 可复现的轻量随机源。把考核记录的 seed 存盘，重放剧情时结果不会变化。
 */
export function createSeededRandom(seed = Date.now()) {
    let state = (finite(seed, Date.now()) >>> 0) || 0x6d2b79f5;
    return () => {
        state += 0x6d2b79f5;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export default {
    createExperienceProfileKey,
    validateExperienceSetup,
    createExperienceSetupRecord,
    isExperienceSetupComplete,
    applyAttributeDeltas,
    resolveContest,
    createSeededRandom,
};
