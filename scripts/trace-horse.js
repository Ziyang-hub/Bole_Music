const sharp = require('sharp');
const potrace = require('potrace');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'resources', 'png.png');
const BLURRED = path.join(__dirname, '..', 'resources', 'png-blurred.png');

async function main() {
  // 先对源图做轻微高斯模糊 → 消除像素锯齿 → 曲线更光滑
  await sharp(SRC)
    .blur(1.5)
    .png()
    .toFile(BLURRED);

  potrace.trace(
    BLURRED,
    {
      turdSize: 8,
      alphaMax: 0.1,
      optCurve: true,
      optTolerance: 0.3,
      threshold: 128,
      blackOnWhite: true,
    },
    function(err, svg) {
      if (err) { console.error(err); process.exit(1); }
      const match = svg.match(/<path[^>]*d="([^"]*)"/);
      if (!match) { console.log('No path'); process.exit(1); }

      const d = match[1];
      const nums = d.match(/[-\d.]+/g).map(Number);
      const allX = [], allY = [];
      for (let i = 0; i < nums.length; i += 2) {
        if (i + 1 < nums.length) { allX.push(nums[i]); allY.push(nums[i + 1]); }
      }
      const bxMin = Math.min(...allX), bxMax = Math.max(...allX);
      const byMin = Math.min(...allY), byMax = Math.max(...allY);

      const result = {
        path: d,
        bounds: { x: Math.floor(bxMin), y: Math.floor(byMin),
                  w: Math.ceil(bxMax - bxMin), h: Math.ceil(byMax - byMin) }
      };

      fs.writeFileSync(
        path.join(__dirname, '..', 'resources', 'horse-data.json'),
        JSON.stringify(result)
      );
      console.log(`Bounds: ${result.bounds.w}x${result.bounds.h} (smoothed)`);

      // 清理临时文件
      fs.unlinkSync(BLURRED);
    }
  );
}

main().catch(err => { console.error(err); process.exit(1); });
