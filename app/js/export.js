// Free, code-only transcript export (no AI): header + numbered passages that each start with [m:ss].
// The text is never rewritten; sentences are only grouped, so it stays a verbatim source.

export const PASSAGE_SEC = 90, PASSAGE_CHARS = 900;

export function clock(sec) {
  const s = Math.max(0, Math.floor(sec)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), r = s % 60;
  const two = n => String(n).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(r)}` : `${m}:${two(r)}`;
}

// sents: [{i, t, text}] (t may be null when the input had no times).
export function passages(sents) {
  const out = [];
  let cur = null;
  for (const s of sents) {
    const over = cur && (s.t != null && cur.t != null ? s.t - cur.t >= PASSAGE_SEC : cur.len >= PASSAGE_CHARS);
    if (!cur || over) { cur = { t: s.t, parts: [], len: 0 }; out.push(cur); }
    cur.parts.push(s.text); cur.len += s.text.length + 1;
  }
  return out.map(p => ({ t: p.t, text: p.parts.join(' ') }));
}

export function transcriptTxt(rec, sents, now = new Date()) {
  const timed = sents.length > 0 && sents.every(s => s.t != null);
  const estimated = (rec.segments || []).some(s => s.t == null);
  const head = [
    `Title: ${rec.title || 'unknown'}`,
    `Channel: ${rec.channel || 'unknown'}`,
    `Video: ${rec.url || (rec.video_id ? 'https://www.youtube.com/watch?v=' + rec.video_id : 'unknown')}`,
    `Exported: ${now.toISOString().slice(0, 10)}`,
    `Caption type: ${rec.captionType || 'unknown'}`,
    `Times: ${!timed ? 'none' : estimated ? 'estimated' : 'from captions'}`,
  ];
  const body = passages(sents).map((p, k) => `${k + 1}. ${p.t != null ? `[${clock(p.t)}] ` : ''}${p.text}`);
  return head.join('\n') + '\n\n' + body.join('\n\n') + '\n';
}

// File name from the video title: letters/digits/space/-_ only (Vietnamese letters kept), max 80 chars.
export function exportName(rec) {
  const base = String(rec.title || '').normalize('NFC').replace(/[^\p{L}\p{N} _-]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80).trim();
  return (base || (rec.video_id ? 'transcript-' + rec.video_id : 'transcript')) + '.txt';
}
