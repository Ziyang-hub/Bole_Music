# 🐴 伯乐模拟器

> 高山流水遇知音 —— 你的 AI 音乐伴侣

---

## 这是什么？

伯乐模拟器是一个桌面 App（支持 Windows 和 Mac），它能：

- 🎧 **自动识别歌曲**：打开网易云播歌 → APP 自动识别 → AI 分析 → 对话展示（全自动）
- 🎵 **AI 分析歌曲**：输入歌名，AI 从歌词/情感/曲风/背景/感悟 5 个维度深度分析
- 🔗 **打通网易云**：粘贴歌曲链接自动解析，应用内搜索歌曲，获取真实歌词注入分析
- 📋 **歌单导入**：粘贴网易云歌单链接，批量获取歌曲列表并逐个 AI 分析
- 💬 **陪你聊音乐**：四种 AI 人格可选，多轮对话记住上下文
- 📊 **生成听歌报告**：日/周/月报告，AI 一键生成文字总结，可导出和分享
- 📝 **记录听歌日记**：自动保存分析过的歌曲，可编辑笔记、AI 生成每日小结
- 🎵 **个性化推荐**：说「推荐歌曲」→ AI 根据听歌历史为你推荐

> 「伯乐」取自「伯乐识马」的典故，寓意 AI 能像伯乐一样，发现每首歌的闪光点，成为你的音乐知音。

---

## 界面预览

| 页面 | 功能 |
|------|------|
| 💬 知音对话 | 输入歌名 / 粘贴链接 / 🔍搜索 / 📋歌单 / 🎤哼歌，与 AI 伯乐交流 |
| 📊 听歌报告 | 统计卡片、曲风分布、热门排行、日/周/月 AI 报告、导出分享 |
| 📝 听歌日记 | 时间线展示，可编辑笔记，AI 生成每日小结 |
| ⚙️ 设置 | 配置 API Key（含获取指引）、AI 人格、主题、识别后端、更新检查、音频采集引导 |

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

或直接下载 GitHub Actions 构建的安装包。

### 第三步：配置 API Key

打开 APP → 设置页面，按页面上的指引注册并填入：

| Key | 用途 | 获取地址 | 费用 |
|-----|------|----------|:--:|
| DeepSeek API Key | AI 分析 | platform.deepseek.com | 🆓 送500万tokens |
| AudD API Key | 歌曲识别 | audd.io | 🆓 300次/月 |

> 设置页每个 Key 旁边都有「📖 如何获取？」展开按钮，包含完整注册步骤。

### 第四步（可选）：启用自动识别

1. 安装虚拟音频设备：
   - Mac: `brew install blackhole-2ch`
   - Windows: 下载 [VB-Cable](https://vb-audio.com/Cable/)
2. 设置页打开「自动音频采集」开关
3. 播放音乐 → APP 自动识别和分析 🎉

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

因为 App **没有购买 Apple 开发者签名（$99/年）和 Windows 代码签名证书**，
各平台会提示安全警告。**App 本身没有病毒，以下是各平台的解决办法。**

---

### 🍎 macOS（重要！必读）

> macOS Gatekeeper 会拦截所有未签名的 App。必须按以下步骤操作才能运行。

#### 方式一：使用自动安装脚本（最简单）

部分安装包附带 `mac-install.command` 脚本。**双击它**即可自动完成所有步骤。

> 如果双击后提示「无法打开」，右键点击 → 「打开」→ 确认。

#### 方式二：从 DMG 安装

1. 双击 `.dmg` 挂载
2. 把「伯乐模拟器」拖到 **Applications 文件夹**
3. 打开 **终端**（启动台 → 其他 → 终端）
4. 粘贴运行以下 **两条命令**（必须两条都运行）：

```bash
xattr -cr /Applications/伯乐模拟器.app
codesign --force --deep --sign - /Applications/伯乐模拟器.app
```

5. 然后正常双击打开，或在终端运行：

```bash
open /Applications/伯乐模拟器.app
```

#### 方式三：从 ZIP 安装

1. 双击 `.zip` 解压，得到「伯乐模拟器.app」
2. 把 `.app` 拖到桌面或 Applications
3. 打开终端，运行（把路径改成你的实际位置）：

```bash
xattr -cr ~/Desktop/伯乐模拟器.app
codesign --force --deep --sign - ~/Desktop/伯乐模拟器.app
open ~/Desktop/伯乐模拟器.app
```

> ⚠️ **两条命令缺一不可！** 只在 `.app` 文件所在位置运行一次即可。
>
> - `xattr -cr`：清除「来自互联网」的隔离标记
> - `codesign --force --deep --sign -`：用本地证书重新签名（免费，系统认可）
> - `open`：正常打开

#### 如果还是不行

运行以下命令后重试：
```bash
sudo spctl --master-disable  # 允许任何来源（需管理员密码）
```

然后在「系统设置 → 隐私与安全性」中会多出「任何来源」选项。

> **以后每次下载新版本**，重新运行 `xattr` + `codesign` 两条命令即可。

---

### 🪟 Windows

安装时 SmartScreen 警告 → 点击「更多信息」→「仍要运行」。

---

## 怎么发布新版本？

1. 修改 `package.json` 中的 `version`
2. 提交推送 → GitHub Actions 自动构建
3. 在 [Releases](https://github.com/scorching12/Bole_Music/releases) 创建 Release（Tag 如 `v1.0.1`）
4. 安装包自动出现在 Release 页面，所有用户收到更新通知

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron 31 |
| 前端 | React 18 + TypeScript 5 + Vite 5 |
| 数据存储 | electron-store |
| AI 服务 | DeepSeek（默认）/ 通义千问 / OpenAI |
| 音乐平台 | NeteaseCloudMusicApi |
| 歌曲识别 | AudD（商业指纹）+ AcoustID（开源指纹）双后端 |
| 打包 | electron-builder |
| 自动更新 | electron-updater |
| CI/CD | GitHub Actions |

---

## 开发记录

| 存档点 | 说明 |
|:------:|------|
| 1-3 | 项目骨架 + 页面 + AI + 存储 |
| 4-6 | README + P1/P2/P3 完成 |
| 7-9 | 文档更新 + 打包验证 + 效果预览 |
| 10 | 打通网易云音乐平台 |
| 11-12 | GitHub Actions + 文档 |
| 13-14 | 体验增强（托盘/通知/主题/导出） |
| 15-17 | macOS 安全绕过 + 打包修复 |
| 18 | 歌单导入 + 哼歌识别 + 使用统计 |
| 19-22 | 双后端识别 + 开箱即用 + 全自动管道 |

---

## 作者

Made with 🎵 by ScorchingSun

---

> 📌 详细的产品设计文档见 [产品设计.md](./产品设计.md)
