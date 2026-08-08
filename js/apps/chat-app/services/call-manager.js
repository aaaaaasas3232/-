/**
 * chat-app / 通话管理器 (v0.67 私聊通话)
 *
 * 职责:
 *   1) 维护「当前通话」状态机(ringing → connected → ended)
 *   2) 监听 [打电话]/[视频通话] 格式的 AI 响应 → 弹来电弹窗
 *   3) 提供 startCall/endCall/sendCallMessage API
 *   4) 通话消息持久化到 chatMessages(call_chat 类型)
 *   5) 通话结束 → 生成通话记录(call_record 类型) + AI 生成概要
 *   6) 联动 chatModalManager.openCallSummary()
 *
 * 设计:
 *   - 单例 window.__callManager
 *   - 不依赖 framework 状态
 *   - 纯 SDK 操作
 *
 * 通话数据格式(写到 chatMessages 里):
 *   - type='call_chat', sender='user'/'ai', content='...', callType='voice'/'video', isCallMessage=true
 *   - type='call_record', sender='system', content='[通话记录]', callRecord={callType,duration,wasConnected,caller,messages,summary,timestamp}
 *   - type='call_system', sender='system', isSystemDesc=true, content='[环境描述]'
 */

import { escapeHtml } from '@/src/core/escape.js';

// ============================================
// 状态常量
// ============================================
const CALL_STATE = {
    IDLE: 'idle',
    RINGING: 'ringing', // 来电响铃中(等用户接/挂)
    CONNECTED: 'connected', // 通话已接通
    ENDED: 'ended',
};

let _state = {
    state: CALL_STATE.IDLE,
    aiPersonId: '',
    mode: 'calendar',
    callType: 'voice', // 'voice' | 'video'
    isIncoming: false, // AI 主动打来 = true
    callStartTime: 0,
    connectTime: 0,
    endTime: 0,
    messages: [], // { sender, content, timestamp, isSystemDesc? }
};

const _listeners = new Set();
function _emit() {
    for (const cb of _listeners) {
        try { cb(_state); } catch (err) { console.warn('[call-manager] listener failed', err); }
    }
}

function _newId(prefix = 'call') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

async function _waitSdk(timeout = 3000) {
    if (window.settingsSdk?.chatMessages?.add) return window.settingsSdk;
    if (typeof window.whenSettingsSdkReady === 'function') {
        return await window.whenSettingsSdkReady(timeout);
    }
    return window.settingsSdk || null;
}

function _userMeta(sdk) {
    const u = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
    const chatProfile = u?.socialProfiles?.chat || {};
    return { user: u, userId: u?.id || 'default', name: chatProfile.nickname || u?.name || '我' };
}

function _aiMeta(sdk, aiPersonId) {
    const ai = sdk?.aiPersons?.get?.(aiPersonId);
    if (!ai) return null;
    return { ai, aiId: ai.id, name: ai.name || 'AI' };
}

/**
 * 格式化通话时长
 */
export function formatCallDuration(ms) {
    const sec = Math.floor((ms || 0) / 1000);
    if (sec < 60) return `${String(sec).padStart(2, '0')} 秒`;
    const min = Math.floor(sec / 60);
    const remain = sec % 60;
    if (min < 60) return `${min} 分 ${String(remain).padStart(2, '0')} 秒`;
    const hour = Math.floor(min / 60);
    const remainMin = min % 60;
    return `${hour} 时 ${remainMin} 分`;
}

// ============================================
// 公开 API
// ============================================

export const callManager = {
    /** 订阅通话状态变化 */
    onChange(cb) {
        _listeners.add(cb);
        return () => _listeners.delete(cb);
    },

    /** 当前状态只读快照 */
    getState() {
        return { ..._state };
    },

    /**
     * 用户主动拨打(voice / video)
     * @param {string} aiPersonId
     * @param {string} callType 'voice' | 'video'
     * @param {string} mode 'calendar' | 'story'
     */
    async startOutgoingCall(aiPersonId, callType = 'voice', mode = 'calendar') {
        if (_state.state !== CALL_STATE.IDLE) {
            console.warn('[call-manager] call already in progress');
            return false;
        }
        const sdk = await _waitSdk();
        if (!sdk) {
            console.warn('[call-manager] sdk not ready');
            return false;
        }
        const aiMeta = _aiMeta(sdk, aiPersonId);
        if (!aiMeta) return false;

        _state = {
            ..._state,
            state: CALL_STATE.RINGING,
            aiPersonId,
            mode,
            callType,
            isIncoming: false,
            callStartTime: Date.now(),
            connectTime: 0,
            endTime: 0,
            messages: [],
        };
        _emit();

        // 模拟 1.5 秒后接通
        setTimeout(() => {
            if (_state.state === CALL_STATE.RINGING && _state.aiPersonId === aiPersonId) {
                _state.state = CALL_STATE.CONNECTED;
                _state.connectTime = Date.now();
                _emit();
            }
        }, 1500);

        return true;
    },

    /**
     * 用户接听 AI 来电
     */
    async acceptIncomingCall() {
        if (_state.state !== CALL_STATE.RINGING || !_state.isIncoming) return false;
        _state.state = CALL_STATE.CONNECTED;
        _state.connectTime = Date.now();
        _emit();
        return true;
    },

    /**
     * 用户拒绝 AI 来电
     */
    async rejectIncomingCall() {
        if (_state.state !== CALL_STATE.RINGING) return false;
        _state.state = CALL_STATE.IDLE;
        _state.endTime = Date.now();
        _emit();
        return true;
    },

    /**
     * 触发 AI 来电(由 ai-service 解析 [打电话]/[视频通话] 时调用)
     */
    async startIncomingCall(aiPersonId, callType = 'voice', mode = 'calendar') {
        if (_state.state !== CALL_STATE.IDLE) {
            console.warn('[call-manager] call already in progress, ignore incoming');
            return false;
        }
        const sdk = await _waitSdk();
        if (!sdk) return false;
        const aiMeta = _aiMeta(sdk, aiPersonId);
        if (!aiMeta) return false;

        _state = {
            ..._state,
            state: CALL_STATE.RINGING,
            aiPersonId,
            mode,
            callType,
            isIncoming: true,
            callStartTime: Date.now(),
            connectTime: 0,
            endTime: 0,
            messages: [],
        };
        _emit();

        // 30 秒自动挂断(参考 chat.js)
        setTimeout(() => {
            if (_state.state === CALL_STATE.RINGING && _state.aiPersonId === aiPersonId && _state.isIncoming) {
                _state.state = CALL_STATE.IDLE;
                _state.endTime = Date.now();
                _emit();
                // 灵动岛提示
                if (window.__phoneIsland?.notify) {
                    window.__phoneIsland.notify('info', '来电已挂断', aiMeta.name);
                }
            }
        }, 30000);

        return true;
    },

    /**
     * 发送通话中的消息(用户 → AI)
     * @returns {Promise<{ok, error?}>}
     */
    async sendCallMessage(content) {
        const text = String(content || '').trim();
        if (!text) return { ok: false, error: '消息为空' };
        if (_state.state !== CALL_STATE.CONNECTED) return { ok: false, error: '通话未接通' };

        const sdk = await _waitSdk();
        if (!sdk) return { ok: false, error: 'SDK 未就绪' };

        const userMeta = _userMeta(sdk);
        const msg = {
            id: _newId('cm'),
            sender: 'user',
            type: 'call_chat',
            content: text,
            callType: _state.callType,
            timestamp: Date.now(),
            isCallMessage: true,
            isIncomingCall: _state.isIncoming,
        };

        // 内存中追加
        _state.messages.push({
            sender: 'user',
            content: text,
            timestamp: msg.timestamp,
        });
        _emit();

        // 持久化
        try {
            await sdk.chatMessages.add(userMeta.user, _state.aiPersonId, _state.mode, msg);
        } catch (err) {
            console.warn('[call-manager] save user call msg failed', err);
        }

        // 触发 AI 回复
        try {
            await this._generateCallAIResponse(text);
        } catch (err) {
            console.warn('[call-manager] generate AI call response failed', err);
        }

        return { ok: true };
    },

    /**
     * 内部:触发 AI 回复(走和 chat.js generateCallResponse 类似的链路)
     */
    async _generateCallAIResponse(userContent) {
        const sdk = await _waitSdk();
        if (!sdk) return;
        const aiMeta = _aiMeta(sdk, _state.aiPersonId);
        if (!aiMeta) return;
        const userMeta = _userMeta(sdk);

        // 构造 system prompt(简版)
        const callTypeName = _state.callType === 'video' ? '视频通话' : '语音通话';
        const aiName = aiMeta.name;

        // 取最近 5 条普通聊天作为背景
        let chatHistory = [];
        try {
            const all = sdk.chatMessages.list(userMeta.user, _state.aiPersonId, _state.mode) || [];
            chatHistory = all
                .filter((m) => !m.isCallMessage && m.type !== 'call_chat' && m.type !== 'call_record' && m.type !== 'call_end_notice')
                .slice(-5)
                .map((m) => ({
                    role: m.sender === 'user' ? 'user' : 'assistant',
                    content: String(m.content || '').slice(0, 200),
                }))
                .filter((m) => m.content);
        } catch (_) {}

        // 取本次通话消息
        const callMsgs = _state.messages.map((m) => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.sender === 'user' ? `[通话中] ${m.content}` : m.content,
        }));

        // 合并
        const recentMessages = [...chatHistory, ...callMsgs];

        // 拼 systemPrompt(走 prompt-builder)
        let systemPrompt = '';
        try {
            const builder = window.__chatPromptBuilder;
            if (builder && typeof builder.build === 'function') {
                const buildRes = await builder.build({
                    aiPersonId: _state.aiPersonId,
                    mode: _state.mode,
                    historyLimit: 8,
                    callContext: {
                        callType: _state.callType,
                        callTypeName,
                        isIncoming: _state.isIncoming,
                    },
                });
                systemPrompt = buildRes?.systemPrompt || '';
                if (_state.callType === 'video') {
                    systemPrompt += `\n\n【当前状态】你正在和用户进行${callTypeName}。回复请简短口语化,1-3 句话。如果想描述环境,请用括号标注,如(背景是咖啡厅)。`;
                } else {
                    systemPrompt += `\n\n【当前状态】你正在和用户进行${callTypeName}。回复请简短口语化,1-3 句话。如果想描述声音环境,请用括号标注,如(声音有些沙哑)。`;
                }
            } else {
                systemPrompt = `你是${aiName},正在和用户${callTypeName}。请简短回复,1-3 句话。`;
            }
        } catch (err) {
            console.warn('[call-manager] build prompt failed', err);
            systemPrompt = `你是${aiName},正在和用户${callTypeName}。请简短回复。`;
        }

        // 找 API key
        const apiSdk = window.__apiSdk;
        const apiKeySdk = apiSdk?.apiKeySdk;
        if (!apiKeySdk) {
            // 无 API:fallback 默认回复
            const fallback = ['嗯,我听到了', '好的呀', '是这样啊', '嗯嗯', '好,知道了'][Math.floor(Math.random() * 5)];
            this._addCallAIMessage(fallback);
            return;
        }

        const enabledKey = apiKeySdk.listEnabled?.()[0] || apiKeySdk.list?.()[0];
        if (!enabledKey?.apiKey) {
            const fallback = '嗯,听到了~';
            this._addCallAIMessage(fallback);
            return;
        }

        // 调 API
        let resp;
        try {
            resp = await fetch(enabledKey.baseUrl + '/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${enabledKey.apiKey}`,
                },
                body: JSON.stringify({
                    model: enabledKey.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...recentMessages,
                    ],
                    max_tokens: 200,
                    temperature: 0.85,
                }),
                signal: AbortSignal.timeout((enabledKey.timeout || 30) * 1000),
            });
        } catch (err) {
            console.warn('[call-manager] fetch failed', err);
            this._addCallAIMessage('嗯,这边信号不太好~');
            return;
        }

        if (!resp.ok) {
            this._addCallAIMessage('嗯,稍等一下~');
            return;
        }

        try {
            const data = await resp.json();
            let reply = data?.choices?.[0]?.message?.content || '';
            // 去掉特殊标记
            reply = reply.replace(/\[通话中\]/g, '').replace(/\[.*?\]/g, '').trim();
            // 截断过长
            if (reply.length > 100) {
                reply = reply.slice(0, 100);
                const lastPunct = Math.max(
                    reply.lastIndexOf('。'),
                    reply.lastIndexOf('！'),
                    reply.lastIndexOf('？'),
                    reply.lastIndexOf('~'),
                );
                if (lastPunct > 30) reply = reply.slice(0, lastPunct + 1);
            }
            if (!reply) reply = '嗯~';
            this._addCallAIMessage(reply);
        } catch (err) {
            console.warn('[call-manager] parse ai reply failed', err);
            this._addCallAIMessage('嗯,稍等一下~');
        }
    },

    /**
     * 内部:AI 消息追加(内存 + 持久化 + 通知 listener)
     */
    async _addCallAIMessage(content) {
        if (!content) return;
        const sdk = await _waitSdk();
        if (!sdk) return;
        const userMeta = _userMeta(sdk);
        const aiMeta = _aiMeta(sdk, _state.aiPersonId);
        if (!aiMeta) return;

        const msg = {
            id: _newId('cm'),
            sender: 'ai',
            type: 'call_chat',
            content,
            callType: _state.callType,
            timestamp: Date.now(),
            isCallMessage: true,
            senderName: aiMeta.name,
        };

        _state.messages.push({
            sender: 'ai',
            content,
            timestamp: msg.timestamp,
        });
        _emit();

        try {
            await sdk.chatMessages.add(userMeta.user, _state.aiPersonId, _state.mode, msg);
        } catch (err) {
            console.warn('[call-manager] save AI call msg failed', err);
        }
    },

    /**
     * 用户挂断电话
     * @returns {Promise<{ok, summary?, duration, wasConnected, error?}>}
     */
    async endCall() {
        if (_state.state === CALL_STATE.IDLE) return { ok: false, error: '没有通话' };

        const sdk = await _waitSdk();
        if (!sdk) return { ok: false, error: 'SDK 未就绪' };

        const wasConnected = _state.state === CALL_STATE.CONNECTED;
        const duration = wasConnected ? Date.now() - _state.connectTime : 0;
        const callTypeName = _state.callType === 'video' ? '视频通话' : '语音通话';

        const userMeta = _userMeta(sdk);
        const aiMeta = _aiMeta(sdk, _state.aiPersonId);

        // 1) 写通话记录消息
        const recordId = _newId('callrecord');
        try {
            await sdk.chatMessages.add(userMeta.user, _state.aiPersonId, _state.mode, {
                id: recordId,
                sender: 'system',
                type: 'call_record',
                content: `[${callTypeName}记录]`,
                callRecord: {
                    callType: _state.callType,
                    duration,
                    wasConnected,
                    caller: _state.isIncoming ? 'ai' : 'user',
                    timestamp: Date.now(),
                    messages: [..._state.messages],
                    summary: '',
                },
                timestamp: Date.now(),
            });
        } catch (err) {
            console.warn('[call-manager] save call record failed', err);
        }

        // 2) 写通话结束系统消息(让 AI 知道)
        try {
            await sdk.chatMessages.add(userMeta.user, _state.aiPersonId, _state.mode, {
                id: _newId('cend'),
                sender: 'system',
                type: 'call_end_notice',
                content: `[系统提示]${_state.callType === 'video' ? '视频通话' : '语音通话'}已结束${wasConnected ? `,通话时长 ${formatCallDuration(duration)}` : ',未接通'}。你可以在接下来的聊天中自然地提及刚才的通话内容。`,
                timestamp: Date.now(),
                isSystemNotice: true,
                callType: _state.callType,
                callDuration: duration,
                wasConnected,
            });
        } catch (err) {
            console.warn('[call-manager] save call end notice failed', err);
        }

        // 3) 生成梗概(如果有通话消息)
        let summary = '';
        if (wasConnected && _state.messages.length > 0) {
            try {
                summary = await this._generateCallSummary(recordId, _state.messages);
            } catch (err) {
                console.warn('[call-manager] generate summary failed', err);
                summary = `${callTypeName},交流了 ${_state.messages.length} 条消息。`;
            }
        } else {
            summary = '未接通';
        }

        // 4) 关闭状态
        const snapshot = {
            aiPersonId: _state.aiPersonId,
            mode: _state.mode,
            callType: _state.callType,
            duration,
            wasConnected,
            summary,
            senderName: aiMeta?.name || '对方',
            messages: [..._state.messages],
            recordId,
        };
        _state = {
            ..._state,
            state: CALL_STATE.IDLE,
            endTime: Date.now(),
            messages: [],
        };
        _emit();

        return { ok: true, ...snapshot };
    },

    /**
     * 内部:生成通话梗概(走 AI)
     */
    async _generateCallSummary(recordId, messages) {
        const sdk = await _waitSdk();
        if (!sdk) return '';
        const aiMeta = _aiMeta(sdk, _state.aiPersonId);
        if (!aiMeta) return '';

        const dialogText = messages
            .map((m) => `${m.sender === 'user' ? '用户' : aiMeta.name}:${m.content}`)
            .join('\n');
        const callTypeName = _state.callType === 'video' ? '视频通话' : '语音通话';

        const apiSdk = window.__apiSdk;
        const apiKeySdk = apiSdk?.apiKeySdk;
        if (!apiKeySdk) {
            return `${callTypeName},交流了 ${messages.length} 条消息。`;
        }

        const enabledKey = apiKeySdk.listEnabled?.()[0] || apiKeySdk.list?.()[0];
        if (!enabledKey?.apiKey) {
            return `${callTypeName},交流了 ${messages.length} 条消息。`;
        }

        const summaryPrompt = `请用 50 字以内概括以下${callTypeName}的主要内容,直接输出概括,不要任何前缀:\n\n${dialogText}`;

        try {
            const resp = await fetch(enabledKey.baseUrl + '/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${enabledKey.apiKey}`,
                },
                body: JSON.stringify({
                    model: enabledKey.model,
                    messages: [
                        { role: 'system', content: '你是一个简洁的对话概要助手。' },
                        { role: 'user', content: summaryPrompt },
                    ],
                    max_tokens: 120,
                    temperature: 0.5,
                }),
                signal: AbortSignal.timeout((enabledKey.timeout || 30) * 1000),
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            let summary = (data?.choices?.[0]?.message?.content || '').trim();
            if (summary.length > 60) summary = summary.slice(0, 57) + '...';
            if (!summary) throw new Error('empty summary');

            // 回填到 callRecord
            try {
                const userMeta = _userMeta(sdk);
                const allMsgs = sdk.chatMessages.list(userMeta.user, _state.aiPersonId, _state.mode) || [];
                const recordMsg = allMsgs.find((m) => m.id === recordId);
                if (recordMsg?.callRecord) {
                    recordMsg.callRecord.summary = summary;
                    await sdk.chatMessages.update(recordId, { callRecord: recordMsg.callRecord });
                }
            } catch (err) { console.warn('[call-manager] backfill summary failed', err); }

            return summary;
        } catch (err) {
            console.warn('[call-manager] summary fetch failed', err);
            return `${callTypeName},交流了 ${messages.length} 条消息。`;
        }
    },
};

// 暴露到 window 方便其他模块访问
if (typeof window !== 'undefined') {
    window.__callManager = callManager;
}