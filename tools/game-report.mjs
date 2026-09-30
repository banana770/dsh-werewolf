// 对局分析：把上帝对真人说的话、玩家的发言、团队私信全部拉出来，并做泄漏/出戏扫描
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2];
const LOG = process.argv[3] ?? 'game-report.txt';
const out = [];
const say = (s = '') => out.push(s);

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.jsonl')) acc.push(p);
  }
  return acc;
}
const load = (f) => fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.trim())
  .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

const textOf = (content) => {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter((b) => b?.type === 'text').map((b) => b.text).join('\n');
};

const files = walk(ROOT);
const main = files.find((f) => !f.includes('subagents'));
const subs = files.filter((f) => f.includes('subagents')).sort();

// ---------------- 主会话：上帝对真人输出 ----------------
const godTurns = [];
const teamSent = [];
const subCalls = [];
for (const o of load(main)) {
  if (o.type === 'assistant/message') {
    const t = textOf(o.data?.message?.content ?? o.data?.content);
    if (t.trim()) godTurns.push(t.trim());
  }
  if (o.type === 'team/message/queued') {
    const d = o.data ?? {};
    teamSent.push({ to: d.target ?? d.to ?? '?', body: textOf(d.content ?? d.message) || JSON.stringify(d).slice(0, 400) });
  }
  if (o.type === 'tool/call') {
    const n = o.data?.name ?? o.data?.toolName;
    if (n) subCalls.push({ n, a: JSON.stringify(o.data?.arguments ?? o.data?.args ?? {}).slice(0, 600) });
  }
}

say('################ A. 上帝对真人说的话（共 ' + godTurns.length + ' 段）################');
godTurns.forEach((t, i) => { say(''); say(`--- [${i + 1}] ---`); say(t); });

say('');
say('################ B. 上帝发给玩家的私信（共 ' + teamSent.length + ' 条）################');
teamSent.forEach((m, i) => { say(''); say(`--- [${i + 1}] → ${m.to} ---`); say(m.body); });

// ---------------- 玩家会话 ----------------
say('');
say('################ C. 每个玩家的发言 ################');
for (const f of subs) {
  const id = path.basename(path.dirname(f)).slice(0, 8);
  const evs = load(f);
  const says = evs.filter((o) => o.type === 'assistant/message')
    .map((o) => textOf(o.data?.message?.content ?? o.data?.content).trim()).filter(Boolean);
  const inbox = evs.filter((o) => o.type === 'user/message')
    .map((o) => textOf(o.data?.message?.content ?? o.data?.content).trim()).filter(Boolean);
  say('');
  say(`===== 玩家 ${id} : 收到 ${inbox.length} 条消息 / 回复 ${says.length} 次 =====`);
  says.forEach((t, i) => { say(`  [回${i + 1}] ${t}`); });
}

// ---------------- 扫描 ----------------
const LEAK_PAT = [
  /(狼人|狼)\s*(刀|杀)\s*\d/, /刀\s*\d+\s*号/, /毒\s*\d+\s*号/, /守\s*\d+\s*号/, /验\s*\d+\s*号/,
  /票数\s*\d+\s*[:：]\s*\d+/, /平票.*取最早/, /悍跳/, /是狼人/, /狼队友/, /金水是/,
];
const OOC_PAT = [/我是\s*AI/, /作为\s*AI/, /语言模型/, /我是上帝/, /我是法官/, /系统提示/];

const allGodText = godTurns.join('\n\n');
const leakHits = [];
for (const p of LEAK_PAT) {
  const m = allGodText.match(new RegExp(p.source, 'g'));
  if (m) leakHits.push(`${p}  ×${m.length}`);
}
say('');
say('################ D. 泄漏扫描（扫的是上帝对真人说的话）################');
say('说明：这些词出现在【上帝→真人】的正文里，就可能是泄漏。需人工看上下文。');
say(leakHits.length ? leakHits.map((s) => '  ⚠ ' + s).join('\n') : '  （无命中）');

const oocHits = [];
for (const f of subs) {
  const id = path.basename(path.dirname(f)).slice(0, 8);
  const txt = load(f).filter((o) => o.type === 'assistant/message')
    .map((o) => textOf(o.data?.message?.content ?? o.data?.content)).join('\n');
  for (const p of OOC_PAT) if (p.test(txt)) oocHits.push(`  玩家 ${id} 命中 ${p}`);
}
say('');
say('################ E. 出戏扫描（扫的是玩家的话）################');
say(oocHits.length ? oocHits.join('\n') : '  （无命中）');

say('');
say('################ F. 上帝用过的工具（次数）################');
const cnt = new Map();
for (const c of subCalls) cnt.set(c.n, (cnt.get(c.n) ?? 0) + 1);
[...cnt.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => say(`  ${String(v).padStart(3)}  ${k}`));

fs.writeFileSync(LOG, out.join('\n'), 'utf8');
console.log(`报告已写入: ${LOG}`);
console.log(`上帝发言 ${godTurns.length} 段 / 私信 ${teamSent.length} 条 / 玩家 ${subs.length} 个`);
console.log(`泄漏命中 ${leakHits.length} 类 / 出戏命中 ${oocHits.length} 处`);
