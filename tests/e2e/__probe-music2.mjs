/**
 * 音乐 App 功能链路体检（第二部分）：弹窗 / 歌单 / 搜索 / 歌词 / 一起听 / 分享。
 * 只走真实点击和真实 method 派发，不直接改 state。
 */
import { launch, openApp, callMethod, check, section, report, sleep } from './__probe-kit.mjs';

const SHELL = '.app-shell[data-app-id="music"]';

async function run() {
    const { page, close } = await launch({ port: 9412, prefix: 'mu2-probe' });

    try {
        await openApp(page, 'music', { settleMs: 1800 });

        section('添加歌曲');
        await callMethod(page, 'music', 'openAddSongModal', {}, { settleMs: 700 });
        check('添加歌曲弹窗打开', await page.exists(`${SHELL} [data-modal-box="add-song"]`));
        const filled = await page.evaluate(`
            (() => {
                const box = document.querySelector('${SHELL} [data-modal-box="add-song"]');
                if (!box) return false;
                const set = (k, v) => { const el = box.querySelector('[data-input="' + k + '"]'); if (el) { el.value = v; return true; } return false; };
                return set('add-song-url', 'https://example.com/a.mp3')
                    && set('add-song-title', '探针歌曲')
                    && set('add-song-artist', '探针歌手');
            })()
        `);
        check('表单字段都在', filled);
        await callMethod(page, 'music', 'submitAddSong', {}, { settleMs: 800 });
        const afterAdd = await page.evaluate(`
            (() => {
                const app = (window.__phoneAppsRef?.value || []).find(a => a.id === 'music');
                const songs = app?.state?.music?.songs || [];
                return { n: songs.length, has: songs.some(s => s.title === '探针歌曲'),
                         modalGone: !document.querySelector('${SHELL} [data-modal-box="add-song"]') };
            })()
        `);
        check('歌曲加进曲库了', afterAdd.has, `共 ${afterAdd.n} 首`);
        check('提交后弹窗关掉', afterAdd.modalGone);

        section('新建歌单');
        await callMethod(page, 'music', 'openCreatePlaylistModal', {}, { settleMs: 700 });
        check('新建歌单弹窗打开', await page.exists(`${SHELL} [data-modal-box="create-playlist"]`));
        await page.evaluate(`
            (() => {
                const box = document.querySelector('${SHELL} [data-modal-box="create-playlist"]');
                const el = box?.querySelector('[data-input="create-playlist-name"]');
                if (el) el.value = '探针歌单';
            })()
        `);
        await callMethod(page, 'music', 'submitCreatePlaylist', {}, { settleMs: 900 });
        const pls = await page.evaluate(`
            (() => {
                const app = (window.__phoneAppsRef?.value || []).find(a => a.id === 'music');
                const list = app?.state?.music?.playlists || [];
                return { n: list.length, has: list.some(p => p.name === '探针歌单'),
                         id: list.find(p => p.name === '探针歌单')?.id ?? null };
            })()
        `);
        check('歌单建出来了', pls.has, `共 ${pls.n} 张`);

        section('往歌单里加歌 → 打开歌单详情');
        const songId = await page.evaluate(`
            (() => {
                const app = (window.__phoneAppsRef?.value || []).find(a => a.id === 'music');
                return (app?.state?.music?.songs || [])[0]?.id ?? null;
            })()
        `);
        await callMethod(page, 'music', 'toggleSongInPlaylist', { playlistId: pls.id, songId }, { settleMs: 800 });
        const inPl = await page.evaluate(`
            (() => {
                const app = (window.__phoneAppsRef?.value || []).find(a => a.id === 'music');
                const p = (app?.state?.music?.playlists || []).find(p => String(p.id) === ${JSON.stringify(String(pls.id))});
                const ids = p?.songIds || p?.songs || [];
                return { n: ids.length, ids: ids.map(String) };
            })()
        `);
        check('歌进了歌单', inPl.n === 1, inPl.ids.join(','));

        await callMethod(page, 'music', 'openPlaylistPage', { playlistId: pls.id }, { settleMs: 900 });
        check('歌单详情打开', await page.exists(`${SHELL} .music-playlist-detail`));
        const plRows = await page.count(`${SHELL} .music-playlist-detail .music-song-item`);
        check('详情页里列出了这首歌', plRows === 1, `${plRows} 行`);
        await page.screenshot('01-playlist');

        section('歌单里播放全部');
        await callMethod(page, 'music', 'playAllInPlaylist', { playlistId: pls.id }, { settleMs: 1000 });
        const playing = await page.evaluate(`
            (() => {
                const app = (window.__phoneAppsRef?.value || []).find(a => a.id === 'music');
                const st = app?.state?.music || {};
                return { cur: st.currentSong?.title || '', playing: !!st.isPlaying };
            })()
        `);
        check('播放全部选中了第一首', !!playing.cur, playing.cur);

        section('从歌单移除');
        await callMethod(page, 'music', 'removeSongFromPlaylist', { playlistId: pls.id, songId }, { settleMs: 800 });
        const afterRemove = await page.evaluate(`
            (() => {
                const app = (window.__phoneAppsRef?.value || []).find(a => a.id === 'music');
                const p = (app?.state?.music?.playlists || []).find(p => String(p.id) === ${JSON.stringify(String(pls.id))});
                return (p?.songIds || p?.songs || []).length;
            })()
        `);
        check('移除生效', afterRemove === 0, String(afterRemove));

        section('搜索');
        await callMethod(page, 'music', 'openSearchResults', { query: '探针' }, { settleMs: 900 });
        const searchRows = await page.count(`${SHELL} .music-search-results .music-song-item`);
        check('搜到了刚加的歌', searchRows >= 1, `${searchRows} 条`);
        await callMethod(page, 'music', 'closePlayerPage', {}, { settleMs: 400 });

        section('播放模式');
        const modes = [];
        for (let i = 0; i < 4; i += 1) {
            modes.push(await page.evaluate(`
                (() => {
                    const app = (window.__phoneAppsRef?.value || []).find(a => a.id === 'music');
                    return app?.state?.music?.playMode || '';
                })()
            `));
            await callMethod(page, 'music', 'togglePlayMode', {}, { settleMs: 350 });
        }
        check('三种模式循环切换', new Set(modes).size === 3, modes.join(' → '));

        section('歌词编辑');
        await callMethod(page, 'music', 'openSongLyricsEditor', { songId }, { settleMs: 1000 });
        check('单曲歌词编辑器打开', await page.exists(`${SHELL} .music-song-lyrics-editor`));
        const lyricRows = await page.count(`${SHELL} .music-lyrics-visual-list > *`);
        check('可视化列表有行', lyricRows > 0, `${lyricRows} 行`);
        // 文本模式改一版 LRC 再保存
        const saved = await page.evaluate(`
            (() => {
                const ta = document.querySelector('${SHELL} .music-song-lyrics-editor textarea');
                if (!ta) return 'no-textarea';
                ta.value = '[00:01.00]探针第一句\\n[00:05.00]探针第二句';
                ta.dispatchEvent(new Event('input', { bubbles: true }));
                return 'ok';
            })()
        `);
        check('文本模式有 textarea', saved === 'ok', saved);
        await callMethod(page, 'music', 'saveSongLyrics', { songId }, { settleMs: 900 });
        const lyricsNow = await page.evaluate(`
            (() => {
                try {
                    const map = JSON.parse(localStorage.getItem('xiaoting::music-lyrics-v1') || '{}');
                    const arr = map[${JSON.stringify(String(songId))}] || map[${songId}] || [];
                    return { n: arr.length, first: arr[0]?.text || '' };
                } catch (e) { return { n: -1, first: String(e) }; }
            })()
        `);
        check('歌词保存进 localStorage', lyricsNow.n === 2, `${lyricsNow.n} 行 / ${lyricsNow.first}`);
        await callMethod(page, 'music', 'clearSongLyrics', { songId }, { settleMs: 600 });
        await callMethod(page, 'music', 'closePlayerPage', {}, { settleMs: 400 });

        section('一起听');
        await callMethod(page, 'music', 'switchTab', { tabId: 'listen-together' }, { settleMs: 1200 });
        const ltUi = await page.evaluate(`
            (() => {
                const shell = document.querySelector('${SHELL}');
                return {
                    page: !!shell?.querySelector('.listen-together-friend-item, .listen-together-empty'),
                    friends: shell?.querySelectorAll('.listen-together-friend-item').length || 0,
                };
            })()
        `);
        check('一起听页面渲染出来了', ltUi.page, `好友 ${ltUi.friends} 个`);
        await page.screenshot('02-listen-together');

        section('我的页面');
        await callMethod(page, 'music', 'switchTab', { tabId: 'me' }, { settleMs: 900 });
        const meLinks = await page.evaluate(`
            (() => {
                const shell = document.querySelector('${SHELL}');
                return [...(shell?.querySelectorAll('[data-app-action]') || [])]
                    .map(el => { try { return JSON.parse(el.getAttribute('data-app-action')).method; } catch (_) { return null; } })
                    .filter(Boolean);
            })()
        `);
        const app = await page.evaluate(`
            (() => {
                const a = (window.__phoneAppsRef?.value || []).find(x => x.id === 'music');
                return Object.keys(a?.methods || {});
            })()
        `);
        const missing = [...new Set(meLinks)].filter((m) => !app.includes(m));
        check('「我的」页所有按钮都有对应 method', missing.length === 0, missing.join(', '));

        section('全局：所有 data-app-action 指向的 method 都存在');
        const allMissing = new Set();
        for (const tab of ['home', 'listen-together', 'discover', 'me']) {
            await callMethod(page, 'music', 'switchTab', { tabId: tab }, { settleMs: 600 });
            const list = await page.evaluate(`
                (() => {
                    const shell = document.querySelector('${SHELL}');
                    return [...(shell?.querySelectorAll('[data-app-action]') || [])].map(el => {
                        try {
                            const a = JSON.parse(el.getAttribute('data-app-action'));
                            return a.action === 'appMethod' ? a.method : null;
                        } catch (_) { return null; }
                    }).filter(Boolean);
                })()
            `);
            list.forEach((m) => { if (!app.includes(m)) allMissing.add(`${tab}:${m}`); });
        }
        check('没有指向空 method 的按钮', allMissing.size === 0, [...allMissing].join(', '));

        section('控制台');
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
