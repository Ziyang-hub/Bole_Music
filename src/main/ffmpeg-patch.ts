/**
 * 打包版修复：@ffmpeg-installer/ffmpeg 的 path 位于 app.asar 内（asar 是文件不是目录），
 * spawn 会报 ENOTDIR。node-shazam 的 to_pcm.js 在模块加载时读取该 path 并执行
 * Ffmpeg.setFfmpegPath()（优先级高于 FFMPEG_PATH 环境变量），因此必须在
 * require('node-shazam') 之前把 path 重写为 app.asar.unpacked
 * （electron-builder 的 asarUnpack 已解包 @ffmpeg-installer/**）。
 *
 * ⚠️ 本模块必须作为 src/main/index.ts 的第一个 import（require 顺序保证先执行）。
 */

try {
  const installer = require('@ffmpeg-installer/ffmpeg');
  if (
    installer &&
    installer.path &&
    typeof installer.path === 'string' &&
    installer.path.includes('app.asar')
  ) {
    installer.path = installer.path.replace('app.asar', 'app.asar.unpacked');
    console.log('[ffmpeg-patch] @ffmpeg-installer path →', installer.path);
  }
} catch (e: any) {
  // 开发模式 / 模块缺失时静默跳过（开发模式路径真实，无需重写）
  console.warn('[ffmpeg-patch] patch skipped:', e?.message || e);
}
