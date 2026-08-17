/**
 * relax-app / 内置解压主体:「巧克力脆皮」
 *
 * ------------------------------------------------------------
 * 玩法
 * ------------------------------------------------------------
 * 一整块方形巧克力铺满容器(没有盘子,fit:'stage'),
 * 按下 → 14 块 Voronoi 碎片向按压点飞散 + 持续破碎音;
 * 松手 → 回到原位。
 *
 * ★ 改造点(按用户要求):
 *   1. 「巧克力脆皮只有一个,能放大的大小再大一点」
 *      - 去掉 fit:'plate',改 fit:'stage',铺满整个舞台;
 *      - 上限 1.3 → 1.6(由 store.setToyScale 控,本主体不感知)。
 *   2. 「巧克力要可以改色」
 *      - 原来的 CHOCOLATE 是写死的 '#4d2e1b';
 *        现在改成走 host.tint(主体通用染色链路),用户改色立刻生效。
 *      - host.tint 通过 setTint() 实时更新 canvas 内变量,不需要重 mount。
 *      - 碎片的填充和描边是同一个色。描边只是拿来盖抗锯齿发丝缝的,
 *        描深了每块碎片都会被勾一圈边,整块看起来是散的。
 *      ⚠️ 本主体是唯一一个 `async mount()`(要等 d3),
 *        toy-host 必须 await 它才能拿到 controller ——
 *        直接把 Promise 当 controller 存的话 setTint 根本调不到,表现为「改色没反应」。
 *   3. 「不要盘子 + 形状不对」
 *      - 外层的 .choco-board 容器整个删掉(它带白底/圆角/投影,就是那个盘子),
 *        主体的 DOM 现在只有一张透明画布;舞台那层盘子归「装扮 → 盘子」开关管;
 *      - 画布 CSS 尺寸锁成 min(容器宽,高) 的正方形,
 *        否则 400×400 的位图会被竖长方形的舞台非等比拉成长条;
 *      - INNER_SIZE 180 → 300,让巧克力真的撑满容器而不是缩在正中间。
 * ------------------------------------------------------------
 *
 * 几何部分仍然 1:1 复刻 QAQ/解压5 —— 纯字符照搬,Voronoi 用 d3 全局构建,
 * 用户硬性要求保持解压5 的视觉表现。
 *
 * d3 通过 mount() 里 <script> 注入,确保 window.d3 存在(跟解压5 等价)。
 */

import { registerRelaxToy } from '../registry.js';

const CHOCO_ICON = `
<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="20" height="20" rx="3" fill="currentColor"/>
    <rect x="6" y="6" width="20" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="3 2"/>
    <circle cx="12" cy="11" r="1.2" fill="#ffffff" opacity="0.4"/>
    <circle cx="18" cy="20" r="1" fill="#ffffff" opacity="0.4"/>
</svg>`;

function loadD3() {
    return new Promise((resolve, reject) => {
        if (window.d3 && window.d3.Delaunay) {
            resolve(window.d3);
            return;
        }
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js';
        s.onload = () => resolve(window.d3);
        s.onerror = () => reject(new Error('d3 load failed'));
        document.head.appendChild(s);
    });
}

registerRelaxToy({
    id: 'choco-board',
    name: '巧克力脆皮',
    summary: '按住,持续咬碎',
    icon: CHOCO_ICON,
    defaultTint: '#4d2e1b',
    tintable: true,
    /*
     * ★ 走盘子系统。
     *   之前为了「巧克力下面不要盘子」把它设成了 fit:'stage',
     *   但 fit:'stage' 会让舞台**整段跳过盘子的渲染** ——
     *   连用户自己上传的盘子也一起没了。
     *   真正的「自带盘子」问题是主体外面那层 .choco-board 白板,那个已经删掉了。
     *   要不要盘子交给用户在「装扮 → 盘子」里开关,不该由主体写死。
     */
    fit: 'plate',
    aspect: 1,
    defaultSoundId: 'crinkle',
    resettable: true,
    deletable: false,

    async mount(host) {
        await loadD3();

        // ---------- canvas ----------
        // ★ 没有任何包裹层:主体就是这一张画布,画布上就是巧克力本身。
        //   以前外面套了个 .choco-board 的 div,它带白底+圆角+投影,
        //   看起来就是一个盘子 —— 用户明确不要,连元素一起删掉。
        const canvas = document.createElement('canvas');
        canvas.className = 'choco-canvas';
        // 位图必须在第一次 draw() 之前定好:改 width/height 会清空画布,
        // 放到 mount 末尾设会让首帧画进默认的 300×150 里再被抹掉。
        canvas.width = 400;
        canvas.height = 400;
        host.el.appendChild(canvas);

        const ctx = canvas.getContext('2d');

        /**
         * 画布的 CSS 尺寸锁成正方形(取容器短边),直接写成内联 px。
         * 位图是 400×400,舞台却是竖长方形;要是让 CSS 写 width/height:100%,
         * 两个方向都成了确定值,位图被非等比拉伸,方块巧克力就成了竖长条。
         *
         * 用 offsetWidth 而不是 getBoundingClientRect():后者带上了
         * .rx-toy-host 的 scale(),用户放大一次尺寸就跟着翻一倍。
         */
        function applyUnit(width, height) {
            const w = width || host.el.offsetWidth;
            const h = height || host.el.offsetHeight;
            const unit = Math.min(w, h);
            if (unit > 0) {
                canvas.style.width = `${unit}px`;
                canvas.style.height = `${unit}px`;
            }
        }
        applyUnit();

        // ★ 染色状态:用 ref 让 setTint 能改 draw() 读到的色。
        //   碎片的填充和描边共用同一个颜色 —— 描边只是为了盖住相邻多边形之间
        //   抗锯齿留下的发丝缝,不是装饰。以前描边取的是压暗 18% 的派生色,
        //   每块碎片都被一圈深色勾了边,整块巧克力看起来是碎的。
        const colors = {
            main: typeof host.tint === 'string' && host.tint ? host.tint : '#4d2e1b',
        };

        // ===== ↓↓↓ 以下 1:1 来自 QAQ/解压5(几何/动画骨架) ↓↓↓
        //    唯一改动:写死的 CHOCOLATE / CHOCOLATE_LIGHT → 统一读 colors.main
        // =====
        const engine = (function(){
            const W = 400, H = 400;
            const CX = W/2, CY = H/2;

            // 雪糕参数
            // ★ 解压5 原版是 180(400 的画布里只占中间 45%),那是因为原版画布本身
            //   就跟页面同底色、看不出边。这里没有盘子托着,巧克力必须自己撑满容器,
            //   所以放大到 300。上限受 HALF + MAX_OFFSET <= 200 约束(碎片不能飞出位图)。
            const INNER_SIZE = 300;
            const HALF = INNER_SIZE/2;
            const CRACK_COUNT = 14;

            // ---------- 生成碎片 (Voronoi) ----------
            let seeds = [];
            function initSeeds() {
                seeds = [];
                for (let i = 0; i < CRACK_COUNT; i++) {
                    let x, y, attempts = 0;
                    do {
                        x = (Math.random() - 0.5) * INNER_SIZE * 0.92;
                        y = (Math.random() - 0.5) * INNER_SIZE * 0.92;
                        attempts++;
                    } while (attempts < 30 && Math.hypot(x, y) > HALF * 0.92);
                    seeds.push({ x, y, ox: x, oy: y });
                }
                // Lloyd 松弛
                for (let iter = 0; iter < 3; iter++) {
                    const cells = seeds.map(() => ({ cx: 0, cy: 0, count: 0 }));
                    for (let i = 0; i < 400; i++) {
                        const px = (Math.random() - 0.5) * INNER_SIZE * 0.96;
                        const py = (Math.random() - 0.5) * INNER_SIZE * 0.96;
                        let minDist = Infinity, minIdx = 0;
                        for (let j = 0; j < seeds.length; j++) {
                            const d = (px - seeds[j].x)**2 + (py - seeds[j].y)**2;
                            if (d < minDist) { minDist = d; minIdx = j; }
                        }
                        cells[minIdx].cx += px;
                        cells[minIdx].cy += py;
                        cells[minIdx].count++;
                    }
                    for (let i = 0; i < seeds.length; i++) {
                        if (cells[i].count > 0) {
                            seeds[i].x = cells[i].cx / cells[i].count;
                            seeds[i].y = cells[i].cy / cells[i].count;
                        }
                    }
                }
                seeds.forEach(s => { s.ox = s.x; s.oy = s.y; });
            }
            let fragments = [];

            /**
             * 按当前 seeds 重算 Voronoi 碎片。
             *
             * ★ 原来这里的 voronoi 是在函数外面 `const` 出来的,只算一次;
             *   而重试分支写的是 `if (fragments.length < 6) { initSeeds(); buildFragments(); }` ——
             *   initSeeds() 换了种子,voronoi 却还是旧的,重算结果一模一样,
             *   于是这条重试是**无限递归**,真触发就直接爆栈:
             *   mount 抛异常 → slot 空着 → 巧克力整个不见。
             *   现在把 Delaunay 的构建挪进函数里,并且把重试次数限死。
             */
            function buildFragments(attempt = 0) {
                const points = seeds.map(s => [s.x, s.y]);
                const delaunay = d3.Delaunay.from(points);
                const voronoi = delaunay.voronoi([-HALF-10, -HALF-10, HALF+10, HALF+10]);

                fragments = [];
                for (const poly of voronoi.cellPolygons()) {
                    if (!poly || poly.length < 3) continue;
                    const verts = poly.map(p => ({ x: p[0], y: p[1] }));
                    const clipped = clipToSquare(verts, HALF);
                    if (clipped.length < 3) continue;
                    let cx = 0, cy = 0;
                    for (const v of clipped) { cx += v.x; cy += v.y; }
                    cx /= clipped.length; cy /= clipped.length;
                    fragments.push({
                        verts: clipped,
                        cx, cy,
                        dx: 0, dy: 0,
                        angle: Math.atan2(cy, cx)
                    });
                }

                // 种子分布太糟(碎片太少)就换一批重来,最多 4 次,兜不住也认了 ——
                // 少几块碎片只是不好看,爆栈是整块消失。
                if (fragments.length < 6 && attempt < 4) {
                    initSeeds();
                    buildFragments(attempt + 1);
                }
            }

            initSeeds();
            buildFragments();

            function clipToSquare(verts, half) {
                let input = verts.slice();
                const clipEdges = [
                    { x1: -half, y1: -half, x2: half, y2: -half },
                    { x1: half, y1: -half, x2: half, y2: half },
                    { x1: half, y1: half, x2: -half, y2: half },
                    { x1: -half, y1: half, x2: -half, y2: -half }
                ];
                for (const edge of clipEdges) {
                    input = clipPolygonByEdge(input, edge);
                    if (input.length < 3) return [];
                }
                return input;
            }

            function clipPolygonByEdge(poly, edge) {
                const output = [];
                const n = poly.length;
                for (let i = 0; i < n; i++) {
                    const cur = poly[i], next = poly[(i+1)%n];
                    const curInside = isInside(cur, edge);
                    const nextInside = isInside(next, edge);
                    if (curInside) {
                        output.push({ x: cur.x, y: cur.y });
                        if (!nextInside) {
                            const inter = intersect(cur, next, edge);
                            if (inter) output.push(inter);
                        }
                    } else if (nextInside) {
                        const inter = intersect(cur, next, edge);
                        if (inter) output.push(inter);
                    }
                }
                return output;
            }

            function isInside(p, edge) {
                const ex = edge.x2 - edge.x1, ey = edge.y2 - edge.y1;
                const px = p.x - edge.x1, py = p.y - edge.y1;
                return (ex * py - ey * px) >= -0.001;
            }

            function intersect(p1, p2, edge) {
                const ex = edge.x2 - edge.x1, ey = edge.y2 - edge.y1;
                const d1 = ex * (p1.y - edge.y1) - ey * (p1.x - edge.x1);
                const d2 = ex * (p2.y - edge.y1) - ey * (p2.x - edge.x1);
                if (d1 === d2) return null;
                const t = d1 / (d1 - d2);
                return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
            }

            // ---------- 状态 ----------
            let isPressed = false;
            let pressX = CX, pressY = CY;
            let pressTime = 0;
            let lastTimestamp = 0;
            let crackLevel = 0;
            let targetCrackLevel = 0;
            let animationFrame = null;

            const RESTORE_SPEED = 0.04;
            const CRACK_SPEED = 0.035;
            // 跟着 INNER_SIZE 一起放大,保持原版「飞散幅度约为边长 1/6」的手感;
            // 150 + 44 = 194 < 200,碎片飞到最远也还在位图里。
            const MAX_OFFSET = 44;

            // ---------- 事件 ----------
            /**
             * 屏幕坐标 → 画布内部坐标(400×400)。
             *
             * ★ 必须挡住 rect 尺寸为 0 的情况(画布被隐藏 / 还没布局 / 已经从文档里摘掉)。
             *   否则 canvas.width / 0 = Infinity,pressX 变成 Infinity,
             *   接着 update() 里 dirX = -Infinity / Infinity = NaN,
             *   f.dx 从此一直是 NaN,所有碎片都画在 NaN 坐标上 = **整块巧克力凭空消失**,
             *   而且 pressX 不会自己恢复,只能等下一次有效点击 —— 这就是
             *   「点着点着突然不见了」的元凶。
             */
            function getPos(e) {
                const rect = canvas.getBoundingClientRect();
                const fallback = { x: pressX, y: pressY };
                if (!rect.width || !rect.height) return fallback;

                let clientX, clientY;
                if (e.touches) {
                    const touch = e.touches[0];
                    if (!touch) return fallback;
                    clientX = touch.clientX;
                    clientY = touch.clientY;
                    e.preventDefault();
                } else {
                    clientX = e.clientX;
                    clientY = e.clientY;
                }

                const x = (clientX - rect.left) * (canvas.width / rect.width);
                const y = (clientY - rect.top) * (canvas.height / rect.height);
                if (!Number.isFinite(x) || !Number.isFinite(y)) return fallback;
                return { x, y };
            }

            /** 主体的声音/震动不能把渲染带崩:桥接层抛错时 raf 链会整条断掉 */
            function safeFeedback(rate, strength) {
                try {
                    host.playSound({ rate });
                    host.haptic(strength);
                } catch (err) {
                    console.warn('[relax/choco] 声音/震动抛错,忽略', err);
                }
            }

            /** raf 链断了(某一帧抛异常)也能被下一次按压救回来 */
            function ensureLoop() {
                if (animationFrame) cancelAnimationFrame(animationFrame);
                animationFrame = requestAnimationFrame(update);
            }

            function onPointerDown(e) {
                e.preventDefault();
                const pos = getPos(e);
                pressX = pos.x; pressY = pos.y;
                isPressed = true;
                pressTime = 0;
                lastTimestamp = performance.now();
                lastSoundAt = performance.now();
                safeFeedback(0.88 + Math.random() * 0.18, 'medium');
                ensureLoop();
            }

            function onPointerMove(e) {
                if (!isPressed) return;
                const pos = getPos(e);
                pressX = pos.x; pressY = pos.y;
            }

            function onTouchMove(e) {
                if (!isPressed) return;
                const pos = getPos(e);
                pressX = pos.x; pressY = pos.y;
                e.preventDefault();
            }

            function onPointerUp() {
                if (!isPressed) return;
                isPressed = false;
                pressTime = 0;
                targetCrackLevel = 0;
                safeFeedback(0.78 + Math.random() * 0.14, 'light');
                ensureLoop();
            }

            canvas.addEventListener('mousedown', onPointerDown);
            // ★ move 监听以前是匿名箭头函数,cleanup 里根本删不掉 ——
            //   每切一次主体就往 window 上多留一对,换成具名函数才能真正解绑。
            window.addEventListener('mousemove', onPointerMove);
            window.addEventListener('mouseup', onPointerUp);
            canvas.addEventListener('touchstart', onPointerDown, { passive: false });
            window.addEventListener('touchmove', onTouchMove, { passive: false });
            window.addEventListener('touchend', onPointerUp, { passive: false });
            window.addEventListener('touchcancel', onPointerUp, { passive: false });

            host.onCleanup(() => {
                window.removeEventListener('mousemove', onPointerMove);
                window.removeEventListener('touchmove', onTouchMove);
                canvas.removeEventListener('mousedown', onPointerDown);
                window.removeEventListener('mouseup', onPointerUp);
                canvas.removeEventListener('touchstart', onPointerDown);
                window.removeEventListener('touchend', onPointerUp);
                window.removeEventListener('touchcancel', onPointerUp);
            });

            // ---------- 持续声音控制 ----------
            let lastSoundAt = 0;
            const SOUND_INTERVAL = 180;

            // ---------- 更新 ----------
            function update(timestamp) {
                const delta = lastTimestamp ? Math.min(timestamp - lastTimestamp, 50) : 16;
                lastTimestamp = timestamp;

                if (isPressed) {
                    pressTime += delta;
                    const ratio = Math.min(pressTime / 1400, 1);
                    targetCrackLevel = Math.pow(ratio, 0.6);

                    // ★ 按住期间每 180ms 破碎音。走 safeFeedback:
                    //   桥接层要是抛错,这一帧就会在 draw() 之前中断,
                    //   raf 链断掉 → 画面永远停在半碎状态,再也不动。
                    if (crackLevel > 0.2 && timestamp - lastSoundAt > SOUND_INTERVAL) {
                        safeFeedback(0.85 + Math.random() * 0.25, 'light');
                        lastSoundAt = timestamp;
                    }
                }

                let diff = targetCrackLevel - crackLevel;
                let speed = isPressed ? CRACK_SPEED : RESTORE_SPEED;
                if (Math.abs(diff) < 0.001) {
                    crackLevel = targetCrackLevel;
                } else {
                    crackLevel += Math.sign(diff) * speed * (delta / 16);
                    crackLevel = Math.min(1, Math.max(0, crackLevel));
                }

                const relX = pressX - CX;
                const relY = pressY - CY;
                const pressDist = Math.hypot(relX, relY);
                const pressAngle = Math.atan2(relY, relX);

                for (const f of fragments) {
                    let angleDiff = f.angle - pressAngle;
                    while (angleDiff > Math.PI) angleDiff -= 2*Math.PI;
                    while (angleDiff < -Math.PI) angleDiff += 2*Math.PI;
                    const influence = Math.max(0, 1 - Math.abs(angleDiff) / Math.PI * 1.1);
                    let distFactor = 1;
                    if (pressDist > 5) {
                        const fDist = Math.hypot(f.cx, f.cy);
                        const d = Math.abs(pressDist - fDist) / (HALF * 0.7);
                        distFactor = Math.max(0, 1 - d * 0.5);
                    }
                    let strength = influence * distFactor * 0.8 + 0.2;
                    let dirX = Math.cos(f.angle);
                    let dirY = Math.sin(f.angle);
                    if (pressDist > 3) {
                        const toX = f.cx - relX;
                        const toY = f.cy - relY;
                        const len = Math.hypot(toX, toY);
                        if (len > 0.5) { dirX = toX / len; dirY = toY / len; }
                    }
                    const offset = strength * crackLevel * MAX_OFFSET;
                    const dx = dirX * offset;
                    const dy = dirY * offset;
                    // 最后一道保险:任何一步算出 NaN/Infinity 都当作「没位移」,
                    // 而不是把 NaN 写进顶点让整块巧克力画不出来。
                    f.dx = Number.isFinite(dx) ? dx : 0;
                    f.dy = Number.isFinite(dy) ? dy : 0;
                }

                draw();
                animationFrame = requestAnimationFrame(update);
            }

            // ---------- 绘制(纯色 + 1.2px 同色描边) ----------
            function draw() {
                ctx.clearRect(0, 0, W, H);

                // 1. 奶白内层(纯色)
                ctx.fillStyle = '#faf8f5';
                ctx.fillRect(CX - HALF, CY - HALF, INNER_SIZE, INNER_SIZE);

                // 2. 巧克力碎片(纯色填充 + 描边)—— ★ CHOCOLATE → colors.main
                for (const f of fragments) {
                    const verts = f.verts;
                    if (verts.length < 3) continue;
                    const offsetVerts = verts.map(v => ({
                        x: CX + v.x + f.dx,
                        y: CY + v.y + f.dy
                    }));

                    ctx.beginPath();
                    ctx.moveTo(offsetVerts[0].x, offsetVerts[0].y);
                    for (let i = 1; i < offsetVerts.length; i++) {
                        ctx.lineTo(offsetVerts[i].x, offsetVerts[i].y);
                    }
                    ctx.closePath();
                    ctx.fillStyle = colors.main;
                    ctx.fill();

                    // 同色描边:只用来补抗锯齿的发丝缝,不能比填充深,否则碎片被勾边
                    ctx.strokeStyle = colors.main;
                    ctx.lineWidth = 1.2;
                    ctx.stroke();
                }
            }

            draw();

            if (!animationFrame) {
                animationFrame = requestAnimationFrame(update);
            }

            /**
             * ★ raf / 碎片都是 IIFE 的局部变量,外层 controller 够不着。
             *   以前这里挂的是 window.__chocoBoardReset 全局,而 destroy() 里
             *   引用的 animationFrame 根本不在作用域内 —— 一切换主体就抛 ReferenceError,
             *   raf 停不下来,detach 掉的 canvas 继续跑。改成把句柄交出去。
             */
            return {
                stop() {
                    if (animationFrame) {
                        cancelAnimationFrame(animationFrame);
                        animationFrame = null;
                    }
                },
                reset() {
                    // 直接复用 buildFragments —— 它自带「碎片太少就换种子重来」的兜底,
                    // 以前这里是抄了一份没有兜底的重建逻辑。
                    initSeeds();
                    buildFragments();
                    crackLevel = 0;
                    targetCrackLevel = 0;
                    isPressed = false;
                    pressTime = 0;
                    pressX = CX;
                    pressY = CY;
                    ensureLoop();
                },
            };
        })();
        // ===== ↑↑↑ 解压5 移植结束 ↑↑↑ =====

        return {
            destroy() {
                engine.stop();
                canvas.remove();
            },
            /**
             * ★ 改色入口。colors 是 ref,所以 draw() 下一次循环会读到新值。
             *   不需要重 mount,canvas 内部的 raf 一直在跑。
             */
            setTint(hex) {
                if (typeof hex === 'string' && /^#[0-9a-f]{3,8}$/i.test(hex.trim())) {
                    colors.main = hex.trim();
                }
            },
            setSize(width, height) {
                applyUnit(width, height);
            },
            reset() {
                engine.reset();
            },
        };
    },
});