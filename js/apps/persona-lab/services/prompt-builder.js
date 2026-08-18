/**
 * 人设机 · Prompt 组装(唯一真相)
 *
 * ── 为什么用框架的 context-composer ────────────────────────────────
 *
 * murmur(chat-app)和梦境编织都在做同一件事:把十几段正文拼成 system prompt,
 * 并让用户**看得见**。两边各写一份的结果是各自长歪:
 *
 *   - murmur:拼装是渲染那一页的副作用,用户不点进去 pre 就是旧的
 *   - 梦境编织(原版):预览走一条路径、发送走另一条,预览里关掉的段照发不误
 *
 * 框架层为此抽了 `src/core/context-composer.js`。本 App 直接用它,好处是:
 *
 *   const { text, parts, stats } = buildPersonaPrompt(...)
 *   //      ↑ 发给 AI       ↑ 给用户看
 *
 * **同一次调用的两个返回字段,物理上不可能不一致。**
 * 「上下文」抽屉里关掉某一段,下一次发送就真的不带它。
 *
 * ── 原型这一块坏在哪 ──────────────────────────────────────────────
 *
 * 原型(`ai角色智能编辑器.html`)的三条 prompt 各自手拼字符串:
 * `getCharacterResponse`(5370)、`getTeacherResponse`(5458)、
 * `performFormatConversion`(3049)。于是
 *
 *   - 角色模式带了「当前测题」,教师模式带的是另一套措辞的测题上下文,
 *     两边对「AI 刚才答了什么」的理解经常对不上
 *   - 用户完全看不到发出去的是什么,出了问题只能猜
 *
 * ── 写 prompt 的风格 ──────────────────────────────────────────────
 *
 * 对齐项目里最好的那几段(见 `docs/跨App注册Prompt指导方案.md` §5.1):
 *
 *   XX须知:
 *     - Principle: 一句话说清这段干嘛的。
 *     - Behaviors:
 *       - 具体动作
 *       - 边界条件
 *
 * Principle 一条,Behaviors 三到六条,**不铺陈背景**。
 * 上下文长度是有限的,多写一百行解释等于把人设正文挤掉一百行。
 */

import { createContextComposer } from '@/src/core/context-composer.js';
import { CONTEXT_SECTIONS, TRANSCRIPT_LIMIT, ROLE } from '../constants.js';
import { withLineNumbers, truncate } from '../utils.js';
import { describeFieldsForPrompt } from './card-schema.js';
import { readWorldContext, readPartnerContext, readCard } from './nook-bridge.js';

const composer = createContextComposer({ namespace: 'persona-lab' });

export { composer };

// ============================================================
// 各段正文
// ============================================================

const DUTY_PERSONA = `扮演须知:
  - Principle: 你就是下面这张人设卡上的这个人,不是在介绍她。用户正在通过对话检查这张卡写得够不够。
  - Behaviors:
    - 用第一人称说话,语气、用词、思考方式都按【人设正文】来
    - 人设里没写的事不要临时编设定;可以说"我没想过""不太清楚",这种回答本身就是给用户看的信号
    - 不解释你为什么这么回答,不做旁白,不写动作提示以外的括号说明
    - 回答控制在 2-5 句;被问到具体经历时可以长一些,但不要写成小作文
    - 绝对不要提到"人设""设定""AI""扮演"这些词`;

const DUTY_ADVISOR = `顾问须知:
  - Principle: 你是人设诊断顾问。读完这张卡和这段对话,找出一处让角色显得单薄或前后矛盾的地方,并给出可以直接落到某一行的改法。
  - Behaviors:
    - 只针对【人设正文】里真实存在的问题下判断,不要凭空建议加一堆无关设定
    - 优先级:自相矛盾 > 对话里露出的空白 > 描述太笼统(如只写"性格：内向")> 锦上添花
    - 一次只给一条。给两条会让用户不知道先改哪个,而且第二条通常是凑数的
    - 改法必须能落到具体行号,并且沿用正文现有的"键：值"写法
    - 理由要引用对话里的实际表现,不要写"这样更立体"这种放之四海皆准的话
    - 如果这张卡在这段对话里确实没暴露问题,就照【输出格式】回"无需修改"`;

const DUTY_CONVERT = `转换须知:
  - Principle: 把用户贴进来的任意格式人设,原样转成本系统的人设卡格式。
  - Behaviors:
    - 一个字都不要新编。原文没说的年龄、职业、经历,就是不填,不要替他想
    - 只做归类和拆行:把原文的每一条信息放到最贴切的字段名下面
    - 原文里有、但下面字段表里没有的信息(口头禅、称呼、示例对话、特殊偏好……),
      原样保留,并入"角色介绍",不要丢
    - 英文人设翻成中文,但专有名词保留原文并在括号里给中译
    - 原文如果是对话示例,压缩成一句"说话方式:……"放进"性格",不要整段照抄`;

const FORMAT_PERSONA = `输出格式:
  - 直接说话,不要任何前缀后缀
  - 不要 markdown 标题、不要代码块、不要列表符号
  - 动作和神态可以用括号,例如:(把杯子推远了一点)`;

/**
 * 顾问的输出格式。
 *
 * ★ 这里和原型分歧最大。原型让 AI 用自然语言写
 *   「第3行：性格：内向 → 性格：内向但善于倾听」,然后在客户端用**五套正则**去猜,
 *   猜不中就调 `generateDefaultSuggestion()` —— 那个函数会**凭空造一条修改建议**
 *   (拿正文里随便一个带冒号的行,把教师回复的一段话塞进去当新值)。
 *   用户看到的"AI 建议"里,有相当一部分 AI 根本没说过。
 *
 *   现在改成成对定界符包住的键值块:解析是确定性的,解析不出来就
 *   **只显示原文、不生成任何 diff**,绝不伪造。
 */
const FORMAT_ADVISOR = `输出格式:
  - 先用一到两句白话说结论,然后给出一个下面这样的块,块外不要再写别的
  - 改一行(行号取【人设正文】左侧那个编号):
<<<改
行=3
原=性格：内向
新=性格：内向,但被问到在意的事会突然话多
因=她在第 2 轮主动追问了对方的近况,只写"内向"解释不了这个反应
>>>
  - 加一行(加在第 N 行后面,N=0 表示加在最前面):
<<<加
行后=5
新=口头禅：那就这样吧
因=三轮里说了两次,已经是识别度很高的口癖
>>>
  - 确实没问题时:
<<<无>>>
  - "原=" 必须和那一行一字不差,包括标点。抄不准就改用"加"`;

function formatFields() {
    return `字段表(键名原样使用,不要改写、不要翻译;没有内容的键整行省略):\n${describeFieldsForPrompt()}`;
}

const FORMAT_CONVERT = `输出格式:
  - 每行一条"键：值",键名从上面的字段表里挑
  - 一条信息一行。长段落按句号断成多行,第二行起不写键名,直接接着写
  - 列表类(爱好 / 喜欢 / 讨厌 / 过敏 / 记忆 / 三观 / 心理内核 / 道德底线 / 技能与兴趣)一行一条,键名重复写
  - 只输出这些行,不要标题、不要代码块、不要任何说明文字`;

// ============================================================
// 上下文段
// ============================================================

function buildTranscript(messages, limit = TRANSCRIPT_LIMIT) {
    const list = (Array.isArray(messages) ? messages : [])
        .filter((m) => m && (m.role === ROLE.USER || m.role === ROLE.PERSONA) && String(m.text || '').trim())
        .slice(-limit);
    if (!list.length) return '';
    return list
        .map((m) => (m.role === ROLE.USER ? `问: ${m.text.trim()}` : `她: ${truncate(m.text, 400)}`))
        .join('\n');
}

function buildQuiz(quiz) {
    if (!quiz?.question) return '';
    const lines = [`题库: ${quiz.setName || '自定义'}`, `第 ${quiz.index + 1} / ${quiz.total} 题`, `问题: ${quiz.question}`];
    if (Array.isArray(quiz.options) && quiz.options.length) {
        lines.push('可选项:');
        quiz.options.forEach((opt, i) => lines.push(`  ${i + 1}. ${opt}`));
        lines.push('这是选择题,必须从上面挑一项,不能说都不是,也不能另起一项。');
        lines.push('第一句里原样带上你选的那一项原文,然后再用自己的话说为什么。');
    }
    if (quiz.answer) lines.push(`她刚才的回答: ${truncate(quiz.answer, 300)}`);
    if (quiz.pick) lines.push(`落到的选项: ${quiz.pick}`);
    return lines.join('\n');
}

function meta(id) {
    return CONTEXT_SECTIONS.find((s) => s.id === id) || { id, tag: id, label: id, locked: false };
}

/**
 * 把一组 body 铺成 part 数组。
 *
 * `config` 是用户在「上下文」抽屉里的开关。locked 的段忽略开关 ——
 * 关掉扮演须知之后模型会开始写产品说明书,那不是用户想要的自由度。
 */
function toParts(bodies, config = {}) {
    return CONTEXT_SECTIONS
        .filter((section) => bodies[section.id] !== undefined)
        .map((section) => ({
            id: section.id,
            title: section.label,
            tag: section.tag,
            content: bodies[section.id] || '',
            active: section.locked ? true : config[section.id] !== false,
            locked: section.locked === true,
            source: section.desc,
        }));
}

// ============================================================
// 三条组装路径
// ============================================================

/**
 * 扮演:让人设本人回答。
 *
 * @param {object} ctx
 * @param {object} ctx.draft   当前草稿(要 text / scope / personaId / contextConfig)
 * @param {object} [ctx.quiz]  当前测题
 * @returns {{ text:string, parts:Array, stats:object }}
 */
export function buildPersonaPrompt(ctx = {}) {
    const { draft, quiz } = ctx;
    const card = draft?.personaId ? readCard(draft.scope, draft.personaId) : null;

    const quizHasOptions = Array.isArray(quiz?.options) && quiz.options.length > 0;
    const bodies = {
        duty: DUTY_PERSONA,
        persona: String(draft?.text || '').trim(),
        world: readWorldContext(card),
        partner: readPartnerContext(),
        quiz: buildQuiz(quiz),
        format: quizHasOptions
            ? `${FORMAT_PERSONA}\n  - 当前是选择题:第一句必须原样带上你选的那一项原文`
            : FORMAT_PERSONA,
    };

    return composer.composeAndSave(
        `persona::${draft?.id || 'none'}`,
        toParts(bodies, draft?.contextConfig),
    );
}

/**
 * 打磨:让顾问读完对话给一条修改建议。
 *
 * ★ 这一条的人设正文是**带行号**的,而且行号来自 `utils.toLines` ——
 *   和 `suggestion.applySuggestion()` 应用修改时切行的是同一个函数。
 *   原型这两处用了不同的切分(一处过滤空行、一处没过滤),正文里有空行时
 *   AI 说的第 7 行会落到实际第 8 行,静默改错地方。
 */
export function buildAdvisorPrompt(ctx = {}) {
    const { draft, quiz, request } = ctx;
    const card = draft?.personaId ? readCard(draft.scope, draft.personaId) : null;

    const bodies = {
        duty: request ? `${DUTY_ADVISOR}\n\n用户这次特别想让你看的:${String(request).trim()}` : DUTY_ADVISOR,
        persona: withLineNumbers(draft?.text || ''),
        world: readWorldContext(card),
        partner: readPartnerContext(),
        quiz: buildQuiz(quiz),
        transcript: buildTranscript(draft?.messages),
        format: FORMAT_ADVISOR,
    };

    return composer.composeAndSave(
        `advisor::${draft?.id || 'none'}`,
        toParts(bodies, draft?.contextConfig),
    );
}

/**
 * 转换:任意格式 → 本系统人设卡正文。
 *
 * 这条不吃用户的上下文开关 —— 它和当前草稿无关,是一次独立的格式化任务,
 * 关掉任何一段都只会让结果变差。
 */
export function buildConvertPrompt() {
    const result = composer.compose([
        { id: 'duty', title: '转换须知', tag: '转换须知', content: DUTY_CONVERT, locked: true },
        { id: 'fields', title: '字段表', tag: '字段表', content: formatFields(), locked: true },
        { id: 'format', title: '输出格式', tag: '输出格式', content: FORMAT_CONVERT, locked: true },
    ]);
    composer.save('convert', result.text);
    return result;
}

/** 读上一次拼好的快照(「看看发出去的是什么」)*/
export function readLastPrompt(kind, draftId) {
    return composer.load(kind === 'convert' ? 'convert' : `${kind}::${draftId || 'none'}`);
}
