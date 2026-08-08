/**
 * 数据库版本重置工具
 *
 * ⚠️ 警告：此操作会删除所有已存储数据！只在新版本上线前使用一次。
 *
 * 使用方法：
 *   1. 在浏览器控制台执行：
 *      import('@/js/db/reset-version.js').then(m => m.resetDbVersion());
 *
 *   2. 或者在代码里临时加一行调用后删掉：
 *      await import('@/js/db/reset-version.js').then(m => m.resetDbVersion());
 *      location.reload();
 */

const DB_NAME = 'listen_db';

export async function resetDbVersion() {
    console.warn('[db-reset] ⚠️ 即将删除数据库并重置版本！此操作不可逆！');

    const confirmed = window.confirm(
        '即将删除数据库 "' + DB_NAME + '" 并重置版本。\n\n' +
        '⚠️ 所有已存储的用户数据将被清除！\n\n' +
        '确认继续吗？'
    );
    if (!confirmed) {
        console.log('[db-reset] 用户取消操作');
        return;
    }

    // 1. 关闭所有数据库连接
    const databases = await indexedDB.databases();
    for (const db of databases) {
        if (db.name === DB_NAME) {
            console.log('[db-reset] 关闭数据库连接:', db.name, 'version:', db.version);
            indexedDB.deleteDatabase(db.name);
        }
    }

    // 2. 清除相关 localStorage（防止 schema 缓存）
    const keysToClean = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('xiaoting') || key.includes('listen'))) {
            keysToClean.push(key);
        }
    }
    keysToClean.forEach(key => {
        console.log('[db-reset] 清除 localStorage:', key);
        localStorage.removeItem(key);
    });

    // 3. 重新打开数据库（会从 version 1 开始）
    await new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME);
        req.onsuccess = () => {
            console.log('[db-reset] ✅ 数据库重建成功，version =', req.result.version);
            req.result.close();
            resolve();
        };
        req.onerror = () => reject(req.error);
    });

    console.log('[db-reset] ✅ 完成！请刷新页面（F5）。数据库将从 version 1 重新开始。');
    alert('数据库已重置为 version 1。请刷新页面（F5）。');
}
