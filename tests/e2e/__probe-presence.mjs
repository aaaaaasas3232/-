/**
 * 「灵动岛与小组件」总览页体检：
 *   - 中号 / 大号小组件预览区尺寸和真机一致（以前高度只有一半，内容被裁）
 *   - 通知提示分区能列出、能开关、能试弹
 */
import { launch, openApp, check, section, report, sleep } from './__probe-kit.mjs';

async function run() {
    const { page, close } = await launch({ port: 9413, prefix: 'pc-probe' });

    try {
        await openApp(page, 'music', { settleMs: 1500 });

        section('打开总览页');
        await page.evaluate(`window.openAppPresenceCenter('music')`);
        await sleep(900);
        check('面板打开了', await page.exists('#app-presence-center .pc-panel'));

        section('小组件预览尺寸');
        const stages = await page.evaluate(`
            (() => {
                return [...document.querySelectorAll('#app-presence-center .pc-widget-shell')].map(el => {
                    const r = el.getBoundingClientRect();
                    const inner = el.firstElementChild;
                    const ir = inner ? inner.getBoundingClientRect() : null;
                    return {
                        size: el.getAttribute('data-size'),
                        w: Math.round(r.width), h: Math.round(r.height),
                        // 内容是否被裁：内容实际高度大于容器
                        overflow: el.scrollHeight > el.clientHeight + 2,
                        innerH: ir ? Math.round(ir.height) : 0,
                    };
                });
            })()
        `);
        check('三档都画出来了', stages.length === 3, stages.map(s => s.size).join(','));
        const expect = { S: [132, 56], M: [132, 150], L: [284, 154] };
        for (const s of stages) {
            const [w, h] = expect[s.size] || [];
            check(`${s.size} 尺寸和真机一致`, s.w === w && s.h === h, `${s.w}×${s.h}，应为 ${w}×${h}`);
            check(`${s.size} 内容没被裁`, !s.overflow, s.overflow ? `scrollH>clientH` : '');
        }
        await page.screenshot('01-widgets');

        section('通知提示分区');
        const notify = await page.evaluate(`
            (() => {
                const cards = [...document.querySelectorAll('#app-presence-center [data-pc-notify]')];
                return {
                    n: cards.length,
                    ids: cards.map(c => c.getAttribute('data-pc-notify')),
                    hasWhen: cards.every(c => !!c.querySelector('.pc-when__text')),
                    hasPreview: cards.every(c => !!c.querySelector('.pc-notify-preview')),
                    hasTry: cards.every(c => !!c.querySelector('[data-pc-action="try-notify"]')),
                };
            })()
        `);
        check('列出了通知类型', notify.n >= 5, `${notify.n} 条：${notify.ids.join(', ')}`);
        check('每条都写了出现时机', notify.hasWhen);
        check('每条都有预览', notify.hasPreview);
        check('每条都能试弹', notify.hasTry);
        await page.screenshot('02-notify');

        section('通知开关真的拦得住');
        await page.click('#app-presence-center [data-pc-notify="playlist"] [data-pc-action="toggle-notify"]');
        await sleep(400);
        const off = await page.evaluate(`window.__appPresence.isNotifyKindEnabled('music','playlist')`);
        check('关掉后偏好写进去了', off === false, String(off));
        const blocked = await page.evaluate(`
            (() => {
                window.myDynamicIsland?.dismiss?.();
                const app = (window.__phoneAppsRef?.value || []).find(a => a.id === 'music');
                app.toolkit.island.notify('success', '已创建', '探针', { kind: 'playlist' });
                return window.myDynamicIsland?.getState?.()?.mode || 'idle';
            })()
        `);
        check('★ 关掉之后这类通知弹不出来', blocked === 'idle', blocked);
        const allowed = await page.evaluate(`
            (() => {
                const app = (window.__phoneAppsRef?.value || []).find(a => a.id === 'music');
                app.toolkit.island.notify('success', '已保存', '探针', { kind: 'lyrics' });
                return window.myDynamicIsland?.getState?.()?.mode || 'idle';
            })()
        `);
        check('没关的那类照常弹', allowed === 'notification', allowed);
        // 还原
        await page.click('#app-presence-center [data-pc-notify="playlist"] [data-pc-action="toggle-notify"]');

        section('控制台');
        const errs = page.errors();
        check('没有 JS 报错', errs.length === 0, errs.slice(0, 3).join(' | '));
    } catch (err) {
        console.error('\n探针崩了：', err.message);
        check('探针跑完', false, err.message);
        try { await page.screenshot('99-crash'); } catch (_) { /* noop */ }
    } finally {
        await close();
    }

    process.exit(report() ? 0 : 1);
}

run();
