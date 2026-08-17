/**
 * music-app · index.js
 * 步骤 1 工厂:appConfig + 路由分发 + methods 占位
 *
 * 设计要点:
 *  - renderMode: 'template'(简单 v-html 即可)
 *  - pages: 4 个根 Tab + 10 个 detail
 *  - state: 拆 state.music.* 三段式持久化
 *  - methods: 全部用方法简写,框架注入 this
 *  - 数据持久化:localStorage 兜底,IndexedDB 在后续步骤引入
 */

import { escapeHtml } from '@/src/core/escape.js';
import {
    createInitialPlayerState,
    loadMusicSnapshot,
    saveMusicSnapshot,
    loadPlayMode,
    savePlayMode,
    loadLyricsMap,
    applyLyricsMap,
    loadLikedSongs,
    loadPlaylists,
    loadPlayHistory,
    loadListenTogetherSessions,
    persistPlaylists,
    savePlaylist,
    saveLikedSong,
    removeLikedSong,
    recordPlayHistory,
    loadPlayCounts,
    savePlayCounts,
    getPlaylistSongIds,
    setPlaylistSongIds,
    findPlaylist,
} from './state.js';
import { removedBuiltinSongIds } from './default-songs.js';
import { injectMusicStyles } from './styles-loader.js';
import { SVGIcons } from './icons.js';
import { renderMePage } from './pages/me-page.js';
import { renderHomePage } from './pages/home-page.js';
import { renderListenTogetherPage } from './pages/listen-together-page.js';
import { renderDiscoverPage } from './pages/discover-page.js';
import { renderPlayerPage } from './pages/player-page.js';
import { renderPlaylistDetailPage } from './pages/playlist-detail-page.js';
import { renderLikedPage } from './pages/liked-page.js';
import { renderRecentPlayPage } from './pages/recent-play-page.js';
import { renderSearchResultsPage } from './pages/search-results-page.js';
import {
    renderRankingsPage,
    renderRadioPage,
    renderFeaturedPlaylistsPage,
} from './pages/discover-detail-pages.js';
import { renderLyricsEditorPage } from './pages/lyrics-editor-page.js';
import { renderSongLyricsEditorPage, _renderVisualMode } from './pages/song-lyrics-editor-page.js';
import { applyThemeColor, extractColorFromImage } from './services/color-service.js';
import { startIdleTimer, clearIdleTimer } from './services/audio-service.js';
import { buildMusicIslandPayload } from './components/music-island.js';
import { nowPlayingWidget } from './widgets/now-playing-widget.js';
import { renderTabBar, moveTabIndicator, mountTabBarInteractions } from './components/tab-bar-effects.js';
import {
    renderAddSongModal,
    renderCreatePlaylistModal,
    renderEditPlaylistModal,
    renderSharePlaylistModal,
    renderShareSongModal,
    renderAddToPlaylistModal,
    renderPickSongsModal,
} from './components/modals.js';
import {
    initAudioService,
    playSong as audioPlaySong,
    pauseSong as audioPauseSong,
    togglePlay as audioTogglePlay,
    seekTo as audioSeekTo,
    seekToTime as audioSeekToTime,
    setCurrentSong,
    persistCurrentState,
    onAudioEvent,
} from './services/audio-service.js';
// dom-sync 是 sync DOM 工具,放在 audio-service 之外用,可直接 import(顶层已 resolve)
import * as syncAllPlayUiModule from './components/dom-sync.js';
import { getSongLyrics, setCustomLyrics, clearCustomLyrics, getCustomLyrics,
         parseLrcFile, toLrcText, shiftLyricsTime,
         shiftLyricsFrom } from './services/lyrics-service.js';
import { createActionAttr } from '@/src/core/actions.js';
import {
    startListenTogether,
    endListenTogether,
    getListenTogetherSessions,
    generateSessionId,
} from './services/listen-together-service.js';
import {
    listAiPersons,
    inviteAiListenTogether,
    getAiListenTogetherSongs,
    sharePlaylistToAi,
    shareSongToAi,
} from './services/ai-bridge.js';
import {
    bindListenTogetherState,
    formatListenDuration,
    findSongByTitle,
} from './services/listen-together-context.js';
import {
    sendSongShare,
    sendPlaylistShare,
    sendListenTogetherInvite,
    sendChatText,
} from './services/chat-bridge.js';
import { registerMusicAppPrompts } from './services/app-prompts.js';
import * as ltStats from './services/listen-together-stats.js';

// ============================================================================
// 模块顶层渲染函数 —— renderPage 只能 dispatch 到这里
// ============================================================================
// 所有 render 函数移到 ./pages/ 子目录
//   renderHomePage  → pages/home-page.js
//   renderListenTogetherPage → pages/listen-together-page.js
//   renderDiscoverPage → pages/discover-page.js
//   renderMePageReadonly → pages/me-page.js
//   renderPlayerPage → pages/player-page.js
//   renderPlaylistDetailPage → pages/playlist-detail-page.js
//   renderLikedPage → pages/liked-page.js
//   renderRecentPlayPage → pages/recent-play-page.js
//   renderSearchResultsPage → pages/search-results-page.js
//   renderLyricsEditorPage → pages/lyrics-editor-page.js

// ============================================================================
// App 工厂
// ============================================================================

export default function createMusicApp() {
    return {
        id: 'music',
        name: 'echooo',
        icon: '<svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" style="overflow:hidden;position:relative;"><defs><linearGradient id="pinkGradient1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#FFB6D9;stop-opacity:1" /><stop offset="100%" style="stop-color:#FFC2E2;stop-opacity:1" /></linearGradient><filter id="softShadow1"><feGaussianBlur in="SourceAlpha" stdDeviation="2"/><feOffset dx="0" dy="2" result="offsetblur"/><feFlood flood-color="#FF69B4" flood-opacity="0.2"/><feComposite in2="offsetblur" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect width="120" height="120" rx="28" fill="url(#pinkGradient1)"/><g transform="translate(15, -78) rotate(21)"><path d="M12 3v6.9c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V9h3V6h-5z" fill="white" opacity="0.95" filter="url(#softShadow1)" transform="scale(9)" /></g></svg>',
        iconBg: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',

        distribution: {
            requiresInstall: false,
            appStore: {
                subtitle: '让同一首歌多回响一会儿',
                category: '音乐',
                description:
                    '有些歌适合独自听，有些歌听到一半，会想起另一个人。\n\n'
                    + 'echooo 留着播放、收藏、歌单与听歌回顾。歌词可以逐行调整时间，也可以导入、导出 LRC；正在播放的封面、进度与控制会安静地停在灵动岛和桌面小组件里。\n\n'
                    + '想有人在场时，可以邀请一位 AI 一起听。歌曲与歌单也能分享给 AI，让这一次播放在之后的对话里还有回声。\n\n'
                    + '不邀请谁也没关系。音乐仍会按顺序、随机或循环，继续往下放。',
                accent: 'linear-gradient(145deg, #FFB6D9 0%, #FFC2E2 100%)',
            },
        },

        background: 'linear-gradient(180deg, #fff5f8 0%, #ffeef4 55%, #ffffff 100%)',
        statusBarColor: '#1a1a1a',
        homeIndicatorColor: 'rgba(0,0,0,0.4)',

        // ★ 全屏：让 .app-bottom 浮起来不占布局高度，App 背景一路铺到 shell 底边。
        //   不开这个的话，指示条那 40px 会被 app-bottom 占住，露出一条跟页面对不上的边，
        //   悬浮 tabbar 下面那块看着像是「另一层白底」。
        fullscreen: true,

        // ★ 顶栏由 music-header 自己绘制,framework topbar 隐藏
        topbar: {
            visible: false,
        },

        // ★ music 自己画动态 tab bar(framework 的 .app-nav 在这里禁用,不会两边打架)
        nav: { type: 'none' },
        pages: [
            { id: 'home', label: '首页', iconHtml: SVGIcons.home, nav: true },
            { id: 'listen-together', label: '一起听', iconHtml: SVGIcons.users, nav: true },
            { id: 'discover', label: '发现', iconHtml: SVGIcons.search, nav: true },
            { id: 'me', label: '我的', iconHtml: SVGIcons.user, nav: true },
            // detail 页
            { id: 'player', type: 'detail' },
            { id: 'playlist-detail', type: 'detail' },
            { id: 'liked', type: 'detail' },
            { id: 'recent-play', type: 'detail' },
            { id: 'lyrics-editor', type: 'detail' },
            { id: 'song-lyrics-editor', type: 'detail' },
            { id: 'search-results', type: 'detail' },
            { id: 'rankings', type: 'detail' },
            { id: 'radio', type: 'detail' },
            { id: 'featured-playlists', type: 'detail' },
        ],
        defaultRootPageId: 'home',

        // ★ 步骤 5:桌面 widget — 当前播放
        widgets: [nowPlayingWidget],

        // ★ v0.87 声明「我会在什么时候占用灵动岛」。
        //   灵动岛本身是运行时 API(toolkit.island.show),系统事先不知道会弹什么,
        //   所以要在这里声明一份,「我的 → 灵动岛与小组件」才画得出预览、用户才关得掉。
        //   id 发布后不要改 —— 用户的开关按它存盘。
        islandKinds: [
            {
                id: 'now-playing',
                label: '正在播放',
                desc: '封面、歌名、进度条和上一首/播放/下一首。点岛展开成大卡，长按收起。',
                when: '开始播放歌曲时出现，暂停满 60 秒自动收起',
                template: 'music',
                sizes: ['mini', 'medium', 'large'],
                previewPayload: {
                    title: '示例曲',
                    artist: '本地曲库',
                    cover: '',
                    isPlaying: true,
                    progress: 42,
                    currentTime: 78,
                    duration: 186,
                    song: { title: '示例曲', artist: '本地曲库', color: '#fb7299' },
                    lyrics: [
                        { time: 0, text: '第一句写在这里' },
                        { time: 3, text: '导入 LRC 就会对上时间' },
                        { time: 6, text: '没有歌词时这里是空的' },
                    ],
                },
                defaultActive: true,
            },
        ],

        // ★ 一次性通知的声明。islandKinds 管的是常驻岛，这里管「弹一下就没」的提示。
        //   以前这些提示是黑盒：用户被弹了不知道是什么、更关不掉；现在
        //   「我的 → 灵动岛与小组件」里能逐条看到说明、点「试一下」预览、单独关闭。
        //   id 对应各处 notify 调用里的 { kind: 'xxx' }，发布后不要改。
        notifyKinds: [
            {
                id: 'playback',
                label: '播放提示',
                desc: '切歌、播放模式、曲库为空这类跟播放动作直接相关的短提示。',
                when: '切换播放模式、点到不存在的歌、曲库里没歌可切时',
                type: 'info',
                title: '播放模式',
                message: '单曲循环',
            },
            {
                id: 'listen-together',
                label: '一起听',
                desc: '和 AI 一起听歌的邀请、开始、结束、断开。',
                when: '发出邀请、对方接受、会话结束或暂停超时断开时',
                type: 'success',
                title: '一起听开始',
                message: '与 小听',
            },
            {
                id: 'playlist',
                label: '歌单变更',
                desc: '新建、改名、删除歌单，以及往歌单里加歌、移除歌曲。',
                when: '每次歌单被改动之后',
                type: 'success',
                title: '已创建',
                message: '深夜电台',
            },
            {
                id: 'lyrics',
                label: '歌词编辑',
                desc: '歌词保存、导入 LRC、导出 LRC、恢复默认歌词的结果反馈。',
                when: '在歌词编辑器里保存 / 导入 / 导出 / 清除之后',
                type: 'success',
                title: '已保存',
                message: '45 行',
            },
            {
                id: 'share',
                label: '分享结果',
                desc: '把歌曲或歌单分享给 AI 之后的成功 / 失败反馈。',
                when: '点「分享给 AI」并完成发送之后',
                type: 'success',
                title: '已分享',
                message: '示例曲 已发到聊天和 Nook',
            },
            {
                id: 'general',
                label: '其他提示',
                desc: '搜索词为空、还没选好友这类操作校验提示。',
                when: '操作缺少必填项时',
                type: 'info',
                title: '请输入搜索词',
                message: '',
            },
        ],

        // detail 页标题
        detailContent: {
            'player': { title: '播放器', subtitle: '' },
            'playlist-detail': { title: '歌单', subtitle: '' },
            'liked': { title: '我喜欢的音乐', subtitle: '' },
            'recent-play': { title: '听歌回顾', subtitle: '' },
            'lyrics-editor': { title: '歌词编辑', subtitle: '' },
            'song-lyrics-editor': { title: '编辑歌词', subtitle: '' },
            'search-results': { title: '搜索结果', subtitle: '' },
            'rankings': { title: '排行榜', subtitle: '' },
            'radio': { title: '私人电台', subtitle: '' },
            'featured-playlists': { title: '精选歌单', subtitle: '' },
        },

        // 步骤 2：声明 4 张 IndexedDB 表
        stores: [
            { name: 'likedSongs', keyPath: 'songId' },
            { name: 'playlists', keyPath: 'id' },
            { name: 'playHistory', keyPath: 'id', autoIncrement: false },
            { name: 'listenTogetherSessions', keyPath: 'sessionId' },
        ],

        // 启动时初始化
        setup({ toolkit } = {}) {
            // 往 murmur「回复提示词」注册音乐组的 prompt。
            // 放 setup 不放 hydrate:hydrate 只在用户打开音乐 App 时才跑,
            // 而用户完全可能先进 murmur 看提示词 —— 那时折叠区就该已经有音乐组了。
            // 注册表是内存的,每次启动都要重来;用户改过的正文/开关在 IndexedDB 里,register 后自动合并。
            registerMusicAppPrompts(toolkit);

            const snap = loadMusicSnapshot();
            const lyricsMap = loadLyricsMap();
            const initial = createInitialPlayerState();
            if (snap) {
                // 已下架的内置歌曲从老快照里清掉，
                // 否则删了代码里的定义，用户那边照样列着点了不出声的歌。
                if (Array.isArray(snap.songs) && removedBuiltinSongIds.length) {
                    snap.songs = snap.songs.filter((s) => !removedBuiltinSongIds.includes(Number(s?.id)));
                    if (snap.currentSong && removedBuiltinSongIds.includes(Number(snap.currentSong.id))) {
                        snap.currentSong = null;
                    }
                    if (Array.isArray(snap.likedSongs)) {
                        snap.likedSongs = snap.likedSongs.filter((id) => !removedBuiltinSongIds.includes(Number(id)));
                    }
                    (snap.playlists || []).forEach((p) => {
                        const ids = getPlaylistSongIds(p).filter((id) => !removedBuiltinSongIds.includes(Number(id)));
                        setPlaylistSongIds(p, ids);
                    });
                }
                if (Array.isArray(snap.songs) && snap.songs.length) {
                    // 内置歌曲(defaultSongs)以代码为准:歌词缺失或 url 与代码不一致时都要刷新,
                    // 否则改了代码里的 url,localStorage 里的旧 url 仍会被读出来(播不出声)
                    for (const defaultSong of initial.songs) {
                        const idx = snap.songs.findIndex((s) => s.id === defaultSong.id);
                        const cached = idx >= 0 ? snap.songs[idx] : null;
                        const stale = !cached
                            || !cached.lyrics
                            || cached.lyrics.length < 20
                            || cached.url !== defaultSong.url;
                        if (!stale) continue;
                        if (idx >= 0) snap.songs[idx] = defaultSong;
                        else snap.songs.push(defaultSong);
                    }
                    initial.songs = applyLyricsMap(snap.songs, lyricsMap);
                }
                if (Array.isArray(snap.likedSongs)) initial.likedSongs = snap.likedSongs;
                if (Array.isArray(snap.playlists) && snap.playlists.length) {
                    initial.playlists = snap.playlists;
                }
                if (Array.isArray(snap.playHistory)) initial.playHistory = snap.playHistory;
                if (snap.currentSong) {
                    // 用 songs 里的最新版本(url/歌词可能已随代码更新)覆盖快照里的旧字段
                    const fresh = initial.songs.find((s) => s.id === snap.currentSong.id);
                    initial.currentSong = fresh ? { ...snap.currentSong, ...fresh } : snap.currentSong;
                    // ★ 不恢复上次的播放进度:每次打开都从 0s 开始
                    initial.currentTime = 0;
                    initial.progress = 0;
                    initial.isPlaying = false;
                    initial.duration = snap.duration || 180;
                }
                if (snap.listenTogether) {
                    initial.listenTogether = { ...initial.listenTogether, ...snap.listenTogether };
                }
            }
            initial.playMode = loadPlayMode();
            // 让 chat 侧的 prompt 注入能读到实时播放状态(注册时就绑,不等 hydrate)
            bindListenTogetherState(initial);
            return { 
                music: initial,
                _hydrated: false,
                _hydrating: false,
            };
        },

        // ===== methods:全部用方法简写(framework 注入 this) =====
        // 步骤 1:全部为空实现,但 framework 派发链路打通
        methods: {
            // ===== async hydrate:IndexedDB 数据覆盖到 state.music.* =====
            async hydrate() {
                this.app.state._hydrating = true;
                injectMusicStyles();
                const state = this.app.state.music;
                if (!state) {
                    this.app.state._hydrating = false;
                    return;
                }

                // 步骤 3:初始化 audio-service(必须在 hydrate 里跑,因为需要 app.state.music)
                // ★ v0.83:注册歌曲结束回调 → 自动播放下一首(prototype playNextSong 行为)
                try {
                    initAudioService(state, {
                        onSongEnded: () => {
                            try {
                                this.nextSong();
                            } catch (err) {
                                console.warn('[music] nextSong after end failed', err);
                            }
                        },
                    });
                } catch (err) {
                    console.warn('[music] initAudioService failed', err);
                }
                // 监听 audio 事件 → 写 playHistory + 持久化
                try {
                    onAudioEvent((eventName, payload) => {
                        // ★ 播放状态真正落地时同步岛/播放页的按钮图标与波形
                        if (eventName === 'play' || eventName === 'pause') {
                            try { syncAllPlayUiModule.syncAllPlayUi(state); } catch (_) { /* noop */ }
                        }
                        // ★ 闲置收岛计时器只认音频真实状态(对齐原型:play → reset,pause → start)。
                        //   之前挂在 pauseSong/_doTogglePlay 上,一旦有别的路径改变播放状态
                        //   (切歌、模拟播放降级、岛上按钮)计时器就会和实际状态脱节,
                        //   表现为"明明在放,一分钟后岛自己没了"。
                        if (eventName === 'play') {
                            clearIdleTimer();
                        } else if (eventName === 'pause' || eventName === 'ended') {
                            this._startIslandIdleTimer();
                        }
                        if (eventName === 'play' && state.currentSong) {
                            // 异步写历史(不阻塞 UI)
                            try {
                                void recordPlayHistory(this.app, {
                                    songId: state.currentSong.id,
                                    title: state.currentSong.title,
                                    artist: state.currentSong.artist,
                                });
                            } catch (_) { /* noop */ }
                            try { this._bumpPlayCount(state.currentSong.id); } catch (_) { /* noop */ }
                            persistCurrentState();
                        } else if (eventName === 'pause' || eventName === 'loadedmetadata') {
                            persistCurrentState();
                        } else if (eventName === 'timeupdate') {
                            // throttle:每 5 秒持久化一次
                            if (!this._lastPersist || Date.now() - this._lastPersist > 5000) {
                                persistCurrentState();
                                this._lastPersist = Date.now();
                            }
                        }
                    });
                } catch (err) {
                    console.warn('[music] onAudioEvent failed', err);
                }

                // 步骤 2:从 IndexedDB 加载 likedSongs / playlists / playHistory
                try {
                    const [liked, playlists, history, ltSessions] = await Promise.all([
                        loadLikedSongs(this.app),
                        loadPlaylists(this.app),
                        loadPlayHistory(this.app),
                        loadListenTogetherSessions(this.app),
                    ]);

                    // 已下架的内置歌曲在 IndexedDB 侧也要滤掉，不然收藏页/歌单/回顾里
                    // 还会列着两首点了没反应的歌
                    const isGone = (id) => removedBuiltinSongIds.includes(Number(id));
                    if (Array.isArray(liked) && liked.length > 0) {
                        state.likedSongs = liked
                            .map((r) => Number(r.songId))
                            .filter((id) => id && !isGone(id));
                    }
                    if (Array.isArray(playlists) && playlists.length > 0) {
                        playlists.forEach((p) => {
                            setPlaylistSongIds(p, getPlaylistSongIds(p).filter((id) => !isGone(id)));
                        });
                        state.playlists = playlists;
                    }
                    if (Array.isArray(history) && history.length > 0) {
                        state.playHistory = history.filter((h) => !isGone(h?.songId));
                    }
                    // 一起听：历史列表 + 恢复未结束的会话
                    if (Array.isArray(ltSessions) && ltSessions.length > 0) {
                        state.listenTogetherSessions = [...ltSessions]
                            .sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
                        const activeSession = state.listenTogetherSessions.find((s) => s?.active);
                        if (activeSession) {
                            state.listenTogether = {
                                ...state.listenTogether,
                                ...activeSession,
                                songsPlayed: Number(activeSession.songCount) || 0,
                                invitePending: false,
                            };
                            // 恢复未结束的会话:结算游标从「现在」起算。
                            // 不能从 startTime 起算 —— 中间关页面的那段时间没人在听。
                            try { ltStats.beginSession(activeSession.aiId, Date.now()); } catch (_) { /* noop */ }
                        }
                    }
                } catch (err) {
                    console.warn('[music] hydrate IndexedDB load failed', err);
                }

                // 播放次数回填到曲库（排行榜 / 「听过 N 次」都读 song.playCount）
                try {
                    const counts = loadPlayCounts();
                    (state.songs || []).forEach((s) => {
                        s.playCount = Number(counts[String(s.id)]?.count) || 0;
                    });
                    if (state.currentSong) {
                        state.currentSong.playCount = Number(counts[String(state.currentSong.id)]?.count) || 0;
                    }
                } catch (_) { /* noop */ }

                // 同步到 localStorage 兜底
                try {
                    saveMusicSnapshot(state);
                } catch (_) { /* noop */ }

                // 步骤 4:进度条点击监听(全局一次,处理 [data-progress-bar] click 坐标)
                this._setupProgressBarListener();

                // 步骤 4:当前歌曲如果有 cover,异步提取主题色 → 应用 CSS var
                this._maybeExtractThemeColor();

                // 搜索框回车监听
                this._setupSearchInputListener();

                // 步骤 7:歌词编辑模式切换监听
                this._setupLyricsEditorModeSwitch();

                // 步骤 8:一起听 AI 列表异步填充
                this._setupListenTogetherAiList();

                // 一起听:秒表 + prompt 上下文推送
                this._setupListenTogetherTicker();

                // 灵动岛看门狗:播放中岛被别人顶掉且没人还回来时,自己挂回去
                this._setupIslandWatchdog();

                // 后台回前台时把岛收回 mini
                this._setupIslandVisibilityGuard();

                // AI 侧「[一起听:歌名]」等动作回流
                this._setupChatBridge();

                // 步骤 9:tab bar 指示器 + 一起听动态填充
                this._setupTabIndicatorObserver();
            },

            /**
             * 进度条点击:根据 click x 坐标计算 percentage,调 methods.seekTo
             */
            _setupProgressBarListener() {
                if (this._progressBarBound) return;
                this._progressBarBound = true;
                const handler = (e) => {
                    const target = e.target.closest('[data-progress-bar="1"]');
                    if (!target) return;
                    const rect = target.getBoundingClientRect();
                    // ★ v0.83:audio-service.seekTo 现在接受 0~100 百分比
                    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    const pct = ratio * 100;
                    // stopPropagation 防止触发 framework click 委托(data-app-action)
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                        if (typeof this.seekTo === 'function') {
                            this.seekTo({ percentage: pct });
                        } else if (typeof this.app?.methods?.seekTo === 'function') {
                            this.app.methods.seekTo.call(this, { percentage: pct });
                        }
                    } catch (err) {
                        console.warn('[music] 进度条 seek 失败', err);
                    }
                };
                // capture: true 抢在 framework 顶层 click 委托之前
                document.addEventListener('click', handler, true);
            },

            /**
             * 搜索框回车 → 跳搜索结果页。
             * framework 只代理 click，键盘事件得自己挂。
             */
            _setupSearchInputListener() {
                if (this._searchInputBound) return;
                this._searchInputBound = true;
                document.addEventListener('keydown', (e) => {
                    if (e.key !== 'Enter') return;
                    const input = e.target?.closest?.('[data-search-input="1"]');
                    if (!input) return;
                    if (!input.closest('.app-shell[data-app-id="music"]')) return;
                    e.preventDefault();
                    const query = (input.value || '').trim();
                    if (!query) return;
                    this.openSearchResults({ query });
                }, true);
            },

            /**
             * 歌词编辑器模式切换:[data-mode-switch] 内的 [data-mode] 按钮
             * 切换 visual/text 两个 panel
             */
            _setupLyricsEditorModeSwitch() {
                if (this._lyricsModeBound) return;
                this._lyricsModeBound = true;
                const handler = (e) => {
                    const btn = e.target.closest('[data-mode-switch] [data-mode]');
                    if (!btn) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const mode = btn.getAttribute('data-mode');
                    const switchEl = btn.closest('[data-mode-switch]');
                    if (!switchEl) return;
                    switchEl.querySelectorAll('[data-mode]').forEach((b) => {
                        if (b === btn) b.classList.add('is-active');
                        else b.classList.remove('is-active');
                    });
                    const container = switchEl.parentElement;
                    if (!container) return;
                    container.querySelectorAll('.music-lyrics-mode-panel').forEach((p) => {
                        p.classList.remove('is-active');
                    });
                    const target = container.querySelector(`.music-lyrics-mode-${mode}`);
                    if (target) target.classList.add('is-active');
                };
                document.addEventListener('click', handler, true);
            },

            /**
             * 一起听 AI 列表异步填充:检测 [data-ai-list] 元素,从 settingsSdk 拉 AI 列表并 patch
             * 步骤 8 实现
             */
            _setupListenTogetherAiList() {
                if (this._listenTogetherAiBound) return;
                this._listenTogetherAiBound = true;

                const tryFill = async () => {
                    try {
                        const shell = document.querySelector('.app-shell[data-app-id="music"]');
                        if (!shell) return false;
                    const placeholder = shell.querySelector('[data-ai-list="1"]');
                    if (!placeholder) return false;
                    // 已填充且一起听状态没变就不重画（状态变了要更新在线点/波形）
                    const ltNow = this.app?.state?.music?.listenTogether || {};
                    const signature = `${ltNow.active ? 1 : 0}:${ltNow.aiId || ''}`;
                    if (placeholder.getAttribute('data-filled') === signature) return true;

                    const list = await listAiPersons();
                    const safeList = Array.isArray(list) ? list : [];
                    if (safeList.length === 0) {
                        placeholder.innerHTML = `
                            <div class="listen-together-empty">
                                <div class="listen-together-empty-icon">${SVGIcons.headphones}</div>
                                <div class="listen-together-empty-title">暂无好友</div>
                                <div class="listen-together-empty-desc">先去设置里创建一个 AI 人设吧</div>
                            </div>
                        `;
                        placeholder.setAttribute('data-filled', signature);
                        return true;
                    }
                    const appId = this.app.id;
                    const lt = this.app?.state?.music?.listenTogether || {};
                    // 对齐原型:已连接的好友显示在线点 + 波形,其余显示邀请图标
                    placeholder.innerHTML = safeList.map((ai) => {
                        const aiName = escapeHtml(ai.name || ai.displayName || 'AI');
                        const avatar = ai.avatar || ai.avatarCode || null;
                        const connected = !!(lt.active && lt.aiId === ai.id);
                        const action = JSON.stringify({
                            action: 'appMethod',
                            appId,
                            method: connected ? 'endListenTogetherWithConfirm' : 'inviteListenTogether',
                            payload: { aiId: ai.id, aiName: ai.name },
                        });
                        return `
                            <div class="listen-together-friend-item${connected ? ' connected' : ''}"
                                 data-ai-id="${escapeHtml(ai.id)}"
                                 data-app-action='${escapeHtml(action)}'>
                                <div class="listen-together-friend-avatar">
                                    ${avatar
                                        ? `<img src="${escapeHtml(avatar)}" alt="" onerror="this.style.display='none'" />`
                                        : `<div class="listen-together-friend-avatar-placeholder">${aiName.charAt(0)}</div>`
                                    }
                                    ${connected ? '<div class="listen-together-friend-online"></div>' : ''}
                                </div>
                                <div class="listen-together-friend-info">
                                    <div class="listen-together-friend-name">${aiName}</div>
                                    <div class="listen-together-friend-status">${connected ? '正在一起听...' : '点击邀请'}</div>
                                </div>
                                <div class="listen-together-friend-action">
                                    ${connected
                                        ? '<div class="listen-together-wave-indicator"><span></span><span></span><span></span></div>'
                                        : `<div class="listen-together-invite-icon">${SVGIcons.invite}</div>`
                                    }
                                </div>
                            </div>
                        `;
                    }).join('');
                    placeholder.setAttribute('data-filled', signature);
                    return true;
                    } catch (err) {
                        console.warn('[music] _setupListenTogetherAiList failed', err);
                        return false;
                    }
                };

                // 监听 DOM 变化(一起听 tab 切到时,framework 重画 → placeholder 出现 → 触发填充)
                const observer = new MutationObserver(() => {
                    if (this._ltAiPending) return;
                    this._ltAiPending = true;
                    setTimeout(() => {
                        this._ltAiPending = false;
                        tryFill();
                    }, 50);
                });
                const shell = document.querySelector('.app-shell[data-app-id="music"]');
                if (shell) {
                    observer.observe(shell, { childList: true, subtree: true });
                } else {
                    // 兜底:页面加载时 shell 还没 mount
                    document.addEventListener('DOMContentLoaded', () => {
                        const s = document.querySelector('.app-shell[data-app-id="music"]');
                        if (s) observer.observe(s, { childList: true, subtree: true });
                    });
                }
                // 立即试一次
                setTimeout(tryFill, 100);
            },

            /**
             * 步骤 9:tab bar 指示器 + 一起听动态填充
             *  思路:
             *   1. 启动时等 music shell 出现,挂载交互 + 定位 indicator
             *   2. 订阅 framework 的 app:rootpage-changed 事件,music tab 切换时精准重定位
             *   3. MutationObserver 作为兜底(监听 shell 子树变化,应对其他可能触发 re-render 的场景)
             *   4. resize 监听
             */
            _setupTabIndicatorObserver() {
                if (this._tabIndicatorBound) return;
                this._tabIndicatorBound = true;

                // 找 bar 并定位;tabIndex 不传时 auto-detect
                // 注意:这个函数被 MutationObserver 每次子树变化都会调,别在里面打日志
                const locate = (tabIndex) => {
                    const bar = document.querySelector('.app-shell[data-app-id="music"] .music-dynamic-tabbar');
                    if (!bar) return;
                    // 重新挂一次(防止 re-render 后 listener 丢失)
                    if (typeof tabIndex !== 'number') {
                        tabIndex = Number(bar.dataset.tab || 0);
                    }
                    mountTabBarInteractions(bar, tabIndex);
                    moveTabIndicator(bar, tabIndex);
                };

                // 启动时等 music 渲染好
                let retryCount = 0;
                const tryInit = () => {
                    const bar = document.querySelector('.app-shell[data-app-id="music"] .music-dynamic-tabbar');
                    if (bar) {
                        locate();
                    } else if (retryCount < 10) {
                        retryCount++;
                        setTimeout(tryInit, 150);
                    }
                };
                tryInit();

                // MutationObserver 兜底:监听 shell 子树变化
                const ensureObs = () => {
                    const shell = document.querySelector('.app-shell[data-app-id="music"]');
                    if (shell && !shell.__musicTabObs) {
                        shell.__musicTabObs = new MutationObserver(() => {
                            requestAnimationFrame(() => requestAnimationFrame(locate));
                        });
                        shell.__musicTabObs.observe(shell, { childList: true, subtree: true });
                    }
                    return !!shell;
                };
                if (!ensureObs()) {
                    const t = setInterval(() => { if (ensureObs()) clearInterval(t); }, 200);
                    setTimeout(() => clearInterval(t), 6000);
                }

                window.addEventListener('resize', () => locate());

                this.app.state._hydrating = false;
                this.app.state._hydrated = true;
            },

            /**
             * 当前播放歌曲的 cover URL → 异步提取主色 → 应用到播放器 DOM
             */
            async _maybeExtractThemeColor() {
                const state = this.app?.state?.music;
                if (!state) return;
                const song = state.currentSong;
                if (!song) return;
                let theme = song.color;
                // 优先用 cover 提取
                if (song.cover) {
                    try {
                        const extracted = await extractColorFromImage(song.cover);
                        if (extracted) theme = extracted;
                    } catch (_) { /* noop */ }
                }
                // 等下一帧确保 DOM 渲染完
                requestAnimationFrame(() => {
                    try {
                        const shell = document.querySelector('.app-shell[data-app-id="music"]');
                        const player = shell?.querySelector('.music-player-full');
                        if (player && theme) {
                            applyThemeColor(player, theme);
                        }
                    } catch (_) { /* noop */ }
                });
            },

            /** 通用:轻量级触发重渲染 */
            /**
             * 强制重画当前页面。
             *
             * ⚠️ 只调 bridge.syncNow 是**不够的**，这是「结束一起听要刷新页面才更新」
             *    那个 bug 的根因：
             *      · 音乐 App 是 renderMode: 'template'，framework 走的是 v-html + computed
             *        （use-app-navigation 的 currentPageView）；
             *      · 而 app-renderer-bridge 的 syncRenderer 在 template 模式下**几乎什么都不做**
             *        （只更新 lastMountedKey，真正的重画交给 Vue 响应式）；
             *      · 但 state.music 是普通对象、不是 Vue.reactive，改它不会触发 computed，
             *        computed 唯一能被驱动的依赖是 `detailRenderTick`。
             *    所以对 template 模式的 App，++detailRenderTick 才是重画开关，
             *    syncNow 只是给 hybrid/vue 的那半边用的。两个都调，谁都不落下。
             */
            _triggerRerender() {
                try {
                    // 有 async renderer 缓存时先作废，否则下面 ++tick 会命中旧 HTML
                    window.invalidateRendererCache?.('music', null);
                } catch (_) { /* noop */ }
                try {
                    if (window.__detailRenderTick) {
                        window.__detailRenderTick.value = (window.__detailRenderTick.value || 0) + 1;
                    }
                } catch (_) { /* noop */ }
                try {
                    if (typeof window.__appRendererBridge?.syncNow === 'function') {
                        window.__appRendererBridge.syncNow({ force: true });
                    }
                } catch (_) { /* noop */ }
            },

            /**
             * 决定这次挂岛用哪一档。
             *
             * 规则:「档位归用户所有」。播放、切歌、暂停、页面重新可见这些**系统动作**
             * 一律不许自己把岛撑大 —— 岛还在的话沿用它当前那一档,岛不在就从 mini 起。
             * 只有用户明确点了「显示灵动岛」按钮,或者在岛上自己点开,才会到 medium/large。
             */
            _resolveIslandSize(requested) {
                if (requested) return requested;
                try {
                    const s = this.toolkit?.island?.getState?.();
                    if (s && s.mode === 'info' && s.content?.islandTemplate === 'music' && s.size) {
                        return s.size;
                    }
                } catch (_) { /* noop */ }
                return 'mini';
            },

            /**
             * 统一构造 island payload 并显示。
             * ★ 关键:island-templates.js 的 bind() 把按钮绑到 payload.actions[name],
             *   payload 里不挂 actions 的话,岛上的播放/上一首/下一首/收藏全是死的。
             * 同时兜底补齐 currentSong.lyrics(从快照恢复时可能没有),否则大型岛显示"暂无歌词"。
             *
             * size 不传 = 自动档,见 _resolveIslandSize。
             */
            _showIsland(requestedSize) {
                const size = this._resolveIslandSize(requestedSize);
                const state = this.app?.state?.music;
                if (!state) return null;

                if (state.currentSong && !state.currentSong.lyrics?.length) {
                    const songInList = (state.songs || []).find((s) => s.id === state.currentSong.id);
                    state.currentSong.lyrics = getSongLyrics(songInList || state.currentSong);
                }

                const payload = buildMusicIslandPayload(state);
                if (!payload) return null;

                payload.actions = {
                    // ★ 岛上左右两个按钮 = 后退 10s / 快进 10s
                    'prev': () => this.seekBy({ seconds: -10 }),
                    'next': () => this.seekBy({ seconds: 10 }),
                    'toggle-play': () => this.togglePlay(),
                    'toggle-like': () => this.toggleLike({ songId: state.currentSong?.id }),
                };

                // ★ 每次岛模板重渲染(含降档)后,按当前真实状态校正播放图标/波形/进度,
                //   否则模板会一直沿用 show() 时那份可能已过期的快照。
                payload.onBound = () => {
                    try { syncAllPlayUiModule.syncAllPlayUi(this.app?.state?.music); } catch (_) { /* noop */ }
                };

                // 记住当前档位:被别的岛顶掉后自愈时按同一档挂回去
                this._islandSize = size;
                this._islandUserClosed = false;

                try {
                    this.toolkit?.island?.show?.(size, {
                        type: 'info',
                        // 对应 appConfig.islandKinds[0]。带上 kind 之后,
                        // 用户在「灵动岛与小组件」里把它关掉,这次 show 就会被直接拦下。
                        kind: 'now-playing',
                        islandTemplate: 'music',
                        payload,
                        title: payload.title,
                        maxSize: 'large',
                        // ★ 在别的 App 里点几下页面，只把岛收成 mini，不许点没。
                        //   正在放歌属于"活动还在继续"，收掉要么长按 mini，要么暂停满 60 秒。
                        minSize: 'mini',
                        onClosed: (info) => this._onIslandClosed(info),
                    });
                } catch (err) {
                    console.warn('[music] _showIsland failed', err);
                }

                // ★ audio.play() 是异步的:show 时 state.isPlaying 往往还是 false,
                //   岛会渲染成"暂停"图标 + 静止的波形。等岛 DOM 出来后再按最新状态回补一次,
                //   250ms 那次用于等 play 事件真正落地。
                try {
                    const resync = () => {
                        try { syncAllPlayUiModule.syncAllPlayUi(this.app?.state?.music); } catch (_) { /* noop */ }
                    };
                    requestAnimationFrame(() => requestAnimationFrame(resync));
                    setTimeout(resync, 250);
                    setTimeout(resync, 800);
                } catch (_) { /* noop */ }

                return payload;
            },

            // ---- 播放核心(步骤 3 + 步骤 4 部分实现) ----
            /** 播放歌曲(payload.songId) — 步骤 5 接灵动岛 */
            playSong(payload) {
                const state = this.app.state.music;
                if (!state) return;
                const songId = Number(payload?.songId);
                const song = Array.isArray(state.songs) ? state.songs.find((s) => s.id === songId) : null;
                if (!song) {
                    this.toolkit?.island?.notify?.('warning', '歌曲不存在', `id=${songId}`, { kind: 'playback' });
                    return;
                }
                // 设置 lyrics(优先自定义)
                const lyrics = getSongLyrics(song);
                const enrichedSong = { ...song, lyrics };
                // ★ 同步更新 state.currentSong(确保灵动岛能拿到 enriched lyrics)
                state.currentSong = enrichedSong;
                const ok = audioPlaySong(enrichedSong);
                if (ok) {
                    // ★ 这里不要 notify:通知会顶掉刚挂上的音乐岛,还会污染灵动岛恢复栈。
                    // 步骤 4:触发主题色提取
                    try { void this._maybeExtractThemeColor(); } catch (_) { /* noop */ }
                    // 挂岛用自动档:开播/切歌都不许自己撑成大岛,想看详情由用户点岛
                    this._showIsland();
                    // 播放中不启动闲置 timer(对齐 prototype:播放时岛常驻)
                    clearIdleTimer();
                    // 一起听进行中:本次切歌计入会话,并刷新给 AI 的上下文
                    this._noteListenTogetherSongChange(enrichedSong);
                }
                // ★ v0.83:立即 sync DOM(不等 _triggerRerender,避免进度条/按钮/歌词延迟)
                try { syncAllPlayUiModule.syncAllPlayUi(state); } catch (_) { /* noop */ }
                this._triggerRerender();
            },

            /** 暂停 — 步骤 5:保留岛,不 dismiss */
            pauseSong() {
                audioPauseSong();
                // 暂停不改档位(用户展开着就还展开着),只刷新岛内容
                // 60s 闲置计时器由 audio 的 pause 事件统一启动
                this._showIsland();
                // ★ v0.83:立即 sync play 按钮 icon
                try { syncAllPlayUiModule.syncAllPlayUi(this.app.state.music); } catch (_) { /* noop */ }
                this._triggerRerender();
            },

            /** 切换播放/暂停 — 步骤 5 接岛 toggle */
            togglePlay() {
                const appState = this.app.state;

                // hydrate 还没跑完就点了播放:等它完成再执行(带超时,避免死等)
                if (!appState._hydrated) {
                    if (!appState._hydrating && typeof this.hydrate === 'function') {
                        void this.hydrate();
                    }
                    const startedAt = Date.now();
                    const check = setInterval(() => {
                        if (appState._hydrated) {
                            clearInterval(check);
                            this._doTogglePlay();
                        } else if (Date.now() - startedAt > 5000) {
                            clearInterval(check);
                            console.warn('[music] hydrate 超时,直接尝试播放');
                            this._doTogglePlay();
                        }
                    }, 50);
                    return;
                }

                this._doTogglePlay();
            },

            /** 实际执行切换播放 */
            _doTogglePlay() {
                const state = this.app.state.music;
                const wasPlaying = state.isPlaying;

                // ★ v0.83 fix:如果没有当前歌曲，自动选择并播放第一首
                if (!state.currentSong && Array.isArray(state.songs) && state.songs.length > 0) {
                    this.playSong({ songId: state.songs[0].id });
                    return;
                }

                audioTogglePlay();
                try {
                    // 自动档:播/停都不改岛的大小,用户展开成什么样就是什么样
                    this._showIsland();
                    if (!wasPlaying) {
                        // 现在开始播放 → 岛常驻,清掉计时器
                        clearIdleTimer();
                    }
                    // 暂停分支不在这里起计时器:audio 的 pause 事件会统一起,
                    // 避免"方法调用"和"真实音频状态"两套计时逻辑打架。
                } catch (_) { /* noop */ }
                this._triggerRerender();
            },

            /**
             * 下一首(根据 playMode 决定)。
             * ★ v0.83 对齐 prototype playNextSong:
             *   - repeat:重播当前首
             *   - shuffle:随机选一首
             *   - 默认(列表循环):到尾时回到 0
             */
            nextSong() {
                const state = this.app.state.music;
                if (!state || !Array.isArray(state.songs) || state.songs.length === 0) return;
                const idx = state.songs.findIndex((s) => s.id === state.currentSong?.id);
                let nextIdx = 0;
                if (state.playMode === 'repeat') {
                    nextIdx = idx >= 0 ? idx : 0;
                } else if (state.playMode === 'shuffle') {
                    nextIdx = Math.floor(Math.random() * state.songs.length);
                } else {
                    // 列表循环:到尾时回 0
                    nextIdx = idx >= 0 ? (idx + 1) % state.songs.length : 0;
                }
                const next = state.songs[nextIdx];
                if (next) this.playSong({ songId: next.id });
                else {
                    audioPauseSong();
                    this._triggerRerender();
                }
            },

            /**
             * 上一首(prototype 行为:直接回到列表上一首,无 3 秒回溯)。
             */
            prevSong() {
                const state = this.app.state.music;
                if (!state || !Array.isArray(state.songs) || state.songs.length === 0) return;
                const idx = state.songs.findIndex((s) => s.id === state.currentSong?.id);
                if (idx > 0) {
                    const prev = state.songs[idx - 1];
                    if (prev) this.playSong({ songId: prev.id });
                } else if (idx === 0) {
                    // 第一首 → 重播当前
                    const cur = state.songs[0];
                    if (cur) this.playSong({ songId: cur.id });
                } else {
                    // 没找到当前歌 → 从头开始
                    audioSeekToTime(0);
                }
            },

            /**
             * 跳转到百分比位置。
             * ★ v0.83:支持 0~1(旧) 或 0~100(新)双格式;audio-service 会自动 clamp 0~100。
             */
            seekTo(payload) {
                let pct = Number(payload?.percentage);
                if (!Number.isFinite(pct)) return;
                if (pct > 0 && pct <= 1) {
                    // 兼容老调用:0~1 → 自动 ×100
                    pct = pct * 100;
                }
                pct = Math.max(0, Math.min(100, pct));
                audioSeekTo(pct);
                // ★ 立即 sync DOM,不等 _triggerRerender(因为 syncNow 异步,会让用户感觉卡顿)
                try {
                    const { syncAllPlayUi } = syncAllPlayUiModule;
                    syncAllPlayUi(this.app.state.music);
                } catch (_) { /* noop */ }
                // 同时保留 full rerender(其他字段也要刷新)
                this._triggerRerender();
            },

            /** 跳转到具体秒数 */
            seekToTime(payload) {
                const seconds = Number(payload?.seconds);
                if (Number.isFinite(seconds)) {
                    audioSeekToTime(seconds);
                    try {
                        const { syncAllPlayUi } = syncAllPlayUiModule;
                        syncAllPlayUi(this.app.state.music);
                    } catch (_) { /* noop */ }
                    this._triggerRerender();
                }
            },

            /**
             * 相对当前位置快进/后退(灵动岛左右两个按钮:-10s / +10s)
             */
            seekBy(payload) {
                const delta = Number(payload?.seconds);
                if (!Number.isFinite(delta)) return;
                const state = this.app?.state?.music;
                if (!state) return;
                const duration = Number.isFinite(state.duration) && state.duration > 0 ? state.duration : 180;
                const now = Number.isFinite(state.currentTime) ? state.currentTime : 0;
                const target = Math.max(0, Math.min(duration, now + delta));
                audioSeekToTime(target);
                try {
                    const { syncAllPlayUi } = syncAllPlayUiModule;
                    syncAllPlayUi(state);
                } catch (_) { /* noop */ }
                this._triggerRerender();
            },

            togglePlayMode() {
                const state = this.app.state.music;
                const order = ['list', 'repeat', 'shuffle'];
                const idx = order.indexOf(state.playMode);
                state.playMode = order[(idx + 1) % order.length];
                savePlayMode(state.playMode);
                this._triggerRerender();
                this.toolkit?.island?.notify?.('info', '播放模式', state.playMode, { kind: 'playback' });
            },

            // ---- 喜欢(步骤 3 完整实现) ----
            toggleLike(payload) {
                const state = this.app.state.music;
                if (!state) return;
                const songId = Number(payload?.songId);
                if (!songId) return;
                const likedSet = new Set(Array.isArray(state.likedSongs) ? state.likedSongs : []);
                if (likedSet.has(songId)) {
                    likedSet.delete(songId);
                    void removeLikedSong(this.app, songId);
                } else {
                    likedSet.add(songId);
                    void saveLikedSong(this.app, songId);
                }
                state.likedSongs = Array.from(likedSet);
                try { saveMusicSnapshot(state); } catch (_) { /* noop */ }
                // 三处心形立刻同步：列表行、播放器页、灵动岛。
                // 前两处直接改 DOM（不等重渲染），岛要重挂一次才能换 payload.liked。
                try { syncAllPlayUiModule.syncLikeButtons(state); } catch (_) { /* noop */ }
                try {
                    if (this._isIslandOwnedByMusic()) this._showIsland();
                } catch (_) { /* noop */ }
                this._triggerRerender();
            },

            // ---- 页面跳转(步骤 3 / 4 起完整实现) ----
            openPlayerPage(payload) {
                const songId = payload?.songId;
                const appInstance = this.app;
                
                // 同步触发 hydrate（不等待），让后续调用能用上
                if (!appInstance.state._hydrated && !appInstance.state._hydrating) {
                    if (appInstance.methods?.hydrate) {
                        // 触发 hydrate但不等待，让它在后台完成
                        appInstance.methods.hydrate.call(appInstance);
                    }
                }
                
                // 设置当前歌曲（如果已有数据）
                if (songId && appInstance.state._hydrated) {
                    const state = appInstance.state.music;
                    const song = state?.songs?.find(s => s.id === songId) || state?.songs?.[0];
                    if (song) {
                        setCurrentSong(song);
                    }
                }
                
                // 派发页面跳转事件
                try {
                    window.dispatchEvent(new CustomEvent('app:page-action', {
                        detail: { action: 'detail', appId: appInstance.id, pageId: 'player', payload: { songId } },
                    }));
                } catch (_) { /* noop */ }
            },
            openPlaylistPage(payload) {
                try {
                    window.dispatchEvent(new CustomEvent('app:page-action', {
                        detail: { action: 'detail', appId: this.app.id, pageId: 'playlist-detail', payload: { playlistId: payload?.playlistId || 0 } },
                    }));
                } catch (_) { /* noop */ }
            },
            openLikedSongsPage() {
                try {
                    window.dispatchEvent(new CustomEvent('app:page-action', {
                        detail: { action: 'detail', appId: this.app.id, pageId: 'liked' },
                    }));
                } catch (_) { /* noop */ }
            },
            openRecentPlayPage() {
                try {
                    window.dispatchEvent(new CustomEvent('app:page-action', {
                        detail: { action: 'detail', appId: this.app.id, pageId: 'recent-play' },
                    }));
                } catch (_) { /* noop */ }
            },
            openLyricsEditorPage() {
                try {
                    window.dispatchEvent(new CustomEvent('app:page-action', {
                        detail: { action: 'detail', appId: this.app.id, pageId: 'lyrics-editor' },
                    }));
                } catch (_) { /* noop */ }
            },
            openSearchResults(payload) {
                let query = (payload?.query || '').toString().trim();
                // 从 DOM 读取搜索框值(允许 button 派发不带 query)
                if (!query) {
                    try {
                        const shell = document.querySelector('.app-shell[data-app-id="music"]');
                        const input = shell?.querySelector('[data-search-input="1"]');
                        if (input) query = (input.value || '').trim();
                    } catch (_) { /* noop */ }
                }
                if (!query) {
                    this.toolkit?.island?.notify?.('info', '请输入搜索词', '', { kind: 'general' });
                    return;
                }
                try {
                    window.dispatchEvent(new CustomEvent('app:page-action', {
                        detail: { action: 'detail', appId: this.app.id, pageId: 'search-results', payload: { query } },
                    }));
                } catch (_) { /* noop */ }
            },
            // ---- 一起听(步骤 8 完整实现) ----
            async inviteListenTogether(payload) {
                const state = this.app.state.music;
                if (!state) return;
                const aiId = payload?.aiId;
                const aiName = payload?.aiName || 'AI';
                if (!aiId) {
                    this.toolkit?.island?.notify?.('warning', '请选择 AI', '', { kind: 'general' });
                    return;
                }
                if (state.listenTogether?.active && state.listenTogether.aiId === aiId) {
                    this.toolkit?.island?.notify?.('info', '已经在一起听了', '', { kind: 'listen-together' });
                    return;
                }

                const song = state.currentSong;
                // 1) 邀请 AI(写入 ai.boundResources.listenTogetherSongs)
                const inviteRes = await inviteAiListenTogether({
                    aiId,
                    songId: song?.id,
                    songTitle: song?.title,
                });
                if (!inviteRes.ok) {
                    this.toolkit?.island?.notify?.('error', '邀请失败', inviteRes.message, { kind: 'listen-together' });
                    return;
                }

                // 2) 往聊天里发一张邀请卡(对齐原型 sendListenTogetherInvite)
                state.listenTogether = { ...(state.listenTogether || {}), invitePending: true };
                this._triggerRerender();
                try {
                    await sendListenTogetherInvite({ aiId, song, sender: 'user' });
                } catch (_) { /* chat 没装也继续 */ }
                this.toolkit?.island?.notify?.('info', '已发送邀请', `等 ${aiName} 回应…`, { kind: 'listen-together' });

                // 3) 对齐原型:1~2 秒后 AI 接受,再正式开会话
                const delay = 1000 + Math.random() * 1000;
                setTimeout(() => {
                    void this._acceptListenTogether({ aiId, aiName });
                }, delay);
            },

            /** AI 接受邀请 → 正式开一起听会话 */
            async _acceptListenTogether(payload) {
                const state = this.app.state.music;
                if (!state) return;
                const aiId = payload?.aiId;
                const aiName = payload?.aiName || 'AI';
                if (!aiId) return;

                // AI 自己发起的一起听不需要再回一句"好呀"
                if (!payload?.silent) {
                    const acceptLines = ['好呀，一起听~', '来啦来啦！', '正好想听歌呢', '当然可以！', '好的，一起听吧'];
                    try {
                        await sendChatText({
                            aiId,
                            sender: 'ai',
                            text: acceptLines[Math.floor(Math.random() * acceptLines.length)],
                        });
                    } catch (_) { /* noop */ }
                }

                const sessionId = generateSessionId();
                const startTime = Date.now();
                await startListenTogether(this.app, {
                    sessionId,
                    aiId,
                    aiName,
                    startTime,
                    songCount: state.currentSong ? 1 : 0,
                });
                state.listenTogether = {
                    active: true,
                    sessionId,
                    aiId,
                    aiName,
                    startTime,
                    songsPlayed: state.currentSong ? 1 : 0,
                    invitePending: false,
                };
                // 累计账本开张（跨会话统计,给 AI 上下文用）
                ltStats.beginSession(aiId, startTime);
                if (state.currentSong) ltStats.noteSong(aiId, state.currentSong);
                try { saveMusicSnapshot(state); } catch (_) { /* noop */ }
                this._triggerRerender();
                this.toolkit?.island?.notify?.('success', '一起听开始', `与 ${aiName}`, { kind: 'listen-together' });
            },

            async startListenTogether(payload) {
                // 跟 inviteListenTogether 行为一致(无 aiId 时无效)
                return this.inviteListenTogether(payload);
            },

            async endListenTogetherWithConfirm() {
                const state = this.app.state.music;
                if (!state || !state.listenTogether?.active) return;
                const sessionId = state.listenTogether.sessionId;
                const confirm = window.__phoneConfirm?.request;
                if (typeof confirm === 'function') {
                    confirm({
                        title: '结束一起听',
                        text: `跟 ${state.listenTogether.aiName || 'AI'} 一起听了很久,要结束吗?`,
                        confirmLabel: '结束',
                        danger: false,
                        onConfirm: async () => {
                            await this._endListenTogetherInternal(sessionId);
                        },
                        onCancel() { /* noop */ },
                    });
                } else {
                    await this._endListenTogetherInternal(sessionId);
                }
            },

            async _endListenTogetherInternal(sessionId, opts = {}) {
                const state = this.app.state.music;
                if (!state) return;
                const lt = state.listenTogether || {};
                if (!lt.active) return;
                const duration = lt.startTime ? Date.now() - lt.startTime : 0;
                const songCount = Number(lt.songsPlayed) || 0;
                const aiId = lt.aiId;
                // 先收尾结算,再清 state —— 清完就拿不到 aiId 了
                ltStats.endSession(aiId);
                await endListenTogether(this.app, sessionId || lt.sessionId, {
                    endTime: Date.now(),
                    duration,
                    songCount,
                    summary: `与 ${lt.aiName || 'AI'} 一起听了 ${formatListenDuration(duration)}，共 ${songCount} 首`,
                });
                // 刷新 history
                const sessions = await getListenTogetherSessions(this.app);
                state.listenTogetherSessions = sessions;
                // 清除 active
                state.listenTogether = {
                    active: false,
                    sessionId: null,
                    aiId: null,
                    aiName: null,
                    startTime: null,
                    songsPlayed: 0,
                    invitePending: false,
                };
                try { saveMusicSnapshot(state); } catch (_) { /* noop */ }
                this._triggerRerender();

                if (opts.reason) {
                    this.toolkit?.island?.notify?.('info', '一起听已断开', opts.reason, { kind: 'listen-together' });
                    if (aiId) {
                        try {
                            void sendChatText({ aiId, sender: 'ai', text: '诶？音乐停了好久，那先不听啦～' });
                        } catch (_) { /* noop */ }
                    }
                } else {
                    this.toolkit?.island?.notify?.('info', '已结束一起听', formatListenDuration(duration), { kind: 'listen-together' });
                }
            },

            // 旧 method 保留(可能其他地方引用)
            endListenTogether() {
                return this.endListenTogetherWithConfirm();
            },

            async aiSwitchSong() {
                const state = this.app.state.music;
                if (!state || !state.listenTogether?.active) return;
                const aiId = state.listenTogether.aiId;
                if (!aiId) return;
                // 优先用 AI 手里"为一起听准备的歌",没有就从曲库随便挑一首不是当前这首的
                let songId = null;
                const bound = await getAiListenTogetherSongs(aiId);
                const pool = (Array.isArray(bound) ? bound : []).filter((id) => id !== state.currentSong?.id);
                if (pool.length > 0) {
                    songId = pool[Math.floor(Math.random() * pool.length)];
                } else {
                    const candidates = (state.songs || []).filter((s) => s.id !== state.currentSong?.id);
                    if (candidates.length === 0) {
                        this.toolkit?.island?.notify?.('info', '曲库里只有这一首歌', '', { kind: 'playback' });
                        return;
                    }
                    songId = candidates[Math.floor(Math.random() * candidates.length)].id;
                }
                this.playSong({ songId });
                const song = (state.songs || []).find((s) => s.id === songId);
                if (song) {
                    const lines = [
                        `换首《${song.title}》听听？`,
                        `我想听这首：${song.title} - ${song.artist}`,
                        `这首《${song.title}》给你听`,
                    ];
                    try {
                        await sendChatText({ aiId, sender: 'ai', text: lines[Math.floor(Math.random() * lines.length)] });
                    } catch (_) { /* noop */ }
                }
            },

            /**
             * 分享当前这首歌到 murmur。
             * 正在一起听 → 直接发给对方；否则弹出"分享给谁"。
             */
            async shareCurrentSong() {
                const state = this.app.state.music;
                const song = state?.currentSong;
                if (!song) {
                    this.toolkit?.island?.notify?.('info', '先选首歌', '', { kind: 'playback' });
                    return;
                }
                const aiId = state.listenTogether?.active ? state.listenTogether.aiId : null;
                if (aiId) {
                    await this._doShareSong(aiId, song);
                    this.toolkit?.island?.notify?.('success', '已分享', song.title || '', { kind: 'share' });
                    return;
                }
                let aiList = [];
                try { aiList = await listAiPersons(); } catch (_) { /* noop */ }
                this._mountModal(renderShareSongModal(this.app.id, song, aiList));
            },

            /**
             * 一次分享做两件事:
             *   1. 往 murmur 的会话里发一张「音乐分享卡」(不是一起听邀请卡)
             *   2. 写进 AI 的 Nook prompt,让它真的知道"用户跟我分享过这首歌"
             */
            async _doShareSong(aiId, song) {
                await sendSongShare({ aiId, song, sender: 'user' });
                try { await shareSongToAi({ aiId, song }); } catch (_) { /* noop */ }
            },

            /** 分享弹窗里选定了某个 AI */
            async submitShareSongToAi(payload) {
                const state = this.app?.state?.music;
                if (!state) return;
                const aiId = payload?.aiId;
                if (!aiId) return;
                const songId = payload?.songId != null ? Number(payload.songId) : null;
                const song = (state.songs || []).find((s) => s.id === songId) || state.currentSong;
                if (!song) {
                    this.toolkit?.island?.notify?.('warning', '找不到这首歌', '', { kind: 'general' });
                    return;
                }
                await this._doShareSong(aiId, song);
                this.closeModal();
                this.toolkit?.island?.notify?.('success', '已分享', `${song.title || ''} 已发到聊天和 Nook`, { kind: 'share' });
            },

            /** 一起听页头部的分享按钮 → 打开"分享歌单给 AI"弹窗 */
            sharePlaylist(payload) {
                return this.openSharePlaylistModal(payload || {});
            },

            // ---- 一起听会话的运行时记账 ----

            /** 切歌时累加本次会话的歌曲数（一起听结束时写进 summary） */
            _noteListenTogetherSongChange() {
                const state = this.app?.state?.music;
                const lt = state?.listenTogether;
                if (!lt?.active) return;
                lt.songsPlayed = (Number(lt.songsPlayed) || 0) + 1;
                // 累计账本也记一笔:哪首歌、跟这个 AI 一起听了第几次
                try { ltStats.noteSong(lt.aiId, state.currentSong); } catch (_) { /* noop */ }
                try { saveMusicSnapshot(state); } catch (_) { /* noop */ }
            },

            /**
             * 一起听秒表：每秒跑一次，做三件事
             *   1. 刷音乐 App 页面上的计时显示
             *   2. 给累计账本打结算点（内部限流 15 秒一次，防止关页面丢时长）
             *   3. 如果用户正开着 murmur 的「回复提示词」页，把「一起听（实时）」那张卡就地刷新
             *
             * 第 3 条不能靠整页重渲染 —— 每秒重画一次 prompt-manager 会卡死，
             * 而且会把用户展开的折叠区和滚动位置全冲掉。所以只改那一张卡的文本节点。
             */
            _setupListenTogetherTicker() {
                if (this._ltTickerBound) return;
                this._ltTickerBound = true;
                setInterval(() => {
                    try {
                        const lt = this.app?.state?.music?.listenTogether;
                        if (!lt?.active || !lt.startTime) return;

                        try { ltStats.checkpoint(lt.aiId); } catch (_) { /* noop */ }

                        const text = formatListenDuration(Date.now() - lt.startTime);
                        document
                            .querySelectorAll('.app-shell[data-app-id="music"] [data-lt-timer]')
                            .forEach((el) => { el.textContent = text; });

                        this._syncListenTogetherPromptCard();
                    } catch (_) { /* noop */ }
                }, 1000);
            },

            /**
             * 就地刷新 murmur 里那张「一起听（实时）」卡片的正文。
             * 卡片由 prompt-manager 用 window.__musicListenTogether.getContext() 渲染，
             * 这里重新算一次同样的文本写回 DOM，用户不用退出重进也能看到进度在走。
             */
            _syncListenTogetherPromptCard() {
                const card = document.querySelector('.prompt-manager [data-prompt-id="listen-together"]');
                if (!card) return;
                const body = card.querySelector('.pm-item-content');
                if (!body) return;
                const lt = this.app?.state?.music?.listenTogether;
                const text = window.__musicListenTogether?.getContext?.(lt?.aiId) || '';
                if (!text || body.textContent === text) return;
                body.textContent = text;
                const preview = card.querySelector('.pm-item-preview');
                if (preview) preview.textContent = text.slice(0, 120);
            },

            // ---- 从聊天卡片回流到音乐 App ----

            /** 聊天里点歌曲卡 → 播这首 */
            playSharedSong(payload) {
                const state = this.app?.state?.music;
                if (!state) return;
                let songId = payload?.songId != null ? Number(payload.songId) : null;
                if (!songId || !(state.songs || []).some((s) => s.id === songId)) {
                    const matched = findSongByTitle(payload?.title, payload?.artist);
                    songId = matched?.id || null;
                }
                if (!songId) {
                    this.toolkit?.island?.notify?.('warning', '曲库里没有这首歌', '', { kind: 'playback' });
                    return;
                }
                this.playSong({ songId });
                try {
                    window.dispatchEvent(new CustomEvent('app:page-action', {
                        detail: { action: 'openApp', appId: 'music', pageId: 'player', payload: { songId } },
                    }));
                } catch (_) { /* noop */ }
            },

            /** 聊天里点歌单卡 → 打开歌单详情 */
            openSharedPlaylist(payload) {
                const playlistId = payload?.playlistId;
                if (!playlistId) return;
                try {
                    window.dispatchEvent(new CustomEvent('app:page-action', {
                        detail: {
                            action: 'openApp',
                            appId: 'music',
                            pageId: 'playlist-detail',
                            payload: { playlistId },
                        },
                    }));
                } catch (_) { /* noop */ }
            },

            /** 聊天里点一起听邀请卡 → 打开一起听 Tab（AI 发起的邀请顺手接受） */
            async openListenTogetherFromChat(payload) {
                const state = this.app?.state?.music;
                const aiId = payload?.aiId;
                try {
                    window.dispatchEvent(new CustomEvent('app:page-action', {
                        detail: { action: 'openApp', appId: 'music', pageId: 'listen-together', payload: {} },
                    }));
                } catch (_) { /* noop */ }
                if (!aiId || !state) return;
                if (state.listenTogether?.active) return;
                if (payload?.songId) {
                    this.playSong({ songId: Number(payload.songId) });
                }
                const aiList = await listAiPersons();
                const ai = (aiList || []).find((a) => a.id === aiId);
                await this._acceptListenTogether({ aiId, aiName: ai?.name || ai?.displayName || 'AI' });
            },

            /**
             * AI 在聊天里输出 [一起听:歌名] 时由 chat 侧回调进来。
             * 找歌 → 播 → 开会话。
             */
            async acceptAiListenTogetherRequest(payload) {
                const state = this.app?.state?.music;
                if (!state) return;
                const aiId = payload?.aiId;
                if (!aiId) return;
                const matched = payload?.song ? findSongByTitle(payload.song, '') : null;
                const songId = matched?.id || state.currentSong?.id || state.songs?.[0]?.id;
                if (songId) this.playSong({ songId });
                if (!state.listenTogether?.active) {
                    const aiList = await listAiPersons();
                    const ai = (aiList || []).find((a) => a.id === aiId);
                    await this._acceptListenTogether({
                        aiId,
                        aiName: ai?.name || ai?.displayName || 'AI',
                        silent: true,
                    });
                }
            },

            /**
             * 监听 chat 侧派发的一起听请求（AI 用 [一起听:歌名] 发起）。
             */
            _setupChatBridge() {
                if (this._chatBridgeBound) return;
                this._chatBridgeBound = true;
                window.addEventListener('chat:listen-together-request', (e) => {
                    const detail = e?.detail || {};
                    void this.acceptAiListenTogetherRequest(detail);
                });
            },

            /** 累计播放次数（这首歌听过几次） */
            _bumpPlayCount(songId) {
                if (songId == null) return;
                const map = loadPlayCounts();
                const key = String(songId);
                const prev = map[key] || { count: 0, lastPlayedAt: 0 };
                map[key] = { count: (Number(prev.count) || 0) + 1, lastPlayedAt: Date.now() };
                savePlayCounts(map);
                const state = this.app?.state?.music;
                const song = (state?.songs || []).find((s) => s.id === songId);
                if (song) song.playCount = map[key].count;
                if (state?.currentSong?.id === songId) state.currentSong.playCount = map[key].count;
            },

            // ---- 步骤 4:关闭播放器(走 framework closeDetailPage) ----
            closePlayerPage() {
                try {
                    if (typeof window.__navigationForDebug?.closeDetailPage === 'function') {
                        window.__navigationForDebug.closeDetailPage();
                    } else if (this.app?._navigation?.closeDetailPage) {
                        this.app._navigation.closeDetailPage();
                    }
                } catch (_) { /* noop */ }
            },

            // ---- 步骤 6:清空听歌历史(走 framework 顶层确认弹窗) ----
            clearPlayHistoryWithConfirm() {
                const state = this.app.state.music;
                if (!state) return;
                if (!Array.isArray(state.playHistory) || state.playHistory.length === 0) {
                    this.toolkit?.island?.notify?.('info', '没有可清空的记录', '', { kind: 'general' });
                    return;
                }
                const confirmRequest = window.__phoneConfirm?.request;
                if (typeof confirmRequest === 'function') {
                    confirmRequest({
                        title: '清空听歌历史',
                        text: `确认清空全部 ${state.playHistory.length} 条记录?`,
                        confirmLabel: '清空',
                        danger: true,
                        onConfirm: async () => {
                            try {
                                const db = this.app?.toolkit?.db || window.myDb;
                                if (db && typeof db.clear === 'function') {
                                    await db.clear('playHistory');
                                }
                            } catch (_) { /* noop */ }
                            state.playHistory = [];
                            try { saveMusicSnapshot(state); } catch (_) { /* noop */ }
                            this._triggerRerender();
                            this.toolkit?.island?.notify?.('success', '已清空', '', { kind: 'general' });
                        },
                        onCancel() { /* noop */ },
                    });
                } else {
                    // fallback:直接清
                    state.playHistory = [];
                    try { saveMusicSnapshot(state); } catch (_) { /* noop */ }
                    this._triggerRerender();
                }
            },

            // ---- 步骤 6:歌单管理 ----

            /** 歌单增删改统一走这里，保证两个字段名和两层存储都写到 */
            async _writePlaylist(playlist, songIds) {
                const state = this.app.state.music;
                setPlaylistSongIds(playlist, songIds);
                try { await savePlaylist(this.app, playlist); } catch (_) { /* noop */ }
                try { saveMusicSnapshot(state); } catch (_) { /* noop */ }
                this._triggerRerender();
            },

            /** 歌单详情页「添加歌曲」→ 从曲库勾选（原型是勾选，之前退化成了 prompt 输 id） */
            openPickSongsModal(payload) {
                const state = this.app?.state?.music;
                if (!state) return;
                const playlist = findPlaylist(state.playlists, payload?.playlistId);
                if (!playlist) {
                    this.toolkit?.island?.notify?.('warning', '歌单不存在', '', { kind: 'playlist' });
                    return;
                }
                const inList = new Set(getPlaylistSongIds(playlist).map(String));
                const candidates = (state.songs || []).filter((s) => !inList.has(String(s.id)));
                this._mountModal(renderPickSongsModal(this.app.id, playlist, candidates));
            },

            async submitPickSongs(payload) {
                const state = this.app?.state?.music;
                if (!state) return;
                const playlist = findPlaylist(state.playlists, payload?.playlistId);
                if (!playlist) return;
                const shell = document.querySelector('.app-shell[data-app-id="music"]');
                const box = shell?.querySelector('[data-modal-box="pick-songs"]');
                if (!box) return;
                const picked = [...box.querySelectorAll('[data-pick-song]')]
                    .filter((el) => el.checked)
                    .map((el) => Number(el.getAttribute('data-pick-song')))
                    .filter(Boolean);
                if (picked.length === 0) {
                    this.toolkit?.island?.notify?.('info', '还没勾选歌曲', '', { kind: 'general' });
                    return;
                }
                const ids = getPlaylistSongIds(playlist);
                const merged = [...ids];
                picked.forEach((id) => { if (!merged.includes(id)) merged.push(id); });
                await this._writePlaylist(playlist, merged);
                this.closeModal();
                this.toolkit?.island?.notify?.('success', `已加入 ${picked.length} 首`, playlist.name, { kind: 'general' });
            },

            /** 播放器页「加入歌单」→ 多歌单勾选（对齐原型 showAddToPlaylistModal） */
            openAddToPlaylistModal(payload) {
                const state = this.app?.state?.music;
                if (!state) return;
                const songId = payload?.songId != null ? Number(payload.songId) : state.currentSong?.id;
                const song = (state.songs || []).find((s) => s.id === songId) || state.currentSong;
                if (!song) {
                    this.toolkit?.island?.notify?.('info', '先选首歌', '', { kind: 'playback' });
                    return;
                }
                this._mountModal(renderAddToPlaylistModal(
                    this.app.id,
                    song,
                    state.playlists || [],
                    (pl) => getPlaylistSongIds(pl).map(String).includes(String(song.id)),
                ));
            },

            /** 勾选/取消某张歌单（在「添加到歌单」弹窗里） */
            async toggleSongInPlaylist(payload) {
                const state = this.app?.state?.music;
                if (!state) return;
                const songId = Number(payload?.songId);
                const playlist = findPlaylist(state.playlists, payload?.playlistId);
                if (!playlist || !songId) return;
                const ids = getPlaylistSongIds(playlist);
                const has = ids.map(String).includes(String(songId));
                const next = has ? ids.filter((id) => String(id) !== String(songId)) : [...ids, songId];
                await this._writePlaylist(playlist, next);
                // 弹窗是手动挂的 DOM，rerender 不会重画它，这里就地更新勾选态
                try {
                    this._mountModal(renderAddToPlaylistModal(
                        this.app.id,
                        (state.songs || []).find((s) => s.id === songId) || state.currentSong,
                        state.playlists || [],
                        (pl) => getPlaylistSongIds(pl).map(String).includes(String(songId)),
                    ));
                } catch (_) { /* noop */ }
            },

            /** 歌单详情页「播放全部」 */
            playAllInPlaylist(payload) {
                const state = this.app?.state?.music;
                if (!state) return;
                const playlist = findPlaylist(state.playlists, payload?.playlistId);
                if (!playlist) return;
                const ids = getPlaylistSongIds(playlist);
                const first = ids.map((id) => (state.songs || []).find((s) => s.id === id)).find(Boolean);
                if (!first) {
                    this.toolkit?.island?.notify?.('info', '歌单还是空的', '', { kind: 'playlist' });
                    return;
                }
                this.playSong({ songId: first.id });
            },

            addSongToPlaylist(payload) {
                // 旧入口：直接开勾选弹窗
                return this.openPickSongsModal(payload);
            },

            async removeSongFromPlaylist(payload) {
                const state = this.app.state.music;
                if (!state) return;
                const songId = Number(payload?.songId);
                const playlist = findPlaylist(state.playlists, payload?.playlistId);
                if (!playlist) return;
                const next = getPlaylistSongIds(playlist).filter((id) => String(id) !== String(songId));
                await this._writePlaylist(playlist, next);
            },

            /** 兼容旧调用名:直接打开"分享给谁"的弹窗 */
            sharePlaylistToAI(payload) {
                return this.openSharePlaylistModal({ playlistId: payload?.playlistId });
            },

            // ---- 步骤 7:打开单曲歌词编辑器 ----
            openSongLyricsEditor(payload) {
                const songId = Number(payload?.songId);
                if (!songId) return;
                try {
                    window.dispatchEvent(new CustomEvent('app:page-action', {
                        detail: {
                            action: 'detail',
                            appId: this.app.id,
                            pageId: 'song-lyrics-editor',
                            payload: { songId },
                        },
                    }));
                } catch (_) { /* noop */ }
            },

            // 单行微调
            shiftSingleLyric(payload) {
                const state = this.app.state.music;
                if (!state) return;
                const songId = Number(payload?.songId);
                const idx = Number(payload?.idx);
                const delta = Number(payload?.delta);
                if (!songId || idx == null || !delta) return;
                let custom = getCustomLyrics(songId);
                if (!Array.isArray(custom) || custom.length === 0) {
                    const song = (state.songs || []).find((s) => s.id === songId);
                    if (!song) return;
                    custom = JSON.parse(JSON.stringify(song.lyrics || []));
                }
                const newLyrics = shiftLyricsTime(custom, idx, delta);
                setCustomLyrics(songId, newLyrics);
                this._triggerRerender();
                this.toolkit?.island?.notify?.('info', `微调 ${delta > 0 ? '+' : ''}${delta}s`, '', { kind: 'general' });
            },

            /**
             * 「此句后」:弹一个小菜单选偏移量，从这一句开始整体平移。
             * 对齐原型 batch-adjust-btn 的弹出菜单。
             */
            openShiftFromHereMenu(payload) {
                const songId = Number(payload?.songId);
                const idx = Number(payload?.idx);
                if (!songId || !Number.isFinite(idx)) return;
                const appId = this.app.id;
                const deltas = [-2, -1, -0.5, 0.5, 1, 2];
                const closeAction = createActionAttr({ action: 'appMethod', appId, method: 'closeModal' }, appId);
                const buttons = deltas.map((d) => {
                    const a = createActionAttr({
                        action: 'appMethod',
                        appId,
                        method: 'shiftLyricsFromHere',
                        payload: { songId, idx, delta: d },
                    }, appId);
                    return `<button class="music-btn music-btn--secondary" ${a}>${d > 0 ? '+' : ''}${d}s</button>`;
                }).join('');
                this._mountModal(`
                    <div class="music-modal-overlay" data-modal-overlay="shift-from-here">
                        <div class="music-modal" data-modal-box="shift-from-here">
                            <div class="music-modal-header">
                                <span class="music-modal-title">从第 ${idx + 1} 句开始平移</span>
                                <button class="music-modal-close" ${closeAction}>×</button>
                            </div>
                            <div class="music-modal-body">
                                <div class="music-form-label">这一句及之后的所有歌词，整体加/减时间</div>
                                <div class="music-shift-grid">${buttons}</div>
                            </div>
                        </div>
                    </div>
                `);
            },

            shiftLyricsFromHere(payload) {
                const state = this.app.state.music;
                if (!state) return;
                const songId = Number(payload?.songId);
                const idx = Number(payload?.idx);
                const delta = Number(payload?.delta);
                if (!songId || !Number.isFinite(idx) || !delta) return;
                let custom = getCustomLyrics(songId);
                if (!Array.isArray(custom) || custom.length === 0) {
                    const song = (state.songs || []).find((s) => s.id === songId);
                    if (!song) return;
                    custom = JSON.parse(JSON.stringify(song.lyrics || []));
                }
                setCustomLyrics(songId, shiftLyricsFrom(custom, idx, delta));
                this.closeModal();
                this._triggerRerender();
                this.toolkit?.island?.notify?.('info', `第 ${idx + 1} 句起 ${delta > 0 ? '+' : ''}${delta}s`, '', { kind: 'general' });
            },

            // 保存文本编辑模式的 LRC(从 textarea 取内容)
            saveSongLyrics(payload) {
                const state = this.app.state.music;
                if (!state) return;
                const songId = Number(payload?.songId);
                if (!songId) return;
                try {
                    const shell = document.querySelector('.app-shell[data-app-id="music"]');
                    const ta = shell?.querySelector('[data-lyrics-textarea="1"]');
                    if (!ta) {
                        this.toolkit?.island?.notify?.('warning', '找不到文本框', '', { kind: 'general' });
                        return;
                    }
                    const text = ta.value || '';
                    const parsed = parseLrcFile(text);
                    if (parsed.length === 0) {
                        this.toolkit?.island?.notify?.('warning', '没有解析到歌词行', '', { kind: 'lyrics' });
                        return;
                    }
                    setCustomLyrics(songId, parsed);
                    this._triggerRerender();
                    this.toolkit?.island?.notify?.('success', '已保存', `${parsed.length} 行`, { kind: 'general' });
                } catch (err) {
                    console.warn('[music] saveSongLyrics failed', err);
                    this.toolkit?.island?.notify?.('error', '保存失败', '', { kind: 'general' });
                }
            },

            // 导入 LRC(原型 FileReader 模式:点击按钮 → 选文件 → 读 → 解析 → 存)
            importLrcForSong(payload) {
                const state = this.app.state.music;
                if (!state) return;
                const songId = Number(payload?.songId);
                if (!songId) return;
                // 检查 DOM 中是否有 file input(data-file-input="1")
                const shell = document.querySelector('.app-shell[data-app-id="music"]');
                const fileInput = shell?.querySelector('[data-file-input="1"]');
                if (!fileInput) {
                    this.toolkit?.island?.notify?.('warning', '找不到文件输入', '', { kind: 'general' });
                    return;
                }
                // 清空 value,确保同一文件可选多次
                fileInput.value = '';
                fileInput.onchange = (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        try {
                            const text = String(ev.target?.result || '');
                            const parsed = parseLrcFile(text);
                            if (parsed.length === 0) {
                                this.toolkit?.island?.notify?.('warning', '没有解析到歌词行', '', { kind: 'lyrics' });
                                return;
                            }
                            setCustomLyrics(songId, parsed);
                            this._triggerRerender();
                            this.toolkit?.island?.notify?.('success', '已导入 LRC', `${parsed.length} 行`, { kind: 'lyrics' });
                        } catch (err) {
                            console.warn('[music] importLrcForSong failed', err);
                            this.toolkit?.island?.notify?.('error', '导入失败', err?.message || '', { kind: 'general' });
                        }
                    };
                    reader.onerror = () => {
                        this.toolkit?.island?.notify?.('error', '文件读取失败', '', { kind: 'general' });
                    };
                    reader.readAsText(file, 'UTF-8');
                };
                fileInput.click();
            },

            // 导出 LRC(原型 Blob 下载模式)
            exportLrcForSong(payload) {
                const state = this.app.state.music;
                if (!state) return;
                const songId = Number(payload?.songId);
                if (!songId) return;
                const song = (state.songs || []).find((s) => s.id === songId);
                if (!song) return;
                const lyrics = getCustomLyrics(songId) || song.lyrics || [];
                const lrc = toLrcText(lyrics, { title: song.title, artist: song.artist });
                try {
                    const blob = new Blob([lrc], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const safeName = (song.title || 'lyrics').replace(/[\\/:*?"<>|]/g, '_');
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${safeName}.lrc`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    this.toolkit?.island?.notify?.('success', '已导出 LRC', '', { kind: 'lyrics' });
                } catch (err) {
                    console.warn('[music] exportLrcForSong failed', err);
                    // 兜底走 prompt
                    try { window.prompt('复制以下 LRC 文本:', lrc); } catch (_) { /* noop */ }
                }
            },

            // 清除自定义歌词
            clearSongLyrics(payload) {
                const state = this.app.state.music;
                if (!state) return;
                const songId = Number(payload?.songId);
                if (!songId) return;
                clearCustomLyrics(songId);
                this._triggerRerender();
                this.toolkit?.island?.notify?.('success', '已恢复默认歌词', '', { kind: 'lyrics' });
            },

            // 歌词编辑器模式切换(可视化/文本)
            switchLyricsEditorMode(payload) {
                const mode = payload?.mode;
                if (!mode || !['visual', 'text'].includes(mode)) return;
                // 通过修改 DOM class 实现切换,不需要重新渲染
                requestAnimationFrame(() => {
                    const tabs = document.querySelector('.lyric-editor-tabs');
                    const body = document.querySelector('.lyric-editor-body');
                    if (!tabs || !body) return;
                    // 更新 tab 激活状态
                    tabs.querySelectorAll('.lyric-editor-tab').forEach((btn) => {
                        btn.classList.toggle('is-active', btn.dataset.mode === mode);
                    });
                    // 更新面板显示
                    body.querySelectorAll('.lyric-editor-panel').forEach((panel) => {
                        panel.classList.toggle('is-active', panel.dataset.panel === mode);
                    });
                });
            },

            // 切换批量微调工具栏显示
            toggleBatchAdjust(payload) {
                requestAnimationFrame(() => {
                    const batchRow = document.querySelector('.lyric-editor-batch-row');
                    if (!batchRow) return;
                    // 切换隐藏 class
                    batchRow.classList.toggle('lyric-editor-batch-row--hidden');
                    // 更新按钮激活状态
                    const batchBtn = document.querySelector('.lyric-editor-tool--batch');
                    if (batchBtn) {
                        batchBtn.classList.toggle('is-active');
                    }
                });
            },

            // 批量微调歌词时间
            batchAdjustLyrics(payload) {
                const state = this.app.state.music;
                if (!state) return;
                const songId = Number(payload?.songId);
                const delta = Number(payload?.delta);
                if (!songId || !Number.isFinite(delta)) return;

                const song = (state.songs || []).find((s) => s.id === songId);
                if (!song) return;

                const custom = getCustomLyrics(songId);
                const lyrics = Array.isArray(custom) && custom.length > 0 ? custom : (song.lyrics || []);
                if (!Array.isArray(lyrics) || lyrics.length === 0) return;

                const adjusted = lyrics.map((line) => ({
                    ...line,
                    time: Math.max(0, (line.time || 0) + delta),
                }));
                setCustomLyrics(songId, adjusted);

                // 重新渲染可视化面板
                requestAnimationFrame(() => {
                    const visualPanel = document.querySelector('.lyric-editor-panel--visual');
                    if (!visualPanel) return;
                    const visualList = visualPanel.querySelector('[data-visual-lyrics-list]');
                    if (visualList) {
                        visualList.innerHTML = _renderVisualModeHtml(adjusted, songId, this.app.id);
                    }
                });

                this.toolkit?.island?.notify?.('success', `已调整 ${delta > 0 ? '+' : ''}${delta}s`, '', { kind: 'lyrics' });
            },

            // ---- 岛屿 island(步骤 5 完整实现) ----
            onIslandAction(payload) {
                const action = payload?.action;
                if (action === 'dismiss') {
                    // 用户点岛关闭 → 收回岛,但不暂停音频
                    this._islandUserClosed = true;
                    try {
                        this.toolkit?.island?.dismiss?.();
                    } catch (_) { /* noop */ }
                    clearIdleTimer();
                } else if (action === 'show') {
                    const state = this.app.state.music;
                    this._showIsland(state?.isPlaying ? 'large' : 'medium');
                }
            },

            /** 切换 Large 灵动岛 — 显示音乐播放器完整态 */
            toggleLargeIsland() {
                const state = this.app.state.music;
                if (!state?.currentSong) {
                    this.toolkit?.island?.notify?.('warning', '提示', '请先播放一首歌曲', { kind: 'playback' });
                    return;
                }
                if (!this._showIsland('large')) return;
                if (state.isPlaying) {
                    clearIdleTimer();
                } else {
                    this._startIslandIdleTimer();
                }
            },

            /** 当前灵动岛是不是音乐自己挂的 */
            _isIslandOwnedByMusic() {
                try {
                    const s = this.toolkit?.island?.getState?.();
                    const mine = !!(s && s.mode === 'info' && s.content?.islandTemplate === 'music');
                    // 顺手记住用户手动收到了哪一档，自愈重挂时别又弹回 large
                    if (mine && s.size) this._islandSize = s.size;
                    return mine;
                } catch (_) {
                    return false;
                }
            },

            /**
             * 岛被关掉时的回调(framework 收口后统一回调本方法)。
             * 只有"用户明确关掉"才算真关;被通知顶掉、生命周期到期这类被动关闭,
             * 交给看门狗在播放中重新挂回去。
             */
            _onIslandClosed(info) {
                const reason = info?.reason || '';
                const userIntent = reason === 'manual'
                    || reason === 'userOutside'
                    || reason === 'userLongPress';
                if (userIntent) {
                    this._islandUserClosed = true;
                    return;
                }
                if (reason === 'editMode' || reason === 'widgetPicker') {
                    // 桌面编辑态接管:等退出编辑后再由看门狗挂回去
                    return;
                }
                // replaced / lifecycleExpired / forced:播放中就尽快抢回来
                if (!this.app?.state?.music?.isPlaying) return;
                setTimeout(() => {
                    if (this._islandUserClosed) return;
                    if (!this.app?.state?.music?.isPlaying) return;
                    if (this._isIslandOwnedByMusic()) return;
                    if (this.toolkit?.island?.isActive?.()) return; // 别人还占着,让看门狗慢慢等
                    this._showIsland(this._islandSize || 'mini');
                }, 400);
            },

            /**
             * 页面从后台回到前台时,把岛收回小型态。
             *
             * 场景:用户把网页挂后台去干别的,回来时并没有刷新页面。这时音乐还在放,
             * 看门狗/audio 事件会重新挂岛 —— 如果沿用离开前那一档,用户一回来就
             * 迎面撞上一个占半个屏幕的大岛。展开与否是用户的选择,后台回来不算,
             * 统一降到 mini,想看详情点一下就展开。
             */
            _setupIslandVisibilityGuard() {
                if (this._islandVisibilityBound) return;
                this._islandVisibilityBound = true;
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState !== 'visible') return;
                    this._islandSize = 'mini';
                    try {
                        if (this._isIslandOwnedByMusic()) {
                            const s = this.toolkit?.island?.getState?.();
                            if (s?.size && s.size !== 'mini') {
                                this.toolkit?.island?.setSize?.('mini');
                            }
                        }
                    } catch (_) { /* noop */ }
                    // _isIslandOwnedByMusic 会把 _islandSize 同步成岛的真实档位，
                    // 上面那次赋值会被它覆盖掉，所以收完再钉一次。
                    this._islandSize = 'mini';
                });
            },

            /**
             * 灵动岛看门狗:播放中每 3 秒确认一次岛还在。
             * 任何路径(通知顶替、框架异常、恢复栈没兜住)导致岛消失,都能自动补挂回来。
             */
            _setupIslandWatchdog() {
                if (this._islandWatchdogBound) return;
                this._islandWatchdogBound = true;
                setInterval(() => {
                    try {
                        const state = this.app?.state?.music;
                        if (!state?.currentSong || !state.isPlaying) return;
                        if (this._islandUserClosed) return;
                        if (this._isIslandOwnedByMusic()) return;
                        // 别的 app 正占着岛(来电/通知),不抢,等它自己让出来
                        if (this.toolkit?.island?.isActive?.()) return;
                        // 桌面编辑 / widget 选择器接管了岛,也不抢
                        if (document.querySelector('.desktop-edit-mode')) return;
                        this._showIsland(this._islandSize || 'mini');
                    } catch (_) { /* noop */ }
                }, 3000);
            },

            // ---- idle timer:暂停 60 秒后自动收岛(对齐 prototype startIdleTimer) ----
            _startIslandIdleTimer() {
                try {
                    startIdleTimer(60000, () => {
                        const state = this.app?.state?.music;
                        // 到点时若又恢复播放,则不收岛
                        if (state?.isPlaying) return;
                        try {
                            this._islandUserClosed = true; // 已经收了,别让看门狗又挂回来
                            this.toolkit?.island?.dismiss?.();
                        } catch (_) { /* noop */ }
                        // 对齐原型:暂停超过 1 分钟同时断开一起听
                        if (state?.listenTogether?.active) {
                            try {
                                void this._endListenTogetherInternal(
                                    state.listenTogether.sessionId,
                                    { reason: '暂停超过1分钟' },
                                );
                            } catch (_) { /* noop */ }
                        }
                    });
                } catch (_) { /* noop */ }
            },

            // ---- 步骤 9:tab 切换(完全交给 framework) ----
            // ★ tab bar 直接 dispatch framework 的 switchPage action,framework 改
            //   activeRootPageId,Vue 响应式自动重画 v-html,renderPage() 用新 page 重新渲染。
            // 这里不再维护本地状态。
            // 保留这个方法作为外部调用入口(如果旧代码还在调 switchTab),转发到 framework。
            switchTab(payload) {
                const tabId = payload?.tabId || 'home';
                const nav = (typeof window !== 'undefined') ? window.__appNavigation : null;
                if (nav && typeof nav.switchRootPage === 'function') {
                    nav.switchRootPage(tabId);
                } else {
                    // 兜底:framework 桥未就绪时,让 app 整体重渲染等待 framework 自然同步
                    this._triggerRerender?.();
                }
            },

            /**
             * 步骤 9:添加歌曲 modal 显示
             * playlistId 为空 → 添加到默认歌曲库;否则添加到指定歌单
             */
            openAddSongModal(payload) {
                const playlistId = payload?.playlistId || null;
                const markup = renderAddSongModal(this.app.id, playlistId);
                this._mountModal(markup);
            },

            /** 创建歌单 modal */
            openCreatePlaylistModal() {
                const markup = renderCreatePlaylistModal(this.app.id);
                this._mountModal(markup);
            },

            /** 编辑歌单 modal(传 playlistId) */
            openEditPlaylistModal(payload) {
                const playlist = findPlaylist(this.app?.state?.music?.playlists, payload?.playlistId);
                if (!playlist) {
                    this.toolkit?.island?.notify?.('warning', '歌单不存在', '', { kind: 'playlist' });
                    return;
                }
                const markup = renderEditPlaylistModal(this.app.id, playlist);
                this._mountModal(markup);
            },

            /** 分享歌单给 AI modal(异步拉 AI 列表) */
            async openSharePlaylistModal(payload) {
                const playlists = this.app?.state?.music?.playlists || [];
                let playlist = findPlaylist(playlists, payload?.playlistId);
                if (!playlist && playlists.length > 0) {
                    playlist = playlists[0];
                }
                let aiList = [];
                try {
                    aiList = await listAiPersons();
                } catch (_) { /* noop */ }
                const markup = renderSharePlaylistModal(this.app.id, playlist, aiList);
                this._mountModal(markup);
            },

            /** 关闭 modal */
            closeModal() {
                // 优先从当前可见的音乐内容容器移除
                const appContent = document.querySelector('.app-content.detail-active[data-app-id="music"]') ||
                                   document.querySelector('.app-shell[data-app-id="music"] .app-content');
                const target = appContent || document.querySelector('.app-shell[data-app-id="music"]');
                if (!target) return;
                target.querySelectorAll('.music-modal-overlay').forEach((o) => {
                    // 清理事件监听器
                    if (o._musicOverlayHandler) {
                        o.removeEventListener('click', o._musicOverlayHandler);
                        o._musicOverlayHandler = null;
                    }
                    o.remove();
                });
            },

            /**
             * 把 modal HTML 挂到 music app shell 内
             * 注意:保持在 app-shell 内部，这样弹窗会被手机壳裁切，不会超出屏幕
             */
            _mountModal(markup) {
                // 优先追加到当前可见的音乐内容容器（detail 页没有 music-app-shell）
                // 查找最近的 .app-content[data-app-id="music"] 或其子元素
                const appContent = document.querySelector('.app-content.detail-active[data-app-id="music"]') ||
                                   document.querySelector('.app-shell[data-app-id="music"] .app-content');
                const target = appContent || document.querySelector('.app-shell[data-app-id="music"]');
                if (!target) return;
                // 先清旧 modal
                target.querySelectorAll('.music-modal-overlay').forEach((o) => o.remove());
                const tmp = document.createElement('div');
                tmp.innerHTML = markup;
                const el = tmp.firstElementChild;
                if (!el) return;
                target.appendChild(el);

                // 添加点击遮罩关闭功能
                const overlay = el;
                const handleOverlayClick = (e) => {
                    // 点击遮罩（不是弹窗本身）时关闭
                    if (e.target === overlay) {
                        this.closeModal();
                    }
                };
                overlay.addEventListener('click', handleOverlayClick);
                // 标记用于后续清理
                overlay._musicOverlayHandler = handleOverlayClick;
            },

            /** 选颜色:仅 patch 视觉(临时 state),真正写入在 submit */
            pickPlaylistColor(payload) {
                const color = payload?.color;
                const target = payload?.target || 'create';
                if (!color) return;
                // 优先从当前可见的音乐内容容器查找
                const appContent = document.querySelector('.app-content.detail-active[data-app-id="music"]') ||
                                   document.querySelector('.app-shell[data-app-id="music"] .app-content');
                const modalBox = appContent?.querySelector(`[data-modal-box="${target === 'edit' ? 'edit-playlist' : 'create-playlist'}"]`) ||
                                 document.querySelector(`.music-modal[data-modal-box="${target === 'edit' ? 'edit-playlist' : 'create-playlist'}"]`);
                if (!modalBox) return;
                const palette = modalBox.querySelector('.music-color-palette');
                if (!palette) return;
                palette.querySelectorAll('.music-color-swatch').forEach((b) => {
                    if (b.getAttribute('data-color') === color) b.classList.add('is-active');
                    else b.classList.remove('is-active');
                });
            },

            /**
             * 提交添加歌曲:从 modal DOM 读输入 → 解析 URL → 写入 songs(默认)/ 写 playlists(指定)
             */
            async submitAddSong(payload) {
                const state = this.app?.state?.music;
                if (!state) return;
                const playlistId = payload?.playlistId || null;
                // 优先从当前可见的音乐内容容器查找
                const appContent = document.querySelector('.app-content.detail-active[data-app-id="music"]') ||
                                   document.querySelector('.app-shell[data-app-id="music"] .app-content');
                const box = appContent?.querySelector(`[data-modal-box="add-song"]`) ||
                           document.querySelector(`.music-modal [data-modal-box="add-song"]`);
                if (!box) return;

                const url = (box.querySelector('[data-input="add-song-url"]')?.value || '').trim();
                const title = (box.querySelector('[data-input="add-song-title"]')?.value || '').trim();
                const artist = (box.querySelector('[data-input="add-song-artist"]')?.value || '').trim();
                const cover = (box.querySelector('[data-input="add-song-cover"]')?.value || '').trim();
                const lrc = (box.querySelector('[data-input="add-song-lrc"]')?.value || '').trim();
                const errBox = box.querySelector('[data-error="add-song"]');

                const setErr = (msg) => {
                    if (errBox) {
                        errBox.textContent = msg;
                        errBox.hidden = false;
                    } else {
                        this.toolkit?.island?.notify?.('warning', msg, '', { kind: 'general' });
                    }
                };

                if (!url) { setErr('音频 URL 必填'); return; }
                if (!title) { setErr('标题必填'); return; }
                if (!/^https?:\/\//i.test(url) && !/^\/\//.test(url)) {
                    setErr('URL 必须以 http(s):// 开头');
                    return;
                }

                const newSong = {
                    id: Date.now(),
                    title,
                    artist: artist || '未知歌手',
                    url,
                    cover: cover || '',
                    coverUrl: cover || '',
                    lyrics: lrc || '',
                };

                // 默认歌曲库
                if (!Array.isArray(state.songs)) state.songs = [];
                state.songs.push(newSong);

                // 如果指定了 playlistId,同时加入那张歌单
                if (playlistId) {
                    const playlist = findPlaylist(state.playlists, playlistId);
                    if (playlist) {
                        setPlaylistSongIds(playlist, [...getPlaylistSongIds(playlist), newSong.id]);
                        try {
                            await persistPlaylists(this.app, state.playlists);
                        } catch (_) { /* noop */ }
                    }
                }

                try {
                    saveMusicSnapshot(state);
                } catch (_) { /* noop */ }
                this.closeModal();
                this.toolkit?.island?.notify?.('success', playlistId ? '已加入歌单' : '已添加', '', { kind: 'playlist' });
                this._triggerRerender();
            },

            /** 提交创建歌单 */
            async submitCreatePlaylist() {
                const state = this.app?.state?.music;
                if (!state) return;
                const shell = document.querySelector('.app-shell[data-app-id="music"]');
                const box = shell?.querySelector(`[data-modal-box="create-playlist"]`);
                if (!box) return;

                const name = (box.querySelector('[data-input="create-playlist-name"]')?.value || '').trim();
                const desc = (box.querySelector('[data-input="create-playlist-desc"]')?.value || '').trim();
                const activeSwatch = box.querySelector('.music-color-swatch.is-active');
                const color = activeSwatch?.getAttribute('data-color') || '#fb7299';

                if (!name) {
                    const errBox = box.querySelector('[data-error="create-playlist"]');
                    if (errBox) { errBox.textContent = '歌单名必填'; errBox.hidden = false; }
                    return;
                }

                const newPlaylist = {
                    id: `pl_${Date.now()}`,
                    name,
                    desc,
                    color,
                    cover: '',
                    songIds: [],
                    songs: [],
                    createdAt: Date.now(),
                };

                if (!Array.isArray(state.playlists)) state.playlists = [];
                state.playlists.push(newPlaylist);

                try {
                    await persistPlaylists(this.app, state.playlists);
                    saveMusicSnapshot(state);
                } catch (_) { /* noop */ }
                this.closeModal();
                this.toolkit?.island?.notify?.('success', '已创建', '', { kind: 'general' });
                this._triggerRerender();
            },

            /** 提交编辑歌单 */
            async submitEditPlaylist(payload) {
                const state = this.app?.state?.music;
                if (!state) return;
                const playlist = findPlaylist(state.playlists, payload?.playlistId);
                if (!playlist) return;
                const shell = document.querySelector('.app-shell[data-app-id="music"]');
                const box = shell?.querySelector(`[data-modal-box="edit-playlist"]`);
                if (!box) return;

                playlist.name = (box.querySelector('[data-input="edit-playlist-name"]')?.value || '').trim() || playlist.name;
                playlist.desc = (box.querySelector('[data-input="edit-playlist-desc"]')?.value || '').trim();
                playlist.cover = (box.querySelector('[data-input="edit-playlist-cover"]')?.value || '').trim();
                const activeSwatch = box.querySelector('.music-color-swatch.is-active');
                if (activeSwatch) {
                    playlist.color = activeSwatch.getAttribute('data-color') || playlist.color;
                }
                try {
                    await persistPlaylists(this.app, state.playlists);
                    saveMusicSnapshot(state);
                } catch (_) { /* noop */ }
                this.closeModal();
                this.toolkit?.island?.notify?.('success', '已保存', '', { kind: 'general' });
                this._triggerRerender();
            },

            /** 确认删除歌单 */
            deletePlaylistWithConfirm(payload) {
                const playlistId = payload?.playlistId;
                if (!playlistId) return;
                const state = this.app?.state?.music;
                const playlist = findPlaylist(state?.playlists, playlistId);
                if (!playlist) return;
                const drop = () => {
                    state.playlists = (state.playlists || [])
                        .filter((p) => String(p.id) !== String(playlistId));
                };
                const confirmRequest = window.__phoneConfirm?.request;
                if (typeof confirmRequest === 'function') {
                    confirmRequest({
                        title: '删除歌单',
                        text: `确认删除歌单"${playlist.name || ''}"?`,
                        confirmLabel: '删除',
                        danger: true,
                        onConfirm: async () => {
                            try {
                                drop();
                                await persistPlaylists(this.app, state.playlists);
                                saveMusicSnapshot(state);
                            } catch (_) { /* noop */ }
                            this.closeModal();
                            this.toolkit?.island?.notify?.('success', '已删除', '', { kind: 'general' });
                            this._triggerRerender();
                        },
                        onCancel() { /* noop */ },
                    });
                } else {
                    drop();
                    this.closeModal();
                    this._triggerRerender();
                }
            },

            /** 分享歌单给指定 AI(走 ai-bridge) */
            async submitSharePlaylistToAi(payload) {
                const state = this.app?.state?.music;
                if (!state) return;
                const aiId = payload?.aiId;
                const playlist = findPlaylist(state.playlists, payload?.playlistId);
                if (!playlist || !aiId) return;
                try {
                    const aiList = await listAiPersons();
                    const ai = (aiList || []).find((a) => a.id === aiId);
                    const aiName = ai?.name || ai?.displayName || 'AI';
                    const songIds = getPlaylistSongIds(playlist);
                    const songs = songIds
                        .map((id) => (state.songs || []).find((s) => s.id === id))
                        .filter(Boolean);
                    // 写进 AI 的 Nook prompt(让它知道用户分享过这张歌单)
                    await sharePlaylistToAi({
                        aiId,
                        playlistId: playlist.id,
                        playlistName: playlist.name,
                        songIds,
                        songNames: songs.map((s) => s.title).filter(Boolean),
                    });
                    // 再往聊天里发一张歌单卡
                    await sendPlaylistShare({ aiId, playlist, songs, sender: 'user' });
                    this.closeModal();
                    this.toolkit?.island?.notify?.('success', '已分享', `${aiName} · 聊天 + Nook`, { kind: 'share' });
                    this._triggerRerender();
                } catch (err) {
                    console.warn('[music] sharePlaylistToAi failed', err);
                    this.toolkit?.island?.notify?.('error', '分享失败', '', { kind: 'share' });
                }
            },

            /** 通过 songId 播放(供 discover 卡片用) */
            playSongById(payload) {
                this.playSong(payload);
            },

            // ---- 「发现」Tab 四张卡（之前这几个 method 缺失，点了没反应） ----

            _openDetail(pageId, payload = {}) {
                try {
                    window.dispatchEvent(new CustomEvent('app:page-action', {
                        detail: { action: 'detail', appId: this.app.id, pageId, payload },
                    }));
                } catch (_) { /* noop */ }
            },

            openRankings() {
                this._openDetail('rankings');
            },

            /** 「我的」页的曲库统计 → 回首页，全部歌曲就列在那 */
            openLibrary() {
                this.switchTab({ tabId: 'home' });
            },

            openRadio() {
                this._radioSeed = (this._radioSeed || 1) + 1;
                this._openDetail('radio', { seed: this._radioSeed });
            },

            /** 电台页的「换一批推荐」：换个种子重开 */
            refreshRadio() {
                this._radioSeed = (this._radioSeed || 1) + 1;
                this._openDetail('radio', { seed: this._radioSeed });
            },

            openPlaylists() {
                this._openDetail('featured-playlists');
            },

            openRecentPlayed() {
                this._openDetail('recent-play');
            },

            /** 「我的」页右上角设置:跳系统设置 App */
            openSettings() {
                try {
                    window.dispatchEvent(new CustomEvent('app:page-action', {
                        detail: { action: 'openApp', appId: 'settings', pageId: '', payload: {} },
                    }));
                } catch (_) {
                    this.toolkit?.island?.notify?.('info', '设置', '去桌面打开设置 App', { kind: 'general' });
                }
            },
        },

        // ===== 路由分发 =====
        renderPage(content, page, app) {
            // 首次进入页面时确保 hydrate（renderPage 会被 framework 调用多次）
            // 但 _hydrating 期间不要重复触发（避免 race）。
            if (!app.state._hydrated && !app.state._hydrating) {
                if (app.methods && typeof app.methods.hydrate === 'function') {
                    Promise.resolve().then(() => app.methods.hydrate());
                }
            }

            // ★ 关键修复:在 renderPage 同步阶段就注册 rootpage-changed 监听器
            // 不能等 async hydrate(),因为 switchRootPage 派发事件时 hydrate 还没跑
            if (!app.state._musicTabEventBound) {
                app.state._musicTabEventBound = true;
                window.addEventListener('app:rootpage-changed', (e) => {
                    const { appId, to } = e?.detail || {};
                    if (appId !== 'music') return;
                    const ROOT_TABS = new Set(['home', 'listen-together', 'discover', 'me']);
                    if (!ROOT_TABS.has(to)) return;
                    const tabIndex = ['home', 'listen-together', 'discover', 'me'].indexOf(to);
                    if (tabIndex < 0) return;
                    // 等 DOM 更新后定位
                    requestAnimationFrame(() => requestAnimationFrame(() => {
                        const bar = document.querySelector('.app-shell[data-app-id="music"] .music-dynamic-tabbar');
                        if (bar) {
                            bar.dataset.tab = String(tabIndex);
                            moveTabIndicator(bar, tabIndex);
                        }
                    }));
                });
            }

            // ★ v0.84:歌词编辑器模式切换 / 导入按钮 / 预览触发器的事件代理
            // framework v-html 后事件需要重新绑,每次 renderPage 都尝试注册(幂等)
            if (!app.state._editorDomEventsBound) {
                app.state._editorDomEventsBound = true;
                requestAnimationFrame(() => {
                    const shell = document.querySelector('.app-shell[data-app-id="music"]');
                    if (!shell) return;

                    // 1) 模式切换按钮 [lyric-editor-tabs .lyric-editor-tab]
                    shell.addEventListener('click', (ev) => {
                        const tabBtn = ev.target.closest('.lyric-editor-tabs .lyric-editor-tab');
                        if (tabBtn) {
                            const tabs = tabBtn.closest('.lyric-editor-tabs');
                            const target = tabBtn.dataset.mode;
                            tabs.querySelectorAll('.lyric-editor-tab').forEach((b) => b.classList.toggle('is-active', b === tabBtn));
                            const body = document.querySelector('.lyric-editor-body');
                            if (body) {
                                body.querySelectorAll('.lyric-editor-panel').forEach((p) => {
                                    p.classList.toggle('is-active', p.dataset.panel === target);
                                });
                            }
                            return;
                        }

                        // 2) 文本模式预览按钮 [data-preview-trigger]
                        const previewBtn = ev.target.closest('[data-preview-trigger]');
                        if (previewBtn) {
                            const editorRoot = previewBtn.closest('.lyric-editor-root');
                            const ta = editorRoot?.querySelector('[data-lyrics-textarea="1"]');
                            const previewBox = editorRoot?.querySelector('[data-preview-box="1"]');
                            const previewContent = editorRoot?.querySelector('[data-preview-content="1"]');
                            if (!ta || !previewBox || !previewContent) return;
                            const text = ta.value || '';
                            const lines = text.split(/\r?\n/).filter((l) => l.trim());
                            const previewHtml = lines.map((l) => {
                                const m = /^\[(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?\]/.exec(l);
                                if (!m) return `<div class="music-lyric-preview-line">${escapeHtml(l)}</div>`;
                                const time = `${m[1].padStart(2, '0')}:${m[2].padStart(2, '0')}`;
                                const text2 = l.replace(/^\[[^\]]+\]/, '').trim();
                                return `<div class="music-lyric-preview-line"><span class="music-lyric-preview-time">${time}</span> <span>${escapeHtml(text2)}</span></div>`;
                            }).join('');
                            previewContent.innerHTML = previewHtml;
                            previewBox.hidden = false;
                            return;
                        }

                        // 3) 批量微调按钮 [.lyric-editor-batch-btn]
                        const batchBtn = ev.target.closest('.lyric-editor-batch-btn');
                        if (batchBtn) {
                            const songId = Number(batchBtn.dataset.songId);
                            const delta = Number(batchBtn.dataset.delta);
                            if (songId && Number.isFinite(delta)) {
                                const state = app.state.music;
                                if (!state) return;
                                const song = (state.songs || []).find((s) => s.id === songId);
                                if (!song) return;
                                const custom = getCustomLyrics(songId);
                                const lyrics = Array.isArray(custom) && custom.length > 0 ? custom : (song.lyrics || []);
                                if (!Array.isArray(lyrics) || lyrics.length === 0) return;
                                const adjusted = lyrics.map((line) => ({
                                    ...line,
                                    time: Math.max(0, (line.time || 0) + delta),
                                }));
                                setCustomLyrics(songId, adjusted);
                                // 重新渲染可视化面板
                                const visualPanel = document.querySelector('.lyric-editor-panel--visual');
                                const visualList = visualPanel?.querySelector('[data-visual-lyrics-list]');
                                if (visualList && typeof _renderVisualMode === 'function') {
                                    visualList.innerHTML = _renderVisualMode(adjusted, songId, app.id);
                                }
                                this.toolkit?.island?.notify?.('success', `已调整 ${delta > 0 ? '+' : ''}${delta}s`, '', { kind: 'lyrics' });
                            }
                            return;
                        }
                    });
                });
            }

            const state = app?.state?.music || {};
            // ★ 当前 root tab id 直接来自 framework(传入的 page 参数是唯一真相源)
            const activeTab = page.id;
            let main = '';
            switch (page.id) {
                case 'home': main = renderHomePage(content, page, app); break;
                case 'listen-together': main = renderListenTogetherPage(content, page, app); break;
                case 'discover': main = renderDiscoverPage(content, page, app); break;
                case 'me': main = renderMePage(content, page, app); break;
                case 'player': return renderPlayerPage(content, page, app);
                case 'playlist-detail': return renderPlaylistDetailPage(content, page, app);
                case 'liked': return renderLikedPage(content, page, app);
                case 'recent-play': return renderRecentPlayPage(content, page, app);
                case 'lyrics-editor': return renderLyricsEditorPage(content, page, app);
                case 'song-lyrics-editor': return renderSongLyricsEditorPage(content, page, app);
                case 'search-results': return renderSearchResultsPage(content, page, app);
                case 'rankings': return renderRankingsPage(content, page, app);
                case 'radio': return renderRadioPage(content, page, app);
                case 'featured-playlists': return renderFeaturedPlaylistsPage(content, page, app);
                default: main = '';
            }
            // 4 个根 tab 时,底部追加 tab bar
            if (['home', 'listen-together', 'discover', 'me'].includes(page.id)) {
                const tabBar = renderTabBar(app, activeTab, !!state.isPlaying);
                return `
                    <div class="music-app-shell">
                        <div class="music-app-shell-content">${main}</div>
                        ${tabBar}
                        <div data-modal-host="root"></div>
                    </div>
                `;
            }
            return main;
        },

        // ===== Detail 页面渲染（framework 调用 renderDetailPage） =====
        renderDetailPage(content, page, app) {
            // 复用 renderPage 的路由逻辑
            const pageId = page?.id;
            switch (pageId) {
                case 'player': return renderPlayerPage(content, page, app);
                case 'playlist-detail': return renderPlaylistDetailPage(content, page, app);
                case 'liked': return renderLikedPage(content, page, app);
                case 'recent-play': return renderRecentPlayPage(content, page, app);
                case 'lyrics-editor': return renderLyricsEditorPage(content, page, app);
                case 'song-lyrics-editor': return renderSongLyricsEditorPage(content, page, app);
                case 'search-results': return renderSearchResultsPage(content, page, app);
                case 'rankings': return renderRankingsPage(content, page, app);
                case 'radio': return renderRadioPage(content, page, app);
                case 'featured-playlists': return renderFeaturedPlaylistsPage(content, page, app);
                default:
                    // fallback 到 renderPage
                    return this.renderPage(content, page, app);
            }
        },
    };
}
