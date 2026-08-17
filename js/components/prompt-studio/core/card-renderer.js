/**
 * prompt-studio / core / card-renderer.js
 * ------------------------------------------------------------
 * 卡片渲染器集合(阶段 1 步骤 1.5)
 *
 * 从 prompt-manager-page.js 原封不动搬过来:
 *   - renderRowActions                 (line 226)
 *   - renderPromptCard                 (line 491)
 *   - renderPromptControlCard          (line 549)
 *   - renderActivePromptItem           (line 596)
 *   - renderPromptControlPromptItem    (line 628)
 *   - renderSystemPromptControlItem    (line 651)
 *   - renderStickerLibraryControlItem  (line 693)
 *   - renderSummaryItem                (line 724)
 *   - renderPromptLibraryItem          (line 769)
 *
 * 函数签名 / 行为 0 修改,保留所有 export。
 * 消费方:mode 文件 + render.js(阶段 3)
 */

import { escapeHtml, previewText } from './utils.js';

// ============================================================
// 操作按钮组:优先级 / 注入深度 / 编辑 / 启停 tab(单行)
// ============================================================

/**
 * @param {object} opts
 * @param {string} opts.aiPersonId
 * @param {string} opts.promptId
 * @param {boolean} [opts.isActive=true]
 * @param {boolean} [opts.locked=false]  true = 系统虚拟 prompt,锁定不可停用
 *                                      → 不渲染 segmented-tabs,改渲染锁定徽标
 */
export function renderRowActions({ aiPersonId, promptId, isActive = true, locked = false, systemControl = null }) {
    const mk = (method, extra = {}) => {
        const payload = { aiPersonId, promptId, ...extra };
        return JSON.stringify({ action: 'appMethod', appId: 'chat', method, payload });
    };
    const toggleAction = JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method: 'toggleReplyPromptActive',
        payload: { aiPersonId, promptId },
    });
    // ★ v0.57 系统 prompt 控制卡 → toggle / 编辑 走不同 method
    const systemToggleAction = systemControl
        ? JSON.stringify({
            action: 'appMethod',
            appId: 'chat',
            method: 'toggleSystemPromptInject',
            payload: { aiPersonId, kind: systemControl.kind },
        })
        : toggleAction;
    const systemEditAction = systemControl
        ? JSON.stringify({
            action: 'appMethod',
            appId: 'chat',
            method: 'openSystemPromptEditor',
            payload: { aiPersonId, kind: systemControl.kind },
        })
        : mk('openEditReplyPromptModal');

    // ★ 系统虚拟 prompt 且未配置 systemControl → 只显示锁标,完全不可点
    if (locked && !systemControl) {
        return `
            <div class="pm-row-actions pm-row-actions--locked">
                <span class="pm-lock-badge" title="系统虚拟提示词,自动注入,不可关闭">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round">
                        <rect x="5" y="11" width="14" height="9" rx="2"/>
                        <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                    </svg>
                </span>
            </div>
        `;
    }

    return `
        <div class="pm-row-actions ${systemControl ? 'pm-row-actions--system' : ''}">
            ${systemControl ? '' : `<button type="button" class="pm-chip pm-chip--delete"
                data-app-action='${escapeHtml(mk('deleteReplyPrompt'))}'
                title="删除">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                    stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/>
                    <path d="M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
            </button>`}
            <button type="button" class="pm-chip pm-chip--edit"
                data-app-action='${escapeHtml(systemEditAction)}'
                title="编辑">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                    stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 20h9"/>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/>
                </svg>
            </button>
            <div class="pm-segmented-tabs" data-prompt-id="${escapeHtml(promptId)}">
                <button type="button" class="pm-segmented-tab ${isActive ? '' : 'is-active'}"
                    data-app-action='${escapeHtml(systemToggleAction)}'
                    data-target="close">关闭</button>
                <button type="button" class="pm-segmented-tab ${isActive ? 'is-active' : ''}"
                    data-app-action='${escapeHtml(systemToggleAction)}'
                    data-target="enable">启用</button>
            </div>
        </div>
    `;
}

// ============================================================
// 「当前上下文 Prompt」长款卡片 = renderPromptCard
//    与可用 Prompt 短款(renderPromptControlCard)是两个组件
// ============================================================

/**
 * 渲染「当前上下文 Prompt」长款卡片(序号 + 标题 + source + preview)
 *   - 序号 + 长 preview 是「当前上下文」特有,「可用 Prompt」没有
 *   - body 内只有正文(各业务可往 body 后追加额外 block)
 *   - 右侧按钮框放在 <summary> 之外,在 <details> 容器里通过 CSS 浮在右上
 *     → 修 a11y 问题(summary 内嵌 button 抢焦点 / 风格按钮难命中)
 */
export function renderPromptCard({
    renderId,
    promptId,
    title,
    source,
    preview,
    fullContent,
    order,
    draggable = true,
    omitActions = false,
    actionsHtml = '',
    extraClass = '',
    extraBody = '',
}) {
    const indexHtml = renderId
        ? `<span class="pm-card-index">${escapeHtml(String(renderId))}</span>`
        : '';
    const sourceHtml = source
        ? `<span class="pm-item-source">${escapeHtml(source)}</span>`
        : '';
    const previewHtml = preview
        ? `<div class="pm-item-preview">${escapeHtml(preview)}</div>`
        : '';
    const rightHtml = omitActions ? '' : `
                <div class="pm-item-right">
                    ${actionsHtml}
                </div>`;
    const extraAttrs = draggable ? `data-pm-draggable="true"` : '';
    // ★ v0.61.8.7 作用域 class:仅用于 DOM 区分「当前上下文区」,不改样式
    const cls = `pm-card pm-item pm-item--in-context${extraClass ? ' ' + extraClass : ''}`;
    return `
        <details class="${cls}" data-prompt-id="${escapeHtml(promptId)}" data-order="${escapeHtml(String(order ?? ''))}" ${extraAttrs}>
            <summary class="pm-item-summary">
                ${indexHtml}
                <div class="pm-item-main">
                    <div class="pm-item-head">
                        <span class="pm-item-title">${escapeHtml(title)}</span>
                        ${sourceHtml}
                    </div>
                    ${previewHtml}
                </div>${rightHtml}
            </summary>
            <div class="pm-item-body">
                <div class="pm-item-content">${escapeHtml(fullContent || '')}</div>
                ${extraBody}
            </div>
        </details>
    `;
}

/**
 * 渲染「可用 Prompt」短款卡片(只有标题 + 右侧按钮)
 *   - 与「当前上下文」的结构区别:
 *     · 无序号、无 preview 行、无 source 角标
 *     · 主体更短(高度一致)
 *   - body 内只放正文
 *   - 右侧按钮同样在 summary 之外,CSS 浮在右上
 */
export function renderPromptControlCard({
    promptId,
    title,
    fullContent,
    dataKind = '',
    extraClass = '',
    actionsHtml = '',
    extraBody = '',
    skipDefaultContent = false,
}) {
    const dataKindAttr = dataKind ? `data-kind="${escapeHtml(dataKind)}"` : '';
    // ★ v0.61.7.2 加上 pm-card 类(与 renderPromptCard 对齐),
    //   这样 savePromptManagerChanges / drag-controller 才能同时收集到
    //   「当前上下文」section 和「可用 Prompt」section 的卡片
    // ★ v0.61.8.7 作用域 class:仅用于 DOM 区分「可用 Prompt 区」,不改样式
    const cls = `pm-card pm-item pm-item--control pm-item--in-available${extraClass ? ' ' + extraClass : ''}`;
    const rightHtml = actionsHtml
        ? `<div class="pm-item-right">${actionsHtml}</div>`
        : '';
    // ★ v0.61.8.2 App Prompt 三段式布局:content 已经包在 extraBody 内的视图容器里,
    //   这里跳过默认 content 防止重复
    const defaultContentHtml = skipDefaultContent
        ? ''
        : `<div class="pm-item-content">${escapeHtml(fullContent || '')}</div>`;
    return `
        <details class="${cls}" data-prompt-id="${escapeHtml(promptId)}" ${dataKindAttr}>
            <summary class="pm-item-summary">
                <div class="pm-item-main">
                    <div class="pm-item-head">
                        <span class="pm-item-title">${escapeHtml(title)}</span>
                    </div>
                </div>${rightHtml}
            </summary>
            <div class="pm-item-body">
                ${defaultContentHtml}
                ${extraBody}
            </div>
        </details>
    `;
}

/**
 * ★ v0.61.7 渲染「当前上下文 Prompt」长款卡片
 *   - 序号 + title + source + preview(当前上下文独有)
 *   - 右侧按钮组放在 <summary> 之外,CSS 浮在右上(a11y)
 */
export function renderActivePromptItem(prompt, index, total, aiPersonId, opts = {}) {
    const isFirst = index === 0;
    const isLast = index === total - 1;
    const isActive = prompt.active !== false;
    const omitActions = !!opts.omitActions;
    const actionsHtml = omitActions ? '' : renderRowActions({
        aiPersonId,
        promptId: prompt.id,
        isFirst,
        isLast,
        isActive,
    });
    return renderPromptCard({
        renderId: index + 1,
        promptId: prompt.id,
        title: prompt.title,
        source: omitActions ? '' : (prompt.source || 'custom'),
        preview: previewText(prompt.content, 120),
        fullContent: prompt.content,
        order: prompt.order,
        draggable: true,
        omitActions,
        actionsHtml,
        extraClass: omitActions ? 'pm-item--system-context' : '',
    });
}

/**
 * ★ v0.61.7 渲染「可用 Prompt」短款卡片(只有标题 + 右侧按钮)
 *   - 与当前上下文长款是两个组件
 *   - 按钮组放在 <summary> 之外 → 修 a11y 问题
 */
export function renderPromptControlPromptItem(prompt, aiPersonId) {
    const isActive = prompt.active !== false;
    const actionsHtml = renderRowActions({
        aiPersonId,
        promptId: prompt.id,
        isActive,
    });
    return renderPromptControlCard({
        promptId: prompt.id,
        title: prompt.title,
        fullContent: prompt.content,
        actionsHtml,
    });
}

/**
 * 渲染「系统 Prompt 控制卡」(用于「可用 Prompt」section 顶部)
 *   - 跟真实 prompt 同款 UI(可展开正文 + 完整按钮组)
 *   - 「优先级 / 注入深度 / 编辑」+「关闭 / 启用」toggle
 *   - 编辑跳 settings → personaHome
 *   - toggle 走 toggleSystemPromptInject
 *   - 启用状态从 injectMap[aiPersonId][kind] 读取,实时反映
 */
export function renderSystemPromptControlItem(systemPrompt, aiPersonId, injectMap) {
    const kind = systemPrompt.systemKind === 'ai' ? 'ai' : 'user';
    const roleClass = kind === 'user' ? 'pm-item--system-user' : 'pm-item--system-ai';
    const inject = injectMap?.[aiPersonId] || { user: true, ai: true };
    const isActive = inject[kind] !== false;
    const actionsHtml = renderRowActions({
        aiPersonId,
        promptId: systemPrompt.id,
        isActive,
        systemControl: { kind },
    });
    return renderPromptControlCard({
        promptId: systemPrompt.id,
        title: systemPrompt.title,
        fullContent: systemPrompt.content,
        dataKind: kind,
        extraClass: roleClass,
        actionsHtml,
    });
}

/**
 * ★ v0.64 渲染「AI 表情包库」nook 控制卡
 *
 * 业务背景:
 *   - 这张卡代表「AI 可以用哪些表情包」,数据源是 aiPerson.boundResources.stickerGroupIds
 *   - 用户在 settings → 人设编辑器 → 资源绑定 → 表情包库 绑定图组后,
 *     这张卡里的「可发表情包」列表会自动更新
 *   - 关闭后 prompt-builder 不注入「表情包库」段,AI 完全不知道哪些表情可用
 *
 * 视觉风格:
 *   - 跟系统人设控制卡一致(.pm-card .pm-item .pm-item--control .pm-item--in-available)
 *   - data-kind="sticker-library"(供 CSS 锁样式 / 调试)
 *   - extraClass: pm-item--system-ai(用 AI 主角色色)
 *
 * 内容:
 *   - 标题:"AI 表情包库"
 *   - 简介动态渲染:读 aiPerson.boundResources.stickerGroupIds + 异步加载 group image names
 *     默认简版:「N 张表情」,展开后才读 group 详情(name 列表)
 *   - fullContent 是占位简版,真正详细的 names 列表在 systemPrompt 拼接时已经注入,
 *     这卡只展示开关状态
 */
export function renderStickerLibraryControlItem({ aiPersonId, stickerCount, isActive }) {
    const roleClass = 'pm-item--system-ai';
    const actionsHtml = renderRowActions({
        aiPersonId,
        promptId: 'sticker-library',
        isActive,
        systemControl: { kind: 'sticker-library' },
    });
    // fullContent 给 <details> 展开看(简版,真实名称列表在 prompt 里)
    const fullContent = stickerCount > 0
        ? `# AI 表情包库\n\n当前已绑定 ${stickerCount} 张可发表情包。\n\n详细名称列表已注入到系统 prompt,AI 回复时会自动遵守 [表情包:名称] 格式。`
        : `# AI 表情包库\n\n你还没绑定表情包资源 — 去「设置 → 人设 → 资源绑定 → 表情包」绑定图组。`;
    return renderPromptControlCard({
        promptId: 'sticker-library',
        title: 'AI 表情包库',
        fullContent,
        dataKind: 'sticker-library',
        extraClass: roleClass,
        actionsHtml,
    });
}

// ============================================================
// 概要系统 item
// ============================================================

/**
 * ★ v0.61.3 渲染单条 summary item(calendarSummaries / storySummaries 共用)
 *   - 视觉风格:和 pm-card 接近,但标题前加小图标
 *   - 显示:标题 + dateRange / messageCount + 预览前 80 字
 */
export function renderSummaryItem(s, index, kind) {
    const preview = escapeHtml(previewText(s.content || '', 80));
    const meta = (s.dateRange && (s.dateRange.start || s.dateRange.end))
        ? `${escapeHtml(s.dateRange.start || '')} ~ ${escapeHtml(s.dateRange.end || '')}`
        : '';
    const msgCount = Number(s.messageCount) || 0;
    const iconHtml = kind === 'story'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="#D4728A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5l2.4 5 5.5.8-4 3.9.9 5.5L12 15.4 7.2 17.7l.9-5.5-4-3.9 5.5-.8L12 2.5z"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="#4A6FA5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>';
    return `
        <div class="pm-summary-item pm-summary-item--${escapeHtml(kind)}" data-summary-id="${escapeHtml(s.id)}">
            <div class="pm-summary-item-head">
                <div class="pm-summary-item-icon">${iconHtml}</div>
                <div class="pm-summary-item-main">
                    <div class="pm-summary-item-title">${escapeHtml(s.title || '未命名概要')}</div>
                    <div class="pm-summary-item-meta">
                        ${meta ? `<span class="pm-summary-item-range">${meta}</span>` : ''}
                        ${msgCount > 0 ? `<span class="pm-summary-item-count">${msgCount} 条</span>` : ''}
                        <span class="pm-summary-item-badge">${kind === 'story' ? '故事' : '日历'}</span>
                    </div>
                </div>
                <div class="pm-summary-item-source">[${index + 1}]</div>
            </div>
            <div class="pm-summary-item-preview">${preview}</div>
        </div>
    `;
}

// ============================================================
// Prompt 库单条
// ============================================================

/**
 * ★ v0.61.7 渲染「Prompt 库」单条(底部拉取区)
 *   - 复用 .pm-item 主结构(对齐当前用户人设)
 *   - 标题前用 [库] / [已添加] 标签代替 state-badge
 *   - 来源面包屑:.pm-item-source 角标
 *   - 右侧按钮:拉取(把库条目复制成当前 AI 人设的 replyPrompt)
 *   - 已拉取:按钮 disabled + 灰态 + 文字改「已拉取」(v0.61.8.10 防止反复拉取)
 *     ★ isImported 时按钮仍然存在但 disabled,而不是换成对勾 —— 用户一眼就知道
 *       这条已经被当前 AI 人设拉取过,无法再操作;视觉上「拉取」位置不变,只是变灰
 */
export function renderPromptLibraryItem({ entry, isImported, aiPersonId }) {
    const pr = entry.prompt || {};
    const title = escapeHtml(pr.text?.split('\n')[0]?.slice(0, 24) || pr.id || '未命名');
    const fullText = escapeHtml(pr.text || '');
    // ★ v0.61.8.10 拉取按钮:已拉取时禁用(灰态 + 文字「已拉取」),不换成对勾
    //   防止用户重复点击拉取(SDK 内部已有 sourceLibraryPromptId 去重,但 UI 上要明确反馈)
    const pullBtnClass = isImported ? 'pm-chip pm-chip--pull pm-chip--pulled' : 'pm-chip pm-chip--pull';
    const pullBtnLabel = isImported ? '已拉取' : '拉取';
    const pullBtnTitle = isImported
        ? '已添加到当前 AI 人设(在「可用 Prompt → Nook 组」可见,可在该处启用/删除)'
        : '拉取到当前 AI 人设';
    const actionsHtml = `
        <button type="button" class="${pullBtnClass}"
            data-app-action='${escapeHtml(JSON.stringify({
                action: 'appMethod',
                appId: 'chat',
                method: 'pullReplyPromptFromLibrary',
                payload: { aiPersonId, promptId: pr.id },
            }))}'
            ${isImported ? 'disabled' : ''}
            title="${escapeHtml(pullBtnTitle)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>
            <span>${pullBtnLabel}</span>
        </button>`;
    return renderPromptControlCard({
        promptId: pr.id || '',
        title: title,
        fullContent: fullText,
        dataKind: 'library',
        extraClass: isImported ? 'pm-item--library pm-item--library-pulled' : 'pm-item--library',
        actionsHtml,
    });
}
