/**
 * chat-app / 群聊设置详情页
 *
 * v0.69 重写：读取真实 SDK 数据 + 全部设置项可编辑
 *
 * 功能:
 *   - 群头像(实时从成员 aiPerson 拼九宫格) + 群名称(可编辑) + 成员数
 *   - 群信息卡片:群名称 / 群公告 / 群二维码(预留) / 备注(可编辑) / 查找聊天记录(日历+故事双模式)
 *   - 消息设置卡片:置顶聊天 / 消息免打扰 / 消息提醒 / 聊天背景(per-mode 独立)
 *   - 群管理卡片:群成员(实时头像) / 群聊设置(预留) / 聊天记录(日历+故事双模式)
 *   - 危险操作卡片:清空聊天记录 / 退出群聊
 *
 * 与私聊 chat-settings-page 的对齐:
 *   - 群名称 → openGroupNameEdit (复用 AiRemarkModal)
 *   - 群公告 → openGroupAnnouncementEdit (复用 AiRemarkModal,允许多行)
 *   - 群备注 → openGroupRemarkEdit (复用 AiRemarkModal)
 *   - 聊天背景 → openChatBackgroundModal (复用)
 *   - 查找聊天记录 → favorites-group_{groupId} (复用)
 *   - 聊天记录(日历模式) → memory-management-{groupId}-calendar (复用)
 *   - 聊天记录(故事模式) → memory-management-{groupId}-story (复用)
 *   - 清空聊天记录 → 走 framework 确认弹窗 → sdk.chatMessages.clearByConversation
 *   - 退出群聊 → 走 framework 确认弹窗 → sdk.chatGroups.remove
 */

import { escapeHtml } from '@/src/core/escape.js';
import { getAiMeta, resolveAiAvatar } from '../aiMeta.js';

// ★ v0.80 移除 DEMO_GROUPS 占位群聊 — 真实群聊全部走 SDK chatGroups,
//   找不到就显示「未知群聊」空状态,不再展示示例数据。

/**
 * 从 SDK 实时读取群聊 entry(优先读 user.socialProfiles.chat.calendarGroups / storyGroups)
 * 找不到就返回 exists:false 的空对象,调用方负责展示「未知群聊」空态。
 *
 * @param {string} groupId
 * @returns {Object} { id, name, announcement, remark, isPinned, isMuted,
 *                     isRemindEnabled, members[], mode, chatBackground, exists }
 */
function loadGroupFromSdk(groupId) {
    const out = {
        id: groupId,
        name: '未知群聊',
        announcement: '',
        remark: '',
        isPinned: false,
        isMuted: false,
        isRemindEnabled: true,
        members: [],
        memberCount: 0,
        mode: 'calendar',
        chatBackground: '',
        exists: false,
        defaultUserId: null, // ★ v0.75 返回当前用户 ID 用于判断本人
    };
    try {
        const sdk = window.settingsSdk;
        const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
        out.defaultUserId = defaultUser?.id || null; // ★ v0.75 记录当前用户 ID
        if (!sdk?.chatGroups || !defaultUser) return out;
        // 两个 mode 都找一遍
        let entry = null;
        let mode = 'calendar';
        for (const m of ['calendar', 'story']) {
            const e = sdk.chatGroups.get?.(defaultUser, groupId, m);
            if (e) { entry = e; mode = m; break; }
        }
        if (!entry) return out;
        out.exists = true;
        out.name = entry.name || '未命名群聊';
        out.announcement = entry.announcement || '';
        out.remark = entry.remark || '';
        out.isPinned = !!entry.isPinned;
        out.isMuted = !!entry.isMuted;
        out.isRemindEnabled = entry.isRemindEnabled !== false;
        out.mode = mode;
        out.chatBackground = entry.chatBackground || '';
        // 解析成员(实时 aiPerson,缺失走 fallback)
        const resolvedMembers = (sdk.chatGroups.resolveMembers && entry)
            ? sdk.chatGroups.resolveMembers(sdk, defaultUser, entry)
            : (entry.members || []).map((id) => ({ id }));
        out.members = resolvedMembers.map((m) => {
            const id = m.id || m.aiPersonId;
            const meta = getAiMeta(id);
            // ★ v0.71 头像背景色统一:meta.avatarBg(aiMeta 实时) → resolveAiAvatar 默认
            const aiAv = resolveAiAvatar(id);
            return {
                id,
                name: meta.exists ? meta.nickname : (m.name || id),
                avatar: meta.exists ? meta.avatar : (m.avatar || aiAv.url),
                avatarBg: meta.exists ? meta.avatarBg : (m.avatarBg || aiAv.bg),
                role: m.role || 'member',
            };
        });
        // ★ 算上用户本人：members 里只有 AI，用户不在里面。
        //   两个 AI 的群，界面上应该写「3 位成员」。
        out.memberCount = (out.members.length || entry.members?.length || 0) + 1;
        return out;
    } catch (err) {
        console.warn('[chat-group-settings] loadGroupFromSdk failed', err);
        return out;
    }
}

// 渲染简易 toggle(iOS 风)
function renderToggle(checked, id = '') {
    const idAttr = id ? ` id="${escapeHtml(id)}"` : '';
    return `
        <label class="chat-toggle"${idAttr}>
            <input type="checkbox" class="chat-toggle-input" ${checked ? 'checked' : ''}>
            <span class="chat-toggle-track"></span>
            <span class="chat-toggle-thumb"></span>
        </label>
    `;
}

// 渲染设置项(基础,支持点击派发)
function renderSettingItem({ id, label, value, arrow = true, extra = '', onClickAction = '' }) {
    const actionAttr = onClickAction
        ? ` data-app-action='${escapeHtml(JSON.stringify(onClickAction))}'`
        : '';
    // 让整个 item 可点击的样式
    const clickableClass = onClickAction ? ' chat-setting-item-clickable' : '';
    return `
        <div class="chat-setting-item${clickableClass}" ${id ? `id="${escapeHtml(id)}"` : ''}${actionAttr}>
            <span class="chat-setting-label">${escapeHtml(label)}</span>
            <span class="chat-setting-value">
                ${value !== null && value !== undefined ? escapeHtml(String(value)) : ''}
                ${arrow ? '<svg class="chat-setting-arrow" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>' : ''}
            </span>
            ${extra}
        </div>
    `;
}

// 渲染设置项 + 主开关 / 描述
function renderToggleItem({ id, label, labelContent, desc, checked, onToggleAction = '' }) {
    const actionAttr = onToggleAction
        ? ` data-toggle-action='${escapeHtml(JSON.stringify(onToggleAction))}'`
        : '';
    return `
        <div class="chat-setting-item chat-setting-toggle-item" ${id ? `id="${escapeHtml(id)}"` : ''}${actionAttr}>
            <div class="chat-setting-label-block">
                ${labelContent
                    ? labelContent
                    : (label ? `<span class="chat-setting-label">${escapeHtml(label)}</span>` : '')}
                ${desc ? `<span class="chat-setting-desc">${escapeHtml(desc)}</span>` : ''}
            </div>
            ${renderToggle(checked, id ? `${id}__toggle` : '')}
        </div>
    `;
}

// 渲染区块标题
function renderSectionTitle(svg, title, color = '#4A6FA5') {
    return `
        <div class="chat-section-title">
            ${svg}
            <span style="color:${escapeHtml(color)};">${escapeHtml(title)}</span>
        </div>
    `;
}

// 渲染群头像(九宫格拼接,实时从成员)
function renderGroupAvatar(members, size = 80) {
    const gridSize = Math.min(members.length, 4);

    let cellsHtml = '';
    for (let i = 0; i < 4; i++) {
        if (i < gridSize) {
            const member = members[i];
            // ★ v0.71 群成员头像统一从 aiMeta.resolveAiAvatar 拿
            const av = resolveAiAvatar(member.id || '');
            const char = (member.name || av.text || '?').charAt(0);
            const bg = member.avatarBg || av.bg;
            const inner = member.avatar
                ? `<img src="${escapeHtml(member.avatar)}" alt="" style="width:100%;height:100%;object-fit:cover;" />`
                : escapeHtml(char);
            cellsHtml += `<div style="background:${escapeHtml(bg)};display:flex;align-items:center;justify-content:center;font-size:${size * 0.2}px;color:white;font-weight:500;">${inner}</div>`;
        } else {
            cellsHtml += `<div style="background:#E8E8E8;"></div>`;
        }
    }

    return `
        <div style="width:${size}px;height:${size}px;border-radius:16px;overflow:hidden;border:3px solid #D6E4FF;background:#fff;display:grid;grid-template-columns:repeat(2,1fr);gap:1px;">
            ${cellsHtml}
        </div>
    `;
}

// 渲染成员头像(实时从 aiPerson 读 avatar/avatarBg)
function renderMemberAvatar(member, size = 40) {
    // ★ v0.71 头像背景:member.avatarBg (实时) → resolveAiAvatar 默认
    const av = resolveAiAvatar(member.id || '');
    const bg = member.avatarBg || av.bg;
    const char = (member.name || '?').charAt(0);
    const inner = member.avatar
        ? `<img src="${escapeHtml(member.avatar)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
        : escapeHtml(char);
    return `
        <div style="width:${size}px;height:${size}px;border-radius:50%;background:${escapeHtml(bg)};display:flex;align-items:center;justify-content:center;font-size:${size * 0.35}px;color:white;font-weight:500;overflow:hidden;">
            ${inner}
        </div>
    `;
}

/**
 * 把带前缀的 chatBackground 转成 CSS 预览样式(对齐私聊 chat-settings 的同名 helper)
 */
function chatBackgroundToCss(value) {
    if (!value) return '';
    if (value.startsWith('color:')) {
        return `background-color: ${value.slice('color:'.length)}; background-image: none;`;
    }
    if (value.startsWith('gradient:')) {
        const grad = value.slice('gradient:'.length);
        return `background: ${grad};`;
    }
    if (value.startsWith('image:')) {
        const url = value.slice('image:'.length).replace(/"/g, '\\"');
        return `background-image: url("${url}"); background-color: #F8F9FA; background-size: cover; background-position: center;`;
    }
    const url = value.replace(/"/g, '\\"');
    return `background-image: url("${url}"); background-color: #F8F9FA; background-size: cover; background-position: center;`;
}

function renderChatBackgroundPreview(value) {
    const css = chatBackgroundToCss(value);
    if (!css) return '';
    return `<span class="chat-setting-bg-preview" style="display:inline-block;width:24px;height:24px;border-radius:6px;border:1px solid rgba(0,0,0,0.08);vertical-align:middle;margin-left:6px;${escapeHtml(css)}"></span>`;
}

/**
 * ★ v0.82 群聊回复提示词启用计数(对齐私聊 chat-settings 的 replyPromptDisplay)
 *   - 读 sdk.groupReplyPrompts.listActive(user, groupId, mode)
 *   - SDK 未就绪 / 群聊不存在 → 0
 *   - 大于 0 显示「N 个已启用」,否则「未设置」
 */
function resolveGroupReplyPromptDisplay(user, groupId, mode) {
    try {
        const sdk = window.settingsSdk;
        if (sdk?.groupReplyPrompts?.listActive && user && groupId && mode) {
            const list = sdk.groupReplyPrompts.listActive(user, groupId, mode) || [];
            return list.length > 0 ? `${list.length} 个已启用` : '未设置';
        }
    } catch (_) { /* 静默 */ }
    return '未设置';
}

/**
 * 渲染群聊设置详情页
 *
 * @param {Object} app - app 配置(framework 注入)
 * @param {string} groupId - 群聊 id
 * @returns {string} HTML 字符串
 */
export function renderGroupSettingsPage(app, groupId) {
    // v0.80:从 SDK 实时读取群聊数据;找不到就显示空状态,不再回落 demo
    const sdkGroup = loadGroupFromSdk(groupId);
    const fallback = {
        id: groupId,
        name: '未知群聊',
        memberCount: 0,
        announcement: '',
        remark: '',
        isPinned: false,
        isMuted: false,
        isRemindEnabled: true,
        members: [],
    };

    const group = sdkGroup.exists
        ? sdkGroup
        : {
            ...fallback,
            members: [],
            chatBackground: '',
        };

    // ★ v0.71 群头像背景:走 aiMeta(群没有 aiPersonId,只能用 id 哈希兜底,
    //   如果想用真实数据,需要 chatGroup 关联 aiPerson group meta)
    const avatarColor = resolveAiAvatar(group.id).bg;
    const displayMemberCount = group.memberCount || ((group.members?.length || 0) + 1);
    const displayMode = group.mode || 'calendar';

    // ★ v0.82 默认用户卡(用于群聊 settingsSdk 走 user 维度的 API)
    const defaultUser = (() => {
        try {
            const sdk = window.settingsSdk;
            return sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.() || null;
        } catch (_) { return null; }
    })();

    // ★ v0.82 群聊回复提示词启用计数(对齐私聊 chat-settings 的 replyPromptDisplay)
    const groupReplyPromptsDisplay = resolveGroupReplyPromptDisplay(defaultUser, groupId, displayMode);

    // ★ v0.82 prompt-manager 群聊版 pageId 命名
    //   私聊:prompt-manager-{aiPersonId}-{mode}
    //   群聊:prompt-manager-group_{groupId}-{mode}(group_ 前缀区隔,
    //   {groupId} 本身可能包含 - ,不能用 lastDash 解析方式)
    const replyPromptPageId = `prompt-manager-group_${escapeHtml(groupId)}-${escapeHtml(displayMode)}`;

    // ★ 群信息卡片标题
    const groupInfoTitle = renderSectionTitle(
        '<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
        '群信息'
    );

    // ★ 编辑 action 模板(派发到 chat-app methods,见 index.js)
    const editGroupNameAction = {
        action: 'appMethod', appId: 'chat', method: 'openGroupNameEdit',
        payload: { groupId, mode: displayMode },
    };
    const editGroupAnnouncementAction = {
        action: 'appMethod', appId: 'chat', method: 'openGroupAnnouncementEdit',
        payload: { groupId, mode: displayMode },
    };
    const editGroupRemarkAction = {
        action: 'appMethod', appId: 'chat', method: 'openGroupRemarkEdit',
        payload: { groupId, mode: displayMode },
    };
    const editChatBackgroundAction = {
        action: 'appMethod', appId: 'chat', method: 'openChatBackgroundModal',
        payload: { contactId: groupId, mode: displayMode, isGroup: true },
    };

    const groupInfoCard = `
        <div class="chat-settings-card">
            ${groupInfoTitle}
            ${renderSettingItem({
                id: 'group-name',
                label: '群聊名称',
                value: group.name || '未命名群聊',
                onClickAction: editGroupNameAction,
            })}
            ${renderSettingItem({
                id: 'group-announcement',
                label: '群公告',
                value: group.announcement ? truncateText(group.announcement, 24) : '未设置',
                onClickAction: editGroupAnnouncementAction,
            })}
            ${renderSettingItem({
                id: 'group-qr',
                label: '群二维码',
                value: '查看',
            })}
            ${renderSettingItem({
                id: 'group-remark',
                label: '群昵称',
                value: group.remark ? truncateText(group.remark, 24) : '未设置',
                onClickAction: editGroupRemarkAction,
            })}
        </div>
    `;

    // ★ 消息设置卡片(per-mode 独立,置顶/免打扰/提醒/背景)
    const msgSettingsTitle = renderSectionTitle(
        '<svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
        '消息设置'
    );

    const toggleGroupPinAction = {
        action: 'appMethod', appId: 'chat', method: 'toggleGroupSetting',
        payload: { groupId, mode: displayMode, field: 'isPinned' },
    };
    const toggleGroupMuteAction = {
        action: 'appMethod', appId: 'chat', method: 'toggleGroupSetting',
        payload: { groupId, mode: displayMode, field: 'isMuted' },
    };
    const toggleGroupRemindAction = {
        action: 'appMethod', appId: 'chat', method: 'toggleGroupSetting',
        payload: { groupId, mode: displayMode, field: 'isRemindEnabled' },
    };

    const msgSettingsCard = `
        <div class="chat-settings-card">
            ${msgSettingsTitle}
            <div class="chat-setting-item chat-setting-item-clickable" id="set-api-call"
                data-app-action='{"action":"appMethod","appId":"chat","method":"openGroupApiCallModal","payload":{"groupId":"${escapeHtml(groupId)}","mode":"${escapeHtml(displayMode)}"}}'>
                <span class="chat-setting-label">API 调用</span>
                <span class="chat-setting-value">
                    ${(() => {
                        // 显示群聊默认 API
                        try {
                            const localKey = 'xiaoting::chat-default-api-key::group::' + groupId;
                            const savedRaw = (() => { try { return localStorage.getItem(localKey) || ''; } catch (_) { return ''; } })();
                            if (savedRaw) {
                                const parts = savedRaw.split('::');
                                const refType = parts[0] || 'key';
                                const refId = parts.slice(1).join('::');
                                const labelKey = 'xiaoting::api-label::' + refType + '::' + refId;
                                const savedLabel = (() => { try { return localStorage.getItem(labelKey) || ''; } catch (_) { return ''; } })();
                                if (savedLabel) {
                                    return escapeHtml(savedLabel) + (refType === 'group' ? ' (组)' : '');
                                }
                            }
                            return '<span class="chat-setting-default-text">点击设置</span>';
                        } catch (_) { return '<span class="chat-setting-default-text">点击设置</span>'; }
                    })()}
                    <svg class="chat-setting-arrow" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
                </span>
            </div>
            <div class="chat-setting-item chat-setting-item-clickable" id="set-group-reply-prompt"
                data-app-action='{"action":"detail","appId":"chat","pageId":"${replyPromptPageId}"}'>
                <span class="chat-setting-label">回复提示词</span>
                <span class="chat-setting-value">
                    ${groupReplyPromptsDisplay === '未设置'
                        ? '<span class="chat-setting-default-text">未设置</span>'
                        : escapeHtml(groupReplyPromptsDisplay)}
                    <svg class="chat-setting-arrow" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
                </span>
            </div>
            ${renderToggleItem({
                id: 'group-is-pinned',
                label: '置顶聊天',
                checked: !!group.isPinned,
                onToggleAction: toggleGroupPinAction,
            })}
            ${renderToggleItem({
                id: 'group-is-muted',
                label: '消息免打扰',
                desc: '开启后不会收到推送通知',
                checked: !!group.isMuted,
                onToggleAction: toggleGroupMuteAction,
            })}
            ${renderToggleItem({
                id: 'group-is-remind',
                label: '消息提醒',
                desc: '显示消息内容预览',
                checked: !!group.isRemindEnabled,
                onToggleAction: toggleGroupRemindAction,
            })}
            <div class="chat-setting-item chat-setting-item-clickable chat-setting-last" id="group-chat-background"
                data-app-action='${escapeHtml(JSON.stringify(editChatBackgroundAction))}'>
                <span class="chat-setting-label">聊天背景</span>
                <span class="chat-setting-value">
                    ${group.chatBackground
                        ? renderChatBackgroundPreview(group.chatBackground)
                        : '<span class="chat-setting-default-text">默认</span>'}
                    <svg class="chat-setting-arrow" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
                </span>
            </div>
        </div>
    `;

    // ★ 游戏入口卡片
    const gameTitle = renderSectionTitle(
        '<svg viewBox="0 0 24 24" fill="#9B7AA0"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM11 13H8v3H6v-3H3v-2h3V8h2v3h3v2zm5-1.5c0 .28-.22.5-.5.5h-2v2H9v-2H8v-1c0-.28.22-.5.5-.5h2V8h1v1.5h1zm4 .5c0 .28-.22.5-.5.5h-1.5v1.5H14v-1.5H13V12h1.5c.28 0 .5.22.5.5v.5z"/></svg>',
        '小游戏'
    );

    const gameCard = `
        <div class="chat-settings-card">
            ${gameTitle}
            <div class="chat-setting-item chat-setting-item-clickable" id="game-selector"
                 data-app-action='{"action":"detail","appId":"chat","pageId":"game-selector-${escapeHtml(groupId)}"}'>
                <span class="chat-setting-label">游戏大厅</span>
                <span class="chat-setting-value" style="color:#9B7AA0;font-size:12px;">
                    狼人杀 · 谁是卧底 · 大富翁
                    <svg class="chat-setting-arrow" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
                </span>
            </div>
        </div>
    `;

    // ★ 群管理卡片标题
    const groupManageTitle = renderSectionTitle(
        '<svg viewBox="0 0 24 24"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
        '群管理'
    );

    // 渲染群成员列表(最多显示 5 个 + 查看更多)
    const membersPreview = (group.members || []).slice(0, 5);
    const moreCount = displayMemberCount - membersPreview.length;

    const membersHtml = `
        <div class="group-members-preview" id="group-members">
            <div class="group-members-avatars">
                ${membersPreview.map(m => `
                    <div class="group-member-avatar">
                        ${renderMemberAvatar(m, 40)}
                        ${m.role === 'admin' ? '<div class="admin-badge">群主</div>' : ''}
                    </div>
                `).join('')}
                ${moreCount > 0 ? `
                    <div class="group-member-more">
                        <span>+${moreCount}</span>
                    </div>
                ` : ''}
            </div>
            <svg class="chat-setting-arrow" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
        </div>
    `;

    // ★ v0.69 群聊管理卡片(日历模式 + 故事模式 双入口,沿用私聊 chat-settings 同款)
    const isCalendarMode = displayMode === 'calendar';
    // ★ v0.68 故事模式下不显示「层级管理」(故事概要不参与层级,层级管理仅日历模式用)
    const memoryManagementAction = (mode) => JSON.stringify({
        action: 'detail',
        appId: 'chat',
        pageId: `memory-management-${groupId}-${mode}`,
    });
    const historyCardTitle = renderSectionTitle(
        '<svg viewBox="0 0 24 24"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>',
        '聊天记录管理'
    );

    // ★ v0.81 「群聊设置」入口跳到 group-manage-{groupId}-{mode} 群成员管理详情页
    const groupManageAction = {
        action: 'detail', appId: 'chat',
        pageId: `group-manage-${groupId}-${displayMode}`,
    };
    const groupManageCard = `
        <div class="chat-settings-card">
            ${groupManageTitle}
            <div class="chat-setting-item" id="group-members-item">
                <span class="chat-setting-label">群成员</span>
                ${membersHtml}
            </div>
            ${renderSettingItem({
                id: 'group-edit',
                label: '群聊设置',
                value: '群主 / 管理员 / 群昵称',
                onClickAction: groupManageAction,
            })}
        </div>
        <div class="chat-settings-card">
            ${historyCardTitle}
            ${isCalendarMode ? `
            <div class="chat-setting-item chat-setting-icon-item" id="group-memory-management"
                data-app-action='${escapeHtml(memoryManagementAction(displayMode))}'>
                <div class="chat-setting-icon-mini" data-color-kind="blue">
                    <svg viewBox="0 0 24 24"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>
                </div>
                <div class="chat-setting-label-block">
                    <span class="chat-setting-label">层级管理</span>
                    <span class="chat-setting-desc">配置分级概要 + 查看历史</span>
                </div>
                <svg class="chat-setting-arrow chat-setting-arrow-solo" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
            </div>
            <div class="chat-setting-item chat-setting-icon-item" id="group-calendar-view"
                data-app-action='{"action":"detail","appId":"chat","pageId":"calendar-view-${escapeHtml(groupId)}"}'>
                <div class="chat-setting-icon-mini" data-color-kind="blue">
                    <svg viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z"/></svg>
                </div>
                <div class="chat-setting-label-block">
                    <span class="chat-setting-label">日历视图</span>
                    <span class="chat-setting-desc">按日期查看聊天记录,生成概要</span>
                </div>
                <svg class="chat-setting-arrow chat-setting-arrow-solo" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
            </div>
            ` : `
            <div class="chat-setting-item chat-setting-icon-item" id="group-story-archive"
                data-app-action='{"action":"detail","appId":"chat","pageId":"story-management-${escapeHtml(groupId)}"}'>
                <div class="chat-setting-icon-mini" data-color-kind="pink">
                    <svg viewBox="0 0 24 24"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/></svg>
                </div>
                <div class="chat-setting-label-block">
                    <span class="chat-setting-label">故事管理</span>
                    <span class="chat-setting-desc">封存聊天、生成和管理故事概要</span>
                </div>
                <svg class="chat-setting-arrow chat-setting-arrow-solo" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
            </div>
            `}
            <div class="chat-setting-item chat-setting-icon-item chat-setting-last" id="group-favorites"
                data-app-action='{"action":"detail","appId":"chat","pageId":"favorites-group_${escapeHtml(groupId)}"}'>
                <div class="chat-setting-icon-mini" data-color-kind="blue">
                    <svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" fill="none" stroke="currentColor" stroke-width="2"/></svg>
                </div>
                <div class="chat-setting-label-block">
                    <span class="chat-setting-label">收藏</span>
                    <span class="chat-setting-desc">查看本群聊的所有收藏</span>
                </div>
                <svg class="chat-setting-arrow chat-setting-arrow-solo" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
            </div>
        </div>
    `;

    // ★ 危险操作卡片
    const dangerCardBody = `
        <div class="chat-settings-card chat-settings-card-danger">
            <div class="chat-setting-item chat-setting-item-clickable chat-setting-last chat-setting-danger-item" id="clear-group-history"
                data-app-action='${escapeHtml(JSON.stringify({
                    action: 'appMethod', appId: 'chat', method: 'clearGroupHistory',
                    payload: { groupId, mode: displayMode },
                }))}'>
                <span class="chat-setting-danger-text">清空聊天记录</span>
            </div>
            <div class="chat-setting-item chat-setting-item-clickable chat-setting-last chat-setting-danger-item" id="exit-group"
                data-app-action='${escapeHtml(JSON.stringify({
                    action: 'appMethod', appId: 'chat', method: 'exitGroup',
                    payload: { groupId, mode: displayMode },
                }))}'>
                <span class="chat-setting-danger-text exit-group">退出群聊</span>
            </div>
        </div>
    `;

    // 顶部 header(返回按钮 + 游戏按钮)
    const headerBarHtml = `
        <div class="chat-settings-topbar">
            <button class="chat-back-btn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}'>
                <svg viewBox="0 0 24 24">
                    <polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <div class="chat-settings-topbar-actions">
                <button class="chat-settings-topbar-btn" id="group-settings-game-btn"
                        data-app-action='{"action":"detail","appId":"chat","pageId":"game-selector-${escapeHtml(groupId)}"}'>
                    <svg viewBox="0 0 24 24" fill="#9B7AA0">
                        <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM11 13H8v3H6v-3H3v-2h3V8h2v3h3v2zm5-1.5c0 .28-.22.5-.5.5h-2v2H9v-2H8v-1c0-.28.22-.5.5-.5h2V8h1v1.5h1zm4 .5c0 .28-.22.5-.5.5h-1.5v1.5H14v-1.5H13V12h1.5c.28 0 .5.22.5.5v.5z"/>
                    </svg>
                </button>
            </div>
        </div>
    `;

    return `
        <div class="chat-settings chat-group-settings" data-group-id="${escapeHtml(groupId)}" data-mode="${escapeHtml(displayMode)}">
            ${headerBarHtml}
            <div class="chat-settings-page">
                <div class="group-settings-header">
                    <div class="group-settings-avatar">
                        ${renderGroupAvatar(group.members || [], 80)}
                    </div>
                    <div class="group-settings-name">${escapeHtml(group.name || '未命名群聊')}</div>
                    <div class="group-settings-count">${displayMemberCount} 位群成员</div>
                </div>
                ${groupInfoCard}
                ${msgSettingsCard}
                ${gameCard}
                ${groupManageCard}
                ${dangerCardBody}
            </div>
        </div>
    `;
}

// 工具:截断长文本
function truncateText(text, max) {
    const t = String(text || '').trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max)}…`;
}

export default renderGroupSettingsPage;