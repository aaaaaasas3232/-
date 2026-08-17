/**
 * 萤火 · 直播间
 *
 * 两种形态：
 *   离线 —— 静态房间：公告 + 几条历史留言（本地合成，零 API），输入禁用。
 *   在播 —— 「开始看直播」按钮触发**一次** API（buildLivePrompt），
 *           拿回主播话术 + 整个弹幕池；之后由一个 250ms 的 interval
 *           按 atSec 分发。**没有任何一条弹幕会单独调 API。**
 *
 * 定时器纪律：只有 mounted 后才可能存在一个 interval，
 * beforeUnmount / 关闭 / 重播都先 clearInterval —— 离开直播间不留幽灵计时器。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { danmakuVisual, dueItems, poolDurationMs } from '../services/live-room.js';
import { fmtCount } from '../services/stats.js';
import { asArray, uid } from '../utils.js';

const TICK_MS = 250;

export const YtLivePage = {
    name: 'YtLivePage',
    components: { ...UI },
    data() {
        return {
            /** 正在飘的弹幕（带视觉参数；动画结束后清理） */
            flying: [],
            /** 已经说出口的主播话术 */
            spokenLines: [],
            playheadMs: 0,
            playing: false,
            ended: false,
            draft: '',
            _timer: null,
            _lastTickAt: 0,
        };
    },
    computed: {
        s() { return store.getState(); },
        creator() { return store.activeCreator(); },
        live() { return this.s.activeLive; },
        offline() { return this.s.offlineRoom; },
        isLiveNow() { return this.creator ? store.creatorIsLive(this.creator) : false; },
        loading() { return this.s.loading.live; },
        viewersLabel() { return this.live ? fmtCount(this.live.viewers) + ' 人在看' : ''; },
        error() { return this.s.error; },
        /** 弹幕池 + 用户自己发过的，统一调度 */
        pool() {
            if (!this.live) return [];
            return [...asArray(this.live.danmaku), ...asArray(this.live.userDanmaku)];
        },
        durationMs() { return this.live ? poolDurationMs(this.live) : 0; },
    },
    watch: {
        live(next) {
            if (next) this.startPlayback();
        },
    },
    mounted() {
        if (this.live) this.startPlayback();
    },
    beforeUnmount() {
        this.stopTimer();
    },
    methods: {
        back() {
            this.stopTimer();
            store.closeLive();
        },
        stopTimer() {
            if (this._timer) { clearInterval(this._timer); this._timer = null; }
            this.playing = false;
        },
        startPlayback() {
            this.stopTimer();
            this.flying = [];
            this.spokenLines = [];
            this.playheadMs = 0;
            this.ended = false;
            this.playing = true;
            this._lastTickAt = performance.now();
            this._timer = setInterval(() => this.tick(), TICK_MS);
        },
        tick() {
            if (!this.live || !this.playing) return;
            const now = performance.now();
            const from = this.playheadMs;
            const to = from + (now - this._lastTickAt);
            this._lastTickAt = now;
            this.playheadMs = to;

            for (const item of dueItems(this.live.hostLines, from, to)) {
                this.spokenLines = [...this.spokenLines, item];
            }
            for (const item of dueItems(this.pool, from, to)) {
                this.spawnDanmaku(item);
            }
            // 清理飘完的（动画时长最长 12s）
            const cutoff = now - 13000;
            if (this.flying.length && this.flying[0].bornAt < cutoff) {
                this.flying = this.flying.filter((d) => d.bornAt >= cutoff);
            }
            if (to > this.durationMs) {
                this.ended = true;
                this.playing = false;
                this.stopTimer();
            }
        },
        spawnDanmaku(item) {
            const visual = danmakuVisual(item, this.flying.length + this.spokenLines.length);
            this.flying = [...this.flying, {
                key: uid('fly'),
                text: item.text,
                name: item.name,
                mine: item.mine === true,
                bornAt: performance.now(),
                ...visual,
            }];
        },
        watchLive() { store.generateLiveSession(); },
        replay() { this.startPlayback(); },
        async send() {
            const text = this.draft.trim();
            if (!text || !this.live) return;
            this.draft = '';
            const item = await store.sendDanmaku(text, this.playheadMs);
            if (item) this.spawnDanmaku(item);   // 自己的弹幕立即上屏
        },
        openCommenterByName() { /* 弹幕点不开主页：弹幕池里的名字没有稳定身份 */ },
        clearError() { store.clearError(); },
    },
    template: `
        <div class="yt-page yt-live" v-if="creator">
            <div class="yt-subtop">
                <button type="button" class="yt-subtop__back" aria-label="返回" @click="back"><YtIcon name="back" :size="18" /></button>
                <span class="yt-subtop__title">{{ creator.name }} 的直播间</span>
                <span v-if="isLiveNow" class="yt-livetag"><i></i>直播中</span>
            </div>

            <!-- 离线房间：能进，但没有不断生成的消息 -->
            <template v-if="!isLiveNow">
                <div class="yt-stage is-offline">
                    <YtAvatar :creator="creator" :size="52" />
                    <p class="yt-stage__offline-title">主播不在</p>
                    <p class="yt-stage__offline-sub">{{ offline ? offline.notice : '开播会在频道页亮起红点。' }}</p>
                </div>
                <YtSection v-if="offline && offline.messages.length" title="留言板" sub="主播不在时的几条留言">
                    <div v-for="(m, i) in offline.messages" :key="i" class="yt-livemsg">
                        <b>{{ m.name }}</b><span>{{ m.text }}</span>
                    </div>
                </YtSection>
                <div class="yt-livebox is-disabled">
                    <input class="yt-input" disabled placeholder="主播不在，弹幕休息中" />
                </div>
            </template>

            <!-- 在播：先按一下才生成（一次 API），之后 JS 分发 -->
            <template v-else>
                <div v-if="error" class="yt-error">
                    <p>{{ error }}</p>
                    <YtButton size="sm" variant="ghost" @click="clearError">知道了</YtButton>
                </div>

                <YtLoading v-if="loading" :lines="['正在挤进直播间', '在接弹幕流', '快好了']" />

                <template v-else-if="!live">
                    <div class="yt-stage is-waiting">
                        <YtAvatar :creator="creator" :size="52" :live="true" />
                        <p class="yt-stage__offline-title">{{ creator.name }} 正在直播</p>
                        <p class="yt-stage__offline-sub">点下面进去看。这一场只调用一次 AI，弹幕由本地按时间线放出。</p>
                        <YtButton variant="primary" icon-name="live" @click="watchLive">开始看直播</YtButton>
                    </div>
                </template>

                <template v-else>
                    <div class="yt-stage is-live">
                        <div class="yt-stage__glow"></div>
                        <p class="yt-stage__topic">{{ live.topic }}</p>
                        <p class="yt-stage__viewers">{{ viewersLabel }}</p>
                        <span class="yt-stage__badge"><i></i>LIVE</span>
                        <!-- 弹幕层 -->
                        <div class="yt-danmaku" aria-hidden="true">
                            <span
                                v-for="d in flying" :key="d.key"
                                class="yt-danmaku__item"
                                :class="['is-c' + d.slot, { 'is-mine': d.mine, 'is-lg': d.size === 'lg' }]"
                                :style="{ top: d.top + '%', animationDuration: d.duration + 's' }"
                            >{{ d.text }}</span>
                        </div>
                        <div v-if="ended" class="yt-stage__ended">
                            <p>这一场告一段落</p>
                            <YtButton size="sm" variant="soft" icon-name="refresh" @click="replay">重新看一遍</YtButton>
                        </div>
                    </div>

                    <p v-if="live.announcement" class="yt-live__notice">{{ live.announcement }}</p>

                    <div class="yt-live__lines">
                        <div v-for="(l, i) in spokenLines" :key="i" class="yt-livemsg is-host">
                            <b>{{ creator.name }}</b><span>{{ l.text }}</span>
                        </div>
                        <p v-if="!spokenLines.length && !ended" class="yt-live__waitline">主播马上开口…</p>
                    </div>

                    <div class="yt-livebox">
                        <input
                            class="yt-input" v-model="draft" maxlength="30"
                            placeholder="发条弹幕…" @keydown.enter="send"
                        />
                        <YtButton size="sm" variant="primary" icon-name="send" :disabled="!draft.trim()" @click="send">发</YtButton>
                    </div>
                </template>
            </template>
        </div>
    `,
};
