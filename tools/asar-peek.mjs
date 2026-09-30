// 读取 DSH 安装目录里的 app.asar（Electron 打包档），列出或提取其中的文件。
//
// 为什么需要它：DSH 的官方包（README、类型定义、开发指南）都封在 app.asar 里，
// 普通的文件工具、glob/grep、node 的 fs 都打不开它。想查官方文档就得走这里。
//
// 用法：
//   node asar-peek.mjs list    <路径子串>
//   node asar-peek.mjs extract <路径子串> <输出目录>
//
// 例：
//   node asar-peek.mjs list "node_modules/@deepseek-ai/dsh-subagent/"
//   node asar-peek.mjs extract "node_modules/@deepseek-ai/dsh-persona/README" ./out
//
// ASAR 头部结构（三段 pickle）：
//   @0  u32 = 4
//   @4  u32 = 头部总大小 size
//   @8  u32 = size - 4
//   @12 u32 = JSON 字节长度 size - 8
//   @16     JSON 正文（文件树，offset 是相对 base = 8 + size 的字符串！）
import fs from 'node:fs';
import path from 'node:path';

const ASAR = process.env.DSH_ASAR
  ?? 'C:/Users/liu/AppData/Local/Programs/DeepSeek Harness/resources/app.asar';

const [mode, needle, outDir] = process.argv.slice(2);
if (!mode || !needle) {
  console.error('用法: node asar-peek.mjs <list|extract> <路径子串> [输出目录]');
  process.exit(2);
}

const fd = fs.openSync(ASAR, 'r');
const head = Buffer.alloc(16);
fs.readSync(fd, head, 0, 16, 0);
const size = head.readUInt32LE(4);
const hdr = Buffer.alloc(size - 8);
fs.readSync(fd, hdr, 0, size - 8, 16);
const text = hdr.toString('utf8');
const tree = JSON.parse(text.slice(0, text.lastIndexOf('}') + 1));
const base = 8 + size;

const all = [];
(function walk(node, prefix) {
  for (const [name, v] of Object.entries(node.files ?? {})) {
    const p = `${prefix}/${name}`;
    if (v.files) walk(v, p);
    else all.push({ path: p, offset: Number(v.offset), size: v.size, unpacked: !!v.unpacked });
  }
})(tree, '');

const hits = all.filter((f) => f.path.includes(needle));
console.log(`entries=${all.length}  matches("${needle}")=${hits.length}`);
for (const h of hits) console.log(`${String(h.size).padStart(9)}  ${h.path}`);

if (mode === 'extract') {
  for (const h of hits) {
    if (h.unpacked) { console.log(`SKIP(unpacked) ${h.path}`); continue; }
    const dest = path.join(outDir, h.path.replace(/^\/+/, ''));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const b = Buffer.alloc(h.size);
    fs.readSync(fd, b, 0, h.size, base + h.offset);
    fs.writeFileSync(dest, b);
  }
  console.log(`extracted -> ${outDir}`);
}
fs.closeSync(fd);
