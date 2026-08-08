/**
 * chat-app / 聊天设置详情页
 *
 * Phase 11 页面 UI 复原
 *
 * 来源:旧版 chat.js `ChatApp.prototype.openAIChatProfile(aiId)`
 *
 * 功能:
 *   - 头像 + 名字 + 状态
 *   - 三个圆形入口按钮(语音 / 视频 / 朋友圈)
 *   - 设置卡片组:备注 / 置顶 / 免打扰 / 聊天背景 / 拍一拍后缀
 *   - AI 设置卡片:上下文长度 / 上下文稀释 / 朋友圈读取 / 回复提示词 / 回复增强 / 关键词触发 / 表情库
 *   - 聊天记录管理:日历视图 / 故事记录
 *   - 互动统计(仅主角色):总消息 / AI 回复 / 聊天天数 / 日均消息 / 拉黑统计
 *   - 危险操作:清空聊天记录 / 拉黑联系人
 *
 * 当前阶段:1:1 复原 UI,交互留待 Phase 4+ 接入
 */

import { escapeHtml } from '@/src/core/escape.js';
import { getAiMeta, resolveContactDisplay } from '../aiMeta.js';

// Demo 联系人数据(与 chat-page.js 共享,后续 Phase 接入 IndexedDB)
const DEMO_CONTACTS = {
    'ai-1': {
        id: 'ai-1',
        name: '小美',
        type: 'main',
        status: '在线',
        avatar: null,
        remark: '',
        isPinned: false,
        isMuted: false,
        chatBackground: null,
        pokeSuffix: '',
        contextLength: 20,
        contextDiluteEnabled: true,
        momentsReadConfig: { self: 3, user: 3, social: 3 },
        replyPromptIds: [],
        replyEnhanceEnabled: false,
        keywordPrompts: [],
        stickerLibraryIds: [],
        isBlocked: false,
    },
    'ai-2': {
        id: 'ai-2',
        name: '小明',
        type: 'main',
        status: '在线',
        avatar: null,
        remark: '游戏搭子',
        isPinned: true,
        isMuted: false,
        chatBackground: null,
        pokeSuffix: '在干嘛',
        contextLength: -1,
        contextDiluteEnabled: true,
        momentsReadConfig: { self: 5, user: 5, social: 5 },
        replyPromptIds: ['p1'],
        replyEnhanceEnabled: true,
        keywordPrompts: [],
        stickerLibraryIds: [],
        isBlocked: false,
    },
    'ai-3': {
        id: 'ai-3',
        name: '小蓝',
        type: 'main',
        status: '离线',
        avatar: null,
        remark: '',
        isPinned: false,
        isMuted: true,
        chatBackground: null,
        pokeSuffix: '',
        contextLength: 20,
        contextDiluteEnabled: true,
        momentsReadConfig: { self: 3, user: 3, social: 3 },
        replyPromptIds: [],
        replyEnhanceEnabled: false,
        keywordPrompts: [],
        stickerLibraryIds: [],
        isBlocked: false,
    },
    'group-1': {
        id: 'group-1',
        name: '游戏群',
        type: 'group',
        status: '在线',
        avatar: null,
        remark: '',
        isPinned: false,
        isMuted: false,
        chatBackground: null,
        pokeSuffix: '',
        contextLength: 30,
        contextDiluteEnabled: true,
        momentsReadConfig: { self: 0, user: 3, social: 3 },
        replyPromptIds: [],
        replyEnhanceEnabled: false,
        keywordPrompts: [],
        stickerLibraryIds: [],
        isBlocked: false,
    },
};

// 头像背景色工具
function getAvatarColor(id) {
    const palette = ['#A8C8EC', '#F4A6CD', '#B8D4F0', '#FFD4E5', '#C8E6F4', '#FFC8DD'];
    let hash = 0;
    for (let i = 0; i < (id || '').length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
    }
    return palette[Math.abs(hash) % palette.length];
}

/**
 * 把带前缀的 chatBackground 值转成 CSS background 值。
 * 输入: 'color:#E8F2FF' / 'gradient:linear-gradient(...)' / 'image:url/dataURL' / '' / 'plain:xxx'(旧)
 * 输出: 可直接塞进 CSS background / background-image 的字符串
 */
function chatBackgroundToCss(value) {
    if (!value) return '';
    if (value.startsWith('color:')) return value.slice('color:'.length);
    if (value.startsWith('gradient:')) return value.slice('gradient:'.length);
    if (value.startsWith('image:')) return `url("${value.slice('image:'.length).replace(/"/g, '\\"')}")`;
    // 兼容旧版无前缀 = 当 image 处理
    return `url("${value.replace(/"/g, '\\"')}")`;
}

/**
 * 渲染聊天背景缩略图(用于聊天设置页「聊天背景」一行的右侧预览)
 * 输出一个 28x18 的小方块,展示当前背景的实际效果
 */
function renderChatBackgroundPreview(value) {
    const css = chatBackgroundToCss(value);
    if (!css) return '';
    const style = css.startsWith('url(')
        ? `background-image: ${css}; background-size: cover; background-position: center;`
        : `background: ${css};`;
    return `<span class="chat-bg-preview" data-chat-bg-preview="1" style="${style.replace(/"/g, '&quot;')}"></span>`;
}

// 渲染简易 toggle(iOS 风)
// ★ v0.28.1: data-app-action 放 input 上 — 不放 label 上!
//   原因: <input type="checkbox"> 被 <label> 包着时,浏览器会在用户点击时
//   合成 1 次额外 label click 事件(冒泡到 document)。如果 label 上有
//   data-app-action,framework 会派发 2 次(1 次 input click + 1 次合成
//   label click)→ togglePin 被调 2 次 → 偶数次翻转 = 状态回到原值 +
//   提示永远显示"取消置顶"。
//   把 action 放 input 上:点 input 时 event.target=input,framework closest
//   找到 input(最近);合成 label click 时 event.target=label,label 上
//   没有 action → framework 不处理 → 只派发 1 次 ✓
//   payload 只携带 settingId(语义 id),不去塞初始 checked —— 真实新值从
//   DOM input.checked 实时读(framework 派发的是渲染时 snapshot,已过时)。
function renderToggle(checked, labelId = '') {
    const actionPayload = labelId
        ? JSON.stringify({
            action: 'appMethod',
            appId: 'chat',
            method: 'onChatSettingToggle',
            payload: { settingId: labelId },
        })
        : '';
    return `
        <label class="chat-toggle">
            <input type="checkbox"
                   class="chat-toggle-input"
                   ${checked ? 'checked' : ''}
                   ${actionPayload ? `data-app-action='${escapeHtml(actionPayload)}'` : ''}>
            <span class="chat-toggle-track"></span>
            <span class="chat-toggle-thumb"></span>
        </label>
    `;
}

// 渲染设置项(基础)
function renderSettingItem({ id, label, value, arrow = true, onClick = '', extra = '' }) {
    return `
        <div class="chat-setting-item" ${id ? `id="${escapeHtml(id)}"` : ''} ${onClick ? `data-onclick="${escapeHtml(onClick)}"` : ''}>
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
// id 用于语义化标识该 toggle(例如 'set-pinned'),framework click 委托拿到
// data-app-action 的 payload 后派发到 chat-app 处理。
function renderToggleItem({ id, label, labelContent, desc, checked, onChange = '' }) {
    return `
        <div class="chat-setting-item chat-setting-toggle-item" ${id ? `id="${escapeHtml(id)}"` : ''} data-setting-id="${escapeHtml(id || '')}">
            <div class="chat-setting-label-block">
                ${labelContent
                    ? labelContent
                    : (label ? `<span class="chat-setting-label">${escapeHtml(label)}</span>` : '')}
                ${desc ? `<span class="chat-setting-desc">${escapeHtml(desc)}</span>` : ''}
            </div>
            ${renderToggle(checked, id)}
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

// 渲染统计小卡
function renderStatCard(value, label, gradient) {
    return `
        <div class="chat-stat-card" data-color-gradient="${escapeHtml(gradient)}">
            <div class="chat-stat-value">${escapeHtml(String(value))}</div>
            <div class="chat-stat-label">${escapeHtml(label)}</div>
        </div>
    `;
}

/**
 * 渲染聊天设置详情页
 *
 * @param {Object} app - app 配置(framework 注入)
 * @param {string} contactId - 联系人 id
 * @returns {string} HTML 字符串
 */
export function renderChatSettingsPage(app, contactId) {
    // v0.27 解析 pageId: 'ai0-calendar' / 'ai0-story'
    // v0.28 解析: 'private-ai0-calendar' / 'private-ai0-story'
    let aiPersonId = contactId;
    let mode = 'calendar';
    // 去掉 private- 前缀
    const withoutPrivate = contactId.startsWith('private-')
        ? contactId.slice('private-'.length)
        : contactId;
    const lastDash = withoutPrivate.lastIndexOf('-');
    if (lastDash > 0) {
        const tail = withoutPrivate.slice(lastDash + 1);
        if (tail === 'calendar' || tail === 'story') {
            mode = tail;
            aiPersonId = withoutPrivate.slice(0, lastDash);
        }
    }

    // 优先从 user 字段读真实好友 entry
    let entry = null;
    try {
        const sdk = window.settingsSdk;
        const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive();
        entry = (sdk && defaultUser) ? sdk.chatFriends?.get?.(defaultUser, aiPersonId, mode) : null;
    } catch (_) {}

    // ★ v0.31:实时读 aiPerson.socialProfiles.chat.*(网名/头像/背景/拍一拍),
    //   故事模式和日历模式都用同一个 aiPerson 数据。
    //   备注(remark)优先于社媒名(per-mode 字段)。
    const display = resolveContactDisplay(entry, aiPersonId);
    const fallbackName = entry?.displayName || aiPersonId;
    const baseDemo = DEMO_CONTACTS[aiPersonId] || DEMO_CONTACTS['ai-1'] || DEMO_CONTACTS[contactId]
        || { id: aiPersonId, name: fallbackName, type: 'main', status: '在线', avatar: null };

    // 联系人名字优先显示备注（每个 mode 独立备注）
    const contactName = display.nickname;
    // ★ v0.31 兜底 baseDemo 也补 avatarBg / pokeSuffix 默认值,
    //   防止 demo 路径走不到实时 aiPerson 时这两个字段 undefined
    const baseDemoWithDefaults = {
        avatarBg: '#A8C8EC',
        pokeSuffix: '',
        ...baseDemo,
    };
    const contact = entry
        ? {
            ...baseDemoWithDefaults,
            id: aiPersonId,
            name: contactName,
            // ★ v0.31 实时 avatar / avatarBg(原本是 entry 快照,改为 aiPerson 实时)
            avatar: display.avatar || baseDemo.avatar,
            avatarBg: display.avatarBg || baseDemoWithDefaults.avatarBg,
            boundWorldId: entry.boundWorldId || '',
            recordMode: entry.recordMode || mode,
            isPinned: !!entry.isPinned,
            remark: entry.remark || baseDemo.remark || '',
            chatBackground: entry.chatBackground || '', // 聊天背景 per-mode 保留 entry 快照
            // ★ v0.31 拍一拍后缀走实时 aiPerson.socialProfiles.chat.patSetting
            pokeSuffix: display.patSetting || '',
        }
        : baseDemoWithDefaults;

    const avatarColor = getAvatarColor(contact.id);
    const avatarText = (contact.name || '?').charAt(0);

    const isMain = contact.type === 'main';
    const isGroup = contact.type === 'group';

    // ★ v0.50 回复提示词显示:从 sdk.replyPrompts.listActive(aiPersonId) 拿真实计数
    //   SDK 未就绪时 fallback 到旧 replyPromptIds 字段,保证向下兼容
    let activeReplyPromptCount = 0;
    try {
        const sdk = typeof window !== 'undefined' ? window.settingsSdk : null;
        if (sdk?.replyPrompts?.listActive && aiPersonId) {
            activeReplyPromptCount = sdk.replyPrompts.listActive(aiPersonId).length;
        } else if (contact.replyPromptIds?.length) {
            activeReplyPromptCount = contact.replyPromptIds.length;
        }
    } catch (_) {
        activeReplyPromptCount = contact.replyPromptIds?.length || 0;
    }
    const replyPromptDisplay = activeReplyPromptCount > 0
        ? `${activeReplyPromptCount} 个已启用`
        : '未设置';

    // 朋友圈可读取条数显示
    const mr = contact.momentsReadConfig || { self: 3, user: 3, social: 3 };
    const momentsReadDisplay = `自己${mr.self}/用户${mr.user}/交际圈${mr.social}`;

    // 上下文长度显示(★ v0.61.8.12 改:从真实存储 sdk.rollingSummaries.getRollingConfig(aiPersonId).contextRounds 读)
    //   - 历史 bug:之前读 contact.contextLength(实际是 DEMO_CONTACTS.ai-1 的 20 / 兜底 20),
    //     openContextLengthModal 写到的是 aiPerson.socialProfiles.chat.rollingConfig.contextRounds,
    //     两边不互通 → 改了不更新,UI 永远显示「20 回合」。
    //   - 修复:优先读 cfg.contextRounds;回落到 legacy contact.contextLength(=-1 表示「全部」)。
    //   - unit「回合」保持 v0.61.3 约定(1 回合 = 1 组用户 + 1 组 AI)。
    let ctxDisplay = '20 回合';
    let legacyAllFlag = false;
    try {
        const sdk = window.settingsSdk;
        const cfg = sdk?.rollingSummaries?.getRollingConfig?.(aiPersonId);
        const cfgRounds = Number(cfg?.contextRounds);
        if (cfg && Number.isFinite(cfgRounds) && cfgRounds > 0) {
            ctxDisplay = `${cfgRounds} 回合`;
        } else if (contact.contextLength === -1) {
            // legacy:只有老字段 contextLength === -1 才视为「全部」
            legacyAllFlag = true;
            ctxDisplay = '全部';
        }
    } catch (_) {
        if (contact.contextLength === -1) {
            legacyAllFlag = true;
            ctxDisplay = '全部';
        }
    }
    if (legacyAllFlag) {
        // 同步回落到 cfg,保证后续保存能命中正确字段
        try {
            const sdk = window.settingsSdk;
            if (sdk?.rollingSummaries?.setRollingConfig && aiPersonId) {
                // fire-and-forget:不阻塞渲染
                sdk.rollingSummaries.setRollingConfig(aiPersonId, { contextRounds: 20 })
                    .catch((e) => console.warn('[chat-settings] legacy -> rollingConfig 兜底写入失败', e));
            }
        } catch (_) { /* 静默 */ }
    }

    // ★ v0.61.3 「滚动摘要」状态:从 sdk.rollingSummaries.getRollingConfig 读
    //   - enabled → toggle「滚动摘要启用」
    //   - rollingConfig 不存在时回落到默认值(enabled=false)
    let rollingEnabled = false;
    let rollingConfigDesc = '';
    try {
        const sdk = window.settingsSdk;
        const cfg = sdk?.rollingSummaries?.getRollingConfig?.(aiPersonId);
        if (cfg) {
            rollingEnabled = !!cfg.enabled;
            const styleText = cfg.style === 'detailed' ? '详细' : '简洁';
            rollingConfigDesc = `风格:${styleText} · 压缩阈值 ${Number(cfg.contextRounds) || 20} 回合`;
        }
    } catch (_) { /* 静默兜底 */ }

    // 表情库显示
    const stickerDisplay = (contact.stickerLibraryIds?.length || 0) > 0
        ? `${contact.stickerLibraryIds.length} 个库`
        : '未设置';

    // 关键词触发
    const kwCount = contact.keywordPrompts?.length || 0;
    const kwDisplay = kwCount > 0 ? `${kwCount} 条` : '未设置';

    // 顶部:头像 / 名字 / 状态
    const headerHtml = `
        <div class="chat-settings-header">
            <div class="chat-settings-avatar" data-avatar-color="${escapeHtml(avatarColor)}">
                ${contact.avatar
                    ? `<img src="${escapeHtml(contact.avatar)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" />`
                    : `<span class="chat-settings-avatar-text">${escapeHtml(avatarText)}</span>`}
            </div>
            <div class="chat-settings-name">${escapeHtml(contact.name)}</div>
            <div class="chat-settings-status">${escapeHtml(contact.status || '在线')}</div>
        </div>
    `;

    // 三个圆形入口按钮
    // ★ v0.31 朋友圈按钮接入 ai-moments-{aiPersonId}-{mode} 详情页(原 chat.js 有,新版接通)
    //   语音/视频接 appMethod 由 chat-app 暂用灵动岛提示(功能即将开放)
    const voiceAction = JSON.stringify({ action: 'appMethod', appId: 'chat', method: 'placeholderVoiceCall' });
    const videoAction = JSON.stringify({ action: 'appMethod', appId: 'chat', method: 'placeholderVideoCall' });
    const momentsDetailPageId = `ai-moments-${escapeHtml(aiPersonId)}-${escapeHtml(mode)}`;
    const momentsAction = JSON.stringify({ action: 'detail', appId: 'chat', pageId: momentsDetailPageId });
    const iconsRow = `
        <div class="chat-settings-icons-row">
            <div class="chat-settings-icon-btn" id="profile-voice-call" data-app-action='${escapeHtml(voiceAction)}'>
                <div class="chat-settings-icon-circle">
                    <svg viewBox="0 0 24 24">
                        <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                    </svg>
                </div>
                <div class="chat-settings-icon-label">语音</div>
            </div>
            <div class="chat-settings-icon-btn" id="profile-video-call" data-app-action='${escapeHtml(videoAction)}'>
                <div class="chat-settings-icon-circle">
                    <svg viewBox="0 0 24 24">
                        <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                    </svg>
                </div>
                <div class="chat-settings-icon-label">视频</div>
            </div>
            <div class="chat-settings-icon-btn" id="profile-moments" data-app-action='${escapeHtml(momentsAction)}'>
                <div class="chat-settings-icon-circle">
                    <svg viewBox="0 0 24 24">
                        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                    </svg>
                </div>
                <div class="chat-settings-icon-label">朋友圈</div>
            </div>
        </div>
    `;

    // 设置卡片(第一组:基础设置)
    const basicCardTitle = renderSectionTitle(
        '<svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.31.06-.62.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>',
        '设置'
    );

    const basicCardBody = `
        <div class="chat-settings-card">
            ${basicCardTitle}
            ${renderSettingItem({
                id: 'set-remark',
                label: '备注',
                value: contact.remark ? contact.remark : '未设置',
                extra: `<input type="hidden" id="set-remark-aiid" value="${escapeHtml(aiPersonId)}" />
                        <input type="hidden" id="set-remark-mode" value="${escapeHtml(mode)}" />`,
            })}
            ${renderToggleItem({
                id: 'set-pinned',
                label: '置顶聊天',
                checked: !!contact.isPinned,
            })}
            ${renderToggleItem({
                id: 'set-muted',
                label: '消息免打扰',
                checked: !!contact.isMuted,
            })}
            <div class="chat-setting-item" id="set-chat-background"
                data-app-action='{"action":"appMethod","appId":"chat","method":"openChatBackgroundModal","payload":{"contactId":"${escapeHtml(aiPersonId)}","mode":"${escapeHtml(mode)}"}}'>
                <span class="chat-setting-label">聊天背景</span>
                <span class="chat-setting-value">
                    ${contact.chatBackground
                        ? renderChatBackgroundPreview(contact.chatBackground)
                        : '<span class="chat-setting-default-text">默认</span>'}
                    <svg class="chat-setting-arrow" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
                </span>
            </div>
        </div>
    `;

    // AI 设置卡片(第二组)
    const aiCardTitle = renderSectionTitle(
        '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>',
        'AI 设置'
    );

    const aiCardBody = `
        <div class="chat-settings-card">
            ${aiCardTitle}
            <div class="chat-setting-item" id="set-reply-prompt"
                data-app-action='{"action":"detail","appId":"chat","pageId":"prompt-manager-${escapeHtml(contactId)}"}'>
                <span class="chat-setting-label">回复提示词</span>
                <span class="chat-setting-value">
                    ${replyPromptDisplay}
                    <svg class="chat-setting-arrow" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
                </span>
            </div>
            <div class="chat-setting-item" id="set-context-length"
                data-app-action='${JSON.stringify({ action: 'appMethod', appId: 'chat', method: 'openContextLengthModal', payload: { contactId: aiPersonId, mode } })}'>
                <span class="chat-setting-label">
                    上下文长度
                    <span class="chat-setting-badge chat-setting-badge--new" title="v0.61 新增功能:上下文长度按「回合」计算(1 回合 = 1 组用户 + 1 组 AI)">新增</span>
                </span>
                <span class="chat-setting-value">
                    ${ctxDisplay}
                    <svg class="chat-setting-arrow" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
                </span>
            </div>
            ${renderToggleItem({
                id: 'set-rolling-enabled',
                label: '滚动摘要是否开启',
                desc: rollingConfigDesc || '超出阈值自动合并相邻概要,节省 Token',
                checked: rollingEnabled,
            })}
            ${rollingEnabled ? `
            <div class="chat-setting-item" id="set-rolling-capacity"
                data-app-action='${JSON.stringify({ action: 'appMethod', appId: 'chat', method: 'openRollingCapacityModal', payload: { contactId: aiPersonId, mode } })}'>
                <span class="chat-setting-label">
                    滚动摘要容量
                    <span class="chat-setting-badge" title="K 链长度 / 合并粒度">配置</span>
                </span>
                <span class="chat-setting-value">
                    ${(() => {
                        try {
                            const cfg = window.settingsSdk?.rollingSummaries?.getRollingConfig?.(aiPersonId);
                            const len = Number(cfg?.maxChainLength) || 10;
                            const k = Number(cfg?.kMergeSize) || 5;
                            return `链长 ${len} · 合并粒度 ${k}`;
                        } catch (_) { return '链长 10 · 合并粒度 5'; }
                    })()}
                    <svg class="chat-setting-arrow" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
                </span>
            </div>` : ''}
            <div class="chat-setting-item" id="set-api-call"
                data-app-action='{"action":"appMethod","appId":"chat","method":"openApiCallModal","payload":{"contactId":"${escapeHtml(contactId)}","mode":"${escapeHtml(mode)}"}}'>
                <span class="chat-setting-label">API 调用</span>
                <span class="chat-setting-value">
                    ${(() => {
                        try {
                            const sdk = window.settingsSdk;
                            const ai = sdk?.aiPersons?.get?.(aiPersonId);
                            const bound = ai?.boundResources?.apiRefs || [];
                            const localKey = 'xiaoting::chat-default-api-key::' + aiPersonId;
                            const savedRaw = (() => { try { return localStorage.getItem(localKey) || ''; } catch (_) { return ''; } })();
                            console.log('[chat][renderChatSettings] render ts=' + Date.now() + ' aiPersonId=' + aiPersonId + ' window.__apiSdk?=' + !!window.__apiSdk + ' savedRaw=' + savedRaw + ' bound.length=' + bound.length);
                            // 兼容 refType::refId 新形态 + 老形态(纯 id)
                            let savedType = '';
                            let savedId = savedRaw;
                            if (savedRaw && savedRaw.includes('::')) {
                                const parts = savedRaw.split('::');
                                savedType = parts[0] === 'group' ? 'group' : 'key';
                                savedId = parts.slice(1).join('::');
                            }
                            const apiSdk = window.__apiSdk;
                            // 先按 saved 找(多层兜底:__apiSdk 缓存 + localStorage label 缓存 + bound 回退)
                            const findById = (id) => {
                                // 第一层:__apiSdk 缓存(同步,settings app 加载后可用)
                                const k = apiSdk?.apiKeySdk?.get?.(id);
                                if (k) return k.label || k.id || id;
                                const g = apiSdk?.apiGroupSdk?.get?.(id);
                                if (g) return g.name || g.id || id;
                                // 第二层:localStorage label 缓存(API 管理编辑时同步写入,
                                //   即使 __apiSdk 还没挂载,这里也能拿到,作为兜底)。
                                //   key 格式:xiaoting::api-label::{type}::{id}
                                try {
                                    const lk = 'xiaoting::api-label::key::' + id;
                                    const lg = 'xiaoting::api-label::group::' + id;
                                    const cachedK = localStorage.getItem(lk);
                                    if (cachedK) return cachedK;
                                    const cachedG = localStorage.getItem(lg);
                                    if (cachedG) return cachedG;
                                } catch (_) {}
                                return '';
                            };
                            console.log('[chat][renderChatSettings] savedRaw=' + savedRaw + ' savedId=' + savedId + ' savedType=' + savedType + ' bound.length=' + bound.length, 'hasApiSdk=' + !!apiSdk, 'findById(savedId)=' + (savedId ? findById(savedId) : '(empty)'));
                            if (savedId) {
                                const label = findById(savedId);
                                if (label) return savedType === 'group' ? label + ' (组)' : label;
                            }
                            // 兜底:按 bound 第一条 ref 找
                            const firstRef = bound[0] || {};
                            const fallbackId = firstRef.apiKeyId || firstRef.groupId || firstRef.refId || '';
                            if (fallbackId) {
                                const label = findById(fallbackId);
                                if (label) return (firstRef.refType === 'group' || firstRef.groupId) ? label + ' (组)' : label;
                            }
                            return '未配置';
                        } catch (_) { return '未配置'; }
                    })()}
                    <svg class="chat-setting-arrow" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
                </span>
            </div>
            <div class="chat-setting-item chat-setting-last" id="set-moments-read">
                <span class="chat-setting-label">可读取朋友圈</span>
                <span class="chat-setting-value">
                    ${momentsReadDisplay}
                    <svg class="chat-setting-arrow" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
                </span>
            </div>
        </div>
    `;

    // 聊天记录管理卡片
    const historyCardTitle = renderSectionTitle(
        '<svg viewBox="0 0 24 24"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/></svg>',
        '聊天记录管理'
    );

    const isCalendarMode = mode === 'calendar';
    // ★ v0.65 聊天记录管理：统一入口「层级管理」+ 日历视图 / 故事记录 子项
    const levelManageAction = JSON.stringify({
        action: 'detail',
        appId: 'chat',
        pageId: `memory-management-${escapeHtml(aiPersonId)}-${escapeHtml(mode)}`,
    });
    const historyEntryHtml = `
        <div class="chat-setting-item chat-setting-icon-item" id="open-memory-management"
            data-app-action='${escapeHtml(levelManageAction)}'>
            <div class="chat-setting-icon-mini" data-color-kind="blue">
                <svg viewBox="0 0 24 24"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>
            </div>
            <div class="chat-setting-label-block">
                <span class="chat-setting-label">层级管理</span>
                <span class="chat-setting-desc">配置分级概要 + 查看历史</span>
            </div>
            <svg class="chat-setting-arrow chat-setting-arrow-solo" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
        </div>
    `;
    const historyCardBody = `
        <div class="chat-settings-card">
            ${historyCardTitle}
            ${historyEntryHtml}
            ${isCalendarMode ? `
            <div class="chat-setting-item chat-setting-icon-item chat-setting-last" id="open-calendar-view"
                data-app-action='{"action":"detail","appId":"chat","pageId":"calendar-view-${escapeHtml(contactId)}"}'>
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
            <div class="chat-setting-item chat-setting-icon-item chat-setting-last" id="open-story-archive"
                data-app-action='{"action":"detail","appId":"chat","pageId":"story-archive-${escapeHtml(contactId)}"}'>
                <div class="chat-setting-icon-mini" data-color-kind="pink">
                    <svg viewBox="0 0 24 24"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/></svg>
                </div>
                <div class="chat-setting-label-block">
                    <span class="chat-setting-label">故事记录</span>
                    <span class="chat-setting-desc">封存、恢复和管理聊天存档</span>
                </div>
                <svg class="chat-setting-arrow chat-setting-arrow-solo" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
            </div>
            `}
        </div>
    `;

    // 互动统计卡片(仅主角色)
    let statsCardBody = '';
    if (isMain) {
        const statsTitle = renderSectionTitle(
            '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>',
            '互动统计'
        );

        // demo 数据(后续 Phase 接 IndexedDB)
        const totalMessages = 0;
        const aiReplies = 0;
        const chatDays = 0;
        const avgPerDay = '0';

        statsCardBody = `
            <div class="chat-settings-card">
                ${statsTitle}
                <div class="chat-stat-grid">
                    ${renderStatCard(totalMessages, '发送消息数', 'blue')}
                    ${renderStatCard(aiReplies, 'AI 回复数', 'pink')}
                    ${renderStatCard(chatDays, '聊天天数', 'green')}
                    ${renderStatCard(avgPerDay, '日均消息', 'amber')}
                </div>
                <div class="chat-setting-item chat-setting-icon-item chat-setting-last" id="open-stats-prompt-config">
                    <div class="chat-setting-icon-mini" data-color-kind="blue">
                        <svg viewBox="0 0 24 24"><path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6C7.8 12.16 7 10.63 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z"/></svg>
                    </div>
                    <div class="chat-setting-label-block">
                        <span class="chat-setting-label">统计数据进入 Prompt</span>
                        <span class="chat-setting-desc">配置哪些统计信息让 AI 知道</span>
                    </div>
                    <svg class="chat-setting-arrow chat-setting-arrow-solo" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
                </div>
            </div>
        `;
    }

    // 危险操作卡片
    const dangerCardBody = `
        <div class="chat-settings-card chat-settings-card-danger">
            <div class="chat-setting-item chat-setting-last chat-setting-danger-item" id="clear-chat-history">
                <span class="chat-setting-danger-text">清空聊天记录</span>
            </div>
            ${isMain ? `
            <div class="chat-setting-item chat-setting-last chat-setting-danger-item" id="block-ai">
                <span class="chat-setting-danger-text">${contact.isBlocked ? '解除拉黑' : '拉黑此联系人'}</span>
            </div>
            ` : ''}
        </div>
    `;

    // 顶部 header(只保留返回按钮)
    // ★ 跟 chat-private 同款自接管 header 的策略,
    //   framework 默认的 app-detail-header 已被 chat-app 的 CSS 隐藏
    const headerBarHtml = `
        <div class="chat-settings-topbar">
            <button class="chat-back-btn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}'>
                <svg viewBox="0 0 24 24">
                    <polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        </div>
    `;

    return `
        <div class="chat-settings" data-contact-id="${escapeHtml(contactId)}" data-contact-type="${escapeHtml(contact.type)}">
            ${headerBarHtml}
            <div class="chat-settings-page">
                ${headerHtml}
                ${iconsRow}
                ${basicCardBody}
                ${aiCardBody}
                ${historyCardBody}
                ${statsCardBody}
                ${dangerCardBody}
            </div>
        </div>
    `;
}

export default renderChatSettingsPage;
