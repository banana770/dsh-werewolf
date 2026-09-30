// 在会话里找"智能体上限"的讨论与解决过程
import fs from 'node:fs';

const F = process.argv[2];
const OUT = process.argv[3] ?? 'limit-hunt.txt';
const out = [];
const say = (s = '') => out.push(s);

const evs = fs.readFileSync(F, 'utf8').split('\n').filter((l) => l.trim())
  .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

const textOf = (c) => (Array.isArray(c) ? c.filter((b) => b?.type === 'text').map((b) => b.text).join('\n') : '');

// 收集所有"人的话"：用户消息 + 助手消息
const humans = [];
for (const o of evs) {
  if (o.type === 'user/message') {
    const t = textOf(o.data?.message?.content).trim();
    if (t) humans.push({ role: 'USER', t, seq: o.seq });
  } else if (o.type === 'assistant/message') {
    const t = textOf(o.data?.message?.content).trim();
    if (t) humans.push({ role: 'ASSISTANT', t, seq: o.seq });
  }
}
say(`会话内人类可见的发言: ${humans.length} 段（USER ${humans.filter((h) => h.role === 'USER').length} / ASSISTANT ${humans.filter((h) => h.role === 'ASSISTANT').length}）`);
say('');

const KEYS = ['名额', '上限', 'ACTIVATION', 'maxActive', 'maxMembers', '智能体数量', '11 个', '8 个'];
const hits = humans.filter((h) => KEYS.some((k) => h.t.includes(k)));
say(`提到关键词的段落: ${hits.length}`);
say('');

for (const h of hits.slice(0, 30)) {
  say('='.repeat(74));
  say(`[${h.role}] seq=${h.seq}  长度 ${h.t.length}`);
  say('-'.repeat(74));
  say(h.t.slice(0, 1200));
  say('');
}

fs.writeFileSync(OUT, out.join('\n'), 'utf8');
console.log(out.join('\n').slice(0, 12000));
