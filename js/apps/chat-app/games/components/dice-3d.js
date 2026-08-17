/**
 * 群聊小游戏 / 3D 骰子
 *
 * ★ 这是原型里唯一被用户点名「一定要保留」的东西，所以下面每个数字都是
 *   从 `QAQ/参考/games/monopoly.js` 逐个抄过来的，**不要改**：
 *
 *     立方体      60 × 60 px，半边 translateZ(30px)
 *     容器景深    perspective: 600px
 *     圆角        8px
 *     面          rgba(255,255,255,.9) + blur(5px) + inset 0 0 8px rgba(0,0,0,.1)
 *     点          10 × 10 圆，偏移 ±15 / 0
 *     对面        1↔6  3↔4  2↔5
 *     翻滚        cgRoll 1.5s ease，rotateX 0→360、rotateY 0→720
 *     停稳        transform transition 1.5s ease
 *     落点        1:(0,0) 2:(-90,0) 3:(0,-90) 4:(0,90) 5:(90,0) 6:(0,180)
 *     时序        t=0 开滚 → t=1500 停稳并转到目标面 → t=2300 棋子开始走
 *
 * ── 相对原型改了三处，都是为了让它在这个框架里活得下去 ──────────
 *
 *   ① **样式全部搬进 CSS**（`_chat-game-dice.css`），JS 只吐结构。
 *      原型是一长串内联 style 拼字符串，60 / 30 / 8 这些数字在 JS 里出现
 *      七八次，改一次得全找一遍；而且 JS 里写死颜色在本项目是禁止的。
 *      数值一个没变，只是换了个地方写。
 *
 *   ② **修掉第二次投掷时的那一下跳变。**
 *      原型在动画结束时 `classList.remove('mp-rolling')`，元素会先瞬间
 *      弹回**上一次**的落点角度，再用 1.5s transition 转到新角度 ——
 *      第一把看不出来（上一次落点就是初始态），第二把开始每次都闪一下。
 *      修法：开滚前先把 transform 无过渡地归零，这样关键帧的终点
 *      （rotateX 360 / rotateY 720，视觉上等于零位）和摘掉动画后的静止态
 *      是同一个姿态，接缝就没了。
 *
 *   ③ **动画是可中断、可续上的。**
 *      用户完全可能在骰子转到一半时切出游戏界面。所以「什么时候转完」
 *      不由 setTimeout 说了算，而是由 `dice.startedAt` 算出来的：
 *      切回来时按已经过去多久决定是接着转还是直接摆到结果面。
 *      对局流程本身跟这个动画**完全无关**（由 core/clock.js 推进），
 *      动画只是好看。
 */

import { escapeHtml } from './ui.js';

/** 六个面朝哪儿（对面关系 1↔6 / 3↔4 / 2↔5）。 */
const FACES = [
    { dots: 1, cls: 'is-front' },
    { dots: 6, cls: 'is-back' },
    { dots: 3, cls: 'is-right' },
    { dots: 4, cls: 'is-left' },
    { dots: 2, cls: 'is-top' },
    { dots: 5, cls: 'is-bottom' },
];

/** 点阵。数字是相对面中心的 px 偏移，跟原型一致。 */
const DOT_POSITIONS = {
    1: [[0, 0]],
    2: [[-15, -15], [15, 15]],
    3: [[-15, -15], [0, 0], [15, 15]],
    4: [[-15, -15], [15, -15], [-15, 15], [15, 15]],
    5: [[-15, -15], [15, -15], [0, 0], [-15, 15], [15, 15]],
    6: [[-15, -15], [15, -15], [-15, 0], [15, 0], [-15, 15], [15, 15]],
};

/** 落点角度表。 */
const FACE_ROTATION = {
    1: 'rotateX(0deg) rotateY(0deg)',
    2: 'rotateX(-90deg) rotateY(0deg)',
    3: 'rotateX(0deg) rotateY(-90deg)',
    4: 'rotateX(0deg) rotateY(90deg)',
    5: 'rotateX(90deg) rotateY(0deg)',
    6: 'rotateX(0deg) rotateY(180deg)',
};

/** 翻滚动画时长，必须等于 CSS `@keyframes cgRoll` 的时长。 */
export const ROLL_SPIN_MS = 1500;

function renderDots(count) {
    const pts = DOT_POSITIONS[count] || DOT_POSITIONS[1];
    return pts
        .map(([x, y]) => `<i class="cg-dice__dot" style="transform:translate(${x}px,${y}px)"></i>`)
        .join('');
}

function renderOneDie(die) {
    const value = clampFace(die.value);
    const faces = FACES
        .map((f) => `<div class="cg-dice__face ${f.cls}">${renderDots(f.dots)}</div>`)
        .join('');
    return `
        <div class="cg-dice"
             data-die-id="${escapeHtml(die.id || 'd1')}"
             data-face="${value}"
             data-roll-id="${escapeHtml(String(die.rollId || ''))}">
            ${faces}
        </div>
    `;
}

/**
 * 渲染骰子区。
 *
 * ⚠️ 产出的 HTML **只依赖 `rollId` 和最终点数**，不含「正在滚」这种瞬时状态 ——
 *    这样一次投掷从头到尾字符串是稳定的，区域比对不会在动画中途把元素换掉
 *    （换掉就等于动画重头再来）。
 *
 * @param {object} dice { rollId, startedAt, dice: [{id, value}] }
 */
export function renderDiceStage(dice) {
    const list = Array.isArray(dice?.dice) ? dice.dice : [];
    if (!list.length) return '';
    const total = list.reduce((n, d) => n + clampFace(d.value), 0);
    return `
        <div class="cg-dice-stage"
             data-cg-dice="1"
             data-roll-id="${escapeHtml(String(dice.rollId || ''))}"
             data-started-at="${Number(dice.startedAt) || 0}">
            <div class="cg-dice-stage__row">
                ${list.map((d) => renderOneDie({ ...d, rollId: dice.rollId })).join('')}
            </div>
            <div class="cg-dice-stage__total" data-cg-dice-total="1">${list.length > 1 ? `合计 ${total}` : ''}</div>
        </div>
    `;
}

/**
 * 挂骰子动画。live-view 每次打完补丁都会调一次，必须幂等。
 *
 * @param {HTMLElement} root 对局页根节点
 */
export function mountDice(root) {
    if (!root) return;
    const stage = root.querySelector('[data-cg-dice="1"]');
    if (!stage) return;

    const rollId = stage.getAttribute('data-roll-id') || '';
    if (!rollId || stage.__cgRollId === rollId) return;
    stage.__cgRollId = rollId;

    const startedAt = Number(stage.getAttribute('data-started-at')) || 0;
    const elapsed = startedAt ? Date.now() - startedAt : ROLL_SPIN_MS;
    const remain = ROLL_SPIN_MS - elapsed;

    stage.querySelectorAll('.cg-dice').forEach((el) => {
        const face = clampFace(Number(el.getAttribute('data-face')));
        if (remain <= 0) {
            // 已经转完了（用户切回来时才会走这里）：不补动画，直接摆到结果面。
            // 补一个「刚开始转」的动画反而更怪 —— 用户回来看到的应该是结果。
            el.style.transition = 'none';
            el.style.transform = FACE_ROTATION[face];
            void el.offsetWidth;
            el.style.transition = '';
            return;
        }
        // ★ 归零：让关键帧终点（rotateX360/rotateY720，视觉等于零位）
        //   和动画摘掉之后的静止态是同一个姿态，消除原型那一下跳变。
        el.classList.remove('is-rolling');
        el.style.transition = 'none';
        el.style.transform = FACE_ROTATION[1];
        void el.offsetWidth;
        el.style.transition = '';
        el.classList.add('is-rolling');

        setTimeout(() => {
            // 元素可能已经被框架重画换掉了 —— 这时什么都不用做，
            // 新元素挂上来时会按当时的 elapsed 自己摆好
            if (!el.isConnected) return;
            el.classList.remove('is-rolling');
            el.style.transform = FACE_ROTATION[face];
        }, remain);
    });
}

function clampFace(v) {
    const n = Math.round(Number(v) || 1);
    if (n < 1) return 1;
    if (n > 6) return 6;
    return n;
}

/** 掷 n 颗。结果在动画开始前就定下来（原型也是这样）。 */
export function rollDice(count = 1) {
    const dice = [];
    for (let i = 0; i < count; i++) {
        dice.push({ id: `d${i + 1}`, value: Math.floor(Math.random() * 6) + 1 });
    }
    return {
        rollId: `r${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`,
        startedAt: Date.now(),
        dice,
        total: dice.reduce((n, d) => n + d.value, 0),
    };
}
