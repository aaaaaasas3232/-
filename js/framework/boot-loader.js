/**
 * 小听启动 - 核心启动加载器 v1.0
 *
 * 在关键加载节点打印清晰的阶段日志：
 *   [boot] 1️⃣ ES Module 已导入
 *   [boot] 2️⃣ IndexedDB 就绪
 *   [boot] 3️⃣ 桌面配置加载完成（外观、Dock、Widget、网格、App位置）
 *   [boot] 4️⃣ Settings SDK hydrate 完成
 *   [boot] 5️⃣ 所有 App 注册完成
 *   [boot] 6️⃣ 桌面渲染完成
 *
 * 业务代码可以监听 boot:step-* 事件来在特定阶段执行逻辑。
 */

(function () {
    'use strict';

    const PREFIX = '[boot]';

    // ============================================
    // 步骤定义（按执行顺序）
    // ============================================
    const STEPS = {
        DB_READY: 'db-ready',
        DESKTOP_CONFIG_READY: 'desktop-config-ready',
        SDK_HYDRATED: 'sdk-hydrated',
        ALL_APPS_REGISTERED: 'all-apps-registered',
        DESKTOP_READY: 'desktop-ready',
    };

    const completedSteps = new Set();

    function logStep(step, emoji, msg) {
        console.log(`${PREFIX} ${emoji} [${step}] ${msg}`);
    }

    function dispatchStep(step, detail = {}) {
        if (completedSteps.has(step)) return;
        completedSteps.add(step);
        window.dispatchEvent(new CustomEvent(`boot:${step}`, { detail }));
    }

    // ============================================
    // 数据库就绪检测
    // ============================================
    async function waitForDb() {
        logStep(STEPS.DB_READY, '🔄', '等待 IndexedDB 连接...');
        for (let i = 0; i < 50; i++) {
            if (window.myDb) {
                try {
                    await window.myDb.open();
                    logStep(STEPS.DB_READY, '✅', 'IndexedDB 就绪');
                    dispatchStep(STEPS.DB_READY, { dbName: window.myDb.dbName });
                    return true;
                } catch (e) {}
            }
            await new Promise(r => setTimeout(r, 50));
        }
        logStep(STEPS.DB_READY, '⚠️', 'IndexedDB 超时，使用空状态继续');
        dispatchStep(STEPS.DB_READY, { timeout: true });
        return false;
    }

    // ============================================
    // 桌面统一配置加载（核心步骤！）
    // ============================================
    async function loadDesktopConfig() {
        logStep(STEPS.DESKTOP_CONFIG_READY, '🔄', '加载桌面统一配置...');

        // 等待 desktop-config 模块加载
        for (let i = 0; i < 50; i++) {
            if (window.__desktopConfig) break;
            await new Promise(r => setTimeout(r, 50));
        }

        if (!window.__desktopConfig) {
            logStep(STEPS.DESKTOP_CONFIG_READY, '⚠️', 'desktop-config 模块未加载，跳过');
            dispatchStep(STEPS.DESKTOP_CONFIG_READY, { skipped: true });
            return;
        }

        const config = window.__desktopConfig.get();

        // 从旧存储迁移数据（首次使用时）
        await window.__desktopConfig.migrateAsync();

        // 重新获取（迁移后可能有更新）
        const finalConfig = window.__desktopConfig.get();

        // 提取各项配置信息
        const {
            grid,
            pages,
            widgets,
            dock,
            appearance,
        } = finalConfig;

        // 统计桌面App数量
        const desktopAppCount = pages.reduce((sum, page) => sum + (page.apps?.length || 0), 0);
        const pageCount = pages.length;
        const widgetCount = widgets?.length || 0;
        const dockCount = dock?.order?.length || 0;

        const info = {
            桌面页数: `${pageCount}页`,
            每页App数: `${desktopAppCount}个`,
            网格: `${grid?.rows || 4}行 × ${grid?.columns || 4}列`,
            Dock栏: `${dockCount}个`,
            小组件: `${widgetCount}个`,
        };

        if (appearance.hideCase) {
            info.手机壳 = '隐藏';
        } else {
            info.手机壳 = appearance.caseColor || '默认';
        }
        info.状态栏 = appearance.showStatusBar !== false ? '显示' : '隐藏';

        logStep(STEPS.DESKTOP_CONFIG_READY, '✅', `桌面配置: ${JSON.stringify(info)}`);

        // 如果有Widget，详细列出
        if (widgetCount > 0) {
            const widgetList = widgets.map(w => {
                const pos = `(${w.gridX || 0},${w.gridY || 0})`;
                const size = w.size || 'S';
                return `${w.qualifiedId}${pos}[${size}]`;
            }).join(', ');
            logStep(STEPS.DESKTOP_CONFIG_READY, '✅', `Widgets: ${widgetList}`);
        }

        // 如果有多页，列出每页的App
        if (pageCount > 1) {
            for (const page of pages) {
                const apps = page.apps?.join(', ') || '(空)';
                logStep(STEPS.DESKTOP_CONFIG_READY, '✅', `  📱 ${page.label}: ${apps}`);
            }
        }

        dispatchStep(STEPS.DESKTOP_CONFIG_READY, finalConfig);
    }

    // ============================================
    // Settings SDK 数据预览
    // ============================================
    async function loadSdkData() {
        logStep(STEPS.SDK_HYDRATED, '🔄', '加载 Settings SDK 数据...');

        try {
            // 从 desktop-config 获取激活状态
            const config = window.__desktopConfig?.get();
            const { active } = config || {};
            const activeUserId = active?.userId;
            const activeAiId = active?.aiPersonId;
            const activeWorldId = active?.worldId;

            // 读取数据计数
            const [users, aiPersons, worlds, places] = await Promise.all([
                window.myDb?.getAllRecords?.('sdkUsers') || [],
                window.myDb?.getAllRecords?.('sdkAiPersons') || [],
                window.myDb?.getAllRecords?.('sdkWorlds') || [],
                window.myDb?.getAllRecords?.('sdkPlaces') || [],
            ]);

            const counts = {
                用户: users?.length || 0,
                AI角色: aiPersons?.length || 0,
                世界观: worlds?.length || 0,
                地点: places?.length || 0,
            };

            logStep(STEPS.SDK_HYDRATED, '✅', `SDK数据: ${JSON.stringify(counts)}`);

            // 当前激活
            let activeInfo = '无';
            if (activeUserId) {
                const user = await window.myDb?.get('sdkUsers', activeUserId);
                activeInfo = `用户=${user?.name || activeUserId}`;
            }
            if (activeWorldId) {
                const world = await window.myDb?.get('sdkWorlds', activeWorldId);
                activeInfo += `, 世界=${world?.name || activeWorldId}`;
            }
            if (activeAiId) {
                const ai = await window.myDb?.get('sdkAiPersons', activeAiId);
                activeInfo += `, AI=${ai?.name || activeAiId}`;
            }
            logStep(STEPS.SDK_HYDRATED, '✅', `当前激活: ${activeInfo}`);
            dispatchStep(STEPS.SDK_HYDRATED, { counts, activeUserId, activeAiId, activeWorldId });
        } catch (err) {
            logStep(STEPS.SDK_HYDRATED, '⚠️', `加载失败: ${err.message}`);
            dispatchStep(STEPS.SDK_HYDRATED, { error: err.message });
        }
    }

    // ============================================
    // App 注册完成
    // ============================================
    function onAppsRegistered(apps) {
        const appNames = apps.map(a => a.name || a.id).join(', ');
        logStep(STEPS.ALL_APPS_REGISTERED, '✅', `已注册 ${apps.length} 个 App: ${appNames}`);
        dispatchStep(STEPS.ALL_APPS_REGISTERED, { count: apps.length, apps: appNames });
    }

    // ============================================
    // 桌面渲染完成
    // ============================================
    function onDesktopReady() {
        logStep(STEPS.DESKTOP_READY, '🎉', '桌面渲染完成！');
        logStep(STEPS.DESKTOP_READY, '🎉', '============================================');
        dispatchStep(STEPS.DESKTOP_READY, { timestamp: Date.now() });
    }

    // ============================================
    // 主入口
    // ============================================
    async function boot() {
        console.log('');
        console.log('============================================');
        console.log('  小听启动 v1.0 - 严格加载顺序');
        console.log('============================================');
        console.log('');

        console.log(`${PREFIX} 1️⃣ vite 连接成功`);

        // 等待数据库
        await waitForDb();

        // 等待 desktop-config 模块加载
        await new Promise(r => setTimeout(r, 100));

        // 加载桌面统一配置（核心！）
        await loadDesktopConfig();

        // 加载 SDK 数据
        await loadSdkData();

        // 触发 App 注册完成事件
        window.addEventListener('phone:apps-registered', (e) => {
            onAppsRegistered(e.detail?.apps || []);
        });

        // 触发桌面完成事件
        window.addEventListener('phone:desktop-ready', () => {
            onDesktopReady();
        }, { once: true });

        // 如果桌面已经渲染完成（某些情况下），直接触发
        setTimeout(() => {
            if (!completedSteps.has(STEPS.DESKTOP_READY)) {
                onDesktopReady();
            }
        }, 100);
    }

    // 暴露全局 API
    window.__bootLoader = {
        boot,
        STEPS,
        onAppsRegistered,
        onDesktopReady,
        getCompletedSteps: () => [...completedSteps],
    };

    // 自动启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => boot(), { once: true });
    } else {
        setTimeout(boot, 0);
    }

})();


