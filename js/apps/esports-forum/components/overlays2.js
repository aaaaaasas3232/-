/**
 * 声浪 · 覆盖页（二）：身份与小号 / 社媒联动 / 提示词透明 / 存档 / 阶段卡 / 结局
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { composer } from '../services/prompt-builder.js';
import { listSocialInfluenceProviders } from '@/src/core/social-influence-registry.js';
import { asArray, fmtTime } from '../utils.js';

const EfOverlayHead = {
    name: 'EfOverlayHead',
    components: { ...UI },
    props: {
        title: { type: String, default: '' },
        sub: { type: String, default: '' },
    },
    emits: ['back'],
    template: `
        <header class="ef-overlay__head">
            <button type="button" class="ef-overlay__back" @click="$emit('back')"><EfIcon name="back" :size="18" /></button>
            <div class="ef-overlay__title"><b>{{ title }}</b><i v-if="sub">{{ sub }}</i></div>
            <slot></slot>
        </header>
    `,
};

// ============================================================
// 身份与小号
// ============================================================

export const EfIdentitiesPage = {
    name: 'EfIdentitiesPage',
    components: { ...UI, EfOverlayHead },
    data() {
        return { renameId: '', renameDraft: '' };
    },
    computed: {
        s() { return store.getState(); },
        identities() { return asArray(this.s.profile?.identities); },
    },
    methods: {
        back() { store.setView(''); },
        add() { store.openModal({ type: 'new-identity' }); },
        startRename(i) { this.renameId = i.id; this.renameDraft = i.name; },
        async confirmRename() {
            await store.renameIdentity(this.renameId, this.renameDraft);
            this.renameId = '';
        },
        remove(i) { store.removeIdentity(i.id); },
    },
    template: `
        <div class="ef-overlay">
            <EfOverlayHead title="身份与小号" sub="最多 5 个马甲" @back="back">
                <EfBtn size="sm" variant="ink" iconName="plus" @click="add">开小号</EfBtn>
            </EfOverlayHead>
            <div class="ef-overlay__body">
                <p class="ef-note">电竞选手掉码很严重 —— 论坛里你永远以马甲示人。发帖和回帖时可以任选身份；murmur 里的 AI 绝不知道这些马甲是你（除非你亲口说）。别的选手也可能有小号，也可能改 ID……如果你留意得够久。</p>
                <div v-for="i in identities" :key="i.id" class="ef-identrow" :class="{ 'is-main': i.isMain }">
                    <EfIcon :name="i.isMain ? 'me' : 'ghost'" :size="17" />
                    <template v-if="renameId === i.id">
                        <input class="ef-input is-mini" v-model.trim="renameDraft" maxlength="16" @keyup.enter="confirmRename" />
                        <EfBtn size="sm" variant="soft" @click="confirmRename">好</EfBtn>
                    </template>
                    <template v-else>
                        <span class="ef-identrow__name"><b>{{ i.name }}</b><i>{{ i.isMain ? '主马甲（首配创建）' : '小号' }}</i></span>
                        <EfBtn size="sm" variant="ghost" iconName="edit" @click="startRename(i)">改名</EfBtn>
                        <EfBtn v-if="!i.isMain" size="sm" variant="ghost" iconName="trash" @click="remove(i)">注销</EfBtn>
                    </template>
                </div>
            </div>
        </div>
    `,
};

// ============================================================
// 社媒联动（氧气 / 萤火）
// ============================================================

export const EfSocialPage = {
    name: 'EfSocialPage',
    components: { ...UI, EfOverlayHead },
    computed: {
        s() { return store.getState(); },
        prefs() { return this.s.profile?.socialPrefs || {}; },
        teams() { return asArray(this.s.roster?.teams).filter((t) => t.id !== this.s.profile?.userTeamId); },
        teammates() { return store.userTeammates(); },
        visibleTeams() { return new Set(asArray(this.prefs.visibleTeamIds)); },
        hiddenPlayers() { return new Set(asArray(this.prefs.hiddenPlayerIds)); },
    },
    methods: {
        back() { store.setView(''); },
        teamName(id) { return store.teamNameOf(id); },
        toggle(key) { store.setSocialPrefs({ [key]: this.prefs[key] === false }); },
        toggleTeam(id) { store.toggleVisibleTeam(id); },
        togglePlayer(id) { store.toggleHiddenPlayer(id); },
        playersOf(teamId) { return store.playersOfTeam(teamId, { includeSub: false }); },
    },
    template: `
        <div class="ef-overlay">
            <EfOverlayHead title="社媒联动" sub="氧气与萤火里的电竞圈" @back="back" />
            <div class="ef-overlay__body">
                <p class="ef-note">队友与战队官博会「注册」进氧气 / 萤火：他们与你互关、在你动态下互动，官博按热度收获评论。这里决定谁会出现（内容在那两个 App 生成时才产生，这里零 token）。</p>

                <EfSection title="总开关">
                    <label class="ef-checkline">
                        <input type="checkbox" :checked="prefs.syncTeammates !== false" @change="toggle('syncTeammates')" />
                        <span>队友与我互关（他们会出现在氧气 / 萤火）</span>
                    </label>
                    <label class="ef-checkline">
                        <input type="checkbox" :checked="prefs.officialBlogs !== false" @change="toggle('officialBlogs')" />
                        <span>战队官博自动注册（按热度收获评论）</span>
                    </label>
                </EfSection>

                <EfSection title="我的队友" sub="取消勾选 = 这个人不出现在社媒">
                    <label v-for="p in teammates" :key="p.id" class="ef-checkline">
                        <input type="checkbox" :checked="!hiddenPlayers.has(p.id)" @change="togglePlayer(p.id)" />
                        <span>{{ p.gameId }}{{ p.isSub ? '（替补）' : '' }}</span>
                    </label>
                </EfSection>

                <EfSection title="其他战队" sub="勾选的战队选手也会活跃在社媒">
                    <div v-for="t in teams" :key="t.id" class="ef-socialteam">
                        <label class="ef-checkline">
                            <input type="checkbox" :checked="visibleTeams.has(t.id)" @change="toggleTeam(t.id)" />
                            <span><b>{{ teamName(t.id) }}</b></span>
                        </label>
                        <div v-if="visibleTeams.has(t.id)" class="ef-socialteam__players">
                            <label v-for="p in playersOf(t.id)" :key="p.id" class="ef-checkline is-sub">
                                <input type="checkbox" :checked="!hiddenPlayers.has(p.id)" @change="togglePlayer(p.id)" />
                                <span>{{ p.gameId }}</span>
                            </label>
                        </div>
                    </div>
                </EfSection>
            </div>
        </div>
    `,
};

// ============================================================
// 提示词透明
// ============================================================

export const EfPromptsPage = {
    name: 'EfPromptsPage',
    components: { ...UI, EfOverlayHead },
    data() {
        return { openScope: '' };
    },
    computed: {
        s() { return store.getState(); },
        providers() {
            return [
                ...listSocialInfluenceProviders('blog'),
                ...listSocialInfluenceProviders('youtube'),
            ].filter((p, i, arr) => p.sourceAppId === 'esports-forum'
                && arr.findIndex((x) => x.key === p.key) === i);
        },
        prefs() { return this.s.profile?.providerPrefs || {}; },
        snapshots() {
            const save = this.s.save;
            const scopes = [
                { scope: `board::general`, label: '板块 AI 帖（最近一次）' },
                { scope: save ? `skip::${save.id}` : '', label: '快进叙事（最近一次）' },
                { scope: save ? `ending::${save.id}` : '', label: '生涯结局（最近一次）' },
            ];
            return scopes
                .filter((x) => x.scope)
                .map((x) => ({ ...x, text: composer.load(x.scope), at: composer.savedAt(x.scope) }))
                .filter((x) => x.text);
        },
    },
    methods: {
        back() { store.setView(''); },
        toggleProvider(key) { store.toggleProviderPref(key); },
        fmtAt(ts) { return ts ? fmtTime(ts) : ''; },
    },
    template: `
        <div class="ef-overlay">
            <EfOverlayHead title="提示词透明" sub="发出去的每一段都在这" @back="back" />
            <div class="ef-overlay__body">
                <EfSection title="社交影响 providers" sub="氧气 / 萤火收集时才读取，永不调 AI">
                    <div v-for="p in providers" :key="p.key" class="ef-liferow">
                        <span>{{ p.label }}</span>
                        <label class="ef-checkline">
                            <input type="checkbox" :checked="!prefs[p.key]" @change="toggleProvider(p.key)" />
                            <span>{{ prefs[p.key] ? '已关' : '开启' }}</span>
                        </label>
                    </div>
                    <p class="ef-note">murmur 侧还有两张卡：「记得用户是电竞选手」与「生涯概要」，在 murmur 的回复提示词页可见可关。</p>
                </EfSection>

                <EfSection title="最近的实际发送内容" sub="预览与发送来自同一次拼装">
                    <div v-for="snap in snapshots" :key="snap.scope" class="ef-snaprow">
                        <button type="button" class="ef-snaprow__head" @click="openScope = openScope === snap.scope ? '' : snap.scope">
                            <b>{{ snap.label }}</b>
                            <i>{{ fmtAt(snap.at) }}</i>
                            <EfIcon name="chevron" :size="14" />
                        </button>
                        <pre v-if="openScope === snap.scope" class="ef-snaprow__pre">{{ snap.text }}</pre>
                    </div>
                    <EfEmpty v-if="!snapshots.length" iconName="prompt" title="还没发送过任何生成请求" />
                </EfSection>
            </div>
        </div>
    `,
};

// ============================================================
// 存档
// ============================================================

export const EfSavesPage = {
    name: 'EfSavesPage',
    components: { ...UI, EfOverlayHead },
    computed: {
        s() { return store.getState(); },
        saves() { return this.s.saves; },
    },
    methods: {
        back() { store.setView(''); },
        newSave() { store.openModal({ type: 'new-save' }); },
        load(id) { store.switchSave(id); },
        remove(id) { store.openModal({ type: 'confirm-delete-save', saveId: id }); },
        dayOf(save) { return save.clock?.day || 1; },
    },
    template: `
        <div class="ef-overlay">
            <EfOverlayHead title="存档" sub="新开档时间回到原点，阶段卡不删" @back="back">
                <EfBtn size="sm" variant="ink" iconName="plus" @click="newSave">开新档</EfBtn>
            </EfOverlayHead>
            <div class="ef-overlay__body">
                <div v-for="save in saves" :key="save.id" class="ef-saverow" :class="{ 'is-on': s.save && s.save.id === save.id }">
                    <div class="ef-saverow__main">
                        <b>{{ save.name }}</b>
                        <i>第 {{ dayOf(save) }} 天 · {{ save.honors ? save.honors.length : 0 }} 项荣誉{{ save.endingText ? ' · 已写结局' : '' }}</i>
                    </div>
                    <EfBtn v-if="!s.save || s.save.id !== save.id" size="sm" variant="soft" @click="load(save.id)">读档</EfBtn>
                    <EfTag v-else tone="success">当前</EfTag>
                    <EfBtn size="sm" variant="ghost" iconName="trash" @click="remove(save.id)"></EfBtn>
                </div>
                <p class="ef-note">删档会回收这一档写进世界观时间轴的大事；开新档可以选择回收人设改写，让 nook 里的你回到干净状态。</p>
            </div>
        </div>
    `,
};

// ============================================================
// 阶段卡
// ============================================================

export const EfStageCardsPage = {
    name: 'EfStageCardsPage',
    components: { ...UI, EfOverlayHead },
    computed: {
        s() { return store.getState(); },
        cards() { return this.s.stageCards; },
    },
    methods: {
        back() { store.setView(''); },
        remove(id) { store.deleteStageCard(id); },
    },
    template: `
        <div class="ef-overlay">
            <EfOverlayHead title="阶段卡" sub="人设阶段的封存快照，跨档保留" @back="back" />
            <div class="ef-overlay__body">
                <div v-for="card in cards" :key="card.id" class="ef-stagecard">
                    <div class="ef-stagecard__head">
                        <b>{{ card.title }}</b>
                        <span>{{ card.entityType === 'user' ? '用户' : 'AI' }} · 第{{ card.day }}天</span>
                        <EfBtn size="sm" variant="ghost" iconName="trash" @click="remove(card.id)"></EfBtn>
                    </div>
                    <p class="ef-stagecard__body">{{ card.content }}</p>
                </div>
                <EfEmpty v-if="!cards.length" iconName="save" title="还没有阶段卡" desc="大事发生时可以选择「存成阶段卡」；回档不会删它们" />
            </div>
        </div>
    `,
};

// ============================================================
// 结局
// ============================================================

export const EfEndingPage = {
    name: 'EfEndingPage',
    components: { ...UI, EfOverlayHead },
    computed: {
        s() { return store.getState(); },
        text() { return this.s.save?.endingText || ''; },
    },
    methods: {
        back() { store.setView(''); },
    },
    template: `
        <div class="ef-overlay">
            <EfOverlayHead title="生涯结局" :sub="s.save ? s.save.name : ''" @back="back" />
            <div class="ef-overlay__body">
                <article v-if="text" class="ef-ending">{{ text }}</article>
                <EfEmpty v-else iconName="flag" title="还没写结局" desc="在「我的」页里随时可以生成" />
            </div>
        </div>
    `,
};
