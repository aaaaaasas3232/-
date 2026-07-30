/**
 * Settings App · 人设主页（Persona Home）
 *
 * 入口：路由到 `pageId === 'personaHome'` 的详情页时被 main.js renderDetailPage 调用。
 * 上下文：app.state.personaHome = { entityType: 'user' | 'ai', entityId: <id> }
 *
 *   主页内分 6 个 widget：
 *     1. 顶部概览（avatar + 名字 + role + 世界观入口）
 *     2. 心情面板（今日心情 + 重 roll + 权重入口）
 *     3. 周历（7 天，点击切到「这一篇日记」）
 *     4. 今日日记（手动 / 生成，可编辑 / 删除 / 重 roll / 提交追加）
 *     5. 社媒（今日动态占位）
 *     6. 人生阶段（当前激活阶段指示）
 *
 *   API 注入点（待真实接入）：
 *     - toolkit.persona.diary.generate({ entityType, entityId, mood, persona, world })
 *       当前指向本地 composeSegment（diary-generator.js）。
 */

export { renderPersonaHome } from './home-section.js';
export { buildPersonaHomeMethods } from './home-methods.js';
