/**
 * 梦境编织 · 上下文面板
 *
 * ★ 这是整个重写里最重要的一屏。
 *
 * 原版有个「上下文管理」弹窗,分段展示 + token 估算 + 复制全文,看起来很完整 ——
 * 但它调的是 `buildFullContextPreview()`,而真正发送走的是 `buildPrompt()`,
 * **两个函数拼出来的东西不一样**。用户在这里关掉「世界观」,
 * 保存,发送,世界观照样发出去了。这个面板从头到尾都在骗人。
 *
 * 现在:
 *
 *   buildPrompt() ──┬── result.text   → 发给 AI
 *                   └── result.parts  → 这个面板渲染
 *
 * 同一次调用的两个返回字段。**面板上看到什么,AI 就收到什么**,
 * 不需要任何「保持同步」的纪律,它们物理上就是一份东西。
 *
 * UI 用的是框架层的 `ContextPreview` 组件(`src/core/components/context-preview.js`),
 * murmur 后续也能换成同一个 —— 这就是用户说的「拼接 pre 的过程抽成组件」。
 */

import * as store from '../../store.js';
import { SHARED_COMPONENTS } from '../shared.js';
import { ContextPreview } from '@/src/core/components/context-preview.js';
import { buildPrompt, buildUserTurn } from '../../services/prompt-builder.js';
import { listApiRefs, resolveApiRef } from '../../services/ai-service.js';

export const DwContextPanel = {
    name: 'DwContextPanel',
    components: { ...SHARED_COMPONENTS, ContextPreview },
    props: {
        book: { type: Object, required: true },
        chapter: { type: Object, default: null },
        orderedChapters: { type: Array, default: () => [] },
        library: { type: Object, required: true },
        mode: { type: Object, default: null },
    },
    data() {
        return { showUserTurn: false, draftInput: '' };
    },
    computed: {
        /**
         * 注意这是 computed —— 依赖 book/chapter/library 的任何变动都会重算。
         * 用户在面板里点一下开关,这里立刻重算,底下的 token 数字同步变。
         */
        result() {
            return buildPrompt({
                book: this.book,
                orderedChapters: this.orderedChapters,
                chapter: this.chapter,
                library: this.library,
                mode: this.mode,
            });
        },
        userTurnPreview() {
            return buildUserTurn({
                mode: this.mode,
                input: this.draftInput || '(这里会替换成你输入的内容)',
                wordRange: this.library.settings.defaultWordRange,
            });
        },
        apiRefs() {
            return listApiRefs();
        },
        currentApiRef() {
            return resolveApiRef(this.book);
        },
        currentApiLabel() {
            const ref = this.currentApiRef;
            if (!ref) return '未配置';
            const hit = this.apiRefs.find((r) => r.type === ref.type && r.refId === ref.refId);
            if (!hit) return '未配置';
            return this.book.apiRef?.refId ? hit.label : `${hit.label}(继承自人设)`;
        },
        budget() {
            return Number(this.library.settings.contextTokenBudget) || 0;
        },
    },
    methods: {
        onToggle(sectionId, nextActive) {
            store.setContextSection(this.book.id, sectionId, nextActive);
        },
        onCopy() {
            this.notify('已复制完整上下文');
        },
        onPickApi() {
            store.openSheet('api-picker', { bookId: this.book.id });
        },
        setBudget(value) {
            store.updateSettings({ contextTokenBudget: Math.max(0, Number(value) || 0) });
        },
        notify(message) {
            this.$emit('notify', message);
        },
    },
    emits: ['notify'],
    template: `
        <div class="dw-context-panel">
            <header class="dw-panel-head">
                <div>
                    <h3 class="dw-panel-title">上下文</h3>
                    <p class="dw-panel-sub">这里显示的,就是这次发给 AI 的全部内容</p>
                </div>
            </header>

            <DwRow
                label="使用的 API"
                :value="currentApiLabel"
                icon-name="zap"
                chevron
                @click="onPickApi"
            />

            <DwField label="Token 预算" hint="0 = 不限制。设了之后超出会红色告警,但不会自动截断。">
                <DwInput
                    type="number"
                    :model-value="budget"
                    placeholder="0"
                    @update:model-value="setBudget"
                />
            </DwField>

            <ContextPreview
                :result="result"
                title="将要发送的内容"
                budget-hint="包含设定与正文,不含你这一轮的输入"
                @toggle="onToggle"
                @copy="onCopy"
            />

            <DwSection title="这一轮的指令" subtitle="按当前模式的模板生成,和上面的设定分开发送" collapsible :default-open="false">
                <DwField label="试写一句看看效果">
                    <DwInput v-model="draftInput" placeholder="比如:他终于推开了那扇门" />
                </DwField>
                <pre class="dw-context-userturn">{{ userTurnPreview }}</pre>
            </DwSection>
        </div>
    `,
};

export default DwContextPanel;
