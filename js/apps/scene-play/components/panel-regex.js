/**
 * 情景剧场 · 正则库
 *
 * 一条规则 = 一个正则 + 一个卡片类型 + 捕获组到槽位的映射。
 * 规则是**全局的**(建一次到处用),启用与否是**每个情景各自决定的** ——
 * 这样不用为每个情景重新写一遍同样的正则。
 *
 * ★ 启用的规则会自动写进给 AI 的「输出格式」段。
 *   不这么做的话,用户新建一条正则之后 AI 永远不会写出那个格式,
 *   他会以为「我的正则没生效」——而实际上是根本没人告诉过 AI 有这个写法。
 */

import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import { CARD_KINDS } from '../constants.js';
import { previewRule, compileRule } from '../services/regex-engine.js';
import { asArray, truncate } from '../utils.js';

export const SpPanelRegex = {
    name: 'SpPanelRegex',
    components: { ...SHARED_COMPONENTS },
    emits: ['notify'],
    data() {
        return { CARD_KINDS, testId: '', testText: '' };
    },
    computed: {
        scene() { return store.getScene(); },
        rules() { return store.getRules(); },
        enabledIds() { return new Set(asArray(this.scene?.regexIds).map(String)); },
        testRule() { return this.rules.find((r) => String(r.id) === String(this.testId)) || null; },
        testResult() {
            if (!this.testRule) return null;
            return previewRule(this.testRule, this.testText);
        },
    },
    methods: {
        kindLabel(id) { return CARD_KINDS.find((c) => c.id === id)?.label || id; },
        isOn(rule) { return this.enabledIds.has(String(rule.id)); },
        toggle(rule) {
            if (!this.scene) { this.$emit('notify', '先选一个情景'); return; }
            store.toggleSceneRule(rule.id);
        },
        errorOf(rule) {
            const c = compileRule(rule);
            return c.ok ? '' : c.error;
        },
        sub(rule) {
            const err = this.errorOf(rule);
            if (err) return err;
            return `${this.kindLabel(rule.card)} · ${truncate(rule.pattern, 26)}`;
        },
        onNew() { store.openModal('regex-edit', { isNew: true }); },
        onEdit(rule) { store.openModal('regex-edit', { id: rule.id }); },
        onDelete(rule) { store.openModal('confirm-delete-rule', { id: rule.id, name: rule.name }); },
        onTest(rule) {
            this.testId = this.testId === rule.id ? '' : rule.id;
            this.testText = rule.sample || '';
        },
        enableAll() {
            if (!this.scene) return;
            store.updateScene({ regexIds: this.rules.map((r) => r.id) });
            this.$emit('notify', '这个情景下全部启用了');
        },
        disableAll() {
            if (!this.scene) return;
            store.updateScene({ regexIds: [] });
            this.$emit('notify', '这个情景下全部停用了');
        },
    },
    template: `
        <div class="sp-panel">
            <div class="sp-panel-actions">
                <SpButton variant="primary" size="sm" icon-name="plus" @click="onNew">新建规则</SpButton>
                <SpButton variant="line" size="sm" :disabled="!scene" @click="enableAll">全开</SpButton>
                <SpButton variant="quiet" size="sm" :disabled="!scene" @click="disableAll">全关</SpButton>
            </div>

            <p class="sp-note">
                规则是全局的,建一次到处用;左边的开关决定**这个情景**用不用它。
                启用的规则会自动告诉 AI,它才知道该写成什么格式。
            </p>

            <SpEmpty v-if="!rules.length" icon-name="regex" text="正则库是空的" hint="点上面「新建规则」加一条" />

            <div v-else class="sp-rule-list">
                <div v-for="rule in rules" :key="rule.id" class="sp-rule">
                    <div class="sp-rule-head">
                        <SpSwitch
                            :model-value="isOn(rule)"
                            :label="rule.name"
                            :hint="sub(rule)"
                            :disabled="!scene"
                            @update:model-value="toggle(rule)"
                        />
                    </div>
                    <div class="sp-rule-acts">
                        <button type="button" class="sp-mini" @click="onTest(rule)">试一下</button>
                        <button type="button" class="sp-mini" @click="onEdit(rule)">改</button>
                        <button type="button" class="sp-mini is-danger" :disabled="rule.builtin" @click="onDelete(rule)">删</button>
                    </div>

                    <div v-if="testId === rule.id" class="sp-rule-test">
                        <SpTextarea v-model="testText" :rows="2" placeholder="粘一段文本试试匹配" />
                        <p v-if="testResult && !testResult.ok" class="sp-note is-danger">{{ testResult.error }}</p>
                        <div v-else-if="testResult" class="sp-rule-preview">
                            <template v-for="(block, i) in testResult.blocks" :key="i">
                                <div v-if="block.kind === 'card'" class="sp-card-slot" v-html="block.html"></div>
                                <p v-else class="sp-rule-plain">{{ block.text }}</p>
                            </template>
                        </div>
                    </div>
                </div>
            </div>

            <SpSection title="怎么写" icon-name="info">
                <p class="sp-note">
                    正则里的**捕获组**(小括号)按序号填进卡片的槽位。
                    比如 <code>\\[博客[:：](.+?)\\|([\\s\\S]+?)\\]</code>,
                    标题设成 1、正文设成 2,AI 写 <code>[博客:标题|内容]</code> 就成了一张博客卡。
                </p>
                <p class="sp-note">
                    冒号建议写成 <code>[:：]</code>,中英文都收 ——
                    AI 在中文语境下十有八九打全角冒号,只认半角的话规则形同虚设。
                </p>
            </SpSection>
        </div>
    `,
};

export default SpPanelRegex;
