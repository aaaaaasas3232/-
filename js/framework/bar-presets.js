/**
 * ================================================================
 * 小听 Framework · 栏预设注册中心
 * ---------------------------------------------------------------
 * 统一管理顶部栏 / 底部栏的视觉预设
 * Phase 1: 基础设施 - 不影响现有 App
 * ================================================================
 */

// ================================================================
// 顶部栏预设
// ================================================================

export const TOPBAR_PRESETS = {
  /**
   * 默认顶栏样式
   * 透明背景 + 深色文字，居中标题
   */
  default: {
    bg: 'transparent',
    color: 'rgba(17, 24, 39, 0.92)',
    layout: 'center',
  },

  /**
   * 搜索栏样式
   * 可输入的搜索框，交互式
   */
  search: {
    type: 'search',
    interactive: true,
    placeholder: '搜索...',
  },

  /**
   * 大标题样式
   * 标题更大、更醒目
   */
  largeTitle: {
    largeTitle: true,
    titleSize: 28,
    fontWeight: 700,
  },

  // 更多预设可按需添加
};

// ================================================================
// 底部栏预设
// ================================================================

export const TABBAR_PRESETS = {
  /**
   * 标准 Tab 样式
   * 毛玻璃背景 + 图标 + 文字
   */
  default: {
    height: 58,
    bg: 'rgba(255, 255, 255, 0.46)',
    blur: 18,
    buttonGap: 12,
    showLabels: true,
    showIcons: true,
  },

  /**
   * 液球动画（App Store 风格）
   * - 激活时白色鼓包从顶部冒出
   * - 彩色液球带文字首字母浮起
   * - 切换时弹性形变动画
   *
   * 效果文件: css/framework/bar/_liquid.css
   * JS 初始化: appstore-liquid-tab.js (通过 MutationObserver 驱动)
   */
  liquid: {
    height: 48,
    effect: 'liquid',
    colors: ['#ff69b4', '#007aff', '#ff69b4'],
    animation: {
      enter: 'liquid-blob-in 0.7s cubic-bezier(0.34, 1.4, 0.64, 1)',
      leave: 'liquid-blob-out 0.45s cubic-bezier(0.55, 0, 0.85, 0.35)',
      shapeBump: 'appstore-liquid-shape-bump 0.6s cubic-bezier(0.34, 1.4, 0.64, 1)',
      shapeCollapse: 'appstore-liquid-shape-collapse 0.45s cubic-bezier(0.55, 0, 0.55, 1)',
    },
    // JS 初始化函数名（供 bar-preset-loader 调用）
    jsModule: './appstore-liquid-tab.js',
  },

  /**
   * 波浪动画（音乐 App 风格）
   * - 背景波浪动画
   * - 播放中音符飘落
   * - 粉色指示器滑动
   *
   * 效果文件: css/framework/bar/_wave.css
   * JS 渲染: music-app/components/tab-bar-effects.js
   * JS 初始化: music-app/index.js (mountTabBarInteractions)
   */
  wave: {
    height: 64,
    effect: 'wave',
    waveCount: 3,
    showNotes: true,
    noteCount: 5,
    colors: {
      wave: 'rgba(251, 114, 153, 0.12)',
      indicator: 'linear-gradient(135deg, #fb7299 0%, #ff9a9e 100%)',
      active: 'white',
      icon: '#fb7299',
      iconActive: 'white',
    },
    animation: {
      wave: 'tabbarWave 8s ease-in-out infinite',
      wavePlaying: 'tabbarWave 3s ease-in-out infinite',
      floatNote: 'floatNote 3s ease-in-out infinite',
      iconBounce: 'iconBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
      iconPulse: 'musicPulse 0.5s ease-in-out infinite alternate',
    },
    bottomOffset: 45, // 距底部距离
    // JS 渲染函数
    renderModule: './music-app/components/tab-bar-effects.js',
    renderFn: 'renderTabBar',
    // JS 初始化函数
    initModule: './music-app/components/tab-bar-effects.js',
    initFn: 'mountTabBarInteractions',
  },

  /**
   * 滑动指示器（聊天 App 风格）
   * - 粉色小 pill 在 tab 下方滑动
   * - 使用 CSS :has() 选择器实现
   *
   * 效果文件: css/framework/bar/_indicator.css
   * 依赖: CSS :has() 选择器（现代浏览器）
   */
  indicator: {
    height: 58,
    effect: 'indicator',
    indicatorWidth: 24,
    indicatorHeight: 3,
    indicatorColor: '#007aff',
    indicatorRadius: 1.5,
    animation: {
      transition: 'left 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
    },
    // 可选:使用 :has() 的 CSS 选择器版本
    useCssHas: true,
  },

  /**
   * 极简风格
   * - 仅图标，无文字
   * - 透明背景
   */
  minimal: {
    height: 44,
    bg: 'transparent',
    blur: 0,
    showLabels: false,
    showIcons: true,
    buttonGap: 16,
  },

  /**
   * 自定义风格（占位）
   * 供 App 通过 registerTabbarPreset 注册
   */
  custom: null,
};

// ================================================================
// 预设继承
// ================================================================

/**
 * 基于现有预设扩展新预设
 * @param {string} baseName - 基础预设名
 * @param {object} overrides - 覆盖配置
 * @returns {object} 新预设配置
 */
export function extendPreset(baseName, overrides) {
  const base = TABBAR_PRESETS[baseName] || TOPBAR_PRESETS[baseName];
  if (!base) {
    console.warn(`[bar-presets] extendPreset: base preset "${baseName}" not found`);
    return overrides;
  }
  return {
    ...base,
    ...overrides,
    // 保留原始基础预设名
    _extends: baseName,
  };
}

// ================================================================
// 预设注册 API
// ================================================================

/**
 * 注册自定义顶部栏预设
 * @param {string} name - 预设名称
 * @param {object} config - 预设配置
 */
export function registerTopbarPreset(name, config) {
  if (TOPBAR_PRESETS[name] && TOPBAR_PRESETS[name] !== null) {
    console.warn(`[bar-presets] registerTopbarPreset: "${name}" already exists, overwriting`);
  }
  TOPBAR_PRESETS[name] = config;
  // 派发事件
  window.dispatchEvent(new CustomEvent('bar:preset-registered', {
    detail: { type: 'topbar', name },
  }));
}

/**
 * 注册自定义底部栏预设
 * @param {string} name - 预设名称
 * @param {object} config - 预设配置
 */
export function registerTabbarPreset(name, config) {
  if (TABBAR_PRESETS[name] && TABBAR_PRESETS[name] !== null) {
    console.warn(`[bar-presets] registerTabbarPreset: "${name}" already exists, overwriting`);
  }
  TABBAR_PRESETS[name] = config;
  // 派发事件
  window.dispatchEvent(new CustomEvent('bar:preset-registered', {
    detail: { type: 'tabbar', name },
  }));
}

/**
 * 获取顶部栏预设
 * @param {string} name - 预设名称
 * @returns {object} 预设配置
 */
export function getTopbarPreset(name) {
  return TOPBAR_PRESETS[name] || TOPBAR_PRESETS.default;
}

/**
 * 获取底部栏预设
 * @param {string} name - 预设名称
 * @returns {object} 预设配置
 */
export function getTabbarPreset(name) {
  return TABBAR_PRESETS[name] || TABBAR_PRESETS.default;
}

/**
 * 检查预设是否存在
 * @param {'topbar'|'tabbar'} type
 * @param {string} name
 * @returns {boolean}
 */
export function hasPreset(type, name) {
  const presets = type === 'topbar' ? TOPBAR_PRESETS : TABBAR_PRESETS;
  return name in presets && presets[name] !== null;
}

// ================================================================
// 预设合并
// ================================================================

/**
 * 将预设配置合并到 App 配置
 * @param {object} appConfig - App 配置
 * @param {'topbar'|'tabbar'} type
 * @returns {object} 合并后的配置
 */
export function applyPresetToConfig(appConfig, type) {
  const config = appConfig[type] || {};
  const presetName = config.preset || config.type || 'default';
  const preset = type === 'topbar'
    ? getTopbarPreset(presetName)
    : getTabbarPreset(presetName);

  // 深度合并，App 配置优先
  return {
    ...preset,
    ...config,
    // 保留原始 preset 名称
    _presetName: presetName,
  };
}

// ================================================================
// 预设元数据
// ================================================================

/**
 * 获取所有可用预设的元数据（用于 UI 选择器）
 * @param {'topbar'|'tabbar'} type
 * @returns {Array<{name: string, label: string, description: string, preview: string}>}
 */
export function listPresets(type) {
  const presets = type === 'topbar' ? TOPBAR_PRESETS : TABBAR_PRESETS;

  const METADATA = {
    topbar: {
      default: { label: '默认', description: '透明背景，居中标题' },
      search: { label: '搜索栏', description: '可输入的搜索框' },
      largeTitle: { label: '大标题', description: '更大更醒目的标题' },
    },
    tabbar: {
      default: { label: '标准', description: '毛玻璃 + 图标 + 文字' },
      liquid: { label: '液球', description: 'App Store 风格，弹性动画' },
      wave: { label: '波浪', description: '音乐 App 风格，波浪 + 音符' },
      indicator: { label: '滑动指示器', description: '粉色小 pill 滑动' },
      minimal: { label: '极简', description: '仅图标，无文字' },
    },
  };

  return Object.entries(presets)
    .filter(([, config]) => config !== null)
    .map(([name, config]) => ({
      name,
      ...METADATA[type]?.[name],
      config,
    }));
}
