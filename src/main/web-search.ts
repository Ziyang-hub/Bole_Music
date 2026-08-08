/**
 * 伯乐模拟器 - 网络搜索服务
 *
 * 使用 DuckDuckGo Instant Answer API（免费，无需 Key）
 * 用于搜索歌曲背景、歌手信息、实时资讯等
 */

/** 搜索结果 */
export interface SearchResult {
  title: string;
  snippet: string;
  url?: string;
}

/**
 * 搜索网络信息
 * @param query 搜索关键词
 * @returns 搜索结果列表（最多5条）
 */
export async function webSearch(query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  // 1. DuckDuckGo Instant Answer API（知识图谱）
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data: any = await resp.json();

    // 摘要信息
    if (data.Abstract && data.Abstract.length > 10) {
      results.push({
        title: data.Heading || query,
        snippet: data.Abstract.slice(0, 1000),
        url: data.AbstractURL || undefined,
      });
    }

    // 相关主题（取前3条）
    const topics = data.RelatedTopics || [];
    for (const topic of topics.slice(0, 3)) {
      if (topic.Text) {
        results.push({
          title: topic.FirstURL ? topic.Text.split(' - ')[0] : query,
          snippet: topic.Text.slice(0, 500),
          url: topic.FirstURL || undefined,
        });
      }
    }
  } catch {
    // DuckDuckGo API 失败时静默跳过
  }

  // 2. 如果 DuckDuckGo 没有结果，尝试直接搜索
  if (results.length === 0) {
    try {
      const resp = await fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
        {
          signal: AbortSignal.timeout(8000),
          headers: { 'User-Agent': 'BoleSimulator/1.0' },
        }
      );
      const html = await resp.text();
      // 简单提取搜索结果摘要
      const snippetMatches = html.match(/class="result__snippet"[^>]*>([^<]+)</g);
      if (snippetMatches) {
        for (const m of snippetMatches.slice(0, 5)) {
          const text = m.replace(/<[^>]+>/g, '').trim();
          if (text.length > 10) {
            results.push({ title: query, snippet: text });
          }
        }
      }
    } catch {
      // HTML 搜索也失败，忽略
    }
  }

  return results.slice(0, 5);
}

/**
 * 专门搜索歌曲信息（优化查询格式）
 */
export async function searchSongInfo(
  title: string,
  artist?: string
): Promise<SearchResult[]> {
  const q = artist ? `${artist} ${title} 歌曲 背景 创作` : `${title} 歌曲`;
  return webSearch(q);
}

/**
 * 专门搜索歌手信息
 */
export async function searchArtistInfo(artist: string): Promise<SearchResult[]> {
  return webSearch(`${artist} 歌手 简介 音乐风格`);
}
