const { kv, hash, rand, token } = require('./_lib');
module.exports = async (q, s) => {
  if (q.method !== 'POST') return s.status(405).end();
  try {
    const b = typeof q.body === 'string' ? JSON.parse(q.body) : (q.body || {});
    const ip = String(q.headers['x-forwarded-for'] || '').split(',')[0] || 'x';
    const rk = 'betslip:rl:' + ip, n = await kv(['INCR', rk]);
    if (n === 1) await kv(['EXPIRE', rk, '900']);
    if (n > 15) return s.status(429).json({ error: 'تلاش زیاد؛ ۱۵ دقیقه بعد دوباره امتحان کنید' });
    if (b.action === 'logout') { const t = token(q); if (t) await kv(['DEL', 'betslip:sess:' + t]); return s.json({ ok: 1 }); }
    const u = String(b.user || '').trim().toLowerCase(), p = String(b.pass || '');
    if (!/^[a-z0-9_.-]{3,24}$/.test(u) || p.length < 8) return s.status(400).json({ error: 'نام کاربری ۳ تا ۲۴ حرف انگلیسی/عدد و رمز حداقل ۸ کاراکتر باشد' });
    const uk = 'betslip:user:' + u, cur = await kv(['GET', uk]);
    if (b.action === 'signup') {
      if (process.env.INVITE_CODE && b.invite !== process.env.INVITE_CODE) return s.status(403).json({ error: 'کد دعوت اشتباه است' });
      if (cur) return s.status(409).json({ error: 'این نام کاربری قبلاً ثبت شده است' });
      const salt = rand(16);
      await kv(['SET', uk, JSON.stringify({ salt, hash: hash(p, salt) })]);
      if (!(await kv(['EXISTS', 'betslip:migrated']))) { // داده‌های نسخهٔ تک‌کاربرهٔ قبلی به اولین حساب منتقل می‌شود
        const old = await kv(['GET', 'betslip:data']);
        if (old) await kv(['SET', 'betslip:d:' + u, old]);
        await kv(['SET', 'betslip:migrated', '1']);
      }
    } else {
      const c = cur && JSON.parse(cur);
      if (!c || hash(p, c.salt) !== c.hash) return s.status(401).json({ error: 'نام کاربری یا رمز اشتباه است' });
    }
    const t = rand(24);
    await kv(['SET', 'betslip:sess:' + t, u, 'EX', '2592000']);
    s.json({ token: t, user: u });
  } catch (e) { s.status(500).json({ error: String(e.message || e) }); }
};
