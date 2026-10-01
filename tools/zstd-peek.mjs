// 解开【多帧】zstd 会话日志（DSH 的 session.v4.jsonl.zstd 是追加写的，
// 每次 flush 一个独立 zstd frame），然后检索错误现场。
import fs from 'node:fs';
import zlib from 'node:zlib';

const F = process.argv[2];
const buf = fs.readFileSync(F);

// zstd 帧魔数 0x28 B5 2F FD
const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
const starts = [];
for (let i = 0; i + 4 <= buf.length; i++) {
  if (buf[i] === 0x28 && buf[i + 1] === 0xb5 && buf[i + 2] === 0x2f && buf[i + 3] === 0xfd) starts.push(i);
}
starts.push(buf.length);

let out = '';
let ok = 0, bad = 0;
for (let k = 0; k < starts.length - 1; k++) {
  const frame = buf.subarray(starts[k], starts[k + 1]);
  try { out += zlib.zstdDecompressSync(frame).toString('utf8'); ok++; }
  catch { bad++; }
}
console.log(`帧数 ${starts.length - 1}  (成功 ${ok} / 失败 ${bad})`);
console.log(`解压后 ${(out.length / 1024).toFixed(0)} KB，${out.split('\n').filter((l) => l.trim()).length} 行`);

const evs = out.split('\n').filter((l) => l.trim())
  .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

const hist = new Map();
for (const o of evs) hist.set(o.type, (hist.get(o.type) ?? 0) + 1);
console.log('\n事件类型 Top 15:');
[...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([k, v]) => console.log(`  ${String(v).padStart(5)}  ${k}`));

console.log('\n===== 错误现场 =====');
let n = 0;
for (const o of evs) {
  const s = JSON.stringify(o);
  if (/"error"|400 status|status code|"failure"/i.test(s)) {
    n++;
    if (n <= 15) {
      console.log(`\n--- [${o.type}] seq=${o.seq} time=${o.time} ---`);
      console.log(s.slice(0, 800));
    }
  }
}
console.log(`\n命中 ${n} 条`);
