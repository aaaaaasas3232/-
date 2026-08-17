/**
 * relax-app / IndexedDB 持久化层
 *
 * 三张表(在 index.js 的 `stores: [...]` 里声明,由 registerPhoneAppAsync 建出来):
 *   relaxScenes  舞台存档。id='current' 是「当前正在用的那套」,其余是用户另存的存档
 *   relaxSounds  用户上传的自定义音(dataUrl)
 *   relaxImages  用户上传的自定义背景图(dataUrl)
 *
 * ★ 本层只做「读写 + 兜底」,不做任何 UI 状态管理 —— 那是 store.js 的活。
 * ★ 所有函数都不抛异常,失败返回 null / [] / false,调用方不用到处 try/catch。
 *   (解压 app 的核心体验是「点开就能捏」,数据库炸了也不该白屏)
 */

export const STORE_SCENES = 'relaxScenes';
export const STORE_SOUNDS = 'relaxSounds';
export const STORE_IMAGES = 'relaxImages';
export const STORE_PLATES = 'relaxPlates';
export const STORE_DECORATIONS = 'relaxDecorations';

/** 当前舞台的固定主键 */
export const CURRENT_SCENE_ID = 'current';

/** 自定义资源的体积上限(dataURL 字符数),防止把 IndexedDB 塞爆 */
const MAX_SOUND_CHARS = 3 * 1024 * 1024;   // ≈ 2.2MB 原文件
const MAX_IMAGE_CHARS = 6 * 1024 * 1024;   // ≈ 4.4MB 原文件
const MAX_PLATE_CHARS = 6 * 1024 * 1024;   // 盘子 PNG 兜底
const MAX_DECO_CHARS = 4 * 1024 * 1024;    // 装饰贴纸兜底

function db(app) {
    return app?.toolkit?.db || null;
}

function newId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * ★ 深拷成「纯数据」再写库 —— 这一步不能省。
 *
 * store.js 的 STATE 是 `Vue.reactive(...)`,读出来的每一层都是 Proxy。
 * IndexedDB 走结构化克隆,而**结构化克隆拒绝 Proxy**,直接写会抛:
 *   DataCloneError: Proxy object could not be cloned.
 * 而且它是运行时才炸,build / lint 都发现不了 —— 表现是「改了没保存,刷新就没了」。
 *
 * scene 是纯数据(字符串 / 数字 / 布尔 / 数组 / 普通对象,时间戳都用 ISO 字符串),
 * 所以 JSON 往返既能彻底剥掉 Proxy,又不会丢信息。
 * ⚠️ 以后往 scene 里加字段时别放 Date / Map / Blob / 函数,否则要换克隆方式。
 */
function toPlain(value) {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (err) {
        console.warn('[relax/scene-store] 序列化失败', err);
        return null;
    }
}

// ============================================================
// 舞台存档
// ============================================================

export async function loadCurrentScene(app) {
    const store = db(app);
    if (!store) return null;
    try {
        return (await store.get(STORE_SCENES, CURRENT_SCENE_ID)) || null;
    } catch (err) {
        console.warn('[relax/scene-store] 读取当前舞台失败', err);
        return null;
    }
}

export async function saveCurrentScene(app, scene) {
    const store = db(app);
    if (!store || !scene) return false;
    const plain = toPlain(scene);
    if (!plain) return false;
    try {
        await store.put(STORE_SCENES, {
            ...plain,
            id: CURRENT_SCENE_ID,
            updatedAt: new Date().toISOString(),
        });
        return true;
    } catch (err) {
        console.warn('[relax/scene-store] 保存当前舞台失败', err);
        return false;
    }
}

/** 用户「另存为」一套舞台 */
export async function saveSceneAs(app, scene, name) {
    const store = db(app);
    if (!store || !scene) return null;
    const plain = toPlain(scene);
    if (!plain) return null;
    const record = {
        ...plain,
        id: newId('scene'),
        name: (name || '未命名舞台').trim().slice(0, 24),
        savedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    try {
        await store.put(STORE_SCENES, record);
        return record;
    } catch (err) {
        console.warn('[relax/scene-store] 另存舞台失败', err);
        return null;
    }
}

/** 已存档的舞台(不含 id='current' 那条),按保存时间倒序 */
export async function listSavedScenes(app) {
    const store = db(app);
    if (!store) return [];
    try {
        const all = (await store.getAllRecords(STORE_SCENES)) || [];
        return all
            .filter(item => item?.id && item.id !== CURRENT_SCENE_ID)
            .sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')));
    } catch (err) {
        console.warn('[relax/scene-store] 读取舞台存档失败', err);
        return [];
    }
}

export async function deleteSavedScene(app, sceneId) {
    const store = db(app);
    if (!store || !sceneId || sceneId === CURRENT_SCENE_ID) return false;
    try {
        await store.remove(STORE_SCENES, sceneId);
        return true;
    } catch (err) {
        console.warn('[relax/scene-store] 删除舞台存档失败', err);
        return false;
    }
}

// ============================================================
// 自定义音
// ============================================================

export async function listCustomSounds(app) {
    const store = db(app);
    if (!store) return [];
    try {
        const all = (await store.getAllRecords(STORE_SOUNDS)) || [];
        return all
            .filter(item => item?.id && item?.dataUrl)
            .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    } catch (err) {
        console.warn('[relax/scene-store] 读取自定义音失败', err);
        return [];
    }
}

export async function getCustomSound(app, soundId) {
    const store = db(app);
    if (!store || !soundId) return null;
    try {
        return (await store.get(STORE_SOUNDS, soundId)) || null;
    } catch (err) {
        console.warn('[relax/scene-store] 读取自定义音失败', err);
        return null;
    }
}

/**
 * @returns {Promise<{ok:true, record:object} | {ok:false, reason:string}>}
 */
export async function addCustomSound(app, { name, dataUrl, duration = 0 }) {
    const store = db(app);
    if (!store) return { ok: false, reason: '数据库未就绪' };
    if (!dataUrl) return { ok: false, reason: '文件读取失败' };
    if (dataUrl.length > MAX_SOUND_CHARS) return { ok: false, reason: '音频太大,请选 2MB 以内的文件' };

    const record = {
        id: newId('sound'),
        name: (name || '自定义音').trim().slice(0, 20),
        dataUrl,
        duration,
        createdAt: new Date().toISOString(),
    };
    try {
        await store.put(STORE_SOUNDS, record);
        return { ok: true, record };
    } catch (err) {
        console.warn('[relax/scene-store] 保存自定义音失败', err);
        return { ok: false, reason: '保存失败' };
    }
}

export async function removeCustomSound(app, soundId) {
    const store = db(app);
    if (!store || !soundId) return false;
    try {
        await store.remove(STORE_SOUNDS, soundId);
        return true;
    } catch (err) {
        console.warn('[relax/scene-store] 删除自定义音失败', err);
        return false;
    }
}

// ============================================================
// 自定义背景图
// ============================================================

export async function listCustomImages(app) {
    const store = db(app);
    if (!store) return [];
    try {
        const all = (await store.getAllRecords(STORE_IMAGES)) || [];
        return all
            .filter(item => item?.id && item?.dataUrl)
            .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    } catch (err) {
        console.warn('[relax/scene-store] 读取自定义背景失败', err);
        return [];
    }
}

export async function getCustomImage(app, imageId) {
    const store = db(app);
    if (!store || !imageId) return null;
    try {
        return (await store.get(STORE_IMAGES, imageId)) || null;
    } catch (err) {
        console.warn('[relax/scene-store] 读取自定义背景失败', err);
        return null;
    }
}

export async function addCustomImage(app, { name, dataUrl }) {
    const store = db(app);
    if (!store) return { ok: false, reason: '数据库未就绪' };
    if (!dataUrl) return { ok: false, reason: '文件读取失败' };
    if (dataUrl.length > MAX_IMAGE_CHARS) return { ok: false, reason: '图片太大,请选 4MB 以内的文件' };

    const record = {
        id: newId('image'),
        name: (name || '自定义背景').trim().slice(0, 20),
        dataUrl,
        createdAt: new Date().toISOString(),
    };
    try {
        await store.put(STORE_IMAGES, record);
        return { ok: true, record };
    } catch (err) {
        console.warn('[relax/scene-store] 保存自定义背景失败', err);
        return { ok: false, reason: '保存失败' };
    }
}

export async function removeCustomImage(app, imageId) {
    const store = db(app);
    if (!store || !imageId) return false;
    try {
        await store.remove(STORE_IMAGES, imageId);
        return true;
    } catch (err) {
        console.warn('[relax/scene-store] 删除自定义背景失败', err);
        return false;
    }
}

// ============================================================
// 通用:File → dataURL
// ============================================================

export function fileToDataUrl(file) {
    return new Promise((resolve) => {
        if (!file) {
            resolve(null);
            return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
    });
}

// ============================================================
// 自定义盘子
// ============================================================
//
// 用户上传的盘子是一张 PNG / SVG 图片,展示时直接当 backgroundImage 用。
// 用户可以给上传的盘子染色(tint 会通过 CSS 滤镜叠加),但形状由图片本身决定。
//
// 契约:
//   { id, name, dataUrl, tintable, createdAt }

export async function listCustomPlates(app) {
    const store = db(app);
    if (!store) return [];
    try {
        const all = (await store.getAllRecords(STORE_PLATES)) || [];
        return all
            .filter(item => item?.id && item?.dataUrl)
            .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    } catch (err) {
        console.warn('[relax/scene-store] 读取自定义盘子失败', err);
        return [];
    }
}

export async function addCustomPlate(app, { name, dataUrl }) {
    const store = db(app);
    if (!store) return { ok: false, reason: '数据库未就绪' };
    if (!dataUrl) return { ok: false, reason: '文件读取失败' };
    if (dataUrl.length > MAX_PLATE_CHARS) return { ok: false, reason: '图片太大,请选 4MB 以内的文件' };

    const record = {
        id: newId('plate'),
        name: (name || '自定义盘子').trim().slice(0, 20),
        dataUrl,
        createdAt: new Date().toISOString(),
    };
    try {
        await store.put(STORE_PLATES, record);
        return { ok: true, record };
    } catch (err) {
        console.warn('[relax/scene-store] 保存自定义盘子失败', err);
        return { ok: false, reason: '保存失败' };
    }
}

export async function removeCustomPlate(app, plateId) {
    const store = db(app);
    if (!store || !plateId) return false;
    try {
        await store.remove(STORE_PLATES, plateId);
        return true;
    } catch (err) {
        console.warn('[relax/scene-store] 删除自定义盘子失败', err);
        return false;
    }
}

// ============================================================
// 自定义装饰
// ============================================================
//
// 用户上传的装饰是一张 PNG / SVG 图片,展示时直接当 img 用。
// tintable: 留个开关,默认 false —— 用户图本身就定色,再叠 tint 会脏。
//
// 契约:
//   { id, name, dataUrl, tintable, aspect, createdAt }

export async function listCustomDecorations(app) {
    const store = db(app);
    if (!store) return [];
    try {
        const all = (await store.getAllRecords(STORE_DECORATIONS)) || [];
        return all
            .filter(item => item?.id && item?.dataUrl)
            .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    } catch (err) {
        console.warn('[relax/scene-store] 读取自定义装饰失败', err);
        return [];
    }
}

export async function addCustomDecoration(app, { name, dataUrl, aspect = 1 }) {
    const store = db(app);
    if (!store) return { ok: false, reason: '数据库未就绪' };
    if (!dataUrl) return { ok: false, reason: '文件读取失败' };
    if (dataUrl.length > MAX_DECO_CHARS) return { ok: false, reason: '图片太大,请选 3MB 以内的文件' };

    const record = {
        id: newId('deco'),
        name: (name || '自定义贴纸').trim().slice(0, 20),
        dataUrl,
        // 用户图不知道真实 aspect,默认正方形;后续可以读 image 头修正。
        aspect: Number(aspect) || 1,
        tintable: false,
        createdAt: new Date().toISOString(),
    };
    try {
        await store.put(STORE_DECORATIONS, record);
        return { ok: true, record };
    } catch (err) {
        console.warn('[relax/scene-store] 保存自定义装饰失败', err);
        return { ok: false, reason: '保存失败' };
    }
}

export async function removeCustomDecoration(app, decoId) {
    const store = db(app);
    if (!store || !decoId) return false;
    try {
        await store.remove(STORE_DECORATIONS, decoId);
        return true;
    } catch (err) {
        console.warn('[relax/scene-store] 删除自定义装饰失败', err);
        return false;
    }
}
