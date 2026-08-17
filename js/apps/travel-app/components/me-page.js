/**
 * 候鸟 · 我的
 *
 * 身份卡（用户 / 世界 / 余额）+ 三个入口：配色、生成设置（重新配置）、关于。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { fmtMoney } from '../utils.js';
import { TRIP_STATUS } from '../constants.js';

export const TvMePage = {
    name: 'TvMePage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        balanceText() { return fmtMoney(this.s.balance); },
        stats() {
            const trips = this.s.trips;
            return {
                done: trips.filter((t) => t.status === TRIP_STATUS.completed).length,
                saved: this.s.destinations.filter((d) => d.favorited).length,
                spent: fmtMoney(trips.reduce((sum, t) => sum + (Number(t.ticket?.price) || 0), 0)),
            };
        },
    },
    methods: {
        openTheme() { store.setView('theme'); },
        reconfigure() {
            store.openModal('confirm', {
                title: '重新配置',
                text: '回到首次配置页改夹子、Prompt 库和旅行口味。候选、收藏和行程都不会丢。',
                okLabel: '去改',
                onOk: () => store.reopenOnboarding(),
            });
        },
        about() {
            store.openModal('confirm', {
                title: '关于候鸟',
                text: '候鸟不预设任何地点，每个目的地都是按你当前世界观现生成的。\n\n'
                    + '机票花的是真钱（和红包、四叶草同一本账）；出发前退票全额退回。\n\n'
                    + '数据按「默认用户 + 绑定世界」分档：换档要重新配置，换回来原样恢复。',
                okLabel: '知道了',
                onOk: () => {},
            });
        },
    },
    template: `
        <div class="tv-page">
            <div class="tv-idcard">
                <div class="tv-idcard__head">
                    <TvAvatar :name="s.identity.userName" :url="s.identity.userAvatar" :bg="s.identity.userAvatarBg" :size="42" />
                    <div class="tv-idcard__who">
                        <p class="tv-idcard__name">{{ s.identity.userName }}</p>
                        <p class="tv-idcard__world"><TvIcon name="globe" :size="12" /> {{ s.identity.worldName }}</p>
                    </div>
                </div>
                <div class="tv-idcard__balance">
                    <span class="tv-idcard__num">{{ balanceText }}</span>
                    <span class="tv-idcard__unit">{{ s.identity.currency }}</span>
                </div>
                <p class="tv-idcard__note">和聊天红包、四叶草共用同一个钱包。机票钱从这里扣，退票原路退回。</p>
                <div class="tv-idcard__stats">
                    <span class="tv-idcard__stat"><b>{{ stats.done }}</b><i>走完的旅程</i></span>
                    <span class="tv-idcard__stat"><b>{{ stats.saved }}</b><i>收藏的地方</i></span>
                    <span class="tv-idcard__stat"><b>{{ stats.spent }}</b><i>花掉的旅费</i></span>
                </div>
            </div>

            <div class="tv-entries">
                <button type="button" class="tv-entry" @click="openTheme">
                    <span class="tv-entry__icon"><TvIcon name="palette" /></span>
                    <span class="tv-entry__main"><span class="tv-entry__label">配色</span><span class="tv-entry__hint">单个改、整组粘贴覆盖、存主题</span></span>
                    <TvIcon name="chevronRight" :size="15" />
                </button>
                <button type="button" class="tv-entry" @click="reconfigure">
                    <span class="tv-entry__icon"><TvIcon name="gear" /></span>
                    <span class="tv-entry__main"><span class="tv-entry__label">生成设置</span><span class="tv-entry__hint">改夹子、Prompt 库、旅行口味</span></span>
                    <TvIcon name="chevronRight" :size="15" />
                </button>
                <button type="button" class="tv-entry" @click="about">
                    <span class="tv-entry__icon"><TvIcon name="info" /></span>
                    <span class="tv-entry__main"><span class="tv-entry__label">关于</span><span class="tv-entry__hint">钱、分档和数据的说明</span></span>
                    <TvIcon name="chevronRight" :size="15" />
                </button>
            </div>
        </div>
    `,
};
