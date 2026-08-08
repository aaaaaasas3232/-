/**
 * App 制作问卷 App — v2.0（精简 · 对齐真实 SDK）
 *
 * 11 题：基本/页面/顶栏/视觉风格/能力/widget/island/AI/世界观/人设/Prompt库
 * prompt 模板直接内嵌在这里（来自 App制作prompt.md 的内容，与 md 文档一一对应）。
 */

import { createActionAttr } from '@/src/core/actions.js';
import { escapeHtml } from '@/src/core/escape.js';
import { createDefaultPageRenderer } from '@/src/core/page-renderers.js';
import { externalAppRegistry } from '@/src/core/app-registry.js';
import { GLOSSARY_GROUPS, findGlossaryGroup, findGlossaryTerm } from './prompt-survey-glossary.js';

// =========================================================================
// 视觉风格（12 种）—— 配色 + iconBg 渐变 + 主题色
// =========================================================================
const DESIGN_STYLES = [
    { value: 'ios-blue',     title: '经典蓝',     desc: 'iOS 标准',         bg: '#F2F2F7',    card: '#FFFFFF', prim: '#007AFF', iconBg: 'linear-gradient(145deg, #5AC8FA, #007AFF)' },
    { value: 'dopamine',     title: '多巴胺',     desc: '高饱和快乐色',     bg: '#FFF0F5',    card: '#FFD700', prim: '#FF69B4', iconBg: 'linear-gradient(135deg, #FF6B9D, #FFD93D)' },
    { value: 'cyberpunk',    title: '赛博朋克',   desc: '黑底霓虹',         bg: '#0A0A0F',    card: '#1C1C2E', prim: '#00FF9D', iconBg: 'linear-gradient(135deg, #00FF9D, #00B8FF)' },
    { value: 'glass',        title: '毛玻璃',     desc: '极致透明',         bg: 'linear-gradient(135deg,#a8edea,#fed6e3)', card: 'rgba(255,255,255,0.2)', prim: '#5e60ce', iconBg: 'linear-gradient(135deg, #a8edea, #fed6e3)' },
    { value: 'morandi',      title: '莫兰迪',     desc: '高级灰调',         bg: '#E0E5DF',    card: '#F0F2F0', prim: '#76877D', iconBg: 'linear-gradient(145deg, #A8B5A0, #76877D)' },
    { value: 'warm-sunset',  title: '暖阳落日',   desc: '温暖橙粉',         bg: 'linear-gradient(180deg,#FFF5EB,#FFE4D6)', card: '#FFFFFF', prim: '#FF6B35', iconBg: 'linear-gradient(135deg, #FFB75E, #ED8F03)' },
    { value: 'ocean-deep',   title: '深海蓝',     desc: '沉稳深蓝',         bg: '#0B1426',    card: '#132040', prim: '#4FC3F7', iconBg: 'linear-gradient(135deg, #4FC3F7, #1976D2)' },
    { value: 'sakura',       title: '樱花粉',     desc: '柔和少女',         bg: '#FFF0F3',    card: '#FFFFFF', prim: '#E91E8C', iconBg: 'linear-gradient(135deg, #FFB6C1, #E91E8C)' },
    { value: 'neumorphism',  title: '新拟态',     desc: '柔和凹凸',         bg: '#E0E5EC',    card: '#E0E5EC', prim: '#6C63FF', iconBg: 'linear-gradient(145deg, #B8BCC8, #6C63FF)' },
    { value: 'flat-minimal', title: '扁平极简',   desc: '无阴影纯色',       bg: '#FFFFFF',    card: '#F5F5F5', prim: '#333333', iconBg: 'linear-gradient(145deg, #F5F5F5, #333333)' },
    { value: 'material-you', title: 'Material You', desc: '动态取色',        bg: '#FFFBFE',    card: '#FEF7FF', prim: '#6750A4', iconBg: 'linear-gradient(135deg, #D0BCFF, #6750A4)' },
    { value: 'retro-pixel',  title: '像素复古',   desc: '8-bit 怀旧',       bg: '#2B2B2B',    card: '#3C3C3C', prim: '#FFD700', iconBg: 'linear-gradient(135deg, #FFD700, #FF6F00)' },
];

// 顶栏 6 种 type
const TOPBAR_TYPES = [
    { value: 'standard',     label: '标准',     sub: '标题 + 副标题 + App 名 pill' },
    { value: 'title-only',   label: '仅标题',   sub: '只显示主标题' },
    { value: 'search',       label: '搜索框',   sub: '主区域被搜索框占据' },
    { value: 'segmented',    label: '分段控件', sub: '顶部水平切换 tabs' },
    { value: 'large-title',  label: '大标题',   sub: 'iOS 大标题风格' },
    { value: 'buttons-only', label: '仅按钮',   sub: '隐藏标题，只留 pill' },
];

// 核心能力（14 种）—— ai / db 自动联动到对应 SDK 段
const CORE_FEATURES = [
    { value: 'ai',           title: 'AI 对话',   desc: '调 API',         autoSdk: 'ai' },
    { value: 'db',           title: '本地存储',   desc: 'IndexedDB',      autoSdk: 'db' },
    { value: 'camera',       title: '图片上传',   desc: '相册/相机' },
    { value: 'charts',       title: '数据图表',   desc: '统计可视化' },
    { value: 'search',       title: '搜索功能',   desc: '全局搜索栏' },
    { value: 'pull-refresh', title: '下拉刷新',   desc: '列表刷新' },
    { value: 'dark-toggle',  title: '暗色切换',   desc: '明暗主题' },
    { value: 'gesture',      title: '手势操作',   desc: '滑动/长按' },
    { value: 'share',        title: '分享功能',   desc: 'iOS Share Sheet' },
    { value: 'favorite',     title: '收藏点赞',   desc: '带动画' },
    { value: 'onboarding',   title: '引导页',     desc: '首次引导流程' },
    { value: 'notification', title: '通知模拟',   desc: '应用内通知' },
    { value: 'settings',     title: '设置页面',   desc: '偏好设置' },
    { value: 'login',        title: '登录注册',   desc: '用户认证' },
];

const FEATURE_MAP = Object.fromEntries(CORE_FEATURES.map(f => [f.value, `${f.title}（${f.desc}）`]));

// widget 尺寸
const WIDGET_SIZES = [
    { value: 'S', title: 'Small', desc: '2×1' },
    { value: 'M', title: 'Medium', desc: '2×2' },
    { value: 'L', title: 'Large', desc: '4×2' },
];

const STYLE_MAP = Object.fromEntries(DESIGN_STYLES.map(s => [s.value, s.title]));
const TOPBAR_MAP = Object.fromEntries(TOPBAR_TYPES.map(t => [t.value, `${t.label}（${t.sub}）`]));

// =========================================================================
// 11 题 questionnaire prototypes
// =========================================================================
const QUESTION_PROTOTYPES = [
    // ── 0. 基本信息 ──
    {
        id: 'basicInfo', step: 0,
        title: '1. 基本信息',
        desc: '设置 App 的名称、ID 和简要描述',
        defaults: { engineerStyle: '', appId: '', appName: '', appDesc: '', overallStyle: '', islandRequirement: '', widgetRequirement: '' },
        renderCard(answers) {
            return `
                ${ui.group('希望对方是一个怎样的软件工程师', ui.textarea(answers, '', 'engineerStyle', { placeholder: '例如：严谨刻板、注重细节；或开放灵活、鼓励快速迭代；或注重安全与可维护性...', rows: 3 }))}
                ${ui.group('App 名称', ui.input(answers, '', 'appName', { placeholder: '我的应用' }))}
                ${ui.group('App ID', ui.input(answers, '', 'appId', { placeholder: 'my-app' }) + ui.label('', '英文 + 连字符，全局唯一'))}
                ${ui.group('功能描述（选填）', ui.textarea(answers, '', 'appDesc', { placeholder: '简要描述这个应用的功能...' }))}
                ${ui.group('软件的整体风格要求', ui.textarea(answers, '', 'overallStyle', { placeholder: '例如：iPhone 拟物风格、柔和、毛玻璃、圆角；或 Material You；或极简黑白灰...', rows: 3 }))}
                ${ui.group('对灵动岛的要求', ui.textarea(answers, '', 'islandRequirement', { placeholder: '例如：需要 mini/medium/large 三档；mini 用于计时，medium 用于通知，large 用于实时数据...', rows: 3 }))}
                ${ui.group('对小组件的要求', ui.textarea(answers, '', 'widgetRequirement', { placeholder: '例如：S/M/L 三种尺寸；S 支持横竖两种方向；widget 需要实时刷新...', rows: 3 }))}
            `;
        },
        promptBlock(answers) {
            const factoryName = 'create' + String(answers.appName || 'MyApp').replace(/[^a-zA-Z0-9_$]/g, '') + 'App';
            const descLine = answers.appDesc ? '\n- **功能描述**: ' + answers.appDesc : '';
            const engineerLine = answers.engineerStyle ? '\n- **期望的软件工程师风格**: ' + answers.engineerStyle : '';
            const styleLine = answers.overallStyle ? '\n- **整体风格要求**: ' + answers.overallStyle : '';
            const islandLine = answers.islandRequirement ? '\n- **灵动岛要求**: ' + answers.islandRequirement : '';
            const widgetLine = answers.widgetRequirement ? '\n- **小组件要求**: ' + answers.widgetRequirement : '';
            return '## 一、基本信息\n'
                + '- **App 名称**: ' + (answers.appName || 'MyApp') + '\n'
                + '- **App ID**: `' + (answers.appId || 'my-app') + '`\n'
                + '- **构造函数名**: `' + factoryName + '`' + descLine + engineerLine + styleLine + islandLine + widgetLine;
        },
    },

    // ── 1. 页面规划 ──
    {
        id: 'pages', step: 1,
        title: '2. 页面规划',
        desc: '定义主要页面和 Tab 标签',
        defaults: {
            structure: 'tab',
            pages: [
                { name: '首页', desc: '主要内容展示' },
                { name: '我的', desc: '个人中心' },
            ],
        },
        renderCard(answers) {
            return `
                ${ui.group('页面结构', ui.selectHeader(answers, '', 'structure', [
                    { value: 'tab',    title: 'Tab 导航', desc: '多页面切换' },
                    { value: 'single', title: '单页面',   desc: '单一工具' },
                ]))}
                ${ui.group('页面列表', ui.pagesList(answers, '', 'pages'))}
            `;
        },
        promptBlock(answers) {
            const lines = [`## 二、页面结构`, `- **结构**: ${answers.structure === 'tab' ? '底部 Tab 导航（多页面）' : '单页面工具'}`];
            (answers.pages || []).forEach((pg, i) => {
                lines.push(`  ${i + 1}. **${pg.name}**${pg.desc ? ' — ' + pg.desc : ''}`);
            });
            return lines.join('\n');
        },
    },

    // ── 2. 顶栏设计 ──
    {
        id: 'topbar', step: 2,
        title: '3. 顶栏设计',
        desc: '选 6 种 framework 原生样式中的一种，其它细节（字号/字重/颜色）由框架按 iPhone 默认风格处理',
        defaults: { topbarType: 'standard' },
        renderCard(answers) {
            const cards = TOPBAR_TYPES.map(t => {
                const selected = answers.topbarType === t.value;
                return `<div class="pg-tbcard ${selected ? 'selected' : ''}" ${createActionAttr({ action: 'appMethod', method: 'setTopbarType', payload: { value: t.value } }, '')}>
                    <div class="pg-tbcard__label">${escapeHtml(t.label)}</div>
                    <div class="pg-tbcard__sub">${escapeHtml(t.sub)}</div>
                    ${selected ? '<div class="pg-tbcard__check">✓</div>' : ''}
                </div>`;
            }).join('');
            return `<div class="pg-tbcard-grid">${cards}</div>
                <div class="pg-tbcard-hint">💡 选一个最像你要的样式就行。</div>`;
        },
        promptBlock(answers) {
            const t = TOPBAR_TYPES.find(o => o.value === (answers.topbarType || 'standard'));
            return `- **顶栏类型**: ${t ? t.label : 'standard'} — ${t ? t.sub : ''}`;
        },
    },

    // ── 3. 视觉风格 ──
    {
        id: 'style', step: 3,
        title: '4. 视觉风格',
        desc: '选择 App 的设计语言（影响配色、iconBg、status bar 色）',
        defaults: { style: 'ios-blue' },
        renderCard(answers) {
            return `<div class="pg-style-grid">${DESIGN_STYLES.map(o => {
                const selected = answers.style === o.value;
                return `<div class="pg-style-item ${selected ? 'selected' : ''}" data-value="${escapeHtml(o.value)}">
                    <div class="pg-preview-box" style="background:${escapeHtml(o.bg)};">
                        <div class="pg-preview-card" style="background:${escapeHtml(o.card)};"></div>
                        <div class="pg-preview-btn" style="background:${escapeHtml(o.prim)};"></div>
                    </div>
                    <div class="pg-style-name">${escapeHtml(o.title)}</div>
                    <div class="pg-style-desc">${escapeHtml(o.desc)}</div>
                </div>`;
            }).join('')}</div>`;
        },
        promptBlock(answers) {
            const s = DESIGN_STYLES.find(x => x.value === answers.style) || DESIGN_STYLES[0];
            return `## 三、视觉风格
- **设计语言**: ${s.title}（${s.desc}）
- **背景 / 卡片 / 主色**: \`${s.bg}\` / \`${s.card}\` / \`${s.prim}\`
- **iconBg**: \`${s.iconBg}\``;
        },
    },

    // ── 4. 核心能力 ──
    {
        id: 'features', step: 4,
        title: '5. 核心能力',
        desc: '多选。勾选「AI 对话」会自动启用 AI API 调用，「本地存储」会自动生成 stores 声明',
        defaults: { features: [] },
        renderCard(answers) {
            return `<div class="pg-feature-grid">${CORE_FEATURES.map(o => {
                const arr = Array.isArray(answers.features) ? answers.features : [];
                const checked = arr.includes(o.value);
                return `<div class="pg-feature-card ${checked ? 'selected' : ''}" data-field="features" data-value="${escapeHtml(o.value)}">
                    <div class="pg-feature-check"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12" /></svg></div>
                    <div class="pg-feature-info">
                        <div class="pg-feature-title">${escapeHtml(o.title)}</div>
                        <div class="pg-feature-desc">${escapeHtml(o.desc)}</div>
                    </div>
                </div>`;
            }).join('')}</div>`;
        },
        promptBlock(answers) {
            const features = answers.features || [];
            if (!features.length) return '## 四、功能模块\n- （未选择，按最小可用 App 处理：仅灵动岛通知 + 默认页面）';
            return ['## 四、功能模块', ...features.map(f => `- ${FEATURE_MAP[f] || f}`)].join('\n');
        },
    },

    // ── 5. 小组件 ──
    {
        id: 'widget', step: 5,
        title: '6. 桌面小组件',
        desc: '是否需要桌面 widget？勾选后会生成对应 widgets 配置',
        defaults: { needWidget: false, widgetSizes: [] },
        renderCard(answers) {
            return `
                ${ui.group('是否需要小组件', ui.selectHeader(answers, '', 'needWidget', [
                    { value: 'true', title: '需要' },
                    { value: 'false', title: '不需要' },
                ]).replace(/data-field="needWidget"/, 'data-field="needWidget" data-bool="1"'))}
                ${answers.needWidget ? ui.group('组件尺寸（可多选）', ui.multiCards(answers, '', 'widgetSizes', WIDGET_SIZES)) : ''}
            `;
        },
        promptBlock(answers) {
            if (!answers.needWidget || !(answers.widgetSizes || []).length) return '## 五、小组件（Widget）\n- 此 App 不需要桌面小组件';
            return `## 五、小组件（Widget）
- **需要**: 是
- **支持的尺寸**: ${answers.widgetSizes.join(', ')}`;
        },
    },

    // ── 6. 灵动岛 ──
    {
        id: 'island', step: 6,
        title: '7. 灵动岛',
        desc: '是否需要灵动岛通知/状态？勾选后会生成 demoIsland / demoNotify 示例',
        defaults: { needIsland: false },
        renderCard(answers) {
            return ui.group('是否需要灵动岛', ui.selectHeader(answers, '', 'needIsland', [
                { value: 'true', title: '需要' },
                { value: 'false', title: '不需要' },
            ]).replace(/data-field="needIsland"/, 'data-field="needIsland" data-bool="1"'));
        },
        promptBlock(answers) {
            return `## 六、灵动岛（Dynamic Island）\n- **需要**: ${answers.needIsland ? '是（生成 demoIsland + demoNotify）' : '否'}`;
        },
    },

    // ── 7. AI 对话 ──
    {
        id: 'ai', step: 7,
        title: '8. AI 对话（可选）',
        desc: '勾选后会调用 window.__apiSdk + executeApiRequest；前提是用户在设置 → API 管理配了 key',
        defaults: { needAi: false },
        renderCard(answers) {
            return ui.group('是否需要 AI 对话能力', ui.selectHeader(answers, '', 'needAi', [
                { value: 'true', title: '需要' },
                { value: 'false', title: '不需要' },
            ]).replace(/data-field="needAi"/, 'data-field="needAi" data-bool="1"'));
        },
        promptBlock(answers) {
            return `## 七、AI API 接入\n- **需要**: ${answers.needAi ? '是（生成 callAi 方法 + executeApiRequest 调用示例）' : '否'}`;
        },
    },

    // ── 8. 世界观 ──
    {
        id: 'world', step: 8,
        title: '9. 读取世界观（可选）',
        desc: '勾选后会用 settingsSdk.worlds/places/chronology/timelines 读世界观的当前激活数据',
        defaults: { needWorld: false },
        renderCard(answers) {
            return ui.group('是否需要读世界观', ui.selectHeader(answers, '', 'needWorld', [
                { value: 'true', title: '需要' },
                { value: 'false', title: '不需要' },
            ]).replace(/data-field="needWorld"/, 'data-field="needWorld" data-bool="1"'));
        },
        promptBlock(answers) {
            return `## 八、世界观接入\n- **需要**: ${answers.needWorld ? '是（生成 readWorld 方法 + 等 settings-sdk-ready）' : '否'}`;
        },
    },

    // ── 9. 人设 ──
    {
        id: 'persona', step: 9,
        title: '10. 读取人设（可选）',
        desc: '勾选后会用 settingsSdk.aiPersons/persona.module/diary 读当前激活 AI 的人设 + 日记',
        defaults: { needPersona: false },
        renderCard(answers) {
            return ui.group('是否需要读人设', ui.selectHeader(answers, '', 'needPersona', [
                { value: 'true', title: '需要' },
                { value: 'false', title: '不需要' },
            ]).replace(/data-field="needPersona"/, 'data-field="needPersona" data-bool="1"'));
        },
        promptBlock(answers) {
            return `## 九、人设接入\n- **需要**: ${answers.needPersona ? '是（生成 readPersona 方法 + toolkit.persona.asset 桥示例）' : '否'}`;
        },
    },

    // ── 10. Prompt 库 ──
    {
        id: 'promptLib', step: 10,
        title: '11. Prompt 库（可选）',
        desc: '勾选后会用 settingsSdk.prompts.groups/prompts 读取用户启用的 prompt 组，注入到 AI 调用上下文',
        defaults: { needPrompt: false },
        renderCard(answers) {
            return ui.group('是否需要 Prompt 库', ui.selectHeader(answers, '', 'needPrompt', [
                { value: 'true', title: '需要' },
                { value: 'false', title: '不需要' },
            ]).replace(/data-field="needPrompt"/, 'data-field="needPrompt" data-bool="1"'));
        },
        promptBlock(answers) {
            return `## 十、Prompt 库接入\n- **需要**: ${answers.needPrompt ? '是（生成 readPrompts 方法 + settingsSdk.prompts.buildStack 集成示例）' : '否'}`;
        },
    },

    // ── 11. 完成页 ──
    {
        id: 'done', step: 11,
        title: '配置完成',
        desc: '共 11 步配置，点击下方按钮生成 Prompt',
        defaults: {},
        renderCard(answers) {
            const styleTitle = (DESIGN_STYLES.find(s => s.value === answers.style) || {}).title || '经典蓝';
            const topbarLabel = (TOPBAR_TYPES.find(t => t.value === answers.topbarType) || {}).label || '标准';
            return `
                <div class="pg-complete">
                    <div class="pg-complete-icon"><svg width="48" height="48" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="22" fill="#ECFDF5" stroke="#10B981" stroke-width="2" /><path d="M14 24L20 30L34 16" stroke="#10B981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" /></svg></div>
                    <div class="pg-complete-title">配置完成</div>
                    <div class="pg-complete-desc">点击下方按钮生成 Prompt</div>
                    <div class="pg-summary">
                        <div class="pg-summary-row"><span class="pg-summary-key">应用名称</span><span class="pg-summary-val">${escapeHtml(answers.appName || '未设置')}</span></div>
                        <div class="pg-summary-row"><span class="pg-summary-key">App ID</span><span class="pg-summary-val">${escapeHtml(answers.appId || '未设置')}</span></div>
                        <div class="pg-summary-row"><span class="pg-summary-key">页面结构</span><span class="pg-summary-val">${(answers.pages || []).length} 页 · ${answers.structure === 'tab' ? 'Tab' : '单页'}</span></div>
                        <div class="pg-summary-row"><span class="pg-summary-key">顶栏</span><span class="pg-summary-val">${escapeHtml(topbarLabel)}</span></div>
                        <div class="pg-summary-row"><span class="pg-summary-key">视觉风格</span><span class="pg-summary-val">${escapeHtml(styleTitle)}</span></div>
                        <div class="pg-summary-row"><span class="pg-summary-key">核心能力</span><span class="pg-summary-val">${(answers.features || []).length} 项</span></div>
                        <div class="pg-summary-row"><span class="pg-summary-key">小组件</span><span class="pg-summary-val">${answers.needWidget ? '需要' : '不需要'}</span></div>
                        <div class="pg-summary-row"><span class="pg-summary-key">灵动岛</span><span class="pg-summary-val">${answers.needIsland ? '需要' : '不需要'}</span></div>
                        <div class="pg-summary-row"><span class="pg-summary-key">AI 对话</span><span class="pg-summary-val">${answers.needAi ? '需要' : '不需要'}</span></div>
                        <div class="pg-summary-row"><span class="pg-summary-key">读世界观</span><span class="pg-summary-val">${answers.needWorld ? '需要' : '不需要'}</span></div>
                        <div class="pg-summary-row"><span class="pg-summary-key">读人设</span><span class="pg-summary-val">${answers.needPersona ? '需要' : '不需要'}</span></div>
                        <div class="pg-summary-row"><span class="pg-summary-key">Prompt 库</span><span class="pg-summary-val">${answers.needPrompt ? '需要' : '不需要'}</span></div>
                    </div>
                </div>
            `;
        },
        promptBlock() { return null; },
    },
];

// =========================================================================
// 通用 UI helpers（与旧版本一致，保持 CSS class 兼容）
// =========================================================================
const ui = {
    input(answers, appId, field, opts = {}) {
        const value = answers[field] ?? '';
        return `<input class="pg-input" type="text" placeholder="${escapeHtml(opts.placeholder || '')}" value="${escapeHtml(value)}" data-field="${escapeHtml(field)}" ${opts.readonly ? 'readonly' : ''} />`;
    },
    textarea(answers, appId, field, opts = {}) {
        const value = answers[field] ?? '';
        return `<textarea class="pg-textarea" placeholder="${escapeHtml(opts.placeholder || '')}" data-field="${escapeHtml(field)}"${opts.rows ? ` rows="${opts.rows}"` : ''}>${escapeHtml(value)}</textarea>`;
    },
    label(text) {
        return `<label class="pg-label">${escapeHtml(text)}</label>`;
    },
    selectHeader(answers, appId, field, options) {
        return `<div class="pg-header-grid" data-field="${escapeHtml(field)}">${options.map(o => {
            const cur = answers[field];
            const selected = cur === o.value || String(cur) === String(o.value);
            return `<div class="pg-header-item ${selected ? 'selected' : ''}" data-value="${escapeHtml(o.value)}"><div class="pg-header-item-title">${escapeHtml(o.title)}</div>${o.desc ? `<div class="pg-header-item-desc">${escapeHtml(o.desc)}</div>` : ''}</div>`;
        }).join('')}</div>`;
    },
    multiCards(answers, appId, field, options) {
        const arr = Array.isArray(answers[field]) ? answers[field] : [];
        return `<div class="pg-feature-grid">${options.map(o => {
            const checked = arr.includes(o.value);
            return `<div class="pg-feature-card ${checked ? 'selected' : ''}" data-field="${escapeHtml(field)}" data-value="${escapeHtml(o.value)}"><div class="pg-feature-check"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12" /></svg></div><div class="pg-feature-info"><div class="pg-feature-title">${escapeHtml(o.title)}</div><div class="pg-feature-desc">${escapeHtml(o.desc)}</div></div></div>`;
        }).join('')}</div>`;
    },
    pagesList(answers, appId, field) {
        const pages = answers[field] || [];
        return `<div class="pg-pages-list">${pages.map((pg, i) => `<div class="pg-page-item"><div class="pg-page-num">${i + 1}</div><div class="pg-page-fields"><input class="pg-input pg-input-sm" type="text" placeholder="页面名称" value="${escapeHtml(pg.name)}" data-field="${escapeHtml(field)}.${i}.name" /><input class="pg-input pg-input-sm" type="text" placeholder="页面描述" value="${escapeHtml(pg.desc)}" data-field="${escapeHtml(field)}.${i}.desc" /></div>${pages.length > 1 ? `<button class="pg-page-remove" data-remove-page="${i}">×</button>` : ''}</div>`).join('')}<button class="pg-add-page" data-action="addPage">+ 添加页面</button></div>`;
    },
    group(title, inner) {
        return `<div class="pg-input-group"><label class="pg-label">${escapeHtml(title)}</label>${inner}</div>`;
    },
};

// =========================================================================
// 科普抽屉渲染（顶部 / 底部抽屉 + 二级嵌套术语详情）
// 在任意页面的 renderPage 末尾调用：${renderGlossaryDrawer(app.state, app)}
// =========================================================================
function renderGlossaryDrawer(state, app) {
    const drawerGroupId = state && state.glossaryDrawer;
    if (!drawerGroupId) return '';
    const group = findGlossaryGroup(drawerGroupId);
    if (!group) return '';

    const termWord = state.glossaryTermWord || '';
    const term = termWord ? findGlossaryTerm(group.id, termWord) : null;
    const gid = escapeHtml(group.id);

    const maskHtml = `<div class="pg-glossary-modal-mask" data-app-action='{"action":"appMethod","method":"closeGlossaryDrawer","appId":"prompt-survey"}'></div>`;

    // ★ 修复"二级打开时还看到一级"：打开二级时只画 secondary，primary 整体退场。
    if (term) {
        return `
            ${maskHtml}
            <div class="pg-glossary-modal pg-glossary-modal-secondary" data-glossary-modal="secondary">
                <div class="pg-glossary-modal-header">
                    <div class="pg-glossary-modal-header-spacer"></div>
                </div>
                <div class="pg-glossary-modal-body">
                    <h2 class="pg-glossary-term-title">${escapeHtml(term.word)}</h2>
                    <div class="pg-glossary-term-pinyin">${escapeHtml(term.pronunciation || '')}</div>
                    <div class="pg-glossary-detail">
                        ${term.simple ? `<div class="pg-glossary-detail-block">
                            <div class="pg-glossary-detail-label">一句话翻译</div>
                            <div class="pg-glossary-detail-text">${escapeHtml(term.simple)}</div>
                        </div>` : ''}
                        ${term.realLife ? `<div class="pg-glossary-detail-block">
                            <div class="pg-glossary-detail-label">生活里的例子</div>
                            <div class="pg-glossary-detail-text">${escapeHtml(term.realLife)}</div>
                        </div>` : ''}
                        ${term.detail ? `<div class="pg-glossary-detail-block">
                            <div class="pg-glossary-detail-label">详细解释</div>
                            <div class="pg-glossary-detail-text">${escapeHtml(term.detail)}</div>
                        </div>` : ''}
                        ${term.contrast ? `<div class="pg-glossary-detail-block">
                            <div class="pg-glossary-detail-label">跟其他词比一比</div>
                            <div class="pg-glossary-detail-text">${escapeHtml(term.contrast)}</div>
                        </div>` : ''}
                        ${term.tip ? `<div class="pg-glossary-detail-block pg-glossary-tip">
                            <div class="pg-glossary-detail-label">写 prompt 时怎么用</div>
                            <div class="pg-glossary-detail-text">${escapeHtml(term.tip)}</div>
                        </div>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    return `
        ${maskHtml}
        <div class="pg-glossary-modal" data-glossary-modal="primary">
            <div class="pg-glossary-modal-header">
                <div class="pg-glossary-cat-icon" style="background: ${escapeHtml(group.iconBg)}">${escapeHtml(group.icon)}</div>
                <div class="pg-glossary-modal-title-block">
                    <h2 class="pg-glossary-title">${escapeHtml(group.title)}</h2>
                    <p class="pg-glossary-desc">${escapeHtml(group.desc)}</p>
                </div>
            </div>
            <div class="pg-glossary-modal-body">
                <div class="pg-glossary-term-list">
                    ${group.terms.map(t => `
                        <div class="pg-glossary-term-card" data-app-action='{"action":"appMethod","method":"openGlossaryTerm","payload":{"groupId":"${escapeHtml(group.id)}","word":"${escapeHtml(t.word)}"},"appId":"prompt-survey"}'>
                            <div class="pg-glossary-term-name">${escapeHtml(t.word)}</div>
                            <div class="pg-glossary-term-simple">${escapeHtml(t.simple)}</div>
                            <div class="pg-glossary-term-arrow">→</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

// =========================================================================
// 答案默认值（深合并一层 + 数组字段）
// =========================================================================
function applyDefaults(answers, prototypes) {
    const out = { ...answers };
    prototypes.forEach(p => {
        if (!p.defaults) return;
        Object.entries(p.defaults).forEach(([key, def]) => {
            if (out[key] === undefined || out[key] === null) {
                out[key] = Array.isArray(def) ? [...def] : (typeof def === 'object' && def !== null ? { ...def } : def);
            }
        });
    });
    return out;
}

// 点路径字段赋值
function setNestedValue(obj, dottedKey, value) {
    const parts = dottedKey.split('.');
    if (parts.length === 1) { obj[parts[0]] = value; return; }
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const seg = parts[i];
        const next = parts[i + 1];
        if (/^\d+$/.test(next)) {
            if (!Array.isArray(cur[seg])) cur[seg] = [];
            cur = cur[seg];
        } else {
            if (typeof cur[seg] !== 'object' || cur[seg] === null) cur[seg] = {};
            cur = cur[seg];
        }
    }
    cur[parts[parts.length - 1]] = value;
}

// 把问卷答案按 prototype 顺序拼成 markdown prompt（喂给 LLM 的部分）
function buildPromptBlocks(answers, prototypes) {
    const lines = [];
    prototypes.forEach(p => {
        if (typeof p.promptBlock !== 'function') return;
        const block = p.promptBlock(answers);
        if (block === null || block === undefined || block === '') return;
        lines.push(block);
        lines.push('');
    });
    return lines.join('\n');
}

// =========================================================================
// ★★★ 喂给 LLM 的完整 prompt 模板（与 App制作prompt.md 一一对应） ★★★
// =========================================================================
const PROMPT_HEAD = `你是一个**软件工程师**。下面我将给你一份新的工作内容指导方案，请你根据这份方案编写一个**完整的可以使用的软件**。

首先在技术层面上，本项目使用浏览器全局 Vue（\`js/vendor/vue.global.prod.js\`），你需要使用：**Vue 3.5+ 与 现代 ECMAScript 语法**（es2015+ 覆盖到 ES2024 引入的新特性）。

项目真实版本：\`vite@^5.4.10\` + \`tailwindcss@^3.4.19\` + Vue 是浏览器全局（\`js/vendor/vue.global.prod.js\`），不是 npm 依赖。

文件格式是 JavaScript ESM，不是 Vue SFC。导入方式用 ESM：\`import { escapeHtml } from '@/src/core/escape.js'\`（路径别名 \`@\` 指项目根）。

在不影响可读性的前提下请善用语法糖，但在使用语法糖时，请注意本项目中的 app 注册配置 \`appConfig\` 上，有 3 个 framework 直接调用、并会被注入 \`this\` 的函数字段：

1. \`methods: { ... }\` 用户的按钮、计算、改状态都走这里
2. \`services: { ... }\` 给别的 App 调用的对外接口
3. \`renderPage(content, page, app)\` 把页面渲染成 HTML 字符串

这 3 个函数字段内部必须写成方法简写形 —— \`name() { this.xxx }\`；禁止使用 \`=>\` 箭头语法写成 \`name: () => { this.xxx }\`，因为箭头函数会忽略 framework 注入的 this。

> 注意：上面说的是「framework 直接调用那层函数」—— 这 3 个函数字段内部嵌套的回调函数（setTimeout / forEach / Promise.then / 数组方法链的回调）可以用箭头语法，因为这些回调函数不需要 framework 注入的 this。

此外还有一个容易踩坑的细节：\`renderPage(content, page, app)\` 是从 appConfig 上拿出来**当独立函数**调用的，因此 \`this\` 已经丢失。

- ❌ 不要在 \`renderPage\` 内部使用 \`this.xxx\`
- ✅ 把渲染逻辑拆成模块顶层函数，\`renderPage\` 只做 \`if (page.id === 'xxx') return renderXxxPage(app)\` 的路由分发

### 一些注意事项

1. 因为 \`renderPage\` 返回字符串会走 Vue 的 HTML 插值指令 \`v-html\` 注入，所以 UI 用内联 HTML + Tailwind 类名（项目已经预编译 Tailwind 到 \`css/main.css\`）。**用户输入 / DB 读出的字符串必须 \`escapeHtml\`**，否则 XSS。
2. 如果要用 \`v-if\` 等 Vue 指令，需要把 appConfig 里的 \`renderMode\` 渲染模式字段对应的值改为 \`hybrid\`（默认值是 \`template\`）。要写完整 Vue 组件用 \`vue\`。
3. 不要写 \`target="_blank"\` 不带 \`rel="noopener noreferrer"\`；不要 \`eval\`；不要把用户输入 / DB 字段直接拼 HTML（必须 \`escapeHtml\`）。

### 你要做的 App

（由问卷「基本信息」自动拼装：appName / appId / 构造函数名 / appDesc）

### App 注册机制

- 每个 App 一个 JS 文件 \`js/apps/<appId>.js\`，default export 一个工厂函数
- 工厂返回的 \`appConfig\` 必须有：\`id\` / \`name\` / \`icon\` / \`pages[]\` / \`defaultRootPageId\` / \`renderPage()\` 这五项
- 在 \`js/apps/index.js\` 加 \`import\` 和 \`appFactories.push(...)\` 即可注册
- **不需要改 \`index.html\` / \`src/index.js\`**

### \`renderMode\` 字段说明

- \`'template'\`（默认）：\`renderPage\` 返回字符串，原样 \`v-html\` 注入
- \`'hybrid'\`：返回字符串 + 可嵌入 \`<component-island name="toggle" label="Wi-Fi" :value="true" />\`，framework 会扫描替换成真 Vue 组件
- \`'vue'\`：返回完整 Vue 组件配置，整块 \`Vue.createApp()\` 挂载

### XSS 防御（必做）

- \`renderPage\` 返回字符串走 \`v-html\` 注入，**用户输入 / 数据库字段必须 \`escapeHtml\`**
- 导入 \`import { escapeHtml } from '@/src/core/escape.js'\`
- icon / 固定 SVG / 框架常量 不需要 escape

### UI 约定

- 内联 HTML + Tailwind 类名
- 卡片：\`app-card bg-white/76\`
- 按钮：\`btn-primary\` / \`detail-link\` / \`app-btn\`
- iPhone 风格：柔和阴影、圆角、毛玻璃（\`backdrop-blur\`）

**可调用 API（this.toolkit.xxx）**

本项目不需要自己造 API，全部通过 \`this.toolkit\` 拿。

\`\`\`js
// 灵动岛
this.toolkit.island.notify(type, title, msg, opts?)           // type: 'success' | 'error' | 'info' | 'warning'
this.toolkit.island.show(size, payload)                       // size: 'mini' | 'medium' | 'large'
this.toolkit.island.toggle(size, payload)
this.toolkit.island.close(reason?)
this.toolkit.island.registerWidget(widgetConfig)
this.toolkit.island.previewWidget(qualifiedId, opts?)

// IndexedDB（先在 appConfig.stores 声明数据表）
this.toolkit.db.add(name, data)
this.toolkit.db.get(name, key)
this.toolkit.db.getAll(name, query?)
this.toolkit.db.put(name, data)
this.toolkit.db.remove(name, key)
this.toolkit.db.clear(name)
this.toolkit.db.count(name)

// 跨 App 共享记录
this.toolkit.shared.put(record)
this.toolkit.shared.get(id)
this.toolkit.shared.getAll(query?)
this.toolkit.shared.listByTarget(targetApp)

// 动作 / 跳转 / 弹窗
this.toolkit.actions.detail(pageId)
this.toolkit.actions.openApp(targetAppId, pageId?, payload?)
this.toolkit.actions.modal(modalType, payload)                // 'center' | 'prompt' | 'sheet' | 'toast' | 'confirm'
this.toolkit.actions.method(name, payload)
this.toolkit.actions.deepLink(target, payload)
this.toolkit.actions.share(record)

// 顶层 import 的动作构造器
import { createActionAttr, createDetailAction, createOpenAppAction,
         createAppMethodAction, createModalAction, createDeepLinkAction,
         createShareRecordAction } from '@/src/core/actions.js';
createActionAttr(action, appId)        // 直接拿 data-app-action 字符串拼进 HTML

// 设置页 / 渲染器 / 模板 / 图标
this.toolkit.builders.settings.row({ title, iconName, ... })
this.toolkit.builders.settings.group({ rows })
this.toolkit.renderers.renderActionButton(action, appId?)
this.toolkit.renderers.renderChevronRow(opts, appId?)
this.toolkit.templates.render('hero' | 'info-list' | 'share-card' | ... , payload)
this.toolkit.icons / toolkit.uiIcons / toolkit.uiSymbols
this.toolkit.tokens
\`\`\`

**系统事实表（window.settingsSdk）**

要拿人设 / 世界观 / 日记 / 日程 等跨 App 数据，统一走 \`window.settingsSdk\`。**不存在 toolkit.world / toolkit.persona / toolkit.social**。

\`\`\`js
const sdk = window.settingsSdk;
sdk.users.list()                       // 用户人设
sdk.aiPersons.list()                   // AI 人设
sdk.aiPersons.getActive()              // 当前激活 AI
sdk.worlds.list()                      // 世界观
sdk.worlds.getActive()
sdk.places.list({ worldRef })          // 地点
sdk.locations.list({ worldRef })       // 场所
sdk.chronology.format(ts, 'full', worldId)
sdk.timelines.list({ worldRef })
sdk.anchors.list({ worldRef, type })

sdk.persona.module.get(persona, 'preferences')    // 12 个可选模块
sdk.persona.phases.list(persona)
sdk.persona.probability.roll('ai', 'ai0')

sdk.diary.getToday('ai', 'ai0')                   // 今日日记
sdk.diary.addSegment('ai', 'ai0', date, { text, source })
sdk.schedule.getForEntity('ai', 'ai0')

// 资产桥（先 settings app 启动后才有，不是 settingsSdk 上的方法）
toolkit.persona.asset.snapshot('ai', 'ai0')
toolkit.persona.asset.adjust(delta, note, 'ai', 'ai0')
toolkit.persona.asset.settle('ai', 'ai0')
toolkit.persona.asset.addIncome(event, 'ai', 'ai0')

// Prompt 库（4 层：库 / 包 / 组 / 条目）
sdk.prompts.libraries.list()
sdk.prompts.packages.list({ libraryId })
sdk.prompts.groups.list({ enabled: true })
sdk.prompts.groups.get(id)
sdk.prompts.prompts.list({ groupId })
sdk.prompts.buildStack(ctx)                        // 拼装 prompt
\`\`\`

**AI API 调用（window.__apiSdk）**

设置 App 的「API 管理」里配置的 API key / 组，通过 \`window.__apiSdk\` 暴露（懒加载）：

\`\`\`js
const api = window.__apiSdk;            // { apiKeySdk, apiGroupSdk, apiUsageSdk }
if (!api) { /* 还没加载 / 没配置 key */ }

const keys = api.apiKeySdk.list();                          // 全部 key
const enabled = api.apiKeySdk.listEnabled();                // 仅启用的
const groups = api.apiGroupSdk.list();

import { executeApiRequest } from '@/js/apps/setting/api-manager/api-key-sdk.js';
const result = await executeApiRequest({
    apiKeyId: keys[0].id,
    endpoint: 'chat/completions',
    body: { messages: [{ role: 'user', content: '你好' }] },
    timeout: 60000,
});
// result = { success, data, usage: {inputTokens, outputTokens, totalTokens}, latency, apiKeyId }
\`\`\`

**Vue island（hybrid 模式用）**

framework 自动注册了 7 个 island 组件：

\`\`\`html
<component-island name="toggle"   label="Wi-Fi" :value="true"></component-island>
<component-island name="slider"   label="音量"   :min="0" :max="100" :value="50"></component-island>
<component-island name="input"    label="昵称"   placeholder="请输入" :value="nickname"></component-island>
<component-island name="textarea" label="备注"   :rows="3" :maxlength="200"></component-island>
<component-island name="select"   label="主题"   :options='[{"value":"light","label":"浅色"}]'></component-island>
<component-island name="list"     :items='[{"value":"a","label":"A"}]'></component-island>
<component-island name="counter"  label="数量"   :min="1" :max="99" :value="qty"></component-island>
\`\`\`

属性语法：字符串直接写 \`label="昵称"\`；布尔 / 数字带冒号 \`:value="true"\`；JSON 数组用单引号包 \`:options='[...]'\`。

监听 island 变化：在 \`methods\` 里声明 \`onIslandChange(methodName, value)\`，framework 会自动桥接 \`update:value\` 等事件。

**接入步骤（必走 3 步）**
1. 把生成的代码存为 \`js/apps/<appId>.js\`，default export 工厂函数 \`create<Name>App\`
2. 在 \`js/apps/index.js\` 加 \`import\` 和 \`appFactories.push({ name: '<appId>', factory: create<Name>App })\`
3. 刷新浏览器，桌面应该出新图标

---

## 用户配置（按问卷答案拼装）

`;

const PROMPT_TAIL = `

---

## 完整 appConfig 模板

\`\`\`js
// js/apps/<appId>.js
import { createActionAttr } from '@/src/core/actions.js';
import { escapeHtml } from '@/src/core/escape.js';

export default function createAppSpec() {
    return {

        // ===== 一、基础信息 =====
        id: \`<appId>\`,
        name: \`<appName>\`,
        icon: \`<SVG 占位，业务作者后续替换>\`,
        iconBg: \`<由 style 自动推出的渐变>\`,

        // ===== 二、App 主题颜色（由 style 推出） =====
        background: \`<由 style 推出>\`,
        statusBarColor: \`<由 style 推出>\`,
        homeIndicatorColor: \`<由 style 推出>\`,

        // ===== 三、Dock =====
        dock: { visible: true, order: 10 },

        // ===== 四、顶部条 =====
        topbar: {
            visible: true,
            type: \`<topbarType>\`,
            title: \`<appName>\`,
            ...(topbarType === 'standard' || topbarType === 'large-title'
                ? { subtitle: '可选副标题' } : {}),
        },

        // ===== 五、导航栏（仅 tab 结构需要） =====
        ...(structure === 'tab' ? {
            nav: { type: 'tab' },
            pages: [
                ...pages.map((p, i) => ({ id: toId(p.name), label: p.name, icon: '◦', nav: true })),
            ],
        } : {
            pages: [{ id: 'main', label: '主', icon: '◦', nav: false }],
        }),
        defaultRootPageId: structure === 'tab' ? toId(pages[0].name) : 'main',

        // ===== 六、数据表声明（仅当 features 含 db 时） =====
        ...(features.includes('db') ? {
            stores: [{ name: '<appId>Items', keyPath: 'id' }],
        } : {}),

        // ===== 七、初始 state =====
        setup({ toolkit, app }) {
            return { items: [], loading: false };
        },

        // ===== 八、业务方法 =====
        methods: {
            demoNotify() {
                this.toolkit.island.notify('success', '已保存', '数据已写入');
            },

            // ★ DB（仅当 features 含 db）
            ...(features.includes('db') ? {
                async addItem(text) {
                    await this.toolkit.db.add('<appId>Items', { id: \`item-\${Date.now()}\`, text, createdAt: Date.now() });
                    this.toolkit.island.notify('success', '已添加', text);
                },
            } : {}),

            // ★ AI（仅当 needAi）
            ...(needAi ? {
                async callAi(userText) {
                    const api = window.__apiSdk;
                    if (!api) {
                        this.toolkit.island.notify('warning', '请先配置 API Key', '设置 → API 管理');
                        return null;
                    }
                    const key = api.apiKeySdk.listEnabled()[0];
                    if (!key) {
                        this.toolkit.island.notify('warning', '没有可用的 API Key', '');
                        return null;
                    }
                    const { executeApiRequest } = await import('@/js/apps/setting/api-manager/api-key-sdk.js');
                    const result = await executeApiRequest({
                        apiKeyId: key.id,
                        endpoint: 'chat/completions',
                        body: { messages: [{ role: 'user', content: userText }] },
                    });
                    if (!result.success) {
                        this.toolkit.island.notify('error', '调用失败', result.error || '');
                        return null;
                    }
                    return result.data?.choices?.[0]?.message?.content;
                },
            } : {}),

            // ★ 世界观（仅当 needWorld）
            ...(needWorld ? {
                readWorld() {
                    const sdk = window.settingsSdk;
                    if (!sdk) return null;
                    const worldId = sdk.worlds.getActiveId();
                    return {
                        world: sdk.worlds.getActive(),
                        places: sdk.places.list({ worldRef: worldId }),
                        chrono: sdk.chronology.getConfig(worldId),
                        events: sdk.timelines.list({ worldRef: worldId }),
                    };
                },
            } : {}),

            // ★ 人设（仅当 needPersona）
            ...(needPersona ? {
                readPersona() {
                    const sdk = window.settingsSdk;
                    if (!sdk) return null;
                    const ai = sdk.aiPersons.getActive();
                    if (!ai) return null;
                    return {
                        persona: ai,
                        module: (mk) => sdk.persona.module.get(ai, mk),
                        today: sdk.diary.getToday('ai', ai.id),
                        snapshot: this.toolkit.persona.asset?.snapshot?.('ai', ai.id),
                    };
                },
            } : {}),

            // ★ Prompt 库（仅当 needPrompt）
            ...(needPrompt ? {
                async readPrompts() {
                    const sdk = window.settingsSdk;
                    if (!sdk?.prompts) return [];
                    return sdk.prompts.groups.list({ enabled: true });
                },
                async buildPromptContext() {
                    const sdk = window.settingsSdk;
                    if (!sdk?.prompts) return '';
                    return sdk.prompts.buildStack({
                        ai: sdk.aiPersons.getActive(),
                        user: sdk.users.getActive?.() || {},
                        world: sdk.worlds.getActive(),
                        now: Date.now(),
                    });
                },
            } : {}),
        },

        // ===== 九、对外 services =====
        services: {
            async getItems() { return this.app.state.items || []; },
            async handleDeepLink(payload) { /* 其他 App deepLink 进来时 */ },
        },

        // ===== 十、渲染 =====
        renderMode: 'template',

        // ★ renderPage 必须是顶层函数分发的入口（this 已丢失）
        renderPage(content, page, app) {
            if (page.id === '<main>') return renderHomePage(app);
            return window.createDefaultPageRenderer(content, page, app);
        },

        renderDetailPage(content, page, app) {
            return window.createDefaultDetailRenderer(content, page, app);
        },

        // ===== 十一、桌面小组件（仅当 needWidget） =====
        ...(needWidget ? {
            widgets: [{
                id: 'quick-item',
                label: '快速项',
                icon: \`<SVG>\`,
                iconBg: \`<由 style 推出>\`,
                defaultSize: widgetSizes[0] || 'S',
                defaultOrientation: 'h',
                render(size, payload = {}) {
                    const label = escapeHtml(payload.label || '');
                    const count = payload.count ?? 0;
                    return \`<div class="p-3">
                        <div class="text-2xl font-bold">\${count}</div>
                        <div class="text-xs text-gray-500">\${label}</div>
                    </div>\`;
                },
            }],
        } : {}),
    };
}

// ★ 顶层渲染函数：renderPage 内部用
function renderHomePage(app) {
    const items = app.state?.items || [];
    const action = createActionAttr({ action: 'appMethod', method: 'addItem', payload: { text: '示例' } }, app.id);
    const listHtml = items.map(it => \`
        <div class="app-card">
            <div class="text-sm font-medium">\${escapeHtml(it.text)}</div>
        </div>
    \`).join('');

    return \`
        <div class="space-y-3">
            <section class="app-card bg-white/76">
                <div class="text-[20px] font-bold text-slate-900">欢迎使用 <appName></div>
                <div class="mt-2 text-sm text-slate-600">\${escapeHtml(appDesc)}</div>
                <button class="btn-primary mt-4" \${action}>演示灵动岛</button>
            </section>
            \${listHtml}
        </div>
    \`;
}

function toId(name) {
    return String(name || '').toLowerCase().replace(/[^a-z0-9一-龥]+/g, '-').replace(/^-+|-+$/g, '') || 'page';
}
\`\`\`

---

## 已知 Bug 与必避陷阱

### renderPage 内部不能用 \`this\`

\`renderPage\` 是从 appConfig 上拿出来当独立函数调用的，this 已丢失。

### methods / services 内部必须用方法简写

\`\`\`js
methods: {
    async save() { this.xxx; }   // ✅
    save: async () => { this.xxx; }  // ❌ 箭头函数 this 丢失
}
\`\`\`

### 数据表必须声明

用了 \`toolkit.db\` 但 \`stores\` 没声明会抛「未声明的数据表」错误。

### XSS

\`renderPage\` / widget \`render\` 返回字符串经 \`v-html\` 注入，**用户输入 / DB 字段必须 escapeHtml**。

### settingsSdk 可能未就绪

不要直接 \`window.settingsSdk.aiPersons.list()\`。要 await \`settings-sdk-ready\` 事件或 \`whenSettingsSdkReady()\`。

### \`__apiSdk\` 是懒加载

第一次访问 settings App 的 API 管理面板才挂上。**用户没配 key 时是 null**，要判空。

### framework 已知 Bug（必须知晓，写代码时要绕开）

#### Bug #1：顶栏视觉断层

- **症状**：\`appConfig.topbar.bg\` 设为非透明色（solid / gradient / rgba...）时，状态栏悬浮在 nav bar 上方，与 nav bar 形成视觉断层。违反 iOS HIG「Continuous Background」原则。
- **相关代码**：
  - \`js/framework/use-app-navigation.js\`  L45-58     topbarStyle 计算
  - \`js/framework/use-app-navigation.js\`  L109-148   statusBar*（颜色 / 样式 / 可见性）
  - \`app-shell\` 组件                              statusbar + navbar 渲染顺序
- **术语**：Status bar / nav bar discontinuity / "Status bar floats above navbar"
- **修复方向（三选一）**：
  - A. statusbar 容器与 navbar 共享同一父节点 + 同一背景
  - B. statusbar 不再独立容器，挪进 navbar 顶部内嵌
  - C. CSS 变量 \`--topbar-bg\` 同时驱动 statusbar + navbar 的 background
- **状态**：未修复，等待开工
- **对业务 App 的建议**：\`topbar.bg\` 留 \`blur\` / \`transparent\`，避免触发此 Bug

#### Bug #2：\`__detailRenderTick\` 双 ref 重复声明

- **症状**：设置 app（或所有 \`xxxRoute({ sub: 'edit' })\` 类业务方法）切子页 / 改 state 后，当前 detail 页不立即重渲。必须「切走再切回」或「关闭再打开」才生效。app 端写的 \`window.__detailRenderTick.value++\` 与 \`__phoneAppsRef\` 强制刷新看起来跑了但 computed 不动。
- **根因（两处同名 ref，互相看不见）**：
  - \`core-shim.js\`          L158  声明 \`const detailRenderTick = Vue.ref(0)\`
  - \`use-app-navigation.js\` L29   声明 \`const detailRenderTick = Vue.ref(0)\`
  - \`syncRegisteredApps\` 自增的是 core-shim 自己闭包里的 ref
  - \`useAppNavigation\` 里 \`currentDetailView\`（computed, L95）依赖的是它自己闭包里的 ref
  - 两个 ref 不是同一对象 → \`__detailRenderTick.value++\` 不通知 computed
  - 「切走再切回」能恢复：靠 activeAppId / currentDetailPage 变化触发 computed 重算，不靠 tick
- **修复（确保全局只 \`Vue.ref(0)\` 一次）**：
  1. \`use-app-navigation.js\`    return 里暴露 \`detailRenderTick\`
  2. \`core-shim.js\`             删掉自己的 ref；把 \`useAppNavigation\` 调用提前到 \`syncRegisteredApps\` 之前
  3. \`syncRegisteredApps\`       改成 \`navigation.detailRenderTick.value++\`
  4. \`appConfig bridge\`（L498）  改成 \`detailRenderTick: navigation.detailRenderTick\`
- **关键教训（给 AI 编程助手）**：
  - \`window.__xxx\` 暴露 ref 时保证整个项目只有一处 \`Vue.ref(0)\`
  - Vue computed 的依赖靠**闭包内的变量名解析**，不是 ref 引用本身——同名变量遮蔽 = 依赖丢失
  - 诊断信号：\`tick.value++\` 跑了但 computed 不重算 → 多半两个 ref 不是同一个
  - 优先通过 \`return\` 暴露而非 \`window.__xxx\`；后者是最后手段，需要中央登记避免重复声明
- **状态**：根因分析完整，修复方案已出，待落实
- **对业务 App 的建议**：通过切页触发重渲，不要依赖 \`__detailRenderTick.value++\` 强制刷新（无效）

---

## checklist

- [ ] 工厂函数 \`createXxxApp\` 已 default export
- [ ] \`id\` 唯一，kebab-case
- [ ] \`icon\` 是有效 SVG
- [ ] \`pages[]\` 至少 1 项，\`defaultRootPageId\` 在其中
- [ ] \`renderPage\` 存在，内部**不**用 \`this\`
- [ ] \`methods\` 用方法简写，**不**用箭头
- [ ] 用到的 store 都在 \`stores\` 声明
- [ ] 用户输入 / DB 字段都过 \`escapeHtml\`
- [ ] 用了 \`settingsSdk\` 的 await \`settings-sdk-ready\` 事件
- [ ] 用了 \`__apiSdk\` 的先判空再调
- [ ] 没在 \`renderPage\` 内部用 \`this\`
- [ ] 没写 \`target="_blank"\` 不带 \`rel="noopener noreferrer"\`
- [ ] 没 \`eval\` / 没拼用户输入到 JS 字符串
`;

function buildFullPrompt(answers) {
    const userConfig = buildPromptBlocks(answers, QUESTION_PROTOTYPES);
    return `${PROMPT_HEAD}${userConfig}${PROMPT_TAIL}`;
}

// =========================================================================
// App 工厂
// =========================================================================
export default function createPromptSurveyApp() {
    return {
        id: 'prompt-survey',
        name: 'App制作',
        icon: `
            <svg viewBox="0 0 60 60" width="60" height="60" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="8" width="48" height="44" rx="16" fill="rgba(255,255,255,0.24)" />
                <rect x="14" y="18" width="22" height="5" rx="2.5" fill="white" fill-opacity="0.96" />
                <rect x="14" y="28" width="30" height="4" rx="2" fill="white" fill-opacity="0.78" />
                <rect x="14" y="36" width="18" height="4" rx="2" fill="white" fill-opacity="0.7" />
                <circle cx="44" cy="38" r="8" fill="white" fill-opacity="0.92" />
                <path d="M41.5 38.5L43.5 40.5L47.5 35.5" stroke="#7C3AED" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
        `,
        iconBg: 'linear-gradient(135deg, #8b5cf6 0%, #38bdf8 100%)',
        background: 'linear-gradient(180deg, #eef2ff 0%, #faf5ff 60%, #ffffff 100%)',
        statusBarColor: '#312e81',
        homeIndicatorColor: 'rgba(99,102,241,0.28)',
        dock: { visible: true, order: 0 },
        topbar: { visible: true, title: 'App 制作', subtitle: '打造专属应用' },
        nav: { type: 'tab' },
        pages: [
            { id: 'intro', label: '说明', icon: '◦', nav: true },
            { id: 'form',  label: '配置', icon: '◦', nav: true },
            { id: 'result', label: '代码', icon: '◦', nav: true },
        ],
        defaultRootPageId: 'intro',

        setup() {
            const answers = applyDefaults({}, QUESTION_PROTOTYPES);
            const rawState = {
                wizardStep: 0,
                answers,
                copied: false,
                // ★ 科普抽屉状态：null 关闭 / groupId 打开某分类抽屉
                glossaryDrawer: null,
                // ★ 抽屉里当前选中的术语（点术语又开二级抽屉）
                glossaryTermWord: '',
            };
            if (typeof window !== 'undefined' && window.Vue && typeof window.Vue.reactive === 'function') {
                return window.Vue.reactive(rawState);
            }
            return rawState;
        },

        methods: {
            _forceRerender() {
                if (typeof window !== 'undefined' && window.__detailRenderTick?.value !== undefined) {
                    window.__detailRenderTick.value += 1;
                }
                window.refreshPhoneApps?.();
            },

            setAnswer(payload, value) {
                if (!this.app.state) return;
                let field, val, silent = false;
                if (payload && typeof payload === 'object') {
                    field = payload.field;
                    val = payload.value;
                    silent = payload.silent === true;
                } else { field = payload; val = value; }
                if (!field) return;
                const answers = this.app.state.answers;
                if (val === 'true') val = true;
                else if (val === 'false') val = false;
                setNestedValue(answers, field, val);
                this.app.state.copied = false;
                // 实时输入（input/textarea/change 事件）走 silent 路径：
                // 只写 state，不触发 v-html 重渲。否则每次按键都会把整块 DOM 重建，
                // 导致 input 节点被销毁、焦点丢失（手机端尤其明显，必须再点一次）。
                if (!silent) this._forceRerender();
            },

            setTopbarType(payload) {
                const value = payload && typeof payload === 'object' ? payload.value : payload;
                if (!value) return;
                this.app.state.answers.topbarType = value;
                this.app.state.copied = false;
                this._forceRerender();
            },

            toggleFeature(payload) {
                const value = payload && typeof payload === 'object' ? payload.value : payload;
                if (!value) return;
                const features = this.app.state.answers.features || [];
                const idx = features.indexOf(value);
                if (idx >= 0) features.splice(idx, 1);
                else features.push(value);
                this.app.state.answers.features = [...features];
                this.app.state.copied = false;
                // 同步切换 widgetSizes
                if (features.indexOf(value) === -1 && (value === 'ai' || value === 'db')) {
                    // 撤掉 ai/db 也无所谓，stores / methods 都靠 answers.features 判断
                }
            },

            toggleWidgetSize(payload) {
                const value = payload && typeof payload === 'object' ? payload.value : payload;
                if (!value) return;
                const sizes = this.app.state.answers.widgetSizes || [];
                const idx = sizes.indexOf(value);
                if (idx >= 0) sizes.splice(idx, 1);
                else sizes.push(value);
                this.app.state.answers.widgetSizes = [...sizes];
                this.app.state.copied = false;
            },

            addPage() {
                const pages = this.app.state.answers.pages || [];
                pages.push({ name: '', desc: '' });
                this.app.state.answers.pages = [...pages];
                this._forceRerender();
            },

            removePage(payload) {
                const idx = payload && typeof payload === 'object' ? payload.idx : payload;
                const pages = this.app.state.answers.pages || [];
                if (pages.length > 1 && Number.isInteger(idx)) {
                    pages.splice(idx, 1);
                    this.app.state.answers.pages = [...pages];
                    this._forceRerender();
                }
            },

            nextStep() {
                const TOTAL = QUESTION_PROTOTYPES.length;
                if (this.app.state.wizardStep < TOTAL - 1) {
                    this.app.state.wizardStep++;
                    this._forceRerender();
                }
            },

            prevStep() {
                if (this.app.state.wizardStep > 0) {
                    this.app.state.wizardStep--;
                    this._forceRerender();
                }
            },

            copyPrompt() {
                const prompt = this.methods.generatePrompt();
                try {
                    navigator.clipboard?.writeText(prompt);
                } catch (_) {
                    try {
                        const ta = document.createElement('textarea');
                        ta.value = prompt;
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand('copy');
                        document.body.removeChild(ta);
                    } catch (_) {}
                }
                this.app.state.copied = true;
                this.toolkit.island.notify('success', '已复制', 'Prompt 已复制到剪贴板');
                this._forceRerender();
            },

            generatePrompt() {
                return buildFullPrompt(this.app.state.answers);
            },

            // ========== 科普抽屉（在当前说明页原地弹出） ==========
            openGlossaryGroup(payload) {
                const groupId = payload && typeof payload === 'object' ? payload.groupId : '';
                console.log('[psg] openGlossaryGroup', groupId, 'state typeof=', typeof this.app.state, 'isReactive=', !!(this.app.state && (this.app.state.__v_isReactive || this.app.state.__v_raw)));
                if (!groupId) return;
                if (!this.app.state) return;
                this.app.state.glossaryDrawer = groupId;
                this.app.state.glossaryTermWord = '';
                console.log('[psg] after set drawer=', this.app.state.glossaryDrawer, 'override=', window.__appTopbarOverride && JSON.parse(JSON.stringify(window.__appTopbarOverride.value || null)));
                this._forceRerender();
            },

            openGlossaryTerm(payload) {
                const groupId = payload && typeof payload === 'object' ? payload.groupId : '';
                const word = payload && typeof payload === 'object' ? payload.word : '';
                if (!groupId || !word) return;
                this.app.state.glossaryDrawer = groupId;
                this.app.state.glossaryTermWord = word;
                this._forceRerender();
            },

            closeGlossaryDrawer() {
                if (!this.app || !this.app.state) return;
                this.app.state.glossaryDrawer = null;
                this.app.state.glossaryTermWord = '';
                this._forceRerender();
            },

            closeGlossaryTerm() {
                // 从二级返回一级：只清掉 termWord，保留 glossaryDrawer
                this.app.state.glossaryTermWord = '';
                this._forceRerender();
            },
        },

        renderPage(content, page, app) {
            const a = app.state?.answers || {};
            const step = app.state?.wizardStep || 0;
            const esc = escapeHtml;

            // ========== 第一页：说明 ==========
            if (page.id === 'intro') {
                return `
                    <div class="pg-intro">
                        <div class="pg-intro-header">
                            <div class="pg-intro-icon">
                                <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
                                    <rect x="4" y="6" width="40" height="36" rx="12" fill="url(#introGrad)" />
                                    <rect x="10" y="14" width="18" height="4" rx="2" fill="white" opacity="0.9" />
                                    <rect x="10" y="22" width="24" height="3" rx="1.5" fill="white" opacity="0.7" />
                                    <rect x="10" y="29" width="14" height="3" rx="1.5" fill="white" opacity="0.6" />
                                    <circle cx="34" cy="30" r="6" fill="white" opacity="0.85" />
                                    <path d="M32 30.5L33.5 32L36 29" stroke="#7C3AED" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                                    <defs>
                                        <linearGradient id="introGrad" x1="4" y1="6" x2="44" y2="42" gradientUnits="userSpaceOnUse">
                                            <stop stop-color="#8B5CF6" />
                                            <stop offset="1" stop-color="#38BDF8" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>
                            <h1 class="pg-intro-title">App 制作器</h1>
                            <p class="pg-intro-desc">11 步配置 · 生成专属应用开发 Prompt</p>
                        </div>
                        <div class="pg-glossary-section">
                            <div class="pg-glossary-section-title">不会描述？先查查术语</div>
                            <div class="pg-glossary-section-sub">点击下面的分类，进入「小白科普」找找你要的专业说法。</div>
                            <div class="pg-glossary-grid">
                                ${GLOSSARY_GROUPS.map(g => `
                                    <div class="pg-glossary-card" data-glossary-group="${escapeHtml(g.id)}" data-app-action='{"action":"appMethod","method":"openGlossaryGroup","payload":{"groupId":"${escapeHtml(g.id)}"},"appId":"prompt-survey"}'>
                                        <div class="pg-glossary-card-icon" style="background: ${escapeHtml(g.iconBg)}">${escapeHtml(g.icon)}</div>
                                        <div class="pg-glossary-card-body">
                                            <div class="pg-glossary-card-title">${escapeHtml(g.title)}</div>
                                            <div class="pg-glossary-card-desc">${escapeHtml(g.desc)}</div>
                                            <div class="pg-glossary-card-meta">${g.terms.length} 个术语 →</div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        <button class="pg-btn-primary" ${createActionAttr({ action: 'switchPage', pageId: 'form' }, app.id)}>
                            开始配置
                        </button>
                    </div>
                    ${renderGlossaryDrawer(app.state, app)}
                `;
            }

            // ========== 第二页：配置向导 ==========
            if (page.id === 'form') {
                const TOTAL = QUESTION_PROTOTYPES.length;
                const pct = Math.round((step / (TOTAL - 1)) * 100);
                const prototype = QUESTION_PROTOTYPES[step] || QUESTION_PROTOTYPES[QUESTION_PROTOTYPES.length - 1];
                const cardHtml = prototype.renderCard(a);

                return `
                    <div class="pg-wizard">
                        <div class="pg-progress">
                            <div class="pg-progress-bar" style="width: ${pct}%"></div>
                        </div>
                        <div class="pg-card-wrapper">
                            <div class="pg-card active">
                                <div class="pg-question-title">${esc(prototype.title)}</div>
                                <div class="pg-question-desc">${esc(prototype.desc)}</div>
                                ${cardHtml}
                            </div>
                        </div>
                        <div class="pg-footer">
                            ${step > 0 ? `
                                <button class="pg-btn pg-btn-back" ${createActionAttr({ action: 'appMethod', method: 'prevStep', payload: {} }, app.id)}>返回</button>
                            ` : '<div></div>'}
                            ${step < TOTAL - 1 ? `
                                <button class="pg-btn pg-btn-next" ${createActionAttr({ action: 'appMethod', method: 'nextStep', payload: {} }, app.id)}>
                                    下一步
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                                </button>
                            ` : `
                                <button class="pg-btn pg-btn-next pg-btn-generate" ${createActionAttr({ action: 'switchPage', pageId: 'result' }, app.id)}>
                                    生成 Prompt
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                                </button>
                            `}
                        </div>
                    </div>
                `;
            }

            // ========== 第三页：Prompt 结果 ==========
            if (page.id === 'result') {
                const prompt = app.methods.generatePrompt();
                const lineCount = prompt.split('\n').length;
                const sizeKB = Math.round(prompt.length / 1024 * 10) / 10;
                return `
                    <div class="pg-result">
                        <div class="pg-result-header-actions">
                            <button class="pg-btn pg-btn-copy ${app.state.copied ? 'copied' : ''}" ${createActionAttr({ action: 'appMethod', method: 'copyPrompt' }, app.id)}>
                                ${app.state.copied ? `
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12" /></svg>
                                    已复制
                                ` : `
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                                    复制
                                `}
                            </button>
                            <button class="pg-btn pg-btn-secondary pg-btn-edit" ${createActionAttr({ action: 'switchPage', pageId: 'form' }, app.id)}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                继续编辑
                            </button>
                        </div>
                        <div class="pg-result-info">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="#10B981" />
                            </svg>
                            <div>
                                <div class="pg-result-title">Prompt 实时预览</div>
                                <div class="pg-result-sub">${lineCount} 行 · ${sizeKB}KB · 自动同步更新</div>
                            </div>
                        </div>
                        <div class="pg-result-preview">
                            <pre class="pg-code-block">${escapeHtml(prompt)}</pre>
                        </div>
                    </div>
                `;
            }

            return createDefaultPageRenderer(content, page, app);
        },
    };
}

// =========================================================================
// 输入 / 点击事件转发（保持 framework 兼容）
// =========================================================================
(function bindPromptSurveyInputs() {
    const APP_ID = 'prompt-survey';

    function isInPromptSurveyShell(target) {
        return !!(target instanceof HTMLElement) && !!target.closest('.app-shell');
    }

    function setAnswer(field, value, silent) {
        if (!externalAppRegistry) return;
        try {
            // 实时输入（input/change 事件）传 silent=true，setAnswer 内部只写 state、不触发 v-html 重渲，
            // 避免每次按键都把整块 DOM 重建导致 input 节点销毁、手机端焦点丢失。
            externalAppRegistry.invokeMethod(APP_ID, 'setAnswer', { field, value, silent: !!silent });
            if (!silent) {
                setTimeout(() => {
                    try { externalAppRegistry.invokeMethod(APP_ID, '_forceRerender', {}); } catch (_) {}
                }, 10);
            }
        } catch (e) {
            console.warn('[prompt-survey] setAnswer failed', e);
        }
    }

    function toggleArray(field, value) {
        if (!externalAppRegistry) return;
        const method = field === 'features' ? 'toggleFeature' : 'toggleWidgetSize';
        try {
            externalAppRegistry.invokeMethod(APP_ID, method, { value });
            setTimeout(() => {
                try { externalAppRegistry.invokeMethod(APP_ID, '_forceRerender', {}); } catch (_) {}
            }, 10);
        } catch (e) {
            console.warn('[prompt-survey] toggle failed', e);
        }
    }

    // ★ 焦点防线：撤回。
    // 之前尝试过"输入后兜底 focus()"，结果是：
    //   1) 80ms 后 focus → 抢 IME 焦点 → 拼音出不来
    //   2) 节点销毁时 focus → IME 还在拼音选择阶段时被打断
    // 结论：system 层（v-html 重建 / IME）自己管理焦点，业务层不要瞎抢。
    // 真正修复走的是 setAnswer(silent=true) 不触发 _forceRerender，让 v-html 不重建。

    // ★ 焦点 / IME 终极修复（system 层）：
    // 核心问题：每次 input 事件 → setAnswer → setNestedValue → 修改 Vue reactive state
    // → answers[field] 在 v-html 模板里被读 → Vue 触发 v-html 重渲 → input 节点销毁 → 焦点丢失。
    //
    // 修复策略：input 期间**完全不动 reactive state**。Vue 不知道值变了，就不重渲。
    //   - input 事件：只把最新值缓存到 target.__psLiveValue（DOM 上挂的临时字段）。
    //   - blur / change 事件：才把值回写到 app.state.answers，让 UI 同步。
    //   - debounce 600ms 后写 DB，避免每个字符都进 IndexedDB。
    //   - compositionend 时也回写（IME 中文选词结束 → 输入落定）。
    const pendingWrites = new Map(); // field → { value, timer }
    function commitToState(field, value) {
        // 这里调用 setAnswer 时 silent=true，仍会触发 Vue 重渲（因 answers 变了）。
        // 所以只在用户真正"完成输入"（blur / change / 选词结束）时才调。
        try { externalAppRegistry.invokeMethod(APP_ID, 'setAnswer', { field, value, silent: true }); } catch (_) {}
        try { externalAppRegistry.invokeMethod(APP_ID, '_forceRerender', {}); } catch (_) {}
    }
    function schedulePersist(field, value) {
        const prev = pendingWrites.get(field);
        if (prev && prev.timer) clearTimeout(prev.timer);
        const timer = setTimeout(() => {
            pendingWrites.delete(field);
            try {
                const db = window.__listenToolkit && window.__listenToolkit.db;
                if (db && typeof db.put === 'function') {
                    db.put('promptSurveyAnswers', { id: field, value });
                }
            } catch (_) {}
        }, 600);
        pendingWrites.set(field, { value, timer });
    }

    document.addEventListener('input', event => {
        const target = event.target;
        if (!isInPromptSurveyShell(target)) return;
        const field = target.getAttribute('data-field');
        if (!field) return;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
        // ★ 关键：只挂 DOM 上，不动 reactive state。
        target.__psLiveValue = target.value;
        window.__ps_lastInputAt = Date.now();
        // 不再调 setAnswer —— 见上方注释。
        schedulePersist(field, target.value);
    }, true);

    // 选词结束 / 失焦时回写 state，让 UI 显示也跟着同步
    function flushFromTarget(target) {
        if (!target || !target.getAttribute) return;
        const field = target.getAttribute('data-field');
        if (!field) return;
        const value = target.__psLiveValue != null ? target.__psLiveValue : target.value;
        commitToState(field, value);
    }

    document.addEventListener('compositionend', event => {
        if (!isInPromptSurveyShell(event.target)) return;
        flushFromTarget(event.target);
    }, true);

    document.addEventListener('change', event => {
        const target = event.target;
        if (!isInPromptSurveyShell(target)) return;
        const field = target.getAttribute('data-field');
        if (!field) return;
        if (target.type === 'checkbox' || target.type === 'radio') {
            // 复选框 / 单选 → 即时回写（不会触发文本输入的重渲链）
            commitToState(field, target.checked);
        } else {
            flushFromTarget(target);
        }
    }, true);

    document.addEventListener('focusout', event => {
        if (!isInPromptSurveyShell(event.target)) return;
        flushFromTarget(event.target);
    }, true);

    document.addEventListener('change', event => {
        const target = event.target;
        if (!isInPromptSurveyShell(target)) return;
        const field = target.getAttribute('data-field');
        if (field && (target.type === 'checkbox' || target.type === 'radio')) {
            setAnswer(field, target.checked, true);
        }
    }, true);

    document.addEventListener('click', event => {
        const shell = event.target.closest && event.target.closest('.app-shell');
        if (!shell) return;

        const actionEl = event.target.closest('[data-app-action]');
        if (actionEl) return;

        const headerItem = event.target.closest('.pg-header-item[data-value]');
        if (headerItem) {
            const grid = headerItem.parentElement;
            const field = grid.getAttribute('data-field');
            if (!field || headerItem.hasAttribute('data-readonly')) return;
            const value = headerItem.getAttribute('data-value');
            const isBool = grid.hasAttribute('data-bool');
            setAnswer(field, isBool ? (value === 'true') : value);
            event.stopPropagation();
            event.preventDefault();
            return;
        }

        const styleItem = event.target.closest('.pg-style-item[data-value]');
        if (styleItem) {
            const field = styleItem.closest('[data-value]') ? 'style' : null;
            // 视觉风格固定字段名 style
            setAnswer('style', styleItem.getAttribute('data-value'));
            event.stopPropagation();
            event.preventDefault();
            return;
        }

        const featureCard = event.target.closest('.pg-feature-card[data-value]');
        if (featureCard) {
            const field = featureCard.getAttribute('data-field');
            const value = featureCard.getAttribute('data-value');
            if (!field || !value) return;
            toggleArray(field, value);
            event.stopPropagation();
            event.preventDefault();
            return;
        }

        const addPageBtn = event.target.closest('.pg-add-page[data-action="addPage"]');
        if (addPageBtn) {
            externalAppRegistry?.invokeMethod(APP_ID, 'addPage', {});
            event.stopPropagation();
            event.preventDefault();
            return;
        }
        const removePageBtn = event.target.closest('.pg-page-remove[data-remove-page]');
        if (removePageBtn) {
            const idx = parseInt(removePageBtn.getAttribute('data-remove-page'), 10);
            externalAppRegistry?.invokeMethod(APP_ID, 'removePage', { idx });
            event.stopPropagation();
            event.preventDefault();
            return;
        }
    }, true);
})();