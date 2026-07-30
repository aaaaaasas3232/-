/**
 * App 制作问卷 App
 *
 * 功能：通过问卷引导生成 App 开发 Prompt
 * 参考 promptGenApp.js，包含 20 个配置步骤
 * 第三页 prompt 实时同步更新
 */

import { createActionAttr } from '@/src/core/actions.js';
import { createDefaultPageRenderer } from '@/src/core/page-renderers.js';

// ============ 设计系统常量 ============
const DESIGN_STYLES = [
    { value: 'ios-blue', title: '经典蓝', desc: 'iOS 标准', colors: { bg: '#F2F2F7', card: '#FFFFFF', prim: '#007AFF' } },
    { value: 'dopamine', title: '多巴胺', desc: '高饱和快乐色', colors: { bg: '#FFF0F5', card: '#FFD700', prim: '#FF69B4' } },
    { value: 'cyberpunk', title: '赛博朋克', desc: '黑底霓虹', colors: { bg: '#0A0A0F', card: '#1C1C2E', prim: '#00FF9D' } },
    { value: 'glass', title: '毛玻璃', desc: '极致透明', colors: { bg: 'linear-gradient(135deg,#a8edea,#fed6e3)', card: 'rgba(255,255,255,0.2)', prim: '#5e60ce' } },
    { value: 'morandi', title: '莫兰迪', desc: '高级灰调', colors: { bg: '#E0E5DF', card: '#F0F2F0', prim: '#76877D' } },
    { value: 'warm-sunset', title: '暖阳落日', desc: '温暖橙粉', colors: { bg: 'linear-gradient(180deg,#FFF5EB,#FFE4D6)', card: '#FFFFFF', prim: '#FF6B35' } },
    { value: 'ocean-deep', title: '深海蓝', desc: '沉稳深蓝', colors: { bg: '#0B1426', card: '#132040', prim: '#4FC3F7' } },
    { value: 'sakura', title: '樱花粉', desc: '柔和少女', colors: { bg: '#FFF0F3', card: '#FFFFFF', prim: '#E91E8C' } },
    { value: 'neumorphism', title: '新拟态', desc: '柔和凹凸', colors: { bg: '#E0E5EC', card: '#E0E5EC', prim: '#6C63FF' } },
    { value: 'flat-minimal', title: '扁平极简', desc: '无阴影纯色', colors: { bg: '#FFFFFF', card: '#F5F5F5', prim: '#333333' } },
    { value: 'material-you', title: 'Material You', desc: '动态取色', colors: { bg: '#FFFBFE', card: '#FEF7FF', prim: '#6750A4' } },
    { value: 'retro-pixel', title: '像素复古', desc: '8-bit怀旧', colors: { bg: '#2B2B2B', card: '#3C3C3C', prim: '#FFD700' } },
];

const TYPO_FAMILIES = [
    { value: 'system', title: '系统默认', desc: '-apple-system' },
    { value: 'rounded', title: '圆体', desc: 'Nunito' },
    { value: 'serif', title: '衬线体', desc: 'Georgia' },
    { value: 'mono', title: '等宽体', desc: 'SF Mono' },
    { value: 'handwritten', title: '手写体', desc: 'Caveat' },
    { value: 'geometric', title: '几何体', desc: 'Poppins' },
];

const TYPO_SCALES = [
    { value: 'compact', title: '紧凑', desc: 'body: 13px' },
    { value: 'standard', title: '标准', desc: 'body: 15px' },
    { value: 'relaxed', title: '宽松', desc: 'body: 17px' },
];

const TYPO_WEIGHTS = [
    { value: 'light', title: '轻盈', desc: '标题: 500' },
    { value: 'medium', title: '适中', desc: '标题: 700' },
    { value: 'bold', title: '厚重', desc: '标题: 800' },
];

const TYPO_LINE_HEIGHTS = [
    { value: 'tight', title: '紧密', desc: '1.2' },
    { value: 'normal', title: '正常', desc: '1.5' },
    { value: 'loose', title: '宽松', desc: '1.8' },
];

const CORNER_OPTIONS = [
    { value: 'small', title: '小圆角', desc: '4~8px' },
    { value: 'medium', title: '中等', desc: '10~14px' },
    { value: 'large', title: '大圆角', desc: '18~24px' },
    { value: 'pill', title: '胶囊形', desc: '50px+' },
];

const CARD_SHADOWS = [
    { value: 'none', title: '无阴影' },
    { value: 'light', title: '轻阴影' },
    { value: 'medium', title: '标准阴影' },
    { value: 'deep', title: '深阴影' },
];

const CARD_BORDERS = [
    { value: 'none', title: '无边框' },
    { value: 'hairline', title: '细线边框' },
    { value: 'gradient', title: '渐变边框' },
    { value: 'dashed', title: '虚线边框' },
];

const CARD_PADDINGS = [
    { value: 'compact', title: '紧凑', desc: '8~10px' },
    { value: 'standard', title: '标准', desc: '14~16px' },
    { value: 'spacious', title: '宽敞', desc: '20~24px' },
];

const CARD_BACKGROUNDS = [
    { value: 'solid', title: '纯色' },
    { value: 'gradient', title: '渐变' },
    { value: 'glass', title: '毛玻璃' },
    { value: 'image', title: '背景图' },
];

const BUTTON_SHAPES = [
    { value: 'rounded', title: '圆角矩形', desc: '10px' },
    { value: 'pill', title: '胶囊按钮', desc: 'height/2' },
    { value: 'squircle', title: '超椭圆', desc: '18px' },
    { value: 'ghost', title: '幽灵按钮', desc: '无背景' },
    { value: 'fab', title: 'FAB浮动', desc: '圆形' },
];

const BUTTON_SIZES = [
    { value: 'small', title: 'Small', desc: '28~32px' },
    { value: 'medium', title: 'Medium', desc: '36~40px' },
    { value: 'large', title: 'Large', desc: '44~50px' },
];

const BUTTON_FEEDBACKS = [
    { value: 'scale', title: '缩放回弹' },
    { value: 'ripple', title: '涟漪扩散' },
    { value: 'glow', title: '光晕脉冲' },
    { value: 'bounce', title: '果冻弹跳' },
    { value: 'none', title: '无反馈' },
];

const MODAL_POSITIONS = [
    { value: 'center', title: '居中弹出' },
    { value: 'bottom', title: '底部滑出' },
    { value: 'fullscreen', title: '全屏覆盖' },
];

const MODAL_CLOSES = [
    { value: 'overlay', title: '点击遮罩' },
    { value: 'button', title: '关闭按钮' },
    { value: 'both', title: '两者皆可' },
];

const LIST_LAYOUTS = [
    { value: 'card', title: '卡片式' },
    { value: 'list', title: '列表式' },
    { value: 'waterfall', title: '瀑布流' },
    { value: 'grid', title: '宫格式' },
];

const TAB_ICON_STYLES = [
    { value: 'outlined', title: '线性图标' },
    { value: 'filled', title: '填充图标' },
    { value: 'duotone', title: '双色调' },
];

const TAB_MATERIALS = [
    { value: 'blur', title: '毛玻璃' },
    { value: 'solid', title: '纯色实底' },
    { value: 'transparent', title: '全透明' },
];

const NAV_STYLES = [
    { value: 'large-title', title: '大标题', desc: 'iOS Large Title' },
    { value: 'center-title', title: '居中导航', desc: '经典居中栏' },
    { value: 'transparent', title: '透明沉浸', desc: '内容延伸到底部' },
    { value: 'floating', title: '悬浮胶囊', desc: '居中毛玻璃胶囊' },
];

const ICON_STYLES = [
    { value: 'outlined', title: '线性描边' },
    { value: 'filled', title: '实心填充' },
    { value: 'duotone', title: '双色调' },
    { value: 'rounded', title: '圆润线条' },
];

const MOTION_CURVES = [
    { value: 'spring', title: '弹簧回弹', desc: 'cubic-bezier(0.34,1.56,0.64,1)' },
    { value: 'ease', title: '平滑缓动', desc: 'ease-in-out' },
    { value: 'sharp', title: '干脆利落', desc: 'Material标准' },
    { value: 'bounce', title: '弹跳落地', desc: '果冻效果' },
];

const MOTION_TRANSITIONS = [
    { value: 'slide', title: '滑动' },
    { value: 'fade', title: '渐变' },
    { value: 'scale', title: '缩放' },
    { value: 'flip', title: '翻转' },
];

const DENSITY_OPTIONS = [
    { value: 'compact', title: '紧凑', desc: '信息密集型' },
    { value: 'standard', title: '标准', desc: 'iOS默认' },
    { value: 'comfortable', title: '舒适', desc: '阅读型' },
];

const DARK_MODES = [
    { value: 'none', title: '不支持暗色' },
    { value: 'support', title: '支持切换' },
    { value: 'default', title: '默认暗色' },
];

const CORE_FEATURES = [
    { value: 'ai', title: 'AI 对话', desc: '接入大模型' },
    { value: 'db', title: '本地存储', desc: 'IndexedDB' },
    { value: 'camera', title: '图片上传', desc: '相册/相机' },
    { value: 'charts', title: '数据图表', desc: '统计可视化' },
    { value: 'search', title: '搜索功能', desc: '全局搜索栏' },
    { value: 'pull-refresh', title: '下拉刷新', desc: '列表刷新' },
    { value: 'dark-toggle', title: '暗色切换', desc: '明暗主题' },
    { value: 'gesture', title: '手势操作', desc: '滑动删除' },
    { value: 'share', title: '分享功能', desc: '分享面板' },
    { value: 'favorite', title: '收藏点赞', desc: '带动画' },
    { value: 'onboarding', title: '引导页', desc: '首次引导' },
    { value: 'notification', title: '通知模拟', desc: '应用内通知' },
    { value: 'settings', title: '设置页面', desc: '偏好设置' },
    { value: 'login', title: '登录注册', desc: '用户认证' },
];

const WIDGET_SIZES = [
    { value: 'small', title: 'Small', desc: '2×1' },
    { value: 'medium', title: 'Medium', desc: '2×2' },
    { value: 'large', title: 'Large', desc: '4×2' },
];

const WIDGET_SHAPES = [
    { value: 'rounded-rect', title: '圆角矩形' },
    { value: 'circle', title: '圆形' },
    { value: 'squircle', title: '超椭圆' },
    { value: 'blob', title: '有机形态' },
    { value: 'pill', title: '胶囊形' },
];

const ISLAND_MODES = [
    { value: 'quiet', title: 'Quiet', desc: '最小指示器' },
    { value: 'mini', title: 'Mini', desc: '单行小药丸' },
    { value: 'medium', title: 'Medium', desc: '图标+标题+副标题' },
    { value: 'large', title: 'Large', desc: '大面板' },
];

// ============ App 工厂函数 ============
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
            { id: 'form', label: '配置', icon: '◦', nav: true },
            { id: 'result', label: '代码', icon: '◦', nav: true }
    ],
    defaultRootPageId: 'intro',

        setup() {
            return {
                wizardStep: 0,
                answers: {
                    // 步骤0: 基础信息
                    appId: '',
                    appName: '',
                    appDesc: '',

                    // 步骤1: 页面规划
                    structure: 'tab',
                    pages: [
                        { name: '首页', desc: '主要内容展示' },
                        { name: '发现', desc: '探索和推荐' },
                        { name: '我的', desc: '个人中心' },
                    ],

                    // 步骤2: 视觉风格
                    style: 'ios-blue',

                    // 步骤3: 色彩搭配
                    palette: 'auto',
                    customBg: '#F2F2F7',
                    customCard: '#FFFFFF',
                    customPrim: '#007AFF',
                    customAccent: '#FF9500',

                    // 步骤4: 字体排版
                    typoFamily: 'system',
                    typoScale: 'standard',
                    typoWeight: 'medium',
                    typoLineHeight: 'normal',

                    // 步骤5: 圆角风格
                    corner: 'medium',

                    // 步骤6: 卡片设计
                    cardShadow: 'medium',
                    cardBorder: 'none',
                    cardPadding: 'standard',
                    cardBackground: 'solid',

                    // 步骤7: 按钮设计
                    btnShape: 'rounded',
                    btnSize: 'medium',
                    btnFeedback: 'scale',
                    btnGradient: false,

                    // 步骤8: 弹窗设计
                    modalStyle: 'center',
                    modalClose: 'overlay',
                    modalRadius: 'large',

                    // 步骤9: 列表布局
                    listLayout: 'card',

                    // 步骤10: Tab栏设计
                    tabIconStyle: 'outlined',
                    tabMaterial: 'blur',
                    tabAnimation: 'scale',
                    tabCenterBtn: false,

                    // 步骤11: 页面顶栏
                    navStyle: 'large-title',
                    navMaterial: 'blur',
                    navHasSearch: false,
                    navHasDivider: true,

                    // 步骤12: 图标风格
                    iconStyle: 'outlined',
                    iconWeight: 'regular',

                    // 步骤13: 动效设计
                    motionCurve: 'spring',
                    motionTransition: 'slide',
                    motionMicro: 'jelly',
                    motionLoading: 'skeleton',

                    // 步骤14: 信息密度与主题
                    density: 'standard',
                    darkMode: 'none',
                    emptyState: 'minimal',
                    inputStyle: 'border',

                    // 步骤15: 核心能力（多选）
                    features: [],

                    // 步骤16: 小组件开关
                    needWidget: false,
                    widgetTypes: [],
                    widgetShape: 'rounded-rect',

                    // 步骤17: 灵动岛开关
                    needIsland: false,
                    islandQuiet: { content: '', icon: '' },
                    islandMedium: { title: '运行中', subtitle: '', hasProgress: false, hasControls: false },
                    islandLarge: { enabled: false, content: '' },
                },
            copied: false,
            };
        },

    methods: {
        escapeHtml(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        },

            setAnswer(field, value) {
                this.app.state.answers[field] = value;
                this.app.state.copied = false;
                window.refreshPhoneApps?.();
            },

            toggleFeature(value) {
                const features = this.app.state.answers.features || [];
                const idx = features.indexOf(value);
                if (idx >= 0) {
                    features.splice(idx, 1);
                } else {
                    features.push(value);
                }
                this.app.state.answers.features = [...features];
                this.app.state.copied = false;
                window.refreshPhoneApps?.();
            },

            toggleWidgetType(value) {
                const types = this.app.state.answers.widgetTypes || [];
                const idx = types.indexOf(value);
                if (idx >= 0) {
                    types.splice(idx, 1);
                } else {
                    types.push(value);
                }
                this.app.state.answers.widgetTypes = [...types];
                this.app.state.copied = false;
                window.refreshPhoneApps?.();
            },

            addPage() {
                const pages = this.app.state.answers.pages || [];
                pages.push({ name: '', desc: '' });
                this.app.state.answers.pages = [...pages];
                window.refreshPhoneApps?.();
            },

            removePage(idx) {
                const pages = this.app.state.answers.pages || [];
                if (pages.length > 1) {
                    pages.splice(idx, 1);
                    this.app.state.answers.pages = [...pages];
                    window.refreshPhoneApps?.();
                }
            },

            updatePage(idx, field, value) {
                const pages = this.app.state.answers.pages || [];
                if (pages[idx]) {
                    pages[idx][field] = value;
                    this.app.state.answers.pages = [...pages];
                    window.refreshPhoneApps?.();
                }
            },

            nextStep() {
                if (this.app.state.wizardStep < 17) {
                    this.app.state.wizardStep++;
                    window.refreshPhoneApps?.();
                }
            },

            prevStep() {
                if (this.app.state.wizardStep > 0) {
                    this.app.state.wizardStep--;
                    window.refreshPhoneApps?.();
                }
            },

            goToStep(step) {
                this.app.state.wizardStep = step;
                window.refreshPhoneApps?.();
            },

            copyPrompt() {
                const prompt = this.methods.generatePrompt();
                navigator.clipboard?.writeText(prompt).catch(() => {
                    const ta = document.createElement('textarea');
                    ta.value = prompt;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                });
                this.app.state.copied = true;
                this.toolkit.island.notify('success', '已复制', 'Prompt 已复制到剪贴板');
            window.refreshPhoneApps?.();
        },

            generatePrompt() {
                const a = this.app.state.answers;
                const styleConfig = DESIGN_STYLES.find(s => s.value === a.style) || DESIGN_STYLES[0];
                const fc = a.palette === 'custom'
                    ? { bg: a.customBg, card: a.customCard, prim: a.customPrim, accent: a.customAccent }
                    : { ...styleConfig.colors, accent: '#FF9500' };

                const lines = [];
                lines.push('# 虚拟手机 App 生成请求 (v6.0 标准)\n');
                lines.push('你是一个专业的虚拟手机应用开发专家。请**严格遵循下方完整规范**，为我编写一个完整的 Javascript 代码。\n');

                // 一、基本信息
                lines.push('## 一、基本信息');
                lines.push(`- **App名称**: ${a.appName || 'MyApp'}`);
                lines.push(`- **App ID**: \`${a.appId || 'my-app'}\``);
                const appClassName = (a.appId || 'my-app').replace(/(^|-)(\w)/g, (_, sep, c) => c.toUpperCase()) + 'App';
                lines.push(`- **构造函数名**: \`${appClassName}\``);
                if (a.appDesc) lines.push(`- **功能描述**: ${a.appDesc}`);
                lines.push('');

                // 二、页面结构
                lines.push('## 二、页面结构');
                lines.push(`- **结构类型**: ${a.structure === 'tab' ? '底部Tab导航（多页面）' : '单页面工具'}`);
                a.pages.forEach((pg, i) => lines.push(`  ${i + 1}. **${pg.name}**${pg.desc ? ' — ' + pg.desc : ''}`));
                lines.push('');

                // 三、视觉风格
                lines.push('## 三、视觉风格');
                lines.push(`- **设计语言**: ${styleConfig.title} (${styleConfig.desc})`);
                lines.push(`  - 背景色: \`${fc.bg}\``);
                lines.push(`  - 卡片色: \`${fc.card}\``);
                lines.push(`  - 主色调: \`${fc.prim}\``);
                lines.push(`  - 强调色: \`${fc.accent}\``);
                lines.push('');

                // 四、圆角规范
                const cornerMap = { small: '4~8px', medium: '10~14px', large: '18~24px', pill: '全圆角(50px+)' };
                lines.push('## 四、圆角规范');
                lines.push(`- 全局圆角: **${cornerMap[a.corner] || 'medium'}**`);
                lines.push('');

                // 四(附)、字体排版
                const typoFamilyMap = {
                    system: '系统默认', rounded: '圆体 (Nunito)', serif: '衬线体 (Georgia)',
                    mono: '等宽体 (SF Mono)', handwritten: '手写体 (Caveat)', geometric: '几何体 (Poppins)'
                };
                const typoScaleMap = { compact: '紧凑 (body: 13px)', standard: '标准 (body: 15px)', relaxed: '宽松 (body: 17px)' };
                const typoWeightMap = { light: '轻盈 (标题: 500)', medium: '适中 (标题: 700)', bold: '厚重 (标题: 800)' };
                const typoLineMap = { tight: '紧密 (1.2)', normal: '正常 (1.5)', loose: '宽松 (1.8)' };
                lines.push('## 四(附)、字体排版系统');
                lines.push(`- **字体风格**: ${typoFamilyMap[a.typoFamily] || '系统默认'}`);
                lines.push(`- **字号比例**: ${typoScaleMap[a.typoScale] || '标准'}`);
                lines.push(`- **字重偏好**: ${typoWeightMap[a.typoWeight] || '适中'}`);
                lines.push(`- **行高**: ${typoLineMap[a.typoLineHeight] || '正常'}`);
                lines.push('');

                // 四(附二)、卡片设计
                const cardShadowMap = { none: '无阴影', light: '轻阴影 (0 2px 8px)', medium: '标准阴影 (0 4px 16px)', deep: '深阴影 (0 8px 32px)' };
                const cardBorderMap = { none: '无边框', hairline: '细线边框', gradient: '渐变边框', dashed: '虚线边框' };
                const cardPaddingMap = { compact: '紧凑 (8~10px)', standard: '标准 (14~16px)', spacious: '宽敞 (20~24px)' };
                const cardBgMap = { solid: '纯色', gradient: '渐变', glass: '毛玻璃 (backdrop-filter: blur)', image: '背景图' };
                lines.push('## 四(附二)、卡片设计系统');
                lines.push(`- **卡片阴影**: ${cardShadowMap[a.cardShadow] || '标准阴影'}`);
                lines.push(`- **卡片边框**: ${cardBorderMap[a.cardBorder] || '无边框'}`);
                lines.push(`- **卡片内间距**: ${cardPaddingMap[a.cardPadding] || '标准'}`);
                lines.push(`- **卡片背景**: ${cardBgMap[a.cardBackground] || '纯色'}`);
                lines.push('');

                // 五、按钮设计
                const btnShapeMap = { rounded: '圆角矩形 (10px)', pill: '胶囊按钮 (height/2)', squircle: '超椭圆 (18px)', ghost: '幽灵按钮', fab: 'FAB浮动按钮' };
                const btnSizeMap = { small: 'Small (28~32px)', medium: 'Medium (36~40px)', large: 'Large (44~50px)' };
                const btnFeedbackMap = { scale: '缩放回弹', ripple: '涟漪扩散', glow: '光晕脉冲', bounce: '果冻弹跳', none: '无反馈' };
                lines.push('## 五、按钮设计系统');
                lines.push(`- **按钮形态**: ${btnShapeMap[a.btnShape] || '圆角矩形'}`);
                lines.push(`- **按钮尺寸**: ${btnSizeMap[a.btnSize] || 'Medium'}`);
                lines.push(`- **点击反馈**: ${btnFeedbackMap[a.btnFeedback] || '缩放回弹'}`);
                lines.push(`- **渐变填充**: ${a.btnGradient ? '开启' : '关闭'}`);
                lines.push('');

                // 六、弹窗设计
                const modalPosMap = { center: '居中弹出', bottom: '底部滑出(Action Sheet)', fullscreen: '全屏覆盖' };
                const modalCloseMap = { overlay: '点击遮罩关闭', button: '仅关闭按钮', both: '两者皆可' };
                const modalRadiusMap = { small: '8px', medium: '16px', large: '24px' };
                lines.push('## 六、弹窗设计');
                lines.push(`- **弹窗位置**: ${modalPosMap[a.modalStyle] || '居中弹出'}`);
                lines.push(`- **关闭方式**: ${modalCloseMap[a.modalClose] || '点击遮罩'}`);
                lines.push(`- **弹窗圆角**: ${modalRadiusMap[a.modalRadius] || 'large'}`);
                lines.push(`- **遮罩**: \`rgba(0,0,0,0.4) + backdrop-filter: blur(4px)\``);
                lines.push('');

                // 七、列表布局
                const listMap = { card: '卡片式', list: '列表式', waterfall: '瀑布流', grid: '宫格式' };
                lines.push('## 七、列表布局');
                lines.push(`- **列表样式**: ${listMap[a.listLayout] || '卡片式'}`);
                lines.push('');

                // 八、导航栏设计
                const navStyleMap = {
                    'large-title': 'iOS Large Title（大标题，滚动时缩小）',
                    'center-title': '经典居中导航栏',
                    'transparent': '透明沉浸式（内容延伸到状态栏）',
                    'floating': '悬浮胶囊导航'
                };
                lines.push('## 八、导航栏设计系统');
                lines.push(`- **导航栏形态**: ${navStyleMap[a.navStyle] || 'iOS Large Title'}`);
                lines.push(`- **导航栏材质**: ${a.navMaterial === 'blur' ? '毛玻璃 (backdrop-filter: blur(20px))' : '纯色实底'}`);
                lines.push(`- **内嵌搜索栏**: ${a.navHasSearch ? '开启' : '关闭'}`);
                lines.push(`- **底部分割线**: ${a.navHasDivider ? '开启' : '关闭'}`);
                lines.push('');

                // 八(附)、Tab栏设计
                const tabIconMap = { outlined: '线性图标', filled: '填充图标', duotone: '双色调图标' };
                const tabMatMap = { blur: '毛玻璃', solid: '纯色实底', transparent: '全透明' };
                const tabAnimMap = { scale: '缩放', slide: '滑动指示', fade: '渐变', bounce: '弹跳' };
                lines.push('## 八(附)、Tab栏设计系统');
                lines.push(`- **Tab图标风格**: ${tabIconMap[a.tabIconStyle] || '线性图标'}`);
                lines.push(`- **Tab栏材质**: ${tabMatMap[a.tabMaterial] || '毛玻璃'}`);
                lines.push(`- **切换动画**: ${tabAnimMap[a.tabAnimation] || '缩放'}`);
                lines.push(`- **中心凸起按钮**: ${a.tabCenterBtn ? '开启' : '关闭'}`);
                lines.push('');

                // 八(附二)、图标风格
                const iconStyleMap = { outlined: '线性描边', filled: '实心填充', duotone: '双色调', rounded: '圆润线条' };
                const iconWeightMap = { thin: '纤细 (1px)', regular: '常规 (1.5px)', bold: '粗壮 (2.5px)' };
                lines.push('## 八(附二)、图标风格');
                lines.push(`- **图标线条风格**: ${iconStyleMap[a.iconStyle] || '线性描边'}`);
                lines.push(`- **图标线条粗细**: ${iconWeightMap[a.iconWeight] || '常规'}`);
                lines.push('');

                // 九、动效设计
                const curveMap = { spring: '弹簧回弹 cubic-bezier(0.34,1.56,0.64,1)', ease: '平滑缓动 ease-in-out', sharp: '干脆利落 cubic-bezier(0.4,0,0.2,1)', bounce: '弹跳落地' };
                const transMap = { slide: '滑动过渡', fade: '渐变过渡', scale: '缩放过渡', flip: '翻转过渡' };
                const microMap = { jelly: '果冻', pulse: '脉冲', wiggle: '摇摆', pop: '弹出', none: '无' };
                lines.push('## 九、动效设计系统');
                lines.push(`- **缓动曲线**: ${curveMap[a.motionCurve] || '弹簧回弹'}`);
                lines.push(`- **页面过渡**: ${transMap[a.motionTransition] || '滑动'}`);
                lines.push(`- **微交互动效**: ${microMap[a.motionMicro] || '果冻'}`);
                lines.push(`- **加载动画**: ${a.motionLoading || 'skeleton'}`);
                lines.push('');

                // 九(附)、信息密度与主题
                const densityMap = { compact: '紧凑 (行高: 36px)', standard: '标准 (行高: 44px)', comfortable: '舒适 (行高: 56px)' };
                const darkMap = { none: '不支持暗色', support: '支持明暗切换', default: '默认暗色' };
                const emptyMap = { minimal: '极简文字', illustration: 'SVG插画', icon: '大图标' };
                const inputMap = { border: '边框输入框', underline: '下划线输入框', filled: '填充底色输入框' };
                lines.push('## 九(附)、信息密度与主题');
                lines.push(`- **信息密度**: ${densityMap[a.density] || '标准'}`);
                lines.push(`- **暗色模式**: ${darkMap[a.darkMode] || '不支持'}`);
                lines.push(`- **空状态设计**: ${emptyMap[a.emptyState] || '极简文字'}`);
                lines.push(`- **输入框风格**: ${inputMap[a.inputStyle] || '边框输入框'}`);
                lines.push('');

                // 十、功能模块
                lines.push('## 十、功能模块');
                if (a.features.length === 0) {
                    lines.push('- （未选择特殊能力）');
                } else {
                    const featureMap = {
                        'ai': 'AI 对话（接入大模型智能对话）',
                        'db': '本地存储（IndexedDB持久化）',
                        'camera': '图片上传（相册/相机）',
                        'charts': '数据图表（统计可视化）',
                        'search': '搜索功能（全局搜索栏）',
                        'pull-refresh': '下拉刷新（列表刷新动画）',
                        'dark-toggle': '暗色切换（明暗主题切换）',
                        'gesture': '手势操作（滑动删除/长按排序）',
                        'share': '分享功能（iOS Share Sheet）',
                        'favorite': '收藏点赞（带动画反馈）',
                        'onboarding': '引导页（首次使用引导流程）',
                        'notification': '通知模拟（应用内通知提示）',
                        'settings': '设置页面（偏好设置与关于）',
                        'login': '登录注册（表单验证、状态管理）',
                    };
                    a.features.forEach(f => lines.push(`- ${featureMap[f] || f}`));
                }
                lines.push('');

                // 十一、小组件
                lines.push('## 十一、小组件（Widget）');
                if (!a.needWidget || a.widgetTypes.length === 0) {
                    lines.push('- 此App不需要桌面小组件');
                } else {
                    const shapeMap = {
                        'rounded-rect': '圆角矩形 (border-radius: 14px)',
                        'circle': '圆形 (border-radius: 50%)',
                        'squircle': '超椭圆 (border-radius: 22px)',
                        'blob': '有机形态 (border-radius: 30% 70%)',
                        'pill': '胶囊形 (border-radius: 36px)'
                    };
                    lines.push(`- **需要小组件**: 是`);
                    lines.push(`- **组件尺寸**: ${a.widgetTypes.map(t => t.toUpperCase()).join(', ')}`);
                    lines.push(`- **形状**: ${shapeMap[a.widgetShape] || '圆角矩形'}`);
                }
                lines.push('');

                // 十二、灵动岛
                lines.push('## 十二、灵动岛（Dynamic Island）');
                if (!a.needIsland) {
                    lines.push('- 此App不需要灵动岛');
            } else {
                    lines.push(`- **需要灵动岛**: 是`);
                    lines.push(`- **Medium标题**: ${a.islandMedium?.title || '运行中'}`);
                    lines.push(`- **Medium副标题**: ${a.islandMedium?.subtitle || '无'}`);
                    lines.push(`- **进度条**: ${a.islandMedium?.hasProgress ? '开启' : '关闭'}`);
                    lines.push(`- **控制按钮**: ${a.islandMedium?.hasControls ? '开启' : '关闭'}`);
                }
                lines.push('');

                // 十三、技术要求
                lines.push('## 十三、技术要求');
                lines.push('- 使用 Vue 3 全局构建（`Vue.createApp`）');
                lines.push('- 业务 App 必须是 ESM 模块文件');
                lines.push('- 所有用户输入必须 `escapeHtml` 防 XSS');
                lines.push('- 使用 IndexedDB (`window.myDb`) 持久化数据');
                lines.push('- 遵循 iPhone 风格：毛玻璃、圆角、柔和阴影');
                lines.push('- 图标统一使用内联 SVG（viewBox="0 0 24 24"）');

                return lines.join('\n');
            },
        },

        renderPage(content, page, app) {
            const a = app.state.answers;
            const escapeHtml = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            const step = app.state.wizardStep || 0;

            // 局部函数渲染步骤
            const renderStep = (s) => {
                switch (s) {
                    case 0: return `<div class="pg-card active"><div class="pg-question-title">1. 基本信息</div><div class="pg-question-desc">设置 App 的名称、ID 和简要描述</div><div class="pg-input-group"><label class="pg-label">App名称</label><input class="pg-input" type="text" placeholder="我的应用" value="${escapeHtml(a.appName)}" data-field="appName" /></div><div class="pg-input-group"><label class="pg-label">App ID</label><input class="pg-input" type="text" placeholder="my-app" value="${escapeHtml(a.appId)}" data-field="appId" /><div class="pg-hint">用于代码中标识，建议使用英文和连字符</div></div><div class="pg-input-group"><label class="pg-label">功能描述（选填）</label><textarea class="pg-textarea" placeholder="简要描述这个应用的功能..." data-field="appDesc">${escapeHtml(a.appDesc || '')}</textarea></div></div>`;
                    case 1: return `<div class="pg-card active"><div class="pg-question-title">2. 页面规划</div><div class="pg-question-desc">定义主要页面和 Tab 标签</div><div class="pg-input-group"><label class="pg-label">页面结构</label><div class="pg-header-grid" data-field="structure"><div class="pg-header-item ${a.structure === 'tab' ? 'selected' : ''}" data-value="tab"><div class="pg-header-item-title">Tab导航</div><div class="pg-header-item-desc">多页面切换</div></div><div class="pg-header-item ${a.structure === 'single' ? 'selected' : ''}" data-value="single"><div class="pg-header-item-title">单页面</div><div class="pg-header-item-desc">单一工具</div></div></div></div><div class="pg-input-group"><label class="pg-label">页面列表</label><div class="pg-pages-list">${(a.pages || []).map((pg, i) => `<div class="pg-page-item"><div class="pg-page-num">${i + 1}</div><div class="pg-page-fields"><input class="pg-input pg-input-sm" type="text" placeholder="页面名称" value="${escapeHtml(pg.name)}" data-page="${i}" data-field="name" /><input class="pg-input pg-input-sm" type="text" placeholder="页面描述" value="${escapeHtml(pg.desc)}" data-page="${i}" data-field="desc" /></div>${a.pages.length > 1 ? `<button class="pg-page-remove" data-remove="${i}">×</button>` : ''}</div>`).join('')}<button class="pg-add-page" data-action="addPage">+ 添加页面</button></div></div></div>`;
                    case 2: return `<div class="pg-card active"><div class="pg-question-title">3. 视觉风格</div><div class="pg-question-desc">选择 App 的设计语言</div><div class="pg-style-grid">${DESIGN_STYLES.map(s => `<div class="pg-style-item ${a.style === s.value ? 'selected' : ''}" data-field="style" data-value="${s.value}"><div class="pg-style-preview" style="background:${typeof s.colors.bg === 'string' && s.colors.bg.includes('gradient') ? s.colors.bg : s.colors.bg}"><div class="pg-style-chip" style="background:${s.colors.card};border:2px solid ${s.colors.prim}"></div></div><div class="pg-style-name">${s.title}</div><div class="pg-style-desc">${s.desc}</div></div>`).join('')}</div></div>`;
                    case 3: return `<div class="pg-card active"><div class="pg-question-title">4. 色彩搭配</div><div class="pg-question-desc">微调配色方案</div><div class="pg-input-group"><label class="pg-label">配色模式</label><div class="pg-header-grid" data-field="palette"><div class="pg-header-item ${a.palette === 'auto' ? 'selected' : ''}" data-value="auto"><div class="pg-header-item-title">自动</div><div class="pg-header-item-desc">跟随风格</div></div><div class="pg-header-item ${a.palette === 'custom' ? 'selected' : ''}" data-value="custom"><div class="pg-header-item-title">自定义</div><div class="pg-header-item-desc">手动设置</div></div></div></div>${a.palette === 'custom' ? `<div class="pg-input-group"><label class="pg-label">背景色</label><input class="pg-input pg-input-color" type="text" placeholder="#F2F2F7" value="${escapeHtml(a.customBg)}" data-field="customBg" /></div><div class="pg-input-group"><label class="pg-label">卡片色</label><input class="pg-input pg-input-color" type="text" placeholder="#FFFFFF" value="${escapeHtml(a.customCard)}" data-field="customCard" /></div><div class="pg-input-group"><label class="pg-label">主色调</label><input class="pg-input pg-input-color" type="text" placeholder="#007AFF" value="${escapeHtml(a.customPrim)}" data-field="customPrim" /></div>` : ''}</div>`;
                    case 4: return `<div class="pg-card active"><div class="pg-question-title">5. 字体排版</div><div class="pg-question-desc">字体风格、字号比例与行高</div><div class="pg-input-group"><label class="pg-label">字体风格</label><div class="pg-header-grid" data-field="typoFamily">${TYPO_FAMILIES.map(f => `<div class="pg-header-item ${a.typoFamily === f.value ? 'selected' : ''}" data-value="${f.value}"><div class="pg-header-item-title">${f.title}</div><div class="pg-header-item-desc">${f.desc}</div></div>`).join('')}</div></div><div class="pg-input-group"><label class="pg-label">字号比例</label><div class="pg-header-grid" data-field="typoScale">${TYPO_SCALES.map(s => `<div class="pg-header-item ${a.typoScale === s.value ? 'selected' : ''}" data-value="${s.value}"><div class="pg-header-item-title">${s.title}</div><div class="pg-header-item-desc">${s.desc}</div></div>`).join('')}</div></div><div class="pg-input-group"><label class="pg-label">字重偏好</label><div class="pg-header-grid" data-field="typoWeight">${TYPO_WEIGHTS.map(w => `<div class="pg-header-item ${a.typoWeight === w.value ? 'selected' : ''}" data-value="${w.value}"><div class="pg-header-item-title">${w.title}</div><div class="pg-header-item-desc">${w.desc}</div></div>`).join('')}</div></div></div>`;
                    case 5: return `<div class="pg-card active"><div class="pg-question-title">6. 圆角风格</div><div class="pg-question-desc">卡片和按钮的圆角</div><div class="pg-header-grid" data-field="corner">${CORNER_OPTIONS.map(c => `<div class="pg-header-item ${a.corner === c.value ? 'selected' : ''}" data-value="${c.value}"><div class="pg-corner-preview" style="border-radius:${c.value === 'pill' ? '50%' : c.value === 'large' ? '20px' : c.value === 'small' ? '4px' : '10px'}"></div><div class="pg-header-item-title">${c.title}</div><div class="pg-header-item-desc">${c.desc}</div></div>`).join('')}</div></div>`;
                    case 6: return `<div class="pg-card active"><div class="pg-question-title">7. 卡片设计</div><div class="pg-question-desc">阴影、边框、间距与背景效果</div><div class="pg-input-group"><label class="pg-label">卡片阴影</label><div class="pg-header-grid" data-field="cardShadow">${CARD_SHADOWS.map(s => `<div class="pg-header-item ${a.cardShadow === s.value ? 'selected' : ''}" data-value="${s.value}"><div class="pg-header-item-title">${s.title}</div></div>`).join('')}</div></div><div class="pg-input-group"><label class="pg-label">卡片边框</label><div class="pg-header-grid" data-field="cardBorder">${CARD_BORDERS.map(b => `<div class="pg-header-item ${a.cardBorder === b.value ? 'selected' : ''}" data-value="${b.value}"><div class="pg-header-item-title">${b.title}</div></div>`).join('')}</div></div><div class="pg-input-group"><label class="pg-label">内间距</label><div class="pg-header-grid" data-field="cardPadding">${CARD_PADDINGS.map(p => `<div class="pg-header-item ${a.cardPadding === p.value ? 'selected' : ''}" data-value="${p.value}"><div class="pg-header-item-title">${p.title}</div><div class="pg-header-item-desc">${p.desc}</div></div>`).join('')}</div></div></div>`;
                    case 7: return `<div class="pg-card active"><div class="pg-question-title">8. 按钮设计</div><div class="pg-question-desc">形态、尺寸、交互反馈</div><div class="pg-input-group"><label class="pg-label">按钮形态</label><div class="pg-header-grid" data-field="btnShape">${BUTTON_SHAPES.map(s => `<div class="pg-header-item ${a.btnShape === s.value ? 'selected' : ''}" data-value="${s.value}"><div class="pg-header-item-title">${s.title}</div><div class="pg-header-item-desc">${s.desc}</div></div>`).join('')}</div></div><div class="pg-input-group"><label class="pg-label">按钮尺寸</label><div class="pg-header-grid" data-field="btnSize">${BUTTON_SIZES.map(s => `<div class="pg-header-item ${a.btnSize === s.value ? 'selected' : ''}" data-value="${s.value}"><div class="pg-header-item-title">${s.title}</div><div class="pg-header-item-desc">${s.desc}</div></div>`).join('')}</div></div><div class="pg-input-group"><label class="pg-label">点击反馈</label><div class="pg-header-grid" data-field="btnFeedback">${BUTTON_FEEDBACKS.map(f => `<div class="pg-header-item ${a.btnFeedback === f.value ? 'selected' : ''}" data-value="${f.value}"><div class="pg-header-item-title">${f.title}</div></div>`).join('')}</div></div></div>`;
                    case 8: return `<div class="pg-card active"><div class="pg-question-title">9. 弹窗设计</div><div class="pg-question-desc">弹窗样式与交互</div><div class="pg-input-group"><label class="pg-label">弹窗位置</label><div class="pg-header-grid" data-field="modalStyle">${MODAL_POSITIONS.map(m => `<div class="pg-header-item ${a.modalStyle === m.value ? 'selected' : ''}" data-value="${m.value}"><div class="pg-header-item-title">${m.title}</div></div>`).join('')}</div></div><div class="pg-input-group"><label class="pg-label">关闭方式</label><div class="pg-header-grid" data-field="modalClose">${MODAL_CLOSES.map(c => `<div class="pg-header-item ${a.modalClose === c.value ? 'selected' : ''}" data-value="${c.value}"><div class="pg-header-item-title">${c.title}</div></div>`).join('')}</div></div></div>`;
                    case 9: return `<div class="pg-card active"><div class="pg-question-title">10. 列表布局</div><div class="pg-question-desc">内容展示方式</div><div class="pg-header-grid" data-field="listLayout">${LIST_LAYOUTS.map(l => `<div class="pg-header-item ${a.listLayout === l.value ? 'selected' : ''}" data-value="${l.value}"><div class="pg-header-item-title">${l.title}</div></div>`).join('')}</div></div>`;
                    case 10: return `<div class="pg-card active"><div class="pg-question-title">11. Tab栏设计</div><div class="pg-question-desc">屏幕底部的切换按钮栏</div><div class="pg-input-group"><label class="pg-label">图标风格</label><div class="pg-header-grid" data-field="tabIconStyle">${TAB_ICON_STYLES.map(s => `<div class="pg-header-item ${a.tabIconStyle === s.value ? 'selected' : ''}" data-value="${s.value}"><div class="pg-header-item-title">${s.title}</div></div>`).join('')}</div></div><div class="pg-input-group"><label class="pg-label">Tab栏材质</label><div class="pg-header-grid" data-field="tabMaterial">${TAB_MATERIALS.map(m => `<div class="pg-header-item ${a.tabMaterial === m.value ? 'selected' : ''}" data-value="${m.value}"><div class="pg-header-item-title">${m.title}</div></div>`).join('')}</div></div></div>`;
                    case 11: return `<div class="pg-card active"><div class="pg-question-title">12. 页面顶栏</div><div class="pg-question-desc">屏幕顶部显示页面标题的区域</div><div class="pg-input-group"><label class="pg-label">导航栏形态</label><div class="pg-header-grid" data-field="navStyle">${NAV_STYLES.map(s => `<div class="pg-header-item ${a.navStyle === s.value ? 'selected' : ''}" data-value="${s.value}"><div class="pg-header-item-title">${s.title}</div><div class="pg-header-item-desc">${s.desc}</div></div>`).join('')}</div></div><div class="pg-input-group"><label class="pg-label">导航栏材质</label><div class="pg-header-grid" data-field="navMaterial"><div class="pg-header-item ${a.navMaterial === 'blur' ? 'selected' : ''}" data-value="blur"><div class="pg-header-item-title">毛玻璃</div></div><div class="pg-header-item ${a.navMaterial === 'solid' ? 'selected' : ''}" data-value="solid"><div class="pg-header-item-title">纯色实底</div></div></div></div></div>`;
                    case 12: return `<div class="pg-card active"><div class="pg-question-title">13. 图标风格</div><div class="pg-question-desc">全局图标线条风格与粗细</div><div class="pg-input-group"><label class="pg-label">图标线条风格</label><div class="pg-header-grid" data-field="iconStyle">${ICON_STYLES.map(s => `<div class="pg-header-item ${a.iconStyle === s.value ? 'selected' : ''}" data-value="${s.value}"><div class="pg-header-item-title">${s.title}</div></div>`).join('')}</div></div><div class="pg-input-group"><label class="pg-label">图标线条粗细</label><div class="pg-header-grid" data-field="iconWeight"><div class="pg-header-item ${a.iconWeight === 'thin' ? 'selected' : ''}" data-value="thin"><div class="pg-header-item-title">纤细</div><div class="pg-header-item-desc">1px</div></div><div class="pg-header-item ${a.iconWeight === 'regular' ? 'selected' : ''}" data-value="regular"><div class="pg-header-item-title">常规</div><div class="pg-header-item-desc">1.5px</div></div><div class="pg-header-item ${a.iconWeight === 'bold' ? 'selected' : ''}" data-value="bold"><div class="pg-header-item-title">粗壮</div><div class="pg-header-item-desc">2.5px</div></div></div></div></div>`;
                    case 13: return `<div class="pg-card active"><div class="pg-question-title">14. 动效设计</div><div class="pg-question-desc">过渡动画、缓动曲线与特效</div><div class="pg-input-group"><label class="pg-label">缓动曲线</label><div class="pg-header-grid" data-field="motionCurve">${MOTION_CURVES.map(c => `<div class="pg-header-item ${a.motionCurve === c.value ? 'selected' : ''}" data-value="${c.value}"><div class="pg-header-item-title">${c.title}</div><div class="pg-header-item-desc">${c.desc}</div></div>`).join('')}</div></div><div class="pg-input-group"><label class="pg-label">页面过渡</label><div class="pg-header-grid" data-field="motionTransition">${MOTION_TRANSITIONS.map(t => `<div class="pg-header-item ${a.motionTransition === t.value ? 'selected' : ''}" data-value="${t.value}"><div class="pg-header-item-title">${t.title}</div></div>`).join('')}</div></div></div>`;
                    case 14: return `<div class="pg-card active"><div class="pg-question-title">15. 密度与主题</div><div class="pg-question-desc">信息密度、暗色模式与空状态</div><div class="pg-input-group"><label class="pg-label">信息密度</label><div class="pg-header-grid" data-field="density">${DENSITY_OPTIONS.map(d => `<div class="pg-header-item ${a.density === d.value ? 'selected' : ''}" data-value="${d.value}"><div class="pg-header-item-title">${d.title}</div><div class="pg-header-item-desc">${d.desc}</div></div>`).join('')}</div></div><div class="pg-input-group"><label class="pg-label">暗色模式</label><div class="pg-header-grid" data-field="darkMode">${DARK_MODES.map(d => `<div class="pg-header-item ${a.darkMode === d.value ? 'selected' : ''}" data-value="${d.value}"><div class="pg-header-item-title">${d.title}</div></div>`).join('')}</div></div></div>`;
                    case 15: return `<div class="pg-card active"><div class="pg-question-title">16. 核心能力</div><div class="pg-question-desc">功能模块（可多选）</div><div class="pg-feature-grid">${CORE_FEATURES.map(f => `<div class="pg-feature-card ${a.features.includes(f.value) ? 'selected' : ''}" data-feature="${f.value}"><div class="pg-feature-check"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12" /></svg></div><div class="pg-feature-info"><div class="pg-feature-title">${f.title}</div><div class="pg-feature-desc">${f.desc}</div></div></div>`).join('')}</div></div>`;
                    case 16: return `<div class="pg-card active"><div class="pg-question-title">17. 小组件</div><div class="pg-question-desc">是否需要桌面小组件？可跳过</div><div class="pg-input-group"><label class="pg-label">是否需要小组件</label><div class="pg-header-grid" data-field="needWidget"><div class="pg-header-item ${a.needWidget ? 'selected' : ''}" data-value="true"><div class="pg-header-item-title">需要</div></div><div class="pg-header-item ${!a.needWidget ? 'selected' : ''}" data-value="false"><div class="pg-header-item-title">不需要</div></div></div></div>${a.needWidget ? `<div class="pg-input-group"><label class="pg-label">组件尺寸（可多选）</label><div class="pg-feature-grid">${WIDGET_SIZES.map(s => `<div class="pg-feature-card ${a.widgetTypes.includes(s.value) ? 'selected' : ''}" data-widget-type="${s.value}"><div class="pg-feature-check"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12" /></svg></div><div class="pg-feature-info"><div class="pg-feature-title">${s.title}</div><div class="pg-feature-desc">${s.desc}</div></div></div>`).join('')}</div></div><div class="pg-input-group"><label class="pg-label">组件形状</label><div class="pg-header-grid" data-field="widgetShape">${WIDGET_SHAPES.map(s => `<div class="pg-header-item ${a.widgetShape === s.value ? 'selected' : ''}" data-value="${s.value}"><div class="pg-header-item-title">${s.title}</div></div>`).join('')}</div></div>` : ''}</div>`;
                    case 17: return `<div class="pg-card active"><div class="pg-question-title">18. 灵动岛</div><div class="pg-question-desc">是否需要灵动岛实时信息？可跳过</div><div class="pg-input-group"><label class="pg-label">是否需要灵动岛</label><div class="pg-header-grid" data-field="needIsland"><div class="pg-header-item ${a.needIsland ? 'selected' : ''}" data-value="true"><div class="pg-header-item-title">需要</div></div><div class="pg-header-item ${!a.needIsland ? 'selected' : ''}" data-value="false"><div class="pg-header-item-title">不需要</div></div></div></div>${a.needIsland ? `<div class="pg-input-group"><label class="pg-label">Medium 标题</label><input class="pg-input" type="text" placeholder="运行中" value="${escapeHtml(a.islandMedium?.title || '')}" data-field="islandMedium.title" /></div><div class="pg-input-group"><label class="pg-label">Medium 副标题</label><input class="pg-input" type="text" placeholder="副标题（选填）" value="${escapeHtml(a.islandMedium?.subtitle || '')}" data-field="islandMedium.subtitle" /></div><div class="pg-input-group"><label class="pg-label">支持模式</label><div class="pg-header-grid">${ISLAND_MODES.map(mode => `<div class="pg-header-item"><div class="pg-header-item-title">${mode.title}</div><div class="pg-header-item-desc">${mode.desc}</div></div>`).join('')}</div></div>` : ''}</div>`;
                    case 18: return `<div class="pg-card active"><div class="pg-complete"><div class="pg-complete-icon"><svg width="48" height="48" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="22" fill="#ECFDF5" stroke="#10B981" stroke-width="2" /><path d="M14 24L20 30L34 16" stroke="#10B981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" /></svg></div><div class="pg-complete-title">配置完成</div><div class="pg-complete-desc">共 18 个配置步骤，点击下方按钮生成 Prompt</div><div class="pg-summary"><div class="pg-summary-row"><span class="pg-summary-key">应用名称</span><span class="pg-summary-val">${a.appName || '未设置'}</span></div><div class="pg-summary-row"><span class="pg-summary-key">视觉风格</span><span class="pg-summary-val">${DESIGN_STYLES.find(s => s.value === a.style)?.title || 'iOS蓝'}</span></div><div class="pg-summary-row"><span class="pg-summary-key">圆角风格</span><span class="pg-summary-val">${CORNER_OPTIONS.find(c => c.value === a.corner)?.title || '中等'}</span></div><div class="pg-summary-row"><span class="pg-summary-key">核心能力</span><span class="pg-summary-val">${a.features.length} 项</span></div><div class="pg-summary-row"><span class="pg-summary-key">小组件</span><span class="pg-summary-val">${a.needWidget ? (a.widgetTypes.length + '个尺寸') : '不需要'}</span></div><div class="pg-summary-row"><span class="pg-summary-key">灵动岛</span><span class="pg-summary-val">${a.needIsland ? '需要' : '不需要'}</span></div></div></div></div>`;
                    default: return '<div class="pg-card active">步骤内容</div>';
                }
            };

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
                            <p class="pg-intro-desc">通过 18 步配置，生成专属应用的开发 Prompt</p>
                            </div>

                        <div class="pg-steps-list">
                            <div class="pg-step-item"><div class="pg-step-num">1</div><div class="pg-step-body"><div class="pg-step-title">基础信息</div><div class="pg-step-sub">名称、ID和描述</div></div></div>
                            <div class="pg-step-item"><div class="pg-step-num">2</div><div class="pg-step-body"><div class="pg-step-title">页面规划</div><div class="pg-step-sub">Tab标签定义</div></div></div>
                            <div class="pg-step-item"><div class="pg-step-num">3</div><div class="pg-step-body"><div class="pg-step-title">视觉风格</div><div class="pg-step-sub">设计语言选择</div></div></div>
                            <div class="pg-step-item"><div class="pg-step-num">4</div><div class="pg-step-body"><div class="pg-step-title">色彩搭配</div><div class="pg-step-sub">配色微调</div></div></div>
                            <div class="pg-step-item"><div class="pg-step-num">5</div><div class="pg-step-body"><div class="pg-step-title">字体排版</div><div class="pg-step-sub">字体、字号、行高</div></div></div>
                            <div class="pg-step-item"><div class="pg-step-num">6-14</div><div class="pg-step-body"><div class="pg-step-title">组件设计</div><div class="pg-step-sub">圆角、卡片、按钮、弹窗...</div></div></div>
                            <div class="pg-step-item"><div class="pg-step-num">15</div><div class="pg-step-body"><div class="pg-step-title">核心能力</div><div class="pg-step-sub">功能模块多选</div></div></div>
                            <div class="pg-step-item"><div class="pg-step-num">16-17</div><div class="pg-step-body"><div class="pg-step-title">小组件 & 灵动岛</div><div class="pg-step-sub">可选功能</div></div></div>
                        </div>

                        <button class="pg-btn-primary" ${createActionAttr({ action: 'switchPage', pageId: 'form' }, app.id)}>
                            开始配置
                        </button>
                </div>
            `;
        }

            // ========== 第二页：配置向导 (18步) ==========
            if (page.id === 'form') {
                const stepTitles = [
                    '基础信息', '页面规划', '视觉风格', '色彩搭配', '字体排版',
                    '圆角风格', '卡片设计', '按钮设计', '弹窗设计', '列表布局',
                    'Tab栏', '导航栏', '图标风格', '动效设计', '密度主题',
                    '核心能力', '小组件', '灵动岛', '完成'
                ];
                const TOTAL = stepTitles.length;
                const pct = Math.round((step / (TOTAL - 1)) * 100);

                return `
                    <div class="pg-wizard">
                        <!-- 进度条 -->
                        <div class="pg-progress">
                            <div class="pg-progress-bar" style="width: ${pct}%"></div>
                        </div>

                        <!-- 卡片容器 -->
                        <div class="pg-card-wrapper">
                            ${renderStep(step)}
                        </div>

                        <!-- 底部导航 -->
                        <div class="pg-footer">
                            ${step > 0 ? `
                                <button class="pg-btn pg-btn-back" data-action="prev">返回</button>
                            ` : '<div></div>'}
                            ${step < TOTAL - 1 ? `
                                <button class="pg-btn pg-btn-next" data-action="next">
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

            // ========== 第三页：Prompt 结果（实时同步） ==========
        if (page.id === 'result') {
                const prompt = app.methods.generatePrompt();
                const lineCount = prompt.split('\n').length;
                const sizeKB = Math.round(prompt.length / 1024 * 10) / 10;

            return `
                    <div class="pg-result">
                        <div class="pg-result-header">
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

                        <div class="pg-result-actions">
                            <button class="pg-btn pg-btn-copy ${app.state.copied ? 'copied' : ''}" ${createActionAttr({ action: 'appMethod', method: 'copyPrompt' }, app.id)}>
                                ${app.state.copied ? `
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12" /></svg>
                                    已复制
                                ` : `
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                                    复制 Prompt
                                `}
                            </button>
                        </div>

                        <button class="pg-btn pg-btn-secondary" ${createActionAttr({ action: 'switchPage', pageId: 'form' }, app.id)}>
                            继续编辑
                        </button>
                </div>
            `;
        }

        return createDefaultPageRenderer(content, page, app);
        },
    };
}

// ============ 输入监听 ============
(function bindPromptSurveyInputs() {
    // 输入框
    document.addEventListener('input', event => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        const shell = target.closest('.app-shell');
        if (!shell) return;

        const field = target.getAttribute('data-field');
        if (field) {
            const action = {
                action: 'appMethod',
                appId: 'prompt-survey',
                method: 'setAnswer',
                payload: { field, value: target.value }
            };
            window.dispatchEvent(new CustomEvent('app:page-action', { detail: action }));
            return;
        }

        // 页面编辑
        const pageIdx = target.getAttribute('data-page');
        const pageField = target.getAttribute('data-field');
        if (pageIdx !== null && pageField) {
            const action = {
                action: 'appMethod',
                appId: 'prompt-survey',
                method: 'updatePage',
                payload: { idx: parseInt(pageIdx), field: pageField, value: target.value }
            };
            window.dispatchEvent(new CustomEvent('app:page-action', { detail: action }));
        }
    });

    // 点击事件
    document.addEventListener('click', event => {
        const shell = event.target.closest('.app-shell');
        if (!shell) return;

        // 选项卡片
        const headerItem = event.target.closest('.pg-header-item[data-value]');
        if (headerItem) {
            const grid = headerItem.parentElement;
            const field = grid.getAttribute('data-field') || headerItem.getAttribute('data-field');
            const value = headerItem.getAttribute('data-value');
            if (field && value !== undefined) {
                grid.querySelectorAll('.pg-header-item').forEach(el => el.classList.remove('selected'));
                headerItem.classList.add('selected');
                const isBool = value === 'true' || value === 'false';
                window.dispatchEvent(new CustomEvent('app:page-action', {
                    detail: { action: 'appMethod', appId: 'prompt-survey', method: 'setAnswer', payload: { field, value: isBool ? value === 'true' : value } }
                }));
            }
            return;
        }

        // 功能卡片（多选）
        const featureCard = event.target.closest('.pg-feature-card[data-feature]');
        if (featureCard) {
            const value = featureCard.getAttribute('data-feature');
            featureCard.classList.toggle('selected');
            window.dispatchEvent(new CustomEvent('app:page-action', {
                detail: { action: 'appMethod', appId: 'prompt-survey', method: 'toggleFeature', payload: { value } }
            }));
            return;
        }

        // 小组件尺寸（多选）
        const widgetCard = event.target.closest('.pg-feature-card[data-widget-type]');
        if (widgetCard) {
            const value = widgetCard.getAttribute('data-widget-type');
            widgetCard.classList.toggle('selected');
            window.dispatchEvent(new CustomEvent('app:page-action', {
                detail: { action: 'appMethod', appId: 'prompt-survey', method: 'toggleWidgetType', payload: { value } }
            }));
            return;
        }

        // 风格选择
        const styleItem = event.target.closest('.pg-style-item');
        if (styleItem) {
            document.querySelectorAll('.pg-style-item').forEach(el => el.classList.remove('selected'));
            styleItem.classList.add('selected');
            const value = styleItem.getAttribute('data-value');
            window.dispatchEvent(new CustomEvent('app:page-action', {
                detail: { action: 'appMethod', appId: 'prompt-survey', method: 'setAnswer', payload: { field: 'style', value } }
            }));
            return;
        }

        // 删除页面
        const removeBtn = event.target.closest('[data-remove]');
        if (removeBtn) {
            const idx = parseInt(removeBtn.getAttribute('data-remove'));
            window.dispatchEvent(new CustomEvent('app:page-action', {
                detail: { action: 'appMethod', appId: 'prompt-survey', method: 'removePage', payload: { idx } }
            }));
            return;
        }

        // 添加页面
        const addBtn = event.target.closest('[data-action="addPage"]');
        if (addBtn) {
            window.dispatchEvent(new CustomEvent('app:page-action', {
                detail: { action: 'appMethod', appId: 'prompt-survey', method: 'addPage', payload: {} }
            }));
            return;
        }

        // 向导导航
        const navBtn = event.target.closest('[data-action="prev"], [data-action="next"]');
        if (navBtn) {
            const actionType = navBtn.getAttribute('data-action');
            const method = actionType === 'next' ? 'nextStep' : 'prevStep';
        window.dispatchEvent(new CustomEvent('app:page-action', {
                detail: { action: 'appMethod', appId: 'prompt-survey', method, payload: {} }
        }));
        }
    });
})();