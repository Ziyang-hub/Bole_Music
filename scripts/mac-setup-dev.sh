#!/bin/bash
# ============================================================
# 伯乐模拟器 — Mac 一键开发环境安装
#
# 用法（在 Mac 终端粘贴运行）:
#   chmod +x mac-setup-dev.sh && ./mac-setup-dev.sh
#
# 功能：
#   1. 装便携 Node.js 到 ~/.local（不影响系统）
#   2. 克隆代码到 ~/bole-dev
#   3. 安装依赖
#   4. 启动开发模式
#
# 清理（一键删除所有痕迹）：
#   运行 mac-cleanup-dev.sh
# ============================================================

set -e

NODE_VERSION="20.18.0"
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  NODE_ARCH="arm64"
else
  NODE_ARCH="x64"
fi

NODE_TAR="node-v${NODE_VERSION}-darwin-${NODE_ARCH}.tar.gz"
NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TAR}"
LOCAL_DIR="$HOME/.local"
DEV_DIR="$HOME/bole-dev"

echo "========================================"
echo "  伯乐模拟器 — Mac 开发环境安装"
echo "========================================"
echo ""
echo "架构: ${NODE_ARCH}"
echo "安装位置: ${LOCAL_DIR}"
echo "代码位置: ${DEV_DIR}"
echo ""

# ---- 1. 便携 Node.js ----
if [ -f "$LOCAL_DIR/bin/node" ]; then
  echo "✅ Node.js 已安装: $($LOCAL_DIR/bin/node --version)"
else
  echo "📥 下载 Node.js ${NODE_VERSION} (${NODE_ARCH}) ..."
  mkdir -p "$LOCAL_DIR"
  curl -fsSL "$NODE_URL" -o /tmp/nodejs.tar.gz
  echo "📦 解压到 ~/.local ..."
  tar xzf /tmp/nodejs.tar.gz -C "$LOCAL_DIR" --strip-components=1
  rm /tmp/nodejs.tar.gz
  echo "✅ Node.js 安装完成: $($LOCAL_DIR/bin/node --version)"
fi

export PATH="$LOCAL_DIR/bin:$PATH"

# ---- 2. 克隆代码 ----
if [ -d "$DEV_DIR" ]; then
  echo ""
  echo "📂 代码目录已存在，更新中..."
  cd "$DEV_DIR"
  git pull
else
  echo ""
  echo "📥 克隆代码..."
  git clone https://github.com/scorching12/Bole_Music.git "$DEV_DIR"
  cd "$DEV_DIR"
fi

# ---- 3. 安装依赖 ----
echo ""
echo "📦 安装依赖（可能需要几分钟）..."
npm install

# ---- 3.5 解除 macOS 隔离 + 验证 ----
echo ""
echo "🔐 解除 macOS 隔离标记..."

ELECTRON_APP="$DEV_DIR/node_modules/electron/dist/Electron.app"
ELECTRON_BIN="$ELECTRON_APP/Contents/MacOS/Electron"

# macOS 可能在 npm install 期间就删了二进制，需要检查并恢复
if [ ! -f "$ELECTRON_BIN" ]; then
  echo "⚠️ Electron 被 macOS 隔离删除了，重新下载..."
  cd "$DEV_DIR"
  # 强制重新下载 electron 二进制
  node node_modules/electron/install.js 2>/dev/null || true
fi

# 再次检查
if [ -f "$ELECTRON_BIN" ]; then
  xattr -cr "$ELECTRON_APP" 2>/dev/null || true
  codesign --force --deep --sign - "$ELECTRON_APP" 2>/dev/null || true
  echo "✅ Electron 已签名: $(ls -la "$ELECTRON_BIN" | awk '{print $5}') bytes"
else
  echo "❌ Electron 二进制仍然缺失，请手动运行："
  echo "   cd ~/bole-dev"
  echo "   npx electron --version"
  echo "   xattr -cr node_modules/electron/dist/Electron.app"
  echo "   codesign --force --deep --sign - node_modules/electron/dist/Electron.app"
fi

# 也处理 ffmpeg 二进制
FFMPEG_BIN=$(find "$DEV_DIR/node_modules/ffmpeg-static" -name ffmpeg -type f 2>/dev/null | head -1)
if [ -n "$FFMPEG_BIN" ]; then
  xattr -cr "$FFMPEG_BIN" 2>/dev/null || true
  echo "✅ ffmpeg 已解除隔离"
fi

FFMPEG_INST=$(find "$DEV_DIR/node_modules/@ffmpeg-installer" -name ffmpeg -type f 2>/dev/null | head -1)
if [ -n "$FFMPEG_INST" ]; then
  xattr -cr "$FFMPEG_INST" 2>/dev/null || true
  echo "✅ ffmpeg-installer 已解除隔离"
fi

# ---- 4. 完成 ----
echo ""
echo "========================================"
echo "  ✅ 安装完成！"
echo "========================================"
echo ""
echo "启动开发模式："
echo "  cd ~/bole-dev"
echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
echo "  npm run dev"
echo ""
echo "清理一切："
echo "  运行 mac-cleanup-dev.sh 或手动执行："
echo "  rm -rf ~/bole-dev ~/.local"
echo ""
echo "现在启动? (y/n)"
read -r answer
if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
  echo ""
  echo "🚀 启动中..."
  npm run dev
fi
