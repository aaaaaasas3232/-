/**
 * ================================================================
 * 小听 Framework · 栏配置规范化器
 * ---------------------------------------------------------------
 * 将旧配置格式转换为新 Schema
 * Phase 2: 配置 Schema 升级
 * ================================================================
 */

// ================================================================
// 顶部栏配置规范化
// ================================================================

/**
 * 规范化顶部栏配置
 * @param {object} config - 原始 topbar 配置
 * @returns {object} 规范化后的配置
 */
export function normalizeTopbarConfig(config) {
  if (!config) {
    return getDefaultTopbarConfig();
  }

  const normalized = { ...config };

  // headerActions → rightButtons (旧 → 新)
  if (normalized.headerActions && !normalized.rightButtons) {
    normalized.rightButtons = normalized.headerActions.map((h, i) => ({
      id: h.id || `topbar-btn-${i}`,
      icon: h.icon,
      iconHtml: h.iconHtml,
      label: h.label,
      action: h.action,
      ariaLabel: h.ariaLabel,
      variant: h.variant,
      color: h.color,
      bg: h.bg,
      size: h.size,
      disabled: h.disabled,
      visible: h.visible !== false,
    }));
  }

  // 简化 title 字符串 → 对象
  if (typeof normalized.title === 'string') {
    normalized.title = {
      text: normalized.title,
      color: normalized.titleColor,
    };
  }

  // 确保 visible 有值
  if (normalized.visible === undefined) {
    normalized.visible = true;
  }

  // 确保 layout 有值
  if (!normalized.layout) {
    normalized.layout = normalized.largeTitle ? 'left-title-right' : 'center';
  }

  return normalized;
}

// ================================================================
// 底部栏配置规范化
// ================================================================

/**
 * 规范化底部栏配置
 * @param {object} config - 原始 nav 配置
 * @returns {object} 规范化后的配置
 */
export function normalizeNavConfig(config) {
  if (!config) {
    return getDefaultNavConfig();
  }

  const normalized = { ...config };

  // pages[] → buttons[] (旧 → 新)
  if (normalized.pages && !normalized.buttons) {
    normalized.buttons = normalized.pages
      .filter(page => page && page.type !== 'detail' && page.nav !== false)
      .map((page, i) => ({
        id: page.id || `nav-btn-${i}`,
        label: page.label || page.id,
        icon: page.icon,
        iconHtml: page.iconHtml,
        action: `switchPage:${page.id}`,
        active: false,
        badge: null,
        visible: true,
      }));
  }

  // 确保 type 有值
  if (!normalized.type) {
    normalized.type = 'tab';
  }

  // 确保 preset 有值（向后兼容旧的 type 字段）
  if (!normalized.preset) {
    // 尝试从 type 推断 preset
    const typeToPreset = {
      liquid: 'liquid',
      wave: 'wave',
      indicator: 'indicator',
      minimal: 'minimal',
    };
    normalized.preset = typeToPreset[normalized.type] || 'default';
  }

  // 确保按钮间距有默认值
  if (normalized.buttonGap === undefined) {
    normalized.buttonGap = 12;
  }

  return normalized;
}

// ================================================================
// 默认配置
// ================================================================

/**
 * 获取默认顶部栏配置
 * @returns {object}
 */
export function getDefaultTopbarConfig() {
  return {
    visible: true,
    layout: 'center',
    title: '',
    subtitle: '',
    leftButtons: [],
    rightButtons: [],
    buttonGap: 8,
    bg: 'transparent',
    color: 'rgba(17, 24, 39, 0.92)',
  };
}

/**
 * 获取默认底部栏配置
 * @returns {object}
 */
export function getDefaultNavConfig() {
  return {
    type: 'tab',
    preset: 'default',
    buttons: [],
    buttonGap: 12,
    justifyContent: 'space-around',
    bg: 'rgba(255, 255, 255, 0.46)',
    color: 'rgba(17, 24, 39, 0.48)',
    height: 58,
  };
}

// ================================================================
// App 配置合并
// ================================================================

/**
 * 合并 App 级别的 topbar 配置
 * @param {object} appTopbar - App 级 topbar
 * @param {object} pageTopbar - Page 级 topbar
 * @returns {object} 合并后的配置
 */
export function mergeTopbarConfig(appTopbar, pageTopbar) {
  const appConfig = normalizeTopbarConfig(appTopbar);
  const pageConfig = normalizeTopbarConfig(pageTopbar);

  // pageTopbar 优先
  return {
    ...appConfig,
    ...pageConfig,
    // 按钮数组合并
    leftButtons: [
      ...(appConfig.leftButtons || []),
      ...(pageConfig.leftButtons || []),
    ],
    rightButtons: [
      ...(appConfig.rightButtons || []),
      ...(pageConfig.rightButtons || []),
    ],
  };
}

/**
 * 合并 App 级别的 nav 配置
 * @param {object} appNav - App 级 nav
 * @param {object} pageNav - Page 级 nav（如果有）
 * @returns {object} 合并后的配置
 */
export function mergeNavConfig(appNav, pageNav) {
  const appConfig = normalizeNavConfig(appNav);
  const pageConfig = normalizeNavConfig(pageNav);

  // pageNav 优先
  return {
    ...appConfig,
    ...pageConfig,
    // 按钮数组合并
    buttons: pageNav?.buttons?.length
      ? [...appConfig.buttons, ...pageConfig.buttons]
      : appConfig.buttons,
  };
}

// ================================================================
// 配置验证
// ================================================================

/**
 * 验证按钮配置
 * @param {object} button - 按钮配置
 * @param {'left'|'right'|'nav'} position - 按钮位置
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateButton(button, position = 'nav') {
  const errors = [];

  if (!button.id) {
    errors.push('按钮缺少 id 字段');
  }

  if (!button.action && position !== 'nav') {
    // nav 按钮的 action 有默认值，所以不是必须
    errors.push(`按钮 "${button.id}" 缺少 action 字段`);
  }

  if (button.icon && button.iconHtml) {
    errors.push(`按钮 "${button.id}" 同时有 icon 和 iconHtml，iconHtml 优先级更高`);
  }

  if (button.visible === false && button.disabled === true) {
    errors.push(`按钮 "${button.id}" 同时设置 visible=false 和 disabled=true，无意义`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 验证顶部栏配置
 * @param {object} config
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateTopbarConfig(config) {
  const errors = [];
  const normalized = normalizeTopbarConfig(config);

  // 验证左按钮
  (normalized.leftButtons || []).forEach(btn => {
    const result = validateButton(btn, 'left');
    errors.push(...result.errors);
  });

  // 验证右按钮
  (normalized.rightButtons || []).forEach(btn => {
    const result = validateButton(btn, 'right');
    errors.push(...result.errors);
  });

  // 验证 layout
  const validLayouts = ['center', 'left-title-right', 'title-left', 'custom'];
  if (!validLayouts.includes(normalized.layout)) {
    errors.push(`无效的 layout: "${normalized.layout}"，可选值: ${validLayouts.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 验证底部栏配置
 * @param {object} config
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateNavConfig(config) {
  const errors = [];
  const normalized = normalizeNavConfig(config);

  // 验证 preset
  const validPresets = ['default', 'liquid', 'wave', 'indicator', 'minimal', 'custom'];
  if (!validPresets.includes(normalized.preset)) {
    errors.push(`无效的 preset: "${normalized.preset}"，可选值: ${validPresets.join(', ')}`);
  }

  // 验证按钮
  (normalized.buttons || []).forEach(btn => {
    const result = validateButton(btn, 'nav');
    errors.push(...result.errors);
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
