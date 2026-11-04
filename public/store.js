/* store.js: شبکه، همگام‌سازی تک‌به‌تکِ بلیت‌ها، دریافت نتایج زنده */
const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ls = { g: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, s: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
const S = { tok: ls.g('tok') || '', me: ls.g('me') || '', bets: [], trash: [], LV: [], SRC: [], at: null, sync: 'idle', prof: null, tg: null };
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function toast(m, ms) { const t = $('#toast'); if (!t) return; t.innerHTML = '<div>' + esc(m) + '</div>'; clearTimeout(toast.t); toast.t = setTimeout(() => (t.innerHTML = ''), ms || 3500); }
async function api(p, o) {
  o = o || {};
  const r = await fetch(BASE + p, { method: o.method || 'GET', keepalive: !!o.keepalive, headers: Object.assign({ 'content-type': 'application/json' }, S.tok ? { authorization: 'Bearer ' + S.tok } : {}), body: o.body === undefined ? undefined : typeof o.body == 'string' ? o.body : JSON.stringify(o.body) });
  let j = {}; try { j = await r.json(); } catch (e) {}
  if (r.status == 401 && S.tok) { const e = new Error(j.error || 'نشست منقضی شد؛ دوباره وارد شوید'); e.u = 1; throw e; }
  if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
  return j;
}
/* ---- ذخیره: فقط تغییرات (up/rm) فرستاده می‌شود؛ دستگاه قدیمی بلیت‌های تازه را پاک نمی‌کند ---- */
let SNAP = {}, busy = 0, again = 0, tmr, fails = 0;
const allRecs = () => S.bets.concat(S.trash);
function setSync(st, msg) {
  S.sync = st; S.syncMsg = msg || '';
  const el = $('#sync'); if (!el) return;
  el.dataset.s = st; el.title = msg || '';
  el.textContent = { ok: 'ذخیره شد', pending: 'در حال ذخیره…', err: 'ذخیره نشد؛ تلاش مجدد', idle: '' }[st];
}
function save() { clearTimeout(tmr); setSync('pending'); tmr = setTimeout(flush, 500); }
async function flush(ka) {
  if (busy) { again = 1; return; }
  const up = [], snap = {}, rm = [];
  for (const r of allRecs()) { const js = JSON.stringify(r); snap[r.id] = js; if (SNAP[r.id] !== js) up.push(r); }
  for (const id in SNAP) if (!(id in snap)) rm.push(id);
  if (!up.length && !rm.length) { setSync(S.sync == 'err' ? 'err' : 'ok'); return; }
  busy = 1;
  try {
    const now = Date.now(); up.forEach((r) => { r.upd = now; snap[r.id] = JSON.stringify(r); });
    await api('/api/data', { method: 'PUT', body: { up, rm }, keepalive: !!ka });
    Object.assign(SNAP, snap); rm.forEach((id) => delete SNAP[id]); fails = 0; setSync('ok');
  } catch (e) {
    fails++; setSync('err', e.message);
    if (e.u) { if (window.showLogin) showLogin(); } else { clearTimeout(tmr); tmr = setTimeout(flush, Math.min(60000, 3000 * fails)); }
  } finally { busy = 0; if (again) { again = 0; flush(); } }
}
const purge = () => { const lim = Date.now() - 30 * 864e5; S.trash = S.trash.filter((r) => r.del > lim); };
async function loadAll() {
  const j = await api('/api/data'); S.bets = []; S.trash = []; SNAP = {};
  for (const r of j.records) { SNAP[r.id] = JSON.stringify(r); (r.del ? S.trash : S.bets).push(r); }
  purge(); setSync('ok');
}
async function pull() { // ادغام تغییرات دستگاه‌های دیگر
  if (busy || S.sync == 'pending' || !S.tok) return;
  const j = await api('/api/data'), srv = new Map(j.records.map((r) => [r.id, r])), loc = new Map(allRecs().map((r) => [r.id, r]));
  let ch = 0; const drop = (id) => { S.bets = S.bets.filter((r) => r.id != id); S.trash = S.trash.filter((r) => r.id != id); };
  for (const [id, r] of srv) {
    const l = loc.get(id), js = JSON.stringify(r);
    if (!l) { if (!(id in SNAP)) { SNAP[id] = js; (r.del ? S.trash : S.bets).push(r); ch = 1; } }
    else if (SNAP[id] === JSON.stringify(l) && SNAP[id] !== js) { drop(id); (r.del ? S.trash : S.bets).push(r); SNAP[id] = js; ch = 1; }
  }
  for (const [id, l] of loc) if (!srv.has(id) && id in SNAP && SNAP[id] === JSON.stringify(l)) { drop(id); delete SNAP[id]; ch = 1; }
  if (ch && window.render) render();
}
/* ---- نتایج زنده ---- */
let needMore = 0;
const needLive = () => S.bets.some((b) => !b.arch && b.legs.some((l) => !l.fin && !l.ov)) || (window.U && U.pubBets && U.pubBets.length);
const legsToWatch = () => S.bets.filter((b) => !b.arch).flatMap((b) => b.legs).filter((l) => !l.fin && !l.ov).concat((window.U && U.pubBets ? U.pubBets : []).flatMap((b) => b.legs));
const unmatched = () => legsToWatch().some((l) => !S.LV.some((e) => Core.mt(l, e)));
async function liveFetch() {
  if (!needLive()) return;
  try {
    const j = await (await fetch(BASE + '/api/live' + (needMore ? '?apif=1' : ''))).json();
    S.LV = j.events || []; S.SRC = j.sources || []; S.at = new Date(); S.liveErr = 0;
    const nm = unmatched(); if (nm && !needMore) { needMore = 1; return liveFetch(); } needMore = nm ? 1 : 0;
  } catch (e) { S.liveErr = 1; }
}
