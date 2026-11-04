// ذخیرهٔ بلیت‌ها: هر بلیت یک فیلد جدا. کلاینت فقط تغییرات را می‌فرستد (up/rm)، پس دستگاهِ قدیمی هرگز بلیت‌های تازه را پاک نمی‌کند.
const { kv, user, hkey, parse, getRecs, recompute } = require('./_lib');
const tok = (x) => /^[0-9a-f]{24}$/.test(x || '');
module.exports = async (q, s) => {
  const u = await user(q);
  if (!u) return s.status(401).json({ error: 'unauthorized' });
  const key = hkey(u);
  try {
    if (q.method === 'GET') {
      if (q.query && q.query.backup) { const v = await kv(['GET', 'betslip:bak:' + u + ':' + String(q.query.backup).slice(0, 10)]); return s.json({ records: v ? JSON.parse(v) : [] }); }
      let recs = await getRecs(u);
      if (!recs.length && !(await kv(['EXISTS', 'betslip:mig:' + u]))) { // انتقال یک‌باره از ساختار قدیمی (نسخهٔ قدیمی دست‌نخورده می‌ماند)
        const old = JSON.parse((await kv(['GET', 'betslip:d:' + u])) || 'null');
        if (old && Array.isArray(old.bets)) {
          const all = [...old.bets, ...(Array.isArray(old.trash) ? old.trash : [])].filter((b) => b && b.id && Array.isArray(b.legs));
          const args = []; all.forEach((b) => { b.upd = b.upd || Date.now(); args.push(b.id, JSON.stringify(b)); });
          for (let i = 0; i < args.length; i += 100) await kv(['HSET', key, ...args.slice(i, i + 100)]);
          for (const b of all) if (tok(b.share) && !b.del) await kv(['SET', 'betslip:share:' + b.share, u + '|' + b.id]);
          recs = all; await recompute(u);
        }
        await kv(['SET', 'betslip:mig:' + u, '1']);
      }
      return s.json({ records: recs });
    }
    if (q.method === 'PUT') {
      const b = typeof q.body === 'string' ? JSON.parse(q.body) : q.body || {};
      const up = (Array.isArray(b.up) ? b.up : []).slice(0, 300), rm = (Array.isArray(b.rm) ? b.rm : []).filter((x) => typeof x == 'string').slice(0, 300);
      const ids = up.map((r) => r && r.id), olds = ids.length ? await kv(['HMGET', key, ...ids.map(String)]) : [];
      const args = []; let touched = false;
      for (let i = 0; i < up.length; i++) {
        const r = up[i], js = r ? JSON.stringify(r) : '';
        if (!r || typeof r.id != 'string' || r.id.length > 40 || !Array.isArray(r.legs) || js.length > 150000) continue;
        const old = olds[i] ? JSON.parse(olds[i]) : null;
        if (old && old.upd > r.upd) continue; // نسخهٔ قدیمی‌تر؛ نادیده
        if (old && tok(old.share) && old.share !== r.share) await kv(['DEL', 'betslip:share:' + old.share]);
        if (tok(r.share) && !r.del) await kv(['SET', 'betslip:share:' + r.share, u + '|' + r.id]);
        else if (tok(r.share)) await kv(['DEL', 'betslip:share:' + r.share]);
        if (r.arch || r.del || (r.vis && r.vis !== 'private') || (old && (old.arch || old.del || (old.vis && old.vis !== 'private')))) touched = true;
        args.push(r.id, js);
      }
      if (args.length) await kv(['HSET', key, ...args]);
      if (rm.length) {
        const ol = await kv(['HMGET', key, ...rm]);
        for (const x of ol) { const o = x ? JSON.parse(x) : null; if (o && tok(o.share)) await kv(['DEL', 'betslip:share:' + o.share]); }
        await kv(['HDEL', key, ...rm]); touched = true;
      }
      await kv(['DEL', 'betslip:nx:' + u]); // زمان‌بند اعلان‌ها دوباره بررسی کند
      if (touched) await recompute(u);
      const day = new Date().toISOString().slice(0, 10); // پشتیبان روزانهٔ خودکار (۱۴ روز)
      if (args.length && (await kv(['SET', 'betslip:bf:' + u + ':' + day, '1', 'NX', 'EX', '90000']))) {
        const all = await kv(['HVALS', key]);
        await kv(['SET', 'betslip:bak:' + u + ':' + day, '[' + all.join(',') + ']', 'EX', '1209600']);
      }
      return s.json({ ok: 1, saved: args.length / 2, removed: rm.length });
    }
    s.status(405).end();
  } catch (e) { s.status(500).json({ error: String(e.message || e) }); }
};
