/**
 * 梦境编织 · 我的
 *
 * 外观 / 阅读 / 生成 / 素材 / 数据 五组设置。
 *
 * 原版这一页的按钮点下去大多打开一个独立弹窗,而弹窗里又是一整套自绘表单 ——
 * 「显示设置」那个弹窗一个人就有四百多行。这里全部收敛成
 * `DwRow` + `DwSwitch` + `DwSlider` 的组合,并且**改完立刻生效**
 * (原版有些设置要关掉弹窗重进编辑器才看得到变化)。
 */

import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import { AUTHOR_STYLE_OPTIONS } from '../constants.js';
import { formatNumber } from '../utils.js';
import { exportAll } from '../services/db.js';

const THEME_OPTIONS = [
    { id: 'retro-dark', label: '复古深色', hint: '红黑蓝' },
    { id: 'oriental-light', label: '国风浅色', hint: '绿黄白' },
];

export const DwProfile = {
    name: 'DwProfile',
    components: SHARED_COMPONENTS,
    props: {
        app: { type: Object, required: true },
    },
    emits: ['notify'],
    computed: {
        state() { return store.getState(); },
        library() { return this.state.library; },
        settings() { return this.state.library.settings; },
        display() { return this.state.library.settings.displaySettings; },
        bookCount() { return this.state.books.length; },
        collectedCount() { return this.library.collected.length; },
        inspirationCount() { return this.library.inspirations.length; },
        sceneCount() { return this.library.scenes.length; },
        ruleCount() {
            return this.library.bubbleRules.filter((r) => r.enabled !== false).length;
        },
        modeCount() { return this.library.inputModes.length; },
        fontName() { return this.settings.customFont?.name || '跟随系统'; },
        themeLabel() {
            const active = this.settings.activeCustomThemeId;
            if (active) {
                const hit = (this.settings.customThemes || []).find((t) => String(t.id) === String(active));
                if (hit) return hit.name;
            }
            const changed = Object.keys(this.settings.customThemeColors || {}).length;
            return changed ? `已改 ${changed} 项` : '内置';
        },
    },
    methods: {
        setTheme(themeId) {
            // 切内置主题时把自定义改动一起清掉 —— 深色改的值套到浅色上会很怪
            store.applyTheme({ baseThemeId: themeId, customColors: {}, customThemeId: '' });
        },
        patch(key, value) {
            store.updateSettings({ [key]: value });
        },
        patchDisplay(key, value) {
            store.updateDisplaySettings({ [key]: value });
        },
        openModal(type, payload) {
            store.openModal(type, payload);
        },
        openPage(type, payload) {
            store.openPage(type, payload);
        },

        async onExport() {
            try {
                const data = await exportAll(this.app);
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `梦境编织-${new Date().toISOString().slice(0, 10)}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                // 立刻 revoke 会让部分浏览器来不及下载,给一秒缓冲
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                this.$emit('notify', '已导出');
            } catch (err) {
                this.$emit('notify', `导出失败:${err?.message || err}`);
            }
        },

        onImportFont() {
            store.openModal('font-import');
        },

        onResetSettings() {
            store.openModal('confirm', {
                title: '恢复默认设置?',
                message: '主题、字体、显示、叙事偏好都会回到初始值。书和正文不受影响。',
                danger: true,
                onConfirm: () => {
                    store.resetSettings();
                    this.$emit('notify', '设置已恢复默认');
                },
            });
        },
    },
    created() {
        this.THEME_OPTIONS = THEME_OPTIONS;
        this.AUTHOR_STYLE_OPTIONS = AUTHOR_STYLE_OPTIONS;
        this.formatNumber = formatNumber;
    },
    template: `
        <div class="dw-profile">
            <header class="dw-profile-head">
                <div class="dw-profile-avatar" aria-hidden="true"><DwIcon name="pen" /></div>
                <div>
                    <h1 class="dw-profile-title">我的创作</h1>
                    <p class="dw-profile-sub">{{ bookCount }} 本书 · {{ collectedCount }} 段收藏 · {{ inspirationCount }} 条灵感</p>
                </div>
            </header>

            <DwSection title="外观" icon-name="palette">
                <DwField label="主题">
                    <DwSegmented :model-value="settings.theme" :options="THEME_OPTIONS" @update:model-value="setTheme" />
                </DwField>
                <DwRow
                    label="主题与配色"
                    :value="themeLabel"
                    hint="改任意一个颜色,下面立刻能看到效果"
                    icon-name="palette"
                    chevron
                    @click="openModal('theme')"
                />
                <DwRow label="正文字体" :value="fontName" icon-name="format" chevron @click="onImportFont" />
            </DwSection>

            <DwSection title="阅读" icon-name="book">
                <DwField label="字号">
                    <DwSlider :model-value="display.fontSize" :min="12" :max="22" suffix="px" @update:model-value="patchDisplay('fontSize', $event)" />
                </DwField>
                <DwField label="行距">
                    <DwSlider :model-value="Math.round(display.lineHeight * 10)" :min="14" :max="26"
                              @update:model-value="patchDisplay('lineHeight', $event / 10)" />
                </DwField>
                <DwField label="字距">
                    <DwSlider :model-value="display.letterSpacing" :min="0" :max="4" suffix="px" @update:model-value="patchDisplay('letterSpacing', $event)" />
                </DwField>
                <DwRow label="段首缩进">
                    <template #trailing>
                        <DwSwitch :model-value="display.paragraphIndent" label="段首缩进" @update:model-value="patchDisplay('paragraphIndent', $event)" />
                    </template>
                </DwRow>
                <DwRow label="对话渲染成气泡" hint="按下面的正则规则识别对话">
                    <template #trailing>
                        <DwSwitch :model-value="display.showBubbles" label="对话气泡" @update:model-value="patchDisplay('showBubbles', $event)" />
                    </template>
                </DwRow>
                <DwRow label="高亮角色名">
                    <template #trailing>
                        <DwSwitch :model-value="display.highlightCharacters" label="高亮角色名" @update:model-value="patchDisplay('highlightCharacters', $event)" />
                    </template>
                </DwRow>
                <DwRow label="高亮地点名">
                    <template #trailing>
                        <DwSwitch :model-value="display.highlightLocations" label="高亮地点名" @update:model-value="patchDisplay('highlightLocations', $event)" />
                    </template>
                </DwRow>
                <DwRow label="显示字数" hint="每段下方显示字数统计">
                    <template #trailing>
                        <DwSwitch :model-value="display.showTokens" label="显示字数" @update:model-value="patchDisplay('showTokens', $event)" />
                    </template>
                </DwRow>
                <DwRow label="显示时间">
                    <template #trailing>
                        <DwSwitch :model-value="display.showTimestamps" label="显示时间" @update:model-value="patchDisplay('showTimestamps', $event)" />
                    </template>
                </DwRow>
            </DwSection>

            <DwSection title="生成" icon-name="sparkle">
                <DwRow label="流式生成" hint="边生成边显示,可中途停止">
                    <template #trailing>
                        <DwSwitch :model-value="settings.useStreamMode" label="流式生成" @update:model-value="patch('useStreamMode', $event)" />
                    </template>
                </DwRow>
                <DwRow label="作者人格" hint="让 AI 模仿你的行文习惯">
                    <template #trailing>
                        <DwSwitch :model-value="settings.enableAuthorPersonality" label="作者人格" @update:model-value="patch('enableAuthorPersonality', $event)" />
                    </template>
                </DwRow>
                <DwField v-if="settings.enableAuthorPersonality" label="文风倾向">
                    <DwSelect :model-value="settings.authorStyle" :options="AUTHOR_STYLE_OPTIONS" @update:model-value="patch('authorStyle', $event)" />
                </DwField>
                <DwRow label="输入模式" :value="modeCount + ' 个'" hint="剧情 / 金句 / Pia戏,可自定义" icon-name="layers" chevron @click="openModal('input-modes')" />
                <DwRow label="生成提示词" hint="基础提示词与各类型模板" icon-name="note" chevron @click="openModal('generation-prompts')" />
            </DwSection>

            <DwSection title="素材" icon-name="star">
                <DwRow label="收藏的段落" :value="String(collectedCount)" icon-name="starFilled" chevron @click="openModal('collected')" />
                <DwRow label="灵感" :value="String(inspirationCount)" icon-name="lightbulb" chevron @click="openPage('inspirations')" />
                <DwRow label="场景库" :value="String(sceneCount)" icon-name="image" chevron @click="openModal('scenes')" />
                <DwRow label="正则规则" :value="ruleCount + ' 条启用'" icon-name="regex" chevron @click="openModal('regex-rules')" />
                <DwRow label="生成历史" :value="String(library.generatedHistory.length)" icon-name="history" chevron @click="openModal('generated-history')" />
            </DwSection>

            <DwSection title="数据" icon-name="folder">
                <DwRow label="导出全部数据" hint="JSON 文件,含书籍与正文" icon-name="download" chevron @click="onExport" />
                <DwRow label="恢复默认设置" hint="不影响书和正文" icon-name="refresh" danger chevron @click="onResetSettings" />
            </DwSection>
        </div>
    `,
};

export default DwProfile;
