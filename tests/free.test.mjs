import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clean } from '../app/js/cleanup.js';
import { fillTimes, makeBlocks, analyze, density, overlaps } from '../app/js/algo.js';
import { parseGlossary, applyGlossary, queryGroups, phraseAlts } from '../app/js/glossary.js';
import { search } from '../app/js/search.js';
import { askJSON, AIError } from '../app/js/ai.js';
import { estimate } from '../app/js/scenes.js';

const story = () => {
  const lines = [];
  for (let k = 0; k < 360; k++) {
    let t = 'trời mưa trên phố cũ người qua đường vội vã';
    if (k > 100 && k % 3 === 0) t = 'đen di kéo dây cưa máy gầm vang';
    if (k > 250 && k % 4 === 0) t = 'sasuke mở mắt sharingan đỏ rực';
    lines.push({ t: k * 10, text: t });
  }
  return clean(lines);
};

test('estimated times for .txt input', () => {
  const s = fillTimes([{ text: 'aaaa' }, { text: 'bbbb' }, { text: 'cccc' }, { text: 'dddd' }].map(x => ({ ...x, t: null })), 400);
  assert.deepEqual(s.map(x => x.t), [0, 100, 200, 300]);
  assert.equal(fillTimes([{ t: null, text: 'a' }], null)[0].t, null);
});

// Realistic-ish story: fixed filler sentences, names in varied contexts, a phrase spread
// evenly over the video ("chiến tranh ác ma") and "ác ma" after many different words.
const story2 = () => {
  let seed = 7;
  const rnd = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return Math.floor(seed / 65536) % n; };
  const pick = a => a[rnd(a.length)];
  const SENT = ['trời mưa trên phố cũ', 'người qua đường vội vã', 'gió lạnh thổi qua căn phòng nhỏ', 'tiếng chuông vang xa', 'ánh đèn mờ nhạt', 'bóng tối bao trùm', 'cánh cửa khép hờ', 'con đường vắng tanh', 'cô ấy mỉm cười', 'mọi thứ im lặng'];
  const VERB = ['rơi xuống', 'nổi giận', 'nhìn thấy', 'chạy về phía', 'hét lên với', 'đứng cạnh'];
  const OBJ = ['máy ảnh', 'bức tranh', 'thanh kiếm', 'cánh cửa', 'tòa nhà'];
  const lines = [];
  for (let k = 0; k < 360; k++) {
    let t = pick(SENT) + ' ' + pick(SENT);
    if (k % 5 === 0) t += ` ${pick(VERB)} ác ma ${pick(SENT)}`;
    if (k % 7 === 0) t = `${pick(SENT)} chiến tranh ác ma ${pick(VERB)} ${pick(OBJ)}`;
    if (k > 100 && k < 200 && k % 3 === 0) t = `${pick(SENT)} đen di ${pick(VERB)} ${pick(OBJ)} ${pick(SENT)}`;
    if (k > 250 && k % 4 === 0) t = `${pick(SENT)} sharingan ${pick(VERB)} ${pick(SENT)}`;
    lines.push({ t: k * 10, text: t });
  }
  return clean(lines);
};

test('5-minute blocks, TF-IDF terms, first appearance, density', () => {
  const sents = story2();
  const blocks = makeBlocks(sents);
  assert.equal(blocks.length, 12);
  const g = parseGlossary('Đen Di, đen đi = Denji');
  const { blocks: b, top, bursty } = analyze(sents, blocks, g);
  assert.ok(top.includes('denji'), top.join('|'));
  assert.ok(!b[0].terms.includes('denji'));
  const firstDenji = b.findIndex(x => x.firsts.includes('denji'));
  const firstSasuke = b.findIndex(x => x.firsts.includes('sharingan'));
  assert.ok(firstDenji >= 3 && firstDenji <= 4, String(firstDenji));
  assert.ok(firstSasuke >= 8, String(firstSasuke));
  // No phrase fragments crossing word boundaries, no overlapping terms in one block.
  const all = new Set([...top, ...b.flatMap(x => x.terms)]);
  for (const bad of ['tranh ác ma', 'rơi xuống ác', 'nổi giận ác', 'máy ảnh ác', 'ác ma xa', 'tranh ác', 'đèn mờ']) assert.ok(!all.has(bad), bad);
  for (const x of b) for (const t of x.terms) assert.ok(!x.terms.some(u => u !== t && overlaps(u, t)), x.terms.join('|'));
  // Chart default: a clustered name, not an evenly spread phrase.
  assert.ok(['denji', 'sharingan'].includes(bursty[0]), bursty.join('|'));
  bursty.forEach((t, i) => { if (t.includes('ác ma')) assert.ok(i > bursty.indexOf('denji'), bursty.join('|')); });
  const d = density(sents, blocks, ['sharingan']);
  assert.equal(d.slice(0, 8).reduce((a, x) => a + x, 0), 0);
  assert.ok(d[10] > 0);
});

test('chart counts a keyword as one whole phrase', () => {
  const g = parseGlossary('Đen Di = Denji');
  assert.deepEqual(phraseAlts('Denji cưa máy', g).sort(), ['den di cua may', 'denji cua may']);
  const sents = [{ text: 'ánh đèn mờ nhạt, đèn sáng' }, { text: 'mạc mấy ác ma. Đen Di cưa máy' }];
  const u = [{ start: 0, end: 0 }, { start: 1, end: 1 }];
  assert.deepEqual(density(sents, u, phraseAlts('ánh đèn mờ nhạt')), [1, 0]);
  assert.deepEqual(density(sents, u, phraseAlts('ác ma')), [0, 1]);
  assert.deepEqual(density(sents, u, phraseAlts('denji cưa máy', g)), [0, 1]);
});

test('overlaps: containment and edge overlap', () => {
  assert.ok(overlaps('chiến tranh ác ma', 'tranh ác'));
  assert.ok(overlaps('chiến tranh', 'tranh ác ma'));
  assert.ok(!overlaps('denji', 'sharingan'));
});

test('glossary: parse, apply, search finds misheard names', () => {
  const g = parseGlossary('Đen Di, đen đi = Denji\nbad line\nma ki ma -> Makima');
  assert.deepEqual(g, [{ wrong: ['Đen Di', 'đen đi'], right: 'Denji' }, { wrong: ['ma ki ma'], right: 'Makima' }]);
  assert.equal(applyGlossary('rồi Đen Di chạy, ma ki ma cười', g), 'rồi Denji chạy, Makima cười');
  assert.deepEqual(queryGroups('denji cưa', g), [['den di', 'den di', 'denji'].sort((a, b) => b.length - a.length), ['cua']]);
  const sents = story();
  const blocks = makeBlocks(sents);
  assert.ok(search('Denji cưa máy', blocks, sents, g).length > 0);
  assert.equal(search('Denji', blocks, sents, []).length, 0);
  const hit = search('sharingan', blocks, sents, g)[0];
  assert.ok(sents[hit.sent].text.includes('sharingan'));
});

test('free tier costs $0', () => {
  const e = estimate(story(), { free: true, priceIn: 5, priceOut: 5, rpm: 10 });
  assert.equal(e.usd, 0);
  assert.equal(e.requests, 2);
});

test('askJSON retries 429 with server delay, stops on daily quota', async () => {
  const waits = [];
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) return new Response(JSON.stringify({ error: { code: 429, message: 'slow down', details: [{ retryDelay: '7s' }] } }), { status: 429 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":1}' }] } }], usageMetadata: { promptTokenCount: 5 } }), { status: 200 });
  };
  const s = { provider: 'gemini', baseUrl: 'https://x', model: 'm', apiKey: 'k', rpm: 6000 };
  const r = await askJSON(s, 'sys', 'u', 100, { wait: async ms => waits.push(ms) });
  assert.deepEqual(r.json, { ok: 1 });
  assert.ok(waits.some(ms => ms >= 7000 && ms < 8100), String(waits));
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'quota', details: [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }] } }), { status: 429 });
  await assert.rejects(askJSON(s, 'sys', 'u', 100, { wait: async () => {} }), e => e instanceof AIError && /hôm nay/.test(e.message));
});
