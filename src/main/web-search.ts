/**
 * 伯乐模拟器 - 网络搜索服务
 *
 * 多引擎切换：必应 → 百度 → 搜狗
 * 一个挂了自动切下一个，国内均可访问
 */

export interface SearchResult {
  title: string;
  snippet: string;
  url?: string;
}

type SearchFn = (query: string) => Promise<SearchResult[]>;

/**
 * 搜索网络信息（多引擎自动切换）
 */
export async function webSearch(query: string): Promise<SearchResult[]> {
  const engines: [string, SearchFn][] = [
    ['bing', searchBing],
    ['baidu', searchBaidu],
    ['sogou', searchSogou],
  ];

  for (const [name, fn] of engines) {
    try {
      console.log('[web-search] Trying', name, '...');
      const results = await fn(query);
      if (results.length > 0) {
        console.log('[web-search]', name, 'found', results.length, 'results');
        return results.slice(0, 5);
      }
      console.log('[web-search]', name, 'returned 0 results, trying next...');
    } catch (err: any) {
      console.log('[web-search]', name, 'failed:', err.message, ', trying next...');
    }
  }

  console.log('[web-search] All engines failed');
  return [];
}

// ============================================================
// 必应中国
// ============================================================

async function searchBing(query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const url = `https://cn.bing.com/search?q=${encodeURIComponent(query)}&setlang=zh-cn`;

  const resp = await fetch(url, {
    signal: AbortSignal.timeout(6000),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    },
  });
  if (!resp.ok) return results;

  const html = await resp.text();
  const snippetRe = /<div class="b_caption"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi;
  const titleRe = /<h2[^>]*><a[^>]*>([\s\S]*?)<\/a><\/h2>/gi;

  const snippets: string[] = [], titles: string[] = [];
  let m;
  while ((m = snippetRe.exec(html)) !== null && snippets.length < 5) {
    const t = m[1].replace(/<[^>]+>/g, '').trim();
    if (t.length > 10) snippets.push(t);
  }
  while ((m = titleRe.exec(html)) !== null && titles.length < 5) {
    const t = m[1].replace(/<[^>]+>/g, '').trim();
    if (t.length > 2) titles.push(t);
  }

  for (let i = 0; i < snippets.length; i++) {
    results.push({ title: titles[i] || query, snippet: snippets[i].slice(0, 600) });
  }
  return results;
}

// ============================================================
// 百度
// ============================================================

async function searchBaidu(query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const url = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}&ie=utf-8`;

  const resp = await fetch(url, {
    signal: AbortSignal.timeout(6000),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    },
  });
  if (!resp.ok) return results;

  const html = await resp.text();

  // 百度结果：<div class="c-abstract">摘要</div> 或 <span class="content-right_...">摘要</span>
  const absRe = /class="c-abstract"[^>]*>([\s\S]*?)<\/div>/gi;
  const title2Re = /<h3[^>]*class="[^"]*t[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/gi;

  const snippets: string[] = [], titles: string[] = [];
  let m;
  while ((m = absRe.exec(html)) !== null && snippets.length < 5) {
    const t = m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (t.length > 10) snippets.push(t);
  }
  while ((m = title2Re.exec(html)) !== null && titles.length < 5) {
    const t = m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (t.length > 2) titles.push(t);
  }

  for (let i = 0; i < snippets.length; i++) {
    results.push({ title: titles[i] || query, snippet: snippets[i].slice(0, 600) });
  }
  return results;
}

// ============================================================
// 搜狗
// ============================================================

async function searchSogou(query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const url = `https://www.sogou.com/web?query=${encodeURIComponent(query)}`;

  const resp = await fetch(url, {
    signal: AbortSignal.timeout(6000),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    },
  });
  if (!resp.ok) return results;

  const html = await resp.text();

  // 搜狗结果：<div class="str-text"> 或 <p class="str_info">
  const absRe = /class="str-text[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  const title3Re = /<h3[^>]*class="[^"]*vr[^"]*title[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/gi;

  const snippets: string[] = [], titles: string[] = [];
  let m;
  while ((m = absRe.exec(html)) !== null && snippets.length < 5) {
    const t = m[1].replace(/<[^>]+>/g, '').trim();
    if (t.length > 10) snippets.push(t);
  }
  while ((m = title3Re.exec(html)) !== null && titles.length < 5) {
    const t = m[1].replace(/<[^>]+>/g, '').trim();
    if (t.length > 2) titles.push(t);
  }

  for (let i = 0; i < snippets.length; i++) {
    results.push({ title: titles[i] || query, snippet: snippets[i].slice(0, 600) });
  }
  return results;
}

export async function searchSongInfo(title: string, artist?: string): Promise<SearchResult[]> {
  const q = artist ? `${artist} ${title} 歌曲 背景 创作` : `${title} 歌曲`;
  return webSearch(q);
}

export async function searchArtistInfo(artist: string): Promise<SearchResult[]> {
  return webSearch(`${artist} 歌手 简介 音乐风格`);
}
