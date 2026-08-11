/**
 * 伯乐模拟器 - 左侧边栏（独立组件）
 *
 * 收起/展开动画由 Framer Motion（motion/react）驱动：
 * - 容器宽度/内边距数值动画（motion.aside）
 * - 文字元素 width+opacity 揭幕动画（单行裁剪，永不竖排/跳变）
 * - 图标 layout FLIP 平滑居中（弹性缓动，收起展开灵动顺滑）
 * 收起/展开状态在组件内部管理——toggle 只触发本组件重渲染。
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';

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

// 缓动曲线
const EASE_OUT = [0.22, 1, 0.36, 1] as [number, number, number, number]; // 先快后慢，收尾干脆
const EASE_IN = [0.55, 0, 1, 0.45] as [number, number, number, number]; // 淡出：先慢后快
const EASE_SPRING = [0.34, 1.56, 0.64, 1] as [number, number, number, number]; // 轻微过冲回弹（灵动）

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

  // 错峰编排：
  // 展开时图标先动、文字稍后揭幕（快速利落）；
  // 收起时文字先慢速卷走（宽度 0.5s）+ 缓速淡出（延迟 0.12s 起，先慢后快），图标稍后归位
  const textTransition = {
    width: {
      duration: collapsed ? 0.5 : 0.34,
      delay: collapsed ? 0 : 0.05,
      ease: EASE_OUT,
    },
    opacity: {
      duration: collapsed ? 0.45 : 0.3,
      delay: collapsed ? 0.12 : 0.05,
      ease: collapsed ? EASE_IN : EASE_OUT,
    },
  };
  const iconTransition = {
    duration: 0.4,
    delay: collapsed ? 0.12 : 0,
    ease: EASE_SPRING,
  };

  // 文字元素的统一动画目标（收起=宽度0+透明，展开=内容宽+可见）
  const textAnimate = { width: collapsed ? 0 : 'auto', opacity: collapsed ? 0 : 1 } as const;

  return (
    <motion.aside
      className={`sidebar ${collapsed ? 'collapsed' : ''}`}
      animate={{
        width: collapsed ? 60 : 240,
        paddingLeft: collapsed ? 8 : 16,
        paddingRight: collapsed ? 8 : 16,
      }}
      transition={{ duration: 0.35, ease: EASE_OUT }}
    >
      <div className="sidebar-header">
        <motion.span layout className="logo" transition={iconTransition}>🐴</motion.span>
        <h1>
          <motion.span className="sidebar-title" animate={textAnimate} transition={textTransition}>
            伯乐模拟器
          </motion.span>
        </h1>
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
              <motion.span layout className="conv-icon" transition={iconTransition}>
                {pInfo.icon}
              </motion.span>
              <span className="conv-name">
                <motion.span className="conv-name-text" animate={textAnimate} transition={textTransition}>
                  {conv.name}
                </motion.span>
              </span>
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
        <motion.span layout className="new-conv-icon" transition={iconTransition}>＋</motion.span>
        <motion.span className="new-conv-label" animate={textAnimate} transition={textTransition}>
          新建对话
        </motion.span>
      </button>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.view}
            className={`nav-item ${currentView === item.view ? 'active' : ''}`}
            onClick={() => onNavigate(item.view)}
          >
            <motion.span layout className="nav-icon" transition={iconTransition}>{item.icon}</motion.span>
            <motion.span className="nav-label" animate={textAnimate} transition={textTransition}>{item.label}</motion.span>
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
    </motion.aside>
  );
}
