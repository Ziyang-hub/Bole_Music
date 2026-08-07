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
        <p className="section-desc">
          连接 AI 服务让伯乐拥有真正的智慧。
          <br />
          💡 <strong>推荐</strong>：DeepSeek（注册即送 500 万 tokens，便宜好用）
          <a href="https://platform.deepseek.com" target="_blank" style={{ color: 'var(--color-accent)', marginLeft: 4 }}>去注册 →</a>
        </p>

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
            onClick={() => updateField('autoListen', !settings.autoListen)}
          >
            {settings.autoListen ? '已开启' : '已关闭'}
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
