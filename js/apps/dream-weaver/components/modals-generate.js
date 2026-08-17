/**
 * 梦境编织 · 衍生创作弹窗
 *
 * 两个:
 *   - `DwGenerateModal`  小剧场 / 读者评论 / 杀青梗 的结果(边生成边显示)
 *
 * IF 线不在这里 —— 它是个要长期开着的工作台(`components/ifline-panel.js`),
 * 不是「填个参数点生成」的一次性弹窗。
 *
 * 两个都遵守同一条:**生成期间可以停,停了保留已经写出来的部分**。
 * 原版这类弹窗生成中只能干等,想停只能关弹窗,一关内容全没。
 */

import { DwModal } from './dw-modal.js';
import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import { runGenerator, describeGenerator } from '../services/generators.js';
import { createAbort, abort, releaseAbort } from '../services/ai-service.js';

const BASE = { DwModal, ...SHARED_COMPONENTS };

/** 生成任务用的假章节 id —— 衍生内容不属于任何一章,但 AbortController 按 id 存 */
const GEN_SCOPE = '__generator__';

export const DwGenerateModal = {
    name: 'DwGenerateModal',
    components: BASE,
    props: {
        payload: { type: Object, default: () => ({}) },
    },
    emits: ['close', 'notify'],
    data() {
        return { text: '', running: false, error: '', done: false };
    },
    computed: {
        state() { return store.getState(); },
        title() { return describeGenerator(this.payload.group, this.payload.item); },
        canSave() { return this.done && this.text.trim().length > 0; },
    },
    methods: {
        async run() {
            const book = store.getOpenBook();
            if (!book) { this.error = '书没打开'; return; }

            this.running = true;
            this.error = '';
            this.done = false;
            this.text = '';

            const signal = createAbort(GEN_SCOPE);
            let result;
            try {
                result = await runGenerator({
                    group: this.payload.group,
                    item: this.payload.item,
                    book,
                    orderedChapters: store.getOrderedChapters(),
                    chapter: store.getOpenChapter(),
                    library: this.state.library,
                    signal,
                    onChunk: (_delta, full) => { this.text = full; },
                });
            } catch (err) {
                result = { ok: false, text: '', aborted: false, error: err?.message || String(err) };
            } finally {
                releaseAbort(GEN_SCOPE);
                this.running = false;
            }

            if (result.aborted) {
                this.text = result.text || this.text;
                this.done = Boolean(this.text.trim());
                return;
            }
            if (!result.ok) {
                this.error = result.error || '生成失败';
                return;
            }
            this.text = result.text;
            this.done = true;
        },
        onStop() {
            abort(GEN_SCOPE);
        },
        onSave() {
            store.addGeneratedRecord({
                group: this.payload.group,
                title: this.title,
                content: this.text,
            });
            this.$emit('notify', '已存进生成历史');
            this.$emit('close');
        },
        async onCopy() {
            try {
                await navigator.clipboard.writeText(this.text);
                this.$emit('notify', '已复制');
            } catch (_) {
                this.$emit('notify', '复制失败');
            }
        },
        onClose() {
            // 关弹窗要停掉在跑的请求,否则它会继续消耗额度还没人接收结果
            if (this.running) abort(GEN_SCOPE);
            this.$emit('close');
        },
    },
    mounted() {
        void this.run();
    },
    beforeUnmount() {
        if (this.running) abort(GEN_SCOPE);
    },
    template: `
        <DwModal class="dw-generate-modal" :title="title" max-width="340px" @close="onClose">
            <div class="dw-generate-body">
                <p v-if="error" class="dw-modal-error">{{ error }}</p>
                <DwSpinner v-else-if="running && !text" label="正在写…" />
                <pre v-else class="dw-generate-text">{{ text || '(没有内容)' }}</pre>
                <span v-if="running && text" class="dw-msg-caret" aria-hidden="true"></span>
            </div>

            <template #footer>
                <button v-if="running" type="button" class="ac-btn ac-btn-danger" @click="onStop">停止</button>
                <template v-else>
                    <button type="button" class="ac-btn ac-btn-secondary" @click="onClose">关闭</button>
                    <button type="button" class="ac-btn ac-btn-secondary" :disabled="!canSave" @click="onCopy">复制</button>
                    <button type="button" class="ac-btn ac-btn-secondary" @click="run">再来一次</button>
                    <button type="button" class="ac-btn ac-btn-primary" :disabled="!canSave" @click="onSave">保存</button>
                </template>
            </template>
        </DwModal>
    `,
};

export const GENERATE_MODAL_COMPONENTS = { DwGenerateModal };
