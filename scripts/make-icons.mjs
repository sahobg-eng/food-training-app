// Generates the PWA icons (PNG + SVG) without any dependencies.
// Design: a white dumbbell on the app's dark background, drawn on a 512 grid and kept
// inside the central 80% so the same image works as a maskable icon.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [0x0f, 0x17, 0x2a];
const FG = [0x22, 0xc5, 0x5e];
// [x0, y0, x1, y1] on a 512x512 grid
const RECTS = [
  [150, 240, 362, 272], // bar
  [150, 166, 190, 346], // left inner plate
  [322, 166, 362, 346], // right inner plate
  [116, 200, 150, 312], // left outer plate
  [362, 200, 396, 312], // right outer plate
];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (const b of buf) {
    c = (crc ^ b) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size) {
  const s = size / 512;
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const gx = (x + 0.5) / s, gy = (y + 0.5) / s;
      const on = RECTS.some(([x0, y0, x1, y1]) => gx >= x0 && gx < x1 && gy >= y0 && gy < y1);
      const c = on ? FG : BG;
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" rx="96" fill="${hex(BG)}"/>
${RECTS.map(([x0, y0, x1, y1]) => `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="${hex(FG)}"/>`).join('\n')}
</svg>
`;

writeFileSync('public/icon-192.png', png(192));
writeFileSync('public/icon-512.png', png(512));
writeFileSync('public/icon.svg', svg);
console.log('icons written');
