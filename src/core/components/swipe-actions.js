/**
 * 左滑露出操作按钮（框架级通用组件）
 * ====================================================================
 * iOS 列表那种「手指往左推，右边露出一排按钮」。
 *
 * 为什么放在框架层：
 *   murmur 的收藏列表、消息列表、通讯录，音乐的歌单，任何「一行一条记录」
 *   的列表迟早都要这个交互。写在某个 App 里，第二个 App 只能复制粘贴，
 *   而手感参数（阈值、回弹曲线）一复制就会分叉。
 *
 * 用法（HTML 结构由调用方产出，本模块只管手势）：
 *
 *   <div class="xx-list" >                        ← root，把它交给 attachSwipeActions
 *     <div class="swipe-row">                     ← itemSelector
 *       <div class="swipe-row__actions">…按钮…</div>   ← actionsSelector（垫在下面）
 *       <div class="swipe-row__content">…正文…</div>   ← contentSelector（会被 translateX）
 *     </div>
 *   </div>
 *
 *   attachSwipeActions(rootEl);   // 其余参数都有默认值
 *
 * 配套的基线样式在 css/core/86-swipe-actions.css，各 App 只需要覆盖颜色和宽度。
 *
 * ── 手感数值（改之前先想清楚）─────────────────────────────
 *   方向判定    水平位移 > 8px 且 > 垂直位移 → 认定为横滑，此后 preventDefault
 *   打开阈值    拖过「按钮区宽度的 40%」或者甩速 > 0.5px/ms
 *   回弹        transform .22s cubic-bezier(0.22, 1, 0.36, 1)
 *   越界阻尼    超出按钮区宽度后按 0.3 衰减，给一点橡皮筋
 *
 * ── 两个必须注意的点 ──────────────────────────────────
 *   1. 不能用 `touch-action: pan-y`。那是「把纵向手势让给浏览器」，
 *      一旦浏览器接管，后续 preventDefault 就失效，手感时灵时不灵
 *      （AGENTS2 §13.5.2 踩过）。这里的做法是：默认不拦，方向判定
 *      确认是横滑之后才 preventDefault。
 *   2. 滑动之后紧跟着的那次 click 要吞掉，否则「滑开」会顺带触发
 *      正文的点击（展开卡片之类）。而且只在**确实滑动过**时才吞 ——
 *      无条件置标记会把普通点击也吃掉（AGENTS2 §13.5.3 踩过）。
 */

const DEFAULTS = {
    itemSelector: '.swipe-row',
    contentSelector: '.swipe-row__content',
    actionsSelector: '.swipe-row__actions',
    openClass: 'is-swipe-open',
};

const AXIS_LOCK_PX = 8;
const OPEN_RATIO = 0.4;
const FLING_SPEED = 0.5;      // px/ms
const OVERSHOOT_DAMP = 0.3;
const SNAP_TRANSITION = 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)';

/** 记录已经装过的 root，避免重复绑定（v-html 重画后 root 是新节点，天然不会撞） */
const BOUND = new WeakSet();

function setX(el, x, animated) {
    if (!el) return;
    el.style.transition = animated ? SNAP_TRANSITION : 'none';
    el.style.transform = x ? `translate3d(${x}px, 0, 0)` : 'translate3d(0, 0, 0)';
}

/**
 * @param {HTMLElement} rootEl  列表容器（事件委托挂在它身上）
 * @param {object} [opts]
 * @returns {() => void} 解绑函数
 */
export function attachSwipeActions(rootEl, opts = {}) {
    if (!rootEl || BOUND.has(rootEl)) return () => {};
    BOUND.add(rootEl);

    const cfg = { ...DEFAULTS, ...opts };

    let row = null;         // 当前正在拖的行
    let content = null;
    let maxOpen = 0;        // 这一行按钮区的宽度
    let startX = 0;
    let startY = 0;
    let startTs = 0;
    let baseX = 0;          // 按下那一刻的位移（已经打开的行再拖要接着走）
    let axis = '';          // '' | 'x' | 'y'
    let swiped = false;     // 这次手势到底有没有真的横滑过
    let openRow = null;     // 当前打开着的那一行

    const closeOpen = (animated = true) => {
        if (!openRow) return;
        const c = openRow.querySelector(cfg.contentSelector);
        setX(c, 0, animated);
        openRow.classList.remove(cfg.openClass);
        openRow = null;
    };

    const onPointerDown = (e) => {
        // 点在按钮上时不启动拖拽 —— 否则「按下按钮想点」会被当成滑动的起点
        if (e.target?.closest?.(cfg.actionsSelector)) return;
        const target = e.target?.closest?.(cfg.itemSelector);
        if (!target || !rootEl.contains(target)) return;

        // 已经有别的行开着 → 这一下是「先把它关掉」，不启动新的拖拽
        if (openRow && openRow !== target) {
            closeOpen();
            swiped = true;   // 吞掉随后的 click，否则会顺手点开某张卡
            return;
        }

        row = target;
        content = row.querySelector(cfg.contentSelector);
        const actions = row.querySelector(cfg.actionsSelector);
        maxOpen = actions ? actions.offsetWidth : 0;
        if (!content || maxOpen <= 0) { row = null; return; }

        startX = e.clientX;
        startY = e.clientY;
        startTs = e.timeStamp || Date.now();
        baseX = row === openRow ? -maxOpen : 0;
        axis = '';
        swiped = false;
    };

    const onPointerMove = (e) => {
        if (!row || !content) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (!axis) {
            if (Math.abs(dx) > AXIS_LOCK_PX && Math.abs(dx) > Math.abs(dy)) {
                axis = 'x';
            } else if (Math.abs(dy) > AXIS_LOCK_PX) {
                // 认定为纵向滚动：这次手势彻底交给浏览器，别再插手
                axis = 'y';
                row = null;
                content = null;
                return;
            } else {
                return;
            }
        }
        if (axis !== 'x') return;

        // 方向锁定之后才拦截，避免把纵向滚动一起吃掉
        if (e.cancelable) e.preventDefault();
        swiped = true;

        let x = baseX + dx;
        if (x > 0) x = x * OVERSHOOT_DAMP;                       // 往右拖（关闭方向）留点橡皮筋
        if (x < -maxOpen) x = -maxOpen + (x + maxOpen) * OVERSHOOT_DAMP;
        setX(content, x, false);
    };

    const finish = (e) => {
        if (!row || !content) { row = null; content = null; return; }
        if (axis !== 'x') { row = null; content = null; return; }

        const dx = (e?.clientX ?? startX) - startX;
        const dt = Math.max(1, (e?.timeStamp || Date.now()) - startTs);
        const speed = Math.abs(dx) / dt;
        const x = baseX + dx;

        // 甩一下也算 —— 只按位移判定的话，快速轻扫会被当成没滑动
        const shouldOpen = speed > FLING_SPEED
            ? dx < 0
            : x < -maxOpen * OPEN_RATIO;

        if (shouldOpen) {
            setX(content, -maxOpen, true);
            row.classList.add(cfg.openClass);
            if (openRow && openRow !== row) closeOpen();
            openRow = row;
        } else {
            setX(content, 0, true);
            row.classList.remove(cfg.openClass);
            if (openRow === row) openRow = null;
        }
        row = null;
        content = null;
    };

    // 滑动之后紧跟的那次 click 要吞掉，但**只有真的滑动过才吞**
    const onClickCapture = (e) => {
        if (!swiped) return;
        swiped = false;
        e.stopPropagation();
        e.preventDefault();
    };

    // 点到列表以外（或点到别的行的正文）就把打开的那行收回去
    const onDocPointerDown = (e) => {
        if (!openRow) return;
        if (e.target?.closest?.(cfg.actionsSelector)) return;
        if (openRow.contains(e.target)) return;
        closeOpen();
    };

    rootEl.addEventListener('pointerdown', onPointerDown, { passive: true });
    rootEl.addEventListener('pointermove', onPointerMove, { passive: false });
    rootEl.addEventListener('pointerup', finish, { passive: true });
    rootEl.addEventListener('pointercancel', finish, { passive: true });
    rootEl.addEventListener('click', onClickCapture, true);
    document.addEventListener('pointerdown', onDocPointerDown, true);

    return () => {
        rootEl.removeEventListener('pointerdown', onPointerDown);
        rootEl.removeEventListener('pointermove', onPointerMove);
        rootEl.removeEventListener('pointerup', finish);
        rootEl.removeEventListener('pointercancel', finish);
        rootEl.removeEventListener('click', onClickCapture, true);
        document.removeEventListener('pointerdown', onDocPointerDown, true);
        BOUND.delete(rootEl);
    };
}

/**
 * 生成一行的外壳 HTML。
 * 调用方只负责给「按钮组」和「正文」两段 HTML，结构和 class 由这里统一，
 * 免得每个 App 自己拼一套、CSS 再各写一份。
 *
 * @param {object} p
 * @param {string} p.actionsHtml  右侧按钮区的 HTML
 * @param {string} p.contentHtml  正文 HTML
 * @param {string} [p.extraClass] 追加到行容器上的 class
 * @param {string} [p.dataAttrs]  追加到行容器上的属性串（调用方自己 escape）
 */
export function renderSwipeRow({ actionsHtml = '', contentHtml = '', extraClass = '', dataAttrs = '' } = {}) {
    return `
        <div class="swipe-row ${extraClass}" ${dataAttrs}>
            <div class="swipe-row__actions">${actionsHtml}</div>
            <div class="swipe-row__content">${contentHtml}</div>
        </div>
    `;
}

export default attachSwipeActions;
