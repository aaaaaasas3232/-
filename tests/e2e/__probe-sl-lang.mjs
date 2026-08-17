/**
 * 点灯 · 语言模式专项探针
 *
 * 专测这一批功能（2026-08 用户点名的五件事）：
 *   1. 浸没维度：从头到尾外文 / 循序渐进（写进老师提示词）
 *   2. 一条回复拆多个气泡（一泡一两行）
 *   3. 翻译两种形态：描边贴边（meme）/ 点开展开（tap，微信式）
 *   4. 长按气泡 / 卡片翻译（本地词典 or AI，AI 时只发这张卡的内容）
 *   5. 悬浮译文层：长按拖动、单击关闭、位置持久
 *
 * 不调真实 API。全部用假回答走通。
 */
import { launch, openApp, check, section, report, sleep } from './__probe-kit.mjs';

const FAKE = `
(() => {
  window.__slCalls = [];
  const reply = (text) => ({ success: true, data: { choices: [{ message: { content: text } }] } });
  const pick = (body) => {
    const all = (body.messages || []).map(m => m.content).join('\\n');
    window.__slCalls.push({ system: (body.messages||[])[0]?.content || '', user: all.slice(-400), full: all });
    if (all.includes('做完了摸底问卷')) {
      return reply(JSON.stringify({
        profile: '认识几百个词，能读简单句，一开口就想先想中文。',
        level: '入门偏上',
        strengths: ['词汇量还行'], gaps: ['开口'],
        suggestedGoals: ['能用英语聊完一顿早饭']
      }));
    }
    if (all.includes('出一份') && all.includes('问卷')) {
      return reply(JSON.stringify({ questions: [
        { id: 'q1', kind: 'choice', q: 'apple 是什么', options: ['苹果', '香蕉', '不知道'] },
        { id: 'q2', kind: 'text', q: '最难受的是哪一点', placeholder: '随便说' }
      ]}));
    }
    if (all.includes('排课') || all.includes('要给这位学生排一门课')) {
      return reply(JSON.stringify({
        throughline: '从一顿早饭聊起',
        lessons: [
          { title: 'Breakfast talk', objectives: ['能说出三种早餐'] },
          { title: 'Ordering food', objectives: ['能点单'] }
        ]
      }));
    }
    if (all.includes('收课') || all.includes('这节课刚上完')) {
      return reply(JSON.stringify({
        summary: '你能聊早饭了。',
        cards: [], reuseCardIds: [], links: [],
        profile: '能聊早饭，语序还会中式。', stuck: [], dict: []
      }));
    }
    if (all.includes('翻成自然的中文')) {
      return reply('【AI译】' + ((body.messages||[]).slice(-1)[0]?.content || '').slice(0, 40));
    }
    // 上课回复：三段正文 + gloss 数组 + 一张词卡 + 词典
    return reply([
      'Good morning! What did you eat today?',
      '',
      'I had bread and a big red apple.',
      '',
      'Tell me about your breakfast.',
      '',
      '\\u0060\\u0060\\u0060starlit',
      '{"kind":"gloss","texts":["早上好！你今天吃了什么？","我吃了面包和一个大红苹果。","跟我说说你的早饭吧。"]}',
      '\\u0060\\u0060\\u0060',
      '',
      '\\u0060\\u0060\\u0060starlit',
      '{"kind":"word","term":"breakfast","pos":"n.","meaning":"早餐","roots":[{"part":"break","from":"古英语 brecan","means":"打破"},{"part":"fast","from":"古英语 fæsten","means":"斋戒"}],"examples":["I eat breakfast at eight."],"why":"打破一夜的斋戒，所以叫 break-fast"}',
      '\\u0060\\u0060\\u0060',
      '',
      '\\u0060\\u0060\\u0060starlit',
      '{"kind":"dict","items":[{"front":"bread","pos":"n.","back":"面包","hint":"br- 系"},{"front":"apple","pos":"n.","back":"苹果","hint":""},{"front":"eat","pos":"v.","back":"吃","hint":"词根 ed-"}]}',
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

/** 在页面里对着选择器命中的元素派发一次「长按」（pointerdown → 等 → pointerup） */
async function longPress(page, selector, { index = 0, holdMs = 560, thenUp = true } = {}) {
    return page.evaluate(`
        (async () => {
            const el = document.querySelectorAll(${JSON.stringify(selector)})[${index}];
            if (!el) return 'no-el';
            el.scrollIntoView({ block: 'center' });
            const r = el.getBoundingClientRect();
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            const ev = (type) => new PointerEvent(type, {
                bubbles: true, cancelable: true, composed: true,
                pointerId: 7, pointerType: 'touch', isPrimary: true,
                clientX: cx, clientY: cy,
            });
            el.dispatchEvent(ev('pointerdown'));
            await new Promise(r2 => setTimeout(r2, ${holdMs}));
            ${thenUp ? "el.dispatchEvent(ev('pointerup'));" : ''}
            return 'ok';
        })()
    `);
}

const { page, close } = await launch({ port: 9433, prefix: 'sll', appsTimeout: 90000 });

try {
    section('准备');
    // 先保证有默认用户卡
    await page.evaluate(`
        (async () => {
            const sdk = window.settingsSdk;
            let u = sdk.defaultUserCard?.getDefault?.() || sdk.users.getActive();
            if (!u) u = await sdk.users.create({ name: '探针用户' });
            await sdk.defaultUserCard.setDefault(u.id);
        })()
    `);
    const hooked = await page.evaluate(FAKE);
    check('接管了 fetch', hooked === true);

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

    await openApp(page, 'starlit');
    await page.waitFor(`window.__slStore && window.__slStore.getState().ready`, { label: 'starlit ready' });

    section('建语言主题');
    await page.evaluate(`
        (async () => {
            const s = window.__slStore;
            s.resetDraft();
            const st = s.getState();
            st.draft.mode = 'language';
            st.draft.target = '英语';
            st.draft.targetNative = 'English';
            st.draft.title = '学英语';
            await s.createTopic();
        })()
    `);
    await page.waitFor(`window.__slStore.getState().topics.length > 0`, { label: '主题建好' });
    const topicMode = await page.evaluate(`window.__slStore.getState().topics[0].mode`);
    check('语言主题建好了', topicMode === 'language');
    const defaultImmersion = await page.evaluate(`window.__slStore.getState().topics[0].immersion || '(空)'`);
    check('★ 新主题默认浸没维度是 gradual', defaultImmersion === 'gradual', `实际: ${defaultImmersion}`);

    section('问卷 → 排课');
    await page.waitFor(`window.__slStore.getState().topics[0].surveyQuestions?.length >= 2`, { label: '问卷生成' });
    await page.evaluate(`
        (async () => {
            const s = window.__slStore;
            const t = s.getState().topics[0];
            for (const q of t.surveyQuestions) s.answerSurvey(q.id, q.kind === 'choice' ? q.options[0] : '想开口');
            await s.submitSurvey();
            await s.planLessons('能用英语聊完一顿早饭');
        })()
    `);
    await page.waitFor(`window.__slStore.getState().lessons.length >= 2`, { label: '排课完成' });
    check('排出两节课', true);

    section('上课：拆气泡 + 描边中文');
    await page.evaluate(`
        (async () => {
            const s = window.__slStore;
            await s.openLesson(s.getState().lessons[0].id, 'lesson');
            await s.teacherSpeak('');
        })()
    `);
    await page.waitFor(`window.__slStore.getState().messages.length >= 3`, { label: '老师开口' });
    await sleep(600);

    const msgs = await page.evaluate(`JSON.stringify(window.__slStore.getState().messages.map(m => ({ role: m.role, text: (m.text||'').slice(0, 30), gloss: (m.gloss||'').slice(0, 20), cards: (m.cardIds||[]).length })))`);
    const parsed = JSON.parse(msgs);
    check('★ 一条回复拆成了 3 个气泡', parsed.filter(m => m.role === 'teacher').length === 3, msgs);
    check('★ 每个气泡都有各自的翻译', parsed.filter(m => m.role === 'teacher').every(m => m.gloss), msgs);
    check('★ 卡片只挂在最后一泡', parsed.filter(m => m.role === 'teacher' && m.cards > 0).length === 1
        && parsed[parsed.length - 1].cards > 0, msgs);

    const glossCount = await page.evaluate(`document.querySelectorAll('.sl-gloss').length`);
    check('★ 描边中文渲染出来了（meme 模式）', glossCount === 3, `实际 ${glossCount} 个`);

    // 视觉：描边字不能盖住下一条气泡
    const overlap = await page.evaluate(`
        (() => {
            const msgs = [...document.querySelectorAll('.sl-msg')];
            for (let i = 0; i < msgs.length - 1; i++) {
                const g = msgs[i].querySelector('.sl-gloss');
                if (!g) continue;
                const gr = g.getBoundingClientRect();
                const nb = msgs[i + 1].querySelector('.sl-msg__bubble');
                if (!nb) continue;
                const nr = nb.getBoundingClientRect();
                if (gr.bottom > nr.top + 2) return '第' + i + '条的译文盖到了下一条: ' + gr.bottom.toFixed(0) + ' > ' + nr.top.toFixed(0);
            }
            return '';
        })()
    `);
    check('★ 描边字没盖住下一条气泡', !overlap, overlap);
    await page.screenshot('01-meme-gloss');

    section('切换微信式（tap）');
    await page.evaluate(`window.__slStore.setGlossMode('tap')`);
    await sleep(400);
    const trBtns = await page.evaluate(`document.querySelectorAll('.sl-msg__tr').length`);
    check('★ 每个气泡出现「译」按钮', trBtns === 3, `实际 ${trBtns}`);
    const memeGlossGone = await page.evaluate(`document.querySelectorAll('.sl-gloss').length`);
    check('★ 描边字消失（两种形态互斥）', memeGlossGone === 0, `残留 ${memeGlossGone}`);
    await page.click('.sl-msg__tr');
    await sleep(400);
    const trBody = await page.evaluate(`document.querySelector('.sl-msg__trbody')?.textContent || ''`);
    check('★ 点开展开翻译', trBody.includes('早上好'), trBody.slice(0, 30));
    await page.screenshot('02-tap-gloss');
    await page.evaluate(`window.__slStore.setGlossMode('meme')`);
    await sleep(300);

    section('长按气泡 → 本地词典翻译');
    const lpRes = await longPress(page, '.sl-msg__text', { index: 1 });
    check('长按派发成功', lpRes === 'ok', lpRes);
    await sleep(500);
    const trans1 = await page.evaluate(`JSON.stringify(window.__slStore.getState().translation || null)`);
    const t1 = JSON.parse(trans1);
    check('★ 长按弹出翻译层', !!t1, trans1.slice(0, 120));
    check('★ 本地词典命中（bread / apple）', !!t1 && t1.kind === 'local' && (t1.hits || []).length >= 2,
        t1 ? JSON.stringify(t1.hits || []).slice(0, 100) : '');
    const memeEl = await page.evaluate(`!!document.querySelector('.sl-meme')`);
    check('★ 悬浮层渲染出来了', memeEl);
    await page.screenshot('03-longpress-local');

    section('悬浮层：长按拖动 / 单击关闭');
    const dragRes = await page.evaluate(`
        (async () => {
            const el = document.querySelector('.sl-meme');
            if (!el) return 'no-el';
            const host = el.offsetParent || el.parentElement;
            const hr = host.getBoundingClientRect();
            const r = el.getBoundingClientRect();
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            const ev = (type, x, y) => new PointerEvent(type, {
                bubbles: true, cancelable: true, composed: true,
                pointerId: 9, pointerType: 'touch', isPrimary: true,
                clientX: x, clientY: y,
            });
            el.dispatchEvent(ev('pointerdown', cx, cy));
            await new Promise(r2 => setTimeout(r2, 560));
            el.dispatchEvent(ev('pointermove', cx + 40, cy - 120));
            await new Promise(r2 => setTimeout(r2, 60));
            el.dispatchEvent(ev('pointermove', cx + 80, cy - 200));
            await new Promise(r2 => setTimeout(r2, 60));
            el.dispatchEvent(ev('pointerup', cx + 80, cy - 200));
            return JSON.stringify({ hostW: hr.width.toFixed(0) });
        })()
    `);
    await sleep(400);
    const pos1 = await page.evaluate(`JSON.stringify({ x: window.__slStore.getState().translation?.x, y: window.__slStore.getState().translation?.y })`);
    const p1 = JSON.parse(pos1);
    check('★ 长按后能拖动（位置变了）', p1.x !== 50 || p1.y !== 72, `${pos1} (drag: ${dragRes})`);
    const saved = await page.evaluate(`JSON.stringify({ x: window.__slStore.getState().profile?.translate?.memeX, y: window.__slStore.getState().profile?.translate?.memeY })`);
    check('★ 拖完位置写进档案（下次还在原地）', JSON.parse(saved).x === p1.x, saved);

    // 单击 = 关闭
    await page.evaluate(`
        (async () => {
            const el = document.querySelector('.sl-meme');
            if (!el) return;
            const r = el.getBoundingClientRect();
            const cx = r.left + 10, cy = r.top + 10;
            const ev = (type) => new PointerEvent(type, {
                bubbles: true, cancelable: true, composed: true,
                pointerId: 11, pointerType: 'touch', isPrimary: true, clientX: cx, clientY: cy,
            });
            el.dispatchEvent(ev('pointerdown'));
            await new Promise(r2 => setTimeout(r2, 80));
            el.dispatchEvent(ev('pointerup'));
        })()
    `);
    await sleep(300);
    const closed = await page.evaluate(`window.__slStore.getState().translation === null`);
    check('★ 单击一下关掉悬浮层', closed);

    section('长按卡片 → AI 翻译（只发这张卡）');
    await page.evaluate(`window.__slStore.setTranslateEngine('ai')`);
    const callsBefore = await page.evaluate(`window.__slCalls.length`);
    const chipRes = await longPress(page, '.sl-chip', { index: 0 });
    check('长按卡片派发成功', chipRes === 'ok', chipRes);
    await page.waitFor(`window.__slStore.getState().translation && !window.__slStore.getState().translation.loading`, { label: 'AI 翻译返回' });
    const trans2 = await page.evaluate(`JSON.stringify(window.__slStore.getState().translation)`);
    const t2 = JSON.parse(trans2);
    check('★ AI 翻译出来了', t2 && t2.kind === 'ai' && (t2.text || '').includes('AI译'), (t2?.text || '').slice(0, 40));
    const lastCall = await page.evaluate(`JSON.stringify(window.__slCalls[window.__slCalls.length - 1])`);
    const lc = JSON.parse(lastCall);
    check('★ 只发了这张卡的内容（没带世界观/历史）',
        lc.full.includes('breakfast') && !lc.full.includes('水平侧写') && !lc.full.includes('学习主题') && lc.full.length < 1200,
        `长度 ${lc.full.length}`);
    const callsAfter = await page.evaluate(`window.__slCalls.length`);
    check('只多了一次调用', callsAfter === callsBefore + 1, `${callsBefore} -> ${callsAfter}`);
    await page.evaluate(`window.__slStore.closeTranslation(); window.__slStore.setTranslateEngine('local')`);

    section('浸没维度写进提示词');
    // 默认 gradual：第 1 节 → 起步阶段
    const sys1 = await page.evaluate(`JSON.stringify((window.__slCalls.find(c => c.system.includes('语言模式的硬规矩')) || {}).system || '')`);
    const s1 = JSON.parse(sys1);
    check('★ gradual：提示词里有阶段描述', s1.includes('循序渐进') && s1.includes('第 1 节课'), s1.slice(0, 0) || '');
    // 切到 full，再上一轮课
    await page.evaluate(`window.__slStore.setTopicImmersion(window.__slStore.getState().topics[0].id, 'full')`);
    await sleep(200);
    await page.evaluate(`window.__slStore.sendMessage('I eat bread.')`);
    await page.waitFor(`window.__slStore.getState().loading.reply === false && window.__slStore.getState().messages.length >= 7`, { label: '第二轮回复' });
    const sysFull = await page.evaluate(`JSON.stringify(window.__slCalls[window.__slCalls.length - 1].system)`);
    const sf = JSON.parse(sysFull);
    check('★ full：提示词换成了全外文规矩', sf.includes('一个中文字都不要出现'), '');
    check('★ 设置持久化（topic.immersion=full）', await page.evaluate(`window.__slStore.getState().topics[0].immersion`) === 'full');

    section('「我的」页设置卡都在');
    await page.evaluate(`window.__slStore.setView(''); window.__slStore.setTab('me')`);
    await sleep(500);
    const meText = await page.evaluate(`document.querySelector('.sl-page')?.textContent || ''`);
    check('浸没维度卡在', meText.includes('老师说多少外文') && meText.includes('从头到尾外文'));
    check('翻译形态卡在', meText.includes('翻译怎么显示') && meText.includes('点开才显示'));
    check('长按翻译引擎卡在', meText.includes('长按翻译') && meText.includes('本地词典'));
    check('拆气泡开关在', meText.includes('把长回复拆成短气泡'));
    await page.screenshot('04-me-settings');

    section('控制台');
    const errs = await page.evaluate(`
        (() => 0)()
    `);
    check('全程没有 JS 报错', page.errors().length === 0, page.errors().slice(-3).join(' | '));
} finally {
    await close();
}
report();
