// هر ۵ دقیقه توسط GitHub Actions صدا زده می‌شود؛ تغییر نتیجهٔ بازی‌ها و برنده/بازنده شدن بلیت‌ها را به تلگرام می‌فرستد.
const { kv } = require('./_lib');
const C = require('./_core');
const EM = { g: '🟢', b: '🔵', o: '🟠', r: '🔴', n: '⚪' };
const tg = (cfg, text) => fetch('https://api.telegram.org/bot' + cfg.token + '/sendMessage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: cfg.chat, text: text.slice(0, 3900) }) }).then((r) => r.json());
const pick = (l, E) => {
  if (l.ov) return { h: l.ov.h, a: l.ov.a, w: l.ov.w, st: l.ov.f ? 'post' : 'in', min: l.ov.m || 45 };
  if (l.fin) return { h: l.fin.h, a: l.fin.a, w: l.fin.w, st: 'post' };
  const bs = {};
  E.filter((e) => C.mt(l, e)).forEach((e) => { const d = Math.abs(new Date(e.t) - Date.now()) || 0; if (!bs[e.s] || d < bs[e.s].d) bs[e.s] = { e, d }; });
  const v = Object.values(bs).map((o) => o.e).sort((a, b) => a.p - b.p)[0];
  if (!v) return null;
  return v.st == 'post' && v.t && new Date(v.t) > Date.now() + 6e4 ? { ...v, st: 'pre' } : v;
};
module.exports = async (q, s) => {
  if (!process.env.CRON_SECRET || q.headers.authorization !== 'Bearer ' + process.env.CRON_SECRET) return s.status(401).end();
  try {
    const users = (await kv(['SMEMBERS', 'betslip:tg'])) || [];
    if (!users.length) return s.json({ users: 0 });
    const base = process.env.SITE_BASE || 'https://' + q.headers.host;
    const E = (await (await fetch(base + '/api/live?apif=1')).json()).events || [];
    let sent = 0;
    for (const u of users) {
      const cfg = JSON.parse((await kv(['GET', 'betslip:tgc:' + u])) || 'null');
      if (!cfg || !cfg.on || !cfg.token || !cfg.chat) continue;
      const data = JSON.parse((await kv(['GET', 'betslip:d:' + u])) || '{"bets":[]}');
      const key = 'betslip:ns:' + u, prev = JSON.parse((await kv(['GET', key])) || 'null'), next = { g: {}, b: {} }, msgs = [], games = {};
      data.bets.filter((b) => !b.arch).forEach((b) => {
        let dead = false, all = true;
        b.legs.forEach((l) => {
          const x = pick(l, E), [c, d] = C.ev(l.pick, x);
          if (d) dead = true;
          if (c != 'g') all = false;
          const k = l.home + '|' + l.away, g = games[k] || (games[k] = { l, x, rows: [] });
          g.rows.push({ b, l, c, d });
        });
        next.b[b.id] = dead ? 'lost' : all ? 'won' : 'open';
        const pv = prev && prev.b[b.id];
        if (pv && pv != next.b[b.id] && next.b[b.id] != 'open') msgs.push(next.b[b.id] == 'won' ? `🏆 بلیت «${b.name}» برنده شد! (برد: ${b.win})` : `❌ بلیت «${b.name}» سوخت.`);
      });
      Object.values(games).forEach((g) => {
        const x = g.x, k = g.l.home + '|' + g.l.away;
        if (!x || x.st == 'pre') { next.g[k] = 'pre'; return; }
        const sig = x.st + ' ' + x.h + '-' + x.a;
        next.g[k] = sig;
        const pv = prev && prev.g[k];
        if (pv !== undefined && pv !== sig && (pv !== 'pre' || x.h + x.a > 0 || x.st == 'post')) {
          const rows = g.rows.filter((r) => next.b[r.b.id] != 'lost' || r.d);
          msgs.push((x.st == 'post' ? '🏁 پایان: ' : '⚽ ') + g.l.home + ' ' + x.h + '–' + x.a + ' ' + g.l.away + (x.st == 'in' && x.min ? ` (${x.min}′)` : '') + '\n' + rows.map((r) => `${EM[r.c]} ${r.b.name}: ${C.pickTxt(r.l.pick, r.l)}${r.d ? ' ❌' : ''}`).join('\n'));
        }
      });
      if (prev && msgs.length) { await tg(cfg, msgs.join('\n\n')); sent++; }
      await kv(['SET', key, JSON.stringify(next)]);
    }
    s.json({ users: users.length, sent });
  } catch (e) { s.status(500).json({ error: String(e.message || e) }); }
};
