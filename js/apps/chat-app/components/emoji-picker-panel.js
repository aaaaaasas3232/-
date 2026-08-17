/**
 * chat-app / 表情选择器面板（v0.49）
 *
 * 设计目标：
 *   - 用户在私聊/群聊页点击输入区右侧 #emojiBtn 笑脸 → 切换表情面板显示
 *   - 面板里展示当前 user persona 已绑定图组的所有图片
 *   - 点击图片 → 触发 sticker 消息发送（type: 'sticker', stickerCode 引用）
 *   - 没绑定图组时显示空状态 + 「去设置」按钮
 *
 * 数据源：
 *   - 当前 user (persona.boundResources.stickerGroupIds: string[])
 *   - gallery_db.groups / gallery_db.images
 *   - 缩略图 images.thumbnail (200×200 base64) 优先
 *   - 发送时按需懒加载 images.source
 *
 * 渲染方式（遵守 AGENTS.md §16.21）：
 *   - renderEmojiPickerPanel() 同步返回 HTML 字符串
 *   - 容器始终在 chat-page.js 的 v-html 字符串里,不要 appendChild
 *   - 显示/隐藏用 .chat-private[data-emoji-open="1"] CSS 属性切换
 *
 * 不做（v0.49 范围内）：
 *   - 不做搜索 / 分类 / 收藏 / 最近使用
 *   - 不做系统 emoji unicode 字符
 *   - 不做 AI 主动发表情
 *   - 不做表情消息的转发 / 编辑 / 删除（后续阶段接消息通用操作）
 */

import { escapeHtml } from '@/src/core/escape.js';
import { getAllLibraries, getLibraryAlbums, getAlbumGroups, getGroupImages, getImageByCode } from '@/js/apps/setting/gallery/gallery-db.js';

// ============================================
// 内部缓存
// ============================================

/**
 * 表情图片缓存
 * key: image.code
 * value: { code, groupId, groupName, albumName, libraryName, thumbnail, source? }
 *
 * 只缓存元数据 + thumbnail(小图),source 按需从 db 读
 */
const _emojiCache = new Map();

/**
 * 缓存版本号 — 跟 persona.boundResources.stickerGroupIds 长度变化绑定,
 * 任何 bound/unbound 操作后由调用方 _invalidateEmojiCache() 清空
 */
let _emojiCacheKey = '';

/**
 * 让表情缓存失效
 * 业务:personaResourcesPickerConfirm add/remove 后 / 启动时 / 切换 user 时调一下
 */
export function _invalidateEmojiCache() {
    _emojiCache.clear();
    _emojiCacheKey = '';
}

/**
 * 计算缓存 key — stickerGroupIds 排序后拼字符串
 * @param {string[]} ids
 * @returns {string}
 */
function _computeCacheKey(ids) {
    return Array.isArray(ids) ? ids.slice().sort().join('|') : '';
}

/**
 * 加载图库里某个图组的图片(只取 code 列表 + 元数据)
 * thumbnail 按需懒加载,不在这里读 base64
 * @param {string} groupId
 * @returns {Promise<Array<{code, groupId, groupName, albumName, libraryName}>>}
 */
async function _loadGroupImages(groupId) {
    if (_emojiCache.has(groupId)) return _emojiCache.get(groupId);
    try {
        const groups = await _findGroupPath(groupId);
        if (!groups) {
            _emojiCache.set(groupId, []);
            return [];
        }
        const images = await getGroupImages(groupId);
        const enriched = images.map((img) => ({
            code: img.code,
            groupId,
            groupName: groups.group.name || '',
            albumName: groups.album.name || '',
            libraryName: groups.library.name || '',
        }));
        _emojiCache.set(groupId, enriched);
        return enriched;
    } catch (err) {
        console.warn('[emoji-picker] load group images failed', groupId, err);
        _emojiCache.set(groupId, []);
        return [];
    }
}

/**
 * 找图组的路径(库 → 包 → 组)
 * @param {string} groupId
 * @returns {Promise<{library, album, group} | null>}
 */
async function _findGroupPath(groupId) {
    try {
        const libs = await getAllLibraries();
        for (const library of libs) {
            const albums = await getLibraryAlbums(library.id);
            for (const album of albums) {
                const groups = await getAlbumGroups(album.id);
                const found = groups.find(g => g.id === groupId);
                if (found) return { library, album, group: found };
            }
        }
    } catch (err) {
        console.warn('[emoji-picker] _findGroupPath failed', groupId, err);
    }
    return null;
}

/**
 * 异步获取 image 的 thumbnail (base64)
 * @param {string} code
 * @returns {Promise<string>} base64 data URL
 */
export async function _loadThumbnail(code) {
    try {
        const img = await getImageByCode(code);
        return img ? (img.thumbnail || img.source || '') : '';
    } catch (err) {
        console.warn('[emoji-picker] load thumbnail failed', code, err);
        return '';
    }
}

/**
 * 异步获取 image 的原图 (base64)
 * 用于发送 sticker 消息时构造 msg.url
 * @param {string} code
 * @returns {Promise<string>} base64 data URL
 */
export async function _loadSource(code) {
    try {
        const img = await getImageByCode(code);
        return img ? (img.source || img.thumbnail || '') : '';
    } catch (err) {
        console.warn('[emoji-picker] load source failed', code, err);
        return '';
    }
}

// ============================================
// 公开 API — 同步渲染入口（v-html 上下文用）
// ============================================

/**
 * 同步渲染表情选择器面板的 HTML 字符串
 *
 * 注意:这个函数同步返回,不等待图片加载 —
 *   缩略图由 CSS is-loading shimmer 占位,渲染后异步填充 src
 *   这样做的好处:v-html 渲染不卡顿,表情图按需就位
 *
 * @param {Object} options
 * @param {string[]} options.stickerGroupIds 当前 user persona 绑定的图组 id 列表
 * @param {Object} [options.emojiByCode] 可选 — 已加载的图片缓存 { code → {thumbnail, ...} }
 * @returns {string} HTML 字符串
 */
export function renderEmojiPickerPanel(options = {}) {
    const { stickerGroupIds = [], emojiByCode = {} } = options;
    const ids = Array.isArray(stickerGroupIds) ? stickerGroupIds : [];

    // 缓存命中检查
    const cacheKey = _computeCacheKey(ids);
    const cacheHit = cacheKey === _emojiCacheKey && _emojiCache.size > 0;

    if (ids.length === 0) {
        return renderEmojiEmpty('暂未绑定表情包', '前往「设置 → 人设 → 资源绑定」选择图组');
    }

    if (!cacheHit) {
        // 缓存失效 — 让 chat-page 在 render 后调 _refreshEmojiPickerAsync()
        // 重新加载并触发 Vue 重画
        return renderEmojiLoading();
    }

    // 命中缓存,从 _emojiCache 里聚合所有图片
    const allImages = [];
    for (const gid of ids) {
        const groupImages = _emojiCache.get(gid) || [];
        for (const meta of groupImages) {
            allImages.push(meta);
        }
    }

    if (allImages.length === 0) {
        return renderEmojiEmpty('已绑定的图组暂无图片', '去图库给图组添加图片');
    }

    return renderEmojiGrid(allImages, emojiByCode);
}

// ============================================
// 异步填充入口 — render 后调用,直接操作 DOM
// ============================================

/**
 * 异步加载表情数据,加载完成后把 thumbnail 直接填进 picker 的 <img> 元素
 *
 * 关键:不触发 framework 重画(避免 v-html 替换破坏其他 listener),
 *   直接 querySelector 找到每个 .chat-emoji-cell,把 is-loading 换成 src
 *
 * 调用方:chat-page.js 在 render 后调一下
 *
 * @param {HTMLElement} chatRoot .chat-private 根元素
 * @param {string[]} stickerGroupIds
 * @returns {Promise<number>} 加载完成的图片数
 */
export async function _fillEmojiPickerImages(chatRoot, stickerGroupIds = []) {
    if (!chatRoot) return 0;
    const ids = Array.isArray(stickerGroupIds) ? stickerGroupIds : [];

    // 收集所有需要填 src 的 cell
    const cells = chatRoot.querySelectorAll('.chat-emoji-cell[data-sticker-code]');
    if (cells.length === 0) return 0;

    // ★ 性能优化:批量去重 code,每个 code 只查一次 db
    const codes = new Set();
    cells.forEach((cell) => {
        const code = cell.getAttribute('data-sticker-code');
        if (code) codes.add(code);
    });

    // 并行加载所有 thumbnail
    const tasks = Array.from(codes).map(async (code) => {
        const src = await _loadThumbnail(code);
        return { code, src };
    });
    const results = await Promise.all(tasks);
    const srcMap = new Map(results.map(r => [r.code, r.src]));

    // 把 src 填回每个 cell
    let filled = 0;
    cells.forEach((cell) => {
        const code = cell.getAttribute('data-sticker-code');
        const src = srcMap.get(code);
        if (!src) return;
        // 移除 is-loading,塞 img
        cell.classList.remove('is-loading');
        let img = cell.querySelector('img');
        if (!img) {
            img = document.createElement('img');
            img.alt = '';
            img.loading = 'lazy';
            cell.appendChild(img);
        }
        img.src = src;
        filled++;
    });

    return filled;
}

/**
 * 让 picker 重新检测 stickerGroupIds(强制刷新)
 * 用法:settings 里 add/remove 图组绑定后调一下
 */
export function refreshEmojiCache() {
    _emojiCacheKey = '';
}

/**
 * ★ v0.49.1 修复:在 renderEmojiPickerPanel 第一次返回 loading HTML 之前,
 *   主动把所有 stickerGroupIds 对应的图组图片元数据加载进 _emojiCache,
 *   加载完调 bridge.syncNow({ force: true }) 触发 framework 重画 detail 页,
 *   重画时 renderEmojiPickerPanel 会命中缓存,返回真实网格 HTML。
 *
 *   修复前问题:renderEmojiPickerPanel 同步返回 loading HTML,DOM 里只有
 *   loading 占位,没有 .chat-emoji-cell[data-sticker-code],
 *   _fillEmojiPickerImages 永远查不到 cell → 永远不填缓存 → 死锁。
 *
 * @param {string[]} stickerGroupIds 当前 user persona 绑定的图组 id 列表
 * @param {HTMLElement} [chatRoot] 可选 — 如果提供,加载完直接 fill 缩略图到当前 picker DOM
 * @returns {Promise<{loaded:number, empty:number}>} 加载结果
 */
export async function _prerenderEmojiPicker(stickerGroupIds = [], chatRoot = null) {
    const ids = Array.isArray(stickerGroupIds) ? stickerGroupIds : [];
    if (ids.length === 0) {
        // 没绑图组 — 清缓存,下次有绑定时能重新加载
        if (_emojiCacheKey !== '' || _emojiCache.size > 0) {
            _emojiCache.clear();
            _emojiCacheKey = '';
        }
        return { loaded: 0, empty: 0 };
    }

    const cacheKey = _computeCacheKey(ids);

    // ★ 自动失效检测:缓存 key 跟当前 ids 不一致(用户改了绑定 / 切换了 user)→ 清缓存重载
    if (_emojiCacheKey !== '' && _emojiCacheKey !== cacheKey) {
        _emojiCache.clear();
        _emojiCacheKey = '';
    }

    // 缓存已命中就不用再加载(但还是要 fill,因为可能 chatRoot 是新节点)
    const alreadyLoaded = cacheKey === _emojiCacheKey && _emojiCache.size > 0;

    if (!alreadyLoaded) {
        let loaded = 0;
        let empty = 0;
        for (const gid of ids) {
            if (_emojiCache.has(gid)) continue;
            try {
                const groups = await _findGroupPath(gid);
                if (!groups) {
                    _emojiCache.set(gid, []);
                    empty++;
                    continue;
                }
                const images = await getGroupImages(gid);
                const enriched = images.map((img) => ({
                    code: img.code,
                    groupId: gid,
                    groupName: groups.group.name || '',
                    albumName: groups.album.name || '',
                    libraryName: groups.library.name || '',
                }));
                _emojiCache.set(gid, enriched);
                loaded++;
            } catch (err) {
                console.warn('[emoji-picker] prerender failed for', gid, err);
                _emojiCache.set(gid, []);
                empty++;
            }
        }
        // 缓存填完后,设置 cacheKey 让 renderEmojiPickerPanel 命中
        _emojiCacheKey = cacheKey;

        // ★ 触发 framework 重画 detail 页 —— renderEmojiPickerPanel 第二次会命中缓存,返回真实 HTML
        //   ★★ v0.49.1 chat-app hybrid 模式:renderPage(sync) 是屏区渲染,
        //   needsRemount 看 mode !== 'template' && lastKey.tickVal !== tickVal,
        //   bridge.syncNow({force:true}) 只对 detail 分支生效,屏区必须 ++tick。
        //   settings-app renderDetailPage 也是 sync,同理 ++tick 安全。
        //   (v0.38 死循环针对的是 async renderer,这里 renderPage 是 sync 不会撞)
        if (typeof window !== 'undefined') {
            if (window.__detailRenderTick && typeof window.__detailRenderTick.value === 'number') {
                window.__detailRenderTick.value++;
            }
            const bridge = window.__appRendererBridge;
            if (bridge && typeof bridge.syncNow === 'function') {
                try { bridge.syncNow({ force: true }); } catch (_) {}
            }
        }
        return { loaded, empty };
    }

    // 缓存已命中,但调用方要求直接 fill(典型场景:emoji 按钮 toggle 打开,DOM 已存在)
    if (chatRoot) {
        return _fillEmojiPickerImages(chatRoot, ids).then((filled) => ({ loaded: 0, empty: 0, filled }));
    }
    return { loaded: 0, empty: 0 };
}

// ============================================
// 子渲染函数（模块顶层,不用 this）
// ============================================

/**
 * 渲染单个表情格
 * @param {Object} img {code, groupId, groupName, ...}
 * @param {Object} emojiByCode 缩略图缓存 { code → { thumbnail } }
 */
function renderEmojiCell(img, emojiByCode) {
    const code = escapeHtml(img.code);
    const groupId = escapeHtml(img.groupId);
    const cached = emojiByCode && emojiByCode[img.code];
    const thumb = cached?.thumbnail || '';
    const src = thumb ? escapeHtml(thumb) : '';
    // ★ data-sticker-code 给 click delegate 用,data-sticker-group 给调试用
    return `
        <button class="chat-emoji-cell${thumb ? '' : ' is-loading'}" type="button"
            data-sticker-code="${code}"
            data-sticker-group="${groupId}"
            aria-label="表情 ${escapeHtml(img.groupName || '')}">
            ${thumb ? `<img src="${src}" alt="" loading="lazy" />` : ''}
        </button>
    `;
}

/**
 * 渲染 4 列网格
 */
function renderEmojiGrid(images, emojiByCode) {
    const cellsHtml = images.map(img => renderEmojiCell(img, emojiByCode)).join('');
    return `
        <div class="chat-emoji-grid" role="grid">
            ${cellsHtml}
        </div>
    `;
}

/**
 * 渲染加载中占位
 */
function renderEmojiLoading() {
    return `
        <div class="chat-emoji-loading">
            <div class="chat-emoji-loading__spinner"></div>
            <span>正在加载表情…</span>
        </div>
    `;
}

/**
 * 渲染空状态(没绑图组 / 图组没图片)
 *
 * 跳转目标:settings app → 人设编辑器 → 资源绑定 → 表情包库
 * 当前 user persona 的详情页 pageId = 'persona-user-{userId}' 或
 * 'persona-ai-{aiPersonId}'(由 settings/persona/renderer.js 决定)
 *
 * 用法:data-app-action detail 跳转 settings 的 persona 编辑器
 * 由 settings 那边定位到「资源绑定」section
 */
function renderEmojiEmpty(text, sub) {
    return `
        <div class="chat-emoji-empty">
            <div class="chat-emoji-empty__icon">
                <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                    <line x1="9" y1="9" x2="9.01" y2="9"/>
                    <line x1="15" y1="9" x2="15.01" y2="9"/>
                </svg>
            </div>
            <div class="chat-emoji-empty__text">${escapeHtml(text)}</div>
            <div class="chat-emoji-empty__sub">${escapeHtml(sub)}</div>
            <button class="chat-emoji-empty__cta" type="button"
                data-app-action='${escapeHtml(JSON.stringify({
                    action: 'openApp',
                    targetAppId: 'settings',
                    payload: { deepLink: 'persona-resources' },
                }))}'>
                <svg viewBox="0 0 24 24">
                    <path d="M9 18l6-6-6-6"/>
                </svg>
                去设置绑定
            </button>
        </div>
    `;
}

// ============================================
// 调试用 — 浏览器 console 里暴露
// ============================================

if (typeof window !== 'undefined') {
    window.__emojiPickerDebug = {
        cache: () => _emojiCache,
        invalidate: () => _invalidateEmojiCache(),
        loadThumb: _loadThumbnail,
        loadSource: _loadSource,
    };
}
