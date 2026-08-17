/**
 * 人设机 —— 问出来的人设,才知道立不立得住
 *
 * 由单文件原型 `ai角色智能编辑器.html`(8685 行)重写而来。
 * 功能对齐原型的**主线**,实现全部换成本项目的 vue 模式范式。
 *
 * ── 架构 ──────────────────────────────────────────────────────────
 *
 *   index.js          appConfig(框架对接都在这)
 *   store.js          Vue.reactive 单例 + mutator + 分草稿防抖落盘
 *   constants.js      枚举 / 默认值(★ 不含任何颜色)
 *   icons.js          内联 SVG 图标集(原型用的 Font Awesome + emoji 全换掉)
 *   utils.js          id / 文本 / 行 / 时间 / 深拷贝
 *   question-bank.js  题库
 *   services/
 *     card-schema.js    ★ 正文 ⇄ nook 人设卡 的唯一映射
 *     nook-bridge.js    ★ 读写 nook 人设卡 + 解析默认用户人设绑定的 API
 *     prompt-builder.js ★ 上下文组装(预览 == 发送,走框架 context-composer)
 *     suggestion.js     建议的解析与应用(确定性,不伪造)
 *     ai-service.js     选 API / 流式与一次性 / 中断
 *     db.js             plDrafts 一张表
 *   components/       根 / 人设库 / 导入 / 工作台(提问·打磨·档案) / 弹窗 / 通用控件
 *
 * ── 主线 ──────────────────────────────────────────────────────────
 *
 *   从 nook 拉一张卡(或粘贴任意格式转换出一张)
 *     → 提问,看她答得像不像
 *     → 不满意就让顾问指出该改哪一行
 *     → 采用建议
 *     → 存回 nook(原来就有的卡**直接覆盖**,不新建)
 *
 * ── 相对原型的关键变化 ────────────────────────────────────────────
 *
 *   1. **不再填 API**。Key 由 nook 的 API 管理统一保管,这里拉「默认用户人设」
 *      绑定的那个。原型把 Key 明文写进 localStorage,而且 11 个厂商各写了
 *      一份 fetch。
 *   2. **人设卡不再是一坨文本**。正文和 nook 的结构化字段之间有一个确定性投影
 *      (`services/card-schema.js`),保存前能看到每个字段会写成什么。
 *   3. **建议不再伪造**。原型解析不出格式时会凭空造一条 diff,这里宁可不给。
 *   4. **三栏改单栏**。原型是桌面三列布局,手机上完全没法用。
 *
 *   完整的原型 bug 清单见 `docs/人设机.md`。
 */

import { createPersonaLabRoot } from './components/root.js';
import { PL_STORES } from './services/db.js';
import { desktopIcon } from './icons.js';
import { APP_ID } from './constants.js';
import * as store from './store.js';

export default function createPersonaLabApp() {
    return {
        // ── 身份 ────────────────────────────
        id: APP_ID,
        name: '人设机',
        // 桌面图标画在 .app-shell 外面,拿不到主题变量 —— 描边色只能显式给,见 icons.js
        icon: desktopIcon(),
        iconBg: 'linear-gradient(140deg, #FFFFFF 0%, #FFE7EE 100%)',

        dock: { visible: true, order: 0 },

        distribution: {
            requiresInstall: false,
            appStore: {
                subtitle: '把人设问一遍再定稿',
                category: '创作',
                isGame: false,
                rating: 4.7,
                ratingsCount: '92',
                size: '1.1 MB',
                age: '12+',
                version: '1.0.0',
                whatsNew: '从单文件原型重写:接上 nook 人设库、API 走人设绑定、修改建议不再瞎编。',
                description: `一个人设写到什么程度，才算真的站住了？设定可以很完整，可一个人往往要在开口以后，才露出那些没被写下的地方。

人设机可以从 nook 取来一张人设卡，也接住 JSON、YAML 或一段普通描述。整理成系统认识的字段后，你可以和角色问答几轮，再让 AI 顾问指出设定中具体需要斟酌的位置。

建议不会替你落笔。接受、忽略、继续修改，都由你决定；确认之后，再亲手把它存回 nook。`,
                accent: 'linear-gradient(145deg, #FFFFFF 0%, #FFD1E0 100%)',
                tutorial: [
                    {
                        title: '从 nook 拉人设进来',
                        content: '点顶栏的「拉取人设」按钮,会从 nook 读取当前选中的人设卡并自动填入表单。你也可以跳过这一步,直接手动粘入其他人设格式。',
                    },
                    {
                        title: '怎么转别人的人设格式',
                        content: '在输入框里粘入 JSON、YAML 或者一段描述性文字,然后点「解析」。人设机会尝试识别其中的关键字段(名字、性格、背景等),转换为小听系统的人设格式。',
                    },
                    {
                        title: '问人设几轮是什么感觉',
                        content: '点「开始对话」后,输入你想问的问题,AI 顾问会以那个角色的口吻回答你。通过这种方式,你可以感受到角色设定是否到位,哪些地方还需要补充。',
                    },
                    {
                        title: '怎么把改好的人设存回去',
                        content: '确认人设内容无误后,点「保存到 nook」。如果 nook 里已有这张人设卡,会直接覆盖;如果没有,会新建一张。人设更新后,murmur、朋友圈等依赖人设的地方都会立即使用新版本。',
                    },
                    {
                        title: '顾问会指出什么问题',
                        content: 'AI 顾问会从角色的言行一致性、性格完整性、背景合理性等角度给出反馈。常见的建议包括:性格描述太抽象、背景设定缺少细节、角色行为和性格描述不一致等。',
                    },
                ],
                faqs: [
                    {
                        question: '人设机里的人设和 nook 里是同步的吗？',
                        answer: '单向同步。从 nook 拉取会更新人设机里的内容,但在人设机里修改后需要手动点「保存到 nook」才会写回 nook。',
                    },
                    {
                        question: '可以转酒馆格式的人设吗？',
                        answer: '可以。人设机支持识别常见的开放格式。如果识别失败,可以手动调整解析结果。',
                    },
                    {
                        question: '顾问给的建议一定会被采纳吗？',
                        answer: '不会自动采纳。建议只是参考,你可以选择接受或忽略。最终的人设内容由你自己决定。',
                    },
                    {
                        question: '保存到 nook 后 murmur 会立刻更新吗？',
                        answer: '会的。保存到 nook 后,人设内容会立即更新。murmur 和朋友圈等用到人设的地方会在下次生成回复时使用新版本。',
                    },
                ],
            },
        },

        // ── 外观 ────────────────────────────
        // ★ 这三个是**首帧兜底值**,和 `_theme.css` 的默认值对齐,防止打开时闪一下。
        //   挂载后根组件会从 CSS 变量里读出实际值覆盖它们(见 components/root.js 的
        //   `syncChrome`)—— 颜色的真相始终在 CSS,这里只是转发给框架的搬运。
        background: '#FFFFFF',
        statusBarColor: '#2E2A2C',
        homeIndicatorColor: 'rgba(46, 42, 44, 0.35)',

        /**
         * 自绘底栏,要让内容一直铺到屏幕底边。
         * 配套的容器接线在 `css/apps/persona-lab/_base.css` 开头
         * (`.app-content` / `.app-page` / `.app-screen-panel` 四处一起改,少一处就不成立)。
         */
        fullscreen: true,

        // 顶栏和 tab 栏都自己画:工作台要全屏,库页有自己的头部
        topbar: { visible: false },
        nav: { type: 'none' },

        pages: [{ id: 'home', label: '人设库', nav: true }],
        defaultRootPageId: 'home',

        // ★ 声明了 stores 就必须在 js/apps/index.js 里 async 注册,
        //   否则首次写盘时表还没建出来,表现是「保存成功但刷新就没了」
        stores: PL_STORES,

        renderMode: 'vue',

        /** ★ 没有 this —— framework 把它当独立函数调 */
        renderPage() {
            return createPersonaLabRoot();
        },

        methods: {
            /** 供外部预热 / 深链调用;正常路径由根组件 mounted 自己拉 */
            async hydrate() {
                await store.hydrate(this.app);
            },
        },

        services: {
            /**
             * 给别的 App 用:把一段任意格式的人设丢进来存成草稿。
             *
             * 典型场景 —— 用户在 murmur 里收到一段人设,想拿来改:
             *   invokeService('persona-lab', 'stashPersona', { text, scope: 'ai' })
             *
             * 只落草稿不写 nook:写库这一步必须由用户在确认过字段之后自己点。
             */
            async stashPersona(payload = {}) {
                const text = String(payload.text || payload.content || '').trim();
                if (!text) return { ok: false, error: '内容为空' };
                await store.hydrate(this.app);
                const draft = await store.createDraft({
                    text,
                    scope: payload.scope === 'user' ? 'user' : 'ai',
                    title: payload.title,
                });
                await store.flushPersist();
                return { ok: Boolean(draft), id: draft?.id };
            },

            /** 给别的 App 用:现在有哪些人设正在打磨(只读摘要) */
            async listDrafts() {
                await store.hydrate(this.app);
                return store.getState().drafts.map((d) => ({
                    id: d.id,
                    title: d.title,
                    scope: d.scope,
                    personaId: d.personaId,
                    dirty: store.isDirty(d),
                    updatedAt: d.updatedAt,
                }));
            },
        },
    };
}
