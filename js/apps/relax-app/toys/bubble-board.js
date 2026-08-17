/**
 * relax-app / 内置解压主体:「气泡板」(可调行/列)
 *
 * ------------------------------------------------------------
 * 设计要点
 * ------------------------------------------------------------
 * 1. 用户可以调行数和列数(默认 4x4,范围 2~12)。
 *    行列变化后整块板重建,持久化哪些格被按过。
 * 2. 按下 → 鼓起一下 + 出声 + 震动 → 落成凹陷发皱的死泡泡。
 *    ★ 按爆之后就不能再按了:再点没声音、没动画(对齐 QAQ/解压7 原版)。
 *    全按完 → 灵动岛提示 + 可以「恢复主体」重来。
 * 3. 行/列参数持久化在 toyStates 里(按 toyId 分桶),切走再回来还在。
 * 4. fit: 'plate' 铺满盘子内圈。
 *    ★ 气泡底下**没有板子** —— .bubble-board 只是个透明布局容器,
 *      原来那层奶白圆角板已经按用户要求去掉了(样式见 _toys.css)。
 *
 * ★ 这是「内置预设」,不允许被用户删除(只能改、复制、保存副本)
 *   预设身份由 registry 的 `deletable !== false` 默认值承担 —— UI 看不到删除按钮。
 *
 * ★ 主体内部**不要**碰 localStorage、不要插全局 <style>、不要读 store。
 *    颜色只认 host.tint,持久化只走 host.setState,样式写在 css/apps/relax/。
 */

import { registerRelaxToy } from '../registry.js';

const BUBBLE_ICON = `
<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="5" fill="currentColor"/>
    <circle cx="22" cy="10" r="5" fill="currentColor" opacity="0.85"/>
    <circle cx="10" cy="22" r="5" fill="currentColor" opacity="0.85"/>
    <circle cx="22" cy="22" r="5" fill="currentColor" opacity="0.7"/>
    <circle cx="8" cy="8" r="1.6" fill="#ffffff" opacity="0.7"/>
    <circle cx="20" cy="8" r="1.6" fill="#ffffff" opacity="0.7"/>
    <circle cx="8" cy="20" r="1.4" fill="#ffffff" opacity="0.6"/>
    <circle cx="20" cy="20" r="1.4" fill="#ffffff" opacity="0.55"/>
</svg>`;

/**
 * 把 rows/cols(可能为空/超界)兜住成安全值。
 * 配置区间 2~12:再小就看不出「板」的形状,再大就糊成一团。
 */
function clampGrid(value, fallback, min = 2, max = 12) {
    const num = Math.floor(Number(value));
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, num));
}

registerRelaxToy({
    id: 'bubble-board',
    name: '气泡板',
    summary: '点一下「啵」一声,默认 4×4',
    icon: BUBBLE_ICON,
    defaultTint: '#cdeafd',
    tintable: true,
    fit: 'plate',
    aspect: 1,
    defaultSoundId: 'pop-soft',
    resettable: true,
    // ★ 可调行/列。min/max 决定 UI 滑杆范围。
    configurable: { type: 'grid', rows: 4, cols: 4, min: 2, max: 12 },
    // ★ 内置预设,不允许删除。
    deletable: false,

    mount(host) {
        // ---------- 初始参数(读 state 兜底) ----------
        const saved = host.getState() || {};
        let rows = clampGrid(saved.rows, 4);
        let cols = clampGrid(saved.cols, 4);
        // popped 必须在这里就兜成数组:第一次玩的时候 state 是 {},
        // 下面 pop() 里直接 saved.popped.includes() 会炸。
        if (!Array.isArray(saved.popped)) saved.popped = [];

        // ---------- 建 DOM ----------
        // 两层:
        //   .bubble-board       = 纯布局容器(★ 不再画板子,样式见 _toys.css)
        //   .bubble-grid        = 气泡阵列
        const board = document.createElement('div');
        board.className = 'bubble-board';
        const grid = document.createElement('div');
        grid.className = 'bubble-grid';
        board.appendChild(grid);

        /** 当前所有 cell;每次重建后会重新填 */
        let cells = [];

        function build() {
            grid.style.setProperty('--bubble-rows', String(rows));
            grid.style.setProperty('--bubble-cols', String(cols));
            grid.innerHTML = '';
            cells = [];

            const popped = new Set(saved.popped);
            const total = rows * cols;
            for (let i = 0; i < total; i += 1) {
                const cell = document.createElement('button');
                cell.type = 'button';
                cell.className = 'bubble-cell';
                cell.dataset.index = String(i);
                const r = Math.floor(i / cols);
                const c = i % cols;
                cell.dataset.row = String(r);
                cell.dataset.col = String(c);
                // 每格给一点随机形状偏移,不至于像整齐的棋盘
                cell.style.setProperty('--bubble-skew', `${(Math.random() * 2 - 1) * 5}deg`);
                cell.style.setProperty('--bubble-round', randomBlobRadius());
                if (popped.has(i)) cell.classList.add('is-popped');
                const shine = document.createElement('span');
                shine.className = 'bubble-shine';
                cell.appendChild(shine);
                grid.appendChild(cell);
                cells.push(cell);
            }
        }
        host.el.appendChild(board);
        build();

        // ---------- 交互 ----------
        function pop(cell, index) {
            /*
             * ★ 已经按爆的气泡是「死」的:不动画、不出声、不震动。
             *   以前是「已按过的还能再按(手感优先)」,每次点都会响 ——
             *   跟 QAQ/解压7 原版不一样(原版 popped 之后直接 pointer-events:none),
             *   而且一板子按完之后还能无限点出声,失去了「按完了」的收尾感。
             */
            if (cell.classList.contains('is-popped')) return;

            cell.classList.remove('is-squish');
            void cell.offsetWidth;
            cell.classList.add('is-squish');
            // 先鼓起出声,再落到凹陷态 —— is-popped 的静态样式接住动画的落点
            cell.classList.add('is-popped');
            host.playSound({ rate: 0.92 + Math.random() * 0.18 });
            host.haptic('light');

            saved.popped.push(index);
            host.setState({ popped: saved.popped.slice(), rows, cols });

            if (saved.popped.length === rows * cols) {
                host.notify('success', '全部按完了', '在「捏捏」里点「恢复主体」再来一轮');
            }
        }

        function onPointerDown(event) {
            const cell = event.target.closest?.('.bubble-cell');
            if (!cell || !grid.contains(cell)) return;
            event.preventDefault();
            pop(cell, Number(cell.dataset.index));
        }

        grid.addEventListener('pointerdown', onPointerDown);
        host.onCleanup(() => grid.removeEventListener('pointerdown', onPointerDown));

        // ---------- controller ----------
        return {
            destroy() {
                board.remove();
            },
            setTint(hex) {
                board.style.setProperty('--bubble-tint', hex);
            },
            setSize(width, height) {
                const unit = Math.min(width, height) / Math.max(rows, cols);
                board.style.setProperty('--bubble-unit', `${unit}px`);
            },
            /** 用户调整个数时调用 */
            setRowsCols(nextRows, nextCols) {
                rows = clampGrid(nextRows, rows);
                cols = clampGrid(nextCols, cols);
                // 把旧的 popped 数组按"模"映射到新索引(老的第 i 格能保留大致位置)
                // 最简单做法:丢掉,重新开始 —— 用户调整个数大概率就是「重来」语义
                saved.popped = [];
                build();
                host.setState({ rows, cols, popped: [] });
            },
            reset() {
                saved.popped = [];
                host.setState({ popped: [], rows, cols });
                cells.forEach(cell => cell.classList.remove('is-popped', 'is-squish'));
            },
        };
    },
});

/** 随机不规则圆角,让每颗气泡形状都略有不同 */
function randomBlobRadius() {
    const pick = () => 36 + Math.round(Math.random() * 26);
    return `${pick()}% ${pick()}% ${pick()}% ${pick()}% / ${pick()}% ${pick()}% ${pick()}% ${pick()}%`;
}