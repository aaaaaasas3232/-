/**
 * relax-app / 音声服务
 *
 * 设计取舍:内置音**全部用 Web Audio 现场合成**,不带任何音频文件。
 *   - 单文件构建(vite-plugin-singlefile)不会因为二进制资源膨胀 / 丢资源
 *   - 每次触发都能带随机微扰(音高 / 音色),连点 30 下不会像复读机
 *   - 想加新音只要写一个 20 行的合成函数
 *
 * 用户自定义音走另一条路:上传文件 → dataURL 存 IndexedDB → decodeAudioData 缓存 buffer。
 *
 * 对外 API:
 *   ensureAudioContext()                     解锁/获取 AudioContext(需在用户手势里首次调用)
 *   listSoundPresets()                       内置音清单
 *   playSoundPreset(id, opts)                播内置音
 *   playCustomSound(record, opts)            播自定义音(record = {id, dataUrl})
 *   playSoundConfig(soundConfig, customRec)  按 scene.sound 配置播(UI/主体的统一入口)
 *   haptic(strength)                         震动
 *   disposeCustomSound(id)                   丢掉某条自定义音的解码缓存
 */

let _ctx = null;
/** 自定义音的解码缓存:id → AudioBuffer */
const _bufferCache = new Map();
/** 正在解码中的 promise,防同一条音并发解码 N 次 */
const _decoding = new Map();

/**
 * 拿 AudioContext。首次必须在用户手势(pointerdown/click)里调,否则被自动播放策略挂起。
 * 已挂起的 context 会尝试 resume。
 */
export function ensureAudioContext() {
    if (typeof window === 'undefined') return null;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;

    if (!_ctx) {
        try {
            _ctx = new Ctor();
        } catch (err) {
            console.warn('[relax/sound] AudioContext 创建失败', err);
            return null;
        }
    }
    if (_ctx.state === 'suspended') {
        // resume 是异步的,但合成音本来就允许在 resume 完成前后一两帧内触发
        _ctx.resume().catch(() => {});
    }
    return _ctx;
}

// ============================================================
// 合成基元
// ============================================================

/** 随机微扰:让连击不机械 */
function jitter(base, amount) {
    return base * (1 + (Math.random() * 2 - 1) * amount);
}

/** 一段白噪声 buffer(带缓存,按时长复用) */
const _noiseCache = new Map();
function noiseBuffer(ctx, seconds) {
    const key = seconds.toFixed(3);
    if (_noiseCache.has(key)) return _noiseCache.get(key);
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
        data[i] = Math.random() * 2 - 1;
    }
    _noiseCache.set(key, buffer);
    return buffer;
}

/** 建一条 出口链:gain → (pan) → destination */
function createOutput(ctx, gain, pan = 0) {
    const gainNode = ctx.createGain();
    gainNode.gain.value = gain;
    if (pan && ctx.createStereoPanner) {
        const panner = ctx.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, pan));
        gainNode.connect(panner);
        panner.connect(ctx.destination);
    } else {
        gainNode.connect(ctx.destination);
    }
    return gainNode;
}

// ============================================================
// 内置音合成函数
// 每个函数签名: (ctx, out, { rate }) => void
// `out` 已经接好音量/声场,只管往里接节点
// ============================================================

/** 泡泡破:正弦快速升调 + 极短噪声咔哒 */
function synthPopSoft(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(jitter(360, 0.12) * rate, t);
    osc.frequency.exponentialRampToValueAtTime(jitter(1150, 0.1) * rate, t + 0.055);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.9, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    osc.connect(env);
    env.connect(out);
    osc.start(t);
    osc.stop(t + 0.16);

    const click = ctx.createBufferSource();
    const clickEnv = ctx.createGain();
    const hp = ctx.createBiquadFilter();
    click.buffer = noiseBuffer(ctx, 0.03);
    hp.type = 'highpass';
    hp.frequency.value = 2200;
    clickEnv.gain.setValueAtTime(0.35, t);
    clickEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    click.connect(hp);
    hp.connect(clickEnv);
    clickEnv.connect(out);
    click.start(t);
}

/** 脆响泡泡:方波 + 高通,更「啪」 */
function synthPopCrisp(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const hp = ctx.createBiquadFilter();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(jitter(760, 0.14) * rate, t);
    osc.frequency.exponentialRampToValueAtTime(jitter(180, 0.12) * rate, t + 0.07);
    hp.type = 'highpass';
    hp.frequency.value = 420;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1, t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);
    osc.connect(hp);
    hp.connect(env);
    env.connect(out);
    osc.start(t);
    osc.stop(t + 0.1);
}

/** 捏软糖:带通噪声下扫,闷闷的「咕唧」 */
function synthSquish(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    const bp = ctx.createBiquadFilter();
    const env = ctx.createGain();
    src.buffer = noiseBuffer(ctx, 0.4);
    bp.type = 'bandpass';
    bp.Q.value = 3.5;
    bp.frequency.setValueAtTime(jitter(900, 0.15) * rate, t);
    bp.frequency.exponentialRampToValueAtTime(jitter(240, 0.15) * rate, t + 0.22);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.65, t + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    src.connect(bp);
    bp.connect(env);
    env.connect(out);
    src.start(t);
    src.stop(t + 0.3);
}

/** 脆皮碎裂:一串随机噪声颗粒 */
function synthCrinkle(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const grains = 7 + Math.floor(Math.random() * 5);
    for (let i = 0; i < grains; i += 1) {
        const at = t + Math.random() * 0.16;
        const src = ctx.createBufferSource();
        const hp = ctx.createBiquadFilter();
        const env = ctx.createGain();
        src.buffer = noiseBuffer(ctx, 0.02);
        hp.type = 'highpass';
        hp.frequency.value = jitter(3200, 0.35) * rate;
        env.gain.setValueAtTime(0.0001, at);
        env.gain.exponentialRampToValueAtTime(0.1 + Math.random() * 0.3, at + 0.003);
        env.gain.exponentialRampToValueAtTime(0.0001, at + 0.02);
        src.connect(hp);
        hp.connect(env);
        env.connect(out);
        src.start(at);
    }
}

/** 水泡:正弦上滑 + 轻微颤音 */
function synthBubbleWater(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(jitter(240, 0.16) * rate, t);
    osc.frequency.exponentialRampToValueAtTime(jitter(680, 0.12) * rate, t + 0.16);
    lfo.type = 'sine';
    lfo.frequency.value = 28;
    lfoGain.gain.value = 40;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.7, t + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(env);
    env.connect(out);
    lfo.start(t);
    osc.start(t);
    osc.stop(t + 0.25);
    lfo.stop(t + 0.25);
}

/** 木鱼:短促木质敲击 */
function synthWoodBlock(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const bp = ctx.createBiquadFilter();
    osc.type = 'square';
    osc.frequency.setValueAtTime(jitter(420, 0.08) * rate, t);
    bp.type = 'bandpass';
    bp.frequency.value = jitter(1100, 0.1) * rate;
    bp.Q.value = 6;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.85, t + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    osc.connect(bp);
    bp.connect(env);
    env.connect(out);
    osc.start(t);
    osc.stop(t + 0.14);
}

/** 风铃:三音叠加,长尾 */
function synthChimeBell(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const base = jitter(1180, 0.06) * rate;
    [1, 1.5, 2.02].forEach((ratio, index) => {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = base * ratio;
        const peak = 0.5 / (index + 1);
        env.gain.setValueAtTime(0.0001, t);
        env.gain.exponentialRampToValueAtTime(peak, t + 0.01);
        env.gain.exponentialRampToValueAtTime(0.0001, t + 1.1 - index * 0.22);
        osc.connect(env);
        env.connect(out);
        osc.start(t);
        osc.stop(t + 1.2);
    });
}

/** 沙沙:低幅长噪声,适合做「摩擦」类主体 */
function synthSand(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    const hp = ctx.createBiquadFilter();
    const env = ctx.createGain();
    src.buffer = noiseBuffer(ctx, 0.5);
    hp.type = 'highpass';
    hp.frequency.value = jitter(1800, 0.2) * rate;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.3, t + 0.05);
    env.gain.linearRampToValueAtTime(0.0001, t + 0.34);
    src.connect(hp);
    hp.connect(env);
    env.connect(out);
    src.start(t);
    src.stop(t + 0.4);
}

/** 果冻:低频正弦「咚」+ 轻微回弹 */
function synthJelly(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(jitter(180, 0.1) * rate, t);
    osc.frequency.exponentialRampToValueAtTime(jitter(96, 0.1) * rate, t + 0.18);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.95, t + 0.012);
    env.gain.exponentialRampToValueAtTime(0.18, t + 0.1);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(env);
    env.connect(out);
    osc.start(t);
    osc.stop(t + 0.34);
}

// ------------------------------------------------------------
// 扩充音色
// 前面几条偏「捏捏」,下面这批偏「界面反馈 / 玩味」——
// 短、干、不拖尾的放前面,适合当点击音。
// ------------------------------------------------------------

/** 轻点:极短的高频 tick,专门给界面点击用 */
function synthClickTick(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    const bp = ctx.createBiquadFilter();
    const env = ctx.createGain();
    src.buffer = noiseBuffer(ctx, 0.012);
    bp.type = 'bandpass';
    bp.frequency.value = jitter(2600, 0.12) * rate;
    bp.Q.value = 2.4;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.7, t + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.028);
    src.connect(bp);
    bp.connect(env);
    env.connect(out);
    src.start(t);
}

/** 键帽:机械键盘那种「嗒」,下压 + 触底两段 */
function synthKeyCap(ctx, out, { rate }) {
    const t = ctx.currentTime;
    [[0, 0.62, 1500], [0.022, 0.4, 950]].forEach(([delay, peak, freq]) => {
        const src = ctx.createBufferSource();
        const bp = ctx.createBiquadFilter();
        const env = ctx.createGain();
        const at = t + delay;
        src.buffer = noiseBuffer(ctx, 0.02);
        bp.type = 'bandpass';
        bp.frequency.value = jitter(freq, 0.1) * rate;
        bp.Q.value = 4;
        env.gain.setValueAtTime(0.0001, at);
        env.gain.exponentialRampToValueAtTime(peak, at + 0.002);
        env.gain.exponentialRampToValueAtTime(0.0001, at + 0.035);
        src.connect(bp);
        bp.connect(env);
        env.connect(out);
        src.start(at);
    });
}

/** 叩玻璃:明亮短促的 ping,带一点点尾巴 */
function synthGlassTap(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const base = jitter(1850, 0.08) * rate;
    [1, 2.76].forEach((ratio, index) => {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = base * ratio;
        env.gain.setValueAtTime(0.0001, t);
        env.gain.exponentialRampToValueAtTime(index === 0 ? 0.6 : 0.22, t + 0.004);
        env.gain.exponentialRampToValueAtTime(0.0001, t + (index === 0 ? 0.34 : 0.16));
        osc.connect(env);
        env.connect(out);
        osc.start(t);
        osc.stop(t + 0.4);
    });
}

/** 水滴:高频快速下滑 + 短共鸣,滴答一声 */
function synthWaterDrop(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(jitter(1400, 0.12) * rate, t);
    osc.frequency.exponentialRampToValueAtTime(jitter(430, 0.12) * rate, t + 0.09);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.8, t + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(env);
    env.connect(out);
    osc.start(t);
    osc.stop(t + 0.24);
}

/** 马林巴:温暖的木琴音,基频 + 四倍泛音 */
function synthMarimba(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const base = jitter(520, 0.06) * rate;
    [[1, 0.7, 0.46], [4, 0.16, 0.14]].forEach(([ratio, peak, tail]) => {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = base * ratio;
        env.gain.setValueAtTime(0.0001, t);
        env.gain.exponentialRampToValueAtTime(peak, t + 0.006);
        env.gain.exponentialRampToValueAtTime(0.0001, t + tail);
        osc.connect(env);
        env.connect(out);
        osc.start(t);
        osc.stop(t + 0.5);
    });
}

/** 硬币:两个音先后叮一下,像掉进存钱罐 */
function synthCoin(ctx, out, { rate }) {
    const t = ctx.currentTime;
    [[0, 1050], [0.07, 1560]].forEach(([delay, freq]) => {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        const at = t + delay;
        osc.type = 'square';
        osc.frequency.value = jitter(freq, 0.04) * rate;
        env.gain.setValueAtTime(0.0001, at);
        env.gain.exponentialRampToValueAtTime(0.32, at + 0.004);
        env.gain.exponentialRampToValueAtTime(0.0001, at + 0.13);
        osc.connect(env);
        env.connect(out);
        osc.start(at);
        osc.stop(at + 0.16);
    });
}

/** 星星:四个音的快速上行琶音,亮晶晶 */
function synthStarTwinkle(ctx, out, { rate }) {
    const t = ctx.currentTime;
    [0, 4, 7, 12].forEach((semitone, index) => {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        const at = t + index * 0.045;
        osc.type = 'triangle';
        osc.frequency.value = jitter(880, 0.03) * rate * Math.pow(2, semitone / 12);
        env.gain.setValueAtTime(0.0001, at);
        env.gain.exponentialRampToValueAtTime(0.38, at + 0.006);
        env.gain.exponentialRampToValueAtTime(0.0001, at + 0.26);
        osc.connect(env);
        env.connect(out);
        osc.start(at);
        osc.stop(at + 0.3);
    });
}

/** 弹簧:音高上下摆几下,卡通感 */
function synthBoing(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const base = jitter(300, 0.1) * rate;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 2.1, t + 0.05);
    osc.frequency.exponentialRampToValueAtTime(base * 0.72, t + 0.13);
    osc.frequency.exponentialRampToValueAtTime(base * 1.35, t + 0.21);
    osc.frequency.exponentialRampToValueAtTime(base * 0.9, t + 0.3);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.75, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
    osc.connect(env);
    env.connect(out);
    osc.start(t);
    osc.stop(t + 0.4);
}

/** 翻纸:一小段带通噪声扫过,沙沙的纸感 */
function synthPaperFlip(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    const bp = ctx.createBiquadFilter();
    const env = ctx.createGain();
    src.buffer = noiseBuffer(ctx, 0.2);
    bp.type = 'bandpass';
    bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(jitter(1500, 0.15) * rate, t);
    bp.frequency.exponentialRampToValueAtTime(jitter(4200, 0.15) * rate, t + 0.14);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.42, t + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
    src.connect(bp);
    bp.connect(env);
    env.connect(out);
    src.start(t);
    src.stop(t + 0.2);
}

/** 踩雪:低频噪声颗粒挤压,咯吱一下 */
function synthSnowStep(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const grains = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < grains; i += 1) {
        const at = t + Math.random() * 0.1;
        const src = ctx.createBufferSource();
        const lp = ctx.createBiquadFilter();
        const env = ctx.createGain();
        src.buffer = noiseBuffer(ctx, 0.03);
        lp.type = 'lowpass';
        lp.frequency.value = jitter(1400, 0.3) * rate;
        lp.Q.value = 1.4;
        env.gain.setValueAtTime(0.0001, at);
        env.gain.exponentialRampToValueAtTime(0.16 + Math.random() * 0.3, at + 0.004);
        env.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
        src.connect(lp);
        lp.connect(env);
        env.connect(out);
        src.start(at);
    }
}

/** 肉垫:猫爪按下去那种又软又闷的一下 */
function synthCatPaw(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const oscEnv = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(jitter(220, 0.1) * rate, t);
    osc.frequency.exponentialRampToValueAtTime(jitter(120, 0.1) * rate, t + 0.09);
    oscEnv.gain.setValueAtTime(0.0001, t);
    oscEnv.gain.exponentialRampToValueAtTime(0.55, t + 0.012);
    oscEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(oscEnv);
    oscEnv.connect(out);
    osc.start(t);
    osc.stop(t + 0.2);

    const src = ctx.createBufferSource();
    const lp = ctx.createBiquadFilter();
    const noiseEnv = ctx.createGain();
    src.buffer = noiseBuffer(ctx, 0.06);
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    noiseEnv.gain.setValueAtTime(0.22, t);
    noiseEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    src.connect(lp);
    lp.connect(noiseEnv);
    noiseEnv.connect(out);
    src.start(t);
}

/** 心跳:两下低频闷响 */
function synthHeartbeat(ctx, out, { rate }) {
    const t = ctx.currentTime;
    [[0, 0.9], [0.17, 0.62]].forEach(([delay, peak]) => {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        const at = t + delay;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(jitter(96, 0.08) * rate, at);
        osc.frequency.exponentialRampToValueAtTime(jitter(52, 0.08) * rate, at + 0.12);
        env.gain.setValueAtTime(0.0001, at);
        env.gain.exponentialRampToValueAtTime(peak, at + 0.02);
        env.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
        osc.connect(env);
        env.connect(out);
        osc.start(at);
        osc.stop(at + 0.2);
    });
}

// ------------------------------------------------------------
// 第二批扩充
// 音一多就得分组,所以从这里开始每条都归到 `group` 里(见 SOUND_PRESETS)。
// 环境类(雨 / 风 / 白噪)是**一段一两秒的样本**,不是循环底噪 ——
// 本服务只有「触发一次响一次」的模型,做常驻底噪要另起一套 loop 管理。
// ------------------------------------------------------------

/** 开瓶塞:低频快速下滑 + 一点空腔共鸣,比气泡厚实 */
function synthCorkPop(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(jitter(620, 0.1) * rate, t);
    osc.frequency.exponentialRampToValueAtTime(jitter(140, 0.1) * rate, t + 0.06);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(env);
    env.connect(out);
    osc.start(t);
    osc.stop(t + 0.18);

    const src = ctx.createBufferSource();
    const bp = ctx.createBiquadFilter();
    const noiseEnv = ctx.createGain();
    src.buffer = noiseBuffer(ctx, 0.05);
    bp.type = 'bandpass';
    bp.frequency.value = jitter(900, 0.15) * rate;
    bp.Q.value = 1.8;
    noiseEnv.gain.setValueAtTime(0.3, t);
    noiseEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(bp);
    bp.connect(noiseEnv);
    noiseEnv.connect(out);
    src.start(t);
}

/** 开关咔哒:下压 + 回弹两声,间隔比键帽长一点,更像拨动开关 */
function synthSwitchClack(ctx, out, { rate }) {
    const t = ctx.currentTime;
    [[0, 0.7, 1800, 0.018], [0.055, 0.34, 1150, 0.022]].forEach(([delay, peak, freq, tail]) => {
        const src = ctx.createBufferSource();
        const bp = ctx.createBiquadFilter();
        const env = ctx.createGain();
        const at = t + delay;
        src.buffer = noiseBuffer(ctx, 0.025);
        bp.type = 'bandpass';
        bp.frequency.value = jitter(freq, 0.08) * rate;
        bp.Q.value = 5.5;
        env.gain.setValueAtTime(0.0001, at);
        env.gain.exponentialRampToValueAtTime(peak, at + 0.0018);
        env.gain.exponentialRampToValueAtTime(0.0001, at + tail);
        src.connect(bp);
        bp.connect(env);
        env.connect(out);
        src.start(at);
    });
}

/** 按圆珠笔:一记干脆的塑料咔,尾巴带一丝弹簧 */
function synthPenClick(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    const hp = ctx.createBiquadFilter();
    const env = ctx.createGain();
    src.buffer = noiseBuffer(ctx, 0.015);
    hp.type = 'highpass';
    hp.frequency.value = jitter(3400, 0.12) * rate;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.8, t + 0.0015);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    src.connect(hp);
    hp.connect(env);
    env.connect(out);
    src.start(t);

    const osc = ctx.createOscillator();
    const oscEnv = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(jitter(2100, 0.08) * rate, t);
    osc.frequency.exponentialRampToValueAtTime(jitter(1500, 0.08) * rate, t + 0.04);
    oscEnv.gain.setValueAtTime(0.0001, t);
    oscEnv.gain.exponentialRampToValueAtTime(0.14, t + 0.004);
    oscEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(oscEnv);
    oscEnv.connect(out);
    osc.start(t);
    osc.stop(t + 0.06);
}

/** 棘轮:一串越来越快的小咔,像拧发条 */
function synthRatchet(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const ticks = 7 + Math.floor(Math.random() * 3);
    let at = t;
    for (let i = 0; i < ticks; i += 1) {
        const src = ctx.createBufferSource();
        const bp = ctx.createBiquadFilter();
        const env = ctx.createGain();
        src.buffer = noiseBuffer(ctx, 0.012);
        bp.type = 'bandpass';
        bp.frequency.value = jitter(2400, 0.14) * rate;
        bp.Q.value = 4;
        env.gain.setValueAtTime(0.0001, at);
        env.gain.exponentialRampToValueAtTime(0.5 - i * 0.03, at + 0.0015);
        env.gain.exponentialRampToValueAtTime(0.0001, at + 0.016);
        src.connect(bp);
        bp.connect(env);
        env.connect(out);
        src.start(at);
        // 间隔逐步收窄:匀速一串听着像机枪,收窄才像手拧
        at += 0.055 - i * 0.004;
    }
}

/** 卡林巴:金属簧片被拨一下,基频 + 一个非整数泛音 */
function synthKalimba(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const base = jitter(660, 0.05) * rate;
    [[1, 0.62, 0.72], [3.14, 0.12, 0.2]].forEach(([ratio, peak, tail]) => {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = base * ratio;
        env.gain.setValueAtTime(0.0001, t);
        env.gain.exponentialRampToValueAtTime(peak, t + 0.005);
        env.gain.exponentialRampToValueAtTime(0.0001, t + tail);
        osc.connect(env);
        env.connect(out);
        osc.start(t);
        osc.stop(t + 0.8);
    });
}

/** 台铃:前台那种「叮」,高亮短促但有余韵 */
function synthBellDing(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const base = jitter(2350, 0.05) * rate;
    [[1, 0.5, 0.9], [1.63, 0.2, 0.5], [2.41, 0.1, 0.3]].forEach(([ratio, peak, tail]) => {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = base * ratio;
        env.gain.setValueAtTime(0.0001, t);
        env.gain.exponentialRampToValueAtTime(peak, t + 0.003);
        env.gain.exponentialRampToValueAtTime(0.0001, t + tail);
        osc.connect(env);
        env.connect(out);
        osc.start(t);
        osc.stop(t + 1);
    });
}

/** 沙锤:两下高频噪声甩动,前重后轻 */
function synthShaker(ctx, out, { rate }) {
    const t = ctx.currentTime;
    [[0, 0.55], [0.11, 0.28]].forEach(([delay, peak]) => {
        const src = ctx.createBufferSource();
        const hp = ctx.createBiquadFilter();
        const env = ctx.createGain();
        const at = t + delay;
        src.buffer = noiseBuffer(ctx, 0.1);
        hp.type = 'highpass';
        hp.frequency.value = jitter(5200, 0.12) * rate;
        env.gain.setValueAtTime(0.0001, at);
        env.gain.linearRampToValueAtTime(peak, at + 0.012);
        env.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
        src.connect(hp);
        hp.connect(env);
        env.connect(out);
        src.start(at);
    });
}

/** 气球摩擦:高 Q 带通在噪声上来回扫,吱吱的橡胶感 */
function synthBalloonRub(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    const bp = ctx.createBiquadFilter();
    const env = ctx.createGain();
    const base = jitter(1500, 0.15) * rate;
    src.buffer = noiseBuffer(ctx, 0.45);
    bp.type = 'bandpass';
    bp.Q.value = 14;
    bp.frequency.setValueAtTime(base, t);
    bp.frequency.exponentialRampToValueAtTime(base * 2.4, t + 0.12);
    bp.frequency.exponentialRampToValueAtTime(base * 1.3, t + 0.24);
    bp.frequency.exponentialRampToValueAtTime(base * 2.1, t + 0.36);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.85, t + 0.04);
    env.gain.linearRampToValueAtTime(0.5, t + 0.28);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    src.connect(bp);
    bp.connect(env);
    env.connect(out);
    src.start(t);
    src.stop(t + 0.45);
}

/** 指甲刮:密集高频颗粒往上扫,短而刺 */
function synthNailScratch(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    const hp = ctx.createBiquadFilter();
    const env = ctx.createGain();
    src.buffer = noiseBuffer(ctx, 0.26);
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(jitter(2600, 0.12) * rate, t);
    hp.frequency.exponentialRampToValueAtTime(jitter(7200, 0.12) * rate, t + 0.2);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.34, t + 0.03);
    env.gain.linearRampToValueAtTime(0.18, t + 0.16);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    src.connect(hp);
    hp.connect(env);
    env.connect(out);
    src.start(t);
    src.stop(t + 0.26);
}

/** 皮筋弹:拨一下的「嘣」,音高塌得很快 */
function synthRubberBand(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const env = ctx.createGain();
    const base = jitter(420, 0.12) * rate;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 0.42, t + 0.11);
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3200, t);
    lp.frequency.exponentialRampToValueAtTime(700, t + 0.16);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.5, t + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(lp);
    lp.connect(env);
    env.connect(out);
    osc.start(t);
    osc.stop(t + 0.24);
}

/** 倒水:带通噪声往上走 + 几颗随机气泡 */
function synthWaterPour(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    const bp = ctx.createBiquadFilter();
    const env = ctx.createGain();
    src.buffer = noiseBuffer(ctx, 0.8);
    bp.type = 'bandpass';
    bp.Q.value = 1.6;
    bp.frequency.setValueAtTime(jitter(700, 0.12) * rate, t);
    bp.frequency.exponentialRampToValueAtTime(jitter(1900, 0.12) * rate, t + 0.6);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.4, t + 0.08);
    env.gain.linearRampToValueAtTime(0.28, t + 0.5);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.72);
    src.connect(bp);
    bp.connect(env);
    env.connect(out);
    src.start(t);
    src.stop(t + 0.8);

    for (let i = 0; i < 5; i += 1) {
        const at = t + 0.08 + Math.random() * 0.5;
        const osc = ctx.createOscillator();
        const blip = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(jitter(520, 0.3) * rate, at);
        osc.frequency.exponentialRampToValueAtTime(jitter(1100, 0.3) * rate, at + 0.05);
        blip.gain.setValueAtTime(0.0001, at);
        blip.gain.exponentialRampToValueAtTime(0.16, at + 0.006);
        blip.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
        osc.connect(blip);
        blip.connect(out);
        osc.start(at);
        osc.stop(at + 0.08);
    }
}

/** 鸟鸣:两三声快速上下滑的短哨音 */
function synthBirdChirp(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const chirps = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < chirps; i += 1) {
        const at = t + i * (0.11 + Math.random() * 0.05);
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        const base = jitter(2600, 0.1) * rate;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(base, at);
        osc.frequency.exponentialRampToValueAtTime(base * 1.7, at + 0.035);
        osc.frequency.exponentialRampToValueAtTime(base * 0.9, at + 0.075);
        env.gain.setValueAtTime(0.0001, at);
        env.gain.exponentialRampToValueAtTime(0.4, at + 0.008);
        env.gain.exponentialRampToValueAtTime(0.0001, at + 0.08);
        osc.connect(env);
        env.connect(out);
        osc.start(at);
        osc.stop(at + 0.1);
    }
}

/** 虫鸣:高频正弦被快速振幅调制,一段一段地唧 */
function synthCricket(ctx, out, { rate }) {
    const t = ctx.currentTime;
    for (let i = 0; i < 3; i += 1) {
        const at = t + i * 0.17;
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = jitter(4600, 0.06) * rate;
        env.gain.setValueAtTime(0.0001, at);
        // 一段唧声里再切 5 个小颗粒,才有「翅膀摩擦」的颗粒感
        for (let k = 0; k < 5; k += 1) {
            const kt = at + k * 0.012;
            env.gain.exponentialRampToValueAtTime(0.26, kt + 0.003);
            env.gain.exponentialRampToValueAtTime(0.02, kt + 0.01);
        }
        env.gain.exponentialRampToValueAtTime(0.0001, at + 0.08);
        osc.connect(env);
        env.connect(out);
        osc.start(at);
        osc.stop(at + 0.1);
    }
}

/** 雨声:一段带通噪声底 + 若干随机雨滴 */
function synthRain(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const dur = 1.8;
    const src = ctx.createBufferSource();
    const hp = ctx.createBiquadFilter();
    const lp = ctx.createBiquadFilter();
    const env = ctx.createGain();
    src.buffer = noiseBuffer(ctx, dur);
    hp.type = 'highpass';
    hp.frequency.value = 900 * rate;
    lp.type = 'lowpass';
    lp.frequency.value = 6500 * rate;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.34, t + 0.25);
    env.gain.linearRampToValueAtTime(0.3, t + dur - 0.35);
    env.gain.linearRampToValueAtTime(0.0001, t + dur);
    src.connect(hp);
    hp.connect(lp);
    lp.connect(env);
    env.connect(out);
    src.start(t);
    src.stop(t + dur);

    for (let i = 0; i < 14; i += 1) {
        const at = t + 0.1 + Math.random() * (dur - 0.4);
        const drop = ctx.createBufferSource();
        const bp = ctx.createBiquadFilter();
        const dropEnv = ctx.createGain();
        drop.buffer = noiseBuffer(ctx, 0.02);
        bp.type = 'bandpass';
        bp.frequency.value = jitter(3200, 0.4) * rate;
        bp.Q.value = 6;
        dropEnv.gain.setValueAtTime(0.0001, at);
        dropEnv.gain.exponentialRampToValueAtTime(0.05 + Math.random() * 0.12, at + 0.002);
        dropEnv.gain.exponentialRampToValueAtTime(0.0001, at + 0.02);
        drop.connect(bp);
        bp.connect(dropEnv);
        dropEnv.connect(out);
        drop.start(at);
    }
}

/** 海浪:低通噪声慢慢涨上来再退下去,一个来回 */
function synthOceanWave(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const dur = 2.4;
    const src = ctx.createBufferSource();
    const lp = ctx.createBiquadFilter();
    const env = ctx.createGain();
    src.buffer = noiseBuffer(ctx, dur);
    lp.type = 'lowpass';
    lp.Q.value = 0.8;
    lp.frequency.setValueAtTime(420 * rate, t);
    lp.frequency.exponentialRampToValueAtTime(2600 * rate, t + 0.9);
    lp.frequency.exponentialRampToValueAtTime(360 * rate, t + dur);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.5, t + 0.9);
    env.gain.linearRampToValueAtTime(0.14, t + 1.7);
    env.gain.linearRampToValueAtTime(0.0001, t + dur);
    src.connect(lp);
    lp.connect(env);
    env.connect(out);
    src.start(t);
    src.stop(t + dur);
}

/** 风声:带通噪声缓慢起伏,中心频率来回飘 */
function synthWind(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const dur = 2.2;
    const src = ctx.createBufferSource();
    const bp = ctx.createBiquadFilter();
    const env = ctx.createGain();
    src.buffer = noiseBuffer(ctx, dur);
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(jitter(520, 0.15) * rate, t);
    bp.frequency.exponentialRampToValueAtTime(jitter(1400, 0.15) * rate, t + 0.8);
    bp.frequency.exponentialRampToValueAtTime(jitter(640, 0.15) * rate, t + 1.6);
    bp.frequency.exponentialRampToValueAtTime(jitter(1100, 0.15) * rate, t + dur);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.42, t + 0.5);
    env.gain.linearRampToValueAtTime(0.24, t + 1.3);
    env.gain.linearRampToValueAtTime(0.38, t + 1.8);
    env.gain.linearRampToValueAtTime(0.0001, t + dur);
    src.connect(bp);
    bp.connect(env);
    env.connect(out);
    src.start(t);
    src.stop(t + dur);
}

/** 白噪:轻微低通的一段噪声,进出都做淡入淡出免得爆音 */
function synthWhiteNoise(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const dur = 1.6;
    const src = ctx.createBufferSource();
    const lp = ctx.createBiquadFilter();
    const env = ctx.createGain();
    src.buffer = noiseBuffer(ctx, dur);
    lp.type = 'lowpass';
    lp.frequency.value = 9000 * rate;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.3, t + 0.12);
    env.gain.linearRampToValueAtTime(0.3, t + dur - 0.2);
    env.gain.linearRampToValueAtTime(0.0001, t + dur);
    src.connect(lp);
    lp.connect(env);
    env.connect(out);
    src.start(t);
    src.stop(t + dur);
}

/** 低频嗡鸣:两条微微失谐的低频正弦,拍频带来轻微起伏 */
function synthLowHum(ctx, out, { rate }) {
    const t = ctx.currentTime;
    const dur = 1.9;
    const base = jitter(62, 0.05) * rate;
    [base, base * 1.008, base * 2].forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const peak = index === 2 ? 0.1 : 0.34;
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(peak, t + 0.2);
        env.gain.linearRampToValueAtTime(peak * 0.9, t + dur - 0.3);
        env.gain.linearRampToValueAtTime(0.0001, t + dur);
        osc.connect(env);
        env.connect(out);
        osc.start(t);
        osc.stop(t + dur);
    });
}

/**
 * 内置音清单 —— 数组顺序即 UI 顺序,`group` 相同的必须挨在一起
 * (分组顺序 = 每个 group 第一次出现的位置,见 listSoundGroups)。
 */
const SOUND_PRESETS = Object.freeze([
    // —— 气泡:软的、弹的、带水汽的,捏捏主体的默认口味
    { id: 'pop-soft',     name: '气泡·软',   hint: '经典泡泡纸',   group: '气泡', synth: synthPopSoft },
    { id: 'pop-crisp',    name: '气泡·脆',   hint: '更清脆的啪',   group: '气泡', synth: synthPopCrisp },
    { id: 'squish',       name: '捏软糖',     hint: '闷闷的咕唧',   group: '气泡', synth: synthSquish },
    { id: 'bubble-water', name: '水泡',       hint: '水下咕噜',     group: '气泡', synth: synthBubbleWater },
    { id: 'jelly',        name: '果冻',       hint: '低频弹一下',   group: '气泡', synth: synthJelly },
    { id: 'cat-paw',      name: '肉垫',       hint: '又软又闷',     group: '气泡', synth: synthCatPaw },
    { id: 'cork-pop',     name: '开瓶塞',     hint: '厚实的一声',   group: '气泡', synth: synthCorkPop },

    // —— 机械:短、干、不拖尾,适合当界面点击音
    { id: 'click-tick',   name: '轻点',       hint: '最短的一下',   group: '机械', synth: synthClickTick },
    { id: 'key-cap',      name: '键帽',       hint: '机械键盘嗒',   group: '机械', synth: synthKeyCap },
    { id: 'switch-clack', name: '开关',       hint: '拨动咔哒',     group: '机械', synth: synthSwitchClack },
    { id: 'pen-click',    name: '按笔',       hint: '塑料脆响',     group: '机械', synth: synthPenClick },
    { id: 'ratchet',      name: '棘轮',       hint: '一串小咔',     group: '机械', synth: synthRatchet },

    // —— 打击:有音高的敲击,越往后尾巴越长
    { id: 'wood-block',   name: '木鱼',       hint: '干净的木质',   group: '打击', synth: synthWoodBlock },
    { id: 'marimba',      name: '马林巴',     hint: '温暖木琴',     group: '打击', synth: synthMarimba },
    { id: 'kalimba',      name: '卡林巴',     hint: '金属簧片',     group: '打击', synth: synthKalimba },
    { id: 'glass-tap',    name: '叩玻璃',     hint: '清亮的 ping',  group: '打击', synth: synthGlassTap },
    { id: 'bell-ding',    name: '台铃',       hint: '前台叮一下',   group: '打击', synth: synthBellDing },
    { id: 'chime-bell',   name: '风铃',       hint: '长尾治愈',     group: '打击', synth: synthChimeBell },
    { id: 'shaker',       name: '沙锤',       hint: '甩两下',       group: '打击', synth: synthShaker },

    // —— 质感:摩擦 / 碎裂,噪声为主,没有明确音高
    { id: 'crinkle',      name: '脆皮碎',     hint: '巧克力裂开',   group: '质感', synth: synthCrinkle },
    { id: 'sand',         name: '沙沙',       hint: '摩擦感',       group: '质感', synth: synthSand },
    { id: 'paper-flip',   name: '翻纸',       hint: '纸张沙沙',     group: '质感', synth: synthPaperFlip },
    { id: 'snow-step',    name: '踩雪',       hint: '咯吱一下',     group: '质感', synth: synthSnowStep },
    { id: 'balloon-rub',  name: '气球',       hint: '吱吱的橡胶',   group: '质感', synth: synthBalloonRub },
    { id: 'nail-scratch', name: '指甲刮',     hint: '有点刺',       group: '质感', synth: synthNailScratch },
    { id: 'rubber-band',  name: '皮筋',       hint: '拨一下嘣',     group: '质感', synth: synthRubberBand },

    // —— 自然:水、鸟、虫
    { id: 'water-drop',   name: '水滴',       hint: '滴答一声',     group: '自然', synth: synthWaterDrop },
    { id: 'water-pour',   name: '倒水',       hint: '咕咚一段',     group: '自然', synth: synthWaterPour },
    { id: 'bird-chirp',   name: '鸟鸣',       hint: '两三声哨',     group: '自然', synth: synthBirdChirp },
    { id: 'cricket',      name: '虫鸣',       hint: '夏夜唧唧',     group: '自然', synth: synthCricket },

    // —— 环境:1~2 秒的一段底噪,不是循环(见上方注释)
    { id: 'rain',         name: '雨声',       hint: '一段雨',       group: '环境', synth: synthRain },
    { id: 'ocean-wave',   name: '海浪',       hint: '一个来回',     group: '环境', synth: synthOceanWave },
    { id: 'wind',         name: '风声',       hint: '呼一阵',       group: '环境', synth: synthWind },
    { id: 'white-noise',  name: '白噪',       hint: '沙——',         group: '环境', synth: synthWhiteNoise },
    { id: 'low-hum',      name: '低频嗡鸣',   hint: '闷闷的底噪',   group: '环境', synth: synthLowHum },
    { id: 'heartbeat',    name: '心跳',       hint: '两下低频',     group: '环境', synth: synthHeartbeat },

    // —— 玩味:游戏感的小音效
    { id: 'coin',         name: '硬币',       hint: '叮叮两声',     group: '玩味', synth: synthCoin },
    { id: 'star-twinkle', name: '星星',       hint: '上行小琶音',   group: '玩味', synth: synthStarTwinkle },
    { id: 'boing',        name: '弹簧',       hint: '卡通弹跳',     group: '玩味', synth: synthBoing },
]);

/** 没写 group 的预设兜底进这一组,免得 UI 里凭空多出个 undefined 分区 */
export const DEFAULT_SOUND_GROUP = '其他';

/** UI 用的清单(不含 synth 函数,避免被塞进响应式数据) */
export function listSoundPresets() {
    return SOUND_PRESETS.map(({ id, name, hint, group }) => ({
        id,
        name,
        hint,
        group: group || DEFAULT_SOUND_GROUP,
    }));
}

/** 分组名清单,顺序 = 在 SOUND_PRESETS 里第一次出现的顺序 */
export function listSoundGroups() {
    const seen = [];
    for (const preset of SOUND_PRESETS) {
        const group = preset.group || DEFAULT_SOUND_GROUP;
        if (!seen.includes(group)) seen.push(group);
    }
    return seen;
}

export function getSoundPreset(id) {
    return SOUND_PRESETS.find(item => item.id === id) || null;
}

export const DEFAULT_SOUND_ID = 'pop-soft';

/**
 * 播一个内置音
 * @param {string} id preset id
 * @param {object} opts { volume=0.7, rate=1, pan=0 }
 */
export function playSoundPreset(id, opts = {}) {
    const preset = getSoundPreset(id) || getSoundPreset(DEFAULT_SOUND_ID);
    if (!preset) return false;
    const ctx = ensureAudioContext();
    if (!ctx) return false;

    const volume = clamp01(opts.volume == null ? 0.7 : opts.volume);
    if (volume <= 0) return false;

    try {
        const out = createOutput(ctx, volume, opts.pan || 0);
        preset.synth(ctx, out, { rate: opts.rate || 1 });
        return true;
    } catch (err) {
        console.warn(`[relax/sound] 内置音 ${preset.id} 播放失败`, err);
        return false;
    }
}

// ============================================================
// 自定义音
// ============================================================

/** dataURL / base64 → ArrayBuffer */
function dataUrlToArrayBuffer(dataUrl) {
    const commaAt = dataUrl.indexOf(',');
    const base64 = commaAt >= 0 ? dataUrl.slice(commaAt + 1) : dataUrl;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * 解码并缓存自定义音。
 * @param {{id:string, dataUrl:string}} record
 * @returns {Promise<AudioBuffer|null>}
 */
export async function decodeCustomSound(record) {
    if (!record?.id || !record?.dataUrl) return null;
    if (_bufferCache.has(record.id)) return _bufferCache.get(record.id);
    if (_decoding.has(record.id)) return _decoding.get(record.id);

    const ctx = ensureAudioContext();
    if (!ctx) return null;

    const task = (async () => {
        try {
            const arrayBuffer = dataUrlToArrayBuffer(record.dataUrl);
            const buffer = await ctx.decodeAudioData(arrayBuffer);
            _bufferCache.set(record.id, buffer);
            return buffer;
        } catch (err) {
            console.warn(`[relax/sound] 自定义音 ${record.id} 解码失败`, err);
            return null;
        } finally {
            _decoding.delete(record.id);
        }
    })();

    _decoding.set(record.id, task);
    return task;
}

/**
 * 播一条自定义音。首次会异步解码(所以第一下可能慢一点点),之后走缓存同步播。
 */
export async function playCustomSound(record, opts = {}) {
    const ctx = ensureAudioContext();
    if (!ctx) return false;

    const volume = clamp01(opts.volume == null ? 0.7 : opts.volume);
    if (volume <= 0) return false;

    const buffer = _bufferCache.get(record?.id) || await decodeCustomSound(record);
    if (!buffer) return false;

    try {
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.playbackRate.value = opts.rate || 1;
        const out = createOutput(ctx, volume, opts.pan || 0);
        src.connect(out);
        src.start(ctx.currentTime);
        return true;
    } catch (err) {
        console.warn('[relax/sound] 自定义音播放失败', err);
        return false;
    }
}

export function disposeCustomSound(id) {
    _bufferCache.delete(id);
    _decoding.delete(id);
}

/**
 * ★ 统一播放入口 —— UI 试听和主体触发都走这里,保证「用户选了什么就响什么」。
 * @param {object} soundConfig scene.sound: { enabled, presetId, customId, volume }
 * @param {object|null} customRecord 当 soundConfig.customId 有值时,对应的自定义音记录
 * @param {object} opts { rate, pan, volume(覆盖) }
 */
export function playSoundConfig(soundConfig = {}, customRecord = null, opts = {}) {
    if (soundConfig.enabled === false) return false;
    const volume = opts.volume == null
        ? (soundConfig.volume == null ? 0.7 : soundConfig.volume)
        : opts.volume;
    const playOpts = { ...opts, volume };

    if (soundConfig.customId && customRecord?.dataUrl) {
        void playCustomSound(customRecord, playOpts);
        return true;
    }
    return playSoundPreset(soundConfig.presetId || DEFAULT_SOUND_ID, playOpts);
}

// ============================================================
// 震动
// ============================================================

const HAPTIC_PATTERNS = {
    light: 12,
    medium: 24,
    heavy: [18, 26, 18],
};

export function haptic(strength = 'light') {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
    try {
        navigator.vibrate(HAPTIC_PATTERNS[strength] ?? HAPTIC_PATTERNS.light);
        return true;
    } catch {
        return false;
    }
}

function clamp01(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0.7;
    return Math.min(1, Math.max(0, num));
}
