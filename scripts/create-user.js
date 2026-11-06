/* Create kasra_rostami account with data from kasra_rst in Upstash */
require('dotenv').config();
const crypto = require('crypto');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// Upstash client
async function kv(cmd) {
  const r = await fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd)
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

// Password hashing
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 32).toString('hex');
}
function genSalt() { return crypto.randomBytes(16).toString('hex'); }

// Mongoose Models
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

const tgConfigSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  token: String, chatId: String, on: Boolean, st: Boolean, gl: Boolean, en: Boolean, sum: Number,
  hs: String, base: String,
}, { timestamps: true });

const sessionSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  createdAt: { type: Date, default: Date.now, expires: '30d' },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Bet = mongoose.model('Bet', betSchema);
const TgConfig = mongoose.model('TgConfig', tgConfigSchema);
const Session = mongoose.model('Session', sessionSchema);

function genSalt() { return crypto.randomBytes(16).toString('hex'); }
function genShareToken() { return crypto.randomBytes(12).toString('hex'); }
function genToken() { return crypto.randomBytes(24).toString('hex'); }

async function main() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI, { dbName: 'betslip', bufferCommands: false });
  console.log('✅ Connected');

  // 1. Read profile from Upstash (try HGETALL first, then GET)
  console.log('📖 Reading profile from Upstash...');
  let prof = null;
  try {
    const profHash = await kv(['HGETALL', 'betslip:prof']);
    if (profHash && Object.keys(profHash).length > 0) {
      // It's a hash, find the user field
      const username = 'kasra_rst';
      const profRaw = profHash[username];
      if (profRaw) prof = JSON.parse(profRaw);
    }
  } catch (e) {}
  if (!prof) {
    const profRaw = await kv(['GET', 'betslip:prof']);
    if (profRaw) prof = JSON.parse(profRaw);
  }
  console.log('Profile:', prof);

  // Also check bets hash key
  console.log('📖 Reading bets hash key...');
  const betsHashKey = 'betslip:b:kasra_rst';

  // 2. Read bets from Upstash (Hash)
  console.log('📖 Reading bets from Upstash...');
  const betsRaw = await kv(['HVALS', 'betslip:b:kasra_rst']);
  const bets = (betsRaw || []).map(b => JSON.parse(b)).filter(Boolean);
  console.log(`Found ${bets.length} bets`);

  // 3. Read old bets (single blob)
  console.log('📖 Reading old blob...');
  const oldBlob = await kv(['GET', 'betslip:d:kasra_rst']);
  let oldBets = [];
  if (oldBlob) {
    try {
      const parsed = JSON.parse(oldBlob);
      if (parsed && Array.isArray(parsed.bets)) oldBets = parsed.bets;
    } catch (e) {}
  }
  console.log(`Found ${oldBets.length} old bets`);

  // 4. Read telegram config
  console.log('📖 Reading telegram config...');
  const tgRaw = await kv(['GET', 'betslip:tgc:kasra_rst']);
  const tgConfig = tgRaw ? JSON.parse(tgRaw) : null;
  console.log('Telegram config:', tgConfig);

  // 5. Read sessions
  console.log('📖 Reading sessions...');
  const sessionKeys = await kv(['KEYS', 'betslip:sess:*']);
  const sessions = [];
  for (const sk of sessionKeys) {
    const val = await kv(['GET', sk]);
    if (val === 'kasra_rst') {
      const token = sk.replace('betslip:sess:', '');
      sessions.push({ token, createdAt: new Date() });
    }
  }
  console.log(`Found ${sessions.length} sessions`);

  // 5. Create/Update default user
  console.log('\n👤 Creating/updating default account...');
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = crypto.scryptSync('920771018', salt, 32).toString('hex');

  const user = await User.findOneAndUpdate(
    { username: 'kasra_rostami' },
    {
      email: 'rkasra18@gmail.com',
      username: 'kasra_rostami',
      passwordHash: `${salt}:${passwordHash}`,
      name: 'Kasra Rostami',
      bio: '',
      isPublic: false,
      defaultVis: 'private',
      timezone: 'Europe/Istanbul',
      joinedAt: new Date(),
      lastActiveAt: new Date(),
      prefs: {},
      telegram: { connected: false },
      statsCache: { totalBets: 0, wonBets: 0, lostBets: 0, totalStaked: 0, totalReturn: 0, roi: 0, score: 0, updatedAt: new Date() },
    },
    { upsert: true, new: true }
  );
  const userId = user._id.toString();
  console.log(`✅ Default account: ${user.username} (${userId})`);

  // 6. Migrate bets
  const allBets = [...bets, ...oldBets.filter(b => !bets.find(x => x.id === b.id))];
  if (allBets.length) {
    const betDocs = allBets.map(b => {
      let shareToken = b.share;
      if (!shareToken && b.vis !== 'private') shareToken = crypto.randomBytes(12).toString('hex');
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
    console.log(`✅ Saved ${betDocs.length} bets`);
  } else {
    console.log('ℹ️ No bets found');
  }

  // 7. Save telegram config
  if (tgConfig && tgConfig.token) {
    await TgConfig.findOneAndUpdate(
      { userId },
      { $set: {
        token: tgConfig.token,
        chatId: tgConfig.chat,
        on: tgConfig.on !== false,
        st: tgConfig.st !== false,
        gl: tgConfig.gl !== false,
        en: tgConfig.en !== false,
        sum: tgConfig.sum === undefined ? 15 : +tgConfig.sum,
        hs: tgConfig.hs,
        base: tgConfig.base,
      }},
      { upsert: true, new: true }
    );
    console.log('✅ Saved Telegram config');
  } else {
    console.log('ℹ️ No Telegram config found');
  }

  // 8. Save sessions
  if (sessions.length) {
    const sessionDocs = sessions.map(s => ({
      token: s.token,
      userId,
      createdAt: s.createdAt,
      userAgent: 'migrated',
      ip: '0.0.0.0',
    }));
    await Session.insertMany(sessionDocs, { ordered: false });
    console.log(`✅ Saved ${sessions.length} sessions`);
  }

  // 9. Update user stats
  const settledBets = (await Bet.find({ userId, deletedAt: null }).lean()).filter(b => b.result === 'won' || b.result === 'lost');
  const wonBets = settledBets.filter(b => b.result === 'won');
  const totalStaked = settledBets.reduce((s, b) => s + (b.stake || 0), 0);
  const totalReturn = wonBets.reduce((s, b) => s + (b.stake || 0) * (b.odds || 0), 0);
  const score = wonBets.reduce((s, b) => s + Math.round(10 * Math.log(b.odds || 1)), 0) - settledBets.length * 5;

  await User.findByIdAndUpdate(userId, {
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
  console.log('✅ Updated user stats');

  // 10. Mark migration
  await mongoose.model('Migration', new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true }, status: String, migratedAt: Date, error: String })).create({ userId, status: 'done', migratedAt: new Date() });
  console.log('✅ Migration marked');

  console.log('\n📊 Migration Summary:');
  console.log(`  ✅ Default account: kasra_rostami (rkasra18@gmail.com)`);
  console.log(`  🎫 Total bets: ${allBets.length}`);
  console.log(`  🤖 Telegram: ${tgConfig?.token ? 'yes' : 'no'}`);
  console.log(`  🔐 Sessions: ${sessions.length}`);

  await mongoose.disconnect();
  console.log('🔌 Disconnected');
}

main().catch(e => { console.error('❌ Error:', e); process.exit(1); });