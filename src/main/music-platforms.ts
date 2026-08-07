/**
 * 伯乐模拟器 - 音乐平台连接器
 *
 * 对接网易云音乐、QQ音乐等平台，提供：
 * - 歌曲搜索
 * - 链接解析
 * - 歌词获取
 * - 歌曲详情
 *
 * 底层使用 NeteaseCloudMusicApi
 */

import type { SongInfo } from './music-types';

// ----- 链接解析 -----

/**
 * 支持的平台链接模式
 */
const URL_PATTERNS: { platform: string; pattern: RegExp }[] = [
  {
    platform: 'netease',
    pattern: /music\.163\.com\/(?:#\/)?song\?id=(\d+)/,
  },
  {
    platform: 'netease',
    pattern: /163cn\.tv\/(\w+)/,
  },
  {
    platform: 'qq',
    pattern: /y\.qq\.com\/n\/(?:ryqq\/)?songDetail\/(\w+)/,
  },
  {
    platform: 'qq',
    pattern: /i\.y\.qq\.com\/v8\/playsong\.html\?songid=(\d+)/,
  },
];

/**
 * 解析歌曲链接，提取平台和ID
 */
export function parseSongUrl(url: string): { platform: string; songId: string } | null {
  for (const { platform, pattern } of URL_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      return { platform, songId: match[1] };
    }
  }
  return null;
}

/**
 * 判断是否是歌曲链接
 */
export function isSongUrl(text: string): boolean {
  return URL_PATTERNS.some(({ pattern }) => pattern.test(text));
}

// ----- 歌曲搜索 -----

/**
 * 搜索歌曲
 */
export async function searchSongs(
  keyword: string,
  limit: number = 10
): Promise<SongInfo[]> {
  try {
    // 动态导入 NeteaseCloudMusicApi
    const { search } = await import('NeteaseCloudMusicApi');

    const result = await search({ keywords: keyword, limit, type: 1 });

    if (result.status === 200) {
      const body = result.body as any;
      const songs = body?.result?.songs;
      if (!songs) return [];
      return songs.map((song: any) => ({
        id: String(song.id),
        name: song.name,
        artists: (song.artists || []).map((a: any) => a.name),
        album: song.album
          ? {
              name: song.album.name,
              picUrl: song.album.picUrl || song.album.artist?.img1v1Url,
            }
          : undefined,
        duration: song.duration,
        platform: 'netease' as const,
      }));
    }

    return [];
  } catch (err) {
    console.error('搜索歌曲失败:', err);
    return [];
  }
}

// ----- 歌词获取 -----

/**
 * 获取歌词
 */
export async function getLyrics(songId: string): Promise<string | null> {
  try {
    const { lyric } = await import('NeteaseCloudMusicApi');
    const result = await lyric({ id: Number(songId) });

    if (result.status === 200) {
      const body = result.body as any;
      const lrc = body?.lrc?.lyric || body?.lyric || '';
      // 清理时间标记，只保留纯文本
      return lrc
        .replace(/\[.*?\]/g, '')
        .trim()
        .slice(0, 2000); // 限制长度，避免 prompt 过长
    }
    return null;
  } catch (err) {
    console.error('获取歌词失败:', err);
    return null;
  }
}

// ----- 歌曲详情 -----

/**
 * 获取歌曲详情
 */
export async function getSongDetail(songId: string): Promise<SongInfo | null> {
  try {
    const { song_detail } = await import('NeteaseCloudMusicApi');
    const result = await song_detail({ ids: String(songId) });

    if (result.status === 200) {
      const body = result.body as any;
      const songs = body?.songs;
      if (!songs || songs.length === 0) return null;
      const song = songs[0];
      return {
        id: String(song.id),
        name: song.name,
        artists: (song.al?.name ? [{ name: song.ar?.[0]?.name || '未知' }] : [])
          .concat((song.ar || []).slice(1).map((a: any) => ({ name: a.name })))
          .filter(Boolean)
          .map((a: any) => a.name || a),
        album: song.al
          ? { name: song.al.name, picUrl: song.al.picUrl }
          : undefined,
        duration: song.dt,
        platform: 'netease',
      };
    }
    return null;
  } catch (err) {
    console.error('获取歌曲详情失败:', err);
    return null;
  }
}

// ----- 歌单 -----

/**
 * 解析歌单链接
 */
const PLAYLIST_PATTERNS = [
  /music\.163\.com\/(?:#\/)?playlist\?id=(\d+)/,
  /music\.163\.com\/playlist\/(\d+)/,
];

export function isPlaylistUrl(text: string): boolean {
  return PLAYLIST_PATTERNS.some((p) => p.test(text));
}

export function parsePlaylistUrl(url: string): string | null {
  for (const p of PLAYLIST_PATTERNS) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/**
 * 获取歌单歌曲列表
 */
export async function getPlaylistSongs(
  playlistId: string
): Promise<{ name: string; songs: SongInfo[] }> {
  try {
    const { playlist_detail } = await import('NeteaseCloudMusicApi');
    const result = await playlist_detail({ id: Number(playlistId) });

    if (result.status === 200) {
      const body = result.body as any;
      const playlist = body?.playlist;
      if (!playlist) throw new Error('未找到歌单');

      const songs = (playlist.tracks || []).map((track: any) => ({
        id: String(track.id),
        name: track.name,
        artists: (track.ar || []).map((a: any) => a.name),
        album: track.al ? { name: track.al.name, picUrl: track.al.picUrl } : undefined,
        duration: track.dt,
        platform: 'netease' as const,
      }));

      return { name: playlist.name || '未知歌单', songs };
    }
    throw new Error('获取歌单失败');
  } catch (err) {
    console.error('获取歌单失败:', err);
    throw err;
  }
}

// ----- 综合信息获取 -----

/**
 * 获取歌曲的完整信息（歌词+详情）
 * 用于 AI 分析前的数据准备
 */
export async function getSongFullInfo(
  songId: string
): Promise<{ song: SongInfo | null; lyrics: string | null }> {
  const [song, lyrics] = await Promise.all([
    getSongDetail(songId),
    getLyrics(songId),
  ]);
  return { song, lyrics };
}
