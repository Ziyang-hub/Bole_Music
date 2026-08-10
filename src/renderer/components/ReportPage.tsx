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

      // 筛选对应时间范围（日报=今天，周报=近7天，月报=近30天）
      const now = new Date();
      const days = reportType === 'daily' ? 1 : reportType === 'weekly' ? 7 : 30;
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - (days - 1));
      const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
      const filteredSongs = diary
        .filter((d) => d.date >= cutoffStr)
        .flatMap((d) =>
          d.songs.map((s) => ({ title: s.title, artist: s.artist, emotion: d.mood }))
        );

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
  const totalMins = Math.round(stats.totalSongs * 3.5);
  const totalTime = `${Math.floor(totalMins / 60)}h${totalMins % 60}m`;
  const totalGenres = Object.values(stats.genreDistribution).reduce((a, b) => a + b, 0) || 1;

  const genreList = Object.entries(stats.genreDistribution)
    .filter(([g]) => (g || '').trim())  // 过滤空曲风（兼容历史数据）
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([genre, count]) => ({ genre, percent: Math.round((count / totalGenres) * 100) }));

  return (
    <div className="page report-page">
      <h2 className="page-title">📊 听歌报告</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
        <button className="report-export-btn" onClick={() => copyReport(stats, diary, reportType, report)}>
          📤 复制报告
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

      {/* 情绪时间线 */}
      {getMoodTimeline(diary).length > 0 && (
        <div className="section-card">
          <div className="section-header">💭 情绪时间线</div>
          <div className="mood-timeline-report">
            {getMoodTimeline(diary).map((d, i) => (
              <div key={i} className="mood-timeline-item">
                <span className="mood-timeline-date">{d.date}</span>
                <span className="mood-timeline-badge">{d.mood}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 听歌时段分布 */}
      {stats.totalSongs > 0 && (
        <div className="section-card">
          <div className="section-header">⏰ 听歌时段分布</div>
          <TimeOfDayChart data={getTimeOfDayDistribution(diary)} />
        </div>
      )}

      {/* 单曲循环冠军 */}
      {stats.topSongs.length > 0 && (
        <div className="section-card ai-report-card">
          <div className="section-header">🔁 单曲循环冠军</div>
          <div className="repeat-leader">
            <span className="repeat-song">{stats.topSongs[0].title} — {stats.topSongs[0].artist}</span>
            <span className="repeat-count">{stats.topSongs[0].count} 次</span>
          </div>
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
    // 跳过空 key（兼容历史空曲风数据）
    if (!(key || '').trim()) continue;
    if (val > topVal) { topVal = val; topKey = key; }
  }
  return topKey;
}

/** 统计听歌时段分布 */
function getTimeOfDayDistribution(diary: DiaryEntry[]): Record<string, number> {
  const buckets: Record<string, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  diary.forEach((day) => {
    day.songs.forEach((song) => {
      if (!song.time) return;
      const hour = parseInt(song.time.split(':')[0], 10);
      if (hour >= 5 && hour < 12) buckets.morning++;
      else if (hour >= 12 && hour < 18) buckets.afternoon++;
      else if (hour >= 18 && hour < 22) buckets.evening++;
      else buckets.night++;
    });
  });
  return buckets;
}

/** 获取最近的情绪时间线 */
function getMoodTimeline(diary: DiaryEntry[]): { date: string; mood: string }[] {
  return diary
    .filter((d) => d.mood)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 14)
    .reverse()
    .map((d) => ({ date: d.date.slice(5), mood: d.mood }));
}

function TimeOfDayChart({ data }: { data: Record<string, number> }) {
  const labels: Record<string, string> = { morning: '🌅 早晨', afternoon: '☀️ 下午', evening: '🌆 傍晚', night: '🌙 深夜' };
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="genre-list">
      {Object.entries(data).map(([key, count]) => (
        <div key={key} className="genre-item">
          <div className="genre-label">
            <span>{labels[key] || key}</span>
            <span>{count}首</span>
          </div>
          <div className="genre-bar-bg">
            <div className="genre-bar-fill" style={{ width: `${(count / total) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** 导出听歌报告为文本 */
/** 复制报告：合并导出+分享，输出对应时间段的完整报告文本 */
async function copyReport(stats: ListeningStats, diary: DiaryEntry[], type: string, report?: ReportData | null) {
  const topGenre = getTopKey(stats.genreDistribution) || '暂无';
  const topArtist = getTopKey(stats.artistCounts) || '暂无';
  const typeLabel = type === 'daily' ? '日报' : type === 'weekly' ? '周报' : '月报';

  // 时间段：日报=今天，周报=近7天，月报=近30天
  const days = type === 'daily' ? 1 : type === 'weekly' ? 7 : 30;
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const fmt = (d: Date) => `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;

  // 时间段内的日记条目和歌曲
  const periodDays = diary.filter((d) => d.date >= cutoffStr);
  const periodAllSongs = periodDays.flatMap((d) => d.songs);
  const periodSongs = periodAllSongs.slice(0, 50);

  // 时间段曲风分布（从日记歌曲的 genre 统计；旧数据无 genre 归"未知"）
  const genreCounts: Record<string, number> = {};
  periodAllSongs.forEach((s) => {
    const g = (s as any).genre || '未知';
    genreCounts[g] = (genreCounts[g] || 0) + 1;
  });

  // 标题带具体时间范围
  let text = `🐴 伯乐模拟器 - 听歌${typeLabel}`;
  text += type === 'daily'
    ? `（${fmt(today)}）\n`
    : `（${fmt(cutoff)} - ${fmt(today)}）\n`;
  text += `${'='.repeat(40)}\n\n`;

  // AI 风格刻画（若已生成）
  if (report && report.summary) {
    text += `🎨 音乐风格刻画\n${report.summary}\n`;
    if (report.mood) text += `情绪：${report.mood}\n`;
    if (report.keywords?.length) text += `关键词：${report.keywords.join('、')}\n`;
    text += `\n`;
  }

  // 数据概览
  text += `📊 数据概览\n`;
  text += `  ${typeLabel}期间听歌：${periodAllSongs.length} 首\n`;
  text += `  累计听歌：${stats.totalSongs} 首\n`;
  text += `  最爱曲风：${topGenre}\n`;
  text += `  最爱歌手：${topArtist}\n\n`;

  // 对应时间段听的歌曲（前50首）
  if (periodSongs.length > 0) {
    text += `🎵 ${typeLabel}期间听的歌${periodAllSongs.length > 50 ? `（前50/共${periodAllSongs.length}）` : ''}\n`;
    periodSongs.forEach((s, i) => {
      text += `  ${i + 1}. ${s.title}${s.artist ? ` — ${s.artist}` : ''}${s.time ? `  ${s.time}` : ''}\n`;
    });
    text += `\n`;
  }

  // 对应时间段曲风分布
  const genreList = Object.entries(genreCounts)
    .sort(([, a], [, b]) => b - a);
  if (genreList.length > 0) {
    text += `🎼 ${typeLabel}曲风分布\n`;
    genreList.forEach(([g, c]) => {
      text += `  ${g}: ${c}首\n`;
    });
    text += `\n`;
  }

  text += `---\n由伯乐模拟器生成 | https://github.com/scorching12/Bole_Music\n`;

  try {
    await navigator.clipboard.writeText(text);
    alert('报告已复制到剪贴板！可以粘贴分享给朋友 🎉');
  } catch {
    alert('复制失败，请手动复制');
  }
}

