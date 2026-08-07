/**
 * 伯乐模拟器 - 听歌报告页面
 *
 * 展示用户的听歌统计、曲风偏好、情绪曲线等分析数据
 * 当前使用模拟数据，后续替换为真实数据
 */

import React from 'react';

// 模拟数据（后续替换为真实 AI 分析数据）
const mockReport = {
  totalSongs: 127,
  totalTime: '42小时18分钟',
  topGenre: '华语流行',
  topArtist: '周杰伦',
  topSong: '晴天',
  moodSummary: '最近一周情绪以「温暖怀旧」为主',
  weeklyData: [
    { day: '周一', songs: 18, mood: '轻松' },
    { day: '周二', songs: 22, mood: '怀旧' },
    { day: '周三', songs: 15, mood: '平静' },
    { day: '周四', songs: 25, mood: '温暖' },
    { day: '周五', songs: 20, mood: '快乐' },
    { day: '周六', songs: 17, mood: '感伤' },
    { day: '周日', songs: 10, mood: '放松' },
  ],
  genreDistribution: [
    { genre: '华语流行', percent: 45 },
    { genre: '独立民谣', percent: 20 },
    { genre: '摇滚', percent: 15 },
    { genre: 'R&B', percent: 12 },
    { genre: '其他', percent: 8 },
  ],
  recentInsights: [
    '你最近偏爱温暖怀旧风格的歌曲，可能是在回忆过去的美好时光',
    '周四是你听歌最多的一天，通常这天情绪比较放松',
    '你的音乐口味正在从流行向民谣扩展，品味越来越丰富了',
  ],
};

export default function ReportPage() {
  const { totalSongs, totalTime, topGenre, topArtist, topSong, moodSummary, weeklyData, genreDistribution, recentInsights } = mockReport;

  return (
    <div className="page report-page">
      <h2 className="page-title">📊 听歌报告</h2>
      <p className="page-subtitle">基于你的听歌记录，AI 伯乐为你生成的分析报告</p>

      {/* 统计卡片 */}
      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-icon">🎵</div>
          <div className="stat-value">{totalSongs}</div>
          <div className="stat-label">累计听歌</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⏱️</div>
          <div className="stat-value">{totalTime}</div>
          <div className="stat-label">听歌时长</div>
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
      <div className="section-card mood-card">
        <div className="section-header">🌈 情绪总结</div>
        <p className="mood-summary">{moodSummary}</p>
      </div>

      {/* 本周听歌趋势 */}
      <div className="section-card">
        <div className="section-header">📈 本周听歌趋势</div>
        <div className="chart-bar-container">
          {weeklyData.map((item) => (
            <div key={item.day} className="chart-bar-group">
              <div className="chart-bar-value">{item.songs}首</div>
              <div
                className="chart-bar"
                style={{ height: `${(item.songs / 25) * 120}px` }}
              />
              <div className="chart-bar-label">{item.day}</div>
              <div className="chart-bar-mood">{item.mood}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 曲风分布 */}
      <div className="section-card">
        <div className="section-header">🎼 曲风分布</div>
        <div className="genre-list">
          {genreDistribution.map((item) => (
            <div key={item.genre} className="genre-item">
              <div className="genre-label">
                <span>{item.genre}</span>
                <span>{item.percent}%</span>
              </div>
              <div className="genre-bar-bg">
                <div
                  className="genre-bar-fill"
                  style={{ width: `${item.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI 洞察 */}
      <div className="section-card">
        <div className="section-header">💡 伯乐的洞察</div>
        <ul className="insight-list">
          {recentInsights.map((insight, i) => (
            <li key={i} className="insight-item">{insight}</li>
          ))}
        </ul>
      </div>

      {/* 热门歌曲 */}
      <div className="section-card">
        <div className="section-header">🏆 本周热门 Top 5</div>
        <div className="top-songs">
          {['晴天 - 周杰伦', '平凡之路 - 朴树', 'Yellow - Coldplay', '七里香 - 周杰伦', '夜曲 - 周杰伦'].map((song, i) => (
            <div key={i} className="top-song-item">
              <span className="top-song-rank">{i + 1}</span>
              <span className="top-song-name">{song}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
