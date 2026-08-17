/**
 * 手机壳模式下软键盘弹起的表现：
 *   - 不许缩放（以前 murmur 打字时整台手机会缩小一圈）
 *   - 往上抬到「底边刚好在键盘上沿」，且顶边不出屏
 *   - 键盘收起后完全复位
 *
 * 无头浏览器弹不出真键盘，这里用 CDP 的 setDeviceMetricsOverride 把视口压矮
 * 来模拟 —— 效果和安卓 Chrome 的 resize 模式一致（window.innerHeight 变小）。
 */
import { launch, check, section, report, sleep } from './__probe-kit.mjs';

async function metrics(page, width, height) {
    await page.send('Emulation.setDeviceMetricsOverride', {
        width, height, deviceScaleFactor: 1, mobile: true,
    });
    await sleep(500);
}

async function readState(page) {
    return page.evaluate(`
        (() => {
            const root = document.documentElement;
            const phone = document.getElementById('phone');
            const cs = phone ? getComputedStyle(phone) : null;
            return {
                scale: root.style.getPropertyValue('--phone-scale').trim(),
                lift: root.style.getPropertyValue('--phone-keyboard-lift').trim(),
                transform: cs ? cs.transform : '',
                innerH: window.innerHeight,
                rect: phone ? (() => { const r = phone.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom) }; })() : null,
            };
        })()
    `);
}

async function run() {
    const { page, close } = await launch({ port: 9420, prefix: 'kb-probe', width: 380, height: 780 });

    try {
        section('正常状态（手机壳可见）');
        await metrics(page, 380, 780);
        const normal = await readState(page);
        check('没有键盘时不抬', normal.lift === '0px' || normal.lift === '', normal.lift || '(未设)');
        check('有缩放值', !!normal.scale, normal.scale);
        check('手机完整在屏内', normal.rect && normal.rect.top >= 0, JSON.stringify(normal.rect));

        section('模拟软键盘弹起（视口压到 420 高 + 有输入焦点）');
        // 真键盘只在「光标在输入框里」时才弹，框架也是这么判的 —— 先造一个焦点
        await page.evaluate(`
            (() => {
                let el = document.getElementById('__kbProbeInput');
                if (!el) {
                    el = document.createElement('input');
                    el.id = '__kbProbeInput';
                    el.style.cssText = 'position:absolute;left:-9999px;top:0;';
                    document.body.appendChild(el);
                }
                el.focus();
                return document.activeElement === el;
            })()
        `);
        await metrics(page, 380, 420);
        await page.evaluate(`window.dispatchEvent(new Event('resize'))`);
        await sleep(600);
        const kb = await readState(page);
        check('★ 缩放没有被键盘改小', kb.scale === normal.scale, `${normal.scale} → ${kb.scale}`);
        const lifted = parseFloat(kb.lift) || 0;
        check('★ 手机往上抬了', lifted > 0, `${kb.lift}`);
        check('★ 底边挪进了可见区', kb.rect && kb.rect.bottom <= 420 + 2, `bottom=${kb.rect?.bottom} 可见到 420`);
        // 550 高的手机塞进 420 的可见区，顶部溢出是必然的；但不能溢出到「白抬」的程度——
        // 溢出量应该正好等于装不下的那部分（±10px 容差）
        const phoneH = 590 * parseFloat(normal.scale);
        const inevitable = Math.max(0, phoneH - 420);
        const overflow = kb.rect ? -kb.rect.top : 0;
        check('★ 顶部只溢出「本来就装不下」的那一点', Math.abs(overflow - inevitable) < 12,
            `溢出 ${Math.round(overflow)}，不可避免 ${Math.round(inevitable)}`);

        section('键盘收起');
        await page.evaluate(`document.getElementById('__kbProbeInput')?.blur()`);
        await metrics(page, 380, 780);
        await page.evaluate(`window.dispatchEvent(new Event('resize'))`);
        await sleep(700);
        const back = await readState(page);
        check('★ 抬起复位', (parseFloat(back.lift) || 0) === 0, back.lift);
        check('缩放回到原值', back.scale === normal.scale, `${normal.scale} → ${back.scale}`);

        section('代码层面：没有会把整页顶飞的 scrollIntoView');
        const bad = await page.evaluate(`
            (async () => {
                const files = ['/js/apps/chat-app/index.js', '/js/apps/music-app/components/dom-sync.js'];
                const out = [];
                for (const f of files) {
                    const txt = await (await fetch(f)).text();
                    // 只看真调用，注释里提到的不算
                    const lines = txt.split('\\n').filter(l => !l.trim().startsWith('*') && !l.trim().startsWith('//'));
                    if (lines.some(l => /scrollIntoView\\([^)]*block:\\s*'center'/.test(l))) out.push(f);
                }
                return out;
            })()
        `);
        check('★ murmur / 音乐里没有 block:center 的滚动', bad.length === 0, bad.join(', '));

        section('控制台');
        const errs = page.errors();
        check('没有 JS 报错', errs.length === 0, errs.slice(0, 3).join(' | '));
    } catch (err) {
        console.error('\n探针崩了：', err.message);
        check('探针跑完', false, err.message);
    } finally {
        await close();
    }

    process.exit(report() ? 0 : 1);
}

run();
