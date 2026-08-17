/**
 * prebuild 脚本：预处理 CSS 文件，展开所有 @import
 * 运行方式：node scripts/preprocess-css.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

/**
 * 递归展开 CSS 文件中的 @import
 */
function expandCssImports(cssContent, baseCssPath, depth = 0, visited = new Set()) {
    if (depth > 30) {
        console.warn(`[preprocess-css] 递归深度超限: ${baseCssPath}`);
        return cssContent;
    }
    if (!cssContent.includes('@import')) {
        return cssContent;
    }
    const baseDir = path.dirname(baseCssPath);
    const resolvedPath = path.resolve(baseCssPath);
    if (visited.has(resolvedPath)) {
        return cssContent;
    }
    visited.add(resolvedPath);
    
    let result = cssContent;
    let maxIterations = 100;
    let iteration = 0;
    
    while (iteration < maxIterations) {
        iteration++;
        const before = result;
        
        result = result.replace(/@import\s+(?:url\s*\()?["']?([^"'\s\)]+)["']?\)?\s*;/gi, (match, importPath) => {
            if (!importPath || importPath.startsWith('http://') || 
                importPath.startsWith('https://') || importPath.startsWith('//') ||
                importPath.startsWith('data:')) {
                return match;
            }
            const cleanPath = importPath.split('?')[0].trim();
            if (!cleanPath) return match;
            
            const resolved = path.resolve(baseDir, cleanPath);
            if (fs.existsSync(resolved)) {
                const importedContent = fs.readFileSync(resolved, 'utf8');
                console.log(`[preprocess-css] 展开: ${cleanPath}`);
                return expandCssImports(importedContent, resolved, depth + 1, visited);
            }
            console.warn(`[preprocess-css] 文件不存在: ${resolved}`);
            return `/* @import ${importPath} - not found */`;
        });
        
        if (result === before) break;
    }
    
    return result;
}

/**
 * 处理单个 CSS 文件
 */
function processCssFile(cssPath) {
    if (!fs.existsSync(cssPath)) {
        console.warn(`[preprocess-css] 文件不存在: ${cssPath}`);
        return;
    }
    
    const content = fs.readFileSync(cssPath, 'utf8');
    if (!content.includes('@import')) {
        return;
    }
    
    const expanded = expandCssImports(content, cssPath);
    const originalSize = content.length;
    const expandedSize = expanded.length;
    
    if (expanded !== content) {
        fs.writeFileSync(cssPath, expanded);
        console.log(`[preprocess-css] 已处理: ${cssPath} (${originalSize} -> ${expandedSize} bytes)`);
    }
}

/**
 * 扫描 css 目录下的所有文件并处理
 */
function scanAndProcessCssDir(dir) {
    if (!fs.existsSync(dir)) return;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            scanAndProcessCssDir(fullPath);
        } else if (entry.name.endsWith('.css')) {
            processCssFile(fullPath);
        }
    }
}

// 主入口
const cssDir = path.join(projectRoot, 'css');
console.log('[preprocess-css] 开始扫描 CSS 目录:', cssDir);
scanAndProcessCssDir(cssDir);
console.log('[preprocess-css] 完成!');
