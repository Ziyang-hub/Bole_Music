/**
 * 伯乐模拟器 - 主应用组件
 *
 * 知音对话 + 页面切换 + 真实 AI + 数据持久化
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReportPage from './components/ReportPage';
import DiaryPage from './components/DiaryPage';
import SettingsPage from './components/SettingsPage';
import SearchSongs from './components/SearchSongs';
import PlaylistImport from './components/PlaylistImport';
import HummingRecorder from './components/HummingRecorder';

// ----- 类型 -----

type View = 'chat' | 'report' | 'diary' | 'settings';

const NAV_ITEMS: { view: View; icon: string; label: string }[] = [
  { view: 'chat', icon: '💬', label: '知音对话' },
  { view: 'report', icon: '📊', label: '听歌报告' },
  { view: 'diary', icon: '📝', label: '听歌日记' },
  { view: 'settings', icon: '⚙️', label: '设置' },
];

const VIEW_TITLES: Record<View, string> = {
  chat: '知音对话',
  report: '听歌报告',
  diary: '听歌日记',
  settings: '设置',
};

// ----- 工具 -----

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function nowISO(): string {
  return new Date().toISOString();
}

// ============================================================
// 主组件
// ============================================================

export default function App() {
  const [currentView, setCurrentView] = useState<View>('chat');

  // 对话
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 搜索面板
  const [showSearch, setShowSearch] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showHumming, setShowHumming] = useState(false);

  // 主题
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // 应用信息
  const [appInfo, setAppInfo] = useState<any>(null);

  // ----- 初始化：加载数据 -----

  useEffect(() => {
    async function init() {
      if (!window.electronAPI) return;

      try {
        // 加载主题
        const t = await window.electronAPI.getTheme();
        setTheme(t as 'dark' | 'light');

        // 监听托盘导航
        window.electronAPI.onNavigate((view: string) => {
          setCurrentView(view as View);
        });

        // 加载应用信息
        const info = await window.electronAPI.getAppInfo();
        setAppInfo(info);

        // 加载聊天记录
        const saved = await window.electronAPI.getMessages();
        if (saved && saved.length > 0) {
          setMessages(saved);
        } else {
          // 首次使用，显示欢迎消息
          const welcome: ChatMessage = {
            id: 'welcome',
            role: 'bole',
            content:
              '你好，我是伯乐 🎵\n\n我是你的AI音乐知音。当你听到一首好歌，输入歌名告诉我，我来帮你分析和品味。\n\n比如你可以试试输入：「周杰伦 晴天」 或者 「Coldplay Yellow」\n\n💡 提示：在使用之前，请先去「设置」页面配置 AI 服务的 API Key。',
            timestamp: nowISO(),
          };
          setMessages([welcome]);
          await window.electronAPI.addMessage(welcome);
        }
      } catch (err) {
        // Electron API 不可用时（浏览器开发模式）使用模拟数据
        console.warn('Electron API 不可用，使用离线模式:', err);
        setMessages([
          {
            id: 'welcome',
            role: 'bole',
            content: '你好，我是伯乐 🎵\n\n离线模式：请在 Electron 环境中运行以连接 AI 服务。',
            timestamp: nowISO(),
          },
        ]);
      }

      setMessagesLoaded(true);
    }

    init();
  }, []);

  // 订阅音频检测事件（自动采集识别到歌曲时）
  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.onSongDetected(async (result) => {
      if (result.title && result.confidence > 50) {
        // 自动分析检测到的歌曲
        try {
          const analysis = await window.electronAPI!.analyzeSong(
            result.title,
            result.artist
          );
          if (analysis.success && analysis.data) {
            const boleContent = formatAnalysis(analysis.data);
            const userMsg: ChatMessage = {
              id: generateId(),
              role: 'user',
              content: `🎧 检测到：${result.title} - ${result.artist}`,
              timestamp: nowISO(),
            };
            const boleMsg: ChatMessage = {
              id: generateId(),
              role: 'bole',
              content: boleContent,
              timestamp: nowISO(),
            };
            setMessages((prev) => [...prev, userMsg, boleMsg]);
            await window.electronAPI!.addMessage(userMsg);
            await window.electronAPI!.addMessage(boleMsg);
          }
        } catch {
          // 自动分析失败，静默处理
        }
      }
    });
  }, []);

  // 自动滚动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ----- 发送消息 -----

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    setInputValue('');

    // 添加用户消息
    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: nowISO(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // 保存到存储
    if (window.electronAPI) {
      try {
        await window.electronAPI.addMessage(userMsg);
      } catch (err) {
        console.error('保存消息失败:', err);
      }
    }

    setIsLoading(true);

    try {
      if (window.electronAPI) {
        // ---- 真实 AI 模式 ----

        // 检测是否是歌单链接
        const isPUrl = await window.electronAPI.isPlaylistUrl(text);
        if (isPUrl) {
          setShowPlaylist(true);
          setIsLoading(false);
          return;
        }

        // 检测是否是歌曲链接
        const isUrl = await window.electronAPI.isSongUrl(text);

        if (isUrl) {
          // ---- 链接解析模式 ----
          const parsed = await window.electronAPI.parseSongUrl(text);
          if (parsed.success && parsed.data) {
            const { song, lyrics } = parsed.data;
            if (song) {
              const songTitle = `${song.name} - ${song.artists.join('、')}`;

              // 用真实信息分析
              const result = await window.electronAPI.analyzeSong(
                song.name,
                song.artists.join('、'),
                lyrics || undefined
              );

              if (result.success && result.data) {
                const boleContent = formatAnalysis(result.data);
                const boleMsg: ChatMessage = {
                  id: generateId(), role: 'bole', content: boleContent, timestamp: nowISO(),
                };
                setMessages((prev) => [...prev, boleMsg]);
                await window.electronAPI.addMessage(boleMsg);

                // 日记
                const today = new Date().toISOString().split('T')[0];
                await window.electronAPI.addDiaryEntry({
                  date: today,
                  songs: [{ title: song.name, artist: song.artists.join('、'), time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }), note: result.data.personalThought?.slice(0, 100) || '' }],
                  mood: result.data.emotion || '未知',
                  summary: '',
                });
                return;
              }
            }
          }
          // 链接解析失败，回退到普通处理
        }

        // 判断用户意图
        const isRecommendQuery =
          text.includes('推荐') || text.includes('推荐歌曲') ||
          text.includes('推荐一首') || text.includes('有什么好听的');

        const isSongQuery =
          text.length < 100 && !text.includes('?') && !text.includes('？') && !isRecommendQuery;

        if (isRecommendQuery) {
          // ---- 推荐模式 ----
          const stats = await window.electronAPI.getStats();
          const topGenres = Object.entries(stats.genreDistribution)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([g]) => g);
          const topArtists = Object.entries(stats.artistCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([a]) => a);

          const recentSongs = diaryEntriesFromMessages(messages);

          const result = await window.electronAPI.recommendSongs(
            recentSongs,
            topGenres,
            topArtists
          );

          if (result.success && result.data) {
            const text = formatRecommendations(result.data);
            const boleMsg: ChatMessage = {
              id: generateId(), role: 'bole', content: text, timestamp: nowISO(),
            };
            setMessages((prev) => [...prev, boleMsg]);
            await window.electronAPI.addMessage(boleMsg);
          } else {
            throw new Error(result.error || '推荐失败');
          }
        } else if (isSongQuery) {
          // 尝试歌曲分析
          const result = await window.electronAPI.analyzeSong(text);

          if (result.success && result.data) {
            const analysis = result.data;
            const boleContent = formatAnalysis(analysis);

            // 发送系统通知
            if (window.electronAPI) {
              window.electronAPI.showNotification(
                '伯乐分析完成 🎵',
                `${analysis.songName} - ${analysis.artist}`
              ).catch(() => {});
            }

            const boleMsg: ChatMessage = {
              id: generateId(),
              role: 'bole',
              content: boleContent,
              timestamp: nowISO(),
            };
            setMessages((prev) => [...prev, boleMsg]);
            await window.electronAPI.addMessage(boleMsg);

            // 更新听歌日记
            const today = new Date().toISOString().split('T')[0];
            await window.electronAPI.addDiaryEntry({
              date: today,
              songs: [
                {
                  title: analysis.songName,
                  artist: analysis.artist,
                  time: new Date().toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                  note: analysis.personalThought?.slice(0, 100) || '',
                },
              ],
              mood: analysis.emotion || '未知',
              summary: '',
            });
          } else {
            // AI 分析失败，显示错误
            const errorMsg: ChatMessage = {
              id: generateId(),
              role: 'bole',
              content: `😅 ${result.error || '分析过程中出了点问题'}\n\n请确认：\n1. 去「设置」页面填入了正确的 API Key\n2. 网络连接正常\n3. API 账户余额充足`,
              timestamp: nowISO(),
            };
            setMessages((prev) => [...prev, errorMsg]);
            await window.electronAPI.addMessage(errorMsg);
          }
        } else {
          // 自由对话模式
          const history = messages.slice(-10).map((m) => ({
            role: m.role === 'bole' ? 'assistant' : 'user',
            content: m.content,
          }));
          history.push({ role: 'user', content: text });

          const result = await window.electronAPI.chat(history);

          if (result.success && result.data) {
            const boleMsg: ChatMessage = {
              id: generateId(),
              role: 'bole',
              content: result.data,
              timestamp: nowISO(),
            };
            setMessages((prev) => [...prev, boleMsg]);
            await window.electronAPI.addMessage(boleMsg);
          } else {
            throw new Error(result.error || '对话失败');
          }
        }
      } else {
        // ---- 离线/开发模式：模拟回复 ----
        await new Promise((r) => setTimeout(r, 1500));
        const boleMsg: ChatMessage = {
          id: generateId(),
          role: 'bole',
          content: getMockReply(text),
          timestamp: nowISO(),
        };
        setMessages((prev) => [...prev, boleMsg]);
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: generateId(),
        role: 'bole',
        content: `抱歉，出了点问题 🙏\n\n${err.message || '未知错误'}\n\n请检查网络连接和 API 配置后重试。`,
        timestamp: nowISO(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      if (window.electronAPI) {
        await window.electronAPI.addMessage(errorMsg).catch(() => {});
      }
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, messages]);

  // 搜索回调
  const handleSearchSelect = useCallback(
    async (songName: string, artist: string, lyrics?: string) => {
      setShowSearch(false);
      // 在输入框填入并自动发送
      const searchText = `${songName} ${artist}`;
      setInputValue(searchText);
      // 直接触发分析
      if (!window.electronAPI) return;

      const userMsg: ChatMessage = {
        id: generateId(), role: 'user', content: `🔍 ${songName} - ${artist}`, timestamp: nowISO(),
      };
      setMessages((prev) => [...prev, userMsg]);
      await window.electronAPI.addMessage(userMsg);

      setIsLoading(true);
      try {
        const result = await window.electronAPI.analyzeSong(songName, artist, lyrics);
        if (result.success && result.data) {
          const boleContent = formatAnalysis(result.data);
          const boleMsg: ChatMessage = {
            id: generateId(), role: 'bole', content: boleContent, timestamp: nowISO(),
          };
          setMessages((prev) => [...prev, boleMsg]);
          await window.electronAPI.addMessage(boleMsg);

          // 日记
          const today = new Date().toISOString().split('T')[0];
          await window.electronAPI.addDiaryEntry({
            date: today,
            songs: [{ title: songName, artist, time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }), note: result.data.personalThought?.slice(0, 100) || '' }],
            mood: result.data.emotion || '未知',
            summary: '',
          });
        }
      } catch {
        // 失败静默
      }
      setIsLoading(false);
    },
    []
  );

  // 键盘事件
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ----- 渲染 -----

  if (!messagesLoaded) {
    return (
      <div className="app">
        <div className="loading-screen">
          <div className="loading-logo">🐴</div>
          <div className="loading-text">伯乐模拟器加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app" data-theme={theme}>
      {/* 侧边栏 */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">🐴</div>
          <h1>伯乐模拟器</h1>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.view}
              className={`nav-item ${currentView === item.view ? 'active' : ''}`}
              onClick={() => setCurrentView(item.view)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {appInfo && (
          <div className="sidebar-footer">
            <span>v{appInfo.version}</span>
          </div>
        )}
      </aside>

      {/* 主内容区 */}
      <main className="main">
        <header className="topbar">
          <div className="topbar-title">{VIEW_TITLES[currentView]}</div>
          <div className="topbar-status">
            <span className="status-dot"></span>
            <span>在线</span>
          </div>
        </header>

        {showSearch && (
          <SearchSongs
            onSelect={handleSearchSelect}
            onClose={() => setShowSearch(false)}
          />
        )}
        {showPlaylist && (
          <PlaylistImport
            onClose={() => setShowPlaylist(false)}
            onSongAnalyzed={async (name, artist, content) => {
              const boleMsg: ChatMessage = {
                id: generateId(), role: 'bole', content, timestamp: nowISO(),
              };
              setMessages((prev) => [...prev, boleMsg]);
              if (window.electronAPI) await window.electronAPI.addMessage(boleMsg);
            }}
          />
        )}
        {showHumming && (
          <HummingRecorder
            onClose={() => setShowHumming(false)}
            onResult={(title, artist) => {
              setInputValue(`${title} ${artist}`);
              setShowHumming(false);
            }}
          />
        )}

        {currentView === 'report' && <ReportPage />}
        {currentView === 'diary' && <DiaryPage />}
        {currentView === 'settings' && <SettingsPage />}

        {currentView === 'chat' && (
          <>
            <div className="messages-container">
              {messages.map((msg) => (
                <div key={msg.id} className={`message ${msg.role}`}>
                  <div className="message-avatar">
                    {msg.role === 'bole' ? '🐴' : '👤'}
                  </div>
                  <div className="message-bubble">
                    <div className="message-text">
                      {msg.content.split('\n').map((line, i) => (
                        <React.Fragment key={i}>
                          {line}
                          {i < msg.content.split('\n').length - 1 && <br />}
                        </React.Fragment>
                      ))}
                    </div>
                    <div className="message-time">
                      {new Date(msg.timestamp).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="message bole">
                  <div className="message-avatar">🐴</div>
                  <div className="message-bubble typing">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="input-area">
              <div className="input-wrapper">
                <button className="search-toggle-btn" onClick={() => setShowSearch(true)} title="搜索歌曲">🔍</button>
                <button className="search-toggle-btn" onClick={() => setShowPlaylist(true)} title="导入歌单">📋</button>
                <button className="search-toggle-btn" onClick={() => setShowHumming(true)} title="哼歌识别">🎤</button>
                <textarea
                  className="input-field"
                  placeholder="输入歌名、粘贴网易云链接，或点🔍搜索..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  disabled={isLoading}
                />
                <button
                  className="send-button"
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isLoading}
                >
                  发送
                </button>
              </div>
              <div className="input-hint">
                💡 输入歌名让伯乐分析 ｜ 输入「推荐歌曲」获取个性化推荐 ｜ 也可以随便聊聊音乐
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 格式化 AI 分析结果为好看的聊天文本
 */
function formatAnalysis(a: SongAnalysis): string {
  let text = '';
  text += `🎵 **${a.songName}**`;
  if (a.artist && a.artist !== '未知') {
    text += ` — ${a.artist}`;
  }
  text += '\n\n';

  if (a.lyrics) {
    text += `📝 **歌词主题**\n${a.lyrics}\n\n`;
  }
  if (a.emotion) {
    text += `💗 **情感色彩**\n${a.emotion}\n\n`;
  }
  if (a.genre) {
    text += `🎼 **音乐风格**\n${a.genre}\n\n`;
  }
  if (a.story && a.story !== '暂无相关信息') {
    text += `📖 **创作背景**\n${a.story}\n\n`;
  }
  if (a.personalThought) {
    text += `💭 **伯乐感悟**\n${a.personalThought}`;
  }

  return text;
}

/**
 * 格式化推荐结果
 */
function formatRecommendations(data: RecommendData): string {
  let text = '🎵 **伯乐为你推荐**\n\n';
  for (const r of data.recommendations) {
    text += `🎶 **${r.songName}** — ${r.artist}\n`;
    text += `> ${r.reason}\n\n`;
  }
  text += `💭 ${data.comment}`;
  return text;
}

/**
 * 从聊天记录中提取歌曲信息
 */
function diaryEntriesFromMessages(messages: ChatMessage[]): { title: string; artist: string }[] {
  const songs: { title: string; artist: string }[] = [];
  for (const msg of messages) {
    if (msg.role === 'user') {
      const text = msg.content.trim();
      if (text.length < 100 && !text.includes('?') && !text.includes('？') && !text.includes('推荐')) {
        songs.push({ title: text, artist: '' });
      }
    }
  }
  return songs.slice(-10);
}

/**
 * 模拟回复（离线/开发模式使用）
 */
function getMockReply(input: string): string {
  return `🎵 关于「${input}」的分析（离线模式）...

这是一首动人的歌曲。在离线模式下我无法进行真正的 AI 分析。

请在 Electron 环境中运行并配置 API Key 以获得真实的音乐分析体验。`;
}
