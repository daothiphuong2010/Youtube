// Glossary of misheard names -> correct names, e.g. "Đen Di, đen đi = Denji".
// One entry per line; "=", "->" or "→" separate wrong forms from the correct name.
import { fold } from './text.js';

export function parseGlossary(text) {
  return (text || '').split(/\r?\n/).map(line => {
    const m = line.split(/\s*(?:=|->|→)\s*/);
    if (m.length < 2) return null;
    const right = m.pop().trim();
    const wrong = m.join(',').split(',').map(w => w.trim()).filter(Boolean);
    return right && wrong.length ? { wrong, right } : null;
  }).filter(Boolean);
}

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Replace wrong forms with the correct name (whole words, case-insensitive).
export function applyGlossary(text, glossary) {
  for (const g of glossary) {
    for (const w of g.wrong) {
      text = text.replace(new RegExp(`(^|[^\\p{L}])${esc(w)}(?=$|[^\\p{L}])`, 'giu'), (_, pre) => pre + g.right);
    }
  }
  return text;
}

// Query -> groups of folded alternatives; a unit matches when every group matches.
export function queryGroups(q, glossary = []) {
  let rest = ' ' + fold(q) + ' ';
  const groups = [];
  for (const g of glossary) {
    const names = [g.right, ...g.wrong].map(fold).sort((a, b) => b.length - a.length);
    const hit = names.find(n => rest.includes(' ' + n + ' '));
    if (hit) { groups.push(names); rest = rest.replace(' ' + hit + ' ', ' '); }
  }
  for (const w of rest.split(/\s+/).filter(Boolean)) groups.push([w]);
  return groups;
}

// Whole phrase -> folded alternatives (for charting a keyword as one unit, not word by word):
// "Denji cưa máy" with "Đen Di = Denji" -> ["denji cua may", "den di cua may"].
export function phraseAlts(term, glossary = []) {
  const alts = new Set([fold(term).replace(/\s+/g, ' ').trim()]);
  for (const g of glossary) {
    const names = [g.right, ...g.wrong].map(fold);
    for (const a of [...alts]) for (const n of names) {
      if (!(' ' + a + ' ').includes(' ' + n + ' ')) continue;
      for (const m of names) alts.add((' ' + a + ' ').split(' ' + n + ' ').join(' ' + m + ' ').trim());
    }
  }
  return [...alts].filter(Boolean);
}
