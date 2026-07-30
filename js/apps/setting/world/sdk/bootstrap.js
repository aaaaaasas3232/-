/**
 * settings-sdk · 启动器（bootstrap）
 *
 *   在 settings app 注册时调用一次：
 *     const sdk = await bootstrapSettingsSdk({ toolkit });
 *
 *   行为：
 *     1. 构造 sdk 实例（createSettingsSdk）
 *     2. 顺序 hydrate：users → aiPersons → worlds → worldGroups → tagGroups → tags →
 *        locations → snapshots → profile → drafts
 *     3. 把 sdk 实例挂到 window.settingsSdk + 模块内单例
 *
 *   注意：
 *     - 时间线 / 时间锚点 都嵌在世界实例里，不需要独立 hydrate。
 *     - 创建 settings App 时要在 appConfig.stores 里把 sdkDrafts 表声明进去。
 */

import { createSettingsSdk, setSettingsSdk } from './settings-sdk.js';
import { SYSTEM_TAG_GROUPS } from './defaults.js';

export async function bootstrapSettingsSdk({ toolkit }) {
    const sdk = createSettingsSdk({ toolkit });

    // ★ v0.18.1 启动前强制保证 db schema 已升级（处理历史 db 没建新 store 的情况）
    // 注意：toolkit.db 是 createAppDbApi 的闭包，没有 ensureSchema()，必须直接走 window.myDb
    const realDb = typeof window !== 'undefined' ? window.myDb : null;
    if (realDb?.ensureSchema) {
        try {
            const beforeStores = realDb.db ? Array.from(realDb.db.objectStoreNames || []) : [];
            const wanted = (realDb._baseStores || []).map(s => s.name);
            const missing = wanted.filter(n => !beforeStores.includes(n));
            console.log('[settings-sdk.bootstrap] db version=', realDb.db?.version,
                '| stores=', beforeStores.length, '/ wanted', wanted.length,
                '| missing=', missing);
            await realDb.ensureSchema();
            const afterStores = realDb.db ? Array.from(realDb.db.objectStoreNames || []) : [];
            console.log('[settings-sdk.bootstrap] ensureSchema 后 version=', realDb.db?.version,
                '| stores=', afterStores.length);
        } catch (err) {
            console.warn('[settings-sdk] ensureSchema 失败', err);
        }
    }

    // 1. 顺序 hydrate（顺序很重要：user/ai/world 先 → group/tag/geo/snapshot → profile）
    await sdk.users.hydrate();
    await sdk.aiPersons.hydrate();
    await sdk.worlds.hydrate();
    await sdk.worldGroups.hydrate();
    await sdk.tagGroups.hydrate();
    await sdk.tags.hydrate();
    await sdk.places.hydrate();   // ★ 地点（箱庭地图容器）
    await sdk.locations.hydrate();
    await sdk.snapshot.hydrate();
    await sdk.profile.hydrate();
    await sdk.drafts.hydrate();
    await sdk.diary.hydrate();   // ★ v0.18 人设日记
    await sdk.schedule.hydrate(); // ★ v0.19 人设日程

    // ★ v0.23 旧嵌套 lifePhases / parOs 一次性迁移为顶级独立卡。
    await sdk.persona.variants.migrateLegacy();

    setSettingsSdk(sdk);
    if (typeof window !== 'undefined') {
        window.settingsSdk = sdk;
        window.LISTEN_SYSTEM_TAG_GROUPS = SYSTEM_TAG_GROUPS;
    }
    return sdk;
}