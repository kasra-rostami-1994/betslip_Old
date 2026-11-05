// Push notification engine — MongoDB version
// Triggered by cron (GitHub Actions / cron-job.org) or client auto-ping
const { DB, C } = require('./_lib');
const { EM, hm, send } = require('./_tg');

module.exports = async (q, s) => {
  const sec = process.env.CRON_SECRET;
  const Q = q.query || {};
  const cron = !!sec && (q.headers.authorization === 'Bearer ' + sec || Q.key === sec);
  const me = cron ? null : await DB.user(q);
  if (!cron && !me) return s.status(401).end();

  const out = { users: 0, events: 0, games: 0, live: 0, missing: 0, sent: 0, idle: 0 };

  try {
    const now = Date.now();
    const force = !cron && Q.auto !== '1';

    // Get users to notify
    let users;
    if (cron) {
      const tgConfigs = await DB.TgConfig.find({ on: true, token: { $ne: null }, chatId: { $ne: null } }).lean();
      users = tgConfigs.map(c => ({ userId: c.userId.toString(), cfg: c }));
    } else {
      const tgConfig = await DB.TgConfig.findOne({ userId: me, on: true, token: { $ne: null }, chatId: { $ne: null } }).lean();
      if (!tgConfig) return s.json(out);
      users = [{ userId: me, cfg: tgConfig }];
    }

    out.users = users.length;
    if (!users.length) return s.json(out);

    // Fetch live events once
    const base = process.env.SITE_BASE || users[0].cfg.base || 'https://' + q.headers.host;
    const E = (await (await fetch(base + '/api/live?apif=1')).json()).events || [];
    out.events = E.length;

    const jobs = [];
    for (const { userId, cfg } of users) {
      // Check idle skip
      const skipKey = `notify:skip:${userId}`;
      const skipUntil = await DB.getNotificationSkip ? await DB.getNotificationSkip(userId) : null;
      if (!force && skipUntil && skipUntil > now) {
        out.idle++;
        continue;
      }
      jobs.push({ userId, cfg });
    }

    if (!jobs.length) return s.json(out);

    for (const { userId, cfg } of jobs) {
      // Distributed lock
      const lockKey = `notify:lock:${userId}`;
      const locked = await DB.acquireLock ? await DB.acquireLock(lockKey, 20000) : true;
      if (!locked) continue;

      const O = {
        st: cfg.notifyPrefs?.kickoff !== false,
        gl: cfg.notifyPrefs?.goal !== false,
        en: cfg.notifyPrefs?.ft !== false,
        sum: cfg.notifyPrefs?.digest ?? 15,
      };

      const recs = await DB.getUserBets(userId, { includeArchived: true, includeDeleted: false });
      const activeRecs = recs.filter(b => !b.deletedAt && (!b.archivedAt || (b.autoArchived && now - new Date(b.archivedAt).getTime() < 36e5)));

      const next = { g: {}, b: {}, sumAt: 0 }, msgs = [], games = {}, info = [];

      activeRecs.forEach((b) => {
        const S = C.betState(b, E, now);
        const st = S.lost ? 'lost' : S.won ? 'won' : 'open';
        next.b[b._id.toString()] = st;
        S.L.forEach((z) => {
          const k = C.gk(z.l);
          const g = games[k] || (games[k] = { l: z.l, x: z.x, rows: [] });
          g.rows.push({ b, l: z.l, c: z.c, d: z.d });
        });
        if (!b.archivedAt) info.push({ b, st, cnt: S.cnt, pr: S.pr });
        // Note: bet win/loss transitions would need previous state tracking
        // For now, skip this in migration
      });

      let live = 0, soon = 9e15;
      Object.entries(games).forEach(([k, g]) => {
        const x = g.x;
        out.games++;
        if (!x) { out.missing++; return; }
        if (x.st == 'in') { live++; out.live++; }
        if (x.st == 'pre' && x.t) soon = Math.min(soon, +x.t);
        const cur = { s: x.st + (x.over ? '*' : ''), h: x.h, a: x.a, n: (x.goals || []).length };
        next.g[k] = cur;

        // Note: previous state comparison would need stored previous state
        // For now, skip game event notifications in migration
      });

      // Periodic summary
      if ((O.sum || force) && (force || now - (next.sumAt || 0) >= O.sum * 6e4 - 3e4)) {
        const G = Object.values(games).filter(g => g.x);
        const lv = G.filter(g => g.x.st == 'in');
        const sn = G.filter(g => g.x.st == 'pre' && g.x.t && g.x.t - now < 60 * 6e4 && g.x.t - now > -30 * 6e4);
        if (lv.length || sn.length || force) {
          msgs.push(`📊 خلاصهٔ وضعیت · ${hm(now)}`);
          if (lv.length) msgs.push('🔴 بازی‌های زنده:\n' + lv.map(g => {
            const c = { g: 0, b: 0, o: 0, r: 0, n: 0 };
            g.rows.filter(r => next.b[r.b._id.toString()] != 'lost' || r.d).forEach(r => c[r.c]++);
            return `⚽ ${g.l.home} ${g.x.h}–${g.x.a} ${g.l.away}${g.x.min ? ` (${g.x.min}′)` : ''}\n   ${Object.keys(c).filter(z => c[z]).map(z => EM[z] + '×' + c[z]).join(' ')}`;
          }).join('\n'));
          if (sn.length) msgs.push('⏰ به‌زودی:\n' + sn.map(g => `${hm(g.x.t)}  ${g.l.home} – ${g.l.away}`).join('\n'));
          const sev = (i) => (i.st == 'lost' ? -2 : i.st == 'won' ? -1 : i.cnt.r * 3 + i.cnt.o * 2);
          msgs.push('🎫 بلیت‌ها:\n' + info.sort((a, b) => sev(b) - sev(a)).map(i => `${i.st == 'lost' ? '❌' : i.st == 'won' ? '🏆' : '▫️'} ${i.b.name}: 🟢${i.cnt.g} 🔵${i.cnt.b} 🟠${i.cnt.o} 🔴${i.cnt.r} ⚪${i.cnt.n} · ~${Math.round(i.pr * 100)}٪`).join('\n'));
          next.sumAt = now;
        }
      }

      if (msgs.length && (force || true)) {
        if (await send(cfg, msgs.join('\n\n'))) out.sent += msgs.length;
      }

      // Update skip cache
      if (!live && !force) {
        const nv = soon < 9e15 ? soon - 12 * 6e4 : now + 30 * 6e4;
        if (nv > now + 6e4) await DB.setNotificationSkip(userId, nv);
      }

      // Release lock
      await DB.releaseLock ? await DB.releaseLock(lockKey) : null;
    }

    if (cron) {
      // Store last run result for /status
      await DB.setLastNotifyResult ? await DB.setLastNotifyResult({ ...out, at: now }) : null;
    }
    s.json(out);
  } catch (e) {
    console.error('Notify error:', e);
    if (cron) {
      try { await DB.setLastNotifyResult ? await DB.setLastNotifyResult({ err: String(e.message || e), at: Date.now() }) : null; } catch (x) {}
    }
    s.status(500).json({ error: String(e.message || e) });
  }
};