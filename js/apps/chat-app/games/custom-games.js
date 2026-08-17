/**
 * 群聊小游戏 / 自定义游戏安装器
 *
 * ── 这是什么 ──────────────────────────────────────────────────────
 *
 * 用户拿「小游戏提示词」让 AI 写一份玩法 JS，上传到这里，就多出一个游戏 ——
 * 之后**每个群聊**的小游戏页都能开这一局，和内置的狼人杀 / 谁是卧底 / 大富翁
 * 完全平级：一样走调度器、一样能切出去后台跑、一样进战绩。
 *
 * 做法照抄 `src/core/plugin-installer.js`（把 JS 文本装成 App 的那套）：
 *   Blob → import(blobURL) → 拿 default export → 体检 → 注册。
 *   代码整段存 localStorage，刷新时重装。
 *
 * ── 上传的玩法能拿到什么 ──────────────────────────────────────────
 *
 * 和插件 App 一样：**不能写 import**（运行时加载，没有构建、没有 importmap，
 * 任何相对路径和 @ 别名都解析不了）。要用的东西全在 `window.__chatGameKit` 上：
 *
 *   kit.SESSION_STATUS   对局状态常量
 *   kit.askAI(...)       让某个 AI 玩家出一段话 / 一个决策
 *   kit.awaitUser(...)   把球交给用户，等他点按钮（不设超时）
 *   kit.schedule(...)    排下一步（不要用 setTimeout —— 切出界面就断了）
 *   kit.log(...)         往对局日志里加一行
 *   kit.endGame(...)     宣布结束
 *   kit.ui               画界面用的小组件（seatStrip / logFeed / actionBar…）
 *   kit.escapeHtml(s)
 *
 * ── 玩法要实现的接口（少一个都装不上）──────────────────────────────
 *
 *   meta                               { id, name, desc, tone, minPlayers, maxPlayers, tag }
 *   setup(session)                     发牌 / 铺场，并排出第一步
 *   runStep(session, step, payload)    步骤执行器（调度器按名字调）
 *   handleUserAction(session, a, p)    用户点按钮
 *   buildView(session)                 → { tone, title, subtitle, right, head, action, viewerId }
 *   buildResult(session)               → 结算屏 HTML
 */

import { registerRunner } from './core/clock.js';
import { SESSION_STATUS, GAME_META } from './core/constants.js';

const STORAGE_KEY = 'xiaoting::chat-custom-games-v1';

/** 装好的自定义游戏：id → { meta, setup, runStep, handleUserAction, buildView, buildResult, statFields } */
const CUSTOM_GAMES = new Map();

// ---------------------------------------------------------------------------
// 元数据持久化
// ---------------------------------------------------------------------------

function readStore() {
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        return raw && typeof raw === 'object' ? raw : {};
    } catch (_) {
        return {};
    }
}

function writeStore(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data || {}));
        return true;
    } catch (err) {
        // 玩法代码整段存在这里，几个大玩法就能顶到 5MB 配额
        console.warn('[custom-games] 写盘失败（多半是 localStorage 满了）', err);
        return false;
    }
}

/** 已安装的自定义游戏列表，按安装时间倒序 */
export function listCustomGames() {
    return Object.values(readStore())
        .map((g) => ({ ...g, code: undefined }))
        .sort((a, b) => (b.installedAt || 0) - (a.installedAt || 0));
}

export function getCustomGameRecord(gameId) {
    return readStore()[gameId] || null;
}

// ---------------------------------------------------------------------------
// 静态体检
// ---------------------------------------------------------------------------

/**
 * 真正 import 之前先查一遍。
 *
 * 查的每条都有共同特征：**运行时要么不报错、要么报一句看不懂的错**。
 * 尤其是 setTimeout —— 用了它，用户切出对局页流程就断在半路，
 * 而且异常被吞掉，界面上什么都不会发生，只表现为「AI 不动了」。
 */
export function validateGameCode(code) {
    const errors = [];
    const warnings = [];
    const text = String(code || '');

    if (!text.trim()) return { ok: false, errors: ['文件是空的'], warnings };

    const importRe = /^\s*import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/gm;
    const bareImportRe = /^\s*import\s+['"]([^'"]+)['"]/gm;
    const specs = new Set();
    let m;
    while ((m = importRe.exec(text)) !== null) specs.add(m[1]);
    while ((m = bareImportRe.exec(text)) !== null) specs.add(m[1]);
    for (const spec of specs) {
        if (/^https?:\/\//.test(spec)) continue;
        errors.push(`import 了 "${spec}"。玩法是运行时加载的，没有构建步骤，相对路径和 @ 别名都解析不了 —— 需要的东西请从 window.__chatGameKit 上取。`);
    }

    if (!/export\s+default\s+/.test(text)) {
        errors.push('没有 `export default`。玩法文件要 default export 一个对象（或返回该对象的工厂函数）。');
    }

    for (const fn of ['setup', 'runStep', 'handleUserAction', 'buildView', 'buildResult']) {
        if (!new RegExp(`\\b${fn}\\b`).test(text)) {
            errors.push(`缺少 ${fn}() —— 五个接口少一个这局就跑不起来。`);
        }
    }

    if (/\bsetTimeout\s*\(/.test(text)) {
        warnings.push('用到了 setTimeout。「等一会儿再做某事」要用 kit.schedule(session, step, delay)，写成数据存进对局 —— setTimeout 是闭包，用户切出对局页或刷新页面，流程就断在半路，而且异常会被吞掉（界面上表现为「AI 不动了」）。');
    }
    if (/document\s*\.\s*(querySelector|getElementById)/.test(text)) {
        warnings.push('引擎里出现了 DOM 查询。引擎只该读写 session，界面交给 buildView —— 碰 DOM 就意味着「界面不在时流程会崩」。');
    }

    return { ok: errors.length === 0, errors, warnings };
}

/** 拿到导出对象之后再查一遍字段 */
export function validateGameModule(game) {
    const errors = [];
    const warnings = [];
    if (!game || typeof game !== 'object') return { ok: false, errors: ['default export 不是对象'], warnings };

    const meta = game.meta || {};
    if (!meta.id) errors.push('meta.id 缺失');
    else if (!/^[a-z][a-z0-9-]*$/.test(String(meta.id))) errors.push(`meta.id "${meta.id}" 只能用小写字母、数字和连字符`);
    else if (GAME_META[meta.id]) errors.push(`meta.id "${meta.id}" 和内置游戏重名，换一个`);
    if (!meta.name) errors.push('meta.name 缺失');

    for (const fn of ['setup', 'runStep', 'handleUserAction', 'buildView', 'buildResult']) {
        if (typeof game[fn] !== 'function') errors.push(`${fn} 不是函数`);
    }

    const min = Number(meta.minPlayers);
    const max = Number(meta.maxPlayers);
    if (!Number.isFinite(min) || min < 2) warnings.push('meta.minPlayers 建议 ≥ 2（含用户自己）');
    if (!Number.isFinite(max) || max < min) warnings.push('meta.maxPlayers 应该 ≥ minPlayers');
    if (!meta.tone) warnings.push('meta.tone 没写，会用默认色（blue）。可选：blue / pink / slate / violet / amber');

    return { ok: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// 安装
// ---------------------------------------------------------------------------

/**
 * 把一段 JS 装成一个可玩的游戏。
 * @param {string} code
 * @param {object} [opts] { skipValidation, allowReplace }
 */
export async function installGameFromCode(code, opts = {}) {
    const text = String(code || '');

    if (!opts.skipValidation) {
        const check = validateGameCode(text);
        if (!check.ok) return { success: false, error: check.errors[0], errors: check.errors, warnings: check.warnings };
    }

    const blob = new Blob([text], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    try {
        let mod;
        try {
            mod = await import(/* @vite-ignore */ url);
        } catch (err) {
            return { success: false, error: `代码没法作为模块加载：${err?.message || err}` };
        }

        let game = mod?.default;
        if (typeof game === 'function') {
            try { game = game(); } catch (err) {
                return { success: false, error: `工厂函数调用失败：${err?.message || err}` };
            }
        }

        const check = validateGameModule(game);
        if (!check.ok) return { success: false, error: check.errors[0], errors: check.errors, warnings: check.warnings };

        const id = game.meta.id;
        if (CUSTOM_GAMES.has(id) && !opts.allowReplace) {
            return { success: false, error: `已经装过 id 为 "${id}" 的游戏了。先删掉旧的，或者换个 id。`, conflict: id };
        }

        const normalized = {
            meta: {
                id,
                name: String(game.meta.name),
                desc: String(game.meta.desc || ''),
                tone: String(game.meta.tone || 'blue'),
                minPlayers: Number(game.meta.minPlayers) || 2,
                maxPlayers: Number(game.meta.maxPlayers) || 8,
                tag: String(game.meta.tag || `${Number(game.meta.minPlayers) || 2}-${Number(game.meta.maxPlayers) || 8} 人`),
                custom: true,
            },
            setup: game.setup,
            runStep: game.runStep,
            handleUserAction: game.handleUserAction,
            buildView: game.buildView,
            buildResult: game.buildResult,
            statFields: typeof game.statFields === 'function' ? game.statFields : (() => ({})),
        };

        CUSTOM_GAMES.set(id, normalized);
        registerRunner(id, { runStep: normalized.runStep });

        return { success: true, gameId: id, name: normalized.meta.name, warnings: check.warnings };
    } finally {
        URL.revokeObjectURL(url);
    }
}

/** 安装并记下来（刷新后自动恢复） */
export async function installAndPersistGame(code, opts = {}) {
    const result = await installGameFromCode(code, opts);
    if (!result.success) return result;

    const store = readStore();
    store[result.gameId] = {
        id: result.gameId,
        name: result.name,
        meta: CUSTOM_GAMES.get(result.gameId).meta,
        fileName: opts.fileName || `${result.gameId}.js`,
        installedAt: Date.now(),
        code,
    };
    const saved = writeStore(store);
    return { ...result, persisted: saved };
}

export function removeCustomGame(gameId) {
    CUSTOM_GAMES.delete(gameId);
    const store = readStore();
    if (!store[gameId]) return { success: false, error: '没装过这个游戏' };
    delete store[gameId];
    writeStore(store);
    return { success: true, gameId };
}

/**
 * 启动时恢复。单个失败不阻断后面的 —— 一个坏玩法不该让其他玩法都装不上。
 */
export async function restoreCustomGames() {
    const store = readStore();
    let ok = 0;
    let failed = 0;
    for (const [id, rec] of Object.entries(store)) {
        if (!rec?.code) continue;
        const r = await installGameFromCode(rec.code, { skipValidation: true, allowReplace: true });
        if (r.success) ok += 1;
        else {
            failed += 1;
            console.warn(`[custom-games] 恢复「${rec.name || id}」失败：${r.error}`);
        }
    }
    if (ok || failed) console.log(`[custom-games] 自定义游戏恢复：${ok} 成功 / ${failed} 失败`);
    return { restored: ok, failed };
}

// ---------------------------------------------------------------------------
// 查询
// ---------------------------------------------------------------------------

export function getCustomGame(gameId) {
    return CUSTOM_GAMES.get(gameId) || null;
}

export function listCustomGameMetas() {
    return [...CUSTOM_GAMES.values()].map((g) => g.meta);
}

export function hasCustomGames() {
    return CUSTOM_GAMES.size > 0;
}

/** 把一段代码存成 .js 文件下载 */
export function downloadGameJs(code, fileName = 'game.js') {
    const blob = new Blob([code], { type: 'application/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export { SESSION_STATUS };
