/**
 * 湛蓝回忆 · 剧本落地
 *
 * `script-format.js` 只管文本 ↔ 结构;这里管**结构 → 真的节点树**,
 * 以及文件进出浏览器那几件脏活(FileReader / Blob 下载 / 剪贴板)。
 *
 * ── 最要紧的一条约定 ──────────────────────────────────────────────
 *
 * `store.chooseOption(text)` 是这样跳分支的:
 *
 *     node.childIds.map(找节点).find((c) => c.choice.text === text)
 *
 * 也就是说**子节点的 `choice.text` 必须和父节点 `options[]` 里的那一条一字不差**。
 * 差一个空格,玩家点下去就不是「跳到已经写好的那一幕」,而是去调 AI 重新生成 ——
 * 预设剧本会当场露馅,而且不报任何错。所以这里两边都用同一个字符串来源:
 * `parseScript` 里 `option.text` 归一之后的那一份。
 *
 * ── kState 怎么给 ─────────────────────────────────────────────────
 *
 * **和正常玩出来的节点一模一样**:按树的层序,逐个调 `kchain.js` 的 `advanceWindow`,
 * 父节点先算、子节点后算。没有自己拼 units,也没有留空。
 *
 * 为什么不给「中性空窗口」:那样从导入的某一幕接着用 AI 往下写时,
 * K 链会以为这条线才刚开始,前面几十幕的记忆凭空消失。
 *
 * 为什么窗口会超过 windowSize:导入过程**不调 AI**,所以满格了也压不出 K。
 * 这不需要特殊处理 —— `generateNext` 里 `needsCompress` 的判据是
 * `units.length >= size`,用户第一次用 API 续写时会自动把这一批补压掉。
 */

import { normalizeNode } from './db.js';
import { advanceWindow } from './kchain.js';
import { makeId, asArray } from '../utils.js';

// ============================================================
// 结构 → 节点树
// ============================================================

/**
 * 把 `parseScript()` 的结果铺成一批可以直接落盘的节点。
 *
 * @param {object} arg
 * @param {object} arg.parsed          `parseScript()` 的返回值
 * @param {string} arg.gameId
 * @param {number} [arg.windowSize]    K 链窗口大小(取 `settings.kChain.windowSize`)
 * @param {Map<string,string>} [arg.sceneIdByName] 场景名 → library.scenes 里的 id
 * @returns {{ nodes:Array, rootNodeId:string, skipped:number }}
 */
export function buildScriptNodes({ parsed, gameId, windowSize = 4, sceneIdByName = new Map() }) {
    const source = asArray(parsed?.nodes);
    const byKey = new Map(source.map((n) => [n.labelKey, n]));
    const idByKey = new Map(source.map((n) => [n.labelKey, makeId('node')]));

    const startKey = String(parsed?.startLabel || '').toLowerCase();
    if (!startKey || !byKey.has(startKey)) return { nodes: [], rootNodeId: '', skipped: source.length };

    const recByKey = new Map();
    const nodes = [];
    const base = Date.now();
    const queue = [startKey];
    const seen = new Set([startKey]);

    while (queue.length) {
        const key = queue.shift();
        const src = byKey.get(key);
        if (!src) continue;

        const parentKey = String(src.parentLabel || '').toLowerCase();
        const parentRec = parentKey ? recByKey.get(parentKey) : null;
        const id = idByKey.get(key);

        const sceneKey = src.scene
            ? (sceneIdByName.get(src.scene) || parentRec?.sceneKey || '')
            : (parentRec?.sceneKey || '');

        const rec = normalizeNode({
            id,
            gameId,
            parentId: parentRec?.id || '',
            depth: (parentRec?.depth ?? -1) + 1,
            choice: {
                kind: parentRec ? (src.choice?.kind || 'option') : 'start',
                text: parentRec ? String(src.choice?.text || '') : '',
            },
            segments: src.segments,
            options: src.options.map((o) => o.text),
            sceneKey,
            childIds: [],
            ending: src.ending,
            createdAt: base + nodes.length,
        }, gameId);

        // ★ 窗口推进走 kchain.js,不在这里手搓 units
        const adv = advanceWindow(parentRec?.kState, rec.id, windowSize);
        rec.kState = { units: adv.units, kCount: adv.kCount, pending: false };

        if (parentRec) parentRec.childIds = [...asArray(parentRec.childIds), rec.id];

        recByKey.set(key, rec);
        nodes.push(rec);

        for (const childLabel of asArray(src.childLabels)) {
            const childKey = String(childLabel).toLowerCase();
            if (seen.has(childKey) || !byKey.has(childKey)) continue;
            seen.add(childKey);
            queue.push(childKey);
        }
    }

    return { nodes, rootNodeId: recByKey.get(startKey)?.id || '', skipped: source.length - nodes.length };
}

/** 剧本里出现过的说话人(去重,按出场顺序) */
export function collectScriptSpeakers(parsed) {
    const out = [];
    const seen = new Set();
    for (const name of asArray(parsed?.meta?.cast)) {
        const key = String(name || '').trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(key);
    }
    for (const node of asArray(parsed?.nodes)) {
        for (const seg of asArray(node.segments)) {
            const key = String(seg.speaker || '').trim();
            if (!key || seen.has(key)) continue;
            seen.add(key);
            out.push(key);
        }
    }
    return out;
}

/** 剧本里出现过的场景名(去重) */
export function collectScriptScenes(parsed) {
    const out = [];
    const seen = new Set();
    for (const node of asArray(parsed?.nodes)) {
        const name = String(node.scene || '').trim();
        if (!name || seen.has(name)) continue;
        seen.add(name);
        out.push(name);
    }
    return out;
}

// ============================================================
// 文件进出
// ============================================================

/** 给下载的文件起名 —— 换掉文件系统不认的字符 */
export function scriptFileName(title) {
    const safe = String(title || '湛蓝回忆剧本')
        .replace(/[\\/:*?"<>|\r\n\t]/g, '')
        .trim()
        .slice(0, 40) || '湛蓝回忆剧本';
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${safe}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.txt`;
}

/** 读一个用户选的文本文件 */
export function readTextFile(file) {
    return new Promise((resolve) => {
        if (!file) { resolve({ ok: false, text: '', error: '没有选中文件' }); return; }
        if (file.size > 4 * 1024 * 1024) {
            resolve({ ok: false, text: '', error: '文件太大了(超过 4MB),剧本应该只有几十 KB' });
            return;
        }
        try {
            const reader = new FileReader();
            reader.onload = () => resolve({ ok: true, text: String(reader.result || ''), error: '' });
            reader.onerror = () => resolve({ ok: false, text: '', error: '读不出这个文件,换一个试试' });
            reader.readAsText(file, 'utf-8');
        } catch (err) {
            resolve({ ok: false, text: '', error: err?.message || '读文件失败' });
        }
    });
}

/**
 * 下载一段文本。
 *
 * ★ `revokeObjectURL` 要延后 —— 立刻 revoke 的话部分浏览器的下载还没拿到数据,
 *   表现是「点了下载,文件是空的」(抄 `src/core/plugin-installer.js` 的做法)。
 */
export function downloadText(text, fileName = 'script.txt') {
    if (typeof document === 'undefined') return false;
    try {
        const blob = new Blob([String(text ?? '')], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return true;
    } catch (err) {
        console.warn('[galgame/script] 下载失败', err);
        return false;
    }
}

/**
 * 复制到剪贴板。
 *
 * 非 https / 老浏览器下 `navigator.clipboard` 直接没有,退回 `execCommand`
 * (和 `js/apps/app-maker/components/result.js` 同一套兜底)。
 */
export async function copyText(text) {
    const value = String(text ?? '');
    try {
        await navigator.clipboard.writeText(value);
        return true;
    } catch (_) {
        try {
            const ta = document.createElement('textarea');
            ta.value = value;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return ok;
        } catch (_) {
            return false;
        }
    }
}

export default { buildScriptNodes, collectScriptSpeakers, collectScriptScenes, readTextFile, downloadText, copyText };
