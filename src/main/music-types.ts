/**
 * 伯乐模拟器 - 音乐平台类型定义
 * 主进程和渲染进程共享
 */

export interface SongInfo {
  id: string;
  name: string;
  artists: string[];
  album?: {
    name: string;
    picUrl?: string;
  };
  duration?: number;
  platform: 'netease' | 'qq' | 'unknown';
}
