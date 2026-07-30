/**
 * 图库模块 · 渲染层（白色主色调 + 蓝色辅助）
 *
 * 使用 data-app-action，框架自动处理点击事件
 */

import { escapeHtml } from '@/src/core/escape.js';
import { getGalleryCache } from './gallery-methods.js';

const SETTINGS_APP_ID = 'settings';

function wvAction(method, payload = {}) {
    const obj = { action: 'appMethod', appId: SETTINGS_APP_ID, method, payload };
    return `data-app-action='${escapeHtml(JSON.stringify(obj))}'`;
}

// ============================================
// 主渲染入口（同步）
// ============================================

export function renderGallerySection(app) {
    const cache = getGalleryCache();

    // 裁剪模式
    if (cache.pendingImageData) {
        return renderCropStage(cache);
    }

    // 预览模式
    if (cache._previewCode) {
        return renderPreview(cache);
    }

    // 弹窗模式
    if (cache._modalType) {
        return renderModalContent(cache);
    }

    switch (cache.currentView) {
        case 'albums':    return renderAlbumsView(cache);
        case 'groups':    return renderGroupsView(cache);
        case 'images':    return renderImagesView(cache);
        default:          return renderLibrariesView(cache);
    }
}

// ============================================
// 视图：图库列表
// ============================================

function renderLibrariesView(cache) {
    const libs = cache.libraries || [];

    return `
        <div class="gallery-app">
            <div class="gallery-content">
                ${libs.length === 0 ? renderEmptyLibrary() : ''}
                ${libs.map(lib => renderLibraryCard(lib)).join('')}
                ${libs.length < 9 ? renderAddCard('library', '新建图库', 'galleryShowAddLibrary', {}) : ''}
            </div>
        </div>
    `;
}

function renderLibraryCard(lib) {
    return `
        <div class="gallery-card" ${wvAction('galleryOpenLibrary', { libraryId: lib.id })}>
            <div class="gallery-card__icon" style="background:linear-gradient(135deg,#2563eb,#3b82f6)">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round">
                    <rect x="3" y="3" width="7" height="7" rx="1"/>
                    <rect x="14" y="3" width="7" height="7" rx="1"/>
                    <rect x="3" y="14" width="7" height="7" rx="1"/>
                    <rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
            </div>
            <div class="gallery-card__body">
                <div class="gallery-card__name">${escapeHtml(lib.name)}</div>
                <div class="gallery-card__meta">${_formatDate(lib.createdAt)}</div>
            </div>
            <div class="gallery-card__arrow">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
        </div>
    `;
}

// ============================================
// 视图：图包列表
// ============================================

function renderAlbumsView(cache) {
    const libId = cache.currentLibraryId;
    const lib = (cache.libraries || []).find(l => l.id === libId);
    if (!lib) return renderLibrariesView(cache);

    const albums = (cache.albums || []).filter(a => a.libraryId === libId);

    return `
        <div class="gallery-app">
            <div class="gallery-nav">
                <button class="gallery-nav__back" ${wvAction('galleryGoBack', { level: 'library' })}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div>
                    <div class="gallery-nav__title">${escapeHtml(lib.name)}</div>
                    <div class="gallery-nav__subtitle">图包</div>
                </div>
                <div style="flex:1"></div>
                <button class="gallery-nav__action" ${wvAction('galleryEditLibrary', { libraryId: libId })}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
            </div>
            <div class="gallery-content">
                ${albums.length === 0 ? renderEmptyAlbum() : ''}
                ${albums.map(album => renderAlbumCard(album)).join('')}
                ${albums.length < 9 ? renderAddCard('album', '新建图包', 'galleryShowAddAlbum', { libraryId: libId }) : ''}
            </div>
        </div>
    `;
}

function renderAlbumCard(album) {
    return `
        <div class="gallery-card" ${wvAction('galleryOpenAlbum', { albumId: album.id, libraryId: album.libraryId })}>
            <div class="gallery-card__icon" style="background:linear-gradient(135deg,#06b6d4,#0ea5e9)">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
            </div>
            <div class="gallery-card__body">
                <div class="gallery-card__name">${escapeHtml(album.name)}</div>
                <div class="gallery-card__meta">${_formatDate(album.createdAt)}</div>
            </div>
            <div class="gallery-card__arrow">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
        </div>
    `;
}

// ============================================
// 视图：图组列表
// ============================================

function renderGroupsView(cache) {
    const albumId = cache.currentAlbumId;
    const album = (cache.albums || []).find(a => a.id === albumId);
    if (!album) return renderLibrariesView(cache);

    const groups = (cache.groups || []).filter(g => g.albumId === albumId);

    return `
        <div class="gallery-app">
            <div class="gallery-nav">
                <button class="gallery-nav__back" ${wvAction('galleryGoBack', { level: 'album' })}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div>
                    <div class="gallery-nav__title">${escapeHtml(album.name)}</div>
                    <div class="gallery-nav__subtitle">图组</div>
                </div>
                <div style="flex:1"></div>
                <button class="gallery-nav__action" ${wvAction('galleryEditAlbum', { albumId })}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
            </div>
            <div class="gallery-content">
                ${groups.length === 0 ? renderEmptyGroup() : ''}
                ${groups.map(group => renderGroupCard(group)).join('')}
                ${groups.length < 9 ? renderAddCard('group', '新建图组', 'galleryShowAddGroup', { albumId }) : ''}
            </div>
        </div>
    `;
}

function renderGroupCard(group) {
    return `
        <div class="gallery-card" ${wvAction('galleryOpenGroup', { groupId: group.id, albumId: group.albumId })}>
            <div class="gallery-card__icon" style="background:linear-gradient(135deg,#0ea5e9,#38bdf8)">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <path d="M21 15l-5-5L5 21"/>
                </svg>
            </div>
            <div class="gallery-card__body">
                <div class="gallery-card__name">${escapeHtml(group.name)}</div>
                <div class="gallery-card__meta">
                    <span class="gallery-badge">${group.imageSize?.width || 100}×${group.imageSize?.height || 100}px</span>
                </div>
            </div>
            <div class="gallery-card__arrow">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
        </div>
    `;
}

// ============================================
// 视图：图片列表
// ============================================

function renderImagesView(cache) {
    const groupId = cache.currentGroupId;
    const group = (cache.groups || []).find(g => g.id === groupId);
    if (!group) return renderLibrariesView(cache);

    const album = (cache.albums || []).find(a => a.id === group.albumId);
    const lib = (cache.libraries || []).find(l => l.id === group.libraryId);
    const images = (cache.images || []).filter(i => i.groupId === groupId);

    return `
        <div class="gallery-app">
            <div class="gallery-nav">
                <button class="gallery-nav__back" ${wvAction('galleryGoBack', { level: 'group' })}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div>
                    <div class="gallery-nav__title">${escapeHtml(group.name)}</div>
                    <div class="gallery-nav__subtitle">${escapeHtml(lib?.name || '')} › ${escapeHtml(album?.name || '')}</div>
                </div>
                <div style="flex:1"></div>
                <button class="gallery-nav__action" ${wvAction('galleryEditGroup', { groupId })}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
            </div>
            <div class="gallery-content">
                <div class="gallery-size-info">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                    <span>图片尺寸 ${group.imageSize?.width || 100}×${group.imageSize?.height || 100}px</span>
                    <span class="gallery-size-count">${images.length}/99</span>
                </div>
                <div class="gallery-grid">
                    ${images.map(img => `
                        <div class="gallery-thumb gallery-thumb--text" ${wvAction('galleryPreviewImage', { code: img.code })}>
                            <div class="gallery-thumb__text-label">${escapeHtml(img.name || img.code)}</div>
                            <div class="gallery-thumb__code">${escapeHtml(img.code)}</div>
                        </div>
                    `).join('')}
                    ${images.length < 99 ? `
                        <div class="gallery-add-thumb" ${wvAction('galleryShowAddImage', { groupId })}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5">
                                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            <span>添加图片</span>
                        </div>
                    ` : ''}
                </div>
                ${images.length === 0 ? `
                    <div class="gallery-empty-state">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <path d="M21 15l-5-5L5 21"/>
                        </svg>
                        <div class="gallery-empty-title">暂无图片</div>
                        <div class="gallery-empty-desc">点击上方按钮添加图片</div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

// ============================================
// 空状态
// ============================================

function renderEmptyLibrary() {
    return `
        <div class="gallery-empty-state">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#bfdbfe" stroke-width="1.5">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            <div class="gallery-empty-title">暂无图库</div>
            <div class="gallery-empty-desc">创建一个图库来管理你的图片收藏</div>
        </div>
    `;
}

function renderEmptyAlbum() {
    return `
        <div class="gallery-empty-state">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#bfdbfe" stroke-width="1.5">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <div class="gallery-empty-title">暂无图包</div>
            <div class="gallery-empty-desc">在图库内创建一个图包来分类管理</div>
        </div>
    `;
}

function renderEmptyGroup() {
    return `
        <div class="gallery-empty-state">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#bfdbfe" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <path d="M21 15l-5-5L5 21"/>
            </svg>
            <div class="gallery-empty-title">暂无图组</div>
            <div class="gallery-empty-desc">在图包内创建一个图组来存放图片</div>
        </div>
    `;
}

// ============================================
// 通用卡片
// ============================================

function renderAddCard(type, label, method, payload) {
    return `
        <div class="gallery-card gallery-card--add" ${wvAction(method, payload)}>
            <div class="gallery-card__icon gallery-card__icon--add">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
            </div>
            <div class="gallery-card__body">
                <div class="gallery-card__name gallery-card__name--add">${label}</div>
            </div>
        </div>
    `;
}

// ============================================
// 裁剪舞台
// ============================================

function renderCropStage(cache) {
    const groupId = cache._tempGroupId || cache.currentGroupId || '';
    const size = cache._pendingCropSize || { width: 100, height: 100 };
    const cs = cache.cropState || { scale: 1, offsetX: 0, offsetY: 0 };

    return `
        <div class="gallery-app">
            <div class="gallery-cropper">
                <div class="gallery-cropper__header">
                    <button class="gallery-cropper__btn" ${wvAction('galleryCancelCrop')}>取消</button>
                    <div class="gallery-cropper__title">裁剪图片</div>
                    <button class="gallery-cropper__btn gallery-cropper__btn--primary" ${wvAction('galleryConfirmCrop', { groupId })}>完成</button>
                </div>
                <div class="gallery-cropper__stage" id="crop-stage">
                    <img
                        class="gallery-cropper__image"
                        id="crop-image"
                        src="${escapeHtml(cache.pendingImageData)}"
                        crossorigin="anonymous"
                        style="width:280px;height:280px;object-fit:contain;transform:translate(${cs.offsetX}px,${cs.offsetY}px) scale(${cs.scale});transform-origin:center center"
                    />
                    <div class="gallery-cropper__frame"></div>
                </div>
                <div class="gallery-cropper__tips">
                    <span>拖动图片调整位置</span>
                    <span>滚轮缩放</span>
                </div>
                <div class="gallery-cropper__size">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                    输出尺寸：${size.width}×${size.height}px
                </div>
            </div>
        </div>
    `;
}

// ============================================
// 图片预览
// ============================================

function renderPreview(cache) {
    const code = cache._previewCode;
    const img = (cache.images || []).find(i => i.code === code);
    if (!img) {
        cache._previewCode = null;
        cache._previewSrc = null;
        return renderLibrariesView(cache);
    }

    // ★ 仅在打开预览时按需读取 base64，关闭即释放（见 _previewSrc）
    const imgSrc = cache._previewSrc;

    return `
        <div class="gallery-preview-modal" id="gallery-preview-modal-root">
            <div class="gallery-preview-modal__card">
                <!-- 顶部工具栏 -->
                <div class="gallery-preview-modal__toolbar">
                    <div class="gallery-preview-modal__info-row">
                        <span class="gallery-preview-modal__title">${escapeHtml(img.name || '未命名')}</span>
                        <span class="gallery-preview-modal__meta">${img.originalSize ? `${img.originalSize.width}×${img.originalSize.height}` : ''}</span>
                    </div>
                    <div class="gallery-preview-modal__actions">
                        <button class="gallery-preview-modal__btn" ${wvAction('galleryDeleteImage', { code: img.code, name: img.name })} title="删除">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                        <button class="gallery-preview-modal__btn gallery-preview-modal__btn--close" ${wvAction('galleryClosePreview')} title="关闭">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                </div>

                <!-- 图片显示区 -->
                <div class="gallery-preview-modal__canvas-wrap" id="gallery-preview-canvas-wrap">
                    ${imgSrc
                        ? `<img class="gallery-preview-modal__image" src="${escapeHtml(imgSrc)}" alt="${escapeHtml(img.name || '')}" draggable="false" />`
                        : `<div class="gallery-preview-modal__loading">加载中…</div>`
                    }
                </div>

                <!-- 底部命名栏 -->
                <div class="gallery-preview-modal__bottom">
                    <div class="gallery-preview-modal__name-group">
                        <input type="text" id="gallery-rename-input" class="gallery-preview-modal__name-input" placeholder="为图片命名" value="${escapeHtml(img.name || '')}" maxlength="60" />
                        <button class="gallery-preview-modal__save-btn" id="gallery-rename-save-btn" ${wvAction('galleryRenameImage', { code: img.code })}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                            保存
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// 弹窗内容
// ============================================

function renderModalContent(cache) {
    switch (cache._modalType) {
        case 'addLibrary':     return renderModalAddLibrary();
        case 'editLibrary':    return renderModalEditLibrary(cache._modalData);
        case 'addAlbum':       return renderModalAddAlbum(cache._modalData);
        case 'editAlbum':      return renderModalEditAlbum(cache._modalData);
        case 'addGroup':       return renderModalAddGroup(cache._modalData);
        case 'editGroup':      return renderModalEditGroup(cache._modalData);
        case 'addImage':       return renderModalAddImage(cache._modalData);
        case 'confirmDelete':  return renderModalConfirmDelete(cache._modalData);
        default:               return '';
    }
}

function renderModalAddLibrary() {
    return `
        <div class="gallery-modal-overlay">
            <div class="gallery-modal">
                <div class="gallery-modal__title">新建图库</div>
                <div class="gallery-modal__body">
                    <input class="gallery-input" type="text" id="gallery-input-name" placeholder="图库名称，如：头像收藏" maxlength="20" autocomplete="off"/>
                </div>
                <div class="gallery-modal__actions">
                    <button class="gallery-modal__btn gallery-modal__btn--ghost" ${wvAction('galleryCloseModal')}>取消</button>
                    <button class="gallery-modal__btn gallery-modal__btn--primary" ${wvAction('galleryCreateLibrary')}>创建</button>
                </div>
            </div>
        </div>
    `;
}

function renderModalEditLibrary(data) {
    return `
        <div class="gallery-modal-overlay">
            <div class="gallery-modal">
                <div class="gallery-modal__title">编辑图库</div>
                <div class="gallery-modal__body">
                    <input class="gallery-input" type="text" id="gallery-input-name" placeholder="图库名称" maxlength="20" value="${escapeHtml(data.name || '')}" autocomplete="off"/>
                </div>
                <div class="gallery-modal__actions">
                    <button class="gallery-modal__btn gallery-modal__btn--ghost" ${wvAction('galleryCloseModal')}>取消</button>
                    <button class="gallery-modal__btn gallery-modal__btn--danger" ${wvAction('galleryDeleteLibrary', { libraryId: data.libraryId })}>删除</button>
                    <button class="gallery-modal__btn gallery-modal__btn--primary" ${wvAction('gallerySaveLibrary', { libraryId: data.libraryId })}>保存</button>
                </div>
            </div>
        </div>
    `;
}

function renderModalAddAlbum(data) {
    return `
        <div class="gallery-modal-overlay">
            <div class="gallery-modal">
                <div class="gallery-modal__title">新建图包</div>
                <div class="gallery-modal__body">
                    <input class="gallery-input" type="text" id="gallery-input-name" placeholder="图包名称，如：男头图包" maxlength="20" autocomplete="off"/>
                </div>
                <div class="gallery-modal__actions">
                    <button class="gallery-modal__btn gallery-modal__btn--ghost" ${wvAction('galleryCloseModal')}>取消</button>
                    <button class="gallery-modal__btn gallery-modal__btn--primary" ${wvAction('galleryCreateAlbum', { libraryId: data.libraryId })}>创建</button>
                </div>
            </div>
        </div>
    `;
}

function renderModalEditAlbum(data) {
    return `
        <div class="gallery-modal-overlay">
            <div class="gallery-modal">
                <div class="gallery-modal__title">编辑图包</div>
                <div class="gallery-modal__body">
                    <input class="gallery-input" type="text" id="gallery-input-name" placeholder="图包名称" maxlength="20" value="${escapeHtml(data.name || '')}" autocomplete="off"/>
                </div>
                <div class="gallery-modal__actions">
                    <button class="gallery-modal__btn gallery-modal__btn--ghost" ${wvAction('galleryCloseModal')}>取消</button>
                    <button class="gallery-modal__btn gallery-modal__btn--danger" ${wvAction('galleryDeleteAlbum', { albumId: data.albumId })}>删除</button>
                    <button class="gallery-modal__btn gallery-modal__btn--primary" ${wvAction('gallerySaveAlbum', { albumId: data.albumId })}>保存</button>
                </div>
            </div>
        </div>
    `;
}

function renderModalAddGroup(data) {
    return `
        <div class="gallery-modal-overlay">
            <div class="gallery-modal">
                <div class="gallery-modal__title">新建图组</div>
                <div class="gallery-modal__body">
                    <input class="gallery-input" type="text" id="gallery-input-name" placeholder="图组名称，如：忧郁女头" maxlength="20" autocomplete="off"/>
                    <div class="gallery-input-group">
                        <label class="gallery-input-label">图片尺寸</label>
                        <div class="gallery-input-row">
                            <input class="gallery-input gallery-input--sm" type="number" id="gallery-input-width" placeholder="宽" value="100" min="10" max="500"/>
                            <span class="gallery-input-sep">×</span>
                            <input class="gallery-input gallery-input--sm" type="number" id="gallery-input-height" placeholder="高" value="100" min="10" max="500"/>
                            <span class="gallery-input-unit">px</span>
                        </div>
                    </div>
                </div>
                <div class="gallery-modal__actions">
                    <button class="gallery-modal__btn gallery-modal__btn--ghost" ${wvAction('galleryCloseModal')}>取消</button>
                    <button class="gallery-modal__btn gallery-modal__btn--primary" ${wvAction('galleryCreateGroup', { albumId: data.albumId })}>创建</button>
                </div>
            </div>
        </div>
    `;
}

function renderModalEditGroup(data) {
    return `
        <div class="gallery-modal-overlay">
            <div class="gallery-modal">
                <div class="gallery-modal__title">编辑图组</div>
                <div class="gallery-modal__body">
                    <input class="gallery-input" type="text" id="gallery-input-name" placeholder="图组名称" maxlength="20" value="${escapeHtml(data.name || '')}" autocomplete="off"/>
                    <div class="gallery-input-group">
                        <label class="gallery-input-label">图片尺寸</label>
                        <div class="gallery-input-row">
                            <input class="gallery-input gallery-input--sm" type="number" id="gallery-input-width" placeholder="宽" value="${data.width || 100}" min="10" max="500"/>
                            <span class="gallery-input-sep">×</span>
                            <input class="gallery-input gallery-input--sm" type="number" id="gallery-input-height" placeholder="高" value="${data.height || 100}" min="10" max="500"/>
                            <span class="gallery-input-unit">px</span>
                        </div>
                    </div>
                </div>
                <div class="gallery-modal__actions">
                    <button class="gallery-modal__btn gallery-modal__btn--ghost" ${wvAction('galleryCloseModal')}>取消</button>
                    <button class="gallery-modal__btn gallery-modal__btn--danger" ${wvAction('galleryDeleteGroup', { groupId: data.groupId })}>删除</button>
                    <button class="gallery-modal__btn gallery-modal__btn--primary" ${wvAction('gallerySaveGroup', { groupId: data.groupId })}>保存</button>
                </div>
            </div>
        </div>
    `;
}

function renderModalAddImage(data) {
    const groupId = data.groupId || '';
    return `
        <div class="gallery-modal-overlay">
            <div class="gallery-modal gallery-modal--wide">
                <div class="gallery-modal__title">添加图片</div>
                <div class="gallery-modal__body">
                    <div class="gallery-upload-zone" id="gallery-upload-zone" data-gallery-upload="true">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" stroke-width="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <path d="M21 15l-5-5L5 21"/>
                        </svg>
                        <div class="gallery-upload-zone__text">点击或拖拽上传图片</div>
                        <div class="gallery-upload-zone__hint">支持 JPG · PNG · GIF · WebP</div>
                        <input type="file" id="gallery-file-input" accept="image/*" style="display:none" multiple/>
                    </div>
                    <div class="gallery-modal__divider"><span>或</span></div>
                    <input class="gallery-input" type="text" id="gallery-input-url" placeholder="输入图片 URL 链接" autocomplete="off"/>
                </div>
                <div class="gallery-modal__actions">
                    <button class="gallery-modal__btn gallery-modal__btn--ghost" ${wvAction('galleryCloseModal')}>取消</button>
                    <button class="gallery-modal__btn gallery-modal__btn--secondary" ${wvAction('galleryAddImageFromUrl', { groupId })}>从链接添加</button>
                    <button class="gallery-modal__btn gallery-modal__btn--primary" ${wvAction('galleryTriggerUpload', { groupId })}>本地上传</button>
                </div>
            </div>
        </div>
    `;
}

function renderModalConfirmDelete(data) {
    const titles = { library: '删除图库', album: '删除图包', group: '删除图组（含图片）', image: '删除图片' };
    const msgs = {
        library: `确定要删除「${escapeHtml(data.name || '')}」吗？删除后无法恢复。`,
        album:   `确定要删除「${escapeHtml(data.name || '')}」吗？图包内必须有空的图组才能删除。`,
        group:   `确定要删除图组「${escapeHtml(data.name || '')}」及其所有图片吗？此操作不可撤销。`,
        image:   `确定要删除图片「${escapeHtml(data.name || '')}」吗？`,
    };

    return `
        <div class="gallery-modal-overlay">
            <div class="gallery-modal gallery-modal--confirm">
                <div class="gallery-modal__title gallery-modal__title--danger">${titles[data.type] || '确认删除'}</div>
                <div class="gallery-modal__msg">${msgs[data.type] || '确定要删除吗？'}</div>
                <div class="gallery-modal__actions gallery-modal__actions--confirm">
                    <button class="gallery-modal__btn gallery-modal__btn--ghost" ${wvAction('galleryCloseModal')}>取消</button>
                    <button class="gallery-modal__btn gallery-modal__btn--danger-solid" ${wvAction('galleryConfirmDelete', { type: data.type, id: data.id })}>确认删除</button>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// 内部工具
// ============================================

function _formatDate(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const now = new Date();
    const diff = now - d;
    if (diff < 60_000) return '刚刚';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
    if (d.toDateString() === now.toDateString()) {
        return `今天 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
    if (d.getFullYear() === now.getFullYear()) {
        return `${d.getMonth() + 1}月${d.getDate()}日`;
    }
    return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
}
