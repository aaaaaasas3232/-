/**
 * 情景剧场 · 弹窗集合
 *
 * 全部套 `SpModal`(= AcModal + 本 App 的规矩)。
 *
 * ⚠️ 每个弹窗都必须在 `MODAL_COMPONENTS` 里登记,并且在 `root.js` 的
 *    分发处有一行 `v-else-if`。少了任何一边,`store.openModal('xxx')` 之后
 *    **什么都不会发生,也不报错** —— 四叶草和灯塔都栽过这个(AGENTS2 §17.3)。
 */

import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import { SpModal } from './sp-modal.js';
import { BubbleView } from '@/src/core/components/bubble-view.js';
import { MODES, CARD_KINDS, REROLL_NOTE_MAX } from '../constants.js';
import * as nook from '../services/nook-bridge.js';
import { previewRule } from '../services/regex-engine.js';
import { getBubble } from '../services/app-bridges.js';
import { asArray, truncate, findById } from '../utils.js';

// ============================================================
// 情景
// ============================================================

const SceneEdit = {
    name: 'SpSceneEditModal',
    components: { ...SHARED_COMPONENTS, SpModal },
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close', 'notify'],
    data() {
        const scene = this.payload.isNew ? null : findById(store.getState().scenes, this.payload.id);
        return {
            MODES,
            isNew: Boolean(this.payload.isNew),
            title: scene?.title || '',
            mode: scene?.mode || 'dialogue',
            setting: scene?.setting || '',
            aim: scene?.aim || '',
            timeText: scene?.timeText || '',
            worldId: scene?.worldId || '',
            userPersonaId: scene?.userPersonaId || '',
            locationId: scene?.locationId || '',
            castIds: [...(scene?.castIds || [])],
            categoryId: scene?.categoryId ?? (this.payload.categoryId || ''),
            sceneId: scene?.id || '',
        };
    },
    computed: {
        worlds() { return [{ value: '', label: '跟随当前世界观' }, ...nook.listWorlds().map((w) => ({ value: w.id, label: w.name }))]; },
        users() { return [{ value: '', label: '跟随默认人设' }, ...nook.listUserCards().map((u) => ({ value: u.id, label: u.name + (u.isDefault ? '(默认)' : '') }))]; },
        world() { return nook.getWorld(this.worldId, nook.getUserCard(this.userPersonaId)); },
        locations() { return [{ value: '', label: '不指定' }, ...nook.listWorldLocations(this.world).map((l) => ({ value: l.id, label: l.name }))]; },
        ais() { return nook.listWorldAis(this.world); },
        categories() { return [{ value: '', label: '未分类' }, ...store.getCategories().map((c) => ({ value: c.id, label: c.name }))]; },
        modeOptions() { return MODES.map((m) => ({ value: m.id, label: m.label })); },
        modeDesc() { return MODES.find((m) => m.id === this.mode)?.desc || ''; },
    },
    methods: {
        toggleAi(id) {
            this.castIds = this.castIds.includes(id) ? this.castIds.filter((x) => x !== id) : [...this.castIds, id];
        },
        async onSave() {
            const title = this.title.trim() || truncate(this.setting, 14) || '新情景';
            const patch = {
                title,
                mode: this.mode,
                setting: this.setting,
                aim: this.aim,
                timeText: this.timeText,
                worldId: this.worldId,
                userPersonaId: this.userPersonaId,
                locationId: this.locationId,
                castIds: this.castIds,
                categoryId: this.categoryId,
            };
            if (this.isNew) {
                await store.createScene(patch);
                this.$emit('notify', '建好了,可以开场了');
            } else {
                store.updateScene(patch, this.sceneId);
                this.$emit('notify', '改好了');
            }
            this.$emit('close');
            store.closeDrawer();
        },
    },
    template: `
        <SpModal :title="isNew ? '新建情景' : '改这个情景'" wide @close="$emit('close')">
            <SpField label="名字" hint="留空就用情景内容的开头">
                <SpInput v-model="title" :maxlength="40" placeholder="比如:雨天便利店" />
            </SpField>

            <SpField label="体裁" :hint="modeDesc">
                <SpSegmented v-model="mode" :options="modeOptions" />
            </SpField>

            <SpField label="情景" hint="在哪儿、和谁、发生了什么。这一段是最重要的">
                <SpTextarea v-model="setting" :rows="4" placeholder="傍晚下起雨,我躲进街角那家便利店……" />
            </SpField>

            <SpField label="想往哪儿走" hint="可以不写。写了 AI 会朝这个方向推,但不会每句都挂在嘴边">
                <SpInput v-model="aim" :maxlength="60" placeholder="比如:让他把那件事说出来" />
            </SpField>

            <SpField label="时间">
                <SpInput v-model="timeText" :maxlength="30" placeholder="比如:入秋的第一场雨" />
            </SpField>

            <SpField label="分类">
                <SpSelect v-model="categoryId" :options="categories" />
            </SpField>

            <SpField label="世界观">
                <SpSelect v-model="worldId" :options="worlds" />
            </SpField>

            <SpField label="我用哪张人设">
                <SpSelect v-model="userPersonaId" :options="users" />
            </SpField>

            <SpField label="地点">
                <SpSelect v-model="locationId" :options="locations" />
            </SpField>

            <SpField label="谁出场" hint="不选也行,但 AI 就不知道该演谁">
                <div class="sp-chips">
                    <button
                        v-for="ai in ais"
                        :key="ai.id"
                        type="button"
                        class="sp-chip"
                        :class="{ 'is-active': castIds.includes(ai.id) }"
                        @click="toggleAi(ai.id)"
                    >{{ ai.name }}</button>
                </div>
                <p v-if="!ais.length" class="sp-note">这个世界观下还没有 AI 人设。去 nook 建一个。</p>
            </SpField>

            <template #footer>
                <button class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button class="ac-btn ac-btn-primary" @click="onSave">{{ isNew ? '建好' : '保存' }}</button>
            </template>
        </SpModal>
    `,
};

const SceneCategory = {
    name: 'SpSceneCategoryModal',
    components: { ...SHARED_COMPONENTS, SpModal },
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close', 'notify'],
    data() { return { categoryId: this.payload.categoryId || '' }; },
    computed: {
        categories() { return [{ value: '', label: '未分类' }, ...store.getCategories().map((c) => ({ value: c.id, label: c.name }))]; },
    },
    methods: {
        onSave() {
            store.setSceneCategory(this.payload.id, this.categoryId);
            this.$emit('close');
            this.$emit('notify', '归类好了');
        },
    },
    template: `
        <SpModal title="换个分类" @close="$emit('close')">
            <SpField label="放到哪一类">
                <SpSelect v-model="categoryId" :options="categories" />
            </SpField>
            <template #footer>
                <button class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button class="ac-btn ac-btn-primary" @click="onSave">保存</button>
            </template>
        </SpModal>
    `,
};

const CategoryEdit = {
    name: 'SpCategoryEditModal',
    components: { ...SHARED_COMPONENTS, SpModal },
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close', 'notify'],
    data() { return { name: this.payload.name || '' }; },
    methods: {
        onSave() {
            const name = this.name.trim();
            if (!name) { this.$emit('notify', '名字不能为空'); return; }
            if (this.payload.isNew) store.addCategory(name);
            else store.renameCategory(this.payload.id, name);
            this.$emit('close');
        },
    },
    template: `
        <SpModal :title="payload.isNew ? '新建分类' : '分类改名'" @close="$emit('close')">
            <SpField label="名字">
                <SpInput v-model="name" :maxlength="16" placeholder="比如:日常 / 长篇" @enter="onSave" />
            </SpField>
            <template #footer>
                <button class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button class="ac-btn ac-btn-primary" @click="onSave">保存</button>
            </template>
        </SpModal>
    `,
};

// ============================================================
// 存档
// ============================================================

const SaveRename = {
    name: 'SpSaveRenameModal',
    components: { ...SHARED_COMPONENTS, SpModal },
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close', 'notify'],
    data() { return { name: this.payload.name || '' }; },
    methods: {
        onSave() {
            const name = this.name.trim();
            if (!name) { this.$emit('notify', '名字不能为空'); return; }
            store.renameSave(this.payload.id, name);
            this.$emit('close');
        },
    },
    template: `
        <SpModal title="存档改名" @close="$emit('close')">
            <SpField label="名字">
                <SpInput v-model="name" :maxlength="30" @enter="onSave" />
            </SpField>
            <template #footer>
                <button class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button class="ac-btn ac-btn-primary" @click="onSave">保存</button>
            </template>
        </SpModal>
    `,
};

const SaveFork = {
    name: 'SpSaveForkModal',
    components: { ...SHARED_COMPONENTS, SpModal },
    emits: ['close', 'notify'],
    data() {
        return { name: `${store.getSave()?.name || '存档'} 副本`, busy: false };
    },
    methods: {
        async onSave() {
            this.busy = true;
            try {
                await store.forkSave(this.name.trim());
                this.$emit('notify', '已分叉出一条新线,原来那条没动');
                this.$emit('close');
            } finally { this.busy = false; }
        },
    },
    template: `
        <SpModal title="另存为新档" subtitle="从现在这一步分叉,原来那条不动" @close="$emit('close')">
            <SpField label="新档名字">
                <SpInput v-model="name" :maxlength="30" @enter="onSave" />
            </SpField>
            <template #footer>
                <button class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button class="ac-btn ac-btn-primary" :disabled="busy" @click="onSave">{{ busy ? '复制中…' : '另存' }}</button>
            </template>
        </SpModal>
    `,
};

const SaveOverwrite = {
    name: 'SpSaveOverwriteModal',
    components: { ...SHARED_COMPONENTS, SpModal },
    emits: ['close', 'notify'],
    data() { return { targetId: '', busy: false }; },
    computed: {
        state() { return store.getState(); },
        options() {
            return this.state.saves
                .filter((s) => s.id !== this.state.activeSaveId)
                .map((s) => ({ value: s.id, label: `${s.name}(${s.messageCount} 段)` }));
        },
        target() { return findById(this.state.saves, this.targetId); },
    },
    methods: {
        async onSave() {
            if (!this.targetId) { this.$emit('notify', '先选一个要覆盖的档'); return; }
            this.busy = true;
            try {
                await store.overwriteSave(this.targetId);
                this.$emit('notify', '已覆盖');
                this.$emit('close');
            } finally { this.busy = false; }
        },
    },
    template: `
        <SpModal title="覆盖到哪个档" @close="$emit('close')">
            <SpField label="目标存档">
                <SpSelect v-model="targetId" :options="options" placeholder="选一个" />
            </SpField>
            <p v-if="target" class="sp-modal-warn">
                「{{ target.name }}」原来的 {{ target.messageCount }} 段会被全部换掉,而且找不回来。
            </p>
            <template #footer>
                <button class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button class="ac-btn ac-btn-danger" :disabled="busy || !targetId" @click="onSave">{{ busy ? '写入中…' : '覆盖' }}</button>
            </template>
        </SpModal>
    `,
};

// ============================================================
// 消息
// ============================================================

/**
 * 重 roll。
 *
 * 用户要求「重 roll 时要有一个弹窗让用户提修改意见,不提也可以」。
 * 所以确认按钮**不依赖**输入框有没有内容 —— 直接点「重来」是完全正常的路径。
 *
 * 弹窗里明写会删掉几条:这是有后果的操作,而后果是「这条以及之后的都没了」。
 */
const Reroll = {
    name: 'SpRerollModal',
    components: { ...SHARED_COMPONENTS, SpModal },
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close', 'notify'],
    data() { return { note: '', busy: false, REROLL_NOTE_MAX }; },
    computed: {
        after() { return Number(this.payload.after) || 1; },
        presets() {
            return ['更长一点', '更短一点', '别这么客气', '气氛再紧一点', '换个走向', '多写一点动作和环境'];
        },
    },
    methods: {
        usePreset(text) {
            this.note = this.note ? `${this.note},${text}` : text;
        },
        async onGo() {
            this.busy = true;
            this.$emit('close');
            const result = await store.generate({
                kind: 'reroll',
                fromId: this.payload.id,
                note: this.note.trim(),
            });
            this.busy = false;
            if (!result.ok) this.$emit('notify', result.error);
        },
    },
    template: `
        <SpModal title="重来一次" :subtitle="'这条以及后面 ' + (after - 1) + ' 条会被删掉'" @close="$emit('close')">
            <SpField label="有什么想改的" hint="不写也行,直接重来就是换个说法">
                <SpTextarea v-model="note" :rows="3" :maxlength="REROLL_NOTE_MAX" placeholder="比如:让她别答应得那么快" />
            </SpField>
            <div class="sp-chips">
                <button v-for="p in presets" :key="p" type="button" class="sp-chip" @click="usePreset(p)">{{ p }}</button>
            </div>
            <template #footer>
                <button class="ac-btn ac-btn-secondary" @click="$emit('close')">算了</button>
                <button class="ac-btn ac-btn-primary" :disabled="busy" @click="onGo">重来</button>
            </template>
        </SpModal>
    `,
};

/** 自己写一条(演旁白 / 补一句台词) */
const ManualMessage = {
    name: 'SpManualMessageModal',
    components: { ...SHARED_COMPONENTS, SpModal },
    emits: ['close', 'notify'],
    data() { return { role: 'system', text: '', speaker: '' }; },
    computed: {
        cast() { return store.getCast(); },
        roles() {
            return [
                { value: 'system', label: '旁白' },
                { value: 'user', label: '我' },
                { value: 'ai', label: '角色' },
            ];
        },
    },
    methods: {
        async onSave() {
            const text = this.text.trim();
            if (!text) { this.$emit('notify', '写点什么再存'); return; }
            const added = await store.addManualMessage({ role: this.role, text, speaker: this.speaker });
            this.$emit('close');
            this.$emit('notify', added ? '加好了' : '先选一个情景');
        },
    },
    template: `
        <SpModal title="自己写一条" subtitle="不会触发 AI" @close="$emit('close')">
            <SpField label="以谁的身份">
                <SpSegmented v-model="role" :options="roles" />
            </SpField>
            <SpField v-if="role === 'ai'" label="谁说的">
                <div class="sp-chips">
                    <button
                        v-for="c in cast"
                        :key="c.id"
                        type="button"
                        class="sp-chip"
                        :class="{ 'is-active': speaker === c.name }"
                        @click="speaker = c.name"
                    >{{ c.name }}</button>
                </div>
            </SpField>
            <SpField label="内容">
                <SpTextarea v-model="text" :rows="4" placeholder="写点什么…" />
            </SpField>
            <template #footer>
                <button class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button class="ac-btn ac-btn-primary" @click="onSave">加进去</button>
            </template>
        </SpModal>
    `,
};

// ============================================================
// 外观 / 气泡 / 配色
// ============================================================

const ThemeNew = {
    name: 'SpThemeNewModal',
    components: { ...SHARED_COMPONENTS, SpModal },
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close', 'notify'],
    data() { return { name: this.payload.from ? '外观副本' : '新外观' }; },
    methods: {
        onSave() {
            const name = this.name.trim() || '新外观';
            const theme = this.payload.from
                ? store.duplicateTheme(this.payload.from, name)
                : store.addTheme({ name });
            if (theme) store.updateScene({ themeId: theme.id });
            this.$emit('close');
            this.$emit('notify', `已切到「${name}」`);
        },
    },
    template: `
        <SpModal :title="payload.from ? '复制这套外观' : '新建外观'" @close="$emit('close')">
            <SpField label="名字">
                <SpInput v-model="name" :maxlength="20" @enter="onSave" />
            </SpField>
            <template #footer>
                <button class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button class="ac-btn ac-btn-primary" @click="onSave">建好</button>
            </template>
        </SpModal>
    `,
};

const ThemeRename = {
    name: 'SpThemeRenameModal',
    components: { ...SHARED_COMPONENTS, SpModal },
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close', 'notify'],
    data() { return { name: this.payload.name || '' }; },
    methods: {
        onSave() {
            const name = this.name.trim();
            if (!name) { this.$emit('notify', '名字不能为空'); return; }
            store.updateTheme(this.payload.id, { name });
            this.$emit('close');
        },
    },
    template: `
        <SpModal title="外观改名" @close="$emit('close')">
            <SpField label="名字">
                <SpInput v-model="name" :maxlength="20" @enter="onSave" />
            </SpField>
            <template #footer>
                <button class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button class="ac-btn ac-btn-primary" @click="onSave">保存</button>
            </template>
        </SpModal>
    `,
};

/** 从气泡机挑一套气泡 */
const PickBubble = {
    name: 'SpPickBubbleModal',
    components: { ...SHARED_COMPONENTS, SpModal, BubbleView },
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close', 'notify'],
    data() { return { list: [], loading: true, configs: {} }; },
    computed: {
        state() { return store.getState(); },
        side() { return this.payload.side === 'left' ? 'left' : 'right'; },
        shapes() { return this.state.bubbles.shapes; },
        /** 同侧的排前面 —— 左气泡装到右边不是不行,但九成情况下是选错了 */
        sorted() {
            return [...this.list].sort((a, b) => (b.side === this.side ? 1 : 0) - (a.side === this.side ? 1 : 0));
        },
    },
    methods: {
        async load() {
            this.loading = true;
            try {
                this.list = await store.loadBubbleChoices();
                // 列表只给摘要,预览要完整配置 —— 一次性把它们都拉过来。
                // 封顶 40 个:再多的话打开选择器时会有可感知的停顿,
                // 而一屏本来也看不到那么多
                const entries = await Promise.all(
                    this.list.slice(0, 40).map(async (b) => [b.id, await getBubble(b.id)]),
                );
                this.configs = Object.fromEntries(entries.filter(([, cfg]) => cfg));
            } finally { this.loading = false; }
        },
        pick(id) {
            const key = this.side === 'left' ? 'bubbleLeftId' : 'bubbleRightId';
            store.updateTheme(this.payload.themeId, { [key]: id });
            this.$emit('close');
            this.$emit('notify', '换好了');
        },
        clear() {
            const key = this.side === 'left' ? 'bubbleLeftId' : 'bubbleRightId';
            store.updateTheme(this.payload.themeId, { [key]: '' });
            this.$emit('close');
            this.$emit('notify', '已改回默认气泡');
        },
    },
    mounted() { void this.load(); },
    template: `
        <SpModal :title="side === 'left' ? '左侧用哪套气泡' : '右侧用哪套气泡'" wide @close="$emit('close')">
            <SpSpinner v-if="loading" label="正在读气泡库…" />
            <SpEmpty
                v-else-if="!sorted.length"
                icon-name="bubble"
                text="气泡库是空的"
                hint="去「气泡机」做一套,回来就能选到"
            />
            <div v-else class="sp-bubble-picks">
                <button
                    v-for="b in sorted"
                    :key="b.id"
                    type="button"
                    class="sp-bubble-pick"
                    @click="pick(b.id)"
                >
                    <BubbleView v-if="configs[b.id]" :config="configs[b.id]" :shapes="shapes" text="今天天气不错" />
                    <span class="sp-bubble-pick-name">{{ b.name }}<em>{{ b.side === 'left' ? '左' : '右' }}</em></span>
                </button>
            </div>
            <template #footer>
                <button class="ac-btn ac-btn-secondary" @click="clear">用默认</button>
                <button class="ac-btn ac-btn-primary" @click="$emit('close')">关掉</button>
            </template>
        </SpModal>
    `,
};

const PaletteSave = {
    name: 'SpPaletteSaveModal',
    components: { ...SHARED_COMPONENTS, SpModal },
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close', 'notify'],
    data() { return { name: '我的配色' }; },
    methods: {
        onSave() {
            const palette = store.saveCustomTheme({
                name: this.name.trim(),
                baseThemeId: this.payload.baseThemeId,
                colors: this.payload.colors,
            });
            store.applyTheme({
                baseThemeId: this.payload.baseThemeId,
                customColors: this.payload.colors,
                customThemeId: palette.id,
            });
            this.$emit('close');
            this.$emit('notify', `已存下「${palette.name}」`);
        },
    },
    template: `
        <SpModal title="存为新配色" @close="$emit('close')">
            <SpField label="名字">
                <SpInput v-model="name" :maxlength="16" @enter="onSave" />
            </SpField>
            <template #footer>
                <button class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button class="ac-btn ac-btn-primary" @click="onSave">保存</button>
            </template>
        </SpModal>
    `,
};

// ============================================================
// 正则 / 文案
// ============================================================

const RegexEdit = {
    name: 'SpRegexEditModal',
    components: { ...SHARED_COMPONENTS, SpModal },
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close', 'notify'],
    data() {
        const rule = this.payload.isNew ? null : findById(store.getRules(), this.payload.id);
        return {
            CARD_KINDS,
            isNew: Boolean(this.payload.isNew),
            ruleId: rule?.id || '',
            name: rule?.name || '',
            pattern: rule?.pattern || '',
            flags: rule?.flags || '',
            card: rule?.card || 'note',
            slotTitle: rule?.slots?.title ?? 0,
            slotBody: rule?.slots?.body ?? 1,
            slotMeta: rule?.slots?.meta ?? 0,
            sample: rule?.sample || '',
        };
    },
    computed: {
        cardOptions() { return CARD_KINDS.map((c) => ({ value: c.id, label: c.label })); },
        slotOptions() { return [0, 1, 2, 3, 4].map((n) => ({ value: n, label: n === 0 ? '不用' : `第 ${n} 组` })); },
        draft() {
            return {
                id: this.ruleId || 'draft',
                name: this.name, pattern: this.pattern, flags: this.flags, card: this.card,
                slots: { title: Number(this.slotTitle), body: Number(this.slotBody), meta: Number(this.slotMeta) },
                sample: this.sample, enabled: true,
            };
        },
        /** 边写边试 —— 正则写错的话这里立刻显示原因,不用存了才发现 */
        test() { return previewRule(this.draft, this.sample); },
    },
    methods: {
        onSave() {
            const name = this.name.trim();
            if (!name) { this.$emit('notify', '给规则起个名字'); return; }
            if (!this.pattern.trim()) { this.$emit('notify', '正则不能为空'); return; }
            const patch = {
                name,
                pattern: this.pattern,
                flags: this.flags,
                card: this.card,
                slots: { title: Number(this.slotTitle), body: Number(this.slotBody), meta: Number(this.slotMeta) },
                sample: this.sample,
            };
            if (this.isNew) {
                const rule = store.addRule(patch);
                // 新建的规则默认在**当前情景**里启用 —— 不启用的话用户建完
                // 回去一试「没反应」,而原因只是「还没在这个情景里打开」
                const scene = store.getScene();
                if (scene && rule) store.updateScene({ regexIds: [...asArray(scene.regexIds), rule.id] });
            } else {
                store.updateRule(this.ruleId, patch);
            }
            this.$emit('close');
            this.$emit('notify', '保存好了');
        },
    },
    template: `
        <SpModal :title="isNew ? '新建正则规则' : '改这条规则'" wide @close="$emit('close')">
            <SpField label="名字">
                <SpInput v-model="name" :maxlength="24" placeholder="比如:博客卡" />
            </SpField>

            <SpField label="正则" hint="冒号建议写成 [:：],中英文都收">
                <SpInput mono v-model="pattern" placeholder="\\[博客[:：](.+?)\\|([\\s\\S]+?)\\]" />
            </SpField>

            <SpField label="修饰符" hint="只认 i(忽略大小写)/ s(点匹配换行)/ m(多行)">
                <SpInput mono v-model="flags" :maxlength="3" placeholder="留空即可" />
            </SpField>

            <SpField label="渲染成什么">
                <SpSelect v-model="card" :options="cardOptions" />
            </SpField>

            <SpField label="标题取第几组">
                <SpSelect v-model="slotTitle" :options="slotOptions" />
            </SpField>
            <SpField label="正文取第几组">
                <SpSelect v-model="slotBody" :options="slotOptions" />
            </SpField>
            <SpField label="附注取第几组">
                <SpSelect v-model="slotMeta" :options="slotOptions" />
            </SpField>

            <SpField label="示例" hint="这一句会原样告诉 AI,让它知道该怎么写">
                <SpTextarea v-model="sample" :rows="2" placeholder="[博客:今天的海|风大得站不住。]" />
            </SpField>

            <div class="sp-rule-test">
                <p v-if="test && !test.ok" class="sp-note is-danger">{{ test.error }}</p>
                <div v-else-if="test" class="sp-rule-preview">
                    <template v-for="(block, i) in test.blocks" :key="i">
                        <div v-if="block.kind === 'card'" class="sp-card-slot" v-html="block.html"></div>
                        <p v-else class="sp-rule-plain">{{ block.text }}</p>
                    </template>
                </div>
            </div>

            <template #footer>
                <button class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button class="ac-btn ac-btn-primary" @click="onSave">保存</button>
            </template>
        </SpModal>
    `,
};

const ClipEdit = {
    name: 'SpClipEditModal',
    components: { ...SHARED_COMPONENTS, SpModal },
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close', 'notify'],
    data() {
        const clip = this.payload.isNew ? null : findById(store.getClips(), this.payload.id);
        return {
            isNew: Boolean(this.payload.isNew),
            clipId: clip?.id || '',
            title: clip?.title || this.payload.title || '',
            content: clip?.content || this.payload.content || '',
            tag: clip?.tag || '',
        };
    },
    methods: {
        onSave() {
            const title = this.title.trim() || truncate(this.content, 12) || '未命名文案';
            const patch = { title, content: this.content, tag: this.tag.trim() };
            if (this.isNew) store.addClip(patch);
            else store.updateClip(this.clipId, patch);
            this.$emit('close');
            this.$emit('notify', '存好了');
        },
    },
    template: `
        <SpModal :title="isNew ? '新建文案' : '改这条文案'" wide @close="$emit('close')">
            <SpField label="标题">
                <SpInput v-model="title" :maxlength="24" placeholder="留空就用内容开头" />
            </SpField>
            <SpField label="标签" hint="可以不填。填了能在上面按标签筛">
                <SpInput v-model="tag" :maxlength="12" placeholder="比如:日常" />
            </SpField>
            <SpField label="内容">
                <SpTextarea v-model="content" :rows="5" placeholder="傍晚下起雨,我躲进街角那家便利店……" />
            </SpField>
            <template #footer>
                <button class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button class="ac-btn ac-btn-primary" @click="onSave">保存</button>
            </template>
        </SpModal>
    `,
};

// ============================================================
// 小剧场
// ============================================================

const PickTheater = {
    name: 'SpPickTheaterModal',
    components: { ...SHARED_COMPONENTS, SpModal },
    emits: ['close', 'notify'],
    data() { return { list: [], loading: true, asMessages: true, busy: false }; },
    methods: {
        async load() {
            this.loading = true;
            try { this.list = await store.listTheaterChoices(); } finally { this.loading = false; }
        },
        async pick(theater) {
            this.busy = true;
            try {
                const result = await store.adoptTheater(theater.id, { asMessages: this.asMessages });
                this.$emit('close');
                this.$emit('notify', result.ok ? `接住了《${theater.title}》` : result.error);
            } finally { this.busy = false; }
        },
    },
    mounted() { void this.load(); },
    template: `
        <SpModal title="接住一场小剧场" subtitle="来自四叶草购物" wide @close="$emit('close')">
            <SpSwitch
                v-model="asMessages"
                label="把台词也搬进来"
                hint="关掉的话只作为「前情」进上下文,存档里看不到那些台词"
            />
            <SpSpinner v-if="loading" label="正在问四叶草…" />
            <SpEmpty
                v-else-if="!list.length"
                icon-name="theater"
                text="没找到小剧场"
                hint="四叶草里演过之后才会出现在这里"
            />
            <div v-else class="sp-theater-list">
                <button
                    v-for="t in list"
                    :key="t.id"
                    type="button"
                    class="sp-theater-card"
                    :disabled="busy"
                    @click="pick(t)"
                >
                    <span class="sp-theater-title">{{ t.title }}</span>
                    <span class="sp-theater-sum">{{ t.summary }}</span>
                </button>
            </div>
            <template #footer>
                <button class="ac-btn ac-btn-secondary" @click="$emit('close')">关掉</button>
            </template>
        </SpModal>
    `,
};

// ============================================================
// 确认删除
// ============================================================

/**
 * 一个组件管所有删除。
 *
 * 文案里带上名字和后果 —— 「确定删除吗」这种问法用户答不上来,
 * 他既不知道要删的是哪个,也不知道会连带丢什么。
 */
const ConfirmDelete = {
    name: 'SpConfirmDeleteModal',
    components: { ...SHARED_COMPONENTS, SpModal },
    props: {
        payload: { type: Object, default: () => ({}) },
        kind: { type: String, default: 'scene' },
    },
    emits: ['close', 'notify'],
    computed: {
        copy() {
            return {
                scene: { title: '删掉这个情景?', note: '它名下的所有存档和消息会一起删掉,找不回来。' },
                save: { title: '删掉这个存档?', note: '这一条线的全部内容都会没有。' },
                message: { title: '删掉这一条?', note: '只删这一条,后面的留着。' },
                theme: { title: '删掉这套外观?', note: '用它的情景会回落到第一套外观。' },
                rule: { title: '删掉这条正则?', note: '用到它的情景会自动取消启用。已经生成的内容不受影响。' },
                clip: { title: '删掉这条文案?', note: '已经「写进情景」的内容不受影响,「引用」它的情景会少一段。' },
            }[this.kind] || { title: '删掉?', note: '' };
        },
    },
    methods: {
        async onConfirm() {
            const id = this.payload.id;
            if (this.kind === 'scene') await store.removeScene(id);
            else if (this.kind === 'save') await store.removeSave(id);
            else if (this.kind === 'message') await store.removeMessage(id);
            else if (this.kind === 'theme') store.removeTheme(id);
            else if (this.kind === 'rule') store.removeRule(id);
            else if (this.kind === 'clip') store.removeClip(id);
            this.$emit('close');
            this.$emit('notify', '已删除');
        },
    },
    template: `
        <SpModal :title="copy.title" :subtitle="payload.name || ''" @close="$emit('close')">
            <p class="sp-modal-text">{{ copy.note }}</p>
            <template #footer>
                <button class="ac-btn ac-btn-secondary" @click="$emit('close')">再想想</button>
                <button class="ac-btn ac-btn-danger" @click="onConfirm">删除</button>
            </template>
        </SpModal>
    `,
};

export const MODAL_COMPONENTS = {
    SpSceneEditModal: SceneEdit,
    SpSceneCategoryModal: SceneCategory,
    SpCategoryEditModal: CategoryEdit,
    SpSaveRenameModal: SaveRename,
    SpSaveForkModal: SaveFork,
    SpSaveOverwriteModal: SaveOverwrite,
    SpRerollModal: Reroll,
    SpManualMessageModal: ManualMessage,
    SpThemeNewModal: ThemeNew,
    SpThemeRenameModal: ThemeRename,
    SpPickBubbleModal: PickBubble,
    SpPaletteSaveModal: PaletteSave,
    SpRegexEditModal: RegexEdit,
    SpClipEditModal: ClipEdit,
    SpPickTheaterModal: PickTheater,
    SpConfirmDeleteModal: ConfirmDelete,
};
