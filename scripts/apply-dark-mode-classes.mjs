/**
 * Append dark: variants for common light-only Tailwind classes under src/.
 * Skips variant-prefixed utilities (hover:, dark:, etc.) via (?<![a-z]:) before token.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..', 'src');

/** @param {string} rel */
function walk(rel, out = []) {
  const dir = path.join(ROOT, rel);
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walk(path.join(rel, name.name), out);
    else if (/\.(tsx|ts|jsx|js)$/.test(name.name)) out.push(p);
  }
  return out;
}

function transform(content) {
  let c = content;
  const LB = String.raw`(?<![a-z]:)`;
  const rules = [
    [new RegExp(LB + String.raw`text-slate-900(?!\s+dark:)`, 'g'), 'text-slate-900 dark:text-slate-50'],
    [new RegExp(LB + String.raw`text-slate-800(?!\s+dark:)`, 'g'), 'text-slate-800 dark:text-slate-100'],
    [new RegExp(LB + String.raw`text-slate-700(?!\s+dark:)`, 'g'), 'text-slate-700 dark:text-slate-200'],
    [new RegExp(LB + String.raw`text-slate-600(?!\s+dark:)`, 'g'), 'text-slate-600 dark:text-slate-300'],
    [new RegExp(LB + String.raw`text-slate-500(?!\s+dark:)`, 'g'), 'text-slate-500 dark:text-slate-400'],
    [new RegExp(LB + String.raw`text-slate-400(?!\s+dark:)`, 'g'), 'text-slate-400 dark:text-slate-500'],
    [new RegExp(LB + String.raw`bg-slate-50(?!\s+dark:)`, 'g'), 'bg-slate-50 dark:bg-slate-900/80'],
    [new RegExp(LB + String.raw`border-slate-100(?!\s+dark:)`, 'g'), 'border-slate-100 dark:border-slate-800'],
    [new RegExp(LB + String.raw`border-slate-200(?!\s+dark:)`, 'g'), 'border-slate-200 dark:border-slate-700'],
    [new RegExp(LB + String.raw`ring-slate-100(?!\s+dark:)`, 'g'), 'ring-slate-100 dark:ring-slate-800'],
    [new RegExp(LB + String.raw`ring-slate-200(?!\s+dark:)`, 'g'), 'ring-slate-200 dark:ring-slate-700'],
    [new RegExp(LB + String.raw`hover:bg-slate-50(?!\s+dark:)`, 'g'), 'hover:bg-slate-50 dark:hover:bg-slate-800/80'],
    [new RegExp(LB + String.raw`hover:bg-slate-100(?!\s+dark:)`, 'g'), 'hover:bg-slate-100 dark:hover:bg-slate-800'],
    [new RegExp(LB + String.raw`divide-slate-100(?!\s+dark:)`, 'g'), 'divide-slate-100 dark:divide-slate-800'],
    [new RegExp(LB + String.raw`divide-slate-200(?!\s+dark:)`, 'g'), 'divide-slate-200 dark:divide-slate-700'],
    [new RegExp(LB + String.raw`bg-white\/95(?!\s+dark:)`, 'g'), 'bg-white/95 dark:bg-slate-900/95'],
    [new RegExp(LB + String.raw`bg-white\/90(?!\s+dark:)`, 'g'), 'bg-white/90 dark:bg-slate-900/90'],
    [new RegExp(LB + String.raw`bg-white\/80(?!\s+dark:)`, 'g'), 'bg-white/80 dark:bg-slate-900/80'],
    [new RegExp(LB + String.raw`bg-white\/75(?!\s+dark:)`, 'g'), 'bg-white/75 dark:bg-slate-900/75'],
    [new RegExp(LB + String.raw`bg-white\/70(?!\s+dark:)`, 'g'), 'bg-white/70 dark:bg-slate-900/70'],
    [new RegExp(LB + String.raw`bg-white\/60(?!\s+dark:)`, 'g'), 'bg-white/60 dark:bg-slate-900/60'],
    [new RegExp(LB + String.raw`bg-white\/50(?!\s+dark:)`, 'g'), 'bg-white/50 dark:bg-slate-900/50'],
    [new RegExp(LB + String.raw`bg-white\/25(?!\s+dark:)`, 'g'), 'bg-white/25 dark:bg-white/10'],
    [new RegExp(LB + String.raw`bg-white\/20(?!\s+dark:)`, 'g'), 'bg-white/20 dark:bg-white/10'],
    [new RegExp(LB + String.raw`bg-white\/10(?!\s+dark:)`, 'g'), 'bg-white/10 dark:bg-white/5'],
    [new RegExp(LB + String.raw`bg-white\/5(?!\s+dark:)`, 'g'), 'bg-white/5 dark:bg-white/5'],
    [new RegExp(LB + String.raw`bg-white(?!\s+dark:)(?!\/)(?![a-z])`, 'g'), 'bg-white dark:bg-slate-900'],
  ];
  for (const [re, rep] of rules) {
    c = c.replace(re, rep);
  }
  c = c.replace(/ dark:text-slate-50 dark:text-slate-50/g, ' dark:text-slate-50');
  c = c.replace(/ dark:bg-slate-900 dark:bg-slate-900/g, ' dark:bg-slate-900');
  return c;
}

const files = walk('.');
let changed = 0;
for (const f of files) {
  const raw = fs.readFileSync(f, 'utf8');
  const next = transform(raw);
  if (next !== raw) {
    fs.writeFileSync(f, next, 'utf8');
    changed++;
  }
}
console.log(`Updated ${changed} files.`);
