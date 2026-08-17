/**
 * relax / 自由捏捏「零件引擎」端到端探针
 *
 * 纯逻辑那半边由 tests/regression/__probe-relax-free-toy.mjs 管;
 * 这里管的是**指针真的进得去、CSS 变量真的出得来**:
 * 摇杆拖不拖得动、松手回不回中、滚轮绕不绕圈、旋钮限不限位。
 * 这些全靠 getBoundingClientRect + pointer capture,离开真浏览器测不了。
 *
 * 事件走 CDP 的 Input.dispatchMouseEvent —— 浏览器自己合成 pointerdown/move/up,
 * 和手指按下去走的是同一条路径,不是 JS 里 new PointerEvent 糊出来的。
 *
 * 用法(需要 npm run dev 起着):
 *   node tests/e2e/__probe-free-toy.mjs
 */
import { launch, check, section, report, sleep, BASE } from './__probe-kit.mjs';

const FIXTURE = `${BASE}/tests/e2e/__fixture-free-toy.html`;

/** 近似相等 —— 归一化坐标算出来是浮点,不能用 === */
const near = (a, b, tol = 0.08) => typeof a === 'number' && Math.abs(a - b) <= tol;

async function main() {
    const { page, close } = await launch({
        port: 9412,
        prefix: 'freetoy',
        url: FIXTURE,
        waitApps: false,
        width: 520,
        height: 900,
    });

    /** 把鼠标按在 (x,y),拖到若干个点,再松手 */
    async function drag(from, points, { release = true } = {}) {
        await page.send('Input.dispatchMouseEvent', {
            type: 'mousePressed', x: from.x, y: from.y, button: 'left', buttons: 1, clickCount: 1,
        });
        for (const p of points) {
            await page.send('Input.dispatchMouseEvent', {
                type: 'mouseMoved', x: p.x, y: p.y, button: 'left', buttons: 1,
            });
            await sleep(16);
        }
        if (release) {
            const last = points[points.length - 1] || from;
            await page.send('Input.dispatchMouseEvent', {
                type: 'mouseReleased', x: last.x, y: last.y, button: 'left', buttons: 0, clickCount: 1,
            });
        }
        await sleep(40);
    }

    async function tap(x, y) {
        await drag({ x, y }, [{ x, y }]);
    }

    try {
        await page.waitFor('window.__ready === true', { label: '靶子页就绪' });

        // ── 摇杆 ────────────────────────────────────────
        section('摇杆 data-hb="stick"');
        const stickCount = await page.evaluate(`window.__loadPreset('joystick')`);
        check('扫到 1 个零件', stickCount === 1, `count=${stickCount}`);

        const base = await page.evaluate('window.__box(".jz-base")');
        check('底座有实际尺寸', base && base.w > 100, `${base?.w}×${base?.h}`);

        // 从中心拖到右边缘外面 —— 应该被夹在单位圆上(x≈1, y≈0)
        await drag(
            { x: base.cx, y: base.cy },
            [{ x: base.cx + base.w * 0.3, y: base.cy }, { x: base.cx + base.w * 2, y: base.cy }],
            { release: false },
        );
        const hx = await page.evaluate('window.__varOf(".jz-base", "--hb-x")');
        const hy = await page.evaluate('window.__varOf(".jz-base", "--hb-y")');
        const dist = await page.evaluate('window.__varOf(".jz-base", "--hb-dist")');
        check('往右拖到底 --hb-x ≈ 1', near(hx, 1), `x=${hx}`);
        check('没跑偏 --hb-y ≈ 0', near(hy, 0), `y=${hy}`);
        check('--hb-dist 被夹在 1', near(dist, 1), `dist=${dist}`);

        const active = await page.evaluate('window.__hasClass(".jz-base", "is-active")');
        check('拖动中带 is-active', active === true);

        // 对角线拖出去也不能超出单位圆(否则斜着能拖到 1.41)
        await page.send('Input.dispatchMouseEvent', {
            type: 'mouseMoved', x: base.cx + base.w * 2, y: base.cy + base.h * 2, button: 'left', buttons: 1,
        });
        await sleep(30);
        const dx = await page.evaluate('window.__varOf(".jz-base", "--hb-x")');
        const dy = await page.evaluate('window.__varOf(".jz-base", "--hb-y")');
        const len = Math.hypot(dx, dy);
        check('斜着拖也被归一化到单位圆内', near(len, 1, 0.02), `|v|=${len.toFixed(3)}`);

        // 帽子真的跟着搬了(说明预设的 CSS 确实读到了变量)
        const shift = await page.evaluate('window.__shiftOf(".jz-knob")');
        check('帽子跟着位移了', shift && shift.x > 20 && shift.y > 20, JSON.stringify(shift));

        // 拖出底座之外松手,靠 pointer capture / window 兜底也要收得到
        await page.send('Input.dispatchMouseEvent', {
            type: 'mouseReleased', x: base.cx + base.w * 2, y: base.cy + base.h * 2, button: 'left', buttons: 0, clickCount: 1,
        });
        await sleep(60);
        const restX = await page.evaluate('window.__varOf(".jz-base", "--hb-x")');
        const restY = await page.evaluate('window.__varOf(".jz-base", "--hb-y")');
        const stillActive = await page.evaluate('window.__hasClass(".jz-base", "is-active")');
        check('松手回中 x=0', near(restX, 0, 0.001), `x=${restX}`);
        check('松手回中 y=0', near(restY, 0, 0.001), `y=${restY}`);
        check('松手摘掉 is-active', stillActive === false);

        const mirrorX = await page.evaluate('window.__mirror("--hb-stick-x")');
        check('整块上有镜像变量 --hb-stick-x', mirrorX !== null, `=${mirrorX}`);

        const stickSounds = await page.evaluate('window.__sounds.length');
        check('八方向 data-step 出了咔哒声', stickSounds >= 2, `${stickSounds} 次`);

        // 回中之后再推出去,第一下**必须**有声 —— 那次 tickIndex 也是从 null 起,
        // 早期版本连它一起吞了,表现是「推回中间再推出去就哑了」
        await page.evaluate('window.__sounds.length = 0');
        await drag(
            { x: base.cx, y: base.cy },
            [{ x: base.cx, y: base.cy }, { x: base.cx - base.w * 0.45, y: base.cy }],
            { release: false },
        );
        const rePush = await page.evaluate('window.__sounds.length');
        check('从中心推出去的第一下有声', rePush >= 2, `${rePush} 次(抓握 + 方向)`);
        await page.send('Input.dispatchMouseEvent', {
            type: 'mouseReleased', x: base.cx - base.w * 0.45, y: base.cy, button: 'left', buttons: 0, clickCount: 1,
        });
        await sleep(40);

        // ── 鼠标 ────────────────────────────────────────
        section('鼠标 data-hb="press" + "slide"');
        const mouseCount = await page.evaluate(`window.__loadPreset('mouse')`);
        check('扫到 3 个零件(左键/右键/滚轮)', mouseCount === 3, `count=${mouseCount}`);

        const left = await page.evaluate('window.__box(".ms-btn-l")');
        await page.send('Input.dispatchMouseEvent', {
            type: 'mousePressed', x: left.cx, y: left.cy, button: 'left', buttons: 1, clickCount: 1,
        });
        await sleep(40);
        check('左键按住带 is-press', await page.evaluate('window.__hasClass(".ms-btn-l", "is-press")'));
        check('左键 --hb-p = 1', (await page.evaluate('window.__varOf(".ms-btn-l", "--hb-p")')) === 1);
        check('右键没被连带按下', (await page.evaluate('window.__hasClass(".ms-btn-r", "is-press")')) === false);
        check('指示灯读得到镜像 --hb-left', (await page.evaluate('window.__mirror("--hb-left")')) === 1);

        await page.send('Input.dispatchMouseEvent', {
            type: 'mouseReleased', x: left.cx, y: left.cy, button: 'left', buttons: 0, clickCount: 1,
        });
        await sleep(40);
        check('松手摘掉 is-press', (await page.evaluate('window.__hasClass(".ms-btn-l", "is-press")')) === false);
        check('data-release 松手补了一声', (await page.evaluate('window.__sounds.length')) >= 2);

        // 滚轮:data-wrap 之后值应该绕回 0~1 之间,--hb-scroll 继续累加
        const wheel = await page.evaluate('window.__box(".ms-wheel")');
        await drag(
            { x: wheel.cx, y: wheel.cy },
            [
                { x: wheel.cx, y: wheel.cy + wheel.h * 2 },
                { x: wheel.cx, y: wheel.cy + wheel.h * 6 },
                { x: wheel.cx, y: wheel.cy + wheel.h * 12 },
            ],
        );
        const wy = await page.evaluate('window.__varOf(".ms-wheel", "--hb-y")');
        const scroll = await page.evaluate('window.__varOf(".ms-wheel", "--hb-scroll")');
        check('滚轮 --hb-y 绕回 0~1 之间', wy !== null && wy >= 0 && wy <= 1, `y=${wy}`);
        check('--hb-scroll 累计超过 1(没被夹住)', scroll > 1, `scroll=${scroll}`);
        // 落盘是防抖 200ms 的(一次拖动能触发上百次 move,每次都写就把 IndexedDB 打满了)
        await sleep(280);
        check('滚轮值落盘了', await page.evaluate('!!(window.__persisted && window.__persisted.wheel)'));

        // ── 旋钮 ────────────────────────────────────────
        section('旋钮 data-hb="dial"');
        const dialCount = await page.evaluate(`window.__loadPreset('dial')`);
        check('扫到 1 个零件', dialCount === 1, `count=${dialCount}`);

        const knob = await page.evaluate('window.__box(".dl-knob")');
        const r = knob.w * 0.35;
        // 从正上方顺时针扫到正右方 ≈ +90°
        await drag(
            { x: knob.cx, y: knob.cy - r },
            [
                { x: knob.cx + r * 0.7, y: knob.cy - r * 0.7 },
                { x: knob.cx + r, y: knob.cy },
            ],
        );
        const deg = await page.evaluate('window.__varOf(".dl-knob", "--hb-deg")');
        check('顺时针转出正角度 ≈ 90', deg > 60 && deg < 120, `deg=${deg}`);
        check('--hb-turn 跟着算', near(await page.evaluate('window.__varOf(".dl-knob", "--hb-turn")'), deg / 360, 0.01));

        // 继续往下转,应该被 data-max="150" 卡住
        await drag(
            { x: knob.cx + r, y: knob.cy },
            [
                { x: knob.cx, y: knob.cy + r },
                { x: knob.cx - r, y: knob.cy },
                { x: knob.cx, y: knob.cy - r },
                { x: knob.cx + r, y: knob.cy },
            ],
        );
        const capped = await page.evaluate('window.__varOf(".dl-knob", "--hb-deg")');
        check('data-max 限位生效(<= 150)', capped <= 150.001, `deg=${capped}`);
        // 落盘防抖 200ms(理由同滚轮那条)
        await sleep(280);
        check('旋钮角度落盘了', await page.evaluate('!!(window.__persisted && window.__persisted.vol)'));

        // ── 开关板 ──────────────────────────────────────
        section('开关板 data-hb="toggle" + press[data-hold]');
        const swCount = await page.evaluate(`window.__loadPreset('switchbox')`);
        check('扫到 5 个零件(3 拨杆 + 推子 + 大按钮)', swCount === 5, `count=${swCount}`);

        const swA = await page.evaluate('window.__box(".sw-toggle")');
        await tap(swA.cx, swA.cy);
        check('点一下拨上去 is-on', await page.evaluate('window.__hasClass(".sw-toggle", "is-on")'));
        check('--hb-a 镜像到整块', (await page.evaluate('window.__mirror("--hb-a")')) === 1);
        await sleep(260);
        check('开关状态落盘了', await page.evaluate('!!(window.__persisted && window.__persisted.a && window.__persisted.a.on)'));

        await tap(swA.cx, swA.cy);
        check('再点一下拨回来', (await page.evaluate('window.__hasClass(".sw-toggle", "is-on")')) === false);

        // 按住大按钮不放:data-hold 应该持续补声音
        const big = await page.evaluate('window.__box(".sw-big")');
        await page.evaluate('window.__sounds.length = 0');
        await page.send('Input.dispatchMouseEvent', {
            type: 'mousePressed', x: big.cx, y: big.cy, button: 'left', buttons: 1, clickCount: 1,
        });
        await sleep(700);
        const holdSounds = await page.evaluate('window.__sounds.length');
        await page.send('Input.dispatchMouseEvent', {
            type: 'mouseReleased', x: big.cx, y: big.cy, button: 'left', buttons: 0, clickCount: 1,
        });
        check('data-hold 按住期间一直响', holdSounds >= 3, `${holdSounds} 次`);
        await sleep(500);
        const afterRelease = await page.evaluate('window.__sounds.length');
        check('松手之后停下来了', afterRelease === holdSounds, `${holdSounds} → ${afterRelease}`);
        check('data-heavy 震动是 medium', await page.evaluate('window.__haptics.includes("medium")'));

        // ── 复位 / 销毁 ─────────────────────────────────
        section('复位与清理');
        await tap(swA.cx, swA.cy);
        await page.evaluate('window.__parts.reset()');
        check('reset 之后 is-on 全清', (await page.evaluate('window.__hasClass(".sw-toggle", "is-on")')) === false);
        check('reset 之后值也清空', await page.evaluate('JSON.stringify(window.__persisted) === "{}"'));

        await page.evaluate('window.__parts.destroy()');
        await tap(swA.cx, swA.cy);
        check('destroy 之后不再响应指针', (await page.evaluate('window.__hasClass(".sw-toggle", "is-on")')) === false);

        const errors = page.errors();
        check('整场没有控制台报错', errors.length === 0, errors.slice(0, 3).join(' | '));
    } finally {
        await close();
    }

    process.exit(report() ? 0 : 1);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
