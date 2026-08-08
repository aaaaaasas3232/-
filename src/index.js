// ============================================
// 小听启动 - Vite 入口（ESM 全量版）
// 所有依赖都是静态 import，vite 会自动按依赖图加载。
// ============================================

// ============================================
// 核心启动加载器（必须最先运行，打印加载顺序日志）
// ============================================
import '@/js/framework/desktop-config.js';  // 桌面统一配置
import '@/js/framework/boot-loader.js';      // 启动日志

import { APP_ICONS, UI_ICONS, UI_TOKENS, UI_SYMBOLS } from '@/src/core/icons.js';
import { sharedIconLibrary } from '@/src/core/icon-library.js';
import {
    serializeAction,
    createActionAttr,
    createAppAction,
    createDetailAction,
    createModalAction,
    createOpenAppAction,
    createAppMethodAction,
    createDeepLinkAction,
    createShareRecordAction,
} from '@/src/core/actions.js';
import {
    renderChevronRow,
    renderSettingsGroup,
    renderActionButton,
    renderSurfaceCard,
    renderSectionShell,
} from '@/src/core/renderers.js';
import {
    createIslandTemplates,
    ensureIslandTemplateStyles,
} from '@/src/core/island-templates.js';
import { createIslandHelper as createIslandHelperForApp } from '@/src/core/island-helper.js';
import { appTemplates } from '@/src/core/templates.js';
import {
    createDefaultPageRenderer,
    createDefaultDetailRenderer,
} from '@/src/core/page-renderers.js';
import { createSettingsPageBuilder } from '@/src/core/icon-library.js';
import {
    APP_PAGE_CONTENT,
    DETAIL_PAGE_CONTENT,
    createAppRegistry,
    externalAppRegistry,
    registerPhoneApp,
} from '@/src/core/app-registry.js';
import { createTemplateApp } from '@/src/apps/template-app.js';

// 数据库（ESM）：建库 + 把实例挂到 window
import '@/js/db/index.js';

// 框架（ESM）：把所有 hook + core-shim 拉进来
//   - 自动 bootstrap（core-shim 监听 DOMContentLoaded 或 readyState）
import '@/js/framework/index.js';

// 应用（ESM）：apps/index.js 自己 for-await 加载所有 app 模块并 registerPhoneApp
import '@/js/apps/index.js';

// 通用 ColorPicker 组件：自动 mount 所有 [data-cp-mount] 节点
import { installColorPickerAutoMount } from '@/js/components/color-picker-auto.js';
installColorPickerAutoMount();

// ============================================
// 初始化（这部分不需要等任何异步加载，所有依赖都是静态 import）
// ============================================
window.islandTemplates = createIslandTemplates();
ensureIslandTemplateStyles();
registerPhoneApp(createTemplateApp());

console.log('[小听] ES Module 已就绪');

// ============================================
// 兼容层：把 core 模块的常用导出挂到 window。
// 原因：vite-plugin-auto-compat.js 在工程里不存在，
//       而 js/apps/prompt-survey.js 等文件里仍然用 window.xxx 调用。
//       这是临时兼容，不是"模块导出"——ESM 之间走 import/export。
//       prompt-survey.js 后续应改成 ESM 调用，再移除本段。
// ============================================
window.createActionAttr = createActionAttr;
window.createAppAction = createAppAction;
window.serializeAction = serializeAction;
window.createDefaultPageRenderer = createDefaultPageRenderer;
window.createDefaultDetailRenderer = createDefaultDetailRenderer;
window.createDetailAction = createDetailAction;
window.createOpenAppAction = createOpenAppAction;
window.createModalAction = createModalAction;
window.createAppMethodAction = createAppMethodAction;
window.createDeepLinkAction = createDeepLinkAction;
window.createShareRecordAction = createShareRecordAction;

// ============================================
// 手机壳等比缩放：保证在不同尺寸的手机上都能完整、居中显示
// 设计尺寸：390 x 590
// 当视口宽度 < 390 或高度 < 590 时，按比例缩放
// 隐藏手机壳（phone-case--hidden / phone--fullscreen）时跳过缩放，
// 让 #phone 直接撑到当前视口尺寸，宽高不再锁 390:590。
// ============================================
(function setupPhoneScaling() {
    const PHONE_WIDTH = 390;
    const PHONE_HEIGHT = 590;
    const PHONE_PADDING = 16;
    const root = document.documentElement;

    function isPhoneCaseHidden() {
        const phoneCase = document.querySelector('.phone-case');
        const phoneEl = document.getElementById('phone');
        return phoneEl?.classList.contains('phone--fullscreen') ||
               phoneCase?.classList.contains('phone-case--hidden');
    }

    function recomputeScale() {
        // 全屏/隐藏手机壳：不缩放，让 #phone 自己撑到视口
        if (isPhoneCaseHidden()) {
            root.style.setProperty('--phone-scale', '1');
            return;
        }
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const scaleX = (vw - PHONE_PADDING) / PHONE_WIDTH;
        const scaleY = (vh - PHONE_PADDING) / PHONE_HEIGHT;
        const scale = Math.min(1, scaleX, scaleY);
        root.style.setProperty('--phone-scale', String(scale));
    }

    recomputeScale();
    window.addEventListener('resize', recomputeScale, { passive: true });
    window.addEventListener('orientationchange', recomputeScale, { passive: true });
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', recomputeScale, { passive: true });
    }

    // 监听 class 变化：隐藏手机壳时立即重算 scale
    if (typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(() => recomputeScale());
        const phoneEl = document.getElementById('phone');
        if (phoneEl) observer.observe(phoneEl, { attributes: true, attributeFilter: ['class'] });
        const phoneCase = document.querySelector('.phone-case');
        if (phoneCase) observer.observe(phoneCase, { attributes: true, attributeFilter: ['class'] });
    }
})();