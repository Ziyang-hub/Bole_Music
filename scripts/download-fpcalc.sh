#!/bin/bash
# 下载 fpcalc 二进制文件（音频指纹提取工具）
# AcoustID Chromaprint: https://acoustid.org/chromaprint
# GitHub Releases: https://github.com/acoustid/chromaprint/releases

set -e

FP_VERSION="${1:-1.6.1}"
RESOURCES_DIR="$(cd "$(dirname "$0")/../resources/fpcalc" && pwd)"
TEMP_DIR=$(mktemp -d)

echo "=== 下载 fpcalc v${FP_VERSION} ==="

BASE="https://github.com/acoustid/chromaprint/releases/download/v${FP_VERSION}"

# 下载并解压
download_tar() {
  local asset="$1" out_dir="$2" exe_name="$3"
  local url="${BASE}/${asset}"
  echo "  📥 ${asset}..."

  curl -sSL -o "${TEMP_DIR}/${asset}" "${url}" || {
    echo "  ⚠️ 下载失败"
    return 1
  }

  tar xzf "${TEMP_DIR}/${asset}" -C "${TEMP_DIR}" 2>/dev/null || {
    echo "  ⚠️ 解压失败"
    return 1
  }

  # 找到 fpcalc 并复制
  local fp=$(find "${TEMP_DIR}" -name "${exe_name}" -type f 2>/dev/null | head -1)
  if [ -z "$fp" ]; then
    echo "  ⚠️ 找不到 ${exe_name}"
    return 1
  fi

  mkdir -p "${RESOURCES_DIR}/${out_dir}"
  cp "$fp" "${RESOURCES_DIR}/${out_dir}/${exe_name}"
  chmod +x "${RESOURCES_DIR}/${out_dir}/${exe_name}"
  echo "  ✅ ${out_dir}/${exe_name} ($(du -h "$fp" | cut -f1))"
}

download_zip() {
  local asset="$1" out_dir="$2" exe_name="$3"
  local url="${BASE}/${asset}"
  echo "  📥 ${asset}..."

  curl -sSL -o "${TEMP_DIR}/${asset}" "${url}" || {
    echo "  ⚠️ 下载失败"
    return 1
  }

  unzip -qo "${TEMP_DIR}/${asset}" -d "${TEMP_DIR}" 2>/dev/null || {
    echo "  ⚠️ 解压失败"
    return 1
  }

  local fp=$(find "${TEMP_DIR}" -name "${exe_name}" -type f 2>/dev/null | head -1)
  if [ -z "$fp" ]; then
    echo "  ⚠️ 找不到 ${exe_name}"
    return 1
  fi

  mkdir -p "${RESOURCES_DIR}/${out_dir}"
  cp "$fp" "${RESOURCES_DIR}/${out_dir}/${exe_name}"
  chmod +x "${RESOURCES_DIR}/${out_dir}/${exe_name}"
  echo "  ✅ ${out_dir}/${exe_name} ($(du -h "$fp" | cut -f1))"
}

# === 下载各平台 ===

download_zip  "chromaprint-fpcalc-${FP_VERSION}-windows-x86_64.zip"     "win32-x64"     "fpcalc.exe"
download_tar  "chromaprint-fpcalc-${FP_VERSION}-macos-x86_64.tar.gz"    "darwin-x64"    "fpcalc"
download_tar  "chromaprint-fpcalc-${FP_VERSION}-macos-arm64.tar.gz"     "darwin-arm64"  "fpcalc"
download_tar  "chromaprint-fpcalc-${FP_VERSION}-linux-x86_64.tar.gz"    "linux-x64"     "fpcalc"

# 清理
rm -rf "$TEMP_DIR"

echo ""
echo "=== 完成 ==="
ls -la "${RESOURCES_DIR}"/*/
