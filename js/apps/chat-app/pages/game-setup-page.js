/**
 * chat-app / 开局设置页
 *
 * 三个游戏共用这一页，差异只在「这个游戏有哪些额外选项」那一段。
 *
 * ★ 原型给三个游戏各写了一整页设置（`openWerewolfSetup` / `openUndercoverSetup` /
 *   `openMonopolySetup`），三份加起来八百多行，而其中「选谁参战」「选 API」
 *   「玩家还是上帝」这三块是逐字重复的 —— 改一次要改三处，
 *   于是三处的 AI 勾选上限判断各不相同（一个限 max，一个不限，一个限错了）。
 *
 * 草稿状态放模块级：设置页会被框架重画（勾一个人就重画一次），
 * 状态放 DOM 上会跟着丢。**不落盘** —— 这是「正在填的一张表」，
 * 持久化之后反而会留下一个假状态（AGENTS2 §15.7）。
 */

import { escapeHtml } from '@/src/core/escape.js';
import { act } from '../games/components/ui.js';
import { listCandidates, listAvailableApis, GAME_META, GAME_IDS } from '../games/index.js';
import { CONFIGS, RULE_OPTIONS } from '../games/werewolf/rules.js';
import { WORD_TYPES, bankSize } from '../games/undercover/words.js';

/** 当前正在填的草稿。同时只可能有一份。 */
let draft = null;

export function initSetupDraft(gameId, groupId) {
    const candidates = listCandidates(groupId);
    const apis = listAvailableApis();
    if (draft && draft.gameId === gameId && draft.groupId === groupId) {
        // 已经在填了，别把用户选好的东西冲掉（框架重画会重进这里）
        draft.candidates = candidates;
        draft.apis = apis;
        return draft;
    }
    const meta = GAME_META[gameId] || {};
    // 默认**尽量多带人**（顶到这个游戏的人数上限为止）。
    // 第一版默认勾到「刚好够开局」，结果 5 个 AI 的群点进狼人杀默认是 4 人局 ——
    // 板子只有 1 狼 1 预言家，基本没得推。人多才好玩，想少玩自己取消勾选。
    const wanted = Math.min(candidates.length, Math.max((meta.maxPlayers || 8) - 1, 1));
    draft = {
        gameId,
        groupId,
        candidates,
        apis,
        aiIds: candidates.slice(0, wanted).map((c) => c.id),
        userPlays: true,
        apiRef: apis[0] ? { type: apis[0].type, refId: apis[0].refId } : null,
        // 各游戏的额外选项
        wordType: 'mixed',
        aiWords: false,
        rules: {},
        customPrompt: '',
    };
    return draft;
}

export function getSetupDraft() {
    return draft;
}

export function clearSetupDraft() {
    draft = null;
}

export function updateSetupDraft(patch = {}) {
    if (!draft) return null;
    Object.assign(draft, patch);
    return draft;
}

export function toggleSetupAi(aiId) {
    if (!draft) return;
    const at = draft.aiIds.indexOf(aiId);
    if (at >= 0) draft.aiIds.splice(at, 1);
    else draft.aiIds.push(aiId);
}

export function toggleSetupRule(key) {
    if (!draft) return;
    draft.rules[key] = !draft.rules[key];
}

// ---------------------------------------------------------------------------

export function renderGameSetupPage(app, gameId, groupId) {
    const d = initSetupDraft(gameId, groupId);
    const meta = GAME_META[gameId] || { name: '小游戏', minPlayers: 2, maxPlayers: 8 };
    const total = d.aiIds.length + (d.userPlays ? 1 : 0);
    const tooFew = total < meta.minPlayers;
    const tooMany = total > meta.maxPlayers;
    const noApi = !d.apis.length;

    return `
        <div class="cg-setup" data-cg-tone="${escapeHtml(meta.tone || 'blue')}">
            <header class="cg-topbar">
                <button type="button" class="cg-topbar__back" aria-label="返回" ${act('closeDetail')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <div class="cg-topbar__copy">
                    <div class="cg-topbar__title">${escapeHtml(meta.name)}</div>
                    <div class="cg-topbar__sub">${escapeHtml(meta.desc || '')}</div>
                </div>
                <div class="cg-topbar__right"></div>
            </header>

            <div class="cg-setup__body">
                ${renderModeSection(d)}
                ${renderMemberSection(d, meta, total)}
                ${renderGameOptions(d, gameId, total)}
                ${renderApiSection(d)}
                ${renderCustomPrompt(d)}
            </div>

            <div class="cg-setup__foot">
                ${noApi
                    ? `<div class="cg-setup__warn">还没有可用的 API。去「设置 → API 管理」加一个，AI 玩家才能说话。</div>`
                    : ''}
                ${tooFew ? `<div class="cg-setup__warn">还差 ${meta.minPlayers - total} 个人才能开局</div>` : ''}
                ${tooMany ? `<div class="cg-setup__warn">最多 ${meta.maxPlayers} 人，现在有 ${total} 人</div>` : ''}
                <button type="button" class="cg-btn is-block" data-tone="primary"
                        ${tooFew || tooMany || noApi ? 'disabled' : act('gameStart')}>
                    <span class="cg-btn__body"><span class="cg-btn__label">开始游戏 · ${total} 人</span></span>
                </button>
            </div>
        </div>
    `;
}

function renderModeSection(d) {
    return `
        <section class="cg-panel">
            <header class="cg-panel__head"><span class="cg-panel__title">你怎么参与</span></header>
            <div class="cg-panel__body">
                <div class="cg-choice">
                    <button type="button" class="cg-choice__item${d.userPlays ? ' is-on' : ''}"
                            ${act('gameSetupPatch', { userPlays: true })}>
                        <span class="cg-choice__t">我也玩</span>
                        <span class="cg-choice__d">你是其中一个玩家</span>
                    </button>
                    <button type="button" class="cg-choice__item${!d.userPlays ? ' is-on' : ''}"
                            ${act('gameSetupPatch', { userPlays: false })}>
                        <span class="cg-choice__t">上帝视角</span>
                        <span class="cg-choice__d">只看 AI 之间怎么打，所有底牌可见</span>
                    </button>
                </div>
            </div>
        </section>
    `;
}

function renderMemberSection(d, meta, total) {
    if (!d.candidates.length) {
        return `
            <section class="cg-panel">
                <header class="cg-panel__head"><span class="cg-panel__title">参战成员</span></header>
                <div class="cg-panel__body">
                    <div class="cg-empty">
                        <div class="cg-empty__text">这个群里还没有其他成员</div>
                        <div class="cg-empty__sub">先去群设置里拉几个 AI 进来</div>
                    </div>
                </div>
            </section>
        `;
    }
    const items = d.candidates.map((c) => {
        const on = d.aiIds.includes(c.id);
        return `
            <button type="button" class="cg-member${on ? ' is-on' : ''}" ${act('gameSetupToggleAi', { aiId: c.id })}>
                <span class="cg-member__av" data-hue="${hue(c.id)}">
                    ${c.avatar ? `<img src="${escapeHtml(c.avatar)}" alt="" />` : escapeHtml((c.name || '?').charAt(0))}
                </span>
                <span class="cg-member__name">${escapeHtml(c.name)}</span>
                <span class="cg-member__check" aria-hidden="true"></span>
            </button>
        `;
    }).join('');

    return `
        <section class="cg-panel">
            <header class="cg-panel__head">
                <span class="cg-panel__title">参战成员</span>
                <span class="cg-panel__hint">${total} / ${meta.minPlayers}–${meta.maxPlayers} 人</span>
            </header>
            <div class="cg-panel__body"><div class="cg-members">${items}</div></div>
        </section>
    `;
}

/** 各游戏自己的选项。这一段是三个游戏唯一真正不同的地方。 */
function renderGameOptions(d, gameId, total) {
    if (gameId === GAME_IDS.WEREWOLF) {
        const config = CONFIGS[total];
        const rules = RULE_OPTIONS.map((r) => `
            <button type="button" class="cg-switch${d.rules[r.key] ? ' is-on' : ''}" ${act('gameSetupToggleRule', { key: r.key })}>
                <span class="cg-switch__main">
                    <span class="cg-switch__t">${escapeHtml(r.label)}</span>
                    <span class="cg-switch__d">${escapeHtml(r.desc)}</span>
                </span>
                <span class="cg-switch__knob" aria-hidden="true"></span>
            </button>
        `).join('');
        return `
            <section class="cg-panel">
                <header class="cg-panel__head">
                    <span class="cg-panel__title">板子</span>
                    <span class="cg-panel__hint">按人数自动匹配</span>
                </header>
                <div class="cg-panel__body">
                    ${config
                        ? `<div class="cg-configcard">
                                <div class="cg-configcard__name">${escapeHtml(config.name)}</div>
                                <div class="cg-configcard__desc">${escapeHtml(config.desc)}</div>
                                <div class="cg-configcard__roles">${config.roles.map((r) => `<span>${escapeHtml(roleLabel(r))}</span>`).join('')}</div>
                           </div>`
                        : `<div class="cg-empty"><div class="cg-empty__text">这个人数还没有对应的板子</div></div>`}
                    <div class="cg-rules">${rules}</div>
                </div>
            </section>
        `;
    }

    if (gameId === GAME_IDS.UNDERCOVER) {
        const types = WORD_TYPES.map((t) => `
            <button type="button" class="cg-tag${d.wordType === t.key ? ' is-on' : ''}" ${act('gameSetupPatch', { wordType: t.key })}>
                ${escapeHtml(t.label)}
            </button>
        `).join('');
        return `
            <section class="cg-panel">
                <header class="cg-panel__head">
                    <span class="cg-panel__title">词库</span>
                    <span class="cg-panel__hint">本地 ${bankSize()} 对</span>
                </header>
                <div class="cg-panel__body">
                    <div class="cg-tags">${types}</div>
                    <button type="button" class="cg-switch${d.aiWords ? ' is-on' : ''}" ${act('gameSetupPatch', { aiWords: !d.aiWords })}>
                        <span class="cg-switch__main">
                            <span class="cg-switch__t">让 AI 现出题</span>
                            <span class="cg-switch__d">更新鲜，但开局要多等一下；出题失败会自动用本地词库</span>
                        </span>
                        <span class="cg-switch__knob" aria-hidden="true"></span>
                    </button>
                </div>
            </section>
        `;
    }

    if (gameId === GAME_IDS.MONOPOLY) {
        return `
            <section class="cg-panel">
                <header class="cg-panel__head"><span class="cg-panel__title">玩法</span></header>
                <div class="cg-panel__body">
                    <div class="cg-configcard">
                        <div class="cg-configcard__name">20 格环形棋盘</div>
                        <div class="cg-configcard__desc">起始 15,000 · 经过起点领 2,000 · 最多 24 轮，到时按净资产排名</div>
                        <div class="cg-configcard__roles"><span>买地</span><span>收租</span><span>盖房</span><span>机会命运</span><span>监狱</span><span>破产</span></div>
                    </div>
                </div>
            </section>
        `;
    }
    return '';
}

function renderApiSection(d) {
    if (!d.apis.length) return '';
    const items = d.apis.map((a) => {
        const on = d.apiRef && d.apiRef.type === a.type && d.apiRef.refId === a.refId;
        return `
            <button type="button" class="cg-tag${on ? ' is-on' : ''}"
                    ${act('gameSetupPatch', { apiRef: { type: a.type, refId: a.refId } })}>
                ${escapeHtml(a.label)}
            </button>
        `;
    }).join('');
    return `
        <section class="cg-panel">
            <header class="cg-panel__head">
                <span class="cg-panel__title">这一局用哪个 API</span>
                <span class="cg-panel__hint">整局固定，中途不会换</span>
            </header>
            <div class="cg-panel__body"><div class="cg-tags">${items}</div></div>
        </section>
    `;
}

function renderCustomPrompt(d) {
    return `
        <section class="cg-panel">
            <header class="cg-panel__head">
                <span class="cg-panel__title">给 AI 的额外交代（可以不填）</span>
            </header>
            <div class="cg-panel__body">
                <textarea class="cg-input" data-cg-setup-prompt="1" rows="2" maxlength="200"
                          placeholder="比如：大家都是熟人，可以互相开玩笑">${escapeHtml(d.customPrompt || '')}</textarea>
            </div>
        </section>
    `;
}

function roleLabel(id) {
    return { wolf: '狼人', villager: '村民', seer: '预言家', witch: '女巫', hunter: '猎人', guard: '守卫', cupid: '丘比特' }[id] || id;
}

function hue(seed) {
    const s = String(seed || '');
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
    return h % 12;
}

export default renderGameSetupPage;
