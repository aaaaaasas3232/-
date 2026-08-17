/**
 * 气泡机 · 弹窗集合
 *
 * 全部套 `BbModal`(= AcModal + 本 App 的规矩)。
 *
 * ⚠️ 每个弹窗都必须在 `MODAL_COMPONENTS` 里登记,并且在 `root.js` 的
 *    分发处有一行 `v-else-if`。少了任何一边,`store.openModal('xxx')` 之后
 *    **什么都不会发生,也不报错** —— 四叶草和灯塔都栽过这个(AGENTS2 §17.3)。
 */

import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import { BbModal } from './bb-modal.js';

/** 改名 —— 气泡和形状共用一个,靠 payload.kind 区分落到哪儿 */
const RenameModal = {
    name: 'BbRenameModal',
    components: { ...SHARED_COMPONENTS, BbModal },
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close', 'notify'],
    data() {
        return { name: String(this.payload.name || '') };
    },
    computed: {
        isShape() { return this.payload.kind === 'shape'; },
    },
    methods: {
        onSave() {
            const next = this.name.trim();
            if (!next) { this.$emit('notify', '名字不能为空'); return; }
            if (this.isShape) store.renameShape(this.payload.id, next);
            else store.renameBubble(this.payload.id, next);
            this.$emit('close');
        },
    },
    template: `
        <BbModal :title="isShape ? '形状改名' : '气泡改名'" @close="$emit('close')">
            <BbField label="名字">
                <BbInput v-model="name" :maxlength="24" placeholder="起个好找的名字" @enter="onSave" />
            </BbField>
            <template #footer>
                <button class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button class="ac-btn ac-btn-primary" @click="onSave">保存</button>
            </template>
        </BbModal>
    `,
};

/** 把工作台的成品存进形状库 */
const ShapeNameModal = {
    name: 'BbShapeNameModal',
    components: { ...SHARED_COMPONENTS, BbModal },
    emits: ['close', 'notify'],
    data() {
        return { name: `形状 ${store.getShapes().length + 1}` };
    },
    methods: {
        onSave() {
            const shape = store.saveShape(this.name.trim());
            this.$emit('close');
            if (shape) this.$emit('notify', `已存进形状库:${shape.name}`);
        },
    },
    template: `
        <BbModal title="存进形状库" subtitle="之后在尾巴设置里能直接选到" @close="$emit('close')">
            <BbField label="名字">
                <BbInput v-model="name" :maxlength="20" @enter="onSave" />
            </BbField>
            <template #footer>
                <button class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button class="ac-btn ac-btn-primary" @click="onSave">保存</button>
            </template>
        </BbModal>
    `,
};

/** 存自定义配色 */
const ThemeSaveModal = {
    name: 'BbThemeSaveModal',
    components: { ...SHARED_COMPONENTS, BbModal },
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close', 'notify'],
    data() { return { name: '我的配色' }; },
    methods: {
        onSave() {
            const theme = store.saveCustomTheme({
                name: this.name.trim(),
                baseThemeId: this.payload.baseThemeId,
                colors: this.payload.colors,
            });
            store.applyTheme({
                baseThemeId: this.payload.baseThemeId,
                customColors: this.payload.colors,
                customThemeId: theme.id,
            });
            this.$emit('close');
            this.$emit('notify', `已存下「${theme.name}」`);
        },
    },
    template: `
        <BbModal title="存为新配色" @close="$emit('close')">
            <BbField label="名字">
                <BbInput v-model="name" :maxlength="16" @enter="onSave" />
            </BbField>
            <template #footer>
                <button class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button class="ac-btn ac-btn-primary" @click="onSave">保存</button>
            </template>
        </BbModal>
    `,
};

/**
 * 删除确认。
 *
 * 一个组件管两种删除(气泡 / 形状)。文案里带上名字 ——
 * 「确定删除吗」这种问法用户答不上来,他不知道自己要删的是哪个。
 */
const ConfirmDeleteModal = {
    name: 'BbConfirmDeleteModal',
    components: { ...SHARED_COMPONENTS, BbModal },
    props: {
        payload: { type: Object, default: () => ({}) },
        kind: { type: String, default: 'bubble' },
    },
    emits: ['close', 'notify'],
    computed: {
        isShape() { return this.kind === 'shape'; },
        title() { return this.isShape ? '删掉这个形状?' : '删掉这个气泡?'; },
        note() {
            return this.isShape
                ? '用到它的尾巴会回落成内置形状,不会变成空白。'
                : '情景聊天里正在用它的主题会回落成默认气泡。';
        },
    },
    methods: {
        async onConfirm() {
            if (this.isShape) store.removeShape(this.payload.id);
            else await store.removeBubble(this.payload.id);
            this.$emit('close');
            this.$emit('notify', `已删除「${this.payload.name}」`);
        },
    },
    template: `
        <BbModal :title="title" :subtitle="payload.name" @close="$emit('close')">
            <p class="bb-modal-text">{{ note }}</p>
            <template #footer>
                <button class="ac-btn ac-btn-secondary" @click="$emit('close')">再想想</button>
                <button class="ac-btn ac-btn-danger" @click="onConfirm">删除</button>
            </template>
        </BbModal>
    `,
};

export const MODAL_COMPONENTS = {
    BbRenameModal: RenameModal,
    BbShapeNameModal: ShapeNameModal,
    BbThemeSaveModal: ThemeSaveModal,
    BbConfirmDeleteModal: ConfirmDeleteModal,
};
