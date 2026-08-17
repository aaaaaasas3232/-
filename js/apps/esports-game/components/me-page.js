/**
 * 赛点 · 我的
 *
 * 游戏主页（巅峰分 / 段位 / 情侣标展示）+ 英雄熟练度（本命练习）+
 * 巅峰分曲线（最近记录）+ 待同步 + 主题。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { PROF_MAX } from '../constants.js';
import { asArray, deltaText } from '../utils.js';

export const EgMePage = {
    name: 'EgMePage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        career() { return this.s.career; },
        gs() { return this.s.gState; },
        ratingLabel() { return store.ratingLabel(); },
        profMax() { return PROF_MAX; },
        practiceRows() {
            const practice = this.gs?.practice || {};
            const pool = store.model().heroPool;
            const rows = pool.map((h) => ({ hero: h, prof: Number(practice[h]) || 0 }));
            return rows.sort((a, b) => b.prof - a.prof).slice(0, 12);
        },
        heroNoun() { return store.model().heroNoun; },
        couples() {
            return this.s.relations.filter((r) => r.coupleTag);
        },
        history() { return asArray(this.gs?.history).slice(-10).reverse(); },
        pendingCount() { return asArray(this.gs?.pendingSync).length; },
        openForumAction() {
            return JSON.stringify({ action: 'openApp', targetAppId: 'esports-forum' });
        },
    },
    methods: {
        setFocus(hero) {
            store.setFocusHero(this.gs?.focusHero === hero ? '' : hero);
        },
        retry() { store.retrySync(); },
        openTheme() { store.setView('theme'); },
        dText(v) { return deltaText(v); },
    },
    template: `
        <div class="eg-page">
            <div class="eg-idcard">
                <EgAvatar :name="career ? career.gameId : '?'" :hue="210" :size="52" />
                <div class="eg-idcard__main">
                    <b>{{ career ? career.gameId : '' }}</b>
                    <i>{{ career ? career.teamName : '' }} · {{ career ? career.posLabel : '' }}</i>
                    <em>《{{ career ? career.gameName : '' }}》 · {{ ratingLabel }}</em>
                </div>
                <div class="eg-idcard__rating">
                    <b>{{ gs ? gs.rating : 0 }}</b>
                    <i>巅峰分</i>
                </div>
            </div>

            <EgSection v-if="couples.length" title="情侣标" sub="主页公开展示，赛区都看得到">
                <div v-for="r in couples" :key="r.id" class="eg-couplerow">
                    <EgIcon name="heartRing" :size="18" />
                    <b>{{ r.coupleTag.name }}</b>
                    <span>与 {{ r.name }} · 第{{ r.coupleTag.sinceDay }}天起 · 亲密 {{ r.intimacy }}</span>
                </div>
            </EgSection>

            <EgSection :title="heroNoun + '熟练度'" sub="点星标设为本命，练它涨得更快">
                <div v-for="row in practiceRows" :key="row.hero" class="eg-profrow">
                    <button type="button" class="eg-profrow__star" :class="{ 'is-on': gs && gs.focusHero === row.hero }"
                        @click="setFocus(row.hero)">
                        <EgIcon name="target" :size="15" />
                    </button>
                    <EgBar :label="row.hero" :value="row.prof" :max="profMax" />
                </div>
            </EgSection>

            <EgSection title="巅峰分记录">
                <div v-for="(h, i) in history" :key="i" class="eg-liferow">
                    <span>第{{ h.day }}天</span>
                    <b>{{ h.rating }}</b>
                </div>
                <EgEmpty v-if="!history.length" iconName="rank" title="还没有分数记录" />
            </EgSection>

            <EgSection title="其他">
                <div v-if="pendingCount" class="eg-liferow">
                    <span>待同步声浪</span>
                    <b>{{ pendingCount }} 条 <EgBtn size="sm" variant="soft" iconName="refresh" @click="retry">重试</EgBtn></b>
                </div>
                <button type="button" class="eg-menurow" @click="openTheme">
                    <EgIcon name="palette" :size="17" />
                    <span class="eg-menurow__main"><b>配色</b><i>赛训之夜 / 晨训 / 自定义</i></span>
                    <EgIcon name="chevron" :size="14" />
                </button>
                <button type="button" class="eg-menurow" :data-app-action="openForumAction">
                    <EgIcon name="link" :size="17" />
                    <span class="eg-menurow__main"><b>去声浪</b><i>属性、赛季、论坛、薪资都在那边</i></span>
                    <EgIcon name="chevron" :size="14" />
                </button>
            </EgSection>
        </div>
    `,
};
