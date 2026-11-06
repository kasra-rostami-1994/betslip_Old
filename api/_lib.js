// Upstash Redis replaced by MongoDB — thin wrapper over _db.js
const crypto = require('crypto');
const C = require('./_core');
const DB = require('./_db');

const token = (q) => String(q.headers.authorization || '').replace(/^Bearer /, '');

// User/session helpers using MongoDB
async function getUserFromToken(req) {
  const t = token(req);
  if (t.length < 20) return null;
  try {
    return await DB.getSession(t);
  } catch (e) {
    return null;
  }
}

async function getUserProfile(userId) {
  return DB.findUserById(userId);
}

async function ensureUserProfile(userId) {
  const prof = await DB.findUserById(userId);
  if (!prof) throw new Error('User not found');
  return prof;
}

async function recomputeUserStats(userId) {
  return DB.updateUserStats(userId);
}

// Redis-like helpers for compatibility (not used in new code)
const kv = async (cmd) => {
  throw new Error('kv() is deprecated — use _db.js directly');
};
const hkey = (u) => `betslip:b:${u}`;
const parse = (arr) => (arr || []).map((x) => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);

module.exports = {
  kv, token, hkey, parse,
  getRecs: async (u) => { throw new Error('getRecs deprecated'); },
  profile: async (u) => { throw new Error('profile deprecated'); },
  ensureProfile: async (u) => { throw new Error('ensureProfile deprecated'); },
  recompute: async (u) => { throw new Error('recompute deprecated'); },
  user: getUserFromToken,
  getUserProfile,
  ensureUserProfile,
  recomputeUserStats,
  hash: (p, salt) => crypto.scryptSync(p, salt, 32).toString('hex'),
  rand: (n) => crypto.randomBytes(n).toString('hex'),
  // New MongoDB helpers
  DB,
  createUser: DB.createUser,
  findUserByEmail: DB.findUserByEmail,
  findUserByUsername: DB.findUserByUsername,
  authenticateUser: DB.authenticateUser,
  createSession: DB.createSession,
  deleteSession: DB.deleteSession,
  deleteAllUserSessions: DB.deleteAllUserSessions,
  getUserBets: DB.getUserBets,
  getBetById: DB.getBetById,
  getBetByShareToken: DB.getBetByShareToken,
  createBet: DB.createBet,
  updateBet: DB.updateBet,
  deleteBet: DB.deleteBet,
  restoreBet: DB.restoreBet,
  archiveBet: DB.archiveBet,
  unarchiveBet: DB.unarchiveBet,
  getPublicBets: DB.getPublicBets,
  followUser: DB.followUser,
  unfollowUser: DB.unfollowUser,
  getFollowers: DB.getFollowers,
  getFollowing: DB.getFollowing,
  isFollowing: DB.isFollowing,
  upsertMatches: DB.upsertMatches,
  getMatchesForBets: DB.getMatchesForBets,
  createDailyBackup: DB.createDailyBackup,
  getBackups: DB.getBackups,
  getBackup: DB.getBackup,
  updateUserProfile: DB.updateUserProfile,
  updateUserStats: DB.updateUserStats,
  // Lock & notification helpers
  acquireLock: DB.acquireLock,
  releaseLock: DB.releaseLock,
  getNotificationSkip: DB.getNotificationSkip,
  setNotificationSkip: DB.setNotificationSkip,
  clearNotificationSkip: DB.clearNotificationSkip,
  setLastNotifyResult: DB.setLastNotifyResult,
  getLastNotifyResult: DB.getLastNotifyResult,
};