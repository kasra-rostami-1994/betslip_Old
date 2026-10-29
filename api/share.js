// خواندن عمومی یک بلیت از روی توکن اشتراک؛ مبلغ و کش‌اوت هرگز بیرون داده نمی‌شود.
const { kv } = require('./_lib');
module.exports = async (q, s) => {
  try {
    const t = String((q.query && q.query.t) || '');
    if (!/^[0-9a-f]{24}$/.test(t)) return s.status(400).json({ error: 'bad token' });
    const u = await kv(['GET', 'betslip:share:' + t]);
    if (!u) return s.status(404).json({ error: 'not found' });
    const v = await kv(['GET', 'betslip:d:' + u]);
    const b = ((v ? JSON.parse(v) : { bets: [] }).bets || []).find((x) => x.share === t);
    if (!b) return s.status(404).json({ error: 'not found' });
    s.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    s.json({ bet: { name: b.name, odds: b.odds, arch: b.arch, res: b.res, created: b.created, legs: b.legs } });
  } catch (e) { s.status(500).json({ error: String(e.message || e) }); }
};
