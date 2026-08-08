/**
 * 设置 App · 软件管理模块
 *
 * 功能：
 * - 查看已安装的插件列表
 * - 上传 JS 文件作为插件安装
 * - 插件启用/禁用
 * - 插件删除
 *
 * UI设计：蓝色辅白色主，简洁大方，禁用渐变和emoji
 */

import { escapeHtml } from '@/src/core/escape.js';

// ============================================
// 工具函数
// ============================================

function swAction(method, payload = {}) {
    const obj = { action: 'appMethod', appId: 'settings', method, payload };
    return `data-app-action='${escapeHtml(JSON.stringify(obj))}'`;
}

function uid(prefix = 'plugin') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================
// 插件存储 (使用 localStorage 作为插件元数据存储)
// ============================================

const PLUGIN_META_KEY = 'xiaoting_plugins_meta';

function getPluginMeta() {
    try {
        return JSON.parse(localStorage.getItem(PLUGIN_META_KEY) || '{}');
    } catch (e) {
        return {};
    }
}

function savePluginMeta(meta) {
    localStorage.setItem(PLUGIN_META_KEY, JSON.stringify(meta));
}

// ============================================
// 插件代码存储
// ============================================

function getPluginCodeStore() {
    return 'pluginCode';
}

// ============================================
// 插件注册到框架
// ============================================

async function registerPluginToFramework(pluginId, code) {
    // 创建插件的唯一模块 URL
    const blob = new Blob([code], { type: 'application/javascript' });
    const moduleUrl = URL.createObjectURL(blob);

    try {
        // 使用动态 import 加载插件代码
        const module = await import(/* @vite-ignore */ moduleUrl);

        // 检查是否是有效的 appConfig
        if (module && typeof module.default === 'function') {
            const appConfig = module.default();

            // 检查是否已有同名 app
            const existingApps = window.__phoneAppFactories || [];
            const existingIds = existingApps.map(f => {
                const cfg = f();
                return cfg?.id;
            });

            if (existingIds.includes(appConfig.id)) {
                // 移除旧版本
                const idx = existingIds.indexOf(appConfig.id);
                if (idx >= 0) {
                    existingApps.splice(idx, 1);
                }
            }

            // 注册新版本
            existingApps.push(module.default);
            window.__phoneAppFactories = existingApps;

            // 刷新应用
            if (typeof window.refreshPhoneApps === 'function') {
                window.refreshPhoneApps();
            }

            return { success: true, appId: appConfig.id };
        }

        return { success: false, error: '不是有效的 App 模块' };
    } catch (err) {
        return { success: false, error: err.message };
    } finally {
        // 清理 blob URL
        URL.revokeObjectURL(moduleUrl);
    }
}

async function unregisterPluginFromFramework(pluginId) {
    const meta = getPluginMeta();
    const pluginMeta = meta[pluginId];
    if (!pluginMeta) return { success: false, error: '插件不存在' };

    // 从已注册的应用中移除
    const existingApps = window.__phoneAppFactories || [];
    const toRemove = [];

    for (let i = existingApps.length - 1; i >= 0; i--) {
        try {
            const cfg = existingApps[i]();
            if (cfg && cfg.id === pluginMeta.appId) {
                toRemove.push(i);
            }
        } catch (e) {
            // 忽略无效工厂
        }
    }

    for (const idx of toRemove) {
        existingApps.splice(idx, 1);
    }

    window.__phoneAppFactories = existingApps;

    // 刷新应用
    if (typeof window.refreshPhoneApps === 'function') {
        window.refreshPhoneApps();
    }

    return { success: true };
}

// ============================================
// 渲染函数
// ============================================

export function renderSoftwareSection(app) {
    const meta = getPluginMeta();
    const plugins = Object.entries(meta).map(([id, data]) => ({ id, ...data }));
    const db = window.myDb;

    return `
        <div class="sw-mgr-page">
            ${renderHeader(app)}
            ${renderPluginList(plugins, app)}
        </div>
    `;
}

function renderHeader(app) {
    return `
        <div class="sw-mgr-content">
            <div class="sw-mgr-section">
                <div class="sw-mgr-section-title">安装插件</div>
                <p class="sw-mgr-desc">上传符合框架规范的 JS 文件作为插件安装到系统中</p>

                <div class="sw-mgr-upload-zone">
                    <input type="file" id="sw-upload-file" accept=".js" style="display:none;" />
                    <button class="sw-mgr-btn sw-mgr-btn--primary" ${swAction('swSelectFile')}>
                        选择 JS 文件
                    </button>
                    <p class="sw-mgr-upload-hint">支持符合 App 规范的 .js 文件</p>
                </div>

                <div class="sw-mgr-notice">
                    <strong>注意：</strong>请确保上传的文件来源可靠
                </div>
            </div>
        </div>
    `;
}

function renderPluginList(plugins, app) {
    if (plugins.length === 0) {
        return `
            <div class="sw-mgr-content">
                <div class="sw-mgr-section">
                    <div class="sw-mgr-section-title">已安装插件</div>
                    <div class="sw-mgr-empty">
                        <p>暂无已安装的插件</p>
                    </div>
                </div>
            </div>
        `;
    }

    return `
        <div class="sw-mgr-content">
            <div class="sw-mgr-section">
                <div class="sw-mgr-section-title">已安装插件 (${plugins.length})</div>
                <div class="sw-mgr-plugin-list">
                    ${plugins.map(p => renderPluginCard(p)).join('')}
                </div>
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
                        <span>ID: ${escapeHtml(plugin.appId || plugin.id)}</span>
                        <span>安装: ${escapeHtml(installedAt)}</span>
                    </div>
                </div>
                <label class="sw-mgr-toggle" title="${enabled ? '点击禁用' : '点击启用'}">
                    <input type="checkbox" ${enabled ? 'checked' : ''}
                        data-plugin-toggle="${escapeHtml(plugin.id)}" />
                    <span class="sw-mgr-toggle__track"><span class="sw-mgr-toggle__thumb"></span></span>
                </label>
            </div>

            <div class="sw-mgr-plugin-card__actions">
                <button class="sw-mgr-btn sw-mgr-btn--small" ${swAction('swReinstall', { id: plugin.id })}>
                    重新安装
                </button>
                <button class="sw-mgr-btn sw-mgr-btn--small sw-mgr-btn--danger" ${swAction('swDelete', { id: plugin.id })}>
                    删除
                </button>
            </div>
        </div>
    `;
}

// ============================================
// 方法构建器
// ============================================

export function buildSoftwareMethods() {
    function refresh() {
        try { window.refreshPhoneApps?.(); } catch (_) {}
    }

    return {
        swSelectFile() {
            const input = document.getElementById('sw-upload-file');
            if (input) {
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

                        // 显示安装中状态
                        this.app.toolkit.island.notify('info', '安装中', '正在验证插件...');

                        // 尝试注册插件
                        const pluginId = uid('plugin');
                        const result = await registerPluginToFramework(pluginId, code);

                        if (result.success) {
                            // 保存插件元数据
                            const meta = getPluginMeta();
                            meta[pluginId] = {
                                id: pluginId,
                                appId: result.appId,
                                name: result.appId,
                                code: code,
                                installedAt: Date.now(),
                                enabled: true,
                            };
                            savePluginMeta(meta);

                            this.app.toolkit.island.notify('success', '安装成功', `插件 ${result.appId} 已安装`);
                            refresh();
                        } else {
                            this.app.toolkit.island.notify('error', '安装失败', result.error);
                        }
                    };
                    reader.readAsText(file);

                    // 清空input
                    input.value = '';
                };
                input.click();
            }
        },

        async swReinstall({ id }) {
            const meta = getPluginMeta();
            const plugin = meta[id];
            if (!plugin) {
                this.app.toolkit.island.notify('error', '插件不存在', '');
                return;
            }

            this.app.toolkit.island.notify('info', '重新安装', '正在验证插件...');
            const result = await registerPluginToFramework(id, plugin.code);

            if (result.success) {
                meta[id].enabled = true;
                savePluginMeta(meta);
                this.app.toolkit.island.notify('success', '重新安装成功', '');
                refresh();
            } else {
                this.app.toolkit.island.notify('error', '重新安装失败', result.error);
            }
        },

        async swToggle({ id, enabled }) {
            const meta = getPluginMeta();
            const plugin = meta[id];
            if (!plugin) return;

            if (enabled) {
                const result = await registerPluginToFramework(id, plugin.code);
                if (result.success) {
                    meta[id].enabled = true;
                    savePluginMeta(meta);
                    this.app.toolkit.island.notify('success', '已启用', plugin.appId);
                } else {
                    this.app.toolkit.island.notify('error', '启用失败', result.error);
                }
            } else {
                await unregisterPluginFromFramework(id);
                meta[id].enabled = false;
                savePluginMeta(meta);
                this.app.toolkit.island.notify('info', '已禁用', plugin.appId);
            }

            refresh();
        },

        async swDelete({ id }) {
            const meta = getPluginMeta();
            const plugin = meta[id];
            if (!plugin) return;

            const confirmed = window.confirm(`确定要删除插件「${plugin.name || plugin.appId}」吗？此操作不可恢复。`);
            if (!confirmed) return;

            // 从框架移除
            await unregisterPluginFromFramework(id);

            // 删除元数据
            delete meta[id];
            savePluginMeta(meta);

            this.app.toolkit.island.notify('info', '已删除', plugin.name || plugin.appId);
            refresh();
        },

        async swRefreshApps() {
            if (typeof window.refreshPhoneApps === 'function') {
                window.refreshPhoneApps();
                this.app.toolkit.island.notify('success', '已刷新', '桌面应用已更新');
            }
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

            if (enabled) {
                // 启用插件
                registerPluginToFramework(pluginId, plugin.code).then(result => {
                    if (result.success) {
                        plugin.enabled = true;
                        savePluginMeta(meta);
                        window.settingsApp?.toolkit?.island?.notify('success', '已启用', plugin.appId);
                    } else {
                        target.checked = false;
                        window.settingsApp?.toolkit?.island?.notify('error', '启用失败', result.error);
                    }
                    try { window.refreshPhoneApps?.(); } catch (_) {}
                });
            } else {
                // 禁用插件
                unregisterPluginFromFramework(pluginId).then(() => {
                    plugin.enabled = false;
                    savePluginMeta(meta);
                    window.settingsApp?.toolkit?.island?.notify('info', '已禁用', plugin.appId);
                    try { window.refreshPhoneApps?.(); } catch (_) {}
                });
            }
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
