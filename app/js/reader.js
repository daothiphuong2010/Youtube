import { h, fmtTime } from './dom.js';
import { makeBlocks } from './algo.js';
import { STUDY, workspaceOf, changeWorkspace, sourceFor, dueCards, cardsTSV } from './study.js';

// CONFIG
const COPY = {
  modeLabel:'Cách dùng tài liệu', backup:'Sao lưu tài liệu', backupDone:'Đã tạo file sao lưu tài liệu.',
  archive:'Cất nháp này', archived:'Đã cất nháp; có thể khôi phục khi hết nháp đang mở.',
  restore:'Khôi phục nháp vừa cất', retry:'Thử lưu lại nháp', transcript:'Transcript', nextDue:'Lần ôn tới: ',
  progress:(n,total)=>`Phần ${n+1} / ${total}`,
  position:(n)=>`Đang ở câu ${n+1}. Lần sau mở lại sẽ tiếp tục tại đây.`,
  estimated:'Mốc nghe ước tính theo vị trí chữ', exact:'Mốc từ bản chép lời', untimed:'Chưa có mốc nghe; thêm link và thời lượng trong phần công cụ.',
  source:n=>`Câu ${n+1}`, mark:'Đọc tiếp từ đây', listen:'Nghe từ đây',
  reviewing:n=>`Ôn hôm nay · ${n} thẻ đến hạn`, queue:n=>`Còn ${n} gợi ý nháp chờ duyệt`,
  approval:'Đã duyệt; thẻ được xếp lịch ôn.', reviewed:'Đã lưu lượt ôn. Không cần bù các ngày đã nghỉ.',
  noAI:'Không có ý học phù hợp hoặc các gợi ý đã có. Nháp hiện tại được giữ lại.',
  generated:n=>`Đã lưu ${n} gợi ý. Kiểm tra câu hỏi, đáp án và nguồn trước khi duyệt.`,
  busy:'Đang gửi phần này tới AI… Nháp hiện có vẫn được giữ.', sourceTitle:'Nguồn của thẻ',
  draftGuard:'Đang có nháp. Hãy duyệt hoặc sửa nháp hiện tại trước khi tạo nháp khác.',
};

const PERSISTENCE={writes:new Set(),dirty:new Set()};
export async function flushReaderWrites() {
  await Promise.all([...PERSISTENCE.writes]);
  return PERSISTENCE.dirty.size===0;
}
addEventListener('beforeunload',e=>{
  if(PERSISTENCE.dirty.size) {e.preventDefault();e.returnValue='';}
});

export function downloadText(name,text,type='text/plain;charset=utf-8') {
  const url=URL.createObjectURL(new Blob([text],{type}));
  const a=h('a',{href:url,download:name}); a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function renderReader(rec,sents,{save,generate,backup,onKind=()=>{}}) {
  // STATE: all interaction data lives here; DOM is only an output.
  const STATE={workspace:workspaceOf(rec.workspace),pending:0,commands:0,saveFailed:false,error:'',notice:'',busy:false,revealed:null,selectedSource:null,renderedPart:null,renderedKind:null,queue:Promise.resolve()};
  const blocks=makeBlocks(sents);
  const root=h('section',{class:'reader', 'aria-label':STUDY.reader});
  const heading=h('h2',{},STUDY.reader), status=h('p',{class:'muted','role':'status','aria-live':'polite'});
  const backupBtn=h('button',{onclick:async()=>{try{await backup();STATE.notice=COPY.backupDone;}catch(e){STATE.error=e.message;}UI.render();}},COPY.backup);
  const kind=h('select',{'aria-label':COPY.modeLabel,onchange:()=>dispatch({type:'kind',kind:kind.value})},
    h('option',{value:'story'},STUDY.story),h('option',{value:'knowledge'},STUDY.knowledge));
  const choose=h('select',{'aria-label':STUDY.part,onchange:()=>dispatch({type:'reading',start:blocks[+choose.value].start})},
    blocks.map((b,n)=>h('option',{value:n},`${COPY.progress(n,blocks.length)}${sents[b.start]?.t!=null?' · '+fmtTime(sents[b.start].t):''}`)));
  const prev=h('button',{onclick:()=>move(-1)},STUDY.before), next=h('button',{onclick:()=>move(1)},STUDY.next);
  const position=h('p',{class:'muted'}), timing=h('p',{class:'muted'}), text=h('div',{class:'reader-text'});
  const source=h('select',{'aria-label':STUDY.source,onchange:()=>{STATE.selectedSource=+source.value;UI.render();}});
  const create=h('button',{onclick:()=>newDraft()},STUDY.newDraft);
  const ai=h('button',{onclick:()=>suggest()},STUDY.ai);
  const question=h('textarea',{rows:2,maxLength:1000,'aria-label':STUDY.question,oninput:()=>edit()});
  const answer=h('textarea',{rows:3,maxLength:3000,'aria-label':STUDY.answer,oninput:()=>edit()});
  const quote=h('blockquote'), citation=h('div',{class:'muted'}), pending=h('p',{class:'muted'});
  const approve=h('button',{class:'primary',onclick:()=>dispatch({type:'approve'},COPY.approval)},STUDY.approve);
  const archive=h('button',{onclick:()=>dispatch({type:'archive'},COPY.archived)},COPY.archive);
  const restore=h('button',{onclick:()=>dispatch({type:'restoreDraft'})},COPY.restore);
  const retry=h('button',{onclick:()=>STATE.workspace.draft && dispatch({type:'draft',draft:STATE.workspace.draft})},COPY.retry);
  const editor=h('div',{class:'stack study-editor'},h('h3',{},STUDY.draft),
    h('label',{},STUDY.question,question),h('label',{},STUDY.answer,answer),
    h('b',{},COPY.sourceTitle),quote,citation,h('div',{class:'row'},approve,archive));
  const exportBtn=h('button',{onclick:()=>downloadText('yt-scenes-cards.tsv',cardsTSV({...rec,workspace:STATE.workspace},sents),'text/tab-separated-values;charset=utf-8')},STUDY.export);
  const review=h('div',{class:'study-review'}), empty=h('p',{class:'muted'},STUDY.empty);
  const learning=h('section',{'aria-label':STUDY.knowledge,class:'learning stack'},
    h('h2',{},STUDY.knowledge),h('p',{class:'muted'},STUDY.sourceNotice),
    h('label',{},STUDY.source,source),h('div',{class:'row'},create,ai),
    h('p',{class:'muted'},STUDY.aiNotice),pending,empty,editor,restore,retry,review,exportBtn);
  root.append(h('div',{class:'row'},heading,h('span',{class:'grow'}),kind,backupBtn),
    h('div',{class:'reader-nav'},prev,choose,next),position,timing,status,text,learning);

  const partIndex=()=>Math.max(0,blocks.findIndex(b=>STATE.workspace.reading.start<=b.end));
  function move(delta) { const b=blocks[partIndex()+delta]; if(b) dispatch({type:'reading',start:b.start}); }
  function listen(start,label=COPY.listen) {
    const t=sents[start]?.t;
    return rec.video_id && t!=null ? h('a',{class:'go',target:'_blank',rel:'noopener',href:`https://youtu.be/${rec.video_id}?t=${Math.floor(t)}`},`${label} · ${fmtTime(t)}${rec.segments[start]?.t==null?' (ước tính)':''}`) : null;
  }
  async function dispatch(action,notice='') {
    if(STATE.saveFailed && action.type!=='draft') return false;
    // Input remains editable while transactions are serialized; stale saves cannot replace newer typing.
    if(action.type==='draft') STATE.workspace=changeWorkspace(STATE.workspace,action,Date.now());
    if(action.type!=='draft') STATE.commands++;
    STATE.pending++;PERSISTENCE.dirty.add(root); UI.render();
    STATE.queue=STATE.queue.then(async()=>{
      try {
        const w=await save(action);
        STATE.pending--;
        if(action.type!=='draft') STATE.commands--;
        if(!STATE.pending) STATE.workspace=workspaceOf(w);
        STATE.error='';STATE.saveFailed=false; STATE.notice=notice;
        STATE.revealed=null;
        UI.render(); return true;
      } catch(e) { STATE.pending--;if(action.type!=='draft') STATE.commands--; STATE.saveFailed=true; STATE.error=STUDY.saveError+' '+e.message;UI.render();return false; }
    });
    const writing=STATE.queue;
    PERSISTENCE.writes.add(writing);
    writing.finally(()=>{
      PERSISTENCE.writes.delete(writing);
      if(!STATE.pending && !STATE.saveFailed)PERSISTENCE.dirty.delete(root);
    });
    return STATE.queue;
  }
  function edit() {
    if(!STATE.workspace.draft) return;
    dispatch({type:'draft',draft:{...STATE.workspace.draft,question:question.value,answer:answer.value}});
  }
  function newDraft() {
    if(STATE.workspace.draft) { STATE.notice=COPY.draftGuard;UI.render();return; }
    const start=STATE.selectedSource ?? blocks[partIndex()].start;
    dispatch({type:'draft',draft:{id:crypto.randomUUID(),question:'',answer:'',...sourceFor(sents,start,start)}});
  }
  async function suggest() {
    if(STATE.busy) return;
    STATE.busy=true;STATE.notice=COPY.busy;UI.render();
    const b=blocks[partIndex()];
    try {
      const cards=await generate(b);
      await dispatch({type:'candidates',cards:cards.map(c=>({...c,id:crypto.randomUUID()}))},cards.length?COPY.generated(cards.length):COPY.noAI);
    } catch(e) { STATE.error=e.message; }
    finally { STATE.busy=false;UI.render(); }
  }

  // UI: centralized render; source inputs are retained so typing/focus survives persistence.
  const UI={render() {
    const w=STATE.workspace,n=partIndex(),b=blocks[n], knowledge=w.kind==='knowledge';
    kind.value=w.kind;choose.value=String(n);
    kind.disabled=choose.disabled=STATE.pending>0 || STATE.saveFailed;
    backupBtn.disabled=STATE.pending>0 || STATE.saveFailed;
    prev.disabled=STATE.pending>0 || STATE.saveFailed || n===0;next.disabled=STATE.pending>0 || STATE.saveFailed || n===blocks.length-1;
    position.textContent=COPY.progress(n,blocks.length)+' · '+COPY.position(w.reading.start);
    timing.textContent=sents[b.start]?.t==null?COPY.untimed:rec.segments[b.start]?.t==null?COPY.estimated:COPY.exact;
    if(STATE.renderedPart!==n) {
      STATE.renderedPart=n;STATE.selectedSource=b.start;
      text.replaceChildren(...sents.slice(b.start,b.end+1).map((s,k)=>{
        const start=b.start+k;
        return h('div',{class:'reader-paragraph'},h('p',{},s.text),h('div',{class:'row'},listen(start),
          h('button',{class:'mark-position',onclick:()=>dispatch({type:'reading',start})},COPY.mark)));
      }));
      source.replaceChildren(...sents.slice(b.start,b.end+1).map((s,k)=>h('option',{value:b.start+k},`${COPY.source(b.start+k)} · ${s.text.slice(0,90)}`)));
    }
    source.value=String(STATE.selectedSource);
    status.className=STATE.error?'err':'muted';
    status.textContent=STATE.error || (STATE.pending?STUDY.saving:[STUDY.saved,STATE.notice].filter(Boolean).join(' · '));
    learning.hidden=!knowledge;
    if(STATE.renderedKind!==w.kind) {
      STATE.renderedKind=w.kind;
      if(knowledge) root.insertBefore(learning,text);else root.append(learning);
      onKind(w.kind);
    }
    [...text.children].forEach((el,k)=>{el.className='reader-paragraph'+(b.start+k===w.reading.start?' current':'');});
    const d=w.draft;
    editor.hidden=!d;empty.hidden=!!d;
    if(question.value!==(d?.question || '')) question.value=d?.question || '';
    if(answer.value!==(d?.answer || '')) answer.value=d?.answer || '';
    question.disabled=answer.disabled=STATE.commands>0;
    quote.textContent=d?.quote || '';
    citation.replaceChildren(...(d?[`${rec.title || COPY.transcript} · ${COPY.source(d.start)}–${d.end+1} `,listen(d.start)]:[]).filter(Boolean));
    approve.disabled=STATE.pending>0 || STATE.saveFailed || !d?.question?.trim() || !d?.answer?.trim();
    create.disabled=STATE.pending>0 || STATE.saveFailed || !!d;
    archive.disabled=STATE.pending>0 || STATE.saveFailed;
    restore.hidden=!!d || !w.archivedDrafts.length;restore.disabled=STATE.pending>0 || STATE.saveFailed;
    retry.hidden=!STATE.saveFailed || !d;retry.disabled=STATE.pending>0;
    ai.disabled=STATE.busy || STATE.pending>0 || STATE.saveFailed;
    pending.textContent=COPY.queue(w.candidates.length);
    pending.hidden=!w.candidates.length;
    exportBtn.disabled=!w.cards.length || STATE.pending>0;
    const due=dueCards(w,Date.now()),c=due[0];
    review.replaceChildren(h('h3',{},COPY.reviewing(due.length)));
    if(c) {
      review.append(h('p',{class:'review-question'},c.question));
      if(STATE.revealed===c.id) {
        review.append(h('p',{},c.answer),h('blockquote',{},c.quote));
        const link=listen(c.start);if(link)review.append(link);
        review.append(h('div',{class:'row'},...['again','remember'].map(grade=>h('button',{disabled:STATE.pending>0,onclick:()=>dispatch({type:'review',id:c.id,eventId:crypto.randomUUID(),expectedDue:c.due,grade},COPY.reviewed)},STUDY[grade]))));
      } else review.append(h('button',{disabled:STATE.pending>0,onclick:()=>{STATE.revealed=c.id;UI.render();}},STUDY.reveal));
    } else {
      review.append(h('p',{class:'muted'},STUDY.noDue));
      const nextDue=w.cards.filter(c=>c.status==='approved').sort((a,b)=>a.due-b.due)[0];
      if(nextDue) review.append(h('p',{class:'muted'},COPY.nextDue+new Date(nextDue.due).toLocaleString('vi-VN')));
    }
  }};
  UI.render();
  root.dispose=()=>PERSISTENCE.dirty.delete(root);
  return root;
}
