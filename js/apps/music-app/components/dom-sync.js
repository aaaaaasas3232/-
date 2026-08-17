/**
 * music-app · components/dom-sync.js
 * 跨页面/灵动岛 同步播放状态的 DOM 工具(对齐 prototype music-app.js 的
 * updateAllProgressBars / updateAllPlayButtons / updateLyrics 三个函数)。
 *
 * 设计:
 *   - 不依赖 Vue 反应式(template 模式 v-html 后,JS 直接改 DOM 才能更新)
 *   - 用 document.querySelectorAll 一把扫所有相关元素,统一更新
 *   - 所有更新都在 audio-service 内部 timeupdate / play / pause 事件中触发,
 *     业务侧不用再手动调
 *
 * 选择器语义(对齐原型 + 适配现有 music-app):
 *   - .music-player-progress-fill    全屏播放器进度条
 *   - .music-player-time-now         全屏播放器当前时间
 *   - .music-player-time-total       全屏播放器总时间
 *   - .music-lyric-line              全屏播放器歌词行
 *   - .island-music-progress-fill    灵动岛进度条
 *   - .island-music-lyric-line       灵动岛歌词行
 *   - .music-song-item .music-song-play-btn / .music-song-btn-play
 *   - .play-toggle-btn / .island-play-btn / .music-player-play
 */

// mm:ss 格式
function _fmtTime(seconds) {
    if (!Number.isFinite(seconds)) return '0:00';
    const s = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${(secs < 10 ? '0' : '')}${secs}`;
}

/**
 * 更新所有可见的进度条 + 时间显示。
 * 优先级:全屏播放器 > 灵动岛 > 列表内迷你播放按钮。
 */
export function updateAllProgressBars(state) {
    if (!state) return;
    const progress = Number.isFinite(state.progress) ? state.progress : 0;
    const currentTime = Number.isFinite(state.currentTime) ? state.currentTime : 0;
    const duration = Number.isFinite(state.duration) ? state.duration : 0;

    // 1) 全屏播放器的进度条
    const playerFills = document.querySelectorAll('.music-player-progress-fill');
    playerFills.forEach((el) => {
        el.style.width = `${progress.toFixed(2)}%`;
    });
    const playerThumbs = document.querySelectorAll('.music-player-progress-thumb');
    playerThumbs.forEach((el) => {
        el.style.left = `${progress.toFixed(2)}%`;
    });
    const nowEls = document.querySelectorAll('.music-player-time-now');
    nowEls.forEach((el) => {
        el.textContent = _fmtTime(currentTime);
    });
    const totalEls = document.querySelectorAll('.music-player-time-total');
    totalEls.forEach((el) => {
        el.textContent = _fmtTime(duration);
    });

    // 2) 灵动岛进度条 + 时间(类名对齐 island-templates.js 渲染出的 .island-template-music-*)
    const islandFills = document.querySelectorAll('.island-template-music-progress-fill');
    islandFills.forEach((el) => {
        el.style.width = `${progress.toFixed(2)}%`;
    });
    // 灵动岛时间行:第一个 span = 当前时间,第二个 span = 总时长
    const islandTimeRows = document.querySelectorAll('.island-template-music-time');
    islandTimeRows.forEach((row) => {
        const spans = row.querySelectorAll('span');
        if (spans[0]) spans[0].textContent = _fmtTime(currentTime);
        if (spans[1]) spans[1].textContent = _fmtTime(duration);
    });

    // 3) tab bar / 列表内的迷你进度条(预留给后续扩展)
    const miniFills = document.querySelectorAll('[data-music-progress]');
    miniFills.forEach((el) => {
        el.style.width = `${progress.toFixed(2)}%`;
    });
}

/**
 * 更新所有可见的播放/暂停按钮图标。
 * 选播放按钮用 .island-play-btn / .play-toggle-btn / .music-player-play 三种。
 */
export function updateAllPlayButtons(state) {
    if (!state) return;
    const isPlaying = !!state.isPlaying;
    const pauseIcon = '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="currentColor"/></svg>';
    const playIcon = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';

    const icon = isPlaying ? pauseIcon : playIcon;

    // 列表里的统一播放按钮（track-controls.renderPlayToggleButton 画的）。
    // 只有「当前这首」才跟随播放状态变图标，其余保持 ▶。
    _syncTrackButtons(state);

    // 全屏播放器主按钮
    const playerBtns = document.querySelectorAll('.music-player-play');
    playerBtns.forEach((btn) => {
        // 优先换 innerHTML 的 svg,避免误覆盖其他子节点
        const svg = btn.querySelector('svg');
        if (svg) {
            svg.outerHTML = icon;
        } else {
            btn.innerHTML = icon;
        }
        btn.setAttribute('aria-label', isPlaying ? '暂停' : '播放');
        btn.classList.toggle('is-playing', isPlaying);
    });

    // 灵动岛所有播放按钮(medium 的 toggle-play + large 的主按钮)
    const islandBtns = document.querySelectorAll(
        '.island-template-music-btn[data-island-action="toggle-play"], .island-template-music-large-btn-main'
    );
    islandBtns.forEach((btn) => {
        const svg = btn.querySelector('svg');
        if (svg) svg.outerHTML = icon;
        else btn.innerHTML = icon;
    });

    // 通用 .play-toggle-btn(老代码兼容)
    const toggleBtns = document.querySelectorAll('.play-toggle-btn');
    toggleBtns.forEach((btn) => {
        btn.innerHTML = icon;
    });

    // 列表项里的 .music-song-play-btn(小播放图标)— 这个通常不切换,但也支持
    const songPlayBtns = document.querySelectorAll('.music-song-play-btn[data-music-toggle]');
    songPlayBtns.forEach((btn) => {
        btn.innerHTML = icon;
    });

    // 灵动岛 mini 态波形
    const waveEls = document.querySelectorAll('.island-template-music-mini-wave');
    waveEls.forEach((el) => {
        if (isPlaying) el.classList.add('playing');
        else el.classList.remove('playing');
    });

    // tab bar 上的播放状态
    const tabBar = document.querySelector('.app-shell[data-app-id="music"] .music-dynamic-tabbar');
    if (tabBar) {
        if (isPlaying) tabBar.classList.add('playing');
        else tabBar.classList.remove('playing');
    }
}

const TRACK_PAUSE_ICON = '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="currentColor"/></svg>';
const TRACK_PLAY_ICON = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
const TRACK_HEART_ICON = '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="currentColor"/></svg>';
const TRACK_HEART_OUTLINE_ICON = '<svg viewBox="0 0 24 24"><path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z" fill="currentColor"/></svg>';

/**
 * 把列表 / 播放器 / 详情页上的统一播放按钮和收藏按钮刷成当前真实状态。
 *
 * 为什么不靠重渲染：template 模式下 v-html 重画是异步的（要等 detailRenderTick
 * 走一圈 Vue），点一下心形要过两帧才变红，手感像没点上。这里直接改 DOM 立刻见效，
 * 重渲染再来一遍也是同一个结果，不冲突。
 */
function _syncTrackButtons(state) {
    const currentId = state?.currentSong?.id;
    const isPlaying = !!state?.isPlaying;
    const likedSet = new Set((Array.isArray(state?.likedSongs) ? state.likedSongs : []).map(String));

    document.querySelectorAll('.music-play-toggle').forEach((btn) => {
        const songId = btn.getAttribute('data-song-id');
        const isCurrent = songId != null && String(currentId) === String(songId);
        const showPause = isCurrent && isPlaying;
        btn.classList.toggle('is-current', isCurrent);
        btn.classList.toggle('is-playing', showPause);
        btn.setAttribute('data-current', isCurrent ? '1' : '0');
        if (btn.getAttribute('data-playing') !== (showPause ? '1' : '0')) {
            btn.setAttribute('data-playing', showPause ? '1' : '0');
            btn.innerHTML = showPause ? TRACK_PAUSE_ICON : TRACK_PLAY_ICON;
            btn.setAttribute('aria-label', showPause ? '暂停' : '播放');
        }
    });

    document.querySelectorAll('.music-like-btn').forEach((btn) => {
        const songId = btn.getAttribute('data-song-id');
        if (songId == null) return;
        const liked = likedSet.has(String(songId));
        if (btn.getAttribute('data-liked') === (liked ? '1' : '0')) return;
        btn.setAttribute('data-liked', liked ? '1' : '0');
        btn.classList.toggle('is-liked', liked);
        btn.setAttribute('aria-label', liked ? '取消喜欢' : '喜欢');
        const text = btn.querySelector('.music-like-btn-text');
        const svg = btn.querySelector('svg');
        if (svg) svg.outerHTML = liked ? TRACK_HEART_ICON : TRACK_HEART_OUTLINE_ICON;
        if (text) text.textContent = liked ? '已喜欢' : '喜欢';
    });

    // 列表行的高亮跟着一起走
    document.querySelectorAll('.music-song-item[data-song-id]').forEach((row) => {
        const songId = row.getAttribute('data-song-id');
        const isCurrent = String(currentId) === String(songId);
        row.classList.toggle('is-current', isCurrent);
        row.classList.toggle('is-playing', isCurrent && isPlaying);
    });
}

/** 收藏状态变化时给外部调（toggleLike 里直接调，不等重渲染） */
export function syncLikeButtons(state) {
    _syncTrackButtons(state);
}

/**
 * 更新歌词:找出当前 active 行,加 active class,并滚动到可见位置。
 * 同时处理全屏播放器 + 灵动岛两种歌词容器。
 */
export function updateLyrics(state) {
    if (!state) return;
    const song = state.currentSong;
    if (!song) return;
    const lyrics = Array.isArray(song.lyrics) ? song.lyrics : [];
    if (lyrics.length === 0) return;
    const currentTime = Number.isFinite(state.currentTime) ? state.currentTime : 0;

    // 计算 active index(prototype 算法:取 ≤ currentTime 的最大 time)
    let activeIndex = -1;
    for (let i = 0; i < lyrics.length; i++) {
        if (lyrics[i].time <= currentTime) activeIndex = i;
        else break;
    }

    // 1) 全屏播放器歌词 (.music-player-lyrics)
    _highlightLyricContainer('.music-player-lyrics', lyrics, activeIndex);
    // 2) 通用 .music-lyric-line 容器
    _highlightLyricContainer('.music-lyrics-container', lyrics, activeIndex);
    // 3) 灵动岛歌词 (.island-template-music-lyrics)
    _highlightLyricContainer('.island-template-music-lyrics', lyrics, activeIndex);
    // 4) 小型灵动岛的那一行文字:显示正在唱的那句,没到第一句就回落歌名
    _updateIslandMiniLabel(song, lyrics, activeIndex);
}

function _updateIslandMiniLabel(song, lyrics, activeIndex) {
    const labels = document.querySelectorAll('.island-template-music-mini-label');
    if (labels.length === 0) return;
    const line = activeIndex >= 0 ? lyrics[activeIndex]?.text : '';
    const text = line || song.title || '';
    labels.forEach((el) => {
        if (el.textContent !== text) el.textContent = text;
    });
}

function _highlightLyricContainer(containerSelector, lyrics, activeIndex) {
    const containers = document.querySelectorAll(containerSelector);
    if (containers.length === 0) return;
    containers.forEach((container) => {
        // 支持两种 class: .music-lyric-line (播放器) 和 .island-template-music-lyric-line (灵动岛)
        const lines = container.querySelectorAll('.music-lyric-line, .island-template-music-lyric-line');
        if (lines.length === 0) return;
        let scrolled = false;
        let activeLine = null;
        lines.forEach((line, idx) => {
            const isActive = idx === activeIndex;
            if (isActive) {
                if (!line.classList.contains('active')) {
                    line.classList.add('active');
                    activeLine = line;
                }
            } else {
                line.classList.remove('active');
            }
            // past 状态:已经唱过的行
            if (idx < activeIndex) line.classList.add('past');
            else line.classList.remove('past');
        });

        if (!activeLine) return;

        /**
         * ★ 只滚歌词自己那个容器，不要用 scrollIntoView。
         *
         * `scrollIntoView({ block: 'center' })` 会把**所有可滚动祖先**一起滚，
         * 好让这一行落到视口正中 —— 于是每唱一句，整个播放器详情页就往上滑一截，
         * 封面和进度条被滚出屏幕。歌词只需要在它自己那一小块里居中。
         *
         * 找一个真正能滚的容器（自己或最近的祖先），手动算 scrollTop。
         */
        const scroller = _findScroller(container);
        if (scroller) {
            const target = activeLine.offsetTop - (scroller.clientHeight / 2) + (activeLine.clientHeight / 2);
            const next = Math.max(0, Math.min(target, scroller.scrollHeight - scroller.clientHeight));
            if (Math.abs(scroller.scrollTop - next) > 1) {
                try { scroller.scrollTo({ top: next, behavior: 'smooth' }); }
                catch (_) { scroller.scrollTop = next; }
            }
            scrolled = true;
        }

        // 容器压根不滚（高度自适应的那种）→ 退回 transform 位移
        if (!scrolled) {
            try {
                const wrap = container.closest('.music-player-lyrics-wrap') || container.closest('.island-template-music-lyrics');
                const wrapHeight = wrap?.clientHeight || container.clientHeight || 130;
                const lineRect = activeLine.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                const lineCenter = (lineRect.top - containerRect.top) + (lineRect.height / 2);
                const wrapCenter = wrapHeight / 2;
                let targetTranslateY = wrapCenter - lineCenter;
                const minTranslate = wrapHeight - container.scrollHeight;
                const maxTranslate = 0;
                targetTranslateY = Math.max(minTranslate, Math.min(maxTranslate, targetTranslateY));
                container.style.transform = `translateY(${targetTranslateY.toFixed(2)}px)`;
            } catch (_) { /* noop */ }
        }
    });
}

/** 从自己往上找第一个「内容真的超出、且 overflow 允许滚」的元素 */
function _findScroller(el) {
    let node = el;
    let guard = 0;
    while (node && guard < 4) {
        guard += 1;
        const style = getComputedStyle(node);
        const canScroll = /(auto|scroll|overlay)/.test(style.overflowY);
        if (canScroll && node.scrollHeight > node.clientHeight + 2) return node;
        node = node.parentElement;
    }
    return null;
}

/**
 * 一站式更新:同步 progress + play 按钮 + 歌词(给业务 methods 调,比如 nextSong 之后)
 */
export function syncAllPlayUi(state) {
    if (!state) return;
    updateAllProgressBars(state);
    updateAllPlayButtons(state);
    updateLyrics(state);
}
