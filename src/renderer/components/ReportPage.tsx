/**
 * 伯乐模拟器 - 听歌报告页面
 *
 * 日报/周报/月报切换，AI 生成报告，统计数据可视化
 */

import React, { useState, useEffect, useCallback } from 'react';

type ReportType = 'daily' | 'weekly' | 'monthly';

export default function ReportPage() {
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [stats, setStats] = useState<ListeningStats | null>(null);
  const [diary, setDiary] = useState<DiaryEntry[]>([]);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);

  // 加载数据
  const loadData = useCallback(async () => {
    if (!window.electronAPI) { setLoaded(true); return; }
    const [s, d] = await Promise.all([
      window.electronAPI.getStats(),
      window.electronAPI.getDiary(),
    ]);
    setStats(s);
    setDiary(d);
    setLoaded(true);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // 生成报告
  async function handleGenerate() {
    if (!window.electronAPI || !stats) return;
    setGenerating(true);
    try {
      // 收集歌曲数据
      const songs = diary.flatMap((d) =>
        d.songs.map((s) => ({
          title: s.title,
          artist: s.artist,
          emotion: d.mood,
        }))
      );

      // 筛选对应时间范围
      const now = new Date();
      let filteredSongs = songs;
      if (reportType === 'daily') {
        const today = now.toISOString().split('T')[0];
        filteredSongs = diary
          .filter((d) => d.date === today)
          .flatMap((d) =>
            d.songs.map((s) => ({ title: s.title, artist: s.artist, emotion: d.mood }))
          );
      }

      const result = await window.electronAPI.generateReport(
        reportType,
        filteredSongs,
        {
          totalSongs: stats.totalSongs,
          topGenre: getTopKey(stats.genreDistribution) || '未知',
          topArtist: getTopKey(stats.artistCounts) || '未知',
          genreDistribution: stats.genreDistribution,
          topSongs: stats.topSongs,
        }
      );
      if (result.success && result.data) {
        setReport(result.data);
      }
    } catch (err) {
      console.error('生成报告失败:', err);
    }
    setGenerating(false);
  }

  if (!loaded) {
    return <div className="page report-page"><p className="page-subtitle">加载中...</p></div>;
  }

  if (!stats || stats.totalSongs === 0) {
    return (
      <div className="page report-page">
        <h2 className="page-title">📊 听歌报告</h2>
        <div className="report-tabs">
          {(['daily', 'weekly', 'monthly'] as ReportType[]).map((t) => (
            <button key={t} className={`report-tab ${reportType === t ? 'active' : ''}`}
              onClick={() => setReportType(t)}>
              {{ daily: '📅 日报', weekly: '📈 周报', monthly: '📊 月报' }[t]}
            </button>
          ))}
        </div>
        <div className="section-card empty-state">
          <div className="empty-icon">🎵</div>
          <div className="section-header">还没有听歌数据</div>
          <p>去「知音对话」分析歌曲后，这里会自动生成报告。</p>
        </div>
      </div>
    );
  }

  const topGenre = getTopKey(stats.genreDistribution) || '暂无';
  const topArtist = getTopKey(stats.artistCounts) || '暂无';
  const totalTime = `${Math.round(stats.totalSongs * 3.5 / 60)}h${Math.round(stats.totalSongs * 3.5) % 60}m`;
  const totalGenres = Object.values(stats.genreDistribution).reduce((a, b) => a + b, 0) || 1;

  const genreList = Object.entries(stats.genreDistribution)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([genre, count]) => ({ genre, percent: Math.round((count / totalGenres) * 100) }));

  return (
    <div className="page report-page">
      <h2 className="page-title">📊 听歌报告</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
        <button className="report-export-btn" onClick={() => exportReport(stats, diary, reportType)}>
          📥 导出文本
        </button>
        <button className="report-export-btn" onClick={() => shareReport(stats)}>
          📤 复制分享
        </button>
      </div>

      {/* 报告类型切换 */}
      <div className="report-tabs">
        {(['daily', 'weekly', 'monthly'] as ReportType[]).map((t) => (
          <button
            key={t}
            className={`report-tab ${reportType === t ? 'active' : ''}`}
            onClick={() => { setReportType(t); setReport(null); }}
          >
            {{ daily: '📅 日报', weekly: '📈 周报', monthly: '📊 月报' }[t]}
          </button>
        ))}
        <button
          className="report-generate-btn"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? '⏳ 生成中...' : '🤖 AI 生成报告'}
        </button>
      </div>

      {/* AI 生成的报告 */}
      {report && (
        <div className="section-card ai-report-card">
          <div className="ai-report-header">
            <span>🐴 伯乐{reportType === 'daily' ? '今日' : reportType === 'weekly' ? '本周' : '本月'}报告</span>
            <span className="ai-report-mood">情绪：{report.mood}</span>
          </div>
          <p className="ai-report-summary">{report.summary}</p>
          {report.keywords.length > 0 && (
            <div className="ai-report-keywords">
              {report.keywords.map((kw, i) => (
                <span key={i} className="keyword-tag">{kw}</span>
              ))}
            </div>
          )}
          {report.highlights.length > 0 && (
            <ul className="ai-report-highlights">
              {report.highlights.map((h, i) => (
                <li key={i}>✨ {h}</li>
              ))}
            </ul>
          )}
        </div>
      )}

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
          <div className="stat-label">最爱曲风</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">👨‍🎤</div>
          <div className="stat-value">{topArtist}</div>
          <div className="stat-label">最爱歌手</div>
        </div>
      </div>

      {/* 曲风分布 */}
      {genreList.length > 0 && (
        <div className="section-card">
          <div className="section-header">🎼 曲风分布</div>
          <div className="genre-list">
            {genreList.map((item) => (
              <div key={item.genre} className="genre-item">
                <div className="genre-label">
                  <span>{item.genre}</span><span>{item.percent}%</span>
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
          <div className="section-header">🏆 热门歌曲 Top 10</div>
          <div className="top-songs">
            {stats.topSongs.slice(0, 10).map((song, i) => (
              <div key={i} className="top-song-item">
                <span className="top-song-rank">{i + 1}</span>
                <span className="top-song-name">{song.title} - {song.artist}</span>
                <span className="top-song-count">{song.count}次</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 歌手偏好 */}
      {Object.keys(stats.artistCounts).length > 0 && (
        <div className="section-card">
          <div className="section-header">👨‍🎤 歌手偏好</div>
          <div className="genre-list">
            {Object.entries(stats.artistCounts)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 5)
              .map(([artist, count]) => (
                <div key={artist} className="genre-item">
                  <div className="genre-label">
                    <span>{artist}</span><span>{count}首</span>
                  </div>
                  <div className="genre-bar-bg">
                    <div
                      className="genre-bar-fill"
                      style={{ width: `${(count / Math.max(...Object.values(stats.artistCounts))) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getTopKey(record: Record<string, number>): string | null {
  let topKey: string | null = null;
  let topVal = 0;
  for (const [key, val] of Object.entries(record)) {
    if (val > topVal) { topVal = val; topKey = key; }
  }
  return topKey;
}

/** 导出听歌报告为文本 */
function exportReport(stats: ListeningStats, diary: DiaryEntry[], type: string) {
  const topGenre = getTopKey(stats.genreDistribution) || '暂无';
  const topArtist = getTopKey(stats.artistCounts) || '暂无';
  const typeLabel = type === 'daily' ? '日报' : type === 'weekly' ? '周报' : '月报';

  let text = `🐴 伯乐模拟器 - 听歌${typeLabel}\n`;
  text += `${'='.repeat(40)}\n\n`;
  text += `📊 数据概览\n`;
  text += `  累计听歌：${stats.totalSongs} 首\n`;
  text += `  最爱曲风：${topGenre}\n`;
  text += `  最爱歌手：${topArtist}\n\n`;

  if (stats.topSongs.length > 0) {
    text += `🏆 热门歌曲 Top 5\n`;
    stats.topSongs.slice(0, 5).forEach((s, i) => {
      text += `  ${i + 1}. ${s.title} - ${s.artist} (${s.count}次)\n`;
    });
    text += '\n';
  }

  if (Object.keys(stats.genreDistribution).length > 0) {
    text += `🎼 曲风分布\n`;
    Object.entries(stats.genreDistribution)
      .sort(([, a], [, b]) => b - a)
      .forEach(([genre, count]) => {
        text += `  ${genre}: ${count}首\n`;
      });
    text += '\n';
  }

  text += `---\n由伯乐模拟器生成 | https://github.com/scorching12/Bole_Music\n`;

  // 创建 Blob 下载
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `伯乐听歌${typeLabel}_${new Date().toISOString().split('T')[0]}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

/** 复制分享文本 */
async function shareReport(stats: ListeningStats) {
  const topGenre = getTopKey(stats.genreDistribution) || '暂无';
  const topArtist = getTopKey(stats.artistCounts) || '暂无';

  const text = `🐴 伯乐模拟器 听歌报告\n\n📊 累计听歌 ${stats.totalSongs} 首\n🎸 最爱曲风：${topGenre}\n👨‍🎤 最爱歌手：${topArtist}\n\n—— 来自「伯乐模拟器」你的AI音乐知音`;

  try {
    await navigator.clipboard.writeText(text);
    alert('已复制到剪贴板！可以粘贴分享给朋友 🎉');
  } catch {
    alert('复制失败，请手动复制');
  }
}
