/**
 * 梦境编织 · 灵感页
 *
 * 以前灵感库是个 340px 宽的弹窗（DwLibraryListModal），一条稍长的灵感三行就撑满，
 * 想改还得再套一层弹窗，删了也没有撤销余地。写作时灵感是要反复翻、反复改的东西，
 * 弹窗这个容器从一开始就选错了。
 *
 * 这一页给的是：
 *   - 搜索 + 按时间/字数排序
 *   - 点开进详情，整屏编辑，字数实时统计
 *   - 保存 / 删除（删除有二次确认）/ 复制 / 插入到当前正文
 *   - 新建：顶部一个常驻输入框，回车即存
 */

import * as store from '../../store.js';
import { SHARED_COMPONENTS } from '../shared.js';
import { formatRelative } from '../../utils.js';

const SORTS = [
    { id: 'new', label: '最新' },
    { id: 'old', label: '最早' },
    { id: 'long', label: '最长' },
];

export const DwInspirationPage = {
    name: 'DwInspirationPage',
    components: SHARED_COMPONENTS,
    props: {
        app: { type: Object, required: true },
        payload: { type: Object, default: () => ({}) },
    },
    emits: ['close', 'notify'],
    data() {
        return {
            keyword: '',
            sort: 'new',
            draft: '',
            /** 正在编辑哪一条；null = 列表态 */
            editingId: null,
            editingText: '',
        };
    },
    computed: {
        library() { return store.getState().library; },
        all() { return this.library.inspirations || []; },
        items() {
            const kw = this.keyword.trim().toLowerCase();
            let list = this.all;
            if (kw) list = list.filter((n) => String(n.content || '').toLowerCase().includes(kw));
            const sorted = [...list];
            if (this.sort === 'old') sorted.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
            else if (this.sort === 'long') sorted.sort((a, b) => String(b.content || '').length - String(a.content || '').length);
            else sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            return sorted;
        },
        editing() {
            if (!this.editingId) return null;
            return this.all.find((n) => String(n.id) === String(this.editingId)) || null;
        },
        editingDirty() {
            return !!this.editing && this.editingText !== (this.editing.content || '');
        },
        totalChars() {
            return this.all.reduce((n, x) => n + String(x.content || '').length, 0);
        },
        sorts() { return SORTS; },
        /** 在编辑器里打开这一页时才给「插入到正文」 */
        canInsert() { return !!store.getState().openChapterId; },
    },
    methods: {
        onAdd() {
            const text = this.draft.trim();
            if (!text) return;
            const note = store.addInspiration(text);
            this.draft = '';
            if (note) this.$emit('notify', '已记下');
        },
        openOne(item) {
            this.editingId = item.id;
            this.editingText = item.content || '';
        },
        backToList() {
            if (this.editingDirty) {
                store.openModal('confirm', {
                    title: '放弃这次修改？',
                    message: '刚才改的内容还没保存。',
                    danger: true,
                    onConfirm: () => { this.editingId = null; this.editingText = ''; },
                });
                return;
            }
            this.editingId = null;
            this.editingText = '';
        },
        onSave() {
            if (!this.editing) return;
            const text = this.editingText.trim();
            if (!text) {
                this.$emit('notify', '内容不能为空，要删就点删除');
                return;
            }
            store.updateInspiration(this.editing.id, text);
            this.$emit('notify', '已保存');
        },
        onDelete(item) {
            const target = item || this.editing;
            if (!target) return;
            store.openModal('confirm', {
                title: '删掉这条灵感？',
                message: String(target.content || '').slice(0, 60),
                danger: true,
                onConfirm: () => {
                    store.removeInspiration(target.id);
                    if (String(this.editingId) === String(target.id)) {
                        this.editingId = null;
                        this.editingText = '';
                    }
                    this.$emit('notify', '已删除');
                },
            });
        },
        async onCopy(item) {
            const text = (item || this.editing)?.content || '';
            try {
                await navigator.clipboard.writeText(text);
                this.$emit('notify', '已复制');
            } catch (_) {
                this.$emit('notify', '这个环境不让复制，长按选中吧');
            }
        },
        onInsert(item) {
            const text = (item || this.editing)?.content || '';
            if (!text) return;
            const cur = store.getState().composerText || '';
            store.setComposerText(cur ? `${cur}\n${text}` : text);
            this.$emit('notify', '已放进输入框');
            this.$emit('close');
        },
        preview(item) {
            const t = String(item.content || '').replace(/\s+/g, ' ').trim();
            return t.length > 90 ? `${t.slice(0, 90)}…` : t;
        },
    },
    created() { this.formatRelative = formatRelative; },
    template: `
        <div class="dw-page-full dw-inspiration-page">
            <header class="dw-page-topbar">
                <button type="button" class="dw-nav-icon-btn" aria-label="返回"
                        @click="editing ? backToList() : $emit('close')">
                    <DwIcon name="chevronLeft" />
                </button>
                <div class="dw-page-topbar-title">
                    <h1>{{ editing ? '编辑灵感' : '灵感' }}</h1>
                    <p v-if="!editing">{{ all.length }} 条 · 共 {{ totalChars }} 字</p>
                    <p v-else>{{ formatRelative(editing.createdAt) }} 记下</p>
                </div>
                <button v-if="editing" type="button" class="dw-page-topbar-act"
                        :class="{ 'is-dirty': editingDirty }" @click="onSave">保存</button>
                <span v-else class="dw-page-topbar-spacer"></span>
            </header>

            <!-- 详情 / 编辑 -->
            <div v-if="editing" class="dw-page-body dw-inspiration-detail">
                <DwTextarea v-model="editingText" :rows="12" placeholder="写点什么…" />
                <p class="dw-inspiration-count">{{ editingText.length }} 字{{ editingDirty ? ' · 未保存' : '' }}</p>
                <div class="dw-inspiration-detail-acts">
                    <DwButton variant="ghost" icon-name="copy" label="复制" @click="onCopy(editing)" />
                    <DwButton v-if="canInsert" variant="ghost" icon-name="plus" label="放进输入框" @click="onInsert(editing)" />
                    <DwButton variant="ghost" danger icon-name="trash" label="删除" @click="onDelete(editing)" />
                </div>
            </div>

            <!-- 列表 -->
            <div v-else class="dw-page-body">
                <div class="dw-inspiration-add">
                    <DwInput v-model="draft" placeholder="记一句…" @enter="onAdd" />
                    <DwButton variant="primary" size="sm" icon-name="plus" icon-only label="添加" @click="onAdd" />
                </div>

                <div v-if="all.length" class="dw-inspiration-filters">
                    <DwInput v-model="keyword" placeholder="搜索灵感" />
                    <div class="dw-inspiration-sorts">
                        <button v-for="s in sorts" :key="s.id" type="button"
                                class="dw-chip" :class="{ 'is-on': sort === s.id }"
                                @click="sort = s.id">{{ s.label }}</button>
                    </div>
                </div>

                <DwEmpty v-if="!all.length" icon-name="lightbulb" title="灵感还是空的"
                         text="随手记点想法，回头能翻。在正文里选中一段也能存成灵感。" />
                <DwEmpty v-else-if="!items.length" icon-name="search" title="没搜到"
                         :text="'换个词试试，或者清空搜索框'" />

                <ul v-else class="dw-inspiration-list">
                    <li v-for="item in items" :key="item.id" class="dw-inspiration-card" @click="openOne(item)">
                        <p class="dw-inspiration-card-text">{{ preview(item) }}</p>
                        <div class="dw-inspiration-card-foot">
                            <span>{{ formatRelative(item.createdAt) }} · {{ String(item.content || '').length }} 字</span>
                            <span class="dw-inspiration-card-acts">
                                <button type="button" class="dw-nav-icon-btn" aria-label="复制" @click.stop="onCopy(item)"><DwIcon name="copy" /></button>
                                <button type="button" class="dw-nav-icon-btn" aria-label="删除" @click.stop="onDelete(item)"><DwIcon name="trash" /></button>
                            </span>
                        </div>
                    </li>
                </ul>
            </div>
        </div>
    `,
};

export default DwInspirationPage;
