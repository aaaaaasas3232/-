/**
 * 赛点 · 覆盖页：场次详情（对局列表 + 云端回放）/ 好友主页
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { COUPLE_TAG_GATE, intimacyLevelLabel } from '../constants.js';
import { asArray, deltaText } from '../utils.js';

const EgOverlayHead = {
    name: 'EgOverlayHead',
    components: { ...UI },
    props: {
        title: { type: String, default: '' },
        sub: { type: String, default: '' },
    },
    emits: ['back'],
    template: `
        <header class="eg-overlay__head">
            <button type="button" class="eg-overlay__back" @click="$emit('back')"><EgIcon name="back" :size="18" /></button>
            <div class="eg-overlay__title"><b>{{ title }}</b><i v-if="sub">{{ sub }}</i></div>
            <slot></slot>
        </header>
    `,
};

// ============================================================
// 场次详情
// ============================================================

export const EgSessionPage = {
    name: 'EgSessionPage',
    components: { ...UI, EgOverlayHead },
    data() {
        return {
            matches: [],
            openMatchId: '',
            replayError: '',
            revealCount: 0,
            revealMode: false,
        };
    },
    computed: {
        s() { return store.getState(); },
        sessionId() { return this.s.viewPayload?.sessionId || ''; },
        session() { return this.s.sessions.find((x) => x.id === this.sessionId) || null; },
        visibleMatches() {
            return this.revealMode ? this.matches.slice(0, this.revealCount) : this.matches;
        },
        allRevealed() { return !this.revealMode || this.revealCount >= this.matches.length; },
        replayLoading() { return this.s.loading.replay; },
    },
    async mounted() {
        this.matches = await store.matchesOfSession(this.sessionId);
        this.revealMode = Boolean(this.s.viewPayload?.reveal);
        this.revealCount = this.revealMode ? 0 : this.matches.length;
    },
    methods: {
        back() { store.setView(''); },
        next() { this.revealCount = Math.min(this.matches.length, this.revealCount + 1); },
        toggleMatch(m) {
            this.openMatchId = this.openMatchId === m.id ? '' : m.id;
            this.replayError = '';
        },
        async replay(m) {
            this.replayError = '';
            const result = await store.generateReplay(m.id);
            if (!result.ok) {
                this.replayError = result.error || '';
            } else {
                const row = this.matches.find((x) => x.id === m.id);
                if (row) row.replay = result.replay;
            }
        },
        shareMatch(m) {
            store.openModal({ type: 'share-match', match: m, modeLabel: this.session?.modeLabel || '排位' });
        },
        shareSession() {
            store.openModal({ type: 'share-session', session: this.session });
        },
        dText(v) { return deltaText(v); },
        companionText(m) {
            const names = asArray(m.companions).map((c) => c.name);
            return names.length ? `与 ${names.join('、')}` : '单排';
        },
    },
    template: `
        <div class="eg-overlay">
            <EgOverlayHead :title="session ? session.modeLabel : '场次'" :sub="session ? ('第' + session.day + '天 · ' + session.wins + '胜' + session.losses + '负') : ''" @back="back">
                <EgBtn size="sm" variant="soft" iconName="share" @click="shareSession">分享</EgBtn>
            </EgOverlayHead>
            <div class="eg-overlay__body" v-if="session">
                <div class="eg-sessummary">
                    <b>{{ session.ratingBefore }} → {{ session.ratingAfter }}</b>
                    <span :class="session.ratingDelta >= 0 ? 'is-up' : 'is-down'">{{ dText(session.ratingDelta) }}</span>
                </div>

                <div v-for="m in visibleMatches" :key="m.id" class="eg-matchcard" :class="m.win ? 'is-win' : 'is-lose'">
                    <button type="button" class="eg-matchcard__head" @click="toggleMatch(m)">
                        <b>{{ m.win ? '胜' : '负' }}</b>
                        <span class="eg-matchcard__meta">
                            <i>第 {{ m.seq }} 局 · {{ m.hero }} · {{ m.kdaText }}{{ m.mvp ? ' · MVP' : '' }}</i>
                            <em>{{ companionText(m) }} · {{ m.duration }}分钟 · {{ dText(m.ratingDelta) }}</em>
                        </span>
                        <EgIcon name="chevron" :size="14" />
                    </button>
                    <div v-if="openMatchId === m.id" class="eg-matchcard__body">
                        <p class="eg-note">路人队友：{{ (m.passerbys || []).join('、') || '无' }}{{ m.hungry ? ' · 这局饿着打的' : '' }} · 掷签 {{ Math.round(m.chance * 100) }}% / roll {{ m.roll }}</p>
                        <template v-if="m.replay">
                            <p class="eg-replay">{{ m.replay }}</p>
                        </template>
                        <template v-else>
                            <EgLoading v-if="replayLoading === m.id" :lines="['正在从云端获取对局回放', '拉取镜头数据', '整理时间轴']" />
                            <EgBtn v-else size="sm" variant="soft" iconName="cloud" @click="replay(m)">查看对局详情（云端回放）</EgBtn>
                        </template>
                        <p v-if="replayError && openMatchId === m.id" class="eg-error">{{ replayError }}</p>
                        <EgBtn size="sm" variant="ghost" iconName="share" @click="shareMatch(m)">把这局分享到 murmur</EgBtn>
                    </div>
                </div>

                <EgBtn v-if="!allRevealed" variant="blue" iconName="play" block @click="next">翻开下一局</EgBtn>
                <p v-else-if="revealMode" class="eg-note">这一轮打完了。战绩已同步到声浪（论坛围观楼已开），参与的 AI 也会记得这段开黑。</p>
            </div>
        </div>
    `,
};

// ============================================================
// 好友主页
// ============================================================

export const EgFriendPage = {
    name: 'EgFriendPage',
    components: { ...UI, EgOverlayHead },
    computed: {
        s() { return store.getState(); },
        targetId() { return this.s.viewPayload?.targetId || ''; },
        companion() { return store.companionOptions().find((c) => c.id === this.targetId) || null; },
        relation() { return store.relationOf(this.targetId); },
        intimacy() { return this.relation?.intimacy || 0; },
        level() { return intimacyLevelLabel(this.intimacy); },
        couple() { return this.relation?.coupleTag || null; },
        canCouple() { return this.companion?.type === 'ai'; },
        gate() { return COUPLE_TAG_GATE; },
        teammate() {
            return asArray(this.s.career?.teammates).find((p) => p.id === this.targetId) || null;
        },
        attrRows() {
            const attrs = this.teammate?.attrs || {};
            return [
                ['操作', attrs.mechanics], ['意识', attrs.awareness], ['沟通', attrs.comms],
                ['英雄池', attrs.pool], ['心态', attrs.mentality], ['体能', attrs.stamina], ['默契', attrs.synergy],
            ];
        },
        gamesTogether() { return this.relation?.gamesTogether || 0; },
    },
    methods: {
        back() { store.setView(''); },
        invite() {
            if (this.companion) store.sendInvite(this.companion);
        },
        bind() {
            store.openModal({ type: 'bind-couple', targetId: this.targetId, name: this.companion?.name || '' });
        },
        unbind() { store.unbindCouple(this.targetId); },
    },
    template: `
        <div class="eg-overlay">
            <EgOverlayHead :title="companion ? companion.name : '好友'" :sub="companion ? (companion.type === 'ai' ? 'AI 伙伴' : companion.desc) : ''" @back="back" />
            <div class="eg-overlay__body" v-if="companion">
                <div class="eg-idcard">
                    <EgAvatar :name="companion.name" :hue="companion.type === 'ai' ? 180 : 260" :size="52" />
                    <div class="eg-idcard__main">
                        <b>{{ companion.name }}</b>
                        <i>{{ level }} · 互相关注</i>
                        <em v-if="couple">情侣标「{{ couple.name }}」 · 第{{ couple.sinceDay }}天起</em>
                    </div>
                </div>

                <EgSection title="亲密值" :sub="'一起打过 ' + gamesTogether + ' 局'">
                    <EgBar label="亲密" :value="intimacy" kind="love" />
                    <p class="eg-note" v-if="canCouple && !couple">亲密到 {{ gate }} 可以绑情侣标（主页公开展示）。一起排位是唯一的升温方式。</p>
                </EgSection>

                <EgSection v-if="teammate" title="能力面板">
                    <EgBar v-for="[label, v] in attrRows" :key="label" :label="label" :value="v || 0" />
                    <p class="eg-note">{{ teammate.mbti }} · {{ (teammate.traits || []).join('；') }} · 对你：{{ teammate.attitude }}</p>
                </EgSection>

                <div class="eg-inline">
                    <EgBtn v-if="companion.type === 'ai'" variant="blue" iconName="invite" @click="invite">发游戏邀请</EgBtn>
                    <EgBtn v-if="canCouple && !couple" variant="soft" iconName="heartRing" @click="bind">绑情侣标</EgBtn>
                    <EgBtn v-if="couple" variant="danger" iconName="heartRing" @click="unbind">解绑（亲密 -20）</EgBtn>
                </div>
            </div>
        </div>
    `,
};
