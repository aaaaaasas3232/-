/**
 * music-app · components/detail-topbar.js
 *
 * 音乐 App 所有二级页共用的顶栏。
 *
 * 为什么要自绘：framework 会在 detail 页上方画一条 `.app-detail-header`
 * （白底 + 毛玻璃 + 「‹ 返回」+ 标题）。播放器页自己也画了一条顶栏，
 * 于是同一屏出现两个返回按钮、两个标题，而且那条白底跟音乐 App 的粉色
 * 渐变背景对不上，看着像贴了块补丁。现在统一：CSS 把 framework 那条藏掉，
 * 每个二级页顶部放这一条透明的，风格和播放器页一致。
 */

import { escapeHtml } from '@/src/core/escape.js';
import { createActionAttr } from '@/src/core/actions.js';

const BACK_ICON = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M19 11H7.83l4.88-4.88c.39-.39.39-1.03 0-1.42-.39-.39-1.02-.39-1.41 0l-6.59 6.59c-.39.39-.39 1.02 0 1.41l6.59 6.59c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L7.83 13H19c.55 0 1-.45 1-1s-.45-1-1-1z" fill="currentColor"/></svg>';

/**
 * @param {Object} opts
 * @param {string} opts.appId
 * @param {string} opts.title 中间的小标题（页面自己有 hero 时可以留空）
 * @param {Array<{iconHtml:string, method:string, payload?:Object, label?:string}>} [opts.actions] 右侧按钮
 */
export function renderDetailTopbar(opts = {}) {
    const { appId = 'music', title = '', actions = [] } = opts;
    const backAction = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'closePlayerPage',
    }, appId);

    const actionsHtml = actions.map((a) => {
        const attr = createActionAttr({
            action: 'appMethod',
            appId,
            method: a.method,
            payload: a.payload || {},
        }, appId);
        return `<button class="music-detail-topbar-btn" ${attr} aria-label="${escapeHtml(a.label || '')}">${a.iconHtml}</button>`;
    }).join('');

    return `
        <div class="music-detail-topbar">
            <button class="music-detail-topbar-back" ${backAction} aria-label="返回">${BACK_ICON}</button>
            <div class="music-detail-topbar-title">${escapeHtml(title)}</div>
            <div class="music-detail-topbar-actions">${actionsHtml}</div>
        </div>
    `;
}
