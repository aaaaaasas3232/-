/**
 * 设置 App · 对外服务（services）
 *
 * 其他 App / 桌面 / 启动流程可以通过 `externalAppRegistry.invokeService('settings', 'getApiProfile')`
 * 之类的方式读取配置。
 */

import { getImageByCode, getGroupImages, getGroupWithPath, getGroup, getAlbumGroups } from '../gallery/gallery-db.js';
import { getBoundResources } from '../world/sdk/persona.js';

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