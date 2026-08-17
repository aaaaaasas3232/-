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
import createAppMakerApp from './app-maker/index.js';
import createSettingApp from './setting/main.js';
import createWeatherApp from './weather-app.js';
import createFocusApp from './focus-app.js';
import createAppStoreApp from './appstore.js';
import createChatApp from './chat-app/index.js';
import createMusicApp from './music-app/index.js';
import createCoverDesignerApp from './cover-designer/index.js';
import createRelaxApp from './relax-app/index.js';
import createDreamWeaverApp from './dream-weaver/index.js';
import createShopApp from './shop-app/index.js';
import createJobApp from './job-app/index.js';
import createPersonaLabApp from './persona-lab/index.js';
import createGalgameApp from './galgame/index.js';
import createBubbleMakerApp from './bubble-maker/index.js';
import createScenePlayApp from './scene-play/index.js';
import createDiaryApp from './diary-app/index.js';
import createTravelApp from './travel-app/index.js';
import createYoutubeApp from './youtube-app/index.js';
import createBlogApp from './blog-app/index.js';
import createActorCareerApp from './actor-career/index.js';
import createEsportsForumApp from './esports-forum/index.js';
import createEsportsGameApp from './esports-game/index.js';
import createStarlitApp from './starlit/index.js';
import createOddityApp from './oddity/index.js';

// app 模块清单（展示用 + 兼容老代码 window.LISTEN_APPS）
export const appModules = [
    './app-maker/index.js',
    './setting/main.js',
    './weather-app.js',
    './focus-app.js',
    './appstore.js',
    './chat-app/index.js',
    './music-app/index.js',
    './cover-designer/index.js',
    './relax-app/index.js',
    './dream-weaver/index.js',
    './shop-app/index.js',
    './job-app/index.js',
    './persona-lab/index.js',
    './galgame/index.js',
    './bubble-maker/index.js',
    './scene-play/index.js',
    './diary-app/index.js',
    './travel-app/index.js',
    './youtube-app/index.js',
    './blog-app/index.js',
    './actor-career/index.js',
    './esports-forum/index.js',
    './esports-game/index.js',
    './starlit/index.js',
    './oddity/index.js',
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
    { name: 'app-maker', factory: createAppMakerApp, async: false },
    { name: 'settings', factory: createSettingApp, async: true },
    // 可下载 App 也先注册代码，由安装状态决定是否进入桌面。
    { name: 'focus-app', factory: createFocusApp, async: false },
    { name: 'appstore', factory: createAppStoreApp, async: true },
    { name: 'chat', factory: createChatApp, async: false },
    { name: 'music', factory: createMusicApp, async: true },
    { name: 'cover-designer', factory: createCoverDesignerApp, async: true },
    // ★ 声明了 stores,必须 async 注册,否则首次写盘时表还没建出来
    { name: 'relax', factory: createRelaxApp, async: true },
    { name: 'dream-weaver', factory: createDreamWeaverApp, async: true },
    { name: 'shop', factory: createShopApp, async: true },
    { name: 'job', factory: createJobApp, async: true },
    { name: 'persona-lab', factory: createPersonaLabApp, async: true },
    { name: 'galgame', factory: createGalgameApp, async: true },
    { name: 'bubble-maker', factory: createBubbleMakerApp, async: true },
    // ★ 情景聊天要读气泡机的气泡,排在它后面注册 —— 虽然读的是 services
    //   (运行时才调,顺序其实无所谓),但保持这个顺序能让依赖关系一眼看出来
    { name: 'scene-play', factory: createScenePlayApp, async: true },
    // ★ 声明了 stores,必须 async 注册,否则首次写盘时表还没建出来
    { name: 'diary', factory: createDiaryApp, async: true },
    // ★ 候鸟（旅游）：声明了 5 张表,同样必须 async 注册
    { name: 'travel', factory: createTravelApp, async: true },
    // ★ 萤火（视频）：声明了 9 张表,同样必须 async 注册
    { name: 'youtube', factory: createYoutubeApp, async: true },
    // ★ 氧气（博客）：声明了 14 张表,同样必须 async 注册
    { name: 'blog', factory: createBlogApp, async: true },
    // ★ 追光（演员成长之路）：声明了 8 张表,同样必须 async 注册；
    //   只在 actor 模式世界出现（worldAvailability），代码始终注册
    { name: 'actor-career', factory: createActorCareerApp, async: true },
    // ★ 声浪（电竞论坛）：声明了 8 张表，async 注册；只在 esports 模式世界出现。
    //   必须排在赛点前面 —— 赛点通过 externalAppRegistry 调它的 services
    { name: 'esports-forum', factory: createEsportsForumApp, async: true },
    // ★ 赛点（电竞游戏）：声明了 5 张表，async 注册；生涯事实源在声浪
    { name: 'esports-game', factory: createEsportsGameApp, async: true },
    // ★ 点灯（学习）：声明了 8 张表，async 注册。
    //   不挑世界观（老师可以就是模型本身），所以任何档都能用。
    //   它的悬浮播放会画到 App 外面（.phone-screen / 手机壳上方），
    //   注册时就要把灵动岛模板挂上去 —— 见 setup()。
    { name: 'starlit', factory: createStarlitApp, async: true },
    // ★ 小奇怪（旧原型合集）：声明了 3 张表，async 注册。
    //   不挑世界观；「你有我没有」没配 API 时退化成本地题库，照样能玩。
    { name: 'oddity', factory: createOddityApp, async: true },
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
        let configOrList;
        try {
            configOrList = factory();
        } catch (err) {
            console.error(`[apps/index] ${name} 工厂函数抛错，已跳过这个 App`, err);
            continue;
        }
        const configList = Array.isArray(configOrList) ? configOrList : [configOrList];
        for (const config of configList) {
            if (!config) continue;
            let registered = null;
            try {
                if (useAsync) {
                    registered = await registerPhoneAppAsync(config);
                } else {
                    registered = registerPhoneApp(config);
                }
            } catch (err) {
                console.error(`[apps/index] 注册 ${config.id || name} 失败，已跳过`, err);
                continue;
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
