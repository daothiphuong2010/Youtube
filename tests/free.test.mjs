import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clean } from '../app/js/cleanup.js';
import { fillTimes, makeBlocks, analyze, density } from '../app/js/algo.js';
import { parseGlossary, applyGlossary, queryGroups } from '../app/js/glossary.js';
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

test('5-minute blocks, TF-IDF terms, first appearance, density', () => {
  const sents = story();
  const blocks = makeBlocks(sents);
  assert.equal(blocks.length, 12);
  const g = parseGlossary('Đen Di, đen đi = Denji');
  const { blocks: b, top } = analyze(sents, blocks, g);
  assert.ok(top.includes('denji') || top.some(t => t.includes('denji')), top.join('|'));
  assert.ok(!b[0].terms.some(t => t.includes('denji')));
  const firstDenji = b.findIndex(x => x.firsts.some(t => t.includes('denji')));
  const firstSasuke = b.findIndex(x => x.firsts.some(t => t.includes('sharingan')));
  assert.ok(firstDenji >= 3 && firstDenji <= 4, String(firstDenji));
  assert.ok(firstSasuke >= 8, String(firstSasuke));
  const d = density(sents, blocks, ['sharingan']);
  assert.equal(d.slice(0, 8).reduce((a, x) => a + x, 0), 0);
  assert.ok(d[10] > 0);
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
