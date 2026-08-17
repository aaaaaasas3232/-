/**
 * chat-app / 语音通话页面
 *
 * Phase 11 UI 复原
 *
 * 功能:
 *   - 全屏深色渐变背景 + 动态装饰
 *   - 大头像 + 光晕动画
 *   - 通话状态 + 计时器
 *   - 消息对话区域
 *   - 底部控制按钮（静音/挂断/最小化）
 *
 * 当前阶段:1:1 复原 UI,模拟效果
 */

import { escapeHtml } from '@/src/core/escape.js';
import { resolveAiAvatar } from '../aiMeta.js';

// Demo 联系人数据
// ★ v0.80:移除占位联系人(小美/小明/小蓝) — 真实联系人走 SDK。
const DEMO_CONTACTS = {};

// ★ v0.71 头像背景色已统一到 aiMeta.resolveAiAvatar,删除本地 getAvatarColor 重复实现

/**
 * 渲染语音通话页面
 *
 * @param {Object} app - app 配置
 * @param {string} contactId - 联系人 id (格式: aiPersonId 或 aiPersonId-mode,例如 "ai0" 或 "ai0-calendar")
 * @param {string} callType - 通话类型 'voice' | 'video'
 * @returns {string} HTML 字符串
 */
export function renderCallPage(app, contactId, callType = 'voice') {
    // ★ v0.67.x 解析 contactId:可能包含 -mode 后缀(例如 "ai0-calendar")
    //   - 拆出 aiPersonId 拿真实联系人
    let aiPersonId = contactId;
    let mode = 'calendar';
    const lastDash = contactId.lastIndexOf('-');
    if (lastDash > 0) {
        const tail = contactId.slice(lastDash + 1);
        if (tail === 'calendar' || tail === 'story') {
            aiPersonId = contactId.slice(0, lastDash);
            mode = tail;
        }
    }

    // ★ v0.67.x 真实联系人:从 SDK 读
    let contact = null;
    try {
        const sdk = window.settingsSdk;
        if (sdk?.aiPersons?.get) {
            const ai = sdk.aiPersons.get(aiPersonId);
            if (ai) {
                const chatProfile = ai.socialProfiles?.chat || {};
                const aiAv = resolveAiAvatar(aiPersonId);
                contact = {
                    id: ai.id,
                    name: chatProfile.nickname || ai.name || aiPersonId,
                    avatar: aiAv.url,
                    avatarBg: aiAv.bg,
                    status: '在线',
                    aiPersonId: ai.id,
                    mode,
                };
            }
        }
    } catch (_) { /* fallback 用 demo */ }

    // Demo 联系人(SDK 未就绪 fallback)
    if (!contact) {
        const aiAv = resolveAiAvatar(aiPersonId);
        contact = DEMO_CONTACTS[contactId] || {
            id: contactId,
            name: aiPersonId,
            avatar: aiAv.url,
            avatarBg: aiAv.bg,
            status: '在线',
            aiPersonId,
            mode,
        };
    }

    const avatarColor = contact.avatarBg || resolveAiAvatar(contactId).bg;
    const isVideo = callType === 'video';

    // ★ 风格对齐收藏页：浅色主题（语音浅蓝→浅粉→白，视频浅粉→白）
    //   bgStyle 已不再需要，背景由 CSS [data-call-type] 选择器控制

    // ★ 动态背景装饰改成极淡光晕（跟收藏页色调一致）
    const bgDecorHtml = `
        <div class="call-bg-decor">
            <div class="call-bg-orb call-bg-orb-1"></div>
            <div class="call-bg-orb call-bg-orb-2"></div>
            <div class="call-bg-orb call-bg-orb-3"></div>
        </div>
    `;

    // ★ 视频通话：去掉黑色视频背景，本地视频小窗保留（样式由 CSS 改成浅色）
    const videoBgHtml = isVideo ? `
        <div class="call-video-bg">
            <div class="call-local-video">
                <div class="call-local-avatar">
                    <svg viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)" width="28" height="28">
                        <circle cx="12" cy="8" r="4"/>
                        <path d="M4 20v-2c0-2.21 3.58-4 8-4s8 1.79 8 4v2"/>
                    </svg>
                </div>
            </div>
        </div>
    ` : '';

    // 头像区域（保留尺寸由 CSS 控制）
    const avatarHtml = !isVideo ? `
        <div class="call-avatar-container">
            <div class="call-avatar">
                <div class="call-avatar-inner" style="background:linear-gradient(135deg,${avatarColor},${avatarColor}cc);">
                    ${escapeHtml(contact.name.charAt(0))}
                </div>
            </div>
        </div>
    ` : `
        <div class="call-avatar call-avatar-video">
            <div class="call-avatar-inner" style="background:linear-gradient(135deg,${avatarColor},${avatarColor}cc);">
                ${escapeHtml(contact.name.charAt(0))}
            </div>
        </div>
    `;

    return `
        <div class="call-page" data-call-type="${callType}">
            ${bgDecorHtml}
            ${videoBgHtml}

            <!-- 顶部信息区域 -->
            <div class="call-info-area">
                ${avatarHtml}

                <div class="call-name">${escapeHtml(contact.name)}</div>

                <div class="call-status">
                    <span class="call-status-dot"></span>
                    <span class="call-status-text" id="call-status-text">正在呼叫...</span>
                </div>

                <div class="call-duration" id="call-duration">00:00</div>
            </div>

            <!-- 消息对话区域 -->
            <div class="call-chat-area">
                <div class="call-messages-container" id="call-messages-container">
                    <!-- 通话消息列表 -->
                </div>
                <div class="call-input-area">
                    <input type="text" class="call-message-input" id="call-message-input"
                           placeholder="输入消息..." autocomplete="off">
                    <button class="call-send-btn" id="call-send-btn">
                        <svg viewBox="0 0 24 24" fill="white" width="18" height="18">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- 底部控制按钮 -->
            <div class="call-controls-area">
                <button class="call-control-btn" id="mute-btn" title="静音">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                    </svg>
                </button>

                <button class="call-end-btn" id="end-call-btn" title="挂断">
                    <svg viewBox="0 0 24 24" fill="white" width="28" height="28">
                        <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
                    </svg>
                </button>

                ${!isVideo ? `
                <button class="call-control-btn" id="minimize-btn" title="最小化到灵动岛">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                        <path d="M19 13H5v-2h14v2z"/>
                    </svg>
                </button>
                ` : ''}
                <!-- ★ v0.87 视频通话**不提供**最小化。
                     视频是「必须看着屏幕」的通话形态,收进灵动岛只剩一个胶囊,
                     语义上就不成立了。想边做别的事边聊 → 用旁边的「切换为语音」。 -->
                <!-- ★ 视频通话的「切换语音」:把视频通话降级为语音通话(节省流量/隐私场景) -->
                ${isVideo ? `
                <button class="call-control-btn" id="video-toggle-btn" title="切换为语音通话">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                        <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                    </svg>
                </button>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * ★ v0.67.x 初始化通话页面交互
 *   - 触发顺序: renderCallPage → framework mount → 本函数
 *   - 挂载挂断 / 最小化 / 静音按钮的事件
 *   - 启动 call-manager 的 outgoing call(用户主动拨打)
 *   - 通话消息输入框触发 sendCallMessage
 *   - 通话时长 / 状态由 call-manager 订阅驱动
 *
 * @param {Object} app - app 配置
 * @param {string} contactId - 联系人 id(可能包含 -mode 后缀)
 * @param {string} callType - 'voice' | 'video'
 */
export function initCallPage(app, contactId, callType = 'voice') {
    // 解析 contactId 拿 aiPersonId
    let aiPersonId = contactId;
    let mode = 'calendar';
    const lastDash = contactId.lastIndexOf('-');
    if (lastDash > 0) {
        const tail = contactId.slice(lastDash + 1);
        if (tail === 'calendar' || tail === 'story') {
            aiPersonId = contactId.slice(0, lastDash);
            mode = tail;
        }
    }

    const callPage = document.querySelector('.app-shell[data-app-id="chat"] .call-page');
    if (!callPage) return;

    const endBtn = callPage.querySelector('#end-call-btn');
    const muteBtn = callPage.querySelector('#mute-btn');
    const minBtn = callPage.querySelector('#minimize-btn');
    const sendBtn = callPage.querySelector('#call-send-btn');
    const msgInput = callPage.querySelector('#call-message-input');
    const statusText = callPage.querySelector('#call-status-text');
    const durationEl = callPage.querySelector('#call-duration');
    const msgContainer = callPage.querySelector('#call-messages-container');

    // 状态订阅
    let unsubscribe = null;
    let durationTimer = null;
    let connectedSince = 0;

    // ★ v0.68 渲染通话中的消息列表到 #call-messages-container
    //   - call-manager._emit() 触发后 → 从 __callManager.getState().messages 读最新数组
    //   - 用户发 + AI 回复都进 _state.messages,这里全量重画(消息量小,可接受)
    const renderCallMessages = () => {
        if (!msgContainer) return;
        try {
            const cm = window.__callManager;
            const state = cm?.getState?.();
            const msgs = state?.messages || [];
            if (!msgs.length) {
                msgContainer.innerHTML = '';
                return;
            }
            const html = msgs.map((m) => {
                const isUser = m.sender === 'user';
                const cls = isUser ? 'call-msg call-msg--user' : 'call-msg call-msg--ai';
                const label = isUser ? '我' : 'AI';
                const content = escapeHtml(String(m.content || ''));
                const time = new Date(m.timestamp || Date.now()).toLocaleTimeString('zh-CN', {
                    hour: '2-digit', minute: '2-digit',
                });
                return `<div class="${cls}">
                    <span class="call-msg-label">${label}</span>
                    <span class="call-msg-text">${content}</span>
                    <span class="call-msg-time">${time}</span>
                </div>`;
            }).join('');
            msgContainer.innerHTML = html;
            // 自动滚到底
            msgContainer.scrollTop = msgContainer.scrollHeight;
        } catch (err) {
            console.warn('[chat-app] renderCallMessages failed:', err);
        }
    };

    const fmtDuration = (ms) => {
        const total = Math.floor(ms / 1000);
        const m = Math.floor(total / 60);
        const s = total % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const updateStatus = (state) => {
        if (!statusText) return;
        const statusMap = {
            'idle': '空闲',
            'ringing': '正在呼叫...',
            'connected': '通话中',
            'ended': '已挂断',
        };
        const label = statusMap[state?.status] || state?.status || '空闲';
        statusText.textContent = label;
    };

    const updateDuration = () => {
        if (!durationEl) return;
        if (connectedSince > 0) {
            durationEl.textContent = fmtDuration(Date.now() - connectedSince);
        } else {
            durationEl.textContent = '00:00';
        }
    };

    // 异步加载 call-manager
    (async () => {
        try {
            const { callManager } = await import('../services/call-manager.js');
            if (!callManager) return;

            // 启动主动拨打
            await callManager.startOutgoingCall?.(aiPersonId, callType, mode);

            // 订阅状态
            if (typeof callManager.onChange === 'function') {
                unsubscribe = callManager.onChange((state) => {
                    updateStatus(state);
                    // ★ v0.68 每次 state 变化都重画消息列表
                    //   - 用户发消息 → 立即显示
                    //   - AI 回复 → 立即显示
                    renderCallMessages();
                    // ★ v0.69 用 call-manager 的 connectTime(真实接通时刻)算通话时长,
                    //   而不是本地 Date.now()—— 避免 view-load 时计时器从 0 重新开始
                    if (state?.status === 'connected') {
                        const cmState = callManager.getState?.() || {};
                        const realConnectTime = cmState?.connectTime || 0;
                        if (realConnectTime > 0) {
                            connectedSince = realConnectTime;
                        } else if (connectedSince === 0) {
                            connectedSince = Date.now();
                        }
                        updateDuration();
                        if (durationTimer) clearInterval(durationTimer);
                        durationTimer = setInterval(updateDuration, 1000);
                    }
                    if (state?.status === 'ended' || state?.status === 'idle') {
                        if (durationTimer) { clearInterval(durationTimer); durationTimer = null; }
                        connectedSince = 0;
                    }
                });
            }
        } catch (err) {
            console.warn('[chat-app] initCallPage callManager failed:', err);
        }
    })();

    if (endBtn) {
        endBtn.addEventListener('click', async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            // ★ v0.68 立即视觉反馈:按钮 disabled + 状态文字改「已挂断」
            //   解决「点击没反应」—— 用户点了立刻看到变化
            try {
                endBtn.disabled = true;
                endBtn.classList.add('is-ending');
            } catch (_) {}
            updateStatus({ status: 'ended' });
            if (durationTimer) { clearInterval(durationTimer); durationTimer = null; }
            // ★ v0.69 挂断前先 dismiss 灵动岛(避免岛还显示「通话中」)
            try { dismissCallIsland(); } catch (_) {}
            try {
                window.__phoneIsland?.notify?.('info', '正在挂断…');
            } catch (_) {}

            try {
                const { callManager } = await import('../services/call-manager.js');
                const result = await callManager.endCall?.();

                // 弹呼叫概要
                try {
                    const { chatModalManager } = await import('../components/chat-modal-registry.js');
                    chatModalManager.openCallSummary({
                        callType,
                        summary: result?.summary || '',
                        duration: result?.duration || 0,
                        wasConnected: result?.wasConnected ?? false,
                        onViewDetail: () => {
                            // ★ v0.68 「查看详情」:先关闭 call 页,再 push call-record 详情页
                            //   否则 call 页 + call-record 页会同时在 detailStack 上
                            //   → 用户感觉页面"卡死"(实际上是 2 层 detail 都渲染、scrollTop 互相干扰)
                            try {
                                if (typeof window.__navigationForDebug?.closeDetailPage === 'function') {
                                    window.__navigationForDebug.closeDetailPage();
                                }
                                // 关闭后再 push call-record 详情页
                                if (result?.recordId) {
                                    setTimeout(() => {
                                        try {
                                            document.dispatchEvent(new CustomEvent('app:page-action', {
                                                detail: {
                                                    action: 'detail',
                                                    appId: 'chat',
                                                    pageId: `call-record-${result.recordId}`,
                                                },
                                                bubbles: true,
                                            }));
                                        } catch (_) {}
                                    }, 50);
                                }
                            } catch (err) {
                                console.warn('[CALL-END-BTN] open call-record failed:', err);
                            }
                        },
                        onClose: () => {
                            // ★ v0.68 概要关闭后 → 关闭 call 页回到私聊
                            //   必须用 framework closeDetailPage,不能 dispatch pageId='close-call'
                            //   (后者会被 framework 当成正常 detail 打开再 push 一层)
                            try {
                                if (typeof window.__navigationForDebug?.closeDetailPage === 'function') {
                                    window.__navigationForDebug.closeDetailPage();
                                } else if (typeof app?.methods?.closeDetail === 'function') {
                                    app.methods.closeDetail();
                                }
                            } catch (_) {}
                            // ★ v0.69 兜底:再 dismiss 一次岛,避免岛在「通话已结束」状态残留
                            try { dismissCallIsland(); } catch (_) {}
                        },
                    });
                } catch (modalErr) {
                    console.warn('[CALL-END-BTN] openCallSummary failed:', modalErr);
                }
            } catch (err) {
                console.warn('[chat-app] endCall failed:', err);
                try {
                    endBtn.disabled = false;
                    endBtn.classList.remove('is-ending');
                } catch (_) {}
            }
        });
    }

    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            muteBtn.classList.toggle('is-active');
            try { window.__phoneIsland?.notify?.('info', '静音', muteBtn.classList.contains('is-active') ? '已开启' : '已关闭'); } catch (_) {}
        });
    }

    if (minBtn) {
        minBtn.addEventListener('click', () => {
            // ★ v0.69 最小化通话 → 关闭详情页 + 把通话状态挂到灵动岛
            //   - 通话状态由 call-manager 维护,所以这里只需要:
            //     ① 关闭当前 call 详情页
            //     ② 在灵动岛显示一个「通话中」mini 状态卡(包含头像/名字/通话类型/时长)
            //   - 用户点灵动岛 → 重新打开 call 详情页(由灵动岛 onClick 拦截器实现)
            try {
                minimizeCallPage(app, { aiPersonId, mode, callType, contactId });
            } catch (err) {
                console.warn('[chat-app] minimizeCallPage failed:', err);
                // 兜底:至少关闭页面,避免用户被困
                try {
                    if (typeof window.__navigationForDebug?.closeDetailPage === 'function') {
                        window.__navigationForDebug.closeDetailPage();
                    } else if (typeof app?.methods?.closeDetail === 'function') {
                        app.methods.closeDetail();
                    }
                } catch (_) {}
            }
        });
    }

    // 视频通话「切换为语音」按钮
    const videoToggleBtn = callPage.querySelector('#video-toggle-btn');
    if (videoToggleBtn) {
        videoToggleBtn.addEventListener('click', async () => {
            videoToggleBtn.disabled = true;
            try {
                const cm = window.__callManager;
                if (cm && typeof cm.endCall === 'function') {
                    // call-manager 没有降级 API,所以先挂断当前 video call
                    // (不弹概要弹窗,因为用户主动切了)
                    try { await cm.endCall?.(); } catch (_) {}
                }
                // ★ dismiss 灵动岛(避免岛显示「视频通话已结束」)
                try { dismissCallIsland(); } catch (_) {}
                // 关闭当前详情页
                try {
                    if (typeof window.__navigationForDebug?.closeDetailPage === 'function') {
                        window.__navigationForDebug.closeDetailPage();
                    }
                } catch (_) {}
                // 重新触发语音通话(用 aiPersonId 拼,而不是 contactId,避免 -mode 重复)
                try {
                    const action = { action: 'detail', appId: 'chat', pageId: `call-voice-${aiPersonId}-${mode}` };
                    document.dispatchEvent(new CustomEvent('app:page-action', { detail: action, bubbles: true }));
                } catch (_) {}
            } catch (err) {
                console.warn('[chat-app] video→voice toggle failed:', err);
                videoToggleBtn.disabled = false;
            }
        });
    }

    const sendCallMessageHandler = async () => {
        if (!msgInput) return;
        const text = (msgInput.value || '').trim();
        if (!text) return;
        try {
            const { callManager } = await import('../services/call-manager.js');
            await callManager.sendCallMessage?.(text);
            msgInput.value = '';
        } catch (err) {
            console.warn('[chat-app] sendCallMessage failed:', err);
        }
    };

    if (sendBtn) sendBtn.addEventListener('click', sendCallMessageHandler);
    if (msgInput) {
        msgInput.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' && !ev.shiftKey) {
                ev.preventDefault();
                sendCallMessageHandler();
            }
        });
    }

    // 离开页时清理
    const cleanup = () => {
        if (unsubscribe) try { unsubscribe(); } catch (_) {}
        if (durationTimer) { clearInterval(durationTimer); durationTimer = null; }
    };
    // 30 秒后兜底清理(MutationObserver 不会立刻触发)
    setTimeout(cleanup, 30 * 60 * 1000);

    // ★ v0.69 挂断时同步 dismiss 灵动岛(避免「岛还显示通话中」残影)
    //   把清理逻辑放到 cleanup 里,任何路径的关闭都会顺带关岛
    const _origCleanup = cleanup;
    const _newCleanup = () => {
        try { dismissCallIsland(); } catch (_) {}
        _origCleanup();
    };
    // 暴露给挂断按钮
    callPage.__callCleanup = _newCleanup;
}

/**
 * ★ v0.69 关闭通话页面对应的灵动岛
 *   - 任何关闭路径(挂断/外部关闭/未接通自动挂断)都应该调这个
 *   - 用 toolkit.island.dismiss() 走 framework 收口,会触发 owner.onClosed
 *   - 容错处理:即使 framework 还没就绪也不抛错
 *   - 同时停掉岛内的时长 ticker,避免内存泄漏
 */
export function dismissCallIsland() {
    // 先停 ticker(无论岛 dismiss 成功与否)
    try { stopCallIslandTicker(); } catch (_) {}
    try {
        // 1) 优先用 toolkit(framework 注入到 app.toolkit,这里通过 window 中转拿到)
        const tk = (typeof window !== 'undefined' && (window.__chatAppToolkit || window.__callAppToolkit)) || null;
        if (tk?.island?.dismiss) {
            tk.island.dismiss();
            return true;
        }
        // 2) 兜底:从 framework 全局 island 拿(window.myDynamicIsland 由 core-shim 暴露)
        if (typeof window !== 'undefined' && window.myDynamicIsland?.dismiss) {
            window.myDynamicIsland.dismiss();
            return true;
        }
        if (typeof window !== 'undefined' && window.myDynamicIsland?.closeIsland) {
            window.myDynamicIsland.closeIsland('manual');
            return true;
        }
    } catch (err) {
        console.warn('[chat-app] dismissCallIsland failed:', err);
    }
    return false;
}

/**
 * ★ v0.69 把当前通话状态录到灵动岛(medium 通讯级 UI)
 *   - 通话中显示 mini 胶囊,用户点开变成 medium(自带输入框+挂断按钮)
 *   - 通话时长/消息列表都从 call-manager.getState() 实时读
 *   - 用户可以直接在岛内发消息(走 callManager.sendCallMessage)
 *
 * @param {Object} app - app 配置(framework 注入)
 * @param {Object} opts
 * @param {string} opts.aiPersonId
 * @param {string} opts.mode
 * @param {string} opts.callType - 'voice' | 'video'
 * @param {string} opts.contactId - 完整 contactId(可能含 -mode 后缀)
 */
export async function minimizeCallPage(app, opts = {}) {
    const {
        aiPersonId = '', mode = 'calendar', callType = 'voice', contactId = '',
        // 看门狗补挂岛时传 true：此时用户可能正开着**别的** detail 页，
        // 再跑一次 closeDetailPage 会把人家的页面关掉。
        skipCloseDetail = false,
    } = opts;

    // ★ v0.87 视频通话不允许最小化 —— 收进胶囊之后画面就没了，
    //   这个形态本身不成立。UI 上已经不渲染最小化按钮，这里再兜一道，
    //   防止别处（岛 action / 深链）绕过按钮调进来。
    if (callType === 'video') {
        try {
            window.__phoneIsland?.notify?.('info', '视频通话不能最小化', '可以先「切换为语音」再收到灵动岛');
        } catch (_) { /* noop */ }
        return;
    }

    // 解析联系人显示信息(头像 + 名字 + 颜色)
    let contactInfo = {
        name: aiPersonId || '对方',
        avatar: '',
        avatarBg: '#A8C8EC',
    };
    try {
        // ★ v0.71 用 aiMeta 模块的统一解析(头像 + 名字 + 颜色)
        const { resolveAiAvatar } = await import('../aiMeta.js');
        const meta = resolveAiAvatar(aiPersonId) || {};
        const sdk = window.settingsSdk;
        const ai = sdk?.aiPersons?.get?.(aiPersonId);
        const chatProfile = ai?.socialProfiles?.chat || {};
        contactInfo = {
            name: chatProfile.nickname || ai?.name || meta?.text || aiPersonId || '对方',
            avatar: meta?.url || '',
            avatarBg: meta?.bg || '#A8C8EC',
        };
    } catch (_) { /* fallback 用默认 */ }

    const callTypeName = callType === 'video' ? '视频通话' : '语音通话';

    // 1) 关闭当前 call 详情页
    try {
        if (skipCloseDetail) {
            // 补挂路径：岛被顶掉了要还回来，但不能动用户当前的页面
        } else if (typeof window.__navigationForDebug?.closeDetailPage === 'function') {
            window.__navigationForDebug.closeDetailPage();
        } else if (typeof app?.methods?.closeDetail === 'function') {
            // 原来这行写的是 `app?.methods?.closeDetail === 'function'`（少了 typeof），
            // 恒为 false，兜底路径从来没跑过
            app.methods.closeDetail();
        }
    } catch (err) {
        console.warn('[chat-app] minimizeCallPage: closeDetailPage failed:', err);
    }

    // 2) 在灵动岛显示通话模板(mini 胶囊)
    try {
        const tk = app?.toolkit;
        if (tk && typeof window !== 'undefined') {
            window.__chatAppToolkit = tk;
        }
        if (tk?.island?.show) {
            const cm = window.__callManager;
            const cmState = cm?.getState?.() || {};
            const payload = buildCallIslandPayload({
                aiPersonId,
                mode,
                callType,
                contactId,
                contactInfo,
                cmState,
                actions: createCallIslandActions({ aiPersonId, mode, callType, contactId }),
            });

            _callIslandUserClosed = false;
            // ★ v0.69 显示 medium 通话岛模板(framework 已内置)
            //   - 同一模板在 size=medium → 中型 HTML,size=large → 大型 HTML
            //   - maxSize: 'large' 让用户点岛可 expand 到 large
            tk.island.show('medium', {
                type: 'info',
                // 对应 appConfig.islandKinds 的 'call'（essential，用户关不掉）
                kind: 'call',
                islandTemplate: 'call-medium',
                payload,
                title: contactInfo.name,
                // 通话状态持续到挂断,所以禁止 lifecycle=time 自动消失
                lifecycle: 'manual',
                closeReason: 'minimized-call',
                maxSize: 'large',
                // ★ v0.87 关键:没有 minSize 时,framework 的全局「点岛外收起」逻辑
                //   会 large → medium → mini → **关岛**。也就是说用户切出 murmur
                //   在别的 App 里随便点三下,通话岛就没了 —— 这正是「切出 murmur 后
                //   没法继续打电话」的根因（跟音乐岛当初一模一样的坑，见 AGENTS2 §2）。
                //   声明 minSize 之后收到 mini 就停住，不会被点没。
                minSize: 'mini',
                onClosed: (info) => _onCallIslandClosed(info, { aiPersonId, mode, callType, contactId }),
            });
            startCallIslandWatchdog({ aiPersonId, mode, callType, contactId });
        } else if (typeof window !== 'undefined' && window.__phoneIsland?.notify) {
            // 兜底:framework island.show 不可用,至少弹个通知
            window.__phoneIsland.notify('info', '通话已最小化', `${contactInfo.name} · ${callTypeName}`);
        }
    } catch (err) {
        console.warn('[chat-app] minimizeCallPage: show island failed:', err);
    }

    // 3) 注册全局岛 tap 拦截器(用户点岛 → 恢复通话页)
    //   framework 的 island.handleIslandClick 默认会 expandInfo(我们的模板自动 medium/large),
    //   这里拦截是为了:点挂断按钮走挂断,而不是 expand。
    //   actions 里已经处理了挂断/发消息,所以这里只设置「不在通话态时返回 false」
    try {
        if (typeof window !== 'undefined' && window.myDynamicIsland?.setIslandTapInterceptor) {
            const myInterceptor = (state) => {
                // 通话态下:让 framework 默认 expand 走模板自身(medium/large)
                // actions 处理挂断/发送,我们不需要拦截点击岛本身
                if (state?.content?.closeReason === 'minimized-call') {
                    return false; // 不拦截,让 framework 走默认 expand → 切到 medium
                }
                return false;
            };
            window.myDynamicIsland.setIslandTapInterceptor(myInterceptor);
        }
    } catch (err) {
        console.warn('[chat-app] minimizeCallPage: setIslandTapInterceptor failed:', err);
    }

    // 4) 启动岛内时长定时刷新(每 1 秒重新调 island.show 刷新)
    startCallIslandTicker({ aiPersonId, contactId });

    // 5) toast 提示(可选,用 phoneIsland.notify 即可)
    try {
        if (typeof window !== 'undefined' && window.__phoneIsland?.notify) {
            window.__phoneIsland.notify(
                'success',
                '已最小化到灵动岛',
                '点击灵动岛可继续通话',
            );
        }
    } catch (_) {}
}

/**
 * ★ v0.69 构造通话岛 payload
 *   - 包含联系人信息 + 实时通话时长 + 消息列表 + 挂断/发送 actions
 */
function buildCallIslandPayload({
    aiPersonId, mode, callType, contactId, contactInfo, cmState, actions,
}) {
    // 真实通话时长:从 call-manager 的 connectTime 算
    let durationMs = 0;
    if (cmState?.state === 'connected' && cmState?.connectTime > 0) {
        durationMs = Date.now() - cmState.connectTime;
    } else if (cmState?.state === 'ringing' && cmState?.callStartTime > 0) {
        durationMs = Date.now() - cmState.callStartTime;
    }

    return {
        // 联系人信息
        name: contactInfo.name,
        avatar: contactInfo.avatar || '',
        avatarBg: contactInfo.avatarBg || '#A8C8EC',
        // 通话上下文(便于恢复)
        aiPersonId,
        mode,
        callType,
        contactId,
        // 实时通话时长(模板会用 payload.durationMs,否则 fallback 用 connectTime)
        durationMs,
        connectTime: cmState?.connectTime || 0,
        // 通话消息(传给模板渲染岛内列表)
        messages: Array.isArray(cmState?.messages) ? cmState.messages : [],
        // actions(挂断 / 发消息 → 模板挂载时会挂按钮)
        actions,
    };
}

/**
 * ★ v0.69 构造通话岛 actions
 *   - hangup: 调 callManager.endCall + dismiss 岛
 *   - send-msg: 调 callManager.sendCallMessage + 刷新岛显示新消息
 */
function createCallIslandActions({ aiPersonId, mode, callType, contactId }) {
    return {
        'hangup': async () => {
            try {
                // 停止 ticker
                stopCallIslandTicker();
                const { callManager } = await import('../services/call-manager.js');
                const result = await callManager.endCall?.();
                dismissCallIsland();
                // 弹通话概要
                try {
                    const { chatModalManager } = await import('../components/chat-modal-registry.js');
                    chatModalManager.openCallSummary({
                        callType,
                        summary: result?.summary || '',
                        duration: result?.duration || 0,
                        wasConnected: result?.wasConnected ?? false,
                        onClose: () => {},
                    });
                } catch (modalErr) {
                    console.warn('[chat-app] island hangup openCallSummary failed:', modalErr);
                }
            } catch (err) {
                console.warn('[chat-app] island hangup failed:', err);
            }
        },
        'send-msg': async ({ value, event } = {}) => {
            const text = (value || '').trim();
            if (!text) return;
            try {
                const { callManager } = await import('../services/call-manager.js');
                await callManager.sendCallMessage?.(text);
                // 触发岛刷新(让消息列表立刻显示新消息)
                refreshCallIsland();
            } catch (err) {
                console.warn('[chat-app] island send-msg failed:', err);
            }
        },
        'restore-detail': () => {
            // 大尺寸下的"全屏"按钮(目前通过点岛空白处触发 expand,这里保留扩展位)
            try {
                const action = {
                    action: 'detail',
                    appId: 'chat',
                    pageId: `call-${callType}-${contactId}`,
                };
                document.dispatchEvent(new CustomEvent('app:page-action', { detail: action, bubbles: true }));
                dismissCallIsland();
            } catch (err) {
                console.warn('[chat-app] island restore-detail failed:', err);
            }
        },
    };
}

/**
 * ★ v0.69 岛内时长定时刷新 + 消息同步
 *   - 时长:每秒**直接 DOM 更新**文本,不调 island.show(避免 framework "弹动"反馈)
 *   - 消息变化:重新调 island.show 渲染消息列表
 *   - 通话结束(idle):停 ticker + dismiss 岛
 */
let _callIslandTicker = null;
let _callIslandCmUnsub = null;
let _callIslandRefreshTimer = null;
/** 用户明确把通话岛关掉了 —— 看门狗不要再把它抢回来 */
let _callIslandUserClosed = false;
let _callIslandWatchdog = null;

/**
 * ★ v0.87 通话岛被关掉时的处理。
 *
 * 语义约定跟音乐岛一致（AGENTS2 §1.4）：
 *   - 用户明确要关（长按 / 手动）→ 尊重，别复活，但**通话本身继续**，
 *     从私聊页还能点回通话页。
 *   - 系统接管（编辑桌面 / widget picker）→ 等它还回来，什么都不做。
 *   - 被通知顶替 / 生命周期到期 / 强制重置 → 只要还在通话就抢回来。
 */
function _onCallIslandClosed(info, ctx) {
    const reason = info?.reason || '';
    if (reason === 'manual' || reason === 'userLongPress' || reason === 'userOutside') {
        _callIslandUserClosed = true;
        stopCallIslandWatchdog();
        try {
            const cm = window.__callManager;
            const st = cm?.getState?.()?.state;
            if (st === 'connected' || st === 'ringing') {
                window.__phoneIsland?.notify?.('info', '通话仍在继续', '回到聊天页可以重新进入通话');
            }
        } catch (_) { /* noop */ }
        return;
    }
    if (reason === 'editMode' || reason === 'widgetPicker') return;
    // 其余情况（被顶替 / 到期 / 强制）交给看门狗补挂
    startCallIslandWatchdog(ctx);
}

/**
 * 通话进行中但岛没了 → 3 秒补挂一次。
 * 通话岛经常被聊天通知、天气 toast 之类顶掉，顶完不一定有人还回来。
 */
function startCallIslandWatchdog(ctx = {}) {
    stopCallIslandWatchdog();
    _callIslandWatchdog = setInterval(() => {
        try {
            if (_callIslandUserClosed) return;
            const cm = window.__callManager;
            const st = cm?.getState?.()?.state;
            if (st !== 'connected' && st !== 'ringing') {
                stopCallIslandWatchdog();
                return;
            }
            const tk = window.__chatAppToolkit;
            const cur = tk?.island?.getState?.();
            if (!cur || cur.mode !== 'idle') return;
            // 用户如果正开着通话详情页，就不用挂岛
            if (document.querySelector('.app-shell[data-app-id="chat"] .call-page')) return;
            const app = window.__phoneAppsRef?.value?.find?.((a) => a?.id === 'chat') || null;
            void minimizeCallPage(app, { ...ctx, skipCloseDetail: true });
        } catch (_) { /* noop */ }
    }, 3000);
}

function stopCallIslandWatchdog() {
    if (_callIslandWatchdog) {
        clearInterval(_callIslandWatchdog);
        _callIslandWatchdog = null;
    }
}

function formatCallDurationStr(ms) {
    const safe = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0;
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function resolveCallDurationMs(cmState) {
    if (cmState?.state === 'connected' && cmState?.connectTime > 0) {
        return Date.now() - cmState.connectTime;
    }
    if (cmState?.state === 'ringing' && cmState?.callStartTime > 0) {
        return Date.now() - cmState.callStartTime;
    }
    return 0;
}

function startCallIslandTicker({ aiPersonId, contactId }) {
    stopCallIslandTicker();

    const tk = window.__chatAppToolkit;
    if (!tk?.island?.show) return;

    /**
     * 轻量更新:只改岛内的时长文本,不触发 framework "弹动"反馈。
     */
    const refreshDuration = () => {
        try {
            const cm = window.__callManager;
            const cmState = cm?.getState?.() || {};
            if (cmState?.state === 'idle' || cmState?.state === 'ended') {
                stopCallIslandTicker();
                return;
            }
            const cur = tk.island.getState?.();
            if (!cur || cur.mode === 'idle') return;
            const durationStr = formatCallDurationStr(resolveCallDurationMs(cmState));

            // 找岛内所有可能放时长的 span,把它们的 text 改成最新值
            // 模板里时长的 span 是 class=call-island-medium-time / call-island-large-time
            // 但我们走内联样式时无法用 class 定位,改用 islandContent.title/旧字符串反查
            const root = document.getElementById('dynamic-island');
            if (!root) return;
            // 通过查询匹配 mm:ss 文本的 span/font-family monospace 节点
            // 简单做法:遍历所有叶子 span,匹配正则 mm:ss
            const spans = root.querySelectorAll('span');
            const timeRe = /^\d{2}:\d{2}$/;
            spans.forEach((sp) => {
                if (timeRe.test(sp.textContent.trim())) {
                    sp.textContent = durationStr;
                }
            });
        } catch (err) {
            // noop
        }
    };

    /**
     * 全量刷新:重新调 island.show 渲染(消息列表/挂断动作的 actions 都会重新绑定)
     */
    const refreshFull = () => {
        try {
            const cm = window.__callManager;
            const cmState = cm?.getState?.() || {};
            if (cmState?.state === 'idle' || cmState?.state === 'ended') {
                stopCallIslandTicker();
                return;
            }
            const cur = tk.island.getState?.();
            if (!cur || cur.mode === 'idle') return;
            const size = cur.size || 'medium';

            const prevPayload = cur?.content?.payload || {};
            const aId = prevPayload.aiPersonId || aiPersonId;
            const md = prevPayload.mode || 'calendar';
            const ct = prevPayload.callType || 'voice';
            const cid = prevPayload.contactId || contactId;

            const newPayload = buildCallIslandPayload({
                aiPersonId: aId,
                mode: md,
                callType: ct,
                contactId: cid,
                contactInfo: {
                    name: prevPayload.name || aId,
                    avatar: prevPayload.avatar || '',
                    avatarBg: prevPayload.avatarBg || '#A8C8EC',
                },
                cmState,
                actions: createCallIslandActions({ aiPersonId: aId, mode: md, callType: ct, contactId: cid }),
            });

            tk.island.show(size, {
                type: 'info',
                kind: 'call',
                islandTemplate: 'call-medium',
                payload: newPayload,
                title: prevPayload.name || aId,
                lifecycle: 'manual',
                closeReason: 'minimized-call',
                maxSize: 'large',
                // 每次全量刷新都是一次完整的 show，minSize / onClosed 不带上就等于被清掉，
                // 于是「点三下就把通话岛点没了」会在第一条消息之后复活。
                minSize: 'mini',
                onClosed: (info) => _onCallIslandClosed(info, {
                    aiPersonId: aId, mode: md, callType: ct, contactId: cid,
                }),
            });
        } catch (err) {
            // noop
        }
    };

    // 每秒只刷时长(轻量,不动 framework → 不弹)
    _callIslandTicker = setInterval(refreshDuration, 1000);

    // 订阅 call-manager:消息/状态变化 → 全量刷新(让 AI 自动回复也能出现在岛内)
    // 注意:这会触发 framework 的 active 反馈("弹一下"),用户接受这点(因为是新消息来了)
    (async () => {
        try {
            const { callManager } = await import('../services/call-manager.js');
            if (typeof callManager?.onChange === 'function') {
                _callIslandCmUnsub = callManager.onChange(() => {
                    if (_callIslandRefreshTimer) return;
                    _callIslandRefreshTimer = setTimeout(() => {
                        _callIslandRefreshTimer = null;
                        refreshFull();
                    }, 50);
                });
            }
        } catch (_) { /* noop */ }
    })();
}

function stopCallIslandTicker() {
    // 挂断和「从岛回到通话页」都会走到这里，两种情况下看门狗都不该再补挂
    stopCallIslandWatchdog();
    if (_callIslandTicker) {
        clearInterval(_callIslandTicker);
        _callIslandTicker = null;
    }
    if (_callIslandRefreshTimer) {
        clearTimeout(_callIslandRefreshTimer);
        _callIslandRefreshTimer = null;
    }
    if (_callIslandCmUnsub) {
        try { _callIslandCmUnsub(); } catch (_) {}
        _callIslandCmUnsub = null;
    }
}

/**
 * 主动触发岛刷新(用户发消息后用)
 */
function refreshCallIsland() {
    if (_callIslandTicker) {
        // ticker 会自动刷新,无需手动
        return;
    }
    startCallIslandTicker({});
}

/**
 * ★ v0.69 从灵动岛恢复通话页(用于岛的 onClick / actions[restore].onClick)
 */
export function restoreCallPage(aiPersonId, mode = 'calendar', callType = 'voice') {
    const contactId = `${aiPersonId}-${mode}`;
    restoreCallPageFromId(contactId, callType);
}

function restoreCallPageFromId(contactId, callType) {
    try {
        const action = {
            action: 'detail',
            appId: 'chat',
            pageId: `call-${callType}-${contactId}`,
        };
        document.dispatchEvent(new CustomEvent('app:page-action', { detail: action, bubbles: true }));
        // ★ 恢复通话页后,顺手 dismiss 岛(否则岛还在显示)
        try { dismissCallIsland(); } catch (_) {}
    } catch (err) {
        console.warn('[chat-app] restoreCallPageFromId failed:', err);
    }
}

export default renderCallPage;
