/**
 * relax-app / 内置装饰库
 *
 * 装饰是摆在舞台上的小贴纸(可拖、可缩放、可旋转、可染色、可删)。
 * 全部是 inline SVG,用 `currentColor` 承接染色 —— 所以只要给容器设 color,
 * 整个装饰就变色了,不需要为每个颜色准备一份素材。
 *
 * 装饰契约:
 *   { id, name, group, defaultTint, aspect, svg }
 *
 * ⚠️ svg 里所有可染色部位必须用 `currentColor`;
 *    需要固定色的细节(比如高光白点)才写死 hex。
 *
 * 加新装饰:往 DECORATIONS 里 push 一条,`group` 决定它出现在选择器的哪个分组。
 */

export const DECORATION_GROUPS = Object.freeze([
    { id: 'plant', name: '植物' },
    { id: 'sweet', name: '甜点' },
    { id: 'object', name: '小物' },
    { id: 'mood', name: '氛围' },
]);

export const DECORATIONS = Object.freeze([
    {
        id: 'leaf-sprig',
        name: '叶枝',
        group: 'plant',
        defaultTint: '#cfe8b0',
        aspect: 1,
        svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M32 58V26" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity="0.75"/>
            <path d="M32 30C32 30 18 28 14 16c12-2 18 8 18 14z" fill="currentColor"/>
            <path d="M32 38c0 0 14-2 18-14-12-2-18 8-18 14z" fill="currentColor" opacity="0.82"/>
            <path d="M32 26c0 0-8-8-6-18 9 4 8 14 6 18z" fill="currentColor" opacity="0.9"/>
        </svg>`,
    },
    {
        id: 'potted-plant',
        name: '盆栽',
        group: 'plant',
        defaultTint: '#b8f2e6',
        aspect: 0.86,
        svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 40h20l-3 18a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3z" fill="currentColor" opacity="0.55"/>
            <rect x="19" y="34" width="26" height="8" rx="4" fill="currentColor" opacity="0.75"/>
            <path d="M32 34V18" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/>
            <ellipse cx="22" cy="20" rx="9" ry="6.5" transform="rotate(-24 22 20)" fill="currentColor"/>
            <ellipse cx="42" cy="22" rx="8.5" ry="6" transform="rotate(22 42 22)" fill="currentColor" opacity="0.85"/>
            <ellipse cx="32" cy="11" rx="7" ry="6" fill="currentColor" opacity="0.95"/>
        </svg>`,
    },
    {
        id: 'clover',
        name: '三叶草',
        group: 'plant',
        defaultTint: '#cfe8b0',
        aspect: 1,
        svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M32 36v22" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" opacity="0.7"/>
            <circle cx="21" cy="26" r="11" fill="currentColor"/>
            <circle cx="43" cy="26" r="11" fill="currentColor" opacity="0.88"/>
            <circle cx="32" cy="12" r="10" fill="currentColor" opacity="0.94"/>
        </svg>`,
    },
    {
        id: 'macaron',
        name: '马卡龙',
        group: 'sweet',
        defaultTint: '#ffafcc',
        aspect: 1.1,
        svg: `<svg viewBox="0 0 64 58" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 20a26 12 0 0 1 52 0v2a26 10 0 0 1-52 0z" fill="currentColor"/>
            <ellipse cx="32" cy="30" rx="24" ry="6" fill="#fff8ec" opacity="0.9"/>
            <path d="M6 36a26 12 0 0 0 52 0v-2a26 10 0 0 0-52 0z" fill="currentColor" opacity="0.85"/>
            <ellipse cx="24" cy="17" rx="7" ry="3" fill="#ffffff" opacity="0.45"/>
        </svg>`,
    },
    {
        id: 'donut',
        name: '甜甜圈',
        group: 'sweet',
        defaultTint: '#ffd6a5',
        aspect: 1,
        svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="32" cy="32" r="26" fill="currentColor"/>
            <path d="M32 6a26 26 0 0 1 22 12c-4 10-14 8-22 14S18 46 8 44A26 26 0 0 1 32 6z" fill="#ffffff" opacity="0.32"/>
            <circle cx="32" cy="32" r="9" fill="#fff8ec"/>
            <circle cx="20" cy="20" r="2" fill="#ffffff" opacity="0.8"/>
            <circle cx="44" cy="24" r="1.8" fill="#ffffff" opacity="0.7"/>
            <circle cx="42" cy="45" r="2" fill="#ffffff" opacity="0.75"/>
        </svg>`,
    },
    {
        id: 'candy-jar',
        name: '糖罐',
        group: 'sweet',
        defaultTint: '#a2d2ff',
        aspect: 0.8,
        svg: `<svg viewBox="0 0 52 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="16" y="4" width="20" height="7" rx="3.5" fill="currentColor" opacity="0.9"/>
            <path d="M8 18a18 18 0 0 1 36 0v30a10 10 0 0 1-10 10H18A10 10 0 0 1 8 48z" fill="currentColor" opacity="0.4"/>
            <circle cx="20" cy="38" r="5" fill="currentColor"/>
            <circle cx="33" cy="45" r="5.5" fill="currentColor" opacity="0.8"/>
            <circle cx="30" cy="30" r="4.5" fill="currentColor" opacity="0.9"/>
            <path d="M14 20a14 14 0 0 1 8-8" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.55"/>
        </svg>`,
    },
    {
        id: 'teacup',
        name: '茶杯',
        group: 'object',
        defaultTint: '#fff5e4',
        aspect: 1.15,
        svg: `<svg viewBox="0 0 64 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 20h34v14a17 17 0 0 1-34 0z" fill="currentColor"/>
            <path d="M44 24h6a7 7 0 0 1 0 14h-6" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
            <ellipse cx="27" cy="20" rx="17" ry="5" fill="#ffffff" opacity="0.55"/>
            <ellipse cx="30" cy="50" rx="22" ry="4" fill="currentColor" opacity="0.35"/>
            <path d="M22 12c2-3-1-5 1-8M32 12c2-3-1-5 1-8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity="0.5"/>
        </svg>`,
    },
    {
        id: 'lantern',
        name: '小灯',
        group: 'object',
        defaultTint: '#ffe5a5',
        aspect: 0.72,
        svg: `<svg viewBox="0 0 46 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M23 2v8" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
            <path d="M6 26a17 16 0 0 1 34 0c0 12-6 20-17 20S6 38 6 26z" fill="currentColor"/>
            <rect x="14" y="46" width="18" height="6" rx="3" fill="currentColor" opacity="0.7"/>
            <ellipse cx="17" cy="22" rx="5" ry="7" fill="#ffffff" opacity="0.45"/>
        </svg>`,
    },
    {
        id: 'pebble-stack',
        name: '叠石',
        group: 'object',
        defaultTint: '#b9c6d4',
        aspect: 0.9,
        svg: `<svg viewBox="0 0 58 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="29" cy="54" rx="25" ry="9" fill="currentColor" opacity="0.75"/>
            <ellipse cx="27" cy="38" rx="18" ry="8" fill="currentColor" opacity="0.9"/>
            <ellipse cx="30" cy="24" rx="13" ry="7" fill="currentColor"/>
            <ellipse cx="28" cy="13" rx="8" ry="5.5" fill="currentColor" opacity="0.85"/>
        </svg>`,
    },
    {
        id: 'cloud-puff',
        name: '云朵',
        group: 'mood',
        defaultTint: '#ffffff',
        aspect: 1.6,
        svg: `<svg viewBox="0 0 80 50" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="24" cy="30" r="16" fill="currentColor"/>
            <circle cx="44" cy="22" r="20" fill="currentColor"/>
            <circle cx="62" cy="32" r="14" fill="currentColor"/>
            <rect x="12" y="32" width="58" height="16" rx="8" fill="currentColor"/>
        </svg>`,
    },
    {
        id: 'sparkle',
        name: '闪光',
        group: 'mood',
        defaultTint: '#ffe5a5',
        aspect: 1,
        svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M32 4c3 16 12 25 28 28-16 3-25 12-28 28-3-16-12-25-28-28 16-3 25-12 28-28z" fill="currentColor"/>
            <path d="M52 40c1.4 7 5.2 10.6 12 12-6.8 1.4-10.6 5-12 12-1.4-7-5.2-10.6-12-12 6.8-1.4 10.6-5 12-12z" fill="currentColor" opacity="0.7"/>
        </svg>`,
    },
    {
        id: 'heart-soft',
        name: '爱心',
        group: 'mood',
        defaultTint: '#ffafcc',
        aspect: 1.1,
        svg: `<svg viewBox="0 0 64 58" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M32 54S4 38 4 21A15 15 0 0 1 32 12 15 15 0 0 1 60 21c0 17-28 33-28 33z" fill="currentColor"/>
            <ellipse cx="20" cy="22" rx="6" ry="4.5" transform="rotate(-28 20 22)" fill="#ffffff" opacity="0.45"/>
        </svg>`,
    },
    {
        id: 'ribbon-bow',
        name: '蝴蝶结',
        group: 'mood',
        defaultTint: '#ffafcc',
        aspect: 1.4,
        svg: `<svg viewBox="0 0 70 50" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M32 25C22 12 4 10 4 24s18 12 28-1z" fill="currentColor"/>
            <path d="M38 25C48 12 66 10 66 24s-18 12-28-1z" fill="currentColor" opacity="0.88"/>
            <path d="M30 24l-8 24M40 24l8 24" stroke="currentColor" stroke-width="5" stroke-linecap="round" opacity="0.6"/>
            <circle cx="35" cy="25" r="7" fill="currentColor"/>
            <circle cx="33" cy="23" r="2.4" fill="#ffffff" opacity="0.55"/>
        </svg>`,
    },
]);

export function getDecoration(id) {
    return DECORATIONS.find(item => item.id === id) || null;
}

export function listDecorationsByGroup(groupId) {
    return DECORATIONS.filter(item => item.group === groupId);
}
