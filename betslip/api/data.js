const { kv, authed } = require('./_lib');
module.exports = async (q, s) => {
  if (!authed(q)) return s.status(401).json({ error: 'unauthorized' });
  try {
    if (q.method === 'GET') {
      const v = await kv(['GET', 'betslip:data']);
      return s.json(v ? JSON.parse(v) : { bets: [] });
    }
    if (q.method === 'PUT') {
      const b = typeof q.body === 'string' ? JSON.parse(q.body) : q.body;
      if (!b || !Array.isArray(b.bets)) return s.status(400).json({ error: 'bad body' });
      await kv(['SET', 'betslip:data', JSON.stringify(b)]);
      return s.json({ ok: 1 });
    }
    s.status(405).end();
  } catch (e) { s.status(500).json({ error: String(e.message || e) }); }
};
