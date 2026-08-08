/**
 * Settings App · 人设 (Persona) UI 渲染器
 *
 *   共享给 AI / User 两个 section：
 *     - 按 AI_PERSONA_GROUPS / USER_PERSONA_GROUPS 分组渲染（base + 7+1 模块）
 *     - 每个模块可折叠（enabled 开关 + 点击标题展开）
 *     - 模块内字段直接按 schema.fields 渲染（input / textarea / select）
 *     - 阶段、parO 单独 section
 *
 * 约定：
 *   - 渲染函数全部返回字符串（被 v-html 吃），所有动态值都用 escapeHtml
 *   - 字段类型：
 *       text         单行 / 多行 input 或 textarea
 *       listField    多行 textarea（每行一条）→ 数组
 *       number       number input
 *       select       <select>（options 在 schema）
 *       tags / refs  显示已选项 + textarea 待接入更复杂 UI（先用 textarea 占位）
 *       json         textarea（每行一条，自由格式）
 *   - 所有 input 都带 data-persona-field="${entityType}|${groupKey}|${fieldKey}"，
 *     由 main.js 的 handleEditorInput 统一监听，统一保存。
 *   - 顶部「保存」按钮 + 模式切换按钮（simple / detailed）放在外层。
 *
 * UI 风格：
 *   - iOS Settings：白底卡片 + 圆角 10px + 细边 + 蓝色 #0A84FF
 *   - 模块默认 disabled 灰显 + 折叠
 *   - 不引入 emoji、不引入渐变色
 *   - 阶段 / parO 用「卡片网格」+ 「添加」按钮
 */

import { escapeHtml } from '@/src/core/escape.js';
import { renderGroup, renderRow, renderSwitch } from '../ui-components.js';
import { T } from '../tokens.js';
import {
    getPersonaGroups,
    VISIBILITY,
    parseFieldValue,
    MBTI_OPTIONS,
} from '../world/sdk/profile-schema.js';
import { renderResourcesSectionSync } from './resources-section.js';

/**
 * 是否应该在本模式下渲染某个 group。
 *   - simple: 只保留 alwaysOn (base)
 *   - detailed: 全部保留
 */
function isGroupVisibleInMode(group, profileLevel) {
    if (profileLevel !== 'simple') return true;
    return !!group.alwaysOn;
}

/**
 * 是否应该在本模式下渲染某个字段。
 *   - simple:  只保留 required + optional（隐藏 advanced）
 *   - detailed: 全部保留
 */
function isFieldVisibleInMode(field, profileLevel) {
    if (profileLevel !== 'simple') return true;
    return field.visibility !== VISIBILITY.ADVANCED;
}

const APP_ID = 'settings';

// ============================================
// helpers
// ============================================

/**
 * 把任意值变成 textarea 字符串（数组按行 join，对象 JSON.stringify）。
 */
function toTextareaString(value, field) {
    if (value == null) return '';
    if (Array.isArray(value)) return value.join('\n');
    if (typeof value === 'object') {
        try { return JSON.stringify(value, null, 0).replace(/[{}"]/g, ''); } catch { return ''; }
    }
    return String(value);
}

/**
 * 按字段类型获得显示字符串（用于 input.value）。
 */
function fieldDisplayValue(field, raw) {
    if (raw == null || raw === '') return '';
    if (field.type === 'number') return String(raw);
    if (Array.isArray(raw)) return raw.join('\n');
    return String(raw);
}

/**
 * 从 persona 上安全地读字段值。
 * 对于模块字段（如 memory.text），会从 persona[moduleKey][fieldKey] 读取。
 */
function readField(persona, fieldKey, groupKey) {
    if (!persona) return null;
    // 如果 groupKey 存在且是一个模块，则从嵌套对象读取
    if (groupKey && groupKey !== 'meta' && persona[groupKey] && typeof persona[groupKey] === 'object') {
        return persona[groupKey][fieldKey];
    }
    return persona[fieldKey];
}

/**
 * 是否启用模块。读 persona[moduleKey].enabled；缺省视为 false。
 */
function moduleEnabled(persona, moduleKey) {
    const mod = persona?.[moduleKey];
    return !!(mod && typeof mod === 'object' && mod.enabled === true);
}

// ============================================
// 渲染：单个字段
// ============================================

/**
 * 计算一个字段在 persona 对象里的存储路径。
 *   - 'base' / 'meta' group: 字段直接放在 persona 顶层（不是嵌套对象），
 *     data-persona-field 写成 `entityType|fieldKey`（省略中间 groupKey），
 *     这样 collectFieldsFromDom 写回时就是 patch[fieldKey]，能正确落库。
 *   - 其他模块组(preferences / memory / mbti / ...): 字段在 persona[groupKey] 嵌套里,
 *     data-persona-field 写成 `entityType|groupKey|fieldKey`。
 */
function personaFieldPath(entityType, groupKey, fieldKey) {
    if (groupKey === 'base' || groupKey === 'meta') {
        return `${escapeHtml(entityType)}|${escapeHtml(fieldKey)}`;
    }
    return `${escapeHtml(entityType)}|${escapeHtml(groupKey)}|${escapeHtml(fieldKey)}`;
}

/**
 * 单行 input。
 *   data-persona-field = entityType|group|key
 */
function renderTextField(field, value, ctx) {
    const { entityType, groupKey } = ctx;
    const isMultiline = field.multiline || (field.rows && field.rows > 1);
    const isList = !!field.listField;
    const displayValue = isList
        ? toTextareaString(value, field)
        : fieldDisplayValue(field, value);

    const tag = isMultiline ? 'textarea' : 'input';
    const tagAttrs = isMultiline
        ? ` rows="${escapeHtml(field.rows || 3)}"`
        : ` type="${field.type === 'number' ? 'number' : 'text'}" value="${escapeHtml(displayValue)}"`;

    const innerHtml = isMultiline
        ? escapeHtml(displayValue)
        : '';

    const dataAttr = `data-persona-field="${personaFieldPath(entityType, groupKey, field.key)}"`;

    const helperHtml = field.helper
        ? `<div class="settings-section__helper">${escapeHtml(field.helper)}</div>`
        : '';

    return `
        <div class="settings-section__field">
            <label class="settings-section__label">
                ${escapeHtml(field.label || field.key)}
                ${field.visibility === VISIBILITY.REQUIRED ? '<span class="settings-section__required">*</span>' : ''}
            </label>
            <${tag} class="settings-section__input" name="${escapeHtml(field.key)}" ${dataAttr}${tagAttrs}
                placeholder="${escapeHtml(field.placeholder || '')}">${innerHtml}</${tag}>
            ${helperHtml}
        </div>
    `;
}

/**
 * select 字段。
 */
function renderSelectField(field, value, ctx) {
    const { entityType, groupKey } = ctx;
    const str = value == null ? '' : String(value);
    const options = field.options || [];
    const dataAttr = `data-persona-field="${personaFieldPath(entityType, groupKey, field.key)}"`;
    const helperHtml = field.helper
        ? `<div class="settings-section__helper">${escapeHtml(field.helper)}</div>`
        : '';
    return `
        <div class="settings-section__field">
            <label class="settings-section__label">${escapeHtml(field.label || field.key)}</label>
            <select class="settings-section__select" ${dataAttr}>
                ${options.map(opt => `
                    <option value="${escapeHtml(String(opt.value))}" ${String(opt.value) === str ? 'selected' : ''}>
                        ${escapeHtml(opt.label)}
                    </option>
                `).join('')}
            </select>
            ${helperHtml}
        </div>
    `;
}

/**
 * MBTI 字段：select 选择类型 + description textarea 简介。
 */
function renderMbtiField(field, value, ctx) {
    const { entityType, groupKey } = ctx;
    const str = value == null ? '' : String(value);
    const dataAttr = `data-persona-field="${personaFieldPath(entityType, groupKey, field.key)}"`;
    const helperHtml = field.helper
        ? `<div class="settings-section__helper">${escapeHtml(field.helper)}</div>`
        : '';
    return `
        <div class="settings-section__field">
            <label class="settings-section__label">${escapeHtml(field.label || field.key)}</label>
            <select class="settings-section__select" ${dataAttr}>
                <option value="">— 选择 MBTI —</option>
                ${MBTI_OPTIONS.map(opt => `
                    <option value="${escapeHtml(opt)}" ${opt === str ? 'selected' : ''}>
                        ${escapeHtml(opt)}
                    </option>
                `).join('')}
            </select>
            ${helperHtml}
        </div>
    `;
}

/**
 * 字段分发器。
 */
function renderField(field, value, ctx) {
    if (field.type === 'select') return renderSelectField(field, value, ctx);
    if (field.type === 'mbti') return renderMbtiField(field, value, ctx);
    return renderTextField(field, value, ctx);
}

// ============================================
// 渲染：开关行（启用模块 / 注入 prompt）
// ============================================

function wvAction(method, payload = {}) {
    const obj = { action: 'appMethod', appId: APP_ID, method, payload };
    return `data-app-action='${escapeHtml(JSON.stringify(obj))}'`;
}

/**
 * 渲染 head 上的「启用 / 关闭」开关。
 * 直接用 renderSwitch（同一个 .settings-switch / .settings-switch__knob 结构），
 * 不用 button 嵌套 button，避免任何潜在的 HTML parser foster-parenting 问题。
 */
function renderHeadToggle(toggleAction, enabled) {
    return `<button type="button" class="settings-switch ${enabled ? 'is-on' : ''}" ${toggleAction} role="switch" aria-checked="${enabled ? 'true' : 'false'}"><span class="settings-switch__knob"></span></button>`;
}

/**
 * 一个「启用 / 注入」开关行。
 */
function renderToggleRow(label, on, onChangeAction) {
    return `
        <button class="settings-section__toggle" role="switch" aria-checked="${on ? 'true' : 'false'}" ${onChangeAction}>
            <span class="settings-section__toggle-label">${escapeHtml(label)}</span>
            <span class="settings-switch ${on ? 'is-on' : ''}"><span class="settings-switch__knob"></span></span>
        </button>
    `;
}

// ============================================
// 渲染：单个人设分组（base / preferences / habits / ...）
// ============================================

/**
 * @param {object} group     一项 AI_PERSONA_GROUPS / USER_PERSONA_GROUPS
 * @param {object} persona   当前编辑对象
 * @param {string} entityType 'ai' | 'user'
 * @param {'simple'|'detailed'} profileLevel
 * @returns string
 */
export function renderPersonaGroup(group, persona, entityType, profileLevel = 'detailed') {
    if (!isGroupVisibleInMode(group, profileLevel)) return '';
    const isBase = !!group.alwaysOn;
    const enabled = isBase || moduleEnabled(persona, group.key);
    if (!isBase) {
        console.debug('[renderPersonaGroup]', group.key, 'enabled=', enabled,
            'personaHasModule=', !!persona?.[group.key],
            'moduleValue=', persona?.[group.key]);
    }
    const visibleFields = group.fields.filter(f => isFieldVisibleInMode(f, profileLevel));
    const fieldsHtml = visibleFields.map(field =>
        renderField(field, readField(persona, field.key), { entityType, groupKey: group.key })
    ).join('');

    // 顶部 toggle 行：始终可点
    // ★ 不传 enabled，让后端基于当前持久化值自动取反（更鲁棒，避免 refresh 漏跑导致前后端状态错位）
    const toggleAction = isBase
        ? ''
        : wvAction('personaToggleModule', { entityType, moduleKey: group.key });

    const meta = isBase
        ? `${visibleFields.length} 个核心字段`
        : (enabled ? '已启用' : '未启用');

    const headerHtml = `
        <div class="settings-section__head">
            <div class="settings-section__head-text">
                <div class="settings-section__head-title">${escapeHtml(group.title)}</div>
                ${group.subtitle ? `<div class="settings-section__head-sub">${escapeHtml(group.subtitle)}</div>` : ''}
            </div>
            <div class="settings-section__head-meta">
                <span class="settings-section__head-meta-text">${escapeHtml(meta)}</span>
                ${isBase ? '' : toggleAction ? renderHeadToggle(toggleAction, enabled) : ''}
            </div>
        </div>
    `;

    const bodyHtml = enabled ? `<div class="settings-section__body">${fieldsHtml}</div>` :
        `<div class="settings-section__body settings-section__body--off">
            <div class="settings-section__off-hint">此模块未启用。点击右上角开关启用后即可编辑。</div>
        </div>`;

    return `<section class="settings-section ${isBase ? 'is-base' : ''} ${enabled ? 'is-on' : 'is-off'}">${headerHtml}${bodyHtml}</section>`;
}

function phaseMetaBadge(persona) {
    if (persona.variantType !== 'lifePhase') return '';
    const meta = persona.phaseMeta || {};
    const age = (meta.age ?? persona.age);
    const parts = [meta.name, (age != null && age !== '') ? `${age} 岁` : ''].filter(Boolean);
    const chipText = parts.join(' · ');
    return chipText ? `<span class="persona-variant-banner__phase">${escapeHtml(chipText)}</span>` : '';
}

// ============================================
// 渲染：人生阶段
// ============================================

function getVariantCards(persona, entityType, variantType) {
    const sdk = window.settingsSdk;
    if (!sdk?.persona?.variants || !persona?.id) return [];
    return sdk.persona.variants.list(entityType, persona.id, variantType);
}

function renderVariantCard(card, source, entityType, variantType, app) {
    const sdk = window.settingsSdk;
    const isPhase = variantType === 'lifePhase';
    const initial = (card.name || card.id || '?').trim().charAt(0).toUpperCase();
    const phase = card.phaseMeta || {};
    const age = (phase.age ?? card.age);
    const phaseLabel = isPhase && phase.name ? phase.name : '';
    const phaseAge = isPhase && (age != null && age !== '') ? `${age} 岁` : '';
    const worldName = card.boundWorldId
        ? (sdk?.worlds?.get(card.boundWorldId)?.name || card.boundWorldId)
        : '自由模式';
    const meta = isPhase && (phaseLabel || phaseAge)
        ? `${escapeHtml([phaseLabel, phaseAge].filter(Boolean).join(' · '))}`
        : escapeHtml(worldName);
    const isActive = (sdk?.[entityType === 'user' ? 'users' : 'aiPersons']?.getActive?.()?.id === card.id);

    // 与日程卡片一致：点击空白 → 进入「按下」态（浮出操作按钮）；再点或点外面 → 收起
    // variantPressed = `<variantType>::<cardId>` 表示当前按下的是哪一张
    const variantKey = `${variantType}::${card.id}`;
    const pressed = app?.state?.personaHome?.variantPressed;
    const isPressed = pressed === variantKey;

    return `
        <div class="persona-card persona-variant-card persona-variant-card--${isPhase ? 'phase' : 'paro'} ${isActive ? 'is-active' : ''} ${isPressed ? 'is-pressed' : ''}" data-variant-edit-id="${escapeHtml(variantKey)}">
            <div class="persona-card__main persona-variant-card__main">
                <div class="persona-card__head">
                    <div class="persona-card__avatar">${escapeHtml(initial)}</div>
                    <div class="persona-card__name">${escapeHtml(card.name || card.id)}</div>
                </div>
                <div class="persona-card__meta">${meta}</div>
            </div>
            <div class="persona-card__actions persona-variant-card__actions">
                <button class="persona-btn persona-btn--small" data-variant-action="open" data-variant-id="${escapeHtml(card.id)}" data-variant-type="${escapeHtml(variantType)}" data-variant-entity="${escapeHtml(entityType)}" aria-label="打开">打开</button>
                <button class="persona-btn persona-btn--small persona-btn--ghost" data-variant-action="ai" data-variant-id="${escapeHtml(card.id)}" data-variant-type="${escapeHtml(variantType)}" data-variant-entity="${escapeHtml(entityType)}" aria-label="AI 生成">AI 生成</button>
                <button class="persona-btn persona-btn--small persona-btn--danger" data-variant-action="remove" data-variant-id="${escapeHtml(card.id)}" data-variant-type="${escapeHtml(variantType)}" data-variant-entity="${escapeHtml(entityType)}" aria-label="删除">删除</button>
            </div>
        </div>`;
}

function renderPhasesSection(persona, entityType, app) {
    const phases = getVariantCards(persona, entityType, 'lifePhase');
    return `
        <section class="settings-section is-on">
            <div class="settings-section__head">
                <div class="settings-section__head-text">
                    <div class="settings-section__head-title">人生阶段</div>
                    <div class="settings-section__head-sub">${phases.length} 张独立阶段卡 · 保留当前世界观</div>
                </div>
                <div class="settings-section__head-meta">
                    <button class="persona-btn persona-btn--small persona-btn--ghost" ${wvAction('personaAddPhase', { entityType })}>+ 新阶段</button>
                </div>
            </div>
            ${phases.length ? `<div class="settings-section__body"><div class="persona-variant-grid">${phases.map(card => renderVariantCard(card, persona, entityType, 'lifePhase', app)).join('')}</div></div>` : `
                <div class="settings-section__body settings-section__body--off">
                    <div class="settings-section__off-hint">还没有阶段卡。创建后会复制当前卡的设定，并作为用户库或 AI 库里的独立角色存在。</div>
                </div>`}
        </section>`;
}

// ============================================
// 渲染：parO 平行卡
// ============================================

function renderParoSection(persona, entityType, app) {
    const cards = getVariantCards(persona, entityType, 'paro');
    return `
        <section class="settings-section is-on">
            <div class="settings-section__head">
                <div class="settings-section__head-text">
                    <div class="settings-section__head-title">parO 平行卡</div>
                    <div class="settings-section__head-sub">${cards.length} 张独立平行卡 · 默认解除世界观绑定</div>
                </div>
                <div class="settings-section__head-meta">
                    <button class="persona-btn persona-btn--small persona-btn--ghost" ${wvAction('personaCloneParO', { entityType })}>+ 复制 parO</button>
                </div>
            </div>
            ${cards.length ? `<div class="settings-section__body"><div class="persona-variant-grid">${cards.map(card => renderVariantCard(card, persona, entityType, 'paro', app)).join('')}</div></div>` : `
                <div class="settings-section__body settings-section__body--off">
                    <div class="settings-section__off-hint">还没有平行卡。复制后会得到一张独立角色卡，可保持自由模式或重新绑定其他世界观。</div>
                </div>`}
        </section>`;
}

// ============================================
// 渲染：圈子（与世界观下其他人设的关系 / 我视角下的认知）
// ============================================

/**
 * 圈子 section。
 *
 *  形态：
 *    - 顶部：标题 + 副标题 + 「+ 从世界观拉取」按钮
 *    - 主体：已绑定成员卡片（按添加时间排序）
 *    - 当处于「拉取面板」态：隐藏已绑定列表，显示「当前世界观下其他人设」可选项
 *
 *  数据：
 *    persona.circle = { members: [{ id, kind: 'user'|'ai', refId, name, note, addedAt }] }
 *    - `kind` 标识引用源类型（users / aiPersons）
 *    - `refId` 是对应实体 id
 *    - `name` 冗余存储快照（方便原引用被删后仍能展示）
 *    - `note` 是「我视角下的认知」（例如：「我家的狗，乖萌可爱」）
 *
 *  仅 detailed 模式显示。
 */
function renderCircleSection(persona, entityType, app) {
    const sdk = window.settingsSdk;
    const members = Array.isArray(persona?.circle?.members) ? persona.circle.members : [];
    const boundWorldId = persona?.boundWorldId || '';
    // picker 标志只在 app.state.personaHome 上，不写回持久化
    const isPicking = !!(app?.state?.personaHome?.circlePickerOpen);

    // 拉取面板：拉取当前世界观下其他人设
    const pickPanel = isPicking
        ? renderCirclePickerPanel(persona, entityType, boundWorldId)
        : '';

    const list = members.length === 0
        ? `<div class="settings-section__body settings-section__body--off">
            <div class="settings-section__off-hint">圈子还是空的。点击「去拉取」可从当前世界观下挑几位人设进来，并写下你对他们各自的认知。</div>
           </div>`
        : `<div class="settings-section__body">
            <div class="persona-circle-grid">
                ${members.map(m => renderCircleMemberCard(m, entityType, sdk)).join('')}
            </div>
           </div>`;

    const headMeta = boundWorldId
        ? `<span class="settings-section__head-meta-text">${members.length} 位 · 世界观绑定中</span>`
        : `<span class="settings-section__head-meta-text">未绑定世界观</span>`;

    return `
        <section class="settings-section is-on">
            <div class="settings-section__head">
                <div class="settings-section__head-text">
                    <div class="settings-section__head-title">圈子</div>
                    <div class="settings-section__head-sub">从世界观里拉取其他人设，写下你视角下的认知</div>
                </div>
                <div class="settings-section__head-meta">
                    ${headMeta}
                    ${boundWorldId
                        ? (isPicking
                            ? `<button class="persona-btn persona-btn--small persona-btn--ghost" ${wvAction('personaCircleClosePicker', { entityType })}>收起</button>`
                            : `<button class="persona-btn persona-btn--small persona-btn--ghost" ${wvAction('personaCircleOpenPicker', { entityType })}>+ 从世界观拉取</button>`)
                        : ''
                    }
                </div>
            </div>
            ${boundWorldId ? (isPicking ? pickPanel : list) : `
                <div class="settings-section__body settings-section__body--off">
                    <div class="settings-section__off-hint">需要先绑定一个世界观，才能从这个世界观下拉取其他人设。</div>
                    <div style="margin-top:8px;">
                        <button class="persona-btn persona-btn--small persona-btn--ghost" ${wvAction('personaOpenWorldBinding', { entityType })}>去绑定世界观</button>
                    </div>
                </div>
            `}
        </section>
    `;
}

function renderCircleMemberCard(member, entityType, sdk) {
    const refEntity = member.kind === 'user'
        ? sdk?.users?.get(member.refId)
        : sdk?.aiPersons?.get(member.refId);
    const name = escapeHtml(member.name || refEntity?.name || member.refId || '未命名');
    const initial = (member.name || refEntity?.name || member.refId || '?').trim().charAt(0).toUpperCase();
    const kindLabel = member.kind === 'user' ? '用户' : 'AI';
    const kindTone = member.kind === 'user' ? 'is-user' : 'is-ai';
    const note = member.note ? escapeHtml(member.note) : '';
    const empty = !member.note;
    const missing = !refEntity;
    return `
        <div class="persona-circle ${missing ? 'is-missing' : ''}">
            <div class="persona-circle__head">
                <div class="persona-circle__avatar">${escapeHtml(initial)}</div>
                <div class="persona-circle__main">
                    <div class="persona-circle__name">${name}</div>
                    <div class="persona-circle__meta">
                        <span class="persona-circle__kind ${kindTone}">${kindLabel}</span>
                        ${missing ? '<span class="persona-circle__missing">原人设已删除</span>' : ''}
                    </div>
                </div>
            </div>
            <div class="persona-circle__note ${empty ? 'is-empty' : ''}">
                ${empty ? '<span class="persona-circle__note-hint">还没写认知 · 点下方「编辑备注」</span>' : note}
            </div>
            <div class="persona-circle__actions">
                <button class="persona-btn persona-btn--small" ${wvAction('personaCircleEditNote', { entityType, memberId: member.id })}>${empty ? '写认知' : '编辑备注'}</button>
                <button class="persona-btn persona-btn--small persona-btn--ghost" ${wvAction('personaCircleRemoveMember', { entityType, memberId: member.id })}>移除</button>
            </div>
        </div>
    `;
}

/**
 * 拉取面板：列出当前世界观下「其他人设」，
 *  - 已绑定的不再出现
 *  - 没绑定世界观的提示
 *  - 选中后内置一个「备注」输入框，回车 / 点保存即加入圈子
 */
function renderCirclePickerPanel(persona, entityType, boundWorldId) {
    const sdk = window.settingsSdk;
    if (!sdk) {
        return `<div class="settings-section__body"><div class="settings-section__off-hint">SDK 未初始化</div></div>`;
    }
    const ownedMembers = new Set(
        (Array.isArray(persona?.circle?.members) ? persona.circle.members : [])
            .map(m => `${m.kind}::${m.refId}`)
    );
    const candidates = [];
    if (boundWorldId) {
        sdk.users.list().forEach(u => {
            if (u.id === persona.id) return;
            if (u.boundWorldId !== boundWorldId) return;
            candidates.push({ kind: 'user', refId: u.id, name: u.name || u.id });
        });
        sdk.aiPersons.list().forEach(a => {
            if (a.id === persona.id) return;
            if (a.boundWorldId !== boundWorldId) return;
            candidates.push({ kind: 'ai', refId: a.id, name: a.name || a.id });
        });
    }
    const available = candidates.filter(c => !ownedMembers.has(`${c.kind}::${c.refId}`));
    const world = sdk.worlds.get(boundWorldId);
    const worldName = escapeHtml(world?.name || boundWorldId);

    const composeHint = available.length === 0
        ? `<div class="settings-section__off-hint">这个世界观下还没有其他人设可拉取。先去建几位人设再说～</div>`
        : `<div class="settings-section__off-hint">选中一个人设后在下方输入「我对其的认知」，再点「加入圈子」即可。</div>`;

    const list = available.length > 0
        ? `<div class="persona-circle-picker__list">
            ${available.map(c => `
                <label class="persona-circle-picker__option">
                    <input type="radio" name="persona-circle-pick" value="${escapeHtml(c.kind)}::${escapeHtml(c.refId)}" data-circle-pick>
                    <span class="persona-circle-picker__avatar">${escapeHtml((c.name || c.refId).trim().charAt(0).toUpperCase())}</span>
                    <span class="persona-circle-picker__name">${escapeHtml(c.name)}</span>
                    <span class="persona-circle-picker__kind ${c.kind === 'user' ? 'is-user' : 'is-ai'}">${c.kind === 'user' ? '用户' : 'AI'}</span>
                </label>
            `).join('')}
        </div>
        <div class="persona-circle-picker__compose">
            <textarea class="settings-section__input" rows="3" data-circle-pick-note
                placeholder="我对其的认知：例如「我家的小狗，乖萌可爱」"></textarea>
            <div class="persona-circle-picker__actions">
                <button class="persona-btn persona-btn--small" ${wvAction('personaCircleConfirmAdd', { entityType })}>加入圈子</button>
                <button class="persona-btn persona-btn--small persona-btn--ghost" ${wvAction('personaCircleClosePicker', { entityType })}>取消</button>
            </div>
        </div>`
        : '';

    return `
        <div class="settings-section__body persona-circle-picker">
            <div class="persona-circle-picker__head">
                <span class="persona-circle-picker__world">从 · ${worldName}</span>
            </div>
            ${composeHint}
            ${list}
        </div>
    `;
}

// ============================================
// 渲染：顶部模式切换
// ============================================

export function renderProfileModeBar(profileLevel, entityType) {
    return `
        <div class="settings-profile-mode">
            <span class="settings-profile-mode__label">人设详细度</span>
            <div class="settings-profile-mode__seg">
                <button class="settings-profile-mode__btn ${profileLevel === 'simple' ? 'is-active' : ''}"
                    ${wvAction('personaSetProfileLevel', { entityType, level: 'simple' })}>简略</button>
                <button class="settings-profile-mode__btn ${profileLevel === 'detailed' ? 'is-active' : ''}"
                    ${wvAction('personaSetProfileLevel', { entityType, level: 'detailed' })}>详细</button>
            </div>
        </div>
    `;
}

// ============================================
// 主入口
// ============================================

/**
 * 渲染人设编辑面板（AI / User 共用）。
 *
 *   - 顶部：模式切换 + 保存
 *   - 中间：按 AI_PERSONA_GROUPS / USER_PERSONA_GROUPS 顺序渲染各分组
 *     - simple 模式: 只显示本体（base），且只显示 required + optional 字段
 *     - detailed 模式: 全部显示
 *   - 末尾：绑定世界观 + 圈子 + 人生阶段 + parO 平行卡 + 资源绑定（detailed 才显示圈子/阶段/parO/资源绑定）
 *   - 元字段（boundWorldId）作为独立 section，跟 groups 平级
 */
export function renderPersonaEditor(persona, entityType, profileLevel, app) {
    if (!persona) return '<div class="settings-empty">没有可编辑的人设</div>';

    const level = profileLevel === 'simple' ? 'simple' : 'detailed';
    const groups = getPersonaGroups(entityType);

    const isVariant = persona.variantType && persona.variantType !== 'base';
    const rootMeta = isVariant && app
        ? `<div class="persona-variant-banner">
                <span class="persona-variant-banner__tag">${escapeHtml(persona.variantType === 'lifePhase' ? '人生阶段卡' : 'parO 平行卡')}</span>
                <span>来自本体卡 · ${escapeHtml((app.state[entityType] && app.state[entityType].id) || persona.parentPersonaId || '')}</span>
                ${phaseMetaBadge(persona)}
           </div>`
        : '';

    const groupsHtml = groups
        .map(group => renderPersonaGroup(group, persona, entityType, level))
        .filter(Boolean)
        .join('');

    const worldHtml = renderBoundWorldSection(persona, entityType);
    const circleHtml = level === 'detailed' ? renderCircleSection(persona, entityType, app) : '';
    // 资源绑定：紧跟在圈子后（detailed 才显示）。由独立的 resources-section.js 同步渲染
    // （首次返回 loading 占位 + 异步加载树，加载完后会自动 refresh）。
    const resourcesLoaded = !!(window.__resourcesTreeReady);
    const resourcesHtml = level === 'detailed'
        ? renderResourcesSectionSync(app, resourcesLoaded)
        : '';
    const phasesHtml = level === 'detailed' ? renderPhasesSection(persona, entityType, app) : '';
    const paroHtml = level === 'detailed' ? renderParoSection(persona, entityType, app) : '';

    const nameLine = `${escapeHtml(persona.name || persona.id)}`;
    const subLine = `ID: ${escapeHtml(persona.id)}`;

    return `
        <div class="persona-editor-card">
            ${rootMeta}
            <div class="persona-editor-card__head">
                <div class="persona-editor-card__title">${nameLine}</div>
                <div class="persona-editor-card__sub">${subLine}</div>
                ${renderProfileModeBar(level, entityType)}
            </div>
            <div class="persona-editor-card__body">
                ${worldHtml}
                ${groupsHtml}
                ${resourcesHtml}
                ${circleHtml}
                ${phasesHtml}
                ${paroHtml}
            </div>
            <div class="persona-editor-card__actions">
                <button class="persona-btn persona-btn--ghost persona-btn--outline" ${wvAction('personaDelete', { entityType })}>删除此卡设定</button>
                ${entityType === 'user' ? (() => {
                    // ★ v0.23 默认用户卡按钮
                    //   - 当前已是默认：显示「取消默认」
                    //   - 否则显示「设为默认」
                    //   决策走 SDK defaultUserCard.isDefault()，避免 UI 与数据不一致
                    const sdk = window.settingsSdk;
                    const isDefault = !!(sdk?.defaultUserCard?.isDefault?.(persona?.id));
                    const method = isDefault ? 'personaUnsetDefault' : 'personaSetDefault';
                    const label = isDefault ? '取消默认' : '设为默认';
                    const extraClass = isDefault ? ' persona-btn--default-active' : '';
                    return `<button class="persona-btn persona-btn--ghost persona-btn--default${extraClass}" ${wvAction(method, { entityType, userId: persona?.id })}>${escapeHtml(label)}</button>`;
                })() : ''}
                <button class="persona-btn persona-btn--primary" ${wvAction('personaSave', { entityType })}>保存全部</button>
            </div>
        </div>
    `;
}

/**
 * 渲染「当前世界观」绑定卡片。
 *   - 显示当前 persona.boundWorldId 对应的世界名（没有则显示「未绑定」）
 *   - 提供 select 让用户切换或解除绑定
 *   - 选中后通过 data-persona-field 保存，personaSave 会一并写入
 */
function renderBoundWorldSection(persona, entityType) {
    const sdk = window.settingsSdk;
    const worlds = (sdk?.worlds?.list?.() || []).map(w => ({
        id: w.id,
        name: w.name || w.id,
    }));
    const currentId = persona?.boundWorldId || '';
    const current = worlds.find(w => w.id === currentId);
    const dataAttr = `data-persona-field="${personaFieldPath(entityType, 'meta', 'boundWorldId')}"`;
    const options = [
        `<option value="" ${!currentId ? 'selected' : ''}>不绑定（自由模式）</option>`,
        ...worlds.map(w =>
            `<option value="${escapeHtml(w.id)}" ${w.id === currentId ? 'selected' : ''}>${escapeHtml(w.name)}</option>`
        ),
    ].join('');
    return `
        <section class="settings-section is-base is-on">
            <div class="settings-section__head">
                <div class="settings-section__head-text">
                    <div class="settings-section__head-title">当前世界观</div>
                    <div class="settings-section__head-sub">${escapeHtml(current ? current.name : '未绑定，留空表示自由模式')}</div>
                </div>
                <div class="settings-section__head-meta">
                    <span class="settings-section__head-meta-text">${current ? '已绑定' : '未绑定'}</span>
                </div>
            </div>
            <div class="settings-section__body">
                <div class="settings-section__field">
                    <label class="settings-section__label">绑定世界观</label>
                    <select class="settings-section__select" ${dataAttr}>${options}</select>
                    <div class="settings-section__helper">把本${entityType === 'user' ? '用户' : 'AI'}绑到一个特定世界观，留空则不绑定。</div>
                </div>
            </div>
        </section>
    `;
}
