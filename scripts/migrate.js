/* scripts/migrate.js — Redis → MongoDB migration script
   Run locally: node scripts/migrate.js
   Requires: MONGODB_URI, KV_REST_API_URL, KV_REST_API_TOKEN in env
   Creates a single default account (Kasra_rostami) and migrates ALL data to it.
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

// --- Mongoose Models ---
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

// --- Default Account Credentials ---
const DEFAULT_USER = {
  username: 'kasra_rostami',
  email: 'rkasra18@gmail.com',
  password: '920771018',
  name: 'Kasra Rostami',
};

// --- Migration Logic ---
async function migrate() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI, { dbName: 'betslip', bufferCommands: false });
  console.log('✅ Connected');

  // 1. Create or get the default account
  console.log('👤 Creating/getting default account...');
  let defaultUser = await User.findOne({ username: DEFAULT_USER.username }).lean();

  if (!defaultUser) {
    console.log('  Creating new default account...');
    const salt = genSalt();
    const passwordHash = hashPassword(DEFAULT_USER.password, salt);

    const user = new User({
      email: DEFAULT_USER.email,
      username: DEFAULT_USER.username,
      passwordHash: `${salt}:${passwordHash}`,
      name: DEFAULT_USER.name,
      bio: '',
      isPublic: false,
      defaultVis: 'private',
      timezone: 'Europe/Istanbul',
      joinedAt: new Date(),
      lastActiveAt: new Date(),
      prefs: {},
      telegram: { connected: false },
      statsCache: { totalBets: 0, wonBets: 0, lostBets: 0, totalStaked: 0, totalReturn: 0, roi: 0, score: 0, updatedAt: new Date() },
    });
    await user.save();
    defaultUser = user.toObject();
    console.log(`  ✅ Default account created: ${DEFAULT_USER.username}`);
  } else {
    // Update password to the specified one
    const salt = genSalt();
    const passwordHash = hashPassword(DEFAULT_USER.password, salt);
    await User.findByIdAndUpdate(defaultUser._id, {
      passwordHash: `${salt}:${passwordHash}`,
      email: DEFAULT_USER.email,
      name: DEFAULT_USER.name,
      updatedAt: new Date()
    });
    console.log(`  ✅ Default account exists, password updated: ${DEFAULT_USER.username}`);
  }

  const defaultUserId = defaultUser._id.toString();

  // 2. Get all user keys from Redis
  console.log('🔍 Scanning Redis for users...');
  const allKeys = await kv(['KEYS', 'betslip:prof:*']);
  const userKeys = allKeys.filter(k => k.startsWith('betslip:prof:'));
  console.log(`👥 Found ${userKeys.length} user profiles in Redis`);

  // Collect all data from all users
  let allBets = [];
  let allTgConfigs = [];
  let allSessions = [];
  let totalBets = 0;
  let totalUsers = 0;

  for (const profKey of userKeys) {
    const username = profKey.replace('betslip:prof:', '');
    try {
      console.log(`  🔄 Processing ${username}...`);

      // 1. Get profile
      const profRaw = await kv(['HGET', 'betslip:prof', username]);
      const prof = profRaw ? JSON.parse(profRaw) : null;

      // 2. Get bets (new hash structure)
      const betsRaw = await kv(['HVALS', `betslip:b:${username}`]);
      const bets = (betsRaw || []).map(b => JSON.parse(b)).filter(Boolean);

      // 3. Get trash (old structure might have trash in separate key)
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
      const sessionKeys = await kv(['KEYS', 'betslip:sess:*']);
      const userSessions = [];
      for (const sk of sessionKeys) {
        const val = await kv(['GET', sk]);
        if (val === username) {
          const token = sk.replace('betslip:sess:', '');
          userSessions.push({ token, createdAt: new Date() });
        }
      }

      // Merge bets from this user into allBets
      const userAllBets = [...bets, ...oldBets.filter(b => !bets.find(x => x.id === b.id))];
      if (userAllBets.length) {
        // Update userId for all bets to defaultUserId
        const betDocs = userAllBets.map(b => {
          let shareToken = b.share;
          if (!shareToken && b.vis !== 'private') shareToken = genShareToken();
          else if (b.vis === 'private') shareToken = undefined;

          return {
            userId: defaultUserId,
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
        allBets.push(...betDocs);
        totalBets += betDocs.length;
      }

      // Merge telegram config (keep the first one found, or merge)
      if (tgConfig && tgConfig.token) {
        allTgConfigs.push({
          userId: defaultUserId,
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

      // Merge sessions
      for (const sk of sessionKeys) {
        const val = await kv(['GET', sk]);
        if (val === username) {
          const token = sk.replace('betslip:sess:', '');
          allSessions.push({ token, createdAt: new Date(), userAgent: 'migrated', ip: '0.0.0.0' });
        }
      }

      totalUsers++;
      console.log(`  ✅ ${username}: ${userAllBets.length} bets, ${userSessions.length} sessions, ${tgConfig?.token ? 'TG' : 'no TG'}`);

    } catch (e) {
      console.error(`  ❌ ${username} failed:`, e.message);
    }
  }

  // 3. Save all merged data to MongoDB
  console.log('\n💾 Saving merged data to MongoDB...');

  // Save bets
  if (allBets.length) {
    await Bet.insertMany(allBets, { ordered: false });
    console.log(`  ✅ Saved ${allBets.length} bets`);
  }

  // Save telegram config (use the first one, or merge if multiple)
  if (allTgConfigs.length) {
    const tgConfig = allTgConfigs[0]; // Use first one
    await TgConfig.findOneAndUpdate(
      { userId: defaultUserId },
      { $set: tgConfig },
      { upsert: true, new: true }
    );
    console.log(`  ✅ Saved Telegram config`);
  }

  // Save sessions
  if (allSessions.length) {
    await Session.insertMany(allSessions, { ordered: false });
    console.log(`  ✅ Saved ${allSessions.length} sessions`);
  }

  // 4. Update default user's stats
  const settledBets = allBets.filter(b => b.result === 'won' || b.result === 'lost');
  const wonBets = settledBets.filter(b => b.result === 'won');
  const totalStaked = allBets.reduce((s, b) => s + (b.stake || 0), 0);
  const totalReturn = wonBets.reduce((s, b) => s + (b.stake || 0) * (b.odds || 0), 0);
  const score = wonBets.reduce((s, b) => s + Math.round(10 * Math.log(b.odds || 1)), 0) - settledBets.length * 5;

  await User.findByIdAndUpdate(defaultUserId, {
    $set: {
      statsCache: {
        totalBets: settledBets.length,
        wonBets: wonBets.length,
        lostBets: settledBets.length - wonBets.length,
        totalStaked,
        totalReturn,
        roi: totalStaked ? (totalReturn - totalStaked) / totalStaked : 0,
        score,
        updatedAt: new Date(),
      },
      lastActiveAt: new Date(),
    }
  });
  console.log(`  ✅ Updated user stats`);

  // 5. Mark migration as done
  await Migration.create({ userId: defaultUserId, status: 'done', migratedAt: new Date() });

  console.log(`\n📊 Migration Summary:`);
  console.log(`  👥 Source users: ${totalUsers}`);
  console.log(`  🎫 Total bets migrated: ${totalBets}`);
  console.log(`  🤖 Telegram configs: ${allTgConfigs.length}`);
  console.log(`  🔐 Sessions: ${allSessions.length}`);
  console.log(`  ✅ Default account: ${DEFAULT_USER.username} (${DEFAULT_USER.email})`);

  await mongoose.disconnect();
  console.log('🔌 Disconnected');
}

migrate().catch(e => { console.error('💥 Fatal:', e); process.exit(1); });