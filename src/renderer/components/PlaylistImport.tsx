/**
 * 伯乐模拟器 - 歌单导入组件
 *
 * 粘贴网易云歌单链接 → 获取歌曲列表 → 逐个AI分析
 */

import React, { useState } from 'react';

interface Props {
  onClose: () => void;
  onSongAnalyzed: (songName: string, artist: string, boleContent: string) => void;
}

export default function PlaylistImport({ onClose, onSongAnalyzed }: Props) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [playlist, setPlaylist] = useState<{ name: string; songs: SongInfo[] } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<{ name: string; artist: string; done: boolean; error?: string }[]>([]);

  async function handleFetch() {
    if (!window.electronAPI) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.getPlaylist(url.trim());
      if (result.success && result.data) {
        setPlaylist(result.data);
      } else {
        alert('获取歌单失败：' + (result.error || '未知错误'));
      }
    } catch {
      alert('获取歌单失败');
    }
    setLoading(false);
  }

  async function handleAnalyzeAll() {
    if (!window.electronAPI || !playlist) return;
    setAnalyzing(true);
    const songs = playlist.songs.map((s) => ({ name: s.name, artist: s.artists.join('、') }));
    setResults(songs.map((s) => ({ ...s, done: false })));

    // 逐个分析（避免 API 限流）
    for (let i = 0; i < songs.length; i++) {
      const song = songs[i];
      try {
        const r = await window.electronAPI.analyzeSong(song.name, song.artist);
        if (r.success && r.data) {
          onSongAnalyzed(song.name, song.artist, formatAnalysisShort(r.data));
        }
        setResults((prev) => prev.map((s, j) => j === i ? { ...s, done: true } : s));
      } catch {
        setResults((prev) => prev.map((s, j) => j === i ? { ...s, done: true, error: '失败' } : s));
      }
      setProgress({ current: i + 1, total: songs.length });
      // 避免请求过快
      await new Promise((r) => setTimeout(r, 500));
    }
    setAnalyzing(false);

    // 追踪
    if (window.electronAPI) {
      window.electronAPI.trackUsage('playlist_import', { count: songs.length });
    }
  }

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="search-header">
          <span>📋 导入歌单</span>
          <button className="search-close-btn" onClick={onClose}>✕</button>
        </div>

        {!playlist ? (
          <div style={{ padding: 20 }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              粘贴网易云歌单链接，比如：<br />
              <code>https://music.163.com/playlist?id=3778678</code>
            </p>
            <div className="search-input-row" style={{ padding: 0, border: 'none' }}>
              <input className="search-input" placeholder="粘贴歌单链接..."
                value={url} onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFetch()} autoFocus />
              <button className="search-btn" onClick={handleFetch} disabled={loading || !url.trim()}>
                {loading ? '获取中...' : '获取歌单'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              🎵 {playlist.name}
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                {playlist.songs.length} 首歌
              </span>
            </div>

            {analyzing && (
              <div style={{
                padding: 8, marginBottom: 12, background: 'var(--color-accent-bg)',
                borderRadius: 8, fontSize: 12, color: 'var(--color-accent-light)',
              }}>
                ⏳ 分析中... {progress.current}/{progress.total}
                <div style={{
                  height: 4, background: 'var(--color-bg-tertiary)', borderRadius: 2, marginTop: 6,
                }}>
                  <div style={{
                    height: '100%', background: 'var(--color-accent)', borderRadius: 2,
                    width: `${(progress.current / progress.total) * 100}%`,
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>
            )}

            <div style={{ maxHeight: 400, overflow: 'auto' }}>
              {playlist.songs.slice(0, 50).map((song, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                  borderBottom: '1px solid var(--color-border)', fontSize: 13,
                }}>
                  <span style={{ color: 'var(--text-muted)', width: 24 }}>{i + 1}</span>
                  <span style={{ flex: 1 }}>{song.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {song.artists.join(' / ')}
                  </span>
                  {results[i]?.done && <span>✅</span>}
                  {results[i]?.error && <span>❌</span>}
                </div>
              ))}
              {playlist.songs.length > 50 && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>
                  还有 {playlist.songs.length - 50} 首...（仅显示前50首）
                </p>
              )}
            </div>

            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button className="search-btn" onClick={handleAnalyzeAll} disabled={analyzing}>
                {analyzing ? '分析中...' : '🤖 批量分析全部'}
              </button>
              <button className="report-export-btn" onClick={() => { setPlaylist(null); setResults([]); }}>
                返回
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatAnalysisShort(a: SongAnalysis): string {
  return `🎵 **${a.songName}** — ${a.artist}\n💗 ${a.emotion || ''}\n🎼 ${a.genre || ''}\n💭 ${a.personalThought?.slice(0, 200) || ''}`;
}
