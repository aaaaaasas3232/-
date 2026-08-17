/**
 * settings-sdk · K 链记忆(murmur 用)
 *
 * ── 这是第二次做 K 链 ─────────────────────────────────────────────
 *
 * 第一版(v0.61~v0.63)寄生在 `rollingSummaries` 里,2026-08-09 因为一批严重 bug
 * 被整个删掉(残留见 `chat-window-config.js` 的文件头)。那一版坏在三处:
 *
 *   1. **配置和状态混在一个对象里**。`enabled / style / kMergeSize / maxChainLength`
 *      跟链条内容存在同一个 `rollingConfig` 下,改一个设置要整体重写,
 *      并发写(压缩后台跑、用户同时改设置)会把对方的结果覆盖掉。
 *   2. **不分 mode**。日历模式和故事模式共用一条链,两边的剧情互相污染。
 *   3. **压缩是一次独立的 API 调用**,失败了没人知道,而且翻倍花钱。
 *
 * 这一版:
 *
 *   - 配置(enabled / windowSize / keepVersions)和状态(current / history / lastAt)**分开**,
 *     状态再按 mode 分槽,互不干扰
 *   - 压缩**不单独调 API** —— 搭在正常回复那一次上(见 chat-app 的 `k-chain-service.js`)
 *   - 本文件只管**存**:不产出任何 prompt 文本、不数回合。
 *     那两件事依赖 chat-app 的回合口径(`context-rounds.js`),放在这里就成了跨层依赖。
 *
 * ── 数据位置 ──────────────────────────────────────────────────────
 *
 *   aiPerson.socialProfiles.chat.kChain = {
 *     enabled: false,            // 默认关 —— 用户被上一版坑过,不替他做主
 *     windowSize: 5,             // 攒几个回合压一次
 *     keepVersions: 5,           // 历史版本留几份(可回看/回滚)
 *     slots: {
 *       calendar: { current: {index, content, rounds, updatedAt}, history: [...], lastAt },
 *       story:    { ... },
 *     },
 *   }
 */

const MODES = Object.freeze(['calendar', 'story']);

const DEFAULT_CONFIG = Object.freeze({
    enabled: false,
    windowSize: 5,
    keepVersions: 5,
});

function emptySlot() {
    return {
        current: { index: 0, content: '', rounds: 0, updatedAt: 0 },
        history: [],
        /** 上次压缩落在哪一刻 —— 「之后过了几个回合」按它算 */
        lastAt: 0,
    };
}

function normalizeMode(mode) {
    return mode === 'story' ? 'story' : 'calendar';
}

function normalizeSlot(raw) {
    const base = emptySlot();
    if (!raw || typeof raw !== 'object') return base;
    return {
        current: {
            index: Number(raw.current?.index) || 0,
            content: String(raw.current?.content || ''),
            rounds: Number(raw.current?.rounds) || 0,
            updatedAt: Number(raw.current?.updatedAt) || 0,
        },
        history: Array.isArray(raw.history)
            ? raw.history.map((h) => ({
                index: Number(h?.index) || 0,
                content: String(h?.content || ''),
                rounds: Number(h?.rounds) || 0,
                createdAt: Number(h?.createdAt) || 0,
            })).filter((h) => h.content)
            : [],
        lastAt: Number(raw.lastAt) || 0,
    };
}

function clampInt(value, min, max, fallback) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

export function createKChainApi(sdk) {
    if (!sdk || !sdk.aiPersons) {
        console.warn('[k-chain] sdk.aiPersons 缺失,API 返回空操作');
        const noop = {
            getConfig: () => ({ ...DEFAULT_CONFIG }),
            setConfig: async () => ({ ...DEFAULT_CONFIG }),
            getSlot: () => emptySlot(),
            applySummary: async () => null,
            editCurrent: async () => null,
            rollback: async () => null,
            reset: async () => null,
        };
        return noop;
    }

    const _person = (aiPersonId) => (aiPersonId ? sdk.aiPersons.get(aiPersonId) || null : null);

    const _readRaw = (aiPersonId) => {
        const person = _person(aiPersonId);
        const raw = person?.socialProfiles?.chat?.kChain;
        return raw && typeof raw === 'object' ? raw : null;
    };

    /**
     * 落盘。
     *
     * ★ 只写 kChain 这一支,`socialProfiles.chat` 下的其他字段(rollingConfig / patSetting …)
     *   靠展开原对象保留 —— 直接写 `{ chat: { kChain } }` 会把兄弟字段冲掉。
     */
    const _write = async (aiPersonId, nextKChain) => {
        const person = _person(aiPersonId);
        if (!person) return null;
        await sdk.aiPersons.update(aiPersonId, {
            socialProfiles: {
                ...person.socialProfiles,
                chat: {
                    ...(person.socialProfiles?.chat || {}),
                    kChain: nextKChain,
                },
            },
        });
        return nextKChain;
    };

    /** 读出完整结构(配置 + 全部槽),补齐缺省 */
    const _readAll = (aiPersonId) => {
        const raw = _readRaw(aiPersonId) || {};
        const slots = {};
        for (const m of MODES) slots[m] = normalizeSlot(raw.slots?.[m]);
        return {
            enabled: raw.enabled === true,
            windowSize: clampInt(raw.windowSize, 2, 50, DEFAULT_CONFIG.windowSize),
            keepVersions: clampInt(raw.keepVersions, 0, 20, DEFAULT_CONFIG.keepVersions),
            slots,
        };
    };

    return {
        MODES,
        DEFAULT_CONFIG,

        /** 只要配置那三项(UI 读它) */
        getConfig(aiPersonId) {
            const all = _readAll(aiPersonId);
            return { enabled: all.enabled, windowSize: all.windowSize, keepVersions: all.keepVersions };
        },

        async setConfig(aiPersonId, patch = {}) {
            const all = _readAll(aiPersonId);
            const next = {
                ...all,
                enabled: patch.enabled == null ? all.enabled : patch.enabled === true,
                windowSize: patch.windowSize == null ? all.windowSize : clampInt(patch.windowSize, 2, 50, all.windowSize),
                keepVersions: patch.keepVersions == null ? all.keepVersions : clampInt(patch.keepVersions, 0, 20, all.keepVersions),
            };
            await _write(aiPersonId, next);
            return { enabled: next.enabled, windowSize: next.windowSize, keepVersions: next.keepVersions };
        },

        /** 某个 mode 的链条状态 */
        getSlot(aiPersonId, mode) {
            return _readAll(aiPersonId).slots[normalizeMode(mode)];
        },

        /**
         * 收下一份新摘要。
         *
         * 这是**迭代式增量压缩**的落点:新摘要本身已经把上一版吃进去了
         * (生成指令里会把旧 K 一起喂给 AI),所以这里直接顶替 current,
         * 旧的挪进 history 留档,不做拼接。
         *
         * ★ `lastAt` 必须**盖过这一轮 AI 消息的时间戳**,不能简单用 `Date.now()`。
         *   摘要是在「AI 回复解析完、消息还没写进库」那一刻产生的,而那些消息的
         *   timestamp 已经定下来了(`segmentsToMessages` 里就 stamp 好了)。
         *   用 `Date.now()` 的话它们会落在 lastAt **之后**,于是刚被压缩进去的这一轮
         *   下一次又被数成「待压缩」—— 计数永远差一,触发间隔从 5 轮变成 4 轮。
         *   调用方把 `已知的最大消息时间戳 + 1` 传进来。
         */
        async applySummary(aiPersonId, mode, content, rounds = 0, lastAt = 0) {
            const text = String(content || '').trim();
            if (!text) return null;
            const all = _readAll(aiPersonId);
            const key = normalizeMode(mode);
            const slot = all.slots[key];
            const now = Date.now();
            const cutoff = Math.max(Number(lastAt) || 0, now);

            const history = slot.current.content
                ? [{ ...slot.current, createdAt: slot.current.updatedAt || now }, ...slot.history]
                : slot.history;

            all.slots[key] = {
                current: {
                    index: (Number(slot.current.index) || 0) + 1,
                    content: text,
                    rounds: Number(rounds) || 0,
                    updatedAt: now,
                },
                history: all.keepVersions > 0 ? history.slice(0, all.keepVersions) : [],
                lastAt: cutoff,
            };
            await _write(aiPersonId, all);
            return all.slots[key].current;
        },

        /** 用户手改当前这一版(不动 index、不进 history —— 改的是同一版) */
        async editCurrent(aiPersonId, mode, content) {
            const all = _readAll(aiPersonId);
            const key = normalizeMode(mode);
            all.slots[key].current = {
                ...all.slots[key].current,
                content: String(content || ''),
                updatedAt: Date.now(),
            };
            await _write(aiPersonId, all);
            return all.slots[key].current;
        },

        /** 回滚到某个历史版本(它重新成为 current) */
        async rollback(aiPersonId, mode, index) {
            const all = _readAll(aiPersonId);
            const key = normalizeMode(mode);
            const slot = all.slots[key];
            const hit = slot.history.find((h) => Number(h.index) === Number(index));
            if (!hit) return null;
            all.slots[key] = {
                current: { index: hit.index, content: hit.content, rounds: hit.rounds, updatedAt: Date.now() },
                history: slot.history.filter((h) => Number(h.index) !== Number(index)),
                lastAt: slot.lastAt,
            };
            await _write(aiPersonId, all);
            return all.slots[key].current;
        },

        /**
         * 清空某个 mode 的链条。
         *
         * `lastAt` 归零 = 回合从头数起。不这么做的话,清空之后要等
         * 「距离上次压缩满 windowSize 轮」才会重新生成,用户会以为清空把功能也关了。
         */
        async reset(aiPersonId, mode) {
            const all = _readAll(aiPersonId);
            all.slots[normalizeMode(mode)] = emptySlot();
            await _write(aiPersonId, all);
            return emptySlot();
        },
    };
}

export default createKChainApi;
