/* List all keys in Upstash Redis */
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

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

async function main() {
  console.log('🔍 Scanning all keys in Upstash...');
  const keys = await kv(['KEYS', '*']);
  console.log(`\n📋 Found ${keys.length} keys:\n`);

  // Group by prefix
  const groups = {};
  for (const key of keys) {
    const prefix = key.split(':')[0] + ':' + (key.split(':')[1] || '');
    groups[prefix] = (groups[prefix] || 0) + 1;
  }

  for (const [prefix, count] of Object.entries(groups).sort()) {
    console.log(`  ${prefix}* : ${count} keys`);
  }

  // Show first 50 full keys
  console.log('\n📝 First 50 keys:');
  keys.slice(0, 50).forEach(k => console.log('  ' + k));

  // Check specific patterns
  console.log('\n🔍 Checking specific patterns:');
  for (const pattern of ['betslip:prof:*', 'betslip:b:*', 'betslip:tgc:*', 'betslip:sess:*', 'betslip:d:*', 'betslip:*']) {
    const keys = await kv(['KEYS', pattern]);
    console.log(`  ${pattern}: ${keys.length} keys`);
    if (keys.length > 0 && keys.length <= 10) {
      keys.forEach(k => console.log('    - ' + k));
    }
  }
}

main().catch(e => { console.error('❌ Error:', e); process.exit(1); });