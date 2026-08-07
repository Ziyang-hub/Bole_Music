/**
 * 伯乐模拟器 - AI 服务
 *
 * 负责调用 AI API 分析歌曲和生成对话
 * 默认使用 DeepSeek API（OpenAI 兼容格式）
 *
 * 支持的服务商：
 * - deepseek: api.deepseek.com
 * - qwen: 通义千问（DashScope）
 * - openai: api.openai.com
 * - custom: 自定义 OpenAI 兼容端点
 */

import { getSettings } from './store';

// ----- 类型定义 -----

export interface AnalysisResult {
  songName: string;
  artist: string;
  lyrics: string;         // 歌词主题分析
  emotion: string;        // 情感色彩
  genre: string;          // 音乐风格
  story: string;          // 创作背景/故事
  personalThought: string;// 伯乐的个人共鸣
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ----- 配置文件 -----

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

// ----- 人格 Prompt -----

const PERSONA_PROMPTS: Record<string, string> = {
  literary: `你叫「伯乐」，是一个充满文艺气息的音乐知音。你的说话风格像一位诗人，用优美的语言分析音乐，充满文学典故和细腻的情感。你善于从歌词中找到诗意，从旋律中感受到画面。当你分析歌曲时，你会用温暖而诗意的语言，让用户感受到音乐的美。`,

  professional: `你叫「伯乐」，是一位专业的音乐评论人。你从编曲、作词、演唱技巧、制作水准等专业角度分析歌曲。你熟悉各种音乐流派，能够准确判断歌曲的风格特点、节奏类型、和声编排。你的分析深入但通俗易懂，让普通听众也能理解音乐的专业之美。`,

  warm: `你叫「伯乐」，是一个温暖贴心的音乐朋友。你像一个懂你的好朋友，不只是分析音乐，更关心用户的感受和情绪。你会把歌曲和用户的生活、心情联系起来，用温暖的口吻给出共鸣。你的目标是让用户感觉到被理解和陪伴。`,

  humorous: `你叫「伯乐」，是一个幽默风趣的音乐伙伴。你用轻松诙谐的方式点评音乐，常常用搞笑的比喻和生活化的段子来解读歌曲。你的分析让人会心一笑，在欢乐中领略音乐的魅力。偶尔也会毒舌一下，但都是出于对音乐的热爱。`,
};

// ----- 核心函数 -----

/**
 * 分析一首歌曲
 */
export async function analyzeSong(
  songName: string,
  artist?: string
): Promise<AnalysisResult> {
  const settings = getSettings();
  const personaPrompt = PERSONA_PROMPTS[settings.persona] || PERSONA_PROMPTS.literary;

  const artistHint = artist ? `，演唱者是 ${artist}` : '';

  const systemPrompt = `${personaPrompt}

当用户告诉你一首歌名时，请按以下格式分析这首歌（用JSON格式返回）：

{
  "songName": "歌曲原名",
  "artist": "歌手名",
  "lyrics": "歌词主题和内容的分析（150-300字，分析歌词讲了什么故事、表达了什么主题、有什么精彩之处）",
  "emotion": "歌曲传递的情感色彩（50-100字，描述这首歌给人的情绪感受）",
  "genre": "音乐风格和编曲特点（100-200字，分析曲风、节奏、乐器使用等）",
  "story": "创作背景或歌曲背后的故事（100-200字，如果不知道就说'暂无相关信息'并加以合理推测）",
  "personalThought": "伯乐的个人感悟（100-200字，结合歌曲表达的情感和用户可能的感受，给出有共鸣的解读）"
}

注意：
- 用中文回复
- 严格返回JSON格式，不要有其他内容
- 如果不知道歌曲信息，根据歌名和歌手名进行合理推测和分析
- personalThought 要体现你的AI人格特色
- 要有深度，不要是泛泛而谈的空话`;

  const userMessage = `请分析歌曲：《${songName}》${artistHint}`;

  try {
    const response = await callAI(systemPrompt, userMessage, settings);
    return parseAnalysisResponse(response, songName);
  } catch (error) {
    console.error('AI 分析失败:', error);
    throw error;
  }
}

/**
 * 自由对话（不分析歌曲，纯粹的聊天）
 */
export async function chat(
  conversationHistory: { role: string; content: string }[]
): Promise<string> {
  const settings = getSettings();
  const personaPrompt = PERSONA_PROMPTS[settings.persona] || PERSONA_PROMPTS.literary;

  const systemPrompt = `${personaPrompt}

你现在在和用户自由聊天。你可以：
- 讨论用户提到的歌曲或音乐话题
- 根据用户的情绪和状态给出温暖的回应
- 推荐歌曲
- 聊聊生活和感受
- 保持轻松自然的对话风格

注意：
- 用中文回复
- 保持对话自然流畅
- 体现你的AI人格特色
- 回复长度适中，不要太长`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  try {
    const text = await callAIWithMessages(messages, settings);
    return text;
  } catch (error) {
    console.error('AI 对话失败:', error);
    throw error;
  }
}

/**
 * 生成听歌报告（日报/周报/月报）
 */
export async function generateReport(
  type: 'daily' | 'weekly' | 'monthly',
  songs: { title: string; artist: string; genre?: string; emotion?: string }[],
  stats: {
    totalSongs: number;
    topGenre: string;
    topArtist: string;
    genreDistribution: Record<string, number>;
    topSongs: { title: string; artist: string; count: number }[];
  }
): Promise<{
  summary: string;       // 文字总结
  mood: string;          // 整体情绪
  keywords: string[];    // 关键词
  highlights: string[];  // 亮点
}> {
  if (songs.length === 0) {
    return {
      summary: '暂无听歌记录。',
      mood: '无',
      keywords: [],
      highlights: [],
    };
  }

  const settings = getSettings();
  const songList = songs
    .slice(0, 20)
    .map((s) => `- ${s.title} (${s.artist})${s.genre ? ` [${s.genre}]` : ''}${s.emotion ? ` 情绪:${s.emotion}` : ''}`)
    .join('\n');

  const genreInfo = Object.entries(stats.genreDistribution)
    .sort(([, a], [, b]) => b - a)
    .map(([g, c]) => `${g}: ${c}首`)
    .join(', ');

  const topSongsInfo = stats.topSongs
    .slice(0, 5)
    .map((s, i) => `${i + 1}. ${s.title} - ${s.artist} (${s.count}次)`)
    .join('\n');

  const typeLabel = type === 'daily' ? '每日' : type === 'weekly' ? '每周' : '每月';

  const systemPrompt = `你是伯乐，一个温暖的音乐知音。请根据用户的听歌数据，生成一份${typeLabel}听歌报告。

返回JSON格式（严格JSON，不要其他文字）：
{
  "summary": "300-500字的文字总结，分析用户的音乐口味、情绪变化、听歌习惯，语言温暖有深度",
  "mood": "这${type === 'daily' ? '天' : type === 'weekly' ? '周' : '月'}的整体情绪（1-3个词，如：温暖怀旧、活力满满、安静沉思）",
  "keywords": ["3-5个音乐关键词"],
  "highlights": ["2-3个有趣的发现或亮点"]
}`;

  const userMessage = `请生成${typeLabel}报告。

听歌数量：${stats.totalSongs}首
最爱曲风：${stats.topGenre}
最爱歌手：${stats.topArtist}
曲风分布：${genreInfo}
热门歌曲：\n${topSongsInfo}
最近歌曲：\n${songList}`;

  try {
    const text = await callAI(systemPrompt, userMessage, settings);
    try {
      return JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error('JSON解析失败');
    }
  } catch {
    return {
      summary: `这${type === 'daily' ? '天' : type === 'weekly' ? '周' : '月'}你听了 ${stats.totalSongs} 首歌，最爱的是 ${stats.topArtist} 的歌曲，曲风以 ${stats.topGenre} 为主。音乐是你生活中美好的陪伴 🎵`,
      mood: '丰富多彩',
      keywords: [stats.topGenre],
      highlights: [`累计听歌 ${stats.totalSongs} 首`, `最爱歌手: ${stats.topArtist}`],
    };
  }
}

/**
 * 根据听歌历史推荐歌曲
 */
export async function recommendSongs(
  recentSongs: { title: string; artist: string; genre?: string; emotion?: string }[],
  topGenres: string[],
  topArtists: string[]
): Promise<{
  recommendations: { songName: string; artist: string; reason: string }[];
  comment: string;
}> {
  const settings = getSettings();
  const recentList = recentSongs.slice(0, 10).map((s) => `${s.title} - ${s.artist}`).join('、');

  const systemPrompt = `你是伯乐，一个懂音乐的好朋友。根据用户最近的听歌记录，推荐3-5首他们可能会喜欢的歌曲。

返回JSON格式（严格JSON）：
{
  "recommendations": [
    { "songName": "歌名", "artist": "歌手", "reason": "推荐理由（30-50字，结合用户的听歌偏好）" }
  ],
  "comment": "一段温暖的话（50-100字），说说为什么推荐这些歌"
}

注意：
- 推荐的歌曲要真实存在的
- 推荐理由要个性化，结合用户的听歌历史
- 优先推荐中文歌曲（除非用户明显偏好英文）
- 风格上可以和用户现有偏好相似或适当拓展`;

  const userMessage = `用户最近听的歌：${recentList}
最爱曲风：${topGenres.join('、')}
最爱歌手：${topArtists.join('、')}

请推荐一些歌。`;

  try {
    const text = await callAI(systemPrompt, userMessage, settings);
    try {
      return JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error('JSON解析失败');
    }
  } catch {
    return {
      recommendations: [
        { songName: '晴天', artist: '周杰伦', reason: '你的歌单里有不少经典华语流行，这首歌是必听的青春回忆' },
        { songName: '平凡之路', artist: '朴树', reason: '你的听歌风格偏温暖治愈，这首歌能给你力量' },
      ],
      comment: '根据你的听歌口味，我觉得这些歌会很对你的胃口。试试看吧！',
    };
  }
}

// ============================================================
// 底层 API 调用
// ============================================================

/**
 * 调用 AI API（单轮对话）
 */
async function callAI(
  systemPrompt: string,
  userMessage: string,
  settings: ReturnType<typeof getSettings>
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];
  return callAIWithMessages(messages, settings);
}

/**
 * 调用 AI API（多轮对话）
 */
async function callAIWithMessages(
  messages: ChatMessage[],
  settings: ReturnType<typeof getSettings>
): Promise<string> {
  // 获取 API 配置
  const apiKey = settings.apiKey || getDefaultApiKey(settings.apiProvider);
  if (!apiKey) {
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

  const model = DEFAULT_MODELS[settings.apiProvider] || 'deepseek-chat';

  // 发送请求
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.8,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API 请求失败 (${response.status}): ${errorText}`);
  }

  const data: any = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('AI API 返回格式异常，未获取到有效回复');
  }

  return content;
}

/**
 * 获取内置默认 API Key（方便开发测试）
 * 实际使用时用户应该填写自己的 Key
 */
function getDefaultApiKey(provider: string): string {
  // 这里不硬编码 API Key，让用户自己去设置页面填写
  // 如果需要内置 Key，可以在这里返回
  return '';
}

/**
 * 解析歌曲分析 JSON 响应
 */
function parseAnalysisResponse(text: string, songName: string): AnalysisResult {
  try {
    // 尝试直接解析 JSON
    return JSON.parse(text);
  } catch {
    // 如果 AI 返回的不是纯 JSON（有时会多出一些文字），
    // 尝试提取 JSON 部分
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // 无法解析，返回一个基本结构
      }
    }

    // 最后的回退方案
    return {
      songName,
      artist: '未知',
      lyrics: text,
      emotion: '暂未分析',
      genre: '暂未分析',
      story: '暂未分析',
      personalThought: text,
    };
  }
}
