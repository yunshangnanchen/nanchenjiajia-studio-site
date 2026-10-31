/* ============================================================
   tools/works-build.js — 扫描作品图，生成清单 works-list.js
   用法（项目根目录）：node tools/works-build.js

   做三件事：
   ① 扫描 assets/works 里所有图片（删掉几张也不会乱，编号有洞照样能排）；
   ② 读出每张的像素尺寸，写成 window.NCJ_WORKS = [{ f, w, h }, ...]；
   ③ 顺手把 studio.html 里的 data-work-count / 计数改成实际张数。

   删图 / 加图之后跑一次就行，页面上的作品墙会按新清单重新洗牌排版。
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'assets', 'works');
const OUT = path.join(ROOT, 'works-list.js');
const PAGE = path.join(ROOT, 'studio.html');

/* JPEG：找 SOF 段里的高、宽 */
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    if (m === 0xd9 || m === 0xda) break;
    const len = buf.readUInt16BE(i + 2);
    const isSOF = m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
    if (isSOF) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    if (len < 2) break;
    i += 2 + len;
  }
  return null;
}

/* PNG：IHDR 在固定位置 */
function pngSize(buf) {
  if (buf.length < 24) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const files = fs.readdirSync(DIR)
  .filter(f => /\.(jpe?g|png|webp)$/i.test(f))
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

const rows = [];
let miss = 0;
for (const f of files) {
  const buf = fs.readFileSync(path.join(DIR, f));
  const size = /\.png$/i.test(f) ? pngSize(buf) : jpegSize(buf);
  if (!size || !size.w || !size.h) { miss++; continue; }
  rows.push(`  { f: ${JSON.stringify(f)}, w: ${size.w}, h: ${size.h} }`);
}

const js = `/* 自动生成，请勿手改 —— node tools/works-build.js
   作品墙清单：文件名 + 原始像素尺寸。删改图片后重跑脚本即可。 */
window.NCJ_WORKS = [
${rows.join(',\n')}
];
`;

fs.writeFileSync(OUT, js, 'utf8');

/* 同步页面上的张数 */
let page = fs.readFileSync(PAGE, 'utf8');
page = page
  .replace(/data-work-count="\d+"/, `data-work-count="${rows.length}"`)
  .replace(/(<span class="works-count" id="worksCount">)\d+(<\/span>)/, `$1${rows.length}$2`);
fs.writeFileSync(PAGE, page, 'utf8');

console.log(`${rows.length} 张 → ${path.relative(ROOT, OUT)}；studio.html 张数已同步`
  + (miss ? `（${miss} 张读取失败已跳过）` : ''));
