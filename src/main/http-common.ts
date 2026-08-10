/**
 * 公共 HTTP 请求头（统一维护，避免多处复制）
 */

/** 通用浏览器 UA（伪装浏览器访问，用于绕过简单反爬） */
export const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
};

/** 网易云音乐相关请求头（UA + Referer 防防盗链） */
export const MUSIC_HEADERS: Record<string, string> = {
  ...BROWSER_HEADERS,
  'Referer': 'https://music.163.com/',
};
