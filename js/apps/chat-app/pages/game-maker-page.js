/**
 * chat-app / 做一个新游戏
 *
 * 仿「App 制作」那套流程，做成三步：
 *
 *   ① 说清楚要做什么   —— 一张表单，问名字 / 人数 / 流程类型 / 胜负判定…
 *   ② 拿提示词去问 AI  —— 按表单生成一份很细的提示词，复制走
 *   ③ 上传回来          —— 把 AI 写的 .js 传上来，装好之后**每个群**都能开这一局
 *
 * ── 为什么不做成「一键生成」──────────────────────────────────────
 *
 * 玩法逻辑比 App 白膜复杂得多：状态机、AI 决策、异常兜底、断点续跑。
 * 让模型一次性写对的概率不高，而且写错了也很难自动发现。所以这里的产物是
 * **提示词**，让用户拿到自己惯用的模型里去写、去改、去重试 ——
 * 上传时再做静态体检（见 games/custom-games.js），把最容易犯的四个错拦下来。
 *
 * 草稿存在模块级变量里，用户切出去再回来还在（跟 game-setup-page 一个路子）。
 */

import { escapeHtml } from '@/src/core/escape.js';
import { act } from '../games/components/ui.js';
import {
    createDefaultGameAnswers, buildGamePrompt, slugifyGameId,
    GAME_FLOW_PRESETS, GAME_WIN_PRESETS, listCustomGames,
} from '../games/index.js';

const TONES = [
    { id: 'blue', label: '蓝' },
    { id: 'pink', label: '粉' },
    { id: 'slate', label: '灰' },
    { id: 'violet', label: '紫' },
    { id: 'amber', label: '琥珀' },
];

/** 草稿。切出页面再回来不丢。 */
let draft = createDefaultGameAnswers();
/** 当前在第几步（0/1/2） */
let step = 0;

export function getMakerDraft() { return draft; }
export function getMakerStep() { return step; }

export function updateMakerDraft(patch = {}) {
    draft = { ...draft, ...patch };
    // 名字改了、id 还没被手动改过 → 跟着推一个
    if (patch.name !== undefined && !draft.__idTouched) {
        draft.gameId = slugifyGameId(draft.name);
    }
    if (patch.gameId !== undefined) draft.__idTouched = true;
    return draft;
}

export function setMakerStep(n) {
    step = Math.max(0, Math.min(2, Number(n) || 0));
}

export function resetMakerDraft() {
    draft = createDefaultGameAnswers();
    step = 0;
}

export function buildDraftPrompt() {
    return buildGamePrompt(draft);
}

// ---------------------------------------------------------------------------
// 渲染
// ---------------------------------------------------------------------------

function field(label, hint, body) {
    return `
        <div class="cgm-field">
            <div class="cgm-field__label">${escapeHtml(label)}</div>
            ${hint ? `<div class="cgm-field__hint">${escapeHtml(hint)}</div>` : ''}
            <div class="cgm-field__body">${body}</div>
        </div>
    `;
}

function textInput(key, value, placeholder = '', maxlength = 40) {
    return `<input type="text" class="cgm-input" data-cgm-field="${key}"
                   value="${escapeHtml(value || '')}" placeholder="${escapeHtml(placeholder)}"
                   maxlength="${maxlength}" spellcheck="false" />`;
}

function textArea(key, value, placeholder = '', rows = 3) {
    return `<textarea class="cgm-textarea" data-cgm-field="${key}" rows="${rows}"
                      placeholder="${escapeHtml(placeholder)}" spellcheck="false">${escapeHtml(value || '')}</textarea>`;
}

function options(key, list, current, cols = 2) {
    return `
        <div class="cgm-options" data-cols="${cols}">
            ${list.map((o) => `
                <button type="button" class="cgm-option${String(current) === String(o.id) ? ' is-on' : ''}"
                        ${act('setGameMakerField', { field: key, value: o.id })}>
                    <span class="cgm-option__name">${escapeHtml(o.name || o.label)}</span>
                    ${o.desc ? `<span class="cgm-option__desc">${escapeHtml(o.desc)}</span>` : ''}
                </button>
            `).join('')}
        </div>
    `;
}

function toggle(key, value, label, desc = '') {
    return `
        <button type="button" class="cgm-toggle${value ? ' is-on' : ''}"
                ${act('setGameMakerField', { field: key, value: !value })}>
            <span class="cgm-toggle__copy">
                <span class="cgm-toggle__label">${escapeHtml(label)}</span>
                ${desc ? `<span class="cgm-toggle__desc">${escapeHtml(desc)}</span>` : ''}
            </span>
            <span class="cgm-toggle__track"><span class="cgm-toggle__knob"></span></span>
        </button>
    `;
}

function stepBasic(d) {
    return `
        ${field('叫什么名字', '', textInput('name', d.name, '比如：谁在说谎'))}
        ${field('id', '英文小写，装进系统用。不改也行，会按名字推一个。',
            textInput('gameId', d.gameId || slugifyGameId(d.name), 'my-game', 24))}
        ${field('一句话介绍', '会显示在游戏大厅的卡片上', textInput('desc', d.desc, '比如：每轮说一句话，投票淘汰一个人', 30))}
        ${field('几个人玩', '含你自己。人数不够时开局会被拦下。', `
            <div class="cgm-range">
                <label>最少 <input type="number" class="cgm-num" data-cgm-field="minPlayers" value="${d.minPlayers}" min="2" max="12" /></label>
                <label>最多 <input type="number" class="cgm-num" data-cgm-field="maxPlayers" value="${d.maxPlayers}" min="2" max="12" /></label>
            </div>
        `)}
        ${field('配色', '', options('tone', TONES, d.tone, 5))}
    `;
}

function stepRules(d) {
    return `
        ${field('流程长什么样', '这一项决定了整个状态机的骨架，选最接近的。',
            options('flow', GAME_FLOW_PRESETS, d.flow, 1))}
        ${field('怎么算赢', '', options('winRule', GAME_WIN_PRESETS, d.winRule, 2))}
        ${field('有身份牌吗', '', toggle('hasRoles', d.hasRoles, '有不同身份', '像狼人杀那样每人拿一张牌'))}
        ${d.hasRoles ? field('都有哪些身份', '写清楚每个身份能做什么，AI 才写得出对应的行动步骤。',
            textArea('roles', d.roles, '比如：说谎者（每轮必须说一句假话）、观察者（可以查看一个人上轮是否说谎）、普通人')) : ''}
        ${field('我参不参与', '', toggle('userPlays', d.userPlays, '我也是一个玩家', '关掉就是上帝视角，只看 AI 之间玩'))}
        ${field('AI 要说话吗', '', toggle('aiSpeaks', d.aiSpeaks, 'AI 按人设发言', '关掉的话 AI 只做选择，不生成台词，省 token'))}
        ${field('要我打字吗', '', toggle('needsInput', d.needsInput, '有需要我输入文字的环节', '关掉就全程点按钮'))}
        ${field('大概几轮结束', '', `<input type="number" class="cgm-num" data-cgm-field="rounds" value="${d.rounds}" min="1" max="20" />`)}
        ${field('还有什么特别的规则', '想到什么写什么，会原样放进提示词。',
            textArea('extraRules', d.extraRules, '比如：每轮结束抽一张事件卡；被淘汰的人还能投票；……', 4))}
    `;
}

function stepDeliver(d) {
    const installed = listCustomGames();
    return `
        <div class="cgm-note">
            <div class="cgm-note__title">接下来三步</div>
            <ol class="cgm-note__list">
                <li>点「复制提示词」，粘给你惯用的 AI（越强越好，这活儿不轻松）</li>
                <li>让它输出一个完整的 .js 文件，存到本地</li>
                <li>回来点「上传玩法文件」—— 装好之后<b>每个群聊</b>都能开这一局</li>
            </ol>
        </div>

        <div class="cgm-actions">
            <button type="button" class="cgm-btn cgm-btn--primary" ${act('copyGamePrompt')}>复制提示词</button>
            <button type="button" class="cgm-btn" ${act('downloadGamePrompt')}>存成 .md</button>
        </div>

        <div class="cgm-actions">
            <button type="button" class="cgm-btn cgm-btn--primary" ${act('uploadGameFile')}>上传玩法文件</button>
            <button type="button" class="cgm-btn" ${act('installSampleGame')}>先装个示例看看</button>
        </div>

        <details class="cgm-preview">
            <summary>看看提示词长什么样</summary>
            <pre class="cgm-preview__body">${escapeHtml(buildGamePrompt(d).slice(0, 2400))}…</pre>
        </details>

        ${installed.length ? `
            <div class="cgm-installed">
                <div class="cgm-installed__title">已经装好的玩法</div>
                ${installed.map((g) => `
                    <div class="cgm-installed__row">
                        <span class="cgm-installed__name">${escapeHtml(g.name || g.id)}</span>
                        <span class="cgm-installed__id">${escapeHtml(g.id)}</span>
                        <button type="button" class="cgm-btn cgm-btn--mini" ${act('removeCustomGame', { gameId: g.id })}>删除</button>
                    </div>
                `).join('')}
            </div>
        ` : ''}
    `;
}

const STEP_TITLES = ['这是个什么游戏', '规则怎么走', '拿去生成'];

/**
 * @param {object} app
 * @param {string} groupId 从哪个群进来的（返回时回到那个群的大厅）
 */
export function renderGameMakerPage(app, groupId = '') {
    const d = draft;
    const body = step === 0 ? stepBasic(d) : (step === 1 ? stepRules(d) : stepDeliver(d));

    return `
        <div class="cg-lobby cgm-page">
            <header class="cg-topbar">
                <button type="button" class="cg-topbar__back" aria-label="返回" ${act('closeDetail')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <div class="cg-topbar__copy">
                    <div class="cg-topbar__title">做一个新游戏</div>
                    <div class="cg-topbar__sub">${escapeHtml(STEP_TITLES[step])} · 第 ${step + 1}/3 步</div>
                </div>
                <div class="cg-topbar__right"></div>
            </header>

            <div class="cgm-steps">
                ${STEP_TITLES.map((t, i) => `
                    <button type="button" class="cgm-step${i === step ? ' is-on' : ''}${i < step ? ' is-done' : ''}"
                            ${act('setGameMakerStep', { step: i })} title="${escapeHtml(t)}"></button>
                `).join('')}
            </div>

            <div class="cg-lobby__body cgm-body">
                ${body}
            </div>

            <div class="cgm-foot">
                <button type="button" class="cgm-btn" ${act('setGameMakerStep', { step: step - 1 })}
                        ${step === 0 ? 'disabled' : ''}>上一步</button>
                ${step < 2
                    ? `<button type="button" class="cgm-btn cgm-btn--primary" ${act('setGameMakerStep', { step: step + 1 })}>下一步</button>`
                    : `<button type="button" class="cgm-btn" ${act('resetGameMaker')}>重新填</button>`}
            </div>
        </div>
    `;
}

export default renderGameMakerPage;
