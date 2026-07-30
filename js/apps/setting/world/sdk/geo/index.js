/**
 * settings-sdk · 地理系统模块（Geo Module）
 *
 * 导出：
 *   - createPlacesApi: 地点工厂
 *   - createLocationsApi: 场所工厂
 *   - 所有常量
 */

// 地理系统 API
export {
    createPlacesApi,
    createLocationsApi,
} from './geo-api.js';

// 常量
export {
    DEFAULT_PLACE,
    DEFAULT_LOCATION,
    REAL_CITIES,
} from './geo-constants.js';
