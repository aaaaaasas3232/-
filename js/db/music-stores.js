/**
 * 小听 - 音乐 App 独立数据库
 * 包含歌单、歌曲、播放历史、收藏
 */
import { ListenDb } from './engine.js';

export function createMusicStoresDatabase() {
    const musicDb = new ListenDb({ dbName: 'listen_music_db', dbVersion: 1 });

    const musicStores = [
        { name: 'musicPlaylists', keyPath: 'playlistId' },
        { name: 'musicSongs', keyPath: 'songId' },
        { name: 'musicHistory', keyPath: 'recordId' },
        { name: 'musicLiked', keyPath: 'songId' },
    ];

    for (const store of musicStores) {
        musicDb.appendBaseStore(store.name, store.keyPath);
    }

    musicDb.open().catch(error => {
        console.error('[db/music-stores] 打开音乐数据库失败:', error);
    });

    return musicDb;
}