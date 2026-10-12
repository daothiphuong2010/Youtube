// Free layer (no AI, no key): ~5-minute blocks, TF-IDF keywords per block,
// "first appearance" of recurring terms, keyword density along the timeline.
import { fold } from './text.js';
import { applyGlossary } from './glossary.js';

export const BLOCK_SEC = 300;

const STOP = new Set(`và là của có không được cho với này đó thì mà những các một hai ba bốn năm đã đang sẽ rồi cũng như nhưng vì nên khi lại ra vào lên xuống đi đến tới từ trong ngoài trên dưới để bị bởi tại về theo nếu thế vậy gì nào ai đâu sao bao nhiêu rất quá lắm hơn nhất cả mọi mỗi chỉ vẫn còn đều cùng nữa ấy kia đây nó họ tôi ta mình anh em chị cô cậu ông bà hắn chúng người cái con việc điều sự làm nói thấy biết muốn phải thể nhìn lúc giờ ngay liền đột nhiên thật chính vừa mới hết xong ừ à ạ ơi nhé nha thôi đấy chứ hả hay hoặc rằng tuy dù luôn lần chút ít nhiều tất lấy đây đó vâng dạ được rồi thì là sau trước giữa bên cạnh vẫn đang hãy đừng chưa từng mất đúng sai lẽ cần nhau ngươi ngài nàng tên kẻ gã vị cũng the a an and of to is in it you that i`.split(/\s+/));

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

function grams(ws) {
  const out = new Map();
  for (let i = 0; i < ws.length; i++) {
    for (let n = 1; n <= 3 && i + n <= ws.length; n++) {
      const g = ws.slice(i, i + n);
      if (STOP.has(g[0]) || STOP.has(g[n - 1]) || g.some(w => /^\d+$/.test(w))) continue;
      if (n === 1 && g[0].length < 3) continue;
      const k = g.join(' ');
      out.set(k, (out.get(k) || 0) + 1);
    }
  }
  return out;
}

// Adds b.terms (top keywords) and b.firsts (recurring terms seen here first) to each block.
export function analyze(sents, blocks, glossary = [], perBlock = 6) {
  const tfs = blocks.map(b => grams(words(applyGlossary(sents.slice(b.start, b.end + 1).map(s => s.text).join(' '), glossary))));
  const df = new Map();
  for (const tf of tfs) for (const k of tf.keys()) df.set(k, (df.get(k) || 0) + 1);
  const N = blocks.length, global = new Map();
  const out = blocks.map((b, i) => {
    const scored = [];
    for (const [k, tf] of tfs[i]) {
      if (tf < 2) continue;
      const n = k.split(' ').length;
      const sc = tf * Math.log((N + 1) / df.get(k)) * (1 + 0.6 * (n - 1));
      if (sc > 0) scored.push([k, sc, tf]);
    }
    scored.sort((a, z) => z[1] - a[1]);
    const terms = [];
    for (const [k, sc, tf] of scored) {
      // Skip a term that is just part of (or contains) one already picked with similar count.
      if (terms.some(t => (t.k.includes(k) || k.includes(t.k)) && Math.abs(t.tf - tf) <= tf / 2)) continue;
      terms.push({ k, tf });
      global.set(k, (global.get(k) || 0) + sc);
      if (terms.length >= perBlock) break;
    }
    return { ...b, terms: terms.map(t => t.k) };
  });
  // Recurring terms (in >= 3 blocks, or anywhere if short) and where they first show up.
  const minDf = N >= 6 ? 3 : 1;
  const top = [...global].filter(([k]) => df.get(k) >= minDf).sort((a, z) => z[1] - a[1]).slice(0, 60).map(([k]) => k);
  const firsts = new Map();
  for (const k of top) {
    const i = tfs.findIndex(tf => tf.has(k));
    if (i >= 0) (firsts.get(i) || firsts.set(i, []).get(i)).push(k);
  }
  return { blocks: out.map((b, i) => ({ ...b, firsts: firsts.get(i) || [] })), top };
}

// Occurrences of a phrase (accent-insensitive, glossary-aware) in each unit.
export function density(sents, units, alts) {
  const fs = alts.map(fold).filter(a => a.length > 1);
  return units.map(u => {
    const body = fold(sents.slice(u.start, u.end + 1).map(s => s.text).join(' '));
    let n = 0;
    for (const a of fs) for (let p = body.indexOf(a); p >= 0; p = body.indexOf(a, p + a.length)) n++;
    return n;
  });
}
