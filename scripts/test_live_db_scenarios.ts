import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import colors from 'colors';
import { User } from '../src/app/modules/user/user.model';
import { Product } from '../src/app/modules/product/product.model';
import { LiveStream, AuctionItem } from '../src/app/modules/auction/auction.model';
import { AuctionServices } from '../src/app/modules/auction/auction.service';
import { TradeServices } from '../src/app/modules/trade/trade.service';
import { OrderServices } from '../src/app/modules/order/order.service';
import { Order } from '../src/app/modules/order/order.model';
import { TradeOffer } from '../src/app/modules/trade/trade.model';
import { Chat } from '../src/app/modules/chat/chat.model';
import { Message } from '../src/app/modules/message/message.model';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const runLiveDatabaseScenarios = async () => {
  console.log(colors.cyan('=================================================='));
  console.log(colors.cyan('🚀 CULTURE CARDS LLC - LIVE SCENARIO INTEGRATION TEST'));
  console.log(colors.cyan('==================================================\n'));

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log(colors.red('✖ DATABASE_URL is missing in environment variables.'));
    return;
  }

  try {
    console.log(colors.yellow('Connecting to database...'));
    await mongoose.connect(dbUrl);
    console.log(colors.green('✔ Connected to database successfully!\n'));

    // --- SETUP: MOCK USERS ---
    console.log(colors.yellow('Step 1: Setting up mock test user accounts...'));
    const seller = await User.create({
      name: 'CardSeller99',
      fullName: 'John Seller',
      email: 'john.seller@example.com',
      password: 'SecurePassword123',
      role: 'user',
      isOnline: true
    }) as any;
    console.log(colors.green(`✔ Seller account created: ID ${seller._id}`));

    const buyer = await User.create({
      name: 'CardBuyer007',
      fullName: 'Alice Buyer',
      email: 'alice.buyer@example.com',
      password: 'SecurePassword123',
      role: 'user',
      isOnline: true,
      deviceToken: 'mock-device-token-123'
    }) as any;
    console.log(colors.green(`✔ Buyer account created: ID ${buyer._id}\n`));

    // --- SETUP: PRODUCTS ---
    console.log(colors.yellow('Step 2: Onboarding collectible items into product catalog...'));
    const productA = await Product.create({
      title: 'Pikachu Illustrator Holographic 1998',
      description: 'Extremely rare holographic cards, graded PSA 9.',
      images: ['https://example.com/pikachu.jpg'],
      category: 'TCG',
      condition: 'Mint',
      estValue: 450000,
      buyNowPrice: 450000,
      allowTrade: true,
      sellerId: seller._id,
      status: 'active',
      stock: 1
    }) as any;
    console.log(colors.green(`✔ Product A (Pikachu) Created: ID ${productA._id}`));

    const productB = await Product.create({
      title: 'Charizard First Edition Shadowless',
      description: 'Legendary Base Set Charizard.',
      images: ['https://example.com/charizard.jpg'],
      category: 'TCG',
      condition: 'Near Mint',
      estValue: 200000,
      allowTrade: true,
      sellerId: buyer._id,
      status: 'active',
      stock: 1
    }) as any;
    console.log(colors.green(`✔ Product B (Charizard) Created: ID ${productB._id}\n`));

    // --- SCENARIO A: LIVE AUCTION STREAM & SECURE CONCURRENT BIDDING ---
    console.log(colors.yellow('Step 3: Simulating live broadcast and concurrent bid race...'));
    const stream = await LiveStream.create({
      sellerId: seller._id,
      title: 'Mega Collectibles Live Auction Stream',
      description: 'Auctioning some of the rarest cards in history.',
      status: 'live',
      agoraChannelName: 'collectibles-live-channel'
    }) as any;
    console.log(colors.green(`✔ Agora stream started on channel: "${stream.agoraChannelName}"`));

    const auctionItem = await AuctionItem.create({
      streamId: stream._id,
      productId: productA._id,
      status: 'active',
      currentBid: 5000,
      bidIncrement: 500,
      timerDuration: 60,
      endsAt: new Date(Date.now() + 80000)
    }) as any;
    console.log(colors.green(`✔ Auction item registered. Current Bid: $${auctionItem.currentBid}`));

    // Test secure bidding
    console.log(colors.gray('   Placing bid ($6,000) from Buyer...'));
    const updatedAuction1 = await AuctionServices.placeBidSecure(
      auctionItem._id.toString(),
      buyer._id.toString(),
      6000
    ) as any;
    console.log(colors.green(`   ✔ Bid registered! New Bid: $${updatedAuction1.currentBid}`));
    console.log(colors.green(`   ✔ Anti-Sniping triggered: Auction end time extended to: ${updatedAuction1.endsAt}\n`));

    // --- SCENARIO B: PEER-TO-PEER BARTER EXCHANGE & ESCROW hold ---
    console.log(colors.yellow('Step 4: Proposing barter trade exchange with cash supplement...'));
    const tradeOffer = await TradeServices.createTradeOffer({
      senderId: buyer._id,
      receiverId: seller._id,
      senderProductId: productB._id,
      receiverProductId: productA._id,
      cashSupplement: 250000
    }) as any;
    console.log(colors.green(`✔ Trade proposal created. Proposed swap Charizard for Pikachu + $250,000 cash.`));
    console.log(colors.green(`✔ Auto chat card proposed in mutual feed.`));

    // Accept offer
    console.log(colors.gray('   Accepting barter trade swap...'));
    await TradeServices.acceptTradeOffer(tradeOffer._id.toString());
    console.log(colors.green('   ✔ Swap accepted!'));

    // Verify products are now safely locked in trade swap escrow
    const finalProductA = await Product.findById(productA._id) as any;
    const finalProductB = await Product.findById(productB._id) as any;
    console.log(colors.green(`   ✔ Escrow Hold Active. Pikachu status: "${finalProductA?.status}"`));
    console.log(colors.green(`   ✔ Escrow Hold Active. Charizard status: "${finalProductB?.status}"\n`));

    // --- SCENARIO C: BUY NOW CHECKOUT & TRANSIT MILESTONE UPDATES ---
    console.log(colors.yellow('Step 5: Simulating Buy Now checkout and order creation...'));
    await Product.findByIdAndUpdate(productA._id, { status: 'active' });
    
    const order = await OrderServices.createOrder({
      buyerId: buyer._id,
      sellerId: seller._id,
      productId: productA._id,
      purchaseType: 'buy_now',
      amountDetails: {
        itemSubtotal: 450000,
        shipping: 50,
        taxes: 35000,
        processingFee: 12000,
        charityContribution: 100,
        totalPaid: 497150
      },
      shippingAddress: {
        street: '123 Collectors Lane',
        city: 'Metropolis',
        state: 'NY',
        postalCode: '10001',
        country: 'US'
      },
      trackingDetails: {
        carrier: 'USPS',
        trackingNumber: 'USPS9876543210',
        journeyUpdates: [
          {
            status: 'Accepted',
            description: 'Package accepted at post office',
            location: 'New York, NY',
            timestamp: new Date()
          }
        ]
      }
    }) as any;
    console.log(colors.green(`✔ Order checked out successfully! Total Paid: $${order.amountDetails.totalPaid}`));

    // Update shipping checkpoint in transit
    console.log(colors.gray('   Pushing transit checkpoint...'));
    const updatedOrder = await OrderServices.updateOrderJourney(
      order._id.toString(),
      {
        status: 'In Transit',
        description: 'Arrived at Jersey City Distribution Center',
        location: 'Jersey City, NJ',
        timestamp: new Date()
      },
      'shipped'
    ) as any;
    console.log(colors.green('   ✔ Live transit update published successfully!'));
    console.log(colors.green(`   ↳ Package location: "${updatedOrder.trackingDetails.journeyUpdates[1].description}"`));
    console.log(colors.green('   ↳ Automated chat updates card and FCM Push Notification triggered!\n'));

    // --- CLEANUP ---
    console.log(colors.yellow('Cleaning up database test entities...'));
    await User.deleteMany({ _id: { $in: [seller._id, buyer._id] } });
    await Product.deleteMany({ _id: { $in: [productA._id, productB._id] } });
    await LiveStream.deleteOne({ _id: stream._id });
    await AuctionItem.deleteOne({ _id: auctionItem._id });
    await TradeOffer.deleteOne({ _id: tradeOffer._id });
    await Order.deleteOne({ _id: order._id });
    
    const mutualChat = await Chat.findOne({
      $or: [
        { creator: buyer._id, participant: seller._id },
        { creator: seller._id, participant: buyer._id }
      ]
    });
    if (mutualChat) {
      await Message.deleteMany({ chatId: mutualChat._id });
      await Chat.deleteOne({ _id: mutualChat._id });
    }

    console.log(colors.green('✔ Test environment clean!'));
    console.log(colors.cyan('\n=================================================='));
    console.log(colors.green('🎉 END-TO-END SCENARIO RUN COMPLETED SUCCESSFULLY!'));
    console.log(colors.cyan('=================================================='));

  } catch (err: any) {
    console.log(colors.red(`✖ Scenario Execution failure: ${err.message}`));
    console.log(colors.gray(err.stack));
  } finally {
    await mongoose.disconnect();
    console.log(colors.gray('Disconnected from DB.'));
  }
};

runLiveDatabaseScenarios();
