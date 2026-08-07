#!/bin/bash
# ============================================================
# 伯乐模拟器 - macOS 安装脚本
#
# 双击此文件即可自动完成：去隔离 → 签名 → 移到 Applications → 打开
#
# 为什么要这样做：
# - App 没有 Apple 开发者证书（$99/年），macOS 会拦截
# - 此脚本自动完成所有必要步骤，让你能正常运行
# ============================================================

set -e

APP_NAME="伯乐模拟器.app"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 1. 查找 App（先在脚本同目录找，再在下载目录找）
if [ -d "$SCRIPT_DIR/$APP_NAME" ]; then
    APP_PATH="$SCRIPT_DIR/$APP_NAME"
elif [ -d "$HOME/Downloads/$APP_NAME" ]; then
    APP_PATH="$HOME/Downloads/$APP_NAME"
elif [ -d "/Applications/$APP_NAME" ]; then
    APP_PATH="/Applications/$APP_NAME"
else
    echo "❌ 找不到 $APP_NAME"
    echo ""
    echo "请确保此脚本和 $APP_NAME 在同一个文件夹，"
    echo "或者 App 已在「下载」或「应用程序」文件夹中。"
    echo ""
    echo "按任意键退出..."
    read -n 1
    exit 1
fi

echo "🐴 伯乐模拟器 - 安装助手"
echo "================================"
echo ""

# 2. 移除隔离标记
echo "🔧 正在移除下载隔离标记..."
xattr -cr "$APP_PATH" 2>/dev/null || true
echo "   ✅ 隔离标记已清除"

# 3. 临时签名（这是关键——macOS 必须要有签名才能运行）
echo "🔐 正在进行本地签名..."
codesign --force --deep --sign - "$APP_PATH" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "   ✅ 签名完成"
else
    echo "   ⚠️ 签名失败，尝试继续..."
fi

# 4. 如果不在 Applications 里，复制过去（可选）
if [[ "$APP_PATH" != "/Applications/$APP_NAME" ]]; then
    echo ""
    echo "📦 要安装到「应用程序」文件夹吗？"
    echo "   安装后可在启动台找到伯乐模拟器。"
    echo "   输入 y 安装，其他任意键跳过："
    read -n 1 -r REPLY
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ -d "/Applications/$APP_NAME" ]; then
            echo "   发现旧版本，正在替换..."
            rm -rf "/Applications/$APP_NAME"
        fi
        cp -R "$APP_PATH" /Applications/
        APP_PATH="/Applications/$APP_NAME"
        echo "   ✅ 已安装到应用程序文件夹"
    fi
fi

# 5. 打开应用
echo ""
echo "🚀 正在启动伯乐模拟器..."
open "$APP_PATH"

echo ""
echo "================================"
echo "✅ 完成！"
echo ""
echo "💡 以后直接在启动台点击「伯乐模拟器」图标即可"
echo "   如果系统再次拦截，重新运行此脚本即可"
echo ""
echo "按任意键关闭此窗口..."
read -n 1