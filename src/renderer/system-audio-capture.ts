/**
 * 伯乐模拟器 - 系统音频采集（渲染进程）
 *
 * 通过主进程 desktopCapturer 获取屏幕源，
 * 再用 getUserMedia 捕获桌面（含系统音频）。
 */

let mediaRecorder: MediaRecorder | null = null;
let stream: MediaStream | null = null;
let _started = false;
const CHUNK_SEC = 10;

export async function startSystemAudioCapture(): Promise<void> {
  stopSystemAudioCapture();

  if (!window.electronAPI) throw new Error('Electron API not available');

  // 1. 通过主进程获取屏幕源
  const sources = await window.electronAPI.getScreenSources();
  console.log('[system-audio] Sources:', sources);
  if (!sources || sources.length === 0) {
    throw new Error('未找到可录制的屏幕源');
  }

  const sourceId = sources[0].id;

  // 2. 捕获桌面（含系统音频）——尝试两种约束格式
  try {
    console.log('[system-audio] Trying getUserMedia with source:', sourceId);
    stream = await (navigator.mediaDevices as any).getUserMedia({
      audio: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId },
      video: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId,
               maxWidth: 1, maxHeight: 1, maxFrameRate: 1 },
    });
  } catch (e1: any) {
    console.log('[system-audio] Format 1 failed:', e1.message, ', trying format 2...');
    // 备选：旧版 mandatory 格式
    stream = await (navigator.mediaDevices as any).getUserMedia({
      audio: {
        mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId },
      },
      video: {
        mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId,
                     maxWidth: 1, maxHeight: 1, maxFrameRate: 1 },
      },
    });
  }

  // 3. 停止视频轨道
  stream.getVideoTracks().forEach((t) => t.stop());

  const audioTracks = stream.getAudioTracks();
  console.log('[system-audio] Audio tracks:', audioTracks.length);
  if (audioTracks.length === 0) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
    throw new Error('未获取到系统音频轨道');
  }

  audioTracks.forEach((t) => {
    t.onended = () => { console.log('[system-audio] Track ended'); stopSystemAudioCapture(); };
  });

  stream = new MediaStream(audioTracks);

  // 4. MediaRecorder
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus' : 'audio/webm';

  mediaRecorder = new MediaRecorder(stream, { mimeType });

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
  console.log('[system-audio] Capture started');

  if (window.electronAPI) window.electronAPI.notifyCaptureStarted();

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
