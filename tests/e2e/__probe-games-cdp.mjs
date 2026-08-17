/**
 * 群聊小游戏 · 浏览器冒烟（真实 Edge，走 CDP）
 *
 * `__probe-games.mjs` 已经把状态机验过了，这里只查**纯浏览器才能发现**的四类事：
 *
 *   1. 控制台没有 error / exception —— 这次动了 chat-app 的模块链接，
 *      任何一处 import 挂掉都是整个 murmur 起不来（AGENTS2 §15.9.6：
 *      这条断言的价值不比任何功能断言低）
 *   2. **CSS 真的加载了** —— 新加的 `_chat-game.css` 忘了 `@import` 进
 *      `css/apps/chat/index.css`、或者 `index.html` 的 `?v=` 没加一，
 *      表现都是「代码改了页面纹丝不动」，只有断言 computed style 能抓到
 *      （AGENTS2 §15.1.1 / §15.12）
 *   3. **3D 骰子的几何是对的** —— 60×60、translateZ(30px)、cgRoll 关键帧在，
 *      这几个数字是用户点名要保留的
 *   4. 没有被撑爆的 SVG（不带 width/height 的内联图标会被画成 300×150）
 *
 * 用法：先 `npm run dev`，再 `node tests/e2e/__probe-games-cdp.mjs`
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
const PORT = 9351;
const PROFILE = path.join(os.tmpdir(), `cg-probe-${Date.now()}`);
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
                const text = (msg.params.args || [])
                    .map((a) => a.value ?? a.description ?? '')
                    .join(' ');
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
        const file = path.join(ROOT, `cg-probe-${name}.png`);
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

    console.log('\n── 启动 ─────────────────────────────────');
    await page.send('Page.navigate', { url: BASE });
    await page.waitFor('window.__phoneAppsRef && window.__phoneAppsRef.value.length > 0', { label: 'app 注册' });
    await sleep(1500);

    check('murmur 已注册', await page.evaluate(`(window.__phoneAppsRef.value || []).some(a => a.id === 'chat')`));

    console.log('\n── 打开 murmur ──────────────────────────');
    await page.evaluate(`window.dispatchEvent(new CustomEvent('app:page-action', { detail: { action: 'openApp', appId: 'chat' } }))`);
    await page.waitFor(`document.querySelector('.app-shell[data-app-id="chat"]')`, { label: 'murmur 打开' });
    await sleep(1200);

    console.log('\n── 游戏大厅 ─────────────────────────────');
    await page.evaluate(`
        document.dispatchEvent(new CustomEvent('app:page-action', {
            detail: { action: 'detail', appId: 'chat', pageId: 'game-selector' }, bubbles: true,
        }))
    `);
    await page.waitFor(`document.querySelector('.app-shell[data-app-id="chat"] .cg-lobby')`, { label: '大厅渲染' });
    await sleep(700);

    const lobby = await page.evaluate(`
        (() => {
            const names = Array.from(document.querySelectorAll('.cg-lobby-card__name')).map(e => e.textContent.trim());
            const el = document.querySelector('.cg-lobby-card');
            const cs = el ? getComputedStyle(el) : null;
            return { names, radius: cs?.borderRadius || '', bg: cs?.backgroundColor || '' };
        })()
    `);
    check('大厅列出了三个游戏 + 排行榜', lobby.names.length >= 4, lobby.names.join(' / '));
    // ★ 圆角来自 --cg-radius: 14px。不是 0 就说明 _chat-game.css 真的加载了
    check('_chat-game.css 已加载（不是拿的缓存）', lobby.radius.startsWith('14'), `border-radius=${lobby.radius}`);

    await page.shot('01-lobby');

    console.log('\n── 排行榜 ───────────────────────────────');
    await page.evaluate(`
        document.dispatchEvent(new CustomEvent('app:page-action', {
            detail: { action: 'detail', appId: 'chat', pageId: 'game-leaderboard' }, bubbles: true,
        }))
    `);
    await page.waitFor(`document.querySelector('.app-shell[data-app-id="chat"] .cg-lb')`, { label: '排行榜渲染' });
    await sleep(500);
    const tabs = await page.evaluate(`document.querySelectorAll('.cg-lbtab').length`);
    check('排行榜有 4 个 Tab', tabs === 4, `${tabs} 个`);
    await page.shot('02-leaderboard');

    console.log('\n── 3D 骰子几何 ──────────────────────────');
    // 直接把骰子结构塞进 chat shell 量一遍。作用域前缀是
    // `.app-shell[data-app-id="chat"]`，所以必须挂在 shell 里面才吃得到样式。
    const dice = await page.evaluate(`
        (() => {
            const shell = document.querySelector('.app-shell[data-app-id="chat"]');
            const host = document.createElement('div');
            host.id = '__cg_dice_probe';
            host.innerHTML = '<div class="cg-dice-stage"><div class="cg-dice-stage__row">' +
                '<div class="cg-dice"><div class="cg-dice__face is-front"><i class="cg-dice__dot"></i></div>' +
                '<div class="cg-dice__face is-top"></div></div></div></div>';
            shell.appendChild(host);
            const stage = host.querySelector('.cg-dice-stage');
            const die = host.querySelector('.cg-dice');
            const face = host.querySelector('.cg-dice__face.is-front');
            const top = host.querySelector('.cg-dice__face.is-top');
            const dot = host.querySelector('.cg-dice__dot');
            const r = die.getBoundingClientRect();
            const out = {
                w: Math.round(r.width), h: Math.round(r.height),
                perspective: getComputedStyle(stage).perspective,
                gap: getComputedStyle(host.querySelector('.cg-dice-stage__row')).gap,
                preserve: getComputedStyle(die).transformStyle,
                transition: getComputedStyle(die).transitionDuration,
                radius: getComputedStyle(face).borderRadius,
                frontZ: getComputedStyle(face).transform,
                topT: getComputedStyle(top).transform,
                // ⚠️ 这里必须用 offsetWidth 不能用 getBoundingClientRect()：
                //    点画在 translateZ(30px) 的面上，透视会把它放大
                //    600/(600-30) ≈ 1.053 倍，量出来是 10.5 而不是 10。
                //    这是骰子**应该**有的效果，不是 bug。
                dotW: dot.offsetWidth,
                dotBg: getComputedStyle(dot).backgroundColor,
            };
            // 关键帧存在性：翻滚动画名能不能解析出时长
            die.classList.add('is-rolling');
            out.animName = getComputedStyle(die).animationName;
            out.animDur = getComputedStyle(die).animationDuration;
            host.remove();
            return out;
        })()
    `);
    check('立方体 60 × 60', dice.w === 60 && dice.h === 60, `${dice.w}×${dice.h}`);
    check('景深 600px', dice.perspective === '600px', dice.perspective);
    check('两骰间距 30px', dice.gap === '30px', dice.gap);
    check('transform-style: preserve-3d', dice.preserve === 'preserve-3d', dice.preserve);
    check('停稳过渡 1.5s', dice.transition === '1.5s', dice.transition);
    check('面圆角 8px', dice.radius.startsWith('8'), dice.radius);
    // translateZ(30px) → matrix3d 的第 15 个分量是 30
    check('正面 translateZ(30px)', /matrix3d\(.*,\s*30,\s*1\)$/.test(dice.frontZ), dice.frontZ.slice(0, 60));
    check('顶面 rotateX(90deg) translateZ(30px)', dice.topT.startsWith('matrix3d'), dice.topT.slice(0, 40));
    check('点 10px', dice.dotW === 10, `${dice.dotW}px`);
    check('点是 #313735', dice.dotBg === 'rgb(49, 55, 53)', dice.dotBg);
    check('翻滚动画 cgRoll', dice.animName === 'cgRoll', dice.animName);
    check('翻滚时长 1.5s', dice.animDur === '1.5s', dice.animDur);

    console.log('\n── 真的开三局 ───────────────────────────');
    /**
     * 造一个有 5 个 AI 的群，然后把三个游戏各开一局，截图看一眼。
     *
     * ⚠️ 这里塞了一个假的 `__apiSdk`：干净 profile 里没有配过 API，
     *    设置页的「开始游戏」是灰的。塞一个之后 AI 请求会真的发出去并失败，
     *    引擎走兜底决策 —— 正好也顺带验了「API 挂了不会让对局卡死」。
     */
    const groupId = await page.evaluate(`
        (async () => {
            const sdk = window.settingsSdk;
            const user = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.();
            const ids = [];
            for (const name of ['阿蓝', '小桃', '老陈', '果果', '南南']) {
                const p = await sdk.aiPersons.create({ nickname: name, personality: name + '的性格' });
                ids.push(p.id);
            }
            const g = await sdk.chatGroups.create(sdk, user, { name: '探针测试群', memberIds: ids, mode: 'calendar' });
            window.__apiSdk = {
                apiKeySdk: {
                    list: () => [{ id: 'probe-key', name: '探针假 Key', enabled: true }],
                    get: (id) => ({ id, enabled: true }),
                },
                apiGroupSdk: { list: () => [], get: () => null },
            };
            return g.id;
        })()
    `);
    check('建了一个 5 人 AI 群', !!groupId, groupId);

    for (const [gameId, label, shot] of [
        ['werewolf', '狼人杀', '03-werewolf'],
        ['undercover', '谁是卧底', '04-undercover'],
        ['monopoly', '大富翁', '05-monopoly'],
    ]) {
        await page.evaluate(`
            document.dispatchEvent(new CustomEvent('app:page-action', {
                detail: { action: 'detail', appId: 'chat', pageId: 'game-setup-${gameId}-${groupId}' }, bubbles: true,
            }))
        `);
        await page.waitFor(`document.querySelector('.app-shell[data-app-id="chat"] .cg-setup')`, { label: `${label} 设置页` });
        await sleep(500);
        const memberCount = await page.evaluate(`document.querySelectorAll('.cg-member').length`);
        check(`${label} 设置页列出了群成员`, memberCount === 5, `${memberCount} 个`);

        const started = await page.evaluate(`
            (() => {
                const btn = document.querySelector('.cg-setup__foot .cg-btn');
                if (!btn || btn.disabled) return 'disabled';
                btn.click();
                return 'ok';
            })()
        `);
        check(`${label} 能点开始`, started === 'ok', started);
        if (started !== 'ok') continue;

        await page.waitFor(`document.querySelector('.app-shell[data-app-id="chat"] .cg-page[data-cg-group]')`, { label: `${label} 对局页` });
        // 让引擎跑几步，看界面会不会跟着动
        await sleep(gameId === 'monopoly' ? 5000 : 4000);

        if (gameId === 'monopoly') {
            // 骰子只在掷的时候才出现。轮到用户就点一下；轮到 AI 就等它掷。
            const rolled = await page.evaluate(`
                (() => {
                    const btns = Array.from(document.querySelectorAll('.cg-action .cg-btn'));
                    const b = btns.find(x => x.textContent.includes('掷骰子'));
                    if (b) { b.click(); return 'clicked'; }
                    return 'waiting';
                })()
            `);
            // 1.1s：翻滚动画正跑到一半，这时候截图能看到骰子在转
            await page.waitFor(`document.querySelectorAll('.cg-dice').length === 2`, { timeout: 20000, label: '骰子出现' });
            check('掷骰后两颗骰子在场', true, rolled);
            await sleep(1100);
        }

        const state = await page.evaluate(`
            (() => {
                const el = document.querySelector('.cg-page');
                return {
                    game: el?.getAttribute('data-cg-game') || '',
                    logs: document.querySelectorAll('.cg-feed__list > *').length,
                    hasHead: !!document.querySelector('[data-cg-region="head"]')?.children.length,
                    hasAction: !!document.querySelector('[data-cg-region="action"]')?.children.length,
                    dice: document.querySelectorAll('.cg-dice').length,
                    board: document.querySelectorAll('.cg-cell').length,
                };
            })()
        `);
        check(`${label} 对局页在跑（${state.logs} 条记录）`, state.game === gameId && state.logs > 0, JSON.stringify(state));
        check(`${label} 三个区域都有内容`, state.hasHead && state.hasAction, JSON.stringify(state));
        if (gameId === 'monopoly') {
            check('大富翁棋盘 20 格', state.board === 20, `${state.board} 格`);
        }
        await page.shot(shot);

        // 收拾干净，免得影响下一局（同一个群同时只能有一局）
        await page.evaluate(`
            (() => {
                const app = window.externalAppRegistry?.getApp?.('chat');
                app?.methods?.gameAbort?.();
            })()
        `);
        await sleep(400);
    }

    console.log('\n── 兜底与整洁 ───────────────────────────');
    const bigSvg = await page.evaluate(`
        Array.from(document.querySelectorAll('.app-shell[data-app-id="chat"] .cg-lb svg, .app-shell[data-app-id="chat"] .cg-lobby svg'))
             .filter(s => s.getBoundingClientRect().width > 60).length
    `);
    check('没有被撑爆的 SVG', bigSvg === 0, `超大 ${bigSvg} 个`);

    const noisy = page.console.filter((l) => /^\[(error|exception)\]/.test(l));
    check('控制台没有 error / exception', noisy.length === 0, noisy.slice(0, 3).join(' | '));

    const failed = results.filter((r) => !r.ok);
    console.log(`\n结果：${results.length - failed.length} 通过 / ${failed.length} 失败`);
    if (noisy.length) {
        console.log('\n控制台噪音：');
        noisy.slice(0, 12).forEach((l) => console.log('  ' + l));
    }
    console.log('');

    try { proc.kill(); } catch (_) {}
    process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
    console.error('\n探针挂了：', err.message);
    process.exit(1);
});
