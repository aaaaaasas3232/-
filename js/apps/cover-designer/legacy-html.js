/**
 * cover-designer / legacy-html.js
 *
 * 返回完整的封面7.html 原始 HTML 字符串(主体内容 + 浮动控件)
 * 一次 v-html 渲染,framework 不参与布局,由 legacy html 完全自管
 *
 * 顶部快捷工具栏的按钮 / 图标直接由 TOOLBAR_MODULES 生成,
 * 保证 toolbar 按钮与下方面板模块永远一一对应。
 */

import { TOOLBAR_MODULES } from './toolbar-panel-modules.js';

function renderQuickToolbar() {
    const buttons = TOOLBAR_MODULES.map((mod) => `
        <button class="cd-floating-control-btn" data-tool-target="${mod.id}" type="button" title="${mod.label}" aria-label="${mod.label}">
            ${mod.icon}
        </button>`).join('');
    return `<div class="cd-quick-toolbar" id="cdQuickToolbar">${buttons}
    </div>`;
}

export function renderLegacyHtml() {
    return `
${renderQuickToolbar()}
<div class="cd-main-container">
<div class="cd-card-wrapper">
    <div class="cd-card">
        <div class="cd-card-content">
            <div class="cd-time-stamp">2024年12月 · 冬日暖阳</div>
            <div class="cd-text-element cd-diary-text" contenteditable="true">生活的美好在于细节的温柔</div>

            <!-- 推特风格的博客设计 -->
            <div class="cd-text-element cd-blog-text" contenteditable="true" data-has-image="true" data-blog-id="xiaohongshu_12345" data-show-avatar="true" data-show-location="true">
                <div class="cd-blog-header">
                    <div class="cd-blog-avatar" data-avatar-type="letter" data-avatar-color="#cbc5bb">U</div>
                    <div class="cd-blog-info">
                        <div class="cd-blog-author">用户名</div>
                        <div class="cd-blog-location">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 2a6 6 0 00-6 6c0 4 6 10 6 10s6-6 6-10a6 6 0 00-6-6z"/>
                                <circle cx="12" cy="8" r="2"/>
                            </svg>
                            杭州西湖
                        </div>
                    </div>
                </div>
                标题或想法...
                <div class="cd-blog-img-preview">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                    </svg>
                </div>
                <div class="cd-blog-actions">
                    <div class="cd-blog-action">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                        24
                    </div>
                    <div class="cd-blog-action">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                        </svg>
                        8
                    </div>
                    <div class="cd-blog-action">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                            <polyline points="16 6 12 2 8 6" />
                            <line x1="12" y1="2" x2="12" y2="15" />
                        </svg>
                        12
                    </div>
                </div>
            </div>
            <div class="cd-clear"></div>
            <div class="cd-text-element cd-chat-bubble cd-chat-left" data-bubble-blur="8" data-bubble-opacity="0.3" data-border-width="0" data-shadow="0" contenteditable="true">24 8 12</div>
            <div class="cd-clear"></div>
        </div>

    </div>

    <div class="cd-edit-mode-toggle" id="cdEditModeToggle">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        编辑模式 (点击切换为文字样式模式)
    </div>

    <div style="margin-bottom:8px;"></div>

    <div class="cd-blur-control">
        <span>背景模糊</span>
        <input type="range" id="cdBlurSlider" min="0" max="20" value="5">
        <span id="cdBlurValue">5px</span>
    </div>

    <!-- 工具面板区域 — 顶部 toolbar 点哪个按钮,这里就渲染哪个模块的全部工具 -->
    <div class="cd-controls" id="cdControlsPanel"></div>

    <!-- 浮动按钮(右下 + 卡片上) -->
    <div class="cd-floating-add-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    </div>

    <!-- 浮动控制条(选中元素时显示) -->
    <div class="cd-floating-controls">
        <button class="cd-floating-control-btn" title="删除">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
        <button class="cd-floating-control-btn" title="复制">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <button class="cd-floating-control-btn" title="上移">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
        </button>
        <button class="cd-floating-control-btn" title="下移">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <button class="cd-floating-control-btn" title="样式">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
    </div>

    <!-- 文字选择控制条(文字样式模式) -->
    <div class="cd-text-selection-controls">
        <div class="cd-control-row">
            <button class="cd-selection-style-btn">加粗</button>
            <button class="cd-selection-style-btn">斜体</button>
            <button class="cd-selection-style-btn">下划线</button>
        </div>
        <div class="cd-control-row">
            <button class="cd-selection-style-btn">模糊</button>
            <button class="cd-selection-style-btn">阴影</button>
            <button class="cd-selection-style-btn">发光</button>
        </div>
        <div class="cd-control-row">
            <span>颜色</span>
            <div class="cd-color-grid">
                <div class="cd-selection-color-dot" style="background-color: #000000;"></div>
                <div class="cd-selection-color-dot" style="background-color: #ffffff;"></div>
                <div class="cd-selection-color-dot" style="background-color: #b86f6f;"></div>
            </div>
        </div>
        <div class="cd-control-row">
            <span>背景</span>
            <div class="cd-color-grid">
                <div class="cd-selection-color-dot cd-transparent-bg"></div>
                <div class="cd-selection-color-dot" style="background-color: #ffffff;"></div>
                <div class="cd-selection-color-dot" style="background-color: #454545;"></div>
            </div>
        </div>
        <div class="cd-control-row">
            <span>背景圆角</span>
            <input type="range" id="cdSelectionBgRadius" min="0" max="20" value="3">
            <span id="cdSelectionBgRadiusValue">3px</span>
        </div>
        <div class="cd-control-row" style="flex-direction: column; align-items: stretch; gap: 4px;">
            <span style="font-size: 12px; color: #888;">自定义选择颜色</span>
            <div style="display: flex; gap: 8px; align-items: center;">
                <div id="cdCustomSelectionColorPreview" class="cd-color-preview"></div>
                <input type="text" id="cdCustomSelectionColor" class="cd-input" placeholder="#hex 或 rgba(...)" value="#b86f6f">
                <button class="cd-btn" data-cd-action="apply-selection-color">应用</button>
            </div>
        </div>
    </div>
</div>
</div>

<!-- 历史存档面板(默认隐藏,顶栏「历史」按钮打开) -->
<div class="cd-archive-overlay" id="cdArchiveOverlay" hidden>
    <div class="cd-archive-backdrop" data-cd-action="close-archive"></div>
    <div class="cd-archive-sheet" role="dialog" aria-label="历史存档">
        <div class="cd-archive-head">
            <div class="cd-archive-title">
                历史存档
                <span class="cd-archive-count" id="cdArchiveCount"></span>
            </div>
            <button class="cd-archive-close" type="button" data-cd-action="close-archive" aria-label="关闭">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
        </div>
        <div class="cd-archive-actions">
            <button class="cd-archive-primary" type="button" data-cd-action="archive-current">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M8 3v5h7"/><path d="M8 13h8v8H8z"/></svg>
                存档当前设计
            </button>
            <button class="cd-archive-ghost" type="button" data-cd-action="new-design">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
                新建空白
            </button>
        </div>
        <div class="cd-archive-list" id="cdArchiveList"></div>
    </div>
</div>
    `;
}
