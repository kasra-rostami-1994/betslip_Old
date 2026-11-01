const { kv, user } = require('./_lib');
module.exports = async (q, s) => {
  const u = await user(q);
  if (!u) return s.status(401).json({ error: 'unauthorized' });
  const k = 'betslip:tgc:' + u;
  try {
    const cur = JSON.parse((await kv(['GET', k])) || 'null') || {};
    if (q.method === 'GET') return s.json({ chat: cur.chat || '', on: !!cur.on, hasToken: !!cur.token });
    if (q.method === 'PUT') {
      const b = typeof q.body === 'string' ? JSON.parse(q.body) : q.body || {};
      const cfg = { token: String(b.token || '').trim() || cur.token || '', chat: String(b.chat || '').trim(), on: !!b.on };
      await kv(['SET', k, JSON.stringify(cfg)]);
      if (cfg.on && cfg.token && cfg.chat) await kv(['SADD', 'betslip:tg', u]); else await kv(['SREM', 'betslip:tg', u]);
      if (b.test) {
        const r = await fetch('https://api.telegram.org/bot' + cfg.token + '/sendMessage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: cfg.chat, text: '✅ Betslip: اتصال تلگرام برقرار است.' }) });
        const j = await r.json();
        return s.json({ ok: !!j.ok, msg: j.ok ? 'پیام آزمایشی ارسال شد.' : 'خطای تلگرام: ' + (j.description || 'نامشخص') });
      }
      return s.json({ ok: true });
    }
    s.status(405).end();
  } catch (e) { s.status(500).json({ error: String(e.message || e) }); }
};
