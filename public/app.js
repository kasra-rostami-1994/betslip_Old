/* app.js: مسیریابی، اکشن‌ها، زمان‌بندی نتایج، راه‌اندازی */
const VER = '2.0.0';
const ent = new URLSearchParams(location.search);
U.entry = ent.get('s') ? { tab: 'share', t: ent.get('s') } : ent.get('u') ? { tab: 'u', u: ent.get('u') } : null;
function route() {
  const h = location.hash.replace(/^#\/?/, ''), p = h.split('/'), ok = ['bets', 'risk', 'hist', 'stats', 'board', 'me', 'trash', 'u', 'compare'];
  if (!h) { if (U.entry) { U.tab = U.entry.tab; U.uname = U.entry.u; return; } U.tab = S.tok ? 'bets' : 'board'; return; }
  U.tab = ok.includes(p[0]) ? p[0] : 'bets';
  if (p[0] === 'compare') { U.cuser1 = p[1]; U.cuser2 = p[2]; }
  else { U.uname = p[1]; }
  if (!S.tok && !['board', 'u', 'compare'].includes(U.tab)) U.tab = 'board';
}
async function enter() { // بارگیری داده‌های هر صفحه
  U.pubBets = null;
  try {
    if (U.tab == 'board' && !U.board) { U.board = (await api('/api/profile?board=1')).rows; if (S.me) U.rank = (U.board.findIndex((r) => r.u == S.me) + 1) || null; render(); }
    if (U.tab == 'me' && S.tok) { S.prof = (await api('/api/profile?fresh=1')).profile; const b = (await api('/api/profile?board=1')).rows; U.rank = (b.findIndex((r) => r.u == S.me) + 1) || null; render(); }
    if (U.tab == 'u') { U.pu = null; render(); try { U.pu = await api('/api/profile?u=' + encodeURIComponent((U.uname || '').toLowerCase())); U.pubBets = U.pu.bets; } catch (e) { U.pu = { err: 1 }; } render(); await liveFetch(); render(); }
    if (U.tab == 'share') { try { U.share = await api('/api/share?t=' + encodeURIComponent(U.entry.t)); U.pubBets = [U.share.bet]; } catch (e) { U.share = { err: 1 }; } render(); await liveFetch(); render(); }
    if (U.tab == 'compare') {
      U.cpu1 = null; U.cpu2 = null;
      try { U.cpu1 = await api('/api/profile?u=' + encodeURIComponent((U.cuser1 || '').toLowerCase())); } catch (e) { U.cpu1 = { err: 1 }; }
      try { U.cpu2 = await api('/api/profile?u=' + encodeURIComponent((U.cuser2 || '').toLowerCase())); } catch (e) { U.cpu2 = { err: 1 }; }
      render(); await liveFetch(); render();
    }
  } catch (e) { toast(e.message); }
}
const go = (v) => { U.entry = null; if (location.hash === '#/' + v) { route(); enter(); render(); } else location.hash = '#/' + v; };
window.addEventListener('hashchange', () => { U.entry = null; U.sel = null; route(); enter(); render(); scrollTo(0, 0); });
/* ---- اکشن‌ها ---- */
const keepOpen = () => ls.s('open', JSON.stringify([...U.open]));
const refresh = () => (U.tab == 'bets' || U.tab == 'hist' ? renderList() : render());
const ACT = {
  go: (a) => go(a.dataset.v), login: () => showLogin(), add: () => openEditor(null),
  menu: (a, e) => { const m = $('#menu'); if (!m.hidden) { m.hidden = true; return; } m.innerHTML = [['me', 'پروفایل من'], ['stats', 'آمار'], ['trash', 'سطل زباله (' + S.trash.length + ')'], ['-'], ['exp', 'خروجی JSON'], ['imp', 'ورود JSON'], ['bak', 'پشتیبان‌های روزانه'], ['tg', 'اعلان و ربات تلگرام'], ['-'], ['out', 'خروج']].map(([k, v]) => (k == '-' ? '<hr>' : `<a data-a="${['me', 'stats', 'trash'].includes(k) ? 'go' : k}" data-v="${k}">${v}</a>`)).join(''); m.hidden = false; e.stopPropagation(); },
  tog: (a, e) => { if (e.target.closest('input,select,button,a')) return; const id = a.dataset.id; U.open.has(id) ? U.open.delete(id) : U.open.add(id); keepOpen(); refresh(); },
  ck: (a) => { const id = a.dataset.id; U.sel.has(id) ? U.sel.delete(id) : U.sel.add(id); bulk(); },
  ed: (a) => openEditor(B(a.dataset.id)), co: (a) => openCo(B(a.dataset.id)),
  ov: (a, e) => { e.preventDefault(); openOv(B(a.dataset.id), a.dataset.l); }, map: (a, e) => { e.preventDefault(); openMap(B(a.dataset.id).legs[a.dataset.l]); },
  ar: (a) => { const b = B(a.dataset.id), s = R.st.get(b.id); if (!s.won && !s.lost && !confirm('هنوز تمام نشده؛ بایگانی شود؟')) return; b.arch = Date.now(); b.sett = Date.now(); b.res = s.lost ? 'lost' : s.won ? 'won' : 'open'; delete b.keep; save(); render(); },
  un: (a) => { const b = B(a.dataset.id); ['arch', 'res', 'auto', 'sett'].forEach((k) => delete b[k]); b.keep = 1; save(); render(); },
  del: (a) => { const b = B(a.dataset.id); S.bets = S.bets.filter((x) => x !== b); b.del = Date.now(); S.trash.push(b); save(); toast('بلیت به سطل زباله رفت', 8000, { a: 'rs', id: b.id, label: 'انجام نشد' }); render(); },
  sh: (a) => copy(lnk(B(a.dataset.id).share)),
  cls: (a) => { U.cls = U.cls == a.dataset.v ? '' : a.dataset.v; render(); },
  fg: (a) => { const k = a.dataset.v; U.fil = { g: k, n: a.dataset.n }; S.bets.filter((b) => b.legs.some((l) => Core.gk(l) == k)).forEach((b) => U.open.add(b.id)); keepOpen(); go('bets'); },
  fb: (a) => { U.fil = { b: a.dataset.v, n: a.dataset.n }; U.open.add(a.dataset.v); keepOpen(); go('bets'); },
  nf: () => { U.fil = null; render(); }, sel: () => { U.sel = U.sel ? null : new Set(); render(); },
  'col-all': () => { U.open.clear(); keepOpen(); render(); },
  'exp-all': () => { (U.tab == 'hist' ? S.bets.filter(b => b.arch) : S.bets.filter(b => !b.arch)).forEach(b => U.open.add(b.id)); keepOpen(); render(); },
  'bk-off': () => { U.sel = null; render(); }, 'bk-all': () => { const t = U.tab == 'hist'; S.bets.filter((b) => !!b.arch == t).forEach((b) => U.sel.add(b.id)); render(); },
  'bk-ar': () => { const bs = S.bets.filter((b) => U.sel.has(b.id)); if (!bs.length) return; if (bs.some((b) => !R.st.get(b.id).won && !R.st.get(b.id).lost) && !confirm('بعضی از بلیت‌ها هنوز تمام نشده‌اند؛ همه بایگانی شوند؟')) return; bs.forEach((b) => { const s = R.st.get(b.id); b.arch = Date.now(); b.sett = b.arch; b.res = s.lost ? 'lost' : s.won ? 'won' : 'open'; delete b.keep; }); U.sel = null; save(); render(); },
  'bk-un': () => { S.bets.filter((b) => U.sel.has(b.id)).forEach((b) => { ['arch', 'res', 'auto', 'sett'].forEach((k) => delete b[k]); b.keep = 1; }); U.sel = null; save(); render(); },
  'bk-del': () => { const bs = S.bets.filter((b) => U.sel.has(b.id)); if (!bs.length) return; const ids = bs.map((b) => b.id); bs.forEach((b) => { b.del = Date.now(); S.trash.push(b); }); S.bets = S.bets.filter((b) => !b.del); U.sel = null; save(); toast(bs.length + ' بلیت به سطل زباله رفت', 10000, { a: 'bk-undo', ids: ids.join(','), label: 'انجام نشد' }); render(); },
  rs: (a) => { const b = S.trash.find((x) => x.id == a.dataset.id); S.trash = S.trash.filter((x) => x !== b); delete b.del; S.bets.push(b); save(); render(); },
  'bk-undo': (a) => { const ids = (a.dataset.ids || '').split(',').filter(Boolean); let restored = 0; ids.forEach((id) => { const b = S.trash.find((x) => x.id == id); if (b) { S.trash = S.trash.filter((x) => x !== b); delete b.del; S.bets.push(b); restored++; } }); if (restored) { save(); render(); toast(restored + ' بلیت بازیابی شد'); } },
  pd: (a) => { if (!confirm('برای همیشه حذف شود؟')) return; S.trash = S.trash.filter((x) => x.id != a.dataset.id); save(); render(); },
  emp: () => { if (!confirm('سطل خالی شود؟')) return; S.trash = []; save(); render(); },
  exp: () => exportJson(), imp: () => $('#fi').click(), bak: () => openBackup(), tg: () => openTg(),
  out: async () => { try { await api('/api/auth', { method: 'POST', body: { action: 'logout' } }); } catch (e) {} ['tok', 'me'].forEach((k) => ls.s(k, '')); S.tok = ''; S.me = ''; S.bets = []; S.trash = []; S.prof = null; SNAP = {}; U.entry = null; location.hash = '#/board'; route(); render(); showLogin(); },
  saveprof: async () => { try { const j = await api('/api/profile', { method: 'PUT', body: { name: $('#pf-name').value, bio: $('#pf-bio').value, pub: $('#pf-pub').checked, dvis: $('#pf-vis').value } }); S.prof = j.profile; U.board = null; toast('پروفایل ذخیره شد'); render(); } catch (e) { toast(e.message); } },
  copyprof: () => copy(location.origin + BASE + '/?u=' + S.me),
  compare: (a) => go('compare/' + encodeURIComponent(a.dataset.u1) + '/' + encodeURIComponent(a.dataset.u2)),
  pass: async () => { try { await api('/api/auth', { method: 'POST', body: { action: 'passwd', pass: $('#pw-old').value, npass: $('#pw-new').value } }); $('#pw-old').value = ''; $('#pw-new').value = ''; toast('رمز تغییر کرد'); } catch (e) { toast(e.message); } },
};
document.addEventListener('click', (e) => {
  const m = $('#menu'); if (m && !m.hidden && !e.target.closest('#menu')) m.hidden = true;
  const a = e.target.closest('[data-a]'); if (!a || /^(SELECT|TEXTAREA)$/.test(a.tagName) || (a.tagName == 'INPUT' && a.type != 'checkbox') || a.dataset.a == 'vis' || a.dataset.a == 'q') return;
  if (a.tagName == 'INPUT' && a.type == 'checkbox') return;
  const f = ACT[a.dataset.a]; if (!f) return;
  if (a.tagName == 'A') e.preventDefault();
  if (a.closest('#menu')) m.hidden = true;
  f(a, e);
});
document.addEventListener('change', (e) => {
  const a = e.target.closest('[data-a]'); if (!a) return; const v = a.value, k = a.dataset.a;
  if (a.type == 'checkbox' && k == 'ck') return ACT.ck(a);
  if (k == 'vis') { const b = B(a.dataset.id); setVis(b, v); save(); render(); if (v != 'private') toast('لینک ساخته شد؛ با «کپی لینک» برمی‌دارید'); }
  else if (k == 'sort') { U.sort = v; ls.s('srt', v); refresh(); }
  else if (k == 'tag') { U.tag = v; render(); }
  else if (k == 'hres') { U.hres = v; refresh(); } else if (k == 'hrange') { U.hrange = v; refresh(); }
  else if (k == 'st') { U[a.dataset.k] = v; if (a.dataset.k == 'range') ls.s('rng', v); render(); }
});
document.addEventListener('input', (e) => { if (e.target.dataset && e.target.dataset.a == 'q') { U.q = e.target.value; refresh(); } });
/* ---- زمان‌بندی نتایج: 30 ثانیه وقتی بازی زنده/نزدیک است، وگرنه 5 دقیقه؛ تب پنهان = توقف ---- */
let stm, lastPing = 0;
function delay() {
  const now = Date.now();
  for (const b of S.bets) { if (b.arch) continue; const s = R.st.get(b.id); if (!s) continue; for (const z of s.L) { if (z.l.fin || z.l.ov) continue; const x = z.x; if (x && (x.st == 'in' || (x.st == 'pre' && x.t && x.t - now < 20 * 6e4 && x.t - now > -4 * 36e5))) return 3e4; } }
  return U.pubBets && U.pubBets.length ? 6e4 : 3e5;
}
const busyUi = () => document.querySelector('dialog[open]') || /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '');
function tgPing() { if (!S.tg || !S.tg.on || !S.tok || Date.now() - lastPing < 55e3) return; lastPing = Date.now(); api('/api/notify?me=1&auto=1').catch(() => {}); }
function sched() { clearTimeout(stm); stm = setTimeout(async () => { if (!document.hidden) { await liveFetch(); if (!busyUi()) render(); tgPing(); } sched(); }, delay()); }
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(true); else { pull().catch(() => {}); liveFetch().then(() => { if (!busyUi()) render(); }); } });
addEventListener('pagehide', () => flush(true));
/* ---- راه‌اندازی ---- */
async function boot() {
  if (S.tok) {
    try { await loadAll(); api('/api/profile').then((j) => { S.prof = j.profile; renderHead(); }).catch(() => {}); api('/api/settings').then((j) => (S.tg = j)).catch(() => {}); }
    catch (e) { if (e.u) { S.tok = ''; showLogin(); } else toast('خطا در دریافت بلیت‌ها: ' + e.message, 8000); }
  }
  route(); render(); enter(); await liveFetch(); render();
}
(async function init() {
  mountShell(); mountDialogs();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register(BASE + '/sw.js').catch(() => {});
  await boot(); sched(); setInterval(() => { if (!document.hidden) pull().catch(() => {}); }, 24e4);
  if (!S.tok && !U.entry && !['#/board', '#/u'].some((h) => location.hash.startsWith(h))) showLogin();
})();
