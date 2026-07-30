/**
 * 小听 - 数据库入口（ESM 版）
 * 加载顺序：engine → 基础表 → 音乐表
 * 用法：src/index.js 用 import 引入，db 实例挂到 window 以便老代码继续访问
 *
 * 增加新数据库 = 新建一个 stores 文件，然后在这里 import 并 createXxx()
 */
import { ListenDb } from './engine.js';
import { createBaseStoresDatabase } from './base-stores.js';
import { createMusicStoresDatabase } from './music-stores.js';

export { ListenDb };

const myDb = createBaseStoresDatabase();
const musicDb = createMusicStoresDatabase();

// 兼容层：把 db 实例挂到 window，让老代码（非 ESM）继续能用
window.myDb = myDb;
window.musicDb = musicDb;
window.ListenDb = ListenDb;