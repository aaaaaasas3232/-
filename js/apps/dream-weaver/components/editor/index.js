/**
 * 梦境编织 · 章节编辑器
 *
 * 顶栏 + 消息流 + 输入区 + 右侧抽屉。生成流程的编排也在这里。
 *
 * ── 生成流程 ──────────────────────────────────────────────────────
 *
 *   用户发送
 *     → 落一条 user 消息(recordOnly 模式落成 note)
 *     → 落一条空的 ai 消息,标 pending
 *     → 流式:每个 chunk 直接改那条消息的 content
 *     → 结束:清 pending、落盘、释放 AbortController
 *
 * ★ 整个过程**只碰 store,不碰 DOM**。这是「后台生成」能成立的原因:
 *   用户切到别的 tab 甚至别的 App,组件卸载了,生成任务照样在往 store 写;
 *   切回来 Vue 按当前 state 重画,内容完整。
 *
 *   原版的 `backgroundTaskQueue` 是把 DOM 回调排进队列,组件一卸载
 *   回调里的 `document.getElementById(...)` 就是 null,被 try/catch 吞掉,
 *   表现为「切出去再回来,刚生成的内容没了」。那不是队列的问题,
 *   是「业务逻辑直接操作 DOM」的问题。
 */

import * as store from '../../store.js';
import { SHARED_COMPONENTS } from '../shared.js';
import { DwToolbar } from './toolbar.js';
import { DwMessageList } from './message-list.js';
import { DwComposer } from './composer.js';
import { DwChapterNav } from './chapter-nav.js';
import { DwContextPanel } from './context-panel.js';
import { DwTimelinePanel } from './timeline-panel.js';
import { DwToolsPanel } from './tools-panel.js';
import * as ai from '../../services/ai-service.js';
import { resolveCharacterName } from '../../services/prompt-builder.js';
import { findById, truncate } from '../../utils.js';

export const DwEditor = {
    name: 'DwEditor',
    components: {
        ...SHARED_COMPONENTS,
        DwToolbar, DwMessageList, DwComposer, DwChapterNav,
        DwContextPanel, DwTimelinePanel, DwToolsPanel,
    },
    props: {
        app: { type: Object, required: true },
    },
    emits: ['close', 'notify'],
    data() {
        return { selectionBar: null, quickSettingsVisible: false };
    },
    computed: {
        state() { return store.getState(); },
        book() { return store.getOpenBook(); },
        chapter() { return store.getOpenChapter(); },
        orderedChapters() { return store.getOrderedChapters(); },
        library() { return this.state.library; },
        settings() { return this.state.library.settings; },
        display() { return this.state.library.settings.displaySettings; },
        rules() { return this.state.library.bubbleRules; },
        modes() { return store.getActiveModes(); },
        currentModeId() { return store.getCurrentMode()?.id || ''; },
        drawer() { return this.state.drawer; },
        generating() { return store.isGenerating(this.chapter?.id); },
    },
    watch: {
        /**
         * 换章就把消息流拉到底。
         *
         * 顶栏的齿轮直接调 `store.stepChapter`,不经过这个组件 ——
         * 所以不能在「点击处理函数」里滚,得盯着**结果**滚。
         * (盯状态而不是盯操作,这样目录点击、齿轮滑动、快捷键三条路径都只需要这一处。)
         */
        'chapter.id'() {
            this.scrollSoon(false);
        },
    },
    methods: {
        // ── 导航 ──────────────────────────────
        onBack() {
            this.$emit('close');
        },
        onOpenChapter(chapterId) {
            store.openChapter(chapterId);
            store.setDrawer(null);
        },
        onDrawer(panelId) {
            store.setDrawer(panelId);
        },

        // ── 滚动 ──────────────────────────────
        scrollSoon(smooth = true) {
            this.$nextTick(() => this.$refs.list?.scrollToBottom?.(smooth));
        },

        // ── 生成 ──────────────────────────────
        async onSend({ text, modeId }) {
            const chapter = this.chapter;
            if (!chapter) return;
            const mode = findById(this.library.inputModes, modeId) || store.getCurrentMode();

            // recordOnly 的模式(金句)落成 note:参与上下文,但不算正文字数
            store.addMessage(chapter.id, {
                role: mode?.recordOnly ? 'note' : 'user',
                content: text,
                modeId: mode?.id || '',
            });
            this.scrollSoon();

            await this.runGeneration({ kind: 'write', mode, input: text });
        },

        onStop() {
            if (!this.chapter) return;
            ai.abort(this.chapter.id);
            this.$emit('notify', '已停止,写出来的部分保留了');
        },

        /**
         * 跑一次生成并把结果落到一条消息上。
         *
         * @param {object} opts
         * @param {string} opts.kind         write / reroll / expand / summary / innerView / selection
         * @param {string} [opts.targetId]   要覆盖的既有消息 id(重 roll 用);不传则新建一条
         * @param {boolean} [opts.silent]    true 时不落消息,只把结果 return 出去(摘要用)
         */
        async runGeneration(opts = {}) {
            const chapter = this.chapter;
            const book = this.book;
            if (!chapter || !book) return null;
            if (store.isGenerating(chapter.id)) {
                this.$emit('notify', '这一章还在生成,等它跑完');
                return null;
            }

            const { kind = 'write', targetId = '', silent = false, payload = {}, mode } = opts;

            // 目标消息:重 roll 用原来那条,其余新建
            let target = targetId ? findById(chapter.messages, targetId) : null;
            if (!silent && !target) {
                target = store.addMessage(chapter.id, { role: 'ai', content: '', pending: true });
            } else if (target) {
                store.pushBranch(chapter.id, target.id);
                store.updateMessage(chapter.id, target.id, { content: '', pending: true, error: '' });
            }

            store.beginGenerating({ chapterId: chapter.id, messageId: target?.id, kind });
            const signal = ai.createAbort(chapter.id);
            const follow = this.$refs.list?.isNearBottom?.() !== false;

            let result;
            try {
                result = await ai.generate({
                    book,
                    orderedChapters: this.orderedChapters,
                    chapter,
                    library: this.library,
                    mode,
                    input: opts.input || '',
                    kind,
                    payload,
                    signal,
                    onChunk: (_delta, full) => {
                        if (!target) return;
                        store.updateMessage(chapter.id, target.id, { content: full, pending: true });
                        if (follow) this.$refs.list?.scrollToBottom?.(false);
                    },
                });
            } catch (err) {
                result = { ok: false, text: '', aborted: false, error: err?.message || String(err) };
            } finally {
                ai.releaseAbort(chapter.id);
                store.endGenerating();
            }

            if (silent) return result;
            if (!target) return result;

            if (result.aborted) {
                // 中断:保留已生成的部分。一个字都没有就把空消息删掉,不留空气泡。
                const kept = (result.text || '').trim();
                if (kept) {
                    store.updateMessage(chapter.id, target.id, { content: kept, pending: false, error: '' });
                    if (targetId) store.commitBranch(chapter.id, target.id, kept);
                } else {
                    store.removeMessage(chapter.id, target.id);
                }
                return result;
            }

            if (!result.ok) {
                store.updateMessage(chapter.id, target.id, { pending: false, error: result.error || '生成失败' });
                this.$emit('notify', result.error || '生成失败');
                return result;
            }

            store.updateMessage(chapter.id, target.id, { content: result.text, pending: false, error: '' });
            if (targetId) store.commitBranch(chapter.id, target.id, result.text);
            if (follow) this.scrollSoon();
            return result;
        },

        // ── 气泡操作 ──────────────────────────
        async onMessageAction({ action, messageId, segment }) {
            const chapter = this.chapter;
            const message = findById(chapter?.messages, messageId);
            if (!chapter || !message) return;

            switch (action) {
                case 'edit':
                    store.openModal('edit-message', {
                        chapterId: chapter.id,
                        messageId,
                        value: message.content,
                    });
                    break;

                case 'reroll':
                    await this.runGeneration({
                        kind: 'reroll',
                        targetId: messageId,
                        payload: { content: message.content },
                    });
                    break;

                case 'expand':
                    await this.runGeneration({
                        kind: 'expand',
                        targetId: messageId,
                        payload: { content: message.content },
                    });
                    break;

                case 'favorite': {
                    const on = store.toggleMessageFavorite(chapter.id, messageId);
                    this.$emit('notify', on ? '已收藏' : '已取消收藏');
                    break;
                }

                case 'copy':
                    await this.copyText(message.content);
                    break;

                case 'delete':
                    store.openModal('confirm', {
                        title: '删除这一段?',
                        message: truncate(message.content, 60),
                        danger: true,
                        onConfirm: () => store.removeMessage(chapter.id, messageId),
                    });
                    break;

                // ── 「更多」里展开出来的四个 ──────────

                case 'bind-timeline':
                    store.openModal('timeline-event', {
                        bookId: this.book.id,
                        mode: 'create',
                        event: {
                            title: truncate(message.content, 30),
                            time: this.book.worldTime || '',
                            bindType: 'chapter',
                            chapterId: chapter.id,
                            messageId,
                        },
                    });
                    break;

                case 'format':
                    // 「格式化选择」= 提示用户去选中一段。选中后选区工具条会自己冒出来。
                    this.$emit('notify', '用手指或鼠标选中一段文字,下面会出来操作条');
                    break;

                case 'node':
                    // 建分支点:把当前内容存成一个候选,之后重 roll 就能在版本间来回切
                    store.pushBranch(chapter.id, messageId);
                    this.$emit('notify', '已建分支点,重新生成后可以切回这一版');
                    break;

                case 'finale':
                    store.openModal('finale', { bookId: this.book.id });
                    break;

                case 'summary': {
                    const result = await this.runGeneration({
                        kind: 'summary',
                        silent: true,
                        payload: { content: message.content },
                    });
                    if (result?.ok) {
                        store.updateChapter(chapter.id, { summary: result.text, useSummary: true });
                        this.$emit('notify', '梗概已生成,已加入前情提要');
                    } else if (result && !result.aborted) {
                        this.$emit('notify', result.error || '梗概生成失败');
                    }
                    break;
                }

                case 'open-mark':
                    if (segment?.id) {
                        store.openModal(segment.type === 'char' ? 'character-edit' : 'location-edit', {
                            bookId: this.book.id,
                            id: segment.id,
                        });
                    }
                    break;

                default:
                    break;
            }
        },

        // ── 选区 ──────────────────────────────
        onSelectText(selection) {
            store.setSelection(selection);
            this.selectionBar = selection;
        },
        clearSelection() {
            this.selectionBar = null;
            store.setSelection(null);
            window.getSelection?.()?.removeAllRanges?.();
        },
        async onSelectionAction(action) {
            const selection = this.selectionBar;
            if (!selection) return;
            const { text, messageId } = selection;
            this.clearSelection();

            switch (action) {
                case 'character':
                    store.openModal('character-edit', { bookId: this.book.id, preset: { name: text } });
                    break;
                case 'location':
                    store.openModal('location-edit', { bookId: this.book.id, preset: { name: text } });
                    break;
                case 'rewrite':
                    store.openModal('rewrite-selection', {
                        text,
                        // ★ 回调必须在这儿给 —— 弹窗只负责收集「想怎么改」,
                        //   真正跑生成要用编辑器的上下文(书 / 章 / 库),弹窗拿不到
                        onRun: (hint) => this.rewriteSelection({ messageId, text, hint }),
                    });
                    break;
                case 'inspiration':
                    store.addInspiration(text);
                    this.$emit('notify', '已存进灵感');
                    break;
                case 'copy':
                    await this.copyText(text);
                    break;
                default:
                    break;
            }
        },

        /**
         * 重写选中的一句:把结果替换回原消息里的那一段,而不是新加一条。
         *
         * 原版这里调的 `showEditSelectionModal` **根本不存在**(在 8962 行被调用,
         * 全文没有定义)—— 点「编辑」必崩。这是重写时顺手补上的。
         */
        async rewriteSelection({ messageId, text, hint }) {
            const chapter = this.chapter;
            const message = findById(chapter?.messages, messageId);
            if (!message) return;

            const result = await this.runGeneration({
                kind: 'selection',
                silent: true,
                payload: { content: text, hint },
            });
            if (!result?.ok) {
                if (result && !result.aborted) this.$emit('notify', result.error || '重写失败');
                return;
            }
            // 只替换选中的那一段,保留前后文
            store.pushBranch(chapter.id, messageId);
            const next = message.content.replace(text, result.text.trim());
            store.commitBranch(chapter.id, messageId, next);
            this.$emit('notify', '已替换');
        },

        // ── 工具面板 ──────────────────────────
        async onRunTool({ kind, ...payload }) {
            const chapter = this.chapter;
            if (!chapter) return;

            const bodyText = () => chapter.messages
                .filter((m) => m.role !== 'note')
                .map((m) => m.content)
                .join('\n\n');

            if (kind === 'summary') {
                const content = bodyText();
                if (!content.trim()) {
                    this.$emit('notify', '这一章还没有内容');
                    return;
                }
                const result = await this.runGeneration({ kind: 'summary', silent: true, payload: { content } });
                if (result?.ok) {
                    store.updateChapter(chapter.id, { summary: result.text, useSummary: true });
                    this.$emit('notify', '梗概已生成,已加入前情提要');
                } else if (result && !result.aborted) {
                    this.$emit('notify', result.error || '梗概生成失败');
                }
                return;
            }

            if (kind === 'innerView') {
                const content = bodyText();
                if (!content.trim()) {
                    this.$emit('notify', '这一章还没有内容');
                    return;
                }
                // 先选角色再生成 —— 回调在这里给,弹窗只负责选人
                store.openModal('pick-character', {
                    bookId: this.book.id,
                    title: '改写成谁的内心视角',
                    onPick: async (character) => {
                        // mask / ai 类型的角色 name 字段可能是空的,名字要从人设 SDK 解析
                        const name = resolveCharacterName(character) || '主角';
                        const result = await this.runGeneration({
                            kind: 'innerView',
                            silent: true,
                            payload: { content, characterName: name },
                        });
                        if (!result?.ok) {
                            if (result && !result.aborted) this.$emit('notify', result.error || '改写失败');
                            return;
                        }
                        const next = await store.addChapter({ title: `${chapter.title} · ${name}视角` });
                        if (!next) return;
                        store.updateChapter(next.id, { isInnerView: true, povCharacterId: character.id });
                        store.addMessage(next.id, { role: 'ai', content: result.text });
                        this.$emit('notify', `已生成「${name}」视角的一章`);
                    },
                });
                return;
            }

            await this.runGeneration({ kind, ...payload });
        },

        async copyText(text) {
            try {
                await navigator.clipboard.writeText(String(text || ''));
                this.$emit('notify', '已复制');
            } catch (_) {
                this.$emit('notify', '复制失败,可能是浏览器不允许');
            }
        },

        onUpdateSettings(patch) {
            store.updateSettings(patch);
        },
        onChangeMode(modeId) {
            store.setInputMode(modeId);
        },
        onManageModes() {
            store.openModal('input-modes');
        },
    },
    mounted() {
        this.scrollSoon(false);
        // 「更多操作」里的「快捷设置条」开关。走事件是因为触发点在底部抽屉里,
        // 而状态在编辑器上 —— 中间隔着 store 的 sheet 状态机,没法直接 emit。
        this._onToggleQuick = () => { this.quickSettingsVisible = !this.quickSettingsVisible; };
        window.addEventListener('dream-weaver:toggle-quick-settings', this._onToggleQuick);

        // ★ IF 线的 open 监听搬到了根组件（root.js）：它现在是全屏页，
        //   而这个组件只在「打开了某本书」时才存在 —— 监听挂在这里的话，
        //   在书架页触发这个事件就没人接（典型的「点了没反应」）。
    },
    beforeUnmount() {
        window.removeEventListener('dream-weaver:toggle-quick-settings', this._onToggleQuick);
        // 离开编辑器不停止生成 —— 后台生成就是靠这一点。
        // 但要把防抖里挂着的写入立刻落盘,否则最后几秒的内容会丢。
        void store.flushPersist();
    },
    template: `
        <div class="dw-editor" :class="{ 'has-drawer': !!drawer }">
            <!-- 顶部工具栏(1:1 复原原版 .dw-enhanced-toolbar) -->
            <DwToolbar
                v-if="book"
                :book="book"
                :chapter="chapter"
                :ordered-chapters="orderedChapters"
                :settings="settings"
                :quick-settings-visible="quickSettingsVisible"
                @back="onBack"
                @notify="$emit('notify', $event)"
            />

            <!-- 正文 -->
            <DwMessageList
                v-if="chapter"
                ref="list"
                :book="book"
                :chapter="chapter"
                :display="display"
                :rules="rules"
                @action="onMessageAction"
                @select-text="onSelectText"
            />
            <DwSpinner v-else label="正在打开…" />

            <!-- 选区工具条 -->
            <div v-if="selectionBar" class="dw-selection-bar">
                <span class="dw-selection-text">「{{ selectionBar.text.slice(0, 14) }}{{ selectionBar.text.length > 14 ? '…' : '' }}」</span>
                <button type="button" class="dw-selection-btn" @click="onSelectionAction('character')">建角色</button>
                <button type="button" class="dw-selection-btn" @click="onSelectionAction('location')">建地点</button>
                <button type="button" class="dw-selection-btn" @click="onSelectionAction('rewrite')">重写</button>
                <button type="button" class="dw-selection-btn" @click="onSelectionAction('inspiration')">存灵感</button>
                <button type="button" class="dw-selection-btn" @click="onSelectionAction('copy')">复制</button>
                <button type="button" class="dw-selection-btn dw-selection-btn--close" aria-label="关闭" @click="clearSelection">×</button>
            </div>

            <!-- 输入 -->
            <DwComposer
                :modes="modes"
                :current-mode-id="currentModeId"
                :settings="settings"
                :generating="generating"
                @send="onSend"
                @stop="onStop"
                @change-mode="onChangeMode"
                @manage-modes="onManageModes"
                @update-settings="onUpdateSettings"
            />

            <!-- IF 线工作台已经升级成全屏详情页，挂在根组件上（store.page = 'ifline'） -->

            <!-- 抽屉 -->
            <div v-if="drawer" class="dw-drawer-scrim" @click="onDrawer(null)"></div>
            <aside v-if="drawer" class="dw-drawer" role="dialog" :aria-label="drawer">
                <DwChapterNav
                    v-if="drawer === 'chapters'"
                    :book="book"
                    :chapters="state.chapters"
                    :open-chapter-id="chapter ? chapter.id : ''"
                    @open-chapter="onOpenChapter"
                />
                <DwContextPanel
                    v-else-if="drawer === 'context'"
                    :book="book"
                    :chapter="chapter"
                    :ordered-chapters="orderedChapters"
                    :library="library"
                    :mode="modes.find(m => m.id === currentModeId) || null"
                    @notify="$emit('notify', $event)"
                />
                <DwTimelinePanel
                    v-else-if="drawer === 'timeline'"
                    :book="book"
                    :chapters="state.chapters"
                    @notify="$emit('notify', $event)"
                />
                <DwToolsPanel
                    v-else-if="drawer === 'tools'"
                    :book="book"
                    :chapter="chapter"
                    :library="library"
                    :busy="generating"
                    @run-tool="onRunTool"
                    @notify="$emit('notify', $event)"
                />
            </aside>
        </div>
    `,
};

export default DwEditor;
