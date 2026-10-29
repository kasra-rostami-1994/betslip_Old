// Upstash Redis از طریق REST (بدون وابستگی) + ابزارهای حساب کاربری
const crypto = require('crypto');
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
exports.kv = kv;
exports.token = token;
exports.user = async (q) => { const t = token(q); if (t.length < 20) return null; try { return await kv(['GET', 'betslip:sess:' + t]); } catch (e) { return null; } };
exports.hash = (p, salt) => crypto.scryptSync(p, salt, 32).toString('hex');
exports.rand = (n) => crypto.randomBytes(n).toString('hex');
