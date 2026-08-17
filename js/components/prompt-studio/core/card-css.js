/**
 * prompt-studio / core / card-css.js
 * ------------------------------------------------------------
 * 第三方 App Prompt 卡片的 CSS 编辑器(阶段 1 步骤 1.3)
 *
 * 从 prompt-manager-page.js 原封不动搬过来(来源行号:88~220):
 *   - _CARD_CSS_PREFIX                常量
 *   - _DEFAULT_CARD_CSS_MAP           4 类卡片默认 CSS
 *   - getDefaultCardCss(previewType)
 *   - loadSavedCardCss(appId, promptId)
 *   - saveSavedCardCss(appId, promptId, css)
 *   - injectCardCss(compositeId, css)
 *
 * 函数签名 / 行为 0 修改。
 *
 * 副作用:模块顶层挂 `window.__injectCardCss` + `window.__getDefaultCardCss`
 *   - chat-app/index.js 的 module-level input 监听器调用
 *   - 阶段 1 保留该副作用,迁移后 chat-app 不变
 */

import { STATE_KEYS } from '../persistence/state-keys.js';

// ============================================================
// ★ v0.61.8.6 App Prompt 卡片 CSS 编辑器工具函数
//   - textarea 内容是 CSS 字符串(不是 JSON)
//   - 改了 CSS 实时注入到 <style> 标签,覆盖预览卡片样式
//   - 保存到 localStorage(不依赖 SDK,简单直接)
// ============================================================
const _CARD_CSS_PREFIX = STATE_KEYS.CARD_CSS_PREFIX; // 集中到 state-keys.js,避免重复硬编码

/**
 * 各类卡片的默认 CSS 模板。
 *
 * ── 为什么选择器变了 ──────────────────────────────────────────────
 *
 * 以前这些模板写的是 `.prompt-manager .pm-preview-card--music` —— 一套只存在于
 * 预览里的类名。于是用户在这里改半天，聊天里真正发出去的卡片纹丝不动：
 * 预览是一套 HTML、真实卡片是另一套，CSS 自然只能盖住其中一边。
 *
 * 现在预览和真实卡片都由 `share-cards.renderShareCardBody()` 画，类名统一成
 * `.song-share-card` / `.redpacket-card` / `.location-card-in-chat` 这些**真实**类名。
 * 模板也跟着改成它们，并且不再限定在 `.prompt-manager` 里 ——
 * 改一次，预览和聊天记录里的卡片一起变，这才是用户要的「覆盖卡片样式」。
 */
const _DEFAULT_CARD_CSS_MAP = {
    'music-card': `/* 音乐卡片 —— 预览和聊天里的卡片一起生效 */
.app-shell[data-app-id="chat"] .song-share-card {
    border-radius: 12px;
    padding: 10px 12px;
}
.app-shell[data-app-id="chat"] .song-share-title > div:first-child {
    font-size: 13px;
    font-weight: 600;
}
.app-shell[data-app-id="chat"] .song-share-subtitle {
    font-size: 11px;
    opacity: 0.82;
}`,
    'playlist-card': `/* 歌单卡片 —— 预览和聊天里的卡片一起生效 */
.app-shell[data-app-id="chat"] .playlist-share-card {
    border-radius: 12px;
    padding: 10px 12px;
}
.app-shell[data-app-id="chat"] .playlist-share-song {
    font-size: 11px;
    opacity: 0.8;
}`,
    'listen-together-card': `/* 一起听卡片 —— 预览和聊天里的卡片一起生效 */
.app-shell[data-app-id="chat"] .listen-together-card {
    border-radius: 12px;
    padding: 10px 12px;
}`,
    'red-packet-card': `/* 红包卡片 —— 预览和聊天里的卡片一起生效 */
.app-shell[data-app-id="chat"] .redpacket-card {
    border-radius: 10px;
    overflow: hidden;
}
.app-shell[data-app-id="chat"] .redpacket-header {
    background: linear-gradient(135deg, #E94560 0%, #C0394B 100%);
}
.app-shell[data-app-id="chat"] .redpacket-title {
    font-size: 13px;
    font-weight: 600;
}
.app-shell[data-app-id="chat"] .redpacket-sender {
    font-size: 11px;
    opacity: 0.84;
}`,
    'transfer-card': `/* 转账卡片 —— 预览和聊天里的卡片一起生效 */
.app-shell[data-app-id="chat"] .transfer-card {
    border-radius: 10px;
    overflow: hidden;
}
.app-shell[data-app-id="chat"] .transfer-amount {
    font-size: 16px;
    font-weight: 700;
}`,
    'location-card': `/* 位置卡片 —— 预览和聊天里的卡片一起生效 */
.app-shell[data-app-id="chat"] .location-card-in-chat {
    border-radius: 10px;
    overflow: hidden;
}
.app-shell[data-app-id="chat"] .location-card-name {
    font-size: 13px;
    font-weight: 600;
}
.app-shell[data-app-id="chat"] .location-card-address {
    font-size: 11px;
    opacity: 0.7;
}`,
    'text': `/* 文本预览 —— 这一种在聊天里就是普通气泡，没有专门的卡片 */
.app-shell[data-app-id="chat"] .pm-preview-card--text {
    background: #FFFFFF;
    border: 1px solid rgba(168, 200, 236, 0.32);
    border-radius: 10px;
    padding: 8px 12px;
}
.app-shell[data-app-id="chat"] .pm-preview-card__text {
    font-size: 13px;
    color: #222;
    line-height: 1.5;
}`,
};

/**
 * 读取某类卡片的默认 CSS
 * @param {string} previewType  见 app-prompt-card.js 的 PREVIEW_TYPES
 * @returns {string}
 */
export function getDefaultCardCss(previewType) {
    return _DEFAULT_CARD_CSS_MAP[previewType] || _DEFAULT_CARD_CSS_MAP.text;
}

/**
 * 从 localStorage 读取已保存的 CSS 覆盖
 * @param {string} appId
 * @param {string} promptId
 * @returns {string}  空串表示无覆盖
 */
export function loadSavedCardCss(appId, promptId) {
    if (typeof localStorage === 'undefined') return '';
    try {
        const raw = localStorage.getItem(_CARD_CSS_PREFIX + `${appId}::${promptId}`);
        if (!raw) return '';
        return String(raw);
    } catch (_) {
        return '';
    }
}

/**
 * 把用户编辑的 CSS 写入 localStorage
 * @param {string} appId
 * @param {string} promptId
 * @param {string} css
 * @returns {boolean}  true = 写入成功
 */
export function saveSavedCardCss(appId, promptId, css) {
    if (typeof localStorage === 'undefined') return false;
    try {
        localStorage.setItem(_CARD_CSS_PREFIX + `${appId}::${promptId}`, String(css || ''));
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * 把用户写的卡片 CSS 生效。
 *
 * ★ 注入到 `<head>` 而不是预览卡片内部。
 *
 * 以前是往 `.pm-special-card-preview` 里塞一个 `<style>`，作用域只有那张预览卡 ——
 * 用户改完预览变了、聊天里的卡片没变，等于「改了个寂寞」。既然预览和真实卡片
 * 现在是同一套 HTML，样式就该一次盖住两边。
 *
 * 每条 prompt 一个 `<style>`（id 里带 compositeId），互不覆盖、能单独清掉。
 */
export function injectCardCss(compositeId, css) {
    if (typeof document === 'undefined') return;
    // id 里只留 [A-Za-z0-9_-]：带冒号的 id 用 getElementById 能查到，但
    // querySelector('#a::b') 会被当成伪元素解析，后面接手的人很容易踩
    const safeId = `pm-card-css-${String(compositeId || '').replace(/[^\w-]/g, '_')}`;
    let styleEl = document.getElementById(safeId);
    const text = String(css || '');
    if (!text.trim()) {
        styleEl?.remove();
        return;
    }
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = safeId;
        styleEl.className = 'pm-preview-card-css-style';
        styleEl.setAttribute('data-preview-card', String(compositeId || ''));
        document.head.appendChild(styleEl);
    }
    styleEl.textContent = text;
}

/**
 * 页面启动时把所有存过的卡片 CSS 一次性铺开。
 *
 * 不这么做的话，用户改的样式只有「打开过一次那条 prompt 的编辑器」才生效，
 * 刷新之后聊天里的卡片又变回默认 —— 看起来像是设置没保存。
 */
export function applyAllSavedCardCss() {
    if (typeof localStorage === 'undefined') return 0;
    let n = 0;
    try {
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(_CARD_CSS_PREFIX)) continue;
            const compositeId = key.slice(_CARD_CSS_PREFIX.length);
            const css = localStorage.getItem(key);
            if (css && css.trim()) { injectCardCss(compositeId, css); n += 1; }
        }
    } catch (_) { /* 隐私模式下读不到就算了 */ }
    return n;
}

// 暴露到 window,供 chat-app/index.js 的 module-level input 监听器调用
//   副作用保留 —— 阶段 1 不动 chat-app,这个 window export 必须继续工作
if (typeof window !== 'undefined') {
    window.__injectCardCss = injectCardCss;
    window.__getDefaultCardCss = getDefaultCardCss;
    window.__applyAllSavedCardCss = applyAllSavedCardCss;
    // 模块一加载就把存过的样式铺上，不用等用户打开编辑器
    applyAllSavedCardCss();
}
