/**
 * 伯乐模拟器 - 系统音频采集（渲染进程）
 *
 * 通过主进程 desktopCapturer 获取屏幕源，
 * 再用 getUserMedia 捕获桌面（含系统音频）。
 */

let mediaRecorder: MediaRecorder | null = null;
let stream: MediaStream | null = null;
let _originalStream: MediaStream | null = null; // 保持原始采集会话存活
let _started = false;
const CHUNK_SEC = 15; // 15 秒足够 Shazam 匹配

export async function startSystemAudioCapture(): Promise<void> {
  // 防重入：如果已经在采集，直接返回
  if (_started && mediaRecorder && mediaRecorder.state === 'recording') {
    console.log('[system-audio] Already capturing, skipping duplicate start');
    return;
  }

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
    console.log('[system-audio] Trying getUserMedia format 1, source:', sourceId);
    _originalStream = await (navigator.mediaDevices as any).getUserMedia({
      audio: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId },
      video: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId,
               maxWidth: 1, maxHeight: 1, maxFrameRate: 1 },
    });
  } catch (e1: any) {
    console.log('[system-audio] Format 1 failed:', e1.message, e1.name, ', trying format 2...');
    // 备选：旧版 mandatory 格式
    _originalStream = await (navigator.mediaDevices as any).getUserMedia({
      audio: {
        mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId },
      },
      video: {
        mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId,
                     maxWidth: 1, maxHeight: 1, maxFrameRate: 1 },
      },
    });
  }

  console.log('[system-audio] getUserMedia success, tracks:',
    _originalStream.getTracks().map(t => `${t.kind}:${t.readyState}`));

  // 3. 停止视频轨道
  _originalStream.getVideoTracks().forEach((t) => t.stop());

  const audioTracks = _originalStream.getAudioTracks();
  console.log('[system-audio] Audio tracks:', audioTracks.length);
  if (audioTracks.length === 0) {
    _originalStream.getTracks().forEach((t) => t.stop());
    _originalStream = null;
    throw new Error('未获取到系统音频轨道');
  }

  audioTracks.forEach((t) => {
    t.onended = () => { console.log('[system-audio] Audio track ended unexpectedly'); stopSystemAudioCapture(); };
  });

  // 用纯音频轨道创建新流给 MediaRecorder
  // 同时保留 _originalStream 引用防止采集会话被 GC
  stream = new MediaStream(audioTracks);

  // 4. MediaRecorder — 优先 audio/webm（纯音频流）
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'video/webm';

  console.log('[system-audio] Using MIME:', mimeType);

  mediaRecorder = new MediaRecorder(stream, { mimeType });

  mediaRecorder.ondataavailable = (event: BlobEvent) => {
    if (event.data.size > 0 && window.electronAPI) {
      console.log('[system-audio] Chunk available, size:', event.data.size);
      event.data.arrayBuffer().then((buf: ArrayBuffer) => {
        window.electronAPI!.sendAudioChunk(buf);
      }).catch((e) => { console.error('[system-audio] sendAudioChunk error:', e); });
    }
  };

  mediaRecorder.onerror = (e) => {
    console.error('[system-audio] MediaRecorder error:', e);
    if (window.electronAPI) window.electronAPI.notifyCaptureError('MediaRecorder error');
  };

  mediaRecorder.onstop = () => {
    console.log('[system-audio] MediaRecorder onstop');
    _started = false;
    if (window.electronAPI) window.electronAPI.notifyCaptureStopped();
  };

  mediaRecorder.start(CHUNK_SEC * 1000);
  _started = true;
  console.log('[system-audio] Capture started, state:', mediaRecorder.state);

  if (window.electronAPI) window.electronAPI.notifyCaptureStarted();
}

export function stopSystemAudioCapture(): void {
  console.log('[system-audio] stopSystemAudioCapture called, _started:', _started);
  const prevRecorder = mediaRecorder;
  mediaRecorder = null;
  // 先清掉 onstop，防止旧 recorder 的异步 onstop 误通知主进程
  if (prevRecorder) {
    prevRecorder.onstop = null;
    prevRecorder.onerror = null;
    prevRecorder.ondataavailable = null;
    if (prevRecorder.state !== 'inactive') {
      try { prevRecorder.stop(); } catch (e) { console.error('[system-audio] stop error:', e); }
    }
  }
  _started = false;
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  if (_originalStream) {
    _originalStream.getTracks().forEach((t) => t.stop());
    _originalStream = null;
  }
}

export function isSystemAudioCapturing(): boolean {
  return _started && mediaRecorder !== null && mediaRecorder.state === 'recording';
}
