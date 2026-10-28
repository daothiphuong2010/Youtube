import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readingParagraphs} from '../app/js/algo.js';

test('reading groups source sentences into short paragraphs without losing boundaries, times or words',()=>{
  const sents=Array.from({length:13},(_,i)=>({i,t:i*10,text:`Câu nguồn ${i}.`}));
  const before=structuredClone(sents),parts=readingParagraphs(sents,{start:2,end:10});
  assert.deepEqual(parts.map(p=>[p.start,p.end,p.t]),[[2,6,20],[7,10,70]]);
  assert.equal(parts.map(p=>p.text).join(' '),sents.slice(2,11).map(s=>s.text).join(' '));
  assert.deepEqual(sents,before);
  assert.equal(parts.find(p=>p.start<=8 && p.end>=8).start,7);
  assert.deepEqual(readingParagraphs([],{start:0,end:-1}),[]);
});
