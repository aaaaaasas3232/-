/**
 * music-app · services/audio-service.js
 * Audio 单例 + 事件回调 + 播放状态机。
 *
 * 步骤 2:Audio 单例 + 事件回调 + 基础播放控制
 * 步骤 4:补全 timeupdate / ended / 进度条同步
 * 步骤 5:接灵动岛 island helper
 * 步骤 10(v0.83):对齐原型 progress 0~100 整数;补 updateAllProgressBars /
 *   updateAllPlayButtons / updateLyrics DOM 同步;idle timer / 一键应用 to island
 *
 * 特性:无 URL 时自动切换到模拟播放模式
 *
 * ★ v0.83 重大修改:
 *   1. state.progress 改为 0~100 整数(对齐原型,避免 player-page 还要 *100)
 *   2. audio.currentTime → state.currentTime 同步;
 *      state.progress = (currentTime / duration) * 100
 *   3. 新增 updateAllProgressBars / updateAllPlayButtons / updateLyrics
 *      三个工具函数,在 timeupdate / play / pause 事件中触发,
 *      让 player-page + 灵动岛 + tab-bar 全部联动更新
 *   4. 模拟模式下进度条靠 setInterval 累加(对齐 prototype)
 *   5. 与 island helper 配合:模拟/真实播放时同步触发灵动岛刷新
 */

import { saveMusicSnapshot } from '../state.js';
import { updateAllProgressBars, updateAllPlayButtons, updateLyrics } from '../components/dom-sync.js';

// ============================================================================
// Audio 单例
// ============================================================================

let _audio = null;
const _listeners = new Set();
let _stateRef = null; // 引用 app.state.music(在 init 时传入,固定)
let _simulatedPlay = false; // 模拟模式
let _simulatedTime = 0;
let _simulatedDuration = 180;
let _simulatedTimer = null;
let _currentSongUrl = null; // 记录当前歌曲 URL
let _onSongEndedCallback = null; // 歌曲结束回调(prototype playNextSong)
let _playToken = 0; // 播放请求令牌:被新请求取代的旧 promise 不得再改状态
// 切歌期间浏览器会为"旧 src 被换掉"补发一次 pause 事件,那不是用户暂停,
// 不能让它触发灵动岛的闲置收岛计时器。
let _switchingSong = false;
let _switchingTimer = null;

function _beginSongSwitch() {
    _switchingSong = true;
    if (_switchingTimer) clearTimeout(_switchingTimer);
    _switchingTimer = setTimeout(() => {
        _switchingTimer = null;
        _switchingSong = false;
    }, 1200);
}

function _endSongSwitch() {
    if (_switchingTimer) {
        clearTimeout(_switchingTimer);
        _switchingTimer = null;
    }
    _switchingSong = false;
}

/**
 * 统一处理 audio.play() 的 rejection。
 * ★ 关键:AbortError 只表示"这次播放被更新的 load/pause 取代",是快速连点时的正常现象,
 *   绝不能当成故障去降级到无声的模拟播放(否则一旦触发就再也回不到真实音频)。
 *   NotAllowedError(自动播放被拦)也只需标记为暂停,保留真实 URL 等用户再点一次。
 */
function _handlePlayRejection(err, token) {
    if (token !== _playToken) return; // 已被新请求取代,忽略
    const name = err?.name;
    if (name === 'AbortError') {
        return; // 正常竞态,什么都不做
    }
    if (name === 'NotAllowedError') {
        console.warn('[music] 浏览器拦截了自动播放,请再点一次播放按钮。');
        if (_stateRef) _stateRef.isPlaying = false;
        updateAllPlayButtons(_stateRef);
        return; // 保留 _currentSongUrl,下次点击仍走真实音频
    }
    console.warn('[music] 播放失败 → 降级为无声的模拟播放。', name, err?.message);
    _currentSongUrl = null;
    _startSimulatedPlay();
}

function _getAudio() {
    if (typeof window === 'undefined') return null;
    if (!_audio) {
        _audio = new Audio();
        _audio.preload = 'metadata';
        _audio.volume = 0.8;
    }
    return _audio;
}

// 检测是否需要模拟模式（URL 无效或加载失败过）
function _isSimulatedMode() {
    return !_currentSongUrl || _currentSongUrl.trim() === '';
}

// 计算 state.progress 0~100
function _calcProgress(time, duration) {
    if (!Number.isFinite(duration) || duration <= 0) return 0;
    const pct = (time / duration) * 100;
    return Math.max(0, Math.min(100, pct));
}

// ============================================================================
// 模拟播放（虚假模式，不依赖真实音频）
// ============================================================================

function _startSimulatedPlay() {
    if (_simulatedTimer) clearInterval(_simulatedTimer);
    _simulatedPlay = true;
    if (_simulatedTime === 0 && _stateRef?.currentSong) {
        // 第一次启动 → 从 0 开始
    }
    if (_stateRef) {
        _stateRef.isPlaying = true;
        _stateRef.duration = _simulatedDuration;
        _stateRef.progress = _calcProgress(_simulatedTime, _simulatedDuration);
        _emit('play', {});
    }
    updateAllPlayButtons(_stateRef);
    updateAllProgressBars(_stateRef);
    _simulatedTimer = setInterval(() => {
        if (_simulatedPlay && _stateRef) {
            _simulatedTime += 1;
            _stateRef.currentTime = _simulatedTime;
            _stateRef.progress = _calcProgress(_simulatedTime, _simulatedDuration);
            _emit('timeupdate', {
                currentTime: _simulatedTime,
                duration: _simulatedDuration,
                progress: _stateRef.progress,
            });
            // DOM 同步(prototype updateAllProgressBars + updateLyrics)
            updateAllProgressBars(_stateRef);
            updateLyrics(_stateRef);
            // 模拟播放结束
            if (_simulatedTime >= _simulatedDuration) {
                _simulatedTime = 0;
                _stateRef.currentTime = 0;
                _stateRef.progress = 0;
                _stopSimulatedPlay();
                _emit('ended', {});
                // prototype 行为:模拟模式结束 → 切下一首(由回调实现)
                if (typeof _onSongEndedCallback === 'function') {
                    try { _onSongEndedCallback(); } catch (_) { /* noop */ }
                }
            }
        }
    }, 1000);
}

function _stopSimulatedPlay() {
    const wasSimulating = _simulatedPlay;
    if (_simulatedTimer) {
        clearInterval(_simulatedTimer);
        _simulatedTimer = null;
    }
    _simulatedPlay = false;
    // ★ 只有真的从"模拟播放中"停下来才算一次暂停。
    //   playSong 每次都会先调本函数清场,若无条件 emit('pause'),
    //   每次切歌都会伪造一次暂停事件 → 灵动岛的 60s 闲置计时器被误启动。
    if (!wasSimulating) return;
    if (_stateRef) {
        _stateRef.isPlaying = false;
    }
    _emit('pause', {});
    updateAllPlayButtons(_stateRef);
}

// ============================================================================
// 初始化
// ============================================================================

export function initAudioService(state, opts = {}) {
    if (!state) {
        console.error('[audio] initAudioService: state is null!');
        return;
    }
    // ★ 固定引用 — hydrate 阶段调用一次,后续 _stateRef 就是这个对象
    _stateRef = state;
    _onSongEndedCallback = opts.onSongEnded || null;
    const audio = _getAudio();
    if (!audio) return null;

    audio.addEventListener('timeupdate', () => {
        if (_isSimulatedMode()) return;
        const s = _stateRef;
        if (!s) return;
        s.currentTime = audio.currentTime;
        s.duration = audio.duration || s.duration || 180;
        s.progress = _calcProgress(audio.currentTime, s.duration);
        _emit('timeupdate', {
            currentTime: s.currentTime,
            duration: s.duration,
            progress: s.progress,
        });
        // DOM 同步
        updateAllProgressBars(s);
        updateLyrics(s);
        // 播放中每秒校正一次播放图标/波形:任何原因导致的 DOM 错乱都能自愈
        updateAllPlayButtons(s);
    });

    audio.addEventListener('play', () => {
        if (_isSimulatedMode()) return;
        _endSongSwitch();
        if (_stateRef) _stateRef.isPlaying = true;
        _emit('play', {});
        updateAllPlayButtons(_stateRef);
    });

    audio.addEventListener('pause', () => {
        if (_isSimulatedMode()) return;
        if (_switchingSong) return; // 切歌带来的假暂停
        if (_stateRef) _stateRef.isPlaying = false;
        _emit('pause', {});
        updateAllPlayButtons(_stateRef);
    });

    audio.addEventListener('ended', () => {
        if (_isSimulatedMode()) return;
        if (_stateRef) _stateRef.isPlaying = false;
        _emit('ended', {});
        updateAllPlayButtons(_stateRef);
        if (typeof _onSongEndedCallback === 'function') {
            try { _onSongEndedCallback(); } catch (_) { /* noop */ }
        }
    });

    audio.addEventListener('error', () => {
        const err = audio.error;
        // MEDIA_ERR_ABORTED:切歌/重新 load 导致的中止,不是故障,忽略
        if (!err || err.code === 1) return;
        // 没有 src 时浏览器也会抛 error,同样忽略
        if (!audio.currentSrc && !audio.src) return;
        const codeMap = {
            2: 'NETWORK(网络错误/跨域被拒)',
            3: 'DECODE(解码失败)',
            4: 'SRC_NOT_SUPPORTED(URL 无效或返回的不是音频)',
        };
        console.warn(
            '[music] 音频加载失败 → 降级为无声的模拟播放。'
            + ' url=' + _currentSongUrl
            + ' reason=' + (codeMap[err.code] || ('code=' + err.code)),
        );
        _stopSimulatedPlay();
        _currentSongUrl = null;
        if (_stateRef?.currentSong) {
            _startSimulatedPlay();
        }
    });

    audio.addEventListener('loadedmetadata', () => {
        if (_stateRef) {
            _simulatedDuration = audio.duration || 180;
            _stateRef.duration = _simulatedDuration;
        }
        _emit('loadedmetadata', { duration: audio.duration });
    });

    return audio;
}

// ============================================================================
// 事件订阅
// ============================================================================

export function onAudioEvent(cb) {
    if (typeof cb !== 'function') return () => {};
    _listeners.add(cb);
    return () => _listeners.delete(cb);
}

function _emit(eventName, payload) {
    for (const cb of _listeners) {
        try { cb(eventName, payload); } catch (e) { /* noop */ }
    }
}

// ============================================================================
// 播放控制
// ============================================================================

export function getAudio() {
    return _getAudio();
}

/** 只设置当前歌曲，不播放 */
export function setCurrentSong(song) {
    if (!song) return;
    if (_stateRef) {
        // ★ v0.83 fix:保留现有 currentSong 的 lyrics，只更新其他字段
        // 避免 audio-service 覆盖掉 index.js 已 enrich 的 lyrics
        const existingSong = _stateRef.currentSong;
        _stateRef.currentSong = {
            ...song,
            // 保留现有歌词（index.js 可能已通过 getSongLyrics enrich）
            lyrics: (existingSong?.lyrics && existingSong?.lyrics?.length)
                ? existingSong.lyrics
                : song.lyrics,
        };
        _stateRef.currentTime = 0;
        _stateRef.duration = song.duration || 180;
        _stateRef.progress = 0;
        _simulatedTime = 0;
        _simulatedDuration = song.duration || 180;
    }
    _currentSongUrl = song.url || null;
}

export function playSong(song) {
    if (!song) return false;
    const audio = _getAudio();

    // 设置歌曲信息(prototype 行为)
    // ★ v0.83 fix:保留现有 currentSong 的 lyrics，只更新其他字段
    // 避免 audio-service 覆盖掉 index.js 已 enrich 的 lyrics
    if (_stateRef) {
        const existingSong = _stateRef.currentSong;
        _stateRef.currentSong = {
            ...song,
            lyrics: (existingSong?.lyrics && existingSong?.lyrics?.length)
                ? existingSong.lyrics
                : song.lyrics,
        };
        _stateRef.currentTime = 0;
        _stateRef.duration = song.duration || 180;
        _stateRef.progress = 0;
        _simulatedDuration = song.duration || 180;
    }
    _simulatedTime = 0;
    // 记录 URL
    _currentSongUrl = song.url || null;

    // 先停止模拟播放
    _stopSimulatedPlay();

    // 尝试加载真实音频
    if (song.url && song.url.trim()) {
        const token = ++_playToken;
        _beginSongSwitch();
        audio.src = song.url;
        audio.load();
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.then(() => {
                if (token !== _playToken) return;
                if (_stateRef) _stateRef.isPlaying = true;
                _emit('play', {});
                updateAllPlayButtons(_stateRef);
            }).catch((err) => _handlePlayRejection(err, token));
        }
    } else {
        // 无 URL，直接进入模拟模式。
        // ★ 先把真实 audio 停掉:否则从"有 url 的歌"切到"没 url 的歌"时，
        //   旧音频还在响，界面却在跑模拟进度。
        _currentSongUrl = null;
        if (audio && (audio.src || audio.currentSrc)) {
            try {
                audio.pause();
                audio.removeAttribute('src');
                audio.load();
            } catch (_) { /* noop */ }
        }
        _startSimulatedPlay();
    }

    return true;
}

export function pauseSong() {
    const audio = _getAudio();
    _endSongSwitch(); // 用户明确暂停:后续 pause 事件是真的
    if (_isSimulatedMode()) {
        _stopSimulatedPlay();
        return true;
    }
    if (!audio) return false;
    audio.pause();
    return true;
}

export function resumeSong() {
    const audio = _getAudio();
    // ★ 关键修复:模拟模式是"单向陷阱"——一旦出过错 _currentSongUrl 被置空,
    //   之后所有播放都是无声的假播放。这里先尝试用 currentSong.url 恢复真实音频。
    if (_isSimulatedMode()) {
        const realUrl = _stateRef?.currentSong?.url;
        if (realUrl && realUrl.trim()) {
            console.warn('[music] 从模拟模式恢复真实音频播放:', realUrl);
            _stopSimulatedPlay();
            _currentSongUrl = realUrl;
            const resumeAt = Number.isFinite(_stateRef?.currentTime) ? _stateRef.currentTime : 0;
            if (!audio) return false;
            const token = ++_playToken;
            if (audio.src !== realUrl) {
                _beginSongSwitch();
                audio.src = realUrl;
                audio.load();
            }
            const p = audio.play();
            if (p && typeof p.then === 'function') {
                p.then(() => {
                    if (token !== _playToken) return;
                    if (resumeAt > 0 && Number.isFinite(audio.duration)) {
                        try { audio.currentTime = Math.min(resumeAt, audio.duration); } catch (_) { /* noop */ }
                    }
                    if (_stateRef) _stateRef.isPlaying = true;
                    _emit('play', {});
                    updateAllPlayButtons(_stateRef);
                }).catch((err) => _handlePlayRejection(err, token));
            }
            return true;
        }
        // 确实没有可用 URL(比如内置的无 url 歌曲)→ 保持模拟播放
        _startSimulatedPlay();
        return true;
    }
    if (!audio) return false;
    const token = ++_playToken;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.then(() => {
            if (token !== _playToken) return;
            if (_stateRef) _stateRef.isPlaying = true;
            _emit('play', {});
            updateAllPlayButtons(_stateRef);
        }).catch((err) => _handlePlayRejection(err, token));
    }
    return true;
}

export function togglePlay() {
    if (!_stateRef) {
        console.warn('[audio] togglePlay: _stateRef is null, aborting');
        return false;
    }
    if (_isSimulatedMode()) {
        if (_simulatedPlay) {
            _stopSimulatedPlay();
        } else {
            // 走 resumeSong:它会先尝试恢复真实音频,不行才退回模拟播放
            resumeSong();
        }
        return true;
    }
    const audio = _getAudio();
    if (!audio) return false;
    if (audio.paused) {
        return resumeSong();
    } else {
        return pauseSong();
    }
}

export function seekTo(percentage) {
    if (_isSimulatedMode()) {
        if (!Number.isFinite(percentage)) return false;
        const pct = Math.max(0, Math.min(100, percentage));
        _simulatedTime = Math.floor((pct / 100) * _simulatedDuration);
        if (_stateRef) {
            _stateRef.currentTime = _simulatedTime;
            _stateRef.progress = pct;
        }
        updateAllProgressBars(_stateRef);
        updateLyrics(_stateRef);
        return true;
    }
    const audio = _getAudio();
    if (!audio) return false;
    if (!Number.isFinite(percentage)) return false;
    const pct = Math.max(0, Math.min(100, percentage));
    if (audio.duration && Number.isFinite(audio.duration)) {
        audio.currentTime = (pct / 100) * audio.duration;
    }
    return true;
}

export function seekToTime(seconds) {
    if (_isSimulatedMode()) {
        if (!Number.isFinite(seconds)) return false;
        _simulatedTime = Math.max(0, Math.floor(seconds));
        if (_stateRef) {
            _stateRef.currentTime = _simulatedTime;
            _stateRef.progress = _calcProgress(_simulatedTime, _simulatedDuration);
        }
        updateAllProgressBars(_stateRef);
        updateLyrics(_stateRef);
        return true;
    }
    const audio = _getAudio();
    if (!audio) return false;
    if (!Number.isFinite(seconds)) return false;
    audio.currentTime = Math.max(0, seconds);
    return true;
}

export function setVolume(vol) {
    const audio = _getAudio();
    if (!audio) return false;
    audio.volume = Math.max(0, Math.min(1, vol));
    return true;
}

export function getCurrentTime() {
    if (_isSimulatedMode()) {
        return _simulatedTime;
    }
    return _getAudio()?.currentTime || 0;
}

export function getDuration() {
    if (_isSimulatedMode()) {
        return _simulatedDuration;
    }
    return _getAudio()?.duration || 0;
}

export function isPlaying() {
    if (_isSimulatedMode()) {
        return _simulatedPlay;
    }
    return _getAudio() ? !_getAudio().paused : false;
}

// ============================================================================
// Idle timer
// ============================================================================

let _idleTimer = null;

export function startIdleTimer(timeoutMs = 60000, onTimeout) {
    if (_idleTimer) clearTimeout(_idleTimer);
    _idleTimer = setTimeout(() => {
        _idleTimer = null;
        if (typeof onTimeout === 'function') {
            try { onTimeout(); } catch (_) { /* noop */ }
        }
    }, timeoutMs);
}

export function clearIdleTimer() {
    if (_idleTimer) {
        clearTimeout(_idleTimer);
        _idleTimer = null;
    }
}

export function isIdleTimerRunning() {
    return _idleTimer !== null;
}

// ============================================================================
// 持久化
// ============================================================================

export function persistCurrentState() {
    if (_stateRef) {
        try { saveMusicSnapshot(_stateRef); } catch (_) { /* noop */ }
    }
}

/**
 * 注册"歌曲结束"回调(prototype playNextSong 行为)。
 * 由 index.js 在 hydrate 时注入:_onSongEndedCallback = () => this.nextSong()
 */
export function setOnSongEndedCallback(cb) {
    _onSongEndedCallback = typeof cb === 'function' ? cb : null;
}

/**
 * 暴露 state ref(给 dom-sync.js 用,但其实 dom-sync.js 只读 state 即可,不需要 ref)
 */
export function getStateRef() {
    return _stateRef;
}
