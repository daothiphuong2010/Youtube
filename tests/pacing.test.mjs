import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pacer, DayLimit, nextPacificMidnight, pacificDay } from '../app/js/pacer.js';
import { askJSON } from '../app/js/ai.js';
import { clean } from '../app/js/cleanup.js';
import { estimate, partialSections, runSections } from '../app/js/scenes.js';
import { MODES } from '../app/js/modes.js';

const T0 = Date.parse('2026-10-12T22:00:00Z'); // 15:00 in California
const fake = () => {
  const c = { t: T0 };
  const m = new Map();
  return { c, opts: { now: () => c.t, store: { get: k => m.get(k), set: (k, v) => m.set(k, v) } } };
};

test('requests/min kept to 80% of the limit over any minute', () => {
  const { c, opts } = fake();
  const p = new Pacer({ rpm: 5, target: 80 }, opts);
  for (let k = 0; k < 4; k++) { assert.equal(p.delay(10), 0); p.record(10); c.t += 1000; }
  assert.equal(p.delay(10), 60000 - 4000); // 5th waits until the 1st leaves the window
});

test('input tokens/min: big requests wait for room', () => {
  const { c, opts } = fake();
  const p = new Pacer({ tpm: 250000, target: 80 }, opts); // 200k budget
  p.record(90000); c.t += 100; p.record(90000); c.t += 100;
  assert.equal(p.delay(90000), 60000 - 200);
  assert.equal(p.delay(10000), 0);
  // A request larger than the whole budget goes alone in an empty window instead of hanging.
  const q = new Pacer({ tpm: 100000 }, opts);
  assert.equal(q.delay(500000), 0);
});

test('429: honor retryDelay, slow down, then speed up slowly', () => {
  const { c, opts } = fake();
  const p = new Pacer({ rpm: 10, target: 80 }, opts);
  assert.equal(p.rpmNow, 8);
  p.on429(7000);
  assert.equal(p.delay(1), 7000);
  assert.ok(Math.abs(p.rpmNow - 4.8) < 1e-9);
  c.t += 7000;
  const e = p.record(1);
  for (let k = 0; k < 4; k++) p.onSuccess(e, 300, 50);
  assert.ok(p.rpmNow > 4.8 && p.rpmNow < 8);
  assert.equal(p.cpt > 2, true); // learned 2 chars/token -> moving toward real ratio
});

test('daily quota: stop locally, resume after midnight Pacific', () => {
  const { c, opts } = fake();
  const p = new Pacer({ rpd: 2 }, opts);
  p.record(1); p.record(1);
  assert.throws(() => p.delay(1), e => e instanceof DayLimit && e.resumeAt === Date.parse('2026-10-13T07:05:00Z'));
  assert.equal(p.delay(1, { ignoreDay: true }), 0);
  c.t = Date.parse('2026-10-13T07:06:00Z');
  assert.equal(pacificDay(c.t), '2026-10-13');
  assert.equal(p.dayLeft(), 2);
  assert.equal(nextPacificMidnight(Date.parse('2026-12-01T20:00:00Z')), Date.parse('2026-12-02T08:05:00Z')); // winter: UTC-8
});

const okBody = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":1}' }] } }], usageMetadata: { promptTokenCount: 5 } }), { status: 200 });
const s = { provider: 'gemini', baseUrl: 'https://x', model: 'm', apiKey: 'k' };

test('askJSON: 22 calls at 5 rpm never exceed 4 in any minute', async () => {
  const { c, opts } = fake();
  const sent = [];
  globalThis.fetch = async () => { sent.push(c.t); c.t += 3000; return okBody(); };
  const pacer = new Pacer({ rpm: 5, tpm: 250000, target: 80 }, opts);
  for (let k = 0; k < 22; k++) await askJSON(s, 'sys', 'u'.repeat(2000), 100, { pacer, wait: async ms => { c.t += ms; } });
  for (const t of sent) assert.ok(sent.filter(x => x >= t && x < t + 60000).length <= 4);
  assert.ok(sent.at(-1) - sent[0] < 6 * 60000);
});

test('askJSON: 429 waits the server delay; daily quota throws DayLimit', async () => {
  const { c, opts } = fake();
  const waits = [];
  let calls = 0;
  globalThis.fetch = async () => (++calls === 1
    ? new Response(JSON.stringify({ error: { code: 429, message: 'slow down', details: [{ retryDelay: '7s' }] } }), { status: 429 })
    : okBody());
  const pacer = new Pacer({ rpm: 60 }, opts);
  const r = await askJSON(s, 'sys', 'u', 100, { pacer, wait: async ms => { waits.push(ms); c.t += ms; } });
  assert.deepEqual(r.json, { ok: 1 });
  assert.ok(waits.reduce((a, x) => a + x, 0) >= 7000, String(waits));
  assert.ok(pacer.factor < 1);
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'quota', details: [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }] } }), { status: 429 });
  await assert.rejects(askJSON(s, 'sys', 'u', 100, { pacer, wait: async () => {} }), e => e instanceof DayLimit && e.resumeAt > c.t);
});

test('estimate: days when the daily quota is small; bigger windows = fewer calls', () => {
  const sents = clean(Array.from({ length: 21 * 360 }, (_, k) => ({ t: k * 10, text: 'Denji dùng cưa máy chém Sasuke bằng Sharingan rồi bỏ chạy.' })));
  const e = estimate(sents, { free: true, rpm: 5, tpm: 250000, rpd: 20, target: 80 });
  assert.equal(e.requests, 22);
  assert.equal(e.days, 2);
  assert.equal(estimate(sents, { free: true, rpd: 20, winMin: 120 }).days, 1);
});

test('progressive sections, and a day stop keeps finished chunks', async () => {
  const sents = clean(Array.from({ length: 3 * 360 }, (_, k) => ({ t: k * 10, text: `câu ${k}.` })));
  const parts = [];
  let n = 0;
  const ask = async (sys, user) => {
    if (++n === 3) throw new DayLimit(123);
    const core = +user.match(/Câu (\d+)/)[1];
    return { inTok: 1, outTok: 1, json: { sections: [{ s: core + 1, t: 'Cảnh ' + core }] } };
  };
  await assert.rejects(runSections({ sents, rec: {}, mode: MODES.fanfic, ask, onWindow: (k, part) => { parts[k] = part; } }), DayLimit);
  assert.equal(parts.filter(Boolean).length, 2);
  const shown = partialSections(sents, parts, 60);
  assert.equal(shown.length, 2);
  assert.ok(shown[1].end < sents.length - 1); // ends where finished work ends
  const calls = [];
  const r = await runSections({ sents, rec: {}, mode: MODES.fanfic, saved: { parts },
    ask: async (sys, user) => { calls.push(sys); return sys.includes('score') ? { inTok: 1, outTok: 1, json: { score: 7 } } : { inTok: 1, outTok: 1, json: { sections: [{ s: +user.match(/Câu (\d+)/)[1] + 1, t: 'C' }] } }; } });
  assert.equal(calls.length, 2); // only the missing chunk + verdict
  assert.equal(r.sections.length, 3);
});
