// ============================================
// 跨 App Prompt 注册助手（每个 App 拿到一个 toolkit.prompts）
//
// 业务含义：任何 App 都可以把「自家的特殊能力提示词」注册到 murmur（chat-app）的
//           「回复提示词」页。用户能在「可用 Prompt → <你的 App>」折叠区里看到、
//           启用/关闭、编辑、预览；启用后正文会进入最终 system prompt。
//
// 为什么要包一层，而不是直接调 window.settingsSdk.appPrompts：
//   1. **时序**。settings App 和业务 App 的注册顺序不保证，App hydrate 时
//      window.settingsSdk 可能还不存在。直接调会静默丢失（这正是历史上
//      「音乐折叠区里有卡片但没接上」的原因之一）。这里用轮询重试兜住。
//   2. **重渲染**。注册完如果用户正开着 prompt-manager 页，需要主动刷一次，
//      否则要退出重进才看得到。
//   3. **批量 + 幂等**。同 (appId, promptId) 重复注册会覆盖，App 可以在 hydrate
//      里无脑调用，不用自己记「注册过没有」。
//
// 关键约束（踩过坑，别再踩）：
//   - `content` 就是**真正会拼进 system prompt 的正文**，不是给用户看的说明。
//     写成「这个功能是干嘛的」→ AI 收到一段废话；要写成「你可以用 [xxx:yyy] 做什么」。
//   - `promptId` 在同一个 appId 内必须唯一且稳定。用户的启停/编辑状态按
//     `${appId}::${promptId}` 存 IndexedDB，改 id 等于丢用户设置。
//   - 注册表是**内存**的，页面刷新就没了 —— 所以必须在 App 每次 hydrate/setup 时都调。
//     用户改过的 content / 启停状态存在 IndexedDB，register 后会自动合并回来。
// ============================================

const RETRY_INTERVAL_MS = 300;
const MAX_RETRY_MS = 15000;

function getSdk() {
    return (typeof window !== 'undefined' && window.settingsSdk?.appPrompts) || null;
}

/**
 * prompt-manager 页正开着时刷新一次，让新注册的卡片立刻出现。
 * 不在 chat 页就什么都不做（invalidate 很便宜，但没必要平白触发重排）。
 */
function refreshPromptManagerIfOpen() {
    if (typeof document === 'undefined') return;
    if (!document.querySelector('.prompt-manager')) return;
    try {
        window.__invalidateRendererCache?.('chat', null);
        window.__appRendererBridge?.syncNow?.({ force: true });
    } catch (_) { /* 刷新失败不影响注册本身 */ }
}

export function createAppPromptHelper(appId) {
    const safeAppId = String(appId || '');
    // 本 App 声明过的 spec：SDK 迟到时先攒着，就绪后一次性补注册
    const pending = [];
    let waiting = false;

    function flush() {
        const sdk = getSdk();
        if (!sdk || pending.length === 0) return false;
        let ok = 0;
        while (pending.length > 0) {
            const spec = pending.shift();
            try {
                if (sdk.register(spec)) ok += 1;
            } catch (err) {
                console.warn('[app-prompts] register failed', spec?.promptId, err);
            }
        }
        if (ok > 0) refreshPromptManagerIfOpen();
        return ok > 0;
    }

    function scheduleFlush() {
        if (waiting) return;
        waiting = true;
        const startedAt = Date.now();
        const tick = () => {
            if (flush() || pending.length === 0) {
                waiting = false;
                return;
            }
            if (Date.now() - startedAt > MAX_RETRY_MS) {
                waiting = false;
                console.warn(`[app-prompts] settingsSdk 迟迟没就绪，${safeAppId} 的 ${pending.length} 条 prompt 放弃注册`);
                pending.length = 0;
                return;
            }
            setTimeout(tick, RETRY_INTERVAL_MS);
        };
        setTimeout(tick, 0);
    }

    return {
        /**
         * 注册一条或多条 prompt。可以在 SDK 还没就绪时调用（会自动重试）。
         *
         * @param {object|object[]} specs 单条或数组，字段：
         *   promptId      {string}  必填，App 内唯一且稳定
         *   label         {string}  折叠区里显示的标题
         *   content       {string}  真正注入 system prompt 的正文
         *   category      {string}  默认 'special-action'
         *   previewType   {string}  'text' | 'music-card' | 'red-packet-card' | 'location-card'
         *   previewData   {object}  预览卡片的假数据
         *   defaultActive {boolean} 默认是否启用，默认 true
         *   defaultOrder  {number}  同 App 内排序，默认 100
         * @returns {number} 立即注册成功的条数（延迟注册的不计入）
         */
        register(specs) {
            const list = (Array.isArray(specs) ? specs : [specs]).filter(Boolean);
            if (list.length === 0) return 0;
            list.forEach((spec) => pending.push({ ...spec, appId: safeAppId }));
            const before = pending.length;
            const done = flush();
            if (!done && pending.length > 0) scheduleFlush();
            return done ? before : 0;
        },

        /** 注销一条（只清内存注册表，用户编辑过的内容保留在 IndexedDB） */
        unregister(promptId) {
            const sdk = getSdk();
            if (!sdk || !promptId) return false;
            const ok = sdk.unregister(safeAppId, promptId);
            if (ok) refreshPromptManagerIfOpen();
            return ok;
        },

        /** 本 App 已注册的条目（含用户 state） */
        list() {
            return getSdk()?.listByApp?.(safeAppId) || [];
        },

        /** 单条（含用户 state），拿不到返回 null */
        get(promptId) {
            return getSdk()?.get?.(safeAppId, promptId) || null;
        },

        /** 这条 prompt 当前是否会被注入（用户可能在折叠区关掉了） */
        isActive(promptId) {
            const entry = getSdk()?.get?.(safeAppId, promptId);
            return !!entry && entry.active !== false;
        },

        /** 由 App 侧主动改启停 / 正文（用户在 murmur 里的操作走 chat 的 method，不走这里） */
        async setState(promptId, patch) {
            const sdk = getSdk();
            if (!sdk || !promptId) return null;
            const next = await sdk.setState(safeAppId, promptId, patch || {});
            refreshPromptManagerIfOpen();
            return next;
        },
    };
}

export default createAppPromptHelper;
