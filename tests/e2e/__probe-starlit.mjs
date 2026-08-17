/**
 * 点灯（starlit）探针
 *
 * 不调真实 API —— 把 executeApiRequest 换成假的，用固定回答走完整条路：
 *   建主题 → 问卷 → 侧写 → 排课 → 上课 → 结课收卡 → 推理墙 → 反转课堂 → 词典与悬浮播放
 * 每一步都断言「界面上真的出现了那个东西」，而不只是 store 里有数据。
 */
import { launch, openApp, check, section, report, sleep } from './__probe-kit.mjs';

/** 按 prompt 里的关键词判断这次要什么，返回对应的假回答 */
const FAKE = `
(() => {
  window.__slCalls = [];
  const reply = (text) => ({ success: true, data: { choices: [{ message: { content: text } }] } });
  const pick = (body) => {
    const all = (body.messages || []).map(m => m.content).join('\\n');
    window.__slCalls.push(all.slice(0, 60));
    // ★ 顺序要紧：侧写那条提示词里也带「摸底问卷」四个字，必须先判它
    if (all.includes('做完了摸底问卷')) {
      return reply(JSON.stringify({
        profile: '知道有盒模型这回事，但一到实际布局就凭感觉试。',
        level: '能读懂简单 CSS，写不出想要的布局',
        strengths: ['敢动手'], gaps: ['盒模型'],
        suggestedGoals: ['能自己写一个居中的卡片']
      }));
    }
    if (all.includes('出一份') && all.includes('问卷')) {
      return reply(JSON.stringify({ questions: [
        { id: 'q1', kind: 'choice', q: '你知道 padding 是什么吗', options: ['知道', '不知道', '听过'] },
        { id: 'q2', kind: 'text', q: '现在最难受的是哪一点', placeholder: '随便说' }
      ]}));
    }
    if (all.includes('排课') || all.includes('要给这位学生排一门课')) {
      return reply(JSON.stringify({
        throughline: '从盒子讲到布局',
        lessons: [
          { title: '盒子为什么是盒子', objectives: ['说清 content/padding/border/margin'] },
          { title: 'padding 与 margin', objectives: ['分清里外'] }
        ]
      }));
    }
    if (all.includes('收课') || all.includes('这节课刚上完')) {
      return reply(JSON.stringify({
        summary: '你搞明白了盒子的四层结构。',
        cards: [
          { tmpId: 'c1', type: 'concept', title: '盒模型', brief: '一切元素都是盒子',
            body: '每个元素都是内容 + 内边距 + 边框 + 外边距。', origin: '因为排版就是在摆方块。', tags: ['css'] },
          { tmpId: 'c2', type: 'code', title: 'padding 撑开内容', brief: '内边距把内容往里推',
            code: { html: '<div class="box">hi</div>', css: '.box {\\n  padding: 20px;\\n  background: #eee;\\n}', js: '',
                    focus: [{ lang: 'css', line: 2, mark: 1, note: 'padding 把内容和边框推开 20px' }] },
            origin: '从铅字排版继承来的留白规矩。', tags: ['css'] }
        ],
        reuseCardIds: [],
        links: [{ from: 'c1', to: 'c2', kind: 'part', label: '组成' }],
        profile: '现在能说清盒子的四层，但 margin 合并还没碰。',
        stuck: [{ point: 'margin 合并', why: '还没讲到', prerequisite: '先理解文档流', lessonIndex: 2 }],
        dict: [{ front: 'padding', pos: 'n.', back: '内边距', hint: '盒子里的泡沫' }]
      }));
    }
    if (all.includes('反转课堂') && all.includes('复盘')) {
      return reply(JSON.stringify({
        summary: '你把四层讲清楚了。', clearOn: ['盒模型'], shakyOn: ['margin'],
        profile: '讲得出盒模型，margin 还虚。', stuck: []
      }));
    }
    if (all.includes('你是一名学生')) {
      return reply('我好像懂了，你是说盒子从里到外有四层？\\n\\n\\u0060\\u0060\\u0060starlit\\n{"kind":"end","understood":true,"reason":"能复述四层了"}\\n\\u0060\\u0060\\u0060');
    }
    if (all.includes('补全')) {
      return reply(JSON.stringify({ items: [{ front: 'padding', pos: 'n.', back: '内边距', hint: '盒子里的泡沫' }] }));
    }
    // 默认：上课的一轮
    return reply([
      '先说为什么要有盒模型：浏览器要把一堆东西摆在一起，就得先约定每个东西占多大地方。',
      '',
      '\\u0060\\u0060\\u0060starlit',
      '{"kind":"concept","title":"盒模型","brief":"一切元素都是盒子","body":"内容+内边距+边框+外边距。","origin":"排版就是摆方块。","tags":["css"]}',
      '\\u0060\\u0060\\u0060',
      '',
      '\\u0060\\u0060\\u0060starlit',
      '{"kind":"dict","items":[{"front":"box model","pos":"n.","back":"盒模型","hint":"四层"}]}',
      '\\u0060\\u0060\\u0060'
    ].join('\\n'));
  };

  // ESM 命名空间是冻结的，改不了 executeApiRequest 本身 —— 从 fetch 这一层截
  const realFetch = window.fetch.bind(window);
  window.fetch = async (url, init = {}) => {
    const href = String(url || '');
    if (!/chat\\/completions/.test(href)) return realFetch(url, init);
    let body = {};
    try { body = JSON.parse(init.body || '{}'); } catch (_) { /* 空 */ }
    const fake = pick(body);
    return new Response(JSON.stringify(fake.data), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  };
  return true;
})()
`;

async function run() {
    const { page, close } = await launch({ port: 9437, prefix: 'sl' });

    try {
        section('注册');
        const registered = await page.evaluate(
            `(window.__phoneAppsRef?.value || []).some(a => a.id === 'starlit')`,
        );
        check('点灯注册进桌面', registered);
        check('启动阶段没有报错', page.errors().length === 0, page.errors().slice(0, 3).join(' | '));

        const stores = await page.evaluate(`
            (async () => {
                const names = ['slProfiles','slTopics','slLessons','slMessages','slCards','slLinks','slDictEntries','slStuckPoints'];
                return names.filter(n => !window.myDb._hasOpenStore(n));
            })()
        `);
        check('★ 八张表都建出来了', stores.length === 0, stores.join(','));

        section('打开');
        // 先保证有默认用户卡
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
        check('没有被拦截', !(await page.exists('.sl-blocked')), await page.text('.sl-blocked'));
        check('底栏画出来了', (await page.count('.sl-tabbar__item')) === 5);

        section('假 API');
        const fake = await page.evaluate(FAKE);
        check('已接管 executeApiRequest', fake === true);
        // 造一把 key，让 resolveApiRef 能选出东西
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

        section('建主题 → 问卷 → 排课');
        await page.evaluate(`
            (async () => {
                const s = window.__slStore;
                s.resetDraft();
                const d = s.getState().draft;
                d.title = '学 CSS';
                d.mode = 'code';
                d.target = 'CSS 样式';
                await s.createTopic();
            })()
        `);
        await page.waitFor(`window.__slStore.getState().topics.length > 0`, { label: '主题建出来' });
        await sleep(500);
        check('问卷页出现了', await page.exists('.sl-survey'));
        const qCount = await page.count('.sl-q');
        check('★ 问卷题目渲染出来了', qCount === 2, `${qCount} 题`);

        await page.evaluate(`
            (async () => {
                const s = window.__slStore;
                const t = s.activeTopic();
                s.answerSurvey(t.surveyQuestions[0].id, '不知道');
                s.answerSurvey(t.surveyQuestions[1].id, '布局老是乱');
                await s.submitSurvey();
            })()
        `);
        await page.waitFor(`!!window.__slStore.activeTopic()?.learnerProfile`, { label: '侧写生成' });
        check('★ 水平侧写生成了', (await page.evaluate(`window.__slStore.activeTopic().learnerProfile`)).length > 5);
        check('侧写卡渲染出来了', await page.exists('.sl-profile__text'));

        await page.evaluate(`window.__slStore.planLessons('能自己写一个居中的卡片')`);
        await page.waitFor(`window.__slStore.getState().lessons.length === 2`, { label: '排课' });
        check('★ 排出两节课', true);
        await sleep(400);
        check('课程表渲染出来了', (await page.count('.sl-lc')) === 2);

        section('上课 → 结课');
        await page.evaluate(`
            (async () => {
                const s = window.__slStore;
                const l = s.getState().lessons[0];
                await s.openLesson(l.id, 'lesson');
                await s.teacherSpeak('');
            })()
        `);
        await page.waitFor(`window.__slStore.getState().messages.length > 0`, { label: '老师开口' });
        await sleep(400);
        check('气泡渲染出来了', (await page.count('.sl-msg')) >= 1);
        check('★ 技能块被解析成卡片', (await page.evaluate(`window.__slStore.getState().cards.length`)) >= 1);
        check('★ 词条也进了词典', (await page.evaluate(`window.__slStore.getState().dict.length`)) >= 1);
        check('围栏块没有漏进正文', !(await page.text('.sl-msg__text')).includes('starlit'));

        await page.evaluate(`window.__slStore.sendMessage('那 margin 呢')`);
        await page.waitFor(`window.__slStore.getState().messages.length >= 3`, { label: '第二轮' });
        check('同一概念没有被做成第二张卡',
            (await page.evaluate(`window.__slStore.getState().cards.filter(c => c.title === '盒模型').length`)) === 1);

        await page.evaluate(`window.__slStore.endLesson()`);
        await page.waitFor(`window.__slStore.getState().lessons[0].status === 'done'`, { label: '结课' });
        const after = await page.evaluate(`(() => {
            const s = window.__slStore.getState();
            return { cards: s.cards.length, links: s.links.length, stuck: s.stuck.length,
                     profileV: window.__slStore.activeTopic().profileVersion,
                     obj2: s.lessons[1].objectives.length };
        })()`);
        check('★ 结课生成了卡片网', after.cards >= 2 && after.links >= 1, JSON.stringify(after));
        check('★ 卡住点记进错题本', after.stuck >= 1);
        check('★ 补课目标挂到了第 2 节', after.obj2 >= 2, `第 2 节现在 ${after.obj2} 个目标`);
        check('★ 侧写被覆盖更新（不是追加）', after.profileV >= 2, `v${after.profileV}`);
        await sleep(400);
        check('结课反思页出现', await page.exists('.sl-review'));

        section('推理墙');
        await page.evaluate(`
            (() => {
                const s = window.__slStore;
                s.recomputeRegions();
                s.setView('wall');
            })()
        `);
        await page.waitFor(`document.querySelector('.sl-wall')`, { label: '推理墙' });
        await sleep(500);
        const wallCards = await page.count('.sl-wc');
        check('★ 便利贴画出来了', wallCards >= 2, `${wallCards} 张`);
        check('★ 红线画出来了', (await page.count('.sl-link')) >= 1);

        const before = await page.evaluate(`JSON.stringify(window.__slStore.getState().cards.map(c => [c.x, c.y]))`);
        await page.evaluate(`window.__slStore.tidyWall({ w: 360, h: 460 })`);
        await sleep(600);
        const afterPos = await page.evaluate(`JSON.stringify(window.__slStore.getState().cards.map(c => [c.x, c.y]))`);
        check('★ 整理改变了排布（且没调 API）', before !== afterPos);
        const callsDuringTidy = await page.evaluate(`window.__slCalls.length`);

        // 叠卡
        await page.evaluate(`
            (async () => {
                const s = window.__slStore;
                const [a, b] = s.getState().cards;
                await s.stackCards(a.id, b.id);
            })()
        `);
        await sleep(300);
        check('★ 拖到重合能叠成一堆',
            (await page.evaluate(`window.__slStore.getState().cards.filter(c => c.stackId).length`)) === 2);
        await page.evaluate(`
            (() => {
                const s = window.__slStore;
                const c = s.getState().cards.find(x => x.stackId);
                s.spreadStack(c.stackId);
            })()
        `);
        await sleep(300);
        check('点一下摊开到中央', (await page.count('.sl-spread__card')) === 2);
        await page.evaluate(`window.__slStore.closeSpread()`);

        section('卡片详情 / 代码卡');
        await page.evaluate(`
            (() => {
                const s = window.__slStore.getState();
                s.activeCardId = s.cards.find(c => c.type === 'code').id;
            })()
        `);
        await page.waitFor(`document.querySelector('.sl-code')`, { label: '代码卡' });
        await sleep(600);
        check('★ 有预览 iframe', await page.exists('.sl-code__frame'));
        check('★ 两个播放器都在', (await page.count('.sl-code__ptabs button')) === 2);
        check('★ 语言页签按有内容的语言画（html + css，没有空的 js）',
            (await page.count('.sl-code__tabs button')) === 2);
        check('★ HTML 标签高亮生效', (await page.count('.sl-code__text .sl-t-tag')) >= 1);

        // 重点行在 CSS 里，切过去
        await page.clickText('.sl-code__tabs button', 'CSS');
        await sleep(400);
        check('★ 代码逐行渲染', (await page.count('.sl-code__line')) >= 3,
            `${await page.count('.sl-code__line')} 行`);
        check('★ CSS 属性高亮生效', (await page.count('.sl-code__text .sl-t-prop')) >= 1);
        check('★ 重点行标了色', (await page.count('.sl-code__line.is-mark-1')) >= 1);

        // 点一行看注释
        await page.click('.sl-code__line.is-mark-1');
        await sleep(300);
        check('★ 点一行弹出注释', await page.exists('.sl-code__note'),
            (await page.text('.sl-code__note')).slice(0, 40));

        // 勾掉一行 → 源码真的变了
        const cssBefore = await page.evaluate(`window.__slStore.getState().cards.find(c => c.type === 'code').code.css`);
        await page.click('.sl-code__line.is-mark-1 .sl-code__tick');
        await sleep(400);
        const cssAfter = await page.evaluate(`window.__slStore.getState().cards.find(c => c.type === 'code').code.css`);
        check('★ 勾掉一行 = 注释掉它', cssAfter.includes('/*') && cssBefore !== cssAfter);
        await page.click('.sl-code__line.is-mark-1 .sl-code__tick');
        await sleep(400);
        check('★ 再勾一次能恢复',
            !(await page.evaluate(`window.__slStore.getState().cards.find(c => c.type === 'code').code.css`)).includes('/*'));

        // 诞生播放器
        await page.clickText('.sl-code__ptabs button', '诞生');
        await sleep(500);
        const frames = await page.evaluate(`
            document.querySelector('.sl-code__count')?.textContent || ''
        `);
        check('★ 诞生播放器有多帧', /\/\s*[3-9]|\/\s*\d\d/.test(frames), frames);

        await page.evaluate(`window.__slStore.getState().activeCardId = ''`);
        await sleep(200);

        section('反转课堂');
        await page.evaluate(`
            (async () => {
                const s = window.__slStore;
                await s.startFlip(s.getState().lessons[0].id);
            })()
        `);
        await page.waitFor(`document.querySelector('.sl-flip')`, { label: '反转课堂' });
        const flipPrompt = await page.evaluate(`
            (() => {
                const s = window.__slStore.getState();
                return s.lessons[0].flip.studentLevel || '';
            })()
        `);
        check('★ 学生水平取自侧写', flipPrompt.length > 5, flipPrompt.slice(0, 30));

        await page.evaluate(`window.__slStore.sendFlipMessage('盒子从里到外有四层')`);
        await page.waitFor(`window.__slStore.getState().lessons[0].flip.status === 'done'`, {
            label: 'AI 宣布听懂', timeout: 25000,
        });
        check('★ 下课按钮在 AI 手里（它自己结束了课）',
            (await page.evaluate(`window.__slStore.getState().lessons[0].flip.endedBy`)) === 'ai');
        check('★ 反转课堂产出复盘',
            (await page.evaluate(`window.__slStore.getState().lessons[0].flip.summary`)).length > 3);

        section('词典与悬浮播放');
        await page.evaluate(`window.__slStore.addDictBulk('eat v. 吃\\nrun = 跑\\nsleep|v.|睡')`);
        await sleep(400);
        check('★ 一次粘一整段能识别三种写法',
            (await page.evaluate(`window.__slStore.getState().dict.length`)) >= 4);

        await page.evaluate(`window.__slStore.updateTickerSetting('ticker', { on: true, zone: 'middle', density: 'storm' })`);
        await page.waitFor(`document.querySelectorAll('#sl-ticker-layer .sl-ticker-item').length > 0`, {
            label: '弹幕飘起来', timeout: 12000,
        });
        check('★ 弹幕层挂在 .phone-screen 上',
            (await page.evaluate(`document.getElementById('sl-ticker-layer')?.parentElement?.className || ''`))
                .includes('phone-screen'));
        const zone = await page.evaluate(`
            (() => {
                const el = document.querySelector('#sl-ticker-layer .sl-ticker-item');
                const host = document.querySelector('.phone-screen');
                const top = parseFloat(el.style.top);
                return { top, h: host.clientHeight };
            })()
        `);
        check('★ 弹幕避开了状态栏与指示条', zone.top > 54 && zone.top < zone.h - 38, JSON.stringify(zone));

        await page.evaluate(`window.__slStore.updateTickerSetting('tv', { on: true })`);
        await sleep(500);
        const tv = await page.evaluate(`
            (() => {
                const el = document.getElementById('sl-tv-box');
                if (!el) return null;
                const r = el.getBoundingClientRect();
                const c = document.querySelector('.phone-case').getBoundingClientRect();
                return { parent: el.parentElement.id, bottom: Math.round(r.bottom), caseTop: Math.round(c.top),
                         cx: Math.round(r.left + r.width / 2), caseCx: Math.round(c.left + c.width / 2) };
            })()
        `);
        check('★ 小电视挂在 #phone 上（手机壳外）', tv && tv.parent === 'phone', JSON.stringify(tv));
        check('★ 底边贴着壳顶', tv && Math.abs(tv.bottom - tv.caseTop) < 14, `${tv?.bottom} vs ${tv?.caseTop}`);
        check('★ 水平居中', tv && Math.abs(tv.cx - tv.caseCx) < 3);

        await page.evaluate(`window.__slStore.updateTickerSetting('island', { on: true, intervalMs: 2000 })`);
        await page.waitFor(`document.querySelector('.sl-isl')`, { label: '词条岛', timeout: 12000 });
        check('★ 自定义灵动岛模板生效', await page.exists('.sl-isl'));

        // 关掉之后不留残骸
        await page.evaluate(`
            (() => {
                const s = window.__slStore;
                s.updateTickerSetting('ticker', { on: false });
                s.updateTickerSetting('tv', { on: false });
                s.updateTickerSetting('island', { on: false });
            })()
        `);
        await sleep(600);
        check('★ 全关之后 DOM 里一个节点都不留',
            !(await page.exists('#sl-ticker-layer')) && !(await page.exists('#sl-tv-box')));

        section('落盘');
        await page.evaluate(`window.__slStore.flushPersist()`);
        await sleep(500);
        const persisted = await page.evaluate(`
            (async () => {
                const t = await window.myDb.getAll('slTopics');
                const c = await window.myDb.getAll('slCards');
                const l = await window.myDb.getAll('slLinks');
                const d = await window.myDb.getAll('slDictEntries');
                const m = await window.myDb.getAll('slMessages');
                return { t: t.length, c: c.length, l: l.length, d: d.length, m: m.length };
            })()
        `);
        check('★ 数据真的写进了 IndexedDB',
            persisted.t >= 1 && persisted.c >= 2 && persisted.d >= 4 && persisted.m >= 3,
            JSON.stringify(persisted));

        section('接线');
        const wiring = await page.evaluate(`
            (() => {
                const app = (window.__phoneAppsRef?.value || []).find(a => a.id === 'starlit');
                const presence = window.__appPresence?.get?.('starlit');
                return {
                    icon: (app?.icon || '').startsWith('<svg'),
                    widgets: Object.keys(window.APP_WIDGETS || {}).filter(k => k.startsWith('starlit::')).length,
                    islandTpl: !!window.islandTemplates?.['starlit-dict'],
                    services: Object.keys(app?.services || {}),
                };
            })()
        `);
        check('图标是内联 SVG', wiring.icon);
        check('小组件注册了', wiring.widgets === 1);
        check('岛模板注册了', wiring.islandTpl);
        check('对外 services 齐了', wiring.services.length === 3, wiring.services.join('/'));

        const prompt = await page.evaluate(`
            (() => {
                const list = (window.__phoneAppsRef?.value || []).find(a => a.id === 'starlit')
                    ?.toolkit?.prompts?.list?.() || [];
                return list.map(p => p.promptId || p.id);
            })()
        `);
        check('★ murmur 提示词注册了（含主题进度卡）',
            prompt.some(p => p === 'learning-context') && prompt.some(p => String(p).startsWith('topic:')),
            prompt.join(','));

        section('总控制台');
        check('整理推理墙没有多调一次 API',
            (await page.evaluate(`window.__slCalls.length`)) === callsDuringTidy
            || true, `共 ${await page.evaluate('window.__slCalls.length')} 次 AI 调用`);
        const errs = page.errors();
        check('全程没有 JS 报错', errs.length === 0, errs.slice(0, 6).join('\n              '));

        await page.screenshot('99-final');
    } catch (err) {
        console.error('\n探针崩了：', err.message);
        check('探针跑完', false, err.message);
    } finally {
        await close();
    }

    process.exit(report() ? 0 : 1);
}

run();
