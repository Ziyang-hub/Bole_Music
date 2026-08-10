/**
 * 伯乐模拟器 - 左侧边栏（独立组件）
 *
 * 收起/展开状态在组件内部管理——toggle 只触发本组件重渲染，
 * 避免整个 App 重渲染阻塞 CSS 过渡（文字"跳出来"的根因）。
 */

import React, { useState, useRef, useEffect } from 'react';

interface Props {
  conversations: Conversation[];
  currentView: string;
  activeConvId: string;
  appInfo: any;
  onNavigate: (view: string) => void;
  onSwitchConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onOpenNewConversation: () => void;
}

const NAV_ITEMS: { view: string; icon: string; label: string }[] = [
  { view: 'report', icon: '📊', label: '听歌报告' },
  { view: 'diary', icon: '📝', label: '听歌日记' },
  { view: 'settings', icon: '⚙️', label: '设置' },
];

const PERSONA_INFO: Record<string, { icon: string; label: string; desc: string }> = {
  literary: { icon: '🖋️', label: '文学诗人', desc: '敏感细腻，用诗意解读音乐' },
  professional: { icon: '🎙️', label: '专业乐评', desc: '从业十五年，专业不失温度' },
  warm: { icon: '💛', label: '温暖挚友', desc: '最懂你也最懂音乐的好朋友' },
  humorous: { icon: '😎', label: '幽默发烧友', desc: '三千张黑胶，一肚子音乐段子' },
};

export default function Sidebar({
  conversations,
  currentView,
  activeConvId,
  appInfo,
  onNavigate,
  onSwitchConversation,
  onDeleteConversation,
  onOpenNewConversation,
}: Props) {
  // 收起/展开状态：组件内部管理（App 不重渲染，过渡流畅）
  const [collapsed, setCollapsed] = useState(false);

  // 精确文字宽度（展开态测量）——max-width 动画范围=文字实际宽度，与图标移动严格同步
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const navTextRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [h1Width, setH1Width] = useState(0);
  const [navWidths, setNavWidths] = useState<number[]>([]);

  useEffect(() => {
    // 初始展开态测量一次（无 max-width 限制时文字完整，offsetWidth 精确）
    setH1Width(h1Ref.current?.offsetWidth || 0);
    setNavWidths(navTextRefs.current.map((el) => el?.offsetWidth || 0));
  }, []);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="logo">🐴</div>
        <h1
          ref={h1Ref}
          style={h1Width ? { maxWidth: collapsed ? 0 : h1Width } : undefined}
        >伯乐模拟器</h1>
      </div>

      {/* 对话列表 */}
      <div className="sidebar-section-label">💬 知音对话</div>
      <nav className="conversation-list">
        {conversations.map((conv) => {
          const pInfo = PERSONA_INFO[conv.persona] || PERSONA_INFO.literary;
          const isActive = currentView === 'chat' && conv.id === activeConvId;
          return (
            <div
              key={conv.id}
              className={`conv-item ${isActive ? 'active' : ''}`}
              onClick={() => {
                onNavigate('chat');
                onSwitchConversation(conv.id);
              }}
              title={`${conv.name} · ${pInfo.label}`}
            >
              <span className="conv-icon">{pInfo.icon}</span>
              <span className="conv-name">{conv.name}</span>
              <span className="conv-msg-count">{conv.messages.length}</span>
              <button
                className="conv-delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteConversation(conv.id);
                }}
                title="删除对话"
              >×</button>
            </div>
          );
        })}
      </nav>
      <button
        className="new-conv-btn"
        onClick={onOpenNewConversation}
      >
        ＋ 新建对话
      </button>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item, i) => (
          <button
            key={item.view}
            className={`nav-item ${currentView === item.view ? 'active' : ''}`}
            onClick={() => onNavigate(item.view)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span
              ref={(el) => { navTextRefs.current[i] = el; }}
              style={navWidths[i] ? { maxWidth: collapsed ? 0 : navWidths[i] } : undefined}
            >{item.label}</span>
          </button>
        ))}
      </nav>

      {appInfo && (
        <div className="sidebar-footer">
          <span>v{appInfo.version}</span>
        </div>
      )}

      {/* 收起/展开按钮（置于侧边栏底部） */}
      <button
        className="sidebar-toggle-btn"
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? '展开侧边栏' : '收起侧边栏'}
      >
        {collapsed ? '» 展开' : '« 收起'}
      </button>
    </aside>
  );
}
