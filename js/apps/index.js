/**
 * 小听 - Apps 清单（ESM 版）
 *
 * 静态 import 所有 app —— vite 能识别依赖图，自动把 app 文件 inline 进产物 chunk。
 *
 * 新增 app：
 *   1. 在 js/apps/ 下新建 xxx.js，default export 一个返回 appConfig（或 appConfig 数组）的函数
 *   2. 在本文件加一行 `import createXxxApp from './xxx.js'`
 *   3. 加到下面的 appModules 数组
 *   4. dev：vite 自动按 import 图加载；单文件 build：vite-plugin-singlefile 会把所有 ESM 合到同一个 chunk
 *
 * default export 的两种形式：
 *   - 工厂函数 () => appConfig
 *   - 工厂函数 () => [appConfig, appConfig, ...]   ← 多 app 模块（如 placeholder-apps）
 */

import { registerPhoneApp } from '../../src/core/app-registry.js';

// 静态 import 所有 app 模块 —— vite 会把它们合到产物 chunk
import createPromptSurveyApp from './prompt-survey.js';
import createFrameworkTestApp from './framework-test-app.js';
import createPlaceholderApps from './placeholder-apps.js';
import createSettingApp from './setting/main.js';

// app 模块清单（展示用 + 兼容老代码 window.LISTEN_APPS）
export const appModules = [
    './prompt-survey.js',
    './framework-test-app.js',
    './placeholder-apps.js',
    './setting/main.js',
];

// 兼容层：暴露 LISTEN_APPS 数组供老代码读取（未来可移除）
if (typeof window !== 'undefined') {
    window.LISTEN_APPS = appModules.map(p => p.replace(/^\.\//, ''));
}

// 注册所有 app：每个工厂返回 appConfig 或 appConfig 数组
const appFactories = [
    { name: 'prompt-survey', factory: createPromptSurveyApp },
    { name: 'framework-test-app', factory: createFrameworkTestApp },
    { name: 'placeholder-apps', factory: createPlaceholderApps },
    { name: 'settings', factory: createSettingApp },
];

for (const { name, factory } of appFactories) {
    if (typeof factory !== 'function') {
        console.warn(`[apps/index] ${name} 没有 default export 工厂函数，已跳过`);
        continue;
    }
    const configOrList = factory();
    const configList = Array.isArray(configOrList) ? configOrList : [configOrList];
    for (const config of configList) {
        if (!config) continue;
        registerPhoneApp(config);
    }
    console.log(`[apps/index] 已注册 app: ${name} (${configList.length} 个)`);
}