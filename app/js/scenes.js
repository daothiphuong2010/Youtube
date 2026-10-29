// AI scene pass: ~1h windows with small overlap. AI returns only JSON scene markers
// (start sentence, title, keywords, 1-line summary). The transcript is never rewritten.

export const WINDOW_SEC = 3600, OVERLAP_SEC = 240;
export const WINDOW_CHARS = 45000, OVERLAP_CHARS = 3000; // ~1h of Vietnamese speech
export const CHARS_PER_TOKEN = 2.2; // rough for Vietnamese; shown as an estimate only
const OUT_TOKENS_PER_WINDOW = 1600, OVERVIEW_OUT = 900;

// Returns [{from, core, to}] sentence indexes: lines [from, to) are sent,
// scenes may only start at >= core (lines before core are context only).
// winMin = minutes of audio per AI call (fewer, bigger calls fit a small daily quota).
export function makeWindows(sents, winMin = 60) {
  const timed = sents.length && sents.every(s => s.t != null);
  const pos = [];
  let acc = 0;
  for (const s of sents) { pos.push(timed ? s.t : acc); acc += s.text.length + 1; }
  const k = Math.max(10, +winMin || 60) / 60;
  const size = timed ? WINDOW_SEC * k : WINDOW_CHARS * k, ov = timed ? OVERLAP_SEC : OVERLAP_CHARS;
  const wins = [];
  let core = 0;
  while (core < sents.length) {
    let to = core;
    while (to < sents.length && pos[to] < pos[core] + size) to++;
    if (to === core) to++;
    // Fold a tiny tail (< 1/4 window) into this window.
    if (to < sents.length && pos[sents.length - 1] - pos[to] < size / 4) to = sents.length;
    let from = core;
    while (from > 0 && pos[from - 1] > pos[core] - ov) from--;
    wins.push({ from, core, to });
    core = to;
  }
  return wins;
}

export function windowText(sents, w) {
  return sents.slice(w.from, w.to).map(s => `${s.i}|${s.text}`).join('\n');
}

export function sceneUser(sents, w, glossary = []) {
  const names = glossary.length
    ? `Tên đúng (phụ đề hay nghe nhầm): ${glossary.map(g => `${g.wrong.join('/')} = ${g.right}`).join('; ')}. Dùng tên đúng trong tiêu đề và từ khóa.\n` : '';
  return names + `Câu ${w.core} đến ${w.to - 1} là phần cần chia cảnh. Các câu trước ${w.core} (nếu có) chỉ là ngữ cảnh, KHÔNG tạo cảnh bắt đầu trước câu ${w.core}.\n\n${windowText(sents, w)}`;
}

export function overviewUser(rec, sections) {
  return `Video: ${rec.title || '(không rõ)'} — kênh ${rec.channel || '?'}\n` +
    sections.map((s, n) => `${n + 1}. ${s.title}: ${s.summary}`).join('\n');
}

const arr = v => (Array.isArray(v) ? v : []).map(x => String(x).trim()).filter(Boolean).slice(0, 8);

// AI's compact JSON -> generic sections {start, title, summary, keywords[{text, category}]},
// keeping only sections that start inside the window core.
export function normalizeSections(json, w, categories) {
  return (json?.sections || json?.scenes || [])
    .map(x => ({ start: Math.round(Number(x.s)), title: String(x.t || '').trim(), summary: String(x.m || '').trim(),
      keywords: Object.keys(categories).flatMap(c => arr(x.k?.[c]).map(text => ({ text, category: c }))).slice(0, 10) }))
    .filter(x => Number.isFinite(x.start) && x.start >= w.core && x.start < w.to && x.title);
}

// Merge per-window sections: sort, dedupe, first starts at 0, add end index.
export function mergeSections(parts, total) {
  const all = parts.flat().sort((a, b) => a.start - b.start)
    .filter((x, n, a) => n === 0 || x.start !== a[n - 1].start);
  if (all.length) all[0] = { ...all[0], start: 0 };
  return all.map((x, n) => ({ ...x, end: n + 1 < all.length ? all[n + 1].start - 1 : total - 1 }));
}

// s = settings {free, priceIn, priceOut, rpm, tpm, rpd, target, winMin}. Free tier -> $0.
// minutes = at the paced speed (+~20 s AI time per call); days > 1 when the daily quota is smaller.
export function estimate(sents, s) {
  const wins = makeWindows(sents, s.winMin);
  let chars = 0;
  for (const w of wins) chars += sceneUser(sents, w).length + 1500;
  const inTok = Math.round(chars / CHARS_PER_TOKEN) + 3000;
  const outTok = wins.length * OUT_TOKENS_PER_WINDOW + OVERVIEW_OUT;
  const usd = s.free ? 0 : (inTok * (+s.priceIn || 0) + outTok * (+s.priceOut || 0)) / 1e6;
  const requests = wins.length + 1;
  const pct = (+s.target || 80) > 1 ? (+s.target || 80) / 100 : +s.target;
  const perReq = Math.max(s.rpm ? 60 / Math.max(1, s.rpm * pct) : 0, s.tpm ? 60 * (inTok / requests) / (s.tpm * pct) : 0, 20);
  const days = +s.rpd ? Math.ceil(requests / +s.rpd) : 1;
  return { windows: wins.length, requests, minutes: Math.ceil(requests * perReq / 60), days, inTok, outTok, usd };
}

// Sections found so far, ending where the last finished window ends (for progressive display).
export function partialSections(sents, parts, winMin) {
  const wins = makeWindows(sents, winMin);
  let n = 0;
  while (n < wins.length && parts?.[n]) n++;
  return n ? mergeSections(parts.slice(0, n), wins[n - 1].to) : null;
}

// Run the whole pass. `saved` holds finished windows so an interrupted run resumes free.
// onWindow(n, part, usage) fires after each window (save it, show its sections right away).
export async function runSections({ sents, rec, mode, ask, glossary = [], saved = {}, winMin = 60, onProgress = () => {}, onWindow = () => {} }) {
  const wins = makeWindows(sents, winMin);
  const parts = [];
  const usage = { inTok: saved.inTok || 0, outTok: saved.outTok || 0 };
  for (let n = 0; n < wins.length; n++) {
    onProgress(n, wins.length);
    if (saved.parts?.[n]) { parts.push(saved.parts[n]); continue; }
    // A reply that is not valid JSON gets one more try for this window; finished windows stay saved.
    const askWindow = () => ask(mode.sectionSystem, sceneUser(sents, wins[n], glossary), 4000);
    const r = await askWindow().catch(e => { if (!/JSON/.test(e?.message || '')) throw e; return askWindow(); });
    usage.inTok += r.inTok; usage.outTok += r.outTok;
    parts.push(normalizeSections(r.json, wins[n], mode.categories));
    await onWindow(n, parts[n], usage);
  }
  onProgress(wins.length, wins.length);
  const sections = mergeSections(parts, sents.length);
  const r = await ask(mode.verdictSystem, overviewUser(rec, sections), 2000);
  usage.inTok += r.inTok; usage.outTok += r.outTok;
  const o = r.json || {};
  const overview = {
    score: Math.max(1, Math.min(10, Math.round(Number(o.score) || 0))),
    why: String(o.why || ''), plot: (Array.isArray(o.plot) ? o.plot : []).map(String).slice(0, 15),
  };
  return { sections, overview, usage };
}
