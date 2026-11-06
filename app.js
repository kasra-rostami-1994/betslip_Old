/* ============================================================================
   BETSLIP — Modern Application Core
   Premium Dark Modern SaaS Dashboard
   Complete rewrite with all original logic + new design system
   ============================================================================ */

/* ============================================================================
   VERSION & CONSTANTS
   ============================================================================ */
const APP_VERSION = '2.4.13';
const VER = '2.0.0';
const BASE = location.pathname.startsWith('/betslip') ? '/betslip' : '';

/* ============================================================================
   UTILITY FUNCTIONS
   ============================================================================ */

const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];

const escapeHtml = (str) => String(str == null ? '' : str).replace(/[&<>"]/g, c => ({
  '&': '&', '<': '<', '>': '>', '"': '"'
}[c]));

const parseNum = (val) => parseFloat(String(val).replace(/,/g, '')) || 0;

const formatNumber = (num, locale = 'fa-IR') => {
  if (num == null || isNaN(num)) return '0';
  return num.toLocaleString(locale);
};

const formatDate = (timestamp, locale = 'fa-IR') => {
  if (!timestamp || isNaN(timestamp)) return 'زمان نامشخص';
  return new Date(timestamp).toLocaleString(locale, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

const throttle = (fn, limit) => {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

const copyToClipboard = (text) => {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text).then(
      () => Toast.success('کپی شد'),
      () => prompt('کپی کنید:', text)
    );
  }
  prompt('کپی کنید:', text);
};

/* ============================================================================
   STATE MANAGEMENT
   ============================================================================ */

const State = {
  token: '',
  user: '',
  profile: null,
  settings: null,
  bets: [],
  trash: [],
  liveEvents: [],
  liveSources: [],
  liveUpdatedAt: null,
  liveError: false,
  activeTab: 'active',
  openBets: new Set(),
  selectedBets: new Set(),
  filters: null,
  searchQuery: '',
  sortOrder: 'newest',
  entry: null,
  board: null,
  rank: null,
  pubBets: null,
  pu: null,
  share: null,
  prof: null,
  tg: null,
  snapshots: {},
  flushTimer: null,
  flushRetries: 0,
  isFlushing: false,
  pendingFlush: false,
  syncStatus: 'idle',
  syncMessage: '',
  theme: 'dark',
  tok: '',
  me: '',
  needMore: 0,
  sort: 'newest',
  tag: '',
  fil: null,
  hres: 'all',
  hrange: 'all',
  rng: 'all',
  cls: '',
  q: '',
  cls: '',
  open: new Set(),
  sel: new Set(),
  tok: '',
  me: '',
};

/* ============================================================================
   LOCAL STORAGE
   ============================================================================ */

const Storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch {} },
  remove(key) { try { localStorage.removeItem(key); } catch {} },
  getJSON(key, fallback = null) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return fallback; } },
  setJSON(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
};

/* ============================================================================
   API CLIENT
   ============================================================================ */

const API = {
  async request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (State.token) headers['Authorization'] = `Bearer ${State.token}`;
    const response = await fetch(BASE + path, { ...options, headers });
    if (response.status === 401) { const e = new Error('نشست منقضی شده؛ دوباره وارد شوید'); e.unauthorized = true; throw e; }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },
  get(path) { return this.request(path); },
  post(path, body) { return this.request(path, { method: 'POST', body: JSON.stringify(body) }); },
  put(path, body) { return this.request(path, { method: 'PUT', body: JSON.stringify(body) }); },
  delete(path) { return this.request(path, { method: 'DELETE' }); }
};

/* ============================================================================
   NOTIFICATION SYSTEM (TOAST)
   ============================================================================ */

const Toast = {
  container: null,
  init() { this.container = document.getElementById('toast-container') || (() => { const c = document.createElement('div'); c.id = 'toast-container'; c.className = 'toast-container'; c.setAttribute('aria-live', 'polite'); c.setAttribute('aria-atomic', 'true'); document.body.appendChild(c); return c; })(); },
  show(message, type = 'info', title = '', duration = 5000) {
    if (!this.container) this.init();
    const icons = {
      success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:2px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11"/></svg>',
      error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:2px;"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:2px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:2px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    const icon = { success: icons.success, error: icons.error, warning: icons.warning, info: icons.info }[type] || icons.info;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = `${icons[type] || icons.info}<div class="toast-content">${title ? `<div class="toast-title">${escapeHtml(title)}</div>` : ''}<div class="toast-message">${escapeHtml(message)}</div></div><button class="toast-close" aria-label="Dismiss"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
    toast.querySelector('.toast-close').addEventListener('click', () => this.remove(toast));
    this.container.appendChild(toast);
    if (duration > 0) setTimeout(() => this.remove(toast), duration);
    return toast;
  },
  remove(toast) { if (toast && toast.parentNode) { toast.style.animation = 'toast-in 0.2s ease-in reverse'; setTimeout(() => toast.remove(), 200); } },
  success(msg, title, d) { return this.show(msg, 'success', title, d); },
  error(msg, title, d) { return this.show(msg, 'error', title, d); },
  warning(msg, title, d) { return this.show(msg, 'warning', title, d); },
  info(msg, title, d) { return this.show(msg, 'info', title, d); }
};

/* ============================================================================
   MODAL / DIALOG MANAGEMENT
   ============================================================================ */

const Modal = {
  openModals: new Set(),
  open(dialog) { if (!dialog) return; dialog.showModal(); this.openModals.add(dialog); document.body.style.overflow = 'hidden'; dialog.focus(); },
  close(dialog) { if (!dialog) return; dialog.close(); this.openModals.delete(dialog); if (!this.openModals.size) document.body.style.overflow = ''; },
  closeAll() { this.openModals.forEach(d => d.close()); this.openModals.clear(); document.body.style.overflow = ''; },
  initDialog(d) { if (!d) return; const cb = d.querySelector('.modal-close'); if (cb) cb.onclick = () => this.close(d); d.onclick = e => { if (e.target === d) this.close(d); }; d.onkeydown = e => { if (e.key === 'Escape') this.close(d); }; },
  initAll() { document.querySelectorAll('dialog.modal').forEach(d => this.initDialog(d)); }
};

/* ============================================================================
   THEME MANAGEMENT
   ============================================================================ */

const Theme = {
  init() { const s = localStorage.getItem('theme'); const pd = matchMedia('(prefers-color-scheme: dark)').matches; this.apply(s === 'dark' || (!s && pd)); this.bind(); },
  apply(dark) { document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light'); localStorage.setItem('theme', dark ? 'dark' : 'light'); },
  toggle() { this.apply(document.documentElement.getAttribute('data-theme') !== 'dark'); },
  bind() { const b = document.getElementById('theme-toggle'); if (b) b.onclick = () => this.toggle(); this.update(); matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => { if (!localStorage.getItem('theme')) { this.apply(e.matches); this.update(); } }); },
  update() { const d = document.documentElement.getAttribute('data-theme') === 'dark'; const s = document.querySelector('.icon-sun'), m = document.querySelector('.icon-moon'); if (s && m) { s.style.display = d ? 'block' : 'none'; m.style.display = d ? 'none' : 'block'; } }
};;

/* ============================================================================
   CORE APPLICATION
   ============================================================================ */

const App = {
  config: { BASE: location.pathname.startsWith('/betslip') ? '/betslip' : '', VER: '2.0.0', VERSION: '2.4.13' },
  state: State,
  storage: Storage,
  api: API,
  toast: Toast,
  modal: Modal,
  theme: Theme,

  async init() {
    this.theme.init();
    this.toast.init();
    this.modal.initAll();
    this.bindGlobalEvents();
    this.initRouter();
    await this.boot();
    this.startScheduler();
    setInterval(() => { if (!document.hidden) this.pull().catch(() => {}); }, 240000);
    console.log(`Betslip v${this.config.VERSION} initialized`);
  },

  bindGlobalEvents() {
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.modal.closeAll();
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); const i = document.querySelector('[data-a="q"]'); if (i) i.focus(); }
    });
    document.addEventListener('click', e => {
      document.querySelectorAll('.dropdown.open').forEach(dd => { if (!dd.contains(e.target)) dd.classList.remove('open'); });
      const m = document.getElementById('menu'); if (m && !m.hidden && !e.target.closest('#menu')) m.hidden = true;
    });
    window.addEventListener('hashchange', () => { this.state.entry = null; this.state.sel = null; this.route(); this.enter(); this.render(); window.scrollTo(0,0); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.flush(true); else { this.pull().catch(()=>{}); this.liveFetch().then(() => { if (!this.busyUi()) this.render(); }); } });
    addEventListener('pagehide', () => this.flush(true));
    document.addEventListener('input', e => { if (e.target.dataset?.a === 'q') { this.state.q = e.target.value; this.refresh(); } });
  },

  initRouter() { this.route(); },

  route() {
    const h = location.hash.replace(/^#\/?/, ''), p = h.split('/'), ok = ['bets','risk','hist','stats','board','me','trash','u'];
    if (!h) { if (this.state.entry) { this.state.tab = this.state.entry.tab; this.state.uname = this.state.entry.u; return; } this.state.tab = this.state.tok ? 'bets' : 'board'; return; }
    this.state.tab = ok.includes(p[0]) ? p[0] : 'bets'; this.state.uname = p[1];
    if (!this.state.tok && !['board','u'].includes(this.state.tab)) this.state.tab = 'board';
  },

  async enter() {
    this.state.pubBets = null;
    try {
      if (this.state.tab === 'board' && !this.state.board) { this.state.board = (await this.api.get('/api/profile?board=1')).rows; if (this.state.me) this.state.rank = (this.state.board.findIndex(r => r.u === this.state.me) + 1) || null; this.render(); }
      if (this.state.tab === 'me' && this.state.tok) { this.state.prof = (await this.api.get('/api/profile?fresh=1')).profile; const b = (await this.api.get('/api/profile?board=1')).rows; this.state.rank = (b.findIndex(r => r.u === this.state.me) + 1) || null; this.render(); }
      if (this.state.tab === 'u') { this.state.pu = null; this.render(); try { this.state.pu = await this.api.get('/api/profile?u=' + encodeURIComponent((this.state.uname || '').toLowerCase())); this.state.pubBets = this.state.pu.bets; } catch (e) { this.state.pu = { err: 1 }; } this.render(); await this.liveFetch(); this.render(); }
      if (this.state.tab === 'share') { try { this.state.share = await this.api.get('/api/share?t=' + encodeURIComponent(this.state.entry.t)); this.state.pubBets = [this.state.share.bet]; } catch (e) { this.state.share = { err: 1 }; } this.render(); await this.liveFetch(); this.render(); }
    } catch (e) { this.toast.error(e.message); }
  },

  go(tab) { this.state.entry = null; if (location.hash === '#/' + tab) { this.route(); this.enter(); this.render(); } else location.hash = '#/' + tab; },

  async loadAll() {
    const j = await this.api.get('/api/data');
    this.state.bets = j.records || [];
    this.state.trash = [];
    this.state.snapshots = {};
    this.state.bets.forEach(b => this.state.snapshots[b.id] = JSON.stringify(b));
  },

  async boot() {
    if (this.state.token) {
      try { await this.loadAll(); this.api.get('/api/profile').then(j => { this.state.profile = j.profile; this.renderHeader(); }).catch(() => {}); this.api.get('/api/settings').then(j => this.state.settings = j).catch(() => {}); }
      catch (e) { if (e.unauthorized) { this.state.token = ''; this.showLogin(); } else { this.toast.error('Error: ' + e.message, undefined, 8000); } }}
    this.route(); this.render(); await this.enter(); await this.liveFetch(); this.render();
    if (!this.state.token) { this.route(); this.render(); }
  },

  async apiRequest(path, options = {}) {
    const h = { 'Content-Type': 'application/json', ...options.headers };
    if (this.state.token) h['Authorization'] = `Bearer ${this.state.token}`;
    const r = await fetch(BASE + path, { ...options, headers: h });
    if (r.status === 401) { const e = new Error('رمز اشتباه است'); e.unauthorized = true; throw e; }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  },

  async flush(ka) {
    if (this.state.isFlushing) { this.state.pendingFlush = true; return; }
    const up = [], snap = {}, rm = [];
    for (const r of [...this.state.bets, ...this.state.trash]) { const j = JSON.stringify(r); snap[r.id] = j; if (this.state.snapshots[r.id] !== j) up.push(r); }
    for (const id in this.state.snapshots) if (!(id in snap)) rm.push(id);
    if (!up.length && !rm.length) { this.setSync(this.state.sync === 'err' ? 'err' : 'ok'); return; }
    this.state.isFlushing = true; this.setSync('pending');
    try {
      const now = Date.now(); up.forEach(r => { r.upd = now; snap[r.id] = JSON.stringify(r); });
      await this.apiRequest('/api/data', { method: 'PUT', body: { up, rm }, keepalive: true });
      Object.assign(this.state.snapshots, snap); rm.forEach(id => delete this.state.snapshots[id]); this.state.flushRetries = 0; this.setSync('ok');
    } catch (e) { this.state.flushRetries++; this.setSync('err', e.message); if (e.unauthorized) { if (window.showLogin) showLogin(); } else { clearTimeout(this.state.flushTimer); this.state.flushTimer = setTimeout(() => this.flush(), Math.min(60000, 3000 * this.state.flushRetries)); } }
    finally { this.state.isFlushing = false; if (this.state.pendingFlush) { this.state.pendingFlush = false; this.flush(); } }
  },

  setSync(st, msg = '') { this.state.sync = st; this.state.syncMessage = msg || ''; const el = document.getElementById('sync'); if (el) { el.dataset.s = st; el.title = msg || ''; el.textContent = { ok: 'ذخیره شد', pending: 'در حال ذخیره…', err: 'ذخیره نشد؛ تلاش مجدد', idle: '' }[st]; } },
  save() { clearTimeout(this.state.flushTimer); this.state.flushTimer = setTimeout(() => this.flush(), 500); },

  async pull() {
    if (this.state.isFlushing || this.state.sync === 'pending' || !this.state.token) return;
    try {
      const j = await this.api.get('/api/data');
      const srv = new Map(j.records.map(r => [r.id, r]));
      const loc = new Map([...this.state.bets, ...this.state.trash].map(r => [r.id, r]));
      let ch = false;
      const drop = id => { this.state.bets = this.state.bets.filter(r => r.id !== id); this.state.trash = this.state.trash.filter(r => r.id !== id); };
      for (const [id, sr] of srv) {
        const lr = loc.get(id); const lj = lr ? JSON.stringify(lr) : null; const sj = JSON.stringify(sr); const snap = this.state.snapshots[id];
        if (!lr) { if (!(id in this.state.snapshots)) { this.state.snapshots[id] = sj; (sr.del ? this.state.trash : this.state.bets).push(sr); ch = true; } }
        else if (lj === snap && lj !== sj) { drop(id); (sr.del ? this.state.trash : this.state.bets).push(sr); this.state.snapshots[id] = sj; ch = true; }
      }
      for (const [id, lr] of loc) if (!srv.has(id) && id in this.state.snapshots && this.state.snapshots[id] === JSON.stringify(lr)) { drop(id); delete this.state.snapshots[id]; ch = true; }
      if (ch) this.render();
    } catch (e) { console.warn('Pull failed:', e); }
  },

  needMore: 0,
  async liveFetch() {
    const nl = this.state.bets.some(b => !b.arch && b.legs.some(l => !l.fin && !l.ov)) || (this.state.pubBets && this.state.pubBets.length);
    if (!nl) return;
    try {
      const r = await fetch(BASE + '/api/live' + (this.needMore ? '?apif=1' : ''));
      const j = await r.json();
      this.state.liveEvents = j.events || []; this.state.liveSources = j.sources || []; this.state.liveUpdatedAt = new Date(); this.state.liveError = false;
      const u = this.unmatched(); if (u && !this.needMore) { this.needMore = 1; return this.liveFetch(); } this.needMore = u ? 1 : 0;
    } catch (e) { this.state.liveError = 1; }
  },

  unmatched() { return this.state.bets.some(b => !b.arch && b.legs.some(l => !l.fin && !l.ov && !this.state.liveEvents.some(e => this.matchTeam(l, e)))) || (this.state.pubBets && this.state.pubBets.length && this.state.pubBets.some(b => b.legs.some(l => !l.fin && !l.ov && !this.state.liveEvents.some(e => this.matchTeam(l, e))))); },
  matchTeam(l, e) { return this.fold(l.home) === this.fold(e.home) && this.fold(l.away) === this.fold(e.away); },
  fold(s) { return s.toLowerCase().replace(/æ/g,'ae').replace(/[øö]/g,'o').replace(/ß/g,'ss').replace(/ł/g,'l').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9 ]/g,' '); },

  // Team matching constants
  STOP: new Set('fc afc cf sc ac as fk sk bk if real club the city united cd rc ad us kaa krc rsc'.split(' ')),
  AL: [['crvena zvezda','red star'],['inter milan','internazionale'],['athletic bilbao','athletic club'],['olympiacos','olympiakos'],['ofk belgrade','ofk beograd'],['heart of midlothian','hearts'],['prague','praha']],
  TC: {},
  tk(s) { return this.TC[s] || (this.TC[s] = (f => (f + ' ' + this.AL.filter(a => f.includes(a[0])).map(a => a[1]).join(' ')).split(/\s+/).filter(w => w.length > 2 && !this.STOP.has(w)))(this.fold(s))); },
  same(a,b) { const x = this.tk(a), y = this.tk(b); return x.some(w => y.some(v => v === w || (w.length > 4 && v.length > 4 && w.slice(0,5) === v.slice(0,5)))); },

  // Team name normalization for display
  normalizeTeamName(name) {
    return name.replace(/^(FC|AFC|CF|SC|AC|AS|FK|SK|BK|IF)\s+/i, '').replace(/\s+(FC|AFC|CF|SC|AC|AS|FK|SK|BK|IF)$/i, '').trim();
  },

  // ============================================================================
  // PREDICTION EVALUATION
  // ============================================================================
  cons(l) {
    if (l.ov) return { h: l.ov.h, a: l.ov.a, st: l.ov.f ? 'post' : 'in', min: l.ov.m || 45, man: 1, clk: l.ov.f ? 'پایان (دستی)' : 'زنده (دستی)' };
    if (l.fin) return { h: l.fin.h, a: l.fin.a, st: 'post', t: l.fin.t && new Date(l.fin.t), clk: 'پایان', fin: 1 };
    const H = this.state.liveEvents.filter(e => this.same(l.home, e.home) && this.same(l.away, e.away));
    if (!H.length) return null;
    const g = {}; H.forEach(e => (g[e.h + '-' + e.a] = g[e.h + '-' + e.a] || []).push(e));
    const G = Object.values(g).sort((a,b) => b.length - a.length || a[0].p - b[0].p), r = G[0][0];
    return { h: r.h, a: r.a, st: r.st, clk: r.clk, min: r.min, t: r.t && new Date(r.t), src: G.map(g => [[...new Set(g.map(e => this.SN[e.s] || e.s))].join('+'), g[0].h + '-' + g[0].a]), cf: G.length > 1 };
  },

  chk(p, h, a) { const g = h + a, d = h - a; let m;
    if (p === '1') return [d > 0, 1 - d, 0];
    if (p === '2') return [d < 0, 1 + d, 0];
    if (p === 'X') return [d === 0, Math.abs(d), 0];
    if (p === '1X') return [d >= 0, -d, 0];
    if (p === 'X2') return [d <= 0, d, 0];
    if (p === '12') return [d !== 0, d ? 0 : 1, 0];
    if (p === 'BY') return [h > 0 && a > 0, (h === 0) + (a === 0), 'up'];
    if (p === 'BN') return [!(h > 0 && a > 0), 0, 'down'];
    if (m = p.match(/^([HA]?)([OU])([\d.]+)$/)) { const v = m[1] === 'H' ? h : m[1] === 'A' ? a : g, L = +m[3]; return m[2] === 'O' ? [v > L, Math.floor(L) + 1 - v, 'up'] : [v < L, 0, 'down']; }
    if (m = p.match(/^T(\d+)$/)) { const N = +m[1]; return [g === N, Math.abs(N - g), g > N ? 'down' : 0]; }
    if (m = p.match(/^S(\d+)-(\d+)$/)) { const x = +m[1], y = +m[2]; return [h === x && a === y, Math.max(0, x - h) + Math.max(0, y - a), h > x || a > y ? 'down' : 0]; }
    if (m = p.match(/^AH([12])([+-][\d.]+)$/)) { const e = m[1] === '1' ? h + +m[2] - a : a + +m[2] - h; return [e > 0, Math.floor(-e) + 1, 0]; }
    return [false, 9, 0];
  },

  ev1(p, x) { const fin = x.st === 'post', [ok, need, mono] = this.chk(p, x.h, x.a);
    if (fin) return ok ? ['g', 0] : ['r', 1];
    if (mono === 'up' && ok) return ['g', 0];
    if (mono === 'down' && !ok) return ['r', 1];
    if (ok) return ['b', 0];
    return need <= 1 || need * 25 <= 90 - (x.min || 0) ? ['o', 0] : ['r', 0];
  },
  ev(p, x) {
    if (!x || x.st === 'pre') return ['n', 0];
    const R = p.split('&').map(q => this.ev1(q, x)), C = R.map(r => r[0]);
    if (R.some(r => r[1])) return ['r', 1];
    if (C.every(c => c === 'g')) return ['g', 0];
    if (C.every(c => c === 'g' || c === 'b')) return ['b', 0];
    return [C.includes('r') ? 'r' : 'o', 0];
  },

  // Pick text formatting
  pt1(p, l) { let m; const H = l.home, A = l.away, F = { 1: 'برد ' + H, 2: 'برد ' + A, X: 'مساوی', '1X': H + ' یا مساوی', X2: 'مساوی یا ' + A, 12: 'بدون مساوی', BY: 'هر دو تیم گل می‌زنند', BN: 'حداقل یک تیم گل نمی‌زند' };
    if (F[p]) return F[p];
    if (m = p.match(/^([HA]?)([OU])([\d.]+)$/)) return (m[1] === 'H' ? 'گل‌های ' + H + ' ' : m[1] === 'A' ? 'گل‌های ' + A + ' ' : 'مجموع گل ') + (m[2] === 'O' ? 'بالای ' : 'زیر ') + m[3];
    if (m = p.match(/^T(\d+)$/)) return 'دقیقاً ' + m[1] + ' گل';
    if (m = p.match(/^S(\d+)-(\d+)$/)) return 'نتیجهٔ دقیق ' + m[1] + '-' + m[2];
    if (m = p.match(/^AH([12])(.+)$/)) return 'هندیکپ ' + (m[1] === '1' ? H : A) + ' (' + m[2] + ')'; return p;
  },
  pickTxt(p, l) { return p.split('&').map(q => this.pt1(q, l)).join(' + '); },
  fmtT(t) { return t && !isNaN(t) ? t.toLocaleString('fa-IR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'زمان نامشخص'; },
  COL: { g: 'var(--color-success)', b: 'var(--color-primary)', o: 'var(--color-warning)', r: 'var(--color-error)', n: 'var(--color-border-default)' },
  SN: { espn: 'ESPN', sofa: 'Sofascore', fd: 'football-data', apif: 'API-Football', tsdb: 'TheSportsDB' },

  // ============================================================================
  // RENDERING
  // ============================================================================
  renderHeader() {
    if (!this.state.profile) return;
    const h = $('#upd'); if (h) h.textContent = (this.state.liveUpdatedAt ? 'آخرین به‌روزرسانی ' + this.state.liveUpdatedAt.toLocaleTimeString('fa-IR') + ' — ' : '') + this.state.liveSources.map(s => (this.SN[s.n] || s.n) + (s.ok ? ' ✓' + s.c : ' ✗')).join('  ');
  },

  render() {
    if (this.state.PUB) { $('#app').innerHTML = this.view(this.state.bets[0], 1); return; }
    $('#t1').classList.toggle('on', this.state.tab === 'act'); $('#t2').classList.toggle('on', this.state.tab === 'his');
    const bets = this.state.bets.filter(b => this.state.tab === 'act' ? !b.arch : !!b.arch).sort((a,b) => this.state.tab === 'act' ? a.created - b.created : b.arch - a.arch);
    const betsHtml = bets.length ? bets.map(b => this.view(b)).join('') : '<p class="sub emp">بلیتی نیست. با «افزودن بلیت» شروع کنید.</p>';
    const statsHtml = this.state.tab === 'his' ? this.stats() : '';
    $('#app').innerHTML = statsHtml + betsHtml;
    if (this.state.dirty) { this.state.dirty = 0; this.save(); }
  },

  view(b, pub) {
    const L = b.legs.map((l,i) => { const x = this.cons(l), [c, dead] = this.ev(l.pick, x); if (!pub && x && x.st === 'post' && !x.man && !x.fin && !l.fin && !l.ov) { l.fin = { h: x.h, a: x.a, t: x.t && x.t.toISOString ? x.t.toISOString() : null }; this.state.dirty = 1; } return { l, i, x, c, dead }; });
    L.sort((p,q) => (p.x?.st === 'in' ? 0 : 1) - (q.x?.st === 'in' ? 0 : 1) || (p.x?.t || 8e15) - (q.x?.t || 8e15));
    const cnt = k => L.filter(z => z.c === k).length, lost = L.some(z => z.dead), won = L.every(z => z.c === 'g'), nl = L.filter(z => z.x?.st === 'in').length;
    b._st = lost ? 'lost' : won ? 'won' : 'open';
    const chip = lost ? ['از دست رفته', 'var(--color-error)'] : won ? ['برنده شد', 'var(--color-success)'] : nl ? [nl + ' بازی زنده', 'var(--color-primary)'] : ['در انتظار', 'var(--color-text-muted)'];
    const open = pub || this.state.open.has(b.id), id = b.id;
    const row = z => { const x = z.x, l = z.l; const sc = x && x.st !== 'pre' ? `<b>${x.h} - ${x.a}</b><small>${x.st === 'post' ? 'پایان' : esc(x.clk || 'زنده')}</small>` : `<b>–</b><small>${x ? this.fmtT(x.t) : (this.state.liveUpdatedAt ? 'در منابع پیدا نشد' : '…')}</small>`; const bd = x?.man ? '<small>منبع: دستی</small>' : x?.fin ? '<small>منبع: ذخیره‌شده</small>' : x?.src ? (x.cf ? '<small class="w">⚠ اختلاف: ' + x.src.map(q => esc(q[0]) + ' ' + q[1]).join(' | ') + '</small>' : `<small class="${x.src[0][0].includes('+') ? 'v' : ''}">${x.src[0][0].includes('+') ? '✓ ' : ''}${esc(x.src[0][0])}</small>`) : ''; return `<div class="leg c-${z.c} ${x?.st === 'in' ? 'live' : ''}"><span class="dot"></span><div><div class="nm">${esc(l.home)} – ${esc(l.away)}</div><div class="pk">پیش‌بینی: ${esc(this.pickTxt(l.pick, l))} (${(+l.odds).toFixed(2)})</div></div><div class="sc"${pub ? '' : ` tabindex="0" role="button" title="ورود دستی نتیجه" data-b="${id}" data-l="${z.i}"`}>${sc}${bd}</div></div>`; };
    const meta = pub ? `<span>ضریب <b>${(+b.odds).toLocaleString()}</b></span>` : `<span>ضریب <b>${(+b.odds).toLocaleString()}</b></span><span>مبلغ <b>${b.stake}</b></span><span>برد احتمالی <b>${(+b.win).toLocaleString()}</b> USDT</span>${b.cash != null ? `<span>کش‌اوت <b>${b.cash}</b></span>` : ''}`;
    const acts = pub ? '' : `<div class="acts"><button class="x" data-a="tg" data-b="${id}" aria-expanded="${this.state.open.has(b.id)}">${this.state.open.has(b.id) ? 'بستن جزئیات ▴' : 'جزئیات بازی‌ها ▾'}</button><button class="x" data-a="sh" data-b="${id}">${b.share ? 'کپی لینک اشتراک' : 'اشتراک‌گذاری'}</button>${b.share ? `<button class="x" data-a="us" data-b="${id}">لغو اشتراک</button>` : ''}${b.arch ? `<button class="x" data-a="un" data-b="${id}">بازگردانی</button>` : `<button class="x" data-a="ar" data-b="${id}">بایگانی</button>`}<button class="x" data-a="del" data-b="${id}">حذف</button></div>`;
    return `<section class="bet ${lost ? 'lost' : won ? 'won' : ''}"><div class="bh"><div class="t"><span>${esc(b.name)}${b.share && !pub ? ' 🔗' : ''}</span><span class="chip" style="color:${chip[1]}">${chip[0]}</span></div><div class="meta">${meta}</div><div class="meta"><span style="color:var(--color-success)">درست ${cnt('g')}</span><span style="color:var(--color-primary)">مطابق ${cnt('b')}</span><span style="color:var(--color-warning)">نزدیک ${cnt('o')}</span><span style="color:var(--color-error)">اشتباه ${cnt('r')}</span><span>از ${L.length}</span></div><div class="bar">${['g','b','o','r','n'].map(k => `<span style="flex:${cnt(k)};background:${this.COL[k]}"></span>`).join('')}</div>${acts}</div>${this.state.open.has(b.id) ? L.map(row).join('') : ''}</section>`;
  },

  stats() {
    const H = this.state.bets.filter(b => b.arch && (b.res === 'won' || b.res === 'lost')), W = H.filter(b => b.res === 'won');
    const st = H.reduce((s,b) => s + +b.stake, 0), rt = W.reduce((s,b) => s + b.stake * b.odds, 0);
    return `<div class="stats"><div class="sub">بلیت‌های تمام‌شده<b>${H.length}</b></div><div class="sub">برنده<b style="color:var(--color-success)">${W.length}</b></div><div class="sub">بازنده<b style="color:var(--color-error)">${H.length - W.length}</b></div><div class="sub">درصد برد<b>${H.length ? Math.round(W.length / H.length * 100) : 0}%</b></div><div class="sub">مجموع شرط<b>${st.toFixed(2)}</b></div><div class="sub">بازگشت<b>${rt.toFixed(2)}</b></div><div class="sub">سود/زیان<b style="color:${rt - st >= 0 ? 'var(--color-success)' : 'var(--color-error)'}">${(rt - st).toFixed(2)}</b></div></div>`;
  },

  // ============================================================================
  // BET EDITOR & DIALOGS
  // ============================================================================
  edSave() {
    const H = t => { $('#hint').textContent = t; };
    if (this.state.edit) {
      if (!this.state.DL.length) return H('حداقل یک بازی باید در بلیت بماند.');
      const o = this.mkBet(this.state.DL), b = this.state.edit; Object.assign(b, { name: o.name, stake: o.stake, odds: o.odds, win: o.win, cash: o.cash, tags: this.tg(), note: $('#nt').value.trim(), legs: this.state.DL }); this.setVis(b, $('#vs').value); $('#ad').close(); this.save(); this.render(); this.liveFetch().then(() => this.render()); return;
    }
    let Rs;
    if (this.state.mode === 'f') { if (!this.state.DL.length) return H('حداقل یک بازی به بلیت اضافه کنید.'); Rs = [this.mkBet(this.state.DL)]; }
    else if (this.state.mode === 'm') { Rs = [this.parseManual($('#tx').value, { name: $('#nm').value.trim(), stake: $('#sk').value, odds: $('#od').value })]; if (Rs[0]) Rs[0].cash = $('#ch').value ? this.num($('#ch').value) : null; }
    else {
      const txt = $('#tx').value.trim(); const bb = this.parseBetBuilder(txt); Rs = bb ? [bb] : txt.split(/^\s*Active\s*$/mi).map(this.parseBlock);
    }
    const ok = Rs.filter(Boolean); if (!ok.length) return H('هیچ بازی‌ای تشخیص داده نشد؛ قالب را بررسی کنید.');
    const wn = ok.map(b => b._w).filter(Boolean); if (wn.length && !confirm('⚠ ' + wn.join('\n') + '\n\nبا همین حالت ثبت شود؟')) return;
    const nm = $('#nm').value.trim(), now = Date.now(); ok.forEach((b,i) => { delete b._w; if (nm && this.state.mode === 'p') b.name = ok.length > 1 ? nm + ' ' + (i + 1) : nm; Object.assign(b, { id: this.rid(), created: now + i, tags: this.tg(), note: $('#nt').value.trim() }); this.setVis(b, $('#vs').value); this.state.bets.push(b); });
    $('#ad').close(); this.save(); this.render(); this.liveFetch().then(() => this.render()); this.toast.success(ok.length + ' بلیت ثبت شد');
  },

  num(s) { return parseFloat(String(s).replace(/,/g, '')) || 0; },

  toPick(sel, h) { const s = sel.trim(), m = s.match(/^(over|under)\s+([\d.]+)$/i); if (m) return m[1][0].toUpperCase() + m[2]; if (/^draw$/i.test(s)) return 'X'; const p = s.split(/ or /i); if (p.length === 2) return /^draw$/i.test(p[0].trim()) ? 'X2' : '1X'; return this.fold(s).trim() === this.fold(h).trim() ? '1' : '2'; },

  // ---- Bet Builder parser ----
  parseBetBuilder(t) {
    const L = t.split('\n').map(s => s.trim()).filter(s => s);
    const hasBuilderHeader = L.some(s => /^\*?\s*Odds/i.test(s)) && L.some(s => /^\*?\s*Stake/i.test(s)) && L.some(s => /^\*?\s*Potential win/i.test(s));
    if (!hasBuilderHeader) return null;
    const oddsIdx = L.findIndex(s => /^\*?\s*Odds/i.test(s));
    const stakeIdx = L.findIndex(s => /^\*?\s*Stake/i.test(s));
    const winIdx = L.findIndex(s => /^\*?\s*Potential win/i.test(s));
    const headerEnd = Math.min(oddsIdx, stakeIdx, winIdx);
    const valueLines = L.slice(headerEnd + 1).filter(s => /^\*?\s*[\d.,]/.test(s));
    let odds = 1, stake = 1, win = null;
    if (valueLines.length >= 1) odds = this.num(valueLines[0].match(/^\*?\s*([\d.,]+)/)?.[1] || 1);
    if (valueLines.length >= 2) stake = this.num(valueLines[1].match(/^\*?\s*([\d.,]+)/)?.[1] || 1);
    if (valueLines.length >= 3) win = this.num(valueLines[2].match(/^\*?\s*([\d.,]+)/)?.[1] || null);
    if (!win) win = +(stake * odds).toFixed(2);
    const contentLines = L.slice(0, headerEnd);
    const CONDITION_PATTERNS = ['over','under','double chance','each team','total ','handicap','asian','draw','1x2','corner','corners','card','cards','goal','goals','team corners','team corner','total corner','total corners','total card','total cards','total goal','total goals','asian total','asian handicap','1st half','2nd half','1st','2nd','half','both teams to score','btts','gg','ng','to qualify','to win','win either half','draw no bet','dnb','clean sheet','anytime scorer','first scorer','last scorer'].join('|');
    const matches = [], currentConds = [];
    for (const line of contentLines) {
      const isCondition = line.includes(' - ') && new RegExp('over|under|double chance|each team|total |handicap|asian|draw|1x2|corner|corners|card|cards|goal|goals|team corners|team corner|total corner|total corners|total card|total cards|total goal|total goals|asian total|asian handicap|1st half|2nd half|1st|2nd|half|both teams to score|btts|gg|ng|to qualify|to win|win either half|draw no bet|dnb|clean sheet|anytime scorer|first scorer|last scorer','i').test(line);
      if (line.includes(' - ') && !/^\*/.test(line) && !isCondition) {
        if (currentConds.length > 0) { matches.push({ conds: [...currentConds], teamLine: line }); currentConds.length = 0; }
        else { matches.push({ conds: [], teamLine: line }); }
      } else if (!/^\*/.test(line)) currentConds.push(line);
    }
    if (currentConds.length > 0) matches.push({ conds: [...currentConds], teamLine: null });
    if (!matches.length) return null;
    const legs = matches.map(m => { const k = m.teamLine ? m.teamLine.indexOf(' - ') : -1; const home = k > 0 ? m.teamLine.slice(0,k).trim() : 'Unknown'; const away = k > 0 ? m.teamLine.slice(k+3).trim() : 'Unknown'; const pick = m.conds.length ? m.conds.join(' | ') : 'Bet Builder'; return { home, away, pick, odds: 1.0 }; });
    if (legs.length > 0 && odds > 1) { const lo = +Math.pow(odds, 1/legs.length).toFixed(2); legs.forEach(l => l.odds = lo); }
    const W = []; if (legs.length > 0 && odds > 1) { const pd = +legs.reduce((p,l) => p*l.odds,1).toFixed(2); if (Math.abs(pd-odds)/odds > 0.04) W.push(`توزیع تقریبی ضریب: هر بازی ${legs[0].odds} (ضریب کل ${pd} vs اصلی ${odds})`); }
    return { name: 'Bet Builder ' + legs.length, stake, odds, win, cash: null, legs, _w: W.join('\n') };
  },

  parseBlock(t) {
    const L = t.split('\n').map(s => s.trim().replace(/^[*•]\s*/,'')).filter(s => s && !/^\(\s*\d+\s*[:\-]\s*\d+\s*\)$/.test(s)), legs = [];
    L.forEach((s,i) => { if (i >= 3 && /^(1x2|double chance|asian total)$/i.test(L[i-1].replace(/\s*\(\s*\d+\s*[:\-]\s*\d+\s*\)$/,'')) && /^\d+(\.\d+)?(\(\d+:\d+\))?$/.test(L[i-2]) && s.includes(' - ')) { const k = s.indexOf(' - '), home = s.slice(0,k).trim(), away = s.slice(k+3).trim(); legs.push({ home, away, pick: this.toPick(L[i-3], home), odds: parseFloat(L[i-2]) }); }});
    if (!legs.length) return null;
    const w = L.findIndex(s => /^Potential win/i.test(s)), n = w >= 0 ? L.slice(w+1).filter(s => /^[\d.,]+$/.test(s)).map(this.num) : [];
    const c = L.findIndex(s => /^Cash out$/i.test(s)), cv = c >= 0 ? this.num(L[c+1]) : NaN;
    const odds = n[0] || +legs.reduce((p,l) => p*l.odds,1).toFixed(2), stake = n[1] || 1;
    return { name: L.find(s => /^multi\s+\d+/i.test(s)) || 'multi ' + legs.length, stake, odds, win: n[2] || +(stake*odds).toFixed(2), cash: isNaN(cv) ? null : cv, legs };
  },

  parseManual(t,f) {
    const legs = t.split('\n').map(s => s.split('|').map(x => x.trim())).filter(a => a.length === 3 && a[0].includes(' - ')).map(a => { const k = a[0].indexOf(' - '); return { home: a[0].slice(0,k).trim(), away: a[0].slice(k+3).trim(), pick: a[1].toUpperCase(), odds: this.num(a[2]) } }).filter(l => l.odds > 1);
    if (!legs.length) return null;
    const odds = this.num(f.odds) || +legs.reduce((p,l) => p*l.odds,1).toFixed(2), stake = this.num(f.stake) || 1;
    return { name: f.name || 'بلیت', stake, odds, win: +(stake*odds).toFixed(2), cash: null, legs };
  },

  // ============================================================================
  // UI HELPERS
  // ============================================================================
  rid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },
  tg() { return $('#tgs').value.split(/[,،]/).map(s => s.trim()).filter(Boolean); },
  setVis(b, v) { b.vis = v; if (v === 'private') delete b.share; else if (!b.share) b.share = this.rid(); },
  fl() { return { home: $('#fh').value.trim() || 'میزبان', away: $('#fa').value.trim() || 'میهمان' }; },
  flist() { $('#fcur').textContent = this.state.CUR.length ? 'شرط‌ها (همه باید برقرار باشند): ' + this.state.CUR.map(p => this.pt1(p, this.fl())).join(' + ') : ''; $('#flist').innerHTML = this.state.DL.map((l,i) => `${i+1}. ${esc(l.home)} – ${esc(l.away)}: ${esc(this.pickTxt(l.pick, l))} (${l.odds}) <a href="#" data-r="${i}">حذف</a>`).join('<br>'); },
  mkBet(legs) { const odds = this.num($('#od').value) || +legs.reduce((p,l) => p*l.odds,1).toFixed(2), stake = this.num($('#sk').value) || 1; return { name: $('#nm').value || 'multi ' + legs.length, stake, odds, win: +(stake*odds).toFixed(2), cash: null, legs }; },
  setMode(m) { this.state.mode = m; $$('#admode button').forEach(b => b.classList.toggle('on', b.dataset.m === m)); $('#mf').hidden = m === 'p'; $('#ff').hidden = m !== 'f'; $('#tx').hidden = m === 'f'; $('#bb').hidden = m !== 'b'; $('#hint').textContent = m === 'f' ? 'برای هر بازی: نام تیم‌ها، ضریب و یک یا چند شرط (ترکیبی) را بزنید، سپس «افزودن این بازی».' : m === 'm' ? 'هر خط: Home - Away | پیش‌بینی | ضریب (کدها: 1، X، 2، 1X، X2، O2.5، U3.5، BY، T3، S2-1، 1&O2.5 …)' : m === 'b' ? 'متن Bet Builder را بچسبانید. فرمت: شرایط هر بازی (چند خط)، سپس خط تیم‌ها (Home - Away)، و در نهایت Odds / Stake USDT / Potential win USDT با مقادیر.' : 'متن بلیت را همان‌طور که از سایت کپی کرده‌ید بچسبانید؛ چند بلیت پشت‌سرهم هم قبول است.'; },
  mk(c,v) { v = v.trim(); if (!this.needV(c)) return c; if (!v) return null; if (c === 'S') return /^\d+-\d+$/.test(v) ? 'S' + v : null; if (!/^[+-]?[\d.]+$/.test(v)) return null; return c.startsWith('AH') ? c + (/^[+-]/.test(v) ? v : '+' + v) : c + v; },

  // ============================================================================
  // DIALOG HANDLERS
  // ============================================================================
  showLogin() { const d = $('#lg'); if (!d.open) d.showModal(); },
  openEditor(b) { this.state.edit = b || null; this.edReset(); this.edMode(b ? 'f' : 'p'); if (b) { this.state.DL = b.legs.slice(); $('#nm').value = b.name; $('#sk').value = b.stake; $('#od').value = b.odds; $('#ch').value = b.cash == null ? '' : b.cash; $('#tgs').value = (b.tags || []).join('، '); $('#nt').value = b.note || ''; $('#vs').value = b.vis || 'private'; this.edMode('f'); this.flist(); } $('#fc').onchange = () => $('#fv').hidden = !this.needV($('#fc').value); $('#fc').onchange(); $('#ad').showModal(); },
  edReset() { this.state.DL = []; this.state.CUR = []; this.state.EL = null; ['nm','sk','od','ch','tx','fh','fa','fo','fv','tgs','nt'].forEach(k => $('#' + k).value = ''); $('#vs').value = (this.state.profile && this.state.profile.dvis) || 'private'; $('#adt').textContent = this.state.edit ? 'ویرایش بلیت' : 'افزودن بلیت'; $('#ok').textContent = this.state.edit ? 'ذخیره تغییرات' : 'ثبت بلیت'; this.flist(); },
  openOv(b,i) { const l = b.legs[i], o = l.ov || l.fin; this.state.OV = { l }; $('#ovt').textContent = l.home + ' – ' + l.away; $('#ovh').textContent = ''; $('#oh').value = o ? o.h : ''; $('#oa').value = o ? o.a : ''; $('#om').value = (l.ov && l.ov.m) || ''; $('#os').value = (l.ov && l.ov.f) || (!l.ov && l.fin) ? 'fin' : 'live'; $('#ow').hidden = !l.pick.includes('Q'); $('#ow').value = (o && o.w) || 0; $('#ov').showModal(); },
  openCo(b) { this.state.CO = b; $('#cot').textContent = 'ماشین‌حساب کش‌اوت · ' + b.name; $('#cov').value = b.cash == null ? '' : b.cash; this.coCalc(); $('#co').showModal(); },
  coCalc() { const s = this.state.R.st.get(this.state.CO.id), pr = s.lost ? 0 : s.pr, win = this.state.CO.win * s.fa, o = this.num($('#cov').value), E = pr * win; $('#cor').innerHTML = `احتمال تقریبی برد: <b>${(pr*100).toFixed(1)}%</b> (خوش‌بینانه؛ حاشیهٔ سایت لحاظ نشده)<br>برد در صورت نگه‌داشتن: <b>${this.nf(win)}</b> · ارزش مورد انتظار نگه‌داشتن: <b>${this.nf(E)}</b>` + (o > 0 ? `<br>پیشنهاد سایت: <b>${o}</b> · احتمال لازم برای ارزش نگه‌داشتن: <b>${win ? (o/win*100).toFixed(1) : '—'}%</b><br><b style="color:var(--${o >= E ? 'color-success' : 'color-warning'})">${o >= E ? 'کش‌اوت از ارزش مورد انتظارِ نگه‌داشتن بیشتر است' : 'نگه‌داشتن ارزش مورد انتظار بیشتری دارد'} (اختلاف ${this.nf(o-E)})</b><br><span class="mut">راهنمای تقریبی است، نه توصیهٔ مالی.</span>` : '<br><span class="mut">مبلغ پیشنهادی سایت را وارد کنید.</span>'; },
  openMap(l) { this.state.MP = { l, R: [] }; $('#mt').textContent = l.home + ' – ' + l.away; $('#mq').value = ''; this.mlist(); $('#mp').showModal(); },
  mlist() { const k = this.fold($('#mq').value).trim() || this.fold(this.state.MP.l.home).split(' ')[0]; this.state.MP.R = this.state.liveEvents.filter(e => this.fold(e.home + ' ' + e.away).includes(k)).slice(0,30); $('#ml').innerHTML = this.state.MP.R.length ? this.state.MP.R.map((e,i) => `<button type="button" class="btn" style="width:100%;margin:3px 0;text-align:start" data-i="${i}">${esc(e.home)} – ${esc(e.away)} <span class="mut sm">${this.SN[e.s] || e.s} ${e.t ? this.fmtT(e.t) : ''}</span></button>`).join('') : '<div class="mut sm">موردی در منابع پیدا نشد؛ کلمهٔ دیگری بنویسید.</div>'; },
  importRecords(recs) { const have = new Set([...this.state.bets, ...this.state.trash].map(r => r.id)), add = recs.filter(r => r && r.id && Array.isArray(r.legs) && !have.has(r.id)); if (!add.length) return this.toast.info('بلیت جدیدی برای افزودن نبود'); if (!confirm(add.length + ' بلیت جدید از ' + recs.length + ' بلیتِ فایل افزوده شود؟ (تکراری‌ها نادیده گرفته می‌شوند)')) return; add.forEach(r => (r.del ? this.state.trash : this.state.bets).push(r)); this.save(); this.render(); this.liveFetch().then(() => this.render()); this.toast.success(add.length + ' بلیت افزوده شد'); },
  exportJson() { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ version: 2, exported: Date.now(), bets: this.state.bets, trash: this.state.trash }, null, 1)], { type: 'application/json' })); a.download = 'betslip-backup-' + new Date().toISOString().slice(0,10) + '.json'; a.click(); },
  openBackup() { const sel = $('#bkd'); sel.innerHTML = ''; for (let i = 0; i < 14; i++) { const d = new Date(Date.now() - i * 864e5).toISOString().slice(0,10); sel.add(new Option(d + (i ? '' : ' (امروز)'), d)); } $('#bkm').textContent = ''; $('#bk').showModal(); },
  openTg() {
    try { const j = await this.api.get('/api/settings'); this.state.settings = j; $('#tc').value = j.chat || ''; $('#ton').checked = !!j.on; $('#tt').value = ''; $('#tt').placeholder = j.hasToken ? 'توکن ذخیره شده؛ برای تغییر، توکن جدید را وارد کنید' : 'توکن ربات'; $('#tst').checked = j.st !== false; $('#tgl').checked = j.gl !== false; $('#ten').checked = j.en !== false; $('#tsm').value = String(j.sum == null ? 15 : j.sum); $('#tmsg').textContent = ''; const r = j.lastRes; $('#tlr').textContent = r ? `آخرین اجرای زمان‌بند: ${Math.round((Date.now() - r.at) / 6e4)} دقیقه پیش` + (r.err ? ' · خطا: ' + r.err : ` · بازی‌ها: ${r.games} · پیام‌ها: ${r.sent}`) : 'زمان‌بند هنوز هیچ‌بار اجرا نشده؛ بدون آن اعلان خودکار ارسال نمی‌شود.'; $('#sg').showModal(); } catch (e) { this.toast.error(e.message); }
  },

  // ============================================================================
  // SCHEDULER
  // ============================================================================
  startScheduler() {
    let stm, lastPing = 0;
    function delay() {
      const now = Date.now();
      for (const b of this.state.bets) { if (b.arch) continue; const s = this.state.R?.st?.get(b.id); if (!s) continue; for (const z of s.L) { if (z.l.fin || z.l.ov) continue; const x = z.x; if (x && (x.st === 'in' || (x.st === 'pre' && x.t && x.t - now < 20 * 6e4 && x.t - now > -4 * 36e5))) return 3e4; } }
      return this.state.pubBets && this.state.pubBets.length ? 6e4 : 3e5;
    }
    const busyUi = () => document.querySelector('dialog[open]') || /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '');
    function tgPing() { if (!this.state.tg || !this.state.tg.on || !this.state.tok || Date.now() - lastPing < 55e3) return; lastPing = Date.now(); this.api.get('/api/notify?me=1&auto=1').catch(() => {}); }
    function sched() { clearTimeout(stm); stm = setTimeout(async () => { if (!document.hidden) { await this.liveFetch(); if (!busyUi()) this.render(); tgPing(); } sched(); }, delay()); }
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.flush(true); else { this.pull().catch(() => {}); this.liveFetch().then(() => { if (!busyUi()) this.render(); }); } });
    addEventListener('pagehide', () => this.flush(true));
    sched();
  },

  busyUi() { return document.querySelector('dialog[open]') || /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || ''); },

  // ============================================================================
  // ACTIONS
  // ============================================================================
  ACT: {
    go: a => App.go(a.dataset.v),
    login: () => App.showLogin(),
    add: () => App.openEditor(null),
    menu: (a, e) => { const m = $('#menu'); if (!m.hidden) { m.hidden = true; return; } m.innerHTML = [['me', 'پروفایل من'], ['stats', 'آمار'], ['trash', 'سطل زباله (' + App.state.trash.length + ')'], ['-'], ['exp', 'خروجی JSON'], ['imp', 'ورود JSON'], ['bak', 'پشتیبان‌های روزانه'], ['tg', 'اعلان و ربات تلگرام'], ['-'], ['out', 'خروج']].map(([k, v]) => (k === '-' ? '<hr>' : `<a data-a="${['me','stats','trash'].includes(k) ? 'go' : k}" data-v="${k}">${v}</a>`)).join(''); m.hidden = false; e.stopPropagation(); },
    tog: (a, e) => { if (e.target.closest('input,select,button,a')) return; const id = a.dataset.id; App.state.open.has(id) ? App.state.open.delete(id) : App.state.open.add(id); App.keepOpen(); App.refresh(); },
    ck: a => { const id = a.dataset.id; App.state.sel.has(id) ? App.state.sel.delete(id) : App.state.sel.add(id); App.bulk(); },
    ed: a => App.openEditor(App.B(a.dataset.id)),
    co: a => App.openCo(App.B(a.dataset.id)),
    ov: (a, e) => { e.preventDefault(); App.openOv(App.B(a.dataset.id), a.dataset.l); },
    map: (a, e) => { e.preventDefault(); App.openMap(App.B(a.dataset.id).legs[a.dataset.l]); },
    ar: a => { const b = App.B(a.dataset.id), s = App.state.R.st.get(b.id); if (!s.won && !s.lost && !confirm('هنوز تمام نشده؛ بایگانی شود؟')) return; b.arch = Date.now(); b.sett = Date.now(); b.res = s.lost ? 'lost' : s.won ? 'won' : 'open'; delete b.keep; App.save(); App.render(); },
    un: a => { const b = App.B(a.dataset.id); ['arch','res','auto','sett'].forEach(k => delete b[k]); b.keep = 1; App.save(); App.render(); },
    del: a => { const b = App.B(a.dataset.id); if (!confirm('بلیت به سطل زباله برود؟ (30 روز قابل بازگردانی است)')) return; App.state.bets = App.state.bets.filter(x => x !== b); b.del = Date.now(); App.state.trash.push(b); App.save(); App.render(); },
    sh: a => App.copy(App.lnk(App.B(a.dataset.id).share)),
    cls: a => { App.state.cls = App.state.cls === a.dataset.v ? '' : a.dataset.v; App.render(); },
    fg: a => { const k = a.dataset.v; App.state.fil = { g: k, n: a.dataset.n }; App.state.bets.filter(b => b.legs.some(l => App.Core.gk(l) === k)).forEach(b => App.state.open.add(b.id)); App.keepOpen(); App.go('bets'); },
    fb: a => { App.state.fil = { b: a.dataset.v, n: a.dataset.n }; App.state.open.add(a.dataset.v); App.keepOpen(); App.go('bets'); },
    nf: () => { App.state.fil = null; App.render(); },
    sel: () => { App.state.sel = App.state.sel ? null : new Set(); App.render(); },
    'bk-off': () => { App.state.sel = null; App.render(); },
    'bk-all': () => { const t = App.state.tab === 'hist'; App.state.bets.filter(b => !!b.arch === t).forEach(b => App.state.sel.add(b.id)); App.render(); },
    'bk-ar': () => { const bs = App.state.bets.filter(b => App.state.sel.has(b.id)); if (!bs.length) return; if (bs.some(b => !App.state.R.st.get(b.id).won && !App.state.R.st.get(b.id).lost) && !confirm('بعضی از بلیت‌ها هنوز تمام نشده‌اند؛ همه بایگانی شوند؟')) return; bs.forEach(b => { const s = App.state.R.st.get(b.id); b.arch = Date.now(); b.sett = b.arch; b.res = s.lost ? 'lost' : s.won ? 'won' : 'open'; delete b.keep; }); App.state.sel = null; App.save(); App.render(); },
    'bk-un': () => { App.state.bets.filter(b => App.state.sel.has(b.id)).forEach(b => { ['arch','res','auto','sett'].forEach(k => delete b[k]); b.keep = 1; }); App.state.sel = null; App.save(); App.render(); },
    'bk-del': () => { const bs = App.state.bets.filter(b => App.state.sel.has(b.id)); if (!bs.length || !confirm(bs.length + ' بلیت به سطل زباله برود؟')) return; bs.forEach(b => { b.del = Date.now(); App.state.trash.push(b); }); App.state.bets = App.state.bets.filter(b => !b.del); App.state.sel = null; App.save(); App.render(); },
    rs: a => { const b = App.state.trash.find(x => x.id === a.dataset.id); App.state.trash = App.state.trash.filter(x => x !== b); delete b.del; App.state.bets.push(b); App.save(); App.render(); },
    pd: a => { if (!confirm('برای همیشه حذف شود؟')) return; App.state.trash = App.state.trash.filter(x => x.id !== a.dataset.id); App.save(); App.render(); },
    emp: () => { if (!confirm('سطل خالی شود؟')) return; App.state.trash = []; App.save(); App.render(); },
    exp: () => App.exportJson(),
    imp: () => $('#fi').click(),
    bak: () => App.openBackup(),
    tg: () => App.openTg(),
    out: async () => { try { await App.api.post('/api/auth', { action: 'logout' }); } catch (e) {} ['tok','me'].forEach(k => App.storage.set(k, '')); App.state.tok = ''; App.state.me = ''; App.state.bets = []; App.state.trash = []; App.state.profile = null; App.state.snapshots = {}; App.state.entry = null; location.hash = '#/board'; App.route(); App.render(); App.showLogin(); },
    saveprof: async () => { try { const j = await App.api.put('/api/profile', { method: 'PUT', body: { name: $('#pf-name').value, bio: $('#pf-bio').value, pub: $('#pf-pub').checked, dvis: $('#pf-vis').value } }); App.state.profile = j.profile; App.state.board = null; App.toast.success('پروفایل ذخیره شد'); App.render(); } catch (e) { App.toast.error(e.message); } },
    copyprof: () => App.copy(location.origin + BASE + '/?u=' + App.state.me),
    pass: async () => { try { await App.api.post('/api/auth', { method: 'POST', body: { action: 'passwd', pass: $('#pw-old').value, npass: $('#pw-new').value } }); $('#pw-old').value = ''; $('#pw-new').value = ''; App.toast.success('رمز تغییر کرد'); } catch (e) { App.toast.error(e.message); } },
  },

  // Helper functions
  B(id) { return this.state.bets.find(b => b.id === id) || this.state.trash.find(b => b.id === id); },
  keepOpen() { this.storage.set('open', JSON.stringify([...this.state.open])); },
  refresh() { this.state.tab === 'bets' || this.state.tab === 'hist' ? this.renderList() : this.render(); },
  renderList() { this.render(); },
  lnk(t) => location.origin + BASE + '/?s=' + t,
  copy(u) { navigator.clipboard ? navigator.clipboard.writeText(u).then(() => alert('لینک کپی شد:\n' + u), () => prompt('لینک:', u)) : prompt('لینک:', u); },
  nf(n) { return n.toLocaleString('fa-IR'); },
  escHtml: escapeHtml,
  Core: { gk: l => l.pick.split('&')[0] } // Simplified for now
};

/* ============================================================================
   INITIALIZATION
   ============================================================================ */

document.addEventListener('DOMContentLoaded', () => App.init());

// Export for global access
window.App = App;
window.Toast = Toast;
window.Modal = Modal;
window.Theme = Theme;
window.API = API;
window.Storage = Storage;
window.State = State;