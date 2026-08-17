/**
 * 候鸟 · 候选详情页
 *
 * 打开时才生成详情（不点不生成）。
 * 页面底部是一张**真正可点的机票**：点它弹确认窗（AcModal），
 * 确认才扣款出票；取消什么都不会发生。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { fmtMoney } from '../utils.js';

export const TvDetailPage = {
    name: 'TvDetailPage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        dest() { return this.s.activeDest || {}; },
        detail() { return this.dest.detail || null; },
        loading() { return this.s.loading.detail; },
        currency() { return this.s.identity.currency; },
        priceText() { return fmtMoney(this.detail?.ticketPrice); },
        /** 这个目的地已经有一张没出发的票 */
        preparedTrip() { return store.findPreparedTrip(this.dest); },
    },
    methods: {
        back() { store.closeDetail(); },
        fav() { store.toggleFavorite(this.dest); },
        regen() { store.generateDetail(this.dest, { force: true }); },
        buy() {
            if (this.preparedTrip) {
                store.openPrep(this.preparedTrip.id);
                return;
            }
            store.openModal('ticket-confirm', { dest: this.dest });
        },
    },
    template: `
        <div class="tv-overlay-page">
            <div class="tv-pagebar">
                <button type="button" class="tv-iconbtn" aria-label="返回" @click="back"><TvIcon name="back" /></button>
                <span class="tv-pagebar__title">{{ dest.placeName }} · {{ dest.locationName }}</span>
                <button type="button" class="tv-iconbtn" :class="{ 'is-accent': dest.favorited }" aria-label="收藏" @click="fav">
                    <TvIcon :name="dest.favorited ? 'heartFill' : 'heart'" />
                </button>
            </div>

            <div class="tv-overlay-body">
                <div class="tv-detail__hero">
                    <p class="tv-detail__place"><TvIcon name="mapPin" :size="14" /> {{ dest.placeName }}</p>
                    <h2 class="tv-detail__name">{{ dest.locationName }}</h2>
                    <p class="tv-detail__blurb">{{ dest.blurb }}</p>
                    <div class="tv-card__foot">
                        <span v-if="dest.kind" class="tv-tag">{{ dest.kind }}</span>
                        <span v-for="t in dest.tags" :key="t" class="tv-tag">{{ t }}</span>
                        <span v-if="dest.existingPlaceId" class="tv-tag is-known">世界已有地点</span>
                    </div>
                </div>

                <div v-if="loading" class="tv-center-block"><TvLoading :lines="['在问当地人这里怎么样', '在查路线和票价', '快好了']" /></div>

                <template v-else-if="detail">
                    <TvSection title="环境与到达">
                        <p v-for="(para, i) in detail.environment.split('\\n').filter(Boolean)" :key="i" class="tv-para">{{ para }}</p>
                    </TvSection>

                    <TvSection v-if="detail.features.length" title="值得做的事">
                        <ul class="tv-list">
                            <li v-for="f in detail.features" :key="f">{{ f }}</li>
                        </ul>
                    </TvSection>

                    <TvSection title="风险与注意">
                        <p class="tv-para">{{ detail.risks }}</p>
                        <p v-if="detail.notes" class="tv-para is-muted">{{ detail.notes }}</p>
                    </TvSection>

                    <div class="tv-detail__facts">
                        <div class="tv-fact"><span class="tv-fact__k">适合停留</span><b class="tv-fact__v">{{ detail.stayTime || '看心情' }}</b></div>
                        <div class="tv-fact"><span class="tv-fact__k">建议携带</span><b class="tv-fact__v">{{ detail.suggestedItems.join('、') || '轻装' }}</b></div>
                    </div>

                    <!-- 机票 -->
                    <button type="button" class="tv-ticket" @click="buy">
                        <span class="tv-ticket__main">
                            <span class="tv-ticket__route">
                                <b class="tv-ticket__from">此地</b>
                                <span class="tv-ticket__plane"><TvIcon name="plane" :size="16" /></span>
                                <b class="tv-ticket__to">{{ dest.locationName }}</b>
                            </span>
                            <span class="tv-ticket__meta">{{ dest.placeName }} · 往返</span>
                        </span>
                        <span class="tv-ticket__stub">
                            <span class="tv-ticket__price"><i>{{ priceText }}</i>{{ currency }}</span>
                            <span class="tv-ticket__cta">{{ preparedTrip ? '已购票 · 去准备' : '点击购票' }}</span>
                        </span>
                    </button>

                    <div class="tv-detail__tools">
                        <TvButton icon-name="refresh" size="sm" variant="ghost" @click="regen">重新生成详情</TvButton>
                    </div>
                </template>

                <TvEmpty v-else icon-name="info" title="详情还没生成出来" :desc="s.error || '网络或 API 出了问题，点下面再试一次。'">
                    <TvButton icon-name="refresh" size="sm" variant="soft" @click="regen">再试一次</TvButton>
                </TvEmpty>
            </div>
        </div>
    `,
};
