/**
 * relax-app / 状态中心(模块级单例)
 *
 * 为什么是模块单例而不是 Vue reactive:
 *   framework 的 vue 模式每次切页/重挂都会新建一个 Vue app,组件 data 会丢。
 *   舞台配置必须活得比组件久,所以放模块级 + 发布订阅,组件 mounted 时拉快照。
 *
 * ★ vue 模式的 hydrate 契约(AGENTS.md §47 踩过的坑)
 *   framework **不会**帮你调 `app.methods.hydrate()`。
 *   所以:
 *     1) 组件 data() 里同步用 `createDefaultScene()` 兜底 —— 首屏立刻有画面,不是 loading
 *     2) 组件 mounted() 里 `subscribe()` + microtask 调 `hydrate(app)`
 *     3) hydrate 只用 `_hydrating` 防并发,**不要**用 `_hydrated` 硬阻断
 *        (否则首次失败后永远没有第二次机会)
 *
 * 写操作一律走本文件导出的 mutator,mutator 负责 notify + 防抖落盘。
 * 组件里**不要**直接改 STATE 的字段。
 */

import {
    loadCurrentScene,
    saveCurrentScene,
    listCustomSounds,
    listCustomImages,
    listCustomPlates,
    listCustomDecorations,
} from './services/scene-store.js';
import { BACKGROUNDS } from './assets/backgrounds.js';
import { PLATES } from './assets/plates.js';
import { getDecoration } from './assets/decorations.js';
import { DEFAULT_SOUND_ID } from './services/sound-service.js';
import { safeColor } from './palette.js';

const PERSIST_DEBOUNCE_MS = 450;
const MAX_DECORATIONS = 24;

/**
 * 音色收藏 / 分组折叠的 localStorage key。
 * ★ 必须在这里声明:STATE 初始化时就会调 loadSoundPrefs(),
 *   放到文件下半部分会踩 const 的暂时性死区。
 */
const SOUND_PREFS_KEY = 'xiaoting::relax-sound-prefs-v1';

/**
 * 界面点击音的默认音色。
 * 用「木鱼」而不是默认的气泡音:UI 反馈要短、干、不带尾巴,
 * 一秒钟点三下也不会糊在一起。
 */
const UI_DEFAULT_SOUND_ID = 'wood-block';
/** 界面点击音默认音量。比捏捏音(0.7)低一截 —— 它是陪衬,不是主角。 */
const UI_DEFAULT_VOLUME = 0.32;

// ============================================================
// 默认舞台
// ============================================================

export function createDefaultScene() {
    return {
        id: 'current',
        name: '我的解压角',
        background: {
            presetId: BACKGROUNDS[0].id,
            tint: BACKGROUNDS[0].defaultTint,
            customImageId: null,
            blur: 0,
            brightness: 1,
            saturate: 1,
        },
        plate: {
            enabled: true,
            presetId: PLATES[0].id,
            // 用户上传的自定义盘子 id(优先级高于 presetId)。null 表示不用。
            customId: null,
            tint: PLATES[0].defaultTint,
            scale: 1,
            offsetX: 0,
            offsetY: 0,
        },
        decorations: [],
        toy: {
            id: null,
            tint: '#ffc8dd',
            scale: 1,
            // 可调主体的当前 rows / cols(可调主体的标准参数)
            rows: 4,
            cols: 4,
        },
        // 主体自己的便签,按 toyId 分桶(host.getState / host.setState 读写)
        toyStates: {},
        // ★ 按 toyId 分桶的「这个主体单独用哪个音」:
        //   value: { soundPresetId?, customSoundId? } — 任一被设了就覆盖全局默认
        //   没设的玩具走 scene.sound 的全局配置,符合用户「全局默认 + 每个按钮单独覆盖」的诉求
        toySounds: {},
        sound: {
            enabled: true,
            presetId: DEFAULT_SOUND_ID,
            customId: null,
            volume: 0.7,
            haptics: true,
        },
        /**
         * ★ 界面点击音 —— 和上面的 sound 是**两套独立配置**,故意不合并:
         *     sound   = 捏主体的时候响什么
         *     uiSound = 点 tab / 瓦片 / 按钮 / 开关的时候响什么
         *   合成一套的话,「捏得响、点得轻」就调不出来,
         *   而且关掉捏捏音会顺手把界面音一起关了,不是用户要的。
         */
        uiSound: {
            enabled: true,
            presetId: UI_DEFAULT_SOUND_ID,
            customId: null,
            volume: UI_DEFAULT_VOLUME,
        },
        updatedAt: null,
    };
}

/**
 * 把「从数据库读出来的东西」补齐成完整 scene。
 * 老存档缺字段 / 用户手改坏了 / 引用了已删掉的预设 —— 都在这里兜住。
 */
export function normalizeScene(raw) {
    const base = createDefaultScene();
    if (!raw || typeof raw !== 'object') return base;

    const bgPreset = BACKGROUNDS.find(item => item.id === raw.background?.presetId);
    const platePreset = PLATES.find(item => item.id === raw.plate?.presetId);

    return {
        id: raw.id || base.id,
        name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 24) : base.name,
        background: {
            presetId: bgPreset ? bgPreset.id : base.background.presetId,
            tint: safeColor(raw.background?.tint, (bgPreset || BACKGROUNDS[0]).defaultTint),
            customImageId: raw.background?.customImageId || null,
            blur: clampNumber(raw.background?.blur, 0, 20, 0),
            brightness: clampNumber(raw.background?.brightness, 0.4, 1.6, 1),
            saturate: clampNumber(raw.background?.saturate, 0, 2, 1),
        },
        plate: {
            enabled: raw.plate?.enabled !== false,
            presetId: platePreset ? platePreset.id : base.plate.presetId,
            // customId 只兜住类型,不强行校验存在性 —— hydrate 那一步会用 customPlates
            // 列表做引用完整性检查,把被删的 customId 清回 null。
            customId: raw.plate?.customId || null,
            tint: safeColor(raw.plate?.tint, (platePreset || PLATES[0]).defaultTint),
            scale: clampNumber(raw.plate?.scale, 0.6, 1.4, 1),
            offsetX: clampNumber(raw.plate?.offsetX, -40, 40, 0),
            offsetY: clampNumber(raw.plate?.offsetY, -40, 40, 0),
        },
        // 丢掉引用了不存在预设的装饰(比如素材被删了)
        decorations: Array.isArray(raw.decorations)
            ? raw.decorations
                // 过滤掉引用了已删除素材(包括预设和自定义)的装饰
                .filter(item => item?.uid && resolveDecorationPreset(item))
                .slice(0, MAX_DECORATIONS)
                .map(normalizeDecoration)
            : [],
        toy: {
            id: raw.toy?.id || null,
            tint: safeColor(raw.toy?.tint, base.toy.tint),
            // 上限放到 1.6:用户要求「能放大的大小再大一点」。
            scale: clampNumber(raw.toy?.scale, 0.6, 1.6, 1),
            // rows/cols 也回退到主体默认值(注册表里没找到就用 4)
            rows: clampInt(raw.toy?.rows, 1, 12, base.toy.rows),
            cols: clampInt(raw.toy?.cols, 1, 12, base.toy.cols),
        },
        toyStates: (raw.toyStates && typeof raw.toyStates === 'object' && !Array.isArray(raw.toyStates))
            ? raw.toyStates
            : {},
        // ★ per-toy 音色覆盖:浅合并 + 类型兜底;hydrate 后会用 sound/customSounds 列表兜引用完整性
        toySounds: (raw.toySounds && typeof raw.toySounds === 'object' && !Array.isArray(raw.toySounds))
            ? Object.fromEntries(
                Object.entries(raw.toySounds).filter(([k, v]) =>
                    typeof k === 'string' && v && typeof v === 'object' && !Array.isArray(v),
                ),
            )
            : {},
        sound: {
            enabled: raw.sound?.enabled !== false,
            presetId: raw.sound?.presetId || DEFAULT_SOUND_ID,
            customId: raw.sound?.customId || null,
            volume: clampNumber(raw.sound?.volume, 0, 1, 0.7),
            haptics: raw.sound?.haptics !== false,
        },
        // 老存档里没有 uiSound(这个字段是后加的)→ 整块回落到默认值,
        // 相当于「老用户升级上来默认就有界面点击音」。
        uiSound: {
            enabled: raw.uiSound?.enabled !== false,
            presetId: raw.uiSound?.presetId || UI_DEFAULT_SOUND_ID,
            customId: raw.uiSound?.customId || null,
            volume: clampNumber(raw.uiSound?.volume, 0, 1, UI_DEFAULT_VOLUME),
        },
        updatedAt: raw.updatedAt || null,
    };
}

/**
 * 装饰引用完整性检查:
 *   - 预设装饰(presetId = 内置的):getDecoration(presetId) 非空
 *   - 自定义装饰(presetId = 'custom:<id>'):占位,不靠 getDecoration
 *   - 老存档里 presetId 没前缀但实际指向自定义的:保持宽松(不会爆,但 hydrate 后会清)
 *
 * 这里仅做「能不能解析出 record」的判断 —— 自定义装饰的真假要等 hydrate 之后用
 * STATE.customDecorations 列表兜住。
 */
export function resolveDecorationPreset(deco) {
    if (!deco || !deco.presetId) return null;
    if (deco.presetId.startsWith('custom:')) return { kind: 'custom', id: deco.presetId.slice(7) };
    return getDecoration(deco.presetId) ? { kind: 'preset' } : null;
}

function normalizeDecoration(raw) {
    const preset = getDecoration(raw.presetId);
    return {
        uid: raw.uid,
        // 保留原始 presetId(custom:xxx 也会被原样保留)
        presetId: raw.presetId,
        tint: safeColor(raw.tint, preset?.defaultTint || '#ffc8dd'),
        // x / y 是 0~1 的相对坐标 —— 换屏幕尺寸也不会跑位
        x: clampNumber(raw.x, 0, 1, 0.5),
        y: clampNumber(raw.y, 0, 1, 0.5),
        scale: clampNumber(raw.scale, 0.3, 2.4, 1),
        rotate: clampNumber(raw.rotate, -180, 180, 0),
        flip: raw.flip === true,
        z: clampNumber(raw.z, 0, 999, 1),
        // 自定义装饰用 raw.aspect,内置用 preset.aspect
        aspect: raw.presetId?.startsWith('custom:')
            ? clampNumber(raw.aspect, 0.25, 4, 1)
            : (preset?.aspect || 1),
    };
}

function clampNumber(value, min, max, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, num));
}

function clampInt(value, min, max, fallback) {
    const num = Math.floor(Number(value));
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, num));
}

// ============================================================
// 状态
// ============================================================

/**
 * ★ STATE 用 Vue.reactive 包一层
 *
 * 为什么:本 app 是 vue 模式,组件直接把 `STATE.scene` 当 props 往下传。
 * 如果 scene 是普通对象,`STATE.scene.plate.tint = x` 这种嵌套改动 Vue 看不见,
 * 组件不会重渲染 —— 表现为「滑块拉了但盘子不变色」。
 * 用 reactive 之后深层改动自动触发更新,不用在组件里搞 `rev++` 之类的假信号。
 *
 * window.Vue 是 index.html 直接 <script> 引入的全局构建(见 js/vendor/vue.global.prod.js),
 * 拿不到时退化成普通对象 —— 逻辑照跑,只是没有响应式(比如在测试环境里)。
 */
function makeReactive(raw) {
    const Vue = typeof window !== 'undefined' ? window.Vue : null;
    return typeof Vue?.reactive === 'function' ? Vue.reactive(raw) : raw;
}

const STATE = makeReactive({
    scene: createDefaultScene(),
    customSounds: [],
    customImages: [],
    customPlates: [],
    customDecorations: [],
    /** 当前选中的装饰 uid(编辑态,不持久化) */
    selectedDecorationUid: null,
    /**
     * 音色收藏 / 分组折叠。跟 scene 分开存(localStorage),
     * 见下方「Mutators —— 音色收藏 / 分组折叠」的说明。
     */
    soundPrefs: loadSoundPrefs(),
    ready: false,
});

const _listeners = new Set();
let _app = null;
let _hydrating = false;
let _persistTimer = null;

/**
 * 拿状态对象(响应式)。组件在 computed 里读它即可自动更新。
 * ★ 只读 —— 所有写操作走本文件导出的 mutator,不要在组件里直接赋值。
 */
export function getState() {
    return STATE;
}

/**
 * 订阅变更。Vue 组件**不需要**用它(reactive 已经够了),
 * 留给非 Vue 的消费方(比如以后做导出 / 截图 / 灵动岛小组件)。
 */
export function subscribe(fn) {
    if (typeof fn !== 'function') return () => {};
    _listeners.add(fn);
    return () => _listeners.delete(fn);
}

function notify() {
    for (const fn of _listeners) {
        try {
            fn(STATE);
        } catch (err) {
            console.warn('[relax/store] 订阅者抛错', err);
        }
    }
}

// ============================================================
// hydrate / persist
// ============================================================

/**
 * 从 IndexedDB 拉起舞台 + 自定义资源。
 * 由组件 mounted() 里的 microtask 触发(framework 不会自动调)。
 */
export async function hydrate(app) {
    if (app) _app = app;
    // 只防并发,不防重入 —— 首次失败后要能重试
    if (_hydrating) return;
    _hydrating = true;

    try {
        const [saved, sounds, images, plates, decorations] = await Promise.all([
            loadCurrentScene(_app),
            listCustomSounds(_app),
            listCustomImages(_app),
            listCustomPlates(_app),
            listCustomDecorations(_app),
        ]);

        STATE.scene = normalizeScene(saved);
        STATE.customSounds = sounds;
        STATE.customImages = images;
        STATE.customPlates = plates;
        STATE.customDecorations = decorations;

        // 引用的自定义资源被删了 → 回退到内置
        if (STATE.scene.sound.customId
            && !sounds.some(item => item.id === STATE.scene.sound.customId)) {
            STATE.scene.sound.customId = null;
        }
        if (STATE.scene.uiSound.customId
            && !sounds.some(item => item.id === STATE.scene.uiSound.customId)) {
            STATE.scene.uiSound.customId = null;
        }
        if (STATE.scene.background.customImageId
            && !images.some(item => item.id === STATE.scene.background.customImageId)) {
            STATE.scene.background.customImageId = null;
        }
        if (STATE.scene.plate.customId
            && !plates.some(item => item.id === STATE.scene.plate.customId)) {
            STATE.scene.plate.customId = null;
        }

        // 装饰:丢引用了已删素材(custom:xxx)或已删预设的条目
        STATE.scene.decorations = STATE.scene.decorations.filter(item => {
            if (!item?.uid) return false;
            if (item.presetId?.startsWith('custom:')) {
                const id = item.presetId.slice(7);
                return decorations.some(d => d.id === id);
            }
            return !!getDecoration(item.presetId);
        });

        // 第一次进来还没存过 → 落一份盘,后面就有存档了
        if (!saved) {
            await saveCurrentScene(_app, STATE.scene);
        }

        STATE.ready = true;
    } catch (err) {
        console.warn('[relax/store] hydrate 失败,继续用默认舞台', err);
        STATE.ready = true;
    } finally {
        _hydrating = false;
        notify();
    }
}

/** 防抖落盘 —— 拖装饰/拉滑块会高频触发 mutator,不能每次都写库 */
function schedulePersist() {
    if (_persistTimer) clearTimeout(_persistTimer);
    _persistTimer = setTimeout(() => {
        _persistTimer = null;
        void saveCurrentScene(_app, STATE.scene);
    }, PERSIST_DEBOUNCE_MS);
}

/** 立刻落盘(离开 app / 另存前调) */
export async function flushPersist() {
    if (_persistTimer) {
        clearTimeout(_persistTimer);
        _persistTimer = null;
    }
    await saveCurrentScene(_app, STATE.scene);
}

/** 所有 mutator 的公共尾巴 */
function commit() {
    STATE.scene.updatedAt = new Date().toISOString();
    notify();
    schedulePersist();
}

// ============================================================
// Mutators —— 背景
// ============================================================

export function setBackgroundPreset(presetId) {
    const preset = BACKGROUNDS.find(item => item.id === presetId);
    if (!preset) return;
    STATE.scene.background.presetId = preset.id;
    // 换预设时把 tint 也带到该预设的默认色,避免「木纹配天蓝」这种意外
    STATE.scene.background.tint = preset.defaultTint;
    STATE.scene.background.customImageId = null;
    commit();
}

export function setBackgroundTint(hex) {
    STATE.scene.background.tint = safeColor(hex, STATE.scene.background.tint);
    STATE.scene.background.customImageId = null;
    commit();
}

export function setBackgroundCustomImage(imageId) {
    STATE.scene.background.customImageId = imageId || null;
    commit();
}

export function setBackgroundFilter(patch = {}) {
    const bg = STATE.scene.background;
    if (patch.blur != null) bg.blur = clampNumber(patch.blur, 0, 20, bg.blur);
    if (patch.brightness != null) bg.brightness = clampNumber(patch.brightness, 0.4, 1.6, bg.brightness);
    if (patch.saturate != null) bg.saturate = clampNumber(patch.saturate, 0, 2, bg.saturate);
    commit();
}

// ============================================================
// Mutators —— 盘子
// ============================================================

export function setPlateEnabled(enabled) {
    STATE.scene.plate.enabled = !!enabled;
    commit();
}

export function setPlatePreset(presetId) {
    const preset = PLATES.find(item => item.id === presetId);
    if (!preset) return;
    STATE.scene.plate.presetId = preset.id;
    STATE.scene.plate.tint = preset.defaultTint;
    // 切到内置预设就清掉 customId
    STATE.scene.plate.customId = null;
    STATE.scene.plate.enabled = true;
    commit();
}

/**
 * ★ 选用户上传的盘子。customId 优先级高于 presetId;
 *   选了之后 tint 仍可调(给图叠色 / 滤镜)。
 */
export function setPlateCustom(customId) {
    STATE.scene.plate.customId = customId || null;
    STATE.scene.plate.enabled = true;
    commit();
}

export function setPlateTint(hex) {
    STATE.scene.plate.tint = safeColor(hex, STATE.scene.plate.tint);
    commit();
}

export function setPlateTransform(patch = {}) {
    const plate = STATE.scene.plate;
    if (patch.scale != null) plate.scale = clampNumber(patch.scale, 0.6, 1.4, plate.scale);
    if (patch.offsetX != null) plate.offsetX = clampNumber(patch.offsetX, -40, 40, plate.offsetX);
    if (patch.offsetY != null) plate.offsetY = clampNumber(patch.offsetY, -40, 40, plate.offsetY);
    commit();
}

// ============================================================
// Mutators —— 装饰
// ============================================================

/**
 * 加一个装饰。presetId 可以是内置 id('leaf-sprig' 等),
 * 也可以是 'custom:<id>' 形式的自定义装饰。
 */
export function addDecoration(presetId) {
    if (!presetId) return null;
    let defaultTint = '#ffc8dd';
    let aspect = 1;
    let tintable = true;
    if (presetId.startsWith('custom:')) {
        const id = presetId.slice(7);
        const record = STATE.customDecorations.find(item => item.id === id);
        if (!record) return null;
        defaultTint = '#ffffff';        // 用户图默认不叠 tint
        aspect = record.aspect || 1;
        tintable = false;
    } else {
        const preset = getDecoration(presetId);
        if (!preset) return null;
        defaultTint = preset.defaultTint;
        aspect = preset.aspect || 1;
        tintable = true;
    }

    if (STATE.scene.decorations.length >= MAX_DECORATIONS) {
        return { error: `最多摆 ${MAX_DECORATIONS} 个装饰` };
    }

    const topZ = STATE.scene.decorations.reduce((max, item) => Math.max(max, item.z || 0), 0);
    const decoration = {
        uid: `deco-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        presetId,
        tint: defaultTint,
        // 新装饰落在偏上方随机位置,避免每次都盖在盘子正中间
        x: 0.28 + Math.random() * 0.44,
        y: 0.18 + Math.random() * 0.22,
        scale: 1,
        rotate: Math.round((Math.random() * 2 - 1) * 12),
        flip: false,
        z: topZ + 1,
        aspect,
        tintable,
    };
    STATE.scene.decorations.push(decoration);
    STATE.selectedDecorationUid = decoration.uid;
    commit();
    return { decoration };
}

export function updateDecoration(uid, patch = {}) {
    const target = STATE.scene.decorations.find(item => item.uid === uid);
    if (!target) return;
    if (patch.x != null) target.x = clampNumber(patch.x, 0, 1, target.x);
    if (patch.y != null) target.y = clampNumber(patch.y, 0, 1, target.y);
    if (patch.scale != null) target.scale = clampNumber(patch.scale, 0.3, 2.4, target.scale);
    if (patch.rotate != null) target.rotate = clampNumber(patch.rotate, -180, 180, target.rotate);
    // tintable=false(典型场景:用户上传的贴纸)就不接受 tint 改动 —— 改了也是脏
    if (patch.tint != null && target.tintable !== false) {
        target.tint = safeColor(patch.tint, target.tint);
    }
    if (patch.flip != null) target.flip = !!patch.flip;
    commit();
}

export function removeDecoration(uid) {
    const before = STATE.scene.decorations.length;
    STATE.scene.decorations = STATE.scene.decorations.filter(item => item.uid !== uid);
    if (STATE.selectedDecorationUid === uid) STATE.selectedDecorationUid = null;
    if (STATE.scene.decorations.length !== before) commit();
}

export function clearDecorations() {
    if (!STATE.scene.decorations.length) return;
    STATE.scene.decorations = [];
    STATE.selectedDecorationUid = null;
    commit();
}

/** 把某个装饰提到最上层 */
export function bringDecorationToFront(uid) {
    const target = STATE.scene.decorations.find(item => item.uid === uid);
    if (!target) return;
    const topZ = STATE.scene.decorations.reduce((max, item) => Math.max(max, item.z || 0), 0);
    if (target.z === topZ) return;
    target.z = topZ + 1;
    commit();
}

/** 选中态是纯编辑态,不落盘 */
export function selectDecoration(uid) {
    STATE.selectedDecorationUid = uid || null;
    notify();
}

// ============================================================
// Mutators —— 主体
// ============================================================

export function setToy(toyId, defaultTint) {
    STATE.scene.toy.id = toyId || null;
    if (defaultTint) STATE.scene.toy.tint = safeColor(defaultTint, STATE.scene.toy.tint);
    commit();
}

export function setToyTint(hex) {
    STATE.scene.toy.tint = safeColor(hex, STATE.scene.toy.tint);
    commit();
}

/**
 * 主体缩放上限放到 1.6 —— 用户要求「能放大的大小再大一点」。
 * 下限 0.6 保留,避免缩到看不见。
 */
export function setToyScale(scale) {
    STATE.scene.toy.scale = clampNumber(scale, 0.6, 1.6, STATE.scene.toy.scale);
    commit();
}

/**
 * 调整个数(气泡板的 4×4 → 6×6)。
 * 调完之后通常需要主体整块重建 → toy-host 会 watch 这俩值触发 remount。
 */
export function setToyRowsCols(rows, cols) {
    STATE.scene.toy.rows = clampInt(rows, 2, 12, STATE.scene.toy.rows);
    STATE.scene.toy.cols = clampInt(cols, 2, 12, STATE.scene.toy.cols);
    commit();
}

/**
 * 主体的私有便签(host.getState)。主体想记「哪几个泡泡已经被捏爆了」就用这个。
 * 按 toyId 分桶,换主体不会互相污染。
 */
export function getToyState(toyId) {
    if (!toyId) return {};
    const raw = STATE.scene.toyStates[toyId];
    if (!raw) return {};
    // ★ 返回纯数据副本,不把 reactive Proxy 漏给主体。
    //   否则主体作者一不小心 `host.getState().list.push(x)` 就会绕过
    //   setState 直接改 store —— 改了但不落盘,刷新就丢,极难排查。
    try {
        return JSON.parse(JSON.stringify(raw));
    } catch {
        return {};
    }
}

/**
 * host.setState —— 浅合并 + 防抖落盘。
 * ★ 故意**不** notify:主体的内部状态不该触发整个舞台 re-render
 *   (气泡纸每捏一下都重画舞台会明显掉帧)。主体自己管自己的 DOM。
 */
export function patchToyState(toyId, patch) {
    if (!toyId || !patch || typeof patch !== 'object') return;
    const current = STATE.scene.toyStates[toyId] || {};
    STATE.scene.toyStates[toyId] = { ...current, ...patch };
    STATE.scene.updatedAt = new Date().toISOString();
    schedulePersist();
}

/** 清掉某个主体的便签(「重来一次」时用) */
export function clearToyState(toyId) {
    if (!toyId || !STATE.scene.toyStates[toyId]) return;
    delete STATE.scene.toyStates[toyId];
    schedulePersist();
}

// ============================================================
// Mutators —— 音声
// ============================================================

export function setSoundEnabled(enabled) {
    STATE.scene.sound.enabled = !!enabled;
    commit();
}

export function setSoundPreset(presetId) {
    STATE.scene.sound.presetId = presetId;
    STATE.scene.sound.customId = null;
    STATE.scene.sound.enabled = true;
    commit();
}

export function setSoundCustom(customId) {
    STATE.scene.sound.customId = customId || null;
    STATE.scene.sound.enabled = true;
    commit();
}

export function setSoundVolume(volume) {
    STATE.scene.sound.volume = clampNumber(volume, 0, 1, STATE.scene.sound.volume);
    commit();
}

export function setHaptics(enabled) {
    STATE.scene.sound.haptics = !!enabled;
    commit();
}

// ============================================================
// Mutators —— 音色收藏 / 分组折叠
// ============================================================
//
// ★ 为什么不塞进 scene
//   scene 会被「重置舞台」清空、被「读取存档」整套替换,而「哪几个音是我的心头好」
//   是跨舞台的个人偏好 —— 换一套舞台不该把收藏也换掉。
//   数据本身只有一串 id,走 localStorage 同步读写还能免掉「等 hydrate 才有收藏」的闪一下。
//   (key 常量在文件顶部,理由见那里的注释)

/**
 * 收藏项的 key。内置音和自定义音的 id 来自两套命名空间(前者是手写常量,
 * 后者是 `sound-xxx` 自动生成),不加前缀迟早撞车。
 */
export function soundFavKey(kind, id) {
    return `${kind === 'custom' ? 'c' : 'p'}:${id}`;
}

function loadSoundPrefs() {
    const empty = { favorites: [], groups: {} };
    if (typeof localStorage === 'undefined') return empty;
    try {
        const raw = localStorage.getItem(SOUND_PREFS_KEY);
        if (!raw) return empty;
        const parsed = JSON.parse(raw);
        return {
            favorites: Array.isArray(parsed?.favorites)
                ? parsed.favorites.filter(item => typeof item === 'string')
                : [],
            groups: (parsed?.groups && typeof parsed.groups === 'object' && !Array.isArray(parsed.groups))
                ? parsed.groups
                : {},
        };
    } catch (err) {
        console.warn('[relax/store] 读取音色偏好失败,当作没有', err);
        return empty;
    }
}

function persistSoundPrefs() {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(SOUND_PREFS_KEY, JSON.stringify({
            favorites: [...STATE.soundPrefs.favorites],
            groups: JSON.parse(JSON.stringify(STATE.soundPrefs.groups)),
        }));
    } catch (err) {
        // 隐私模式 / 配额满都会抛 —— 收藏丢了不该把 app 带崩
        console.warn('[relax/store] 保存音色偏好失败', err);
    }
}

export function isSoundFavorite(key) {
    return !!key && STATE.soundPrefs.favorites.includes(key);
}

/** @returns {boolean} 切完之后是不是收藏状态 */
export function toggleSoundFavorite(key) {
    if (!key) return false;
    const list = STATE.soundPrefs.favorites;
    const next = list.includes(key) ? list.filter(item => item !== key) : [...list, key];
    STATE.soundPrefs.favorites = next;
    persistSoundPrefs();
    notify();
    return next.includes(key);
}

/**
 * 分组展开状态。scope 用来区分同屏的多个选择器(捏捏音 / 界面音 / 主体音),
 * 否则在一处展开「打击」,另外两处也跟着展开,面板会一下子拉得很长。
 * 没记录过的分组走调用方给的 fallback(默认只展开收藏 / 我的 / 第一组)。
 */
export function isSoundGroupOpen(scope, groupKey, fallback = false) {
    const bucket = STATE.soundPrefs.groups[scope];
    const saved = bucket ? bucket[groupKey] : undefined;
    return typeof saved === 'boolean' ? saved : !!fallback;
}

export function setSoundGroupOpen(scope, groupKey, open) {
    if (!scope || !groupKey) return;
    if (!STATE.soundPrefs.groups[scope]) STATE.soundPrefs.groups[scope] = {};
    STATE.soundPrefs.groups[scope][groupKey] = !!open;
    persistSoundPrefs();
    notify();
}

// ============================================================
// Mutators —— 界面点击音(点 tab / 瓦片 / 按钮时响的那一下)
// 跟上面「捏的时候」那套完全独立,互不影响。
// ============================================================

export function setUiSoundEnabled(enabled) {
    STATE.scene.uiSound.enabled = !!enabled;
    commit();
}

export function setUiSoundPreset(presetId) {
    STATE.scene.uiSound.presetId = presetId;
    // 选了内置音就不再用自定义音,否则 playSoundConfig 仍然优先播 customId
    STATE.scene.uiSound.customId = null;
    STATE.scene.uiSound.enabled = true;
    commit();
}

export function setUiSoundCustom(customId) {
    STATE.scene.uiSound.customId = customId || null;
    STATE.scene.uiSound.enabled = true;
    commit();
}

export function setUiSoundVolume(volume) {
    STATE.scene.uiSound.volume = clampNumber(volume, 0, 1, STATE.scene.uiSound.volume);
    commit();
}

/** 界面点击音选用的自定义音 record(给 playSoundConfig 当第二个参数) */
export function resolveUiCustomSound() {
    const { customId } = STATE.scene.uiSound;
    if (!customId) return null;
    return STATE.customSounds.find(item => item.id === customId) || null;
}

// ============================================================
// ★ Per-toy 音色覆盖 —— 「全局默认 + 每个按钮单独覆盖」模式
// ============================================================
//
// 每个主体可以单独指定一个音色(custom 或 preset 都行),
// 设了就走它,没设就走 scene.sound 全局。
//
// key = toy.id;value = { presetId?: string, customId?: string }
//   - 两者都为 null 视为「没设」,mutator 会清掉这条记录
//   - 两者都给了以 customId 优先(自定义 > 内置),跟 playSoundConfig 一致

/**
 * 给某个主体单独设音。patch 任意字段不传就保留旧值,显式传 null 表示清除该项。
 * @returns {boolean} 是否真的改了状态
 */
export function setToySound(toyId, patch = {}) {
    if (!toyId) return false;
    const current = STATE.scene.toySounds[toyId] || {};
    const next = { ...current };
    let changed = false;

    if ('presetId' in patch) {
        const v = patch.presetId || null;
        if (v !== current.presetId) { next.presetId = v; changed = true; }
    }
    if ('customId' in patch) {
        const v = patch.customId || null;
        if (v !== current.customId) { next.customId = v; changed = true; }
    }

    if (!changed) return false;

    if (next.presetId == null && next.customId == null) {
        // 都为空 → 清掉这条记录,scene.toySounds 里就完全没这个 key
        delete STATE.scene.toySounds[toyId];
    } else {
        STATE.scene.toySounds[toyId] = next;
    }
    commit();
    return true;
}

/**
 * 拿某个主体的「最终生效音色配置」。
 * 命中 per-toy 覆盖 → 用它;否则回退到 scene.sound。
 * 返回结构跟 scene.sound 一致(enabled / presetId / customId / volume / haptics)
 * 方便 playSoundConfig 直接吃。
 */
export function resolveActiveSoundConfig(toyId) {
    const base = STATE.scene.sound;
    if (!toyId) return base;
    const override = STATE.scene.toySounds[toyId];
    if (!override || (override.presetId == null && override.customId == null)) {
        return base;
    }
    return {
        ...base,
        presetId: override.customId ? base.presetId : (override.presetId || base.presetId),
        customId: override.customId || null,
    };
}

/** 某个主体对应的自定义音 record(用于 playSoundConfig 的 second arg) */
export function resolveActiveToyCustomSound(toyId) {
    const cfg = resolveActiveSoundConfig(toyId);
    if (!cfg.customId) return null;
    return STATE.customSounds.find(item => item.id === cfg.customId) || null;
}

/** 清除某个主体的所有覆盖,回到全局默认 */
export function clearToySound(toyId) {
    if (!toyId || !STATE.scene.toySounds[toyId]) return false;
    delete STATE.scene.toySounds[toyId];
    commit();
    return true;
}

// ============================================================
// Mutators —— 自定义资源列表(由 UI 调完 scene-store 后同步进来)
// ============================================================

export function setCustomSounds(list) {
    STATE.customSounds = Array.isArray(list) ? list : [];
    // 删掉的自定义音要顺手把收藏也摘掉,否则 localStorage 里会攒一堆死 key
    const alive = new Set(STATE.customSounds.map(item => soundFavKey('custom', item.id)));
    const kept = STATE.soundPrefs.favorites.filter(
        key => !key.startsWith('c:') || alive.has(key),
    );
    if (kept.length !== STATE.soundPrefs.favorites.length) {
        STATE.soundPrefs.favorites = kept;
        persistSoundPrefs();
    }
    notify();
}

export function setCustomImages(list) {
    STATE.customImages = Array.isArray(list) ? list : [];
    notify();
}

export function setCustomPlates(list) {
    STATE.customPlates = Array.isArray(list) ? list : [];
    notify();
}

export function setCustomDecorations(list) {
    STATE.customDecorations = Array.isArray(list) ? list : [];
    notify();
}

/** 找到 scene.sound.customId 对应的记录(播放时要拿 dataUrl) */
export function resolveActiveCustomSound() {
    const id = STATE.scene.sound.customId;
    if (!id) return null;
    return STATE.customSounds.find(item => item.id === id) || null;
}

export function resolveActiveCustomImage() {
    const id = STATE.scene.background.customImageId;
    if (!id) return null;
    return STATE.customImages.find(item => item.id === id) || null;
}

export function resolveActiveCustomPlate() {
    const id = STATE.scene.plate.customId;
    if (!id) return null;
    return STATE.customPlates.find(item => item.id === id) || null;
}

/**
 * 自定义装饰 record —— 通过 'custom:<id>' 形式的 presetId 反查。
 * 用在 stage / panels 渲染里。
 */
export function resolveCustomDecoration(presetId) {
    if (!presetId || !presetId.startsWith('custom:')) return null;
    const id = presetId.slice(7);
    return STATE.customDecorations.find(item => item.id === id) || null;
}

// ============================================================
// 整套舞台替换 / 重置
// ============================================================

export function applyScene(rawScene) {
    STATE.scene = normalizeScene({ ...rawScene, id: 'current' });
    STATE.selectedDecorationUid = null;
    commit();
}

export function resetScene() {
    STATE.scene = createDefaultScene();
    STATE.selectedDecorationUid = null;
    commit();
}

export function setSceneName(name) {
    STATE.scene.name = (name || '').trim().slice(0, 24) || '我的解压角';
    commit();
}
