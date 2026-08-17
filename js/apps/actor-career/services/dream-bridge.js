/**
 * 追光 · 梦境编织桥
 *
 * 剧本可以从梦境编织的书架改编：走 externalAppRegistry 调它的只读
 * services（listBooks / getAdaptationSource），绝不 import 它的 store。
 * 保存 sourceAppId + bookId + sourceRevision 快照；原作后来改了不偷偷
 * 重写已开拍项目，由用户主动「重新同步」。
 */

import { externalAppRegistry } from '@/src/core/app-registry.js';

export async function listDreamBooks() {
    try {
        const rows = await externalAppRegistry.invokeService('dream-weaver', 'listBooks', {});
        return Array.isArray(rows) ? rows : [];
    } catch (err) {
        console.warn('[actor] 读梦境编织书架失败', err);
        return [];
    }
}

/**
 * 拉一本书的改编资料。
 * @returns {{ok:boolean, source?:object, error?:string}}
 */
export async function getAdaptationSource(bookId) {
    if (!bookId) return { ok: false, error: '没有选书' };
    try {
        const result = await externalAppRegistry.invokeService('dream-weaver', 'getAdaptationSource', { bookId });
        if (!result || result.ok === false) {
            return { ok: false, error: result?.error || '这本书拿不到改编资料' };
        }
        const src = result.source || result;
        return {
            ok: true,
            source: {
                sourceAppId: 'dream-weaver',
                bookId: String(bookId),
                title: String(src.title || result.title || '未命名作品'),
                synopsis: String(src.synopsis || src.summary || result.synopsis || ''),
                excerpt: String(src.excerpt || src.content || result.excerpt || ''),
                sourceRevision: Number(src.revision ?? src.updatedAt ?? result.updatedAt ?? Date.now()),
                snapshotAt: Date.now(),
            },
        };
    } catch (err) {
        console.warn('[actor] 拉改编资料失败', err);
        return { ok: false, error: err?.message || '梦境编织暂时联系不上' };
    }
}

/** 检查原作是否更新过（对比 sourceRevision） */
export async function checkSourceUpdated(project) {
    const src = project?.source;
    if (!src?.bookId) return { updated: false };
    const fresh = await getAdaptationSource(src.bookId);
    if (!fresh.ok) return { updated: false, error: fresh.error };
    return {
        updated: Number(fresh.source.sourceRevision) !== Number(src.sourceRevision),
        fresh: fresh.source,
    };
}
