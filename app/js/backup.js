// CORE: versioned data-only backup; settings/credentials are deliberately outside this contract.
import {validateCards,sourceFor} from './study.js';
const FIELDS=['id','video_id','title','channel','url','duration','durationText','mode','segments','sections','overview','glossary','usage','parts','winMin','answeredBy','aiJob','workspace','createdAt','updatedAt'];
const ERRORS={format:'Không phải bản sao lưu YT Scenes phiên bản 1.',record:'Bản sao lưu có tài liệu lỗi hoặc trùng id.',
  source:'Nguồn transcript trong bản sao lưu không hợp lệ.',reading:'Vị trí đọc trong bản sao lưu không hợp lệ.',
  draft:'Nguồn của nháp không hợp lệ.',card:'Id thẻ trong bản sao lưu lỗi hoặc trùng.',review:'Lịch ôn trong bản sao lưu không hợp lệ.',
  job:'Đã khôi phục. Bấm Chạy tiếp AI khi bạn muốn tiếp tục.'};
export function backupText(records) {
  return JSON.stringify({format:'ytscenes-backup',version:1,stories:records.map(r=>Object.fromEntries(FIELDS.filter(k=>r[k]!==undefined).map(k=>[k,r[k]])))},null,2);
}
export function readBackup(text) {
  const data=JSON.parse(text);
  if(data.format!=='ytscenes-backup' || data.version!==1 || !Array.isArray(data.stories)) throw Error(ERRORS.format);
  const ids=new Set();
  return data.stories.map(r=>{
    if(typeof r.id!=='string' || !r.id || ids.has(r.id) || !Array.isArray(r.segments) || !r.segments.length)
      throw Error(ERRORS.record);
    ids.add(r.id);
    if(!r.segments.every((s,i)=>s.i===i && typeof s.text==='string' && (s.t==null || Number.isFinite(s.t) && s.t>=0)))
      throw Error(ERRORS.source);
    if(r.workspace) {
      const w=r.workspace, all=[...(w.cards || []),...(w.candidates || []),...(w.archivedDrafts || []),...(w.draft?[w.draft]:[])];
      if(!['story','knowledge'].includes(w.kind) || !Number.isInteger(w.reading?.start) || w.reading.start<0 || w.reading.start>=r.segments.length)
        throw Error(ERRORS.reading);
      const cardIds=new Set();
      for(const c of all) {
        const storedCard=w.cards?.includes(c);
        if(storedCard || w.candidates?.includes(c)) validateCards([c],r.segments,{start:0,end:r.segments.length-1});
        else if(typeof c.question!=='string' || typeof c.answer!=='string' || typeof c.quote!=='string' || !sourceFor(r.segments,c.start,c.end).quote.includes(c.quote))
          throw Error(ERRORS.draft);
        if(typeof c.id!=='string' || !c.id || cardIds.has(c.id)) throw Error(ERRORS.card);
        cardIds.add(c.id);
        if(storedCard && (!['approved','suspended'].includes(c.status) || !Number.isFinite(c.due) || !Number.isFinite(c.interval) || !Array.isArray(c.history)
          || c.version!=null && (!Number.isInteger(c.version) || c.version<0) || c.changes!=null && !Array.isArray(c.changes)))
          throw Error(ERRORS.review);
        if(storedCard && (!c.history.every(e=>e && typeof e.id==='string' && Number.isFinite(e.at) && ['again','remember'].includes(e.grade))
          || (c.changes || []).some(e=>!e || !Number.isFinite(e.at) || !['edit','status'].includes(e.type)
            || e.type==='edit' && (typeof e.before?.question!=='string' || typeof e.before?.answer!=='string' || typeof e.after?.question!=='string' || typeof e.after?.answer!=='string')
            || e.type==='status' && (!['approved','suspended'].includes(e.before) || !['approved','suspended'].includes(e.after)))))
          throw Error(ERRORS.review);
        if(c.editingCardId) {
          const target=w.cards?.find(x=>x.id===c.editingCardId);
          if(!target || !Number.isInteger(c.baseVersion) || c.baseVersion<0 || c.start!==target.start || c.end!==target.end || c.quote!==target.quote)
            throw Error(ERRORS.draft);
        }
      }
    }
    const record=Object.fromEntries(FIELDS.filter(k=>r[k]!==undefined).map(k=>[k,r[k]]));
    // An imported job never starts spending quota merely because the page is reopened.
    if(record.aiJob) record.aiJob={state:'error',message:ERRORS.job};
    return record;
  });
}
