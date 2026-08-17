/**
 * 手书 · 脚本解析器(映射系统)
 *
 * ★ 本文件**零依赖、纯函数**。不 import 任何东西,不碰 DOM、不碰 store。
 *   这样它可以被 node 直接跑起来做回归,也可以被 AI 生成结果反复喂着试错。
 *
 * ============================================================
 * 一、它是什么
 * ============================================================
 *
 * 手书不编码真视频,它把一段**脚本**映射成时间轴上的一串**剪辑**,
 * 播放时由 `timeline-engine.js` 按时间重放。这个文件就是那层「映射」。
 *
 *   脚本(人写 / AI 写)  →  parseScript()  →  clips[]  →  时间轴 / 舞台
 *
 * ============================================================
 * 二、语法
 * ============================================================
 *
 * 逐行解析。空行忽略;`#` 或 `//` 开头是注释。
 * 方括号 **全角【】和半角[] 都认**,冒号 **全角：和半角: 都认**。
 *
 * ── 2.1 文字指令 ───────────────────────────────────────────
 *
 *   【打字】文本            逐字打出「文本」
 *   【删除】3               从末尾退格 3 个字
 *   【删除】我喜欢          退掉末尾的「我喜欢」(退完正好剩下前面那些)
 *   【停顿】1.2s            画面不动,等 1.2 秒
 *   【出现再删除】我喜欢    打出「我喜欢」→ 停一下 → 再逐字删掉
 *   【替换】旧→新           删掉「旧」,打出「新」(→ 和 -> 都认)
 *   【清空】                把屏幕上的字逐字清干净
 *   【换行】                换一行
 *
 * 不带方括号的裸行 = `【打字】该行`,所以纯文字脚本可以直接粘进来。
 *
 * ── 2.2 时长 ───────────────────────────────────────────────
 *
 * 写在指令名后面,空格隔开:`【打字 2s】文本` / `【停顿 800ms】`。
 * 也可以写在参数里:`【停顿】1.2s`。
 *
 *   `2s` / `1.2s` / `500ms` / `3秒`
 *   不写单位时:带小数点或 ≤60 当**秒**,否则当**毫秒**(`800` = 800ms)。
 *
 * 不写时长就按字数推算(打字 130ms/字,删除 70ms/字)。
 *
 * ── 2.3 时间锚 ─────────────────────────────────────────────
 *
 *   @10s        下一条指令从第 10 秒开始(绝对时间)
 *   【10s】     同上
 *
 * 锚点比当前游标早时**照样生效**(允许故意做重叠),只是会记一条 warning。
 *
 * ── 2.4 效果 ───────────────────────────────────────────────
 *
 *   【抖动】                给下一行挂「抖动」
 *   【叠加】                给下一行挂「错位叠加」
 *   【效果:发光】           按名字挂任意预设(含用户自建的)
 *   【抖动】我不想说话      修饰 + 内容写在同一行(等价于两行)
 *
 * 修饰会**累积**到下一条产生内容的行,一次可以叠好几个:
 *
 *   【抖动】
 *   【发光】
 *   【打字】救命
 *
 * 效果会同时做两件事:给文字剪辑打上 `effectId`,以及在效果轨上生成
 * 一段覆盖同一时间区间的剪辑 —— 时间轴上看得见、拖得动。
 *
 * ── 2.5 背景 ───────────────────────────────────────────────
 *
 *   【背景:渊】             背景轨上生成一段,直到下一个【背景】或片尾
 *
 * ── 2.6 行内括号(用户原话里的那种写法) ─────────────────────
 *
 * 打字行里可以用括号插一段指令,**全角（）和半角() 都认**:
 *
 *   【打字】我（出现再删除 10s：我喜欢）…不是我什么都没说
 *
 * 会被映射成五个剪辑:
 *
 *   1. 打字「我」
 *   2. 打字「我喜欢」
 *   3. 停顿 10s
 *   4. 删除「我喜欢」(3 字)
 *   5. 打字「…不是我什么都没说」
 *
 * 也就是说观众看到的是「我」→「我我喜欢」→ 停十秒 →「我」→
 * 「我…不是我什么都没说」。这正是用户要的那个效果:说了又收回去。
 *
 * ============================================================
 * 三、失败姿态
 * ============================================================
 *
 * 认不出来的指令**不抛异常**,当成普通文字打出来,并记一条 warning。
 * 理由:脚本多半是 AI 生成的,一个字写错就整份作废对用户毫无意义 ——
 * 让它能播,再把哪一行有问题告诉用户。
 */

// ============================================================
// 0. 常量(本文件自足,不从 constants.js 引 —— 保持零依赖)
// ============================================================

const TRACK_TEXT = 'trk-text';
const TRACK_EFFECT = 'trk-effect';
const TRACK_BG = 'trk-bg';

const MS_PER_CHAR_TYPE = 130;
const MS_PER_CHAR_DELETE = 70;
const MIN_MS = 120;
const DEFAULT_HOLD_MS = 800;
/** 【出现再删除】中间那一下停多久(没写时长时) */
const FLASH_HOLD_MS = 700;

/** 指令别名 → 内部动作名。中英文都收,免得 AI 写英文时全线失配 */
const DIRECTIVES = {
    打字: 'type', 输入: 'type', 写: 'type', type: 'type', typing: 'type',
    删除: 'delete', 退格: 'delete', 删: 'delete', delete: 'delete', backspace: 'delete',
    停顿: 'hold', 等待: 'hold', 停: 'hold', 保持: 'hold', hold: 'hold', wait: 'hold', pause: 'hold',
    出现再删除: 'flash', 说了又删: 'flash', 欲言又止: 'flash', flash: 'flash',
    替换: 'replace', 改成: 'replace', replace: 'replace',
    清空: 'clear', 清屏: 'clear', clear: 'clear',
    换行: 'newline', newline: 'newline', br: 'newline',
    效果: 'effect', 特效: 'effect', effect: 'effect', fx: 'effect',
    背景: 'bg', 底: 'bg', bg: 'bg', background: 'bg',
};

/**
 * 效果名 → 内置预设 id。
 *
 * ★ 这份表必须和 `presets/effects.js` 的 `BUILTIN_EFFECTS` 对得上。
 *   对不上的表现是:脚本里写了【抖动】,时间轴上有效果块,舞台上却什么都不动。
 *   解析时会把认不出的效果名原样留在 `effectName` 里并记 warning,
 *   调用方(store)再拿用户自建预设兜一次底。
 */
const EFFECT_ALIAS = {
    抖动: 'fx-shake', 震动: 'fx-shake', shake: 'fx-shake',
    剧烈抖动: 'fx-shake-hard', 狂抖: 'fx-shake-hard',
    呼吸: 'fx-breathe', breathe: 'fx-breathe',
    渐显: 'fx-fade-in', 淡入: 'fx-fade-in', fadein: 'fx-fade-in',
    渐隐: 'fx-fade-out', 淡出: 'fx-fade-out', fadeout: 'fx-fade-out',
    上浮: 'fx-float-up', 浮起: 'fx-float-up',
    下沉: 'fx-sink-down', 沉底: 'fx-sink-down',
    打字光标: 'fx-caret', 光标: 'fx-caret', caret: 'fx-caret',
    故障: 'fx-glitch', 故障风: 'fx-glitch', glitch: 'fx-glitch',
    描边: 'fx-outline', 空心: 'fx-outline',
    发光: 'fx-glow', 辉光: 'fx-glow', glow: 'fx-glow',
    叠影: 'fx-ghost', 残影: 'fx-ghost',
    叠加: 'fx-offset-stack', 错位叠加: 'fx-offset-stack', 错位: 'fx-offset-stack',
    模糊聚焦: 'fx-blur-focus', 聚焦: 'fx-blur-focus',
    逐字弹入: 'fx-pop-in', 弹入: 'fx-pop-in',
    整行左滑: 'fx-slide-left', 左滑: 'fx-slide-left',
    闪烁: 'fx-blink', blink: 'fx-blink',
    缩放脉冲: 'fx-scale-pulse', 脉冲: 'fx-scale-pulse',
};

/** 背景名 → 舞台底 id(和 constants.STAGE_BACKDROPS 对齐) */
const BACKDROP_ALIAS = {
    墨: 'ink', ink: 'ink',
    晨: 'dawn', 清晨: 'dawn', dawn: 'dawn',
    暮: 'dusk', 黄昏: 'dusk', dusk: 'dusk',
    渊: 'deep', 深渊: 'deep', deep: 'deep',
    纸: 'paper', 纸张: 'paper', paper: 'paper',
    霓: 'neon', 霓虹: 'neon', neon: 'neon',
};

/** 给 App 内「语法说明」面板用 —— 文档和实现放同一个文件,不会各说各话 */
export const GRAMMAR_HELP = Object.freeze([
    {
        group: '文字',
        items: [
            { syntax: '【打字】文本', desc: '逐字打出来', example: '【打字】今天也没能说出口' },
            { syntax: '【删除】3', desc: '从末尾退掉 3 个字', example: '【删除】3' },
            { syntax: '【删除】我喜欢', desc: '退掉末尾这几个字', example: '【删除】我喜欢' },
            { syntax: '【停顿】1.2s', desc: '画面不动,等一会儿', example: '【停顿】1.2s' },
            { syntax: '【出现再删除】文本', desc: '打出来 → 停一下 → 再删掉', example: '【出现再删除 2s】我喜欢' },
            { syntax: '【替换】旧→新', desc: '删掉旧的,打出新的', example: '【替换】朋友→喜欢的人' },
            { syntax: '【清空】', desc: '把屏幕清干净', example: '【清空】' },
            { syntax: '【换行】', desc: '换一行继续写', example: '【换行】' },
            { syntax: '裸文字行', desc: '不写方括号就等于【打字】', example: '我没事' },
        ],
    },
    {
        group: '时间',
        items: [
            { syntax: '【打字 2s】文本', desc: '指定这一步花多久', example: '【打字 2s】慢慢地说' },
            { syntax: '@10s', desc: '下一条从第 10 秒开始', example: '@10s' },
            { syntax: '【10s】', desc: '同上,另一种写法', example: '【10s】' },
            { syntax: '单位', desc: '2s / 1.2s / 500ms / 3秒;不写单位时 ≤60 或带小数点算秒,否则算毫秒', example: '【停顿】800ms' },
        ],
    },
    {
        group: '效果',
        items: [
            { syntax: '【抖动】', desc: '给下一行挂抖动', example: '【抖动】' },
            { syntax: '【效果:发光】', desc: '按名字挂任意预设(含自建的)', example: '【效果:发光】' },
            { syntax: '【抖动】文本', desc: '修饰和内容写一行', example: '【抖动】不要走' },
            { syntax: '叠着写', desc: '连写几行修饰,会一起挂到下一行内容上', example: '【抖动】\n【发光】\n【打字】救命' },
            { syntax: '【背景:渊】', desc: '换舞台底,直到下一个【背景】', example: '【背景:渊】' },
        ],
    },
    {
        group: '行内括号',
        items: [
            {
                syntax: '文本（指令 时长：参数）文本',
                desc: '在一行里插一段指令,全角半角括号都认',
                example: '【打字】我（出现再删除 10s：我喜欢）…不是我什么都没说',
            },
        ],
    },
]);

// ============================================================
// 1. 词法小工具
// ============================================================

function normalizeColon(raw) {
    return String(raw).replace(/：/g, ':');
}

/** 中文全角标点统一成半角,只动分隔符,不动正文 */
function normalizeArrow(raw) {
    return String(raw).replace(/->/g, '→').replace(/=>/g, '→');
}

/**
 * 解析时长。
 *
 * 不写单位时的判定规则写在文件头 §2.2:带小数点或 ≤60 当秒,否则当毫秒。
 * 这条规则是照着人的直觉定的 —— 没人会写「停顿 0.8」表示 0.8 毫秒,
 * 也没人会写「停顿 800」表示 800 秒。
 */
export function parseDuration(raw) {
    const s = String(raw ?? '').trim();
    if (!s) return null;
    const m = s.match(/^(\d+(?:\.\d+)?)\s*(ms|毫秒|s|秒|sec)?$/i);
    if (!m) return null;
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n < 0) return null;
    const unit = String(m[2] || '').toLowerCase();
    if (unit === 'ms' || unit === '毫秒') return Math.round(n);
    if (unit) return Math.round(n * 1000);
    if (m[1].includes('.') || n <= 60) return Math.round(n * 1000);
    return Math.round(n);
}

/** 只有时长、没有指令名 → 这是个时间锚 */
function asPureDuration(head) {
    const ms = parseDuration(head);
    return ms == null ? null : ms;
}

/**
 * 拆开中括号里的内容:`打字 2s` → `{ name:'打字', ms:2000 }`。
 * `效果:发光` 这种冒号形式由调用方先切开,这里只处理「名字 + 时长」。
 */
function splitHead(head) {
    const raw = String(head).trim();
    const m = raw.match(/^(.*?)[\s　]+(\d+(?:\.\d+)?\s*(?:ms|毫秒|s|秒|sec)?)$/i);
    if (m) {
        const ms = parseDuration(m[2]);
        if (ms != null) return { name: m[1].trim(), ms };
    }
    return { name: raw, ms: null };
}

function resolveEffectId(name, extraEffects) {
    const key = String(name || '').trim();
    if (!key) return '';
    const lower = key.toLowerCase();
    if (EFFECT_ALIAS[key]) return EFFECT_ALIAS[key];
    if (EFFECT_ALIAS[lower]) return EFFECT_ALIAS[lower];
    // 用户自建预设:按名字精确匹配(id 也认,方便脚本里直接写 id)
    for (const fx of Array.isArray(extraEffects) ? extraEffects : []) {
        if (!fx) continue;
        if (String(fx.id) === key) return String(fx.id);
        if (String(fx.name || '').trim() === key) return String(fx.id);
    }
    return '';
}

// ============================================================
// 2. 主解析
// ============================================================

/**
 * 把脚本解析成剪辑。
 *
 * @param {string} script
 * @param {object} [opts]
 * @param {Array}  [opts.effects]   用户自建预设 `[{ id, name }]`,用来解析自定义效果名
 * @param {number} [opts.typeSpeed] 每字毫秒(打字),默认 130
 * @param {string} [opts.idPrefix]  剪辑 id 前缀(测试里传固定值可得到确定性输出)
 * @returns {{ clips:Array, duration:number, warnings:Array, stats:object }}
 */
export function parseScript(script, opts = {}) {
    const typeSpeed = Number.isFinite(opts.typeSpeed) && opts.typeSpeed > 0 ? Math.round(opts.typeSpeed) : MS_PER_CHAR_TYPE;
    const delSpeed = Math.max(20, Math.round(typeSpeed * (MS_PER_CHAR_DELETE / MS_PER_CHAR_TYPE)));
    const extraEffects = Array.isArray(opts.effects) ? opts.effects : [];

    const idPrefix = String(opts.idPrefix || `c${Date.now().toString(36)}`);
    let idSeq = 0;
    const nextId = () => `${idPrefix}-${(idSeq += 1)}`;

    const clips = [];
    const warnings = [];

    /** 播放游标(ms):下一个剪辑从这儿开始 */
    let cursor = 0;
    /** 模拟的文字缓冲区 —— 算删除字数和清空字数要用 */
    let buffer = '';
    /** 攒着的效果修饰,遇到下一条内容行时落到那些剪辑上 */
    let pendingFx = [];
    /** 当前背景剪辑(下一个【背景】来时把它的 duration 补齐) */
    let openBg = null;

    const warn = (line, message) => warnings.push({ line, message });

    function pushClip(clip) {
        const duration = Math.max(MIN_MS, Math.round(clip.duration || 0));
        const record = {
            id: nextId(),
            trackId: clip.trackId || TRACK_TEXT,
            type: clip.type,
            start: Math.max(0, Math.round(clip.start)),
            duration,
            text: String(clip.text || ''),
            count: Math.max(0, Math.round(clip.count || 0)),
            from: String(clip.from || ''),
            to: String(clip.to || ''),
            effectId: String(clip.effectId || ''),
            effectName: String(clip.effectName || ''),
            backdrop: String(clip.backdrop || ''),
            style: null,
        };
        clips.push(record);
        return record;
    }

    /** 一条内容行产出的剪辑区间,用来铺效果轨 */
    function applyPendingFx(produced) {
        if (!pendingFx.length || !produced.length) return;
        const from = Math.min(...produced.map((c) => c.start));
        const to = Math.max(...produced.map((c) => c.start + c.duration));
        for (const fx of pendingFx) {
            for (const c of produced) {
                if (c.trackId !== TRACK_TEXT) continue;
                // 文字剪辑上盖一个 effectId,属性面板里看得到、改得动
                if (!c.effectId) {
                    c.effectId = fx.id;
                    c.effectName = fx.name;
                }
            }
            pushClip({
                trackId: TRACK_EFFECT,
                type: 'effect',
                start: from,
                duration: Math.max(MIN_MS, to - from),
                effectId: fx.id,
                effectName: fx.name,
                text: fx.name,
            });
        }
        pendingFx = [];
    }

    // ── 单个动作 ────────────────────────────────
    // 全部返回它产出的剪辑数组,交给 applyPendingFx 统一挂效果

    function doType(text, ms) {
        const body = String(text || '');
        if (!body) return [];
        const duration = ms != null ? ms : body.length * typeSpeed;
        const clip = pushClip({ type: 'type', start: cursor, duration, text: body });
        cursor += clip.duration;
        buffer += body;
        return [clip];
    }

    function doDelete(count, ms) {
        const n = Math.min(buffer.length, Math.max(0, Math.round(count)));
        if (n <= 0) return [];
        const duration = ms != null ? ms : n * delSpeed;
        const removed = buffer.slice(buffer.length - n);
        const clip = pushClip({ type: 'delete', start: cursor, duration, count: n, text: removed });
        cursor += clip.duration;
        buffer = buffer.slice(0, buffer.length - n);
        return [clip];
    }

    function doHold(ms) {
        const clip = pushClip({ type: 'hold', start: cursor, duration: ms != null ? ms : DEFAULT_HOLD_MS });
        cursor += clip.duration;
        return [clip];
    }

    function doClear(ms) {
        if (!buffer.length) return [];
        const n = buffer.length;
        const clip = pushClip({ type: 'clear', start: cursor, duration: ms != null ? ms : n * delSpeed, count: n, text: buffer });
        cursor += clip.duration;
        buffer = '';
        return [clip];
    }

    function doReplace(from, to, ms) {
        const oldText = String(from || '');
        const newText = String(to || '');
        if (!oldText && !newText) return [];
        const n = Math.min(buffer.length, oldText.length);
        const duration = ms != null ? ms : (n * delSpeed + newText.length * typeSpeed);
        const clip = pushClip({ type: 'replace', start: cursor, duration, count: n, from: oldText, to: newText, text: newText });
        cursor += clip.duration;
        buffer = buffer.slice(0, buffer.length - n) + newText;
        return [clip];
    }

    /**
     * 出现再删除 —— 用户原话里的那个效果。
     *
     * 展开成三步而不是做成一种剪辑类型:这样用户在时间轴上能分别拖
     * 「打出来」「停多久」「删掉」三段,而不是只能整体缩放。
     */
    function doFlash(text, holdMs) {
        const body = String(text || '');
        if (!body) return [];
        const out = [];
        out.push(...doType(body, null));
        out.push(...doHold(holdMs != null ? holdMs : FLASH_HOLD_MS));
        out.push(...doDelete(body.length, null));
        return out;
    }

    function doBg(name, lineNo) {
        const key = String(name || '').trim();
        const backdrop = BACKDROP_ALIAS[key] || BACKDROP_ALIAS[key.toLowerCase()] || '';
        if (!backdrop) {
            warn(lineNo, `不认识的背景「${key}」,这一行跳过了`);
            return [];
        }
        if (openBg) openBg.duration = Math.max(MIN_MS, cursor - openBg.start);
        openBg = pushClip({ trackId: TRACK_BG, type: 'bg', start: cursor, duration: MIN_MS, backdrop, text: key });
        // 背景不推进游标 —— 它是「从这一刻起的底色」,不占叙事时间
        return [];
    }

    /**
     * 「删除」的参数可能是数字,也可能是要删掉的那几个字。
     * 两种直觉都照顾:末尾正好是这几个字 → 删掉它们;
     * 缓冲区以它开头 → 删到只剩它;都不是 → 按字数删。
     */
    function resolveDeleteCount(arg) {
        const raw = String(arg || '').trim();
        if (!raw) return 1;
        if (/^\d+$/.test(raw)) return Number(raw);
        if (buffer.endsWith(raw)) return raw.length;
        if (buffer.startsWith(raw)) return buffer.length - raw.length;
        return raw.length;
    }

    // ── 行内括号 ────────────────────────────────

    /**
     * 把一段打字正文按括号切开。
     *
     * `我（出现再删除 10s：我喜欢）…不是我什么都没说`
     *   → [ {text:'我'}, {directive:'出现再删除', ms:10000, arg:'我喜欢'}, {text:'…不是我什么都没说'} ]
     *
     * ★ 只有括号里**第一段**能被识别成指令时才当指令;
     *   否则原样保留括号(「（笑）」这种正常写作里的括号不能被吃掉)。
     */
    function splitInline(payload) {
        const parts = [];
        const re = /[（(]([^）)]*)[）)]/g;
        let last = 0;
        let m;
        while ((m = re.exec(payload)) !== null) {
            const inner = normalizeColon(m[1]).trim();
            const colonAt = inner.indexOf(':');
            const headRaw = colonAt === -1 ? inner : inner.slice(0, colonAt);
            const argRaw = colonAt === -1 ? '' : inner.slice(colonAt + 1);
            const { name, ms } = splitHead(headRaw);
            const action = DIRECTIVES[name] || DIRECTIVES[name.toLowerCase()];
            const fxId = action ? '' : resolveEffectId(name, extraEffects);
            if (!action && !fxId) continue;   // 不是指令 → 当普通括号,留在正文里
            if (m.index > last) parts.push({ kind: 'text', text: payload.slice(last, m.index) });
            parts.push({ kind: 'directive', action, name, ms, arg: argRaw.trim(), fxId });
            last = m.index + m[0].length;
        }
        if (last < payload.length) parts.push({ kind: 'text', text: payload.slice(last) });
        return parts;
    }

    /** 执行一条(行首或行内的)指令,返回产出的剪辑 */
    function runDirective({ action, name, ms, arg, fxId }, lineNo) {
        if (!action && fxId) {
            pendingFx.push({ id: fxId, name });
            return [];
        }
        switch (action) {
            case 'type': return runPayload(arg, ms, lineNo);
            case 'delete': return doDelete(resolveDeleteCount(arg), ms);
            case 'hold': return doHold(ms != null ? ms : parseDuration(arg));
            // ★ flash 的时长是「中间停多久」,不是整段时长 ——
            //   【出现再删除 10s】我喜欢 = 打出来、停 10 秒、再删掉
            case 'flash': return doFlash(arg, ms);
            case 'clear': return doClear(ms);
            case 'newline': return doType('\n', ms != null ? ms : MIN_MS);
            case 'replace': {
                const [from, to] = normalizeArrow(arg).split('→');
                if (to == null) {
                    warn(lineNo, '【替换】要写成「旧→新」,这一行按打字处理了');
                    return doType(arg, ms);
                }
                return doReplace(from.trim(), to.trim(), ms);
            }
            case 'effect': {
                const id = resolveEffectId(arg, extraEffects);
                if (!id) {
                    warn(lineNo, `不认识的效果「${arg}」,这一行跳过了`);
                    return [];
                }
                pendingFx.push({ id, name: String(arg).trim() });
                return [];
            }
            case 'bg': return doBg(arg, lineNo);
            default:
                warn(lineNo, `不认识的指令「${name}」,按普通文字打出来了`);
                return doType(arg || name, ms);
        }
    }

    /** 打字正文(可能含行内括号) */
    function runPayload(payload, ms, lineNo) {
        const body = String(payload || '');
        if (!body) return [];
        const parts = splitInline(body);
        if (parts.length === 1 && parts[0].kind === 'text') return doType(parts[0].text, ms);
        const out = [];
        for (const part of parts) {
            if (part.kind === 'text') out.push(...doType(part.text, null));
            else out.push(...runDirective(part, lineNo));
        }
        return out;
    }

    // ── 逐行 ────────────────────────────────────

    const lines = String(script ?? '').replace(/\r\n?/g, '\n').split('\n');

    lines.forEach((rawLine, index) => {
        const lineNo = index + 1;
        const line = rawLine.trim();
        if (!line) return;
        if (line.startsWith('#') || line.startsWith('//')) return;

        // @10s 时间锚
        if (/^@/.test(line)) {
            const ms = parseDuration(line.slice(1));
            if (ms == null) {
                warn(lineNo, `时间锚「${line}」看不懂,已忽略`);
                return;
            }
            if (ms < cursor) warn(lineNo, `时间锚 ${line} 比当前进度早,这一段会和前面重叠`);
            cursor = ms;
            return;
        }

        const bracket = line.match(/^[【\[]([^】\]]*)[】\]]\s*([\s\S]*)$/);
        if (!bracket) {
            // 裸文字行 = 打字
            const produced = runPayload(line, null, lineNo);
            applyPendingFx(produced);
            return;
        }

        const headRawFull = normalizeColon(bracket[1]).trim();
        const payload = bracket[2].trim();

        // 【10s】 时间锚
        const anchor = asPureDuration(headRawFull);
        if (anchor != null && !payload) {
            if (anchor < cursor) warn(lineNo, `时间锚【${headRawFull}】比当前进度早,这一段会和前面重叠`);
            cursor = anchor;
            return;
        }

        const colonAt = headRawFull.indexOf(':');
        const headName = colonAt === -1 ? headRawFull : headRawFull.slice(0, colonAt);
        const headArg = colonAt === -1 ? '' : headRawFull.slice(colonAt + 1).trim();
        const { name, ms } = splitHead(headName);

        const action = DIRECTIVES[name] || DIRECTIVES[name.toLowerCase()];

        if (!action) {
            // 【抖动】这类:方括号里直接写效果名
            const fxId = resolveEffectId(name, extraEffects);
            if (fxId) {
                pendingFx.push({ id: fxId, name });
                if (payload) applyPendingFx(runPayload(payload, ms, lineNo));
                return;
            }
            warn(lineNo, `不认识的指令【${name}】,整行按文字打出来了`);
            applyPendingFx(runPayload(line, null, lineNo));
            return;
        }

        // 参数优先取方括号后面的正文;没有就用冒号后面那段
        const arg = payload || headArg;
        const produced = runDirective({ action, name, ms, arg, fxId: '' }, lineNo);
        applyPendingFx(produced);
    });

    if (pendingFx.length) {
        warn(lines.length, '末尾的效果修饰后面没有内容行,已忽略');
        pendingFx = [];
    }

    const duration = clips.reduce((max, c) => Math.max(max, c.start + c.duration), 0);
    if (openBg) openBg.duration = Math.max(MIN_MS, duration - openBg.start);

    return {
        clips,
        duration,
        warnings,
        stats: {
            lines: lines.length,
            clips: clips.length,
            textClips: clips.filter((c) => c.trackId === TRACK_TEXT).length,
            chars: clips.filter((c) => c.type === 'type').reduce((n, c) => n + c.text.length, 0),
        },
    };
}

// ============================================================
// 3. 反向:剪辑 → 脚本
// ============================================================

/**
 * 把时间轴上的剪辑倒回成脚本文本。
 *
 * 为什么需要:用户可以只在时间轴上拖,从来不写脚本。
 * 这时脚本面板如果空着,「复制给 AI 让它接着写」就没法用了。
 * 倒回来的脚本**带时间锚**,所以再解析一遍位置不会漂。
 */
export function stringifyClips(clips, opts = {}) {
    const list = (Array.isArray(clips) ? clips : [])
        .filter((c) => c && c.trackId === TRACK_TEXT)
        .slice()
        .sort((a, b) => a.start - b.start);

    const fxByStart = new Map();
    for (const c of Array.isArray(clips) ? clips : []) {
        if (!c || c.trackId !== TRACK_EFFECT) continue;
        const key = Math.round(c.start);
        if (!fxByStart.has(key)) fxByStart.set(key, []);
        fxByStart.get(key).push(c);
    }

    const nameOf = (id) => {
        const hit = (opts.effects || []).find((f) => String(f.id) === String(id));
        return hit ? hit.name : id;
    };

    const out = [];
    let cursor = 0;
    for (const c of list) {
        if (Math.abs(c.start - cursor) > 60) out.push(`@${(c.start / 1000).toFixed(1)}s`);
        for (const fx of fxByStart.get(Math.round(c.start)) || []) {
            out.push(`【效果:${nameOf(fx.effectId)}】`);
        }
        const dur = ` ${(c.duration / 1000).toFixed(1)}s`;
        if (c.type === 'type') out.push(`【打字${dur}】${c.text}`);
        else if (c.type === 'delete') out.push(`【删除${dur}】${c.count}`);
        else if (c.type === 'hold') out.push(`【停顿】${(c.duration / 1000).toFixed(1)}s`);
        else if (c.type === 'clear') out.push(`【清空${dur}】`);
        else if (c.type === 'replace') out.push(`【替换${dur}】${c.from}→${c.to}`);
        cursor = c.start + c.duration;
    }
    return out.join('\n');
}

export default { parseScript, stringifyClips, parseDuration, GRAMMAR_HELP };
