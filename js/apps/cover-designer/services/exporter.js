/**
 * cover-designer / services / exporter.js
 *
 * 步骤 8:导出 PNG(走 modern-screenshot)
 *
 * 设计要点:
 *   - 用 modern-screenshot 替代 html2canvas(更小,更快,支持现代 CSS)
 *   - 截图前给 .cd-card 加 is-exporting 类(隐藏浮动工具条 / 选中 outline)
 *   - 截图分辨率 2x(scale: 2)
 *   - 截图完成后通过 a[download] 触发浏览器下载
 *   - 文件名格式:小红书封面-YYYY-MM-DD.png
 *   - 截图失败/取消时不抛出,只 console.warn + 通过 toolkit.island.notify 提示
 */

import { domToBlob, domToPng } from 'modern-screenshot';

// 画布上的背景图多半是外链,modern-screenshot 会逐张 fetch 内联。
// 遇到跨域/慢图它会一直等到自己的 30s 超时,期间 UI 像卡死一样,所以外面再包一层硬超时。
function withTimeout(promise, ms, label) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}超时(${ms}ms)`)), ms)),
    ]);
}

// 等一次重绘,让 is-exporting 的样式落地。
// 不能只靠 requestAnimationFrame:页面在后台标签或无头浏览器里它不会触发,整个导出就卡死了。
function waitForPaint(ms = 50) {
    return new Promise((resolve) => {
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };
        setTimeout(finish, ms);
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => setTimeout(finish, 0));
        }
    });
}

/**
 * 触发浏览器下载
 * @param {Blob} blob
 * @param {string} filename
 */
function _triggerDownload(blob, filename) {
    try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => {
            try { URL.revokeObjectURL(url); } catch (_) {}
        }, 1000);
    } catch (err) {
        console.warn('[cover-designer/exporter] download trigger failed', err);
    }
}

/**
 * 生成文件名:小红书封面-2026-08-09.png
 */
function _genFilename() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `小红书封面-${yyyy}-${mm}-${dd}.png`;
}

/**
 * 导出画布为 PNG
 *
 * @param {Object} opts
 * @param {HTMLElement} opts.cardEl - .cd-card 元素(必传)
 * @param {Object} [opts.toolkit] - framework toolkit(可选,失败时用来 notify)
 * @returns {Promise<{ ok: boolean, filename?: string, error?: string }>}
 */
export async function exportCardToPng(opts = {}) {
    const cardEl = opts.cardEl;
    const toolkit = opts.toolkit || null;
    if (!cardEl) {
        const msg = '找不到画布元素(.cd-card)';
        console.warn('[cover-designer/exporter]', msg);
        toolkit?.island?.notify?.('error', '导出失败', msg);
        return { ok: false, error: msg };
    }

    // 加 is-exporting 类(隐藏浮动工具条 / 选中 outline)
    cardEl.classList.add('is-exporting');

    try {
        await waitForPaint(50);

        const blob = await withTimeout(domToBlob(cardEl, {
            scale: 2,
            backgroundColor: '#ffffff',
            // 跳过 web fonts(避免跨域字体阻塞)
            skipFonts: true,
            timeout: 12000,
        }), 15000, '导出');

        if (!blob) {
            throw new Error('modernScreenshot 返回空');
        }

        const filename = _genFilename();
        _triggerDownload(blob, filename);
        return { ok: true, filename };
    } catch (err) {
        console.warn('[cover-designer/exporter] export failed', err);
        const msg = err?.message || '未知错误';
        toolkit?.island?.notify?.('error', '导出失败', msg);
        return { ok: false, error: msg };
    } finally {
        // 不管成功失败,移除 is-exporting 类
        try {
            cardEl.classList.remove('is-exporting');
        } catch (_) {}
    }
}

/**
 * 把画布渲染成 dataURL,不触发下载。
 * 用于历史存档的缩略图:scale 调小,体积控制在几十 KB。
 *
 * @param {HTMLElement} cardEl
 * @param {number} [scale=0.4]
 * @returns {Promise<string|null>}
 */
export async function renderCardToDataUrl(cardEl, scale = 0.4) {
    if (!cardEl) return null;
    cardEl.classList.add('is-exporting');
    try {
        await waitForPaint(30);
        // 缩略图只是锦上添花,超时就放弃,绝不能拖住存档
        return await withTimeout(domToPng(cardEl, {
            scale,
            backgroundColor: '#ffffff',
            skipFonts: true,
            timeout: 3000,
        }), 4000, '缩略图');
    } catch (err) {
        console.warn('[cover-designer/exporter] thumbnail failed', err);
        return null;
    } finally {
        try { cardEl.classList.remove('is-exporting'); } catch (_) {}
    }
}

/**
 * 检查 modern-screenshot 是否可用
 */
export function isExporterReady() {
    try {
        return typeof domToBlob === 'function';
    } catch (_) {
        return false;
    }
}