/**
 * 伯乐模拟器 - 听歌报告页面
 *
 * 从本地存储读取真实听歌数据，展示分析报告
 */

import React, { useState, useEffect } from 'react';

export default function ReportPage() {
  const [stats, setStats] = useState<ListeningStats | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      if (!window.electronAPI) {
        setLoaded(true);
        return;
      }
      try {
        const s = await window.electronAPI.getStats();
        setStats(s);
      } catch (err) {
        console.error('加载统计数据失败:', err);
      }
      setLoaded(true);
    }
    load();
  }, []);

  // 加载中
  if (!loaded) {
    return <div className="page report-page"><p className="page-subtitle">加载中...</p></div>;
  }

  // 没有数据
  if (!stats || stats.totalSongs === 0) {
    return (
      <div className="page report-page">
        <h2 className="page-title">📊 听歌报告</h2>
        <p className="page-subtitle">基于你的听歌记录，AI 伯乐为你生成的分析报告</p>
        <div className="section-card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎵</div>
          <div className="section-header">还没有听歌数据</div>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 8 }}>
            去「知音对话」页面输入歌名，让伯乐帮你分析歌曲吧！
            <br />
            分析越多，报告越丰富。
          </p>
        </div>
      </div>
    );
  }

  // 计算统计
  const totalTime = `${Math.round(stats.totalSongs * 3.5 / 60)}小时${Math.round(stats.totalSongs * 3.5) % 60}分钟`;
  const topGenre = getTopKey(stats.genreDistribution) || '暂无';
  const topArtist = getTopKey(stats.artistCounts) || '暂无';
  const topSong = stats.topSongs[0] ? `${stats.topSongs[0].title}` : '暂无';

  // 模拟每日数据（后续替换为真实数据）
  const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const weeklyData = weekDays.map((day, i) => ({
    day,
    songs: Object.values(stats.dailyCounts)[i] || 0,
    mood: ['轻松', '温暖', '怀旧', '快乐', '平静', '感伤', '放松'][i],
  }));
  const maxSongs = Math.max(1, ...weeklyData.map((d) => d.songs));

  // 曲风分布
  const totalGenres = Object.values(stats.genreDistribution).reduce((a, b) => a + b, 0) || 1;
  const genreList = Object.entries(stats.genreDistribution)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([genre, count]) => ({
      genre,
      percent: Math.round((count / totalGenres) * 100),
    }));

  return (
    <div className="page report-page">
      <h2 className="page-title">📊 听歌报告</h2>
      <p className="page-subtitle">基于你的听歌记录，AI 伯乐为你生成的分析报告</p>

      {/* 统计卡片 */}
      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-icon">🎵</div>
          <div className="stat-value">{stats.totalSongs}</div>
          <div className="stat-label">累计听歌</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⏱️</div>
          <div className="stat-value">{totalTime}</div>
          <div className="stat-label">估算时长</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🎸</div>
          <div className="stat-value">{topGenre}</div>
          <div className="stat-label">最爱的曲风</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">👨‍🎤</div>
          <div className="stat-value">{topArtist}</div>
          <div className="stat-label">最爱的歌手</div>
        </div>
      </div>

      {/* 情绪总结 */}
      {stats.totalSongs > 0 && (
        <div className="section-card mood-card">
          <div className="section-header">🌈 情绪总结</div>
          <p className="mood-summary">
            {stats.totalSongs < 5
              ? '你刚开始使用伯乐，多分析几首歌后，我会为你总结音乐心情变化。'
              : stats.totalSongs < 20
              ? `你已经听了 ${stats.totalSongs} 首歌，音乐口味正在逐渐清晰。继续听下去，我会发现更多关于你的音乐秘密。`
              : `你已经分析了 ${stats.totalSongs} 首歌！你的音乐世界丰富多彩，从曲风来看，你偏爱 ${topGenre}，这反映了你内心${Math.random() > 0.5 ? '丰富而细腻' : '温暖而深邃'}的一面。`}
          </p>
        </div>
      )}

      {/* 曲风分布 */}
      {genreList.length > 0 && (
        <div className="section-card">
          <div className="section-header">🎼 曲风分布</div>
          <div className="genre-list">
            {genreList.map((item) => (
              <div key={item.genre} className="genre-item">
                <div className="genre-label">
                  <span>{item.genre}</span>
                  <span>{item.percent}%</span>
                </div>
                <div className="genre-bar-bg">
                  <div className="genre-bar-fill" style={{ width: `${item.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 热门歌曲 */}
      {stats.topSongs.length > 0 && (
        <div className="section-card">
          <div className="section-header">🏆 热门歌曲 Top 5</div>
          <div className="top-songs">
            {stats.topSongs.slice(0, 5).map((song, i) => (
              <div key={i} className="top-song-item">
                <span className="top-song-rank">{i + 1}</span>
                <span className="top-song-name">
                  {song.title} - {song.artist}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {song.count}次
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 本周趋势（简易版） */}
      {Object.keys(stats.dailyCounts).length > 0 && (
        <div className="section-card">
          <div className="section-header">📈 听歌趋势</div>
          <div className="chart-bar-container">
            {weeklyData.map((item) => (
              <div key={item.day} className="chart-bar-group">
                <div className="chart-bar-value">{item.songs}首</div>
                <div className="chart-bar" style={{ height: `${(item.songs / maxSongs) * 120}px` }} />
                <div className="chart-bar-label">{item.day}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** 获取 Record 中值最大的 key */
function getTopKey(record: Record<string, number>): string | null {
  let topKey: string | null = null;
  let topVal = 0;
  for (const [key, val] of Object.entries(record)) {
    if (val > topVal) {
      topVal = val;
      topKey = key;
    }
  }
  return topKey;
}
