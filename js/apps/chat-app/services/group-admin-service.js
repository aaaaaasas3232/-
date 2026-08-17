/**
 * 群管理服务：群主 / 管理员 / 群昵称
 * ====================================================================
 * 群里的「谁管谁、谁叫什么」这件事有四个消费方：
 *   1. 群成员管理页（用户自己点按钮改）
 *   2. AI 输出的特殊 token（AI 是群主时自己安排）
 *   3. 聊天流里的系统提示（「XX 把 XX 设为了管理员」）
 *   4. 群 prompt（AI 得知道现在谁是群主、谁有昵称）
 *
 * 这四处如果各写各的，必然出现「页面改了但 AI 不知道」「AI 改了但没系统提示」
 * 这类半截失效。所以统一收敛到这个文件：
 *   · 任何一次变更都走 applyXxx() —— 里面同时做「写盘 + 写系统提示 + 重画」
 *   · prompt 那一段也从这里出（buildGroupAdminPromptBlock）
 *
 * ── 系统提示消息 ──────────────────────────────────────
 * type: 'group_notice'，渲染成跟「拍一拍」同款的居中灰字。
 * 它是**真消息**（进 chatMessages、参与历史），不是纯 UI 效果 ——
 * 因为「谁把谁设成了管理员」是剧情的一部分，AI 回顾上下文时应该看得到。
 */

const NOTICE_TYPE = 'group_notice';

/** 群里成员的显示名（群昵称优先）。统一走 SDK 那份实现，别在这里再算一遍。 */
export function memberName(sdk, group, memberId, user) {
    return sdk?.chatGroups?.resolveMemberName?.(
        sdk, group, memberId, user?.id || '', user?.name || '我',
    ) || String(memberId || '');
}

/** 把一条群系统提示写进会话 */
async function writeGroupNotice({ sdk, user, groupId, mode, text }) {
    if (!sdk?.chatMessages?.add || !user || !groupId || !text) return null;
    try {
        return await sdk.chatMessages.add(user, groupId, mode, {
            id: `gn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
            sender: 'system',
            type: NOTICE_TYPE,
            content: text,
            conversationType: 'group',
            conversationId: groupId,
            timestamp: Date.now(),
        });
    } catch (err) {
        console.warn('[group-admin] writeGroupNotice failed', err);
        return null;
    }
}

/**
 * 变更之后统一收尾：作废 renderer 缓存 + 强制重画。
 * 二段式是必须的 —— 只 ++tick 在 async detail renderer 下会命中缓存，
 * 表现为「改完了但页面不动」（AGENTS.md §32）。
 */
function refreshAfterChange(groupId) {
    try { window.invalidateRendererCache?.('chat', groupId); } catch (_) {}
    try { window.invalidateRendererCache?.('chat', null); } catch (_) {}
    try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
    try {
        if (window.__detailRenderTick) window.__detailRenderTick.value++;
    } catch (_) {}
}

function loadGroup(sdk, user, groupId, mode) {
    // mode 可能没传准（有的入口只知道 groupId），两个 mode 都找一遍
    const tryModes = mode ? [mode, mode === 'story' ? 'calendar' : 'story'] : ['calendar', 'story'];
    for (const m of tryModes) {
        const g = sdk?.chatGroups?.get?.(user, groupId, m);
        if (g) return { group: g, mode: m };
    }
    return { group: null, mode: mode || 'calendar' };
}

// ============================================================
// 三个变更入口
// ============================================================

/**
 * 设置某人的群昵称。
 * @param {string} actorId  是谁改的（用来生成「XX 给 XX 设置的群昵称是 XX」）
 * @param {string} targetId 改的是谁
 */
export async function applyGroupNickname({ sdk, user, groupId, mode, actorId, targetId, nickname }) {
    const { group, mode: realMode } = loadGroup(sdk, user, groupId, mode);
    if (!group) return { ok: false, error: '群聊不存在' };

    const before = sdk.chatGroups.getNickname(group, targetId);
    const value = String(nickname || '').trim();
    const updated = await sdk.chatGroups.setNickname(sdk, user, groupId, realMode, targetId, value);
    if (!updated) return { ok: false, error: '保存失败' };

    // 提示文案分三种，跟用户描述一一对应：
    //   自己改自己 → 「XX 给自己的群昵称修改为 XX」
    //   别人改别人 → 「XX 给 XX 设置的群昵称是 XX」
    //   清空       → 「XX 清空了 XX 的群昵称」
    const actorName = memberName(sdk, updated, actorId, user);
    const targetName = memberName(sdk, group, targetId, user);   // 用改之前那份算目标名，否则会显示成新昵称
    const isSelf = String(actorId) === String(targetId);
    let text;
    if (!value) {
        text = isSelf ? `${actorName} 清空了自己的群昵称` : `${actorName} 清空了 ${targetName} 的群昵称`;
    } else if (isSelf) {
        text = `${actorName} 给自己的群昵称修改为「${value}」`;
    } else {
        text = `${actorName} 给 ${targetName} 设置的群昵称是「${value}」`;
    }
    await writeGroupNotice({ sdk, user, groupId, mode: realMode, text });
    refreshAfterChange(groupId);
    return { ok: true, group: updated, notice: text, before };
}

/** 设 / 撤管理员 */
export async function applyGroupAdmin({ sdk, user, groupId, mode, actorId, targetId, on }) {
    const { group, mode: realMode } = loadGroup(sdk, user, groupId, mode);
    if (!group) return { ok: false, error: '群聊不存在' };
    if (sdk.chatGroups.isOwner(group, targetId, user?.id)) {
        return { ok: false, error: '群主不需要再设管理员' };
    }
    const updated = await sdk.chatGroups.setAdmin(sdk, user, groupId, realMode, targetId, !!on);
    if (!updated) return { ok: false, error: '保存失败' };

    const actorName = memberName(sdk, updated, actorId, user);
    const targetName = memberName(sdk, updated, targetId, user);
    const text = on
        ? `${actorName} 把 ${targetName} 设为了管理员`
        : `${actorName} 取消了 ${targetName} 的管理员`;
    await writeGroupNotice({ sdk, user, groupId, mode: realMode, text });
    refreshAfterChange(groupId);
    return { ok: true, group: updated, notice: text };
}

/** 转让群主 */
export async function applyGroupOwner({ sdk, user, groupId, mode, actorId, targetId }) {
    const { group, mode: realMode } = loadGroup(sdk, user, groupId, mode);
    if (!group) return { ok: false, error: '群聊不存在' };
    const updated = await sdk.chatGroups.setOwner(sdk, user, groupId, realMode, targetId);
    if (!updated) return { ok: false, error: '保存失败' };

    const actorName = memberName(sdk, updated, actorId, user);
    const targetName = memberName(sdk, updated, targetId, user);
    const text = `${actorName} 把群主转让给了 ${targetName}`;
    await writeGroupNotice({ sdk, user, groupId, mode: realMode, text });
    refreshAfterChange(groupId);
    return { ok: true, group: updated, notice: text };
}

// ============================================================
// AI 侧：token 解析 + prompt 段
// ============================================================

/**
 * AI 可以用的三个群管理 token。
 * 名字直接用群里的**显示名**（本名或群昵称都认），不要求 AI 记 id ——
 * 让模型输出内部 id 是最容易出错的一类要求。
 */
export const GROUP_ADMIN_TOKEN_HELP = [
    '- 设置某人的群昵称: [群昵称:成员名:新昵称]   例:[群昵称:阿澈:夜航船长]',
    '- 修改自己的群昵称: [我的群昵称:新昵称]      例:[我的群昵称:值夜的]',
    '- 任命管理员:       [设为管理员:成员名]      例:[设为管理员:阿澈]',
    '- 取消管理员:       [取消管理员:成员名]      例:[取消管理员:阿澈]',
].join('\n');

const TOKEN_RE = /\[(群昵称|我的群昵称|设为管理员|取消管理员):([^\]]*)\]/g;

/**
 * 从 AI 原文里抠出群管理 token。
 * 返回 { actions, cleanText } —— cleanText 是把 token 拿掉之后的正文，
 * 这些 token 是「动作」不是「话」，不该原样出现在气泡里。
 */
export function parseGroupAdminTokens(raw) {
    const text = String(raw || '');
    const actions = [];
    let cleanText = text.replace(TOKEN_RE, (_m, kind, body) => {
        const parts = String(body).split(':').map((s) => s.trim());
        if (kind === '我的群昵称') {
            if (parts[0]) actions.push({ kind: 'self-nickname', nickname: parts[0] });
        } else if (kind === '群昵称') {
            if (parts[0]) actions.push({ kind: 'nickname', target: parts[0], nickname: parts[1] || '' });
        } else if (kind === '设为管理员') {
            if (parts[0]) actions.push({ kind: 'admin', target: parts[0], on: true });
        } else if (kind === '取消管理员') {
            if (parts[0]) actions.push({ kind: 'admin', target: parts[0], on: false });
        }
        return '';
    });
    cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();
    return { actions, cleanText };
}

/**
 * 把「成员显示名」翻回 memberId。
 * 本名和群昵称都认 —— AI 看到的是显示名，它不知道 id。
 * 找不到就返回空串，调用方跳过这条动作（不要瞎猜一个成员改下去）。
 */
export function resolveMemberIdByName(sdk, group, user, name) {
    const target = String(name || '').trim();
    if (!target) return '';
    const ids = sdk.chatGroups.listMemberIds(group, user?.id || '');
    for (const id of ids) {
        if (memberName(sdk, group, id, user) === target) return id;
    }
    // 再宽松匹配一次本名（AI 可能用本名而不是群昵称称呼）
    for (const id of ids) {
        if (String(id) === String(user?.id || '')) {
            if ((user?.name || '') === target) return id;
            continue;
        }
        const ai = sdk?.aiPersons?.get?.(id);
        if (ai && (ai.name === target || ai.socialProfiles?.chat?.nickname === target)) return id;
    }
    return '';
}

/**
 * 执行一批 AI 给出的群管理动作。
 * @param {string} actorId 动作的执行者（AI 成员自己的 id）
 */
export async function applyGroupAdminActions({ sdk, user, groupId, mode, actorId, actions }) {
    const results = [];
    for (const act of (actions || [])) {
        const { group } = loadGroup(sdk, user, groupId, mode);
        if (!group) break;
        // 权限：只有群主 / 管理员能改别人；改自己的昵称谁都可以
        const canManage = sdk.chatGroups.isAdmin(group, actorId, user?.id);
        try {
            if (act.kind === 'self-nickname') {
                const r = await applyGroupNickname({
                    sdk, user, groupId, mode, actorId, targetId: actorId, nickname: act.nickname,
                });
                results.push(r);
            } else if (act.kind === 'nickname') {
                if (!canManage) { results.push({ ok: false, error: '没有管理权限' }); continue; }
                const targetId = resolveMemberIdByName(sdk, group, user, act.target);
                if (!targetId) { results.push({ ok: false, error: `找不到成员「${act.target}」` }); continue; }
                results.push(await applyGroupNickname({
                    sdk, user, groupId, mode, actorId, targetId, nickname: act.nickname,
                }));
            } else if (act.kind === 'admin') {
                if (!canManage) { results.push({ ok: false, error: '没有管理权限' }); continue; }
                const targetId = resolveMemberIdByName(sdk, group, user, act.target);
                if (!targetId) { results.push({ ok: false, error: `找不到成员「${act.target}」` }); continue; }
                results.push(await applyGroupAdmin({
                    sdk, user, groupId, mode, actorId, targetId, on: act.on,
                }));
            }
        } catch (err) {
            console.warn('[group-admin] applyGroupAdminActions failed', act, err);
            results.push({ ok: false, error: err?.message || '执行失败' });
        }
    }
    return results;
}

/**
 * 群 prompt 里的「群成员与职务」一段。
 *
 * 内容包含三块：
 *   1. 花名册：谁是群主、谁是管理员、各自的群昵称
 *   2. 称呼规则：有群昵称就叫群昵称
 *   3. 能用的管理 token（只有 AI 自己是群主/管理员时才给，
 *      不然会诱导它输出一堆没权限执行的动作）
 *
 * @param {string} [selfId] 当前正在发言的那个 AI 成员 id
 */
export function buildGroupAdminPromptBlock({ sdk, user, group, selfId = '' }) {
    if (!sdk?.chatGroups || !group) return '';
    const userId = user?.id || '';
    const ids = sdk.chatGroups.listMemberIds(group, userId);
    if (!ids.length) return '';

    const lines = ['# 群成员与职务'];
    for (const id of ids) {
        const name = memberName(sdk, group, id, user);
        const roles = [];
        if (sdk.chatGroups.isOwner(group, id, userId)) roles.push('群主');
        else if (sdk.chatGroups.isAdmin(group, id, userId)) roles.push('管理员');
        if (String(id) === String(userId)) roles.push('用户本人');
        if (selfId && String(id) === String(selfId)) roles.push('就是你');
        const nick = sdk.chatGroups.getNickname(group, id);
        const realName = String(id) === String(userId)
            ? (user?.name || '我')
            : (sdk?.aiPersons?.get?.(id)?.name || id);
        const nickPart = nick ? `，群昵称「${nick}」（本名 ${realName}）` : '';
        lines.push(`- ${name}${roles.length ? `（${roles.join(' · ')}）` : ''}${nickPart}`);
    }

    lines.push('');
    lines.push('群里称呼人时用上面这一列的名字（有群昵称就用群昵称），不要用本名或内部编号。');

    // 只有真的有权限时才把管理 token 教给它
    const canManage = selfId && sdk.chatGroups.isAdmin(group, selfId, userId);
    if (canManage) {
        const isOwnerSelf = sdk.chatGroups.isOwner(group, selfId, userId);
        lines.push('');
        lines.push(`你是这个群的${isOwnerSelf ? '群主' : '管理员'}，可以在回复里用下面的格式安排群务：`);
        lines.push(GROUP_ADMIN_TOKEN_HELP);
        lines.push('这些格式会被系统真正执行并留下一条群公告，所以只在剧情确实需要时用，别每次回复都改一遍。');
    } else if (selfId) {
        lines.push('');
        lines.push('你不是群主也不是管理员，不能任命管理员或改别人的群昵称；');
        lines.push('但可以用 [我的群昵称:新昵称] 改自己的群昵称。');
    }

    return lines.join('\n');
}

/**
 * 「请群主 AI 安排群务」用的一次性指令。
 * 用户在群成员管理页按那个按钮时，把这段作为 userText 发给群主 AI。
 */
export function buildAskOwnerToArrangePrompt({ sdk, user, group }) {
    const userId = user?.id || '';
    const ids = sdk.chatGroups.listMemberIds(group, userId);
    const roster = ids
        .map((id) => `- ${memberName(sdk, group, id, user)}`)
        .join('\n');
    return [
        '（群务安排请求）你是这个群的群主，现在请你按你的性格和你跟大家的关系，安排一下群里的职务和称呼：',
        '',
        '群成员：',
        roster,
        '',
        '请你做两件事，并且**必须用下面的格式输出**，否则系统执行不了：',
        '1. 挑 1~2 个你信得过的人当管理员：[设为管理员:成员名]',
        '2. 给你觉得合适的人取群昵称（包括你自己）：[群昵称:成员名:新昵称] / [我的群昵称:新昵称]',
        '',
        '除了这些格式，你也可以像平时那样说一两句话解释你为什么这么安排。',
    ].join('\n');
}

export { NOTICE_TYPE as GROUP_NOTICE_TYPE };
