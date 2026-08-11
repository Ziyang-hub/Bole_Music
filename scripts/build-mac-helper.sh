#!/bin/bash
# ============================================================
# 编译 macOS ScreenCaptureKit 音频捕获 helper
# 用法：bash scripts/build-mac-helper.sh [--arch x86_64|arm64]
# 默认编译本机架构；--arch 可交叉编译另一个架构
# 产物：resources/mac-helper/bole-capture-<arch>
# ============================================================

set -e
cd "$(dirname "$0")/.."

# 兼容两种调用方式：--arch x86_64 或直接传 x86_64
ARCH=""
if [ "$1" = "--arch" ]; then
  ARCH="$2"
else
  ARCH="${1:-}"
fi
ARCH="${ARCH:-$(uname -m)}"
case "$ARCH" in
  x86_64) BIN_NAME="bole-capture-x64" ;;
  arm64)  BIN_NAME="bole-capture-arm64" ;;
  *) echo "不支持的架构: $ARCH"; exit 1 ;;
esac

# macOS 目标版本（ScreenCaptureKit 音频需 13+）
TARGET="$(sw_vers -productVersion | awk -F. '{print $1"."$2}')"

SRC="src/main/mac-helper/BoleCapture.swift"
OUT="resources/mac-helper/$BIN_NAME"

echo "🛠 编译 helper ($ARCH, macOS $TARGET)..."
mkdir -p resources/mac-helper

if [ "$ARCH" = "$(uname -m)" ]; then
  swiftc -O "$SRC" -o "$OUT"
else
  # 交叉编译（需要完整 Xcode SDK）
  swiftc -O -target "${ARCH}-apple-macos${TARGET}" "$SRC" -o "$OUT"
fi

chmod +x "$OUT"
echo "✅ 编译完成: $OUT ($(du -h "$OUT" | cut -f1))"
