/**
 * 伯乐模拟器 - 主应用组件
 *
 * 知音对话 + 页面切换 + 真实 AI + 数据持久化
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import ReportPage from './components/ReportPage';
import DiaryPage from './components/DiaryPage';
import SettingsPage from './components/SettingsPage';
import SearchSongs from './components/SearchSongs';
import PlaylistImport from './components/PlaylistImport';
import HummingRecorder from './components/HummingRecorder';
import Sidebar from './components/Sidebar';
import Modal from './components/Modal';

// ----- 类型 -----

type View = 'chat' | 'report' | 'diary' | 'settings';

/** 人格信息（用于对话列表和新对话选择器） */
const PERSONA_INFO: Record<string, { icon: string; label: string; desc: string }> = {
  literary: { icon: '🖋️', label: '文学诗人', desc: '敏感细腻，用诗意解读音乐' },
  professional: { icon: '🎙️', label: '专业乐评', desc: '从业十五年，专业不失温度' },
  warm: { icon: '💛', label: '温暖挚友', desc: '最懂你也最懂音乐的好朋友' },
  humorous: { icon: '😎', label: '幽默发烧友', desc: '三千张黑胶，一肚子音乐段子' },
};

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

// ============================================================
// 新建对话 Modal
// ============================================================

function NewConversationModal({
  isOpen,
  onClose,
  onCreate,
  defaultPersona,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, persona: string) => void;
  defaultPersona: string;
}) {
  const [name, setName] = useState('');
  const [persona, setPersona] = useState(defaultPersona || 'literary');

  // 每次打开时重置：默认选中设置页配置的全局人格
  useEffect(() => {
    if (isOpen) {
      setPersona(defaultPersona || 'literary');
      setName('');
    }
  }, [isOpen, defaultPersona]);

  const handleCreate = () => {
    onCreate(name.trim() || '新对话', persona);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="＋ 新建对话" maxWidth={480}>
      <div className="new-conv-body">
        <label className="new-conv-label">对话名称</label>
        <input
          className="search-input new-conv-input"
          placeholder="给这个对话起个名字（可选）"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          autoFocus
        />

        <label className="new-conv-label">选择聊天人格</label>
        <div className="persona-picker">
          {Object.entries(PERSONA_INFO).map(([id, info]) => (
            <div
              key={id}
              className={`persona-pick-card ${persona === id ? 'selected' : ''}`}
              onClick={() => setPersona(id)}
            >
              <div className="persona-pick-icon">{info.icon}</div>
              <div className="persona-pick-name">{info.label}</div>
              <div className="persona-pick-desc">{info.desc}</div>
            </div>
          ))}
        </div>

        <div className="new-conv-actions">
          <button className="search-btn" onClick={handleCreate} disabled={!persona}>
            创建对话
          </button>
          <button className="report-export-btn" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </Modal>
  );
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
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  // 当前查看位置对应的用户消息ID（右侧"—"粗体跟随）
  const [activeMsgId, setActiveMsgId] = useState('');
  const lastScrollCalcRef = useRef(0);
  const dashesRef = useRef<HTMLDivElement>(null);
  const navListRef = useRef<HTMLDivElement>(null);

  // 多对话
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState('');
  const [showNewConvModal, setShowNewConvModal] = useState(false);
  // 全局默认人格（设置页配置，用于新对话预选）
  const [defaultPersona, setDefaultPersona] = useState('literary');

  // 搜索面板
  const [showSearch, setShowSearch] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showHumming, setShowHumming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  // 音频采集许可（设置页「允许音频采集」，仅许可不启动）
  const [allowCapture, setAllowCapture] = useState(false);
  // 实时音量（0~1 RMS，用于采集可视化）
  const [audioLevel, setAudioLevel] = useState(0);
  const audioLevelRef = useRef(0); // rAF 闭包读取最新值（不触发 React 渲染）
  // 波形条 DOM 引用（rAF 直接操作，避免 60fps React 重渲染卡顿）
  const waveBarsRef = useRef<(HTMLSpanElement | null)[]>([]);

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
          if (s.persona) setDefaultPersona(s.persona);
          if (typeof s.autoListen === 'boolean') setAllowCapture(s.autoListen);
        });
        const s = await window.electronAPI.getSettings();
        if (s.userAvatar) setUserAvatar(s.userAvatar);
        if (s.persona) setDefaultPersona(s.persona);
        if (typeof s.autoListen === 'boolean') setAllowCapture(s.autoListen);

        // 监听托盘导航
        window.electronAPI.onNavigate((view: string) => {
          navigateTo(view as View);
        });

        // 加载应用信息
        const info = await window.electronAPI.getAppInfo();
        setAppInfo(info);

        // 加载对话列表
        const convs = await window.electronAPI.getConversations();
        setConversations(convs || []);
        const activeId = await window.electronAPI.getActiveConversationId();
        setActiveConvId(activeId || (convs?.[0]?.id ?? ''));

        // 加载当前对话的消息
        const saved = await window.electronAPI.getMessagesForConversation(activeId);
        if (saved && saved.length > 0) {
          // 去重防止旧数据重复 id 导致的 React key 警告
          const seen = new Set<string>();
          setMessages(saved.filter((m: ChatMessage) => {
            if (seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
          }));
        } else if (activeId === 'default') {
          // 默认对话首次使用：写人格欢迎语（与新建对话完全一致，无"默认欢迎语"概念）
          const info = PERSONA_INFO[defaultPersona] || PERSONA_INFO.literary;
          const welcome: ChatMessage = {
            id: 'welcome-default',
            role: 'bole',
            content: `你好，我是伯乐 🎵（${info.icon} ${info.label}）\n\n${info.desc}。\n\n从现在开始，我们就以这个身份聊天吧～直接输入歌名或随便聊聊都行！`,
            timestamp: nowISO(),
          };
          setMessages([welcome]);
          await window.electronAPI.addMessageToConversation(activeId, welcome);
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

  // 订阅实时音量（采集可视化）
  useEffect(() => {
    if (!window.electronAPI?.onAudioLevel) return;
    window.electronAPI.onAudioLevel((rms: number) => {
      audioLevelRef.current = rms;
      setAudioLevel(rms);
    });
  }, []);

  // 波形动画：rAF 直接操作 DOM（不触发 React 渲染，避免卡顿）
  useEffect(() => {
    if (!isListening) return;
    let raf: number;
    const tick = () => {
      // 时间驱动相位（平滑流动）
      const phase = performance.now() / 170;
      const amp = Math.min(1, audioLevelRef.current * 5);
      // 低于阈值 = 静音 → 所有柱固定静止基线（不跳动）
      const hasAudio = amp > 0.02;
      waveBarsRef.current.forEach((bar, i) => {
        if (!bar) return;
        const h = hasAudio
          ? amp * (0.3 + 0.7 * Math.abs(Math.sin(phase + i * 0.55)))
          : 0.08;
        bar.style.height = `${Math.max(8, Math.min(100, h * 100))}%`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isListening]);

  // 订阅音频检测事件（自动采集识别到歌曲时）
  useEffect(() => {
    if (!window.electronAPI) return;

    const handler = async (result: any) => {
      if (result.title && result.confidence > 40) {
        navigateTo('chat');

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
        await persistMessage(detectMsg);

        if (autoDiary) {
          // 自动分析并写入日记
          console.log('[app] auto-diary: auto confirming', result.title);
          try {
            const analysis = await window.electronAPI!.analyzeSong(result.title, result.artist || '', undefined, activePersona);
            if (analysis.success && analysis.data) {
              const boleMsg: ChatMessage = { id: generateId(), role: 'bole', content: formatAnalysis(analysis.data), timestamp: nowISO() };
              await persistMessage(boleMsg);
            } else {
              const hintMsg: ChatMessage = { id: generateId(), role: 'bole', content: `🎵 ${result.title} — ${result.artist || ''}\n\n识别成功！去「设置」页面配置 DeepSeek API Key 即可开启 AI 分析。`, timestamp: nowISO() };
              await persistMessage(hintMsg);
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
            // 仅同步状态（不写入会话——采集提示用输入区上方的 listening-hint 展示）
            setIsListening(capturing);
          }
        } catch {}
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [isListening]);

  // 删除单条消息
  async function handleDeleteMessage(msgId: string) {
    setMessages(prev => prev.filter(m => m.id !== msgId));
    if (window.electronAPI && activeConvId) {
      await window.electronAPI.deleteMessageFromConversation(activeConvId, msgId).catch(() => {});
    }
  }

  // 工具栏 🎧：开始/停止音频采集（需先在设置中允许）
  async function handleToggleCapture() {
    if (!window.electronAPI) return;

    // 停止
    if (isListening) {
      if (window.electronAPI.platform === 'darwin') {
        const { stopSystemAudioCapture } = await import('./system-audio-capture');
        stopSystemAudioCapture();
      }
      await window.electronAPI.stopAudioCapture();
      setIsListening(false);
      return;
    }

    // 未允许 → 提醒去设置开启
    if (!allowCapture) {
      const go = window.confirm(
        '🎧 尚未开启「允许音频采集」\n\n' +
        '请先在 设置 → 功能设置 中开启「允许音频采集」。\n\n' +
        '点击「确定」前往设置页'
      );
      if (go) navigateTo('settings');
      return;
    }

    // 启动采集
    try {
      const diag = await window.electronAPI.diagnoseAudio();
      const isMacOS = window.electronAPI.platform === 'darwin';

      // 非 macOS：诊断不通过就阻止
      if (!isMacOS && !diag.ready) {
        alert('⚠️ 音频采集无法启动：\n\n' +
          diag.issues.map((i: string) => '• ' + i).join('\n'));
        return;
      }

      if (isMacOS) {
        const { startSystemAudioCapture } = await import('./system-audio-capture');
        await window.electronAPI.startAudioCapture();
        await startSystemAudioCapture();
      } else {
        await window.electronAPI.startAudioCapture();
      }
    } catch (err: any) {
      const errMsg = err.message || err.name || '未知错误';
      const isDenied = err.name === 'NotAllowedError' || errMsg.includes('permission');
      if (isDenied) {
        const goSettings = window.confirm(
          '⚠️ 屏幕录制权限未授权\n\n' +
          '请前往系统设置中开启权限。\n\n' +
          '点击「确定」自动打开系统设置 → 隐私与安全性 → 屏幕录制 → 勾选「伯乐模拟器」'
        );
        if (goSettings) {
          try { await window.electronAPI.openScreenRecordingSettings(); } catch {}
        }
      } else {
        alert('❌ 采集启动失败:\n\n' + errMsg);
      }
    }
  }

  // ----- 多对话辅助函数 -----

  /** 保存消息到当前对话（state + store 同步） */
  async function persistMessage(msg: ChatMessage, convId?: string) {
    // activeConvId 未初始化时（启动早期）兜底到第一个对话
    const cid = convId || activeConvId || conversations[0]?.id || '';
    setMessages((prev) => [...prev, msg]);
    if (window.electronAPI && cid) {
      try {
        await window.electronAPI.addMessageToConversation(cid, msg);
      } catch (err) {
        console.error('[app] persistMessage failed for conv', cid, err);
      }
    } else {
      console.warn('[app] persistMessage skipped: no electronAPI or no convId, cid=', cid);
    }
  }

  /** 加载指定对话的消息到 state */
  async function loadConversationMessages(convId: string) {
    if (!window.electronAPI) return;
    const msgs = await window.electronAPI.getMessagesForConversation(convId);
    setMessages(msgs || []);
  }

  /** 切换对话 */
  async function handleSwitchConversation(convId: string) {
    if (!window.electronAPI || convId === activeConvId) return;
    // 先保存当前对话的滚动位置（下次切回该对话时恢复）
    const curEl = messagesContainerRef.current;
    if (curEl) chatScrollTopsRef.current[activeConvId] = curEl.scrollTop;
    setActiveConvId(convId);
    await window.electronAPI.switchConversation(convId).catch(() => {});
    await loadConversationMessages(convId);
    // 目标对话有记忆 → 恢复到上次停留位置；无记忆 → 定位到最新消息
    const saved = chatScrollTopsRef.current[convId];
    if (saved != null) {
      requestAnimationFrame(() => {
        const container = messagesContainerRef.current;
        if (container) {
          container.scrollTop = saved;
          const dist = container.scrollHeight - container.scrollTop - container.clientHeight;
          setIsNearBottom(dist < 80);
          calcActiveMsg();
        }
      });
    } else {
      setIsNearBottom(true);
    }
    setIsLoading(false);
  }

  /** 新建对话（带人格选择） */
  async function handleCreateConversation(name: string, persona: string) {
    if (!window.electronAPI) return;
    const conv = await window.electronAPI.createConversation(name, persona);
    setConversations(await window.electronAPI.getConversations());
    setActiveConvId(conv.id);
    setMessages([]);
    const info = PERSONA_INFO[persona] || PERSONA_INFO.literary;
    const welcome: ChatMessage = {
      id: 'welcome-' + conv.id,
      role: 'bole',
      content: `你好，我是伯乐 🎵（${info.icon} ${info.label}）\n\n${info.desc}。\n\n从现在开始，我们就以这个身份聊天吧～直接输入歌名或随便聊聊都行！`,
      timestamp: nowISO(),
    };
    await persistMessage(welcome, conv.id);
    setShowNewConvModal(false);
  }

  /** 删除对话 */
  async function handleDeleteConversation(convId: string) {
    if (!window.electronAPI) return;
    const conv = conversations.find((c) => c.id === convId);
    const ok = window.confirm(`确定删除对话「${conv?.name || ''}」？该对话的所有消息将无法恢复。`);
    if (!ok) return;
    const delRes = await window.electronAPI.deleteConversation(convId);
    if (!delRes.success) {
      alert('⚠️ ' + (delRes.error || '删除失败'));
      return;
    }
    const convs = await window.electronAPI.getConversations();
    setConversations(convs);
    const nextId = await window.electronAPI.getActiveConversationId();
    setActiveConvId(nextId);
    await loadConversationMessages(nextId);
    setIsNearBottom(true);
    // 清理被删对话的滚动记忆
    delete chatScrollTopsRef.current[convId];
  }

  /** 当前对话的人格 */
  const activePersona = conversations.find((c) => c.id === activeConvId)?.persona || 'literary';

  /**
   * 统一视图切换：离开 chat 前同步保存滚动位置。
   * 注意：必须在 display:none 生效前读取（hidden 元素 scrollTop 恒为 0）
   * currentViewRef 避免 init 等早期注册的闭包捕获过期值
   */
  const currentViewRef = useRef<View>(currentView);
  currentViewRef.current = currentView;

  const navigateTo = (view: View) => {
    const cur = currentViewRef.current;
    if (cur === 'chat' && view !== 'chat') {
      const el = messagesContainerRef.current;
      if (el) chatScrollTopsRef.current[activeConvId] = el.scrollTop;
    }
    currentViewRef.current = view;
    setCurrentView(view);
  };

  /** 当前对话的用户提问列表（用于右侧导航栏） */
  const userMsgs = messages.filter((m) => m.role === 'user');

  // 消息变化（切换对话/新消息/删除）时：若 activeMsgId 已不在当前提问列表中，回到最新一条
  useEffect(() => {
    if (userMsgs.length === 0) {
      setActiveMsgId('');
    } else {
      setActiveMsgId((prev) => (userMsgs.some((m) => m.id === prev) ? prev : userMsgs[userMsgs.length - 1].id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, activeConvId]);

  // dash 列固定窗口滑动：可视区最多显示 VISIBLE_DASHES 条，当前粗体"—"保持在窗口中央
  useEffect(() => {
    const el = dashesRef.current;
    if (!el) return;
    const idx = userMsgs.findIndex((m) => m.id === activeMsgId);
    const itemH = 19; // 12px dash + 6px gap（active 14px，取均值）
    const K = 7; // 固定可见数量
    const N = userMsgs.length;
    if (idx === -1 || N === 0) {
      el.style.setProperty('--dash-shift', '0px');
      return;
    }
    // 让 active dash 位于窗口中央；clamp 到轨道范围内（N<=K 时贴顶无滑动）
    const target = (K * itemH) / 2 - (idx + 0.5) * itemH;
    const minShift = K * itemH - N * itemH; // 轨道底部不能高于窗口底部
    const maxShift = 0; // 轨道顶部不能低于窗口顶部
    const shift = Math.max(minShift, Math.min(maxShift, target));
    el.style.setProperty('--dash-shift', `${shift}px`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMsgId, userMsgs.length]);

  // 自动滚动：仅在用户靠近底部时跟随新消息
  useEffect(() => {
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isNearBottom]);

  // 聊天窗口滚动位置记忆（按对话保存）：
  // 离开聊天页/切换对话时保存该对话的位置；切回聊天页时恢复对应对话的位置
  const chatScrollTopsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (currentView === 'chat' && messagesLoaded) {
      const el = messagesContainerRef.current;
      if (!el) return;
      const saved = activeConvId ? chatScrollTopsRef.current[activeConvId] : null;
      if (saved != null) {
        // 切回：恢复该对话上次停留的位置
        el.scrollTop = saved;
        const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
        setIsNearBottom(dist < 80);
        calcActiveMsg();
      } else {
        // 首次进入（无记忆）：直接定位到最新消息
        el.scrollTop = el.scrollHeight;
        setIsNearBottom(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, messagesLoaded]);

  // 计算当前视口位置对应的用户消息（"—"粗体跟随）
  const calcActiveMsg = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    // 找视口上部区域（15%处）覆盖到的最后一条用户消息
    const threshold = el.scrollTop + el.clientHeight * 0.15;
    const msgEls = el.querySelectorAll<HTMLElement>('[data-message-id]');
    let lastUserMsgId: string | null = null;
    for (const msgEl of msgEls) {
      if (msgEl.offsetTop > threshold) break;
      if (msgEl.classList.contains('user')) {
        lastUserMsgId = msgEl.dataset.messageId || null;
      }
    }
    if (lastUserMsgId) setActiveMsgId(lastUserMsgId);
  };

  // 滚动停止后的确认回调（快速滚动结束时必捕获最终位置）
  const scrollConfirmRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 监听滚动位置：判断是否靠近底部 + 更新当前查看的用户消息
  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsNearBottom(distance < 80);

    // 节流：80ms 内只计算一次当前可见的用户消息
    const now = Date.now();
    if (now - lastScrollCalcRef.current < 80) {
      // 滚动停止后 200ms 再确认一次，保证最终位置被捕获
      if (scrollConfirmRef.current) clearTimeout(scrollConfirmRef.current);
      scrollConfirmRef.current = setTimeout(calcActiveMsg, 200);
      return;
    }
    lastScrollCalcRef.current = now;
    calcActiveMsg();
  };

  // 一键滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsNearBottom(true);
  };

  // 展开的导航列表跟随当前查看位置：active 项滚动到列表中央
  const scrollNavToActive = () => {
    const list = navListRef.current;
    if (!list) return;
    const activeEl = list.querySelector<HTMLElement>('.nav-sidebar-item.active');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'center', behavior: 'auto' });
    }
  };

  // activeMsgId 变化 → 等展开动画完成后再滚动定位（450ms）
  useEffect(() => {
    const t = setTimeout(scrollNavToActive, 450);
    return () => clearTimeout(t);
  }, [activeMsgId, userMsgs.length]);

  // 对话浏览栏：跳转到指定消息
  const jumpToMessage = (msgId: string) => {
    const el = document.querySelector<HTMLElement>(`[data-message-id="${msgId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setIsNearBottom(false);
      // 点击跳转 → 该提问的"—"立即变为粗体
      setActiveMsgId(msgId);
    }
  };

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
    // 用户自己发消息 → 强制回到底部
    setIsNearBottom(true);
    await persistMessage(userMsg);

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
                lyrics || undefined,
                activePersona
              );

              if (result.success && result.data) {
                const boleContent = formatAnalysis(result.data);
                const boleMsg: ChatMessage = {
                  id: generateId(), role: 'bole', content: boleContent, timestamp: nowISO(),
                };
                await persistMessage(boleMsg);

                // 日记
                const today = todayLocal();
                await window.electronAPI.addDiaryEntry({
                  date: today,
                  songs: [{ title: song.name, artist: song.artists.join('、'), time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }), note: '', genre: result.data.genre || '未知' }],
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

          // 推荐参考所有对话的消息（聚合用户全部听歌偏好）
          const allMsgs = await window.electronAPI.getAllMessages().catch(() => messages);
          const recentSongs = diaryEntriesFromMessages(allMsgs && allMsgs.length > 0 ? allMsgs : messages);

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
            await persistMessage(boleMsg);
          } else {
            throw new Error(result.error || '推荐失败');
          }
        } else if (isSongQuery) {
          // 尝试歌曲分析
          const result = await window.electronAPI.analyzeSong(text, undefined, undefined, activePersona);

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
            await persistMessage(boleMsg);

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
                  note: '',
                  genre: analysis.genre || '未知',
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

            const chatResult = await window.electronAPI.chat(history, text, activePersona);
            console.log('[app] Fallback chat result:', chatResult?.success, chatResult?.error?.slice(0, 50));
            if (chatResult.success && chatResult.data) {
              const boleMsg: ChatMessage = {
                id: generateId(), role: 'bole', content: chatResult.data, timestamp: nowISO(),
              };
              await persistMessage(boleMsg);
            } else {
              const errorMsg: ChatMessage = {
                id: generateId(), role: 'bole',
                content: `😅 ${chatResult.error || '出了点问题'}\n\n请确认：\n1. 去「设置」页面填入了正确的 API Key\n2. 网络连接正常`,
                timestamp: nowISO(),
              };
              await persistMessage(errorMsg);
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

          const result = await window.electronAPI.chat(history, text, activePersona);
          console.log('[app] Chat result:', result?.success, result?.error?.slice(0, 50));

          if (result.success && result.data) {
            const boleMsg: ChatMessage = {
              id: generateId(),
              role: 'bole',
              content: result.data,
              timestamp: nowISO(),
            };
            await persistMessage(boleMsg);
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
      await persistMessage(errorMsg);
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
      await persistMessage(userMsg);

      setIsLoading(true);
      try {
        const result = await window.electronAPI.analyzeSong(songName, artist, lyrics, activePersona);
        if (result.success && result.data) {
          const boleContent = formatAnalysis(result.data);
          const boleMsg: ChatMessage = {
            id: generateId(), role: 'bole', content: boleContent, timestamp: nowISO(),
          };
          await persistMessage(boleMsg);

          // 日记
          const today = todayLocal();
          await window.electronAPI.addDiaryEntry({
            date: today,
            songs: [{ title: songName, artist, time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }), note: '', genre: result.data.genre || '未知' }],
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
                await persistMessage(commentsMsg);
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
      <Sidebar
        conversations={conversations}
        currentView={currentView}
        activeConvId={activeConvId}
        appInfo={appInfo}
        onNavigate={(v) => navigateTo(v as View)}
        onSwitchConversation={handleSwitchConversation}
        onDeleteConversation={handleDeleteConversation}
        onOpenNewConversation={() => setShowNewConvModal(true)}
      />

      {/* 主内容区 */}
      <main className="main">
        <header className="topbar">
          <div className="topbar-title">
            {currentView === 'chat' && activeConvId
              ? (() => {
                  const c = conversations.find((x) => x.id === activeConvId);
                  const pi = PERSONA_INFO[c?.persona || 'literary'];
                  return c ? `${c.name}${pi ? ` · ${pi.icon} ${pi.label}` : ''}` : VIEW_TITLES.chat;
                })()
              : VIEW_TITLES[currentView]}
          </div>
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
            history={messages.slice(-30).map((m) => ({ role: m.role, content: m.content }))}
            onAnalyzed={async (content) => {
              const boleMsg: ChatMessage = {
                id: generateId(), role: 'bole', content, timestamp: nowISO(),
              };
              setIsNearBottom(true);
              await persistMessage(boleMsg);
            }}
          />
        )}
        {showHumming && (
          <HummingRecorder
            onClose={() => setShowHumming(false)}
            onResult={(title, artist) => {
              // 识别成功 → 创建确认卡片消息（用户确认后才分析），不再填输入框
              setShowHumming(false);
              const detectMsg: ChatMessage = {
                id: generateId(),
                role: 'user',
                content: `🎤 哼歌识别到：${title} — ${artist || ''}`,
                timestamp: nowISO(),
                meta: {
                  type: 'song_detected',
                  songTitle: title,
                  songArtist: artist || '',
                  confirmed: false,
                },
              };
              persistMessage(detectMsg);
            }}
          />
        )}

        {/* 新建对话 Modal */}
        <NewConversationModal
          isOpen={showNewConvModal}
          onClose={() => setShowNewConvModal(false)}
          onCreate={handleCreateConversation}
          defaultPersona={defaultPersona}
        />

        {/* 三个页面常驻挂载（display:none 切换），滚动位置天然保留 */}
        <div className="page-holder" style={{ display: currentView === 'report' ? undefined : 'none' }}>
          <ReportPage />
        </div>
        <div className="page-holder" style={{ display: currentView === 'diary' ? undefined : 'none' }}>
          <DiaryPage />
        </div>
        <div className="page-holder" style={{ display: currentView === 'settings' ? undefined : 'none' }}>
          <SettingsPage />
        </div>

        {/* chat 视图常驻挂载（display:none 切换），滚动位置在切换视图时保留 */}
        <div className="chat-layout" style={{ display: currentView === 'chat' ? undefined : 'none' }}>
            <div className="chat-main">
            <div className="messages-container" ref={messagesContainerRef} onScroll={handleScroll}>
              {messages.map((msg) => (
                <div key={msg.id} data-message-id={msg.id} className={`message ${msg.role}`}>
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
                          await handleConfirmSong(msg, title, artist, setMessages, messages, activeConvId);
                        }}
                        onIgnore={async () => {
                          await handleIgnoreSong(msg, setMessages, messages, activeConvId);
                        }}
                      />
                    ) : (
                      <>
                        <div
                          className="message-text"
                          // 用 Markdown 渲染消息内容（agent 输出的 ###/*** 等符号变成好看的排版）
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(msg.content), { USE_PROFILES: { html: true } }) }}
                        />
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

            {/* 一键滚动到底按钮 */}
            {!isNearBottom && (
              <button
                className="scroll-to-bottom-btn"
                onClick={scrollToBottom}
                title="回到底部"
              >
                ↓
              </button>
            )}

            <div className="input-area">
              <div className="input-wrapper">
                <button className="search-toggle-btn" onClick={() => setShowSearch(true)} title="搜索歌曲" data-tip="🔍 搜索歌曲">🔍</button>
                <button className="search-toggle-btn" onClick={() => setShowPlaylist(true)} title="导入歌单" data-tip="📋 导入歌单">📋</button>
                <button className="search-toggle-btn" onClick={() => setShowHumming(true)} title="哼歌识别" data-tip="🎤 哼歌识别">🎤</button>
                <button
                  className={`search-toggle-btn ${isListening ? 'listening-active' : ''}`}
                  onClick={handleToggleCapture}
                  title={isListening ? '停止音频采集' : '音频采集（需先在设置中允许）'}
                  data-tip={isListening ? '🎧 停止采集' : '🎧 音频采集'}
                >🎧</button>
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
                <div className={`listening-hint ${audioLevel > 0.02 ? 'has-sound' : 'no-sound'}`}>
                  {audioLevel > 0.02 ? (
                    <>
                      <span className="wave-bars">
                        {Array.from({ length: 12 }, (_, i) => (
                          <span
                            key={i}
                            ref={(el) => { waveBarsRef.current[i] = el; }}
                            className="wave-bar"
                            style={{ height: '8%' }}
                          />
                        ))}
                      </span>
                      🎧 正在监听系统音频
                    </>
                  ) : (
                    <>⚠️ 未检测到声音——请播放音乐（正在采集，等待音频...）</>
                  )}
                </div>
              )}
              <div className="input-hint">
                💡 随便聊天 ｜ 说「搜索 + 歌名」查歌 ｜ 自动检测到的歌曲会主动分析
              </div>
            </div>
            </div>

            {/* 对话导航栏：右侧透明细条"—"= 当前对话的每条用户提问，悬停展开提问列表（DeepSeek风格） */}
            <div className="nav-sidebar" onMouseEnter={scrollNavToActive}>
              {/* 收起态：一列"—"，每条对应当前对话的一个用户提问，当前查看的提问粗体高亮；像标尺一样滑动跟随 */}
              <div className="nav-sidebar-dashes" ref={dashesRef}>
                <div className="nav-dash-track">
                  {userMsgs.map((m) => (
                    <div
                      key={m.id}
                      className={`nav-dash ${m.id === activeMsgId ? 'active' : ''}`}
                      title={stripMarkdown(m.content)}
                      onClick={() => jumpToMessage(m.id)}
                    >—</div>
                  ))}
                </div>
              </div>
              {/* 展开态：当前对话的用户提问列表 */}
              <div className="nav-sidebar-header">
                📜 对话记录（{userMsgs.length}）
              </div>
              <div className="nav-sidebar-list" ref={navListRef}>
                {userMsgs.length === 0 ? (
                  <div className="nav-sidebar-empty">还没有对话记录</div>
                ) : (
                  userMsgs.map((m, i) => (
                    <button
                      key={m.id}
                      className={`nav-sidebar-item ${m.id === activeMsgId ? 'active' : ''}`}
                      onClick={() => jumpToMessage(m.id)}
                      title={stripMarkdown(m.content)}
                    >
                      <span className="nav-index">{i + 1}</span>
                      <span>{stripMarkdown(m.content)}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
            </div>
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
  // 包含问号或疑问语气词（吗/么/呢）→ 聊天
  if (/[?？]|吗$|么$|呢$/.test(text)) return false;
  // 常见聊天寒暄词 → 不走歌曲查询
  if (/^(你好|嗨|哈|嘿嘿|哈哈|嗯|哦|好|谢谢|再见|在吗|早|晚安|早安|午安|hello|hi|hey)/i.test(text)) return false;
  // 象声词/语气词重复（喵喵喵、呜呜呜、哒哒哒、哇哇哇、呃呃呃...）→ 聊天
  if (/^([哈嘿嗯哦啊哇呀哎哼噗嘻呵呜喵咩哒噜嘤咯呃噫哟嘛]+)\1+$/u.test(text)) return false;
  // 常见随意词/网络梗 → 聊天（哈吉米、哇塞、天哪、666...）
  if (/^(哈吉米|哇塞|天哪|666|啊这|乌鸡鲅鱼|栓q|芭比q|笑死|绝了|emm+|呃+)$/i.test(text)) return false;
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
  messages: ChatMessage[],
  convId: string
) {
  // 标记为已确认
  setMessages(prev => prev.map(m =>
    m.id === msg.id ? { ...m, meta: { ...m.meta, songTitle: title, songArtist: artist, confirmed: true }, content: `🎧 检测到：${title} — ${artist}` } : m
  ));
  if (window.electronAPI) {
    await window.electronAPI.addMessageToConversation(convId, { ...msg, meta: { ...msg.meta, songTitle: title, songArtist: artist, confirmed: true }, content: `🎧 检测到：${title} — ${artist}` });
  }

  // 调用 AI 分析
  try {
    const analysis = await window.electronAPI!.analyzeSong(title, artist, undefined, activePersona);
    if (analysis.success && analysis.data) {
      const boleMsg: ChatMessage = { id: generateId(), role: 'bole', content: formatAnalysis(analysis.data), timestamp: nowISO() };
      setMessages(prev => [...prev, boleMsg]);
      await window.electronAPI!.addMessageToConversation(convId, boleMsg);
    } else {
      const hintMsg: ChatMessage = { id: generateId(), role: 'bole', content: `🎵 ${title} — ${artist}\n\n识别成功！去「设置」页面配置 DeepSeek API Key 即可开启 AI 分析。`, timestamp: nowISO() };
      setMessages(prev => [...prev, hintMsg]);
      await window.electronAPI!.addMessageToConversation(convId, hintMsg);
    }
  } catch {}
}

async function handleIgnoreSong(
  msg: ChatMessage,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  messages: ChatMessage[],
  convId: string
) {
  setMessages(prev => prev.filter(m => m.id !== msg.id));
  if (window.electronAPI) {
    await window.electronAPI.deleteMessageFromConversation(convId, msg.id).catch(() => {});
  }
}

/** 去除 Markdown 符号，用于导航栏等纯文本展示 */
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^[-*_]\s+/gm, '')
    .replace(/^---+$/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

function getMockReply(input: string): string {
  return `🎵 关于「${input}」的分析（离线模式）...

这是一首动人的歌曲。在离线模式下我无法进行真正的 AI 分析。

请在 Electron 环境中运行并配置 API Key 以获得真实的音乐分析体验。`;
}
