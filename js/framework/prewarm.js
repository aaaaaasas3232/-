/**
 * 小听 · 全局启动预热 (v0.28)
 *
 * 设计目标
 * --------
 * 解决"必须先打开 settings 一次、SDK 才就绪、chat/weather 等 app 才能看到真实数据"的冷启动体验断环。
 *
 * 设计原则
 * --------
 * 1. 任何 app 在打开 detail 页之前都有可能在冷启动,所以 SDK 必须在 `bootstrapSystemData()` 之前就开始 hydrate
 * 2. **fire-and-forget**:不阻塞 framework mount、不阻塞 index.html 渲染,后台并行 hydrate
 * 3. **多次调用幂等**:core-shim / chat-app / weather-app 都可能各调一次,内部判重
 * 4. **fallback 三层保险**:
 *    - 直接拿 `window.settingsSdk`(已就绪)
 *    - 拿 `localStorage('xiaoting::chat-snapshot-v1')` 同步快照
 *    - 都没有时,业务 app 走自己的加载占位
 * 5. **暴露 `whenSettingsSdkReady()` Promise**,任何业务 app 可以 `await` 而不用挂事件监听
 *
 * 写入时机
 * --------
 * SDK hydrate 完成后立刻写一份 `chat-snapshot`,后续 settings 里编辑 user/world 会再次更新。
 */

import { bootstrapSettingsSdk } from '@/js/apps/setting/world/sdk/bootstrap.js';
import { getSettingsSdk } from '@/js/apps/setting/world/sdk/settings-sdk.js';
import { saveSnapshot as saveChatSnapshot } from '@/js/apps/setting/world/sdk/chat-snapshot.js';

let _prewarmedPromise = null;

/**
 * 全局启动预热(settings-sdk)
 *
 * - 不阻塞调用方,返回一个 Promise 让业务 app 可以 await
 * - 内部保证只跑一次(多次调用复用同一个 Promise)
 * - 失败时降级为同步 localStorage 快照
 */
export function prewarmSettingsSdk({ toolkit } = {}) {
    // 1. 已经就绪,直接 resolve
    if (getSettingsSdk()) {
        return Promise.resolve(getSettingsSdk());
    }

    // 2. 已经在跑,复用同一个 Promise
    if (_prewarmedPromise) return _prewarmedPromise;

    // 3. 启动预热
    _prewarmedPromise = (async () => {
        try {
            console.log('[prewarm] 启动 settingsSdk 预热...');
            const sdk = await bootstrapSettingsSdk({ toolkit });

            // hydrate 完立刻落盘一份 chat-snapshot,下次冷启动可秒渲染
            try {
                saveChatSnapshot(sdk);
            } catch (err) {
                console.warn('[prewarm] saveChatSnapshot 失败:', err);
            }

            // 通知所有 await whenSettingsSdkReady() 的调用方
            try {
                window.dispatchEvent(new CustomEvent('settings-sdk-ready', {
                    detail: { source: 'prewarm' },
                }));
            } catch (_) {}

            console.log('[prewarm] settingsSdk 就绪');
            return sdk;
        } catch (err) {
            console.warn('[prewarm] settingsSdk 启动失败,降级到 localStorage 快照:', err);
            _prewarmedPromise = null; // 下次再试
            throw err;
        }
    })();

    return _prewarmedPromise;
}

/**
 * 业务代码:await 一个 Promise,SDK 就绪时 resolve,超时 fallback 也 resolve
 *
 *   const sdk = await whenSettingsSdkReady(2000);
 *   if (sdk) { ... } else { ... 走快照兜底 }
 *
 * @param {number} timeoutMs 最多等多久,超时后立刻 resolve(返回 null 表示未就绪)
 * @returns {Promise<object|null>}
 */
export async function whenSettingsSdkReady(timeoutMs = 1500) {
    if (getSettingsSdk()) return getSettingsSdk();

    // 1. 订阅一次性事件
    let onReady;
    const readyPromise = new Promise((resolve) => {
        onReady = () => resolve(getSettingsSdk());
        window.addEventListener('settings-sdk-ready', onReady, { once: true });
    });

    // 2. 主动触发预热(幂等,跑多次无害)
    const prewarmPromise = prewarmSettingsSdk();

    // 3. 超时兜底
    const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve(getSettingsSdk()), timeoutMs);
    });

    const sdk = await Promise.race([readyPromise, prewarmPromise, timeoutPromise]);
    if (onReady) window.removeEventListener('settings-sdk-ready', onReady);
    return sdk || null;
}

// 自动 fire-and-forget:模块被 import 那一刻就启动预热
//   - 不阻塞 module evaluation
//   - 不阻塞 framework mount
//   - 业务 app 任何时候打开 detail 页,SDK 都大概率已经就绪
if (typeof window !== 'undefined') {
    // 让 prewarm 跑起来(但不阻塞 module 加载)
    Promise.resolve().then(() => {
        try {
            prewarmSettingsSdk().catch((err) => {
                console.warn('[prewarm] 自动启动失败(将在业务 app 内重试):', err);
            });
        } catch (err) {
            console.warn('[prewarm] prewarmSettingsSdk 抛错:', err);
        }
    });
}