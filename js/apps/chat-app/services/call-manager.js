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

import { readContextPreview } from './context-preview.js';

async function _executeManagedApi(options) {
    const execute = window.__apiSdk?.executeApiRequest
        || (await import('../../setting/api-manager/api-key-sdk.js')).executeApiRequest;
    if (typeof execute !== 'function') throw new Error('API 执行器未就绪');
    return execute(options);
}

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

/**
 * ★ v0.68 联动 context-mode —— 通话状态切换时同步更新全局上下文模式
 *   - 通话中 → voice / video
 *   - 通话结束(挂断/未接通) → 回到 chat
 */
function _syncContextMode(callType) {
    try {
        if (typeof window.__chatContextMode?.setMode === 'function') {
            // callType: 'voice' | 'video' | 'game' | 'chat' | 其他
            // ★ 兜底:未知 mode 时不切(避免静默切错),但保证 cache 至少是 chat
            const target = ['voice', 'video', 'game'].includes(callType) ? callType : 'chat';
            window.__chatContextMode.setMode(target);
        }
    } catch (_) {}
}
function _syncContextModeBack() {
    try {
        if (typeof window.__chatContextMode?.forceMode === 'function') {
            window.__chatContextMode.forceMode('chat');
        }
    } catch (_) {}
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
        // ★ v0.68 切换上下文模式
        _syncContextMode(callType);

        // 模拟 1.5 秒后接通
        setTimeout(() => {
            if (_state.state === CALL_STATE.RINGING && _state.aiPersonId === aiPersonId) {
                _state.state = CALL_STATE.CONNECTED;
                _state.connectTime = Date.now();
                _emit();
                // ★ v0.68 控制台打印:通话接通时的 AI 上下文模式 + 当前 mode prompt
                try {
                    const cm = window.__chatContextMode;
                    const payload = {
                        aiPersonId: _state.aiPersonId,
                        callType: _state.callType,
                        mode: _state.mode,
                        isIncoming: _state.isIncoming,
                        currentMode: cm?.getCurrentMode?.(),
                        modePromptText: cm?.getCurrentModePrompt?.() || null,
                        modeAllowed: cm?.isCurrentModeAllowed?.() ?? null,
                    };
                    console.log('[CALL-CONNECTED] ====== START ======');
                    console.log('[CALL-CONNECTED]', payload);
                    console.log('[CALL-CONNECTED] ====== END ======');
                } catch (_) {}
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
        // ★ v0.68 上下文模式保持 video/voice
        _syncContextMode(_state.callType);
        // ★ v0.68 控制台打印:接通时的 AI 上下文
        try {
            const cm = window.__chatContextMode;
            const payload = {
                aiPersonId: _state.aiPersonId,
                callType: _state.callType,
                mode: _state.mode,
                isIncoming: _state.isIncoming,
                currentMode: cm?.getCurrentMode?.(),
                modePromptText: cm?.getCurrentModePrompt?.() || null,
                modeAllowed: cm?.isCurrentModeAllowed?.() ?? null,
            };
            console.log('[CALL-CONNECTED] ====== START ======');
            console.log('[CALL-CONNECTED]', payload);
            console.log('[CALL-CONNECTED] ====== END ======');
        } catch (_) {}
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
        // ★ v0.68 切回 chat
        _syncContextModeBack();
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
                // ★ v0.68 切回 chat
                _syncContextModeBack();
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

        // 读取 prompt-manager 已经生成好的最终 pre。
        // context-mode 切换时会更新 pre 中那张「当前模式」卡，但不会额外拼接任何文本。
        // 先无头重跑一次拼装：通话经常是用户没进过「回复提示词」页就直接拨的，
        // 不刷新的话下面会直接 return（"当前上下文尚未生成"），整通电话 AI 都不说话。
        try {
            await window.__chatRefreshContextPreview?.({
                aiPersonId: _state.aiPersonId,
                mode: _state.mode,
            });
        } catch (_) { /* 刷新失败就用缓存那份 */ }

        let systemPrompt = '';
        let promptSource = '';
        try {
            systemPrompt = readContextPreview({
                aiPersonId: _state.aiPersonId,
                mode: _state.mode,
            }) || '';
            promptSource = 'prompt-manager-pre';
        } catch (err) {
            console.warn('[call-manager] read context preview failed', err);
        }

        // 没有 pre 就不调用 AI；禁止临时伪造另一份 systemPrompt。
        if (!systemPrompt) {
            console.warn('[call-manager] prompt-manager pre is empty, skip AI request');
            try {
                window.__phoneIsland?.notify?.(
                    'warning',
                    '当前上下文尚未生成',
                    '请先打开回复提示词页面确认 pre 内容',
                );
            } catch (_) {}
            return;
        }

        // ★ v0.70 控制台完整打印 systemPrompt(跟 ai-service.js 的 fullContext 日志对齐)
        try {
            console.log('[CALL-AI-CONTEXT] ====== START ======');
            console.log('[CALL-AI-CONTEXT] systemPrompt ====== START ======');
            console.log(systemPrompt);
            console.log('[CALL-AI-CONTEXT] systemPrompt ====== END (length=' + systemPrompt.length + ') ======');
            console.log('[CALL-AI-CONTEXT] fullContext ====== START ======');
            console.log({
                aiPersonId: _state.aiPersonId,
                aiName,
                callType: _state.callType,
                callTypeName,
                isIncoming: _state.isIncoming,
                currentMode: window.__chatContextMode?.getCurrentMode?.(),
                promptSource,
                systemPromptLength: systemPrompt.length,
                recentMessagesCount: recentMessages.length,
                recentMessages: recentMessages.slice(-6),
            });
            console.log('[CALL-AI-CONTEXT] fullContext ====== END ======');
            console.log('[CALL-AI-CONTEXT] ====== END ======');
        } catch (_) {}

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

        // 统一走 API 管理执行器：认证、代理、分组策略与调用统计都由这里处理。
        let apiResult;
        try {
            apiResult = await _executeManagedApi({
                apiKeyId: enabledKey.id,
                endpoint: 'chat/completions',
                method: 'POST',
                body: {
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...recentMessages,
                    ],
                    max_tokens: 200,
                    temperature: 0.85,
                },
                timeout: (enabledKey.timeout || 30) * 1000,
                source: 'chat-app',
                note: '通话回复',
            });
        } catch (err) {
            console.warn('[call-manager] API request failed', err);
            this._addCallAIMessage('嗯,这边信号不太好~');
            return;
        }

        if (!apiResult?.success) {
            this._addCallAIMessage('嗯,稍等一下~');
            return;
        }

        try {
            const data = apiResult.data;
            let reply = data?.choices?.[0]?.message?.content
                || data?.content?.[0]?.text
                || data?.candidates?.[0]?.content?.parts?.[0]?.text
                || '';
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
        // ★ v0.68 切回 chat
        _syncContextModeBack();
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
            const apiResult = await _executeManagedApi({
                apiKeyId: enabledKey.id,
                endpoint: 'chat/completions',
                method: 'POST',
                body: {
                    messages: [
                        { role: 'system', content: '你是一个简洁的对话概要助手。' },
                        { role: 'user', content: summaryPrompt },
                    ],
                    max_tokens: 120,
                    temperature: 0.5,
                },
                timeout: (enabledKey.timeout || 30) * 1000,
                source: 'chat-app',
                note: '通话概要',
            });
            if (!apiResult?.success) {
                throw new Error(apiResult?.error || `HTTP ${apiResult?.statusCode || 0}`);
            }
            const data = apiResult.data;
            let summary = (
                data?.choices?.[0]?.message?.content
                || data?.content?.[0]?.text
                || data?.candidates?.[0]?.content?.parts?.[0]?.text
                || ''
            ).trim();
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