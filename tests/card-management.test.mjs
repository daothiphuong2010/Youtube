import {test} from 'node:test';
import assert from 'node:assert/strict';
import {changeWorkspace,dueCards,cardsTSV} from '../app/js/study.js';
import {backupText,readBackup} from '../app/js/backup.js';

const source={start:0,end:0,quote:'Ôn cách quãng trải các lần ôn ra nhiều ngày.'};
const card={...source,id:'card',question:'Ôn cách quãng là gì?',answer:'Ôn qua nhiều ngày.',status:'approved',due:8000,interval:6,history:[{id:'r1',at:10,grade:'remember'}]};
const initial=()=>({kind:'knowledge',reading:{start:0},cards:[structuredClone(card)]});
const begin=(w,baseVersion=0)=>changeWorkspace(w,{type:'editCard',id:'card',draftId:'edit',expectedVersion:baseVersion},100);

test('editing an approved card uses a recoverable draft without replacing another draft',()=>{
  const w=begin(initial());
  assert.equal(w.cards[0].question,card.question);
  assert.equal(w.draft.editingCardId,'card');
  assert.equal(w.draft.baseVersion,0);
  const archived=changeWorkspace(w,{type:'archive'},101);
  assert.equal(changeWorkspace(archived,{type:'restoreDraft'},102).draft.id,'edit');
  assert.throws(()=>begin({...initial(),draft:{id:'another',question:'Đang viết',answer:'',...source}}),/nháp/i);
});
test('a correction keeps identity, source and review history; makes the active card due today and records previous content',()=>{
  let w=begin(initial());
  w=changeWorkspace(w,{type:'draft',draft:{...w.draft,answer:'Các lần ôn được trải ra nhiều ngày.'}},110);
  w=changeWorkspace(w,{type:'approve'},120);
  assert.equal(w.cards.length,1);assert.equal(w.cards[0].id,'card');
  assert.deepEqual(w.cards[0].history,card.history);
  assert.equal(w.cards[0].quote,source.quote);
  assert.equal(w.cards[0].due,120);assert.equal(w.cards[0].interval,0);
  assert.equal(w.cards[0].changes[0].before.answer,card.answer);
  assert.equal(w.cards[0].version,1);assert.equal(w.draft,null);
  const again=changeWorkspace(w,{type:'approve'},121);
  assert.equal(again.cards[0].changes.length,1);
});
test('unchanged text does not reset a learned card; invalid changes leave the stored card intact',()=>{
  const w=begin(initial());
  assert.deepEqual(changeWorkspace(w,{type:'approve'},120).cards[0],card);
  assert.throws(()=>changeWorkspace({...w,draft:{...w.draft,answer:''}},{type:'approve'},120),/đáp án/i);
  assert.throws(()=>changeWorkspace({...w,draft:{...w.draft,quote:'Một nguồn khác.'}},{type:'approve'},120),/nguồn/i);
  assert.equal(w.cards[0].answer,card.answer);
});
test('suspending and resuming is reversible, preserves scheduling/history and does not count as a review',()=>{
  let w=changeWorkspace(initial(),{type:'cardStatus',id:'card',status:'suspended',expectedVersion:0},100);
  assert.equal(dueCards(w,9000).length,0);
  assert.equal(cardsTSV({workspace:w},[]),'');
  assert.equal(w.cards[0].due,8000);assert.deepEqual(w.cards[0].history,card.history);
  w=changeWorkspace(w,{type:'cardStatus',id:'card',status:'approved',expectedVersion:1},200);
  assert.equal(dueCards(w,9000).length,1);assert.equal(dueCards(w,200).length,0);
  assert.equal(w.cards[0].changes.length,2);
});
test('stale tabs cannot save edits or grade a changed card, and suspended cards stay suspended after editing',()=>{
  let w=begin(initial());
  w=changeWorkspace(w,{type:'cardStatus',id:'card',status:'suspended',expectedVersion:0},110);
  assert.throws(()=>changeWorkspace({...w,draft:{...w.draft,answer:'Sửa từ tab cũ'}},{type:'approve'},120),/thay đổi|tab khác/i);
  w={...w,draft:null};w=begin(w,1);
  w=changeWorkspace(w,{type:'draft',draft:{...w.draft,answer:'Các lần ôn cách xa nhau.'}},130);
  w=changeWorkspace(w,{type:'approve'},140);
  assert.equal(w.cards[0].status,'suspended');assert.equal(dueCards(w,99999).length,0);
  const active=changeWorkspace(w,{type:'cardStatus',id:'card',status:'approved',expectedVersion:2},150);
  assert.throws(()=>changeWorkspace(active,{type:'review',id:'card',eventId:'old',grade:'again',expectedDue:140,expectedVersion:0},160),/thay đổi|tab khác/i);
});
test('backup preserves suspended cards, edit drafts and change history',()=>{
  let w=changeWorkspace(initial(),{type:'cardStatus',id:'card',status:'suspended',expectedVersion:0},100);
  w=begin(w,1);
  const rec={id:'source',segments:[{i:0,t:0,text:source.quote}],workspace:w};
  assert.deepEqual(readBackup(backupText([rec]))[0].workspace,w);
});
