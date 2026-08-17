/**
 * 结果页
 *
 * 三件事，按用户最可能的顺序排：
 *   1. **把白膜装到桌面** —— 最直观。装完退出去就能在桌面上点开它。
 *   2. **复制提示词** —— 拿去给 AI 把白膜填成真 App。
 *   3. **下载 .js** —— 存下来，之后从 nook 的软件管理再装。
 *
 * 装桌面走的是和 nook 上传**完全同一条路径**（`installAndPersist`），
 * 所以「这里能装上」就等于「下载下来上传也能装上」——
 * 不存在两条路径行为不一致的可能。
 */

import * as store from '../store.js';
import { buildBlueprint, reviewBlueprint } from '../survey/blueprint.js';
import { generateAppCode } from '../survey/codegen.js';
import { buildPrompt } from '../survey/prompt.js';
import { ICONS } from '../icons.js';
import {
    installAndPersist, downloadJs, validatePluginCode, removePlugin, listPlugins,
} from '@/src/core/plugin-installer.js';

export const AmResult = {
    name: 'AmResult',
    props: {
        state: { type: Object, required: true },
    },
    data() {
        return {
            tab: 'prompt',
            installing: false,
            installMsg: '',
            installOk: false,
            copied: '',
        };
    },
    computed: {
        icons() { return ICONS; },
        bp() { return buildBlueprint(this.state.answers); },
        review() { return reviewBlueprint(this.bp); },
        code() { return this.state.generated.code || generateAppCode(this.bp); },
        prompt() { return this.state.generated.prompt || buildPrompt(this.bp); },
        codeStats() {
            const c = this.code;
            return { lines: c.split('\n').length, kb: (c.length / 1024).toFixed(1) };
        },
        promptStats() {
            const p = this.prompt;
            return { lines: p.split('\n').length, kb: (p.length / 1024).toFixed(1) };
        },
        /** 生成的代码自己也要过一遍安装器的体检 —— 生成器出 bug 时这里会先报出来 */
        selfCheck() { return validatePluginCode(this.code); },
        installed() { return this.state.installedAppId; },
        fileName() { return `${this.bp.appId}.js`; },
    },
    methods: {
        regenerate() {
            store.setGenerated(generateAppCode(this.bp), buildPrompt(this.bp));
        },
        async install() {
            if (this.installing) return;
            this.installing = true;
            this.installMsg = '';

            const result = await installAndPersist(this.code, {
                fileName: this.fileName,
                source: 'app-maker',
                allowReplace: true,
            });

            this.installing = false;
            this.installOk = result.success;
            if (result.success) {
                store.setInstalled(result.appId);
                this.installMsg = `已经装到桌面了。退出这个 App 就能看到「${this.bp.appName}」。`;
                if (!result.persisted) {
                    this.installMsg += '（不过存不下源码，刷新后会消失 —— 多半是浏览器存储满了，先去 nook 的软件管理删掉几个旧插件。）';
                }
            } else {
                this.installMsg = result.error || '装不上，原因不明';
            }
        },
        uninstall() {
            const hit = listPlugins().find((p) => p.appId === this.installed);
            if (hit) removePlugin(hit.id);
            store.setInstalled('');
            this.installMsg = '已经从桌面移除。';
            this.installOk = false;
        },
        download() {
            downloadJs(this.code, this.fileName);
        },
        async copy(what) {
            const text = what === 'code' ? this.code : this.prompt;
            let ok = false;
            try {
                await navigator.clipboard.writeText(text);
                ok = true;
            } catch (_) {
                // 非 https / 老浏览器下 clipboard API 不可用，退回 execCommand
                try {
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    ta.style.position = 'fixed';
                    ta.style.opacity = '0';
                    document.body.appendChild(ta);
                    ta.select();
                    ok = document.execCommand('copy');
                    document.body.removeChild(ta);
                } catch (_) { ok = false; }
            }
            this.copied = ok ? what : '';
            if (ok) setTimeout(() => { this.copied = ''; }, 2000);
        },
    },
    mounted() {
        if (!this.state.generated.code) this.regenerate();
    },
    template: `
        <div class="am-result">
            <div v-if="review.blockers.length" class="am-review am-review--block">
                <div class="am-review__title"><span v-html="icons.warn"></span>先改这几项，不然装不上</div>
                <p v-for="(b, i) in review.blockers" :key="i" class="am-review__item">{{ b }}</p>
            </div>

            <!-- 1. 装到桌面 -->
            <section class="am-card am-card--hero">
                <div class="am-card__head">
                    <div>
                        <h3 class="am-card__title">先看看它长什么样</h3>
                        <p class="am-card__desc">
                            把白膜装到桌面上。页面、顶栏、底栏、弹窗、灵动岛都是真的，
                            可以点、可以弹，只有里面的文字是占位数据。
                        </p>
                    </div>
                </div>

                <div v-if="!installed" class="am-card__actions">
                    <button
                        type="button" class="am-btn am-btn--primary am-btn--block"
                        :disabled="installing || review.blockers.length > 0"
                        @click="install"
                    >{{ installing ? '正在装…' : '装到桌面' }}</button>
                </div>
                <div v-else class="am-card__actions">
                    <span class="am-installed">桌面上已经有它了</span>
                    <button type="button" class="am-btn am-btn--ghost" @click="install">重新装一次</button>
                    <button type="button" class="am-btn am-btn--ghost is-danger" @click="uninstall">从桌面移除</button>
                </div>

                <p v-if="installMsg" class="am-card__msg" :class="{ 'is-ok': installOk, 'is-bad': !installOk }">{{ installMsg }}</p>

                <p class="am-card__foot">
                    装上之后可以在 nook →「软件管理」里管理它（停用、重装、导出、删除）。
                </p>
            </section>

            <!-- 2 / 3. 提示词与代码 -->
            <div class="am-tabs">
                <button type="button" :class="{ 'is-on': tab === 'prompt' }" @click="tab = 'prompt'">提示词</button>
                <button type="button" :class="{ 'is-on': tab === 'code' }" @click="tab = 'code'">白膜源码</button>
            </div>

            <section v-if="tab === 'prompt'" class="am-card">
                <div class="am-card__head">
                    <div>
                        <h3 class="am-card__title">给 AI 的提示词</h3>
                        <p class="am-card__desc">
                            {{ promptStats.lines }} 行 · {{ promptStats.kb }}KB。
                            这份是按你的配置现算的 —— 你没勾的能力，里面不会有对应章节。
                        </p>
                    </div>
                </div>
                <div class="am-card__actions">
                    <button type="button" class="am-btn am-btn--primary" @click="copy('prompt')">
                        <span v-html="copied === 'prompt' ? icons.check : icons.copy"></span>
                        {{ copied === 'prompt' ? '已复制' : '复制全文' }}
                    </button>
                </div>
                <pre class="am-code is-prose">{{ prompt }}</pre>
            </section>

            <section v-else class="am-card">
                <div class="am-card__head">
                    <div>
                        <h3 class="am-card__title">白膜源码</h3>
                        <p class="am-card__desc">
                            {{ codeStats.lines }} 行 · {{ codeStats.kb }}KB。
                            零依赖单文件，存下来之后从 nook →「软件管理」上传就能装。
                        </p>
                    </div>
                </div>

                <div v-if="!selfCheck.ok" class="am-review am-review--block">
                    <div class="am-review__title"><span v-html="icons.warn"></span>生成的代码没通过体检</div>
                    <p v-for="(e, i) in selfCheck.errors" :key="i" class="am-review__item">{{ e }}</p>
                </div>
                <div v-else class="am-selfcheck">
                    <span v-html="icons.check"></span>
                    体检通过：没有 import、有 default export 工厂、appConfig 字段完整。
                </div>

                <div class="am-card__actions">
                    <button type="button" class="am-btn am-btn--primary" @click="download">
                        <span v-html="icons.download"></span>下载 {{ fileName }}
                    </button>
                    <button type="button" class="am-btn am-btn--ghost" @click="copy('code')">
                        {{ copied === 'code' ? '已复制' : '复制源码' }}
                    </button>
                </div>
                <pre class="am-code">{{ code }}</pre>
            </section>

            <button type="button" class="am-btn am-btn--quiet am-btn--block" @click="regenerate">
                <span v-html="icons.refresh"></span>按当前配置重新生成
            </button>
        </div>
    `,
};
