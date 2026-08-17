/**
 * 设置 App · 软件管理模块
 *
 * 功能:
 * - 查看已安装的插件列表
 * - 上传 JS 文件作为插件安装到系统
 * - 插件启用/禁用/删除/导出
 *
 * UI 设计：人设页风格 · 白色卡片 · 14px圆角 · 蓝色点缀
 *
 * ── 2026-08 第二轮：安装逻辑搬到框架层 ─────────────────────────────
 * 「把一段 JS 变成一个 App」原先整段写在这个文件里。当「App 制作」也需要
 * 同一条路径（问卷做完直接把白膜装到桌面）时，它就有了第二个消费方 ——
 * 于是搬到 `src/core/plugin-installer.js`，本文件退化成纯 UI。
 *
 * 搬家顺便补上的三件事（原来没有）：
 *   - 装之前先静态查 import 语句（插件走 blob URL，任何 import 都解析不了，
 *     而运行时只会报一句看不懂的 "Failed to resolve module specifier"）
 *   - appConfig 字段体检（defaultRootPageId 不在 pages 里 = 打开就白屏）
 *   - 真正的 unregister（原先「禁用」只是把 distribution.installed 改 false，
 *     App 其实还在 registry 里占着 id，重装同 id 会被静默跳过）
 */

import { escapeHtml } from '@/src/core/escape.js';
import { externalAppRegistry } from '@/src/core/app-registry.js';
import {
    getPluginMeta,
    listPlugins,
    installAndPersist,
    enablePlugin,
    disablePlugin,
    removePlugin,
    exportPlugin,
    restoreInstalledPlugins,
} from '@/src/core/plugin-installer.js';

// ============================================
// 工具函数
// ============================================

function swAction(method, payload = {}) {
    const obj = { action: 'appMethod', appId: 'settings', method, payload };
    return `data-app-action='${escapeHtml(JSON.stringify(obj))}'`;
}

// ============================================
// 渲染函数
// ============================================

export function renderSoftwareSection(app) {
    const plugins = listPlugins();

    return `
        <div class="sw-mgr-page">
            ${renderInstallCard(app)}
            ${plugins.length > 0 ? renderPluginList(plugins, app) : renderEmptyState()}
            ${renderDangerCard()}
        </div>
    `;
}

function renderInstallCard(app) {
    return `
        <div class="sw-mgr-card">
            <div class="sw-mgr-card__head">
                <span class="sw-mgr-card__title">安装插件</span>
            </div>
            <div class="sw-mgr-card__body">
                <div class="sw-mgr-upload-zone">
                    <div class="sw-mgr-upload-icon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                    </div>
                    <p class="sw-mgr-upload-hint">上传符合 framework 规范的 .js 文件</p>
                    <input type="file" id="sw-upload-file" accept=".js" style="display:none;" />
                    <button class="sw-mgr-btn sw-mgr-btn--primary sw-mgr-btn--small" ${swAction('swSelectFile')}>
                        选择文件
                    </button>
                </div>
                <div class="sw-mgr-paste">
                    <p class="sw-mgr-upload-hint">也可以把 JS 源码粘到这里保存成插件</p>
                    <textarea id="sw-paste-code" class="sw-mgr-paste__input" rows="8" placeholder="export default function createMyApp() { return { id: 'my-plugin', ... } }"></textarea>
                    <input id="sw-paste-name" class="sw-mgr-paste__name" type="text" placeholder="文件名（可选，默认 pasted-plugin.js）" />
                    <button class="sw-mgr-btn sw-mgr-btn--primary sw-mgr-btn--small" ${swAction('swInstallFromPaste')}>
                        从文本安装
                    </button>
                </div>

                <details class="sw-mgr-plugin-format">
                    <summary>插件格式说明</summary>
                    <pre>export default function createMyApp() {
    const LP = window.__listenPresets;   // 预设库

    return {
        id: 'my-plugin',
        name: '我的插件',
        icon: '&lt;svg viewBox="0 0 24 24"&gt;...&lt;/svg&gt;',
        iconBg: 'linear-gradient(145deg, #A6C0FE, #F68084)',
        distribution: { requiresInstall: false, installed: true },
        pages: [{ id: 'home', label: '首页', icon: '◦', nav: true }],
        defaultRootPageId: 'home',
        renderPage(content, page, app) {
            // ★ 这里没有 this，要用第三个参数 app
            return LP.layouts.page(
                LP.cards.info({ title: 'Hello', body: '插件内容' })
            );
        },
        methods: {
            greet() { this.toolkit.island.notify('success', '你好', ''); },
        },
    };
}</pre>
                    <p><strong>禁止 import。</strong>插件是运行时 blob URL 加载，没有构建步骤，所有别名和相对路径都解析不了。走 <code>window.*</code>：<code>window.__listenPresets</code>、<code>window.settingsSdk</code>、<code>window.__apiSdk</code>（用前判空）。</p>
                    <p><code>methods</code> 用方法简写（箭头函数会丢框架注入的 this）；<code>renderPage</code> 内部不能用 <code>this</code>。上传时系统会先查这几项。</p>
                </details>

                <div class="sw-mgr-notice">
                    <span class="sw-mgr-notice__icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                    </span>
                    <span class="sw-mgr-notice__text"><strong>注意：</strong>请确保上传的文件来源可靠，恶意代码可能导致数据泄露</span>
                </div>
            </div>
        </div>
    `;
}

function renderPluginList(plugins, app) {
    return `
        <div class="sw-mgr-card">
            <div class="sw-mgr-card__head">
                <span class="sw-mgr-card__title">已安装插件</span>
                <span style="font-size:12px;color:rgba(60,60,67,0.5);font-weight:400;">${plugins.length} 个</span>
            </div>
            <div class="sw-mgr-plugin-list" style="padding:0 14px 14px;">
                ${plugins.map(p => renderPluginCard(p)).join('')}
            </div>
        </div>
    `;
}

function renderPluginCard(plugin) {
    const enabled = plugin.enabled !== false;
    const installedAt = plugin.installedAt ? new Date(plugin.installedAt).toLocaleString() : '未知';

    return `
        <div class="sw-mgr-plugin-card ${enabled ? '' : 'is-disabled'}">
            <div class="sw-mgr-plugin-card__header">
                <div class="sw-mgr-plugin-card__info">
                    <div class="sw-mgr-plugin-card__name">${escapeHtml(plugin.name || plugin.appId)}</div>
                    <div class="sw-mgr-plugin-card__meta">
                        <span>${escapeHtml(plugin.appId || plugin.id)}</span>
                        <span>${escapeHtml(installedAt)}</span>
                        ${plugin.hasStores ? '<span class="sw-mgr-plugin-tag">有存储</span>' : ''}
                    </div>
                </div>
                <label class="sw-mgr-toggle" title="${enabled ? '点击禁用' : '点击启用'}">
                    <input type="checkbox" ${enabled ? 'checked' : ''}
                        data-plugin-toggle="${escapeHtml(plugin.id)}" />
                    <span class="sw-mgr-toggle__track"><span class="sw-mgr-toggle__thumb"></span></span>
                </label>
            </div>

            <div class="sw-mgr-plugin-card__body">
                <div class="sw-mgr-plugin-card__actions">
                    <button class="sw-mgr-btn sw-mgr-btn--secondary sw-mgr-btn--small" ${swAction('swReinstall', { id: plugin.id })}>
                        重装
                    </button>
                    <button class="sw-mgr-btn sw-mgr-btn--secondary sw-mgr-btn--small" ${swAction('swExport', { id: plugin.id })}>
                        导出
                    </button>
                    <button class="sw-mgr-btn sw-mgr-btn--danger sw-mgr-btn--small" ${swAction('swDelete', { id: plugin.id })}>
                        删除
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderEmptyState() {
    return `
        <div class="sw-mgr-card">
            <div class="sw-mgr-card__body">
                <div class="sw-mgr-empty">
                    <div class="sw-mgr-empty__icon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <path d="M12 8v8M8 12h8"/>
                        </svg>
                    </div>
                    <span class="sw-mgr-empty__text">暂无已安装的插件</span>
                </div>
            </div>
        </div>
    `;
}

function renderDangerCard() {
    return `
        <div class="sw-mgr-card sw-mgr-card--danger">
            <div class="sw-mgr-card__head">
                <span class="sw-mgr-card__title">恢复插件</span>
            </div>
            <div class="sw-mgr-card__body">
                <p class="sw-mgr-card__sub">重新注册所有已启用插件，适合插件消失后恢复</p>
                <button class="sw-mgr-btn sw-mgr-btn--secondary sw-mgr-btn--small" ${swAction('swRestoreAll')}>
                    恢复所有插件
                </button>
            </div>
        </div>
    `;
}

// ============================================
// 方法构建器
// ============================================

export function buildSoftwareMethods() {
    // 只调 refreshPhoneApps 会更新桌面图标，但 settings 的 software 详情页
    // 不会重画（bridge 看 detailKey 没变 + tick 没动就跳过）。
    // 和 prompt / API 管理同一套：++tick + syncNow({force:true}) + 刷桌面。
    function refresh() {
        if (typeof window === 'undefined') return;
        if (window.__detailRenderTick && typeof window.__detailRenderTick.value === 'number') {
            window.__detailRenderTick.value++;
        }
        const bridge = window.__appRendererBridge;
        if (bridge && typeof bridge.syncNow === 'function') {
            try { bridge.syncNow({ force: true }); } catch (_) {}
        }
        try { window.refreshPhoneApps?.(); } catch (_) {}
    }

    function notifyInstallResult(result) {
        if (!result?.success) {
            this.app.toolkit.island.notify('error', '安装失败', result?.error || '');
            (result?.errors || []).forEach((err) => console.error('[software] 插件错误：', err));
            return;
        }
        (result.warnings || []).forEach((w) => console.warn('[software] 插件提醒：', w));
        if (result.persisted === false) {
            this.app.toolkit.island.notify(
                'warning',
                '已装到桌面',
                `${result.name || result.appId} 装上了，但源码存不下。刷新后会消失，多半是浏览器存储满了。`,
            );
        } else {
            this.app.toolkit.island.notify('success', '安装成功', `${result.name || result.appId} 已装到桌面`);
        }
        refresh();
    }

    return {
        async swInstallFromPaste() {
            const box = document.getElementById('sw-paste-code');
            const nameInput = document.getElementById('sw-paste-name');
            const code = String(box?.value || '');
            if (!code.trim()) {
                this.app.toolkit.island.notify('warning', '没有内容', '先把 JS 粘到文本框里');
                return;
            }
            this.app.toolkit.island.notify('info', '安装中', '正在验证插件...');
            const result = await installAndPersist(code, {
                fileName: String(nameInput?.value || '').trim() || 'pasted-plugin.js',
                source: 'paste',
                allowReplace: true,
            });
            if (result.success && box) box.value = '';
            notifyInstallResult.call(this, result);
        },

        swSelectFile() {
            const input = document.getElementById('sw-upload-file');
            if (!input) {
                this.app.toolkit.island.notify('error', '找不到文件输入', '');
                return;
            }
            input.onchange = async (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = async (evt) => {
                    const code = evt.target?.result;
                    if (!code) {
                        this.app.toolkit.island.notify('error', '读取失败', '无法读取文件内容');
                        return;
                    }

                    this.app.toolkit.island.notify('info', '安装中', '正在验证插件...');
                    const result = await installAndPersist(code, {
                        fileName: file.name,
                        source: 'upload',
                        allowReplace: true,
                    });
                    notifyInstallResult.call(this, result);
                };
                reader.readAsText(file);
                input.value = '';
            };
            input.click();
        },

        async swReinstall({ id }) {
            this.app.toolkit.island.notify('info', '重新安装', '正在验证插件...');
            const result = await enablePlugin(id);
            if (result.success) {
                this.app.toolkit.island.notify('success', '重新安装成功', result.appId || '');
                refresh();
            } else {
                this.app.toolkit.island.notify('error', '重新安装失败', result.error);
            }
        },

        swExport({ id }) {
            const result = exportPlugin(id);
            if (result.success) {
                this.app.toolkit.island.notify('success', '已导出', '');
            } else {
                this.app.toolkit.island.notify('error', '导出失败', result.error);
            }
        },

        async swToggle({ id, enabled }) {
            if (enabled) {
                const result = await enablePlugin(id);
                if (result.success) {
                    this.app.toolkit.island.notify('success', '已启用', result.appId || '');
                } else {
                    this.app.toolkit.island.notify('error', '启用失败', result.error);
                }
            } else {
                const result = disablePlugin(id);
                if (result.success) this.app.toolkit.island.notify('info', '已禁用', '');
            }
            refresh();
        },

        async swDelete({ id }) {
            const plugin = getPluginMeta()[id];
            if (!plugin) return;

            const confirmed = window.confirm(`确定要删除插件「${plugin.name || plugin.appId}」吗？此操作不可恢复。`);
            if (!confirmed) return;

            const result = removePlugin(id);
            if (result.success) {
                this.app.toolkit.island.notify('info', '已删除', plugin.name || plugin.appId);
            }
            refresh();
        },

        async swRefreshApps() {
            if (typeof window.refreshPhoneApps === 'function') {
                window.refreshPhoneApps();
                this.app.toolkit.island.notify('success', '已刷新', '桌面应用已更新');
            }
        },

        async swRestoreAll() {
            this.app.toolkit.island.notify('info', '恢复中', '正在重新注册所有已启用插件...');
            await restoreInstalledPlugins();
            refresh();
            this.app.toolkit.island.notify('success', '恢复完成', '');
        },
    };
}

// ============================================
// 全局事件处理器
// ============================================

if (typeof window !== 'undefined') {
    // 插件开关事件
    document.addEventListener('change', (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;

        const pluginToggle = target.getAttribute('data-plugin-toggle');
        if (pluginToggle !== null && target.type === 'checkbox') {
            const enabled = target.checked;
            const pluginId = pluginToggle;

            const meta = getPluginMeta();
            const plugin = meta[pluginId];
            if (!plugin) return;

            const settingsApp = externalAppRegistry.getApp('settings');
            settingsApp?.methods?.swToggle?.({ id: pluginId, enabled });
        }
    }, true);
}

export function handleSoftwareChange(event) {
    // 主要事件已在模块加载时注册
}

export function handleSoftwareClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const shell = target.closest('.app-shell');
    if (!shell) return;
}
