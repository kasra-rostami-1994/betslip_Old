// Upstash Redis از طریق REST (بدون وابستگی). متغیرها را ورسل هنگام اتصال دیتابیس خودش می‌سازد.
const U = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const T = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
exports.kv = async (cmd) => {
  if (!U || !T) throw new Error('دیتابیس به پروژه وصل نیست');
  const r = await fetch(U, { method: 'POST', headers: { Authorization: 'Bearer ' + T }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
};
exports.authed = (q) => !!process.env.ADMIN_PASSWORD && q.headers['x-key'] === process.env.ADMIN_PASSWORD;
