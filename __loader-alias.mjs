/**
 * Node ESM 解析钩子：让 `@/xxx` 指向项目根。
 *
 * 项目里 `@/` 是 vite 的别名，Node 不认识。跑纯 Node 测试时挂上它即可：
 *   node --experimental-loader ./__loader-alias.mjs tests/regression/__probe-games.mjs
 *
 * （AGENTS2 §6 记过这个套路，这里落成文件免得每次重写。）
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function resolve(specifier, context, next) {
    if (specifier.startsWith('@/')) {
        const target = pathToFileURL(path.join(process.cwd(), specifier.slice(2))).href;
        return next(target, context);
    }
    return next(specifier, context);
}
