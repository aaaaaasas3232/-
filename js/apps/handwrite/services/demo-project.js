/**
 * 手书 · 一键示例
 *
 * ── 为什么要有它 ──────────────────────────────────────────────────
 *
 * 「文字手书」这个东西光看文字说明是想象不出来的。
 * 空作品列表 + 一个「新建」按钮,用户点进去面对一条空时间轴,
 * 大概率会直接退出去 —— 他还没见过成品长什么样。
 *
 * 所以首页的空状态给的是「先看一个示例」而不是「新建企划」:
 * 一秒钟生成一份能立刻播放的完整企划,播完再决定要不要自己做。
 *
 * ★ 示例脚本里**故意**用上了用户原话里的那个写法
 *   (`我（出现再删除 10s：我喜欢）…不是我什么都没说`,时长收短到 2.4s),
 *   因为那正是这个 App 存在的理由。
 */

import { parseScript } from './script-parser.js';
import { normalizeProject } from './db.js';
import { makeId } from '../utils.js';

/** 示例脚本正文 —— 同时是「语法长什么样」的活文档 */
export const DEMO_SCRIPT = `# 这是一份示例脚本。每一行都可以改,改完点「重新映射」就能看到效果。
【背景:暮】

【渐显】
【打字 1.4s】凌晨一点

【停顿】1.2s
【清空】

【打字】我（出现再删除 2.4s：我喜欢）…不是我什么都没说
【停顿】1.6s

【抖动】
【替换】不是我什么都没说→我说了

【停顿】1.2s
【删除】3
【打字】只是你没听见

【停顿 2s】
【清空】

【背景:渊】
【逐字弹入】
【打字】那就这样吧

【停顿】1.4s
【渐隐】
【打字】。`;

/**
 * 造一份示例企划。
 *
 * @param {object} [opts]
 * @param {string} [opts.author] 作者名(从 nook 现读,不写死)
 */
export function createDemoProject(opts = {}) {
    const parsed = parseScript(DEMO_SCRIPT, { idPrefix: `demo-${Date.now().toString(36)}` });

    return normalizeProject({
        id: makeId('proj'),
        title: '凌晨一点没说出口的话',
        description: '一支两分钟不到的手书。全片只有字在出现和消失 —— 打出「我喜欢」,停两秒,再一个一个删掉。\n\n这份是示例企划,可以直接改:点右上角「编辑」进时间轴,或者在「脚本」页里改文字。',
        author: String(opts.author || ''),
        cover: { backdrop: 'dusk', headline: '我喜欢' },
        clips: parsed.clips,
        stage: {
            backdrop: 'dusk',
            aspect: '16:9',
            position: 'center',
            align: 'center',
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: 3,
            lineHeight: 1.6,
            caret: true,
        },
        script: DEMO_SCRIPT,
        brief: '深夜、没说出口的喜欢、说了又收回去',
        plays: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    });
}

/**
 * 新建空企划时给的起手脚本。
 *
 * 不给空白 —— 面对空编辑器的挫败感比看到三行不合心意的字大得多。
 */
export const STARTER_SCRIPT = `【背景:墨】
【渐显】
【打字】在这里写第一句
【停顿】1.2s
【清空】
【打字】然后（出现再删除 1.5s：写一句真心话）再删掉它`;

export function createStarterProject(opts = {}) {
    const parsed = parseScript(STARTER_SCRIPT, { idPrefix: `new-${Date.now().toString(36)}` });
    return normalizeProject({
        id: makeId('proj'),
        title: String(opts.title || '未命名手书').slice(0, 40),
        description: '',
        author: String(opts.author || ''),
        cover: { backdrop: 'ink', headline: '' },
        clips: parsed.clips,
        script: STARTER_SCRIPT,
        brief: String(opts.brief || ''),
        createdAt: Date.now(),
        updatedAt: Date.now(),
    });
}

export default { createDemoProject, createStarterProject, DEMO_SCRIPT, STARTER_SCRIPT };
