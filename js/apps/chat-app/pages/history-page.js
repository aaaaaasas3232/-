/**
 * chat-app / 历史消息详情页 (v0.61.3 新建)
 *
 *   入口:聊天设置 → 聊天记录管理 → 「历史消息」卡片
 *     - pageId: 'chat-history-{aiPersonId}-{mode}'
 *
 *   功能(v0.61 占位版):
 *     - 顶部 header(返回 + 标题 + 「生成概要」按钮)
 *     - 「按日归档」区:从 sdk.chatArchiveMessages 读归档消息,按日期分组,
 *       展示最近 7 天(每天显示日期 + 条数)
 *     - 每条日期卡显示该日消息条数 + 点击展开(占位)
 *     - 「生成概要」按钮 → 弹 SummaryRangeModal 让用户选日期范围 →
 *       弹 SummaryEditModal 确认 → 写入 sdk.calendarSummaries.add
 *     - 数据为空时显示空状态
 *
 *   设计要点:
 *     - 全部走 data-app-action 派发,不在 v-html 里 appendChild / addEventListener
 *     - 用户输入(标题 / 内容)走 SummaryEditModal,框架标准 modal 协议
 *     - 占位 AI 生成走 sdk.calendarSummaries.buildPlaceholderFromMessages
 */

import { escapeHtml } from '@/src/core/escape.js';
import { chatModalManager } from '../components/chat-modal-registry.js';

// Demo 联系人兜底
const DEMO_CONTACTS = {
    'ai-1': { id: 'ai-1', name: '小美' },
    'ai-2': { id: 'ai-2', name: '小明' },
    'ai-3': { id: 'ai-3', name: '小蓝' },
    'ai-4': { id: 'ai-4', name: '小红' },
    'group-1': { id: 'group-1', name: '游戏群' },
};

// 头像背景色工具(与 chat-settings-page 同款)
function getAvatarColor(id) {
    const palette = ['#A8C8EC', '#F4A6CD', '#B8D4F0', '#FFD4E5', '#C8E6F4', '#FFC8DD', '#B8E6CF', '#D4B8F0'];
    let hash = 0;
    for (let i = 0; i < (id || '').length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
    }
    return palette[Math.abs(hash) % palette.length];
}

/**
 * 把 timestamp 转成 YYYY-MM-DD(本地时区)
 */
function toDateKey(timestamp) {
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 把 YYYY-MM-DD 转成显示用「2026年8月5日」
 */
function toDateDisplay(dateKey) {
    if (!dateKey || typeof dateKey !== 'string') return dateKey || '';
    const [y, m, d] = dateKey.split('-').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return dateKey;
    return `${y}年${m}月${d}日`;
}

/**
 * 渲染顶部 header
 */
function renderHeaderBar(aiPersonId, mode, contactName) {
    return `
        <div class="chat-history-topbar">
            <button class="chat-back-btn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}'>
                <svg viewBox="0 0 24 24">
                    <polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <div class="chat-history-topbar-title">历史消息</div>
            <button type="button" class="chat-history-generate-btn"
                data-app-action='${escapeHtml(JSON.stringify({
                    action: 'appMethod',
                    appId: 'chat',
                    method: 'openCalendarSummaryRangeModal',
                    payload: { aiPersonId, mode },
                }))}'>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                </svg>
                <span>生成概要</span>
            </button>
        </div>
    `;
}

/**
 * 渲染单日卡片(日期 + 消息条数)
 */
function renderDayCard(dateKey, count) {
    return `
        <div class="chat-history-day-card">
            <div class="chat-history-day-card-left">
                <div class="chat-history-day-card-date">${escapeHtml(toDateDisplay(dateKey))}</div>
                <div class="chat-history-day-card-count">${count} 条消息</div>
            </div>
            <div class="chat-history-day-card-arrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                </svg>
            </div>
        </div>
    `;
}

/**
 * 渲染历史消息页
 *
 * @param {Object} app - chat-app 实例
 * @param {string} contactId - 联系人 id(可包含 -mode 后缀)
 * @returns {string} HTML
 */
export function renderHistoryPage(app, contactId) {
    // 解析 pageId: 'ai0' / 'ai0-calendar' / 'private-ai0-calendar' / etc
    let aiPersonId = contactId;
    let mode = 'calendar';
    const stripped = contactId.startsWith('private-')
        ? contactId.slice('private-'.length)
        : contactId;
    const lastDash = stripped.lastIndexOf('-');
    if (lastDash > 0) {
        const tail = stripped.slice(lastDash + 1);
        if (tail === 'calendar' || tail === 'story') {
            mode = tail;
            aiPersonId = stripped.slice(0, lastDash);
        }
    }

    // 联系人 / AI 名称(SDK 优先)
    let contactName = aiPersonId;
    try {
        const sdk = window.settingsSdk;
        const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
        const entry = (sdk && defaultUser)
            ? sdk.chatFriends?.get?.(defaultUser, aiPersonId, mode)
            : null;
        if (entry?.displayName) contactName = entry.displayName;
        else {
            const aiPerson = sdk?.aiPersons?.get?.(aiPersonId);
            const chatProfile = aiPerson?.socialProfiles?.chat || {};
            contactName = chatProfile.nickname || aiPerson?.name || aiPersonId;
        }
    } catch (_) {
        const demo = DEMO_CONTACTS[aiPersonId];
        if (demo) contactName = demo.name;
    }

    const avatarColor = getAvatarColor(aiPersonId);
    const avatarText = String(contactName || '?').charAt(0);

    // 读归档消息(sdk.chatArchive.list)
    let archivedDays = [];
    try {
        const sdk = window.settingsSdk;
        if (sdk?.chatArchive?.list) {
            const allArchived = sdk.chatArchive.list(aiPersonId, mode, {
                conversationType: 'private',
            }) || [];
            // 按 YYYY-MM-DD 分组
            const map = new Map();
            for (const m of allArchived) {
                const dk = m.archivedDay || toDateKey(m.timestamp);
                if (!dk) continue;
                map.set(dk, (map.get(dk) || 0) + 1);
            }
            archivedDays = Array.from(map.entries())
                .map(([dateKey, count]) => ({ dateKey, count }))
                .sort((a, b) => b.dateKey.localeCompare(a.dateKey))  // 倒序:最新在前
                .slice(0, 7);  // 只显示最近 7 天
        }
    } catch (_) {
        archivedDays = [];
    }

    // 渲染列表
    const dayListHtml = archivedDays.length === 0
        ? `
            <div class="chat-history-empty">
                <div class="chat-history-empty-icon">
                    <svg viewBox="0 0 24 24" width="28" height="28">
                        <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z" fill="#A8C8EC"/>
                    </svg>
                </div>
                <div class="chat-history-empty-title">暂无历史消息</div>
                <div class="chat-history-empty-sub">聊天归档后会按日显示在这里</div>
            </div>
        `
        : `<div class="chat-history-day-list">${archivedDays.map((d) => renderDayCard(d.dateKey, d.count)).join('')}</div>`;

    return `
        <div class="chat-history" data-contact-id="${escapeHtml(contactId)}" data-ai-person-id="${escapeHtml(aiPersonId)}">
            ${renderHeaderBar(aiPersonId, mode, contactName)}
            <div class="chat-history-page">
                <div class="chat-history-header">
                    <div class="chat-history-avatar" data-avatar-color="${escapeHtml(avatarColor)}">
                        <span class="chat-history-avatar-text">${escapeHtml(avatarText)}</span>
                    </div>
                    <div class="chat-history-header-text">
                        <div class="chat-history-header-name">${escapeHtml(contactName)} 的历史消息</div>
                        <div class="chat-history-header-sub">最近 7 天归档 · 共 ${archivedDays.reduce((s, d) => s + d.count, 0)} 条</div>
                    </div>
                </div>
                ${dayListHtml}
            </div>
        </div>
    `;
}

export default renderHistoryPage;