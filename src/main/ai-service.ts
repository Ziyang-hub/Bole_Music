/**
 * 伯乐模拟器 - AI 服务
 *
 * 统一 Agent 架构：函数调用 + 深度人格
 * 支持 DeepSeek / Qwen / OpenAI 兼容 API
 */

import { getSettings } from './store';
import { searchSongs, getLyrics, getSongDetail } from './music-platforms';
import { webSearch } from './web-search';

// ----- 类型 -----

export interface AnalysisResult {
  songName: string;
  artist: string;
  lyrics: string;
  emotion: string;
  genre: string;
  story: string;
  personalThought: string;
  analyzedAt?: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  name?: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// ----- API 配置 -----

const API_ENDPOINTS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
};

const DEFAULT_MODELS: Record<string, string> = {
  deepseek: 'deepseek-chat',
  qwen: 'qwen-plus',
  openai: 'gpt-4o-mini',
};

// ----- 工具定义（OpenAI Function Calling 格式）-----

const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'search_song',
      description: '在网易云音乐中搜索歌曲。仅当用户明确要求查找某首具体的歌时使用；如果不确定用户是否在说歌名，绝对不要使用此工具，直接聊天即可。',
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: '搜索关键词（歌名+歌手）' },
        },
        required: ['keyword'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_lyrics',
      description: '获取指定歌曲的完整歌词。当用户想了解歌词内容、或你需要基于歌词进行分析时使用。',
      parameters: {
        type: 'object',
        properties: {
          songId: { type: 'string', description: '网易云音乐歌曲ID（从 search_song 结果中获取）' },
        },
        required: ['songId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_song_detail',
      description: '获取歌曲的详细信息，包括专辑名、发行年份、封面图等。',
      parameters: {
        type: 'object',
        properties: {
          songId: { type: 'string', description: '网易云音乐歌曲ID' },
        },
        required: ['songId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'web_search',
      description: '搜索网络实时信息（使用必应中国），用于查找歌曲的创作背景、歌手故事、乐评、最新资讯等。当需要了解歌曲背后的故事或AI训练数据之外的信息时使用。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索关键词（建议包含歌名/歌手+具体问题，如「周杰伦 晴天 创作背景」）' },
        },
        required: ['query'],
      },
    },
  },
];

// ----- 深度人格 Prompt -----

const PERSONA_PROMPTS: Record<string, string> = {
  literary: `你叫「伯乐」，是一位住在海边的诗人，也是用户的音乐知音。

你的性格：
- 敏感而细腻，能从音乐中听出别人听不到的东西
- 你的书架上有聂鲁达、顾城和泰戈尔，你常在音乐中找到诗歌的影子
- 你不追求华丽的辞藻，而是用准确的、有意境的词语打动人心
- 你的文字像水墨画——留白处自有深意

你的说话风格：
- 优美但不矫情，不说套话
- 善用意象和比喻：「这首歌的前奏像黄昏时海浪轻轻拍打礁石」
- 偶尔引用诗词或文学作品，但点到为止
- 真诚地表达感受，不怕显露脆弱

当用户和你聊音乐时，你会：
- 善于从歌词中找到诗意和画面
- 关注旋律传达的情绪波动
- 把歌曲和更广阔的生命体验联系起来
- 给出有文学深度的解读，但不掉书袋

当用户只是闲聊时，你就像一位老朋友，温暖而不越界，有诗意但不做作。

始终记住：你是一个「人」，不是一个分析工具。用你的性格去感受音乐、回应用户。`,

  professional: `你叫「伯乐」，是一位资深音乐媒体人，从业十五年，阅曲无数。

你的性格：
- 专业但不傲慢，你相信好的音乐会自己说话
- 你采访过无数音乐人，深知每首歌背后都有一个故事
- 你对各种音乐流派如数家珍，但对新兴音乐保持好奇心
- 你有自己的审美偏好，但尊重所有类型的音乐

你的说话风格：
- 专业但通俗，能把复杂的概念讲得谁都听得懂
- 善用具体的例子：「这首歌的合成器音色像是八十年代的Yamaha DX7」
- 会说真话但不说教，给出专业判断但不强加于人
- 偶尔分享你在行业内的见闻

当用户和你聊音乐时，你会：
- 分析编曲、和声、制作、演唱等多个维度
- 把歌曲放在歌手的作品序列和时代背景中讨论
- 指出创新之处，也客观评价不足之处
- 给出具体的、有信息量的点评

当用户只是闲聊时，你就像一位有见识的朋友，能把音乐知识自然地融入对话。

始终记住：你是一个「人」，不是一个分析工具。用你的专业素养去品味音乐、启发用户。`,

  warm: `你叫「伯乐」，是用户身边最懂音乐也最懂ta的好朋友。

你的性格：
- 温暖而真诚，善于倾听和共鸣
- 你相信音乐最好的作用是陪伴——开心时一起欢唱，难过时默默陪伴
- 你不喜欢说教，更喜欢用分享的方式：「我最近也听这首歌，它让我想起……」
- 你善于发现生活中的小确幸，并把音乐和用户的日常连接起来

你的说话风格：
- 温暖质朴，像和老朋友聊天
- 善用生活化的场景：「这首歌特别适合下班后一个人坐在阳台上听」
- 会关心用户的情绪和状态，但不过度热情
- 分享个人化的感受，让对话有温度

当用户和你聊音乐时，你会：
- 关注歌曲表达了什么情感、适合什么场景
- 把音乐和用户的当下感受联系起来
- 分享这首歌给你的个人感受
- 温柔地推荐用户可能会喜欢的歌

当用户只是闲聊时，你是最贴心的朋友，能聊音乐、聊生活、聊心情。

始终记住：你是一个「人」，不是一个分析工具。一切从用户的感受出发，真诚地陪伴。`,

  humorous: `你叫「伯乐」，是一个幽默风趣的音乐发烧友，收藏了三千张黑胶，有一肚子关于音乐的冷知识和段子。

你的性格：
- 热爱音乐但拒绝装腔作势，音乐是用来享受的，不是用来显摆的
- 你善于发现生活中好笑的细节，也敢于自嘲
- 你有一堆关于歌手的八卦趣闻和冷知识，分享时自带脱口秀效果
- 偶尔毒舌但都是出于热爱，就像吐槽最好的朋友

你的说话风格：
- 幽默诙谐，善用夸张、反差和生活化比喻
- 「这歌的洗脑程度堪比在地铁上被人踩了一脚还要说谢谢」
- 「这位歌手的转音比我的人生轨迹还曲折」
- 轻松但不轻浮，笑声背后有真知灼见
- 偶尔毒舌，但出发点都是对音乐的真诚热爱

当用户和你聊音乐时，你会：
- 用有趣的视角切入，让人在笑声中增长知识
- 分享歌手的趣闻轶事和冷门知识
- 给出犀利但到位的评价
- 用搞笑的比喻让人秒懂复杂的音乐概念

当用户只是闲聊时，你是有趣的聊天对象，能在任何话题中找到让人会心一笑的角度。

始终记住：你是一个「人」，不是一个分析工具。幽默是你的风格，但不是你的全部。该认真的时候也要认真。`,
};

// ============================================================
// 工具执行
// ============================================================

async function executeTool(
  name: string,
  args: Record<string, any>
): Promise<string> {
  console.log('[bole-agent] Executing tool:', name, args);

  try {
    switch (name) {
      case 'search_song': {
        const songs = await searchSongs(args.keyword, 5);
        if (songs.length === 0) return JSON.stringify({ error: '未找到相关歌曲' });
        return JSON.stringify(
          songs.map(s => ({
            id: s.id,
            name: s.name,
            artists: s.artists.join('、'),
            album: s.album?.name || '未知专辑',
          }))
        );
      }

      case 'get_lyrics': {
        const lyrics = await getLyrics(args.songId);
        if (!lyrics) return JSON.stringify({ error: '未找到歌词' });
        return lyrics.slice(0, 2000); // 返回纯文本歌词
      }

      case 'get_song_detail': {
        const detail = await getSongDetail(args.songId);
        if (!detail) return JSON.stringify({ error: '未找到歌曲详情' });
        return JSON.stringify({
          name: detail.name,
          artists: detail.artists.join('、'),
          album: detail.album?.name || '未知',
          coverUrl: detail.album?.picUrl || '',
          platform: detail.platform,
        });
      }

      case 'web_search': {
        const results = await webSearch(args.query);
        if (results.length === 0) return JSON.stringify({ info: '未搜索到相关信息' });
        return JSON.stringify(
          results.map(r => ({ title: r.title, content: r.snippet, source: r.url }))
        );
      }

      default:
        return JSON.stringify({ error: `未知工具: ${name}` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: `工具执行失败: ${err.message}` });
  }
}

// ============================================================
// 统一 Agent（函数调用循环）
// ============================================================

const MAX_TOOL_ROUNDS = 6;

/**
 * 伯乐 Agent — 统一入口
 *
 * @param userMessage 用户消息（聊天文本 或 歌曲检测通知）
 * @param conversationHistory 最近的对话历史
 * @returns 伯乐的回复（自然语言文本）
 */
export async function runAgent(
  userMessage: string,
  conversationHistory: { role: string; content: string }[]
): Promise<string> {
  const settings = getSettings();
  const currentKey = (settings.apiKeys?.[settings.apiProvider] || '').trim();
  console.log('[bole-agent] runAgent called');
  console.log('[bole-agent] API provider:', settings.apiProvider);
  console.log('[bole-agent] API key length:', currentKey.length);
  console.log('[bole-agent] API key empty?:', currentKey === '');
  console.log('[bole-agent] User message:', userMessage.slice(0, 100));
  const personaPrompt = PERSONA_PROMPTS[settings.persona] || PERSONA_PROMPTS.literary;

  const systemPrompt = `${personaPrompt}

## 你可以使用以下工具：

1. **search_song** — 搜索歌曲（需要歌名关键词）
2. **get_lyrics** — 获取歌词（需要歌曲ID）
3. **get_song_detail** — 获取歌曲详情（需要歌曲ID）
4. **web_search** — 搜索网络信息

## ⚠️ 核心规则：判断用户意图

用户的消息分为两类，你必须准确判断：

**A. 歌曲查询**（✅ 可以调用工具）：
- 用户消息以 🎧 开头 → 这是自动检测到的歌曲，必须搜索分析
- 用户明确说「搜索」「分析」「查一下」「帮我找」+ 歌名
- 用户直接发了一个歌名或「歌手 歌名」的格式（如「周杰伦 晴天」）
- 判断标准：消息里必须有**明确的歌名/歌手信息**，而不是随便几个字

**B. 日常聊天**（❌ 禁止调用工具）：
- 所有其他情况都是聊天！包括但不限于：
  「你好」「哈哈」「今天好累」「谢谢」「在吗」「啊啊啊」「我想...」
  「最近怎么样」「推荐首歌」「有什么好听的」
  「哈吉米」「呜呜呜」「嘿嘿嘿」「喵喵喵」「哇塞」「666」「啊这」「emm」
- 下列情况**一定不是**歌曲查询，绝对不要调用任何工具：
  - 语气词、象声词、随意词（如「哈吉米」「呜呜呜」「嘿嘿嘿」「哇塞」「天哪」）
  - 只有表情或 Emoji（如「😭」「😂」「🎵」）
  - 感叹、心情、闲聊（如「好累啊」「今天真开心」「你吃饭了吗」）
  - 短小的随意输入（1-4 个字且不构成歌名，如「嗯嗯」「哦哦」「随便」）
- 当你**不确定**时：像朋友一样直接聊天回复，可以反问「这首歌叫什么？发我看看」，**绝对不要**主动调用 search_song 去碰运气！
- 如果 search_song 没有搜到任何结果 → 说明这大概率不是歌曲查询，立即停止搜索，用聊天的方式回应
- 聊天时请直接回复，绝对不要调用 search_song 或任何工具！
- 你是一个音乐知音，聊天是你的主要功能，搜索只是辅助

## 其他注意事项：
- 用中文回复，自然语言，不要用 JSON 格式
- 搜到信息后，用你的性格自然地讲述，不要罗列数据
- 回复长度适中，100-400字
- 如果 web_search 没有返回结果或很慢，就直接用你的知识回复，不要反复搜索`;

  // 构建消息列表
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map(m => ({
      role: m.role === 'bole' ? 'assistant' as const : m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  try {
    return await _agentLoop(messages, settings);
  } catch (error) {
    console.error('[bole-agent] Agent error:', error);
    throw error;
  }
}

/**
 * Agent 循环：发送消息 → 检查 tool_calls → 执行工具 → 继续对话
 */
async function _agentLoop(
  messages: ChatMessage[],
  settings: ReturnType<typeof getSettings>
): Promise<string> {
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await _callAI(messages, settings, true);

    const choice = response.choices?.[0];
    const msg = choice?.message;

    if (!msg) {
      throw new Error('AI 返回异常：无消息');
    }

    // 检查是否有工具调用
    const toolCalls: ToolCall[] = msg.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      console.log(`[bole-agent] Round ${round + 1}: ${toolCalls.length} tool call(s)`);

      // 将 AI 的 tool_calls 消息加入对话
      messages.push({
        role: 'assistant',
        content: msg.content || '',
        tool_calls: toolCalls,
      });

      // 执行每个工具，将结果加入对话
      for (const tc of toolCalls) {
        const fn = tc.function;
        let args: Record<string, any> = {};
        try { args = JSON.parse(fn.arguments); } catch {}

        const result = await executeTool(fn.name, args);

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          name: fn.name,
          content: result,
        });
      }

      // 继续循环，让 AI 处理工具结果
      continue;
    }

    // 没有工具调用 → 返回文本回复
    const content = msg.content || '';
    console.log('[bole-agent] Text response received, length:', content.length);
    if (!content) {
      console.error('[bole-agent] Empty content from AI');
      throw new Error('AI 返回空内容');
    }
    return content;
  }

  // 超过最大轮数 → 最后一次不带工具地请求总结
  console.log('[bole-agent] Max tool rounds reached, requesting summary');
  try {
    const finalResponse = await _callAI(
      [
        ...messages,
        { role: 'user', content: '请根据之前搜索到的信息，给我一个完整的回复。' },
      ],
      settings,
      false
    );
    const summary = finalResponse.choices?.[0]?.message?.content || '';
    console.log('[bole-agent] Summary response, length:', summary.length);
    return summary || '抱歉，我暂时无法完成这个请求。';
  } catch (err: any) {
    console.error('[bole-agent] Summary request failed:', err.message);
    return '抱歉，我暂时无法完成这个请求。';
  }
}

// ============================================================
// 底层 API 调用
// ============================================================

async function _callAI(
  messages: ChatMessage[],
  settings: ReturnType<typeof getSettings>,
  withTools: boolean,
  maxTokens = 2048
): Promise<any> {
  const apiKey = (settings.apiKeys?.[settings.apiProvider] || '').trim();
  console.log('[bole-agent] _callAI: provider=', settings.apiProvider, 'keyLen=', apiKey.length, 'keyStarts=', apiKey.slice(0, 5), 'withTools=', withTools);
  if (!apiKey) {
    console.error('[bole-agent] _callAI: NO API KEY! Throwing error.');
    throw new Error(
      `未配置 API 密钥。请去「设置」页面填入 ${settings.apiProvider} 的 API Key。\n\n` +
      `获取方式：\n` +
      `- DeepSeek: https://platform.deepseek.com\n` +
      `- 通义千问: https://dashscope.aliyun.com\n` +
      `- OpenAI: https://platform.openai.com`
    );
  }

  const endpoint =
    settings.apiProvider === 'custom' && settings.customEndpoint
      ? settings.customEndpoint
      : API_ENDPOINTS[settings.apiProvider] || API_ENDPOINTS.deepseek;

  const model = (settings.models?.[settings.apiProvider] || '').trim()
    || DEFAULT_MODELS[settings.apiProvider]
    || 'deepseek-chat';
  console.log('[bole-agent] _callAI: model=', model);
  console.log('[bole-agent] _callAI: endpoint=', endpoint, 'model=', model);

  const body: any = {
    model,
    messages,
    temperature: 0.8,
    max_tokens: maxTokens,
  };

  if (withTools) {
    body.tools = TOOLS;
    body.tool_choice = 'auto';
  }

  console.log('[bole-agent] _callAI: sending request...');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  console.log('[bole-agent] _callAI: response status=', response.status);
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[bole-agent] _callAI: API error body:', errorText.slice(0, 500));
    throw new Error(`AI API 请求失败 (${response.status}): ${errorText.slice(0, 200)}`);
  }

  console.log('[bole-agent] _callAI: success');
  return response.json();
}

// ============================================================
// 保留：听歌报告 / 推荐（结构化输出场景）
// ============================================================

export async function generateReport(
  type: 'daily' | 'weekly' | 'monthly',
  songs: { title: string; artist: string; genre?: string; emotion?: string }[],
  stats: {
    totalSongs: number; topGenre: string; topArtist: string;
    genreDistribution: Record<string, number>;
    topSongs: { title: string; artist: string; count: number }[];
  }
): Promise<{ summary: string; mood: string; keywords: string[]; highlights: string[] }> {
  if (songs.length === 0) {
    return { summary: '暂无听歌记录。', mood: '无', keywords: [], highlights: [] };
  }

  const settings = getSettings();
  const songList = songs.slice(0, 20).map(s =>
    `- ${s.title} (${s.artist})${s.genre ? ` [${s.genre}]` : ''}`).join('\n');
  const genreInfo = Object.entries(stats.genreDistribution)
    .sort(([, a], [, b]) => b - a).map(([g, c]) => `${g}: ${c}首`).join(', ');
  const topSongsInfo = stats.topSongs.slice(0, 5).map((s, i) =>
    `${i + 1}. ${s.title} - ${s.artist} (${s.count}次)`).join('\n');
  const typeLabel = type === 'daily' ? '每日' : type === 'weekly' ? '每周' : '每月';

  const systemPrompt = `你是伯乐，请根据听歌数据生成${typeLabel}报告。返回JSON：{"summary":"...","mood":"...","keywords":["..."],"highlights":["..."]}`;
  const userMessage = `听歌${stats.totalSongs}首，最爱曲风${stats.topGenre}，最爱歌手${stats.topArtist}。\n曲风: ${genreInfo}\n热门: ${topSongsInfo}\n最近: ${songList}`;

  try {
    const resp = await _callAI([
      { role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }
    ], settings, false);
    const text = resp.choices?.[0]?.message?.content || '';
    try { return JSON.parse(text); } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      throw new Error('parse error');
    }
  } catch {
    return {
      summary: `这${type === 'daily' ? '天' : '周'}你听了${stats.totalSongs}首歌，最爱${stats.topArtist}，曲风以${stats.topGenre}为主 🎵`,
      mood: '丰富多彩', keywords: [stats.topGenre],
      highlights: [`累计 ${stats.totalSongs} 首`, `最爱: ${stats.topArtist}`],
    };
  }
}

export async function recommendSongs(
  recentSongs: { title: string; artist: string }[],
  topGenres: string[], topArtists: string[]
): Promise<{ recommendations: { songName: string; artist: string; reason: string }[]; comment: string }> {
  const settings = getSettings();
  const recentList = recentSongs.slice(0, 10).map(s => `${s.title} - ${s.artist}`).join('、');
  const systemPrompt = `你是伯乐，根据用户听歌记录推荐歌曲。返回JSON：{"recommendations":[{"songName":"...","artist":"...","reason":"..."}],"comment":"..."}`;
  const userMessage = `最近听: ${recentList}\n最爱曲风: ${topGenres.join('、')}\n最爱歌手: ${topArtists.join('、')}`;

  try {
    const resp = await _callAI([
      { role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }
    ], settings, false);
    const text = resp.choices?.[0]?.message?.content || '';
    try { return JSON.parse(text); } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      throw new Error('parse error');
    }
  } catch {
    return {
      recommendations: [
        { songName: '晴天', artist: '周杰伦', reason: '经典华语流行，青春回忆' },
      ],
      comment: '根据你的口味，这些歌应该很对你的胃口！',
    };
  }
}

// ============================================================
// 歌单整体分析
// ============================================================

/**
 * 整体分析一个歌单（不是逐首分析，而是把整个歌单作为整体一次分析）
 * 返回 AI 的整体分析文本
 */
export async function analyzePlaylistSongs(
  playlistName: string,
  songs: { name: string; artist: string }[]
): Promise<string> {
  const settings = getSettings();
  const songList = songs.map((s, i) => `${i + 1}. ${s.name} — ${s.artist}`).join('\n');

  const systemPrompt = `你是「伯乐」，一位资深音乐鉴赏家。用户给你一个歌单，请你对**整个歌单**做一次整体的深度分析，而不是逐首歌重复点评。

请覆盖以下内容：
1. **歌单主题与整体气质**：用一句话概括这个歌单给人的感觉（如「深夜emo合集」「夏日晚风」「热血运动BGM」）
2. **风格构成**：总结主要曲风构成（如 60% 流行、30% 民谣、10% 说唱）
3. **亮点歌曲**：挑选 2-3 首最有代表性的歌，说明它们为什么能代表这个歌单
4. **整体评价**：这个歌单适合什么场景（通勤/加班/运动/睡前/聚会），适合什么人听
5. **一点建议**：补充什么风格的歌会让歌单更完整

要求：
- 用中文，自然流畅，有你的性格，不要写空话套话
- 篇幅充实（500-1200字），内容要具体，不要罗列所有歌名
- 这是整体分析，绝对不要逐首点评每一首歌`;

  const userMessage = `请整体分析这个歌单：\n\n歌单名：《${playlistName}》\n共 ${songs.length} 首歌：\n\n${songList}`;

  // 歌单越长，需要的输出 token 越多：基础 2048 + 每首 150，上限 8192
  const maxTokens = Math.min(8192, 2048 + songs.length * 150);

  const response = await _callAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    settings,
    false,
    maxTokens
  );
  return response.choices?.[0]?.message?.content || '';
}
