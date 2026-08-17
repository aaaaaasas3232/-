/**
 * 音乐 App 全量体检。
 *
 * 覆盖：预设歌曲只剩一首、灵动岛纯黑 + 不自动展开、收藏/播放按钮三处一致、
 *      四个 Tab 和各详情页能开、页面里没有 emoji、全屏背景。
 *
 * 用法：npm run dev 之后 node tests/e2e/__probe-music.mjs
 */
import { launch, openApp, callMethod, check, section, report, sleep } from './__probe-kit.mjs';

const SHELL = '.app-shell[data-app-id="music"]';

// 表情符号（不含 CJK、不含 ★ 这类排版符号；界面文案里出现就算违规）
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u;

async function visibleText(page, root = SHELL) {
    return page.evaluate(`
        (() => {
            const el = document.querySelector(${JSON.stringify(root)});
            if (!el) return '';
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            const out = [];
            let n;
            while ((n = walker.nextNode())) {
                const t = (n.nodeValue || '').trim();
                if (t) out.push(t);
            }
            return out.join(' | ');
        })()
    `);
}

async function run() {
    const { page, close } = await launch({ port: 9411, prefix: 'mu-probe' });

    try {
        section('打开音乐 App');
        await openApp(page, 'music', { settleMs: 1600 });
        check('shell 挂上了', await page.exists(SHELL));
        check('首页容器在', await page.exists(`${SHELL} .music-app-container`));
        await page.screenshot('01-home');

        section('预设歌曲');
        const songs = await page.evaluate(`
            (() => {
                const app = (window.__phoneAppsRef?.value || []).find(a => a.id === 'music');
                return (app?.state?.music?.songs || []).map(s => ({ id: s.id, title: s.title, url: !!s.url }));
            })()
        `);
        check('默认曲库是空的', songs.length === 0, songs.map(s => s.title).join(', ') || '(空)');

        section('列表按钮');
        const listBtns = await page.evaluate(`
            (() => {
                const like = document.querySelector(${JSON.stringify(SHELL)} + ' .music-like-btn');
                const play = document.querySelector(${JSON.stringify(SHELL)} + ' .music-play-toggle');
                return {
                    likeCls: like?.className || '',
                    likeSong: like?.getAttribute('data-song-id') || '',
                    playCls: play?.className || '',
                    playSong: play?.getAttribute('data-song-id') || '',
                };
            })()
        `);
        check('统一收藏按钮已渲染', listBtns.likeCls.includes('music-like-btn'), listBtns.likeCls);
        check('统一播放按钮已渲染', listBtns.playCls.includes('music-play-toggle'), listBtns.playCls);

        section('播放 → 灵动岛档位');
        await callMethod(page, 'music', 'playSong', { songId: songs[0]?.id }, { settleMs: 1400 });
        const island = await page.evaluate(`
            (() => {
                const el = document.querySelector('.dynamic-island');
                const st = window.myDynamicIsland?.getState?.() || {};
                const cs = el ? getComputedStyle(el) : null;
                return {
                    cls: el?.className || '',
                    size: st.size || '',
                    tpl: st.content?.islandTemplate || '',
                    bg: cs?.backgroundColor || '',
                    bgImage: cs?.backgroundImage || '',
                };
            })()
        `);
        check('岛是音乐岛', island.tpl === 'music', island.tpl);
        check('★ 开播只到 mini，不自动撑大', island.size === 'mini', island.size);
        check('★ 岛底纯黑', island.bg === 'rgb(0, 0, 0)', island.bg);
        check('★ 岛底没有渐变', island.bgImage === 'none' || !island.bgImage, island.bgImage);
        await page.screenshot('02-island-mini');

        section('切歌 / 暂停都不撑大');
        await callMethod(page, 'music', 'nextSong', {}, { settleMs: 900 });
        let size = await page.evaluate(`window.myDynamicIsland?.getState?.()?.size || ''`);
        check('切歌后还是 mini', size === 'mini', size);
        await callMethod(page, 'music', 'togglePlay', {}, { settleMs: 900 });
        size = await page.evaluate(`window.myDynamicIsland?.getState?.()?.size || ''`);
        check('暂停后还是 mini', size === 'mini', size);
        await callMethod(page, 'music', 'togglePlay', {}, { settleMs: 900 });
        size = await page.evaluate(`window.myDynamicIsland?.getState?.()?.size || ''`);
        check('恢复播放后还是 mini', size === 'mini', size);

        section('用户点岛才展开');
        await page.click('.dynamic-island');
        await sleep(600);
        size = await page.evaluate(`window.myDynamicIsland?.getState?.()?.size || ''`);
        check('点一下 → medium', size === 'medium', size);

        section('收藏状态三处一致');
        // 停在 medium：这一档岛上有心形，才验得到三处同步
        await callMethod(page, 'music', 'toggleLike', { songId: songs[0]?.id }, { settleMs: 800 });
        const likeSync = await page.evaluate(`
            (() => {
                const app = (window.__phoneAppsRef?.value || []).find(a => a.id === 'music');
                const liked = (app?.state?.music?.likedSongs || []).map(String);
                const listBtn = document.querySelector('.music-like-btn[data-song-id]');
                const islandBtn = document.querySelector('.island-template-action-btn');
                return {
                    stateLiked: liked,
                    listLiked: listBtn?.getAttribute('data-liked') || '',
                    islandExists: !!islandBtn,
                    islandLiked: islandBtn ? islandBtn.className.includes('is-liked') : null,
                    islandSize: window.myDynamicIsland?.getState?.()?.size || '',
                };
            })()
        `);
        check('state 记下了收藏', likeSync.stateLiked.length === 1, likeSync.stateLiked.join(','));
        check('列表心形变红', likeSync.listLiked === '1', likeSync.listLiked);
        check('岛上有心形按钮', likeSync.islandExists, `size=${likeSync.islandSize}`);
        check('★ 灵动岛心形也变红', likeSync.islandLiked === true, String(likeSync.islandLiked));
        check('★ 收藏不会把岛顶回 mini', likeSync.islandSize === 'medium', likeSync.islandSize);
        await page.screenshot('02b-island-medium');

        section('四个 Tab 都能开');
        for (const [tab, marker] of [
            ['home', '.music-app-container'],
            ['listen-together', '.music-app-container'],
            ['discover', '.music-app-container'],
            ['me', '.music-app-container'],
        ]) {
            await callMethod(page, 'music', 'switchTab', { tabId: tab }, { settleMs: 700 });
            const ok = await page.exists(`${SHELL} ${marker}`);
            check(`tab ${tab} 渲染出来了`, ok);
        }

        section('详情页');
        const details = [
            ['openPlayerPage', {}, '.music-player-full, .music-player-empty', 'player'],
            ['openLikedSongsPage', {}, '.music-liked-hero, .music-app-container', 'liked'],
            ['openRecentPlayPage', {}, '.music-app-container, .music-recent', 'recent'],
            ['openRankings', {}, '.music-app-container, .music-rank-list', 'rankings'],
            ['openRadio', {}, '.music-app-container', 'radio'],
            ['openPlaylists', {}, '.music-app-container', 'playlists'],
            ['openLyricsEditorPage', {}, '.music-app-container, .music-lyrics-editor', 'lyrics'],
        ];
        for (const [method, payload, marker, shot] of details) {
            await callMethod(page, 'music', method, payload, { settleMs: 900 });
            const ok = await page.exists(`${SHELL} ${marker}`);
            check(`${method} 打开了`, ok);
            // 详情页头部：framework 那条「返回 + 标题」和页面自绘顶栏不能同时出现
            const dup = await page.evaluate(`
                (() => {
                    const shell = document.querySelector(${JSON.stringify(SHELL)});
                    const fw = shell?.querySelector('.app-detail-header');
                    const fwVisible = fw ? getComputedStyle(fw).display !== 'none' : false;
                    const own = !!shell?.querySelector('.music-player-topbar, .music-detail-topbar');
                    return { fwVisible, own };
                })()
            `);
            if (dup.own) check(`${method} 没有两条返回栏`, !dup.fwVisible, `framework header ${dup.fwVisible ? '还在' : '已隐藏'}`);
            await page.screenshot(`10-${shot}`);
            await callMethod(page, 'music', 'closePlayerPage', {}, { settleMs: 300 });
        }

        section('emoji 检查');
        await callMethod(page, 'music', 'switchTab', { tabId: 'home' }, { settleMs: 600 });
        for (const tab of ['home', 'listen-together', 'discover', 'me']) {
            await callMethod(page, 'music', 'switchTab', { tabId: tab }, { settleMs: 600 });
            const txt = await visibleText(page);
            const hits = [...txt].filter((ch) => EMOJI_RE.test(ch));
            check(`${tab} 页没有 emoji`, hits.length === 0, hits.join(' '));
        }

        section('控制台');
        const errs = page.errors();
        check('没有 JS 报错', errs.length === 0, errs.slice(0, 3).join(' / '));

        await page.screenshot('03-final');
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
