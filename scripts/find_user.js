require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.DATABASE_URL).then(async () => {
  const db = mongoose.connection.db;
  const users = db.collection('users');

  // Search with regex (case-insensitive)
  const found = await users.find({ email: { $regex: 'hetehew380', $options: 'i' } }).toArray();

  if (found.length === 0) {
    console.log('❌ No user found with email containing: hetehew380');
    // Show last 5 users
    const recent = await users.find({}).sort({ createdAt: -1 }).limit(5).toArray();
    console.log('\nRecent 5 users:');
    recent.forEach(u =>
      console.log(`  - ${u.email} | verified: ${u.verified} | sellerQuestion: ${u.sellerQuestion || 'N/A'}`),
    );
  } else {
    found.forEach(u =>
      console.log(`✅ Found: ${u.email} | verified: ${u.verified} | sellerQuestion: ${u.sellerQuestion || 'N/A'}`),
    );
  }

  process.exit(0);
}).catch(err => {
  console.error(err.message);
  process.exit(1);
});
