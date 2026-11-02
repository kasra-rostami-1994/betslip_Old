// وب‌هوک ربات تلگرام: فقط به چتِ خودِ شما پاسخ می‌دهد (Chat ID + secret token).
const { kv } = require('./_lib');
const C = require('./_core');
const { EM, hm, dt, call, send, analyze } = require('./_tg');
const KB = { keyboard: [[{ text: '/bets' }, { text: '/live' }], [{ text: '/risk' }, { text: '/summary' }], [{ text: '/stats' }, { text: '/status' }, { text: '/help' }]], resize_keyboard: true };
const HELP = '🤖 دستورات Betslip\n\n/bets — فهرست بلیت‌های فعال\n/bet N — جزئیات یک بلیت (شماره یا بخشی از نام)\n/live — بازی‌های زنده\n/risk — بازی‌های پرخطر\n/summary — خلاصهٔ کامل\n/stats — آمار بلیت‌های تمام‌شده\n/status — وضعیت اعلان‌های خودکار';
const B = (i) => (i.st == 'lost' ? '❌' : i.st == 'won' ? '🏆' : '▫️');
const cn = (c) => `🟢${c.g} 🔵${c.b} 🟠${c.o} 🔴${c.r} ⚪${c.n}`;
const gm = (x) => (!x ? '' : x.st == 'pre' ? (x.t ? hm(x.t) : '') : `${x.h}–${x.a}${x.st == 'in' ? (x.over ? ' (وقت اضافه)' : x.min ? ` (${x.min}′)` : '') : ' (پایان)'}`);
const list = (A) => (A.bets.length ? `🎫 بلیت‌های فعال (${A.bets.length})\n\n` + A.bets.map((i, k) => `${k + 1}. ${B(i)} ${i.b.name} ×${i.b.odds} · 📅 ${dt(i.b.created)}\n   ${cn(i.cnt)} · ~${Math.round(i.pr * 100)}٪`).join('\n') + '\n\nجزئیات: /bet شماره' : 'بلیت فعالی ندارید.');
const t0 = (p) => (p.x && p.x.t ? new Date(p.x.t).getTime() : 9e15);
const detail = (i) => `🎫 ${i.b.name} ×${i.b.odds} · 📅 ${dt(i.b.created)} · مبلغ ${i.b.stake} · برد ${i.b.win} · ~${Math.round(i.pr * 100)}٪\n${B(i)} ${cn(i.cnt)}\n\n` + [...i.L].sort((p, q) => (p.x && p.x.st == 'in' ? 0 : 1) - (q.x && q.x.st == 'in' ? 0 : 1) || t0(p) - t0(q)).map((z) => `${EM[z.c]} ${z.l.home} – ${z.l.away} · ${z.x ? gm(z.x) : 'پیدا نشد'}\n   ${C.pickTxt(z.l.pick, z.l)} (${z.l.odds})`).join('\n');
const live = (A) => {
  const G = Object.values(A.games).filter((g) => g.x && g.x.st == 'in');
  if (!G.length) { const up = Object.values(A.games).filter((g) => g.x && g.x.st == 'pre' && g.x.t).sort((p, q) => t0(p) - t0(q)).slice(0, 6); return 'الان بازی زنده‌ای از بلیت‌های فعال نیست.' + (up.length ? '\n\n⏰ بازی‌های بعدی:\n' + up.map((g) => `${hm(g.x.t)}  ${g.l.home} – ${g.l.away}`).join('\n') : ''); }
  return '🔴 بازی‌های زنده:\n\n' + G.map((g) => `⚽ ${g.l.home} ${gm(g.x)} ${g.l.away}\n` + g.rows.filter((r) => A.st[r.b.id] != 'lost' || r.d).map((r) => `   ${EM[r.c]} ${r.b.name}: ${C.pickTxt(r.l.pick, r.l)}`).join('\n')).join('\n\n');
};
const TL = { 5: '🔴 بحرانی', 4: '🟠 نزدیک', 3: '⚪ در انتظار', 2: '🔵 مطابق پیش‌بینی' };
const risk = (A) => {
  const R = Object.values(A.games).map((g) => { const al = g.rows.filter((r) => A.st[r.b.id] != 'lost'), t = !al.length ? 0 : al.some((r) => r.c == 'r') ? 5 : al.some((r) => r.c == 'o') ? 4 : al.some((r) => r.c == 'n') ? 3 : al.some((r) => r.c == 'b') ? 2 : 1, open = al.filter((r) => r.c != 'g'); return { g, t, ns: !g.x || g.x.st == 'pre' ? 1 : 0, open, pot: open.reduce((s, r) => s + (+r.b.win || 0), 0) }; }).filter((a) => a.t >= 2).sort((p, q) => p.ns - q.ns || (p.ns ? t0(p.g) - t0(q.g) : q.t - p.t || q.pot - p.pot));
  if (!R.length) return '✅ بازی پرخطری وجود ندارد.';
  return '⚠️ ریسک بازی‌ها:\n\n' + R.slice(0, 12).map((a) => `${TL[a.t]} · ${a.g.l.home} – ${a.g.l.away} ${gm(a.g.x)}\n   ${a.open.length} بلیت · پتانسیل ${a.pot.toFixed(2)} USDT\n` + a.open.slice(0, 6).map((r) => `   ${EM[r.c]} ${r.b.name}: ${C.pickTxt(r.l.pick, r.l)}`).join('\n')).join('\n\n');
};
const stats = (d) => { const H = d.bets.filter((b) => b.arch && (b.res == 'won' || b.res == 'lost')), W = H.filter((b) => b.res == 'won'), st = H.reduce((s, b) => s + +b.stake, 0), rt = W.reduce((s, b) => s + b.stake * b.odds, 0); return H.length ? `📈 آمار (${H.length} بلیت)\nبرنده ${W.length} · بازنده ${H.length - W.length} · درصد برد ${Math.round((W.length / H.length) * 100)}٪\nمجموع شرط ${st.toFixed(2)} · بازگشت ${rt.toFixed(2)}\nسود/زیان ${(rt - st).toFixed(2)} USDT` : 'هنوز بلیت تمام‌شده‌ای در تاریخچه نیست.'; };
module.exports = async (q, s) => {
  if (q.method !== 'POST') return s.status(200).end();
  try {
    const u = String((q.query && q.query.u) || ''), cfg = JSON.parse((await kv(['GET', 'betslip:tgc:' + u])) || 'null');
    if (!cfg || !cfg.hs || q.headers['x-telegram-bot-api-secret-token'] !== cfg.hs) return s.status(401).end();
    const up = typeof q.body === 'string' ? JSON.parse(q.body) : q.body || {}, cb = up.callback_query, m = cb ? cb.message : up.message;
    if (!m || String(m.chat.id) !== String(cfg.chat)) return s.status(200).json({ ok: 1 });
    let cmd, arg = '';
    if (cb) { await call(cfg, 'answerCallbackQuery', { callback_query_id: cb.id }); const p = String(cb.data).split(':'); cmd = '/' + p[0]; arg = p[1] || ''; }
    else { const mm = String(m.text || '').trim().match(/^(\/\w+)(?:@\w+)?\s*([\s\S]*)$/); cmd = mm ? mm[1].toLowerCase() : '/help'; arg = mm ? mm[2].trim() : ''; }
    const data = JSON.parse((await kv(['GET', 'betslip:d:' + u])) || '{"bets":[]}');
    if (cmd == '/start' || cmd == '/help') { await send(cfg, HELP, KB); return s.json({ ok: 1 }); }
    if (cmd == '/status') {
      const lr = +(await kv(['GET', 'betslip:lastrun'])) || 0, rs = JSON.parse((await kv(['GET', 'betslip:lastres'])) || 'null');
      await send(cfg, lr ? `🛠 آخرین اجرای زمان‌بند: ${Math.round((Date.now() - lr) / 6e4)} دقیقه پیش\n` + (rs ? (rs.err ? 'خطا: ' + rs.err : `بازی‌ها: ${rs.games} · پیام ارسال‌شده: ${rs.sent}`) : '') : '🛠 زمان‌بند هنوز هیچ‌بار اجرا نشده؛ اعلان خودکار بدون آن کار نمی‌کند (راهنما در README).');
      return s.json({ ok: 1 });
    }
    if (cmd == '/stats') { await send(cfg, stats(data)); return s.json({ ok: 1 }); }
    const base = cfg.base || process.env.SITE_BASE || 'https://' + q.headers.host;
    const E = (await (await fetch(base + '/api/live?apif=1')).json()).events || [], A = analyze(data, E);
    let text, mk;
    if (cmd == '/bets') { text = list(A); mk = A.bets.length ? { inline_keyboard: A.bets.reduce((r, _, k) => { if (k % 5 == 0) r.push([]); r[r.length - 1].push({ text: String(k + 1), callback_data: 'bet:' + (k + 1) }); return r; }, []) } : undefined; }
    else if (cmd == '/bet') {
      const i = /^\d+$/.test(arg) ? A.bets[+arg - 1] : arg ? A.bets.find((z) => z.b.name.toLowerCase().includes(arg.toLowerCase())) : null;
      text = i ? detail(i) : arg ? 'بلیتی با این شماره یا نام پیدا نشد.\n\n' + list(A) : list(A);
    }
    else if (cmd == '/live') text = live(A);
    else if (cmd == '/risk') text = risk(A);
    else if (cmd == '/summary') text = live(A) + '\n\n' + risk(A) + '\n\n' + list(A);
    else text = HELP;
    await send(cfg, text, mk);
    s.json({ ok: 1 });
  } catch (e) { s.status(200).json({ error: String(e.message || e) }); }
};
