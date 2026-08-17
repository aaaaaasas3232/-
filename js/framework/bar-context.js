/**
 * ================================================================
 * 小听 Framework · 栏渲染上下文
 * ---------------------------------------------------------------
 * 定义 render 钩子可访问的上下文数据结构
 * Phase 3: 彻底自定义支持
 * ================================================================
 */

// ================================================================
// 上下文类型定义
// ================================================================

/**
 * @typedef {Object} BarButtonContext
 * @property {string} id - 按钮唯一标识
 * @property {string} [icon] - 图标（emoji 或单字符）
 * @property {string} [iconHtml] - 图标 HTML（SVG 等）
 * @property {string} [label] - 按钮文字标签
 * @property {Action|object} action - 点击行为配置
 * @property {boolean} [active] - 是否激活（底部栏按钮）
 * @property {string|number} [badge] - 徽章数值
 * @property {string} [color] - 按钮颜色
 * @property {string} [bg] - 按钮背景
 * @property {number} [size] - 按钮尺寸
 * @property {number} [width] - 按钮宽度
 * @property {boolean} [disabled] - 是否禁用
 * @property {boolean} [visible] - 是否可见
 */

/**
 * @typedef {Object} TopbarRenderContext
 * @property {object} app - 当前 App 配置
 * @property {object} state - App 当前状态
 * @property {object} topbar - 原始 topbar 配置
 * @property {string} appId - App ID
 * @property {string} pageId - 当前页面 ID
 * @property {object} framework - Framework 工具集
 * @property {Function} framework.handleAction - 统一 action 处理
 * @property {Function} framework.t - i18n 翻译函数
 * @property {Function} framework.escapeHtml - HTML 转义函数
 * @property {Array<TopbarButtonContext>} [leftButtons] - 规范化后的左侧按钮
 * @property {Array<TopbarButtonContext>} [rightButtons] - 规范化后的右侧按钮
 * @property {string} [title] - 标题文本
 * @property {string} [subtitle] - 副标题文本
 * @property {string} [layout] - 布局模式
 * @property {string} [bg] - 背景色
 * @property {string} [color] - 文字颜色
 * @property {number} [buttonGap] - 按钮间距
 */

/**
 * @typedef {Object} NavRenderContext
 * @property {object} app - 当前 App 配置
 * @property {object} state - App 当前状态
 * @property {object} nav - 原始 nav 配置
 * @property {string} appId - App ID
 * @property {string} activePageId - 当前激活的页面 ID
 * @property {object} framework - Framework 工具集
 * @property {Function} framework.handleAction - 统一 action 处理
 * @property {Function} framework.t - i18n 翻译函数
 * @property {Function} framework.escapeHtml - HTML 转义函数
 * @property {Array<NavButtonContext>} [buttons] - 规范化后的导航按钮
 * @property {string} [preset] - 预设名称
 * @property {string} [type] - 显示类型
 * @property {string} [bg] - 背景色
 * @property {string} [color] - 文字颜色
 * @property {number} [height] - 高度
 * @property {number} [buttonGap] - 按钮间距
 * @property {string} [justifyContent] - 对齐方式
 */

// ================================================================
// 上下文工厂函数
// ================================================================

/**
 * 创建顶部栏渲染上下文
 * @param {object} options
 * @returns {TopbarRenderContext}
 */
export function createTopbarContext({
  app,
  state,
  topbar,
  appId,
  pageId,
  handleAction,
  t,
  escapeHtml,
  normalizedConfig,
}) {
  return {
    app,
    state,
    topbar,
    appId,
    pageId,
    framework: {
      handleAction,
      t: t || ((key) => key),
      escapeHtml: escapeHtml || ((str) => str),
    },
    // 从规范化配置中提取
    title: normalizedConfig?.title?.text || topbar?.title || '',
    subtitle: normalizedConfig?.subtitle || '',
    layout: normalizedConfig?.layout || 'center',
    leftButtons: normalizedConfig?.leftButtons || [],
    rightButtons: normalizedConfig?.rightButtons || [],
    bg: normalizedConfig?.bg || topbar?.bg || 'transparent',
    color: normalizedConfig?.color || topbar?.color || 'rgba(17, 24, 39, 0.92)',
    buttonGap: normalizedConfig?.buttonGap ?? 8,
    // 原始配置透传
    ...topbar,
  };
}

/**
 * 创建底部栏渲染上下文
 * @param {object} options
 * @returns {NavRenderContext}
 */
export function createNavContext({
  app,
  state,
  nav,
  appId,
  activePageId,
  handleAction,
  t,
  escapeHtml,
  normalizedConfig,
}) {
  return {
    app,
    state,
    nav,
    appId,
    activePageId,
    framework: {
      handleAction,
      t: t || ((key) => key),
      escapeHtml: escapeHtml || ((str) => str),
    },
    // 从规范化配置中提取
    preset: normalizedConfig?.preset || nav?.preset || 'default',
    type: normalizedConfig?.type || nav?.type || 'tab',
    buttons: normalizedConfig?.buttons || [],
    bg: normalizedConfig?.bg || nav?.bg || 'rgba(255, 255, 255, 0.46)',
    color: normalizedConfig?.color || nav?.color || 'rgba(17, 24, 39, 0.48)',
    height: normalizedConfig?.height ?? 58,
    buttonGap: normalizedConfig?.buttonGap ?? 12,
    justifyContent: normalizedConfig?.justifyContent || 'space-around',
    // 原始配置透传
    ...nav,
  };
}

// ================================================================
// 上下文验证
// ================================================================

/**
 * 验证顶部栏上下文
 * @param {TopbarRenderContext} ctx
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateTopbarContext(ctx) {
  const errors = [];

  if (!ctx.app) {
    errors.push('缺少 app 配置');
  }

  if (!ctx.appId) {
    errors.push('缺少 appId');
  }

  if (typeof ctx.handleAction !== 'function') {
    errors.push('framework.handleAction 不是函数');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 验证底部栏上下文
 * @param {NavRenderContext} ctx
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateNavContext(ctx) {
  const errors = [];

  if (!ctx.app) {
    errors.push('缺少 app 配置');
  }

  if (!ctx.appId) {
    errors.push('缺少 appId');
  }

  if (typeof ctx.handleAction !== 'function') {
    errors.push('framework.handleAction 不是函数');
  }

  return { valid: errors.length === 0, errors };
}

// ================================================================
// 工具函数
// ================================================================

/**
 * 安全执行 render 函数
 * @param {Function} renderFn - render 函数
 * @param {object} context - 渲染上下文
 * @returns {Promise<string>} HTML 字符串
 */
export async function safeRender(renderFn, context) {
  if (typeof renderFn !== 'function') {
    console.warn('[bar-context] renderFn 不是函数');
    return '';
  }

  try {
    const result = renderFn(context);

    // 处理 Promise
    if (result && typeof result.then === 'function') {
      return await result;
    }

    return typeof result === 'string' ? result : '';
  } catch (err) {
    console.error('[bar-context] render 函数执行失败:', err);
    return `<div class="bar-render-error" style="color: #DC2626; padding: 8px;">渲染失败: ${err.message}</div>`;
  }
}

/**
 * 合并多个上下文
 * @param  {...object} contexts
 * @returns {object}
 */
export function mergeContexts(...contexts) {
  const result = {};

  for (const ctx of contexts) {
    if (!ctx) continue;
    Object.assign(result, ctx);

    // 深度合并 framework
    if (ctx.framework && result.framework) {
      result.framework = { ...result.framework, ...ctx.framework };
    }
  }

  return result;
}
