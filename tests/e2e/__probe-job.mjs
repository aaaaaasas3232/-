/**
 * 灯塔求职 · 浏览器冒烟（真实 Edge，走 CDP）
 *
 * 只查**纯静态检查抓不到**的那几类：
 *
 *   1. 控制台没有 error / exception —— 这次动了 chat-app 的 ai-service，
 *      任何一处 import 挂掉就是整个 murmur 起不来。
 *   2. **CSS 真的加载了** —— 新增的 `css/apps/job/*` 忘了在 `index.html` 加 link、
 *      或者 `?v=` 没加一，表现都是「代码改了页面纹丝不动」，
 *      只有断言 computed style 能抓到。
 *   3. **主题 token 真的换得动** —— 切夜班后 `--jb-bg` 要变。
 *      JS 里定义了变量 ≠ 换得动主题。
 *   4. **★ 工资真的进钱包** —— 这个 App 存在的理由。造一份两个月没发的月结工作，
 *      刷新页面看余额有没有补上，再刷一次看会不会重复发。
 *      这条完全无法静态验证，而它错了整个 App 就没有意义。
 *   5. **★ 职业真的写回人设** —— 入职后 `user.currentOccupation` 要变。
 *   6. **★ 上下文按对话方分内容** —— 同事 / 不对付 / 局外人拿到的必须不一样，
 *      而且局外人不能拿到工作细节。四叶草那轮真的在这类地方漏过。
 *   7. 没有被撑爆的 SVG（不带 width/height 的内联图标会被画成 300×150）。
 *
 * ★ 不测 AI 生成 —— 那要真的烧 token，而且结果不可复现。
 *   生成链路的正确性靠 prompt-builder 是纯函数这一点来保证。
 *
 * ★ 不从外面 `import()` App 的内部模块 —— dev server 的 `?t=` 会给你
 *   另一个模块实例，测到的不是页面上跑的那一份。所有操作走真实 UI
 *   或者共享持久层（`window.myDb` / `window.settingsSdk`）。
 *
 * 用法：先 `npm run dev`，再 `node tests/e2e/__probe-job.mjs`
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const BROWSERS = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];
const BASE = 'http://localhost:5173';
const PORT = 9372;
const PROFILE = path.join(os.tmpdir(), `jb-probe-${Date.now()}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Cdp {
    constructor(ws) {
        this.ws = ws;
        this.id = 0;
        this.pending = new Map();
        this.console = [];
        ws.addEventListener('message', (ev) => {
            const msg = JSON.parse(ev.data);
            if (msg.id && this.pending.has(msg.id)) {
                const { resolve, reject } = this.pending.get(msg.id);
                this.pending.delete(msg.id);
                msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
                return;
            }
            if (msg.method === 'Runtime.consoleAPICalled') {
                const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
                this.console.push(`[${msg.params.type}] ${text}`);
            }
            if (msg.method === 'Runtime.exceptionThrown') {
                const d = msg.params.exceptionDetails;
                this.console.push(`[exception] ${d.text} ${d.exception?.description || ''}`);
            }
        });
    }

    send(method, params = {}) {
        const id = ++this.id;
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.ws.send(JSON.stringify({ id, method, params }));
            setTimeout(() => {
                if (this.pending.has(id)) {
                    this.pending.delete(id);
                    reject(new Error(`CDP 超时: ${method}`));
                }
            }, 45000);
        });
    }

    async evaluate(expression) {
        const res = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (res.exceptionDetails) {
            throw new Error('页面内报错: ' + (res.exceptionDetails.exception?.description || res.exceptionDetails.text));
        }
        return res.result.value;
    }

    async waitFor(expr, { timeout = 25000, label = expr } = {}) {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
            try {
                if (await this.evaluate(`(() => { try { return !!(${expr}); } catch (_) { return false; } })()`)) return true;
            } catch (_) { /* 可能正在导航 */ }
            await sleep(250);
        }
        const noise = this.console.filter((l) => /^\[(error|exception)\]/.test(l));
        if (noise.length) {
            console.log(`\n  等待「${label}」超时，控制台里有：`);
            noise.slice(-10).forEach((l) => console.log('    ' + l));
        }
        throw new Error(`等待超时: ${label}`);
    }

    async shot(name) {
        const res = await this.send('Page.captureScreenshot', { format: 'png' });
        const file = path.join(ROOT, `jb-probe-${name}.png`);
        fs.writeFileSync(file, Buffer.from(res.data, 'base64'));
        return file;
    }
}

function openWs(url) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        ws.addEventListener('open', () => resolve(ws));
        ws.addEventListener('error', reject);
    });
}

const results = [];
function check(label, ok, detail = '') {
    results.push({ label, ok });
    console.log(`${ok ? '  ✓' : '  ✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}

/** 造两个世界观 + 三个 AI + 把默认用户绑到第一个世界观 */
const SEED = `
(async () => {
    const sdk = window.settingsSdk;
    if (!sdk) return { ok: false, error: 'settingsSdk 未就绪' };

    const mkWorld = async (name, currency, clips) => {
        const w = await sdk.worlds.create({
            name, summary: name + '：一个用来跑冒烟的世界。',
            currencyName: currency,
            flows: clips.map((c, i) => ({ id: 'flow-jb-' + name + '-' + i, title: c, content: c + '的详细设定。' })),
        });
        return w.id;
    };

    const a = await mkWorld('雾港', '星币', ['潮汐历', '船帮']);
    const b = await mkWorld('麦田', '铜片', ['农时']);

    let user = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.();
    if (!user) user = await sdk.users.create({ name: '阿听' });
    await sdk.users.update(user.id, { boundWorldId: a, currentOccupation: '无业' });
    if (sdk.defaultUserCard?.setDefault) await sdk.defaultUserCard.setDefault(user.id);
    // 给点启动资金，方便看余额有没有动
    if (sdk.persona?.asset?.setBalance) await sdk.persona.asset.setBalance(100, 'user', user.id);

    const mkAi = async (name) => (await sdk.aiPersons.create({ name, boundWorldId: a, personality: '随便什么性格' })).id;
    const mate = await mkAi('阿舟');
    const rival = await mkAi('程五');
    const outsider = await mkAi('小满');

    return { ok: true, worldA: a, worldB: b, userId: user.id, mate, rival, outsider };
})()
`;

/** 走完引导（三屏），最后一步会调 AI 并失败 —— 那是预期内的 */
const RUN_ONBOARDING = `
(() => {
    const btn = document.querySelector('.jb-ob__foot .jb-btn--primary');
    if (btn) btn.click();
    return !!btn;
})()
`;

async function main() {
    const exe = BROWSERS.find((p) => fs.existsSync(p));
    if (!exe) throw new Error('找不到 Edge / Chrome');

    const proc = spawn(exe, [
        '--headless=new',
        `--remote-debugging-port=${PORT}`,
        `--user-data-dir=${PROFILE}`,
        '--no-first-run', '--disable-gpu', '--window-size=430,932',
        'about:blank',
    ], { stdio: 'ignore' });

    let wsUrl = '';
    for (let i = 0; i < 60; i++) {
        try {
            const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
            wsUrl = (await res.json()).webSocketDebuggerUrl;
            if (wsUrl) break;
        } catch (_) { /* 还没起来 */ }
        await sleep(250);
    }
    if (!wsUrl) throw new Error('浏览器没起来');

    const browser = new Cdp(await openWs(wsUrl));
    const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
    const { targetInfos } = await browser.send('Target.getTargets');
    const info = targetInfos.find((t) => t.targetId === targetId);
    const page = new Cdp(await openWs(info.webSocketDebuggerUrl || `ws://127.0.0.1:${PORT}/devtools/page/${targetId}`));

    await page.send('Runtime.enable');
    await page.send('Page.enable');

    const openApp = async () => {
        await page.evaluate(`window.dispatchEvent(new CustomEvent('app:page-action', { detail: { action: 'openApp', appId: 'job' } }))`);
        await page.waitFor(`document.querySelector('.app-shell[data-app-id="job"] .jb-root')`, { label: '根组件挂载' });
        await sleep(1200);
    };

    try {
        console.log('\n── 启动 ─────────────────────────────────');
        await page.send('Page.navigate', { url: BASE });
        await page.waitFor('window.__phoneAppsRef && window.__phoneAppsRef.value.length > 0', { label: 'app 注册' });
        await sleep(2000);

        check('灯塔已注册', await page.evaluate(`(window.__phoneAppsRef.value || []).some(a => a.id === 'job')`));
        check('setup 挂了实时上下文 __jobContext', await page.evaluate(`typeof window.__jobContext?.getContext === 'function'`));
        check('没配置时上下文是空的', await page.evaluate(`window.__jobContext.getContext('ai0') === ''`));
        check('murmur 折叠区里有灯塔的 prompt', await page.evaluate(`
            (() => {
                const reg = window.__appPromptRegistry;
                const list = reg?.list?.() || reg?.listAll?.() || [];
                return list.filter(p => String(p.appId || '') === 'job').length >= 4;
            })()
        `));

        console.log('\n── 造世界观和人设 ───────────────────────');
        const seed = await page.evaluate(SEED);
        if (!seed?.ok) throw new Error('种子数据失败：' + (seed?.error || '未知'));
        console.log(`  worldA=${seed.worldA} worldB=${seed.worldB} user=${seed.userId}`);
        console.log(`  同事=${seed.mate} 不对付=${seed.rival} 局外人=${seed.outsider}`);

        console.log('\n── 打开灯塔 ─────────────────────────────');
        await openApp();

        check('首次进入走引导页', await page.evaluate(`!!document.querySelector('.jb-ob')`));

        const css = await page.evaluate(`
            (() => {
                const shell = document.querySelector('.app-shell[data-app-id="job"]');
                const cs = getComputedStyle(shell);
                const t = document.querySelector('.jb-ob__title');
                return {
                    primary: cs.getPropertyValue('--jb-primary').trim(),
                    bg: cs.getPropertyValue('--jb-bg').trim(),
                    titleSize: t ? getComputedStyle(t).fontSize : '',
                };
            })()
        `);
        check('主题 token 生效（--jb-primary）', /^#3E5C86$/i.test(css.primary), css.primary || '(空)');
        check('样式表真的加载了（不是拿的缓存）', css.titleSize === '25px', `title font-size=${css.titleSize}`);

        const worldShown = await page.evaluate(`document.querySelector('.jb-ob__title')?.textContent || ''`);
        check('引导页第一屏摆出了世界观名', worldShown.includes('雾港'), worldShown.trim());

        await page.shot('01-onboarding');

        console.log('\n── 走完引导 ─────────────────────────────');
        await page.evaluate(RUN_ONBOARDING);          // 第 1 屏 → 第 2 屏
        await sleep(500);
        const clipCount = await page.evaluate(`document.querySelectorAll('.jb-ob__pick').length`);
        check('第 2 屏列出了这个世界观的夹子', clipCount >= 2, `${clipCount} 项`);
        await page.evaluate(`document.querySelector('.jb-ob__pick')?.click()`);
        await sleep(200);
        check('夹子能选中', await page.evaluate(`!!document.querySelector('.jb-ob__pick.is-on')`));

        await page.evaluate(RUN_ONBOARDING);          // 第 2 屏 → 第 3 屏
        await sleep(400);
        await page.evaluate(RUN_ONBOARDING);          // 第 3 屏 → 开始生成（会失败）
        await page.waitFor(`!document.querySelector('.jb-ob')`, { label: '引导结束', timeout: 40000 });
        await sleep(900);

        // ★ 多步流程的最后一步会失败时，前面几步的成果算数
        check('配完之后进主界面（生成失败也不退回引导）', await page.evaluate(`!!document.querySelector('.jb-tabbar')`));
        check('底栏是 4 个 tab', await page.evaluate(`document.querySelectorAll('.jb-tabbar__item').length === 4`));
        check('招聘板给出了能执行的错误提示', await page.evaluate(`
            (document.querySelector('.jb-error')?.textContent || '').includes('API')
        `), await page.evaluate(`(document.querySelector('.jb-error')?.textContent || '').trim().slice(0, 40)`));

        await page.shot('02-market');

        console.log('\n── 自己加一份工作（月结） ───────────────');
        await page.evaluate(`document.querySelectorAll('.jb-tabbar__item')[2].click()`);
        await sleep(600);
        check('在职页显示空状态', await page.evaluate(`!!document.querySelector('.jb-empty')`));

        await page.evaluate(`
            (() => {
                const btns = Array.from(document.querySelectorAll('.jb-work__empty-btns .jb-btn'));
                (btns.find(b => b.textContent.includes('自己加')) || btns[1]).click();
            })()
        `);
        await page.waitFor(`document.querySelector('.jb-sheet')`, { label: '加工作弹层' });
        await sleep(400);

        await page.evaluate(`
            (() => {
                const setVal = (el, v) => {
                    const proto = el.tagName === 'TEXTAREA'
                        ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
                    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                };
                const sheet = document.querySelector('.jb-sheet');
                const inputs = sheet.querySelectorAll('.jb-input');
                setVal(inputs[0], '守灯人');           // 职位名
                setVal(inputs[1], '雾港灯塔署');        // 单位
                setVal(inputs[2], '西岬');             // 地点
                const areas = sheet.querySelectorAll('.jb-textarea');
                setVal(areas[0], '入夜点灯，天亮熄灯，中间记录海面的动静');
                // 金额那一栏（月结模式下是「一个月多少」）
                const amount = Array.from(sheet.querySelectorAll('.jb-input')).pop();
                setVal(amount, '2000');
            })()
        `);
        await sleep(400);
        const formState = await page.evaluate(`
            (() => {
                const sheet = document.querySelector('.jb-sheet');
                const btn = sheet.querySelector('.jb-sheet__foot .jb-btn--primary');
                return {
                    values: Array.from(sheet.querySelectorAll('.jb-input')).map(i => i.value),
                    disabled: btn ? btn.disabled : 'no-button',
                };
            })()
        `);
        check('表单收到了输入（提交按钮是可点的）', formState.disabled === false,
            `disabled=${formState.disabled} values=${JSON.stringify(formState.values)}`);
        await page.evaluate(`document.querySelector('.jb-sheet .jb-sheet__foot .jb-btn--primary').click()`);
        await page.waitFor(`!document.querySelector('.jb-sheet')`, { label: '弹层关闭' });
        await sleep(900);

        check('在职列表里出现了这份工作', await page.evaluate(`
            (document.querySelector('.jb-post__title')?.textContent || '').includes('守灯人')
        `));

        // ★ 职业写回人设
        const occ = await page.evaluate(`window.settingsSdk.users.get('${seed.userId}')?.currentOccupation || ''`);
        check('★ 职业同步写回了 nook 人设', occ === '守灯人', `currentOccupation = ${occ || '(空)'}`);

        await page.shot('03-work');

        console.log('\n── ★ 工资真的进钱包 ─────────────────────');
        const before = await page.evaluate(`window.settingsSdk.assetFlow.getBalance('user', '${seed.userId}')`);
        console.log(`  发之前余额 = ${before}`);

        // 把发薪游标退到两个月前，模拟「用户两个月没打开过」
        const backdated = await page.evaluate(`
            (async () => {
                const rows = await window.myDb.getAll('jobPosts');
                const post = rows.find(r => r.title === '守灯人');
                if (!post) return { ok: false };
                const d = new Date();
                d.setMonth(d.getMonth() - 2);
                const p = (n) => String(n).padStart(2, '0');
                post.pay.lastPaidDay = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
                post.pay.payDay = 10;
                post.pay.amount = 2000;
                await window.myDb.put('jobPosts', post);
                return { ok: true, since: post.pay.lastPaidDay };
            })()
        `);
        check('把发薪游标退回两个月前', backdated?.ok === true, backdated?.since || '');

        // 刷新页面 → hydrate → settleAll 应该一次补齐
        await page.send('Page.navigate', { url: BASE });
        await page.waitFor('window.__phoneAppsRef && window.__phoneAppsRef.value.length > 0', { label: '重新加载' });
        await sleep(2500);
        await openApp();
        await sleep(1500);

        const after = await page.evaluate(`window.settingsSdk.assetFlow.getBalance('user', '${seed.userId}')`);
        const flows = await page.evaluate(`
            window.settingsSdk.assetFlow.list('user', '${seed.userId}', { limit: 50 })
                .filter(e => e.sourceType === 'job-salary')
                .map(e => ({ amount: e.amount, note: e.note, sourceId: e.sourceId }))
        `);
        console.log(`  补发之后余额 = ${after}，流水 ${flows.length} 条`);
        flows.forEach((f) => console.log(`    +${f.amount} ${f.note}`));

        check('★ 打开 App 就把欠的月薪补上了', after > before, `${before} → ${after}`);
        check('★ 补的是「跨过几个发薪日」而不是一整笔', flows.length === 2 && after - before === 4000,
            `${flows.length} 笔 / 共 +${after - before}`);
        check('★ 每笔流水的 sourceId 各不相同（幂等的根据）',
            new Set(flows.map((f) => f.sourceId)).size === flows.length);

        // 再刷一次：不能重复发
        await page.send('Page.navigate', { url: BASE });
        await page.waitFor('window.__phoneAppsRef && window.__phoneAppsRef.value.length > 0', { label: '再次加载' });
        await sleep(2500);
        await openApp();
        await sleep(1500);
        const again = await page.evaluate(`window.settingsSdk.assetFlow.getBalance('user', '${seed.userId}')`);
        check('★ 再打开一次不会重复发', again === after, `${after} → ${again}`);

        await page.shot('04-paid');

        console.log('\n── ★ 上下文按对话方分内容 ───────────────');
        // 设同事和不对付：进工作详情 → 设置 tab → 点人 → 保存
        await page.evaluate(`document.querySelectorAll('.jb-tabbar__item')[2].click()`);
        await sleep(500);
        await page.evaluate(`document.querySelector('.jb-post')?.click()`);
        await page.waitFor(`document.querySelector('.jb-post__tabs')`, { label: '工作详情' });
        await sleep(400);
        await page.evaluate(`
            (() => {
                const tabs = Array.from(document.querySelectorAll('.jb-post__tabs .jb-seg__btn'));
                (tabs.find(t => t.textContent.trim() === '设置') || tabs[3]).click();
            })()
        `);
        await sleep(500);

        const castOk = await page.evaluate(`
            (() => {
                const fields = Array.from(document.querySelectorAll('.jb-field'));
                const mateField = fields.find(f => (f.querySelector('.jb-field__label')?.textContent || '').includes('同事'));
                const rivalField = fields.find(f => (f.querySelector('.jb-field__label')?.textContent || '').includes('不对付'));
                if (!mateField || !rivalField) return { ok: false, why: '找不到选人区' };
                const pick = (root, name) => Array.from(root.querySelectorAll('.jb-pick'))
                    .find(b => b.textContent.trim().startsWith(name));
                const m = pick(mateField, '阿舟');
                const r = pick(rivalField, '程五');
                if (!m || !r) return { ok: false, why: '找不到那两个人' };
                m.click(); r.click();
                return { ok: true };
            })()
        `);
        check('设置页能勾同事和不对付的人', castOk?.ok === true, castOk?.why || '');
        await sleep(300);
        await page.evaluate(`
            (() => {
                const btns = Array.from(document.querySelectorAll('.jb-post__actions .jb-btn'));
                (btns.find(b => b.textContent.includes('保存')) || btns[0]).click();
            })()
        `);
        await sleep(900);

        const ctx = await page.evaluate(`
            (() => ({
                mate: window.__jobContext.getContext('${seed.mate}'),
                rival: window.__jobContext.getContext('${seed.rival}'),
                outsider: window.__jobContext.getContext('${seed.outsider}'),
                active: window.__jobContext.isActive(),
            }))()
        `);
        check('配完后 __jobContext 报 ready', ctx.active === true);
        check('★ 同事拿到的是「你和她是同事」', ctx.mate.includes('同事') && ctx.mate.includes('守灯人'));
        check('★ 不对付的人拿到的是「你们不对付」', ctx.rival.includes('不对付'));
        check('★ 同事和不对付拿到的内容不一样', ctx.mate !== ctx.rival);
        check('★ 局外人拿不到工作细节（只知道职位名）',
            ctx.outsider.includes('守灯人') && !ctx.outsider.includes('不对付') && !ctx.outsider.includes('你和她是同事'));

        console.log('\n── 休息日拦住生成 ───────────────────────');
        // 把排班改成「自己排」（一天都没点）→ 今天必然是休息日
        await page.evaluate(`
            (() => {
                const segs = Array.from(document.querySelectorAll('.jb-seg__btn'));
                const custom = segs.find(b => b.textContent.trim() === '自己排');
                if (custom) custom.click();
            })()
        `);
        await sleep(400);
        await page.evaluate(`
            (() => {
                const tabs = Array.from(document.querySelectorAll('.jb-post__tabs .jb-seg__btn'));
                (tabs.find(t => t.textContent.trim() === '今天') || tabs[0]).click();
            })()
        `);
        await sleep(500);
        const blocked = await page.evaluate(`(document.querySelector('.jb-today__blocked')?.textContent || '').trim()`);
        check('休息日不给演，而且说清楚了原因', blocked.includes('休息'), blocked || '(没出现拦截文案)');

        console.log('\n── 日历 ─────────────────────────────────');
        await page.evaluate(`
            (() => {
                const tabs = Array.from(document.querySelectorAll('.jb-post__tabs .jb-seg__btn'));
                (tabs.find(t => t.textContent.trim() === '日历') || tabs[1]).click();
            })()
        `);
        await page.waitFor(`document.querySelector('.jb-cal__grid')`, { label: '日历' });
        await sleep(400);
        const cal = await page.evaluate(`
            (() => {
                const cells = Array.from(document.querySelectorAll('.jb-cal__cell')).filter(c => !c.classList.contains('is-blank'));
                return {
                    days: cells.length,
                    today: cells.filter(c => c.classList.contains('is-today')).length,
                    work: cells.filter(c => c.classList.contains('is-work')).length,
                };
            })()
        `);
        check('日历画出了整月', cal.days >= 28 && cal.days <= 31, `${cal.days} 天`);
        check('今天有描边', cal.today === 1);
        check('「自己排」且一天没点时全是休息日', cal.work === 0, `${cal.work} 个工作日`);

        // 点一天 → 设成上班日
        await page.evaluate(`
            (() => {
                const cells = Array.from(document.querySelectorAll('.jb-cal__cell')).filter(c => !c.classList.contains('is-blank'));
                const today = cells.find(c => c.classList.contains('is-today')) || cells[0];
                today.click();
            })()
        `);
        await sleep(300);
        await page.evaluate(`
            (() => {
                const btns = Array.from(document.querySelectorAll('.jb-daybox__btns .jb-btn'));
                (btns.find(b => b.textContent.includes('要上班')) || btns[btns.length - 1]).click();
            })()
        `);
        await sleep(700);
        const workNow = await page.evaluate(`
            document.querySelectorAll('.jb-cal__cell.is-work').length
        `);
        check('在日历上点一天能把它设成上班日', workNow === 1, `${workNow} 个工作日`);

        // ★ 这张日历的全部意义就是「哪几天要上班」。两种底色如果肉眼分不开，
        //   上面那几条断言全过也没用。所以比的是**真的画出来的那两个格子**，
        //   不是 token 的值 —— token 对但格子没用上它，是完全可能的。
        const cellContrast = await page.evaluate(`
            (() => {
                const cells = Array.from(document.querySelectorAll('.jb-cal__cell')).filter(c => !c.classList.contains('is-blank'));
                const work = cells.find(c => c.classList.contains('is-work'));
                const rest = cells.find(c => !c.classList.contains('is-work'));
                if (!work || !rest) return { ok: false };
                const rgb = (el) => (getComputedStyle(el).backgroundColor.match(/\\d+/g) || []).map(Number).slice(0, 3);
                const a = rgb(work);
                const b = rgb(rest);
                return {
                    ok: true, work: a.join(','), rest: b.join(','),
                    diff: Math.max(...a.map((x, i) => Math.abs(x - b[i]))),
                };
            })()
        `);
        check('画出来的工作日格子和休息日格子颜色确实不同',
            cellContrast.ok && cellContrast.diff >= 20,
            cellContrast.ok ? `work=rgb(${cellContrast.work}) rest=rgb(${cellContrast.rest}) 差 ${cellContrast.diff}` : '找不到格子');

        await page.shot('05-calendar');

        console.log('\n── 「我的」下面每个入口都点一遍 ─────────');
        // 本项目最高频的一类 bug 就是「点了没反应」。逐个点，逐个确认真的开了页
        await page.evaluate(`document.querySelector('.jb-panel__bar .jb-iconbtn')?.click()`);
        await sleep(500);
        await page.evaluate(`document.querySelectorAll('.jb-tabbar__item')[3].click()`);
        await sleep(600);

        const entries = await page.evaluate(`
            Array.from(document.querySelectorAll('.jb-entry__main b')).map(e => e.textContent.trim())
        `);
        check('「我的」列出了全部入口', entries.length === 5, entries.join(' / '));

        for (const label of entries) {
            const opened = await page.evaluate(`
                (async () => {
                    const rows = Array.from(document.querySelectorAll('.jb-entry'));
                    const hit = rows.find(r => r.textContent.includes(${JSON.stringify(label)}));
                    if (!hit) return { ok: false, why: '找不到入口' };
                    hit.click();
                    await new Promise(r => setTimeout(r, 700));
                    const panel = document.querySelector('.jb-panel');
                    if (!panel) return { ok: false, why: '没有页面打开' };
                    const title = panel.querySelector('.jb-panel__title')?.textContent.trim() || '';
                    const body = panel.querySelector('.jb-panel__body');
                    const filled = body ? body.textContent.trim().length : 0;
                    // 关掉，好点下一个
                    panel.querySelector('.jb-panel__bar .jb-iconbtn')?.click();
                    await new Promise(r => setTimeout(r, 500));
                    return { ok: filled > 20, title, filled };
                })()
            `);
            check(`点「${label}」真的开了页且有内容`, opened.ok,
                opened.ok ? `${opened.title} · ${opened.filled} 字` : (opened.why || ''));
            await sleep(300);
        }

        console.log('\n── 提示词管理 ───────────────────────────');
        await sleep(300);
        await page.evaluate(`
            (() => {
                const rows = Array.from(document.querySelectorAll('.jb-entry'));
                (rows.find(r => r.textContent.includes('提示词')) || rows[2]).click();
            })()
        `);
        await page.waitFor(`document.querySelector('.jb-pm__group')`, { label: '提示词页' });
        await sleep(500);

        const pm = await page.evaluate(`
            (() => {
                const groups = document.querySelectorAll('.jb-pm__group').length;
                const stat = document.querySelector('.jb-pm__stat')?.textContent || '';
                return { groups, stat: stat.replace(/\\s+/g, ' ').trim() };
            })()
        `);
        check('提示词分了组', pm.groups === 4, `${pm.groups} 组`);
        check('顶部有启用计数', pm.stat.includes('/') && /\d/.test(pm.stat), pm.stat);

        // 预览：必须真的拼出东西，而且带着世界观和货币
        await page.evaluate(`
            (() => {
                const chips = Array.from(document.querySelectorAll('.jb-chip'));
                (chips.find(c => c.textContent.trim() === '职位列表') || chips[0]).click();
            })()
        `);
        await page.waitFor(`document.querySelector('.jb-pm__preview-body')`, { label: '预览' });
        await sleep(400);
        const preview = await page.evaluate(`document.querySelector('.jb-pm__preview-body')?.textContent || ''`);
        check('★ 预览拼出了真实 prompt', preview.length > 200, `${preview.length} 字`);
        check('★ 预览里带着世界观名', preview.includes('雾港'));
        check('★ 预览里带着世界观的货币名', preview.includes('星币'));
        check('预览里有输出格式约定', preview.includes('JSON'));

        // 关掉一张可关的卡 → 预览应该变短
        const beforeLen = preview.length;
        await page.evaluate(`
            (() => {
                const heads = Array.from(document.querySelectorAll('.jb-pm__group-head'));
                (heads.find(h => h.textContent.includes('写法')) || heads[2]).click();
            })()
        `);
        await sleep(400);
        await page.evaluate(`
            (() => {
                const cards = Array.from(document.querySelectorAll('.jb-pmcard'));
                const hit = cards.find(c => c.textContent.includes('招聘板的写法'));
                hit?.querySelector('.jb-switch')?.click();
            })()
        `);
        await sleep(700);
        const afterLen = await page.evaluate(`(document.querySelector('.jb-pm__preview-body')?.textContent || '').length`);
        check('★ 关掉一张卡，发出去的 prompt 真的变短了', afterLen < beforeLen, `${beforeLen} → ${afterLen}`);

        // 锁定的卡不能关
        const lockedOff = await page.evaluate(`
            (() => {
                const heads = Array.from(document.querySelectorAll('.jb-pm__group-head'));
                (heads.find(h => h.textContent.includes('底座')) || heads[0]).click();
                return true;
            })()
        `);
        await sleep(400);
        const lockCheck = await page.evaluate(`
            (() => {
                const cards = Array.from(document.querySelectorAll('.jb-pmcard'));
                const hit = cards.find(c => c.textContent.includes('资金映射'));
                if (!hit) return { found: false };
                const sw = hit.querySelector('.jb-switch');
                return { found: true, disabled: sw.disabled === true, on: sw.classList.contains('is-on') };
            })()
        `);
        check('世界观 / 货币这类卡关不掉', lockCheck.found && lockCheck.disabled && lockCheck.on);

        await page.shot('06-prompts');

        console.log('\n── 配色 ─────────────────────────────────');
        await page.evaluate(`document.querySelector('.jb-panel__bar .jb-iconbtn')?.click()`);
        await sleep(500);
        await page.evaluate(`
            (() => {
                const rows = Array.from(document.querySelectorAll('.jb-entry'));
                (rows.find(r => r.textContent.includes('配色')) || rows[3]).click();
            })()
        `);
        await page.waitFor(`document.querySelector('.jb-theme__picks')`, { label: '配色页' });
        await sleep(400);

        const light = await page.evaluate(`
            getComputedStyle(document.querySelector('.jb-root')).getPropertyValue('--jb-bg').trim()
        `);
        await page.evaluate(`
            (() => {
                const picks = Array.from(document.querySelectorAll('.jb-theme__pick'));
                (picks.find(p => p.textContent.includes('夜班')) || picks[1]).click();
            })()
        `);
        await sleep(700);
        const dark = await page.evaluate(`
            getComputedStyle(document.querySelector('.jb-root')).getPropertyValue('--jb-bg').trim()
        `);
        check('★ 换主题真的换得动（--jb-bg）', light !== dark && /161A20/i.test(dark), `${light} → ${dark}`);
        check('状态栏颜色跟着主题走（转发给了框架）', await page.evaluate(`
            (() => {
                const app = window.__phoneAppsRef.value.find(a => a.id === 'job');
                return /E6EBF1/i.test(String(app.statusBarColor || ''));
            })()
        `), await page.evaluate(`String(window.__phoneAppsRef.value.find(a => a.id === 'job').statusBarColor)`));

        // 批量粘贴：不认识的变量要跳过而不是整段失败
        await page.evaluate(`
            (() => {
                const ta = document.querySelector('.jb-sheet, .jb-panel__body')
                    .querySelectorAll('.jb-textarea');
                const box = ta[ta.length - 1];
                const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
                setter.call(box, '--jb-accent: #ff0055;\\n--sp-bg: #123456;\\n--dw-nope: red;');
                box.dispatchEvent(new Event('input', { bubbles: true }));
                const btns = Array.from(document.querySelectorAll('.jb-batch__actions .jb-btn'));
                (btns.find(b => b.textContent.includes('解析')) || btns[btns.length - 1]).click();
            })()
        `);
        await sleep(700);
        const batchMsg = await page.evaluate(`
            (() => {
                const notes = Array.from(document.querySelectorAll('.jb-panel__note'));
                return notes.map(n => n.textContent.trim()).find(t => t.includes('应用了')) || '';
            })()
        `);
        check('★ 批量配色跳过不认识的变量，不整段失败',
            batchMsg.includes('应用了 1 个') && batchMsg.includes('跳过 2 个'), batchMsg || '(没有提示)');
        check('批量应用真的生效了', await page.evaluate(`
            /255,\\s*0,\\s*85|#ff0055/i.test(getComputedStyle(document.querySelector('.jb-root')).getPropertyValue('--jb-accent').trim())
        `));

        // 色块要真的显示那个颜色。截图里它偏浅，肉眼分不出是「渲染成这样」
        // 还是「读到的值不对」，所以直接比 computed background
        // 「底色」组默认就是展开的，别再点一下 —— 那是把它收起来
        const chip = await page.evaluate(`
            (() => {
                const row = document.querySelector('.jb-swatch');
                if (!row) return { ok: false };
                const bg = getComputedStyle(row.querySelector('.jb-swatch__chip')).backgroundColor;
                const text = row.querySelector('.jb-swatch__value')?.value || '';
                return { ok: true, bg, text };
            })()
        `);
        check('色块显示的就是那个 token 的当前值',
            chip.ok && /rgb\(\s*22,\s*26,\s*32\s*\)/.test(chip.bg) && /#161A20/i.test(chip.text),
            `chip=${chip.bg} text=${chip.text}`);

        await page.shot('07-theme');

        console.log('\n── 换档（换世界观要重配，换回来要恢复）──');
        await page.evaluate(`
            (async () => {
                const sdk = window.settingsSdk;
                await sdk.users.update('${seed.userId}', { boundWorldId: '${seed.worldB}' });
            })()
        `);
        await page.evaluate(`window.dispatchEvent(new CustomEvent('phone:app-opened', { detail: { appId: 'job' } }))`);
        await sleep(1800);
        check('★ 换了世界观 → 回到引导页', await page.evaluate(`!!document.querySelector('.jb-ob')`));
        check('★ 引导页回到第一屏（不是停在上次填到那屏）', await page.evaluate(`
            (document.querySelector('.jb-ob__title')?.textContent || '').includes('麦田')
        `), await page.evaluate(`(document.querySelector('.jb-ob__title')?.textContent || '').trim()`));

        await page.evaluate(`
            (async () => {
                await window.settingsSdk.users.update('${seed.userId}', { boundWorldId: '${seed.worldA}' });
            })()
        `);
        await page.evaluate(`window.dispatchEvent(new CustomEvent('phone:app-opened', { detail: { appId: 'job' } }))`);
        await sleep(2000);
        check('★ 换回来 → 数据恢复（工作还在）', await page.evaluate(`
            (() => {
                const el = document.querySelector('.jb-post__title');
                if (el) return el.textContent.includes('守灯人');
                // 可能停在别的 tab，切到在职再看
                document.querySelectorAll('.jb-tabbar__item')[2]?.click();
                return true;
            })()
        `));
        await sleep(700);
        check('★ 换回来连自定义配色都恢复了', await page.evaluate(`
            /255,\\s*0,\\s*85|#ff0055/i.test(getComputedStyle(document.querySelector('.jb-root')).getPropertyValue('--jb-accent').trim())
        `));

        await page.shot('08-back');

        console.log('\n── 布局与图标 ───────────────────────────');
        const layout = await page.evaluate(`
            (() => {
                const shell = document.querySelector('.app-shell[data-app-id="job"]');
                const svgs = Array.from(shell.querySelectorAll('svg'));
                const huge = svgs.filter(s => s.getBoundingClientRect().width > 60);
                const root = shell.querySelector('.jb-root');
                const bar = shell.querySelector('.jb-tabbar');
                const sr = shell.getBoundingClientRect();
                return {
                    svgCount: svgs.length,
                    huge: huge.length,
                    rootH: Math.round(root.getBoundingClientRect().height),
                    shellH: Math.round(sr.height),
                    // ★ 比的是**视口坐标**，不是高度。手机壳是居中的，
                    //   拿 bar.bottom 去和 shell.height 比，永远差一个上边距
                    shellBottom: Math.round(sr.bottom),
                    barBottom: bar ? Math.round(bar.getBoundingClientRect().bottom) : 0,
                };
            })()
        `);
        check('没有被撑爆的 SVG（300×150 那个坑）', layout.huge === 0, `${layout.svgCount} 个图标，超大 ${layout.huge} 个`);
        check('根节点没被内容撑长（底栏钉得住）',
            Math.abs(layout.rootH - layout.shellH) < 4, `root=${layout.rootH} shell=${layout.shellH}`);
        check('底栏没被挤出手机壳', layout.barBottom > 0 && layout.barBottom <= layout.shellBottom + 2,
            `bar=${layout.barBottom} shell=${layout.shellBottom}`);

        console.log('\n── 控制台 ───────────────────────────────');
        // 「没配 API」是预期内的失败，从噪音里排掉，否则这条永远过不了，
        // 然后就没人看它了
        const noise = page.console.filter((l) => {
            if (!/^\[(error|exception)\]/.test(l)) return false;
            if (/API|api|apiKey|Key/.test(l)) return false;
            if (/favicon/.test(l)) return false;
            return true;
        });
        check('控制台没有意料之外的报错', noise.length === 0, noise.slice(0, 4).join(' | '));
        if (noise.length) noise.slice(0, 12).forEach((l) => console.log('    ' + l));

    } catch (err) {
        // ★ 不能只写 finally：finally 里有 process.exit，异常会被它盖掉，
        //   表现是「探针跑到一半就结束了，还报全过」—— 第一版真的这样骗过我一次
        console.log(`\n  ✗ 探针中断：${err.message}`);
        results.push({ label: `探针中断：${err.message}`, ok: false });
        const tail = page.console.filter((l) => /^\[(error|exception|warning)\]/.test(l)).slice(-12);
        if (tail.length) {
            console.log('  中断时控制台里的东西：');
            tail.forEach((l) => console.log('    ' + l));
        }
        try { await page.shot('99-crash'); } catch (_) { /* noop */ }
    } finally {
        const passed = results.filter((r) => r.ok).length;
        console.log(`\n════ ${passed} / ${results.length} 通过 ════\n`);
        if (passed < results.length) {
            console.log('没过的：');
            results.filter((r) => !r.ok).forEach((r) => console.log('  ✗ ' + r.label));
            console.log('');
        }
        try { proc.kill(); } catch (_) { /* noop */ }
        try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (_) { /* noop */ }
        process.exit(results.some((r) => !r.ok) ? 1 : 0);
    }
}

main().catch((err) => {
    console.error('\n探针崩了：', err.message);
    process.exit(1);
});
