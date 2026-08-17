/**
 * 氧气 · murmur 桥（分享帖子卡）
 *
 * 必须能在「氧气从没被打开过」的情况下工作：AI 在 murmur 里发
 * `[分享帖子:…]` 时，氧气的组件没挂载、store 没 hydrate。所以这里不
 * import store，只写消息；卡片点击后的详情恢复走 appConfig.services.contentCards。
 *
 * 卡片消息三处对齐（少一处画不出来，AGENTS2 §16 购物同款）：
 *   1. 这里写入的 `type: 'blog_post_share'`
 *   2. chat-app/components/message-renderer.js 的注册表
 *   3. chat-app/components/share-cards.js 的 renderBlogPostBubble
 */

import { CHAT_CARD_TYPE } from '../constants.js';
import { asArray, truncate } from '../utils.js';

const VALID_MODES = new Set(['calendar', 'story']);

/** 会话 mode：优先看 chat 里正打开的那个会话，否则回落 calendar */
function resolveMode(aiId, preferred) {
    if (preferred && VALID_MODES.has(preferred)) return preferred;
    try {
        const el = document.querySelector(
            `.app-shell[data-app-id="chat"] [data-conversation-id="${CSS.escape(String(aiId))}"][data-mode]`,
        );
        const mode = el?.getAttribute('data-mode');
        if (mode && VALID_MODES.has(mode)) return mode;
    } catch (_) { /* CSS.escape 不支持时忽略 */ }
    return 'calendar';
}

async function addChatMessage(aiId, msg, mode) {
    const sdk = typeof window !== 'undefined' ? window.settingsSdk : null;
    if (!sdk?.chatMessages?.add || !aiId) return null;
    try {
        return await sdk.chatMessages.add(null, aiId, resolveMode(aiId, mode), msg);
    } catch (err) {
        console.warn('[blog] 写聊天消息失败', err);
        return null;
    }
}

/** 让聊天页把新消息画出来（chat 正开着才有可见效果） */
function pokeChat() {
    try {
        window.invalidateRendererCache?.('chat', null);
        window.__appRendererBridge?.syncNow?.({ force: true });
    } catch (_) { /* noop */ }
}

/**
 * 把一条帖子分享到某个 AI 的会话。
 * 卡里只放稳定 postId + 必要快照 —— 全文留在氧气里，
 * 点击卡片经 contentCard 确认协议恢复 / 生成详情。
 *
 * @param {{aiId:string, post:object, sender?:'user'|'ai', mode?:string, note?:string}} opts
 */
export async function sharePostToChat(opts = {}) {
    const { aiId, post, sender = 'user', mode, note = '' } = opts;
    if (!aiId || !post) return null;

    const tags = asArray(post.tags).map((t) => String(t || '').trim()).filter(Boolean).slice(0, 4);
    const record = await addChatMessage(aiId, {
        sender,
        type: CHAT_CARD_TYPE,
        content: `[帖子] ${tags.join(' / ') || '氧气上的一条帖子'}`,
        blogCard: {
            postId: String(post.id || ''),
            tags,
            type: String(post.type || 'short'),
            authorName: String(post.authorName || post.ownerName || ''),
            blurb: truncate(note || post.seed || '', 40),
        },
    }, mode);
    pokeChat();
    return record;
}
