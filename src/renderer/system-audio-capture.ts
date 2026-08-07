/**
 * 伯乐模拟器 - 系统音频采集（渲染进程）
 *
 * 在 macOS 上调用 getDisplayMedia 获取系统音频流，
 * 用 MediaRecorder 录制，通过 IPC 发送音频块到主进程。
 */

let mediaRecorder: MediaRecorder | null = null;
let stream: MediaStream | null = null;
let chunkSec = 10;

/**
 * 启动系统音频采集
 * 调用 getDisplayMedia → macOS 弹出屏幕选择器 → 用户选择 → 权限授予
 */
export async function startSystemAudioCapture(): Promise<void> {
  try {
    // getDisplayMedia 触发 macOS 屏幕录制权限对话框
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: 1 },
        height: { ideal: 1 },
        frameRate: { ideal: 1 },
      } as MediaTrackConstraints,
      audio: true,
    } as MediaStreamConstraints);

    // 停止所有视频轨道（只要音频）
    stream.getVideoTracks().forEach((t) => t.stop());

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      throw new Error('无法获取系统音频（请确认选择了正确的屏幕并勾选了音频共享）');
    }

    // 创建纯音频流
    const audioStream = new MediaStream(audioTracks);
    stream = audioStream;

    // MediaRecorder 录制
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

    mediaRecorder.start(chunkSec * 1000);
    console.log('[system-audio] Capture started, chunk=' + chunkSec + 's');

    // 通知主进程
    if (window.electronAPI) {
      window.electronAPI.notifyCaptureStarted();
    }
  } catch (err: any) {
    console.error('[system-audio] Failed to start:', err.message);
    if (window.electronAPI) {
      window.electronAPI.notifyCaptureError(err.message);
    }
    throw err;
  }
}

/**
 * 停止系统音频采集
 */
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

/**
 * 是否正在采集
 */
export function isSystemAudioCapturing(): boolean {
  return mediaRecorder !== null && mediaRecorder.state === 'recording';
}
