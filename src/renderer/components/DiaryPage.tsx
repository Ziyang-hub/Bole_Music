/**
 * 伯乐模拟器 - 听歌日记页面
 *
 * 以时间线形式展示听歌记录，支持回顾某天的音乐记忆
 * 当前使用模拟数据
 */

import React from 'react';

// 模拟听歌日记数据
const mockDiary = [
  {
    date: '2026-08-07',
    dayOfWeek: '周四',
    songs: [
      { title: '晴天', artist: '周杰伦', time: '14:30', note: '下午工作时听到的，旋律一响起就让我想起大学时光' },
      { title: '平凡之路', artist: '朴树', time: '16:45', note: '工作累了，需要一首歌来放松心情' },
      { title: '七里香', artist: '周杰伦', time: '20:10', note: '晚上散步时听的，夏夜的微风刚刚好' },
    ],
    mood: '怀旧温暖',
    summary: '今天听的歌都围绕着「回忆」这个主题，也许你最近在整理旧照片或者思考过去的事情。',
  },
  {
    date: '2026-08-06',
    dayOfWeek: '周三',
    songs: [
      { title: 'Yellow', artist: 'Coldplay', time: '10:15', note: '早上听的英文歌，开始新的一天' },
      { title: 'Shape of You', artist: 'Ed Sheeran', time: '15:20', note: '节奏感很强，适合下午提神' },
    ],
    mood: '轻松愉快',
    summary: '今天英文歌居多，节奏比较明快，看来心情不错。',
  },
  {
    date: '2026-08-05',
    dayOfWeek: '周二',
    songs: [
      { title: '夜曲', artist: '周杰伦', time: '21:30', note: '深夜一个人听的，周杰伦的歌就是有一种魔力' },
      { title: '好久不见', artist: '陈奕迅', time: '22:00', note: '这首歌让整个人安静下来了' },
      { title: '南山南', artist: '马頔', time: '22:45', note: '民谣的叙事感很适合夜晚' },
    ],
    mood: '安静感伤',
    summary: '深夜听歌时段，从流行到民谣，情绪渐渐沉静下来。也许是需要一些独处的时光。',
  },
];

export default function DiaryPage() {
  return (
    <div className="page diary-page">
      <h2 className="page-title">📝 听歌日记</h2>
      <p className="page-subtitle">记录每一首歌带来的感受，回顾你的音乐记忆</p>

      {/* 时间线 */}
      <div className="timeline">
        {mockDiary.map((day, dayIndex) => (
          <div key={dayIndex} className="timeline-day">
            {/* 日期标记 */}
            <div className="timeline-marker">
              <div className="timeline-dot" />
              {dayIndex < mockDiary.length - 1 && <div className="timeline-line" />}
            </div>

            {/* 日记内容 */}
            <div className="timeline-content">
              <div className="diary-header">
                <div className="diary-date">
                  <span className="diary-day">{day.date}</span>
                  <span className="diary-weekday">{day.dayOfWeek}</span>
                </div>
                <span className="diary-mood-badge">{day.mood}</span>
              </div>

              {/* 歌曲列表 */}
              <div className="diary-songs">
                {day.songs.map((song, songIndex) => (
                  <div key={songIndex} className="diary-song-item">
                    <div className="diary-song-info">
                      <span className="diary-song-title">{song.title}</span>
                      <span className="diary-song-artist"> — {song.artist}</span>
                      <span className="diary-song-time">{song.time}</span>
                    </div>
                    <div className="diary-song-note">💭 {song.note}</div>
                  </div>
                ))}
              </div>

              {/* 伯乐小结 */}
              <div className="diary-summary">
                <span className="diary-summary-icon">🐴</span>
                <p>{day.summary}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 提示：更多数据 */}
      <div className="diary-more-hint">
        <p>🎵 听歌越多，日记越丰富。去「知音对话」页面听听歌吧！</p>
      </div>
    </div>
  );
}
