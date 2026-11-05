// Public bet read by share token — MongoDB version
const { DB } = require('./_lib');

const pubBet = (b) => ({
  name: b.name, odds: b.odds,
  archivedAt: b.archivedAt, result: b.result, createdAt: b.createdAt,
  legs: b.legs,
});

module.exports = async (q, s) => {
  try {
    const t = String((q.query && q.query.t) || '');
    if (!/^[0-9a-f]{24}$/.test(t)) return s.status(400).json({ error: 'bad token' });

    const bet = await DB.getBetByShareToken(t);
    if (!bet) return s.status(404).json({ error: 'not found' });

    // Get owner info
    const owner = await DB.User.findById(bet.userId).select('username').lean();
    if (!owner) return s.status(404).json({ error: 'not found' });

    s.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    s.json({ bet: pubBet(bet), by: owner.username });
  } catch (e) {
    console.error('Share API error:', e);
    s.status(500).json({ error: String(e.message || e) });
  }
};