/**
 * 情景聊天 · 持久化
 *
 * 四张表:
 *
 *   | 表 | keyPath | 装什么 | 写入频率 |
 *   |---|---|---|---|
 *   | `spLibrary`  | id | 设置 / 配色 / 分类 / 正则库 / 外观主题 / 文案库(单例) | 低 |
 *   | `spScenes`   | id | 一个情景的设定(不含消息)                            | 中 |
 *   | `spSaves`    | id | 一个存档的元信息(不含消息)                          | 中 |
 *   | `spMessages` | id | 单条消息                                             | 高(只写新增那一条) |
 *
 * ── 为什么消息单独一张表 ──────────────────────────────────────────
 *
 * 一个存档聊到两百条时,把消息数组塞在存档记录里意味着**每发一条消息都要
 * 重新序列化前 199 条**。拆表之后写盘量恒定,和聊了多久无关。
 *
 * 而且「存档」这件事本身也变便宜了:另存为新档只要复制一遍消息记录,
 * 不需要动情景本体。
 */

import {
    STORE_LIBRARY, STORE_SCENES, STORE_SAVES, STORE_MESSAGES, LIBRARY_KEY,
    MODE_IDS, MESSAGE_MAX_CHARS, createDefaultSettings, createDefaultContextConfig,
} from '../constants.js';
import { makeId, toPlain, asArray, isSameId, safeImageUrl, clamp, truncate } from '../utils.js';
import { normalizeRule, BUILTIN_RULES } from './regex-engine.js';
import { BUILTIN_CLIPS, BUILTIN_CLIPS_VERSION } from './clip-library.js';

/**
 * ★ 内置文案的正文搬去了 `clip-library.js`(那儿有「怎么加一条文案」的说明)。
 *   这里原样转出去,是为了让 `import { BUILTIN_CLIPS } from './db.js'` 这种
 *   老写法继续能用 —— 搬文件不该顺手弄断别人的 import。
 */
export { BUILTIN_CLIPS, BUILTIN_CLIPS_VERSION };

function dbOf(app) {
    return app?.toolkit?.db || null;
}

// ============================================================
// 归一化
// ============================================================

export function normalizeScene(raw = {}) {
    const mode = MODE_IDS.includes(raw.mode) ? raw.mode : 'dialogue';
    return {
        id: String(raw.id || makeId('scene')),
        categoryId: String(raw.categoryId || ''),
        title: String(raw.title || '新情景').slice(0, 40),
        mode,

        /** 情景文案本体 —— 这是最重要的一段,直接进 prompt */
        setting: String(raw.setting || ''),
        /** 想往哪儿走(可选) */
        aim: String(raw.aim || ''),
        timeText: String(raw.timeText || ''),

        // 绑定的 nook 实体。空 = 跟随当前激活项(每次读都现算,不缓存)
        worldId: raw.worldId ? String(raw.worldId) : '',
        userPersonaId: raw.userPersonaId ? String(raw.userPersonaId) : '',
        locationId: raw.locationId ? String(raw.locationId) : '',
        castIds: asArray(raw.castIds).map(String),
        /** 每个角色在这个情景下的额外设定,key = aiPersonId */
        castNotes: plainMap(raw.castNotes),

        /** 用哪套外观主题 */
        themeId: String(raw.themeId || ''),
        /** 启用哪几条正则 */
        regexIds: asArray(raw.regexIds).map(String),
        /** 引用了文案库里的哪几条 */
        clipIds: asArray(raw.clipIds).map(String),

        /** 从四叶草接过来的小剧场 id */
        theaterId: String(raw.theaterId || ''),

        notes: asArray(raw.notes).map(normalizeNote),
        contextConfig: { ...createDefaultContextConfig(), ...(raw.contextConfig || {}) },
        contextOrder: asArray(raw.contextOrder).map(String),

        /** 上次打开的是哪个存档 */
        activeSaveId: String(raw.activeSaveId || ''),

        createdAt: Number(raw.createdAt) || Date.now(),
        updatedAt: Number(raw.updatedAt) || Date.now(),
    };
}

function normalizeNote(raw = {}) {
    return {
        id: String(raw.id || makeId('note')),
        title: String(raw.title || '未命名').slice(0, 24),
        content: String(raw.content || ''),
        active: raw.active !== false,
        createdAt: Number(raw.createdAt) || Date.now(),
    };
}

function plainMap(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const [key, value] of Object.entries(raw)) {
        if (!key) continue;
        out[String(key)] = String(value ?? '');
    }
    return out;
}

export function normalizeSave(raw = {}) {
    return {
        id: String(raw.id || makeId('save')),
        sceneId: String(raw.sceneId || ''),
        name: String(raw.name || '新存档').slice(0, 30),
        summary: String(raw.summary || '').slice(0, 120),
        /** 列表里显示最后一句,不用把消息全读出来 */
        lastLine: String(raw.lastLine || '').slice(0, 60),
        messageCount: Number(raw.messageCount) || 0,
        createdAt: Number(raw.createdAt) || Date.now(),
        updatedAt: Number(raw.updatedAt) || Date.now(),
    };
}

export function normalizeMessage(raw = {}, saveId = '') {
    const role = ['user', 'ai', 'system'].includes(raw.role) ? raw.role : 'ai';
    return {
        id: String(raw.id || makeId('msg')),
        saveId: String(raw.saveId || saveId),
        role,
        /** 说话人名字。旁白和用户消息可以为空 */
        speaker: String(raw.speaker || '').slice(0, 24),
        text: String(raw.text || '').slice(0, MESSAGE_MAX_CHARS),
        /** 单调递增,决定顺序。**不靠 createdAt** —— 同一毫秒插两条时会乱 */
        seq: Number(raw.seq) || 0,
        createdAt: Number(raw.createdAt) || Date.now(),
        editedAt: Number(raw.editedAt) || 0,
    };
}

/** 一套外观主题(背景 + 气泡 + 头像 + 名字 + 时间戳 + 卡片) */
export function normalizeTheme(raw = {}) {
    return {
        id: String(raw.id || makeId('theme')),
        name: String(raw.name || '未命名外观').slice(0, 20),

        background: {
            kind: raw.background?.kind === 'image' ? 'image' : 'color',
            color: String(raw.background?.color || '').trim(),
            imageUrl: safeImageUrl(raw.background?.imageUrl),
            /** 背景压暗 / 提亮,-40 ~ 40 */
            dim: clamp(raw.background?.dim ?? 0, -40, 40),
            blur: clamp(raw.background?.blur ?? 0, 0, 20),
        },

        /** 引用气泡机里的两套气泡 */
        bubbleLeftId: String(raw.bubbleLeftId || ''),
        bubbleRightId: String(raw.bubbleRightId || ''),

        avatar: {
            showLeft: raw.avatar?.showLeft !== false,
            showRight: raw.avatar?.showRight === true,
            shape: ['circle', 'squircle', 'square'].includes(raw.avatar?.shape) ? raw.avatar.shape : 'circle',
            size: clamp(raw.avatar?.size ?? 34, 20, 56),
        },

        name: {
            position: ['none', 'above', 'inline'].includes(raw.name?.position) ? raw.name.position : 'above',
        },

        time: {
            position: ['none', 'above', 'below', 'inside'].includes(raw.time?.position) ? raw.time.position : 'none',
        },

        density: ['compact', 'cozy', 'loose'].includes(raw.density) ? raw.density : 'cozy',

        /** 日记体 / 博客体的轻量调整 */
        card: {
            glass: raw.card?.glass === true,
            border: ['none', 'hairline', 'solid', 'dashed'].includes(raw.card?.border) ? raw.card.border : 'hairline',
            radius: clamp(raw.card?.radius ?? 18, 0, 40),
            /** 卡片底色。留空 = 跟主题走 */
            tint: String(raw.card?.tint || '').trim(),
        },

        /** 用户直接粘进来的 `--spc-*` 覆盖(卡片体裁的细调) */
        cardVars: plainMap(raw.cardVars),

        builtin: raw.builtin === true,
        createdAt: Number(raw.createdAt) || Date.now(),
    };
}

/** 情景分类 */
export function normalizeCategory(raw = {}) {
    return {
        id: String(raw.id || makeId('cat')),
        name: String(raw.name || '未命名分类').slice(0, 16),
        order: Number(raw.order) || 0,
        createdAt: Number(raw.createdAt) || Date.now(),
    };
}

/** 情景文案库的一条 */
export function normalizeClip(raw = {}) {
    return {
        id: String(raw.id || makeId('clip')),
        title: String(raw.title || '未命名文案').slice(0, 24),
        content: String(raw.content || ''),
        tag: String(raw.tag || '').slice(0, 12),
        builtin: raw.builtin === true,
        createdAt: Number(raw.createdAt) || Date.now(),
    };
}

export function normalizeLibrary(raw = {}) {
    return {
        id: LIBRARY_KEY,
        settings: { ...createDefaultSettings(), ...(raw.settings || {}) },
        categories: asArray(raw.categories).map(normalizeCategory).sort((a, b) => a.order - b.order),
        themes: asArray(raw.themes).map(normalizeTheme),
        rules: asArray(raw.rules).map(normalizeRule),
        clips: asArray(raw.clips).map(normalizeClip),
        activeSceneId: String(raw.activeSceneId || ''),
        seeded: raw.seeded === true,

        // ── 内置文案的补种账本 ──────────────────────────
        // ★ 两个字段都是**后加的**,老记录里没有,所以必须给安全默认值:
        //   版本按 0 算(= 还没补过种),墓碑按空数组算(= 没删过任何内置)。
        /** 上次补种到哪一版。见 `clip-library.js` 的 `BUILTIN_CLIPS_VERSION` */
        clipSeedVersion: Number(raw.clipSeedVersion) || 0,
        /** 用户**主动删掉**的内置文案 id。补种时跳过它们,不让删掉的东西自己长回来 */
        removedBuiltinClipIds: asArray(raw.removedBuiltinClipIds).map(String),

        updatedAt: Number(raw.updatedAt) || Date.now(),
    };
}

// ============================================================
// 读写 —— 单例
// ============================================================

export async function loadLibrary(app) {
    const db = dbOf(app);
    if (!db) return normalizeLibrary({});
    try {
        const raw = await db.get(STORE_LIBRARY, LIBRARY_KEY);
        return normalizeLibrary(raw || {});
    } catch (err) {
        console.warn('[scene-play/db] 读取设置失败,用默认值', err);
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
        console.warn('[scene-play/db] 保存设置失败', err);
        return false;
    }
}

// ============================================================
// 读写 —— 情景
// ============================================================

export async function loadScenes(app) {
    const db = dbOf(app);
    if (!db) return [];
    try {
        const rows = await db.getAllRecords(STORE_SCENES);
        return asArray(rows).map(normalizeScene).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch (err) {
        console.warn('[scene-play/db] 读取情景失败', err);
        return [];
    }
}

export async function saveScene(app, scene) {
    const db = dbOf(app);
    if (!db || !scene?.id) return false;
    const plain = toPlain({ ...scene, updatedAt: Date.now() });
    if (!plain) return false;
    try {
        await db.put(STORE_SCENES, plain);
        return true;
    } catch (err) {
        console.warn('[scene-play/db] 保存情景失败', err);
        return false;
    }
}

/**
 * 删一个情景:情景本体 + 它名下所有存档 + 那些存档的所有消息。
 *
 * ★ 不删干净的话会留下真正读不到的孤儿记录,而且它们还占着 IndexedDB 的空间 ——
 *   用户在 nook 的「数据库」页里会看到消息数一直涨,却找不到对应的存档。
 */
export async function deleteScene(app, sceneId) {
    const db = dbOf(app);
    if (!db || !sceneId) return false;
    try {
        const saves = await listSaves(app, sceneId);
        for (const save of saves) {
            await deleteSave(app, save.id);
        }
        await db.remove(STORE_SCENES, String(sceneId));
        return true;
    } catch (err) {
        console.warn('[scene-play/db] 删除情景失败', err);
        return false;
    }
}

// ============================================================
// 读写 —— 存档
// ============================================================

export async function listSaves(app, sceneId) {
    const db = dbOf(app);
    if (!db) return [];
    try {
        const rows = await db.getAllRecords(STORE_SAVES);
        return asArray(rows)
            .filter((r) => !sceneId || isSameId(r?.sceneId, sceneId))
            .map(normalizeSave)
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch (err) {
        console.warn('[scene-play/db] 读取存档失败', err);
        return [];
    }
}

export async function saveSave(app, save) {
    const db = dbOf(app);
    if (!db || !save?.id) return false;
    const plain = toPlain({ ...save, updatedAt: Date.now() });
    if (!plain) return false;
    try {
        await db.put(STORE_SAVES, plain);
        return true;
    } catch (err) {
        console.warn('[scene-play/db] 保存存档失败', err);
        return false;
    }
}

export async function deleteSave(app, saveId) {
    const db = dbOf(app);
    if (!db || !saveId) return false;
    try {
        const messages = await listMessages(app, saveId);
        await Promise.all(messages.map((m) => db.remove(STORE_MESSAGES, m.id).catch(() => {})));
        await db.remove(STORE_SAVES, String(saveId));
        return true;
    } catch (err) {
        console.warn('[scene-play/db] 删除存档失败', err);
        return false;
    }
}

// ============================================================
// 读写 —— 消息
// ============================================================

export async function listMessages(app, saveId) {
    const db = dbOf(app);
    if (!db || !saveId) return [];
    try {
        const rows = await db.getAllRecords(STORE_MESSAGES);
        return asArray(rows)
            .filter((r) => isSameId(r?.saveId, saveId))
            .map((r) => normalizeMessage(r, saveId))
            // ★ 按 seq 排,不按 createdAt —— 同一毫秒插两条时后者会跑到前面去
            .sort((a, b) => (a.seq - b.seq) || (a.createdAt - b.createdAt));
    } catch (err) {
        console.warn('[scene-play/db] 读取消息失败', err);
        return [];
    }
}

export async function saveMessage(app, message) {
    const db = dbOf(app);
    if (!db || !message?.id) return false;
    const plain = toPlain(message);
    if (!plain) return false;
    try {
        await db.put(STORE_MESSAGES, plain);
        return true;
    } catch (err) {
        console.warn('[scene-play/db] 保存消息失败', err);
        return false;
    }
}

export async function deleteMessages(app, ids = []) {
    const db = dbOf(app);
    if (!db || !ids.length) return false;
    try {
        await Promise.all(ids.map((id) => db.remove(STORE_MESSAGES, String(id)).catch(() => {})));
        return true;
    } catch (err) {
        console.warn('[scene-play/db] 删除消息失败', err);
        return false;
    }
}

/** 另存为新档:复制存档元信息 + 全部消息 */
export async function cloneSave(app, sourceSave, messages, name) {
    const copy = normalizeSave({
        ...sourceSave,
        id: makeId('save'),
        name: String(name || `${sourceSave.name} 副本`).slice(0, 30),
        createdAt: Date.now(),
        updatedAt: Date.now(),
    });
    await saveSave(app, copy);
    for (const message of asArray(messages)) {
        await saveMessage(app, normalizeMessage({ ...message, id: makeId('msg'), saveId: copy.id }, copy.id));
    }
    return copy;
}

/** 列表里显示的一行 */
export function saveBrief(save) {
    return {
        id: save.id,
        name: save.name,
        line: truncate(save.lastLine || save.summary, 44),
        count: save.messageCount,
        updatedAt: save.updatedAt,
    };
}

// ============================================================
// 首次灌数据
// ============================================================

/** 内置外观 —— 三套,分别对应三种体裁的常见样子 */
export function builtinThemes() {
    return [
        normalizeTheme({
            id: 'theme-soft', name: '奶油', builtin: true,
            background: { kind: 'color', color: '', dim: 0, blur: 0 },
            avatar: { showLeft: true, showRight: false, shape: 'circle', size: 34 },
            name: { position: 'above' },
            time: { position: 'none' },
            density: 'cozy',
            card: { glass: false, border: 'hairline', radius: 20, tint: '' },
        }),
        normalizeTheme({
            id: 'theme-paper', name: '纸页', builtin: true,
            background: { kind: 'color', color: '', dim: 4, blur: 0 },
            avatar: { showLeft: false, showRight: false, shape: 'squircle', size: 30 },
            name: { position: 'none' },
            time: { position: 'above' },
            density: 'loose',
            card: { glass: false, border: 'none', radius: 8, tint: '' },
        }),
        normalizeTheme({
            id: 'theme-glass', name: '毛玻璃', builtin: true,
            background: { kind: 'color', color: '', dim: -6, blur: 0 },
            avatar: { showLeft: true, showRight: true, shape: 'squircle', size: 32 },
            name: { position: 'inline' },
            time: { position: 'below' },
            density: 'compact',
            card: { glass: true, border: 'hairline', radius: 22, tint: '' },
        }),
    ];
}

/**
 * 补种内置文案(**每次 hydrate 都跑一遍,不只首次**)。
 *
 * ── 为什么不能只在首次灌 ──────────────────────────────────────────
 *
 * 老做法是「`library.seeded` 为真就整段跳过」,后果是:
 * 后来往内置库里加的文案,**已经装过这个 App 的人永远收不到**。
 * 他们看到的还是第一版那 6 条,而且完全不知道有新的。
 *
 * ── 三条规则 ──────────────────────────────────────────────────────
 *
 *   **加**     库里没有这个 id → 追加到末尾(不插到最前面,免得打乱用户自己的顺序)
 *   **跳过**   库里已经有这个 id → 一个字段都不碰。用户可能改过标题 / 正文 / 标签,
 *              「用内置版本覆盖回去」等于把他的编辑吃掉
 *   **不复活** id 在 `removedBuiltinClipIds` 里 → 永远不再加。
 *              用户删掉一条内置文案是明确的意思表示,下次打开又长回来是很惹人烦的
 *
 * 版本号一致就整段跳过,省掉每次打开的一趟遍历。
 *
 * ★ 一个已知的边界:这套墓碑是从 v2 才开始记的。在那之前就删过内置文案的用户,
 *   升级后会被补回来一次 —— 这一次之后再删就会被记住。没有别的办法认出
 *   「他删过」和「他从来没有过」,而宁可多给一条也不要少给一条。
 */
export function syncBuiltinClips(library) {
    if (!library || typeof library !== 'object') return library;
    if (Number(library.clipSeedVersion) >= BUILTIN_CLIPS_VERSION) return library;

    const existing = new Set(asArray(library.clips).map((c) => String(c?.id || '')));
    const removed = new Set(asArray(library.removedBuiltinClipIds).map(String));

    const added = BUILTIN_CLIPS
        .filter((clip) => !existing.has(String(clip.id)) && !removed.has(String(clip.id)))
        .map((clip) => normalizeClip({ ...clip, builtin: true }));

    if (added.length) library.clips = [...asArray(library.clips), ...added];
    library.clipSeedVersion = BUILTIN_CLIPS_VERSION;
    return library;
}

/** 首次进来给一份可用的默认库 */
export function seedLibrary(library) {
    // ★ 文案补种在 `seeded` 判断**外面** —— 它对老用户也要跑
    if (!library.seeded) {
        library.seeded = true;
        if (!library.categories.length) {
            library.categories = [
                normalizeCategory({ name: '日常', order: 0 }),
                normalizeCategory({ name: '故事', order: 1 }),
            ];
        }
        if (!library.themes.length) library.themes = builtinThemes();
        if (!library.rules.length) library.rules = BUILTIN_RULES.map(normalizeRule);
    }
    syncBuiltinClips(library);
    return library;
}
