// Local storage: settings in localStorage (small); every video record in one IndexedDB
// store ("ytscenes"/"stories"), so search can later span all processed videos.
import { PRESETS, DEFAULT_PRESET } from './ai.js';

const SKEY = 'ytscenes.settings';

export function loadSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(SKEY) || '{}'); } catch { /* ignore */ }
  const preset = s.preset || DEFAULT_PRESET;
  return { ...PRESETS[preset], preset, apiKey: '', ...s };
}

export function saveSettings(s) {
  try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch { /* ignore */ }
}

let dbp;
function db() {
  dbp ??= new Promise((ok, bad) => {
    const r = indexedDB.open('ytscenes', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('stories', { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => bad(r.error);
  });
  return dbp;
}

async function tx(mode, fn) {
  const d = await db();
  return new Promise((ok, bad) => {
    const t = d.transaction('stories', mode);
    const req = fn(t.objectStore('stories'));
    t.oncomplete = () => ok(req?.result);
    t.onerror = () => bad(t.error);
  });
}

export const getStory = id => tx('readonly', st => st.get(id));
export const putStory = story => tx('readwrite', st => st.put(story));
export const deleteStory = id => tx('readwrite', st => st.delete(id));
export async function listStories() {
  const all = await tx('readonly', st => st.getAll());
  return (all || []).filter(r => r.segments).map(({ id, title, channel, mode, overview, updatedAt, sections }) =>
    ({ id, title, channel, mode, overview, updatedAt, nSections: sections?.length || 0 }))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

// Stable id: YouTube video id, else a hash of the text.
export function storyId(videoId, text) {
  if (videoId) return 'yt:' + videoId;
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return 'txt:' + (h >>> 0).toString(36) + ':' + text.length;
}
