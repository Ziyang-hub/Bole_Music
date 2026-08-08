/**
 * 伯乐模拟器 - 搜索歌曲组件
 * 支持「加载更多」分页
 */

import React, { useState } from 'react';

interface Props {
  onSelect: (songName: string, artist: string, lyrics?: string) => void;
  onClose: () => void;
}

const PAGE_SIZE = 20;

export default function SearchSongs({ onSelect, onClose }: Props) {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<SongInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [loadingLyrics, setLoadingLyrics] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  async function handleSearch(resetOffset = true) {
    const kw = keyword.trim();
    if (!kw || !window.electronAPI) return;

    setSearching(true);
    setSearched(true);

    try {
      const newOffset = resetOffset ? 0 : offset;
      const result = await (window.electronAPI as any).searchSongs(kw, PAGE_SIZE, newOffset);
      if (result.success && result.data) {
        const songs = result.data as SongInfo[];
        if (resetOffset) {
          setResults(songs);
          setOffset(PAGE_SIZE);
        } else {
          setResults(prev => [...prev, ...songs]);
          setOffset(prev => prev + PAGE_SIZE);
        }
        setHasMore(songs.length >= PAGE_SIZE);
      }
    } catch {
      if (resetOffset) setResults([]);
    }

    setSearching(false);
    setLoadingMore(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { setOffset(0); handleSearch(true); }
  }

  function handleLoadMore() {
    setLoadingMore(true);
    handleSearch(false);
  }

  async function handleSelect(song: SongInfo) {
    if (!window.electronAPI) return;

    let lyrics: string | undefined;
    if (song.platform === 'netease') {
      setLoadingLyrics(song.id);
      try {
        const lrc = await window.electronAPI.getLyrics(song.id);
        if (lrc.success && lrc.data) lyrics = lrc.data;
      } catch {}
      setLoadingLyrics(null);
    }

    onSelect(song.name, song.artists.join('、'), lyrics);
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
            onClick={() => { setOffset(0); handleSearch(true); }}
            disabled={searching || !keyword.trim()}
          >
            {searching ? '搜索中...' : '搜索'}
          </button>
        </div>

        <div className="search-results">
          {!searched && (
            <div className="search-hint">
              <p>💡 输入关键词搜索歌曲，比如「晴天」「周杰伦」</p>
            </div>
          )}

          {searching && !loadingMore && (
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
                <img className="search-album-cover"
                  src={song.album.picUrl}
                  alt=""
                  onLoad={() => console.log('[search] Cover loaded:', song.album?.picUrl?.slice(0, 60))}
                  onError={(e) => console.log('[search] Cover FAILED:', song.album?.picUrl?.slice(0, 60), 'album:', song.album?.name)}
                />
              ) : (
                <div className="search-album-placeholder" title="无封面URL">
                  🎵
                  <span style={{display:'block',fontSize:9,color:'var(--color-text-muted)'}}>无封面</span>
                </div>
              )}
              <div className="search-song-info">
                <div className="search-song-name">
                  {song.name}
                  {loadingLyrics === song.id && (
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 8 }}>⏳</span>
                  )}
                </div>
                <div className="search-song-artist">{song.artists.join(' / ')}</div>
                {song.album && <div className="search-song-album">{song.album.name}</div>}
              </div>
              <div className="search-song-platform">
                {song.platform === 'netease' ? '🔴 网易云' : song.platform === 'qq' ? '🟢 QQ' : ''}
              </div>
            </div>
          ))}

          {hasMore && results.length > 0 && (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <button className="search-btn"
                onClick={handleLoadMore}
                disabled={loadingMore}
                style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}
              >
                {loadingMore ? '加载中...' : '📥 加载更多'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
