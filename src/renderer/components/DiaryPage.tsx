/**
 * 伯乐模拟器 - 听歌日记页面
 *
 * 从本地存储读取真实听歌记录，以时间线展示
 */

import React, { useState, useEffect } from 'react';

export default function DiaryPage() {
  const [diary, setDiary] = useState<DiaryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      if (!window.electronAPI) {
        setLoaded(true);
        return;
      }
      try {
        const d = await window.electronAPI.getDiary();
        // 按日期倒序
        setDiary(d.reverse());
      } catch (err) {
        console.error('加载日记失败:', err);
      }
      setLoaded(true);
    }
    load();
  }, []);

  if (!loaded) {
    return <div className="page diary-page"><p className="page-subtitle">加载中...</p></div>;
  }

  return (
    <div className="page diary-page">
      <h2 className="page-title">📝 听歌日记</h2>
      <p className="page-subtitle">记录每一首歌带来的感受，回顾你的音乐记忆</p>

      {diary.length === 0 ? (
        <div className="section-card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
          <div className="section-header">还没有听歌记录</div>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 8 }}>
            去「知音对话」页面输入歌名，让伯乐分析歌曲，
            <br />
            分析过的歌曲会自动记录在日记中。
          </p>
        </div>
      ) : (
        <div className="timeline">
          {diary.map((day, dayIndex) => (
            <div key={dayIndex} className="timeline-day">
              <div className="timeline-marker">
                <div className="timeline-dot" />
                {dayIndex < diary.length - 1 && <div className="timeline-line" />}
              </div>

              <div className="timeline-content">
                <div className="diary-header">
                  <div className="diary-date">
                    <span className="diary-day">{day.date}</span>
                    <span className="diary-weekday">
                      {getDayOfWeek(day.date)}
                    </span>
                  </div>
                  <span className="diary-mood-badge">{day.mood || '未知'}</span>
                </div>

                <div className="diary-songs">
                  {day.songs.map((song, i) => (
                    <div key={i} className="diary-song-item">
                      <div className="diary-song-info">
                        <span className="diary-song-title">{song.title}</span>
                        {song.artist && (
                          <span className="diary-song-artist"> — {song.artist}</span>
                        )}
                        {song.time && (
                          <span className="diary-song-time">{song.time}</span>
                        )}
                      </div>
                      {song.note && (
                        <div className="diary-song-note">💭 {song.note}</div>
                      )}
                    </div>
                  ))}
                </div>

                {day.summary && (
                  <div className="diary-summary">
                    <span className="diary-summary-icon">🐴</span>
                    <p>{day.summary}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {diary.length > 0 && (
        <div className="diary-more-hint">
          <p>🎵 去「知音对话」分析更多歌曲，日记会越来越丰富！</p>
        </div>
      )}
    </div>
  );
}

/** 根据日期字符串获取星期几 */
function getDayOfWeek(dateStr: string): string {
  try {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const d = new Date(dateStr);
    return days[d.getDay()];
  } catch {
    return '';
  }
}
