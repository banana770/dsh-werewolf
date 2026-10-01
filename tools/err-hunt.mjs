// 从会话日志里挖出 400 / rate limit 的完整现场
import fs from 'node:fs';

const F = process.argv[2];
const out = [];
const say = (s = '') => out.push(s);

const evs = fs.readFileSync(F, 'utf8').split('\n').filter((l) => l.trim())
  .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

say(`总事件: ${evs.length}`);

const hits = [];
for (const o of evs) {
  const s = JSON.stringify(o);
  if (/400 status|rate limit|"error"|status code/i.test(s)) hits.push({ o, s });
}
say(`命中错误相关事件: ${hits.length}\n`);

for (const { o, s } of hits) {
  const t = o.time ? new Date(o.time).toISOString().slice(11, 19) : '--:--:--';
  say('='.repeat(76));
  say(`[${o.type}] seq=${o.seq}  ${t}`);
  // 尽量把 error 字段抽出来
  const obj = o.data ?? o;
  const deep = JSON.stringify(obj);
  const m = deep.match(/"(message|error|reason|detail|status|code)"\s*:\s*("[^"]{0,300}"|\{[^}]{0,300}\})/g);
  if (m) say('  字段: ' + m.slice(0, 6).join('  |  '));
  say('  原文: ' + s.slice(0, 900));
  say('');
}

// 统计：错误发生的时间点分布
say('='.repeat(76));
const times = hits.map((h) => h.o.time).filter(Boolean).sort();
if (times.length) {
  say(`最早错误: ${new Date(times[0]).toISOString()}`);
  say(`最晚错误: ${new Date(times[times.length - 1]).toISOString()}`);
}
say(`会话创建: ${evs[0]?.createdAt ? new Date(evs[0].createdAt).toISOString() : '?'}`);

fs.writeFileSync(process.argv[3] ?? 'err-hunt.txt', out.join('\n'), 'utf8');
console.log(out.join('\n').slice(0, 11000));
