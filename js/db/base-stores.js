/**
 * 小听 - 主数据库配置
 *
 * 包含 5 张基础数据表 + 旧设置 App 的 5 张表 + settings-sdk 12 张新表
 *
 * 思路：所有 store 都提前 appendBaseStore 注册到 ListenDb，
 * 这样不管哪个 App 注册时声明，都能保证 IndexedDB onupgradeneeded 时这些 store 已就位。
 */
import { ListenDb } from './engine.js';

export function createBaseStoresDatabase() {
    const myDb = new ListenDb({ dbName: 'listen_db' });

    const baseStores = [
        { name: 'Userinfo', keyPath: 'userId' },
        { name: 'charInfo', keyPath: 'charId' },
        { name: 'worldInfo', keyPath: 'worldId' },
        { name: 'apiInfo', keyPath: 'apiId' },
        { name: 'AppSettings', keyPath: 'key' },
    ];

    // 设置 App 保留的旧表（外观、API）
    const settingsStores = [
        { name: 'deviceSettings', keyPath: 'key' },
        { name: 'apiProfiles',    keyPath: 'key' },
    ];

    // settings-sdk 新表（12 张）— 见 js/apps/setting/world/sdk/settings-sdk.js
    // v0.17：删除 sdkSocialAccounts / sdkSocialAccountTemplates（社媒已移除）
    // v0.18：新增 sdkDiaries（人设日记，按 entityType+entityId+date 存）
    const sdkStores = [
        { name: 'sdkUsers',                  keyPath: 'id' },
        { name: 'sdkAiPersons',              keyPath: 'id' },
        { name: 'sdkWorlds',                 keyPath: 'id' },
        { name: 'sdkWorldGroups',            keyPath: 'id' },          // ★ v0.11 世界观组
        { name: 'sdkTagGroups',              keyPath: 'id' },
        { name: 'sdkTags',                   keyPath: 'id' },
        { name: 'sdkFactions',               keyPath: 'id' },
        { name: 'sdkPlaces',                 keyPath: 'id' },          // ★ 地点（箱庭地图容器）
        { name: 'sdkLocations',              keyPath: 'id' },          // ★ 场所（地点下的 pin）
        { name: 'sdkSnapshots',              keyPath: 'key' },
        { name: 'sdkActive',                 keyPath: 'key' },
        { name: 'sdkDrafts',                 keyPath: 'id' },          // ★ v0.11 草稿
        { name: 'sdkDiaries',                keyPath: 'id' },          // ★ v0.18 人设日记（id = `${entityType}:${entityId}:${date}`）
        { name: 'sdkSchedules',              keyPath: 'id' },          // ★ v0.19 人设日程（id = `${entityType}:${entityId}:${date}`）
        // ★ API 管理器表
        { name: 'apiKeys',                   keyPath: 'id' },          // API 密钥
        { name: 'apiGroups',                 keyPath: 'id' },          // API 组
        { name: 'apiUsageLogs',              keyPath: 'id' },          // API 调用日志
    ];

    for (const store of baseStores) {
        myDb.appendBaseStore(store.name, store.keyPath);
    }
    for (const store of settingsStores) {
        myDb.appendBaseStore(store.name, store.keyPath);
    }
    for (const store of sdkStores) {
        myDb.appendBaseStore(store.name, store.keyPath);
    }

    myDb.open().catch(error => {
        console.error('[db/base-stores] 打开主数据库失败:', error);
    });

    return myDb;
}