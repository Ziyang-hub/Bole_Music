/**
 * 伯乐模拟器 - 设置页面
 *
 * 应用设置：AI 人格选择、API 配置、外观设置等
 */

import React, { useState } from 'react';

// AI 人格选项
const PERSONAS = [
  {
    id: 'literary',
    name: '文艺青年',
    icon: '🎨',
    desc: '用诗意的语言分析音乐，充满文学气息',
    example: '「这首歌像一封写给时光的情书，每一个音符都在诉说着不舍与期待...」',
  },
  {
    id: 'professional',
    name: '专业乐评人',
    icon: '🎼',
    desc: '从专业角度分析编曲、作词、演唱技巧',
    example: '「歌曲采用A-B-A结构，副歌部分的和弦进行从C大调转到Am小调，营造出情绪的转折...」',
  },
  {
    id: 'warm',
    name: '暖心朋友',
    icon: '💛',
    desc: '像朋友一样聊天，关注你的感受和情绪',
    example: '「这首歌我也很喜欢！听起来你今天有点心事？愿意聊聊吗？」',
  },
  {
    id: 'humorous',
    name: '幽默伙伴',
    icon: '😄',
    desc: '用轻松幽默的方式点评音乐，制造欢乐',
    example: '「这歌词写的，该不会是在我家装了摄像头吧？怎么能把社畜的心声写得这么准！」',
  },
];

export default function SettingsPage() {
  // 状态（后续保存到本地）
  const [selectedPersona, setSelectedPersona] = useState('literary');
  const [autoListen, setAutoListen] = useState(false);
  const [dailyReport, setDailyReport] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [apiProvider, setApiProvider] = useState('openai');
  const [notifyOnAnalysis, setNotifyOnAnalysis] = useState(true);

  return (
    <div className="page settings-page">
      <h2 className="page-title">⚙️ 设置</h2>
      <p className="page-subtitle">调整应用配置，让伯乐更懂你</p>

      {/* AI 人格选择 */}
      <div className="section-card">
        <div className="section-header">🤖 AI 伯乐人格</div>
        <p className="section-desc">选择一个你喜欢的对话风格，随时可以切换</p>
        <div className="persona-grid">
          {PERSONAS.map((persona) => (
            <div
              key={persona.id}
              className={`persona-card ${selectedPersona === persona.id ? 'selected' : ''}`}
              onClick={() => setSelectedPersona(persona.id)}
            >
              <div className="persona-icon">{persona.icon}</div>
              <div className="persona-name">{persona.name}</div>
              <div className="persona-desc">{persona.desc}</div>
              <div className="persona-example">{persona.example}</div>
              {selectedPersona === persona.id && (
                <div className="persona-check">✅ 当前选择</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* API 配置 */}
      <div className="section-card">
        <div className="section-header">🔑 AI 服务配置</div>
        <p className="section-desc">连接 AI 服务让伯乐真正拥有「智慧」。不填的话会使用模拟模式</p>

        <div className="setting-row">
          <label className="setting-label">AI 服务商</label>
          <select
            className="setting-select"
            value={apiProvider}
            onChange={(e) => setApiProvider(e.target.value)}
          >
            <option value="openai">OpenAI (GPT-4o)</option>
            <option value="claude">Claude (Anthropic)</option>
            <option value="qwen">通义千问 (阿里)</option>
            <option value="ernie">文心一言 (百度)</option>
            <option value="local">本地模型 (Ollama)</option>
          </select>
        </div>

        <div className="setting-row">
          <label className="setting-label">API 密钥</label>
          <input
            type="password"
            className="setting-input"
            placeholder="输入你的 API Key..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <span className="setting-hint">密钥只保存在你的电脑上，不会上传</span>
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
            className={`toggle ${autoListen ? 'on' : 'off'}`}
            onClick={() => setAutoListen(!autoListen)}
          >
            {autoListen ? '已开启' : '已关闭'}
          </button>
        </div>

        <div className="setting-row">
          <div className="setting-info">
            <label className="setting-label">分析完成通知</label>
            <span className="setting-desc">歌曲分析完成后弹出系统通知</span>
          </div>
          <button
            className={`toggle ${notifyOnAnalysis ? 'on' : 'off'}`}
            onClick={() => setNotifyOnAnalysis(!notifyOnAnalysis)}
          >
            {notifyOnAnalysis ? '已开启' : '已关闭'}
          </button>
        </div>

        <div className="setting-row">
          <div className="setting-info">
            <label className="setting-label">每日听歌小结</label>
            <span className="setting-desc">每天晚上自动生成今日听歌小结</span>
          </div>
          <button
            className={`toggle ${dailyReport ? 'on' : 'off'}`}
            onClick={() => setDailyReport(!dailyReport)}
          >
            {dailyReport ? '已开启' : '已关闭'}
          </button>
        </div>

        <div className="setting-row">
          <div className="setting-info">
            <label className="setting-label">每周听歌报告</label>
            <span className="setting-desc">每周自动生成听歌分析报告</span>
          </div>
          <button
            className={`toggle ${weeklyReport ? 'on' : 'off'}`}
            onClick={() => setWeeklyReport(!weeklyReport)}
          >
            {weeklyReport ? '已开启' : '已关闭'}
          </button>
        </div>
      </div>

      {/* 关于 */}
      <div className="section-card">
        <div className="section-header">ℹ️ 关于伯乐模拟器</div>
        <div className="about-info">
          <div className="about-row">
            <span>版本</span>
            <span>1.0.0</span>
          </div>
          <div className="about-row">
            <span>技术栈</span>
            <span>Electron + React + TypeScript</span>
          </div>
          <div className="about-row">
            <span>理念</span>
            <span>高山流水遇知音 🎵</span>
          </div>
        </div>
      </div>
    </div>
  );
}
