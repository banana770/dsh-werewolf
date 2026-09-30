// 会话导出（session.v4.jsonl）结构探查
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2];
const LOG = process.argv[3] ?? 'schema-report.txt';
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

const files = walk(ROOT).sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);

for (const f of files) {
  const rel = path.relative(ROOT, f);
  const lines = fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.trim());
  say('='.repeat(70));
  say(`FILE: ${rel}   (${lines.length} 行, ${(fs.statSync(f).size / 1024).toFixed(0)} KB)`);

  const hist = new Map();
  let header = null;
  for (const l of lines) {
    let o;
    try { o = JSON.parse(l); } catch { continue; }
    if (o.type === 'session') header = o;
    hist.set(o.type, (hist.get(o.type) ?? 0) + 1);
  }
  if (header) {
    const { type, ...rest } = header;
    say('HEADER: ' + JSON.stringify(rest));
  }
  const top = [...hist.entries()].sort((a, b) => b[1] - a[1]);
  say('TYPES: ' + top.map(([k, v]) => `${k}=${v}`).join('  '));
  say('');
}

fs.writeFileSync(LOG, out.join('\n'), 'utf8');
console.log(out.join('\n'));
