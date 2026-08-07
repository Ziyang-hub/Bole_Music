/**
 * 伯乐模拟器 - 主应用组件
 *
 * 这是整个应用的根组件，包含应用的总体布局和状态管理
 */

import React, { useState, useEffect, useRef } from 'react';

// 类型定义
interface Message {
  id: string;
  role: 'user' | 'bole';  // bole = 伯乐（AI）
  content: string;
  timestamp: Date;
}

interface AppInfo {
  name: string;
  version: string;
  platform: string;
  electronVersion: string;
  nodeVersion: string;
}

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * 应用主组件
 */
export default function App() {
  // ----- 状态管理 -----

  // 对话消息列表
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'bole',
      content: '你好，我是伯乐 🎵\n\n我是你的AI音乐知音。当你听到一首好歌，输入歌名告诉我，我来帮你分析和品味。\n\n比如你可以试试输入：「周杰伦 晴天」 或者 「Coldplay Yellow」',
      timestamp: new Date(),
    },
  ]);

  // 输入框内容
  const [inputValue, setInputValue] = useState('');

  // 是否正在加载（等待AI回复）
  const [isLoading, setIsLoading] = useState(false);

  // 应用信息
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);

  // 消息列表的引用，用于自动滚动
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ----- 初始化 -----

  useEffect(() => {
    // 从 Electron 主进程获取应用信息
    if (window.electronAPI) {
      window.electronAPI.getAppInfo().then(setAppInfo);
    }
  }, []);

  // 新消息时自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ----- 处理发送消息 -----

  async function handleSend() {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    // 清空输入框
    setInputValue('');

    // 添加用户消息
    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // 开始加载
    setIsLoading(true);

    try {
      // TODO: 这里后续接入真实的 AI API
      // 目前使用模拟回复来展示界面效果
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const boleMsg: Message = {
        id: generateId(),
        role: 'bole',
        content: getMockReply(text),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, boleMsg]);
    } catch (error) {
      const errorMsg: Message = {
        id: generateId(),
        role: 'bole',
        content: '抱歉，分析过程中出现了一些问题。请稍后再试 🙏',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }

  // ----- 键盘事件 -----

  function handleKeyDown(e: React.KeyboardEvent) {
    // Enter 发送，Shift+Enter 换行
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ----- 渲染 -----

  return (
    <div className="app">
      {/* 侧边栏 */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">🐴</div>
          <h1>伯乐模拟器</h1>
        </div>

        <nav className="sidebar-nav">
          <button className="nav-item active">
            <span className="nav-icon">💬</span>
            <span>知音对话</span>
          </button>
          <button className="nav-item" disabled>
            <span className="nav-icon">📊</span>
            <span>听歌报告</span>
          </button>
          <button className="nav-item" disabled>
            <span className="nav-icon">📝</span>
            <span>听歌日记</span>
          </button>
          <button className="nav-item" disabled>
            <span className="nav-icon">⚙️</span>
            <span>设置</span>
          </button>
        </nav>

        {/* 底部应用信息 */}
        {appInfo && (
          <div className="sidebar-footer">
            <span>v{appInfo.version}</span>
          </div>
        )}
      </aside>

      {/* 主内容区 */}
      <main className="main">
        {/* 顶部状态栏 */}
        <header className="topbar">
          <div className="topbar-title">知音对话</div>
          <div className="topbar-status">
            <span className="status-dot"></span>
            <span>在线</span>
          </div>
        </header>

        {/* 消息区域 */}
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
                  {msg.timestamp.toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          ))}

          {/* 加载动画 */}
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

          {/* 自动滚动锚点 */}
          <div ref={messagesEndRef} />
        </div>

        {/* 底部输入区 */}
        <div className="input-area">
          <div className="input-wrapper">
            <textarea
              className="input-field"
              placeholder="输入歌名或想说的话... (Enter 发送，Shift+Enter 换行)"
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
            💡 试试输入：周杰伦 晴天 ｜ Coldplay Yellow ｜ 推荐一首开心的歌
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * 模拟 AI 回复（后续替换为真实 AI API 调用）
 */
function getMockReply(input: string): string {
  const replies = [
    `🎵 让我来分析一下「${input}」...

这是一首非常动人的歌曲。从旋律上看，它的编曲层次丰富，前奏的钢琴引子营造了温柔的氛围，随后加入的弦乐让情感层层递进。

歌词方面，它讲述了一个关于时光和回忆的故事。歌者用细腻的笔触描绘了那些微小而珍贵的瞬间，让人不禁想起自己的经历。

你觉得这首歌最打动你的是哪个部分？是旋律、歌词，还是它唤起的某个回忆？`,

    `听完「${input}」，我有一些感悟想和你分享...

这首歌的节奏很有特点，BPM大约在90左右，属于中速歌曲。这种节奏既不会太急促，也不会太拖沓，恰好适合表达一种深沉的思考状态。

我注意到歌曲中反复出现的意象——「路」和「远方」，这似乎暗示着歌者内心的某种追寻。也许是对自由的向往，也许是对过去的释怀。

你有这样的感受吗？`,

    `关于「${input}」，让我换个角度来聊聊...

这首歌的制作水准很不错。人声的处理非常自然，没有过多的修音痕迹，保留了歌手声音中的质感和情感。混音也很干净，每个乐器的位置都很清晰。

从风格上来说，它融合了流行和民谣的元素，这类风格近几年的受众越来越广。如果你喜欢这首歌，可能也会喜欢一些独立民谣歌手的作品。

想让我推荐一些类似风格的歌曲吗？`,
  ];

  return replies[Math.floor(Math.random() * replies.length)];
}
