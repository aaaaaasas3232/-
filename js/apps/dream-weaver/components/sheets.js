/**
 * 梦境编织 · 底部抽屉
 *
 * 用于「点了某个东西之后弹出来的一串操作」——比弹窗轻,拇指够得到。
 *
 * 原版这类菜单是 `showBookOptionsMenu` / `showChapterMenu` / `showMessageMoreOptions` /
 * `showMoreOptionsModal` 等七八个函数,每个都自己拼一遍遮罩 + 定位 + 关闭逻辑。
 * 这里统一成一个 `DwSheet` 外壳 + 一组 `DwMenuItem`。
 */

import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import { THEATER_TYPES, COMMENT_TYPES } from '../constants.js';
import { listApiRefs } from '../services/ai-service.js';
import { findById, truncate } from '../utils.js';

export const DwSheets = {
    name: 'DwSheets',
    components: SHARED_COMPONENTS,
    props: {
        app: { type: Object, required: true },
    },
    emits: ['notify'],
    computed: {
        state() { return store.getState(); },
        sheet() { return this.state.sheet; },
        type() { return this.sheet?.type || ''; },
        payload() { return this.sheet?.payload || {}; },

        book() {
            return findById(this.state.books, this.payload.bookId) || store.getOpenBook();
        },
        chapter() {
            return findById(this.state.chapters, this.payload.chapterId);
        },
        message() {
            return findById(this.chapter?.messages, this.payload.messageId);
        },
        apiRefs() { return listApiRefs(); },
        currentApiRefId() {
            const ref = this.book?.apiRef;
            return ref ? `${ref.type}::${ref.refId}` : '';
        },
        generatorList() {
            if (this.payload.group === 'theater') return THEATER_TYPES;
            if (this.payload.group === 'comment') return COMMENT_TYPES;
            // 杀青梗不在这儿 —— 它有自己的卡片面板(`modals-finale.js`),不是选一个 prompt 就完事
            return [];
        },
        generatorTitle() {
            return { theater: '小剧场', comment: '读者评论' }[this.payload.group] || '选一个';
        },

        /**
         * 「更多操作」菜单 —— 照抄原版 `showMoreOptionsModal`(13688)的条目、顺序和右侧摘要。
         * 原版是 11 项;这里保留全部能落地的项,并补上目录/上下文/时间线三个抽屉入口
         * (原版那三个在别的地方,但既然工具栏收窄了,统一收到这儿更好找)。
         */
        moreOptions() {
            const state = this.state;
            const book = this.book;
            if (!book) return [];
            const library = state.library;
            const activeModes = library.activeModeIds.length;
            const rules = library.bubbleRules.filter((r) => r.enabled !== false).length;
            const modeLabel = library.settings.generateMode === 'chapter' ? '整章' : '文段';

            return [
                { id: 'drawer:chapters', icon: 'list', label: '目录', value: `${state.chapters.length} 章` },
                { id: 'drawer:context', icon: 'layers', label: '上下文管理', value: '看这次发什么' },
                { id: 'drawer:timeline', icon: 'timeline', label: '时间线', value: `${(book.timelineEvents || []).length} 条` },
                { id: 'drawer:tools', icon: 'sparkle', label: '衍生创作', value: 'IF线 / 小剧场 / 杀青梗' },
                { id: 'quick-settings', icon: 'settings', label: '快捷设置条', value: this.quickOn ? '已展开' : '已收起' },
                { id: 'if-line-panel', icon: 'magic', label: 'IF 线工作台', value: `${(book.ifLineArchives || []).length} 条存档` },
                { id: 'chapter-info', icon: 'note', label: '章节信息', value: '梗概 / 视角 / 上下文' },
                { id: 'finale', icon: 'tv', label: '杀青梗', value: '社交模拟' },
                { id: 'background-upload', icon: 'image', label: '聊天背景', value: book.customBackground ? '本书已设置' : (library.settings.customBackground ? '全局设置' : '默认') },
                { id: 'generate-mode', icon: 'book', label: '生成模式', value: modeLabel },
                { id: 'input-mode-manage', icon: 'sparkle', label: '生成模式管理', value: `${activeModes} 个已激活` },
                { id: 'api-switch', icon: 'zap', label: 'API 配置', value: this.apiLabel },
                { id: 'display-settings', icon: 'palette', label: '显示设置', value: '' },
                { id: 'regex-replace', icon: 'regex', label: '正则替换系统', value: `${rules} 条规则` },
                { id: 'prompt-manage', icon: 'edit', label: '提示词管理', value: `${(book.customPrompts || []).length} 条` },
                { id: 'tokens-monitor', icon: 'chart', label: 'Tokens 监控', value: '各章占比' },
            ];
        },
        quickOn() {
            return this.payload.quickSettingsVisible === true;
        },
        apiLabel() {
            const ref = this.book?.apiRef;
            if (!ref) return '跟随人设';
            const hit = this.apiRefs.find((r) => r.type === ref.type && r.refId === ref.refId);
            return hit ? hit.label : '已失效';
        },
    },
    methods: {
        close() { store.closeSheet(); },

        /** 先关抽屉再执行 —— handler 里常常要开弹窗,不先关会被压在下面 */
        run(fn) {
            this.close();
            if (typeof fn === 'function') fn();
        },

        // ── 书籍菜单 ──────────────────────────
        onEditBook() {
            this.run(() => store.openModal('book-edit', { mode: 'edit', bookId: this.payload.bookId }));
        },
        onPickApiForBook() {
            const bookId = this.payload.bookId;
            this.run(() => store.openSheet('api-picker', { bookId }));
        },
        onDeleteBook() {
            const book = this.book;
            this.run(() =>
                store.openModal('confirm', {
                    title: `删除《${book?.title || ''}》?`,
                    message: '这本书和它的全部章节都会被删除,无法恢复。建议先在「我的 → 导出全部数据」备份一份。',
                    danger: true,
                    confirmLabel: '删除',
                    onConfirm: () => store.removeBook(book.id),
                }),
            );
        },

        // ── 章节菜单 ──────────────────────────
        onRenameChapter() {
            const chapter = this.chapter;
            this.run(() =>
                store.openModal('rename', {
                    title: '重命名章节',
                    value: chapter?.title || '',
                    onSubmit: (title) => store.updateChapter(chapter.id, { title: title || '未命名章节' }),
                }),
            );
        },
        onChapterSettings() {
            const chapterId = this.payload.chapterId;
            this.run(() => store.openModal('chapter-settings', { chapterId }));
        },
        onDeleteChapter() {
            const chapter = this.chapter;
            this.run(() =>
                store.openModal('confirm', {
                    title: `删除「${chapter?.title || ''}」?`,
                    message: `这一章的 ${chapter?.messages?.length || 0} 段内容会一起删掉,无法恢复。`,
                    danger: true,
                    confirmLabel: '删除',
                    onConfirm: () => store.removeChapter(chapter.id),
                }),
            );
        },

        // ── 消息菜单 ──────────────────────────
        onSplitHere() {
            // 从这条消息开始拆成新的一章 —— 长章拆分是写长文时的高频需求,原版没有
            const chapter = this.chapter;
            const message = this.message;
            if (!chapter || !message) return;
            this.run(async () => {
                const index = chapter.messages.findIndex((m) => m.id === message.id);
                if (index <= 0) {
                    this.$emit('notify', '这已经是本章第一段了');
                    return;
                }
                const moving = chapter.messages.slice(index);
                const next = await store.addChapter({ volumeId: chapter.volumeId, title: `${chapter.title} · 续` });
                if (!next) return;
                store.updateChapter(chapter.id, { messages: chapter.messages.slice(0, index) });
                store.updateChapter(next.id, { messages: moving });
                this.$emit('notify', '已拆分成新的一章');
            });
        },
        onMarkNote() {
            const chapter = this.chapter;
            const message = this.message;
            this.run(() => {
                const nextRole = message.role === 'note' ? 'ai' : 'note';
                store.updateMessage(chapter.id, message.id, { role: nextRole });
                this.$emit('notify', nextRole === 'note' ? '已标为「只记录」,不计入正文' : '已恢复为正文');
            });
        },
        onBindTimeline() {
            const chapter = this.chapter;
            const message = this.message;
            const book = store.getOpenBook();
            this.run(() =>
                store.openModal('timeline-event', {
                    bookId: book.id,
                    mode: 'create',
                    event: {
                        title: truncate(message.content, 30),
                        bindType: 'chapter',
                        chapterId: chapter.id,
                        messageId: message.id,
                    },
                }),
            );
        },

        // ── API 选择 ──────────────────────────
        onPickApi(ref) {
            const bookId = this.payload.bookId;
            this.run(() => {
                store.updateBook(bookId, { apiRef: { type: ref.type, refId: ref.refId } });
                this.$emit('notify', `这本书改用「${ref.label}」`);
            });
        },
        onClearApi() {
            const bookId = this.payload.bookId;
            this.run(() => {
                store.updateBook(bookId, { apiRef: null });
                this.$emit('notify', '已改为跟随人设绑定的 API');
            });
        },

        // ── 生成器 ────────────────────────────
        onPickGenerator(item) {
            const group = this.payload.group;
            this.run(() => {
                window.dispatchEvent(
                    new CustomEvent('dream-weaver:run-generator', { detail: { group, id: item.id, item } }),
                );
            });
        },

        // ── 更多操作 ──────────────────────────
        onMoreOption(option) {
            const bookId = this.book?.id;
            const chapterId = this.state.openChapterId;

            this.run(() => {
                // 抽屉类:直接开对应面板
                if (option.id.startsWith('drawer:')) {
                    store.setDrawer(option.id.slice(7));
                    return;
                }
                switch (option.id) {
                    case 'quick-settings':
                        window.dispatchEvent(new CustomEvent('dream-weaver:toggle-quick-settings'));
                        break;
                    case 'if-line-panel':
                        window.dispatchEvent(new CustomEvent('dream-weaver:open-ifline'));
                        break;
                    case 'chapter-info':
                        if (chapterId) store.openModal('chapter-info', { chapterId });
                        else this.$emit('notify', '先选一章');
                        break;
                    case 'finale':
                        store.openModal('finale', { bookId });
                        break;
                    case 'background-upload':
                        store.openModal('background', { bookId });
                        break;
                    case 'generate-mode':
                        store.openSheet('generate-mode', {});
                        break;
                    case 'input-mode-manage':
                        store.openModal('input-modes');
                        break;
                    case 'api-switch':
                        store.openSheet('api-picker', { bookId });
                        break;
                    case 'display-settings':
                        store.openModal('display-settings');
                        break;
                    case 'regex-replace':
                        store.openModal('regex-rules');
                        break;
                    case 'prompt-manage':
                        store.openModal('custom-prompts', { bookId });
                        break;
                    case 'tokens-monitor':
                        store.openModal('tokens', {});
                        break;
                    default:
                        this.$emit('notify', '功能开发中…');
                }
            });
        },

        onPickGenerateMode(mode) {
            this.run(() => {
                store.updateSettings({ generateMode: mode });
                this.$emit('notify', mode === 'chapter' ? '切到整章生成' : '切到文段生成');
            });
        },

    },
    created() { this.truncate = truncate; },
    template: `
        <DwSheet v-if="type === 'book-menu'" :title="book ? book.title : '书籍'" @close="close">
            <DwMenuItem label="书籍信息" hint="书名 / 作者 / 世界观 / 梗概" icon-name="book" @click="onEditBook" />
            <DwMenuItem label="选择 API" hint="这本书用哪个模型" icon-name="zap" @click="onPickApiForBook" />
            <DwMenuItem label="删除这本书" icon-name="trash" danger @click="onDeleteBook" />
        </DwSheet>

        <DwSheet v-else-if="type === 'chapter-menu'" :title="chapter ? chapter.title : '章节'" @close="close">
            <DwMenuItem label="重命名" icon-name="edit" @click="onRenameChapter" />
            <DwMenuItem label="章节设置" hint="人称 / 视角 / 故事时间 / 梗概" icon-name="settings" @click="onChapterSettings" />
            <DwMenuItem label="删除这一章" icon-name="trash" danger @click="onDeleteChapter" />
        </DwSheet>

        <DwSheet v-else-if="type === 'message-menu'" title="这一段" @close="close">
            <DwMenuItem
                :label="message && message.role === 'note' ? '恢复为正文' : '标为「只记录」'"
                hint="只记录的段落参与上下文,但不计入字数"
                icon-name="note"
                @click="onMarkNote"
            />
            <DwMenuItem label="从这里拆成新章" hint="这一段及之后的内容移到新章节" icon-name="branch" @click="onSplitHere" />
            <DwMenuItem label="记进时间线" hint="用这段内容新建一条事件" icon-name="timeline" @click="onBindTimeline" />
        </DwSheet>

        <DwSheet v-else-if="type === 'api-picker'" title="选择 API" @close="close">
            <DwMenuItem
                label="跟随人设绑定"
                hint="用当前用户人设里绑的 API"
                icon-name="user"
                @click="onClearApi"
            />
            <DwMenuItem
                v-for="ref in apiRefs"
                :key="ref.type + '::' + ref.refId"
                :label="ref.label"
                :hint="ref.sub"
                :icon-name="ref.type === 'group' ? 'layers' : 'zap'"
                @click="onPickApi(ref)"
            />
            <p v-if="apiRefs.length === 0" class="dw-sheet-empty">
                还没有可用的 API Key。去「设置 → API 管理」添加一个。
            </p>
        </DwSheet>

        <DwSheet v-else-if="type === 'pick-generator'" :title="generatorTitle" @close="close">
            <DwMenuItem
                v-for="item in generatorList"
                :key="item.id"
                :label="item.label"
                :hint="item.hint || ''"
                icon-name="sparkle"
                @click="onPickGenerator(item)"
            />
        </DwSheet>

        <!-- 更多操作 —— 原版顶栏「…」按钮 -->
        <DwSheet v-else-if="type === 'editor-more'" title="更多操作" @close="close">
            <div class="dw-option-list">
                <button
                    v-for="opt in moreOptions"
                    :key="opt.id"
                    type="button"
                    class="dw-option-item"
                    @click="onMoreOption(opt)"
                >
                    <DwIcon :name="opt.icon" :class="'dw-option-icon dw-option-icon--' + opt.id.replace(':', '-')" />
                    <span class="dw-option-label">{{ opt.label }}</span>
                    <span v-if="opt.value" class="dw-option-value">{{ opt.value }}</span>
                </button>
            </div>
        </DwSheet>

        <DwSheet v-else-if="type === 'generate-mode'" title="生成模式" @close="close">
            <DwMenuItem label="文段" hint="一次生成一段,便于把控节奏" icon-name="book" @click="onPickGenerateMode('paragraph')" />
            <DwMenuItem label="整章" hint="一次铺开一整章" icon-name="layers" @click="onPickGenerateMode('chapter')" />
        </DwSheet>

    `,
};

export default DwSheets;
