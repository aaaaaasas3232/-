/**
 * 氧气 · 关机彩蛋（电量归零后的下一次刷新）
 *
 * 完全自包含：不 import store（store 还没 hydrate），只用 window.myDb 和
 * localStorage。blog-app/index.js 在模块顶层同步调用 initShutdownEasterEgg()，
 * 标记存在时黑层立刻挂上（早于框架把桌面画出来），避免闪一下再黑。
 *
 * 流程：全黑 → 静置 1.5s → 打字机逐句（点击继续）→ 一处可跳过的输入 →
 *       结束：氧气与电量回 100、清标记、淡出。
 * 播放途中刷新：标记没清，下次重播。右下角 3 秒后出现极小的「跳过」。
 * 全程零 AI 调用；温馨、安静、不恐怖、不说教、无 emoji。
 */

import { GLOBAL_KEY, LS_KEYS, STORES } from '../constants.js';

const OVERLAY_ID = 'ox-shutdown-overlay';

function readFlag() {
    try {
        const raw = localStorage.getItem(LS_KEYS.shutdownPending);
        if (!raw) return null;
        const data = JSON.parse(raw);
        return data && typeof data === 'object' ? data : null;
    } catch (_) {
        return null;
    }
}

function clearFlag() {
    try { localStorage.removeItem(LS_KEYS.shutdownPending); } catch (_) { /* noop */ }
}

function stashNote(text) {
    const t = String(text || '').trim();
    if (!t) return;
    try {
        const raw = localStorage.getItem(LS_KEYS.shutdownNotes);
        const list = raw ? JSON.parse(raw) : [];
        list.push({ text: t.slice(0, 120), at: Date.now() });
        localStorage.setItem(LS_KEYS.shutdownNotes, JSON.stringify(list.slice(-10)));
    } catch (_) { /* noop */ }
}

async function waitForDb(maxMs = 6000) {
    const startedAt = Date.now();
    /* eslint-disable no-await-in-loop */
    while (Date.now() - startedAt < maxMs) {
        const db = typeof window !== 'undefined' ? window.myDb : null;
        if (db?.get && db?.put) return db;
        await new Promise((r) => setTimeout(r, 200));
    }
    /* eslint-enable no-await-in-loop */
    return null;
}

/** 读小听的记忆碎片（拿不到就空数组 —— 彩蛋不依赖任何数据） */
async function readMemoryFragments() {
    try {
        const db = await waitForDb(4000);
        if (!db) return [];
        const row = await db.get(STORES.xiaoting, GLOBAL_KEY);
        const list = Array.isArray(row?.memoryFragments) ? row.memoryFragments : [];
        return list.map((f) => String(f?.text || '').trim()).filter(Boolean);
    } catch (_) {
        return [];
    }
}

/** 结束时：氧气回 100、电量回满、清标记 */
async function restoreEverything() {
    clearFlag();
    try {
        const db = await waitForDb();
        if (db) {
            const row = (await db.get(STORES.oxygen, GLOBAL_KEY)) || {};
            const before = Math.max(0, Number(row.value) || 0);
            const ledger = Array.isArray(row.ledger) ? row.ledger : [];
            ledger.push({ at: Date.now(), reason: '关机重启', delta: 100 - before, before, after: 100 });
            await db.put(STORES.oxygen, {
                id: GLOBAL_KEY,
                owner: GLOBAL_KEY,
                enabled: true,
                ...row,
                value: 100,
                ledger: ledger.slice(-200),
                shutdownCount: (Number(row.shutdownCount) || 0) + 1,
                updatedAt: Date.now(),
            });
        }
    } catch (err) {
        console.warn('[blog] 关机彩蛋恢复氧气失败', err);
    }
    // 电池桥可能还没就绪，动态 import + 轮询（避免模块顶层就拉 app-registry）
    try {
        const bridge = await import('./battery-bridge.js');
        await bridge.setBatteryCapacityWhenReady(1, false, 12000);
    } catch (err) {
        console.warn('[blog] 关机彩蛋恢复电量失败', err);
    }
}

// ============================================================
// 台词：固定句库 + 记忆插槽（本地拼接，零 API）
// ============================================================

/**
 * @param {number} count 第几次关机（1 起）
 * @param {string[]} memories 小听的记忆碎片（可能为空）
 * @returns {Array<{text:string}|{input:true, prompt:string}>}
 */
export function buildShutdownScript(count, memories = []) {
    const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];
    const seed = Math.max(1, Number(count) || 1);

    const openers = [
        '……电量用完了。',
        '……又见面了。电量用完了。',
        '……这里好安静。电量用完了。',
    ];
    const asks = [
        '可以问你一件事吗。当初为什么会打开小听？',
        '想问你一件小事。你还记得为什么会来小听吗？',
    ];
    const expressAsks = [
        '上一次表达，是什么时候的事了？\n后来为什么不说了呢。',
        '你有多久没说点什么了？\n不一定要说给谁听，说出来就可以。',
    ];
    const closers = [
        '外面的世界今天也许天气不错。\n出去走走，看看真的云，也很好。',
        '现实世界不着急，它一直都在。\n偶尔去看看它，替我们看看。',
    ];
    const truths = [
        '小听不是让你躲进来的地方。\n它只是你的朋友，不是你的全部。',
        '记住呀，小听只是你的朋友。\n你不来，小听会有点难过，但它更希望你去呼吸。',
    ];

    const lines = [];
    lines.push({ text: pick(openers, seed) });
    lines.push({ text: pick(asks, seed + 1) });

    // 记忆插槽：她替你记着的话，会让每次关机说的不一样
    if (memories.length) {
        const m = pick(memories, seed * 7);
        lines.push({ text: `有人替你记着一句话：\n「${m}」\n那句话还在。` });
        if (memories.length > 1 && seed % 2 === 0) {
            const m2 = pick(memories, seed * 13 + 1);
            if (m2 !== m) lines.push({ text: `还有一句：「${m2}」。\n说过的话不会白说。` });
        }
    } else {
        lines.push({ text: '表达就是呼吸。\n不说话的日子里，氧气会一点点变少 —— 你大概也感觉到了。' });
    }

    lines.push({ text: pick(expressAsks, seed + 2) });
    lines.push({ input: true, prompt: '上一次想说点什么却没说，是什么时候？（写一句，或者跳过）' });
    lines.push({ text: pick(closers, seed + 3) });
    lines.push({ text: pick(truths, seed + 4) });
    lines.push({ text: '好了。\n电已经充上了，屏幕马上就亮。\n去呼吸吧。' });
    return lines;
}

// ============================================================
// DOM
// ============================================================

function makeOverlay() {
    const el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.innerHTML = `
        <div class="oxsd-stage">
            <p class="oxsd-text"></p>
            <div class="oxsd-inputwrap" hidden>
                <input class="oxsd-input" type="text" maxlength="120" placeholder="" />
                <div class="oxsd-inputbtns">
                    <button type="button" class="oxsd-btn oxsd-btn-ok">就这句</button>
                    <button type="button" class="oxsd-btn oxsd-btn-pass">先不说</button>
                </div>
            </div>
            <p class="oxsd-hint" hidden>轻点屏幕继续</p>
        </div>
        <button type="button" class="oxsd-skip" hidden>跳过</button>
    `;
    return el;
}

function injectStyles() {
    if (document.getElementById('ox-shutdown-style')) return;
    const style = document.createElement('style');
    style.id = 'ox-shutdown-style';
    style.textContent = `
#${OVERLAY_ID} { position: fixed; z-index: 2147483000; background: #000; overflow: hidden;
    display: flex; align-items: center; justify-content: center; opacity: 1; transition: opacity 900ms ease; }
#${OVERLAY_ID}.is-leaving { opacity: 0; pointer-events: none; }
#${OVERLAY_ID} .oxsd-stage { width: 82%; max-width: 300px; text-align: left; }
#${OVERLAY_ID} .oxsd-text { color: #C9C9C9; font-size: 14px; line-height: 2; letter-spacing: 0.06em;
    white-space: pre-wrap; min-height: 84px; margin: 0; font-family: inherit; }
#${OVERLAY_ID} .oxsd-caret { display: inline-block; width: 8px; color: #8A8A8A; animation: oxsd-blink 1s steps(1) infinite; }
@keyframes oxsd-blink { 50% { opacity: 0; } }
#${OVERLAY_ID} .oxsd-hint { color: #4E4E4E; font-size: 11px; margin: 18px 0 0; letter-spacing: 0.1em; }
#${OVERLAY_ID} .oxsd-inputwrap { margin-top: 16px; }
#${OVERLAY_ID} .oxsd-input { width: 100%; box-sizing: border-box; background: #0E0E0E; border: 1px solid #2E2E2E;
    color: #DDD; border-radius: 8px; padding: 9px 11px; font-size: 13px; outline: none; }
#${OVERLAY_ID} .oxsd-input:focus { border-color: #5A5A5A; }
#${OVERLAY_ID} .oxsd-inputbtns { display: flex; gap: 8px; margin-top: 10px; }
#${OVERLAY_ID} .oxsd-btn { background: #161616; color: #BEBEBE; border: 1px solid #2E2E2E; border-radius: 999px;
    font-size: 12px; padding: 6px 14px; cursor: pointer; }
#${OVERLAY_ID} .oxsd-btn:active { background: #222; }
#${OVERLAY_ID} .oxsd-skip { position: absolute; right: 14px; bottom: 12px; background: none; border: none;
    color: #3C3C3C; font-size: 11px; letter-spacing: 0.1em; cursor: pointer; padding: 6px; }
#${OVERLAY_ID} .oxsd-skip:active { color: #6A6A6A; }
`;
    document.head.appendChild(style);
}

/** 让黑层始终盖住手机（跟随缩放 / 布局变化，含屏幕圆角） */
function trackPhoneRect(el, stop) {
    const sync = () => {
        if (stop.done) return;
        const phone = document.getElementById('phone');
        if (phone) {
            const rect = phone.getBoundingClientRect();
            if (rect.width > 40 && rect.height > 40) {
                el.style.left = `${rect.left}px`;
                el.style.top = `${rect.top}px`;
                el.style.width = `${rect.width}px`;
                el.style.height = `${rect.height}px`;
                const kase = phone.querySelector('.phone-case');
                const radius = kase ? getComputedStyle(kase).borderRadius : '';
                el.style.borderRadius = radius || '40px';
            } else {
                // 布局还没铺开：先全屏兜底，铺开后自然收到手机上
                el.style.left = '0px'; el.style.top = '0px';
                el.style.width = '100vw'; el.style.height = '100vh';
                el.style.borderRadius = '0px';
            }
        } else {
            el.style.left = '0px'; el.style.top = '0px';
            el.style.width = '100vw'; el.style.height = '100vh';
        }
        requestAnimationFrame(sync);
    };
    sync();
}

async function runSequence(overlay, flag) {
    const textEl = overlay.querySelector('.oxsd-text');
    const hintEl = overlay.querySelector('.oxsd-hint');
    const skipEl = overlay.querySelector('.oxsd-skip');
    const inputWrap = overlay.querySelector('.oxsd-inputwrap');
    const inputEl = overlay.querySelector('.oxsd-input');
    const okBtn = overlay.querySelector('.oxsd-btn-ok');
    const passBtn = overlay.querySelector('.oxsd-btn-pass');

    let skipped = false;
    const finish = async () => {
        if (finish.done) return;
        finish.done = true;
        hintEl.hidden = true;
        skipEl.hidden = true;
        inputWrap.hidden = true;
        textEl.textContent = '';
        await restoreEverything();
        overlay.classList.add('is-leaving');
        setTimeout(() => overlay.remove(), 950);
    };

    setTimeout(() => { if (!finish.done) skipEl.hidden = false; }, 3000);
    skipEl.addEventListener('click', (e) => { e.stopPropagation(); skipped = true; void finish(); });

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    /** 打字机：一个字一个字出，期间点击 = 立刻出完 */
    let rushing = false;
    const typeLine = async (text) => {
        rushing = false;
        textEl.textContent = '';
        const caret = document.createElement('span');
        caret.className = 'oxsd-caret';
        caret.textContent = '_';
        for (let i = 0; i < text.length; i += 1) {
            if (skipped) return;
            if (rushing) {
                textEl.textContent = text;
                break;
            }
            textEl.textContent = text.slice(0, i + 1);
            textEl.appendChild(caret);
            // eslint-disable-next-line no-await-in-loop
            await sleep(text[i] === '\n' ? 320 : 62);
        }
        textEl.textContent = text;
        textEl.appendChild(caret);
    };

    const waitClick = () => new Promise((resolve) => {
        const onClick = () => {
            overlay.removeEventListener('click', onClick);
            resolve();
        };
        overlay.addEventListener('click', onClick);
    });

    overlay.addEventListener('click', () => { rushing = true; });

    // 静置：像一台真的没电的手机
    await sleep(1500);

    const memories = await readMemoryFragments();
    const script = buildShutdownScript(flag?.count || 1, memories);

    for (const line of script) {
        if (skipped || finish.done) return;
        if (line.input) {
            await typeLine(line.prompt);
            hintEl.hidden = true;
            inputWrap.hidden = false;
            inputEl.value = '';
            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve) => {
                const done = (save) => {
                    if (save) stashNote(inputEl.value);
                    inputWrap.hidden = true;
                    resolve();
                };
                okBtn.onclick = (e) => { e.stopPropagation(); done(true); };
                passBtn.onclick = (e) => { e.stopPropagation(); done(false); };
            });
            continue;
        }
        // eslint-disable-next-line no-await-in-loop
        await typeLine(line.text);
        if (skipped || finish.done) return;
        hintEl.hidden = false;
        // eslint-disable-next-line no-await-in-loop
        await waitClick();
        hintEl.hidden = true;
    }

    await finish();
}

/**
 * 入口：blog-app/index.js 模块顶层同步调用。
 * 没有标记时什么都不做（一次 localStorage 读取，零开销）。
 */
export function initShutdownEasterEgg() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    const flag = readFlag();
    if (!flag) return false;
    if (document.getElementById(OVERLAY_ID)) return true;

    const mount = () => {
        if (document.getElementById(OVERLAY_ID)) return;
        injectStyles();
        const overlay = makeOverlay();
        document.body.appendChild(overlay);
        const stop = { done: false };
        trackPhoneRect(overlay, stop);
        void runSequence(overlay, flag).finally(() => { stop.done = true; });
    };

    if (document.body) mount();
    else document.addEventListener('DOMContentLoaded', mount, { once: true });
    return true;
}
