import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { viteSingleFile } from 'vite-plugin-singlefile';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 自定义插件：把 vite 产物里的 <script src="./index-XXX.js"> 和
 * <link href="./style-XXX.css"> 全部 inline 进 HTML。
 *
 * ESM 化之后：所有项目内 JS（src/ + js/framework/ + js/db/ + js/apps/）都是 ESM，
 * vite 会自动把它们按依赖图打包成单个 chunk。
 *
 * vue.global.prod.js 是 UMD global script（不是 ESM），必须保留为普通 <script>，
 * 并且必须**先于** ESM 模块跑（ESM 模块通过 window.Vue 拿 Vue）。
 */
function inlineAllAssets() {
    return {
        name: 'inline-all-assets',
        enforce: 'post',
        closeBundle() {
            const htmlPath = path.join(__dirname, 'dist-single', 'index.html');
            if (!fs.existsSync(htmlPath)) return;
            let html = fs.readFileSync(htmlPath, 'utf8');

            // 1. inline CSS link
            html = html.replace(
                /<link\s+rel="stylesheet"[^>]*href=["']([^"']+\.css)["'][^>]*>/gi,
                (match, cssPath) => {
                    const cssFullPath = path.join(__dirname, 'dist-single', cssPath);
                    if (fs.existsSync(cssFullPath)) {
                        const cssContent = fs.readFileSync(cssFullPath, 'utf8');
                        return '<style>' + cssContent + '</style>';
                    }
                    return match;
                }
            );

            // 2. inline JS script：保留 type="module"，因为产物本身就是 ESM
            //    （vite-plugin-singlefile 内部已经会处理 ES module 的 inline，
            //    我们再做一次兜底：万一还有 src= 残留）
            html = html.replace(
                /<script\s+type="module"[^>]*src=["']([^"']+\.js)["'][^>]*><\/script>/gi,
                (match, jsPath) => {
                    const jsFullPath = path.join(__dirname, 'dist-single', jsPath);
                    if (fs.existsSync(jsFullPath)) {
                        const jsContent = fs.readFileSync(jsFullPath, 'utf8');
                        return '<script type="module">' + jsContent + '</script>';
                    }
                    return match;
                }
            );

            // 3. inline vue.global.prod.js（UMD global script，非 ESM）
            //    把它放在 ESM 模块之前，确保 ESM 执行时 window.Vue 已就绪。
            html = html.replace(
                /<script\s+src=["']([^"']*vue\.global\.prod\.js)["'][^>]*><\/script>/gi,
                (match, jsPath) => {
                    const vueFullPath = path.join(__dirname, jsPath);
                    if (fs.existsSync(vueFullPath)) {
                        const vueContent = fs.readFileSync(vueFullPath, 'utf8');
                        // 普通 <script>（无 type=module），保证同步执行
                        return '<script>' + vueContent + '</script>';
                    }
                    return match;
                }
            );

            fs.writeFileSync(htmlPath, html);
            console.log('[inline-all-assets] 已完成所有 inline, 最终 size: ' + html.length);
        },
    };
}

export default defineConfig({
    root: '.',
    publicDir: 'public',
    define: {
        // 标记给 core-shim 等模块识别"当前是单文件 build"
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
        rollupOptions: {
            input: 'index.html',
        },
    },
    plugins: [
        viteSingleFile(),
        inlineAllAssets(),
    ],
});