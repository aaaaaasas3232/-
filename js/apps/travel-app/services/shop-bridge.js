/**
 * 候鸟 · 跨 App 桥（四叶草）
 *
 * 「带几件买过的东西一起出行」—— 物品清单从四叶草的只读服务拿。
 *
 * ★ 走 `externalAppRegistry.invokeService`，不 import 四叶草的内部模块：
 *   1. 生命周期不绑死 —— 四叶草出错不连累候鸟注册
 *   2. dev server 的 `?t=` 会给 import 方另一个模块实例，读到的是另一份内存状态
 *
 * `invokeService` 找不到 App 或方法时返回 `Promise.resolve(null)` 不抛，
 * 所以这里必须处理「对方不在」：返回空数组，UI 显示对应空态。
 */

import { externalAppRegistry } from '@/src/core/app-registry.js';
import { asArray } from '../utils.js';

const SHOP_APP = 'shop';

/**
 * 当前档案真正拥有的物品（购买 + 收到的礼物）。
 * @returns {Promise<{id:string,label:string,qty:number,price:number}[]>}
 */
export async function listPurchasedItems() {
    let rows = null;
    try {
        rows = await externalAppRegistry.invokeService(SHOP_APP, 'listPurchasedItems', { includeGifts: true });
    } catch (err) {
        console.warn('[travel] 读四叶草物品失败', err);
        return [];
    }
    // 同名物品合并数量 —— 选择器里出现五条「一样的帽子」没有意义
    const merged = new Map();
    for (const row of asArray(rows)) {
        const label = String(row?.label || '').trim();
        if (!label) continue;
        const prev = merged.get(label);
        if (prev) {
            prev.qty += Math.max(1, Number(row.qty) || 1);
        } else {
            merged.set(label, {
                id: String(row.id || label),
                label,
                qty: Math.max(1, Number(row.qty) || 1),
                price: Number(row.price) || 0,
            });
        }
    }
    return [...merged.values()];
}
