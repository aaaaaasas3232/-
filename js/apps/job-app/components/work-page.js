/**
 * 灯塔 · 在职
 *
 * 最多三张卡。每张显示：做什么、怎么结算、下一笔什么时候到、今天演没演。
 *
 * ★ 「今天能不能演」这个判断不在这里重算，走 `store.playCheck` ——
 *   同一业务口径出现第二份实现的那一刻就该抽文件，三份必错。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { MAX_JOBS } from '../constants.js';
import { describeShift, daysToPayday } from '../services/schedule-service.js';
import { describePay } from '../services/payroll-service.js';
import { todayKey, fmtDay } from '../utils.js';

export const JbWorkPage = {
    name: 'JbWorkPage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        posts() { return this.s.posts; },
        currency() { return this.s.identity.currency; },
        canAdd() { return this.posts.length < MAX_JOBS; },
        maxJobs() { return MAX_JOBS; },
        today() { return todayKey(); },
        todayText() { return fmtDay(todayKey()); },
    },
    methods: {
        open(id) { store.openPost(id); },
        payLine(p) { return describePay(p.pay, this.currency); },
        shiftLine(p) { return describeShift(p.shift); },
        /** 今天这份工作的状态：一句能直接读的话 */
        todayLine(p) {
            const check = store.playCheck(p, this.today);
            if (check.ok) return { text: '今天能演一场', tone: 'ok' };
            if (check.reason === 'done') return { text: '今天已经演过了', tone: 'done' };
            return { text: '今天休息', tone: 'rest' };
        },
        payday(p) {
            if (p.pay?.mode !== 'monthly') return '';
            const n = daysToPayday(p.pay.payDay);
            if (n < 0) return '';
            if (n === 0) return '今天发工资';
            return `还有 ${n} 天发工资`;
        },
        addManual() { store.openModal('add-post'); },
        toMarket() { store.setTab('market'); },
    },
    template: `
        <div class="jb-work">
            <jb-empty
                v-if="!posts.length"
                icon="briefcase"
                title="还没有工作"
                desc="去招聘板挑一个，和对面聊出结果来。也可以自己加一份现实里已经有的活。"
            >
                <div class="jb-work__empty-btns">
                    <jb-btn variant="primary" icon="compass" @click="toMarket">去找活</jb-btn>
                    <jb-btn variant="line" icon="plus" @click="addManual">自己加一份</jb-btn>
                </div>
            </jb-empty>

            <template v-else>
                <p class="jb-work__today">{{ todayText }}</p>

                <button
                    v-for="p in posts" :key="p.id"
                    class="jb-card jb-post"
                    @click="open(p.id)"
                >
                    <header class="jb-post__head">
                        <h3 class="jb-post__title">{{ p.title }}</h3>
                        <span v-if="p.track" class="jb-tag jb-tag--accent">特殊</span>
                    </header>
                    <p v-if="p.company || p.place" class="jb-post__meta">
                        <span v-if="p.company">{{ p.company }}</span>
                        <span v-if="p.place">{{ p.place }}</span>
                    </p>

                    <div class="jb-post__rows">
                        <span class="jb-post__row">{{ payLine(p) }}</span>
                        <span class="jb-post__row">{{ shiftLine(p) }}</span>
                        <span v-if="payday(p)" class="jb-post__row jb-post__row--pay">{{ payday(p) }}</span>
                    </div>

                    <footer class="jb-post__foot">
                        <span class="jb-post__state" :class="'is-' + todayLine(p).tone">
                            {{ todayLine(p).text }}
                        </span>
                    </footer>
                </button>

                <div class="jb-work__add">
                    <jb-btn v-if="canAdd" variant="line" icon="plus" block @click="addManual">
                        自己加一份工作
                    </jb-btn>
                    <p v-else class="jb-panel__note">
                        已经满 {{ maxJobs }} 份了。想接新的就先在上面点进去辞掉一份。
                    </p>
                </div>
            </template>
        </div>
    `,
};
