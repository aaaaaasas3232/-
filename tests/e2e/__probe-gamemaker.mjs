/**
 * murmur 小游戏「做一个新游戏」：
 *   - 大厅有入口，三步表单能走完
 *   - 提示词生成得出来、内容对
 *   - 上传 js 能装上，装完出现在大厅、每个群都能开
 *   - 静态体检能拦住 import / setTimeout / 缺接口
 */
import { launch, openApp, check, section, report, sleep } from './__probe-kit.mjs';

const SHELL = '.app-shell[data-app-id="chat"]';

async function openDetail(page, pageId) {
    await page.evaluate(`
        document.dispatchEvent(new CustomEvent('app:page-action', {
            detail: { action: 'detail', appId: 'chat', pageId: ${JSON.stringify(pageId)} }, bubbles: true,
        }))
    `);
    await sleep(800);
}

async function run() {
    const { page, close } = await launch({ port: 9423, prefix: 'gm-probe' });

    try {
        await openApp(page, 'chat', { settleMs: 1500 });

        section('大厅入口');
        await openDetail(page, 'game-selector');
        const lobby = await page.evaluate(`
            (() => {
                const shell = document.querySelector('${SHELL}');
                const cards = [...(shell?.querySelectorAll('.cg-lobby-card') || [])].map(c => c.textContent.replace(/\\s+/g, ' ').trim());
                return { n: cards.length, cards, hasMaker: cards.some(t => t.includes('做一个新游戏')) };
            })()
        `);
        check('★ 大厅有「做一个新游戏」', lobby.hasMaker, lobby.cards.join(' | ').slice(0, 140));

        section('三步表单');
        await openDetail(page, 'game-maker');
        check('制作页打开了', await page.exists(`${SHELL} .cgm-page`));
        const steps = await page.count(`${SHELL} .cgm-step`);
        check('三步导航在', steps === 3, String(steps));

        // 填名字 → 下一步 → 应该保留
        await page.evaluate(`
            (() => {
                const el = document.querySelector('${SHELL} [data-cgm-field="name"]');
                if (el) { el.value = '谁在说谎'; el.dispatchEvent(new Event('input', { bubbles: true })); }
            })()
        `);
        await page.clickText(`${SHELL} .cgm-btn`, '下一步');
        await sleep(700);
        await page.clickText(`${SHELL} .cgm-btn`, '上一步');
        await sleep(700);
        const kept = await page.evaluate(`document.querySelector('${SHELL} [data-cgm-field="name"]')?.value || ''`);
        check('★ 换步不丢输入', kept === '谁在说谎', kept || '(空了)');

        section('提示词');
        const prompt = await page.evaluate(`
            (async () => {
                const m = await import('/js/apps/chat-app/games/game-prompt.js');
                const text = m.buildGamePrompt({ name: '谁在说谎', gameId: 'who-lies', minPlayers: 4, maxPlayers: 9, flow: 'day-night', winRule: 'elimination', hasRoles: true, roles: '说谎者/观察者/普通人' });
                return {
                    len: text.length,
                    hasSkeleton: text.includes('export default'),
                    hasKit: text.includes('window.__chatGameKit'),
                    banImport: text.includes('都不能写') && text.includes('Failed to resolve module specifier'),
                    banTimeout: text.includes('不许用') && text.includes('setTimeout 是闭包'),
                    banDom: text.includes('一行 DOM 都不能碰'),
                    hasId: text.includes('who-lies'),
                    hasFlow: text.includes('昼夜交替型'),
                    hasApiList: text.includes('kit.awaitUser') && text.includes('kit.askAi') && text.includes('kit.ui.seatStrip'),
                };
            })()
        `);
        check('提示词够长', prompt.len > 4000, `${prompt.len} 字`);
        check('带了骨架代码', prompt.hasSkeleton);
        check('说清楚了 kit 从哪来', prompt.hasKit);
        check('★ 明确禁止 import', prompt.banImport);
        check('★ 明确禁止 setTimeout', prompt.banTimeout);
        check('★ 明确禁止碰 DOM', prompt.banDom);
        check('填的 id 进去了', prompt.hasId);
        check('选的流程类型进去了', prompt.hasFlow);
        check('列全了可用 API', prompt.hasApiList);

        section('静态体检拦得住');
        const checks = await page.evaluate(`
            (async () => {
                const m = await import('/js/apps/chat-app/games/custom-games.js');
                return {
                    imp: m.validateGameCode("import x from './a.js';\\nexport default { setup(){}, runStep(){}, handleUserAction(){}, buildView(){}, buildResult(){} }"),
                    noExport: m.validateGameCode('const a = 1;'),
                    missing: m.validateGameCode('export default { setup(){} }'),
                    timeout: m.validateGameCode('export default { setup(){ setTimeout(()=>{},1) }, runStep(){}, handleUserAction(){}, buildView(){}, buildResult(){} }'),
                };
            })()
        `);
        check('★ 拦住 import', !checks.imp.ok && checks.imp.errors[0].includes('import'));
        check('拦住没有 export default', !checks.noExport.ok);
        check('拦住缺接口', !checks.missing.ok && checks.missing.errors.some(e => e.includes('runStep')));
        check('★ setTimeout 给出警告', checks.timeout.ok && checks.timeout.warnings.some(w => w.includes('setTimeout')));

        section('装一个真的玩法');
        const installed = await page.evaluate(`
            (async () => {
                const games = (window.__phoneAppsRef?.value || []).find(a => a.id === 'chat');
                const m = await import('/js/apps/chat-app/games/index.js');
                const code = m.buildSampleGameCode();
                const r = await m.installAndPersistGame(code, { fileName: 'sample.js', allowReplace: true });
                const list = m.listGames().map(g => g.id);
                return {
                    ok: r.success, err: r.error,
                    gameId: r.gameId,
                    inList: list.includes('show-of-hands'),
                    total: list.length,
                    isCustom: m.isCustomGame('show-of-hands'),
                };
            })()
        `);
        check('★ 示例玩法装上了', installed.ok, installed.err || '');
        check('★ 出现在游戏清单里', installed.inList, `共 ${installed.total} 个`);
        check('标成了自制', installed.isCustom);

        // 大厅上真的能看到
        await openDetail(page, 'game-selector');
        const lobby2 = await page.evaluate(`
            [...document.querySelectorAll('${SHELL} .cg-lobby-card')].map(c => c.textContent.replace(/\\s+/g,' ').trim())
        `);
        check('★ 大厅列出了自制游戏', lobby2.some((t) => t.includes('举手表决')), lobby2.join(' | ').slice(0, 160));
        check('自制游戏带「自制」角标', lobby2.some((t) => t.includes('举手表决') && t.includes('自制')));
        await page.screenshot('01-lobby');

        section('刷新后还在');
        const persisted = await page.evaluate(`
            (() => {
                const raw = localStorage.getItem('xiaoting::chat-custom-games-v1');
                if (!raw) return { ok: false };
                const store = JSON.parse(raw);
                return { ok: !!store['show-of-hands'], hasCode: !!store['show-of-hands']?.code };
            })()
        `);
        check('★ 存盘了', persisted.ok);
        check('代码也存了（刷新能重装）', persisted.hasCode);

        section('清理 + 控制台');
        await page.evaluate(`
            (async () => {
                const m = await import('/js/apps/chat-app/games/index.js');
                m.removeCustomGame('show-of-hands');
            })()
        `);
        const errs = page.errors();
        check('没有 JS 报错', errs.length === 0, errs.slice(0, 4).join(' | '));
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
