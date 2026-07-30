/**
 * 图库模块 · IndexedDB 操作层
 *
 * 数据结构：
 *   - library (图库): { id, name, _num, createdAt, updatedAt }
 *   - album   (图包): { id, libraryId, name, _num, createdAt, updatedAt }
 *   - group   (图组): { id, albumId, libraryId, name, imageSize:{width,height}, _num, createdAt, updatedAt }
 *   - image   (图片): { code, groupId, libraryId, albumId, name, source, thumbnail, originalSize, createdAt }
 *     ★ source / thumbnail 均以 base64 data URL 存储，刷新页面后仍然有效
 *
 * 数据库：单独的 'gallery_db'（解决内存问题）
 */

import { ListenDb } from '@/js/db/engine.js';

// ============================================
// 数据库初始化
// ============================================

let _galleryDb = null;

export async function initGalleryDb() {
    if (_galleryDb) return _galleryDb.open();

    _galleryDb = new ListenDb({
        dbName: 'gallery_db',
        dbVersion: 1,
    });

    _galleryDb.registerStore('libraries', 'id');
    _galleryDb.registerStore('albums', 'id');
    _galleryDb.registerStore('groups', 'id');
    _galleryDb.registerStore('images', 'code');

    _galleryDb.open().catch(err => {
        console.error('[gallery-db] 初始化失败', err);
    });

    return _galleryDb.open();
}

async function _withDb(fn) {
    if (!_galleryDb) {
        await initGalleryDb();
    }
    if (_galleryDb.ready) {
        await _galleryDb.ready;
    }
    return fn(_galleryDb);
}

// ============================================
// Blob → base64 工具
// ============================================

function _blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('FileReader failed'));
        reader.readAsDataURL(blob);
    });
}

// ============================================
// 图库 (Library) CRUD
// ============================================

export async function getAllLibraries() {
    return _withDb(async (db) => {
        const all = await db.getAllRecords('libraries');
        return all.sort((a, b) => a.createdAt - b.createdAt);
    });
}

export async function getLibrary(id) {
    return _withDb(db => db.get('libraries', id));
}

export async function createLibrary(name) {
    return _withDb(async (db) => {
        const all = await db.getAllRecords('libraries');
        if (all.length >= 9) throw new Error('图库上限9个，无法创建更多');

        const usedNumbers = new Set(all.map(l => l._num || 0));
        let num = 0;
        while (usedNumbers.has(num) && num < 9) num++;
        if (num >= 9) throw new Error('图库编号已满');

        const id = `lib_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const record = { id, name, _num: num, createdAt: Date.now(), updatedAt: Date.now() };
        await db.put('libraries', record);
        return record;
    });
}

export async function updateLibrary(id, patch) {
    return _withDb(async (db) => {
        const existing = await db.get('libraries', id);
        if (!existing) throw new Error('图库不存在');
        const updated = { ...existing, ...patch, updatedAt: Date.now() };
        await db.put('libraries', updated);
        return updated;
    });
}

export async function deleteLibrary(id) {
    return _withDb(async (db) => {
        const albums = await db.find('albums', a => a.libraryId === id);
        if (albums.length > 0) {
            throw new Error('请先删除图库内的所有图包');
        }
        await db.remove('libraries', id);
    });
}

// ============================================
// 图包 (Album) CRUD
// ============================================

export async function getLibraryAlbums(libraryId) {
    return _withDb(async (db) => {
        const albums = await db.find('albums', a => a.libraryId === libraryId);
        return albums.sort((a, b) => a.createdAt - b.createdAt);
    });
}

export async function getAlbum(id) {
    return _withDb(db => db.get('albums', id));
}

export async function createAlbum(libraryId, name) {
    return _withDb(async (db) => {
        const library = await db.get('libraries', libraryId);
        if (!library) throw new Error('图库不存在');

        const albums = await db.find('albums', a => a.libraryId === libraryId);
        if (albums.length >= 9) throw new Error('图包上限9个');

        const usedNumbers = new Set(albums.map(a => a._num || 0));
        let num = 0;
        while (usedNumbers.has(num) && num < 9) num++;
        if (num >= 9) throw new Error('图包编号已满');

        const id = `alb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const record = { id, libraryId, name, _num: num, createdAt: Date.now(), updatedAt: Date.now() };
        await db.put('albums', record);
        return record;
    });
}

export async function updateAlbum(id, patch) {
    return _withDb(async (db) => {
        const existing = await db.get('albums', id);
        if (!existing) throw new Error('图包不存在');
        const updated = { ...existing, ...patch, updatedAt: Date.now() };
        await db.put('albums', updated);
        return updated;
    });
}

export async function deleteAlbum(id) {
    return _withDb(async (db) => {
        const groups = await db.find('groups', g => g.albumId === id);
        if (groups.length > 0) {
            throw new Error('请先删除图包内的所有图组');
        }
        await db.remove('albums', id);
    });
}

// ============================================
// 图组 (Group) CRUD
// ============================================

export async function getAlbumGroups(albumId) {
    return _withDb(async (db) => {
        const groups = await db.find('groups', g => g.albumId === albumId);
        return groups.sort((a, b) => a.createdAt - b.createdAt);
    });
}

export async function getGroup(id) {
    return _withDb(db => db.get('groups', id));
}

export async function createGroup(albumId, name, imageSize = { width: 100, height: 100 }) {
    return _withDb(async (db) => {
        const album = await db.get('albums', albumId);
        if (!album) throw new Error('图包不存在');

        const groups = await db.find('groups', g => g.albumId === albumId);
        if (groups.length >= 9) throw new Error('图组上限9个');

        const usedNumbers = new Set(groups.map(g => g._num || 0));
        let num = 0;
        while (usedNumbers.has(num) && num < 9) num++;
        if (num >= 9) throw new Error('图组编号已满');

        const id = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const record = {
            id, albumId, libraryId: album.libraryId, name,
            imageSize,
            _num: num,
            createdAt: Date.now(), updatedAt: Date.now()
        };
        await db.put('groups', record);
        return record;
    });
}

export async function updateGroup(id, patch) {
    return _withDb(async (db) => {
        const existing = await db.get('groups', id);
        if (!existing) throw new Error('图组不存在');
        const updated = { ...existing, ...patch, updatedAt: Date.now() };
        await db.put('groups', updated);
        return updated;
    });
}

export async function deleteGroup(id) {
    return _withDb(async (db) => {
        const group = await db.get('groups', id);
        if (!group) throw new Error('图组不存在');

        // 先删所有图片
        const images = await db.find('images', img => img.groupId === id);
        for (const img of images) {
            await _deleteImageBlobs(img.code, db);
            await db.remove('images', img.code);
        }
        await db.remove('groups', id);
    });
}

// ============================================
// 图片 (Image) CRUD
// ============================================

export async function getGroupImages(groupId) {
    return _withDb(async (db) => {
        const images = await db.find('images', img => img.groupId === groupId);
        // ★ 不把 base64 带进 list，避免每张图占几百 KB 内存
        return images
            .map(({ source, thumbnail, ...meta }) => meta)
            .sort((a, b) => a.createdAt - b.createdAt);
    });
}

export async function getImageByCode(code) {
    return _withDb(async (db) => db.get('images', code));
}

/**
 * 仅在预览弹窗打开时按需读取图片数据 (base64 data URL)
 * 预览关闭后调用方需要清空 _previewSrc 释放内存。
 */
export async function getImageSrcByCode(code) {
    return _withDb(async (db) => {
        const img = await db.get('images', code);
        return img ? (img.source || img.thumbnail || null) : null;
    });
}

export async function generateImageCode(group) {
    return _withDb(async (db) => {
        const library = await db.get('libraries', group.libraryId);
        const album = await db.get('albums', group.albumId);
        if (!library || !album) throw new Error('关联数据不存在');

        const libNum = String(library._num || 0);
        const albNum = String(album._num || 0);
        const grpNum = String(group._num || 0);

        const existing = await db.find('images', img => img.groupId === group.id);
        const usedIndices = new Set(existing.map(img => parseInt(img.code.slice(-2), 10)));
        let idx = 1;
        while (usedIndices.has(idx) && idx < 99) idx++;
        if (idx >= 99) throw new Error('图片上限99张');

        const imgNum = String(idx).padStart(2, '0');
        return `${libNum}${albNum}${grpNum}${imgNum}`;
    });
}

export async function addImageFromUrl(groupId, name, url) {
    return _withDb(async (db) => {
        const group = await db.get('groups', groupId);
        if (!group) throw new Error('图组不存在');

        const images = await db.find('images', img => img.groupId === groupId);
        if (images.length >= 99) throw new Error('图片上限99张');

        const code = await generateImageCode(group);
        const img = {
            code,
            groupId,
            libraryId: group.libraryId,
            albumId: group.albumId,
            name,
            source: url,
            thumbnail: url,
            originalSize: null,
            createdAt: Date.now(),
            _type: 'url',
        };
        await db.put('images', img);
        return img;
    });
}

export async function addImageFromBlob(groupId, name, blob, targetWidth, targetHeight, cropBox) {
    return _withDb(async (db) => {
        const group = await db.get('groups', groupId);
        if (!group) throw new Error('图组不存在');

        const images = await db.find('images', img => img.groupId === groupId);
        if (images.length >= 99) throw new Error('图片上限99张');

        const code = await generateImageCode(group);

        // 在主线程裁剪并压缩
        const croppedBlob = await _cropBlob(blob, targetWidth, targetHeight, cropBox);

        // ★ 关键修复：把 blob 转成 base64 data URL 再存储
        //    这样刷新页面 / 重启浏览器后图片仍然有效
        const sourceDataUrl = await _blobToDataUrl(croppedBlob);

        // 生成缩略图（同样转成 base64）
        const thumbBlob = await _makeThumbnail(croppedBlob, 200, 200);
        const thumbnailDataUrl = await _blobToDataUrl(thumbBlob);

        const img = {
            code,
            groupId,
            libraryId: group.libraryId,
            albumId: group.albumId,
            name,
            source: sourceDataUrl,
            thumbnail: thumbnailDataUrl,
            originalSize: { width: targetWidth, height: targetHeight },
            createdAt: Date.now(),
            _type: 'blob',
        };
        await db.put('images', img);
        return img;
    });
}

export async function updateImage(code, patch) {
    return _withDb(async (db) => {
        const existing = await db.get('images', code);
        if (!existing) throw new Error('图片不存在');
        const updated = { ...existing, ...patch };
        await db.put('images', updated);
        return updated;
    });
}

export async function deleteImage(code) {
    return _withDb(async (db) => {
        await db.remove('images', code);
    });
}

// ============================================
// 图片处理（Canvas 裁剪 / 缩略图）
// ============================================

function _cropBlob(blob, targetWidth, targetHeight, cropBox) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');

            const sx = cropBox.sx * img.naturalWidth;
            const sy = cropBox.sy * img.naturalHeight;
            const sw = cropBox.sw * img.naturalWidth;
            const sh = cropBox.sh * img.naturalHeight;

            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
            canvas.toBlob(res => {
                if (!res) { reject(new Error('Canvas toBlob failed')); return; }
                resolve(res);
            }, 'image/png', 0.92);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Image load failed'));
        };
        img.src = url;
    });
}

function _makeThumbnail(blob, maxW, maxH) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
            const w = Math.round(img.naturalWidth * scale);
            const h = Math.round(img.naturalHeight * scale);
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            canvas.toBlob(res => {
                if (!res) { reject(new Error('Thumbnail failed')); return; }
                resolve(res);
            }, 'image/jpeg', 0.7);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Thumbnail image load failed'));
        };
        img.src = url;
    });
}

// ============================================
// 辅助查询
// ============================================

export async function getGroupWithPath(groupId) {
    return _withDb(async (db) => {
        const group = await db.get('groups', groupId);
        if (!group) return null;
        const album = await db.get('albums', group.albumId);
        if (!album) return null;
        const library = await db.get('libraries', album.libraryId);
        if (!library) return null;
        return { library, album, group };
    });
}

export async function countChildren(type, parentId) {
    return _withDb(async (db) => {
        switch (type) {
            case 'albums': return (await db.find('albums', a => a.libraryId === parentId)).length;
            case 'groups': return (await db.find('groups', g => g.albumId === parentId)).length;
            case 'images': return (await db.find('images', img => img.groupId === parentId)).length;
            default: return 0;
        }
    });
}
