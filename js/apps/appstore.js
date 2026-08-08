import { externalAppRegistry } from '@/src/core/app-registry.js';
import {
    APP_INSTALLATION_CHANGED_EVENT,
    installApp,
    isAppInstalled,
    requiresAppInstallation,
} from '@/src/core/app-installation.js';
import { escapeHtml } from '@/src/core/escape.js';

const APP_STORE_ICON = `
    <svg viewBox="0 0 60 60" width="56" height="56" xmlns="http://www.w3.org/2000/svg" style="display:block;">
        <defs>
            <linearGradient id="appstore-tile" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#5AC8FA" />
                <stop offset="100%" stop-color="#007AFF" />
            </linearGradient>
        </defs>
        <rect width="60" height="60" rx="14" fill="url(#appstore-tile)" />
        <path d="M20 42h20M25 38l11-20M35 38L24 18" fill="none" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round" />
    </svg>
`;

const TAB_DEFS = [
    { id: 'today', label: '今天', icon: '' },
    { id: 'games', label: '游戏', icon: '' },
    { id: 'apps', label: 'App', icon: '' },
];

const DEFAULT_STORE_META = Object.freeze({
    subtitle: '为小听打造的应用',
    category: '工具',
    isGame: false,
    rating: 4.8,
    ratingsCount: '新上架',
    size: '内置',
    age: '4+',
    version: '1.0.0',
    whatsNew: '优化使用体验与系统兼容性。',
    description: '这款 App 已适配小听系统，可从 App Store 直接打开。',
    accent: 'linear-gradient(145deg, #8EC5FC 0%, #E0C3FC 100%)',
});

function getStoreMeta(app) {
    return {
        ...DEFAULT_STORE_META,
        ...(app?.distribution?.appStore || {}),
    };
}

function listStoreApps() {
    return externalAppRegistry.apps
        .filter(app => app?.id && app.id !== 'appstore')
        .map((app, index) => ({
            id: app.id,
            app,
            icon: app.icon || '',
            name: app.name || app.id,
            rank: index + 1,
            requiresInstall: requiresAppInstallation(app),
            ...getStoreMeta(app),
        }));
}

function dispatchOpenApp(appId) {
    window.dispatchEvent(new CustomEvent('app:page-action', {
        detail: { action: 'openApp', appId },
    }));
}

function createStoreComponent(initialTab) {
    return {
        props: { app: Object },
        data() {
            return {
                tab: initialTab,
                selectedAppId: '',
                installedVersion: 0,
                downloads: {},
                expanded: {},
                downloadTimers: new Map(),
            };
        },
        computed: {
            catalog() {
                void this.installedVersion;
                return listStoreApps();
            },
            games() {
                return this.catalog.filter(item => item.isGame);
            },
            regularApps() {
                return this.catalog.filter(item => !item.isGame);
            },
            selectedApp() {
                return this.catalog.find(item => item.id === this.selectedAppId) || null;
            },
            featuredApps() {
                const downloadable = this.catalog.find(item => item.requiresInstall && !this.isInstalled(item));
                return [downloadable, ...this.catalog.filter(item => item.id !== downloadable?.id)].filter(Boolean).slice(0, 3);
            },
            todayDate() {
                const now = new Date();
                const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
                return `${now.getMonth() + 1}月${now.getDate()}日 ${weekDays[now.getDay()]}`;
            },
        },
        methods: {
            storeMeta(item) {
                return getStoreMeta(item?.app);
            },
            isInstalled(item) {
                return isAppInstalled(item?.app);
            },
            isDownloading(item) {
                return !!this.downloads[item?.id];
            },
            progress(item) {
                return this.downloads[item?.id]?.progress || 0;
            },
            progressStyle(item) {
                const progress = this.progress(item);
                return { background: `conic-gradient(#FF69B4 ${progress * 3.6}deg, #D1D1D6 0deg)` };
            },
            openDetail(item) {
                this.selectedAppId = item.id;
            },
            closeDetail() {
                this.selectedAppId = '';
            },
            buttonLabel(item) {
                if (this.isDownloading(item)) return `${this.progress(item)}%`;
                return this.isInstalled(item) ? '打开' : '获取';
            },
            handlePrimary(item) {
                if (this.isDownloading(item)) return;
                if (this.isInstalled(item)) {
                    dispatchOpenApp(item.id);
                    return;
                }
                this.startDownload(item);
            },
            startDownload(item) {
                if (!item?.requiresInstall || this.isDownloading(item)) return;
                const startedAt = Date.now();
                const duration = 3200;
                this.downloads[item.id] = { progress: 1 };
                const timer = window.setInterval(() => {
                    const elapsed = Date.now() - startedAt;
                    const progress = Math.min(100, Math.max(1, Math.round((elapsed / duration) * 100)));
                    this.downloads[item.id].progress = progress;
                    if (progress < 100) return;
                    window.clearInterval(timer);
                    this.downloadTimers.delete(item.id);
                    delete this.downloads[item.id];
                    // 单一真相在 appConfig.distribution.installed：写回 app 自身 + 持久化 + 派发事件
                    installApp(item.id, item.app);
                    this.installedVersion += 1;
                    this.app.toolkit.island.notify('success', '下载完成', `${item.name} 已添加到桌面`);
                }, 80);
                this.downloadTimers.set(item.id, timer);
            },
            toggleExpanded(key) {
                this.expanded[key] = !this.expanded[key];
            },
            isExpanded(key) {
                return !!this.expanded[key];
            },
            ratingStars(rating) {
                const safeRating = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
                return '★'.repeat(safeRating) + '☆'.repeat(5 - safeRating);
            },
            onInstallationChanged() {
                this.installedVersion += 1;
            },
        },
        mounted() {
            window.addEventListener(APP_INSTALLATION_CHANGED_EVENT, this.onInstallationChanged);
        },
        beforeUnmount() {
            window.removeEventListener(APP_INSTALLATION_CHANGED_EVENT, this.onInstallationChanged);
            for (const timer of this.downloadTimers.values()) window.clearInterval(timer);
            this.downloadTimers.clear();
        },
        template: `
            <div class="appstore-app appstore-fade-enter">
                <template v-if="selectedApp">
                    <div class="appstore-vue-detail-bar">
                        <button type="button" class="appstore-back-button" @click="closeDetail">‹ App Store</button>
        </div>
                    <article class="appstore-detail appstore-fade-enter">
                        <div class="appstore-detail-hero">
                            <div class="appstore-detail-hero-img appstore-icon-frame" :style="{ background: selectedApp.app.iconBg || 'transparent' }" v-html="selectedApp.icon"></div>
                            <div class="appstore-detail-hero-body">
                                <div class="appstore-detail-name">{{ selectedApp.name }}</div>
                                <div class="appstore-detail-sub">{{ selectedApp.subtitle }}</div>
                                <div class="appstore-detail-cta">
                                    <button type="button" class="appstore-btn appstore-btn-large" :class="isInstalled(selectedApp) ? 'appstore-btn-open' : 'appstore-btn-get'" :disabled="isDownloading(selectedApp)" @click="handlePrimary(selectedApp)">
                                        <span v-if="isDownloading(selectedApp)" class="appstore-download-ring" :style="progressStyle(selectedApp)"><i></i></span>
                                        <span>{{ buttonLabel(selectedApp) }}</span>
                                    </button>
                    </div>
                </div>
            </div>
            <div class="appstore-stats">
                <div class="appstore-stats-cell">
                                <div class="appstore-stats-cell-cap">{{ selectedApp.ratingsCount }} 个评分</div>
                                <div class="appstore-stats-cell-val">{{ selectedApp.rating }}</div>
                                <div class="appstore-rating-stars">{{ ratingStars(selectedApp.rating) }}</div>
                </div>
                <div class="appstore-stats-cell">
                    <div class="appstore-stats-cell-cap">年龄</div>
                                <div class="appstore-stats-cell-val">{{ selectedApp.age }}</div>
                    <div class="appstore-stats-cell-foot">岁</div>
                </div>
                <div class="appstore-stats-cell">
                                <div class="appstore-stats-cell-cap">类别</div>
                                <div class="appstore-stats-cell-val appstore-stat-category">{{ selectedApp.category }}</div>
                                <div class="appstore-stats-cell-foot">App</div>
                </div>
            </div>
                        <section class="appstore-section appstore-detail-preview">
                <div class="appstore-section-heading"><h3>预览</h3></div>
                            <div class="appstore-preview-card" :style="{ background: selectedApp.accent }">
                                <div class="appstore-preview-icon appstore-icon-frame" :style="{ background: selectedApp.app.iconBg || 'transparent' }" v-html="selectedApp.icon"></div>
                                <strong>{{ selectedApp.name }}</strong>
                                <span>{{ selectedApp.subtitle }}</span>
                </div>
                        </section>
                        <section class="appstore-section">
                            <div class="appstore-section-heading"><h3>新功能</h3><span class="appstore-section-heading-sub">版本 {{ selectedApp.version }}</span></div>
                            <div class="appstore-text" :class="isExpanded('new-' + selectedApp.id) ? '' : 'clamp-3'">{{ selectedApp.whatsNew }}</div>
                            <button type="button" class="appstore-expand-btn appstore-text-button" @click="toggleExpanded('new-' + selectedApp.id)">{{ isExpanded('new-' + selectedApp.id) ? '收起' : '更多' }}</button>
                        </section>
                        <section class="appstore-section">
                <div class="appstore-section-heading"><h3>描述</h3></div>
                            <div class="appstore-text" :class="isExpanded('desc-' + selectedApp.id) ? '' : 'clamp-4'">{{ selectedApp.description }}</div>
                            <button type="button" class="appstore-expand-btn appstore-text-button" @click="toggleExpanded('desc-' + selectedApp.id)">{{ isExpanded('desc-' + selectedApp.id) ? '收起' : '更多' }}</button>
                        </section>
                        <section class="appstore-section">
                            <div class="appstore-row"><span class="appstore-row-label">供应商</span><span class="appstore-row-value">XiaoTing Studio</span></div>
                            <div class="appstore-row"><span class="appstore-row-label">大小</span><span class="appstore-row-value">{{ selectedApp.size }}</span></div>
                            <div class="appstore-row"><span class="appstore-row-label">兼容性</span><span class="appstore-row-value">小听系统</span></div>
                        </section>
                    </article>
                </template>

                <template v-else>
                    <header class="appstore-topbar">
                        <div v-if="tab === 'today'" class="appstore-date">{{ todayDate }}</div>
                        <div class="appstore-title">{{ tab === 'today' ? '今天' : (tab === 'games' ? '游戏' : 'App') }}</div>
                    </header>

                    <template v-if="tab === 'today'">
                        <section v-for="item in featuredApps" :key="item.id" class="appstore-section">
                            <article class="appstore-featured" @click="openDetail(item)">
                                <div class="appstore-featured-cover" :style="{ background: item.accent }">
                                    <div class="appstore-featured-tag">{{ item.requiresInstall && !isInstalled(item) ? '全新 APP' : '系统精选' }}</div>
                                    <div class="appstore-featured-icon appstore-icon-frame" :style="{ background: item.app.iconBg || 'transparent' }" v-html="item.icon"></div>
            </div>
                                <div class="appstore-featured-meta">
                                    <div class="appstore-featured-meta-img appstore-icon-frame" :style="{ background: item.app.iconBg || 'transparent' }" v-html="item.icon"></div>
                                    <div class="appstore-featured-meta-text">
                                        <div class="appstore-featured-meta-title">{{ item.name }}</div>
                                        <div class="appstore-featured-meta-sub">{{ item.subtitle }}</div>
            </div>
                                    <button type="button" class="appstore-btn" :class="isInstalled(item) ? 'appstore-btn-open' : 'appstore-btn-get'" :disabled="isDownloading(item)" @click.stop="handlePrimary(item)">
                                        <span v-if="isDownloading(item)" class="appstore-download-ring" :style="progressStyle(item)"><i></i></span>
                                        <span>{{ buttonLabel(item) }}</span>
                                    </button>
            </div>
                            </article>
                        </section>
                    </template>

                    <section v-else class="appstore-section">
                        <h2 class="appstore-section-head">{{ tab === 'games' ? '游戏精选' : '系统 App' }}</h2>
                        <div v-if="(tab === 'games' ? games : regularApps).length" class="appstore-list">
                            <article v-for="(item, index) in (tab === 'games' ? games : regularApps)" :key="item.id" class="appstore-list-item" @click="openDetail(item)">
                                <div class="appstore-list-rank">{{ index + 1 }}</div>
                                <div class="appstore-list-icon appstore-icon-frame" :style="{ background: item.app.iconBg || 'transparent' }" v-html="item.icon"></div>
                                <div class="appstore-list-text">
                                    <div class="appstore-list-name">{{ item.name }}</div>
                                    <div class="appstore-list-sub">{{ item.subtitle }}</div>
        </div>
                                <button type="button" class="appstore-btn" :class="isInstalled(item) ? 'appstore-btn-open' : 'appstore-btn-get'" :disabled="isDownloading(item)" @click.stop="handlePrimary(item)">
                                    <span v-if="isDownloading(item)" class="appstore-download-ring" :style="progressStyle(item)"><i></i></span>
                                    <span>{{ buttonLabel(item) }}</span>
                                </button>
                            </article>
            </div>
                        <div v-else class="appstore-empty"><div class="appstore-empty-text">暂无游戏</div></div>
                    </section>
                    <div class="appstore-tab-spacer"></div>
                </template>
            </div>
        `,
    };
}

export default function createAppStoreApp() {
    return {
        id: 'appstore',
        name: 'App Store',
        icon: APP_STORE_ICON,
        iconBg: 'linear-gradient(135deg, #5AC8FA, #007AFF)',
        distribution: {
            appStore: {
                subtitle: '发现为小听打造的 App',
                category: '工具',
                accent: 'linear-gradient(145deg, #5AC8FA 0%, #007AFF 100%)',
            },
        },
        background: '#F2F2F7',
        homeIndicatorColor: 'rgba(0,0,0,0.3)',
        statusBarColor: '#000000',
        topbar: { visible: false },
        nav: { type: 'tab', order: 0 },
        pages: TAB_DEFS.map(tab => ({ ...tab, nav: true })),
        defaultRootPageId: 'today',
        renderMode: 'vue',
        renderPage(content, page) {
            return createStoreComponent(page?.id || 'today');
        },
        widgets: [
            {
                id: 'appstore-featured',
                label: '精选',
                icon: APP_STORE_ICON,
                iconBg: '#007AFF',
                defaultSize: 'S',
                defaultOrientation: 'h',
                render(size, payload = {}) {
                    const label = escapeHtml(payload.label || '精选');
                    return `<div style="padding:12px 14px;background:linear-gradient(135deg,#5AC8FA,#007AFF);height:100%;box-sizing:border-box;color:#fff;border-radius:18px;display:flex;flex-direction:column;justify-content:space-between;"><div style="font-size:12px;font-weight:700;opacity:.82;">APP STORE</div><div style="font-size:18px;font-weight:700;">${label}</div></div>`;
                },
            },
        ],
    };
}
