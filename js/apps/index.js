/**
 * 小听 - Apps 清单（ESM 版）
 *
 * 静态 import 所有 app —— vite 能识别依赖图，自动把 app 文件 inline 进产物 chunk。
 *
 * 新增 app：
 *   1. 在 js/apps/ 下新建 xxx.js，default export 一个返回 appConfig（或 appConfig 数组）的函数
 *   2. 在本文件加一行 `import createXxxApp from './xxx.js'`
 *   3. 加到下面的 appFactories 数组
 *   4. dev：vite 自动按 import 图加载；单文件 build：vite-plugin-singlefile 会把所有 ESM 合到同一个 chunk
 *
 * default export 的两种形式：
 *   - 工厂函数 () => appConfig
 *   - 工厂函数 () => [appConfig, appConfig, ...]   ← 多 app 模块
 *
 * 当前清单：app 制作问卷 + 设置（模板由 src/index.js 直接注册）。
 */

import { registerPhoneApp, registerPhoneAppAsync } from '../../src/core/app-registry.js';

// 静态 import 所有 app 模块 —— vite 会把它们合到产物 chunk
import createPromptSurveyApp from './prompt-survey.js';
import createSettingApp from './setting/main.js';
import createWeatherApp from './weather-app.js';
import createFocusApp from './focus-app.js';
import createAppStoreApp from './appstore.js';
import createChatApp from './chat-app/index.js';

// app 模块清单（展示用 + 兼容老代码 window.LISTEN_APPS）
export const appModules = [
    './prompt-survey.js',
    './setting/main.js',
    './weather-app.js',
    './focus-app.js',
    './appstore.js',
    './chat-app/index.js',
];

// 兼容层：暴露 LISTEN_APPS 数组供老代码读取（未来可移除）
if (typeof window !== 'undefined') {
    window.LISTEN_APPS = appModules.map(p => p.replace(/^\.\//, ''));
}

// 注册所有 app：每个工厂返回 appConfig 或 appConfig 数组
// ★ v0.21.1：必须 await registerPhoneAppAsync，否则 IndexedDB 还没升级到包含 app 的 store，
// 首次 put/get 会静默失败（用户感知是「添加成功」但下次开 app 列表又空了）。
const appFactories = [
    // ui 之外的「资源型」app（会自己写 IndexedDB 的）需要 async 注册
    { name: 'weather-app', factory: createWeatherApp, async: true },
    // ui-only app 同步即可
    { name: 'prompt-survey', factory: createPromptSurveyApp, async: false },
    { name: 'settings', factory: createSettingApp, async: false },
    // 可下载 App 也先注册代码，由安装状态决定是否进入桌面。
    { name: 'focus-app', factory: createFocusApp, async: false },
    { name: 'appstore', factory: createAppStoreApp, async: true },
    { name: 'chat', factory: createChatApp, async: false },
];

async function hydrateWeatherApp(app) {
    if (!app?.methods || typeof app.methods.hydrate !== 'function') return;
    try {
        await app.methods.hydrate();
    } catch (err) {
        console.warn('[apps/index] 天气数据后台初始化失败', err);
    }
}

async function registerAll() {
    let weatherAppRef = null;
    for (const { name, factory, async: useAsync } of appFactories) {
        if (typeof factory !== 'function') {
            console.warn(`[apps/index] ${name} 没有 default export 工厂函数，已跳过`);
            continue;
        }
        const configOrList = factory();
        const configList = Array.isArray(configOrList) ? configOrList : [configOrList];
        for (const config of configList) {
            if (!config) continue;
            let registered = null;
            if (useAsync) {
                registered = await registerPhoneAppAsync(config);
            } else {
                registered = registerPhoneApp(config);
            }
            if (config.id === 'weather-app') {
                weatherAppRef = registered;
            }
        }
        console.log(`[apps/index] 已注册 app: ${name} (${configList.length} 个)`);
    }

    // 天气 App 注册完成后，后台主动 hydrate 一次：
    // 解决「设置页首屏读不到天气映射」 —— 不再要求用户先打开天气 App。
    if (weatherAppRef) {
        void hydrateWeatherApp(weatherAppRef);
    }
}

// 不 await —— 让启动序列继续走；IndexedDB 升级会在后台完成，app 写入时会拿到正确的 db
registerAll().then(() => {
    console.log('[apps/index] ✅ 所有 App 注册完成');
    // 派发事件通知 boot-loader
    if (typeof window !== 'undefined') {
        const apps = window.__phoneAppsRef?.value || [];
        window.dispatchEvent(new CustomEvent('phone:apps-registered', {
            detail: { apps, count: apps.length }
        }));
    }
}).catch(err => {
    console.error('[apps/index] 注册流程失败', err);
});
