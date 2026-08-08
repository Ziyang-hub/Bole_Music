/**
 * 伯乐模拟器 - 系统音频采集（渲染进程）
 *
 * 使用 chromeMediaSource: 'system' 直接捕获系统音频输出。
 * 这是 Chromium/Electron 专有 API，不需要屏幕选择器。
 */

let mediaRecorder: MediaRecorder | null = null;
let stream: MediaStream | null = null;
let _started = false;
const CHUNK_SEC = 10;

export async function startSystemAudioCapture(): Promise<void> {
  stopSystemAudioCapture();

  try {
    // chromeMediaSource: 'system' — 直接捕获系统音频，不弹屏幕选择器
    // macOS 首次调用会自动弹出「屏幕录制」权限对话框
    stream = await (navigator.mediaDevices as any).getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'system',
        },
      },
      video: false,
    });

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
      throw new Error(
        '未获取到系统音频轨道。\n\n请确认：\n' +
        '1. macOS 版本 ≥ 13 (Ventura)\n' +
        '2. 系统设置 → 隐私与安全性 → 屏幕录制 → 伯乐模拟器 已开启\n' +
        '3. 当前有音频正在播放'
      );
    }

    // 监听流意外结束
    audioTracks.forEach((t) => {
      t.onended = () => {
        console.log('[system-audio] Track ended');
        stopSystemAudioCapture();
      };
    });

    const audioStream = new MediaStream(audioTracks);
    stream = audioStream;

    // MediaRecorder
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    mediaRecorder = new MediaRecorder(audioStream, { mimeType });

    mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0 && window.electronAPI) {
        event.data.arrayBuffer().then((buf: ArrayBuffer) => {
          window.electronAPI!.sendAudioChunk(buf);
        }).catch(() => {});
      }
    };

    mediaRecorder.onerror = () => {
      if (window.electronAPI) window.electronAPI.notifyCaptureError('MediaRecorder error');
    };

    mediaRecorder.onstop = () => {
      if (_started && window.electronAPI) window.electronAPI.notifyCaptureStopped();
      _started = false;
    };

    mediaRecorder.start(CHUNK_SEC * 1000);
    _started = true;
    console.log('[system-audio] Capture started via chromeMediaSource:system');

    if (window.electronAPI) window.electronAPI.notifyCaptureStarted();

  } catch (err: any) {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    mediaRecorder = null;
    _started = false;

    console.error('[system-audio] Failed:', err.name, err.message);
    if (window.electronAPI) window.electronAPI.notifyCaptureError(err.message);
    throw err;
  }
}

export function stopSystemAudioCapture(): void {
  _started = false;
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try { mediaRecorder.stop(); } catch (e) {}
    mediaRecorder = null;
  }
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
}

export function isSystemAudioCapturing(): boolean {
  return _started && mediaRecorder !== null && mediaRecorder.state === 'recording';
}
