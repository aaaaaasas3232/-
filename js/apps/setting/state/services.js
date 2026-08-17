/**
 * 设置 App · 对外服务（services）
 *
 * 其他 App / 桌面 / 启动流程可以通过 `externalAppRegistry.invokeService('settings', 'getApiProfile')`
 * 之类的方式读取配置。
 */

import {
    getImageByCode, getGroupImages, getGroupWithPath, getGroup,
    getAllLibraries, getLibraryAlbums, getAlbumGroups, countChildren,
} from '../gallery/gallery-db.js';
import { getBoundResources } from '../world/sdk/persona.js';
import { applyDeviceTheme } from '../appearance-general/theme-bridge.js';
import { APPEARANCE_DB_KEY, APPEARANCE_STORE_NAME } from '../appearance-general/defaults.js';

/** 低氧时电池填充的临时红（只影响显示，不写坏用户自选的 batteryColor） */
const BATTERY_LOW_COLOR = '#D5474D';

/** 电池桥的调用方需要外观数据已 hydrate（服务可能先于 UI 被调） */
async function ensureAppearanceHydrated(ctx) {
    const app = ctx.app;
    if (!app?.state) return;
    if (!app.state._hydrated) {
        app.state._hydrated = true;
        try {
            // ★ 必须走 serviceContext.methods（registry 绑定过 this 的版本）。
            //   ctx.app.methods 是原始 appConfig 上的裸方法，this.toolkit 是 undefined，
            //   调它会在 hydrateAll 里炸 “Cannot read properties of undefined (reading 'db')”。
            await ctx.methods?.hydrate?.();
        } catch (err) {
            console.warn('[settings] batteryBridge 触发 hydrate 失败', err);
        }
    }
}

function persistAppearanceFromService(ctx) {
    const app = ctx.app;
    if (!app?.state?.ui?.appearance) return;
    const ui = { ...app.state.ui.appearance };
    const db = ctx.toolkit?.db;
    if (!db?.put) return;
    db.put(APPEARANCE_STORE_NAME, {
        key: APPEARANCE_DB_KEY,
        ...ui,
        updatedAt: Date.now(),
    }).catch((err) => {
        console.warn('[settings] batteryBridge 持久化失败', err);
    });
}

/** 让外观 detail 页（电量滑条那一行）跟着重渲染 */
function refreshAppearanceUi() {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('oxygen:battery-binding-changed'));
    window.refreshPhoneApps?.();
    const tickRef = window.__detailRenderTick;
    if (tickRef && typeof tickRef.value === 'number') {
        tickRef.value = tickRef.value + 1;
    }
}

export function buildServices() {
    return {
        async handleDeepLink(payload = {}) {
            if (payload?.pageId) {
                window.dispatchEvent(new CustomEvent('app:page-action', {
                    detail: { action: 'detail', appId: this.app.id, pageId: payload.pageId },
                }));
            }
            return { ok: true };
        },
        async getSettings() {
            return this.app.state.ui;
        },
        async getApiProfile() {
            return this.app.state.ui.api;
        },
        async getActiveWorld() {
            return this.app.state.ui.world;
        },
        async getActiveUser() {
            return this.app.state.ui.user;
        },
        async getActiveAi() {
            return this.app.state.ui.ai;
        },
        async getDeviceTheme() {
            return this.app.state.ui.appearance;
        },

        /* ============================================
         * 电池桥（batteryBridge）—— 给氧气（blog）用的受控接口
         * ============================================
         * 氧气开启「氧气值系统」后电量与氧气绑定：
         *   - 绑定期间 nook 外观页的电量滑条整行消失（section.js 按
         *     batteryBoundByOxygen 条件渲染），氧气是电量唯一写入方
         *   - 绑定状态与电量一起存 deviceSettings 的 device-theme 记录
         *   - 低氧时电池填充临时变红，恢复后还原用户自选色
         * sourceApp 只是防自己人写错路径的标记（单机模拟器，不做真鉴权）。
         * ============================================ */

        /** 当前电量与绑定状态 */
        async batteryGetState() {
            await ensureAppearanceHydrated(this);
            const ui = this.app.state.ui.appearance || {};
            return {
                ok: true,
                capacity: Math.max(0, Math.min(1, Number(ui.batteryCapacity) || 0)),
                bound: ui.batteryBoundByOxygen === true,
                batteryColor: ui.batteryColor || '',
            };
        },

        /** 绑定：电量交给氧气并回满 */
        async batteryBind() {
            await ensureAppearanceHydrated(this);
            const ui = this.app.state.ui.appearance;
            if (!ui) return { ok: false, error: '外观数据未就绪' };
            ui.batteryBoundByOxygen = true;
            ui.batteryCapacity = 1;
            applyDeviceTheme(ui);
            persistAppearanceFromService(this);
            refreshAppearanceUi();
            return { ok: true, capacity: 1, bound: true };
        },

        /** 解绑：电量停在解绑瞬间的值，滑条恢复 */
        async batteryUnbind() {
            await ensureAppearanceHydrated(this);
            const ui = this.app.state.ui.appearance;
            if (!ui) return { ok: false, error: '外观数据未就绪' };
            ui.batteryBoundByOxygen = false;
            applyDeviceTheme(ui);
            persistAppearanceFromService(this);
            refreshAppearanceUi();
            return { ok: true, capacity: Number(ui.batteryCapacity) || 0, bound: false };
        },

        /**
         * 绑定期间由氧气写电量（0~1）。
         * low=true 时电池填充用临时红显示；存盘的 batteryColor 永远是用户自选色。
         */
        async batterySetCapacity(payload = {}) {
            await ensureAppearanceHydrated(this);
            const ui = this.app.state.ui.appearance;
            if (!ui) return { ok: false, error: '外观数据未就绪' };
            if (ui.batteryBoundByOxygen !== true) {
                return { ok: false, error: '电量没有绑定给氧气' };
            }
            const value = Math.max(0, Math.min(1, Number(payload.value) || 0));
            ui.batteryCapacity = value;
            persistAppearanceFromService(this);
            // 显示层：低氧红只进 applyDeviceTheme 的这一份拷贝，不落盘
            applyDeviceTheme(payload.low ? { ...ui, batteryColor: BATTERY_LOW_COLOR } : ui);
            return { ok: true, capacity: value, bound: true };
        },
        /** 图库：按编号获取图片 URL */
        galleryGetImageUrl: async ({ code }) => {
            const img = await getImageByCode(code);
            if (!img) return null;
            return img.source || img.thumbnail || null;
        },
        /** 图库：列出某图组所有图片元信息 */
        galleryListGroupImages: async ({ groupId }) => {
            const images = await getGroupImages(groupId);
            return images.map(img => ({
                code: img.code,
                name: img.name,
                thumbnail: img.thumbnail || img.source,
                originalSize: img.originalSize,
            }));
        },
        /** 图库：获取某图组的基本信息（路径） */
        galleryGetGroupPath: async ({ groupId }) => {
            return getGroupWithPath(groupId);
        },
        /**
         * 图库：列出**所有**图组（含路径与图片数）。
         * 给「绑定一个图组当头像池」这类跨 App 场景用（萤火首创），
         * 让业务 App 不必 import 图库内部模块就能做绑定 UI。
         */
        galleryListAllGroups: async () => {
            const out = [];
            const libraries = await getAllLibraries();
            for (const lib of libraries) {
                const albums = await getLibraryAlbums(lib.id);
                for (const album of albums) {
                    const groups = await getAlbumGroups(album.id);
                    for (const group of groups) {
                        out.push({
                            id: group.id,
                            name: group.name,
                            path: `${lib.name} / ${album.name}`,
                            imageCount: await countChildren('images', group.id),
                        });
                    }
                }
            }
            return out;
        },

        /* ============================================
         * 资源绑定 (boundResources) 暴露给其他 App
         * ============================================
         *  - resourcesGetBound({ entityType, entityId })
         *      → 读某 persona 的全部资源绑定（avatarGroupIds / stickerGroupIds / apiRefs / promptIds）
         *  - resourcesListGroups({ entityType, entityId, kind })
         *      → 展开某类别（图组 id 列表）为完整的「图组元信息 + 路径」
         *  - resourcesPickRandom({ entityType, entityId, kind })
         *      → 从绑定的图组里随机抽一个图组，再随机抽一张图；返回 { code, source, name, groupId } 或 null
         * ============================================ */

        /** 读某 persona 的资源绑定（默认是 active）。 */
        resourcesGetBound: async ({ entityType, entityId } = {}) => {
            const sdk = window.settingsSdk;
            if (!sdk) return null;
            const et = entityType || 'user';
            const api = et === 'user' ? sdk.users : sdk.aiPersons;
            const persona = entityId
                ? api.get(entityId)
                : api.getActive();
            if (!persona) return null;
            return getBoundResources(persona);
        },

        /** 把某类资源绑定展开成「图组元信息 + 路径」数组。 */
        resourcesListGroups: async ({ entityType, entityId, kind } = {}) => {
            const sdk = window.settingsSdk;
            if (!sdk) return [];
            const et = entityType || 'user';
            const api = et === 'user' ? sdk.users : sdk.aiPersons;
            const persona = entityId
                ? api.get(entityId)
                : api.getActive();
            if (!persona) return [];
            const bound = getBoundResources(persona);
            const field = kind === 'sticker' ? 'stickerGroupIds'
                : kind === 'avatar' ? 'avatarGroupIds'
                : null;
            if (!field) return [];
            const ids = Array.isArray(bound[field]) ? bound[field] : [];
            const result = [];
            for (const gid of ids) {
                const path = await getGroupWithPath(gid);
                if (!path) continue;
                result.push({
                    groupId: path.group?.id,
                    groupName: path.group?.name,
                    albumId: path.album?.id,
                    albumName: path.album?.name,
                    libraryId: path.library?.id,
                    libraryName: path.library?.name,
                    imageSize: path.group?.imageSize,
                });
            }
            return result;
        },

        /** 从绑定的图组里随机抽一个图组，再随机抽一张图。 */
        resourcesPickRandom: async ({ entityType, entityId, kind } = {}) => {
            const sdk = window.settingsSdk;
            if (!sdk) return null;
            const et = entityType || 'user';
            const api = et === 'user' ? sdk.users : sdk.aiPersons;
            const persona = entityId
                ? api.get(entityId)
                : api.getActive();
            if (!persona) return null;
            const bound = getBoundResources(persona);
            const field = kind === 'sticker' ? 'stickerGroupIds'
                : kind === 'avatar' ? 'avatarGroupIds'
                : null;
            if (!field) return null;
            const ids = Array.isArray(bound[field]) ? bound[field] : [];
            // 过滤已被删除的图组
            const valid = [];
            for (const gid of ids) {
                const g = await getGroup(gid);
                if (g) valid.push(g);
            }
            if (valid.length === 0) return null;
            const group = valid[Math.floor(Math.random() * valid.length)];
            const images = await getGroupImages(group.id);
            if (!images || images.length === 0) return null;
            const img = images[Math.floor(Math.random() * images.length)];
            // 按需加载 source
            const src = await getImageByCode(img.code);
            return {
                code: img.code,
                name: img.name,
                groupId: group.id,
                groupName: group.name,
                source: src?.source || src?.thumbnail || null,
            };
        },
    };
}