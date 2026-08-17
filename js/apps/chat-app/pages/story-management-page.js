/**
 * chat-app / 故事管理详情页
 *
 * v0.68 — 故事模式主角:故事概要管理
 *   - 「故事管理」页面对应日历视图的「层级管理」位
 *   - 主体 = 故事概要卡片列表(每个故事对应一份概要,可读取/编辑/覆盖/删除/应用到回复提示词)
 *   - 故事存档(storyArchive)降级为「素材源」,供「从存档生成概要」入口使用
 *   - 「故事管理」不参与层级管理(L1/L2/L3/L4),每个故事对应一份概要(storyId 可空,可绑定到 archiveId)
 *
 * 数据流:
 *   1. 用户可手动写一份概要(标题 + 内容),无 storyId 绑定
 *   2. 或在「从存档生成概要」里选一个 storyArchive → AI 提取 + 写入(storyId = archive.id)
 *   3. 概要生成后可注入到 replyPrompts(AI 下次回复参考)
 *
 * 注意事项:
 *   - 全部存档数据走 sdk.storyArchives API + listen_db.sdkStoryArchives 表
 *   - 概要数据走 sdk.storySummaries API + aiPerson.socialProfiles.chat.storySummaries[]
 *   - 列表按钮必须用 data-app-action 派发(framework 不支持 on-addEventListener)
 *   - 顶栏的「当前会话消息数」从 sdk.chatMessages.count 读
 */

import { escapeHtml } from '@/src/core/escape.js';
import { resolveAiAvatar } from '../aiMeta.js';

// Demo 联系人(保留 demo fallback,跟其他页面保持一致)
// ★ v0.80:移除占位联系人(小美/小明/小蓝/小红/游戏群) — 真实联系人走 SDK。
const DEMO_CONTACTS = {};

/**
 * 格式化日期为 zh-CN 风格的字符串(YYYY/MM/DD HH:mm)
 */
function formatDate(timestamp) {
    const d = new Date(timestamp);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 概要正文截断(显示前 N 个字符,加省略号)
 */
function truncateSummary(text, maxChars = 140) {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    if (!s) return '';
    if (s.length <= maxChars) return s;
    return s.slice(0, maxChars).trimEnd() + '…';
}

/**
 * 渲染单个「故事概要」主卡片
 *   - 操作:编辑/应用到回复提示词/删除
 *   - 若绑定了 storyArchive,在卡片底部显示来源存档 + 跳转入口
 *
 * @param {Object} summary - storySummary 对象
 * @param {Object|null} archive - 绑定的 storyArchive(可为 null)
 * @param {string} aiPersonId - 给 action 派发用
 * @returns {string} HTML
 */
function renderSummaryCard(summary, archive, aiPersonId) {
    const preview = truncateSummary(summary.content || '', 160);
    const msgCountText = summary.messageCount
        ? `${summary.messageCount} 条消息提炼`
        : '手动撰写';
    const updatedAtText = summary.updatedAt
        ? `更新于 ${formatDate(summary.updatedAt)}`
        : '';
    const createdAtText = summary.generatedAt
        ? formatDate(summary.generatedAt)
        : '';

    // 编辑
    const editAction = JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method: 'openStorySummaryEditModal',
        aiPersonId,
        summaryId: summary.id,
    });
    // 应用到回复提示词
    const applyAction = JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method: 'addStorySummaryAsReplyPrompt',
        aiPersonId,
        summaryId: summary.id,
    });
    // 删除
    const deleteAction = JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method: 'deleteStorySummary',
        aiPersonId,
        summaryId: summary.id,
    });

    // 来源存档(可空)
    let archiveRefHtml = '';
    if (archive) {
        const viewArchiveAction = JSON.stringify({
            action: 'appMethod',
            appId: 'chat',
            method: 'onArchiveView',
            archiveId: archive.id,
        });
        archiveRefHtml = `
            <div class="story-mgmt-source">
                <svg viewBox="0 0 24 24" width="12" height="12">
                    <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z" fill="#999"/>
                </svg>
                <span class="story-mgmt-source-label">来源:</span>
                <span class="story-mgmt-source-name">${escapeHtml(archive.name || '未命名存档')}</span>
                <button type="button" class="story-mgmt-source-link" data-app-action='${escapeHtml(viewArchiveAction)}'>查看来源存档</button>
            </div>
        `;
    } else {
        archiveRefHtml = `
            <div class="story-mgmt-source story-mgmt-source--manual">
                <svg viewBox="0 0 24 24" width="12" height="12">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="#999"/>
                </svg>
                <span class="story-mgmt-source-label">手动撰写</span>
            </div>
        `;
    }

    return `
        <div class="story-mgmt-summary-card" data-summary-id="${escapeHtml(summary.id)}">
            <div class="story-mgmt-summary-head">
                <div class="story-mgmt-summary-icon">
                    <svg viewBox="0 0 24 24"><path d="M12 2.5l2.4 5 5.5.8-4 3.9.9 5.5L12 15.4 7.2 17.7l.9-5.5-4-3.9 5.5-.8L12 2.5z" fill="#D4728A"/></svg>
                </div>
                <div class="story-mgmt-summary-meta">
                    <div class="story-mgmt-summary-title">${escapeHtml(summary.title || '故事概要')}</div>
                    <div class="story-mgmt-summary-sub">
                        <span>${escapeHtml(msgCountText)}</span>
                        ${updatedAtText ? `<span class="story-mgmt-summary-dot">·</span><span>${escapeHtml(updatedAtText)}</span>` : (createdAtText ? `<span class="story-mgmt-summary-dot">·</span><span>${escapeHtml(createdAtText)}</span>` : '')}
                    </div>
                </div>
            </div>
            <div class="story-mgmt-summary-preview">${escapeHtml(preview)}</div>
            ${archiveRefHtml}
            <div class="story-mgmt-summary-actions">
                <button type="button" class="story-mgmt-action-btn story-mgmt-action-edit"
                    data-app-action='${escapeHtml(editAction)}'
                    title="编辑或重新生成概要">
                    <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="#4A6FA5"/></svg>
                    <span>编辑</span>
                </button>
                <button type="button" class="story-mgmt-action-btn story-mgmt-action-apply"
                    data-app-action='${escapeHtml(applyAction)}'
                    title="作为回复提示词注入到 AI system prompt">
                    <svg viewBox="0 0 24 24"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.65-7.03L22 9.24l-7.19-.61L12 2z" fill="white"/></svg>
                    <span>应用到回复提示词</span>
                </button>
                <button type="button" class="story-mgmt-action-btn story-mgmt-action-delete"
                    data-app-action='${escapeHtml(deleteAction)}'
                    title="删除这份故事概要"
                    aria-label="删除概要">
                    <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="#DC2626"/></svg>
                </button>
            </div>
        </div>
    `;
}

/**
 * 渲染单个「故事存档」辅助卡片(降级为素材源)
 *   - 展示存档元数据 + 数量 + 一个「生成概要」按钮
 *   - 若已绑定概要,显示「已有概要」标签 + 跳转故事概要按钮
 */
function renderArchiveCard(archive, boundSummary, aiPersonId) {
    const dateStr = formatDate(archive.createdAt);
    const descHtml = archive.description
        ? `<div class="story-mgmt-archive-desc">${escapeHtml(archive.description)}</div>`
        : '';

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

    // 「从这份存档生成概要」入口
    const generateFromArchiveAction = JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method: 'openStorySummaryEditModal',
        aiPersonId,
        archiveId: archive.id,
        archiveName: archive.name || '',
    });

    // 已绑定概要:显示「已有概要 · X」chip
    const boundChipHtml = boundSummary
        ? `<span class="story-mgmt-archive-bound" title="已绑定概要:${escapeHtml(boundSummary.title || '')}">✓ 已有概要</span>`
        : `<button type="button" class="story-mgmt-archive-gen-btn"
            data-app-action='${escapeHtml(generateFromArchiveAction)}'
            title="AI 从这份存档提取故事概要">+ 生成概要</button>`;

    return `
        <div class="story-mgmt-archive-card" data-archive-id="${escapeHtml(archive.id)}">
            <div class="story-mgmt-archive-head">
                <div class="story-mgmt-archive-info">
                    <div class="story-mgmt-archive-name">${escapeHtml(archive.name)}</div>
                    <div class="story-mgmt-archive-meta">${escapeHtml(dateStr)} · ${archive.messageCount} 条消息</div>
                </div>
                ${boundChipHtml}
            </div>
            ${descHtml}
            <div class="story-mgmt-archive-actions">
                <button class="story-mgmt-archive-action story-mgmt-archive-action-restore" data-app-action='${escapeHtml(restoreAction)}' type="button">
                    <svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" fill="#4A6FA5"/></svg>
                    <span>恢复</span>
                </button>
                <button class="story-mgmt-archive-action story-mgmt-archive-action-view" data-app-action='${escapeHtml(viewAction)}' type="button">
                    <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="#666"/></svg>
                    <span>查看</span>
                </button>
                <button class="story-mgmt-archive-action story-mgmt-archive-action-delete" data-app-action='${escapeHtml(deleteAction)}' type="button" aria-label="删除">
                    <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="#DC2626"/></svg>
                </button>
            </div>
        </div>
    `;
}

/**
 * 给当前时间生成一个建议的封存标题
 */
function defaultArchiveName(now = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    const date = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())}`;
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    return `故事存档 ${date} ${time}`;
}

/**
 * 渲染故事管理详情页
 *
 * @param {Object} app - app 配置(framework 注入)
 * @param {string} contactId - 联系人 id(可对应私聊或群聊)
 * @returns {string} HTML 字符串
 */
export function renderStoryManagementPage(app, contactId) {
    // v0.27 解析 pageId: 支持 story-archive-{aiPersonId} 与 story-management-{aiPersonId} 两种入口
    let aiPersonId = contactId;
    let mode = 'story';
    const lastDash = contactId.lastIndexOf('-');
    if (lastDash > 0) {
        const tail = contactId.slice(lastDash + 1);
        if (tail === 'calendar' || tail === 'story' || tail === 'management' || tail === 'archive') {
            mode = 'story';
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

    const avatarColor = resolveAiAvatar(contact.id).bg;
    const avatarText = (contact.name || '?').charAt(0);

    // 2. 真实数据:存档列表 + 概要列表 + 当前会话条数
    let archives = [];
    let currentMessageCount = 0;
    let summaries = [];
    try {
        const sdk = window.settingsSdk;
        const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive();
        if (sdk?.storyArchives && defaultUser) {
            archives = sdk.storyArchives.list(defaultUser, aiPersonId) || [];
        }
        if (sdk?.chatMessages?.count) {
            currentMessageCount = sdk.chatMessages.count(null, aiPersonId, mode) || 0;
        }
        // ★ v0.68 拉所有 storySummaries(不强制绑定 archiveId,允许手动撰写)
        if (sdk?.storySummaries) {
            summaries = sdk.storySummaries.list(aiPersonId) || [];
        }
    } catch (_) {
        archives = [];
    }
    const archiveCount = archives.length;
    const summaryCount = summaries.length;

    // 3. 顶部 topbar(返回按钮 + 「故事管理」标题)
    const headerBarHtml = `
        <div class="chat-story-mgmt-topbar">
            <button class="chat-back-btn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}'>
                <svg viewBox="0 0 24 24">
                    <polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <div class="chat-story-mgmt-topbar-title">故事管理</div>
        </div>
    `;

    const headerHtml = `
        <div class="story-mgmt-header">
            <div class="story-mgmt-avatar" data-avatar-color="${escapeHtml(avatarColor)}">
                <span class="story-mgmt-avatar-text">${escapeHtml(avatarText)}</span>
            </div>
            <div class="story-mgmt-header-text">
                <div class="story-mgmt-header-name">${escapeHtml(contact.name)} 的故事管理</div>
                <div class="story-mgmt-header-sub">${summaryCount} 份概要 · ${archiveCount} 个存档</div>
            </div>
        </div>
    `;

    // 4. 顶部 action 行:封存当前聊天为存档 + 新增概要(手动)
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
        <button id="save-current-chat" class="story-mgmt-save-btn" type="button" data-app-action='${escapeHtml(saveAction)}'>
            <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" fill="white"/>
            </svg>
            <span>封存当前聊天</span>
        </button>
    `;

    // 「新增概要(手动撰写)」入口 — 不绑定任何存档,直接弹 SummaryEditModal
    const newSummaryAction = JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method: 'openStorySummaryEditModal',
        aiPersonId,
    });
    const newSummaryButtonHtml = `
        <button id="new-story-summary" class="story-mgmt-new-btn" type="button"
            data-app-action='${escapeHtml(newSummaryAction)}'>
            <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="#D4728A"/>
            </svg>
            <span>新增概要</span>
        </button>
    `;

    // 5. 故事概要列表(主角)
    let summaryListHtml;
    if (summaryCount === 0) {
        summaryListHtml = `
            <div class="story-mgmt-summary-empty">
                <div class="story-mgmt-summary-empty-icon">
                    <svg viewBox="0 0 24 24" width="28" height="28">
                        <path d="M12 2.5l2.4 5 5.5.8-4 3.9.9 5.5L12 15.4 7.2 17.7l.9-5.5-4-3.9 5.5-.8L12 2.5z" fill="#D4728A"/>
                    </svg>
                </div>
                <div class="story-mgmt-summary-empty-title">暂无故事概要</div>
                <div class="story-mgmt-summary-empty-sub">点「新增概要」手动撰写,或在下方「故事存档」里选一份生成</div>
            </div>
        `;
    } else {
        summaryListHtml = `
            <div id="summaries-list" class="story-mgmt-summary-list">
                ${summaries.map((summary) => {
                    // ★ v0.68 storyId 可空:有就绑存档,没有就是手动撰写
                    const archive = summary.storyId
                        ? archives.find((a) => a.id === summary.storyId) || null
                        : null;
                    return renderSummaryCard(summary, archive, aiPersonId);
                }).join('')}
            </div>
        `;
    }

    const summarySectionHtml = `
        <div class="story-mgmt-summary-section">
            <div class="story-mgmt-section-title">
                <svg viewBox="0 0 24 24" width="16" height="16">
                    <path d="M12 2.5l2.4 5 5.5.8-4 3.9.9 5.5L12 15.4 7.2 17.7l.9-5.5-4-3.9 5.5-.8L12 2.5z" fill="#D4728A"/>
                </svg>
                <span>故事概要</span>
                <span class="story-mgmt-section-count">${summaryCount}</span>
            </div>
            ${summaryListHtml}
        </div>
    `;

    // 6. 故事存档列表(辅助区)
    let archiveListHtml;
    if (archiveCount === 0) {
        archiveListHtml = `
            <div class="story-mgmt-archive-empty">
                <div class="story-mgmt-archive-empty-text">暂无故事存档</div>
                <div class="story-mgmt-archive-empty-sub">点上方「封存当前聊天」生成第一个存档,作为生成概要的素材源</div>
            </div>
        `;
    } else {
        archiveListHtml = `
            <div id="archives-list" class="story-mgmt-archive-list">
                ${archives.map((archive) => {
                    const boundSummary = summaries.find((s) => s && s.storyId === archive.id) || null;
                    return renderArchiveCard(archive, boundSummary, aiPersonId);
                }).join('')}
            </div>
        `;
    }

    const archiveSectionHtml = `
        <div class="story-mgmt-archive-section">
            <div class="story-mgmt-section-title">
                <svg viewBox="0 0 24 24" width="16" height="16">
                    <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V6h5.17l2 2H20v10z" fill="#4A6FA5"/>
                </svg>
                <span>故事存档(素材源)</span>
                <span class="story-mgmt-section-count">${archiveCount}</span>
            </div>
            ${archiveListHtml}
        </div>
    `;

    return `
        <div class="chat-story-management" data-contact-id="${escapeHtml(contactId)}">
            ${headerBarHtml}
            <div class="chat-story-mgmt-page">
                ${headerHtml}
                <div class="story-mgmt-actions-row">
                    ${saveButtonHtml}
                    ${newSummaryButtonHtml}
                </div>
                ${summarySectionHtml}
                ${archiveSectionHtml}
            </div>
        </div>
    `;
}

export default renderStoryManagementPage;