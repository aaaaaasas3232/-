// ==================== promptGenApp.js ====================
// 提示词助手 - 问卷引导生成符合 v6.0 标准的虚拟手机App开发提示词
// 设计：白蓝配色 + 毛玻璃 + Q弹动画 + 丰富自定义预览
// 增强：异形小组件预览 + 按钮设计系统 + 高级动效 + 页面顶栏 + 深度自定义

(function(global) {
    'use strict';

    var COLORS = {
        primary: '#007AFF',
        primaryLight: 'rgba(0, 122, 255, 0.15)',
        secondary: '#5AC8FA',
        background: '#F2F2F7',
        cardBg: 'rgba(255, 255, 255, 0.75)',
        textPrimary: '#1D1D1F',
        textSecondary: '#86868B',
        textMuted: '#C7C7CC',
        success: '#34C759',
        warning: '#FF9500',
        danger: '#FF3B30',
        border: 'rgba(0,0,0,0.05)',
        shadow: '0 8px 32px rgba(0, 122, 255, 0.12)',
        glass: 'blur(20px)',
        indicator: 'rgba(0,0,0,0.3)'
    };

    var ICONS = {
        check: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
        copy: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
        magic: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
        next: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
        plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
        minus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
        skip: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>',
        collapse: '<svg class="pg-collapse-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>'
    };

    // ============ 问卷步骤定义 ============
    var WIZARD_STEPS = [
        { id: 'basic', title: '1. 基本信息', desc: '名称、ID和简要描述' },
        { id: 'pages', title: '2. 页面规划', desc: '定义主要页面和Tab标签' },
        {
            id: 'style', title: '3. 视觉风格', desc: '选择设计语言', type: 'style-grid',
            options: [
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
                { value: 'retro-pixel', title: '像素复古', desc: '8-bit怀旧', colors: { bg: '#2B2B2B', card: '#3C3C3C', prim: '#FFD700' } }
            ]
        },
        { id: 'palette', title: '4. 色彩搭配', desc: '微调配色（可自定义）', type: 'palette' },
        // ===== 新增：字体排版系统 =====
        { id: 'typography', title: '5. 字体排版', desc: '字体风格、字号比例与行高', type: 'typography-design' },
        { id: 'corner', title: '6. 圆角风格', desc: '卡片和按钮的圆角', type: 'corner-preview' },
        // ===== 新增：卡片设计系统 =====
        { id: 'card-design', title: '7. 卡片设计', desc: '阴影、边框、间距与背景效果', type: 'card-design' },
        // ===== 按钮设计系统 =====
        { id: 'button-design', title: '8. 按钮设计系统', desc: '按钮形态、尺寸、交互反馈与微动效', type: 'button-design' },
        { id: 'modal', title: '9. 弹窗设计', desc: '弹窗样式与交互', type: 'modal-preview' },
        { id: 'list', title: '10. 列表布局', desc: '内容展示方式', type: 'list-preview' },
        // ===== 新增：Tab栏设计（屏幕底部的切换按钮栏） =====
        { id: 'tabbar-design', title: '11. Tab栏', desc: '屏幕底部的"首页/发现/我的"切换栏', type: 'tabbar-design' },
        // ===== 页面顶栏设计（屏幕顶部的标题区域） =====
        { id: 'navbar', title: '12. 页面顶栏', desc: '屏幕顶部显示页面标题的区域', type: 'navbar-design' },
        // ===== 新增：图标风格 =====
        { id: 'icon-style', title: '13. 图标风格', desc: '全局图标线条风格与粗细', type: 'icon-style-design' },
        // ===== 动效设计系统 =====
        { id: 'motion', title: '14. 动效设计系统', desc: '过渡动画、微交互、缓动曲线与特效', type: 'motion-design' },
        // ===== 新增：信息密度与暗色模式 =====
        { id: 'density-theme', title: '15. 密度与主题', desc: '信息密度、暗色模式与空状态', type: 'density-theme-design' },
        {
            id: 'features', title: '16. 核心能力', desc: '功能模块（可多选）', type: 'multi',
            options: [
                { value: 'ai', title: 'AI 对话', desc: '接入大模型智能对话' },
                { value: 'db', title: '本地存储', desc: '数据持久化' },
                { value: 'camera', title: '图片上传', desc: '相册/相机' },
                { value: 'charts', title: '数据图表', desc: '统计图' },
                { value: 'search', title: '搜索功能', desc: '全局搜索栏' },
                { value: 'pull-refresh', title: '下拉刷新', desc: '列表下拉刷新' },
                { value: 'dark-toggle', title: '暗色切换', desc: '明暗主题一键切换' },
                { value: 'gesture', title: '手势操作', desc: '滑动删除/长按排序' },
                { value: 'share', title: '分享功能', desc: '内容分享面板' },
                { value: 'favorite', title: '收藏点赞', desc: '收藏/点赞交互' },
                { value: 'onboarding', title: '引导页', desc: '首次使用引导流程' },
                { value: 'notification', title: '通知模拟', desc: '应用内通知提示' },
                { value: 'settings', title: '设置页面', desc: '偏好设置与关于' },
                { value: 'login', title: '登录注册', desc: '用户认证流程' }
            ]
        },
        // ===== 小组件步骤（增强异形预览） =====
        { id: 'widget-toggle', title: '17. 小组件', desc: '是否需要桌面小组件？可跳过', type: 'widget-toggle' },
        { id: 'widget-design', title: '18. 小组件设计', desc: '配置尺寸、形状、内容和样式', type: 'widget-design' },
        // ===== 灵动岛步骤 =====
        { id: 'island-toggle', title: '19. 灵动岛', desc: '是否需要灵动岛实时信息？可跳过', type: 'island-toggle' },
        { id: 'island-design', title: '20. 灵动岛设计', desc: '配置 Quiet / Mini / Medium / Large 模式', type: 'island-design' }
    ];

    // ============ 构造函数 ============
    function PromptGenApp() {
        EnhancedApp.call(this, {
            id: 'prompt-gen-app', name: '提示词助手',
            color: COLORS.background, barStyle: 'dark', tabs: []
        });
        this.currentStep = 0;
        this.answers = this.getDefaultAnswers();
        this.fullPromptSpec = '';
        this.generatedPrompt = '';
    }
    PromptGenApp.prototype = Object.create(EnhancedApp.prototype);
    PromptGenApp.prototype.constructor = PromptGenApp;

    PromptGenApp.prototype.getDefaultAnswers = function() {
        return {
            appName: '', appId: '', appDesc: '',
            structure: 'tab',
            pages: [
                { name: '首页', desc: '主要内容展示' },
                { name: '发现', desc: '探索和推荐' },
                { name: '我的', desc: '个人中心和设置' }
            ],
            style: 'ios-blue', features: [],
            palette: 'auto',
            customBg: '#F2F2F7', customCard: '#FFFFFF', customPrim: '#007AFF', customAccent: '#FF9500',
            corner: 'medium',
            // ===== 字体排版系统 =====
            typoFamily: 'system',        // system | rounded | serif | mono | handwritten
            typoScale: 'standard',       // compact | standard | relaxed
            typoWeight: 'medium',        // light | medium | bold
            typoLineHeight: 'normal',    // tight | normal | loose
            // ===== 卡片设计系统 =====
            cardShadow: 'medium',        // none | light | medium | deep
            cardBorder: 'none',          // none | hairline | gradient | dashed
            cardPadding: 'standard',     // compact | standard | spacious
            cardBackground: 'solid',     // solid | gradient | glass | image
            // ===== Tab栏设计 =====
            tabIconStyle: 'outlined',    // outlined | filled | duotone
            tabMaterial: 'blur',         // blur | solid | transparent
            tabAnimation: 'scale',       // scale | slide | fade | bounce
            tabBadge: 'dot',             // dot | number | none
            tabCenterBtn: false,
            // ===== 图标风格 =====
            iconStyle: 'outlined',       // outlined | filled | duotone | rounded | sharp
            iconWeight: 'regular',       // thin | regular | bold
            // ===== 信息密度与主题 =====
            density: 'standard',         // compact | standard | comfortable
            darkMode: 'none',            // none | support | default
            emptyState: 'minimal',       // minimal | illustration | icon
            inputStyle: 'border',        // border | underline | filled
            // ===== 按钮设计系统 =====
            btnShape: 'rounded',        // rounded | pill | squircle | ghost | outlined
            btnSize: 'medium',           // small | medium | large
            btnFeedback: 'scale',        // scale | ripple | glow | bounce | none
            btnIconPos: 'left',          // left | right | only | none
            btnShadow: true,
            btnGradient: false,
            // ===== 弹窗 =====
            modalStyle: 'center', modalClose: 'overlay', modalRadius: 'large',
            listLayout: 'card',
            // ===== 页面顶栏设计（屏幕顶部标题区域） =====
            navStyle: 'large-title',     // large-title | center-title | transparent | gradient | segmented | floating
            navMaterial: 'blur',         // blur | solid | transparent | gradient
            navEffect: 'none',           // none | parallax | sticky-shrink | color-shift | jelly
            navHasSearch: false,
            navHasDivider: true,
            // ===== 子页面/详情页顶栏 =====
            detailNavLayout: 'inline',   // inline | stacked | minimal
            detailNavAvatar: true,       // 是否显示头像
            detailNavSubtitle: true,     // 是否显示副标题
            detailNavActions: 'right',   // right | none | both
            // ===== 分段控制栏 / 标签页切换栏 =====
            segmentStyle: 'pill',        // pill | underline | block | chip
            segmentPosition: 'below-nav', // below-nav | inside-nav | sticky-top
            segmentAnimation: 'slide',   // slide | fade | spring
            // ===== 动效设计系统 =====
            motionCurve: 'spring',       // spring | ease | sharp | bounce | elastic
            motionTransition: 'slide',   // slide | fade | scale | flip | morph | parallax
            motionMicro: 'jelly',        // jelly | pulse | wiggle | pop | none
            motionLoading: 'skeleton',   // skeleton | spinner | shimmer | dots | lottie
            motionScroll: 'parallax',    // parallax | fade-in | slide-up | none
            motionHaptic: true,
            // ===== 小组件 =====
            needWidget: false,
            widgetTypes: [],
            widgetShape: 'rounded-rect', // rounded-rect | circle | squircle | blob | pill
            widgetSmall: { title: '', content: '', icon: '', desc: '' },
            widgetMedium: { title: '', content: '', layout: 'horizontal', icon: '', desc: '' },
            widgetLarge: { title: '', content: '', layout: 'horizontal', desc: '' },
            // ===== 灵动岛 =====
            needIsland: false,
            islandQuiet: { content: '', icon: '', desc: '' },
            islandMini: { content: '', desc: '' },
            islandMedium: { title: '', subtitle: '', hasProgress: false, hasControls: false, desc: '' },
            islandLarge: { enabled: false, title: '', content: '', hasProgress: false, desc: '' },
            islandNotify: { success: true, error: true, warning: true, info: true }
        };
    };

    // ============ 样式 ============
    // 折叠组件辅助方法
    PromptGenApp.prototype.collapseWrap = function(title, content, openByDefault) {
        return '<div class="pg-collapse' + (openByDefault ? ' open' : '') + '">' +
            '<div class="pg-collapse-header">' +
            '<span class="pg-collapse-title">' + title + '</span>' +
            ICONS.collapse +
            '</div>' +
            '<div class="pg-collapse-body">' + content + '</div></div>';
    };

    PromptGenApp.prototype.getStyles = function() {
        return '<style>' +
            '.pg-style-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;}' +
            '.pg-style-card{display:flex;flex-direction:column;align-items:center;padding:7px;border-radius:10px;background:rgba(255,255,255,0.5);border:2px solid transparent;cursor:pointer;transition:all 0.2s;}' +
            '.pg-style-card.selected{border-color:' + COLORS.primary + ';background:' + COLORS.primaryLight + ';}' +
            '.pg-preview-box{width:100%;height:36px;border-radius:7px;margin-bottom:3px;position:relative;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.08);}' +
            '.pg-preview-card{position:absolute;bottom:5px;left:5px;right:5px;height:18px;border-radius:4px;}' +
            '.pg-preview-btn{position:absolute;bottom:8px;right:8px;width:16px;height:9px;border-radius:3px;}' +
            '.pg-style-title{font-size:10px;font-weight:700;color:' + COLORS.textPrimary + ';}' +
            '.pg-style-desc{font-size:8px;color:' + COLORS.textSecondary + ';margin-top:1px;}' +
            '.pg-container{flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden;}' +
            '.pg-scroll{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:12px;padding-bottom:6px;-webkit-overflow-scrolling:touch;}' +
            '.pg-scroll::-webkit-scrollbar{display:none;}' +
            '.pg-header{margin-bottom:10px;padding-top:6px;}' +
            '.pg-big-title{font-size:20px;font-weight:800;color:' + COLORS.primary + ';margin-bottom:2px;letter-spacing:-0.5px;}' +
            '.pg-sub-title{font-size:11px;color:' + COLORS.textSecondary + ';font-weight:500;}' +
            '.pg-progress{height:3px;background:rgba(0,0,0,0.05);border-radius:2px;margin-bottom:10px;overflow:hidden;}' +
            '.pg-progress-bar{height:100%;background:' + COLORS.primary + ';width:0%;transition:width 0.4s cubic-bezier(0.34,1.56,0.64,1);border-radius:2px;}' +
            '.pg-card-wrapper{position:relative;}' +
            '.pg-card{background:' + COLORS.cardBg + ';backdrop-filter:' + COLORS.glass + ';-webkit-backdrop-filter:' + COLORS.glass + ';' +
            'border-radius:14px;padding:14px;box-sizing:border-box;box-shadow:' + COLORS.shadow + ';border:1px solid rgba(255,255,255,0.4);display:none;}' +
            '.pg-card.active{display:block;}' +
            '.pg-card.pg-animate-in{animation:pgCardIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards;}' +
            '@keyframes pgCardIn{from{opacity:0;transform:scale(0.95) translateY(10px);}to{opacity:1;transform:scale(1) translateY(0);}}' +
            '.pg-question-title{font-size:15px;font-weight:700;color:' + COLORS.textPrimary + ';margin-bottom:3px;}' +
            '.pg-question-desc{font-size:10px;color:' + COLORS.textSecondary + ';margin-bottom:12px;}' +
            '.pg-input-group{margin-bottom:10px;}' +
            '.pg-label{display:block;font-size:10px;font-weight:600;color:' + COLORS.textSecondary + ';margin-bottom:4px;}' +
            '.pg-input,.pg-textarea{width:100%;padding:8px 10px;border:1px solid ' + COLORS.border + ';background:rgba(255,255,255,0.5);border-radius:8px;font-size:13px;color:' + COLORS.textPrimary + ';outline:none;transition:all 0.2s;box-sizing:border-box;font-family:inherit;}' +
            '.pg-textarea{resize:none;height:48px;font-size:12px;line-height:1.4;}' +
            '.pg-input:focus,.pg-textarea:focus{background:white;border-color:' + COLORS.primary + ';box-shadow:0 0 0 3px ' + COLORS.primaryLight + ';}' +
            '.pg-option{display:flex;align-items:center;padding:9px;margin-bottom:6px;background:rgba(255,255,255,0.5);border:1px solid transparent;border-radius:9px;cursor:pointer;transition:all 0.2s;}' +
            '.pg-option:last-child{margin-bottom:0;}' +
            '.pg-option:active{transform:scale(0.98);}' +
            '.pg-option.selected{background:' + COLORS.primaryLight + ';border-color:' + COLORS.primary + ';}' +
            '.pg-option-check{width:15px;height:15px;border-radius:50%;border:2px solid ' + COLORS.textSecondary + ';margin-right:8px;display:flex;align-items:center;justify-content:center;transition:all 0.2s;flex-shrink:0;}' +
            '.pg-option.selected .pg-option-check{background:' + COLORS.primary + ';border-color:' + COLORS.primary + ';}' +
            '.pg-option.selected .pg-option-check svg{opacity:1;}' +
            '.pg-option-check svg{width:9px;height:9px;stroke:white;opacity:0;transition:opacity 0.2s;}' +
            '.pg-footer{flex-shrink:0;display:flex;gap:8px;padding:8px 12px;background:rgba(255,255,255,0.95);border-top:1px solid rgba(0,0,0,0.06);}' +
            '.pg-btn{flex:1;height:38px;border-radius:10px;border:none;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:4px;cursor:pointer;transition:all 0.2s;}' +
            '.pg-btn:active{transform:scale(0.96);}' +
            '.pg-btn-back{background:rgba(255,255,255,0.6);color:' + COLORS.textSecondary + ';}' +
            '.pg-btn-next{background:' + COLORS.primary + ';color:white;box-shadow:0 4px 12px rgba(0,122,255,0.3);}' +
            '.pg-btn-next.disabled{opacity:0.5;pointer-events:none;}' +
            '.pg-prev-wrap{background:rgba(0,0,0,0.03);border-radius:10px;padding:8px;margin-bottom:10px;display:flex;align-items:center;justify-content:center;min-height:60px;position:relative;overflow:hidden;}' +
            '.pg-prev-label{position:absolute;top:5px;left:7px;font-size:8px;color:' + COLORS.textSecondary + ';font-weight:600;text-transform:uppercase;letter-spacing:0.5px;}' +
            '.pg-color-row{display:flex;align-items:center;gap:6px;margin-bottom:7px;}' +
            '.pg-color-label{font-size:10px;color:' + COLORS.textSecondary + ';width:36px;flex-shrink:0;font-weight:600;}' +
            '.pg-color-input{width:28px;height:28px;border:2px solid rgba(0,0,0,0.08);border-radius:7px;cursor:pointer;padding:0;background:none;-webkit-appearance:none;overflow:hidden;}' +
            '.pg-color-input::-webkit-color-swatch-wrapper{padding:0;}' +
            '.pg-color-input::-webkit-color-swatch{border:none;border-radius:5px;}' +
            '.pg-color-hex{font-size:10px;color:' + COLORS.textPrimary + ';font-family:monospace;background:rgba(0,0,0,0.04);padding:2px 5px;border-radius:5px;}' +
            '.pg-corner-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;}' +
            '.pg-corner-item{display:flex;flex-direction:column;align-items:center;padding:8px 6px;background:rgba(255,255,255,0.5);border:2px solid transparent;border-radius:9px;cursor:pointer;transition:all 0.2s;}' +
            '.pg-corner-item.selected{border-color:' + COLORS.primary + ';background:' + COLORS.primaryLight + ';}' +
            '.pg-corner-demo{width:50px;height:30px;background:' + COLORS.primary + ';margin-bottom:4px;transition:border-radius 0.3s;}' +
            '.pg-corner-name{font-size:10px;font-weight:600;color:' + COLORS.textPrimary + ';}' +
            '.pg-corner-val{font-size:8px;color:' + COLORS.textSecondary + ';}' +
            '.pg-modal-row{display:flex;gap:6px;margin-bottom:6px;}' +
            '.pg-modal-row .pg-option{flex:1;padding:7px;margin:0;justify-content:center;text-align:center;}' +
            '.pg-modal-prev{width:100%;height:90px;background:#1D1D1F;border-radius:9px;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;}' +
            '.pg-modal-prev-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.4);}' +
            '.pg-modal-prev-dialog{position:relative;z-index:1;background:white;padding:8px;text-align:center;transition:all 0.3s;}' +
            '.pg-modal-prev-dialog .pg-mp-title{font-size:10px;font-weight:700;color:#1D1D1F;margin-bottom:3px;}' +
            '.pg-modal-prev-dialog .pg-mp-body{font-size:8px;color:#86868B;margin-bottom:5px;}' +
            '.pg-modal-prev-dialog .pg-mp-btn{display:inline-block;padding:3px 12px;border-radius:5px;font-size:9px;font-weight:600;color:white;}' +
            '.pg-modal-prev-close{position:absolute;top:3px;right:5px;font-size:12px;color:#999;z-index:2;line-height:1;}' +
            '.pg-list-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;}' +
            '.pg-list-item{display:flex;flex-direction:column;align-items:center;padding:7px;background:rgba(255,255,255,0.5);border:2px solid transparent;border-radius:9px;cursor:pointer;transition:all 0.2s;}' +
            '.pg-list-item.selected{border-color:' + COLORS.primary + ';background:' + COLORS.primaryLight + ';}' +
            '.pg-list-demo{width:100%;height:44px;position:relative;margin-bottom:3px;}' +
            '.pg-list-name{font-size:10px;font-weight:600;color:' + COLORS.textPrimary + ';}' +
            '.pg-page-item{background:rgba(255,255,255,0.5);border-radius:9px;padding:8px;margin-bottom:7px;display:flex;gap:8px;align-items:flex-start;}' +
            '.pg-page-num{width:20px;height:20px;border-radius:50%;background:' + COLORS.primary + ';color:white;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;}' +
            '.pg-page-fields{flex:1;min-width:0;}' +
            '.pg-page-fields input,.pg-page-fields textarea{width:100%;padding:6px 8px;border:1px solid ' + COLORS.border + ';border-radius:6px;font-size:11px;color:' + COLORS.textPrimary + ';outline:none;box-sizing:border-box;background:rgba(255,255,255,0.6);font-family:inherit;margin-bottom:4px;}' +
            '.pg-page-fields textarea{height:32px;resize:none;font-size:10px;}' +
            '.pg-page-fields input:focus,.pg-page-fields textarea:focus{border-color:' + COLORS.primary + ';}' +
            '.pg-page-del{width:22px;height:22px;border-radius:6px;border:none;background:rgba(0,122,255,0.08);color:' + COLORS.primary + ';font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;transition:all 0.2s;}' +
            '.pg-page-del:active{transform:scale(0.9);background:rgba(0,122,255,0.18);}' +
            '.pg-page-add{display:flex;align-items:center;justify-content:center;gap:4px;padding:8px;border-radius:9px;border:1.5px dashed rgba(0,122,255,0.3);color:' + COLORS.primary + ';font-size:11px;font-weight:600;cursor:pointer;transition:all 0.2s;background:transparent;}' +
            '.pg-page-add:active{transform:scale(0.98);}' +
            '.pg-struct-row{display:flex;gap:6px;margin-bottom:10px;}' +
            '.pg-struct-btn{flex:1;padding:8px;border-radius:9px;border:2px solid transparent;background:rgba(255,255,255,0.5);text-align:center;cursor:pointer;transition:all 0.2s;}' +
            '.pg-struct-btn.selected{border-color:' + COLORS.primary + ';background:' + COLORS.primaryLight + ';}' +
            '.pg-struct-btn-title{font-size:12px;font-weight:700;color:' + COLORS.textPrimary + ';}' +
            '.pg-struct-btn-desc{font-size:9px;color:' + COLORS.textSecondary + ';margin-top:2px;}' +
            '.pg-result-div{width:100%;max-height:260px;background:rgba(255,255,255,0.9);border-radius:10px;border:1px solid rgba(0,0,0,0.06);padding:10px;font-size:10px;color:#333;overflow-y:auto;margin-bottom:10px;box-sizing:border-box;line-height:1.6;-webkit-overflow-scrolling:touch;white-space:pre-wrap;word-break:break-word;font-family:-apple-system,BlinkMacSystemFont,sans-serif;}' +
            '.pg-result-div::-webkit-scrollbar{display:none;}' +
            '.pg-header-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;}' +
            '.pg-header-item{padding:8px;background:rgba(255,255,255,0.5);border:2px solid transparent;border-radius:9px;cursor:pointer;transition:all 0.2s;text-align:center;}' +
            '.pg-header-item.selected{border-color:' + COLORS.primary + ';background:' + COLORS.primaryLight + ';}' +
            '.pg-header-item-title{font-size:11px;font-weight:600;color:' + COLORS.textPrimary + ';}' +
            '.pg-header-item-desc{font-size:8px;color:' + COLORS.textSecondary + ';margin-top:1px;}' +
            '.pg-choice-card{display:flex;align-items:center;padding:12px;margin-bottom:7px;background:rgba(255,255,255,0.5);border:2px solid transparent;border-radius:10px;cursor:pointer;transition:all 0.2s;}' +
            '.pg-choice-card:active{transform:scale(0.98);}' +
            '.pg-choice-card.selected{border-color:' + COLORS.primary + ';background:' + COLORS.primaryLight + ';}' +
            '.pg-choice-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;margin-right:10px;flex-shrink:0;}' +
            '.pg-choice-title{font-size:12px;font-weight:600;color:' + COLORS.textPrimary + ';}' +
            '.pg-choice-desc{font-size:9px;color:' + COLORS.textSecondary + ';margin-top:1px;line-height:1.3;}' +
            '.pg-tag-grid{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;}' +
            '.pg-tag{padding:6px 12px;border-radius:8px;font-size:11px;font-weight:500;background:rgba(255,255,255,0.5);border:1.5px solid transparent;cursor:pointer;transition:all 0.2s;color:' + COLORS.textPrimary + ';}' +
            '.pg-tag:active{transform:scale(0.96);}' +
            '.pg-tag.selected{background:' + COLORS.primaryLight + ';border-color:' + COLORS.primary + ';color:' + COLORS.primary + ';}' +
            '.pg-toggle-row{display:flex;align-items:center;justify-content:space-between;padding:10px;background:rgba(255,255,255,0.5);border-radius:9px;margin-bottom:6px;}' +
            '.pg-toggle{width:40px;height:22px;border-radius:11px;background:#ccc;position:relative;cursor:pointer;transition:background 0.2s;flex-shrink:0;}' +
            '.pg-toggle.on{background:' + COLORS.primary + ';}' +
            '.pg-toggle-knob{width:18px;height:18px;border-radius:50%;background:white;position:absolute;top:2px;left:2px;transition:all 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2);}' +
            '.pg-toggle.on .pg-toggle-knob{left:20px;}' +
            '.pg-island-prev{background:#1D1D1F;border-radius:18px;overflow:hidden;margin:0 auto;transition:all 0.3s;}' +
            '.pg-island-quiet{width:80px;height:28px;display:flex;align-items:center;justify-content:center;}' +
            '.pg-island-mini{width:140px;height:28px;display:flex;align-items:center;justify-content:center;}' +
            '.pg-island-medium{width:200px;min-height:80px;padding:10px 14px;border-radius:24px;}' +
            '.pg-island-large{width:230px;min-height:140px;padding:12px 14px;border-radius:28px;}' +
            '.pg-widget-prev-small{width:72px;height:72px;background:white;box-shadow:0 2px 8px rgba(0,0,0,0.08);padding:8px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;transition:all 0.3s;}' +
            '.pg-widget-prev-medium{width:156px;height:72px;background:white;box-shadow:0 2px 8px rgba(0,0,0,0.08);padding:8px;box-sizing:border-box;transition:all 0.3s;}' +
            '.pg-widget-prev-large{width:100%;max-width:240px;height:72px;background:white;box-shadow:0 2px 8px rgba(0,0,0,0.08);padding:8px;box-sizing:border-box;display:flex;align-items:center;gap:8px;transition:all 0.3s;}' +
            /* 异形小组件形状 */
            '.pg-widget-shape-rounded-rect .pg-widget-prev-small{border-radius:14px;}' +
            '.pg-widget-shape-rounded-rect .pg-widget-prev-medium{border-radius:14px;}' +
            '.pg-widget-shape-rounded-rect .pg-widget-prev-large{border-radius:14px;}' +
            '.pg-widget-shape-circle .pg-widget-prev-small{border-radius:50%;width:72px;height:72px;}' +
            '.pg-widget-shape-circle .pg-widget-prev-medium{border-radius:36px;height:72px;}' +
            '.pg-widget-shape-circle .pg-widget-prev-large{border-radius:36px;}' +
            '.pg-widget-shape-squircle .pg-widget-prev-small{border-radius:22px;}' +
            '.pg-widget-shape-squircle .pg-widget-prev-medium{border-radius:22px;}' +
            '.pg-widget-shape-squircle .pg-widget-prev-large{border-radius:22px;}' +
            '.pg-widget-shape-blob .pg-widget-prev-small{border-radius:30% 70% 70% 30% / 30% 30% 70% 70%;}' +
            '.pg-widget-shape-blob .pg-widget-prev-medium{border-radius:30% 70% 70% 30% / 30% 30% 70% 70%;}' +
            '.pg-widget-shape-blob .pg-widget-prev-large{border-radius:30% 70% 70% 30% / 30% 30% 70% 70%;}' +
            '.pg-widget-shape-pill .pg-widget-prev-small{border-radius:36px;}' +
            '.pg-widget-shape-pill .pg-widget-prev-medium{border-radius:36px;}' +
            '.pg-widget-shape-pill .pg-widget-prev-large{border-radius:36px;}' +
            '.pg-layout-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:8px;}' +
            '.pg-layout-item{padding:8px;background:rgba(255,255,255,0.5);border:2px solid transparent;border-radius:9px;cursor:pointer;transition:all 0.2s;text-align:center;}' +
            '.pg-layout-item.selected{border-color:' + COLORS.primary + ';background:' + COLORS.primaryLight + ';}' +
            '.pg-layout-item:active{transform:scale(0.98);}' +
            '.pg-layout-name{font-size:10px;font-weight:600;color:' + COLORS.textPrimary + ';margin-top:3px;}' +
            /* 折叠组件 */
            '.pg-collapse{margin-bottom:8px;border-radius:9px;overflow:hidden;background:rgba(255,255,255,0.3);}' +
            '.pg-collapse-header{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;cursor:pointer;user-select:none;-webkit-user-select:none;transition:background 0.15s;}' +
            '.pg-collapse-header:active{background:rgba(0,0,0,0.03);}' +
            '.pg-collapse-title{font-size:10px;font-weight:600;color:' + COLORS.textSecondary + ';}' +
            '.pg-collapse-arrow{width:16px;height:16px;transition:transform 0.25s cubic-bezier(0.34,1.56,0.64,1);color:' + COLORS.textMuted + ';}' +
            '.pg-collapse.open .pg-collapse-arrow{transform:rotate(90deg);}' +
            '.pg-collapse-body{max-height:0;overflow:hidden;transition:max-height 0.3s cubic-bezier(0.4,0,0.2,1);padding:0 10px;}' +
            '.pg-collapse.open .pg-collapse-body{max-height:800px;padding:0 10px 8px;}' +
            /* 顶部预览条 */
            '.pg-top-preview{background:rgba(0,0,0,0.03);border-radius:10px;padding:8px;margin-bottom:10px;position:relative;overflow:hidden;min-height:50px;}' +
            '.pg-top-preview .pg-prev-label{position:absolute;top:5px;left:7px;font-size:8px;color:' + COLORS.textSecondary + ';font-weight:600;text-transform:uppercase;letter-spacing:0.5px;}' +
            '.pg-notify-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;}' +
            '.pg-section-title{font-size:11px;font-weight:700;color:' + COLORS.textPrimary + ';margin:10px 0 5px;padding-bottom:4px;border-bottom:1px solid rgba(0,0,0,0.06);}' +
            '.pg-section-title:first-child{margin-top:0;}' +
            '.pg-hint{font-size:8px;color:' + COLORS.textMuted + ';margin-top:2px;line-height:1.3;font-style:italic;}' +
            /* 按钮预览动画 */
            '@keyframes pgBtnRipple{0%{transform:scale(0);opacity:0.5;}100%{transform:scale(2.5);opacity:0;}}' +
            '@keyframes pgBtnGlow{0%{box-shadow:0 0 5px rgba(0,122,255,0.4);}50%{box-shadow:0 0 20px rgba(0,122,255,0.6);}100%{box-shadow:0 0 5px rgba(0,122,255,0.4);}}' +
            '@keyframes pgJelly{0%{transform:scale(1);}30%{transform:scale(1.15,0.85);}40%{transform:scale(0.85,1.15);}50%{transform:scale(1.05,0.95);}65%{transform:scale(0.98,1.02);}75%{transform:scale(1.02,0.98);}100%{transform:scale(1);}}' +
            '@keyframes pgPulse{0%{transform:scale(1);}50%{transform:scale(1.05);}100%{transform:scale(1);}}' +
            '@keyframes pgWiggle{0%{transform:rotate(0);}25%{transform:rotate(-3deg);}50%{transform:rotate(3deg);}75%{transform:rotate(-1deg);}100%{transform:rotate(0);}}' +
            '@keyframes pgShimmer{0%{background-position:-200% 0;}100%{background-position:200% 0;}}' +
            '@keyframes pgBounceIn{0%{transform:scale(0.3);opacity:0;}50%{transform:scale(1.05);}70%{transform:scale(0.9);}100%{transform:scale(1);opacity:1;}}' +
            '@keyframes pgElastic{0%{transform:scale(0);}55%{transform:scale(1.1);}70%{transform:scale(0.95);}100%{transform:scale(1);}}' +
            /* 三列网格 */
            '.pg-grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;}' +
            '.pg-grid-3 .pg-header-item{padding:6px 4px;}' +
            '.pg-grid-3 .pg-header-item-title{font-size:10px;}' +
            '.pg-grid-3 .pg-header-item-desc{font-size:7px;}' +
            /* 按钮预览区 */
            '.pg-btn-preview-area{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;padding:12px 8px;}' +
            '.pg-btn-demo{padding:8px 18px;font-size:11px;font-weight:600;cursor:pointer;transition:all 0.25s;border:none;position:relative;overflow:hidden;display:inline-flex;align-items:center;gap:4px;}' +
            '.pg-btn-demo-sm{padding:5px 12px;font-size:9px;}' +
            '.pg-btn-demo-lg{padding:11px 24px;font-size:13px;}' +
            /* 导航栏预览 */
            '.pg-nav-preview{width:100%;height:52px;position:relative;overflow:hidden;border-radius:8px;margin-top:6px;}' +
            '.pg-nav-inner{height:100%;display:flex;align-items:center;padding:0 12px;position:relative;}' +
            '.pg-nav-title{font-weight:700;color:white;}' +
            /* 动效预览 */
            '.pg-motion-demo{width:36px;height:36px;border-radius:8px;background:' + COLORS.primary + ';cursor:pointer;transition:all 0.3s;}' +
            '.pg-motion-demo:hover{transform:scale(1.1);}' +
            '.pg-motion-demo.jelly:active{animation:pgJelly 0.6s ease;}' +
            '.pg-motion-demo.pulse:active{animation:pgPulse 0.4s ease;}' +
            '.pg-motion-demo.wiggle:active{animation:pgWiggle 0.5s ease;}' +
            '.pg-motion-demo.pop:active{animation:pgBounceIn 0.5s ease;}' +
        '</style>';
    };

    // ============ 渲染主框架 ============
    PromptGenApp.prototype.render = function() {
        var win = document.createElement('div');
        win.className = 'app-window hidden';
        win.style.background = 'linear-gradient(180deg, #F2F2F7 0%, #FFFFFF 100%)';
        var html = this.getStyles();
        html += '<div class="app-status-bar-gap"></div>';
        html += '<div class="app-content-page pg-container" style="overflow:hidden;">';
        html += '<div class="pg-scroll">';
        html += '<div class="pg-header"><div class="pg-big-title">App 生成向导</div><div class="pg-sub-title">逐步定制，生成 v6.0 标准提示词</div></div>';
        html += '<div class="pg-progress"><div class="pg-progress-bar" id="pg-progress"></div></div>';
        html += '<div class="pg-card-wrapper" id="pg-card-container"></div>';
        html += '</div>';
        html += '<div class="pg-footer" id="pg-footer">';
        html += '<button type="button" class="pg-btn pg-btn-back" id="pg-back-btn" style="display:none;">返回</button>';
        html += '<button type="button" class="pg-btn pg-btn-next" id="pg-next-btn">下一步 ' + ICONS.next + '</button>';
        html += '</div></div>';
        html += '<div class="home-indicator" style="background-color:rgba(0,0,0,0.55);"></div><div class="home-indicator-area"></div>';
        html += this.renderModalHtml();
        win.innerHTML = html;
        document.getElementById('appContainer').appendChild(win);
        this.appWindow = win;
        this.windowCache = true;
        this.renderSteps();
        this.updateUI();
        this.bindEvents();
        this.bindHomeIndicatorEvents();
        this.loadFullSpec();
    };

    // ============ 渲染步骤卡片 ============
    PromptGenApp.prototype.renderSteps = function() {
        var container = this.appWindow.querySelector('#pg-card-container');
        var html = '';
        var self = this;

        WIZARD_STEPS.forEach(function(step, index) {
            html += '<div class="pg-card" id="step-' + index + '">';
            html += '<div class="pg-question-title">' + step.title + '</div>';
            html += '<div class="pg-question-desc">' + step.desc + '</div>';

            if (step.id === 'basic') {
                html += self.renderBasicStep();
            } else if (step.id === 'pages') {
                html += self.renderPagesStep();
            } else if (step.type === 'multi') {
                html += '<div class="pg-options-list" data-step="' + index + '">';
                step.options.forEach(function(opt) {
                    html += '<div class="pg-option" data-value="' + opt.value + '">';
                    html += '<div class="pg-option-check">' + ICONS.check + '</div>';
                    html += '<div><div style="font-weight:600;font-size:12px;color:' + COLORS.textPrimary + '">' + opt.title + '</div>';
                    html += '<div style="font-size:9px;color:' + COLORS.textSecondary + '">' + opt.desc + '</div></div></div>';
                });
                html += '</div>';
            } else if (step.type === 'style-grid') {
                html += '<div class="pg-style-grid" data-step="' + index + '">';
                step.options.forEach(function(opt) {
                    html += '<div class="pg-style-card" data-value="' + opt.value + '">';
                    html += '<div class="pg-preview-box" style="background:' + opt.colors.bg + ';">';
                    html += '<div class="pg-preview-card" style="background:' + opt.colors.card + ';"></div>';
                    html += '<div class="pg-preview-btn" style="background:' + opt.colors.prim + ';"></div>';
                    html += '</div>';
                    html += '<div class="pg-style-title">' + opt.title + '</div>';
                    html += '<div class="pg-style-desc">' + opt.desc + '</div></div>';
                });
                html += '</div>';
            } else if (step.type === 'palette') {
                html += self.renderPaletteStep();
            } else if (step.type === 'corner-preview') {
                html += self.renderCornerStep();
            } else if (step.type === 'card-design') {
                html += self.renderCardDesignStep();
            } else if (step.type === 'typography-design') {
                html += self.renderTypographyDesignStep();
            } else if (step.type === 'button-design') {
                html += self.renderButtonDesignStep();
            } else if (step.type === 'modal-preview') {
                html += self.renderModalStep();
            } else if (step.type === 'list-preview') {
                html += self.renderListStep();
            } else if (step.type === 'navbar-design') {
                html += self.renderNavbarDesignStep();
            } else if (step.type === 'tabbar-design') {
                html += self.renderTabbarDesignStep();
            } else if (step.type === 'icon-style-design') {
                html += self.renderIconStyleDesignStep();
            } else if (step.type === 'motion-design') {
                html += self.renderMotionDesignStep();
            } else if (step.type === 'density-theme-design') {
                html += self.renderDensityThemeDesignStep();
            } else if (step.type === 'widget-toggle') {
                html += self.renderWidgetToggleStep();
            } else if (step.type === 'widget-design') {
                html += self.renderWidgetDesignStep();
            } else if (step.type === 'island-toggle') {
                html += self.renderIslandToggleStep();
            } else if (step.type === 'island-design') {
                html += self.renderIslandDesignStep();
            }
            html += '</div>';
        });

        // 结果卡片
        html += '<div class="pg-card" id="step-result">';
        html += '<div class="pg-question-title" style="color:' + COLORS.success + '">生成完成</div>';
        html += '<div class="pg-question-desc">预览你的提示词，点击复制发送给AI</div>';
        html += '<div class="pg-result-div" id="pg-result-preview"></div>';
        html += '<textarea id="pg-result-raw" style="position:absolute;left:-9999px;"></textarea>';
        html += '<button class="pg-btn pg-btn-next" id="pg-copy-btn" style="background:' + COLORS.success + ';height:34px;font-size:11px;">' + ICONS.copy + ' 复制提示词</button>';
        html += '</div>';

        container.innerHTML = html;
    };

    // ============ 基本信息步骤 ============
    PromptGenApp.prototype.renderBasicStep = function() {
        var h = '';
        h += '<div class="pg-input-group"><label class="pg-label">App中文名称</label>';
        h += '<input class="pg-input" type="text" id="appName" placeholder="例如：心情日记"></div>';
        h += '<div class="pg-input-group"><label class="pg-label">App英文ID（唯一）</label>';
        h += '<input class="pg-input" type="text" id="appId" placeholder="例如：mood-diary"></div>';
        h += '<div class="pg-input-group"><label class="pg-label">功能描述（可选）</label>';
        h += '<textarea class="pg-textarea" id="appDesc" placeholder="例如：记录每天的心情变化，支持文字和图片"></textarea></div>';
        return h;
    };

    // ============ 页面规划步骤 ============
    PromptGenApp.prototype.renderPagesStep = function() {
        var h = '';
        h += '<div class="pg-struct-row" id="pg-struct-row">';
        h += '<div class="pg-struct-btn selected" data-value="tab"><div class="pg-struct-btn-title">Tab导航</div><div class="pg-struct-btn-desc">底部标签切换</div></div>';
        h += '<div class="pg-struct-btn" data-value="single"><div class="pg-struct-btn-title">单页面</div><div class="pg-struct-btn-desc">工具类应用</div></div>';
        h += '</div>';
        h += '<div style="font-size:10px;font-weight:600;color:' + COLORS.textSecondary + ';margin-bottom:6px;">页面/标签页列表</div>';
        h += '<div id="pg-pages-list"></div>';
        h += '<div class="pg-page-add" id="pg-page-add">' + ICONS.plus + ' 添加页面</div>';
        return h;
    };

    // ============ 色板步骤 ============
    PromptGenApp.prototype.renderPaletteStep = function() {
        var h = '';
        h += '<div class="pg-options-list" data-step="3" data-field="palette">';
        h += '<div class="pg-option selected" data-value="auto"><div class="pg-option-check">' + ICONS.check + '</div>';
        h += '<div><div style="font-weight:600;font-size:12px;color:' + COLORS.textPrimary + '">跟随风格</div>';
        h += '<div style="font-size:9px;color:' + COLORS.textSecondary + '">自动使用上一步配色</div></div></div>';
        h += '<div class="pg-option" data-value="custom"><div class="pg-option-check">' + ICONS.check + '</div>';
        h += '<div><div style="font-weight:600;font-size:12px;color:' + COLORS.textPrimary + '">自定义配色</div>';
        h += '<div style="font-size:9px;color:' + COLORS.textSecondary + '">手动选择每个颜色</div></div></div>';
        h += '</div>';
        h += '<div id="pg-custom-palette" style="display:none;margin-top:8px;">';
        h += '<div class="pg-color-row"><span class="pg-color-label">背景</span><input type="color" class="pg-color-input" id="pg-c-bg" value="#F2F2F7"><span class="pg-color-hex" id="pg-c-bg-hex">#F2F2F7</span></div>';
        h += '<div class="pg-color-row"><span class="pg-color-label">卡片</span><input type="color" class="pg-color-input" id="pg-c-card" value="#FFFFFF"><span class="pg-color-hex" id="pg-c-card-hex">#FFFFFF</span></div>';
        h += '<div class="pg-color-row"><span class="pg-color-label">主色</span><input type="color" class="pg-color-input" id="pg-c-prim" value="#007AFF"><span class="pg-color-hex" id="pg-c-prim-hex">#007AFF</span></div>';
        h += '<div class="pg-color-row"><span class="pg-color-label">强调</span><input type="color" class="pg-color-input" id="pg-c-accent" value="#FF9500"><span class="pg-color-hex" id="pg-c-accent-hex">#FF9500</span></div>';
        h += '<div class="pg-prev-wrap" id="pg-palette-preview" style="margin-top:6px;"><span class="pg-prev-label">预览</span><div style="width:100%;padding-top:14px;" id="pg-palette-prev-inner"></div></div>';
        h += '</div>';
        return h;
    };

    // ============ 圆角步骤 ============
    PromptGenApp.prototype.renderCornerStep = function() {
        var corners = [
            { value: 'small', label: '微圆', radius: '6px', desc: '角很小' },
            { value: 'medium', label: '标准', radius: '12px', desc: '正常圆角' },
            { value: 'large', label: '大圆', radius: '20px', desc: '角很圆' },
            { value: 'pill', label: '胶囊', radius: '50px', desc: '完全圆润' }
        ];
        var h = '';
        // 顶部预览
        h += '<div class="pg-top-preview" style="flex-direction:column;align-items:stretch;padding:10px;" id="pg-corner-preview"><span class="pg-prev-label">预览</span><div style="padding-top:8px;" id="pg-corner-prev-inner"></div></div>';
        h += '<div class="pg-hint" style="margin-bottom:8px;">圆角决定卡片、按钮四个角的弧度大小</div>';
        h += '<div class="pg-corner-grid" data-field="corner">';
        corners.forEach(function(c) {
            h += '<div class="pg-corner-item' + (c.value === 'medium' ? ' selected' : '') + '" data-value="' + c.value + '">';
            h += '<div class="pg-corner-demo" style="border-radius:' + c.radius + ';"></div>';
            h += '<div class="pg-corner-name">' + c.label + '</div><div class="pg-corner-val">' + c.desc + '</div></div>';
        });
        h += '</div>';
        return h;
    };

    // ============ 按钮设计系统步骤（新增） ============
    PromptGenApp.prototype.renderButtonDesignStep = function() {
        var h = '';
        // 顶部预览
        h += '<div class="pg-top-preview" style="min-height:70px;display:flex;flex-direction:column;align-items:center;">';
        h += '<span class="pg-prev-label">按钮实时预览</span>';
        h += '<div class="pg-btn-preview-area" id="pg-btn-preview" style="padding-top:16px;"></div>';
        h += '</div>';
        h += '<div class="pg-hint" style="margin-bottom:8px;">按钮是用户点击操作的地方，比如"确定"、"提交"</div>';
        // 按钮形态
        var c1 = '';
        c1 += '<div class="pg-header-grid" data-field="btnShape">';
        c1 += '<div class="pg-header-item selected" data-value="rounded"><div class="pg-header-item-title">圆角矩形</div><div class="pg-header-item-desc">四角有点圆，最常见</div></div>';
        c1 += '<div class="pg-header-item" data-value="pill"><div class="pg-header-item-title">胶囊按钮</div><div class="pg-header-item-desc">像药丸一样两头圆</div></div>';
        c1 += '<div class="pg-header-item" data-value="squircle"><div class="pg-header-item-title">超椭圆</div><div class="pg-header-item-desc">苹果风格的圆角</div></div>';
        c1 += '<div class="pg-header-item" data-value="ghost"><div class="pg-header-item-title">幽灵按钮</div><div class="pg-header-item-desc">透明背景只有文字</div></div>';
        c1 += '<div class="pg-header-item" data-value="outlined"><div class="pg-header-item-title">描边按钮</div><div class="pg-header-item-desc">只有边框没有填充</div></div>';
        c1 += '<div class="pg-header-item" data-value="fab"><div class="pg-header-item-title">悬浮按钮</div><div class="pg-header-item-desc">圆形浮在页面上</div></div>';
        c1 += '</div>';
        h += this.collapseWrap('按钮形状', c1, true);
        // 尺寸
        var c2 = '';
        c2 += '<div class="pg-grid-3" data-field="btnSize">';
        c2 += '<div class="pg-header-item" data-value="small"><div class="pg-header-item-title">小号</div><div class="pg-header-item-desc">比较小巧</div></div>';
        c2 += '<div class="pg-header-item selected" data-value="medium"><div class="pg-header-item-title">中号</div><div class="pg-header-item-desc">正常大小</div></div>';
        c2 += '<div class="pg-header-item" data-value="large"><div class="pg-header-item-title">大号</div><div class="pg-header-item-desc">比较大，容易点</div></div>';
        c2 += '</div>';
        h += this.collapseWrap('按钮大小', c2, false);
        // 反馈
        var c3 = '';
        c3 += '<div class="pg-hint" style="margin-bottom:6px;">点击按钮时的动画反馈效果</div>';
        c3 += '<div class="pg-header-grid" data-field="btnFeedback">';
        c3 += '<div class="pg-header-item selected" data-value="scale"><div class="pg-header-item-title">缩放回弹</div><div class="pg-header-item-desc">按下去变小再弹回</div></div>';
        c3 += '<div class="pg-header-item" data-value="ripple"><div class="pg-header-item-title">涟漪扩散</div><div class="pg-header-item-desc">像水波一样扩散</div></div>';
        c3 += '<div class="pg-header-item" data-value="glow"><div class="pg-header-item-title">光晕脉冲</div><div class="pg-header-item-desc">发光闪一下</div></div>';
        c3 += '<div class="pg-header-item" data-value="bounce"><div class="pg-header-item-title">果冻弹跳</div><div class="pg-header-item-desc">Q弹跳动效果</div></div>';
        c3 += '<div class="pg-header-item" data-value="none"><div class="pg-header-item-title">无反馈</div><div class="pg-header-item-desc">点击没有动画</div></div>';
        c3 += '<div class="pg-header-item" data-value="highlight"><div class="pg-header-item-title">高亮变色</div><div class="pg-header-item-desc">按下去颜色变深</div></div>';
        c3 += '</div>';
        h += this.collapseWrap('点击反馈', c3, false);
        // 图标位置 + 开关
        var c4 = '';
        c4 += '<div class="pg-hint" style="margin-bottom:6px;">按钮里图标的位置</div>';
        c4 += '<div class="pg-layout-grid" data-field="btnIconPos">';
        c4 += '<div class="pg-layout-item selected" data-value="left"><div style="display:flex;align-items:center;gap:3px;justify-content:center;"><div style="width:8px;height:8px;border-radius:2px;background:rgba(0,0,0,0.15);"></div><div style="width:20px;height:4px;background:rgba(0,0,0,0.1);border-radius:2px;"></div></div><div class="pg-layout-name">左图标</div></div>';
        c4 += '<div class="pg-layout-item" data-value="right"><div style="display:flex;align-items:center;gap:3px;justify-content:center;"><div style="width:20px;height:4px;background:rgba(0,0,0,0.1);border-radius:2px;"></div><div style="width:8px;height:8px;border-radius:2px;background:rgba(0,0,0,0.15);"></div></div><div class="pg-layout-name">右图标</div></div>';
        c4 += '<div class="pg-layout-item" data-value="only"><div style="display:flex;align-items:center;justify-content:center;"><div style="width:12px;height:12px;border-radius:3px;background:rgba(0,0,0,0.15);"></div></div><div class="pg-layout-name">纯图标</div></div>';
        c4 += '<div class="pg-layout-item" data-value="none"><div style="display:flex;align-items:center;justify-content:center;"><div style="width:28px;height:4px;background:rgba(0,0,0,0.1);border-radius:2px;"></div></div><div class="pg-layout-name">无图标</div></div>';
        c4 += '</div>';
        c4 += '<div class="pg-toggle-row" style="margin-top:6px;"><div><div style="font-size:11px;font-weight:600;color:' + COLORS.textPrimary + ';">按钮阴影</div>';
        c4 += '<div style="font-size:8px;color:' + COLORS.textSecondary + ';">按钮下面有一点阴影，看起来更立体</div></div>';
        c4 += '<div class="pg-toggle on" id="pg-btn-shadow-toggle"><div class="pg-toggle-knob"></div></div></div>';
        c4 += '<div class="pg-toggle-row"><div><div style="font-size:11px;font-weight:600;color:' + COLORS.textPrimary + ';">渐变填充</div>';
        c4 += '<div style="font-size:8px;color:' + COLORS.textSecondary + ';">按钮背景是渐变色而不是纯色</div></div>';
        c4 += '<div class="pg-toggle" id="pg-btn-gradient-toggle"><div class="pg-toggle-knob"></div></div></div>';
        h += this.collapseWrap('图标与效果', c4, false);
        return h;
    };

    // ============ 弹窗步骤 ============
    PromptGenApp.prototype.renderModalStep = function() {
        var h = '';
        // 顶部预览
        h += '<div class="pg-modal-prev" id="pg-modal-preview" style="margin-bottom:10px;"></div>';
        // 弹窗位置
        var c1 = '';
        c1 += '<div class="pg-modal-row" data-field="modalStyle">';
        c1 += '<div class="pg-option selected" data-value="center" style="flex:1;padding:7px;margin:0;justify-content:center;"><div style="font-size:11px;font-weight:600;">居中</div></div>';
        c1 += '<div class="pg-option" data-value="bottom" style="flex:1;padding:7px;margin:0;justify-content:center;"><div style="font-size:11px;font-weight:600;">底部</div></div>';
        c1 += '<div class="pg-option" data-value="fullscreen" style="flex:1;padding:7px;margin:0;justify-content:center;"><div style="font-size:11px;font-weight:600;">全屏</div></div></div>';
        h += this.collapseWrap('弹窗位置', c1, true);
        // 关闭方式
        var c2 = '';
        c2 += '<div class="pg-modal-row" data-field="modalClose">';
        c2 += '<div class="pg-option selected" data-value="overlay" style="flex:1;padding:7px;margin:0;justify-content:center;"><div style="font-size:11px;font-weight:600;">点遮罩</div></div>';
        c2 += '<div class="pg-option" data-value="button" style="flex:1;padding:7px;margin:0;justify-content:center;"><div style="font-size:11px;font-weight:600;">X按钮</div></div>';
        c2 += '<div class="pg-option" data-value="both" style="flex:1;padding:7px;margin:0;justify-content:center;"><div style="font-size:11px;font-weight:600;">都有</div></div></div>';
        h += this.collapseWrap('关闭方式', c2, false);
        // 圆角
        var c3 = '';
        c3 += '<div class="pg-modal-row" data-field="modalRadius">';
        c3 += '<div class="pg-option" data-value="small" style="flex:1;padding:7px;margin:0;justify-content:center;"><div style="font-size:11px;font-weight:600;">小 8px</div></div>';
        c3 += '<div class="pg-option" data-value="medium" style="flex:1;padding:7px;margin:0;justify-content:center;"><div style="font-size:11px;font-weight:600;">中 16px</div></div>';
        c3 += '<div class="pg-option selected" data-value="large" style="flex:1;padding:7px;margin:0;justify-content:center;"><div style="font-size:11px;font-weight:600;">大 24px</div></div></div>';
        h += this.collapseWrap('弹窗圆角', c3, false);
        return h;
    };

    // ============ 列表步骤 ============
    PromptGenApp.prototype.renderListStep = function() {
        var layouts = [{ value:'card',label:'卡片式' },{ value:'list',label:'列表式' },{ value:'waterfall',label:'瀑布流' },{ value:'grid',label:'宫格式' }];
        var h = '';
        // 顶部预览
        h += '<div class="pg-top-preview" style="min-height:60px;" id="pg-list-preview"></div>';
        h += '<div class="pg-list-grid" data-field="listLayout">';
        layouts.forEach(function(l) {
            h += '<div class="pg-list-item' + (l.value === 'card' ? ' selected' : '') + '" data-value="' + l.value + '">';
            h += '<div class="pg-list-demo" id="pg-list-demo-' + l.value + '"></div>';
            h += '<div class="pg-list-name">' + l.label + '</div></div>';
        });
        h += '</div>';
        return h;
    };

    // ============ 字体排版系统步骤 ============
    PromptGenApp.prototype.renderTypographyDesignStep = function() {
        var h = '';
        // 顶部预览
        h += '<div class="pg-top-preview" id="pg-typo-preview"><span class="pg-prev-label">排版预览</span><div style="padding-top:14px;" id="pg-typo-prev-inner"></div></div>';
        h += '<div class="pg-hint" style="margin-bottom:8px;">字体排版决定App里文字的样式和大小</div>';
        // 字体风格
        var c1 = '';
        c1 += '<div class="pg-header-grid" data-field="typoFamily">';
        c1 += '<div class="pg-header-item selected" data-value="system"><div class="pg-header-item-title">系统默认</div><div class="pg-header-item-desc">手机自带的字体</div></div>';
        c1 += '<div class="pg-header-item" data-value="rounded"><div class="pg-header-item-title">圆体</div><div class="pg-header-item-desc">笔画末端是圆的</div></div>';
        c1 += '<div class="pg-header-item" data-value="serif"><div class="pg-header-item-title">衬线体</div><div class="pg-header-item-desc">笔画有装饰，像宋体</div></div>';
        c1 += '<div class="pg-header-item" data-value="mono"><div class="pg-header-item-title">等宽体</div><div class="pg-header-item-desc">每个字一样宽，像代码</div></div>';
        c1 += '<div class="pg-header-item" data-value="handwritten"><div class="pg-header-item-title">手写体</div><div class="pg-header-item-desc">像手写的字体</div></div>';
        c1 += '<div class="pg-header-item" data-value="geometric"><div class="pg-header-item-title">几何体</div><div class="pg-header-item-desc">现代感的几何字体</div></div>';
        c1 += '</div>';
        h += this.collapseWrap('字体风格', c1, true);
        // 字号比例
        var c2 = '';
        c2 += '<div class="pg-hint" style="margin-bottom:6px;">整体文字大小的偏好</div>';
        c2 += '<div class="pg-grid-3" data-field="typoScale">';
        c2 += '<div class="pg-header-item" data-value="compact"><div class="pg-header-item-title">紧凑</div><div class="pg-header-item-desc">字比较小</div></div>';
        c2 += '<div class="pg-header-item selected" data-value="standard"><div class="pg-header-item-title">标准</div><div class="pg-header-item-desc">正常大小</div></div>';
        c2 += '<div class="pg-header-item" data-value="relaxed"><div class="pg-header-item-title">宽松</div><div class="pg-header-item-desc">字比较大</div></div>';
        c2 += '</div>';
        h += this.collapseWrap('字号大小', c2, false);
        // 字重
        var c3 = '';
        c3 += '<div class="pg-hint" style="margin-bottom:6px;">文字的粗细程度</div>';
        c3 += '<div class="pg-grid-3" data-field="typoWeight">';
        c3 += '<div class="pg-header-item" data-value="light"><div class="pg-header-item-title">轻盈</div><div class="pg-header-item-desc">比较细的字</div></div>';
        c3 += '<div class="pg-header-item selected" data-value="medium"><div class="pg-header-item-title">适中</div><div class="pg-header-item-desc">正常粗细</div></div>';
        c3 += '<div class="pg-header-item" data-value="bold"><div class="pg-header-item-title">厚重</div><div class="pg-header-item-desc">比较粗的字</div></div>';
        c3 += '</div>';
        h += this.collapseWrap('字体粗细', c3, false);
        // 行高
        var c4 = '';
        c4 += '<div class="pg-hint" style="margin-bottom:6px;">每行文字之间的间距</div>';
        c4 += '<div class="pg-grid-3" data-field="typoLineHeight">';
        c4 += '<div class="pg-header-item" data-value="tight"><div class="pg-header-item-title">紧密</div><div class="pg-header-item-desc">行与行挨得近</div></div>';
        c4 += '<div class="pg-header-item selected" data-value="normal"><div class="pg-header-item-title">正常</div><div class="pg-header-item-desc">标准间距</div></div>';
        c4 += '<div class="pg-header-item" data-value="loose"><div class="pg-header-item-title">宽松</div><div class="pg-header-item-desc">行与行隔得远</div></div>';
        c4 += '</div>';
        h += this.collapseWrap('行间距', c4, false);
        return h;
    };

    // ============ 卡片设计系统步骤 ============
    PromptGenApp.prototype.renderCardDesignStep = function() {
        var h = '';
        // 顶部预览
        h += '<div class="pg-top-preview" id="pg-card-design-preview"><span class="pg-prev-label">卡片预览</span><div style="padding-top:14px;" id="pg-card-design-prev-inner"></div></div>';
        h += '<div class="pg-hint" style="margin-bottom:8px;">卡片是承载内容的容器，比如一条动态、一个商品</div>';
        // 阴影
        var c1 = '';
        c1 += '<div class="pg-header-grid" data-field="cardShadow">';
        c1 += '<div class="pg-header-item" data-value="none"><div class="pg-header-item-title">无阴影</div><div class="pg-header-item-desc">完全扁平</div></div>';
        c1 += '<div class="pg-header-item" data-value="light"><div class="pg-header-item-title">轻阴影</div><div class="pg-header-item-desc">淡淡的阴影</div></div>';
        c1 += '<div class="pg-header-item selected" data-value="medium"><div class="pg-header-item-title">标准阴影</div><div class="pg-header-item-desc">正常的阴影</div></div>';
        c1 += '<div class="pg-header-item" data-value="deep"><div class="pg-header-item-title">深阴影</div><div class="pg-header-item-desc">很明显的阴影</div></div>';
        c1 += '</div>';
        h += this.collapseWrap('卡片阴影', c1, true);
        // 边框
        var c2 = '';
        c2 += '<div class="pg-header-grid" data-field="cardBorder">';
        c2 += '<div class="pg-header-item selected" data-value="none"><div class="pg-header-item-title">无边框</div><div class="pg-header-item-desc">没有边框线</div></div>';
        c2 += '<div class="pg-header-item" data-value="hairline"><div class="pg-header-item-title">细线边框</div><div class="pg-header-item-desc">很细的边框线</div></div>';
        c2 += '<div class="pg-header-item" data-value="gradient"><div class="pg-header-item-title">渐变边框</div><div class="pg-header-item-desc">边框是渐变色</div></div>';
        c2 += '<div class="pg-header-item" data-value="dashed"><div class="pg-header-item-title">虚线边框</div><div class="pg-header-item-desc">边框是虚线</div></div>';
        c2 += '</div>';
        h += this.collapseWrap('卡片边框', c2, false);
        // 间距
        var c3 = '';
        c3 += '<div class="pg-hint" style="margin-bottom:6px;">卡片内容和边缘的距离</div>';
        c3 += '<div class="pg-grid-3" data-field="cardPadding">';
        c3 += '<div class="pg-header-item" data-value="compact"><div class="pg-header-item-title">紧凑</div><div class="pg-header-item-desc">内容贴边</div></div>';
        c3 += '<div class="pg-header-item selected" data-value="standard"><div class="pg-header-item-title">标准</div><div class="pg-header-item-desc">正常间距</div></div>';
        c3 += '<div class="pg-header-item" data-value="spacious"><div class="pg-header-item-title">宽敞</div><div class="pg-header-item-desc">留白多</div></div>';
        c3 += '</div>';
        h += this.collapseWrap('卡片内间距', c3, false);
        // 背景
        var c4 = '';
        c4 += '<div class="pg-header-grid" data-field="cardBackground">';
        c4 += '<div class="pg-header-item selected" data-value="solid"><div class="pg-header-item-title">纯色</div><div class="pg-header-item-desc">单一颜色背景</div></div>';
        c4 += '<div class="pg-header-item" data-value="gradient"><div class="pg-header-item-title">渐变</div><div class="pg-header-item-desc">渐变色背景</div></div>';
        c4 += '<div class="pg-header-item" data-value="glass"><div class="pg-header-item-title">毛玻璃</div><div class="pg-header-item-desc">半透明模糊效果</div></div>';
        c4 += '<div class="pg-header-item" data-value="image"><div class="pg-header-item-title">背景图</div><div class="pg-header-item-desc">放一张图片做背景</div></div>';
        c4 += '</div>';
        h += this.collapseWrap('卡片背景', c4, false);
        return h;
    };

    // ============ Tab栏设计步骤（屏幕底部的切换按钮栏） ============
    PromptGenApp.prototype.renderTabbarDesignStep = function() {
        var h = '';
        // 顶部预览
        h += '<div class="pg-top-preview" id="pg-tabbar-preview"><span class="pg-prev-label">Tab栏预览</span><div style="padding-top:14px;" id="pg-tabbar-prev-inner"></div></div>';
        // 提示说明
        h += '<div class="pg-hint" style="margin-bottom:8px;">Tab栏就是屏幕最底部的"首页、发现、我的"那一排按钮</div>';
        // 图标风格
        var c1 = '';
        c1 += '<div class="pg-grid-3" data-field="tabIconStyle">';
        c1 += '<div class="pg-header-item selected" data-value="outlined"><div class="pg-header-item-title">线性</div><div class="pg-header-item-desc">只有轮廓线条</div></div>';
        c1 += '<div class="pg-header-item" data-value="filled"><div class="pg-header-item-title">填充</div><div class="pg-header-item-desc">实心填满颜色</div></div>';
        c1 += '<div class="pg-header-item" data-value="duotone"><div class="pg-header-item-title">双色</div><div class="pg-header-item-desc">两种颜色搭配</div></div>';
        c1 += '</div>';
        h += this.collapseWrap('图标风格', c1, true);
        // 材质
        var c2 = '';
        c2 += '<div class="pg-grid-3" data-field="tabMaterial">';
        c2 += '<div class="pg-header-item selected" data-value="blur"><div class="pg-header-item-title">毛玻璃</div><div class="pg-header-item-desc">半透明模糊效果</div></div>';
        c2 += '<div class="pg-header-item" data-value="solid"><div class="pg-header-item-title">纯色</div><div class="pg-header-item-desc">不透明的纯色背景</div></div>';
        c2 += '<div class="pg-header-item" data-value="transparent"><div class="pg-header-item-title">透明</div><div class="pg-header-item-desc">完全透明无背景</div></div>';
        c2 += '</div>';
        h += this.collapseWrap('背景材质', c2, false);
        // 动画
        var c3 = '';
        c3 += '<div class="pg-header-grid" data-field="tabAnimation">';
        c3 += '<div class="pg-header-item selected" data-value="scale"><div class="pg-header-item-title">缩放</div><div class="pg-header-item-desc">点击时图标变大</div></div>';
        c3 += '<div class="pg-header-item" data-value="slide"><div class="pg-header-item-title">滑动指示</div><div class="pg-header-item-desc">底部有滑动的小横条</div></div>';
        c3 += '<div class="pg-header-item" data-value="fade"><div class="pg-header-item-title">渐变</div><div class="pg-header-item-desc">颜色渐变切换</div></div>';
        c3 += '<div class="pg-header-item" data-value="bounce"><div class="pg-header-item-title">弹跳</div><div class="pg-header-item-desc">点击时Q弹跳动</div></div>';
        c3 += '</div>';
        h += this.collapseWrap('点击动画', c3, false);
        // 徽标 + 中心按钮
        var c4 = '';
        c4 += '<div class="pg-hint" style="margin-bottom:6px;">徽标就是图标右上角的小红点或数字提示</div>';
        c4 += '<div class="pg-grid-3" data-field="tabBadge">';
        c4 += '<div class="pg-header-item selected" data-value="dot"><div class="pg-header-item-title">小红点</div><div class="pg-header-item-desc">只显示一个红点</div></div>';
        c4 += '<div class="pg-header-item" data-value="number"><div class="pg-header-item-title">数字</div><div class="pg-header-item-desc">显示具体数字如"99+"</div></div>';
        c4 += '<div class="pg-header-item" data-value="none"><div class="pg-header-item-title">无徽标</div><div class="pg-header-item-desc">不显示任何提示</div></div>';
        c4 += '</div>';
        c4 += '<div class="pg-toggle-row" style="margin-top:6px;"><div><div style="font-size:11px;font-weight:600;color:' + COLORS.textPrimary + ';">中心凸起按钮</div>';
        c4 += '<div style="font-size:8px;color:' + COLORS.textSecondary + ';">Tab栏中间放一个突出的大按钮，比如"发布"</div></div>';
        c4 += '<div class="pg-toggle" id="pg-tab-center-toggle"><div class="pg-toggle-knob"></div></div></div>';
        h += this.collapseWrap('徽标与中心按钮', c4, false);
        return h;
    };

    // ============ 图标风格步骤 ============
    PromptGenApp.prototype.renderIconStyleDesignStep = function() {
        var h = '';
        // 顶部预览
        h += '<div class="pg-top-preview" id="pg-icon-style-preview"><span class="pg-prev-label">图标预览</span><div style="padding-top:14px;" id="pg-icon-style-prev-inner"></div></div>';
        h += '<div class="pg-hint" style="margin-bottom:8px;">图标就是App里的小图案，比如首页的房子、设置的齿轮</div>';
        // 风格
        var c1 = '';
        c1 += '<div class="pg-header-grid" data-field="iconStyle">';
        c1 += '<div class="pg-header-item selected" data-value="outlined"><div class="pg-header-item-title">线性</div><div class="pg-header-item-desc">只有轮廓线条</div></div>';
        c1 += '<div class="pg-header-item" data-value="filled"><div class="pg-header-item-title">填充</div><div class="pg-header-item-desc">实心填满颜色</div></div>';
        c1 += '<div class="pg-header-item" data-value="duotone"><div class="pg-header-item-title">双色调</div><div class="pg-header-item-desc">两种颜色搭配</div></div>';
        c1 += '<div class="pg-header-item" data-value="rounded"><div class="pg-header-item-title">圆润</div><div class="pg-header-item-desc">线条末端是圆的</div></div>';
        c1 += '<div class="pg-header-item" data-value="sharp"><div class="pg-header-item-title">锐利</div><div class="pg-header-item-desc">线条末端是尖的</div></div>';
        c1 += '<div class="pg-header-item" data-value="broken"><div class="pg-header-item-title">断线</div><div class="pg-header-item-desc">线条有断开的地方</div></div>';
        c1 += '</div>';
        h += this.collapseWrap('图标线条风格', c1, true);
        // 粗细
        var c2 = '';
        c2 += '<div class="pg-grid-3" data-field="iconWeight">';
        c2 += '<div class="pg-header-item" data-value="thin"><div class="pg-header-item-title">纤细</div><div class="pg-header-item-desc">很细的线条</div></div>';
        c2 += '<div class="pg-header-item selected" data-value="regular"><div class="pg-header-item-title">常规</div><div class="pg-header-item-desc">正常粗细</div></div>';
        c2 += '<div class="pg-header-item" data-value="bold"><div class="pg-header-item-title">粗壮</div><div class="pg-header-item-desc">比较粗的线条</div></div>';
        c2 += '</div>';
        h += this.collapseWrap('图标线条粗细', c2, false);
        return h;
    };

    // ============ 信息密度与主题步骤 ============
    PromptGenApp.prototype.renderDensityThemeDesignStep = function() {
        var h = '';
        // 顶部预览
        h += '<div class="pg-top-preview" id="pg-density-preview"><span class="pg-prev-label">效果预览</span><div style="padding-top:14px;" id="pg-density-prev-inner"></div></div>';
        // 密度
        var c1 = '';
        c1 += '<div class="pg-hint" style="margin-bottom:6px;">信息密度决定页面上内容的紧凑程度</div>';
        c1 += '<div class="pg-grid-3" data-field="density">';
        c1 += '<div class="pg-header-item" data-value="compact"><div class="pg-header-item-title">紧凑</div><div class="pg-header-item-desc">内容挤在一起，显示更多</div></div>';
        c1 += '<div class="pg-header-item selected" data-value="standard"><div class="pg-header-item-title">标准</div><div class="pg-header-item-desc">正常间距，像iPhone默认</div></div>';
        c1 += '<div class="pg-header-item" data-value="comfortable"><div class="pg-header-item-title">舒适</div><div class="pg-header-item-desc">间距大，看着更舒服</div></div>';
        c1 += '</div>';
        h += this.collapseWrap('信息密度', c1, true);
        // 暗色
        var c2 = '';
        c2 += '<div class="pg-hint" style="margin-bottom:6px;">暗色模式就是黑底白字的夜间模式</div>';
        c2 += '<div class="pg-grid-3" data-field="darkMode">';
        c2 += '<div class="pg-header-item selected" data-value="none"><div class="pg-header-item-title">不支持</div><div class="pg-header-item-desc">只有亮色模式</div></div>';
        c2 += '<div class="pg-header-item" data-value="support"><div class="pg-header-item-title">支持切换</div><div class="pg-header-item-desc">可以切换明暗</div></div>';
        c2 += '<div class="pg-header-item" data-value="default"><div class="pg-header-item-title">默认暗色</div><div class="pg-header-item-desc">打开就是暗色</div></div>';
        c2 += '</div>';
        h += this.collapseWrap('暗色模式', c2, false);
        // 空状态
        var c3 = '';
        c3 += '<div class="pg-hint" style="margin-bottom:6px;">空状态是没有内容时显示的提示，比如"暂无数据"</div>';
        c3 += '<div class="pg-grid-3" data-field="emptyState">';
        c3 += '<div class="pg-header-item selected" data-value="minimal"><div class="pg-header-item-title">极简文字</div><div class="pg-header-item-desc">只显示文字提示</div></div>';
        c3 += '<div class="pg-header-item" data-value="illustration"><div class="pg-header-item-title">插画</div><div class="pg-header-item-desc">配一张可爱的图</div></div>';
        c3 += '<div class="pg-header-item" data-value="icon"><div class="pg-header-item-title">大图标</div><div class="pg-header-item-desc">一个大图标+文字</div></div>';
        c3 += '</div>';
        h += this.collapseWrap('空状态提示', c3, false);
        // 输入框
        var c4 = '';
        c4 += '<div class="pg-hint" style="margin-bottom:6px;">输入框就是让用户打字的地方</div>';
        c4 += '<div class="pg-grid-3" data-field="inputStyle">';
        c4 += '<div class="pg-header-item selected" data-value="border"><div class="pg-header-item-title">边框</div><div class="pg-header-item-desc">四周有边框线</div></div>';
        c4 += '<div class="pg-header-item" data-value="underline"><div class="pg-header-item-title">下划线</div><div class="pg-header-item-desc">只有底部一条线</div></div>';
        c4 += '<div class="pg-header-item" data-value="filled"><div class="pg-header-item-title">填充底色</div><div class="pg-header-item-desc">有灰色背景填充</div></div>';
        c4 += '</div>';
        h += this.collapseWrap('输入框风格', c4, false);
        return h;
    };

    // ============ 页面顶栏设计步骤（屏幕顶部标题区域） ============
    PromptGenApp.prototype.renderNavbarDesignStep = function() {
        var h = '';
        // 顶部预览
        h += '<div class="pg-top-preview" style="flex-direction:column;align-items:stretch;min-height:60px;">';
        h += '<span class="pg-prev-label">页面顶栏预览</span>';
        h += '<div id="pg-nav-preview" style="padding-top:14px;"></div>';
        h += '</div>';
        // 顶栏形态
        var c1 = '';
        c1 += '<div class="pg-hint" style="margin-bottom:6px;">页面顶栏就是屏幕最上方显示"首页"、"设置"等标题的区域</div>';
        c1 += '<div class="pg-header-grid" data-field="navStyle">';
        c1 += '<div class="pg-header-item selected" data-value="large-title"><div class="pg-header-item-title">大标题</div><div class="pg-header-item-desc">标题字很大，像微信"聊天"</div></div>';
        c1 += '<div class="pg-header-item" data-value="center-title"><div class="pg-header-item-title">居中标题</div><div class="pg-header-item-desc">标题在正中间</div></div>';
        c1 += '<div class="pg-header-item" data-value="transparent"><div class="pg-header-item-title">透明沉浸</div><div class="pg-header-item-desc">顶栏透明，内容延伸到顶部</div></div>';
        c1 += '<div class="pg-header-item" data-value="gradient"><div class="pg-header-item-title">渐变顶栏</div><div class="pg-header-item-desc">顶栏有渐变色背景</div></div>';
        c1 += '<div class="pg-header-item" data-value="segmented"><div class="pg-header-item-title">分段控制</div><div class="pg-header-item-desc">顶栏内有切换按钮</div></div>';
        c1 += '<div class="pg-header-item" data-value="floating"><div class="pg-header-item-title">悬浮胶囊</div><div class="pg-header-item-desc">顶栏像悬浮的小药丸</div></div>';
        c1 += '</div>';
        h += this.collapseWrap('顶栏样式', c1, true);
        // 材质 + 特效 + 开关
        var c2 = '';
        c2 += '<div style="font-size:10px;font-weight:600;color:' + COLORS.textSecondary + ';margin-bottom:5px;">顶栏背景材质</div>';
        c2 += '<div class="pg-layout-grid" data-field="navMaterial">';
        c2 += '<div class="pg-layout-item selected" data-value="blur"><div style="height:18px;background:rgba(255,255,255,0.3);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);border-radius:4px;border:1px solid rgba(255,255,255,0.4);"></div><div class="pg-layout-name">毛玻璃</div></div>';
        c2 += '<div class="pg-layout-item" data-value="solid"><div style="height:18px;background:white;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.08);"></div><div class="pg-layout-name">纯色实底</div></div>';
        c2 += '<div class="pg-layout-item" data-value="transparent"><div style="height:18px;background:transparent;border-radius:4px;border:1px dashed rgba(0,0,0,0.1);"></div><div class="pg-layout-name">全透明</div></div>';
        c2 += '<div class="pg-layout-item" data-value="gradient"><div style="height:18px;background:linear-gradient(135deg,' + COLORS.primary + ',' + COLORS.secondary + ');border-radius:4px;"></div><div class="pg-layout-name">渐变色</div></div>';
        c2 += '</div>';
        c2 += '<div style="font-size:10px;font-weight:600;color:' + COLORS.textSecondary + ';margin:8px 0 5px;">滚动交互特效</div>';
        c2 += '<div class="pg-header-grid" data-field="navEffect">';
        c2 += '<div class="pg-header-item selected" data-value="none"><div class="pg-header-item-title">无特效</div><div class="pg-header-item-desc">保持不变</div></div>';
        c2 += '<div class="pg-header-item" data-value="parallax"><div class="pg-header-item-title">视差滚动</div><div class="pg-header-item-desc">滚动时有层次感</div></div>';
        c2 += '<div class="pg-header-item" data-value="sticky-shrink"><div class="pg-header-item-title">粘性收缩</div><div class="pg-header-item-desc">滚动时标题变小</div></div>';
        c2 += '<div class="pg-header-item" data-value="color-shift"><div class="pg-header-item-title">色彩渐变</div><div class="pg-header-item-desc">滚动时颜色变化</div></div>';
        c2 += '<div class="pg-header-item" data-value="jelly"><div class="pg-header-item-title">果冻回弹</div><div class="pg-header-item-desc">下拉时Q弹效果</div></div>';
        c2 += '<div class="pg-header-item" data-value="blur-reveal"><div class="pg-header-item-title">模糊渐显</div><div class="pg-header-item-desc">滚动时逐渐变模糊</div></div>';
        c2 += '</div>';
        c2 += '<div class="pg-toggle-row" style="margin-top:6px;"><div><div style="font-size:11px;font-weight:600;color:' + COLORS.textPrimary + ';">内嵌搜索栏</div>';
        c2 += '<div style="font-size:8px;color:' + COLORS.textSecondary + ';">顶栏下方显示搜索框</div></div>';
        c2 += '<div class="pg-toggle" id="pg-nav-search-toggle"><div class="pg-toggle-knob"></div></div></div>';
        c2 += '<div class="pg-toggle-row"><div><div style="font-size:11px;font-weight:600;color:' + COLORS.textPrimary + ';">底部分割线</div>';
        c2 += '<div style="font-size:8px;color:' + COLORS.textSecondary + ';">顶栏底部有一条细线</div></div>';
        c2 += '<div class="pg-toggle on" id="pg-nav-divider-toggle"><div class="pg-toggle-knob"></div></div></div>';
        h += this.collapseWrap('背景材质与滚动特效', c2, false);
        // 子页面顶栏
        var c3 = '';
        c3 += '<div class="pg-hint" style="margin-bottom:6px;">点进详情页后的顶栏，比如聊天页顶部的"返回、头像、名字"</div>';
        c3 += '<div style="font-size:10px;font-weight:600;color:' + COLORS.textSecondary + ';margin:6px 0 5px;">布局模式</div>';
        c3 += '<div class="pg-grid-3" data-field="detailNavLayout">';
        c3 += '<div class="pg-header-item selected" data-value="inline"><div class="pg-header-item-title">单行紧凑</div><div class="pg-header-item-desc">所有元素在一行</div></div>';
        c3 += '<div class="pg-header-item" data-value="stacked"><div class="pg-header-item-title">双行分层</div><div class="pg-header-item-desc">返回按钮单独一行</div></div>';
        c3 += '<div class="pg-header-item" data-value="minimal"><div class="pg-header-item-title">极简</div><div class="pg-header-item-desc">只有返回和标题</div></div>';
        c3 += '</div>';
        c3 += '<div class="pg-toggle-row" style="margin-top:6px;"><div><div style="font-size:11px;font-weight:600;color:' + COLORS.textPrimary + ';">显示头像</div></div>';
        c3 += '<div class="pg-toggle on" id="pg-detail-avatar-toggle"><div class="pg-toggle-knob"></div></div></div>';
        c3 += '<div class="pg-toggle-row"><div><div style="font-size:11px;font-weight:600;color:' + COLORS.textPrimary + ';">显示副标题</div></div>';
        c3 += '<div class="pg-toggle on" id="pg-detail-subtitle-toggle"><div class="pg-toggle-knob"></div></div></div>';
        c3 += '<div style="font-size:10px;font-weight:600;color:' + COLORS.textSecondary + ';margin:8px 0 5px;">操作按钮位置</div>';
        c3 += '<div class="pg-grid-3" data-field="detailNavActions">';
        c3 += '<div class="pg-header-item selected" data-value="right"><div class="pg-header-item-title">右侧</div><div class="pg-header-item-desc">按钮在右边</div></div>';
        c3 += '<div class="pg-header-item" data-value="both"><div class="pg-header-item-title">两侧</div><div class="pg-header-item-desc">左右都有按钮</div></div>';
        c3 += '<div class="pg-header-item" data-value="none"><div class="pg-header-item-title">无按钮</div><div class="pg-header-item-desc">只显示标题</div></div>';
        c3 += '</div>';
        h += this.collapseWrap('详情页顶栏', c3, false);
        // 分段控制栏
        var c4 = '';
        c4 += '<div class="pg-hint" style="margin-bottom:6px;">页面内的小标签切换，比如"推荐 | 最新 | 热门"</div>';
        c4 += '<div style="font-size:10px;font-weight:600;color:' + COLORS.textSecondary + ';margin:6px 0 5px;">切换栏样式</div>';
        c4 += '<div class="pg-header-grid" data-field="segmentStyle">';
        c4 += '<div class="pg-header-item selected" data-value="pill"><div class="pg-header-item-title">胶囊滑块</div><div class="pg-header-item-desc">选中项有圆角背景</div></div>';
        c4 += '<div class="pg-header-item" data-value="underline"><div class="pg-header-item-title">下划线</div><div class="pg-header-item-desc">选中项有下划线</div></div>';
        c4 += '<div class="pg-header-item" data-value="block"><div class="pg-header-item-title">色块填充</div><div class="pg-header-item-desc">选中项填充颜色</div></div>';
        c4 += '<div class="pg-header-item" data-value="chip"><div class="pg-header-item-title">标签胶囊</div><div class="pg-header-item-desc">像小标签一样</div></div>';
        c4 += '</div>';
        c4 += '<div style="font-size:10px;font-weight:600;color:' + COLORS.textSecondary + ';margin:8px 0 5px;">显示位置</div>';
        c4 += '<div class="pg-grid-3" data-field="segmentPosition">';
        c4 += '<div class="pg-header-item selected" data-value="below-nav"><div class="pg-header-item-title">顶栏下方</div><div class="pg-header-item-desc">单独占一行</div></div>';
        c4 += '<div class="pg-header-item" data-value="inside-nav"><div class="pg-header-item-title">嵌入顶栏</div><div class="pg-header-item-desc">放在标题位置</div></div>';
        c4 += '<div class="pg-header-item" data-value="sticky-top"><div class="pg-header-item-title">吸顶悬浮</div><div class="pg-header-item-desc">滚动时固定在顶部</div></div>';
        c4 += '</div>';
        c4 += '<div style="font-size:10px;font-weight:600;color:' + COLORS.textSecondary + ';margin:8px 0 5px;">切换动画</div>';
        c4 += '<div class="pg-grid-3" data-field="segmentAnimation">';
        c4 += '<div class="pg-header-item" data-value="slide"><div class="pg-header-item-title">滑动</div><div class="pg-header-item-desc">平滑滑过去</div></div>';
        c4 += '<div class="pg-header-item" data-value="fade"><div class="pg-header-item-title">渐变</div><div class="pg-header-item-desc">淡入淡出</div></div>';
        c4 += '<div class="pg-header-item selected" data-value="spring"><div class="pg-header-item-title">弹簧</div><div class="pg-header-item-desc">Q弹回弹效果</div></div>';
        c4 += '</div>';
        h += this.collapseWrap('页内标签切换栏', c4, false);
        return h;
    };

    // ============ 动效设计系统步骤 ============
    PromptGenApp.prototype.renderMotionDesignStep = function() {
        var h = '';
        // 顶部预览
        h += '<div class="pg-top-preview" style="flex-direction:column;align-items:center;min-height:70px;">';
        h += '<span class="pg-prev-label">动效预览（点击方块体验）</span>';
        h += '<div style="display:flex;gap:12px;align-items:center;padding-top:16px;" id="pg-motion-preview"></div>';
        h += '</div>';
        h += '<div class="pg-hint" style="margin-bottom:8px;">动效就是App里各种动画效果，让操作更流畅有趣</div>';
        // 缓动曲线
        var c1 = '';
        c1 += '<div class="pg-hint" style="margin-bottom:6px;">动画的"节奏感"，决定动画是快是慢、是弹还是滑</div>';
        c1 += '<div class="pg-header-grid" data-field="motionCurve">';
        c1 += '<div class="pg-header-item selected" data-value="spring"><div class="pg-header-item-title">弹簧回弹</div><div class="pg-header-item-desc">像弹簧一样Q弹</div></div>';
        c1 += '<div class="pg-header-item" data-value="ease"><div class="pg-header-item-title">平滑缓动</div><div class="pg-header-item-desc">慢-快-慢，很自然</div></div>';
        c1 += '<div class="pg-header-item" data-value="sharp"><div class="pg-header-item-title">干脆利落</div><div class="pg-header-item-desc">快速直接，不拖泥带水</div></div>';
        c1 += '<div class="pg-header-item" data-value="bounce"><div class="pg-header-item-title">弹跳落地</div><div class="pg-header-item-desc">像球落地弹几下</div></div>';
        c1 += '<div class="pg-header-item" data-value="elastic"><div class="pg-header-item-title">弹性拉伸</div><div class="pg-header-item-desc">像橡皮筋拉伸回弹</div></div>';
        c1 += '<div class="pg-header-item" data-value="smooth"><div class="pg-header-item-title">丝滑流畅</div><div class="pg-header-item-desc">非常顺滑的感觉</div></div>';
        c1 += '</div>';
        h += this.collapseWrap('动画节奏', c1, true);
        // 页面过渡
        var c2 = '';
        c2 += '<div class="pg-hint" style="margin-bottom:6px;">从一个页面切换到另一个页面时的动画效果</div>';
        c2 += '<div class="pg-header-grid" data-field="motionTransition">';
        c2 += '<div class="pg-header-item selected" data-value="slide"><div class="pg-header-item-title">滑动推入</div><div class="pg-header-item-desc">新页面从右边滑进来</div></div>';
        c2 += '<div class="pg-header-item" data-value="fade"><div class="pg-header-item-title">淡入淡出</div><div class="pg-header-item-desc">旧页面渐隐，新页面渐显</div></div>';
        c2 += '<div class="pg-header-item" data-value="scale"><div class="pg-header-item-title">缩放弹出</div><div class="pg-header-item-desc">新页面从小变大弹出</div></div>';
        c2 += '<div class="pg-header-item" data-value="flip"><div class="pg-header-item-title">翻转切换</div><div class="pg-header-item-desc">像翻卡片一样翻转</div></div>';
        c2 += '<div class="pg-header-item" data-value="morph"><div class="pg-header-item-title">形变过渡</div><div class="pg-header-item-desc">元素平滑变形到新位置</div></div>';
        c2 += '<div class="pg-header-item" data-value="parallax"><div class="pg-header-item-title">视差层叠</div><div class="pg-header-item-desc">多层以不同速度移动</div></div>';
        c2 += '</div>';
        h += this.collapseWrap('页面切换动画', c2, false);
        // 微交互
        var c3 = '';
        c3 += '<div class="pg-hint" style="margin-bottom:6px;">点击按钮、切换开关时的小动画反馈</div>';
        c3 += '<div class="pg-header-grid" data-field="motionMicro">';
        c3 += '<div class="pg-header-item selected" data-value="jelly"><div class="pg-header-item-title">果冻Q弹</div><div class="pg-header-item-desc">按下去软软的Q弹</div></div>';
        c3 += '<div class="pg-header-item" data-value="pulse"><div class="pg-header-item-title">脉冲呼吸</div><div class="pg-header-item-desc">像呼吸一样一大一小</div></div>';
        c3 += '<div class="pg-header-item" data-value="wiggle"><div class="pg-header-item-title">摇摆晃动</div><div class="pg-header-item-desc">左右摇晃几下</div></div>';
        c3 += '<div class="pg-header-item" data-value="pop"><div class="pg-header-item-title">弹出缩放</div><div class="pg-header-item-desc">快速变大再恢复</div></div>';
        c3 += '<div class="pg-header-item" data-value="none"><div class="pg-header-item-title">无微动效</div><div class="pg-header-item-desc">不要小动画</div></div>';
        c3 += '<div class="pg-header-item" data-value="tilt"><div class="pg-header-item-title">倾斜透视</div><div class="pg-header-item-desc">按下去有点倾斜</div></div>';
        c3 += '</div>';
        h += this.collapseWrap('点击反馈动画', c3, false);
        // 加载 + 滚动 + 触觉
        var c4 = '';
        c4 += '<div class="pg-hint" style="margin-bottom:6px;">内容加载时显示的等待动画</div>';
        c4 += '<div style="font-size:10px;font-weight:600;color:' + COLORS.textSecondary + ';margin-bottom:5px;">加载等待样式</div>';
        c4 += '<div class="pg-header-grid" data-field="motionLoading">';
        c4 += '<div class="pg-header-item selected" data-value="skeleton"><div class="pg-header-item-title">骨架屏</div><div class="pg-header-item-desc">灰色占位块闪烁</div></div>';
        c4 += '<div class="pg-header-item" data-value="spinner"><div class="pg-header-item-title">旋转圈圈</div><div class="pg-header-item-desc">转圈圈的加载图标</div></div>';
        c4 += '<div class="pg-header-item" data-value="shimmer"><div class="pg-header-item-title">微光扫描</div><div class="pg-header-item-desc">一道光从左扫到右</div></div>';
        c4 += '<div class="pg-header-item" data-value="dots"><div class="pg-header-item-title">跳动圆点</div><div class="pg-header-item-desc">三个点轮流跳动</div></div>';
        c4 += '</div>';
        c4 += '<div style="font-size:10px;font-weight:600;color:' + COLORS.textSecondary + ';margin:8px 0 5px;">滚动时的动画</div>';
        c4 += '<div class="pg-layout-grid" data-field="motionScroll">';
        c4 += '<div class="pg-layout-item selected" data-value="parallax"><div style="height:18px;position:relative;overflow:hidden;"><div style="position:absolute;top:0;left:10%;width:30%;height:6px;background:rgba(0,0,0,0.08);border-radius:2px;"></div><div style="position:absolute;top:8px;left:20%;width:40%;height:6px;background:rgba(0,0,0,0.05);border-radius:2px;"></div></div><div class="pg-layout-name">视差滚动</div></div>';
        c4 += '<div class="pg-layout-item" data-value="fade-in"><div style="height:18px;display:flex;flex-direction:column;gap:2px;"><div style="height:6px;background:rgba(0,0,0,0.1);border-radius:2px;opacity:1;"></div><div style="height:6px;background:rgba(0,0,0,0.06);border-radius:2px;opacity:0.5;"></div></div><div class="pg-layout-name">渐显入场</div></div>';
        c4 += '<div class="pg-layout-item" data-value="slide-up"><div style="height:18px;display:flex;flex-direction:column;gap:2px;"><div style="height:6px;background:rgba(0,0,0,0.1);border-radius:2px;"></div><div style="height:6px;background:rgba(0,0,0,0.06);border-radius:2px;transform:translateY(2px);"></div></div><div class="pg-layout-name">上滑入场</div></div>';
        c4 += '<div class="pg-layout-item" data-value="none"><div style="height:18px;display:flex;flex-direction:column;gap:2px;"><div style="height:6px;background:rgba(0,0,0,0.08);border-radius:2px;"></div><div style="height:6px;background:rgba(0,0,0,0.08);border-radius:2px;"></div></div><div class="pg-layout-name">无动效</div></div>';
        c4 += '</div>';
        c4 += '<div class="pg-toggle-row" style="margin-top:6px;"><div><div style="font-size:11px;font-weight:600;color:' + COLORS.textPrimary + ';">触觉反馈</div>';
        c4 += '<div style="font-size:8px;color:' + COLORS.textSecondary + ';">点击按钮时手机会轻微震动</div></div>';
        c4 += '<div class="pg-toggle on" id="pg-motion-haptic-toggle"><div class="pg-toggle-knob"></div></div></div>';
        h += this.collapseWrap('加载与滚动', c4, false);
        return h;
    };

    // ============ 小组件开关步骤（增强异形预览） ============
    PromptGenApp.prototype.renderWidgetToggleStep = function() {
        var h = '';
        h += '<div class="pg-choice-card" id="pg-widget-yes" data-value="yes">';
        h += '<div class="pg-choice-icon" style="background:rgba(0,122,255,0.1);color:' + COLORS.primary + ';">' + ICONS.plus + '</div>';
        h += '<div><div class="pg-choice-title">需要小组件</div>';
        h += '<div class="pg-choice-desc">配置 Small / Medium / Large 桌面小组件，支持异形设计</div></div></div>';
        h += '<div class="pg-choice-card selected" id="pg-widget-no" data-value="no">';
        h += '<div class="pg-choice-icon" style="background:rgba(142,142,147,0.1);color:' + COLORS.textSecondary + ';">' + ICONS.skip + '</div>';
        h += '<div><div class="pg-choice-title">不需要，跳过</div>';
        h += '<div class="pg-choice-desc">跳过小组件配置，直接进入下一步</div></div></div>';
        // 异形预览展示
        h += '<div class="pg-prev-wrap" style="margin-top:6px;flex-direction:column;align-items:center;">';
        h += '<span class="pg-prev-label">小组件形状示意</span>';
        h += '<div style="display:flex;gap:10px;align-items:center;padding-top:16px;flex-wrap:wrap;justify-content:center;">';
        h += '<div style="width:48px;height:48px;background:white;border-radius:14px;box-shadow:0 2px 6px rgba(0,0,0,0.08);display:flex;align-items:center;justify-content:center;flex-direction:column;"><div style="font-size:6px;color:#86868B;">圆角矩形</div></div>';
        h += '<div style="width:48px;height:48px;background:white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.08);display:flex;align-items:center;justify-content:center;flex-direction:column;"><div style="font-size:6px;color:#86868B;">圆形</div></div>';
        h += '<div style="width:48px;height:48px;background:white;border-radius:18px;box-shadow:0 2px 6px rgba(0,0,0,0.08);display:flex;align-items:center;justify-content:center;flex-direction:column;"><div style="font-size:6px;color:#86868B;">超椭圆</div></div>';
        h += '<div style="width:48px;height:48px;background:white;border-radius:30% 70% 70% 30% / 30% 30% 70% 70%;box-shadow:0 2px 6px rgba(0,0,0,0.08);display:flex;align-items:center;justify-content:center;flex-direction:column;"><div style="font-size:6px;color:#86868B;">Blob</div></div>';
        h += '<div style="width:64px;height:36px;background:white;border-radius:18px;box-shadow:0 2px 6px rgba(0,0,0,0.08);display:flex;align-items:center;justify-content:center;flex-direction:column;"><div style="font-size:6px;color:#86868B;">胶囊</div></div>';
        h += '</div></div>';
        return h;
    };

    // ============ 小组件设计步骤 ============
    PromptGenApp.prototype.renderWidgetDesignStep = function() {
        var h = '';
        // 类型选择
        h += '<div class="pg-hint" style="margin-bottom:6px;">小组件是放在手机桌面上的快捷信息卡片</div>';
        h += '<div style="font-size:10px;font-weight:600;color:' + COLORS.textSecondary + ';margin-bottom:5px;">选择需要的尺寸（可多选）</div>';
        h += '<div class="pg-tag-grid" id="pg-widget-type-tags">';
        h += '<div class="pg-tag" data-value="small">S 小号</div>';
        h += '<div class="pg-tag" data-value="medium">M 中号</div>';
        h += '<div class="pg-tag" data-value="large">L 大号</div>';
        h += '</div>';

        // ===== 异形形状选择 =====
        h += '<div style="font-size:10px;font-weight:600;color:' + COLORS.textSecondary + ';margin:6px 0 5px;">小组件外形</div>';
        h += '<div class="pg-hint" style="margin-bottom:6px;">小组件的形状，不影响实际大小</div>';
        h += '<div class="pg-header-grid" data-field="widgetShape" id="pg-widget-shape-grid">';
        h += '<div class="pg-header-item selected" data-value="rounded-rect"><div class="pg-header-item-title">圆角矩形</div><div class="pg-header-item-desc">最常见的形状</div></div>';
        h += '<div class="pg-header-item" data-value="circle"><div class="pg-header-item-title">圆形</div><div class="pg-header-item-desc">正圆形</div></div>';
        h += '<div class="pg-header-item" data-value="squircle"><div class="pg-header-item-title">超椭圆</div><div class="pg-header-item-desc">苹果风格圆角</div></div>';
        h += '<div class="pg-header-item" data-value="blob"><div class="pg-header-item-title">有机形态</div><div class="pg-header-item-desc">不规则的圆润形状</div></div>';
        h += '<div class="pg-header-item" data-value="pill"><div class="pg-header-item-title">胶囊形</div><div class="pg-header-item-desc">像药丸一样</div></div>';
        h += '<div class="pg-header-item" data-value="diamond"><div class="pg-header-item-title">菱形</div><div class="pg-header-item-desc">斜着的正方形</div></div>';
        h += '</div>';

        // Small 设计区
        h += '<div id="pg-widget-small-section" style="display:none;margin-top:8px;padding:10px;background:rgba(0,122,255,0.04);border-radius:10px;">';
        h += '<div class="pg-section-title" style="color:' + COLORS.primary + ';">Small 小组件（2×1格）</div>';
        h += '<div class="pg-hint">尺寸较小，适合展示单个关键数据，如数字、图标+文字</div>';
        h += '<div class="pg-input-group"><label class="pg-label">组件标题</label>';
        h += '<input class="pg-input" type="text" id="pg-ws-title" placeholder="例如：今日待办"></div>';
        h += '<div class="pg-input-group"><label class="pg-label">主要显示内容</label>';
        h += '<input class="pg-input" type="text" id="pg-ws-content" placeholder="例如：待办数量（大字号数字）"></div>';
        h += '<div class="pg-input-group"><label class="pg-label">图标描述（可选）</label>';
        h += '<input class="pg-input" type="text" id="pg-ws-icon" placeholder="例如：日历图标"></div>';
        h += '<div class="pg-input-group"><label class="pg-label">补充说明（可选）</label>';
        h += '<textarea class="pg-textarea" id="pg-ws-desc" placeholder="例如：底部显示最近一条待办标题"></textarea></div>';
        h += '</div>';

        // Medium 设计区
        h += '<div id="pg-widget-medium-section" style="display:none;margin-top:8px;padding:10px;background:rgba(0,122,255,0.04);border-radius:10px;">';
        h += '<div class="pg-section-title" style="color:' + COLORS.primary + ';">Medium 小组件（2×2格）</div>';
        h += '<div class="pg-input-group"><label class="pg-label">组件标题</label>';
        h += '<input class="pg-input" type="text" id="pg-wm-title" placeholder="例如：最近笔记"></div>';
        h += '<div class="pg-input-group"><label class="pg-label">主要显示内容</label>';
        h += '<input class="pg-input" type="text" id="pg-wm-content" placeholder="例如：最近3条笔记标题列表"></div>';
        h += '<div style="font-size:10px;font-weight:600;color:' + COLORS.textSecondary + ';margin-bottom:4px;">布局方式</div>';
        h += '<div class="pg-layout-grid" id="pg-wm-layout">';
        h += '<div class="pg-layout-item selected" data-value="horizontal"><div style="display:flex;gap:3px;height:20px;"><div style="flex:1;background:rgba(0,0,0,0.06);border-radius:3px;"></div><div style="flex:1;background:rgba(0,0,0,0.06);border-radius:3px;"></div></div><div class="pg-layout-name">左右布局</div></div>';
        h += '<div class="pg-layout-item" data-value="vertical"><div style="display:flex;flex-direction:column;gap:2px;height:20px;"><div style="height:9px;background:rgba(0,0,0,0.06);border-radius:3px;"></div><div style="height:9px;background:rgba(0,0,0,0.06);border-radius:3px;"></div></div><div class="pg-layout-name">上下布局</div></div></div>';
        h += '<div class="pg-input-group"><label class="pg-label">图标描述（可选）</label>';
        h += '<input class="pg-input" type="text" id="pg-wm-icon" placeholder="例如：笔记本图标"></div>';
        h += '<div class="pg-input-group"><label class="pg-label">补充说明（可选）</label>';
        h += '<textarea class="pg-textarea" id="pg-wm-desc" placeholder="例如：左侧标题和时间，右侧缩略图"></textarea></div>';
        h += '</div>';

        // Large 设计区
        h += '<div id="pg-widget-large-section" style="display:none;margin-top:8px;padding:10px;background:rgba(0,122,255,0.04);border-radius:10px;">';
        h += '<div class="pg-section-title" style="color:' + COLORS.primary + ';">Large 小组件（4×2格，全宽）</div>';
        h += '<div class="pg-input-group"><label class="pg-label">组件标题</label>';
        h += '<input class="pg-input" type="text" id="pg-wl-title" placeholder="例如：本周统计"></div>';
        h += '<div class="pg-input-group"><label class="pg-label">主要显示内容</label>';
        h += '<input class="pg-input" type="text" id="pg-wl-content" placeholder="例如：7天数据折线图 + 今日摘要"></div>';
        h += '<div style="font-size:10px;font-weight:600;color:' + COLORS.textSecondary + ';margin-bottom:4px;">布局方式</div>';
        h += '<div class="pg-layout-grid" id="pg-wl-layout">';
        h += '<div class="pg-layout-item selected" data-value="horizontal"><div style="display:flex;gap:3px;height:20px;"><div style="flex:2;background:rgba(0,0,0,0.06);border-radius:3px;"></div><div style="flex:1;background:rgba(0,0,0,0.06);border-radius:3px;"></div></div><div class="pg-layout-name">左右布局</div></div>';
        h += '<div class="pg-layout-item" data-value="vertical"><div style="display:flex;flex-direction:column;gap:2px;height:20px;"><div style="height:9px;background:rgba(0,0,0,0.06);border-radius:3px;"></div><div style="height:9px;background:rgba(0,0,0,0.06);border-radius:3px;"></div></div><div class="pg-layout-name">上下布局</div></div></div>';
        h += '<div class="pg-input-group"><label class="pg-label">补充说明（可选）</label>';
        h += '<textarea class="pg-textarea" id="pg-wl-desc" placeholder="例如：左侧大图表，右侧今日数据摘要"></textarea></div>';
        h += '</div>';

        // 异形预览区
        h += '<div class="pg-prev-wrap" style="margin-top:8px;flex-direction:column;align-items:center;min-height:90px;" id="pg-widget-shape-preview">';
        h += '<span class="pg-prev-label">小组件形状预览</span>';
        h += '<div style="display:flex;gap:10px;align-items:flex-end;padding-top:16px;flex-wrap:wrap;justify-content:center;" id="pg-widget-shape-prev-inner" class="pg-widget-shape-rounded-rect">';
        h += '<div class="pg-widget-prev-small"><div style="font-size:7px;color:#86868B;" id="pg-ws-prev-title">标题</div><div style="font-size:18px;font-weight:700;color:#1D1D1F;" id="pg-ws-prev-content">内容</div></div>';
        h += '<div class="pg-widget-prev-medium" style="display:flex;align-items:center;gap:6px;"><div style="flex:1;"><div style="font-size:7px;color:#86868B;" id="pg-wm-prev-title">标题</div><div style="font-size:10px;font-weight:600;color:#1D1D1F;margin-top:2px;" id="pg-wm-prev-content">内容</div></div></div>';
        h += '</div></div>';
        return h;
    };

    // ============ 灵动岛开关步骤 ============
    PromptGenApp.prototype.renderIslandToggleStep = function() {
        var h = '';
        h += '<div class="pg-choice-card" id="pg-island-yes" data-value="yes">';
        h += '<div class="pg-choice-icon" style="background:rgba(52,199,89,0.1);color:' + COLORS.success + ';">' + ICONS.magic + '</div>';
        h += '<div><div class="pg-choice-title">需要灵动岛</div>';
        h += '<div class="pg-choice-desc">配置 Quiet / Mini / Medium / Large 四种模式</div></div></div>';
        h += '<div class="pg-choice-card selected" id="pg-island-no" data-value="no">';
        h += '<div class="pg-choice-icon" style="background:rgba(142,142,147,0.1);color:' + COLORS.textSecondary + ';">' + ICONS.skip + '</div>';
        h += '<div><div class="pg-choice-title">不需要，跳过</div>';
        h += '<div class="pg-choice-desc">跳过灵动岛配置，直接生成结果</div></div></div>';
        h += '<div class="pg-prev-wrap" style="margin-top:6px;flex-direction:column;align-items:center;">';
        h += '<span class="pg-prev-label">灵动岛效果示意</span>';
        h += '<div style="display:flex;flex-direction:column;align-items:center;gap:6px;padding-top:14px;">';
        h += '<div><div style="font-size:7px;color:' + COLORS.textSecondary + ';text-align:center;margin-bottom:2px;">Quiet</div>';
        h += '<div class="pg-island-prev pg-island-quiet"><div style="display:flex;align-items:center;gap:4px;"><div style="width:6px;height:6px;border-radius:50%;background:#4ade80;"></div><div style="width:3px;height:8px;background:rgba(255,255,255,0.4);border-radius:1px;"></div><div style="width:3px;height:12px;background:rgba(255,255,255,0.6);border-radius:1px;"></div><div style="width:3px;height:6px;background:rgba(255,255,255,0.3);border-radius:1px;"></div></div></div></div>';
        h += '<div><div style="font-size:7px;color:' + COLORS.textSecondary + ';text-align:center;margin-bottom:2px;">Mini</div>';
        h += '<div class="pg-island-prev pg-island-mini"><div style="color:white;font-size:9px;font-weight:500;display:flex;align-items:center;gap:4px;"><span style="font-size:11px;color:rgba(255,255,255,0.8);">' + ICONS.magic + '</span> 播放中...</div></div></div>';
        h += '<div><div style="font-size:7px;color:' + COLORS.textSecondary + ';text-align:center;margin-bottom:2px;">Medium</div>';
        h += '<div class="pg-island-prev pg-island-medium"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><div style="width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#FF6B8A,#FF8FAB);"></div><div><div style="color:white;font-size:11px;font-weight:600;">正在播放</div>';
        h += '<div style="color:rgba(255,255,255,0.6);font-size:8px;">歌曲名 - 歌手</div></div></div>';
        h += '<div style="height:2px;background:rgba(255,255,255,0.2);border-radius:1px;"><div style="width:45%;height:100%;background:white;border-radius:1px;"></div></div></div></div>';
        h += '</div></div>';
        return h;
    };

    // ============ 灵动岛设计步骤 ============
    PromptGenApp.prototype.renderIslandDesignStep = function() {
        var h = '';
        h += '<div class="pg-section-title">Quiet 静默模式</div>';
        h += '<div class="pg-hint">灵动岛保持原始大小，内部显示微小指示器</div>';
        h += '<div class="pg-input-group"><label class="pg-label">静默状态显示内容</label>';
        h += '<input class="pg-input" type="text" id="pg-island-quiet-input" placeholder="例如：绿色小圆点表示运行中"></div>';
        h += '<div class="pg-input-group"><label class="pg-label">补充说明</label>';
        h += '<textarea class="pg-textarea" id="pg-island-quiet-desc" placeholder="例如：左侧App小图标，右侧音波动画"></textarea></div>';

        h += '<div class="pg-section-title">Mini 紧凑模式</div>';
        h += '<div class="pg-input-group"><label class="pg-label">Mini 显示内容</label>';
        h += '<input class="pg-input" type="text" id="pg-island-mini-input" placeholder="例如：播放中、计时 03:25"></div>';
        h += '<div class="pg-input-group"><label class="pg-label">Mini 补充说明</label>';
        h += '<textarea class="pg-textarea" id="pg-island-mini-desc" placeholder="例如：左侧App图标，右侧状态文字"></textarea></div>';

        h += '<div class="pg-section-title">Medium 展开模式</div>';
        h += '<div class="pg-input-group"><label class="pg-label">标题</label>';
        h += '<input class="pg-input" type="text" id="pg-island-med-title" placeholder="例如：正在播放"></div>';
        h += '<div class="pg-input-group"><label class="pg-label">副标题</label>';
        h += '<input class="pg-input" type="text" id="pg-island-med-sub" placeholder="例如：歌曲名 - 歌手名"></div>';
        h += '<div class="pg-toggle-row"><div><div style="font-size:11px;font-weight:600;color:' + COLORS.textPrimary + ';">显示进度条</div></div>';
        h += '<div class="pg-toggle" id="pg-island-progress"><div class="pg-toggle-knob"></div></div></div>';
        h += '<div class="pg-toggle-row"><div><div style="font-size:11px;font-weight:600;color:' + COLORS.textPrimary + ';">显示控制按钮</div></div>';
        h += '<div class="pg-toggle" id="pg-island-controls"><div class="pg-toggle-knob"></div></div></div>';
        h += '<div class="pg-input-group"><label class="pg-label">Medium 补充说明</label>';
        h += '<textarea class="pg-textarea" id="pg-island-med-desc" placeholder="例如：左侧封面，右侧歌曲信息"></textarea></div>';

        h += '<div class="pg-section-title">Large 完整模式（可选）</div>';
        h += '<div class="pg-toggle-row"><div><div style="font-size:11px;font-weight:600;color:' + COLORS.textPrimary + ';">启用 Large 模式</div></div>';
        h += '<div class="pg-toggle" id="pg-island-large-toggle"><div class="pg-toggle-knob"></div></div></div>';
        h += '<div id="pg-island-large-section" style="display:none;">';
        h += '<div class="pg-input-group"><label class="pg-label">Large 标题</label>';
        h += '<input class="pg-input" type="text" id="pg-island-large-title" placeholder="例如：正在播放"></div>';
        h += '<div class="pg-input-group"><label class="pg-label">Large 主要内容</label>';
        h += '<textarea class="pg-textarea" id="pg-island-large-content" placeholder="例如：歌词滚动显示"></textarea></div>';
        h += '<div class="pg-input-group"><label class="pg-label">Large 补充说明</label>';
        h += '<textarea class="pg-textarea" id="pg-island-large-desc" placeholder="例如：顶部封面，中间歌词，底部控制"></textarea></div>';
        h += '</div>';

        h += '<div class="pg-section-title">消息通知类型</div>';
        h += '<div class="pg-notify-grid" id="pg-notify-types">';
        h += '<div class="pg-toggle-row" style="margin:0;"><div><div style="font-size:10px;font-weight:600;color:' + COLORS.success + ';">Success</div></div>';
        h += '<div class="pg-toggle on" data-notify="success"><div class="pg-toggle-knob"></div></div></div>';
        h += '<div class="pg-toggle-row" style="margin:0;"><div><div style="font-size:10px;font-weight:600;color:' + COLORS.danger + ';">Error</div></div>';
        h += '<div class="pg-toggle on" data-notify="error"><div class="pg-toggle-knob"></div></div></div>';
        h += '<div class="pg-toggle-row" style="margin:0;"><div><div style="font-size:10px;font-weight:600;color:' + COLORS.warning + ';">Warning</div></div>';
        h += '<div class="pg-toggle on" data-notify="warning"><div class="pg-toggle-knob"></div></div></div>';
        h += '<div class="pg-toggle-row" style="margin:0;"><div><div style="font-size:10px;font-weight:600;color:' + COLORS.primary + ';">Info</div></div>';
        h += '<div class="pg-toggle on" data-notify="info"><div class="pg-toggle-knob"></div></div></div>';
        h += '</div>';

        // 灵动岛预览
        h += '<div class="pg-prev-wrap" style="margin-top:8px;flex-direction:column;align-items:center;">';
        h += '<span class="pg-prev-label">灵动岛实时预览</span>';
        h += '<div style="display:flex;flex-direction:column;align-items:center;gap:6px;padding-top:14px;">';
        h += '<div style="font-size:7px;color:' + COLORS.textSecondary + ';">Quiet</div>';
        h += '<div class="pg-island-prev pg-island-quiet" id="pg-island-quiet-prev"><div style="width:6px;height:6px;border-radius:50%;background:#4ade80;"></div></div>';
        h += '<div style="font-size:7px;color:' + COLORS.textSecondary + ';">Mini</div>';
        h += '<div class="pg-island-prev pg-island-mini" id="pg-island-mini-prev"><div style="color:white;font-size:9px;">Mini</div></div>';
        h += '<div style="font-size:7px;color:' + COLORS.textSecondary + ';">Medium</div>';
        h += '<div class="pg-island-prev pg-island-medium" id="pg-island-med-prev"></div>';
        h += '<div id="pg-island-large-prev-wrap" style="display:none;"><div style="font-size:7px;color:' + COLORS.textSecondary + ';text-align:center;">Large</div>';
        h += '<div class="pg-island-prev pg-island-large" id="pg-island-large-prev"></div></div>';
        h += '</div></div>';
        return h;
    };

    // ============ UI 更新 ============
    PromptGenApp.prototype.updateUI = function() {
        var total = WIZARD_STEPS.length;
        var isResult = this.currentStep >= total;
        var pct = isResult ? 100 : Math.round((this.currentStep / total) * 100);
        var bar = this.appWindow.querySelector('#pg-progress');
        if (bar) bar.style.width = pct + '%';
        this.appWindow.querySelectorAll('.pg-card').forEach(function(c) { c.classList.remove('active', 'pg-animate-in'); });
        var target;
        if (isResult) { target = this.appWindow.querySelector('#step-result'); }
        else { target = this.appWindow.querySelector('#step-' + this.currentStep); }
        if (target) { target.classList.add('active', 'pg-animate-in'); }
        var backBtn = this.appWindow.querySelector('#pg-back-btn');
        var nextBtn = this.appWindow.querySelector('#pg-next-btn');
        if (backBtn) backBtn.style.display = (this.currentStep > 0 || isResult) ? 'flex' : 'none';
        if (nextBtn) {
            if (isResult) { nextBtn.style.display = 'none'; }
            else { nextBtn.style.display = 'flex'; nextBtn.innerHTML = (this.currentStep === total - 1 ? '生成提示词 ' + ICONS.magic : '下一步 ' + ICONS.next); }
        }
        if (isResult && backBtn) { backBtn.textContent = '重新开始'; }
        else if (backBtn) { backBtn.textContent = '返回'; }
        if (this.currentStep === 1) this.renderPagesList();
        this.updateStepPreviews();
        var scroll = this.appWindow.querySelector('.pg-scroll');
        if (scroll) scroll.scrollTop = 0;
    };

    PromptGenApp.prototype.updateStepPreviews = function() {
        var step = WIZARD_STEPS[this.currentStep];
        if (!step) return;
        if (step.type === 'corner-preview') this.updateCornerPreview();
        if (step.type === 'modal-preview') this.updateModalPreview();
        if (step.type === 'list-preview') this.updateListPreviews();
        if (step.type === 'palette') this.updatePalettePreview();
        if (step.type === 'button-design') this.updateButtonPreview();
        if (step.type === 'navbar-design') this.updateNavbarPreview();
        if (step.type === 'motion-design') this.updateMotionPreview();
        if (step.type === 'island-design') this.updateIslandPreview();
        if (step.type === 'widget-design') { this.updateWidgetPreview(); this.updateWidgetShapePreview(); }
        if (step.type === 'typography-design') this.updateTypographyPreview();
        if (step.type === 'card-design') this.updateCardDesignPreview();
        if (step.type === 'tabbar-design') this.updateTabbarPreview();
        if (step.type === 'icon-style-design') this.updateIconStylePreview();
        if (step.type === 'density-theme-design') this.updateDensityPreview();
    };

    // ============ 页面列表渲染 ============
    PromptGenApp.prototype.renderPagesList = function() {
        var el = this.appWindow.querySelector('#pg-pages-list');
        if (!el) return;
        var pages = this.answers.pages;
        var h = '';
        pages.forEach(function(p, i) {
            h += '<div class="pg-page-item" data-idx="' + i + '">';
            h += '<div class="pg-page-num">' + (i + 1) + '</div>';
            h += '<div class="pg-page-fields">';
            h += '<input type="text" placeholder="页面名称" value="' + (p.name || '') + '" data-field="name">';
            h += '<textarea placeholder="页面内容描述" data-field="desc">' + (p.desc || '') + '</textarea>';
            h += '</div>';
            if (pages.length > 1) h += '<button class="pg-page-del" data-idx="' + i + '">×</button>';
            h += '</div>';
        });
        el.innerHTML = h;
    };

    // ============ 预览更新方法 ============
    PromptGenApp.prototype.updateCornerPreview = function() {
        var el = this.appWindow.querySelector('#pg-corner-prev-inner');
        if (!el) return;
        var r = { small:'6px', medium:'12px', large:'20px', pill:'50px' }[this.answers.corner] || '12px';
        var prim = this.getResolvedPrimary();
        el.innerHTML = '<div style="display:flex;gap:6px;align-items:center;">' +
            '<div style="flex:1;height:28px;background:white;border-radius:' + r + ';box-shadow:0 2px 6px rgba(0,0,0,0.06);display:flex;align-items:center;padding:0 8px;">' +
            '<div style="width:16px;height:16px;border-radius:50%;background:' + prim + ';opacity:0.2;"></div>' +
            '<div style="flex:1;margin-left:6px;"><div style="height:5px;width:60%;background:rgba(0,0,0,0.1);border-radius:3px;margin-bottom:2px;"></div>' +
            '<div style="height:3px;width:40%;background:rgba(0,0,0,0.05);border-radius:2px;"></div></div></div>' +
            '<div style="padding:5px 12px;background:' + prim + ';color:white;border-radius:' + r + ';font-size:9px;font-weight:600;">按钮</div></div>';
    };

    PromptGenApp.prototype.updateModalPreview = function() {
        var el = this.appWindow.querySelector('#pg-modal-preview');
        if (!el) return;
        var a = this.answers, prim = this.getResolvedPrimary();
        var r = { small:'8px', medium:'16px', large:'24px' }[a.modalRadius] || '24px';
        var showClose = (a.modalClose === 'button' || a.modalClose === 'both');
        var ds = 'background:white;padding:8px;text-align:center;border-radius:' + r + ';';
        var closeH = showClose ? '<div class="pg-modal-prev-close"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>' : '';
        if (a.modalStyle === 'center') ds += 'width:65%;max-width:140px;position:relative;';
        else if (a.modalStyle === 'bottom') ds += 'position:absolute;bottom:0;left:0;right:0;border-radius:' + r + ' ' + r + ' 0 0;';
        else ds += 'position:absolute;inset:0;border-radius:0;display:flex;flex-direction:column;justify-content:center;';
        el.innerHTML = '<div class="pg-modal-prev-overlay"></div><div class="pg-modal-prev-dialog" style="' + ds + '">' + closeH +
            '<div class="pg-mp-title">提示</div><div class="pg-mp-body">确认执行此操作？</div>' +
            '<div class="pg-mp-btn" style="background:' + prim + ';border-radius:' + (a.modalRadius === 'large' ? '10px' : a.modalRadius === 'medium' ? '6px' : '3px') + ';">确定</div></div>';
    };

    PromptGenApp.prototype.updateListPreviews = function() {
        var prim = this.getResolvedPrimary();
        var demos = {
            card: '<div style="display:flex;flex-direction:column;gap:2px;padding:3px;"><div style="height:14px;background:white;border-radius:3px;box-shadow:0 1px 2px rgba(0,0,0,0.08);"></div><div style="height:14px;background:white;border-radius:3px;box-shadow:0 1px 2px rgba(0,0,0,0.08);"></div><div style="height:14px;background:white;border-radius:3px;box-shadow:0 1px 2px rgba(0,0,0,0.08);"></div></div>',
            list: '<div style="display:flex;flex-direction:column;padding:3px;"><div style="height:12px;border-bottom:1px solid rgba(0,0,0,0.06);"></div><div style="height:12px;border-bottom:1px solid rgba(0,0,0,0.06);"></div><div style="height:12px;border-bottom:1px solid rgba(0,0,0,0.06);"></div></div>',
            waterfall: '<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;padding:3px;"><div style="height:20px;background:white;border-radius:2px;"></div><div style="height:14px;background:white;border-radius:2px;"></div><div style="height:12px;background:white;border-radius:2px;"></div><div style="height:18px;background:white;border-radius:2px;"></div></div>',
            grid: '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:2px;padding:3px;"><div style="height:12px;background:white;border-radius:2px;"></div><div style="height:12px;background:white;border-radius:2px;"></div><div style="height:12px;background:white;border-radius:2px;"></div><div style="height:12px;background:white;border-radius:2px;"></div><div style="height:12px;background:white;border-radius:2px;"></div><div style="height:12px;background:white;border-radius:2px;"></div></div>'
        };
        for (var key in demos) { var d = this.appWindow.querySelector('#pg-list-demo-' + key); if (d) d.innerHTML = demos[key]; }
        var bigEl = this.appWindow.querySelector('#pg-list-preview');
        if (!bigEl) return;
        var layout = this.answers.listLayout;
        var bh = '<span class="pg-prev-label">预览</span><div style="width:100%;padding-top:12px;">';
        if (layout === 'card') {
            for (var i = 0; i < 3; i++) bh += '<div style="background:white;border-radius:8px;padding:6px;margin-bottom:5px;box-shadow:0 2px 6px rgba(0,0,0,0.06);display:flex;align-items:center;gap:6px;"><div style="width:22px;height:22px;border-radius:6px;background:' + prim + ';opacity:0.15;flex-shrink:0;"></div><div style="flex:1;"><div style="height:4px;width:' + (55+i*10) + '%;background:rgba(0,0,0,0.1);border-radius:2px;margin-bottom:2px;"></div><div style="height:3px;width:' + (30+i*5) + '%;background:rgba(0,0,0,0.05);border-radius:2px;"></div></div></div>';
        } else if (layout === 'list') {
            for (var j = 0; j < 4; j++) bh += '<div style="padding:5px 0;border-bottom:1px solid rgba(0,0,0,0.06);display:flex;align-items:center;gap:6px;"><div style="width:5px;height:5px;border-radius:50%;background:' + prim + ';"></div><div style="height:4px;width:' + (45+j*8) + '%;background:rgba(0,0,0,0.08);border-radius:2px;"></div></div>';
        } else if (layout === 'waterfall') {
            bh += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;">';
            [38,28,24,34,30,22].forEach(function(h2) { bh += '<div style="height:' + h2 + 'px;background:white;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,0.06);padding:3px;"><div style="height:3px;width:55%;background:rgba(0,0,0,0.08);border-radius:2px;margin-bottom:2px;"></div><div style="height:2px;width:35%;background:rgba(0,0,0,0.04);border-radius:1px;"></div></div>'; });
            bh += '</div>';
        } else {
            bh += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;">';
            for (var m = 0; m < 6; m++) bh += '<div style="aspect-ratio:1;background:white;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,0.06);display:flex;align-items:center;justify-content:center;"><div style="width:14px;height:14px;border-radius:3px;background:' + prim + ';opacity:0.12;"></div></div>';
            bh += '</div>';
        }
        bh += '</div>';
        bigEl.innerHTML = bh;
    };

    PromptGenApp.prototype.updatePalettePreview = function() {
        var el = this.appWindow.querySelector('#pg-palette-prev-inner');
        if (!el) return;
        var a = this.answers;
        el.innerHTML = '<div style="background:' + a.customBg + ';border-radius:7px;padding:6px;min-height:40px;">' +
            '<div style="background:' + a.customCard + ';border-radius:5px;padding:6px;margin-bottom:5px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">' +
            '<div style="height:4px;width:50%;background:rgba(0,0,0,0.1);border-radius:2px;margin-bottom:3px;"></div>' +
            '<div style="height:3px;width:30%;background:rgba(0,0,0,0.05);border-radius:2px;"></div></div>' +
            '<div style="display:flex;gap:5px;"><div style="flex:1;height:18px;background:' + a.customPrim + ';border-radius:5px;"></div>' +
            '<div style="flex:1;height:18px;background:' + a.customAccent + ';border-radius:5px;"></div></div></div>';
    };

    PromptGenApp.prototype.getResolvedPrimary = function() {
        if (this.answers.palette === 'custom') return this.answers.customPrim;
        var s = WIZARD_STEPS[2].options.filter(function(o) { return o.value === this.answers.style; }.bind(this))[0];
        return (s && s.colors.prim) || '#007AFF';
    };

    // ============ 字体排版预览 ============
    PromptGenApp.prototype.updateTypographyPreview = function() {
        var el = this.appWindow.querySelector('#pg-typo-prev-inner');
        if (!el) return;
        var a = this.answers, prim = this.getResolvedPrimary();
        var familyMap = { system:'-apple-system,BlinkMacSystemFont,sans-serif', rounded:'"Nunito","Varela Round",sans-serif', serif:'Georgia,"Noto Serif SC",serif', mono:'SF Mono,Menlo,monospace', handwritten:'"Caveat",cursive', geometric:'"Poppins","Montserrat",sans-serif' };
        var scaleMap = { compact:{ h1:'16px', body:'11px', cap:'8px' }, standard:{ h1:'20px', body:'13px', cap:'10px' }, relaxed:{ h1:'24px', body:'15px', cap:'11px' } };
        var weightMap = { light:{ h1:'500', body:'300' }, medium:{ h1:'700', body:'400' }, bold:{ h1:'800', body:'600' } };
        var lhMap = { tight:'1.2', normal:'1.5', loose:'1.8' };
        var ff = familyMap[a.typoFamily] || familyMap.system;
        var sc = scaleMap[a.typoScale] || scaleMap.standard;
        var wt = weightMap[a.typoWeight] || weightMap.medium;
        var lh = lhMap[a.typoLineHeight] || '1.5';
        el.innerHTML = '<div style="font-family:' + ff + ';line-height:' + lh + ';">' +
            '<div style="font-size:' + sc.h1 + ';font-weight:' + wt.h1 + ';color:' + COLORS.textPrimary + ';margin-bottom:3px;">标题文字 Title</div>' +
            '<div style="font-size:' + sc.body + ';font-weight:' + wt.body + ';color:' + COLORS.textPrimary + ';margin-bottom:2px;">正文内容 Body text here</div>' +
            '<div style="font-size:' + sc.cap + ';color:' + COLORS.textSecondary + ';">辅助说明 Caption · ' + a.typoFamily + '</div></div>';
    };

    // ============ 卡片设计预览 ============
    PromptGenApp.prototype.updateCardDesignPreview = function() {
        var el = this.appWindow.querySelector('#pg-card-design-prev-inner');
        if (!el) return;
        var a = this.answers, prim = this.getResolvedPrimary();
        var shadowMap = { none:'none', light:'0 2px 8px rgba(0,0,0,0.04)', medium:'0 4px 16px rgba(0,0,0,0.08)', deep:'0 8px 32px rgba(0,0,0,0.12)' };
        var borderMap = { none:'none', hairline:'1px solid rgba(0,0,0,0.06)', gradient:'2px solid ' + prim, dashed:'1.5px dashed rgba(0,0,0,0.1)' };
        var padMap = { compact:'6px', standard:'12px', spacious:'18px' };
        var bgMap = { solid:'white', gradient:'linear-gradient(135deg,white,' + prim + '10)', glass:'rgba(255,255,255,0.6)', image:'linear-gradient(135deg,#f0f0f0,#e8e8e8)' };
        var shadow = shadowMap[a.cardShadow] || 'none';
        var border = borderMap[a.cardBorder] || 'none';
        var pad = padMap[a.cardPadding] || '12px';
        var bg = bgMap[a.cardBackground] || 'white';
        var r = { small:'6px', medium:'12px', large:'20px', pill:'50px' }[a.corner] || '12px';
        el.innerHTML = '<div style="background:' + bg + ';border-radius:' + r + ';padding:' + pad + ';box-shadow:' + shadow + ';border:' + border + ';' + (a.cardBackground === 'glass' ? 'backdrop-filter:blur(10px);' : '') + '">' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
            '<div style="width:24px;height:24px;border-radius:6px;background:' + prim + ';opacity:0.15;"></div>' +
            '<div style="flex:1;"><div style="height:5px;width:60%;background:rgba(0,0,0,0.1);border-radius:3px;margin-bottom:3px;"></div>' +
            '<div style="height:3px;width:40%;background:rgba(0,0,0,0.05);border-radius:2px;"></div></div></div></div>';
    };

    // ============ Tab栏预览 ============
    PromptGenApp.prototype.updateTabbarPreview = function() {
        var el = this.appWindow.querySelector('#pg-tabbar-prev-inner');
        if (!el) return;
        var a = this.answers, prim = this.getResolvedPrimary();
        var matMap = { blur:'background:rgba(255,255,255,0.8);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);', solid:'background:white;border-top:1px solid rgba(0,0,0,0.06);', transparent:'background:transparent;' };
        var matStyle = matMap[a.tabMaterial] || matMap.blur;
        var tabs = ['首页','发现','我的'];
        var badgeHtml = '';
        if (a.tabBadge === 'dot') badgeHtml = '<div style="position:absolute;top:-2px;right:-4px;width:6px;height:6px;border-radius:50%;background:#FF3B30;"></div>';
        else if (a.tabBadge === 'number') badgeHtml = '<div style="position:absolute;top:-4px;right:-8px;min-width:14px;height:14px;border-radius:7px;background:#FF3B30;color:white;font-size:8px;display:flex;align-items:center;justify-content:center;padding:0 3px;">3</div>';
        var h = '<div style="display:flex;align-items:center;justify-content:space-around;height:40px;border-radius:8px;' + matStyle + '">';
        tabs.forEach(function(t, i) {
            var isActive = i === 0;
            var centerBtn = a.tabCenterBtn && i === 1;
            if (centerBtn) {
                h += '<div style="width:32px;height:32px;border-radius:50%;background:' + prim + ';display:flex;align-items:center;justify-content:center;transform:translateY(-6px);box-shadow:0 2px 8px ' + prim + '40;"><div style="color:white;font-size:14px;font-weight:700;">+</div></div>';
            } else {
                h += '<div style="display:flex;flex-direction:column;align-items:center;gap:1px;position:relative;' + (isActive ? 'color:' + prim + ';' : 'color:#999;') + '">';
                h += '<div style="width:16px;height:16px;border-radius:3px;' + (isActive && a.tabIconStyle === 'filled' ? 'background:' + prim + ';' : 'border:1.5px solid currentColor;') + 'position:relative;">';
                if (i === 0) h += badgeHtml;
                h += '</div>';
                h += '<div style="font-size:7px;font-weight:' + (isActive ? '600' : '400') + ';">' + t + '</div></div>';
            }
        });
        h += '</div>';
        el.innerHTML = h;
    };

    // ============ 图标风格预览 ============
    PromptGenApp.prototype.updateIconStylePreview = function() {
        var el = this.appWindow.querySelector('#pg-icon-style-prev-inner');
        if (!el) return;
        var a = this.answers, prim = this.getResolvedPrimary();
        var sw = { thin:'1', regular:'1.5', bold:'2.5' }[a.iconWeight] || '1.5';
        var isFilled = a.iconStyle === 'filled';
        var isDuotone = a.iconStyle === 'duotone';
        var lc = a.iconStyle === 'rounded' ? 'round' : (a.iconStyle === 'sharp' ? 'butt' : 'round');
        var lj = a.iconStyle === 'sharp' ? 'miter' : 'round';
        var icons = [
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="' + (isFilled ? prim : 'none') + '" stroke="' + prim + '" stroke-width="' + sw + '" stroke-linecap="' + lc + '" stroke-linejoin="' + lj + '"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="' + (isFilled ? prim : 'none') + '" stroke="' + prim + '" stroke-width="' + sw + '" stroke-linecap="' + lc + '" stroke-linejoin="' + lj + '"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="' + (isFilled ? prim : 'none') + '" stroke="' + prim + '" stroke-width="' + sw + '" stroke-linecap="' + lc + '" stroke-linejoin="' + lj + '"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="' + (isFilled ? prim : 'none') + '" stroke="' + prim + '" stroke-width="' + sw + '" stroke-linecap="' + lc + '" stroke-linejoin="' + lj + '"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>'
        ];
        if (isDuotone) {
            icons = icons.map(function(svg) { return svg.replace('fill="none"', 'fill="' + prim + '" fill-opacity="0.2"'); });
        }
        el.innerHTML = '<div style="display:flex;gap:12px;align-items:center;justify-content:center;">' + icons.join('') + '</div>' +
            '<div style="text-align:center;margin-top:4px;font-size:8px;color:' + COLORS.textSecondary + ';">' + a.iconStyle + ' · stroke: ' + sw + 'px</div>';
    };

    // ============ 密度主题预览 ============
    PromptGenApp.prototype.updateDensityPreview = function() {
        var el = this.appWindow.querySelector('#pg-density-prev-inner');
        if (!el) return;
        var a = this.answers, prim = this.getResolvedPrimary();
        var rowH = { compact:'28px', standard:'36px', comfortable:'44px' }[a.density] || '36px';
        var gap = { compact:'4px', standard:'8px', comfortable:'12px' }[a.density] || '8px';
        var isDark = a.darkMode === 'default';
        var bg = isDark ? '#1C1C1E' : '#F2F2F7';
        var cardBg = isDark ? '#2C2C2E' : 'white';
        var textColor = isDark ? '#FFFFFF' : COLORS.textPrimary;
        var subColor = isDark ? 'rgba(255,255,255,0.5)' : COLORS.textSecondary;
        var inputBg, inputBorder;
        if (a.inputStyle === 'border') { inputBg = 'transparent'; inputBorder = 'border:1px solid ' + (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)') + ';border-radius:6px;'; }
        else if (a.inputStyle === 'underline') { inputBg = 'transparent'; inputBorder = 'border:none;border-bottom:1.5px solid ' + prim + ';border-radius:0;'; }
        else { inputBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'; inputBorder = 'border:none;border-radius:6px;'; }
        var h = '<div style="background:' + bg + ';border-radius:8px;padding:' + gap + ';display:flex;flex-direction:column;gap:' + gap + ';">';
        for (var i = 0; i < 2; i++) {
            h += '<div style="background:' + cardBg + ';border-radius:6px;height:' + rowH + ';display:flex;align-items:center;padding:0 8px;gap:6px;">' +
                '<div style="width:' + (a.density === 'compact' ? '16px' : '20px') + ';height:' + (a.density === 'compact' ? '16px' : '20px') + ';border-radius:50%;background:' + prim + ';opacity:0.15;"></div>' +
                '<div style="flex:1;"><div style="height:4px;width:' + (50 + i * 15) + '%;background:' + textColor + ';opacity:0.15;border-radius:2px;margin-bottom:2px;"></div>' +
                '<div style="height:3px;width:' + (30 + i * 10) + '%;background:' + subColor + ';opacity:0.3;border-radius:2px;"></div></div></div>';
        }
        h += '<div style="height:24px;background:' + inputBg + ';' + inputBorder + 'display:flex;align-items:center;padding:0 6px;">' +
            '<div style="font-size:8px;color:' + subColor + ';">输入框样式</div></div>';
        h += '</div>';
        el.innerHTML = h;
    };

    // ============ 按钮预览更新（新增） ============
    PromptGenApp.prototype.updateButtonPreview = function() {
        var el = this.appWindow.querySelector('#pg-btn-preview');
        if (!el) return;
        var a = this.answers, prim = this.getResolvedPrimary();
        var shapeMap = { rounded:'10px', pill:'50px', squircle:'18px', ghost:'8px', outlined:'10px', fab:'50%' };
        var sizeMap = { small:'pg-btn-demo-sm', medium:'', large:'pg-btn-demo-lg' };
        var radius = shapeMap[a.btnShape] || '10px';
        var sizeClass = sizeMap[a.btnSize] || '';
        var bg = a.btnGradient ? 'linear-gradient(135deg,' + prim + ',' + COLORS.secondary + ')' : prim;
        var shadow = a.btnShadow ? 'box-shadow:0 4px 14px ' + prim + '40;' : '';
        var border = '';
        var color = 'white';
        if (a.btnShape === 'ghost') { bg = 'transparent'; color = prim; shadow = ''; }
        if (a.btnShape === 'outlined') { bg = 'transparent'; color = prim; border = 'border:2px solid ' + prim + ';'; shadow = ''; }
        if (a.btnShape === 'fab') { radius = '50%'; }

        var feedbackAttr = '';
        if (a.btnFeedback === 'scale') feedbackAttr = 'onmousedown="this.style.transform=\'scale(0.94)\'" onmouseup="this.style.transform=\'scale(1)\'" onmouseleave="this.style.transform=\'scale(1)\'"';
        else if (a.btnFeedback === 'bounce') feedbackAttr = 'onmousedown="this.style.animation=\'pgJelly 0.6s ease\'" onanimationend="this.style.animation=\'\'"';
        else if (a.btnFeedback === 'glow') feedbackAttr = 'onmousedown="this.style.animation=\'pgBtnGlow 0.8s ease\'" onanimationend="this.style.animation=\'\'"';

        var iconHtml = '';
        if (a.btnIconPos === 'left' || a.btnIconPos === 'right') iconHtml = '<span style="font-size:12px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>';
        var textHtml = a.btnShape === 'fab' ? '+' : '主按钮';
        if (a.btnIconPos === 'only') { textHtml = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'; iconHtml = ''; }

        var btnHtml = '<div class="pg-btn-demo ' + sizeClass + '" style="background:' + bg + ';color:' + color + ';border-radius:' + radius + ';' + shadow + border + '" ' + feedbackAttr + '>';
        if (a.btnIconPos === 'left' && iconHtml) btnHtml += iconHtml;
        btnHtml += textHtml;
        if (a.btnIconPos === 'right' && iconHtml) btnHtml += iconHtml;
        btnHtml += '</div>';

        // 次要按钮
        var secBtnHtml = '<div class="pg-btn-demo ' + sizeClass + '" style="background:rgba(0,0,0,0.05);color:' + COLORS.textSecondary + ';border-radius:' + radius + ';" ' + feedbackAttr + '>次要按钮</div>';
        // 危险按钮
        var dangerBtnHtml = '<div class="pg-btn-demo ' + sizeClass + '" style="background:' + COLORS.danger + ';color:white;border-radius:' + radius + ';' + (a.btnShadow ? 'box-shadow:0 4px 14px rgba(255,59,48,0.3);' : '') + '" ' + feedbackAttr + '>删除</div>';

        el.innerHTML = btnHtml + secBtnHtml + dangerBtnHtml;
    };

    // ============ 导航栏预览更新（新增） ============
    PromptGenApp.prototype.updateNavbarPreview = function() {
        var el = this.appWindow.querySelector('#pg-nav-preview');
        if (!el) return;
        var a = this.answers, prim = this.getResolvedPrimary();
        var matMap = {
            blur: 'background:rgba(255,255,255,0.7);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);',
            solid: 'background:white;',
            transparent: 'background:transparent;',
            gradient: 'background:linear-gradient(135deg,' + prim + ',' + COLORS.secondary + ');'
        };
        var matStyle = matMap[a.navMaterial] || matMap.blur;
        var textColor = (a.navMaterial === 'gradient' || a.navMaterial === 'transparent') ? 'white' : COLORS.textPrimary;
        var divider = a.navHasDivider ? 'border-bottom:1px solid rgba(0,0,0,0.06);' : '';
        var h = '<div class="pg-nav-preview" style="background:linear-gradient(135deg,#667eea,#764ba2);">';
        h += '<div class="pg-nav-inner" style="' + matStyle + divider + '">';

        if (a.navStyle === 'large-title') {
            h += '<div style="flex:1;"><div style="font-size:8px;color:' + textColor + ';opacity:0.6;">← 返回</div><div style="font-size:16px;font-weight:800;color:' + textColor + ';margin-top:2px;">大标题</div></div>';
        } else if (a.navStyle === 'center-title') {
            h += '<div style="font-size:8px;color:' + textColor + ';opacity:0.6;">←</div><div style="flex:1;text-align:center;font-size:13px;font-weight:700;color:' + textColor + ';">标题</div><div style="font-size:8px;color:' + textColor + ';opacity:0.6;">...</div>';
        } else if (a.navStyle === 'transparent') {
            h += '<div style="font-size:8px;color:white;opacity:0.8;">←</div><div style="flex:1;text-align:center;font-size:13px;font-weight:600;color:white;">沉浸式</div>';
        } else if (a.navStyle === 'gradient') {
            h += '<div style="flex:1;text-align:center;font-size:13px;font-weight:700;color:white;">渐变顶栏</div>';
        } else if (a.navStyle === 'segmented') {
            h += '<div style="flex:1;display:flex;justify-content:center;gap:0;"><div style="padding:4px 10px;background:' + prim + ';color:white;font-size:9px;font-weight:600;border-radius:6px 0 0 6px;">推荐</div><div style="padding:4px 10px;background:rgba(0,0,0,0.05);color:' + textColor + ';font-size:9px;border-radius:0 6px 6px 0;">最新</div></div>';
        } else if (a.navStyle === 'floating') {
            h += '<div style="flex:1;display:flex;justify-content:center;"><div style="padding:6px 20px;background:rgba(255,255,255,0.9);border-radius:20px;box-shadow:0 2px 10px rgba(0,0,0,0.1);font-size:11px;font-weight:600;color:' + COLORS.textPrimary + ';">悬浮胶囊</div></div>';
        }
        h += '</div>';
        if (a.navHasSearch) {
            h += '<div style="position:absolute;bottom:2px;left:12px;right:12px;height:14px;background:rgba(0,0,0,0.05);border-radius:4px;display:flex;align-items:center;padding:0 6px;"><div style="font-size:6px;color:#999;display:flex;align-items:center;gap:2px;"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> 搜索</div></div>';
        }
        h += '</div>';

        if (a.navEffect !== 'none') {
            var effectLabel = { parallax:'视差滚动', 'sticky-shrink':'粘性收缩', 'color-shift':'色彩渐变', jelly:'果冻回弹', 'blur-reveal':'模糊渐显' }[a.navEffect];
            h += '<div style="text-align:center;margin-top:4px;font-size:8px;color:' + COLORS.textSecondary + ';">滚动特效: ' + effectLabel + '</div>';
        }
        el.innerHTML = h;
    };

    // ============ 动效预览更新（新增） ============
    PromptGenApp.prototype.updateMotionPreview = function() {
        var el = this.appWindow.querySelector('#pg-motion-preview');
        if (!el) return;
        var a = this.answers, prim = this.getResolvedPrimary();
        var microClass = a.motionMicro !== 'none' ? a.motionMicro : '';
        var h = '';
        h += '<div class="pg-motion-demo ' + microClass + '" style="background:' + prim + ';display:flex;align-items:center;justify-content:center;"><span style="color:white;font-size:10px;font-weight:700;">点我</span></div>';
        // 加载状态预览
        h += '<div style="display:flex;flex-direction:column;align-items:center;gap:3px;">';
        if (a.motionLoading === 'skeleton') {
            h += '<div style="width:50px;height:8px;background:linear-gradient(90deg,rgba(0,0,0,0.06) 25%,rgba(0,0,0,0.1) 50%,rgba(0,0,0,0.06) 75%);background-size:200% 100%;animation:pgShimmer 1.5s infinite;border-radius:4px;"></div>';
            h += '<div style="width:36px;height:6px;background:linear-gradient(90deg,rgba(0,0,0,0.06) 25%,rgba(0,0,0,0.1) 50%,rgba(0,0,0,0.06) 75%);background-size:200% 100%;animation:pgShimmer 1.5s infinite 0.1s;border-radius:3px;"></div>';
        } else if (a.motionLoading === 'spinner') {
            h += '<div style="width:20px;height:20px;border:2px solid rgba(0,0,0,0.1);border-top-color:' + prim + ';border-radius:50%;animation:spin 0.8s linear infinite;"></div>';
            h += '<style>@keyframes spin{to{transform:rotate(360deg);}}</style>';
        } else if (a.motionLoading === 'shimmer') {
            h += '<div style="width:50px;height:20px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent);background-size:200% 100%;animation:pgShimmer 1.5s infinite;border-radius:4px;border:1px solid rgba(0,0,0,0.06);"></div>';
        } else if (a.motionLoading === 'dots') {
            h += '<div style="display:flex;gap:4px;">';
            for (var i = 0; i < 3; i++) h += '<div style="width:6px;height:6px;border-radius:50%;background:' + prim + ';animation:pgPulse 0.6s ease ' + (i*0.15) + 's infinite;"></div>';
            h += '</div>';
        }
        h += '<div style="font-size:7px;color:' + COLORS.textSecondary + ';">加载状态</div></div>';
        el.innerHTML = h;
    };

    // ============ 小组件预览更新 ============
    PromptGenApp.prototype.updateWidgetPreview = function() {
        var a = this.answers;
        var t1 = this.appWindow.querySelector('#pg-ws-prev-title');
        var c1 = this.appWindow.querySelector('#pg-ws-prev-content');
        if (t1) t1.textContent = a.widgetSmall.title || '标题';
        if (c1) c1.textContent = a.widgetSmall.content || '内容';
        var t2 = this.appWindow.querySelector('#pg-wm-prev-title');
        var c2 = this.appWindow.querySelector('#pg-wm-prev-content');
        if (t2) t2.textContent = a.widgetMedium.title || '标题';
        if (c2) c2.textContent = a.widgetMedium.content || '内容';
    };

    // ============ 小组件形状预览更新（新增） ============
    PromptGenApp.prototype.updateWidgetShapePreview = function() {
        var el = this.appWindow.querySelector('#pg-widget-shape-prev-inner');
        if (!el) return;
        // 移除所有形状类名，添加当前选择的
        var shapes = ['rounded-rect','circle','squircle','blob','pill','diamond'];
        shapes.forEach(function(s) { el.classList.remove('pg-widget-shape-' + s); });
        el.classList.add('pg-widget-shape-' + this.answers.widgetShape);
    };

    // ============ 灵动岛预览更新 ============
    PromptGenApp.prototype.updateIslandPreview = function() {
        var a = this.answers;
        var quietPrev = this.appWindow.querySelector('#pg-island-quiet-prev');
        if (quietPrev) {
            var qt = a.islandQuiet.content || '';
            quietPrev.innerHTML = qt ? '<div style="color:rgba(255,255,255,0.8);font-size:8px;text-align:center;">' + this.escHtml(qt).substring(0, 10) + '</div>' : '<div style="width:6px;height:6px;border-radius:50%;background:#4ade80;"></div>';
        }
        var miniPrev = this.appWindow.querySelector('#pg-island-mini-prev');
        if (miniPrev) miniPrev.innerHTML = '<div style="color:white;font-size:9px;">' + this.escHtml(a.islandMini.content || 'Mini') + '</div>';
        var medPrev = this.appWindow.querySelector('#pg-island-med-prev');
        if (medPrev) {
            var mh = '<div style="color:white;font-size:10px;font-weight:600;">' + this.escHtml(a.islandMedium.title || '标题') + '</div>';
            mh += '<div style="color:rgba(255,255,255,0.6);font-size:8px;margin-top:2px;">' + this.escHtml(a.islandMedium.subtitle || '副标题') + '</div>';
            if (a.islandMedium.hasProgress) mh += '<div style="margin-top:4px;height:2px;background:rgba(255,255,255,0.2);border-radius:1px;"><div style="width:45%;height:100%;background:white;border-radius:1px;"></div></div>';
            if (a.islandMedium.hasControls) {
                mh += '<div style="display:flex;justify-content:center;gap:12px;margin-top:5px;">';
                mh += '<div style="width:16px;height:16px;border-radius:50%;background:rgba(255,255,255,0.2);"></div>';
                mh += '<div style="width:20px;height:20px;border-radius:50%;background:rgba(255,255,255,0.3);"></div>';
                mh += '<div style="width:16px;height:16px;border-radius:50%;background:rgba(255,255,255,0.2);"></div></div>';
            }
            medPrev.innerHTML = mh;
        }
        var largePrevWrap = this.appWindow.querySelector('#pg-island-large-prev-wrap');
        var largePrev = this.appWindow.querySelector('#pg-island-large-prev');
        if (largePrevWrap) largePrevWrap.style.display = a.islandLarge.enabled ? 'block' : 'none';
        if (largePrev && a.islandLarge.enabled) {
            var lh = '<div style="color:white;font-size:10px;font-weight:600;">' + this.escHtml(a.islandLarge.title || '标题') + '</div>';
            lh += '<div style="color:rgba(255,255,255,0.6);font-size:8px;margin-top:2px;">' + this.escHtml(a.islandLarge.content || '内容') + '</div>';
            largePrev.innerHTML = lh;
        }
    };

    PromptGenApp.prototype.escHtml = function(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    };

    // ============ 事件绑定 ============
    PromptGenApp.prototype.bindEvents = function() {
        var self = this;

        // 折叠组件事件
        this.appWindow.querySelectorAll('.pg-collapse-header').forEach(function(header) {
            header.onclick = function() {
                var collapse = header.parentElement;
                collapse.classList.toggle('open');
            };
        });

        // 通用选项
        this.appWindow.querySelectorAll('.pg-options-list .pg-option').forEach(function(el) {
            el.onclick = function() {
                var parent = el.parentElement;
                var stepIdx = parseInt(parent.getAttribute('data-step'), 10);
                var field = parent.getAttribute('data-field');
                var val = el.getAttribute('data-value');
                if (field) {
                    parent.querySelectorAll('.pg-option').forEach(function(o) { o.classList.remove('selected'); });
                    el.classList.add('selected');
                    self.answers[field] = val;
                    if (field === 'palette') {
                        var cp = self.appWindow.querySelector('#pg-custom-palette');
                        if (cp) cp.style.display = val === 'custom' ? 'block' : 'none';
                        self.updatePalettePreview();
                    }
                    return;
                }
                var stepData = WIZARD_STEPS[stepIdx];
                if (!stepData) return;
                if (stepData.type === 'multi') {
                    el.classList.toggle('selected');
                    var feats = [];
                    parent.querySelectorAll('.pg-option.selected').forEach(function(o) { feats.push(o.getAttribute('data-value')); });
                    self.answers.features = feats;
                }
            };
        });

        // 风格网格
        this.appWindow.querySelectorAll('.pg-style-card').forEach(function(el) {
            el.onclick = function() {
                el.parentElement.querySelectorAll('.pg-style-card').forEach(function(c) { c.classList.remove('selected'); });
                el.classList.add('selected');
                self.answers.style = el.getAttribute('data-value');
            };
        });

        // 弹窗行选项
        this.appWindow.querySelectorAll('.pg-modal-row .pg-option').forEach(function(el) {
            el.onclick = function() {
                var row = el.parentElement, field = row.getAttribute('data-field');
                row.querySelectorAll('.pg-option').forEach(function(o) { o.classList.remove('selected'); });
                el.classList.add('selected');
                self.answers[field] = el.getAttribute('data-value');
                self.updateModalPreview();
            };
        });

        // 圆角
        this.appWindow.querySelectorAll('.pg-corner-item').forEach(function(el) {
            el.onclick = function() {
                el.parentElement.querySelectorAll('.pg-corner-item').forEach(function(c) { c.classList.remove('selected'); });
                el.classList.add('selected');
                self.answers.corner = el.getAttribute('data-value');
                self.updateCornerPreview();
            };
        });

        // 列表
        this.appWindow.querySelectorAll('.pg-list-item').forEach(function(el) {
            el.onclick = function() {
                el.parentElement.querySelectorAll('.pg-list-item').forEach(function(c) { c.classList.remove('selected'); });
                el.classList.add('selected');
                self.answers.listLayout = el.getAttribute('data-value');
                self.updateListPreviews();
            };
        });

        // ===== 通用 header-grid 选项绑定（按钮、导航栏、动效等） =====
        this.appWindow.querySelectorAll('.pg-header-grid .pg-header-item').forEach(function(el) {
            el.onclick = function() {
                var grid = el.parentElement, field = grid.getAttribute('data-field');
                grid.querySelectorAll('.pg-header-item').forEach(function(c) { c.classList.remove('selected'); });
                el.classList.add('selected');
                if (field) self.answers[field] = el.getAttribute('data-value');
                // 触发对应预览更新
                if (field === 'btnShape' || field === 'btnSize' || field === 'btnFeedback') self.updateButtonPreview();
                if (field === 'navStyle' || field === 'navEffect') self.updateNavbarPreview();
                if (field === 'motionCurve' || field === 'motionTransition' || field === 'motionMicro' || field === 'motionLoading') self.updateMotionPreview();
                if (field === 'widgetShape') self.updateWidgetShapePreview();
                if (field === 'typoFamily') self.updateTypographyPreview();
                if (field === 'cardShadow' || field === 'cardBorder' || field === 'cardBackground') self.updateCardDesignPreview();
                if (field === 'tabIconStyle' || field === 'tabAnimation' || field === 'tabBadge') self.updateTabbarPreview();
                if (field === 'iconStyle') self.updateIconStylePreview();
                if (field === 'density' || field === 'darkMode' || field === 'emptyState' || field === 'inputStyle') self.updateDensityPreview();
            };
        });

        // 通用 layout-grid 选项绑定
        this.appWindow.querySelectorAll('.pg-layout-grid .pg-layout-item').forEach(function(el) {
            el.onclick = function() {
                var grid = el.parentElement, field = grid.getAttribute('data-field');
                grid.querySelectorAll('.pg-layout-item').forEach(function(c) { c.classList.remove('selected'); });
                el.classList.add('selected');
                var val = el.getAttribute('data-value');
                if (field === 'btnIconPos') { self.answers.btnIconPos = val; self.updateButtonPreview(); }
                else if (field === 'navMaterial') { self.answers.navMaterial = val; self.updateNavbarPreview(); }
                else if (field === 'motionScroll') { self.answers.motionScroll = val; }
                else if (field === 'tabMaterial') { self.answers.tabMaterial = val; self.updateTabbarPreview(); }
                else if (grid.id === 'pg-wm-layout') { self.answers.widgetMedium.layout = val; }
                else if (grid.id === 'pg-wl-layout') { self.answers.widgetLarge.layout = val; }
            };
        });

        // 三列网格选项
        this.appWindow.querySelectorAll('.pg-grid-3 .pg-header-item').forEach(function(el) {
            el.onclick = function() {
                var grid = el.parentElement, field = grid.getAttribute('data-field');
                grid.querySelectorAll('.pg-header-item').forEach(function(c) { c.classList.remove('selected'); });
                el.classList.add('selected');
                if (field) self.answers[field] = el.getAttribute('data-value');
                if (field === 'btnSize') self.updateButtonPreview();
                if (field === 'typoScale' || field === 'typoWeight' || field === 'typoLineHeight') self.updateTypographyPreview();
                if (field === 'cardPadding') self.updateCardDesignPreview();
                if (field === 'tabIconStyle' || field === 'tabMaterial' || field === 'tabBadge') self.updateTabbarPreview();
                if (field === 'iconWeight') self.updateIconStylePreview();
                if (field === 'density' || field === 'darkMode' || field === 'emptyState' || field === 'inputStyle') self.updateDensityPreview();
            };
        });

        // ===== 按钮设计开关 =====
        var btnShadowToggle = this.appWindow.querySelector('#pg-btn-shadow-toggle');
        if (btnShadowToggle) btnShadowToggle.onclick = function() {
            self.answers.btnShadow = !self.answers.btnShadow;
            btnShadowToggle.classList.toggle('on', self.answers.btnShadow);
            self.updateButtonPreview();
        };
        var btnGradientToggle = this.appWindow.querySelector('#pg-btn-gradient-toggle');
        if (btnGradientToggle) btnGradientToggle.onclick = function() {
            self.answers.btnGradient = !self.answers.btnGradient;
            btnGradientToggle.classList.toggle('on', self.answers.btnGradient);
            self.updateButtonPreview();
        };

        // ===== 导航栏开关 =====
        var navSearchToggle = this.appWindow.querySelector('#pg-nav-search-toggle');
        if (navSearchToggle) navSearchToggle.onclick = function() {
            self.answers.navHasSearch = !self.answers.navHasSearch;
            navSearchToggle.classList.toggle('on', self.answers.navHasSearch);
            self.updateNavbarPreview();
        };
        var navDividerToggle = this.appWindow.querySelector('#pg-nav-divider-toggle');
        if (navDividerToggle) navDividerToggle.onclick = function() {
            self.answers.navHasDivider = !self.answers.navHasDivider;
            navDividerToggle.classList.toggle('on', self.answers.navHasDivider);
            self.updateNavbarPreview();
        };

        // ===== 子页面导航栏开关 =====
        var detailAvatarToggle = this.appWindow.querySelector('#pg-detail-avatar-toggle');
        if (detailAvatarToggle) detailAvatarToggle.onclick = function() {
            self.answers.detailNavAvatar = !self.answers.detailNavAvatar;
            detailAvatarToggle.classList.toggle('on', self.answers.detailNavAvatar);
        };
        var detailSubtitleToggle = this.appWindow.querySelector('#pg-detail-subtitle-toggle');
        if (detailSubtitleToggle) detailSubtitleToggle.onclick = function() {
            self.answers.detailNavSubtitle = !self.answers.detailNavSubtitle;
            detailSubtitleToggle.classList.toggle('on', self.answers.detailNavSubtitle);
        };

        // ===== 动效触觉反馈开关 =====
        var hapticToggle = this.appWindow.querySelector('#pg-motion-haptic-toggle');
        if (hapticToggle) hapticToggle.onclick = function() {
            self.answers.motionHaptic = !self.answers.motionHaptic;
            hapticToggle.classList.toggle('on', self.answers.motionHaptic);
        };

        // ===== Tab栏中心按钮开关 =====
        var tabCenterToggle = this.appWindow.querySelector('#pg-tab-center-toggle');
        if (tabCenterToggle) tabCenterToggle.onclick = function() {
            self.answers.tabCenterBtn = !self.answers.tabCenterBtn;
            tabCenterToggle.classList.toggle('on', self.answers.tabCenterBtn);
            self.updateTabbarPreview();
        };

        // 结构选择
        this.appWindow.querySelectorAll('.pg-struct-btn').forEach(function(el) {
            el.onclick = function() {
                self.appWindow.querySelectorAll('.pg-struct-btn').forEach(function(b) { b.classList.remove('selected'); });
                el.classList.add('selected');
                self.answers.structure = el.getAttribute('data-value');
                if (el.getAttribute('data-value') === 'single' && self.answers.pages.length > 1) {
                    self.answers.pages = [self.answers.pages[0]];
                    self.renderPagesList();
                }
            };
        });

        // 页面列表事件
        var pagesList = this.appWindow.querySelector('#pg-pages-list');
        if (pagesList) {
            pagesList.addEventListener('input', function(e) {
                var item = e.target.closest('.pg-page-item');
                if (!item) return;
                var idx = parseInt(item.getAttribute('data-idx'), 10);
                var field = e.target.getAttribute('data-field');
                if (field && self.answers.pages[idx]) self.answers.pages[idx][field] = e.target.value;
            });
            pagesList.addEventListener('click', function(e) {
                var delBtn = e.target.closest('.pg-page-del');
                if (delBtn) { self.answers.pages.splice(parseInt(delBtn.getAttribute('data-idx'), 10), 1); self.renderPagesList(); }
            });
        }
        var addBtn = this.appWindow.querySelector('#pg-page-add');
        if (addBtn) addBtn.onclick = function() {
            if (self.answers.structure === 'single' && self.answers.pages.length >= 1) { self.notifyWarning('单页面模式只能有1个页面'); return; }
            self.answers.pages.push({ name: '', desc: '' });
            self.renderPagesList();
        };

        // 颜色选择器
        ['bg','card','prim','accent'].forEach(function(key) {
            var inp = self.appWindow.querySelector('#pg-c-' + key);
            var hex = self.appWindow.querySelector('#pg-c-' + key + '-hex');
            if (inp) inp.oninput = function() {
                var map = { bg:'customBg', card:'customCard', prim:'customPrim', accent:'customAccent' };
                self.answers[map[key]] = inp.value;
                if (hex) hex.textContent = inp.value.toUpperCase();
                self.updatePalettePreview();
            };
        });

        this.selectDefaultOptions();

        // ===== 小组件事件 =====
        var widgetYes = this.appWindow.querySelector('#pg-widget-yes');
        var widgetNo = this.appWindow.querySelector('#pg-widget-no');
        if (widgetYes) widgetYes.onclick = function() { self.answers.needWidget = true; widgetYes.classList.add('selected'); widgetNo.classList.remove('selected'); };
        if (widgetNo) widgetNo.onclick = function() { self.answers.needWidget = false; widgetNo.classList.add('selected'); widgetYes.classList.remove('selected'); };

        // 小组件类型多选
        this.appWindow.querySelectorAll('#pg-widget-type-tags .pg-tag').forEach(function(tag) {
            tag.onclick = function() {
                tag.classList.toggle('selected');
                var types = [];
                self.appWindow.querySelectorAll('#pg-widget-type-tags .pg-tag.selected').forEach(function(t) { types.push(t.getAttribute('data-value')); });
                self.answers.widgetTypes = types;
                var ss = self.appWindow.querySelector('#pg-widget-small-section');
                var ms = self.appWindow.querySelector('#pg-widget-medium-section');
                var ls = self.appWindow.querySelector('#pg-widget-large-section');
                if (ss) ss.style.display = types.indexOf('small') !== -1 ? 'block' : 'none';
                if (ms) ms.style.display = types.indexOf('medium') !== -1 ? 'block' : 'none';
                if (ls) ls.style.display = types.indexOf('large') !== -1 ? 'block' : 'none';
            };
        });

        // Widget 输入同步
        self.bindFieldSync('#pg-ws-title', 'widgetSmall', 'title');
        self.bindFieldSync('#pg-ws-content', 'widgetSmall', 'content');
        self.bindFieldSync('#pg-ws-icon', 'widgetSmall', 'icon');
        self.bindFieldSync('#pg-ws-desc', 'widgetSmall', 'desc');
        self.bindFieldSync('#pg-wm-title', 'widgetMedium', 'title');
        self.bindFieldSync('#pg-wm-content', 'widgetMedium', 'content');
        self.bindFieldSync('#pg-wm-icon', 'widgetMedium', 'icon');
        self.bindFieldSync('#pg-wm-desc', 'widgetMedium', 'desc');
        self.bindFieldSync('#pg-wl-title', 'widgetLarge', 'title');
        self.bindFieldSync('#pg-wl-content', 'widgetLarge', 'content');
        self.bindFieldSync('#pg-wl-desc', 'widgetLarge', 'desc');

        // ===== 灵动岛事件 =====
        var islandYes = this.appWindow.querySelector('#pg-island-yes');
        var islandNo = this.appWindow.querySelector('#pg-island-no');
        if (islandYes) islandYes.onclick = function() { self.answers.needIsland = true; islandYes.classList.add('selected'); islandNo.classList.remove('selected'); };
        if (islandNo) islandNo.onclick = function() { self.answers.needIsland = false; islandNo.classList.add('selected'); islandYes.classList.remove('selected'); };

        self.bindFieldSync('#pg-island-quiet-input', 'islandQuiet', 'content');
        self.bindFieldSync('#pg-island-quiet-desc', 'islandQuiet', 'desc');
        self.bindFieldSync('#pg-island-mini-input', 'islandMini', 'content');
        self.bindFieldSync('#pg-island-mini-desc', 'islandMini', 'desc');
        self.bindFieldSync('#pg-island-med-title', 'islandMedium', 'title');
        self.bindFieldSync('#pg-island-med-sub', 'islandMedium', 'subtitle');
        self.bindFieldSync('#pg-island-med-desc', 'islandMedium', 'desc');
        self.bindFieldSync('#pg-island-large-title', 'islandLarge', 'title');
        self.bindFieldSync('#pg-island-large-content', 'islandLarge', 'content');
        self.bindFieldSync('#pg-island-large-desc', 'islandLarge', 'desc');

        var progressToggle = this.appWindow.querySelector('#pg-island-progress');
        if (progressToggle) progressToggle.onclick = function() { self.answers.islandMedium.hasProgress = !self.answers.islandMedium.hasProgress; progressToggle.classList.toggle('on', self.answers.islandMedium.hasProgress); self.updateIslandPreview(); };
        var controlsToggle = this.appWindow.querySelector('#pg-island-controls');
        if (controlsToggle) controlsToggle.onclick = function() { self.answers.islandMedium.hasControls = !self.answers.islandMedium.hasControls; controlsToggle.classList.toggle('on', self.answers.islandMedium.hasControls); self.updateIslandPreview(); };
        var largeToggle = this.appWindow.querySelector('#pg-island-large-toggle');
        if (largeToggle) largeToggle.onclick = function() { self.answers.islandLarge.enabled = !self.answers.islandLarge.enabled; largeToggle.classList.toggle('on', self.answers.islandLarge.enabled); var sec = self.appWindow.querySelector('#pg-island-large-section'); if (sec) sec.style.display = self.answers.islandLarge.enabled ? 'block' : 'none'; self.updateIslandPreview(); };

        this.appWindow.querySelectorAll('#pg-notify-types .pg-toggle').forEach(function(toggle) {
            toggle.onclick = function() { var key = toggle.getAttribute('data-notify'); if (key) { self.answers.islandNotify[key] = !self.answers.islandNotify[key]; toggle.classList.toggle('on', self.answers.islandNotify[key]); } };
        });

        // ===== 导航 =====
        var nextBtn = this.appWindow.querySelector('#pg-next-btn');
        var backBtn = this.appWindow.querySelector('#pg-back-btn');
        if (nextBtn) nextBtn.addEventListener('click', function(e) {
            e.preventDefault(); e.stopPropagation();
            self.syncAnswersFromDOM();
            if (self.validateStep()) {
                var curStep = WIZARD_STEPS[self.currentStep];
                if (curStep && curStep.id === 'widget-toggle' && !self.answers.needWidget) self.currentStep += 2;
                else if (curStep && curStep.id === 'island-toggle' && !self.answers.needIsland) self.currentStep += 2;
                else self.currentStep++;
                if (self.currentStep >= WIZARD_STEPS.length) { self.currentStep = WIZARD_STEPS.length; self.generatePrompt(); }
                self.updateUI();
            }
        });
        if (backBtn) backBtn.addEventListener('click', function(e) {
            e.preventDefault(); e.stopPropagation();
            if (self.currentStep === WIZARD_STEPS.length) { self.currentStep = 0; self.resetForm(); }
            else {
                var prevStep = self.currentStep - 1;
                if (prevStep >= 0) {
                    var ps = WIZARD_STEPS[prevStep];
                    if (ps && ps.id === 'island-design' && !self.answers.needIsland) prevStep--;
                    if (ps && ps.id === 'widget-design' && !self.answers.needWidget) prevStep--;
                }
                self.currentStep = Math.max(0, prevStep);
            }
            self.updateUI();
        });

        // 复制
        var copyBtn = this.appWindow.querySelector('#pg-copy-btn');
        if (copyBtn) copyBtn.onclick = function() {
            var raw = self.appWindow.querySelector('#pg-result-raw');
            if (raw && raw.value) {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(raw.value).then(function() { self.notifySuccess('提示词已复制'); });
                } else { raw.style.position = 'static'; raw.select(); try { document.execCommand('copy'); self.notifySuccess('提示词已复制'); } catch(e) {} raw.style.position = 'absolute'; }
            }
        };

        // 输入框
        var nameInput = this.appWindow.querySelector('#appName');
        var idInput = this.appWindow.querySelector('#appId');
        var descInput = this.appWindow.querySelector('#appDesc');
        if (nameInput) nameInput.oninput = function() { self.answers.appName = this.value; };
        if (idInput) idInput.oninput = function() { self.answers.appId = this.value; };
        if (descInput) descInput.oninput = function() { self.answers.appDesc = this.value; };
    };

    // 输入字段同步辅助
    PromptGenApp.prototype.bindFieldSync = function(selector, group, field) {
        var self = this;
        var el = this.appWindow.querySelector(selector);
        if (el) el.oninput = function() {
            self.answers[group][field] = el.value;
            self.updateWidgetPreview();
            self.updateIslandPreview();
        };
    };

    PromptGenApp.prototype.syncAnswersFromDOM = function() {
        var n = this.appWindow.querySelector('#appName'), i = this.appWindow.querySelector('#appId'), d = this.appWindow.querySelector('#appDesc');
        if (n) this.answers.appName = (n.value || '').trim();
        if (i) this.answers.appId = (i.value || '').trim();
        if (d) this.answers.appDesc = (d.value || '').trim();
    };

    PromptGenApp.prototype.loadFullSpec = function() {
        var self = this;
        if (typeof window.PROMPT_SPEC_FULL === 'string' && window.PROMPT_SPEC_FULL.length > 100) { self.fullPromptSpec = window.PROMPT_SPEC_FULL; return; }
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '其他/提示词.txt', true);
        xhr.onreadystatechange = function() { if (xhr.readyState === 4 && xhr.status === 200 && xhr.responseText) self.fullPromptSpec = xhr.responseText; };
        try { xhr.send(); } catch(e) {}
    };

    PromptGenApp.prototype.selectDefaultOptions = function() {
        var sc = this.appWindow.querySelectorAll('.pg-style-card');
        if (sc.length > 0) { sc.forEach(function(c) { c.classList.remove('selected'); }); sc[0].classList.add('selected'); }
    };

    PromptGenApp.prototype.validateStep = function() {
        if (this.currentStep === 0) {
            if (!this.answers.appName || !this.answers.appId) { this.notifyWarning('请填写App名称和ID'); return false; }
        }
        if (this.currentStep === 1) {
            var valid = this.answers.pages.every(function(p) { return p.name && p.name.trim(); });
            if (!valid) { this.notifyWarning('请填写每个页面的名称'); return false; }
        }
        var curStep = WIZARD_STEPS[this.currentStep];
        if (curStep && curStep.id === 'widget-design' && this.answers.widgetTypes.length === 0) {
            this.notifyWarning('请至少选择一种小组件尺寸'); return false;
        }
        return true;
    };

    PromptGenApp.prototype.resetForm = function() {
        this.answers = this.getDefaultAnswers();
        this.appWindow.querySelectorAll('input[type="text"],textarea').forEach(function(i) { if (i.id !== 'pg-result-raw') i.value = ''; });
        this.selectDefaultOptions();
        this.appWindow.querySelectorAll('.pg-corner-item,.pg-list-item').forEach(function(el) { el.classList.remove('selected'); });
        var dc = this.appWindow.querySelector('.pg-corner-item[data-value="medium"]'); if (dc) dc.classList.add('selected');
        var dl = this.appWindow.querySelector('.pg-list-item[data-value="card"]'); if (dl) dl.classList.add('selected');
        this.appWindow.querySelectorAll('.pg-modal-row').forEach(function(row) {
            var f = row.getAttribute('data-field'), dv = { modalStyle:'center', modalClose:'overlay', modalRadius:'large' }[f];
            row.querySelectorAll('.pg-option').forEach(function(o) { o.classList.toggle('selected', o.getAttribute('data-value') === dv); });
        });
        var po = this.appWindow.querySelectorAll('[data-field="palette"] .pg-option');
        po.forEach(function(o) { o.classList.toggle('selected', o.getAttribute('data-value') === 'auto'); });
        var cp = this.appWindow.querySelector('#pg-custom-palette'); if (cp) cp.style.display = 'none';
        // 重置所有 header-grid 默认值
        var defaults = { btnShape:'rounded', btnSize:'medium', btnFeedback:'scale', navStyle:'large-title', navEffect:'none', motionCurve:'spring', motionTransition:'slide', motionMicro:'jelly', motionLoading:'skeleton', widgetShape:'rounded-rect', typoFamily:'system', typoScale:'standard', typoWeight:'medium', typoLineHeight:'normal', cardShadow:'medium', cardBorder:'none', cardPadding:'standard', cardBackground:'solid', tabIconStyle:'outlined', tabMaterial:'blur', tabAnimation:'scale', tabBadge:'dot', iconStyle:'outlined', iconWeight:'regular', density:'standard', darkMode:'none', emptyState:'minimal', inputStyle:'border', detailNavLayout:'inline', detailNavActions:'right', segmentStyle:'pill', segmentPosition:'below-nav', segmentAnimation:'spring' };
        for (var field in defaults) {
            var grid = this.appWindow.querySelector('[data-field="' + field + '"]');
            if (grid) grid.querySelectorAll('.pg-header-item').forEach(function(el) { el.classList.toggle('selected', el.getAttribute('data-value') === defaults[field]); });
        }
        // 重置 layout-grid 默认值
        var layoutDefaults = { btnIconPos:'left', navMaterial:'blur', motionScroll:'parallax' };
        for (var lf in layoutDefaults) {
            var lg = this.appWindow.querySelector('[data-field="' + lf + '"]');
            if (lg) lg.querySelectorAll('.pg-layout-item').forEach(function(el) { el.classList.toggle('selected', el.getAttribute('data-value') === layoutDefaults[lf]); });
        }
        // 重置开关
        var toggleDefaults = { 'pg-btn-shadow-toggle': true, 'pg-btn-gradient-toggle': false, 'pg-nav-search-toggle': false, 'pg-nav-divider-toggle': true, 'pg-motion-haptic-toggle': true, 'pg-tab-center-toggle': false, 'pg-detail-avatar-toggle': true, 'pg-detail-subtitle-toggle': true };
        for (var tid in toggleDefaults) {
            var tel = this.appWindow.querySelector('#' + tid);
            if (tel) tel.classList.toggle('on', toggleDefaults[tid]);
        }
        this.appWindow.querySelectorAll('.pg-struct-btn').forEach(function(b) { b.classList.toggle('selected', b.getAttribute('data-value') === 'tab'); });
        // 重置小组件和灵动岛
        this.appWindow.querySelectorAll('.pg-choice-card').forEach(function(c) { c.classList.remove('selected'); });
        var wn = this.appWindow.querySelector('#pg-widget-no'); if (wn) wn.classList.add('selected');
        var in2 = this.appWindow.querySelector('#pg-island-no'); if (in2) in2.classList.add('selected');
        this.appWindow.querySelectorAll('#pg-widget-type-tags .pg-tag').forEach(function(t) { t.classList.remove('selected'); });
        ['#pg-widget-small-section','#pg-widget-medium-section','#pg-widget-large-section'].forEach(function(sel) { var e = this.appWindow.querySelector(sel); if (e) e.style.display = 'none'; }.bind(this));
        this.appWindow.querySelectorAll('#pg-notify-types .pg-toggle').forEach(function(t) { t.classList.add('on'); });
        ['#pg-island-progress','#pg-island-controls','#pg-island-large-toggle'].forEach(function(sel) { var e = this.appWindow.querySelector(sel); if (e) e.classList.remove('on'); }.bind(this));
        var lsec = this.appWindow.querySelector('#pg-island-large-section'); if (lsec) lsec.style.display = 'none';
    };

    // ============ 生成提示词 ============
    PromptGenApp.prototype.generatePrompt = function() {
        var a = this.answers;
        var appId = a.appId;
        var appClassName = appId.replace(/(^|-)(\w)/g, function(m, sep, c) { return c.toUpperCase(); }) + 'App';

        var styleStep = WIZARD_STEPS[2];
        var styleConfig = styleStep.options.filter(function(o) { return o.value === a.style; })[0] || styleStep.options[0];
        var fc;
        if (a.palette === 'custom') fc = { bg: a.customBg, card: a.customCard, prim: a.customPrim, accent: a.customAccent };
        else fc = { bg: styleConfig.colors.bg, card: styleConfig.colors.card, prim: styleConfig.colors.prim, accent: '#FF9500' };

        var cornerMap = { small:'4~8px', medium:'10~14px', large:'18~24px', pill:'全圆角(50px+)' };
        var listMap = { card:'卡片式（圆角阴影独立卡片）', list:'列表式（分割线分隔）', waterfall:'瀑布流（双列不等高）', grid:'宫格式（等比网格）' };

        var p = '# 虚拟手机App生成请求 (v6.0标准)\n\n';
        p += '你是一个专业的虚拟手机应用开发专家。请**严格遵循下方完整规范**，为我编写一个完整的 Javascript 代码。\n\n';

        // 一、基本信息
        p += '## 一、基本信息\n';
        p += '- **App名称**: ' + a.appName + '\n';
        p += '- **App ID**: `' + appId + '`\n';
        p += '- **构造函数名**: `' + appClassName + '`\n';
        if (a.appDesc) p += '- **功能描述**: ' + a.appDesc + '\n';

        // 二、页面结构
        p += '\n## 二、页面结构\n';
        p += '- **结构类型**: ' + (a.structure === 'tab' ? '底部Tab导航（多页面）' : '单页面工具') + '\n';
        a.pages.forEach(function(pg, i) { p += '  ' + (i + 1) + '. **' + pg.name + '**' + (pg.desc ? ' — ' + pg.desc : '') + '\n'; });

        // 三、视觉风格
        p += '\n## 三、视觉风格\n';
        p += '- **设计语言**: ' + styleConfig.title + ' (' + styleConfig.desc + ')\n';
        p += '  - 背景色: `' + fc.bg + '`\n  - 卡片色: `' + fc.card + '`\n  - 主色调: `' + fc.prim + '`\n  - 强调色: `' + fc.accent + '`\n';

        // 四、圆角规范
        p += '\n## 四、圆角规范\n';
        p += '- 全局圆角: **' + cornerMap[a.corner] + '**\n';
        if (a.corner === 'pill') p += '- 按钮使用胶囊形状（height/2 作为 border-radius）\n';

        // 四.5、字体排版系统
        p += '\n## 四(附)、字体排版系统 (Typography System)\n';
        var typoFamilyMap = { system:'系统默认 (-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)', rounded:'圆体 (SF Pro Rounded, "Nunito", "Varela Round", sans-serif)', serif:'衬线体 (Georgia, "Noto Serif SC", "Source Han Serif", serif)', mono:'等宽体 (SF Mono, Menlo, "Fira Code", monospace)', handwritten:'手写体 ("Caveat", "Ma Shan Zheng", cursive)', geometric:'几何体 ("Poppins", "Futura", "Montserrat", sans-serif)' };
        var typoScaleMap = { compact:'紧凑 (body: 13px, h1: 22px, caption: 10px, 适合信息密集型)', standard:'标准 (body: 15px, h1: 28px, caption: 12px, iOS默认比例)', relaxed:'宽松 (body: 17px, h1: 34px, caption: 13px, 适合阅读型)' };
        var typoWeightMap = { light:'轻盈 (标题: 500, 正文: 300, 辅助: 200, 适合优雅简约风)', medium:'适中 (标题: 700, 正文: 400~500, 辅助: 400, iOS默认)', bold:'厚重 (标题: 800~900, 正文: 600, 辅助: 500, 适合强调型)' };
        var typoLineHeightMap = { tight:'紧密 (line-height: 1.2, 适合标题和紧凑布局)', normal:'正常 (line-height: 1.5, 通用默认)', loose:'宽松 (line-height: 1.8, 适合长文阅读)' };
        p += '- **字体风格**: ' + typoFamilyMap[a.typoFamily] + '\n';
        p += '- **字号比例**: ' + typoScaleMap[a.typoScale] + '\n';
        p += '- **字重偏好**: ' + typoWeightMap[a.typoWeight] + '\n';
        p += '- **行高**: ' + typoLineHeightMap[a.typoLineHeight] + '\n';

        // 四.6、卡片设计系统
        p += '\n## 四(附二)、卡片设计系统 (Card Design System)\n';
        var cardShadowMap = { none:'无阴影 (box-shadow: none, 扁平风格)', light:'轻阴影 (box-shadow: 0 2px 8px rgba(0,0,0,0.04))', medium:'标准阴影 (box-shadow: 0 4px 16px rgba(0,0,0,0.08))', deep:'深阴影 (box-shadow: 0 8px 32px rgba(0,0,0,0.12))' };
        var cardBorderMap = { none:'无边框', hairline:'细线边框 (border: 1px solid rgba(0,0,0,0.06))', gradient:'渐变边框 (border-image: linear-gradient(135deg, 主色, 辅助色) 1, 或 background-clip 技巧)', dashed:'虚线边框 (border: 1.5px dashed rgba(0,0,0,0.1))' };
        var cardPaddingMap = { compact:'紧凑 (padding: 8~10px)', standard:'标准 (padding: 14~16px)', spacious:'宽敞 (padding: 20~24px)' };
        var cardBgMap = { solid:'纯色 (background: 卡片色)', gradient:'渐变 (background: linear-gradient(135deg, 卡片色, 主色10%透明度))', glass:'毛玻璃 (background: rgba(255,255,255,0.6), backdrop-filter: blur(20px))', image:'背景图 (background-image + overlay 遮罩)' };
        p += '- **卡片阴影**: ' + cardShadowMap[a.cardShadow] + '\n';
        p += '- **卡片边框**: ' + cardBorderMap[a.cardBorder] + '\n';
        p += '- **卡片内间距**: ' + cardPaddingMap[a.cardPadding] + '\n';
        p += '- **卡片背景**: ' + cardBgMap[a.cardBackground] + '\n';

        // 五、按钮设计系统（新增）
        p += '\n## 五、按钮设计系统 (Button Design System)\n';
        var btnShapeMap = { rounded:'圆角矩形 (Rounded Rect, border-radius: 10px)', pill:'胶囊按钮 (Capsule/Pill, border-radius: height/2)', squircle:'超椭圆 (Squircle, iOS连续圆角, border-radius: 18px)', ghost:'幽灵按钮 (Ghost, 无背景仅文字, background: transparent)', outlined:'描边按钮 (Outlined, 2px border + transparent bg)', fab:'FAB浮动按钮 (Floating Action Button, 圆形, position: fixed)' };
        var btnSizeMap = { small:'Small (height: 28~32px, font-size: 12px, padding: 6px 14px)', medium:'Medium (height: 36~40px, font-size: 14px, padding: 8px 20px)', large:'Large (height: 44~50px, font-size: 16px, padding: 12px 28px)' };
        var btnFeedbackMap = { scale:'缩放回弹 (transform: scale(0.96) → scale(1), transition: 0.15s cubic-bezier(0.34,1.56,0.64,1))', ripple:'涟漪扩散 (Material Design Ripple, 伪元素圆形扩散动画, background: radial-gradient)', glow:'光晕脉冲 (box-shadow 呼吸动画, 0→20px→0 spread, 主色调40%透明度)', bounce:'果冻弹跳 (Jelly Bounce, scaleX(1.15,0.85)→scaleY(0.85,1.15)→1, 0.6s)', none:'无反馈 (Static)', highlight:'高亮变色 (Highlight Tint, 背景色加深15%, filter: brightness(0.85))' };
        var btnIconMap = { left:'左侧图标 + 右侧文字 (flex-direction: row, gap: 6px)', right:'左侧文字 + 右侧图标 (flex-direction: row-reverse)', only:'纯图标按钮 (仅SVG图标, 正方形, aspect-ratio: 1)', none:'无图标 (纯文字按钮)' };
        p += '- **按钮形态**: ' + btnShapeMap[a.btnShape] + '\n';
        p += '- **按钮尺寸**: ' + btnSizeMap[a.btnSize] + '\n';
        p += '- **点击反馈**: ' + btnFeedbackMap[a.btnFeedback] + '\n';
        p += '- **图标位置**: ' + btnIconMap[a.btnIconPos] + '\n';
        p += '- **按钮投影**: ' + (a.btnShadow ? '开启 (box-shadow: 0 4px 14px 主色调40%透明度)' : '关闭') + '\n';
        p += '- **渐变填充**: ' + (a.btnGradient ? '开启 (linear-gradient(135deg, 主色调, 辅助色))' : '关闭 (纯色填充)') + '\n';
        p += '- 按钮层级：Primary(主色填充) > Secondary(浅色背景) > Tertiary(Ghost/Outlined) > Destructive(红色)\n';
        p += '- 所有按钮必须有 `cursor: pointer` 和 `:active` 状态反馈\n';
        if (a.btnFeedback === 'ripple') {
            p += '- Ripple 实现：按钮 `position: relative; overflow: hidden;`，点击时创建 `::after` 伪元素，`border-radius: 50%; background: rgba(255,255,255,0.3); animation: ripple 0.6s ease-out;`\n';
        }

        // 六、弹窗设计
        p += '\n## 六、弹窗设计\n';
        var modalPosMap = { center:'居中弹出', bottom:'底部滑出(Action Sheet)', fullscreen:'全屏覆盖' };
        var modalCloseMap = { overlay:'仅点击遮罩关闭', button:'仅关闭按钮（SVG X 图标）', both:'遮罩+关闭按钮均可关闭' };
        var modalRadiusMap = { small:'8px', medium:'16px', large:'24px' };
        p += '- 弹窗位置: **' + modalPosMap[a.modalStyle] + '**\n';
        p += '- 关闭方式: **' + modalCloseMap[a.modalClose] + '**\n';
        if (a.modalClose === 'button' || a.modalClose === 'both') p += '  - SVG: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`\n';
        p += '- 弹窗圆角: **' + modalRadiusMap[a.modalRadius] + '**\n';
        p += '- 遮罩: `rgba(0,0,0,0.4)` + `backdrop-filter: blur(4px)`\n';

        // 七、列表布局
        p += '\n## 七、列表布局\n';
        p += '- 列表样式: **' + listMap[a.listLayout] + '**\n';

        // 八、导航栏设计（专业级）
        p += '\n## 八、导航栏设计系统 (Navigation Design System)\n';
        var navStyleMap = { 'large-title':'iOS Large Title（大标题，滚动时缩小为 inline 标题，font-size: 34px→17px）', 'center-title':'经典居中导航栏（Center Navigation Bar, 标题居中, 左右操作按钮）', transparent:'透明沉浸式（Immersive Header, background: transparent, 内容延伸到状态栏下方）', gradient:'渐变色顶栏（Gradient Header, linear-gradient(135deg, 主色, 辅助色)）', segmented:'分段控制导航（Segmented Control, 顶部嵌入 UISegmentedControl 风格切换）', floating:'悬浮胶囊导航（Floating Capsule, 居中悬浮, border-radius: 20px, box-shadow）' };
        var navMatMap = { blur:'毛玻璃材质 (backdrop-filter: blur(20px) saturate(180%), background: rgba(255,255,255,0.72))', solid:'纯色实底 (background: white, box-shadow: 0 1px 0 rgba(0,0,0,0.06))', transparent:'全透明 (background: transparent, 无边框无阴影)', gradient:'渐变色材质 (linear-gradient(135deg, 主色, 辅助色), color: white)' };
        var navEffectMap = { none:'无特效 (Static)', parallax:'视差滚动 (Parallax Scroll, 背景图以0.5x速率滚动, transform: translateY(scrollY * 0.5))', 'sticky-shrink':'粘性收缩 (Sticky Shrink, 大标题→小标题平滑过渡, height: 96px→44px)', 'color-shift':'色彩渐变 (Color Shift, 滚动时导航栏背景从透明渐变为实色, opacity: 0→1)', jelly:'果冻回弹 (Jelly Overscroll, 下拉超出时导航栏弹性拉伸, transform: scaleY(1.1)→1)', 'blur-reveal':'模糊渐显 (Blur Reveal, 滚动时 backdrop-filter 从 blur(0)→blur(20px) 渐变)' };
        p += '- **导航栏形态**: ' + navStyleMap[a.navStyle] + '\n';
        p += '- **导航栏材质**: ' + navMatMap[a.navMaterial] + '\n';
        p += '- **滚动交互特效**: ' + navEffectMap[a.navEffect] + '\n';
        p += '- **内嵌搜索栏**: ' + (a.navHasSearch ? '开启（导航栏下方集成搜索框, 滚动时收起）' : '关闭') + '\n';
        p += '- **底部分割线**: ' + (a.navHasDivider ? '开启 (border-bottom: 1px solid rgba(0,0,0,0.06), hairline)' : '关闭') + '\n';
        if (a.navStyle === 'floating') p += '- 悬浮胶囊实现：`position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); padding: 8px 24px; border-radius: 20px; background: rgba(255,255,255,0.9); box-shadow: 0 4px 16px rgba(0,0,0,0.1);`\n';
        if (a.navEffect === 'jelly') p += '- 果冻回弹实现：监听 `scroll` 事件，当 `scrollTop < 0` 时，导航栏 `transform: scaleY(1 + Math.abs(scrollTop) / 200)`，释放后 `transition: transform 0.5s cubic-bezier(0.34,1.56,0.64,1)` 回弹\n';

        // 子页面/详情页导航栏
        p += '\n### 子页面 / 详情页导航栏 (Detail Navigation Bar)\n';
        var detailLayoutMap = { inline:'单行紧凑 (返回按钮 + 头像 + 标题 + 操作按钮全部在同一行, flex, align-items: center, gap: 8px)', stacked:'双行分层 (第一行: 返回按钮独占; 第二行: 头像 + 标题 + 操作按钮, 类似iOS大标题详情页)', minimal:'极简 (仅返回箭头 + 居中标题, 无头像无副标题)' };
        var detailActionsMap = { right:'右侧操作按钮 (标准iOS布局, 右侧放置1~3个图标按钮)', both:'两侧操作按钮 (左侧返回旁可放额外按钮, 右侧放主要操作)', none:'无操作按钮 (纯标题导航, 仅返回箭头)' };
        p += '- **布局模式**: ' + detailLayoutMap[a.detailNavLayout] + '\n';
        p += '- **显示头像**: ' + (a.detailNavAvatar ? '开启 (标题左侧显示32px圆形头像, border-radius: 50%)' : '关闭') + '\n';
        p += '- **显示副标题**: ' + (a.detailNavSubtitle ? '开启 (标题下方显示小字副标题/状态, font-size: 12px, color: 次要文字色)' : '关闭') + '\n';
        p += '- **操作按钮位置**: ' + detailActionsMap[a.detailNavActions] + '\n';
        if (a.detailNavLayout === 'inline') p += '- 单行布局实现：`<div style="display:flex;align-items:center;gap:8px;padding:8px 16px;">` 返回按钮 + 头像 + 标题区(flex:1) + 操作按钮\n';

        // 分段控制栏
        p += '\n### 分段控制栏 / 标签页切换 (Segmented Control)\n';
        var segStyleMap = { pill:'胶囊滑块 (背景: rgba(0,0,0,0.06), 选中项: 白色圆角滑块, box-shadow, 滑块跟随切换平滑移动)', underline:'下划线 (选中项底部2~3px主色下划线, 下划线跟随切换滑动, translateX过渡)', block:'色块填充 (选中项: 主色背景+白色文字, 未选中: 透明背景+灰色文字, border-radius统一)', chip:'标签胶囊 (独立胶囊标签, 选中: 主色背景, 未选中: 浅灰背景, 各标签间有gap间距)' };
        var segPosMap = { 'below-nav':'导航栏下方独立一行 (sticky, 滚动时可吸顶)', 'inside-nav':'嵌入导航栏内部 (替代标题位置, 节省垂直空间)', 'sticky-top':'吸顶悬浮 (position: sticky, top: 导航栏高度, z-index: 10, 带毛玻璃背景)' };
        var segAnimMap = { slide:'滑动 (指示器/滑块 translateX 平滑过渡, transition: 0.3s ease)', fade:'渐变 (内容区 opacity 淡入淡出切换, transition: 0.2s)', spring:'弹簧 (指示器移动使用 cubic-bezier(0.34,1.56,0.64,1) 弹簧曲线)' };
        p += '- **切换栏样式**: ' + segStyleMap[a.segmentStyle] + '\n';
        p += '- **切换栏位置**: ' + segPosMap[a.segmentPosition] + '\n';
        p += '- **切换动画**: ' + segAnimMap[a.segmentAnimation] + '\n';
        if (a.segmentStyle === 'pill') p += '- 胶囊滑块实现：外层 `background: rgba(0,0,0,0.06); border-radius: 8px; padding: 2px;`，内部滑块 `position: absolute; background: white; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1);`\n';

        // 八.5、Tab栏设计系统
        p += '\n## 八(附)、Tab栏设计系统 (Tab Bar Design)\n';
        var tabIconMap = { outlined:'线性图标 (stroke-only SVG, 选中时填充)', filled:'填充图标 (filled SVG, 选中时加粗/变色)', duotone:'双色调图标 (主体+阴影双层, 选中时高亮主层)' };
        var tabMatMap = { blur:'毛玻璃 (backdrop-filter: blur(20px), background: rgba(255,255,255,0.8))', solid:'纯色实底 (background: white, border-top: 1px solid rgba(0,0,0,0.06))', transparent:'全透明 (background: transparent, 悬浮于内容之上)' };
        var tabAnimMap = { scale:'缩放 (选中图标 transform: scale(1.15), 0.2s spring)', slide:'滑动指示 (底部指示条跟随选中项滑动, translateX 过渡)', fade:'渐变 (未选中 opacity: 0.5, 选中 opacity: 1 + 主色)', bounce:'弹跳 (选中时 translateY(-4px) 弹跳动画, 0.4s)' };
        var tabBadgeMap = { dot:'小红点 (6px 圆形, background: #FF3B30, 右上角偏移)', number:'数字徽标 (min-width: 16px, 圆角矩形, 白色数字)', none:'无徽标' };
        p += '- **Tab图标风格**: ' + tabIconMap[a.tabIconStyle] + '\n';
        p += '- **Tab栏材质**: ' + tabMatMap[a.tabMaterial] + '\n';
        p += '- **切换动画**: ' + tabAnimMap[a.tabAnimation] + '\n';
        p += '- **徽标样式**: ' + tabBadgeMap[a.tabBadge] + '\n';
        p += '- **中心凸起按钮**: ' + (a.tabCenterBtn ? '开启 (中间Tab项为圆形凸起FAB, translateY(-12px), 主色背景, box-shadow)' : '关闭') + '\n';

        // 八.6、图标风格
        p += '\n## 八(附二)、图标风格 (Icon Style System)\n';
        var iconStyleMap = { outlined:'线性描边 (stroke-only, fill: none, 清晰简洁)', filled:'实心填充 (fill: currentColor, 视觉重量强)', duotone:'双色调 (主体100%不透明 + 背景20%不透明, 层次丰富)', rounded:'圆润线条 (stroke-linecap: round, stroke-linejoin: round)', sharp:'锐利直角 (stroke-linecap: butt, stroke-linejoin: miter)', broken:'断线风格 (线条在交叉处断开, 现代感强)' };
        var iconWeightMap = { thin:'纤细 (stroke-width: 1px, 优雅轻盈)', regular:'常规 (stroke-width: 1.5px, 标准可读)', bold:'粗壮 (stroke-width: 2.5px, 醒目有力)' };
        p += '- **图标线条风格**: ' + iconStyleMap[a.iconStyle] + '\n';
        p += '- **图标线条粗细**: ' + iconWeightMap[a.iconWeight] + '\n';
        p += '- 所有图标统一使用 SVG inline, viewBox="0 0 24 24", 确保风格一致\n';

        // 九、动效设计系统（新增）
        p += '\n## 九、动效设计系统 (Motion Design System)\n';
        var curveMap = { spring:'弹簧回弹 cubic-bezier(0.34, 1.56, 0.64, 1) — 适合按钮点击、卡片弹出', ease:'平滑缓动 ease-in-out — 适合页面过渡、渐变', sharp:'干脆利落 cubic-bezier(0.4, 0, 0.2, 1) — Material Design 标准', bounce:'弹跳落地 cubic-bezier(0.68, -0.55, 0.27, 1.55) — 适合元素入场', elastic:'弹性拉伸 cubic-bezier(0.175, 0.885, 0.32, 1.275) — 适合拖拽释放', smooth:'丝滑流畅 cubic-bezier(0.25, 0.1, 0.25, 1) — 适合滚动、滑动' };
        var transMap = { slide:'滑动推入 (translateX(100%)→0, 配合前一页 translateX(0)→-30%)', fade:'淡入淡出 (opacity: 0→1, 配合 scale(0.98)→1)', scale:'缩放弹出 (scale(0.85)→1 + opacity: 0→1)', flip:'翻转切换 (rotateY(90deg)→0, perspective: 1200px, 3D翻页效果)', morph:'形变过渡 (Shared Element Transition, 共享元素从列表位置平滑移动到详情位置)', parallax:'视差层叠 (前一页以0.3x速率退出, 新页面以1x速率推入, 层叠视差)' };
        var microMap = { jelly:'果冻Q弹 (Jelly Squish, @keyframes: scale(1)→(1.15,0.85)→(0.85,1.15)→(1.05,0.95)→1, 0.6s)', pulse:'脉冲呼吸 (Pulse Breathe, scale(1)→1.05→1, 0.4s ease, 适合加载指示器)', wiggle:'摇摆晃动 (Wiggle Shake, rotate(0)→-3deg→3deg→-1deg→0, 0.5s, 适合错误提示)', pop:'弹出缩放 (Pop Scale, scale(0.3)→1.05→0.9→1, 0.5s, 适合新元素出现)', none:'无微动效 (Static)', tilt:'倾斜透视 (3D Tilt, 鼠标/触摸位置计算 rotateX/Y, perspective: 800px, 卡片悬浮效果)' };
        var loadMap = { skeleton:'骨架屏 (Skeleton Screen, 灰色占位块 + shimmer 扫光动画, background-size: 200%)', spinner:'旋转指示器 (Spinner, border-top 旋转, animation: spin 0.8s linear infinite)', shimmer:'微光扫描 (Shimmer Effect, linear-gradient 从左到右扫描, 适合图片加载)', dots:'跳动圆点 (Bouncing Dots, 3个圆点依次 translateY(-6px), animation-delay 错开)' };
        var scrollMap = { parallax:'视差滚动 (Parallax, 不同层以不同速率滚动, transform: translateY(scrollY * rate))', 'fade-in':'渐显入场 (Fade In, IntersectionObserver 监听, opacity: 0→1 + translateY(20px)→0)', 'slide-up':'上滑入场 (Slide Up, 元素进入视口时 translateY(40px)→0, 0.5s)', none:'无滚动动效' };
        p += '- **全局缓动曲线**: ' + curveMap[a.motionCurve] + '\n';
        p += '- **页面过渡动画**: ' + transMap[a.motionTransition] + '\n';
        p += '- **微交互动效**: ' + microMap[a.motionMicro] + '\n';
        p += '- **加载状态**: ' + loadMap[a.motionLoading] + '\n';
        p += '- **滚动动效**: ' + scrollMap[a.motionScroll] + '\n';
        p += '- **触觉反馈**: ' + (a.motionHaptic ? '开启 (navigator.vibrate(10) 模拟轻触反馈)' : '关闭') + '\n';
        p += '- 所有动画 duration 建议：微交互 150~300ms，页面过渡 300~500ms，加载动画 800~1500ms\n';
        p += '- 遵循 `prefers-reduced-motion` 媒体查询，用户开启减弱动态效果时禁用非必要动画\n';

        // 九.5、信息密度与主题
        p += '\n## 九(附)、信息密度与主题 (Density & Theme)\n';
        var densityMap = { compact:'紧凑 (列表行高: 36px, 卡片间距: 6px, 适合信息密集型应用)', standard:'标准 (列表行高: 44px, 卡片间距: 10px, iOS默认间距)', comfortable:'舒适 (列表行高: 56px, 卡片间距: 16px, 大量留白, 适合阅读型)' };
        var darkModeMap = { none:'不支持暗色模式 (仅亮色主题)', support:'支持明暗切换 (提供 prefers-color-scheme 适配, 所有颜色定义 light/dark 两套变量)', 'default':'默认暗色 (Dark First, 亮色为可选切换)' };
        var emptyStateMap = { minimal:'极简文字 (居中灰色文字提示, font-size: 14px, color: #999)', illustration:'SVG插画 (居中矢量插画 + 文字说明 + 操作按钮)', icon:'大图标 (48px SVG图标 + 标题 + 描述文字, 垂直居中)' };
        var inputStyleMap = { border:'边框输入框 (border: 1px solid, border-radius, focus时border-color变主色)', underline:'下划线输入框 (仅底部border-bottom, Material风格, focus时下划线变粗变色)', filled:'填充底色输入框 (background: rgba(0,0,0,0.04), 无边框, focus时背景加深)' };
        p += '- **信息密度**: ' + densityMap[a.density] + '\n';
        p += '- **暗色模式**: ' + darkModeMap[a.darkMode] + '\n';
        p += '- **空状态设计**: ' + emptyStateMap[a.emptyState] + '\n';
        p += '- **输入框风格**: ' + inputStyleMap[a.inputStyle] + '\n';

        // 十、功能模块
        p += '\n## 十、功能模块\n';
        if (a.features.length === 0) p += '- 无特殊功能，实现基础UI即可\n';
        if (a.features.indexOf('ai') !== -1) p += '- [AI] 集成 `PhoneCore.api.chat` 智能对话\n';
        if (a.features.indexOf('db') !== -1) p += '- [DB] 集成 `PhoneCore.db` 数据持久化\n';
        if (a.features.indexOf('camera') !== -1) p += '- [Media] `input type="file"` 图片读取\n';
        if (a.features.indexOf('charts') !== -1) p += '- [Chart] 数据可视化\n';
        if (a.features.indexOf('search') !== -1) p += '- [Search] 全局搜索栏，支持实时过滤\n';
        if (a.features.indexOf('pull-refresh') !== -1) p += '- [PullRefresh] 下拉刷新，带加载动画\n';
        if (a.features.indexOf('dark-toggle') !== -1) p += '- [DarkToggle] 明暗主题一键切换按钮\n';
        if (a.features.indexOf('gesture') !== -1) p += '- [Gesture] 手势操作（滑动删除、长按排序）\n';
        if (a.features.indexOf('share') !== -1) p += '- [Share] 内容分享面板（模拟 iOS Share Sheet）\n';
        if (a.features.indexOf('favorite') !== -1) p += '- [Favorite] 收藏/点赞交互（带动画反馈）\n';
        if (a.features.indexOf('onboarding') !== -1) p += '- [Onboarding] 首次使用引导页（轮播式引导流程）\n';
        if (a.features.indexOf('notification') !== -1) p += '- [Notification] 应用内通知提示（顶部横幅或灵动岛）\n';
        if (a.features.indexOf('settings') !== -1) p += '- [Settings] 设置页面（偏好设置、关于信息）\n';
        if (a.features.indexOf('login') !== -1) p += '- [Login] 登录注册流程（表单验证、状态管理）\n';

        // 十一、小组件
        p += '\n## 十一、小组件（Widget）\n';
        p += this.generateWidgetSection(a, appClassName, fc);

        // 十二、灵动岛
        p += '\n## 十二、灵动岛（Dynamic Island）\n';
        p += this.generateIslandSection(a, appClassName, fc);

        // 十三、代码生成要求
        p += '\n## 十三、代码生成要求\n';
        if (a.structure === 'tab') p += '使用 **Tab模板**：构造函数 `tabs: []`，自定义底部导航栏（毛玻璃），`display:none/block` 切换。\n';
        else p += '使用 **基础模板**：单一主内容区域，顶部 Header + 中间滚动列表。\n';
        p += '直接生成 `js/' + appId + '.js`，包含详细中文注释。\n\n';
        p += '---\n\n## 十四、完整开发规范（v6.0 全文）\n\n';
        if (this.fullPromptSpec && this.fullPromptSpec.length > 100) p += this.fullPromptSpec;
        else p += '（规范未加载，请通过 Live Server 打开页面）\n';

        this.generatedPrompt = p;
        var raw = this.appWindow.querySelector('#pg-result-raw');
        if (raw) raw.value = p;
        this.renderResultPreview();
    };

    // ============ 生成小组件代码段（增强异形） ============
    PromptGenApp.prototype.generateWidgetSection = function(a, appClassName, fc) {
        var p = '';
        if (!a.needWidget || a.widgetTypes.length === 0) { p += '此App不需要桌面小组件。\n'; return p; }

        var shapeMap = { 'rounded-rect':'圆角矩形 (border-radius: 14px)', circle:'圆形 (border-radius: 50%)', squircle:'超椭圆 (border-radius: 22px, iOS连续圆角)', blob:'有机形态 (border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%, 不规则有机曲线)', pill:'胶囊形 (border-radius: 36px)', diamond:'菱形 (transform: rotate(45deg), 内容反向旋转-45deg)' };
        p += '此App需要桌面小组件。\n\n';
        p += '### 小组件外形\n';
        p += '- **形状**: ' + shapeMap[a.widgetShape] + '\n';
        p += '- 注意：小组件在桌面网格中的占位尺寸不变（遵循 small/medium/large 标准尺寸），仅视觉外形轮廓改变\n';
        if (a.widgetShape === 'blob') p += '- Blob 形状需要 `overflow: hidden` 确保内容不溢出，建议内容居中布局\n';
        if (a.widgetShape === 'diamond') p += '- 菱形实现：外层 `transform: rotate(45deg)`，内层 `transform: rotate(-45deg)` 保持内容正向\n';
        p += '\n### renderWidget 方法\n\n';
        p += '```javascript\n';
        p += appClassName + '.prototype.initWidgets = function() {\n';
        a.widgetTypes.forEach(function(size) { p += '    this.createWidget(\'' + size + '\');\n'; });
        p += '};\n\n';
        p += appClassName + '.prototype.renderWidget = function(size, data) {\n';
        p += '    var self = this;\n';
        var primColor = fc.prim;

        if (a.widgetTypes.indexOf('small') !== -1) {
            var ws = a.widgetSmall;
            p += '    if (size === \'small\') {\n';
            p += '        return \'<div style="padding:12px;height:100%;display:flex;flex-direction:column;justify-content:space-between;">\' +\n';
            p += '            \'<div style="font-size:11px;color:#86868B;">' + (ws.title || '标题') + '</div>\' +\n';
            p += '            \'<div style="font-size:24px;font-weight:700;color:' + primColor + ';">\' + (self.getWidgetData() || \'0\') + \'</div>\' +\n';
            p += '        \'</div>\';\n    }\n';
        }
        if (a.widgetTypes.indexOf('medium') !== -1) {
            var wm = a.widgetMedium;
            p += '    if (size === \'medium\') {\n';
            p += '        return \'<div style="padding:12px;height:100%;display:flex;' + (wm.layout === 'horizontal' ? 'align-items:center;gap:12px;' : 'flex-direction:column;justify-content:space-between;') + '">\' +\n';
            p += '            \'<div style="font-size:11px;color:#86868B;">' + (wm.title || '标题') + '</div>\' +\n';
            p += '            \'<div style="font-size:14px;font-weight:600;color:#1D1D1F;">\' + (self.getWidgetData() || \'' + (wm.content || '内容') + '\') + \'</div>\' +\n';
            p += '        \'</div>\';\n    }\n';
        }
        if (a.widgetTypes.indexOf('large') !== -1) {
            var wl = a.widgetLarge;
            p += '    if (size === \'large\') {\n';
            p += '        return \'<div style="padding:14px;height:100%;display:flex;' + (wl.layout === 'horizontal' ? 'align-items:center;gap:14px;' : 'flex-direction:column;justify-content:space-between;') + '">\' +\n';
            p += '            \'<div style="font-size:12px;color:#86868B;">' + (wl.title || '标题') + '</div>\' +\n';
            p += '            \'<div style="font-size:15px;font-weight:600;color:#1D1D1F;">\' + (self.getWidgetData() || \'' + (wl.content || '内容') + '\') + \'</div>\' +\n';
            p += '        \'</div>\';\n    }\n';
        }
        p += '    return \'<div style="padding:15px;height:100%;display:flex;align-items:center;justify-content:center;color:#666;">小组件</div>\';\n';
        p += '};\n\n';
        p += appClassName + '.prototype.getWidgetData = function() { return null; };\n';
        p += '```\n';
        p += '\n### 小组件尺寸对照\n';
        p += '| 尺寸 | CSS类名 | Grid跨度 | 说明 |\n|------|---------|----------|------|\n';
        p += '| small | widget-small | 2列×1行 | 高度80px |\n| medium | widget-medium | 2列×2行 | 高度170px |\n| large | widget-large | 4列×2行 | 高度170px，全宽 |\n';
        return p;
    };

    // ============ 生成灵动岛代码段 ============
    PromptGenApp.prototype.generateIslandSection = function(a, appClassName, fc) {
        var p = '';
        if (!a.needIsland) {
            p += '此App不需要灵动岛。仅使用基础通知方法：\n```javascript\nthis.notifySuccess(\'操作成功\');\nthis.notifyError(\'操作失败\');\nthis.notifyWarning(\'请注意\');\n```\n';
            return p;
        }
        var primColor = fc.prim;
        p += '此App需要灵动岛实时信息显示。\n\n';
        p += '### island 配置代码\n\n```javascript\nisland: {\n    state: {\n        title: \'' + (a.islandMedium.title || '运行中') + '\'';
        if (a.islandMedium.subtitle) p += ',\n        subtitle: \'' + a.islandMedium.subtitle + '\'';
        if (a.islandMedium.hasProgress) p += ',\n        progress: 0';
        p += '\n    },\n\n    render: function(mode, state, app) {\n';
        p += '        if (mode === \'quiet\') {\n            return \'<div style="display:flex;align-items:center;justify-content:center;height:100%;"><div style="width:8px;height:8px;background:' + primColor + ';border-radius:50%;animation:pulse 1.5s ease-in-out infinite;"></div></div>\';\n        }\n';
        p += '        if (mode === \'mini\') {\n            return \'<div style="display:flex;align-items:center;justify-content:center;height:100%;padding:0 16px;"><div style="color:white;font-size:12px;font-weight:500;">\' + state.title + \'</div></div>\';\n        }\n';
        p += '        if (mode === \'medium\') {\n            var html = \'<div style="padding:14px 18px;color:white;"><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;"><div style="width:32px;height:32px;border-radius:8px;background:' + primColor + ';"></div><div><div style="font-size:14px;font-weight:600;">\' + state.title + \'</div>';
        if (a.islandMedium.subtitle) p += '<div style="font-size:11px;color:rgba(255,255,255,0.6);">\' + (state.subtitle || \'\') + \'</div>';
        p += '</div></div>\';\n';
        if (a.islandMedium.hasProgress) p += '            html += \'<div style="height:3px;background:rgba(255,255,255,0.2);border-radius:2px;"><div style="width:\' + (state.progress || 0) + \'%;height:100%;background:white;border-radius:2px;"></div></div>\';\n';
        if (a.islandMedium.hasControls) p += '            html += \'<div style="display:flex;justify-content:center;gap:16px;margin-top:8px;"><div class="island-ctrl-prev" style="cursor:pointer;padding:4px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M19 20L9 12l10-8v16zM7 4h2v16H7V4z"/></svg></div><div class="island-ctrl-play" style="cursor:pointer;padding:4px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg></div><div class="island-ctrl-next" style="cursor:pointer;padding:4px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M5 4l10 8-10 8V4zm11 0h2v16h-2V4z"/></svg></div></div>\';\n';
        p += '            html += \'</div>\';\n            return html;\n        }\n';
        if (a.islandLarge.enabled) {
            p += '        if (mode === \'large\') {\n            return \'<div style="padding:16px 20px;color:white;"><div style="font-size:16px;font-weight:700;margin-bottom:8px;">\' + state.title + \'</div>';
            if (a.islandLarge.content) p += '<div style="font-size:12px;color:rgba(255,255,255,0.7);margin-bottom:10px;">' + a.islandLarge.content + '</div>';
            p += '</div>\';\n        }\n';
        }
        p += '        return \'\';\n    },\n\n';
        p += '    bindEvents: function(container, state, app) {\n';
        if (a.islandMedium.hasControls) p += '        /* 绑定控制按钮事件 */\n';
        else p += '        /* 如需交互按钮，在此绑定事件 */\n';
        p += '    },\n\n    onAppReady: function(appWindow, app) {\n        app.activateIsland();\n    }\n}\n```\n\n';
        p += '### 通知方法\n```javascript\n';
        if (a.islandNotify.success) p += 'this.notifySuccess(\'操作成功\');\n';
        if (a.islandNotify.error) p += 'this.notifyError(\'操作失败\');\n';
        if (a.islandNotify.warning) p += 'this.notifyWarning(\'请注意\');\n';
        if (a.islandNotify.info) p += 'this.notifyInfo(\'提示信息\');\n';
        p += '```\n';
        return p;
    };

    // ============ 结果预览渲染 ============
    PromptGenApp.prototype.renderResultPreview = function() {
        var el = this.appWindow.querySelector('#pg-result-preview');
        if (el && this.generatedPrompt) el.textContent = this.generatedPrompt;
    };

    // ============ 弹窗HTML ============
    PromptGenApp.prototype.renderModalHtml = function() {
        return '<div class="modal-overlay" id="pg-modal-overlay" style="display:none;"><div class="modal-content" id="pg-modal-content"></div></div>';
    };

    // ============ 导出 ============
    global.PromptGenApp = PromptGenApp;

    EventBus.on('core:initialized', function() {
        var app = new PromptGenApp();
        PhoneCore.registerApp(app);
    });

})(window);
