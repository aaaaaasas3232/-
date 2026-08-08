/**
 * chat-app / 故事存档详情页
 *
 * Phase 12 — 接入真正的封存 / 恢复 / 查看 / 删除 (v0.42)
 *
 * 来源:旧版 chat.js `ChatApp.prototype.openStoryArchive(aiId)`
 *
 * 功能:
 *   - 顶部信息区(头像 + 名字 + 总存档数)
 *   - 「封存当前聊天记录」大按钮(粉渐变,白字 + 文件图标)
 *     - 点击 → 弹 archive-save 弹窗,填标题/简介后写存档 + 清空当前故事会话
 *   - 已封存的记录列表(白底卡片 + 名称 + 时间/条数 + 描述 + 3 操作按钮:恢复/查看/删除)
 *     - 恢复 → 当前故事会话有数据时弹覆盖确认 → 写入消息 + 清空当前
 *     - 查看 → 复用 ChatRecordDetailModal 弹窗展示完整消息
 *     - 删除 → 弹 archive-delete-confirm 确认 → 删存档
 *   - 空状态(粉色文件夹图标 + 「暂无封存记录」)
 *
 * 注意事项:
 *   - 全部存档数据走 sdk.storyArchives API + listen_db.sdkStoryArchives 表
 *   - 列表按钮必须用 data-app-action 派发(framework 不支持 on-addEventListener)
 *   - 顶栏的「当前会话消息数」从 sdk.chatMessages.count 读
 */

import { escapeHtml } from '@/src/core/escape.js';

// Demo 联系人(保留 demo fallback,跟其他页面保持一致)
const DEMO_CONTACTS = {
    'ai-1': { id: 'ai-1', name: '小美' },
    'ai-2': { id: 'ai-2', name: '小明' },
    'ai-3': { id: 'ai-3', name: '小蓝' },
    'ai-4': { id: 'ai-4', name: '小红' },
    'group-1': { id: 'group-1', name: '游戏群' },
};

// 头像背景色工具
function getAvatarColor(id) {
    const palette = ['#A8C8EC', '#F4A6CD', '#B8D4F0', '#FFD4E5', '#C8E6F4', '#FFC8DD', '#B8E6CF', '#D4B8F0'];
    let hash = 0;
    for (let i = 0; i < (id || '').length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
    }
    return palette[Math.abs(hash) % palette.length];
}

/**
 * 格式化日期为 zh-CN 风格的字符串(YYYY/MM/DD HH:mm)
 */
function formatArchiveDate(timestamp) {
    const d = new Date(timestamp);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 给当前时间生成一个建议的封存标题
 *  例:"夏日时光 2026/08/07 10:30"
 */
function defaultArchiveName(now = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    const date = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())}`;
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    return `故事存档 ${date} ${time}`;
}

/**
 * 渲染单个存档卡片
 *   - 三个操作按钮都通过 data-app-action 派发,framework 顶层 click 委托拿到
 *   - payload 里携带 archiveId,method 端从 app.state 取实际对象
 */
function renderArchiveItem(archive, idx) {
    const dateStr = formatArchiveDate(archive.createdAt);
    const descHtml = archive.description
        ? `<div class="archive-item-desc">${escapeHtml(archive.description)}</div>`
        : '';

    // 三个 action 的 payload(framework 派发后由 methods.onArchiveRestore/onArchiveView/onArchiveDelete 解析)
    const restoreAction = JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method: 'onArchiveRestore',
        archiveId: archive.id,
    });
    const viewAction = JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method: 'onArchiveView',
        archiveId: archive.id,
    });
    const deleteAction = JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method: 'onArchiveDelete',
        archiveId: archive.id,
    });

    return `
        <div class="archive-item" data-archive-id="${escapeHtml(archive.id)}" data-archive-idx="${idx}">
            <div class="archive-item-body">
                <div class="archive-item-header">
                    <div class="archive-item-info">
                        <div class="archive-item-name">${escapeHtml(archive.name)}</div>
                        <div class="archive-item-meta">${escapeHtml(dateStr)} · ${archive.messageCount} 条消息</div>
                    </div>
                </div>
                ${descHtml}
                <div class="archive-item-actions">
                    <button class="archive-action-btn archive-action-restore" data-app-action='${escapeHtml(restoreAction)}' type="button">
                        <svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" fill="#4A6FA5"/></svg>
                        <span>恢复</span>
                    </button>
                    <button class="archive-action-btn archive-action-view" data-app-action='${escapeHtml(viewAction)}' type="button">
                        <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="#666"/></svg>
                        <span>查看</span>
                    </button>
                    <button class="archive-action-btn archive-action-delete" data-app-action='${escapeHtml(deleteAction)}' type="button" aria-label="删除">
                        <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="#DC2626"/></svg>
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * 渲染故事存档详情页
 *
 * @param {Object} app - app 配置(framework 注入)
 * @param {string} contactId - 联系人 id(可对应私聊或群聊)
 * @returns {string} HTML 字符串
 */
export function renderStoryArchivePage(app, contactId) {
    // v0.27 解析 pageId
    let aiPersonId = contactId;
    let mode = 'story';
    const lastDash = contactId.lastIndexOf('-');
    if (lastDash > 0) {
        const tail = contactId.slice(lastDash + 1);
        if (tail === 'calendar' || tail === 'story') {
            mode = tail;
            aiPersonId = contactId.slice(0, lastDash);
        }
    }

    // 1. 联系人 / AI 名称
    let entry = null;
    try {
        const sdk = window.settingsSdk;
        const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive();
        entry = (sdk && defaultUser) ? sdk.chatFriends?.get?.(defaultUser, aiPersonId, mode) : null;
    } catch (_) {}
    const baseDemo = DEMO_CONTACTS[aiPersonId] || DEMO_CONTACTS[contactId] || { id: aiPersonId, name: aiPersonId };
    const contact = entry
        ? { ...baseDemo, id: aiPersonId, name: entry.displayName || baseDemo.name,
            avatar: entry.avatar || baseDemo.avatar,
            avatarBg: entry.avatarBg || baseDemo.avatarBg || '' }
        : baseDemo;

    const avatarColor = getAvatarColor(contact.id);
    const avatarText = (contact.name || '?').charAt(0);

    // 2. 真实存档列表(SDK 优先) + 当前故事会话条数
    let archives = [];
    let currentMessageCount = 0;
    try {
        const sdk = window.settingsSdk;
        const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive();
        if (sdk?.storyArchives && defaultUser) {
            archives = sdk.storyArchives.list(defaultUser, aiPersonId) || [];
        }
        if (sdk?.chatMessages?.count) {
            currentMessageCount = sdk.chatMessages.count(null, aiPersonId, mode) || 0;
        }
    } catch (_) {
        archives = [];
    }
    const archiveCount = archives.length;

    // 3. 顶部 header(只保留返回按钮)
    const headerBarHtml = `
        <div class="chat-story-archive-topbar">
            <button class="chat-back-btn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}'>
                <svg viewBox="0 0 24 24">
                    <polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <div class="chat-story-archive-topbar-title">故事记录</div>
        </div>
    `;

    const headerHtml = `
        <div class="story-archive-header">
            <div class="story-archive-avatar" data-avatar-color="${escapeHtml(avatarColor)}">
                <span class="story-archive-avatar-text">${escapeHtml(avatarText)}</span>
            </div>
            <div class="story-archive-header-text">
                <div class="story-archive-header-name">${escapeHtml(contact.name)} 的故事存档</div>
                <div class="story-archive-header-sub">共 ${archiveCount} 个存档</div>
            </div>
        </div>
    `;

    // 4. 封存按钮(粉渐变大按钮) — 通过 data-app-action 派发
    //   payload 里带 aiPersonId / mode / currentMessageCount 给 methods 用
    const suggestName = defaultArchiveName();
    const saveAction = JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method: 'openArchiveSaveModal',
        aiPersonId,
        mode,
        currentMessageCount,
        suggestedName: suggestName,
        contactName: contact.name || '',
    });
    const saveButtonHtml = `
        <button id="save-current-chat" class="story-archive-save-btn" type="button" data-app-action='${escapeHtml(saveAction)}'>
            <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" fill="white"/>
            </svg>
            <span>封存当前聊天记录</span>
        </button>
    `;

    // ★ v0.61.3 「故事概要」按钮 — 通过 data-app-action 派发
    //   点击 → 调 methods.openStorySummaryRangeModal → 弹 SummaryRangeModal(story 模式)
    const storySummaryAction = JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method: 'openStorySummaryRangeModal',
        aiPersonId,
        mode,
        contactName: contact.name || '',
    });
    const storySummaryButtonHtml = `
        <button id="open-story-summary" class="story-archive-summary-btn" type="button"
            data-app-action='${escapeHtml(storySummaryAction)}'>
            <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M12 2.5l2.4 5 5.5.8-4 3.9.9 5.5L12 15.4 7.2 17.7l.9-5.5-4-3.9 5.5-.8L12 2.5z" fill="#D4728A"/>
            </svg>
            <span>故事概要</span>
        </button>
    `;

    // 5. 存档列表
    let archiveListHtml;
    if (archiveCount === 0) {
        archiveListHtml = `
            <div class="story-archive-empty">
                <div class="story-archive-empty-icon">
                    <svg viewBox="0 0 24 24" width="28" height="28">
                        <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V6h5.17l2 2H20v10z" fill="#D4728A"/>
                    </svg>
                </div>
                <div class="story-archive-empty-title">暂无封存记录</div>
                <div class="story-archive-empty-sub">点击上方按钮封存当前聊天</div>
            </div>
        `;
    } else {
        archiveListHtml = `
            <div id="archives-list" class="story-archive-list">
                ${archives.map((archive, idx) => renderArchiveItem(archive, idx)).join('')}
            </div>
        `;
    }

    const listSectionHtml = `
        <div class="story-archive-list-section">
            <div class="story-archive-list-title">
                <svg viewBox="0 0 24 24" width="16" height="16">
                    <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V6h5.17l2 2H20v10z" fill="#4A6FA5"/>
                </svg>
                <span>已封存的记录</span>
            </div>
            ${archiveListHtml}
        </div>
    `;

    return `
        <div class="chat-story-archive" data-contact-id="${escapeHtml(contactId)}">
            ${headerBarHtml}
            <div class="chat-story-archive-page">
                ${headerHtml}
                <div class="story-archive-actions-row">
                    ${saveButtonHtml}
                    ${storySummaryButtonHtml}
                </div>
                ${listSectionHtml}
            </div>
        </div>
    `;
}

export default renderStoryArchivePage;
