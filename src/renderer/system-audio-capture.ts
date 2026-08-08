/**
 * 伯乐模拟器 - 系统音频采集（渲染进程）
 *
 * 使用标准 Web API getDisplayMedia() 获取系统音频流。
 * 不依赖 Electron 专有 API（desktopCapturer），兼容性更好。
 */

let mediaRecorder: MediaRecorder | null = null;
let stream: MediaStream | null = null;
let _started = false;
const CHUNK_SEC = 10;

export async function startSystemAudioCapture(): Promise<void> {
  stopSystemAudioCapture();

  try {
    // getDisplayMedia 是标准 Web API，macOS 上自动触发权限对话框
    // 请求最小视频 + 系统音频
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: 1 },
        height: { ideal: 1 },
        frameRate: { ideal: 1 },
      } as MediaTrackConstraints,
      audio: true,
    } as any);

    // 停止视频轨道，只保留音频
    stream.getVideoTracks().forEach((t) => t.stop());

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
      throw new Error(
        '未获取到系统音频轨道。\n\n请确认：\n' +
        '1. macOS 版本 ≥ 13 (Ventura)\n' +
        '2. 在弹出的对话框中选择了屏幕并勾选音频\n' +
        '3. 系统设置 → 隐私与安全性 → 屏幕录制 → 已勾选伯乐模拟器'
      );
    }

    // 监听流意外结束
    audioTracks.forEach((t) => {
      t.onended = () => {
        console.log('[system-audio] Track ended unexpectedly');
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
    console.log('[system-audio] Capture started via getDisplayMedia');

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
