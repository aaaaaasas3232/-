/**
 * 设置 App · 图库模块
 */

import { renderGallerySection } from './section.js';
import { initGalleryDb } from './gallery-db.js';
import { loadGalleryCache } from './gallery-methods.js';
import { initCropperEvents } from './gallery-events.js';

export {
    renderGallerySection,
    initGalleryDb,
    loadGalleryCache,
};

export async function bootstrapGallery() {
    console.log('[gallery] bootstrapGallery start');
    try {
        await initGalleryDb();
        console.log('[gallery] initGalleryDb done');
    } catch(e) { console.error('[gallery] initGalleryDb error:', e); }
    try {
        await loadGalleryCache();
        console.log('[gallery] loadGalleryCache done');
    } catch(e) { console.error('[gallery] loadGalleryCache error:', e); }
    try {
        initCropperEvents();
        console.log('[gallery] initCropperEvents done');
    } catch(e) { console.error('[gallery] initCropperEvents error:', e); }
}
