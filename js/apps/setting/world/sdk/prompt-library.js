/**
 * settings-sdk · chat-app prompt 库 SDK adapter（v0.58）
 *
 * 业务含义:
 *   settings app 里有一整套「Prompt 工程」模块（库 / 包 / 组 / 条目），
 *   数据持久化在 prompt_db 里（独立 IndexedDB 库，4 张表）。
 *
 *   chat-app 的 prompt-manager 现在需要「拉取 prompt 库里的 prompt 到
 *   当前 AI 人设的 replyPrompts 列表」——也就是把 settings 维护的模板条目
 *   复制一份成 aiPerson.replyPrompts 的一条新记录。
 *
 * 数据源:
 *   js/apps/setting/prompt/prompt-db.js
 *     - getAllLibraries() / getLibrary(id)
 *     - getLibraryPackages(libraryId) / getPackage(id)
 *     - getPackageGroups(packageId) / getGroup(id)
 *     - getGroupPrompts(groupId) / getPrompt(id)
 *
 * API（挂在 sdk.promptLibrary）:
 *   listLibraries()                        → Array<Library>             全部库（按 order 升序）
 *   listLibraryFull(libraryId)             → { library, packages, groups, prompts }
 *   listAllPrompts()                       → Array<{ prompt, group, package, library }>
 *   getPrompt(promptId)                    → Prompt | null
 *   getPromptWithPath(promptId)            → { prompt, group, package, library } | null
 *
 * 设计要点:
 *   - 完全只读（拉取操作），不提供 create/update/delete（那些仍由 settings app 维护）
 *   - 不缓存（chat-app 调用频率低，每次拉一份最新；缓存反而会导致「settings 改了
 *     prompt 条目，chat-app 看不到」的问题）
 *   - SDK 未就绪时所有 API 返回空数组 / null，不抛异常（业务代码 race 兜底）
 *   - 跨 app 解耦：chat-app 只通过 sdk.promptLibrary 访问，不知道 prompt-db.js 存在
 *
 * 依赖:
 *   - prompt-db.js 的 initPromptDb / getAllLibraries / getLibrary / ...
 *   - 不需要 toolkit / cache / events（纯只读 adapter）
 *
 * 集成:
 *   settings-sdk.js 里 `sdk.promptLibrary = createPromptLibraryApi();`
 *   chat-app 直接 `await sdk.promptLibrary.listAllPrompts()` 拿到全部 prompt 条目
 *   + 来源信息（库 / 包 / 组），在 prompt-manager 底部展示「Prompt 库」section。
 */

import {
    initPromptDb,
    getAllLibraries,
    getLibrary,
    getLibraryPackages,
    getPackage,
    getPackageGroups,
    getGroup,
    getGroupPrompts,
    getPrompt,
    getGroupWithPath,
} from '../../prompt/prompt-db.js';

// ============================================================
// 内部工具
// ============================================================

async function _ensurePromptDbReady() {
    try {
        await initPromptDb();
        return true;
    } catch (err) {
        console.warn('[promptLibrary] initPromptDb failed', err);
        return false;
    }
}

// ============================================================
// SDK 工厂
// ============================================================

export function createPromptLibraryApi() {
    return {
        /**
         * 列出全部 Prompt 库（按 order 升序）
         * @returns {Promise<Array<Library>>}
         */
        async listLibraries() {
            const ok = await _ensurePromptDbReady();
            if (!ok) return [];
            try {
                return await getAllLibraries();
            } catch (err) {
                console.warn('[promptLibrary] listLibraries failed', err);
                return [];
            }
        },

        /**
         * 列出某个库的完整树（library + packages + groups + prompts）
         * @returns {Promise<{ library, packages, groups, prompts }|null>}
         */
        async listLibraryFull(libraryId) {
            const ok = await _ensurePromptDbReady();
            if (!ok) return null;
            try {
                const library = await getLibrary(libraryId);
                if (!library) return null;
                const packages = await getLibraryPackages(libraryId);
                const groups = [];
                for (const pkg of packages) {
                    const gs = await getPackageGroups(pkg.id);
                    groups.push(...gs);
                }
                const prompts = [];
                for (const grp of groups) {
                    const ps = await getGroupPrompts(grp.id);
                    prompts.push(...ps);
                }
                return { library, packages, groups, prompts };
            } catch (err) {
                console.warn('[promptLibrary] listLibraryFull failed', err);
                return null;
            }
        },

        /**
         * 列出全部 Prompt 条目 + 来源信息（库/包/组）
         * @returns {Promise<Array<{ prompt, group, package, library }>>}
         */
        async listAllPrompts() {
            const ok = await _ensurePromptDbReady();
            if (!ok) return [];
            try {
                const libs = await getAllLibraries();
                const out = [];
                for (const lib of libs) {
                    const packages = await getLibraryPackages(lib.id);
                    for (const pkg of packages) {
                        const groups = await getPackageGroups(pkg.id);
                        for (const grp of groups) {
                            const prompts = await getGroupPrompts(grp.id);
                            for (const pr of prompts) {
                                out.push({
                                    prompt: pr,
                                    group: grp,
                                    package: pkg,
                                    library: lib,
                                });
                            }
                        }
                    }
                }
                return out;
            } catch (err) {
                console.warn('[promptLibrary] listAllPrompts failed', err);
                return [];
            }
        },

        /**
         * 读单条 prompt
         * @param {string} promptId
         * @returns {Promise<object|null>}
         */
        async getPrompt(promptId) {
            const ok = await _ensurePromptDbReady();
            if (!ok) return null;
            try {
                return await getPrompt(promptId);
            } catch (err) {
                console.warn('[promptLibrary] getPrompt failed', err);
                return null;
            }
        },

        /**
         * 读单条 prompt + 完整路径
         * @param {string} promptId
         * @returns {Promise<{ prompt, group, package, library }|null>}
         */
        async getPromptWithPath(promptId) {
            const ok = await _ensurePromptDbReady();
            if (!ok) return null;
            try {
                const pr = await getPrompt(promptId);
                if (!pr || !pr.groupId) return null;
                const grp = await getGroupWithPath(pr.groupId);
                if (!grp) return null;
                return {
                    prompt: pr,
                    group: grp.group,
                    package: grp.package,
                    library: grp.library,
                };
            } catch (err) {
                console.warn('[promptLibrary] getPromptWithPath failed', err);
                return null;
            }
        },
    };
}