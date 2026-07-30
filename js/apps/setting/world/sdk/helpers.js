/**
 * settings-sdk · 公共工具函数
 *
 * 集中所有「不依赖具体 store 名」的纯工具，避免各 API 模块重复样板。
 *
 * 提供：
 *   - createPersister：异步落盘封装（忽略 db 不存在的情况）
 *   - loadFromDb：从 IndexedDB 读 records 并写入 cache
 *   - mergePatch：把 patch 合并到 base，自动更新 updatedAt
 *   - sortByName：按 name 排序
 *   - filterByScope：通用 scope 过滤
 *   - ensureMapSet：从 cache Map 中 set 并返回
 */

// ============================================
// 持久化（异步落盘，db 缺失时静默跳过）
// ============================================

/**
 * 创建一个持久化工具函数。
 * @param {object} toolkit  - { db } 来自 App
 * @param {string} storeName - IndexedDB 表名
 * @returns {(record) => Promise<void>}
 */
export const createPersister = (toolkit, storeName) => async (record) => {
    if (!toolkit?.db) return;
    await toolkit.db.put(storeName, record);
};

/**
 * 一次性写入多条记录（清空 + bulkPut）。
 */
export const createBulkPersister = (toolkit, storeName) => async (records) => {
    if (!toolkit?.db) return;
    await toolkit.db.clear(storeName);
    if (records?.length) await toolkit.db.bulkPut(storeName, records);
};

/**
 * 从 db 读取全部记录，写入 cache Map。
 *  - cacheMap.clear() 后逐条 set
 *  - 自动跳过无效记录（无 id / 无 key）
 *  - 当 db 不可用时静默返回
 */
export const loadFromDb = async (toolkit, storeName, cacheMap, keyField = 'id') => {
    if (!toolkit?.db) return;
    const records = await toolkit.db.getAll(storeName);
    cacheMap.clear();
    for (const record of records || []) {
        const key = record?.[keyField];
        if (key) cacheMap.set(key, record);
    }
};

// ============================================
// 通用 merge / sort / filter
// ============================================

/**
 * 把 patch 合并到 base，自动更新 updatedAt。
 * 深度合并（嵌套对象会被递归合并，而不是覆盖）。
 * 列表字段由调用方自行处理（slice）。
 */
export const mergePatch = (base, patch = {}) => {
    const result = { ...base };
    for (const key of Object.keys(patch)) {
        const pv = patch[key];
        const bv = result[key];
        // 如果两者都是纯对象（非数组），深度合并
        if (pv && bv && typeof pv === 'object' && typeof bv === 'object'
            && !Array.isArray(pv) && !Array.isArray(bv)) {
            result[key] = mergePatch(bv, pv);
        } else {
            result[key] = pv;
        }
    }
    result.updatedAt = Date.now();
    return result;
};

/**
 * 按 name 字符串排序（locale）。
 */
export const sortByName = (a, b) => String(a.name).localeCompare(String(b.name));

/**
 * 按 id 排序（locale）。
 */
export const sortById = (a, b) => String(a.id).localeCompare(String(b.id));

/**
 * scope 匹配：
 *   - 'all'     → 不过滤
 *   - 'global'  → 仅匹配 tag.scope === 'global'
 *   - 'world:X' / 'world:X' 前缀 → 仅匹配完全相等
 *   - 其他字符串 → 当作 worldId，自动补 'world:' 前缀
 */
export const matchesScope = (record, scope) => {
    if (scope === 'all') return true;
    if (scope === 'global') return record?.scope === 'global';
    if (typeof scope === 'string' && scope.startsWith('world:')) return record?.scope === scope;
    return record?.scope === `world:${scope}`;
};

/**
 * 规范化 scope 字符串。
 */
export const normalizeScope = (scope) => {
    if (typeof scope !== 'string' || !scope) return 'global';
    if (scope === 'global') return 'global';
    if (scope.startsWith('world:')) return scope;
    if (/^world[\w-]+$/.test(scope)) return `world:${scope}`;
    return 'global';
};

// ============================================
// 创建时间戳工具
// ============================================

/** 当前时间戳（Date.now 的语义化包装）。 */
export const now = () => Date.now();

// ============================================
// 安全的取缓存
// ============================================

/** 从 Map 取值，缺失返回 fallback（默认 null）。 */
export const mapGet = (map, key, fallback = null) => map?.get(key) ?? fallback;

// ============================================
// 安全的异步串行循环
// ============================================

/** 串行执行 async 回调数组，返回结果数组。 */
export const sequential = async (items, fn) => {
    const out = [];
    for (const item of items) out.push(await fn(item));
    return out;
};