/**
 * 生成应用图标
 * 使用 sharp 库创建 PNG 图标
 * 运行：node scripts/generate-icon.js
 *
 * 设计：伯乐与千里马 — 简洁马头剪影 + 音符元素
 * 无文字，暖琥珀色，深色圆角背景
 */

const sharp = require('sharp');
const path = require('path');
const { execSync } = require('child_process');

const ICON_SIZE = 512;
const OUTPUT_DIR = path.join(__dirname, '..', 'resources');

async function generateIcon() {
  // SVG 图标：伯乐与千里马
  // 简洁几何风格 — 马头侧影 + 音符线条
  const svg = `
    <svg width="${ICON_SIZE}" height="${ICON_SIZE}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1a1a2e"/>
          <stop offset="100%" style="stop-color:#252540"/>
        </linearGradient>
        <linearGradient id="horse" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#f0a050"/>
          <stop offset="100%" style="stop-color:#e08830"/>
        </linearGradient>
      </defs>

      <!-- 圆角矩形背景 -->
      <rect width="${ICON_SIZE}" height="${ICON_SIZE}" rx="96" fill="url(#bg)"/>

      <!-- 千里马：简约几何马头侧影（向右） -->
      <g transform="translate(256, 256)" fill="url(#horse)">
        <!-- 马头 + 颈 + 鬃毛 — 流畅的几何路径 -->
        <path d="
          M 20 -120
          C 30 -130, 50 -138, 70 -140
          C 85 -142, 95 -138, 100 -128
          C 105 -118, 105 -105, 100 -92
          C 95 -80, 85 -72, 75 -68
          L 60 -50
          C 70 -40, 80 -28, 88 -14
          C 92 -6, 96 4, 98 14
          L 100 30
          C 100 40, 95 45, 88 42
          C 76 38, 60 30, 44 22
          C 32 16, 18 14, 4 14
          L -20 14
          L -24 8
          C -10 4, 4 2, 16 4
          C 30 6, 42 12, 52 18
          C 48 8, 42 -4, 34 -16
          C 26 -28, 16 -40, 6 -52
          L 12 -58
          C 24 -44, 36 -30, 46 -20
          C 42 -38, 36 -56, 30 -72
          C 26 -84, 22 -94, 20 -104
          C 18 -114, 20 -120, 20 -120
          Z
        "/>

        <!-- 音符元素：竖线 + 符头（融入马颈线条） -->
        <rect x="-30" y="-90" width="6" height="80" rx="3"/>
        <ellipse cx="-10" cy="-10" rx="18" ry="12" transform="rotate(-15 -10 -10)"/>

        <!-- 小音符 -->
        <circle cx="-46" cy="-100" r="5"/>
      </g>
    </svg>
  `;

  // 生成 512x512 PNG
  await sharp(Buffer.from(svg))
    .resize(ICON_SIZE, ICON_SIZE)
    .png()
    .toFile(path.join(OUTPUT_DIR, 'icon.png'));

  // 生成 256x256 PNG
  await sharp(Buffer.from(svg))
    .resize(256, 256)
    .png()
    .toFile(path.join(OUTPUT_DIR, 'icon-256.png'));

  console.log('✅ PNG 图标已生成:');
  console.log('  - resources/icon.png (512x512)');
  console.log('  - resources/icon-256.png (256x256)');

  // macOS: 生成 .icns
  try {
    const png512 = path.join(OUTPUT_DIR, 'icon.png');
    const iconset = path.join(OUTPUT_DIR, 'icon.iconset');
    execSync(`mkdir -p "${iconset}"`);
    // 生成各种尺寸
    const sizes = {
      'icon_16x16.png': 16,
      'icon_16x16@2x.png': 32,
      'icon_32x32.png': 32,
      'icon_32x32@2x.png': 64,
      'icon_128x128.png': 128,
      'icon_128x128@2x.png': 256,
      'icon_256x256.png': 256,
      'icon_256x256@2x.png': 512,
      'icon_512x512.png': 512,
      'icon_512x512@2x.png': 1024,
    };
    for (const [name, size] of Object.entries(sizes)) {
      await sharp(png512)
        .resize(size, size)
        .png()
        .toFile(path.join(iconset, name));
    }
    execSync(`iconutil -c icns "${iconset}" -o "${path.join(OUTPUT_DIR, 'icon.icns')}"`);
    execSync(`rm -rf "${iconset}"`);
    console.log('  - resources/icon.icns (macOS)');
  } catch (e) {
    console.log('⚠️  无法生成 .icns（非 macOS 环境，CI 中会由 mac 机器生成）');
  }

  console.log('');
  console.log('🎨 图标设计：伯乐与千里马 — 几何马头剪影 + 音符元素');
  console.log('   暖琥珀色，深色圆角背景，无文字');
}

generateIcon().catch((err) => {
  console.error('生成图标失败:', err);
  process.exit(1);
});
