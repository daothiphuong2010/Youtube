import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clean } from '../app/js/cleanup.js';
import { makeBlocks, analyze } from '../app/js/algo.js';
import { parseGlossary } from '../app/js/glossary.js';
import { parseCharacters, formatCharacters, detectNames, castFor, mergeCharacters, sampleText, nameMatcher } from '../app/js/names.js';

// 1h story, 12 blocks: names written capitalized mid-sentence, sometimes misheard ("Đen Di"),
// lines start capitalized like captions do, a few capitalized non-names.
const story = () => {
  let seed = 3;
  const rnd = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return Math.floor(seed / 65536) % n; };
  const pick = a => a[rnd(a.length)];
  const SENT = ['trời mưa trên phố cũ', 'gió lạnh thổi qua căn phòng nhỏ', 'ánh đèn mờ nhạt', 'cô ấy mỉm cười', 'mọi thứ im lặng'];
  const lines = [];
  for (let k = 0; k < 360; k++) {
    let t = 'Rồi ' + pick(SENT) + ' và ' + pick(SENT);
    if (k % 4 === 0) t = `Lúc đó ${pick(['Denji', 'Denji', 'Đen Di'])} ${pick(['cầm cưa máy', 'nhìn thấy quỷ', 'chạy về phía'])} ${pick(SENT)}`;
    if (k % 6 === 0) t = `Sau đó Makima ${pick(['mỉm cười', 'ra lệnh', 'nhìn xuống'])} còn ${pick(SENT)}`;
    if (k > 240 && k % 5 === 0) t = `bỗng nhiên Uchiha Sasuke mở mắt rồi Sasuke ${pick(['lao tới', 'đứng yên'])}`;
    if (k % 30 === 0) t = `Thứ Hai ở Tokyo ${pick(SENT)}`;
    if (k % 3 === 0) t = 'Anh ' + t;
    lines.push({ t: k * 10, text: t[0].toUpperCase() + t.slice(1) + '.' });
  }
  return clean(lines);
};

test('character list: parse, format, merge AI results', () => {
  const c = parseCharacters('Đen Di, đen đi = Denji | nhân vật chính\nMakima\n- Thứ Hai\n');
  assert.deepEqual(c.list, [{ name: 'Denji', aliases: ['Đen Di', 'đen đi'], role: 'nhân vật chính' }, { name: 'Makima', aliases: [], role: '' }]);
  assert.ok(c.hide.has('thứ hai'));
  assert.equal(formatCharacters(c), 'Đen Di, đen đi = Denji | nhân vật chính\nMakima\n- Thứ Hai');
  const m = parseCharacters(mergeCharacters('Makima\n- Thứ Hai', [{ name: 'Denji', aliases: ['Đen Di'], role: 'thợ săn quỷ' }, { name: 'Ma Ki Ma', aliases: ['Makima'], role: 'thủ lĩnh' }]));
  assert.deepEqual(m.list.map(x => [x.name, x.aliases.join('/'), x.role]), [['Makima', 'Ma Ki Ma', 'thủ lĩnh'], ['Denji', 'Đen Di', 'thợ săn quỷ']]);
  assert.ok(m.hide.has('thứ hai'));
  // A hidden spelling that the AI says belongs to a character is un-hidden and merged.
  const u = parseCharacters(mergeCharacters('- Đen Di', [{ name: 'Denji', aliases: ['Đen Di'] }]));
  assert.equal(u.hide.size, 0);
  assert.deepEqual(u.list[0].aliases, ['Đen Di']);
});

test('free name detection: capitalized, not sentence-start, repeated, no common words', () => {
  const sents = story();
  const blocks = makeBlocks(sents);
  const names = detectNames(sents, blocks).map(d => d.name);
  for (const n of ['Denji', 'Makima', 'Tokyo']) assert.ok(names.includes(n), names.join('|'));
  assert.ok(names.some(n => /Sasuke/.test(n)), names.join('|'));
  for (const bad of ['Rồi', 'Anh', 'Lúc', 'Sau', 'Thứ Hai', 'Anh Denji']) assert.ok(!names.includes(bad), bad + ' in ' + names.join('|'));
});

test('cast: glossary merges misheard names, hidden names drop, keywords never hold names', () => {
  const sents = story();
  const blocks = makeBlocks(sents);
  const p = castFor(sents, blocks, '- Tokyo', parseGlossary('Đen Di = Denji'));
  const names = p.cast.map(c => c.name);
  assert.equal(names[0], 'Denji');
  assert.ok(!names.includes('Đen Di') && !names.includes('Tokyo'), names.join('|'));
  const denji = p.cast[0];
  assert.ok(denji.aliases.includes('Đen Di'));
  assert.equal(denji.total, sents.reduce((a, x) => a + (x.text.match(/Denji|Đen Di/g) || []).length, 0)); // "Đen Di" counted as Denji
  const sas = p.cast.find(c => /Sasuke/.test(c.name));
  assert.equal(sas.total, sents.reduce((a, x) => a + (x.text.match(/Sasuke/g) || []).length, 0)); // "Uchiha Sasuke" = 1 mention
  const sasuke = p.cast.find(c => /Sasuke/.test(c.name));
  assert.equal(sasuke.perUnit.slice(0, 8).reduce((a, x) => a + x, 0), 0);
  const free = analyze(sents, blocks, p.glossary, 5, p.isName);
  for (const b of free.blocks) {
    assert.ok(b.terms.length <= 5);
    for (const t of b.terms) assert.ok(!/denji|makima|sasuke|uchiha|đen di/i.test(t), t);
  }
  assert.ok(nameMatcher(p.cast)('denji nhìn thấy') && !nameMatcher(p.cast)('cưa máy'));
});

test('AI sample: a few evenly spaced excerpts', () => {
  const sents = story();
  const t = sampleText(sents, 6, 500);
  assert.equal((t.match(/--- Đoạn trích/g) || []).length, 6);
  assert.ok(t.length < 6 * 700);
});
