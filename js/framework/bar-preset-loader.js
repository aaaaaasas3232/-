/**
 * ================================================================
 * 小听 Framework · 预设 CSS / JS 懒加载器
 * ---------------------------------------------------------------
 * 按需加载预设的 CSS 和 JS 模块
 * Phase 1: 基础设施 - 不影响现有 App
 * ================================================================
 */

import { getTabbarPreset, getTopbarPreset } from './bar-presets.js';

// ================================================================
// CSS 懒加载
// ================================================================

/**
 * 预设 CSS 映射
 * key: preset name
 * value: CSS file path (相对路径，从 /css/ 开始)
 */
const PRESET_CSS_MAP = {
  // 顶部栏预设
  topbar: {
    // 暂无独立 CSS，后续可扩展
  },

  // 底部栏预设
  tabbar: {
    liquid: '/css/framework/bar/_liquid.css',
    wave: '/css/framework/bar/_wave.css',
    indicator: '/css/framework/bar/_indicator.css',
    minimal: '/css/framework/bar/_minimal.css',
    // default 使用 framework 内置样式，无需额外加载
  },
};

/**
 * 已加载的 CSS 缓存
 * @type {Set<string>}
 */
const loadedCss = new Set();

/**
 * 加载预设 CSS
 * @param {'topbar'|'tabbar'} type
 * @param {string} presetName
 * @returns {Promise<void>}
 */
export async function loadPresetCSS(type, presetName) {
  const key = `${type}:${presetName}`;

  // 已加载则跳过
  if (loadedCss.has(key)) return;

  // 查找 CSS 路径
  const cssMap = PRESET_CSS_MAP[type];
  if (!cssMap) return;

  const cssPath = cssMap[presetName];
  if (!cssPath) return;

  // 动态创建 link 加载 CSS
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssPath;

    link.onload = () => {
      loadedCss.add(key);
      // 派发事件
      window.dispatchEvent(new CustomEvent('bar:preset-css-loaded', {
        detail: { type, presetName },
      }));
      resolve();
    };

    link.onerror = (err) => {
      console.warn(`[bar-preset-loader] Failed to load CSS: ${cssPath}`, err);
      // 不 reject，继续运行
      resolve();
    };

    document.head.appendChild(link);
  });
}

// ================================================================
// JS 模块懒加载
// ================================================================

/**
 * 已加载的 JS 模块缓存
 * @type {Map<string, object>}
 */
const loadedModules = new Map();

/**
 * 加载预设的 JS 模块
 * @param {string} modulePath - 模块路径
 * @returns {Promise<object>}
 */
export async function loadPresetModule(modulePath) {
  if (!modulePath) return null;

  // 已加载则返回缓存
  if (loadedModules.has(modulePath)) {
    return loadedModules.get(modulePath);
  }

  try {
    const module = await import(/* @vite-ignore */ modulePath);
    loadedModules.set(modulePath, module);
    return module;
  } catch (err) {
    console.warn(`[bar-preset-loader] Failed to load module: ${modulePath}`, err);
    return null;
  }
}

// ================================================================
// 预设初始化入口
// ================================================================

/**
 * 初始化预设（加载 CSS + JS 模块）
 * @param {'topbar'|'tabbar'} type
 * @param {object} presetConfig - 预设配置（来自 bar-presets.js）
 * @returns {Promise<void>}
 */
export async function initPreset(type, presetConfig) {
  if (!presetConfig) return;

  const presetName = presetConfig._presetName;

  // 1. 加载 CSS
  await loadPresetCSS(type, presetName);

  // 2. 加载 JS 模块（如果有）
  if (presetConfig.jsModule) {
    await loadPresetModule(presetConfig.jsModule);
  }

  // 3. 派发预设加载完成事件
  window.dispatchEvent(new CustomEvent('bar:preset-loaded', {
    detail: { type, presetName, config: presetConfig },
  }));
}

/**
 * 根据预设名初始化
 * @param {'topbar'|'tabbar'} type
 * @param {string} presetName
 * @returns {Promise<void>}
 */
export async function initPresetByName(type, presetName) {
  const preset = type === 'topbar'
    ? getTopbarPreset(presetName)
    : getTabbarPreset(presetName);

  if (preset) {
    await initPreset(type, { ...preset, _presetName: presetName });
  }
}

// ================================================================
// App 配置自动初始化
// ================================================================

/**
 * 从 App 配置中提取预设名
 * @param {object} appConfig - App 配置
 * @param {'topbar'|'tabbar'} type
 * @returns {string|null}
 */
export function extractPresetName(appConfig, type) {
  const config = appConfig[type];
  if (!config) return null;

  // 新配置: preset 字段
  if (config.preset) return config.preset;

  // 旧配置: type 字段（兼容）
  if (config.type && PRESET_CSS_MAP[type]?.[config.type]) {
    return config.type;
  }

  return null;
}

/**
 * 初始化 App 的栏预设
 * 自动检测 App 配置中的预设并加载
 * @param {object} appConfig - App 配置
 * @param {'topbar'|'tabbar'} type
 * @returns {Promise<void>}
 */
export async function initAppBarPreset(appConfig, type) {
  const presetName = extractPresetName(appConfig, type);
  if (presetName) {
    await initPresetByName(type, presetName);
  }
}

// ================================================================
// 预设状态管理
// ================================================================

/**
 * 已初始化的预设追踪
 * @type {Set<string>}
 */
const initializedPresets = new Set();

/**
 * 确保预设只初始化一次
 * @param {'topbar'|'tabbar'} type
 * @param {string} presetName
 * @returns {boolean} 是否是新初始化
 */
export function markPresetInitialized(type, presetName) {
  const key = `${type}:${presetName}`;
  if (initializedPresets.has(key)) {
    return false;
  }
  initializedPresets.add(key);
  return true;
}

/**
 * 检查预设是否已初始化
 * @param {'topbar'|'tabbar'} type
 * @param {string} presetName
 * @returns {boolean}
 */
export function isPresetInitialized(type, presetName) {
  return initializedPresets.has(`${type}:${presetName}`);
}

// ================================================================
// 工具函数
// ================================================================

/**
 * 获取所有已加载的预设
 * @returns {{ css: string[], modules: string[] }}
 */
export function getLoadedPresets() {
  return {
    css: Array.from(loadedCss),
    modules: Array.from(loadedModules.keys()),
  };
}

/**
 * 预加载多个预设（批量）
 * @param {Array<{type: 'topbar'|'tabbar', presetName: string}>} presets
 * @returns {Promise<void>}
 */
export async function preloadPresets(presets) {
  await Promise.all(
    presets.map(({ type, presetName }) => initPresetByName(type, presetName))
  );
}
