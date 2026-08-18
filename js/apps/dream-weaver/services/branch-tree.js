/**
 * 梦境编织 · 章节脉络树
 *
 * 当前路径 = 章里的 messages。某段有多个版本时在该点分叉,
 * 未激活的那几路挂着各自的后续快照(alt.tail)。
 * 树只给「分支管理」看脉络,不往气泡上画 2/2。
 */

import { truncate } from '../utils.js';
import { normalizeBranchRecord } from './db.js';

export function displayBranchName(alt, index) {
    const name = String(alt?.name || '').trim();
    return name || `分支 ${index + 1}`;
}

export function messageRoleLabel(role) {
    if (role === 'note') return '只记录';
    if (role === 'user') return '我';
    return '正文';
}

export function messagePreview(text, max = 16) {
    return truncate(String(text || '').replace(/\s+/g, ' ').trim(), max);
}

export function countChapterForks(branches) {
    return Object.values(branches || {}).filter((b) => (b?.alternatives?.length || 0) > 1).length;
}

/**
 * @param {object} chapter
 * @returns {Array<{ id, role, preview, forks }>}
 */
export function buildChapterBranchTree(chapter) {
    const messages = Array.isArray(chapter?.messages) ? chapter.messages : [];
    const branches = chapter?.branches || {};
    const visited = new Set();

    function walk(list, depth) {
        if (!Array.isArray(list) || depth > 10) return [];
        const nodes = [];
        for (let i = 0; i < list.length; i++) {
            const message = list[i];
            if (!message?.id || visited.has(String(message.id))) continue;
            visited.add(String(message.id));

            const branch = normalizeBranchRecord(branches[message.id]);
            const forks = branch.alternatives.length > 1
                ? branch.alternatives.map((alt, index) => {
                    const active = index === branch.currentIndex;
                    return {
                        id: alt.id,
                        name: displayBranchName(alt, index),
                        rawName: String(alt.name || '').trim(),
                        preview: messagePreview(alt.content),
                        active,
                        tailCount: (alt.tail || []).length,
                        children: active
                            ? walk(list.slice(i + 1), depth + 1)
                            : walk(alt.tail || [], depth + 1),
                    };
                })
                : [];

            nodes.push({
                id: message.id,
                role: messageRoleLabel(message.role),
                preview: messagePreview(message.content),
                forks,
            });

            if (forks.length) break;
        }
        return nodes;
    }

    return walk(messages, 0);
}
