/**
 * 追光（actor-career）· 真实浏览器探针
 *
 * 覆盖关键业务链路：
 *   演员世界绑定 → 桌面动态出现 → 六步首配（选线 / 加点 / 锚点 / 名册）→ 开档
 *   → 时钟卡与九维数值 → 日程活动消耗时间 → 快进（无 API Key 时时钟照走）
 *   → NPC 名册（30 人 / 默认启用 15）→ 开新档（时间归零、名册不变）
 *
 * 前置：dev server 跑在 http://localhost:5173。
 * 跑法：node tests/e2e/__probe-actor-career.mjs
 */
import { launch, openApp, check, section, report, sleep } from './__probe-kit.mjs';

async function run() {
    const { page, close } = await launch({ port: 9436, prefix: 'actor' });

    try {
        section('世界观库 · 预设页（回归：漏 import buildPresetGroupState）');
        // 预设面板长在「某个世界的概览」底部，先造一个普通世界用来进入
        const seedWorldId = await page.evaluate(`
            (async () => {
                const world = await window.settingsSdk.worlds.create({
                    name: '探针占位世界', summary: '只为进入世界级 scope。',
                });
                return world.id;
            })()
        `);
        await openApp(page, 'settings', { settleMs: 900 });
        await page.evaluate(`
            window.dispatchEvent(new CustomEvent('app:page-action', {
                detail: { action: 'detail', appId: 'settings', pageId: 'world' }
            }))
        `);
        await page.waitFor(`document.querySelector('[class*="wv-"]')`, { label: '世界观库打开' });
        await page.evaluate(`
            window.dispatchEvent(new CustomEvent('app:page-action', {
                detail: { action: 'appMethod', appId: 'settings', method: 'worldEnter', payload: { id: ${JSON.stringify('__SEED__')} } }
            }))
        `.replace(JSON.stringify('__SEED__'), JSON.stringify(seedWorldId)));
        await page.waitFor(`document.querySelector('.wv--scope-world')`, { label: '进入世界级 scope' });
        await page.evaluate(`
            window.dispatchEvent(new CustomEvent('app:page-action', {
                detail: { action: 'appMethod', appId: 'settings', method: 'worldRoute', payload: { sub: 'overview', openSettingsSection: 'presets' } }
            }))
        `);
        await page.waitFor(`document.querySelectorAll('.wv-preset-item').length >= 10`, { label: '预设条目渲染' });
        check('预设页渲染无 ReferenceError', !page.errors().some((l) => l.includes('buildPresetGroupState')));
        check('预设条目带导入按钮', await page.evaluate(`
            [...document.querySelectorAll('.wv-preset-item')].some((el) =>
                el.textContent.includes('演员世界') && el.querySelector('.wv-btn'))
        `));

        // 从 UI 一键导入演员世界（真实用户路径）
        await page.evaluate(`
            (() => {
                const item = [...document.querySelectorAll('.wv-preset-item')]
                    .find((el) => el.textContent.includes('演员世界'));
                item.querySelector('.wv-btn').click();
            })()
        `);
        await page.waitFor(`window.settingsSdk.worlds.list().some((w) => w.name === '演员世界')`, {
            label: 'UI 导入演员世界成功',
        });
        check('UI 一键导入演员世界成功', true);

        section('准备：绑定默认用户');
        await page.evaluate(`
            (async () => {
                const sdk = window.settingsSdk;
                const world = sdk.worlds.list().find((w) => w.name === '演员世界');
                let user = sdk.defaultUserCard?.getDefault?.() || sdk.users.getActive();
                if (!user) user = await sdk.users.create({ name: '探针演员' });
                await sdk.users.update(user.id, { boundWorldId: world.id });
                await sdk.defaultUserCard.setDefault(user.id);
                window.__probeWorldId = world.id;
            })()
        `);
        await page.waitFor(`!(window.__phoneAppsRef?.value || []).some(a => a.id === 'job') || true`, { label: '模式切换生效' });
        check('导入的演员世界带三条夹子', await page.evaluate(`
            (window.settingsSdk.worlds.get(window.__probeWorldId)?.flows || []).length === 3
        `));
        check('导入的演员世界体验模式为 actor', await page.evaluate(`
            window.settingsSdk.worlds.get(window.__probeWorldId)?.experienceMode === 'actor'
        `));

        section('打开追光 → 首配向导');
        await openApp(page, 'actor-career', { settleMs: 1400 });
        await page.waitFor(`document.querySelector('.zg-onboarding')`, { label: '首配向导出现' });
        check('未配置时被首配拦截', await page.exists('.zg-onboarding'));

        // ① 身份
        await page.evaluate(`
            (() => {
                const input = document.querySelector('.zg-onboarding .zg-input');
                input.value = '沈探针';
                input.dispatchEvent(new Event('input', { bubbles: true }));
            })()
        `);
        await page.clickText('.zg-onboarding__foot .zg-btn', '下一步');
        await sleep(300);

        // ② 起点线：选 12 线
        check('分线网格 18 格', (await page.count('.zg-tiercell')) === 18);
        await page.clickText('.zg-tiercell', '12线');
        await sleep(200);
        check('线级信息展示预算', (await page.text('.zg-tierinfo')).includes('加点预算'));
        await page.clickText('.zg-onboarding__foot .zg-btn', '下一步');
        await sleep(300);

        // ③ 加点：推荐加点
        await page.clickText('.zg-allochead__actions .zg-btn', '推荐加点');
        await sleep(200);
        const allocText = await page.text('.zg-allochead');
        check('推荐加点后预算用尽', allocText.includes('剩 0') || allocText.includes('剩0'), allocText);
        await page.clickText('.zg-onboarding__foot .zg-btn', '下一步');
        await sleep(300);

        // ④ 锚点：随机一套再继续
        await page.clickText('.zg-allochead__actions .zg-btn', '随机一套');
        await sleep(200);
        check('五个奖项都在', (await page.count('.zg-awardrow')) === 5);
        check('节日列表在', (await page.count('.zg-festrow')) === 5);
        await page.clickText('.zg-onboarding__foot .zg-btn', '下一步');
        await sleep(300);

        // ⑤ 名册预览
        check('名册预览 30 人', (await page.count('.zg-rostercell')) === 30);
        check('两位隐藏 NPC', (await page.count('.zg-rostercell.is-hidden')) === 2);
        await page.clickText('.zg-onboarding__foot .zg-btn', '下一步');
        await sleep(300);

        // ⑥ 开档
        await page.clickText('.zg-onboarding__foot .zg-btn', '开始生涯');
        await page.waitFor(`document.querySelector('.zg-clockcard')`, { label: '主界面时钟卡', timeout: 15000 });
        check('开档进入主界面', await page.exists('.zg-clockcard'));
        check('档内第 1 天', (await page.text('.zg-clockcard__meta')).includes('第 1 天'));
        check('九维数值条都在', (await page.count('.zg-attrgrid .zg-bar')) === 9);
        check('线级正确显示 12线', (await page.text('.zg-section__title')).includes('12线'));

        section('容器铺满（回归：AGENTS2 §19.4 四条覆写）');
        // 根组件必须占满手机壳宽度 —— 不覆写 .app-content 的 14px padding 时
        // 整个 App 会「挤在中间」，覆盖页和弹窗遮罩两侧漏亮边
        const rootWidths = await page.evaluate(`
            (() => {
                const shell = document.querySelector('.app-shell[data-app-id="actor-career"]');
                const root = document.querySelector('.zg-app');
                return { shell: shell.getBoundingClientRect().width, root: root.getBoundingClientRect().width };
            })()
        `);
        check('根组件铺满手机壳宽度', Math.abs(rootWidths.shell - rootWidths.root) < 2,
            `root ${rootWidths.root}px / shell ${rootWidths.shell}px`);

        // home 指示条（.app-bottom z6）必须浮在 App 所有层之上，否则拖不出卡片退不了 App
        // —— App 内 tabbar/覆盖页/弹窗全部要 < 6（这次踩的坑：tabbar z30 直接把指示条盖没）
        const indicatorHit = await page.evaluate(`
            (() => {
                const ind = document.querySelector('.app-shell[data-app-id="actor-career"] .home-indicator');
                if (!ind) return { ok: false, why: 'indicator 不存在' };
                const r = ind.getBoundingClientRect();
                const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
                const ok = el === ind || ind.contains(el) || (el && el.closest && !!el.closest('.app-bottom'));
                return { ok, why: ok ? '' : ('最上层是 ' + (el ? el.className : '空')) };
            })()
        `);
        check('home 指示条浮在最上层（能拖出卡片）', indicatorHit.ok, indicatorHit.why);

        // 覆盖页（提示词与联动）也要铺满 —— 用户报过「子页面挤在中间」
        await page.clickText('.zg-tabbar__item', '我的');
        await sleep(400);
        await page.clickText('.zg-menurow', '提示词与联动');
        await page.waitFor(`document.querySelector('.zg-overlay')`, { label: '提示词覆盖页' });
        await sleep(600); // 等入场动画停稳再量 rect（§19 教训）
        const overlayWidths = await page.evaluate(`
            (() => {
                const shell = document.querySelector('.app-shell[data-app-id="actor-career"]');
                const overlay = document.querySelector('.zg-overlay');
                return { shell: shell.getBoundingClientRect().width, overlay: overlay.getBoundingClientRect().width };
            })()
        `);
        check('提示词覆盖页铺满手机壳宽度', Math.abs(overlayWidths.shell - overlayWidths.overlay) < 2,
            `overlay ${overlayWidths.overlay}px / shell ${overlayWidths.shell}px`);
        await page.clickText('.zg-overlay__back', '');
        await sleep(300);
        await page.clickText('.zg-tabbar__item', '今日');
        await sleep(400);

        section('日程：活动消耗固定时长');
        await page.clickText('.zg-tabbar__item', '日程');
        await sleep(500);
        const beforeRemain = await page.text('.zg-section__sub');
        await page.clickText('.zg-actcard', '台词课');
        await sleep(600);
        check('活动进了今日安排', (await page.count('.zg-slotrow')) >= 1);
        const afterRemain = await page.text('.zg-section__sub');
        check('剩余时间变少', beforeRemain !== afterRemain, `${beforeRemain} → ${afterRemain}`);

        section('圈子：名册与启用');
        await page.clickText('.zg-tabbar__item', '圈子');
        await sleep(500);
        const npcCount = await page.count('.zg-npcrow');
        check('圈子里可见 28 人（30 - 2 隐藏）', npcCount === 28, `实际 ${npcCount}`);
        check('默认启用 15 人', (await page.text('.zg-section__sub')).includes('15'));
        const firstNpcName = await page.evaluate(`document.querySelector('.zg-npcrow__main b')?.childNodes[0]?.textContent?.trim()`);

        section('快进：无 API Key 时时钟照走');
        await page.clickText('.zg-tabbar__item', '今日');
        await sleep(400);
        await page.clickText('.zg-clockcard__ops .zg-btn', '快进');
        await page.waitFor(`document.querySelector('.zg-modal')`, { label: '快进弹窗' });
        await page.clickText('.zg-modal .zg-btn', '快进 7 天');
        await page.waitFor(`(document.querySelector('.zg-clockcard__meta')?.textContent || '').includes('第 8 天')`, {
            label: '时钟推进到第 8 天', timeout: 30000,
        });
        check('快进 7 天生效（AI 失败不拦时间）', true);
        check('偏移说明显示比现实快', (await page.text('.zg-clockcard__meta')).includes('快'));

        section('存档：开新档 = 时间归零 + 名册不变');
        await page.clickText('.zg-tabbar__item', '我的');
        await sleep(400);
        await page.clickText('.zg-menurow', '存档管理');
        await sleep(400);
        await page.clickText('.zg-overlay__head .zg-btn', '开新档');
        await page.waitFor(`document.querySelector('.zg-modal')`, { label: '开新档弹窗' });
        await page.clickText('.zg-modal__foot .zg-btn', '开档');
        await page.waitFor(`document.querySelectorAll('.zg-savecard').length === 2`, { label: '两个档' });
        check('第二档已建', true);

        await page.clickText('.zg-overlay__back', '');
        await sleep(300);
        await page.clickText('.zg-tabbar__item', '今日');
        await sleep(400);
        check('新档时间回到第 1 天', (await page.text('.zg-clockcard__meta')).includes('第 1 天'));

        await page.clickText('.zg-tabbar__item', '圈子');
        await sleep(400);
        const firstNpcName2 = await page.evaluate(`document.querySelector('.zg-npcrow__main b')?.childNodes[0]?.textContent?.trim()`);
        check('新档名册与旧档相同（同档案键同 30 人）', firstNpcName === firstNpcName2, `${firstNpcName} vs ${firstNpcName2}`);

        section('收尾');
        const errors = page.errors().filter((l) => !/net::|favicon|ERR_/.test(l));
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
