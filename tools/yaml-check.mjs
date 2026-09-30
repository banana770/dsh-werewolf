// 校验 cordis.patch.yml 能被 YAML 正确解析，并打印上帝剧本（persona.prefix）。
//
// 为什么需要它：改剧本之后必须先确认 YAML 没被写坏、换行没被折叠，
// 否则预设会静默失效（装上了但行为不对）。
// 配套：改完 → 跑这个 → 用 plugin_manager 关/开 bundle 让改动生效。
//
// 用法：node yaml-check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
// 注意：本目录的 package.json 带 "type": "module"，所以 yaml 库必须用 .cjs 后缀，
// 否则会被当成 ESM 解析，require() 只能拿到 { default: ... } 命名空间。
const yamlMod = require(path.join(HERE, 'js-yaml.min.cjs'));
const yaml = yamlMod.load ? yamlMod : yamlMod.default;

const PATCH = path.join(HERE, '..', 'cordis.patch.yml');
const text = fs.readFileSync(PATCH, 'utf8');

let doc;
try {
  doc = yaml.load(text);
} catch (e) {
  console.error(`YAML 解析: FAILED\n  ${e.message}`);
  process.exit(1);
}

const out = [];
out.push('YAML 解析: OK');
out.push('顶层类型: ' + (Array.isArray(doc) ? `array len=${doc.length}` : typeof doc));

const insert = doc[0]?.insert;
out.push('insert 行数: ' + (Array.isArray(insert) ? insert.length : 'N/A'));

const preset = insert?.[0];
const cfg = preset?.config ?? {};
out.push('preset row id : ' + preset?.id);
out.push('preset row name: ' + preset?.name);
out.push('config.id   : ' + cfg.id);
out.push('config.name : ' + cfg.name);
out.push('config.order: ' + cfg.order);
out.push('plugins 条数: ' + (cfg.plugins?.length ?? 'N/A'));
out.push('plugins ids : ' + (cfg.plugins ?? []).map((p) => p.id).join(', '));

const persona = (cfg.plugins ?? []).find((p) => p.id === 'persona');
const prefix = persona?.config?.prefix ?? '';
const lines = prefix.split('\n');
out.push('');
out.push(`===== persona.prefix: ${prefix.length} 字符 / ${lines.length} 行 =====`);
out.push('----- 前 20 行 -----');
out.push(lines.slice(0, 20).join('\n'));
out.push('----- 后 8 行 -----');
out.push(lines.slice(-8).join('\n'));

// 关键内容抽查：剧本被写坏时这些会消失
const must = ['[玩家N]', '上帝铁律', '狼队协商', '输出纪律', 'SKIP', '同守同救', '同时'];
out.push('');
out.push('----- 关键内容抽查 -----');
for (const m of must) out.push((prefix.includes(m) ? '  有  ' : '  缺  ') + m);

// 折叠检测：如果是折叠块（>），105 行会塌成几行
const longLines = lines.filter((l) => l.trim().length > 10).length;
out.push('');
out.push(`换行检查: ${longLines} 行有实质内容 → ${longLines > 40 ? '正常（未被折叠）' : '⚠️ 可能被折叠了！'}`);
out.push('');
out.push('改完记得让预设重新加载：plugin_manager set_bundle(false) → set_bundle(true)');

console.log(out.join('\n'));
