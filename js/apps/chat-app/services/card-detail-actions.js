/**
 * 图片 / 地点详情弹窗上的收藏、分享。
 * 有消息 id 就走真实收藏和转发；朋友圈那种没有会话的，用传入的快照兜底。
 */

import { externalAppRegistry } from '@/src/core/app-registry.js';

export function collectCardContext(cardEl) {
    const wrapper = cardEl?.closest?.('.message-wrapper');
    const root = cardEl?.closest?.('.chat-private, .chat-group');
    const messageId = String(cardEl?.dataset?.msgId || wrapper?.dataset?.messageId || '').trim();
    const conversationType = root?.dataset?.conversationType
        || (root?.classList?.contains('chat-group') ? 'group' : 'private');
    const conversationId = String(
        wrapper?.dataset?.msgAi
        || root?.dataset?.conversationId
        || root?.dataset?.groupId
        || '',
    ).trim();
    const mode = String(wrapper?.dataset?.msgMode || root?.dataset?.mode || 'calendar');
    const conversationName = String(root?.dataset?.conversationName || '');
    return { messageId, conversationId, mode, conversationType, conversationName };
}

function activeUser() {
    const sdk = window.settingsSdk;
    return sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.() || null;
}

export function isCardFavorited(ctx = {}) {
    const sdk = window.settingsSdk;
    const user = activeUser();
    const id = ctx.messageId || ctx.fallbackMessage?.id;
    const convId = ctx.conversationId;
    if (!sdk?.chatFavorites?.has || !user || !id || !convId) return false;
    try {
        return !!sdk.chatFavorites.has(user, convId, ctx.mode || 'calendar', id);
    } catch (_) {
        return false;
    }
}

export async function favoriteCardFromContext(ctx = {}) {
    const messageId = ctx.messageId || ctx.fallbackMessage?.id;
    const conversationId = ctx.conversationId || (ctx.fallbackMessage ? 'moments' : '');
    if (!messageId || !conversationId) {
        window.__phoneIsland?.notify?.('warning', '收藏失败', '找不到这条内容');
        return false;
    }
    const inst = externalAppRegistry?.getApp?.('chat') || window.__chatAppSingleton;
    if (inst?.methods?.favoriteMessage && ctx.messageId && ctx.conversationId) {
        await inst.methods.favoriteMessage({
            messageId,
            aiPersonId: conversationId,
            mode: ctx.mode || 'calendar',
            conversationType: ctx.conversationType || 'private',
            silentRerender: true,
        });
        syncFavoriteButtonState(ctx);
        return true;
    }
    const sdk = window.settingsSdk;
    const user = activeUser();
    if (!sdk?.chatFavorites || !user) {
        window.__phoneIsland?.notify?.('error', '收藏服务未就绪');
        return false;
    }
    const mode = ctx.mode || 'calendar';
    const fallback = ctx.fallbackMessage;
    if (sdk.chatFavorites.has(user, conversationId, mode, messageId)) {
        await sdk.chatFavorites.remove(user, conversationId, mode, messageId);
        window.__phoneIsland?.notify?.('info', '已取消收藏');
        return true;
    }
    if (!fallback) {
        window.__phoneIsland?.notify?.('warning', '收藏失败', '找不到这条内容');
        return false;
    }
    await sdk.chatFavorites.add(user, conversationId, mode, fallback, {
        sourceType: ctx.conversationType === 'group' ? 'group' : 'private',
        conversationId,
        messageType: fallback.type || 'text',
        contactName: ctx.conversationName || '',
    });
    window.__phoneIsland?.notify?.('success', '已收藏');
    syncFavoriteButtonState(ctx);
    return true;
}

function syncFavoriteButtonState(ctx) {
    const on = isCardFavorited(ctx);
    try {
        document.querySelectorAll(
            '.desc-image-detail-modal .card-detail-icon-btn[aria-label="收藏"],'
            + ' .location-card-detail-modal .card-detail-icon-btn[aria-label="收藏"]',
        ).forEach((btn) => btn.classList.toggle('is-on', on));
    } catch (_) {}
}

export async function shareCardFromContext(ctx = {}) {
    const sdk = window.settingsSdk;
    const user = activeUser();
    if (!sdk || !user) {
        window.__phoneIsland?.notify?.('error', 'SDK 未就绪');
        return false;
    }
    const mode = ctx.mode || 'calendar';
    const conversationId = ctx.conversationId || '';
    let msg = null;
    if (ctx.messageId && conversationId && sdk.chatMessages?.list) {
        const list = sdk.chatMessages.list(user, conversationId, mode) || [];
        msg = list.find((m) => m && m.id === ctx.messageId) || null;
    }
    if (!msg) msg = ctx.fallbackMessage || null;
    if (!msg?.id) {
        window.__phoneIsland?.notify?.('warning', '分享失败', '找不到这条内容');
        return false;
    }
    const { openForwardTargetSelection } = await import('../chat-forward.js');
    await openForwardTargetSelection({
        mode,
        messageIds: [msg.id],
        sourceMessages: [msg],
        sourceMeta: {
            conversationType: ctx.conversationType || 'private',
            conversationId: conversationId || msg.conversationId || '',
            conversationName: ctx.conversationName || '分享',
            mode,
        },
    });
    return true;
}
