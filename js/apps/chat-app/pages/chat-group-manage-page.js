/**
 * chat-app / 群成员管理详情页
 *
 * v0.81 新增：群主 / 管理员 / 群昵称 三类管理
 *   - 群主（ownerId）：必填，群聊中 1 名；可为用户本人（默认）或任一 AI 成员
 *   - 管理员（adminIds[]）：可选，群聊中最多 2 名 AI 成员
 *   - 群昵称（memberNicknames{}）：每个成员的「群内昵称」
 *     - 普通成员：仅能编辑自己的
 *     - 群主（用户）：能编辑所有人的
 *
 * 设计要点：
 *   - 风格对齐 chat-favorites（顶栏 + 渐变背景 + 摘要卡片 + 列表卡片）
 *   - 所有按钮走 data-app-action 派发到 chat-app methods
 *   - 派发落地后由 methods 改写 sdk.chatGroups.update（ownerId / adminIds / memberNicknames）
 *   - AI 生成群昵称：基于 AI 人设的 name / nickname / tags 启发式拼装
 *   - 不使用 emoji，统一用 SVG 图标
 */

import { escapeHtml } from '@/src/core/escape.js';
import { getAiMeta, resolveAiAvatar, resolveUserAvatar, DEFAULT_AI_AVATAR_BG } from '../aiMeta.js';

const ICON_BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
const ICON_CROWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 18 L6 8 L12 13 L18 8 L22 18 Z"/><path d="M2 22 H22"/><path d="M6 8 L12 13 L18 8"/></svg>';
const ICON_SHIELD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 L4 6 V12 C4 17 7 21 12 22 C17 21 20 17 20 12 V6 Z"/></svg>';
const ICON_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
const ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>';
const ICON_SPARKLE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 L13.5 9.5 L20 11 L13.5 12.5 L12 19 L10.5 12.5 L4 11 L10.5 9.5 Z"/></svg>';
const ICON_GROUP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
const ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
const ICON_USER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

const MAX_ADMIN_COUNT = 2;
const NICKNAME_MAX_LENGTH = 16;

/**
 * 读取群聊 entry，缺失字段都给空兜底。
 * 注意：群主 / 管理员 / 群昵称三个字段都是新增的，旧群聊 entry 上不存在。
 *
 * @param {Object} sdk
 * @param {Object} defaultUser
 * @param {string} groupId
 * @param {string} mode
 * @returns {Object} { exists, entry, members, ownerId, adminIds, memberNicknames }
 */
function loadManageData(sdk, defaultUser, groupId, mode) {
    const fallback = {
        exists: false,
        entry: null,
        members: [],
        ownerId: defaultUser?.id || 'user',
        adminIds: [],
        memberNicknames: {},
        defaultUserId: defaultUser?.id || null,
    };
    try {
        let entry = null;
        for (const m of ['calendar', 'story']) {
            const e = sdk.chatGroups.get?.(defaultUser, groupId, m);
            if (e) { entry = e; break; }
        }
        if (!entry) return fallback;
        const resolvedMembers = (sdk.chatGroups.resolveMembers && entry)
            ? sdk.chatGroups.resolveMembers(sdk, defaultUser, entry)
            : (entry.members || []).map((id) => ({ id }));
        return {
            exists: true,
            entry,
            members: resolvedMembers,
            ownerId: entry.ownerId || defaultUser?.id || 'user',
            adminIds: Array.isArray(entry.adminIds) ? entry.adminIds.slice(0, MAX_ADMIN_COUNT) : [],
            memberNicknames: (entry.memberNicknames && typeof entry.memberNicknames === 'object')
                ? { ...entry.memberNicknames } : {},
            defaultUserId: defaultUser?.id || null,
        };
    } catch (err) {
        console.warn('[chat-group-manage] loadManageData failed', err);
        return fallback;
    }
}

/**
 * 解析一个成员项的展示信息。
 * kind = 'user' 表示用户本人；'ai' 表示 AI 成员。
 */
function resolveMemberDisplay(member, kind, defaultUser, sdk) {
    if (kind === 'user') {
        const av = resolveUserAvatar();
        return {
            id: defaultUser?.id || 'user',
            kind: 'user',
            label: '我',
            role: '群主',
            avatar: av.url,
            avatarBg: av.bg,
            initial: '我',
            isCurrentUser: true,
        };
    }
    const id = member?.id || member?.aiPersonId || '';
    const av = resolveAiAvatar(id);
    const meta = getAiMeta(id);
    return {
        id,
        kind: 'ai',
        label: meta.exists ? meta.nickname : (member?.name || id || '成员'),
        role: '',
        avatar: meta.exists ? meta.avatar : (member?.avatar || av.url),
        avatarBg: meta.exists ? meta.avatarBg : (member?.avatarBg || av.bg),
        initial: av.text || (member?.name || id || '?').charAt(0),
        isCurrentUser: false,
    };
}

/**
 * 渲染头像 HTML
 */
function renderAvatarHtml(display, size = 40) {
    const sizeStyle = `width:${size}px;height:${size}px;`;
    const bgStyle = `background:${escapeHtml(display.avatarBg || DEFAULT_AI_AVATAR_BG)};`;
    const fontSize = Math.max(10, Math.round(size * 0.4));
    if (display.avatar) {
        return `<span class="cgm-avatar" style="${sizeStyle}${bgStyle}"><img src="${escapeHtml(display.avatar)}" alt="" style="width:100%;height:100%;object-fit:cover;" /></span>`;
    }
    return `<span class="cgm-avatar" style="${sizeStyle}${bgStyle}font-size:${fontSize}px;">${escapeHtml(display.initial || '?')}</span>`;
}

/**
 * 角色徽章
 */
function renderRoleBadge(role) {
    if (!role) return '';
    if (role === '群主') {
        return `<span class="cgm-role-badge cgm-role-badge--owner"><span class="cgm-role-icon">${ICON_CROWN}</span>群主</span>`;
    }
    if (role === '管理员') {
        return `<span class="cgm-role-badge cgm-role-badge--admin"><span class="cgm-role-icon">${ICON_SHIELD}</span>管理员</span>`;
    }
    return `<span class="cgm-role-badge cgm-role-badge--member">成员</span>`;
}

/**
 * 渲染「群主」卡片：当前群主 + 「更换」按钮
 */
function renderOwnerCard({ ownerDisplay, groupId, mode, isOwnerCurrentUser, canEdit }) {
    const editAction = JSON.stringify({
        action: 'appMethod', appId: 'chat', method: 'openGroupOwnerPicker',
        payload: { groupId, mode },
    });
    const editBtn = canEdit ? `
        <button class="cgm-edit-btn" data-app-action='${escapeHtml(editAction)}' aria-label="更换群主">
            <span class="cgm-edit-btn-icon">${ICON_EDIT}</span>
            <span>${isOwnerCurrentUser ? '转让' : '更换'}</span>
        </button>` : '';
    return `
        <div class="cgm-card">
            <div class="cgm-card-head">
                <span class="cgm-card-title">群主</span>
                <span class="cgm-card-sub">1 名 · 拥有最高管理权限</span>
            </div>
            <div class="cgm-owner-row">
                ${renderAvatarHtml(ownerDisplay, 48)}
                <div class="cgm-owner-info">
                    <div class="cgm-owner-name">${escapeHtml(ownerDisplay.label)}</div>
                    ${renderRoleBadge('群主')}
                </div>
                ${editBtn}
            </div>
        </div>
    `;
}

/**
 * 渲染「管理员」卡片：列表 + 「添加」按钮（最多 2）
 */
function renderAdminCard({ admins, allMemberDisplays, groupId, mode, canEdit, maxCount }) {
    const adminSet = new Set(admins.map(String));
    const adminRowsHtml = admins.map((aid) => {
        const disp = allMemberDisplays.find((d) => d.id === aid) || {
            id: aid, kind: 'ai', label: aid, avatar: '', avatarBg: DEFAULT_AI_AVATAR_BG, initial: '?',
        };
        const removeAction = JSON.stringify({
            action: 'appMethod', appId: 'chat', method: 'removeGroupAdmin',
            payload: { groupId, mode, aiPersonId: aid },
        });
        const removeBtn = canEdit ? `
            <button class="cgm-icon-btn" data-app-action='${escapeHtml(removeAction)}' aria-label="移除管理员">
                <span class="cgm-icon-btn-icon">${ICON_TRASH}</span>
            </button>` : '';
        return `
            <div class="cgm-admin-row">
                ${renderAvatarHtml(disp, 40)}
                <div class="cgm-admin-info">
                    <div class="cgm-admin-name">${escapeHtml(disp.label)}</div>
                    ${renderRoleBadge('管理员')}
                </div>
                ${removeBtn}
            </div>
        `;
    }).join('');

    const addBtn = canEdit && admins.length < maxCount ? `
        <button class="cgm-add-btn" data-app-action='${escapeHtml(JSON.stringify({
            action: 'appMethod', appId: 'chat', method: 'openGroupAdminPicker',
            payload: { groupId, mode },
        }))}'>
            <span class="cgm-add-btn-icon">${ICON_PLUS}</span>
            <span>添加管理员（${admins.length}/${maxCount}）</span>
        </button>` : `
        <div class="cgm-add-btn cgm-add-btn--disabled" aria-disabled="true">
            <span class="cgm-add-btn-icon">${ICON_PLUS}</span>
            <span>已达上限（${admins.length}/${maxCount}）</span>
        </div>`;

    const emptyHint = admins.length === 0
        ? `<div class="cgm-empty-hint">暂未设置管理员,群主可添加最多 ${maxCount} 名</div>`
        : '';

    return `
        <div class="cgm-card">
            <div class="cgm-card-head">
                <span class="cgm-card-title">管理员</span>
                <span class="cgm-card-sub">最多 ${maxCount} 名 AI 成员</span>
            </div>
            ${adminRowsHtml}
            ${emptyHint}
            ${addBtn}
        </div>
    `;
}

/**
 * 渲染「成员 + 群昵称」列表
 */
function renderMemberList({ ownerId, adminIds, memberNicknames, allMemberDisplays, defaultUserDisplay, groupId, mode, canEdit }) {
    // 排序：群主 → 管理员 → 其他成员（按名字）
    const adminSet = new Set(adminIds.map(String));
    const ownerStr = String(ownerId || '');

    const allItems = [defaultUserDisplay, ...allMemberDisplays.filter((d) => !d.isCurrentUser)];

    const sortedItems = allItems.slice().sort((a, b) => {
        // 群主置顶
        const aIsOwner = String(a.id) === ownerStr;
        const bIsOwner = String(b.id) === ownerStr;
        if (aIsOwner && !bIsOwner) return -1;
        if (!aIsOwner && bIsOwner) return 1;
        // 管理员其次
        const aIsAdmin = adminSet.has(String(a.id));
        const bIsAdmin = adminSet.has(String(b.id));
        if (aIsAdmin && !bIsAdmin) return -1;
        if (!aIsAdmin && bIsAdmin) return 1;
        // 然后按 label 字典序
        return String(a.label).localeCompare(String(b.label), 'zh-Hans-CN');
    });

    const rowsHtml = sortedItems.map((disp) => {
        const memberKey = disp.id;
        const storedNick = memberNicknames[memberKey] || '';
        const isOwner = String(disp.id) === ownerStr;
        const isAdmin = !isOwner && adminSet.has(String(disp.id));
        const role = isOwner ? '群主' : (isAdmin ? '管理员' : '');
        // 谁能改这一行的群昵称：
        //   · 自己那一行 —— 永远能改（哪怕群主是 AI，用户也有权给自己取名）
        //   · 别人那一行 —— 只有用户本人是群主时才能改（canEdit）
        // ⚠️ 之前这里写的是 `disp.isCurrentUser || !disp.isCurrentUser`，恒为 true，
        //    整个表达式退化成 `editable = canEdit`，结果就是「群主换成 AI 之后，
        //    用户连自己的群昵称都改不了」。
        const editable = canEdit || disp.isCurrentUser;

        const editNickAction = JSON.stringify({
            action: 'appMethod', appId: 'chat', method: 'openGroupMemberNicknameEdit',
            payload: { groupId, mode, memberId: disp.id, memberLabel: disp.label, memberKind: disp.kind, currentNickname: storedNick },
        });
        const aiGenAction = JSON.stringify({
            action: 'appMethod', appId: 'chat', method: 'aiGenerateGroupNickname',
            payload: { groupId, mode, memberId: disp.id },
        });

        const nicknameDisplay = storedNick
            ? escapeHtml(storedNick)
            : `<span class="cgm-muted">未设置</span>`;

        const editBtn = editable ? `
            <button class="cgm-nick-edit" data-app-action='${escapeHtml(editNickAction)}' aria-label="编辑群昵称">
                <span class="cgm-icon-btn-icon">${ICON_EDIT}</span>
            </button>` : '';
        const aiGenBtn = editable && disp.kind === 'ai' && isOwner ? `
            <button class="cgm-ai-gen" data-app-action='${escapeHtml(aiGenAction)}' aria-label="让 AI 生成群昵称">
                <span class="cgm-icon-btn-icon">${ICON_SPARKLE}</span>
                <span>AI 生成</span>
            </button>` : '';

        return `
            <div class="cgm-member-row" data-member-id="${escapeHtml(disp.id)}">
                ${renderAvatarHtml(disp, 44)}
                <div class="cgm-member-info">
                    <div class="cgm-member-name-line">
                        <span class="cgm-member-name">${escapeHtml(disp.label)}</span>
                        ${renderRoleBadge(role)}
                    </div>
                    <div class="cgm-member-nick-line">
                        <span class="cgm-member-nick-label">群昵称</span>
                        <span class="cgm-member-nick-value">${nicknameDisplay}</span>
                        ${editBtn}
                    </div>
                </div>
                ${aiGenBtn}
            </div>
        `;
    }).join('');

    return `
        <div class="cgm-card">
            <div class="cgm-card-head">
                <span class="cgm-card-title">群成员与群昵称</span>
                <span class="cgm-card-sub">共 ${sortedItems.length} 位</span>
            </div>
            ${rowsHtml}
        </div>
    `;
}

/**
 * 入口：渲染群成员管理详情页
 */
export function renderGroupManagePage(app, groupId, mode) {
    const sdk = window.settingsSdk;
    const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
    if (!sdk?.chatGroups || !defaultUser) {
        return `
            <div class="chat-favorites" data-group-id="${escapeHtml(groupId)}" data-mode="${escapeHtml(mode || '')}">
                <div class="chat-favorites-topbar">
                    <button class="chat-back-btn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}' aria-label="返回">${ICON_BACK}</button>
                    <h1>群成员管理</h1>
                    <span class="chat-favorites-topbar-spacer"></span>
                </div>
                <div class="chat-favorites-scroll">
                    <div class="cgm-empty-state">
                        <div class="cgm-empty-state-icon">${ICON_GROUP}</div>
                        <div class="cgm-empty-state-title">SDK 未就绪</div>
                        <div class="cgm-empty-state-sub">请稍后再试</div>
                    </div>
                </div>
            </div>
        `;
    }

    const data = loadManageData(sdk, defaultUser, groupId, mode);
    const displayMode = mode || data.entry?.mode || 'calendar';

    // 用户本人显示
    const userDisplay = resolveMemberDisplay(null, 'user', defaultUser, sdk);
    // AI 成员显示列表
    const aiMembers = data.members.map((m) => resolveMemberDisplay(m, 'ai', defaultUser, sdk));
    const allMemberDisplays = [userDisplay, ...aiMembers];

    // 群主显示
    const ownerDisp = allMemberDisplays.find((d) => String(d.id) === String(data.ownerId))
        || (String(data.ownerId) === String(userDisplay.id)
            ? userDisplay
            : { id: data.ownerId, kind: 'user', label: '群主', avatar: '', avatarBg: DEFAULT_AI_AVATAR_BG, initial: '?' });

    const isOwnerCurrentUser = String(data.ownerId) === String(userDisplay.id);
    // 用户是群主才能改管理员 / 别人的群昵称。
    // 群主是 AI 的时候，用户不是「什么都不能做」—— 他可以请群主去安排（下面那张卡）。
    const canEdit = isOwnerCurrentUser;

    const topbarHtml = `
        <div class="chat-favorites-topbar">
            <button class="chat-back-btn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}' aria-label="返回">${ICON_BACK}</button>
            <h1>群成员管理</h1>
            <span class="chat-favorites-topbar-spacer"></span>
        </div>
    `;

    // 摘要卡片：群名 + 成员数 + 提示「只有群主可编辑」
    const groupName = data.entry?.name || '未知群聊';
    const summaryHtml = `
        <div class="chat-favorites-summary">
            <div class="chat-favorites-summary-icon">${ICON_GROUP}</div>
            <div style="flex:1; min-width:0;">
                <strong>${escapeHtml(groupName)}</strong>
                <span>${allMemberDisplays.length} 位成员 · ${data.adminIds.length} 名管理员</span>
            </div>
        </div>
        ${canEdit ? '' : `
        <div class="cgm-readonly-hint">
            <span class="cgm-readonly-hint-icon">${ICON_SHIELD}</span>
            <span>群主是 ${escapeHtml(ownerDisp.label)}，管理员和别人的群昵称由 TA 决定；你可以在下面请 TA 安排</span>
        </div>`}
    `;

    // 群主是 AI 时给用户一个「请群主安排」的入口。
    // 按下去会把一段请求当作用户消息发给群主 AI，它输出的
    // [设为管理员:x] / [群昵称:x:y] 由系统真正执行并留下群公告。
    const askOwnerHtml = canEdit ? '' : `
        <div class="cgm-card">
            <div class="cgm-card-head">
                <span class="cgm-card-title">请群主安排群务</span>
                <span class="cgm-card-sub">由 ${escapeHtml(ownerDisp.label)} 决定管理员和群昵称</span>
            </div>
            <button class="cgm-add-btn" data-app-action='${escapeHtml(JSON.stringify({
                action: 'appMethod', appId: 'chat', method: 'askGroupOwnerAiToArrange',
                payload: { groupId, mode: displayMode },
            }))}'>
                <span class="cgm-add-btn-icon">${ICON_SPARKLE}</span>
                <span>让 ${escapeHtml(ownerDisp.label)} 安排管理员与群昵称</span>
            </button>
            <div class="cgm-empty-hint">TA 会按自己的性格安排，并在群里留下公告。安排结果可以反复请 TA 调整。</div>
        </div>
    `;

    const ownerCardHtml = renderOwnerCard({
        ownerDisplay: ownerDisp,
        groupId, mode: displayMode,
        isOwnerCurrentUser,
        canEdit,
    });

    const adminCardHtml = renderAdminCard({
        admins: data.adminIds,
        allMemberDisplays,
        groupId, mode: displayMode,
        canEdit,
        maxCount: MAX_ADMIN_COUNT,
    });

    const memberListHtml = renderMemberList({
        ownerId: data.ownerId,
        adminIds: data.adminIds,
        memberNicknames: data.memberNicknames,
        allMemberDisplays,
        defaultUserDisplay: userDisplay,
        groupId, mode: displayMode,
        canEdit,
    });

    const dangerHintHtml = `
        <div class="cgm-footer-note">
            <span>${ICON_USER}</span>
            <span>群主默认为当前用户,可在上方「群主」卡片中转让给任意 AI 成员</span>
        </div>
    `;

    return `
        <div class="chat-favorites chat-group-manage" data-group-id="${escapeHtml(groupId)}" data-mode="${escapeHtml(displayMode)}">
            ${topbarHtml}
            <div class="chat-favorites-scroll">
                ${summaryHtml}

                <div class="chat-favorites-section-title">权限管理</div>
                ${ownerCardHtml}
                ${askOwnerHtml}
                ${adminCardHtml}

                <div class="chat-favorites-section-title">成员与昵称</div>
                ${memberListHtml}

                ${dangerHintHtml}
            </div>
        </div>
    `;
}

export const MAX_GROUP_ADMIN_COUNT = MAX_ADMIN_COUNT;
export const MAX_GROUP_NICKNAME_LENGTH = NICKNAME_MAX_LENGTH;
export { loadManageData, resolveMemberDisplay };

export default renderGroupManagePage;
