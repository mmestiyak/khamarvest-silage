// Regenerates the favicon set from favicon.svg. Run: npm run favicon
// Only needed when the mark itself changes; the files are committed.
//
// Google needs a fetchable favicon to show beside a result, and it will not
// accept a data: URI. /favicon.ico is the path crawlers request by default.
import { readFile, writeFile, stat } from 'node:fs/promises';
import sharp from 'sharp';

const svg = await readFile('favicon.svg');
for (const size of [48, 96, 180, 192, 512]) {
  const buf = await sharp(svg, { density: 600 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(`favicon-${size}.png`, buf);
}
// A real ICO wrapping a 48x48 PNG. ICO has allowed embedded PNG since Vista,
// and this keeps /favicon.ico serving the correct media type.
const png = await sharp(svg, { density: 600 }).resize(48, 48).png({ compressionLevel: 9 }).toBuffer();
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
const dir = Buffer.alloc(16);
dir.writeUInt8(48, 0); dir.writeUInt8(48, 1);
dir.writeUInt16LE(1, 4); dir.writeUInt16LE(32, 6);
dir.writeUInt32LE(png.length, 8); dir.writeUInt32LE(22, 12);
await writeFile('favicon.ico', Buffer.concat([header, dir, png]));

for (const f of ['favicon.ico', 'favicon-48.png', 'favicon-192.png', 'favicon-512.png']) {
  console.log(`  ${String(Math.round((await stat(f)).size / 102.4) / 10).padStart(6)} KB  ${f}`);
}
