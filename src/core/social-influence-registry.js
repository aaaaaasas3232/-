/**
 * 专属生涯 App → 社交 App 的动态影响注册表。
 *
 * 演员、爱豆、电竞等 App 只登记 provider；视频/博客在真正生成列表、评论或
 * 私信时才收集内容。这样没有点击生成就不会调用 API，也不用让任一 App 直接
 * import 另一个 App 的 store。
 */

const providers = new Map();

function text(value) {
    return String(value ?? '').trim();
}

function keyOf(sourceAppId, providerId) {
    const source = text(sourceAppId);
    const id = text(providerId);
    return source && id ? `${source}::${id}` : '';
}

function normalizeTargets(value) {
    const list = Array.isArray(value) ? value : [value];
    return [...new Set(list.map(text).filter(Boolean))];
}

/**
 * @param {{
 *   sourceAppId:string,
 *   providerId:string,
 *   label:string,
 *   targetAppIds:string[],
 *   channels?:string[],
 *   defaultActive?:boolean,
 *   getContent:(context:object)=>string|object|Promise<string|object>
 * }} spec
 */
export function registerSocialInfluenceProvider(spec = {}) {
    const sourceAppId = text(spec.sourceAppId);
    const providerId = text(spec.providerId || spec.id);
    const key = keyOf(sourceAppId, providerId);
    const targetAppIds = normalizeTargets(spec.targetAppIds || spec.targets);
    if (!key || !targetAppIds.length || typeof spec.getContent !== 'function') {
        return () => {};
    }

    providers.set(key, {
        key,
        sourceAppId,
        providerId,
        label: text(spec.label) || providerId,
        targetAppIds,
        channels: normalizeTargets(spec.channels),
        defaultActive: spec.defaultActive !== false,
        getContent: spec.getContent,
    });
    return () => providers.delete(key);
}

export function unregisterSocialInfluenceProvider(sourceAppId, providerId) {
    return providers.delete(keyOf(sourceAppId, providerId));
}

export function listSocialInfluenceProviders(targetAppId, options = {}) {
    const target = text(targetAppId);
    const channel = text(options.channel);
    return [...providers.values()]
        .filter((provider) => provider.targetAppIds.includes(target))
        .filter((provider) => (
            !channel || !provider.channels.length || provider.channels.includes(channel)
        ))
        .map(({ getContent: _getContent, ...provider }) => ({ ...provider }));
}

/**
 * 收集结果直接兼容 `composeContext(parts)`。
 * disabledProviderKeys 来自目标 App 自己按 profileKey 保存的提示词开关。
 */
export async function collectSocialInfluences(options = {}) {
    const targetAppId = text(options.targetAppId);
    const channel = text(options.channel);
    const disabled = new Set((options.disabledProviderKeys || []).map(text));
    const enabled = new Set((options.enabledProviderKeys || []).map(text));
    const matches = [...providers.values()]
        .filter((provider) => provider.targetAppIds.includes(targetAppId))
        .filter((provider) => (
            !channel || !provider.channels.length || provider.channels.includes(channel)
        ));
    const parts = [];

    for (const provider of matches) {
        if (disabled.has(provider.key)) continue;
        try {
            const raw = await provider.getContent({
                ...options,
                sourceAppId: provider.sourceAppId,
                providerId: provider.providerId,
            });
            const content = text(typeof raw === 'object' ? raw?.content : raw);
            if (!content) continue;
            parts.push({
                id: `social-influence:${provider.key}`,
                title: text(raw?.title) || provider.label,
                content,
                source: provider.sourceAppId,
                group: '跨 App 经历',
                active: enabled.has(provider.key) || provider.defaultActive,
                meta: typeof raw === 'object' && raw?.meta ? { ...raw.meta } : {},
            });
        } catch (err) {
            console.warn(`[social-influence] ${provider.key} 读取失败`, err);
        }
    }
    return parts;
}

export function clearSocialInfluenceProviders() {
    providers.clear();
}

export default {
    register: registerSocialInfluenceProvider,
    unregister: unregisterSocialInfluenceProvider,
    list: listSocialInfluenceProviders,
    collect: collectSocialInfluences,
    clear: clearSocialInfluenceProviders,
};
