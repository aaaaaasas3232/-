/**
 * 情景剧场 · 存档
 *
 * 一个情景下可以有很多档。存档存的是**这一条线的全部消息**,
 * 所以「另存为新档」= 从当前进度分叉出一条新线,原档不动。
 *
 * ── 五个动作分别是什么意思 ────────────────────────────────────────
 *
 *   新建     开一条空线,从头演
 *   读取     切过去,当前这条不动
 *   另存为   把当前进度复制成一条新线(分叉)
 *   覆盖     把当前进度写进另一个已有的档(那个档原来的内容没了)
 *   改名     只改名字
 *
 * 「覆盖」是唯一有破坏性的,所以它走确认弹窗,而且文案里写清楚会丢什么。
 */

import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import { formatRelative, truncate } from '../utils.js';

export const SpPanelSaves = {
    name: 'SpPanelSaves',
    components: { ...SHARED_COMPONENTS },
    emits: ['notify'],
    computed: {
        state() { return store.getState(); },
        scene() { return store.getScene(); },
        saves() { return this.state.saves; },
        activeId() { return this.state.activeSaveId; },
        current() { return store.getSave(); },
        count() { return this.state.messages.length; },
        digesting() { return this.state.digesting; },
    },
    methods: {
        when(ts) { return formatRelative(ts); },
        sub(save) {
            const bits = [`${save.messageCount} 段`, this.when(save.updatedAt)];
            if (save.lastLine) bits.push(truncate(save.lastLine, 20));
            return bits.filter(Boolean).join(' · ');
        },
        async open(saveId) {
            await store.openSave(saveId);
            store.closeDrawer();
        },
        async onNew() {
            await store.createSave();
            this.$emit('notify', '开了一条新线');
            store.closeDrawer();
        },
        onFork() { store.openModal('save-fork', {}); },
        onOverwrite() {
            if (this.saves.length < 2) { this.$emit('notify', '只有一个档,没有别的可以覆盖'); return; }
            store.openModal('save-overwrite', {});
        },
        onRename(save) { store.openModal('save-rename', { id: save.id, name: save.name }); },
        onDelete(save) { store.openModal('confirm-delete-save', { id: save.id, name: save.name }); },
        async onDigest() {
            const result = await store.digestSave();
            this.$emit('notify', result.ok ? `已命名为「${result.title}」` : result.error);
        },
    },
    template: `
        <div class="sp-panel">
            <SpEmpty
                v-if="!scene"
                icon-name="book"
                text="先选一个情景"
                hint="存档是挂在情景下面的"
            />

            <template v-else>
                <div class="sp-panel-actions">
                    <SpButton variant="primary" size="sm" icon-name="plus" @click="onNew">新建存档</SpButton>
                    <SpButton variant="line" size="sm" icon-name="copy" :disabled="!current" @click="onFork">另存为</SpButton>
                    <SpButton variant="line" size="sm" icon-name="upload" :disabled="!current" @click="onOverwrite">覆盖到…</SpButton>
                </div>

                <SpSection v-if="current" title="正在用的这一档" icon-name="save" :hint="count + ' 段'">
                    <p class="sp-save-name">{{ current.name }}</p>
                    <p v-if="current.summary" class="sp-note">{{ current.summary }}</p>
                    <SpButton
                        variant="quiet" size="sm" icon-name="sparkle"
                        :disabled="digesting || count < 2"
                        @click="onDigest"
                    >{{ digesting ? '正在起名…' : '让 AI 起个名字' }}</SpButton>
                </SpSection>

                <SpSection title="全部存档" icon-name="layers" :hint="saves.length + ' 个'">
                    <SpEmpty
                        v-if="!saves.length"
                        icon-name="save"
                        text="还没有存档"
                        hint="点上面「新建存档」开一条线"
                    />
                    <SpRow
                        v-for="s in saves"
                        :key="s.id"
                        :title="s.name"
                        :sub="sub(s)"
                        :active="s.id === activeId"
                        @open="open(s.id)"
                    >
                        <template #actions>
                            <button type="button" class="sp-mini" @click="onRename(s)">名</button>
                            <button type="button" class="sp-mini is-danger" @click="onDelete(s)">删</button>
                        </template>
                    </SpRow>
                </SpSection>

                <p class="sp-note">
                    「另存为」是从现在这一步分叉出一条新线,原来那条不动;
                    「覆盖」会把目标档原来的内容全部换掉。
                </p>
            </template>
        </div>
    `,
};

export default SpPanelSaves;
