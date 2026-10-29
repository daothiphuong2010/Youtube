// Code-only intro/outro filler detection for the transcript export (no AI).
// Only sentences that start in the first/last EDGE_SEC of the video are looked at, only whole
// sentences are removed, and a sentence that still has real words after the filler phrases are
// taken out is kept (when unsure, keep). Kept text is never edited.

// Glue words that carry no content once the filler phrases are gone.
const GLUE = new Set(['cac','ban','moi','nguoi','ca','nha','em','nhe','oi','da','nay','kenh','video','va','the','and','all','you','this','my','our','of','to','so','ok','okay']);

export const EDGE_SEC = 60, MAX_LEFTOVER_WORDS = 2;

// Matched on lower-case text without diacritics (Vietnamese + English).
const PHRASES = [
  'xin chao', 'chao (?:cac|moi|ca|tat ca|mung)(?: ban| nguoi| nha| em)?', 'chao mung(?: cac ban| moi nguoi| ban)?',
  '(?:da )?(?:quay )?(?:tro )?lai(?: voi)?(?: kenh| video| chuong trinh)?',
  'rat vui (?:khi )?(?:duoc )?(?:gap|chao don|co mat)(?: cac ban| moi nguoi| ban)?',
  '(?:nho |hay |de )?(?:dang ky|subscribe)(?: kenh| cho kenh| ngay)?', '(?:bam|nhan|an|bat) (?:vao )?(?:nut )?chuong(?: thong bao)?',
  'chuong thong bao', '(?:nho |hay |dung quen )?(?:bam |nhan |an |tha )?like', 'share|chia se(?: video)?(?: nay)?(?: cho ban be)?',
  'theo doi(?: kenh)?', 'ung ho(?: kenh| minh| tui)?', 'binh luan(?: ben duoi| phia duoi)?',
  'cam on(?: cac ban| ban| moi nguoi| rat nhieu)?(?: da)?(?: xem| theo doi| lang nghe| dong hanh)?(?: video)?',
  'hen gap lai(?: cac ban| moi nguoi)?(?: trong)?(?: cac)?(?: video| bai viet)?(?: tiep theo| sau| lan sau)?', 'tam biet(?: cac ban| moi nguoi)?',
  'video nay (?:duoc )?(?:tai tro|quang cao)(?: boi)?', 'link (?:o )?(?:duoi|trong) (?:phan )?mo ta',
  'hello(?: everyone| guys| friends| there)?', 'hi(?: everyone| guys| there| all)', 'hey(?: guys| everyone| there)?',
  'welcome(?: back)?(?: to)?(?: the| my| our)?(?: channel| video| show| series)?', 'thanks?(?: you)?(?: so much| very much)?(?: for)?(?: watching| listening| joining| tuning in)?(?: this video| the video)?',
  'subscribe(?: to)?(?: the| my| our)?(?: channel)?', 'hit(?: the)?(?: like| bell| subscribe)(?: button)?', 'smash(?: the)? like(?: button)?',
  'like(?: and| &|,)? (?:share|subscribe|comment)(?: and (?:subscribe|comment|share))?', 'turn on(?: the)?(?: post)? notifications?', 'notification bell',
  'see you(?: all)?(?: in)?(?: the)?(?: next| another| later| soon)?(?: video| time| one)?', 'bye(?:[- ]bye)?', 'goodbye', 'take care',
  'this video is (?:sponsored|brought to you) by', 'sponsored by', 'link (?:is )?in the (?:description|comments)', 'check out the description',
];
const FILLER = new RegExp('\\b(?:' + PHRASES.join('|') + ')\\b', 'g');

export function plain(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
}

// True only when the sentence is filler and nothing else (<= MAX_LEFTOVER_WORDS real words left).
export function isFiller(text) {
  const p = plain(text);
  if (!FILLER.test(p)) { FILLER.lastIndex = 0; return false; }
  FILLER.lastIndex = 0;
  const left = p.replace(FILLER, ' ').split(/[^a-z0-9]+/).filter(w => w.length > 1 && !GLUE.has(w));
  FILLER.lastIndex = 0;
  return left.length <= MAX_LEFTOVER_WORDS;
}

// sents: [{i, t, text}] -> {kept, removed}. duration (seconds) is optional; without it the
// video end is taken as the start time of the last sentence.
export function splitFiller(sents, duration = null) {
  const timed = sents.filter(s => s.t != null);
  if (!timed.length) return { kept: sents, removed: [] };
  const first = timed[0].t, end = Math.max(duration || 0, timed[timed.length - 1].t);
  const kept = [], removed = [];
  for (const s of sents) {
    const edge = s.t != null && (s.t - first < EDGE_SEC || end - s.t < EDGE_SEC);
    (edge && isFiller(s.text) ? removed : kept).push(s);
  }
  return { kept, removed };
}
