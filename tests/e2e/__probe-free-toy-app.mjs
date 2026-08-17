/**
 * relax / 自由捏捏「从面板到舞台」整链路探针
 *
 * __probe-free-toy.mjs 单独测零件引擎;这里测的是**接线**:
 *   捏捏面板 → 编辑页 → 换做法 → 应用到主体 → 回舞台 → 真的能拖。
 * 中间任何一环没把 layout 串过去(编辑页、relax-root、toyState、主体、面板),
 * 表现都是「编辑页里好好的,放到舞台上还是格子板」。
 *
 * ★ 一律 waitFor 状态,不用 sleep 掐时间。
 *   这台机器上冷启动一次要一两分钟,写死的 600ms 会随机翻车,
 *   翻出来的还都是「元素找不到」这种看不出真因的失败。
 *
 * 用法(需要 npm run dev 起着):
 *   node tests/e2e/__probe-free-toy-app.mjs
 */
import { launch, openApp, check, section, report, sleep } from './__probe-kit.mjs';

/** 点一个带指定文字的元素,点不到就直接抛 —— 静默失败会把锅甩给后面的断言 */
async function mustClickText(page, selector, text) {
    const ok = await page.clickText(selector, text);
    if (!ok) throw new Error(`点不到「${text}」(${selector})`);
    await sleep(120);
}

/** 页面里有没有一个带指定文字的元素 */
const hasText = (selector, text) =>
    `[...document.querySelectorAll(${JSON.stringify(selector)})].some(e => e.textContent.includes(${JSON.stringify(text)}))`;

async function main() {
    const { page, close } = await launch({ port: 9413, prefix: 'freetoyapp', appsTimeout: 120000 });

    /** 按住 → 拖到某点 → 读一个自定义属性 → 松手 */
    async function dragAndRead(selector, dx, dy, varName) {
        const box = await page.evaluate(`
            (() => {
                const el = document.querySelector(${JSON.stringify(selector)});
                if (!el) return null;
                el.scrollIntoView({ block: 'center' });
                const r = el.getBoundingClientRect();
                return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width };
            })()
        `);
        if (!box) throw new Error(`量不到 ${selector}`);

        // ★ 先确认按下去的那一点上盖着的就是零件本身。
        //   抽屉 / tab 栏挡住的时候,指针事件会落在别人身上,
        //   表现是「变量一直是 0」—— 不点破的话会被当成引擎的锅查半天。
        const onTop = await page.evaluate(`
            !!document.elementFromPoint(${box.cx}, ${box.cy})?.closest?.(${JSON.stringify(selector.split(' ').pop())})
        `);
        if (!onTop) throw new Error(`${selector} 的中心被别的东西盖住了,点不到`);

        const to = { x: box.cx + box.w * dx, y: box.cy + box.w * dy };
        await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.cx, y: box.cy, button: 'left', buttons: 1, clickCount: 1 });
        await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: to.x, y: to.y, button: 'left', buttons: 1 });
        await sleep(90);
        const held = await page.evaluate(
            `Number(document.querySelector(${JSON.stringify(selector)}).style.getPropertyValue(${JSON.stringify(varName)}))`,
        );
        await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: to.x, y: to.y, button: 'left', buttons: 0, clickCount: 1 });
        await sleep(120);
        const released = await page.evaluate(
            `Number(document.querySelector(${JSON.stringify(selector)}).style.getPropertyValue(${JSON.stringify(varName)}))`,
        );
        return { box, held, released };
    }

    try {
        section('进解压角,把主体换成「我的捏捏」');
        await openApp(page, 'relax');

        await mustClickText(page, '[role="tab"]', '捏捏');
        await page.waitFor(`document.querySelector('.rx-panel-toy')`, { label: '捏捏面板' });
        check('捏捏面板打开了', true);

        await mustClickText(page, '.rx-tile', '我的捏捏');
        await page.waitFor(`document.querySelector('.htmlbubble-grid .htmlbubble-host')`, { label: '格子板上台' });
        check('主体上台,默认是格子板', true);
        check('格子模式下「板子规格」在',
            await page.evaluate(hasText('.rx-panel-toy .rx-section-title', '板子规格')));

        section('进编辑页,换成自由做法');
        await mustClickText(page, '.rx-panel-toy .rx-btn', '写 HTML');
        await page.waitFor(`document.querySelector('.rx-toypage-opt')`, { label: '编辑页' });

        await mustClickText(page, '.rx-toypage-opt', '自由做');
        await page.waitFor(`document.querySelector('.rx-toypage-preview-free .jz-base')`, { label: '自由预览里的摇杆' });

        check('模板列表换成自由那批', await page.evaluate(hasText('.rx-toypage-chip-name', '摇杆')));
        check('零件速查出现了', await page.exists('.rx-toypage-parts .rx-toypage-part-tag'));
        check('预览换成自由舞台', await page.exists('.rx-toypage-preview-free'));
        check('提示说扫到了零件', await page.evaluate(
            `[...document.querySelectorAll('.rx-toypage-tip')].some(e => /扫到 \\d+ 个零件/.test(e.textContent))`,
        ));

        section('编辑页里的预览是真能拖的');
        const preview = await dragAndRead('.rx-toypage-preview-free .jz-base', 0.4, 0, '--hb-x');
        check('预览摇杆量得到尺寸', preview.box.w > 40, `w=${Math.round(preview.box.w)}`);
        check('预览里摇杆跟手了', preview.held > 0.4, `--hb-x=${preview.held}`);
        check('预览里松手也回中', preview.released === 0, `--hb-x=${preview.released}`);

        section('应用到主体,回舞台');
        await mustClickText(page, '.rx-toypage-actions .rx-btn', '应用到主体');
        await sleep(400);
        check('没有报错提示', (await page.exists('.rx-toypage-msg.is-bad')) === false);

        await mustClickText(page, '.rx-toypage-back', '返回');
        await page.waitFor(`!document.querySelector('.rx-toypage')`, { label: '回到舞台' });
        await page.waitFor(`document.querySelector('.htmlbubble-root.is-free .hbfree-stage .jz-base')`, { label: '舞台上的摇杆' });
        check('舞台上是自由模式,摇杆画出来了', true);
        check('格子板已经撤掉', (await page.exists('.htmlbubble-grid')) === false);

        section('舞台上的摇杆能拖,面板跟着变');
        // 从编辑页回来时「捏捏」抽屉还开着,压着舞台下半截。
        // 真人这时会先点回舞台,探针也照做,否则按下去的是抽屉不是摇杆。
        await mustClickText(page, '[role="tab"]', '舞台');
        await page.waitFor(`!document.querySelector('.rx-root.is-panel-open')`, { label: '抽屉收起' });

        const stage = await dragAndRead('.hbfree-stage .jz-base', 0, 0.4, '--hb-y');
        check('舞台摇杆量得到尺寸', stage.box.w > 80, `w=${Math.round(stage.box.w)}`);
        check('舞台摇杆跟手了', stage.held > 0.4, `--hb-y=${stage.held}`);
        check('松手回中', stage.released === 0, `--hb-y=${stage.released}`);

        await mustClickText(page, '[role="tab"]', '捏捏');
        await page.waitFor(`document.querySelector('.rx-panel-toy')`, { label: '捏捏面板(第二次)' });
        check('自由模式下「板子规格」收起来了',
            (await page.evaluate(hasText('.rx-panel-toy .rx-section-title', '板子规格'))) === false);
        check('「自定义」那栏改了说明',
            await page.evaluate(hasText('.rx-panel-toy .rx-section-hint', '整块自己画')));

        section('「恢复主体」只清进度,不能把代码也清了');
        // ★ relax-root 是先 clearToyState(整张便签删掉)再让主体 reset 的,
        //   主体不把 html/css 写回去的话,当场看不出来 —— 要等下次重挂才发现
        //   自己写的手柄变回了默认模板。这里换个主体再换回来,强制走一次重挂。
        await mustClickText(page, '.rx-panel-toy .rx-btn', '恢复主体');
        await sleep(400);
        await mustClickText(page, '.rx-tile', '捏捏果冻');
        await page.waitFor(`!document.querySelector('.hbfree-stage')`, { label: '换成别的主体' });
        await mustClickText(page, '.rx-tile', '我的捏捏');
        await page.waitFor(`document.querySelector('.htmlbubble-root')`, { label: '换回我的捏捏' });
        await sleep(400);
        check('重挂之后还是自由模式', await page.exists('.htmlbubble-root.is-free'));
        check('自己写的摇杆没被恢复默认冲掉', await page.exists('.hbfree-stage .jz-base'));

        section('再切到「写代码」,沙箱要能上舞台');
        await mustClickText(page, '.rx-panel-toy .rx-btn', '写 HTML');
        await page.waitFor(`document.querySelector('.rx-toypage-opt')`, { label: '编辑页(写代码)' });
        await mustClickText(page, '.rx-toypage-opt', '写代码');
        await page.waitFor(`document.querySelector('.rx-toypage-preview-code iframe')`, { label: '沙箱预览' });
        check('预览里起了沙箱 iframe', true);
        check('iframe 只给了 allow-scripts', await page.evaluate(
            `document.querySelector('.rx-toypage-preview-code iframe').getAttribute('sandbox') === 'allow-scripts'`,
        ));
        check('多了一个 JS 编辑框', await page.exists('.rx-toypage-editor--js'));
        check('hb 速查出现了', await page.evaluate(hasText('.rx-toypage-block-title', 'hb 速查')));
        check('模板列表换成会写 JS 的那批', await page.evaluate(hasText('.rx-toypage-chip-name', '弹球')));

        await mustClickText(page, '.rx-toypage-actions .rx-btn', '应用到主体');
        await sleep(400);
        check('沙箱代码没被消毒拦下', (await page.exists('.rx-toypage-msg.is-bad')) === false);

        await mustClickText(page, '.rx-toypage-back', '返回');
        await page.waitFor(`document.querySelector('.htmlbubble-root.is-code .hbcode-stage iframe')`, { label: '舞台上的沙箱' });
        check('舞台换成了沙箱', true);
        check('自由舞台和格子板都撤了',
            (await page.exists('.hbfree-stage')) === false && (await page.exists('.htmlbubble-grid')) === false);
        check('舞台上的 iframe 也只给 allow-scripts', await page.evaluate(
            `document.querySelector('.hbcode-stage iframe').getAttribute('sandbox') === 'allow-scripts'`,
        ));
        check('外面读不进沙箱', await page.evaluate(
            `document.querySelector('.hbcode-stage iframe').contentDocument === null`,
        ));

        section('切回格子板,老玩法不能坏');
        await mustClickText(page, '[role="tab"]', '捏捏');
        await page.waitFor(`document.querySelector('.rx-panel-toy')`, { label: '捏捏面板(第三次)' });
        await mustClickText(page, '.rx-panel-toy .rx-btn', '写 HTML');
        await page.waitFor(`document.querySelector('.rx-toypage-opt')`, { label: '编辑页(第三次)' });
        check('重进编辑页记得上次是写代码', await page.evaluate(
            `[...document.querySelectorAll('.rx-toypage-opt')].find(e => e.textContent.includes('写代码'))?.classList.contains('is-on') === true`,
        ));

        await mustClickText(page, '.rx-toypage-opt', '格子板');
        await page.waitFor(`document.querySelector('.rx-toypage-preview-board .htmlbubble-host')`, { label: '格子预览' });
        check('切回来预览变回格子', true);

        await mustClickText(page, '.rx-toypage-actions .rx-btn', '应用到主体');
        await sleep(400);
        await mustClickText(page, '.rx-toypage-back', '返回');
        await page.waitFor(`document.querySelector('.htmlbubble-grid .htmlbubble-host')`, { label: '舞台恢复格子板' });
        check('舞台恢复成格子板', true);
        check('自由舞台撤干净了', (await page.exists('.hbfree-stage')) === false);

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
