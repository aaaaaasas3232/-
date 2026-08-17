/**
 * 灯塔 · 我的
 *
 * 一张钱包卡 + 几个入口。入口本身很薄，真正的内容在 `me-panels.js` 里。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { icon } from '../icons.js';
import { MAX_JOBS } from '../constants.js';

const ENTRIES = [
    { view: 'flow', icon: 'wallet', label: '工资流水', desc: '这个 App 带来的每一笔' },
    { view: 'saved', icon: 'bookmark', label: '收藏的职位', desc: '不会被「换一批」冲掉' },
    { view: 'prompts', icon: 'scroll', label: '提示词', desc: '招聘板和小剧场的原话' },
    { view: 'theme', icon: 'palette', label: '配色', desc: '换主题，或者逐个改颜色' },
    { view: 'gen', icon: 'settings', label: '生成设置', desc: '世界观材料、小剧场篇幅' },
];

export const JbMePage = {
    name: 'JbMePage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        currency() { return this.s.identity.currency; },
        entries() { return ENTRIES; },
        occupation() { return this.s.identity.occupation; },
        postCount() { return this.s.posts.length; },
        maxJobs() { return MAX_JOBS; },
        theaterCount() { return this.s.theaters.length; },
    },
    methods: {
        go(view) { store.setView(view); },
        iconOf(name) { return icon(name, { size: 18 }); },
        chevron() { return icon('chevron', { size: 15 }); },
    },
    template: `
        <div class="jb-me">
            <section class="jb-card jb-card--pad jb-wallet">
                <p class="jb-wallet__k">钱包里现在</p>
                <jb-money :value="s.balance" :currency="currency" size="lg" tone="coin" />
                <div class="jb-wallet__grid">
                    <div class="jb-wallet__cell">
                        <span>这个月挣的</span>
                        <jb-money :value="s.monthIncome" :currency="currency" size="sm" tone="in" />
                    </div>
                    <div class="jb-wallet__cell">
                        <span>在职</span>
                        <b>{{ postCount }} / {{ maxJobs }}</b>
                    </div>
                    <div class="jb-wallet__cell">
                        <span>上过的班</span>
                        <b>{{ theaterCount }} 天</b>
                    </div>
                </div>
                <p class="jb-wallet__note">
                    和聊天里的红包、四叶草的消费是同一个钱包。这里挣的，那边花得掉。
                </p>
            </section>

            <section class="jb-card jb-card--pad jb-me__who">
                <jb-kv label="我是" :value="s.identity.userName" />
                <jb-kv label="世界观" :value="s.identity.worldName" />
                <jb-kv label="人设里的职业" :value="occupation || '（还没写）'" strong />
                <p class="jb-panel__note">
                    入职 / 辞职 / 改职位名时，nook 人设里的「当前职业」会自动跟着变。
                </p>
            </section>

            <div class="jb-me__entries">
                <button
                    v-for="e in entries" :key="e.view"
                    class="jb-card jb-entry"
                    @click="go(e.view)"
                >
                    <span class="jb-entry__icon" v-html="iconOf(e.icon)"></span>
                    <span class="jb-entry__main">
                        <b>{{ e.label }}</b>
                        <i>{{ e.desc }}</i>
                    </span>
                    <span class="jb-entry__go" v-html="chevron()"></span>
                </button>
            </div>
        </div>
    `,
};
