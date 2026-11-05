// Telegram settings & webhook management — MongoDB version
const { DB, token, user, rand } = require('./_lib');
const { call } = require('./_tg');

const CMDS = [
  ['bets', 'فهرست بلیت‌های فعال'], ['bet', 'جزئیات یک بلیت (شماره یا نام)'],
  ['live', 'بازی‌های زنده'], ['risk', 'بازی‌های پرخطر'],
  ['summary', 'خلاصهٔ کامل'], ['history', 'بلیت‌های تمام‌شده (بایگانی)'],
  ['hbet', 'جزئیات بلیت تمام‌شده'], ['stats', 'آمار'],
  ['status', 'وضعیت اعلان‌های خودکار'], ['help', 'راهنما'],
];

module.exports = async (q, s) => {
  const userId = await user(q);
  if (!userId) return s.status(401).json({ error: 'unauthorized' });

  try {
    // Get or create Telegram config
    let tgConfig = await DB.TgConfig.findOne({ userId }).lean();
    if (!tgConfig) {
      tgConfig = await DB.TgConfig.create({ userId, on: true, st: true, gl: true, en: true, sum: 15, hs: rand(16) });
    }

    if (q.method === 'GET') {
      return s.json({
        chat: tgConfig.chatId || '',
        on: !!tgConfig.on,
        hasToken: !!tgConfig.token,
        hook: !!tgConfig.webhookSecret,
        st: tgConfig.notifyPrefs?.kickoff !== false,
        gl: tgConfig.notifyPrefs?.goal !== false,
        en: tgConfig.notifyPrefs?.ft !== false,
        sum: tgConfig.notifyPrefs?.digest ?? 15,
        lastRes: null, // Could be stored in a separate collection if needed
      });
    }

    if (q.method === 'PUT') {
      const body = typeof q.body === 'string' ? JSON.parse(q.body) : (q.body || {});

      const update = {
        token: String(body.token || '').trim() || tgConfig.token || '',
        chatId: String(body.chat || '').trim() || tgConfig.chatId || '',
        on: !!body.on,
        'notifyPrefs.kickoff': body.st !== false,
        'notifyPrefs.goal': body.gl !== false,
        'notifyPrefs.ft': body.en !== false,
        'notifyPrefs.digest': [0, 15, 30, 60].includes(+body.sum) ? +body.sum : 15,
      };

      if (body.hook) {
        const base = String(process.env.SITE_BASE || body.base || '').replace(/\/$/, '');
        if (!/^https:\/\//.test(base)) return s.json({ ok: false, msg: 'آدرس سایت باید https باشد.' });
        update.webhookSecret = tgConfig.webhookSecret || rand(16);
      }

      await DB.TgConfig.findByIdAndUpdate(tgConfig._id, { $set: update }, { new: true });

      // Update user's telegram connected status
      if (update.token && update.chatId) {
        await DB.User.findByIdAndUpdate(userId, { $set: { 'telegram.connected': true } });
      } else {
        await DB.User.findByIdAndUpdate(userId, { $set: { 'telegram.connected': false } });
      }

      if (body.hook) {
        if (!update.token) return s.json({ ok: false, msg: 'ابتدا توکن ربات را ذخیره کنید.' });
        const r = await call({ ...tgConfig, ...update }, 'setWebhook', {
          url: (update.base || process.env.SITE_BASE || 'https://' + q.headers.host) + '/api/telegram?u=' + encodeURIComponent(userId),
          secret_token: update.webhookSecret,
          allowed_updates: ['message', 'callback_query'],
        });
        if (r.ok) await call({ ...tgConfig, ...update }, 'setMyCommands', {
          commands: CMDS.map(([command, description]) => ({ command, description })),
        });
        return s.json({ ok: !!r.ok, msg: r.ok ? 'دستورات ربات فعال شد. در تلگرام /start را بزنید.' : 'خطای تلگرام: ' + (r.description || 'نامشخص') });
      }

      if (body.test) {
        const j = await call({ ...tgConfig, ...update }, 'sendMessage', {
          chat_id: update.chatId,
          text: '✅ Betslip: اتصال تلگرام برقرار است.',
        });
        return s.json({ ok: !!j.ok, msg: j.ok ? 'پیام آزمایشی ارسال شد.' + (update.on ? '' : ' (توجه: «اعلان‌های خودکار فعال باشد» تیک ندارد)') : 'خطای تلگرام: ' + (j.description || 'نامشخص') });
      }

      return s.json({ ok: true });
    }

    s.status(405).end();
  } catch (e) {
    console.error('Settings API error:', e);
    s.status(500).json({ error: String(e.message || e) });
  }
};