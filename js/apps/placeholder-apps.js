/**
 * 小听 - 占位 App（仅用于测试桌面翻页 / 底部小点 / 滑动动画）
 *
 * 这里批量注册 12 个没有任何业务内容的"空壳"app，只为撑满桌面到第二页，
 * 方便观察 useDesktopEdit 的分页与滑动表现。
 *
 * 等你做完正式 app 想清理时，直接删掉这个文件 + 清单里的那行就行。
 */

const placeholderPalettes = [
    ['#fb7185', '#f97316'],
    ['#f59e0b', '#facc15'],
    ['#10b981', '#22d3ee'],
    ['#3b82f6', '#6366f1'],
    ['#8b5cf6', '#ec4899'],
    ['#06b6d4', '#3b82f6'],
    ['#22c55e', '#84cc16'],
    ['#ef4444', '#f97316'],
    ['#0ea5e9', '#6366f1'],
    ['#a855f7', '#ec4899'],
    ['#f43f5e', '#fb923c'],
    ['#14b8a6', '#22d3ee'],
];

const placeholderIcons = [
    'M22 18 H38 M22 26 H38 M22 34 H32',
    'M16 18 L30 38 L44 18 Z M24 22 H36',
    'M18 22 H42 V38 H18 Z M22 26 H30',
    'M16 30 a14 14 0 1 1 28 0 a14 14 0 1 1 -28 0 M30 16 V44',
    'M20 20 L40 40 M40 20 L20 40',
    'M18 30 H42 M30 18 V42',
    'M16 42 L24 24 L30 36 L36 22 L44 42 Z',
    'M30 16 L40 26 H32 L28 36 H32 L20 26 Z',
    'M20 18 L40 18 L42 36 L18 36 Z M24 24 H36',
    'M18 22 H42 M22 22 V38 M30 22 V38 M38 22 V38',
    'M18 38 L30 20 L42 38 Z M26 38 V32 H34 V38',
    'M22 18 H38 V42 H22 Z M26 24 H34 M26 30 H34 M26 36 H30',
];

function makePlaceholderApp(index) {
    const id = `placeholder-${index + 1}`;
    const name = `占位 ${String(index + 1).padStart(2, '0')}`;
    const [c1, c2] = placeholderPalettes[index % placeholderPalettes.length];
    const glyph = placeholderIcons[index % placeholderIcons.length];
    return {
        id,
        name,
        iconBg: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`,
        icon: `
            <svg viewBox="0 0 60 60" width="56" height="56" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="6" width="48" height="48" rx="14" fill="rgba(255,255,255,0.18)" />
                <path d="${glyph}" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            </svg>
        `,
    };
}

export default function createPlaceholderApps() {
    const apps = [];
    for (let i = 0; i < 28; i += 1) {
        apps.push(makePlaceholderApp(i));
    }
    return apps;
}