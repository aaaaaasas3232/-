/**
 * 点灯 · 推理墙交互探针
 *
 * 和 __probe-starlit.mjs 的分工：那支从 store 调函数，验「数据对不对」；
 * 这支**只用真实鼠标事件**，验「手指点下去到底有没有反应」。
 *
 * 为什么必须用 CDP 的 Input.dispatchMouseEvent 而不是 el.click()：
 * 推理墙用了 setPointerCapture，而 capture 只对「真实的活动指针」生效。
 * 页面内合成的 PointerEvent 拿不到 capture，也就永远复现不出
 * 「按钮点了没反应」这一类 bug —— 那正是这支探针要盯的东西。
 */
import { launch, openApp, check, section, report, sleep } from './__probe-kit.mjs';

/** 只为了让建主题那一步不去打真实 API */
const FAKE = `
(() => {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (url, init = {}) => {
    if (!/chat\\/completions/.test(String(url || ''))) return realFetch(url, init);
    const body = JSON.stringify({ questions: [
      { id: 'q1', kind: 'text', q: '随便问一句', placeholder: '' }
    ]});
    return new Response(JSON.stringify({ choices: [{ message: { content: body } }] }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  };
  return true;
})()
`;

async function mouse(page, type, x, y, extra = {}) {
    await page.send('Input.dispatchMouseEvent', {
        type,
        x,
        y,
        button: 'left',
        buttons: type === 'mouseReleased' ? 0 : 1,
        clickCount: 1,
        pointerType: 'mouse',
        ...extra,
    });
}

/** 真实的「按下 → 抬起」 */
async function tap(page, x, y, holdMs = 70) {
    await mouse(page, 'mouseMoved', x, y, { buttons: 0 });
    await mouse(page, 'mousePressed', x, y);
    await sleep(holdMs);
    await mouse(page, 'mouseReleased', x, y);
    await sleep(180);
}

/** 真实的拖动 */
async function drag(page, x0, y0, x1, y1, steps = 8) {
    await mouse(page, 'mouseMoved', x0, y0, { buttons: 0 });
    await mouse(page, 'mousePressed', x0, y0);
    for (let i = 1; i <= steps; i += 1) {
        await mouse(page, 'mouseMoved', x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
        await sleep(24);
    }
    await mouse(page, 'mouseReleased', x1, y1);
    await sleep(200);
}

async function rectOf(page, selector, index = 0) {
    return page.evaluate(`
        (() => {
            const el = document.querySelectorAll(${JSON.stringify(selector)})[${index}];
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return {
                x: Math.round(r.left + r.width / 2),
                y: Math.round(r.top + r.height / 2),
                w: Math.round(r.width), h: Math.round(r.height),
                top: Math.round(r.top), left: Math.round(r.left),
            };
        })()
    `);
}

/** 舞台里的一个相对点（0~1），换算成屏幕坐标 */
async function stagePoint(page, fx, fy) {
    const r = await rectOf(page, '.sl-wall__stage');
    return { x: Math.round(r.left + r.w * fx), y: Math.round(r.top + r.h * fy) };
}

/** 把某张卡挪到舞台正中，保证点得到 */
async function centerCard(page, cardId) {
    await page.evaluate(`
        (() => {
            const s = window.__slStore;
            const st = s.getState();
            const c = st.cards.find(x => String(x.id) === ${JSON.stringify(String(cardId))});
            const el = document.querySelector('.sl-wall__stage');
            if (!c || !el) return false;
            const z = st.wall.zoom || 1;
            s.setWallView({
                x: el.clientWidth / 2 - ((Number(c.x) || 0) + (c.w || 168) / 2) * z,
                y: el.clientHeight / 2 - ((Number(c.y) || 0) + (c.h || 108) / 2) * z,
            });
            return true;
        })()
    `);
    await sleep(250);
}

/** 按文字找按钮 */
async function rectOfText(page, selector, text) {
    return page.evaluate(`
        (() => {
            const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
                .find(e => (e.textContent || '').includes(${JSON.stringify(text)}));
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        })()
    `);
}

async function wallState(page) {
    return page.evaluate(`
        (() => {
            const s = window.__slStore.getState();
            return {
                zoom: s.wall.zoom, x: Math.round(s.wall.x), y: Math.round(s.wall.y),
                selected: s.wall.selectedId, spread: s.wall.spreadStackId,
                activeCard: s.activeCardId, cards: s.cards.length, links: s.links.length,
                linking: s.wall.linkingFrom, regions: s.wall.regions.length,
            };
        })()
    `);
}

async function run() {
    const { page, close } = await launch({ port: 9441, prefix: 'slw' });

    try {
        section('准备');
        await page.evaluate(`
            (async () => {
                const sdk = window.settingsSdk;
                let u = sdk.defaultUserCard?.getDefault?.() || sdk.users.getActive();
                if (!u) u = await sdk.users.create({ name: '探针用户' });
                await sdk.defaultUserCard.setDefault(u.id);
            })()
        `);
        await openApp(page, 'starlit', { settleMs: 1200 });
        check('根组件挂上了', await page.exists('.sl-root'));
        await page.evaluate(FAKE);
        await page.evaluate(`
            (async () => {
                const sdk = (window.__apiSdk || window.getApiSdk?.())?.apiKeySdk;
                await window.__apiSdkLoadingPromise;
                if (sdk && !sdk.list().length) {
                    sdk.put({ label: '探针', baseUrl: 'https://example.com/v1', apiKey: 'x', model: 'gpt-probe', enabled: true });
                }
            })()
        `);

        await page.evaluate(`
            (async () => {
                const s = window.__slStore;
                s.resetDraft();
                const d = s.getState().draft;
                d.title = '墙探针';
                d.mode = 'code';
                d.target = 'CSS';
                await s.createTopic();
            })()
        `);
        await page.waitFor(`window.__slStore.getState().topics.length > 0`, { label: '主题' });

        // 三张卡：两张会叠成堆，一张单独
        await page.evaluate(`
            (async () => {
                const s = window.__slStore;
                await s.createBlankCard(40, 40, 'note');
                await s.createBlankCard(40, 200, 'note');
                await s.createBlankCard(40, 360, 'concept');
                s.getState().activeCardId = '';
                s.setWallView({ x: 20, y: 20, zoom: 1 });
                s.recomputeRegions();
                s.setView('wall');
            })()
        `);
        await page.waitFor(`document.querySelector('.sl-wall')`, { label: '推理墙' });
        await sleep(600);
        check('三张便利贴画出来了', (await page.count('.sl-wc')) === 3, `${await page.count('.sl-wc')} 张`);

        section('A · 点一张卡能不能打开');
        const c0 = await rectOf(page, '.sl-wc', 0);
        await tap(page, c0.x, c0.y);
        let st = await wallState(page);
        check('★ 单击卡片打开详情', !!st.activeCard, JSON.stringify(st));
        check('卡片详情真的渲染了', await page.exists('.sl-cd'));

        section('B · 卡片详情里能不能删掉');
        if (st.activeCard) {
            await sleep(500); // 等抽屉滑上来，不然量到的按钮位置还在屏幕外
            const del = await rectOfText(page, '.sl-cd__foot .sl-btn', '删除');
            if (del) await tap(page, del.x, del.y);
            check('弹出了确认框', await page.exists('.sl-overlay'));
            const ok = await rectOfText(page, '.sl-modal__foot .sl-btn', '删掉');
            if (ok) await tap(page, ok.x, ok.y);
            await sleep(400);
            st = await wallState(page);
            check('★ 卡片真的被删掉了', st.cards === 2, `还剩 ${st.cards} 张`);
        } else {
            check('★ 卡片真的被删掉了', false, '详情根本没打开');
        }

        // 补回一张，后面还要用
        await page.evaluate(`
            (async () => {
                const s = window.__slStore;
                await s.createBlankCard(40, 40, 'note');
                s.getState().activeCardId = '';
            })()
        `);
        await sleep(300);

        section('C · 分块面板里的「看全部」');
        const focusBtn = await rectOf(page, '.sl-wall__top .sl-wall__icon', 1);
        await tap(page, focusBtn.x, focusBtn.y);
        check('分块面板打开了', await page.exists('.sl-regions'));
        const zoomBefore = (await wallState(page)).zoom;
        const allBtn = await rectOf(page, '.sl-regions__all');
        if (allBtn) await tap(page, allBtn.x, allBtn.y);
        await sleep(400);
        const zoomAfter = (await wallState(page)).zoom;
        check('★「看全部」真的改了视口', zoomBefore !== zoomAfter || !(await page.exists('.sl-regions')),
            `zoom ${zoomBefore} → ${zoomAfter}`);
        check('★「看全部」之后面板收起来了', !(await page.exists('.sl-regions')));

        section('D · 分块面板里点某一块');
        await page.evaluate(`
            (() => {
                const s = window.__slStore;
                s.recomputeRegions();
                s.setWallView({ x: 20, y: 20, zoom: 1 });
            })()
        `);
        await sleep(250);
        const focusBtn2 = await rectOf(page, '.sl-wall__top .sl-wall__icon', 1);
        await tap(page, focusBtn2.x, focusBtn2.y);
        await sleep(300);
        const rowCount = await page.count('.sl-regions__row');
        if (rowCount) {
            const zb = (await wallState(page)).zoom;
            const row = await rectOf(page, '.sl-regions__row', 0);
            await tap(page, row.x, row.y);
            await sleep(500);
            const after = await wallState(page);
            check('★ 点某一块能聚焦过去', !!after.regions && after.zoom !== zb,
                `zoom ${zb} → ${after.zoom}`);
            check('★ 聚焦之后面板收起来了', !(await page.exists('.sl-regions')));
        } else {
            check('★ 点某一块能聚焦过去', false, '一块都没有');
        }

        section('E · 堆叠卡片点开摊平');
        const topOfStack = await page.evaluate(`
            (async () => {
                const s = window.__slStore;
                const cs = s.getState().cards;
                await s.stackCards(cs[0].id, cs[1].id);
                s.getState().activeCardId = '';
                s.setWallView({ zoom: 1 });
                const members = s.stackMembers(cs[0].stackId);
                return String(members[members.length - 1].id);
            })()
        `);
        await sleep(400);
        check('堆叠形成了', (await page.evaluate(
            `window.__slStore.getState().cards.filter(c => c.stackId).length`,
        )) === 2);
        await centerCard(page, topOfStack);
        const stackCard = await page.evaluate(`
            (() => {
                const el = document.querySelector('.sl-wc.is-stack');
                if (!el) return null;
                const r = el.getBoundingClientRect();
                return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
            })()
        `);
        check('墙上看得出是一堆', !!stackCard);
        if (stackCard) {
            await tap(page, stackCard.x, stackCard.y);
            await sleep(500);
            st = await wallState(page);
            check('★ 点一下卡堆摊开', !!st.spread, JSON.stringify(st));
            check('★ 摊开后两张都在', (await page.count('.sl-spread__card')) === 2);
            // 左右滑一下切到另一张。摊开时停在最上面那张，所以往回滑
            const rail = await rectOf(page, '.sl-spread__rail');
            const idxBefore = await page.evaluate(`window.__slStore.getState().wall.spreadIndex`);
            const dir = idxBefore > 0 ? 1 : -1;
            await drag(page, rail.x - 75 * dir, rail.y, rail.x + 75 * dir, rail.y, 10);
            await sleep(500);
            const idxAfter = await page.evaluate(`window.__slStore.getState().wall.spreadIndex`);
            check('★ 摊开后左右滑能切卡', idxAfter !== idxBefore, `${idxBefore} → ${idxAfter}`);
            // 到头之后再滑一下不该跑出界
            await drag(page, rail.x - 75 * dir, rail.y, rail.x + 75 * dir, rail.y, 10);
            await sleep(400);
            const idxEnd = await page.evaluate(`window.__slStore.getState().wall.spreadIndex`);
            const stillOpen = await page.count('.sl-spread__card');
            check('★ 滑到头就停住，摊开层也不会被滑没',
                stillOpen === 2 && idxEnd >= 0 && idxEnd < stillOpen, `index ${idxEnd}，还剩 ${stillOpen} 张`);

            const on = await rectOf(page, '.sl-spread__card.is-on');
            if (on) {
                await tap(page, on.x, on.y);
                await sleep(500);
                check('★ 点摊开的那张能进详情', !!(await wallState(page)).activeCard);
                await page.evaluate(`window.__slStore.getState().activeCardId = ''`);
            }
            await page.evaluate(`window.__slStore.closeSpread()`);
            await sleep(300);
        }

        section('F · 拖动 / 平移');
        await page.evaluate(`window.__slStore.setWallView({ x: 30, y: 30, zoom: 1 })`);
        await sleep(200);
        const before = await wallState(page);
        // 空白处拖 = 平移画布（挑舞台右下角，避开卡片）
        const blank = await stagePoint(page, 0.86, 0.86);
        await drag(page, blank.x, blank.y, blank.x - 70, blank.y - 40);
        const afterPan = await wallState(page);
        check('★ 空白处拖动能平移画布', afterPan.x !== before.x, `${before.x} → ${afterPan.x}`);

        const soloId = await page.evaluate(`
            (() => {
                const el = [...document.querySelectorAll('.sl-wc')].find(e => !e.classList.contains('is-stack'));
                return el ? el.dataset.cardId : '';
            })()
        `);
        if (soloId) await centerCard(page, soloId);
        const solo = await page.evaluate(`
            (() => {
                const el = [...document.querySelectorAll('.sl-wc')].find(e => !e.classList.contains('is-stack'));
                if (!el) return null;
                const r = el.getBoundingClientRect();
                return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
                         id: el.dataset.cardId };
            })()
        `);
        if (solo) {
            const posBefore = await page.evaluate(
                `JSON.stringify(window.__slStore.getState().cards.find(c => c.id === ${JSON.stringify(solo.id)}))`,
            );
            await drag(page, solo.x, solo.y, solo.x + 60, solo.y + 40);
            const posAfter = await page.evaluate(
                `JSON.stringify(window.__slStore.getState().cards.find(c => c.id === ${JSON.stringify(solo.id)}))`,
            );
            check('★ 拖卡片能移动', posBefore !== posAfter);
            check('★ 拖完不会误开详情', !(await wallState(page)).activeCard);
        }

        section('G · 长按卡片');
        const g1 = await page.evaluate(`document.querySelector('.sl-wc')?.dataset.cardId || ''`);
        if (g1) await centerCard(page, g1);
        const c1 = await page.evaluate(`
            (() => {
                const el = document.querySelector('.sl-wc');
                if (!el) return null;
                const r = el.getBoundingClientRect();
                return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
            })()
        `);
        if (c1) {
            await mouse(page, 'mouseMoved', c1.x, c1.y, { buttons: 0 });
            await mouse(page, 'mousePressed', c1.x, c1.y);
            await sleep(700);
            const menuUp = await page.exists('.sl-wmenu');
            await mouse(page, 'mouseReleased', c1.x, c1.y);
            await sleep(300);
            check('★ 长按卡片弹出菜单', menuUp || (await page.exists('.sl-wmenu')));
        }

        section('H · 墙上直接删卡');
        const beforeDel = (await wallState(page)).cards;
        if (await page.exists('.sl-wmenu')) {
            const delBtn = await rectOfText(page, '.sl-wmenu button', '删');
            if (delBtn) {
                await tap(page, delBtn.x, delBtn.y);
                await sleep(300);
                check('长按菜单里点删弹出了确认框', await page.exists('.sl-overlay'));
                const ok = await rectOfText(page, '.sl-modal__foot .sl-btn', '删掉');
                if (ok) await tap(page, ok.x, ok.y);
                await sleep(500);
            }
        }
        check('★ 墙上能直接删掉一张卡', (await wallState(page)).cards < beforeDel,
            `${beforeDel} → ${(await wallState(page)).cards}`);

        section('I · 缩放按钮 / 滚轮');
        const z0 = (await wallState(page)).zoom;
        const plus = await rectOf(page, '.sl-wall__bar button', 1);
        await tap(page, plus.x, plus.y);
        await sleep(300);
        check('★ 放大按钮有效', (await wallState(page)).zoom > z0, `${z0} → ${(await wallState(page)).zoom}`);
        const z0b = (await wallState(page)).zoom;
        const minus = await rectOf(page, '.sl-wall__bar button', 0);
        await tap(page, minus.x, minus.y);
        await sleep(300);
        check('★ 缩小按钮有效', (await wallState(page)).zoom < z0b);

        const stage = await rectOf(page, '.sl-wall__stage');
        const z1 = (await wallState(page)).zoom;
        await page.send('Input.dispatchMouseEvent', {
            type: 'mouseWheel', x: stage.x, y: stage.y, deltaX: 0, deltaY: -120, pointerType: 'mouse',
        });
        await sleep(300);
        check('★ 滚轮缩放有效', (await wallState(page)).zoom !== z1);

        section('J · 全屏开关');
        const expandBtn = await rectOf(page, '.sl-wall__top .sl-wall__icon', 2);
        const topBefore = (await rectOf(page, '.sl-wall__stage')).top;
        await tap(page, expandBtn.x, expandBtn.y);
        await sleep(450);
        const topAfter = (await rectOf(page, '.sl-wall__stage')).top;
        check('★ 全屏按钮真的把画布放大了', topAfter < topBefore, `stage top ${topBefore} → ${topAfter}`);
        // 全屏下还得能退出去
        check('★ 全屏下还有返回入口', await page.exists('.sl-wall__top .sl-wall__icon'));
        const back2 = await rectOf(page, '.sl-wall__top .sl-wall__icon', 2);
        await tap(page, back2.x, back2.y);
        await sleep(400);

        section('K · 连线');
        await page.evaluate(`
            (async () => {
                const s = window.__slStore;
                while (s.getState().cards.length < 3) await s.createBlankCard(40, 40, 'note');
                s.getState().activeCardId = '';
                s.setWallView({ x: 16, y: 16, zoom: 0.8 });
            })()
        `);
        await sleep(400);
        // 只挑「整张都落在舞台里」的卡，不然点下去会打到底栏
        const two = await page.evaluate(`
            (() => {
                const st = document.querySelector('.sl-wall__stage').getBoundingClientRect();
                const inside = [...document.querySelectorAll('.sl-wc')].map(e => {
                    const r = e.getBoundingClientRect();
                    return { id: e.dataset.cardId,
                             x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
                }).filter(p => p.x > st.left + 8 && p.x < st.right - 8 && p.y > st.top + 8 && p.y < st.bottom - 8);
                return inside.length >= 2 ? inside.slice(0, 2) : null;
            })()
        `);
        check('至少两张卡完整落在舞台里', !!two);
        if (two) {
            await page.evaluate(`window.__slStore.beginLink(${JSON.stringify(two[0].id)})`);
            await sleep(250);
            check('连线状态下有提示条', await page.exists('.sl-wall__hint'));
            await tap(page, two[1].x, two[1].y);
            check('★ 点第二张卡弹出关系选择', await page.exists('.sl-kinds'));
            const kind = await rectOf(page, '.sl-kinds__item', 0);
            const linksBefore = (await wallState(page)).links;
            if (kind) await tap(page, kind.x, kind.y);
            await sleep(400);
            check('★ 选完关系真的连上了', (await wallState(page)).links > linksBefore,
                `${linksBefore} → ${(await wallState(page)).links}`);
        }

        section('L · 点红线改关系');
        if (await page.exists('.sl-link__hit')) {
            const p = await page.evaluate(`
                (() => {
                    const el = document.querySelector('path.sl-link__hit');
                    if (!el) return null;
                    const len = el.getTotalLength();
                    const pt = el.getPointAtLength(len / 2);
                    const svg = el.ownerSVGElement;
                    const m = el.getScreenCTM();
                    const p = svg.createSVGPoint(); p.x = pt.x; p.y = pt.y;
                    const s = p.matrixTransform(m);
                    return { x: Math.round(s.x), y: Math.round(s.y) };
                })()
            `);
            if (p) {
                await tap(page, p.x, p.y);
                await sleep(350);
                check('★ 点红线能打开编辑', await page.exists('.sl-modal--link'));
                await page.evaluate(`window.__slStore.closeModal()`);
            }
        }

        section('总控制台');
        const errs = page.errors();
        check('全程没有 JS 报错', errs.length === 0, errs.slice(0, 6).join('\n              '));
        await page.screenshot('99-wall');
    } catch (err) {
        console.error('\n探针崩了：', err.message);
        check('探针跑完', false, err.message);
    } finally {
        await close();
    }

    process.exit(report() ? 0 : 1);
}

run();
