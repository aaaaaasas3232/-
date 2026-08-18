/**
 * murmur · 回复提示词页的折叠状态
 *
 * 「关闭 / 启用」写在 <summary> 里。浏览器规定点 summary 里任何东西都会
 * 把 <details> 拉开 / 收起，切开关时折叠组跟着弹开，用起来很烦。
 *
 * 两件事：
 *   1. 点开关 / 按钮时 preventDefault，details 保持原样。
 *   2. 切开关会整页重画，模板里组默认带 open。点下去之前先把开合记下，
 *      重画后再写回去，折叠的还是折叠。
 */

const groupOpen = Object.create(null);
const itemOpen = Object.create(null);

let hooked = false;
let suppressToggleWrite = 0;

const CONTROL_SELECTOR = [
    '.pm-segmented-tabs',
    '.pm-app-group__switch',
    '.pm-item-right',
    '.pm-row-actions',
    '.pm-chip',
    'button',
    'a',
    'input',
    'textarea',
    'select',
    'label',
].join(',');

function findPromptManager(from) {
    if (!from) return document.querySelector?.('.prompt-manager') || null;
    if (typeof from.closest === 'function') {
        const via = from.closest('.prompt-manager');
        if (via) return via;
    }
    if (from.classList?.contains('prompt-manager')) return from;
    return from.querySelector?.('.prompt-manager') || null;
}

export function snapshotPromptFolds(root) {
    const pm = findPromptManager(root);
    if (!pm) return;
    pm.querySelectorAll('.pm-app-group[data-source]').forEach((el) => {
        const source = el.getAttribute('data-source');
        if (source) groupOpen[source] = !!el.open;
    });
    pm.querySelectorAll('details.pm-item[data-prompt-id]').forEach((el) => {
        const id = el.getAttribute('data-prompt-id');
        if (id) itemOpen[id] = !!el.open;
    });
}

/** 折叠组缺省展开（跟原来模板上写死 open 一样）。 */
export function isGroupOpen(source) {
    const key = String(source || '');
    if (!key) return true;
    return Object.prototype.hasOwnProperty.call(groupOpen, key) ? groupOpen[key] : true;
}

/** 单张卡缺省收起。 */
export function isItemOpen(promptId) {
    const key = String(promptId || '');
    if (!key) return false;
    return Object.prototype.hasOwnProperty.call(itemOpen, key) ? itemOpen[key] : false;
}

export function applyPromptFolds(root) {
    const pm = findPromptManager(root);
    if (!pm) return;
    pm.querySelectorAll('.pm-app-group[data-source]').forEach((el) => {
        const want = isGroupOpen(el.getAttribute('data-source'));
        if (el.open !== want) el.open = want;
    });
    pm.querySelectorAll('details.pm-item[data-prompt-id]').forEach((el) => {
        const want = isItemOpen(el.getAttribute('data-prompt-id'));
        if (el.open !== want) el.open = want;
    });
}

function rememberDetails(el) {
    if (!(el instanceof HTMLElement)) return;
    if (!el.closest?.('.prompt-manager')) return;
    if (el.classList.contains('pm-app-group')) {
        const source = el.getAttribute('data-source');
        if (source) groupOpen[source] = !!el.open;
    } else if (el.classList.contains('pm-item')) {
        const id = el.getAttribute('data-prompt-id');
        if (id) itemOpen[id] = !!el.open;
    }
}

function freezeAncestorDetails(start) {
    const frozen = [];
    let el = start;
    while (el && !el.classList?.contains('prompt-manager')) {
        if (el.tagName === 'DETAILS') frozen.push([el, el.open]);
        el = el.parentElement;
    }
    if (frozen.length === 0) return;
    const apply = () => {
        for (const [node, open] of frozen) {
            if (node.isConnected && node.open !== open) node.open = open;
        }
    };
    queueMicrotask(apply);
    try { requestAnimationFrame(apply); } catch (_) { /* ignore */ }
}

function onPromptManagerClick(event) {
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    const pm = target.closest('.prompt-manager');
    if (!pm) return;
    snapshotPromptFolds(pm);
    const control = target.closest(CONTROL_SELECTOR);
    if (!control) return;
    const summary = control.closest('summary');
    if (!summary || !pm.contains(summary)) return;
    if (typeof event.preventDefault === 'function') event.preventDefault();
    suppressToggleWrite += 1;
    freezeAncestorDetails(control);
    queueMicrotask(() => {
        suppressToggleWrite = Math.max(0, suppressToggleWrite - 1);
    });
}

function onPromptManagerToggle(event) {
    if (suppressToggleWrite) return;
    rememberDetails(event?.target);
}

export function installPromptFoldGuards() {
    if (hooked) return;
    if (typeof document === 'undefined') return;
    hooked = true;
    document.addEventListener('click', onPromptManagerClick, true);
    document.addEventListener('toggle', onPromptManagerToggle, true);
}

if (typeof window !== 'undefined') installPromptFoldGuards();
