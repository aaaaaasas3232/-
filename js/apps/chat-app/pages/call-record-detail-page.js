/**
 * chat-app / 通话记录详情页
 *
 * 用途:点击消息流里的 .call-record-card → 派发 detail action → 打开本页面
 *      pageId = call-record-<callRecordId>
 *
 * 路由入口:在 index.js 的 renderDetailPage 增加
 *          if (pageId.startsWith('call-record-')) ...
 *
 * 数据来源:
 *   v0.68 起 — 从 IndexedDB `chatMessages` 表反查(callRecordId = 消息 id)
 *   v0.68 之前 — 走 chat-page.js 的 DEMO_MESSAGES(废弃,无法命中真实通话记录)
 *
 * 主题:语音走浅蓝渐变,视频走浅粉渐变 — CSS 通过 [data-call-type] 切换。
 */

import { escapeHtml } from '@/src/core/escape.js';

/**
 * 格式化通话时长(秒 → "x分y秒" / "x秒" / "x小时y分")
 */
function formatCallDuration(seconds) {
    const s = Number(seconds) || 0;
    if (s < 60) return `${s}秒`;
    if (s < 3600) {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return mins + '分' + (secs > 0 ? `${secs}秒` : '');
    }
    const hours = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    return hours + '小时' + (mins > 0 ? `${mins}分` : '');
}

/**
 * 格式化时间戳为中文短日期时间
 */
function formatCallTimestamp(ts) {
    const d = new Date(Number(ts) || Date.now());
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hh = `${d.getHours()}`.padStart(2, '0');
    const mm = `${d.getMinutes()}`.padStart(2, '0');
    return `${month}月${day}日 ${hh}:${mm}`;
}

/**
 * 渲染消息项(用户 / AI)
 */
function renderCallMsgItem(msg) {
    const sender = msg.sender || msg.role;
    const isUser = sender === 'user';
    const content = escapeHtml(String(msg.content || ''));

    if (isUser) {
        return `
            <div class="call-record-msg user">
                <div class="call-record-msg-bubble user">${content}</div>
            </div>
        `;
    }
    return `
        <div class="call-record-msg ai">
            <div class="call-record-msg-bubble ai">${content}</div>
        </div>
    `;
}

/**
 * 从 IndexedDB 查找一条 call_record 消息,提取 callRecord 对象
 */
function _findCallRecordInDb(callRecordId) {
    try {
        const sdk = window.settingsSdk;
        if (!sdk?.chatMessages?.get) return null;
        // chatMessages.get(id) 直接按主键读
        const m = sdk.chatMessages.get(callRecordId);
        if (m && m.type === 'call_record') {
            return {
                msg: m,
                callRecord: m.callRecord || null,
                aiPersonId: m.aiPersonId || '',
                mode: m.mode || 'calendar',
            };
        }
    } catch (err) {
        console.warn('[call-record-detail] DB lookup failed:', err);
    }
    return null;
}

/**
 * 获取 AI 人设信息(用于显示名称)
 */
function _resolveContactName(aiPersonId) {
    try {
        const sdk = window.settingsSdk;
        const ai = sdk?.aiPersons?.get?.(aiPersonId);
        if (ai?.name) return ai.name;
    } catch (_) {}
    return 'AI';
}

/**
 * 渲染通话记录详情页
 *
 * @param {Object} app          - appConfig
 * @param {string} callRecordId - 消息 id(call_record 类型的 chatMessage.id)
 */
export function renderCallRecordDetailPage(app, callRecordId) {
    const found = _findCallRecordInDb(callRecordId);

    if (!found || !found.callRecord) {
        // 找不到对应记录:走占位
        return `
            <div class="call-record-detail-page">
                <div class="call-record-topbar">
                    <button class="chat-back-btn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}' title="返回">
                        <svg viewBox="0 0 24 24">
                            <polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <div class="call-record-topbar-title">通话记录</div>
                </div>
                <div class="call-record-body">
                    <div style="padding: 60px 20px; text-align: center; color: #999;">
                        <div style="font-size: 16px; margin-bottom: 8px;">通话记录不存在</div>
                        <div style="font-size: 12px;">id: ${escapeHtml(callRecordId || '(空)')}</div>
                    </div>
                </div>
            </div>
        `;
    }

    const { callRecord: cr, aiPersonId } = found;
    const isVideo = cr.callType === 'video';
    const callTypeName = isVideo ? '视频通话' : '语音通话';
    const durationText = cr.wasConnected ? formatCallDuration(cr.duration) : '未接通';
    const timeText = formatCallTimestamp(cr.timestamp);
    const msgCount = (cr.messages && cr.messages.length) || 0;

    const contactName = _resolveContactName(aiPersonId);
    const initial = contactName.charAt(0) || '?';

    // 摘要区(可能有 / 可能没有)
    const summaryHtml = cr.summary ? `
        <div class="call-record-summary-card">
            <div class="call-record-summary-label">通话摘要</div>
            <div class="call-record-summary-text">${escapeHtml(cr.summary)}</div>
        </div>
    ` : '';

    // 消息记录列表
    const messageItemsHtml = (cr.messages && cr.messages.length > 0)
        ? cr.messages.map((m) => renderCallMsgItem(m)).join('')
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
             data-call-type="${escapeHtml(cr.callType || 'voice')}"
             data-connected="${cr.wasConnected ? 'true' : 'false'}">
            <div class="call-record-topbar">
                <button class="chat-back-btn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}' title="返回">
                    <svg viewBox="0 0 24 24">
                        <polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <div class="call-record-topbar-title">${escapeHtml(callTypeName + '记录')}</div>
            </div>
            <div class="call-record-body">
                <div class="call-record-hero">
                    <div class="call-record-hero-avatar">${escapeHtml(initial)}</div>
                    <div class="call-record-hero-name">${escapeHtml(contactName)}</div>
                    <div class="call-record-hero-meta">${escapeHtml(callTypeName)} · ${escapeHtml(durationText)}</div>
                    <div class="call-record-hero-time">${escapeHtml(timeText)}</div>
                </div>

                ${summaryHtml}

                ${messageSectionHtml}
            </div>
        </div>
    `;
}

export default renderCallRecordDetailPage;
