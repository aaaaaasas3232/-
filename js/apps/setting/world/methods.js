/**
 * 世界观模块 · 业务方法（v0.17）
 *
 * 覆盖图书馆全部交互：
 *   - 路由 (worldRoute)
 *   - 世界观库 / 世界观 (group + world CRUD + 移动 + 导入导出)
 *   - ★ 时间线 (personal + world)
 *   - ★ 时间锚点 (anchor: range / point)
 *   - 草稿 (drafts)
 *   - 导入导出
 *   - ★ v0.17 移除：标签、快照、社媒、App绑定、上下文注入
 *
 * 设计原则：
 *   - 每个 method 自己负责成功提示（toolkit.island.notify）和 refresh
 *   - DOM 取值一律走 `data-*-field` 前缀约定 + `fieldValue(sel)` 工具
 *   - 路由状态都收在 `app.state.world`
 */

// ============================================
import {
    WORLD_GROUP_FORM_SCHEMA,
    TIMELINE_FORM_SCHEMA,
    CHRONICLE_EVENT_FORM_SCHEMA,
    ANCHOR_FORM_SCHEMA,
    LOCATION_FORM_SCHEMA,
    PLACE_FORM_SCHEMA,
    WORLD_FORM_SCHEMA,
    safeJSONOr,
} from './sdk/form-schema.js';
import { readForm } from './sdk/form-reader.js';

const refresh = () => {
    window.refreshPhoneApps?.();
    // 强制让 Vue 重新评估 currentDetailView 等 reactive 链，
    // 这样 detail 内的 renderPage / renderWorldLibrary 才会重新执行。
    const appsRef = typeof window !== 'undefined' ? window.__phoneAppsRef : null;
    if (appsRef && Array.isArray(appsRef.value)) {
        appsRef.value = [...appsRef.value];
    }
    const tickRef = typeof window !== 'undefined' ? window.__detailRenderTick : null;
    if (tickRef && typeof tickRef.value === 'number') {
        tickRef.value = tickRef.value + 1;
    }
    // 重新挂载时间轴拖拽事件（每次 v-html 重建后元素是新节点）
    if (typeof window !== 'undefined' && typeof window.__wvAttachTimelineDrag === 'function') {
        // requestAnimationFrame 等 v-html 完成再 attach
        requestAnimationFrame(() => {
            try { window.__wvAttachTimelineDrag(); } catch (_) {}
        });
    }
};

/**
 * 滑块拖动期间的高频局部同步（不触发整页 re-render）。
 * 直接 mutate DOM：
 *   - 找到 .wv-map__world 改 transform: scale(z)
 *   - 改 pin 上的 --pin-scale 变量与 .wv-map__zoom-val 文字
 * 只在 step 跨步时(本工具里是每 0.25 一次)才被调用,因此也额外做一次 rAF 合并。
 */
let _syncZoomRaf = 0;
const syncZoomDom = (zoom) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (_syncZoomRaf) return;
    _syncZoomRaf = window.requestAnimationFrame(() => {
        _syncZoomRaf = 0;
        try {
            const world = document.querySelector('.wv-map__world');
            if (world) world.style.transform = `scale(${zoom})`;
            // 计算反向缩放（与 library.js 的 invZoom 公式保持一致）
            const inv = Math.max(0.35, 1 - (zoom - 1) * 0.08);
            document.querySelectorAll('.wv-map__pin').forEach(pin => {
                pin.style.setProperty('--pin-scale', inv.toFixed(4));
            });
            // 滑块后的百分比文字
            const pct = (zoom * 100).toFixed(0);
            document.querySelectorAll('[data-wv-zoom-val]').forEach(el => {
                el.textContent = `${pct}%`;
            });
            // slider 填充指示
            const min = 0.25, max = 5;
            const fillPct = Math.max(0, Math.min(100, ((zoom - min) / (max - min)) * 100));
            document.querySelectorAll('[data-wv-zoom]').forEach(input => {
                input.style.setProperty('--wv-zoom-fill', `${fillPct.toFixed(2)}%`);
            });
        } catch (e) {
            // 静默：失败就让下次 refresh 接管
        }
    });
};

/** 从 DOM 取 input / textarea 值（trim，缺失返回 fallback）。 */
const fieldValue = (sel, fallback = '') =>
    document.querySelector(sel)?.value?.trim() ?? fallback;

/** app.state.world 路由状态保证存在。 */
const getRoute = (app) => app.state.world || (app.state.world = {});

/**
 * 获取当前世界观：优先使用 route.currentWorldId（用户已进入的世界），
 * 否则使用 sdk.worlds.getActive()（全局当前世界）。
 * 需要传入 app 和 sdk。
 */
const getCurrentWorld = (app, sdk) => {
    const route = getRoute(app);
    if (route.currentWorldId) {
        return sdk.worlds.get(route.currentWorldId);
    }
    return sdk.worlds.getActive();
};

/** 找出某个 world 所属的 groupId（用于导航一致性）。 */
const worldGroupOf = (sdk, worldId) => {
    if (!sdk || !worldId) return undefined;
    const world = sdk.worlds.get?.(worldId);
    return world?.groupRef ?? null;
};

/** 收集所有 data-world-field / data-*-field 输入到对象。 */
const collectFields = (selector) => {
    const out = {};
    document.querySelectorAll(selector).forEach(el => {
        const k = el.getAttribute(selector.replace('[', '').replace(']', ''));
        if (!k) return;
        if (el.type === 'checkbox') out[k] = el.checked;
        else out[k] = el.value;
    });
    return out;
};

/** 安全地解析 JSON，失败回退 fallback。 */
const safeJSON = (text, fallback = null) => safeJSONOr(text, fallback);

/** 统一提示：避免重复 4 行代码。 */
const notify = function(toolkit, state, title, msg) {
    toolkit?.island?.notify?.(state, title, msg);
};

/**
 * 通过 framework 的全局 app:page-action 通道弹出确认弹窗。
 * 用户点确认后会异步调用 onConfirm；点取消则什么都不做。
 *
 * 字段:
 *   - title        弹窗标题
 *   - text         弹窗正文（多行也支持）
 *   - confirmLabel 确认按钮文案，默认「确定」
 *   - danger       是否显示为危险样式（红色按钮）
 *   - onConfirm    确认后执行的函数（async 会被 await，错误会打到 console）
 */
const openConfirmModal = ({
    title = '确认操作',
    text = '',
    confirmLabel = '确定',
    danger = false,
    onConfirm = null,
} = {}) => {
    if (typeof window === 'undefined') return;
    const payload = { title, text, confirmLabel, danger };
    if (typeof onConfirm === 'function') {
        payload.onConfirm = () => {
            try {
                const ret = onConfirm();
                if (ret && typeof ret.catch === 'function') {
                    ret.catch((err) => console.error('[confirm-modal] onConfirm 失败', err));
                }
            } catch (err) {
                console.error('[confirm-modal] onConfirm 执行失败', err);
            }
        };
    }
    window.dispatchEvent(new CustomEvent('app:page-action', {
        detail: { action: 'modal', modalType: 'confirm', payload },
    }));
};

// ============================================
// 字段读取器
// ============================================

/** 世界观编辑表单（含完整字段：基础 / 版本 / 日历 / 节假日 / 聚合）。 */
const readWorldForm = () => readForm(WORLD_FORM_SCHEMA, {});

/** 仅读「★ 纪时系统」一节。返回 { chronologySettings: {...} }。 */
const readChronologySectionForm = () => {
    const all = readForm(WORLD_FORM_SCHEMA, {});
    return { chronologySettings: all.chronologySettings || {} };
};

const readWorldGroupForm = () => readForm(WORLD_GROUP_FORM_SCHEMA, {});

const readTagGroupForm = () => readForm(TAG_GROUP_FORM_SCHEMA, {});

const readLocationForm = () => readForm(LOCATION_FORM_SCHEMA, {});

const readPlaceForm = () => readForm(PLACE_FORM_SCHEMA, {});

const readTimelineForm = (ownerKey = 'user') => ({
    ...readForm(TIMELINE_FORM_SCHEMA, {}),
    ownerKey,
});

// ============================================
// 工厂
// ============================================

export function buildWorldMethods() {
    return {
        /* ============================================
         * 路由
         * ============================================ */
        worldOpenLibrary() {
            const route = getRoute(this.app);
            route.sub = 'worlds';
            delete route.currentWorldId;
            delete route.currentGroupId;
            ['editingId', 'editingChronologyId', 'editingGroupId', 'editingLocationId',
                'editingTimelineOwner',
                'editingAppBinding', 'editingAnchorId', 'editingCurrencyId'].forEach(k => delete route[k]);
            window.dispatchEvent(new CustomEvent('app:page-action', {
                detail: { action: 'detail', appId: 'settings', pageId: 'world' },
            }));
            refresh();
        },

        worldRoute(payload = {}) {
            const route = getRoute(this.app);
            const newSub = payload.sub || 'worlds';
            route.sub = newSub;
            if (newSub === 'worlds' && !route.currentWorldId) {
                delete route.currentGroupId;
            }
            // 进入 overview 之外时，清掉所有编辑状态
            const editingKeys = [
                'editingId', 'editingChronologyId', 'editingGroupId', 'editingLocationId',
                'editingTimelineOwner',
                'editingAppBinding', 'editingAnchorId',
            ];
            editingKeys.forEach(k => delete route[k]);
            // 「设置面板」状态：点了入口时打开，且定位到对应 section
            if (payload.openSettingsSection) {
                route.activeSettingsSection = payload.openSettingsSection;
            }
            refresh();
        },

        /** 打开设置面板，定位到指定 section。 */
        worldOpenSettingsPanel(payload = {}) {
            const route = getRoute(this.app);
            route.activeSettingsSection = payload.section || 'assets';
            refresh();
        },

        /** 新建货币 */
        worldCreateCurrency() {
            const route = getRoute(this.app);
            route.editingCurrencyId = '__new__';
            refresh();
        },

        /** 编辑货币 */
        worldEditCurrency(payload = {}) {
            const route = getRoute(this.app);
            route.editingCurrencyId = payload.id || null;
            refresh();
        },

        /** 取消编辑 */
        worldCancelCurrencyEdit() {
            delete getRoute(this.app).editingCurrencyId;
            refresh();
        },

        /** 保存货币（新建或编辑） */
        async worldSaveCurrency(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk) return null;
            const route = getRoute(this.app);
            const worldId = route.currentWorldId || sdk.worlds.getActive()?.id;
            if (!worldId) {
                notify(this.toolkit, 'warning', '提示', '请先选择世界观');
                return null;
            }
            const world = sdk.worlds.get(worldId);
            if (!world) {
                notify(this.toolkit, 'error', '错误', '找不到世界观');
                return null;
            }

            // 从 DOM 收集字段
            const name = fieldValue('[data-currency-field="name"]');
            const symbol = fieldValue('[data-currency-field="symbol"]');
            const unit = fieldValue('[data-currency-field="unit"]');
            const note = fieldValue('[data-currency-field="note"]');
            const exchangeToBaseStr = fieldValue('[data-currency-field="exchangeToBase"]');
            const baseCurrencyId = fieldValue('[data-currency-field="baseCurrencyId"]');
            const baseAmountStr = fieldValue('[data-currency-field="baseAmount"]');

            if (!name?.trim()) {
                notify(this.toolkit, 'error', '名称不能为空', '');
                return null;
            }

            // 确保 currencies 数组存在
            world.currencies ||= [];

            const isNew = payload.id === '__new__';
            const exchangeToBase = exchangeToBaseStr ? parseFloat(exchangeToBaseStr) : null;
            const baseAmount = baseAmountStr ? parseFloat(baseAmountStr) : 1;
            const existingIdx = isNew ? -1 : world.currencies.findIndex(c => c.id === payload.id);

            const currencyData = {
                id: isNew ? `curr-${Date.now()}` : payload.id,
                name: name.trim(),
                symbol: symbol.trim() || name.charAt(0),
                unit: unit.trim(),
                note: note.trim(),
                exchangeToBase,
                baseCurrencyId: baseCurrencyId || null,
                baseAmount,
                isBase: isNew && world.currencies.length === 0, // 第一货币默认基准
                order: isNew ? world.currencies.length : (world.currencies[existingIdx]?.order ?? world.currencies.length),
                updatedAt: Date.now(),
            };

            if (isNew) {
                world.currencies.push(currencyData);
            } else if (existingIdx >= 0) {
                // 保留原有 isBase 状态
                currencyData.isBase = world.currencies[existingIdx].isBase;
                currencyData.order = world.currencies[existingIdx].order;
                world.currencies[existingIdx] = currencyData;
            }

            // 同步主货币名称：第一个基准货币同步到 world.currencyName
            const baseCurrency = world.currencies.find(c => c.isBase);
            const syncData = { currencies: world.currencies };
            if (baseCurrency) {
                syncData.currencyName = baseCurrency.name;
            }
            await sdk.worlds.update(worldId, syncData);
            delete route.editingCurrencyId;
            notify(this.toolkit, 'success', isNew ? '已添加货币' : '已保存货币', name.trim());
            refresh();
            return currencyData;
        },

        /** 删除货币 */
        async worldDeleteCurrency(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk || !payload.id) return false;
            const route = getRoute(this.app);
            const worldId = route.currentWorldId || sdk.worlds.getActive()?.id;
            if (!worldId) return false;

            const world = sdk.worlds.get(worldId);
            if (!world) return false;

            const idx = (world.currencies || []).findIndex(c => c.id === payload.id);
            if (idx < 0) return false;

            const curr = world.currencies[idx];
            if (curr.isBase) {
                notify(this.toolkit, 'error', '无法删除', '基准货币不能删除');
                return false;
            }

            if (!confirm(`删除货币「${curr.name}」？`)) return false;

            world.currencies.splice(idx, 1);
            await sdk.worlds.update(worldId, { currencies: world.currencies });
            notify(this.toolkit, 'success', '已删除货币', curr.name);
            refresh();
            return true;
        },

        /** 设置基准货币 */
        async worldSetBaseCurrency(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk || !payload.id) return false;
            const route = getRoute(this.app);
            const worldId = route.currentWorldId || sdk.worlds.getActive()?.id;
            if (!worldId) return false;

            const world = sdk.worlds.get(worldId);
            if (!world) return false;

            const currencies = world.currencies || [];
            const targetIdx = currencies.findIndex(c => c.id === payload.id);
            if (targetIdx < 0) return false;

            // 清除旧的基准标记，重新计算汇率
            currencies.forEach((c, i) => {
                if (i === targetIdx) {
                    c.isBase = true;
                    c.exchangeToBase = null;
                    c.baseCurrencyId = null;
                } else {
                    c.isBase = false;
                }
            });

            await sdk.worlds.update(worldId, { currencies });
            notify(this.toolkit, 'success', '已设为基准货币', currencies[targetIdx].name);
            refresh();
            return true;
        },

        /** 旧方法：兼容保留（但实际功能已被 currency CRUD 替代） */
        async worldSaveCurrencyName(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk) return null;
            const route = getRoute(this.app);
            const worldId = route.currentWorldId || sdk.worlds.getActive()?.id;
            if (!worldId) {
                notify(this.toolkit, 'warning', '提示', '请先选择世界观');
                return null;
            }
            const world = sdk.worlds.get(worldId);
            if (!world) return null;

            // 如果没有货币数组，创建一个
            if (!world.currencies || world.currencies.length === 0) {
                world.currencies = [{
                    id: `curr-${Date.now()}`,
                    name: payload.value || '金币',
                    symbol: (payload.value || '金币').charAt(0),
                    isBase: true,
                    order: 0,
                    updatedAt: Date.now(),
                }];
                await sdk.worlds.update(worldId, { currencies: world.currencies });
            } else {
                // 更新第一个货币的名称
                world.currencies[0].name = payload.value || '金币';
                world.currencies[0].symbol = (payload.value || '金币').charAt(0);
                world.currencies[0].updatedAt = Date.now();
                await sdk.worlds.update(worldId, { currencies: world.currencies });
            }
            notify(this.toolkit, 'success', '已保存', `货币名称：${payload.value}`);
            refresh();
        },

        /** 旧方法：兼容保留 */
        async worldSaveCurrencyNote(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk) return null;
            const route = getRoute(this.app);
            const worldId = route.currentWorldId || sdk.worlds.getActive()?.id;
            if (!worldId) {
                notify(this.toolkit, 'warning', '提示', '请先选择世界观');
                return null;
            }
            const world = sdk.worlds.get(worldId);
            if (!world || !world.currencies || world.currencies.length === 0) return null;

            world.currencies[0].note = payload.value || '';
            world.currencies[0].updatedAt = Date.now();
            await sdk.worlds.update(worldId, { currencies: world.currencies });
            notify(this.toolkit, 'success', '已保存', '货币说明已更新');
            refresh();
        },

        /** 关闭设置面板（内容现在始终显示，此方法保留但不折叠） */
        worldCloseSettingsPanel() {
            refresh();
        },

        /** 进入世界观组详情（查看组内列表）。*/
        worldOpenGroup(payload = {}) {
            const route = getRoute(this.app);
            route.sub = 'worlds';
            route.currentGroupId = payload.groupId ?? null;
            ['editingId', 'editingGroupId'].forEach(k => delete route[k]);
            refresh();
        },

        worldBackToGroups() {
            const route = getRoute(this.app);
            route.sub = 'worlds';
            delete route.currentGroupId;
            ['editingId', 'editingGroupId'].forEach(k => delete route[k]);
            refresh();
        },

        /**
         * 进入某个世界观内部（世界级 scope）。
         * 只设置 route.currentWorldId（编辑态范围），不修改全局「当前世界」——
         * 全局当前世界由用户人设绑定决定，参见 user 模块。
         * sub 切换到该世界的 'overview'，清掉所有编辑状态。
         */
        async worldEnter(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk || !payload.id) return null;
            if (!sdk.worlds.get(payload.id)) {
                notify(this.toolkit, 'error', '进入失败', '找不到该世界观');
                return null;
            }
            const route = getRoute(this.app);
            route.currentWorldId = payload.id;
            route.currentGroupId = worldGroupOf(sdk, payload.id);
            route.sub = 'overview';
            ['editingId', 'editingChronologyId', 'editingGroupId', 'editingLocationId',
                'editingTimelineOwner',
                'editingAppBinding', 'editingAnchorId', 'editingCurrencyId'].forEach(k => delete route[k]);
            if (payload.openDetail) {
                window.dispatchEvent(new CustomEvent('app:page-action', {
                    detail: { action: 'detail', appId: 'settings', pageId: 'world' },
                }));
            }
            refresh();
            return sdk.worlds.get(payload.id);
        },

        /**
         * 从世界级回到库级（清空 currentWorldId/currentGroupId）。
         */
        worldBackToLibrary() {
            const route = getRoute(this.app);
            route.sub = 'worlds';
            delete route.currentWorldId;
            delete route.currentGroupId;
            ['editingId', 'editingChronologyId', 'editingGroupId', 'editingLocationId',
                'editingTimelineOwner',
                'editingAppBinding', 'editingAnchorId', 'editingCurrencyId'].forEach(k => delete route[k]);
            refresh();
        },

        /* ============================================
         * 世界观库（组）
         * ============================================ */
        async worldCreateGroup() {
            const sdk = window.settingsSdk;
            if (!sdk) return null;
            try {
                const group = await sdk.worldGroups.create({});
                getRoute(this.app).editingGroupId = group.id;
                notify(this.toolkit, 'success', '已创建世界观库', '请填写库信息并保存');
                refresh();
                return group;
            } catch (err) {
                notify(this.toolkit, 'error', '创建失败', err?.message || '稍后再试');
                return null;
            }
        },

        worldEditGroup(payload = {}) {
            getRoute(this.app).editingGroupId = payload.groupId;
            refresh();
        },

        worldEditGroupCancel() {
            delete getRoute(this.app).editingGroupId;
            refresh();
        },

        async worldSaveGroup(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk || !payload.groupId) return null;
            try {
                const patch = readWorldGroupForm();
                const next = await sdk.worldGroups.update(payload.groupId, patch);
                notify(this.toolkit, 'success', '已保存', next?.name || payload.groupId);
                delete getRoute(this.app).editingGroupId;
                refresh();
                return next;
            } catch (err) {
                notify(this.toolkit, 'error', '保存失败', err?.message);
                return null;
            }
        },

        async worldDeleteGroup(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk || !payload.groupId) return false;
            const group = sdk.worldGroups.get(payload.groupId);
            const worldCount = sdk.worldGroups.listWorldsByGroup(payload.groupId).length;
            if (worldCount > 0) {
                notify(this.toolkit, 'error', '无法删除世界观库', `请先删除库内的 ${worldCount} 个世界观`);
                return false;
            }
            const doDelete = async () => {
                const removed = await sdk.worldGroups.remove(payload.groupId);
                if (!removed) {
                    notify(this.toolkit, 'error', '删除失败', '世界观库不存在或仍包含世界观');
                    return false;
                }
                notify(this.toolkit, 'success', '已删除', group?.name || payload.groupId);
                refresh();
                return true;
            };
            openConfirmModal({
                title: '删除世界观库',
                text: `确定删除空库「${group?.name || payload.groupId}」？此操作不可撤销。`,
                confirmLabel: '删除',
                danger: true,
                onConfirm: doDelete,
            });
            return true;
        },

        /* ============================================
         * 世界观（具体世界）
         * ============================================ */
        async worldCreate() {
            const sdk = window.settingsSdk;
            if (!sdk) return null;
            try {
                const route = getRoute(this.app);
                const groupId = route.currentGroupId ?? null;
                const world = await sdk.worlds.create({ groupRef: groupId });
                notify(this.toolkit, 'success', '已创建世界观', world.name || world.id);
                route.editingId = world.id;       // 自动进入编辑态
                refresh();
                return world;
            } catch (err) {
                notify(this.toolkit, 'error', '创建失败', err?.message);
                return null;
            }
        },

        async worldAssignGroup(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk || !payload.worldId) return null;
            const next = await sdk.worldGroups.assignWorld(payload.worldId, payload.groupId ?? null);
            if (next) refresh();
            return next;
        },

        async worldDelete(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk || !payload.id) return false;
            const w = sdk.worlds.get(payload.id);
            const doDelete = async () => {
                await sdk.locations.removeByWorld(payload.id);
                await sdk.worlds.remove(payload.id);
                notify(this.toolkit, 'success', '已删除世界观', w?.name || payload.id);
                refresh();
                return true;
            };
            openConfirmModal({
                title: '删除世界观',
                text: `确定删除「${w?.name || payload.id}」？其下的地点/标签组都会被一起删除，且不可撤销。`,
                confirmLabel: '删除',
                danger: true,
                onConfirm: doDelete,
            });
            return true;
        },

        async worldSetActive(payload = {}) {
            // 旧版「设为当前」入口：世界观设置不应该有「切换当前世界」的概念，
            // 当前世界由用户人设绑定决定。此方法保留以兼容 SDK 行为，但不在 UI 中触发。
            const sdk = window.settingsSdk;
            if (!sdk || !payload.id) return null;
            const inst = await sdk.worlds.setActive(payload.id);
            refresh();
            return inst;
        },

        /**
         * 一次性把「其它世界」的事件迁移到当前世界（route.currentWorldId）。
         * - world 事件：从所有「非当前世界」的 timelines.world 合并过来
         * - personal 事件：按 ownerKey 合并，重复 id 跳过
         */
        async worldMigrateTimelinesHere(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk) return null;
            try {
                const route = getRoute(this.app);
                const targetId = payload.targetId || route.currentWorldId || sdk.worlds.getActive()?.id;
                if (!targetId) {
                    notify(this.toolkit, 'error', '迁移失败', '没有目标世界');
                    return null;
                }
                const target = sdk.worlds.get(targetId);
                if (!target) {
                    notify(this.toolkit, 'error', '迁移失败', '找不到目标世界');
                    return null;
                }
                target.timelines ||= { personal: { user: [] }, world: [] };
                target.timelines.personal ||= {};
                const all = sdk.worlds.list();
                let movedWorld = 0, movedPersonal = 0;
                for (const w of all) {
                    if (w.id === targetId) continue;
                    w.timelines ||= { personal: { user: [] }, world: [] };
                    w.timelines.personal ||= {};
                    for (const evt of (w.timelines.world || [])) {
                        target.timelines.world.push({ ...evt });
                        movedWorld++;
                    }
                    for (const owner of Object.keys(w.timelines.personal)) {
                        target.timelines.personal[owner] ||= [];
                        const existingIds = new Set(target.timelines.personal[owner].map(e => e.id));
                        for (const evt of w.timelines.personal[owner]) {
                            if (existingIds.has(evt.id)) continue;
                            target.timelines.personal[owner].push({ ...evt });
                            movedPersonal++;
                        }
                    }
                    w.timelines.world = [];
                    w.timelines.personal = { user: [] };
                    await sdk.worlds.update(w.id, { timelines: w.timelines });
                }
                await sdk.worlds.update(targetId, { timelines: target.timelines });
                notify(this.toolkit, 'success', '迁移完成', `世界事件 +${movedWorld}，个人事件 +${movedPersonal}`);
                refresh();
                return { movedWorld, movedPersonal };
            } catch (err) {
                console.error('[worldMigrateTimelinesHere] failed:', err);
                notify(this.toolkit, 'error', '迁移失败', err?.message);
                return null;
            }
        },

        async worldImportPreset(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk || !payload.presetId) return null;
            try {
                const { createWorldFromPreset } = await import('./presets/world-presets.js');
                const presetWorld = createWorldFromPreset(payload.presetId);
                if (!presetWorld) {
                    notify(this.toolkit, 'error', '导入失败', '未找到该预设');
                    return null;
                }
                const route = getRoute(this.app);
                const groupId = route.currentGroupId ?? null;
                const world = await sdk.worlds.create({ ...presetWorld, groupRef: groupId });
                notify(this.toolkit, 'success', '已导入预设', world.name || world.id);
                refresh();
                return world;
            } catch (err) {
                notify(this.toolkit, 'error', '导入失败', err?.message);
                return null;
            }
        },

        worldEdit(payload = {}) {
            getRoute(this.app).editingId = payload.id;
            refresh();
        },

        worldEditCancel() {
            delete getRoute(this.app).editingId;
            refresh();
        },

        async worldSave(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk || !payload.id) return null;
            try {
                const patch = readWorldForm();
                console.log('[worldSave] payload.id=', payload.id, {
                    patchKeys: Object.keys(patch),
                    hasChronologySettings: !!patch.chronologySettings,
                    patchChronologySettings: JSON.stringify(patch.chronologySettings || null),
                });
                await sdk.worlds.update(payload.id, patch);
                const after = sdk.worlds.get(payload.id);
                console.log('[worldSave] AFTER, world.chronologySettings=', JSON.stringify(after?.chronologySettings || null));
                notify(this.toolkit, 'success', '已保存世界观', patch.name || payload.id);
                delete getRoute(this.app).editingId;
                refresh();
                return patch;
            } catch (err) {
                console.error('[worldSave] failed:', err);
                notify(this.toolkit, 'error', '保存失败', err?.message);
                return null;
            }
        },

        /* ============================================
         * 地点（Place：箱庭地图容器）
         * ============================================ */
        async worldCreatePlace() {
            const sdk = window.settingsSdk;
            if (!sdk) {
                notify(this.toolkit, 'error', '错误', 'SDK 未初始化');
                return null;
            }
            const world = sdk.worlds.getActive();
            if (!world) {
                notify(this.toolkit, 'warning', '提示', '请先选择一个世界观');
                return null;
            }
            const place = await sdk.places.create({
                worldRef: world.id,
                name: '新地点',
            });
            notify(this.toolkit, 'success', '已创建地点', place.name);
            const route = getRoute(this.app);
            route.sub = 'map';           // 确保在「空间」视图
            route.mapMode = 'place';
            route.editingPlaceId = place.id;
            refresh();
            return place;
        },

        worldEditPlace(payload = {}) {
            getRoute(this.app).editingPlaceId = payload.id;
            refresh();
        },

        worldEditPlaceCancel() {
            delete getRoute(this.app).editingPlaceId;
            refresh();
        },

        async worldSavePlace(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk || !payload.id) return null;
            const patch = readPlaceForm();
            await sdk.places.update(payload.id, patch);
            notify(this.toolkit, 'success', '已保存地点', patch.name);
            delete getRoute(this.app).editingPlaceId;
            refresh();
            return patch;
        },

        async worldDeletePlace(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk || !payload.id) return false;
            await sdk.places.remove(payload.id);
            notify(this.toolkit, 'success', '已删除地点', payload.id);
            refresh();
            return true;
        },

        /** 设置地图模式：'place' 地点地图 或 'location' 场所地图 */
        worldSetMapMode(payload = {}) {
            const sdk = window.settingsSdk;
            const world = sdk?.worlds?.getActive();
            if (!world) {
                // 没有当前世界，提示用户先选择
                notify(this.toolkit, 'warning', '提示', '请先选择一个世界观');
                return;
            }
            const route = getRoute(this.app);
            route.sub = 'map';           // 确保在「空间」视图
            route.mapMode = payload.mode || 'place';
            // 清除编辑状态
            delete route.editingPlaceId;
            delete route.editingLocationId;
            refresh();
        },

        /** 场所地图模式下选择地点 */
        worldSelectMapPlace(payload = {}) {
            const route = getRoute(this.app);
            route.mapSelectedPlaceId = payload.placeId || null;
            delete route.editingLocationId;
            refresh();
        },

        /** 设置地点地图的中心地点（用于显示背景图） */
        worldSetMapCenterPlace(payload = {}) {
            const route = getRoute(this.app);
            route.mapCenterPlaceId = payload.placeId || null;
            refresh();
        },

        /** 更新地点的地图坐标（拖拽后调用） */
        async worldUpdatePlacePosition(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk || !payload.id) return;
            
            const { id, mapOffsetX, mapOffsetY } = payload;
            if (typeof mapOffsetX !== 'number' || typeof mapOffsetY !== 'number') return;
            
            await sdk.places.update(id, { mapOffsetX, mapOffsetY });
            notify(this.toolkit, 'success', '已更新位置', `坐标: (${mapOffsetX}, ${mapOffsetY})`);
            refresh();
        },

        /** 更新场所的坐标（拖拽后调用） */
        async worldUpdateLocationPosition(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk || !payload.id) return;
            
            const { id, posX, posY } = payload;
            if (typeof posX !== 'number' || typeof posY !== 'number') return;
            
            await sdk.locations.update(id, { position: { x: posX, y: posY } });
            notify(this.toolkit, 'success', '已更新位置', `坐标: (${posX}, ${posY})`);
            refresh();
        },

        /** 上传地图背景图（地点地图模式）- 由 data-wv-upload-map-bg 触发 */
        async handleMapBgUpload(payload = {}) {
            const event = payload._event;
            const file = event?.target?.files?.[0];
            if (!file) return;
            await this._applyMapBgUpload(file, 'place');
            // 清空 input 以便再次上传同一文件
            if (event?.target) event.target.value = '';
        },

        /** 上传场所地图背景图（场所地图模式）- 由 data-wv-upload-place-bg 触发 */
        async handlePlaceBgUpload(payload = {}) {
            const event = payload._event;
            const file = event?.target?.files?.[0];
            if (!file) return;
            await this._applyMapBgUpload(file, 'location');
            if (event?.target) event.target.value = '';
        },

        /** 内部：通用地图背景图上传处理 */
        async _applyMapBgUpload(file, mode) {
            const sdk = window.settingsSdk;
            if (!sdk) return;

            // 读取文件为 data URL
            const dataUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(file);
            });

            if (!dataUrl) {
                notify(this.toolkit, 'error', '上传失败', '无法读取图片文件');
                return;
            }

            const world = sdk.worlds.getActive();
            if (!world) {
                notify(this.toolkit, 'warning', '提示', '请先选择一个世界观');
                return;
            }

            const route = getRoute(this.app);

            if (mode === 'location') {
                // 场所地图模式：更新当前选中的地点
                const placeId = route.mapSelectedPlaceId;
                if (placeId) {
                    await sdk.places.update(placeId, { mapImageUrl: dataUrl });
                    notify(this.toolkit, 'success', '已上传背景图', '场所地图将使用此背景');
                    refresh();
                } else {
                    notify(this.toolkit, 'warning', '提示', '请先选择一个地点');
                }
            } else {
                // 地点地图模式：更新当前中心地点的背景图
                const centerPlaceId = route.mapCenterPlaceId;
                const places = sdk.places.list({ worldRef: world.id });
                
                if (centerPlaceId) {
                    // 有中心地点，更新中心地点的背景图
                    await sdk.places.update(centerPlaceId, { mapImageUrl: dataUrl });
                    notify(this.toolkit, 'success', '已上传地点地图背景', '已保存到中心地点');
                } else if (places.length > 0) {
                    // 没有中心地点，设置第一个地点为中心地点并保存背景图
                    const firstPlace = places[0];
                    await sdk.places.update(firstPlace.id, { mapImageUrl: dataUrl });
                    // 自动设置为中心地点
                    route.mapCenterPlaceId = firstPlace.id;
                    notify(this.toolkit, 'success', '已上传地点地图背景', '已设置为地图中心');
                } else {
                    notify(this.toolkit, 'warning', '提示', '请先创建一个地点');
                }
                refresh();
            }
        },

        /* ============================================
         * 场所（Location：地点下的 pin）
         * ============================================ */
        async worldCreateLocation() {
            const sdk = window.settingsSdk;
            if (!sdk) return null;
            const world = sdk.worlds.getActive();
            const route = getRoute(this.app);
            // 如果在场所地图模式下且已选地点，自动关联
            const placeRef = route.mapMode === 'location' ? route.mapSelectedPlaceId : null;
            const loc = await sdk.locations.create({
                worldRef: world?.id || '',
                name: '新场所',
                placeRef,
            });
            notify(this.toolkit, 'success', '已创建场所', loc.name);
            refresh();
            return loc;
        },

        worldEditLocation(payload = {}) {
            getRoute(this.app).editingLocationId = payload.id;
            refresh();
        },

        worldEditLocationCancel() {
            delete getRoute(this.app).editingLocationId;
            refresh();
        },

        async worldSaveLocation(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk || !payload.id) return null;
            const patch = readLocationForm();
            await sdk.locations.update(payload.id, patch);
            notify(this.toolkit, 'success', '已保存地点', patch.name);
            delete getRoute(this.app).editingLocationId;
            refresh();
            return patch;
        },

        async worldDeleteLocation(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk || !payload.id) return false;
            await sdk.locations.remove(payload.id);
            notify(this.toolkit, 'success', '已删除地点', payload.id);
            refresh();
            return true;
        },

        async worldSetCenterLocation(payload = {}) {
            const sdk = window.settingsSdk;
            const world = sdk?.worlds.getActive();
            if (!sdk || !world || !payload.id) return null;
            await sdk.locations.setCenterLocation(world.id, payload.id);
            const route = getRoute(this.app);
            route.mapCenterLocId = payload.id;
            notify(this.toolkit, 'success', '已设为主地点', '其他地点坐标已自动相对化');
            refresh();
            return true;
        },

        /**
         * 快速「以某地点为中心」：把地图 view 拉到那个点。
         * 由于坐标都是相对主地点的，所以「切换中心」= 把那个点变成新的 (0, 0)。
         * 即调用 setCenterLocation 并把 mapCenterLocId 记下。
         */
        async worldSetMapCenter(payload = {}) {
            const locId = payload.locId;
            if (!locId) {
                const route = getRoute(this.app);
                delete route.mapCenterLocId;
                refresh();
                return true;
            }
            return await this.worldSetCenterLocation({ id: locId });
        },

        /** 调整 / 重置地图缩放。 */
        worldAdjustMapZoom(payload = {}) {
            const route = getRoute(this.app);
            const cur = route.mapZoom ?? 1;
            const MIN_ZOOM = 0.25;
            const MAX_ZOOM = 5;
            const STEP = 1;
            let next = cur;
            if (payload.reset) {
                next = 1;
            } else if (typeof payload.delta === 'number') {
                next = cur + payload.delta;
                if (next < MIN_ZOOM) next = MIN_ZOOM;
                if (next > MAX_ZOOM) next = MAX_ZOOM;
                next = Math.round(next / STEP) * STEP;
                if (Math.abs(next - 1) < STEP / 2) next = 1;
            } else {
                next = 1;
            }
            route.mapZoom = next;
            refresh();
            return next;
        },

        /** 拖动滑块时的高频同步——只走 DOM，不刷新整页。 */
        worldSyncMapZoom(payload = {}) {
            const route = getRoute(this.app);
            const zoom = Number(payload.zoom);
            if (!Number.isFinite(zoom)) return;
            const MIN_ZOOM = 0.25;
            const MAX_ZOOM = 5;
            const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
            route.mapZoom = newZoom;
            syncZoomDom(newZoom);
        },

        /** 直接设置地图缩放（用于滑块）。 */
        worldSetMapZoom(payload = {}) {
            const route = getRoute(this.app);
            const zoom = Number(payload.zoom);
            if (!Number.isFinite(zoom)) return;
            const MIN_ZOOM = 0.25;
            const MAX_ZOOM = 5;
            const oldZoom = route.mapZoom ?? 1;
            const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
            // 松手 / 点按钮时统一落库 + 刷新（拖动期间由 worldSyncMapZoom 走 syncZoomDom）。
            route.mapZoom = newZoom;
            refresh();
        },

        /** 重置按钮（圆球）—— 强制 refresh。 */
        worldResetMapZoom() {
            const route = getRoute(this.app);
            route.mapZoom = 1;
            refresh();
        },

        /* ============================================
         * ★ v0.17 时间锚点（anchor）
         *   - 段锚点 (range)：一段时间范围，如「11月-2月春季赛」
         *   - 点锚点 (point)：具体日期，每年重复，如「2.5 纪念日」
         *   - 待开发：绑定 AI 的提醒 / 自动上下文注入
         * ============================================ */

        /**
         * 统一入口：根据 type 调用对应创建方法。
         * v0.17 新增，修复按钮点击无反应的问题。
         */
        worldStartAnchorCreate(payload = {}) {
            const type = payload?.type;
            if (type === 'range') {
                return this.worldCreateRangeAnchor();
            } else if (type === 'point') {
                return this.worldCreatePointAnchor();
            }
            notify(this.toolkit, 'warning', '参数错误', '未指定锚点类型');
        },

        async worldCreateRangeAnchor() {
            const sdk = window.settingsSdk;
            const world = sdk?.worlds.getActive();
            if (!sdk || !world) return null;
            const anchor = await sdk.anchors.create(world.id, {
                type: 'range',
                title: '新段锚点',
                enabled: true,
            });
            notify(this.toolkit, 'success', '已创建段锚点', anchor.title);
            const route = getRoute(this.app);
            route.sub = 'anchors';
            route.editingAnchorId = anchor.id;
            refresh();
            return anchor;
        },

        async worldCreatePointAnchor() {
            const sdk = window.settingsSdk;
            const world = sdk?.worlds.getActive();
            if (!sdk || !world) return null;
            const anchor = await sdk.anchors.create(world.id, {
                type: 'point',
                title: '新点锚点',
                enabled: true,
            });
            notify(this.toolkit, 'success', '已创建点锚点', anchor.title);
            const route = getRoute(this.app);
            route.sub = 'anchors';
            route.editingAnchorId = anchor.id;
            refresh();
            return anchor;
        },

        worldEditAnchor(payload = {}) {
            getRoute(this.app).editingAnchorId = payload.anchorId;
            refresh();
        },

        worldEditAnchorCancel() {
            delete getRoute(this.app).editingAnchorId;
            refresh();
        },

        async worldSaveAnchor(payload = {}) {
            const sdk = window.settingsSdk;
            const world = sdk?.worlds.getActive();
            if (!sdk || !world || !payload.anchorId) return null;
            const f = readForm(ANCHOR_FORM_SCHEMA, {});
            // 将 startYear/startMonth/startDay 转换为 start 对象
            const start = {
                year: f.startYear ?? 0,
                month: f.startMonth ?? 0,
                day: f.startDay ?? 0,
            };
            // 清理临时字段
            const { startYear, startMonth, startDay, ...rest } = f;
            await sdk.anchors.updateAnchor(world.id, payload.anchorId, {
                ...rest,
                start,
                label: f.label || f.title || '',
            });
            notify(this.toolkit, 'success', '已保存锚点', f.label || f.title);
            delete getRoute(this.app).editingAnchorId;
            refresh();
            return f;
        },

        async worldDeleteAnchor(payload = {}) {
            const sdk = window.settingsSdk;
            const world = sdk?.worlds.getActive();
            if (!sdk || !world || !payload.anchorId) return false;
            if (!confirm('确定删除这个锚点？AI 绑定也会一起移除。')) return false;
            await sdk.anchors.remove(world.id, payload.anchorId);
            notify(this.toolkit, 'success', '已删除锚点', payload.anchorId);
            refresh();
            return true;
        },

        async worldToggleAnchor(payload = {}) {
            const sdk = window.settingsSdk;
            const world = sdk?.worlds.getActive();
            if (!sdk || !world || !payload.anchorId) return null;
            const a = await sdk.anchors.toggle(world.id, payload.anchorId);
            refresh();
            return a;
        },

        async worldBindAnchorToAi(payload = {}) {
            const sdk = window.settingsSdk;
            const world = sdk?.worlds.getActive();
            if (!sdk || !world || !payload.anchorId || !payload.aiId) return null;
            const a = await sdk.anchors.bindAi(world.id, payload.anchorId, payload.aiId);
            notify(this.toolkit, 'success', '已绑定 AI', '');
            refresh();
            return a;
        },

        async worldUnbindAnchorFromAi(payload = {}) {
            const sdk = window.settingsSdk;
            const world = sdk?.worlds.getActive();
            if (!sdk || !world || !payload.anchorId || !payload.aiId) return null;
            const a = await sdk.anchors.unbindAi(world.id, payload.anchorId, payload.aiId);
            notify(this.toolkit, 'success', '已解除绑定', '');
            refresh();
            return a;
        },

        /* ============================================
         * ★ v0.17 流动数据（Prompt 数据结构）
         * ============================================ */

        /** 新建流动体 */
        worldCreateFlow() {
            const route = getRoute(this.app);
            route.editingFlowId = '__new__';
            refresh();
        },

        /** 编辑流动体 */
        worldEditFlow(payload = {}) {
            const route = getRoute(this.app);
            route.editingFlowId = payload.flowId || null;
            refresh();
        },

        /** 取消编辑 */
        worldCancelFlowEdit() {
            delete getRoute(this.app).editingFlowId;
            refresh();
        },

        /** 保存流动体（新建或编辑） */
        async worldSaveFlow(payload = {}) {
            const sdk = window.settingsSdk;
            const world = getCurrentWorld(this.app, sdk);
            if (!sdk || !world) return null;

            const title = fieldValue('[data-flow-field="title"]');
            const content = fieldValue('[data-flow-field="content"]');

            if (!title?.trim()) {
                notify(this.toolkit, 'error', '名称不能为空', '');
                return null;
            }
            if (!content?.trim()) {
                notify(this.toolkit, 'error', '内容不能为空', '');
                return null;
            }

            // 确保 flows 数据存在
            world.flows ||= [];
            const flows = world.flows;

            if (payload.flowId === '__new__') {
                // 新建
                const newFlow = {
                    id: `flow-${Date.now()}`,
                    title: title.trim(),
                    content: content.trim(),
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                };
                flows.push(newFlow);
            } else {
                // 编辑
                const idx = flows.findIndex(f => f.id === payload.flowId);
                if (idx >= 0) {
                    flows[idx] = {
                        ...flows[idx],
                        title: title.trim(),
                        content: content.trim(),
                        updatedAt: Date.now(),
                    };
                }
            }

            // 保存到 world
            await sdk.worlds.update(world.id, { flows });

            delete getRoute(this.app).editingFlowId;
            notify(this.toolkit, 'success', '已保存流动体', title.trim());
            refresh();
            return true;
        },

        /** 删除流动体 */
        async worldDeleteFlow(payload = {}) {
            const sdk = window.settingsSdk;
            const world = getCurrentWorld(this.app, sdk);
            if (!sdk || !world || !payload.flowId) return false;

            if (!confirm('确定删除这个流动体？')) return false;

            world.flows ||= [];
            world.flows = world.flows.filter(f => f.id !== payload.flowId);
            await sdk.worlds.update(world.id, { flows: world.flows });

            notify(this.toolkit, 'success', '已删除流动体', '');
            refresh();
            return true;
        },

        /* ============================================
         * ★ v0.12 时间线（原纪时）
         * ============================================ */
        worldShowTimelineAdd(payload = {}) {
            const route = getRoute(this.app);
            const type = payload.type || 'personal';
            // world 类型不需要 ownerKey；personal 类型必须有 ownerKey
            if (type === 'world') {
                route.editingTimelineOwner = 'world';
            } else {
                const ownerKey = payload.ownerKey || 'user';
                route.editingTimelineOwner = `personal-${ownerKey}`;
            }
            refresh();
        },

        worldCancelTimelineAdd() {
            delete getRoute(this.app).editingTimelineOwner;
            refresh();
        },

        async worldAddTimelineEvent(payload = {}) {
            const sdk = window.settingsSdk;
            const world = sdk?.worlds.getActive();
            if (!sdk || !world) return null;
            const type = payload.type || 'personal';
            const ownerKey = payload.ownerKey || 'user';
            const f = readTimelineForm(ownerKey);
            const event = await sdk.timelines.addTimelineEvent(world.id, type, f);
            notify(this.toolkit, 'success', '已添加时间事件', event.title);
            delete getRoute(this.app).editingTimelineOwner;
            refresh();
            return event;
        },

        worldEditTimelineEvent(payload = {}) {
            // 进入「时间单条事件」编辑态（路由一个 id 即可，原 event 数据由
            // renderChronicleEventEditForm 直接预填）。
            const route = getRoute(this.app);
            route.editingChronicleEventId = payload.eventId || null;
            refresh();
        },

        worldCancelChronicleEdit() {
            delete getRoute(this.app).editingChronicleEventId;
            refresh();
        },

        async worldSaveTimelineEvent(payload = {}) {
            const sdk = window.settingsSdk;
            const world = sdk?.worlds.getActive();
            if (!sdk || !world || !payload.eventId) return null;

            // 使用 readForm 读取 CHRONICLE_EVENT_FORM_SCHEMA 中的字段
            const fields = readForm(CHRONICLE_EVENT_FORM_SCHEMA, {});
            if (!fields.title) {
                notify(this.toolkit, 'error', '标题不能为空', '');
                return null;
            }
            await sdk.timelines.updateTimelineEvent(payload.eventId, fields);
            notify(this.toolkit, 'success', '已保存', fields.title);
            delete getRoute(this.app).editingChronicleEventId;
            refresh();
            return true;
        },

        async worldDeleteTimelineEvent(payload = {}) {
            const sdk = window.settingsSdk;
            const world = sdk?.worlds.getActive();
            if (!sdk || !world || !payload.eventId) return false;
            await sdk.timelines.deleteTimelineEvent(world.id, payload.eventId);
            refresh();
            return true;
        },

        /* ============================================
         * ★ v0.14 时间线视图切换（时间轴 / 时间锚点 / 时间表）
         * ============================================ */
        worldSetChronicleView(payload = {}) {
            const route = getRoute(this.app);
            const allowed = ['timeline', 'schedule', 'anchor'];
            route.chronicleView = allowed.includes(payload.view) ? payload.view : 'timeline';
            // 切到时间表时回到第 1 周，避免上次的索引残留
            if (route.chronicleView === 'schedule') route.scheduleWeekIndex = 0;
            refresh();
        },

        /**
         * 时间表按「周」翻页（左右各一周）。delta = -1 / +1
         * 状态写到 route.scheduleWeekIndex，受 worldSetChronicleView 重置为 0。
         */
        worldSetScheduleWeek(payload = {}) {
            const route = getRoute(this.app);
            const weekCount = 4; // 默认展示 4 周
            const cur = Math.max(0, Math.min(Number(route.scheduleWeekIndex ?? 0), weekCount - 1));
            const delta = Number(payload.delta || 0);
            let next = cur + (Number.isFinite(delta) ? delta : 0);
            if (next < 0) next = 0;
            if (next >= weekCount) next = weekCount - 1;
            if (next === cur) return null;
            route.scheduleWeekIndex = next;
            refresh();
            return next;
        },

        /**
         * 「拼接」维度已彻底移除（v0.17）。
         * 保留一个 noop 兼容层：旧链接可能仍派发 `worldToggleInjectMode`，避免报错。
         */
        worldToggleInjectMode(payload = {}) {
            refresh();
        },

        /* ============================================
         * ★ v0.12 纪时系统 UI 路由
         * ============================================ */

        /** 切换纪时设置面板展开/收起 */
        worldToggleChronologyPanel() {
            const route = getRoute(this.app);
            route.chronologyPanelOpen = !route.chronologyPanelOpen;
            refresh();
        },

        /**
         * 切换日期编辑器的某个周期字段是否可见（per-world）。
         * payload: { field: 'year'|'month'|'day' }
         *   v0.17：「小周期」=「日」，「基周期」/「周」已彻底移除。
         * 状态写入 world.chronologySettings.dateFieldVisibility[field]，自动持久化。
         */
        async worldToggleChronologyDateField(payload = {}) {
            const sdk = window.settingsSdk;
            const route = getRoute(this.app);
            const field = payload.field;
            // v0.17：仅 year / month / day 三个字段，无任何兼容。
            if (!sdk || !field || !['year', 'month', 'day'].includes(field)) {
                return null;
            }
            const worldId = route.currentWorldId || sdk.worlds.getActive()?.id;
            if (!worldId) {
                notify(this.toolkit, 'warning', '提示', '请先进入一个世界观');
                return null;
            }
            const world = sdk.worlds.get(worldId);
            if (!world) {
                notify(this.toolkit, 'warning', '提示', '找不到该世界观');
                return null;
            }
            const chrono = world.chronologySettings || {};
            // v0.16：默认全部可见（无 week/base）
            const visibility = { year: true, month: true, day: true, ...(chrono.dateFieldVisibility || {}) };
            visibility[field] = !visibility[field];
            const patch = {
                chronologySettings: {
                    ...chrono,
                    dateFieldVisibility: visibility,
                },
            };
            await sdk.worlds.update(worldId, patch);
            refresh();
            return visibility;
        },

        /** 快速保存三个周期名称（不离开当前页）*/
        async worldQuickSaveCycleNames() {
            const sdk = window.settingsSdk;
            if (!sdk) return null;
            const world = sdk.worlds.getActive();
            if (!world) {
                notify(this.toolkit, 'warning', '提示', '请先选择世界观');
                return null;
            }
            // v0.16：基周期删除；只剩 large / medium / small(现在是「日」)
            const keys = ['largeCycleName', 'mediumCycleName', 'smallCycleName'];
            const updates = {};
            for (const k of keys) {
                const el = document.querySelector(`[data-wv-quick-cycle="${k}"]`);
                if (el) updates[k] = el.value || '';
            }
            const patch = {
                chronologySettings: {
                    ...(world.chronologySettings || {}),
                    ...updates,
                },
            };
            await sdk.worlds.update(world.id, patch);
            notify(this.toolkit, 'success', '已保存周期名',
                `${updates.largeCycleName || '?'} / ${updates.mediumCycleName || '?'} / ${updates.smallCycleName || '?'}`);
            refresh();
        },

        /** 打开纪时系统编辑（独立表单，仅显示「★ 纪时系统」一节，不离开当前页）*/
        worldEditChronology() {
            const route = getRoute(this.app);
            const sdk = window.settingsSdk;

            // 优先使用 route.currentWorldId（用户已进入该世界），否则尝试 getActive
            const worldId = route.currentWorldId || sdk?.worlds.getActive()?.id;
            if (!worldId) {
                notify(this.toolkit, 'warning', '提示', '请先进入一个世界观');
                return;
            }

            const world = sdk.worlds.get(worldId);
            if (!world) {
                notify(this.toolkit, 'warning', '提示', '找不到该世界观');
                return;
            }

            // 仅设置 editingChronologyId，**不** 切换 route.sub，让用户留在当前页（通常是「时间详情页」）。
            route.editingChronologyId = world.id;
            refresh();
        },

        /** 保存纪时系统（只读「★ 纪时系统」一节的字段）*/
        async worldSaveChronology() {
            const sdk = window.settingsSdk;
            const route = getRoute(this.app);
            const worldId = route.editingChronologyId || route.currentWorldId || sdk?.worlds.getActive()?.id;
            if (!sdk || !worldId) {
                notify(this.toolkit, 'error', '保存失败', '找不到当前世界观');
                return null;
            }
            try {
                const patch = readChronologySectionForm();
                await sdk.worlds.update(worldId, { chronologySettings: patch.chronologySettings });
                notify(this.toolkit, 'success', '已保存纪时系统', '');
                delete route.editingChronologyId;
                refresh();
                return patch;
            } catch (err) {
                console.error('[worldSaveChronology] failed:', err);
                notify(this.toolkit, 'error', '保存失败', err?.message);
                return null;
            }
        },

        /** 关闭纪时设置编辑（独立表单模式）*/
        worldEditChronologyCancel() {
            delete getRoute(this.app).editingChronologyId;
            refresh();
        },

        /* ============================================
         * ★ v0.17 草稿（App 绑定 / 上下文注入 / 社媒 已彻底移除）
         * ============================================ */
        async worldSaveDraft(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk || !payload.targetId) return null;
            const draft = await sdk.drafts.save('world', payload.targetId, payload.data || {});
            notify(this.toolkit, 'success', '已保存草稿', '');
            return draft;
        },

        async worldDiscardDraft(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk || !payload.targetId) return false;
            await sdk.drafts.remove('world', payload.targetId);
            notify(this.toolkit, 'success', '已放弃草稿', '');
            refresh();
            return true;
        },

        async worldPublishDraft(payload = {}) {
            const sdk = window.settingsSdk;
            const world = sdk?.worlds.getActive();
            if (!sdk || !world || !payload.targetId) return null;
            const draft = await sdk.drafts.publish('world', payload.targetId, async (d) => {
                await sdk.worlds.update(world.id, d.data);
            });
            if (draft) notify(this.toolkit, 'success', '已发布草稿', '');
            refresh();
            return draft;
        },

        /* ============================================
         * ★ v0.17 已彻底移除快照方法
         * ============================================ */

        /* ============================================
         * 导入 / 导出
         * ============================================ */

        /* ============================================
         * 导入 / 导出
         * ============================================ */
        worldExportPreview(payload = {}) {
            const sdk = window.settingsSdk;
            const w = sdk?.worlds.get(payload.id);
            if (!w) return null;
            const preview = { id: w.id, name: w.name, summary: w.summary, anchors: w.anchors?.length || 0, locations: sdk.locations.list({ worldRef: w.id }).length };
            console.log('[worldExportPreview]', preview);
            notify(this.toolkit, 'info', `预览「${w.name}」`, `${preview.anchors} 锚点 / ${preview.locations} 地点（console 看完整）`);
            return preview;
        },

        worldExportDownload(payload = {}) {
            const sdk = window.settingsSdk;
            const w = sdk?.worlds.get(payload.id);
            if (!w) return null;
            const locList = sdk.locations.list({ worldRef: w.id });
            const data = {
                $schema: 'xiaoting-world-v1',
                exportMeta: {
                    version: w.version || '1.0.0',
                    exportedAt: new Date().toISOString(),
                    exportedFrom: '小听启动',
                    packageType: 'world-only',
                },
                world: {
                    ...w,
                    locations: locList,
                },
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${w.name || 'world'}-v${w.version || '1.0.0'}.json`;
            a.click();
            URL.revokeObjectURL(url);
            notify(this.toolkit, 'success', '已下载 JSON', a.download);
            return data;
        },

        async worldImportFile() {
            const sdk = window.settingsSdk;
            if (!sdk) return null;
            const file = document.getElementById('wv-import-file')?.files?.[0];
            if (!file) {
                notify(this.toolkit, 'error', '请先选文件', '');
                return null;
            }
            const strategy = document.getElementById('wv-import-strategy')?.value || 'merge';
            const text = await file.text();
            const obj = safeJSON(text, null);
            if (!obj?.world) {
                notify(this.toolkit, 'error', '文件格式不对', '需要 world 字段');
                return null;
            }
            const incoming = obj.world;
            const existing = incoming.id ? sdk.worlds.get(incoming.id) : null;
            const targetGroupRef = (existing?.groupRef ?? null);
            if (existing) {
                if (strategy === 'skip') {
                    notify(this.toolkit, 'info', '已跳过', existing.name);
                    return existing;
                }
                if (strategy === 'overwrite') {
                    const next = await sdk.worlds.update(incoming.id, incoming);
                    notify(this.toolkit, 'success', '已覆盖', next.name);
                    refresh();
                    return next;
                }
                // merge / coexist
                const id = strategy === 'coexist' ? undefined : incoming.id;
                const created = await sdk.worlds.create({ ...incoming, id, groupRef: targetGroupRef });
                notify(this.toolkit, 'success', '已合并', created.name);
                refresh();
                return created;
            }
            // 不存在 → 直接 create
            const created = await sdk.worlds.create({ ...incoming, groupRef: targetGroupRef });
            notify(this.toolkit, 'success', '已导入', created.name);
            refresh();
            return created;
        },

        /* ============================================
         * ★ v0.12 纪时系统（Chronology）
         * ============================================ */

        /** 测试纪时转换：现实时间 → 世界观时间 */
        worldTestChronologyConversion() {
            const sdk = window.settingsSdk;
            if (!sdk) return null;
            const world = sdk.worlds.getActive();
            if (!world) {
                notify(this.toolkit, 'warning', '提示', '请先选择一个世界观');
                return null;
            }
            const chrono = sdk.chronology;
            if (!chrono) {
                notify(this.toolkit, 'error', '错误', '纪时系统未初始化');
                return null;
            }

            const cfg = chrono.getChronologyConfig(world.id);
            if (!cfg?.enabled) {
                notify(this.toolkit, 'info', '纪时未启用', '在编辑世界观时启用纪时系统');
                return null;
            }

            // 测试：当前现实时间 → 世界观时间
            const now = new Date();
            const worldTime = chrono.realToWorld(now, world.id);
            const formatted = chrono.format(worldTime, 'verbose', world.id);

            console.log('[worldTestChronologyConversion]', {
                realTime: now.toISOString(),
                worldTime,
                formatted,
                config: cfg,
            });

            notify(this.toolkit, 'success', '纪时转换测试',
                `现实 ${now.toLocaleString('zh-CN')} → 世界 ${formatted}`);
            return { realTime: now, worldTime, formatted };
        },

        /** 预览纪时系统摘要 */
        worldPreviewChronologySummary() {
            const sdk = window.settingsSdk;
            if (!sdk) return null;
            const world = sdk.worlds.getActive();
            if (!world) {
                notify(this.toolkit, 'warning', '提示', '请先选择一个世界观');
                return null;
            }

            const chrono = sdk.chronology;
            if (!chrono) return null;

            const summary = chrono.getChronologySummary(world.id);
            if (!summary) {
                notify(this.toolkit, 'info', '纪时未启用', '在编辑世界观时启用纪时系统');
                return null;
            }

            const ratioDesc = summary.ratios.year === 1
                ? '1:1（与现实同步）'
                : `1:${summary.ratios.year}（世界观时间 ${summary.ratios.year > 1 ? '快' : '慢'}）`;

            notify(this.toolkit, 'info', '纪时系统摘要',
                `基准年 ${summary.baseYear} | 比例 ${ratioDesc}`);
            return summary;
        },

        /** 转换指定日期到世界观时间 */
        worldConvertDateToChronology(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk || !payload.dateStr) return null;
            const world = sdk.worlds.getActive();
            if (!world) {
                notify(this.toolkit, 'warning', '提示', '请先选择一个世界观');
                return null;
            }

            const chrono = sdk.chronology;
            if (!chrono) return null;

            const date = new Date(payload.dateStr);
            if (isNaN(date.getTime())) {
                notify(this.toolkit, 'error', '日期格式错误', payload.dateStr);
                return null;
            }

            const cfg = chrono.getChronologyConfig(world.id);
            if (!cfg?.enabled) {
                // 未启用时直接显示原日期
                notify(this.toolkit, 'info', '纪时未启用', payload.dateStr);
                return null;
            }

            const worldTime = chrono.realToWorld(date, world.id);
            const formatted = chrono.format(worldTime, 'verbose', world.id);

            notify(this.toolkit, 'success', '时间转换',
                `${payload.dateStr} → ${formatted}`);
            return { input: payload.dateStr, worldTime, formatted };
        },
    };
}
