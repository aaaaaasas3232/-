/**
 * 插件安装器 —— 把一段 JS 文本变成系统里一个真实可用的 App
 *
 * ── 为什么这段代码要住在框架层 ────────────────────────────────────
 * 它原先整段写在 `js/apps/setting/software/section.js` 里，也就是 nook 的一个
 * UI 模块内部。但「把 JS 文本注册成 App」是**框架能力**，不是 nook 的业务：
 *   - nook 的「软件管理」页要用它（用户手动上传 .js）
 *   - 「App 制作」问卷做完要用它（把生成的白膜直接装到桌面）
 *   - 将来任何「导入 App」的入口都要用它
 * 第二个消费方出现的那一刻，它就该搬家了。
 *
 * ── 上传的插件和项目内置 App 有一条硬差异 ─────────────────────────
 * 内置 App 经过 vite 构建，`import { escapeHtml } from '@/src/core/escape.js'`
 * 里的 `@` 会被解析成真实路径。而插件是**运行时** `import(blobURL)` 加载的：
 * 没有构建、没有 importmap，blob URL 也没有可用的相对基准。
 * 于是任何 import 语句都会抛 `Failed to resolve module specifier`。
 *
 * 这个错误的表现极具迷惑性 —— 文件在编辑器里看着完全正确，
 * 装的时候只报一句模块解析失败。所以 `validatePluginCode` 会在真正 import 之前
 * 先把 import 语句挑出来，直接告诉用户「这一行不行，改成 window.xxx」。
 *
 * 插件能用的东西全在 window 上：
 *   window.__listenPresets   预设库（卡片 / 布局 / 弹窗 / 灵动岛 / 小组件）
 *   window.__listenToolkit   通用 toolkit（部分能力）
 *   this.toolkit             appConfig 的 methods 里由框架注入
 *   window.settingsSdk       世界观 / 人设 / prompt 库
 *   window.__apiSdk          API key 管理（懒加载，用前判空）
 */

import { externalAppRegistry, registerPhoneApp, registerPhoneAppAsync } from './app-registry.js';

const PLUGIN_META_KEY = 'xiaoting_plugins_meta';

// ---------------------------------------------------------------------------
// 元数据持久化
// ---------------------------------------------------------------------------

export function getPluginMeta() {
    try {
        const raw = JSON.parse(localStorage.getItem(PLUGIN_META_KEY) || '{}');
        return raw && typeof raw === 'object' ? raw : {};
    } catch (_) {
        return {};
    }
}

export function savePluginMeta(meta) {
    try {
        localStorage.setItem(PLUGIN_META_KEY, JSON.stringify(meta || {}));
        return true;
    } catch (err) {
        // 插件代码整段存在 localStorage 里，几个大插件就能顶到 5MB 配额
        console.warn('[plugin-installer] 元数据写盘失败（多半是 localStorage 满了）', err);
        return false;
    }
}

/** 已登记的插件列表，按安装时间倒序 */
export function listPlugins() {
    return Object.entries(getPluginMeta())
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => (b.installedAt || 0) - (a.installedAt || 0));
}

export function getPlugin(id) {
    return getPluginMeta()[id] || null;
}

function uid(prefix = 'plugin') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// 静态检查
// ---------------------------------------------------------------------------

/**
 * 在真正 import 之前先做一遍静态体检。
 *
 * 这里查的每一条都有共同特征：**运行时要么根本不报错，要么报一句看不懂的错**。
 * 能静态查出来的就别留到运行时。
 *
 * @returns {{ok:boolean, errors:string[], warnings:string[]}}
 */
export function validatePluginCode(code) {
    const errors = [];
    const warnings = [];
    const text = String(code || '');

    if (!text.trim()) {
        return { ok: false, errors: ['文件是空的'], warnings };
    }

    // 1) import 语句 —— 插件走 blob URL 加载，没有任何模块解析能力
    const importRe = /^\s*import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/gm;
    const bareImportRe = /^\s*import\s+['"]([^'"]+)['"]/gm;
    const specifiers = new Set();
    let m;
    while ((m = importRe.exec(text)) !== null) specifiers.add(m[1]);
    while ((m = bareImportRe.exec(text)) !== null) specifiers.add(m[1]);
    for (const spec of specifiers) {
        if (/^https?:\/\//.test(spec)) continue; // 绝对 URL 能加载，放行
        errors.push(
            `第 ${lineOf(text, spec)} 行附近 import 了 "${spec}"。`
            + '插件是运行时加载的，没有构建步骤，任何相对路径 / @ 别名都解析不了。'
            + '改成从 window 上取（例如 window.__listenPresets），或者把那几行代码直接内联进来。',
        );
    }

    // 2) 必须有 default export 的工厂函数
    if (!/export\s+default\s+(async\s+)?function/.test(text) && !/export\s+default\s+[A-Za-z_$]/.test(text)) {
        errors.push('没有找到 `export default function createXxxApp() { ... }`。插件必须 default export 一个返回 appConfig 的工厂函数。');
    }

    // 3) 箭头函数写 methods —— 框架注入的 this 会丢，表现为「按钮点了没反应」
    if (/\b(methods|services)\s*:\s*\{[\s\S]{0,4000}?\}\s*,?/.test(text)) {
        const block = text.match(/\b(?:methods|services)\s*:\s*\{[\s\S]*?\n\s{4}\}/)?.[0] || '';
        if (/^\s{8}[A-Za-z_$][\w$]*\s*:\s*(async\s*)?\([^)]*\)\s*=>/m.test(block)) {
            warnings.push('methods / services 里出现了箭头函数写法。框架是用 apply 注入 this 的，箭头函数会忽略它，表现为「按钮点了没反应」。请改成方法简写 `save() { ... }`。');
        }
    }

    // 4) renderPage 里用 this —— 它是被当独立函数调的
    const renderPageBlock = text.match(/renderPage\s*\([^)]*\)\s*\{[\s\S]*?\n\s{4,8}\}/)?.[0] || '';
    if (/\bthis\./.test(renderPageBlock)) {
        warnings.push('renderPage 内部用到了 `this`。框架是把它从 appConfig 上取出来当独立函数调的，this 已经丢了，运行时会抛 undefined。请改用第三个参数 app。');
    }

    // 5) 用了 toolkit.db 却没声明 stores
    if (/toolkit\s*\.\s*db\s*\./.test(text) && !/\bstores\s*:\s*\[/.test(text)) {
        warnings.push('用到了 toolkit.db 但没有声明 stores。表不会被创建，写入会静默失败（表现为「保存成功但刷新就没了」）。');
    }

    return { ok: errors.length === 0, errors, warnings };
}

function isolatePluginRuntime(cfg) {
    if (!cfg || typeof cfg !== 'object') return cfg;
    const appId = cfg.id || 'plugin';
    if (cfg.methods && typeof cfg.methods === 'object') {
        const isolated = {};
        for (const [key, fn] of Object.entries(cfg.methods)) {
            if (typeof fn !== 'function') {
                isolated[key] = fn;
                continue;
            }
            isolated[key] = function isolatedMethod(...args) {
                try {
                    return fn.apply(this, args);
                } catch (err) {
                    console.error(`[plugin ${appId}] methods.${key} 抛错`, err);
                    try { this?.toolkit?.island?.notify?.('error', cfg.name || appId, String(err?.message || err)); } catch (_) {}
                    return null;
                }
            };
        }
        cfg.methods = isolated;
    }
    if (typeof cfg.renderPage === 'function') {
        const orig = cfg.renderPage;
        cfg.renderPage = function isolatedRender(...args) {
            try {
                return orig.apply(this, args);
            } catch (err) {
                console.error(`[plugin ${appId}] renderPage 抛错`, err);
                return `<div style="padding:20px;font-size:13px;color:#8E8E93">这个插件这一页出错了，系统还在。</div>`;
            }
        };
    }
    return cfg;
}

function lineOf(text, needle) {
    const idx = text.indexOf(needle);
    if (idx < 0) return '?';
    return text.slice(0, idx).split('\n').length;
}

/**
 * appConfig 的运行时体检。
 * 工厂已经跑出来了，这里查的是「字段之间对不对得上」。
 */
export function validateAppConfig(cfg) {
    const errors = [];
    const warnings = [];

    if (!cfg || typeof cfg !== 'object') return { ok: false, errors: ['工厂函数没有返回对象'], warnings };
    if (!cfg.id) errors.push('缺少 id');
    else if (!/^[a-z][a-z0-9-]*$/.test(String(cfg.id))) warnings.push(`id "${cfg.id}" 建议用小写字母 + 连字符（kebab-case）`);
    if (!cfg.name) errors.push('缺少 name');

    const pages = Array.isArray(cfg.pages) ? cfg.pages : [];
    if (!pages.length) errors.push('pages[] 至少要有一页');
    if (cfg.defaultRootPageId && !pages.some((p) => p?.id === cfg.defaultRootPageId)) {
        errors.push(`defaultRootPageId "${cfg.defaultRootPageId}" 不在 pages[] 里 —— 打开 App 会白屏`);
    }
    if (!cfg.defaultRootPageId && pages.length) {
        warnings.push('没写 defaultRootPageId，框架会用 pages[0]');
    }

    const mode = cfg.renderMode || 'template';
    if (!['template', 'hybrid', 'vue'].includes(mode)) {
        errors.push(`renderMode "${mode}" 不合法，只能是 template / hybrid / vue`);
    }
    if (typeof cfg.renderPage !== 'function') errors.push('缺少 renderPage()');

    if (cfg.icon && !/<svg[\s>]/i.test(String(cfg.icon))) {
        warnings.push('icon 不是内联 SVG，桌面上可能显示不出来');
    }

    const stores = Array.isArray(cfg.stores) ? cfg.stores : [];
    stores.forEach((s, i) => {
        if (!s?.name) errors.push(`stores[${i}] 缺少 name`);
        if (!s?.keyPath) warnings.push(`stores[${i}] (${s?.name}) 没写 keyPath，默认按 id`);
    });

    (cfg.islandKinds || []).forEach((k, i) => {
        if (!k?.id) errors.push(`islandKinds[${i}] 缺少 id`);
    });

    return { ok: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// 安装
// ---------------------------------------------------------------------------

/**
 * 把一段 JS 文本注册成 App。
 *
 * @param {string} code
 * @param {object} [opts]
 * @param {boolean} [opts.skipValidation=false]  内部生成的代码可以跳过静态检查
 * @returns {Promise<{success:boolean, appId?:string, name?:string, hasStores?:boolean, error?:string, errors?:string[], warnings?:string[]}>}
 */
export async function installFromCode(code, opts = {}) {
    const text = String(code || '');

    if (!opts.skipValidation) {
        const check = validatePluginCode(text);
        if (!check.ok) {
            return { success: false, error: check.errors[0], errors: check.errors, warnings: check.warnings };
        }
    }

    const blob = new Blob([text], { type: 'application/javascript' });
    const moduleUrl = URL.createObjectURL(blob);

    try {
        let module;
        try {
            module = await import(/* @vite-ignore */ moduleUrl);
        } catch (err) {
            return { success: false, error: `代码没法作为模块加载：${err?.message || err}` };
        }

        if (!module || typeof module.default !== 'function') {
            return { success: false, error: '没有 default export 工厂函数（应为 `export default function createXxxApp() { return {...} }`）' };
        }

        let cfg;
        try {
            cfg = module.default();
        } catch (err) {
            return { success: false, error: `工厂函数调用失败：${err?.message || err}` };
        }

        const configCheck = validateAppConfig(cfg);
        if (!configCheck.ok) {
            return { success: false, error: configCheck.errors[0], errors: configCheck.errors, warnings: configCheck.warnings };
        }

        // 重名：framework 的 appMap 会直接返回旧的，新代码不会生效。
        // 与其静默用旧的，不如明说 —— 这是「改了代码重装没变化」的唯一原因。
        const existing = externalAppRegistry.getApp(cfg.id);
        if (existing && !opts.allowReplace) {
            return {
                success: false,
                error: `系统里已经有 id 为 "${cfg.id}" 的 App 了。换一个 id，或者先卸载旧的再装。`,
                conflict: cfg.id,
            };
        }
        if (existing && opts.allowReplace) {
            unregisterApp(cfg.id);
        }

        isolatePluginRuntime(cfg);

        // 声明了 stores 必须走异步注册：同步路径不会 ensureSchema，
        // 表根本没建，首次 put 静默失败
        const hasStores = Array.isArray(cfg.stores) && cfg.stores.length > 0;
        let registered;
        try {
            registered = hasStores ? await registerPhoneAppAsync(cfg) : registerPhoneApp(cfg);
        } catch (err) {
            return { success: false, error: `注册失败：${err?.message || err}` };
        }

        if (!registered) return { success: false, error: '注册返回 null（appConfig 不合法）' };

        window.refreshPhoneApps?.();
        window.refreshPhoneWidgets?.();

        return {
            success: true,
            appId: cfg.id,
            name: cfg.name,
            hasStores,
            stores: hasStores
                ? cfg.stores.map((s) => ({ name: s.name, keyPath: s.keyPath || 'id' }))
                : [],
            warnings: configCheck.warnings,
        };
    } finally {
        URL.revokeObjectURL(moduleUrl);
    }
}

/**
 * 安装并登记（会在刷新后自动恢复）。
 *
 * @param {string} code
 * @param {object} [opts] { fileName, source, allowReplace }
 */
export async function installAndPersist(code, opts = {}) {
    const result = await installFromCode(code, opts);
    if (!result.success) return result;

    const meta = getPluginMeta();
    // 同一个 appId 重装时复用原来的记录 key，避免列表里堆出一串同名条目
    const existingKey = Object.keys(meta).find((k) => meta[k]?.appId === result.appId);
    const key = existingKey || uid();

    meta[key] = {
        appId: result.appId,
        name: result.name,
        fileName: opts.fileName || `${result.appId}.js`,
        source: opts.source || 'upload',
        hasStores: result.hasStores,
        stores: result.stores || [],
        enabled: true,
        installedAt: Date.now(),
        code,
    };

    const saved = savePluginMeta(meta);
    return { ...result, pluginId: key, persisted: saved };
}

/**
 * 从 registry 里摘掉一个 App。
 *
 * framework 没有官方的 unregister，这里直接改 registry 的两个容器。
 * 之所以敢这么做：`apps` / `appMap` 是 createAppRegistry 返回的普通对象字段，
 * 桌面读的是 `window.__phoneAppsRef`，refreshPhoneApps 会从 apps 重算。
 */
export function unregisterApp(appId) {
    if (!appId) return false;
    const idx = externalAppRegistry.apps.findIndex((a) => a?.id === appId);
    if (idx >= 0) externalAppRegistry.apps.splice(idx, 1);
    delete externalAppRegistry.appMap[appId];

    // widget 注册表是全局的，App 摘了它的 widget 还留在桌面选择器里
    if (window.APP_WIDGETS) {
        for (const key of Object.keys(window.APP_WIDGETS)) {
            if (window.APP_WIDGETS[key]?.appId === appId) delete window.APP_WIDGETS[key];
        }
    }

    window.refreshPhoneApps?.();
    window.refreshPhoneWidgets?.();
    return idx >= 0;
}

export async function enablePlugin(pluginId) {
    const meta = getPluginMeta();
    const plugin = meta[pluginId];
    if (!plugin) return { success: false, error: '找不到这个插件' };
    const result = await installFromCode(plugin.code, { allowReplace: true });
    if (result.success) {
        plugin.enabled = true;
        savePluginMeta(meta);
    }
    return result;
}

export function disablePlugin(pluginId) {
    const meta = getPluginMeta();
    const plugin = meta[pluginId];
    if (!plugin) return { success: false, error: '找不到这个插件' };
    plugin.enabled = false;
    savePluginMeta(meta);
    unregisterApp(plugin.appId);
    return { success: true };
}

export function removePlugin(pluginId) {
    const meta = getPluginMeta();
    const plugin = meta[pluginId];
    if (!plugin) return { success: false, error: '找不到这个插件' };
    unregisterApp(plugin.appId);
    delete meta[pluginId];
    savePluginMeta(meta);
    return { success: true, appId: plugin.appId };
}

/** 把插件代码存成文件下载下来 */
export function exportPlugin(pluginId) {
    const plugin = getPlugin(pluginId);
    if (!plugin?.code) return { success: false, error: '这个插件没有存代码' };
    downloadJs(plugin.code, plugin.fileName || `${plugin.appId}.js`);
    return { success: true };
}

/** 通用的「把一段文本存成 .js」 */
export function downloadJs(code, fileName = 'app.js') {
    const blob = new Blob([code], { type: 'application/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // 立刻 revoke 会让部分浏览器的下载拿不到数据，给一秒缓冲
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 启动时恢复已启用的插件。
 * 单个失败不阻断后面的 —— 一个坏插件不该让其他插件全装不上。
 */
export async function restoreInstalledPlugins() {
    const meta = getPluginMeta();
    let restored = 0;
    let failed = 0;

    for (const [id, plugin] of Object.entries(meta)) {
        if (plugin?.enabled === false || !plugin?.code) continue;
        const result = await installFromCode(plugin.code, { skipValidation: true, allowReplace: true });
        if (result.success) {
            restored += 1;
        } else {
            failed += 1;
            console.warn(`[plugin-installer] 恢复插件 ${plugin.appId || id} 失败：${result.error}`);
        }
    }

    if (restored || failed) {
        console.log(`[plugin-installer] 插件恢复完成：${restored} 成功 / ${failed} 失败`);
    }
    return { restored, failed };
}

if (typeof window !== 'undefined') {
    window.__pluginInstaller = {
        installFromCode,
        installAndPersist,
        listPlugins,
        getPlugin,
        enablePlugin,
        disablePlugin,
        removePlugin,
        exportPlugin,
        downloadJs,
        unregisterApp,
        validatePluginCode,
        validateAppConfig,
        restoreInstalledPlugins,
    };
    // 老代码用的名字，保持可用
    window.__restoreInstalledPlugins = restoreInstalledPlugins;
}
