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

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 模块级变量：防止 React Strict Mode 双重挂载导致重复启动采集
let _autoRestoreDone = false;

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
  const [isListening, setIsListening] = useState(false);

  // 主题 + 头像
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [userAvatar, setUserAvatar] = useState('👤');

  // 应用信息
  const [appInfo, setAppInfo] = useState<any>(null);

  // ----- 初始化：加载数据 -----

  useEffect(() => {
    async function init() {
      if (!window.electronAPI) return;

      try {
        // 加载主题：已保存的 > 系统偏好 > 暗色
        const t = await window.electronAPI.getTheme();
        if (t === 'dark' || t === 'light') {
          setTheme(t);
          console.log('[app] theme loaded from store:', t);
        } else {
          const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
          const fallback = prefersLight ? 'light' : 'dark';
          setTheme(fallback);
          console.log('[app] theme from OS preference:', fallback);
        }

        // 监听系统主题变化（当用户未手动设置时自动跟随）
        const mq = window.matchMedia('(prefers-color-scheme: light)');
        mq.addEventListener('change', (e) => {
          setTheme((prev) => {
            // 只在用户没有手动选择时跟随系统
            const newTheme = e.matches ? 'light' : 'dark';
            console.log('[app] OS theme changed to:', newTheme);
            return newTheme;
          });
        });

        // 监听设置变更（主题实时切换等）
        window.electronAPI.onSettingsChanged?.((s: any) => {
          if (s.theme) setTheme(s.theme);
          if (s.userAvatar) setUserAvatar(s.userAvatar);
        });
        const s = await window.electronAPI.getSettings();
        if (s.userAvatar) setUserAvatar(s.userAvatar);

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
          // 去重防止旧数据重复 id 导致的 React key 警告
          const seen = new Set<string>();
          setMessages(saved.filter((m: ChatMessage) => {
            if (seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
          }));
        } else {
          // 首次使用，显示欢迎消息
          const welcome: ChatMessage = {
            id: 'welcome-1',
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
            id: 'welcome-fallback',
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

  // macOS: 自动恢复采集（设置中 autoListen=true 时）
  // restored 在模块级，防止 React Strict Mode 双重挂载
  useEffect(() => {
    if (!window.electronAPI || window.electronAPI.platform !== 'darwin') return;

    let cancelled = false;
    window.electronAPI.getSettings().then(async (s: any) => {
      if (s.autoListen && !cancelled && !_autoRestoreDone) {
        _autoRestoreDone = true;
        try {
          // 必须同时启动主进程采集（注册 onChunk 回调）和渲染进程采集（MediaRecorder）
          await window.electronAPI!.startAudioCapture();
          const { startSystemAudioCapture } = await import('./system-audio-capture');
          await startSystemAudioCapture();
        } catch (e) {
          console.log('[app] Auto-restore capture failed:', e);
          _autoRestoreDone = false;
        }
      }
    });

    return () => {
      cancelled = true;
      // Strict Mode 清理：停止采集
      window.electronAPI?.stopAudioCapture().catch(() => {});
      import('./system-audio-capture').then(m => m.stopSystemAudioCapture()).catch(() => {});
    };
  }, []);

  // 订阅音频检测事件（自动采集识别到歌曲时）
  useEffect(() => {
    if (!window.electronAPI) return;

    const handler = async (result: any) => {
      if (result.title && result.confidence > 40) {
        setCurrentView('chat');

        // 检查是否开启了自动写入日记
        const settings = await window.electronAPI!.getSettings();
        const autoDiary = settings.autoDiary && settings.autoListen;

        const detectMsg: ChatMessage = {
          id: generateId(),
          role: 'user',
          content: autoDiary
            ? `🎧 检测到：${result.title} — ${result.artist || ''}`
            : `🎧 自动检测到正在播放`,
          timestamp: nowISO(),
          meta: {
            type: 'song_detected',
            songTitle: result.title,
            songArtist: result.artist || '',
            confirmed: autoDiary,
          },
        };
        setMessages((prev) => [...prev, detectMsg]);
        await window.electronAPI!.addMessage(detectMsg);

        if (autoDiary) {
          // 自动分析并写入日记
          console.log('[app] auto-diary: auto confirming', result.title);
          try {
            const analysis = await window.electronAPI!.analyzeSong(result.title, result.artist || '');
            if (analysis.success && analysis.data) {
              const boleMsg: ChatMessage = { id: generateId(), role: 'bole', content: formatAnalysis(analysis.data), timestamp: nowISO() };
              setMessages((prev) => [...prev, boleMsg]);
              await window.electronAPI!.addMessage(boleMsg);
            } else {
              const hintMsg: ChatMessage = { id: generateId(), role: 'bole', content: `🎵 ${result.title} — ${result.artist || ''}\n\n识别成功！去「设置」页面配置 DeepSeek API Key 即可开启 AI 分析。`, timestamp: nowISO() };
              setMessages((prev) => [...prev, hintMsg]);
              await window.electronAPI!.addMessage(hintMsg);
            }
          } catch (err) {
            console.error('[app] auto-diary analysis failed:', err);
          }
        }
      }
    };

    window.electronAPI.onSongDetected(handler);

    return () => {
      // 清理监听器，防止重复注册
      if (window.electronAPI) {
        window.electronAPI.removeSongDetectedListener?.();
      }
    };
  }, []);  // 空依赖：只在挂载时注册一次

  // 定期检查采集状态（macOS 额外检查渲染进程侧 MediaRecorder）
  useEffect(() => {
    const interval = setInterval(async () => {
      if (window.electronAPI) {
        try {
          let capturing = await window.electronAPI.isAudioCapturing();
          // macOS: 主进程 isRunning 可能滞后，同时检查渲染进程侧
          if (window.electronAPI.platform === 'darwin') {
            const { isSystemAudioCapturing } = await import('./system-audio-capture');
            capturing = capturing || isSystemAudioCapturing();
          }
          if (capturing !== isListening) {
            setIsListening(capturing);
            // 状态变化时在对话中提示
            if (capturing) {
              const msg: ChatMessage = {
                id: generateId(), role: 'bole',
                content: '🎧 自动监听已开启！\n\n正在监听系统音频... 播放音乐后会自动识别和分析。\n\n💡 提示：切换回本页面，检测到歌曲时会自动显示分析结果。',
                timestamp: nowISO(),
              };
              setMessages((prev) => [...prev, msg]);
              if (window.electronAPI) window.electronAPI.addMessage(msg).catch(() => {});
            }
          }
        } catch {}
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [isListening]);

  // 删除单条消息
  async function handleDeleteMessage(msgId: string) {
    setMessages(prev => prev.filter(m => m.id !== msgId));
    if (window.electronAPI) {
      await window.electronAPI.deleteMessage(msgId).catch(() => {});
    }
  }

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
                const today = todayLocal();
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
        const isRecommendQuery = looksLikeRecommend(text);
        const isSongQuery = looksLikeSongQuery(text);

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

            // 发送系统通知（尊重用户设置）
            if (window.electronAPI && result.cached !== true) {
              const settings = await window.electronAPI.getSettings();
              if (settings.notifyOnAnalysis) {
                window.electronAPI.showNotification(
                  '伯乐分析完成 🎵',
                  `${analysis.songName} - ${analysis.artist}`
                ).catch(() => {});
              }
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
            const today = todayLocal();
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
            // 歌曲分析失败 → 回退到自由对话模式
            console.log('[app] analyzeSong failed, falling back to chat. errorAPI:', !!window.electronAPI, 'hasChat:', !!window.electronAPI?.chat);
            if (!window.electronAPI || !window.electronAPI.chat) {
              throw new Error('chat API 不可用，请完全退出 App 后重新打开');
            }
            const history = messages.slice(-10).map((m) => ({
              role: m.role === 'bole' ? 'assistant' : 'user',
              content: m.content,
            }));

            const chatResult = await window.electronAPI.chat(history, text);
            console.log('[app] Fallback chat result:', chatResult?.success, chatResult?.error?.slice(0, 50));
            if (chatResult.success && chatResult.data) {
              const boleMsg: ChatMessage = {
                id: generateId(), role: 'bole', content: chatResult.data, timestamp: nowISO(),
              };
              setMessages((prev) => [...prev, boleMsg]);
              await window.electronAPI.addMessage(boleMsg);
            } else {
              const errorMsg: ChatMessage = {
                id: generateId(), role: 'bole',
                content: `😅 ${chatResult.error || '出了点问题'}\n\n请确认：\n1. 去「设置」页面填入了正确的 API Key\n2. 网络连接正常`,
                timestamp: nowISO(),
              };
              setMessages((prev) => [...prev, errorMsg]);
              await window.electronAPI.addMessage(errorMsg);
            }
          }
        } else {
          // 自由对话模式
          console.log('[app] Chat mode. text:', text, 'errorAPI:', !!window.electronAPI, 'hasChat:', !!window.electronAPI?.chat);
          if (!window.electronAPI || !window.electronAPI.chat) {
            console.error('[app] window.electronAPI or chat is missing!', !!window.electronAPI, typeof window.electronAPI?.chat);
            const errorMsg: ChatMessage = {
              id: generateId(), role: 'bole',
              content: '抱歉，出了点问题 🙏\n\n应用正在初始化中，请稍后重试。如果持续出现此问题，请完全退出 App 后重新打开。',
              timestamp: nowISO(),
            };
            setMessages((prev) => [...prev, errorMsg]);
            setIsLoading(false);
            return;
          }

          const history = messages.slice(-10).map((m) => ({
            role: m.role === 'bole' ? 'assistant' : 'user',
            content: m.content,
          }));

          const result = await window.electronAPI.chat(history, text);
          console.log('[app] Chat result:', result?.success, result?.error?.slice(0, 50));

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
        content: `抱歉，出了点问题 🙏\n\n${err.message || '未知错误'}\n\n${err.stack?.split('\n').slice(0, 3).join('\n') || ''}`,
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
    async (songName: string, artist: string, lyrics?: string, songId?: string) => {
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
          const today = todayLocal();
          await window.electronAPI.addDiaryEntry({
            date: today,
            songs: [{ title: songName, artist, time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }), note: result.data.personalThought?.slice(0, 100) || '' }],
            mood: result.data.emotion || '未知',
            summary: '',
          });

          // 网易云热评
          if (songId) {
            try {
              console.log('[app] fetching hot comments for songId:', songId);
              const commentsRes = await (window.electronAPI as any).getHotComments(songId);
              if (commentsRes.success && commentsRes.data && commentsRes.data.length > 0) {
                const commentsText = commentsRes.data
                  .map((c: HotComment, i: number) => `${i + 1}. "${c.content}"\n   — ${c.nickname} 👍 ${c.likedCount}`)
                  .join('\n\n');
                const commentsMsg: ChatMessage = {
                  id: generateId(),
                  role: 'bole',
                  content: `🗨️ 网易云热评精选\n\n${commentsText}`,
                  timestamp: nowISO(),
                };
                setMessages((prev) => [...prev, commentsMsg]);
                await window.electronAPI.addMessage(commentsMsg);
                console.log('[app] hot comments appended for', songName);
              }
            } catch (e) {
              console.log('[app] failed to load hot comments:', e);
            }
          }
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
            {isListening ? (
              <><span className="status-dot listening"></span><span>🎧 监听中</span></>
            ) : (
              <><span className="status-dot"></span><span>在线</span></>
            )}
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
                    {msg.role === 'bole' ? '🐴' : (userAvatar || '👤')}
                  </div>
                  <div className="message-bubble">
                    <button
                      className="msg-delete-btn"
                      onClick={() => handleDeleteMessage(msg.id)}
                      title="删除此消息"
                    >×</button>
                    {msg.meta?.type === 'song_detected' && !msg.meta.confirmed ? (
                      <SongConfirmCard
                        msg={msg}
                        onConfirm={async (title, artist) => {
                          await handleConfirmSong(msg, title, artist, setMessages, messages);
                        }}
                        onIgnore={async () => {
                          await handleIgnoreSong(msg, setMessages, messages);
                        }}
                      />
                    ) : (
                      <>
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
                      </>
                    )}
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
                  placeholder="随便聊聊音乐... 查歌请说「搜索 周杰伦 晴天」"
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
              {isListening && (
                <div className="listening-hint">
                  🎧 正在监听系统音频... 播放音乐后会自动识别和分析
                </div>
              )}
              <div className="input-hint">
                💡 随便聊天 ｜ 说「搜索 + 歌名」查歌 ｜ 自动检测到的歌曲会主动分析
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
  // Agent 返回的自然语言已在 personalThought 中
  if (a.personalThought) return a.personalThought;

  // 兼容旧格式
  let text = `🎵 **${a.songName}**`;
  if (a.artist && a.artist !== '未知') text += ` — ${a.artist}`;
  text += '\n\n';
  if (a.lyrics) text += `📝 **歌词主题**\n${a.lyrics}\n\n`;
  if (a.emotion) text += `💗 **情感色彩**\n${a.emotion}\n\n`;
  if (a.genre) text += `🎼 **音乐风格**\n${a.genre}\n\n`;
  if (a.story && a.story !== '暂无相关信息') text += `📖 **创作背景**\n${a.story}\n\n`;
  return text;
}

/** 是否是推荐请求 */
function looksLikeRecommend(text: string): boolean {
  return text.includes('推荐') || text.includes('有什么好听的');
}

/** 是否明确像是在查询一首歌曲（而非普通聊天） */
function looksLikeSongQuery(text: string): boolean {
  // 包含「歌手 - 歌名」或「歌手—歌名」分隔符 → 歌曲查询
  if (text.includes(' - ') || text.includes('—')) return true;
  // 明确要求分析歌曲
  if (/分析|是什么歌|什么歌|识别|查歌/.test(text)) return true;
  // 包含音乐/歌曲关键词 → 可能是歌曲查询
  if (/^(歌|曲|唱|专辑|歌手|乐队|单曲)/.test(text)) return true;
  // URL 链接 → 歌曲查询
  if (/https?:\/\//.test(text)) return true;
  // 太长的文本 → 聊天
  if (text.length > 30) return false;
  // 纯标点、纯数字、单字 → 聊天
  if (/^[\s\d\p{P}]+$/u.test(text) || text.length <= 1) return false;
  // 包含问号 → 聊天
  if (/[?？]/.test(text)) return false;
  // 短文本（2-30字）且不含问号 → 检查是否像聊天寒暄
  // 常见聊天寒暄词 → 不走歌曲查询
  if (/^(你好|嗨|哈|嘿嘿|哈哈|嗯|哦|好|谢谢|再见|在吗|早|晚安|早安|午安)/.test(text)) return false;
  // 其余短文本 → 可能是歌曲查询
  return !looksLikeRecommend(text);
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
    if (msg.role === 'user' && looksLikeSongQuery(msg.content.trim())) {
      songs.push({ title: msg.content.trim(), artist: '' });
    }
  }
  return songs.slice(-10);
}

/**
 * 模拟回复（离线/开发模式使用）
 */
// ============================================================
// 歌曲确认卡片
// ============================================================

function SongConfirmCard({ msg, onConfirm, onIgnore }: {
  msg: ChatMessage;
  onConfirm: (title: string, artist: string) => void;
  onIgnore: () => void;
}) {
  const [title, setTitle] = useState(msg.meta?.songTitle || '');
  const [artist, setArtist] = useState(msg.meta?.songArtist || '');
  const [editing, setEditing] = useState(false);

  return (
    <div className="song-confirm-card">
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
        🎧 自动检测到正在播放
      </div>
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          <input className="setting-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="歌曲名" />
          <input className="setting-input" value={artist} onChange={e => setArtist(e.target.value)} placeholder="歌手" />
        </div>
      ) : (
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4, color: 'var(--color-accent-light)' }}>
          {title}
        </div>
      )}
      {artist && !editing && (
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 10 }}>{artist}</div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="song-confirm-btn confirm" onClick={() => onConfirm(title, artist)}>
          ✅ 确认分析
        </button>
        <button className="song-confirm-btn edit" onClick={() => setEditing(!editing)}>
          ✏️ 修改
        </button>
        <button className="song-confirm-btn ignore" onClick={onIgnore}>
          ❌ 忽略
        </button>
      </div>
    </div>
  );
}

async function handleConfirmSong(
  msg: ChatMessage,
  title: string,
  artist: string,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  messages: ChatMessage[]
) {
  // 标记为已确认
  setMessages(prev => prev.map(m =>
    m.id === msg.id ? { ...m, meta: { ...m.meta, songTitle: title, songArtist: artist, confirmed: true }, content: `🎧 检测到：${title} — ${artist}` } : m
  ));
  if (window.electronAPI) {
    await window.electronAPI.addMessage({ ...msg, meta: { ...msg.meta, songTitle: title, songArtist: artist, confirmed: true }, content: `🎧 检测到：${title} — ${artist}` });
  }

  // 调用 AI 分析
  try {
    const analysis = await window.electronAPI!.analyzeSong(title, artist);
    if (analysis.success && analysis.data) {
      const boleMsg: ChatMessage = { id: generateId(), role: 'bole', content: formatAnalysis(analysis.data), timestamp: nowISO() };
      setMessages(prev => [...prev, boleMsg]);
      await window.electronAPI!.addMessage(boleMsg);
    } else {
      const hintMsg: ChatMessage = { id: generateId(), role: 'bole', content: `🎵 ${title} — ${artist}\n\n识别成功！去「设置」页面配置 DeepSeek API Key 即可开启 AI 分析。`, timestamp: nowISO() };
      setMessages(prev => [...prev, hintMsg]);
      await window.electronAPI!.addMessage(hintMsg);
    }
  } catch {}
}

async function handleIgnoreSong(
  msg: ChatMessage,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  messages: ChatMessage[]
) {
  setMessages(prev => prev.filter(m => m.id !== msg.id));
}

function getMockReply(input: string): string {
  return `🎵 关于「${input}」的分析（离线模式）...

这是一首动人的歌曲。在离线模式下我无法进行真正的 AI 分析。

请在 Electron 环境中运行并配置 API Key 以获得真实的音乐分析体验。`;
}
