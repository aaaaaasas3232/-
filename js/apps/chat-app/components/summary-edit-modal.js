/**
 * chat-app / 概要编辑/确认弹窗 (v0.61.3 → v0.66)
 *
 *   用途:用户选完日期范围 / 故事会话后,弹这个弹窗让 AI 生成并确认概要。
 *
 *   v0.61 占位版(历史):
 *     - 初始 title/content 由调用方算好(来自 buildPlaceholderFromMessages)
 *     - 用户可改标题 + 改正文
 *     - 「重 Roll」按钮:重新调用占位生成
 *
 *   v0.66 重大重构:
 *     - textarea 初始为空,等 AI 生成(不再是预填 prompt 模板)
 *     - 主按钮根据 textarea 是否有内容动态变化:
 *       · 无内容 → 「生成概要」→ 调用 AI → 结果写入 textarea
 *       · 有内容 → 「保存概要」→ 保存到 SDK
 *     - 新增「人设信息」可折叠区,展示 AI 和用户的具体人设数据
 *     - props: aiPersonaSummary / userPersonaSummary
 *     - max-height 从 86vh → 60vh
 *
 *   props:
 *     mode              'calendar' | 'story'
 *     initialTitle      string
 *     initialContent    string  (★ v0.66:始终为空,AI 生成后才填入)
 *     dateRange         { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
 *     messageCount      number
 *     defaultAsPrompt   boolean
 *     aiPersonaSummary  string  ★ v0.66
 *     userPersonaSummary string ★ v0.66
 *     toolkit           Object  ★ v0.66 (optional, for future use)
 *
 *   events:
 *     close()
 *     save({ title, content, asPrompt, mode, dateRange, messageCount })
 *     generate({ title, mode, dateRange, messageCount })  ★ v0.66
 *     reroll()   用户点了「重新生成」
 */

// ★ v0.66 模块级:保存当前弹窗实例的引用到 window 上,
//   让外部 onGenerate 回调(在 index.js 里)能调用实例的方法。
//   用 window 而不是 export,是因为 import 路径在 chat-modal-registry → summary-edit-modal 时
//   ESM 模块实例是同一份,但跨 ESM 子模块访问容易出 ReferenceError。
function _setCurrentSummaryEditInstance(instance) {
    if (typeof window !== 'undefined') {
        window.__currentSummaryEditModal = instance;
    }
}
function _getCurrentSummaryEditInstance() {
    if (typeof window === 'undefined') return null;
    return window.__currentSummaryEditModal || null;
}

const SummaryEditModal = {
    name: 'SummaryEditModal',
    props: {
        mode: { type: String, default: 'calendar' },
        initialTitle: { type: String, default: '聊天概要' },
        initialContent: { type: String, default: '' },
        dateRange: { type: Object, default: () => ({ start: '', end: '' }) },
        messageCount: { type: Number, default: 0 },
        defaultAsPrompt: { type: Boolean, default: false },
        // ★ v0.66 人设信息
        aiPersonaSummary: { type: String, default: '' },
        userPersonaSummary: { type: String, default: '' },
        // ★ v0.66 toolkit:用于在组件内直接调 island notify
        toolkit: { type: Object, default: null },
    },
    emits: ['close', 'save', 'generate', 'reroll'],
    mounted() {
        // ★ v0.66:注册当前实例,让外部回调(onGenerate)能调用组件方法
        _setCurrentSummaryEditInstance(this);
    },
    beforeUnmount() {
        const cur = _getCurrentSummaryEditInstance();
        if (cur === this) _setCurrentSummaryEditInstance(null);
    },
    data() {
        return {
            title: String(this.initialTitle || ''),
            content: String(this.initialContent || ''),
            asPrompt: !!this.defaultAsPrompt,
            titleMax: 60,
            contentMax: 4000,
            isSaving: false,
            isGenerating: false,  // ★ v0.66 AI 生成中状态
            errorMsg: '',         // ★ v0.66 内联错误提示
            // ★ v0.66 人设折叠区默认展开
            personaOpen: true,
            placeholder: this.mode === 'story'
                ? '把故事中所有重要剧情提炼成一段概要...'
                : '把这段日期范围内的聊天要点提炼成一段概要...',
        };
    },
        computed: {
            modalTitle() {
                return this.mode === 'story' ? '故事概要' : '概要内容';
            },
            titleCount() { return this.title.length; },
            contentCount() { return this.content.length; },
            canSave() {
                // ★ v0.66:只需要标题即可触发主按钮(无内容时触发生成,有内容时触发保存)
                return this.title.trim().length > 0 && !this.isSaving && !this.isGenerating;
            },
            hasContent() {
                // ★ v0.66:textarea 是否有内容
                return this.content.trim().length > 0;
            },
            dateRangeText() {
                const r = this.dateRange || {};
                if (r.start && r.end && r.start !== r.end) {
                    return `${r.start} ~ ${r.end}`;
                }
                return r.start || r.end || '';
            },
        },
    methods: {
        onSave() {
            if (!this.canSave) return;
            // ★ v0.66:根据是否有内容决定行为:
            //   - 有内容 → 保存(emit save)
            //   - 无内容 → 调用 AI 生成(emit generate)
            if (this.hasContent) {
                this.isSaving = true;
                this.$emit('save', {
                    title: this.title.trim(),
                    content: this.content,
                    asPrompt: !!this.asPrompt,
                    mode: this.mode,
                    dateRange: { ...(this.dateRange || {}) },
                    messageCount: Number(this.messageCount) || 0,
                });
                setTimeout(() => {
                    this.isSaving = false;
                    this.$emit('close');
                }, 200);
            } else {
                // 空内容 → 触发生成
                this.$emit('generate', {
                    title: this.title.trim(),
                    mode: this.mode,
                    dateRange: { ...(this.dateRange || {}) },
                    messageCount: Number(this.messageCount) || 0,
                });
            }
        },
        // ★ v0.66:由 onSave 里的 hasContent=false 分支 emit 触发,
        //   调用方(chat-app)负责调 AI 生成后把 content 写回 textarea。
        //   成功时调用 onGenerateSuccess({ content }) 把内容写进来;
        //   失败时调用 onGenerateError(errorMsg) 显示错误。
        onGenerateSuccess({ content = '', title = '' } = {}) {
            this.isGenerating = false;
            if (content) this.content = content;
            if (title && !this.title.trim()) this.title = title;
        },
        onGenerateError(msg = '生成失败') {
            this.isGenerating = false;
            this.errorMsg = msg;
            setTimeout(() => { this.errorMsg = ''; }, 4000);
        },
        onCancel() { this.$emit('close'); },
        onReroll() {
            // 重 Roll = 重新生成:清空 textarea + 触发生成
            this.content = '';
            this.$emit('generate', {
                title: this.title.trim() || this.initialTitle || '聊天概要',
                mode: this.mode,
                dateRange: { ...(this.dateRange || {}) },
                messageCount: Number(this.messageCount) || 0,
            });
        },
    },
    template: `
        <div class="summary-edit-modal-overlay" @click.self="onCancel">
            <div class="summary-edit-modal">
                <div class="summary-edit-modal-header">
                    <div class="summary-edit-modal-title">{{ modalTitle }}</div>
                    <div class="summary-edit-modal-subtitle" v-if="dateRangeText">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <span>{{ dateRangeText }} · {{ messageCount }} 条消息</span>
                    </div>
                    <button class="summary-edit-modal-close" aria-label="关闭" @click="onCancel">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>

                <div class="summary-edit-modal-hint">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                    <span>{{ hasContent ? '请确认或修改 AI 生成的概要内容,然后保存。' : '点击「生成概要」让 AI 根据人设和对话内容生成概要。下方可折叠区域展示了双方人设供参考。' }}</span>
                </div>

                <!-- ★ v0.66 错误提示 -->
                <div class="summary-edit-error" v-if="errorMsg">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <span>{{ errorMsg }}</span>
                </div>

                <!-- ★ v0.66 人设信息折叠区 -->
                <div class="summary-edit-persona-section" v-if="aiPersonaSummary || userPersonaSummary">
                    <button type="button" class="summary-edit-persona-toggle" @click="personaOpen = !personaOpen">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="8" r="4"/>
                            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                        </svg>
                        <span>人设信息</span>
                        <svg class="summary-edit-persona-chevron" :class="{ open: personaOpen }"
                            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                    </button>
                    <div class="summary-edit-persona-body" v-show="personaOpen">
                        <div class="summary-edit-persona-row" v-if="aiPersonaSummary">
                            <div class="summary-edit-persona-label">🤖 AI 人设</div>
                            <div class="summary-edit-persona-content">{{ aiPersonaSummary }}</div>
                        </div>
                        <div class="summary-edit-persona-row" v-if="userPersonaSummary">
                            <div class="summary-edit-persona-label">👤 用户人设</div>
                            <div class="summary-edit-persona-content">{{ userPersonaSummary }}</div>
                        </div>
                    </div>
                </div>

                <div class="summary-edit-modal-field">
                    <label class="summary-edit-modal-label">标题 <span class="summary-edit-modal-required">*</span></label>
                    <input type="text" class="summary-edit-modal-input" v-model="title"
                        :maxlength="titleMax" placeholder="例如:本周情感变化概要"/>
                    <div class="summary-edit-modal-counter">{{ titleCount }} / {{ titleMax }}</div>
                </div>

                <div class="summary-edit-modal-field">
                    <label class="summary-edit-modal-label">概要内容</label>
                    <textarea class="summary-edit-modal-textarea" v-model="content"
                        :maxlength="contentMax"
                        :placeholder="placeholder"
                        rows="5"></textarea>
                    <div class="summary-edit-modal-counter">{{ contentCount }} / {{ contentMax }}</div>
                </div>

                <div class="summary-edit-modal-toggle-row">
                    <div class="summary-edit-modal-toggle-text">
                        <div class="summary-edit-modal-toggle-title">保存为回复提示词</div>
                        <div class="summary-edit-modal-toggle-desc">启用后会注入到 AI 的 system prompt</div>
                    </div>
                    <button type="button" class="summary-edit-modal-toggle"
                        :class="{ 'on': asPrompt }"
                        :aria-pressed="asPrompt"
                        @click="asPrompt = !asPrompt">
                        <span class="summary-edit-modal-toggle-track">
                            <span class="summary-edit-modal-toggle-thumb"></span>
                        </span>
                    </button>
                </div>

                <div class="summary-edit-modal-actions">
                    <button type="button" class="summary-edit-btn summary-edit-btn-reroll"
                        :disabled="isGenerating || isSaving"
                        @click="onReroll">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <polyline points="1 20 1 14 7 14"></polyline>
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                        </svg>
                        <span>重新生成</span>
                    </button>
                    <div class="summary-edit-modal-actions-right">
                        <button type="button" class="summary-edit-btn summary-edit-btn-cancel" @click="onCancel">取消</button>
                        <button type="button" class="summary-edit-btn summary-edit-btn-save"
                            :class="{ saving: isSaving, generating: isGenerating }"
                            :disabled="!canSave"
                            @click="onSave">
                            <!-- ★ v0.66:根据 hasContent 决定按钮文案 -->
                            <span v-if="isGenerating">
                                <svg class="summary-edit-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10" stroke-opacity="0.3"/>
                                    <path d="M12 2a10 10 0 0 1 10 10"/>
                                </svg>
                                生成中...
                            </span>
                            <span v-else-if="!hasContent">生成概要</span>
                            <span v-else-if="!isSaving">保存概要</span>
                            <span v-else>保存中...</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,
};

export default SummaryEditModal;
export { SummaryEditModal, _getCurrentSummaryEditInstance };