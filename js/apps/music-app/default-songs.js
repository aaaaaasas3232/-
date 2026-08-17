/**
 * music-app · default-songs.js
 * 曲库默认是空的。播放、歌词、LRC 导入导出都还在，
 * 用户自己用「添加歌曲」填 http(s) 音频地址即可。
 *
 * 仓库里不放任何受版权保护的歌名、歌词或音源链接。
 */

/**
 * 没有歌词时的兜底。
 * 以前这里放了一段编造的示例歌词，结果用户自己加的每一首歌都会显示这段假词，
 * 看着像是识别出了歌词其实全是假的。现在返回空数组，UI 各处会显示「暂无歌词」。
 */
export const defaultLyrics = [];

/**
 * 曾经内置、现已移除的歌曲 id。
 * 老用户的 localStorage / IndexedDB 快照里还留着它们，setup 时按这份名单清掉，
 * 否则「删掉预设歌曲」在升级用户那边看不到效果。
 *
 * 1 / 2 / 3 = 旧版内置试听曲，已从仓库移除。
 */
export const removedBuiltinSongIds = [1, 2, 3];

export const defaultSongs = [];

export const defaultPlaylists = [
    { id: 1, name: '我喜欢的音乐', cover: null, color: '#fb7299', songs: [] },
    { id: 2, name: '深夜电台', cover: null, color: '#667eea', songs: [] },
];
