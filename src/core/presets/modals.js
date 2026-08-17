/**
 * 预设库 · 弹窗（命令式，不依赖 Vue）
 *
 * ── 为什么不直接用 AcModal ────────────────────────────────────────
 * `src/core/components/ac-modal.js` 是个 **Vue 组件**，只有 renderMode: 'vue'
 * 的 App 用得上。而项目里大多数 App 是 template 模式（renderPage 返回字符串），
 * 用户上传的插件更是连构建都没有 —— 它们没法声明式地渲染一个 Vue 组件。
 *
 * 结果就是每个 template 模式的 App 都自己拿字符串拼了一套弹窗，
 * 各拼各的、各有各的 bug（点遮罩不关、返回键不拦、输入法顶起来挡住按钮）。
 *
 * 这里提供一套**命令式**的：`await LP.modals.confirm({...})` 直接拿结果。
 * 视觉沿用 `.ac-*` 那套 class，所以已经给 AcModal 换过皮的 App 不用改任何 CSS。
 *
 * ── 移动端的三个硬约束（都在这层兜住）──────────────────────────────
 *   1. 挂到**当前 app-shell**而不是 document.body —— 挂 body 上会跑到手机壳外面
 *   2. 三段式 flex，body 单独滚动 —— 内容再长按钮也不会被挤出屏幕
 *   3. 底部弹层给 `env(safe-area-inset-bottom)` 留白，并在输入框聚焦时上移
 */

import { esc, cx, len } from './tokens.js';

const OPEN_STACK = [];

/** 找当前该挂弹窗的容器：优先活跃的 app-shell，其次手机壳，最后兜底 body */
function hostEl() {
    if (typeof document === 'undefined') return null;
    return document.querySelector('.app-shell')
        || document.getElementById('phone')
        || document.body;
}

function removeOverlay(overlay) {
    if (!overlay || !overlay.parentNode) return;
    overlay.classList.add('ac-overlay--closing');
    setTimeout(() => { overlay.parentNode?.removeChild(overlay); }, 240);
    const idx = OPEN_STACK.indexOf(overlay);
    if (idx >= 0) OPEN_STACK.splice(idx, 1);
}

/**
 * 所有弹窗的底座。
 *
 * @param {object} opts
 * @param {string} opts.bodyHtml       主体 HTML（调用方负责其中动态值已 escape）
 * @param {string} [opts.title]
 * @param {string} [opts.subtitle]
 * @param {'center'|'sheet'|'full'} [opts.placement='center']
 * @param {{id:string,label:string,variant?:string}[]} [opts.actions]
 * @param {boolean} [opts.closeOnBackdrop=true]
 * @param {(ctx)=>any} [opts.onAction]  返回非 undefined 值即作为 resolve 结果并关闭
 * @returns {Promise<any>} 点了哪个按钮的 id；点遮罩 / 关闭按钮为 null
 */
export function open(opts = {}) {
    const host = hostEl();
    if (!host) return Promise.resolve(null);

    const {
        title = '', subtitle = '', bodyHtml = '', placement = 'center',
        actions = [], closeOnBackdrop = true, showClose = true,
        maxWidth = '320px', tone = 'cool', className = '',
    } = opts;

    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = cx('ac-overlay', 'lp-overlay', `lp-overlay--${placement}`, className);

        const actionsHtml = actions.length
            ? `<div class="ac-modal-footer lp-modal-footer">${actions.map((a) => `
                <button type="button" class="${cx('ac-btn', `ac-btn-${a.variant || 'secondary'}`)}" data-lp-action="${esc(a.id)}">${esc(a.label)}</button>
            `).join('')}</div>`
            : '';

        overlay.innerHTML = `
            <div class="${cx('ac-modal', 'lp-modal', `ac-tone-${tone}`, `lp-modal--${placement}`)}" role="dialog" aria-modal="true" style="max-width:${len(maxWidth, '320px')}">
                ${showClose ? '<button type="button" class="ac-close lp-modal-close" data-lp-dismiss aria-label="关闭">×</button>' : ''}
                ${(title || subtitle) ? `<div class="ac-modal-header lp-modal-header">
                    ${title ? `<div class="ac-modal-title">${esc(title)}</div>` : ''}
                    ${subtitle ? `<div class="ac-modal-subtitle">${esc(subtitle)}</div>` : ''}
                </div>` : ''}
                <div class="ac-modal-body lp-modal-body">${bodyHtml}</div>
                ${actionsHtml}
            </div>
        `;

        const modal = overlay.querySelector('.lp-modal');
        let settled = false;
        const finish = (value) => {
            if (settled) return;
            settled = true;
            document.removeEventListener('keydown', onKey, true);
            removeOverlay(overlay);
            resolve(value);
        };

        function onKey(e) {
            if (e.key === 'Escape' && OPEN_STACK[OPEN_STACK.length - 1] === overlay) {
                e.stopPropagation();
                finish(null);
            }
        }

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                if (closeOnBackdrop) finish(null);
                return;
            }
            const dismiss = e.target.closest?.('[data-lp-dismiss]');
            if (dismiss && overlay.contains(dismiss)) { finish(null); return; }

            const btn = e.target.closest?.('[data-lp-action]');
            if (!btn || !overlay.contains(btn)) return;
            const id = btn.getAttribute('data-lp-action');
            if (typeof opts.onAction === 'function') {
                const out = opts.onAction({ id, modal, overlay, close: finish });
                if (out !== undefined) finish(out);
                return;
            }
            finish(id);
        });

        document.addEventListener('keydown', onKey, true);
        host.appendChild(overlay);
        OPEN_STACK.push(overlay);

        if (typeof opts.onMount === 'function') {
            try { opts.onMount({ modal, overlay, close: finish }); } catch (_) { /* 挂载钩子出错不该连累弹窗 */ }
        }
    });
}

/** 只有一段文字 + 确定，用来「说一件事」 */
export function alert(opts = {}) {
    const { title = '提示', message = '', okLabel = '知道了' } = typeof opts === 'string' ? { message: opts } : opts;
    return open({
        title,
        bodyHtml: `<p class="lp-modal-text">${esc(message)}</p>`,
        actions: [{ id: 'ok', label: okLabel, variant: 'primary' }],
    }).then(() => true);
}

/** 确认 / 取消，resolve 成 boolean */
export function confirm(opts = {}) {
    const {
        title = '确认', message = '', okLabel = '确定', cancelLabel = '取消', danger = false,
    } = typeof opts === 'string' ? { message: opts } : opts;
    return open({
        title,
        bodyHtml: `<p class="lp-modal-text">${esc(message)}</p>`,
        actions: [
            { id: 'cancel', label: cancelLabel, variant: 'secondary' },
            { id: 'ok', label: okLabel, variant: danger ? 'danger' : 'primary' },
        ],
    }).then((id) => id === 'ok');
}

/** 单行输入，resolve 成字符串；取消为 null */
export function prompt(opts = {}) {
    const {
        title = '', message = '', placeholder = '', value = '',
        okLabel = '确定', cancelLabel = '取消', multiline = false, maxLength = 0,
    } = opts;
    const field = multiline
        ? `<textarea class="lp-field lp-field--area" rows="4" placeholder="${esc(placeholder)}"${maxLength ? ` maxlength="${Number(maxLength)}"` : ''}>${esc(value)}</textarea>`
        : `<input class="lp-field" type="text" placeholder="${esc(placeholder)}" value="${esc(value)}"${maxLength ? ` maxlength="${Number(maxLength)}"` : ''} />`;
    return open({
        title,
        bodyHtml: `${message ? `<p class="lp-modal-text">${esc(message)}</p>` : ''}${field}`,
        actions: [
            { id: 'cancel', label: cancelLabel, variant: 'secondary' },
            { id: 'ok', label: okLabel, variant: 'primary' },
        ],
        onMount({ modal }) {
            const el = modal.querySelector('.lp-field');
            // 手机端立刻 focus 会把键盘顶起来遮住按钮，等入场动画走完再聚焦
            setTimeout(() => el?.focus(), 260);
        },
        onAction({ id, modal }) {
            if (id !== 'ok') return null;
            return modal.querySelector('.lp-field')?.value ?? '';
        },
    });
}

/** 从底部升起的动作面板，resolve 成选中项的 value；取消为 null */
export function actionSheet(opts = {}) {
    const { title = '', subtitle = '', items = [], cancelLabel = '取消' } = opts;
    const list = items.map((item) => {
        const it = typeof item === 'string' ? { value: item, label: item } : (item || {});
        return `<button type="button" class="${cx('lp-sheet__item', it.danger ? 'is-danger' : '', it.disabled ? 'is-disabled' : '')}"${it.disabled ? ' disabled' : ''} data-lp-action="${esc(it.value ?? it.label)}">
            ${it.icon ? `<span class="lp-sheet__icon">${it.icon}</span>` : ''}
            <span class="lp-sheet__label">${esc(it.label)}</span>
            ${it.desc ? `<span class="lp-sheet__desc">${esc(it.desc)}</span>` : ''}
        </button>`;
    }).join('');
    return open({
        title, subtitle, placement: 'sheet', showClose: false,
        bodyHtml: `<div class="lp-sheet">${list}</div>`,
        actions: cancelLabel ? [{ id: '__cancel', label: cancelLabel, variant: 'secondary' }] : [],
    }).then((id) => (id === '__cancel' || id == null ? null : id));
}

/** 单选列表，resolve 成选中的 value */
export function picker(opts = {}) {
    const { title = '请选择', items = [], value = '', okLabel = '确定', cancelLabel = '取消' } = opts;
    const list = items.map((item) => {
        const it = typeof item === 'string' ? { value: item, label: item } : (item || {});
        const on = String(it.value) === String(value);
        return `<label class="${cx('lp-picker__item', on ? 'is-active' : '')}">
            <input type="radio" name="lp-picker" value="${esc(it.value)}"${on ? ' checked' : ''} />
            <span class="lp-picker__label">${esc(it.label)}</span>
            ${it.desc ? `<span class="lp-picker__desc">${esc(it.desc)}</span>` : ''}
            <span class="lp-picker__tick" aria-hidden="true">✓</span>
        </label>`;
    }).join('');
    return open({
        title,
        bodyHtml: `<div class="lp-picker">${list}</div>`,
        actions: [
            { id: 'cancel', label: cancelLabel, variant: 'secondary' },
            { id: 'ok', label: okLabel, variant: 'primary' },
        ],
        onAction({ id, modal }) {
            if (id !== 'ok') return null;
            return modal.querySelector('input[name="lp-picker"]:checked')?.value ?? null;
        },
    });
}

/**
 * 简易表单，resolve 成 `{字段名: 值}`；取消为 null。
 * fields: [{ name, label, type: 'text'|'textarea'|'number'|'select'|'switch', options?, value?, placeholder? }]
 */
export function form(opts = {}) {
    const { title = '', fields = [], okLabel = '保存', cancelLabel = '取消' } = opts;
    const body = fields.map((f) => {
        const name = esc(f?.name || '');
        const label = f?.label ? `<span class="lp-formrow__label">${esc(f.label)}</span>` : '';
        let control = '';
        if (f?.type === 'textarea') {
            control = `<textarea class="lp-field lp-field--area" rows="${Number(f.rows) || 3}" data-lp-field="${name}" placeholder="${esc(f.placeholder)}">${esc(f.value)}</textarea>`;
        } else if (f?.type === 'select') {
            const opt = (f.options || []).map((o) => {
                const oo = typeof o === 'string' ? { value: o, label: o } : (o || {});
                return `<option value="${esc(oo.value)}"${String(oo.value) === String(f.value) ? ' selected' : ''}>${esc(oo.label)}</option>`;
            }).join('');
            control = `<select class="lp-field" data-lp-field="${name}">${opt}</select>`;
        } else if (f?.type === 'switch') {
            control = `<label class="lp-switch"><input type="checkbox" data-lp-field="${name}"${f.value ? ' checked' : ''} /><span class="lp-switch__track"><span class="lp-switch__thumb"></span></span></label>`;
        } else {
            control = `<input class="lp-field" type="${esc(f?.type || 'text')}" data-lp-field="${name}" value="${esc(f?.value)}" placeholder="${esc(f?.placeholder)}" />`;
        }
        return `<div class="${cx('lp-formrow', f?.type === 'switch' ? 'is-inline' : '')}">${label}${control}${f?.hint ? `<span class="lp-formrow__hint">${esc(f.hint)}</span>` : ''}</div>`;
    }).join('');

    return open({
        title,
        bodyHtml: `<div class="lp-form">${body}</div>`,
        actions: [
            { id: 'cancel', label: cancelLabel, variant: 'secondary' },
            { id: 'ok', label: okLabel, variant: 'primary' },
        ],
        onAction({ id, modal }) {
            if (id !== 'ok') return null;
            const out = {};
            modal.querySelectorAll('[data-lp-field]').forEach((el) => {
                const key = el.getAttribute('data-lp-field');
                out[key] = el.type === 'checkbox' ? el.checked : el.value;
            });
            return out;
        },
    });
}

/** 任意内容的底部抽屉。返回 close 函数，适合放长表单 / 详情。 */
export function sheet(opts = {}) {
    return open({ placement: 'sheet', ...opts });
}

/** 轻提示。不阻塞、不返回值，几秒后自己消失。 */
export function toast(message, opts = {}) {
    const host = hostEl();
    if (!host) return () => {};
    const { type = 'info', duration = 2200 } = typeof opts === 'number' ? { duration: opts } : opts;
    const el = document.createElement('div');
    el.className = cx('lp-toast', `lp-toast--${type}`);
    el.textContent = String(message ?? '');
    host.appendChild(el);
    const timer = setTimeout(() => {
        el.classList.add('is-out');
        setTimeout(() => el.parentNode?.removeChild(el), 240);
    }, Math.max(600, Number(duration) || 2200));
    return () => { clearTimeout(timer); el.parentNode?.removeChild(el); };
}

/** 关掉当前所有预设弹窗。切页 / 退出 App 时调一下，避免弹窗留在下一个页面上。 */
export function closeAll() {
    [...OPEN_STACK].forEach(removeOverlay);
    OPEN_STACK.length = 0;
}

export const modals = { open, alert, confirm, prompt, actionSheet, picker, form, sheet, toast, closeAll };

/** 问卷 / 文档用的弹窗清单 */
export const MODAL_CATALOG = [
    { id: 'alert', name: '提示框', desc: '一段文字 + 知道了', use: '告诉用户一件事', returns: 'true' },
    { id: 'confirm', name: '确认框', desc: '确定 / 取消', use: '删除、覆盖这类不可逆操作', returns: 'boolean' },
    { id: 'prompt', name: '输入框', desc: '单行或多行文本输入', use: '重命名、写备注', returns: 'string | null' },
    { id: 'actionSheet', name: '底部动作面板', desc: '从底部升起的一列操作', use: '长按菜单、更多操作', returns: 'value | null' },
    { id: 'picker', name: '单选列表', desc: '一组选项挑一个', use: '切换分类、选模板', returns: 'value | null' },
    { id: 'form', name: '表单弹窗', desc: '多个字段一起填', use: '新建条目、编辑资料', returns: 'object | null' },
    { id: 'sheet', name: '自定义抽屉', desc: '底部升起，内容自定义', use: '长表单、详情预览', returns: 'any' },
    { id: 'toast', name: '轻提示', desc: '几秒后自己消失', use: '保存成功这类无需确认的反馈', returns: '() => void' },
];

export default modals;
