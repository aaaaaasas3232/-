/**
 * cover-designer / index.js
 *
 * 1:1 还原封面7.html —— 同样的 HTML 结构、同样的 CSS class、同样的 JS 行为
 * 全部走 framework 的 vue 模式(renderPage 返回 Vue 组件配置)
 *
 * 设计:
 *   - renderDesignPage 返回 Vue 组件,模板里直接渲染完整的原始 HTML 字符串
 *   - 所有 interactivity(点击 / 输入 / 滑块 / toggle / image upload / text editing 等)走 mounted() 钩子
 *   - 事件委托 document,避开 framework `data-app-action` 派发,因为本 app 大量依赖原生 DOM 事件
 *     (contenteditable / selectionchange / input.oninput / change 等)
 *   - 持久化:整体 HTML 序列化进 localStorage,x-init 时还原(不依赖 Vue 响应式)
 */

import { injectCoverDesignerStyles } from './styles-loader.js';
import { renderLegacyHtml } from './legacy-html.js';
import { TOOLBAR_MODULES } from './toolbar-panel-modules.js';
import { exportCardToPng } from './services/exporter.js';

// ============================================================
// 顶层模块状态(单例)
// ============================================================
let _cdSelected = null;            // 当前 selectedElement(全局)
let _cdContext = null;             // currentContextElement(全局)
let _cdTextRange = null;           // selectedTextRange(全局)
let _cdIsEditMode = true;          // edit mode 状态
let _cdLongpressTimer = null;
let _cdLongpressThreshold = 500;
let _cdSwipeStartX = 0;
let _cdSwipeThreshold = 50;

const STORAGE_KEY_DESIGN = 'xiaoting::cover-designer-state-v2';
const STORAGE_KEY_BG = 'xiaoting::cover-designer-bg-v2';

// 历史存档表(在 appConfig.stores 声明,framework 建表)
const ARCHIVE_STORE = 'cdDesigns';

// 和 _base.css 里 .cd-card 的默认底图保持一致
const DEFAULT_BG_URL = 'https://s1.imagehub.cc/images/2025/05/31/97811b2386f57f4b3dd84d7c16fe67de.jpeg';

// 挂在 document 上的全局监听,重新 mount 前要先摘掉,否则会叠加
let _cdDocClickHandler = null;
let _cdSelectionHandler = null;

// framework 顶栏三个按钮的图标,和 app 内工具栏同一套线性风格
const TOPBAR_ICONS = {
    archive: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M8 3v5h7"/><path d="M8 13h8v8H8z"/></svg>`,
    history: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.2 12a8.8 8.8 0 1 0 2.6-6.2"/><path d="M3.2 4.6V9h4.4"/><path d="M12 7.6V12l3 1.8"/></svg>`,
    download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.6v11.2"/><path d="M8 11l4 3.8 4-3.8"/><path d="M4.5 19.4h15"/></svg>`,
};

// ============================================================
// Vue 组件:design 页
// ============================================================
export function renderDesignPage(_content, _page, _app) {
    return {
        name: 'CoverDesignerDesignPage',
        props: {
            app: { type: Object, required: true },
            page: { type: Object, required: true },
        },
        data() {
            return {
                currentPage: 'design',
                // 强制 rebuild v-html 的计数器
                _rev: 0,
            };
        },
        computed: {
            renderedHtml() {
                // 返回原始 HTML 字符串
                return renderLegacyHtml();
            },
        },
        mounted() {
            injectCoverDesignerStyles();
            const root = this.$el;
            if (!root) return;

            // ★ 1) 立刻恢复持久化状态(如果有)
            restoreState(root);

            // ★ 2) DOMContentLoaded-style 初始化
            initCard(root);
            initFloatingControls(root);
            initFloatingAdd(root);
            initToolbar(root);
            initTextSelectionListener(root);
            makeElementsEditable(root);
            initTimeStampEditing(root);
            initBlurSlider(root);
            initTextSelectionControls(root);
            initEditModeToggle(root);
            initArchivePanel(root);
            // makeElementsEditable 一律开了 contentEditable,这里按当前模式纠正一次
            applyEditMode(root);

            // ★ 3) 绑定全局键盘快捷键
            this._keyHandler = (e) => {
                if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
                    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
                    e.preventDefault();
                    e.stopPropagation();
                    archiveCurrentDesign(root);
                }
                if (e.key === 'Delete' && _cdSelected && _cdIsEditMode) {
                    if (_cdSelected.classList.contains('cd-chat-bubble')) {
                        const next = _cdSelected.nextElementSibling;
                        if (next && next.classList.contains('cd-clear')) next.remove();
                    }
                    _cdSelected.remove();
                    _cdSelected = null;
                    persistState(root);
                }
            };
            document.addEventListener('keydown', this._keyHandler);

            // 自动存草稿:每 15s 把画布快照写回 localStorage,避免切 app 丢内容
            this._autosaveTimer = setInterval(() => {
                try { persistState(root); } catch (_) {}
            }, 15000);
        },
        beforeUnmount() {
            try { persistState(this.$el); } catch (_) {}
            if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
            if (this._autosaveTimer) clearInterval(this._autosaveTimer);
            if (_cdDocClickHandler) { document.removeEventListener('click', _cdDocClickHandler); _cdDocClickHandler = null; }
            if (_cdSelectionHandler) { document.removeEventListener('selectionchange', _cdSelectionHandler); _cdSelectionHandler = null; }
            // 存档面板挂在 .app-shell 上,不会随 .cd-root 一起销毁,得手动收走
            try { getArchiveOverlay(this.$el)?.remove(); } catch (_) {}
            try { document.querySelector('.cd-context-menu')?.remove(); } catch (_) {}
        },
        methods: {
            navigateTo(page) {
                this.currentPage = page;
            },
        },
        template: `
            <div class="cd-root" v-if="currentPage === 'design'" v-html="renderedHtml"></div>
        `,
    };
}

// ============================================================
// export Factory
// ============================================================
export default function createCoverDesignerApp() {
    return {
        id: 'cover-designer',
        name: '封面设计器',
        icon: '',
        iconBg: 'linear-gradient(145deg, #F2A1A1, #D6A4A4)',
        background: 'linear-gradient(180deg, #f7f6f4 0%, #ebe9e5 100%)',
        statusBarColor: '#454545',
        homeIndicatorColor: 'rgba(69, 69, 69, 0.3)',

        renderMode: 'vue',

        distribution: {
            requiresInstall: true,
            installed: false,
            appStore: {
                subtitle: '小红书封面快速设计工具',
                category: '设计',
                rating: 4.8,
                ratingsCount: '新上架',
                size: '2 MB',
                age: '4+',
                version: '1.0.0',
                whatsNew: '首版上线,5 种元素类型 + 12 套样式面板。',
                description:
                    '一张封面常常不是缺少内容，只是还没找到内容该站在哪里。\n\n'
                    + '封面设计器可以从空白画布或预设模板起步。文字、图片与图层都能在画布上调整，也可以载入自己的字体。\n\n'
                    + '设计稿会留在本地，历史版本可以再翻出来。定稿后，导出为保留透明度的 PNG，或体积更小的 JPG。',
                accent: 'linear-gradient(145deg, #F2A1A1, #D6A4A4)',
                tutorial: [
                    {
                        title: '新建一个封面设计',
                        content: '点顶栏的「新建」按钮,会创建一张空白画布。你可以从空白开始,也可以选择一套预设模板作为起点。',
                    },
                    {
                        title: '怎么添加文字',
                        content: '点工具栏的「文字」按钮,画布上会出现一个文字框,点击可以编辑文字内容。双击可以选中文字,拖动四个角可以调整大小。',
                    },
                    {
                        title: '怎么添加图片',
                        content: '点工具栏的「图片」按钮,可以上传本地图片。上传后图片会出现在画布中央,拖动边框可以调整大小和位置。',
                    },
                    {
                        title: '怎么调整图层顺序',
                        content: '右侧图层面板列出了画布上所有元素。拖动图层可以调整上下顺序,或者点眼睛图标隐藏某个图层。',
                    },
                    {
                        title: '怎么保存和导出',
                        content: '点顶栏「导出」按钮,可以导出为 PNG 图片或 JPG 图片。导出的图片会自动保存到系统相册。',
                    },
                ],
                faqs: [
                    {
                        question: '封面设计会自动保存吗？',
                        answer: '会的。所有设计会自动保存到本地,下次进来还在。如果想要不同版本,可以点「历史」按钮查看和恢复历史版本。',
                    },
                    {
                        question: '可以上传自己的字体吗？',
                        answer: '可以在「字体」面板里点「添加字体」,粘入 @font-face 或 @import 的 CSS 代码来加载自定义字体。',
                    },
                    {
                        question: '导出后的图片分辨率是多少？',
                        answer: '默认按画布实际尺寸导出。如果需要更高分辨率,可以在导出前把画布整体放大,导出后再缩小查看。',
                    },
                    {
                        question: '支持哪些图片格式？',
                        answer: '支持 PNG 和 JPG 两种导出格式。PNG 保留透明度,JPG 体积更小。',
                    },
                ],
            },
        },

        // ★ 三张表都必须在这里声明。
        //   cdCustomFonts / cdPreferences 之前漏了 —— services 层照常读写、照常
        //   try/catch 兜底返回空数组,所以完全不报错,表现是「加的字体下次进来就没了」。
        //   声明了才会在 registerPhoneAppAsync 时被 ensureSchema 建出来。
        stores: [
            {
                // 一条 = 一份历史设计稿(含缩略图)
                name: ARCHIVE_STORE,
                keyPath: 'id',
                indexes: [{ name: 'updatedAt', keyPath: 'updatedAt' }],
            },
            // 用户粘的 @font-face / @import 片段
            { name: 'cdCustomFonts', keyPath: 'id' },
            // 用户偏好,keyPath 是 'key' 不是 'id'
            { name: 'cdPreferences', keyPath: 'key' },
        ],

        pages: [
            {
                id: 'design',
                label: '设计',
                nav: true,
                topbar: {
                    type: 'standard',
                    title: '封面设计器',
                    // framework 顶栏按钮要 iconHtml + action(见 index.html 的 app-topbar-actions)
                    headerActions: [
                        {
                            iconHtml: TOPBAR_ICONS.archive,
                            ariaLabel: '存档当前设计',
                            variant: 'glass',
                            action: { action: 'appMethod', method: 'archiveDesign' },
                        },
                        {
                            iconHtml: TOPBAR_ICONS.history,
                            ariaLabel: '历史存档',
                            variant: 'glass',
                            action: { action: 'appMethod', method: 'openHistory' },
                        },
                        {
                            iconHtml: TOPBAR_ICONS.download,
                            ariaLabel: '下载封面',
                            variant: 'solid',
                            action: { action: 'appMethod', method: 'exportPng' },
                        },
                    ],
                },
            },
        ],
        defaultRootPageId: 'design',

        renderPage: renderDesignPage,

        methods: {
            createNewDesign() {
                const root = getRoot();
                if (root) resetToBlankDesign(root);
            },
            archiveDesign() {
                const root = getRoot();
                if (root) archiveCurrentDesign(root);
            },
            openHistory() {
                const root = getRoot();
                if (root) openArchivePanel(root);
            },
            exportPng() {
                const root = getRoot();
                if (root) saveDesign(root);
            },
        },
    };
}

// ============================================================
// 工具:持久化
// ============================================================
/**
 * 把画布当前状态抽成一个纯数据快照。
 * 存档 / 草稿 / 历史读取全部复用这一个结构。
 */
function snapshotDesign(root) {
    const cardContent = root.querySelector('.cd-card-content');
    const card = root.querySelector('.cd-card');
    const blurSlider = root.querySelector('#cdBlurSlider');
    return {
        cardContentHtml: cardContent ? cardContent.innerHTML : '',
        bgUrl: card ? (card.dataset.cdBgUrl || '') : '',
        bgMask: card ? (card.dataset.cdBgMask || '0') : '0',
        cardColor: card ? (card.dataset.cdCardColor || '') : '',
        contentBlur: blurSlider ? blurSlider.value : '5',
        isEditMode: _cdIsEditMode,
    };
}

/**
 * 把快照写回画布。
 * 注意:替换 innerHTML 之后元素上的监听全丢了,调用方必须重新 init。
 */
function applyDesignSnapshot(root, snap) {
    if (!snap) return;
    const cardContent = root.querySelector('.cd-card-content');
    if (cardContent && typeof snap.cardContentHtml === 'string' && snap.cardContentHtml.trim()) {
        cardContent.innerHTML = snap.cardContentHtml;
    }
    const card = root.querySelector('.cd-card');
    if (card) {
        card.dataset.cdBgUrl = snap.bgUrl || '';
        card.dataset.cdBgMask = snap.bgMask || '0';
        if (snap.cardColor) {
            card.dataset.cdCardColor = snap.cardColor;
            card.style.backgroundColor = snap.cardColor;
        }
        applyCardBackground(root);
    }
    if (snap.contentBlur != null) {
        const slider = root.querySelector('#cdBlurSlider');
        if (slider) slider.value = snap.contentBlur;
        adjustBlur(snap.contentBlur, root);
    }
    if (typeof snap.isEditMode === 'boolean') _cdIsEditMode = snap.isEditMode;
}

function persistState(root) {
    if (!root) return;
    try {
        const snap = snapshotDesign(root);
        snap.updatedAt = Date.now();
        localStorage.setItem(STORAGE_KEY_DESIGN, JSON.stringify(snap));
    } catch (_) {}
}

let _cdPersistTimer = null;
function debouncedPersist(root) {
    return () => {
        if (_cdPersistTimer) clearTimeout(_cdPersistTimer);
        _cdPersistTimer = setTimeout(() => persistState(root), 600);
    };
}

function restoreState(root) {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_DESIGN);
        if (!raw) return;
        applyDesignSnapshot(root, JSON.parse(raw));
    } catch (_) {}
}

/**
 * 把画布恢复到出厂默认(不动已存档的历史)
 */
function resetToBlankDesign(root) {
    try { localStorage.removeItem(STORAGE_KEY_DESIGN); } catch (_) {}
    try { localStorage.removeItem(STORAGE_KEY_BG); } catch (_) {}
    const holder = document.createElement('div');
    holder.innerHTML = renderLegacyHtml();
    const freshContent = holder.querySelector('.cd-card-content');
    applyDesignSnapshot(root, {
        cardContentHtml: freshContent ? freshContent.innerHTML : '',
        bgUrl: '',
        bgMask: '0',
        cardColor: '',
        contentBlur: '5',
        isEditMode: true,
    });
    const card = root.querySelector('.cd-card');
    if (card) card.style.backgroundColor = '';
    rebindCanvas(root);
    closeArchivePanel(root);
    persistState(root);
    notify('success', '已新建空白设计');
}

/**
 * 画布 innerHTML 被整体替换后,重新挂上所有元素级监听
 */
function rebindCanvas(root) {
    _cdSelected = null;
    _cdContext = null;
    hideFloatingControls(root);
    initFloatingControls(root);
    makeElementsEditable(root);
    initTimeStampEditing(root);
    applyEditMode(root);
}

// ============================================================
// 初始化:卡片点击 / 浮动菜单 / 文本选择监听
// ============================================================
function initCard(root) {
    const cardContent = root.querySelector('.cd-card-content');
    if (!cardContent) return;

    // contenteditable 打字不经过任何 action,不在这里存草稿就只能等 15s 的自动存盘
    cardContent.addEventListener('input', debouncedPersist(root));
    cardContent.addEventListener('blur', () => persistState(root), true);

    // 替代原始 document.body click 委托
    cardContent.addEventListener('click', (e) => {
        if (e.target.classList.contains('cd-text-element') ||
            e.target.classList.contains('cd-chat-bubble') ||
            e.target.closest('.cd-text-element')) {
            let target = e.target;
            if (!target.classList.contains('cd-text-element') && !target.classList.contains('cd-chat-bubble')) {
                target = target.closest('.cd-text-element');
            }
            if (target) {
                selectElement(target);
                if (_cdIsEditMode) showFloatingControls(target, root);
            }
        }
    });

    // 全局点击,空白处隐藏浮动菜单
    if (_cdDocClickHandler) document.removeEventListener('click', _cdDocClickHandler);
    _cdDocClickHandler = (e) => {
        if (!e.target.closest('.cd-text-element') && !e.target.closest('.cd-floating-controls') && !e.target.closest('.cd-floating-add-btn')) {
            hideFloatingControls(root);
        }
    };
    document.addEventListener('click', _cdDocClickHandler);
}

// ============================================================
// 浮动工具条 / 长按 / 选中
// ============================================================
function initFloatingControls(root) {
    const elements = root.querySelectorAll('.cd-text-element, .cd-chat-bubble, .cd-diary-text, .cd-blog-text, .cd-chat-left, .cd-chat-right, .cd-image-card');
    elements.forEach((element) => {
        element.addEventListener('click', (e) => {
            if (_cdIsEditMode) {
                selectElement(element);
                showFloatingControls(element, root);
                e.stopPropagation();
            }
        });
        element.addEventListener('touchstart', (e) => {
            if (!_cdIsEditMode) return;
            if (_cdLongpressTimer) clearTimeout(_cdLongpressTimer);
            _cdLongpressTimer = setTimeout(() => {
                _cdContext = element;
                selectElement(element);
                showFloatingControls(element, root);
                if (e.cancelable) e.preventDefault();
            }, _cdLongpressThreshold);
        }, { passive: false });
        const clearTimer = () => { if (_cdLongpressTimer) { clearTimeout(_cdLongpressTimer); _cdLongpressTimer = null; } };
        element.addEventListener('touchend', clearTimer);
        element.addEventListener('touchmove', clearTimer);
    });

    // 5 个浮动按钮
    const floating = root.querySelector('.cd-floating-controls');
    if (floating) {
        const btns = floating.querySelectorAll('.cd-floating-control-btn');
        const labels = ['删除', '复制', '上移', '下移', '样式'];
        btns.forEach((btn, idx) => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (idx === 0) deleteElement(root);
                else if (idx === 1) duplicateElement(root);
                else if (idx === 2) moveUp(root);
                else if (idx === 3) moveDown(root);
                else if (idx === 4) editStyle(root);
            });
        });
    }
}

function showFloatingControls(element, root) {
    _cdContext = element;
    const controls = root.querySelector('.cd-floating-controls');
    if (!controls) return;
    const rect = element.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    controls.style.top = (rect.top - rootRect.top - 20) + 'px';
    controls.style.left = '50%';
    controls.style.transform = 'translateX(-50%)';
    controls.classList.add('cd-visible');

    const editStyleBtn = controls.querySelectorAll('.cd-floating-control-btn')[4];
    if (editStyleBtn) {
        if (element.classList.contains('cd-chat-bubble')) editStyleBtn.title = '气泡样式';
        else if (element.classList.contains('cd-blog-text')) editStyleBtn.title = '博客设置';
        else if (element.classList.contains('cd-image-card')) editStyleBtn.title = '图片设置';
        else editStyleBtn.title = '样式';
    }
}

function hideFloatingControls(root) {
    const controls = root.querySelector('.cd-floating-controls');
    if (controls) controls.classList.remove('cd-visible');
}

function selectElement(element) {
    const root = document.querySelector('.app-shell[data-app-id="cover-designer"] .cd-root');
    if (root) root.querySelectorAll('.cd-selected').forEach((el) => el.classList.remove('cd-selected'));
    _cdSelected = element;
    if (element) element.classList.add('cd-selected');

    if (element && element.classList.contains('cd-chat-bubble')) updateBubblePreview(root);
    if (element && element.classList.contains('cd-blog-text')) initBlogSettingsForm(element, root);
    if (element && element.classList.contains('cd-image-card')) updateImageCardControls(element, root);
    updatePositionSlider(element, root);
}

// ============================================================
// 文本选择监听(文字样式模式)
// ============================================================
function initTextSelectionListener(root) {
    if (_cdSelectionHandler) document.removeEventListener('selectionchange', _cdSelectionHandler);
    _cdSelectionHandler = () => {
        if (_cdIsEditMode) return;
        const sel = window.getSelection();
        const panel = root.querySelector('.cd-text-selection-controls');
        if (!panel) return;
        if (sel.rangeCount > 0 && !sel.isCollapsed) {
            _cdTextRange = sel.getRangeAt(0);
            panel.classList.add('cd-visible');
        } else {
            panel.classList.remove('cd-visible');
        }
    };
    document.addEventListener('selectionchange', _cdSelectionHandler);
}

// ============================================================
// 编辑模式切换
// ============================================================
function initEditModeToggle(root) {
    const btn = root.querySelector('#cdEditModeToggle');
    if (!btn) return;
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleEditMode(root);
    });
}

function toggleEditMode(root) {
    _cdIsEditMode = !_cdIsEditMode;
    applyEditMode(root);
}

/**
 * 把 _cdIsEditMode 落到 DOM 上:按钮文案 + 每个元素的 contentEditable。
 * 编辑模式 = 只能选中/搬动卡片;文字样式模式 = 可以直接改字。
 */
function applyEditMode(root) {
    const btn = root.querySelector('#cdEditModeToggle');
    if (btn) {
        if (_cdIsEditMode) {
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                编辑模式 (点击切换为文字样式模式)
            `;
            const panel = root.querySelector('.cd-text-selection-controls');
            if (panel) panel.classList.remove('cd-visible');
        } else {
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                文字样式模式 (点击切换为编辑模式)
            `;
        }
    }
    const elements = root.querySelectorAll('.cd-text-element, .cd-chat-bubble, .cd-diary-text, .cd-blog-text, .cd-chat-left, .cd-chat-right, .cd-image-card');
    elements.forEach((el) => {
        if (_cdIsEditMode) {
            // 编辑模式：禁止直接编辑文字，只能选中卡片操作
            el.contentEditable = 'false';
            if (el.classList.contains('cd-image-card')) {
                const caption = el.querySelector('.cd-image-caption');
                if (caption) caption.contentEditable = 'false';
            }
            el.classList.add('cd-edit-mode-off');
        } else {
            // 文字样式模式：允许编辑文字内容
            if (el.classList.contains('cd-image-card')) {
                el.contentEditable = 'false';
                const caption = el.querySelector('.cd-image-caption');
                if (caption) caption.contentEditable = 'true';
            } else {
                el.contentEditable = 'true';
            }
            el.classList.remove('cd-edit-mode-off');
        }
    });
    hideFloatingControls(root);
}

// ============================================================
// 文字选择样式应用
// ============================================================
function initTextSelectionControls(root) {
    // selection-style-btn -> applySelectionStyle
    root.querySelectorAll('.cd-selection-style-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const styleMap = {
                '加粗': 'bold', '斜体': 'italic', '下划线': 'underline',
                '模糊': 'blur', '阴影': 'shadow', '发光': 'glow',
            };
            const txt = btn.textContent.trim();
            const style = styleMap[txt];
            if (style) { e.preventDefault(); applySelectionStyle(style); }
        });
    });
    // selection-color-dot -> applySelectionColor
    root.querySelectorAll('.cd-selection-color-dot').forEach((dot) => {
        dot.addEventListener('click', (e) => {
            e.preventDefault();
            const bg = dot.style.backgroundColor || '';
            const color = (bg === 'transparent' || dot.classList.contains('cd-transparent-bg')) ? 'transparent' : bg;
            const inputGroup = dot.parentElement;
            const isBg = inputGroup && inputGroup.previousElementSibling && inputGroup.previousElementSibling.textContent.includes('背景');
            if (isBg) {
                applySelectionBgColor(color);
            } else {
                applySelectionColor(color);
            }
        });
    });
    // selectionBgRadius slider
    const slider = root.querySelector('#cdSelectionBgRadius');
    if (slider) {
        slider.addEventListener('input', () => {
            const out = root.querySelector('#cdSelectionBgRadiusValue');
            if (out) out.textContent = slider.value + 'px';
        });
    }
    // apply button
    const applyBtn = root.querySelector('[data-cd-action="apply-selection-color"]');
    if (applyBtn) {
        applyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            applyCustomSelectionColor(root);
        });
    }
    const input = root.querySelector('#cdCustomSelectionColor');
    if (input) {
        input.addEventListener('input', () => {
            const v = input.value.trim();
            const preview = root.querySelector('#cdCustomSelectionColorPreview');
            if (preview && isValidColor(v)) preview.style.backgroundColor = v;
        });
    }
}

function applySelectionStyle(style) {
    if (!_cdTextRange || _cdTextRange.collapsed) {
        showToast('请先选择文本');
        return;
    }
    const range = window.getSelection().getRangeAt(0);
    let parentNode = range.commonAncestorContainer;
    if (parentNode.nodeType === 3) parentNode = parentNode.parentNode;
    let styleAlreadyApplied = false;
    let currentBlurLevel = 0;

    if (style === 'blur') {
        if (parentNode.classList.contains('cd-blur-effect-1')) { styleAlreadyApplied = true; currentBlurLevel = 1; }
        else if (parentNode.classList.contains('cd-blur-effect-2')) { styleAlreadyApplied = true; currentBlurLevel = 2; }
        else if (parentNode.classList.contains('cd-blur-effect-3')) { styleAlreadyApplied = true; currentBlurLevel = 3; }
        if (styleAlreadyApplied) {
            if (currentBlurLevel < 3) {
                parentNode.classList.remove(`cd-blur-effect-${currentBlurLevel}`);
                parentNode.classList.add(`cd-blur-effect-${currentBlurLevel + 1}`);
            } else {
                parentNode.classList.remove('cd-blur-effect-3');
            }
            return;
        }
    } else {
        switch (style) {
            case 'bold': styleAlreadyApplied = parentNode.style.fontWeight === 'bold'; break;
            case 'italic': styleAlreadyApplied = parentNode.style.fontStyle === 'italic'; break;
            case 'underline': styleAlreadyApplied = parentNode.style.textDecoration === 'underline'; break;
            case 'shadow': styleAlreadyApplied = parentNode.classList.contains('cd-shadow-effect'); break;
            case 'glow': styleAlreadyApplied = parentNode.classList.contains('cd-glow-effect'); break;
        }
        if (styleAlreadyApplied) {
            switch (style) {
                case 'bold': parentNode.style.fontWeight = 'normal'; break;
                case 'italic': parentNode.style.fontStyle = 'normal'; break;
                case 'underline': parentNode.style.textDecoration = 'none'; break;
                case 'shadow': parentNode.classList.remove('cd-shadow-effect'); break;
                case 'glow': parentNode.classList.remove('cd-glow-effect'); break;
            }
            return;
        }
    }

    const span = document.createElement('span');
    switch (style) {
        case 'bold': span.style.fontWeight = 'bold'; break;
        case 'italic': span.style.fontStyle = 'italic'; break;
        case 'underline': span.style.textDecoration = 'underline'; break;
        case 'blur': span.classList.add('cd-blur-effect-1'); break;
        case 'shadow': span.classList.add('cd-shadow-effect'); break;
        case 'glow': span.classList.add('cd-glow-effect'); break;
    }
    try {
        _cdTextRange.surroundContents(span);
        const sel = window.getSelection();
        sel.removeAllRanges();
        const r = document.createRange();
        r.selectNodeContents(span);
        sel.addRange(r);
    } catch (e) {
        showToast('无法应用样式，请尝试选择更简单的文本区域');
    }
}

function applySelectionColor(color) {
    if (!_cdTextRange || _cdTextRange.collapsed) {
        showToast('请先选择文本');
        return;
    }
    const span = document.createElement('span');
    span.style.color = color;
    try {
        _cdTextRange.surroundContents(span);
        const sel = window.getSelection();
        sel.removeAllRanges();
        const r = document.createRange();
        r.selectNodeContents(span);
        sel.addRange(r);
    } catch (e) {
        showToast('无法应用颜色');
    }
}

function applySelectionBgColor(color) {
    if (!_cdTextRange || _cdTextRange.collapsed) {
        showToast('请先选择文本');
        return;
    }
    const span = document.createElement('span');
    span.style.backgroundColor = color;
    const root = document.querySelector('.app-shell[data-app-id="cover-designer"] .cd-root');
    const radiusSlider = root ? root.querySelector('#cdSelectionBgRadius') : null;
    if (color !== 'transparent' && radiusSlider) {
        span.style.padding = '0 3px';
        span.style.borderRadius = radiusSlider.value + 'px';
    }
    try {
        _cdTextRange.surroundContents(span);
        const sel = window.getSelection();
        sel.removeAllRanges();
        const r = document.createRange();
        r.selectNodeContents(span);
        sel.addRange(r);
    } catch (e) {
        showToast('无法应用背景颜色');
    }
}

function applyCustomSelectionColor(root) {
    const input = root.querySelector('#cdCustomSelectionColor');
    if (!input) return;
    const color = input.value.trim();
    if (!isValidColor(color)) { showToast('请输入有效的颜色值'); return; }
    applySelectionColor(color);
}

function isValidColor(color) {
    if (!color) return false;
    if (color === 'transparent') return true;
    const temp = document.createElement('div');
    temp.style.color = '';
    temp.style.color = color;
    return temp.style.color !== '';
}

// ============================================================
// 元素可编辑
// ============================================================
function makeElementsEditable(root) {
    root.querySelectorAll('.cd-text-element, .cd-chat-bubble').forEach((el) => {
        if (el.classList.contains('cd-image-card')) {
            el.contentEditable = 'false';
            const caption = el.querySelector('.cd-image-caption');
            if (caption) caption.contentEditable = 'true';
        } else {
            el.contentEditable = 'true';
        }
        el.addEventListener('focus', () => selectElement(el));
        el.addEventListener('click', (e) => {
            if (_cdIsEditMode) { selectElement(el); showFloatingControls(el, root); e.stopPropagation(); }
        });
    });
}

// ============================================================
// 时间戳编辑
// ============================================================
function initTimeStampEditing(root) {
    const stamp = root.querySelector('.cd-time-stamp');
    if (!stamp) return;
    stamp.addEventListener('click', (e) => {
        e.stopPropagation();
        stamp.contentEditable = 'true';
        stamp.focus();
        const range = document.createRange();
        range.selectNodeContents(stamp);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    });
    stamp.addEventListener('blur', () => { stamp.contentEditable = 'false'; persistState(root); });
    stamp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); stamp.blur(); }
    });
}

// ============================================================
// 模糊度滑块
// ============================================================
function initBlurSlider(root) {
    const slider = root.querySelector('#cdBlurSlider');
    if (!slider) return;
    slider.addEventListener('input', () => adjustBlur(slider.value, root));
}

// ============================================================
// 顶部悬浮快捷工具栏 + 模块化面板渲染

let _currentModuleId = null; // 当前展开的模块 id

// 模块 id → 该模块面板的专属事件绑定器
// (通用的 data-cd-action / data-cd-style 等由 wirePanelActions 统一处理)
const PANEL_WIRERS = {
    'bg': wireBgPanel,
    'text-style': wireTextStylePanel,
    'font': wireFontPanel,
    'text-color': wireTextColorPanel,
    'text-bg': wireTextBgPanel,
    'bubble': wireBubbleStylePanel,
    'blog-setting': wireBlogSettingsPanel,
    'blog-icons': wireBlogIconsPanel,
    'image-card': wireImageCardPanel,
    'position': wirePositionPanel,
};

function getRoot() {
    return document.querySelector('.app-shell[data-app-id="cover-designer"] .cd-root')
        || document.querySelector('.cd-root');
}

// 渲染指定模块的 panel HTML 到 #cdControlsPanel
function renderPanelModule(moduleId) {
    const root = getRoot();
    if (!root) return;
    const panel = root.querySelector('#cdControlsPanel');
    if (!panel) return;
    const mod = TOOLBAR_MODULES.find((m) => m.id === moduleId);
    if (!mod) return;
    panel.innerHTML = mod.panelHtml();
    _currentModuleId = moduleId;
    // panel 展开
    panel.classList.add('cd-panel-open');

    // 每次 render 出来都是全新 DOM,必须重挂事件
    const group = panel.querySelector('.cd-control-group') || panel;
    wirePanelActions(root, panel);
    const wirer = PANEL_WIRERS[moduleId];
    if (typeof wirer === 'function') wirer(root, group);

    // 用当前选中元素回填面板控件,否则滑块/开关全是默认值
    syncPanelWithSelection(moduleId, root);
}

// 收起面板
function closePanel() {
    const root = getRoot();
    if (!root) return;
    const panel = root.querySelector('#cdControlsPanel');
    if (!panel) return;
    panel.innerHTML = '';
    panel.classList.remove('cd-panel-open');
    _currentModuleId = null;
}

// 打开面板时,把当前选中元素的状态回填进控件
function syncPanelWithSelection(moduleId, root) {
    if (moduleId === 'bubble') updateBubblePreview(root);
    if (moduleId === 'blog-setting' && _cdSelected) initBlogSettingsForm(_cdSelected, root);
    if (moduleId === 'image-card' && _cdSelected) updateImageCardControls(_cdSelected, root);
    if (moduleId === 'position') updatePositionSlider(_cdSelected, root);
    if (moduleId === 'bg') syncBgPanel(root);
    if (moduleId === 'text-style' || moduleId === 'font') syncTextMetricsPanel(root);
}

function initToolbar(root) {
    const toolbar = root.querySelector('#cdQuickToolbar');
    if (!toolbar) return;
    const buttons = toolbar.querySelectorAll('.cd-floating-control-btn');
    if (!buttons.length) return;

    // 刷新按钮 active 高亮
    const refreshActive = (activeId) => {
        buttons.forEach((btn) => {
            if (btn.dataset.toolTarget === activeId) {
                btn.classList.add('cd-floating-control-btn--active');
                btn.dataset.active = 'true';
            } else {
                btn.classList.remove('cd-floating-control-btn--active');
                btn.dataset.active = 'false';
            }
        });
    };

    buttons.forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const target = btn.dataset.toolTarget;
            if (!target) return;
            // 点同一个 → 收起;点其他 → 切换
            if (_currentModuleId === target) {
                closePanel();
                refreshActive(null);
            } else {
                renderPanelModule(target);
                refreshActive(target);
            }
        });
    });

    // 默认:面板为空,无高亮
    refreshActive(null);
}

// ============================================================
// 面板内各 action 的事件绑定(每次 renderPanelModule 后调用)
// ============================================================
function wirePanelActions(root, scope) {
    const area = scope || root;

    // data-cd-action 按钮统一分发
    area.querySelectorAll('[data-cd-action]').forEach((btn) => {
        if (btn.dataset.cdActionBound) return;
        btn.dataset.cdActionBound = '1';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handlePanelAction(btn.dataset.cdAction, btn, root);
        });
    });

    // 加粗 / 斜体 / 下划线
    area.querySelectorAll('[data-cd-style]').forEach((btn) => {
        if (btn.dataset.cdStyleBound) return;
        btn.dataset.cdStyleBound = '1';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const t = btn.dataset.cdStyle;
            if (!t) return;
            applyStyle(t, root);
            btn.classList.toggle('cd-active');
            persistState(root);
        });
    });

    // 模糊 / 阴影 / 发光
    area.querySelectorAll('[data-cd-effect]').forEach((btn) => {
        if (btn.dataset.cdEffectBound) return;
        btn.dataset.cdEffectBound = '1';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const t = btn.dataset.cdEffect;
            if (!t) return;
            applyEffect(t, root);
            btn.classList.toggle('cd-active');
            persistState(root);
        });
    });

    // 对齐
    area.querySelectorAll('[data-cd-align]').forEach((btn) => {
        if (btn.dataset.cdAlignBound) return;
        btn.dataset.cdAlignBound = '1';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const align = btn.dataset.cdAlign;
            if (!align) return;
            setTextAlign(align, root);
            persistState(root);
        });
    });

    // 自定义颜色输入框 → 同色块预览(靠 DOM 结构找,不再逐个写 id)
    area.querySelectorAll('.cd-color-input-group, .cd-color-row').forEach((groupEl) => {
        const input = groupEl.querySelector('input[type="text"]');
        const preview = groupEl.querySelector('.cd-color-preview, .cd-color-preview-inline');
        if (!input || !preview || input.dataset.cdPreviewBound) return;
        input.dataset.cdPreviewBound = '1';
        input.addEventListener('input', () => {
            const v = input.value.trim();
            if (isValidColor(v)) preview.style.backgroundColor = v;
        });
    });
}

// ============================================================
// data-cd-action 全局分发表
// ============================================================
function handlePanelAction(action, btn, root) {
    switch (action) {
        // —— 文字类型 ——
        case 'add-text-type': {
            const t = btn.dataset.type;
            if (t) { addText(t, root); persistState(root); }
            break;
        }

        // —— 封面背景 ——
        case 'change-bg':
        case 'upload-bg':
            uploadCustomBackground(root);
            break;
        case 'apply-custom-card-color': {
            const input = root.querySelector('#cdCustomCardColorInput');
            const v = input ? input.value.trim() : '';
            if (!isValidColor(v)) { showToast('请输入有效的颜色值'); break; }
            changeCardColor(v, root);
            persistState(root);
            break;
        }

        // —— 文字样式 ——
        case 'apply-all-text-style':
            applyStyleToAll(root); persistState(root); break;

        // —— 字体 ——
        case 'apply-custom-font': {
            const fontInput = root.querySelector('#cdCustomFontInput');
            const v = fontInput ? fontInput.value.trim() : '';
            if (v) { applyCustomFont(v, root); persistState(root); }
            break;
        }
        case 'apply-all-font':
            applyFontToAll(root); persistState(root); break;

        // —— 文字颜色 ——
        case 'apply-custom-text-color': {
            const input = root.querySelector('#cdCustomTextColorInput');
            const v = input ? input.value.trim() : '';
            if (!isValidColor(v)) { showToast('请输入有效的颜色值'); break; }
            changeColor(v, root); persistState(root);
            break;
        }
        case 'apply-all-text-color':
            applyColorToAll(root); persistState(root); break;

        // —— 文字底色 ——
        case 'apply-custom-bg': {
            const input = root.querySelector('#cdCustomBgColorInput');
            const v = input ? input.value.trim() : '';
            if (!isValidColor(v)) { showToast('请输入有效的颜色值'); break; }
            changeBgColor(v, root); persistState(root);
            break;
        }
        case 'apply-all-text-bg':
            applyBgToAll(root); persistState(root); break;

        // —— 气泡 ——
        case 'apply-custom-border-color': {
            const input = root.querySelector('#cdCustomBorderColorInput');
            const v = input ? input.value.trim() : '';
            if (!isValidColor(v)) { showToast('请输入有效的颜色值'); break; }
            adjustBubbleStyle('borderColor', v, root.querySelector('#cdBubblePreview'));
            break;
        }
        case 'apply-custom-shadow-color': {
            const input = root.querySelector('#cdCustomShadowColorInput');
            const v = input ? input.value.trim() : '';
            if (!isValidColor(v)) { showToast('请输入有效的颜色值'); break; }
            adjustBubbleStyle('shadowColor', v, root.querySelector('#cdBubblePreview'));
            break;
        }
        case 'apply-current-bubble':
            applyBubbleStyle(root); persistState(root); break;
        case 'apply-all-bubble':
            applyBubbleStyleToAll(root); persistState(root); break;

        // —— 博客 ——
        case 'upload-avatar-image':
            uploadAvatarImage(root); break;
        case 'apply-blog-setting':
            applyBlogSettings(root); persistState(root); break;
        case 'apply-all-blog':
            applyBlogSettingsToAll(root); persistState(root); break;
        case 'apply-blog-icons':
            applyBlogIcons(root); persistState(root); break;

        // —— 图片卡片 ——
        case 'upload-image':
            uploadImageForCard(root); break;
        case 'apply-current-image-card':
            applyImageStyle(root); persistState(root); break;
        case 'apply-all-image-card':
            applyImageStyleToAll(root); persistState(root); break;

        // —— 元素位置 ——
        case 'reset-position':
            resetElementPosition(root); persistState(root); break;

        // —— 选区颜色(文字样式模式的浮层) ——
        case 'apply-selection-color':
            applyCustomSelectionColor(root); break;

        // —— 存档 / 历史 ——
        case 'close-archive':
            closeArchivePanel(root); break;
        case 'archive-current':
            archiveCurrentDesign(root); break;
        case 'new-design':
            resetToBlankDesign(root); break;
        default:
            break;
    }
}

// ============================================================
// 各模块面板的专属绑定
// ============================================================

// 滑块 + 数值回显的通用绑定
function bindSlider(scope, sliderId, valueId, onInput, format) {
    const slider = scope.querySelector(`#${sliderId}`);
    if (!slider || slider.dataset.cdRangeBound) return null;
    slider.dataset.cdRangeBound = '1';
    const out = valueId ? scope.querySelector(`#${valueId}`) : null;
    const fmt = format || ((v) => `${v}px`);
    slider.addEventListener('input', () => {
        if (out) out.textContent = fmt(slider.value);
        onInput(slider.value);
    });
    return slider;
}

// 色点组:点哪个高亮哪个,并回调颜色值
function bindColorDots(scope, attrName, onPick) {
    const selector = `[${attrName}]`;
    scope.querySelectorAll(selector).forEach((dot) => {
        if (dot.dataset.cdDotBound) return;
        dot.dataset.cdDotBound = '1';
        dot.addEventListener('click', (e) => {
            e.preventDefault();
            const color = dot.getAttribute(attrName);
            if (!color) return;
            scope.querySelectorAll(selector).forEach((d) => d.classList.remove('cd-selected'));
            dot.classList.add('cd-selected');
            onPick(color);
        });
    });
}

function wireBgPanel(root, group) {
    group.querySelectorAll('.cd-bg-option').forEach((opt) => {
        if (opt.dataset.cdBgBound) return;
        opt.dataset.cdBgBound = '1';
        opt.addEventListener('click', (e) => {
            e.preventDefault();
            const url = opt.dataset.bg || opt.querySelector('img')?.src || '';
            if (!url) return;
            changeCardBg(url, root);
            group.querySelectorAll('.cd-bg-option').forEach((o) => o.classList.remove('cd-selected'));
            opt.classList.add('cd-selected');
            persistState(root);
        });
    });

    bindColorDots(group, 'data-cd-card-color', (color) => {
        changeCardColor(color, root);
        persistState(root);
    });

    bindSlider(group, 'cdBgMask', 'cdBgMaskValue', (v) => {
        changeBgMask(v, root);
        persistState(root);
    }, (v) => String(v));
}

function wireTextStylePanel(root, group) {
    bindSlider(group, 'cdFontSize', 'cdFontSizeValue', (v) => { changeFontSize(v, root); persistState(root); });
    bindSlider(group, 'cdLetterSpacing', 'cdSpacingValue', (v) => { changeLetterSpacing(v, root); persistState(root); });
    bindSlider(group, 'cdLineHeight', 'cdLineHeightValue', (v) => { changeLineHeight(v, root); persistState(root); }, (v) => String(v));
    bindSlider(group, 'cdParagraphSpacing', 'cdParagraphSpacingValue', (v) => { changeParagraphSpacing(v, root); persistState(root); });
}

function wireFontPanel(root, group) {
    group.querySelectorAll('[data-cd-font]').forEach((opt) => {
        if (opt.dataset.cdFontBound) return;
        opt.dataset.cdFontBound = '1';
        opt.addEventListener('click', (e) => {
            e.preventDefault();
            const font = opt.dataset.cdFont;
            if (!font) return;
            changeFont(font, root);
            group.querySelectorAll('[data-cd-font]').forEach((o) => o.classList.remove('cd-selected'));
            opt.classList.add('cd-selected');
            persistState(root);
        });
    });

    const customInput = group.querySelector('#cdCustomFontInput');
    if (customInput && !customInput.dataset.cdFontInputBound) {
        customInput.dataset.cdFontInputBound = '1';
        const apply = () => {
            const v = customInput.value.trim();
            if (v) { applyCustomFont(v, root); persistState(root); }
        };
        customInput.addEventListener('change', apply);
        customInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } });
    }

    bindSlider(group, 'cdFontSizeSlider', 'cdFontSizeDisplay', (v) => { changeFontSize(v, root); persistState(root); });
}

function wireTextColorPanel(root, group) {
    bindColorDots(group, 'data-cd-color', (color) => { changeColor(color, root); persistState(root); });
}

function wireTextBgPanel(root, group) {
    bindColorDots(group, 'data-cd-color', (color) => { changeBgColor(color, root); persistState(root); });
    bindSlider(group, 'cdBgOpacity', 'cdBgOpacityValue', (v) => { changeBgOpacity(v, root); persistState(root); }, (v) => String(v));
}

function wireBlogIconsPanel(root, group) {
    group.querySelectorAll('.cd-icon-selector').forEach((selector) => {
        selector.querySelectorAll('.cd-icon-option').forEach((option) => {
            if (option.dataset.cdIconBound) return;
            option.dataset.cdIconBound = '1';
            option.addEventListener('click', () => {
                selector.querySelectorAll('.cd-icon-option').forEach((o) => o.classList.remove('cd-selected'));
                option.classList.add('cd-selected');
            });
        });
    });
}

function wirePositionPanel(root, group) {
    bindSlider(group, 'cdElementPositionY', 'cdElementPositionYValue', (v) => {
        adjustElementPosition('y', v, root);
        persistState(root);
    });
}

// ============================================================
// 面板回填
// ============================================================
function syncBgPanel(root) {
    const card = root.querySelector('.cd-card');
    if (!card) return;
    const url = card.dataset.cdBgUrl || '';
    root.querySelectorAll('.cd-bg-option').forEach((opt) => {
        const optUrl = opt.dataset.bg || opt.querySelector('img')?.src || '';
        opt.classList.toggle('cd-selected', !!url && optUrl === url);
    });
    const mask = card.dataset.cdBgMask || '0';
    const slider = root.querySelector('#cdBgMask');
    if (slider) slider.value = mask;
    const out = root.querySelector('#cdBgMaskValue');
    if (out) out.textContent = mask;
}

function syncTextMetricsPanel(root) {
    if (!_cdSelected) return;
    const cs = window.getComputedStyle(_cdSelected);
    const setPair = (sliderId, valueId, value, suffix) => {
        const slider = root.querySelector(`#${sliderId}`);
        if (slider) slider.value = value;
        const out = root.querySelector(`#${valueId}`);
        if (out) out.textContent = suffix === null ? String(value) : `${value}${suffix}`;
    };
    setPair('cdFontSize', 'cdFontSizeValue', Math.round(parseFloat(cs.fontSize) || 16), 'px');
    setPair('cdFontSizeSlider', 'cdFontSizeDisplay', Math.round(parseFloat(cs.fontSize) || 16), 'px');
    setPair('cdLetterSpacing', 'cdSpacingValue', (parseFloat(cs.letterSpacing) || 0).toFixed(1), 'px');
    const lh = parseFloat(cs.lineHeight);
    const fs = parseFloat(cs.fontSize) || 16;
    setPair('cdLineHeight', 'cdLineHeightValue', Number.isFinite(lh) ? (lh / fs).toFixed(1) : '1.8', null);
    setPair('cdParagraphSpacing', 'cdParagraphSpacingValue', Math.round(parseFloat(cs.marginTop) || 12), 'px');
}

// ============================================================
// 封面背景 / 底色 / 蒙版
// ============================================================
function applyCardBackground(root) {
    const card = root.querySelector('.cd-card');
    if (!card) return;
    // 没设过就回落到 CSS 里那张默认底图,不能直接写 none,否则封面会变纯色
    const url = card.dataset.cdBgUrl || DEFAULT_BG_URL;
    const mask = parseFloat(card.dataset.cdBgMask || '0') || 0;
    const layers = [];
    // 蒙版是一层纯色渐变,叠在背景图上面把它压暗
    if (mask > 0) {
        layers.push(`linear-gradient(rgba(0,0,0,${mask}), rgba(0,0,0,${mask}))`);
    }
    layers.push(`url('${url}')`);
    card.style.backgroundImage = layers.join(', ');
    card.style.backgroundSize = 'cover';
    card.style.backgroundPosition = 'center';
}

function changeCardColor(color, root) {
    const card = root.querySelector('.cd-card');
    if (!card) return;
    card.style.backgroundColor = color;
    card.dataset.cdCardColor = color;
}

function changeBgMask(value, root) {
    const card = root.querySelector('.cd-card');
    if (!card) return;
    card.dataset.cdBgMask = String(value);
    applyCardBackground(root);
}

// ============================================================
// 元素操作:addText / delete / duplicate / moveUp / moveDown / editStyle
// ============================================================
function addText(type, root) {
    const cardContent = root.querySelector('.cd-card-content');
    if (!cardContent) return;
    let newElement;
    switch (type) {
        case 'diary':
            newElement = document.createElement('div');
            newElement.className = 'cd-text-element cd-diary-text';
            newElement.contentEditable = 'true';
            newElement.textContent = '记录今日心情...';
            break;
        case 'blog':
            newElement = document.createElement('div');
            newElement.className = 'cd-text-element cd-blog-text';
            newElement.contentEditable = 'true';
            newElement.dataset.hasImage = 'true';
            newElement.dataset.showAvatar = 'true';
            newElement.dataset.showLocation = 'true';
            newElement.dataset.blogId = 'blog_' + Date.now();
            newElement.innerHTML = `
                <div class="cd-blog-header">
                    <div class="cd-blog-avatar" data-avatar-type="letter" data-avatar-color="#cbc5bb">U</div>
                    <div class="cd-blog-info">
                        <div class="cd-blog-author">用户名</div>
                        <div class="cd-blog-location">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 2a6 6 0 00-6 6c0 4 6 10 6 10s6-6 6-10a6 6 0 00-6-6z"/>
                                <circle cx="12" cy="8" r="2"/>
                            </svg>
                            添加位置
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
            `;
            break;
        case 'chat-left':
            newElement = document.createElement('div');
            newElement.className = 'cd-text-element cd-chat-bubble cd-chat-left';
            newElement.contentEditable = 'true';
            newElement.textContent = '对话内容...';
            newElement.dataset.bubbleBlur = '8';
            newElement.dataset.bubbleOpacity = '0.3';
            newElement.dataset.borderWidth = '0';
            newElement.dataset.shadow = '0';
            break;
        case 'chat-right':
            newElement = document.createElement('div');
            newElement.className = 'cd-text-element cd-chat-bubble cd-chat-right';
            newElement.contentEditable = 'true';
            newElement.textContent = '回复内容...';
            newElement.dataset.bubbleBlur = '8';
            newElement.dataset.bubbleOpacity = '0.25';
            newElement.dataset.borderWidth = '0';
            newElement.dataset.shadow = '0';
            break;
        case 'image':
            newElement = document.createElement('div');
            newElement.className = 'cd-text-element cd-image-card';
            newElement.contentEditable = 'false';
            newElement.dataset.borderRadius = '12';
            newElement.dataset.opacity = '0.2';
            newElement.innerHTML = `
                <img src="https://images.unsplash.com/photo-1508739773434-c26b3d09e071?q=80&w=1000&auto=format" alt="图片卡片">
                <div class="cd-image-overlay"></div>
                <div class="cd-image-caption" contenteditable="true">这是一张图片，点击此处添加描述</div>
            `;
            break;
    }
    if (!newElement) return;
    cardContent.appendChild(newElement);

    if (type.includes('chat')) {
        const clearDiv = document.createElement('div');
        clearDiv.className = 'cd-clear';
        cardContent.appendChild(clearDiv);
    }

    newElement.addEventListener('click', (e) => {
        if (_cdIsEditMode) { selectElement(newElement); showFloatingControls(newElement, root); e.stopPropagation(); }
    });
    newElement.addEventListener('focus', () => selectElement(newElement));

    selectElement(newElement);
    if (type !== 'image') {
        try { newElement.focus(); } catch (_) {}
    } else {
        const caption = newElement.querySelector('.cd-image-caption');
        if (caption) try { caption.focus(); } catch (_) {}
    }
    newElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function deleteElement(root) {
    hideFloatingControls(root);
    if (_cdContext) {
        if (_cdContext.classList.contains('cd-chat-bubble')) {
            const next = _cdContext.nextElementSibling;
            if (next && next.classList.contains('cd-clear')) next.remove();
        }
        _cdContext.remove();
        _cdContext = null;
        _cdSelected = null;
        persistState(root);
    }
}

function duplicateElement(root) {
    hideFloatingControls(root);
    if (!_cdContext) return;
    const clone = _cdContext.cloneNode(true);
    _cdContext.parentNode.insertBefore(clone, _cdContext.nextSibling);
    if (_cdContext.classList.contains('cd-chat-bubble')) {
        const clearDiv = document.createElement('div');
        clearDiv.className = 'cd-clear';
        clone.parentNode.insertBefore(clearDiv, clone.nextSibling);
    }
    clone.addEventListener('click', (e) => {
        if (_cdIsEditMode) { selectElement(clone); showFloatingControls(clone, root); e.stopPropagation(); }
    });
    clone.addEventListener('focus', () => selectElement(clone));
    selectElement(clone);
    persistState(root);
}

function moveUp(root) {
    hideFloatingControls(root);
    if (!_cdContext) return;
    const prev = _cdContext.previousElementSibling;
    if (prev && !prev.classList.contains('cd-time-stamp')) {
        _cdContext.parentNode.insertBefore(_cdContext, prev);
        if (_cdContext.classList.contains('cd-chat-bubble')) {
            const clearDiv = _cdContext.nextElementSibling;
            if (clearDiv && clearDiv.classList.contains('cd-clear')) {
                _cdContext.parentNode.insertBefore(clearDiv, prev);
            }
        }
    }
    persistState(root);
}

function moveDown(root) {
    hideFloatingControls(root);
    if (!_cdContext) return;
    let next = _cdContext.nextElementSibling;
    if (_cdContext.classList.contains('cd-chat-bubble') && next && next.classList.contains('cd-clear')) {
        next = next.nextElementSibling;
    }
    if (next) {
        if (next.nextElementSibling) {
            _cdContext.parentNode.insertBefore(_cdContext, next.nextElementSibling);
            if (_cdContext.classList.contains('cd-chat-bubble')) {
                const clearDiv = document.createElement('div');
                clearDiv.className = 'cd-clear';
                _cdContext.parentNode.insertBefore(clearDiv, _cdContext.nextElementSibling);
                const oldClear = _cdContext.previousElementSibling;
                if (oldClear && oldClear.classList.contains('cd-clear')) oldClear.remove();
            }
        } else {
            _cdContext.parentNode.appendChild(_cdContext);
            if (_cdContext.classList.contains('cd-chat-bubble')) {
                const clearDiv = document.createElement('div');
                clearDiv.className = 'cd-clear';
                _cdContext.parentNode.appendChild(clearDiv);
                const oldClear = _cdContext.previousElementSibling;
                if (oldClear && oldClear.classList.contains('cd-clear')) oldClear.remove();
            }
        }
    }
    persistState(root);
}

function editStyle(root) {
    hideFloatingControls(root);
    if (!_cdContext) return;

    // 根据选中元素类型，确定应该点击哪个顶部工具栏按钮
    let toolTarget = 'text-style';
    if (_cdContext.classList.contains('cd-chat-bubble')) toolTarget = 'bubble';
    else if (_cdContext.classList.contains('cd-blog-text')) toolTarget = 'blog-setting';
    else if (_cdContext.classList.contains('cd-image-card')) toolTarget = 'image-card';

    // 找到顶部工具栏对应的按钮
    const toolbar = root.querySelector('#cdQuickToolbar');
    if (!toolbar) return;
    const targetBtn = toolbar.querySelector(`[data-tool-target="${toolTarget}"]`);

    if (targetBtn) {
        // 模拟点击，触发 initToolbar 中的事件处理
        targetBtn.click();
        // 滚动到工具面板
        const panel = root.querySelector('#cdControlsPanel');
        if (panel) panel.scrollIntoView({ behavior: 'smooth' });
    }

    // 选中元素后初始化对应的表单/预览
    if (_cdContext.classList.contains('cd-chat-bubble')) updateBubblePreview(root);
    if (_cdContext.classList.contains('cd-blog-text')) initBlogSettingsForm(_cdContext, root);
    if (_cdContext.classList.contains('cd-image-card')) updateImageCardControls(_cdContext, root);
}

// ============================================================
// 样式应用:applyStyle / applyEffect / changeFontSize / changeColor / etc.
// ============================================================
function applyStyle(style, root) {
    if (_cdTextRange && !_cdTextRange.collapsed) {
        const span = document.createElement('span');
        switch (style) {
            case 'bold': span.style.fontWeight = 'bold'; break;
            case 'italic': span.style.fontStyle = 'italic'; break;
            case 'underline': span.style.textDecoration = 'underline'; break;
        }
        try {
            _cdTextRange.surroundContents(span);
            const sel = window.getSelection();
            sel.removeAllRanges();
            const r = document.createRange();
            r.selectNodeContents(span);
            sel.addRange(r);
        } catch (e) { /* ignore */ }
    } else if (_cdSelected) {
        switch (style) {
            case 'bold':
                const w = window.getComputedStyle(_cdSelected).fontWeight;
                _cdSelected.style.fontWeight = (w === '700' || w === 'bold') ? 'normal' : 'bold';
                break;
            case 'italic':
                const s = window.getComputedStyle(_cdSelected).fontStyle;
                _cdSelected.style.fontStyle = s === 'italic' ? 'normal' : 'italic';
                break;
            case 'underline':
                const d = window.getComputedStyle(_cdSelected).textDecoration;
                _cdSelected.style.textDecoration = d.includes('underline') ? 'none' : 'underline';
                break;
        }
    }
}

function applyEffect(effect, root) {
    if (_cdTextRange && !_cdTextRange.collapsed) {
        const span = document.createElement('span');
        if (effect === 'blur') span.classList.add('cd-blur-effect');
        if (effect === 'shadow') span.classList.add('cd-shadow-effect');
        if (effect === 'glow') span.classList.add('cd-glow-effect');
        try {
            _cdTextRange.surroundContents(span);
            const sel = window.getSelection();
            sel.removeAllRanges();
            const r = document.createRange();
            r.selectNodeContents(span);
            sel.addRange(r);
        } catch (e) { /* ignore */ }
    } else if (_cdSelected) {
        if (effect === 'blur') _cdSelected.classList.toggle('cd-blur-effect-1');
        if (effect === 'shadow') _cdSelected.classList.toggle('cd-shadow-effect');
        if (effect === 'glow') _cdSelected.classList.toggle('cd-glow-effect');
    }
}

function changeFontSize(value, root) {
    const out = root.querySelector('#cdFontSizeValue');
    if (out) out.textContent = value + 'px';
    if (_cdSelected) _cdSelected.style.fontSize = value + 'px';
}

function changeLetterSpacing(value, root) {
    const out = root.querySelector('#cdSpacingValue');
    if (out) out.textContent = value + 'px';
    if (_cdSelected) _cdSelected.style.letterSpacing = value + 'px';
}

function changeLineHeight(value, root) {
    const out = root.querySelector('#cdLineHeightValue');
    if (out) out.textContent = value;
    if (_cdSelected) _cdSelected.style.lineHeight = value;
}

function changeParagraphSpacing(value, root) {
    const out = root.querySelector('#cdParagraphSpacingValue');
    if (out) out.textContent = value + 'px';
    if (_cdSelected) {
        _cdSelected.style.marginTop = value + 'px';
        _cdSelected.style.marginBottom = value + 'px';
    }
}

function setTextAlign(align, root) {
    if (_cdSelected) {
        _cdSelected.style.textAlign = align;
        const btns = root.querySelectorAll('.cd-text-align-btn');
        btns.forEach((b) => b.classList.remove('cd-active'));
        const idx = align === 'left' ? 0 : (align === 'center' ? 1 : 2);
        if (btns[idx]) btns[idx].classList.add('cd-active');
    }
}

function changeColor(color, root) {
    if (_cdTextRange && !_cdTextRange.collapsed) {
        const span = document.createElement('span');
        span.style.color = color;
        try {
            _cdTextRange.surroundContents(span);
            const sel = window.getSelection();
            sel.removeAllRanges();
            const r = document.createRange();
            r.selectNodeContents(span);
            sel.addRange(r);
        } catch (e) { /* ignore */ }
    } else if (_cdSelected) {
        _cdSelected.style.color = color;
    }
}

function changeBgColor(color, root) {
    if (_cdTextRange && !_cdTextRange.collapsed) {
        const span = document.createElement('span');
        span.style.backgroundColor = color;
        if (color !== 'transparent') { span.style.padding = '0 3px'; span.style.borderRadius = '3px'; }
        try {
            _cdTextRange.surroundContents(span);
            const sel = window.getSelection();
            sel.removeAllRanges();
            const r = document.createRange();
            r.selectNodeContents(span);
            sel.addRange(r);
        } catch (e) { /* ignore */ }
    } else if (_cdSelected) {
        _cdSelected.style.backgroundColor = color;
        if (_cdSelected.classList.contains('cd-chat-bubble')) {
            if (color === 'transparent') {
                _cdSelected.style.backdropFilter = 'none';
            } else {
                const blur = _cdSelected.dataset.bubbleBlur || 8;
                _cdSelected.style.backdropFilter = `blur(${blur}px)`;
            }
        }
        if (_cdSelected.classList.contains('cd-image-card')) {
            const overlay = _cdSelected.querySelector('.cd-image-overlay');
            if (overlay) {
                const opacity = _cdSelected.dataset.opacity || 0.2;
                if (color === 'transparent') {
                    overlay.style.backgroundColor = 'transparent';
                } else {
                    const tempDiv = document.createElement('div');
                    tempDiv.style.color = color;
                    const computedColor = getComputedStyle(tempDiv).color;
                    const rgbaForm = computedColor.replace(/rgb\(([^)]+)\)/, 'rgba($1,' + opacity + ')');
                    overlay.style.backgroundColor = rgbaForm;
                }
            }
        }
    }
}

function changeBgOpacity(value, root) {
    const out = root.querySelector('#cdBgOpacityValue');
    if (out) out.textContent = value;
    if (_cdSelected) {
        const currentBg = getComputedStyle(_cdSelected).backgroundColor;
        if (currentBg.startsWith('rgba')) {
            const newBg = currentBg.replace(/rgba\(([^,]+,[^,]+,[^,]+),[^)]+\)/, 'rgba($1,' + value + ')');
            _cdSelected.style.backgroundColor = newBg;
        } else if (currentBg.startsWith('rgb')) {
            const newBg = currentBg.replace(/rgb\(([^)]+)\)/, 'rgba($1,' + value + ')');
            _cdSelected.style.backgroundColor = newBg;
        }
        if (_cdSelected.classList.contains('cd-image-card')) {
            _cdSelected.dataset.opacity = value;
            const overlay = _cdSelected.querySelector('.cd-image-overlay');
            if (overlay) {
                const currentColor = getComputedStyle(overlay).backgroundColor;
                if (currentColor.startsWith('rgba')) {
                    const newColor = currentColor.replace(/rgba\(([^,]+,[^,]+,[^,]+),[^)]+\)/, 'rgba($1,' + value + ')');
                    overlay.style.backgroundColor = newColor;
                } else if (currentColor.startsWith('rgb')) {
                    const newColor = currentColor.replace(/rgb\(([^)]+)\)/, 'rgba($1,' + value + ')');
                    overlay.style.backgroundColor = newColor;
                }
            }
        }
    }
}

function changeFont(fontFamily, root) {
    if (_cdSelected) {
        _cdSelected.style.fontFamily = fontFamily;
    }
}

function applyCustomFont(fontCode, root) {
    if (!fontCode) return;
    if (fontCode.includes('@import')) {
        try {
            const style = document.createElement('style');
            style.textContent = fontCode;
            document.head.appendChild(style);
            const m = fontCode.match(/font-family\s*:\s*["']([^"']+)["']/);
            if (m && m[1]) {
                if (_cdSelected) _cdSelected.style.fontFamily = m[1];
                showToast(`已应用字体: ${m[1]}`);
            } else {
                showToast('已添加字体，但无法自动应用，请手动在下方选择');
            }
        } catch (e) {
            showToast('字体代码格式错误');
        }
    } else {
        if (_cdSelected) {
            _cdSelected.style.fontFamily = fontCode;
            showToast(`已应用字体: ${fontCode}`);
        }
    }
}

function adjustBlur(value, root) {
    const card = root.querySelector('.cd-card-content');
    if (card) {
        card.style.backdropFilter = `blur(${value}px)`;
        card.style.webkitBackdropFilter = `blur(${value}px)`;
    }
    const out = root.querySelector('#cdBlurValue');
    if (out) out.textContent = `${value}px`;
}

// ============================================================
// 应用到所有
// ============================================================
function applyStyleToAll(root) {
    if (!_cdSelected) { showToast('请先选择一个元素'); return; }
    let t = '';
    if (_cdSelected.classList.contains('cd-diary-text')) t = 'cd-diary-text';
    else if (_cdSelected.classList.contains('cd-blog-text')) t = 'cd-blog-text';
    else if (_cdSelected.classList.contains('cd-chat-left')) t = 'cd-chat-left';
    else if (_cdSelected.classList.contains('cd-chat-right')) t = 'cd-chat-right';
    else if (_cdSelected.classList.contains('cd-image-card')) t = 'cd-image-card';
    else return;
    const els = root.querySelectorAll(`.${t}`);
    if (els.length <= 1) { showToast('没有其他相同类型的元素'); return; }
    const styles = {
        fontWeight: _cdSelected.style.fontWeight,
        fontStyle: _cdSelected.style.fontStyle,
        textDecoration: _cdSelected.style.textDecoration,
        letterSpacing: _cdSelected.style.letterSpacing,
        lineHeight: _cdSelected.style.lineHeight,
        marginTop: _cdSelected.style.marginTop,
        marginBottom: _cdSelected.style.marginBottom,
        textAlign: _cdSelected.style.textAlign
    };
    const classList = Array.from(_cdSelected.classList);
    els.forEach((el) => {
        if (el === _cdSelected) return;
        for (const [k, v] of Object.entries(styles)) { if (v) el.style[k] = v; }
        ['cd-blur-effect-1', 'cd-blur-effect-2', 'cd-blur-effect-3', 'cd-shadow-effect', 'cd-glow-effect'].forEach((cls) => {
            el.classList.remove(cls);
            if (classList.includes(cls)) el.classList.add(cls);
        });
    });
    showToast(`已应用样式到 ${els.length - 1} 个元素`);
}

function applyColorToAll(root) {
    if (!_cdSelected) { showToast('请先选择一个元素'); return; }
    let t = '';
    if (_cdSelected.classList.contains('cd-diary-text')) t = 'cd-diary-text';
    else if (_cdSelected.classList.contains('cd-blog-text')) t = 'cd-blog-text';
    else if (_cdSelected.classList.contains('cd-chat-left')) t = 'cd-chat-left';
    else if (_cdSelected.classList.contains('cd-chat-right')) t = 'cd-chat-right';
    else if (_cdSelected.classList.contains('cd-image-card')) t = 'cd-image-card';
    else return;
    const els = root.querySelectorAll(`.${t}`);
    if (els.length <= 1) { showToast('没有其他相同类型的元素'); return; }
    const currentColor = _cdSelected.style.color;
    if (!currentColor) { showToast('当前元素没有设置颜色'); return; }
    els.forEach((el) => { if (el !== _cdSelected) el.style.color = currentColor; });
    showToast(`已应用颜色到 ${els.length - 1} 个元素`);
}

function applyBgToAll(root) {
    if (!_cdSelected) { showToast('请先选择一个元素'); return; }
    let t = '';
    if (_cdSelected.classList.contains('cd-diary-text')) t = 'cd-diary-text';
    else if (_cdSelected.classList.contains('cd-blog-text')) t = 'cd-blog-text';
    else if (_cdSelected.classList.contains('cd-chat-left')) t = 'cd-chat-left';
    else if (_cdSelected.classList.contains('cd-chat-right')) t = 'cd-chat-right';
    else if (_cdSelected.classList.contains('cd-image-card')) t = 'cd-image-card';
    else return;
    const els = root.querySelectorAll(`.${t}`);
    if (els.length <= 1) { showToast('没有其他相同类型的元素'); return; }
    const currentBg = _cdSelected.style.backgroundColor;
    if (!currentBg) { showToast('当前元素没有设置背景颜色'); return; }
    els.forEach((el) => {
        if (el === _cdSelected) return;
        el.style.backgroundColor = currentBg;
        if (el.classList.contains('cd-chat-bubble')) {
            const opacity = _cdSelected.dataset.bubbleOpacity;
            if (opacity) el.dataset.bubbleOpacity = opacity;
            const blur = _cdSelected.dataset.bubbleBlur;
            if (blur) {
                el.dataset.bubbleBlur = blur;
                el.style.backdropFilter = `blur(${blur}px)`;
            }
        }
        if (el.classList.contains('cd-image-card')) {
            const overlay = el.querySelector('.cd-image-overlay');
            const selectedOverlay = _cdSelected.querySelector('.cd-image-overlay');
            if (overlay && selectedOverlay) overlay.style.backgroundColor = selectedOverlay.style.backgroundColor;
            const opacity = _cdSelected.dataset.opacity;
            if (opacity) el.dataset.opacity = opacity;
        }
    });
    showToast(`已应用背景到 ${els.length - 1} 个元素`);
}

function applyFontToAll(root) {
    if (!_cdSelected) { showToast('请先选择一个元素'); return; }
    const currentFont = _cdSelected.style.fontFamily;
    if (!currentFont) { showToast('当前元素没有设置字体'); return; }
    const elements = root.querySelectorAll('.cd-text-element');
    elements.forEach((el) => {
        if (el !== _cdSelected) el.style.fontFamily = currentFont;
    });
    showToast(`已应用字体到 ${elements.length - 1} 个元素`);
}

// ============================================================
// 气泡样式面板
// ============================================================
// 注:所有 [data-cd-action] 按钮由 handlePanelAction 统一接管,
// 这里只绑滑块 / 开关 / 色点这类没有 action 语义的控件,否则会重复触发。
function wireBubbleStylePanel(root, group) {
    const preview = group.querySelector('#cdBubblePreview');
    const bubbleRadius = group.querySelector('#cdBubbleRadius');
    const topLeftRadius = group.querySelector('#cdTopLeftRadius');
    const topRightRadius = group.querySelector('#cdTopRightRadius');
    const bottomRightRadius = group.querySelector('#cdBottomRightRadius');
    const bottomLeftRadius = group.querySelector('#cdBottomLeftRadius');
    const borderWidth = group.querySelector('#cdBorderWidth');
    const borderToggle = group.querySelector('#cdBorderToggle');
    const shadowIntensity = group.querySelector('#cdShadowIntensity');
    const shadowToggle = group.querySelector('#cdShadowToggle');
    const uniformRadiusToggle = group.querySelector('#cdUniformRadiusToggle');

    bindSlider(group, 'cdBubbleBlur', 'cdBubbleBlurValue', (v) => adjustBubbleStyle('blur', v, preview));
    bindSlider(group, 'cdBubbleOpacity', 'cdBubbleOpacityValue', (v) => adjustBubbleStyle('opacity', v, preview), (v) => String(v));
    bindSlider(group, 'cdBubbleRadius', 'cdBubbleRadiusValue', (v) => adjustBubbleStyle('radius', v, preview));
    bindSlider(group, 'cdTopLeftRadius', 'cdTopLeftRadiusValue', (v) => adjustBubbleStyle('topLeftRadius', v, preview));
    bindSlider(group, 'cdTopRightRadius', 'cdTopRightRadiusValue', (v) => adjustBubbleStyle('topRightRadius', v, preview));
    bindSlider(group, 'cdBottomRightRadius', 'cdBottomRightRadiusValue', (v) => adjustBubbleStyle('bottomRightRadius', v, preview));
    bindSlider(group, 'cdBottomLeftRadius', 'cdBottomLeftRadiusValue', (v) => adjustBubbleStyle('bottomLeftRadius', v, preview));
    bindSlider(group, 'cdBorderWidth', 'cdBorderWidthValue', (v) => adjustBubbleStyle('borderWidth', v, preview));
    bindSlider(group, 'cdShadowIntensity', 'cdShadowIntensityValue', (v) => adjustBubbleStyle('shadowIntensity', v, preview));

    if (uniformRadiusToggle) {
        uniformRadiusToggle.addEventListener('change', () => {
            const checked = uniformRadiusToggle.checked;
            const u = group.querySelector('#cdUniformRadiusControls');
            const c = group.querySelector('#cdCustomRadiusControls');
            if (u) u.style.display = checked ? 'block' : 'none';
            if (c) c.style.display = checked ? 'none' : 'block';
            if (checked && bubbleRadius && preview) {
                preview.style.borderRadius = `${bubbleRadius.value}px`;
            } else if (topLeftRadius && preview) {
                preview.style.borderRadius = `${topLeftRadius.value}px ${topRightRadius.value}px ${bottomRightRadius.value}px ${bottomLeftRadius.value}px`;
            }
        });
    }
    if (borderToggle) {
        borderToggle.addEventListener('change', () => {
            const controls = group.querySelector('#cdBorderControls');
            if (controls) controls.style.display = borderToggle.checked ? 'block' : 'none';
            if (borderToggle.checked && preview && borderWidth) {
                const color = preview.dataset.borderColor || '#9b958b';
                preview.style.border = `${borderWidth.value}px solid ${color}`;
            } else if (preview) {
                preview.style.border = 'none';
            }
        });
    }
    if (shadowToggle) {
        shadowToggle.addEventListener('change', () => {
            const controls = group.querySelector('#cdShadowControls');
            if (controls) controls.style.display = shadowToggle.checked ? 'block' : 'none';
            if (shadowToggle.checked && preview && shadowIntensity) {
                const shadowColor = preview.dataset.shadowColor || 'rgba(0,0,0,0.1)';
                preview.style.boxShadow = `0 ${shadowIntensity.value / 2}px ${shadowIntensity.value}px ${shadowColor}`;
            } else if (preview) {
                preview.style.boxShadow = 'none';
            }
        });
    }

    // 边框色点和阴影色点靠各自的 data-* 属性区分,不能一把全选
    const borderBlock = group.querySelector('#cdBorderControls');
    if (borderBlock) {
        bindColorDots(borderBlock, 'data-cd-border-color', (color) => adjustBubbleStyle('borderColor', color, preview));
    }
    const shadowBlock = group.querySelector('#cdShadowControls');
    if (shadowBlock) {
        bindColorDots(shadowBlock, 'data-cd-shadow-color', (color) => adjustBubbleStyle('shadowColor', color, preview));
    }
}

function adjustBubbleStyle(property, value, preview) {
    if (!preview) return;
    switch (property) {
        case 'blur':
            preview.style.backdropFilter = `blur(${value}px)`;
            preview.style.webkitBackdropFilter = `blur(${value}px)`;
            break;
        case 'opacity': {
            let color = preview.style.backgroundColor;
            color = color.replace(/[\d.]+(?=\))/, value);
            preview.style.backgroundColor = color;
            break;
        }
        case 'radius': preview.style.borderRadius = value + 'px'; break;
        case 'topLeftRadius': {
            const cur = preview.style.borderRadius.split(' ');
            cur[0] = value + 'px';
            preview.style.borderRadius = cur.join(' ');
            break;
        }
        case 'topRightRadius': {
            const cur = preview.style.borderRadius.split(' ');
            cur[1] = value + 'px';
            preview.style.borderRadius = cur.join(' ');
            break;
        }
        case 'bottomRightRadius': {
            const cur = preview.style.borderRadius.split(' ');
            cur[2] = value + 'px';
            preview.style.borderRadius = cur.join(' ');
            break;
        }
        case 'bottomLeftRadius': {
            const cur = preview.style.borderRadius.split(' ');
            cur[3] = value + 'px';
            preview.style.borderRadius = cur.join(' ');
            break;
        }
        case 'borderWidth': preview.style.borderWidth = value + 'px'; break;
        case 'borderColor':
            preview.dataset.borderColor = value;
            preview.style.borderColor = value;
            if (!preview.style.borderStyle) preview.style.borderStyle = 'solid';
            break;
        case 'shadowIntensity': {
            const shadowColor = preview.dataset.shadowColor || 'rgba(0,0,0,0.1)';
            preview.style.boxShadow = `0 ${value / 2}px ${value}px ${shadowColor}`;
            break;
        }
        case 'shadowColor': {
            preview.dataset.shadowColor = value;
            const intensity = preview.querySelector ? null : null;
            const allControls = preview.closest('.cd-root');
            const intensityInput = allControls ? allControls.querySelector('#cdShadowIntensity') : null;
            const v = intensityInput ? intensityInput.value : 8;
            preview.style.boxShadow = `0 ${v / 2}px ${v}px ${value}`;
            break;
        }
    }
    // 更新 value displays
    const root = preview.closest('.cd-root');
    if (root) {
        const map = { 'blur': '#cdBubbleBlurValue', 'opacity': '#cdBubbleOpacityValue', 'radius': '#cdBubbleRadiusValue',
            'topLeftRadius': '#cdTopLeftRadiusValue', 'topRightRadius': '#cdTopRightRadiusValue',
            'bottomRightRadius': '#cdBottomRightRadiusValue', 'bottomLeftRadius': '#cdBottomLeftRadiusValue',
            'borderWidth': '#cdBorderWidthValue', 'shadowIntensity': '#cdShadowIntensityValue' };
        const out = root.querySelector(map[property]);
        if (out) out.textContent = value + (property === 'opacity' ? '' : 'px');
    }
}

function updateBubblePreview(root) {
    if (!_cdSelected || !_cdSelected.classList.contains('cd-chat-bubble')) return;
    const preview = root.querySelector('#cdBubblePreview');
    if (!preview) return;
    const bubble = _cdSelected;
    const bubbleBlur = bubble.dataset.bubbleBlur || '8';
    const bubbleOpacity = bubble.dataset.bubbleOpacity || '0.3';
    const borderWidth = bubble.dataset.borderWidth || '0';
    const borderColor = bubble.dataset.borderColor || '#9b958b';
    const shadowIntensity = bubble.dataset.shadow || '0';
    const shadowColor = bubble.dataset.shadowColor || 'rgba(0,0,0,0.1)';
    const bubbleRadius = getComputedStyle(bubble).borderRadius || '18px';
    const bubbleRadiusValue = parseInt(bubbleRadius) || 18;
    const br = root.querySelector('#cdBubbleRadius'); if (br) br.value = bubbleRadiusValue;
    const brv = root.querySelector('#cdBubbleRadiusValue'); if (brv) brv.textContent = bubbleRadiusValue + 'px';
    root.querySelectorAll('#cdTopLeftRadius, #cdTopRightRadius, #cdBottomRightRadius').forEach((el) => { el.value = bubbleRadiusValue; });
    root.querySelectorAll('#cdTopLeftRadiusValue, #cdTopRightRadiusValue, #cdBottomRightRadiusValue').forEach((el) => { el.textContent = bubbleRadiusValue + 'px'; });
    const bottomLeftValue = bubble.classList.contains('cd-chat-left') ? 6 : bubbleRadiusValue;
    const blr = root.querySelector('#cdBottomLeftRadius'); if (blr) blr.value = bottomLeftValue;
    const blrv = root.querySelector('#cdBottomLeftRadiusValue'); if (blrv) blrv.textContent = bottomLeftValue + 'px';
    preview.style.backdropFilter = `blur(${bubbleBlur}px)`;
    preview.style.webkitBackdropFilter = `blur(${bubbleBlur}px)`;
    let bgColor = bubble.classList.contains('cd-chat-left') ? 'rgba(223,230,233,' + bubbleOpacity + ')' : 'rgba(189,195,199,' + bubbleOpacity + ')';
    preview.style.backgroundColor = bgColor;
    preview.style.borderRadius = bubbleRadius;
    if (borderWidth !== '0') preview.style.border = `${borderWidth}px solid ${borderColor}`;
    else preview.style.border = 'none';
    if (shadowIntensity !== '0') preview.style.boxShadow = `0 ${shadowIntensity / 2}px ${shadowIntensity}px ${shadowColor}`;
    else preview.style.boxShadow = 'none';

    const bb = root.querySelector('#cdBubbleBlur'); if (bb) bb.value = bubbleBlur;
    const bbv = root.querySelector('#cdBubbleBlurValue'); if (bbv) bbv.textContent = bubbleBlur + 'px';
    const bo = root.querySelector('#cdBubbleOpacity'); if (bo) bo.value = bubbleOpacity;
    const bov = root.querySelector('#cdBubbleOpacityValue'); if (bov) bov.textContent = bubbleOpacity;
    const bt = root.querySelector('#cdBorderToggle'); if (bt) bt.checked = borderWidth !== '0';
    const bc = root.querySelector('#cdBorderControls'); if (bc) bc.style.display = borderWidth !== '0' ? 'block' : 'none';
    if (borderWidth !== '0') {
        const bw = root.querySelector('#cdBorderWidth'); if (bw) bw.value = borderWidth;
        const bwv = root.querySelector('#cdBorderWidthValue'); if (bwv) bwv.textContent = borderWidth + 'px';
    }
    const st = root.querySelector('#cdShadowToggle'); if (st) st.checked = shadowIntensity !== '0';
    const sc = root.querySelector('#cdShadowControls'); if (sc) sc.style.display = shadowIntensity !== '0' ? 'block' : 'none';
    if (shadowIntensity !== '0') {
        const si = root.querySelector('#cdShadowIntensity'); if (si) si.value = shadowIntensity;
        const siv = root.querySelector('#cdShadowIntensityValue'); if (siv) siv.textContent = shadowIntensity + 'px';
    }
}

function applyBubbleStyle(root) {
    if (!_cdSelected || !_cdSelected.classList.contains('cd-chat-bubble')) { showToast('请先选择一个聊天气泡'); return; }
    const preview = root.querySelector('#cdBubblePreview');
    const bubble = _cdSelected;
    const blurMatch = (preview.style.backdropFilter || '').match(/blur\((\d+)px\)/);
    const bubbleBlur = blurMatch ? blurMatch[1] : '8';
    const opacityMatch = (preview.style.backgroundColor || '').match(/rgba\([^,]+,[^,]+,[^,]+,([^)]+)\)/);
    const bubbleOpacity = opacityMatch ? opacityMatch[1] : '0.3';
    const borderWidth = (preview.style.borderWidth || '').replace('px', '') || '0';
    const borderColor = preview.style.borderColor || '#9b958b';
    const shadowMatch = (preview.style.boxShadow || '').match(/0\s+[\d.]+px\s+([\d.]+)px/);
    const shadowIntensity = shadowMatch ? shadowMatch[1] : '0';
    const shadowColor = preview.dataset.shadowColor || 'rgba(0,0,0,0.1)';
    const bubbleRadius = preview.style.borderRadius;
    bubble.style.backdropFilter = `blur(${bubbleBlur}px)`;
    bubble.style.webkitBackdropFilter = `blur(${bubbleBlur}px)`;
    let bgColor;
    if (bubble.classList.contains('cd-chat-left')) bgColor = `rgba(223,230,233,${bubbleOpacity})`;
    else bgColor = `rgba(189,195,199,${bubbleOpacity})`;
    bubble.style.backgroundColor = bgColor;
    bubble.style.borderRadius = bubbleRadius;
    if (borderWidth !== '0') bubble.style.border = `${borderWidth}px solid ${borderColor}`;
    else bubble.style.border = 'none';
    if (shadowIntensity !== '0') bubble.style.boxShadow = `0 ${shadowIntensity / 2}px ${shadowIntensity}px ${shadowColor}`;
    else bubble.style.boxShadow = 'none';
    bubble.dataset.bubbleBlur = bubbleBlur;
    bubble.dataset.bubbleOpacity = bubbleOpacity;
    bubble.dataset.borderWidth = borderWidth;
    bubble.dataset.borderColor = borderColor;
    bubble.dataset.shadow = shadowIntensity;
    bubble.dataset.shadowColor = shadowColor;
    showToast('样式已应用');
}

function applyBubbleStyleToAll(root) {
    const preview = root.querySelector('#cdBubblePreview');
    if (!preview) return;
    const bubbles = root.querySelectorAll('.cd-chat-bubble');
    if (bubbles.length === 0) { showToast('没有找到聊天气泡'); return; }
    const blurMatch = (preview.style.backdropFilter || '').match(/blur\((\d+)px\)/);
    const bubbleBlur = blurMatch ? blurMatch[1] : '8';
    const opacityMatch = (preview.style.backgroundColor || '').match(/rgba\([^,]+,[^,]+,[^,]+,([^)]+)\)/);
    const bubbleOpacity = opacityMatch ? opacityMatch[1] : '0.3';
    const borderWidth = (preview.style.borderWidth || '').replace('px', '') || '0';
    const borderColor = preview.style.borderColor || '#9b958b';
    const shadowMatch = (preview.style.boxShadow || '').match(/0\s+[\d.]+px\s+([\d.]+)px/);
    const shadowIntensity = shadowMatch ? shadowMatch[1] : '0';
    const shadowColor = preview.dataset.shadowColor || 'rgba(0,0,0,0.1)';
    const bubbleRadius = preview.style.borderRadius;
    bubbles.forEach((bubble) => {
        bubble.style.backdropFilter = `blur(${bubbleBlur}px)`;
        bubble.style.webkitBackdropFilter = `blur(${bubbleBlur}px)`;
        let bgColor;
        if (bubble.classList.contains('cd-chat-left')) bgColor = `rgba(223,230,233,${bubbleOpacity})`;
        else bgColor = `rgba(189,195,199,${bubbleOpacity})`;
        bubble.style.backgroundColor = bgColor;
        bubble.style.borderRadius = bubbleRadius;
        if (borderWidth !== '0') bubble.style.border = `${borderWidth}px solid ${borderColor}`;
        else bubble.style.border = 'none';
        if (shadowIntensity !== '0') bubble.style.boxShadow = `0 ${shadowIntensity / 2}px ${shadowIntensity}px ${shadowColor}`;
        else bubble.style.boxShadow = 'none';
        bubble.dataset.bubbleBlur = bubbleBlur;
        bubble.dataset.bubbleOpacity = bubbleOpacity;
        bubble.dataset.borderWidth = borderWidth;
        bubble.dataset.borderColor = borderColor;
        bubble.dataset.shadow = shadowIntensity;
        bubble.dataset.shadowColor = shadowColor;
    });
    showToast(`已应用样式到 ${bubbles.length} 个气泡`);
}

// ============================================================
// 博客设置面板
// ============================================================
function wireBlogSettingsPanel(root, group) {
    const imageToggle = group.querySelector('#cdBlogImageToggle');
    const avatarToggle = group.querySelector('#cdBlogAvatarToggle');
    const locationToggle = group.querySelector('#cdBlogLocationToggle');

    if (imageToggle) imageToggle.addEventListener('change', () => { toggleBlogImage(imageToggle.checked); persistState(root); });
    if (avatarToggle) avatarToggle.addEventListener('change', () => { toggleBlogAvatar(avatarToggle.checked); persistState(root); });
    if (locationToggle) locationToggle.addEventListener('change', () => { toggleBlogLocation(locationToggle.checked); persistState(root); });

    // 头像类型:字母 / 上传图片 —— 切换时只显示对应那组控件
    group.querySelectorAll('input[name="cdAvatarType"]').forEach((radio) => {
        radio.addEventListener('change', () => {
            if (!radio.checked) return;
            changeAvatarType(radio.value, root);
        });
    });

    // 头像底色色板
    group.querySelectorAll('.cd-avatar-color').forEach((dot) => {
        if (dot.dataset.cdAvatarBound) return;
        dot.dataset.cdAvatarBound = '1';
        dot.addEventListener('click', () => {
            group.querySelectorAll('.cd-avatar-color').forEach((d) => d.classList.remove('cd-selected'));
            dot.classList.add('cd-selected');
            const preview = group.querySelector('#cdAvatarLetterPreview');
            if (preview && dot.dataset.color) preview.style.backgroundColor = dot.dataset.color;
        });
    });

    // 文本框边打边同步到画布,不用每次都点「应用博客设置」
    bindLiveInput(group, '#cdBlogAuthorInput', (v) => {
        const el = currentBlog()?.querySelector('.cd-blog-author');
        if (el) el.textContent = v;
    }, root);
    bindLiveInput(group, '#cdBlogLocationInput', (v) => {
        const el = currentBlog()?.querySelector('.cd-blog-location');
        if (el) el.innerHTML = `${LOCATION_PIN_SVG} ${escapeText(v)}`;
    }, root);
    bindLiveInput(group, '#cdBlogIdInput', (v) => {
        const blog = currentBlog();
        if (blog) blog.dataset.blogId = v;
    }, root);
    bindLiveInput(group, '#cdAvatarLetterInput', (v) => {
        const avatar = currentBlog()?.querySelector('.cd-blog-avatar');
        if (avatar && avatar.dataset.avatarType !== 'image') avatar.textContent = v;
        const preview = group.querySelector('#cdAvatarLetterPreview');
        if (preview) preview.textContent = v || 'H';
    }, root);
}

const LOCATION_PIN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a6 6 0 00-6 6c0 4 6 10 6 10s6-6 6-10a6 6 0 00-6-6z"/><circle cx="12" cy="8" r="2"/></svg>';

function currentBlog() {
    return (_cdSelected && _cdSelected.classList.contains('cd-blog-text')) ? _cdSelected : null;
}

function bindLiveInput(scope, selector, onInput, root) {
    const input = scope.querySelector(selector);
    if (!input || input.dataset.cdLiveBound) return;
    input.dataset.cdLiveBound = '1';
    input.addEventListener('input', () => {
        onInput(input.value);
        persistState(root);
    });
}

function changeAvatarType(type, root) {
    const scope = root.querySelector('#cdControlsPanel') || root;
    const letterCtl = scope.querySelector('#cdAvatarLetterControls');
    const imgCtl = scope.querySelector('#cdAvatarImageControls');
    if (letterCtl) letterCtl.style.display = type === 'letter' ? 'block' : 'none';
    if (imgCtl) imgCtl.style.display = type === 'image' ? 'block' : 'none';
}

function toggleBlogImage(show) {
    if (!_cdSelected || !_cdSelected.classList.contains('cd-blog-text')) return;
    const imgPreview = _cdSelected.querySelector('.cd-blog-img-preview');
    if (imgPreview) imgPreview.style.display = show ? 'flex' : 'none';
    _cdSelected.dataset.hasImage = show.toString();
}

function toggleBlogAvatar(show) {
    if (!_cdSelected || !_cdSelected.classList.contains('cd-blog-text')) return;
    const avatar = _cdSelected.querySelector('.cd-blog-avatar');
    if (avatar) avatar.style.display = show ? 'flex' : 'none';
    _cdSelected.dataset.showAvatar = show.toString();
}

function toggleBlogLocation(show) {
    if (!_cdSelected || !_cdSelected.classList.contains('cd-blog-text')) return;
    const loc = _cdSelected.querySelector('.cd-blog-location');
    if (loc) loc.style.display = show ? 'flex' : 'none';
    _cdSelected.dataset.showLocation = show.toString();
}

function initBlogSettingsForm(blogElement, root) {
    if (!blogElement || !blogElement.classList.contains('cd-blog-text')) return;
    const hasImage = blogElement.dataset.hasImage === 'true';
    const showAvatar = blogElement.dataset.showAvatar === 'true';
    const showLocation = blogElement.dataset.showLocation === 'true';
    const blogId = blogElement.dataset.blogId || '';
    const locEl = blogElement.querySelector('.cd-blog-location');
    const loc = locEl ? locEl.textContent.trim() : '';
    const authorEl = blogElement.querySelector('.cd-blog-author');
    const author = authorEl ? authorEl.textContent.trim() : '';
    const avatarEl = blogElement.querySelector('.cd-blog-avatar');
    let avatarType = 'letter';
    let avatarColor = '#cbc5bb';
    let avatarLetter = '';
    if (avatarEl) {
        avatarType = avatarEl.dataset.avatarType || 'letter';
        avatarColor = avatarEl.dataset.avatarColor || '#cbc5bb';
        avatarLetter = avatarEl.textContent.trim();
    }
    const imgT = root.querySelector('#cdBlogImageToggle'); if (imgT) imgT.checked = hasImage;
    const avaT = root.querySelector('#cdBlogAvatarToggle'); if (avaT) avaT.checked = showAvatar;
    const locT = root.querySelector('#cdBlogLocationToggle'); if (locT) locT.checked = showLocation;
    const idI = root.querySelector('#cdBlogIdInput'); if (idI) idI.value = blogId;
    const locI = root.querySelector('#cdBlogLocationInput'); if (locI) locI.value = loc;
    const authI = root.querySelector('#cdBlogAuthorInput'); if (authI) authI.value = author;
    const al = root.querySelector('#cdAvatarLetterInput'); if (al) al.value = avatarLetter;
    const at = root.querySelector(`input[name="cdAvatarType"][value="${avatarType}"]`); if (at) at.checked = true;
    const ap = root.querySelector('#cdAvatarLetterPreview'); if (ap) ap.style.backgroundColor = avatarColor;
    root.querySelectorAll('.cd-avatar-color').forEach((c) => {
        c.classList.remove('cd-selected');
        if (c.dataset.color === avatarColor) c.classList.add('cd-selected');
    });
    const letterCtl = root.querySelector('#cdAvatarLetterControls');
    const imgCtl = root.querySelector('#cdAvatarImageControls');
    if (letterCtl) letterCtl.style.display = avatarType === 'letter' ? 'block' : 'none';
    if (imgCtl) imgCtl.style.display = avatarType === 'image' ? 'block' : 'none';
    toggleBlogImage(hasImage);
    toggleBlogAvatar(showAvatar);
    toggleBlogLocation(showLocation);
}

function applyBlogSettings(root) {
    if (!_cdSelected || !_cdSelected.classList.contains('cd-blog-text')) { alert('请先选择一个博客元素'); return; }
    const imgT = root.querySelector('#cdBlogImageToggle');
    const avaT = root.querySelector('#cdBlogAvatarToggle');
    const locT = root.querySelector('#cdBlogLocationToggle');
    const idI = root.querySelector('#cdBlogIdInput');
    const locI = root.querySelector('#cdBlogLocationInput');
    const authI = root.querySelector('#cdBlogAuthorInput');
    const aT = root.querySelector('input[name="cdAvatarType"]:checked');
    const aL = root.querySelector('#cdAvatarLetterInput');
    const hasImage = imgT ? imgT.checked : false;
    const showAvatar = avaT ? avaT.checked : false;
    const showLocation = locT ? locT.checked : false;
    const blogId = idI ? idI.value : '';
    const location = locI ? locI.value : '';
    const author = authI ? authI.value : '';
    const avatarType = aT ? aT.value : 'letter';
    const avatarLetter = aL ? aL.value : '';
    _cdSelected.dataset.hasImage = hasImage.toString();
    _cdSelected.dataset.showAvatar = showAvatar.toString();
    _cdSelected.dataset.showLocation = showLocation.toString();
    _cdSelected.dataset.blogId = blogId;
    toggleBlogImage(hasImage);
    toggleBlogAvatar(showAvatar);
    toggleBlogLocation(showLocation);
    const locEl = _cdSelected.querySelector('.cd-blog-location');
    if (locEl) locEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a6 6 0 00-6 6c0 4 6 10 6 10s6-6 6-10a6 6 0 00-6-6z"/><circle cx="12" cy="8" r="2"/></svg> ${location}`;
    const authorEl = _cdSelected.querySelector('.cd-blog-author');
    if (authorEl) authorEl.textContent = author;
    const avatarEl = _cdSelected.querySelector('.cd-blog-avatar');
    if (avatarEl) {
        avatarEl.dataset.avatarType = avatarType;
        if (avatarType === 'letter') {
            avatarEl.textContent = avatarLetter;
            const selectedColorDot = root.querySelector('.cd-avatar-color.cd-selected');
            let avatarColor;
            if (selectedColorDot) avatarColor = selectedColorDot.dataset.color;
            else {
                const customColor = root.querySelector('#cdCustomAvatarColorInput');
                if (customColor && isValidColor(customColor.value.trim())) avatarColor = customColor.value.trim();
                else avatarColor = '#cbc5bb';
            }
            avatarEl.style.backgroundColor = avatarColor;
            avatarEl.dataset.avatarColor = avatarColor;
        } else {
            const imagePreview = root.querySelector('#cdAvatarImagePreview');
            if (imagePreview) avatarEl.innerHTML = imagePreview.innerHTML;
        }
    }
    showToast('博客设置已更新');
}

function applyBlogSettingsToAll(root) {
    const blogEls = root.querySelectorAll('.cd-blog-text');
    if (blogEls.length === 0) { showToast('没有找到博客元素'); return; }
    const hasImage = root.querySelector('#cdBlogImageToggle')?.checked;
    const showAvatar = root.querySelector('#cdBlogAvatarToggle')?.checked;
    const showLocation = root.querySelector('#cdBlogLocationToggle')?.checked;
    const location = root.querySelector('#cdBlogLocationInput')?.value || '';
    const author = root.querySelector('#cdBlogAuthorInput')?.value || '';
    const avatarType = root.querySelector('input[name="cdAvatarType"]:checked')?.value || 'letter';
    const avatarLetter = root.querySelector('#cdAvatarLetterInput')?.value || '';
    let avatarColor;
    const selColor = root.querySelector('.cd-avatar-color.cd-selected');
    if (selColor) avatarColor = selColor.dataset.color;
    else {
        const cc = root.querySelector('#cdCustomAvatarColorInput');
        avatarColor = (cc && isValidColor(cc.value.trim())) ? cc.value.trim() : '#cbc5bb';
    }
    blogEls.forEach((blog) => {
        blog.dataset.hasImage = hasImage.toString();
        blog.dataset.showAvatar = showAvatar.toString();
        blog.dataset.showLocation = showLocation.toString();
        toggleBlogImageDisplay(hasImage, blog);
        toggleBlogAvatarDisplay(showAvatar, blog);
        toggleBlogLocationDisplay(showLocation, blog);
        const locEl = blog.querySelector('.cd-blog-location');
        if (locEl) locEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a6 6 0 00-6 6c0 4 6 10 6 10s6-6 6-10a6 6 0 00-6-6z"/><circle cx="12" cy="8" r="2"/></svg> ${location}`;
        const authorEl = blog.querySelector('.cd-blog-author');
        if (authorEl) authorEl.textContent = author;
        const avatarEl = blog.querySelector('.cd-blog-avatar');
        if (avatarEl) {
            avatarEl.dataset.avatarType = avatarType;
            if (avatarType === 'letter') {
                avatarEl.textContent = avatarLetter;
                avatarEl.style.backgroundColor = avatarColor;
                avatarEl.dataset.avatarColor = avatarColor;
            } else if (_cdSelected && _cdSelected.classList.contains('cd-blog-text')) {
                const src = _cdSelected.querySelector('.cd-blog-avatar');
                if (src && src.querySelector('img')) avatarEl.innerHTML = src.innerHTML;
            }
        }
    });
    showToast(`已应用设置到 ${blogEls.length} 个博客元素`);
}

function toggleBlogImageDisplay(show, blog) {
    const p = blog.querySelector('.cd-blog-img-preview');
    if (p) p.style.display = show ? 'flex' : 'none';
}

function toggleBlogAvatarDisplay(show, blog) {
    const a = blog.querySelector('.cd-blog-avatar');
    if (a) a.style.display = show ? 'flex' : 'none';
}

function toggleBlogLocationDisplay(show, blog) {
    const l = blog.querySelector('.cd-blog-location');
    if (l) l.style.display = show ? 'flex' : 'none';
}

function uploadAvatarImage(root) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const preview = root.querySelector('#cdAvatarImagePreview');
            if (preview) preview.innerHTML = `<img src="${ev.target.result}" alt="头像">`;
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

// ============================================================
// 博客图标 + 图片卡片
// ============================================================
function applyBlogIcons(root) {
    const likeIcon = root.querySelector('#cdLikeIconSelector .cd-icon-option.cd-selected svg');
    const commentIcon = root.querySelector('#cdCommentIconSelector .cd-icon-option.cd-selected svg');
    const shareIcon = root.querySelector('#cdShareIconSelector .cd-icon-option.cd-selected svg');
    if (!likeIcon || !commentIcon || !shareIcon) return;
    root.querySelectorAll('.cd-blog-text').forEach((blog) => {
        const actions = blog.querySelector('.cd-blog-actions');
        if (actions) {
            const children = actions.children;
            if (children[0]) {
                const old = children[0].querySelector('svg');
                if (old) old.replaceWith(likeIcon.cloneNode(true));
            }
            if (children[1]) {
                const old = children[1].querySelector('svg');
                if (old) old.replaceWith(commentIcon.cloneNode(true));
            }
            if (children[2]) {
                const old = children[2].querySelector('svg');
                if (old) old.replaceWith(shareIcon.cloneNode(true));
            }
        }
    });
    showToast('图标已更新');
}

function wireImageCardPanel(root, group) {
    bindLiveInput(group, '#cdImageDescription', (v) => updateImageDescription(v), root);

    bindSlider(group, 'cdImageBorderRadius', 'cdImageBorderRadiusValue', (v) => {
        adjustImageStyle('borderRadius', v, root);
        persistState(root);
    });
    bindSlider(group, 'cdImageOverlayOpacity', 'cdImageOverlayOpacityValue', (v) => {
        adjustImageStyle('overlayOpacity', v, root);
        persistState(root);
    }, (v) => String(v));

    bindColorDots(group, 'data-cd-overlay-color', (color) => {
        adjustImageStyle('overlayColor', color, root);
        persistState(root);
    });
}

function updateImageCardControls(imageCard, root) {
    if (!imageCard) return;
    const caption = imageCard.querySelector('.cd-image-caption');
    const descInput = root.querySelector('#cdImageDescription');
    if (caption && descInput) descInput.value = caption.textContent;
    const borderRadius = imageCard.dataset.borderRadius || '12';
    const br = root.querySelector('#cdImageBorderRadius'); if (br) br.value = borderRadius;
    const brv = root.querySelector('#cdImageBorderRadiusValue'); if (brv) brv.textContent = borderRadius + 'px';
    const opacity = imageCard.dataset.opacity || '0.2';
    const os = root.querySelector('#cdImageOverlayOpacity'); if (os) os.value = opacity;
    const osv = root.querySelector('#cdImageOverlayOpacityValue'); if (osv) osv.textContent = opacity;
}

function uploadImageForCard(root) {
    if (!_cdSelected || !_cdSelected.classList.contains('cd-image-card')) { showToast('请先选择一个图片卡片'); return; }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = _cdSelected.querySelector('img');
            if (img) { img.src = ev.target.result; img.alt = file.name; }
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

function updateImageDescription(text) {
    if (!_cdSelected || !_cdSelected.classList.contains('cd-image-card')) return;
    const caption = _cdSelected.querySelector('.cd-image-caption');
    if (caption) caption.textContent = text;
}

function adjustImageStyle(property, value, root) {
    if (!_cdSelected || !_cdSelected.classList.contains('cd-image-card')) return;
    switch (property) {
        case 'borderRadius':
            _cdSelected.style.borderRadius = value + 'px';
            _cdSelected.dataset.borderRadius = value;
            const brv = root.querySelector('#cdImageBorderRadiusValue');
            if (brv) brv.textContent = value + 'px';
            break;
        case 'overlayOpacity': {
            const overlay = _cdSelected.querySelector('.cd-image-overlay');
            if (overlay) {
                const currentBg = getComputedStyle(overlay).backgroundColor;
                if (currentBg.startsWith('rgba')) {
                    overlay.style.backgroundColor = currentBg.replace(/rgba\(([^,]+,[^,]+,[^,]+),[^)]+\)/, 'rgba($1,' + value + ')');
                } else if (currentBg.startsWith('rgb')) {
                    overlay.style.backgroundColor = currentBg.replace(/rgb\(([^)]+)\)/, 'rgba($1,' + value + ')');
                } else {
                    overlay.style.backgroundColor = `rgba(150,150,150,${value})`;
                }
                _cdSelected.dataset.opacity = value;
                const osv = root.querySelector('#cdImageOverlayOpacityValue');
                if (osv) osv.textContent = value;
            }
            break;
        }
        case 'overlayColor': {
            const overlay = _cdSelected.querySelector('.cd-image-overlay');
            if (overlay) overlay.style.backgroundColor = value;
            break;
        }
    }
}

function applyImageStyle(root) {
    if (!_cdSelected || !_cdSelected.classList.contains('cd-image-card')) { showToast('请先选择一个图片卡片'); return; }
    const borderRadius = root.querySelector('#cdImageBorderRadius')?.value || '12';
    const overlayOpacity = root.querySelector('#cdImageOverlayOpacity')?.value || '0.2';
    const description = root.querySelector('#cdImageDescription')?.value || '';
    _cdSelected.style.borderRadius = borderRadius + 'px';
    _cdSelected.dataset.borderRadius = borderRadius;
    const overlay = _cdSelected.querySelector('.cd-image-overlay');
    if (overlay) {
        const currentBg = getComputedStyle(overlay).backgroundColor;
        if (currentBg.startsWith('rgba')) {
            overlay.style.backgroundColor = currentBg.replace(/rgba\(([^,]+,[^,]+,[^,]+),[^)]+\)/, 'rgba($1,' + overlayOpacity + ')');
        } else if (currentBg.startsWith('rgb')) {
            overlay.style.backgroundColor = currentBg.replace(/rgb\(([^)]+)\)/, 'rgba($1,' + overlayOpacity + ')');
        } else {
            overlay.style.backgroundColor = `rgba(150,150,150,${overlayOpacity})`;
        }
        _cdSelected.dataset.opacity = overlayOpacity;
    }
    const caption = _cdSelected.querySelector('.cd-image-caption');
    if (caption) caption.textContent = description;
    showToast('图片样式已应用');
}

function applyImageStyleToAll(root) {
    const cards = root.querySelectorAll('.cd-image-card');
    if (cards.length === 0) { showToast('没有找到图片卡片'); return; }
    const borderRadius = root.querySelector('#cdImageBorderRadius')?.value || '12';
    const overlayOpacity = root.querySelector('#cdImageOverlayOpacity')?.value || '0.2';
    cards.forEach((card) => {
        card.style.borderRadius = borderRadius + 'px';
        card.dataset.borderRadius = borderRadius;
        const overlay = card.querySelector('.cd-image-overlay');
        if (overlay) {
            const currentBg = getComputedStyle(overlay).backgroundColor;
            if (currentBg.startsWith('rgba')) {
                overlay.style.backgroundColor = currentBg.replace(/rgba\(([^,]+,[^,]+,[^,]+),[^)]+\)/, 'rgba($1,' + overlayOpacity + ')');
            } else if (currentBg.startsWith('rgb')) {
                overlay.style.backgroundColor = currentBg.replace(/rgb\(([^)]+)\)/, 'rgba($1,' + overlayOpacity + ')');
            } else {
                overlay.style.backgroundColor = `rgba(150,150,150,${overlayOpacity})`;
            }
            card.dataset.opacity = overlayOpacity;
        }
    });
    showToast(`已应用样式到 ${cards.length} 个图片卡片`);
}

// ============================================================
// 元素位置 + 自定义颜色应用
// ============================================================
function adjustElementPosition(axis, value, root) {
    if (!_cdSelected) return;
    if (axis === 'y') {
        const out = root.querySelector('#cdElementPositionYValue');
        if (out) out.textContent = value + 'px';
        _cdSelected.style.transform = `translateY(${value}px)`;
    }
}

function resetElementPosition(root) {
    if (!_cdSelected) return;
    _cdSelected.style.transform = '';
    const slider = root.querySelector('#cdElementPositionY');
    if (slider) slider.value = 0;
    const out = root.querySelector('#cdElementPositionYValue');
    if (out) out.textContent = '0px';
}

function updatePositionSlider(element, root) {
    if (!element || !root) return;
    const positionY = element.style.transform ? parseInt(element.style.transform.replace(/translateY\(([^)]+)\)/, '$1')) || 0 : 0;
    const slider = root.querySelector('#cdElementPositionY');
    if (slider) slider.value = positionY;
    const out = root.querySelector('#cdElementPositionYValue');
    if (out) out.textContent = positionY + 'px';
}

function changeCardBg(url, root) {
    const card = root.querySelector('.cd-card');
    if (!card) return;
    card.dataset.cdBgUrl = url || '';
    applyCardBackground(root);
    try { localStorage.setItem(STORAGE_KEY_BG, url || ''); } catch (_) {}
}

function uploadCustomBackground(root) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = ev.target.result;
            changeCardBg(dataUrl, root);
            // 把刚上传的图追加成一个可复选的预设项
            const options = root.querySelector('#cdBgOptions');
            if (options) {
                const newOption = document.createElement('div');
                newOption.className = 'cd-bg-option';
                newOption.dataset.bg = dataUrl;
                newOption.innerHTML = `<img src="${dataUrl}" alt="自定义背景">`;
                options.appendChild(newOption);
                options.querySelectorAll('.cd-bg-option').forEach((o) => o.classList.remove('cd-selected'));
                newOption.classList.add('cd-selected');
                const group = options.closest('.cd-control-group') || options;
                wireBgPanel(root, group);
            }
            persistState(root);
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

// ============================================================
// 浮动 + 按钮 / 显示添加菜单
// ============================================================
function initFloatingAdd(root) {
    const btn = root.querySelector('.cd-floating-add-btn');
    if (!btn) return;
    btn.addEventListener('click', (e) => { e.preventDefault(); showAddMenu(root); });
}

function showAddMenu(root) {
    const existing = document.querySelector('.cd-context-menu');
    if (existing) existing.remove();
    const menu = document.createElement('div');
    menu.className = 'cd-context-menu';
    menu.style.display = 'block';
    // 菜单样式挂在 .app-shell[data-app-id] 作用域下,必须放进 shell 里才生效
    const host = root.closest('.app-shell') || document.body;
    menu.innerHTML = `
        <div class="cd-context-menu-item" data-cd-type="diary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="margin-right: 8px; vertical-align: middle;">
                <path d="M4 6h16M4 12h16M4 18h12" stroke="#6a6a6a" stroke-width="2" stroke-linecap="round"></path>
            </svg>
            日记
        </div>
        <div class="cd-context-menu-item" data-cd-type="blog">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="margin-right: 8px; vertical-align: middle;">
                <path d="M12 6v12M6 12h12" stroke="#6a6a6a" stroke-width="2" stroke-linecap="round"></path>
            </svg>
            博客
        </div>
        <div class="cd-context-menu-item" data-cd-type="chat-left">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="margin-right: 8px; vertical-align: middle;">
                <path d="M8 12h8M8 8h4" stroke="#6a6a6a" stroke-width="2" stroke-linecap="round"></path>
                <rect x="4" y="4" width="16" height="12" rx="4" stroke="#6a6a6a" stroke-width="2" fill="none"></rect>
                <path d="M8 16l-2 3v-3" stroke="#6a6a6a" stroke-width="2" fill="none"></path>
            </svg>
            对话左
        </div>
        <div class="cd-context-menu-item" data-cd-type="chat-right">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="margin-right: 8px; vertical-align: middle;">
                <path d="M8 12h8M12 8h4" stroke="#6a6a6a" stroke-width="2" stroke-linecap="round"></path>
                <rect x="4" y="4" width="16" height="12" rx="4" stroke="#6a6a6a" stroke-width="2" fill="none"></rect>
                <path d="M16 16l2 3v-3" stroke="#6a6a6a" stroke-width="2" fill="none"></path>
            </svg>
            对话右
        </div>
        <div class="cd-context-menu-item" data-cd-type="image">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="margin-right: 8px; vertical-align: middle;">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="#6a6a6a" stroke-width="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5" stroke="#6a6a6a" stroke-width="2"></circle>
                <path d="M21 15l-5-5L5 21" stroke="#6a6a6a" stroke-width="2"></path>
            </svg>
            图片卡片
        </div>
    `;
    host.appendChild(menu);
    const btn = root.querySelector('.cd-floating-add-btn');
    const btnRect = btn ? btn.getBoundingClientRect() : { right: window.innerWidth - 30, top: window.innerHeight - 100 };
    menu.style.right = (window.innerWidth - btnRect.right) + 'px';
    menu.style.bottom = (window.innerHeight - btnRect.top + 10) + 'px';
    menu.style.left = 'auto';
    menu.style.top = 'auto';

    // 点击菜单项添加元素
    menu.querySelectorAll('.cd-context-menu-item').forEach((item) => {
        item.addEventListener('click', () => {
            const t = item.dataset.cdType;
            if (t) {
                addText(t, root);
                persistState(root);
            }
            menu.remove();
        });
    });

    // 点击外部关闭菜单
    setTimeout(() => {
        const handler = (e) => {
            if (!menu.contains(e.target) && !(btn && btn.contains(e.target))) {
                menu.remove();
                document.removeEventListener('click', handler);
            }
        };
        document.addEventListener('click', handler);
    }, 0);
}

// ============================================================
// 下载封面(modern-screenshot,本地依赖,不再走第三方 CDN)
// ============================================================
async function saveDesign(root) {
    persistState(root);
    const card = root.querySelector('.cd-card');
    if (!card) { showToast('找不到画布'); return; }
    showToast('正在生成图片...');
    const result = await exportCardToPng({ cardEl: card });
    showToast(result.ok ? '图片已保存' : `导出失败:${result.error || '未知错误'}`);
}

// ============================================================
// 历史存档:IndexedDB(cdDesigns)
// ============================================================
function getArchiveDb() {
    return (typeof window !== 'undefined' && window.myDb) ? window.myDb : null;
}

// 面板被搬到 .app-shell 下了,不能只在 .cd-root 里找
function getArchiveOverlay(root) {
    const scope = root.closest('.app-shell') || root;
    return scope.querySelector('#cdArchiveOverlay');
}

async function listArchives() {
    const db = getArchiveDb();
    if (!db) return [];
    try {
        const all = await db.getAll(ARCHIVE_STORE);
        return (Array.isArray(all) ? all : [])
            .filter((d) => d && d.id)
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch (err) {
        console.warn('[cover-designer] 读取存档失败', err);
        return [];
    }
}

async function archiveCurrentDesign(root) {
    const db = getArchiveDb();
    if (!db) { showToast('存储未就绪,稍后再试'); return; }
    const card = root.querySelector('.cd-card');
    showToast('正在存档...');

    const snap = snapshotDesign(root);
    const thumbnail = card ? await renderCardToDataUrl(card, 0.4) : null;
    const now = Date.now();
    const record = {
        id: `cd-${now}-${Math.random().toString(36).slice(2, 8)}`,
        name: buildArchiveName(root, now),
        design: snap,
        thumbnail: thumbnail || '',
        createdAt: now,
        updatedAt: now,
    };

    try {
        await db.put(ARCHIVE_STORE, record);
        persistState(root);
        showToast('已存档');
        notify('success', '已存入历史存档', record.name);
        // 存档面板开着的话顺手刷新列表
        const overlay = getArchiveOverlay(root);
        if (overlay && !overlay.hasAttribute('hidden')) renderArchiveList(root);
    } catch (err) {
        console.warn('[cover-designer] 存档失败', err);
        showToast('存档失败');
    }
}

// 用画布上第一段有文字的内容当存档标题,没有就用时间
function buildArchiveName(root, ts) {
    const el = root.querySelector('.cd-diary-text, .cd-blog-text, .cd-chat-bubble, .cd-time-stamp');
    const text = el ? (el.textContent || '').trim().replace(/\s+/g, ' ') : '';
    if (text) return text.length > 14 ? `${text.slice(0, 14)}…` : text;
    return `封面 ${new Date(ts).toLocaleString('zh-CN', { hour12: false })}`;
}

function initArchivePanel(root) {
    let overlay = root.querySelector('#cdArchiveOverlay');
    if (!overlay) return;

    // 面板要盖住整块手机屏幕。它默认渲染在可滚动的 .cd-root 里,
    // 那样 inset:0 会跟着内容高度跑,所以搬到 .app-shell 下面去。
    const shell = root.closest('.app-shell');
    if (shell && overlay.parentElement !== shell) {
        shell.querySelectorAll('#cdArchiveOverlay').forEach((stale) => {
            if (stale !== overlay) stale.remove();
        });
        shell.appendChild(overlay);
        overlay = shell.querySelector('#cdArchiveOverlay');
    }

    wirePanelActions(root, overlay);

    // 列表项是动态渲染的,用事件委托,免得每次重新绑
    const list = overlay.querySelector('#cdArchiveList');
    if (list && !list.dataset.cdArchiveBound) {
        list.dataset.cdArchiveBound = '1';
        list.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-cd-archive-action]');
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            const item = btn.closest('.cd-archive-item');
            const id = item ? item.dataset.archiveId : '';
            if (!id) return;
            const action = btn.dataset.cdArchiveAction;
            if (action === 'load') loadArchive(root, id);
            if (action === 'delete') deleteArchive(root, id);
            if (action === 'download') downloadArchive(root, id);
        });
    }
}

function openArchivePanel(root) {
    const overlay = getArchiveOverlay(root);
    if (!overlay) return;
    overlay.removeAttribute('hidden');
    root.closest('.app-shell')?.classList.add('cd-archive-active');
    // 隔一拍再加 class,让 CSS 过渡有起点(不用 rAF:后台标签页里它不触发,面板会一直不出现)
    setTimeout(() => overlay.classList.add('cd-archive-open'), 16);
    renderArchiveList(root);
}

function closeArchivePanel(root) {
    const overlay = getArchiveOverlay(root);
    if (!overlay) return;
    overlay.classList.remove('cd-archive-open');
    root.closest('.app-shell')?.classList.remove('cd-archive-active');
    setTimeout(() => overlay.setAttribute('hidden', ''), 220);
}

async function renderArchiveList(root) {
    const overlay = getArchiveOverlay(root);
    const list = overlay ? overlay.querySelector('#cdArchiveList') : null;
    if (!list) return;
    list.innerHTML = `<div class="cd-archive-empty">读取中…</div>`;

    const items = await listArchives();
    const countEl = overlay.querySelector('#cdArchiveCount');
    if (countEl) countEl.textContent = items.length ? `${items.length}` : '';

    if (!items.length) {
        list.innerHTML = `
            <div class="cd-archive-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M8 3v5h7"/></svg>
                <span>还没有存档</span>
                <small>点上方「存档当前设计」保存一份</small>
            </div>`;
        return;
    }

    list.innerHTML = items.map((item) => `
        <div class="cd-archive-item" data-archive-id="${escapeAttr(item.id)}">
            <div class="cd-archive-thumb">
                ${item.thumbnail
                    ? `<img src="${escapeAttr(item.thumbnail)}" alt="">`
                    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 16l5-5 4 4 3-3 6 6"/></svg>`}
            </div>
            <div class="cd-archive-meta">
                <div class="cd-archive-name">${escapeText(item.name || '未命名')}</div>
                <div class="cd-archive-time">${formatArchiveTime(item.updatedAt)}</div>
            </div>
            <div class="cd-archive-ops">
                <button type="button" data-cd-archive-action="load" title="载入到画布" aria-label="载入到画布">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 12a8.5 8.5 0 1 1-2.5-6"/><path d="M20.5 4.5V9H16"/></svg>
                </button>
                <button type="button" data-cd-archive-action="download" title="下载 PNG" aria-label="下载 PNG">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.6v11.2"/><path d="M8 11l4 3.8 4-3.8"/><path d="M4.5 19.4h15"/></svg>
                </button>
                <button type="button" data-cd-archive-action="delete" class="cd-archive-danger" title="删除" aria-label="删除">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5h16"/><path d="M9 6.5V4.4h6V6.5"/><path d="M6.5 6.5 7.4 20a1.6 1.6 0 0 0 1.6 1.4h6a1.6 1.6 0 0 0 1.6-1.4l.9-13.5"/></svg>
                </button>
            </div>
        </div>`).join('');
}

async function loadArchive(root, id) {
    const db = getArchiveDb();
    if (!db) return;
    try {
        const record = await db.get(ARCHIVE_STORE, id);
        if (!record || !record.design) { showToast('存档已失效'); return; }
        applyDesignSnapshot(root, record.design);
        rebindCanvas(root);
        closePanel();
        closeArchivePanel(root);
        persistState(root);
        showToast(`已载入「${record.name || '存档'}」`);
    } catch (err) {
        console.warn('[cover-designer] 载入存档失败', err);
        showToast('载入失败');
    }
}

async function deleteArchive(root, id) {
    const db = getArchiveDb();
    if (!db) return;
    try {
        await db.remove(ARCHIVE_STORE, id);
        renderArchiveList(root);
        showToast('已删除');
    } catch (err) {
        console.warn('[cover-designer] 删除存档失败', err);
        showToast('删除失败');
    }
}

/**
 * 下载某个存档:先把它渲染进一个屏外画布,再截图,不动用户当前编辑中的内容
 */
async function downloadArchive(root, id) {
    const db = getArchiveDb();
    if (!db) return;
    let stage = null;
    try {
        const record = await db.get(ARCHIVE_STORE, id);
        if (!record || !record.design) { showToast('存档已失效'); return; }
        showToast('正在生成图片...');

        const card = root.querySelector('.cd-card');
        stage = document.createElement('div');
        stage.className = 'cd-offscreen-stage';
        stage.innerHTML = `<div class="cd-card"><div class="cd-card-content"></div></div>`;
        root.appendChild(stage);

        const stageCard = stage.querySelector('.cd-card');
        const stageContent = stage.querySelector('.cd-card-content');
        if (card) stageCard.style.width = `${card.offsetWidth}px`;
        stageContent.innerHTML = record.design.cardContentHtml || '';
        stageCard.dataset.cdBgUrl = record.design.bgUrl || '';
        stageCard.dataset.cdBgMask = record.design.bgMask || '0';
        if (record.design.cardColor) stageCard.style.backgroundColor = record.design.cardColor;
        applyCardBackground(stage);
        stageContent.style.backdropFilter = `blur(${record.design.contentBlur || 5}px)`;

        const result = await exportCardToPng({ cardEl: stageCard });
        showToast(result.ok ? '图片已保存' : `导出失败:${result.error || '未知错误'}`);
    } catch (err) {
        console.warn('[cover-designer] 存档下载失败', err);
        showToast('导出失败');
    } finally {
        if (stage && stage.parentNode) stage.remove();
    }
}

function formatArchiveTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ============================================================
// 提示
// ============================================================
function escapeText(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str) {
    return escapeText(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// 走框架灵动岛(拿得到的话),失败静默
function notify(type, title, detail) {
    try {
        window.myDynamicIsland?.showNotification?.(type, title, detail || '', {
            lifecycle: 'time',
            duration: 3000,
            ownerId: 'cover-designer',
        });
    } catch (_) {}
}

// ============================================================
// Toast 提示(沿用原文样式)
// ============================================================
function showToast(message) {
    const existing = document.querySelector('.cd-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'cd-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('cd-toast-show'), 16);
    setTimeout(() => {
        toast.classList.remove('cd-toast-show');
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
    }, 2000);
}
