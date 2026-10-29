import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transcriptTxt, passages, clock, exportName } from '../app/js/export.js';

const sents = Array.from({ length: 12 }, (_, i) => ({ i, t: i * 30, text: `Câu số ${i}.` }));
const rec = { title: 'Bài giảng', channel: 'Kênh A', video_id: 'abcdefghijk', segments: sents };

test('clock formats m:ss and h:mm:ss', () => {
  assert.equal(clock(754), '12:34'); assert.equal(clock(3723), '1:02:03'); assert.equal(clock(5), '0:05');
});
test('passages group about every 90 s and keep text verbatim', () => {
  const p = passages(sents);
  assert.equal(p.length, 4);
  assert.equal(p[1].t, 90);
  assert.equal(p.map(x => x.text).join(' '), sents.map(s => s.text).join(' '));
});
test('export has header, numbered passages with [time], no AI-style rewriting', () => {
  const txt = transcriptTxt(rec, sents, new Date('2026-10-29T10:00:00Z'));
  assert.match(txt, /^Title: Bài giảng\nChannel: Kênh A\nVideo: https:\/\/www\.youtube\.com\/watch\?v=abcdefghijk\nExported: 2026-10-29\nCaption type: unknown\nTimes: from captions\n\n1\. \[0:00\] Câu số 0\./);
  assert.match(txt, /\n\n2\. \[1:30\] Câu số 3\./);
});
test('no times: passages by size, no [time], header says none; estimated flagged', () => {
  const none = sents.map(s => ({ ...s, t: null }));
  const txt = transcriptTxt({ ...rec, segments: none }, none);
  assert.match(txt, /Times: none/); assert.doesNotMatch(txt, /\[\d/);
  const est = transcriptTxt({ ...rec, segments: none }, sents);
  assert.match(est, /Times: estimated/);
});
test('file name comes from the title, safe and at most 80 chars', () => {
  assert.equal(exportName({ title: 'Bài giảng: Sinh học 12 / "Di truyền"?' }), 'Bài giảng Sinh học 12 Di truyền.txt');
  assert.equal(exportName({ title: '', video_id: 'abcdefghijk' }), 'transcript-abcdefghijk.txt');
  assert.ok(exportName({ title: 'a'.repeat(200) }).length <= 84);
  assert.equal(exportName({ title: '../..\\x' }), 'x.txt');
});
