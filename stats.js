/* stats.js: تحلیل آماری بر اساس بازهٔ زمانی (روز/هفته/ماه شمسی) */
const nf = (n, d) => (+n).toLocaleString('en-US', { maximumFractionDigits: d == null ? 2 : d });
const sgn = (n) => (n > 0 ? '+' : '') + nf(n);
const clrP = (n) => (n > 0 ? 'var(--g)' : n < 0 ? 'var(--r)' : 'var(--mut)');
const fD = (t) => (t ? new Date(t).toLocaleDateString('fa-IR-u-nu-latn') : '');
const fDM = (t) => new Intl.DateTimeFormat('fa-IR-u-nu-latn', { month: 'numeric', day: 'numeric' }).format(new Date(t));
const jm = (t) => { const p = {}; new Intl.DateTimeFormat('fa-IR-u-nu-latn-ca-persian', { year: 'numeric', month: 'numeric' }).formatToParts(new Date(t)).forEach((x) => (p[x.type] = x.value)); return p; };
const JM = (t) => { const p = jm(t); return p.year + '/' + String(p.month).padStart(2, '0'); };
const MN = (t) => new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'long' }).format(new Date(t));
const WD = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
const wday = (t) => (new Date(t).getDay() + 1) % 7; // شنبه = ۰
function bucketOf(t, g) {
  const d = new Date(t);
  if (g == 'day') return { k: d.toISOString().slice(0, 10), l: fDM(t), t: +new Date(d.getFullYear(), d.getMonth(), d.getDate()) };
  if (g == 'week') { const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - wday(t)); return { k: s.toISOString().slice(0, 10), l: fDM(+s), t: +s }; }
  return { k: JM(t), l: MN(t), t: +new Date(d.getFullYear(), d.getMonth(), 1) };
}
function statRows(range) {
  const lim = range == 'all' ? 0 : Date.now() - (+range) * 864e5;
  return Core.settled(S.bets).map((b) => ({ b, t: b.sett || b.arch, p: b.res == 'won' ? b.stake * b.odds - b.stake : -b.stake, w: b.res == 'won' })).filter((h) => h.t >= lim).sort((a, b) => a.t - b.t);
}
function kpis(D) {
  const n = D.length, W = D.filter((h) => h.w), st = D.reduce((s, h) => s + +h.b.stake, 0), pr = D.reduce((s, h) => s + h.p, 0);
  let cur = 0, ty = 0, bw = 0, bl = 0, run = 0, peak = 0, dd = 0, last = '';
  D.forEach((h) => { const k = h.w ? 'w' : 'l'; if (k == ty) cur++; else { ty = k; cur = 1; } if (k == 'w') bw = Math.max(bw, cur); else bl = Math.max(bl, cur); run += h.p; peak = Math.max(peak, run); dd = Math.max(dd, peak - run); });
  return { n, won: W.length, lost: n - W.length, rate: n ? W.length / n : 0, staked: st, profit: pr, roi: st ? pr / st : 0, avgOdds: n ? D.reduce((s, h) => s + +h.b.odds, 0) / n : 0, avgStake: n ? st / n : 0, best: n ? Math.max(...D.map((h) => h.p)) : 0, worst: n ? Math.min(...D.map((h) => h.p)) : 0, streak: ty == 'w' ? cur : -cur, bw, bl, dd, legs: n ? D.reduce((s, h) => s + h.b.legs.length, 0) / n : 0 };
}
const legHit = (l) => Core.ev(l.pick, Object.assign({}, l.fin, { st: 'post' }))[0] == 'g';
function legRows(range) {
  const lim = range == 'all' ? 0 : Date.now() - (+range) * 864e5, out = [];
  S.bets.forEach((b) => b.legs.forEach((l) => { if (l.fin && +new Date(l.fin.t || b.created) >= lim) out.push({ l, b, hit: legHit(l) }); }));
  return out;
}
const mkt = (p) => (p.includes('&') ? 'ترکیبی' : /^(1|2|X)$/.test(p) ? 'برد/مساوی' : /^(1X|X2|12)$/.test(p) ? 'شانس دوگانه' : /^[OU]/.test(p) ? 'مجموع گل' : /^[HA][OU]/.test(p) ? 'گل تیمی' : /^B[YN]$/.test(p) ? 'هر دو گل' : /^Q/.test(p) ? 'صعود' : /^AH/.test(p) ? 'هندیکپ' : 'گل دقیق');
const band = (o) => (o < 1.2 ? 'زیر 1.20' : o < 1.5 ? '1.20 تا 1.49' : o < 2 ? '1.50 تا 1.99' : '2.00 به بالا');
const sizeB = (n) => (n <= 3 ? '۱ تا ۳ بازی' : n <= 8 ? '۴ تا ۸ بازی' : n <= 15 ? '۹ تا ۱۵ بازی' : '۱۶ بازی به بالا');
function group(items, key, val) { const m = {}; items.forEach((x) => { const k = key(x); (m[k] = m[k] || { n: 0, w: 0, p: 0, e: 0 }); m[k].n++; const v = val(x); m[k].w += v.w; m[k].p += v.p || 0; m[k].e += v.e || 0; }); return Object.entries(m).sort((a, b) => b[1].n - a[1].n); }
/* ---- نمودارها (SVG ساده) ---- */
function lineChart(pts) {
  if (pts.length < 2) return '<div class="mut sm">برای نمودار حداقل دو بلیت تمام‌شده لازم است.</div>';
  const W = 640, H = 170, P = 8, xs = pts.map((p) => p.t), x0 = Math.min(...xs), x1 = Math.max(...xs) || 1, vs = pts.map((p) => p.v).concat(0), lo = Math.min(...vs), hi = Math.max(...vs), r = hi - lo || 1;
  const X = (t) => P + ((t - x0) / (x1 - x0 || 1)) * (W - 2 * P), Y = (v) => H - 22 - ((v - lo) / r) * (H - 40);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + X(p.t).toFixed(1) + ' ' + Y(p.v).toFixed(1)).join(' '), z = Y(0), last = pts[pts.length - 1].v, c = last >= 0 ? 'var(--g)' : 'var(--r)';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="سود و زیان تجمعی"><line x1="0" x2="${W}" y1="${z}" y2="${z}" stroke="var(--ln)" stroke-dasharray="3 4"/><path d="${d} L${X(x1).toFixed(1)} ${z} L${X(x0).toFixed(1)} ${z}Z" fill="${c}" opacity=".09"/><path d="${d}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>${pts.filter((_, i) => pts.length < 40 || i % Math.ceil(pts.length / 40) == 0 || i == pts.length - 1).map((p) => `<circle cx="${X(p.t).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="3" fill="${c}"><title>${esc(p.l)}: ${sgn(p.v)}</title></circle>`).join('')}<text x="${P}" y="${H - 4}">${fD(x0)}</text><text x="${W - P}" y="${H - 4}" text-anchor="end">${fD(x1)}</text><text x="${P}" y="12">${nf(hi)}</text><text x="${P}" y="${H - 28}">${nf(lo)}</text></svg>`;
}
function barChart(B, fmt, color) {
  if (!B.length) return '<div class="mut sm">داده‌ای در این بازه نیست.</div>';
  const W = Math.max(320, B.length * 46), H = 160, z = 80, mx = Math.max(1e-9, ...B.map((b) => Math.abs(b.v))), step = Math.ceil(B.length / 14);
  return `<div style="overflow-x:auto"><svg class="chart" viewBox="0 0 ${W} ${H}" style="min-width:${W}px" role="img"><line x1="0" x2="${W}" y1="${z}" y2="${z}" stroke="var(--ln)"/>${B.map((b, i) => { const h = Math.abs(b.v) / mx * 58, x = i * 46 + 8, y = b.v >= 0 ? z - h : z, c = color ? color(b.v) : b.v >= 0 ? 'var(--g)' : 'var(--r)'; return `<rect x="${x}" y="${y}" width="30" height="${Math.max(h, 1.5)}" rx="3" fill="${c}"><title>${esc(b.l)}: ${fmt(b.v)}${b.n ? ' · ' + b.n + ' بلیت' : ''}</title></rect><text x="${x + 15}" y="${b.v >= 0 ? y - 4 : y + h + 11}" text-anchor="middle">${fmt(b.v)}</text>${i % step == 0 ? `<text x="${x + 15}" y="${H - 6}" text-anchor="middle">${esc(b.l)}</text>` : ''}`; }).join('')}</svg></div>`;
}
function hrows(title, rows, o) {
  o = o || {};
  const body = rows.length ? rows.map(([k, v]) => { const rate = v.n ? v.w / v.n : 0, c = o.profit ? clrP(v.p) : rate >= (v.n ? v.e / v.n : 0) && o.exp ? 'var(--g)' : o.exp ? 'var(--o)' : 'var(--ink)'; const val = o.profit ? Math.min(100, Math.abs(v.p) / (o.max || 1) * 100) : rate * 100; return `<div class="tr"><span>${esc(k)}</span><div class="bx"><i style="width:${val}%;background:${c}"></i>${o.exp ? `<u style="inset-inline-start:${Math.min(99, (v.e / v.n) * 100)}%"></u>` : ''}</div><span>${o.profit ? sgn(v.p) + ' · ' : ''}${Math.round(rate * 100)}% · ${v.w}/${v.n}</span></div>`; }).join('') : '<div class="mut sm">داده‌ای نیست</div>';
  return `<div class="card"><h3>${title}</h3>${body}${o.exp ? '<div class="mut sm" style="margin-top:6px">خط عمودی = درصدی که ضرایب نشان می‌دادند</div>' : ''}</div>`;
}
const kp = (v, l, c) => `<div class="kpi"><b${c ? ` style="color:${c}"` : ''}>${v}</b><span>${l}</span></div>`;
function vStats() {
  const rg = U.range, D = statRows(rg), K = kpis(D), gran = U.gran == 'auto' ? (rg == 'all' || +rg > 90 ? 'month' : +rg > 30 ? 'week' : 'day') : U.gran;
  const B = {}; D.forEach((h) => { const q = bucketOf(h.t, gran); (B[q.k] = B[q.k] || { l: q.l, t: q.t, v: 0, n: 0, w: 0 }); B[q.k].v += h.p; B[q.k].n++; if (h.w) B[q.k].w++; });
  const BK = Object.values(B).sort((a, b) => a.t - b.t); let run = 0;
  const cum = D.map((h) => ({ t: h.t, v: (run += h.p), l: h.b.name }));
  const LG = legRows(rg), lh = LG.filter((z) => z.hit).length, imp = LG.length ? LG.reduce((s, z) => s + 1 / z.l.odds, 0) / LG.length : 0;
  const act = S.bets.filter((b) => !b.arch), as = act.map((b) => R.st.get(b.id)).filter(Boolean), at = as.filter((s) => !s.lost);
  const ex = at.reduce((s, x) => s + x.pr * x.b.win, 0), stk = at.reduce((s, x) => s + +x.b.stake, 0);
  const mx = Math.max(1, ...Object.values(D.reduce((m, h) => { m[h.b.id] = h; return m; }, {})).map((h) => Math.abs(h.p)));
  const tagG = group(D.flatMap((h) => (h.b.tags || []).map((t) => ({ t, h }))), (x) => x.t, (x) => ({ w: x.h.w ? 1 : 0, p: x.h.p }));
  const wdG = group(D, (h) => WD[wday(h.t)], (h) => ({ w: h.w ? 1 : 0, p: h.p })).sort((a, b) => WD.indexOf(a[0]) - WD.indexOf(b[0]));
  const pmax = (rows) => Math.max(1, ...rows.map(([, v]) => Math.abs(v.p)));
  const sel = (k, opts, v) => `<select data-a="st" data-k="${k}">${opts.map(([a, b]) => `<option value="${a}"${a == v ? ' selected' : ''}>${b}</option>`).join('')}</select>`;
  return `<div class="bar"><h2 style="font-size:22px">آمار و تحلیل</h2><span class="sp"></span>${sel('range', [['7', '۷ روز اخیر'], ['30', '۳۰ روز اخیر'], ['90', '۹۰ روز اخیر'], ['365', 'یک سال اخیر'], ['all', 'همهٔ زمان‌ها']], rg)}${sel('gran', [['auto', 'واحد زمان: خودکار'], ['day', 'روزانه'], ['week', 'هفتگی'], ['month', 'ماهانه (شمسی)']], U.gran)}</div>
  ${K.n ? '' : '<div class="mut sm">در این بازه بلیت تمام‌شده‌ای نیست؛ آمار بعد از بایگانی بلیت‌ها ساخته می‌شود.</div>'}
  <div class="grid">${kp(K.n, 'بلیت تمام‌شده')}${kp(Math.round(K.rate * 100) + '%', `درصد برد (${K.won} از ${K.n})`)}${kp(sgn(K.profit), 'سود/زیان (USDT)', clrP(K.profit))}${kp((K.roi * 100).toFixed(1) + '%', 'ROI روی مجموع شرط', clrP(K.roi))}${kp(nf(K.staked), 'مجموع شرط')}${kp(nf(K.avgOdds), 'میانگین ضریب')}${kp(nf(K.avgStake), 'میانگین مبلغ هر بلیت')}${kp(nf(K.legs, 1), 'میانگین تعداد بازی')}${kp(sgn(K.best), 'بهترین بلیت', 'var(--g)')}${kp(sgn(K.worst), 'بدترین بلیت', 'var(--r)')}${kp(K.streak ? (K.streak > 0 ? K.streak + ' برد' : -K.streak + ' باخت') : '—', 'روند فعلی')}${kp(K.bw + ' / ' + K.bl, 'بیشترین برد / باخت پیاپی')}${kp(nf(K.dd), 'بیشترین افت از قله')}</div>
  <div class="card"><h3>سود و زیان تجمعی</h3>${lineChart(cum)}</div>
  <div class="two"><div class="card"><h3>سود و زیان هر ${gran == 'day' ? 'روز' : gran == 'week' ? 'هفته' : 'ماه'}</h3>${barChart(BK, (v) => nf(v, 1))}</div>
  <div class="card"><h3>درصد برد هر ${gran == 'day' ? 'روز' : gran == 'week' ? 'هفته' : 'ماه'}</h3>${barChart(BK.map((b) => ({ l: b.l, n: b.n, v: b.n ? Math.round(b.w / b.n * 100) : 0 })), (v) => v + '%', () => 'var(--b)')}</div></div>
  <div class="card"><h3>کیفیت پیش‌بینی (بازی‌به‌بازی)</h3><div class="grid" style="padding:4px 0 0">${kp(LG.length, 'بازیِ تمام‌شده')}${kp(LG.length ? Math.round(lh / LG.length * 100) + '%' : '—', 'درصد درستی بازی‌ها')}${kp(LG.length ? Math.round(imp * 100) + '%' : '—', 'درصدِ مورد انتظار از ضرایب')}${kp(LG.length ? sgn((lh / LG.length - imp) * 100).replace(/^(.+)$/, '$1٪') : '—', 'برتری نسبت به ضرایب', clrP(lh / (LG.length || 1) - imp))}</div><div class="mut sm">اگر درصد درستی از درصد مورد انتظار بیشتر باشد، پیش‌بینی‌هایتان از ضرایب سایت بهتر بوده است.</div></div>
  <div class="two">${hrows('درستی هر نوع بازار', group(LG, (z) => mkt(z.l.pick), (z) => ({ w: z.hit ? 1 : 0, e: 1 / z.l.odds })), { exp: 1 })}${hrows('درستی بر اساس ضریب', group(LG, (z) => band(z.l.odds), (z) => ({ w: z.hit ? 1 : 0, e: 1 / z.l.odds })), { exp: 1 })}
  ${hrows('درستی هر لیگ', group(LG, (z) => z.l.lg || (z.l.fin && z.l.fin.lg) || 'نامشخص', (z) => ({ w: z.hit ? 1 : 0, e: 1 / z.l.odds })).slice(0, 12), { exp: 1 })}${hrows('سود و زیان بر اساس اندازهٔ بلیت', group(D, (h) => sizeB(h.b.legs.length), (h) => ({ w: h.w ? 1 : 0, p: h.p })), { profit: 1, max: Math.max(1, Math.abs(K.profit), mx) })}
  ${hrows('سود و زیان بر اساس روز هفته', wdG, { profit: 1, max: pmax(wdG) })}${hrows('سود و زیان بر اساس برچسب', tagG, { profit: 1, max: pmax(tagG) })}</div>
  <div class="card"><h3>بلیت‌های فعال (در جریان)</h3><div class="grid" style="padding:4px 0 0">${kp(as.length, 'بلیت فعال')}${kp(nf(stk), 'مجموع شرطِ در جریان')}${kp(nf(at.reduce((s, x) => s + +x.b.win, 0)), 'برد در صورت موفقیت همه')}${kp(sgn(ex - stk), 'سود مورد انتظار (تقریبی)', clrP(ex - stk))}</div><div class="mut sm">سود مورد انتظار از روی ضرایب باقی‌ماندهٔ هر بلیت حساب می‌شود و حاشیهٔ سایت را در نظر نمی‌گیرد.</div></div>`;
}
