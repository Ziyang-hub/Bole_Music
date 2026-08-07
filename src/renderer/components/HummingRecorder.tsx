/**
 * 伯乐模拟器 - 哼歌识别组件
 *
 * 使用麦克风录制哼歌 → 发送到主进程识别
 */

import React, { useState, useRef } from 'react';

interface Props {
  onClose: () => void;
  onResult: (title: string, artist: string) => void;
}

export default function HummingRecorder({ onClose, onResult }: Props) {
  const [recording, setRecording] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorder.current = recorder;
      chunks.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: 'audio/webm' });
        await recognizeAudio(blob);
      };

      recorder.start();
      setRecording(true);
    } catch (err) {
      alert('无法访问麦克风，请检查浏览器权限');
      console.error(err);
    }
  }

  function stopRecording() {
    if (mediaRecorder.current && recording) {
      mediaRecorder.current.stop();
      setRecording(false);
    }
  }

  async function recognizeAudio(_blob: Blob) {
    setRecognizing(true);
    await new Promise((r) => setTimeout(r, 800));
    setResult(
      '🎵 哼歌识别需要配置识别服务。\n\n' +
      '当前已录制音频片段。推荐方式：\n' +
      '- AudD：在设置页填入 API Key（免费300次/月）\n' +
      '- 或者直接输入你哼的歌名让 AI 分析\n\n' +
      '💡 提示：告诉伯乐「我在哼一首歌，旋律大概是...」也可以哦'
    );
    setRecognizing(false);
  }

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="search-header">
          <span>🎤 哼歌识别</span>
          <button className="search-close-btn" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>
            {recording ? '🔴' : recognizing ? '⏳' : '🎤'}
          </div>

          {!result && (
            <>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                {recording
                  ? '正在录制... 哼一段你喜欢的旋律吧'
                  : recognizing
                  ? '正在识别...'
                  : '点击按钮开始录制，哼唱 5-10 秒'}
              </p>
              <button
                className={`search-btn ${recording ? '' : ''}`}
                onClick={recording ? stopRecording : startRecording}
                style={recording ? { background: '#f44336' } : {}}
              >
                {recording ? '⏹ 停止录制' : '🎤 开始录制'}
              </button>
            </>
          )}

          {result && (
            <div style={{
              textAlign: 'left', padding: 12, background: 'var(--color-bg-tertiary)',
              borderRadius: 8, fontSize: 13, lineHeight: 1.8,
              whiteSpace: 'pre-wrap',
            }}>
              {result}
            </div>
          )}

          {result && (
            <button className="search-btn" onClick={onClose} style={{ marginTop: 12 }}>
              知道了
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
