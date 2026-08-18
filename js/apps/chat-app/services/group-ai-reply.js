/**
 * 群聊长按发送 → 调各成员 API 回群
 *
 * 短按只落用户那条字，不打模型。长按在字已经发出去之后，
 * 按 @ 到的人（没 @ 就全员）一个一个 callAiAndSplit，写进这个群。
 */

import { callAiAndSplit, _resolveAiStickerFromHistory } from './ai-service.js';

function memberAliases(sdk, group, user, id) {
    const names = [];
    const resolved = sdk?.chatGroups?.resolveMemberName?.(
        sdk, group, id, user?.id || '', user?.name || '我',
    );
    if (resolved) names.push(resolved);
    const ai = sdk?.aiPersons?.get?.(id);
    if (ai?.name) names.push(ai.name);
    const chatNick = ai?.socialProfiles?.chat?.nickname;
    if (chatNick) names.push(chatNick);
    names.push(id);
    return [...new Set(names.map((n) => String(n || '').trim()).filter(Boolean))];
}

export function pickGroupSpeakers({ sdk, user, group, text }) {
    const ids = Array.isArray(group?.members) ? group.members.map(String).filter(Boolean) : [];
    if (!ids.length) return [];
    const src = String(text || '');
    if (/@所有人|@全体成员/.test(src)) return ids;
    if (!src.includes('@')) return ids;
    const hit = ids.filter((id) => memberAliases(sdk, group, user, id).some((n) => src.includes(`@${n}`)));
    return hit.length ? hit : ids;
}

function speakerLabel(sdk, group, user, id) {
    return sdk?.chatGroups?.resolveMemberName?.(
        sdk, group, id, user?.id || '', user?.name || '我',
    ) || sdk?.aiPersons?.get?.(id)?.name || id;
}

async function writeOneSpeakerMessages({
    sdk, user, groupId, mode, actorId, actorName, messages, history,
}) {
    let written = 0;
    let lastSaved = null;
    for (const msg of messages || []) {
        if (!msg) continue;
        try {
            if (msg.type === 'group_admin') {
                const svc = await import('./group-admin-service.js');
                await svc.applyGroupAdminActions({
                    sdk, user, groupId, mode,
                    actorId, actions: [msg.groupAdminAction],
                });
                continue;
            }
            if (msg.type === 'shop_gift_request') {
                const bridge = window.__shopGift;
                if (bridge?.aiGiftToUser && bridge.isReady?.()) {
                    const res = await bridge.aiGiftToUser({
                        aiPersonId: actorId, mode, ...(msg.shopGift || {}),
                    });
                    if (!res?.ok) console.warn('[group-ai-reply] 群里 AI 送礼没成功：', res?.error);
                }
                continue;
            }
            let resolvedMsg = msg;
            if (resolvedMsg.type === 'sticker') {
                resolvedMsg = await _resolveAiStickerFromHistory(resolvedMsg, actorId, mode, history);
            }
            resolvedMsg.sender = 'ai';
            if (!resolvedMsg.senderName) resolvedMsg.senderName = actorName;
            if (!resolvedMsg.timestamp) resolvedMsg.timestamp = Date.now() + written;
            const saved = await sdk.chatMessages.add(user, groupId, mode, {
                ...resolvedMsg,
                conversationType: 'group',
                conversationId: groupId,
                senderId: actorId,
            });
            if (saved) {
                written += 1;
                lastSaved = saved;
            }
        } catch (err) {
            console.warn('[group-ai-reply] 写群回复失败', actorId, err);
        }
    }
    return { written, lastSaved };
}

/**
 * 用户那条已经 doSend 落盘之后再调。
 * @returns {{ ok: boolean, replied: number, error?: string }}
 */
export async function replyInGroup({ groupId, mode = 'calendar', userText = '' } = {}) {
    const sdk = window.settingsSdk;
    if (!sdk) return { ok: false, replied: 0, error: 'settingsSdk 未就绪' };
    const user = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.();
    if (!user) return { ok: false, replied: 0, error: '未找到默认用户' };

    let group = sdk.chatGroups?.get?.(user, groupId, mode) || null;
    if (!group) {
        for (const m of ['calendar', 'story']) {
            const e = sdk.chatGroups?.get?.(user, groupId, m);
            if (e) { group = e; mode = e.mode || m; break; }
        }
    }
    if (!group) return { ok: false, replied: 0, error: '群聊已被删除' };

    const speakers = pickGroupSpeakers({ sdk, user, group, text: userText });
    if (!speakers.length) return { ok: false, replied: 0, error: '群里没有可回复的 AI' };

    let replied = 0;
    let lastError = '';
    let lastSaved = null;

    for (const actorId of speakers) {
        const actorName = speakerLabel(sdk, group, user, actorId);
        let history = [];
        try {
            history = sdk.chatMessages?.list?.(user, groupId, mode) || [];
        } catch (_) { history = []; }

        let result;
        try {
            result = await callAiAndSplit({
                aiPersonId: actorId,
                mode,
                userText: userText || '（请根据当前群聊上下文接着回复）',
                historyLimit: 12,
                groupId,
            });
        } catch (err) {
            lastError = err?.message || String(err);
            console.warn('[group-ai-reply] callAiAndSplit 失败', actorId, err);
            continue;
        }
        if (!result || result.ok === false) {
            lastError = result?.error || 'AI 返回失败';
            continue;
        }

        const wrote = await writeOneSpeakerMessages({
            sdk, user, groupId, mode,
            actorId, actorName,
            messages: result.messages || [],
            history,
        });
        if (wrote.written > 0) {
            replied += 1;
            lastSaved = wrote.lastSaved || lastSaved;
            try {
                if (typeof window.invalidateRendererCache === 'function') {
                    window.invalidateRendererCache('chat', `group-${groupId}`);
                    window.invalidateRendererCache('chat', groupId);
                }
            } catch (_) {}
            try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
        }
    }

    if (lastSaved) {
        try {
            await sdk.chatGroups?.updateLastMessage?.(sdk, user, groupId, mode, {
                content: lastSaved.content || '[AI 回复]',
                timestamp: lastSaved.timestamp || Date.now(),
                senderName: lastSaved.senderName || '',
                type: lastSaved.type || 'text',
            });
        } catch (_) {}
    }

    if (replied === 0) {
        return { ok: false, replied: 0, error: lastError || '没有成员回复' };
    }
    return { ok: true, replied };
}
