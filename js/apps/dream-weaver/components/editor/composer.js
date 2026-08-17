/**
 * 梦境编织 · 输入面板
 *
 * 1:1 复原原版 `renderChatInputPanel`(7676-7759):
 *
 *   .dw-input-panel
 *     ├── .dw-input-mode-tabs
 *     │     ├── .dw-input-mode-tab × N        剧情 / 金句 / Pia戏
 *     │     ├── .dw-narrative-toggle-btn      「上帝·三·顺」+ 齿轮 + 箭头,margin-left:auto
 *     │     └── .dw-expand-btn                展开/收起输入框
 *     ├── .dw-narrative-settings-panel        视角 / 人称 / 叙事(max-height 0↔60 折叠)
 *     └── .dw-input-row
 *           ├── .dw-input-textarea            收起 24px / 展开 120px
 *           └── .dw-send-btn
 *
 * 原版的叙事按钮标签是三个字的缩写拼接:`上帝·三·顺`(`getNarrativeSettingsLabel` 7762)。
 */

import { DwIcon } from '../shared.js';
import {
    VIEWPOINT_OPTIONS, POV_OPTIONS, NARRATIVE_OPTIONS,
    POV_SHORT, VIEWPOINT_SHORT, NARRATIVE_METHOD_SHORT,
} from '../../constants.js';

export const DwComposer = {
    name: 'DwComposer',
    components: { DwIcon },
    props: {
        modes: { type: Array, required: true },
        currentModeId: { type: String, default: '' },
        settings: { type: Object, required: true },
        generating: { type: Boolean, default: false },
    },
    emits: ['send', 'stop', 'change-mode', 'update-settings'],
    data() {
        return {
            text: '',
            narrativeOpen: false,
            expanded: false,
        };
    },
    computed: {
        currentMode() {
            return this.modes.find((m) => m.id === this.currentModeId) || this.modes[0] || null;
        },
        placeholder() {
            return this.currentMode?.placeholder || '输入内容...';
        },
        canSend() {
            return this.text.trim().length > 0;
        },
        /** 原版 `getNarrativeSettingsLabel`:视角·人称·叙事 三个缩写用「·」连起来 */
        narrativeLabel() {
            const v = VIEWPOINT_SHORT[this.settings.viewpoint] || '上帝';
            const p = POV_SHORT[this.settings.pov] || '三';
            const m = NARRATIVE_METHOD_SHORT[this.settings.narrativeMethod] || '顺';
            return `${v}·${p}·${m}`;
        },
    },
    methods: {
        onSend() {
            if (this.generating) {
                this.$emit('stop');
                return;
            }
            const value = this.text.trim();
            if (!value) return;
            this.$emit('send', { text: value, modeId: this.currentMode?.id });
            this.text = '';
            // 发完自动收起,免得一个空的大框占着半屏
            this.expanded = false;
        },
        onKeydown(event) {
            // Ctrl/Cmd + Enter 发送。裸 Enter 留给换行 —— 这里写的是小说不是聊天。
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                this.onSend();
            }
        },
        patch(key, value) {
            this.$emit('update-settings', { [key]: value });
        },
        onSelect(key, event) {
            this.patch(key, event.target.value);
        },
    },
    created() {
        this.VIEWPOINT_OPTIONS = VIEWPOINT_OPTIONS;
        this.POV_OPTIONS = POV_OPTIONS;
        this.NARRATIVE_OPTIONS = NARRATIVE_OPTIONS;
    },
    template: `
        <div class="dw-input-panel">
            <div class="dw-input-mode-tabs">
                <button
                    v-for="mode in modes"
                    :key="mode.id"
                    type="button"
                    class="dw-input-mode-tab"
                    :class="{ active: mode.id === currentModeId }"
                    :title="mode.placeholder"
                    @click="$emit('change-mode', mode.id)"
                >
                    <DwIcon :name="mode.icon || 'book'" class="dw-icon-sm" />{{ mode.name }}
                </button>

                <button
                    type="button"
                    class="dw-narrative-toggle-btn"
                    :class="{ expanded: narrativeOpen }"
                    title="叙事设置"
                    @click="narrativeOpen = !narrativeOpen"
                >
                    <DwIcon name="settings" class="dw-icon-sm" />
                    <span class="dw-narrative-label">{{ narrativeLabel }}</span>
                    <DwIcon name="chevronDown" class="dw-icon-sm dw-narrative-arrow" />
                </button>

                <button
                    type="button"
                    class="dw-expand-btn"
                    :class="{ expanded }"
                    title="展开/收起输入框"
                    aria-label="展开或收起输入框"
                    @click="expanded = !expanded"
                ><DwIcon name="chevronUp" /></button>
            </div>

            <div class="dw-narrative-settings-panel" :class="{ open: narrativeOpen }">
                <div class="dw-narrative-settings-row">
                    <div class="dw-narrative-select-group">
                        <span class="dw-narrative-select-label">视角</span>
                        <select class="dw-narrative-select" :value="settings.viewpoint" @change="onSelect('viewpoint', $event)">
                            <option value="god">上帝</option>
                            <option value="character">角色</option>
                        </select>
                    </div>
                    <div class="dw-narrative-select-group">
                        <span class="dw-narrative-select-label">人称</span>
                        <select class="dw-narrative-select" :value="settings.pov" @change="onSelect('pov', $event)">
                            <option value="first">一</option>
                            <option value="second">二</option>
                            <option value="third">三</option>
                        </select>
                    </div>
                    <div class="dw-narrative-select-group">
                        <span class="dw-narrative-select-label">叙事</span>
                        <select class="dw-narrative-select" :value="settings.narrativeMethod" @change="onSelect('narrativeMethod', $event)">
                            <option value="chronological">顺叙</option>
                            <option value="flashback">倒叙</option>
                            <option value="interpolation">插叙</option>
                            <option value="supplementary">补叙</option>
                            <option value="parallel">平叙</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="dw-input-row">
                <textarea
                    class="dw-input-textarea"
                    :class="{ expanded }"
                    :placeholder="placeholder"
                    v-model="text"
                    @keydown="onKeydown"
                ></textarea>
                <button
                    type="button"
                    class="dw-send-btn"
                    :class="{ 'is-stop': generating }"
                    :disabled="!generating && !canSend"
                    :aria-label="generating ? '停止生成' : '发送'"
                    @click="onSend"
                ><DwIcon :name="generating ? 'stop' : 'chevronRight'" class="dw-icon-md" /></button>
            </div>
        </div>
    `,
};

export default DwComposer;
