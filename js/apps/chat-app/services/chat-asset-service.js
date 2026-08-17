/**
 * chat-app / 资金服务层（v0.67 私聊红包/转账）
 *
 * 职责：
 *   1) AI 发红包 → 扣减 AI 余额 + 写 assetFlow + 写 chatMessages(type='redpacket')
 *   2) AI 发转账 → 扣减 AI 余额 + 写 assetFlow + 写 chatMessages(type='transfer')
 *   3) User 领红包 → 扣减 AI 余额 + 加 user 余额 + 双方写 assetFlow
 *   4) User 拒领红包 → 不动余额,只更新消息卡 opened/rejected + 写一条 action_notify system 消息
 *   5) User 收转账 → 扣减 AI 余额 + 加 user 余额 + 双方写 assetFlow
 *   6) User 退回转账 → 不动余额,只更新消息卡 returned + 写一条 action_notify system 消息
 *   7) User 发红包 → 扣减 user 余额 + 写 user assetFlow + 写 chatMessages(type='redpacket')
 *   8) User 发转账 → 扣减 user 余额 + 写 user assetFlow + 写 chatMessages(type='transfer')
 *
 * 设计要点：
 *   - 全 async/await + try/catch（AGENTS.md §6）
 *   - 每一步失败不影响下一步（部分写入也尽量保证数据一致）
 *   - 不依赖任何 framework 状态,纯函数式 + SDK
 *   - 调用方负责拿到结果后做「消息写入数据库 + 重画」
 */

const MS = {
    redpacket: {
        send: 'sendRedpacket',
        receive: 'receiveRedpacket',
        reject: 'rejectRedpacket',
        aiAccept: 'aiAcceptRedpacket',
    },
    transfer: {
        send: 'sendTransfer',
        receive: 'receiveTransfer',
        return: 'returnTransfer',
        aiAccept: 'aiAcceptTransfer',
    },
};

async function _waitSdk(timeout = 3000) {
    if (window.settingsSdk?.chatMessages?.add) return window.settingsSdk;
    if (typeof window.whenSettingsSdkReady === 'function') {
        return await window.whenSettingsSdkReady(timeout);
    }
    return window.settingsSdk || null;
}

function _newMessageId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function _nowTime() {
    return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function _userMeta(sdk) {
    const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
    const chatProfile = defaultUser?.socialProfiles?.chat || {};
    return {
        user: defaultUser,
        userId: defaultUser?.id || 'default',
        name: chatProfile.nickname || defaultUser?.name || '我',
    };
}

function _aiMeta(sdk, aiPersonId) {
    const ai = sdk?.aiPersons?.get?.(aiPersonId);
    if (!ai) return null;
    return {
        ai,
        aiId: ai.id,
        name: ai.name || 'AI',
    };
}

/**
 * AI 发红包（用户在 AI 端模拟 AI 自己发红包 — 由 chat.js 解析 [发红包:金额:祝福] 时调用）
 *
 * @param {object} opts { aiPersonId, mode, amount, message, senderName }
 * @returns {Promise<{ok, msg?, error?, balance?}>}
 */
export async function aiSendRedpacket({ aiPersonId, mode = 'calendar', amount, message, senderName }) {
    const sdk = await _waitSdk();
    if (!sdk) return { ok: false, error: 'SDK 未就绪' };
    if (!aiPersonId || typeof amount !== 'number') return { ok: false, error: '参数缺失' };

    // 1) 扣减 AI 余额 + 写 AI assetFlow
    const flowRes = await sdk.assetFlow?.add?.({
        type: 'redpacket',
        direction: 'out',
        amount,
        counterpartyType: 'user',
        counterpartyId: _userMeta(sdk).userId,
        counterpartyName: _userMeta(sdk).name,
        sourceType: 'redpacket',
        sourceId: '', // 下面写消息拿到 id 后回填
        note: `发红包:${message || '恭喜发财'}`,
    }, 'ai', aiPersonId);
    if (flowRes?.ok === false) return flowRes;

    // 2) 写消息
    const msgId = _newMessageId('rp');
    const userMeta = _userMeta(sdk);
    let savedMsg = null;
    try {
        savedMsg = await sdk.chatMessages.add(userMeta.user, aiPersonId, mode, {
            id: msgId,
            sender: 'ai',
            senderName: senderName || _aiMeta(sdk, aiPersonId)?.name,
            type: 'redpacket',
            content: '[红包]',
            redpacketCard: {
                amount,
                message: message || '恭喜发财',
                style: 'normal',
                opened: false,
                rejected: false,
                fromAI: true,
            },
            timestamp: Date.now(),
        });
    } catch (err) {
        console.warn('[chat-asset] aiSendRedpacket save message failed', err);
    }

    // 3) 回填 sourceId(让 listBySource 能查到这笔流水)
    if (savedMsg && flowRes?.entry) {
        try {
            const ai = sdk.aiPersons.get(aiPersonId);
            const arr = (Array.isArray(ai?.assetFlow) ? ai.assetFlow : []).map((e) =>
                e.id === flowRes.entry.id ? { ...e, sourceId: savedMsg.id } : e
            );
            await sdk.aiPersons.update(aiPersonId, { assetFlow: arr });
        } catch (err) { console.warn('[chat-asset] backfill sourceId failed', err); }
    }

    return { ok: true, msg: savedMsg || { id: msgId, type: 'redpacket', redpacketCard: { amount, message, style: 'normal', opened: false, fromAI: true } }, balance: flowRes?.balance };
}

/**
 * User 领 AI 发的红包
 */
export async function userReceiveRedpacket({ aiPersonId, mode = 'calendar', msgId, amount, message }) {
    const sdk = await _waitSdk();
    if (!sdk) return { ok: false, error: 'SDK 未就绪' };
    if (!aiPersonId || !msgId || typeof amount !== 'number') return { ok: false, error: '参数缺失' };

    const userMeta = _userMeta(sdk);
    const aiMeta = _aiMeta(sdk, aiPersonId);
    if (!aiMeta) return { ok: false, error: 'AI 人设不存在' };

    // 1) 检查 AI 余额是否充足（防止 UI 时差导致透支）
    const aiBalance = sdk.assetFlow?.getBalance?.('ai', aiPersonId) || 0;
    if (aiBalance < amount) {
        return { ok: false, error: '对方余额不足' };
    }

    // 2) 扣 AI 余额 + 写 AI assetFlow
    const aiFlow = await sdk.assetFlow?.add?.({
        type: 'redpacket',
        direction: 'out',
        amount,
        counterpartyType: 'user',
        counterpartyId: userMeta.userId,
        counterpartyName: userMeta.name,
        sourceType: 'redpacket',
        sourceId: msgId,
        note: `红包被领取:${message || ''}`,
    }, 'ai', aiPersonId);

    // 3) 加 user 余额 + 写 user assetFlow
    const userFlow = await sdk.assetFlow?.add?.({
        type: 'redpacket',
        direction: 'in',
        amount,
        counterpartyType: 'ai',
        counterpartyId: aiPersonId,
        counterpartyName: aiMeta.name,
        sourceType: 'redpacket',
        sourceId: msgId,
        note: `收到 ${aiMeta.name} 的红包`,
    }, 'user', userMeta.userId);

    // 4) 更新消息卡(opened + openedAt)
    try {
        await sdk.chatMessages.update(msgId, {
            redpacketCard: {
                amount,
                message: message || '恭喜发财',
                style: 'opened',
                opened: true,
                openedAt: Date.now(),
                fromAI: true,
            },
        });
    } catch (err) {
        console.warn('[chat-asset] userReceiveRedpacket update message failed', err);
    }

    // 5) 写 system 消息通知 AI
    try {
        await sdk.chatMessages.add(userMeta.user, aiPersonId, mode, {
            id: _newMessageId('sys'),
            sender: 'system',
            type: 'action_notify',
            content: `[用户领取了你发的${Number(amount).toFixed(2)}元红包]`,
            hidden: true,
            timestamp: Date.now(),
        });
    } catch (err) { console.warn('[chat-asset] add action_notify failed', err); }

    return { ok: true, aiBalance: aiFlow?.balance, userBalance: userFlow?.balance };
}

/**
 * User 拒领 AI 发的红包
 */
export async function userRejectRedpacket({ aiPersonId, mode = 'calendar', msgId, amount, message }) {
    const sdk = await _waitSdk();
    if (!sdk) return { ok: false, error: 'SDK 未就绪' };
    if (!aiPersonId || !msgId) return { ok: false, error: '参数缺失' };

    const userMeta = _userMeta(sdk);
    const aiMeta = _aiMeta(sdk, aiPersonId);
    try {
        await sdk.chatMessages.update(msgId, {
            redpacketCard: {
                amount,
                message: message || '恭喜发财',
                style: 'expired',
                opened: false,
                rejected: true,
                rejectedAt: Date.now(),
                fromAI: true,
            },
        });
    } catch (err) { console.warn('[chat-asset] userRejectRedpacket update message failed', err); }

    try {
        await sdk.chatMessages.add(userMeta.user, aiPersonId, mode, {
            id: _newMessageId('sys'),
            sender: 'system',
            type: 'action_notify',
            content: `[用户拒绝领取你发的${Number(amount || 0).toFixed(2)}元红包]`,
            hidden: true,
            timestamp: Date.now(),
        });
    } catch (err) { console.warn('[chat-asset] add reject action_notify failed', err); }

    return { ok: true };
}

/**
 * AI 发转账
 */
export async function aiSendTransfer({ aiPersonId, mode = 'calendar', amount, note, senderName }) {
    const sdk = await _waitSdk();
    if (!sdk) return { ok: false, error: 'SDK 未就绪' };
    if (!aiPersonId || typeof amount !== 'number') return { ok: false, error: '参数缺失' };

    const userMeta = _userMeta(sdk);

    // 1) 写 AI assetFlow(只在领取时才真扣款,这里先记账 out 但不调 adjust? )
    //    跟 chat.js 一致:AI 发转账时立刻冻结金额,从 AI 余额扣掉
    const flowRes = await sdk.assetFlow?.add?.({
        type: 'transfer',
        direction: 'out',
        amount,
        counterpartyType: 'user',
        counterpartyId: userMeta.userId,
        counterpartyName: userMeta.name,
        sourceType: 'transfer',
        sourceId: '',
        note: `转账:${note || ''}`,
    }, 'ai', aiPersonId);

    // 2) 写消息
    const msgId = _newMessageId('tf');
    let savedMsg = null;
    try {
        savedMsg = await sdk.chatMessages.add(userMeta.user, aiPersonId, mode, {
            id: msgId,
            sender: 'ai',
            senderName: senderName || _aiMeta(sdk, aiPersonId)?.name,
            type: 'transfer',
            content: '[转账]',
            transferCard: {
                amount,
                note: note || '转账给用户',
                received: false,
                returned: false,
                fromAI: true,
            },
            timestamp: Date.now(),
        });
    } catch (err) { console.warn('[chat-asset] aiSendTransfer save message failed', err); }

    // 3) 回填 sourceId
    if (savedMsg && flowRes?.entry) {
        try {
            const ai = sdk.aiPersons.get(aiPersonId);
            const arr = (Array.isArray(ai?.assetFlow) ? ai.assetFlow : []).map((e) =>
                e.id === flowRes.entry.id ? { ...e, sourceId: savedMsg.id } : e
            );
            await sdk.aiPersons.update(aiPersonId, { assetFlow: arr });
        } catch (err) { console.warn('[chat-asset] backfill sourceId failed', err); }
    }

    return { ok: true, msg: savedMsg || { id: msgId, type: 'transfer', transferCard: { amount, note, received: false, fromAI: true } }, balance: flowRes?.balance };
}

/**
 * User 收 AI 发的转账
 */
export async function userReceiveTransfer({ aiPersonId, mode = 'calendar', msgId, amount, note }) {
    const sdk = await _waitSdk();
    if (!sdk) return { ok: false, error: 'SDK 未就绪' };
    if (!aiPersonId || !msgId || typeof amount !== 'number') return { ok: false, error: '参数缺失' };

    const userMeta = _userMeta(sdk);
    const aiMeta = _aiMeta(sdk, aiPersonId);
    if (!aiMeta) return { ok: false, error: 'AI 人设不存在' };

    // 1) AI 发转账时已经预扣(aiSendTransfer 已写一条 out 流),
    //    user 收时不需要再扣 AI,只需给 user 加钱 + 写 user assetFlow
    const userFlow = await sdk.assetFlow?.add?.({
        type: 'transfer',
        direction: 'in',
        amount,
        counterpartyType: 'ai',
        counterpartyId: aiPersonId,
        counterpartyName: aiMeta.name,
        sourceType: 'transfer',
        sourceId: msgId,
        note: `收到 ${aiMeta.name} 的转账:${note || ''}`,
    }, 'user', userMeta.userId);

    // 2) 更新消息卡
    try {
        await sdk.chatMessages.update(msgId, {
            transferCard: {
                amount,
                note: note || '转账给用户',
                received: true,
                receivedAt: Date.now(),
                fromAI: true,
            },
        });
    } catch (err) {
        console.warn('[chat-asset] userReceiveTransfer update message failed', err);
    }

    // 3) 写 system 通知
    try {
        await sdk.chatMessages.add(userMeta.user, aiPersonId, mode, {
            id: _newMessageId('sys'),
            sender: 'system',
            type: 'action_notify',
            content: `[用户收取了你发的${Number(amount).toFixed(2)}元转账]`,
            hidden: true,
            timestamp: Date.now(),
        });
    } catch (err) { console.warn('[chat-asset] add receive-transfer action_notify failed', err); }

    return { ok: true, userBalance: userFlow?.balance };
}

/**
 * User 退回 AI 发的转账
 * 退回 = AI 之前预扣的钱要回补给 AI
 */
export async function userReturnTransfer({ aiPersonId, mode = 'calendar', msgId, amount, note }) {
    const sdk = await _waitSdk();
    if (!sdk) return { ok: false, error: 'SDK 未就绪' };
    if (!aiPersonId || !msgId) return { ok: false, error: '参数缺失' };

    const userMeta = _userMeta(sdk);
    const aiMeta = _aiMeta(sdk, aiPersonId);

    // 1) 把 AI 之前扣的钱退回(走 removeBySource 自动反调 adjust)
    if (aiMeta && typeof amount === 'number') {
        try {
            await sdk.assetFlow?.removeBySource?.('transfer', msgId, 'ai', aiPersonId);
        } catch (err) { console.warn('[chat-asset] return transfer refund failed', err); }
    }

    // 2) 更新消息卡
    try {
        await sdk.chatMessages.update(msgId, {
            transferCard: {
                amount,
                note: note || '转账给用户',
                received: false,
                returned: true,
                returnedAt: Date.now(),
                fromAI: true,
            },
        });
    } catch (err) { console.warn('[chat-asset] userReturnTransfer update message failed', err); }

    // 3) 写 system 通知
    try {
        await sdk.chatMessages.add(userMeta.user, aiPersonId, mode, {
            id: _newMessageId('sys'),
            sender: 'system',
            type: 'action_notify',
            content: `[用户退回了你发的${Number(amount || 0).toFixed(2)}元转账]`,
            hidden: true,
            timestamp: Date.now(),
        });
    } catch (err) { console.warn('[chat-asset] add return-transfer action_notify failed', err); }

    return { ok: true };
}

/**
 * User 发红包给 AI
 * @param {object} options
 * @param {string} options.aiPersonId
 * @param {string} [options.mode='calendar']
 * @param {number} options.amount
 * @param {string} [options.message]
 * @param {string} [options.sender]      ★ v1.0 swap 模式: 写盘时使用的 sender 字段(默认 'user',swap 时传 'ai')
 * @param {string} [options.senderName]  ★ v1.0 swap 模式: 写盘时使用的 senderName(默认 userMeta.name,swap 时传 AI 名字)
 */
export async function userSendRedpacket({ aiPersonId, mode = 'calendar', amount, message, sender, senderName }) {
    const sdk = await _waitSdk();
    if (!sdk) return { ok: false, error: 'SDK 未就绪' };
    if (!aiPersonId || typeof amount !== 'number') return { ok: false, error: '参数缺失' };

    const userMeta = _userMeta(sdk);
    const aiMeta = _aiMeta(sdk, aiPersonId);
    if (!aiMeta) return { ok: false, error: 'AI 人设不存在' };

    // ★ v1.0 swap 模式可改写盘 sender/senderName
    const writeSender = (sender === 'ai' || sender === 'user') ? sender : 'user';
    const writeSenderName = (typeof senderName === 'string' && senderName) ? senderName : userMeta.name;

    // 1) 检查 user 余额
    const userBalance = sdk.assetFlow?.getBalance?.('user', userMeta.userId) || 0;
    if (userBalance < amount) return { ok: false, error: '余额不足' };

    // 2) 扣 user + 写 user assetFlow
    const userFlow = await sdk.assetFlow?.add?.({
        type: 'redpacket',
        direction: 'out',
        amount,
        counterpartyType: 'ai',
        counterpartyId: aiPersonId,
        counterpartyName: aiMeta.name,
        sourceType: 'redpacket',
        sourceId: '',
        note: `发给 ${aiMeta.name} 的红包`,
    }, 'user', userMeta.userId);

    // 3) 写消息
    const msgId = _newMessageId('rp');
    let savedMsg = null;
    try {
        savedMsg = await sdk.chatMessages.add(userMeta.user, aiPersonId, mode, {
            id: msgId,
            sender: writeSender,
            senderName: writeSenderName,
            type: 'redpacket',
            content: '[红包]',
            redpacketCard: {
                amount,
                message: message || '恭喜发财',
                style: 'normal',
                opened: false,
                rejected: false,
                fromAI: false,
            },
            timestamp: Date.now(),
        });
    } catch (err) { console.warn('[chat-asset] userSendRedpacket save message failed', err); }

    // 4) 回填 sourceId
    if (savedMsg && userFlow?.entry) {
        try {
            const u = sdk.users.get(userMeta.userId);
            const arr = (Array.isArray(u?.assetFlow) ? u.assetFlow : []).map((e) =>
                e.id === userFlow.entry.id ? { ...e, sourceId: savedMsg.id } : e
            );
            await sdk.users.update(userMeta.userId, { assetFlow: arr });
        } catch (err) { console.warn('[chat-asset] backfill sourceId failed', err); }
    }

    return { ok: true, msg: savedMsg || { id: msgId, type: 'redpacket', redpacketCard: { amount, message, style: 'normal', opened: false, fromAI: false } }, balance: userFlow?.balance };
}

/**
 * AI 收 user 红包（由 chat.js 解析 [收红包:msgId] 时调用,或 AI 自己主动领取）
 * 注意：user 发红包时已经从 user 余额扣了,AI 收时再加给 AI
 */
export async function aiReceiveRedpacket({ aiPersonId, mode = 'calendar', msgId, amount, message }) {
    const sdk = await _waitSdk();
    if (!sdk) return { ok: false, error: 'SDK 未就绪' };
    if (!aiPersonId || !msgId) return { ok: false, error: '参数缺失' };

    const userMeta = _userMeta(sdk);
    const aiMeta = _aiMeta(sdk, aiPersonId);
    if (!aiMeta) return { ok: false, error: 'AI 人设不存在' };

    // 1) 加 AI 余额 + 写 AI assetFlow
    const aiFlow = await sdk.assetFlow?.add?.({
        type: 'redpacket',
        direction: 'in',
        amount,
        counterpartyType: 'user',
        counterpartyId: userMeta.userId,
        counterpartyName: userMeta.name,
        sourceType: 'redpacket',
        sourceId: msgId,
        note: `收到 ${userMeta.name} 的红包:${message || ''}`,
    }, 'ai', aiPersonId);

    // 2) 更新消息卡(opened)
    try {
        await sdk.chatMessages.update(msgId, {
            redpacketCard: {
                amount,
                message: message || '恭喜发财',
                style: 'opened',
                opened: true,
                openedAt: Date.now(),
                fromAI: false,
            },
        });
    } catch (err) { console.warn('[chat-asset] aiReceiveRedpacket update message failed', err); }

    return { ok: true, aiBalance: aiFlow?.balance };
}

/**
 * User 发转账给 AI
 * @param {object} options
 * @param {string} options.aiPersonId
 * @param {string} [options.mode='calendar']
 * @param {number} options.amount
 * @param {string} [options.note]
 * @param {string} [options.sender]      ★ v1.0 swap 模式: 写盘时使用的 sender 字段(默认 'user',swap 时传 'ai')
 * @param {string} [options.senderName]  ★ v1.0 swap 模式: 写盘时使用的 senderName
 */
export async function userSendTransfer({ aiPersonId, mode = 'calendar', amount, note, sender, senderName }) {
    const sdk = await _waitSdk();
    if (!sdk) return { ok: false, error: 'SDK 未就绪' };
    if (!aiPersonId || typeof amount !== 'number') return { ok: false, error: '参数缺失' };

    const userMeta = _userMeta(sdk);
    const aiMeta = _aiMeta(sdk, aiPersonId);
    if (!aiMeta) return { ok: false, error: 'AI 人设不存在' };

    // ★ v1.0 swap 模式可改写盘 sender/senderName
    const writeSender = (sender === 'ai' || sender === 'user') ? sender : 'user';
    const writeSenderName = (typeof senderName === 'string' && senderName) ? senderName : userMeta.name;

    // 1) 余额检查
    const userBalance = sdk.assetFlow?.getBalance?.('user', userMeta.userId) || 0;
    if (userBalance < amount) return { ok: false, error: '余额不足' };

    // 2) 扣 user 余额 + 写 user assetFlow
    const userFlow = await sdk.assetFlow?.add?.({
        type: 'transfer',
        direction: 'out',
        amount,
        counterpartyType: 'ai',
        counterpartyId: aiPersonId,
        counterpartyName: aiMeta.name,
        sourceType: 'transfer',
        sourceId: '',
        note: `转账给 ${aiMeta.name}:${note || ''}`,
    }, 'user', userMeta.userId);

    // 3) 写消息
    const msgId = _newMessageId('tf');
    let savedMsg = null;
    try {
        savedMsg = await sdk.chatMessages.add(userMeta.user, aiPersonId, mode, {
            id: msgId,
            sender: writeSender,
            senderName: writeSenderName,
            type: 'transfer',
            content: '[转账]',
            transferCard: {
                amount,
                note: note || '转账',
                received: false,
                returned: false,
                fromAI: false,
            },
            timestamp: Date.now(),
        });
    } catch (err) { console.warn('[chat-asset] userSendTransfer save message failed', err); }

    // 4) 回填 sourceId
    if (savedMsg && userFlow?.entry) {
        try {
            const u = sdk.users.get(userMeta.userId);
            const arr = (Array.isArray(u?.assetFlow) ? u.assetFlow : []).map((e) =>
                e.id === userFlow.entry.id ? { ...e, sourceId: savedMsg.id } : e
            );
            await sdk.users.update(userMeta.userId, { assetFlow: arr });
        } catch (err) { console.warn('[chat-asset] backfill sourceId failed', err); }
    }

    return { ok: true, msg: savedMsg || { id: msgId, type: 'transfer', transferCard: { amount, note, received: false, fromAI: false } }, balance: userFlow?.balance };
}

/**
 * AI 收 user 转账
 */
export async function aiReceiveTransfer({ aiPersonId, mode = 'calendar', msgId, amount, note }) {
    const sdk = await _waitSdk();
    if (!sdk) return { ok: false, error: 'SDK 未就绪' };
    if (!aiPersonId || !msgId) return { ok: false, error: '参数缺失' };

    const userMeta = _userMeta(sdk);
    const aiMeta = _aiMeta(sdk, aiPersonId);
    if (!aiMeta) return { ok: false, error: 'AI 人设不存在' };

    // 1) 加 AI 余额 + 写 AI assetFlow
    const aiFlow = await sdk.assetFlow?.add?.({
        type: 'transfer',
        direction: 'in',
        amount,
        counterpartyType: 'user',
        counterpartyId: userMeta.userId,
        counterpartyName: userMeta.name,
        sourceType: 'transfer',
        sourceId: msgId,
        note: `收到 ${userMeta.name} 的转账:${note || ''}`,
    }, 'ai', aiPersonId);

    // 2) 更新消息卡(received)
    try {
        await sdk.chatMessages.update(msgId, {
            transferCard: {
                amount,
                note: note || '转账',
                received: true,
                receivedAt: Date.now(),
                fromAI: false,
            },
        });
    } catch (err) { console.warn('[chat-asset] aiReceiveTransfer update message failed', err); }

    return { ok: true, aiBalance: aiFlow?.balance };
}

// ============================================================
// ★ v0.79 AI 发朋友圈(由 ai-service.js 解析 [发朋友圈:内容] token 时调用)
//   流程:
//     1) 写完整朋友圈原文到 aiPerson.moments[]  (sdk.moments.add)
//     2) 写一条 type='action_notify' 系统消息(让 AI 知道自己刚发了朋友圈)
//     3) 后台异步调 LLM 生成概要 → sdk.moments.setSummary 回填
//        (概要生成失败时 summary 留空,后续可手动重生成或忽略)
// ============================================================

/**
 * AI 发朋友圈(AI 在回复中输出 [发朋友圈:内容] 时由 ai-service 解析调用)
 * @param {object} opts
 * @param {string} opts.aiPersonId
 * @param {'calendar'|'story'} [opts.mode='calendar']
 * @param {string} opts.content   朋友圈正文(必填)
 * @param {string[]} [opts.images] 真实图片 URL 数组(可选)
 * @param {string} [opts.location] 位置(可选)
 * @param {Array} [opts.aiImages] AI 描述图(可选)
 * @returns {Promise<{ok, moment?, error?}>}
 */
export async function aiSendMoment({
    aiPersonId,
    mode = 'calendar',
    content,
    images,
    location,
    aiImages,
}) {
    const sdk = await _waitSdk();
    if (!sdk) return { ok: false, error: 'SDK 未就绪' };
    if (!aiPersonId) return { ok: false, error: '缺少 aiPersonId' };
    if (!content || !String(content).trim()) return { ok: false, error: '朋友圈内容为空' };

    const text = String(content).trim();

    // 1) 写完整朋友圈到 aiPerson.moments[](原文 + 空 summary,等后台生成)
    let moment = null;
    try {
        moment = await sdk.moments?.add?.(aiPersonId, {
            content: text,
            images: Array.isArray(images) ? images.slice() : [],
            location: String(location || ''),
            aiImages: Array.isArray(aiImages) ? aiImages.slice() : [],
            timestamp: Date.now(),
        });
    } catch (err) {
        console.warn('[chat-asset] aiSendMoment moments.add failed', err);
    }
    if (!moment) return { ok: false, error: '写入朋友圈失败' };

    // 2) 写一条 type='action_notify' 系统消息,让 AI 自己看到「我刚发了朋友圈」
    //    (跟 chat.js 旧版行为对齐,系统消息给当前 AI 作为「我方动态」回执)
    try {
        const userMeta = _userMeta(sdk);
        const aiMeta = _aiMeta(sdk, aiPersonId);
        await sdk.chatMessages.add(userMeta, aiPersonId, mode, {
            id: _newMessageId('mnote'),
            sender: 'ai',
            type: 'action_notify',
            content: `[AI 发了一条朋友圈] ${text.slice(0, 60)}${text.length > 60 ? '…' : ''}`,
            // 用于朋友圈列表页识别「这是 AI 自己发的」回执
            metadata: { kind: 'moment-self-notify', momentId: moment.id },
            timestamp: Date.now(),
        });
    } catch (err) {
        console.warn('[chat-asset] aiSendMoment chatMessages.add failed', err);
    }

    // 3) 后台异步生成概要(不阻塞主流程;失败回退到空 summary)
    //    概要生成走 ai-service._generateMomentSummary(若提供),或直接 fire-and-forget
    try {
        const { _generateMomentSummary } = await import('./ai-service.js');
        if (typeof _generateMomentSummary === 'function') {
            // 不 await,后台异步
            _generateMomentSummary({
                aiPersonId,
                momentId: moment.id,
                content: text,
                mode,
            }).catch((err) => {
                console.warn('[chat-asset] aiSendMoment _generateMomentSummary failed', err);
            });
        }
    } catch (_) {
        // ai-service.js 没有提供 _generateMomentSummary 是预期行为(本期不实现 AI 概要生成),
        // summary 留空,prompt 注入只取已有 summary
    }

    return { ok: true, moment };
}

/**
 * 手动重生成某条朋友圈的概要(给 AI 设置页「重新生成概要」按钮调用)
 * @param {string} aiPersonId
 * @param {string} momentId
 * @returns {Promise<{ok, summary?, error?}>}
 */
export async function regenerateMomentSummary({ aiPersonId, momentId }) {
    const sdk = await _waitSdk();
    if (!sdk) return { ok: false, error: 'SDK 未就绪' };
    if (!aiPersonId || !momentId) return { ok: false, error: '参数缺失' };
    const moment = sdk.moments?.get?.(aiPersonId, momentId);
    if (!moment) return { ok: false, error: '朋友圈不存在' };
    try {
        const { _generateMomentSummary } = await import('./ai-service.js');
        if (typeof _generateMomentSummary !== 'function') {
            return { ok: false, error: 'AI 概要生成未实现' };
        }
        const result = await _generateMomentSummary({
            aiPersonId,
            momentId,
            content: moment.content,
            mode: 'calendar',
        });
        return { ok: true, summary: result?.summary || '' };
    } catch (err) {
        console.warn('[chat-asset] regenerateMomentSummary failed', err);
        return { ok: false, error: err?.message || String(err) };
    }
}
