import {test} from 'node:test';
import assert from 'node:assert/strict';
import {backupText,readBackup} from '../app/js/backup.js';
test('backup keeps source and workspace but excludes settings; restored jobs require a click',()=>{
  const r={id:'one',segments:[{i:0,t:0,text:'Nguồn.'}],workspace:{kind:'story',reading:{start:0}},apiKey:'secret',settings:{apiKey:'secret'},aiJob:{state:'running'},parts:[[]]};
  const text=backupText([r]);assert.ok(!text.includes('secret'));
  const copy=readBackup(text)[0];assert.deepEqual(copy.workspace,r.workspace);assert.equal(copy.aiJob.state,'error');assert.deepEqual(copy.parts,[[]]);
});
test('corrupt or duplicate source is rejected before opening a storage transaction',()=>{
  const r={id:'one',segments:[{i:0,t:0,text:'Nguồn.'}]};
  assert.throws(()=>readBackup(backupText([r,r])),/trùng/);
  assert.throws(()=>readBackup(backupText([{...r,segments:[{i:8,text:'bad'}]}])),/không hợp lệ/);
});
test('unfinished blank drafts survive a backup round trip',()=>{
  const r={id:'draft',segments:[{i:0,t:0,text:'Một câu nguồn.'}],workspace:{kind:'knowledge',reading:{start:0},draft:{id:'d',question:'',answer:'',start:0,end:0,quote:'Một câu nguồn.'}}};
  assert.deepEqual(readBackup(backupText([r]))[0].workspace.draft,r.workspace.draft);
});
