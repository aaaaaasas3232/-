/**
 * chat-app / 聊天上下文模式管理
 *
 * 设计：
 *   - 全局单例 `window.__chatContextMode`
 *   - 4 种模式: chat / voice / video / game
 *   - 互斥：同一时刻只有一种模式
 *   - call-manager 在 ringing / connected 时切换 voice / video
 *   - game-selector 进入游戏时切换 game
 *   - 退出上述场景时切回 chat
 *   - prompt-manager 在 Murmur 折叠区只展示 1 张「当前模式」卡
 *   - 卡片正文随 chat / voice / video / game 自动切换
 *   - 卡片启用时进入 orderedCards，因此按当前卡片顺序原样进入 pre
 *   - 本服务不负责拼装 systemPrompt；发给 AI 的内容始终是 pre
 *
 * 模式卡的 4 段提示词文本支持编辑：
 *   - 写：setModePromptOverride(mode, text) / setModePromptOverrides(map)
 *   - 读：getModePrompt(mode) 优先返回 override，否则回落到 MODES 默认
 *   - 清除：resetModePromptOverride(mode)
 *   - 持久化：localStorage 'xiaoting::chat-context-mode-overrides-v1'
 *   - 监听：onModePromptsChange(cb) — 触发 prompt-manager 重画
 *
 * API:
 *   - getCurrentMode() => 'chat' | 'voice' | 'video' | 'game'
 *   - setMode(mode, opts?)                切换模式(由 call-manager / game-selector 调)
 *   - forceMode(mode)                     强制切换并重画
 *   - onModeChange(cb) => off             订阅模式变化
 *   - getModePrompt(mode) => string
 *   - getModeDefinition(mode) => { key, label, desc, icon }
 *   - getModePromptsSnapshot() => { chat: str, voice: str, video: str, game: str }
 */

const MODES = {
    chat: {
        key: 'chat',
        label: '聊天',
        icon: '💬',
        desc: '普通文字聊天',
        promptText: `# 当前模式：普通聊天

你正在与用户进行普通文字聊天。请：
- 用自然的口吻回复
- 保持简短（1-3 句话）
- 不要描述「通话」「视频」等场景
- 可以使用 [发红包:金额:祝福] / [发位置:名称:地址] / [发图片:#颜色:#颜色:内容] 等卡片格式

- 使用 [打电话] / [视频通话] token 可以发起通话（但当前模式是聊天，请不要主动发起）`,
    },
    voice: {
        key: 'voice',
        label: '语音',
        icon: '📞',
        desc: '语音通话中',
        promptText: `# 当前模式：语音通话

你正在与用户进行语音通话。请：
- 用口语化的、简短的句子回复（每回合 1 句话，像真人打电话）
- 不要使用方括号格式（不发送红包/图片/位置等卡片）
- 不要描述"打字"或"发送消息"的视觉行为
- 回复结尾可以用语气词（嗯、啊、哦、哈哈、喂）
- 可以用 [结束通话] 主动结束当前通话
- 通话中发消息会被记录为 call_chat 类型（AI 主动发的文字会显示在通话界面）`,
    },
    video: {
        key: 'video',
        label: '视频',
        icon: '📹',
        desc: '视频通话中',
        promptText: `# 当前模式：视频通话

你正在与用户进行视频通话。请：
- 用口语化的、简短的句子回复（每回合 1 句话，像真人打视频）
- 不要使用方括号格式（不发送红包/图片等纯文字卡片）
- 不要描述"打字"或"发送消息"的视觉行为
- 可以描述周围环境（"我这边天气不错"等），但不要过度描述
- 可以用 [结束通话] 主动结束当前通话
- 通话中发消息会被记录为 call_chat 类型`,
    },
    game: {
        key: 'game',
        label: '游戏',
        icon: '🎮',
        desc: '打游戏模式',
        promptText: `# 当前模式：打游戏

你正在与用户一起玩游戏。请：
- 在游戏规则内回应用户的游戏动作
- 保持游戏的戏剧性和趣味性
- 可以在合理范围内自定义游戏规则,但保持公平
- 游戏相关消息使用 type='game' 标记
- 不要使用 [发红包]/[发图片] 等聊天卡片格式
- 退出游戏时给出清晰的「游戏结束」说明`,
    },
};

const STORAGE_KEY = 'xiaoting::chat-context-mode-overrides-v1';

class ContextMode {
    constructor() {
        // mode 是通话/游戏运行态，不跨刷新持久化；冷启动一定从普通聊天开始。
        this._currentMode = 'chat';
        this._listeners = new Set();
        // 4 段模式卡的提示词 overrides —— 全局共享，所有 AI 人设共用同一份
        this._overrides = this._loadOverrides();
        this._promptListeners = new Set();
    }

    _loadOverrides() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return {};
            const out = {};
            Object.keys(MODES).forEach((key) => {
                const value = parsed[key];
                if (typeof value === 'string' && value.trim()) out[key] = value;
            });
            return out;
        } catch (_) {
            return {};
        }
    }

    _persistOverrides() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this._overrides));
        } catch (_) {}
    }

    _emitPrompts() {
        this._promptListeners.forEach((cb) => {
            try { cb(); } catch (_) {}
        });
    }

    /** 读取当前模式（'chat' | 'voice' | 'video' | 'game'）。 */
    getCurrentMode() {
        return this._currentMode;
    }

    /** 切换模式（call-manager / game-selector / 私聊页调）。 */
    setMode(mode, opts = {}) {
        if (!MODES[mode]) return;
        const prev = this._currentMode;
        if (prev === mode) return;
        this._currentMode = mode;
        if (!opts.skipRendererRefresh) {
            try {
                if (typeof window.invalidateRendererCache === 'function') {
                    window.invalidateRendererCache('chat', null);
                }
            } catch (_) {}
            try {
                window.__appRendererBridge?.syncNow?.({ force: true });
            } catch (_) {}
        }
        if (!opts.silent) {
            this._emit({ prev, current: mode });
        }
    }

    /** 强制覆盖当前模式（不检查相等）。 */
    forceMode(mode) {
        if (!MODES[mode]) return;
        const prev = this._currentMode;
        this._currentMode = mode;
        try {
            if (typeof window.invalidateRendererCache === 'function') {
                window.invalidateRendererCache('chat', null);
            }
        } catch (_) {}
        try {
            window.__appRendererBridge?.syncNow?.({ force: true });
        } catch (_) {}
        this._emit({ prev, current: mode });
    }

    /** 订阅模式切换。 */
    onModeChange(cb) {
        if (typeof cb !== 'function') return () => {};
        this._listeners.add(cb);
        return () => this._listeners.delete(cb);
    }

    _emit(payload) {
        this._listeners.forEach((cb) => {
            try { cb(payload); } catch (_) {}
        });
    }

    /** 拿模式卡正文（override 优先，否则回落到默认）。 */
    getModePrompt(mode) {
        const override = this._overrides[mode];
        if (typeof override === 'string' && override.trim()) return override;
        return MODES[mode]?.promptText || '';
    }

    /** 拿指定模式的默认正文（忽略 override）。 */
    getDefaultModePrompt(mode) {
        return MODES[mode]?.promptText || '';
    }

    /**
     * 一次性写入 4 段。
     * @param {{chat?:string, voice?:string, video?:string, game?:string}} map
     */
    setModePromptOverrides(map = {}) {
        if (!map || typeof map !== 'object') return;
        let changed = false;
        Object.keys(MODES).forEach((key) => {
            const value = map[key];
            if (typeof value !== 'string') return;
            const trimmed = value;
            if (trimmed === (this._overrides[key] ?? '')) return;
            this._overrides[key] = trimmed;
            changed = true;
        });
        if (!changed) return;
        this._persistOverrides();
        this._emitPrompts();
        try {
            if (typeof window.invalidateRendererCache === 'function') {
                window.invalidateRendererCache('chat', null);
            }
        } catch (_) {}
        try {
            window.__appRendererBridge?.syncNow?.({ force: true });
        } catch (_) {}
    }

    /** 恢复某个模式到默认正文。 */
    resetModePromptOverride(mode) {
        if (!MODES[mode]) return;
        if (!(mode in this._overrides)) return;
        delete this._overrides[mode];
        this._persistOverrides();
        this._emitPrompts();
        try {
            if (typeof window.invalidateRendererCache === 'function') {
                window.invalidateRendererCache('chat', null);
            }
        } catch (_) {}
        try {
            window.__appRendererBridge?.syncNow?.({ force: true });
        } catch (_) {}
    }

    /** 4 段同时快照（供编辑模态层初始化用）。 */
    getModePromptsSnapshot() {
        const out = {};
        Object.keys(MODES).forEach((key) => {
            out[key] = this.getModePrompt(key);
        });
        return out;
    }

    /** 4 段是否被改过（用于恢复按钮可用性）。 */
    getModePromptOverrideMap() {
        return { ...this._overrides };
    }

    /** 订阅 mode 提示词变更。 */
    onModePromptsChange(cb) {
        if (typeof cb !== 'function') return () => {};
        this._promptListeners.add(cb);
        return () => this._promptListeners.delete(cb);
    }

    getModeDefinition(mode) {
        const item = MODES[mode];
        return item ? { key: item.key, label: item.label, icon: item.icon, desc: item.desc } : null;
    }

    /** 列出模式元数据。 */
    listModes() {
        return Object.values(MODES).map((m) => ({
            key: m.key,
            label: m.label,
            icon: m.icon,
            desc: m.desc,
        }));
    }

    /** 当前模式卡正文。 */
    getCurrentModePrompt() {
        return this.getModePrompt(this._currentMode);
    }
}

const contextMode = new ContextMode();
window.__chatContextMode = contextMode;

export default contextMode;
export { ContextMode, MODES };
