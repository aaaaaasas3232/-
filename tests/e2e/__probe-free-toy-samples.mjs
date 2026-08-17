/**
 * 验「自由捏捏-示例代码.txt」里的每一段都真能跑
 *
 * 手写在文档里的代码是最容易烂的:改了引擎、改了变量名,
 * 文档里那份还是老写法,用户照着贴进去发现不动,只会觉得功能是坏的。
 * 这个探针把 txt 当成用户的输入走一遍:
 *   splitAiReply 拆(和「把 AI 的回复贴回来」同一个函数)
 *   → 消毒 → 塞进真浏览器 → 数零件 → 真拖一下 → 顺手拍张图
 *
 * 用法(需要 npm run dev 起着):node tests/e2e/__probe-free-toy-samples.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { launch, check, section, report, sleep, ROOT } from './__probe-kit.mjs';
import { splitAiReply } from '../../js/apps/relax-app/services/toy-prompt.js';
import { sanitizeToyTemplate } from '../../js/apps/relax-app/services/toy-sanitizer.js';

const DOC = path.join(ROOT, '..', '..', '自由捏捏-示例代码.txt');

/**
 * 按「例 N ·」的分隔线把文档切成一段一段。
 * 标题里的〔自由做〕/〔写代码〕决定这一段按哪种做法验。
 */
function readSamples() {
    const text = fs.readFileSync(DOC, 'utf8');
    const chunks = text.split(/^═{10,}$/m);
    const samples = [];
    for (let i = 0; i < chunks.length; i += 1) {
        const title = /^\s*(例 \d+ · .+)$/m.exec(chunks[i]);
        if (!title) continue;
        // 标题在分隔块里,代码在紧跟着的下一块
        const body = chunks[i + 1] || '';
        if (!body.includes('```')) continue;
        samples.push({
            name: title[1].trim(),
            layout: title[1].includes('写代码') ? 'code' : 'free',
            body,
        });
    }
    return samples;
}

async function main() {
    const samples = readSamples();
    console.log(`从 ${path.basename(DOC)} 里读到 ${samples.length} 段示例`);
    if (!samples.length) throw new Error('一段都没读到,分隔格式可能改了');

    const { page, close } = await launch({
        port: 9416,
        prefix: 'freesample',
        url: `http://localhost:5173/tests/e2e/__fixture-free-toy.html`,
        waitApps: false,
        width: 520,
        height: 900,
    });

    try {
        await page.waitFor('window.__ready === true', { label: '靶子页就绪' });

        for (const sample of samples) {
            section(`${sample.name}`);

            // 1) 走用户真正会走的那条路:整段粘贴 → 自动拆
            const split = splitAiReply(sample.body, { layout: sample.layout });
            check('能被「拆开填进编辑器」拆出来', split.ok, split.reason);
            if (!split.ok) continue;

            // 2) 走消毒 + 体检,不能有 error,也不能被删东西
            const clean = sanitizeToyTemplate(split.html, split.css, { layout: sample.layout, js: split.js });
            check('过消毒体检', clean.ok, clean.errors.join(' | '));
            check('没有被删掉任何东西', clean.removed.length === 0, clean.removed.join('、'));
            check('体检没有挑出毛病', clean.warnings.length === 0, clean.warnings.join(' | '));

            // ── 写代码那档:塞进沙箱跑一遍 ──────────────────
            if (sample.layout === 'code') {
                check('拆出了 JS', split.js.length > 0, `${split.js.length} 字`);
                await page.evaluate(
                    `window.__mountSandbox(${JSON.stringify(split.html)}, ${JSON.stringify(split.css)}, ${JSON.stringify(split.js)})`,
                );
                await sleep(900);

                const errs = await page.evaluate('JSON.stringify(window.__errors || [])').then(JSON.parse);
                check('沙箱里跑起来没报错', errs.length === 0, errs[0] || '');

                const fbox = await page.evaluate('JSON.stringify(window.__frameBox())').then(JSON.parse);
                check('画布量得到尺寸', !!fbox && fbox.w > 100, `${Math.round(fbox?.w)}×${Math.round(fbox?.h)}`);

                await page.evaluate('window.__haptics.length = 0; window.__sounds.length = 0; true');
                await page.send('Input.dispatchMouseEvent', {
                    type: 'mousePressed', x: fbox.cx, y: fbox.cy, button: 'left', buttons: 1, clickCount: 1,
                });
                await sleep(120);
                await page.send('Input.dispatchMouseEvent', {
                    type: 'mouseReleased', x: fbox.cx, y: fbox.cy, button: 'left', buttons: 0, clickCount: 1,
                });
                await sleep(1000);

                const felt = await page.evaluate('window.__haptics.length + window.__sounds.length');
                check('点一下有反馈', felt > 0, `${felt} 次`);
                const saved = await page.evaluate('JSON.stringify(window.__persisted)').then(JSON.parse);
                check('状态存下来了', !!saved && Object.keys(saved).length > 0, JSON.stringify(saved));

                console.log(`     图:${(await page.screenshot(`sample-${samples.indexOf(sample) + 1}`)).split(/[\\/]/).pop()}`);
                continue;
            }

            // 3) 真塞进浏览器
            const count = await page.evaluate(
                `window.__loadCode(${JSON.stringify(clean.html)}, ${JSON.stringify(clean.css)})`,
            );
            check('浏览器里扫得到零件', count > 0, `${count} 个`);

            // 4) 每个零件都要真的占地方 —— 尺寸算错(比如漏了 --hb-unit)会缩成 0
            const boxes = await page.evaluate(`
                (() => {
                    const out = [];
                    document.querySelectorAll('#stage [data-hb]').forEach((el) => {
                        const r = el.getBoundingClientRect();
                        out.push({
                            id: el.dataset.id || el.dataset.hb,
                            type: el.dataset.hb,
                            w: Math.round(r.width),
                            h: Math.round(r.height),
                            cx: r.left + r.width / 2,
                            cy: r.top + r.height / 2,
                        });
                    });
                    return JSON.stringify(out);
                })()
            `).then(JSON.parse);
            const tiny = boxes.filter(b => b.w < 6 || b.h < 6);
            check('每个零件都有可点面积', tiny.length === 0,
                tiny.map(b => `${b.id}=${b.w}×${b.h}`).join(', '));

            // 5) 零件不能被别的东西压住(忘了 pointer-events:none 就会这样)
            const blocked = [];
            for (const b of boxes) {
                const ok = await page.evaluate(
                    `!!document.elementFromPoint(${b.cx}, ${b.cy})?.closest?.('[data-hb]')`,
                );
                if (!ok) blocked.push(b.id);
            }
            check('没有零件被装饰层挡住', blocked.length === 0, blocked.join(', '));

            // 6) 挑一个能拖的零件真拖一下
            const draggable = boxes.find(b => b.type === 'stick')
                || boxes.find(b => b.type === 'slide')
                || boxes.find(b => b.type === 'dial')
                || boxes[0];
            const isStick = draggable.type === 'stick';
            const varName = isStick || draggable.type === 'slide' ? '--hb-y' : (draggable.type === 'dial' ? '--hb-deg' : '--hb-p');
            const sel = `#stage [data-hb][data-id="${draggable.id}"]`;

            await page.send('Input.dispatchMouseEvent', {
                type: 'mousePressed', x: draggable.cx, y: draggable.cy, button: 'left', buttons: 1, clickCount: 1,
            });
            await page.send('Input.dispatchMouseEvent', {
                type: 'mouseMoved',
                x: draggable.cx + (draggable.type === 'dial' ? draggable.w * 0.3 : 0),
                y: draggable.cy + draggable.h * 0.3,
                button: 'left', buttons: 1,
            });
            await sleep(90);
            const moved = await page.evaluate(
                `Number(document.querySelector(${JSON.stringify(sel)})?.style.getPropertyValue(${JSON.stringify(varName)}) || 0)`,
            );
            check(`拖 ${draggable.id}(${draggable.type})有反应`, Math.abs(moved) > 0.01, `${varName}=${moved}`);
            await page.send('Input.dispatchMouseEvent', {
                type: 'mouseReleased',
                x: draggable.cx, y: draggable.cy + draggable.h * 0.3, button: 'left', buttons: 0, clickCount: 1,
            });
            await sleep(120);

            const shot = await page.screenshot(`sample-${samples.indexOf(sample) + 1}`);
            console.log(`     图:${path.basename(shot)}`);
        }

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
