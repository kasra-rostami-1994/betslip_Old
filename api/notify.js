// زمان‌بند (cron) آن را صدا می‌زند. شروع بازی، گل (با گل‌زن)، پایان بازی، برنده/بازنده شدن بلیت و خلاصهٔ دوره‌ای را به تلگرام می‌فرستد.
// حالت آزمایشی: کاربر واردشده با ?me=1 فقط برای خودش اجرا می‌کند و خلاصه را همان لحظه می‌گیرد.
const { kv, user } = require('./_lib');
const C = require('./_core');
const { EM, hm, send, pick } = require('./_tg');
module.exports = async (q, s) => {
  const sec = process.env.CRON_SECRET, cron = !!sec && (q.headers.authorization === 'Bearer ' + sec || (q.query && q.query.key === sec));
  const me = cron ? null : await user(q);
  if (!cron && !me) return s.status(401).end();
  try {
    if (cron) await kv(['SET', 'betslip:lastrun', String(Date.now())]);
    const users = cron ? (await kv(['SMEMBERS', 'betslip:tg'])) || [] : [me], auto = !cron && !!q.query && q.query.auto === '1', force = !cron && !auto;
    const out = { users: users.length, events: 0, games: 0, live: 0, missing: 0, sent: 0 };
    if (!users.length) return s.json(out);
    let base = process.env.SITE_BASE;
    if (!base) { const c0 = JSON.parse((await kv(['GET', 'betslip:tgc:' + users[0]])) || 'null'); base = (c0 && c0.base) || 'https://' + q.headers.host; }
    const E = (await (await fetch(base + '/api/live?apif=1')).json()).events || [];
    out.events = E.length;
    const now = Date.now();
    for (const u of users) {
      const cfg = JSON.parse((await kv(['GET', 'betslip:tgc:' + u])) || 'null');
      if (!cfg || !cfg.token || !cfg.chat || (!force && !cfg.on)) continue;
      if (!(await kv(['SET', 'betslip:lock:' + u, '1', 'NX', 'EX', '20']))) continue;
      const O = { st: cfg.st !== false, gl: cfg.gl !== false, en: cfg.en !== false, sum: cfg.sum === undefined ? 15 : +cfg.sum };
      const data = JSON.parse((await kv(['GET', 'betslip:d:' + u])) || '{"bets":[]}');
      const key = 'betslip:ns:' + u, prev = JSON.parse((await kv(['GET', key])) || 'null');
      const next = { g: {}, b: {}, sumAt: (prev && prev.sumAt) || 0 }, msgs = [], games = {}, info = [];
      data.bets.filter((b) => !b.arch || (b.auto && now - b.arch < 36e5)).forEach((b) => {
        let dead = false, all = true, pr = 1; const cnt = { g: 0, b: 0, o: 0, r: 0, n: 0 };
        b.legs.forEach((l) => {
          const x = pick(l, E), [c, d] = C.ev(l.pick, x);
          if (d) dead = true;
          if (c != 'g') { all = false; pr /= l.odds; }
          cnt[c]++;
          const k = l.home + '|' + l.away, g = games[k] || (games[k] = { l, x, rows: [] });
          g.rows.push({ b, l, c, d });
        });
        const st = dead ? 'lost' : all ? 'won' : 'open';
        next.b[b.id] = st;
        if (!b.arch) info.push({ b, st, cnt, pr: dead ? 0 : all ? 1 : pr });
        const pv = prev && prev.b[b.id];
        if (pv && pv != st && st != 'open') msgs.push(st == 'won' ? `🏆 بلیت «${b.name}» برنده شد! (برد: ${b.win})` : `❌ بلیت «${b.name}» سوخت.`);
      });
      Object.entries(games).forEach(([k, g]) => {
        const x = g.x;
        out.games++;
        if (!x) { out.missing++; return; }
        if (x.st == 'in') out.live++;
        const cur = { s: x.st + (x.over ? '*' : ''), h: x.h, a: x.a, n: (x.goals || []).length };
        next.g[k] = cur;
        const pv = prev && prev.g[k];
        if (!pv) return;
        const sc = `${g.l.home} ${x.h}–${x.a} ${g.l.away}`, rows = g.rows.filter((r) => next.b[r.b.id] != 'lost' || r.d);
        const lines = rows.map((r) => `${EM[r.c]} ${r.b.name}: ${C.pickTxt(r.l.pick, r.l)}${r.d ? ' ❌' : ''}`).join('\n');
        const fin = (z) => z.startsWith('post');
        if (O.st && pv.s == 'pre' && cur.s != 'pre') msgs.push(`🟢 شروع بازی\n${g.l.home} – ${g.l.away}\n${lines}`);
        if (O.gl && (x.h > pv.h || x.a > pv.a)) {
          const gl = (x.goals || []).slice(pv.n), who = x.h > pv.h ? g.l.home : g.l.away;
          const det = gl.length ? gl.map((z) => `${z.m} ${z.n}${z.f == 'P' ? ' (پنالتی)' : z.f == 'OG' ? ' (گل به خودی)' : ''}`).join('، ') : 'برای ' + who;
          msgs.push(`⚽ گل! ${det}\n${sc}${x.min ? ` (${x.min}′)` : ''}\n${lines}`);
        } else if (O.gl && (x.h < pv.h || x.a < pv.a)) msgs.push(`↩️ گل لغو شد (VAR)\n${sc}\n${lines}`);
        if (O.en && !fin(pv.s) && fin(cur.s)) msgs.push(`🏁 پایان بازی${x.aet ? ' (۹۰ دقیقه؛ وقت اضافه بود)' : ''}\n${sc}\n${lines}`);
        else if (O.en && pv.s == 'in' && cur.s == 'in*') msgs.push(`⏱ ۹۰ دقیقه تمام شد؛ وقت اضافه\n${sc}\n${lines}`);
      });
      if ((O.sum || force) && (prev || force) && (force || now - next.sumAt >= O.sum * 6e4 - 3e4)) {
        const G = Object.values(games).filter((g) => g.x), live = G.filter((g) => g.x.st == 'in');
        const soon = G.filter((g) => g.x.st == 'pre' && g.x.t && new Date(g.x.t) - now < 60 * 6e4 && new Date(g.x.t) - now > -30 * 6e4);
        if (live.length || soon.length || force) {
          msgs.push(`📊 خلاصهٔ وضعیت · ${hm(now)}`);
          if (live.length) msgs.push('🔴 بازی‌های زنده:\n' + live.map((g) => { const c = { g: 0, b: 0, o: 0, r: 0, n: 0 }; g.rows.filter((r) => next.b[r.b.id] != 'lost' || r.d).forEach((r) => c[r.c]++); return `⚽ ${g.l.home} ${g.x.h}–${g.x.a} ${g.l.away}${g.x.min ? ` (${g.x.min}′)` : ''}\n   ${Object.keys(c).filter((z) => c[z]).map((z) => EM[z] + '×' + c[z]).join(' ')}`; }).join('\n'));
          if (soon.length) msgs.push('⏰ به‌زودی:\n' + soon.map((g) => `${hm(g.x.t)}  ${g.l.home} – ${g.l.away}`).join('\n'));
          const sev = (i) => (i.st == 'lost' ? -2 : i.st == 'won' ? -1 : i.cnt.r * 3 + i.cnt.o * 2);
          msgs.push('🎫 بلیت‌ها:\n' + info.sort((a, b) => sev(b) - sev(a)).map((i) => `${i.st == 'lost' ? '❌' : i.st == 'won' ? '🏆' : '▫️'} ${i.b.name}: 🟢${i.cnt.g} 🔵${i.cnt.b} 🟠${i.cnt.o} 🔴${i.cnt.r} ⚪${i.cnt.n} · ~${Math.round(i.pr * 100)}٪`).join('\n'));
          next.sumAt = now;
        }
      }
      if (msgs.length && (prev || force)) { if (await send(cfg, msgs.join('\n\n'))) out.sent += msgs.length; }
      await kv(['SET', key, JSON.stringify(next)]);
    }
    if (cron) await kv(['SET', 'betslip:lastres', JSON.stringify({ ...out, at: Date.now() })]);
    s.json(out);
  } catch (e) {
    if (cron) { try { await kv(['SET', 'betslip:lastres', JSON.stringify({ err: String(e.message || e), at: Date.now() })]); } catch (x) {} } s.status(500).json({ error: String(e.message || e) }); }
};
