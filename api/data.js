// Bet data sync — MongoDB version
// Client sends diff (up/rm), server applies with optimistic concurrency via updatedAt
const { DB, token, user } = require('./_lib');
const tok = (x) => /^[0-9a-f]{24}$/.test(x || '');

// Transform MongoDB bet document to client-expected format
function transformBetForClient(bet) {
  return {
    ...bet,
    id: bet._id?.toString() || bet.id,
    created: bet.createdAt?.getTime ? bet.createdAt.getTime() : bet.createdAt,
    del: bet.deletedAt ? bet.deletedAt.getTime ? bet.deletedAt.getTime() : bet.deletedAt : 0,
    arch: bet.archivedAt ? bet.archivedAt.getTime ? bet.archivedAt.getTime() : bet.archivedAt : 0,
    // Ensure legs array exists
    legs: bet.legs || [],
  };
}

module.exports = async (q, s) => {
  const userId = await user(q);
  if (!userId) return s.status(401).json({ error: 'unauthorized' });

  try {
    if (q.method === 'GET') {
      // Backup restore
      if (q.query && q.query.backup) {
        const backup = await DB.getBackup(userId, String(q.query.backup).slice(0, 10));
        return s.json({ records: (backup?.data || []).map(transformBetForClient) });
      }
      // Normal bet list
      const bets = await DB.getUserBets(userId, { includeArchived: true, includeDeleted: true });
      return s.json({ records: bets.map(transformBetForClient) });
    }

    if (q.method === 'PUT') {
      const body = typeof q.body === 'string' ? JSON.parse(q.body) : (q.body || {});
      const up = (Array.isArray(body.up) ? body.up : []).slice(0, 300);
      const rm = (Array.isArray(body.rm) ? body.rm : []).filter((x) => typeof x === 'string').slice(0, 300);

      let touched = false;

      // Handle updates AND creates
      for (const r of up) {
        if (!r || typeof r.id !== 'string' || r.id.length > 40 || !Array.isArray(r.legs)) continue;
        const existing = await DB.getBetById(r.id);

        if (!existing) {
          // Create new bet - use client's id as MongoDB _id
          const betData = { ...r };
          const clientId = betData.id;
          // Remove client-only fields that shouldn't go to DB
          delete betData.id;
          delete betData.upd;
          delete betData.created;
          delete betData.del;
          delete betData.arch;

          // Ensure userId is set
          betData.userId = userId;
          // Use client's id as MongoDB _id (string)
          betData._id = clientId;

          await DB.createBet(userId, betData);
          touched = true;
          continue;
        }

        if (existing.userId.toString() !== userId) continue;

        // Optimistic concurrency: skip if client version is older
        if (existing.updatedAt && r.upd && new Date(existing.updatedAt).getTime() > new Date(r.upd).getTime()) {
          continue;
        }

        // Handle share token changes
        if (tok(existing.shareToken) && existing.shareToken !== r.shareToken) {
          // Old share token will be invalidated when bet is updated
        }
        if (tok(r.shareToken) && !r.deletedAt) {
          // New share token will be set in update
        }

        // Check if this is a visibility/archive/delete change that affects notifications
        const visChanged = existing.vis !== r.vis;
        const archChanged = !!existing.archivedAt !== !!r.archivedAt;
        const delChanged = !!existing.deletedAt !== !!r.deletedAt;
        if (visChanged || archChanged || delChanged) touched = true;

        const updateData = { ...r, updatedAt: new Date() };
        // Remove client-only fields (also _id which cannot be updated)
        delete updateData.id;
        delete updateData._id;
        delete updateData.upd;
        delete updateData.created;
        delete updateData.del;
        delete updateData.arch;

        await DB.updateBet(r.id, userId, updateData);
      }

      // Handle removals (soft delete)
      for (const id of rm) {
        const existing = await DB.getBetById(id);
        if (!existing || existing.userId.toString() !== userId) continue;
        await DB.deleteBet(id, userId);
        touched = true;
      }

      // Clear notification skip cache
      await DB.clearNotificationSkip ? await DB.clearNotificationSkip(userId) : null;

      if (touched) {
        await DB.updateUserStats(userId);
      }

      // Daily backup (handled by cron or on first write of day)
      const today = new Date().toISOString().slice(0, 10);
      // We'll let the cron job handle backups, or do it here with a lock
      // For now, skip automatic backup in data.js to avoid race conditions

      return s.json({ ok: 1, saved: up.length, removed: rm.length });
    }

    s.status(405).end();
  } catch (e) {
    console.error('Data API error:', e);
    s.status(500).json({ error: String(e.message || e) });
  }
};