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
import { T, ENTRY_GLYPH_TINT } from '../tokens.js';

const MAIN_ENTRIES = [
    { id: 'appearance', label: '外观',     desc: '手机壳 · 电池 · 状态栏',       glyph: '◐', tint: ENTRY_GLYPH_TINT.appearance, pageId: 'appearance' },
    { id: 'world',      label: '世界观',   desc: '世界 · 标签 · 地点',    glyph: '◯', tint: ENTRY_GLYPH_TINT.world,      pageId: 'world' },
    { id: 'ai',         label: 'AI',       desc: 'AI 实例与人设',                glyph: '◉', tint: ENTRY_GLYPH_TINT.ai,         pageId: 'ai' },
    { id: 'gallery',    label: '图库',     desc: '收藏 · 灵感 · 参考',           glyph: '▣', tint: T.color.purple,               pageId: 'gallery' },
    { id: 'prompt',     label: 'Prompt',   desc: '提示词模板与变量',             glyph: '✎', tint: T.color.indigo,               pageId: 'prompt' },
    { id: 'api',        label: 'API',      desc: '当前提供方 · Key · 模型',      glyph: '◇', tint: ENTRY_GLYPH_TINT.api,        pageId: 'api' },
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