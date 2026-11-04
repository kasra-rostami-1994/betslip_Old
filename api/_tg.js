// ابزارهای مشترک تلگرام: ارسال پیام و تحلیل بلیت‌ها (با همان Core سایت)
const C = require('./_core');
const EM = { g: '🟢', b: '🔵', o: '🟠', r: '🔴', n: '⚪' };
const TZ = process.env.TIMEZONE || 'Europe/Istanbul';
const hm = (t) => new Date(t).toLocaleTimeString('fa-IR-u-nu-latn', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
const dt = (t) => new Date(t).toLocaleDateString('fa-IR-u-nu-latn', { timeZone: TZ });
const call = (cfg, method, body) => fetch('https://api.telegram.org/bot' + cfg.token + '/' + method, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
const send = async (cfg, text, markup) => {
  const parts = []; let cur = '';
  text.split('\n').forEach((ln) => { if (cur && (cur + '\n' + ln).length > 3800) { parts.push(cur); cur = ln; } else cur = cur ? cur + '\n' + ln : ln; });
  if (cur) parts.push(cur);
  let ok = true;
  for (let i = 0; i < parts.length; i++) { const j = await call(cfg, 'sendMessage', { chat_id: cfg.chat, text: parts[i], ...(markup && i == parts.length - 1 ? { reply_markup: markup } : {}) }); ok = ok && !!j.ok; }
  return ok;
};
const analyze = (recs, E, now) => {
  now = now || Date.now();
  const games = {}, bets = [], st = {};
  recs.filter((b) => !b.arch && !b.del).sort((a, b) => a.created - b.created).forEach((b) => {
    const S = C.betState(b, E, now);
    if (S.finLoss && !b.keep) return; // باخت قطعی و تمام‌شده: مثل سایت بایگانی حساب می‌شود
    S.L.forEach((z) => { const k = C.gk(z.l), g = games[k] || (games[k] = { l: z.l, x: z.x, rows: [] }); g.rows.push({ b, l: z.l, c: z.c, d: z.d }); });
    st[b.id] = S.lost ? 'lost' : S.won ? 'won' : 'open';
    bets.push({ b, st: st[b.id], cnt: S.cnt, pr: S.pr, L: S.L });
  });
  return { games, bets, st };
};
module.exports = { EM, hm, dt, call, send, analyze };
