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
        const s = await window.electronAPI.getSettings();
        setSettings(s);
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
            <span className="setting-desc">自动监听电脑播放的音乐（需要安装虚拟音频设备）</span>
          </div>
          <button
            className={`toggle ${settings.autoListen ? 'on' : 'off'}`}
            onClick={async () => {
              const newVal = !settings.autoListen;
              updateField('autoListen', newVal);
              // 真正启动/停止音频采集
              if (window.electronAPI) {
                if (newVal) {
                  await window.electronAPI.startAudioCapture();
                } else {
                  await window.electronAPI.stopAudioCapture();
                }
              }
            }}
          >
            {settings.autoListen ? '已开启' : '已关闭'}
          </button>
        </div>

        <ApiKeyGuide type="recognition" />

        {/* 识别后端选择 */}
        <div className="setting-row">
          <div className="setting-info">
            <label className="setting-label">歌曲识别后端</label>
            <span className="setting-desc">选择识别服务（自动模式会依次尝试）</span>
          </div>
          <select
            className="setting-select"
            value={settings.recognitionBackend || 'auto'}
            onChange={(e) => updateField('recognitionBackend', e.target.value as any)}
          >
            <option value="auto">🔄 自动（优先可用）</option>
            <option value="audd">💵 AudD（商业指纹）</option>
            <option value="acoustid">🆓 AcoustID（开源指纹）</option>
          </select>
        </div>

        {/* AudD API Key */}
        <div className="setting-row">
          <label className="setting-label">AudD API Key</label>
          <input
            type="password"
            className="setting-input"
            style={{ flex: 1, maxWidth: 300 }}
            placeholder="去 audd.io 注册获取（免费300次/月）"
            value={settings.auddApiKey || ''}
            onChange={(e) => setSettings({ ...settings, auddApiKey: e.target.value })}
          />
          <button className="send-button" style={{ fontSize: 11, padding: '6px 12px', height: 'auto' }}
            onClick={async () => {
              if (!window.electronAPI) return;
              await window.electronAPI.updateSettings({ auddApiKey: settings.auddApiKey });
              showSaved();
            }}>
            保存
          </button>
        </div>

        {/* AcoustID Client Key */}
        <div className="setting-row">
          <label className="setting-label">AcoustID Client Key</label>
          <input
            type="text"
            className="setting-input"
            style={{ flex: 1, maxWidth: 300 }}
            placeholder="去 acoustid.org 注册获取（免费）"
            value={settings.acoustidClientKey || ''}
            onChange={(e) => setSettings({ ...settings, acoustidClientKey: e.target.value })}
          />
          <button className="send-button" style={{ fontSize: 11, padding: '6px 12px', height: 'auto' }}
            onClick={async () => {
              if (!window.electronAPI) return;
              await window.electronAPI.updateSettings({ acoustidClientKey: settings.acoustidClientKey });
              showSaved();
            }}>
            保存
          </button>
        </div>

        <BackendStatus />

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

      {/* 使用统计 */}
      <UsageSection />

      {/* 更新 */}
      <UpdateSection />

      {/* 关于 */}
      <div className="section-card">
        <div className="section-header">ℹ️ 关于伯乐模拟器</div>
        <div className="about-info">
          <div className="about-row"><span>版本</span><span>1.0.0</span></div>
          <div className="about-row"><span>技术栈</span><span>Electron + React + TypeScript</span></div>
          <div className="about-row"><span>AI 服务</span><span>{settings.apiProvider.toUpperCase()}</span></div>
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
            <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>💰 新用户送 500 万 tokens，够用很久</div>

            <div style={{ fontWeight: 600, marginTop: 12, marginBottom: 8, color: 'var(--color-accent-light)' }}>
              🆓 备选：通义千问（阿里云）
            </div>
            <div>1. 打开 <a href="https://dashscope.aliyun.com" target="_blank" style={{ color: 'var(--color-accent)' }}>dashscope.aliyun.com</a></div>
            <div>2. 用支付宝/淘宝账号登录</div>
            <div>3. 点击「API Key 管理」→「创建 API Key」</div>
            <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>💰 新用户有百万 tokens 免费额度</div>
          </div>
        )}
      </div>
    );
  }

  // recognition type
  return (
    <div style={{ fontSize: 12, lineHeight: 1.8, marginBottom: 12 }}>
      <p className="section-desc" style={{ marginBottom: 4 }}>
        识别当前播放的歌曲（可选，不填也能手动输入歌名分析）。
      </p>
      <button
        onClick={() => setShow(!show)}
        style={{
          background: 'none', border: 'none', color: 'var(--color-accent)',
          cursor: 'pointer', fontSize: 12, padding: 0, textDecoration: 'underline',
        }}
      >
        {show ? '收起 ▲' : '📖 如何获取识别 API Key？（点击展开）'}
      </button>
      {show && (
        <div style={{
          marginTop: 8, padding: 12, background: 'var(--color-bg-tertiary)',
          borderRadius: 8, border: '1px solid var(--color-border)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--color-accent-light)' }}>
            💵 AudD（商业指纹，推荐）
          </div>
          <div>1. 打开 <a href="https://audd.io" target="_blank" style={{ color: 'var(--color-accent)' }}>audd.io</a></div>
          <div>2. 点击「Try for Free」注册账号</div>
          <div>3. 登录后在 Dashboard 找到 API Key</div>
          <div>4. 复制 Key，粘贴到下方「AudD API Key」输入框</div>
          <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>💰 免费 300 次/月，个人使用完全够</div>

          <div style={{ fontWeight: 600, marginTop: 12, marginBottom: 8, color: 'var(--color-accent-light)' }}>
            🆓 AcoustID（开源免费，需安装 fpcalc）
          </div>
          <div>1. 打开 <a href="https://acoustid.org/login" target="_blank" style={{ color: 'var(--color-accent)' }}>acoustid.org</a></div>
          <div>2. 用邮箱注册（免费）</div>
          <div>3. 登录后点击「Applications」→ 创建新应用</div>
          <div>4. 复制 Client Key，粘贴到下方输入框</div>
          <div>5. 安装 fpcalc：
            <span style={{ color: 'var(--text-muted)' }}>
              Mac: <code>brew install chromaprint</code> / Windows: 下载 chromaprint
            </span>
          </div>
          <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>💰 完全免费，但中文歌识别率不如 AudD</div>
        </div>
      )}
    </div>
  );
}

/** 识别后端状态 */
function BackendStatus() {
  const [backends, setBackends] = useState<any[]>([]);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.checkBackends().then(setBackends);
    }
  }, []);

  if (backends.length === 0) return null;

  return (
    <div style={{ padding: '8px 0', fontSize: 12 }}>
      {backends.map((b) => (
        <div key={b.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
          <span style={{ color: 'var(--text-secondary)' }}>{b.name}</span>
          <span style={{ color: b.available ? '#4caf50' : '#f44336' }}>
            {b.available ? '✅ 可用' : '❌ 不可用'}
          </span>
        </div>
      ))}
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
          <div>📌 Windows 配置步骤：</div>
          <div>1. 下载安装 <a href="https://vb-audio.com/Cable/" style={{ color: 'var(--color-accent)' }}>VB-Cable</a>（虚拟音频设备）</div>
          <div>2. 下载安装 <a href="https://ffmpeg.org/download.html" style={{ color: 'var(--color-accent)' }}>ffmpeg</a></div>
          <div>3. 将系统音频输出设为 VB-Cable</div>
          <div>4. 重启应用后开启自动采集</div>
        </div>
      )}

      {capability.platform === 'darwin' && (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8, lineHeight: 1.6 }}>
          <div>📌 macOS 配置步骤：</div>
          <div>1. 终端运行：<code>brew install blackhole-2ch</code></div>
          <div>2. 打开「音频MIDI设置」→ 创建多输出设备</div>
          <div>3. 将 BlackHole 加入多输出设备</div>
          <div>4. 重启应用后开启自动采集</div>
        </div>
      )}

      {capability.platform === 'linux' && (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8, lineHeight: 1.6 }}>
          <div>📌 Linux 配置步骤：</div>
          <div>1. 安装 PulseAudio：<code>sudo apt install pulseaudio-utils</code></div>
          <div>2. 安装 ffmpeg：<code>sudo apt install ffmpeg</code></div>
          <div>3. 重启应用后开启自动采集</div>
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8, fontStyle: 'italic' }}>
        💡 音频采集需要配合 ACRCloud 歌曲识别服务使用。在环境变量中设置 ACRCLOUD_ACCESS_KEY 和 ACRCLOUD_ACCESS_SECRET 即可启用自动识别。
      </div>
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
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>还没有使用数据，开始使用伯乐吧！</p>
      </div>
    );
  }

  return (
    <div className="section-card">
      <div className="section-header">📊 使用统计</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="stat-card">
          <div className="stat-val">{usage.totalAnalyses}</div>
          <div className="stat-lbl">歌曲分析次数</div>
        </div>
        <div className="stat-card">
          <div className="stat-val">{usage.totalChats}</div>
          <div className="stat-lbl">对话次数</div>
        </div>
        <div className="stat-card">
          <div className="stat-val">{usage.playlistImports}</div>
          <div className="stat-lbl">歌单导入</div>
        </div>
        <div className="stat-card">
          <div className="stat-val">
            {usage.firstUsed ? new Date(usage.firstUsed).toLocaleDateString('zh-CN') : '-'}
          </div>
          <div className="stat-lbl">首次使用</div>
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
          <p style={{ color: '#4caf50', fontSize: 13, fontWeight: 600 }}>
            ✅ 更新已下载，重启后生效
          </p>
        )}
        {updateInfo.status === 'error' && (
          <p style={{ color: '#f44336', fontSize: 13 }}>
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
            style={{ fontSize: 12, padding: '6px 16px', height: 'auto', background: '#4caf50' }}>
            下载更新
          </button>
        )}
        {updateInfo.status === 'downloaded' && (
          <button className="send-button" onClick={handleInstall}
            style={{ fontSize: 12, padding: '6px 16px', height: 'auto', background: '#4caf50' }}>
            重启安装
          </button>
        )}
      </div>
    </div>
  );
}
