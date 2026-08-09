/**
 * 伯乐模拟器 - 歌单导入组件
 *
 * 粘贴网易云歌单链接 → 获取歌曲列表 → 整体AI分析（一次分析整个歌单）
 */

import React, { useState } from 'react';
import Modal from './Modal';

interface Props {
  onClose: () => void;
  onAnalyzed: (boleContent: string) => void;
  /** 用户最近的对话历史，用于整体分析时提取用户风格 */
  history?: { role: string; content: string }[];
}

export default function PlaylistImport({ onClose, onAnalyzed, history }: Props) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [playlist, setPlaylist] = useState<{ name: string; songs: SongInfo[] } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  async function handleFetch() {
    if (!window.electronAPI) return;
    console.log('[playlist] fetching:', url.trim());
    setLoading(true);
    try {
      const result = await window.electronAPI.getPlaylist(url.trim());
      if (result.success && result.data) {
        setPlaylist(result.data);
        console.log('[playlist] loaded:', result.data.name, result.data.songs.length, 'songs');
      } else {
        alert('获取歌单失败：' + (result.error || '未知错误'));
      }
    } catch {
      alert('获取歌单失败');
    }
    setLoading(false);
  }

  async function handleAnalyzeWhole() {
    if (!window.electronAPI || !playlist) return;
    console.log('[playlist] analyzing whole playlist:', playlist.name, playlist.songs.length, 'songs');
    setAnalyzing(true);
    try {
      const songs = playlist.songs.map((s) => ({ name: s.name, artist: s.artists.join('、') }));
      const r = await window.electronAPI.analyzePlaylist(playlist.name, songs, history);
      if (r.success && r.data) {
        onAnalyzed(r.data);
      } else {
        alert('分析失败：' + (r.error || '未知错误'));
      }
      window.electronAPI.trackUsage('playlist_import', { count: songs.length });
    } catch (e: any) {
      alert('分析失败：' + (e?.message || e));
    }
    setAnalyzing(false);
  }

  return (
    <Modal isOpen={true} onClose={onClose} title="📋 导入歌单" maxWidth={600}>
      {!playlist ? (
        <div className="playlist-body">
          <p className="playlist-hint">
            粘贴网易云歌单链接，比如：<br />
            <code>https://music.163.com/playlist?id=3778678</code>
          </p>
          <div className="search-input-row playlist-input-row">
            <input className="search-input" placeholder="粘贴歌单链接..."
              value={url} onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFetch()} autoFocus />
            <button className="search-btn" onClick={handleFetch} disabled={loading || !url.trim()}>
              {loading ? '获取中...' : '获取歌单'}
            </button>
          </div>
        </div>
      ) : (
        <div className="playlist-body">
          <div className="playlist-title-row">
            🎵 {playlist.name}
            <span className="playlist-song-count">{playlist.songs.length} 首歌</span>
          </div>

          {analyzing && (
            <div className="playlist-progress-box">
              ⏳ 正在整体分析歌单...（约需 10-30 秒，请稍候）
            </div>
          )}

          <div className="playlist-song-list">
            {playlist.songs.slice(0, 50).map((song, i) => (
              <div key={i} className="playlist-song-row">
                <span className="playlist-song-index">{i + 1}</span>
                <span className="playlist-song-name">{song.name}</span>
                <span className="playlist-song-artist">
                  {song.artists.join(' / ')}
                </span>
              </div>
            ))}
            {playlist.songs.length > 50 && (
              <p className="playlist-overflow-hint">
                还有 {playlist.songs.length - 50} 首...（仅显示前50首）
              </p>
            )}
          </div>

          <div className="playlist-actions">
            <button className="search-btn" onClick={handleAnalyzeWhole} disabled={analyzing}>
              {analyzing ? '分析中...' : '🤖 整体分析歌单'}
            </button>
            <button className="report-export-btn" onClick={() => setPlaylist(null)}>
              返回
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
