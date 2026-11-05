const { DB, token, hash, rand } = require('./_lib');

module.exports = async (q, s) => {
  if (q.method !== 'POST') return s.status(405).end();
  try {
    const b = typeof q.body === 'string' ? JSON.parse(q.body) : (q.body || {});
    const action = b.action;

    // Rate limiting: 15 requests per 15 min per IP
    const ip = String(q.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    const rlKey = `auth:rl:${ip}`;
    // Use a simple in-memory rate limiter for serverless (or Redis if available)
    // For now, skip rate limiting in migration or use a simple approach
    // TODO: Add proper rate limiting with Redis or MongoDB

    if (action === 'logout') {
      const t = token(q);
      if (t) await DB.deleteSession(t);
      return s.json({ ok: 1 });
    }

    if (action === 'passwd') {
      const userId = await DB.user(q);
      if (!userId) return s.status(401).json({ error: 'unauthorized' });
      const { pass, npass } = b;
      if (!pass || !npass) return s.status(400).json({ error: 'رمز فعلی و رمز جدید الزامی است' });
      if (npass.length < 8) return s.status(400).json({ error: 'رمز جدید حداقل ۸ کاراکتر باشد' });

      const user = await DB.findUserById(userId);
      if (!user) return s.status(404).json({ error: 'کاربر یافت نشد' });

      const [salt, oldHash] = user.passwordHash.split(':');
      if (!salt || hash(pass, salt) !== oldHash) {
        return s.status(401).json({ error: 'رمز فعلی اشتباه است' });
      }

      const newSalt = rand(16);
      const newHash = hash(npass, newSalt);
      await DB.User.findByIdAndUpdate(userId, { passwordHash: `${newSalt}:${newHash}`, updatedAt: new Date() });
      return s.json({ ok: 1 });
    }

    // signup or login
    // Accept 'user' field (sent by form) as alias for email/username
    const userField = String(b.user || b.username || b.email || '').trim().toLowerCase();
    const email = String(b.email || '').trim().toLowerCase();
    const username = String(b.username || '').trim().toLowerCase();
    const pass = String(b.pass || '');
    const invite = b.invite || '';

    // If userField provided but email/username not, infer from userField
    const inferredEmail = userField.includes('@') ? userField : '';
    const inferredUsername = userField.includes('@') ? '' : userField;
    const finalEmail = email || inferredEmail;
    const finalUsername = username || inferredUsername;

    // Validation
    if (action === 'signup') {
      if (!finalEmail || !finalEmail.includes('@')) return s.status(400).json({ error: 'ایمیل معتبر الزامی است' });
      if (!finalUsername || !/^[a-z0-9_.-]{3,24}$/.test(finalUsername)) {
        return s.status(400).json({ error: 'نام کاربری ۳ تا ۲۴ حرف انگلیسی/عدد/نقطه/اندرلاین/خط تیره باشد' });
      }
      if (pass.length < 8) return s.status(400).json({ error: 'رمز عبور حداقل ۸ کاراکتر باشد' });
      if (process.env.INVITE_CODE && invite !== process.env.INVITE_CODE) {
        return s.status(403).json({ error: 'کد دعوت اشتباه است' });
      }
    } else if (action === 'login') {
      if ((!finalEmail && !finalUsername) || !pass) {
        return s.status(400).json({ error: 'ایمیل/نام کاربری و رمز عبور الزامی است' });
      }
    } else {
      return s.status(400).json({ error: 'عملیات نامعتبر' });
    }

    let user;
    if (action === 'signup') {
      // Check if email or username already exists
      const existingEmail = await DB.findUserByEmail(finalEmail);
      if (existingEmail) return s.status(409).json({ error: 'این ایمیل قبلاً ثبت شده است' });
      const existingUser = await DB.findUserByUsername(finalUsername);
      if (existingUser) return s.status(409).json({ error: 'این نام کاربری قبلاً ثبت شده است' });

      // Create user
      user = await DB.createUser({ email: finalEmail, username: finalUsername, password: pass, name: finalUsername });
    } else {
      // login
      user = await DB.authenticateUser(finalEmail || finalUsername, pass);
      if (!user) return s.status(401).json({ error: 'ایمیل/نام کاربری یا رمز اشتباه است' });
    }

    // Create session
    const sessionToken = await DB.createSession(user._id.toString(), q.headers['user-agent'], ip);
    s.json({ token: sessionToken, user: { id: user._id.toString(), username: user.username, email: user.email, name: user.name } });

  } catch (e) {
    console.error('Auth error:', e);
    s.status(500).json({ error: String(e.message || e) });
  }
};