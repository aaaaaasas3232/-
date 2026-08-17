/**
 * 日记 · 日记本切换
 *
 * 列出「我的」和「这个世界观下每个 AI 的」日记本。
 *
 * ── AI 的本子必须先由 AI 自己布置 ────────────────────────────────
 *
 * 产品要求：「如果要看某个 AI 的日记，那就让某个 AI 调取 API 配置完毕
 * 才能进入日记空间。AI 可以自己配置自己日记空间的主题色跟风格，
 * 某个 AI 的主题颜色可能不同。」
 *
 * 所以未配置的本子是**锁着**的：卡片压暗，点进去只有一个
 * 「让 TA 布置」按钮，走一次真实 API 调用（`store.configureAiSpace`）。
 * 那次调用返回 JSON，里面是 TA 自己挑的名字 / 主题 / 纸张 / 写作时段 / 口吻。
 *
 * 不给「手动帮 TA 选一套」的旁路 —— 有旁路的话这个设定就不成立了。
 * 但布置失败时的错误提示必须说清楚去哪儿修 API，否则用户会卡死在这一步。
 *
 * ── AI 列表从哪来 ────────────────────────────────────────────────
 *
 * 「默认用户人设绑定的世界观」下的 AI 人设。这条链路收在
 * `nook-bridge` 里，这一页只调 `listWorldAis(getBoundWorld())`。
 */

import * as store from '../store.js';
import { presets as LP } from '@/src/core/presets/index.js';
import { SHARED_COMPONENTS } from './shared.js';
import { OWNER_KIND, THEMES, makeSpaceId } from '../constants.js';
import * as nook from '../services/nook-bridge.js';

export const DyBooks = {
    name: 'DyBooks',
    components: { ...SHARED_COMPONENTS },
    computed: {
        state() { return store.getState(); },
        busy() { return this.state.busy; },
        activeId() { return this.state.activeSpaceId; },

        world() { return nook.getBoundWorld(nook.getDefaultUser()); },
        worldName() { return this.world?.name || '未绑定世界观'; },

        mine() {
            const space = store.getUserSpace();
            if (!space) return null;
            const user = nook.getDefaultUser();
            return {
                id: space.id,
                name: space.title || `${user?.name || '我'}的日记`,
                sub: this.describeCounts(space.id),
                theme: space.theme,
                locked: false,
                isMe: true,
            };
        },

        /** 世界观下的 AI，每个对应一本日记 */
        others() {
            const ais = nook.listWorldAis(this.world);
            return ais.map((ai) => {
                const id = makeSpaceId(OWNER_KIND.AI, ai.id);
                const space = store.getSpace(id);
                const configured = space?.configured === true;
                return {
                    id,
                    aiId: ai.id,
                    name: configured ? (space.title || `${ai.name}的日记`) : ai.name,
                    sub: configured
                        ? (space.styleNote || this.describeCounts(id))
                        : '还没有布置自己的日记本',
                    theme: configured ? space.theme : '',
                    locked: !configured,
                    isMe: false,
                };
            });
        },

        apiHint() {
            const ref = nook.resolveApiRef({ ownerCard: nook.getDefaultUser() });
            return nook.describeApiRef(ref);
        },
    },
    methods: {
        describeCounts(spaceId) {
            const entries = store.entriesOf(spaceId).filter((e) => String(e.content).trim()).length;
            const notes = store.notesOf(spaceId).length;
            if (!entries && !notes) return '还是空的';
            const parts = [];
            if (entries) parts.push(`${entries} 篇`);
            if (notes) parts.push(`${notes} 张便利贴`);
            return parts.join(' · ');
        },
        themeName(id) {
            return THEMES.find((t) => t.id === id)?.name || '';
        },

        open(book) {
            if (book.locked) {
                this.setup(book);
                return;
            }
            store.openSpace(book.id);
        },

        async setup(book) {
            if (this.busy) return;
            const ok = await LP.modals.confirm({
                title: `让 ${book.name} 布置日记本`,
                message: '会调用 TA 绑定的 API，让 TA 自己挑名字、颜色、纸张和写日记的时间。',
                okLabel: '开始',
            });
            if (!ok) return;

            const result = await store.configureAiSpace(book.aiId);
            if (!result.ok) {
                LP.modals.alert({ title: '布置失败', message: result.error || '再试一次' });
                return;
            }
            const s = result.space;
            store.toast(`${s.title || '日记本'} · ${this.themeName(s.theme)}`);
            store.openSpace(s.id);
        },

        async redo(book) {
            const ok = await LP.modals.confirm({
                title: '让 TA 重新布置',
                message: '名字、颜色、纸张和写作时段会被重新挑一遍。写过的日记不会动。',
                okLabel: '重新布置',
            });
            if (!ok) return;
            const result = await store.configureAiSpace(book.aiId);
            if (!result.ok) {
                LP.modals.alert({ title: '布置失败', message: result.error || '再试一次' });
                return;
            }
            store.toast('重新布置好了');
        },
    },
    template: `
    <div>
        <DySection title="我的">
            <div v-if="mine" class="dy-books">
                <button
                    type="button" class="dy-book"
                    :class="{ 'is-active': activeId === mine.id }"
                    :data-diary-theme="mine.theme"
                    @click="open(mine)"
                >
                    <span class="dy-book__spine"></span>
                    <span class="dy-book__main">
                        <span class="dy-book__name">{{ mine.name }}</span>
                        <span class="dy-book__sub">{{ mine.sub }}</span>
                    </span>
                    <span class="dy-book__state">{{ activeId === mine.id ? '正在看' : '' }}</span>
                </button>
            </div>
            <DyEmpty v-else icon-name="user" text="还没有默认用户人设，去 nook 里设一个" />
        </DySection>

        <DySection title="TA 们的" :note="worldName">
            <div v-if="others.length" class="dy-books">
                <div v-for="b in others" :key="b.id">
                    <button
                        type="button" class="dy-book"
                        :class="{ 'is-active': activeId === b.id, 'is-locked': b.locked }"
                        :data-diary-theme="b.theme || null"
                        :disabled="!!busy"
                        @click="open(b)"
                    >
                        <span class="dy-book__spine"></span>
                        <span class="dy-book__main">
                            <span class="dy-book__name">{{ b.name }}</span>
                            <span class="dy-book__sub">{{ b.sub }}</span>
                        </span>
                        <span class="dy-book__state">
                            <template v-if="b.locked">
                                <DyIcon name="lock" />
                            </template>
                            <template v-else>{{ activeId === b.id ? '正在看' : themeName(b.theme) }}</template>
                        </span>
                    </button>
                    <div v-if="b.locked" class="dy-btnbar" style="margin:6px 0 4px;">
                        <DyBtn size="sm" icon-name="quill" :disabled="!!busy" @click="setup(b)">让 TA 布置</DyBtn>
                    </div>
                    <div v-else-if="activeId === b.id" class="dy-btnbar" style="margin:6px 0 4px;">
                        <DyBtn size="sm" variant="ghost" icon-name="refresh" :disabled="!!busy" @click="redo(b)">
                            让 TA 重新布置
                        </DyBtn>
                    </div>
                </div>
            </div>
            <DyEmpty v-else icon-name="globe" text="这个世界观下还没有 AI 人设" />
        </DySection>

        <DyBusy v-if="busy" :text="busy" />

        <p class="dy-small dy-muted" style="margin-top:18px;line-height:1.9;">
            布置日记本会用到 API：{{ apiHint.label }}<br />
            <span v-if="apiHint.sub">{{ apiHint.sub }}</span>
        </p>
    </div>
    `,
};

export default DyBooks;
