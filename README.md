# 🐴 伯乐模拟器

> 高山流水遇知音 —— 你的 AI 音乐伴侣

---

## 这是什么？

伯乐模拟器是一个桌面 App（支持 Windows 和 Mac），它能：

- 🎵 **分析歌曲**：输入歌名，AI 自动分析歌词、曲风、情感、创作背景
- 💬 **陪你聊音乐**：四种 AI 人格可选（文艺青年 / 专业乐评人 / 暖心朋友 / 幽默伙伴）
- 📊 **生成听歌报告**：统计你的听歌数据，分析曲风偏好
- 📝 **记录听歌日记**：自动保存每首分析过的歌曲，形成时间线

> 「伯乐」取自「伯乐识马」的典故，寓意 AI 能像伯乐一样，发现每首歌的闪光点，成为你的音乐知音。

---

## 界面预览

应用有四个页面，侧边栏切换：

| 页面 | 功能 |
|------|------|
| 💬 知音对话 | 聊天窗口，输入歌名或文字，与 AI 伯乐交流 |
| 📊 听歌报告 | 统计卡片、曲风分布、热门歌曲排行 |
| 📝 听歌日记 | 时间线展示每天的听歌记录和 AI 小结 |
| ⚙️ 设置 | 选择 AI 人格、配置 API 密钥、开关功能 |

---

## 怎么运行？

### 第一步：安装 Node.js

去 [Node.js 官网](https://nodejs.org) 下载安装 **LTS 版本**（左边那个绿色的）。

安装完后打开终端（Windows 是 PowerShell 或 CMD，Mac 是终端），验证：

```bash
node --version   # 应该显示 v18 或 v20 以上
npm --version    # 应该显示 9 或 10 以上
```

### 第二步：下载项目

```bash
git clone git@github.com:scorching12/-.git
cd -/
```

或者直接从 GitHub 下载 ZIP 解压。

### 第三步：安装依赖

```bash
npm install
```

### 第四步：获取 API Key

伯乐需要连接 AI 才有「智慧」。推荐使用 **DeepSeek**（国内直连，便宜好用）：

1. 打开 [platform.deepseek.com](https://platform.deepseek.com)
2. 注册账号（手机号即可）
3. 在「API Keys」页面创建一个 Key，复制备用

> 💰 DeepSeek 新用户送 500 万 tokens，够用很久了。

### 第五步：启动应用

```bash
npm run dev
```

应用会打开一个窗口，先去 ⚙️ **设置** 页面：

1. 粘贴刚才复制的 DeepSeek API Key
2. 选择一个 AI 人格
3. 回到 💬 **知音对话** 页面，输入歌名试试！

---

## 怎么打包？

```bash
# 打包 Windows 版本
npm run package:win

# 打包 Mac 版本
npm run package:mac
```

打包后的文件在 `release/` 目录。

---

## 项目结构

```
├── 产品设计.md              # 产品设计文档
├── README.md                # 本文件
├── package.json             # 项目配置
├── src/
│   ├── main/                # Electron 主进程
│   │   ├── index.ts         # 窗口管理 + IPC 通信
│   │   ├── preload.ts       # 安全桥接层
│   │   ├── store.ts         # 数据存储（本地 JSON）
│   │   └── ai-service.ts    # AI 服务（DeepSeek 等）
│   └── renderer/            # React 前端界面
│       ├── App.tsx           # 主组件
│       ├── App.css           # 全局样式
│       └── components/       # 页面组件
│           ├── ReportPage.tsx   # 听歌报告
│           ├── DiaryPage.tsx    # 听歌日记
│           └── SettingsPage.tsx # 设置
└── resources/               # 图标等资源
```

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron |
| 前端 | React + TypeScript |
| 构建工具 | Vite |
| 数据存储 | electron-store |
| AI 服务 | DeepSeek（也支持通义千问/OpenAI） |
| 打包 | electron-builder |

---

## 开发记录

| 存档点 | 说明 |
|:------:|------|
| 1 | 搭好了项目骨架 |
| 2 | 三个功能页面都能用了 |
| 3 | AI 有脑子了，数据能记住了 |

---

## 作者

Made with 🎵 by ScorchingSun

---

> 📌 详细的产品设计文档见 [产品设计.md](./产品设计.md)
