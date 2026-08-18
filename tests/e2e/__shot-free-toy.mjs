/**
 * 给「自由做」和「写代码」的每套内置预设各拍一张 ——
 * 改完 CSS 之后肉眼过一遍,比读代码快。图落在 tests/e2e/freeshot-*.png。
 *
 * 用法(需要 npm run dev 起着):node tests/e2e/__shot-free-toy.mjs
 */
import { launch, openApp, sleep } from './__probe-kit.mjs';

const PLAN = [
    { layout: '自由做', presets: ['摇杆', '鼠标', '旋钮', '开关板'], ready: '.rx-toypage-preview-free' },
    { layout: '写代码', presets: ['弹球', '涂鸦板', '烟花'], ready: '.rx-toypage-preview-code iframe' },
];

const { page, close } = await launch({ port: 9415, prefix: 'freeshot', appsTimeout: 120000 });

/** 从舞台进编辑页 */
async function openEditor() {
    await page.clickText('[role="tab"]', '捏捏');
    await page.waitFor(`document.querySelector('.rx-panel-toy')`);
    await page.clickText('.rx-panel-toy .rx-btn', '写 HTML');
    await page.waitFor(`document.querySelector('.rx-toypage-opt')`);
}

try {
    await openApp(page, 'relax');
    await page.clickText('[role="tab"]', '捏捏');
    await page.waitFor(`document.querySelector('.rx-panel-toy')`);
    await page.clickText('.rx-tile', '我的捏捏');
    await page.waitFor(`document.querySelector('.htmlbubble-grid')`);

    for (const group of PLAN) {
        await openEditor();
        await page.clickText('.rx-toypage-opt', group.layout);
        await page.waitFor(`document.querySelector('${group.ready}')`);
        console.log(`编辑页(${group.layout}):`, await page.screenshot(`editor-${group.layout}`));

        for (const name of group.presets) {
            await page.clickText('.rx-toypage-chip-name', name);
            await sleep(900);
            await page.clickText('.rx-toypage-actions .rx-btn', '应用到主体');
            await sleep(400);
            await page.clickText('.rx-toypage-back', '返回');
            await page.waitFor(`!document.querySelector('.rx-toypage')`);
            await page.clickText('[role="tab"]', '舞台');
            await sleep(1100);
            console.log(`${name}:`, await page.screenshot(`stage-${name}`));

            if (name === group.presets[group.presets.length - 1]) break;
            await openEditor();
        }
    }
} finally {
    await close();
}
