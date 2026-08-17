/**
 * relax-app / 解压主体(toy)注册表
 *
 * ============================================================
 * ★ 这是本 app 唯一对外的扩展口子 ★
 * ============================================================
 * 「解压主体」= 气泡纸捏捏 / 巧克力脆皮 / 史莱姆 / 捏捏乐…… 这类真正被玩的东西。
 * 本文件只负责「登记 + 分发」,不关心主体内部怎么实现。
 *
 * 舞台(背景 / 盘子 / 装饰 / 音声)全部由 app 框架提供,主体只需要关心
 * 「在给我的那块矩形区域里,画出并响应交互」。
 *
 * ------------------------------------------------------------
 * 一、怎么加一个新主体
 * ------------------------------------------------------------
 * 1) 新建 `js/apps/relax-app/toys/bubble-wrap.js`
 * 2) 里面 `registerRelaxToy({ ... })`
 * 3) 在 `js/apps/relax-app/toys/index.js` 里 import 一次(纯副作用 import)
 * 完事 —— 主体会自动出现在「捏捏」tab 的主体列表里,可被选中、被上色、被摆到盘子上。
 *
 * ------------------------------------------------------------
 * 二、两种实现方式(二选一,不能都写)
 * ------------------------------------------------------------
 * A. `mount(host)` —— 命令式,拿到一个真实 DOM 容器,爱怎么写怎么写
 *    (canvas / WebGL / 手写 DOM / 第三方库如 matter.js 都走这条)
 *
 *    registerRelaxToy({
 *        id: 'bubble-wrap',
 *        name: '气泡纸',
 *        icon: `<svg viewBox="0 0 24 24">...</svg>`,
 *        defaultTint: '#cdeafd',
 *        mount(host) {
 *            host.el.innerHTML = `<div class="bw-grid">...</div>`;
 *            host.el.addEventListener('pointerdown', (e) => {
 *                host.playSound();        // ← 用用户在「音声」tab 里选的音
 *                host.haptic();
 *            });
 *            return {
 *                destroy() { host.el.innerHTML = ''; },
 *                setTint(hex) { host.el.style.setProperty('--bw-tint', hex); },
 *                setSize(w, h) { },
 *            };
 *        },
 *    });
 *
 * B. `component` —— 声明式,给一个 Vue 组件配置,框架帮你挂
 *    组件会收到 props: `{ host }`(同下面的 host 契约)
 *
 *    registerRelaxToy({
 *        id: 'jelly',
 *        name: '果冻',
 *        component: {
 *            props: { host: Object },
 *            template: `<div class="jelly" @pointerdown="host.playSound()"></div>`,
 *        },
 *    });
 *
 * ------------------------------------------------------------
 * 三、host 契约(主体能用的全部能力)
 * ------------------------------------------------------------
 * | 字段                        | 说明                                                |
 * |-----------------------------|-----------------------------------------------------|
 * | `host.el`                   | 容器 DOM(仅 mount 方式)。已按盘子/舞台尺寸摆好      |
 * | `host.width` / `host.height`| 当前容器像素尺寸                                     |
 * | `host.tint`                 | 用户给这个主体选的颜色(hex)                         |
 * | `host.playSound(opts?)`     | 播一次「用户当前选定的音声」。opts: {rate, gain, pan}|
 * | `host.playSoundId(id,opts?)`| 指定内置音 id 播(想自带音效时用)                    |
 * | `host.haptic(strength?)`    | 震动(强度 'light'/'medium'/'heavy')                |
 * | `host.notify(type,t,m)`     | 走灵动岛提示                                         |
 * | `host.getState()`           | 读本主体的持久化便签(自动存 IndexedDB)              |
 * | `host.setState(patch)`      | 写便签(浅合并 + 防抖落盘)                           |
 * | `host.onCleanup(fn)`        | 注册清理回调(卸载时自动跑,免得自己管 destroy)       |
 *
 * ------------------------------------------------------------
 * 四、返回的 controller(mount 方式,全部可选)
 * ------------------------------------------------------------
 * | `destroy()`        | 卸载时调用,清 DOM / 解绑 / 停 raf                    |
 * | `setTint(hex)`     | 用户改色时调用。不实现 → 框架退化为设 CSS 变量        |
 * | `setSize(w, h)`    | 容器尺寸变化时调用                                    |
 * | `reset()`          | 「重来一次」按钮(比如气泡纸全部复原)                  |
 * | `setRowsCols(r,c)` | 用户调整个数时调用。默认 `{rows, cols}`                |
 * | `setHtmlTemplate(html)` | 用户上传 / 写自定义 HTML 时调用。可选                 |
 *
 * ★ 配置项 `configurable: { type:'grid', rows, cols, min, max }`
 *   声明这个主体支持「调整个数」(比如气泡板让用户改 4x4 还是 6x6)。
 *   框架会把这个值存进 store、跨切页保留、并在 ToyHost 上透传。
 *
 * ★ 配置项 `customizable: true` + `htmlTemplates: [...]`
 *   声明这个主体允许用户上传 HTML 代码做自己的捏捏。
 *   模板支持 `{row}` / `{col}` / `{index}` 占位符,每格独立展开。
 *   UI 上由 RxCustomToyModal 管理,自带「复制 prompt 提示」。
 *
 * ⚠️ 主体里不要自己读写 localStorage / 不要自己插全局 <style>。
 *    颜色用 `host.tint`,持久化用 `host.setState`,样式写进 css/apps/relax/。
 */

const _toys = new Map();
const _listeners = new Set();

/** tint 是否是合法的 #rgb / #rrggbb */
function isHexColor(value) {
    return typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

function notifyChanged() {
    for (const fn of _listeners) {
        try {
            fn(listRelaxToys());
        } catch (err) {
            console.warn('[relax/registry] 监听器抛错', err);
        }
    }
}

/**
 * 登记一个解压主体。
 * @returns {object|null} 规范化后的 toy 配置;非法配置返回 null
 */
export function registerRelaxToy(config) {
    if (!config?.id) {
        console.warn('[relax/registry] 主体缺少 id,已跳过', config);
        return null;
    }

    const hasMount = typeof config.mount === 'function';
    const hasComponent = !!config.component;

    if (!hasMount && !hasComponent) {
        console.warn(`[relax/registry] 主体 ${config.id} 既没有 mount() 也没有 component,已跳过`);
        return null;
    }
    if (hasMount && hasComponent) {
        console.warn(`[relax/registry] 主体 ${config.id} 同时声明了 mount() 和 component,只会用 mount()`);
    }

    if (_toys.has(config.id)) {
        console.warn(`[relax/registry] 主体 ${config.id} 重复注册,保留先注册的那个`);
        return _toys.get(config.id);
    }

    const defaultTint = isHexColor(config.defaultTint) ? config.defaultTint : '#ffc8dd';

    const normalized = {
        id: config.id,
        name: config.name || config.id,
        summary: config.summary || '',
        icon: config.icon || '',
        // 主体在盘子里铺满,还是铺满整个舞台
        fit: config.fit === 'stage' ? 'stage' : 'plate',
        // 容器宽高比。null = 跟随容器
        aspect: typeof config.aspect === 'number' && config.aspect > 0 ? config.aspect : null,
        tintable: config.tintable !== false,
        defaultTint,
        // 建议搭配的内置音 id(用户没自选时用这个)
        defaultSoundId: config.defaultSoundId || null,
        // 主体是否可以调整个数(比如气泡板让用户改行数和列数)
        // 写到 state 时,host.rows / host.cols 会更新;切走再切回来还是这个数
        configurable: normalizeConfigurable(config.configurable),
        // 主体是否可以上传 HTML / 写自定义代码(高级玩法)
        // true 后可调 setHtmlTemplate(html) 把模板传给主体,
        // 模板支持 {row} / {col} / {index} 占位符,每格独立展开。
        customizable: config.customizable === true,
        // 预设的 HTML 模板(id → html),给 customizable 的主体提供「内置玩法」
        // 比如 ['bubble','choco','emoji-smile'] 三套可选
        htmlTemplates: Array.isArray(config.htmlTemplates) ? config.htmlTemplates.slice() : null,
        mount: hasMount ? config.mount : null,
        component: hasMount ? null : (config.component || null),
        // 主体自己声明它支持「重来一次」
        resettable: config.resettable === true,
        /*
         * 能不能「再点一次取下来,盘子留空」。默认可以;
         * 声明 deletable:false 的主体(巧克力、果冻)点第二次要保持原样 ——
         * 以前这个字段压根没被 normalize,面板读到 undefined,
         * 于是照样把主体摘掉了,表现为「多点几次巧克力就消失了」。
         */
        deletable: config.deletable !== false,
    };

    /** 把作者的 configurable 描述规整成安全值(防负数/超界/非对象) */
    function normalizeConfigurable(raw) {
        if (!raw || raw.type !== 'grid') return null;
        const min = Math.max(1, Math.min(20, Math.floor(Number(raw.min) || 2)));
        const max = Math.max(min, Math.min(20, Math.floor(Number(raw.max) || 12)));
        const rows = clampInt(raw.rows, min, max, 4);
        const cols = clampInt(raw.cols, min, max, 4);
        return { type: 'grid', rows, cols, min, max };
    }

    function clampInt(value, min, max, fallback) {
        const num = Math.floor(Number(value));
        if (!Number.isFinite(num)) return fallback;
        return Math.min(max, Math.max(min, num));
    }

    _toys.set(normalized.id, normalized);
    notifyChanged();
    return normalized;
}

/** 全部已登记主体(注册顺序) */
export function listRelaxToys() {
    return Array.from(_toys.values());
}

export function getRelaxToy(toyId) {
    return _toys.get(toyId) || null;
}

export function hasRelaxToy(toyId) {
    return _toys.has(toyId);
}

/**
 * 订阅主体清单变化(主体是可以异步 import 进来的,列表要能自更新)
 * @returns {() => void} 退订函数
 */
export function onRelaxToysChanged(fn) {
    if (typeof fn !== 'function') return () => {};
    _listeners.add(fn);
    return () => _listeners.delete(fn);
}

// 方便在控制台手动登记 / 排查
if (typeof window !== 'undefined') {
    window.registerRelaxToy = registerRelaxToy;
    window.__relaxToys = { list: listRelaxToys, get: getRelaxToy };
}
