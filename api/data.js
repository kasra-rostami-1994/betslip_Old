const { kv, user } = require('./_lib');
module.exports = async (q, s) => {
  const u = await user(q);
  if (!u) return s.status(401).json({ error: 'unauthorized' });
  const k = 'betslip:d:' + u;
  try {
    if (q.method === 'GET') { const v = await kv(['GET', k]); return s.json(v ? JSON.parse(v) : { bets: [] }); }
    if (q.method === 'PUT') {
      const b = typeof q.body === 'string' ? JSON.parse(q.body) : q.body;
      if (!b || !Array.isArray(b.bets)) return s.status(400).json({ error: 'bad body' });
      const old = await kv(['GET', k]), ok = (x) => /^[0-9a-f]{24}$/.test(x || '');
      const prev = old ? JSON.parse(old).bets.map((x) => x.share).filter(ok) : [], now = b.bets.map((x) => x.share).filter(ok);
      await kv(['SET', k, JSON.stringify(b)]);
      for (const t of now) await kv(['SET', 'betslip:share:' + t, u]);
      for (const t of prev) if (!now.includes(t)) await kv(['DEL', 'betslip:share:' + t]);
      return s.json({ ok: 1 });
    }
    s.status(405).end();
  } catch (e) { s.status(500).json({ error: String(e.message || e) }); }
};
