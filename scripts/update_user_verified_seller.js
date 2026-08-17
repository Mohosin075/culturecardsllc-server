require('dotenv').config();
const mongoose = require('mongoose');

const TARGET_EMAIL = 'hetehew380@gwshare.com';

mongoose
  .connect(process.env.DATABASE_URL)
  .then(async () => {
    try {
      const db = mongoose.connection.db;
      const usersCollection = db.collection('users');

      const user = await usersCollection.findOne({ email: TARGET_EMAIL });

      if (!user) {
        console.log(`❌ User not found: ${TARGET_EMAIL}`);
        process.exit(1);
      }

      console.log(`✅ User found: ${user.email}`);
      console.log(`   Current roles:          ${JSON.stringify(user.roles)}`);
      console.log(`   Current verified:       ${user.verified}`);
      console.log(`   Current sellerVerified: ${user.sellerVerified}`);
      console.log(`   Current sellerQuestion: ${user.sellerQuestion}`);

      // Ensure 'seller' is in roles array
      const currentRoles = user.roles || [];
      if (!currentRoles.includes('seller')) {
        currentRoles.push('seller');
      }

      // Update: add seller role, verified=true, sellerVerified=false (pending), sellerQuestion='pending'
      const result = await usersCollection.updateOne(
        { email: TARGET_EMAIL },
        {
          $set: {
            verified: true,
            sellerVerified: false,   // false = pending in dashboard
            sellerQuestion: 'pending',
            roles: currentRoles,
            status: 'active',
          },
        },
      );

      console.log(`\n📝 Updated: ${result.modifiedCount} document(s) modified`);

      // Verify
      const updated = await usersCollection.findOne({ email: TARGET_EMAIL });
      console.log('\n✅ Final user state:');
      console.log(`   email:          ${updated.email}`);
      console.log(`   roles:          ${JSON.stringify(updated.roles)}`);
      console.log(`   verified:       ${updated.verified}`);
      console.log(`   sellerVerified: ${updated.sellerVerified}  ← false means pending in dashboard`);
      console.log(`   sellerQuestion: ${updated.sellerQuestion}`);
      console.log(`   status:         ${updated.status}`);

      process.exit(0);
    } catch (err) {
      console.error('❌ Error:', err.message);
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('❌ DB Connection Error:', err.message);
    process.exit(1);
  });
