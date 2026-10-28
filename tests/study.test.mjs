import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sourceFor, validateCards, changeWorkspace, dueCards, cardsTSV, learningInput } from '../app/js/study.js';

const sents = [{i:0,t:0,text:'Truy hồi chủ động giúp nhận ra điều chưa nhớ.'},{i:1,t:300,text:'Ôn cách quãng trải các lần ôn ra nhiều ngày.'}];
const draft = {id:'c1',question:'Ôn cách quãng là gì?',answer:'Trải các lần ôn ra nhiều ngày.',start:1,end:1,quote:sents[1].text};
test('source range binds a verbatim quote; rejects made-up quotes and out of range indices', () => {
  assert.equal(sourceFor(sents,1,1).quote,sents[1].text);
  assert.throws(()=>validateCards([{...draft,quote:'AI bịa'}],sents,{start:1,end:1}),/trích/i);
  assert.throws(()=>validateCards([{...draft,start:0}],sents,{start:1,end:1}),/phạm vi/);
  assert.equal(validateCards([draft],sents,{start:1,end:1}).length,1);
});
test('drafts never enter review; approve idempotently; reviews keep history and are idempotent', () => {
  let w = changeWorkspace({}, {type:'draft',draft}, 1000);
  assert.equal(dueCards(w,1000).length,0);
  w=changeWorkspace(w,{type:'approve'},1000);
  w=changeWorkspace(w,{type:'approve'},1001);
  assert.equal(w.cards.length,1);
  assert.equal(dueCards(w,1000).length,1);
  w=changeWorkspace(w,{type:'review',id:'c1',eventId:'r1',grade:'remember'},1000);
  w=changeWorkspace(w,{type:'review',id:'c1',eventId:'r1',grade:'remember'},1001);
  assert.equal(w.cards[0].history.length,1);
  assert.equal(w.cards[0].due,1000+86400000);
  assert.equal(dueCards(w,1001).length,0);
  assert.equal(dueCards(w,1000+86400000*14).length,1);
  w=changeWorkspace(w,{type:'review',id:'c1',eventId:'r2',grade:'again'},1000+86400000*14);
  assert.equal(w.cards[0].history.length,2);
  assert.equal(w.cards[0].interval,0);
});
test('pending AI candidates cannot silently overwrite a draft; reader position is durable data', () => {
  let w=changeWorkspace({}, {type:'draft',draft},1);
  w=changeWorkspace(w,{type:'candidates',cards:[{...draft,id:'c2',question:'Các lần ôn nên phân bố thế nào?'}]},2);
  assert.equal(w.draft.id,'c1');
  assert.equal(w.candidates.length,1);
  w=changeWorkspace(w,{type:'reading',start:1},3);
  assert.equal(w.reading.start,1);
});
test('Anki TSV exports approved cards only and escapes source text, tabs and newlines', () => {
  const rec={id:'yt:123',video_id:'12345678901',title:'<x>'};
  const tsv=cardsTSV({...rec,workspace:{cards:[{...draft,status:'approved'}]}},sents);
  assert.ok(tsv.includes('&lt;x&gt;') && tsv.includes('t=300'));
  assert.equal(tsv.split('\n').length,1);
});
test('rejected drafts can be archived and restored without entering the review queue',()=>{
  let w=changeWorkspace({}, {type:'draft',draft},1);
  w=changeWorkspace(w,{type:'archive'},2);assert.equal(w.draft,null);assert.equal(dueCards(w,3).length,0);
  w=changeWorkspace(w,{type:'restoreDraft'},3);assert.equal(w.draft.id,draft.id);
});
test('learning reads nearby qualifications across the five-minute boundary while cards remain inside the selected part',()=>{
  const source=[{i:0,t:0,text:'Mở đầu.'},{i:1,t:296,text:'Cờ trắng gắn với đầu hàng.'},{i:2,t:300.32,text:'Không phải ai giơ cờ trắng cũng xin hàng.'},{i:3,t:340,text:'Chủ đề khác ở xa.'}];
  const input=learningInput(source,{start:0,end:1});
  assert.ok(input.includes(source[2].text));assert.ok(!input.includes(source[3].text));
  assert.throws(()=>validateCards([{question:'Hỏi?',answer:'Đáp.',start:2,end:2,quote:source[2].text}],source,{start:0,end:1}),/phạm vi/);
  const untimed=source.map(s=>({...s,t:null}));
  assert.ok(learningInput(untimed,{start:1,end:1}).includes(untimed[0].text));
  assert.ok(!learningInput([{i:0,t:10000,text:'Không ở gần.'},{i:1,t:100,text:'Phần chính.'}],{start:1,end:1}).includes('Không ở gần.'));
});
