/* Clear all database collections - fresh start */
require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

const userSchema = new mongoose.Schema({ username: String, email: String }, { strict: false });
const betSchema = new mongoose.Schema({ userId: mongoose.Schema.Types.ObjectId }, { strict: false });
const tgConfigSchema = new mongoose.Schema({ userId: mongoose.Schema.Types.ObjectId }, { strict: false });
const sessionSchema = new mongoose.Schema({ token: String, userId: mongoose.Schema.Types.ObjectId }, { strict: false });
const backupSchema = new mongoose.Schema({ userId: mongoose.Schema.Types.ObjectId }, { strict: false });
const migrationSchema = new mongoose.Schema({ userId: mongoose.Schema.Types.ObjectId }, { strict: false });
const lockSchema = new mongoose.Schema({ key: String }, { strict: false });
const notificationSkipSchema = new mongoose.Schema({ userId: mongoose.Schema.Types.ObjectId }, { strict: false });
const lastNotifyResultSchema = new mongoose.Schema({}, { strict: false });

const User = mongoose.model('User', userSchema);
const Bet = mongoose.model('Bet', betSchema);
const TgConfig = mongoose.model('TgConfig', tgConfigSchema);
const Session = mongoose.model('Session', sessionSchema);
const Backup = mongoose.model('Backup', backupSchema);
const Migration = mongoose.model('Migration', migrationSchema);
const Lock = mongoose.model('Lock', lockSchema);
const NotificationSkip = mongoose.model('NotificationSkip', notificationSkipSchema);
const LastNotifyResult = mongoose.model('LastNotifyResult', lastNotifyResultSchema);

async function main() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'betslip', bufferCommands: false });
  console.log('✅ Connected');

  const collections = [
    { name: 'User', model: User },
    { name: 'Bet', model: Bet },
    { name: 'TgConfig', model: TgConfig },
    { name: 'Session', model: Session },
    { name: 'Backup', model: Backup },
    { name: 'Migration', model: Migration },
    { name: 'Lock', model: Lock },
    { name: 'NotificationSkip', model: NotificationSkip },
    { name: 'LastNotifyResult', model: LastNotifyResult },
  ];

  console.log('🧹 Clearing all collections...\n');
  for (const { name, model } of collections) {
    const result = await model.deleteMany({});
    console.log(`  🗑 ${name}: ${result.deletedCount} documents deleted`);
  }

  console.log('\n✅ All collections cleared!');
  console.log('🎯 Database is now empty and ready for fresh start.');

  await mongoose.disconnect();
  console.log('🔌 Disconnected');
}

main().catch(e => { console.error('❌ Error:', e); process.exit(1); });