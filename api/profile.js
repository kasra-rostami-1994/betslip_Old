// User profile, public profiles, and leaderboard — MongoDB version
const { DB, token, user, getUserProfile } = require('./_lib');

const publicBet = (b) => ({
  id: b._id?.toString() || b.id,
  name: b.name, odds: b.odds,
  archivedAt: b.archivedAt, result: b.result, createdAt: b.createdAt,
  legs: b.legs,
});

module.exports = async (q, s) => {
  try {
    const Q = q.query || {};

    // Leaderboard (public profiles only)
    if (q.method === 'GET' && Q.board) {
      const users = await DB.User.find({ isPublic: true })
        .select('username name score statsCache updatedAt')
        .sort({ 'statsCache.score': -1 })
        .limit(50)
        .lean();

      const rows = users.map(p => ({
        u: p.username, name: p.name,
        score: p.statsCache?.score || 0,
        n: p.statsCache?.totalBets || 0,
        won: p.statsCache?.wonBets || 0,
        lost: p.statsCache?.lostBets || 0,
        roi: p.statsCache?.roi || 0,
      }));

      s.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
      return s.json({ rows });
    }

    // Public profile by username
    if (q.method === 'GET' && Q.u) {
      const targetUser = await DB.findUserByUsername(String(Q.u).toLowerCase());
      if (!targetUser || !targetUser.isPublic) return s.status(404).json({ error: 'not found' });

      const bets = await DB.getPublicBets(targetUser._id.toString());
      s.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=60');
      return s.json({
        profile: {
          u: targetUser.username, name: targetUser.name, bio: targetUser.bio,
          joined: targetUser.joinedAt, score: targetUser.statsCache?.score || 0, stats: targetUser.statsCache,
        },
        bets: bets.map(publicBet),
      });
    }

    // Own profile
    const me = await user(q);
    if (!me) return s.status(401).json({ error: 'unauthorized' });

    if (q.method === 'GET') {
      const profile = await getUserProfile(me);
      if (Q.fresh) await DB.updateUserStats(me);
      return s.json({ profile });
    }

    if (q.method === 'PUT') {
      const body = typeof q.body === 'string' ? JSON.parse(q.body) : (q.body || {});
      const allowed = ['name', 'bio', 'isPublic', 'defaultVis', 'timezone', 'prefs'];
      const update = {};
      for (const k of allowed) if (body[k] !== undefined) update[k] = body[k];

      if (update.name) update.name = String(update.name).trim().slice(0, 30) || profile.username;
      if (update.bio) update.bio = String(update.bio).trim().slice(0, 160);

      const updated = await DB.updateUserProfile(me, update);
      return s.json({ profile: updated });
    }

    s.status(405).end();
  } catch (e) {
    console.error('Profile API error:', e);
    s.status(500).json({ error: String(e.message || e) });
  }
};