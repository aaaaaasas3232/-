/**
 * 设置 App · 主页面
 *
 * iOS 设置风：顶部 Apple-ID 卡 + 7 个独立入口卡片。
 *
 * 入口：
 *   - 用户    ◍   user detail
 *   - AI      ◉   ai detail
 *   - 世界观  ◯   world detail
 *   - 图库    ▣   gallery detail
 *   - Prompt  ✎   prompt detail
 *   - 外观    ◐   appearance detail
 *   - API     ◇   api detail
 */

import {
    renderProfileCard,
    renderRow,
    renderFooterNote,
} from '../ui-components.js';

const PINK = '#FF85A2';
const BLUE = '#5C9CFC';

const SVG_APPEARANCE = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-dessert-icon lucide-dessert"><path d="M10.162 3.167A10 10 0 0 0 2 13a2 2 0 0 0 4 0v-1a2 2 0 0 1 4 0v4a2 2 0 0 0 4 0v-4a2 2 0 0 1 4 0v1a2 2 0 0 0 4-.006 10 10 0 0 0-8.161-9.826"/><path d="M20.804 14.869a9 9 0 0 1-17.608 0"/><circle cx="12" cy="4" r="2"/></svg>`;

const SVG_WORLD = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin-icon lucide-map-pin"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>`;

const SVG_AI = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-rabbit-icon lucide-rabbit"><path d="M13 16a3 3 0 0 1 2.24 5"/><path d="M18 12h.01"/><path d="M18 21h-8a4 4 0 0 1-4-4 7 7 0 0 1 7-7h.2L9.6 6.4a1 1 0 1 1 2.8-2.8L15.8 7h.2c3.3 0 6 2.7 6 6v1a2 2 0 0 1-2 2h-1a3 3 0 0 0-3 3"/><path d="M20 8.54V4a2 2 0 1 0-4 0v3"/><path d="M7.612 12.524a3 3 0 1 0-1.6 4.3"/></svg>`;

const SVG_GALLERY = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-palette-icon lucide-palette"><path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/></svg>`;

const SVG_PROMPT = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-terminal-icon lucide-square-terminal"><path d="m7 11 2-2-2-2"/><path d="M11 13h4"/><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/></svg>`;

const SVG_API = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-key-round-icon lucide-key-round"><path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/></svg>`;

const SVG_IMPORT_EXPORT = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-cloud-download-icon lucide-cloud-download"><path d="M12 13v8l-4-4"/><path d="m12 21 4-4"/><path d="M4.393 15.269A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.436 8.284"/></svg>`;

const SVG_DATABASE = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-database-search-icon lucide-database-search"><path d="M21 11.693V5"/><path d="m22 22-1.875-1.875"/><path d="M3 12a9 3 0 0 0 8.697 2.998"/><path d="M3 5v14a9 3 0 0 0 9.28 2.999"/><circle cx="18" cy="18" r="3"/><ellipse cx="12" cy="5" rx="9" ry="3"/></svg>`;

const SVG_SOFTWARE = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-layout-grid-icon lucide-layout-grid"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>`;

const MAIN_ENTRIES = [
    { id: 'appearance',   label: '外观',       desc: '手机壳 · 电池 · 状态栏',       glyph: SVG_APPEARANCE,    tint: PINK, pageId: 'appearance' },
    { id: 'world',        label: '世界观',     desc: '世界 · 标签 · 地点',          glyph: SVG_WORLD,         tint: BLUE, pageId: 'world' },
    { id: 'ai',           label: 'AI',         desc: 'AI 实例与人设',              glyph: SVG_AI,            tint: PINK, pageId: 'ai' },
    { id: 'gallery',      label: '图库',       desc: '收藏 · 灵感 · 参考',         glyph: SVG_GALLERY,       tint: BLUE, pageId: 'gallery' },
    { id: 'prompt',       label: 'Prompt',     desc: '提示词模板与变量',           glyph: SVG_PROMPT,        tint: PINK, pageId: 'prompt' },
    { id: 'api',          label: 'API',        desc: '当前提供方 · Key · 模型',    glyph: SVG_API,           tint: BLUE, pageId: 'api' },
    { id: 'importExport', label: '导入与导出', desc: '角色卡 · AI · 世界观 · Prompt', glyph: SVG_IMPORT_EXPORT, tint: PINK, pageId: 'importExport' },
    { id: 'database',     label: '数据库管理', desc: '数据表浏览 · 数据库检查',   glyph: SVG_DATABASE,      tint: BLUE, pageId: 'database' },
    { id: 'software',     label: '软件管理',   desc: '插件安装 · JS 文件注册',    glyph: SVG_SOFTWARE,      tint: PINK, pageId: 'software' },
];

function pickInitial(text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return '听';
    return Array.from(trimmed)[0] || '听';
}

function buildSubtitle(user) {
    if (!user) return '点击新建用户实例';
    const pronouns = (user.pronouns || '').trim();
    const summary = user.summary || '';
    if (pronouns && summary) return `${pronouns} · ${summary}`;
    if (pronouns) return pronouns;
    if (summary) return summary;
    return '点击编辑个人资料';
}

export function renderMainSection(app) {
    const sdk = window.settingsSdk;
    const user = sdk ? sdk.users.getActive() : null;
    const displayName = (user?.name || '我').trim() || '我';
    const initial = pickInitial(displayName);
    const subtitle = buildSubtitle(user);

    // 顶部 profile 卡：点击进入「用户」详情
    const profile = renderProfileCard({
        initial,
        avatar: user?.avatar || '',
        background: user?.profileBackground || '',
        backgroundBlur: user?.profileBackgroundBlur || 0,
        name: displayName,
        subtitle,
        hint: 'Apple ID · iCloud · 媒体与购买项目',
        action: { action: 'detail', pageId: 'user' },
    });

    const entryCards = MAIN_ENTRIES
        .map(entry => renderRow({
            label: entry.label,
            description: entry.desc,
            icon: entry.glyph,
            iconBg: entry.tint,
            iconFg: '#fff',
            action: entry.id === 'world'
                ? { action: 'appMethod', method: 'worldOpenLibrary' }
                : { action: 'detail', pageId: entry.pageId },
            showChevron: true,
            compact: true,
        }));

    return `
        <div class="settings-main">
            ${profile}
            <div class="settings-entries-grid">
                ${entryCards.map(card => `
                    <div class="settings-entry-card">
                        ${card}
                    </div>
                `).join('')}
            </div>
            ${renderFooterNote('设置 · 小听启动 v0.1 · 数据保存在本机 IndexedDB')}
        </div>
    `;
}