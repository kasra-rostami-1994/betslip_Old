// پروفایل کاربر، پروفایل عمومی دیگران و رتبه‌بندی (پایهٔ بخش اجتماعی)
const { kv, user, getRecs, ensureProfile, profile, recompute } = require('./_lib');
const pubBet = (b) => ({ id: b.id, name: b.name, odds: b.odds, arch: b.arch, res: b.res, created: b.created, legs: b.legs });
module.exports = async (q, s) => {
  try {
    const Q = q.query || {};
    if (q.method === 'GET' && Q.board) {
      const all = (await kv(['HVALS', 'betslip:prof'])) || [];
      const rows = all.map((x) => { try { return JSON.parse(x); } catch (e) { return null; } }).filter((p) => p && p.pub)
        .map((p) => ({ u: p.u, name: p.name, score: p.score || 0, n: p.stats.n, won: p.stats.won, lost: p.stats.lost, roi: p.stats.roi }))
        .sort((a, b) => b.score - a.score).slice(0, 50);
      s.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
      return s.json({ rows });
    }
    if (q.method === 'GET' && Q.u) {
      const p = await profile(String(Q.u).toLowerCase());
      if (!p || !p.pub) return s.status(404).json({ error: 'not found' });
      const bets = (await getRecs(p.u)).filter((b) => b.vis === 'public' && !b.del).sort((a, b) => (b.created || 0) - (a.created || 0)).slice(0, 60).map(pubBet);
      s.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=60');
      return s.json({ profile: { u: p.u, name: p.name, bio: p.bio, joined: p.joined, score: p.score || 0, stats: p.stats }, bets });
    }
    const me = await user(q);
    if (!me) return s.status(401).json({ error: 'unauthorized' });
    if (q.method === 'GET') return s.json({ profile: Q.fresh ? await recompute(me) : await ensureProfile(me) });
    if (q.method === 'PUT') {
      const b = typeof q.body === 'string' ? JSON.parse(q.body) : q.body || {}, p = await ensureProfile(me);
      if (typeof b.name === 'string') p.name = b.name.trim().slice(0, 30) || me;
      if (typeof b.bio === 'string') p.bio = b.bio.trim().slice(0, 160);
      if (typeof b.pub === 'boolean') p.pub = b.pub;
      if (['private', 'link', 'public'].includes(b.dvis)) p.dvis = b.dvis;
      await kv(['HSET', 'betslip:prof', me, JSON.stringify(p)]);
      return s.json({ profile: p });
    }
    s.status(405).end();
  } catch (e) { s.status(500).json({ error: String(e.message || e) }); }
};
