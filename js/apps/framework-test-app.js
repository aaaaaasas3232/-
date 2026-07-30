/**
 * 框架测试 App
 * 验证"自动装 app"机制是否工作。
 */
export default function createFrameworkTestApp() {
    return {
        id: 'framework-test',
        name: '框架测试',
        icon: `
            <svg viewBox="0 0 60 60" width="60" height="60" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="6" width="48" height="48" rx="14" fill="rgba(99,102,241,0.95)" />
                <path d="M20 24 L40 24 M20 30 L40 30 M20 36 L32 36" stroke="white" stroke-width="2.4" stroke-linecap="round" />
            </svg>
        `,
        iconBg: 'linear-gradient(145deg, #6366f1 0%, #8b5cf6 100%)',
        background: 'linear-gradient(180deg, #eef2ff 0%, #faf5ff 60%, #ffffff 100%)',
        statusBarColor: '#312e81',
        homeIndicatorColor: 'rgba(49,46,129,0.28)',
        dock: {
            visible: true,
            order: 1
        },
        topbar: {
            visible: true,
            title: '框架测试',
            subtitle: '自动加载机制验证'
        },
        nav: {
            type: 'tab'
        },
        pages: [
            { id: 'home', label: '首页', icon: '◦', nav: true },
            { id: 'about', label: '说明', icon: '◎', nav: true }
        ],
        defaultRootPageId: 'home',
        detailContent: {},
        renderPage(content, page, app) {
            if (page.id === 'home') {
                return `
                    <div class="space-y-4 framework-test-app">
                        <section class="app-card bg-white/76">
                            <div class="text-[22px] font-bold tracking-tight text-slate-900">自动装 App 测试</div>
                            <div class="mt-3 text-sm leading-7 text-slate-600">
                                如果你看到这个 app，说明你不需要手动改 index.html 或 src/index.js。
                                框架扫到了 js/apps/framework-test-app.js 并自动加载。
                            </div>
                        </section>
                        <section class="app-card bg-white/58">
                            <div class="text-sm font-semibold text-slate-800">运行时信息</div>
                            <div class="mt-3 space-y-2 text-[13px] text-slate-600">
                                <div>App ID：<code class="text-violet-700">${app.id}</code></div>
                                <div>App 名称：<code class="text-violet-700">${app.name}</code></div>
                                <div>页面数：<code class="text-violet-700">${app.pages.length}</code></div>
                                <div>数据表：<code class="text-violet-700">${(app.stores || []).map(s => s.name).join(', ') || '（无）'}</code></div>
                            </div>
                        </section>
                    </div>
                `;
            }

            if (page.id === 'about') {
                return `
                    <div class="space-y-4 framework-test-app">
                        <section class="app-card bg-white/76">
                            <div class="text-[18px] font-bold tracking-tight text-slate-900">怎么加一个 App</div>
                            <div class="mt-3 text-sm leading-7 text-slate-600">
                                第一步：在 <code>js/apps/</code> 里新建一个 js 文件（名字随意，例如 <code>my-app.js</code>）<br>
                                第二步：里面只写 <code>registerPhoneApp({...})</code>。<br>
                                第三步：在 <code>js/apps/index.js</code> 清单里加一行。<br>
                                第四步：刷新浏览器。它就在桌上了。无需改 index.html。
                            </div>
                        </section>
                    </div>
                `;
            }

            return window.createDefaultPageRenderer(content, page, app);
        }
    };
}