const mongoose = require('mongoose');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || process.env.DB_URL || process.env.MONGODB_URI || process.env.database_url;
console.log('Connecting to DB...');

mongoose.connect(dbUrl).then(async () => {
  const collection = mongoose.connection.db.collection('auctionitems');
  
  // Show current state
  const all = await collection.find({}).sort({ createdAt: -1 }).project({ status: 1, currentBid: 1, createdAt: 1 }).toArray();
  console.log('Current auction items:');
  console.log(JSON.stringify(all, null, 2));
  
  // Reset failed/pending to active
  const result = await collection.updateMany(
    { status: { $in: ['failed', 'pending'] } },
    { $set: { status: 'active' } }
  );
  console.log('\nReset to active:', result.modifiedCount, 'items');
  
  // Show updated state
  const updated = await collection.find({}).sort({ createdAt: -1 }).project({ status: 1, currentBid: 1, createdAt: 1 }).toArray();
  console.log('\nUpdated auction items:');
  console.log(JSON.stringify(updated, null, 2));
  
  process.exit(0);
}).catch(e => {
  console.log('ERROR:', e.message);
  process.exit(1);
});
