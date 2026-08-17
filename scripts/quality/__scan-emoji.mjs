/**
 * 扫描源码里会被渲染到界面上的 emoji / 装饰字符。
 *
 * 只看「会出现在 UI 上」的位置，注释里的 ★ ⚠️ → 不算 —— 那是写给人看的，
 * 用户看不到。判断办法：先按行剥掉 // 注释和块注释，再匹配。
 *
 * 用法：
 *   npm run check:emoji                            扫全部 js/ src/ css/
 *   node scripts/quality/__scan-emoji.mjs js/apps/music-app
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const targets = process.argv.slice(2);
const ROOTS = targets.length ? targets : ['js', 'src', 'css'];

// 表情、装饰符号、方向箭头、几何形状。CJK / 全角标点不在内。
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2460}-\u{24FF}\u{25A0}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{2934}\u{2935}\u{3030}\u{303D}\u{3297}\u{3299}]/u;

const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-single', '.git', 'demo-source', 'QAQ', 'chat迁移', 'avatar-white-model', '有意思的效果', 'public']);

function walk(dir, out = []) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return out; }
    for (const e of entries) {
        if (SKIP_DIRS.has(e.name)) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full, out);
        else if (/\.(js|mjs|css|html)$/.test(e.name)) out.push(full);
    }
    return out;
}

/** 把一行里的注释部分抹掉（够用的近似：不处理字符串里的 // 这种边角） */
function stripComments(src) {
    // 块注释整体去掉，但保留换行以维持行号
    let out = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
    out = out.split('\n').map((line) => {
        // 行内 // 注释：前面不能是 : 或 / （避免 http:// ）
        const idx = line.search(/(^|[^:/\\'"`])\/\/(?!\/)/);
        if (idx === -1) return line;
        const at = line.indexOf('//', idx);
        // 粗判：如果 // 之前引号数是奇数，说明在字符串里，不当注释
        const before = line.slice(0, at);
        const quotes = (before.match(/['"`]/g) || []).length;
        if (quotes % 2 === 1) return line;
        return line.slice(0, at);
    }).join('\n');
    return out;
}

const files = ROOTS.flatMap((r) => {
    const full = path.join(ROOT, r);
    if (!fs.existsSync(full)) return [];
    return fs.statSync(full).isDirectory() ? walk(full) : [full];
});

let total = 0;
const byFile = new Map();

for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    const src = /\.(js|mjs)$/.test(file) ? stripComments(raw) : raw;
    const lines = src.split('\n');
    lines.forEach((line, i) => {
        const chars = [...line].filter((ch) => EMOJI_RE.test(ch));
        if (!chars.length) return;
        const rel = path.relative(ROOT, file);
        if (!byFile.has(rel)) byFile.set(rel, []);
        byFile.get(rel).push({ line: i + 1, chars: [...new Set(chars)].join(''), text: line.trim().slice(0, 110) });
        total += chars.length;
    });
}

if (!byFile.size) {
    console.log('干净：没有会渲染到界面上的 emoji / 装饰字符');
    process.exit(0);
}

for (const [file, hits] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n${file}  (${hits.length} 行)`);
    hits.slice(0, 12).forEach((h) => console.log(`  ${String(h.line).padStart(5)} [${h.chars}]  ${h.text}`));
    if (hits.length > 12) console.log(`  … 还有 ${hits.length - 12} 行`);
}
console.log(`\n合计 ${total} 个字符，分布在 ${byFile.size} 个文件`);
