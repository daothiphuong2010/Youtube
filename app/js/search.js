// Local, free search over scenes or 5-min blocks: keywords + full text,
// accent-insensitive ("kiem" finds "kiếm"), glossary-aware ("denji" finds "Đen Di").
import { fold } from './text.js';
import { queryGroups } from './glossary.js';
export { fold };

// {category: [{name, units:[n...]}]} sorted by number of sections.
export function buildIndex(sections, categories) {
  const idx = {};
  for (const cat of Object.keys(categories)) {
    const m = new Map();
    sections.forEach((sc, n) => {
      for (const kw of sc.keywords || []) {
        if (kw.category !== cat) continue;
        const key = fold(kw.text);
        if (!m.has(key)) m.set(key, { name: kw.text, units: [] });
        const e = m.get(key);
        if (e.units[e.units.length - 1] !== n) e.units.push(n);
      }
    });
    idx[cat] = [...m.values()].sort((a, b) => b.units.length - a.units.length || a.name.localeCompare(b.name, 'vi'));
  }
  return idx;
}

export function sceneText(sents, sc) {
  return sents.slice(sc.start, sc.end + 1).map(s => s.text).join(' ');
}

const unitMeta = u => [u.title, u.summary, ...(u.keywords || []).map(k => k.text), ...(u.terms || [])].filter(Boolean).join(' ');

// Fold each unit once (20h of text) and remember where each sentence starts.
const prepared = new WeakMap();
function prep(units, sents) {
  if (!prepared.has(units)) {
    prepared.set(units, units.map(u => {
      const starts = [];
      let pos = 0;
      for (let i = u.start; i <= u.end; i++) { starts.push(pos); pos += sents[i].text.normalize('NFC').length + 1; }
      const raw = sceneText(sents, u).normalize('NFC');
      return { raw, body: fold(raw), meta: fold(unitMeta(u)), starts };
    }));
  }
  return prepared.get(units);
}

const has = (txt, alts) => alts.some(a => txt.includes(a));

// Returns [{n, kw, hits, snippet, sent}] for units matching every query group.
// `sent` = index of the sentence holding the first text hit (for "open video here").
export function search(q, units, sents, glossary = []) {
  const groups = queryGroups(q, glossary);
  if (!groups.length) return [];
  const pre = prep(units, sents);
  const out = [];
  units.forEach((u, n) => {
    const { raw, body, meta, starts } = pre[n];
    if (!groups.every(g => has(meta, g) || has(body, g))) return;
    const kw = groups.every(g => has(meta, g));
    let hits = 0, first = -1;
    for (const a of groups.flat()) {
      for (let p = body.indexOf(a); p >= 0; p = body.indexOf(a, p + a.length)) {
        hits++;
        if (first < 0 || p < first) first = p;
      }
    }
    let k = 0;
    while (first >= 0 && k + 1 < starts.length && starts[k + 1] <= first) k++;
    const snippet = first >= 0
      ? (first > 60 ? '…' : '') + raw.slice(Math.max(0, first - 60), first + 140) + '…' : '';
    out.push({ n, kw, hits, snippet, sent: first >= 0 ? u.start + k : u.start });
  });
  return out.sort((a, b) => (b.kw - a.kw) || (b.hits - a.hits) || (a.n - b.n));
}

// Split text into [{text, hit}] parts for safe highlighting (no innerHTML).
export function highlight(text, q, glossary = []) {
  const alts = queryGroups(q, glossary).flat().filter(w => w.length > 1);
  const t = String(text).normalize('NFC'), f = fold(t);
  const mark = new Array(t.length).fill(false);
  for (const w of alts) {
    for (let p = f.indexOf(w); p >= 0; p = f.indexOf(w, p + w.length)) mark.fill(true, p, p + w.length);
  }
  const parts = [];
  for (let i = 0; i < t.length; i++) {
    const last = parts[parts.length - 1];
    if (last && last.hit === mark[i]) last.text += t[i];
    else parts.push({ text: t[i], hit: mark[i] });
  }
  return parts;
}
