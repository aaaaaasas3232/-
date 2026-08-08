/**
 * chat-app / 日历视图详情页
 *
 * Phase 11 页面 UI 复原
 *
 * 来源:旧版 chat.js `ChatApp.prototype.openCalendarView(aiId)` + `renderCalendarMonth()`
 *
 * 功能:
 *   - 顶部信息区(头像 + 名字 + 总记录天数)
 *   - 上下文加载方式配置(不加载 / 完整记录 / 概要记录)
 *   - 月历卡片(月份导航 + 星期标题 + 日期网格)
 *   - 今日蓝色高亮,有记录的日期显示粉点,周末日期粉字
 *   - 点击有记录的日期可查看当日消息(交互留待 Phase 接 IndexedDB)
 *
 * 当前阶段:1:1 复原 UI,交互留待 Phase 4+ 接入
 */

import { escapeHtml } from '@/src/core/escape.js';
import { renderTextBubble } from '../components/text-bubble.js';
import { getAiMeta, resolveContactDisplay } from '../aiMeta.js';

// Demo 联系人(与 chat-settings-page.js / chat-page.js 共享,后续 Phase 接入 IndexedDB)
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

// 月份中文名
const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六'];

/**
 * 把 YYYY-MM-DD 转成「2026年8月5日」显示
 */
function toDateDisplay(dateKey) {
    if (!dateKey || typeof dateKey !== 'string') return dateKey || '';
    const [y, m, d] = dateKey.split('-').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return dateKey;
    return `${y}年${m}月${d}日`;
}

/**
 * 把 timestamp 转成 YYYY-MM-DD(本地时区),用于按日期聚合消息
 */
function toDateKey(timestamp) {
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 把 timestamp 转成 HH:MM 字符串(给详情面板的「时分」用)
 */
function toTimeText(timestamp) {
    const d = new Date(timestamp);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * 把一条特殊消息转成 `[类型]摘要` 的纯文本,用于日历视图的聊天记录列表。
 *
 * 用户反馈：日历视图是「按天翻聊天记录」的快速浏览场景,不需要看复杂卡片样式
 * (位置地图图标、图片描述大图、语音波形、红包卡片等),只想要一眼能扫到内容。
 *
 * 处理规则：
 *   - text          → 原文(由 renderTextBubble 直接渲染)
 *   - sticker       → 表情包图片(由 renderTextBubble 直接渲染,保留视觉)
 *   - location      → [地点]名字 地址(去 svg 地图)
 *   - image (desc)  → [图片]描述(去背景色卡)
 *   - voice         → [语音]时长" 文字(去波形/转文字)
 *   - redpacket     → [红包]祝福语 金额(去红包卡)
 *   - transfer      → [转账]备注 金额(去转账卡)
 *   - chat_record   → [聊天记录]标题(去卡片)
 *   - call_record   → [通话]时长 / 未接通(去系统卡)
 *   - 其它未知类型 → 原文兜底
 *
 * @param {Object} msg - 原始消息
 * @returns {Object} { type: 'text'|'sticker'|..., content: string }
 */
function summarizeMessageForList(msg) {
    const lc = msg.locationCard || {};
    const rp = msg.redpacketCard || {};
    const tc = msg.transferCard || {};
    const cr = msg.callRecord || {};
    const ic = msg.imageDescription || msg.desc || '';
    const record = msg.chatRecord || {};

    switch (msg.type) {
        case 'text':
        case 'sticker':
            // 保留原样,renderTextBubble 各自处理
            return { type: msg.type, content: msg.content || '', url: msg.url || '' };
        case 'location': {
            const name = lc.name || '位置';
            const address = lc.address || '';
            return { type: 'text', content: address ? `[地点]${name} ${address}` : `[地点]${name}` };
        }
        case 'image': {
            // image 类型(非 sticker,且有 description 才走简化标签)
            const desc = ic || msg.content || '';
            return { type: 'text', content: desc ? `[图片]${desc}` : '[图片]' };
        }
        case 'descriptive_image': {
            const desc = ic || msg.content || '';
            return { type: 'text', content: desc ? `[图片]${desc}` : '[图片]' };
        }
        case 'voice': {
            const duration = Number(msg.duration || msg.voiceDuration) || 0;
            const voiceContent = msg.voiceContent || msg.content || '';
            return {
                type: 'text',
                content: voiceContent
                    ? `[语音]${duration}″ ${voiceContent}`
                    : `[语音]${duration}″`,
            };
        }
        case 'redpacket': {
            const greet = rp.message || '恭喜发财';
            const amount = rp.amount ? ` ¥${Number(rp.amount).toFixed(2)}` : '';
            return { type: 'text', content: `[红包]${greet}${amount}` };
        }
        case 'transfer': {
            const note = tc.note || '转账';
            const amount = tc.amount ? ` ¥${Number(tc.amount).toFixed(2)}` : '';
            return { type: 'text', content: `[转账]${note}${amount}` };
        }
        case 'chat_record': {
            const title = record.title || '聊天记录';
            const count = record.totalCount || (Array.isArray(record.messages) ? record.messages.length : 0);
            return { type: 'text', content: count > 0 ? `[聊天记录]${title} (${count}条)` : `[聊天记录]${title}` };
        }
        case 'call_record': {
            const callType = cr.callType === 'video' ? '视频通话' : '语音通话';
            if (!cr.wasConnected) return { type: 'text', content: `[${callType}] 未接通` };
            const sec = Number(cr.duration) || 0;
            let durText;
            if (sec < 60) durText = `${sec}秒`;
            else if (sec < 3600) {
                const m = Math.floor(sec / 60);
                const s = sec % 60;
                durText = `${m}分${s > 0 ? s + '秒' : ''}`;
            } else {
                const h = Math.floor(sec / 3600);
                const m = Math.floor((sec % 3600) / 60);
                durText = `${h}小时${m > 0 ? m + '分' : ''}`;
            }
            return { type: 'text', content: `[${callType}] ${durText}` };
        }
        default:
            return { type: 'text', content: msg.content || `[${msg.type || '消息'}]` };
    }
}

/**
 * 把 SDK 真实消息按 YYYY-MM-DD 聚合。
 *
 *  - 只统计 AI / User 直接互发的消息(text / image / sticker / voice 等),
 *    跳过 type === 'system' / 'call_record'(系统消息不算聊天记录)
 *  - 跨月自动归到对应日期,calendar-view 用它算「某月哪天有记录」
 *  - 没有真实数据时返回空字典,UI 走 0 状态(不假造)
 *
 * @param {Array} messages - sdk.chatMessages.list 返回的数组
 * @returns {Object} dateKey -> { count, messages }
 */
function groupMessagesByDate(messages) {
    const map = {};
    if (!Array.isArray(messages)) return map;
    for (const m of messages) {
        if (!m || !m.timestamp) continue;
        // 系统消息 / 通话记录不算聊天记录
        if (m.type === 'system' || m.type === 'call_record') continue;
        const key = toDateKey(m.timestamp);
        if (!map[key]) map[key] = { count: 0, messages: [] };
        map[key].count += 1;
        map[key].messages.push(m);
    }
    return map;
}

/**
 * 渲染日历月份网格
 *
 * @param {number} year - 年
 * @param {number} month - 月(0-11)
 * @param {Object} chatDates - 日期 → { count, messages[] } 的字典
 * @param {string} aiPersonId - 绑定的 AI 人设 id(给 action 派发)
 * @param {string} mode - 'calendar' / 'story'
 * @returns {string} HTML
 */
function renderCalendarMonth(year, month, chatDates, aiPersonId, mode) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

    let daysHtml = '';
    // 填充开头空白格
    for (let i = 0; i < firstDay; i++) {
        daysHtml += '<div class="calendar-day-empty"></div>';
    }
    // 日期格子
    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        const dayData = chatDates[dateKey];
        const hasChat = !!dayData;
        const isToday = dateKey === todayStr;
        const dayOfWeek = (firstDay + day - 1) % 7;
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const classes = ['calendar-day'];
        if (hasChat) classes.push('has-chat');
        if (isToday) classes.push('is-today');
        if (isWeekend) classes.push('is-weekend');

        // 只在「有聊天记录」时挂 data-app-action → framework 顶层 click 委托派发
        const actionAttr = hasChat
            ? ` data-app-action='${escapeHtml(JSON.stringify({
                action: 'appMethod',
                appId: 'chat',
                method: 'viewCalendarDay',
                payload: { aiPersonId, mode, date: dateKey },
            }))}'`
            : '';

        daysHtml += `
            <div class="${classes.join(' ')}" data-date="${escapeHtml(dateKey)}" ${hasChat ? `data-message-count="${dayData.count}"` : ''}${actionAttr}>
                <span class="calendar-day-num">${day}</span>
                ${hasChat ? '<span class="calendar-day-dot"></span>' : ''}
            </div>
        `;
    }

    // 月份导航 action: 切换月份时整体重画整页(via detailRenderTick)
    const prevAction = JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method: 'shiftCalendarMonth',
        payload: { delta: -1 },
    });
    const nextAction = JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method: 'shiftCalendarMonth',
        payload: { delta: 1 },
    });

    return `
        <div class="calendar-card">
            <div class="calendar-month-nav">
                <button class="calendar-nav-btn" id="prev-month-btn" type="button" aria-label="上个月" data-app-action='${escapeHtml(prevAction)}'>
                    <svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
                <div class="calendar-month-title">${year} 年 ${MONTH_NAMES[month]}</div>
                <button class="calendar-nav-btn" id="next-month-btn" type="button" aria-label="下个月" data-app-action='${escapeHtml(nextAction)}'>
                    <svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
            </div>

            <div class="calendar-weekdays">
                ${WEEK_DAYS.map((day, idx) => `
                    <div class="calendar-weekday ${idx === 0 || idx === 6 ? 'is-weekend' : ''}">${day}</div>
                `).join('')}
            </div>

            <div class="calendar-grid">
                ${daysHtml}
            </div>
        </div>
    `;
}

/**
 * 渲染「点击某天后」展开的当天聊天记录面板
 *   - 顶部 header：日期 + 消息计数 + 关闭按钮
 *   - 中部「当日概要」区（生成概要按钮 + 已生成概要列表 + 应用到 prompt 管理）
 *   - 底部「聊天记录」区：消息气泡列表
 *
 * ★ v0.66:已生成概要时显示概要内容 + 「应用到 prompt 管理」按钮
 *
 * @param {string} dateKey - YYYY-MM-DD
 * @param {Array} messages - 当天的消息数组
 * @param {Object} contact - { name, avatar, avatarBg, ... } 用于气泡显示
 * @param {Array} [daySummaries] - 当天已生成的 L1 概要
 * @param {string} [aiPersonId] - 当前 AI 人设 id(给 action 派发用)
 * @param {string} [mode] - 'calendar' | 'story'
 * @returns {string} HTML
 */
function renderCalendarDayPanel(dateKey, messages, contact, daySummaries = [], aiPersonId = '', mode = 'calendar') {
    const list = Array.isArray(messages) ? messages : [];
    const closeAction = JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method: 'closeCalendarDay',
    });

    // 把「2026-08-05」格式化成「2026年8月5日」
    const dateDisplay = toDateDisplay(dateKey);

    if (list.length === 0) {
        return `
            <div class="calendar-date-detail" data-date="${escapeHtml(dateKey)}">
                <div class="cdd-header">
                    <div class="cdd-header-left">
                        <div class="cdd-date">${dateDisplay}</div>
                    </div>
                    <button class="cdd-close-btn" type="button" aria-label="关闭" data-app-action='${escapeHtml(closeAction)}'>
                        <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                    </button>
                </div>
                <div class="cdd-empty">这一天还没有聊天记录</div>
            </div>
        `;
    }

    // 补齐消息显示字段，过滤系统消息
    const displayMessages = list.map((m) => {
        const ts = Number(m.timestamp) || Date.now();
        return {
            ...m,
            id: m.id,
            sender: m.sender || 'user',
            type: m.type || 'text',
            content: m.content || '',
            timestamp: ts,
            time: m.time || toTimeText(ts),
            senderName: m.senderName || (
                m.sender === 'user' ? (contact?.senderName || '我') : (contact?.name || 'AI')
            ),
        };
    }).filter((m) => m.type !== 'system' && m.type !== 'call_record');

    // ★ v0.61.x 日历视图聊天记录区使用简化气泡：
    //   - text / sticker 走 renderTextBubble 保持原貌(文本/表情包图片)
    //   - 其它特殊消息(地点/图片描述/语音/红包/转账/聊天记录/通话记录)
    //     全部转成 [类型]摘要 的纯文本标签,避免在日历列表里堆复杂卡片
    const bubblesHtml = displayMessages.map((m) => {
        const simplified = summarizeMessageForList(m);
        const simplifiedMsg = { ...m, type: simplified.type, content: simplified.content, url: simplified.url };
        return renderTextBubble(simplifiedMsg, contact);
    }).join('');

    // 消息计数文案
    const msgCountText = displayMessages.length === 1
        ? '1 条消息'
        : `${displayMessages.length} 条消息`;

    return `
        <div class="calendar-date-detail" data-date="${escapeHtml(dateKey)}">
            <!-- 顶部：日期 + 计数 + 关闭按钮 -->
            <div class="cdd-header">
                <div class="cdd-header-left">
                    <div class="cdd-date">${dateDisplay}</div>
                    <div class="cdd-count">${msgCountText}</div>
                </div>
                <button class="cdd-close-btn" type="button" aria-label="关闭" data-app-action='${escapeHtml(closeAction)}'>
                    <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </button>
</div>

            <!-- 当日概要区（v0.66:已生成概要时显示概要内容 + 「应用到 prompt 管理」按钮） -->
            <div class="cdd-summary">
                <div class="cdd-summary-head">
                    <svg viewBox="0 0 24 24" class="cdd-section-icon"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" fill="#4A6FA5"/></svg>
                    <span>当日概要</span>
                </div>
                <button class="cdd-summary-btn" type="button"
                    data-app-action='{"action":"appMethod","appId":"chat","method":"openDaySummaryRangeModal","payload":{"dateKey":"${escapeHtml(dateKey)}"}}'>
                    生成概要
                </button>
            </div>
            <div class="cdd-summary-content" id="cdd-summary-content-${escapeHtml(dateKey)}">
                ${(() => {
                    const sums = Array.isArray(daySummaries) ? daySummaries : [];
                    if (sums.length === 0) {
                        return `<div class="cdd-summary-placeholder" id="cdd-summary-placeholder-${escapeHtml(dateKey)}">点击「生成概要」按钮自动整理当天对话要点</div>`;
                    }
                    // 按 generatedAt 倒序:最新在前
                    const ordered = sums.slice().sort((a, b) => (Number(b.generatedAt) || 0) - (Number(a.generatedAt) || 0));
                    return ordered.map((s) => {
                        const content = String(s.content || '').trim();
                        const short = content.length > 160 ? content.slice(0, 160) + '…' : content;
                        const isActive = s.asPrompt && s.asPrompt.active !== false;
                        return `
                        <div class="cdd-summary-card" data-summary-id="${escapeHtml(s.id)}">
                            <div class="cdd-summary-card-title">${escapeHtml(s.title || '概要')}</div>
                            <div class="cdd-summary-card-body">${escapeHtml(short)}</div>
                            <div class="cdd-summary-card-actions">
                                <button type="button" class="cdd-summary-apply-btn ${isActive ? 'is-applied' : ''}"
                                    ${isActive ? 'disabled' : ''}
                                    data-app-action='${escapeHtml(JSON.stringify({
                                        action: 'appMethod',
                                        appId: 'chat',
                                        method: 'applyMemorySummaryToPromptManager',
                                        payload: { aiPersonId, mode, summaryId: s.id },
                                    }))}'>
                                    ${isActive ? '已应用到 Prompt 管理' : '应用到 Prompt 管理'}
                                </button>
                            </div>
                        </div>`;
                    }).join('');
                })()}
            </div>

            <!-- 聊天记录区 -->
            <div class="cdd-messages-section">
                <div class="cdd-section-label">
                    <svg viewBox="0 0 24 24" class="cdd-section-icon"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="#FF6B9D"/></svg>
                    <span>聊天记录</span>
                </div>
                <div class="cdd-messages">
                    ${bubblesHtml}
                </div>
            </div>
        </div>
    `;
}

/**
 * 渲染日历视图详情页
 *
 * @param {Object} app - app 配置(framework 注入)
 * @param {string} contactId - 联系人 id(可对应私聊或群聊)
 * @returns {string} HTML 字符串
 */
export function renderCalendarViewPage(app, contactId) {
    // v0.27 解析 pageId: 'ai0-calendar' / 'ai0-story'
    let aiPersonId = contactId;
    let mode = 'calendar';
    const lastDash = contactId.lastIndexOf('-');
    if (lastDash > 0) {
        const tail = contactId.slice(lastDash + 1);
        if (tail === 'calendar' || tail === 'story') {
            mode = tail;
            aiPersonId = contactId.slice(0, lastDash);
        }
    }

    // 优先从 chatFriends 读真实好友,兜底 DEMO_CONTACTS
    let entry = null;
    try {
        const sdk = window.settingsSdk;
        const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive();
        entry = (sdk && defaultUser) ? sdk.chatFriends?.get?.(defaultUser, aiPersonId, mode) : null;
    } catch (_) {}
    const baseDemo = DEMO_CONTACTS[aiPersonId] || DEMO_CONTACTS[contactId] || { id: aiPersonId, name: aiPersonId };

    // ★ v0.31 跟私聊页同款:实时读 aiPerson.socialProfiles.chat.*,
    //   名字/头像/背景都走 aiPerson,不走 entry 快照
    const aiMeta = getAiMeta(aiPersonId);
    const display = resolveContactDisplay(entry, aiPersonId);

    const contact = entry
        ? {
            ...baseDemo,
            id: aiPersonId,
            name: display.nickname || baseDemo.name,
            avatar: display.avatar || aiMeta.avatar || '',
            avatarBg: display.avatarBg || aiMeta.avatarBg || '',
            boundWorldId: entry.boundWorldId || '',
            recordMode: entry.recordMode || mode,
        }
        : {
            ...baseDemo,
            id: aiPersonId,
            name: aiMeta.exists ? aiMeta.nickname : baseDemo.name,
            avatar: aiMeta.avatar,
            avatarBg: aiMeta.avatarBg,
        };

    const avatarColor = contact.avatarBg || getAvatarColor(contact.id);
    const avatarText = (contact.name || '?').charAt(0);

    const now = new Date();
    // ★ 优先读 window.__chatCalendarViewMonth 记录,实现月份切换持久化
    const persistedMonth = (() => {
        try {
            const v = window.__chatCalendarViewMonth;
            if (v && typeof v.year === 'number' && typeof v.month === 'number') return v;
        } catch (_) {}
        return null;
    })();
    const currentYear = persistedMonth ? persistedMonth.year : now.getFullYear();
    const currentMonth = persistedMonth ? persistedMonth.month : now.getMonth();

    // ★ v0.32 接 SDK 真实消息:从 chatMessages.list 拉所有记录并按日期聚合
    //   v0.61.4 扩展:同时合并 chatArchiveMessages(昨天及更早的归档),确保日历视图
    //     「有记录」的天数不被切走消息后漏算
    let chatDates = {};
    let totalRecordDays = 0;
    try {
        const sdk = window.settingsSdk;
        const todayList = sdk?.chatMessages?.list
            ? (sdk.chatMessages.list(null, aiPersonId, mode) || [])
            : [];
        const archiveList = sdk?.chatArchive?.list
            ? (sdk.chatArchive.list(aiPersonId, mode) || [])
            : [];
        const allMessages = [...todayList, ...archiveList];
        chatDates = groupMessagesByDate(allMessages);
        totalRecordDays = Object.keys(chatDates).length;
    } catch (err) {
        console.warn('[calendar-view] load real messages failed', err);
    }

    // 顶部 header（v0.65 删掉生成概要按钮 → 当天面板里的「生成概要」按钮仍保留）
    const headerBarHtml = `
        <div class="chat-calendar-topbar">
            <button class="chat-back-btn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}'>
                <svg viewBox="0 0 24 24">
                    <polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <div class="chat-calendar-topbar-title">日历视图</div>
            <div class="chat-calendar-topbar-spacer"></div>
        </div>
    `;

    const headerHtml = `
        <div class="calendar-header">
            <div class="calendar-avatar" data-avatar-color="${escapeHtml(avatarColor)}">
                ${contact.avatar
                    ? `<img src="${escapeHtml(contact.avatar)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" />`
                    : `<span class="calendar-avatar-text">${escapeHtml(avatarText)}</span>`}
            </div>
            <div class="calendar-header-text">
                <div class="calendar-header-name">${escapeHtml(contact.name)} 的聊天日历</div>
                <div class="calendar-header-sub">${totalRecordDays > 0 ? `共 ${totalRecordDays} 天有记录` : '还没有聊天记录'}</div>
            </div>
        </div>
    `;

    // 上下文加载方式卡片（v0.65 重写：换成可编辑的 AI Prompt 文本框）
    //   - 文本框内容会被作为「上下文」拼到 AI 的 systemPrompt 里
    //   - 文本中可用 {{aiName}} {{userName}} {{dateRange}} {{messages}} 占位
    //   - 文本持久化到 localStorage,key = xiaoting::calendar-prompt-template-{aiPersonId}-{mode}
    const promptTemplate = (() => {
        try {
            const key = `xiaoting::calendar-prompt-template-${aiPersonId}-${mode}`;
            const saved = localStorage.getItem(key);
            if (saved && typeof saved === 'string') return saved;
        } catch (_) {}
        // 默认模板:告诉 AI 怎么根据上下文压缩聊天
        return `你是一个逻辑清晰严谨的人。请根据以下两个人（{{userName}} 和 {{aiName}}）在 {{dateRange}} 的对话记录进行摘要整理,要求:\n1. 保留关键事件 / 情感转折 / 重要话题\n2. 用客观简练的语言,不添加原对话没有的信息\n3. 按时间顺序分段,每段不超过 3 句话\n4. 输出 Markdown 格式,标题用「## 日期」,正文用项目符号\n\n---\n{{messages}}`;
    })();
    const contextCardHtml = `
        <div class="calendar-context-card">
            <div class="calendar-section-title">
                <svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#4A6FA5"/></svg>
                <span>发给 AI Prompt（用于概要整理）</span>
            </div>
            <textarea class="calendar-prompt-textarea"
                data-ai-person-id="${escapeHtml(aiPersonId)}"
                data-mode="${escapeHtml(mode)}"
                placeholder="写一段发给 AI 的 prompt,用于概要整理。{{aiName}} {{userName}} {{dateRange}} {{messages}} 是占位符"
                rows="6">${escapeHtml(promptTemplate)}</textarea>
        </div>
    `;

    // 日历卡片
    // ★ 初始打开 / 重画时:如果在持久化状态里有「当前选中的日期」,直接展开当天面板
    const persistedSelected = (() => {
        try {
            const v = window.__chatCalendarViewSelectedDate;
            if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
        } catch (_) {}
        return null;
    })();
    // ★ v0.66 当天概要:从 sdk.memorySummaries.list(aiPersonId, 'L1') 里过滤当天
    //   - 用 originalDateRange.start 或 sourceDates 包含 dateKey 判断
    const summariesByDate = (() => {
        const map = {};
        try {
            const sdk = window.settingsSdk;
            if (!sdk?.memorySummaries?.list) return map;
            const list = sdk.memorySummaries.list(aiPersonId, 'L1') || [];
            for (const s of list) {
                if (!s) continue;
                const dates = Array.isArray(s.sourceDates) ? s.sourceDates : [];
                const rangeStart = s.originalDateRange?.start || '';
                const rangeEnd = s.originalDateRange?.end || rangeStart;
                const candidateDates = dates.length > 0 ? dates : (rangeStart ? [rangeStart] : []);
                for (const dk of candidateDates) {
                    if (!dk) continue;
                    // ★ 单天概要 sourceDates=[当天] 或 originalDateRange.start===当天
                    //   多天概要(L1 也允许选多天)整段都标上,展开任意一天都能看到
                    if (!map[dk]) map[dk] = [];
                    map[dk].push(s);
                }
            }
        } catch (_) {}
        return map;
    })();
    const initialDayPanelHtml = persistedSelected
        ? renderCalendarDayPanel(
            persistedSelected,
            chatDates[persistedSelected]?.messages || [],
            contact,
            summariesByDate[persistedSelected] || [],
            aiPersonId,
            mode,
        )
        : '';

    const calendarCardHtml = `
        <div id="calendar-container" data-ai-person-id="${escapeHtml(aiPersonId)}" data-mode="${escapeHtml(mode)}">
            ${renderCalendarMonth(currentYear, currentMonth, chatDates, aiPersonId, mode)}
        </div>
        <div id="date-detail-container" class="calendar-date-detail-mount">
            ${initialDayPanelHtml}
        </div>
    `;

    return `
        <div class="chat-calendar-view" data-contact-id="${escapeHtml(contactId)}" data-ai-person-id="${escapeHtml(aiPersonId)}" data-mode="${escapeHtml(mode)}" data-year="${currentYear}" data-month="${currentMonth}">
            ${headerBarHtml}
            <div class="chat-calendar-view-page">
                ${headerHtml}
                ${contextCardHtml}
                ${calendarCardHtml}
            </div>
        </div>
    `;
}

export default renderCalendarViewPage;

// 供 index.js 在 viewCalendarDay method 里复用,避免重复实现
export { renderCalendarDayPanel, groupMessagesByDate, toDateKey, toDateDisplay, toTimeText };
