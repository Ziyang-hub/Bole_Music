/**
 * 伯乐模拟器 - 搜索歌曲组件
 *
 * 在应用内搜索歌曲，支持：
 * - 关键词搜索（调用网易云音乐 API）
 * - 搜索结果列表展示
 * - 点击选择歌曲进行分析
 */

import React, { useState } from 'react';

interface Props {
  onSelect: (songName: string, artist: string, lyrics?: string) => void;
  onClose: () => void;
}

export default function SearchSongs({ onSelect, onClose }: Props) {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<SongInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [loadingLyrics, setLoadingLyrics] = useState<string | null>(null);

  async function handleSearch() {
    const kw = keyword.trim();
    if (!kw || !window.electronAPI) return;

    setSearching(true);
    setSearched(true);

    try {
      const result = await window.electronAPI.searchSongs(kw, 10);
      if (result.success && result.data) {
        setResults(result.data);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    }

    setSearching(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSearch();
  }

  async function handleSelect(song: SongInfo) {
    if (!window.electronAPI) return;

    // 尝试获取歌词
    let lyrics: string | undefined;
    if (song.platform === 'netease') {
      setLoadingLyrics(song.id);
      try {
        const lrc = await window.electronAPI.getLyrics(song.id);
        if (lrc.success && lrc.data) {
          lyrics = lrc.data;
        }
      } catch {
        // 获取歌词失败不影响主流程
      }
      setLoadingLyrics(null);
    }

    const artist = song.artists.join('、');
    onSelect(song.name, artist, lyrics);
  }

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-panel" onClick={(e) => e.stopPropagation()}>
        <div className="search-header">
          <span>🔍 搜索歌曲</span>
          <button className="search-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="search-input-row">
          <input
            className="search-input"
            placeholder="输入歌名或歌手..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <button
            className="search-btn"
            onClick={handleSearch}
            disabled={searching || !keyword.trim()}
          >
            {searching ? '搜索中...' : '搜索'}
          </button>
        </div>

        <div className="search-results">
          {!searched && (
            <div className="search-hint">
              <p>💡 输入关键词搜索歌曲，比如「晴天」「周杰伦」</p>
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
                也支持直接粘贴网易云歌曲链接
              </p>
            </div>
          )}

          {searching && (
            <div className="search-loading">⏳ 搜索中...</div>
          )}

          {searched && !searching && results.length === 0 && (
            <div className="search-empty">😕 没有找到相关歌曲，换个关键词试试</div>
          )}

          {results.map((song) => (
            <div
              key={song.id}
              className="search-result-item"
              onClick={() => handleSelect(song)}
            >
              {song.album?.picUrl ? (
                <img className="search-album-cover" src={song.album.picUrl} alt="" />
              ) : (
                <div className="search-album-placeholder">🎵</div>
              )}
              <div className="search-song-info">
                <div className="search-song-name">
                  {song.name}
                  {loadingLyrics === song.id && (
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 8 }}>
                      ⏳ 获取歌词...
                    </span>
                  )}
                </div>
                <div className="search-song-artist">{song.artists.join(' / ')}</div>
                {song.album && (
                  <div className="search-song-album">{song.album.name}</div>
                )}
              </div>
              <div className="search-song-platform">
                {song.platform === 'netease' ? '🔴 网易云' : song.platform === 'qq' ? '🟢 QQ' : ''}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
