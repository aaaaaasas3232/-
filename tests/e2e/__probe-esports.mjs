/**
 * 电竞双 App（声浪 esports-forum / 赛点 esports-game）· 真实浏览器探针
 *
 * 覆盖关键业务链路：
 *   电竞世界绑定 → 双 App 动态出现 → 声浪七步首配（项目/起点/加点/战队/锚点）→ 开档
 *   → 时钟卡与七维数值 → 布局回归（§19.4 铺满 + 指示条可点）→ 板块预置帖与楼层
 *   → 选手评分 → 小号注册 → 快进 7 天（无 API Key 时钟照走、NPC 赛程自动打）
 *   → 赛季积分榜有真实赛果 → 赛点读到生涯 → 打一轮排位（逐局翻开）
 *   → 巅峰分变化 + 战绩围观楼回流声浪 → 赛点布局回归
 *
 * 前置：dev server 跑在 http://localhost:5173。
 * 跑法：node tests/e2e/__probe-esports.mjs
 */
import { launch, openApp, check, section, report, sleep } from './__probe-kit.mjs';

async function run() {
    const { page, close } = await launch({
        port: 9437,
        prefix: 'es',
        url: process.env.PROBE_BASE || undefined,
        waitApps: false,   // 机器负载高时冷启动可能超过 kit 默认 20s，这里自己等
    });
    await page.waitFor('window.__phoneAppsRef && window.__phoneAppsRef.value.length > 0', {
        label: 'app 注册（长预算）', timeout: 150000,
    });
    await sleep(1600);

    try {
        section('准备：导入电竞世界 + 绑定默认用户');
        await page.evaluate(`
            (async () => {
                const sdk = window.settingsSdk;
                let world = sdk.worlds.list().find((w) => w.name === '电竞世界');
                if (!world) {
                    world = await sdk.worlds.create({
                        name: '电竞世界',
                        summary: '职业电竞行业，选手、战队、赛事为核心。',
                        experienceMode: 'esports',
                    });
                }
                let user = sdk.defaultUserCard?.getDefault?.() || sdk.users.getActive();
                if (!user) user = await sdk.users.create({ name: '探针选手' });
                await sdk.users.update(user.id, { boundWorldId: world.id });
                await sdk.defaultUserCard.setDefault(user.id);
                // 造一个绑定世界的 AI（好友页 / 双排邀请要用）
                if (!sdk.aiPersons.list().some((a) => a.name === '阿夜')) {
                    await sdk.aiPersons.create({ name: '阿夜', bio: '爱打游戏的 AI', boundWorldId: world.id });
                }
                window.__probeWorldId = world.id;
            })()
        `);
        check('电竞世界与默认用户就绪', await page.evaluate(`
            !!window.settingsSdk.worlds.get(window.__probeWorldId)
        `));

        section('打开声浪 → 七步首配');
        await openApp(page, 'esports-forum', { settleMs: 1400 });
        await page.waitFor(`document.querySelector('.ef-onboarding')`, { label: '首配向导出现' });
        check('未配置时被首配拦截', await page.exists('.ef-onboarding'));

        // ① 身份：填选手 ID
        await page.evaluate(`
            (() => {
                const input = document.querySelector('.ef-onboarding .ef-input');
                input.value = '野火';
                input.dispatchEvent(new Event('input', { bubbles: true }));
            })()
        `);
        await page.clickText('.ef-onboarding__foot .ef-btn', '下一步');
        await sleep(300);

        // ② 项目：三个模型都在，默认 moba
        check('三个游戏模型', (await page.count('.ef-modelcell')) === 3);
        check('位置表随模型给出', (await page.count('.ef-chip')) >= 5);
        await page.clickText('.ef-onboarding__foot .ef-btn', '下一步');
        await sleep(300);

        // ③ 起点：六档
        check('起点定位六档', (await page.count('.ef-tiercell')) === 6);
        await page.clickText('.ef-tiercell', '一队新秀');
        await sleep(200);
        check('起点信息展示预算', (await page.text('.ef-tierinfo')).includes('加点预算'));
        await page.clickText('.ef-onboarding__foot .ef-btn', '下一步');
        await sleep(300);

        // ④ 加点：按位置推荐
        await page.clickText('.ef-allochead__actions .ef-btn', '按位置推荐');
        await sleep(200);
        const allocText = await page.text('.ef-allochead');
        check('推荐加点在预算内', !allocText.includes('超了'), allocText);
        await page.clickText('.ef-onboarding__foot .ef-btn', '下一步');
        await sleep(300);

        // ⑤ 战队：17 支他队 + 队友预览
        check('17 支他队可改名', (await page.count('.ef-teamrow')) === 17);
        await page.clickText('.ef-allochead__actions .ef-btn', '全部随机');
        await sleep(200);
        check('队友与教练预览', (await page.count('.ef-rostercell')) >= 5);
        await page.clickText('.ef-onboarding__foot .ef-btn', '下一步');
        await sleep(300);

        // ⑥ 锚点：六项赛事 + 五个节日
        check('赛事锚点六项', (await page.count('.ef-awardrow')) === 6);
        check('节日锚点五项', (await page.count('.ef-festrow')) === 5);
        await page.clickText('.ef-allochead__actions .ef-btn', '随机一套');
        await sleep(200);
        await page.clickText('.ef-onboarding__foot .ef-btn', '下一步');
        await sleep(300);

        // ⑦ 开档
        await page.clickText('.ef-onboarding__foot .ef-btn', '开始生涯');
        await page.waitFor(`document.querySelector('.ef-clockcard')`, { label: '主界面时钟卡', timeout: 15000 });
        check('开档进入主界面', await page.exists('.ef-clockcard'));
        check('档内第 1 天', (await page.text('.ef-clockcard__day')).includes('第 1 天'));

        section('布局回归（AGENTS2 §19.4 四条覆写 + §20.2 两断言）');
        const rootWidths = await page.evaluate(`
            (() => {
                const shell = document.querySelector('.app-shell[data-app-id="esports-forum"]');
                const root = document.querySelector('.ef-app');
                return { shell: shell.getBoundingClientRect().width, root: root.getBoundingClientRect().width };
            })()
        `);
        check('声浪根组件铺满手机壳宽度', Math.abs(rootWidths.shell - rootWidths.root) < 2,
            `root ${rootWidths.root}px / shell ${rootWidths.shell}px`);

        const indicatorHit = await page.evaluate(`
            (() => {
                const ind = document.querySelector('.app-shell[data-app-id="esports-forum"] .home-indicator');
                if (!ind) return { ok: false, why: 'indicator 不存在' };
                const r = ind.getBoundingClientRect();
                const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
                const ok = el === ind || ind.contains(el) || (el && el.closest && !!el.closest('.app-bottom'));
                return { ok, why: ok ? '' : ('最上层是 ' + (el ? el.className : '空')) };
            })()
        `);
        check('home 指示条浮在最上层（能拖出卡片）', indicatorHit.ok, indicatorHit.why);

        section('我的：七维数值 + 覆盖页铺满');
        await page.clickText('.ef-tabbar__item', '我的');
        await sleep(400);
        check('数值条 9 根（七维+人气+精力）', (await page.count('.ef-section .ef-bar')) >= 9);
        check('生涯里有月薪', (await page.text('.ef-page')).includes('月薪'));
        await page.clickText('.ef-menurow', '身份与小号');
        await page.waitFor(`document.querySelector('.ef-overlay')`, { label: '身份覆盖页' });
        await sleep(600); // 等入场动画停稳再量 rect
        const overlayWidths = await page.evaluate(`
            (() => {
                const shell = document.querySelector('.app-shell[data-app-id="esports-forum"]');
                const overlay = document.querySelector('.ef-overlay');
                return { shell: shell.getBoundingClientRect().width, overlay: overlay.getBoundingClientRect().width };
            })()
        `);
        check('覆盖页铺满手机壳宽度', Math.abs(overlayWidths.shell - overlayWidths.overlay) < 2,
            `overlay ${overlayWidths.overlay}px / shell ${overlayWidths.shell}px`);
        check('主马甲已注册', (await page.count('.ef-identrow')) === 1);

        // 开个小号
        await page.clickText('.ef-overlay__head .ef-btn', '开小号');
        await page.waitFor(`document.querySelector('.ef-modal')`, { label: '开小号弹窗' });
        await page.evaluate(`
            (() => {
                const input = document.querySelector('.ef-modal .ef-input');
                input.value = '路灯下蹲着';
                input.dispatchEvent(new Event('input', { bubbles: true }));
            })()
        `);
        await page.clickText('.ef-modal__foot .ef-btn', '注册');
        await page.waitFor(`document.querySelectorAll('.ef-identrow').length === 2`, { label: '小号出现' });
        check('小号注册成功', true);
        await page.click('.ef-overlay__back');
        await sleep(400);

        section('板块：预置帖零 token + 楼层');
        await page.clickText('.ef-tabbar__item', '板块');
        await sleep(400);
        const boardCount = await page.count('.ef-boardrow');
        check('板块 = 总版 + 赛后 + 18 队', boardCount === 20, `实际 ${boardCount}`);
        await page.clickText('.ef-boardrow', '赛事总版');
        await page.waitFor(`document.querySelectorAll('.ef-post').length >= 3`, { label: '预置帖渲染' });
        check('总版有预置帖', true);
        await page.click('.ef-post');
        await page.waitFor(`document.querySelector('.ef-thread')`, { label: '帖子楼层打开' });
        await page.waitFor(`document.querySelectorAll('.ef-comment').length >= 1`, { label: '预置楼层渲染' });
        check('楼层评论确定性渲染', true);
        await page.click('.ef-overlay__back');
        await sleep(300);
        await page.click('.ef-overlay__back');
        await sleep(300);

        section('评分：粉丝均分 + 打分');
        await page.clickText('.ef-tabbar__item', '评分');
        await sleep(400);
        check('自己的均分卡在', await page.exists('.ef-myscore'));
        check('主队选手评分行', (await page.count('.ef-raterow')) >= 5);
        await page.click('.ef-ratedot', { index: 7 });
        await sleep(300);
        check('打分落点', (await page.count('.ef-ratedot.is-on')) >= 1);

        section('快进 7 天：时钟照走 + NPC 赛程自动打');
        await page.clickText('.ef-tabbar__item', '首页');
        await sleep(400);
        await page.clickText('.ef-clockcard__actions .ef-btn', '快进');
        await page.waitFor(`document.querySelector('.ef-modal')`, { label: '快进弹窗' });
        await page.clickText('.ef-modal .ef-btn', '快进 7 天');
        await page.waitFor(`(document.querySelector('.ef-clockcard__day')?.textContent || '').includes('第 8 天')`, {
            label: '时钟推进到第 8 天', timeout: 30000,
        });
        check('快进 7 天生效（AI 失败不拦时间）', true);

        await page.clickText('.ef-tabbar__item', '我的');
        await sleep(300);
        await page.clickText('.ef-menurow', '赛季详情');
        await page.waitFor(`document.querySelector('.ef-standings')`, { label: '积分榜' });
        const playedText = await page.evaluate(`
            [...document.querySelectorAll('.ef-standings__row')].filter((r) => !r.classList.contains('is-head'))
                .reduce((acc, r) => acc + Number(r.children[2]?.textContent || 0), 0)
        `);
        check('快进期间 NPC 比赛真的打了（积分榜有胜场）', playedText > 0, `总胜场 ${playedText}`);
        await page.click('.ef-overlay__back');
        await sleep(300);

        section('风险面板：概率透明');
        await page.clickText('.ef-tabbar__item', '我的');
        await sleep(300);
        await page.clickText('.ef-menurow', '风险面板');
        await page.waitFor(`document.querySelectorAll('.ef-riskrow').length >= 5`, { label: '风险行渲染' });
        check('风险面板给出概率分解', (await page.text('.ef-riskrow')).includes('%'));
        await page.click('.ef-overlay__back');
        await sleep(300);

        section('赛点：读到生涯 → 打一轮排位');
        await openApp(page, 'esports-game', { settleMs: 1600 });
        await page.waitFor(`document.querySelector('.eg-ratingcard')`, { label: '赛点大厅', timeout: 20000 });
        const ratingBefore = await page.evaluate(`Number(document.querySelector('.eg-ratingcard__main b')?.textContent || 0)`);
        check('巅峰分按起点档初始化', ratingBefore === 1800, `实际 ${ratingBefore}`);
        check('时钟跟声浪同一天', (await page.text('.eg-ratingcard__side')).includes('第 8 天'));

        const gameRootWidths = await page.evaluate(`
            (() => {
                const shell = document.querySelector('.app-shell[data-app-id="esports-game"]');
                const root = document.querySelector('.eg-app');
                return { shell: shell.getBoundingClientRect().width, root: root.getBoundingClientRect().width };
            })()
        `);
        check('赛点根组件铺满手机壳宽度', Math.abs(gameRootWidths.shell - gameRootWidths.root) < 2,
            `root ${gameRootWidths.root}px / shell ${gameRootWidths.shell}px`);
        const gameIndicator = await page.evaluate(`
            (() => {
                const ind = document.querySelector('.app-shell[data-app-id="esports-game"] .home-indicator');
                if (!ind) return { ok: false, why: 'indicator 不存在' };
                const r = ind.getBoundingClientRect();
                const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
                const ok = el === ind || ind.contains(el) || (el && el.closest && !!el.closest('.app-bottom'));
                return { ok, why: ok ? '' : ('最上层是 ' + (el ? el.className : '空')) };
            })()
        `);
        check('赛点 home 指示条浮在最上层', gameIndicator.ok, gameIndicator.why);

        // 默认 3 局单排，直接开
        await page.clickText('.ef-btn, .eg-btn', '开始匹配');
        await page.waitFor(`document.querySelector('.eg-overlay')`, { label: '场次揭示页', timeout: 25000 });
        check('排位后进入场次页', true);
        for (let i = 0; i < 3; i += 1) {
            const hasNext = await page.clickText('.eg-overlay .eg-btn', '翻开下一局');
            if (!hasNext) break;
            await sleep(350);
        }
        check('三局全部翻开', (await page.count('.eg-matchcard')) === 3);
        check('每局有 KDA 与巅峰分变化', (await page.text('.eg-matchcard__meta')).includes('/'));
        await page.click('.eg-overlay__back');
        await sleep(400);

        const ratingAfter = await page.evaluate(`Number(document.querySelector('.eg-ratingcard__main b')?.textContent || 0)`);
        check('巅峰分变了（打了就有账）', ratingAfter !== ratingBefore, `${ratingBefore} → ${ratingAfter}`);
        check('今日局数计入', (await page.text('.eg-ratingcard__side')).includes('3/'));

        section('战绩回流：声浪围观楼 + 群聊教练');
        await page.clickText('.eg-tabbar__item', '群聊');
        await sleep(500);
        check('教练每日安排在群里（零 token）', (await page.count('.eg-msg')) >= 1);

        await openApp(page, 'esports-forum', { settleMs: 1000 });
        await page.clickText('.ef-tabbar__item', '板块');
        await sleep(400);
        await page.clickText('.ef-boardrow', '赛事总版');
        await page.waitFor(`[...document.querySelectorAll('.ef-post')].some((p) => p.textContent.includes('围观'))`, {
            label: '战绩围观楼出现在总版',
        });
        check('排位战绩回流成论坛围观楼', true);

        section('收尾');
        const errors = page.errors().filter((l) => !/net::|favicon|ERR_|API|api/i.test(l));
        check('全程无 JS 报错', errors.length === 0, errors.slice(0, 3).join(' | '));
    } finally {
        await close();
    }
}

run().then(() => {
    process.exit(report() ? 0 : 1);
}).catch((err) => {
    console.error('探针失败：', err);
    report();
    process.exit(1);
});
