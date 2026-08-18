/**
 * 梦境编织 · 工具面板
 *
 * 把原版散落在「更多操作」「时间工具」「气泡工具箱」「IF 线入口」等七八个地方的
 * 生成类功能收在一处。原版这些入口的问题不是功能不好,是**找不到** ——
 * 同一个「小剧场」在书籍菜单、气泡长按、更多操作三个地方都有入口,行为还略有不同。
 */

import * as store from '../../store.js';
import { SHARED_COMPONENTS } from '../shared.js';
import { THEATER_TYPES, COMMENT_TYPES } from '../../constants.js';

export const DwToolsPanel = {
    name: 'DwToolsPanel',
    components: SHARED_COMPONENTS,
    props: {
        book: { type: Object, required: true },
        chapter: { type: Object, default: null },
        library: { type: Object, required: true },
        busy: { type: Boolean, default: false },
    },
    emits: ['run-tool', 'notify'],
    computed: {
        hasContent() {
            return (this.chapter?.messages?.length || 0) > 0;
        },
        collectedCount() {
            return this.library.collected.length;
        },
        inspirationCount() {
            return this.library.inspirations.length;
        },
        historyCount() {
            return this.library.generatedHistory.length;
        },
    },
    methods: {
        run(kind, payload = {}) {
            if (this.busy) {
                this.$emit('notify', '还有一个生成没跑完,等一下');
                return;
            }
            this.$emit('run-tool', { kind, ...payload });
        },
        openSheet(type, payload) {
            store.openSheet(type, payload);
        },
        openModal(type, payload) {
            store.openModal(type, payload);
        },
        openPage(type, payload) {
            store.openPage(type, payload);
        },
        openIfLine() {
            // 面板挂在编辑器上,而这里是抽屉里 —— 隔着一层,走事件
            window.dispatchEvent(new CustomEvent('dream-weaver:open-ifline'));
        },
    },
    created() {
        this.THEATER_TYPES = THEATER_TYPES;
        this.COMMENT_TYPES = COMMENT_TYPES;
    },
    template: `
        <div class="dw-tools-panel">
            <header class="dw-panel-head">
                <div>
                    <h3 class="dw-panel-title">工具</h3>
                    <p class="dw-panel-sub">基于本书设定生成的衍生内容</p>
                </div>
            </header>

            <DwSection title="本章" icon-name="pen">
                <DwRow
                    label="生成本章梗概"
                    hint="写进「前情提要」,后面的章节就能接上"
                    icon-name="note"
                    :disabled="!hasContent || busy"
                    chevron
                    @click="run('summary')"
                />
                <DwRow
                    label="内心视角改写"
                    hint="把本章改成某个角色的内心独白"
                    icon-name="brain"
                    :disabled="!hasContent || busy"
                    chevron
                    @click="run('innerView')"
                />
                <DwRow
                    label="章节设置"
                    hint="人称 / 视角 / 故事时间"
                    icon-name="settings"
                    :disabled="!chapter"
                    chevron
                    @click="openModal('chapter-settings', { chapterId: chapter && chapter.id })"
                />
                <DwRow
                    label="章节信息"
                    hint="梗概 / 角色视角 / 出场 / 上下文模式"
                    icon-name="layers"
                    :disabled="!chapter"
                    chevron
                    @click="openModal('chapter-info', { chapterId: chapter && chapter.id })"
                />
            </DwSection>

            <DwSection title="衍生创作" icon-name="heart">
                <DwRow
                    label="小剧场"
                    hint="番外向的短片段"
                    icon-name="drama"
                    :disabled="busy"
                    chevron
                    @click="openSheet('pick-generator', { group: 'theater' })"
                />
                <DwRow
                    label="读者评论"
                    hint="看看「读者」怎么说"
                    icon-name="chat"
                    :disabled="!hasContent || busy"
                    chevron
                    @click="openSheet('pick-generator', { group: 'comment' })"
                />
                <DwRow
                    label="IF 线工作台"
                    hint="换个视角重述,或者假设另一条路"
                    icon-name="branch"
                    chevron
                    @click="openIfLine"
                />
                <DwRow
                    label="杀青梗"
                    hint="微博 / 群聊 / 推特 / 影评 / 论坛"
                    icon-name="film"
                    :disabled="busy"
                    chevron
                    @click="openModal('finale', { bookId: book.id })"
                />
            </DwSection>

            <DwSection title="设定" icon-name="layers">
                <DwRow label="角色" :value="String(book.characters.length)" icon-name="user" chevron @click="openModal('characters', { bookId: book.id })" />
                <DwRow label="地点" :value="String(book.locations.length)" icon-name="location" chevron @click="openModal('locations', { bookId: book.id })" />
                <DwRow label="自定义提示词" :value="String(book.customPrompts.length)" icon-name="note" chevron @click="openModal('custom-prompts', { bookId: book.id })" />
                <DwRow label="书籍信息" hint="书名 / 作者 / 世界观 / 梗概" icon-name="book" chevron @click="openModal('book-edit', { mode: 'edit', bookId: book.id })" />
            </DwSection>

            <DwSection title="素材" icon-name="star">
                <DwRow label="收藏的段落" :value="String(collectedCount)" icon-name="starFilled" chevron @click="openModal('collected')" />
                <DwRow label="灵感" :value="String(inspirationCount)" icon-name="lightbulb" chevron @click="openPage('inspirations')" />
                <DwRow label="生成历史" :value="String(historyCount)" icon-name="history" chevron @click="openModal('generated-history')" />
            </DwSection>
        </div>
    `,
};

export default DwToolsPanel;
