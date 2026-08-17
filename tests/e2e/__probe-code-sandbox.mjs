/**
 * relax / 「写代码」模式的沙箱探针
 *
 * 这一档是整个功能里唯一一处**故意执行用户代码**的地方,所以要证明两件事:
 *   A. 它真的跑得起来 —— 事件进得去、hb 桥出得来、存档能过夜
 *   B. 它真的关得住 —— 读不到父页面、读不到 localStorage、上不了网
 * B 组比 A 组重要:A 组坏了是功能不好用,B 组坏了是把用户的聊天记录
 * 交给了一段从聊天框里粘进来的代码。
 *
 * ★ 断言只能从「桥」这一侧看。父页面读不进不透明源的 iframe
 *   (这本身就是第一条断言),所以沙箱里的结论一律靠 hb.notify 报出来。
 *
 * 用法(需要 npm run dev 起着):node tests/e2e/__probe-code-sandbox.mjs
 */
import { launch, check, section, report, sleep, BASE } from './__probe-kit.mjs';

const FIXTURE = `${BASE}/tests/e2e/__fixture-free-toy.html`;

async function main() {
    const { page, close } = await launch({
        port: 9421,
        prefix: 'codebox',
        url: FIXTURE,
        waitApps: false,
        width: 520,
        height: 900,
    });

    /** 读页面里的一个值。★ 一律兜成 null —— 直接 JSON.parse(undefined) 会把整个探针崩掉 */
    const read = (expr) => page.evaluate(`JSON.stringify((${expr}) ?? null)`).then(JSON.parse);

    /** 挂一段代码,等它把话说完 */
    async function run(js, { html = '<div id="t"></div>', css = '', wait = 700 } = {}) {
        await page.evaluate(
            `window.__mountSandbox(${JSON.stringify(html)}, ${JSON.stringify(css)}, ${JSON.stringify(js)})`,
        );
        await sleep(wait);
        return {
            notes: (await read('window.__notes')) || [],
            sounds: (await read('window.__sounds')) || [],
            haptics: (await read('window.__haptics')) || [],
            errors: (await read('window.__errors')) || [],
            persisted: await read('window.__persisted'),
        };
    }

    /** 沙箱里报回来的那句话(约定用 hb.notify 的 message 当返回值) */
    const said = (out, title) => (out.notes.find(n => n.title === title) || {}).message ?? null;

    /** 当前捕获到的某条 notify(用于 run 之后又发生了事情的场景) */
    const laterNote = (title) => read(
        `((window.__notes || []).find(function (n) { return n.title === ${JSON.stringify(title)}; }) || {}).message`,
    );

    try {
        await page.waitFor('window.__ready === true', { label: '靶子页就绪' });

        // ════════ B 组:关得住吗 ════════
        section('隔离 —— 沙箱关不关得住');

        await run('hb.notify("hi", "ok");');
        const peek = await page.evaluate('window.__canPeekIntoFrame()');
        check('父页面读不进 iframe(不透明源)', peek === 'null' || peek.startsWith('THROWS'), `contentDocument = ${peek}`);

        const parentOut = await run(`
            var r;
            try { r = 'READABLE:' + String(parent.document.title); }
            catch (e) { r = 'BLOCKED:' + e.name; }
            hb.notify('parent', r);
        `);
        check('沙箱读不到 parent.document', String(said(parentOut, 'parent')).startsWith('BLOCKED'),
            said(parentOut, 'parent'));

        const lsOut = await run(`
            var r;
            try { localStorage.setItem('hb-probe', '1'); r = 'WRITABLE'; }
            catch (e) { r = 'BLOCKED:' + e.name; }
            hb.notify('ls', r);
        `);
        check('沙箱碰不到 localStorage', String(said(lsOut, 'ls')).startsWith('BLOCKED'), said(lsOut, 'ls'));

        // ★ 光看 indexedDB 这个对象在不在没意义 —— 它在,但一 open 就会被拦。
        //   要真的开一次库才算测到。
        const idbOut = await run(`
            try {
                var req = indexedDB.open('hb-probe-should-fail');
                req.onsuccess = function () { hb.notify('idb', 'OPENED'); };
                req.onerror = function () { hb.notify('idb', 'ERROR'); };
            } catch (e) {
                hb.notify('idb', 'BLOCKED:' + e.name);
            }
        `, { wait: 1200 });
        check('沙箱开不了 IndexedDB', said(idbOut, 'idb') !== 'OPENED', String(said(idbOut, 'idb')));

        const netOut = await run(`
            fetch('https://example.com/x')
                .then(function () { hb.notify('net', 'OPEN'); })
                .catch(function (e) { hb.notify('net', 'BLOCKED:' + e.name); });
        `, { wait: 1200 });
        check('CSP 把网络掐死了', String(said(netOut, 'net')).startsWith('BLOCKED'), said(netOut, 'net'));

        const originOut = await run(`hb.notify('origin', String(location.origin));`);
        check('沙箱的源是 null(和小听不同源)', said(originOut, 'origin') === 'null', said(originOut, 'origin'));

        // ════════ A 组:跑得起来吗 ════════
        section('运行 —— hb 桥通不通');

        const soundOut = await run(`
            hb.sound({ rate: 1.4 });
            hb.haptic('medium');
            hb.notify('size', hb.width + 'x' + hb.height);
        `);
        check('hb.sound 传到父页面', soundOut.sounds.length === 1, `${soundOut.sounds.length} 声`);
        check('hb.haptic 传到父页面', soundOut.haptics.includes('medium'), soundOut.haptics.join(','));
        check('hb.notify 传到父页面', !!said(soundOut, 'size'), String(said(soundOut, 'size')));
        // ★ 用户代码第一行就常写 hb.width/2,这里量到 0 就说明布局还没好就开跑了
        check('hb.width / hb.height 是真尺寸(不是 0)',
            /^[1-9]\d*x[1-9]\d*$/.test(String(said(soundOut, 'size'))), String(said(soundOut, 'size')));

        const floodOut = await run(`
            for (var i = 0; i < 200; i += 1) hb.sound({ rate: 1 });
        `);
        check('出声有限流,刷不爆', floodOut.sounds.length > 0 && floodOut.sounds.length <= 26,
            `放行了 ${floodOut.sounds.length} 声`);

        const errOut = await run(`nope.boom();`);
        check('沙箱里的报错送得回来', errOut.errors.length > 0, errOut.errors[0]);

        const syntaxOut = await run(`function ( {`);
        check('语法错也送得回来', syntaxOut.errors.length > 0, syntaxOut.errors[0]);

        section('存档 —— 存得进也读得回');

        await page.evaluate('window.__seedState = {}; true');
        const saveOut = await run(`hb.notify('seen', String(hb.state.n || 0)); hb.save({ n: 7 });`);
        check('第一次进来 hb.state 是空的', said(saveOut, 'seen') === '0', String(said(saveOut, 'seen')));
        check('hb.save 落到父页面', !!saveOut.persisted && saveOut.persisted.n === 7, JSON.stringify(saveOut.persisted));

        // 把上一轮存的东西当成「存档」再挂一次
        await page.evaluate('window.__seedState = { n: 7 }; true');
        const reloadOut = await run(`hb.notify('seen', String(hb.state.n || 0));`);
        check('重新挂载能读回存档', said(reloadOut, 'seen') === '7', String(said(reloadOut, 'seen')));
        await page.evaluate('window.__seedState = {}; true');

        section('换色 / 复位');

        await run(`hb.on('tint', function (c) { hb.notify('tint', c); });`);
        await page.evaluate(`window.__sandbox.setTint('#00ff88'); true`);
        await sleep(500);
        check('换主题色能推进沙箱', (await laterNote('tint')) === '#00ff88', String(await laterNote('tint')));

        // ★ 代码本身**不能**再存一次 —— 那样 reset 之后重跑会立刻把值写回来,
        //   看起来就像「清了个寂寞」。带着存档进去,只汇报读到了什么。
        await page.evaluate('window.__seedState = { k: 1 }; true');
        const beforeReset = await run(`hb.notify('boot', String(hb.state.k || 0));`);
        check('带着存档进去能读到', said(beforeReset, 'boot') === '1', String(said(beforeReset, 'boot')));

        await page.evaluate('window.__seedState = {}; window.__notes.length = 0; true');
        await page.evaluate('window.__sandbox.reset(); true');
        await sleep(900);
        check('reset 之后存档清空并重跑', (await laterNote('boot')) === '0', String(await laterNote('boot')));

        section('三套内置预设');

        for (const [id, name] of [['ball', '弹球'], ['doodle', '涂鸦板'], ['spark', '烟花']]) {
            await page.evaluate(`window.__mountCodePreset(${JSON.stringify(id)})`);
            await sleep(900);
            const errs = (await read('window.__errors')) || [];
            check(`${name} 跑起来没报错`, errs.length === 0, errs[0] || '');

            // 在 iframe 上按一下,看代码有没有真的收到指针
            const box = await read('window.__frameBox()');
            check(`${name} 的画布量得到尺寸`, !!box && box.w > 100, `${Math.round(box?.w)}×${Math.round(box?.h)}`);

            await page.evaluate('window.__haptics.length = 0; window.__sounds.length = 0; true');
            await page.send('Input.dispatchMouseEvent', {
                type: 'mousePressed', x: box.cx, y: box.cy, button: 'left', buttons: 1, clickCount: 1,
            });
            await page.send('Input.dispatchMouseEvent', {
                type: 'mouseMoved', x: box.cx + box.w * 0.2, y: box.cy + box.h * 0.15, button: 'left', buttons: 1,
            });
            await sleep(220);
            await page.send('Input.dispatchMouseEvent', {
                type: 'mouseReleased', x: box.cx + box.w * 0.2, y: box.cy + box.h * 0.15, button: 'left', buttons: 0, clickCount: 1,
            });
            await sleep(500);

            const felt = await page.evaluate('window.__haptics.length + window.__sounds.length');
            check(`${name} 收得到手指`, felt > 0, `${felt} 次反馈`);
            console.log(`     图:${(await page.screenshot(`code-${id}`)).split(/[\\/]/).pop()}`);
        }

        // 涂鸦板画完要能存下来
        await page.evaluate(`window.__mountCodePreset('doodle')`);
        await sleep(800);
        const dbox = await read('window.__frameBox()');
        await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: dbox.x + dbox.w * 0.3, y: dbox.y + dbox.h * 0.3, button: 'left', buttons: 1, clickCount: 1 });
        for (let i = 1; i <= 6; i += 1) {
            await page.send('Input.dispatchMouseEvent', {
                type: 'mouseMoved',
                x: dbox.x + dbox.w * (0.3 + i * 0.06),
                y: dbox.y + dbox.h * (0.3 + i * 0.05),
                button: 'left', buttons: 1,
            });
            await sleep(30);
        }
        await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: dbox.x + dbox.w * 0.66, y: dbox.y + dbox.h * 0.6, button: 'left', buttons: 0, clickCount: 1 });
        await sleep(500);
        const strokes = await read('(window.__persisted && window.__persisted.strokes || []).length');
        check('涂鸦板把笔画存下来了', strokes > 0, `${strokes} 笔`);

        const errors = page.errors();
        // 沙箱被 CSP 拦下的请求会在父页面控制台留一行,那是**预期**的
        const real = errors.filter(l => !/Content Security Policy|Refused to connect|ERR_BLOCKED/i.test(l));
        check('宿主页面没有意料之外的报错', real.length === 0, real.slice(0, 3).join(' | '));
    } finally {
        await close();
    }

    process.exit(report() ? 0 : 1);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
