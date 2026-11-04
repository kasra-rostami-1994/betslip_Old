// خواندن عمومی یک بلیت از روی توکن اشتراک (لینکی یا عمومی)؛ مبلغ، کش‌اوت، یادداشت و برچسب هرگز بیرون داده نمی‌شود.
const { kv, hkey, parse } = require('./_lib');
const pub = (b) => ({ name: b.name, odds: b.odds, arch: b.arch, res: b.res, created: b.created, legs: b.legs });
module.exports = async (q, s) => {
  try {
    const t = String((q.query && q.query.t) || '');
    if (!/^[0-9a-f]{24}$/.test(t)) return s.status(400).json({ error: 'bad token' });
    const v = await kv(['GET', 'betslip:share:' + t]);
    if (!v) return s.status(404).json({ error: 'not found' });
    const [u, id] = String(v).split('|');
    let b = null;
    if (id) { const x = await kv(['HGET', hkey(u), id]); b = x ? JSON.parse(x) : null; }
    else { b = parse(await kv(['HVALS', hkey(u)])).find((r) => r.share === t) || null; if (!b) { const old = JSON.parse((await kv(['GET', 'betslip:d:' + u])) || 'null'); b = old && (old.bets || []).find((r) => r.share === t); } }
    if (!b || b.del || b.share !== t) return s.status(404).json({ error: 'not found' });
    s.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    s.json({ bet: pub(b), by: u });
  } catch (e) { s.status(500).json({ error: String(e.message || e) }); }
};
