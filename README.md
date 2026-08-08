# 🐴 伯乐模拟器

> 高山流水遇知音 —— 你的 AI 音乐伴侣

---

## 这是什么？

伯乐模拟器是一个桌面 App（支持 Windows 和 Mac），它能：

- 🎧 **自动识别歌曲**：播放音乐 → APP 自动识别 → AI 分析 → 对话展示（全自动）
- 🎵 **AI 智能分析**：输入歌名或粘贴链接，AI 自动搜索歌词和背景信息，用自然语言深度分析
- 🤖 **Agent 工具调用**：伯乐可主动搜索歌曲、获取歌词、搜索网络信息，像真正的知音
- 💬 **陪你聊音乐**：四种 AI 人格可选（文艺诗人/专业乐评人/暖心朋友/幽默伙伴），多轮对话
- 🔗 **打通网易云**：粘贴歌曲/歌单链接自动解析，应用内搜索歌曲
- 📊 **生成听歌报告**：日/周/月报告，AI 一键生成文字总结
- 📝 **记录听歌日记**：自动保存分析过的歌曲，可编辑笔记、AI 生成每日小结

> 「伯乐」取自「伯乐识马」的典故，寓意 AI 能像伯乐一样，发现每首歌的闪光点，成为你的音乐知音。

---

## 界面预览

| 页面 | 功能 |
|------|------|
| 💬 知音对话 | 输入歌名 / 粘贴链接 / 🔍搜索 / 📋歌单 / 🎤哼歌，与 AI 伯乐交流 |
| 📊 听歌报告 | 统计卡片、曲风分布、热门排行、日/周/月 AI 报告 |
| 📝 听歌日记 | 时间线展示，可编辑笔记，AI 生成每日小结 |
| ⚙️ 设置 | 配置 API Key、AI 人格（4 种）、主题切换、音频采集 |

---

## 怎么运行？

### 第一步：安装 Node.js

去 [Node.js 官网](https://nodejs.org) 下载安装 **LTS 版本**。

```bash
node --version   # 确认 >= 18
npm --version
```

### 第二步：下载并安装

```bash
git clone git@github.com:scorching12/Bole_Music.git
cd Bole_Music
npm install
npm run dev
```

### 第三步：配置 API Key

打开 APP → 设置页面，按页面指引注册并填入：

| Key | 用途 | 获取地址 | 费用 |
|-----|------|----------|:--:|
| DeepSeek API Key | AI 对话与分析 | platform.deepseek.com | 🆓 送 500 万 tokens |

> 也支持通义千问、OpenAI 和自定义 API 端点。

### 第四步（可选）：启用自动识别

**🎉 macOS 13+ 和 Windows 零安装！** 无需安装任何虚拟音频设备。

- **macOS**: 打开「自动音频采集」→ 弹出屏幕选择器 → 允许权限 → 自动开始采集
- **Windows**: 打开「自动音频采集」→ WASAPI 直接采集系统音频
- **Linux**: PulseAudio 直接采集

---

## 怎么获取安装包？

### 方式一：GitHub Actions（推荐）

去 [Actions](https://github.com/scorching12/Bole_Music/actions) → 最新构建 → 底部 Artifacts → 下载对应平台包。

### 方式二：本地打包

```bash
npm run package:win   # Windows .exe
npm run package:mac   # macOS .dmg + .zip
```

---

## ⚠️ 安全警告说明

App **没有购买 Apple 开发者签名和 Windows 代码签名证书**，各平台会提示安全警告。

### 🍎 macOS

1. 双击 `.dmg` 挂载，把「伯乐模拟器」拖到 Applications
2. 打开终端，运行：

```bash
xattr -cr /Applications/伯乐模拟器.app
codesign --force --deep --sign - /Applications/伯乐模拟器.app
```

3. 正常双击打开

> 两条命令缺一不可。每次下载新版本，重新运行即可。

### 🪟 Windows

安装时 SmartScreen 警告 → 点击「更多信息」→「仍要运行」。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron 31 |
| 前端 | React 18 + TypeScript 5 + Vite 5 |
| 数据存储 | electron-store |
| AI 服务 | DeepSeek（默认）/ 通义千问 / OpenAI / 自定义 |
| AI 架构 | 统一 Agent + 函数调用（Function Calling） |
| 网络搜索 | 必应中国（cn.bing.com） |
| 歌曲识别 | Shazam（node-shazam，免费零配置） |
| 音乐平台 | NeteaseCloudMusicApi |
| 打包 | electron-builder |
| 自动更新 | electron-updater |
| CI/CD | GitHub Actions + Gitee 镜像 |

---

> 📌 详细的产品设计文档见 [产品设计.md](./产品设计.md)
