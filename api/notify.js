// زمان‌بند صدایش می‌زند. شروع بازی، گل (با گل‌زن)، پایان بازی، برنده/بازنده شدن بلیت و خلاصهٔ دوره‌ای را به تلگرام می‌فرستد.
// برای صرفه‌جویی در سهمیهٔ Redis: وقتی بازی زنده/نزدیک نیست، کاربر تا ۱۲ دقیقه قبل از شروع بازی بعدی رد می‌شود.
const { kv, user, hkey, parse } = require('./_lib');
const C = require('./_core');
const { EM, hm, send } = require('./_tg');
module.exports = async (q, s) => {
  const sec = process.env.CRON_SECRET, Q = q.query || {}, cron = !!sec && (q.headers.authorization === 'Bearer ' + sec || Q.key === sec);
  const me = cron ? null : await user(q);
  if (!cron && !me) return s.status(401).end();
  const out = { users: 0, events: 0, games: 0, live: 0, missing: 0, sent: 0, idle: 0 };
  try {
    const now = Date.now(), force = !cron && Q.auto !== '1';
    const users = cron ? (await kv(['SMEMBERS', 'betslip:tg'])) || [] : [me], jobs = [];
    for (const u of users) {
      const [cs, ss, nx] = await kv(['MGET', 'betslip:tgc:' + u, 'betslip:ns:' + u, 'betslip:nx:' + u]), cfg = cs ? JSON.parse(cs) : null;
      if (!cfg || !cfg.token || !cfg.chat || (!force && !cfg.on)) continue;
      if (!force && nx && +nx > now) { out.idle++; continue; }
      jobs.push({ u, cfg, ss, prev: ss ? JSON.parse(ss) : null });
    }
    out.users = jobs.length;
    if (jobs.length) {
      let base = process.env.SITE_BASE || jobs[0].cfg.base || 'https://' + q.headers.host;
      const E = (await (await fetch(base + '/api/live?apif=1')).json()).events || [];
      out.events = E.length;
      for (const { u, cfg, ss, prev } of jobs) {
        if (!(await kv(['SET', 'betslip:lock:' + u, '1', 'NX', 'EX', '20']))) continue;
        const O = { st: cfg.st !== false, gl: cfg.gl !== false, en: cfg.en !== false, sum: cfg.sum === undefined ? 15 : +cfg.sum };
        const recs = parse(await kv(['HVALS', hkey(u)])).filter((b) => !b.del && (!b.arch || (b.auto && now - b.arch < 36e5)));
        const next = { g: {}, b: {}, sumAt: (prev && prev.sumAt) || 0 }, msgs = [], games = {}, info = [];
        recs.forEach((b) => {
          const S = C.betState(b, E, now), st = S.lost ? 'lost' : S.won ? 'won' : 'open';
          next.b[b.id] = st;
          S.L.forEach((z) => { const k = C.gk(z.l), g = games[k] || (games[k] = { l: z.l, x: z.x, rows: [] }); g.rows.push({ b, l: z.l, c: z.c, d: z.d }); });
          if (!b.arch) info.push({ b, st, cnt: S.cnt, pr: S.pr });
          const pv = prev && prev.b[b.id];
          if (pv && pv != st && st != 'open') msgs.push(st == 'won' ? `🏆 بلیت «${b.name}» برنده شد! (برد: ${b.win})` : `❌ بلیت «${b.name}» سوخت.`);
        });
        let live = 0, soon = 9e15;
        Object.entries(games).forEach(([k, g]) => {
          const x = g.x; out.games++;
          if (!x) { out.missing++; return; }
          if (x.st == 'in') { live++; out.live++; }
          if (x.st == 'pre' && x.t) soon = Math.min(soon, +x.t);
          const cur = { s: x.st + (x.over ? '*' : ''), h: x.h, a: x.a, n: (x.goals || []).length };
          next.g[k] = cur;
          const pv = prev && prev.g[k];
          if (!pv) return;
          const sc = `${g.l.home} ${x.h}–${x.a} ${g.l.away}`, rows = g.rows.filter((r) => next.b[r.b.id] != 'lost' || r.d);
          const lines = rows.map((r) => `${EM[r.c]} ${r.b.name}: ${C.pickTxt(r.l.pick, r.l)}${r.d ? ' ❌' : ''}`).join('\n'), fin = (z) => z.startsWith('post');
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
          const G = Object.values(games).filter((g) => g.x), lv = G.filter((g) => g.x.st == 'in');
          const sn = G.filter((g) => g.x.st == 'pre' && g.x.t && g.x.t - now < 60 * 6e4 && g.x.t - now > -30 * 6e4);
          if (lv.length || sn.length || force) {
            msgs.push(`📊 خلاصهٔ وضعیت · ${hm(now)}`);
            if (lv.length) msgs.push('🔴 بازی‌های زنده:\n' + lv.map((g) => { const c = { g: 0, b: 0, o: 0, r: 0, n: 0 }; g.rows.filter((r) => next.b[r.b.id] != 'lost' || r.d).forEach((r) => c[r.c]++); return `⚽ ${g.l.home} ${g.x.h}–${g.x.a} ${g.l.away}${g.x.min ? ` (${g.x.min}′)` : ''}\n   ${Object.keys(c).filter((z) => c[z]).map((z) => EM[z] + '×' + c[z]).join(' ')}`; }).join('\n'));
            if (sn.length) msgs.push('⏰ به‌زودی:\n' + sn.map((g) => `${hm(g.x.t)}  ${g.l.home} – ${g.l.away}`).join('\n'));
            const sev = (i) => (i.st == 'lost' ? -2 : i.st == 'won' ? -1 : i.cnt.r * 3 + i.cnt.o * 2);
            msgs.push('🎫 بلیت‌ها:\n' + info.sort((a, b) => sev(b) - sev(a)).map((i) => `${i.st == 'lost' ? '❌' : i.st == 'won' ? '🏆' : '▫️'} ${i.b.name}: 🟢${i.cnt.g} 🔵${i.cnt.b} 🟠${i.cnt.o} 🔴${i.cnt.r} ⚪${i.cnt.n} · ~${Math.round(i.pr * 100)}٪`).join('\n'));
            next.sumAt = now;
          }
        }
        if (msgs.length && (prev || force)) { if (await send(cfg, msgs.join('\n\n'))) out.sent += msgs.length; }
        const js = JSON.stringify(next); if (js !== ss) await kv(['SET', 'betslip:ns:' + u, js]);
        if (!live && !force) { const nv = soon < 9e15 ? soon - 12 * 6e4 : now + 30 * 6e4; if (nv > now + 6e4) await kv(['SET', 'betslip:nx:' + u, String(Math.round(nv)), 'EX', '86400']); }
      }
    }
    if (cron) await kv(['SET', 'betslip:lastres', JSON.stringify({ ...out, at: now })]);
    s.json(out);
  } catch (e) {
    if (cron) { try { await kv(['SET', 'betslip:lastres', JSON.stringify({ err: String(e.message || e), at: Date.now() })]); } catch (x) {} }
    s.status(500).json({ error: String(e.message || e) });
  }
};
