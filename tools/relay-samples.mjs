// 抽样看法官发给玩家的消息原文，找出"发言是怎么被转述的"
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2];
const OUT = process.argv[3] ?? 'relay-samples.txt';
const out = [];
const say = (s = '') => out.push(s);

const lines = fs.readFileSync(path.join(ROOT, 'session.v4.jsonl'), 'utf8').split('\n').filter((l) => l.trim());
const evs = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const textOf = (c) => (Array.isArray(c) ? c.filter((b) => b?.type === 'text').map((b) => b.text).join('\n') : '');

const toPlayers = [];
for (const o of evs) {
  if (o.type !== 'team/message/queued') continue;
  const msg = o.data?.message ?? o.data ?? {};
  if (msg.senderName !== 'lead') continue;
  const body = textOf(msg.content);
  if (body) toPlayers.push({ to: String(msg.targetId ?? '').slice(0, 8), n: body.length, body });
}

// 找含引号（转述发言）的消息，按长度分层抽样
const quoted = toPlayers.filter((m) => /[「『"]/.test(m.body));
say(`含引号（疑似转述发言）的消息: ${quoted.length} / ${toPlayers.length}`);
quoted.sort((a, b) => a.n - b.n);

const picks = [
  quoted[Math.floor(quoted.length * 0.1)],
  quoted[Math.floor(quoted.length * 0.4)],
  quoted[Math.floor(quoted.length * 0.75)],
  quoted[quoted.length - 1],
].filter(Boolean);

for (const m of picks) {
  say('');
  say('='.repeat(74));
  say(`>>> 目标 ${m.to} · ${m.n} 字符`);
  say('-'.repeat(74));
  say(m.body.slice(0, 1900));
}

// 统计：消息里提到多少个座位号（转述了几个人的发言）
say('');
say('='.repeat(74));
const seatCounts = quoted.map((m) => new Set((m.body.match(/\b\d{1,2}\s*号/g) ?? [])).size);
seatCounts.sort((a, b) => a - b);
if (seatCounts.length) {
  say(`每条消息提到的座位号种类数: 中位 ${seatCounts[Math.floor(seatCounts.length / 2)]}  最大 ${seatCounts[seatCounts.length - 1]}`);
}

fs.writeFileSync(OUT, out.join('\n'), 'utf8');
console.log(out.join('\n').slice(0, 9000));
