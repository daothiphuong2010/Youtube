import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJSON } from '../app/js/ai.js';
import { runSections } from '../app/js/scenes.js';
import { MODES } from '../app/js/modes.js';

test('JSON reads a balanced object with escaped quotes and ignores non-JSON prose', () => {
  assert.deepEqual(parseJSON('Kết quả: {"text":"} \\"ok\\"", "a":{"b":2}} xong }'), {text:'} "ok"',a:{b:2}});
});
test('JSON takes the first object when text or a second object follows it', () => {
  assert.deepEqual(parseJSON('{"a":1} Ghi chú thêm. }'), {a:1});
  assert.deepEqual(parseJSON('{"sections":[1]}\n{"sections":[2]}'), {sections:[1]});
  assert.deepEqual(parseJSON('```json\n{"a":1}\n```\n```json\n{"b":2}\n```'), {a:1});
  assert.throws(() => parseJSON('{"a":1'), /JSON/);
});
test('a section reply that is not JSON is retried once, a second failure stops the run', async () => {
  const sents=[{i:0,t:0,text:'Một.'}], ok={json:{sections:[{s:0,t:'A'}],score:5},inTok:1,outTok:1};
  const saved=[]; let calls=0;
  const res=await runSections({sents,rec:{},mode:MODES.fanfic,onWindow:async n=>{saved.push(n);},
    ask:async()=>{calls++; if(calls===1) throw Error('JSON lỗi: x'); return ok;}});
  assert.deepEqual(saved,[0]); assert.equal(calls,3); assert.ok(res.sections.length);
  calls=0;
  await assert.rejects(runSections({sents,rec:{},mode:MODES.fanfic,onWindow:async n=>saved.push('x'),
    ask:async()=>{calls++; throw Error('JSON lỗi: y');}}),/JSON lỗi/);
  assert.equal(calls,2); assert.deepEqual(saved,[0]);
});
test('each AI checkpoint must finish saving before next request; storage failure stops the run', async () => {
  const calls = [];
  let saved = false;
  await assert.rejects(runSections({
    sents: [{i:0,t:0,text:'Một.'},{i:1,t:3600,text:'Hai.'}], rec:{}, mode:MODES.fanfic,
    ask:async () => { assert.equal(calls.length === 0 || saved, true); calls.push('call'); return {json:{sections:[{s:0,t:'A'}]},inTok:1,outTok:1}; },
    onWindow:async () => { await new Promise(r=>setTimeout(r,5)); throw Error('disk full'); },
  }), /disk full/);
  assert.equal(calls.length,1);
});
