/**
 * 赛点 · 好友
 *
 * 互关列表（队友 NPC + 世界 AI）：亲密值 / 情侣标 / 游戏邀请 /
 * 生成今日战绩（确定性揭示，可分享到 murmur 八卦）。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { intimacyLevelLabel } from '../constants.js';
import { asArray } from '../utils.js';

export const EgFriendsPage = {
    name: 'EgFriendsPage',
    components: { ...UI },
    data() {
        return { records: {} };
    },
    computed: {
        s() { return store.getState(); },
        career() { return this.s.career; },
        companions() { return store.companionOptions(); },
        ais() { return this.companions.filter((c) => c.type === 'ai'); },
        npcs() { return this.companions.filter((c) => c.type === 'npc'); },
    },
    methods: {
        relOf(id) { return store.relationOf(id); },
        levelOf(id) { return intimacyLevelLabel(this.relOf(id)?.intimacy || 0); },
        openFriend(c) { store.setView('friend', { targetId: c.id }); },
        async invite(c) {
            const result = await store.sendInvite(c);
            if (!result.ok && result.error) store.showToast(result.error);
        },
        async reveal(c) {
            const person = this.personOf(c);
            if (!person) return;
            const record = await store.revealDailyRecord(person);
            if (record) this.records = { ...this.records, [c.id]: record };
        },
        personOf(c) {
            if (c.type === 'npc') {
                return asArray(this.career?.teammates).find((p) => p.id === c.id) || null;
            }
            // AI：拼一个最小 person（战绩生成只需要 id / 名字 / 大致实力）
            return { id: c.id, gameId: c.name, realName: c.name, attrs: { mechanics: c.power, awareness: c.power } };
        },
        recordOf(c) { return this.records[c.id] || null; },
        seen(c) { return store.recordSeen(c.id); },
        shareRecord(c) {
            store.openModal({ type: 'share-record', record: this.recordOf(c) });
        },
    },
    template: `
        <div class="eg-page">
            <p class="eg-note">战队里的人默认和你互关，rank 记录彼此可见；AI 伙伴一起打过之后也会出现在这里。亲密值只涨在一起玩的时刻。</p>

            <EgSection title="AI 伙伴" sub="可以发游戏邀请、绑情侣标">
                <div v-for="c in ais" :key="c.id" class="eg-friendrow">
                    <button type="button" class="eg-friendrow__who" @click="openFriend(c)">
                        <EgAvatar :name="c.name" :hue="180" :size="38" />
                        <span class="eg-friendrow__name">
                            <b>{{ c.name }}<EgTag v-if="relOf(c.id) && relOf(c.id).coupleTag" tone="love">{{ relOf(c.id).coupleTag.name }}</EgTag></b>
                            <i>{{ levelOf(c.id) }} · 亲密 {{ relOf(c.id) ? relOf(c.id).intimacy : 0 }}</i>
                        </span>
                    </button>
                    <EgBtn size="sm" variant="soft" iconName="invite" @click="invite(c)">邀请</EgBtn>
                </div>
                <EgEmpty v-if="!ais.length" iconName="users" title="这个世界还没有绑定的 AI" desc="去 nook 给世界绑几个 AI，就能一起双排了" />
            </EgSection>

            <EgSection title="我的战队" sub="点进去看能力面板与今日战绩">
                <div v-for="c in npcs" :key="c.id" class="eg-friendrow">
                    <button type="button" class="eg-friendrow__who" @click="openFriend(c)">
                        <EgAvatar :name="c.name" :hue="(c.id.length * 47) % 360" :size="38" />
                        <span class="eg-friendrow__name">
                            <b>{{ c.name }}</b>
                            <i>{{ c.desc }} · {{ levelOf(c.id) }}</i>
                        </span>
                    </button>
                    <EgBtn v-if="!recordOf(c)" size="sm" variant="ghost" iconName="rank" @click="reveal(c)">{{ seen(c) ? '再看战绩' : '今日战绩' }}</EgBtn>
                </div>
                <div v-for="c in npcs" :key="c.id + '::rec'">
                    <div v-if="recordOf(c)" class="eg-recordcard">
                        <b>{{ recordOf(c).name }} 今天打了 {{ recordOf(c).games }} 把：{{ recordOf(c).wins }}胜{{ recordOf(c).losses }}负{{ recordOf(c).lateNight ? '（熬到后半夜）' : '' }}</b>
                        <i>常用：{{ recordOf(c).heroes.join('、') }} · 具体对局内容不可见</i>
                        <div class="eg-inline">
                            <EgBtn size="sm" variant="soft" iconName="share" @click="shareRecord(c)">分享到 murmur</EgBtn>
                        </div>
                    </div>
                </div>
            </EgSection>
        </div>
    `,
};
