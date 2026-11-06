/* Debug key types in Upstash */
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
  console.log('🔍 Testing key types...');

  // Test betslip:prof with different commands
  const commands = [
    ['GET', 'betslip:prof'],
    ['HGETALL', 'betslip:prof'],
    ['HGET', 'betslip:prof', 'kasra_rst'],
    ['LRANGE', 'betslip:prof', 0, -1],
    ['SMEMBERS', 'betslip:prof'],
    ['ZRANGE', 'betslip:prof', 0, -1],
  ];

  for (const cmd of commands) {
    try {
      const result = await kv(cmd);
      console.log(`${cmd[0]} betslip:prof:`, result);
    } catch (e) {
      console.log(`${cmd[0]} betslip:prof: ERROR - ${e.message}`);
    }
  }

  // Also check betslip:b:kasra_rst
  console.log('\n📖 Reading bets hash...');
  try {
    const bets = await kv(['HVALS', 'betslip:b:kasra_rst']);
    console.log(`Bets count: ${bets?.length || 0}`);
    if (bets && bets.length > 0) {
      console.log('First bet:', JSON.parse(bets[0]));
    }
  } catch (e) {
    console.log('Error reading bets:', e.message);
  }

  // Check tgc
  console.log('\n📖 Reading telegram config...');
  try {
    const tg = await kv(['GET', 'betslip:tgc:kasra_rst']);
    console.log('TG Config:', tg);
  } catch (e) {
    console.log('Error reading TG:', e.message);
  }

  // Check old data
  console.log('\n📖 Reading old blob...');
  try {
    const old = await kv(['GET', 'betslip:d:kasra_rst']);
    console.log('Old blob:', old ? JSON.parse(old) : null);
  } catch (e) {
    console.log('Error reading old blob:', e.message);
  }

  // Check sessions
  console.log('\n📖 Reading sessions...');
  try {
    const sessionKeys = await kv(['KEYS', 'betslip:sess:*']);
    console.log('Session keys:', sessionKeys);
    for (const sk of sessionKeys) {
      const val = await kv(['GET', sk]);
      console.log(`  ${sk}: ${val}`);
    }
  } catch (e) {
    console.log('Error reading sessions:', e.message);
  }
}

main().catch(e => { console.error('❌ Error:', e); process.exit(1); });