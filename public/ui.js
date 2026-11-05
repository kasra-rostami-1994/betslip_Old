/* ui.js: نماها (بلیت‌ها، ریسک، تاریخچه، سطل، رتبه‌بندی، پروفایل) */
const U = { tab: 'bets', sort: ls.g('srt') || 'risk', tag: '', q: '', cls: '', fil: null, sel: null, open: new Set(), range: ls.g('rng') || '30', gran: 'auto', hres: '', hrange: 'all', pubBets: null, board: null, rank: null, pu: null, share: null };
try { JSON.parse(ls.g('open') || '[]').forEach((i) => U.open.add(i)); } catch (e) {}
let R = { st: new Map(), now: Date.now() };
const CLR = { wr: 'r', near: 'o', ok: 'b', wait: 'n', won: 'g', lost: 'r' };
const CLN = { wr: 'پای اشتباهِ زنده', near: 'نزدیک به پیش‌بینی', ok: 'زنده و مطابق', wait: 'در انتظار شروع', won: 'برنده', lost: 'باخت قطعی' };
const VIS = { private: 'خصوصی', link: 'فقط با لینک', public: 'عمومی (در پروفایل)' };
const tm = (t) => (t ? new Date(t).toLocaleTimeString('fa-IR-u-nu-latn', { hour: '2-digit', minute: '2-digit', hour12: false }) : '');
const lnk = (t) => location.origin + BASE + '/?s=' + t;
const pft = (b) => (b.res == 'won' ? b.stake * b.odds - b.stake : -b.stake);
const stt = (x) => (x.st == 'post' ? (x.aet ? 'پایان 90 دقیقه (وقت اضافه بود)' : 'پایان') : x.over ? '90 دقیقه تمام؛ وقت اضافه' : esc(x.clk || 'زنده'));
const tagsH = (b) => (b.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('');
/* ---- محاسبه، ذخیرهٔ نتیجهٔ نهایی بازی‌ها و بایگانی خودکارِ باخت قطعی ---- */
function compute() {
  const now = Date.now(); R = { st: new Map(), now, auto: 0 }; let ch = 0;
  for (const b of S.bets) {
    const s = Core.betState(b, S.LV, now); R.st.set(b.id, s);
    if (b.arch || !S.tok) continue;
    s.L.forEach((z) => {
      const x = z.x, l = z.l;
      if (x && x.st == 'post' && !x.man && !x.fin && !l.fin && !l.ov && x.t && x.t < now) { l.fin = { h: x.h, a: x.a, w: x.w || 0, t: x.t.toISOString(), lg: x.lg || '' }; ch = 1; }
      if (x && x.lg && !l.lg) { l.lg = x.lg; ch = 1; }
    });
    if (s.finLoss && !b.keep) { b.arch = now; b.sett = now; b.res = 'lost'; b.auto = 1; ch = 1; R.auto++; }
  }
  if (ch) save();
}
/* ---- ردیف بلیت ---- */
function legRow(z, b, mode, i) {
  const x = z.x, l = z.l, pub = mode == 'pub', live = x && x.st == 'in';
  const sc = x && x.st != 'pre' ? `<b>${x.h}–${x.a}</b><small>${stt(x)}</small>` : `<b>–</b><small>${x ? (x.pp ? 'تعویق یا لغو' : x.t ? fDM(x.t) + ' · ' + tm(x.t) : '') : S.at ? 'در منابع نیست' : '…'}</small>`;
  const nm = x && x.src ? x.src[0][0] : '';
  const bd = x && x.man ? '<small>منبع: دستی</small>' : x && x.fin ? '<small>منبع: ذخیره‌شده</small>' : x && x.src ? (x.cf ? '<small class="w">⚠ اختلاف: ' + x.src.map((q) => esc(q[0]) + ' ' + q[1]).join(' | ') + '</small>' : `<small class="${nm.includes('+') ? 'v' : ''}">${nm.includes('+') ? '✓ ' : ''}${esc(nm)}</small>`) : '';
  const lk = pub ? '' : !x && S.at && !l.ov && !l.fin ? `<a href="#" data-a="map" data-id="${b.id}" data-l="${i}">انتخاب دستی بازی</a>` : x && x.man && x.st == 'in' ? `<a href="#" data-a="ov" data-id="${b.id}" data-l="${i}">ثبت نتیجهٔ نهایی</a>` : '';
  const g = x && x.goals && x.goals.length ? `<div class="gl">${x.goals.map((q) => '⚽ ' + esc(q.m) + ' ' + esc(q.n) + (q.f ? ' (' + q.f + ')' : '')).join(' · ')}</div>` : '';
  return `<div class="leg${U.fil && U.fil.g == Core.gk(l) ? ' hl' : ''}"><i class="mk c-${z.c}${live ? ' live' : ''}"></i><div><div class="t">${esc(l.home)} – ${esc(l.away)}</div><div class="s">${esc(Core.pickTxt(l.pick, l))} · ${(+l.odds).toFixed(2)}${Core.lbl(l.pick, x)}</div>${g}</div>
  <div class="sc"${pub ? '' : ` data-a="ov" data-id="${b.id}" data-l="${i}" tabindex="0" role="button" title="${esc(x && x.ref ? 'تطبیق با: ' + x.ref + ' (کلیک = ورود دستی نتیجه)' : 'ورود دستی نتیجه')}"`}>${sc}${bd}${lk}</div></div>`;
}
function betRow(b, s, mode) {
  const pub = mode == 'pub', hist = mode == 'hist', open = pub || U.open.has(b.id), id = b.id;
  const col = hist ? (b.res == 'won' ? 'g' : b.res == 'lost' ? 'r' : 'n') : CLR[s.cls];
  const chip = hist ? (b.res == 'won' ? 'برنده' : b.res == 'lost' ? 'بازنده' : 'بدون نتیجه') : s.cls == 'wr' ? s.wr + ' پای اشتباهِ زنده' : CLN[s.cls] + (s.live && s.cls != 'wr' && s.cls != 'lost' ? ' · ' + s.live + ' زنده' : '');
  const L = s.L.map((z, i) => ({ ...z, i })).sort((p, q) => (p.x && p.x.st == 'in' ? 0 : 1) - (q.x && q.x.st == 'in' ? 0 : 1) || (p.x && p.x.t ? +p.x.t : 8e15) - (q.x && q.x.t ? +q.x.t : 8e15));
  const ts = L.map((z) => z.x && z.x.t && +z.x.t).filter(Boolean), d1 = ts.length ? Math.min(...ts) : 0, d2 = ts.length ? Math.max(...ts) : 0;
  const dates = (pub ? '' : `ساخت ${fD(b.created)}`) + (d1 ? `${pub ? '' : ' · '}بازی‌ها ${fD(d1)}${fD(d1) != fD(d2) ? ' تا ' + fD(d2) : ''}` : '') + (b.arch && !pub ? ` · ${hist ? 'تسویه' : 'بایگانی'} ${fD(b.sett || b.arch)}` : '');
  const pr = s.lost ? 0 : s.pr, ck = U.sel && !pub ? `<input type="checkbox" class="ck" data-a="ck" data-id="${id}"${U.sel.has(id) ? ' checked' : ''} aria-label="انتخاب">` : '';
  const money = pub ? '' : hist ? `<span>مبلغ <b>${nf(b.stake)}</b></span>${b.res ? `<span style="color:${clrP(pft(b))}">سود/زیان <b style="color:inherit">${sgn(pft(b))}</b></span>` : ''}` : `<span>مبلغ <b>${nf(b.stake)}</b></span><span>برد <b>${nf(b.win * (s.fa || 1))}</b></span>${b.cash != null ? `<span>کش‌اوت <b>${b.cash}</b></span>` : ''}`;
  const acts = pub ? '' : `<div class="acts"><button class="lnk" data-a="ed" data-id="${id}">ویرایش</button>${hist ? '' : `<button class="lnk" data-a="co" data-id="${id}">کش‌اوت</button>`}<select data-a="vis" data-id="${id}" title="نمایش برای دیگران">${Object.entries(VIS).map(([k, v]) => `<option value="${k}"${(b.vis || 'private') == k ? ' selected' : ''}>${v}</option>`).join('')}</select>${b.share ? `<button class="lnk" data-a="sh" data-id="${id}">کپی لینک</button>` : ''}<span style="flex:1"></span><button class="lnk" data-a="${hist ? 'un' : 'ar'}" data-id="${id}">${hist ? 'بازگردانی به فعال' : 'بایگانی'}</button><button class="lnk d" data-a="del" data-id="${id}">حذف</button></div>`;
  const chev = open ? '▲' : '▼';
  return `<article class="bet${pub ? ' pub' : ''}" style="--c:var(--${col})"><div class="bh" data-a="tog" data-id="${id}"><h3>${ck}${esc(b.name)}${pub ? '' : tagsH(b)}${b.auto && !pub ? '<span class="tag" title="به‌صورت خودکار بایگانی شد">خودکار</span>' : ''}${b.vis && b.vis != 'private' && !pub ? `<span class="tag" title="${VIS[b.vis]}">${b.vis == 'public' ? 'عمومی' : 'لینک'}</span>` : ''}</h3><div class="num">×${nf(b.odds)}</div>
  <div class="meta"><span class="tag c" style="--c:var(--${col})">${chip}</span><span>${L.length} بازی</span><span><b style="color:var(--g)">${s.cnt.g}</b> درست</span>${s.cnt.b ? `<span><b style="color:var(--b)">${s.cnt.b}</b> مطابق</span>` : ''}${s.cnt.o ? `<span><b style="color:var(--o)">${s.cnt.o}</b> نزدیک</span>` : ''}${s.cnt.r ? `<span><b style="color:var(--r)">${s.cnt.r}</b> اشتباه</span>` : ''}${hist ? '' : `<span>احتمال ~<b>${pct(pr)}</b></span>`}</div><div class="meta" style="justify-content:flex-end">${money}</div></div>
  <div class="meta">${dates}</div><div class="seg">${['g', 'b', 'o', 'r', 'n'].map((k) => `<i style="flex:${s.cnt[k]};--c:var(--${k})"></i>`).join('')}</div>
  ${b.note && !pub ? `<div class="meta" style="margin-top:6px">📝 ${esc(b.note)}</div>` : ''}${open ? `<div class="legs">${L.map((z) => legRow(z, b, mode, z.i)).join('')}</div>${acts}` : ''}<div class="chev" data-a="tog" data-id="${id}" title="${open ? 'بسته کردن' : 'باز کردن'}">${chev}</div></article>`;
}
const pct = (p) => (p > 0 && p < .01 ? '<1%' : Math.round(p * 100) + '%');
/* ---- فیلتر و مرتب‌سازی ---- */
const matchQ = (b, q) => { q = q.trim().toLowerCase(); return !q || (b.name + ' ' + (b.tags || []).join(' ') + ' ' + (b.note || '') + ' ' + b.legs.map((l) => l.home + ' ' + l.away).join(' ')).toLowerCase().includes(q); };
const filt = (a) => a.filter((b) => matchQ(b, U.q)).filter((b) => !U.tag || (b.tags || []).includes(U.tag)).filter((b) => !U.fil || (U.fil.g ? b.legs.some((l) => Core.gk(l) == U.fil.g) : b.id == U.fil.b));
const SORTS = { risk: (a, b) => R.st.get(b.id).risk - R.st.get(a.id).risk || b.win - a.win, new: (a, b) => b.created - a.created, old: (a, b) => a.created - b.created, odds: (a, b) => b.odds - a.odds, win: (a, b) => b.win - a.win };
const tagOpts = () => { const T = [...new Set(S.bets.flatMap((b) => b.tags || []))].sort(); if (U.tag && !T.includes(U.tag)) U.tag = ''; return T.length ? `<select data-a="tag"><option value="">همهٔ برچسب‌ها</option>${T.map((t) => `<option${t == U.tag ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>` : ''; };
const toolbar = (hist) => `<div class="bar"><input data-a="q" placeholder="جستجو: نام بلیت، تیم، برچسب…" value="${esc(U.q)}" style="flex:1;min-width:160px">${hist ? `<select data-a="hres">${[['', 'همه نتایج'], ['won', 'برنده‌ها'], ['lost', 'بازنده‌ها']].map(([k, v]) => `<option value="${k}"${U.hres == k ? ' selected' : ''}>${v}</option>`).join('')}</select><select data-a="hrange">${[['all', 'همهٔ زمان‌ها'], ['7', '7 روز'], ['30', '30 روز'], ['90', '90 روز']].map(([k, v]) => `<option value="${k}"${U.hrange == k ? ' selected' : ''}>${v}</option>`).join('')}</select>` : `<select data-a="sort">${[['risk', 'بیشترین ریسک'], ['new', 'جدیدترین'], ['old', 'قدیمی‌ترین'], ['odds', 'بیشترین ضریب'], ['win', 'بیشترین برد']].map(([k, v]) => `<option value="${k}"${U.sort == k ? ' selected' : ''}>${v}</option>`).join('')}</select>`}${tagOpts()}<button class="btn" data-a="sel">${U.sel ? 'پایان انتخاب' : 'انتخاب گروهی'}</button><button class="btn" data-a="col-all" title="بستن همه بلیت‌ها">همه بسته</button><button class="btn" data-a="exp-all" title="باز کردن همه بلیت‌ها">همه باز</button></div>`;
const filBar = () => (U.fil ? `<div class="fil"><span>فیلتر: <b>${esc(U.fil.n)}</b></span><button class="lnk" data-a="nf">حذف فیلتر</button></div>` : '');
/* ---- بلیت‌های فعال ---- */
function vBets() {
  const act = S.bets.filter((b) => !b.arch), sts = act.map((b) => R.st.get(b.id)), C = {}, G = new Map();
  sts.forEach((s) => { C[s.cls] = (C[s.cls] || 0) + 1; s.L.forEach((z) => G.set(Core.gk(z.l), z.x)); });
  const live = [...G.values()].filter((x) => x && x.st == 'in').length, ok = sts.filter((s) => !s.lost);
  return `<div class="strip">${kp(act.length, 'بلیت فعال')}${kp(live, 'بازی زنده')}${kp(nf(ok.reduce((s, x) => s + +x.b.stake, 0)), 'شرطِ در جریان')}${kp(nf(ok.reduce((s, x) => s + x.b.win * x.fa, 0)), 'برد در صورت موفقیت همه')}</div>
  <div class="bar">${['wr', 'near', 'ok', 'wait', 'won', 'lost'].filter((k) => C[k]).map((k) => `<button class="pill${U.cls == k ? ' on' : ''}" data-a="cls" data-v="${k}"><i class="mk c-${CLR[k]}"></i>${CLN[k]} <em>${C[k]}</em></button>`).join('')}</div>${toolbar(0)}<div id="list">${listBets()}</div>`;
}
function listBets() {
  const a = filt(S.bets.filter((b) => !b.arch)).filter((b) => !U.cls || R.st.get(b.id).cls == U.cls).sort(SORTS[U.sort] || SORTS.risk);
  return filBar() + (a.length ? a.map((b) => betRow(b, R.st.get(b.id), 'act')).join('') : `<div class="empty">${S.bets.some((b) => !b.arch) ? 'بلیتی با این فیلتر نیست.' : 'هنوز بلیت فعالی ندارید.<br><br><button class="btn p" data-a="add">+ افزودن بلیت</button>'}</div>`);
}
/* ---- تاریخچه ---- */
function listHist() {
  const lim = U.hrange == 'all' ? 0 : Date.now() - +U.hrange * 864e5;
  const a = filt(S.bets.filter((b) => b.arch)).filter((b) => !U.hres || b.res == U.hres).filter((b) => (b.sett || b.arch) >= lim).sort((p, q) => (q.sett || q.arch) - (p.sett || p.arch));
  const sm = Core.summary(a);
  return `<div class="strip">${kp(a.length, 'بلیت')}${kp(sm.won, 'برنده', 'var(--g)')}${kp(sm.lost, 'بازنده', 'var(--r)')}${kp(sgn(sm.profit), 'سود/زیان (USDT)', clrP(sm.profit))}</div>` + filBar() + (a.length ? a.map((b) => betRow(b, R.st.get(b.id), 'hist')).join('') : '<div class="empty">بلیتی در بایگانی نیست.</div>');
}
const vHist = () => toolbar(1) + `<div id="list">${listHist()}</div>`;
/* ---- ریسک مشترک ---- */
const TL = { 5: ['بحرانی', 'r'], 4: ['نزدیک', 'o'], 3: ['در انتظار', 'n'], 2: ['مطابق پیش‌بینی', 'b'], 1: ['تمام‌شده و درست', 'g'] };
const lvTxt = (x) => (!x ? '' : x.st == 'pre' ? (x.t ? tm(x.t) : '') : x.h + '–' + x.a + ' · ' + (x.st == 'post' ? 'پایان' : x.over ? '90 تمام' : x.min ? x.min + "'" : 'زنده'));
function vRisk() {
  const G = new Map(), now = Date.now();
  S.bets.filter((b) => !b.arch).forEach((b) => { const s = R.st.get(b.id); if (s.lost) return; s.L.forEach((z) => { const k = Core.gk(z.l); if (!G.has(k)) G.set(k, { l: z.l, x: z.x, k, rows: [] }); G.get(k).rows.push({ b, z }); }); });
  const A = [...G.values()].map((g) => { const rs = g.rows, t = rs.some((r) => r.z.c == 'r') ? 5 : rs.some((r) => r.z.c == 'o') ? 4 : rs.some((r) => r.z.c == 'n') ? 3 : rs.some((r) => r.z.c == 'b') ? 2 : 1, op = rs.filter((r) => r.z.c != 'g'), x = g.x; return { g, x, t, ns: !x || x.st == 'pre' ? 1 : 0, n: op.length, pot: op.reduce((s, r) => s + (+r.b.win || 0), 0), el: x && x.st == 'in' ? (x.over ? 90 : x.min || 45) : 0, ko: x && x.t ? x.t - now : 9e15 }; })
    .sort((p, q) => p.ns - q.ns || (p.ns ? p.ko - q.ko || q.pot - p.pot : q.t - p.t || q.pot - p.pot || q.el - p.el));
  if (!A.length) return '<div class="empty">بلیت فعالی نیست.</div>';
  return `<div class="strip">${kp(A.filter((a) => a.t == 5).length, 'بازیِ بحرانی')}${kp(A.filter((a) => a.t == 4).length, 'نزدیک')}${kp(A.filter((a) => !a.ns).length, 'بازیِ شروع‌شده')}${kp(A.filter((a) => a.ns).length, 'شروع‌نشده')}</div>
<div class="risk-grid">${A.map((a) => { const c = TL[a.t]; return `<article class="bet risk-card" style="--c:var(--${c[1]})"><div class="bh" data-a="fg" data-v="${esc(a.g.k)}" data-n="${esc(a.g.l.home + ' – ' + a.g.l.away)}" title="نمایش بلیت‌های شامل این بازی"><h3 class="ltr">${esc(a.g.l.home)} – ${esc(a.g.l.away)}${a.x ? ` <span style="color:var(--${c[1]})">(${lvTxt(a.x)})</span>` : ''}</h3><span class="tag c" style="--c:var(--${c[1]})">${c[0]}</span></div>
    <div class="meta sm">${a.n} بلیت · <b>${nf(a.pot)}</b> USDT</div><div class="legs sm">${a.g.rows.map((r) => `<div class="leg" data-a="fb" data-v="${r.b.id}" data-n="${esc(r.b.name)}" style="cursor:pointer"><i class="mk c-${r.z.c}"></i><div><div class="t" style="text-align:start;direction:rtl">${esc(r.b.name)} <span class="mut sm">×${nf(r.b.odds)}</span> ${tagsH(r.b)}</div><div class="s">${esc(Core.pickTxt(r.z.l.pick, r.z.l))} · ${(+r.z.l.odds).toFixed(2)}${r.b.note ? ' · 📝 ' + esc(r.b.note) : ''}</div></div><span></span></div>`).join('')}</div></article>`; }).join('')}</div>`;
}
/* ---- سطل زباله ---- */
function vTrash() {
  const T = S.trash.slice().sort((a, b) => b.del - a.del);
  return `<div class="bar"><h2 style="font-size:22px">سطل زباله</h2><span class="sp"></span>${T.length ? '<button class="btn" data-a="emp">خالی کردن سطل</button>' : ''}</div><div class="mut sm" style="margin-bottom:10px">بلیت‌های حذف‌شده 30 روز نگه داشته می‌شوند.</div>` + (T.length ? T.map((b) => { const d = Math.floor((Date.now() - b.del) / 864e5); return `<article class="bet" style="--c:var(--n)"><div class="bh" style="cursor:default"><h3>${esc(b.name)}</h3><div class="num">×${nf(b.odds)}</div><div class="meta">${b.legs.length} بازی · ${d} روز پیش حذف شد · ${30 - d} روز تا حذف نهایی</div></div><div class="acts"><button class="lnk" data-a="rs" data-id="${b.id}">بازگردانی</button><button class="lnk d" data-a="pd" data-id="${b.id}">حذف دائمی</button></div></article>`; }).join('') : '<div class="empty">سطل خالی است.</div>');
}
/* ---- رتبه‌بندی و پروفایل‌ها ---- */
function vBoard() {
  const rows = U.board;
  const me = S.me || (rows && rows[0] ? rows[0].u : '');
  return `<div class="bar"><h2 style="font-size:22px">رتبه‌بندی</h2><span class="sp"></span><span class="mut sm">فقط پروفایل‌های عمومی</span></div>` + (!rows ? '<div class="empty">در حال دریافت…</div>' : !rows.length ? '<div class="empty">هنوز پروفایل عمومی‌ای نیست. در «پروفایل من» عمومی‌اش کنید.</div>' : rows.map((r, i) => `<div class="lb" data-a="go" data-v="u/${esc(r.u)}"><span class="rk">${i + 1}</span><span>${esc(r.name)} <span class="mut sm ltr">@${esc(r.u)}</span></span><span>${r.won}/${r.n}</span><span style="color:${clrP(r.roi)}">${sgn(r.roi * 100)}%</span><b style="font-weight:400;font-size:20px">${r.score}</b>${r.u !== me ? `<button class="lnk" data-a="compare" data-u1="${esc(me)}" data-u2="${esc(r.u)}" style="margin-inline-start:8px">مقایسه</button>` : ''}</div>`).join('')) + '<div class="mut sm" style="margin-top:14px">ستون‌ها: بلیت‌های برده از کل · ROI · امتیاز</div>';
}
const profHead = (p, sm, rank) => `<div class="ph"><div class="av">${esc((p.name || p.u || '?')[0])}</div><div><h2 style="font-size:24px">${esc(p.name)}</h2><div class="mut sm"><span class="ltr">@${esc(p.u)}</span> · عضو از ${fD(p.joined)}</div>${p.bio ? `<div>${esc(p.bio)}</div>` : ''}</div></div>
  <div class="grid">${kp(p.score != null ? p.score : sm.score, 'امتیاز')}${rank ? kp('#' + rank, 'رتبه') : ''}${kp(sm.n, 'بلیت تمام‌شده')}${kp(sm.n ? Math.round(sm.won / sm.n * 100) + '%' : '—', 'درصد برد')}${kp(sm.n ? sgn(sm.roi * 100) + '%' : '—', 'ROI', clrP(sm.roi))}</div>`;
function vMe() {
  const p = S.prof || { u: S.me, name: S.me, bio: '', pub: false, dvis: 'private', joined: Date.now() }, sm = Core.summary(S.bets), nPub = S.bets.filter((b) => b.vis == 'public' && !b.del).length, nLink = S.bets.filter((b) => b.vis == 'link' && !b.del).length;
  return profHead(p, sm, U.rank) + `<div class="card"><h3>نمایه و حریم خصوصی</h3><div class="row"><input id="pf-name" placeholder="نام نمایشی" value="${esc(p.name)}" maxlength="30"><select id="pf-vis" title="حالت پیش‌فرض بلیت‌های جدید">${Object.entries(VIS).map(([k, v]) => `<option value="${k}"${(p.dvis || 'private') == k ? ' selected' : ''}>بلیت جدید: ${v}</option>`).join('')}</select></div><div class="row"><input id="pf-bio" placeholder="دربارهٔ من (حداکثر 160 حرف)" value="${esc(p.bio)}" maxlength="160"></div>
  <div class="row"><label class="sm"><input type="checkbox" id="pf-pub"${p.pub ? ' checked' : ''}> پروفایل من عمومی باشد (نام، امتیاز و آمار کلی در رتبه‌بندی دیده شود؛ مبلغ‌ها هرگز نشان داده نمی‌شوند)</label></div><div class="row"><button class="btn p" data-a="saveprof">ذخیره</button>${p.pub ? `<button class="btn" data-a="copyprof">کپی لینک پروفایل</button>` : ''}<span class="mut sm">${nPub} بلیت عمومی · ${nLink} بلیت لینکی</span></div></div>
  <div class="card"><h3>ابزارها</h3><div class="row"><button class="btn" data-a="go" data-v="stats">آمار کامل</button><button class="btn" data-a="go" data-v="trash">سطل (${S.trash.length})</button><button class="btn" data-a="exp">خروجی JSON</button><button class="btn" data-a="imp">ورود JSON</button><button class="btn" data-a="bak">پشتیبان‌های روزانه</button><button class="btn" data-a="tg">اعلان تلگرام</button></div></div>
  <div class="card"><h3>تغییر رمز</h3><div class="row"><input id="pw-old" type="password" placeholder="رمز فعلی" autocomplete="current-password"><input id="pw-new" type="password" placeholder="رمز جدید (حداقل 8 کاراکتر)" autocomplete="new-password"><button class="btn" data-a="pass">تغییر</button></div></div>
  <div class="card"><h3>نحوهٔ محاسبهٔ امتیاز</h3><div class="sm mut">هر بلیتِ برده: 10 × ln(ضریب) امتیاز (مثلاً ضریب 2 ≈ +7 و ضریب 20 ≈ +30)؛ هر بلیتِ باخته: ‑5. نتیجهٔ بلیت‌ها را خود سیستم از منابع نتیجه تعیین می‌کند. فرمول در <span class="ltr">core.js</span> قابل تغییر است.</div></div>`;
}
function vUser() {
  const d = U.pu; if (!d) return '<div class="empty">در حال دریافت…</div>'; if (d.err) return '<div class="empty">این پروفایل پیدا نشد یا عمومی نیست.</div>';
  const st = d.profile.stats || {};
  return profHead(d.profile, { n: st.n || 0, won: st.won || 0, roi: st.roi || 0, score: d.profile.score }, 0) + '<div class="sec"><h2>بلیت‌های عمومی</h2></div>' + (d.bets.length ? d.bets.map((b) => betRow(b, Core.betState(b, S.LV), 'pub')).join('') : '<div class="empty">بلیت عمومی‌ای ندارد.</div>');
}
function vShare() {
  const d = U.share; if (!d) return '<div class="empty">در حال دریافت…</div>'; if (d.err) return '<div class="empty">این لینک معتبر نیست یا اشتراک‌گذاری آن لغو شده است.</div>';
  return `<div class="mut sm" style="margin-bottom:6px">بلیت اشتراک‌گذاری‌شده از <span class="ltr">@${esc(d.by)}</span></div>` + betRow(d.bet, Core.betState(d.bet, S.LV), 'pub');
}
function vCompare() {
  const d1 = U.cpu1, d2 = U.cpu2;
  if (!d1 || !d2) return '<div class="empty">در حال دریافت…</div>';
  if (d1.err || d2.err) return '<div class="empty">یکی از پروفایل‌ها پیدا نشد یا عمومی نیست.</div>';
  const p1 = d1.profile, p2 = d2.profile;
  const s1 = p1.stats || { n: 0, won: 0, lost: 0, roi: 0 }, s2 = p2.stats || { n: 0, won: 0, lost: 0, roi: 0 };
  const score1 = p1.score || 0, score2 = p2.score || 0;
  const n1 = s1.n || 0, n2 = s2.n || 0;
  const w1 = s1.won || 0, w2 = s2.won || 0;
  const roi1 = s1.roi || 0, roi2 = s2.roi || 0;
  return `<div class="bar"><h2 style="font-size:22px">مقایسه کاربران</h2><span class="sp"></span></div>
<div class="two">
  <div class="card"><h3>${esc(p1.name)} <span class="mut sm ltr">@${esc(p1.u)}</span></h3>
  <div class="grid">
    ${kp(score1, 'امتیاز')}${kp('#' + (U.board ? U.board.findIndex(r => r.u == p1.u) + 1 : '—'), 'رتبه')}
    ${kp(n1, 'بلیت تمام‌شده')}${kp(n1 ? Math.round(w1 / n1 * 100) + '%' : '—', 'درصد برد')}
    ${kp(n1 ? sgn(roi1 * 100) + '%' : '—', 'ROI', clrP(roi1))}
  </div></div>
  <div class="card"><h3>${esc(p2.name)} <span class="mut sm ltr">@${esc(p2.u)}</span></h3>
  <div class="grid">
    ${kp(score2, 'امتیاز')}${kp('#' + (U.board ? U.board.findIndex(r => r.u == p2.u) + 1 : '—'), 'رتبه')}
    ${kp(n2, 'بلیت تمام‌شده')}${kp(n2 ? Math.round(w2 / n2 * 100) + '%' : '—', 'درصد برد')}
    ${kp(n2 ? sgn(roi2 * 100) + '%' : '—', 'ROI', clrP(roi2))}
  </div></div>
</div>
<div class="card"><h3>تفاوت‌ها</h3>
<div class="grid">
  ${kp(n1 - n2, 'تفاوت بلیت‌ها', n1 >= n2 ? 'var(--g)' : 'var(--r)')}
  ${kp(w1 - w2, 'تفاوت بردها', w1 >= w2 ? 'var(--g)' : 'var(--r)')}
  ${kp(sgn((roi1 - roi2) * 100) + '%', 'تفاوت ROI', roi1 >= roi2 ? 'var(--g)' : 'var(--r)')}
  ${kp(score1 - score2, 'تفاوت امتیاز', score1 >= score2 ? 'var(--g)' : 'var(--r)')}
</div></div>
<div class="card"><h3>بلیت‌های عمومی (مقایسه)</h3>
<div class="two">
  <div><h4>${esc(p1.name)}</h4>${d1.bets.length ? d1.bets.map(b => betRow(b, Core.betState(b, S.LV), 'pub')).join('') : '<div class="empty">بلیت عمومی‌ای ندارد.</div>'}</div>
  <div><h4>${esc(p2.name)}</h4>${d2.bets.length ? d2.bets.map(b => betRow(b, Core.betState(b, S.LV), 'pub')).join('') : '<div class="empty">بلیت عمومی‌ای ندارد.</div>'}</div>
</div></div>`;
}
/* ---- پوسته، مسیریابی و رندر ---- */
const TABS = [['bets', 'بلیت‌ها'], ['risk', 'ریسک'], ['hist', 'تاریخچه'], ['stats', 'آمار'], ['board', 'رتبه‌بندی']];
function mountShell() {
  $('#root').innerHTML = `<header><div class="wrap hd"><div class="brand" data-a="go" data-v="bets"><i></i>betslip</div><nav id="nav"></nav><span id="sync" data-s="idle"></span><div id="acc"></div></div></header><main class="wrap" id="view"></main><footer id="ver"></footer><div id="menu" class="menu" hidden></div><div id="dlg"></div><div id="toast"></div>`;
  $('#ver').textContent = 'Betslip - Update: ' + VER;
}
function renderHead() {
  const guest = !S.tok;
  $('#nav').innerHTML = (guest ? [['board', 'رتبه‌بندی']] : TABS).map(([k, v]) => `<a data-a="go" data-v="${k}" class="${U.tab == k ? 'on' : ''}">${v}</a>`).join('');
  $('#acc').innerHTML = guest ? '<button class="btn p" data-a="login">ورود</button>' : `<div style="display:flex;gap:10px;align-items:center"><button class="btn p" data-a="add">+ بلیت</button><button class="av" data-a="menu" aria-label="منو">${esc((S.prof && S.prof.name || S.me || '?')[0])}</button></div>`;
}
function render() {
  compute(); renderHead(); const v = $('#view'); let h = '';
  switch (U.tab) {
    case 'bets': h = vBets(); break; case 'risk': h = vRisk(); break; case 'hist': h = vHist(); break; case 'stats': h = vStats(); break;
    case 'trash': h = vTrash(); break; case 'board': h = vBoard(); break; case 'me': h = vMe(); break; case 'u': h = vUser(); break; case 'share': h = vShare(); break; case 'compare': h = vCompare(); break;
  }
  v.innerHTML = h; bulk();
  if (R.auto) toast(R.auto + ' بلیت به‌دلیل باخت قطعی خودکار به بایگانی رفت.', 6000);
}
function renderList() { const l = $('#list'); if (l) l.innerHTML = U.tab == 'hist' ? listHist() : listBets(); bulk(); }
function bulk() {
  const bar = $('#bulk'); if (!bar) return; bar.hidden = !U.sel || !(U.tab == 'bets' || U.tab == 'hist'); if (bar.hidden) return;
  const n = U.sel.size, h = U.tab == 'hist';
  bar.innerHTML = `<span>${n} انتخاب</span><button class="btn" data-a="bk-all">انتخاب همه</button><button class="btn p" data-a="${h ? 'bk-un' : 'bk-ar'}"${n ? '' : ' disabled'}>${h ? 'بازگردانی' : 'بایگانی'}</button><button class="btn" data-a="bk-del"${n ? '' : ' disabled'}>حذف</button><button class="btn" data-a="bk-off">پایان</button>`;
}
