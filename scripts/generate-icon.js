/**
 * 生成应用图标
 * 使用 sharp 库创建 PNG 图标
 * 运行：node scripts/generate-icon.js
 */

const sharp = require('sharp');
const path = require('path');

const ICON_SIZE = 512;
const OUTPUT_DIR = path.join(__dirname, '..', 'resources');

async function generateIcon() {
  // 创建 SVG 图标：深色背景 + 音乐符号 + 伯乐主题
  const svg = `
    <svg width="${ICON_SIZE}" height="${ICON_SIZE}" xmlns="http://www.w3.org/2000/svg">
      <!-- 背景：深色圆角矩形 -->
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1a1a2e"/>
          <stop offset="100%" style="stop-color:#2a2040"/>
        </linearGradient>
        <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#f0a050"/>
          <stop offset="100%" style="stop-color:#f5c080"/>
        </linearGradient>
      </defs>

      <!-- 圆角矩形背景 -->
      <rect width="${ICON_SIZE}" height="${ICON_SIZE}" rx="80" fill="url(#bg)"/>

      <!-- 装饰圆形（模拟唱片/音符光晕）-->
      <circle cx="256" cy="220" r="120" fill="none" stroke="url(#accent)" stroke-width="3" opacity="0.3"/>
      <circle cx="256" cy="220" r="90" fill="none" stroke="url(#accent)" stroke-width="2" opacity="0.2"/>
      <circle cx="256" cy="220" r="60" fill="none" stroke="url(#accent)" stroke-width="1" opacity="0.15"/>

      <!-- 音乐音符 -->
      <g transform="translate(256, 200)" fill="url(#accent)">
        <!-- 八分音符 -->
        <text x="-60" y="40" font-size="140" font-family="Arial" text-anchor="middle" dominant-baseline="middle">🎵</text>
      </g>

      <!-- 底部文字 -->
      <text x="256" y="390" font-size="36" font-family="Arial" font-weight="bold" fill="#f0a050" text-anchor="middle">伯 乐</text>
      <text x="256" y="430" font-size="18" font-family="Arial" fill="#9898b0" text-anchor="middle">Bole Simulator</text>

      <!-- 装饰星光 -->
      <circle cx="80" cy="100" r="2" fill="#f5c080" opacity="0.6"/>
      <circle cx="420" cy="80" r="1.5" fill="#f5c080" opacity="0.5"/>
      <circle cx="450" cy="350" r="2" fill="#f5c080" opacity="0.4"/>
      <circle cx="60" cy="400" r="1.5" fill="#f5c080" opacity="0.5"/>
      <circle cx="180" cy="60" r="1" fill="#f5c080" opacity="0.6"/>
    </svg>
  `;

  // 生成 PNG
  await sharp(Buffer.from(svg))
    .resize(ICON_SIZE, ICON_SIZE)
    .png()
    .toFile(path.join(OUTPUT_DIR, 'icon.png'));

  // 也生成小尺寸版本
  await sharp(Buffer.from(svg))
    .resize(256, 256)
    .png()
    .toFile(path.join(OUTPUT_DIR, 'icon-256.png'));

  console.log('✅ 图标已生成到 resources/ 目录');
  console.log('  - resources/icon.png (512x512)');
  console.log('  - resources/icon-256.png (256x256)');
  console.log('');
  console.log('💡 macOS 需要 .icns 格式，请在 Mac 上用以下命令转换：');
  console.log('  sips -s format icns resources/icon.png --out resources/icon.icns');
}

generateIcon().catch((err) => {
  console.error('生成图标失败:', err);
  process.exit(1);
});
