/**
 * 伯乐模拟器 - 听歌日记页面
 *
 * 时间线展示 + 编辑/删除 + AI 生成小结
 */

import React, { useState, useEffect, useCallback } from 'react';

export default function DiaryPage() {
  const [diary, setDiary] = useState<DiaryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  const [editSongIndex, setEditSongIndex] = useState<number | null>(null);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  const loadDiary = useCallback(async () => {
    if (!window.electronAPI) { setLoaded(true); return; }
    const d = await window.electronAPI.getDiary();
    setDiary(d.reverse());
    setLoaded(true);
  }, []);

  useEffect(() => { loadDiary(); }, [loadDiary]);

  // 编辑歌曲笔记
  async function saveNote(date: string, songIndex: number) {
    if (!window.electronAPI) return;
    const day = diary.find((d) => d.date === date);
    if (!day) return;

    const updatedSongs = [...day.songs];
    updatedSongs[songIndex] = { ...updatedSongs[songIndex], note: editNote };

    await window.electronAPI.updateDiaryEntry(date, { songs: updatedSongs });
    setEditingDate(null);
    setEditSongIndex(null);
    loadDiary();
  }

  // 删除某一天的记录
  async function deleteDay(date: string) {
    if (!window.electronAPI) return;
    if (!confirm('确定要删除这天的听歌记录吗？')) return;
    await window.electronAPI.deleteDiaryEntry(date);
    loadDiary();
  }

  // AI 生成当天小结
  async function generateSummary(date: string) {
    if (!window.electronAPI) return;
    const day = diary.find((d) => d.date === date);
    if (!day) return;

    setGeneratingFor(date);

    try {
      const result = await window.electronAPI.chat([
        {
          role: 'user',
          content: `今天听了以下几首歌：\n${day.songs.map((s) => `- ${s.title} (${s.artist})`).join('\n')}\n\n请为今天的听歌日记写一段温馨的小结（100-200字）。直接回复文字，不要JSON。`,
        },
      ]);

      if (result.success && result.data) {
        await window.electronAPI.updateDiaryEntry(date, { summary: result.data });
        loadDiary();
      }
    } catch (err) {
      console.error('生成小结失败:', err);
    }
    setGeneratingFor(null);
  }

  // 添加用户自己的感想
  async function addUserNote(date: string) {
    if (!window.electronAPI) return;
    const note = prompt('输入你的感想：');
    if (!note) return;

    const day = diary.find((d) => d.date === date);
    if (!day) return;

    const updatedSongs = [...day.songs, { title: '💭 我的感想', artist: '', time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }), note }];
    await window.electronAPI.updateDiaryEntry(date, { songs: updatedSongs });
    loadDiary();
  }

  if (!loaded) {
    return <div className="page diary-page"><p className="page-subtitle">加载中...</p></div>;
  }

  return (
    <div className="page diary-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 className="page-title">📝 听歌日记</h2>
          <p className="page-subtitle">记录每一首歌带来的感受，回顾你的音乐记忆</p>
        </div>
      </div>

      {diary.length === 0 ? (
        <div className="section-card empty-state">
          <div className="empty-icon">📝</div>
          <div className="section-header">还没有听歌记录</div>
          <p>去「知音对话」分析歌曲后，这里会自动生成日记。</p>
        </div>
      ) : (
        <div className="timeline">
          {diary.map((day, dayIndex) => (
            <div key={day.date} className="timeline-day">
              <div className="timeline-marker">
                <div className="timeline-dot" />
                {dayIndex < diary.length - 1 && <div className="timeline-line" />}
              </div>

              <div className="timeline-content">
                <div className="diary-header">
                  <div className="diary-date">
                    <span className="diary-day">{day.date}</span>
                    <span className="diary-weekday">{getDayOfWeek(day.date)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="diary-mood-badge">{day.mood || '未知'}</span>
                    <button className="diary-action-btn" onClick={() => addUserNote(day.date)} title="添加感想">
                      ✏️
                    </button>
                    <button className="diary-action-btn" onClick={() => deleteDay(day.date)} title="删除">
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="diary-songs">
                  {day.songs.map((song, i) => (
                    <div key={i} className="diary-song-item">
                      <div className="diary-song-info">
                        <span className="diary-song-title">{song.title}</span>
                        {song.artist && <span className="diary-song-artist"> — {song.artist}</span>}
                        {song.time && <span className="diary-song-time">{song.time}</span>}
                      </div>

                      {/* 笔记编辑 */}
                      {editingDate === day.date && editSongIndex === i ? (
                        <div className="diary-edit-area">
                          <textarea
                            className="diary-edit-input"
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            rows={2}
                          />
                          <div className="diary-edit-actions">
                            <button className="diary-save-btn" onClick={() => saveNote(day.date, i)}>
                              保存
                            </button>
                            <button className="diary-cancel-btn" onClick={() => { setEditingDate(null); setEditSongIndex(null); }}>
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="diary-song-note"
                          onClick={() => {
                            setEditingDate(day.date);
                            setEditSongIndex(i);
                            setEditNote(song.note || '');
                          }}
                        >
                          {song.note ? `💭 ${song.note}` : '💬 点击添加笔记...'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* 小结区域 */}
                <div className="diary-summary-area">
                  {day.summary ? (
                    <div className="diary-summary">
                      <span className="diary-summary-icon">🐴</span>
                      <p>{day.summary}</p>
                    </div>
                  ) : (
                    <button
                      className="diary-generate-summary-btn"
                      onClick={() => generateSummary(day.date)}
                      disabled={generatingFor === day.date}
                    >
                      {generatingFor === day.date ? '⏳ 生成中...' : '🤖 AI 生成今日小结'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getDayOfWeek(dateStr: string): string {
  try {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return days[new Date(dateStr).getDay()];
  } catch {
    return '';
  }
}
