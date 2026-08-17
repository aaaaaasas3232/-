/**
 * 萤火（视频 App）· 浏览器冒烟（真实 Edge / Chrome，走 CDP）
 *
 * 只查纯静态检查抓不到的：
 *   1. 控制台没有 error / exception（API 缺失的预期失败除外）
 *   2. CSS 真的加载了（断言 computed style，不是「文件在不在」）
 *   3. 首配门闸 + A/B 档案切换与恢复
 *   4. 注入数据后的完整交互链：列表 → 详情（不该调 AI）→ 99+ 评论 →
 *      作者主页 → 关注 → 离线直播间 / 在播直播（弹幕 JS 分发、发弹幕落盘）
 *   5. 站内闲聊（消息无编辑/删除/重 roll）→ 加好友（写进 nook 角色库，幂等）
 *   6. 我的频道：发布 / 编辑 / 删除，评论总量 99+（JS 算，不调 AI）
 *   7. 收藏、私信收件箱（注入 + 删除）
 *   8. murmur：分享出视频卡 → 点卡先 AcModal → 取消不生成 → 确认回详情；
 *      AI 快照卡（内容不存在）确认后优雅报错不崩
 *   9. 主题切换 dusk 生效
 *
 * ★ 不测 AI 生成（要烧 token 且不可复现）；生成链路正确性由
 *   prompt-builder 纯函数 + tests/youtube-app.test.js 保证。
 *   探针里凡是「点了会调 AI」的地方，断言的是**失败被兜住**（不崩、不丢档）。
 *
 * ★ 直播开播判定是「creatorId + 6 小时时间窗」的种子随机 ——
 *   探针在 Node 侧用同一份纯函数挑出「这个窗口正在播 / 不在播」的两个 id。
 *   在窗口边界前后几秒运行可能翻车（概率可忽略，重跑即可）。
 *
 * 用法：先 `npm run dev`，再 `node tests/e2e/__probe-youtube.mjs`
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { isLiveNow } from '../../js/apps/youtube-app/services/stats.js';
import { LIVE_CHANCE, LIVE_WINDOW_MS } from '../../js/apps/youtube-app/constants.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const BROWSERS = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];
const BASE = 'http://localhost:5173';
const PORT = 9600 + Math.floor(Math.random() * 180);
const PROFILE = path.join(os.tmpdir(), `yt-probe-${Date.now()}`);
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
        const file = path.join(ROOT, `yt-probe-${name}.png`);
        fs.writeFileSync(file, Buffer.from(res.data, 'base64'));
        return file;
    }

    /** 按可见文本点按钮（组件里很多按钮没有稳定 class） */
    async clickByText(scope, text) {
        return this.evaluate(`
            (() => {
                const root = document.querySelector(${JSON.stringify(scope)}) || document;
                const btn = Array.from(root.querySelectorAll('button'))
                    .find(b => b.textContent.replace(/\\s+/g, '').includes(${JSON.stringify(text)}));
                if (!btn) return false;
                btn.click();
                return true;
            })()
        `);
    }

    /** 连点返回直到底栏出现（覆盖页时底栏是藏起来的，直接点 tab 会点空） */
    async backToTabs() {
        for (let i = 0; i < 6; i += 1) {
            const done = await this.evaluate(`
                (() => {
                    if (document.querySelector('.app-shell[data-app-id="youtube"] .yt-tabbar')) return true;
                    document.querySelector('.app-shell[data-app-id="youtube"] .yt-subtop__back')?.click();
                    return false;
                })()
            `);
            if (done) return true;
            await sleep(350);
        }
        return this.evaluate(`!!document.querySelector('.app-shell[data-app-id="youtube"] .yt-tabbar')`);
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

// ── Node 侧先算好：这个窗口谁在播、谁不在播（和页面用同一份纯函数）──
const STAMP = Math.floor(Date.now() / LIVE_WINDOW_MS);
function findCreatorId(wantLive) {
    for (let i = 0; i < 500; i += 1) {
        const id = `crprobe_${wantLive ? 'live' : 'off'}_${i}`;
        if (isLiveNow(id, STAMP, LIVE_CHANCE) === wantLive) return id;
    }
    throw new Error('500 次都没挑出想要的开播状态，见了鬼');
}
const CR_LIVE = findCreatorId(true);
const CR_OFF = findCreatorId(false);

/** 造两个世界观 + 默认用户绑 A + 一个世界 AI */
const SEED = `
(async () => {
    const sdk = window.settingsSdk;
    if (!sdk) return { ok: false, error: 'settingsSdk 未就绪' };

    const a = (await sdk.worlds.create({
        name: '雾杉泽', summary: '建在巨杉之上的世界，涨潮时低处的街道会沉进海里。',
        currencyName: '星币',
        flows: [
            { id: 'flow-yt-a-0', title: '潮汐历', content: '每月两次大潮，全城迁往高层。' },
            { id: 'flow-yt-a-1', title: '缆车网', content: '城区之间靠藤蔓缆车通行。' },
        ],
    })).id;
    const b = (await sdk.worlds.create({
        name: '铁砂原', summary: '一望无际的铁色沙原。',
        currencyName: '铜屑',
    })).id;

    let user = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.();
    if (!user) user = await sdk.users.create({ name: '阿听' });
    await sdk.users.update(user.id, { boundWorldId: a });
    if (sdk.defaultUserCard?.setDefault) await sdk.defaultUserCard.setDefault(user.id);

    const ai = await sdk.aiPersons.create({ name: '阿澈', boundWorldId: a, personality: '毒舌但靠谱' });
    const aiCountBefore = sdk.aiPersons.list().length;

    return { ok: true, worldA: a, worldB: b, userId: user.id, aiId: ai.id, aiCountBefore };
})()
`;

/** 给 input / textarea 赋值并触发 Vue 的 v-model（var：同一页面会被求值多次） */
const SET_VALUE = `
    var __set = (el, v) => {
        if (!el) return false;
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    };
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
        check(`探针中断: ${err.message}`, false);
        const noise = page.console.filter((l) => /^\[(error|exception)\]/.test(l));
        noise.slice(-8).forEach((l) => console.log('    ' + l));
        try { await page.shot('99-crash'); } catch (_) { /* noop */ }
    }

    console.log('\n────────────────────────────────────────');
    const bad = results.filter((r) => !r.ok);
    console.log(`${results.length - bad.length}/${results.length} 通过`);
    if (bad.length) {
        console.log('\n没过的：');
        bad.forEach((b) => console.log('  ✗ ' + b.label));
    }

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

async function run(page) {
    console.log('\n── 启动 ─────────────────────────────────');
    await page.send('Page.navigate', { url: BASE });
    await page.waitFor(
        `window.__phoneAppsRef && (window.__phoneAppsRef.value || []).some(a => a.id === 'diary')`,
        { label: 'app 注册', timeout: 40000 },
    );
    await sleep(1500);

    check('没绑世界观时桌面不出现萤火', await page.evaluate(
        `!(window.__phoneAppsRef.value || []).some(a => a.id === 'youtube')`,
    ));
    check('murmur 折叠区注册了 2 张萤火提示词卡', await page.evaluate(
        `(window.settingsSdk?.appPrompts?.listByApp?.('youtube') || []).length === 2`,
    ));

    console.log('\n── 造世界观 ─────────────────────────────');
    const seed = await page.evaluate(SEED);
    if (!seed?.ok) throw new Error('种子数据失败：' + (seed?.error || '未知'));
    console.log(`  worldA=${seed.worldA} worldB=${seed.worldB} user=${seed.userId} ai=${seed.aiId}`);
    const profileKeyA = `${seed.userId}::${seed.worldA}`;

    await page.evaluate(`window.refreshPhoneApps?.()`);
    await page.waitFor(
        `(window.__phoneAppsRef.value || []).some(a => a.id === 'youtube')`,
        { label: '绑定世界后萤火出现', timeout: 15000 },
    );
    check('绑定世界后萤火自动出现在桌面', true);
    check('声明了社媒形象（nook 人设卡会出现萤火区）', await page.evaluate(
        `window.__phoneAppsRef.value.find(a => a.id === 'youtube')?.socialProfile?.label === '萤火'`,
    ));

    console.log('\n── 打开萤火：首配门闸 ───────────────────');
    await page.evaluate(`window.dispatchEvent(new CustomEvent('app:page-action', { detail: { action: 'openApp', appId: 'youtube' } }))`);
    await page.waitFor(`document.querySelector('.app-shell[data-app-id="youtube"] .yt-root')`, { label: '根组件挂载' });
    await sleep(1400);

    check('首次进入走引导页', await page.evaluate(`!!document.querySelector('.yt-ob')`));
    const pills = await page.evaluate(`Array.from(document.querySelectorAll('.yt-ob__pill-v')).map(e => e.textContent.trim())`);
    check('引导页读到世界名', pills.includes('雾杉泽'), pills.join(' / '));

    const css = await page.evaluate(`
        (() => {
            const shell = document.querySelector('.app-shell[data-app-id="youtube"]');
            const cs = getComputedStyle(shell);
            const t = document.querySelector('.yt-ob__title');
            return {
                primary: cs.getPropertyValue('--yt-primary').trim(),
                titleSize: t ? getComputedStyle(t).fontSize : '',
            };
        })()
    `);
    check('主题 token 生效（--yt-primary）', /^#C4485B$/i.test(css.primary), css.primary || '(空)');
    check('样式表真的加载了', css.titleSize === '21px', `title font-size=${css.titleSize}`);
    await page.shot('01-onboarding');

    console.log('\n── 走完引导（生成失败不退回）────────────');
    await page.evaluate(`document.querySelector('.yt-ob__actions .yt-btn--primary').click()`);
    await sleep(500);
    const clipCount = await page.evaluate(`document.querySelectorAll('.yt-ob__card').length`);
    check('第 2 屏列出了世界观夹子', clipCount === 2, `${clipCount} 个`);
    await page.evaluate(`document.querySelector('.yt-ob__card').click()`);
    await sleep(200);
    check('夹子能选中', await page.evaluate(`!!document.querySelector('.yt-ob__card.is-on')`));

    await page.evaluate(`document.querySelector('.yt-ob__actions .yt-btn--primary').click()`);
    await sleep(500);
    // 频道步：昵称 + 粉丝数（填一百万，后面「评论 99+」要靠它）
    await page.evaluate(`
        ${SET_VALUE}
        __set(document.querySelector('.yt-ob input.yt-input:not(.yt-ob__followers)'), '夜航听众');
        __set(document.querySelector('.yt-ob__followers'), '1000000');
    `);
    await sleep(300);
    check('频道步能填昵称和粉丝数', await page.evaluate(
        `document.querySelector('.yt-ob__followers').value === '1000000'`,
    ));

    await page.evaluate(`document.querySelector('.yt-ob__actions .yt-btn--primary').click()`);
    await sleep(400);
    // 最后一步会真的调 AI；冒烟环境没 API 必然失败 —— 断言配置不回滚
    await page.evaluate(`document.querySelector('.yt-ob__actions .yt-btn--primary').click()`);
    await page.waitFor(`!document.querySelector('.yt-ob')`, { label: '引导结束', timeout: 40000 });
    await sleep(900);

    check('配完进主界面（生成失败也不退回引导）', await page.evaluate(`!!document.querySelector('.yt-tabbar')`));
    check('底栏是 5 个 tab', await page.evaluate(`document.querySelectorAll('.yt-tabbar__item').length === 5`));
    check('没配 API 时错误可见且可关', await page.evaluate(`!!document.querySelector('.yt-error')`));

    console.log('\n── 注入数据（绕过 AI）+ A/B 切档恢复 ────');
    await page.evaluate(`
        (async () => {
            const key = ${JSON.stringify(profileKeyA)};
            const now = Date.now();
            // 三个站内用户：在播主播 / 不在播主播 / 观众
            await window.myDb.put('youtubeCreators', {
                id: key + '::' + ${JSON.stringify(CR_LIVE)}, profileKey: key,
                creatorId: ${JSON.stringify(CR_LIVE)}, name: '雾中灯塔', kind: 'creator',
                bio: '住在灯塔里的记录者。', personality: '慢声细语，爱用比喻',
                followers: 48000, following: 12,
                works: [
                    { id: 'w1', title: '夜航记录·第七夜', coverText: '夜航', coverHue: 4, views: 32000, durationSec: 480, durationLabel: '8:00' },
                    { id: 'w2', title: '灯塔顶的日出', coverText: '日出', coverHue: 1, views: 21000, durationSec: 300, durationLabel: '5:00' },
                ],
                profileGenerated: true, followed: false, nookPersonId: '', firstSeenAt: now, updatedAt: now,
            });
            await window.myDb.put('youtubeCreators', {
                id: key + '::' + ${JSON.stringify(CR_OFF)}, profileKey: key,
                creatorId: ${JSON.stringify(CR_OFF)}, name: '早起的鸟', kind: 'creator',
                bio: '爱蹲首页的路人频道。', personality: '话痨，热心',
                followers: 800, following: 200,
                works: [{ id: 'w3', title: '晨市随拍', coverText: '晨市', coverHue: 2, views: 900, durationSec: 240, durationLabel: '4:00' }],
                profileGenerated: true, followed: false, nookPersonId: '', firstSeenAt: now, updatedAt: now,
            });
            // 列表两条（stub），其中 v_probe_1 已经有完整详情（在 videos 表里）
            await window.myDb.put('youtubeFeeds', {
                id: key, profileKey: key, batch: 1, updatedAt: now,
                list: [
                    {
                        id: 'v_probe_1', title: '杉顶采露记', coverText: '采露', coverHue: 0,
                        creatorId: ${JSON.stringify(CR_LIVE)}, creatorName: '雾中灯塔',
                        kind: '日常', blurb: '凌晨四点的杉顶，露水正好。', tags: ['日常', '杉顶'],
                        durationSec: 420, durationLabel: '7:00', views: 12000,
                        publishedLabel: '3天前', favorited: false, createdAt: now,
                    },
                    {
                        id: 'v_probe_2', title: '晨市砍价实录', coverText: '砍价', coverHue: 3,
                        creatorId: ${JSON.stringify(CR_OFF)}, creatorName: '早起的鸟',
                        kind: '生活', blurb: '看我把一筐雾莓砍到半价。', tags: ['集市'],
                        durationSec: 300, durationLabel: '5:00', views: 700,
                        publishedLabel: '1周前', favorited: false, createdAt: now,
                    },
                ],
            });
            await window.myDb.put('youtubeVideos', {
                id: 'v_probe_1', profileKey: key,
                title: '杉顶采露记', coverText: '采露', coverHue: 0,
                creatorId: ${JSON.stringify(CR_LIVE)}, creatorName: '雾中灯塔',
                kind: '日常', blurb: '凌晨四点的杉顶，露水正好。', tags: ['日常', '杉顶'],
                durationSec: 420, durationLabel: '7:00', views: 12000,
                publishedLabel: '3天前', favorited: false, createdAt: now, updatedAt: now,
                detail: {
                    intro: '这期带大家看凌晨的杉顶。露水要在日出前收完，手快有手慢无。',
                    sections: [
                        { at: '00:00', text: '摸黑爬上杉顶，头灯照出一片雾。' },
                        { at: '01:30', text: '第一滴露水入瓶，声音很好听。' },
                        { at: '04:00', text: '日出，全员收工，瓶子排成一排。' },
                        { at: '06:30', text: '成品展示：今天的露水偏甜。' },
                    ],
                    likes: 980, commentCount: 12345, generatedAt: now,
                },
            });
            // 首批评论 5 条（观众名字都指向已有站内用户可点开的那位）
            for (let i = 0; i < 5; i += 1) {
                await window.myDb.put('youtubeComments', {
                    id: 'cm_probe_' + i, profileKey: key, videoId: 'v_probe_1',
                    authorId: ${JSON.stringify(CR_OFF)}, authorName: '早起的鸟',
                    text: ['前排！', '露水声音太治愈了', '求坐标', '下次直播采吗？', '已三连'][i],
                    likes: 5 - i, seq: i + 1, createdAt: now,
                });
            }
            return true;
        })()
    `);

    // 切到 B：必须回引导页（B 档没配过）
    await page.evaluate(`
        (async () => {
            const sdk = window.settingsSdk;
            await sdk.users.update(${JSON.stringify(seed.userId)}, { boundWorldId: ${JSON.stringify(seed.worldB)} });
            window.dispatchEvent(new CustomEvent('phone:app-opened', { detail: { appId: 'youtube' } }));
        })()
    `);
    await sleep(1600);
    check('切到世界 B → 回到引导页', await page.evaluate(`!!document.querySelector('.yt-ob')`));
    const pillsB = await page.evaluate(`Array.from(document.querySelectorAll('.yt-ob__pill-v')).map(e => e.textContent.trim())`);
    check('B 档读到自己的世界名', pillsB.includes('铁砂原'), pillsB.join(' / '));

    // 切回 A：不再要求配置，注入的列表恢复
    await page.evaluate(`
        (async () => {
            const sdk = window.settingsSdk;
            await sdk.users.update(${JSON.stringify(seed.userId)}, { boundWorldId: ${JSON.stringify(seed.worldA)} });
            window.dispatchEvent(new CustomEvent('phone:app-opened', { detail: { appId: 'youtube' } }));
        })()
    `);
    await sleep(1600);
    check('切回 A → 不再要求配置', await page.evaluate(`!document.querySelector('.yt-ob')`));
    check('A 档列表恢复（两张视频卡）', await page.evaluate(`document.querySelectorAll('.yt-vcard').length === 2`));
    check('视频卡带文字封面（色块 + 大字）', await page.evaluate(
        `document.querySelector('.yt-vcard .yt-cover__text')?.textContent.trim() === '采露'`,
    ));
    await page.shot('02-home');

    console.log('\n── 视频详情（注入过，不该调 AI）─────────');
    const errorsBefore = page.console.filter((l) => /^\[(error|exception)\]/.test(l)).length;
    await page.evaluate(`document.querySelector('.yt-vcard__coverbtn').click()`);
    await page.waitFor(`document.querySelector('.yt-video__title')`, { label: '详情页' });
    await sleep(600);
    check('详情页标题正确', await page.evaluate(
        `document.querySelector('.yt-video__title').textContent.trim() === '杉顶采露记'`,
    ));
    check('分段「视频内容」渲染 4 段', await page.evaluate(`document.querySelectorAll('.yt-chapters__item').length === 4`));
    check('评论总数显示 99+（真实值 12345 只在数据里）', await page.evaluate(
        `Array.from(document.querySelectorAll('.yt-section__title')).some(e => e.textContent.includes('评论 99+'))`,
    ));
    check('首批 5 条评论都在', await page.evaluate(`document.querySelectorAll('.yt-comment').length === 5`));
    check('注入详情后打开没有新报错（没偷调 AI）',
        page.console.filter((l) => /^\[(error|exception)\]/.test(l)).length === errorsBefore);

    // 用户自己发评论（不调 AI）
    await page.evaluate(`
        ${SET_VALUE}
        __set(document.querySelector('.yt-commentbox .yt-input'), '我也想去接露水');
    `);
    await page.clickByText('.yt-commentbox', '发');
    await sleep(700);
    check('自己的评论立即出现（带「我」标）', await page.evaluate(
        `document.querySelectorAll('.yt-comment').length === 6 && !!document.querySelector('.yt-comment__metag')`,
    ));
    await page.shot('03-video');

    console.log('\n── 收藏 + 分享到 murmur ─────────────────');
    await page.clickByText('.yt-video__actions', '收藏');
    await sleep(500);
    check('收藏点亮', await page.evaluate(`!!document.querySelector('.yt-action.is-on')`));

    await page.clickByText('.yt-video__actions', '分享');
    await page.waitFor(`document.querySelector('.yt-share__ai')`, { label: '分享弹窗' });
    check('分享弹窗列出世界 AI', await page.evaluate(
        `document.querySelector('.yt-share__ai').textContent.includes('阿澈')`,
    ));
    await page.evaluate(`document.querySelector('.yt-share__ai').click()`);
    await page.clickByText('.yt-modal__actions', '分享');
    await sleep(900);
    const sharedMsg = await page.evaluate(`
        (async () => {
            const rows = await window.myDb.getAll('chatMessages');
            const hit = rows.find(r => r.type === 'youtube_video_share');
            return hit ? { ok: true, videoId: hit.youtubeCard?.videoId, title: hit.youtubeCard?.title } : { ok: false };
        })()
    `);
    check('murmur 收到视频卡（只带 id + 快照）', sharedMsg.ok && sharedMsg.videoId === 'v_probe_1', JSON.stringify(sharedMsg));

    console.log('\n── 作者主页 → 关注 ──────────────────────');
    await page.evaluate(`document.querySelector('.yt-video__creator').click()`);
    await page.waitFor(`document.querySelector('.yt-creator__name')`, { label: '主页' });
    await sleep(500);
    check('主页读到注入的资料（没调 AI）', await page.evaluate(
        `document.querySelector('.yt-creator__name').textContent.trim() === '雾中灯塔'
         && document.body.textContent.includes('住在灯塔里的记录者')`,
    ));
    check('代表作列出 2 条', await page.evaluate(`document.querySelectorAll('.yt-work').length === 2`));
    check('在播主播带「直播中」入口', await page.evaluate(
        `Array.from(document.querySelectorAll('.yt-creator__actions button')).some(b => b.textContent.includes('直播中'))`,
    ));
    await page.clickByText('.yt-creator__actions', '关注');
    await sleep(400);
    check('关注点亮', await page.evaluate(
        `Array.from(document.querySelectorAll('.yt-creator__actions button')).some(b => b.textContent.includes('已关注'))`,
    ));
    await page.shot('04-creator');

    console.log('\n── 直播：先按不生成、注入后 JS 分发 ─────');
    await page.clickByText('.yt-creator__actions', '直播中');
    await page.waitFor(`document.querySelector('.yt-live')`, { label: '直播间' });
    await sleep(500);
    check('在播但未生成 → 只有「开始看直播」按钮（不自动调 AI）', await page.evaluate(
        `Array.from(document.querySelectorAll('.yt-live button')).some(b => b.textContent.includes('开始看直播'))
         && !document.querySelector('.yt-danmaku__item')`,
    ));
    await page.clickByText('.yt-live', '开始看直播');
    await sleep(2500);
    check('没 API 时生成直播优雅报错', await page.evaluate(`!!document.querySelector('.yt-live .yt-error')`));

    // 注入一场直播（等于「已经生成过」），退出重进 → 纯 JS 播放
    await page.evaluate(`
        (async () => {
            const key = ${JSON.stringify(profileKeyA)};
            await window.myDb.put('youtubeLives', {
                id: key + '::' + ${JSON.stringify(CR_LIVE)} + '::' + ${STAMP},
                profileKey: key, creatorId: ${JSON.stringify(CR_LIVE)}, windowStamp: ${STAMP},
                topic: '夜航电台·雾夜特辑', announcement: '今晚聊聊雾里行船的事。',
                viewers: 620,
                hostLines: [
                    { atSec: 0, text: '来了来了，先把灯挂上。' },
                    { atSec: 3, text: '今晚雾大，正好讲雾夜的故事。' },
                ],
                danmaku: [
                    { atSec: 0, name: '守塔人', text: '前排' },
                    { atSec: 1, name: '夜猫', text: '来了来了' },
                    { atSec: 2, name: '雾莓', text: '灯塔晚上好' },
                    { atSec: 3, name: '守塔人', text: '今天雾好大' },
                    { atSec: 5, name: '路灯', text: '声音好听' },
                ],
                userDanmaku: [], generatedAt: Date.now(), updatedAt: Date.now(),
            });
            return true;
        })()
    `);
    await page.evaluate(`document.querySelector('.yt-subtop__back').click()`);
    await sleep(500);
    await page.clickByText('.yt-creator__actions', '直播中');
    await page.waitFor(`document.querySelector('.yt-stage.is-live')`, { label: '直播画面（读已存场次，不调 AI）' });
    await sleep(2600);
    const liveState = await page.evaluate(`
        (() => ({
            flying: document.querySelectorAll('.yt-danmaku__item').length,
            host: document.querySelectorAll('.yt-livemsg.is-host').length,
            topic: document.querySelector('.yt-stage__topic')?.textContent.trim(),
        }))()
    `);
    check('弹幕由 JS 按时间线飘出（2.6s 内 ≥ 3 条）', liveState.flying >= 3, `${liveState.flying} 条在飞`);
    check('主播话术逐句出现', liveState.host >= 1, `${liveState.host} 句`);
    check('直播主题正确', liveState.topic === '夜航电台·雾夜特辑', liveState.topic);

    await page.evaluate(`
        ${SET_VALUE}
        __set(document.querySelector('.yt-livebox .yt-input'), '主播晚上好');
    `);
    await page.clickByText('.yt-livebox', '发');
    await sleep(700);
    const myDanmaku = await page.evaluate(`
        (async () => {
            const flying = Array.from(document.querySelectorAll('.yt-danmaku__item.is-mine')).length;
            const rows = await window.myDb.getAll('youtubeLives');
            const live = rows.find(r => r.creatorId === ${JSON.stringify(CR_LIVE)});
            return { flying, saved: (live?.userDanmaku || []).length };
        })()
    `);
    check('自己的弹幕立即上屏且落盘', myDanmaku.flying === 1 && myDanmaku.saved === 1, JSON.stringify(myDanmaku));
    await page.shot('05-live');
    await page.evaluate(`document.querySelector('.yt-subtop__back').click()`);
    await sleep(400);

    console.log('\n── 离线直播间（不调 AI 也能进）──────────');
    await page.backToTabs();
    await page.evaluate(`document.querySelectorAll('.yt-vcard__coverbtn')[1].click()`);
    await page.waitFor(`document.querySelector('.yt-video__title')`, { label: '第二条视频' });
    await sleep(1200);   // 这条没注入详情 → 会试着调 AI → 失败（预期）
    await page.evaluate(`document.querySelector('.yt-video__creator').click()`);
    await page.waitFor(`document.querySelector('.yt-creator__name')`, { label: '离线主播主页' });
    await page.clickByText('.yt-creator__actions', '直播间');
    await page.waitFor(`document.querySelector('.yt-stage.is-offline')`, { label: '离线直播间' });
    const offline = await page.evaluate(`
        (() => ({
            msgs: document.querySelectorAll('.yt-livemsg').length,
            inputDisabled: document.querySelector('.yt-livebox .yt-input')?.disabled === true,
        }))()
    `);
    check('离线房间有几条静态留言（能进但不生成）', offline.msgs >= 3, `${offline.msgs} 条`);
    check('离线时弹幕输入禁用', offline.inputDisabled);
    await page.evaluate(`document.querySelector('.yt-subtop__back').click()`);
    await sleep(400);

    console.log('\n── 站内闲聊（不可改）→ 加好友（进 nook）──');
    await page.clickByText('.yt-creator__actions', '发起闲聊');
    await page.waitFor(`document.querySelector('.yt-chat')`, { label: '闲聊页' });
    await page.evaluate(`
        ${SET_VALUE}
        __set(document.querySelector('.yt-chat__box .yt-input'), '你也看灯塔的视频？');
    `);
    await page.clickByText('.yt-chat__box', '发');
    await sleep(2200);
    const chatState = await page.evaluate(`
        (async () => {
            const rows = await window.myDb.getAll('youtubeChats');
            return {
                bubbles: document.querySelectorAll('.yt-chat__bubble').length,
                saved: rows.length,
                errorShown: !!document.querySelector('.yt-chat .yt-error'),
                actionButtons: document.querySelectorAll('.yt-chat__bubble button').length,
            };
        })()
    `);
    check('用户消息立即上屏并落盘', chatState.bubbles >= 1 && chatState.saved === 1, JSON.stringify(chatState));
    check('对方回复失败被兜住（没 API）', chatState.errorShown);
    check('闲聊消息没有编辑 / 删除 / 重 roll 入口', chatState.actionButtons === 0);

    await page.clickByText('.yt-subtop', '加好友');
    await page.waitFor(`document.querySelector('.yt-modal')`, { label: '加好友确认窗' });
    await page.clickByText('.yt-modal__actions', '加为好友');
    await sleep(1200);
    const friend = await page.evaluate(`
        (() => {
            const sdk = window.settingsSdk;
            const all = sdk.aiPersons.list();
            const hit = all.find(p => p?.externalOrigin?.appId === 'youtube');
            return {
                count: all.length,
                found: !!hit,
                name: hit?.name,
                world: hit?.boundWorldId,
                encounter: hit?.externalOrigin?.encounter || '',
                externalId: hit?.externalOrigin?.externalId || '',
                bioHasReason: (hit?.experience || '').includes('相识'),
            };
        })()
    `);
    check('好友写进 nook 角色库', friend.found && friend.count === seed.aiCountBefore + 1, `count=${friend.count}`);
    check('自动绑定当前世界', friend.world === seed.worldA);
    check('相识缘由进了人设（experience）', friend.bioHasReason, friend.encounter.slice(0, 40));
    const dup = await page.evaluate(`
        (async () => {
            const mod = await import('/src/core/world-profile.js');
            const r = await mod.registerEncounteredCharacter(
                { name: '早起的鸟', externalId: ${JSON.stringify(friend.externalId)} },
                { sourceApp: 'youtube', encounter: '再加一次' },
            );
            return { ok: r.ok, created: r.created === true, total: window.settingsSdk.aiPersons.list().length };
        })()
    `);
    check('重复加好友幂等（复用同一角色）', dup.ok && !dup.created && dup.total === friend.count, JSON.stringify(dup));
    check('聊天页出现「好友」标', await page.evaluate(`!!document.querySelector('.yt-subtop .yt-person__friendtag')`));
    await page.shot('06-chat');

    console.log('\n── 我的频道：发布 / 99+ / 编辑 / 删除 ────');
    check('连点返回能回到底栏（覆盖页导航栈没死路）', await page.backToTabs());
    await page.evaluate(`document.querySelectorAll('.yt-tabbar__item')[4].click()`);
    await sleep(500);
    check('我的页读到频道资料', await page.evaluate(
        `document.querySelector('.yt-mecard__name')?.textContent.trim() === '夜航听众'
         && document.querySelector('.yt-mecard__sub')?.textContent.includes('100万')`,
    ));
    await page.clickByText('.yt-page', '发视频');
    await page.waitFor(`document.querySelector('.yt-modal')`, { label: '发布弹窗' });
    await page.evaluate(`
        ${SET_VALUE}
        __set(document.querySelector('.yt-modal input.yt-input'), '我的第一条视频');
    `);
    await page.clickByText('.yt-modal__actions', '发布');
    await sleep(900);
    check('作品出现在我的列表', await page.evaluate(
        `document.querySelectorAll('.yt-page .yt-vcard').length === 1`,
    ));

    await page.evaluate(`document.querySelector('.yt-vcard__coverbtn').click()`);
    await page.waitFor(`document.querySelector('.yt-video__title')`, { label: '自己的视频页' });
    await sleep(400);
    const uploadStats = await page.evaluate(`
        (async () => {
            const rows = await window.myDb.getAll('youtubeUploads');
            const u = rows[0];
            return {
                views: u?.stats?.views || 0, comments: u?.stats?.comments || 0,
                capShown: Array.from(document.querySelectorAll('.yt-section__title')).some(e => e.textContent.includes('评论 99+')),
                genBtn: Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('看看观众怎么说')),
            };
        })()
    `);
    check('百万粉的视频数据由 JS 算出（播放 > 5 万）', uploadStats.views > 50000, `views=${uploadStats.views}`);
    check('评论总数超过 99 → 显示 99+（真实值保留）', uploadStats.comments > 99 && uploadStats.capShown, `comments=${uploadStats.comments}`);
    check('「看看观众怎么说」按钮存在（生成正文才调 AI）', uploadStats.genBtn);

    await page.clickByText('.yt-video__actions', '编辑');
    await page.waitFor(`document.querySelector('.yt-modal')`, { label: '编辑弹窗' });
    await page.evaluate(`
        ${SET_VALUE}
        __set(document.querySelector('.yt-modal input.yt-input'), '改名后的视频');
    `);
    await page.clickByText('.yt-modal__actions', '保存');
    await sleep(700);
    check('编辑标题立即生效', await page.evaluate(
        `document.querySelector('.yt-video__title').textContent.trim() === '改名后的视频'`,
    ));

    await page.clickByText('.yt-video__actions', '删除');
    await page.waitFor(`document.querySelector('.yt-modal')`, { label: '删除确认窗' });
    check('删除有二次确认', await page.evaluate(
        `document.querySelector('.yt-modal').textContent.includes('内容已删除')`,
    ));
    await page.clickByText('.yt-modal__actions', '删除');
    await sleep(800);
    const afterDelete = await page.evaluate(`
        (async () => ({
            uploads: (await window.myDb.getAll('youtubeUploads')).length,
            backToMe: !!document.querySelector('.yt-mecard'),
        }))()
    `);
    check('删除后作品清空并退回我的页', afterDelete.uploads === 0 && afterDelete.backToMe, JSON.stringify(afterDelete));
    await page.shot('07-me');

    console.log('\n── 收藏 tab / 私信收件箱 ────────────────');
    await page.backToTabs();
    await page.evaluate(`document.querySelectorAll('.yt-tabbar__item')[2].click()`);
    await sleep(500);
    check('收藏 tab 有刚才那条', await page.evaluate(
        `document.querySelectorAll('.yt-vcard').length === 1
         && document.body.textContent.includes('杉顶采露记')`,
    ));

    // 注入一封私信（生成要调 AI，冒烟环境测「注入后展示 + 删除」链路）
    await page.evaluate(`
        (async () => {
            await window.myDb.put('youtubeDms', {
                id: 'dm_probe_1', profileKey: ${JSON.stringify(profileKeyA)},
                fromName: '雾莓官方', fromKind: '品牌方', tone: '商务',
                text: '你好，看了你的频道，想聊聊雾莓的合作推广。',
                batch: 1, createdAt: Date.now(),
            });
            const sdk = window.settingsSdk;
            window.dispatchEvent(new CustomEvent('phone:app-opened', { detail: { appId: 'youtube' } }));
            return true;
        })()
    `);
    await sleep(400);
    // 让 store 重新读档（换绑再换回是最真实的重载路径）
    await page.evaluate(`
        (async () => {
            const sdk = window.settingsSdk;
            await sdk.users.update(${JSON.stringify(seed.userId)}, { boundWorldId: ${JSON.stringify(seed.worldB)} });
            window.dispatchEvent(new CustomEvent('phone:app-opened', { detail: { appId: 'youtube' } }));
        })()
    `);
    await sleep(1100);
    await page.evaluate(`
        (async () => {
            const sdk = window.settingsSdk;
            await sdk.users.update(${JSON.stringify(seed.userId)}, { boundWorldId: ${JSON.stringify(seed.worldA)} });
            window.dispatchEvent(new CustomEvent('phone:app-opened', { detail: { appId: 'youtube' } }));
        })()
    `);
    await sleep(1600);
    await page.evaluate(`document.querySelectorAll('.yt-tabbar__item')[3].click()`);
    await sleep(500);
    await page.evaluate(`document.querySelectorAll('.yt-seg__item')[1].click()`);
    await sleep(500);
    check('注入的私信按档案显示', await page.evaluate(
        `document.querySelectorAll('.yt-dm').length === 1 && document.body.textContent.includes('雾莓官方')`,
    ));
    check('私信页说明 provider 口子（演员 / 爱豆将来接入）', await page.evaluate(
        `document.querySelector('.yt-dmbar__hint')?.textContent.includes('经历') === true`,
    ));
    await page.evaluate(`document.querySelector('.yt-dm__del').click()`);
    await page.waitFor(`document.querySelector('.yt-modal')`, { label: '删私信确认' });
    await page.clickByText('.yt-modal__actions', '删除');
    await sleep(700);
    check('私信删除生效', await page.evaluate(
        `(async () => (await window.myDb.getAll('youtubeDms')).length === 0)()`,
    ));

    console.log('\n── murmur 内容卡：取消不生成、确认回详情 ──');
    await page.evaluate(`
        window.dispatchEvent(new CustomEvent('app:page-action', { detail: { action: 'openApp', targetAppId: 'chat' } }));
        window.dispatchEvent(new CustomEvent('app:page-action', { detail: { action: 'detail', appId: 'chat', pageId: 'private-${seed.aiId}-calendar' } }));
    `);
    await page.waitFor(`document.querySelector('.ytc-card')`, { label: '聊天里的视频卡' });
    check('视频卡渲染（封面色块 + 标题）', await page.evaluate(
        `document.querySelector('.ytc-title')?.textContent.trim() === '杉顶采露记'
         && !!document.querySelector('.ytc-cover--h0')`,
    ));

    await page.evaluate(`document.querySelector('.ytc-card').click()`);
    await page.waitFor(`document.querySelector('.ac-overlay .ac-modal')`, { label: '内容卡确认窗' });
    await page.evaluate(`document.querySelector('.ac-overlay [data-lp-action="cancel"]')?.click()`);
    await sleep(600);
    check('取消后留在 murmur（不调服务不跳 App）', await page.evaluate(
        `!!document.querySelector('.app-shell[data-app-id="chat"] .ytc-card') && !document.querySelector('.ac-overlay')`,
    ));

    await page.evaluate(`document.querySelector('.ytc-card').click()`);
    await page.waitFor(`document.querySelector('.ac-overlay [data-lp-action="ok"]')`, { label: '再次确认' });
    await page.evaluate(`document.querySelector('.ac-overlay [data-lp-action="ok"]')?.click()`);
    await page.waitFor(`
        document.querySelector('.app-shell[data-app-id="youtube"] .yt-video__title')
        && document.querySelector('.app-shell[data-app-id="youtube"] .yt-video__title').textContent.includes('杉顶采露记')
    `, { label: '确认后回到视频详情', timeout: 20000 });
    check('确认后打开萤火对应详情（已有详情直接恢复）', true);

    // AI 发来的快照卡：内容不存在 + 没 API → 确认后优雅报错，不崩、留在聊天
    await page.evaluate(`
        (async () => {
            const sdk = window.settingsSdk;
            await sdk.chatMessages.add(null, ${JSON.stringify(seed.aiId)}, 'calendar', {
                sender: 'ai', type: 'youtube_video_share', content: '[视频] 雾夜行船十讲',
                youtubeCard: {
                    videoId: 'aivid_probe_missing', title: '雾夜行船十讲',
                    blurb: '老船工的压箱底经验。', coverText: '行船', coverHue: 5,
                    creatorName: '', kind: '', views: 0, durationSec: 0, fromAi: true,
                },
            });
            // ★ 直接写库不会自动重画：和 chat-bridge 的 pokeChat 一样戳一下渲染缓存
            window.invalidateRendererCache?.('chat', null);
            window.__appRendererBridge?.syncNow?.({ force: true });
            window.dispatchEvent(new CustomEvent('app:page-action', { detail: { action: 'openApp', targetAppId: 'chat' } }));
            window.dispatchEvent(new CustomEvent('app:page-action', { detail: { action: 'detail', appId: 'chat', pageId: 'private-${seed.aiId}-calendar' } }));
        })()
    `);
    await page.waitFor(`document.querySelectorAll('.ytc-card').length === 2`, { label: 'AI 快照卡出现' });
    await page.evaluate(`document.querySelectorAll('.ytc-card')[1].click()`);
    await page.waitFor(`document.querySelector('.ac-overlay [data-lp-action="ok"]')`, { label: '快照卡确认窗' });
    await page.evaluate(`document.querySelector('.ac-overlay [data-lp-action="ok"]')?.click()`);
    await sleep(2500);
    check('快照卡 + 没 API → 优雅报错不崩', await page.evaluate(
        `!!document.querySelector('.ac-overlay') && document.body.textContent.includes('暂时打不开')`,
    ));
    await page.evaluate(`document.querySelector('.ac-overlay [data-lp-action="ok"]')?.click()`);
    await sleep(500);

    console.log('\n── 主题切换 ─────────────────────────────');
    await page.evaluate(`
        window.dispatchEvent(new CustomEvent('app:page-action', { detail: { action: 'openApp', targetAppId: 'youtube' } }));
    `);
    await sleep(700);
    await page.backToTabs();
    await page.evaluate(`document.querySelectorAll('.yt-tabbar__item')[4].click()`);
    await sleep(500);
    await page.clickByText('.yt-page', '界面配色');
    await page.waitFor(`document.querySelector('.yt-themepage')`, { label: '配色页' });
    await page.evaluate(`document.querySelectorAll('.yt-theme-pick')[1].click()`);
    await sleep(300);
    await page.clickByText('.yt-row-actions', '应用');
    await sleep(600);
    const themed = await page.evaluate(`
        (() => {
            const shell = document.querySelector('.app-shell[data-app-id="youtube"]');
            return {
                attr: shell.getAttribute('data-yt-theme'),
                bg: getComputedStyle(shell).getPropertyValue('--yt-bg').trim(),
            };
        })()
    `);
    check('夜幕主题生效（attr + token 都换了）', themed.attr === 'dusk' && /^#201A1B$/i.test(themed.bg), JSON.stringify(themed));
    await page.shot('08-dusk');

    console.log('\n── 提示词透明页 ─────────────────────────');
    await page.backToTabs();
    await page.clickByText('.yt-page', '提示词与生成');
    await page.waitFor(`document.querySelector('.yt-prompts')`, { label: '提示词页' });
    const prompts = await page.evaluate(`
        (() => ({
            pickers: document.querySelectorAll('.yt-prompts__pick').length,
            parts: document.querySelectorAll('.yt-ctx__part').length,
            murmurCards: document.querySelectorAll('.yt-prompts__murmur').length,
        }))()
    `);
    check('八类生成器都能看拼装分段', prompts.pickers === 8 && prompts.parts >= 4, JSON.stringify(prompts));
    check('murmur 注册的两张卡原文可见', prompts.murmurCards === 2);

    console.log('\n── 控制台 ───────────────────────────────');
    const noise = page.console.filter((l) => {
        if (!/^\[(error|exception)\]/.test(l)) return false;
        if (/API|api|Key|401|429/.test(l)) return false;   // 没配 API 是预期内的
        if (/favicon/.test(l)) return false;
        return true;
    });
    const resolveWarn = page.console.filter((l) => /Failed to resolve component/i.test(l));
    check('没有「组件解析不出来」的警告', resolveWarn.length === 0, resolveWarn.slice(0, 2).join(' | '));
    check('控制台没有意料之外的报错', noise.length === 0, noise.slice(0, 3).join(' | '));
    if (noise.length) noise.slice(0, 8).forEach((l) => console.log('    ' + l));
}

main().catch((err) => {
    console.error('\n探针崩了：', err.message);
    process.exit(1);
});
