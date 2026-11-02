const { kv, user, rand } = require('./_lib');
const { call } = require('./_tg');
const CMDS = [['bets', 'فهرست بلیت‌های فعال'], ['bet', 'جزئیات یک بلیت (شماره یا نام)'], ['live', 'بازی‌های زنده'], ['risk', 'بازی‌های پرخطر'], ['summary', 'خلاصهٔ کامل'], ['stats', 'آمار بلیت‌های تمام‌شده'], ['status', 'وضعیت اعلان‌های خودکار'], ['help', 'راهنما']];
module.exports = async (q, s) => {
  const u = await user(q);
  if (!u) return s.status(401).json({ error: 'unauthorized' });
  const k = 'betslip:tgc:' + u;
  try {
    const cur = JSON.parse((await kv(['GET', k])) || 'null') || {};
    if (q.method === 'GET') return s.json({ chat: cur.chat || '', on: !!cur.on, hasToken: !!cur.token, hook: !!cur.hs, st: cur.st, gl: cur.gl, en: cur.en, sum: cur.sum, lastRun: +(await kv(['GET', 'betslip:lastrun'])) || 0, lastRes: JSON.parse((await kv(['GET', 'betslip:lastres'])) || 'null') });
    if (q.method === 'PUT') {
      const b = typeof q.body === 'string' ? JSON.parse(q.body) : q.body || {};
      const cfg = { ...cur, token: String(b.token || '').trim() || cur.token || '', chat: String(b.chat || '').trim(), on: !!b.on, st: b.st !== false, gl: b.gl !== false, en: b.en !== false, sum: [0, 15, 30, 60].includes(+b.sum) ? +b.sum : 15 };
      if (b.hook) {
        const base = String(process.env.SITE_BASE || b.base || '').replace(/\/$/, '');
        if (!/^https:\/\//.test(base)) return s.json({ ok: false, msg: 'آدرس سایت باید https باشد.' });
        cfg.hs = cur.hs || rand(16); cfg.base = base;
      }
      await kv(['SET', k, JSON.stringify(cfg)]);
      if (cfg.on && cfg.token && cfg.chat) await kv(['SADD', 'betslip:tg', u]); else await kv(['SREM', 'betslip:tg', u]);
      if (b.hook) {
        if (!cfg.token) return s.json({ ok: false, msg: 'ابتدا توکن ربات را ذخیره کنید.' });
        const r = await call(cfg, 'setWebhook', { url: cfg.base + '/api/telegram?u=' + encodeURIComponent(u), secret_token: cfg.hs, allowed_updates: ['message', 'callback_query'] });
        if (r.ok) await call(cfg, 'setMyCommands', { commands: CMDS.map(([command, description]) => ({ command, description })) });
        return s.json({ ok: !!r.ok, msg: r.ok ? 'دستورات ربات فعال شد. در تلگرام /start را بزنید.' : 'خطای تلگرام: ' + (r.description || 'نامشخص') });
      }
      if (b.test) {
        const j = await call(cfg, 'sendMessage', { chat_id: cfg.chat, text: '✅ Betslip: اتصال تلگرام برقرار است.' });
        return s.json({ ok: !!j.ok, msg: j.ok ? 'پیام آزمایشی ارسال شد.' + (cfg.on ? '' : ' (توجه: «اعلان‌های خودکار فعال باشد» تیک ندارد)') : 'خطای تلگرام: ' + (j.description || 'نامشخص') });
      }
      return s.json({ ok: true });
    }
    s.status(405).end();
  } catch (e) { s.status(500).json({ error: String(e.message || e) }); }
};
