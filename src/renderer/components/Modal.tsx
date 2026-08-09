/**
 * 伯乐模拟器 - 共享弹窗组件
 *
 * 提取 SearchSongs / PlaylistImport / HummingRecorder 共用的
 * overlay + panel + header 结构，减少重复代码。
 */

import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: number;
}

export default function Modal({ isOpen, onClose, title, children, maxWidth }: ModalProps) {
  if (!isOpen) return null;

  console.log('[modal] rendered, title:', typeof title === 'string' ? title : 'jsx');

  return (
    <div className="search-overlay" onClick={onClose}>
      <div
        className="search-panel"
        onClick={(e) => e.stopPropagation()}
        style={maxWidth ? { maxWidth } : undefined}
      >
        {title && (
          <div className="search-header">
            <span>{title}</span>
            <button className="search-close-btn" onClick={onClose}>✕</button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}