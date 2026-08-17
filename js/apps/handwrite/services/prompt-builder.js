/**
 * 手书 · Prompt 组装(唯一真相)
 *
 * ── 一条硬约束:预览 == 发送 ──────────────────────────────────────
 *
 * 只有一个 `buildContextParts()`。它产出一组 part;
 * 提示词面板渲染这组 part,发送时把**同一组** part 交给 composer。
 *
 *   const { text, parts } = buildPrompt({ … });
 *   //      ↑ 发给 AI     ↑ 给用户看
 *
 * 两者是同一次调用的两个返回字段,**物理上不可能不一致**。
 * 段落开关 = `project.contextConfig[sectionId]`,唯一入口。
 *
 * ── 写 prompt 的风格 ──────────────────────────────────────────────
 *
 * 对齐 murmur / 湛蓝回忆 / 情景那套:
 *
 *   XX须知:
 *     - Principle: 一句话说清这段干嘛的
 *     - Behaviors:
 *       - 具体动作
 *       - 边界条件
 *
 * Principle 一条,Behaviors 三到六条,**不铺陈背景**。
 *
 * ── 语法段从哪来 ──────────────────────────────────────────────────
 *
 * 「脚本语法」那一段是从 `script-parser.js` 的 `GRAMMAR_HELP` **算出来的**,
 * 不是手抄的。解析器加一条指令,给 AI 的说明书自动跟着变 ——
 * 否则迟早出现「文档里有、解析器不认」或者反过来,而这类不一致
 * 只会表现为「AI 生成的脚本导进来少了几行」,极难查。
 */

import { createContextComposer } from '@/src/core/context-composer.js';
import { CONTEXT_SECTIONS } from '../constants.js';
import { kvBlock, asArray, truncate } from '../utils.js';
import { GRAMMAR_HELP } from './script-parser.js';
import { allEffects } from '../presets/effects.js';
import * as nook from './nook-bridge.js';

const composer = createContextComposer({ namespace: 'handwrite' });

export { composer };

// ============================================================
// 各段正文
// ============================================================

function buildSystemPart() {
    return `手书须知:
  - Principle: 你在给一部**纯文字手书**写脚本。屏幕上没有画面、没有配音,只有字在出现、消失、抖动 —— 所有情绪都得靠字什么时候出来、什么时候被删掉来传达。
  - Behaviors:
    - 想清楚「观众此刻屏幕上看到的是哪几个字」再写下一条指令,不要写成分镜脚本或小说
    - 最有力的手法是**说了又收回去**:打出一句真心话,停几秒,再一个字一个字删掉
    - 一次只让少量文字停在屏幕上,长句用【清空】断开,不要堆成一屏
    - 停顿是内容不是空白。该沉默的地方就写【停顿】,别用文字把节奏填满
    - 效果服务于情绪:平静的句子不要加抖动,克制着用
    - 不要解释你的构思,直接输出脚本`;
}

function buildWorldPart({ world, clips }) {
    const base = nook.describeWorld(world);
    const clipText = asArray(clips)
        .filter((c) => c.content.trim())
        .map((c) => `【${c.title}】${c.content.trim()}`)
        .join('\n');
    const body = [base, clipText].filter(Boolean).join('\n\n');
    return body ? `${body}\n\n注意: 世界观只是底色。手书写的是情绪,不需要把设定念一遍。` : '';
}

function buildUserPart({ userCard }) {
    const base = nook.describeUser(userCard);
    return base ? `${base}\n\n注意: 这是**作者本人**。手书的第一人称就是他。` : '';
}

function buildAiPart({ ai }) {
    const base = nook.describeAi(ai);
    return base ? `${base}\n\n注意: 手书里如果出现「你」,默认指这个人。` : '';
}

function buildBriefPart({ project }) {
    const brief = String(project?.brief || '').trim();
    return kvBlock([
        ['标题', project?.title],
        ['简介', project?.description],
        ['这次想做的', brief],
    ]);
}

function buildStagePart({ project }) {
    const stage = project?.stage || {};
    const seconds = Math.round((project?.targetMs || 0) / 1000);
    return kvBlock([
        ['画幅', stage.aspect],
        ['底色', stage.backdrop],
        ['字号', stage.fontSize ? `${stage.fontSize}px(一屏大约放得下 ${Math.max(6, Math.floor(300 / (stage.fontSize || 34) * 6))} 个字)` : ''],
        ['期望时长', seconds ? `${seconds} 秒左右` : '40 到 90 秒'],
    ]);
}

function buildEffectsPart({ userEffects }) {
    const list = allEffects(userEffects);
    if (!list.length) return '';
    const lines = list.map((e) => `- ${e.name}: ${e.desc || ''}`.trimEnd());
    return `可以用这些效果名(写成【效果:名字】或直接【名字】):\n${lines.join('\n')}\n\n注意: 只能用这个名单里的名字。写了名单外的效果,那一行会被丢掉。`;
}

function buildExistingPart({ project }) {
    const script = String(project?.script || '').trim();
    if (!script) return '';
    return `这份企划已经有一段脚本了:\n\n${truncate(script, 1500)}\n\n注意: 接着它往下写或者改写它,不要另起炉灶。`;
}

function buildCustomPart({ customPrompts }) {
    const list = asArray(customPrompts).filter((p) => p.enabled && p.content.trim());
    if (!list.length) return '';
    return list.map((p) => (p.title ? `【${p.title}】\n${p.content.trim()}` : p.content.trim())).join('\n\n');
}

/**
 * 脚本语法。
 *
 * ★ 从 `GRAMMAR_HELP` 生成,和 App 内「语法说明」面板、和解析器实现同源。
 */
function buildGrammarPart() {
    const blocks = GRAMMAR_HELP.map((group) => {
        const lines = group.items.map((item) => `  ${item.syntax}\n    ${item.desc}`);
        return `【${group.group}】\n${lines.join('\n')}`;
    });
    return `脚本语法须知:
  - Principle: 脚本逐行解析,每一行要么是一条指令,要么是一行纯文字(等于【打字】)。
  - Behaviors:
    - 方括号用全角【】,冒号用全角:
    - 时长写在指令名后面(【打字 2s】)或参数里(【停顿】1.2s)
    - 不写时长就按字数自动算,大多数时候不用写
    - 行内可以用括号插指令,这是最常用的写法

${blocks.join('\n\n')}

一个完整的例子:

【背景:暮】
【打字】我（出现再删除 10s：我喜欢）…不是我什么都没说
【停顿】1.5s
【清空】
【抖动】
【打字】算了
【停顿 2s】
【渐隐】
【打字】下次一定说`;
}

function buildFormatPart() {
    return `输出格式须知:
  - Principle: 只输出脚本正文,解析器逐行读,多一个字都会变成屏幕上的字。
  - Behaviors:
    - 不要用 \`\`\` 围栏,不要写「好的,这是脚本」之类的开场白
    - 不要写标题、不要编号、不要在行末加解释
    - 想加注释就用 # 开头单独一行,解析器会跳过
    - 第一行建议是【背景:xx】,最后一行建议给个【停顿】收尾`;
}

// ============================================================
// 组装
// ============================================================

/**
 * 收集这次生成要用到的全部外部数据。
 *
 * 单独抽出来是因为**提示词面板和发送都要它** —— 各读各的就会出现
 * 「面板里显示了世界观,实际没发出去」这种对不上的情况。
 */
export function collectSources({ project, library } = {}) {
    const userCard = nook.getUserCard(project?.userId);
    const world = nook.getWorld(project?.worldId, userCard);
    return {
        userCard,
        world,
        clips: nook.listWorldClips(world),
        ai: nook.getAi(project?.aiId),
        userEffects: asArray(library?.effects),
    };
}

/**
 * 产出这次生成的全部上下文段落。
 *
 * **提示词面板和发送共用这一个函数。**
 */
export function buildContextParts(ctx = {}) {
    const { project, sources } = ctx;
    if (!project || !sources) return [];

    const config = project.contextConfig || {};

    const bodies = {
        system: buildSystemPart(),
        world: buildWorldPart({ world: sources.world, clips: sources.clips }),
        user: buildUserPart({ userCard: sources.userCard }),
        ai: buildAiPart({ ai: sources.ai }),
        brief: buildBriefPart({ project }),
        stage: buildStagePart({ project }),
        effects: buildEffectsPart({ userEffects: sources.userEffects }),
        existing: buildExistingPart({ project }),
        custom: buildCustomPart({ customPrompts: project.customPrompts }),
        grammar: buildGrammarPart(),
        format: buildFormatPart(),
    };

    return CONTEXT_SECTIONS.map((meta) => ({
        id: meta.id,
        title: meta.label,
        tag: meta.tag,
        content: bodies[meta.id] || '',
        // locked 段不给关 —— 关掉「脚本语法」之后模型会开始写散文,
        // 解析器一条指令都认不出来,表现是「点了生成,什么都没变」
        active: meta.locked ? true : config[meta.id] !== false,
        locked: meta.locked === true,
        source: meta.desc,
    }));
}

/**
 * 拼出最终 system prompt。
 *
 * `opts.save` 控制要不要写快照:发送时写(留一份「上次发出去的是什么」),
 * 提示词面板预览时**不写** —— 预览是个 computed,每次重渲染都写一遍
 * localStorage 既浪费又会把真正发出去的那份快照冲掉。
 *
 * 注意两条路径走的是**同一个函数**,只是要不要落快照的差别。
 *
 * @returns {{ text:string, parts:Array, stats:object }}
 */
export function buildPrompt(ctx = {}, opts = {}) {
    const parts = buildContextParts(ctx);
    const composeOpts = {
        order: asArray(ctx.project?.contextOrder).length ? ctx.project.contextOrder : undefined,
    };
    if (opts.save === false) return composer.compose(parts, composeOpts);
    return composer.composeAndSave(scopeOf(ctx.project), parts, composeOpts);
}

function scopeOf(project) {
    return `${project?.id || 'none'}`;
}

// ============================================================
// 本轮指令
// ============================================================

/**
 * 拼「这一轮要 AI 干什么」。
 *
 * 和 system prompt 分开:system 是设定(每轮基本不变,便于服务端缓存),
 * 这一段才是本轮指令。
 *
 * @param {object} opts
 * @param {'create'|'continue'|'rewrite'|'polish'} opts.kind
 * @param {string} [opts.brief]      用户这次输入的企划说明
 * @param {number} [opts.seconds]    期望时长
 * @param {string} [opts.selection]  改写时选中的那一段脚本
 */
export function buildUserTurn({ kind, brief, seconds, selection } = {}) {
    const want = seconds ? `整支大约 ${Math.round(seconds)} 秒。` : '整支 40 到 90 秒。';
    const theme = String(brief || '').trim();

    if (kind === 'continue') {
        return `接着现有脚本往下写,写到一个能收住的地方为止。${want}\n${theme ? `这一段想表达: ${theme}` : '顺着已有的情绪走,不要突然转调。'}`;
    }
    if (kind === 'rewrite') {
        return `把下面这段重写一遍,情绪更准一点,节奏更松一点:\n\n${truncate(selection, 800)}\n\n只输出重写后的脚本,不要保留原文。`;
    }
    if (kind === 'polish') {
        return '在不改动文字内容的前提下,给现有脚本补上停顿和效果,让它更像一支手书。只输出完整的新脚本。';
    }
    return `写一支完整的手书。${want}\n${theme ? `主题: ${theme}` : '主题自定,写一件说不出口的小事。'}\n\n至少用到一次「打出来又删掉」的手法。`;
}

/** 读上一次拼好的快照(「上次发出去的是什么」) */
export function readLastPrompt(projectId) {
    return composer.load(scopeOf({ id: projectId }));
}

export default { buildPrompt, buildContextParts, buildUserTurn, collectSources, readLastPrompt, composer };
