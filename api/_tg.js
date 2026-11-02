// ابزارهای مشترک تلگرام: ارسال پیام، انتخاب نتیجهٔ هر بازی و تحلیل بلیت‌ها
const C = require('./_core');
const EM = { g: '🟢', b: '🔵', o: '🟠', r: '🔴', n: '⚪' };
const TZ = process.env.TIMEZONE || 'Europe/Istanbul';
const hm = (t) => new Date(t).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const dt = (t) => new Date(t).toLocaleDateString('fa-IR', { timeZone: TZ });
const call = (cfg, method, body) => fetch('https://api.telegram.org/bot' + cfg.token + '/' + method, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
const send = async (cfg, text, markup) => {
  const parts = []; let cur = '';
  text.split('\n').forEach((ln) => { if (cur && (cur + '\n' + ln).length > 3800) { parts.push(cur); cur = ln; } else cur = cur ? cur + '\n' + ln : ln; });
  if (cur) parts.push(cur);
  let ok = true;
  for (let i = 0; i < parts.length; i++) { const j = await call(cfg, 'sendMessage', { chat_id: cfg.chat, text: parts[i], ...(markup && i == parts.length - 1 ? { reply_markup: markup } : {}) }); ok = ok && !!j.ok; }
  return ok;
};
const pick = (l, E) => {
  if (l.ov) return { h: l.ov.h, a: l.ov.a, w: l.ov.w, st: l.ov.f ? 'post' : 'in', min: l.ov.m || 45 };
  if (l.fin) return { h: l.fin.h, a: l.fin.a, w: l.fin.w, st: 'post' };
  const bs = {};
  E.filter((e) => C.mt(l, e)).forEach((e) => { const d = Math.abs(new Date(e.t) - Date.now()) || 0; if (!bs[e.s] || d < bs[e.s].d) bs[e.s] = { e, d }; });
  const v = Object.values(bs).map((o) => o.e).sort((a, b) => a.p - b.p)[0];
  if (!v) return null;
  return v.st == 'post' && v.t && new Date(v.t) > Date.now() + 6e4 ? { ...v, st: 'pre' } : v;
};
const analyze = (data, E) => {
  const games = {}, bets = [], st = {};
  data.bets.filter((b) => !b.arch).sort((a, b) => a.created - b.created).forEach((b) => {
    const L = b.legs.map((l) => { const x = pick(l, E), [c, d] = C.ev(l.pick, x); return { l, x, c, d }; });
    if (!b.keep && L.some((z) => z.d && z.x && (z.x.st == 'post' || z.x.over))) return; // باخت قطعی و تمام‌شده: مثل سایت، بایگانی حساب می‌شود
    let dead = false, all = true, pr = 1; const cnt = { g: 0, b: 0, o: 0, r: 0, n: 0 };
    L.forEach((z) => {
      if (z.d) dead = true;
      if (z.c != 'g') { all = false; pr /= z.l.odds; }
      cnt[z.c]++;
      const k = z.l.home + '|' + z.l.away, g = games[k] || (games[k] = { l: z.l, x: z.x, rows: [] });
      g.rows.push({ b, l: z.l, c: z.c, d: z.d });
    });
    st[b.id] = dead ? 'lost' : all ? 'won' : 'open';
    bets.push({ b, st: st[b.id], cnt, pr: dead ? 0 : all ? 1 : pr, L });
  });
  return { games, bets, st };
};
module.exports = { EM, hm, dt, call, send, pick, analyze };
