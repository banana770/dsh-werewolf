// 提取关键事实：预设切换、系统提示词（persona）到底长什么样
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2];
const LOG = process.argv[3] ?? 'facts.txt';
const out = [];
const say = (s) => out.push(s);

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.jsonl')) acc.push(p);
  }
  return acc;
}
const load = (f) => fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.trim()).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

const files = walk(ROOT);
const main = files.find((f) => !f.includes('subagents'));
const subs = files.filter((f) => f.includes('subagents')).sort();

// ---------- 1. 主会话的预设事件 ----------
say('########## 1. 主会话的 agent-preset 相关事件 ##########');
for (const o of load(main)) {
  if (String(o.type).includes('preset')) say(JSON.stringify(o).slice(0, 500));
}

// ---------- 2. 系统提示词里有没有我们的剧本 ----------
function inspectSystem(f, label) {
  const evs = load(f);
  const sys = evs.find((o) => o.type === 'system/message');
  const hdr = evs.find((o) => o.type === 'session');
  say('');
  say('='.repeat(72));
  say(`### ${label}`);
  say(`    id=${hdr?.id}  preset=${hdr?.agentPreset}  origin=${hdr?.origin ?? '(主)'}  depth=${hdr?.delegationDepth}`);
  if (!sys) { say('    (没有 system/message 事件)'); return; }
  const raw = JSON.stringify(sys);
  const hasOurScript = raw.includes('上帝铁律');
  const hasPrefixRule = raw.includes('[玩家N]');
  const hasOldPersona = raw.includes('coding agent powered by');
  const hasReview = raw.includes('software engineer assistant');
  say(`    含【上帝铁律】= ${hasOurScript}   含【[玩家N] 前缀规则】= ${hasPrefixRule}`);
  say(`    含【You are a coding agent】= ${hasOldPersona}   含【helpful software engineer】= ${hasReview}`);
  // 找出 persona 段落的开头
  const text = typeof sys.data === 'string' ? sys.data : JSON.stringify(sys.data);
  const idx = text.indexOf('狼人杀');
  if (idx >= 0) say(`    persona 片段: ...${text.slice(Math.max(0, idx - 120), idx + 260).replace(/\\n/g, ' / ')}...`);
  else say(`    (未找到"狼人杀"字样) 开头: ${text.slice(0, 300)}`);
}

say('');
say('########## 2. 系统提示词对比：上帝 vs 玩家 ##########');
inspectSystem(main, '主会话（上帝/Lead）');
for (const s of subs) inspectSystem(s, '玩家子代理 ' + path.basename(path.dirname(s)).slice(0, 8));

fs.writeFileSync(LOG, out.join('\n'), 'utf8');
console.log(out.join('\n'));
