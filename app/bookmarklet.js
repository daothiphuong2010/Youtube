/* YT Scenes bookmarklet. The page turns this file into a javascript: link
   (filling in its own address). This is the ONLY code that touches
   YouTube, so when YouTube changes, only this file needs fixing.
   Order: 1) caption file via the player (fast, silent), 2) YouTube's own
   "Show transcript" panel (opened automatically, scrolled to load everything). */
(async () => {
  const APP = '__APP__';
  const vid = new URLSearchParams(location.search).get('v');
  if (!/(^|\.)youtube\.com$/.test(location.hostname) || !vid) {
    alert('Hãy mở một video YouTube (trang có ?v=...) rồi bấm lại.'); return;
  }
  const win = window.open(APP + '#yt', 'ytscenes');
  if (!win) { alert('Trình duyệt chặn cửa sổ mới. Cho phép pop-up cho youtube.com rồi bấm lại.'); return; }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;z-index:99999;top:70px;right:16px;max-width:320px;padding:12px 14px;border-radius:10px;background:#1b1b1f;color:#fff;font:14px/1.4 sans-serif;box-shadow:0 4px 20px #0006';
  document.body.appendChild(box);
  const say = t => { box.textContent = 'YT Scenes: ' + t; };
  const TS = /^\d{1,3}:\d{2}(?::\d{2})?$/;
  // Times can leak into text both as "27:36" and spoken "27 phút, 36 giây" — strip both.
  const STRIP = t => (t || '').replace(/(?:\d+\s*(?:giờ|tiếng|hours?)\s*,?\s*)?(?:\d+\s*(?:phút|minutes?)\s*,?\s*)?\d+\s*(?:giây|seconds?)/gi, ' ')
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ').replace(/\s+/g, ' ').trim();
  const clock = t => (t || '').trim().split(':').reduce((a, b) => a * 60 + (+b || 0), 0);

  async function viaCaptionFile() {
    const pr = document.querySelector('#movie_player')?.getPlayerResponse?.() || window.ytInitialPlayerResponse;
    if (pr?.videoDetails?.videoId && pr.videoDetails.videoId !== vid) return [];
    const tracks = pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    const tr = tracks.find(t => t.languageCode === 'vi') || tracks[0];
    if (!tr) return [];
    const r = await fetch(tr.baseUrl + '&fmt=json3', { credentials: 'include' });
    const j = await r.json().catch(() => null);
    return (j?.events || []).filter(e => e.segs)
      .map(e => ({ t: Math.floor((e.tStartMs || 0) / 1000), text: e.segs.map(s => s.utf8 || '').join('').replace(/\s+/g, ' ').trim() }))
      .filter(c => c.text);
  }

  function deep(root, out = []) {
    if (!root || root.nodeType !== 1) return out;
    out.push(root);
    for (const k of root.children) deep(k, out);
    if (root.shadowRoot) for (const k of root.shadowRoot.children) deep(k, out);
    return out;
  }
  function panelCues() {
    const cues = [];
    for (const p of document.querySelectorAll('ytd-engagement-panel-section-list-renderer')) {
      for (const el of deep(p)) {
        const tag = el.tagName.toLowerCase();
        let ts, tx;
        if (tag === 'transcript-segment-view-model') {
          ts = el.querySelector('.ytwTranscriptSegmentViewModelTimestamp');
          tx = el.querySelector('span[role="text"]') || el.querySelector('.ytAttributedStringHost');
        } else if (tag === 'ytd-transcript-segment-renderer') {
          ts = el.querySelector('.segment-timestamp');
          tx = el.querySelector('.segment-text');
        } else continue;
        const text = STRIP(tx ? tx.textContent : el.innerText);
        const tsText = ts ? ts.textContent : ((el.innerText || '').match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/) || [''])[0];
        if (tsText && text) cues.push({ t: clock(tsText), text });
      }
      if (cues.length) return { panel: p, cues };
    }
    return { panel: null, cues };
  }
  const norm = t => (t || '').replace(/\s+/g, ' ').trim().toLowerCase();
  function findButton(re) {
    const els = [...document.querySelectorAll('button, a, tp-yt-paper-button, ytd-button-renderer, yt-chip-cloud-chip-renderer, chip-view-model')];
    const hit = els.filter(b => re.test(norm(b.getAttribute('aria-label'))) || re.test(norm(b.textContent)));
    const el = hit.find(b => b.offsetParent !== null) || hit[0];
    return el && el.tagName.includes('-') ? (el.querySelector('button, a') || el) : el;
  }
  async function viaPanel() {
    let found = panelCues();
    if (!found.cues.length) {
      const SHOW = /^(show transcript|hiện bản chép lời|xem bản chép lời|hiển thị bản chép lời)$/;
      const direct = () => document.querySelector('ytd-video-description-transcript-section-renderer button');
      let btn = direct() || findButton(SHOW);
      if (!btn) {
        const more = document.querySelector('ytd-text-inline-expander #expand') ||
          findButton(/^(\.\.\.|…)?\s*(more|thêm|xem thêm|hiện thêm)$/);
        if (more) { more.click(); await sleep(1200); }
        btn = direct() || findButton(SHOW);
      }
      if (!btn) throw new Error('không thấy nút "Hiện bản chép lời" (video có thể không có phụ đề)');
      btn.click();
      for (let i = 0; i < 60 && !found.cues.length; i++) { await sleep(300); found = panelCues(); }
      const chip = findButton(/^(transcript|bản chép lời)$/);
      if (!found.cues.length && chip) { chip.click(); for (let i = 0; i < 30 && !found.cues.length; i++) { await sleep(300); found = panelCues(); } }
      if (!found.cues.length) throw new Error('bảng bản chép lời mở ra nhưng trống');
    }
    // Load everything: the list may lazy-load or virtualize, so collect while scrolling.
    const all = new Map();
    const add = cs => cs.forEach(c => all.set(c.t + '|' + c.text, c));
    add(found.cues);
    const sc = deep(found.panel).filter(e => e.scrollHeight > e.clientHeight + 50 && e.clientHeight > 100)
      .sort((a, b) => a.clientHeight - b.clientHeight)[0];
    if (sc) {
      for (let i = 0, still = 0; i < 4000 && still < 8; i++) {
        const before = all.size, top = sc.scrollTop;
        sc.scrollTop = top + sc.clientHeight * 0.9;
        await sleep(sc.scrollTop === top ? 400 : 60);
        add(panelCues().cues);
        still = all.size === before && sc.scrollTop === top ? still + 1 : 0;
        if (i % 20 === 0) say(`đang tải bản chép lời… ${all.size} dòng`);
      }
    }
    return [...all.values()].sort((a, b) => a.t - b.t);
  }

  try {
    say('đang lấy bản chép lời…');
    let cues = await viaCaptionFile().catch(() => []);
    if (cues.length < 5) cues = await viaPanel();
    const meta = {
      videoId: vid, url: 'https://youtu.be/' + vid,
      duration: +(document.querySelector('#movie_player')?.getPlayerResponse?.()?.videoDetails?.lengthSeconds) || null,
      title: (document.querySelector('ytd-watch-metadata h1')?.textContent || document.title.replace(/ - YouTube$/, '')).trim(),
      channel: (document.querySelector('ytd-watch-metadata ytd-channel-name a, #owner ytd-channel-name a')?.textContent || '').trim(),
    };
    const msg = { type: 'ytscenes:transcript', nonce: Date.now() + Math.random(), meta, segments: cues };
    const origin = new URL(APP).origin;
    let acked = false;
    addEventListener('message', e => { if (e.origin === origin && e.data?.type === 'ytscenes:ack') acked = true; });
    say(`đã lấy ${cues.length} dòng, đang gửi sang trang…`);
    for (let i = 0; i < 120 && !acked; i++) { win.postMessage(msg, origin); await sleep(500); }
    say(acked ? 'xong ✓ — xem ở tab YT Scenes.' : 'không gửi được. Tab YT Scenes có đang mở không?');
  } catch (e) {
    say('lỗi: ' + e.message + '. Cách khác: tự mở bản chép lời, copy, kéo thả file .txt vào trang.');
  }
  setTimeout(() => box.remove(), 8000);
})();
