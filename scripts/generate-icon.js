/**
 * 根据用户提供的马脸图片生成图标
 * 裁剪到实际边界 → 缩放铺满 → 输出 PNG + ICNS
 */
const sharp = require('sharp');
const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

const S = 512;
const OUT = path.join(__dirname, '..', 'resources');

// 读取追踪数据（包含路径和边界）
const data = JSON.parse(
  fs.readFileSync(path.join(OUT, 'horse-data.json'), 'utf8')
);

async function main() {
  const { bounds } = data;
  // 马的宽高比 → 以长边为基准缩放到图标的 94%
  const maxDim = Math.max(bounds.w, bounds.h);
  const scale = 0.94 * S / maxDim;
  // 居中，考虑实际偏移
  const ox = (S - bounds.w * scale) / 2 - bounds.x * scale;
  const oy = (S - bounds.h * scale) / 2 - bounds.y * scale;

  console.log(`Horse bounds: ${bounds.w}x${bounds.h}, scale: ${scale.toFixed(3)}`);

  const svg = `
    <svg width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${S}" height="${S}" rx="96" fill="#1a1a2e"/>
      <g transform="translate(${ox}, ${oy}) scale(${scale})">
        <path d="${data.path}" fill="#f0a050" fill-rule="evenodd"/>
      </g>
    </svg>
  `;

  await sharp(Buffer.from(svg)).resize(S, S).png().toFile(path.join(OUT, 'icon.png'));
  await sharp(Buffer.from(svg)).resize(256, 256).png().toFile(path.join(OUT, 'icon-256.png'));
  console.log('✅ icon.png + icon-256.png');

  try {
    const iset = path.join(OUT, 'icon.iconset');
    execSync(`mkdir -p "${iset}"`);
    for (const [n, s] of Object.entries({
      '16.png':16,'16@2x.png':32,'32.png':32,'32@2x.png':64,
      '128.png':128,'128@2x.png':256,'256.png':256,'256@2x.png':512,
      '512.png':512,'512@2x.png':1024
    })) {
      await sharp(path.join(OUT, 'icon.png')).resize(s, s).png()
        .toFile(path.join(iset, `icon_${n}`));
    }
    execSync(`iconutil -c icns "${iset}" -o "${path.join(OUT, 'icon.icns')}"`);
    execSync(`rm -rf "${iset}"`);
    console.log('✅ icon.icns');
  } catch { console.log('⚠️ icns not generated (Linux)'); }

  console.log(`🎨 马占比: ${(maxDim * scale / S * 100).toFixed(0)}%，边缘留 ${(((S - maxDim * scale) / 2) / S * 100).toFixed(0)}% 空隙`);
}

main().catch(err => { console.error(err); process.exit(1); });
