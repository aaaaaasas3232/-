/**
 * 情景剧场 · 侧边抽屉
 *
 * ── 形状 ──────────────────────────────────────────────────────────
 *
 * 用户要求「侧边栏的边不是竖线而是大圆角」。所以抽屉是一整块**右侧收圆**
 * 的面板,浮在舞台上方,右边缘 28px 圆角 + 落影,而不是靠一条 1px 竖线
 * 和内容区分开。分页在抽屉**里面**顶部,不是外面一条竖排图标 ——
 * 竖排图标那种做法在手机宽度下会把内容区挤到只剩一半。
 *
 * ── 为什么不用 `<dialog>` 或框架的 modal ──────────────────────────
 *
 * 抽屉要能**边开着边看舞台**(改外观时要立刻看到效果),
 * modal 的遮罩会把下面盖住,而且它会抢焦点。这里只在抽屉右侧留一块
 * 半透明遮罩用来点击关闭,舞台仍然可见。
 */

import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import { DRAWERS } from '../constants.js';
import { SpPanelScenes } from './panel-scenes.js';
import { SpPanelSaves } from './panel-saves.js';
import { SpPanelTheme } from './panel-theme.js';
import { SpPanelRegex } from './panel-regex.js';
import { SpPanelContext } from './panel-context.js';
import { SpPanelClips } from './panel-clips.js';

export const SpDrawer = {
    name: 'SpDrawer',
    components: {
        ...SHARED_COMPONENTS,
        SpPanelScenes, SpPanelSaves, SpPanelTheme, SpPanelRegex, SpPanelContext, SpPanelClips,
    },
    emits: ['notify'],
    data() { return { DRAWERS }; },
    computed: {
        state() { return store.getState(); },
        open() { return Boolean(this.state.drawer); },
        current() { return this.state.drawer; },
        meta() { return DRAWERS.find((d) => d.id === this.current) || null; },
    },
    methods: {
        pick(id) { store.setDrawer(id); },
        close() { store.closeDrawer(); },
        onNotify(message) { this.$emit('notify', message); },
    },
    template: `
        <div class="sp-drawer-layer" :class="{ 'is-open': open }">
            <div class="sp-drawer-scrim" @click="close" aria-hidden="true"></div>

            <aside class="sp-drawer" role="dialog" :aria-label="meta ? meta.label : '抽屉'" :aria-hidden="!open">
                <header class="sp-drawer-head">
                    <span class="sp-drawer-title">{{ meta ? meta.label : '' }}</span>
                    <button type="button" class="sp-drawer-close" aria-label="收起" @click="close">
                        <SpIcon name="left" />
                    </button>
                </header>

                <nav class="sp-drawer-tabs" role="tablist">
                    <button
                        v-for="d in DRAWERS"
                        :key="d.id"
                        type="button"
                        role="tab"
                        class="sp-drawer-tab"
                        :class="{ 'is-active': current === d.id }"
                        :aria-selected="current === d.id"
                        :aria-label="d.label"
                        :title="d.label"
                        @click="pick(d.id)"
                    >
                        <SpIcon :name="d.icon" />
                        <span>{{ d.label }}</span>
                    </button>
                </nav>

                <div class="sp-drawer-body">
                    <SpPanelScenes  v-if="current === 'scenes'"  @notify="onNotify" />
                    <SpPanelSaves   v-else-if="current === 'saves'"   @notify="onNotify" />
                    <SpPanelTheme   v-else-if="current === 'theme'"   @notify="onNotify" />
                    <SpPanelRegex   v-else-if="current === 'regex'"   @notify="onNotify" />
                    <SpPanelContext v-else-if="current === 'context'" @notify="onNotify" />
                    <SpPanelClips   v-else-if="current === 'clips'"   @notify="onNotify" />
                </div>
            </aside>
        </div>
    `,
};

export default SpDrawer;
