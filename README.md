# 🐴 伯乐模拟器

> 高山流水遇知音 —— 你的 AI 音乐伴侣

---

## 这是什么？

伯乐模拟器是一个桌面 App（支持 Windows 和 Mac），它能：

- 🎵 **分析歌曲**：输入歌名，AI 自动分析歌词、曲风、情感、创作背景
- 🔗 **打通网易云**：粘贴歌曲链接自动识别，应用内搜索歌曲，获取真实歌词
- 💬 **陪你聊音乐**：四种 AI 人格可选（文艺青年 / 专业乐评人 / 暖心朋友 / 幽默伙伴）
- 📊 **生成听歌报告**：日/周/月报告，AI 一键生成文字总结
- 📝 **记录听歌日记**：自动保存每首分析过的歌曲，可编辑笔记、AI 生成小结
- 🎧 **自动识别歌曲**：监听系统音频，自动识别播放的歌曲（需配置）
- 🔄 **自动更新**：发布新版本后，应用自动提示更新
- 🌓 **深色/浅色主题**：一键切换，白天晚上都舒服
- 📤 **导出分享**：听歌报告可导出文本，一键复制分享
- 🔔 **系统通知**：分析完成弹通知提醒
- 🖥️ **系统托盘**：关闭窗口不退出，后台持续运行

> 「伯乐」取自「伯乐识马」的典故，寓意 AI 能像伯乐一样，发现每首歌的闪光点，成为你的音乐知音。

---

## 界面预览

应用有四个页面，侧边栏切换：

| 页面 | 功能 |
|------|------|
| 💬 知音对话 | 输入歌名 / 粘贴网易云链接 / 点击🔍搜索歌曲，与 AI 伯乐交流 |
| 📊 听歌报告 | 统计卡片、曲风分布、热门排行、日/周/月 AI 报告 |
| 📝 听歌日记 | 时间线展示，可编辑笔记，AI 可生成每日小结 |
| ⚙️ 设置 | 选择 AI 人格、配置 API 密钥、功能开关、检查更新、音频采集引导 |

---

## 怎么运行？

### 第一步：安装 Node.js

去 [Node.js 官网](https://nodejs.org) 下载安装 **LTS 版本**。

安装完后打开终端验证：

```bash
node --version   # 应该显示 v18 或 v20 以上
npm --version    # 应该显示 9 或 10 以上
```

### 第二步：下载项目

```bash
git clone git@github.com:scorching12/Bole_Music.git
cd Bole_Music
```

### 第三步：安装依赖

```bash
npm install
```

### 第四步：获取 API Key

推荐使用 **DeepSeek**（国内直连，便宜好用）：

1. 打开 [platform.deepseek.com](https://platform.deepseek.com)
2. 注册账号（手机号即可）
3. 在「API Keys」页面创建一个 Key，复制备用

> 💰 DeepSeek 新用户送 500 万 tokens，够用很久了。

### 第五步：启动应用

```bash
npm run dev
```

应用打开后：
1. 去 ⚙️ **设置** → 粘贴 DeepSeek API Key
2. 选择一个 AI 人格
3. 回到 💬 **知音对话**，试试：

```
# 方式1：直接输入歌名
周杰伦 晴天

# 方式2：粘贴网易云链接
https://music.163.com/song?id=186016

# 方式3：点击🔍搜索歌曲
# 方式4：输入「推荐歌曲」获取个性化推荐
```

---

## ⚠️ 安全警告说明

因为 App **没有花 $99/年 买代码签名证书**，各平台会提示安全警告。**这是正常的，App 本身没有病毒。**

### 🍎 macOS

安装 `.dmg` 后，**不要直接双击 App 图标**。请：

1. 打开 **访达** → **应用程序** 文件夹
2. 找到「伯乐模拟器」，**右键点击** → 选择 **「打开」**
3. 弹出对话框点 **「打开」** 确认

> 如果已经双击过（被移到废纸篓），先去废纸篓**移回来**，再用上面的方法打开。

**彻底解决**：需要 Apple Developer 账号（$99/年）+ 公证。如果以后想要，可以再配置。

### 🪟 Windows

双击安装程序时，SmartScreen 会提示「Windows 已保护你的电脑」：

1. 点击 **「更多信息」**
2. 点击 **「仍要运行」**
3. 正常安装即可

**彻底解决**：需要购买代码签名证书（~$200/年）。

### 🐧 Linux

AppImage 一般不会有安全警告。如果遇到，给文件加执行权限：

```bash
chmod +x 伯乐模拟器-1.0.0.AppImage
./伯乐模拟器-1.0.0.AppImage
```

---

## 怎么获取安装包？

### 方式一：GitHub Actions 自动构建（推荐）

推送代码后，GitHub 自动构建三平台安装包：

1. 去 [Actions 页面](https://github.com/scorching12/Bole_Music/actions)
2. 点击最新的「构建安装包」运行
3. 拉到页面底部 Artifacts，下载对应平台安装包

### 方式二：本地打包

```bash
npm run package:win   # Windows .exe
npm run package:mac   # macOS .dmg
```

---

## 怎么发布新版本？

1. 修改 `package.json` 中的 `version`（如 `1.0.1`）
2. 提交代码并推送
3. 在 [Releases 页面](https://github.com/scorching12/Bole_Music/releases) 创建新 Release
   - Tag: `v1.0.1`
   - Title: 伯乐模拟器 v1.0.1
4. 点 Publish → GitHub Actions 自动构建 → 安装包自动出现在 Release 页面
5. 所有用户下次打开应用时自动收到更新提示

---

## 项目结构

```
├── 产品设计.md                 # 产品设计文档
├── README.md                   # 本文件
├── package.json                # 项目配置
├── electron-builder.yml        # 打包+发布配置
├── demo.html                   # 效果预览页面
├── .github/workflows/
│   └── build.yml               # GitHub Actions 自动打包
├── scripts/
│   └── generate-icon.js        # 图标生成脚本
├── resources/
│   ├── icon.png                # 应用图标
│   └── icon-256.png
├── src/
│   ├── main/                   # Electron 主进程
│   │   ├── index.ts            # 窗口管理 + IPC 路由
│   │   ├── preload.ts          # 安全桥接层
│   │   ├── store.ts            # 数据持久化
│   │   ├── ai-service.ts       # AI 服务（分析/对话/报告/推荐）
│   │   ├── audio-capture.ts    # 系统音频采集
│   │   ├── song-recognition.ts # 歌曲指纹识别
│   │   ├── music-platforms.ts  # 音乐平台连接器（网易云）
│   │   ├── music-types.ts      # 音乐类型定义
│   │   └── updater.ts          # 自动更新
│   └── renderer/               # React 前端界面
│       ├── App.tsx             # 主组件（页面切换+对话+链接解析）
│       ├── App.css             # 全局样式
│       └── components/
│           ├── ReportPage.tsx   # 听歌报告
│           ├── DiaryPage.tsx    # 听歌日记
│           ├── SettingsPage.tsx # 设置+更新+音频引导
│           └── SearchSongs.tsx  # 歌曲搜索
```

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron 31.x |
| 前端 | React 18 + TypeScript 5 |
| 构建工具 | Vite 5 |
| 数据存储 | electron-store |
| AI 服务 | DeepSeek（默认）/ 通义千问 / OpenAI / 自定义 |
| 音乐平台 | NeteaseCloudMusicApi |
| 歌曲识别 | ACRCloud 框架 |
| 打包 | electron-builder |
| 自动更新 | electron-updater |
| CI/CD | GitHub Actions |

---

## 开发记录

| 存档点 | 说明 |
|:------:|------|
| 1 | 搭好了项目骨架 |
| 2 | 四个功能页面都能用了 |
| 3 | AI 有脑子了，数据能记住了 |
| 4 | 写了 README 文档 |
| 5 | P1 全部完成（报告/日记/推荐/音频采集/歌曲识别） |
| 6 | P2+P3 完成（打包/图标/自动更新） |
| 7 | 更新产品设计文档和 README |
| 8 | 打包验证通过 + 音频采集引导 |
| 9 | 添加应用效果预览页面 |
| 10 | 打通网易云音乐平台 |
| 11 | 配置 GitHub Actions 自动打包 |
| 12 | 更新产品设计文档和 README |
| 13 | 体验增强（托盘+通知+主题+导出+分享） |

---

## 作者

Made with 🎵 by ScorchingSun

---

> 📌 详细的产品设计文档见 [产品设计.md](./产品设计.md)
