/**
 * 图库模块 · 工具函数
 */

/**
 * 格式化日期
 */
export function formatDate(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const now = new Date();
    const diff = now - d;

    // 1 分钟内
    if (diff < 60_000) return '刚刚';
    // 1 小时内
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
    // 今天内
    if (d.toDateString() === now.toDateString()) {
        return `今天 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
    // 今年
    if (d.getFullYear() === now.getFullYear()) {
        return `${d.getMonth() + 1}月${d.getDate()}日`;
    }
    return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
}

/**
 * 生成唯一 ID（不依赖 db）
 */
export function genId(prefix = '') {
    return `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 计算图片大小的人类可读表示
 */
export function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * 延迟执行（防抖）
 */
export function debounce(fn, ms = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

/**
 * 从文件生成缩略图 data URL
 */
export function createThumbnailFromFile(file, maxSize = 80) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const scale = Math.min(maxSize / img.naturalWidth, maxSize / img.naturalHeight);
            const w = Math.round(img.naturalWidth * scale);
            const h = Math.round(img.naturalHeight * scale);
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('图片加载失败'));
        };
        img.src = url;
    });
}

/**
 * 验证图片 URL 是否可用（带超时）
 */
export async function validateImageUrl(url, timeout = 5000) {
    return new Promise((resolve) => {
        const img = new Image();
        const timer = setTimeout(() => {
            img.src = '';
            resolve(false);
        }, timeout);
        img.onload = () => { clearTimeout(timer); resolve(true); };
        img.onerror = () => { clearTimeout(timer); resolve(false); };
        img.src = url;
    });
}

/**
 * 获取文件扩展名
 */
export function getFileExtension(filename) {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

/**
 * 检查是否是支持的图片类型
 */
export function isSupportedImageType(file) {
    const supported = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
    return supported.includes(file.type);
}
