/**
 * 伯乐模拟器 - 系统音频采集（渲染进程）
 *
 * 通过主进程 desktopCapturer 获取屏幕源，
 * 再用 getUserMedia 捕获桌面（含系统音频）。
 *
 * 使用「定时 stop + 重建」方式代替 timeslice，
 * 确保每个 webm blob 都有完整的 EBML 头部。
 */

let mediaRecorder: MediaRecorder | null = null;
let stream: MediaStream | null = null;
let _originalStream: MediaStream | null = null; // 保持原始采集会话存活
let _started = false;
let _stopping = false;  // 用户主动停止标记，区分「循环重启」和「用户停止」
let _chunkTimer: ReturnType<typeof setTimeout> | null = null;
const CHUNK_SEC = 15; // 15 秒足够 Shazam 匹配

export async function startSystemAudioCapture(): Promise<void> {
  // 防重入：如果已经在采集，直接返回
  if (_started && mediaRecorder && mediaRecorder.state === 'recording') {
    console.log('[system-audio] Already capturing, skipping duplicate start');
    return;
  }

  stopSystemAudioCapture();

  if (!window.electronAPI) throw new Error('Electron API not available');

  // ---- 优先：ScreenCaptureKit 原生采集（不激活录音会话，蓝牙耳机音质零影响）----
  // 原生模式由主进程 spawn helper 完成，渲染进程无需 getUserMedia
  if (window.electronAPI.platform === 'darwin') {
    try {
      const r = await window.electronAPI.startAudioCapture();
      if (r.success && r.native) {
        console.log('[system-audio] ✅ Native ScreenCaptureKit capture started (no getUserMedia)');
        return;
      }
      console.log('[system-audio] Native capture unavailable, falling back to getUserMedia:', r.error);
    } catch (e: any) {
      console.log('[system-audio] Native capture attempt failed:', e?.message, ', falling back to getUserMedia');
    }
  }

  // 1. 通过主进程获取屏幕源（附带屏幕录制权限状态与真实错误）
  const { sources, status, error } = await window.electronAPI.getScreenSources();
  console.log('[system-audio] Sources:', sources, '| status:', status, '| error:', error);
  if (!sources || sources.length === 0) {
    // 系统 API 抛错（如 macOS 新版与 Electron 兼容问题）——显示真实错误便于定位
    if (error) {
      throw new Error(
        '获取屏幕源失败：' + error + '\n\n' +
        '若系统设置中有多个「伯乐模拟器」条目，请全部勾选并重启应用。\n' +
        '若仍失败，请把此错误信息反馈给开发者。'
      );
    }
    // 按权限状态给出针对性提示（macOS 屏幕录制权限授权后必须重启应用才生效）
    if (status === 'granted') {
      throw new Error(
        '权限已授权，但需要重启应用才能生效。\n\n' +
        'macOS 的屏幕录制权限在授权后必须重启应用才会生效。\n' +
        '请重启「伯乐模拟器」后重试。'
      );
    }
    if (status === 'denied' || status === 'restricted') {
      throw new Error(
        '屏幕录制权限被拒绝。\n\n' +
        '请前往 系统设置 → 隐私与安全性 → 屏幕录制，\n' +
        '勾选「伯乐模拟器」（如有多个条目请全部勾选），然后重启应用。'
      );
    }
    if (status === 'not-determined') {
      throw new Error(
        '未检测到屏幕录制权限请求。\n\n' +
        '如果系统弹出了权限请求窗口，请点击「允许」；\n' +
        '如果弹窗被遮挡，请点击 Dock 中的伯乐模拟器图标查看。'
      );
    }
    throw new Error('未找到可录制的屏幕源（状态：' + status + '）');
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

  // 4. 启动录制循环
  _stopping = false;
  _started = true;
  console.log('[system-audio] Capture started (stop+recreate mode)');

  if (window.electronAPI) window.electronAPI.notifyCaptureStarted();

  _startRecordingCycle();
}

/** 启动一次录制周期：录制 CHUNK_SEC 秒 → stop → 完整 blob */
function _startRecordingCycle(): void {
  if (_stopping || !stream) return;

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'video/webm';

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
    console.log('[system-audio] Recorder stopped');
    mediaRecorder = null;

    if (_stopping) {
      // 用户主动停止
      _started = false;
      if (window.electronAPI) window.electronAPI.notifyCaptureStopped();
    } else {
      // 周期结束：短暂延迟后重启，确保 webm 完整写入
      _chunkTimer = setTimeout(() => {
        _startRecordingCycle();
      }, 200);
    }
  };

  mediaRecorder.start(); // 不带 timeslice，stop 时才产生完整 blob
  console.log('[system-audio] Recording cycle started');

  // 定时停止（产生完整 webm blob）
  _chunkTimer = setTimeout(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
  }, CHUNK_SEC * 1000);
}

export function stopSystemAudioCapture(): void {
  console.log('[system-audio] stopSystemAudioCapture called, _started:', _started);
  _stopping = true;

  if (_chunkTimer) {
    clearTimeout(_chunkTimer);
    _chunkTimer = null;
  }

  const prevRecorder = mediaRecorder;
  mediaRecorder = null;
  if (prevRecorder) {
    prevRecorder.onstop = null;
    prevRecorder.onerror = null;
    prevRecorder.ondataavailable = null;
    if (prevRecorder.state !== 'inactive') {
      try { prevRecorder.stop(); } catch (e) { /* ignore */ }
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
  return _started && !_stopping && mediaRecorder !== null && mediaRecorder.state === 'recording';
}
