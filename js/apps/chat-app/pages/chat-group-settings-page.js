/**
 * chat-app / 群聊设置详情页
 *
 * Phase 11 页面 UI 复原
 *
 * 功能:
 *   - 群头像 + 群名称 + 成员数
 *   - 群信息卡片:群公告 / 群二维码 / 备注
 *   - 消息设置卡片:置顶聊天 / 消息免打扰 / 消息提醒
 *   - 群管理卡片:群成员 / 群管理 / 聊天记录
 *   - 危险操作卡片:清空聊天记录 / 退出群聊
 *
 * 当前阶段:1:1 复原 UI,交互留待 Phase 4+ 接入
 */

import { escapeHtml } from '@/src/core/escape.js';

// Demo 群聊数据(与 chat-group-page.js 共享,后续 Phase 接入 IndexedDB)
const DEMO_GROUPS = {
    'group-1': {
        id: 'group-1',
        name: '游戏群',
        memberCount: 4,
        announcement: '狼人杀爱好者聚集地，周末开团！',
        qrCode: null,
        remark: '',
        isPinned: false,
        isMuted: false,
        isRemindEnabled: true,
        members: [
            { id: 'ai-1', name: '小美', avatarBg: '#FF9ECD', role: 'admin' },
            { id: 'ai-2', name: '小明', avatarBg: '#A8C8EC', role: 'member' },
            { id: 'ai-3', name: '小蓝', avatarBg: '#B8E6CF', role: 'member' },
        ]
    },
    'group-2': {
        id: 'group-2',
        name: '学习小组',
        memberCount: 3,
        announcement: '',
        qrCode: null,
        remark: '睡前读书会',
        isPinned: true,
        isMuted: false,
        isRemindEnabled: true,
        members: [
            { id: 'ai-1', name: '小美', avatarBg: '#FF9ECD', role: 'admin' },
            { id: 'ai-2', name: '小明', avatarBg: '#A8C8EC', role: 'member' },
        ]
    },
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

// 渲染简易 toggle(iOS 风)
function renderToggle(checked) {
    return `
        <label class="chat-toggle">
            <input type="checkbox" class="chat-toggle-input" ${checked ? 'checked' : ''}>
            <span class="chat-toggle-track"></span>
            <span class="chat-toggle-thumb"></span>
        </label>
    `;
}

// 渲染设置项(基础)
function renderSettingItem({ id, label, value, arrow = true, extra = '' }) {
    return `
        <div class="chat-setting-item" ${id ? `id="${escapeHtml(id)}"` : ''}>
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
function renderToggleItem({ id, label, labelContent, desc, checked }) {
    return `
        <div class="chat-setting-item chat-setting-toggle-item" ${id ? `id="${escapeHtml(id)}"` : ''}>
            <div class="chat-setting-label-block">
                ${labelContent
                    ? labelContent
                    : (label ? `<span class="chat-setting-label">${escapeHtml(label)}</span>` : '')}
                ${desc ? `<span class="chat-setting-desc">${escapeHtml(desc)}</span>` : ''}
            </div>
            ${renderToggle(checked)}
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

// 渲染群头像(九宫格拼接)
function renderGroupAvatar(members, size = 80) {
    const gridSize = Math.min(members.length, 4);
    const cellSize = size / 2;

    let cellsHtml = '';
    for (let i = 0; i < 4; i++) {
        if (i < gridSize) {
            const member = members[i];
            const char = member.name?.charAt(0) || '?';
            const bg = member.avatarBg || '#E8E8E8';
            cellsHtml += `<div style="background:${bg};display:flex;align-items:center;justify-content:center;font-size:${size * 0.2}px;color:white;font-weight:500;">${escapeHtml(char)}</div>`;
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

// 渲染成员头像
function renderMemberAvatar(member, size = 40) {
    const bg = member.avatarBg || getAvatarColor(member.id);
    const char = member.name?.charAt(0) || '?';
    return `
        <div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:${size * 0.35}px;color:white;font-weight:500;">
            ${escapeHtml(char)}
        </div>
    `;
}

/**
 * 渲染群聊设置详情页
 *
 * @param {Object} app - app 配置(framework 注入)
 * @param {string} groupId - 群聊 id
 * @returns {string} HTML 字符串
 */
export function renderGroupSettingsPage(app, groupId) {
    const group = DEMO_GROUPS[groupId]
        || { id: groupId, name: '未知群聊', memberCount: 0, announcement: '', remark: '', isPinned: false, isMuted: false, isRemindEnabled: true, members: [] };

    const avatarColor = getAvatarColor(group.id);

    // 群信息卡片标题
    const groupInfoTitle = renderSectionTitle(
        '<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
        '群信息'
    );

    const groupInfoCard = `
        <div class="chat-settings-card">
            ${groupInfoTitle}
            ${renderSettingItem({
                id: 'group-name',
                label: '群聊名称',
                value: group.name,
            })}
            ${renderSettingItem({
                id: 'group-announcement',
                label: '群公告',
                value: group.announcement || '未设置',
            })}
            ${renderSettingItem({
                id: 'group-qr',
                label: '群二维码',
                value: '',
            })}
            ${renderSettingItem({
                id: 'group-remark',
                label: '备注',
                value: group.remark || '未设置',
            })}
            <div class="chat-setting-item chat-setting-last" id="group-search">
                <span class="chat-setting-label">查找聊天记录</span>
                <span class="chat-setting-value">
                    <svg class="chat-setting-arrow" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
                </span>
            </div>
        </div>
    `;

    // 消息设置卡片
    const msgSettingsTitle = renderSectionTitle(
        '<svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
        '消息设置'
    );

    const msgSettingsCard = `
        <div class="chat-settings-card">
            ${msgSettingsTitle}
            ${renderToggleItem({
                label: '置顶聊天',
                checked: !!group.isPinned,
            })}
            ${renderToggleItem({
                label: '消息免打扰',
                desc: '开启后不会收到推送通知',
                checked: !!group.isMuted,
            })}
            ${renderToggleItem({
                label: '消息提醒',
                desc: '显示消息内容预览',
                checked: !!group.isRemindEnabled,
            })}
            <div class="chat-setting-item chat-setting-last" id="group-chat-background">
                <span class="chat-setting-label">聊天背景</span>
                <span class="chat-setting-value">
                    默认
                    <svg class="chat-setting-arrow" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
                </span>
            </div>
        </div>
    `;

    // 游戏入口卡片
    const gameTitle = renderSectionTitle(
        '<svg viewBox="0 0 24 24" fill="#9B7AA0"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM11 13H8v3H6v-3H3v-2h3V8h2v3h3v2zm5-1.5c0 .28-.22.5-.5.5h-2v2H9v-2H8v-1c0-.28.22-.5.5-.5h2V8h1v1.5h1zm4 .5c0 .28-.22.5-.5.5h-1.5v1.5H14v-1.5H13V12h1.5c.28 0 .5.22.5.5v.5z"/></svg>',
        '小游戏'
    );

    const gameCard = `
        <div class="chat-settings-card">
            ${gameTitle}
            <div class="chat-setting-item" id="game-selector"
                 data-app-action='{"action":"detail","appId":"chat","pageId":"game-selector"}'>
                <span class="chat-setting-label">游戏大厅</span>
                <span class="chat-setting-value" style="color:#9B7AA0;font-size:12px;">
                    狼人杀 · 谁是卧底
                    <svg class="chat-setting-arrow" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
                </span>
            </div>
        </div>
    `;

    // 群管理卡片
    const groupManageTitle = renderSectionTitle(
        '<svg viewBox="0 0 24 24"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
        '群管理'
    );

    // 渲染群成员列表(最多显示5个+查看更多)
    const membersPreview = group.members.slice(0, 5);
    const moreCount = group.memberCount - membersPreview.length;

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
                value: '',
            })}
            <div class="chat-setting-item chat-setting-last" id="group-history">
                <span class="chat-setting-label">聊天记录</span>
                <span class="chat-setting-value">
                    <svg class="chat-setting-arrow" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
                </span>
            </div>
        </div>
    `;

    // 危险操作卡片
    const dangerCardBody = `
        <div class="chat-settings-card chat-settings-card-danger">
            <div class="chat-setting-item chat-setting-last chat-setting-danger-item" id="clear-group-history">
                <span class="chat-setting-danger-text">清空聊天记录</span>
            </div>
            <div class="chat-setting-item chat-setting-last chat-setting-danger-item" id="exit-group">
                <span class="chat-setting-danger-text exit-group">退出群聊</span>
            </div>
        </div>
    `;

    // 顶部 header(只保留返回按钮和游戏按钮)
    const headerBarHtml = `
        <div class="chat-settings-topbar">
            <button class="chat-back-btn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}'>
                <svg viewBox="0 0 24 24">
                    <polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <div class="chat-settings-topbar-actions">
                <button class="chat-settings-topbar-btn" id="group-settings-game-btn"
                        data-app-action='{"action":"detail","appId":"chat","pageId":"game-selector"}'>
                    <svg viewBox="0 0 24 24" fill="#9B7AA0">
                        <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM11 13H8v3H6v-3H3v-2h3V8h2v3h3v2zm5-1.5c0 .28-.22.5-.5.5h-2v2H9v-2H8v-1c0-.28.22-.5.5-.5h2V8h1v1.5h1zm4 .5c0 .28-.22.5-.5.5h-1.5v1.5H14v-1.5H13V12h1.5c.28 0 .5.22.5.5v.5z"/>
                    </svg>
                </button>
            </div>
        </div>
    `;

    return `
        <div class="chat-settings chat-group-settings" data-group-id="${escapeHtml(groupId)}">
            ${headerBarHtml}
            <div class="chat-settings-page">
                <div class="group-settings-header">
                    <div class="group-settings-avatar">
                        ${renderGroupAvatar(group.members, 80)}
                    </div>
                    <div class="group-settings-name">${escapeHtml(group.name)}</div>
                    <div class="group-settings-count">${group.memberCount} 位群成员</div>
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

export default renderGroupSettingsPage;
