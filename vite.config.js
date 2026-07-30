import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    root: '.',
    publicDir: 'public',
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './'),
        },
    },
    server: {
        port: 5173,
        strictPort: true,
        host: '0.0.0.0',  // 允许局域网访问，手机可通过 IP:5173 访问
        allowedHosts: true, // 允许所有主机访问（开发环境）
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        target: 'es2020',
        sourcemap: false,
        rollupOptions: {
            input: {
                main: 'index.html',
            },
        },
    },
});