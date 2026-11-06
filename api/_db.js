/* _db.js — MongoDB connection + Mongoose models + helper methods */
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) throw new Error('MONGODB_URI env var is required');

// Global connection cache (serverless-friendly)
let cached = global.mongoose;
if (!cached) cached = global.mongoose = { conn: null, promise: null };

async function connect() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      dbName: 'betslip',
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
    }).then((m) => m.connection);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

/* ---------- Schemas ---------- */

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  username: { type: String, required: true, unique: true, lowercase: true, index: true },
  passwordHash: { type: String, required: true },
  name: { type: String, default: '' },
  bio: { type: String, default: '', maxlength: 160 },
  avatar: { type: String, default: '' },
  isPublic: { type: Boolean, default: false },
  defaultVis: { type: String, enum: ['private', 'link', 'public'], default: 'private' },
  timezone: { type: String, default: 'Europe/Istanbul' },
  joinedAt: { type: Date, default: Date.now },
  lastActiveAt: { type: Date, default: Date.now },
  // Social
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  followersCount: { type: Number, default: 0 },
  followingCount: { type: Number, default: 0 },
  // Preferences
  prefs: {
    notifications: { email: { type: Boolean, default: false }, push: { type: Boolean, default: true }, telegram: { type: Boolean, default: false } },
    theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'auto' },
    language: { type: String, default: 'fa' },
  },
  // Telegram
  telegram: {
    connected: { type: Boolean, default: false },
    chatId: String,
    token: String,
    webhookSecret: String,
    notifyPrefs: {
      kickoff: { type: Boolean, default: true },
      goal: { type: Boolean, default: true },
      ft: { type: Boolean, default: true },
      betResult: { type: Boolean, default: true },
      digest: { type: Number, default: 15 }, // minutes, 0 = off
    },
  },
  // Stats cache (denormalized)
  statsCache: {
    totalBets: { type: Number, default: 0 },
    wonBets: { type: Number, default: 0 },
    lostBets: { type: Number, default: 0 },
    totalStaked: { type: Number, default: 0 },
    totalReturn: { type: Number, default: 0 },
    roi: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
}, { timestamps: true });

const betSchema = new mongoose.Schema({
  _id: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, default: '' },
  stake: { type: Number, default: 0 },
  odds: { type: Number, default: 0 },
  win: { type: Number, default: 0 },
  cash: { type: Number, default: null },
  tags: [{ type: String }],
  note: { type: String, default: '' },
  vis: { type: String, enum: ['private', 'link', 'public'], default: 'private' },
  shareToken: { type: String, unique: true, sparse: true, index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  archivedAt: { type: Date, default: null },
  settledAt: { type: Date, default: null },
  result: { type: String, enum: ['won', 'lost', 'open'], default: 'open' },
  autoArchived: { type: Boolean, default: false },
  keepAfterUnarchive: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null }, // soft delete for trash
  legs: [{
    home: { type: String, required: true },
    away: { type: String, required: true },
    pick: { type: String, required: true },
    odds: { type: Number, required: true },
    league: String,
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match' },
    manualOverride: {
      h: Number, a: Number, minute: Number, isFinal: Boolean,
    },
    manualMatchMap: { home: String, away: String },
    savedResult: { h: Number, a: Number, winner: Number, at: Date, league: String },
  }],
}, { timestamps: true });

betSchema.index({ userId: 1, createdAt: -1 });
betSchema.index({ userId: 1, archivedAt: -1 });
betSchema.index({ shareToken: 1 }, { unique: true, sparse: true });

const matchSchema = new mongoose.Schema({
  home: { type: String, required: true },
  away: { type: String, required: true },
  league: String,
  startTime: { type: Date, required: true, index: true },
  status: { type: String, enum: ['pre', 'in', 'post', 'cancelled', 'postponed'], default: 'pre', index: true },
  score: { home: { type: Number, default: 0 }, away: { type: Number, default: 0 } },
  minute: { type: Number, default: 0 },
  isExtendedTime: { type: Boolean, default: false },
  winner: { type: Number, default: 0 }, // 1=home, 2=away, 0=draw/unknown
  goals: [{
    minute: Number,
    player: String,
    type: String, // 'goal', 'penalty', 'own_goal'
    team: { type: String, enum: ['home', 'away'] },
  }],
  sources: [{ source: String, data: mongoose.Schema.Types.Mixed }],
  updatedAt: { type: Date, default: Date.now },
  // Normalized for fuzzy matching
  homeNorm: String,
  awayNorm: String,
}, { timestamps: true });

matchSchema.index({ homeNorm: 1, awayNorm: 1, startTime: 1 });
matchSchema.index({ startTime: 1, status: 1 });

const followSchema = new mongoose.Schema({
  followerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  followingId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  createdAt: { type: Date, default: Date.now },
});
followSchema.index({ followerId: 1, followingId: 1 }, { unique: true });

const sessionSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  createdAt: { type: Date, default: Date.now, expires: '30d' }, // TTL index
  userAgent: String,
  ip: String,
});

const backupSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  data: [mongoose.Schema.Types.Mixed],
  createdAt: { type: Date, default: Date.now },
});
backupSchema.index({ userId: 1, date: 1 }, { unique: true });

const migrationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fromRedisKey: String,
  status: { type: String, enum: ['pending', 'done', 'failed'], default: 'pending' },
  migratedAt: Date,
  error: String,
});

/* ---------- Models ---------- */
const User = mongoose.models.User || mongoose.model('User', userSchema);
const Bet = mongoose.models.Bet || mongoose.model('Bet', betSchema);
const Match = mongoose.models.Match || mongoose.model('Match', matchSchema);
const Follow = mongoose.models.Follow || mongoose.model('Follow', followSchema);
const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);
const Backup = mongoose.models.Backup || mongoose.model('Backup', backupSchema);
const Migration = mongoose.models.Migration || mongoose.model('Migration', migrationSchema);

/* ---------- Helper Methods ---------- */

// Password hashing (scrypt like original _lib.js)
const crypto = require('crypto');
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 32).toString('hex');
}
function verifyPassword(password, salt, hash) {
  return hashPassword(password, salt) === hash;
}
function genSalt() { return crypto.randomBytes(16).toString('hex'); }
function genToken() { return crypto.randomBytes(24).toString('hex'); }
function genShareToken() { return crypto.randomBytes(12).toString('hex'); }

// User helpers
async function createUser({ email, username, password, name, inviteCode }) {
  await connect();
  const salt = genSalt();
  const passwordHash = hashPassword(password, salt);
  const user = new User({
    email: email.toLowerCase(),
    username: username.toLowerCase(),
    passwordHash: `${salt}:${passwordHash}`,
    name: name || username,
    joinedAt: new Date(),
  });
  return user.save();
}

async function findUserByEmail(email) {
  await connect();
  return User.findOne({ email: email.toLowerCase() }).lean();
}

async function findUserByUsername(username) {
  await connect();
  return User.findOne({ username: username.toLowerCase() }).lean();
}

async function findUserById(id) {
  await connect();
  return User.findById(id).lean();
}

async function authenticateUser(usernameOrEmail, password) {
  await connect();
  const q = usernameOrEmail.includes('@')
    ? { email: usernameOrEmail.toLowerCase() }
    : { username: usernameOrEmail.toLowerCase() };
  const user = await User.findOne(q);
  if (!user) return null;
  const [salt, hash] = user.passwordHash.split(':');
  if (!salt || !hash || !verifyPassword(password, salt, hash)) return null;
  return user;
}

async function updateUserProfile(userId, data) {
  await connect();
  const allowed = ['name', 'bio', 'avatar', 'isPublic', 'defaultVis', 'timezone', 'prefs'];
  const update = {};
  for (const k of allowed) if (data[k] !== undefined) update[k] = data[k];
  update.updatedAt = new Date();
  return User.findByIdAndUpdate(userId, { $set: update }, { new: true }).lean();
}

async function updateUserStats(userId) {
  await connect();
  const bets = await Bet.find({ userId, deletedAt: null }).lean();
  const settled = bets.filter(b => b.result === 'won' || b.result === 'lost');
  const won = settled.filter(b => b.result === 'won');
  const totalStaked = bets.reduce((s, b) => s + (b.stake || 0), 0);
  const totalReturn = won.reduce((s, b) => s + (b.stake || 0) * (b.odds || 0), 0);
  const score = won.reduce((s, b) => s + Math.round(10 * Math.log(b.odds || 1)), 0) - settled.length * 5;
  const stats = {
    totalBets: settled.length,
    wonBets: won.length,
    lostBets: settled.length - won.length,
    totalStaked,
    totalReturn,
    roi: totalStaked ? (totalReturn - totalStaked) / totalStaked : 0,
    score,
    updatedAt: new Date(),
  };
  await User.findByIdAndUpdate(userId, { $set: { statsCache: stats } });
  return stats;
}

// Session helpers
async function createSession(userId, userAgent, ip) {
  await connect();
  const token = genToken();
  await Session.create({ token, userId, userAgent, ip });
  return token;
}

async function getSession(token) {
  await connect();
  const sess = await Session.findOne({ token }).lean();
  return sess?.userId?.toString() || null;
}

async function deleteSession(token) {
  await connect();
  await Session.deleteOne({ token });
}

async function deleteAllUserSessions(userId) {
  await connect();
  await Session.deleteMany({ userId });
}

// Bet helpers
async function getUserBets(userId, { includeArchived = false, includeDeleted = false } = {}) {
  await connect();
  const q = { userId };
  if (!includeArchived) q.archivedAt = null;
  if (!includeDeleted) q.deletedAt = null;
  return Bet.find(q).sort({ createdAt: -1 }).lean();
}

async function getBetById(betId) {
  await connect();
  return Bet.findById(betId).lean();
}

async function getBetByShareToken(token) {
  await connect();
  return Bet.findOne({ shareToken: token, deletedAt: null }).lean();
}

async function createBet(userId, betData) {
  await connect();
  const bet = new Bet({ userId, ...betData, shareToken: genShareToken() });
  return bet.save();
}

async function updateBet(betId, userId, data) {
  await connect();
  data.updatedAt = new Date();
  return Bet.findOneAndUpdate({ _id: betId, userId }, { $set: data }, { new: true }).lean();
}

async function deleteBet(betId, userId) {
  await connect();
  return Bet.findOneAndUpdate({ _id: betId, userId }, { $set: { deletedAt: new Date() } }, { new: true }).lean();
}

async function restoreBet(betId, userId) {
  await connect();
  return Bet.findOneAndUpdate({ _id: betId, userId }, { $unset: { deletedAt: 1 } }, { new: true }).lean();
}

async function archiveBet(betId, userId, { settled = false, result = null } = {}) {
  await connect();
  const update = { archivedAt: new Date(), updatedAt: new Date() };
  if (settled) { update.settledAt = new Date(); if (result) update.result = result; }
  return Bet.findOneAndUpdate({ _id: betId, userId }, { $set: update }, { new: true }).lean();
}

async function unarchiveBet(betId, userId) {
  await connect();
  return Bet.findOneAndUpdate(
    { _id: betId, userId },
    { $unset: { archivedAt: 1, settledAt: 1, result: 1, autoArchived: 1 }, $set: { keepAfterUnarchive: true, updatedAt: new Date() } },
    { new: true }
  ).lean();
}

async function getPublicBets(userId) {
  await connect();
  return Bet.find({ userId, vis: 'public', deletedAt: null, archivedAt: null }).sort({ createdAt: -1 }).lean();
}

// Social helpers
async function followUser(followerId, followingId) {
  if (followerId === followingId) throw new Error('نمی‌توانید خودتان را دنبال کنید');
  await connect();
  const existing = await Follow.findOne({ followerId, followingId });
  if (existing) return { already: true };
  await Follow.create({ followerId, followingId });
  await User.findByIdAndUpdate(followerId, { $inc: { followingCount: 1 } });
  await User.findByIdAndUpdate(followingId, { $inc: { followersCount: 1 } });
  return { followed: true };
}

async function unfollowUser(followerId, followingId) {
  await connect();
  const res = await Follow.findOneAndDelete({ followerId, followingId });
  if (res) {
    await User.findByIdAndUpdate(followerId, { $inc: { followingCount: -1 } });
    await User.findByIdAndUpdate(followingId, { $inc: { followersCount: -1 } });
  }
  return { unfollowed: !!res };
}

async function getFollowers(userId, limit = 50) {
  await connect();
  return Follow.find({ followingId: userId }).populate('followerId', 'username name avatar isPublic').limit(limit).lean();
}

async function getFollowing(userId, limit = 50) {
  await connect();
  return Follow.find({ followerId: userId }).populate('followingId', 'username name avatar isPublic').limit(limit).lean();
}

async function isFollowing(followerId, followingId) {
  await connect();
  return !!await Follow.findOne({ followerId, followingId });
}

// Match helpers (for live results cache)
async function upsertMatches(matches) {
  await connect();
  const ops = matches.map(m => ({
    updateOne: {
      filter: { homeNorm: m.homeNorm, awayNorm: m.awayNorm, startTime: m.startTime },
      update: { $set: { ...m, updatedAt: new Date() } },
      upsert: true,
    },
  }));
  if (ops.length) await Match.bulkWrite(ops, { ordered: false });
}

async function getMatchesForBets(legs, now = new Date()) {
  await connect();
  const keys = legs.map(l => ({ homeNorm: l.homeNorm, awayNorm: l.awayNorm }));
  const or = keys.map(k => ({ homeNorm: k.homeNorm, awayNorm: k.awayNorm }));
  return Match.find({ $or: or, startTime: { $lte: new Date(now.getTime() + 2 * 86400000) } }).lean();
}

// Backup helpers
async function createDailyBackup(userId) {
  await connect();
  const today = new Date().toISOString().slice(0, 10);
  const bets = await Bet.find({ userId }).lean();
  const existing = await Backup.findOne({ userId, date: today });
  if (existing) return existing;
  return Backup.create({ userId, date: today, data: bets });
}

async function getBackups(userId) {
  await connect();
  return Backup.find({ userId }).sort({ date: -1 }).limit(14).lean();
}

async function getBackup(userId, date) {
  await connect();
  return Backup.findOne({ userId, date }).lean();
}

// Migration tracking
async function markMigrated(userId, fromRedisKey) {
  await connect();
  await Migration.create({ userId, fromRedisKey, status: 'done', migratedAt: new Date() });
}

async function isMigrated(userId) {
  await connect();
  return !!await Migration.findOne({ userId, status: 'done' });
}

// Lock helpers (using MongoDB for distributed locking)
async function acquireLock(key, ttlMs = 30000) {
  await connect();
  const now = Date.now();
  const expiresAt = now + ttlMs;
  const result = await Lock.findOneAndUpdate(
    { key },
    { $setOnInsert: { key, expiresAt, createdAt: now } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  if (result.expiresAt > now) {
    // Lock acquired or already ours
    await Lock.findOneAndUpdate({ key, expiresAt: { $lte: now } }, { $set: { expiresAt } });
    return true;
  }
  return false;
}

async function releaseLock(key) {
  await connect();
  await Lock.deleteOne({ key });
}

// Lock schema (add to models section)
const lockSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  expiresAt: { type: Number, required: true, index: true },
  createdAt: { type: Number, default: Date.now },
});
const Lock = mongoose.models.Lock || mongoose.model('Lock', lockSchema);

// Notification skip cache
async function getNotificationSkip(userId) {
  await connect();
  const doc = await NotificationSkip.findOne({ userId }).lean();
  return doc?.skipUntil || null;
}

async function setNotificationSkip(userId, skipUntil) {
  await connect();
  await NotificationSkip.findOneAndUpdate(
    { userId },
    { $set: { userId, skipUntil, updatedAt: Date.now() } },
    { upsert: true }
  );
}

const notificationSkipSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  skipUntil: { type: Number, required: true },
  updatedAt: { type: Number, default: Date.now },
});
const NotificationSkip = mongoose.models.NotificationSkip || mongoose.model('NotificationSkip', notificationSkipSchema);

// Last notify result (for /status command)
async function setLastNotifyResult(data) {
  await connect();
  await LastNotifyResult.findOneAndUpdate(
    {},
    { $set: { ...data, updatedAt: Date.now() } },
    { upsert: true }
  );
}

async function getLastNotifyResult() {
  await connect();
  return LastNotifyResult.findOne({}).lean();
}

const lastNotifyResultSchema = new mongoose.Schema({
  updatedAt: { type: Number, default: Date.now },
}, { strict: false });
const LastNotifyResult = mongoose.models.LastNotifyResult || mongoose.model('LastNotifyResult', lastNotifyResultSchema);

/* ---------- Export ---------- */
module.exports = {
  connect,
  User, Bet, Match, Follow, Session, Backup, Migration, Lock, NotificationSkip, LastNotifyResult,
  hashPassword, verifyPassword, genSalt, genToken, genShareToken,
  createUser, findUserByEmail, findUserByUsername, findUserById, authenticateUser,
  updateUserProfile, updateUserStats,
  createSession, getSession, deleteSession, deleteAllUserSessions,
  getUserBets, getBetById, getBetByShareToken, createBet, updateBet, deleteBet, restoreBet, archiveBet, unarchiveBet, getPublicBets,
  followUser, unfollowUser, getFollowers, getFollowing, isFollowing,
  upsertMatches, getMatchesForBets,
  createDailyBackup, getBackups, getBackup,
  markMigrated, isMigrated,
  acquireLock, releaseLock,
  getNotificationSkip, setNotificationSkip,
  setLastNotifyResult, getLastNotifyResult,
};