/**
 * App 制作 · 根组件
 *
 * 四页：科普 / 配置 / 助手 / 生成。自绘底部 tab 栏 ——
 * 框架的 tab 栏也能用，但这个 App 需要在 tab 上显示「问卷填到第几步」，
 * 框架的 tab 不支持角标之外的动态内容。
 *
 * ── 布局 ──────────────────────────────────────────────────────────
 * 根节点绝对定位铺满 .app-screen-panel（那一层只有 min-height:100%，
 * 写 height:100% 是不生效的，详见 index.css 里「和框架容器的接线」一段）。
 * 底下 tab 栏 flex 固定，上面每个 pane 各自管自己的滚动 —— 切回来时
 * 滚动位置还在原处，而且任何时刻只有一个滚动容器在工作。
 *
 * ★ vue 模式框架不会调 hydrate，草稿读取在这里的 mounted 里启动。
 * ★ 离开页面时要 flush 一次防抖落盘，否则用户填完最后一个字就切走，那一下会丢。
 */

import * as store from '../store.js';
import { AmExplainer } from './explainer.js';
import { AmSurvey, STEPS } from './survey.js';
import { AmChat } from './chat.js';
import { AmResult } from './result.js';
import { ICONS } from '../icons.js';
import { generateAppCode } from '../survey/codegen.js';
import { buildPrompt } from '../survey/prompt.js';
import { buildBlueprint } from '../survey/blueprint.js';

const TABS = [
    { id: 'learn', icon: ICONS.book, label: '词汇' },
    { id: 'survey', icon: ICONS.sliders, label: '配置' },
    { id: 'chat', icon: ICONS.chat, label: '助手' },
    { id: 'result', icon: ICONS.download, label: '生成' },
];

export function createAppMakerRoot() {
    return {
        name: 'AppMakerRoot',
        components: { AmExplainer, AmSurvey, AmChat, AmResult },
        props: { app: { type: Object, required: true } },
        data() {
            return {
                tab: 'survey',
                // 每个可滚 pane 一个「已经滚走了」的标志，只用来决定顶上那根发丝线
                stuck: { learn: false, result: false },
                // 词汇页钻进某个分类之后，页头那段引言就该收起来
                learnGroup: null,
            };
        },
        computed: {
            state() { return store.getState(); },
            tabs() { return TABS; },
            stepBadge() {
                const total = STEPS.length;
                return `${Math.min(this.state.step + 1, total)}/${total}`;
            },
            hasResult() { return !!this.state.generated.code; },
        },
        mounted() {
            store.hydrate();

            // 用户可能直接关标签页，pagehide 是最后能拿到的时机
            this._flush = () => store.flushPersist();
            window.addEventListener('pagehide', this._flush);
            document.addEventListener('visibilitychange', this._flush);
        },
        beforeUnmount() {
            window.removeEventListener('pagehide', this._flush);
            document.removeEventListener('visibilitychange', this._flush);
            store.flushPersist();
            // 预设弹窗挂在 app-shell 上，不关会留在下一个 App 的界面里
            window.__listenPresets?.modals?.closeAll?.();
        },
        methods: {
            go(id) {
                this.tab = id;
            },
            onScroll(key, ev) {
                // 4px 而不是 0：手指按住轻微回弹时不该反复闪那根线
                this.stuck[key] = ev.target.scrollTop > 4;
            },
            generate() {
                const bp = buildBlueprint(this.state.answers);
                store.setGenerated(generateAppCode(bp), buildPrompt(bp));
                this.go('result');
                this.app?.toolkit?.island?.notify?.('success', '生成好了', `${bp.appName} · ${bp.pages.length} 页`);
            },
        },
        template: `
            <div class="am-root">
                <div class="am-body">
                    <section v-show="tab === 'learn'" class="am-pane">
                        <div class="am-veil" :class="{ 'is-stuck': stuck.learn }"></div>
                        <div class="am-scroll" @scroll="onScroll('learn', $event)">
                            <header v-if="!learnGroup" class="am-head">
                                <h1 class="am-head__title">不知道那叫什么</h1>
                                <p class="am-head__sub">
                                    做 App 最难的往往不是想不出要什么，而是不知道想要的那个东西叫什么。
                                    这里把常用的词按分类摆开，每个词都有大白话解释和生活里的例子。
                                </p>
                            </header>
                            <div class="am-pane__inner" :class="{ 'is-tight': learnGroup }">
                                <am-explainer @nav="learnGroup = $event" />
                            </div>
                        </div>
                    </section>

                    <section v-show="tab === 'survey'" class="am-pane am-pane--flush">
                        <am-survey :state="state" @generate="generate" />
                    </section>

                    <section v-show="tab === 'chat'" class="am-pane am-pane--flush">
                        <am-chat :state="state" />
                    </section>

                    <section v-show="tab === 'result'" class="am-pane">
                        <div class="am-veil" :class="{ 'is-stuck': stuck.result }"></div>
                        <div class="am-scroll" @scroll="onScroll('result', $event)">
                            <header class="am-head">
                                <h1 class="am-head__title">生成</h1>
                                <p class="am-head__sub">
                                    白膜装到桌面就能点，提示词拿去给 AI 把它填成真 App。
                                    两样都是按你刚才的配置现算的。
                                </p>
                            </header>
                            <div class="am-pane__inner">
                                <am-result v-if="tab === 'result'" :state="state" />
                            </div>
                        </div>
                    </section>
                </div>

                <nav class="am-tabbar">
                    <button
                        v-for="t in tabs" :key="t.id"
                        type="button" class="am-tab"
                        :class="{ 'is-on': tab === t.id }"
                        :aria-current="tab === t.id ? 'page' : null"
                        @click="go(t.id)"
                    >
                        <span class="am-tab__glyph" v-html="t.icon"></span>
                        <span class="am-tab__label">{{ t.label }}</span>
                        <span v-if="t.id === 'survey'" class="am-tab__badge">{{ stepBadge }}</span>
                        <span v-else-if="t.id === 'result' && hasResult" class="am-tab__dot"></span>
                    </button>
                </nav>
            </div>
        `,
    };
}
