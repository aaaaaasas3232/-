/**
 * 情景剧场 · 情景库
 *
 * 分类 → 情景两层。分类是用户自己建的,情景可以随时换分类。
 *
 * ★ 删分类**不删情景**,只是把它们变成「未分类」。
 *   用户点删除时想的是「这个抽屉不要了」,不是「里面的东西都不要了」。
 */

import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import { truncate } from '../utils.js';
import { MODES } from '../constants.js';

export const SpPanelScenes = {
    name: 'SpPanelScenes',
    components: { ...SHARED_COMPONENTS },
    emits: ['notify'],
    data() {
        return { MODES, collapsed: {} };
    },
    computed: {
        state() { return store.getState(); },
        groups() { return store.getScenesByCategory(); },
        activeId() { return this.state.activeSceneId; },
        total() { return this.state.scenes.length; },
        scene() { return store.getScene(); },
    },
    methods: {
        modeLabel(id) { return MODES.find((m) => m.id === id)?.label || ''; },
        isCollapsed(id) { return this.collapsed[id || '_'] === true; },
        toggleGroup(id) { this.collapsed = { ...this.collapsed, [id || '_']: !this.isCollapsed(id) }; },

        async open(sceneId) {
            await store.openScene(sceneId);
            store.closeDrawer();
        },
        onNew(categoryId) { store.openModal('scene-edit', { categoryId, isNew: true }); },
        onEdit(scene) { store.openModal('scene-edit', { id: scene.id }); },
        async onDuplicate(scene) {
            await store.duplicateScene(scene.id);
            this.$emit('notify', '已复制一份(存档不跟着走)');
        },
        onDelete(scene) { store.openModal('confirm-delete-scene', { id: scene.id, name: scene.title }); },
        onMove(scene) { store.openModal('scene-category', { id: scene.id, categoryId: scene.categoryId }); },

        onNewCategory() { store.openModal('category-edit', { isNew: true }); },
        onRenameCategory(cat) { store.openModal('category-edit', { id: cat.id, name: cat.name }); },
        onDeleteCategory(cat) {
            store.removeCategory(cat.id);
            this.$emit('notify', `已删掉分类「${cat.name}」,里面的情景归到未分类`);
        },
        moveCategory(cat, dir) { store.moveCategory(cat.id, dir); },

        onAdoptTheater() { store.openModal('pick-theater', {}); },
        sub(scene) {
            const bits = [this.modeLabel(scene.mode)];
            if (scene.setting) bits.push(truncate(scene.setting, 26));
            return bits.filter(Boolean).join(' · ');
        },
    },
    template: `
        <div class="sp-panel">
            <div class="sp-panel-actions">
                <SpButton variant="primary" size="sm" icon-name="plus" @click="onNew('')">新建情景</SpButton>
                <SpButton variant="line" size="sm" icon-name="folder" @click="onNewCategory">新建分类</SpButton>
            </div>

            <SpEmpty
                v-if="!total"
                icon-name="book"
                text="还没有情景"
                hint="一个情景就是一个开头:在哪儿、和谁、发生了什么。剩下的交给对话。"
            >
                <SpButton variant="primary" icon-name="plus" @click="onNew('')">建第一个</SpButton>
            </SpEmpty>

            <template v-else>
                <section v-for="group in groups" :key="group.category.id || '_'" class="sp-group">
                    <header class="sp-group-head">
                        <button type="button" class="sp-group-toggle" @click="toggleGroup(group.category.id)">
                            <SpIcon :name="isCollapsed(group.category.id) ? 'chevronRight' : 'chevronDown'" />
                            <span>{{ group.category.name }}</span>
                            <em>{{ group.scenes.length }}</em>
                        </button>
                        <div v-if="group.category.id" class="sp-group-acts">
                            <button type="button" class="sp-mini" aria-label="上移" @click="moveCategory(group.category, -1)">↑</button>
                            <button type="button" class="sp-mini" aria-label="下移" @click="moveCategory(group.category, 1)">↓</button>
                            <button type="button" class="sp-mini" @click="onRenameCategory(group.category)">名</button>
                            <button type="button" class="sp-mini is-danger" @click="onDeleteCategory(group.category)">删</button>
                        </div>
                    </header>

                    <div v-if="!isCollapsed(group.category.id)" class="sp-group-body">
                        <SpRow
                            v-for="s in group.scenes"
                            :key="s.id"
                            :title="s.title"
                            :sub="sub(s)"
                            :active="s.id === activeId"
                            @open="open(s.id)"
                        >
                            <template #actions>
                                <button type="button" class="sp-mini" @click="onEdit(s)">改</button>
                                <button type="button" class="sp-mini" @click="onMove(s)">归类</button>
                                <button type="button" class="sp-mini" @click="onDuplicate(s)">复制</button>
                                <button type="button" class="sp-mini is-danger" @click="onDelete(s)">删</button>
                            </template>
                        </SpRow>
                        <button
                            v-if="group.category.id"
                            type="button"
                            class="sp-group-add"
                            @click="onNew(group.category.id)"
                        >+ 在这个分类里新建</button>
                    </div>
                </section>
            </template>

            <SpSection title="从四叶草接一场" icon-name="theater">
                <p class="sp-note">
                    购物软件里演过的小剧场可以接过来:台词会落进存档,
                    之前发生过什么也会作为「前情」进上下文。
                </p>
                <SpButton variant="line" size="sm" block icon-name="download" :disabled="!scene" @click="onAdoptTheater">
                    {{ scene ? '挑一场接住' : '先选一个情景' }}
                </SpButton>
            </SpSection>
        </div>
    `,
};

export default SpPanelScenes;
