// 看上下文是怎么长起来的：每次成功请求的 token 用量走势
import fs from 'node:fs';

const F = process.argv[2];
const evs = fs.readFileSync(F, 'utf8').split('\n').filter((l) => l.trim())
  .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

const rows = [];
for (const o of evs) {
  if (o.type !== 'assistant/attempt') continue;
  const stream = o.data?.stream ?? [];
  let usage = null, fail = null;
  for (const c of stream) {
    if (c.chunk?.type === 'usage') usage = c.chunk.usage;
    if (c.chunk?.type === 'finish') {
      const r = c.chunk.reason;
      if (r?.kind === 'error') fail = r.failure;
    }
  }
  if (usage && usage.inputTokens > 0) rows.push({ turn: o.data.turn, step: o.data.step, t: o.time, in: usage.inputTokens, out: usage.outputTokens, fail });
  else if (fail) rows.push({ turn: o.data.turn, step: o.data.step, t: o.time, in: 0, out: 0, fail });
}

console.log(`带用量的尝试: ${rows.length} 次\n`);
console.log('轮次  时间      输入token   输出token   备注');
console.log('─'.repeat(66));

// 采样：每 20 条打一条 + 最后 15 条全打
const show = [];
rows.forEach((r, i) => { if (i % 20 === 0 || i >= rows.length - 15) show.push(r); });
for (const r of show) {
  const tt = new Date(r.t).toISOString().slice(11, 19);
  const note = r.fail ? `❌ ${r.fail.code}: ${r.fail.message}` : '';
 console.log(`${String(r.turn).padStart(4)}  ${tt}  ${String(r.in).padStart(9)}  ${String(r.out).padStart(8)}   ${note}`);
}

const maxIn = Math.max(...rows.filter((r) => r.in > 0).map((r) => r.in));
console.log('\n' + '─'.repeat(66));
console.log(`输入 token 峰值: ${maxIn.toLocaleString()}`);
console.log(`最后一次成功用量: ${rows.filter((r) => r.in > 0).slice(-1)[0]?.in.toLocaleString() ?? '?'}`);

// 找请求头里的 maxTokens 配置
const hdr = evs.find((o) => o.type === 'request/header');
if (hdr) console.log('请求头 config: ' + JSON.stringify(hdr.data?.header?.config));
