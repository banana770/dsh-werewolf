# 第三方文件说明

本目录下有**一个**文件不是本项目原创：

## `js-yaml.min.cjs`

- **来源**：js-yaml（<https://github.com/nodeca/js-yaml>）
- **版本**：随 DeepSeek Harness 安装包分发的版本
- **许可**：MIT
- **为什么在这里**：`yaml-check.mjs` 需要解析 `cordis.patch.yml`，
  而 DSH 自带的 js-yaml 封在 `app.asar` 里无法直接 `require`。
- **为什么是 `.cjs`**：本仓库的 `package.json` 带 `"type": "module"`，
  `.js` 会被当成 ESM 解析，`require()` 只能拿到 `{ default: ... }` 命名空间。

**想更新它**：用 `asar-peek.mjs` 从 DSH 安装包里重新提取，见 `reference/README.md`。

---

本目录其余文件（`asar-peek.mjs`、`yaml-check.mjs`、`schema-probe.mjs`、
`extract-facts.mjs`、`game-report.mjs`）均为本项目原创，适用仓库根目录的 BSD-3-Clause。
