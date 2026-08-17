/**
 * 小奇怪(oddity)探针
 *
 * 覆盖 2026-08 这轮重做的全部要求:
 *   1. 顶栏不再被状态栏挡住
 *   2. 扫雷 = 真实扫雷:点格子扫、长按插旗、第一下不炸、能拉 AI 一起玩
 *   3. 五子棋:JS 判胜负、AI 落子(模型路径 + 本地兜底)、台词进日志
 *   4. 战绩分享进 murmur(复用 game_record 卡,私聊里能读回来)
 *   5. 提示词库:增删改 + 注入 AI 对局的 system prompt
 *   6. murmur 动态卡「游戏数据概要」跟着战绩更新
 *
 * 不调真实 API —— fetch 层拦下 chat/completions,回固定坐标。
 */
import { launch, openApp, check, section, report, sleep } from './__probe-kit.mjs';

const FAKE = `
(() => {
  window.__oqCalls = [];
  const reply = (text) => JSON.stringify({ choices: [{ message: { content: text } }] });
  const realFetch = window.fetch.bind(window);
  window.fetch = async (url, init = {}) => {
    const href = String(url || '');
    if (!/chat\\/completions/.test(href)) return realFetch(url, init);
    let body = {};
    try { body = JSON.parse(init.body || '{}'); } catch (_) {}
    const sys = (body.messages || []).find(m => m.role === 'system')?.content || '';
    const user = (body.messages || []).find(m => m.role === 'user')?.content || '';
    window.__oqCalls.push({ sys, user });
    let text = '{"x":1,"y":1,"line":"随手一格"}';
    if (sys.includes('五子棋')) text = '{"x":15,"y":15,"line":"就落这儿了"}';
    else if (sys.includes('扫雷')) text = '{"x":9,"y":9,"line":"我赌这格是空的"}';
    return new Response(reply(text), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return true;
})()
`;

/** 对着某个格子来一次「短点」(pointerdown → 快速 pointerup) */
async function tapCell(page, selector, { index = 0 } = {}) {
    return page.evaluate(`
        (async () => {
            const el = document.querySelectorAll(${JSON.stringify(selector)})[${index}];
            if (!el) return 'no-el';
            el.scrollIntoView({ block: 'center' });
            const r = el.getBoundingClientRect();
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            const ev = (type) => new PointerEvent(type, {
                bubbles: true, cancelable: true, composed: true,
                pointerId: 21, pointerType: 'touch', isPrimary: true, clientX: cx, clientY: cy,
            });
            el.dispatchEvent(ev('pointerdown'));
            await new Promise(r2 => setTimeout(r2, 60));
            el.dispatchEvent(ev('pointerup'));
            return 'ok';
        })()
    `);
}

/** 长按 */
async function pressCell(page, selector, { index = 0, holdMs = 620 } = {}) {
    return page.evaluate(`
        (async () => {
            const el = document.querySelectorAll(${JSON.stringify(selector)})[${index}];
            if (!el) return 'no-el';
            const r = el.getBoundingClientRect();
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            const ev = (type) => new PointerEvent(type, {
                bubbles: true, cancelable: true, composed: true,
                pointerId: 22, pointerType: 'touch', isPrimary: true, clientX: cx, clientY: cy,
            });
            el.dispatchEvent(ev('pointerdown'));
            await new Promise(r2 => setTimeout(r2, ${holdMs}));
            el.dispatchEvent(ev('pointerup'));
            return 'ok';
        })()
    `);
}

const { page, close } = await launch({ port: 9445, prefix: 'oqp', appsTimeout: 90000 });

try {
    section('准备');
    await page.evaluate(`
        (async () => {
            const sdk = window.settingsSdk;
            let u = sdk.defaultUserCard?.getDefault?.() || sdk.users.getActive();
            if (!u) u = await sdk.users.create({ name: '探针用户' });
            await sdk.defaultUserCard.setDefault(u.id);
            let ai = (sdk.aiPersons.list() || []).find(a => a.name === '阿箱');
            if (!ai) ai = await sdk.aiPersons.create({ name: '阿箱', personality: '嘴硬但好脾气' });
            window.__oqAiId = String(ai.id);
        })()
    `);
    check('有默认用户卡和 AI 人设', Boolean(await page.evaluate(`window.__oqAiId`)));

    const hooked = await page.evaluate(FAKE);
    check('接管了 fetch', hooked === true);
    const keyReady = await page.evaluate(`
        (async () => {
            const sdk = (window.__apiSdk || window.getApiSdk?.())?.apiKeySdk;
            if (!sdk) return 'no-sdk';
            await window.__apiSdkLoadingPromise;
            if (sdk.list().length) return 'exists';
            sdk.put({ label: '探针', baseUrl: 'https://example.com/v1', apiKey: 'x', model: 'gpt-probe', enabled: true });
            return sdk.list().length ? 'created' : 'failed';
        })()
    `);
    check('有一把可用的 Key', keyReady === 'exists' || keyReady === 'created', keyReady);

    section('打开 & 顶栏');
    await openApp(page, 'oddity', { settleMs: 1500 });
    check('根组件挂上了', await page.exists('.oq-root'));
    await page.waitFor(`window.__oqStore && window.__oqStore.getState().ready`, { label: 'oddity ready' });

    const layout = JSON.parse(await page.evaluate(`
        (() => {
            const bar = document.querySelector('.statusBarContainer');
            const title = document.querySelector('.app-shell[data-app-id="oddity"] .oq-topbar-name');
            if (!title) return JSON.stringify({ err: 'no-title' });
            const b = bar ? bar.getBoundingClientRect() : { bottom: 0 };
            const t = title.getBoundingClientRect();
            return JSON.stringify({ statusBottom: b.bottom, titleTop: t.top });
        })()
    `));
    check('★ 顶栏标题在状态栏下面(不再被挡)', layout.titleTop >= layout.statusBottom - 1,
        JSON.stringify(layout));

    const chips = await page.evaluate(`[...document.querySelectorAll('.oq-chip')].map(e => e.textContent.trim()).join(',')`);
    check('★ 玩 tab 有扫雷 / 五子棋 / 你有我没有', chips.includes('扫雷') && chips.includes('五子棋') && chips.includes('你有我没有'), chips);
    check('顶栏有提示词库和战绩键', (await page.count('.oq-topbar-act')) === 2);

    section('扫雷 · 真实玩法(本地双人)');
    await page.evaluate(`
        window.__oqStore.newMinesweeper({ seed: 7, players: [
            { name: '我', kind: 'user' }, { name: '玩家二', kind: 'user' },
        ] })
    `);
    await sleep(400);
    check('棋盘画出来了', (await page.count('.oq-ms-cell')) === 81);

    // 点格子直接扫
    const tap1 = await tapCell(page, '.oq-ms-cell', { index: 40 });
    await sleep(300);
    const afterTap = JSON.parse(await page.evaluate(`
        JSON.stringify({
            revealed: window.__oqStore.getState().minesweeper.cells.filter(c => c.revealed).length,
            move: window.__oqStore.getState().minesweeper.moveCount,
            turn: window.__oqStore.getState().minesweeper.turn,
            log: window.__oqStore.getState().minesweeper.log.length,
        })
    `));
    check('★ 点格子就是扫(不再要道具)', tap1 === 'ok' && afterTap.move === 1 && afterTap.revealed >= 1, JSON.stringify(afterTap));
    check('★ 第一下永远安全', await page.evaluate(`window.__oqStore.getState().minesweeper.cells.filter(c => c.revealed && c.mine).length`) === 0);
    check('轮到玩家二', afterTap.turn === 'p2');
    check('日志写上了', afterTap.log >= 1);

    // 长按插旗
    const unrevealedIdx = await page.evaluate(`
        window.__oqStore.getState().minesweeper.cells.find(c => !c.revealed).index
    `);
    await pressCell(page, `.oq-ms-cell[data-index="${unrevealedIdx}"]`);
    await sleep(200);
    const flagged = await page.evaluate(`window.__oqStore.getState().minesweeper.cells[${unrevealedIdx}].flag === true`);
    check('★ 长按插旗', flagged);
    const flagMark = await page.exists('.oq-ms-flagmark');
    check('旗子画出来了', flagMark);
    // 插了旗的格子扫不动
    const sweepFlagged = await page.evaluate(`JSON.stringify(window.__oqStore.sweepMinesweeper(${unrevealedIdx}, 'p2'))`);
    check('★ 插了旗的格子点不动', JSON.parse(sweepFlagged).reason === 'flagged', sweepFlagged);

    section('扫雷 · 拉 AI 一起玩');
    await page.evaluate(`
        window.__oqStore.newMinesweeper({ seed: 11, players: [
            { name: '我', kind: 'user' }, { name: '阿箱', kind: 'ai', aiId: window.__oqAiId },
        ] })
    `);
    await sleep(300);
    // 我扫一格 → 轮到 AI → 它该自己动手
    await page.evaluate(`window.__oqStore.sweepMinesweeper(0, 'p1')`);
    await page.waitFor(`window.__oqStore.getState().minesweeper.moveCount >= 2`, { label: 'AI 自己扫了一格', timeout: 15000 });
    const msAi = JSON.parse(await page.evaluate(`
        JSON.stringify({
            move: window.__oqStore.getState().minesweeper.moveCount,
            turn: window.__oqStore.getState().minesweeper.turn,
            flavor: window.__oqStore.getState().minesweeper.log.some(l => l.kind === 'flavor'),
        })
    `));
    check('★ AI 座位自己动手了', msAi.move >= 2 && msAi.turn === 'p1', JSON.stringify(msAi));
    check('★ AI 有台词(模型或本地)', msAi.flavor);

    section('五子棋 · JS 判胜负');
    await page.evaluate(`window.__oqStore.setSubTab('play', 'gomoku')`);
    await sleep(400);
    check('切到五子棋', await page.exists('.oq-go'));
    // 本地双人快速造一条黑五连:黑 (0..4) 行 0,白 (0..3) 行 1
    await page.evaluate(`
        (() => {
            const s = window.__oqStore;
            s.newGomoku({ players: [{ name: '我', kind: 'user' }, { name: '老王', kind: 'user' }] });
            for (let i = 0; i < 4; i++) {
                s.placeGomoku(i, 'black');
                s.placeGomoku(15 + i, 'white');
            }
            s.placeGomoku(4, 'black');
        })()
    `);
    await sleep(400);
    const goEnd = JSON.parse(await page.evaluate(`
        JSON.stringify({
            finished: window.__oqStore.getState().gomoku.finished,
            winner: window.__oqStore.getState().gomoku.winner,
            winLine: window.__oqStore.getState().gomoku.winLine.length,
        })
    `));
    check('★ 五连即胜(JS 判定)', goEnd.finished && goEnd.winner === 'black' && goEnd.winLine >= 5, JSON.stringify(goEnd));
    check('胜负画在棋盘上', (await page.count('.oq-go-cell.is-winline')) >= 5);
    const goScore = await page.evaluate(`JSON.stringify((window.__oqStore.getState().scores[0] || {}).gameKind)`);
    check('战绩记下了', goScore.includes('gomoku'), goScore);

    section('五子棋 · AI 落子(模型路径)');
    const callsBefore = await page.evaluate(`window.__oqCalls.length`);
    await page.evaluate(`
        window.__oqStore.newGomoku({ players: [
            { name: '我', kind: 'user' }, { name: '阿箱', kind: 'ai', aiId: window.__oqAiId },
        ] })
    `);
    await sleep(200);
    // 我(黑)落天元 → AI(白)该动了;假模型回 (15,15)
    await page.evaluate(`window.__oqStore.placeGomoku(112, 'black')`);
    await page.waitFor(`window.__oqStore.getState().gomoku.moveCount >= 2`, { label: 'AI 落子', timeout: 15000 });
    const goAi = JSON.parse(await page.evaluate(`
        JSON.stringify({
            corner: window.__oqStore.getState().gomoku.board[224],
            calls: window.__oqCalls.length,
            flavor: window.__oqStore.getState().gomoku.log.some(l => l.kind === 'flavor' && l.text.includes('就落这儿了')),
        })
    `));
    check('★ 模型回的坐标真被用上((15,15))', goAi.corner === 'white', JSON.stringify(goAi));
    check('★ 调用走的是模型', goAi.calls > callsBefore, `calls ${callsBefore} -> ${goAi.calls}`);
    check('★ 模型的台词进了日志', goAi.flavor);

    section('提示词库 → 注入对局');
    await page.evaluate(`window.__oqStore.addCustomPrompt({ title: '嘴硬', content: '探针专用暗号XQGZ:输了要嘴硬' })`);
    const libCount = await page.evaluate(`window.__oqStore.listCustomPrompts().length`);
    check('自定义提示词加进库了', libCount >= 1, `共 ${libCount} 条`);
    // 再让 AI 走一步,检查 system prompt 里带上了暗号
    await page.evaluate(`window.__oqStore.placeGomoku(113, 'black')`);
    await page.waitFor(`window.__oqCalls.some(c => c.sys.includes('XQGZ'))`, { label: '暗号注入 prompt', timeout: 15000 });
    check('★ 提示词注入了 AI 对局的 system', true);
    // UI 面板打开
    await page.click('.oq-topbar-act');
    await sleep(400);
    check('提示词库面板能开', (await page.evaluate(`document.body.textContent.includes('这里的每一条都会注入所有 AI 对局')`)));
    await page.evaluate(`window.__oqStore.closeModal()`);

    section('分享到 murmur(复用 game_record)');
    // 用刚才那局已结束的本地五子棋不行了(被覆盖),重新造一局速胜
    await page.evaluate(`
        (() => {
            const s = window.__oqStore;
            s.newGomoku({ players: [{ name: '我', kind: 'user' }, { name: '老王', kind: 'user' }] });
            for (let i = 0; i < 4; i++) { s.placeGomoku(i, 'black'); s.placeGomoku(15 + i, 'white'); }
            s.placeGomoku(4, 'black');
        })()
    `);
    const shareRes = JSON.parse(await page.evaluate(`
        (async () => JSON.stringify(await window.__oqStore.shareMatch('gomoku', window.__oqAiId)))()
    `));
    check('★ 分享返回 ok', shareRes.ok === true, JSON.stringify(shareRes));
    const shared = JSON.parse(await page.evaluate(`
        (() => {
            const sdk = window.settingsSdk;
            const msgs = sdk.chatMessages.list(null, window.__oqAiId, 'calendar') || [];
            const hit = msgs.filter(m => m.type === 'game_record').pop();
            return JSON.stringify(hit ? {
                type: hit.type,
                game: hit.gameRecord?.gameName,
                players: (hit.gameRecord?.players || []).length,
                winnerLabel: hit.gameRecord?.winnerLabel,
            } : null);
        })()
    `));
    check('★ murmur 私聊里出现战绩卡消息', shared && shared.type === 'game_record' && shared.players === 2,
        JSON.stringify(shared));

    section('游戏数据概要');
    // 打开面板
    await page.click('.oq-topbar-act', { index: 1 });
    await sleep(400);
    const boardText = await page.evaluate(`document.body.textContent.includes('游戏数据概要')`);
    check('概要面板能开', boardText);
    await page.evaluate(`window.__oqStore.closeModal()`);
    const statsPrompt = JSON.parse(await page.evaluate(`
        (() => {
            const list = (window.__phoneAppsRef?.value || []).find(a => a.id === 'oddity')
                ?.toolkit?.prompts?.list?.() || [];
            const hit = list.find(p => (p.promptId || p.id) === 'oddity-stats');
            return JSON.stringify(hit ? { found: true, hasContent: /五子棋/.test(hit.content || '') } : { found: false });
        })()
    `));
    check('★ murmur 动态卡「游戏数据概要」注册且带真实战绩', statsPrompt.found && statsPrompt.hasContent,
        JSON.stringify(statsPrompt));

    section('粉红果冻心 (捏 tab)');
    await page.evaluate(`window.__oqStore.setTab('pinch')`);
    await sleep(400);
    check('果冻心组件挂载', await page.exists('.oq-jelly-heart'));
    check('没有散落圆点', (await page.count('.oq-jelly-prop')) === 0);
    check('顶栏有设置工具键', await page.exists('.oq-topbar-act'));

    section('沙漏双面心语 (看 tab)');
    await page.evaluate(`window.__oqStore.setTab('watch')`);
    await sleep(400);
    check('沙漏组件挂载', await page.exists('.oq-hg'));
    check('初始处于白昼表面态', (await page.exists('.oq-hg.is-flipped')) === false);
    // 触发翻转
    await page.evaluate(`(() => {
        const hg = document.querySelector('.oq-hg');
        if (hg) hg.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    })()`);
    await sleep(400);
    check('翻转后进入黑色颠倒态', await page.exists('.oq-hg.is-flipped'));

    section('打字机欲言又止');
    await page.evaluate(`window.__oqStore.setSubTab('watch', 'typewriter')`);
    await sleep(400);
    check('打字机组件挂载', await page.exists('.oq-tw-root'));

    section('工具小浮窗');
    await page.click('.oq-slimbar-tool');
    await sleep(400);
    const pop = JSON.parse(await page.evaluate(`
        (() => {
            const shell = document.querySelector('.app-shell[data-app-id="oddity"]');
            const card = shell?.querySelector('.oq-pop');
            if (!card) return JSON.stringify({ open: false });
            const root = shell.querySelector('.oq-root');
            const bar = shell.querySelector('.oq-slimbar');
            const tabbar = shell.querySelector('.oq-tabbar');
            const layer = shell.querySelector('.oq-pop-layer');
            const r = root.getBoundingClientRect();
            const c = card.getBoundingClientRect();
            return JSON.stringify({
                open: true,
                // Teleport 有没有真的把它挪出滚动容器
                inStage: Boolean(card.closest('.oq-stage')),
                inRoot: Boolean(card.closest('.oq-root')),
                widthRatio: +(c.width / r.width).toFixed(2),
                heightRatio: +(c.height / r.height).toFixed(2),
                // 落点是不是贴在细浮条底下
                dropGap: Math.round(c.top - bar.getBoundingClientRect().bottom),
                // 遮罩有没有让开底栏
                clearsTabbar: layer.getBoundingClientRect().bottom
                    <= tabbar.getBoundingClientRect().top + 1,
            });
        })()
    `));
    check('工具键能开出浮窗', pop.open === true);
    check('★ Teleport 生效：浮窗挂在 oq-root 上，不在会滚的 oq-stage 里',
        pop.inRoot === true && pop.inStage === false, JSON.stringify(pop));
    check('★ 是小卡片不是半屏弹窗', pop.widthRatio <= 0.75 && pop.heightRatio <= 0.55,
        `宽 ${pop.widthRatio} 高 ${pop.heightRatio}`);
    check('★ 从细浮条底下落出来', pop.dropGap >= 0 && pop.dropGap <= 24, `间距 ${pop.dropGap}px`);
    check('★ 没有盖住自绘底栏', pop.clearsTabbar === true);
    await page.evaluate(`window.__oqStore.closePanel()`);
    await sleep(400);
    check('点外面能收起', (await page.exists('.oq-pop')) === false);

    section('匿名三件套 (回答箱 / 收信箱 / 漂流瓶)');
    await page.evaluate(`window.__oqStore.setSubTab('watch', 'askbox')`);
    await sleep(400);
    check('回答箱组件挂载', await page.exists('.oq-anon--ask'));

    await page.evaluate(`window.__oqStore.setSubTab('watch', 'letterbox')`);
    await sleep(400);
    check('收信箱组件挂载', await page.exists('.oq-anon--letter'));

    await page.evaluate(`window.__oqStore.setSubTab('watch', 'bottle')`);
    await sleep(400);
    check('漂流瓶组件挂载', await page.exists('.oq-anon--bottle'));

    section('统一心事夹 (藏 tab)');
    await page.evaluate(`window.__oqStore.setTab('favorite')`);
    await sleep(400);
    check('收藏页组件挂载', await page.exists('.oq-fav-root'));

    await page.screenshot('99-final');

    section('控制台');
    const errs = page.errors();
    check('全程没有 JS 报错', errs.length === 0, errs.slice(0, 6).join(' | '));
} finally {
    await close();
}
report();
