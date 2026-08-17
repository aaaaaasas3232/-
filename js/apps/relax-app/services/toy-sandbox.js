/**
 * relax-app / 「写代码」模式的沙箱运行时
 *
 * ============================================================
 * 为什么要有这个文件
 * ============================================================
 * 自由模式(services/toy-parts.js)把手势做成了五种预制零件:按、开关、
 * 摇杆、滑块、旋钮。够用,但天花板是死的 —— 想做「甩一下会飞出去的骰子」
 * 「跟着手指画线」「两根手指捏合缩放」,这些都不在那五种里面,
 * 而且永远也补不全,因为「用户想做什么」本来就没有上界。
 *
 * 所以这里放开 JavaScript。
 *
 * ============================================================
 * ★ 放开 JS 的前提:代码不能跑在本页
 * ============================================================
 * 编辑页鼓励用户把 AI 生成的代码粘回来 —— 那段代码用户多半没逐行读过。
 * 直接 eval 在本页里,等于让它随便翻聊天记录、翻 IndexedDB、改整个界面。
 *
 * 所以用户代码跑在 `<iframe sandbox="allow-scripts">` 里。
 * **关键是不给 allow-same-origin** —— 这样 iframe 拿到的是一个「不透明源」,
 * 它和小听不同源,于是:
 *   · 读不到 parent.document(跨源,浏览器直接拦)
 *   · 读不到小听的 localStorage / IndexedDB / cookie(不同源各自一套)
 *   · 拿不到任何本页的 JS 对象
 * 唯一的通道是 postMessage,而通道那头(下面的 handleMessage)只认五种消息。
 *
 * 再加一层 CSP 把网络掐死(connect-src 'none'、img-src 只留 data:/blob:),
 * 就算粘进来的是恶意代码,它既看不到东西也传不出去。
 *
 * ★ 剩下唯一拦不住的是「死循环把页面卡住」
 *   srcdoc iframe 和主页面通常同一个线程,用户写个 while(true) 就是卡死。
 *   这个从外面没法预防(卡住的时候我们的定时器也不跑了),
 *   只能在提示词和编辑页里反复说「别写死循环」。重进 App 即可恢复,不会掉档。
 *
 * ============================================================
 * ★ 三段代码一律走 base64 塞进去
 * ============================================================
 * srcdoc 是一整段 HTML 文本,用户 JS 里只要出现 `</script`,内层文档就在那儿
 * 断掉,后面全变成正文 —— 而且报的错完全指不到真正的原因。
 * base64 之后字符集只剩 A-Za-z0-9+/=,不可能撞上任何标签边界。
 * (中文注释很常见,所以要先 UTF-8 编码再 base64,btoa 直接吃中文会抛。)
 *
 * 同目录的 starlit/services/code-engine.js 也做过一版预览 iframe,
 * 那边是教学片段、内容可控,所以直接内联;这里的输入是「任意粘贴」,
 * 必须按不可信处理。
 */

/** 三段代码各自的长度上限。沙箱里只渲染一份,给得起。 */
export const MAX_TOY_JS_LEN = 40000;

/**
 * 沙箱内的 CSP。
 * ★ 'unsafe-eval' 是必须的:用户代码靠 new Function() 跑起来。
 *   在不透明源 + connect-src 'none' 的前提下,它换不来任何额外能力。
 * ★ connect-src 'none' 是这条 CSP 的重点 —— 掐掉 fetch / XHR / WebSocket,
 *   粘进来的代码就算想把什么东西发出去也没有出口。
 */
const SANDBOX_CSP = [
    "default-src 'none'",
    "script-src 'unsafe-inline' 'unsafe-eval'",
    "style-src 'unsafe-inline'",
    'img-src data: blob:',
    'media-src data: blob:',
    'font-src data:',
    "connect-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
].join('; ');

/** 一秒最多放几声。用户写个 requestAnimationFrame 里每帧 hb.sound() 会把喇叭烧了 */
const SOUND_BUDGET_PER_SEC = 24;

/** 文档一直不报 ready,多久之后认定它没起来 */
const READY_TIMEOUT_MS = 6000;

let channelSeq = 0;

/** UTF-8 → base64(btoa 只吃 Latin-1,中文必须先编码) */
function toBase64(text) {
    const bytes = new TextEncoder().encode(String(text == null ? '' : text));
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

/**
 * 沙箱里的引导脚本。
 *
 * ★ 这段代码是在**不透明源**里跑的,写法要保守:
 *   不用可选链、不用模板字符串(模板字符串的 ${ 在外层模板里还要再转义一次,
 *   看着就容易错),ES5 风格反而最不容易出岔子。
 * ★ 它自己**不能**出现 `</script`。
 */
const BOOTSTRAP = `
(function () {
    'use strict';

    function unb64(s) {
        var binary = atob(s);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        return new TextDecoder().decode(bytes);
    }

    var P = JSON.parse(unb64('__PAYLOAD__'));
    var stage = document.getElementById('stage');
    var listeners = { tint: [], resize: [] };
    var saveTimer = null;

    function post(type, payload) {
        try {
            parent.postMessage({ __hb: 1, channel: P.channel, type: type, payload: payload }, '*');
        } catch (err) { /* 通道断了就断了,不能反过来把用户代码搞崩 */ }
    }

    function reportError(err) {
        var msg = (err && err.message) ? err.message : String(err);
        post('error', msg);
    }

    function emit(type, arg) {
        var list = listeners[type] || [];
        for (var i = 0; i < list.length; i += 1) {
            try { list[i](arg); } catch (err) { reportError(err); }
        }
    }

    function applyVars() {
        var root = document.documentElement.style;
        var unit = Math.min(stage.clientWidth, stage.clientHeight);
        root.setProperty('--hb-unit', unit + 'px');
        root.setProperty('--tint', P.tint);
        root.setProperty('--htmlbubble-tint', P.tint);
    }

    var hb = {
        el: stage,
        tint: P.tint,
        state: P.state || {},
        get width() { return stage.clientWidth; },
        get height() { return stage.clientHeight; },
        get unit() { return Math.min(stage.clientWidth, stage.clientHeight); },
        sound: function (opts) { post('sound', opts || {}); },
        haptic: function (strength) { post('haptic', strength || 'light'); },
        notify: function (title, message) { post('notify', { title: title, message: message }); },
        save: function (patch) {
            if (patch && typeof patch === 'object') {
                for (var k in patch) {
                    if (Object.prototype.hasOwnProperty.call(patch, k)) hb.state[k] = patch[k];
                }
            }
            // 防抖:用户很可能在 pointermove 里每帧存一次
            if (saveTimer) clearTimeout(saveTimer);
            saveTimer = setTimeout(function () {
                saveTimer = null;
                try {
                    post('save', JSON.parse(JSON.stringify(hb.state)));
                } catch (err) {
                    reportError(new Error('存档里有存不下的东西(函数 / DOM 节点这些),只能存普通数据'));
                }
            }, 200);
        },
        on: function (type, fn) {
            if (listeners[type] && typeof fn === 'function') listeners[type].push(fn);
        },
    };
    window.hb = hb;

    window.addEventListener('message', function (ev) {
        var d = ev.data;
        if (!d || d.__hb !== 1 || d.channel !== P.channel) return;
        if (d.type === 'tint') {
            hb.tint = d.payload;
            P.tint = d.payload;
            applyVars();
            emit('tint', d.payload);
        }
    });

    window.addEventListener('error', function (ev) {
        post('error', ev.message + (ev.lineno ? '(第 ' + ev.lineno + ' 行附近)' : ''));
    });
    window.addEventListener('unhandledrejection', function (ev) {
        post('error', 'Promise 没接住:' + String(ev.reason));
    });

    if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(function () {
            applyVars();
            emit('resize', { width: stage.clientWidth, height: stage.clientHeight });
        }).observe(stage);
    }

    document.getElementById('hb-user-style').textContent = unb64(P.css);
    stage.innerHTML = unb64(P.html);

    function boot() {
        applyVars();
        // ★ 先报 ready 再跑用户代码 —— 用户代码抛错不该被当成「文档没起来」
        post('ready', { width: stage.clientWidth, height: stage.clientHeight });
        try {
            (new Function(unb64(P.js)))();
        } catch (err) {
            reportError(err);
        }
    }

    /*
     * ★ 必须等到第一次布局完成再跑用户代码。
     *   srcdoc 里的脚本是在解析过程中同步执行的,那一刻 iframe 往往还没排版,
     *   stage.clientWidth 读出来是 0。而用户代码的第一行几乎总是
     *   「把东西摆到画布中间」,也就是 hb.width / 2 —— 拿到 0 就全挤在左上角,
     *   而且因为不报错,查起来毫无线索。
     *   拿不到尺寸就等下一帧,最多等 20 帧(约 300ms)后照跑,不能无限等。
     */
    var bootTries = 0;
    (function waitLayout() {
        bootTries += 1;
        if ((stage.clientWidth > 0 && stage.clientHeight > 0) || bootTries > 20) {
            boot();
            return;
        }
        requestAnimationFrame(waitLayout);
    })();
})();
`;

/**
 * 拼出塞进 srcdoc 的整份文档。
 *
 * ★ 下面那个 <\/script> 的反斜杠不是手滑:本项目有 build:single
 *   (vite-plugin-singlefile)会把所有 JS 内联进一张 HTML,
 *   不转义的话这一行会在打包产物里提前闭合掉外层的 script 标签。
 *
 * ★ 导出出来是为了能被回归测到(tests/regression/__probe-relax-free-toy.mjs)。
 *   这段字符串是安全边界本身 —— CSP 少一条、sandbox 多一个 allow-same-origin,
 *   整套隔离就没了,而且从界面上完全看不出来。
 */
export function buildSandboxDoc(payload) {
    const boot = BOOTSTRAP.replace('__PAYLOAD__', toBase64(JSON.stringify(payload)));
    return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${SANDBOX_CSP}">
<style id="hb-base">
*, *::before, *::after { box-sizing: border-box; }
html, body {
    margin: 0; padding: 0; width: 100%; height: 100%;
    overflow: hidden; background: transparent;
}
body {
    -webkit-user-select: none; user-select: none;
    -webkit-tap-highlight-color: transparent;
    touch-action: none;
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #6b5560;
}
#stage { position: relative; width: 100%; height: 100%; display: grid; place-items: center; }
</style>
<style id="hb-user-style"></style>
</head>
<body>
<div id="stage"></div>
<script>${boot}<\/script>
</body>
</html>`;
}

/**
 * 在 container 里起一个沙箱,把用户的 HTML/CSS/JS 跑起来。
 *
 * @param {HTMLElement} container
 * @param {object} options
 * @param {string} options.html
 * @param {string} options.css
 * @param {string} options.js
 * @param {string} [options.tint]
 * @param {object} [options.values] 存档,进去之后是 hb.state
 * @param {(opts?: object) => void} [options.playSound]
 * @param {(strength?: string) => void} [options.haptic]
 * @param {(title: string, message: string) => void} [options.notify]
 * @param {(values: object) => void} [options.onPersist]
 * @param {(message: string) => void} [options.onError] 沙箱里报的错,原样交给外面显示
 * @returns {{ reload: (code?: object) => void, setTint: (hex: string) => void, reset: () => void, destroy: () => void }}
 */
export function createToySandbox(container, options = {}) {
    const playSound = typeof options.playSound === 'function' ? options.playSound : () => {};
    const haptic = typeof options.haptic === 'function' ? options.haptic : () => {};
    const notify = typeof options.notify === 'function' ? options.notify : () => {};
    const onPersist = typeof options.onPersist === 'function' ? options.onPersist : () => {};
    const onError = typeof options.onError === 'function' ? options.onError : () => {};

    const channel = `hbx${Date.now().toString(36)}${(channelSeq += 1)}`;

    let code = {
        html: String(options.html || ''),
        css: String(options.css || ''),
        js: String(options.js || ''),
    };
    let tint = options.tint || '#ffd6e0';
    let values = (options.values && typeof options.values === 'object') ? options.values : {};
    let ready = false;
    let destroyed = false;
    let readyTimer = null;

    // 出声预算,每秒回满
    let soundTokens = SOUND_BUDGET_PER_SEC;
    let tokenStamp = Date.now();

    const iframe = document.createElement('iframe');
    iframe.className = 'hbcode-frame';
    // ★ 只给 allow-scripts。加了 allow-same-origin 整套隔离立刻作废。
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('title', '我的捏捏');
    container.appendChild(iframe);

    function spendSound() {
        const now = Date.now();
        if (now - tokenStamp >= 1000) {
            soundTokens = SOUND_BUDGET_PER_SEC;
            tokenStamp = now;
        }
        if (soundTokens <= 0) return false;
        soundTokens -= 1;
        return true;
    }

    function handleMessage(event) {
        if (destroyed) return;
        // ★ 只认自己那个 iframe 发来的、带自己 channel 的消息。
        //   编辑页的预览沙箱和舞台上的沙箱可能同时活着,不分频道会互相串。
        if (event.source !== iframe.contentWindow) return;
        const data = event.data;
        if (!data || data.__hb !== 1 || data.channel !== channel) return;

        switch (data.type) {
            case 'ready':
                ready = true;
                if (readyTimer) {
                    clearTimeout(readyTimer);
                    readyTimer = null;
                }
                break;
            case 'sound': {
                if (!spendSound()) break;
                const opts = (data.payload && typeof data.payload === 'object') ? data.payload : {};
                playSound({
                    rate: Number.isFinite(Number(opts.rate)) ? Math.min(4, Math.max(0.25, Number(opts.rate))) : 1,
                });
                break;
            }
            case 'haptic':
                haptic(['light', 'medium', 'heavy'].includes(data.payload) ? data.payload : 'light');
                break;
            case 'notify': {
                const p = data.payload || {};
                notify(String(p.title || '').slice(0, 30), String(p.message || '').slice(0, 80));
                break;
            }
            case 'save':
                if (data.payload && typeof data.payload === 'object' && !Array.isArray(data.payload)) {
                    values = data.payload;
                    onPersist(values);
                }
                break;
            case 'error':
                onError(String(data.payload || '').slice(0, 300));
                break;
            default:
                break;
        }
    }

    function mount() {
        ready = false;
        if (readyTimer) clearTimeout(readyTimer);
        readyTimer = setTimeout(() => {
            readyTimer = null;
            if (!ready && !destroyed) {
                onError('这段代码没能跑起来 —— 多半是一开头就卡住了(比如写了死循环)。改完再点「重新运行」。');
            }
        }, READY_TIMEOUT_MS);

        iframe.srcdoc = buildSandboxDoc({
            channel,
            tint,
            state: values,
            html: toBase64(code.html),
            css: toBase64(code.css),
            js: toBase64(code.js),
        });
    }

    window.addEventListener('message', handleMessage);
    mount();

    return {
        /** 换代码 / 重跑。整份文档重建 —— 用户代码挂的定时器和监听跟着一起没 */
        reload(next) {
            if (destroyed) return;
            if (next) {
                if (typeof next.html === 'string') code.html = next.html;
                if (typeof next.css === 'string') code.css = next.css;
                if (typeof next.js === 'string') code.js = next.js;
            }
            mount();
        },
        setTint(hex) {
            tint = hex;
            if (ready) {
                try {
                    iframe.contentWindow?.postMessage({ __hb: 1, channel, type: 'tint', payload: hex }, '*');
                } catch { /* 还没起来就算了,下次 mount 会带上 */ }
            }
        },
        /**
         * 「恢复主体」。
         * ★ 清空存档 + 整份重跑,而不是给里面发个 reset 事件 ——
         *   发事件的话要指望用户自己写了复位逻辑,没写就是「点了没反应」。
         *   重跑是唯一一种「不管代码怎么写都一定回到初始状态」的做法。
         */
        reset() {
            values = {};
            onPersist({});
            mount();
        },
        destroy() {
            destroyed = true;
            if (readyTimer) {
                clearTimeout(readyTimer);
                readyTimer = null;
            }
            window.removeEventListener('message', handleMessage);
            iframe.remove();
        },
    };
}
