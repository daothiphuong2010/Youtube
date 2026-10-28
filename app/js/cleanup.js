// Free, local cleanup (no AI): parse input, strip timestamps, drop intro/outro ads,
// split into numbered sentences. Pure functions, no DOM, so Node tests can run them.

const CLOCK = /\b\d{1,2}:\d{2}(?::\d{2})?\b/g;
const CLOCK_LINE = /^\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*(.*)$/;
// Spoken timestamps (screen-reader labels / copied panels): "27 phút, 36 giây",
// "1 giờ, 2 phút, 3 giây", "1 hour, 2 minutes, 3 seconds", "5 seconds".
const SPOKEN = /(?:\b\d+\s*(?:giờ|tiếng|hours?)\s*,?\s*)?(?:\b\d+\s*(?:phút|minutes?)\s*,?\s*)?\b\d+\s*(?:giây|seconds?)\b/gi;
const SPOKEN_HM = /\b\d+\s*(?:giờ|hours?)\s*,\s*\d+\s*(?:phút|minutes?)\b/gi;
const NOISE = /\[(?:âm nhạc|nhạc|music|vỗ tay|applause|tiếng cười|laughter|\s*)\]/gi;
const AD = /(đăng\s*k[ýí]|subscribe|bấm chuông|nhấn chuông|chuông thông báo|like và share|ấn like|nhấn like|thả like|chia sẻ video|theo dõi kênh|ủng hộ kênh|ủng hộ mình|link (?:ở )?(?:dưới|trong) (?:phần )?mô tả|description|tài trợ|donate|momo|sponsor|hẹn gặp lại|xin chào (?:các bạn|mọi người|cả nhà)|chào mừng (?:các bạn|mọi người) (?:đã )?(?:quay )?(?:trở )?lại|kênh của mình)/i;

// Auto captions rarely have punctuation: end a sentence at a caption-line end once it
// has MIN_WORDS, or mid-line only past MAX_WORDS (long pasted paragraphs).
export const MIN_WORDS = 20, MAX_WORDS = 60;

export function parseClock(s) {
  const p = s.trim().split(':').map(Number);
  if (p.some(Number.isNaN)) return null;
  return p.reduce((a, b) => a * 60 + b, 0);
}

export function parseSpoken(s) {
  const m = s.match(/^\s*(?:(\d+)\s*(?:giờ|tiếng|hours?)\s*,?\s*)?(?:(\d+)\s*(?:phút|minutes?)\s*,?\s*)?(?:(\d+)\s*(?:giây|seconds?))?\s*$/i);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
}

export function stripTimestamps(text) {
  return text.replace(SPOKEN, ' ').replace(SPOKEN_HM, ' ').replace(CLOCK, ' ')
    .replace(NOISE, ' ').replace(/\s+/g, ' ').trim();
}

// Plain text (drag-drop .txt or pasted panel) -> [{t, text}].
// Lines that are only a timestamp set the time for the next lines.
export function parseText(txt) {
  if(/^WEBVTT(?:\s|$)/.test(txt.trimStart()))return parseVTT(txt);
  const out = [];
  let t = null;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const c = line.match(CLOCK_LINE);
    if (c && (c[2] === '' || /^[^\d]/.test(c[2]))) {
      t = parseClock(c[1]);
      if (c[2]) out.push({ t, text: c[2] });
      continue;
    }
    const sp = parseSpoken(line);
    if (sp !== null) { t = sp; continue; }
    out.push({ t, text: line });
  }
  return out;
}

// CORE: WebVTT input. Only timestamped auto-caption files use rolling-line deduplication.
const VTT_WORD_TIME=/<\d{1,3}:\d{2}(?::\d{2})?\.\d{3}>/;
const VTT_ENTITIES={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
export function parseVTT(txt) {
  const out=[],rolling=VTT_WORD_TIME.test(txt);
  let previous=[],previousEnd=-1;
  for(const block of txt.trimStart().split(/\r?\n(?:\r?\n)+/)) {
    if(/^(NOTE|STYLE|REGION)\b/.test(block.trimStart()))continue;
    const lines=block.split(/\r?\n/),at=lines.findIndex(l=>l.includes('-->'));
    if(at<0)continue;
    const m=lines[at].match(/^([\d:.]+)\s+-->\s+([\d:.]+)/);
    if(!m)continue;
    const t=parseClock(m[1]),end=parseClock(m[2]);
    if(t==null || end==null || end<t)continue;
    const texts=[];
    for(const line of lines.slice(at+1)) {
      const text=line.replace(/<(?:\/?[a-zA-Z][^>]*|\d{1,3}:\d{2}(?::\d{2})?\.\d{3})>/g,'')
        .replace(/&(amp|lt|gt|quot|apos|nbsp);/g,(_,key)=>VTT_ENTITIES[key]).trim();
      if(!text)continue;
      texts.push(text);
      if(rolling && !VTT_WORD_TIME.test(line) && previous.includes(text) && t<=previousEnd+0.05)continue;
      out.push({t,text});
    }
    previous=texts;previousEnd=end;
  }
  return out;
}

// Segments -> numbered sentences [{i, t, text}].
export function toSentences(segments) {
  const out = [];
  let words = [];
  let t0 = null;
  const flush = () => {
    if (words.length) out.push({ i: out.length, t: t0, text: words.join(' ') });
    words = []; t0 = null;
  };
  for (const seg of segments) {
    const clean = stripTimestamps(seg.text || '');
    if (!clean) continue;
    for (const w of clean.split(' ')) {
      if (!words.length) t0 = seg.t ?? null;
      words.push(w);
      if (/[.!?…]["”')]*$/.test(w) || words.length >= MAX_WORDS) flush();
    }
    if (words.length >= MIN_WORDS) flush();
  }
  flush();
  return out;
}

// Drop ad-like caption lines only near the start and end (story body is never touched).
// Runs on caption lines (short) before they are merged, so story text isn't lost with an ad.
export function dropAds(items) {
  const edge = Math.min(60, Math.ceil(items.length * 0.05));
  return items.filter((s, k) => !((k < edge || k >= items.length - edge) && AD.test(s.text)));
}

export function clean(segments) {
  return toSentences(dropAds(segments));
}
