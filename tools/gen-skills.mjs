// Skill generator — ONE canonical source per skill (skills/<name>/SKILL.md) → per-agent files.
// Prevents N-way drift: edit the SKILL.md, run `pnpm gen:skills`, every agent's copy regenerates.
// The ~90%-shared body is emitted verbatim; only each agent's frontmatter/registration differs.
//
// Outputs (all committed — they're the shippable adapters):
//   Claude Code : plugins/capx-cafe/commands/<name>.md            (invoke: /capx-cafe:<name>)
//   Cursor      : plugins/capx-cafe/adapters/cursor/capx-<name>.mdc
//   Codex       : plugins/capx-cafe/adapters/codex/capx-<name>.md  (invoke: /capx-<name>)
//   Windsurf    : plugins/capx-cafe/adapters/windsurf/capx-<name>.md
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = join(ROOT, 'skills');
const PLUGIN = join(ROOT, 'plugins', 'capx-cafe');

/** Minimal frontmatter parser for our controlled `key: value` (+ ["a","b"]) shape. */
function parse(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error('SKILL.md missing frontmatter');
  const meta = {};
  for (const line of m[1].split('\n')) {
    const mm = line.match(/^([A-Za-z-]+):\s*(.*)$/);
    if (!mm) continue;
    let v = mm[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    meta[mm[1]] = v;
  }
  return { meta, body: m[2].trim() };
}

const ensure = (d) => mkdirSync(d, { recursive: true });
const fm = (obj) => '---\n' + Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join('\n') + '\n---\n';
const q = (s) => JSON.stringify(String(s)); // YAML-safe double-quoted scalar

const out = {
  claude: join(PLUGIN, 'commands'),
  cursor: join(PLUGIN, 'adapters', 'cursor'),
  codex: join(PLUGIN, 'adapters', 'codex'),
  windsurf: join(PLUGIN, 'adapters', 'windsurf'),
};
Object.values(out).forEach(ensure);

const names = readdirSync(SKILLS_DIR).filter((d) => {
  try {
    return statSync(join(SKILLS_DIR, d, 'SKILL.md')).isFile();
  } catch {
    return false;
  }
});

const GEN = '<!-- GENERATED from skills/%/SKILL.md by tools/gen-skills.mjs — do not hand-edit; edit the source. -->\n';

for (const name of names) {
  const { meta, body } = parse(readFileSync(join(SKILLS_DIR, name, 'SKILL.md'), 'utf8'));
  const desc = meta.description ?? '';
  const hint = meta['argument-hint'];
  const note = GEN.replace('%', name);

  // Claude Code slash command
  const claudeFm = { description: q(desc), ...(hint ? { 'argument-hint': q(hint) } : {}) };
  writeFileSync(join(out.claude, `${name}.md`), fm(claudeFm) + note + '\n' + body + '\n');

  // Cursor rule (.mdc) — description-triggered, not always-on
  writeFileSync(join(out.cursor, `capx-${name}.mdc`), fm({ description: q(desc), alwaysApply: false }) + note + `\n# capx-${name}\n\n` + body + '\n');

  // Codex prompt — plain markdown, invoked /capx-<name>
  writeFileSync(join(out.codex, `capx-${name}.md`), note + `# capx-${name}\n\n` + body + '\n');

  // Windsurf workflow
  writeFileSync(join(out.windsurf, `capx-${name}.md`), fm({ description: q(desc) }) + note + '\n' + body + '\n');

  console.log(`  ${name} → claude · cursor · codex · windsurf`);
}
console.log(`generated ${names.length} skill(s) × 4 agents`);
