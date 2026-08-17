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
    createContentCardAction,
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

// 数据库（ESM）：建库 + 把实例挂到 window
import '@/js/db/index.js';

// 框架（ESM）：把所有 hook + core-shim 拉进来
//   - 自动 bootstrap（core-shim 监听 DOMContentLoaded 或 readyState）
import '@/js/framework/index.js';

// App Store 专属 liquid 底栏（依赖 framework 渲染 .app-tab-bar,放在 framework 之后）
import '@/js/framework/appstore-liquid-tab.js';

// 「灵动岛与小组件」总览中心（框架层通用页，App 只需放一个按钮）
import { installPresenceCenterDelegate } from '@/js/framework/presence-center.js';

// 预设库（卡片 / 布局 / 弹窗 / 灵动岛 / 小组件）
// ★ 必须在 apps/index.js 之前 install：App 的 setup() 里就可能取 window.__listenPresets
import { installPresets } from '@/src/core/presets/index.js';

// 插件安装器：用户上传的 / 「App 制作」生成的 App 都从这里进系统
import { restoreInstalledPlugins } from '@/src/core/plugin-installer.js';

installPresets();

// 应用（ESM）：apps/index.js 自己 for-await 加载所有 app 模块并 registerPhoneApp
import '@/js/apps/index.js';

// ============================================
// 初始化（这部分不需要等任何异步加载，所有依赖都是静态 import）
// ============================================
window.islandTemplates = createIslandTemplates();
ensureIslandTemplateStyles();

// ★ 必须在上面那行**之后**再补一次预设岛模板。
//   installPresets() 在模块加载时已经跑过一次（见 presets/index.js 末尾），
//   但上面是整体赋值 `window.islandTemplates = {...}`，会把那次挂上去的冲掉。
//   installPresets 是幂等的、而且只填空位，重复调不会覆盖核心模板。
installPresets();

// 「灵动岛与小组件」总览：装一个全局委托，
// 任何 App 放一个 <button data-presence-center="<appId>"> 就能进这个页面。
installPresenceCenterDelegate();

/**
 * 恢复用户装过的插件 App。
 *
 * ★ 这一步以前根本没人调 —— `restoreInstalledPlugins` 只被挂到
 *   `window.__restoreInstalledPlugins` 上，全项目没有第二处引用。
 *   表现是「装完能用，刷新就没了」，而元数据其实一直好端端存在 localStorage 里。
 *
 * 必须等内置 App 注册完再跑：插件如果和内置 App 撞 id，
 * 应该是内置的赢（插件安装器会报重名并跳过），顺序反了就成了插件覆盖系统 App。
 */
window.addEventListener('phone:apps-registered', () => {
    void restoreInstalledPlugins();
}, { once: true });

console.log('[小听] ES Module 已就绪');

// ============================================
// 兼容层：把 core 模块的常用导出挂到 window。
//
// 项目内的 App 之间走 import/export，用不到这一段。它存在是为了
// **用户上传的插件 App** —— 那些是运行时 import(blobURL) 加载的，
// 没有构建步骤，只能从 window 上取依赖。
// 预设库（window.__listenPresets）是同样的道理，见上面 installPresets()。
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
window.createContentCardAction = createContentCardAction;

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

    /**
     * 视口矮了多少才算「软键盘弹起来了」。
     * 地址栏收起、浏览器工具条这类变化通常只有几十像素，键盘至少两百往上。
     */
    const KEYBOARD_MIN_INSET = 120;

    /** 没有输入焦点时的视口高度，作为「键盘占了多高」的基准 */
    let baseViewportHeight = window.innerHeight;

    function isPhoneCaseHidden() {
        const phoneCase = document.querySelector('.phone-case');
        const phoneEl = document.getElementById('phone');
        return phoneEl?.classList.contains('phone--fullscreen') ||
               phoneCase?.classList.contains('phone-case--hidden');
    }

    /** 现在光标是不是在某个能打字的地方 */
    function isEditing() {
        const el = document.activeElement;
        if (!el || el === document.body) return false;
        const tag = el.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable === true;
    }

    /**
     * 软键盘占了多高（没弹键盘返回 0）。
     *
     * 两种浏览器行为都要认，这是修 bug 的关键：
     *   · iOS Safari —— layout viewport 不变，只有 visualViewport 变矮
     *   · 安卓 Chrome（默认 resize 模式）—— window.innerHeight **自己就变矮了**，
     *     visualViewport 跟着一起矮，两者一减是 0。只看 visualViewport 的话
     *     安卓上永远检测不到键盘，于是走进 recomputeScale 把整台手机缩小 ——
     *     这就是「murmur 打字时手机突然变小」的来源。
     *
     * 必须同时要求「有输入焦点」：否则旋转屏幕、浏览器地址栏伸缩也会被误判成键盘。
     */
    function keyboardInset() {
        if (!isEditing()) return 0;
        const vv = window.visualViewport;
        const vvInset = vv ? (window.innerHeight - (vv.height + vv.offsetTop)) : 0;
        const layoutInset = baseViewportHeight - window.innerHeight;
        const inset = Math.max(vvInset, layoutInset);
        return inset > KEYBOARD_MIN_INSET ? inset : 0;
    }

    function recomputeScale() {
        // 全屏/隐藏手机壳：不缩放，让 #phone 自己撑到视口
        if (isPhoneCaseHidden()) {
            root.style.setProperty('--phone-scale', '1');
            root.style.setProperty('--phone-keyboard-lift', '0px');
            return;
        }

        /**
         * ★ 键盘弹起时**不重算缩放**。
         *
         * 这是「在 murmur 打字时整台手机突然缩小一圈」的根因：安卓 Chrome 的
         * resize 模式下键盘弹起会把 window.innerHeight 也一起压矮，于是
         * scaleY = (vh - 16) / 590 掉下来，整台手机跟着缩。可屏幕并没有变小，
         * 只是被键盘盖住了一截 —— 该做的是把手机往上挪，不是缩。
         *
         * 上挪的量由 applyKeyboardLift 算，视觉上就是「整个手机往上抬一下，
         * 其他都不变」，和梦境编织里的手感一致。
         */
        if (keyboardInset() > 0) {
            applyKeyboardLift();
            return;
        }

        const vw = window.innerWidth;
        const vh = window.innerHeight;
        // 这一刻没有键盘，当前高度就是「基准高度」
        baseViewportHeight = vh;
        const scaleX = (vw - PHONE_PADDING) / PHONE_WIDTH;
        const scaleY = (vh - PHONE_PADDING) / PHONE_HEIGHT;
        const scale = Math.min(1, scaleX, scaleY);
        root.style.setProperty('--phone-scale', String(scale));
        root.style.setProperty('--phone-keyboard-lift', '0px');
    }

    /**
     * 键盘弹起时把整台手机往上挪，挪到「手机底边刚好在键盘上沿」。
     *
     * 只挪到够用为止，并且顶边不许出屏 —— 抬过头的话顶栏和状态栏会被切掉，
     * 那比被键盘盖住更难受。
     */
    function applyKeyboardLift() {
        if (isPhoneCaseHidden()) {
            root.style.setProperty('--phone-keyboard-lift', '0px');
            return;
        }
        const inset = keyboardInset();
        if (inset <= 0) {
            root.style.setProperty('--phone-keyboard-lift', '0px');
            return;
        }
        const scale = Number(root.style.getPropertyValue('--phone-scale')) || 1;
        const phoneH = PHONE_HEIGHT * scale;
        /**
         * 手机是 body 上 flex 居中的，所以它的位置由**当前** layout viewport 决定。
         * 安卓 resize 模式下 innerHeight 已经被键盘压矮，手机其实已经被浏览器
         * 自动往上挪了一截 —— 用 baseViewportHeight 算会重复抬一次、把顶栏顶飞。
         */
        const viewportH = window.innerHeight;
        const vv = window.visualViewport;
        // 可见区底边：iOS 是 visualViewport 变矮，安卓是 layout 自己就矮了
        const visibleBottom = vv ? Math.min(viewportH, vv.offsetTop + vv.height) : viewportH;
        const phoneBottom = viewportH / 2 + phoneH / 2;
        // 键盘上沿再留 6px，不要让输入框正贴着键盘
        const covered = phoneBottom - visibleBottom + 6;
        if (covered <= 0) {
            root.style.setProperty('--phone-keyboard-lift', '0px');
            return;
        }
        /**
         * 顶上还有多少余量。
         *   > 0：屏幕装得下整台手机 —— 最多抬到顶边留 8px，别把状态栏顶出去。
         *   ≤ 0：屏幕本来就装不下（小屏 + 大键盘）—— 顶部溢出是没办法的事，
         *        此刻用户盯着的是底部的输入框，优先保证它露出来。
         */
        const roomAtTop = viewportH / 2 - phoneH / 2 - 8;
        const lift = roomAtTop > 0 ? Math.min(covered, roomAtTop) : covered;
        root.style.setProperty('--phone-keyboard-lift', `${Math.round(Math.max(0, lift))}px`);
    }

    function onViewportChange() {
        // 键盘期间只调整位移，不动缩放；键盘收了才重算缩放
        if (keyboardInset() > 0) applyKeyboardLift();
        else recomputeScale();
    }

    recomputeScale();
    window.addEventListener('resize', onViewportChange, { passive: true });
    window.addEventListener('orientationchange', recomputeScale, { passive: true });
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', onViewportChange, { passive: true });
        // iOS 上键盘弹起改的是 offsetTop 而不是 height，只听 resize 会漏
        window.visualViewport.addEventListener('scroll', onViewportChange, { passive: true });
    }

    /**
     * 焦点进出输入框时也校一次。
     *
     * 键盘的出现和 resize 事件之间有几十到几百毫秒的空档（安卓尤其明显），
     * 只等 resize 的话会先看到手机缩一下再弹回来。focusout 之后延迟一点再校，
     * 是等浏览器把键盘收完、视口高度回到位。
     */
    document.addEventListener('focusin', () => {
        setTimeout(onViewportChange, 60);
        setTimeout(onViewportChange, 320);
    }, true);
    document.addEventListener('focusout', () => {
        setTimeout(() => {
            if (!isEditing()) recomputeScale();
        }, 120);
    }, true);

    // 监听 class 变化：隐藏手机壳时立即重算 scale
    if (typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(() => recomputeScale());
        const phoneEl = document.getElementById('phone');
        if (phoneEl) observer.observe(phoneEl, { attributes: true, attributeFilter: ['class'] });
        const phoneCase = document.querySelector('.phone-case');
        if (phoneCase) observer.observe(phoneCase, { attributes: true, attributeFilter: ['class'] });
    }

    // 调试 / 探针用
    if (typeof window !== 'undefined') {
        window.__phoneViewport = { recomputeScale, applyKeyboardLift, keyboardInset };
    }
})();