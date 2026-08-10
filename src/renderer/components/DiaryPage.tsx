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
  // 输入 Modal 状态（Electron 中 window.prompt 不可用，用应用内表单替代）
  const [inputModal, setInputModal] = useState<{
    mode: 'addSong' | 'addNote' | null;
    date: string;
  }>({ mode: null, date: '' });
  const [modalTitle, setModalTitle] = useState('');
  const [modalArtist, setModalArtist] = useState('');
  const [modalNote, setModalNote] = useState('');
  // 小结编辑状态
  const [editingSummaryDate, setEditingSummaryDate] = useState<string | null>(null);
  const [editSummaryText, setEditSummaryText] = useState('');
  // 导出状态
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportMode, setExportMode] = useState<'all' | 'range'>('all');
  const [exportStart, setExportStart] = useState('');
  const [exportEnd, setExportEnd] = useState('');

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

  // 删除某一天中的某首歌
  async function deleteSong(date: string, songIndex: number) {
    if (!window.electronAPI) return;
    const day = diary.find(d => d.date === date);
    if (!day) return;
    const updatedSongs = day.songs.filter((_, i) => i !== songIndex);
    if (updatedSongs.length === 0) {
      await deleteDay(date);
    } else {
      await window.electronAPI.updateDiaryEntry(date, { songs: updatedSongs });
      loadDiary();
    }
  }

  // 手动添加歌曲到某一天（应用内输入框，替代不可用的 window.prompt）
  async function addSong(date: string, title: string, artist: string) {
    if (!window.electronAPI || !title.trim()) return;
    const day = diary.find(d => d.date === date);
    const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const newSong = { title: title.trim(), artist: artist.trim(), time, note: '' };
    if (day) {
      await window.electronAPI.updateDiaryEntry(date, { songs: [...day.songs, newSong] });
    } else {
      await window.electronAPI.addDiaryEntry({ date, songs: [newSong], mood: '', summary: '' });
    }
    loadDiary();
  }

  // AI 生成当天小结
  async function generateSummary(date: string) {
    if (!window.electronAPI) return;
    const day = diary.find((d) => d.date === date);
    if (!day) return;

    setGeneratingFor(date);

    try {
      const userMsg = `今天听了以下几首歌：\n${day.songs.map((s) => `- ${s.title} (${s.artist})`).join('\n')}\n\n请以用户「我」的第一人称视角，为今天的听歌日记写一段温馨的小结（100-200字），像用户自己在日记里写下今天听歌的感受（例如「今天我听了几首歌，最打动我的是...」）。直接回复文字，不要JSON。`;
      const result = await window.electronAPI.chat([], userMsg);

      if (result.success && result.data) {
        await window.electronAPI.updateDiaryEntry(date, { summary: result.data });
        loadDiary();
      }
    } catch (err) {
      console.error('生成小结失败:', err);
    }
    setGeneratingFor(null);
  }

  // 添加用户自己的感想（应用内输入框）
  async function addUserNote(date: string, note: string) {
    if (!window.electronAPI || !note.trim()) return;
    const day = diary.find((d) => d.date === date);
    if (!day) return;

    const updatedSongs = [...day.songs, { title: '💭 我的感想', artist: '', time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }), note: note.trim() }];
    await window.electronAPI.updateDiaryEntry(date, { songs: updatedSongs });
    loadDiary();
  }

  // 复制小结
  async function copySummary(date: string) {
    const day = diary.find((d) => d.date === date);
    if (!day?.summary) return;
    try {
      await navigator.clipboard.writeText(day.summary);
      alert('小结已复制到剪贴板 📋');
    } catch {
      alert('复制失败，请手动复制');
    }
  }

  // 保存修改的小结
  async function saveSummary(date: string) {
    if (!window.electronAPI) return;
    await window.electronAPI.updateDiaryEntry(date, { summary: editSummaryText.trim() });
    setEditingSummaryDate(null);
    loadDiary();
  }

  // 导出听歌日记（全部 / 日期范围）
  function exportDiary() {
    let entries = diary;
    if (exportMode === 'range' && exportStart && exportEnd) {
      entries = diary.filter((d) => d.date >= exportStart && d.date <= exportEnd);
    }

    let text = '🐴 伯乐模拟器 - 听歌日记\n';
    text += `${'='.repeat(40)}\n\n`;

    if (entries.length === 0) {
      text += '该时间段内没有听歌记录。\n';
    }

    entries.forEach((day, idx) => {
      text += `📅 ${day.date}`;
      if (day.mood && day.mood !== '未知') text += `  (${day.mood})`;
      text += `\n${'-'.repeat(30)}\n`;
      day.songs.forEach((s) => {
        text += `  🎵 ${s.title}${s.artist ? ` — ${s.artist}` : ''}${s.time ? `  ${s.time}` : ''}\n`;
        if (s.note) text += `     💭 ${s.note}\n`;
      });
      if (day.summary) {
        text += `  ✍️ 小结：${day.summary}\n`;
      }
      text += '\n';
    });

    text += `---\n共 ${entries.length} 天 | 由伯乐模拟器生成\n`;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const d = new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    a.download = `听歌日记_${exportMode === 'all' ? '全部' : `${exportStart}_至_${exportEnd}`}_${dateStr}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  }

  // 打开输入 Modal
  function openInputModal(mode: 'addSong' | 'addNote', date: string) {
    setModalTitle('');
    setModalArtist('');
    setModalNote('');
    setInputModal({ mode, date });
  }

  // 确认输入 Modal
  async function confirmInputModal() {
    const { mode, date } = inputModal;
    if (mode === 'addSong') {
      await addSong(date, modalTitle, modalArtist);
    } else if (mode === 'addNote') {
      await addUserNote(date, modalNote);
    }
    setInputModal({ mode: null, date: '' });
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
        <button
          className="report-export-btn"
          onClick={() => {
            setExportMode('all');
            setExportStart('');
            setExportEnd('');
            setShowExportModal(true);
          }}
        >
          📥 导出日记
        </button>
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
                    <button className="diary-action-btn" onClick={() => openInputModal('addSong', day.date)} title="添加歌曲">
                      ➕
                    </button>
                    <button className="diary-action-btn" onClick={() => openInputModal('addNote', day.date)} title="添加感想">
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
                        <button
                          className="diary-action-btn"
                          onClick={() => { if (confirm(`删除歌曲「${song.title}」？`)) deleteSong(day.date, i); }}
                          title="删除此歌曲"
                          style={{ marginLeft: 8, fontSize: 12 }}
                        >
                          ❌
                        </button>
                      </div>

                      {/* 笔记编辑 */}
                      {editingDate === day.date && editSongIndex === i ? (
                        <div className="diary-edit-area">
                          <textarea
                            className="diary-edit-input"
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            rows={5}
                            placeholder="写下你听这首歌时的感受..."
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
                    editingSummaryDate === day.date ? (
                      <div className="diary-edit-area">
                        <textarea
                          className="diary-edit-input"
                          value={editSummaryText}
                          onChange={(e) => setEditSummaryText(e.target.value)}
                          rows={5}
                          placeholder="修改你的小结..."
                        />
                        <div className="diary-edit-actions">
                          <button className="diary-save-btn" onClick={() => saveSummary(day.date)}>保存</button>
                          <button className="diary-cancel-btn" onClick={() => setEditingSummaryDate(null)}>取消</button>
                        </div>
                      </div>
                    ) : (
                      <div className="diary-summary">
                        <span className="diary-summary-icon">🐴</span>
                        <p>{day.summary}</p>
                        <div className="diary-summary-actions">
                          <button className="diary-action-btn" onClick={() => copySummary(day.date)} title="复制小结">📋</button>
                          <button
                            className="diary-action-btn"
                            onClick={() => {
                              setEditingSummaryDate(day.date);
                              setEditSummaryText(day.summary || '');
                            }}
                            title="修改小结"
                          >✏️</button>
                        </div>
                      </div>
                    )
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

      {/* 导出日记 Modal */}
      {showExportModal && (
        <div className="search-overlay" onClick={() => setShowExportModal(false)}>
          <div className="search-panel" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="search-header">
              <span>📥 导出听歌日记</span>
              <button className="search-close-btn" onClick={() => setShowExportModal(false)}>✕</button>
            </div>
            <div className="diary-modal-body">
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                  <input type="radio" checked={exportMode === 'all'} onChange={() => setExportMode('all')} />
                  全部日记
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                  <input type="radio" checked={exportMode === 'range'} onChange={() => setExportMode('range')} />
                  指定时间段
                </label>
              </div>
              {exportMode === 'range' && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                  <input
                    type="date"
                    className="search-input"
                    style={{ flex: 1 }}
                    value={exportStart}
                    onChange={(e) => setExportStart(e.target.value)}
                  />
                  <span style={{ color: 'var(--color-text-muted)' }}>至</span>
                  <input
                    type="date"
                    className="search-input"
                    style={{ flex: 1 }}
                    value={exportEnd}
                    onChange={(e) => setExportEnd(e.target.value)}
                  />
                </div>
              )}
              <div className="diary-edit-actions" style={{ marginTop: 4 }}>
                <button
                  className="diary-save-btn"
                  onClick={exportDiary}
                  disabled={exportMode === 'range' && (!exportStart || !exportEnd)}
                >
                  导出
                </button>
                <button className="diary-cancel-btn" onClick={() => setShowExportModal(false)}>取消</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 输入 Modal：添加歌曲 / 添加感想 */}
      {inputModal.mode && (
        <div className="search-overlay" onClick={() => setInputModal({ mode: null, date: '' })}>
          <div className="search-panel" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="search-header">
              <span>{inputModal.mode === 'addSong' ? '➕ 添加歌曲' : '✏️ 添加感想'}</span>
              <button className="search-close-btn" onClick={() => setInputModal({ mode: null, date: '' })}>✕</button>
            </div>
            <div className="diary-modal-body">
              {inputModal.mode === 'addSong' ? (
                <>
                  <input
                    className="search-input"
                    placeholder="歌曲名"
                    value={modalTitle}
                    onChange={(e) => setModalTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && confirmInputModal()}
                    autoFocus
                  />
                  <input
                    className="search-input"
                    placeholder="歌手（可选）"
                    value={modalArtist}
                    onChange={(e) => setModalArtist(e.target.value)}
                    style={{ marginTop: 8 }}
                  />
                </>
              ) : (
                <textarea
                  className="diary-edit-input"
                  placeholder="写下今天的感受..."
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  rows={5}
                  autoFocus
                />
              )}
              <div className="diary-edit-actions" style={{ marginTop: 12 }}>
                <button className="diary-save-btn" onClick={confirmInputModal}>确定</button>
                <button className="diary-cancel-btn" onClick={() => setInputModal({ mode: null, date: '' })}>取消</button>
              </div>
            </div>
          </div>
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
