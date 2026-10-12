// Free layer (no AI, no key): ~5-minute blocks, TF-IDF keywords per block,
// "first appearance" of recurring terms, keyword density along the timeline.
import { fold } from './text.js';
import { applyGlossary } from './glossary.js';

export const BLOCK_SEC = 300;

// Edge stopwords: a keyword may contain these inside ("ma vương của biển") but never start/end with them.
const STOP = new Set(`và là của có không được cho với này đó thì mà những các một hai ba bốn năm sáu bảy tám chín mười trăm nghìn ngàn triệu đã đang sẽ rồi cũng như nhưng vì nên khi lại ra vào lên xuống đi đến tới từ trong ngoài trên dưới để bị bởi tại về theo nếu thế vậy gì nào ai đâu sao bao nhiêu rất quá lắm hơn nhất cả mọi mỗi chỉ vẫn còn đều cùng nữa ấy kia đây nó họ tôi ta mình anh em chị cô cậu ông bà hắn chúng người cái con việc điều sự làm nói thấy biết muốn phải thể nhìn lúc giờ ngay liền đột nhiên thật chính vừa mới hết xong ừ à ạ ơi nhé nha thôi đấy chứ hả hay hoặc rằng tuy dù luôn lần chút ít nhiều tất lấy vâng dạ sau trước giữa bên cạnh hãy đừng chưa từng mất đúng sai lẽ cần nhau ngươi ngài nàng tên kẻ gã vị bạn mày tao chúng_ta có_thể đó_là thế_nào nhưng_mà tức thấy_rằng khiến cho giống trông vẻ hơi khá cực vô cùng hoàn toàn thực sự quả nhiên chắc có_lẽ dường đều đã_từng liệu nữa_là phía lúc_này khi_đó cứ mặc kể cả_hai chẳng không_hề đâu_có thì_ra hóa ra rõ ràng the a an and of to is in it you that i`.split(/[\s_]+/));

const words = text => text.toLowerCase().normalize('NFC').split(/[^\p{L}\p{N}]+/u).filter(Boolean);

// Fill missing times. All missing + known duration -> estimate by character position.
export function fillTimes(sents, duration) {
  const total = sents.reduce((a, s) => a + s.text.length + 1, 0) || 1;
  let acc = 0, last = 0;
  return sents.map(s => {
    let t = s.t;
    if (t == null) t = duration ? Math.round(acc / total * duration) : null;
    if (t != null) last = t; else if (last) t = last;
    acc += s.text.length + 1;
    return { ...s, t };
  });
}

// ~5-min blocks by time; without times, blocks of ~4500 characters.
export function makeBlocks(sents, sec = BLOCK_SEC) {
  const timed = sents.length && sents.every(s => s.t != null);
  const blocks = [];
  let start = 0, acc = 0;
  sents.forEach((s, i) => {
    const over = timed ? s.t - sents[start].t >= sec : acc >= sec * 15;
    if (i > start && over) { blocks.push({ start, end: i - 1 }); start = i; acc = 0; }
    acc += s.text.length;
  });
  if (sents.length) blocks.push({ start, end: sents.length - 1 });
  return blocks;
}

const MAX_N = 4;

// Count every 1..(MAX_N+1)-gram of each block (n-grams never cross blocks).
function countAll(blockWords) {
  const c = new Map();
  for (const ws of blockWords) {
    for (let i = 0; i < ws.length; i++) {
      let k = '';
      for (let n = 1; n <= MAX_N + 1 && i + n <= ws.length; n++) {
        k = n === 1 ? ws[i] : k + ' ' + ws[i + n - 1];
        c.set(k, (c.get(k) || 0) + 1);
      }
    }
  }
  return c;
}

// A phrase is a real unit when it is not mostly a piece of one longer phrase:
// e.g. "tranh ác ma" is nearly always "chiến tranh ác ma" -> rejected; "ác" alone is nearly
// always "ác ma" -> "rơi xuống ác" rejected. Also rejects stopword/number edges.
function makeValid(counts) {
  const left = new Map(), right = new Map(), next = new Map(), prev = new Map();
  for (const [k, c] of counts) {
    const p = k.split(' ');
    if (p.length < 2) continue;
    const head = p.slice(0, -1).join(' '), tail = p.slice(1).join(' ');
    right.set(head, Math.max(right.get(head) || 0, c));
    left.set(tail, Math.max(left.get(tail) || 0, c));
    if (p.length === 2) {
      if ((next.get(p[0])?.c || 0) < c) next.set(p[0], { w: p[1], c });
      if ((prev.get(p[1])?.c || 0) < c) prev.set(p[1], { w: p[0], c });
    }
  }
  // Every split of the phrase must co-occur often: "ác ma xa" (ác ma + a random next word) fails,
  // "chiến tranh ác ma" passes.
  const cohesive = (p, c) => {
    for (let i = 1; i < p.length; i++) {
      const l = counts.get(p.slice(0, i).join(' ')) || c, r = counts.get(p.slice(i).join(' ')) || c;
      if (c / Math.min(l, r) < 0.25) return false;
    }
    return true;
  };
  const cache = new Map();
  return k => {
    if (cache.has(k)) return cache.get(k);
    const p = k.split(' '), c = counts.get(k) || 0, a = p[0], z = p[p.length - 1];
    const bound = (m, w) => { const e = m.get(w), n = counts.get(w) || 0; return e && n >= 5 && e.c / n >= 0.7 ? e : null; };
    const nz = bound(next, z), pa = bound(prev, a);
    const ok = p.length <= MAX_N && c >= 3 && !STOP.has(a) && !STOP.has(z) && !p.some(w => /^\d+$/.test(w)) &&
      !(p.length === 1 && a.length < 3) &&
      (left.get(k) || 0) / c < 0.5 && (right.get(k) || 0) / c < 0.5 &&
      !nz && !pa && // last syllable is glued to a following one / first to a preceding one
      cohesive(p, c);
    cache.set(k, ok);
    return ok;
  };
}

// Do two phrases overlap (one inside the other, or end of one = start of the other)?
function overlaps(a, b) {
  if (a.includes(b) || b.includes(a)) return true;
  const x = a.split(' '), y = b.split(' ');
  for (let n = 1; n < Math.min(x.length, y.length); n++) {
    if (x.slice(-n).join(' ') === y.slice(0, n).join(' ') || y.slice(-n).join(' ') === x.slice(0, n).join(' ')) return true;
  }
  return false;
}
export { overlaps };

// Adds b.terms (top keywords) and b.firsts (recurring terms seen here first) to each block.
// top = recurring terms by importance; bursty = terms ranked by how clustered they are in time.
// isName(term) = true for character names: those go to the 👤 row, never into keywords.
export function analyze(sents, blocks, glossary = [], perBlock = 5, isName = () => false) {
  const blockWords = blocks.map(b => words(applyGlossary(sents.slice(b.start, b.end + 1).map(s => s.text).join(' '), glossary)));
  const valid = makeValid(countAll(blockWords));
  const tfs = blockWords.map(ws => {
    const tf = new Map();
    for (let i = 0; i < ws.length; i++) {
      let k = '';
      for (let n = 1; n <= MAX_N && i + n <= ws.length; n++) {
        k = n === 1 ? ws[i] : k + ' ' + ws[i + n - 1];
        if (valid(k)) tf.set(k, (tf.get(k) || 0) + 1);
      }
    }
    return tf;
  });
  const df = new Map();
  for (const tf of tfs) for (const k of tf.keys()) df.set(k, (df.get(k) || 0) + 1);
  const N = blocks.length, global = new Map();
  const out = blocks.map((b, i) => {
    const scored = [];
    for (const [k, tf] of tfs[i]) {
      if (tf < 2 || isName(k)) continue;
      const n = k.split(' ').length;
      const sc = tf * Math.log((N + 1) / df.get(k)) * (1 + 0.6 * (n - 1));
      if (sc > 0) scored.push([k, sc]);
    }
    scored.sort((a, z) => z[1] - a[1]);
    const terms = [];
    for (const [k, sc] of scored) {
      if (terms.some(t => overlaps(t, k))) continue; // best (usually longest) phrase wins
      terms.push(k);
      global.set(k, (global.get(k) || 0) + sc);
      if (terms.length >= perBlock) break;
    }
    return { ...b, terms };
  });
  const minDf = N >= 6 ? 3 : 1;
  const top = [];
  for (const [k] of [...global].filter(([k]) => df.get(k) >= minDf).sort((a, z) => z[1] - a[1])) {
    if (!top.some(t => overlaps(t, k))) top.push(k);
    if (top.length >= 60) break;
  }
  // Burstiness = coefficient of variation of the per-block counts (a name that comes and goes
  // scores high; a phrase spread evenly over the whole video scores low).
  const bursty = top.map(k => {
    const xs = tfs.map(tf => tf.get(k) || 0), total = xs.reduce((a, x) => a + x, 0), mean = total / N;
    const sd = Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / N);
    return { k, cv: mean ? sd / mean : 0, total };
  }).filter(x => x.total >= Math.min(10, 2 * N)).sort((a, z) => z.cv - a.cv).map(x => x.k);
  const firsts = new Map();
  for (const k of top) {
    const i = tfs.findIndex(tf => tf.has(k));
    if (i >= 0) (firsts.get(i) || firsts.set(i, []).get(i)).push(k);
  }
  return { blocks: out.map((b, i) => ({ ...b, firsts: firsts.get(i) || [] })), top, bursty };
}

// Occurrences of a phrase (accent-insensitive, glossary-aware) in each unit.
export function density(sents, units, alts) {
  const norm = t => ' ' + fold(t).replace(/[^\p{L}\p{N}]+/gu, ' ').trim() + ' ';
  const fs = [...new Set(alts.map(norm))].filter(a => a.length > 3); // whole words only
  return units.map(u => {
    const body = norm(sents.slice(u.start, u.end + 1).map(s => s.text).join(' '));
    let n = 0;
    for (const a of fs) for (let p = body.indexOf(a); p >= 0; p = body.indexOf(a, p + a.length - 1)) n++;
    return n;
  });
}
