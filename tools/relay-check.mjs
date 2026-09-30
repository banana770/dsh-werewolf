// 检查：法官发给玩家的消息里，"前置发言"是全文还是摘要？摘要到什么程度？
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2];
const LOG = process.argv[3] ?? 'relay-check.txt';
const out = [];
const say = (s = '') => out.push(s);

const main = path.join(ROOT, 'session.v4.jsonl');
const lines = fs.readFileSync(main, 'utf8').split('\n').filter((l) => l.trim());
const evs = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

const textOf = (c) => (Array.isArray(c) ? c.filter((b) => b?.type === 'text').map((b) => b.text).join('\n') : '');

// --- 1) 法官发给玩家的消息（含前置发言的那些）---
const toPlayers = [];
for (const o of evs) {
  if (o.type !== 'team/message/queued') continue;
  const d = o.data ?? {};
  const msg = d.message ?? d;
  if (msg.senderName !== 'lead') continue;
  const body = textOf(msg.content);
  if (body) toPlayers.push({ to: msg.targetId?.slice(0, 8), n: body.length, body });
}

say(`########## 法官发给玩家的消息：${toPlayers.length} 条 ##########`);
const withSpeech = toPlayers.filter((m) => /前置发言|前置|发言/.test(m.body));
say(`其中含"发言"字样的：${withSpeech.length} 条`);
say('');

// --- 2) 找几条典型的"前置发言"段落，原样打印 ---
let shown = 0;
for (const m of withSpeech) {
  const idx = m.body.search(/前置发言|【前置】|前置的发言/);
  if (idx < 0) continue;
  shown++;
  if (shown > 4) break;
  say('='.repeat(72));
  say(`>>> 消息长度 ${m.n} 字符，目标 ${m.to}`);
  say('--- 前置发言段落（原样） ---');
  say(m.body.slice(Math.max(0, idx - 200), idx + 1400));
  say('');
}

// --- 3) 长度分布：法官给玩家的消息 vs 玩家自己的发言 ---
say('='.repeat(72));
say('########## 长度对比 ##########');
const lens = toPlayers.map((m) => m.n).sort((a, b) => a - b);
if (lens.length) {
  say(`法官→玩家 消息长度: 最短 ${lens[0]}  中位 ${lens[Math.floor(lens.length / 2)]}  最长 ${lens[lens.length - 1]}`);
}

// 玩家发言长度（从子代理会话取）
let sp = [];
for (const d of fs.readdirSync(path.join(ROOT, 'subagents'), { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const f = path.join(ROOT, 'subagents', d.name, 'session.v4.jsonl');
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!l.trim()) continue;
    let o; try { o = JSON.parse(l); } catch { continue; }
    if (o.type === 'assistant/message') {
      const t = textOf(o.data?.message?.content).trim();
      if (t.length > 60) sp.push(t.length);
    }
  }
}
sp.sort((a, b) => a - b);
if (sp.length) {
  say(`玩家发言 长度: 最短 ${sp[0]}  中位 ${sp[Math.floor(sp.length / 2)]}  最长 ${sp[sp.length - 1]}   (n=${sp.length})`);
}
say('');
say('判读：如果"法官→玩家"的中位长度明显小于"玩家发言"的中位长度，说明发言在转发时被压缩了。');

fs.writeFileSync(LOG, out.join('\n'), 'utf8');
console.log(out.join('\n'));
