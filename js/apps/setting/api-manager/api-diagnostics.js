/**
 * API 诊断层
 * ====================================================================
 * 把「一串看不懂的报错」翻译成「这是什么问题 + 你该怎么办」。
 *
 * 为什么值得单独一个文件：
 *   API 配错是这个项目里**用户唯一会自己撞上、又完全无法自查**的一类问题。
 *   之前失败时只弹一句 `测试失败 401 {"error":{"message":…}}` ——
 *   对开发者够用，对用户等于什么都没说。而且这条信息只在灵动岛上闪 3.5 秒，
 *   想截图问人都来不及。
 *
 * 这一层做三件事：
 *   1. **分类**：把 HTTP 状态码 / 网络异常 / 返回体，映射到一个稳定的错误码
 *      （`API-401` 这种）。错误码是给用户截图用的 —— 有个码，
 *      他去问别人、去搜文档、去问 AI，都有一个能对上的关键词。
 *   2. **给结论和动作**：每一类都写清「大概率是什么原因」和「先试哪一步」。
 *   3. **产出可复制的报告**：一段纯文本，用户可以整段贴给 AI 或者贴到群里问。
 *      报告里**绝不包含 API Key 全文**（只留前后各 4 位），
 *      否则用户一截图就把密钥泄漏了。
 *
 * 分类原则：宁可给一个偏保守的结论，也不要猜。
 * 猜错方向比不给结论更浪费时间 —— 用户会顺着错的方向查半小时。
 */

/**
 * 错误目录。
 * `code` 一旦发布就不要改（用户会截图、会搜索）；文案可以改。
 */
const CATALOG = {
    'API-NETWORK': {
        title: '连不上服务器',
        cause: '请求根本没送到对方服务器。常见于：Base URL 写错、需要代理但没填、断网、或者对方站点挂了。',
        fixes: [
            '检查 Base URL 是不是完整的地址（要带 https://，通常以 /v1 结尾）',
            'Base URL 末尾**不要**自己加 /chat/completions —— 系统会自动补',
            '如果这个服务在你的网络下需要中转，把中转地址填到「代理 URL」',
            '换个网络环境再试一次',
        ],
    },
    'API-TIMEOUT': {
        title: '等太久，超时了',
        cause: '请求送出去了但对方一直没回。可能是模型太慢、也可能是中转节点卡住了。',
        fixes: [
            '把「超时时间」调大一些（默认 60 秒，慢模型可以给到 120）',
            '换一个更快的模型试试，确认是模型慢还是线路慢',
            '如果每次都卡在同一个时长，多半是中转节点的问题，换个中转',
        ],
    },
    'API-401': {
        title: 'Key 没被接受',
        cause: 'API Key 不对、已过期、或者被复制时多带了空格/换行。',
        fixes: [
            '重新复制一次 Key，注意别把前后的空格和换行一起粘进来',
            '确认这个 Key 属于你填的这个 Base URL（不同服务商的 Key 不通用）',
            '如果服务商要求自定义鉴权头，把头名字填到「Auth Header」字段',
        ],
    },
    'API-403': {
        title: '这个 Key 没有权限',
        cause: 'Key 是真的，但不允许访问这个模型或这个接口。也可能是地区限制。',
        fixes: [
            '换一个你确定有权限的模型名试试',
            '去服务商后台确认这个 Key 开通了哪些模型',
            '有地区限制的服务需要配合中转使用',
        ],
    },
    'API-404': {
        title: '地址或模型找不到',
        cause: '最常见的是 Base URL 多写/少写了一段路径，其次是模型名拼错。',
        fixes: [
            'Base URL 一般写到 /v1 为止，例如 https://api.example.com/v1',
            '不要在 Base URL 里带 /chat/completions',
            '模型名要跟服务商文档里的写法一字不差（大小写、连字符都算）',
        ],
    },
    'API-429': {
        title: '被限流了',
        cause: '短时间内请求太多，或者账户额度用完了。',
        fixes: [
            '等一两分钟再试',
            '去服务商后台看余额和速率限制',
            '如果经常撞到，可以建一个「API 分组」放多个 Key 轮换',
        ],
    },
    'API-5XX': {
        title: '对方服务器出错了',
        cause: '不是你的配置问题，是服务商那边挂了或者过载。',
        fixes: [
            '过几分钟再试',
            '换一个 Key / 换一个中转确认是不是单点问题',
        ],
    },
    'API-BADJSON': {
        title: '返回的东西不是预期格式',
        cause: '连上了、也有响应，但返回的不是标准的 OpenAI 格式。通常是 Base URL 指到了一个网页而不是 API，或者中转返回了一个错误页。',
        fixes: [
            '确认 Base URL 指向的是 API 接口而不是网站首页',
            '如果用了中转，直连试一次，确认是中转的问题还是源站的问题',
        ],
    },
    'API-EMPTY': {
        title: '通了，但没有内容',
        cause: '请求成功、返回结构也对，但正文是空的。多见于模型被内容策略拦下，或者 max_tokens 给得太小。',
        fixes: [
            '换一句普通的话再试（测试用的是 "hi"，正常不会被拦）',
            '检查这个模型是不是需要额外的参数才能出内容',
        ],
    },
    'API-CONFIG': {
        title: '配置还没填完',
        cause: 'Base URL / API Key / 模型三个必填项里有空的。',
        fixes: ['把三个必填项都填上再测试'],
    },
    'API-UNKNOWN': {
        title: '没能识别的错误',
        cause: '这个错误不在已知目录里。下面的原始信息是完整的，可以拿去问人。',
        fixes: ['把下面的「诊断报告」整段复制出去问一下'],
    },
};

/**
 * 把一次失败归类。
 *
 * @param {object} input
 * @param {number} [input.status]  HTTP 状态码，网络层失败传 0
 * @param {string} [input.body]    响应体（截断过的）
 * @param {Error}  [input.err]     fetch 抛出来的异常
 * @param {boolean}[input.emptyContent] HTTP 成功但正文为空
 * @param {boolean}[input.badJson]      HTTP 成功但 JSON 解析不了
 * @returns {{ code:string, title:string, cause:string, fixes:string[] }}
 */
export function classifyApiError(input = {}) {
    const { status = 0, err = null, emptyContent = false, badJson = false } = input;
    let code = 'API-UNKNOWN';

    if (err) {
        const name = String(err.name || '');
        const msg = String(err.message || '');
        // AbortSignal.timeout 抛的是 TimeoutError；老浏览器可能是 AbortError
        if (name === 'TimeoutError' || /timeout|timed out/i.test(msg)) code = 'API-TIMEOUT';
        else code = 'API-NETWORK';
    } else if (badJson) {
        code = 'API-BADJSON';
    } else if (emptyContent) {
        code = 'API-EMPTY';
    } else if (status === 401) code = 'API-401';
    else if (status === 403) code = 'API-403';
    else if (status === 404) code = 'API-404';
    else if (status === 429) code = 'API-429';
    else if (status >= 500) code = 'API-5XX';
    else if (status >= 400) code = 'API-UNKNOWN';

    return { code, ...CATALOG[code] };
}

/** Key 只留头尾各 4 位。诊断报告是拿去截图 / 发给别人的，绝不能带全文。 */
export function maskSecret(value) {
    const s = String(value || '');
    if (!s) return '(空)';
    if (s.length <= 10) return `${s.slice(0, 2)}****`;
    return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

/**
 * 生成一段可以整段复制走的诊断报告。
 * 用户可以贴给 AI、贴到群里问 —— 所以要自带上下文，
 * 但不能带密钥全文。
 */
export function buildDiagnosticReport({ key, status, body, err, diag, latency }) {
    const lines = [];
    lines.push(`【小听 · API 诊断报告】`);
    lines.push(`错误码: ${diag.code}（${diag.title}）`);
    lines.push('');
    lines.push('— 配置 —');
    lines.push(`Base URL : ${key?.baseUrl || '(空)'}`);
    lines.push(`代理 URL : ${key?.proxyUrl || '(未填)'}`);
    lines.push(`模型     : ${key?.model || '(空)'}`);
    lines.push(`鉴权头   : ${key?.authHeader || 'Authorization: Bearer（默认）'}`);
    lines.push(`API Key  : ${maskSecret(key?.apiKey)}`);
    lines.push(`超时     : ${key?.timeout || 60} 秒`);
    lines.push('');
    lines.push('— 这次请求 —');
    lines.push(`HTTP 状态: ${status || '(没收到响应)'}`);
    if (latency != null) lines.push(`耗时     : ${latency}ms`);
    if (err) lines.push(`异常     : ${err.name || 'Error'}: ${err.message || String(err)}`);
    if (body) lines.push(`响应体   : ${String(body).slice(0, 400)}`);
    lines.push('');
    lines.push('— 可能原因 —');
    lines.push(diag.cause);
    lines.push('');
    lines.push('— 建议依次尝试 —');
    diag.fixes.forEach((f, i) => lines.push(`${i + 1}. ${f}`));
    return lines.join('\n');
}

/**
 * 「修复窗口」：把用户粘进来的一段配置解析成可写回的字段。
 *
 * 支持三种写法，因为用户拿到的东西形态各异：
 *   1. JSON：`{"baseUrl":"https://…","apiKey":"sk-…","model":"gpt-4o"}`
 *   2. 每行 `键: 值`：`baseUrl: https://…`
 *   3. .env 风格：`OPENAI_API_BASE=https://…`
 *
 * 键名做了别名归一（base_url / BASE_URL / OPENAI_API_BASE 都认 baseUrl），
 * 因为「让用户先把键名改对再粘」等于没做这个功能。
 *
 * ⚠️ 不认识的键**跳过而不是整段失败** —— 用户多半是从别处整段拷来的，
 *    里面混着别的东西很正常（同 AGENTS2 §13.5.5 批量配色的处理方式）。
 *
 * @returns {{ ok:boolean, patch:object, recognized:string[], ignored:string[], error?:string }}
 */
export function parseRepairSnippet(text) {
    const src = String(text || '').trim();
    if (!src) return { ok: false, patch: {}, recognized: [], ignored: [], error: '没有内容' };

    const ALIASES = {
        baseurl: 'baseUrl', base_url: 'baseUrl', base: 'baseUrl',
        openai_api_base: 'baseUrl', openai_base_url: 'baseUrl', endpoint: 'baseUrl', url: 'baseUrl',
        apikey: 'apiKey', api_key: 'apiKey', key: 'apiKey', token: 'apiKey',
        openai_api_key: 'apiKey', secret: 'apiKey',
        model: 'model', model_name: 'model', modelname: 'model',
        proxyurl: 'proxyUrl', proxy_url: 'proxyUrl', proxy: 'proxyUrl',
        authheader: 'authHeader', auth_header: 'authHeader',
        timeout: 'timeout', label: 'label', name: 'label',
    };
    const NUMERIC = new Set(['timeout']);

    const raw = {};
    // 先试 JSON（最常见的粘贴形态）
    const jsonStart = src.indexOf('{');
    const jsonEnd = src.lastIndexOf('}');
    let parsedJson = false;
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
        try {
            const obj = JSON.parse(src.slice(jsonStart, jsonEnd + 1));
            if (obj && typeof obj === 'object') {
                Object.assign(raw, obj);
                parsedJson = true;
            }
        } catch (_) { /* 不是合法 JSON 就走逐行解析 */ }
    }
    if (!parsedJson) {
        for (const line of src.split(/\r?\n/)) {
            const m = line.match(/^\s*(?:export\s+)?["']?([A-Za-z_][A-Za-z0-9_.-]*)["']?\s*[:=]\s*(.+?)\s*$/);
            if (!m) continue;
            let v = m[2].trim();
            // 去掉包裹的引号和行尾逗号
            v = v.replace(/,$/, '').replace(/^["'](.*)["']$/, '$1');
            raw[m[1]] = v;
        }
    }

    const patch = {};
    const recognized = [];
    const ignored = [];
    for (const [k, v] of Object.entries(raw)) {
        const field = ALIASES[String(k).toLowerCase().replace(/[.-]/g, '_')]
            || ALIASES[String(k).toLowerCase()];
        if (!field) { ignored.push(k); continue; }
        if (v === null || v === undefined || v === '') continue;
        patch[field] = NUMERIC.has(field) ? (Number(v) || undefined) : String(v).trim();
        recognized.push(field);
    }

    if (recognized.length === 0) {
        return {
            ok: false, patch: {}, recognized: [], ignored,
            error: '没认出任何一项配置。支持 JSON、`键: 值` 每行一条、或者 .env 那种 KEY=VALUE。',
        };
    }
    // Base URL 的两个高频错误顺手纠正掉 —— 这两个占了 404 的绝大多数
    if (patch.baseUrl) {
        patch.baseUrl = patch.baseUrl
            .replace(/\/chat\/completions\/?$/i, '')   // 多写了接口路径
            .replace(/\/+$/, '');                       // 末尾多余的斜杠
    }
    return { ok: true, patch, recognized: [...new Set(recognized)], ignored };
}

/**
 * 科普页内容。
 * 写给「不知道 API 是什么」的用户看，所以先解释概念、再列常见问题。
 */
export const API_FAQ = [
    {
        q: 'API 到底是什么？它是一种软件吗？',
        a: '可以先把它理解成程序之间沟通的接口和约定。它规定一方怎样发出请求，另一方怎样返回结果。'
            + 'API 本身不是一个聊天软件，也不是某个模型；小听按照这套约定，把你的文字交给模型服务，再接回回复。',
    },
    {
        q: 'API Key 是账号密码吗？',
        a: '不完全是。它更像服务平台发给程序的一把访问钥匙，用来证明这次请求有权使用对应的服务，但它不等同于你的账号和登录密码。'
            + '拿到 Key 的人可能消耗你的额度或访问你获准使用的接口，所以它必须保密，不要发全文，也不要放进公开截图。',
    },
    {
        q: 'LLM、API 和 App 是什么关系？',
        a: '这几个词很容易混在一起。LLM 是负责理解和生成文本的大语言模型，通常运行在服务商的服务器上。'
            + 'App 是你正在使用的界面；它通过 API 调用远端的 LLM。模型并不是“内置在 API 里”，API 只是 App 与模型服务沟通的方式。',
    },
    {
        q: 'Token 是什么？一个汉字等于几个 Token？',
        a: 'Token 是模型切分和处理文本时使用的单位。你发出的输入和模型返回的输出通常都会计入用量，系统提示、人设和历史对话也可能属于输入。'
            + '中文字符与 Token 没有固定换算关系，同一句话在不同模型的 tokenizer 下可能得到不同数量，只能以对应模型或平台的统计为准。',
    },
    {
        q: 'OpenAI、ChatGPT、GPT、Claude、Gemini、DeepSeek 分别是什么？',
        a: '名字很多，边界也会随各家的产品安排变化，但可以先分清公司、终端产品和模型系列。'
            + 'OpenAI、Anthropic、Google、DeepSeek 等是公司或模型服务商；ChatGPT 是 OpenAI 面向用户的终端产品，GPT 是模型系列。'
            + 'Claude、Gemini、DeepSeek 这些名字在不同语境里既可能指产品，也可能指模型系列，填写 API 时应以服务平台文档里的模型名为准。',
    },
    {
        q: '火山引擎、硅基流动也是一种 LLM 吗？',
        a: '不是某一个固定的 LLM。它们是能够提供模型 API 的云平台或服务平台，平台上可能同时有多个来源、多个系列的模型。'
            + '你实际调用的是平台提供的某个模型，计费、Key、Base URL 和模型名则由这个平台规定。',
    },
    {
        q: '不是包月 API，我该从哪里开始？',
        a: '我不能替你决定用哪一个模型或平台，但准备顺序是明确的：先确定要使用的模型，以及哪一个服务平台提供它；'
            + '再到该平台注册并按要求充值或开通 API，获取 Key，然后填写这个平台给出的 Base URL 和准确模型名。'
            + '使用前还要看清输入与输出怎样计费、账户余额、速率限制和模型的上下文长度。终端产品的订阅通常不等于 API 额度，仍应以服务平台说明为准。',
    },
    {
        q: '同一个模型可以从不同平台调用吗？',
        a: '有可能。同一个模型可能由官方平台提供，也可能由第三方平台接入。'
            + '但一组配置必须来自同一个平台：Key、Base URL 和模型名要彼此对应，不能拿官方 Key 配第三方 Base URL，也不能照搬另一家平台的模型名。',
    },
    {
        q: '我的 Key 会被上传吗？',
        a: '小听把 Key 保存在当前浏览器的本地数据库里，不会交给小听自己的服务器。发起模型请求时，Key 会被送到你配置的请求目标：'
            + '直连时是 Base URL，填写代理 URL 后则会经过该代理。代理同样可能接触到 Key，所以只应填写你信任的地址。'
            + '换浏览器或清除本地数据后，通常需要重新填写。',
    },
    {
        q: 'Base URL 该填到哪一层？',
        a: '它没有对所有平台都通用的唯一写法，应先看你所用平台的 API 文档。对于这里支持的 OpenAI 兼容接口，常见写法会到 /v1 为止，例如 https://api.example.com/v1。'
            + '不要自己接上 /chat/completions，系统会补上这段路径；多写或少写路径都可能得到 404。',
    },
    {
        q: '「代理 URL」什么时候要填？',
        a: '当这个服务在你的网络下直连不通、需要走一个中转地址时才填。'
            + '填了之后请求会发到代理地址，Base URL 只用来做标识。代理不是必填项，也不能修复错误的 Key 或模型名；不确定时先留空。',
    },
    {
        q: '模型名要怎么写？',
        a: '这里填写的是平台实际接受的模型标识，不一定等于网页上展示的名称。'
            + '它要和服务平台文档上的写法一字不差，大小写、连字符和前缀都可能有意义。用哪一个平台，就以哪一个平台的模型列表为准。',
    },
    {
        q: '为什么测试通过了，聊天还是失败？',
        a: '测试只能确认一条很短的请求是否能走通，不能保证所有真实对话都成功。'
            + '真实对话还会带上人设、系统提示和历史上下文，可能超过模型的上下文限制，也可能消耗更多 Token 和额度。'
            + '如果短测试正常而长对话失败，可以先检查上下文长度、账户余额、输出上限和服务平台返回的原始错误。',
    },
    {
        q: '为什么有时候好使有时候不好使？',
        a: '只凭偶发失败不能确定原因，常见情况是触发限流、服务暂时过载，或代理线路不稳定。'
            + '看到 429 时先查看平台的速率限制和余额，并稍后再试。确有多个可用 Key 时，也可以建立「API 分组」进行轮换。',
    },
    {
        q: '出错了我该怎么问人？',
        a: '在密钥卡片上点「测试」，失败后会出现「诊断报告」按钮。'
            + '报告会整理 Base URL、代理 URL、模型名、状态码、耗时和原始响应，并自动遮住 Key 的大部分内容。'
            + '复制前仍建议自己看一遍，确认响应体里没有账号、对话内容或其他敏感信息，再把整段交给服务平台客服或可信的人排查。',
    },
];
