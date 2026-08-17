/**
 * ================================================================
 * 小听 Framework · 栏按钮渲染器
 * ---------------------------------------------------------------
 * 根据配置渲染顶部栏/底部栏按钮
 * Phase 2: 配置 Schema 升级
 * Phase 3: 支持异步 render
 * ================================================================
 */

import { escapeHtml } from '@/src/core/escape.js';
import { createActionAttr } from '@/src/core/actions.js';
import { safeRender } from './bar-context.js';

// ================================================================
// 图标渲染
// ================================================================

/**
 * 渲染按钮图标
 * @param {object} button - 按钮配置
 * @returns {string} HTML 字符串
 */
export function renderButtonIcon(button) {
  // iconHtml 优先（完整 HTML）
  if (button.iconHtml) {
    return button.iconHtml;
  }

  // icon 作为 emoji 或单字符
  if (button.icon) {
    return escapeHtml(button.icon);
  }

  return '';
}

/**
 * 渲染导航按钮图标（带 SVG 支持）
 * @param {object} button - 按钮配置
 * @returns {string} HTML 字符串
 */
export function renderNavButtonIcon(button) {
  // iconHtml 优先
  if (button.iconHtml) {
    return `<span class="tab-icon">${button.iconHtml}</span>`;
  }

  // SVG 图标映射
  const iconSvgs = {
    home: '<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"></path></svg>',
    search: '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"></path></svg>',
    settings: '<svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"></path></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"></path></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"></path></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path></svg>',
    calendar: '<svg viewBox="0 0 24 24"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"></path></svg>',
  };

  const iconName = button.icon;
  if (iconName && iconSvgs[iconName]) {
    return `<span class="tab-icon">${iconSvgs[iconName]}</span>`;
  }

  // emoji 或单字符
  if (iconName) {
    return `<span class="tab-icon">${escapeHtml(iconName)}</span>`;
  }

  return '';
}

// ================================================================
// 按钮属性
// ================================================================

/**
 * 获取按钮类名
 * @param {object} button - 按钮配置
 * @param {'left'|'right'|'nav'} position - 按钮位置
 * @param {boolean} isActive - 是否激活
 * @returns {string} class 字符串
 */
function getButtonClass(button, position, isActive = false) {
  const classes = [];

  // 位置类名
  if (position === 'nav') {
    classes.push('app-tab-item');
    if (isActive) classes.push('active');
  } else {
    classes.push('app-topbar-action');
    // variant
    if (button.variant === 'solid') {
      classes.push('app-topbar-action--solid');
    } else if (button.variant === 'bare') {
      classes.push('app-topbar-action--bare');
    } else {
      classes.push('app-topbar-action--glass');
    }
  }

  // 自定义类名
  if (button.className) {
    classes.push(button.className);
  }

  return classes.join(' ');
}

/**
 * 获取按钮内联样式
 * @param {object} button - 按钮配置
 * @returns {string} style 字符串
 */
function getButtonStyle(button) {
  const styles = [];

  if (button.size) {
    styles.push(`--btn-size: ${button.size}px`);
  }

  if (button.color) {
    styles.push(`color: ${button.color}`);
  }

  if (button.bg) {
    styles.push(`background: ${button.bg}`);
  }

  if (button.width) {
    styles.push(`width: ${button.width}px`);
  }

  return styles.length > 0 ? styles.join(';') : '';
}

// ================================================================
// 顶部栏按钮渲染
// ================================================================

/**
 * 渲染单个顶部栏按钮
 * @param {object} button - 按钮配置
 * @param {'left'|'right'} position - 按钮位置
 * @param {string} appId - App ID
 * @returns {string} HTML 字符串
 */
export function renderTopbarButton(button, position, appId) {
  // 不可见按钮不渲染
  if (button.visible === false) {
    return '';
  }

  const iconHtml = renderButtonIcon(button);
  const actionAttr = createActionAttr(button.action, appId);
  const className = getButtonClass(button, position);
  const style = getButtonStyle(button);

  // 标签内容
  const labelAttr = button.ariaLabel || button.label
    ? `aria-label="${escapeHtml(button.ariaLabel || button.label)}"`
    : '';

  const disabledAttr = button.disabled ? 'disabled' : '';

  return `
    <button type="button"
            class="${escapeHtml(className)}"
            data-bar-button-id="${escapeHtml(button.id)}"
            ${actionAttr}
            ${labelAttr}
            ${disabledAttr}
            ${style ? `style="${escapeHtml(style)}"` : ''}>
      ${iconHtml}
    </button>
  `.trim();
}

/**
 * 渲染一组顶部栏按钮
 * @param {Array<object>} buttons - 按钮配置数组
 * @param {'left'|'right'} position - 按钮位置
 * @param {string} appId - App ID
 * @param {number} buttonGap - 按钮间距
 * @returns {string} HTML 字符串
 */
export function renderTopbarButtons(buttons, position, appId, buttonGap = 8) {
  if (!Array.isArray(buttons) || buttons.length === 0) {
    return '';
  }

  const gapStyle = buttonGap !== 8 ? `style="gap: ${buttonGap}px"` : '';

  const buttonsHtml = buttons
    .filter(btn => btn.visible !== false)
    .map(btn => renderTopbarButton(btn, position, appId))
    .join('');

  return `
    <div class="app-topbar-${position}s" ${gapStyle}>
      ${buttonsHtml}
    </div>
  `.trim();
}

// ================================================================
// 底部栏按钮渲染
// ================================================================

/**
 * 渲染单个导航按钮
 * @param {object} button - 按钮配置
 * @param {string} appId - App ID
 * @param {boolean} isActive - 是否激活
 * @returns {string} HTML 字符串
 */
export function renderNavButton(button, appId, isActive = false) {
  // 不可见按钮不渲染
  if (button.visible === false) {
    return '';
  }

  const iconHtml = renderNavButtonIcon(button);
  const label = escapeHtml(button.label || '');
  const actionAttr = createActionAttr(button.action, appId);
  const className = getButtonClass(button, 'nav', isActive);
  const style = getButtonStyle(button);

  const ariaLabel = button.ariaLabel || button.label
    ? `aria-label="${escapeHtml(button.ariaLabel || button.label)}"`
    : '';

  const disabledAttr = button.disabled ? 'disabled' : '';

  return `
    <div class="${escapeHtml(className)}"
         data-bar-button-id="${escapeHtml(button.id)}"
         data-index="${button._index || 0}"
         ${actionAttr}
         ${ariaLabel}
         ${disabledAttr}
         ${style ? `style="${escapeHtml(style)}"` : ''}>
      ${iconHtml}
      ${label ? `<span>${label}</span>` : ''}
      ${renderBadge(button.badge)}
    </div>
  `.trim();
}

/**
 * 渲染徽章
 * @param {number|string|null} badge - 徽章数值
 * @returns {string} HTML 字符串
 */
function renderBadge(badge) {
  if (!badge && badge !== 0) {
    return '';
  }

  return `<span class="app-tab-badge" data-badge="${escapeHtml(String(badge))}">${escapeHtml(String(badge))}</span>`;
}

/**
 * 渲染一组导航按钮
 * @param {Array<object>} buttons - 按钮配置数组
 * @param {string} appId - App ID
 * @param {string} activeButtonId - 当前激活按钮 ID
 * @param {number} buttonGap - 按钮间距
 * @param {string} justifyContent - 对齐方式
 * @returns {string} HTML 字符串
 */
export function renderNavButtons(buttons, appId, activeButtonId = '', buttonGap = 12, justifyContent = 'space-around') {
  if (!Array.isArray(buttons) || buttons.length === 0) {
    return '';
  }

  const gapStyle = buttonGap !== 12 ? `--tabbar-button-gap: ${buttonGap}px` : '';
  const justifyStyle = justifyContent !== 'space-around' ? `justify-content: ${justifyContent}` : '';

  const style = [gapStyle, justifyStyle].filter(Boolean).join(';');

  const buttonsHtml = buttons
    .filter(btn => btn.visible !== false)
    .map((btn, index) => {
      const btnWithIndex = { ...btn, _index: index };
      return renderNavButton(btnWithIndex, appId, btn.id === activeButtonId);
    })
    .join('');

  return `
    <div class="app-tab-buttons" ${style ? `style="${escapeHtml(style)}"` : ''}>
      ${buttonsHtml}
    </div>
  `.trim();
}

// ================================================================
// 完整栏渲染
// ================================================================

/**
 * 渲染顶部栏
 * @param {object} config - 规范化后的 topbar 配置
 * @param {string} appId - App ID
 * @returns {string} HTML 字符串
 */
export function renderTopbar(config, appId) {
  if (!config || config.visible === false) {
    return '';
  }

  const { layout, title, subtitle, leftButtons, rightButtons, buttonGap = 8 } = config;

  // 渲染按钮
  const leftHtml = leftButtons?.length
    ? renderTopbarButtons(leftButtons, 'left', appId, buttonGap)
    : '';

  const rightHtml = rightButtons?.length
    ? renderTopbarButtons(rightButtons, 'right', appId, buttonGap)
    : '';

  // 渲染标题
  let titleHtml = '';
  if (title) {
    const titleText = typeof title === 'string' ? title : title.text;
    const titleColor = typeof title === 'object' ? title.color : config.color;
    const titleStyle = titleColor ? `style="color: ${escapeHtml(titleColor)}"` : '';
    titleHtml = `<span class="app-topbar-title" ${titleStyle}>${escapeHtml(titleText || '')}</span>`;
  }

  // 渲染副标题
  let subtitleHtml = '';
  if (subtitle) {
    subtitleHtml = `<span class="app-topbar-subtitle">${escapeHtml(subtitle)}</span>`;
  }

  // 根据 layout 组合
  let contentHtml = '';
  switch (layout) {
    case 'left-title-right':
      contentHtml = `${leftHtml}${titleHtml}${rightHtml}`;
      break;
    case 'title-left':
      contentHtml = `${titleHtml}${leftHtml}${rightHtml}`;
      break;
    case 'custom':
      // 自定义 layout，由 render 函数接管
      contentHtml = titleHtml;
      break;
    case 'center':
    default:
      contentHtml = `${leftHtml}${titleHtml}${rightHtml}`;
      break;
  }

  return `
    <div class="app-topbar">
      ${contentHtml}
      ${subtitleHtml}
    </div>
  `.trim();
}

/**
 * 渲染底部栏
 * @param {object} config - 规范化后的 nav 配置
 * @param {string} appId - App ID
 * @param {string} activeButtonId - 当前激活按钮 ID
 * @returns {string} HTML 字符串
 */
export function renderTabbar(config, appId, activeButtonId = '') {
  if (!config || config.type === 'none') {
    return '';
  }

  const { preset = 'default', buttons = [], buttonGap = 12, justifyContent = 'space-around', bg, color, height } = config;

  // 渲染按钮
  const buttonsHtml = renderNavButtons(buttons, appId, activeButtonId, buttonGap, justifyContent);

  // 容器样式
  const containerStyles = [];
  if (bg) containerStyles.push(`background: ${bg}`);
  if (color) containerStyles.push(`color: ${color}`);
  if (height) containerStyles.push(`height: ${height}px`);
  const containerStyle = containerStyles.length > 0 ? containerStyles.join(';') : '';

  return `
    <div class="app-tab-bar" data-preset="${escapeHtml(preset)}" ${containerStyle ? `style="${escapeHtml(containerStyle)}"` : ''}>
      ${buttonsHtml}
    </div>
  `.trim();
}

// ================================================================
// 预设初始化钩子
// ================================================================

/**
 * 获取预设的 CSS 类名
 * @param {string} preset - 预设名称
 * @returns {string} CSS 类名
 */
export function getPresetClass(preset) {
  if (!preset || preset === 'default') {
    return '';
  }
  return `app-tab-bar--${preset}`;
}

/**
 * 应用预设样式到容器
 * @param {HTMLElement} container - 容器元素
 * @param {object} presetConfig - 预设配置
 */
export function applyPresetStyles(container, presetConfig) {
  if (!container || !presetConfig) return;

  // 应用 CSS 变量
  if (presetConfig.bg) {
    container.style.setProperty('--tabbar-bg', presetConfig.bg);
  }
  if (presetConfig.color) {
    container.style.setProperty('--tabbar-color', presetConfig.color);
  }
  if (presetConfig.height) {
    container.style.setProperty('--tabbar-height', `${presetConfig.height}px`);
  }
  if (presetConfig.buttonGap) {
    container.style.setProperty('--tabbar-button-gap', `${presetConfig.buttonGap}px`);
  }

  // 预设特定的样式
  if (presetConfig.effect === 'liquid' && presetConfig.colors) {
    presetConfig.colors.forEach((color, i) => {
      container.style.setProperty(`--liquid-color-${i + 1}`, color);
    });
  }
}

// ================================================================
// 异步渲染（Phase 3: 彻底自定义支持）
// ================================================================

/**
 * 异步渲染顶部栏（支持自定义 render 钩子）
 * @param {object} options
 * @param {object} options.config - topbar 配置
 * @param {string} options.appId - App ID
 * @param {object} options.context - BarRenderContext
 * @returns {Promise<string>} HTML 字符串
 */
export async function renderTopbarAsync({ config, appId, context }) {
  if (!config || config.visible === false) {
    return '';
  }

  // 检测自定义 render 钩子
  if (typeof config.render === 'function') {
    return await safeRender(config.render, context);
  }

  // 使用默认渲染
  return renderTopbar(config, appId);
}

/**
 * 异步渲染底部栏（支持自定义 render 钩子）
 * @param {object} options
 * @param {object} options.config - nav 配置
 * @param {string} options.appId - App ID
 * @param {string} options.activeButtonId - 当前激活按钮 ID
 * @param {object} options.context - BarRenderContext
 * @returns {Promise<string>} HTML 字符串
 */
export async function renderTabbarAsync({ config, appId, activeButtonId = '', context }) {
  if (!config || config.type === 'none') {
    return '';
  }

  // 检测自定义 render 钩子
  if (typeof config.render === 'function') {
    return await safeRender(config.render, context);
  }

  // 使用默认渲染
  return renderTabbar(config, appId, activeButtonId);
}

/**
 * 检测是否有自定义 render 钩子
 * @param {object} config - topbar 或 nav 配置
 * @returns {boolean}
 */
export function hasCustomRender(config) {
  return config && typeof config.render === 'function';
}

/**
 * 获取渲染模式
 * @param {object} config - topbar 或 nav 配置
 * @returns {'default'|'custom'}
 */
export function getRenderMode(config) {
  if (hasCustomRender(config)) {
    return 'custom';
  }
  return 'default';
}
