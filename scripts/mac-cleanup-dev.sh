#!/bin/bash
# ============================================================
# 伯乐模拟器 — Mac 一键清理开发环境
#
# 删除所有安装痕迹：代码、Node.js、依赖缓存
# ============================================================

echo "========================================"
echo "  清理伯乐模拟器开发环境"
echo "========================================"
echo ""
echo "将删除以下内容："
echo "  • ~/bole-dev       (项目代码)"
echo "  • ~/.local/bin     (Node.js)"
echo "  • ~/.local/lib     (Node.js 库)"
echo "  • ~/.local/include (Node.js 头文件)"
echo "  • ~/.local/share   (Node.js 数据)"
echo "  • ~/.npm           (npm 缓存)"
echo ""
echo "确认删除? (y/n)"
read -r answer

if [ "$answer" != "y" ] && [ "$answer" != "Y" ]; then
  echo "已取消"
  exit 0
fi

echo ""
echo "🧹 清理中..."

rm -rf ~/bole-dev
rm -rf ~/.local
rm -rf ~/.npm

echo ""
echo "✅ 清理完成！所有伯乐模拟器相关文件已删除。"
