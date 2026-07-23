/**
 * Auction Bid Flow - Full Integration Test Script
 * Tests: Create AuctionItem -> Place Bids -> Verify State
 * All results are logged with timestamps.
 */

const mongoose = require('mongoose');
require('dotenv').config();

const DB_URL = process.env.DATABASE_URL || process.env.database_url;
const LOG_SEP = '─'.repeat(60);

function log(label, data, isError = false) {
  const ts = new Date().toISOString();
  const icon = isError ? '❌' : '✅';
  console.log(`\n${icon} [${ts}] ${label}`);
  if (data && Object.keys(data).length > 0) {
    console.log(JSON.stringify(data, null, 2));
  }
}

async function run() {
  console.log(LOG_SEP);
  console.log('🚀 AUCTION BID FLOW TEST STARTED');
  console.log(LOG_SEP);

  // ── Connect ──────────────────────────────────────────────────
  console.log('\n📡 Connecting to MongoDB...');
  await mongoose.connect(DB_URL);
  console.log('✅ Connected to: ' + DB_URL.split('@')[1]);

  const db = mongoose.connection.db;
  const auctionItems = db.collection('auctionitems');

  // ── Step 1: Get any real user as bidder ──────────────────────
  console.log('\n' + LOG_SEP);
  console.log('STEP 1: Find a user to use as bidder');
  console.log(LOG_SEP);

  const sampleUsers = await db.collection('users').find({}).limit(5).toArray();
  console.log('All user roles found:', sampleUsers.map(u => ({ id: u._id, email: u.email, role: u.role })));
  
  const bidder = sampleUsers[0];
  if (!bidder) {
    log('ERROR: No users found in DB at all!', {}, true);
    process.exit(1);
  }
  log('Using bidder', { _id: bidder._id, email: bidder.email, role: bidder.role });
  const bidderId = bidder._id;

  // ── Step 2: Get product and stream ──────────────────────────
  console.log('\n' + LOG_SEP);
  console.log('STEP 2: Find product and stream');
  console.log(LOG_SEP);

  const product = await db.collection('products').findOne({});
  if (!product) {
    log('ERROR: No product found in DB. Cannot run test.', {}, true);
    process.exit(1);
  }
  log('Product found', { _id: product._id, title: product.title });

  const stream = await db.collection('livestreams').findOne({});
  if (!stream) {
    log('ERROR: No livestream found. Cannot run test.', {}, true);
    process.exit(1);
  }
  log('Stream found', { _id: stream._id, title: stream.title, status: stream.status });

  // ── Step 3: Create fresh auction item ────────────────────────
  console.log('\n' + LOG_SEP);
  console.log('STEP 3: Create fresh auction item (status=active, currentBid=50)');
  console.log(LOG_SEP);

  const newItem = {
    streamId: stream._id,
    productId: product._id,
    status: 'active',
    currentBid: 50,
    highestBidderId: null,
    bidIncrement: 5,
    timerDuration: 300,
    endsAt: new Date(Date.now() + 300 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const insertResult = await auctionItems.insertOne(newItem);
  const auctionItemId = insertResult.insertedId;
  log('Auction item created', { _id: auctionItemId.toString(), status: 'active', currentBid: 50 });

  // ── Step 4: Run bid test scenarios ───────────────────────────
  const bidTests = [
    { label: 'BID TOO LOW - should FAIL',         amount: 30  },
    { label: 'BID EQUAL TO CURRENT - should FAIL', amount: 50  },
    { label: 'VALID BID - should PASS',            amount: 75  },
    { label: 'HIGHER BID - should PASS',           amount: 100 },
    { label: 'LOWER THAN CURRENT - should FAIL',   amount: 80  },
    { label: 'NEW HIGH BID - should PASS',         amount: 150 },
  ];

  for (const test of bidTests) {
    console.log('\n' + LOG_SEP);
    console.log(`STEP 4 - ${test.label}`);
    console.log(LOG_SEP);

    const before = await auctionItems.findOne({ _id: auctionItemId });
    console.log(`   📋 Before: status="${before.status}" | currentBid=${before.currentBid}`);
    console.log(`   💰 Attempting bid: amount=${test.amount}`);

    // Exact same MongoDB query as placeBidSecure service
    const filter = {
      _id: auctionItemId,
      status: 'active',
      $or: [
        { currentBid: { $lt: test.amount } },
        { currentBid: 0 }
      ],
    };
    const update = {
      $set: {
        currentBid: test.amount,
        highestBidderId: bidderId,
        updatedAt: new Date(),
      }
    };
    const updated = await auctionItems.findOneAndUpdate(filter, update, { returnDocument: 'after' });

    if (!updated) {
      const reason = before.status !== 'active'
        ? `status is "${before.status}" not "active"`
        : `bidAmount (${test.amount}) must be strictly greater than currentBid (${before.currentBid})`;

      log(`RESULT: BID REJECTED ❌ — ${reason}`, {
        attempted_bid: test.amount,
        current_bid_in_db: before.currentBid,
        status_in_db: before.status,
        reason,
      }, true);
    } else {
      log(`RESULT: BID ACCEPTED ✅`, {
        new_currentBid: updated.currentBid,
        highestBidder: updated.highestBidderId?.toString(),
        status: updated.status,
      });
    }
  }

  // ── Step 5: Final DB state ───────────────────────────────────
  console.log('\n' + LOG_SEP);
  console.log('STEP 5: Final auction item state in DB');
  console.log(LOG_SEP);

  const finalState = await auctionItems.findOne({ _id: auctionItemId });
  log('Final state in MongoDB', {
    _id: finalState._id.toString(),
    status: finalState.status,
    currentBid: finalState.currentBid,
    highestBidderId: finalState.highestBidderId?.toString() || null,
    endsAt: finalState.endsAt,
  });

  // Cleanup
  await auctionItems.deleteOne({ _id: auctionItemId });
  console.log('\n🧹 Test item deleted from DB (cleanup done).');

  console.log('\n' + LOG_SEP);
  console.log('🏁 ALL TESTS COMPLETE');
  console.log(LOG_SEP);
  process.exit(0);
}

run().catch(err => {
  console.error('\n💥 UNCAUGHT ERROR:', err.message);
  console.error(err.stack);
  process.exit(1);
});
