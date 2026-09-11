import fs from 'node:fs';
import zlib from 'node:zlib';

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function solidPng(size) {
  const rows = [];
  for (let y = 0; y < size; y++) {
    const line = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      const nx = (x + 0.5) / size;
      const ny = (y + 0.5) / size;
      let pr = 0x3b;
      let pg = 0x5f;
      let pb = 0xeb;
      const inBody = nx > 0.18 && nx < 0.82 && ny > 0.28 && ny < 0.86;
      if (inBody) {
        pr = 0xef;
        pg = 0x3f;
        pb = 0x3a;
      }
      const leaf = (nx - 0.58) ** 2 / 0.04 + (ny - 0.22) ** 2 / 0.018 < 1 && nx > 0.5;
      if (leaf) {
        pr = 0x17;
        pg = 0xc2;
        pb = 0x6a;
      }
      const hx = nx - 0.5;
      const hy = ny - 0.52;
      const left = (hx + 0.08) ** 2 + (hy + 0.04) ** 2 < 0.018;
      const right = (hx - 0.08) ** 2 + (hy + 0.04) ** 2 < 0.018;
      const bottom = hy > -0.02 && hy < 0.18 && Math.abs(hx) < 0.14 - hy * 0.55;
      if (inBody && (left || right || bottom)) {
        pr = 0xff;
        pg = 0xff;
        pb = 0xff;
      }
      line[1 + x * 3] = pr;
      line[2 + x * 3] = pg;
      line[3 + x * 3] = pb;
    }
    rows.push(line);
  }
  const compressed = zlib.deflateSync(Buffer.concat(rows));
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.writeFileSync('public/pwa-192.png', solidPng(192));
fs.writeFileSync('public/pwa-512.png', solidPng(512));
console.log('icons ok');
