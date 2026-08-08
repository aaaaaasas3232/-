/**
 * 图库模块 · 业务方法层
 *
 * 所有 UI 触发的操作（由 action system → appMethod 调用）都在这里。
 * 数据层委托给 gallery-db.js，渲染层在 section.js。
 *
 * ★ 渲染模式：预加载（同步）
 *   所有视图数据在 bootstrapGallery 时一次性加载到内存 cache，
 *   renderGallerySection 纯同步，不 await，直接读 cache 拼 HTML。
 */

import {
    getAllLibraries,
    getLibraryAlbums,
    getAlbumGroups,
    getGroupImages,
    getImageByCode,
    getImageSrcByCode,
    getGroupWithPath,
    createLibrary,
    updateLibrary,
    deleteLibrary,
    getLibrary,
    createAlbum,
    updateAlbum,
    deleteAlbum,
    getAlbum,
    createGroup,
    updateGroup,
    deleteGroup,
    getGroup,
    addImageFromUrl,
    addImageFromBlob,
    updateImage,
    deleteImage,
    countChildren,
} from './gallery-db.js';

// ============================================
// 内存中的「缓存 + UI 状态」
// ============================================

let _cache = {
    // 预加载的数据（renderGallerySection 同步读取这些）
    libraries: [],
    albums: [],     // [{ id, libraryId, name, createdAt }]
    groups: [],      // [{ id, albumId, libraryId, name, imageSize, createdAt }]
    images: [],     // [{ code, groupId, name, source, thumbnail, createdAt }]

    // UI 状态
    currentView: 'libraries',
    currentLibraryId: null,
    currentAlbumId: null,
    currentGroupId: null,

    // 弹窗状态
    _modalType: null,
    _modalData: null,

    // 预览状态
    _previewCode: null,
    _previewSrc: null,           // 仅在预览打开时按需加载的 base64，关闭即释放
    _previewEditMode: null,     // 'brush' | 'blur' | null
    _previewEdited: false,      // 是否有未保存的编辑
    _previewHistory: [],         // Canvas 历史栈

    // 裁剪状态
    pendingImageData: null,
    cropState: null,
    _pendingFile: null,
    _pendingGroupId: null,
    _pendingCropSize: null,

    // 临时存储（弹窗参数）
    _tempLibraryId: null,
    _tempAlbumId: null,
    _tempGroupId: null,

    _lastRenderKey: 0,
};

export function getGalleryCache() {
    return _cache;
}

export async function loadGalleryCache() {
    // 预加载所有数据（让 renderGallerySection 可以同步执行）
    try {
        _cache.libraries = await getAllLibraries();
    } catch {
        _cache.libraries = [];
    }
}

export function setGalleryCache(patch) {
    Object.assign(_cache, patch);
}

// ============================================
// 工具函数
// ============================================

function _invalidate() {
    _cache._lastRenderKey = Date.now();
    if (typeof window !== 'undefined') {
        // ★ v0.49.1 修复:点击「新建图库」等弹窗不显示,需切出再切回才显示
        //   根因:method 改了 _cache._modalType 但 detailRenderTick 没 ++,
        //   framework app-renderer-bridge 的 syncRenderer 看 detailKey 没变 +
        //   tickChanged=false → 不重画 detail 页。
        //   修复:同时 ++detailRenderTick + bridge.syncNow({force:true}) 兜底,
        //   双保险确保 detail 页一定能重画(走当前 _cache 的最新值)
        if (window.__detailRenderTick && typeof window.__detailRenderTick.value === 'number') {
            window.__detailRenderTick.value++;
        }
        const bridge = window.__appRendererBridge;
        if (bridge && typeof bridge.syncNow === 'function') {
            try { bridge.syncNow({ force: true }); } catch (_) {}
        }
        try { window.refreshPhoneApps?.(); } catch (_) {}
    }
}

function _getInputValue(id) {
    const el = document.getElementById(id);
    return el?.value || '';
}

// ============================================
// Canvas 预览编辑辅助
// ============================================

function _restorePreviewCanvas(dataUrl) {
    const canvas = document.getElementById('gallery-preview-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
        const scale = Math.min(360 / img.naturalWidth, 500 / img.naturalHeight, 1);
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = dataUrl;
}

async function _savePreviewEdit(code, dataUrl) {
    try {
        // 更新 IndexedDB 里的图片数据
        const img = await getImageByCode(code);
        if (!img) return;

        // 生成新缩略图
        const thumb = await _generateThumbnail(dataUrl, 200);
        const updated = {
            ...img,
            source: dataUrl,
            thumbnail: thumb,
            updatedAt: Date.now(),
        };
        await updateImage(code, updated);
        _cache._previewEdited = false;
        _cache._previewHistory = [dataUrl];
        _toast('success', '已保存', '图片已更新');
        _invalidate();
    } catch (e) {
        _toast('error', '保存失败', e.message);
    }
}

async function _generateThumbnail(dataUrl, maxSize) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(maxSize / img.naturalWidth, maxSize / img.naturalHeight, 1);
            const w = Math.round(img.naturalWidth * scale);
            const h = Math.round(img.naturalHeight * scale);
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = dataUrl;
    });
}

// 文件上传 change handler（由 initFileInputHandler 在 bootstrap 时注册一次）
export function _handleFileInputChange(e) {
    console.log('[gallery] _handleFileInputChange called, _tempGroupId:', _cache._tempGroupId);
    const fileInput = e.target;
    if (!fileInput?.files?.length) return;
    const file = fileInput.files[0];
    if (!file) return;
    const groupId = _cache._tempGroupId;
    console.log('[gallery] groupId:', groupId);
    if (!groupId) return;
    // 读取原始尺寸
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
        console.log('[gallery] img.onload fired, naturalSize:', img.naturalWidth, img.naturalHeight);
        const url = URL.createObjectURL(file);
        const reader = new FileReader();
        reader.onload = (ev) => {
            _cache.pendingImageData = ev.target.result;
            _cache.cropState = { scale: 1, offsetX: 0, offsetY: 0 };
            _cache._pendingFile = file;
            _cache._pendingGroupId = groupId;
            _cache._pendingOriginalSize = { width: img.naturalWidth, height: img.naturalHeight };
            URL.revokeObjectURL(url);
            _closeModal();
            _invalidate();
        };
        reader.readAsDataURL(file);
    };
    img.onerror = () => {
        console.log('[gallery] img.onerror fired');
        const url = URL.createObjectURL(file);
        const reader = new FileReader();
        reader.onload = (ev) => {
            _cache.pendingImageData = ev.target.result;
            _cache.cropState = { scale: 1, offsetX: 0, offsetY: 0 };
            _cache._pendingFile = file;
            _cache._pendingGroupId = groupId;
            _cache._pendingOriginalSize = { width: 0, height: 0 };
            URL.revokeObjectURL(url);
            _closeModal();
            _invalidate();
        };
        reader.readAsDataURL(file);
    };
    console.log('[gallery] img.src set, url:', url.slice(0, 50));
    img.src = url;
    fileInput.value = '';
}

function _showModal(type, data = {}) {
    _cache._modalType = type;
    _cache._modalData = data;
    _invalidate();
}

function _closeModal() {
    _cache._modalType = null;
    _cache._modalData = null;
    _invalidate();
}

function _toast(type, title, msg) {
    if (typeof window !== 'undefined' && window.toolkit?.island) {
        window.toolkit.island.notify(type === 'error' ? 'error' : 'success', title, msg);
    }
}

function _reloadAll() {
    // 重新加载所有数据（写操作后调用）
    getAllLibraries().then(libs => {
        _cache.libraries = libs;
        // 如果当前在 albums 视图，reload albums
        if (_cache.currentView === 'albums' && _cache.currentLibraryId) {
            return getLibraryAlbums(_cache.currentLibraryId);
        }
        return null;
    }).then(albums => {
        if (albums) _cache.albums = albums;
        // 如果当前在 groups 视图，reload groups
        if (_cache.currentView === 'groups' && _cache.currentAlbumId) {
            return getAlbumGroups(_cache.currentAlbumId);
        }
        return null;
    }).then(groups => {
        if (groups) _cache.groups = groups;
        // 如果当前在 images 视图，reload images
        if (_cache.currentView === 'images' && _cache.currentGroupId) {
            return getGroupImages(_cache.currentGroupId);
        }
        return null;
    }).then(images => {
        if (images) _cache.images = images;
        _invalidate();
    }).catch(e => { console.error('[gallery] _reloadAll error:', e); _invalidate(); });
}

function _reloadAlbums(libraryId) {
    getLibraryAlbums(libraryId).then(albums => {
        // 替换 albums 中该 library 的数据
        _cache.albums = _cache.albums.filter(a => a.libraryId !== libraryId).concat(albums);
        _invalidate();
    });
}

function _reloadGroups(albumId) {
    getAlbumGroups(albumId).then(groups => {
        _cache.groups = _cache.groups.filter(g => g.albumId !== albumId).concat(groups);
        _invalidate();
    });
}

function _reloadImages(groupId) {
    getGroupImages(groupId).then(images => {
        _cache.images = _cache.images.filter(i => i.groupId !== groupId).concat(images);
        _invalidate();
    });
}

// ============================================
// 本地上传 → 裁剪预览
// ============================================

function _processUpload(file, groupId) {
    const reader = new FileReader();
    reader.onload = (e) => {
        _cache.pendingImageData = e.target.result;
        _cache.cropState = { scale: 1, offsetX: 0, offsetY: 0 };
        _cache._pendingFile = file;
        _cache._pendingGroupId = groupId;
        _invalidate();
    };
    reader.readAsDataURL(file);
}

// ============================================
// 方法合集
// ============================================

export function buildGalleryMethods() {
    return {
        // ---- 导航 ----
        async galleryOpenLibrary({ libraryId }) {
            _cache.currentView = 'albums';
            _cache.currentLibraryId = libraryId;
            _cache.currentAlbumId = null;
            _cache.currentGroupId = null;
            _reloadAlbums(libraryId);
        },

        async galleryOpenAlbum({ albumId, libraryId }) {
            _cache.currentView = 'groups';
            _cache.currentAlbumId = albumId;
            _cache.currentLibraryId = libraryId;
            _cache.currentGroupId = null;
            _reloadGroups(albumId);
        },

        async galleryOpenGroup({ groupId, albumId }) {
            _cache.currentView = 'images';
            _cache.currentGroupId = groupId;
            _cache.currentAlbumId = albumId;
            _reloadImages(groupId);
        },

        async galleryGoBack({ level }) {
            switch (level) {
                case 'library':
                    _cache.currentView = 'libraries';
                    _cache.currentLibraryId = null;
                    _cache.currentAlbumId = null;
                    _cache.currentGroupId = null;
                    break;
                case 'album':
                    _cache.currentView = 'albums';
                    _cache.currentAlbumId = null;
                    _cache.currentGroupId = null;
                    break;
                case 'group':
                    _cache.currentView = 'groups';
                    _cache.currentGroupId = null;
                    break;
            }
            _invalidate();
        },

        // ---- 图库 CRUD ----
        galleryShowAddLibrary() {
            _showModal('addLibrary');
        },

        async galleryCreateLibrary() {
            const name = _getInputValue('gallery-input-name')?.trim();
            if (!name) return;
            try {
                await createLibrary(name);
                _closeModal();
                _reloadAll();
                _toast('success', '已创建', name);
            } catch (e) { _toast('error', '创建失败', e.message); }
        },

        galleryEditLibrary({ libraryId }) {
            const lib = _cache.libraries.find(l => l.id === libraryId);
            if (!lib) return;
            _showModal('editLibrary', { libraryId, name: lib.name });
        },

        async gallerySaveLibrary({ libraryId }) {
            const name = _getInputValue('gallery-input-name')?.trim();
            if (!name) return;
            try {
                await updateLibrary(libraryId, { name });
                _closeModal();
                _reloadAll();
            } catch (e) { _toast('error', '保存失败', e.message); }
        },

        async galleryDeleteLibrary({ libraryId }) {
            const lib = _cache.libraries.find(l => l.id === libraryId);
            if (!lib) return;
            const count = await countChildren('albums', libraryId);
            if (count > 0) {
                _toast('error', '无法删除', '请先删除图库内的所有图包');
                return;
            }
            _showModal('confirmDelete', { type: 'library', id: libraryId, name: lib.name });
        },

        async galleryConfirmDelete({ type, id }) {
            try {
                switch (type) {
                    case 'library': await deleteLibrary(id); break;
                    case 'album':   await deleteAlbum(id); break;
                    case 'group':   await deleteGroup(id); break;
                    case 'image':   await deleteImage(id); break;
                }
                _closeModal();
                await _reloadAll();
                _toast('success', '已删除', '');
            } catch (e) { _toast('error', '删除失败', e.message); }
        },

        // ---- 图包 CRUD ----
        galleryShowAddAlbum({ libraryId }) {
            _cache._tempLibraryId = libraryId;
            _showModal('addAlbum');
        },

        async galleryCreateAlbum({ libraryId }) {
            const safeLibraryId = libraryId || _cache._tempLibraryId;
            const name = _getInputValue('gallery-input-name')?.trim();
            if (!name || !safeLibraryId) return;
            try {
                await createAlbum(safeLibraryId, name);
                _closeModal();
                _reloadAlbums(safeLibraryId);
                _toast('success', '已创建', name);
            } catch (e) { _toast('error', '创建失败', e.message); }
        },

        galleryEditAlbum({ albumId }) {
            const album = _cache.albums.find(a => a.id === albumId);
            if (!album) return;
            _showModal('editAlbum', { albumId, name: album.name });
        },

        async gallerySaveAlbum({ albumId }) {
            const name = _getInputValue('gallery-input-name')?.trim();
            if (!name) return;
            try {
                await updateAlbum(albumId, { name });
                _closeModal();
                const album = _cache.albums.find(a => a.id === albumId);
                if (album) _reloadAlbums(album.libraryId);
            } catch (e) { _toast('error', '保存失败', e.message); }
        },

        async galleryDeleteAlbum({ albumId }) {
            const album = _cache.albums.find(a => a.id === albumId);
            if (!album) return;
            const count = await countChildren('groups', albumId);
            if (count > 0) {
                _toast('error', '无法删除', '请先删除图包内的所有图组');
                return;
            }
            _showModal('confirmDelete', { type: 'album', id: albumId, name: album.name });
        },

        // ---- 图组 CRUD ----
        galleryShowAddGroup({ albumId }) {
            _cache._tempAlbumId = albumId;
            _showModal('addGroup');
        },

        async galleryCreateGroup({ albumId }) {
            const safeAlbumId = albumId || _cache._tempAlbumId;
            const name = _getInputValue('gallery-input-name')?.trim();
            const w = Math.min(500, Math.max(10, parseInt(_getInputValue('gallery-input-width') || '100', 10)));
            const h = Math.min(500, Math.max(10, parseInt(_getInputValue('gallery-input-height') || '100', 10)));
            if (!name || !safeAlbumId) return;
            try {
                await createGroup(safeAlbumId, name, { width: w, height: h });
                _closeModal();
                _reloadGroups(safeAlbumId);
                _toast('success', '已创建', name);
            } catch (e) { _toast('error', '创建失败', e.message); }
        },

        galleryEditGroup({ groupId }) {
            const group = _cache.groups.find(g => g.id === groupId);
            if (!group) return;
            _showModal('editGroup', {
                groupId,
                name: group.name,
                width: group.imageSize?.width || 100,
                height: group.imageSize?.height || 100,
            });
        },

        async gallerySaveGroup({ groupId }) {
            const name = _getInputValue('gallery-input-name')?.trim();
            const w = Math.min(500, Math.max(10, parseInt(_getInputValue('gallery-input-width') || '100', 10)));
            const h = Math.min(500, Math.max(10, parseInt(_getInputValue('gallery-input-height') || '100', 10)));
            if (!name) return;
            try {
                await updateGroup(groupId, { name, imageSize: { width: w, height: h } });
                _closeModal();
                const group = _cache.groups.find(g => g.id === groupId);
                if (group) _reloadGroups(group.albumId);
            } catch (e) { _toast('error', '保存失败', e.message); }
        },

        galleryDeleteGroup({ groupId }) {
            const group = _cache.groups.find(g => g.id === groupId);
            if (!group) return;
            _showModal('confirmDelete', { type: 'group', id: groupId, name: group.name });
        },

        // ---- 图片 ----
        async galleryShowAddImage({ groupId }) {
            _cache._tempGroupId = groupId;
            const group = await getGroup(groupId);
            _cache._pendingCropSize = group?.imageSize || { width: 100, height: 100 };
            _showModal('addImage');
        },

        async galleryAddImageFromUrl({ groupId }) {
            const url = _getInputValue('gallery-input-url')?.trim();
            if (!url) return;
            const name = url.split('/').pop()?.split('?')[0] || '未命名';
            try {
                await addImageFromUrl(groupId, name, url);
                _closeModal();
                _reloadImages(groupId);
                _toast('success', '已添加', name);
            } catch (e) { _toast('error', '添加失败', e.message); }
        },

        galleryTriggerUpload({ groupId }) {
            _cache._tempGroupId = groupId;
            const fileInput = document.getElementById('gallery-file-input');
            if (fileInput) {
                fileInput.click();
            }
        },

        galleryCancelCrop() {
            _cache.pendingImageData = null;
            _cache.cropState = null;
            _cache._pendingFile = null;
            _invalidate();
        },

        async galleryConfirmCrop({ groupId }) {
            if (!_cache.cropState || !_cache._pendingFile) return;
            const group = await getGroup(groupId);
            if (!group) return;
            const { width: targetW, height: targetH } = group.imageSize || { width: 100, height: 100 };
            const cropBox = _calcCropBox();

            try {
                const name = _cache._pendingFile.name || '未命名';
                await addImageFromBlob(groupId, name, _cache._pendingFile, targetW, targetH, cropBox);
                _cache._pendingFile = null;
                _cache.pendingImageData = null;
                _cache.cropState = null;
                _reloadImages(groupId);
                _toast('success', '已保存', name);
            } catch (e) { _toast('error', '保存失败', e.message); }
        },

        async galleryPreviewImage({ code }) {
            // 先标记一下要预览哪一张，确保 _invalidate 渲染时不闪
            _cache._previewCode = code;
            _cache._previewSrc = null;
            _invalidate();
            // 按需读源图 base64（list 时不读以节省内存）
            const src = await getImageSrcByCode(code);
            // 用户可能在加载完成前就离开了，或点了别的图
            if (_cache._previewCode !== code) return;
            _cache._previewSrc = src;
            _invalidate();
        },

        galleryClosePreview() {
            _cache._previewCode = null;
            _cache._previewSrc = null;
            _invalidate();
        },

        gallerySetEditMode({ mode }) {
            _cache._previewEditMode = mode;
            _invalidate();
        },

        galleryPreviewUndo() {
            if (_cache._previewHistory.length <= 1) return;
            _cache._previewHistory.pop();
            const prev = _cache._previewHistory[_cache._previewHistory.length - 1];
            if (prev) {
                _cache._previewEdited = _cache._previewHistory.length > 1;
                _restorePreviewCanvas(prev);
            }
            _invalidate();
        },

        galleryPreviewDiscard() {
            if (!_cache._previewEdited) return;
            if (_cache._previewHistory.length > 0) {
                _restorePreviewCanvas(_cache._previewHistory[0]);
            }
            _cache._previewEdited = false;
            _cache._previewHistory = _cache._previewHistory.slice(0, 1);
            _invalidate();
        },

        galleryPreviewSave() {
            const code = _cache._previewCode;
            const canvas = document.getElementById('gallery-preview-canvas');
            if (!canvas || !code) return;
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            _savePreviewEdit(code, dataUrl);
        },

        galleryDeleteImage({ code, name }) {
            // 先关闭当前预览弹窗，再打开删除确认
            _cache._previewCode = null;
            _cache._previewSrc = null;
            _cache._previewEditMode = null;
            _cache._previewEdited = false;
            _cache._previewHistory = [];
            _showModal('confirmDelete', { type: 'image', id: code, name });
        },

        async galleryRenameImage({ code }) {
            const input = document.getElementById('gallery-rename-input');
            if (!input) return;
            const newName = (input.value || '').trim();
            if (!newName) {
                _toast('error', '命名失败', '图片名不能为空');
                return;
            }
            try {
                await updateImage(code, { name: newName });
                const idx = _cache.images.findIndex(i => i.code === code);
                if (idx >= 0) {
                    _cache.images[idx] = { ..._cache.images[idx], name: newName };
                }
                // 关闭预览弹窗
                _cache._previewCode = null;
                _cache._previewSrc = null;
                _invalidate();
                _toast('success', '已保存', newName);
            } catch (e) {
                _toast('error', '保存失败', e.message);
            }
        },

        galleryCloseModal() {
            _closeModal();
        },

        // ---- 给 AI 用 ----
        async galleryGetImageUrl({ code }) {
            const img = await getImageByCode(code);
            if (!img) return null;
            return img.source || img.thumbnail || null;
        },

        async galleryListGroupImages({ groupId }) {
            const images = await getGroupImages(groupId);
            return images.map(img => ({ code: img.code, name: img.name, thumbnail: img.thumbnail || img.source }));
        },
    };
}

// ============================================
// 裁剪框计算
// ============================================

function _calcCropBox() {
    const imgEl = document.getElementById('crop-image');
    if (!imgEl) return { sx: 0, sy: 0, sw: 1, sh: 1 };

    const cs = _cache.cropState || {};
    const scale = cs.scale || 1;
    const ox = cs.offsetX || 0;
    const oy = cs.offsetY || 0;
    const CSS_SIZE = 280;

    const cssW = CSS_SIZE * scale;
    const cssH = CSS_SIZE * scale;
    const stageX = (CSS_SIZE - cssW) / 2 + ox;
    const stageY = (CSS_SIZE - cssH) / 2 + oy;

    const cropLeft = Math.max(0, -stageX) / cssW;
    const cropTop = Math.max(0, -stageY) / cssH;
    const cropRight = Math.max(0, stageX + cssW - CSS_SIZE) / cssW;
    const cropBottom = Math.max(0, stageY + cssH - CSS_SIZE) / cssH;

    return {
        sx: cropLeft,
        sy: cropTop,
        sw: Math.max(0.01, Math.min(1, 1 - cropLeft - cropRight)),
        sh: Math.max(0.01, Math.min(1, 1 - cropTop - cropBottom)),
    };
}
