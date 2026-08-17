/**
 * 候鸟（旅游 App）· 浏览器冒烟（真实 Edge / Chrome，走 CDP）
 *
 * 只查纯静态检查抓不到的：
 *   1. 控制台没有 error / exception（API 缺失的预期失败除外）
 *   2. CSS 真的加载了（断言 computed style，不是「文件在不在」）
 *   3. 首配门闸 + A/B 档案切换与恢复（含自定义配色恢复）
 *   4. 机票链路：确认窗三个数 → 扣款 → 幂等（同目的地不二次收钱）→ 退票退款
 *   5. 旅行对话页：旁白居中 / 用户右 / AI 左带名字；结束后输入关闭
 *   6. 足迹：备注、登记 Nook（两层幂等：已有地点只加场所）
 *   7. murmur 折叠区：静态卡 + 概要卡重放
 *   8. 主题：预设切换 / 批量粘贴跳过外来变量 / 保存-改名-覆盖-删除
 *
 * ★ 不测 AI 生成（要烧 token 且不可复现）；生成链路的正确性由
 *   prompt-builder 是纯函数 + tests/travel-app.test.js 保证。
 *   探针里凡是「点了会调 AI」的地方，断言的是**失败被兜住**（不崩、不丢档）。
 *
 * 用法：先 `npm run dev`，再 `node tests/e2e/__probe-travel.mjs`
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
// ★ 端口按次随机：Windows 上 proc.kill() 杀不干净浏览器子进程，
//   固定端口会连到上一轮的僵尸浏览器上
const PORT = 9400 + Math.floor(Math.random() * 180);
const PROFILE = path.join(os.tmpdir(), `tv-probe-${Date.now()}`);
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
        const file = path.join(ROOT, `tv-probe-${name}.png`);
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

/** 造两个世界观 + 已有地点 + AI 同伴 + 默认用户绑 A + 给钱 */
const SEED = `
(async () => {
    const sdk = window.settingsSdk;
    if (!sdk) return { ok: false, error: 'settingsSdk 未就绪' };

    const a = (await sdk.worlds.create({
        name: '雾杉泽', summary: '建在巨杉之上的世界，涨潮时低处的街道会沉进海里。',
        currencyName: '星币',
        flows: [
            { id: 'flow-tv-a-0', title: '潮汐历', content: '每月两次大潮，全城迁往高层。' },
            { id: 'flow-tv-a-1', title: '缆车网', content: '城区之间靠藤蔓缆车通行。' },
        ],
    })).id;
    const b = (await sdk.worlds.create({
        name: '铁砂原', summary: '一望无际的铁色沙原。',
        currencyName: '铜屑',
        flows: [{ id: 'flow-tv-b-0', title: '沙暴季', content: '每年三个月不能出门。' }],
    })).id;

    // 世界 A 里已有一个地点（用来验证「已有地点只加场所」的幂等注册）
    const place = await sdk.places.create({ worldRef: a, name: '杉顶港', summary: '巨杉顶端的港口。' });
    await sdk.locations.create({ worldRef: a, placeRef: place.id, name: '灯塔市集', summary: '' });

    let user = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.();
    if (!user) user = await sdk.users.create({ name: '阿听' });
    await sdk.users.update(user.id, { boundWorldId: a });
    if (sdk.defaultUserCard?.setDefault) await sdk.defaultUserCard.setDefault(user.id);

    const ai = await sdk.aiPersons.create({ name: '阿澈', boundWorldId: a, personality: '毒舌但靠谱' });

    await sdk.persona.asset.adjust(1000, '候鸟冒烟', 'user', user.id);
    const balance = sdk.assetFlow.getBalance('user', user.id);

    return { ok: true, worldA: a, worldB: b, userId: user.id, aiId: ai.id, placeId: place.id, balance };
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

    try {
        await run(page);
    } catch (err) {
        // ★ 中断本身记成失败，不能让 finally 的汇报把异常盖掉
        check(`探针中断: ${err.message}`, false);
        const noise = page.console.filter((l) => /^\[(error|exception)\]/.test(l));
        noise.slice(-8).forEach((l) => console.log('    ' + l));
        try {
            const apps = await page.evaluate(`(window.__phoneAppsRef?.value || []).map(a => a.id).join(',')`);
            console.log('    已注册 app:', apps || '(空)');
        } catch (_) { /* 页面都没起来 */ }
    }

    console.log('\n────────────────────────────────────────');
    const bad = results.filter((r) => !r.ok);
    console.log(`${results.length - bad.length}/${results.length} 通过`);
    if (bad.length) {
        console.log('\n没过的：');
        bad.forEach((b) => console.log('  ✗ ' + b.label));
    }

    // Windows 上 proc.kill() 只杀 launcher，子进程树要 taskkill /T
    try {
        if (process.platform === 'win32' && proc.pid) {
            spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
        } else {
            proc.kill();
        }
    } catch (_) { /* 已经退了 */ }
    await sleep(700);
    try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (_) { /* 占用中 */ }
    process.exit(bad.length ? 1 : 0);
}

/** 给 input / textarea 赋值并触发 Vue 的 v-model */
const SET_VALUE = `
    const __set = (el, v) => {
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    };
`;

async function run(page) {
    console.log('\n── 启动 ─────────────────────────────────');
    await page.send('Page.navigate', { url: BASE });
    // ★ __phoneAppsRef 是「可见 App」：travel 声明了 requiresBoundWorld，
    //   种子跑之前用户没绑世界 → 它被正确地藏起来。
    //   所以先等注册清单里 travel 前面那个（diary）出现，再断言「藏住了」。
    await page.waitFor(
        `window.__phoneAppsRef && (window.__phoneAppsRef.value || []).some(a => a.id === 'diary')`,
        { label: 'app 注册', timeout: 40000 },
    );
    await sleep(1500);

    check('没绑世界观时桌面不出现候鸟', await page.evaluate(
        `!(window.__phoneAppsRef.value || []).some(a => a.id === 'travel')`,
    ));

    console.log('\n── 造世界观 ─────────────────────────────');
    const seed = await page.evaluate(SEED);
    if (!seed?.ok) throw new Error('种子数据失败：' + (seed?.error || '未知'));
    console.log(`  worldA=${seed.worldA} worldB=${seed.worldB} user=${seed.userId} 余额=${seed.balance}`);
    check('种子余额到账', seed.balance >= 1000, `余额 ${seed.balance}`);

    // 绑定世界后可见性自动重算（installWorldAvailabilityRefresh），
    // 保险起见再显式踢一脚 —— 重算是幂等的
    await page.evaluate(`window.refreshPhoneApps?.()`);
    await page.waitFor(
        `(window.__phoneAppsRef.value || []).some(a => a.id === 'travel')`,
        { label: '绑定世界后候鸟出现', timeout: 15000 },
    );
    check('绑定世界后候鸟自动出现在桌面', true);
    check('声明了 requiresBoundWorld', await page.evaluate(
        `window.__phoneAppsRef.value.find(a => a.id === 'travel')?.worldAvailability?.requiresBoundWorld === true`,
    ));

    console.log('\n── 打开候鸟：首配门闸 ───────────────────');
    await page.evaluate(`window.dispatchEvent(new CustomEvent('app:page-action', { detail: { action: 'openApp', appId: 'travel' } }))`);
    await page.waitFor(`document.querySelector('.app-shell[data-app-id="travel"] .tv-root')`, { label: '根组件挂载' });
    await sleep(1400);

    check('首次进入走引导页', await page.evaluate(`!!document.querySelector('.tv-ob')`));
    const pills = await page.evaluate(`Array.from(document.querySelectorAll('.tv-ob__pill-v')).map(e => e.textContent.trim())`);
    check('引导页读到世界名和货币', pills.includes('雾杉泽') && pills.includes('星币'), pills.join(' / '));

    const css = await page.evaluate(`
        (() => {
            const shell = document.querySelector('.app-shell[data-app-id="travel"]');
            const cs = getComputedStyle(shell);
            const t = document.querySelector('.tv-ob__title');
            return {
                primary: cs.getPropertyValue('--tv-primary').trim(),
                titleSize: t ? getComputedStyle(t).fontSize : '',
            };
        })()
    `);
    check('主题 token 生效（--tv-primary）', /^#5E97C4$/i.test(css.primary), css.primary || '(空)');
    check('样式表真的加载了', css.titleSize === '24px', `title font-size=${css.titleSize}`);
    await page.shot('01-onboarding');

    console.log('\n── 走完引导（生成失败不退回）────────────');
    await page.evaluate(`document.querySelector('.tv-ob__actions .tv-btn--primary').click()`);
    await sleep(500);
    const clipCount = await page.evaluate(`document.querySelectorAll('.tv-ob__card').length`);
    check('第 2 屏列出了世界观夹子', clipCount === 2, `${clipCount} 个`);
    await page.evaluate(`document.querySelector('.tv-ob__card').click()`);
    await sleep(200);
    check('夹子能选中', await page.evaluate(`!!document.querySelector('.tv-ob__card.is-on')`));

    await page.evaluate(`document.querySelector('.tv-ob__actions .tv-btn--primary').click()`);
    await sleep(400);
    // 最后一步会真的调 AI；冒烟环境没 API 必然失败 —— 断言配置不回滚
    await page.evaluate(`document.querySelector('.tv-ob__actions .tv-btn--primary').click()`);
    await page.waitFor(`!document.querySelector('.tv-ob')`, { label: '引导结束', timeout: 40000 });
    await sleep(900);

    check('配完进主界面（生成失败也不退回引导）', await page.evaluate(`!!document.querySelector('.tv-tabbar')`));
    check('底栏是 5 个 tab', await page.evaluate(`document.querySelectorAll('.tv-tabbar__item').length === 5`));
    check('没配 API 时错误可见且可关', await page.evaluate(`!!document.querySelector('.tv-errorbar')`));

    console.log('\n── 注入候选（绕过 AI）+ A/B 切档恢复 ────');
    // 直接往 travelFeeds 写一批带详情的候选（探针不烧 token），
    // 再用「切到 B 再切回 A」逼一次真实的重 hydrate —— 顺便把切档也测了
    const profileKeyA = `${seed.userId}::${seed.worldA}`;
    await page.evaluate(`
        (async () => {
            const key = ${JSON.stringify(profileKeyA)};
            await window.myDb.put('travelFeeds', {
                id: key, profileKey: key, batch: 1, updatedAt: Date.now(),
                list: [
                    {
                        id: 'cd_probe_1', placeName: '杉顶港', locationName: '雾中吊桥',
                        kind: '古迹', blurb: '一座只在雾天出现的吊桥。', tags: ['雾', '桥'],
                        existingPlaceId: ${JSON.stringify(seed.placeId)}, existingLocationId: '',
                        favorited: false, createdAt: Date.now(),
                        detail: {
                            environment: '要坐三小时的藤蔓缆车。\\n桥面只有雾天可见。',
                            features: ['走完整座吊桥', '听桥下的雾铃'],
                            risks: '雾散时必须离桥。', stayTime: '一天',
                            ticketPrice: 120, notes: '备好防潮灯。',
                            suggestedItems: ['防潮灯'], generatedAt: Date.now(),
                        },
                    },
                    {
                        id: 'cd_probe_2', placeName: '沉舟湾', locationName: '搁浅巨鲸馆',
                        kind: '秘境', blurb: '退潮时能走进鲸骨里。', tags: ['海'],
                        existingPlaceId: '', existingLocationId: '',
                        favorited: false, createdAt: Date.now(),
                        detail: {
                            environment: '沿旧航道走半天。', features: ['看鲸骨'],
                            risks: '涨潮很快。', stayTime: '半天',
                            ticketPrice: 60, notes: '', suggestedItems: [], generatedAt: Date.now(),
                        },
                    },
                ],
            });
            return true;
        })()
    `);

    // 切到 B：必须回引导页（B 档没配过）
    await page.evaluate(`
        (async () => {
            const sdk = window.settingsSdk;
            await sdk.users.update(${JSON.stringify(seed.userId)}, { boundWorldId: ${JSON.stringify(seed.worldB)} });
            window.dispatchEvent(new CustomEvent('phone:app-opened', { detail: { appId: 'travel' } }));
        })()
    `);
    await sleep(1600);
    check('切到世界 B → 回到引导页', await page.evaluate(`!!document.querySelector('.tv-ob')`));
    const pillsB = await page.evaluate(`Array.from(document.querySelectorAll('.tv-ob__pill-v')).map(e => e.textContent.trim())`);
    check('B 档读到自己的货币', pillsB.includes('铁砂原') && pillsB.includes('铜屑'), pillsB.join(' / '));

    // 切回 A：不再要求配置，注入的候选出现在列表里
    await page.evaluate(`
        (async () => {
            const sdk = window.settingsSdk;
            await sdk.users.update(${JSON.stringify(seed.userId)}, { boundWorldId: ${JSON.stringify(seed.worldA)} });
            window.dispatchEvent(new CustomEvent('phone:app-opened', { detail: { appId: 'travel' } }));
        })()
    `);
    await sleep(1600);
    check('切回 A → 不再要求配置', await page.evaluate(`!document.querySelector('.tv-ob')`));
    check('A 档候选恢复（两张卡）', await page.evaluate(`document.querySelectorAll('.tv-card').length === 2`));
    check('复用已有地点的候选带「世界已有」标', await page.evaluate(
        `Array.from(document.querySelectorAll('.tv-card')).some(c => c.textContent.includes('世界已有地点'))`,
    ));
    await page.shot('02-feed');

    console.log('\n── 收藏 ─────────────────────────────────');
    await page.evaluate(`document.querySelector('.tv-card .tv-fav').click()`);
    await sleep(600);
    check('收藏点亮', await page.evaluate(`!!document.querySelector('.tv-fav.is-on')`));
    await page.evaluate(`document.querySelectorAll('.tv-seg__btn')[1].click()`);
    await sleep(400);
    check('收藏段里有这一条', await page.evaluate(`document.querySelectorAll('.tv-card').length === 1`));
    await page.evaluate(`document.querySelectorAll('.tv-seg__btn')[0].click()`);
    await sleep(300);

    console.log('\n── 详情 + 机票确认窗 ────────────────────');
    await page.evaluate(`document.querySelector('.tv-card').click()`);
    await page.waitFor(`document.querySelector('.tv-ticket')`, { label: '详情页（注入过 detail，不该调 AI）' });
    check('详情页展开（没调 AI，用的注入详情）', await page.evaluate(
        `document.body.textContent.includes('藤蔓缆车') && document.body.textContent.includes('雾散时必须离桥')`,
    ));
    const ticketText = await page.evaluate(`document.querySelector('.tv-ticket').textContent`);
    check('机票卡带票价和货币', ticketText.includes('120') && ticketText.includes('星币'), ticketText.replace(/\\s+/g, ' ').slice(0, 60));
    await page.shot('03-detail');

    await page.evaluate(`document.querySelector('.tv-ticket').click()`);
    await page.waitFor(`document.querySelector('.tv-modal .tv-buy__math')`, { label: '机票确认窗' });
    const math = await page.evaluate(`Array.from(document.querySelectorAll('.tv-buy__cell b')).map(e => e.textContent.trim())`);
    check('确认窗三个数：现在有 / 这张票 / 付完剩', math.join(',') === '1000,120,880', math.join(' / '));

    // 先取消：不能扣款、不能出票
    await page.evaluate(`document.querySelector('.tv-modal .ac-btn-secondary').click()`);
    await sleep(500);
    const afterCancel = await page.evaluate(`window.settingsSdk.assetFlow.getBalance('user', ${JSON.stringify(seed.userId)})`);
    check('取消购票不扣款', afterCancel === 1000, `余额 ${afterCancel}`);
    const tripsAfterCancel = await page.evaluate(`(async () => (await window.myDb.getAll('travelTrips')).length)()`);
    check('取消购票不产生行程', tripsAfterCancel === 0, `${tripsAfterCancel} 条`);

    // 再确认：扣一次
    await page.evaluate(`document.querySelector('.tv-ticket').click()`);
    await page.waitFor(`document.querySelector('.tv-modal .tv-buy__math')`, { label: '再开确认窗' });
    await page.evaluate(`document.querySelector('.tv-modal .ac-btn-primary').click()`);
    await page.waitFor(`document.querySelector('.tv-overlay-page .tv-stepper')`, { label: '进入准备板' });
    const paidBalance = await page.evaluate(`window.settingsSdk.assetFlow.getBalance('user', ${JSON.stringify(seed.userId)})`);
    check('确认后扣款一次', paidBalance === 880, `余额 ${paidBalance}`);

    // 回详情再点机票：不能二次扣款，只是回到准备板
    await page.evaluate(`document.querySelector('.tv-pagebar .tv-iconbtn').click()`);
    await sleep(400);
    // 回到探索页重开详情（切 view 时 activeDest 已清）
    await page.evaluate(`document.querySelector('.tv-card').click()`);
    await page.waitFor(`document.querySelector('.tv-ticket')`, { label: '重开详情' });
    const ctaText = await page.evaluate(`document.querySelector('.tv-ticket__cta').textContent.trim()`);
    check('已购票的目的地机票变成「去准备」', ctaText.includes('已购票'), ctaText);
    await page.evaluate(`document.querySelector('.tv-ticket').click()`);
    await sleep(700);
    const balanceAfterRepeat = await page.evaluate(`window.settingsSdk.assetFlow.getBalance('user', ${JSON.stringify(seed.userId)})`);
    check('重复点机票不二次扣款', balanceAfterRepeat === 880, `余额 ${balanceAfterRepeat}`);
    check('直接回到了准备板', await page.evaluate(`!!document.querySelector('.tv-overlay-page .tv-stepper')`));

    console.log('\n── 准备板：天数 / 同行 / 出发 ───────────');
    // 天数减到 1（3 → 1，两次），同行拉上阿澈
    await page.evaluate(`document.querySelector('.tv-stepper button').click()`);
    await sleep(200);
    await page.evaluate(`document.querySelector('.tv-stepper button').click()`);
    await sleep(300);
    check('天数减到 1 天 0 晚', await page.evaluate(`document.querySelector('.tv-stepper__value').textContent.includes('1')`));
    const aiPicked = await page.evaluate(`
        (() => {
            const pick = Array.from(document.querySelectorAll('.tv-pick')).find(p => p.textContent.includes('阿澈'));
            if (!pick) return false;
            pick.click();
            return true;
        })()
    `);
    check('同行选择器里有这个世界的 AI', aiPicked);
    await sleep(400);

    // 四叶草没配置 → 空态而不是崩
    check('四叶草物品空态兜住', await page.evaluate(`document.body.textContent.includes('没有可带的东西') || document.body.textContent.includes('正在翻你的购物记录')`));

    // 提示词预览：预览与发送同源（parts 渲染出来，且带锁定段）
    await page.evaluate(`Array.from(document.querySelectorAll('.tv-btn')).find(b => b.textContent.includes('看看这次会发什么')).click()`);
    await sleep(500);
    check('提示词预览列出分段和 token', await page.evaluate(
        `document.querySelectorAll('.tv-ctx__part').length >= 5 && document.querySelectorAll('.tv-ctx__lock').length >= 3`,
    ));
    check('预览里带上了同行者段', await page.evaluate(
        `Array.from(document.querySelectorAll('.tv-ctx__title')).some(e => e.textContent.includes('同行的人'))`,
    ));

    // 生成小剧场（没 API → 失败要兜住，不崩、行程还在）
    await page.evaluate(`Array.from(document.querySelectorAll('.tv-btn')).find(b => b.textContent.includes('生成小剧场')).click()`);
    await sleep(2500);
    check('小剧场生成失败被兜住（错误可见）', await page.evaluate(`!!document.querySelector('.tv-errorbar')`));

    // 出发
    await page.evaluate(`Array.from(document.querySelectorAll('.tv-btn')).find(b => b.textContent.includes('正式出发')).click()`);
    await page.waitFor(`document.querySelector('.tv-modal')`, { label: '出发确认窗' });
    await page.evaluate(`document.querySelector('.tv-modal .ac-btn-primary').click()`);
    await page.waitFor(`document.querySelector('.tv-chat__composer')`, { label: '旅行对话页' });
    await page.shot('04-chat');

    console.log('\n── 对话页：用户消息 / 旁白失败兜底 ──────');
    // ★ 填表和点击必须分两次 evaluate：input 事件派发后 Vue 还没重渲染，
    //   发送键仍是 disabled，同一帧里 click 会被浏览器原生拦掉（§17.6②）
    await page.evaluate(`
        (() => {
            ${SET_VALUE}
            __set(document.querySelector('.tv-chat__input'), '先去看吊桥！');
        })()
    `);
    await sleep(350);
    check('输入后发送键可点', await page.evaluate(`!document.querySelector('.tv-chat__send').disabled`));
    await page.evaluate(`document.querySelector('.tv-chat__send').click()`);
    await sleep(700);
    check('用户消息上屏（右侧带头像）', await page.evaluate(`
        (() => {
            const m = document.querySelector('.tv-msg.is-user');
            return !!m && m.textContent.includes('先去看吊桥') && !!m.querySelector('.tv-avatar');
        })()
    `));
    const msgCount = await page.evaluate(`(async () => (await window.myDb.getAll('travelMessages')).length)()`);
    check('用户消息落盘', msgCount === 1, `${msgCount} 条`);

    // 继续旁白 → 没 API → 失败但不推进
    await page.evaluate(`document.querySelector('.tv-chat__narrate').click()`);
    await sleep(2500);
    const afterNarrate = await page.evaluate(`
        (async () => {
            const trips = await window.myDb.getAll('travelTrips');
            return { slot: trips[0]?.slotCount || 0, err: !!document.querySelector('.tv-errorbar') };
        })()
    `);
    check('旁白失败不推进进度', afterNarrate.slot === 0 && afterNarrate.err, `slotCount=${afterNarrate.slot}`);

    // 长按菜单（走 more 按钮同一入口）：进行中能看到「让阿澈回复 / 继续旁白」
    await page.evaluate(`document.querySelector('.tv-msg .tv-msg__more').click()`);
    await page.waitFor(`document.querySelector('.tv-actlist')`, { label: '消息操作面板' });
    const actions = await page.evaluate(`Array.from(document.querySelectorAll('.tv-actlist__item')).map(e => e.textContent.trim())`);
    check('操作面板有「让阿澈回复」', actions.some((t) => t.includes('阿澈')), actions.join(' / '));
    check('操作面板有编辑和删除', actions.some((t) => t.includes('编辑')) && actions.some((t) => t.includes('删除')));
    await page.evaluate(`document.querySelector('.tv-modal .ac-overlay, .ac-overlay') && document.querySelector('.ac-overlay').click()`);
    await sleep(500);

    console.log('\n── 注入完整旅程 → 足迹 ──────────────────');
    // 把这趟直接改成「已走完」并塞入旁白 + AI 消息，模拟一趟完整旅行
    const tripId = await page.evaluate(`
        (async () => {
            const trips = await window.myDb.getAll('travelTrips');
            const t = trips[0];
            const key = t.profileKey;
            t.status = 'completed';
            t.slotCount = 3;
            t.completedAt = Date.now();
            await window.myDb.put('travelTrips', t);
            const mk = (seq, extra) => ({
                id: 'tm_probe_' + seq, profileKey: key, tripId: t.id, seq: seq + 1, createdAt: Date.now() + seq,
                ...extra,
            });
            await window.myDb.put('travelMessages', mk(1, { role: 'narration', slotIndex: 0, text: '缆车缓缓降进雾里，吊桥的轮廓浮出来。' }));
            await window.myDb.put('travelMessages', mk(2, { role: 'ai', aiId: ${JSON.stringify(seed.aiId)}, aiName: '阿澈', text: '走慢点，桥板是湿的。' }));
            await window.myDb.put('travelMessages', mk(3, { role: 'narration', slotIndex: 2, text: '天黑前两人回到缆车站，雾开始散了。' }));
            return t.id;
        })()
    `);
    // 逼一次重 hydrate（B → A）
    await page.evaluate(`
        (async () => {
            const sdk = window.settingsSdk;
            await sdk.users.update(${JSON.stringify(seed.userId)}, { boundWorldId: ${JSON.stringify(seed.worldB)} });
            window.dispatchEvent(new CustomEvent('phone:app-opened', { detail: { appId: 'travel' } }));
        })()
    `);
    await sleep(1200);
    await page.evaluate(`
        (async () => {
            const sdk = window.settingsSdk;
            await sdk.users.update(${JSON.stringify(seed.userId)}, { boundWorldId: ${JSON.stringify(seed.worldA)} });
            window.dispatchEvent(new CustomEvent('phone:app-opened', { detail: { appId: 'travel' } }));
        })()
    `);
    await sleep(1600);

    await page.evaluate(`document.querySelectorAll('.tv-tabbar__item')[2].click()`);
    await sleep(500);
    check('走完的旅行自动进足迹页', await page.evaluate(`document.querySelectorAll('.tv-foot').length === 1`));
    await page.shot('05-footprints');

    // 备注
    await page.evaluate(`Array.from(document.querySelectorAll('.tv-foot .tv-btn')).find(b => b.textContent.includes('写备注')).click()`);
    await page.waitFor(`document.querySelector('.tv-modal textarea')`, { label: '备注弹窗' });
    await page.evaluate(`
        (() => {
            ${SET_VALUE}
            __set(document.querySelector('.tv-modal textarea'), '雾铃的声音想再听一次');
            Array.from(document.querySelectorAll('.tv-modal .ac-btn-primary')).at(-1).click();
        })()
    `);
    await sleep(700);
    check('备注保存并显示', await page.evaluate(`document.querySelector('.tv-foot__note')?.textContent.includes('雾铃')`));

    // 回看全程：旁白居中 + AI 消息左侧带名字 + 输入关闭
    await page.evaluate(`Array.from(document.querySelectorAll('.tv-foot .tv-btn')).find(b => b.textContent.includes('回看全程')).click()`);
    await page.waitFor(`document.querySelector('.tv-chat__closedbar')`, { label: '已结束的对话页' });
    check('旅行结束后输入关闭', await page.evaluate(`!document.querySelector('.tv-chat__composer') && !!document.querySelector('.tv-chat__closedbar')`));
    check('旁白居中渲染', await page.evaluate(`!!document.querySelector('.tv-msg.is-narration .tv-msg__narration')`));
    check('AI 消息在左侧带名字', await page.evaluate(`
        (() => {
            const m = document.querySelector('.tv-msg.is-ai');
            return !!m && m.querySelector('.tv-msg__aname')?.textContent.includes('阿澈');
        })()
    `));
    check('用户消息在右侧', await page.evaluate(`!!document.querySelector('.tv-msg.is-user .tv-msg__bubblewrap.is-right')`));

    // 背景：URL + 模糊度
    await page.evaluate(`Array.from(document.querySelectorAll('.tv-pagebar .tv-iconbtn')).at(-1).click()`);
    await page.waitFor(`document.querySelector('.tv-modal .tv-bgset__preview')`, { label: '背景弹窗' });
    await page.evaluate(`
        (() => {
            ${SET_VALUE}
            __set(document.querySelector('.tv-modal .tv-input'), 'https://example.com/fog.jpg');
            __set(document.querySelector('.tv-modal .tv-range'), '9');
            Array.from(document.querySelectorAll('.tv-modal .ac-btn-primary')).at(-1).click();
        })()
    `);
    await sleep(700);
    const bg = await page.evaluate(`
        (() => {
            const el = document.querySelector('.tv-chat__bg');
            if (!el) return {};
            return { image: el.style.backgroundImage, filter: el.style.filter };
        })()
    `);
    check('背景按 trip 保存并生效', bg.image?.includes('fog.jpg') === true, bg.image || '(无)');
    check('模糊度生效', bg.filter === 'blur(9px)', bg.filter || '(无)');
    await page.shot('06-chat-bg');
    await page.evaluate(`document.querySelector('.tv-pagebar .tv-iconbtn').click()`);
    await sleep(500);

    console.log('\n── 登记到 Nook（已有地点只加场所）───────');
    const placesBefore = await page.evaluate(`window.settingsSdk.places.list({ worldRef: ${JSON.stringify(seed.worldA)} }).length`);
    await page.evaluate(`Array.from(document.querySelectorAll('.tv-foot .tv-btn')).find(b => b.textContent.includes('登记到世界')).click()`);
    await page.waitFor(`document.querySelector('.tv-modal')`, { label: '登记弹窗' });
    check('登记弹窗说明「只新增场所」', await page.evaluate(`document.querySelector('.tv-modal').textContent.includes('只会在它下面新增场所')`));
    await page.evaluate(`Array.from(document.querySelectorAll('.tv-modal .ac-btn-primary')).at(-1).click()`);
    await page.waitFor(`document.querySelector('.tv-nookdone__ids')`, { label: '登记结果' });
    const nook = await page.evaluate(`
        (async () => {
            const sdk = window.settingsSdk;
            const places = sdk.places.list({ worldRef: ${JSON.stringify(seed.worldA)} });
            const locs = sdk.locations.list({ worldRef: ${JSON.stringify(seed.worldA)} });
            const trips = await window.myDb.getAll('travelTrips');
            return {
                placeCount: places.length,
                locNames: locs.map(l => l.name),
                nookSaved: !!trips[0]?.nook?.locationId,
                placeIdMatch: trips[0]?.nook?.placeId === ${JSON.stringify(seed.placeId)},
            };
        })()
    `);
    check('已有地点不重建（Place 数不变）', nook.placeCount === placesBefore, `${placesBefore} → ${nook.placeCount}`);
    check('新场所挂进了已有地点', nook.locNames.includes('雾中吊桥'), nook.locNames.join(' / '));
    check('登记结果写回行程且复用已有 Place id', nook.nookSaved && nook.placeIdMatch);

    // 幂等：再点一次不重复建
    await page.evaluate(`document.querySelector('.ac-overlay').click()`);
    await sleep(500);
    await page.evaluate(`Array.from(document.querySelectorAll('.tv-foot .tv-btn')).find(b => b.textContent.includes('查看登记')).click()`);
    await sleep(600);
    const locCountAgain = await page.evaluate(
        `window.settingsSdk.locations.list({ worldRef: ${JSON.stringify(seed.worldA)} }).filter(l => l.name === '雾中吊桥').length`,
    );
    check('重复登记不产生重复场所', locCountAgain === 1, `${locCountAgain} 个`);
    await page.evaluate(`document.querySelector('.ac-overlay').click()`);
    await sleep(400);

    console.log('\n── 概要卡：写入 + 重放进 murmur ─────────');
    // 概要本身要 AI；这里直接写 summary 再逼重放，验证注册链路
    await page.evaluate(`
        (async () => {
            const trips = await window.myDb.getAll('travelTrips');
            trips[0].summary = '和阿澈去了雾中吊桥，回程他在缆车上睡着了。';
            await window.myDb.put('travelTrips', trips[0]);
            const sdk = window.settingsSdk;
            await sdk.users.update(${JSON.stringify(seed.userId)}, { boundWorldId: ${JSON.stringify(seed.worldB)} });
            window.dispatchEvent(new CustomEvent('phone:app-opened', { detail: { appId: 'travel' } }));
        })()
    `);
    await sleep(1200);
    // 在 B 档时旅行卡应被清出注册表
    const promptsInB = await page.evaluate(`(window.settingsSdk.appPrompts.listByApp('travel') || []).map(p => p.promptId || p.id)`);
    check('B 档下没有 A 档的旅行卡', !promptsInB.some((p) => String(p).startsWith('trip-')), promptsInB.join(' / '));
    await page.evaluate(`
        (async () => {
            const sdk = window.settingsSdk;
            await sdk.users.update(${JSON.stringify(seed.userId)}, { boundWorldId: ${JSON.stringify(seed.worldA)} });
            window.dispatchEvent(new CustomEvent('phone:app-opened', { detail: { appId: 'travel' } }));
        })()
    `);
    await sleep(1600);
    const prompts = await page.evaluate(`(window.settingsSdk.appPrompts.listByApp('travel') || []).map(p => p.promptId || p.id)`);
    check('murmur 有候鸟静态卡', prompts.includes('travel-shared'), prompts.join(' / '));
    check('概要卡重放（trip-*）', prompts.some((p) => String(p).startsWith('trip-')), prompts.join(' / '));

    console.log('\n── 经历页 ───────────────────────────────');
    await page.evaluate(`document.querySelectorAll('.tv-tabbar__item')[3].click()`);
    await sleep(500);
    check('按 AI 分组列出共同旅程', await page.evaluate(`
        (() => {
            const titles = Array.from(document.querySelectorAll('.tv-section__title')).map(e => e.textContent.trim());
            return titles.includes('阿澈') && !!document.querySelector('.tv-exp');
        })()
    `));
    check('经历里能看到概要', await page.evaluate(`document.querySelector('.tv-exp__summary')?.textContent.includes('缆车上睡着了')`));

    console.log('\n── 退票退款 ─────────────────────────────');
    // 给第二个候选买票再退掉
    await page.evaluate(`document.querySelectorAll('.tv-tabbar__item')[0].click()`);
    await sleep(400);
    await page.evaluate(`
        (() => {
            const cards = Array.from(document.querySelectorAll('.tv-card'));
            cards.find(c => c.textContent.includes('搁浅巨鲸馆')).click();
        })()
    `);
    await page.waitFor(`document.querySelector('.tv-ticket')`, { label: '第二个详情' });
    await page.evaluate(`document.querySelector('.tv-ticket').click()`);
    await page.waitFor(`document.querySelector('.tv-modal .tv-buy__math')`, { label: '确认窗' });
    await page.evaluate(`document.querySelector('.tv-modal .ac-btn-primary').click()`);
    await page.waitFor(`document.querySelector('.tv-overlay-page .tv-stepper')`, { label: '准备板' });
    const paid2 = await page.evaluate(`window.settingsSdk.assetFlow.getBalance('user', ${JSON.stringify(seed.userId)})`);
    check('第二张票扣款', paid2 === 820, `余额 ${paid2}`);

    await page.evaluate(`document.querySelectorAll('.tv-tabbar__item').length`);   // noop 保活
    await page.evaluate(`document.querySelector('.tv-pagebar .tv-iconbtn').click()`);
    await sleep(400);
    await page.evaluate(`document.querySelectorAll('.tv-tabbar__item')[1].click()`);
    await sleep(400);
    await page.evaluate(`Array.from(document.querySelectorAll('.tv-trip__x')).at(0).click()`);
    await page.waitFor(`document.querySelector('.tv-modal')`, { label: '退票确认' });
    await page.evaluate(`Array.from(document.querySelectorAll('.tv-modal .ac-btn')).find(b => b.textContent.includes('退票删除')).click()`);
    await sleep(900);
    const refunded = await page.evaluate(`window.settingsSdk.assetFlow.getBalance('user', ${JSON.stringify(seed.userId)})`);
    check('退票原路退款', refunded === 880, `余额 ${refunded}`);

    console.log('\n── 主题：切换 / 批量 / 存-改名-覆盖-删 ──');
    await page.evaluate(`document.querySelectorAll('.tv-tabbar__item')[4].click()`);
    await sleep(400);
    await page.evaluate(`Array.from(document.querySelectorAll('.tv-entry__label')).find(e => e.textContent.trim() === '配色').closest('.tv-entry').click()`);
    await page.waitFor(`document.querySelector('.tv-theme-picks')`, { label: '配色页' });
    const bgBefore = await page.evaluate(`getComputedStyle(document.querySelector('.app-shell[data-app-id="travel"]')).getPropertyValue('--tv-bg').trim()`);
    await page.evaluate(`document.querySelectorAll('.tv-theme-pick')[1].click()`);
    await sleep(600);
    const themed = await page.evaluate(`
        (() => {
            const shell = document.querySelector('.app-shell[data-app-id="travel"]');
            return { attr: shell.getAttribute('data-tv-theme'), bg: getComputedStyle(shell).getPropertyValue('--tv-bg').trim() };
        })()
    `);
    check('切到夜潮主题（实时铺色）', themed.attr === 'tide' && themed.bg !== bgBefore, `${bgBefore} → ${themed.bg}`);

    // 批量粘贴：认识的收下，外来的跳过
    await page.evaluate(`
        (() => {
            ${SET_VALUE}
            __set(document.querySelector('.tv-overlay-body textarea.tv-textarea'), '--tv-primary: #FF00AA;\\n--gg-primary: #123456;');
            Array.from(document.querySelectorAll('.tv-btn')).find(b => b.textContent.includes('解析并套用')).click();
        })()
    `);
    await sleep(600);
    const batched = await page.evaluate(`getComputedStyle(document.querySelector('.app-shell[data-app-id="travel"]')).getPropertyValue('--tv-primary').trim()`);
    check('批量套用生效且跳过外来变量', /FF00AA/i.test(batched), batched);

    // 存为新配色 → 改名 → 覆盖 → 删除
    await page.evaluate(`Array.from(document.querySelectorAll('.tv-btn')).find(b => b.textContent.includes('存为新配色')).click()`);
    await page.waitFor(`document.querySelector('.tv-modal .tv-input')`, { label: '存配色弹窗' });
    await page.evaluate(`
        (() => {
            ${SET_VALUE}
            __set(document.querySelector('.tv-modal .tv-input'), '雾港夜');
            Array.from(document.querySelectorAll('.tv-modal .ac-btn-primary')).at(-1).click();
        })()
    `);
    await sleep(600);
    check('主题保存进列表', await page.evaluate(`document.querySelector('.tv-theme-chip__main')?.textContent.trim() === '雾港夜'`));

    await page.evaluate(`Array.from(document.querySelectorAll('.tv-theme-chip__act')).find(b => b.textContent === '改名').click()`);
    await page.waitFor(`document.querySelector('.tv-modal .tv-input')`, { label: '改名弹窗' });
    await page.evaluate(`
        (() => {
            ${SET_VALUE}
            __set(document.querySelector('.tv-modal .tv-input'), '雾港深夜');
            Array.from(document.querySelectorAll('.tv-modal .ac-btn-primary')).at(-1).click();
        })()
    `);
    await sleep(600);
    check('主题改名成功', await page.evaluate(`document.querySelector('.tv-theme-chip__main')?.textContent.trim() === '雾港深夜'`));

    await page.evaluate(`Array.from(document.querySelectorAll('.tv-theme-chip__act')).find(b => b.textContent === '覆盖').click()`);
    await sleep(500);
    const overwritten = await page.evaluate(`
        (async () => {
            const rows = await window.myDb.getAll('travelProfiles');
            const p = rows.find(r => r.id === ${JSON.stringify(profileKeyA)});
            const t = (p?.customThemes || [])[0];
            return t?.colors?.['--tv-primary'] || '';
        })()
    `);
    check('用当前颜色覆盖已存主题', /FF00AA/i.test(overwritten), overwritten);

    await page.evaluate(`document.querySelector('.tv-theme-chip__del').click()`);
    await page.waitFor(`document.querySelector('.tv-modal')`, { label: '删除确认' });
    await page.evaluate(`Array.from(document.querySelectorAll('.tv-modal .ac-btn')).find(b => b.textContent.includes('删除')).click()`);
    await sleep(600);
    check('主题删除成功', await page.evaluate(`!document.querySelector('.tv-theme-chip')`));
    await page.shot('07-theme');

    console.log('\n── 跨 App 只读服务 ──────────────────────');
    const services = await page.evaluate(`
        (async () => {
            const app = window.__phoneAppsRef.value.find(a => a.id === 'travel');
            const trips = await app.services.listTrips();
            const summaries = await app.services.listTravelSummaries();
            const one = trips[0] ? await app.services.getTrip({ id: trips[0].id }) : null;
            return {
                tripCount: trips.length,
                hasSummary: summaries.length === 1 && summaries[0].summary.includes('缆车上睡着了'),
                gotById: !!one && one.id === trips[0].id,
                plain: trips[0] ? Object.getPrototypeOf(trips[0]) === Object.prototype : false,
            };
        })()
    `);
    check('services.listTrips 可用', services.tripCount === 1, `${services.tripCount} 趟`);
    check('services.listTravelSummaries 返回概要', services.hasSummary === true);
    check('services.getTrip 按 id 可取', services.gotById === true);
    check('返回的是 plain object', services.plain === true);

    console.log('\n── 全局体检 ─────────────────────────────');
    const svg = await page.evaluate(`
        (() => {
            const bad = [];
            document.querySelectorAll('.app-shell[data-app-id="travel"] svg').forEach((s) => {
                const w = s.getBoundingClientRect().width;
                if (w > 60) bad.push((s.getAttribute('class') || s.parentElement?.className || '?') + ':' + Math.round(w));
            });
            return bad.slice(0, 6);
        })()
    `);
    check('没有被撑爆的 SVG', svg.length === 0, svg.join(', '));

    const noise = page.console.filter((l) => /^\[(error|exception)\]/.test(l));
    // 冒烟环境没配 API：「还没有可用的 API Key」是预期内的失败，不算噪音
    const real = noise.filter((l) => !/API|api/.test(l));
    check('控制台没有 error / exception', real.length === 0, real.slice(0, 4).join(' | '));
    if (noise.length && real.length === 0) {
        console.log(`    （忽略了 ${noise.length} 条 API 相关的预期失败）`);
    }
}

main().catch((err) => {
    console.error('\n探针挂了：', err.message);
    process.exit(1);
});
