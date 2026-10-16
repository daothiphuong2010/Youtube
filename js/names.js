// Characters (people/names), free and local: detect capitalized names, merge with the user's
// character list (Settings), count mentions per unit. The cast is the spine of the page:
// blocks show "👤 Nhân vật" from it, keywords never repeat a name, search and the chart use
// its aliases.
import { applyGlossary } from './glossary.js';

// Capitalized words that are not names: pronouns, kinship/honorific words, discourse words,
// chapter/time words, a few brands. Stripped from the edges of a capitalized run.
const NOT_NAME = new Set(`tôi tao tớ mình ta chúng họ nó hắn y ả anh em chị cô chú bác ông bà cậu mợ dì dượng thím cháu con
bố mẹ cha má ba u thầy trò ngươi ngài nàng chàng gã lão mày bạn cả các những mấy vị quý ngài
vâng dạ ừ ồ ô à a ơ ờ hả ủa này kìa nè đó đây thôi được không có và nhưng thì là mà rồi vậy thế sau trước khi lúc nếu vì tuy dù
còn cũng đã đang sẽ chỉ chắc hình như đúng sai cái chiếc một hai ba bốn năm sáu bảy tám chín mười trăm nghìn ngàn
chương phần tập hồi quyển thứ tháng ngày giờ tuần buổi sáng trưa chiều tối đêm hôm nay mai qua
chúa trời phật thánh thần đức hoàng thượng bệ hạ điện hạ tiểu thư công tử sư phụ huynh tỷ muội đệ đại ca
youtube facebook tiktok google ok okay i the a an mr mrs ms sir lord lady oh hey hi`.split(/\s+/).filter(Boolean));

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
const isCap = w => /^\p{Lu}/u.test(w);
const lc = s => String(s).normalize('NFC').toLowerCase();

// Character list text, one per line (same direction as the glossary):
//   "Đen Di, đen đi = Denji | nhân vật chính"   aliases = name | role
//   "Makima"                                     just a name
//   "- Thứ Hai"                                  not a name: hide it
export function parseCharacters(text) {
  const list = [], hide = new Set(), hidden = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[-−–]/.test(line)) { const n = line.replace(/^[-−–]\s*/, '').trim(); if (n) { hide.add(lc(n)); hidden.push(n); } continue; }
    const [main, ...rest] = line.split('|');
    const role = rest.join('|').trim();
    const parts = main.split(/\s*(?:=|->|→)\s*/).map(x => x.trim()).filter(Boolean);
    if (!parts.length) continue;
    const name = parts.pop();
    const aliases = parts.join(',').split(',').map(x => x.trim()).filter(Boolean);
    list.push({ name, aliases, role });
  }
  return { list, hide, hidden };
}

export function formatCharacters({ list, hidden = [] }) {
  return [...list.map(c => (c.aliases.length ? c.aliases.join(', ') + ' = ' : '') + c.name + (c.role ? ' | ' + c.role : '')),
    ...hidden.map(n => '- ' + n)].join('\n');
}

// Character aliases as glossary entries (alias -> name), so text, search and chart merge them.
export const castGlossary = list => list.filter(c => c.aliases.length).map(c => ({ wrong: c.aliases, right: c.name }));

// Free name detection. A candidate is a run of 1-3 capitalized words that is not at a sentence
// start (a run of 2+ at the start counts), written capitalized most of the time it appears,
// seen >= minCount times in >= 2 different blocks.
export function detectNames(sents, blocks, glossary = [], { minCount = 3 } = {}) {
  const cap = new Map(), where = new Map(), shown = new Map();
  const blockOf = new Int32Array(sents.length);
  blocks.forEach((b, n) => { for (let i = b.start; i <= b.end; i++) blockOf[i] = n; });
  const caseText = [];
  sents.forEach((s, i) => {
    const text = applyGlossary(s.text, glossary).normalize('NFC');
    caseText.push(' ' + text.replace(/[^\p{L}\p{N}]+/gu, ' ') + ' ');
    const toks = [...text.matchAll(WORD)].map(m => ({ w: m[0], start: m.index === 0 || /[.!?…:;"“”«»(\[]\s*$/.test(text.slice(Math.max(0, m.index - 3), m.index)) }));
    for (let k = 0; k < toks.length;) {
      if (!isCap(toks[k].w)) { k++; continue; }
      let e = k;
      while (e + 1 < toks.length && isCap(toks[e + 1].w) && !toks[e + 1].start) e++;
      let a = k, z = e;
      k = e + 1;
      while (a <= z && NOT_NAME.has(lc(toks[a].w))) a++;
      while (z >= a && NOT_NAME.has(lc(toks[z].w))) z--;
      if (a > z || z - a >= 3) continue;
      if (toks[a].start && a === z) continue; // one capitalized word at a sentence start says nothing
      const run = toks.slice(a, z + 1);
      const name = run.map(t => t.w).join(' ');
      const key = lc(name);
      cap.set(key, (cap.get(key) || 0) + 1);
      (where.get(key) || where.set(key, new Set()).get(key)).add(blockOf[i]);
      const v = shown.get(key) || shown.set(key, new Map()).get(key);
      v.set(name, (v.get(name) || 0) + 1);
    }
  });
  const orig = caseText.join(''), all = lc(orig);
  const out = [];
  for (const [key, n] of cap) {
    if (n < minCount || where.get(key).size < 2 || /^\d/.test(key)) continue;
    // Written capitalized (anywhere, also inside a longer name) most of the time? Else an ordinary word.
    let total = 0, upper = 0;
    for (let p = all.indexOf(' ' + key + ' '); p >= 0; p = all.indexOf(' ' + key + ' ', p + 1)) { total++; if (isCap(orig.slice(p + 1, p + 3))) upper++; }
    if (total && upper / total < 0.6) continue;
    const name = [...shown.get(key)].sort((a, b) => b[1] - a[1])[0][0];
    out.push({ name, count: n });
  }
  // "Uchiha Sasuke" vs "Sasuke": keep the more frequent one, the other becomes its alias.
  out.sort((a, b) => b.count - a.count || a.name.length - b.name.length);
  const kept = [];
  for (const c of out) {
    const k = ' ' + lc(c.name) + ' ';
    const host = kept.find(x => (' ' + lc(x.name) + ' ').includes(k) || k.includes(' ' + lc(x.name) + ' '));
    if (host) host.aliases.push(c.name); else kept.push({ ...c, aliases: [] });
  }
  return kept;
}

// Mentions of each alternative (case-insensitive, accent-exact, whole words) in each unit.
const bodyCache = new WeakMap();
const norm = t => ' ' + lc(t).replace(/[^\p{L}\p{N}]+/gu, ' ').trim() + ' ';
export function mentions(sents, units, alts) {
  if (!bodyCache.has(units)) bodyCache.set(units, units.map(u => norm(sents.slice(u.start, u.end + 1).map(s => s.text).join(' '))));
  const bodies = bodyCache.get(units);
  // Longest first, and blank out what matched: "Uchiha Sasuke" is one mention, not two.
  const keys = [...new Set(alts.map(norm))].filter(a => a.length > 3).sort((a, b) => b.length - a.length);
  return bodies.map(body => {
    let n = 0;
    for (const a of keys) {
      if (!body.includes(a)) continue;
      let out = '', last = 0;
      for (let p = body.indexOf(a); p >= 0; p = body.indexOf(a, p + a.length - 1)) {
        n++; out += body.slice(last, p + 1) + '\u0000'.repeat(a.length - 2); last = p + a.length - 1;
      }
      body = out + body.slice(last);
    }
    return n;
  });
}

// The cast of one video: user list (always counted) + detected names, minus hidden ones.
// Returns [{name, aliases, role, auto, perUnit:[n], total}] with total > 0, most mentioned first.
export function buildCast(sents, units, detected, { list = [], hide = new Set() } = {}, glossary = []) {
  const cast = list.map(c => ({ ...c, aliases: [...c.aliases], auto: false }));
  const known = new Map();
  for (const c of cast) for (const n of [c.name, ...c.aliases]) known.set(lc(n), c);
  for (const d of detected) {
    if (hide.has(lc(d.name)) || [...d.aliases].some(a => hide.has(lc(a)))) continue;
    const c = known.get(lc(d.name)) || d.aliases.map(a => known.get(lc(a))).find(Boolean);
    if (c) { for (const a of [d.name, ...d.aliases]) if (!known.has(lc(a))) { c.aliases.push(a); known.set(lc(a), c); } continue; }
    const nc = { name: d.name, aliases: [...d.aliases], role: '', auto: true };
    cast.push(nc);
    for (const n of [nc.name, ...nc.aliases]) known.set(lc(n), nc);
  }
  // Misheard spellings from the glossary ("Đen Di = Denji") count as mentions too.
  for (const g of glossary) { const c = known.get(lc(g.right)); if (c) for (const w of g.wrong) if (!known.has(lc(w))) { c.aliases.push(w); known.set(lc(w), c); } }
  return cast.filter(c => !hide.has(lc(c.name)))
    .map(c => { const perUnit = mentions(sents, units, [c.name, ...c.aliases]); return { ...c, perUnit, total: perUnit.reduce((a, x) => a + x, 0) }; })
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total);
}

// Is a keyword really a name (or contains one)? Then it belongs in the 👤 row, not 🔑.
export function nameMatcher(cast) {
  const names = [], words = new Set();
  for (const c of cast) for (const n of [c.name, ...c.aliases]) {
    const k = lc(n).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (!k) continue;
    names.push(' ' + k + ' ');
    for (const w of k.split(' ')) words.add(w);
  }
  return term => {
    const t = ' ' + lc(term).replace(/[^\p{L}\p{N}]+/gu, ' ').trim() + ' ';
    return names.some(n => t.includes(n)) || t.trim().split(' ').every(w => words.has(w));
  };
}

// Everything the page needs about characters for one video.
// charactersText = the Settings list; glossary = the misheard-words list.
// Returns {cast, glossary (glossary + character aliases), isName, detected}.
export function castFor(sents, blocks, charactersText, glossary = []) {
  const chars = parseCharacters(charactersText);
  const gl = [...glossary, ...castGlossary(chars.list)];
  const detected = detectNames(sents, blocks, gl);
  const cast = buildCast(sents, blocks, detected, chars, gl);
  return { cast, glossary: gl, isName: nameMatcher(cast), detected, chars };
}

// Merge AI's [{name, aliases, role}] (or detected names) into the Settings list text.
export function mergeCharacters(charactersText, found) {
  const chars = parseCharacters(charactersText);
  const known = new Map();
  for (const c of chars.list) for (const n of [c.name, ...c.aliases]) known.set(lc(n), c);
  for (const f of found) {
    const name = String(f.name || '').trim();
    if (!name) continue;
    const aliases = (Array.isArray(f.aliases) ? f.aliases : []).map(a => String(a).trim()).filter(Boolean);
    let c = [name, ...aliases].map(n => known.get(lc(n))).find(Boolean);
    if (!c) { c = { name, aliases: [], role: '' }; chars.list.push(c); known.set(lc(name), c); }
    for (const a of [name, ...aliases]) {
      if (!known.has(lc(a))) { c.aliases.push(a); known.set(lc(a), c); }
      if (chars.hide.delete(lc(a))) chars.hidden = chars.hidden.filter(h => lc(h) !== lc(a)); // it is a spelling of a character after all
    }
    if (!c.role && f.role) c.role = String(f.role).trim().slice(0, 80);
  }
  return formatCharacters(chars);
}

// A few evenly spaced excerpts (for the one-call AI character list): k pieces of ~chars each.
export function sampleText(sents, k = 6, chars = 2500) {
  const out = [];
  for (let j = 0; j < k; j++) {
    let i = Math.floor((sents.length * (j + 0.5)) / k), piece = '';
    while (i < sents.length && piece.length < chars) piece += sents[i++].text + ' ';
    if (piece.trim()) out.push(`--- Đoạn trích ${j + 1}/${k} ---\n${piece.trim()}`);
  }
  return out.join('\n\n');
}

export function castUser(sents, detected) {
  return (detected.length ? `Tên ứng viên do máy tự dò (có thể sai hoặc thiếu): ${detected.slice(0, 40).map(d => [d.name, ...d.aliases].join('/')).join(', ')}\n\n` : '') +
    sampleText(sents);
}
