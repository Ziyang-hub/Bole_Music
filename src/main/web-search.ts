/**
 * 伯乐模拟器 - 网络搜索服务
 *
 * 使用必应中国（cn.bing.com），国内可访问
 * 用于搜索歌曲背景、歌手信息、实时资讯等
 */

export interface SearchResult {
  title: string;
  snippet: string;
  url?: string;
}

/**
 * 搜索网络信息（国内可用）
 */
export async function webSearch(query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  try {
    const url = `https://cn.bing.com/search?q=${encodeURIComponent(query)}&setlang=zh-cn`;
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
    });
    const html = await resp.text();

    // 提取搜索结果摘要（必应的搜索结果结构）
    // 匹配 <li class="b_algo"> 或 <div class="b_caption"> 中的内容
    const captionRegex = /<div class="b_caption"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi;
    const titleRegex = /<h2[^>]*><a[^>]*>([\s\S]*?)<\/a><\/h2>/gi;

    let match;
    const captions: string[] = [];
    const titles: string[] = [];

    while ((match = captionRegex.exec(html)) !== null && captions.length < 5) {
      const text = match[1].replace(/<[^>]+>/g, '').trim();
      if (text.length > 10) captions.push(text);
    }

    // Reset regex
    const titleRegex2 = /<h2[^>]*><a[^>]*>([\s\S]*?)<\/a><\/h2>/gi;
    while ((match = titleRegex2.exec(html)) !== null && titles.length < 5) {
      const text = match[1].replace(/<[^>]+>/g, '').trim();
      if (text.length > 2) titles.push(text);
    }

    for (let i = 0; i < Math.min(captions.length, 5); i++) {
      results.push({
        title: titles[i] || query,
        snippet: captions[i].slice(0, 600),
      });
    }
  } catch (err: any) {
    console.log('[web-search] Search failed:', err.message);
  }

  return results.slice(0, 5);
}

export async function searchSongInfo(title: string, artist?: string): Promise<SearchResult[]> {
  const q = artist ? `${artist} ${title} 歌曲 背景 创作` : `${title} 歌曲`;
  return webSearch(q);
}

export async function searchArtistInfo(artist: string): Promise<SearchResult[]> {
  return webSearch(`${artist} 歌手 简介 音乐风格`);
}
