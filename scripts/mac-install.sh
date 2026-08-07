#!/bin/bash
# ============================================================
# 伯乐模拟器 - macOS 安装脚本
#
# 解决问题：绕过 Gatekeeper 对未签名应用的拦截
# 用法：在终端运行 bash mac-install.sh
# ============================================================

set -e

APP_NAME="伯乐模拟器.app"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_PATH="$SCRIPT_DIR/$APP_NAME"

echo "🐴 伯乐模拟器 - 安装脚本"
echo "================================"
echo ""

# 1. 检查 App 是否存在
if [ ! -d "$APP_PATH" ]; then
    echo "❌ 找不到 $APP_NAME"
    echo "   请确保此脚本和 $APP_NAME 在同一个文件夹"
    exit 1
fi

# 2. 移除隔离标记（解决「已损坏，无法打开」）
echo "🔧 正在移除隔离标记..."
xattr -cr "$APP_PATH" 2>/dev/null || true
echo "   ✅ 隔离标记已清除"

# 3. Ad-hoc 自签名（让系统认可这是一个有效的 App）
echo "🔐 正在进行临时签名..."
codesign --force --deep --sign - "$APP_PATH" 2>/dev/null || true
echo "   ✅ 临时签名完成"

# 4. 移到 Applications 文件夹
echo "📦 正在安装到 Applications..."
if [ -d "/Applications/$APP_NAME" ]; then
    echo "   发现旧版本，正在替换..."
    rm -rf "/Applications/$APP_NAME"
fi
cp -R "$APP_PATH" /Applications/
echo "   ✅ 已安装到 /Applications/$APP_NAME"

# 5. 打开应用
echo ""
echo "🚀 正在启动伯乐模拟器..."
open "/Applications/$APP_NAME"

echo ""
echo "================================"
echo "✅ 安装完成！"
echo ""
echo "💡 下次直接在「启动台」或「应用程序」中打开即可"
echo "   如果再次被拦截，重新运行此脚本即可"
