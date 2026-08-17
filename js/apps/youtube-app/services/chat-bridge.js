/**
 * 萤火 · murmur 桥（分享视频卡）
 *
 * ── 这个文件必须能在「萤火从没被打开过」的情况下工作 ──────────────
 * AI 在 murmur 里发 `[分享视频:…]` 时，萤火的组件没挂载、store 没 hydrate。
 * 所以这里不 import store，只写消息；卡片点击后的详情恢复走
 * appConfig.services.contentCards（那边会自己 hydrate）。
 *
 * 卡片消息三处对齐（少一处画不出来，AGENTS2 §16 购物同款）：
 *   1. 这里写入的 `type: 'youtube_video_share'`
 *   2. chat-app/components/message-renderer.js 的注册表
 *   3. chat-app/components/share-cards.js 的 renderYoutubeVideoBubble
 */

import { CHAT_CARD_TYPE } from '../constants.js';
import { truncate } from '../utils.js';

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
        console.warn('[youtube] 写聊天消息失败', err);
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
 * 把一条视频分享到某个 AI 的会话。
 * 卡里只放稳定 videoId + 必要快照 —— 全文留在萤火里，
 * 点击卡片经 contentCard 确认协议恢复 / 生成详情。
 *
 * @param {{aiId:string, video:object, sender?:'user'|'ai', mode?:string, note?:string}} opts
 */
export async function shareVideoToChat(opts = {}) {
    const { aiId, video, sender = 'user', mode, note = '' } = opts;
    if (!aiId || !video) return null;

    const record = await addChatMessage(aiId, {
        sender,
        type: CHAT_CARD_TYPE,
        content: `[视频] ${video.title || ''}`,
        youtubeCard: {
            videoId: String(video.id || ''),
            title: String(video.title || ''),
            coverText: String(video.coverText || ''),
            coverHue: Number(video.coverHue) || 0,
            creatorName: String(video.creatorName || video.ownerName || ''),
            kind: String(video.kind || ''),
            blurb: truncate(video.blurb || video.intro || '', 60),
            views: Number(video.views) || 0,
            durationSec: Number(video.durationSec) || 0,
            note: truncate(note, 60),
        },
    }, mode);
    pokeChat();
    return record;
}
