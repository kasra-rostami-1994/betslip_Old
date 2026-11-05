/* scripts/migrate.js — Redis → MongoDB migration script
   Run locally: node scripts/migrate.js
   Requires: MONGODB_URI, KV_REST_API_URL, KV_REST_API_TOKEN in env
*/
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const crypto = require('crypto');
const mongoose = require('mongoose');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const MONGODB_URI = process.env.MONGODB_URI;
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

if (!MONGODB_URI || !KV_URL || !KV_TOKEN) {
  console.error('❌ Missing env vars: MONGODB_URI, KV_REST_API_URL, KV_REST_API_TOKEN');
  process.exit(1);
}

// --- Redis REST client ---
async function kv(cmd) {
  const r = await fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

// --- Password hashing (match original _lib.js) ---
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 32).toString('hex');
}
function genSalt() { return crypto.randomBytes(16).toString('hex'); }
function genToken() { return crypto.randomBytes(24).toString('hex'); }
function genShareToken() { return crypto.randomBytes(12).toString('hex'); }

// --- Mongoose Models (inline for migration script) ---
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
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  followersCount: { type: Number, default: 0 },
  followingCount: { type: Number, default: 0 },
  prefs: { type: Object, default: {} },
  telegram: { type: Object, default: {} },
  statsCache: { type: Object, default: {} },
}, { timestamps: true });

const betSchema = new mongoose.Schema({
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
  deletedAt: { type: Date, default: null },
  legs: [mongoose.Schema.Types.Mixed],
}, { timestamps: true });

const sessionSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  createdAt: { type: Date, default: Date.now, expires: '30d' },
}, { timestamps: true });

const tgConfigSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  token: String, chatId: String, on: Boolean, st: Boolean, gl: Boolean, en: Boolean, sum: Number,
  hs: String, base: String,
}, { timestamps: true });

const migrationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  status: { type: String, enum: ['pending', 'done', 'failed'], default: 'pending' },
  migratedAt: Date,
  error: String,
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Bet = mongoose.model('Bet', betSchema);
const Session = mongoose.model('Session', sessionSchema);
const TgConfig = mongoose.model('TgConfig', tgConfigSchema);
const Migration = mongoose.model('Migration', migrationSchema);

// --- Helper: normalize old password hash ---
function normalizeOldHash(oldHash) {
  // old _lib.js stored scrypt hash directly; new format is "salt:hash"
  // If it already contains ':', assume it's new format
  if (oldHash && oldHash.includes(':')) return oldHash;
  // Otherwise, we can't recover salt. We'll need user to reset password.
  // For migration, generate new salt and mark for password reset.
  const salt = genSalt();
  return `${salt}:${oldHash}`; // This won't verify, user must reset
}

// --- Migration Logic ---
async function migrate() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI, { dbName: 'betslip', bufferCommands: false });
  console.log('✅ Connected');

  // Get all user keys from Redis
  console.log('🔍 Scanning Redis for users...');
  const allKeys = await kv(['KEYS', 'betslip:prof:*']); // or use SCAN for production
  const userKeys = allKeys.filter(k => k.startsWith('betslip:prof:'));
  console.log(`👥 Found ${userKeys.length} user profiles`);

  let migrated = 0, skipped = 0, errors = 0;

  for (const profKey of userKeys) {
    const username = profKey.replace('betslip:prof:', '');
    try {
      // Check if already migrated
      const existingMig = await Migration.findOne({ userId: { $exists: false } }).lean(); // placeholder
      // Better: check by username in User collection
      const existingUser = await User.findOne({ username }).lean();
      if (existingUser) {
        console.log(`  ⏭ ${username} already migrated`);
        skipped++;
        continue;
      }

      console.log(`  🔄 Migrating ${username}...`);

      // 1. Get profile
      const profRaw = await kv(['HGET', 'betslip:prof', username]);
      const prof = profRaw ? JSON.parse(profRaw) : null;

      // 2. Get bets (new hash structure)
      const betsRaw = await kv(['HVALS', `betslip:b:${username}`]);
      const bets = (betsRaw || []).map(b => JSON.parse(b)).filter(Boolean);

      // 3. Get trash (old structure might have trash in separate key)
      // Check old single-blob format
      const oldBlob = await kv(['GET', `betslip:d:${username}`]);
      let oldBets = [];
      if (oldBlob) {
        try {
          const parsed = JSON.parse(oldBlob);
          if (parsed && Array.isArray(parsed.bets)) oldBets = parsed.bets;
        } catch (e) {}
      }

      // 4. Get telegram config
      const tgRaw = await kv(['GET', `betslip:tgc:${username}`]);
      const tgConfig = tgRaw ? JSON.parse(tgRaw) : null;

      // 5. Get sessions (for this user)
      // Sessions are stored as betslip:sess:<token> -> username
      // We'll need to scan all session keys
      const sessionKeys = await kv(['KEYS', 'betslip:sess:*']);
      const userSessions = [];
      for (const sk of sessionKeys) {
        const val = await kv(['GET', sk]);
        if (val === username) {
          const token = sk.replace('betslip:sess:', '');
          userSessions.push({ token, createdAt: new Date() }); // approximate
        }
      }

      // --- Create User ---
      const salt = genSalt();
      const tempPassword = crypto.randomBytes(16).toString('hex'); // user must reset
      const passwordHash = hashPassword(tempPassword, salt);

      const user = new User({
        email: `${username}@migrate.local`, // placeholder, user must update
        username: username.toLowerCase(),
        passwordHash: `${salt}:${hashPassword(tempPassword, salt)}`,
        name: prof?.name || username,
        bio: prof?.bio || '',
        isPublic: prof?.pub || false,
        defaultVis: prof?.dvis || 'private',
        timezone: prof?.timezone || 'Europe/Istanbul',
        joinedAt: prof?.joined ? new Date(prof.joined) : new Date(),
        lastActiveAt: new Date(),
        prefs: prof?.prefs || {},
        telegram: tgConfig ? {
          connected: !!tgConfig.token,
          chatId: tgConfig.chat,
          token: tgConfig.token,
          webhookSecret: tgConfig.hs,
          base: tgConfig.base,
          notifyPrefs: {
            kickoff: tgConfig.st !== false,
            goal: tgConfig.gl !== false,
            ft: tgConfig.en !== false,
            betResult: true,
            digest: tgConfig.sum === undefined ? 15 : +tgConfig.sum,
          },
        } : { connected: false },
        statsCache: prof?.stats || { totalBets: 0, wonBets: 0, lostBets: 0, totalStaked: 0, totalReturn: 0, roi: 0, score: 0, updatedAt: new Date() },
      });
      await user.save();
      const userId = user._id;

      // --- Create Bets ---
      const allBets = [...bets, ...oldBets.filter(b => !bets.find(x => x.id === b.id))];
      if (allBets.length) {
        const betDocs = allBets.map(b => {
          // Generate shareToken if visible and not present
          let shareToken = b.share;
          if (!shareToken && b.vis !== 'private') shareToken = genShareToken();
          else if (b.vis === 'private') shareToken = undefined;

          return {
            userId,
            name: b.name || `multi ${b.legs?.length || 0}`,
            stake: b.stake || 0,
            odds: b.odds || 0,
            win: b.win || 0,
            cash: b.cash ?? null,
            tags: b.tags || [],
            note: b.note || '',
            vis: b.vis || 'private',
            shareToken,
            createdAt: b.created ? new Date(b.created) : new Date(),
            updatedAt: b.upd ? new Date(b.upd) : new Date(),
            archivedAt: b.arch ? new Date(b.arch) : null,
            settledAt: b.sett ? new Date(b.sett) : null,
            result: b.res || 'open',
            autoArchived: !!b.auto,
            keepAfterUnarchive: !!b.keep,
            deletedAt: b.del ? new Date(b.del) : null,
            legs: (b.legs || []).map(l => ({
              home: l.home, away: l.away, pick: l.pick, odds: l.odds,
              league: l.lg,
              manualOverride: l.ov ? { h: l.ov.h, a: l.ov.a, minute: l.ov.m, isFinal: !!l.ov.f } : undefined,
              manualMatchMap: l.map,
              savedResult: l.fin ? { h: l.fin.h, a: l.fin.a, winner: l.fin.w, at: l.fin.t ? new Date(l.fin.t) : null, league: l.fin.lg } : undefined,
            })),
          };
        });
        await Bet.insertMany(betDocs, { ordered: false });
      }

      // --- Create Sessions ---
      if (userSessions.length) {
        const sessionDocs = userSessions.map(s => ({
          token: s.token,
          userId,
          createdAt: s.createdAt,
          userAgent: 'migrated',
          ip: '0.0.0.0',
        }));
        await Session.insertMany(sessionDocs, { ordered: false });
      }

      // --- Create TgConfig ---
      if (tgConfig && tgConfig.token) {
        await TgConfig.create({
          userId,
          token: tgConfig.token,
          chatId: tgConfig.chat,
          on: tgConfig.on !== false,
          st: tgConfig.st !== false,
          gl: tgConfig.gl !== false,
          en: tgConfig.en !== false,
          sum: tgConfig.sum === undefined ? 15 : +tgConfig.sum,
          hs: tgConfig.hs,
          base: tgConfig.base,
        });
      }

      // --- Mark Migration ---
      await Migration.create({ userId, status: 'done', migratedAt: new Date() });

      console.log(`  ✅ ${username} migrated (${allBets.length} bets, ${userSessions.length} sessions)`);
      migrated++;
    } catch (e) {
      console.error(`  ❌ ${username} failed:`, e.message);
      errors++;
    }
  }

  console.log(`\n📊 Migration Summary:`);
  console.log(`  ✅ Migrated: ${migrated}`);
  console.log(`  ⏭ Skipped: ${skipped}`);
  console.log(`  ❌ Errors: ${errors}`);

  await mongoose.disconnect();
  console.log('🔌 Disconnected');
}

migrate().catch(e => { console.error('💥 Fatal:', e); process.exit(1); });