/**
 * 社交 App 注册表（框架级）
 * ====================================================================
 * 「社交 App」= 用户和 AI 会在里面**以某个形象出现**的 App：
 * murmur（聊天）、博客、日记……以后还会有别的。
 *
 * 这类 App 相比普通 App 多了三件事：
 *   1. 每个人设在这个 App 里有独立形象（网名 / 头像 / 背景）
 *      → 存在 `persona.socialProfiles[appId]`
 *   2. 人设编辑器（nook）里要有它的一张「社媒形象」卡
 *   3. 它的特殊能力要能进 AI 的上下文（走 toolkit.prompts）
 *
 * ── 为什么要有这个注册表 ──────────────────────────────
 * 2026-08-13 之前，第 2 条是**硬编码**的：
 * `js/apps/setting/persona/home-section.js` 里有一个写死的
 * `socialApps = [chat, blog, diary]` 数组，连图标 SVG 都内联在里面。
 *
 * 后果：想再做一个 murmur 那样的社交 App，除了写这个 App 本身，
 * 还得去改 settings 的人设编辑器 —— 而那是另一个 App 的内部实现。
 * 这违反了本项目「App 只通过 registerPhoneApp 一个口子接入」的基本约定，
 * 也是新 App 作者最容易漏的一步（漏了的症状是「人设页里没有我的 App」，
 * 而且完全没有报错）。
 *
 * 现在：App 在自己的 appConfig 里声明一段 `socialProfile`，
 * 注册时框架自动收进这张表，人设编辑器从表里读。
 *
 *     export default function createMyApp() {
 *         return {
 *             id: 'murmur2',
 *             name: '树洞',
 *             socialProfile: {
 *                 label: '树洞',            // 人设卡上显示的名字，默认取 app.name
 *                 icon: '<svg …>',          // 默认取 app.icon
 *                 iconBg: '#E8E2D9',        // 默认取 app.iconBg
 *                 desc: '匿名倾诉',          // 一句话说明（可选）
 *                 fields: ['nickname', 'avatar', 'background'],   // 要配哪些，默认这三样
 *             },
 *             …
 *         };
 *     }
 *
 * ── fields ──────────────────────────────────────
 * 合法取值见 `SOCIAL_PROFILE_FIELDS`。**只声明你真的会去读的那几样** ——
 * 人设卡按这个列表渲染输入框，声明了却没有消费方的字段，用户填完会静静
 * 存进 `persona.socialProfiles[appId]` 然后永远没人读。
 *
 * ── 注意 ──────────────────────────────────────────
 * 这里只是**声明**。真正读写数据的还是 `persona.socialProfiles[appId]`，
 * 字段结构不变，老数据不用迁移。
 */

/**
 * 人设卡上可以配的字段。
 * 想加新的一种，除了往这里加，还要在 nook 的 `home-section.js`
 * （渲染）和 `home-methods.js`（保存）里各接一处。
 */
export const SOCIAL_PROFILE_FIELDS = ['nickname', 'signature', 'pat', 'avatar', 'background'];

const DEFAULT_FIELDS = ['nickname', 'avatar', 'background'];

function normalizeFields(raw) {
    if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_FIELDS.slice();
    const kept = raw.filter((f) => SOCIAL_PROFILE_FIELDS.includes(f));
    const dropped = raw.filter((f) => !SOCIAL_PROFILE_FIELDS.includes(f));
    if (dropped.length) {
        console.warn('[social-app-registry] 未知的 socialProfile.fields，已忽略：', dropped);
    }
    return kept.length ? kept : DEFAULT_FIELDS.slice();
}

/** appId -> entry */
const REGISTRY = new Map();

/**
 * 注册一个社交 App。
 * 同 id 重复注册会覆盖（App 热重载时会重复走注册流程，覆盖是对的）。
 *
 * @param {object} spec
 * @param {string} spec.id       App id，同时也是 socialProfiles 的键
 * @param {string} spec.label    人设卡上显示的名字
 * @param {string} [spec.icon]   图标 HTML（inline SVG）
 * @param {string} [spec.iconBg] 图标底色（CSS background 值），少了它图标会飘在白底上
 * @param {string} [spec.desc]   一句话说明
 * @param {string[]} [spec.fields] 要配置哪些字段，见 SOCIAL_PROFILE_FIELDS
 * @param {number} [spec.order]  人设页里的排序，小的在前
 */
export function registerSocialApp(spec) {
    const id = String(spec?.id || '').trim();
    if (!id) {
        console.warn('[social-app-registry] 缺少 id，忽略这次注册', spec);
        return false;
    }
    REGISTRY.set(id, {
        id,
        label: String(spec.label || spec.name || id),
        icon: spec.icon || '',
        iconBg: String(spec.iconBg || ''),
        desc: String(spec.desc || ''),
        fields: normalizeFields(spec.fields),
        order: Number.isFinite(spec.order) ? spec.order : 100,
        builtin: !!spec.builtin,
    });
    // 人设页正开着时通知它重画一次，不然要退出重进才看得到新卡
    try {
        window.dispatchEvent(new CustomEvent('phone:social-apps-changed', { detail: { id } }));
    } catch (_) { /* 事件失败不影响注册 */ }
    return true;
}

export function unregisterSocialApp(id) {
    const ok = REGISTRY.delete(String(id || ''));
    if (ok) {
        try {
            window.dispatchEvent(new CustomEvent('phone:social-apps-changed', { detail: { id } }));
        } catch (_) {}
    }
    return ok;
}

/** 按 order 排好的全部社交 App */
export function listSocialApps() {
    return Array.from(REGISTRY.values()).sort((a, b) => a.order - b.order);
}

export function getSocialApp(id) {
    return REGISTRY.get(String(id || '')) || null;
}

export function isSocialApp(id) {
    return REGISTRY.has(String(id || ''));
}

/**
 * 由 app-registry 在注册每个 App 时调用：
 * appConfig 里声明了 `socialProfile` 就自动收进表。
 * 没声明的 App 什么都不做（绝大多数 App 都不是社交 App）。
 */
export function registerSocialAppFromConfig(appConfig) {
    const decl = appConfig?.socialProfile;
    if (!decl) return false;
    return registerSocialApp({
        id: appConfig.id,
        label: decl.label || appConfig.name || appConfig.id,
        // 图标和底色是一对：桌面上底色由框架画在 app-shell 外面，
        // 只搬 icon 不搬 iconBg 的话，人设卡上就是一个飘在白底上的图形。
        icon: decl.icon || appConfig.icon || '',
        iconBg: decl.iconBg || appConfig.iconBg || '',
        desc: decl.desc || '',
        fields: decl.fields,
        order: decl.order,
    });
}

// ============================================================
// 这里曾经预注册过 chat / blog / diary 三条。
//
// 当时的理由是「blog / diary 还没有对应的 App，删了那两张卡会消失」。
// 现在三个 id 的归属都变了：
//   chat  → chat-app 自己声明（murmur）
//   blog  → blog-app 自己声明（氧气），预注册那条「博客」只是被覆盖掉的死码
//   diary → diary-app 存在，但日记是私人日记本，没有「社媒形象」这回事，
//           它**故意**不声明 socialProfile。全局也搜不到一处读
//           socialProfiles.diary —— 那张卡填了等于扔。
//
// 所以三条全部删掉：一个 App 出不出现在人设页，只由它自己的声明决定。
// ============================================================

export default registerSocialApp;
