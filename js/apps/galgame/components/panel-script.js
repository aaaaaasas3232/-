/**
 * 湛蓝回忆 · 剧本面板
 *
 * 这一屏解决的是一件之前完全做不到的事:**玩一个事先写好的故事**。
 *
 * 原来的流程只有一条 —— 每一幕都现调 AI。没有 API Key 就一幕都走不了,
 * 而且同一个故事没法给第二个人玩(剧情树在自己的 IndexedDB 里)。
 * 现在多了一条离线的路:
 *
 *   ① 写游戏流程 → ② 复制指导 prompt(或一键生成)→ ③ 拿到一份 .txt
 *   → ④ 导入(选文件或粘贴)→ ⑤ 看校验报告 → ⑥ 确认导入 → 直接能玩
 *
 * 反向:⑦ 导出当前这一局的整棵树,复制或下载成同一份格式。
 *
 * ── 两条硬规矩 ────────────────────────────────────────────────────
 *
 * 1. **导入的文本全部走 Vue 插值**,这一屏一处 `v-html` 都没有。
 *    剧本是外部文件,里面写什么都有可能;`v-html` 一次就够出事了。
 * 2. **校验和导入是两步**。AI 写错格式是常态,静默导入一棵半截树是最难查的故障 ——
 *    先把错误连行号一起摆出来,用户点「确认导入」才动数据库。
 */

import * as store from '../store.js';
import * as nook from '../services/nook-bridge.js';
import { SHARED_COMPONENTS } from './shared.js';
import { SCRIPT_FORMAT_DOC, SCRIPT_EXAMPLE } from '../services/script-format.js';
import { readTextFile, downloadText, copyText, scriptFileName } from '../services/script-io.js';
import { SCRIPT_FLOW_MAX } from '../constants.js';
import { asArray, truncate } from '../utils.js';

/** 报告里最多列几条 —— 一份坏掉的文件能刷出几百条,全列出来只会把面板撑死 */
const ISSUE_LIMIT = 12;

export const GgPanelScript = {
    name: 'GgPanelScript',
    components: { ...SHARED_COMPONENTS },
    emits: ['notify'],
    data() {
        return {
            open: 'flow',
            flow: '',
            /** 待导入的原文(文件读进来的 / 粘贴的 / AI 生成的) */
            draft: '',
            draftFrom: '',
            report: null,
            exported: '',
            showPrompt: false,
            showDoc: false,
            showExample: false,
            FLOW_MAX: SCRIPT_FLOW_MAX,
            DOC: SCRIPT_FORMAT_DOC,
            EXAMPLE: SCRIPT_EXAMPLE,
        };
    },
    computed: {
        state() { return store.getState(); },
        game() { return store.getGame(); },
        presetMode() { return store.isPresetMode(); },

        apiInfo() {
            return nook.describeApiRef(nook.resolveApiRef(nook.getPlayerCard(this.game?.userPersonaId)));
        },

        /** 指导 prompt —— 和一键生成发出去的是同一次 `buildScriptPrompt` */
        guide() {
            return store.buildScriptGuide(this.flow);
        },

        canImport() {
            return Boolean(this.report && this.report.ok);
        },
        errors() { return asArray(this.report?.errors); },
        warnings() { return asArray(this.report?.warnings); },
        shownErrors() { return this.errors.slice(0, ISSUE_LIMIT); },
        shownWarnings() { return this.warnings.slice(0, ISSUE_LIMIT); },

        /** 校验通过之后给一眼能看完的结构预览 */
        outline() {
            return asArray(this.report?.nodes)
                .filter((n) => n.reachable)
                .slice(0, 40)
                .map((n) => ({
                    label: n.label,
                    depth: n.depth || 0,
                    indent: `${Math.min(n.depth || 0, 6) * 12}px`,
                    choice: n.choice?.text ? truncate(n.choice.text, 14) : '开场',
                    lines: asArray(n.segments).length,
                    options: asArray(n.options).length,
                    ending: n.ending ? n.ending.title : '',
                }));
        },

        canExport() {
            return Boolean(this.game) && this.state.nodes.length > 0;
        },
    },
    methods: {
        toggle(key) { this.open = this.open === key ? '' : key; },

        // ── ① 指导 prompt ──────────────────
        async onCopyGuide() {
            if (!this.flow.trim()) { this.$emit('notify', '先写几句游戏流程,不然 AI 不知道要编什么'); return; }
            const ok = await copyText(this.guide.text);
            this.$emit('notify', ok ? '指导 prompt 已复制,粘给任意 AI 就行' : '浏览器不让复制,展开原文手动选吧');
        },
        async onGenerate() {
            if (!this.flow.trim()) { this.$emit('notify', '先写几句游戏流程'); return; }
            const result = await store.generateScript(this.flow);
            if (!result.ok) { this.$emit('notify', result.error); return; }
            this.draft = result.text;
            this.draftFrom = 'AI 生成';
            this.onValidate();
            this.open = 'import';
        },
        onStopGenerate() { store.stopScriptGeneration(); },

        // ── ② 导入 ────────────────────────
        onPickFile() {
            this.$refs.file?.click();
        },
        async onFile(event) {
            const file = event?.target?.files?.[0];
            const result = await readTextFile(file);
            // 同一个文件连选两次也要能触发 change
            if (event?.target) event.target.value = '';
            if (!result.ok) { this.$emit('notify', result.error); return; }
            this.draft = result.text;
            this.draftFrom = file?.name || '文件';
            this.onValidate();
        },
        onValidate() {
            const text = this.draft.trim();
            if (!text) { this.report = null; this.$emit('notify', '先选一个文件,或者把剧本粘进来'); return; }
            this.report = store.validateScript(this.draft);
            if (this.report.ok) {
                this.$emit('notify', `校验通过:${this.report.stats.nodes} 幕 / ${this.report.stats.endings} 个结局`);
            } else {
                this.$emit('notify', `有 ${this.report.errors.length} 处要先改掉`);
            }
        },
        onClearDraft() {
            this.draft = '';
            this.draftFrom = '';
            this.report = null;
        },
        async onConfirmImport() {
            if (!this.canImport) return;
            const result = await store.importScript(this.draft, { presetMode: true });
            if (!result.ok) { this.$emit('notify', result.error); return; }
            this.onClearDraft();
            if (result.unmatched.length) {
                this.$emit('notify', `导入了 ${result.count} 幕。${result.unmatched.join('、')} 在 nook 里没有同名人设,不会有立绘`);
            }
        },

        // ── ③ 导出 ────────────────────────
        onExport() {
            const result = store.exportCurrentScript();
            if (!result.ok) { this.$emit('notify', result.error); return null; }
            this.exported = result.text;
            return result.text;
        },
        async onCopyExport() {
            const text = this.onExport();
            if (!text) return;
            const ok = await copyText(text);
            this.$emit('notify', ok ? '整棵树已复制成剧本' : '浏览器不让复制,展开原文手动选吧');
        },
        onDownloadExport() {
            const text = this.onExport();
            if (!text) return;
            const ok = downloadText(text, scriptFileName(this.game?.title));
            this.$emit('notify', ok ? '已下载' : '这个浏览器不让下载,用「复制」吧');
        },
        onCheckExport() {
            const text = this.onExport();
            if (!text) return;
            this.draft = text;
            this.draftFrom = '刚导出的这一局';
            this.onValidate();
            this.open = 'import';
        },

        // ── ④ 其他 ────────────────────────
        onPreset(value) {
            if (!store.setPresetMode(value)) { this.$emit('notify', '还没有故事'); return; }
            this.$emit('notify', value ? '已切到预设剧本模式,不会再调用 AI' : '已关掉预设模式,没写下文的选项会交给 AI');
        },
        async onCopyExample() {
            const ok = await copyText(this.EXAMPLE);
            this.$emit('notify', ok ? '示例已复制' : '浏览器不让复制,展开手动选吧');
        },
        lineText(issue) {
            return issue.line > 0 ? `第 ${issue.line} 行` : '整份文件';
        },
    },
    template: `
        <div class="gg-panel-body">
            <p class="gg-hint">
                这里可以把一份**事先写好的故事**变成能玩的剧情树。写好流程 → 让 AI 按格式输出一份文本文件 →
                导进来 → 没有 API Key 也能一路点着玩完。也可以把现在这一局导出成同一份格式。
            </p>

            <!-- ① 写流程 → 拿 prompt -->
            <GgSection title="① 写下游戏流程" icon-name="pen" collapsible :open="open === 'flow'" @toggle="toggle('flow')">
                <p class="gg-hint">
                    用你自己的话把故事讲一遍:谁、在哪、想干什么、会遇到什么、几种结局。
                    不用管格式 —— 格式说明会由下面那份指导 prompt 一并交给 AI。
                </p>
                <GgTextarea
                    v-model="flow"
                    :rows="7"
                    :maxlength="FLOW_MAX"
                    placeholder="例:女主是常年在海边画画的夏海遥,玩家是刚搬来的转学生。第一次搭话时可以坐下或走开;坐下之后能问她画了多久,也能安静陪她画完。结局有三个:知道她画了七年、约好明天再见、以及擦肩而过。"
                />
                <p class="gg-modal-count">还能写 {{ FLOW_MAX - flow.length }} 字</p>

                <p class="gg-api-line" :class="{ 'is-bad': !apiInfo.ok }">
                    <GgIcon :name="apiInfo.ok ? 'link' : 'warning'" />
                    <span>{{ apiInfo.label }}</span>
                    <em>{{ apiInfo.ok ? '可以一键生成' : '只能复制 prompt 去外面生成' }}</em>
                </p>

                <div class="gg-row-actions">
                    <GgButton size="sm" variant="ghost" icon-name="copy" @click="onCopyGuide">复制指导 prompt</GgButton>
                    <GgButton
                        size="sm"
                        variant="primary"
                        icon-name="sparkle"
                        :loading="state.scriptBusy"
                        :disabled="!apiInfo.ok"
                        @click="onGenerate"
                    >一键生成</GgButton>
                    <GgButton v-if="state.scriptBusy" size="sm" variant="quiet" icon-name="stop" @click="onStopGenerate">停下</GgButton>
                    <GgButton size="sm" variant="quiet" :icon-name="showPrompt ? 'chevronUp' : 'chevronDown'" @click="showPrompt = !showPrompt">
                        {{ showPrompt ? '收起 prompt' : '看这份 prompt' }}
                    </GgButton>
                </div>
                <p v-if="state.scriptBusy" class="gg-hint">正在写…{{ state.scriptChars ? state.scriptChars + ' 字' : '' }}</p>
                <p class="gg-hint">
                    这份 prompt 里已经带上了世界观、玩家身份、出场角色的真名、可用场景和完整格式说明,
                    一共 {{ guide.stats.tokens }} tokens。角色名必须用 nook 里的真名,不然导入后名牌不会显示。
                </p>
                <pre v-if="showPrompt" class="gg-ctx-pre">{{ guide.text }}</pre>
            </GgSection>

            <!-- ② 导入 -->
            <GgSection title="② 导入剧本" icon-name="upload" collapsible :open="open === 'import'" @toggle="toggle('import')">
                <div class="gg-row-actions">
                    <GgButton size="sm" variant="ghost" icon-name="upload" @click="onPickFile">选一个文件</GgButton>
                    <GgButton size="sm" variant="quiet" icon-name="check" @click="onValidate">校验这份剧本</GgButton>
                    <GgButton v-if="draft" size="sm" variant="quiet" icon-name="close" @click="onClearDraft">清空</GgButton>
                </div>
                <input
                    ref="file"
                    type="file"
                    class="gg-file-input"
                    accept=".txt,.md,text/plain"
                    @change="onFile"
                />
                <GgField label="或者直接粘进来" hint="手机上选文件不方便时用这个;file:// 单文件模式下也是这条路更稳">
                    <GgTextarea v-model="draft" :rows="6" placeholder="把 AI 给你的剧本文件整段粘在这里…" />
                </GgField>
                <p v-if="draftFrom" class="gg-script-from">来源:{{ draftFrom }} · {{ draft.length }} 字</p>

                <!-- 校验报告 -->
                <template v-if="report">
                    <div class="gg-script-verdict" :class="report.ok ? 'is-ok' : 'is-bad'">
                        <GgIcon :name="report.ok ? 'check' : 'warning'" />
                        <span v-if="report.ok">
                            可以导入:{{ report.stats.nodes }} 幕 · {{ report.stats.options }} 条选项 · {{ report.stats.endings }} 个结局
                        </span>
                        <span v-else>有 {{ errors.length }} 处必须先改掉</span>
                    </div>

                    <div v-if="errors.length" class="gg-script-report">
                        <p class="gg-sub-title">拦下来的错</p>
                        <div v-for="(item, i) in shownErrors" :key="'e' + i" class="gg-script-issue is-error">
                            <span class="gg-script-line">{{ lineText(item) }}</span>
                            <span class="gg-script-msg">{{ item.message }}</span>
                        </div>
                        <p v-if="errors.length > shownErrors.length" class="gg-hint">还有 {{ errors.length - shownErrors.length }} 条同类问题没列出来。</p>
                    </div>

                    <div v-if="warnings.length" class="gg-script-report">
                        <p class="gg-sub-title">提醒 <em>不影响导入</em></p>
                        <div v-for="(item, i) in shownWarnings" :key="'w' + i" class="gg-script-issue is-warn">
                            <span class="gg-script-line">{{ lineText(item) }}</span>
                            <span class="gg-script-msg">{{ item.message }}</span>
                        </div>
                        <p v-if="warnings.length > shownWarnings.length" class="gg-hint">还有 {{ warnings.length - shownWarnings.length }} 条提醒没列出来。</p>
                    </div>

                    <template v-if="report.ok">
                        <p class="gg-sub-title">结构预览</p>
                        <div class="gg-script-outline">
                            <div v-for="row in outline" :key="row.label" class="gg-script-node" :style="{ paddingLeft: row.indent }">
                                <span class="gg-script-node-label">{{ row.label }}</span>
                                <span class="gg-script-node-choice">{{ row.choice }}</span>
                                <span class="gg-script-node-meta">{{ row.lines }} 句 · {{ row.options }} 选项</span>
                                <GgTag v-if="row.ending" tone="ok">{{ row.ending }}</GgTag>
                            </div>
                        </div>
                        <div class="gg-row-actions">
                            <GgButton variant="primary" icon-name="download" @click="onConfirmImport">确认导入(新建一局)</GgButton>
                        </div>
                        <p class="gg-hint">
                            导入**永远是新建一局**,不会覆盖现在这一局。导进来的局默认开着「只读剧本模式」,
                            一次 AI 都不会调。
                        </p>
                    </template>
                </template>
            </GgSection>

            <!-- ③ 导出 -->
            <GgSection title="③ 导出当前故事" icon-name="download" collapsible :open="open === 'export'" @toggle="toggle('export')">
                <p class="gg-hint">
                    导出的是**整棵树**,不是你走过的那一条线 —— 所有分支和结局都在里面。
                    格式和导入的完全一样,改完再导回来就行。
                </p>
                <div class="gg-row-actions">
                    <GgButton size="sm" variant="ghost" icon-name="copy" :disabled="!canExport" @click="onCopyExport">复制到剪贴板</GgButton>
                    <GgButton size="sm" variant="ghost" icon-name="download" :disabled="!canExport" @click="onDownloadExport">下载 .txt</GgButton>
                    <GgButton size="sm" variant="quiet" icon-name="check" :disabled="!canExport" @click="onCheckExport">导出并校验一遍</GgButton>
                </div>
                <pre v-if="exported" class="gg-ctx-pre">{{ exported }}</pre>

                <p class="gg-sub-title">只读剧本模式</p>
                <GgSwitch
                    label="预设模式"
                    hint="开着的时候整局不调 AI:选项没写下文就直说到此为止,而不是去请求一个可能没配的 API"
                    :model-value="presetMode"
                    :disabled="!game"
                    @update:model-value="onPreset"
                />
            </GgSection>

            <!-- ④ 格式说明 -->
            <GgSection title="④ 剧本格式说明" icon-name="info" collapsible :open="open === 'doc'" @toggle="toggle('doc')">
                <div class="gg-row-actions">
                    <GgButton size="sm" variant="quiet" :icon-name="showDoc ? 'chevronUp' : 'chevronDown'" @click="showDoc = !showDoc">
                        {{ showDoc ? '收起说明' : '展开完整说明' }}
                    </GgButton>
                    <GgButton size="sm" variant="quiet" :icon-name="showExample ? 'chevronUp' : 'chevronDown'" @click="showExample = !showExample">
                        {{ showExample ? '收起示例' : '看一份完整示例' }}
                    </GgButton>
                    <GgButton size="sm" variant="quiet" icon-name="copy" @click="onCopyExample">复制示例</GgButton>
                </div>
                <pre v-if="showDoc" class="gg-script-doc">{{ DOC }}</pre>
                <pre v-if="showExample" class="gg-script-doc">{{ EXAMPLE }}</pre>
                <p v-if="!showDoc && !showExample" class="gg-hint">
                    一句话版:一幕一个 [NODE]标签,正文放 [TEXT] 里,台词用 [NAME]名字[/NAME],
                    选项一行一条、末尾写 [GOTO]目标标签[/GOTO],结局那一幕写 [ENDING]标题[/ENDING]。
                </p>
            </GgSection>
        </div>
    `,
};

export default GgPanelScript;
