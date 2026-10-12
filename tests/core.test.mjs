import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripTimestamps, parseText, toSentences, dropAds, clean, parseSpoken } from '../app/js/cleanup.js';
import { makeWindows, normalizeSections, mergeSections, estimate, runSections } from '../app/js/scenes.js';
import { MODES } from '../app/js/modes.js';
import { fold, buildIndex, search, highlight } from '../app/js/search.js';
import { parseJSON } from '../app/js/ai.js';

test('strips clock and spoken timestamps', () => {
  assert.equal(stripTimestamps('27 phút, 36 giây Lúc đó Denji'), 'Lúc đó Denji');
  assert.equal(stripTimestamps('1 giờ, 2 phút, 3 giây hắn cười 12:05 [Âm nhạc]'), 'hắn cười');
  assert.equal(stripTimestamps('5 seconds ok 1:02:03'), 'ok');
  assert.equal(stripTimestamps('đợi 3 phút nữa'), 'đợi 3 phút nữa'); // story text kept
  assert.equal(parseSpoken('1 giờ, 2 phút, 3 giây'), 3723);
});

test('parses copied transcript text with timestamp lines', () => {
  const segs = parseText('0:00\nxin chào các bạn\n27 phút, 36 giây\nDenji mở mắt\n1:02:03 Makima đến');
  assert.deepEqual(segs, [{ t: 0, text: 'xin chào các bạn' }, { t: 1656, text: 'Denji mở mắt' }, { t: 3723, text: 'Makima đến' }]);
});

test('splits into numbered sentences, keeps first time', () => {
  const s = toSentences([{ t: 1, text: 'Một hai. Ba' }, { t: 5, text: 'bốn!' }]);
  assert.deepEqual(s, [{ i: 0, t: 1, text: 'Một hai.' }, { i: 1, t: 1, text: 'Ba bốn!' }]);
  const long = toSentences([{ t: 0, text: Array(65).fill('chữ').join(' ') }]);
  assert.equal(long.length, 2);
  const lines = toSentences(Array.from({ length: 6 }, (_, k) => ({ t: k, text: 'một hai ba bốn năm sáu bảy tám' })));
  assert.deepEqual(lines.map(s => s.t), [0, 3]); // breaks only at caption-line ends
});

test('drops ads only at the edges', () => {
  const body = Array.from({ length: 100 }, (_, i) => ({ t: i, text: `câu truyện ${i}.` }));
  body[0].text = 'Nhớ đăng ký kênh và bấm chuông nhé.';
  body[50].text = 'Hắn đăng ký vào học viện.';
  body[99].text = 'Hẹn gặp lại các bạn.';
  const out = dropAds(body);
  assert.equal(out.length, 98);
  assert.ok(out.some(s => s.text.includes('học viện')));
  assert.deepEqual(clean(body).map(s => s.i), clean(body).map((_, i) => i));
});

test('hour windows with overlap cover everything once', () => {
  const sents = clean(Array.from({ length: 3 * 3600 / 10 }, (_, k) => ({ t: k * 10, text: `đoạn ${k}.` })));
  const w = makeWindows(sents);
  assert.equal(w.length, 3);
  assert.equal(w[0].core, 0);
  for (let n = 1; n < w.length; n++) {
    assert.equal(w[n].core, w[n - 1].to);
    assert.ok(w[n].from < w[n].core, 'has overlap');
  }
  assert.equal(w.at(-1).to, sents.length);
});

test('text without timestamps windows by size', () => {
  const sents = clean([{ t: null, text: Array(30000).fill('chữ.').join(' ') }]);
  assert.ok(makeWindows(sents).length >= 3);
});

const CATS = MODES.fanfic.categories;
const sec = (start, title, kws = {}) => ({ start, title, summary: title, keywords: Object.entries(kws).flatMap(([c, l]) => l.map(text => ({ text, category: c }))) });

test('normalize + merge sections into the generic format', () => {
  const w = { from: 0, core: 10, to: 20 };
  const a = normalizeSections({ sections: [{ s: 5, t: 'ngữ cảnh' }, { s: 12, t: 'A', m: 'x', k: { character: ['Denji'], junk: ['x'] } }, { s: 'x', t: 'bad' }] }, w, CATS);
  assert.deepEqual(a, [{ start: 12, title: 'A', summary: 'x', keywords: [{ text: 'Denji', category: 'character' }] }]);
  const m = mergeSections([[sec(3, 'đầu')], a], 20);
  assert.deepEqual(m.map(x => [x.start, x.end]), [[0, 11], [12, 19]]);
});

test('estimate is small for 20h on a paid cheap model', () => {
  const sents = clean(Array.from({ length: 20 * 360 }, (_, k) => ({ t: k * 10, text: 'Denji dùng cưa máy chém Sasuke bằng Sharingan rồi bỏ chạy về làng Lá ngay.' })));
  const e = estimate(sents, { priceIn: 0.1, priceOut: 0.5 });
  assert.equal(e.windows, 20);
  assert.ok(e.usd > 0 && e.usd < 1, String(e.usd));
});

test('runSections resumes saved windows without re-asking', async () => {
  const sents = clean(Array.from({ length: 2 * 360 + 10 }, (_, k) => ({ t: k * 10, text: `câu ${k}.` })));
  const calls = [];
  const ask = async (sys, user) => {
    calls.push(user.slice(0, 20));
    if (sys.includes('score')) return { inTok: 1, outTok: 1, json: { score: 8, why: 'hay', plot: ['a', 'b'] } };
    const core = +user.match(/Câu (\d+)/)[1];
    return { inTok: 10, outTok: 5, json: { sections: [{ s: core + 1, t: 'Cảnh ' + core, m: 'm', k: { character: ['Denji'], power: ['Sharingan'] } }] } };
  };
  const r = await runSections({ sents, rec: {}, mode: MODES.fanfic, ask, saved: { parts: [[sec(0, 'đã có')]] } });
  assert.equal(calls.length, 2); // window 2 + verdict only
  assert.equal(r.sections[0].title, 'đã có');
  assert.equal(r.sections[1].keywords[1].category, 'power');
  assert.equal(r.overview.score, 8);
});

test('every mode has the same shape; only fanfic ships', () => {
  for (const [id, m] of Object.entries(MODES)) {
    for (const k of ['label', 'unit', 'categories', 'sectionSystem', 'verdictSystem', 'verdict']) assert.ok(m[k], id + '.' + k);
    for (const c of Object.keys(m.categories)) assert.ok(m.sectionSystem.includes(`"${c}"`), id + ' prompt lists ' + c);
  }
  assert.deepEqual(Object.keys(MODES).filter(k => MODES[k].ready), ['fanfic']);
});

test('accent-insensitive search, index and highlight', () => {
  assert.equal(fold('Đường Kiếm'), 'duong kiem');
  const sents = clean([{ t: 0, text: 'Denji kéo dây. Cưa máy gầm lên.' }, { t: 9, text: 'Sasuke mở Sharingan nhìn Makima.' }]);
  const sections = mergeSections([[sec(0, 'Cưa máy', { character: ['Denji'], power: ['cưa máy'] }),
    sec(2, 'Mắt đỏ', { character: ['Sasuke', 'denji'], power: ['Sharingan'] })]], sents.length);
  const idx = buildIndex(sections, CATS);
  assert.deepEqual(idx.character[0], { name: 'Denji', units: [0, 1] });
  assert.deepEqual(search('makima', sections, sents).map(r => [r.n, r.kw]), [[1, false]]);
  assert.deepEqual(search('cua may', sections, sents).map(r => r.n), [0]);
  assert.deepEqual(highlight('Cưa máy!', 'cua').map(p => p.hit), [true, false]);
});

test('parseJSON tolerates fences', () => {
  assert.deepEqual(parseJSON('```json\n{"a":1}\n```'), { a: 1 });
});
