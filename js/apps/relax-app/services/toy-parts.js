/**
 * relax-app / 自由捏捏的「零件」引擎
 *
 * ============================================================
 * 为什么要有这个文件
 * ============================================================
 * 「我的捏捏」原来只能做**一格重复 N 次**的板子:用户写一格,板子复制 16 份。
 * 想做摇杆、鼠标、旋钮这种「整块一个东西、不同部位各干各的」就彻底做不了 ——
 * 摇杆要跟着手指走,鼠标左右键要各按各的,滚轮要能滚。
 * 这些都不是「按一下换个样子」能表达的,它们需要**连续的指针位置**。
 *
 * 直接开放用户 JS 是最省事的做法,但那等于把 innerHTML 注入升级成任意代码执行 ——
 * 编辑页鼓励用户粘 AI 生成的代码,这条路不能走(理由见 toy-sanitizer.js 的头注释)。
 *
 * 所以走中间路线:**手势由宿主实现,样子由用户的 CSS 决定**。
 * 用户在自己的元素上打一个 `data-hb="stick"`,这里就负责:
 *   1) 监听指针,算出归一化的位置 / 角度 / 开关量;
 *   2) 写成 CSS 自定义属性(--hb-x / --hb-y / --hb-deg …);
 *   3) 顺手加状态类(is-press / is-on / is-active / is-popped)。
 * 用户只要写 `translate(calc(var(--hb-x) * 30%), ...)` 就能让摇杆跟手。
 *
 * ============================================================
 * ★ 变量一律是**纯数字**,用的时候自己乘单位
 * ============================================================
 * `--hb-deg: 42`(不是 `42deg`)。要转就写 `rotate(calc(var(--hb-deg) * 1deg))`。
 * 统一成一条规则,比「有的带单位有的不带」好记,也能直接进 calc 做运算。
 *
 * ============================================================
 * ★ 这个文件碰 DOM,和 toy-sanitizer / toy-prompt 不一样
 * ============================================================
 * 那两个是纯函数、能被 node 直接 import 做回归。这里必须操作真实节点和
 * 指针事件,没法保持零 DOM。但**不碰 store、不碰 window 全局、不插全局 <style>**:
 * 声音和震动都从 options 传进来,主体那边给 host.playSound,编辑页预览给自己的。
 * 同一份引擎两边共用 —— 否则「预览里摇杆能拖、放到舞台上不动」这种事早晚发生。
 */

/** 认识的零件类型。写错(比如 data-hb="button")会被当成普通元素忽略,不报错。 */
const PART_TYPES = new Set(['press', 'toggle', 'stick', 'slide', 'dial']);

/** 一个零件最多能被扫到多少个。防止用户写个 500 格的循环把手机拖死。 */
const MAX_PARTS = 64;

/** 按住不放时补震动 / 补声音的间隔,抄 demo-jelly 的手感 */
const HOLD_INTERVAL_MS = 220;

/**
 * 零件速查表。
 * ★ 编辑页的「零件速查」和 toy-prompt 的技术契约都读这一份 ——
 *   三处各写各的话,改了引擎就会有一处说的是老规矩,用户照着写出来的东西不动。
 */
export const TOY_PART_GUIDE = Object.freeze([
    {
        type: 'press',
        label: '按钮',
        gesture: '按下、松手',
        vars: '--hb-p(按住 1,松开 0)',
        classes: 'is-press(按住时)、is-popped(配 data-once,一次性)',
        desc: '鼠标左右键、琴键、大按钮。最常用的一个。',
    },
    {
        type: 'toggle',
        label: '开关',
        gesture: '点一下翻面',
        vars: '--hb-on(0 或 1)',
        classes: 'is-on',
        desc: '拨动开关、电源键。状态会存档,下次打开还在。',
    },
    {
        type: 'stick',
        label: '摇杆',
        gesture: '按住拖,松手回中',
        vars: '--hb-x、--hb-y(都是 -1~1)、--hb-dist(0~1)、--hb-deg(角度)',
        classes: 'is-active(拖动中)',
        desc: '游戏摇杆。打在**底座**上,里面的帽子用 --hb-x/--hb-y 位移。',
    },
    {
        type: 'slide',
        label: '滑块',
        gesture: '按住拖,停在原地',
        vars: '--hb-x、--hb-y(都是 0~1)、--hb-scroll(累计,可以超出)',
        classes: 'is-active(拖动中)',
        desc: '滚轮、推杆、音量条。配 data-axis 选方向,data-wrap 让它循环。',
    },
    {
        type: 'dial',
        label: '旋钮',
        gesture: '绕中心转',
        vars: '--hb-deg(累计角度)、--hb-turn(转了几圈)',
        classes: 'is-active(拖动中)',
        desc: '音量旋钮、保险箱转盘。配 data-min / data-max 限位。',
    },
]);

/** 附加属性速查(同样是速查表和提示词共用的一份) */
export const TOY_PART_ATTRS = Object.freeze([
    { attr: 'data-id="left"', desc: '给零件起名。存档按这个名字对号入座,也能被整块的 CSS 读到(见下)。' },
    { attr: 'data-axis="x|y|xy"', desc: '只给 slide。默认 xy(两个方向都能拖)。' },
    { attr: 'data-step="0.1"', desc: '每走这么多响一下(卡顿感)。slide 填 0~1 的比例,dial 填角度,stick 填方向数。' },
    { attr: 'data-wrap', desc: '只给 slide。拖到头之后从另一头绕回来 —— 滚轮要靠它才能一直滚。' },
    { attr: 'data-gain="0.4"', desc: '只给 slide。手指走同样的距离,值变化多少倍。零件很小(比如滚轮)就调小,不然一碰就到头。' },
    { attr: 'data-min="-135" data-max="135"', desc: '只给 dial。限位,不写就能无限转。' },
    { attr: 'data-once', desc: '只给 press。按过一次就永久留下 is-popped,存档。' },
    { attr: 'data-hold', desc: '只给 press。按住不放会一直出声、一直震。' },
    { attr: 'data-release', desc: '只给 press。松手时再响一声(鼠标那种「咔—嗒」)。' },
    { attr: 'data-rate="1.3"', desc: '这个零件的音调。1 是原声,大了变尖,小了变闷。' },
    { attr: 'data-mute', desc: '这个零件不出声。' },
    { attr: 'data-heavy', desc: '震得重一点。' },
]);

// ============================================================
// 小工具
// ============================================================

function toNumber(value, fallback) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function clamp01(value) {
    return clamp(value, 0, 1);
}

function round3(value) {
    return String(Math.round(value * 1000) / 1000);
}

function round1(value) {
    return String(Math.round(value * 10) / 10);
}

/** 把 data-id 洗成能当 CSS 变量名用的样子(只留字母数字和短横) */
function safeKey(raw) {
    return String(raw || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 24);
}

function plainObject(value) {
    return (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
}

// ============================================================
// 引擎
// ============================================================

/**
 * 在 root 里扫出所有 [data-hb] 零件并接管它们的指针交互。
 *
 * @param {HTMLElement} root 用户 HTML 的容器(自由舞台 / 预览板)
 * @param {object} [options]
 * @param {(opts?: object) => void} [options.playSound] 播一次音,opts: { rate }
 * @param {(strength?: string) => void} [options.haptic] 震动
 * @param {(values: object) => void} [options.onPersist] 值变了(防抖后)往外抛,主体拿去 host.setState
 * @param {object} [options.values] 存档里读回来的值,按 data-id 对号入座
 * @returns {{ rescan: () => void, reset: () => void, getValues: () => object, destroy: () => void }}
 */
export function createToyParts(root, options = {}) {
    const playSound = typeof options.playSound === 'function' ? options.playSound : () => {};
    const haptic = typeof options.haptic === 'function' ? options.haptic : () => {};
    const onPersist = typeof options.onPersist === 'function' ? options.onPersist : () => {};

    let savedValues = plainObject(options.values);
    let parts = [];
    let byEl = new WeakMap();
    /** pointerId → part。同时按住两个键要各走各的,所以按指针分桶。 */
    const active = new Map();
    let persistTimer = null;
    let destroyed = false;

    // ---------- 扫描 ----------

    /** 重新扫一遍 root:用户改了 HTML 之后调 */
    function rescan() {
        releaseAll();
        parts = [];
        byEl = new WeakMap();

        const nodes = root.querySelectorAll('[data-hb]');
        const usedKeys = new Set();

        for (let i = 0; i < nodes.length && parts.length < MAX_PARTS; i += 1) {
            const el = nodes[i];
            const type = String(el.dataset.hb || '').trim().toLowerCase();
            if (!PART_TYPES.has(type)) continue;

            const part = createPart(el, type, i, usedKeys);
            restore(part);
            parts.push(part);
            byEl.set(el, part);
            paint(part);
        }
    }

    function createPart(el, type, index, usedKeys) {
        // 没写 data-id 就按「类型+序号」自动起名。★ 自动名是跟着 DOM 顺序走的,
        // 用户一改 HTML 顺序,存档就对不上了 —— 所以速查表里一直劝人写 data-id。
        let key = safeKey(el.dataset.id) || `${type}${index}`;
        while (usedKeys.has(key)) key = `${key}_`;
        usedKeys.add(key);

        const rawAxis = String(el.dataset.axis || '').trim().toLowerCase();
        return {
            el,
            type,
            key,
            axis: (rawAxis === 'x' || rawAxis === 'y') ? rawAxis : 'xy',
            step: Math.abs(toNumber(el.dataset.step, 0)),
            gain: clamp(toNumber(el.dataset.gain, 1), 0.05, 20),
            wrap: el.hasAttribute('data-wrap'),
            once: el.hasAttribute('data-once'),
            hold: el.hasAttribute('data-hold'),
            release: el.hasAttribute('data-release'),
            mute: el.hasAttribute('data-mute'),
            heavy: el.hasAttribute('data-heavy'),
            rate: clamp(toNumber(el.dataset.rate, 1), 0.3, 3),
            min: el.hasAttribute('data-min') ? toNumber(el.dataset.min, null) : null,
            max: el.hasAttribute('data-max') ? toNumber(el.dataset.max, null) : null,

            // 运行时状态
            x: 0,
            y: 0,
            deg: 0,
            scroll: 0,
            on: false,
            used: false,
            pressed: false,
            holdTimer: null,
            tickIndex: null,
            tickPrimed: false,
            drag: null,
        };
    }

    /** 从存档里恢复。存档形状按类型分,读不出来就当默认值,不抛错。 */
    function restore(part) {
        const saved = savedValues[part.key];
        if (saved == null) return;
        switch (part.type) {
            case 'press':
                part.used = saved === true || saved?.used === true;
                break;
            case 'toggle':
                part.on = saved === true || saved?.on === true;
                break;
            case 'slide':
                part.x = clamp01(toNumber(saved?.x, 0));
                part.y = clamp01(toNumber(saved?.y, 0));
                part.scroll = toNumber(saved?.scroll, 0);
                break;
            case 'dial':
                part.deg = toNumber(saved?.deg, 0);
                break;
            default:
                break;
        }
    }

    // ---------- 写变量 ----------

    /**
     * 把当前值写成 CSS 变量 + 状态类。
     *
     * ★ 变量写在零件**自己**身上(靠继承传给子元素),同时按 data-id 在 root 上
     *   镜像一份 `--hb-<id>-x`。镜像是给「兄弟元素要跟着变」的场景用的 ——
     *   比如鼠标左键按下时,壳子上的指示灯要亮:灯不是左键的子元素,读不到它的变量。
     */
    function paint(part) {
        const el = part.el;
        switch (part.type) {
            case 'press':
                el.style.setProperty('--hb-p', part.pressed ? '1' : '0');
                el.classList.toggle('is-press', part.pressed);
                el.classList.toggle('is-popped', part.used);
                mirror(part, '', part.pressed ? '1' : '0');
                break;

            case 'toggle':
                el.style.setProperty('--hb-on', part.on ? '1' : '0');
                el.classList.toggle('is-on', part.on);
                mirror(part, '', part.on ? '1' : '0');
                break;

            case 'stick': {
                const dist = Math.min(1, Math.hypot(part.x, part.y));
                const deg = (part.x === 0 && part.y === 0)
                    ? 0
                    : Math.atan2(part.y, part.x) * 180 / Math.PI;
                el.style.setProperty('--hb-x', round3(part.x));
                el.style.setProperty('--hb-y', round3(part.y));
                el.style.setProperty('--hb-dist', round3(dist));
                el.style.setProperty('--hb-deg', round1(deg));
                mirror(part, '-x', round3(part.x));
                mirror(part, '-y', round3(part.y));
                mirror(part, '-dist', round3(dist));
                break;
            }

            case 'slide':
                el.style.setProperty('--hb-x', round3(part.x));
                el.style.setProperty('--hb-y', round3(part.y));
                el.style.setProperty('--hb-scroll', round3(part.scroll));
                mirror(part, '-x', round3(part.x));
                mirror(part, '-y', round3(part.y));
                break;

            case 'dial':
                el.style.setProperty('--hb-deg', round1(part.deg));
                el.style.setProperty('--hb-turn', round3(part.deg / 360));
                mirror(part, '-deg', round1(part.deg));
                break;

            default:
                break;
        }
    }

    function mirror(part, suffix, value) {
        root.style.setProperty(`--hb-${part.key}${suffix}`, value);
    }

    // ---------- 反馈 ----------

    function fire(part, rateShift = 1) {
        if (part.mute) return;
        playSound({ rate: clamp(part.rate * rateShift, 0.25, 4) });
        haptic(part.heavy ? 'medium' : 'light');
    }

    /**
     * 卡顿感:值每跨过一个 step 就响一下。
     *
     * ★ 只有**每次拖动的第一次对齐**要吞掉,否则手指一碰就先响一声,
     *   听起来像「还没动就咔了一下」。
     * ★ 但摇杆回到中心时也会把 tickIndex 清成 null(方向没有意义了),
     *   那一次**不能**跟着吞 —— 吞了的话「推回中间再推出去」的第一下永远没声,
     *   摇杆玩起来就是哑的。所以另用 tickPrimed 记「这次拖动已经开过口了」。
     */
    function tick(part, units) {
        if (!part.step) return;
        const idx = Math.round(units);
        if (part.tickIndex === idx) return;
        const silent = part.tickIndex === null && !part.tickPrimed;
        part.tickIndex = idx;
        part.tickPrimed = true;
        if (!silent) fire(part, 1.06);
    }

    function startHold(part) {
        stopHold(part);
        part.holdTimer = setInterval(() => {
            if (!part.pressed) {
                stopHold(part);
                return;
            }
            fire(part, 0.94 + Math.random() * 0.12);
        }, HOLD_INTERVAL_MS);
    }

    function stopHold(part) {
        if (part.holdTimer) {
            clearInterval(part.holdTimer);
            part.holdTimer = null;
        }
    }

    // ---------- 几何 ----------

    /**
     * ★ 这里用 getBoundingClientRect 是对的,和 toy-host.reportSize 相反。
     *   主体外面挂着 transform: scale(),rect 是缩放**之后**的尺寸 ——
     *   但 event.clientX 也在同一套缩放后的坐标系里,两者相除得到的比例正好抵消。
     *   反倒是用 offsetWidth 会在放大之后算出「拖一点点就到头」。
     */
    function centerOf(el) {
        const rect = el.getBoundingClientRect();
        return {
            rect,
            cx: rect.left + rect.width / 2,
            cy: rect.top + rect.height / 2,
        };
    }

    function angleOf(el, event) {
        const { cx, cy } = centerOf(el);
        return Math.atan2(event.clientY - cy, event.clientX - cx) * 180 / Math.PI;
    }

    // ---------- 各类型的手势 ----------

    function beginPress(part) {
        part.pressed = true;
        if (part.once && !part.used) {
            part.used = true;
            schedulePersist();
        }
        paint(part);
        fire(part, 1);
        if (part.hold) startHold(part);
    }

    function endPress(part) {
        if (!part.pressed) return;
        part.pressed = false;
        stopHold(part);
        paint(part);
        if (part.release) fire(part, 0.82);
    }

    function toggleOnce(part) {
        part.on = !part.on;
        paint(part);
        fire(part, part.on ? 1.08 : 0.9);
        schedulePersist();
    }

    function beginStick(part, event) {
        part.el.classList.add('is-active');
        part.tickIndex = null;
        part.tickPrimed = false;
        // 抓住就先应一声。不给这一下的话,没配 data-step 的摇杆从按到松全程是哑的
        fire(part, 1.05);
        // 抓在边上时,这一次是「对齐到手指所在的方向」,要哑掉,不然和上面那声撞一起
        moveStick(part, event);
        // ★ 对齐之后立刻开口。抓在中心(死区里)时上面那次根本没算方向,
        //   不在这儿开口的话,「从中心第一次推出去」会被当成对齐吞掉 ——
        //   而那一下恰恰是摇杆最该响的一下。
        part.tickPrimed = true;
    }

    function moveStick(part, event) {
        const { rect, cx, cy } = centerOf(part.el);
        const hw = rect.width / 2;
        const hh = rect.height / 2;
        if (hw <= 0 || hh <= 0) return;

        let x = (event.clientX - cx) / hw;
        let y = (event.clientY - cy) / hh;
        // 归一化到单位圆内:超出边界就贴着圆周走,不然对角方向能拖到 1.41
        const dist = Math.hypot(x, y);
        if (dist > 1) {
            x /= dist;
            y /= dist;
        }
        part.x = x;
        part.y = y;
        paint(part);

        // step 对摇杆表示「分几个方向」。回到中心附近就清空,免得手抖在原地一直咔
        if (part.step >= 2) {
            if (Math.hypot(x, y) < 0.35) {
                part.tickIndex = null;
            } else {
                tick(part, (Math.atan2(y, x) * 180 / Math.PI) / (360 / part.step));
            }
        }
    }

    function endStick(part) {
        part.el.classList.remove('is-active');
        part.x = 0;
        part.y = 0;
        part.tickIndex = null;
        part.tickPrimed = false;
        paint(part);
        fire(part, 0.8);
    }

    function beginSlide(part, event) {
        part.el.classList.add('is-active');
        part.drag = {
            px: event.clientX,
            py: event.clientY,
            x: part.x,
            y: part.y,
            scroll: part.scroll,
        };
        part.tickIndex = null;
        part.tickPrimed = false;
    }

    function moveSlide(part, event) {
        const rect = part.el.getBoundingClientRect();
        const from = part.drag;
        if (!from) return;

        let travel = 0;
        if (part.axis !== 'y' && rect.width > 0) {
            const moved = (event.clientX - from.px) / rect.width * part.gain;
            const raw = from.x + moved;
            part.x = part.wrap ? ((raw % 1) + 1) % 1 : clamp01(raw);
            travel = moved;
        }
        if (part.axis !== 'x' && rect.height > 0) {
            const moved = (event.clientY - from.py) / rect.height * part.gain;
            const raw = from.y + moved;
            part.y = part.wrap ? ((raw % 1) + 1) % 1 : clamp01(raw);
            if (part.axis === 'y') travel = moved;
        }

        // --hb-scroll 是**没有被夹住也没有绕回**的累计行程,滚轮靠它做无限滚
        part.scroll = from.scroll + travel;
        paint(part);

        if (part.step) tick(part, (part.axis === 'x' ? part.x : part.y) / part.step);
    }

    function endSlide(part) {
        part.el.classList.remove('is-active');
        part.drag = null;
        part.tickIndex = null;
        part.tickPrimed = false;
        schedulePersist();
    }

    function beginDial(part, event) {
        part.el.classList.add('is-active');
        part.drag = { angle: angleOf(part.el, event) };
        part.tickIndex = null;
        part.tickPrimed = false;
    }

    function moveDial(part, event) {
        if (!part.drag) return;
        const angle = angleOf(part.el, event);
        // 跨过 ±180° 那条缝时要走近路,否则转一圈会突然反向弹 360°
        let delta = angle - part.drag.angle;
        while (delta > 180) delta -= 360;
        while (delta < -180) delta += 360;
        part.drag.angle = angle;

        let next = part.deg + delta;
        if (part.min != null) next = Math.max(part.min, next);
        if (part.max != null) next = Math.min(part.max, next);
        part.deg = next;
        paint(part);

        if (part.step) tick(part, part.deg / part.step);
    }

    function endDial(part) {
        part.el.classList.remove('is-active');
        part.drag = null;
        part.tickIndex = null;
        part.tickPrimed = false;
        schedulePersist();
    }

    // ---------- 指针 ----------

    function onPointerDown(event) {
        const el = event.target?.closest?.('[data-hb]');
        if (!el || !root.contains(el)) return;
        const part = byEl.get(el);
        if (!part) return;

        event.preventDefault();
        active.set(event.pointerId, part);

        try {
            el.setPointerCapture?.(event.pointerId);
        } catch {
            /* 老浏览器没有 capture,下面的 window 监听兜得住 */
        }

        switch (part.type) {
            case 'press': beginPress(part); break;
            case 'toggle': toggleOnce(part); break;
            case 'stick': beginStick(part, event); break;
            case 'slide': beginSlide(part, event); break;
            case 'dial': beginDial(part, event); break;
            default: break;
        }
    }

    function onPointerMove(event) {
        const part = active.get(event.pointerId);
        if (!part) return;
        event.preventDefault();
        switch (part.type) {
            case 'stick': moveStick(part, event); break;
            case 'slide': moveSlide(part, event); break;
            case 'dial': moveDial(part, event); break;
            default: break;
        }
    }

    function onPointerUp(event) {
        const part = active.get(event.pointerId);
        if (!part) return;
        active.delete(event.pointerId);
        finish(part);
    }

    function finish(part) {
        switch (part.type) {
            case 'press': endPress(part); break;
            case 'stick': endStick(part); break;
            case 'slide': endSlide(part); break;
            case 'dial': endDial(part); break;
            default: break;
        }
    }

    /** 全部松手(重扫 / 销毁前必须走一趟,否则 is-press 会永久留着) */
    function releaseAll() {
        for (const part of active.values()) finish(part);
        active.clear();
        for (const part of parts) stopHold(part);
    }

    // ---------- 落盘 ----------

    /**
     * ★ 防抖再往外抛。旋钮一次拖动能触发上百次 move,
     *   每次都 setState 的话 IndexedDB 会被打满。
     */
    function schedulePersist() {
        if (persistTimer) clearTimeout(persistTimer);
        persistTimer = setTimeout(() => {
            persistTimer = null;
            if (destroyed) return;
            onPersist(getValues());
        }, 200);
    }

    function getValues() {
        const out = {};
        for (const part of parts) {
            switch (part.type) {
                case 'press':
                    if (part.once && part.used) out[part.key] = { used: true };
                    break;
                case 'toggle':
                    if (part.on) out[part.key] = { on: true };
                    break;
                case 'slide':
                    out[part.key] = { x: part.x, y: part.y, scroll: part.scroll };
                    break;
                case 'dial':
                    out[part.key] = { deg: part.deg };
                    break;
                default:
                    break;
            }
        }
        return out;
    }

    // ---------- 对外 ----------

    /** 「恢复主体」:所有零件回到出厂状态 */
    function reset() {
        releaseAll();
        savedValues = {};
        for (const part of parts) {
            part.x = 0;
            part.y = 0;
            part.deg = 0;
            part.scroll = 0;
            part.on = false;
            part.used = false;
            part.pressed = false;
            part.tickIndex = null;
            part.tickPrimed = false;
            part.el.classList.remove('is-press', 'is-on', 'is-active', 'is-popped');
            paint(part);
        }
        onPersist({});
    }

    root.addEventListener('pointerdown', onPointerDown);
    /*
     * ★ move / up 挂在 window 而不是 root:
     *   摇杆经常被拖出底座甚至拖出板子,松手事件落在别人身上。
     *   setPointerCapture 大多数时候能兜住,但 iOS 上元素被 CSS 动画搬走时
     *   capture 会掉 —— 掉了就永远收不到 up,摇杆卡在拐角回不了中。
     *   window 这层是保底,靠 active 里有没有这个 pointerId 过滤,开销可以忽略。
     */
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    rescan();

    return {
        rescan,
        reset,
        getValues,
        /** 当前扫到了几个零件 —— 编辑页拿它提示「这段 HTML 一个能按的地方都没有」 */
        count: () => parts.length,
        destroy() {
            destroyed = true;
            releaseAll();
            if (persistTimer) {
                clearTimeout(persistTimer);
                persistTimer = null;
            }
            root.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerUp);
            parts = [];
        },
    };
}

/**
 * 数一段 HTML 里有几个合法零件。
 * 纯文本正则,不建 DOM —— 编辑页要在每次按键后跑,不能真解析一遍。
 */
export function countToyParts(html) {
    if (typeof html !== 'string' || !html) return 0;
    let n = 0;
    const re = /\bdata-hb\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
    let match = re.exec(html);
    while (match) {
        const value = String(match[1] ?? match[2] ?? match[3] ?? '').trim().toLowerCase();
        if (PART_TYPES.has(value)) n += 1;
        match = re.exec(html);
    }
    return n;
}
