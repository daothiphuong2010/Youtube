// Story page: header (+ AI panel), search, density chart, scenes (AI) / 5-min blocks (free).
// Timestamps are never shown; every unit, paragraph and search hit links to the video instead.
import { h, usd } from './dom.js';
import { buildIndex, search, highlight } from './search.js';
import { analyze, density } from './algo.js';
import { phraseAlts } from './glossary.js';
import { estimate } from './scenes.js';
import { densityChart } from './chart.js';
import { modeOf } from './modes.js';
import { usesRouter } from './ai-provider.js';
import { renderReader } from './reader.js';

export const videoLink = (rec, t) =>
  rec.video_id && t != null ? `https://youtu.be/${rec.video_id}?t=${Math.max(0, Math.floor(t))}` : null;

// rec = one video record (generic format), sents = its segments with times filled in.
// partial = sections from the AI chunks finished so far (shown while the AI is still running).
// Returns {status, progress, sections, running} so a running AI job can update the page in place.
// people = {blocks, cast, glossary, isName} from names.castFor (characters + their aliases);
// castActions = {hide(name), edit(), ai()} for the character card.
export function renderStory(root, rec, sents, options) {
  const top=header(rec,sents,modeOf(rec),options);
  const content=h('div');
  let explorer=null;
  const tools=h('details',{class:'explorer'},h('summary',{},'Tìm kiếm, mục lục, nhân vật và biểu đồ'),content);
  tools.addEventListener('toggle',()=>{
    if(tools.open && !explorer) explorer=renderExplorer(content,rec,sents,{...options,partial:latest});
  });
  let latest=options.partial;
  root.replaceChildren(top.card,renderReader(rec,sents,{...options.workspace,onKind:top.api.kind}),tools);
  return {...top.api,
    castStatus:t=>explorer?.castStatus(t),
    sections:secs=>{latest=secs;explorer?.sections(secs);},
  };
}

function renderExplorer(root, rec, sents, { settings, people, castActions = {}, runAI, saveMeta, partial = null }) {
  const mode = modeOf(rec), CATS = mode.categories;
  const { cast, glossary, isName } = people;
  let scenes = rec.sections || partial;
  const free = analyze(sents, people.blocks, glossary, 5, isName);
  const blocks = free.blocks;
  // 👤 row: up to 5 characters most mentioned in each block; note where each one first shows up.
  blocks.forEach((b, n) => {
    b.people = cast.filter(c => c.perUnit[n] > 0).sort((x, y) => y.perUnit[n] - x.perUnit[n]).slice(0, 5).map(c => ({ name: c.name, n: c.perUnit[n] }));
    b.newPeople = [];
  });
  for (const c of cast) { const i = c.perUnit.findIndex(x => x > 0); if (i >= 0) blocks[i].newPeople.push(c.name); }
  const castBy = new Map();
  for (const c of cast) for (const n of [c.name, ...c.aliases]) castBy.set(n.toLowerCase(), c);
  const cv = xs => { const m = xs.reduce((a, x) => a + x, 0) / xs.length; return m ? Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length) / m : 0; };
  const castBursty = cast.filter(c => c.total >= 10).sort((a, b) => cv(b.perUnit) - cv(a.perUnit))[0]?.name;
  let index = scenes ? buildIndex(scenes, CATS) : null;
  let tab = scenes ? 'scenes' : 'blocks', q = '', pick = null, userTab = false; // pick = {name, units:[n]}
  let chartTerm = null; // name/keyword clicked to chart; default = most clustered character (else keyword)

  const go = (t, label = '▶ Mở video tại đây') => {
    const href = videoLink(rec, t);
    return href ? h('a', { class: 'go', href, target: '_blank', rel: 'noopener' }, label) : null;
  };
  const marked = text => (q ? highlight(text, q, glossary).map(p => (p.hit ? h('mark', {}, p.text) : p.text)) : text);

  function bodyOf(u, el) {
    for (let k = u.start; k <= u.end; k += 5) {
      const text = sents.slice(k, Math.min(k + 5, u.end + 1)).map(s => s.text).join(' ');
      el.append(h('p', {}, marked(text), ' ', go(sents[k].t, '▶')));
    }
  }

  // Keyword chip inside a scene/block: click = show its density chart (without closing the scene).
  const showChart = text => { chartTerm = text; drawChart(); chartBox.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  const chartChip = (cls, text, title, extra) => h('button', { class: cls + (text === chartTerm ? ' on' : ''),
    title: (title ? title + ' · ' : '') + 'Bấm để xem mật độ trên biểu đồ',
    onclick: e => { e.preventDefault(); e.stopPropagation(); showChart(text); } },
  marked(text), extra != null ? [' ', h('small', {}, extra)] : null);

  function unitEl(u, n, hit) {
    const isScene = tab === 'scenes';
    const body = h('div', { class: 'body' });
    const chips = isScene
      ? [h('div', { class: 'chips' }, u.keywords.map(kw => chartChip('chip c' + Object.keys(CATS).indexOf(kw.category), kw.text, CATS[kw.category])))]
      : [u.people.length ? h('div', { class: 'chips' }, h('span', { class: 'lbl' }, '👤 Nhân vật'), u.people.map(p => chartChip('chip c0', p.name, 'Nhắc ' + p.n + ' lần trong đoạn này', p.n))) : null,
        u.terms.length ? h('div', { class: 'chips' }, h('span', { class: 'lbl' }, '🔑 Từ khóa'), u.terms.map(k => chartChip('chip', k))) : null];
    const news = isScene ? [] : [...u.newPeople.map(n => '👤 ' + n), ...u.firsts];
    const d = h('details', { class: 'scene', id: tab + '-' + n },
      h('summary', {},
        h('div', { class: 'row' }, h('span', { class: 'num' }, isScene ? `#${n + 1}` : `Đoạn ${n + 1}`),
          isScene ? h('span', { class: 'title' }, marked(u.title)) : null, h('span', { class: 'grow' }), go(sents[u.start].t)),
        chips,
        isScene ? h('div', { class: 'one' }, marked(u.summary)) : null,
        news.length ? h('div', { class: 'new' }, '🆕 Lần đầu xuất hiện: ' + news.join(', ')) : null,
        hit?.snippet && !hit.kw ? h('div', { class: 'snippet' }, marked(hit.snippet), ' ', go(sents[hit.sent].t, '▶')) : null),
      body);
    d.addEventListener('toggle', () => { if (d.open && !body.childElementCount) bodyOf(u, body); });
    return d;
  }

  const list = h('div'), count = h('p', { class: 'muted' }), idxBox = h('div'), chartBox = h('div'), tabsBox = h('div', { class: 'tabs' });

  function draw() {
    const units = tab === 'scenes' ? scenes : blocks;
    let rows = q.trim() ? search(q, units, sents, glossary) : units.map((_, n) => ({ n }));
    if (pick && pick.tab === tab) rows = rows.filter(r => pick.units.includes(r.n));
    const open = new Set([...list.querySelectorAll('details[open]')].map(d => d.id)); // keep what you were reading
    list.replaceChildren(...rows.map(r => unitEl(units[r.n], r.n, r)));
    for (const d of list.querySelectorAll('details')) if (open.has(d.id)) d.open = true;
    count.textContent = (q.trim() || pick) ? `${rows.length}/${units.length} khớp` + (pick ? ` · lọc: ${pick.name}` : '')
      : `${units.length} ${tab === 'scenes' ? mode.unit : 'đoạn ~5 phút'}`;
    drawChart(); drawIndex(); drawTabs();
  }

  function drawChart() {
    const auto = !q.trim() && !chartTerm;
    let term = q.trim() || chartTerm || castBursty || free.bursty[0] || free.top[0];
    if (!term) return chartBox.replaceChildren();
    const person = castBy.get(term.toLowerCase());
    if (person) term = person.name;
    const counts = person ? person.perUnit : density(sents, blocks, phraseAlts(term, glossary));
    chartBox.replaceChildren(h('div', { class: 'muted' }, `Mật độ ${person ? '👤 ' : ''}"${term}" dọc theo video`,
      auto ? (person ? ' (tự chọn nhân vật xuất hiện theo từng đợt rõ nhất)' : ' (tự chọn từ khóa nổi bật nhất)') : '', ' · bấm cột để mở đoạn đó, bấm từ khóa bất kỳ để đổi',
      chartTerm && !q.trim() ? h('button', { class: 'chip', onclick: () => { chartTerm = null; drawChart(); } }, '↺ mặc định') : null),
      densityChart(counts, { label: term, onPick: i => { tab = 'blocks'; q = ''; input.value = ''; pick = null; draw();
        const el = document.getElementById('blocks-' + i); if (el) { el.open = true; el.scrollIntoView({ block: 'center' }); } } }));
  }

  function chip(cls, name, units, n) {
    const on = pick && pick.name === name && pick.tab === tab;
    return h('button', { class: 'chip ' + cls + (on ? ' on' : ''), onclick: () => { pick = on ? null : { tab, name, units }; chartTerm = on ? null : name; draw(); } },
      name, ' ', h('small', {}, n));
  }

  function drawIndex() {
    if (tab === 'scenes') {
      idxBox.replaceChildren(...Object.entries(CATS).filter(([cat]) => index[cat].length).map(([cat, label], i) =>
        h('details', { open: i < 2 }, h('summary', {}, `${label} (${index[cat].length})`),
          h('div', { class: 'chips' }, index[cat].slice(0, 60).map(e => chip('c' + i, e.name, e.units, e.units.length))))));
    } else {
      idxBox.replaceChildren(h('div', { class: 'chips' }, free.top.slice(0, 40).map(k => {
        const units = blocks.map((b, n) => (b.terms.includes(k) ? n : -1)).filter(n => n >= 0);
        return chip('', k, units, units.length);
      })));
    }
  }

  function drawTabs() {
    tabsBox.replaceChildren(...[
      scenes ? h('button', { class: tab === 'scenes' ? 'on' : '', onclick: () => { tab = 'scenes'; userTab = true; draw(); } }, `🎬 ${mode.unit[0].toUpperCase() + mode.unit.slice(1)} (AI) · ${scenes.length}`) : null,
      h('button', { class: tab === 'blocks' ? 'on' : '', onclick: () => { tab = 'blocks'; userTab = true; draw(); } }, `⏱ Đoạn 5 phút (miễn phí) · ${blocks.length}`)].filter(Boolean)); // null would render as text
  }

  const input = h('input', { type: 'search', placeholder: '🔎 Tìm nhân vật, sức mạnh, địa điểm, hoặc bất kỳ chữ nào… (gõ không dấu cũng được)',
    oninput: () => { q = input.value; clearTimeout(input._t); input._t = setTimeout(draw, 150); } });

  // Character index: the core of the page. Click a name = chart it across the video.
  const castStatus = h('div', { class: 'muted' });
  const castRow = c => h('li', {},
    h('button', { class: 'chip c0', title: 'Xem mật độ trên biểu đồ', onclick: () => showChart(c.name) }, c.name),
    c.role ? h('span', {}, ' ' + c.role) : null,
    h('span', { class: 'muted' }, ` · ${c.total} lần${c.auto ? ' · tự dò' : ''}${c.aliases.length ? ' · còn gọi: ' + c.aliases.slice(0, 4).join(', ') : ''} `),
    castActions.hide ? h('button', { class: 'x', title: 'Không phải nhân vật: ẩn tên này', onclick: () => castActions.hide(c.name) }, '✕') : null);
  const castCard = h('div', { class: 'card stack' },
    h('div', { class: 'row' }, h('b', {}, `👤 Nhân vật (${cast.length})`), h('span', { class: 'grow' }),
      castActions.edit ? h('button', { onclick: () => castActions.edit() }, '✏️ Sửa danh sách') : null,
      castActions.ai ? h('button', { title: 'Gửi vài đoạn trích cho Gemini, 1 lượt gọi', onclick: () => castActions.ai() }, '✨ Lập danh sách nhân vật') : null),
    cast.length ? h('ul', { class: 'cast' }, cast.slice(0, 12).map(castRow)) : h('p', { class: 'muted' },
      'Chưa tìm thấy tên nào (phụ đề tự động hay viết thường hết). Bấm ✨ để AI lập danh sách (1 lượt), hoặc ✏️ để tự thêm.'),
    cast.length > 12 ? h('details', {}, h('summary', {}, `Xem thêm ${cast.length - 12} tên`), h('ul', { class: 'cast' }, cast.slice(12).map(castRow))) : null,
    castStatus);

  root.replaceChildren(
    castCard,
    h('div', { class: 'search' }, input, count),
    h('div', { class: 'card' }, chartBox),
    tabsBox,
    h('div', { class: 'card' }, h('b', {}, 'Mục lục từ khóa'), h('span', { class: 'muted' }, ' — bấm để lọc'), idxBox),
    list);
  draw();
  return {
    castStatus: t => { castStatus.textContent = t; },
    // New AI chunk done: show its scenes now (switch to them once, unless you picked a tab).
    sections(secs) {
      if (!secs || rec.sections) return;
      scenes = secs; index = buildIndex(scenes, CATS);
      if (tab === 'blocks' && !userTab) tab = 'scenes';
      if (tab === 'scenes') draw(); else drawTabs();
    },
  };
}

function header(rec, sents, mode, { settings, runAI, saveMeta }) {
  const { overview, usage } = rec, V = mode.verdict;
  const card = h('div', { class: 'card stack' },
    h('div', { class: 'row' },
      overview ? h('div', { class: 'score', title: V.score }, overview.score) : null,
      h('div', { class: 'grow' }, h('h1', {}, rec.title || 'Không có tiêu đề'),
        h('div', { class: 'muted' }, rec.channel || '', rec.video_id ? [rec.channel ? ' · ' : '', h('a', { href: 'https://youtu.be/' + rec.video_id, target: '_blank', rel: 'noopener' }, 'YouTube')] : null))),
    overview?.why ? h('p', {}, h('b', {}, V.why + ': '), overview.why) : null,
    overview?.plot?.length ? h('details', {}, h('summary', {}, V.lines), h('ol', { class: 'plot' }, overview.plot.map(l => h('li', {}, l)))) : null);
  const tools=h('details',{},h('summary',{},'Xử lý AI và thông tin video'));
  card.append(tools);
  if(usage) tools.append(h('p',{class:'muted'},`AI đã dùng ${(usage.inTok || 0).toLocaleString()} token vào · ${(usage.outTok || 0).toLocaleString()} ra. Chi phí ước tính theo cấu hình; chưa xác nhận hóa đơn.`));

  if (!rec.video_id) {
    const link = h('input', { placeholder: 'Link video YouTube (để có nút Mở video)', value: rec.url || '' });
    const dur = h('input', { placeholder: 'Thời lượng, vd 20:15:00', value: rec.durationText || '' });
    tools.append(h('div', { class: 'fields' }, link, dur, h('button', { onclick: () => saveMeta(link.value, dur.value) }, 'Lưu')));
  }
  // Which AI is answering: a small badge, plus a hidden-by-default list of the model per chunk.
  const badge = h('span', { class: 'badge', hidden: true });
  const byList = h('ol', { class: 'muted' });
  const by = h('details', { hidden: !rec.answeredBy?.length }, h('summary', { class: 'muted' }, 'Model đã trả lời từng phần'), byList);
  const fillBy = list => {
    by.hidden = !list?.some(Boolean);
    byList.replaceChildren(...(list || []).map((x, n) => h('li', {}, x ? `${x.via === 'router' ? 'FreeLLMAPI' : 'Gemini/key trực tiếp'} · ${x.model || '?'}` : '—')));
  };
  fillBy(rec.answeredBy);
  tools.append(h('div', { class: 'row' }, badge), by);
  const api = {
    kind:kind=>{tools.hidden=kind==='knowledge';},
    status() {}, progress() {}, running() {}, paused() {},
    route(via, why) {
      badge.hidden = false;
      badge.textContent = via === 'router' ? 'FreeLLMAPI' : `Key trực tiếp: ${settings.provider} · ${settings.model}`;
      badge.title = why || '';
      badge.className = 'badge' + (via === 'router' ? ' ok' : '');
    },
    answered: fillBy,
  };
  if (!rec.sections) {
    const est = estimate(sents, { ...settings, winMin: rec.winMin || settings.winMin });
    const status = h('div', { class: 'muted' }), ptext = h('div', { class: 'muted' });
    const bar = h('div'), prog = h('div', { class: 'progress', hidden: true }, bar);
    const btn = h('button', { class: 'primary', onclick: () => runAI() }, rec.parts ? 'Chạy tiếp AI' : `Chia ${mode.unit} + chấm điểm bằng AI`);
    const now = h('button', { hidden: rec.aiJob?.state !== 'day', title: 'Bỏ qua bộ đếm lượt/ngày trong máy và thử gửi ngay (nếu Google còn lượt thì chạy tiếp)',
      onclick: () => runAI({ ignoreDay: true }) }, 'Thử ngay');
    const time = usesRouter(settings) ? (settings.aiRoute === 'router' ? 'chỉ qua FreeLLMAPI trên máy bạn' : 'qua FreeLLMAPI trên máy bạn (máy tắt hoặc lỗi thì tự dùng Gemini)')
      : est.days > 1
      ? `khoảng ${est.days} ngày (hạn mức ${settings.rpd} lượt/ngày; trang tự chạy tiếp khi có lượt mới)`
      : `khoảng ${est.minutes} phút`;
    tools.append(h('div', { class: 'stack' },
      h('div', {}, `AI: ${est.requests} lượt gọi ${usesRouter(settings) ? settings.routerModel : settings.model}, ${time} · chi phí `,
        h('b', {}, usesRouter(settings) ? 'chưa rõ qua router' : settings.free ? '$0 theo cấu hình gói miễn phí' : '≈ ' + usd(est.usd)),
        ' (ước tính theo cấu hình; chưa xác nhận hóa đơn)'),
      settings.apiKey || usesRouter(settings) && settings.routerToken ? null : h('p', { class: 'err' }, 'Chưa có key AI → bấm ⚙️ Cài đặt (hướng dẫn lấy key Gemini miễn phí trong README). Phần miễn phí bên dưới vẫn dùng được.'),
      settings.free ? h('p', { class: 'note' }, 'Lưu ý: ở gói miễn phí, Google có thể dùng nội dung gửi lên để cải thiện sản phẩm. Đừng dùng cho tài liệu riêng tư.') : null,
      h('p', { class: 'note' }, '⏳ Trong lúc AI chạy, giữ tab này mở (để ở nền cũng được). Lỡ đóng thì lần sau mở trang sẽ tự chạy tiếp, phần đã xong không làm lại. Cảnh hiện dần ngay khi từng phần xong.'),
      rec.parts ? h('p', { class: 'muted' }, `Đã xong ${rec.parts.filter(Boolean).length} phần lần trước, chạy tiếp không làm lại.`) : null,
      h('div', { class: 'row' }, btn, now), prog, ptext, status));
    Object.assign(api, {
      status: t => { status.textContent = t; },
      progress: (done, total, eta) => { prog.hidden = false; bar.style.width = (100 * done / total) + '%'; ptext.textContent = `Đã xong ${done}/${total} lượt · ${eta}`; },
      running: on => { btn.disabled = on; now.hidden = on || now.hidden; },
      paused: () => { now.hidden = false; },
    });
  }
  return { card, api };
}
