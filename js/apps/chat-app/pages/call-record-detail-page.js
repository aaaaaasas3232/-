/**
 * chat-app / 通话记录详情页
 *
 * 用途:点击消息流里的 .call-record-card → 派发 detail action → 打开本页面
 *      pageId = call-record-<callRecordId>
 *
 * 路由入口:在 index.js 的 renderDetailPage 增加
 *          if (pageId.startsWith('call-record-')) ...
 *
 * UI 来源:参考/chat.js openCallRecordDetail() (1:1 复原)
 *
 * 数据来源:目前 demo — 从 chat-page.js 的 DEMO_MESSAGES 中按 callRecordId 反查,
 *         后续接 IndexedDB 后改成查 callsIndex store。
 *
 * 主题:语音走浅蓝渐变,视频走浅粉渐变 — CSS 通过 [data-call-type] 切换。
 */

import { escapeHtml } from '@/src/core/escape.js';
import { findDemoCallRecordById } from './chat-page.js';

/**
 * 格式化通话时长(秒 → "x分y秒" / "x秒" / "x小时y分")
 * 与 chat-page.js 内同名函数同款实现,这里独立维护一份避免循环依赖。
 */
function formatCallDuration(seconds) {
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins + '分' + (secs > 0 ? `${secs}秒` : '');
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hours + '小时' + (mins > 0 ? `${mins}分` : '');
}

/**
 * 格式化时间戳为中文短日期时间
 */
function formatCallTimestamp(ts) {
    const d = new Date(ts);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hh = `${d.getHours()}`.padStart(2, '0');
    const mm = `${d.getMinutes()}`.padStart(2, '0');
    return `${month}月${day}日 ${hh}:${mm}`;
}

/**
 * 渲染消息项(用户 / AI)
 * 注意:用户用绿色气泡(跟旧版 chat.js 一致),AI 用主题浅色气泡。
 */
function renderCallMsgItem(msg, contact) {
    const isUser = msg.role === 'user';
    const initial = isUser ? '我' : (contact?.name?.charAt(0) || '?');

    if (isUser) {
        return `
            <div class="call-record-msg user">
                <div class="call-record-msg-bubble user">${escapeHtml(msg.content)}</div>
            </div>
        `;
    }
    return `
        <div class="call-record-msg ai">
            <div class="call-record-msg-avatar">${escapeHtml(initial)}</div>
            <div class="call-record-msg-bubble ai">${escapeHtml(msg.content)}</div>
        </div>
    `;
}

/**
 * 渲染通话记录详情页
 *
 * @param {Object} app          - appConfig
 * @param {string} callRecordId - callRecord.id
 */
export function renderCallRecordDetailPage(app, callRecordId) {
    const cr = findDemoCallRecordById(callRecordId);

    // 找不到对应记录:走占位(后续接 IndexedDB 后基本不会到这里)
    if (!cr) {
        return `
            <div class="call-record-detail-page">
                <div class="call-record-body">
                    <div style="padding: 60px 20px; text-align: center; color: #999;">
                        <div style="font-size: 16px; margin-bottom: 8px;">通话记录不存在</div>
                        <div style="font-size: 12px;">id: ${escapeHtml(callRecordId)}</div>
                    </div>
                </div>
            </div>
        `;
    }

    const isVideo = cr.callType === 'video';
    const callTypeName = isVideo ? '视频通话' : '语音通话';
    const durationText = cr.wasConnected ? formatCallDuration(cr.duration) : '未接通';
    const timeText = formatCallTimestamp(cr.timestamp);
    const msgCount = (cr.messages && cr.messages.length) || 0;

    // AI 联系人信息(DEMO 直接从 chat-page.js 的 DEMO_CONTACTS 推,
    // 后续接 IndexedDB 后改成查联系人 store)
    const contact = { name: '小美' }; // TODO:从联系人 store 取真实名字/头像

    // 摘要区(可能有 / 可能没有)
    const summaryHtml = cr.summary ? `
        <div class="call-record-summary-card">
            <div class="call-record-summary-label">通话摘要</div>
            <div class="call-record-summary-text">${escapeHtml(cr.summary)}</div>
        </div>
    ` : '';

    // 消息记录列表
    const messageItemsHtml = (cr.messages && cr.messages.length > 0)
        ? cr.messages.map((m) => renderCallMsgItem(m, contact)).join('')
        : `<div class="call-record-empty">无消息记录</div>`;

    const messageSectionHtml = `
        <div class="call-record-message-section">
            <div class="call-record-message-label">
                消息记录 (${msgCount}条)
            </div>
            <div class="call-record-message-list">
                ${messageItemsHtml}
            </div>
        </div>
    `;

    return `
        <div class="call-record-detail-page"
             data-call-type="${escapeHtml(cr.callType)}"
             data-connected="${cr.wasConnected ? 'true' : 'false'}">
            <!-- 顶部 topbar(返回 + 标题)— 跟 chat-settings 同款策略 -->
            <div class="call-record-topbar">
                <button class="chat-back-btn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}' title="返回">
                    <svg viewBox="0 0 24 24">
                        <polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <div class="call-record-topbar-title">${escapeHtml(callTypeName + '记录')}</div>
            </div>
            <div class="call-record-body">
                <!-- 头部信息:头像 + AI 名字 + 通话类型 · 时长 + 时间 -->
                <div class="call-record-hero">
                    <div class="call-record-hero-avatar">${escapeHtml(contact.name.charAt(0))}</div>
                    <div class="call-record-hero-name">${escapeHtml(contact.name)}</div>
                    <div class="call-record-hero-meta">${escapeHtml(callTypeName)} · ${escapeHtml(durationText)}</div>
                    <div class="call-record-hero-time">${escapeHtml(timeText)}</div>
                </div>

                <!-- 摘要区(可选) -->
                ${summaryHtml}

                <!-- 消息记录 -->
                ${messageSectionHtml}
            </div>
        </div>
    `;
}

export default renderCallRecordDetailPage;
