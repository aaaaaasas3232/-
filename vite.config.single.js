import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { viteSingleFile } from 'vite-plugin-singlefile';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 单文件模式下,把 src/core/island-templates.js 里的
 * `__MUSIC_ISLAND_CSS__` 占位符在打包阶段替换为 css/music-island.css 的内容,
 * 避免运行时通过 import.meta.url 拼出来的路径在 file:// / blob 下无法加载。
 */
function inlineMusicIslandCssPlugin() {
    const cssPath = path.join(__dirname, 'css', 'music-island.css');
    const cssContent = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
    return {
        name: 'inline-music-island-css',
        enforce: 'pre',
        transform(code, id) {
            if (!id.includes('core/island-templates.js')) return null;
            if (!code.includes('__MUSIC_ISLAND_CSS__')) return null;
            return {
                code: code.replace(/__MUSIC_ISLAND_CSS__/g, JSON.stringify(cssContent)),
                map: null,
            };
        },
    };
}

/**
 * vite-plugin-singlefile 处理完之后，再把 HTML 里残留的外链收干净：
 *   - /js/vendor/vue.global.prod.js（不在 vite 模块图里）
 *   - favicon.svg
 *   - 万一还剩相对路径的 .css / .js
 */
/**
 * 把字面量动态 import('./x.js') 提升成静态 import。
 * 聊天 App 里大量 await import('./call-manager.js') 会逼 Rollup 拆 chunk，
 * 单文件模式下主脚本被内联进 HTML 后，这些 chunk 再 import('./index-HASH.js') 会 404。
 * 带 @vite-ignore 的运行时地址（blob 插件）不会被这条正则碰到。
 */
function hoistLiteralDynamicImports() {
    const re = /import\s*\(\s*(['"])(\.?\.?\/[^'"]+)\1\s*\)/g;
    return {
        name: 'hoist-literal-dynamic-imports',
        enforce: 'pre',
        transform(code, id) {
            const norm = id.replace(/\\/g, '/');
            if (!norm.includes('/js/') && !norm.includes('/src/')) return null;
            if (id.includes('node_modules')) return null;
            if (id.includes('plugin-installer') || id.includes('custom-games')) return null;
            if (!re.test(code)) return null;
            re.lastIndex = 0;
            const injections = [];
            let i = 0;
            const next = code.replace(re, (match, quote, spec, offset) => {
                const ahead = code.slice(Math.max(0, offset - 48), offset);
                if (ahead.includes('@vite-ignore')) return match;
                const varName = `__sfHoist${i++}`;
                injections.push(`import * as ${varName} from ${quote}${spec}${quote};`);
                return `Promise.resolve(${varName})`;
            });
            if (!injections.length) return null;
            return {
                code: `${injections.join('\n')}\n${next}`,
                map: null,
            };
        },
    };
}

function leftoverInlinePlugin() {
    return {
        name: 'leftover-inline',
        enforce: 'post',
        closeBundle() {
            const htmlPath = path.join(__dirname, 'dist-single', 'index.html');
            if (!fs.existsSync(htmlPath)) {
                console.error('[leftover-inline] dist-single/index.html 不存在');
                return;
            }

            let html = fs.readFileSync(htmlPath, 'utf8');

            html = html.replace(
                /<script\s+src=["']([^"']*vue\.global\.prod\.js)["'][^>]*><\/script>/gi,
                (match, jsPath) => {
                    const vuePath = jsPath.startsWith('/')
                        ? path.join(__dirname, jsPath.replace(/^\//, ''))
                        : path.join(__dirname, jsPath);
                    if (!fs.existsSync(vuePath)) {
                        console.warn('[leftover-inline] vue 不存在:', vuePath);
                        return match;
                    }
                    return `<script>${fs.readFileSync(vuePath, 'utf8')}</script>`;
                },
            );

            html = html.replace(
                /<link\s+rel="stylesheet"[^>]*href=["']([^"']+\.css)["'][^>]*>/gi,
                (match, cssPath) => {
                    if (/^https?:\/\//.test(cssPath) || cssPath.startsWith('data:')) return match;
                    const full = cssPath.startsWith('/')
                        ? path.join(__dirname, cssPath.replace(/^\//, ''))
                        : path.join(__dirname, 'dist-single', cssPath);
                    if (!fs.existsSync(full)) return '';
                    return `<style>${fs.readFileSync(full, 'utf8')}</style>`;
                },
            );

            html = html.replace(
                /<script\s+type="module"[^>]*src=["']([^"']+\.js)["'][^>]*><\/script>/gi,
                (match, jsPath) => {
                    const full = path.join(__dirname, 'dist-single', jsPath);
                    if (!fs.existsSync(full)) return match;
                    return `<script type="module">${fs.readFileSync(full, 'utf8')}</script>`;
                },
            );

            const faviconMatch = html.match(/<link[^>]*rel=["']icon["'][^>]*href=["']([^"']+)["'][^>]*>/i);
            if (faviconMatch && !faviconMatch[1].startsWith('data:')) {
                const href = faviconMatch[1];
                let faviconPath = href.startsWith('/')
                    ? path.join(__dirname, href.replace(/^\//, ''))
                    : path.join(__dirname, 'dist-single', href);
                if (!fs.existsSync(faviconPath)) {
                    faviconPath = path.join(__dirname, 'public', path.basename(href));
                }
                if (fs.existsSync(faviconPath)) {
                    const svg = fs.readFileSync(faviconPath, 'utf8');
                    const dataUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`;
                    html = html.replace(faviconMatch[0], faviconMatch[0].replace(href, dataUrl));
                }
            }

            html = html.replace(/window\.__LISTEN_SINGLE_FILE__\s*=\s*false/g, 'window.__LISTEN_SINGLE_FILE__ = true');
            if (!html.includes('__LISTEN_SINGLE_FILE__')) {
                html = html.replace('<head>', '<head>\n<script>window.__LISTEN_SINGLE_FILE__=true;</script>');
            } else if (!/window\.__LISTEN_SINGLE_FILE__\s*=\s*true/.test(html)) {
                html = html.replace('<head>', '<head>\n<script>window.__LISTEN_SINGLE_FILE__=true;</script>');
            }

            const assetsDir = path.join(__dirname, 'dist-single', 'assets');
            if (fs.existsSync(assetsDir)) {
                const leftover = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js') || f.endsWith('.css'));
                if (leftover.length) {
                    console.warn('[leftover-inline] 仍有未内联资源，尝试收进 HTML：', leftover.join(', '));
                    for (const file of leftover) {
                        const full = path.join(assetsDir, file);
                        const body = fs.readFileSync(full, 'utf8');
                        if (file.endsWith('.css')) {
                            html = html.replace('</head>', `<style data-sf="${file}">${body}</style></head>`);
                        } else {
                            const dataUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(body)}`;
                            const specs = [`./${file}`, `./assets/${file}`];
                            for (const spec of specs) {
                                const escaped = spec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                html = html.replace(new RegExp(`(["'])${escaped}\\1`, 'g'), JSON.stringify(dataUrl));
                            }
                        }
                    }
                }
            }

            fs.writeFileSync(htmlPath, html);

            const extras = [
                path.join(__dirname, 'dist-single', 'favicon.svg'),
                path.join(__dirname, 'dist-single', 'js', 'vendor', 'vue.global.prod.js'),
            ];
            for (const extra of extras) {
                try { if (fs.existsSync(extra)) fs.unlinkSync(extra); } catch (_) { /* noop */ }
            }
            const vendorDir = path.join(__dirname, 'dist-single', 'js', 'vendor');
            const jsDir = path.join(__dirname, 'dist-single', 'js');
            try { if (fs.existsSync(vendorDir) && fs.readdirSync(vendorDir).length === 0) fs.rmdirSync(vendorDir); } catch (_) { /* noop */ }
            try { if (fs.existsSync(jsDir) && fs.readdirSync(jsDir).length === 0) fs.rmdirSync(jsDir); } catch (_) { /* noop */ }
            const assetsDirAfter = path.join(__dirname, 'dist-single', 'assets');
            try {
                if (fs.existsSync(assetsDirAfter) && fs.readdirSync(assetsDirAfter).length === 0) {
                    fs.rmdirSync(assetsDirAfter);
                }
            } catch (_) { /* noop */ }

            const mb = (html.length / 1024 / 1024).toFixed(2);
            console.log(`[leftover-inline] 单文件已写好，${mb} MB`);
        },
    };
}

export default defineConfig({
    root: '.',
    publicDir: 'public',
    define: {
        'window.__LISTEN_SINGLE_FILE__': JSON.stringify(true),
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './'),
        },
    },
    build: {
        outDir: 'dist-single',
        emptyOutDir: true,
        target: 'es2020',
        sourcemap: false,
        assetsInlineLimit: 100 * 1024 * 1024,
        cssCodeSplit: false,
        modulePreload: false,
        rollupOptions: {
            input: 'index.html',
            output: {
                inlineDynamicImports: true,
                manualChunks: undefined,
            },
        },
    },
    plugins: [
        hoistLiteralDynamicImports(),
        inlineMusicIslandCssPlugin(),
        viteSingleFile({
            removeViteModuleLoader: true,
            useRecommendedBuildConfig: false,
            deleteInlinedFiles: true,
        }),
        leftoverInlinePlugin(),
    ],
});
