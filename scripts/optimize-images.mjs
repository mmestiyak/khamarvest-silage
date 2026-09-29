// Generates responsive WebP + JPEG variants for every published image.
// Run: npm run images
//
// Why this matters more than the format alone: the hero image is the LCP
// element on almost every page, and we were shipping one 1200-1400 px file to
// everybody. A farmer on a phone was downloading a 570 KB image to paint it
// 375 px wide. Serving a width that matches the screen is the large saving;
// WebP is a further 40-50% on top of it.
//
// Pages reference these through <picture>: WebP srcset first, JPEG srcset as
// the fallback, and the original JPEG stays as the <img src> and as the
// og:image, because social and search scrapers are the one place where JPEG is
// still the safer bet.
//
// Only the optimized img/*-1200.jpeg / *-1400.jpeg copies are sources. The raw
// camera originals (img/IMG_*.JPG.jpeg) are repo-only and never published.
import { readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const imgDir = join(root, 'img');
export const WIDTHS = [480, 800, 1200];
const WEBP_QUALITY = 62;
const JPEG_QUALITY = 72;
// WebP is not automatically smaller. On these field photos (grass, chopped
// stalks: fine, noisy texture) mozjpeg beat WebP at q78 on every file, so every
// <picture> was serving the larger format: 169 KB WebP where the 115 KB JPEG sat
// unused. Now WebP is kept for an image only if it wins at every width;
// otherwise no .webp is written and the wrapper serves the JPEG srcset alone.
// Per image, not per width, so a WebP srcset never lacks the size a screen needs.

const sources = (await readdir(imgDir)).filter((f) => /-\d{3,4}\.jpeg$/.test(f) && !/-\d{3,4}w\./.test(f)).sort();
if (!sources.length) throw new Error('img/: no optimized *-1200.jpeg / *-1400.jpeg sources found');

let originals = 0;
let mobile = 0;
for (const file of sources) {
  const src = join(imgDir, file);
  const base = file.replace(/\.jpeg$/, '');
  const { width } = await sharp(src).metadata();
  const srcSize = (await stat(src)).size;
  originals += srcSize;
  const made = [];
  const variants = [];
  for (const w of WIDTHS) {
    if (w > width) continue; // never upscale
    const resized = sharp(src).resize({ width: w, withoutEnlargement: true });
    const webp = await resized.clone().webp({ quality: WEBP_QUALITY, effort: 6, smartSubsample: true }).toBuffer();
    const jpeg = await resized.clone().jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
    variants.push({ w, webp, jpeg });
  }
  const keepWebp = variants.every((v) => v.webp.length < v.jpeg.length);
  for (const { w, webp, jpeg } of variants) {
    await writeFile(join(imgDir, `${base}-${w}w.jpeg`), jpeg);
    if (keepWebp) await writeFile(join(imgDir, `${base}-${w}w.webp`), webp);
    else await rm(join(imgDir, `${base}-${w}w.webp`), { force: true });
    made.push(`${w}w ${Math.round(webp.length / 1024)}/${Math.round(jpeg.length / 1024)} KB`);
    if (w === 800) mobile += keepWebp ? webp.length : jpeg.length;
  }
  if (!keepWebp) made.push('JPEG only');
  console.log(`${file.padEnd(32)} ${String(Math.round(srcSize / 1024)).padStart(4)} KB source -> ${made.join(', ')}  (webp/jpeg)`);
}
console.log(`\n${sources.length} image(s). A phone now fetches the smaller 800w file: ${Math.round(mobile / 1024)} KB total against ${Math.round(originals / 1024)} KB of full-size JPEG before.`);
