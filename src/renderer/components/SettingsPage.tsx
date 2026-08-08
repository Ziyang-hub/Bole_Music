/**
 * 伯乐模拟器 - 设置页面
 *
 * 配置 AI 人格、API 密钥、功能开关
 * 设置通过 electron-store 持久化保存
 */

import React, { useState, useEffect } from 'react';

// AI 人格选项
const PERSONAS = [
  { id: 'literary', name: '文艺青年', icon: '🎨', desc: '用诗意的语言分析音乐，充满文学气息', example: '「这首歌像一封写给时光的情书...」' },
  { id: 'professional', name: '专业乐评人', icon: '🎼', desc: '从专业角度分析编曲、作词、演唱技巧', example: '「副歌部分的和弦从C大调转Am小调，营造出情绪的转折...」' },
  { id: 'warm', name: '暖心朋友', icon: '💛', desc: '像朋友一样聊天，关注你的感受和情绪', example: '「听起来你今天有点心事？愿意聊聊吗？」' },
  { id: 'humorous', name: '幽默伙伴', icon: '😄', desc: '用轻松幽默的方式点评音乐', example: '「这歌词写的，该不会是在我家装了摄像头吧！」' },
];

export default function SettingsPage() {
  // 设置状态
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [appInfo, setAppInfo] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // 加载设置
  useEffect(() => {
    async function load() {
      if (!window.electronAPI) {
        setLoaded(true);
        return;
      }
      try {
        const [s, info] = await Promise.all([
          window.electronAPI.getSettings(),
          window.electronAPI.getAppInfo(),
        ]);
        setSettings(s);
        setAppInfo(info);
      } catch (err) {
        console.error('加载设置失败:', err);
      }
      setLoaded(true);
    }
    load();
  }, []);

  // 更新单个设置项
  async function updateField<K extends keyof UserSettings>(
    field: K,
    value: UserSettings[K]
  ) {
    if (!settings || !window.electronAPI) return;
    const updated = { ...settings, [field]: value };
    setSettings(updated);

    // 自动保存
    try {
      await window.electronAPI.updateSettings({ [field]: value });
      showSaved();
    } catch (err) {
      console.error('保存设置失败:', err);
    }
  }

  // 保存 API 配置（多个字段一起保存）
  async function saveApiConfig() {
    if (!settings || !window.electronAPI) return;
    setSaving(true);
    try {
      await window.electronAPI.updateSettings({
        apiProvider: settings.apiProvider,
        apiKey: settings.apiKey,
        customEndpoint: settings.customEndpoint,
      });
      showSaved();
    } catch (err) {
      console.error('保存失败:', err);
    }
    setSaving(false);
  }

  function showSaved() {
    setSaveMsg('✅ 已保存');
    setTimeout(() => setSaveMsg(''), 2000);
  }

  // 加载中
  if (!loaded) {
    return (
      <div className="page settings-page">
        <p className="page-subtitle">加载中...</p>
      </div>
    );
  }

  // 没有 Electron API（浏览器模式）
  if (!window.electronAPI) {
    return (
      <div className="page settings-page">
        <h2 className="page-title">⚙️ 设置</h2>
        <div className="section-card">
          <p>设置功能需要在 Electron 桌面应用中运行。</p>
          <p style={{ marginTop: 8, color: 'var(--color-text-muted)' }}>
            请运行 <code>npm run dev</code> 启动桌面应用。
          </p>
        </div>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="page settings-page">
      <h2 className="page-title">⚙️ 设置</h2>
      <p className="page-subtitle">调整应用配置，让伯乐更懂你</p>

      {/* 保存提示 */}
      {saveMsg && <div className="save-toast">{saveMsg}</div>}

      {/* AI 人格 */}
      <div className="section-card">
        <div className="section-header">🤖 AI 伯乐人格</div>
        <p className="section-desc">选择一个你喜欢的对话风格，随时可以切换</p>
        <div className="persona-grid">
          {PERSONAS.map((p) => (
            <div
              key={p.id}
              className={`persona-card ${settings.persona === p.id ? 'selected' : ''}`}
              onClick={() => updateField('persona', p.id as any)}
            >
              <div className="persona-icon">{p.icon}</div>
              <div className="persona-name">{p.name}</div>
              <div className="persona-desc">{p.desc}</div>
              <div className="persona-example">{p.example}</div>
              {settings.persona === p.id && <div className="persona-check">✅ 当前选择</div>}
            </div>
          ))}
        </div>
      </div>

      {/* API 配置 */}
      <div className="section-card">
        <div className="section-header">🔑 AI 服务配置</div>
        <ApiKeyGuide type="ai" />

        <div className="setting-row">
          <label className="setting-label">AI 服务商</label>
          <select
            className="setting-select"
            value={settings.apiProvider}
            onChange={(e) => updateField('apiProvider', e.target.value as any)}
          >
            <option value="deepseek">DeepSeek（推荐）</option>
            <option value="qwen">通义千问（阿里）</option>
            <option value="openai">OpenAI</option>
            <option value="custom">自定义兼容接口</option>
          </select>
        </div>

        <div className="setting-row">
          <label className="setting-label">API 密钥</label>
          <div style={{ flex: 1, maxWidth: 400 }}>
            <input
              type="password"
              className="setting-input"
              style={{ width: '100%' }}
              placeholder="输入你的 API Key..."
              value={settings.apiKey}
              onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
            />
            <span className="setting-hint">密钥只保存在你的电脑上，不会上传到任何地方</span>
          </div>
        </div>

        {settings.apiProvider === 'custom' && (
          <div className="setting-row">
            <label className="setting-label">自定义 API 地址</label>
            <input
              type="text"
              className="setting-input"
              style={{ flex: 1, maxWidth: 400 }}
              placeholder="https://your-api.com/v1/chat/completions"
              value={settings.customEndpoint}
              onChange={(e) => setSettings({ ...settings, customEndpoint: e.target.value })}
            />
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <button className="send-button" onClick={saveApiConfig} disabled={saving}>
            {saving ? '保存中...' : '保存 API 配置'}
          </button>
          <span className="setting-hint" style={{ marginLeft: 12 }}>
            修改 API 配置后需要手动保存
          </span>
        </div>
      </div>

      {/* 功能开关 */}
      <div className="section-card">
        <div className="section-header">🎛️ 功能设置</div>

        <div className="setting-row">
          <div className="setting-info">
            <label className="setting-label">自动音频采集</label>
            <span className="setting-desc">自动监听电脑播放的音乐（macOS 需授予屏幕录制权限）</span>
          </div>
          <button
            className={`toggle ${settings.autoListen ? 'on' : 'off'}`}
            onClick={async () => {
              const newVal = !settings.autoListen;
              updateField('autoListen', newVal);

              if (window.electronAPI) {
                if (newVal) {
                  // 诊断
                  const diag = await window.electronAPI.diagnoseAudio();
                  const isMacOS = window.electronAPI.platform === 'darwin';

                  // 非 macOS：诊断不通过就阻止（Linux 无 PulseAudio 等硬问题）
                  if (!isMacOS && !diag.ready) {
                    const msg = '⚠️ 自动采集无法启动：\n\n' +
                      diag.issues.map((i: string) => '• ' + i).join('\n') +
                      '\n\n✅ 已就绪：\n' + diag.ok.map((o: string) => '• ' + o).join('\n');
                    alert(msg);
                    updateField('autoListen', false);
                    return;
                  }
                  // macOS：权限问题不阻塞，getDisplayMedia 会触发系统弹窗
                  if (isMacOS && diag.issues.length > 0) {
                    console.log('采集诊断警告:', diag.issues.join(', '));
                  }

                  // macOS：调用 getDisplayMedia 触发系统权限弹窗
                  if (isMacOS) {
                    try {
                      const { startSystemAudioCapture } = await import('../system-audio-capture');
                      await window.electronAPI.startAudioCapture();
                      await startSystemAudioCapture();
                    } catch (err: any) {
                      // 用户取消不算错误
                      if (err.name === 'AbortError') {
                        updateField('autoListen', false);
                        await window.electronAPI.stopAudioCapture();
                        return;
                      }
                      // 显示真实错误，帮助排查
                      const errMsg = err.message || err.name || '未知错误';
                      const isDenied = err.name === 'NotAllowedError' || errMsg.includes('permission');
                      if (isDenied) {
                        const goSettings = window.confirm(
                          '⚠️ 屏幕录制权限未授权\n\n' +
                          '请前往系统设置中开启权限。\n\n' +
                          '点击「确定」自动打开系统设置 → 隐私与安全性 → 屏幕录制 → 勾选「伯乐模拟器」'
                        );
                        if (goSettings) {
                          try { await window.electronAPI.openScreenRecordingSettings(); } catch {}
                        }
                      } else {
                        alert('❌ 采集启动失败:\n\n' + errMsg);
                      }
                      updateField('autoListen', false);
                      await window.electronAPI.stopAudioCapture();
                      return;
                    }
                  } else {
                    await window.electronAPI.startAudioCapture();
                  }
                } else {
                  // 停止采集
                  if (window.electronAPI.platform === 'darwin') {
                    const { stopSystemAudioCapture } = await import('../system-audio-capture');
                    stopSystemAudioCapture();
                  }
                  await window.electronAPI.stopAudioCapture();
                }
              }
            }}
          >
            {settings.autoListen ? '已开启' : '已关闭'}
          </button>
        </div>

        {/* 歌曲识别 — 已简化为 Shazam 单一后端 */}
        <div className="setting-row">
          <div className="setting-info">
            <label className="setting-label">🎵 歌曲识别</label>
            <span className="setting-desc">使用 Shazam 引擎，免费、零配置、即开即用</span>
          </div>
          <span style={{ color: 'var(--color-success)', fontSize: 13, fontWeight: 600 }}>✅ 已启用</span>
        </div>

        {/* 音频采集配置引导 */}
        {settings.autoListen && <AudioSetupGuide />}

        <div className="setting-row">
          <div className="setting-info">
            <label className="setting-label">界面主题</label>
            <span className="setting-desc">切换深色/浅色主题</span>
          </div>
          <button
            className={`toggle ${settings.theme === 'dark' ? 'on' : 'off'}`}
            onClick={() => updateField('theme', settings.theme === 'dark' ? 'light' : 'dark')}
          >
            {settings.theme === 'dark' ? '🌙 深色' : '☀️ 浅色'}
          </button>
        </div>

        <div className="setting-row">
          <div className="setting-info">
            <label className="setting-label">分析完成通知</label>
            <span className="setting-desc">歌曲分析完成后弹出系统通知</span>
          </div>
          <button
            className={`toggle ${settings.notifyOnAnalysis ? 'on' : 'off'}`}
            onClick={() => updateField('notifyOnAnalysis', !settings.notifyOnAnalysis)}
          >
            {settings.notifyOnAnalysis ? '已开启' : '已关闭'}
          </button>
        </div>

        <div className="setting-row">
          <div className="setting-info">
            <label className="setting-label">每日听歌小结</label>
            <span className="setting-desc">每天晚上自动生成今日听歌小结</span>
          </div>
          <button
            className={`toggle ${settings.dailyReport ? 'on' : 'off'}`}
            onClick={() => updateField('dailyReport', !settings.dailyReport)}
          >
            {settings.dailyReport ? '已开启' : '已关闭'}
          </button>
        </div>

        <div className="setting-row">
          <div className="setting-info">
            <label className="setting-label">每周听歌报告</label>
            <span className="setting-desc">每周自动生成听歌分析报告</span>
          </div>
          <button
            className={`toggle ${settings.weeklyReport ? 'on' : 'off'}`}
            onClick={() => updateField('weeklyReport', !settings.weeklyReport)}
          >
            {settings.weeklyReport ? '已开启' : '已关闭'}
          </button>
        </div>
      </div>

      {/* 隐私与数据 */}
      <PrivacySection />

      {/* 使用统计 */}
      <UsageSection />

      {/* 更新 */}
      <UpdateSection />

      {/* 关于 */}
      <div className="section-card">
        <div className="section-header">ℹ️ 关于伯乐模拟器</div>
        <div className="about-info">
          <div className="about-row"><span>版本</span><span>{appInfo?.version || '1.0.0'}</span></div>
          <div className="about-row"><span>理念</span><span>高山流水遇知音 🎵</span></div>
        </div>
      </div>
    </div>
  );
}

/** API Key 获取指引 */
function ApiKeyGuide({ type }: { type: 'ai' | 'recognition' }) {
  const [show, setShow] = useState(false);

  if (type === 'ai') {
    return (
      <div style={{ fontSize: 12, lineHeight: 1.8, marginBottom: 12 }}>
        <p className="section-desc" style={{ marginBottom: 4 }}>
          连接 AI 服务让伯乐拥有真正的智慧。
        </p>
        <button
          onClick={() => setShow(!show)}
          style={{
            background: 'none', border: 'none', color: 'var(--color-accent)',
            cursor: 'pointer', fontSize: 12, padding: 0, textDecoration: 'underline',
          }}
        >
          {show ? '收起 ▲' : '📖 如何获取 API Key？（点击展开）'}
        </button>
        {show && (
          <div style={{
            marginTop: 8, padding: 12, background: 'var(--color-bg-tertiary)',
            borderRadius: 8, border: '1px solid var(--color-border)',
          }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--color-accent-light)' }}>
              💵 推荐：DeepSeek（国内直连，便宜好用）
            </div>
            <div>1. 打开 <a href="https://platform.deepseek.com" target="_blank" style={{ color: 'var(--color-accent)' }}>platform.deepseek.com</a></div>
            <div>2. 用手机号注册（1分钟）</div>
            <div>3. 点击左侧「API Keys」→「创建 API Key」</div>
            <div>4. 复制 Key，粘贴到上方输入框</div>
            <div style={{ color: 'var(--color-text-muted)', marginTop: 4 }}>💰 新用户送 500 万 tokens，够用很久</div>

            <div style={{ fontWeight: 600, marginTop: 12, marginBottom: 8, color: 'var(--color-accent-light)' }}>
              🆓 备选：通义千问（阿里云）
            </div>
            <div>1. 打开 <a href="https://dashscope.aliyun.com" target="_blank" style={{ color: 'var(--color-accent)' }}>dashscope.aliyun.com</a></div>
            <div>2. 用支付宝/淘宝账号登录</div>
            <div>3. 点击「API Key 管理」→「创建 API Key」</div>
            <div style={{ color: 'var(--color-text-muted)', marginTop: 4 }}>💰 新用户有百万 tokens 免费额度</div>
          </div>
        )}
      </div>
    );
  }

  // recognition type — 简化为 Shazam，免费零配置
  return (
    <div style={{ fontSize: 12, lineHeight: 1.8, marginBottom: 12 }}>
      <p className="section-desc" style={{ marginBottom: 4, color: "#4caf50" }}>
        🎵 歌曲识别使用 Shazam 引擎，免费、零配置、即开即用。无需任何 API Key。
      </p>
    </div>
  );
}

/**
 * 音频采集配置引导组件
 */
function AudioSetupGuide() {
  const [capability, setCapability] = useState<any>(null);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.checkCaptureCapability().then(setCapability);
    }
  }, []);

  if (!capability) return null;

  return (
    <div style={{
      margin: '12px 0',
      padding: 16,
      background: 'var(--color-bg-tertiary)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--color-border)',
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--color-accent-light)' }}>
        🎧 音频采集配置指南
      </div>

      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>
        当前平台：<strong>{capability.platform === 'win32' ? 'Windows' : capability.platform === 'darwin' ? 'macOS' : 'Linux'}</strong>
        {capability.available ? ' ✅ 环境就绪' : ' ⚠️ 需要配置'}
      </div>

      {capability.needs.length > 0 && (
        <div style={{ fontSize: 12, lineHeight: 1.8 }}>
          <div style={{ color: 'var(--color-text-secondary)', marginBottom: 4 }}>需要安装：</div>
          {capability.needs.map((need: string, i: number) => (
            <div key={i} style={{ color: 'var(--color-text-muted)', paddingLeft: 12 }}>
              {i + 1}. {need}
            </div>
          ))}
        </div>
      )}

      {capability.platform === 'win32' && (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8, lineHeight: 1.6 }}>
          <div style={{ color: 'var(--color-success)', fontWeight: 600 }}>🎉 Windows 零安装！</div>
          <div>系统内置 WASAPI 音频采集，打开开关即可使用。</div>
          <div style={{ marginTop: 4 }}>如果无法采集到声音，可安装 <a href="https://vb-audio.com/Cable/" style={{ color: 'var(--color-accent)' }}>VB-Cable</a>（免费）作为备选。</div>
        </div>
      )}

      {capability.platform === 'darwin' && (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8, lineHeight: 1.6 }}>
          <div style={{ color: 'var(--color-success)', fontWeight: 600 }}>🎉 macOS 零安装！</div>
          <div>使用 macOS 内置的 ScreenCaptureKit 采集系统音频，无需安装任何软件。</div>
          <div style={{ marginTop: 4 }}>📌 首次使用步骤：</div>
          <div>1. 打开自动采集开关</div>
          <div>2. 在弹出的系统对话框中点击「允许屏幕录制」</div>
          <div>3. 即可自动监听电脑播放的音乐</div>
          <div style={{ color: 'var(--color-text-muted)', marginTop: 4 }}>⚠️ 需要 macOS 13 (Ventura) 或更新版本</div>
          <div style={{ color: 'var(--color-text-muted)' }}>⚠️ 如提示权限被拒绝，请前往 系统设置 → 隐私与安全性 → 屏幕录制 中开启</div>
        </div>
      )}

      {capability.platform === 'linux' && (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8, lineHeight: 1.6 }}>
          <div style={{ color: 'var(--color-success)', fontWeight: 600 }}>🎉 Linux 零安装！</div>
          <div>系统内置 PulseAudio 音频采集，打开开关即可使用。</div>
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8, fontStyle: 'italic' }}>
        💡 音频采集使用 Shazam 引擎自动识别，免费且零配置。只需采集到音频即可自动识别歌曲。
      </div>
    </div>
  );
}

/**
 * 隐私与数据组件
 */
function PrivacySection() {
  const [cleared, setCleared] = useState(false);

  async function handleClear() {
    if (!window.confirm('确定要清除所有数据吗？\n\n这将删除：\n- 聊天记录\n- API 密钥\n- 听歌日记\n- 使用统计\n\n此操作不可撤销！')) return;
    if (!window.electronAPI) return;
    await window.electronAPI.resetAllData();
    // 清除后立即刷新页面，让用户看到干净的状态
    window.location.reload();
  }

  return (
    <div className="section-card">
      <div className="section-header">🔒 隐私与数据</div>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
        所有数据保存在本地，不上传任何服务器。卸载 App 后请先清除数据。
      </p>
      <button
        onClick={handleClear}
        style={{
          padding: '8px 20px', border: '1px solid #f44336', borderRadius: 8,
          background: 'var(--color-danger-bg)', color: 'var(--color-danger)', cursor: 'pointer',
          fontSize: 13, fontFamily: 'var(--font-sans)',
        }}
      >
        🗑️ 清除所有本地数据
      </button>
      {cleared && <span style={{ color: 'var(--color-success)', fontSize: 12, marginLeft: 12 }}>✅ 已清除</span>}
    </div>
  );
}

/**
 * 使用统计组件
 */
function UsageSection() {
  const [usage, setUsage] = useState<UsageData | null>(null);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getUsageStats().then(setUsage);
    }
  }, []);

  if (!usage || !usage.firstUsed) {
    return (
      <div className="section-card">
        <div className="section-header">📊 使用统计</div>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>还没有使用数据，开始使用伯乐吧！</p>
      </div>
    );
  }

  return (
    <div className="section-card">
      <div className="section-header">📊 使用统计</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="stat-card">
          <div className="stat-value">{usage.totalAnalyses}</div>
          <div className="stat-label">歌曲分析次数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{usage.totalChats}</div>
          <div className="stat-label">对话次数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{usage.playlistImports}</div>
          <div className="stat-label">歌单导入</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {usage.firstUsed ? new Date(usage.firstUsed).toLocaleDateString('zh-CN') : '-'}
          </div>
          <div className="stat-label">首次使用</div>
        </div>
      </div>
    </div>
  );
}

/**
 * 自动更新组件
 */
function UpdateSection() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({ status: 'not-available' });
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) return;

    // 获取当前状态
    window.electronAPI.getUpdateStatus().then(setUpdateInfo);

    // 监听状态变化
    window.electronAPI.onUpdateStatusChanged(setUpdateInfo);
  }, []);

  async function handleCheck() {
    if (!window.electronAPI) return;
    setChecking(true);
    const info = await window.electronAPI.checkForUpdate();
    setUpdateInfo(info);
    setChecking(false);
  }

  async function handleDownload() {
    if (!window.electronAPI) return;
    const info = await window.electronAPI.downloadUpdate();
    setUpdateInfo(info);
  }

  async function handleInstall() {
    if (!window.electronAPI) return;
    await window.electronAPI.installUpdate();
  }

  return (
    <div className="section-card">
      <div className="section-header">🔄 软件更新</div>

      <div style={{ marginBottom: 12 }}>
        {updateInfo.status === 'not-available' && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
            ✅ 当前已是最新版本
          </p>
        )}
        {updateInfo.status === 'checking' && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
            ⏳ 正在检查更新...
          </p>
        )}
        {updateInfo.status === 'available' && updateInfo.version && (
          <div>
            <p style={{ color: 'var(--color-accent-light)', fontSize: 13, fontWeight: 600 }}>
              🎉 发现新版本 v{updateInfo.version}
            </p>
            {updateInfo.releaseNotes && (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 4, whiteSpace: 'pre-wrap' }}>
                {updateInfo.releaseNotes.slice(0, 200)}
              </p>
            )}
          </div>
        )}
        {updateInfo.status === 'downloading' && (
          <p style={{ color: 'var(--color-accent-light)', fontSize: 13 }}>
            📥 下载中... {updateInfo.progress}%
          </p>
        )}
        {updateInfo.status === 'downloaded' && (
          <p style={{ color: 'var(--color-success)', fontSize: 13, fontWeight: 600 }}>
            ✅ 更新已下载，重启后生效
          </p>
        )}
        {updateInfo.status === 'error' && (
          <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>
            ❌ {updateInfo.error || '检查更新失败'}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="send-button" onClick={handleCheck} disabled={checking}
          style={{ fontSize: 12, padding: '6px 16px', height: 'auto' }}>
          {checking ? '检查中...' : '检查更新'}
        </button>
        {updateInfo.status === 'available' && (
          <button className="send-button" onClick={handleDownload}
            style={{ fontSize: 12, padding: '6px 16px', height: 'auto', background: 'var(--color-success)' }}>
            下载更新
          </button>
        )}
        {updateInfo.status === 'downloaded' && (
          <button className="send-button" onClick={handleInstall}
            style={{ fontSize: 12, padding: '6px 16px', height: 'auto', background: 'var(--color-success)' }}>
            重启安装
          </button>
        )}
      </div>
    </div>
  );
}
