/**
 * 人设机 · 人设库(首页)
 *
 * 两段:
 *   1. **在改的** —— 本 App 的草稿。有未保存改动的会标出来。
 *   2. **nook 里的人设卡** —— 用户人设 + AI 人设,点一下拉进来改。
 *
 * ★ 「拉进来」会记下 `personaId`,之后保存**覆盖原卡**而不是新建 ——
 *   这是用户明确要求的行为。同一张卡已经拉过一次时,直接打开那份草稿,
 *   不再拉第二份(否则库里会堆出一串同名草稿,而它们保存时会互相覆盖)。
 */

import { SHARED_COMPONENTS } from './shared.js';
import * as store from '../store.js';
import { listCards, cardToDraftText } from '../services/nook-bridge.js';
import { SCOPES } from '../constants.js';
import { formatRelative, truncate } from '../utils.js';

const SCOPE_FILTERS = [{ id: 'all', label: '全部' }, ...SCOPES.map((s) => ({ id: s.id, label: s.label }))];

export const PlLibrary = {
    name: 'PlLibrary',
    components: { ...SHARED_COMPONENTS },
    props: { app: { type: Object, required: true } },
    emits: ['open', 'notify', 'go-import'],
    data() {
        return { scopeFilter: 'all', SCOPE_FILTERS };
    },
    computed: {
        state() { return store.getState(); },
        drafts() { return this.state.drafts; },
        nookReady() { return this.state.nookReady; },

        /** nook 里的卡。已经拉过的会标出来,不会重复拉。 */
        cards() {
            if (!this.nookReady) return [];
            const bound = new Set(
                this.drafts.filter((d) => d.personaId).map((d) => `${d.scope}:${d.personaId}`),
            );
            return listCards()
                .filter((c) => this.scopeFilter === 'all' || c.scope === this.scopeFilter)
                .map((c) => ({ ...c, pulled: bound.has(`${c.scope}:${c.id}`) }));
        },
    },
    methods: {
        formatRelative,
        truncate,
        isDirty(draft) { return store.isDirty(draft); },

        scopeLabel(scope) {
            return scope === 'user' ? '用户人设' : 'AI 人设';
        },

        draftStatus(draft) {
            if (!draft.personaId) return '还没存进 nook';
            if (this.isDirty(draft)) return '有改动没保存';
            return `已同步 · ${formatRelative(draft.savedAt)}`;
        },

        async onCreate() {
            const draft = await store.createDraft({ scope: 'ai' });
            this.$emit('open', draft.id);
        },

        /** 拉一张 nook 的卡进来改 */
        async onPull(card) {
            const existing = this.drafts.find(
                (d) => d.personaId === card.id && d.scope === card.scope,
            );
            if (existing) {
                this.$emit('notify', '这张卡已经在「在改的」里了,直接接着改');
                this.$emit('open', existing.id);
                return;
            }
            const text = cardToDraftText(card.scope, card.id);
            if (!text.trim()) {
                this.$emit('notify', '这张卡是空的,拉进来只有一副骨架');
            }
            const draft = await store.createDraft({
                scope: card.scope,
                personaId: card.id,
                text: text || undefined,
                title: card.name,
            });
            this.$emit('open', draft.id);
        },

        onDelete(draft) {
            store.openModal('confirm', {
                title: '删掉这份草稿?',
                text: draft.personaId
                    ? '只删本地草稿,nook 里那张人设卡不会动。'
                    : '这份草稿还没存进 nook,删了就找不回来了。',
                danger: true,
                confirmLabel: '删除',
                onConfirm: async () => {
                    await store.removeDraft(draft.id);
                    this.$emit('notify', '草稿已删除');
                },
            });
        },
    },
    template: `
        <div class="pl-library">
            <header class="pl-lib-hero">
                <div class="pl-lib-hero-row">
                    <h1>人设机</h1>
                    <div class="pl-lib-hero-actions">
                        <PlButton label="导入" icon-name="import" variant="ghost" size="sm" @click="$emit('go-import')" />
                        <PlButton label="新建" icon-name="plus" variant="primary" size="sm" @click="onCreate" />
                    </div>
                </div>
                <p>问出来的人设，才知道立不立得住</p>
            </header>

            <!-- 在改的 -->
            <section class="pl-lib-section">
                <PlSectionTitle title="在改的" :hint="drafts.length ? drafts.length + ' 份草稿' : ''" />

                <PlEmpty
                    v-if="!drafts.length"
                    icon-name="spark"
                    title="还没有在改的人设"
                    hint="从下面拉一张 nook 的卡进来，或者直接新建一张空白卡。"
                    action-label="新建一张"
                    @action="onCreate"
                />

                <ul v-else class="pl-card-list">
                    <li v-for="draft in drafts" :key="draft.id">
                        <article class="pl-card" :data-dirty="isDirty(draft) ? '1' : null">
                            <button type="button" class="pl-card-main" @click="$emit('open', draft.id)">
                                <PlAvatar :name="draft.title" :tone="draft.tone" :scope="draft.scope" />
                                <span class="pl-card-body">
                                    <span class="pl-card-title">{{ draft.title }}</span>
                                    <span class="pl-card-sub">{{ truncate(draft.text.replace(/\\n/g, ' · '), 42) }}</span>
                                    <span class="pl-card-meta">
                                        <span class="pl-chip" :data-scope="draft.scope">{{ scopeLabel(draft.scope) }}</span>
                                        <span class="pl-card-status" :data-dirty="isDirty(draft) ? '1' : null">{{ draftStatus(draft) }}</span>
                                    </span>
                                </span>
                            </button>
                            <button type="button" class="pl-card-kill" aria-label="删除草稿" @click="onDelete(draft)">
                                <PlIcon name="trash" />
                            </button>
                        </article>
                    </li>
                </ul>
            </section>

            <!-- nook 人设卡 -->
            <section class="pl-lib-section">
                <PlSectionTitle title="nook 里的人设卡" hint="点一下拉进来改，保存时覆盖原卡">
                    <template #action>
                        <PlSegmented v-model="scopeFilter" :items="SCOPE_FILTERS" />
                    </template>
                </PlSectionTitle>

                <PlSpinner v-if="!nookReady" label="正在连接 nook…" />

                <PlEmpty
                    v-else-if="!cards.length"
                    icon-name="empty"
                    title="这个分类下还没有人设卡"
                    hint="可以在 nook 的「人设」里建一张，或者在这儿新建后保存回去。"
                />

                <ul v-else class="pl-card-list">
                    <li v-for="card in cards" :key="card.scope + ':' + card.id">
                        <article class="pl-card" :data-pulled="card.pulled ? '1' : null">
                            <button type="button" class="pl-card-main" @click="onPull(card)">
                                <PlAvatar :name="card.name" :tone="card.id" :scope="card.scope" />
                                <span class="pl-card-body">
                                    <span class="pl-card-title">
                                        {{ card.name }}
                                        <span v-if="card.isDefaultUser" class="pl-tag">默认「我」</span>
                                        <span v-if="card.variantType && card.variantType !== 'base'" class="pl-tag">{{ card.variantType === 'lifePhase' ? '阶段卡' : '平行卡' }}</span>
                                    </span>
                                    <span v-if="card.subtitle" class="pl-card-sub">{{ card.subtitle }}</span>
                                    <span class="pl-card-meta">
                                        <span class="pl-chip" :data-scope="card.scope">{{ scopeLabel(card.scope) }}</span>
                                        <span class="pl-card-status">{{ card.pulled ? '已在草稿里' : '点击拉进来' }}</span>
                                    </span>
                                </span>
                            </button>
                        </article>
                    </li>
                </ul>
            </section>
        </div>
    `,
};

export default PlLibrary;
