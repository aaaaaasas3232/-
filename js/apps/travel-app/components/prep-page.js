/**
 * 候鸟 · 出行准备板
 *
 * 买完票出现。四件事：定几天几夜、拉同行 AI、从四叶草挑要带的东西、写附加要求。
 * 然后「生成小剧场」（可编辑 / 删除 / 带意见重 roll），满意了「正式出发」。
 *
 * ★ 提示词预览和发送来自同一次 compose（TvPromptParts 渲染的就是 parts）。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { buildTheaterPrompt } from '../services/prompt-builder.js';
import { tripDurationLabel } from '../services/trip-flow.js';
import { TRIP_DAYS_MAX, TRIP_DAYS_MIN } from '../constants.js';
import * as world from '../services/world-context.js';

export const TvPrepPage = {
    name: 'TvPrepPage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        trip() { return store.currentTrip(); },
        dest() { return this.trip?.destination || {}; },
        prep() { return this.s.prep; },
        worldAis() { return world.listWorldAis(this.s.identity.world); },
        theater() { return this.trip?.theater || null; },
        loading() { return this.s.loading.theater; },
        durationText() { return tripDurationLabel(this.prep.days); },
        daysMin() { return TRIP_DAYS_MIN; },
        daysMax() { return TRIP_DAYS_MAX; },
        /** 预览用的 compose 结果（和发送同一个 builder，同一份 parts） */
        promptPreview() {
            if (!this.prep.showPrompt) return null;
            const ctx = store.theaterPromptContext('');
            return ctx ? buildTheaterPrompt(ctx) : null;
        },
    },
    methods: {
        back() { store.closeTripView(); },
        setDays(n) { store.setPrepDays(n); },
        toggleAi(id) { store.togglePrepCompanion(id); },
        toggleItem(id) { store.togglePrepItem(id); },
        onExtra(event) { store.setPrepExtra(event.target.value); },
        togglePrompt() { store.togglePrepPrompt(); },
        clearError() { store.clearError(); },
        generate() { store.generateTheater(); },
        reroll() {
            store.openModal('opinion', {
                title: '这场小剧场哪里不对',
                onSubmit: (opinion) => store.generateTheater(opinion),
            });
        },
        removeTheater() {
            store.openModal('confirm', {
                title: '删除小剧场',
                text: '删掉后可以重新生成。',
                danger: true,
                okLabel: '删除',
                onOk: () => store.deleteTheater(),
            });
        },
        saveEdits() { store.saveTheaterEdits(); },
        depart() {
            store.openModal('confirm', {
                title: '正式出发',
                text: `按 ${this.durationText} 出发。出发后天数、同行和行李就定下了，机票也不能再退。`,
                okLabel: '出发',
                onOk: () => store.departTrip(),
            });
        },
        cancelTrip() {
            store.openModal('confirm', {
                title: '退票并删除',
                text: '票款会原路退回，这趟行程会被删掉。',
                danger: true,
                okLabel: '退票删除',
                onOk: () => store.deleteTrip(this.trip.id),
            });
        },
    },
    template: `
        <div class="tv-overlay-page" v-if="trip">
            <div class="tv-pagebar">
                <button type="button" class="tv-iconbtn" aria-label="返回" @click="back"><TvIcon name="back" /></button>
                <span class="tv-pagebar__title">出行准备 · {{ dest.locationName }}</span>
                <button type="button" class="tv-iconbtn" aria-label="退票" @click="cancelTrip"><TvIcon name="trash" /></button>
            </div>

            <div class="tv-overlay-body">
                <TvSection title="旅行安排">
                    <div class="tv-prep__days">
                        <TvStepper :model-value="prep.days" :min="daysMin" :max="daysMax" suffix=" 天" @update:model-value="setDays" />
                        <span class="tv-prep__duration">{{ durationText }}</span>
                    </div>
                </TvSection>

                <TvSection title="同行的 AI" :sub="worldAis.length ? '只能拉这个世界里的' : ''">
                    <TvEmpty v-if="!worldAis.length" icon-name="users" title="这个世界还没有 AI 角色" desc="去「设置 → AI 人设」建一个并绑定这个世界，就能拉上一起走。" />
                    <div v-else class="tv-picks">
                        <button
                            v-for="a in worldAis" :key="a.id"
                            type="button" class="tv-pick" :class="{ 'is-on': prep.companionIds.includes(a.id) }"
                            @click="toggleAi(a.id)"
                        >
                            <TvAvatar :name="a.name" :url="a.avatar" :bg="a.avatarBg" :size="22" />
                            <span>{{ a.name }}</span>
                        </button>
                    </div>
                </TvSection>

                <TvSection title="带上的东西" sub="来自四叶草里真实买过的">
                    <p v-if="prep.shopLoading" class="tv-muted">正在翻你的购物记录…</p>
                    <TvEmpty v-else-if="!prep.shopItems.length" icon-name="luggage" title="没有可带的东西" desc="在四叶草买过的东西会出现在这里。空手上路也行。" />
                    <div v-else class="tv-picks">
                        <button
                            v-for="it in prep.shopItems" :key="it.id"
                            type="button" class="tv-pick" :class="{ 'is-on': prep.itemIds.includes(it.id) }"
                            @click="toggleItem(it.id)"
                        >
                            <TvIcon name="luggage" :size="14" />
                            <span>{{ it.label }}</span>
                        </button>
                    </div>
                </TvSection>

                <TvSection title="附加要求">
                    <textarea
                        class="tv-textarea" rows="3"
                        :value="prep.extra"
                        placeholder="比如：想走慢一点 / 这趟主要是去看灯会"
                        @input="onExtra"
                    ></textarea>
                </TvSection>

                <TvSection title="出发小剧场" sub="从收拾行李写到动身">
                    <div v-if="loading" class="tv-center-block"><TvLoading :lines="['大家在收拾行李', '在写出发的清晨', '快好了']" /></div>

                    <template v-else-if="theater">
                        <div class="tv-theater">
                            <input v-model="theater.title" class="tv-theater__title" maxlength="24" @change="saveEdits" />
                            <div v-for="(sc, i) in theater.scenes" :key="sc.id" class="tv-theater__scene">
                                <p class="tv-theater__scenehead"><span class="tv-theater__no">第{{ i + 1 }}场</span><span>{{ sc.place }}</span></p>
                                <textarea v-model="sc.narration" class="tv-theater__narration" rows="2" @change="saveEdits"></textarea>
                                <div v-for="line in sc.lines" :key="line.id" class="tv-theater__line">
                                    <span class="tv-theater__who">{{ line.speaker }}</span>
                                    <textarea v-model="line.text" class="tv-theater__text" rows="1" @change="saveEdits"></textarea>
                                </div>
                            </div>
                            <p v-if="theater.closing" class="tv-theater__closing">{{ theater.closing }}</p>
                        </div>
                        <div class="tv-row-actions">
                            <TvButton icon-name="reroll" size="sm" @click="reroll">带意见重 roll</TvButton>
                            <TvButton icon-name="trash" size="sm" variant="ghost" @click="removeTheater">删除</TvButton>
                        </div>
                    </template>

                    <TvEmpty v-else icon-name="quote" title="还没生成小剧场" desc="上面的安排定得差不多了就点一下。不生成直接出发也行。">
                        <TvButton icon-name="sparkle" variant="primary" size="sm" @click="generate">生成小剧场</TvButton>
                    </TvEmpty>
                </TvSection>

                <TvSection title="提示词">
                    <TvButton icon-name="eye" size="sm" variant="ghost" @click="togglePrompt">{{ prep.showPrompt ? '收起' : '看看这次会发什么' }}</TvButton>
                    <TvPromptParts v-if="promptPreview" :parts="promptPreview.parts" :stats="promptPreview.stats" />
                </TvSection>

                <div v-if="s.error" class="tv-errorbar"><p>{{ s.error }}</p><button type="button" @click="clearError">知道了</button></div>
            </div>

            <div class="tv-overlay-foot">
                <TvButton variant="primary" size="lg" block icon-name="plane" @click="depart">正式出发（{{ durationText }}）</TvButton>
            </div>
        </div>
    `,
};
