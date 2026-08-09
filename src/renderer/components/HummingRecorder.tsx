/**
 * 伯乐模拟器 - 哼歌识别组件
 *
 * 使用麦克风录制哼歌 → 发送到主进程识别
 */

import React, { useState, useRef } from 'react';
import Modal from './Modal';

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
      console.log('[humming] starting recording');
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
      console.error('[humming] mic error:', err);
    }
  }

  function stopRecording() {
    if (mediaRecorder.current && recording) {
      console.log('[humming] stopping recording');
      mediaRecorder.current.stop();
      setRecording(false);
    }
  }

  async function recognizeAudio(blob: Blob) {
    setRecognizing(true);
    console.log('[humming] recognizing audio, size:', blob.size);
    try {
      const buf = await blob.arrayBuffer();
      if (window.electronAPI && (window.electronAPI as any).recognizeAudioBlob) {
        const res = await (window.electronAPI as any).recognizeAudioBlob(buf);
        if (res?.title) {
          setResult(`✅ 识别成功！\n\n🎵 ${res.title}\n👤 ${res.artist || '未知歌手'}`);
          onResult(res.title, res.artist || '');
          console.log('[humming] recognized:', res.title, res.artist);
        } else {
          setResult('😕 未能识别出歌曲。\n\n建议：\n- 哼唱更长的片段（5-10秒）\n- 尽量接近原曲的旋律\n- 或者直接输入歌名搜索');
        }
      } else {
        setResult('⚠️ 哼歌识别功能需要 Electron 环境支持。');
      }
    } catch {
      setResult('❌ 识别过程出错，请重试。');
    }
    setRecognizing(false);
  }

  return (
    <Modal isOpen={true} onClose={onClose} title="🎤 哼歌识别" maxWidth={400}>
      <div className="humming-body">
        <div className="humming-icon">
          {recording ? '🔴' : recognizing ? '⏳' : '🎤'}
        </div>

        {!result && (
          <>
            <p className="humming-hint">
              {recording
                ? '正在录制... 哼一段你喜欢的旋律吧'
                : recognizing
                ? '正在识别...'
                : '点击按钮开始录制，哼唱 5-10 秒'}
            </p>
            <button
              className={`search-btn${recording ? ' humming-stop-btn' : ''}`}
              onClick={recording ? stopRecording : startRecording}
            >
              {recording ? '⏹ 停止录制' : '🎤 开始录制'}
            </button>
          </>
        )}

        {result && (
          <div className="humming-result-box">
            {result}
          </div>
        )}

        {result && (
          <div className="humming-done-btn">
            <button className="search-btn" onClick={onClose}>
              知道了
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}