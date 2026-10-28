import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJSON } from '../app/js/ai.js';
import { runSections } from '../app/js/scenes.js';
import { MODES } from '../app/js/modes.js';

test('JSON reads a balanced object with escaped quotes and ignores non-JSON prose', () => {
  assert.deepEqual(parseJSON('Kết quả: {"text":"} \\"ok\\"", "a":{"b":2}} xong }'), {text:'} "ok"',a:{b:2}});
});
test('adjacent JSON objects report ambiguity instead of the pictured syntax error', () => {
  assert.throws(() => parseJSON('{"sections":[]} {"sections":[]}'), /nhiều đối tượng JSON/);
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
