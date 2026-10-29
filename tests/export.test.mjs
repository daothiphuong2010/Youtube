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
  assert.match(txt, /^Title: Bài giảng\nChannel: Kênh A\nVideo: https:\/\/www\.youtube\.com\/watch\?v=abcdefghijk\nExported: 2026-10-29\nCaption type: unknown\nTimes: from captions\nRemoved: 0 sentences by rule \(intro\/outro filler, listed at the end\)\n\n## Bản chép lời\n\n1\. \[0:00\] Câu số 0\./);
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
test('a passage never exceeds about 900 characters even when speech is fast', () => {
  const fast = Array.from({ length: 60 }, (_, i) => ({ i, t: i, text: 'x'.repeat(120) }));
  assert.ok(passages(fast).every(p => p.text.length <= 900 + 121));
});

const T = (t, text) => ({ i: 0, t, text });
const body = [T(0, 'Xin chào các bạn, chào mừng các bạn đã quay trở lại kênh.'), T(5, 'Đăng ký kênh và bấm chuông thông báo nhé.'),
  T(12, 'Tế bào là đơn vị cơ bản của sự sống và có nhiều bào quan khác nhau.'),
  T(300, 'Xin chào, đây là ví dụ nằm giữa video nên phải giữ nguyên.'),
  T(600, 'Tạm biệt các bạn.'), T(605, 'Hẹn gặp lại các bạn trong video tiếp theo, nhớ like và share nhé.')];
test('intro greeting + subscribe call and outro goodbye are removed and listed', () => {
  const txt = transcriptTxt({ ...rec, duration: 610 }, body, new Date('2026-10-29T10:00:00Z'));
  assert.match(txt, /Removed: 4 sentences by rule/);
  assert.match(txt, /## Bản chép lời\n\n1\. \[0:12\] Tế bào/);
  assert.match(txt, /\n## Removed \(intro\/outro\)\n\n\[0:00\] Xin chào các bạn[^\n]*\n\n\[0:05\] Đăng ký kênh[^\n]*\n\n\[10:00\] Tạm biệt[^\n]*\n\n\[10:05\] Hẹn gặp lại/);
});
test('"xin chào" in the middle is kept', () => {
  const txt = transcriptTxt({ ...rec, duration: 610 }, body);
  assert.match(txt, /\[5:00\] Xin chào, đây là ví dụ/);
  assert.doesNotMatch(txt.split('## Removed')[1], /ví dụ/);
});
test('a sentence mixing filler with real content is kept verbatim', () => {
  const mixed = [T(2, 'Xin chào các bạn, hôm nay chúng ta học về quá trình quang hợp ở thực vật.'), T(30, 'Quang hợp cần ánh sáng.')];
  const txt = transcriptTxt({ ...rec, duration: 300 }, mixed);
  assert.match(txt, /Removed: 0 sentences/); assert.match(txt, /Xin chào các bạn, hôm nay chúng ta học về quá trình quang hợp ở thực vật\./);
  assert.doesNotMatch(txt, /## Removed/);
});
test('English filler is removed at the edges; no filler means nothing removed', () => {
  const en = [T(0, 'Hey guys, welcome back to the channel.'), T(8, 'Mitosis has four phases.'), T(200, 'Thanks for watching, see you in the next video.')];
  assert.match(transcriptTxt({ ...rec, duration: 205 }, en), /Removed: 2 sentences/);
  assert.match(transcriptTxt(rec, sents), /Removed: 0 sentences/);
});
