// Upstash Redis از طریق REST (بدون وابستگی) + ابزارهای حساب کاربری و پروفایل
const crypto = require('crypto');
const C = require('./_core');
const U = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const T = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const kv = async (cmd) => {
  if (!U || !T) throw new Error('دیتابیس به پروژه وصل نیست');
  const r = await fetch(U, { method: 'POST', headers: { Authorization: 'Bearer ' + T }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
};
const token = (q) => String(q.headers.authorization || '').replace(/^Bearer /, '');
const hkey = (u) => 'betslip:b:' + u; // هر بلیت یک فیلد جدا در هش است (جلوگیری از بازنویسی کل داده)
const parse = (arr) => (arr || []).map((x) => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
const getRecs = async (u) => parse(await kv(['HVALS', hkey(u)]));
const profile = async (u) => { const v = await kv(['HGET', 'betslip:prof', u]); return v ? JSON.parse(v) : null; };
const ensureProfile = async (u) => {
  let p = await profile(u);
  if (!p) { p = { u, name: u, bio: '', pub: false, dvis: 'private', joined: Date.now(), score: 0, stats: { n: 0, won: 0, lost: 0, roi: 0 } }; await kv(['HSET', 'betslip:prof', u, JSON.stringify(p)]); }
  return p;
};
const recompute = async (u) => {
  const recs = await getRecs(u), p = await ensureProfile(u), sm = C.summary(recs);
  p.score = sm.score; p.stats = { n: sm.n, won: sm.won, lost: sm.lost, roi: sm.roi }; p.upd = Date.now();
  await kv(['HSET', 'betslip:prof', u, JSON.stringify(p)]);
  return p;
};
module.exports = {
  kv, token, hkey, parse, getRecs, profile, ensureProfile, recompute,
  user: async (q) => { const t = token(q); if (t.length < 20) return null; try { return await kv(['GET', 'betslip:sess:' + t]); } catch (e) { return null; } },
  hash: (p, salt) => crypto.scryptSync(p, salt, 32).toString('hex'),
  rand: (n) => crypto.randomBytes(n).toString('hex'),
};
