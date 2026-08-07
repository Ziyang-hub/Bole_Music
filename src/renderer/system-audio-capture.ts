/**
 * 伯乐模拟器 - 系统音频采集（渲染进程）
 *
 * 使用 Electron 原生 desktopCapturer API 获取系统音频流。
 * 比 getDisplayMedia 更可靠，不需要用户选屏幕。
 *
 * 原理：
 *   1. desktopCapturer.getSources({ types: ['screen'] }) 获取屏幕源
 *   2. getUserMedia 使用 chromeMediaSource: 'desktop' 捕获
 *   3. macOS 首次调用会自动弹出系统权限对话框
 *   4. 权限通过后获取音频流 → MediaRecorder → IPC 发送到主进程
 */

let mediaRecorder: MediaRecorder | null = null;
let stream: MediaStream | null = null;
const CHUNK_SEC = 10;

export async function startSystemAudioCapture(): Promise<void> {
  try {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }

    // 1. 获取屏幕源（Electron 原生 API）
    const sources = await window.electronAPI.getScreenSources();
    if (!sources || sources.length === 0) {
      throw new Error('未找到可录制的屏幕');
    }

    const sourceId = sources[0].id;

    // 2. 使用 getUserMedia + chromeMediaSource 捕获桌面（含系统音频）
    //    首次调用会触发 macOS 权限对话框
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'desktop' as any,
          chromeMediaSourceId: sourceId,
        } as any,
      } as any,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop' as any,
          chromeMediaSourceId: sourceId,
          maxWidth: 1,
          maxHeight: 1,
          maxFrameRate: 1,
        } as any,
      } as any,
    });

    // 3. 停止视频轨道（只要音频）
    const videoTracks = stream.getVideoTracks();
    videoTracks.forEach((t) => t.stop());

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      throw new Error(
        '未获取到系统音频轨道。\n\n请确认：\n' +
        '1. macOS 版本 ≥ 13 (Ventura)\n' +
        '2. 系统设置 → 隐私与安全性 → 屏幕录制 → 已勾选「伯乐模拟器」\n' +
        '3. 当前有音频正在播放'
      );
    }

    // 创建纯音频流
    const audioStream = new MediaStream(audioTracks);
    stream = audioStream;

    // 4. MediaRecorder 录制
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
      if (window.electronAPI) {
        window.electronAPI.notifyCaptureError('MediaRecorder error');
      }
    };

    mediaRecorder.start(CHUNK_SEC * 1000);
    console.log('[system-audio] Capture started, chunk=' + CHUNK_SEC + 's');

    if (window.electronAPI) {
      window.electronAPI.notifyCaptureStarted();
    }
  } catch (err: any) {
    console.error('[system-audio] Failed to start:', err.name, err.message);
    if (window.electronAPI) {
      window.electronAPI.notifyCaptureError(err.message);
    }
    throw err;
  }
}

export function stopSystemAudioCapture(): void {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try { mediaRecorder.stop(); } catch (e) {}
    mediaRecorder = null;
  }
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  if (window.electronAPI) {
    window.electronAPI.notifyCaptureStopped();
  }
  console.log('[system-audio] Capture stopped');
}

export function isSystemAudioCapturing(): boolean {
  return mediaRecorder !== null && mediaRecorder.state === 'recording';
}
